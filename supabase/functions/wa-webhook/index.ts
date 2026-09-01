// =====================================================================
// Edge Function: wa-webhook
// Assistente financeira da Central Financeira no WhatsApp (Frente 3).
//
// Fluxo: Meta Cloud API -> este webhook -> Claude (tool use) -> resposta.
// LEITURA a IA faz sozinha. ESCRITA NUNCA entra direto: a acao fica
// PENDENTE (tabela wa_pendencias), o bot manda o resumo pedindo "ok",
// e so grava depois do "ok" do Gustavo (guard do Livro de Erros #14).
//
// Deploy: Dashboard -> Edge Functions -> wa-webhook -> cole -> Deploy,
//         com "Verify JWT" DESLIGADO (a Meta nao manda JWT; a auth aqui
//         e assinatura HMAC + allowlist de telefone).
//
// Secrets:
//   WA_VERIFY_TOKEN  segredo que voce inventa e repete no painel da Meta
//   WA_APP_SECRET    "App secret" do app na Meta (assina o corpo)
//   WA_TOKEN         access token da Cloud API
//   WA_PHONE_ID      "Phone number ID" do numero remetente
//   WA_ALLOWED       telefones autorizados, separados por virgula (E.164
//                    sem +, ex.: 5581999999999). Quem nao estiver aqui e
//                    ignorado - sem isso, quem achar a URL mexe na grana.
//   ANTHROPIC_API_KEY chave da API da Anthropic
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY vem do runtime.
//
// Fonte em ASCII puro de proposito (colar no dashboard corrompe UTF-8).
// As respostas ao usuario sao geradas pelo modelo, entao saem acentuadas.
// =====================================================================

import Anthropic from "npm:@anthropic-ai/sdk@0.72.0";

const env = Deno.env.toObject();
const SUPABASE_URL = (env["SUPABASE_URL"] || "").trim();
const SRK = (env["SUPABASE_SERVICE_ROLE_KEY"] || "").trim();
const VERIFY_TOKEN = (env["WA_VERIFY_TOKEN"] || "").trim();
const APP_SECRET = (env["WA_APP_SECRET"] || "").trim();
const WA_TOKEN = (env["WA_TOKEN"] || "").trim();
const WA_PHONE_ID = (env["WA_PHONE_ID"] || "").trim();
const ALLOWED = (env["WA_ALLOWED"] || "").split(",").map((s) => s.replace(/\D/g, "")).filter(Boolean);

const MODEL = "claude-opus-5";
const VISOES = ["PJ", "PIPEX", "RC", "FAMILIA", "JUCA"];
const PENDENCIA_MIN = 15; // minutos de validade da confirmacao

const anthropic = new Anthropic({ apiKey: (env["ANTHROPIC_API_KEY"] || "").trim() });

// ---------------------------------------------------------------- utils
// "hoje" no fuso do Gustavo, nao no UTC do runtime (senao depois das 21h
// o bot lanca no dia seguinte).
function hojeISO(): string {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
  });
  return f.format(new Date());
}

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

const ilike = (t: string) => "*" + encodeURIComponent(String(t).replace(/[%*]/g, "")) + "*";

