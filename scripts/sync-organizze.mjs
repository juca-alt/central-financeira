// =====================================================================
// Sync Organizze (Família) → Supabase. Node 20+ (fetch nativo, sem deps).
// Roda no GitHub Actions.
// v2: agora ESPELHA as categorias do Organizze (cria no Supabase se faltar,
//     visao=FAMILIA, tipo deduzido do sinal) e linka em movimentos.categoria_id.
//     Também RETROAGE: lançamentos organizze já gravados sem categoria recebem
//     a categoria agora (backfill).
// Docs API: https://github.com/organizze/api-doc
// =====================================================================
const ORG_EMAIL = process.env.ORGANIZZE_EMAIL;
const ORG_TOKEN = process.env.ORGANIZZE_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const DRY_RUN = String(process.env.DRY_RUN ?? 'true') === 'true';
const DAYS = Number(process.env.SYNC_DAYS || 90);
const CONTA_CORRENTE = process.env.CONTA_CORRENTE_ID; // Conta Nubank Familia
const CONTA_CARTAO   = process.env.CONTA_CARTAO_ID;   // Cartao Nubank Familia
const OWNER = process.env.OWNER_USER_ID || null;      // multi-inquilino: carimba o dono (service_role ignora o default auth.uid())

if (!ORG_EMAIL || !ORG_TOKEN || !SUPABASE_URL || !SERVICE_KEY) {
  console.error('Faltam variáveis de ambiente (ORGANIZZE_EMAIL/TOKEN, SUPABASE_URL/SERVICE_KEY).');
  process.exit(1);
}

const ORG = 'https://api.organizze.com.br/rest/v2';
const orgHeaders = {
  'Authorization': 'Basic ' + Buffer.from(`${ORG_EMAIL}:${ORG_TOKEN}`).toString('base64'),
  'User-Agent': `CentralFinanceira (${ORG_EMAIL})`,
  'Content-Type': 'application/json',
};
const sbHeaders = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

