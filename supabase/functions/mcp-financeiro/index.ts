// =====================================================================
// Edge Function: mcp-financeiro
// Conector MCP CURADO de ESCRITA da Central Financeira.
// Expoe so 4 acoes seguras (lancar conta a pagar, dar baixa, categorizar
// movimento, listar contas a pagar) - nao abre o banco inteiro.
//
// Transporte: MCP Streamable HTTP (stateless). Responde POST JSON-RPC com
// application/json. Notificacoes -> 202. GET/DELETE -> 405.
//
// Auth propria (NAO usa o JWT do Supabase): token secreto MCP_TOKEN,
// aceito via ?k=<token> na URL OU header Authorization: Bearer <token>.
//   -> claude.ai (conector por URL): use  .../mcp-financeiro?k=<token>
//   -> Claude Code (aceita header):  Authorization: Bearer <token>
//
// Fonte em ASCII puro de proposito (colar no dashboard corrompe UTF-8).
// Deploy: Dashboard -> Edge Functions -> mcp-financeiro -> cole -> Deploy,
//         com "Verify JWT" DESLIGADO (a auth e feita aqui pelo MCP_TOKEN).
// Secrets: MCP_TOKEN = um segredo forte que voce escolhe.
//          SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY vem do runtime.
// =====================================================================

const SUPABASE_URL = (Deno.env.toObject()["SUPABASE_URL"] || "").trim();
const SRK = (Deno.env.toObject()["SUPABASE_SERVICE_ROLE_KEY"] || "").trim();
const MCP_TOKEN = (Deno.env.toObject()["MCP_TOKEN"] || "").trim();

const VISOES = ["PJ", "PIPEX", "RC", "FAMILIA", "JUCA"];
const RECORR = ["mensal", "semanal", "quinzenal", "bimestral", "trimestral", "semestral", "anual"];
const SERVER = { name: "central-financeira", version: "1.1.0" };

const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, mcp-session-id, mcp-protocol-version",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

