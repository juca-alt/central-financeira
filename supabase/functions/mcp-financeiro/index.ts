// =====================================================================
// Edge Function: mcp-financeiro  --  v2.0 (Central 2.0, 2026-09-02)
// Conector MCP CURADO da Central Financeira, agora POR PESSOA.
//
// O QUE MUDOU NA 2.0
//  - Token por pessoa (tabela mcp_tokens). O token resolve o e-mail e o
//    ESCOPO da pessoa vem de usuario_visoes (as mesmas permissoes do app):
//    ler = pode consultar a visao; escrever = pode lancar/alterar nela.
//    O MCP_TOKEN (secret) continua valendo como token do dono (tudo).
//  - Ferramentas de LEITURA: quem_sou_eu, saldos, resumo_do_mes,
//    listar_movimentos, listar_categorias. Sem elas o Claude da pessoa
//    so escrevia no escuro.
//  - Toda ferramenta checa o escopo. Fora do escopo = erro claro em
//    portugues, nunca vazamento de outra visao.
//
// Transporte: MCP Streamable HTTP (stateless). POST JSON-RPC.
// Auth propria (NAO usa o JWT do Supabase): token via ?k=, Bearer ou
// segmento de path /t/<token> (o claude.ai descarta query string).
//
// Fonte em ASCII puro de proposito (colar no dashboard corrompe UTF-8).
// Deploy: Dashboard -> Edge Functions -> mcp-financeiro -> cole -> Deploy,
//         com "Verify JWT" DESLIGADO (a auth e feita aqui).
// Secrets: MCP_TOKEN (token do dono), SUPABASE_URL / SERVICE_ROLE (runtime).
// =====================================================================

const SUPABASE_URL = (Deno.env.toObject()["SUPABASE_URL"] || "").trim();
const SRK = (Deno.env.toObject()["SUPABASE_SERVICE_ROLE_KEY"] || "").trim();
const MCP_TOKEN = (Deno.env.toObject()["MCP_TOKEN"] || "").trim();

const VISOES = ["PJ", "PIPEX", "RC", "FAMILIA", "JUCA"];
const VISAO_LABEL: Record<string, string> = { PJ: "Prudential Franquia", PIPEX: "Pipe X", RC: "R.C", FAMILIA: "Familia", JUCA: "Juca" };
const RECORR = ["mensal", "semanal", "quinzenal", "bimestral", "trimestral", "semestral", "anual"];
const SERVER = { name: "central-financeira", version: "2.0.0" };

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

const ilike = (term: string) => "*" + encodeURIComponent(String(term).replace(/[%*]/g, "")) + "*";
const enc = (s: string) => encodeURIComponent(String(s));
function isDate(s: string): boolean { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "")); }
function isMes(s: string): boolean { return /^\d{4}-\d{2}$/.test(String(s || "")); }
const brl = (v: number) => "R$ " + (Number(v) || 0).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
function mesBounds(mes: string): { ini: string; fim: string } {
  const y = +mes.slice(0, 4), m = +mes.slice(5, 7);
  const ny = m >= 12 ? y + 1 : y, nm = m >= 12 ? 1 : m + 1;
  return { ini: mes + "-01", fim: ny + "-" + String(nm).padStart(2, "0") + "-01" };
}
function mesAtual(): string {
  // fuso de Recife (UTC-3) - o servidor roda em UTC
  const d = new Date(Date.now() - 3 * 3600 * 1000);
  return d.toISOString().slice(0, 7);
}
function hojeISO(): string { return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10); }

// ======================= ESCOPO POR PESSOA ==========================
type Scope = { admin: boolean; email: string; nome: string; ler: string[]; escrever: string[]; dono: boolean };

async function resolveScope(tok: string): Promise<Scope | null> {
  if (!tok) return null;
  if (MCP_TOKEN && tok === MCP_TOKEN) {
    return { admin: true, dono: true, email: "dono", nome: "Gustavo (token do dono)", ler: VISOES.slice(), escrever: VISOES.slice() };
  }
  const rows: any[] = await rest("mcp_tokens?select=id,email,ativo,revogado_em&token=eq." + enc(tok) + "&limit=1");
  const t = rows && rows[0];
  if (!t || !t.ativo || t.revogado_em) return null;
  const us: any[] = await rest("app_usuarios?select=email,nome,admin&email=eq." + enc(t.email) + "&limit=1");
  const u = us && us[0];
  if (!u) return null;
  const vs: any[] = await rest("usuario_visoes?select=visao,ler,escrever&email=eq." + enc(t.email));
  const ler = u.admin ? VISOES.slice() : (vs || []).filter((v) => v.ler).map((v) => String(v.visao)).filter((v) => VISOES.includes(v));
  const esc = u.admin ? VISOES.slice() : (vs || []).filter((v) => v.escrever).map((v) => String(v.visao)).filter((v) => VISOES.includes(v));
  // carimbo de uso (nao bloqueia a chamada se falhar)
  rest("mcp_tokens?id=eq." + enc(t.id), { method: "PATCH", body: JSON.stringify({ ultimo_uso: new Date().toISOString() }) }).catch(() => {});
  return { admin: !!u.admin, dono: false, email: String(u.email), nome: String(u.nome || u.email), ler, escrever: esc };
}

