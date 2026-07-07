// =====================================================================
// Carga de dados Comissões LP → Supabase. Node 20+, zero deps.
// Roda no GitHub Actions (lp-load.yml) com a service key dos secrets.
//
// POR QUE ASSIM: o repo é PÚBLICO — dados de clientes não podem ser
// commitados. Este script recebe o payload (JSON gzip+base64) via input
// do workflow_dispatch e grava direto via Supabase REST (service_role).
// DDL não dá pra fazer por aqui (limitação PostgREST): as tabelas lp_*
// precisam existir (scripts/lp_comissao.sql + lp_carteira_v2.sql no
// SQL Editor). Se faltarem, o script explica e sai com erro.
//
// Payload: { carteira:[{apolice,segurado,premio,periodicidade,status,
//            forma_pagto,acordo,no_fluxo}], meses:[...], itens:[...],
//            previstos:[{competencia,descricao,valor,vencimento}] }
//
// Semântica (espelha os SQLs, idempotente):
//   carteira  → upsert; preserva no_fluxo de quem já existe
//   meses     → insere só os que faltam (não sobrescreve status/recebido)
//   itens     → insere só (competencia, apolice) que faltam
//   previstos → só p/ mês com previsto_id null; amarra o id de volta
//
// LOGS: repo público ⇒ logs públicos ⇒ só CONTAGENS, nunca nomes/valores.
// =====================================================================
import { gunzipSync } from 'node:zlib';

const URL = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_KEY, B64 = process.env.PAYLOAD_B64;
if (!URL || !KEY || !B64) { console.error('Faltam SUPABASE_URL/SUPABASE_SERVICE_KEY/PAYLOAD_B64.'); process.exit(1); }
const P = JSON.parse(gunzipSync(Buffer.from(B64, 'base64')).toString('utf8'));

const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
async function req(method, path, body, prefer) {
  const r = await fetch(URL + path, { method, headers: { ...H, ...(prefer ? { Prefer: prefer } : {}) }, body: body ? JSON.stringify(body) : null });
  const txt = await r.text();
  if (!r.ok) throw new Error(`${method} ${path.split('?')[0]} → ${r.status} ${txt.slice(0, 200)}`);
  return txt ? JSON.parse(txt) : null;
}

async function main() {
  // 0) tabelas existem?
  try { await req('GET', '/rest/v1/lp_carteira?select=apolice&limit=1'); }
  catch (e) {
    console.error('Tabelas lp_* não existem ainda. Rode scripts/lp_comissao.sql e scripts/lp_carteira_v2.sql no SQL Editor do Supabase e dispare de novo.');
    throw e;
  }

  // 1) carteira (preserva no_fluxo de quem já existe)
  const exCart = await req('GET', '/rest/v1/lp_carteira?select=apolice,no_fluxo&limit=10000');
  const exMap = new Map(exCart.map(c => [String(c.apolice), c.no_fluxo]));
  const rows = P.carteira.map(c => exMap.has(String(c.apolice)) ? { ...c, no_fluxo: exMap.get(String(c.apolice)) } : c);
  for (let i = 0; i < rows.length; i += 200)
    await req('POST', '/rest/v1/lp_carteira?on_conflict=apolice', rows.slice(i, i + 200), 'resolution=merge-duplicates,return=minimal');
  console.log(`carteira: ${rows.length} gravadas (${rows.length - exMap.size > 0 ? rows.length - exMap.size : 0} novas, ${Math.min(exMap.size, rows.length)} atualizadas)`);

  // 2) meses (só os que faltam)
  const exMes = new Set((await req('GET', '/rest/v1/lp_comissao_meses?select=competencia')).map(m => m.competencia));
  const novosMeses = P.meses.filter(m => !exMes.has(m.competencia));
  if (novosMeses.length) await req('POST', '/rest/v1/lp_comissao_meses', novosMeses, 'return=minimal');
  console.log(`meses: ${novosMeses.length} novos (${P.meses.length - novosMeses.length} já existiam)`);

  // 3) itens (só pares competencia+apolice que faltam)
  let insItens = 0;
  for (const comp of [...new Set(P.itens.map(i => i.competencia))]) {
    const ex = new Set((await req('GET', `/rest/v1/lp_comissao_itens?select=apolice&competencia=eq.${comp}&limit=10000`)).map(x => String(x.apolice)));
    const novo = P.itens.filter(i => i.competencia === comp && !ex.has(String(i.apolice)));
    for (let i = 0; i < novo.length; i += 200)
      await req('POST', '/rest/v1/lp_comissao_itens', novo.slice(i, i + 200), 'return=minimal');
    insItens += novo.length;
    console.log(`itens ${comp}: +${novo.length} (${ex.size} já existiam)`);
  }

  // 4) previstos (só meses sem previsto_id; amarra o id)
  const contas = await req('GET', '/rest/v1/contas?select=id,nome&visao=eq.PIPEX&ativo=eq.true&order=nome&limit=1');
  const contaId = contas[0]?.id || null;
  const mesesDb = await req('GET', '/rest/v1/lp_comissao_meses?select=competencia,previsto_id');
  let insPrev = 0;
  for (const pv of P.previstos) {
    const m = mesesDb.find(x => x.competencia === pv.competencia);
    if (!m || m.previsto_id != null) continue;
    const ins = await req('POST', '/rest/v1/previstos',
      { descricao: pv.descricao, valor: pv.valor, vencimento: pv.vencimento, tipo: 'receber', status: 'aberto', visao: 'PIPEX', conta_id: contaId },
      'return=representation');
    await req('PATCH', `/rest/v1/lp_comissao_meses?competencia=eq.${pv.competencia}`, { previsto_id: ins[0].id }, 'return=minimal');
    insPrev++;
  }
  console.log(`previstos (A Receber): +${insPrev} (${P.previstos.length - insPrev} já existiam) | conta destino: ${contaId ? 'PIPEX ok' : 'nenhuma (ficou sem conta)'}`);
  console.log('OK — carga concluída.');
}

main().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
