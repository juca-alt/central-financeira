// =====================================================================
// Sync Nubank (extrato por e-mail) → Supabase. Node 20+, zero deps.
// Mesmo padrão do sync-inter.mjs / sync-pluggy.mjs (Supabase REST com
// service_role, dedup por hash, categorização regras+glossário).
//
// POR QUE POR E-MAIL: o Nubank PF não tem API pública gratuita e bloqueia
// acesso não oficial (pynubank morreu em ago/2023). O caminho grátis é o
// extrato OFX que o próprio Nubank envia por e-mail. Este script:
//   1) autentica na Gmail API (OAuth2 refresh token, escopo gmail.readonly)
//   2) busca os e-mails de extrato (GMAIL_QUERY), pega o anexo .ofx
//   3) parseia o OFX (mesma lógica do app.js), com FITID pra dedup estável
//   4) upsert em `movimentos` (dedup por hash nubank_<fitid>)
//   5) grava o saldo real (LEDGERBAL do OFX) em `contas.saldo_atual`
//
// Semi-automático: você toca "Gerar extrato" no app do Nubank (~30s/mês);
// o resto (parse, dedup, categoria, gravação) roda sozinho no GitHub Actions.
//
// ---------------------------------------------------------------------
// SETUP (1x) — gerar o refresh token do Gmail:
//   a) Google Cloud Console → novo projeto → ativar "Gmail API".
//   b) Tela de consentimento OAuth: External, modo Testing, adicione seu
//      e-mail como "test user".
//   c) Credenciais → criar "OAuth client ID" tipo "Desktop app".
//      Guarde CLIENT_ID e CLIENT_SECRET.
//   d) Gere o refresh token (escopo gmail.readonly). Caminho fácil:
//      https://developers.google.com/oauthplayground → engrenagem →
//      "Use your own OAuth credentials" → cole client id/secret →
//      autorize o escopo https://www.googleapis.com/auth/gmail.readonly →
//      "Exchange authorization code for tokens" → copie o "Refresh token".
//   e) Cadastre no GitHub (Settings → Secrets → Actions):
//      GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, NUBANK_CONTA_ID
// ---------------------------------------------------------------------
//
// Secrets/env esperados:
//   GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN → OAuth do Gmail
//   NUBANK_CONTA_ID                    → id (uuid) da conta na tabela contas
//   SUPABASE_URL, SUPABASE_SERVICE_KEY → já existem (sync Inter/Pluggy)
// Opcional:
//   NUBANK_VISAO  (default 'FAMILIA')  → visão deste sync (alinhado ao Pluggy)
//   GMAIL_QUERY   (default abaixo)      → filtro de busca do Gmail
//   SYNC_DAYS     (default 45)          → janela pra trás (só afeta a query default)
//   DRY_RUN       (default 'true')      → true = só simula, não grava
//   OWNER_USER_ID                       → multi-inquilino: carimba o dono
// =====================================================================

const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const CONTA_ID = process.env.NUBANK_CONTA_ID;
const OWNER = process.env.OWNER_USER_ID || null;
const VISAO = process.env.NUBANK_VISAO || 'FAMILIA';
const DRY_RUN = String(process.env.DRY_RUN ?? 'true') === 'true';
const DAYS = Number(process.env.SYNC_DAYS || 45);
// Remetente/assunto exato do Nubank será travado após inspecionar 1 e-mail real.
// Default amplo: qualquer e-mail do domínio nubank com anexo .ofx na janela.
const QUERY = process.env.GMAIL_QUERY
  || `from:(nubank.com.br OR nubank) has:attachment filename:ofx newer_than:${DAYS}d`;

if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN || !SUPABASE_URL || !SERVICE_KEY || !CONTA_ID) {
  console.error('Faltam variáveis: GMAIL_CLIENT_ID/SECRET/REFRESH_TOKEN, SUPABASE_URL/SERVICE_KEY, NUBANK_CONTA_ID.');
  process.exit(1);
}

const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me';

/* ---- Gmail API (OAuth2 refresh token → access token) ---- */
let ACCESS_TOKEN = null;
async function gmailAuth() {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: REFRESH_TOKEN,
    grant_type: 'refresh_token',
  });
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!r.ok) throw new Error(`Gmail token → ${r.status} ${(await r.text()).slice(0, 300)}`);
  ACCESS_TOKEN = (await r.json())?.access_token;
  if (!ACCESS_TOKEN) throw new Error('Gmail /token não retornou access_token');
}
async function gm(path) {
  const r = await fetch(GMAIL + path, { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } });
  if (!r.ok) throw new Error(`Gmail GET ${path} → ${r.status} ${(await r.text()).slice(0, 300)}`);
  return r.json();
}