function visaoDe(a: any, sc: Scope, obrigatoria = true): string {
  const v = String(a.visao || "").toUpperCase();
  if (!v) {
    if (!obrigatoria) return "";
    if (sc.ler.length === 1) return sc.ler[0];   // pessoa com uma visao so: nao precisa dizer
    throw new Error("informe a visao (voce tem acesso a: " + sc.ler.join(", ") + ")");
  }
  if (!VISOES.includes(v)) throw new Error("visao invalida (use " + VISOES.join("/") + ")");
  return v;
}
function exigeLer(sc: Scope, v: string) {
  if (!sc.ler.includes(v)) throw new Error("sua conexao nao tem acesso a visao " + v + " (" + (VISAO_LABEL[v] || v) + "). Visoes liberadas: " + (sc.ler.join(", ") || "nenhuma") + ". Peca ao Gustavo em Configuracoes > Pessoas & acessos.");
}
function exigeEscrever(sc: Scope, v: string) {
  exigeLer(sc, v);
  if (!sc.escrever.includes(v)) throw new Error("sua conexao so LE a visao " + v + " (" + (VISAO_LABEL[v] || v) + "); nao pode lancar nem alterar nela. Peca ao Gustavo pra marcar 'editar' em Configuracoes > Pessoas & acessos.");
}

// acha 1 registro por nome dentro da visao (ou AMBOS); exato tem prioridade
async function resolveNome(tabela: string, nome: string, visao: string): Promise<any> {
  if (!nome) return null;
  const rows: any[] = await rest(
    tabela + "?select=id,nome,visao&nome=ilike." + ilike(nome) +
    "&visao=in.(" + enc(visao) + ",AMBOS)&limit=10",
  );
  if (!rows || !rows.length) return null;
  const exato = rows.find((r) => String(r.nome).toLowerCase() === String(nome).toLowerCase());
  return exato || rows[0];
}

async function mapa(tabela: string, visao: string, campos = "id,nome"): Promise<Record<string, any>> {
  const rows: any[] = await rest(tabela + "?select=" + campos + "&visao=in.(" + enc(visao) + ",AMBOS)&limit=1000");
  const m: Record<string, any> = {};
  (rows || []).forEach((r) => { m[r.id] = r; });
  return m;
}

// movimento "interno" (nao e receita nem despesa): mesma regra do app
const RX_INTERNO = /aplica[c\u00e7][a\u00e3]o|investimento|resgate|pagamento (de )?fatura|transfer[e\u00ea]ncia|saldo inicial/i;
function isInterno(desc: string, catNome: string): boolean {
  return RX_INTERNO.test(String(catNome || "")) || RX_INTERNO.test(String(desc || ""));
}

// ======================= LEITURA (novas na 2.0) =====================
async function quem_sou_eu(_a: any, sc: Scope): Promise<string> {
  const linhas: string[] = [];
  linhas.push("Conectado como: " + sc.nome + (sc.dono ? "" : " <" + sc.email + ">") + (sc.admin ? " (administrador)" : ""));
  linhas.push("Visoes que voce pode CONSULTAR: " + (sc.ler.map((v) => v + " = " + VISAO_LABEL[v]).join(" | ") || "nenhuma"));
  linhas.push("Visoes em que voce pode LANCAR/ALTERAR: " + (sc.escrever.map((v) => v + " = " + VISAO_LABEL[v]).join(" | ") || "nenhuma"));
  for (const v of sc.ler) {
    const cs: any[] = await rest("contas?select=nome,tipo,saldo_atual,ativo&visao=eq." + enc(v) + "&ativo=eq.true&order=ordem.asc,nome.asc");
    linhas.push("Contas de " + VISAO_LABEL[v] + ": " + ((cs || []).map((c) => c.nome + " (" + c.tipo + ")").join(", ") || "nenhuma"));
  }
  linhas.push("Dica: comece por resumo_do_mes ou saldos. Datas em YYYY-MM-DD, meses em YYYY-MM.");
  return linhas.join("\n");
}

