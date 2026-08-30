// =====================================================================
// Sync Pluggy (Open Finance) → Supabase. Node 20+, zero deps.
// Cobre Nubank (visao=FAMILIA), Inter PF (visao=JUCA) e C6 (visao=PIPEX)
// numa tacada só. Lê a tabela `pluggy_conexoes` (item_id → conta_id + visao)
// e, pra cada item ativo:
//   1) PATCH /items/{id}  → FORÇA refresh (gratuito)
//   2) espera o item terminar de atualizar (poll GET /items/{id})
//   3) GET /accounts?itemId  → acha a conta bancária do item
//   4) GET /transactions?accountId → pagina tudo na janela
//   5) normaliza → upsert em `movimentos` (dedup por hash pluggy_<txId>)
//   6) grava o saldo real do banco em `contas.saldo_atual`
//
// POR QUE O PATCH SEMPRE: neutraliza a incógnita do trial. Tanto faz se o
// auto-sync gratuito dispara sozinho pós-trial — a gente força o refresh
// (gratuito de qualquer jeito) e lê o resultado. Comportamento previsível.
//
// ROTA MEU PLUGGY (gratuita, uso pessoal — meu.pluggy.ai): os bancos são
// conectados no Meu Pluggy e entram na aplicação via conector "MeuPluggy"
// (1 item por banco). Esses itens se atualizam DIARIAMENTE sozinhos e
// continuam funcionando após o fim do trial de 15 dias. Se o PATCH de
// refresh for negado pós-trial, o sync NÃO aborta: segue e lê o dado
// diário que já está lá. Guia completo: scripts/PLUGGY.md.
//
// Categorização: mesma lógica do app (regras_classificacao + glossario_termos),
// só em lançamentos novos.
//
// Secrets (GitHub → Settings → Secrets and variables → Actions):
//   PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET  → dashboard.pluggy.ai
//   SUPABASE_URL, SUPABASE_SERVICE_KEY      → já existem (sync Inter/Organizze)
// Opcional:
//   DRY_RUN   (default 'true')  → true = só simula, não grava
//   SYNC_DAYS (default 90)      → janela pra trás em dias
//   DISCOVER  (default 'false') → true = só LISTA os accounts de cada item
//                                 (id, nome, tipo, saldo) + as contas do app,
//                                 pra mapear o conta_id. Não grava nada.
//   ITEM_IDS  → lista de item_id separados por vírgula. Com DISCOVER=true,
//               dispensa a tabela pluggy_conexoes (útil ANTES do mapeamento:
//               conectou no Meu Pluggy, copiou os item ids, descobre tudo).
//   MAPPING   → JSON [{item_id,conta_id,visao,banco,account_id?},...]:
//               upserta pluggy_conexoes e SAI (não sincroniza). Permite fazer
//               o mapeamento pelo próprio workflow, sem SQL Editor.
// =====================================================================