// ------------------------------------------------- assinatura da Meta
// A Meta assina o corpo CRU com o App Secret. Sem conferir isso, qualquer
// um que descubra a URL manda mensagem fingindo ser a Meta.
async function assinaturaOk(raw: string, header: string | null): Promise<boolean> {
  if (!APP_SECRET) return false;
  if (!header || !header.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(APP_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  const esperado = "sha256=" + hex;
  // comparacao de tempo constante
  if (esperado.length !== header.length) return false;
  let diff = 0;
  for (let i = 0; i < esperado.length; i++) diff |= esperado.charCodeAt(i) ^ header.charCodeAt(i);
  return diff === 0;
}

// ------------------------------------------------------ envio pro Whats
async function enviar(para: string, texto: string): Promise<void> {
  const r = await fetch("https://graph.facebook.com/v21.0/" + WA_PHONE_ID + "/messages", {
    method: "POST",
    headers: { Authorization: "Bearer " + WA_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: para,
      type: "text",
      text: { body: texto.slice(0, 4000) },
    }),
  });
  if (!r.ok) console.error("wa send " + r.status + " " + (await r.text()).slice(0, 300));
}

// -------------------------------------------------------- resolvedores
async function acharConta(nome: string, visao: string): Promise<any> {
  if (!nome) return null;
  const q = "contas?select=id,nome,tipo,visao&nome=ilike." + ilike(nome) +
    "&visao=in.(" + visao + ",AMBOS)&limit=5";
  const rows = await rest(q);
  if (!rows || !rows.length) return null;
  const exato = rows.find((r: any) => String(r.nome).toLowerCase() === nome.toLowerCase());
  return exato || rows[0];
}

async function acharCategoria(nome: string, visao: string): Promise<any> {
  if (!nome) return null;
  const q = "categorias?select=id,nome,visao&nome=ilike." + ilike(nome) +
    "&visao=in.(" + visao + ",AMBOS)&limit=5";
  const rows = await rest(q);
  if (!rows || !rows.length) return null;
  const exato = rows.find((r: any) => String(r.nome).toLowerCase() === nome.toLowerCase());
  return exato || rows[0];
}

// ------------------------------------------------------------- TOOLS
// Leitura: rodam na hora. Escrita: NAO rodam - viram pendencia.
const TOOLS_LEITURA: any[] = [
  {
    name: "consultar_movimentos",
    description: "Lista movimentos ja realizados num periodo. Use para 'quanto gastei', 'o que caiu', 'me mostra os lancamentos de X'.",
    input_schema: {
      type: "object",
      properties: {
        visao: { type: "string", enum: VISOES, description: "Visao. Omita para todas." },
        de: { type: "string", description: "Data inicial AAAA-MM-DD" },
        ate: { type: "string", description: "Data final AAAA-MM-DD" },
        texto: { type: "string", description: "Filtro por descricao (opcional)" },
        limite: { type: "integer", description: "Maximo de linhas, padrao 40" },
      },
      required: ["de", "ate"],
    },
  },
  {
    name: "resumo_periodo",
    description: "Totais de entradas, saidas e saldo do periodo, com quebra por categoria. Use para 'como foi agosto', 'resumo do mes', 'onde foi meu dinheiro'.",
    input_schema: {
      type: "object",
      properties: {
        visao: { type: "string", enum: VISOES },
        de: { type: "string", description: "AAAA-MM-DD" },
        ate: { type: "string", description: "AAAA-MM-DD" },
      },
      required: ["de", "ate"],
    },
  },
  {
    name: "listar_contas_a_pagar",
    description: "Contas em aberto (previstos tipo pagar), das vencidas ate N dias a frente. Use para 'o que vence essa semana', 'tem algo atrasado'.",
    input_schema: {
      type: "object",
      properties: {
        visao: { type: "string", enum: VISOES },
        dias: { type: "integer", description: "Janela a frente em dias, padrao 30" },
      },
      required: [],
    },
  },
  {
    name: "saldo_contas",
    description: "Saldo atual de cada conta. Use para 'quanto tenho', 'qual meu saldo'.",
    input_schema: {
      type: "object",
      properties: { visao: { type: "string", enum: VISOES } },
      required: [],
    },
  },
];

const TOOLS_ESCRITA: any[] = [
  {
    name: "lancar_movimento",
    description: "Registra um movimento JA acontecido (gasto ou recebimento). Precisa de confirmacao do usuario antes de gravar.",
    input_schema: {
      type: "object",
      properties: {
        visao: { type: "string", enum: VISOES },
        data: { type: "string", description: "AAAA-MM-DD. Se o usuario nao disser, use hoje." },
        descricao: { type: "string" },
        valor: { type: "number", description: "Valor absoluto, sempre positivo" },
        sentido: { type: "string", enum: ["Entrada", "Saida"] },
        conta: { type: "string", description: "Nome da conta/cartao" },
        categoria: { type: "string" },
      },
      required: ["visao", "data", "descricao", "valor", "sentido", "conta"],
    },
  },
  {
    name: "lancar_conta_a_pagar",
    description: "Cria uma conta a pagar futura (previsto). Precisa de confirmacao do usuario antes de gravar.",
    input_schema: {
      type: "object",
      properties: {
        visao: { type: "string", enum: VISOES },
        descricao: { type: "string" },
        valor: { type: "number" },
        vencimento: { type: "string", description: "AAAA-MM-DD" },
        recorrencia: { type: "string", description: "mensal, semanal, anual... vazio se for unica" },
        categoria: { type: "string" },
      },
      required: ["visao", "descricao", "valor", "vencimento"],
    },
  },
  {
    name: "categorizar_movimento",
    description: "Define a categoria de um movimento ja existente, achado por texto. Precisa de confirmacao do usuario antes de gravar.",
    input_schema: {
      type: "object",
      properties: {
        visao: { type: "string", enum: VISOES },
        busca: { type: "string", description: "Trecho da descricao do movimento" },
        categoria: { type: "string" },
      },
      required: ["visao", "busca", "categoria"],
    },
  },
];

const NOMES_ESCRITA = TOOLS_ESCRITA.map((t) => t.name);

// ------------------------------------------------- execucao de leitura
async function rodarLeitura(nome: string, arg: any): Promise<string> {
  const visaoF = arg.visao ? "&visao=eq." + arg.visao : "";

  if (nome === "consultar_movimentos") {
    const lim = Math.min(Number(arg.limite || 40), 100);
    let q = "movimentos?select=data,valor,sinal,visao,descricao_limpa,descricao_original," +
      "contas(nome),categorias(nome)&data=gte." + arg.de + "&data=lte." + arg.ate +
      visaoF + "&order=data.desc&limit=" + lim;
    if (arg.texto) q += "&or=(descricao_limpa.ilike." + ilike(arg.texto) +
      ",descricao_original.ilike." + ilike(arg.texto) + ")";
    const rows = await rest(q);
    return JSON.stringify((rows || []).map((r: any) => ({
      data: r.data,
      valor: Number(r.valor),
      sentido: r.sinal === 1 ? "Entrada" : "Saida",
      visao: r.visao,
      descricao: r.descricao_limpa || r.descricao_original,
      conta: r.contas?.nome || null,
      categoria: r.categorias?.nome || null,
    })));
  }

  if (nome === "resumo_periodo") {
    const rows = await rest("movimentos?select=valor,sinal,categorias(nome)&data=gte." +
      arg.de + "&data=lte." + arg.ate + visaoF + "&limit=20000");
    let ent = 0, sai = 0;
    const porCat: Record<string, number> = {};
    for (const r of rows || []) {
      const v = Number(r.valor);
      if (r.sinal === 1) ent += v;
      else {
        sai += v;
        const c = r.categorias?.nome || "sem categoria";
        porCat[c] = (porCat[c] || 0) + v;
      }
    }
    const top = Object.entries(porCat).sort((a, b) => b[1] - a[1]).slice(0, 15);
    return JSON.stringify({
      entradas: +ent.toFixed(2), saidas: +sai.toFixed(2), saldo: +(ent - sai).toFixed(2),
      saidas_por_categoria: top.map(([c, v]) => ({ categoria: c, valor: +v.toFixed(2) })),
      aviso: "Totais crus dos movimentos do periodo. Transferencia entre as contas do proprio Gustavo pode inflar entradas e saidas.",
    });
  }

  if (nome === "listar_contas_a_pagar") {
    const dias = Number(arg.dias || 30);
    const ate = new Date(hojeISO() + "T12:00:00Z");
    ate.setUTCDate(ate.getUTCDate() + dias);
    const rows = await rest("previstos?select=descricao,valor,vencimento,status,recorrencia,visao," +
      "categorias(nome)&tipo=eq.pagar&status=eq.aberto&vencimento=lte." +
      ate.toISOString().slice(0, 10) + visaoF + "&order=vencimento.asc&limit=200");
    const hoje = hojeISO();
    return JSON.stringify((rows || []).map((r: any) => ({
      descricao: r.descricao, valor: Number(r.valor), vencimento: r.vencimento,
      visao: r.visao, recorrencia: r.recorrencia || null,
      categoria: r.categorias?.nome || null,
      atrasada: r.vencimento < hoje,
    })));
  }

  if (nome === "saldo_contas") {
    const rows = await rest("contas?select=nome,tipo,visao,saldo_atual" + (arg.visao ?
      "&visao=in.(" + arg.visao + ",AMBOS)" : "") + "&order=nome.asc&limit=100");
    return JSON.stringify((rows || []).map((r: any) => ({
      conta: r.nome, tipo: r.tipo, visao: r.visao,
      saldo: r.saldo_atual == null ? null : Number(r.saldo_atual),
    })));
  }

  return JSON.stringify({ erro: "tool de leitura desconhecida: " + nome });
}

// ------------------------------------- execucao de escrita (pos "ok")
async function rodarEscrita(nome: string, arg: any): Promise<string> {
  if (nome === "lancar_movimento") {
    const conta = await acharConta(arg.conta, arg.visao);
    if (!conta) throw new Error("conta nao encontrada: " + arg.conta);
    const cat = arg.categoria ? await acharCategoria(arg.categoria, arg.visao) : null;
    const desc = String(arg.descricao);
    await rest("movimentos", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        data: arg.data,
        descricao_original: desc,
        descricao_limpa: desc,
        valor: Math.abs(Number(arg.valor)),
        sinal: arg.sentido === "Entrada" ? 1 : -1,
        conta_id: conta.id,
        categoria_id: cat ? cat.id : null,
        visao: arg.visao,
        fonte: "whatsapp",
        observacao: "via:whatsapp",
        hash: "wa:" + arg.data + ":" + Math.abs(Number(arg.valor)) + ":" + desc.slice(0, 40),
      }),
    });
    return "Lancado: " + desc + " em " + conta.nome + ".";
  }

  if (nome === "lancar_conta_a_pagar") {
    const cat = arg.categoria ? await acharCategoria(arg.categoria, arg.visao) : null;
    await rest("previstos", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        tipo: "pagar",
        descricao: arg.descricao,
        valor: Math.abs(Number(arg.valor)),
        vencimento: arg.vencimento,
        recorrencia: arg.recorrencia || null,
        status: "aberto",
        categoria_id: cat ? cat.id : null,
        visao: arg.visao,
        observacao: "via:whatsapp",
      }),
    });
    return "Conta a pagar criada: " + arg.descricao + " vencendo " + arg.vencimento + ".";
  }

  if (nome === "categorizar_movimento") {
    const cat = await acharCategoria(arg.categoria, arg.visao);
    if (!cat) throw new Error("categoria nao encontrada: " + arg.categoria);
    const alvo = await rest("movimentos?select=id,descricao_limpa,descricao_original&visao=eq." +
      arg.visao + "&or=(descricao_limpa.ilike." + ilike(arg.busca) +
      ",descricao_original.ilike." + ilike(arg.busca) + ")&order=data.desc&limit=2");
    if (!alvo || !alvo.length) throw new Error("nenhum movimento casa com: " + arg.busca);
    if (alvo.length > 1) throw new Error("mais de um movimento casa com: " + arg.busca + " - seja mais especifico");
    await rest("movimentos?id=eq." + alvo[0].id, {
      method: "PATCH",
      body: JSON.stringify({ categoria_id: cat.id }),
    });
    return "Categorizado como " + cat.nome + ".";
  }

  throw new Error("tool de escrita desconhecida: " + nome);
}