async function saldos(a: any, sc: Scope): Promise<string> {
  const v = visaoDe(a, sc, false);
  const vis = v ? [v] : sc.ler;
  vis.forEach((x) => exigeLer(sc, x));
  if (!vis.length) return "Nenhuma visao liberada.";
  const out: string[] = [];
  for (const x of vis) {
    const cs: any[] = await rest("contas?select=nome,tipo,saldo_atual,saldo_atualizado_em&visao=eq." + enc(x) + "&ativo=eq.true&order=ordem.asc,nome.asc");
    let tot = 0, cart = 0;
    out.push("== " + VISAO_LABEL[x] + " (" + x + ")");
    for (const c of cs || []) {
      const s = Number(c.saldo_atual);
      const carimbo = c.saldo_atualizado_em ? String(c.saldo_atualizado_em).slice(0, 10) : "sem carimbo";
      const eCartao = c.tipo === "cartao";
      if (isFinite(s)) { if (eCartao) cart += s; else tot += s; }
      out.push("- " + c.nome + " [" + c.tipo + "]: " + (isFinite(s) ? brl(s) : "saldo nao informado") + " (em " + carimbo + ")");
    }
    out.push("Disponivel em contas: " + brl(tot) + (cart ? " | fatura/divida em cartoes: " + brl(cart) : ""));
  }
  return out.join("\n");
}

async function resumo_do_mes(a: any, sc: Scope): Promise<string> {
  const v = visaoDe(a, sc);
  exigeLer(sc, v);
  const mes = isMes(a.mes) ? String(a.mes) : mesAtual();
  const { ini, fim } = mesBounds(mes);
  const cats = await mapa("categorias", v, "id,nome,tipo");
  const contas = await mapa("contas", v, "id,nome,tipo");
  const movs: any[] = await rest("movimentos?select=id,data,descricao_original,descricao_limpa,valor,sinal,categoria_id,conta_id&visao=eq." + enc(v) +
    "&data=gte." + ini + "&data=lt." + fim + "&order=data.asc&limit=3000");
  let ent = 0, sai = 0, interno = 0, semCat = 0;
  const porCat: Record<string, number> = {};
  for (const m of movs || []) {
    const cat = m.categoria_id ? cats[m.categoria_id] : null;
    const conta = m.conta_id ? contas[m.conta_id] : null;
    const val = Math.abs(Number(m.valor) || 0);
    const desc = m.descricao_limpa || m.descricao_original || "";
    if (isInterno(desc, cat ? cat.nome : "")) { interno += val; continue; }
    if (!cat) semCat++;
    if (Number(m.sinal) > 0) {
      if (conta && conta.tipo === "cartao") { interno += val; continue; }  // entrada em cartao = pagamento de fatura, nunca receita
      ent += val;
    } else {
      sai += val;
      const k = cat ? cat.nome : "(sem categoria)";
      porCat[k] = (porCat[k] || 0) + val;
    }
  }
  const top = Object.entries(porCat).sort((x, y) => y[1] - x[1]).slice(0, 10);
  // compromissos do mes (previstos)
  const prev: any[] = await rest("previstos?select=id,descricao,valor,vencimento,tipo,status,recorrencia&visao=eq." + enc(v) +
    "&vencimento=gte." + ini + "&vencimento=lt." + fim + "&order=vencimento.asc&limit=500");
  const hoje = hojeISO();
  let pagAb = 0, pagPg = 0, atras = 0, recAb = 0;
  const atrasados: string[] = [];
  for (const p of prev || []) {
    const val = Number(p.valor) || 0;
    const st = String(p.status || "").toLowerCase();
    if (p.tipo === "pagar") {
      if (st === "pago") pagPg += val;
      else if (st === "aberto") { pagAb += val; if (p.vencimento < hoje) { atras += val; atrasados.push(p.vencimento + " " + p.descricao + " " + brl(val)); } }
    } else if (p.tipo === "receber" && st === "aberto") recAb += val;
  }
  const L: string[] = [];
  L.push("RESUMO " + VISAO_LABEL[v] + " (" + v + ") - " + mes + "  [" + (movs || []).length + " movimentos]");
  L.push("Entradas (receita real): " + brl(ent));
  L.push("Saidas (gasto real): " + brl(sai));
  L.push("Resultado do mes ate agora: " + brl(ent - sai));
  L.push("Movimentacoes internas ignoradas (transferencias, fatura, investimento): " + brl(interno));
  if (semCat) L.push("Sem categoria: " + semCat + " movimento(s) - use listar_movimentos com sem_categoria=true e categorizar_movimento");
  L.push("Maiores gastos por categoria:");
  top.forEach(([k, val]) => L.push("  - " + k + ": " + brl(val)));
  L.push("Compromissos do mes (contas a pagar): em aberto " + brl(pagAb) + " | ja pagos " + brl(pagPg) + (recAb ? " | a receber em aberto " + brl(recAb) : ""));
  if (atrasados.length) { L.push("ATRASADOS (" + brl(atras) + "):"); atrasados.slice(0, 15).forEach((s) => L.push("  - " + s)); }
  return L.join("\n");
}