/* Lista os ids das mensagens que batem na query (pagina). */
async function listMessages(q) {
  const out = [];
  let pageToken = '';
  do {
    const r = await gm(`/messages?q=${encodeURIComponent(q)}&maxResults=100${pageToken ? `&pageToken=${pageToken}` : ''}`);
    (r?.messages || []).forEach(m => out.push(m.id));
    pageToken = r?.nextPageToken || '';
  } while (pageToken && out.length < 500);
  return out;
}

/* Acha (recursivo) o primeiro part cujo filename termina em .ofx. */
function findOfxPart(payload) {
  const walk = p => {
    if (!p) return null;
    const fn = (p.filename || '').toLowerCase();
    if (fn.endsWith('.ofx') && p.body?.attachmentId) return p;
    for (const sub of p.parts || []) { const hit = walk(sub); if (hit) return hit; }
    return null;
  };
  return walk(payload);
}

/* Baixa e decodifica (base64url) o anexo OFX de uma mensagem. Null se não houver. */
async function getOfxText(msgId) {
  const msg = await gm(`/messages/${msgId}?format=full`);
  const part = findOfxPart(msg?.payload);
  if (!part) return null;
  const att = await gm(`/messages/${msgId}/attachments/${part.body.attachmentId}`);
  const b64 = String(att?.data || '').replace(/-/g, '+').replace(/_/g, '/');
  if (!b64) return null;
  return Buffer.from(b64, 'base64').toString('latin1');   // OFX BR costuma ser ISO-8859-1
}