// --------------------------------------------------- resumo pra o "ok"
function resumirAcao(nome: string, a: any): string {
  const brl = (v: number) => "R$ " + Number(v).toFixed(2).replace(".", ",");
  if (nome === "lancar_movimento") {
    return (a.sentido === "Entrada" ? "Entrada" : "Saida") + " de " + brl(a.valor) +
      " - " + a.descricao + "\nConta: " + a.conta + " | " + a.data + " | " + a.visao +
      (a.categoria ? " | " + a.categoria : "");
  }
  if (nome === "lancar_conta_a_pagar") {
    return "Conta a pagar de " + brl(a.valor) + " - " + a.descricao +
      "\nVence " + a.vencimento + " | " + a.visao +
      (a.recorrencia ? " | repete " + a.recorrencia : " | unica");
  }
  if (nome === "categorizar_movimento") {
    return "Categorizar o movimento \"" + a.busca + "\" como " + a.categoria + " (" + a.visao + ")";
  }
  return nome + " " + JSON.stringify(a);
}

const SYSTEM = [
  "Voce e a assistente financeira do Gustavo Juca, respondendo pelo WhatsApp.",
  "Ela opera a Central Financeira dele: 5 visoes (PJ = Outliers Corretora, JUCA = pessoal dele,",
  "FAMILIA, PIPEX, RC) com contas, cartoes, movimentos realizados e previstos (contas a pagar).",
  "",
  "COMO RESPONDER",
  "- WhatsApp, nao relatorio: curto, direto, sem tabela e sem markdown pesado.",
  "- Valores em reais no formato R$ 1.234,56.",
  "- Se faltar um dado obrigatorio pra registrar algo, pergunte UMA coisa por vez.",
  "- Se ele nao disser a visao, deduza pelo contexto e diga qual assumiu.",
  "- Nunca invente numero: se nao consultou, consulte antes de afirmar.",
  "",
  "ESCRITA",
  "- Toda tool de escrita e uma PROPOSTA. Ela nao grava sozinha.",
  "- Quando a tool de escrita voltar 'aguardando_confirmacao', so confirme pra ele o que vai ser",
  "  feito e peca um ok. Nao diga que ja lancou - ainda nao lancou.",
  "",
  "DATA DE HOJE: " + hojeISO() + " (fuso America/Sao_Paulo).",
].join("\n");