async function orgGet(path) {
  const r = await fetch(ORG + path, { headers: orgHeaders });
  if (!r.ok) throw new Error(`Organizze ${path} → ${r.status} ${await r.text()}`);
  return r.json();
}
async function sbGet(path) {
  const r = await fetch(SUPABASE_URL + path, { headers: sbHeaders });
  if (!r.ok) throw new Error(`Supabase GET ${path} → ${r.status} ${await r.text()}`);
  return r.json();
}
async function sbSend(method, path, body, prefer) {
  const r = await fetch(SUPABASE_URL + path, {
    method,
    headers: { ...sbHeaders, 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Supabase ${method} ${path} → ${r.status} ${await r.text()}`);
  const txt = await r.text();
  return txt ? JSON.parse(txt) : null;
}

async function main() {
  const end = new Date();
  const start = new Date(); start.setDate(start.getDate() - DAYS);
  console.log(`Janela: ${iso(start)} .. ${iso(end)} | DRY_RUN=${DRY_RUN} | dias=${DAYS}`);

  const accounts = await orgGet('/accounts');
  console.log('Contas Organizze:', accounts.map(a => `${a.id}:${a.name}`).join(' | '));

  // Categorias do Organizze (id -> nome). Usadas pra espelhar no Supabase.
  const orgCats = await orgGet('/categories');
  const catNameById = new Map(orgCats.map(c => [c.id, String(c.name || '').trim()]));
  console.log(`Categorias no Organizze: ${orgCats.length}`);

  const txs = await orgGet(`/transactions?start_date=${iso(start)}&end_date=${iso(end)}`);
  console.log(`Transações no período: ${Array.isArray(txs) ? txs.length : '??'}`);

  // Categorias FAMILIA já existentes no Supabase. Chave: nome_minusculo|tipo
  const existingCats = await sbGet('/rest/v1/categorias?visao=eq.FAMILIA&select=id,nome,tipo');
  const catKeyToId = new Map(existingCats.map(c => [`${String(c.nome).toLowerCase()}|${c.tipo}`, c.id]));

  // Lançamentos organizze já no banco: external_id -> {id, categoria_id}
  const existing = await sbGet('/rest/v1/movimentos?fonte=eq.organizze&select=id,external_id,categoria_id');
  const existByEid = new Map(existing.map(r => [String(r.external_id), r]));
  console.log(`Já no Supabase (organizze): ${existByEid.size}`);

  const wouldCreateCats = new Set(); // só pra log no dry-run

  // Garante a categoria no Supabase (cria se faltar). Retorna id (ou null).
  async function ensureCat(nome, tipo) {
    if (!nome) return null;
    const key = `${nome.toLowerCase()}|${tipo}`;
    if (catKeyToId.has(key)) return catKeyToId.get(key);
    if (DRY_RUN) { wouldCreateCats.add(`${nome} (${tipo})`); return null; }
    const [created] = await sbSend('POST', '/rest/v1/categorias',
      [{ nome, tipo, visao: 'FAMILIA', ...(OWNER ? { user_id: OWNER } : {}) }], 'return=representation');
    catKeyToId.set(key, created.id);
    return created.id;
  }

  const rows = [];                 // novos a inserir
  const backfill = new Map();      // categoria_id -> [movimento_id,...] (retroação)
  let skipped = 0;
  let backfillCandidatos = 0;      // já existentes, sem categoria, que TÊM categoria no Organizze

  for (const t of (Array.isArray(txs) ? txs : [])) {
    const eid = String(t.id);
    const cents = Number(t.amount_cents ?? 0);
    const sinal = cents < 0 ? -1 : 1;
    const tipo = sinal < 0 ? 'saida' : 'entrada';
    const conta_id = t.credit_card_id ? CONTA_CARTAO : CONTA_CORRENTE;
    if (!conta_id) { skipped++; continue; }

    const catNome = t.category_id ? catNameById.get(t.category_id) : null;
    const categoria_id = await ensureCat(catNome, tipo);

    const ex = existByEid.get(eid);
    if (ex) {
      // já existe: se está sem categoria e há categoria no Organizze, retroage
      if (ex.categoria_id == null && catNome) {
        backfillCandidatos++;
        if (categoria_id) { // só dá pra enfileirar fora do dry-run (precisa do id real)
          if (!backfill.has(categoria_id)) backfill.set(categoria_id, []);
          backfill.get(categoria_id).push(ex.id);
        }
      }
      continue;
    }

    const desc = (t.description || '').trim() || '(sem descrição)';
    rows.push({
      data: t.date,
      descricao_original: desc,
      descricao_limpa: desc,
      valor: Math.abs(cents) / 100,
      sinal,
      conta_id,
      categoria_id,
      visao: 'FAMILIA',
      fonte: 'organizze',
      external_id: eid,
      hash: `organizze:${eid}`,
      ...(OWNER ? { user_id: OWNER } : {}),
    });
  }

  // ============================================================
  // GUARD ANTI-DUPLICATA cross-fonte (count-aware) — 02/07/2026.
  // O dedup por external_id só enxerga o PRÓPRIO organizze; se a mesma
  // transação já entrou por extrato (Importar/PDF/CSV) ou outro sync,
  // duplicava. Agora: impressão digital data|valor|sinal|conta contra
  // TODOS os movimentos existentes na janela, por CONTAGEM (multiset).
  // ============================================================
  const fpExist = new Map();
  {
    const contas = [CONTA_CORRENTE, CONTA_CARTAO].filter(Boolean);
    for (const cid of contas) {
      const evs = await sbGet(`/rest/v1/movimentos?conta_id=eq.${cid}&data=gte.${iso(start)}&data=lte.${iso(end)}&select=data,valor,sinal,conta_id`);
      for (const e of evs) {
        const k = `${String(e.data).slice(0,10)}|${Number(e.valor).toFixed(2)}|${e.sinal}|${e.conta_id}`;
        fpExist.set(k, (fpExist.get(k) || 0) + 1);
      }
    }
  }
  let dupCross = 0;
  const rowsFinal = rows.filter(r0 => {
    const k = `${r0.data}|${Number(r0.valor).toFixed(2)}|${r0.sinal}|${r0.conta_id}`;
    const c = fpExist.get(k) || 0;
    if (c > 0) { fpExist.set(k, c - 1); dupCross++; return false; }
    return true;
  });
  rows.length = 0; rows.push(...rowsFinal);
  console.log(`Guard cross-fonte: ${dupCross} duplicata(s) barrada(s) por impressão digital.`);

  console.log(`Novas a inserir: ${rows.length} (puladas: ${skipped})`);
  console.log(`A retroagir categoria (já existentes, sem categoria): ${backfillCandidatos}`);
  if (DRY_RUN && wouldCreateCats.size) {
    console.log(`Categorias que seriam criadas (${wouldCreateCats.size}): ${[...wouldCreateCats].join(' | ')}`);
  }
  if (rows.length) console.log('Amostra:\n' + JSON.stringify(rows.slice(0, 3), null, 2));

  if (DRY_RUN) { console.log('DRY_RUN — nada inserido/alterado. Rode com dry_run=false para gravar.'); return; }

  // 1) Inserir os novos
  for (let i = 0; i < rows.length; i += 200) {
    const batch = rows.slice(i, i + 200);
    await sbSend('POST', '/rest/v1/movimentos', batch, 'return=minimal');
    console.log(`Inseridos ${batch.length}`);
  }

  // 2) Retroagir categoria nos já existentes (1 PATCH por categoria, via id=in.(...))
  for (const [categoria_id, ids] of backfill) {
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const inList = `(${chunk.join(',')})`; // UUIDs: parênteses/vírgulas são sintaxe do PostgREST, vão crus
      await sbSend('PATCH',
        `/rest/v1/movimentos?id=in.${inList}&categoria_id=is.null`,
        { categoria_id }, 'return=minimal');
      console.log(`Retroagidos ${chunk.length} → categoria ${categoria_id}`);
    }
  }

  console.log('OK — sync concluído (com categorias).');
}
main().catch(e => { console.error(e); process.exit(1); });
