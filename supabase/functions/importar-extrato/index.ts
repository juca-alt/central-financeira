// =====================================================================
// Edge Function: importar-extrato
// Recebe { file_base64, mime_type } de uma FOTO / PRINT / PDF de extrato
// ou fatura e devolve { transactions: [{date, description, amount, sign}] }
// extraidas via Gemini 2.5-flash (visao).
//
// Fonte em ASCII puro de proposito: o caminho de colagem no dashboard
// corrompe UTF-8 (acento vira mojibake). O cliente reconverte "Saida" em
// "Saida"/"Saida" -> "Saida" do app. A chave do Gemini fica no servidor.
//
// Deploy: Supabase Dashboard -> Edge Functions -> cole isto -> Deploy.
// Secret necessario: GEMINI_API_KEY (reusar a mesma chave do CRM).
// =====================================================================

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// O secret pode ter sido salvo com nomes diferentes (gotcha do CRM:
// "Gemini API Key" com espacos). Tenta as variacoes conhecidas.
function geminiKey(): string {
  const e = Deno.env.toObject();
  return (e["GEMINI_API_KEY"] || e["Gemini API Key"] || e["GEMINI_KEY"] || e["GOOGLE_API_KEY"] || "").trim();
}

const PROMPT = [
  "Voce e um extrator de extratos bancarios e faturas de cartao brasileiros.",
  "Extraia TODAS as transacoes da imagem ou PDF. Para cada transacao devolva:",
  "- date: formato YYYY-MM-DD. Use o ano do documento; se a linha nao trouxer o ano, infira pelo contexto.",
  "- description: o historico / estabelecimento, limpo e legivel.",
  "- amount: o valor ABSOLUTO, numero positivo (sem cifrao, sem sinal).",
  "- sign: 'Entrada' para credito / recebimento / deposito / Pix recebido; 'Saida' para debito / pagamento / compra / Pix enviado / tarifa.",
  "Linhas de SALDO, subtotais, totais, cabecalhos e rodapes NAO sao transacoes - nao as inclua na lista de transacoes.",
  "Alem das transacoes, devolva saldo_final: o SALDO FINAL / saldo da conta ao FIM do periodo do extrato",
  "(numero, pode ser negativo; ignore 'saldo anterior'/'saldo inicial', queremos o do FIM). Se o documento nao",
  "mostrar um saldo final claro, devolva saldo_final null.",
  "Se nao houver nenhuma transacao, devolva uma lista vazia.",
].join("\n");

const schema = {
  type: "object",
  properties: {
    transactions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          date: { type: "string" },
          description: { type: "string" },
          amount: { type: "number" },
          sign: { type: "string", enum: ["Entrada", "Saida"] },
        },
        required: ["date", "description", "amount", "sign"],
      },
    },
    saldo_final: { type: "number", nullable: true },
  },
  required: ["transactions"],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const key = geminiKey();
    if (!key) return json({ error: "GEMINI_API_KEY nao configurada na funcao" }, 500);

    const { file_base64, mime_type } = await req.json();
    if (!file_base64) return json({ error: "file_base64 ausente" }, 400);

    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + key;

    const payload = {
      contents: [{
        parts: [
          { inline_data: { mime_type: mime_type || "image/jpeg", data: file_base64 } },
          { text: PROMPT },
        ],
      }],
      generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0 },
    };

    // Gemini as vezes responde 503/429 (sobrecarga transitoria). Tenta de novo
    // com backoff curto (1s, 2s, 4s) antes de desistir, pra nao quebrar na cara
    // do usuario por um pico momentaneo de demanda do modelo.
    const RETRY = [429, 500, 502, 503, 504];
    let r: Response | undefined;
    for (let i = 0; i < 4; i++) {
      r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (r.ok || !RETRY.includes(r.status)) break;
      if (i < 3) await new Promise((res) => setTimeout(res, 1000 * Math.pow(2, i)));
    }

    if (!r || !r.ok) {
      const t = r ? await r.text() : "sem resposta do modelo";
      return json({ error: "Gemini falhou", detail: t.slice(0, 500), status: r?.status || 0 }, 502);
    }
    const data = await r.json();
    const txt = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(txt); } catch { parsed = {}; }
    const rawList = Array.isArray((parsed as { transactions?: unknown }).transactions)
      ? (parsed as { transactions: Record<string, unknown>[] }).transactions
      : [];

    const out = rawList
      .map((t) => ({
        date: String(t.date || "").slice(0, 10),
        description: String(t.description || "").trim(),
        amount: Math.abs(Number(t.amount) || 0),
        sign: t.sign === "Entrada" ? "Entrada" : "Saida",
      }))
      .filter((t) => t.date && t.amount > 0);

    const sfRaw = (parsed as { saldo_final?: unknown }).saldo_final;
    const saldo_final = (typeof sfRaw === "number" && isFinite(sfRaw)) ? sfRaw : null;

    return json({ transactions: out, saldo_final });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