// ---- PostgREST com service role (a curadoria e o conjunto de acoes) -----
async function rest(path: string, init: RequestInit = {}): Promise<any> {
  const r = await fetch(SUPABASE_URL + "/rest/v1/" + path, {
    ...init,
    headers: {
      apikey: SRK,
      Authorization: "Bearer " + SRK,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const txt = await r.text();
  let data: any = null;
  try { data = txt ? JSON.parse(txt) : null; } catch (_) { data = txt; }
  if (!r.ok) throw new Error("db " + r.status + ": " + String(txt).slice(0, 300));
  return data;
}

// tira curingas do termo cru e SO DEPOIS url-encoda (espaco->%20, acento->%XX),
// pra PostgREST reconstruir "*termo com espaco*" certinho no ilike.
const ilike = (term: string) => "*" + encodeURIComponent(String(term).replace(/[%*]/g, "")) + "*";

// acha 1 registro por nome dentro da visao (ou AMBOS); exato tem prioridade
async function resolveNome(tabela: string, nome: string, visao: string): Promise<any> {
  if (!nome) return null;
  const rows: any[] = await rest(
    tabela + "?select=id,nome,visao&nome=ilike." + ilike(nome) +
    "&visao=in.(" + encodeURIComponent(visao) + ",AMBOS)&limit=10",
  );
  if (!rows || !rows.length) return null;
  const exato = rows.find((r) => String(r.nome).toLowerCase() === String(nome).toLowerCase());
  return exato || rows[0];
}

function isDate(s: string): boolean { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "")); }

// ======================= as 4 acoes curadas =========================
async function lancar_conta_a_pagar(a: any): Promise<string> {
  const desc = String(a.descricao || "").trim();
  const valor = Number(a.valor);
  const venc = String(a.vencimento || "").slice(0, 10);
  const visao = String(a.visao || "").toUpperCase();
  if (!desc) throw new Error("descricao obrigatoria");
  if (!(valor > 0)) throw new Error("valor deve ser > 0");
  if (!isDate(venc)) throw new Error("vencimento deve ser YYYY-MM-DD");
  if (!VISOES.includes(visao)) throw new Error("visao invalida (use " + VISOES.join("/") + ")");
  let rec: string | null = a.recorrencia ? String(a.recorrencia).toLowerCase() : null;
  if (rec && !RECORR.includes(rec)) throw new Error("recorrencia invalida (use " + RECORR.join("/") + ")");

  const cat = a.categoria ? await resolveNome("categorias", String(a.categoria), visao) : null;
  const conta = a.conta ? await resolveNome("contas", String(a.conta), visao) : null;

  const row: any = {
    descricao: desc, valor: valor, vencimento: venc, tipo: "pagar", status: "aberto",
    visao: visao, recorrencia: rec,
    categoria_id: cat ? cat.id : null, conta_id: conta ? conta.id : null,
    observacao: a.observacao ? String(a.observacao) : null,
  };
  const ins = await rest("previstos", {
    method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(row),
  });
  const p = Array.isArray(ins) ? ins[0] : ins;
  const avisos = [];
  if (a.categoria && !cat) avisos.push("categoria '" + a.categoria + "' nao encontrada em " + visao + " (ficou sem categoria)");
  if (a.conta && !conta) avisos.push("conta '" + a.conta + "' nao encontrada em " + visao + " (ficou sem conta)");
  return "Conta a pagar criada em " + visao + ": \"" + desc + "\" R$ " + valor.toFixed(2) +
    " vencendo " + venc + (rec ? " (" + rec + ")" : "") +
    (cat ? " / cat: " + cat.nome : "") + (conta ? " / conta: " + conta.nome : "") +
    " [id " + p.id + "]" + (avisos.length ? "\nAVISO: " + avisos.join("; ") : "");
}

async function dar_baixa(a: any): Promise<string> {
  let prev: any = null;
  if (a.previsto_id) {
    const rows = await rest("previstos?select=id,descricao,valor,status,recorrencia,visao&id=eq." + encodeURIComponent(a.previsto_id));
    prev = rows && rows[0];
  } else if (a.descricao) {
    const visao = a.visao ? String(a.visao).toUpperCase() : null;
    let q = "previstos?select=id,descricao,valor,status,recorrencia,visao&tipo=eq.pagar&status=eq.aberto&descricao=ilike." + ilike(String(a.descricao));
    if (visao) q += "&visao=eq." + encodeURIComponent(visao);
    const rows: any[] = await rest(q + "&limit=6");
    if (!rows || !rows.length) throw new Error("nenhuma conta a pagar em aberto casa com '" + a.descricao + "'");
    if (rows.length > 1) {
      return "Achei " + rows.length + " candidatos - passe previsto_id de um deles:\n" +
        rows.map((r) => "- " + r.descricao + " R$ " + Number(r.valor).toFixed(2) + " [" + r.visao + "] id " + r.id).join("\n");
    }
    prev = rows[0];
  } else {
    throw new Error("informe previsto_id OU descricao");
  }
  if (!prev) throw new Error("previsto nao encontrado");
  if (String(prev.status).toLowerCase() === "pago") return "Essa conta ja esta como paga (id " + prev.id + ").";
  if (prev.recorrencia) {
    throw new Error("essa conta e recorrente (" + prev.recorrencia + "); dar baixa aqui mataria a serie. " +
      "Use o botao de dar baixa (check) no app (Contas do mes / Modo Financeiro), que cria a instancia paga e rola o template.");
  }
  await rest("previstos?id=eq." + encodeURIComponent(prev.id), {
    method: "PATCH", body: JSON.stringify({
      status: "pago",
      movimento_id_realizado: a.movimento_id ? String(a.movimento_id) : undefined,
    }),
  });
  if (a.movimento_id) {
    await rest("movimentos?id=eq." + encodeURIComponent(a.movimento_id), {
      method: "PATCH", body: JSON.stringify({ conciliado_previsto_id: prev.id }),
    });
  }
  return "Baixa dada: \"" + prev.descricao + "\" R$ " + Number(prev.valor).toFixed(2) +
    " marcada como paga" + (a.movimento_id ? " e conciliada ao movimento " + a.movimento_id : "") + " (id " + prev.id + ").";
}

async function categorizar_movimento(a: any): Promise<string> {
  const mid = String(a.movimento_id || "").trim();
  const nome = String(a.categoria || "").trim();
  if (!mid) throw new Error("movimento_id obrigatorio");
  if (!nome) throw new Error("categoria obrigatoria");
  const movs = await rest("movimentos?select=id,visao,descricao_original,valor&id=eq." + encodeURIComponent(mid));
  const mov = movs && movs[0];
  if (!mov) throw new Error("movimento nao encontrado");
  const cat = await resolveNome("categorias", nome, mov.visao);
  if (!cat) throw new Error("categoria '" + nome + "' nao encontrada na visao " + mov.visao);
  await rest("movimentos?id=eq." + encodeURIComponent(mid), {
    method: "PATCH", body: JSON.stringify({ categoria_id: cat.id }),
  });
  return "Movimento \"" + (mov.descricao_original || mid) + "\" categorizado como \"" + cat.nome + "\".";
}

async function listar_contas_a_pagar(a: any): Promise<string> {
  const lim = Math.min(200, Math.max(1, Number(a.limite) || 50));
  const status = a.status ? String(a.status).toLowerCase() : "aberto";
  let q = "previstos?select=id,descricao,valor,vencimento,status,visao,recorrencia&tipo=eq.pagar&status=eq." +
    encodeURIComponent(status) + "&order=vencimento.asc&limit=" + lim;
  if (a.visao) q += "&visao=eq." + encodeURIComponent(String(a.visao).toUpperCase());
  if (a.mes && /^\d{4}-\d{2}$/.test(a.mes)) {
    const y = +a.mes.slice(0, 4), m = +a.mes.slice(5, 7);
    const ny = m >= 12 ? y + 1 : y, nm = m >= 12 ? 1 : m + 1;
    const nextFirst = ny + "-" + String(nm).padStart(2, "0") + "-01";
    q += "&vencimento=gte." + a.mes + "-01&vencimento=lt." + nextFirst;
  }
  const rows: any[] = await rest(q);
  if (!rows || !rows.length) return "Nenhuma conta a pagar (" + status + ") com esse filtro.";
  const total = rows.reduce((s, r) => s + Number(r.valor || 0), 0);
  return rows.length + " conta(s), total R$ " + total.toFixed(2) + ":\n" +
    rows.map((r) => "- " + r.vencimento + "  " + r.descricao + "  R$ " + Number(r.valor).toFixed(2) +
      " [" + r.visao + (r.recorrencia ? "/" + r.recorrencia : "") + "] id " + r.id).join("\n");
}


// ---- hash determinstico: mesmo extrato reenviado nao duplica ---------
// djb2 sobre "fonte|conta|data|sinal|valor|descricao|ocorrencia".
// A "ocorrencia" separa lancamentos identicos no mesmo dia (ex.: dois Pix
// de R$ 150,00 do mesmo pagador em 27/08) - o 1o vira _0, o 2o _1.
function djb2(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, "0");
}
function hashMov(fonte: string, conta: string, it: any, ocorrencia: number): string {
  const base = [fonte, conta, it.data, String(it.sinal), Number(it.valor).toFixed(2),
    String(it.descricao || "").slice(0, 60), String(ocorrencia)].join("|");
  return "h" + djb2(base) + djb2(base.split("").reverse().join(""));
}