/* ---- Parsers OFX (portados de app.js: parseAmount/normDate/parseOFX/parseOfxSaldo) ---- */
function parseAmount(s) {
  if (s == null) return NaN;
  if (typeof s === 'number') return s;
  let t = String(s).trim().replace(/R\$|\s/g, '');
  const neg = /^-/.test(t) || /\(.*\)/.test(t) || /D$/i.test(t);
  t = t.replace(/^[-+]/, '').replace(/[()CD]/gi, '');
  if (/,/.test(t) && /\./.test(t)) t = t.replace(/\./g, '').replace(',', '.');
  else if (/,/.test(t)) t = t.replace(',', '.');
  const n = parseFloat(t);
  return isNaN(n) ? NaN : (neg ? -n : n);
}
function normDate(s) {
  const t = (s || '').trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = t.match(/^(\d{4})(\d{2})(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (m) { let y = m[3]; if (y.length === 2) y = (+y > 50 ? '19' : '20') + y; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
  return '';
}
/* Igual ao app.js, mas capturando FITID pra dedup estável. */
function parseOFX(text) {
  const out = [];
  const re = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let m;
  while ((m = re.exec(text))) {
    const blk = m[1];
    const g = t => { const r = new RegExp(`<${t}>([^<\\r\\n]*)`, 'i').exec(blk); return r ? r[1].trim() : ''; };
    const dt = normDate(g('DTPOSTED').slice(0, 8));
    const amt = parseAmount(g('TRNAMT'));
    if (!dt || isNaN(amt)) continue;
    out.push({
      date: dt,
      description: g('MEMO') || g('NAME') || '',
      amount: Math.abs(amt),
      sinal: amt < 0 ? -1 : 1,
      fitid: g('FITID') || '',
    });
  }
  return out;
}
function parseOfxSaldo(text) {
  const m = /<LEDGERBAL>[\s\S]*?<BALAMT>([^<\r\n]+)/i.exec(text);
  if (m) { const v = parseAmount(m[1]); if (!isNaN(v)) return v; }
  return null;
}

/* Hash de conteúdo (fallback quando o OFX não traz FITID). Determinístico. */
function uhash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/* ---- Supabase REST (service_role, mesmo padrão dos outros syncs) ---- */
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

/* ---- Categorização: regras + glossário (mesma lógica do app/sync Pluggy) ---- */
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
  console.log(`Nubank (e-mail OFX) → Supabase | visao=${VISAO} | DRY_RUN=${DRY_RUN}`);
  console.log(`   query: ${QUERY}`);

  console.log('1) Auth Gmail…');
  await gmailAuth();

  console.log('2) Buscando e-mails de extrato…');
  const ids = await listMessages(QUERY);
  console.log(`   ${ids.length} e-mail(s) na busca`);
  if (!ids.length) { console.log('   Nenhum e-mail. Gere o extrato no app do Nubank ou ajuste GMAIL_QUERY.'); return; }

  console.log('3) Baixando e parseando OFX…');
  const parsed = [];   // {date, description, amount, sinal, fitid}
  let saldoFinal = null, saldoData = null;
  for (const id of ids) {
    try {
      const ofx = await getOfxText(id);
      if (!ofx) { console.log(`   msg ${id}: sem anexo .ofx — pulando`); continue; }
      const txs = parseOFX(ofx);
      parsed.push(...txs);
      const s = parseOfxSaldo(ofx);
      // Saldo mais recente vence: usa a maior data de transação do arquivo como referência.
      const maxDt = txs.reduce((a, t) => (t.date > a ? t.date : a), '');
      if (s != null && (saldoData == null || maxDt > saldoData)) { saldoFinal = s; saldoData = maxDt; }
      console.log(`   msg ${id}: ${txs.length} transações`);
    } catch (e) { console.log(`   msg ${id}: erro ${e.message}`); }
  }
  console.log(`   total parseado: ${parsed.length} transações`);
  if (!parsed.length) { console.log('   Nada a gravar.'); return; }

  console.log('4) Hashes Nubank já existentes…');
  const existentes = await sbGet('/rest/v1/movimentos?select=hash&hash=like.nubank_*&limit=50000');
  const have = new Set(existentes.map(x => x.hash));

  const [regras, glossario] = await Promise.all([
    sbGet('/rest/v1/regras_classificacao?select=padrao,peso,categoria_id,ativo&limit=5000'),
    sbGet('/rest/v1/glossario_termos?select=termo,categoria_sugerida_id&limit=5000'),
  ]);
  const suggest = buildSuggester(regras, glossario);

  console.log('5) Normalizando + dedup…');
  const rows = [];
  for (const t of parsed) {
    const hash = t.fitid
      ? `nubank_${t.fitid}`
      : `nubank_${uhash(`${t.date}|${t.amount}|${t.sinal}|${t.description}`)}`;
    if (have.has(hash)) continue;
    have.add(hash);   // dedup também dentro do próprio lote (e-mails com janelas sobrepostas)
    const descricao = (t.description || 'Transação Nubank').trim();
    rows.push({
      data: t.date, descricao_original: descricao, descricao_limpa: descricao,
      valor: t.amount, sinal: t.sinal, conta_id: CONTA_ID,
      categoria_id: suggest(descricao), visao: VISAO, hash,
      ...(OWNER ? { user_id: OWNER } : {}),
    });
  }
  const comCat = rows.filter(r => r.categoria_id).length;
  console.log(`   novos a gravar: ${rows.length} (dedup pulou ${parsed.length - rows.length}); ${comCat} já categorizados`);

  if (DRY_RUN) {
    rows.slice(0, 10).forEach(r => console.log(`   [dry] ${r.data} ${r.sinal > 0 ? '+' : '-'}${r.valor} ${r.descricao_limpa.slice(0, 55)}`));
    console.log(`   [dry] saldo (LEDGERBAL): ${saldoFinal == null ? '(sem saldo no OFX)' : `R$ ${saldoFinal.toFixed(2)}`}`);
    console.log('\nDRY_RUN=true — nada gravado. Rode com DRY_RUN=false para gravar.');
    return;
  }

  console.log('6) Gravando…');
  for (let i = 0; i < rows.length; i += 200) {
    await sbSend('POST', '/rest/v1/movimentos', rows.slice(i, i + 200), 'return=minimal');
  }
  // Saldo real do banco → card usa contas.saldo_atual (não a soma cega dos movimentos).
  if (saldoFinal != null && Number.isFinite(saldoFinal)) {
    await sbSend('PATCH', `/rest/v1/contas?id=eq.${CONTA_ID}`,
      { saldo_atual: saldoFinal, saldo_atualizado_em: new Date().toISOString() }, 'return=minimal');
    console.log(`   saldo gravado: R$ ${saldoFinal.toFixed(2)}`);
  }
  console.log(`\nOK — ${rows.length} movimento(s) gravado(s).`);
}

main().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
