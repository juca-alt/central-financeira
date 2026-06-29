// =====================================================================
// Edge Function: pluggy-connect-token
// Cunha um Connect Token da Pluggy pro widget do navegador rodar SEM
// expor o clientSecret. O navegador chama esta funcao, recebe { accessToken }
// e abre o Pluggy Connect com ele.
//
// Fonte em ASCII puro de proposito: colar no editor do dashboard corrompe
// UTF-8 (acento vira mojibake). Sem acento aqui.
//
// Deploy: Supabase Dashboard -> Edge Functions -> cole isto -> Deploy.
// Secrets necessarios (Edge Functions -> Secrets):
//   PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET  (de dashboard.pluggy.ai)
// =====================================================================

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function env(name: string): string {
  return (Deno.env.toObject()[name] || "").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const clientId = env("PLUGGY_CLIENT_ID");
    const clientSecret = env("PLUGGY_CLIENT_SECRET");
    if (!clientId || !clientSecret)
      return json({ error: "PLUGGY_CLIENT_ID / PLUGGY_CLIENT_SECRET nao configurados na funcao" }, 500);

    // itemId opcional: se vier, o widget abre em modo de ATUALIZACAO/reconsentimento
    // daquele item (util quando o consentimento vencer la na frente).
    let itemId: string | undefined;
    try { itemId = (await req.json())?.itemId; } catch { /* corpo vazio = nova conexao */ }

    // 1) Autentica e pega a apiKey (TTL ~2h).
    const authResp = await fetch("https://api.pluggy.ai/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, clientSecret }),
    });
    if (!authResp.ok)
      return json({ error: "Pluggy auth falhou", detail: (await authResp.text()).slice(0, 400) }, 502);
    const apiKey = (await authResp.json())?.apiKey;
    if (!apiKey) return json({ error: "Pluggy auth nao retornou apiKey" }, 502);

    // 2) Cria o connect token pro widget.
    const body: Record<string, unknown> = { options: { clientUserId: "central-financeira" } };
    if (itemId) body.itemId = itemId;
    const ctResp = await fetch("https://api.pluggy.ai/connect_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-KEY": apiKey },
      body: JSON.stringify(body),
    });
    if (!ctResp.ok)
      return json({ error: "Pluggy connect_token falhou", detail: (await ctResp.text()).slice(0, 400) }, 502);
    const accessToken = (await ctResp.json())?.accessToken;
    if (!accessToken) return json({ error: "connect_token nao retornou accessToken" }, 502);

    return json({ accessToken });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
