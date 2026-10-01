// Teste ponta a ponta LOCAL: cliente MCP -> Edge Function (deno) -> PostgREST -> Postgres local.
// Pressupoe o banco cf_teste com a semente ficticia de e2e-seed.sql e os servicos no ar
// (ver README.md desta pasta). Uso: node scripts/mcp-escrita/tests/e2e-local.mjs
const URL_EDGE = process.env.EDGE_URL || "http://127.0.0.1:8000";
const DONO = process.env.TOK_DONO || "tok-dono";
const ESCREVE = process.env.TOK_ESCREVE || "tok-escreve";

let id = 0;
async function call(tok, name, args) {
  const r = await fetch(URL_EDGE + "/t/" + tok, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method: "tools/call", params: { name, arguments: args } }),
  });
  const j = await r.json();
  return { err: !!j.result?.isError, text: j.result?.content?.[0]?.text ?? JSON.stringify(j) };
}
async function list() {
  const r = await fetch(URL_EDGE, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method: "tools/list" }) });
  return (await r.json()).result.tools.map((t) => t.name);
}

let falhas = 0;
function ok(cond, nome, extra = "") {
  console.log((cond ? "PASS " : "FAIL ") + nome + (cond ? "" : "  <- " + extra));
  if (!cond) falhas++;
}

const tools = await list();
for (const t of ["editar_previsto", "cancelar_previsto", "lancar_conta_a_receber"]) ok(tools.includes(t), "tools/list tem " + t);

let r = await call(DONO, "editar_previsto", { previsto_id: "00000000-0000-4000-8000-000000000001", campos: { vencimento: "2026-10-30", observacao: "escola adiou" } });
ok(!r.err && /vencimento: 2026-09-30 -> 2026-10-30/.test(r.text), "editar_previsto pelo conector", r.text);

r = await call(ESCREVE, "editar_previsto", { previsto_id: "00000000-0000-4000-8000-000000000003", campos: { valor: 1 } });
ok(r.err && /sem permissao de escrita na visao PJ/.test(r.text), "token sem escrita em PJ -> erro claro", r.text);

r = await call(DONO, "editar_previsto", { previsto_id: "00000000-0000-4000-8000-000000000003", campos: { status: "pago" } });
ok(r.err && /so via dar_baixa/.test(r.text), "status pago via editar -> recusado", r.text);

r = await call(DONO, "editar_previsto", { previsto_id: "nao-e-uuid", campos: { valor: 1 } });
ok(r.err && /previsto_id invalido/.test(r.text), "uuid invalido -> mensagem limpa", r.text);

r = await call(ESCREVE, "cancelar_previsto", { previsto_id: "00000000-0000-4000-8000-000000000005", motivo: "lancado em dobro" });
ok(!r.err && /cancelado/.test(r.text), "cancelar_previsto pelo conector", r.text);

r = await call(ESCREVE, "lancar_conta_a_receber", { descricao: "Zz Reembolso", valor: 120.5, vencimento: "2026-10-15", visao: "FAMILIA", categoria: "Zz Receita", conta: "Zz Conta Teste" });
ok(!r.err && /Conta a receber criada em FAMILIA/.test(r.text), "lancar_conta_a_receber pelo conector", r.text);

r = await call(ESCREVE, "lancar_conta_a_receber", { descricao: "Zz X", valor: 10, vencimento: "2026-10-15", visao: "PJ" });
ok(r.err && /so LE a visao PJ/.test(r.text), "receber sem escrita -> barrado ja na Edge", r.text);

// ---- T2
for (const t of ["adiar_ocorrencia", "pular_ocorrencia"]) ok(tools.includes(t), "tools/list tem " + t);
r = await call(DONO, "dar_baixa", { previsto_id: "00000000-0000-4000-8000-000000000011", valor_real: 1636.91, movimento_id: "00000000-0000-4000-8000-0000000000e1" });
ok(!r.err && /R\$ 1\.636,91 marcada como pago/.test(r.text) && /Proxima ocorrencia \(mensal\) criada pra 2026-10-10/.test(r.text), "dar_baixa recorrente pelo conector", r.text);
const proxId = (r.text.match(/\[id ([0-9a-f-]{36})\]\.$/) || [])[1];
r = await call(ESCREVE, "adiar_ocorrencia", { previsto_id: proxId, nova_data: "2026-10-30", motivo: "boleto atrasou" });
ok(!r.err && /segue em 2026-11-10/.test(r.text), "adiar_ocorrencia pelo conector", r.text);
r = await call(DONO, "pular_ocorrencia", { previsto_id: "00000000-0000-4000-8000-000000000013" });
ok(!r.err && /proxima em 2026-11-05/.test(r.text), "pular_ocorrencia pelo conector", r.text);
r = await call(DONO, "dar_baixa", { descricao: "Zz Escola", visao: "FAMILIA" });
ok(!r.err && /Zz Escola teste/.test(r.text) && /Proxima ocorrencia/.test(r.text), "dar_baixa por descricao (busca na Edge, regra na RPC)", r.text);

// regressao: tools antigas seguem respondendo
r = await call(DONO, "listar_contas_a_pagar", { visao: "FAMILIA", mes: "2026-10" });
ok(!r.err && /Zz Formatura teste/.test(r.text), "regressao listar_contas_a_pagar", r.text);
r = await call(DONO, "lancar_conta_a_pagar", { descricao: "Zz Pagar regressao", valor: 10, vencimento: "2026-10-20", visao: "FAMILIA" });
ok(!r.err && /Conta a pagar criada/.test(r.text), "regressao lancar_conta_a_pagar", r.text);

const itens = [{ data: "2026-10-01", descricao: "Zz Mercado", valor: 50, sinal: -1 }, { data: "2026-10-01", descricao: "Zz Mercado", valor: 50, sinal: -1 }];
r = await call(DONO, "importar_movimentos", { conta: "Zz Conta Teste", visao: "FAMILIA", fonte: "zz_e2e", itens });
ok(!r.err && /inseridos: 2/.test(r.text), "regressao importar_movimentos", r.text);
r = await call(DONO, "importar_movimentos", { conta: "Zz Conta Teste", visao: "FAMILIA", fonte: "zz_e2e", itens });
ok(!r.err && /inseridos: 0/.test(r.text) && /ignorados\): 2/.test(r.text), "regressao importar_movimentos dedup por hash", r.text);

console.log(falhas ? "\n" + falhas + " FALHA(S)" : "\nTUDO VERDE");
process.exit(falhas ? 1 : 0);