async function importar_movimentos(a: any): Promise<string> {
  const visao = String(a.visao || "").toUpperCase();
  const nomeConta = String(a.conta || "").trim();
  const fonte = String(a.fonte || "").trim() || ("mcp_" + new Date().toISOString().slice(0, 10).replace(/-/g, ""));
  const itens: any[] = Array.isArray(a.itens) ? a.itens : [];
  if (!VISOES.includes(visao)) throw new Error("visao invalida (use " + VISOES.join("/") + ")");
  if (!nomeConta) throw new Error("conta obrigatoria");
  if (!itens.length) throw new Error("itens vazio");
  if (itens.length > 400) throw new Error("maximo 400 itens por chamada (mande em lotes)");

  const conta = await resolveNome("contas", nomeConta, visao);
  if (!conta) throw new Error("conta '" + nomeConta + "' nao encontrada na visao " + visao);

  // resolve cada nome de categoria uma unica vez
  const nomesCat = Array.from(new Set(itens.map((i) => String(i.categoria || "").trim()).filter(Boolean)));
  const mapaCat: Record<string, any> = {};
  for (const n of nomesCat) mapaCat[n] = await resolveNome("categorias", n, visao);

  const vistos: Record<string, number> = {};
  const rows: any[] = [];
  const problemas: string[] = [];

  for (let i = 0; i < itens.length; i++) {
    const it = itens[i];
    const data = String(it.data || "").slice(0, 10);
    const valor = Math.abs(Number(it.valor));
    const sinal = Number(it.sinal) >= 0 ? 1 : -1;
    const desc = String(it.descricao || "").trim();
    if (!isDate(data)) { problemas.push("item " + (i + 1) + ": data invalida '" + data + "'"); continue; }
    if (!(valor > 0)) { problemas.push("item " + (i + 1) + ": valor deve ser > 0"); continue; }
    if (!desc) { problemas.push("item " + (i + 1) + ": descricao vazia"); continue; }

    const chave = data + "|" + sinal + "|" + valor.toFixed(2) + "|" + desc.slice(0, 60);
    const oc = (vistos[chave] = (vistos[chave] || 0) + 1) - 1;
    const catNome = String(it.categoria || "").trim();
    const cat = catNome ? mapaCat[catNome] : null;
    if (catNome && !cat) problemas.push("item " + (i + 1) + ": categoria '" + catNome + "' nao existe em " + visao);

    rows.push({
      conta_id: conta.id, data: data, descricao_original: desc,
      valor: valor, sinal: sinal, visao: visao,
      categoria_id: cat ? cat.id : null,
      hash: String(it.hash || "").trim() || hashMov(fonte, conta.id, { data, sinal, valor, descricao: desc }, oc),
      fonte: fonte,
      observacao: it.observacao ? String(it.observacao) : null,
    });
  }
  if (!rows.length) throw new Error("nenhum item valido. " + problemas.join("; "));

  // upsert que IGNORA quem ja existe (indice unico movimentos_hash_key).
  // return=representation traz so o que entrou de fato -> da pra contar.
  const inseridos: any[] = await rest("movimentos?on_conflict=hash", {
    method: "POST",
    headers: { Prefer: "return=representation,resolution=ignore-duplicates" },
    body: JSON.stringify(rows),
  });
  const nIns = Array.isArray(inseridos) ? inseridos.length : 0;
  const nDup = rows.length - nIns;
  const liquido = rows.reduce((s, r) => s + r.valor * r.sinal, 0);

  return "Importacao em " + visao + " / " + conta.nome + " (fonte: " + fonte + ")\n" +
    "- recebidos: " + itens.length + "\n" +
    "- inseridos: " + nIns + "\n" +
    "- ja existiam (ignorados): " + nDup + "\n" +
    "- liquido do lote: R$ " + liquido.toFixed(2) + "\n" +
    (problemas.length ? "AVISOS:\n" + problemas.map((p) => "- " + p).join("\n") : "Sem avisos.");
}