async function listar_movimentos(a: any, sc: Scope): Promise<string> {
  const v = visaoDe(a, sc);
  exigeLer(sc, v);
  const lim = Math.min(300, Math.max(1, Number(a.limite) || 100));
  let q = "movimentos?select=id,data,descricao_original,descricao_limpa,valor,sinal,categoria_id,conta_id,observacao&visao=eq." + enc(v);
  if (isMes(a.mes)) { const b = mesBounds(String(a.mes)); q += "&data=gte." + b.ini + "&data=lt." + b.fim; }
  if (isDate(a.de)) q += "&data=gte." + a.de;
  if (isDate(a.ate)) q += "&data=lte." + a.ate;
  if (a.sem_categoria === true) q += "&categoria_id=is.null";
  if (a.busca) q += "&or=(descricao_original.ilike." + ilike(String(a.busca)) + ",descricao_limpa.ilike." + ilike(String(a.busca)) + ")";
  const contas = await mapa("contas", v, "id,nome,tipo");
  if (a.conta) {
    const c = await resolveNome("contas", String(a.conta), v);
    if (!c) throw new Error("conta '" + a.conta + "' nao encontrada na visao " + v);
    q += "&conta_id=eq." + enc(c.id);
  }
  q += "&order=data.desc&limit=" + lim;
  const rows: any[] = await rest(q);
  if (!rows || !rows.length) return "Nenhum movimento com esse filtro em " + VISAO_LABEL[v] + ".";
  const cats = await mapa("categorias", v, "id,nome,tipo");
  let liq = 0;
  const out = rows.map((m) => {
    const val = Math.abs(Number(m.valor) || 0) * (Number(m.sinal) > 0 ? 1 : -1);
    liq += val;
    const cat = m.categoria_id && cats[m.categoria_id] ? cats[m.categoria_id].nome : "(sem categoria)";
    const conta = m.conta_id && contas[m.conta_id] ? contas[m.conta_id].nome : "?";
    return "- " + m.data + " " + (val >= 0 ? "+" : "-") + brl(Math.abs(val)) + "  " + (m.descricao_limpa || m.descricao_original) + "  [" + cat + " | " + conta + "] id " + m.id;
  });
  return rows.length + " movimento(s) em " + VISAO_LABEL[v] + (rows.length >= lim ? " (limite atingido - refine o filtro)" : "") + ", liquido " + brl(liq) + ":\n" + out.join("\n");
}

async function listar_categorias(a: any, sc: Scope): Promise<string> {
  const v = visaoDe(a, sc);
  exigeLer(sc, v);
  const rows: any[] = await rest("categorias?select=nome,tipo,visao,parent_id&visao=in.(" + enc(v) + ",AMBOS)&order=tipo.asc,nome.asc&limit=500");
  const sai = (rows || []).filter((c) => c.tipo === "saida" && !c.parent_id).map((c) => c.nome + (c.visao === "AMBOS" ? "*" : ""));
  const ent = (rows || []).filter((c) => c.tipo === "entrada" && !c.parent_id).map((c) => c.nome + (c.visao === "AMBOS" ? "*" : ""));
  return "Categorias de " + VISAO_LABEL[v] + " (* = compartilhada entre visoes)\nSAIDAS: " + sai.join(", ") + "\nENTRADAS: " + ent.join(", ");
}

// ======================= ESCRITA (v1.1, agora com escopo) ===========
async function lancar_conta_a_pagar(a: any, sc: Scope): Promise<string> {
  const desc = String(a.descricao || "").trim();
  const valor = Number(a.valor);
  const venc = String(a.vencimento || "").slice(0, 10);
  const visao = visaoDe(a, sc);
  exigeEscrever(sc, visao);
  if (!desc) throw new Error("descricao obrigatoria");
  if (!(valor > 0)) throw new Error("valor deve ser > 0");
  if (!isDate(venc)) throw new Error("vencimento deve ser YYYY-MM-DD");
  let rec: string | null = a.recorrencia ? String(a.recorrencia).toLowerCase() : null;
  if (rec && !RECORR.includes(rec)) throw new Error("recorrencia invalida (use " + RECORR.join("/") + ")");

  const cat = a.categoria ? await resolveNome("categorias", String(a.categoria), visao) : null;
  const conta = a.conta ? await resolveNome("contas", String(a.conta), visao) : null;

  const row: any = {
    descricao: desc, valor: valor, vencimento: venc, tipo: "pagar", status: "aberto",
    visao: visao, recorrencia: rec,
    categoria_id: cat ? cat.id : null, conta_id: conta ? conta.id : null,
    observacao: (a.observacao ? String(a.observacao) + " " : "") + "[via MCP " + sc.nome + "]",
  };
  const ins = await rest("previstos", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(row) });
  const p = Array.isArray(ins) ? ins[0] : ins;
  const avisos = [];
  if (a.categoria && !cat) avisos.push("categoria '" + a.categoria + "' nao encontrada em " + visao + " (ficou sem categoria)");
  if (a.conta && !conta) avisos.push("conta '" + a.conta + "' nao encontrada em " + visao + " (ficou sem conta)");
  return "Conta a pagar criada em " + VISAO_LABEL[visao] + ": \"" + desc + "\" " + brl(valor) +
    " vencendo " + venc + (rec ? " (" + rec + ")" : "") +
    (cat ? " / cat: " + cat.nome : "") + (conta ? " / conta: " + conta.nome : "") +
    " [id " + p.id + "]" + (avisos.length ? "\nAVISO: " + avisos.join("; ") : "");
}

