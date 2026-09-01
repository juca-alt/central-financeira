// =====================================================================
// Ajustes pontuais Comissões LP (P2/P3/P4) → Supabase. Node 20+, zero deps.
// Roda no GitHub Actions (lp-fix.yml) com a service key dos secrets.
//
// POR QUE ASSIM: repo PÚBLICO — sem service key local e sem dados de
// clientes no repo. Este script LÊ o estado atual do banco, aplica os
// ajustes e grava via Supabase REST (service_role, bypassa RLS).
//
// Espelha as fórmulas do app.js (seção "Comissões LP"):
//   fator = pct_div/100 * (1 - pct_imp/100)  ->  0,50 * 0,94 = 0,47
//   base  = soma das comissões dos itens SELECIONADOS do mês
//   liquido = base * fator
//   previsão recorrente = soma FYC (últ. mês fechado) dos MARCADOS * fator
//
// REGRA DE NEGÓCIO (Gustavo 07/07): a base NÃO são todos os do acordo,
// e sim o FLUXO DOS MARCADOS (lp_carteira.no_fluxo=true) + os que surgirem;
// só entra quem pagou até dia 20 (senão rola pro mês seguinte). Por isso a
// seleção do mês e a projeção seguem no_fluxo, não a flag `acordo`.
//
// Inputs (env, vindos do workflow_dispatch):
//   RECEBIDOS  = competências a marcar recebido, ex.: "2026-04" (P3)
//   FECHADO    = competência do mês a revisar/projetar, ex.: "2026-06"
//   HOJE       = data ISO p/ recebido_em, ex.: "2026-07-07"
//   PROX       = vencimento da previsão recorrente, ex.: "2026-08-20"
//   RUN_P2 / RUN_P4 = "1" liga a etapa (default liga)
//   DRY        = "1" só lê e loga o plano, não grava
//
// LOGS: repo público ⇒ logs públicos ⇒ só CONTAGENS/AGREGADOS, nunca
// nomes de clientes nem números de apólice.
// =====================================================================

const URL = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_KEY;
const RECEBIDOS = (process.env.RECEBIDOS || '').split(',').map(s => s.trim()).filter(Boolean);
const FECHADO = (process.env.FECHADO || '').trim();
const HOJE = (process.env.HOJE || '').trim();
const PROX = (process.env.PROX || '').trim();
const RUN_P2 = (process.env.RUN_P2 ?? '1') === '1';
const RUN_P4 = (process.env.RUN_P4 ?? '1') === '1';
const DRY = (process.env.DRY || '') === '1';
const DESC_PREV = 'Previsão comissão LP (acordo)'; // mesmo texto do app (lpPrevRecorrente) p/ idempotência

if (!URL || !KEY) { console.error('Faltam SUPABASE_URL/SUPABASE_SERVICE_KEY.'); process.exit(1); }

const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
async function req(method, path, body, prefer) {
  const r = await fetch(URL + path, { method, headers: { ...H, ...(prefer ? { Prefer: prefer } : {}) }, body: body ? JSON.stringify(body) : null });
  const txt = await r.text();
  if (!r.ok) throw new Error(`${method} ${path.split('?')[0]} → ${r.status} ${txt.slice(0, 200)}`);
  return txt ? JSON.parse(txt) : null;
}
const brl = n => 'R$ ' + Number(n || 0).toFixed(2);
const r2 = n => Math.round(Number(n || 0) * 100) / 100;