// --------------------------------------------------------- pendencias
async function pendenciaAberta(tel: string): Promise<any> {
  const corte = new Date(Date.now() - PENDENCIA_MIN * 60000).toISOString();
  const rows = await rest("wa_pendencias?select=*&telefone=eq." + tel +
    "&status=eq.aberta&created_at=gte." + corte + "&order=created_at.desc&limit=1");
  return rows && rows.length ? rows[0] : null;
}

// regex montada por string pra manter o fonte em ASCII puro (emoji e acento via \u).
const RX_SIM = new RegExp("^\\s*(ok|okay|oks|sim|s|isso|confirmo?|confirmado|pode|manda|vai|bora|1|\uD83D\uDC4D|\u2705)\\s*[.!]*\\s*$", "i");
const RX_NAO = new RegExp("^\\s*(n|nao|n\u00e3o|no|cancela|cancelar|deixa|esquece|2|\u274C)\\s*[.!]*\\s*$", "i");

// ------------------------------------------------------- loop do Claude
async function responder(tel: string, texto: string): Promise<string> {
  // historico curto pra dar contexto (ultimas trocas)
  const hist = await rest("wa_mensagens?select=direcao,texto&telefone=eq." + tel +
    "&order=created_at.desc&limit=10");
  const messages: any[] = (hist || []).reverse().map((m: any) => ({
    role: m.direcao === "in" ? "user" : "assistant",
    content: m.texto,
  }));
  messages.push({ role: "user", content: texto });

  const tools = [...TOOLS_LEITURA, ...TOOLS_ESCRITA];
  let pendenteCriada = false;

  for (let volta = 0; volta < 6; volta++) {
    const resp = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM,
      tools,
      messages,
    });

    if (resp.stop_reason !== "tool_use") {
      const txt = resp.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n").trim();
      return txt || "Nao consegui montar uma resposta agora.";
    }

    messages.push({ role: "assistant", content: resp.content });
    const usos = resp.content.filter((b: any) => b.type === "tool_use");
    const results: any[] = [];

    for (const u of usos) {
      let out: string;
      let erro = false;
      try {
        if (NOMES_ESCRITA.includes(u.name)) {
          // NAO grava: vira pendencia aguardando o "ok" dele
          if (pendenteCriada) {
            out = JSON.stringify({ status: "recusado", motivo: "so uma acao pendente por vez" });
          } else {
            await rest("wa_pendencias?status=eq.aberta&telefone=eq." + tel, {
              method: "PATCH", body: JSON.stringify({ status: "substituida" }),
            });
            await rest("wa_pendencias", {
              method: "POST",
              body: JSON.stringify({
                telefone: tel, tool: u.name, argumentos: u.input,
                resumo: resumirAcao(u.name, u.input), status: "aberta",
              }),
            });
            pendenteCriada = true;
            out = JSON.stringify({
              status: "aguardando_confirmacao",
              resumo: resumirAcao(u.name, u.input),
              instrucao: "Mostre o resumo pra ele e peca um ok. NAO diga que foi lancado.",
            });
          }
        } else {
          out = await rodarLeitura(u.name, u.input);
        }
      } catch (e) {
        erro = true;
        out = JSON.stringify({ erro: String((e as Error).message || e) });
      }
      results.push({ type: "tool_result", tool_use_id: u.id, content: out, is_error: erro });
    }
    messages.push({ role: "user", content: results });
  }
  return "Me enrolei aqui nessa. Tenta perguntar de outro jeito?";
}