async function dar_baixa(a: any, sc: Scope): Promise<string> {
  let prev: any = null;
  if (a.previsto_id) {
    const rows = await rest("previstos?select=id,descricao,valor,status,recorrencia,visao,tipo&id=eq." + enc(a.previsto_id));
    prev = rows && rows[0];
  } else if (a.descricao) {
    const visao = a.visao ? visaoDe(a, sc) : null;
    let q = "previstos?select=id,descricao,valor,status,recorrencia,visao,tipo&status=eq.aberto&descricao=ilike." + ilike(String(a.descricao));
    q += visao ? "&visao=eq." + enc(visao) : "&visao=in.(" + sc.escrever.map(enc).join(",") + ")";
    const rows: any[] = await rest(q + "&limit=6");
    if (!rows || !rows.length) throw new Error("nenhuma conta em aberto casa com '" + a.descricao + "'");
    if (rows.length > 1) {
      return "Achei " + rows.length + " candidatos - passe previsto_id de um deles:\n" +
        rows.map((r) => "- " + r.descricao + " " + brl(Number(r.valor)) + " [" + r.visao + "] id " + r.id).join("\n");
    }
    prev = rows[0];
  } else {
    throw new Error("informe previsto_id OU descricao");
  }
  if (!prev) throw new Error("previsto nao encontrado");
  exigeEscrever(sc, String(prev.visao));
  const st = String(prev.status).toLowerCase();
  if (st === "pago" || st === "recebido") return "Essa conta ja esta como " + st + " (id " + prev.id + ").";
  if (prev.recorrencia) {
    throw new Error("essa conta e recorrente (" + prev.recorrencia + "); dar baixa aqui mataria a serie. " +
      "Use o check no app (Contas do mes / Modo Financeiro), que cria a instancia paga e rola o template.");
  }
  // receber quitado = 'recebido', pagar quitado = 'pago' (erro #32 do Livro)
  const novo = prev.tipo === "receber" ? "recebido" : "pago";
  await rest("previstos?id=eq." + enc(prev.id), {
    method: "PATCH", body: JSON.stringify({ status: novo, movimento_id_realizado: a.movimento_id ? String(a.movimento_id) : undefined }),
  });
  if (a.movimento_id) {
    await rest("movimentos?id=eq." + enc(a.movimento_id), { method: "PATCH", body: JSON.stringify({ conciliado_previsto_id: prev.id }) });
  }
  return "Baixa dada: \"" + prev.descricao + "\" " + brl(Number(prev.valor)) + " marcada como " + novo +
    (a.movimento_id ? " e conciliada ao movimento " + a.movimento_id : "") + " (id " + prev.id + ").";
}

async function categorizar_movimento(a: any, sc: Scope): Promise<string> {
  const mid = String(a.movimento_id || "").trim();
  const nome = String(a.categoria || "").trim();
  if (!mid) throw new Error("movimento_id obrigatorio");
  if (!nome) throw new Error("categoria obrigatoria");
  const movs = await rest("movimentos?select=id,visao,descricao_original,valor&id=eq." + enc(mid));
  const mov = movs && movs[0];
  if (!mov) throw new Error("movimento nao encontrado");
  exigeEscrever(sc, String(mov.visao));
  const cat = await resolveNome("categorias", nome, mov.visao);
  if (!cat) throw new Error("categoria '" + nome + "' nao encontrada na visao " + mov.visao + " (veja listar_categorias)");
  await rest("movimentos?id=eq." + enc(mid), { method: "PATCH", body: JSON.stringify({ categoria_id: cat.id }) });
  return "Movimento \"" + (mov.descricao_original || mid) + "\" categorizado como \"" + cat.nome + "\".";
}