async function main() {
  console.log(`== lp-fix ${DRY ? '(DRY-RUN)' : '(APLICANDO)'} == HOJE=${HOJE} PROX=${PROX} FECHADO=${FECHADO}`);

  // tabelas existem?
  try { await req('GET', '/rest/v1/lp_carteira?select=apolice&limit=1'); }
  catch (e) { console.error('Tabelas lp_* não existem. Rode os SQLs no SQL Editor primeiro.'); throw e; }

  // ---- carregar carteira (flags) e meses ----
  const cart = await req('GET', '/rest/v1/lp_carteira?select=apolice,no_fluxo,acordo&limit=10000');
  const fluxoSet = new Set(cart.filter(c => c.no_fluxo).map(c => String(c.apolice)));
  const acordoSet = new Set(cart.filter(c => c.acordo).map(c => String(c.apolice)));
  console.log(`carteira: ${cart.length} apólices | fluxo(no_fluxo)=${fluxoSet.size} | acordo=${acordoSet.size}`);

  const meses = await req('GET', '/rest/v1/lp_comissao_meses?select=competencia,mes_label,base,liquido,status,recebido_em,previsto_id,pct_div,pct_imp&order=competencia');
  const byComp = new Map(meses.map(m => [m.competencia, m]));
  const fator = m => (Number(m?.pct_div ?? 50) / 100) * (1 - Number(m?.pct_imp ?? 6) / 100);

  // ===================== P3: marcar recebido =====================
  for (const comp of RECEBIDOS) {
    const m = byComp.get(comp);
    if (!m) { console.log(`P3 ${comp}: mês não existe — pulado`); continue; }
    if (m.status === 'recebido') { console.log(`P3 ${comp}: já estava recebido — ok`); continue; }
    console.log(`P3 ${comp} (${m.mes_label}): ${brl(m.liquido)} aberto → RECEBIDO em ${HOJE}${m.previsto_id ? ' (+ previsto)' : ''}`);
    if (!DRY) {
      await req('PATCH', `/rest/v1/lp_comissao_meses?competencia=eq.${comp}`, { status: 'recebido', recebido_em: HOJE }, 'return=minimal');
      if (m.previsto_id) await req('PATCH', `/rest/v1/previstos?id=eq.${m.previsto_id}`, { status: 'recebido' }, 'return=minimal');
    }
    m.status = 'recebido';
  }

  // ===================== P2: revisar seleção do mês fechado =====================
  // Seleção correta = itens cujo apólice está no FLUXO DOS MARCADOS (no_fluxo).
  let fycMap = new Map(); // apolice -> comissao (base FYC do mês fechado, p/ P4)
  if (FECHADO) {
    const m = byComp.get(FECHADO);
    if (!m) { console.log(`P2 ${FECHADO}: mês não existe — pulado`); }
    else {
      const itens = await req('GET', `/rest/v1/lp_comissao_itens?select=id,apolice,comissao,selecionado&competencia=eq.${FECHADO}&limit=10000`);
      itens.forEach(it => fycMap.set(String(it.apolice), Number(it.comissao || 0)));
      const alvo = it => fluxoSet.has(String(it.apolice));
      const mudar = itens.filter(it => !!it.selecionado !== alvo(it));
      const selAntes = itens.filter(it => it.selecionado).length;
      const selDepois = itens.filter(alvo).length;
      const baseDepois = r2(itens.filter(alvo).reduce((s, it) => s + Number(it.comissao || 0), 0));
      const liqDepois = r2(baseDepois * fator(m));
      console.log(`P2 ${FECHADO} (${m.mes_label}): itens=${itens.length} | selecionados ${selAntes} → ${selDepois} (${mudar.length} alterados)`);
      console.log(`P2 ${FECHADO}: base ${brl(m.base)} → ${brl(baseDepois)} | líquido ${brl(m.liquido)} → ${brl(liqDepois)}`);
      if (RUN_P2 && !DRY) {
        for (const it of mudar) await req('PATCH', `/rest/v1/lp_comissao_itens?id=eq.${it.id}`, { selecionado: alvo(it) }, 'return=minimal');
        if (r2(m.base) !== baseDepois || r2(m.liquido) !== liqDepois) {
          await req('PATCH', `/rest/v1/lp_comissao_meses?competencia=eq.${FECHADO}`, { base: baseDepois, liquido: liqDepois }, 'return=minimal');
          if (m.previsto_id) await req('PATCH', `/rest/v1/previstos?id=eq.${m.previsto_id}`, { valor: liqDepois }, 'return=minimal');
        }
        m.base = baseDepois; m.liquido = liqDepois;
      } else if (!RUN_P2) console.log('P2: desligado (RUN_P2!=1)');
    }
  }

  // ===================== P4: previsão recorrente (base = MARCADOS) =====================
  if (RUN_P4) {
    if (!fycMap.size) console.log('P4: sem itens do mês fechado p/ base FYC — pulado');
    else {
      const somaFluxo = [...fluxoSet].reduce((s, ap) => s + (fycMap.get(ap) || 0), 0);
      const somaAcordo = [...acordoSet].reduce((s, ap) => s + (fycMap.get(ap) || 0), 0);
      const f = fator(byComp.get(FECHADO));
      const prev = r2(somaFluxo * f);
      const prevAcordo = r2(somaAcordo * f); // só p/ comparação/log
      console.log(`P4: previsão (MARCADOS/fluxo) = ${brl(prev)}/mês | venc ${PROX} | (base acordo=53 daria ${brl(prevAcordo)})`);
      if (prev > 0 && !DRY) {
        const ex = await req('GET', `/rest/v1/previstos?select=id&tipo=eq.receber&visao=eq.PIPEX&descricao=eq.${encodeURIComponent(DESC_PREV)}&limit=1`);
        if (ex && ex.length) {
          await req('PATCH', `/rest/v1/previstos?id=eq.${ex[0].id}`, { valor: prev, vencimento: PROX }, 'return=minimal');
          console.log(`P4: previsto existente atualizado (id preservado)`);
        } else {
          await req('POST', '/rest/v1/previstos', { descricao: DESC_PREV, valor: prev, vencimento: PROX, tipo: 'receber', status: 'aberto', visao: 'PIPEX', recorrencia: 'mensal' }, 'return=minimal');
          console.log(`P4: previsto recorrente criado`);
        }
      } else if (!(prev > 0)) console.log('P4: previsão zerada — nada lançado');
    }
  }

  console.log(DRY ? 'OK — DRY-RUN (nada gravado).' : 'OK — ajustes aplicados.');
}
main().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
