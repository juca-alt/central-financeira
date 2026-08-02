// =====================================================================
// Edge Function: sync-agora
// Botao "Atualizar bancos" do app: dispara a atualizacao ON-DEMAND de
// todas as contas conectadas, em 2 frentes:
//   1) Pluggy (Nubank/Inter PF/cartoes): PATCH /items/{id} pra pedir
//      refresh do item (se o plano permitir; senao fica o dado diario).
//   2) GitHub Actions: workflow_dispatch dos syncs ja existentes
//      (sync-pluggy.yml e sync-inter.yml, dry_run=false, janela 7d) —
//      sao eles que importam movimentos + saldos com dedup e guards.
//
// Fonte em ASCII puro de proposito (colar no dashboard corrompe UTF-8).
// Deploy: Supabase Dashboard -> Edge Functions -> cole isto -> Deploy.
// Secrets usados (Edge Functions -> Secrets):
//   PLUGGY_CLIENT_ID / PLUGGY_CLIENT_SECRET  (JA existem, do connect)
//   GH_PAT  = fine-grained token do GitHub, repo juca-alt/central-financeira,
//             permissao Actions: Read and write. SEM ele a parte 2 nao roda.
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY vem injetados pelo runtime.
// =====================================================================

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function env(name: string): string {
  return (Deno.env.toObject()[name] || "").trim();
}

const REPO = "juca-alt/central-financeira";
const WORKFLOWS: Array<{ file: string; inputs: Record<string, string> }> = [
  { file: "sync-pluggy.yml", inputs: { dry_run: "false", sync_days: "7" } },
  { file: "sync-inter.yml", inputs: { dry_run: "false", sync_days: "7" } },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  const out: Record<string, unknown> = { ok: true };

  // ---- 1) Pluggy: pedir refresh de cada item conhecido -----------------
  try {
    const cid = env("PLUGGY_CLIENT_ID"), csec = env("PLUGGY_CLIENT_SECRET");
    if (!cid || !csec) throw new Error("PLUGGY_CLIENT_ID/SECRET ausentes");
    const auth = await fetch("https://api.pluggy.ai/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: cid, clientSecret: csec }),
    });
    if (!auth.ok) throw new Error("Pluggy auth " + auth.status);
    const apiKey = (await auth.json())?.apiKey;

    const cx = await fetch(env("SUPABASE_URL") + "/rest/v1/pluggy_conexoes?select=item_id", {
      headers: { apikey: env("SUPABASE_SERVICE_ROLE_KEY"), Authorization: "Bearer " + env("SUPABASE_SERVICE_ROLE_KEY") },
    });
    const itens = [...new Set(((await cx.json()) as Array<{ item_id: string }>).map((r) => r.item_id))];

    const refresh: Record<string, string> = {};
    for (const id of itens) {
      const r = await fetch("https://api.pluggy.ai/items/" + id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-API-KEY": apiKey },
        body: "{}",
      });
      const j = await r.json().catch(() => null);
      refresh[id] = r.ok ? (j?.status || "ok") : "erro " + r.status + " (plano pode nao permitir; fica o dado diario)";
    }
    out.pluggy_refresh = refresh;
  } catch (e) {
    out.pluggy_refresh = "falhou: " + String((e as Error)?.message || e);
  }

  // ---- 2) GitHub Actions: disparar os syncs ----------------------------
  const pat = env("GH_PAT");
  if (!pat) {
    out.ok = false;
    out.github = "GH_PAT nao configurado nos secrets da funcao — os workflows nao foram disparados. " +
      "Criar fine-grained PAT (repo " + REPO + ", Actions: read+write) e salvar como GH_PAT.";
    return json(out, 200);
  }
  const gh: Record<string, string> = {};
  for (const wf of WORKFLOWS) {
    try {
      const r = await fetch("https://api.github.com/repos/" + REPO + "/actions/workflows/" + wf.file + "/dispatches", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + pat,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "central-financeira-sync-agora",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ref: "main", inputs: wf.inputs }),
      });
      gh[wf.file] = r.status === 204 ? "disparado" : "erro " + r.status + ": " + (await r.text()).slice(0, 200);
      if (r.status !== 204) out.ok = false;
    } catch (e) {
      gh[wf.file] = "falhou: " + String((e as Error)?.message || e);
      out.ok = false;
    }
  }
  out.github = gh;
  return json(out, 200);
});