async function listar_contas_a_pagar(a: any, sc: Scope): Promise<string> {
  const lim = Math.min(200, Math.max(1, Number(a.limite) || 50));
  const status = a.status ? String(a.status).toLowerCase() : "aberto";
  const tipo = String(a.tipo || "pagar").toLowerCase() === "receber" ? "receber" : "pagar";
  const v = a.visao ? visaoDe(a, sc) : "";
  if (v) exigeLer(sc, v);
  let q = "previstos?select=id,descricao,valor,vencimento,status,visao,recorrencia&tipo=eq." + tipo + "&status=eq." +
    enc(status) + "&order=vencimento.asc&limit=" + lim;
  q += v ? "&visao=eq." + enc(v) : "&visao=in.(" + sc.ler.map(enc).join(",") + ")";
  if (isMes(a.mes)) { const b = mesBounds(String(a.mes)); q += "&vencimento=gte." + b.ini + "&vencimento=lt." + b.fim; }
  const rows: any[] = await rest(q);
  if (!rows || !rows.length) return "Nenhuma conta a " + tipo + " (" + status + ") com esse filtro.";
  const total = rows.reduce((s, r) => s + Number(r.valor || 0), 0);
  return rows.length + " conta(s) a " + tipo + ", total " + brl(total) + ":\n" +
    rows.map((r) => "- " + r.vencimento + "  " + r.descricao + "  " + brl(Number(r.valor)) +
      " [" + r.visao + (r.recorrencia ? "/" + r.recorrencia : "") + "] id " + r.id).join("\n");
}

// ---- hash deterministico: mesmo extrato reenviado nao duplica ---------
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

async function importar_movimentos(a: any, sc: Scope): Promise<string> {
  const visao = visaoDe(a, sc);
  exigeEscrever(sc, visao);
  const nomeConta = String(a.conta || "").trim();
  const fonte = String(a.fonte || "").trim() || ("mcp_" + new Date().toISOString().slice(0, 10).replace(/-/g, ""));
  const itens: any[] = Array.isArray(a.itens) ? a.itens : [];
  if (!nomeConta) throw new Error("conta obrigatoria");
  if (!itens.length) throw new Error("itens vazio");
  if (itens.length > 400) throw new Error("maximo 400 itens por chamada (mande em lotes)");

  const conta = await resolveNome("contas", nomeConta, visao);
  if (!conta) throw new Error("conta '" + nomeConta + "' nao encontrada na visao " + visao);

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

  const inseridos: any[] = await rest("movimentos?on_conflict=hash", {
    method: "POST",
    headers: { Prefer: "return=representation,resolution=ignore-duplicates" },
    body: JSON.stringify(rows),
  });
  const nIns = Array.isArray(inseridos) ? inseridos.length : 0;
  const nDup = rows.length - nIns;
  const liquido = rows.reduce((s, r) => s + r.valor * r.sinal, 0);

  return "Importacao em " + VISAO_LABEL[visao] + " / " + conta.nome + " (fonte: " + fonte + ")\n" +
    "- recebidos: " + itens.length + "\n" +
    "- inseridos: " + nIns + "\n" +
    "- ja existiam (ignorados): " + nDup + "\n" +
    "- liquido do lote: " + brl(liquido) + "\n" +
    (problemas.length ? "AVISOS:\n" + problemas.map((p) => "- " + p).join("\n") : "Sem avisos.");
}

async function corrigir_data_movimento(a: any, sc: Scope): Promise<string> {
  const mid = String(a.movimento_id || "").trim();
  const nova = String(a.data || "").slice(0, 10);
  if (!mid) throw new Error("movimento_id obrigatorio");
  if (!isDate(nova)) throw new Error("data deve ser YYYY-MM-DD");
  const movs = await rest("movimentos?select=id,data,descricao_original,valor,visao&id=eq." + enc(mid));
  const mov = movs && movs[0];
  if (!mov) throw new Error("movimento nao encontrado");
  exigeEscrever(sc, String(mov.visao));
  if (mov.data === nova) return "Movimento ja estava em " + nova + " (nada a fazer).";
  await rest("movimentos?id=eq." + enc(mid), { method: "PATCH", body: JSON.stringify({ data: nova }) });
  return "Data corrigida: \"" + (mov.descricao_original || mid) + "\" " + brl(Number(mov.valor)) + " de " + mov.data + " para " + nova + ".";
}

async function atualizar_saldo_conta(a: any, sc: Scope): Promise<string> {
  const visao = visaoDe(a, sc);
  exigeEscrever(sc, visao);
  const nomeConta = String(a.conta || "").trim();
  const saldo = Number(a.saldo);
  if (!nomeConta) throw new Error("conta obrigatoria");
  if (!isFinite(saldo)) throw new Error("saldo deve ser numero");
  const conta = await resolveNome("contas", nomeConta, visao);
  if (!conta) throw new Error("conta '" + nomeConta + "' nao encontrada na visao " + visao);
  const quando = isDate(String(a.data_do_saldo || "")) ? String(a.data_do_saldo) + "T12:00:00Z" : new Date().toISOString();
  await rest("contas?id=eq." + enc(conta.id), { method: "PATCH", body: JSON.stringify({ saldo_atual: saldo, saldo_atualizado_em: quando }) });
  return "Saldo de " + conta.nome + " (" + VISAO_LABEL[visao] + ") atualizado para " + brl(saldo) + " em " + quando.slice(0, 10) + ".";
}