async function corrigir_data_movimento(a: any): Promise<string> {
  const mid = String(a.movimento_id || "").trim();
  const nova = String(a.data || "").slice(0, 10);
  if (!mid) throw new Error("movimento_id obrigatorio");
  if (!isDate(nova)) throw new Error("data deve ser YYYY-MM-DD");
  const movs = await rest("movimentos?select=id,data,descricao_original,valor&id=eq." + encodeURIComponent(mid));
  const mov = movs && movs[0];
  if (!mov) throw new Error("movimento nao encontrado");
  if (mov.data === nova) return "Movimento ja estava em " + nova + " (nada a fazer).";
  await rest("movimentos?id=eq." + encodeURIComponent(mid), {
    method: "PATCH", body: JSON.stringify({ data: nova }),
  });
  return "Data corrigida: \"" + (mov.descricao_original || mid) + "\" R$ " + Number(mov.valor).toFixed(2) +
    " de " + mov.data + " para " + nova + ".";
}

async function atualizar_saldo_conta(a: any): Promise<string> {
  const visao = String(a.visao || "").toUpperCase();
  const nomeConta = String(a.conta || "").trim();
  const saldo = Number(a.saldo);
  if (!VISOES.includes(visao)) throw new Error("visao invalida (use " + VISOES.join("/") + ")");
  if (!nomeConta) throw new Error("conta obrigatoria");
  if (!isFinite(saldo)) throw new Error("saldo deve ser numero");
  const conta = await resolveNome("contas", nomeConta, visao);
  if (!conta) throw new Error("conta '" + nomeConta + "' nao encontrada na visao " + visao);
  const quando = isDate(String(a.data_do_saldo || "")) ? String(a.data_do_saldo) + "T12:00:00Z" : new Date().toISOString();
  await rest("contas?id=eq." + encodeURIComponent(conta.id), {
    method: "PATCH", body: JSON.stringify({ saldo_atual: saldo, saldo_atualizado_em: quando }),
  });
  return "Saldo de " + conta.nome + " (" + visao + ") atualizado para R$ " + saldo.toFixed(2) +
    " em " + quando.slice(0, 10) + ".";
}