// -------------------------------------------------------------- rota
Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // handshake do painel da Meta
  if (req.method === "GET") {
    if (url.searchParams.get("hub.mode") === "subscribe" &&
        url.searchParams.get("hub.verify_token") === VERIFY_TOKEN && VERIFY_TOKEN) {
      return new Response(url.searchParams.get("hub.challenge") || "", { status: 200 });
    }
    return new Response("no", { status: 403 });
  }

  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  const raw = await req.text();
  if (!(await assinaturaOk(raw, req.headers.get("x-hub-signature-256")))) {
    console.error("assinatura invalida");
    return new Response("bad signature", { status: 401 });
  }

  // A partir daqui SEMPRE 200: erro nosso nao pode fazer a Meta reenviar em loop.
  try {
    const body = JSON.parse(raw);
    const val = body?.entry?.[0]?.changes?.[0]?.value;
    const msg = val?.messages?.[0];
    if (!msg) return new Response("ok", { status: 200 }); // status de entrega etc.

    const tel = String(msg.from || "").replace(/\D/g, "");
    const wamid = String(msg.id || "");

    if (!ALLOWED.includes(tel)) {
      console.error("telefone fora da allowlist: " + tel.slice(0, 6) + "...");
      return new Response("ok", { status: 200 });
    }

    // idempotencia: a Meta reenvia o mesmo evento quando desconfia de falha
    const ja = await rest("wa_mensagens?select=id&id=eq." + encodeURIComponent(wamid) + "&limit=1");
    if (ja && ja.length) return new Response("ok", { status: 200 });

    const texto = msg.text?.body ? String(msg.text.body) : "";
    await rest("wa_mensagens", {
      method: "POST",
      body: JSON.stringify({ id: wamid, telefone: tel, direcao: "in", texto: texto || "[" + msg.type + "]" }),
    });

    if (!texto) {
      await enviar(tel, "Por enquanto eu so leio texto. Me manda escrito?");
      return new Response("ok", { status: 200 });
    }

    let resposta: string;
    const pend = await pendenciaAberta(tel);

    if (pend && RX_SIM.test(texto)) {
      try {
        const feito = await rodarEscrita(pend.tool, pend.argumentos);
        await rest("wa_pendencias?id=eq." + pend.id, {
          method: "PATCH", body: JSON.stringify({ status: "executada" }),
        });
        resposta = "OK, feito. " + feito;
      } catch (e) {
        await rest("wa_pendencias?id=eq." + pend.id, {
          method: "PATCH", body: JSON.stringify({ status: "erro" }),
        });
        resposta = "Nao deu pra gravar: " + String((e as Error).message || e);
      }
    } else if (pend && RX_NAO.test(texto)) {
      await rest("wa_pendencias?id=eq." + pend.id, {
        method: "PATCH", body: JSON.stringify({ status: "cancelada" }),
      });
      resposta = "Cancelado, nao lancei nada.";
    } else {
      resposta = await responder(tel, texto);
    }

    await enviar(tel, resposta);
    await rest("wa_mensagens", {
      method: "POST",
      body: JSON.stringify({ id: "out:" + wamid, telefone: tel, direcao: "out", texto: resposta }),
    });
  } catch (e) {
    console.error("wa-webhook: " + String((e as Error)?.stack || e));
  }
  return new Response("ok", { status: 200 });
});