// ------------------------- catalogo MCP ------------------------------
const S = (t: string, d?: string) => (d ? { type: t, description: d } : { type: t });
const VIS = { type: "string", enum: VISOES, description: "PJ=Prudential Franquia, PIPEX=Pipe X, RC=R.C, FAMILIA=Familia, JUCA=Juca. Se voce so tem uma visao, pode omitir." };
const TOOLS = [
  { name: "quem_sou_eu", description: "Mostra quem esta conectado, quais visoes pode consultar e em quais pode lancar, e as contas de cada uma. Comece por aqui.", inputSchema: { type: "object", properties: {} } },
  { name: "saldos", description: "Saldo atual de cada conta (com a data em que foi conferido), por visao. Sem visao = todas as suas.", inputSchema: { type: "object", properties: { visao: VIS } } },
  { name: "resumo_do_mes", description: "Fecha o mes de uma visao: receita real, gasto real, resultado, maiores categorias, compromissos em aberto/pagos e atrasados. Transferencias e pagamento de fatura nao contam.", inputSchema: { type: "object", properties: { visao: VIS, mes: S("string", "YYYY-MM (padrao: mes atual)") } } },
  { name: "listar_movimentos", description: "Lista movimentos (extrato ja importado) com filtros: mes, de/ate, conta, busca por texto, sem_categoria. Devolve ids pra categorizar/corrigir.", inputSchema: { type: "object", properties: { visao: VIS, mes: S("string", "YYYY-MM"), de: S("string", "YYYY-MM-DD"), ate: S("string", "YYYY-MM-DD"), conta: S("string"), busca: S("string"), sem_categoria: S("boolean"), limite: S("number", "ate 300, padrao 100") } } },
  { name: "listar_categorias", description: "Categorias validas da visao (saidas e entradas), pra usar em categorizar_movimento e lancar_conta_a_pagar.", inputSchema: { type: "object", properties: { visao: VIS } } },
  {
    name: "listar_contas_a_pagar",
    description: "Lista compromissos (previstos) a pagar ou a receber. Filtra por visao, mes (YYYY-MM), status (aberto/pago/recebido) e tipo (pagar/receber). Devolve ids pra dar_baixa.",
    inputSchema: { type: "object", properties: { visao: VIS, mes: S("string"), status: S("string"), tipo: { type: "string", enum: ["pagar", "receber"] }, limite: S("number") } },
  },
  {
    name: "lancar_conta_a_pagar",
    description: "Lanca uma conta a pagar (compromisso com vencimento) na visao. Resolve categoria e conta por nome. Exige permissao de escrita na visao.",
    inputSchema: {
      type: "object",
      properties: {
        descricao: S("string"), valor: S("number"), vencimento: S("string", "YYYY-MM-DD"), visao: VIS,
        categoria: S("string"), conta: S("string"), recorrencia: { type: "string", enum: RECORR }, observacao: S("string"),
      },
      required: ["descricao", "valor", "vencimento"],
    },
  },
  {
    name: "dar_baixa",
    description: "Marca um compromisso como pago (ou recebido) e opcionalmente concilia a um movimento. Recorrentes sao recusadas (use o app).",
    inputSchema: { type: "object", properties: { previsto_id: S("string"), descricao: S("string"), visao: VIS, movimento_id: S("string") } },
  },
  {
    name: "categorizar_movimento",
    description: "Define a categoria (por nome) de um movimento existente. Exige escrita na visao do movimento.",
    inputSchema: { type: "object", properties: { movimento_id: S("string"), categoria: S("string") }, required: ["movimento_id", "categoria"] },
  },
  {
    name: "importar_movimentos",
    description: "Importa um lote de movimentos de EXTRATO numa conta. Deduplica por hash: reenviar o mesmo extrato nao duplica. Nunca importe a partir de comprovante, so de extrato.",
    inputSchema: {
      type: "object",
      properties: {
        conta: S("string", "nome da conta (ex: Conta Nubank Familia, Inter PF)"), visao: VIS,
        fonte: S("string", "rotulo da origem, ex: extrato_nubank_20260901"),
        itens: {
          type: "array", description: "ate 400 lancamentos",
          items: {
            type: "object",
            properties: {
              data: S("string", "YYYY-MM-DD"), descricao: S("string"), valor: S("number", "valor absoluto, positivo"),
              sinal: S("number", "1 = entrada, -1 = saida"), categoria: S("string", "nome da categoria (opcional)"),
              observacao: S("string"), hash: S("string", "opcional; se omitido e calculado do conteudo"),
            },
            required: ["data", "descricao", "valor", "sinal"],
          },
        },
      },
      required: ["conta", "itens"],
    },
  },
  {
    name: "corrigir_data_movimento",
    description: "Corrige a data de um movimento ja gravado (ex: lancamento que entrou com D+1 em relacao ao extrato).",
    inputSchema: { type: "object", properties: { movimento_id: S("string"), data: S("string", "YYYY-MM-DD") }, required: ["movimento_id", "data"] },
  },
  {
    name: "atualizar_saldo_conta",
    description: "Grava o saldo conferido de uma conta (saldo_atual + data da leitura).",
    inputSchema: { type: "object", properties: { conta: S("string"), visao: VIS, saldo: S("number"), data_do_saldo: S("string", "YYYY-MM-DD (opcional, default hoje)") }, required: ["conta", "saldo"] },
  },
];