// ------------------------- catalogo MCP ------------------------------
const S = (t: string) => ({ type: t });
const TOOLS = [
  {
    name: "lancar_conta_a_pagar",
    description: "Lanca uma conta a pagar (previsto) na visao indicada. Resolve categoria e conta por nome.",
    inputSchema: {
      type: "object",
      properties: {
        descricao: S("string"), valor: S("number"),
        vencimento: { type: "string", description: "YYYY-MM-DD" },
        visao: { type: "string", enum: VISOES },
        categoria: S("string"), conta: S("string"),
        recorrencia: { type: "string", enum: RECORR }, observacao: S("string"),
      },
      required: ["descricao", "valor", "vencimento", "visao"],
    },
  },
  {
    name: "dar_baixa",
    description: "Marca uma conta a pagar como paga (e opcionalmente concilia a um movimento). Recorrentes sao recusadas (use o app).",
    inputSchema: {
      type: "object",
      properties: {
        previsto_id: S("string"), descricao: S("string"),
        visao: { type: "string", enum: VISOES }, movimento_id: S("string"),
      },
    },
  },
  {
    name: "categorizar_movimento",
    description: "Define a categoria (por nome) de um movimento existente.",
    inputSchema: {
      type: "object",
      properties: { movimento_id: S("string"), categoria: S("string") },
      required: ["movimento_id", "categoria"],
    },
  },
  {
    name: "listar_contas_a_pagar",
    description: "Lista contas a pagar (para achar ids antes de dar baixa). Filtra por visao, mes (YYYY-MM) e status.",
    inputSchema: {
      type: "object",
      properties: {
        visao: { type: "string", enum: VISOES }, mes: S("string"),
        status: S("string"), limite: S("number"),
      },
    },
  },
  {
    name: "importar_movimentos",
    description: "Importa um lote de movimentos de extrato numa conta. Deduplica por hash: reenviar o mesmo extrato nao duplica. Devolve quantos entraram e quantos ja existiam.",
    inputSchema: {
      type: "object",
      properties: {
        conta: { type: "string", description: "nome da conta (ex: Inter PF, Pru Wallet)" },
        visao: { type: "string", enum: VISOES },
        fonte: { type: "string", description: "rotulo da origem, ex: extrato_interpf_20260829" },
        itens: {
          type: "array",
          description: "ate 400 lancamentos",
          items: {
            type: "object",
            properties: {
              data: { type: "string", description: "YYYY-MM-DD" },
              descricao: S("string"),
              valor: { type: "number", description: "valor absoluto, positivo" },
              sinal: { type: "number", description: "1 = entrada, -1 = saida" },
              categoria: { type: "string", description: "nome da categoria (opcional)" },
              observacao: S("string"),
              hash: { type: "string", description: "opcional; se omitido e calculado do conteudo" },
            },
            required: ["data", "descricao", "valor", "sinal"],
          },
        },
      },
      required: ["conta", "visao", "itens"],
    },
  },
  {
    name: "corrigir_data_movimento",
    description: "Corrige a data de um movimento ja gravado (ex: lancamento que entrou com D+1 em relacao ao extrato).",
    inputSchema: {
      type: "object",
      properties: { movimento_id: S("string"), data: { type: "string", description: "YYYY-MM-DD" } },
      required: ["movimento_id", "data"],
    },
  },
  {
    name: "atualizar_saldo_conta",
    description: "Grava o saldo conferido de uma conta (saldo_atual + data da leitura).",
    inputSchema: {
      type: "object",
      properties: {
        conta: S("string"), visao: { type: "string", enum: VISOES },
        saldo: { type: "number" },
        data_do_saldo: { type: "string", description: "YYYY-MM-DD (opcional, default hoje)" },
      },
      required: ["conta", "visao", "saldo"],
    },
  },
];

