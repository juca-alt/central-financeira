// =====================================================================
// Sync Organizze (Família) → Supabase. Node 20+ (fetch nativo, sem deps).
// Roda no GitHub Actions. NÃO testado contra a API real ainda — a 1ª run
// (DRY_RUN=true) serve pra validar o mapeamento antes de inserir.
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
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

async function orgGet(path) {
  const r = await fetch(ORG + path, { headers: orgHeaders });
  if (!r.ok) throw new Error(`Organizze ${path} → ${r.status} ${await r.text()}`);
  return r.json();
}
async function sbGet(path) {
  const r = await fetch(SUPABASE_URL + path, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });
  if (!r.ok) throw new Error(`Supabase GET ${path} → ${r.status} ${await r.text()}`);
  return r.json();
}

async function main() {
  const end = new Date();
  const start = new Date(); start.setDate(start.getDate() - DAYS);
  console.log(`Janela: ${iso(start)} .. ${iso(end)} | DRY_RUN=${DRY_RUN} | dias=${DAYS}`);

  const accounts = await orgGet('/accounts');
  console.log('Contas Organizze:', accounts.map(a => `${a.id}:${a.name}`).join(' | '));

  const txs = await orgGet(`/transactions?start_date=${iso(start)}&end_date=${iso(end)}`);
  console.log(`Transações no período: ${Array.isArray(txs) ? txs.length : '??'}`);

  const existing = await sbGet('/rest/v1/movimentos?select=external_id&fonte=eq.organizze');
  const have = new Set(existing.map(r => String(r.external_id)));
  console.log(`Já no Supabase (organizze): ${have.size}`);

  const rows = [];
  let skipped = 0;
  for (const t of (Array.isArray(txs) ? txs : [])) {
    const eid = String(t.id);
    if (have.has(eid)) continue;
    const cents = Number(t.amount_cents ?? 0);
    const conta_id = t.credit_card_id ? CONTA_CARTAO : CONTA_CORRENTE;
    if (!conta_id) { skipped++; continue; }
    const desc = (t.description || '').trim() || '(sem descrição)';
    rows.push({
      data: t.date,
      descricao_original: desc,
      descricao_limpa: desc,
      valor: Math.abs(cents) / 100,
      sinal: cents < 0 ? -1 : 1,
      conta_id,
      categoria_id: null,
      visao: 'FAMILIA',
      fonte: 'organizze',
      external_id: eid,
      hash: `organizze:${eid}`,
    });
  }
  console.log(`Novas a inserir: ${rows.length} (puladas: ${skipped})`);
  if (rows.length) console.log('Amostra:\n' + JSON.stringify(rows.slice(0, 3), null, 2));

  if (DRY_RUN) { console.log('DRY_RUN — nada inserido. Rode de novo com dry_run=false para gravar.'); return; }
  if (!rows.length) { console.log('Nada novo pra inserir.'); return; }

  for (let i = 0; i < rows.length; i += 200) {
    const batch = rows.slice(i, i + 200);
    const r = await fetch(`${SUPABASE_URL}/rest/v1/movimentos`, {
      method: 'POST',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(batch),
    });
    if (!r.ok) throw new Error(`Supabase insert → ${r.status} ${await r.text()}`);
    console.log(`Inseridos ${batch.length}`);
  }
  console.log('OK — sync concluído.');
}
main().catch(e => { console.error(e); process.exit(1); });