const HANDLERS: Record<string, (a: any, sc: Scope) => Promise<string>> = {
  quem_sou_eu, saldos, resumo_do_mes, listar_movimentos, listar_categorias,
  lancar_conta_a_pagar, dar_baixa, categorizar_movimento, listar_contas_a_pagar,
  importar_movimentos, corrigir_data_movimento, atualizar_saldo_conta,
};

// ------------------------- JSON-RPC MCP ------------------------------
function tokenDe(req: Request, url: URL): string {
  const q = url.searchParams.get("k") || "";
  const h = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const m = url.pathname.match(/\/t\/([^/]+)\/?$/);
  const p = m ? decodeURIComponent(m[1]) : "";
  return p || h || q;
}

// IMPORTANTE: nunca responder HTTP 401 no fluxo MCP - 401 faz o claude.ai
// cair no fluxo OAuth (que nao existe aqui). Handshake (initialize/tools/list/ping)
// e aberto e nao expoe dados; SO tools/call exige token valido (erro em JSON-RPC).
async function handleRpc(msg: any, sc: Scope | null): Promise<any | null> {
  const { id, method, params } = msg || {};
  const ok = (result: any) => ({ jsonrpc: "2.0", id, result });
  const err = (code: number, message: string) => ({ jsonrpc: "2.0", id, error: { code, message } });

  if (method === "initialize") {
    const pv = (params && params.protocolVersion) || "2024-11-05";
    return ok({ protocolVersion: pv, capabilities: { tools: {} }, serverInfo: SERVER });
  }
  if (method === "notifications/initialized" || method === "notifications/cancelled") return null;
  if (method === "ping") return ok({});
  if (method === "tools/list") return ok({ tools: TOOLS });
  if (method === "tools/call") {
    if (!sc) return ok({ content: [{ type: "text", text: "ERRO: token ausente, invalido ou revogado no conector (a URL deve terminar com /t/SEU_TOKEN). Peca um token novo ao Gustavo em Configuracoes > Pessoas & acessos." }], isError: true });
    const name = params && params.name;
    const args = (params && params.arguments) || {};
    const fn = HANDLERS[name];
    if (!fn) return err(-32602, "ferramenta desconhecida: " + name);
    try {
      const text = await fn(args, sc);
      return ok({ content: [{ type: "text", text }] });
    } catch (e) {
      return ok({ content: [{ type: "text", text: "ERRO: " + String((e as Error)?.message || e) }], isError: true });
    }
  }
  if (typeof id === "undefined") return null;
  return err(-32601, "metodo nao suportado: " + method);
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

  if (req.method === "GET") {
    if (url.searchParams.get("health") === "1") {
      return json({ ok: true, server: SERVER, transport: "streamable-http", auth: MCP_TOKEN ? "token" : "MCP_TOKEN ausente", tools: TOOLS.length });
    }
    return new Response(null, { status: 405, headers: { ...cors, Allow: "POST, OPTIONS" } });
  }
  if (req.method !== "POST") return new Response(null, { status: 405, headers: { ...cors, Allow: "POST, OPTIONS" } });

  let sc: Scope | null = null;
  try { sc = await resolveScope(tokenDe(req, url)); } catch (_) { sc = null; }

  let body: any = null;
  try { body = await req.json(); } catch (_) { return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "JSON invalido" } }, 400); }

  if (Array.isArray(body)) {
    const outs = [];
    for (const m of body) { const r = await handleRpc(m, sc); if (r) outs.push(r); }
    return outs.length ? json(outs) : new Response(null, { status: 202, headers: cors });
  }
  const r = await handleRpc(body, sc);
  if (!r) return new Response(null, { status: 202, headers: cors });
  return json(r);
});