const HANDLERS: Record<string, (a: any) => Promise<string>> = {
  lancar_conta_a_pagar, dar_baixa, categorizar_movimento, listar_contas_a_pagar,
  importar_movimentos, corrigir_data_movimento, atualizar_saldo_conta,
};

// ------------------------- JSON-RPC MCP ------------------------------
// token aceito em 3 lugares: ?k= (query), header Bearer, OU segmento de
// path /t/<token> (o claude.ai descarta query string ao conectar MCP -
// o path sobrevive sempre).
function authOK(req: Request, url: URL): boolean {
  if (!MCP_TOKEN) return false;
  const q = url.searchParams.get("k") || "";
  const h = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const m = url.pathname.match(/\/t\/([^/]+)\/?$/);
  const p = m ? decodeURIComponent(m[1]) : "";
  return q === MCP_TOKEN || h === MCP_TOKEN || p === MCP_TOKEN;
}

// IMPORTANTE: nunca responder HTTP 401 no fluxo MCP - 401 faz o claude.ai
// cair no fluxo OAuth (que nao existe aqui) e falhar com "nao foi possivel
// registrar no servico de login". Handshake (initialize/tools/list/ping) e
// aberto e nao expoe dados; SO tools/call exige o token (erro em JSON-RPC).
async function handleRpc(msg: any, authed: boolean): Promise<any | null> {
  const { id, method, params } = msg || {};
  const ok = (result: any) => ({ jsonrpc: "2.0", id, result });
  const err = (code: number, message: string) => ({ jsonrpc: "2.0", id, error: { code, message } });

  if (method === "initialize") {
    const pv = (params && params.protocolVersion) || "2024-11-05";
    return ok({ protocolVersion: pv, capabilities: { tools: {} }, serverInfo: SERVER });
  }
  if (method === "notifications/initialized" || method === "notifications/cancelled") return null; // notif
  if (method === "ping") return ok({});
  if (method === "tools/list") return ok({ tools: TOOLS });
  if (method === "tools/call") {
    if (!authed) return ok({ content: [{ type: "text", text: "ERRO: token ausente ou invalido no conector (a URL deve terminar com /t/SEU_TOKEN)." }], isError: true });
    const name = params && params.name;
    const args = (params && params.arguments) || {};
    const fn = HANDLERS[name];
    if (!fn) return err(-32602, "ferramenta desconhecida: " + name);
    try {
      const text = await fn(args);
      return ok({ content: [{ type: "text", text }] });
    } catch (e) {
      return ok({ content: [{ type: "text", text: "ERRO: " + String((e as Error)?.message || e) }], isError: true });
    }
  }
  if (typeof id === "undefined") return null; // qualquer outra notificacao
  return err(-32601, "metodo nao suportado: " + method);
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

  if (req.method === "GET") {
    // health so com ?health=1; GET puro = 405 como manda o spec Streamable HTTP
    // (retornar 200 JSON no GET confundia o probe do claude.ai)
    if (url.searchParams.get("health") === "1") {
      return json({ ok: true, server: SERVER, transport: "streamable-http", auth: MCP_TOKEN ? "token" : "MCP_TOKEN ausente" });
    }
    return new Response(null, { status: 405, headers: { ...cors, Allow: "POST, OPTIONS" } });
  }
  if (req.method !== "POST") return new Response(null, { status: 405, headers: { ...cors, Allow: "POST, OPTIONS" } });

  const authed = authOK(req, url);

  let body: any;
  try { body = await req.json(); } catch (_) {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "JSON invalido" } }, 400);
  }

  // batch ou mensagem unica
  if (Array.isArray(body)) {
    const out = [];
    for (const m of body) { const r = await handleRpc(m, authed); if (r) out.push(r); }
    return out.length ? json(out) : new Response(null, { status: 202, headers: cors });
  }
  const r = await handleRpc(body, authed);
  return r ? json(r) : new Response(null, { status: 202, headers: cors });
});