const CLIENT_ID = process.env.PLUGGY_CLIENT_ID;
const CLIENT_SECRET = process.env.PLUGGY_CLIENT_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const OWNER = process.env.OWNER_USER_ID || null;
const DRY_RUN = String(process.env.DRY_RUN ?? 'true') === 'true';
const DISCOVER = String(process.env.DISCOVER ?? 'false') === 'true';
const DAYS = Number(process.env.SYNC_DAYS || 90);
const ITEM_IDS = (process.env.ITEM_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
const MAPPING = (process.env.MAPPING || '').trim();
const PROBE_DAYS = Number(process.env.PROBE_DAYS || 0);   // >0: só lista movimentos recentes e sai

// MAPPING/PROBE só falam com o Supabase; o resto precisa também das credenciais Pluggy.
if (!SUPABASE_URL || !SERVICE_KEY || (!MAPPING && !PROBE_DAYS && (!CLIENT_ID || !CLIENT_SECRET))) {
  console.error('Faltam variáveis: PLUGGY_CLIENT_ID/SECRET, SUPABASE_URL/SERVICE_KEY.');
  process.exit(1);
}

const PLUGGY = 'https://api.pluggy.ai';
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---- Pluggy REST (X-API-KEY após o /auth) ---- */
let API_KEY = null;
async function pluggyAuth() {
  const r = await fetch(`${PLUGGY}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET }),
  });
  if (!r.ok) throw new Error(`Pluggy /auth → ${r.status} ${(await r.text()).slice(0, 300)}`);
  API_KEY = (await r.json())?.apiKey;
  if (!API_KEY) throw new Error('Pluggy /auth não retornou apiKey');
}
async function pg(path, { method = 'GET', body = null } = {}) {
  const r = await fetch(PLUGGY + path, {
    method,
    headers: { 'X-API-KEY': API_KEY, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : null,
  });
  if (!r.ok) throw new Error(`Pluggy ${method} ${path} → ${r.status} ${(await r.text()).slice(0, 300)}`);
  const txt = await r.text();
  return txt ? JSON.parse(txt) : null;
}

/* Força refresh e espera o item sair de UPDATING (cap ~90s). */
async function refreshItem(itemId) {
  await pg(`/items/${itemId}`, { method: 'PATCH', body: {} });
  for (let i = 0; i < 30; i++) {
    await sleep(3000);
    const it = await pg(`/items/${itemId}`);
    const st = it?.status;
    if (st && st !== 'UPDATING') return st;   // UPDATED, OUTDATED, LOGIN_ERROR, etc.
  }
  return 'UPDATING';                          // estourou o tempo — lê o que tiver
}

/* Estado real do item — quem diz se o MeuPluggy está DE FATO atualizando no banco.
   `lastUpdatedAt` = último refresh bem-sucedido = o carimbo honesto do frescor;
   `status`/`executionStatus` dizem por que parou (LOGIN_ERROR, OUTDATED etc.). */
async function getItemInfo(itemId) {
  try {
    const it = await pg(`/items/${itemId}`);
    return { status: it?.status || null, executionStatus: it?.executionStatus || null,
             lastUpdatedAt: it?.lastUpdatedAt || null };
  } catch (e) {
    return { status: null, executionStatus: null, lastUpdatedAt: null,
             erro: String(e.message).slice(0, 120) };
  }
}

async function getAccounts(itemId) {
  const r = await pg(`/accounts?itemId=${itemId}`);
  return r?.results || [];
}

/* Pagina transações (GET /v2/transactions, cursor `after`) na janela [from, hoje].
   O /transactions v1 por página foi APOSENTADO (410 ENDPOINT_DEPRECATED).
   Atenção aos params do v2: é dateFrom (não from) e NÃO existe pageSize
   (páginas fixas de 500) — mandar os antigos dá 400 "should not exist". */
async function getTransactions(accountId, from) {
  const out = [];
  let after = null;
  for (let page = 0; page < 100; page++) {      // trava dura: 100×500 = 50k
    const qs = `accountId=${accountId}&dateFrom=${from}` +
      (after ? `&after=${encodeURIComponent(after)}` : '');
    const r = await pg(`/v2/transactions?${qs}`);
    out.push(...(r?.results || []));
    const next = r?.next;
    if (!next) break;
    // `next` pode vir como URL completa (cursor no param `after`) ou cursor puro.
    if (typeof next === 'string' && next.includes('after=')) {
      try { after = new URL(next, PLUGGY).searchParams.get('after'); } catch { after = null; }
    } else if (typeof next === 'string') {
      after = next;
    } else if (next && typeof next === 'object') {
      after = next.after || next.cursor || null;
    } else after = null;
    if (!after) break;
  }
  return out;
}

/* ---- Supabase REST (service_role, mesmo padrão do sync Inter) ---- */
const sbHeaders = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };
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

/* ---- Nome do estabelecimento, sem o embrulho de cada fonte ----
   'Pix enviado: "Cp :60746948-DEGUTTI"' e 'PIX ENVIADO - Cp :60746948-DEGUTTI'
   viram os dois DEGUTTI, pra o guard de conteúdo comparar maçã com maçã. */
function nomeChave(desc) {
  return String(desc || '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/^(PIX|TED|DOC)\s+(ENVIADO|RECEBIDO|ENVIADA|RECEBIDA)(\s+INTERNO)?/, '')
    .replace(/\bCP\s*:?\s*\d+-?/g, '')
    .replace(/[^A-Z]/g, '')
    .slice(0, 24);
}

/* ---- Categorização: regras + glossário (mesma lógica do app/sync Inter) ---- */
function buildSuggester(regras, glossario) {
  const gl = (glossario || []).filter(g => g.categoria_sugerida_id)
    .sort((a, b) => (b.termo || '').length - (a.termo || '').length);
  const rg = (regras || []).filter(r => r.ativo !== false && r.categoria_id);
  return desc => {
    const up = (desc || '').toUpperCase();
    if (!up) return null;
    for (const g of gl) if (g.termo && up.includes(g.termo.toUpperCase())) return g.categoria_sugerida_id;
    let best = null;
    for (const r of rg) if (r.padrao && up.includes(r.padrao.toUpperCase())) {
      if (!best || (r.peso || 1) > (best.peso || 1)) best = r;
    }
    return best ? best.categoria_id : null;
  };
}

async function main() {
  // ---- Modo PROBE: lista movimentos recentes por conta (read-only) e sai.
  //      Serve pra conferir de onde cada transação já vem (evita duplicar
  //      com os syncs OFX/Organizze ao ligar um item novo). ----
  if (PROBE_DAYS > 0) {
    const d = new Date(); d.setDate(d.getDate() - PROBE_DAYS);
    const contas = await sbGet('/rest/v1/contas?select=id,nome,visao');
    const nome = Object.fromEntries(contas.map(c => [c.id, `${c.nome} (${c.visao})`]));
    const movs = await sbGet(`/rest/v1/movimentos?select=data,valor,sinal,descricao_limpa,conta_id,hash&data=gte.${iso(d)}&order=data.desc&limit=300`);
    console.log(`PROBE: ${movs.length} movimentos desde ${iso(d)}:`);
    movs.forEach(m => console.log(`   ${m.data} ${m.sinal > 0 ? '+' : '-'}${m.valor} | ${nome[m.conta_id] || m.conta_id} | ${String(m.hash || '').slice(0, 18)} | ${String(m.descricao_limpa || '').slice(0, 60)}`));
    return;
  }

  // ---- Modo MAPPING: upserta pluggy_conexoes e sai. ----
  if (MAPPING) {
    let rows;
    try { rows = JSON.parse(MAPPING); } catch (e) { throw new Error(`MAPPING não é JSON válido: ${e.message}`); }
    if (!Array.isArray(rows) || !rows.length) throw new Error('MAPPING precisa ser um array não-vazio.');
    for (const r of rows) {
      if (!r.item_id || !r.conta_id || !r.visao) throw new Error(`MAPPING: item_id, conta_id e visao são obrigatórios (${JSON.stringify(r)})`);
    }
    await sbSend('POST', '/rest/v1/pluggy_conexoes?on_conflict=item_id,account_id', rows,
      'resolution=merge-duplicates,return=minimal');
    console.log(`MAPPING: ${rows.length} conexão(ões) gravadas em pluggy_conexoes:`);
    rows.forEach(r => console.log(`   ${r.banco || '?'} (${r.visao}) item ${r.item_id} → conta ${r.conta_id}${r.account_id ? ` [account ${r.account_id}]` : ''}`));
    return;
  }

  const end = new Date();
  const start = new Date(); start.setDate(start.getDate() - DAYS);
  const from = iso(start);
  console.log(`Pluggy → Supabase | janela ${from}..${iso(end)} | DRY_RUN=${DRY_RUN} DISCOVER=${DISCOVER}`);

  console.log('1) Auth Pluggy…');
  await pluggyAuth();

  console.log('2) Conexões mapeadas (pluggy_conexoes)…');
  let conexoes;
  if (DISCOVER && ITEM_IDS.length) {
    // Itens avulsos (antes do mapeamento existir): descobre direto pelos ids.
    conexoes = ITEM_IDS.map(id => ({ item_id: id, banco: '(sem mapeamento)', visao: '?' }));
    console.log(`   usando ITEM_IDS avulsos: ${ITEM_IDS.length} item(ns)`);
  } else {
    conexoes = await sbGet('/rest/v1/pluggy_conexoes?select=item_id,conta_id,visao,banco,account_id,ativo&ativo=eq.true');
    if (!conexoes.length) { console.log('   Nenhuma conexão ativa. Conecte os bancos e cadastre em pluggy_conexoes.'); return; }
    console.log(`   ${conexoes.length} conexão(ões): ${conexoes.map(c => `${c.banco}/${c.visao}`).join(', ')}`);
  }

  // Modo DISCOVER: lista os accounts de cada item + as contas do app, pra montar o mapeamento.
  if (DISCOVER) {
    try {
      const contas = await sbGet('/rest/v1/contas?select=id,nome,banco,tipo,visao,ativo&order=visao,nome');
      console.log('\n--- Contas do app (use o id como conta_id no mapeamento) ---');
      contas.forEach(ct => console.log(`   ${ct.id} | ${ct.visao} | ${ct.nome}${ct.banco ? ` (${ct.banco})` : ''}${ct.tipo ? ` [${ct.tipo}]` : ''}${ct.ativo === false ? ' [INATIVA]' : ''}`));
    } catch (e) { console.log('   (falha ao listar contas do app: ' + e.message + ')'); }

    for (const c of conexoes) {
      console.log(`\n=== ${c.banco} (${c.visao}) item ${c.item_id} ===`);
      try {
        try {
          const it = await pg(`/items/${c.item_id}`);
          console.log(`   conector: ${it?.connector?.name || '?'} | status: ${it?.status || '?'}`);
        } catch (e) { console.log('   (item inacessível: ' + e.message + ')'); }
        const accs = await getAccounts(c.item_id);
        accs.forEach(a => console.log(`   account ${a.id} | ${a.type}/${a.subtype} | "${a.name}" | saldo R$ ${Number(a.balance ?? 0).toFixed(2)}${a.creditData ? ` | creditData ${JSON.stringify({closeDay: a.creditData.balanceCloseDate, dueDay: a.creditData.balanceDueDate, limite: a.creditData.creditLimit, disponivel: a.creditData.availableCreditLimit})}` : ''}`));
        if (!accs.length) console.log('   (sem accounts — item ainda não sincronizou? rode sem DISCOVER ou aguarde)');
      } catch (e) { console.log('   erro:', e.message); }
    }
    console.log('\nDISCOVER=true — nada gravado. Use os account_id/saldos pra mapear conta_id em pluggy_conexoes.');
    return;
  }

  console.log('3) Hashes Pluggy já existentes…');
  const existentes = await sbGet('/rest/v1/movimentos?select=hash&hash=like.pluggy_*&limit=50000');
  const have = new Set(existentes.map(x => x.hash));

  const [regras, glossario] = await Promise.all([
    sbGet('/rest/v1/regras_classificacao?select=padrao,peso,categoria_id,ativo&limit=5000'),
    sbGet('/rest/v1/glossario_termos?select=termo,categoria_sugerida_id&limit=5000'),
  ]);
  const suggest = buildSuggester(regras, glossario);

  // Um item costuma servir 2 conexões (conta + cartão do mesmo banco). O PATCH é
  // por ITEM, então tentar uma vez por conexão dobrava as chamadas à toa.
  const refreshFeito = new Map();   // item_id → status
  const itemInfo = new Map();       // item_id → {status, lastUpdatedAt} (1 GET por item)
  const falhas = [];                // conexões que estouraram: viram exit 1 no fim
  const paradas = [];               // itens sem refresh há dias: também reprovam o run

  for (const c of conexoes) {
    console.log(`\n=== ${c.banco} (${c.visao}) ===`);
    try {
      let st;
      if (refreshFeito.has(c.item_id)) {
        st = `${refreshFeito.get(c.item_id)} [mesmo item da conexão anterior]`;
      } else {
        console.log('   refresh do item (PATCH /items)…');
        try {
          st = await refreshItem(c.item_id);
        } catch (e) {
          // Item criado no MeuPluggy NUNCA aceita PATCH ("MeuPluggy item cant be
          // updated", 400) — é limitação do conector, não do plano. Quem atualiza
          // é o próprio MeuPluggy, 1x/dia. Seguir lendo o que já está lá.
          st = `sem refresh (${String(e.message).slice(0, 120)})`;
        }
        refreshFeito.set(c.item_id, st);
      }
      console.log(`   status: ${st}`);

      // FRESCOR REAL DO ITEM (30/08): o run ficava verde com item congelado há semanas.
      let info;
      if (itemInfo.has(c.item_id)) info = itemInfo.get(c.item_id);
      else {
        info = await getItemInfo(c.item_id);
        itemInfo.set(c.item_id, info);
        const idade = info.lastUpdatedAt ? (Date.now() - new Date(info.lastUpdatedAt)) / 864e5 : null;
        if (idade != null && idade > 3) {
          paradas.push(`${c.banco} (${c.visao}): item sem refresh do banco desde ${String(info.lastUpdatedAt).slice(0, 10)} (${Math.floor(idade)} dias)`);
        }
      }
      console.log(`   item: status=${info.status || '?'}${info.executionStatus ? '/' + info.executionStatus : ''} · último refresh no banco: ${info.lastUpdatedAt || 'desconhecido'}${info.erro ? ` · (GET /items falhou: ${info.erro})` : ''}`);

      const accs = await getAccounts(c.item_id);
      // Conta bancária do item: se o mapeamento fixou account_id, usa ele;
      // senão pega a primeira conta tipo BANK (corrente/poupança).
      const acc = c.account_id
        ? accs.find(a => a.id === c.account_id)
        : accs.find(a => a.type === 'BANK') || accs[0];
      if (!acc) { console.log('   ⚠ nenhum account encontrado — pulando.'); continue; }
      console.log(`   account ${acc.id} | ${acc.type}/${acc.subtype} | saldo R$ ${Number(acc.balance ?? 0).toFixed(2)}`);

      const txs = await getTransactions(acc.id, from);
      console.log(`   ${txs.length} transações na janela`);

      const rows = [];
      for (const t of txs) {
        const valor = Math.abs(Number(t.amount || 0));
        if (!valor) continue;
        const data = String(t.date || '').slice(0, 10);   // ISO8601 → YYYY-MM-DD (sem new Date(): fuso)
        if (!data) continue;
        const sinal = String(t.type || '').toUpperCase() === 'CREDIT' ? 1 : -1;
        const descricao = (t.description || t.descriptionRaw || 'Transação Pluggy').trim();
        const hash = `pluggy_${t.id}`;
        if (have.has(hash)) continue;
        have.add(hash);
        rows.push({
          data, descricao_original: descricao, descricao_limpa: descricao,
          valor, sinal, conta_id: c.conta_id, categoria_id: suggest(descricao),
          visao: c.visao, hash,
          ...(OWNER ? { user_id: OWNER } : {}),
        });
      }
      /* GUARD DE CONTEÚDO (21/07) — o dedup por hash só enxerga o que o PRÓPRIO Pluggy
         gravou. O mesmo lançamento vindo de carga manual/extrato PDF tem outro hash e
         entrava de novo (foi o que duplicou 22–28/06 e o que um dispatch de 90 dias
         re-gravaria inteiro). Aqui a comparação é por CONTEÚDO e é count-aware:
         cada linha existente só "absorve" um candidato.
         - data igual + valor + sinal  → sempre pula;
         - ±3 dias (o Pluggy às vezes data 1–2 dias depois do extrato) → só pra
           lançamento com mais de 7 dias e com o mesmo nome de estabelecimento, pra
           não engolir uma compra nova de valor repetido (ex.: o café de R$ 14). */
      const jaTem = await sbGet(`/rest/v1/movimentos?conta_id=eq.${c.conta_id}&data=gte.${from}&select=data,valor,sinal,descricao_original&limit=20000`);
      const pool = jaTem.map(e => ({ data: e.data, valor: Number(e.valor), sinal: e.sinal, nome: nomeChave(e.descricao_original), usado: false }));
      const hoje = new Date().toISOString().slice(0, 10);
      const diasAtras = d => Math.round((new Date(hoje) - new Date(d)) / 864e5);
      const antes = rows.length;
      const novos = rows.filter(r => {
        const exato = pool.find(p => !p.usado && p.data === r.data && p.valor === r.valor && p.sinal === r.sinal);
        if (exato) { exato.usado = true; return false; }
        if (diasAtras(r.data) > 7) {
          const nome = nomeChave(r.descricao_original);
          const perto = pool.find(p => !p.usado && p.valor === r.valor && p.sinal === r.sinal
            && Math.abs(Math.round((new Date(p.data) - new Date(r.data)) / 864e5)) <= 3
            && nome && p.nome && (p.nome.includes(nome) || nome.includes(p.nome)));
          if (perto) { perto.usado = true; return false; }
        }
        return true;
      });
      rows.length = 0; rows.push(...novos);
      if (antes !== rows.length) console.log(`   guard de conteúdo: ${antes - rows.length} já existiam com outro hash (carga manual/extrato) — não regravados`);

      const comCat = rows.filter(r => r.categoria_id).length;
      console.log(`   novos a gravar: ${rows.length} (dedup pulou ${txs.length - rows.length}); ${comCat} já categorizados`);

      if (DRY_RUN) {
        rows.slice(0, 8).forEach(r => console.log(`   [dry] ${r.data} ${r.sinal > 0 ? '+' : '-'}${r.valor} ${r.descricao_limpa.slice(0, 55)}`));
      } else {
        for (let i = 0; i < rows.length; i += 200) {
          // on_conflict=hash (02/08): sem isso, um hash que escapasse do set `have`
          // (dois runs simultâneos — cron + botão ⚡) devolvia 409 e derrubava o LOTE
          // inteiro de 200 linhas, abortando a conexão antes de gravar o saldo.
          await sbSend('POST', '/rest/v1/movimentos?on_conflict=hash', rows.slice(i, i + 200),
            'resolution=ignore-duplicates,return=minimal');
        }
        // Saldo real do banco → card usa contas.saldo_atual (não a soma cega).
        // GUARD (21/07): item MeuPluggy não aceita refresh (PATCH /items → 400) e pode ficar
        // dias parado. Se o app já conhece movimento MAIS NOVO que a última transação que o
        // Pluggy tem, o saldo dele está atrasado — não sobrescrever (senão o extrato conferido
        // na mão volta pro valor velho todo dia de manhã).
        const saldo = Number(acc.balance ?? NaN);
        // FURO CORRIGIDO (02/08): as duas pontas comparavam datas FUTURAS (parcelas de
        // cartão vão até 2027, e um agendamento lançado à mão também). Bastava um
        // lançamento futuro no app pra `dbLast > pluggyLast` virar verdade PARA SEMPRE
        // e o saldo daquela conta nunca mais atualizar, em silêncio. Agora os dois lados
        // olham só o que já aconteceu — maçã com maçã.
        const hoje = new Date().toISOString().slice(0, 10);
        const pluggyLast = txs.map(t => String(t.date || '').slice(0, 10))
          .filter(d => d && d <= hoje).sort().pop() || null;
        const [ultimo] = await sbGet(`/rest/v1/movimentos?conta_id=eq.${c.conta_id}&data=lte.${hoje}&select=data&order=data.desc&limit=1`);
        const dbLast = ultimo?.data || null;
        // FURO CORRIGIDO (31/07): item congelado devolve ZERO transações na janela →
        // pluggyLast ficava null, o guard não disparava e o saldo velho voltava por cima
        // do extrato conferido (Inter PF: 129,39 → 428,43, o saldo de 15/07). Agora
        // "sem transação nenhuma" também conta como atrasado: conta parada tem saldo
        // parado, então não gravar é inofensivo; gravar é que estraga.
        const atrasado = !!(dbLast && (!pluggyLast || dbLast > pluggyLast));
        // CARIMBO HONESTO (30/08): `saldo_atualizado_em` era new Date() — item congelado
        // re-carimbava o saldo VELHO como fresco todo dia (Cartao Inter PF ficou 19 dias
        // mostrando "atualizado hoje" com a dívida de 11/08, e o guard por transação não
        // pega cartão: as parcelas futuras já gravadas caem na janela e parecem feed vivo).
        // Agora o carimbo é o lastUpdatedAt do ITEM (quando o banco entregou o dado) e só
        // grava se for mais novo que o carimbo que o app já tem (extrato importado na mão
        // vence dado velho do Pluggy).
        const stamp = info.lastUpdatedAt || new Date().toISOString();
        const [contaAtual] = await sbGet(`/rest/v1/contas?id=eq.${c.conta_id}&select=saldo_atual,saldo_atualizado_em`);
        const stampDB = contaAtual?.saldo_atualizado_em ? new Date(contaAtual.saldo_atualizado_em) : null;
        const stampVelho = !!(stampDB && new Date(stamp) <= stampDB);
        if (Number.isFinite(saldo) && !atrasado && !stampVelho) {
          await sbSend('PATCH', `/rest/v1/contas?id=eq.${c.conta_id}`,
            { saldo_atual: saldo, saldo_atualizado_em: stamp }, 'return=minimal');
          console.log(`   saldo gravado: R$ ${saldo.toFixed(2)} (dado do banco de ${String(stamp).slice(0, 10)})`);
        } else if (Number.isFinite(saldo) && stampVelho && info.lastUpdatedAt
                   && Number(contaAtual.saldo_atual) === saldo
                   && stampDB - new Date(stamp) > 2 * 864e5) {
          // Mesmo saldo com carimbo do app >2 dias mais novo que o refresh real do banco =
          // a mentira deixada pelas versões antigas — corrigir só o carimbo pra baixo.
          await sbSend('PATCH', `/rest/v1/contas?id=eq.${c.conta_id}`,
            { saldo_atualizado_em: stamp }, 'return=minimal');
          console.log(`   carimbo corrigido: saldo R$ ${saldo.toFixed(2)} é de ${String(stamp).slice(0, 10)} (não de ${String(contaAtual.saldo_atualizado_em).slice(0, 10)})`);
        } else if (atrasado || stampVelho) {
          console.log(`   ⚠ saldo NÃO gravado: ${stampVelho ? `app já tem carimbo ${contaAtual.saldo_atualizado_em} ≥ refresh do item ${stamp}` : `Pluggy parou em ${pluggyLast || 'nenhuma transação na janela'} e o app já tem ${dbLast}`} (saldo do Pluggy R$ ${saldo.toFixed(2)})`);
        }
        // VERIFICAÇÃO DIÁRIA (cartão): dívida calculada pelos lançamentos vs dívida real
        // do banco. Divergência estável = gap de histórico (ok, informativo); divergência
        // que CRESCE de um dia pro outro = duplicata ou lançamento perdido → investigar.
        if (String(acc.type).toUpperCase() === 'CREDIT' && Number.isFinite(saldo)) {
          let dev = 0;
          for (let off = 0; ; off += 1000) {
            const page = await sbGet(`/rest/v1/movimentos?conta_id=eq.${c.conta_id}&select=valor,sinal&limit=1000&offset=${off}`);
            for (const r of page) dev += (r.sinal < 0 ? 1 : -1) * Number(r.valor);
            if (page.length < 1000) break;
          }
          const diff = dev - saldo;
          console.log(`   verificação cartão: lançamentos R$ ${dev.toFixed(2)} vs banco R$ ${saldo.toFixed(2)} → ${Math.abs(diff) <= 50 ? '✔ confere' : `⚠ Δ R$ ${diff.toFixed(2)} (gap de histórico se estável; duplicata se cresceu)`}`);
        }
        console.log(`   OK — ${rows.length} gravados.`);
      }
    } catch (e) {
      console.log(`   ⚠ erro em ${c.banco}: ${e.message}`);   // um banco falhar não derruba os outros
      falhas.push(`${c.banco} (${c.visao}): ${e.message}`);
    }
  }

  if (DRY_RUN) console.log('\nDRY_RUN=true — nada gravado. Rode com DRY_RUN=false para gravar.');
  else console.log('\nOK — sync Pluggy concluído.');

  // OBSERVABILIDADE (02/08): antes, um item que falhasse na leitura só virava uma
  // linha de log e o workflow ficava VERDE — dava pra ficar semanas sem sincronizar
  // sem ninguém perceber. Agora falha de conexão reprova o run.
  if (paradas.length) {
    console.error(`\n🔴 ${paradas.length} item(ns) PARADO(s) no Pluggy — o dado na tela está velho. Reconectar no meu.pluggy.ai:`);
    paradas.forEach(p => console.error(`   - ${p}`));
  }
  if (falhas.length) {
    console.error(`\n❌ ${falhas.length} de ${conexoes.length} conexões falharam:`);
    falhas.forEach(f => console.error(`   - ${f}`));
  }
  if (falhas.length || paradas.length) process.exit(1);
}

main().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
