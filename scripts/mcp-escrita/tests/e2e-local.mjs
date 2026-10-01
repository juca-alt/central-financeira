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

// regressao: tools antigas seguem respondendo
r = await call(DONO, "listar_contas_a_pagar", { visao: "FAMILIA", mes: "2026-10" });
ok(!r.err && /Zz Formatura teste/.test(r.text), "regressao listar_contas_a_pagar", r.text);
r = await call(DONO, "lancar_conta_a_pagar", { descricao: "Zz Pagar regressao", valor: 10, vencimento: "2026-10-20", visao: "FAMILIA" });
ok(!r.err && /Conta a pagar criada/.test(r.text), "regressao lancar_conta_a_pagar", r.text);

console.log(falhas ? "\n" + falhas + " FALHA(S)" : "\nTUDO VERDE");
process.exit(falhas ? 1 : 0);
