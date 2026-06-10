// =====================================================================
// Sync Banco Inter PJ (extrato) → Supabase (visao=PJ). Node 20+, zero deps.
// Roda no GitHub Actions, mesmo padrão do sync-organizze.mjs.
//
// API oficial e GRATUITA do Inter Empresas (developers.inter.co):
//   - OAuth2 client_credentials + mTLS (certificado .crt + chave .key
//     gerados no Internet Banking PJ em "Nova Integração", escopo extrato.read)
//   - GET /banking/v2/extrato/completo (paginado, até 90 dias por chamada)
//
// Dedup: hash estável "inter_<idTransacao>" (ou fallback data|valor|titulo).
// Categorização: aplica regras_classificacao + glossario_termos do Supabase
// (mesma lógica de sugestão do app), só em lançamentos novos.
//
// Secrets esperados (GitHub → Settings → Secrets and variables → Actions):
//   INTER_CLIENT_ID, INTER_CLIENT_SECRET  → da integração criada no IB
//   INTER_CERT_B64, INTER_KEY_B64         → .crt e .key em base64
//   SUPABASE_URL, SUPABASE_SERVICE_KEY    → já existem (sync Organizze)
//   INTER_CONTA_ID                        → id (uuid) da conta "Inter PJ" na tabela contas
// Opcional: DRY_RUN (default true), SYNC_DAYS (default 30, máx 90)
// =====================================================================
import https from 'node:https';

const CLIENT_ID = process.env.INTER_CLIENT_ID;
const CLIENT_SECRET = process.env.INTER_CLIENT_SECRET;
const CERT = process.env.INTER_CERT_B64 ? Buffer.from(process.env.INTER_CERT_B64, 'base64') : null;
const KEY = process.env.INTER_KEY_B64 ? Buffer.from(process.env.INTER_KEY_B64, 'base64') : null;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const CONTA_ID = process.env.INTER_CONTA_ID;
const DRY_RUN = String(process.env.DRY_RUN ?? 'true') === 'true';
const DAYS = Math.min(90, Number(process.env.SYNC_DAYS || 30));
const VISAO = 'PJ';
const INTER_HOST = 'cdpj.partners.bancointer.com.br';

if (!CLIENT_ID || !CLIENT_SECRET || !CERT || !KEY || !SUPABASE_URL || !SERVICE_KEY || !CONTA_ID) {
  console.error('Faltam variáveis: INTER_CLIENT_ID/SECRET, INTER_CERT_B64/KEY_B64, SUPABASE_URL/SERVICE_KEY, INTER_CONTA_ID.');
  process.exit(1);
}

const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/* ---- HTTPS com mTLS (API Inter exige certificado de cliente) ---- */
function interReq({ method = 'GET', path, headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname: INTER_HOST, path, method, headers, cert: CERT, key: KEY },
      resp => {
        let data = '';
        resp.on('data', c => (data += c));
        resp.on('end', () => {
          if (resp.statusCode >= 200 && resp.statusCode < 300) {
            try { resolve(data ? JSON.parse(data) : null); } catch (e) { resolve(data); }
          } else reject(new Error(`Inter ${method} ${path} → ${resp.statusCode} ${data.slice(0, 400)}`));
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function interToken() {
  const form = new URLSearchParams({
    client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
    grant_type: 'client_credentials', scope: 'extrato.read',
  }).toString();
  const r = await interReq({
    method: 'POST', path: '/oauth/v2/token',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(form) },
    body: form,
  });
  if (!r || !r.access_token) throw new Error('Token Inter não retornou access_token: ' + JSON.stringify(r).slice(0, 200));
  return r.access_token;
}

async function interExtrato(token, dataInicio, dataFim) {
  const out = [];
  let pagina = 0, totalPaginas = 1;
  while (pagina < totalPaginas) {
    const r = await interReq({
      path: `/banking/v2/extrato/completo?dataInicio=${dataInicio}&dataFim=${dataFim}&pagina=${pagina}&tamanhoPagina=200`,
      headers: { Authorization: `Bearer ${token}` },
    });
    const txs = r?.transacoes || [];
    out.push(...txs);
    totalPaginas = Number(r?.totalPaginas ?? 1);
    pagina += 1;
    if (!txs.length) break;
  }
  return out;
}

/* ---- Supabase REST (service_role, mesmo padrão do sync Organizze) ---- */
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

/* ---- Categorização: regras + glossário (mesma lógica do app) ---- */
function buildSuggester(regras, glossario, catsById) {
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
  const end = new Date();
  const start = new Date(); start.setDate(start.getDate() - DAYS);
  console.log(`Inter PJ → Supabase | janela ${iso(start)}..${iso(end)} | DRY_RUN=${DRY_RUN}`);

  console.log('1) Token OAuth (mTLS)…');
  const token = await interToken();

  console.log('2) Extrato completo…');
  const txs = await interExtrato(token, iso(start), iso(end));
  console.log(`   ${txs.length} transações no período`);

  console.log('3) Hashes existentes no Supabase…');
  const existentes = await sbGet(`/rest/v1/movimentos?select=hash&visao=eq.${VISAO}&hash=like.inter_*&limit=20000`);
  const have = new Set(existentes.map(x => x.hash));

  const [regras, glossario] = await Promise.all([
    sbGet('/rest/v1/regras_classificacao?select=padrao,peso,categoria_id,ativo&limit=5000'),
    sbGet(`/rest/v1/glossario_termos?select=termo,categoria_sugerida_id&limit=5000`),
  ]);
  const suggest = buildSuggester(regras, glossario);

  const rows = [];
  for (const t of txs) {
    const valor = Math.abs(Number(t.valor || 0));
    if (!valor) continue;
    const data = (t.dataEntrada || t.dataTransacao || '').slice(0, 10);
    if (!data) continue;
    const sinal = String(t.tipoOperacao || '').toUpperCase() === 'C' ? 1 : -1;
    const descricao = [t.titulo, t.descricao].filter(Boolean).join(' — ').trim() || t.tipoTransacao || 'Transação Inter';
    const hash = t.idTransacao ? `inter_${t.idTransacao}` : `inter_${data}|${valor}|${descricao}`.slice(0, 120);
    if (have.has(hash)) continue;
    have.add(hash); // evita dupe dentro do mesmo lote
    rows.push({
      data, descricao_original: descricao, descricao_limpa: descricao,
      valor, sinal, conta_id: CONTA_ID, categoria_id: suggest(descricao),
      visao: VISAO, hash,
    });
  }
  console.log(`4) Novos a gravar: ${rows.length} (dedup pulou ${txs.length - rows.length})`);
  const comCat = rows.filter(r => r.categoria_id).length;
  console.log(`   ${comCat} já categorizados pelas regras/glossário`);

  if (DRY_RUN) {
    rows.slice(0, 10).forEach(r => console.log(`   [dry] ${r.data} ${r.sinal > 0 ? '+' : '-'}${r.valor} ${r.descricao_limpa.slice(0, 60)}`));
    console.log('DRY_RUN=true — nada gravado. Rode com DRY_RUN=false para gravar.');
    return;
  }
  for (let i = 0; i < rows.length; i += 200) {
    await sbSend('POST', '/rest/v1/movimentos', rows.slice(i, i + 200), 'return=minimal');
    console.log(`   gravados ${Math.min(i + 200, rows.length)}/${rows.length}`);
  }
  console.log('OK — sync Inter PJ concluído.');
}

main().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
