/* =====================================================================
   Central Financeira — núcleo COMPARTILHADO (app.js)
   Carregado igual por index.html (PJ) e pf/index.html (Família).
   A ÚNICA diferença entre os apps-irmãos é window.CONFIG.VISAO,
   definido no <head> de cada shell. NÃO duplicar lógica aqui.
   ===================================================================== */
const SHELL_HTML = `
<div id="gate">
  <form class="gate-card" id="gateForm" autocomplete="on">
    <div class="dot">₿</div>
    <h2>Central Financeira</h2>
    <div class="sub">Entre para acessar o app.</div>
    <button type="button" id="gGoogle" class="gate-google"><svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg> Entrar com Google</button>
    <div class="gate-or"><span>ou com e-mail</span></div>
    <label for="gEmail">E-mail</label>
    <input id="gEmail" type="email" inputmode="email" autocomplete="username" required />
    <label for="gPass">Senha</label>
    <input id="gPass" type="password" autocomplete="current-password" required />
    <button id="gBtn" type="submit">Entrar</button>
    <div class="gate-err" id="gErr"></div>
    <div class="gate-toggle" id="gToggle">Primeiro acesso? <span>Criar minha senha</span></div>
  </form>
</div>
<header class="mtop"><button class="mtop-btn" id="navToggle" aria-label="Abrir menu">☰</button><span class="mtop-brand">Central Financeira</span></header>
<div class="side-ov" id="sideOv"></div>
<div class="app">
  <aside class="side" id="sideNav">
    <div class="brand"><span class="dot">₿</span> Central Financeira</div>
    <div class="ver" id="verTag">v3.0</div>
    <div class="vsw" id="vswBox"></div>
    <nav class="nav" id="nav"></nav>
    <div class="navedit-bar" id="navEditBar"></div>
    <div class="spacer"></div>
    <div class="env" id="envBox"></div>
    <div class="logout" id="forceUpd" title="Buscar a versão mais nova">🔄 Atualizar app</div>
    <div class="profile" id="profileBox" style="display:none"></div>
    <div class="logout" id="pwBtn" style="display:none">🔑 Alterar senha</div>
    <div class="logout" id="logoutBtn" style="display:none">Sair</div>
  </aside>
  <main class="main" id="view"></main>
</div>
<nav class="bnav" id="bnav" aria-label="Navegação rápida">
  <a data-route="central"><span class="bico">◎</span><span class="blbl">Central</span></a>
  <a data-route="financeiro"><span class="bico">💳</span><span class="blbl">Contas</span></a>
  <button class="bnav-fab" id="bnavFab" aria-label="Novo lançamento">＋</button>
  <a data-route="movimentos"><span class="bico">↕</span><span class="blbl">Movim.</span></a>
  <a data-bnav="menu"><span class="bico">☰</span><span class="blbl">Menu</span></a>
</nav>
<div class="toast" id="toast"></div>
<div class="upd" id="updBanner">
  <span>🔄 Nova versão disponível</span>
  <button id="updBtn">Atualizar agora</button>
</div>
`;
document.body.insertAdjacentHTML("afterbegin", SHELL_HTML);

/* ---------- camada de dados (Supabase + DEMO) ---------- */
/* =====================================================================
   DADOS — Supabase (anon) + DEMO. v3.0
   ===================================================================== */
const HAS_KEY=!!(window.CONFIG&&window.CONFIG.SUPABASE_ANON_KEY);
const FORCE_DEMO=/[?&]demo=1/.test(location.search);   // ?demo=1 → dados de exemplo (dev/preview, sem login)
const sb=(HAS_KEY&&!FORCE_DEMO)?supabase.createClient(CONFIG.SUPABASE_URL,CONFIG.SUPABASE_ANON_KEY):null;
const MODE=(HAS_KEY&&!FORCE_DEMO)?"live":"demo";
/* PERFIS — fonte única. code = valor do enum `visao` no Supabase; path = pasta (legado, migrando p/ app único). */
/* `cor` = identidade visual da frente (Modo Financeiro: barras, badges e chips) */
const PROFILES=[
  {code:"PJ",      label:"Outliers MFB", grupo:"Negócios", path:"",       icon:"🏢", cor:"#2a78d6", corBg:"#e5effb"},
  {code:"PIPEX",   label:"Pipe X",       grupo:"Negócios", path:"pipex/", icon:"🏢", cor:"#7c3aed", corBg:"#eee9fd"},
  {code:"RC",      label:"R.C",          grupo:"Negócios", path:"rc/",    icon:"🏢", cor:"#0891b2", corBg:"#e0f3f8"},
  {code:"FAMILIA", label:"Família",      grupo:"Pessoal",  path:"pf/",    icon:"🏠", cor:"#eb6834", corBg:"#fdeade"},
  {code:"JUCA",    label:"Jucá",         grupo:"Pessoal",  path:"juca/",  icon:"🧑", cor:"#16a34a", corBg:"#dff5e6"},
];
/* Visão ativa — MUTÁVEL. App único: a Central troca a visão em runtime (setVisao). */
const VISAO_KEY="cfin_visao";
const savedVisao=(()=>{try{return localStorage.getItem(VISAO_KEY);}catch(e){return null;}})();
/* deep-link ?v=CODE (usado pelos redirects dos sub-apps aposentados /juca /pf /pipex /rc):
   abre já na visão pedida e persiste, se for um código válido */
const urlVisao=(()=>{try{const p=new URLSearchParams(location.search),v=(p.get("v")||p.get("visao")||"").toUpperCase();return PROFILES.some(x=>x.code===v)?v:null;}catch(e){return null;}})();
let VISAO=urlVisao||savedVisao||(window.CONFIG&&window.CONFIG.VISAO)||"PJ";   // escopo da visão aberta
if(urlVisao){try{localStorage.setItem(VISAO_KEY,urlVisao);}catch(e){}}
let CUR_PROFILE=PROFILES.find(p=>p.code===VISAO)||{code:VISAO,label:VISAO,grupo:"Negócios",path:""};
let VISAO_LABEL=CUR_PROFILE.label;
let IS_NEGOCIOS=CUR_PROFILE.grupo==="Negócios";          // DRE só p/ Negócios; Pessoal usa Orçamento
let IS_PESSOAL=CUR_PROFILE.grupo==="Pessoal";            // Pessoal (Família/Jucá): home + Contas do mês próprias
let VFILTER=[VISAO,"AMBOS"];                              // o que a visão aberta enxerga
try{document.title="Central Financeira · "+VISAO_LABEL;}catch(e){}
/* recalcula os derivados da visão (sem recarregar dados) */
/* "ALL" = Todas as visões (31/08): a antiga tela Central virou um MODO — o seletor decide o
   recorte e TODAS as telas (Visão Geral, Fluxo, DRE, Movimentos, Cartões…) mostram o consolidado.
   VFILTER amplo faz o loadData trazer tudo que o usuário enxerga (RLS corta o resto). */
const ALL_PROFILE={code:"ALL",label:"Todas as visões",grupo:"Consolidado",path:"",icon:"◎",cor:"#0f6b5c",corBg:"#e3efec"};
const isAll=()=>VISAO==="ALL";
function applyVisao(code){VISAO=code;
  if(code==="ALL"){CUR_PROFILE=ALL_PROFILE;VISAO_LABEL=CUR_PROFILE.label;IS_NEGOCIOS=true;IS_PESSOAL=false;VFILTER=[...PROFILES.map(p=>p.code),"AMBOS"];}
  else{CUR_PROFILE=PROFILES.find(p=>p.code===code)||{code,label:code,grupo:"Negócios",path:""};VISAO_LABEL=CUR_PROFILE.label;IS_NEGOCIOS=CUR_PROFILE.grupo==="Negócios";IS_PESSOAL=CUR_PROFILE.grupo==="Pessoal";VFILTER=[VISAO,"AMBOS"];}
  try{localStorage.setItem(VISAO_KEY,code);}catch(e){}try{document.title="Central Financeira · "+VISAO_LABEL;}catch(e){}}
if(VISAO==="ALL")applyVisao("ALL");   // boot direto no consolidado (visão salva)
/* troca a visão ativa: recarrega dados da visão e abre a Visão Geral dela */
async function setVisao(code){applyVisao(code);syncChrome();if(MODE==="live"){try{DB=await loadData();}catch(e){toast("Erro ao trocar visão: "+e.message);}}SEL.clear();MV_MES=undefined;route("dashboard");closeDrawer();}
/* atualiza o cromo da sidebar/topo pra visão ativa (marca, DRE, env, perfil) */
/* =====================================================================
   NAVEGAÇÃO MODULAR — o menu é DADO, não HTML fixo.
   O Gustavo reordena/agrupa sozinho: ✥ Organizar (modo editor) ou
   toque-e-segure num item (500ms) e arrasta — igual app de celular.
   Layout salvo em localStorage; a ORDEM DO DOM é a fonte da verdade
   depois de cada solta (varre e remonta os grupos).
   `vis` = regra de visibilidade por visão (o que o syncChrome fazia na mão).
   ===================================================================== */
const NAV_CAT={
  central:   {ico:"◎",  label:"Central", vis:()=>!isAll()},   /* em ALL, a Visão Geral JÁ é a central */
  financeiro:{ico:"💳", label:"Modo Financeiro"},
  dashboard: {ico:"▦",  label:"Visão Geral"},
  fluxo:     {ico:"📈", label:"Fluxo de Caixa"},
  dre:       {ico:"📊", label:"DRE",            vis:()=>IS_NEGOCIOS},
  orcamento: {ico:"🎯", label:"Orçamento", vis:()=>!isAll()},
  movimentos:{ico:"↕",  label:"Movimentos"},
  contas:    {ico:"🗓", label:"Contas do mês",  vis:()=>IS_PESSOAL},
  pagar:     {ico:"▣",  label:"Contas a Pagar", vis:()=>!IS_PESSOAL},
  receber:   {ico:"◳",  label:"A Receber",      vis:()=>!IS_PESSOAL},
  comissoes: {ico:"🤝", label:"Comissões LP",   vis:()=>VISAO==="PIPEX"},
  cartoes:   {ico:"▭",  label:"Cartões"},
  importar:  {ico:"⭱",  label:"Importar", vis:()=>!isAll()},
  config:    {ico:"⚙",  label:"Configurações"},
};
const NAV_KEY="cfin_nav_v1";
const navDefault=()=>[
  {titulo:"",             itens:["central","financeiro","dashboard","fluxo","dre","orcamento"]},
  {titulo:"Lançamentos",  itens:["movimentos","contas","pagar","receber","comissoes","cartoes","importar"]},
  {titulo:"Sistema",      itens:["config"]},
];
let NAVLAY=null, NAV_HIDE=new Set(), NAV_EDIT=false;

function navLoad(){
  try{
    const raw=JSON.parse(localStorage.getItem(NAV_KEY)||"null");
    if(raw&&Array.isArray(raw.grupos)){
      NAVLAY=raw.grupos.map(g=>({titulo:String(g.titulo||""),itens:(g.itens||[]).filter(r=>NAV_CAT[r])}));
      NAV_HIDE=new Set((raw.ocultos||[]).filter(r=>NAV_CAT[r]));
    }
  }catch(e){}
  if(!NAVLAY||!NAVLAY.length)NAVLAY=navDefault();
  /* rota nova no catálogo (deploy futuro) entra no fim, sem sumir do menu */
  const vistos=new Set(NAVLAY.flatMap(g=>g.itens));
  const faltando=Object.keys(NAV_CAT).filter(r=>!vistos.has(r));
  if(faltando.length)NAVLAY[NAVLAY.length-1].itens.push(...faltando);
}
function navSave(){try{localStorage.setItem(NAV_KEY,JSON.stringify({grupos:NAVLAY,ocultos:[...NAV_HIDE]}));}catch(e){}}
function navReset(){NAVLAY=navDefault();NAV_HIDE=new Set();navSave();renderNav();toast("Menu voltou ao padrão");}

/* DOM (ordem visual) -> NAVLAY. Chamado depois de cada solta/edição. */
function navFromDOM(){
  const nav=document.getElementById("nav");if(!nav)return;
  const grupos=[{titulo:"",itens:[]}];
  [...nav.children].forEach(n=>{
    /* o título REAL vem do data-titulo; textContent pode ser o placeholder
       "— sem título —" do modo editor (bug: virava nome do grupo ao salvar) */
    if(n.classList.contains("grp"))grupos.push({titulo:String(n.dataset.titulo!=null?n.dataset.titulo:(n.textContent||"")).trim(),itens:[]});
    else if(n.dataset.route)grupos[grupos.length-1].itens.push(n.dataset.route);
  });
  NAVLAY=grupos.filter((g,i)=>i===0?g.itens.length:(g.itens.length||g.titulo));
  if(!NAVLAY.length)NAVLAY=navDefault();
  navSave();
}

function renderNav(){
  const nav=document.getElementById("nav");if(!nav)return;
  if(!NAVLAY)navLoad();
  let html="";
  NAVLAY.forEach((g,gi)=>{
    if(g.titulo||NAV_EDIT)html+=`<div class="grp${NAV_EDIT?" ed":""}" data-gi="${gi}" data-titulo="${esc(g.titulo)}"${NAV_EDIT?` onclick="navRenomear(${gi})" title="Tocar pra renomear o grupo"`:""}>${esc(g.titulo||(NAV_EDIT?"— sem título —":""))}</div>`;
    g.itens.forEach(r=>{
      const it=NAV_CAT[r];if(!it)return;
      const okVisao=it.vis?it.vis():true, oculto=NAV_HIDE.has(r);
      if(!NAV_EDIT&&(!okVisao||oculto))return;
      const dim=(!okVisao||oculto)?" dim":"";
      html+=`<a data-route="${r}"${CURRENT===r?' class="active'+dim+'"':(dim?' class="'+dim.trim()+'"':"")}${!okVisao&&NAV_EDIT?' title="Não aparece na visão atual"':""}>`+
        (NAV_EDIT?`<span class="drag">⠿</span>`:"")+
        `<span class="ico">${it.ico}</span> ${esc(it.label)}`+
        (NAV_EDIT?`<span class="eye${oculto?" off":""}" onclick="event.stopPropagation();navOcultar('${r}')" title="${oculto?"Mostrar no menu":"Esconder do menu"}">${oculto?"⊘":"◉"}</span>`:"")+
        `</a>`;
    });
  });
  nav.innerHTML=html;
  nav.classList.toggle("editing",NAV_EDIT);
  const bar=document.getElementById("navEditBar");
  if(bar)bar.innerHTML=NAV_EDIT
    ? `<button class="nb ok" onclick="navEditor(false)">✓ Concluir</button><button class="nb" onclick="navAddGrupo()">+ Grupo</button><button class="nb" onclick="navReset()">↺ Padrão</button>`
    : `<button class="nb ghost" onclick="navEditor(true)" title="Reordenar e agrupar o menu do seu jeito">✥ Organizar menu</button>`;
}
function navEditor(on){NAV_EDIT=!!on;renderNav();if(on)toast("Modo editor: arraste os itens, toque no grupo pra renomear");else{navFromDOM();renderNav();toast("Menu salvo");}}
function navOcultar(r){if(NAV_HIDE.has(r))NAV_HIDE.delete(r);else NAV_HIDE.add(r);navSave();renderNav();}
function navAddGrupo(){NAVLAY.push({titulo:"Novo grupo",itens:[]});navSave();renderNav();}
function navRenomear(gi){
  const g=NAVLAY[gi];if(!g)return;
  modal({title:"Nome do grupo",fields:[{name:"t",label:"Título (vazio = sem cabeçalho)"}],values:{t:g.titulo},saveLabel:"Salvar",
    onSave:v=>{g.titulo=String(v.t||"").trim();if(!g.titulo&&!g.itens.length)NAVLAY.splice(gi,1);navSave();renderNav();}});
}

/* ---- arrastar (Pointer Events: mesmo código no mouse e no dedo) ----
   fora do modo editor, segurar 500ms num item já entra em edição e pega
   o item — o gesto que ele conhece de outros apps.                    */
(function navDragInit(){
  let alvo=null,timer=null,arrastando=false,y0=0;
  const nav=()=>document.getElementById("nav");
  function posicionar(clientY){
    const n=nav();if(!n||!alvo)return;
    const irmaos=[...n.children].filter(c=>c!==alvo);
    let antes=null;
    for(const c of irmaos){const r=c.getBoundingClientRect();if(clientY<r.top+r.height/2){antes=c;break;}}
    if(antes)n.insertBefore(alvo,antes);else n.appendChild(alvo);
  }
  function comecar(){
    if(!alvo)return;arrastando=true;
    if(!NAV_EDIT){NAV_EDIT=true;const r=alvo.dataset.route;renderNav();alvo=nav().querySelector(`a[data-route="${r}"]`);if(!alvo)return;}
    alvo.classList.add("dragging");
    try{navigator.vibrate&&navigator.vibrate(12);}catch(e){}
  }
  document.addEventListener("pointerdown",e=>{
    const a=e.target.closest("#nav a");if(!a)return;
    if(e.target.closest(".eye"))return;
    alvo=a;y0=e.clientY;
    try{a.setPointerCapture(e.pointerId);}catch(err){}
    if(NAV_EDIT)comecar(); else timer=setTimeout(comecar,500);
  });
  document.addEventListener("pointermove",e=>{
    if(!alvo)return;
    if(!arrastando){if(Math.abs(e.clientY-y0)>8){clearTimeout(timer);alvo=null;}return;}
    e.preventDefault();posicionar(e.clientY);
  },{passive:false});
  function soltar(){
    clearTimeout(timer);
    if(alvo&&arrastando){alvo.classList.remove("dragging");navFromDOM();renderNav();}
    alvo=null;arrastando=false;
  }
  document.addEventListener("pointerup",soltar);
  document.addEventListener("pointercancel",soltar);
})();

function syncChrome(){
  /* menu inteiro (inclusive as regras por visão: DRE só Negócios, Contas do
     mês só Pessoal, Comissões só PIPEX) sai do renderNav — ver NAV_CAT.vis */
  try{renderNav();}catch(e){}
  try{renderTopSwitch();}catch(e){}
  const _env=document.getElementById("envBox");if(_env)_env.innerHTML=MODE==="live"?`<span class="badge-live">LIVE</span> <b>v${window.APP_VERSION}</b> · <b>${esc(VISAO_LABEL)}</b><br>Supabase conectado`:`<span class="badge-demo">DEMO</span> <b>v${window.APP_VERSION}</b><br>Dados de exemplo`;
  try{const pb=document.getElementById("profileBox");if(pb&&pb.dataset.email!=null)renderProfile(pb.dataset.email);}catch(e){}
}
const fmtBRL=v=>(Number(v)||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const fmtK=v=>Math.abs(v)>=1000?(v/1000).toFixed(1).replace(".0","")+"k":String(Math.round(v));
const fmtDate=s=>{if(!s)return"—";const p=String(s).slice(0,10).split("-");if(p.length===3&&p[0].length===4)return p[2]+"/"+p[1]+"/"+p[0];const d=new Date(s);return isNaN(d)?s:d.toLocaleDateString("pt-BR");};
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const toast=m=>{const t=document.getElementById("toast");t.textContent=m;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2600);};
const ML=["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const todayISO=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");};
const debounce=(fn,ms)=>{let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);};};
const monthKey=s=>(s||"").slice(0,7);
const mkLabel=k=>k?ML[+k.slice(5,7)-1]+"/"+k.slice(2,4):"";
const addMonth=(k,n)=>{let[y,m]=k.split("-").map(Number);m+=n;y+=Math.floor((m-1)/12);m=((m-1)%12+12)%12+1;return y+"-"+String(m).padStart(2,"0");};

const INTERNO_CAT_RX=/transfer[eê]ncia|saldo inicial|aplica[cç][aã]o|investiment|resgate|pagamento\s+(de\s+)?fatura/i;
const INTERNO_DESC_RX=/\b(aplica[cç][aã]o|resgate|pagamento\s+(de\s+)?fatura|fatura\s+cart[aã]o|transfer[eê]ncia\s+interna|transf\s+entre\s+contas)\b/i;
const isForaTotais=m=>/fora do extrato/i.test(m.banco||"");// convenção: conta com "(fora do extrato)" no nome não entra em KPIs/gráficos
/* ENTRADA em conta de CARTÃO nunca é receita: é pagamento de fatura chegando (ou estorno).
   Sem isso, "PAGAMENTO ON LINE"/"Pagamento recebido" viravam Entrada real e inflavam
   entradas/sobra/DRE (ago/26: +R$ 5.140 só no Inter PF). m._cartao cobre o consolidado
   da Central, onde DB.contas é o da visão aberta e o lookup por nome não alcança. */
const isPagtoCartao=m=>m.sentido==="Entrada"&&(m._cartao===true||(m.banco&&typeof isCartaoConta==="function"&&isCartaoConta(m.banco)));
const isInterno=m=>isForaTotais(m)||isPagtoCartao(m)||INTERNO_CAT_RX.test(m.categoria||"")||INTERNO_DESC_RX.test(m.descricao||"");
/* No consolidado (Todas as visões), transferência ENTRE as próprias visões (PJ→PF etc.)
   também é interna — senão o mesmo dinheiro conta como entrada numa e saída na outra. */
const isForaAgregado=m=>isInterno(m)||(VISAO==="ALL"&&typeof isInterVisao==="function"&&isInterVisao(m));
/* previsto que é FATURA DE CARTÃO (auto ou lançado na mão): compromisso de caixa real
   (fica nas Contas do mês e no Modo Financeiro), mas NÃO soma em "saídas previstas"/
   projeção/Fluxo — o gasto já contou quando cada COMPRA entrou no cartão; somar a
   fatura de novo conta o mesmo dinheiro 2×. */
const isPrevFatura=p=>/auto:fatura/i.test(p.obs||p.observacao||"")||/^fatura\s/i.test(p.descricao||p.desc||"");
/* Inter-visão: transferências entre as PRÓPRIAS entidades do Gustavo (Outliers↔PF/Família/Jucá, fluxo Rebeca-RC).
   Na visão individual contam como receita/despesa (útil p/ orçamento); na Central consolidada são NETADAS
   p/ não duplicar (o dinheiro já foi contado uma vez na origem). Detecta por contraparte + tag em observacao.
   "outliers" SOZINHO, sem exigir " corretora": o feed do Nubank trunca a contraparte em
   "Transferência Recebida|OUTLIERS". Exigindo a palavra completa, o netting ficava ASSIMÉTRICO —
   a saída do PJ ("Pix enviado — Gustavo Melo Juca") era netada e a entrada na Família não, o que
   inflou R$ 72.469,19 de entradas (e R$ 1.337,32 de saídas) no consolidado desde 03/05/26.
   Conferido na base inteira: TODO lançamento com "outliers" é entidade dele, zero terceiro. */
const INTERVISAO_DESC_RX=/outliers|gustavo melo juc|gustavo juc[aá] corretora/i;
const isInterVisao=m=>INTERVISAO_DESC_RX.test(m.descricao||"")||/#intervisao|#rebeca-?rc/i.test(m.observacao||"");

function suggestCategoria(desc){const up=(desc||"").toUpperCase();if(!up)return"";
  const gl=(DB.glossario||[]).slice().sort((a,b)=>(b.termo||"").length-(a.termo||"").length);
  for(const g of gl){if(g.cat&&g.termo&&up.includes(g.termo.toUpperCase()))return g.cat;}
  let best=null;for(const r of(DB.regras||[])){if(r.cat&&r.padrao&&up.includes(r.padrao.toUpperCase())){if(!best||(r.peso||1)>(best.peso||1))best=r;}}
  return best?best.cat:"";}
const leafCat=v=>(v||"").split(" › ").pop();
const contaId=n=>(DB.contas||[]).find(c=>c.nome.toLowerCase()===(n||"").toLowerCase())?.id||null;
const catId=n=>{const l=leafCat(n);return(DB.categorias||[]).find(c=>c.nome.toLowerCase()===l.toLowerCase())?.id||null;};
const catTipo=n=>{const l=leafCat(n);return(DB.categorias||[]).find(c=>c.nome.toLowerCase()===l.toLowerCase())?.tipo||"";};
/* hash DETERMINÍSTICO: mesma transação → mesmo hash (permite dedup). NÃO misturar Date.now/random. */
function uhash(p){let h=5381;const s=String(p);for(let i=0;i<s.length;i++)h=((h*33)+s.charCodeAt(i))&0xffffffff;return"v2_"+(h>>>0).toString(16);}

/* orçamento: LIVE = tabela public.orcamentos (por visão), cache em DB.orcamentos; DEMO = localStorage.
   Shape em memória (compat com a UI): { "YYYY-MM": { "<categoria>": valor } }. */
const ORC_KEY="cfin_orc_v1";
function loadOrc(){ if(MODE==="live")return (typeof DB!=="undefined"&&DB&&DB.orcamentos)||{}; try{return JSON.parse(localStorage.getItem(ORC_KEY)||"{}");}catch(e){return{};} }
function saveOrc(o){try{localStorage.setItem(ORC_KEY,JSON.stringify(o));}catch(e){}}
function hasLocalOrc(){try{const o=JSON.parse(localStorage.getItem(ORC_KEY)||"{}");return Object.values(o).some(m=>m&&Object.keys(m).length);}catch(e){return false;}}
/* grava UM teto (visão atual, mês, categoria). live = upsert na tabela; demo = localStorage. */
async function setOrcamento(mes,catNome,valor){
  valor=+valor||0;
  if(MODE!=="live"){const o=loadOrc();o[mes]=o[mes]||{};o[mes][catNome]=valor;saveOrc(o);return;}
  const cid=catId(catNome);
  if(!cid){toast("Categoria sem id — recarregue a página");return;}
  const{error}=await sb.from("orcamentos").upsert({visao:VISAO,mes,categoria_id:cid,valor},{onConflict:"visao,mes,categoria_id"});
  if(error)throw new Error(error.message);
  DB.orcamentos=DB.orcamentos||{};DB.orcamentos[mes]=DB.orcamentos[mes]||{};DB.orcamentos[mes][catNome]=valor;
}
/* importa 1x o orçamento salvo neste navegador (localStorage) → visão atual, no Supabase */
async function importOrcLocal(){
  let raw={};try{raw=JSON.parse(localStorage.getItem(ORC_KEY)||"{}");}catch(e){}
  const rows=[];for(const mes in raw)for(const cn in raw[mes]){const cid=catId(cn),v=+raw[mes][cn]||0;if(cid&&v)rows.push({visao:VISAO,mes,categoria_id:cid,valor:v});}
  if(!rows.length){toast("Nada pra importar neste navegador");return;}
  try{const{error}=await sb.from("orcamentos").upsert(rows,{onConflict:"visao,mes,categoria_id"});if(error)throw new Error(error.message);
    DB=await loadData();toast(rows.length+" linha(s) importadas para "+VISAO_LABEL);viewOrcamento();}
  catch(e){toast("Erro ao importar: "+e.message);}
}

/* grupos do DRE (fonte única — usada no DRE e no editor de Configurações) */
const DRE_GRUPOS=["Receitas","Custos","Despesas Operacionais","Impostos e Taxas","Outras Despesas"];
const DRE_ORDEM_DESP=["Custos","Despesas Operacionais","Impostos e Taxas","Outras Despesas"];
const catByName=n=>{const l=leafCat(n);return(DB.categorias||[]).find(c=>c.nome.toLowerCase()===l.toLowerCase());};
/* grupo DRE por categoria: campo explícito (grupo_dre) vence; senão cai na heurística */
function dreGrupo(cat,tipo){const c=(cat||"").toLowerCase();
  if(/transfer/.test(c))return null;
  if(/fatura|cart[aã]o/.test(c))return null;
  const co=catByName(cat);
  if(co&&co.grupo_dre)return co.grupo_dre;
  if(tipo==="entrada")return"Receitas";
  if(/imposto|\bdas\b|darf|inss|taxa|tarifa/.test(c))return"Impostos e Taxas";
  if(/fornecedor|aluguel|coworking|software|assinatura|marketing|public|sal[aá]rio|pr[oó].?labore|contab|assistente/.test(c))return"Despesas Operacionais";
  return"Outras Despesas";}

const DEMO=(()=>{
  const mov=[
    ["2026-05-30","Compensatio MFB Mai/26","Pru Wallet",12666.54,"Entrada","Comissão Prudential"],
    ["2026-05-28","OUTLIERS repasse","Inter PJ",3200,"Entrada","Comissões/Repasses"],
    ["2026-05-27","DAS Simples Nacional","Inter PJ",-980.40,"Saída","Impostos e Taxas PJ"],
    ["2026-05-26","MJM Contabilidade","Inter PJ",-113.30,"Saída","Fornecedores"],
    ["2026-05-25","Aplicacao CDB INTER","Inter PJ",-5000,"Saída",""],
    ["2026-05-24","Maria Luiza Ferreira","Inter PJ",-400,"Saída","Fornecedores"],
    ["2026-05-22","Transf entre contas Inter→Nubank","Inter PJ",-2000,"Saída","Transferência PJ→PF"],
    ["2026-05-20","ANTHROPIC CLAUDE","Cartão Inter Empresas",-110,"Saída","Software/Assinaturas"],
    ["2026-05-15","Resgate Fundo INTER","Inter PJ",5000,"Entrada",""],
    ["2026-05-12","Prudential FYC","Pru Wallet",4200,"Entrada","Comissão FYC"],
    ["2026-05-08","Meta Ads","Inter PJ",-650,"Saída","Marketing/Publicidade"],
    ["2026-04-30","Compensatio MFB Abr/26","Pru Wallet",10980.20,"Entrada","Comissão Prudential"],
    ["2026-04-28","INSS","Inter PJ",-620,"Saída","Impostos e Taxas PJ"],
    ["2026-03-30","Compensatio MFB Mar/26","Pru Wallet",9870,"Entrada","Comissão Prudential"],
  ].map((r,i)=>({_row:"d"+i,data:r[0],descricao:r[1],banco:r[2],valor:Math.abs(r[3]),sentido:r[4],categoria:r[5],mes:+r[0].slice(5,7),ano:+r[0].slice(0,4)}));
  const pagar=[
    ["DAS Junho/26","2026-06-20",980.40,"Impostos e Taxas PJ","Inter PJ","aberto","mensal"],
    ["MJM Contabilidade","2026-06-05",113.30,"Fornecedores","Inter PJ","aberto","mensal"],
    ["Aluguel coworking","2026-06-10",1200,"Aluguel/Coworking","Inter PJ","aberto","mensal"],
    ["Maria Luiza","2026-06-05",400,"Fornecedores","Inter PJ","pago","mensal"],
  ].map((r,i)=>({_row:"p"+i,descricao:r[0],vencimento:r[1],valor:r[2],categoria:r[3],banco:r[4],status:r[5],recorrencia:r[6]}));
  const receber=[
    ["Compensatio MFB Jun/26","2026-06-30",13000,"aberto","Pru Wallet","mensal"],
    ["OUTLIERS repasse Jun","2026-06-15",3200,"aberto","Inter PJ",""],
  ].map((r,i)=>({_row:"r"+i,linha:r[0],dataPrevista:r[1],previstoLiquido:r[2],status:r[3],conta:r[4],recorrencia:r[5]}));
  const cartoes=mov.filter(m=>m.banco.indexOf("Cartão")>=0).map((m,i)=>({_row:"k"+i,data:m.data,descricao:m.descricao,cartao:m.banco,valor:m.valor,subcategoria:m.categoria,mesFatura:m.data.slice(5,7)+"/"+m.data.slice(0,4)}));
  let cid=0;const C=(n,t,p)=>({id:"cat"+(cid++),nome:n,tipo:t,parent_id:p||null});const cats=[];const add=(n,t,subs)=>{const p=C(n,t);cats.push(p);(subs||[]).forEach(s=>cats.push(C(s,t,p.id)));};
  add("Comissão Prudential","entrada");add("Comissão FYC","entrada");add("Comissões/Repasses","entrada");add("Outras Receitas PJ","entrada");add("Transferência (entrada)","entrada");
  add("Fornecedores","saida",["Contabilidade","Assistente"]);add("Impostos e Taxas PJ","saida",["DAS","INSS"]);add("Software/Assinaturas","saida",["IA (Claude/OpenAI)"]);
  add("Aluguel/Coworking","saida");add("Marketing/Publicidade","saida");add("Transferência PJ→PF","saida");add("Pagamento fatura cartão","saida");add("Outras Despesas PJ","saida");
  const contas=[...new Set(mov.map(m=>m.banco))].map((n,i)=>({id:"co"+i,nome:n,banco:n.split(" ")[0],tipo:/cart/i.test(n)?"cartao":"corrente"}));
  const regras=[["MJM","Fornecedores",5],["DAS","Impostos e Taxas PJ",5],["INSS","Impostos e Taxas PJ",5],["OUTLIERS","Comissões/Repasses",5],["PRUDENTIAL","Comissão Prudential",5],["CLAUDE","Software/Assinaturas",4],["ANTHROPIC","Software/Assinaturas",4],["META ADS","Marketing/Publicidade",4]];
  const glossario=[["MARIA LUIZA","Fornecedores"],["MJM CONTABILIDADE","Fornecedores"],["COMPENSATIO","Comissão Prudential"]];
  return{movimentos:mov,contasPagar:pagar,aReceber:receber,cartoes,categorias:cats,contas,regras:regras.map(r=>({padrao:r[0],cat:r[1],peso:r[2]})),glossario:glossario.map(g=>({termo:g[0],cat:g[1]}))};
})();

async function loadData(){
  if(MODE==="demo")return structuredClone(DEMO);
  const [contas,cats,mv,ct,pv,rg,gl,orc,tg,mt]=await Promise.all([
    sb.from("contas").select("id,nome,banco,tipo,ativo,visao,saldo_atual,saldo_atualizado_em").in("visao",VFILTER),
    sb.from("categorias").select("*").in("visao",VFILTER),
    sb.from("movimentos").select("id,data,descricao_original,descricao_limpa,valor,sinal,conta_id,categoria_id,observacao").in("visao",VFILTER).order("data",{ascending:false}).limit(20000),
    sb.from("cartao_transacoes").select("id,data_compra,data_fatura,descricao,valor,cartao_id,categoria_id").in("visao",VFILTER).order("data_compra",{ascending:false}).limit(20000),
    sb.from("previstos").select("id,descricao,valor,vencimento,tipo,status,conta_id,categoria_id,recorrencia,observacao,visao").in("visao",VFILTER).order("vencimento").limit(20000),
    sb.from("regras_classificacao").select("padrao,peso,categoria_id,ativo").limit(5000),
    sb.from("glossario_termos").select("termo,categoria_sugerida_id").in("visao",VFILTER).limit(5000),
    sb.from("orcamentos").select("mes,categoria_id,valor").in("visao",VFILTER).limit(20000),
    sb.from("tags").select("id,nome,cor,visao,ativo").in("visao",VFILTER).order("nome"),
    sb.from("movimento_tags").select("movimento_id,tag_id").limit(50000)]);
  /* Perfil novo ainda não provisionado no enum `visao` → mostra vazio em vez de quebrar. */
  const enumNovo=[contas,cats,mv,ct,pv].some(r=>r.error&&(/invalid input value for enum/i.test(r.error.message||"")||r.error.code==="22P02"));
  if(enumNovo)return{movimentos:[],contasPagar:[],aReceber:[],cartoes:[],categorias:[],contas:[],regras:[],glossario:[],orcamentos:{},tags:[]};
  for(const r of[contas,cats,mv,ct,pv])if(r.error)throw new Error(r.error.message);
  const cb=new Map(contas.data.map(c=>[c.id,c])),kb=new Map(cats.data.map(c=>[c.id,c])),nameOf=id=>kb.get(id)?.nome||"";
  const mtMap=new Map();((mt&&mt.data)||[]).forEach(r=>{const a=mtMap.get(r.movimento_id)||[];a.push(r.tag_id);mtMap.set(r.movimento_id,a);});
  const movimentos=mv.data.map(r=>({_row:r.id,data:(r.data||"").slice(0,10),descricao:r.descricao_limpa||r.descricao_original||"",banco:cb.get(r.conta_id)?.nome||"",valor:Number(r.valor||0),sentido:r.sinal===1?"Entrada":"Saída",categoria:nameOf(r.categoria_id),observacao:r.observacao||"",mes:r.data?+r.data.slice(5,7):null,ano:r.data?+r.data.slice(0,4):null,tags:(mtMap.get(r.id)||[])}));
  const cartoes=ct.data.map(r=>({_row:r.id,data:(r.data_compra||"").slice(0,10),descricao:r.descricao||"",cartao:cb.get(r.cartao_id)?.nome||"",valor:Number(r.valor||0),subcategoria:nameOf(r.categoria_id),mesFatura:(r.data_fatura||"").slice(5,7)+"/"+(r.data_fatura||"").slice(0,4)}));
  const contasPagar=pv.data.filter(p=>p.tipo==="pagar").map(p=>({_row:p.id,descricao:p.descricao,vencimento:(p.vencimento||"").slice(0,10),valor:Number(p.valor||0),categoria:nameOf(p.categoria_id),banco:cb.get(p.conta_id)?.nome||"",status:p.status,recorrencia:p.recorrencia||"",obs:p.observacao||"",visao:p.visao}));
  const aReceber=pv.data.filter(p=>p.tipo==="receber").map(p=>({_row:p.id,linha:p.descricao,dataPrevista:(p.vencimento||"").slice(0,10),previstoLiquido:Number(p.valor||0),status:p.status,conta:cb.get(p.conta_id)?.nome||"",recorrencia:p.recorrencia||"",visao:p.visao}));
  const regras=((rg&&rg.data)||[]).filter(r=>r.ativo!==false&&r.categoria_id).map(r=>({padrao:r.padrao,peso:r.peso||1,cat:nameOf(r.categoria_id)}));
  const glossario=((gl&&gl.data)||[]).filter(g=>g.categoria_sugerida_id).map(g=>({termo:g.termo,cat:nameOf(g.categoria_sugerida_id)}));
  const orcamentos={};((orc&&orc.data)||[]).forEach(r=>{const mk=r.mes;if(!mk)return;const cn=nameOf(r.categoria_id);if(!cn)return;orcamentos[mk]=orcamentos[mk]||{};orcamentos[mk][cn]=Number(r.valor||0);});
  return{movimentos,contasPagar,aReceber,cartoes,categorias:cats.data,contas:contas.data,regras,glossario,orcamentos,tags:((tg&&tg.data)||[])};
}
async function sbIns(t,p){const{data,error}=await sb.from(t).insert(p).select("id").single();if(error)throw new Error(error.message);return data.id;}
async function sbUpd(t,id,p){const{error}=await sb.from(t).update(p).eq("id",id);if(error)throw new Error(error.message);}
async function sbDel(t,id){const{error}=await sb.from(t).delete().eq("id",id);if(error)throw new Error(error.message);}

/* ---------- parsers + UI + router + init ---------- */
/* ===== Parsers ===== */
function parseAmount(s){if(s==null)return NaN;if(typeof s==="number")return s;let t=String(s).trim().replace(/R\$|\s/g,"");const neg=/^-/.test(t)||/\(.*\)/.test(t)||/D$/i.test(t);t=t.replace(/^[-+]/,"").replace(/[()CD]/gi,"");if(/,/.test(t)&&/\./.test(t))t=t.replace(/\./g,"").replace(",",".");else if(/,/.test(t))t=t.replace(",",".");const n=parseFloat(t);return isNaN(n)?NaN:(neg?-n:n);}
function normDate(s){const t=(s||"").trim();let m=t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);if(m)return`${m[1]}-${m[2].padStart(2,"0")}-${m[3].padStart(2,"0")}`;m=t.match(/^(\d{4})(\d{2})(\d{2})/);if(m)return`${m[1]}-${m[2]}-${m[3]}`;m=t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);if(m){let y=m[3];if(y.length===2)y=(+y>50?"19":"20")+y;return`${y}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;}return"";}
function parseOFX(text){const out=[];const re=/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;let m;while(m=re.exec(text)){const blk=m[1];const g=t=>{const r=new RegExp(`<${t}>([^<\\r\\n]*)`,"i").exec(blk);return r?r[1].trim():"";};const dt=normDate(g("DTPOSTED").slice(0,8));const amt=parseAmount(g("TRNAMT"));if(!dt||isNaN(amt))continue;out.push({date:dt,description:g("MEMO")||g("NAME")||"",amount:Math.abs(amt),sign:amt<0?"Saída":"Entrada"});}return out;}
function parseCSV(text){const lines=text.split(/\r?\n/).filter(l=>l.trim());if(!lines.length)return[];const sep=[";",",","\t"].map(s=>[s,lines[0].split(s).length]).sort((a,b)=>b[1]-a[1])[0][0];const rows=lines.map(l=>l.split(sep).map(c=>c.trim()));let hi=-1;for(let i=0;i<Math.min(8,rows.length);i++){const c=rows[i].join("|").toLowerCase();if(/data|date/.test(c)&&/valor|amount|vlr/.test(c)){hi=i;break;}}const header=(hi>=0?rows[hi]:["data","descricao","valor"]).map(h=>h.toLowerCase());const data=hi>=0?rows.slice(hi+1):rows;const col=rx=>header.findIndex(h=>rx.test(h));const di=Math.max(col(/data|date/),0),vi=col(/valor|amount|vlr/),ddi=Math.max(col(/desc|histor|memo|estabele/),1),si=col(/saldo|balance/);const out=[];for(const r of data){if(!r||r.every(c=>!c))continue;const dt=normDate(r[di]||"");const amt=parseAmount(vi>=0?r[vi]:r[2]);if(!dt||isNaN(amt)||amt===0)continue;const _b=si>=0?parseAmount(r[si]||""):NaN;out.push({date:dt,description:r[ddi]||"",amount:Math.abs(amt),sign:amt<0?"Saída":"Entrada",bal:isNaN(_b)?undefined:_b});}return out;}
function detectCompensatio(t){return/extrato\s+consolidado\s+de\s+comiss[ãa]o/i.test(t)||(/master\s+franqueado/i.test(t)&&/compensatio/i.test(t));}
function parseCompensatio(text){const out=[];const rx=/(FYC|Renova[çc][ãa]o|Override|Porte|Transfer[êe]ncia|Recapture)/i;const vrx=/(-?\(?\s*(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}\)?)\s*$/;for(const ln of text.split(/\n/)){if(/Comiss[ãa]o\s+Bruta|Vr\.?\s*Bruto\s+a\s+Receber/i.test(ln))continue;const mr=ln.match(rx),mv=ln.match(vrx);if(mr&&mv){const v=parseAmount(mv[1]);const ded=/\b(desc\.?|estorno)\b/i.test(ln);out.push({date:todayISO().slice(0,8)+"30",description:mr[0]+" — Compensatio MFB",amount:Math.abs(v),sign:ded?"Saída":"Entrada"});}}return out;}
/* saldo final do OFX (LEDGERBAL) — vira o saldo oficial da conta, igual ao da IA */
function parseOfxSaldo(text){const m=/<LEDGERBAL>[\s\S]*?<BALAMT>([^<\r\n]+)/i.exec(text);if(m){const v=parseAmount(m[1]);if(!isNaN(v))return v;}return null;}
/* saldo final do CSV: última linha da coluna Saldo (saldo corrido) — vira o saldo oficial da conta, igual ao OFX/IA */
function parseCsvSaldo(text){const lines=text.split(/\r?\n/).filter(l=>l.trim());if(!lines.length)return null;const sep=[";",",","\t"].map(s=>[s,lines[0].split(s).length]).sort((a,b)=>b[1]-a[1])[0][0];const rows=lines.map(l=>l.split(sep).map(c=>c.trim()));let hi=-1;for(let i=0;i<Math.min(8,rows.length);i++){const c=rows[i].join("|").toLowerCase();if(/data|date/.test(c)&&/valor|amount|vlr/.test(c)){hi=i;break;}}if(hi<0)return null;const header=rows[hi].map(h=>h.toLowerCase());const si=header.findIndex(h=>/saldo|balance/.test(h));if(si<0)return null;for(let i=rows.length-1;i>hi;i--){const r=rows[i];if(!r||r.every(c=>!c))continue;const v=parseAmount(r[si]||"");if(!isNaN(v))return v;}return null;}
function parseByType(text,tipo){if(tipo==="compensatio"||(tipo==="auto"&&detectCompensatio(text)))return{kind:"compensatio",txs:parseCompensatio(text)};if(tipo==="ofx"||(tipo==="auto"&&/<STMTTRN|<OFX/i.test(text)))return{kind:"ofx",txs:parseOFX(text),saldo_final:parseOfxSaldo(text)};return{kind:tipo==="fatura"?"fatura":"csv",txs:parseCSV(text),saldo_final:tipo==="fatura"?null:parseCsvSaldo(text)};}

/* ===== Modal + helpers ===== */
const $=s=>document.querySelector(s);
const el=h=>{const d=document.createElement("div");d.innerHTML=h.trim();return d.firstElementChild;};
const bancoOpts=()=>[...new Set([...(DB.contas||[]).filter(c=>c.ativo!==false).map(c=>c.nome),...DB.movimentos.map(m=>m.banco)].filter(Boolean))];
const cartaoOpts=()=>[...new Set([...(DB.contas||[]).filter(c=>/cart/i.test(c.nome)||c.tipo==="cartao").map(c=>c.nome),...DB.cartoes.map(c=>c.cartao)].filter(Boolean))];
/* tops ORDENADOS (pt) e sem duplicata de nome dentro do mesmo tipo — a lista crua era caótica */
function catTopsSorted(tipo){const seen=new Set();return DB.categorias.filter(c=>!c.parent_id&&(!tipo||c.tipo===tipo)).filter(c=>{const k=(c.tipo||"")+"|"+String(c.nome||"").trim().toLowerCase();if(seen.has(k))return false;seen.add(k);return true;}).sort((a,b)=>String(a.nome).localeCompare(String(b.nome),"pt"));}
const catSubsSorted=p=>DB.categorias.filter(s=>s.parent_id===p.id).sort((a,b)=>String(a.nome).localeCompare(String(b.nome),"pt"));
function catOptsByTipo(tipo){const out=[""];catTopsSorted(tipo).forEach(p=>{out.push(p.nome);catSubsSorted(p).forEach(s=>out.push(p.nome+" › "+s.nome));});out.push("__new");return out;}
const catOpts=()=>catOptsByTipo("").filter(o=>o!=="__new");
/* grupos por tipo p/ optgroup (subcategorias aninhadas sob o pai) */
function catGroupsByTipo(tipo){const withSubs=[],gerais=[];catTopsSorted(tipo).forEach(p=>{const subs=catSubsSorted(p);if(subs.length)withSubs.push({parent:p.nome,items:[p.nome,...subs.map(s=>p.nome+" › "+s.nome)]});else gerais.push(p.nome);});return{withSubs,gerais};}
function modal({title,fields,values={},extraHTML="",onSave,saveLabel="Salvar"}){
  const fldHTML=(fields||[]).map(f=>{const v=values[f.name]??f.default??"";
    if(f.type==="select")return `<div class="fld"><label>${esc(f.label)}</label><select data-n="${f.name}">${(f.options||[]).map(o=>{const val=typeof o==="object"?o.v:o,lab=typeof o==="object"?o.l:o;return`<option value="${esc(val)}" ${String(val)===String(v)?"selected":""}>${esc(lab||"—")}</option>`;}).join("")}</select></div>`;
    if(f.type==="textarea")return `<div class="fld"><label>${esc(f.label)}</label><textarea data-n="${f.name}" rows="3">${esc(v)}</textarea></div>`;
    return `<div class="fld"><label>${esc(f.label)}</label><input data-n="${f.name}" type="${f.type||"text"}" value="${esc(v)}" placeholder="${esc(f.placeholder||"")}"></div>`;}).join("");
  const bg=el(`<div class="modal-bg"><div class="modal"><h3>${esc(title)}</h3><div class="body">${fldHTML}${extraHTML}</div><div class="foot"><button class="btn ghost" data-act="cancel">Cancelar</button>${onSave?`<button class="btn" data-act="save">${esc(saveLabel)}</button>`:""}</div></div></div>`);
  document.body.appendChild(bg);const close=()=>bg.remove();
  bg.addEventListener("click",e=>{if(e.target===bg)close();});bg.querySelector('[data-act=cancel]').onclick=close;
  (fields||[]).filter(f=>f.showIf).forEach(f=>{const ctrl=bg.querySelector(`[data-n="${f.showIf.field}"]`),tgt=bg.querySelector(`[data-n="${f.name}"]`)?.closest(".fld");if(!ctrl||!tgt)return;const upd=()=>{tgt.style.display=String(ctrl.value)===String(f.showIf.val)?"":"none";};ctrl.addEventListener("change",upd);upd();});
  const sv=bg.querySelector('[data-act=save]');if(sv)sv.onclick=async()=>{const out={};bg.querySelectorAll("[data-n]").forEach(i=>out[i.dataset.n]=i.value);sv.disabled=true;let r;try{r=await onSave(out,bg);}catch(e){toast("Erro: "+e.message);sv.disabled=false;return;}if(r!==false)close();else sv.disabled=false;};
  return{bg,close};
}
function confirmDel(msg,onYes){modal({title:"Confirmar",extraHTML:`<div class="sub">${esc(msg)}</div>`,saveLabel:"Excluir",onSave:()=>{onYes();}});}

/* ===== reload após gravar (bug: totais recalculam) ===== */
async function afterWrite(){ if(MODE==="live"){ try{DB=await loadData();}catch(e){toast("Reload: "+e.message);} } SEL.clear(); try{FP.dados=null;}catch(e){} /* Modo Financeiro relê previstos */ (ROUTES[CURRENT]||viewDashboard)(); }
/* Botão ⚡ Atualizar bancos: Edge Function sync-agora → refresh Pluggy + workflow_dispatch dos syncs */
async function syncBancos(){const btn=()=>document.getElementById("btnSyncBancos");
  if(MODE!=="live"){toast("Sync só no modo live (logado)");return;}
  const b=btn(); if(b){b.disabled=true;b.textContent="⏳ Disparando…";}
  try{
    const tok=sb?((await sb.auth.getSession()).data.session?.access_token||CONFIG.SUPABASE_ANON_KEY):CONFIG.SUPABASE_ANON_KEY;
    const r=await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/sync-agora`,{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${tok}`,"apikey":CONFIG.SUPABASE_ANON_KEY},body:"{}"});
    const j=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(j.error||("HTTP "+r.status));
    if(j.ok){ toast("Sync disparado (Pluggy + Inter PJ) — recarrego em ~2 min"); const b2=btn(); if(b2)b2.textContent="⏳ Sincronizando…";
      setTimeout(async()=>{await afterWrite();toast("Saldos recarregados");},120000);
    } else { toast("Sync parcial: "+(typeof j.github==="string"?j.github:JSON.stringify(j.github)).slice(0,140)); const b3=btn(); if(b3){b3.disabled=false;b3.textContent="⚡ Atualizar bancos";} }
  }catch(e){ toast("Sync: "+e.message); const b4=btn(); if(b4){b4.disabled=false;b4.textContent="⚡ Atualizar bancos";} }}

/* ===== período ===== */
const yearsList=()=>[...new Set((DB.movimentos||[]).map(m=>m.ano).filter(Boolean))].sort((a,b)=>b-a);
let PERIOD={mode:"ano",ano:null,mes:null,de:"",ate:""};
function inPeriod(m){if(PERIOD.mode==="ano")return m.ano===PERIOD.ano;if(PERIOD.mode==="mes")return m.ano===PERIOD.ano&&m.mes===PERIOD.mes;if(PERIOD.mode==="range")return(!PERIOD.de||m.data>=PERIOD.de)&&(!PERIOD.ate||m.data<=PERIOD.ate);return true;}
function periodLabel(){if(PERIOD.mode==="ano")return"ano "+PERIOD.ano;if(PERIOD.mode==="mes")return ML[PERIOD.mes-1]+"/"+PERIOD.ano;return(PERIOD.de?fmtDate(PERIOD.de):"início")+" → "+(PERIOD.ate?fmtDate(PERIOD.ate):"hoje");}

let DB=null,CURRENT="dashboard",SEL=new Set();
function route(name){
  if(name==="central"){if(VISAO!=="ALL"){setVisao("ALL");return;}name="dashboard";}   /* Central = Visão Geral em modo Todas */
  if(name==="dre"&&!IS_NEGOCIOS)name="dashboard";if(name==="comissoes"&&VISAO!=="PIPEX")name="dashboard";if(name==="contas"&&!IS_PESSOAL)name="pagar";if((name==="pagar"||name==="receber")&&IS_PESSOAL)name="contas";CURRENT=name;SEL.clear();SELMODE=false;document.querySelectorAll("#nav a").forEach(a=>a.classList.toggle("active",a.dataset.route===name));document.querySelectorAll("#bnav a").forEach(a=>a.classList.toggle("active",a.dataset.route===name));try{renderTopSwitch();}catch(e){}(ROUTES[name]||viewDashboard)();}
function kpis(){const reais=DB.movimentos.filter(m=>inPeriod(m)&&!isForaAgregado(m));const ent=reais.filter(m=>m.sentido==="Entrada").reduce((s,m)=>s+m.valor,0);const sai=reais.filter(m=>m.sentido==="Saída").reduce((s,m)=>s+m.valor,0);const aPagar=DB.contasPagar.filter(c=>(c.status||"").toLowerCase()==="aberto").reduce((s,c)=>s+c.valor,0);const aReceber=DB.aReceber.filter(a=>(a.status||"").toLowerCase()!=="recebido").reduce((s,a)=>s+a.previstoLiquido,0);return{ent,sai,saldo:ent-sai,aPagar,aReceber,proj:(ent-sai)+aReceber-aPagar};}

/* ===== Motor de recorrência + números do período (Visão Geral) =====
   "A realizar" = agendados (previstos abertos) + recorrentes projetados no período. */
const pad2=n=>String(n).padStart(2,"0");
function daysInMonth(y,m){return[31,(y%4===0&&(y%100!==0||y%400===0))?29:28,31,30,31,30,31,31,30,31,30,31][m-1];}
function monthBounds(ano,mes){return{de:ano+"-"+pad2(mes)+"-01",ate:ano+"-"+pad2(mes)+"-"+pad2(daysInMonth(ano,mes))};}
function addDaysISO(iso,n){let[y,m,d]=iso.split("-").map(Number);const dt=new Date(Date.UTC(y,m-1,d));dt.setUTCDate(dt.getUTCDate()+n);return dt.getUTCFullYear()+"-"+pad2(dt.getUTCMonth()+1)+"-"+pad2(dt.getUTCDate());}
function recKind(r){r=(r||"").toLowerCase();if(/quinz/.test(r))return"q";if(/seman|week/.test(r))return"w";if(/anu|ano|year/.test(r))return"y";if(/mens|month|m[êe]s/.test(r))return"m";return"";}
function stepRec(iso,kind,dir){let[y,m,d]=iso.split("-").map(Number);
  if(kind==="w")return addDaysISO(iso,7*dir);
  if(kind==="q")return addDaysISO(iso,14*dir);
  if(kind==="y")return(y+dir)+"-"+pad2(m)+"-"+pad2(Math.min(d,daysInMonth(y+dir,m)));
  let nm=m+dir,ny=y;while(nm>12){nm-=12;ny++;}while(nm<1){nm+=12;ny--;}return ny+"-"+pad2(nm)+"-"+pad2(Math.min(d,daysInMonth(ny,nm)));}
/* datas de ocorrência de um previsto dentro de [de,ate]; sem recorrência = a própria data se cair no período.
   A série COMEÇA NA ÂNCORA e só anda PRA FRENTE — nunca rebobina. Âncora = próxima ocorrência devida:
   mover o vencimento de jul→ago (ex.: mensalidade negociada) tira julho da série de verdade. */
function ocorrencias(base,rec,de,ate){base=(base||"").slice(0,10);if(!base)return[];const kind=recKind(rec);
  if(!kind)return(base>=de&&base<=ate)?[base]:[];
  let cur=base,g=0;while(cur<de&&g++<600)cur=stepRec(cur,kind,1);
  const out=[];g=0;while(cur<=ate&&g++<600){out.push(cur);cur=stepRec(cur,kind,1);}return out;}
const isPrevAberto=st=>{st=(st||"").toLowerCase();return st!=="pago"&&st!=="recebido"&&st!=="cancelado";};
/* saldo somado só das contas correntes da visão (cartões contam à parte) */
function saldoCorrente(){const b=contaSaldos();let t=0;b.forEach((v,n)=>{if(!isCartaoConta(n))t+=v;});return t;}
/* números do módulo Visão Geral p/ o período [de,ate] */
function overviewNumbers(de,ate){
  const inR=iso=>{iso=(iso||"").slice(0,10);return iso>=de&&iso<=ate;};
  const mv=(DB.movimentos||[]).filter(m=>!isForaAgregado(m)&&inR(m.data));
  const entReal=mv.filter(m=>m.sentido==="Entrada").reduce((s,m)=>s+m.valor,0);
  const saiReal=mv.filter(m=>m.sentido==="Saída").reduce((s,m)=>s+m.valor,0);
  let entAReal=0;(DB.aReceber||[]).forEach(a=>{if(!isPrevAberto(a.status))return;entAReal+=ocorrencias(a.dataPrevista,a.recorrencia,de,ate).length*Number(a.previstoLiquido||0);});
  let saiAReal=0;(DB.contasPagar||[]).forEach(c=>{if(!isPrevAberto(c.status)||isPrevFatura(c))return;saiAReal+=ocorrencias(c.vencimento,c.recorrencia,de,ate).length*Number(c.valor||0);});
  const saldoTotal=saldoCorrente();
  return{saldoTotal,entReal,saiReal,entAReal,saiAReal,entPrev:entReal+entAReal,saiPrev:saiReal+saiAReal,proj:saldoTotal+entAReal-saiAReal};}
/* Drill da Visão Geral (30/08): todo KPI abre a lista exata que soma aquele número —
   mesma régua do Modo Financeiro ("cliquei nos valores e não leva a nada" era queixa). */
function ovDrill(kind,fil,ord){
  fil=fil||"all";ord=ord||"data";   // fil: all|real|prev · ord: data|valor
  const{de,ate}=ovBounds();const items=[];
  DB.movimentos.filter(m=>!isForaAgregado(m)&&(m.data||"").slice(0,10)>=de&&(m.data||"").slice(0,10)<=ate&&(kind==="ent"?m.sentido==="Entrada":m.sentido==="Saída"))
    .forEach(m=>items.push({d:m.data,desc:m.descricao,extra:[m.categoria,m.banco].filter(Boolean).join(" · "),v:m.valor,prev:false,_row:m._row}));
  if(kind==="ent")(DB.aReceber||[]).forEach(a=>{if(!isPrevAberto(a.status))return;ocorrencias(a.dataPrevista,a.recorrencia,de,ate).forEach(d=>items.push({d,desc:a.linha,extra:"a realizar"+(a.recorrencia?" · "+a.recorrencia:""),v:Number(a.previstoLiquido||0),prev:true}));});
  else(DB.contasPagar||[]).forEach(c=>{if(!isPrevAberto(c.status)||isPrevFatura(c))return;ocorrencias(c.vencimento,c.recorrencia,de,ate).forEach(d=>items.push({d,desc:c.descricao,extra:"a realizar"+(c.recorrencia?" · "+c.recorrencia:""),v:Number(c.valor||0),prev:true}));});
  const vis=items.filter(x=>fil==="all"||(fil==="prev"?x.prev:!x.prev));
  if(ord==="valor")vis.sort((a,b)=>b.v-a.v);else vis.sort((a,b)=>a.d<b.d?1:-1);
  const tot=vis.reduce((s,x)=>s+x.v,0);
  const chip=(on,lbl,f2,o2)=>`<button class="btn sm ${on?"":"ghost"}" style="padding:3px 10px;font-size:11px" onclick="this.closest('div[style*=fixed]')?.remove();ovDrill('${kind}','${f2}','${o2}')">${lbl}</button>`;
  const barra=`<div style="display:flex;gap:6px;flex-wrap:wrap;margin:2px 0 8px">
    ${chip(fil==="all","Tudo","all",ord)}${chip(fil==="real","Realizado","real",ord)}${chip(fil==="prev","Previsto","prev",ord)}
    <span style="width:10px"></span>${chip(ord==="data","por data",fil,"data")}${chip(ord==="valor","por valor",fil,"valor")}</div>`;
  const linhas=barra.replace(/</,"<tr><td colspan=4 style='padding:4px 8px'><").replace(/<\/div>$/,"</div></td></tr>")+
    (vis.map(x=>_drillRow((x.d||"").slice(8,10)+"/"+(x.d||"").slice(5,7),
    (x._row?`<span style="cursor:pointer;text-decoration:underline dotted" onclick="this.closest('div[style*=fixed]')?.remove();editMovimento('${x._row}')">${esc(x.desc||"")}</span>`:esc(x.desc||""))+(x.prev?' <span class="pj" style="font-size:10px;font-weight:700">previsto</span>':""),
    esc(x.extra||""),fmtBRL(x.v),x.prev?"":(kind==="ent"?"in":"out"))).join("")||`<tr><td colspan="4" class="sub" style="padding:12px">Nada com esse filtro.</td></tr>`);
  drillModal(kind==="ent"?"📈 Entradas do período":"📉 Saídas do período",`${vis.length} item(ns) · total do filtro <b>${fmtBRL(tot)}</b>`,linhas);
}

/* ===== Lançamento (modal pro: tipo, transferência, categoria por tipo, criar no fluxo) ===== */
/* ---- tags nos movimentos: exibir chips + atribuir (join movimento_tags) ---- */
function movTagsHtml(m){const ids=m.tags||[];if(!ids.length)return"";return ids.map(id=>{const t=tagById(id);if(!t)return"";const c=t.cor||"#2f6f5e";return `<span class="chip" style="background:${esc(c)}22;border:1px solid ${esc(c)}66;color:${esc(c)};padding:1px 6px;font-size:11px">🏷️ ${esc(t.nome)}</span>`;}).filter(Boolean).join(" ");}
async function tagAssign(movId,tagId){const{error}=await sb.from("movimento_tags").insert({movimento_id:movId,tag_id:tagId});if(error)throw new Error(error.message);}
async function tagUnassign(movId,tagId){const{error}=await sb.from("movimento_tags").delete().eq("movimento_id",movId).eq("tag_id",tagId);if(error)throw new Error(error.message);}
function tagPicker(bg,m){const body=bg.querySelector(".body");if(!body)return;
  const wrap=el(`<div class="fld"><label>🏷️ Tags</label><div id="tagPick" style="display:flex;flex-wrap:wrap;gap:6px"></div></div>`);body.appendChild(wrap);
  const host=wrap.querySelector("#tagPick");
  const render=()=>{const cur=new Set(m.tags||[]);
    host.innerHTML=(DB.tags||[]).length
      ?(DB.tags||[]).slice().sort((a,b)=>String(a.nome).localeCompare(String(b.nome),"pt")).map(t=>{const on=cur.has(t.id),c=t.cor||"#2f6f5e";
        return `<button type="button" class="chip" data-tid="${t.id}" style="cursor:pointer;${on?`background:${esc(c)};border:1px solid ${esc(c)};color:#fff`:`background:transparent;border:1px solid var(--border);color:var(--muted)`}">${on?"✓ ":""}${esc(t.nome)}</button>`;}).join("")
      :`<span class="sub" style="margin:0">Nenhuma tag criada. Crie em Configurações › 🏷️ Tags.</span>`;
    host.querySelectorAll("[data-tid]").forEach(btn=>btn.onclick=async()=>{const tid=btn.dataset.tid,has=(m.tags||[]).includes(tid);btn.disabled=true;
      try{if(MODE==="live"){if(has)await tagUnassign(m._row,tid);else await tagAssign(m._row,tid);}
        m.tags=has?(m.tags||[]).filter(x=>x!==tid):[...(m.tags||[]),tid];
        if(CURRENT==="movimentos"&&typeof window._movFilter==="function"){try{window._movFilter();}catch(e){}}
      }catch(e){toast("Erro: "+e.message);}render();});};
  render();
}
/* ---- resumo "por tag": gasto por tag CRUZANDO todas as visões (RLS entrega só o que a pessoa vê) ---- */
function verMovsPorTag(tagId){route("movimentos");setTimeout(()=>{const fg=document.querySelector("#fg");if(fg){fg.value=tagId;if(window._movFilter)window._movFilter();}},60);}
async function resumoPorTag(){
  let rows=[];
  try{
    if(MODE==="live"){const{data,error}=await sb.from("movimento_tags").select("tag_id, movimentos(valor,sinal)");if(error)throw new Error(error.message);rows=data||[];}
    else{DB.movimentos.forEach(m=>(m.tags||[]).forEach(tid=>rows.push({tag_id:tid,movimentos:{valor:m.valor,sinal:m.sentido==="Entrada"?1:-1}})));}
  }catch(e){toast("Erro: "+e.message);return;}
  const agg=new Map();
  rows.forEach(r=>{const mv=r.movimentos;if(!mv)return;const e=agg.get(r.tag_id)||{saidas:0,entradas:0,n:0};if(Number(mv.sinal)===1)e.entradas+=Number(mv.valor||0);else e.saidas+=Number(mv.valor||0);e.n++;agg.set(r.tag_id,e);});
  const items=[...agg.entries()].map(([tid,v])=>({t:tagById(tid),...v})).filter(x=>x.t).sort((a,b)=>b.saidas-a.saidas);
  const tot=items.reduce((s,x)=>s+x.saidas,0);
  const body=items.length?items.map(x=>{const pct=tot?x.saidas/tot*100:0,c=x.t.cor||"#2f6f5e";
    return `<div class="mvb" onclick="document.querySelectorAll('.modal-bg').forEach(b=>b.remove());verMovsPorTag('${x.t.id}')" role="button" tabindex="0"><div class="mvb-top"><span class="mvb-nm">🏷️ ${esc(x.t.nome)}</span><span class="mvb-val num">${fmtBRL(x.saidas)} <i>${pct.toFixed(0)}%</i></span></div><div class="bar"><i style="width:${Math.max(2,pct)}%;background:${esc(c)}"></i></div><div class="sub" style="margin:2px 0 0;font-size:11px">${x.n} lançtos${x.entradas?` · entradas ${fmtBRL(x.entradas)}`:""}</div></div>`;}).join("")
    :`<div class="empty">Nenhuma transação com tag ainda. Marque tags no editar de um movimento.</div>`;
  modal({title:"🏷️ Gasto por tag",extraHTML:`<div class="sub" style="margin:0 0 8px">Soma das saídas por tag, <b>cruzando todas as visões</b> que você enxerga — independente da conta de onde saiu.${tot?` Total marcado: <b>${fmtBRL(tot)}</b>.`:""}</div><div style="display:flex;flex-direction:column;gap:8px;max-height:56vh;overflow:auto">${body}</div>`});
}
function movimentoModal(m){ const isEdit=!!m; m=m||{data:todayISO(),sentido:"Saída",valor:"",descricao:"",banco:bancoOpts()[0]||"",categoria:""};
  const banco=bancoOpts();
  const bg=el(`<div class="modal-bg"><div class="modal"><h3>${isEdit?"Editar":"Novo"} lançamento</h3><div class="body">
    <div class="fld"><label>Tipo</label><div class="seg" id="seg"><button data-v="Entrada">Entrada</button><button data-v="Saída">Saída</button><button data-v="Transferência">Transferência</button></div></div>
    <div class="fld"><label>Data</label><input id="f_data" type="date" value="${esc(m.data)}"></div>
    <div class="fld"><label>Descrição</label><input id="f_desc" value="${esc(m.descricao)}" placeholder="Ex.: Pix MJM Contabilidade"></div>
    <div class="fld"><label>Valor (R$)</label><input id="f_val" type="number" step="0.01" value="${esc(m.valor)}"></div>
    <div id="single">
      <div class="fld"><label>Conta / Banco</label><select id="f_banco">${banco.map(b=>`<option ${b===m.banco?"selected":""}>${esc(b)}</option>`).join("")}</select></div>
      <div class="fld"><label>Categoria <span class="link" id="lkSug">✨ sugerir</span></label><div id="catSlot"></div></div>
    </div>
    <div id="transf" style="display:none">
      <div class="fld"><label>Conta origem</label><select id="f_orig">${banco.map(b=>`<option ${b===m.banco?"selected":""}>${esc(b)}</option>`).join("")}</select></div>
      <div class="fld"><label>Conta destino</label><select id="f_dest">${(()=>{const pre=banco.find(b=>b!==m.banco)||banco[1]||"";return banco.map(b=>`<option ${b===pre?"selected":""}>${esc(b)}</option>`).join("");})()}</select></div>
      <div class="sub">Não afeta resultado: cria saída na origem + entrada no destino, marcadas como internas.</div>
    </div>
  </div><div class="foot">${isEdit?`<button class="btn danger" id="del" style="margin-right:auto">Excluir</button>`:""}<button class="btn ghost" id="cancel">Cancelar</button><button class="btn" id="save">Salvar</button></div></div></div>`);
  document.body.appendChild(bg); const close=()=>bg.remove();
  if(isEdit){anexSection(bg,"movimento",m._row,m.visao||VISAO);entField(bg,"movimentos",m._row,m.descricao);tagPicker(bg,m);}   /* comprovantes + contato + tags */
  bg.querySelector("#cancel").onclick=close; bg.addEventListener("click",e=>{if(e.target===bg)close();});
  let sentido=isEdit?m.sentido:"Saída";
  const renderCat=()=>{const slot=bg.querySelector("#catSlot");const tipo=sentido==="Entrada"?"entrada":"saida";const g=catGroupsByTipo(tipo);
    const sel=v=>v===m.categoria?"selected":"";
    let html=`<select id="f_cat"><option value="" ${m.categoria?"":"selected"}>—</option>`;
    if(g.gerais.length)html+=`<optgroup label="Categorias">${g.gerais.map(v=>`<option value="${esc(v)}" ${sel(v)}>${esc(v)}</option>`).join("")}</optgroup>`;
    g.withSubs.forEach(grp=>{html+=`<optgroup label="${esc(grp.parent)}">`+grp.items.map((v,i)=>`<option value="${esc(v)}" ${sel(v)}>${i===0?esc(v):"› "+esc((v.split(" › ")[1]||v))}</option>`).join("")+`</optgroup>`;});
    html+=`<option value="__new">＋ Nova categoria…</option></select>`;
    slot.innerHTML=html;
    bg.querySelector("#f_cat").onchange=async e=>{if(e.target.value==="__new"){const nome=await promptCat(tipo);renderCat();if(nome){const s=bg.querySelector("#f_cat");if([...s.options].some(o=>o.value===nome))s.value=nome;}}};};
  const apply=()=>{bg.querySelectorAll("#seg button").forEach(b=>b.classList.toggle("on",b.dataset.v===sentido));bg.querySelector("#single").style.display=sentido==="Transferência"?"none":"block";bg.querySelector("#transf").style.display=sentido==="Transferência"?"block":"none";if(sentido!=="Transferência")renderCat();};
  bg.querySelectorAll("#seg button").forEach(b=>b.onclick=()=>{sentido=b.dataset.v;apply();}); apply();
  bg.querySelector("#f_desc").addEventListener("blur",()=>{if(sentido!=="Transferência"){const s=bg.querySelector("#f_cat");if(s&&!s.value){const sug=suggestCategoria(bg.querySelector("#f_desc").value);const op=sug&&[...s.options].find(o=>o.value===sug||o.value.endsWith("› "+sug));if(op)s.value=op.value;}}});
  bg.querySelector("#lkSug").onclick=()=>{const s=bg.querySelector("#f_cat");if(!s)return;const sug=suggestCategoria(bg.querySelector("#f_desc").value);const op=sug&&[...s.options].find(o=>o.value===sug||o.value.endsWith("› "+sug));if(op){s.value=op.value;toast("Sugerido: "+sug);}else toast("Sem sugestão");};
  if(isEdit)bg.querySelector("#del").onclick=()=>{close();delMovimento(m._row);};
  bg.querySelector("#save").onclick=async()=>{const data=bg.querySelector("#f_data").value,desc=bg.querySelector("#f_desc").value.trim(),val=Math.abs(+bg.querySelector("#f_val").value||0);
    if(!desc){toast("Descrição obrigatória");return;}if(!val){toast("Valor obrigatório");return;}const btn=bg.querySelector("#save");btn.disabled=true;
    try{ if(sentido==="Transferência"){const o=bg.querySelector("#f_orig").value,d=bg.querySelector("#f_dest").value;if(o===d){toast("Origem = destino");btn.disabled=false;return;}
        await lancarMov({data,descricao:`Transf entre contas → ${d}: ${desc}`,valor:val,sentido:"Saída",banco:o,categoria:"Transferência PJ→PF"});
        await lancarMov({data,descricao:`Transf entre contas ← ${o}: ${desc}`,valor:val,sentido:"Entrada",banco:d,categoria:"Transferência (entrada)"});toast("Transferência lançada");}
      else{const banco2=bg.querySelector("#f_banco").value,cat=bg.querySelector("#f_cat").value==="__new"?"":bg.querySelector("#f_cat").value;
        if(isEdit){await editMovSave(m._row,{data,descricao:desc,valor:val,sentido,banco:banco2,categoria:leafCat(cat)});toast("Atualizado");}else{await lancarMov({data,descricao:desc,valor:val,sentido,banco:banco2,categoria:leafCat(cat)});toast("Lançado");}}
      close();await afterWrite();}catch(e){toast("Erro: "+e.message);btn.disabled=false;}};
}
function promptCat(tipo){return new Promise(res=>{modal({title:"Nova categoria ("+(tipo==="entrada"?"entrada":"saída")+")",fields:[{name:"nome",label:"Nome"}],saveLabel:"Criar",onSave:async v=>{if(!v.nome){toast("Nome");return false;}let id="cat"+Date.now();if(MODE==="live")id=await sbIns("categorias",{nome:v.nome,tipo:tipo,visao:VISAO});DB.categorias.push({id,nome:v.nome,tipo:tipo,parent_id:null});toast("Categoria criada");res(v.nome);}});});}
async function lancarMov(o){const row={_row:"d"+Date.now()+Math.random().toString(36).slice(2,5),data:o.data,descricao:o.descricao,valor:o.valor,sentido:o.sentido,banco:o.banco,categoria:o.categoria,mes:+o.data.slice(5,7),ano:+o.data.slice(0,4)};if(MODE==="live")row._row=await sbIns("movimentos",{data:o.data,descricao_original:o.descricao,descricao_limpa:o.descricao,valor:o.valor,sinal:o.sentido==="Entrada"?1:-1,conta_id:contaId(o.banco),categoria_id:catId(o.categoria),visao:VISAO,hash:uhash(o.descricao+o.data+o.valor)});DB.movimentos.unshift(row);}
async function editMovSave(row,o){const m=DB.movimentos.find(x=>x._row===row);if(MODE==="live")await sbUpd("movimentos",row,{data:o.data,descricao_original:o.descricao,descricao_limpa:o.descricao,valor:o.valor,sinal:o.sentido==="Entrada"?1:-1,conta_id:contaId(o.banco),categoria_id:catId(o.categoria)});if(m)Object.assign(m,{...o,mes:+o.data.slice(5,7),ano:+o.data.slice(0,4)});}
function editMovimento(row){const m=DB.movimentos.find(x=>x._row===row);if(m)movimentoModal(m);}
function addMovimento(){if(isAll()){toast("O consolidado é leitura — escolha uma visão pra lançar");return;}movimentoModal(null);}
async function delMovimento(row){if(MODE==="live"){try{await sbDel("movimentos",row);}catch(e){toast("Erro: "+e.message);return;}}DB.movimentos=DB.movimentos.filter(x=>x._row!==row);toast("Excluído");await afterWrite();}

/* ===== Dashboard ===== */
function periodControls(){let inner="";if(PERIOD.mode==="ano")inner=`<select id="pAno">${yearsList().map(y=>`<option ${y===PERIOD.ano?"selected":""}>${y}</option>`).join("")}</select>`;else if(PERIOD.mode==="mes")inner=`<select id="pAno">${yearsList().map(y=>`<option ${y===PERIOD.ano?"selected":""}>${y}</option>`).join("")}</select><select id="pMes">${ML.map((n,i)=>`<option value="${i+1}" ${i+1===PERIOD.mes?"selected":""}>${n}</option>`).join("")}</select>`;else inner=`<input id="pDe" type="date" value="${PERIOD.de}"> <span class="sub">até</span> <input id="pAte" type="date" value="${PERIOD.ate}">`;
  return`<div class="controls"><select id="pMode"><option value="ano" ${PERIOD.mode==="ano"?"selected":""}>Por ano</option><option value="mes" ${PERIOD.mode==="mes"?"selected":""}>Por mês</option><option value="range" ${PERIOD.mode==="range"?"selected":""}>Período</option></select>${inner}</div>`;}
function wirePeriod(){$("#pMode").onchange=e=>{PERIOD.mode=e.target.value;if(PERIOD.mode==="mes"&&!PERIOD.mes)PERIOD.mes=new Date().getMonth()+1;viewDashboard();};if($("#pAno"))$("#pAno").onchange=e=>{PERIOD.ano=+e.target.value;viewDashboard();};if($("#pMes"))$("#pMes").onchange=e=>{PERIOD.mes=+e.target.value;viewDashboard();};if($("#pDe"))$("#pDe").onchange=e=>{PERIOD.de=e.target.value;viewDashboard();};if($("#pAte"))$("#pAte").onchange=e=>{PERIOD.ate=e.target.value;viewDashboard();};}
let _charts=[];
/* conta ARQUIVADA (ativo=false) some dos painéis, mas nada é apagado: se ela ainda tiver
   movimento, o laço abaixo recria a linha — o que some é só a conta zerada que só polui. */
function contaSaldos(){const b=new Map();const ativas=(DB.contas||[]).filter(c=>c.ativo!==false);ativas.forEach(c=>b.set(c.nome,0));DB.movimentos.forEach(m=>{const n=m.banco||"(sem conta)";b.set(n,(b.get(n)||0)+(m.sentido==="Entrada"?m.valor:-m.valor));});ativas.forEach(c=>{if(c.saldo_atual!=null)b.set(c.nome,Number(c.saldo_atual));});return b;}
/* Selo de frescor (30/08): saldo de banco com mais de 3 dias = feed parado — o aviso
   fica VERMELHO em vez de o número parecer atual (era a queixa do "dado errado na tela"). */
function frescorDias(ts){try{const d=Math.floor((Date.now()-new Date(ts).getTime())/864e5);return Number.isFinite(d)?d:null;}catch(e){return null;}}
function frescorTag(ts){if(!ts)return'';const d=frescorDias(ts);let f='';try{f=new Date(ts).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});}catch(e){}
  if(d!=null&&d>3)return`<div style="font-size:9px;margin-top:2px;color:#dc2626;font-weight:700">⚠️ feed parado · dado de ${f} (${d}d)</div>`;
  return`<div style="font-size:9px;opacity:.55;margin-top:2px">🔄 saldo do banco · ${f}</div>`;}
function contasPanel(){const b=contaSaldos();
  const meta=new Map((DB.contas||[]).filter(c=>c.saldo_atual!=null).map(c=>[c.nome,c.saldo_atualizado_em]));
  const items=[...b.entries()].filter(([n,v])=>!isCartaoConta(n)&&(v!==0||n!=="(sem conta)")).sort((a,b)=>b[1]-a[1]);
  if(!items.length)return'';
  const rows=items.map(([n,v])=>{const tag=frescorTag(meta.get(n));return`<div style="flex:1;min-width:150px;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:10px 12px"><div class="sub" style="font-size:11px">🏦 ${esc(n)}</div><div class="${v>=0?'in':'out'}" style="font-size:17px;font-weight:600">${fmtBRL(v)}</div>${tag}</div>`;}).join("");
  return`<div class="panel"><h2 style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">Saldo por conta <button class="btn ghost sm" id="btnSyncBancos" onclick="syncBancos()" title="Pede refresh no Pluggy e dispara os syncs (Pluggy + Inter PJ) agora">⚡ Atualizar bancos</button></h2><div style="display:flex;flex-wrap:wrap;gap:10px">${rows}</div></div>`;}
function cartoesPanel(){const b=contaSaldos();
  const items=[...b.entries()].filter(([n,v])=>isCartaoConta(n)).sort((a,b)=>a[1]-b[1]);
  if(!items.length)return'';
  const meta=new Map((DB.contas||[]).filter(c=>c.saldo_atual!=null).map(c=>[c.nome,c.saldo_atualizado_em]));
  const rows=items.map(([n,v])=>`<div style="flex:1;min-width:150px;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:10px 12px"><div class="sub" style="font-size:11px">💳 ${esc(n)}</div><div class="${v>=0?'in':'out'}" style="font-size:17px;font-weight:600">${fmtBRL(v)}</div>${frescorTag(meta.get(n))}</div>`).join("");
  return`<div class="panel"><h2>Cartões <span class="link" onclick="route('cartoes')" style="font-weight:600">ver faturas ›</span></h2><div style="display:flex;flex-wrap:wrap;gap:10px">${rows}</div></div>`;}
function entSaiDetail(o){const r=(lbl,v,cls)=>`<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border)"><span class="sub">${lbl}</span><b class="${cls||''}" style="font-variant-numeric:tabular-nums">${fmtBRL(v)}</b></div>`;
  return`<div class="grid2" style="grid-template-columns:1fr 1fr">
    <div class="panel"><h2>📈 Entradas</h2>${r('Realizado',o.entReal,'in')}${r('A realizar',o.entAReal)}<div style="display:flex;justify-content:space-between;padding:8px 0 0"><span class="sub" style="font-weight:600">Previsto</span><b>${fmtBRL(o.entPrev)}</b></div></div>
    <div class="panel"><h2>📉 Saídas</h2>${r('Realizado',o.saiReal,'out')}${r('A realizar',o.saiAReal)}<div style="display:flex;justify-content:space-between;padding:8px 0 0"><span class="sub" style="font-weight:600">Previsto</span><b>${fmtBRL(o.saiPrev)}</b></div></div>
  </div>`;}
function stepMes(n){let m=PERIOD.mes+n,y=PERIOD.ano;while(m>12){m-=12;y++;}while(m<1){m+=12;y--;}PERIOD.mes=m;PERIOD.ano=y;viewDashboard();}
function stepAno(n){PERIOD.ano=(PERIOD.ano||new Date().getFullYear())+n;viewDashboard();}
function setOvMode(m){PERIOD.mode=m;const d=new Date();if(m==="mes"&&!PERIOD.mes){PERIOD.ano=d.getFullYear();PERIOD.mes=d.getMonth()+1;}if(m==="ano"&&!PERIOD.ano)PERIOD.ano=d.getFullYear();if(m==="range"){if(!PERIOD.de)PERIOD.de=(PERIOD.ano||d.getFullYear())+"-01-01";if(!PERIOD.ate)PERIOD.ate=todayISO();}viewDashboard();}
function ovSetDe(v){PERIOD.de=v;viewDashboard();}function ovSetAte(v){PERIOD.ate=v;viewDashboard();}
/* limites do período do módulo Visão Geral a partir do PERIOD (mes|ano|range) */
function ovBounds(){if(PERIOD.mode==="ano")return{de:PERIOD.ano+"-01-01",ate:PERIOD.ano+"-12-31"};if(PERIOD.mode==="range")return{de:PERIOD.de||"0000-01-01",ate:PERIOD.ate||"9999-12-31"};return monthBounds(PERIOD.ano,PERIOD.mes);}
function ovPeriodLabel(){if(PERIOD.mode==="ano")return"ano "+PERIOD.ano;if(PERIOD.mode==="range")return(PERIOD.de?fmtDate(PERIOD.de):"início")+" → "+(PERIOD.ate?fmtDate(PERIOD.ate):"hoje");return"01–"+pad2(daysInMonth(PERIOD.ano,PERIOD.mes))+"/"+pad2(PERIOD.mes);}
function ovPeriodBar(){
  const seg=(m,lbl)=>`<button class="btn ${PERIOD.mode===m?'':'ghost'} sm" onclick="setOvMode('${m}')">${lbl}</button>`;
  let inner="";
  if(PERIOD.mode==="ano")inner=`<button class="btn ghost sm" onclick="stepAno(-1)" aria-label="Ano anterior">‹</button><div style="font-weight:660;min-width:70px;text-align:center">${PERIOD.ano}</div><button class="btn ghost sm" onclick="stepAno(1)" aria-label="Próximo ano">›</button>`;
  else if(PERIOD.mode==="range")inner=`<input type="date" value="${PERIOD.de||''}" onchange="ovSetDe(this.value)"> <span class="sub">até</span> <input type="date" value="${PERIOD.ate||''}" onchange="ovSetAte(this.value)">`;
  else inner=`<button class="btn ghost sm" onclick="stepMes(-1)" aria-label="Mês anterior">‹</button><div style="font-weight:660;min-width:120px;text-align:center">${ML[PERIOD.mes-1]} ${PERIOD.ano}</div><button class="btn ghost sm" onclick="stepMes(1)" aria-label="Próximo mês">›</button>`;
  return`<div class="controls" style="justify-content:flex-start;align-items:center;gap:12px;flex-wrap:wrap"><div class="seg" style="display:inline-flex;gap:4px">${seg('mes','Mês')}${seg('ano','Ano')}${seg('range','Período')}</div><div style="display:flex;align-items:center;gap:8px">${inner}<span class="sub">${ovPeriodLabel()}</span></div></div>`;}
/* painel "Suas visões" (modo Todas): saldo + alertas por visão, clique abre a visão.
   É o corpo da antiga tela Central, agora dentro da Visão Geral consolidada. */
function visoesPanel(){if(!isAll())return"";
  const hoje=todayISO();
  const rows=PROFILES.map(p=>{
    const contas=(DB.contas||[]).filter(c=>c.visao===p.code&&c.ativo!==false);
    let saldo=0;contas.forEach(c=>{if(c.tipo!=="cartao"&&!/cart/i.test(c.nome||"")&&c.saldo_atual!=null&&!/fora do extrato/i.test(c.nome||""))saldo+=Number(c.saldo_atual);});
    const atras=(DB.contasPagar||[]).filter(x=>x.visao===p.code&&isPrevAberto(x.status)&&(x.vencimento||"")<hoje);
    const atrasTot=atras.reduce((s,x)=>s+Number(x.valor||0),0);
    const feedN=contas.filter(c=>c.saldo_atual!=null&&!/fora do extrato/i.test(c.nome||"")&&(frescorDias(c.saldo_atualizado_em)||0)>3).length;
    return{p,saldo,atrasN:atras.length,atrasTot,feedN};});
  const card=r=>`<div onclick="setVisao('${r.p.code}')" role="button" tabindex="0" style="cursor:pointer;display:flex;align-items:center;gap:12px;background:var(--card);border:1px solid var(--border);border-radius:12px;padding:11px 14px">
    <div style="font-size:19px;width:24px;text-align:center">${r.p.icon}</div>
    <div style="flex:1;min-width:0"><div style="font-weight:660">${esc(r.p.label)}</div><div class="sub" style="font-size:11px;margin:0">${esc(r.p.grupo==="Pessoal"?"Vida":r.p.grupo)}</div>
      ${(r.atrasN||r.feedN)?`<div style="font-size:10.5px;font-weight:700;margin-top:2px">${r.atrasN?`<span style="color:#dc2626">⚠️ ${r.atrasN} atrasada(s) · ${fmtK(r.atrasTot)}</span>`:""}${r.atrasN&&r.feedN?" · ":""}${r.feedN?`<span style="color:#d97706">🔌 feed parado (${r.feedN})</span>`:""}</div>`:""}</div>
    <div style="text-align:right"><div class="${r.saldo>=0?'in':'out'}" style="font-weight:700;font-variant-numeric:tabular-nums">${fmtBRL(r.saldo)}</div><div class="sub" style="font-size:10px;margin:0">abrir ›</div></div>
  </div>`;
  const g=(nome,arr)=>arr.length?`<div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:700;margin:12px 2px 6px">${nome}</div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:8px">${arr.map(card).join("")}</div>`:"";
  return`<div class="panel"><h2>Suas visões <span class="sub" style="font-weight:400;font-size:11px">toque pra abrir o detalhe</span></h2>
    ${g("Negócios",rows.filter(r=>r.p.grupo==="Negócios"))}${g("Vida",rows.filter(r=>r.p.grupo==="Pessoal"))}</div>`;
}
function viewDashboard(){
  {const d=new Date();if(!PERIOD.ano)PERIOD.ano=d.getFullYear();if(!PERIOD.mes)PERIOD.mes=d.getMonth()+1;}
  if(!["mes","ano","range"].includes(PERIOD.mode))PERIOD.mode="mes";
  if(IS_PESSOAL)return viewDashFamilia();
  const{de,ate}=ovBounds();
  const o=overviewNumbers(de,ate);
  const recentes=(DB.movimentos||[]).filter(m=>{const d=(m.data||'').slice(0,10);return d>=de&&d<=ate;}).sort((a,b)=>b.data.localeCompare(a.data)).slice(0,12);
  $("#view").innerHTML=`
  <div class="row">
    <div style="display:flex;align-items:center;gap:12px">
      ${isAll()?"":`<button class="btn ghost sm" onclick="route('central')" title="Ver todas as visões">‹ Todas</button>`}
      <div><h1>${isAll()?"Central financeira":esc(VISAO_LABEL)}</h1><div class="sub">${isAll()?"Consolidado de todas as visões · transferências entre suas visões não contam 2×":"Visão geral · "+esc(CUR_PROFILE.grupo)}</div></div>
    </div>
    ${isAll()?"":`<button class="btn" onclick="addMovimento()">+ Lançar</button>`}
  </div>
  ${ovPeriodBar()}
  <div class="kpis">
    <div class="kpi"><div class="lbl">💰 Saldo total</div><div class="val ${o.saldoTotal>=0?'in':'out'}">${fmtBRL(o.saldoTotal)}</div><div class="hint">${isAll()?"contas correntes de todas as visões":"contas da visão"}</div></div>
    <div class="kpi" onclick="ovDrill('ent')" style="cursor:pointer" title="Ver a lista que soma este valor"><div class="lbl">📈 Entradas (previsto)</div><div class="val in">${fmtBRL(o.entPrev)}</div><div class="hint">realizado ${fmtK(o.entReal)} · a realizar ${fmtK(o.entAReal)} · toque p/ ver ›</div></div>
    <div class="kpi" onclick="ovDrill('sai')" style="cursor:pointer" title="Ver a lista que soma este valor"><div class="lbl">📉 Saídas (previsto)</div><div class="val out">${fmtBRL(o.saiPrev)}</div><div class="hint">realizado ${fmtK(o.saiReal)} · a realizar ${fmtK(o.saiAReal)} · toque p/ ver ›</div></div>
    <div class="kpi"><div class="lbl">🔮 Saldo projetado</div><div class="val ${o.proj>=0?'in':'out'}">${fmtBRL(o.proj)}</div><div class="hint">saldo + receber − pagar</div></div>
  </div>
  ${visoesPanel()}
  ${entSaiDetail(o)}
  ${contasPanel()}
  ${cartoesPanel()}
  <div class="panel"><h2 style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">Movimentos do período ${selBtn()}</h2>${miniMov(recentes)}</div>`;
}
/* ===== Home da visão Pessoal (Família/Jucá): o mês como unidade mental =====
   Hero = SOBRA PREVISTA DO MÊS (renda prevista − saídas previstas), triagem
   "Precisa de você" (atrasados + próximos), envelopes de variáveis do Orçamento. */
function viewDashFamilia(){
  const{de,ate}=ovBounds();
  const o=overviewNumbers(de,ate);
  const sobra=o.entPrev-o.saiPrev;
  const pct=o.entPrev>0?Math.min(100,Math.round(o.saiPrev/o.entPrev*100)):(o.saiPrev>0?100:0);
  const disp=saldoCorrente();
  let cartTot=0;contaSaldos().forEach((v,n)=>{if(isCartaoConta(n))cartTot+=v;});
  /* triagem: atrasados primeiro, depois os próximos — no máx. 4 itens */
  const ag=ctAgenda();
  const precisa=[...ag.late,...ag.next].slice(0,4);
  const hoje=ctHoje();
  const pRow=x=>{const isRec=x.tipo==="receber",late=x.data<hoje;
    return`<div class="ct-row" onclick="route('contas')" role="button" tabindex="0" style="cursor:pointer">
    <div class="dot-day"><b class="${late?"out":""}">${x.data.slice(8,10)}</b><span>${ML[+x.data.slice(5,7)-1]}</span></div>
    <div class="ct-main"><b>${esc(x.desc)}</b><small>${late?`<span class="ct-latebdg">${isRec?"atrasado":"em atraso"}</span>`:(isRec?`<span class="chip" style="background:var(--chip);color:#0f766e">a receber</span>`:"a pagar")}</small></div>
    <div class="ct-val num ${isRec?"in":(late?"out":"")}">${fmtBRL(x.valor)}</div></div>`;};
  /* envelopes: Orçamento do mês (categorias de saída com teto definido) */
  const omes=(PERIOD.mode==="mes")?PERIOD.ano+"-"+pad2(PERIOD.mes):ctHoje().slice(0,7);
  const mb=loadOrc()[omes]||{};
  const realByCat={};DB.movimentos.filter(m=>monthKey(m.data)===omes&&!isForaAgregado(m)&&m.sentido==="Saída").forEach(m=>{realByCat[m.categoria||"—"]=(realByCat[m.categoria||"—"]||0)+m.valor;});
  const envCats=DB.categorias.filter(c=>!c.parent_id&&c.tipo==="saida"&&+(mb[c.nome]||0)>0);
  let envTotPlan=0,envTotReal=0;
  const envRows=envCats.slice(0,6).map(c=>{const plan=+mb[c.nome],real=realByCat[c.nome]||0;envTotPlan+=plan;envTotReal+=real;
    const p=Math.min(100,plan?real/plan*100:0),over=real>plan;
    return`<div style="display:flex;justify-content:space-between;font-size:12.5px;font-weight:600;margin-top:10px"><span>${esc(c.nome)}</span><span class="num ${over?"out":""}">${fmtK(real)} / ${fmtK(plan)}</span></div><div class="bar"><i style="width:${p}%;background:${over?"var(--warning)":"var(--primary)"}"></i></div>`;}).join("");
  const recentes=(DB.movimentos||[]).filter(m=>{const d=(m.data||"").slice(0,10);return d>=de&&d<=ate;}).sort((a,b)=>b.data.localeCompare(a.data)).slice(0,12);
  $("#view").innerHTML=`
  <div class="row">
    <div style="display:flex;align-items:center;gap:12px">
      <button class="btn ghost sm" onclick="route('central')" title="Voltar à Central">‹ Central</button>
      <div><h1>${esc(VISAO_LABEL)}</h1><div class="sub">Painel da casa · ${ovPeriodLabel()}</div></div>
    </div>
    <button class="btn" onclick="addMovimento()">+ Lançar</button>
  </div>
  ${ovPeriodBar()}
  <div class="panel fam-hero">
    <div class="lbl">Sobra prevista ${PERIOD.mode==="mes"?"do mês":"do período"}</div>
    <div class="val ${sobra>=0?"":"neg"}">${fmtBRL(sobra)}</div>
    <div class="hint">entra <span class="link" onclick="ovDrill('ent')">${fmtK(o.entPrev)} ›</span> − compromissos e gastos <span class="link" onclick="ovDrill('sai')">${fmtK(o.saiPrev)} ›</span> (real ${fmtK(o.saiReal)} · a realizar ${fmtK(o.saiAReal)})</div>
    <div class="bar fam-bar"><i style="width:${pct}%"></i></div>
    <div class="hint">${pct}% do previsto de saídas já comprometido</div>
  </div>
  <div class="kpis" style="grid-template-columns:repeat(2,1fr)">
    <div class="kpi"><div class="lbl">💰 Disponível agora</div><div class="val ${disp>=0?"in":"out"}">${fmtBRL(disp)}</div><div class="hint">contas correntes da visão</div></div>
    <div class="kpi" onclick="route('cartoes')" style="cursor:pointer"><div class="lbl">💳 Cartões</div><div class="val ${cartTot>=0?"in":"out"}">${fmtBRL(cartTot)}</div><div class="hint">ver faturas ›</div></div>
  </div>
  <div class="panel">
    <h2>Precisa de você <span class="link" onclick="route('contas')" style="font-weight:600">contas do mês ›</span></h2>
    ${precisa.length?precisa.map(pRow).join(""):`<div class="empty">Nada pendente por agora 🎉 — compromissos em dia.</div>`}
  </div>
  ${envCats.length?`<div class="panel"><h2>Variáveis do mês <span class="sub" style="font-weight:400">${fmtK(envTotReal)} / ${fmtK(envTotPlan)} · <span class="link" onclick="route('orcamento')">ajustar ›</span></span></h2>${envRows}</div>`
    :`<div class="panel"><h2>Variáveis do mês</h2><div class="sub">Defina tetos por categoria (mercado, lazer, transporte…) no <span class="link" onclick="route('orcamento')">Orçamento ›</span> e acompanhe as barras aqui.</div></div>`}
  ${contasPanel()}
  ${cartoesPanel()}
  <div class="panel"><h2 style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap"><span>Movimentos do período <span class="link" onclick="route('movimentos')" style="font-weight:600">ver todos ›</span></span>${selBtn()}</h2>${miniMov(recentes)}</div>`;
}
function miniMov(rows){if(!rows.length)return`<div class="empty">Sem movimentos.</div>`;
  return bulkBar()+`<table><thead><tr>${SELMODE?"<th></th>":""}<th>Data</th><th>Descrição</th><th>Categoria</th><th>Banco</th><th class="num">Valor</th></tr></thead><tbody>${rows.map(m=>`<tr style="cursor:pointer${SEL.has(m._row)?";background:var(--chip,#eef2ff)":""}" onclick="${SELMODE?`selRow('${m._row}')`:`editMovimento('${m._row}')`}">${SELMODE?`<td><input type="checkbox" class="cb" ${SEL.has(m._row)?"checked":""} onclick="event.stopPropagation();selRow('${m._row}')"></td>`:""}<td>${fmtDate(m.data)}</td><td>${esc(m.descricao)}</td><td>${m.categoria?`<span class="chip">${esc(m.categoria)}</span>`:`<span class="chip none">sem cat.</span>`}</td><td>${esc(m.banco)}</td><td class="num ${m.sentido==='Entrada'?'in':'out'}">${m.sentido==='Entrada'?'+':'−'} ${fmtBRL(m.valor)}</td></tr>`).join("")}</tbody></table>`;}

/* ===== Movimentos (multi-seleção + edição inline) ===== */
function toggleSel(id){if(SEL.has(id))SEL.delete(id);else SEL.add(id);renderMovTable(true);}
/* ===== Seleção em massa UNIVERSAL (31/08, pedido dele): toda lista de movimentos
   (Visão Geral, Movimentos mobile, fatura do cartão) ganha modo selecionar +
   barra de ações (categoria / tags / excluir). O motor é um só: SEL + SELMODE. ===== */
let SELMODE=false;
function selToggleMode(){SELMODE=!SELMODE;SEL.clear();(ROUTES[CURRENT]||viewDashboard)();}
function selBtn(){return `<button class="btn ${SELMODE?"":"ghost"} sm" onclick="selToggleMode()" style="white-space:nowrap">${SELMODE?"✕ cancelar seleção":"☑ selecionar"}</button>`;}
function selRow(id){if(SEL.has(id))SEL.delete(id);else SEL.add(id);
  if(CURRENT==="movimentos")renderMovTable(true);else (ROUTES[CURRENT]||viewDashboard)();}   /* em Movimentos só redesenha a lista — não perde os filtros */
function bulkBar(){if(!SEL.size)return SELMODE?`<div class="sub" style="margin:6px 0">Toque nos lançamentos pra selecionar.</div>`:"";
  return `<div class="bulkbar" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;position:sticky;top:6px;z-index:20;background:var(--card);border:1px solid var(--primary);border-radius:10px;padding:8px 10px;margin:6px 0;box-shadow:var(--shadow)"><b style="white-space:nowrap">${SEL.size} sel.</b><button class="btn sm" onclick="bulkCategorizar()">Categoria</button><button class="btn sm" onclick="bulkTags()">🏷️ Tags</button><button class="btn sm danger" onclick="bulkExcluir()">Excluir</button><button class="btn sm ghost" onclick="SEL.clear();(ROUTES[CURRENT]||viewDashboard)()" style="margin-left:auto">Limpar</button></div>`;}
function bulkTags(){
  const tags=(DB.tags||[]).slice().sort((a,b)=>String(a.nome).localeCompare(String(b.nome),"pt"));
  if(!tags.length){toast("Crie tags em Configurações › 🏷️ Tags primeiro");return;}
  modal({title:`🏷️ Tags em ${SEL.size} movimento(s)`,fields:[
    {name:"tag",label:"Tag",type:"select",options:tags.map(t=>({v:t.id,l:t.nome}))},
    {name:"acao",label:"Ação",type:"select",options:[{v:"add",l:"Aplicar a todos"},{v:"rm",l:"Remover de todos"}]}],
    onSave:async v=>{const ids=[...SEL];let n=0;
      for(const id of ids){const m=DB.movimentos.find(x=>x._row===id);if(!m)continue;const has=(m.tags||[]).includes(v.tag);
        try{
          if(v.acao==="add"&&!has){if(MODE==="live")await tagAssign(id,v.tag);m.tags=[...(m.tags||[]),v.tag];n++;}
          else if(v.acao==="rm"&&has){if(MODE==="live")await tagUnassign(id,v.tag);m.tags=(m.tags||[]).filter(x=>x!==v.tag);n++;}
        }catch(e){}}
      toast(`${n} movimento(s) atualizados`);SEL.clear();(ROUTES[CURRENT]||viewDashboard)();}});
}
let _movRows=[],_movPieRows=[],_movChart=null,MV_MES;   // MV_MES: undefined=não iniciado · null=Tudo · "YYYY-MM"
const isCartaoConta=n=>{const c=(DB.contas||[]).find(x=>x.nome===n);return c?c.tipo==="cartao":/cart/i.test(n||"");};
function mvMes(n){MV_MES=MV_MES?addMonth(MV_MES,n):todayISO().slice(0,7);viewMovimentos();}
function mvMesTudo(){MV_MES=MV_MES?null:todayISO().slice(0,7);viewMovimentos();}
function viewMovimentos(){
  if(MV_MES===undefined)MV_MES=IS_PESSOAL?todayISO().slice(0,7):null;   // Família abre no mês atual; Negócios mantém "Tudo"
  const isMob=window.matchMedia&&window.matchMedia("(max-width:920px)").matches;
  const vizPanel=IS_PESSOAL
    ?`<div class="panel" style="${isMob?"margin-top:12px":"margin-bottom:12px"}"><h2>Pra onde foi o dinheiro <span class="sub" id="barsHint" style="font-weight:400"></span></h2><div id="movBars"></div></div>`
    :`<div class="panel" style="${isMob?"margin-top:12px":"margin-bottom:12px"}"><h2>Despesas por categoria <span class="sub" id="pieHint" style="font-weight:400"></span></h2><canvas id="chMovCat" height="${isMob?220:100}"></canvas></div>`;
  $("#view").innerHTML=`<div class="row"><div><h1>Movimentos</h1><div class="sub">toque em categoria/valor pra editar na própria linha</div></div>
   <div style="display:flex;gap:8px;flex-wrap:wrap">${isMob?selBtn():""}<button class="btn soft" onclick="resumoPorTag()">🏷️ Por tag</button><button class="btn soft" onclick="autoCategorizar()">✨ Auto-categorizar</button><button class="btn" onclick="addMovimento()">+ Lançar</button></div></div>
  <div class="controls" style="align-items:center">
    <button class="btn ghost sm" onclick="mvMes(-1)" aria-label="Mês anterior">‹</button>
    <div style="font-weight:660;min-width:88px;text-align:center">${MV_MES?mkLabel(MV_MES):"Tudo"}</div>
    <button class="btn ghost sm" onclick="mvMes(1)" aria-label="Próximo mês">›</button>
    <button class="btn ${MV_MES?"ghost":""} sm" onclick="mvMesTudo()">${MV_MES?"Ver tudo":"Mês atual"}</button>
    <span class="sub" id="movSum" style="margin-left:auto"></span>
  </div>
  <div class="controls"><input id="fq" placeholder="Buscar..." style="min-width:180px"><select id="fs"><option value="">Sentido: todos</option><option>Entrada</option><option>Saída</option></select><select id="ft"><option value="">Conta/Cartão: tudo</option><option value="conta">🏦 Só contas</option><option value="cartao">💳 Só cartões</option></select><select id="fb"><option value="">Banco: todos</option>${bancoOpts().map(b=>`<option>${esc(b)}</option>`).join("")}</select><select id="fg"><option value="">🏷️ Tag: todas</option>${(DB.tags||[]).slice().sort((a,b)=>String(a.nome).localeCompare(String(b.nome),"pt")).map(t=>`<option value="${t.id}">${esc(t.nome)}</option>`).join("")}</select><select id="fc"><option value="">Categoria: todas</option><option value="__none">⚠ Sem categoria</option>${[...new Set(DB.movimentos.map(m=>m.categoria).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt")).map(c=>`<option>${esc(c)}</option>`).join("")}</select><button id="fnone" class="btn ghost sm" onclick="mvSemCat()" style="white-space:nowrap">⚠ sem categoria</button></div>
  ${isMob?`<div id="movWrap"></div>${vizPanel}`:`${vizPanel}<div id="movWrap"></div>`}`;
  window._movFilter=()=>{const q=$("#fq").value.toLowerCase(),s=$("#fs").value,b=$("#fb").value,c=$("#fc").value,t=$("#ft").value,g=$("#fg").value;
    const base=DB.movimentos.filter(m=>(!MV_MES||monthKey(m.data)===MV_MES)&&(!q||m.descricao.toLowerCase().includes(q))&&(!s||m.sentido===s)&&(!b||m.banco===b)&&(!t||(t==="cartao"?isCartaoConta(m.banco):!isCartaoConta(m.banco)))&&(!g||(m.tags||[]).includes(g)));
    _movPieRows=base;
    const ent=base.filter(m=>m.sentido==="Entrada"&&!isForaAgregado(m)).reduce((x,m)=>x+m.valor,0),sai=base.filter(m=>m.sentido==="Saída"&&!isForaAgregado(m)).reduce((x,m)=>x+m.valor,0);
    const sum=$("#movSum");if(sum)sum.innerHTML=`<b class="in">+ ${fmtK(ent)}</b> · <b class="out">− ${fmtK(sai)}</b> · saldo <b class="${ent-sai>=0?"in":"out"}">${fmtBRL(ent-sai)}</b>`;
    /* fila do "sem categoria" sempre à vista (a opção no select ficava enterrada) */
    const nNone=base.filter(m=>!m.categoria).length,bt=$("#fnone");
    if(bt){bt.innerHTML="⚠ sem categoria"+(nNone?` <b>(${nNone})</b>`:"");bt.className="btn sm "+(c==="__none"?"":"ghost");bt.style.display=(nNone||c==="__none")?"":"none";}
    _movRows=base.filter(m=>(c===""||(c==="__none"?!m.categoria:m.categoria===c))).sort((a,b)=>b.data.localeCompare(a.data));renderMovTable();};
  const _filtD=debounce(window._movFilter,180);
  $("#fq").oninput=_filtD;
  ["fs","fb","fc","ft","fg"].forEach(id=>{$("#"+id).onchange=window._movFilter;});window._movFilter();
}
/* ranking de barras (visão Pessoal): top 8 + "outras" — legível onde a pizza de 25 fatias não era */
const MV_PAL=["#3b5bdb","#16a34a","#d97706","#dc2626","#7c3aed","#0891b2","#db2777","#65a30d"];
function renderMovBars(){const box=$("#movBars");if(!box)return;
  const cm=new Map();_movPieRows.filter(m=>m.sentido==="Saída"&&!isForaAgregado(m)).forEach(m=>cm.set(m.categoria||"sem cat.",(cm.get(m.categoria||"sem cat.")||0)+m.valor));
  const cats=[...cm.entries()].sort((a,b)=>b[1]-a[1]);
  const hint=$("#barsHint");if(hint)hint.textContent=cats.length?`— ${cats.length} categorias · toque numa barra p/ filtrar`:"";
  if(!cats.length){box.innerHTML=`<div class="empty">Sem despesas no filtro.</div>`;return;}
  const tot=cats.reduce((s,c)=>s+c[1],0),top=cats.slice(0,8),rest=cats.slice(8),restTot=rest.reduce((s,c)=>s+c[1],0);
  const fcSel=$("#fc"),cur=fcSel?fcSel.value:"";
  const bar=(nome,val,cor,extra)=>{const pct=tot?val/tot*100:0;const on=cur&&(cur===nome||(nome==="sem cat."&&cur==="__none"));
    return`<div class="mvb ${on?"on":""}" onclick="${extra||`mvBarPick('${esc(nome).replace(/'/g,"\\'")}')`}" role="button" tabindex="0">
      <div class="mvb-top"><span class="mvb-nm">${esc(nome)}</span><span class="mvb-val num">${fmtBRL(val)} <i>${pct.toFixed(0)}%</i></span></div>
      <div class="bar"><i style="width:${Math.max(2,pct)}%;background:${cor}"></i></div></div>`;};
  box.innerHTML=top.map((c,i)=>bar(c[0],c[1],c[0]==="sem cat."?"#d97706":MV_PAL[i%MV_PAL.length])).join("")
    +(rest.length?bar(`outras (${rest.length})`,restTot,"#94a3b8","mvBarRest()"):"");
  window._mvRest=rest;
}
function mvBarPick(nome){const s=$("#fc");if(!s)return;const v=nome==="sem cat."?"__none":nome;s.value=(s.value===v)?"":v;window._movFilter();}
function mvSemCat(){const s=$("#fc");if(!s)return;s.value=s.value==="__none"?"":"__none";window._movFilter();}
function mvBarRest(){const rest=window._mvRest||[];const tot=rest.reduce((s,c)=>s+c[1],0);
  drillModal("Outras categorias",`${rest.length} categoria(s) · total <b>${fmtBRL(tot)}</b>`,
    rest.map(c=>`<tr style="border-top:1px solid var(--border);cursor:pointer" onclick="mvBarPick('${esc(c[0]).replace(/'/g,"\\'")}');this.closest('div[style*=fixed]')?.remove()"><td style="padding:6px 8px">${esc(c[0])}</td><td class="num" style="text-align:right;padding:6px 8px">${fmtBRL(c[1])}</td></tr>`).join(""));}
function renderMovViz(){if(IS_PESSOAL)renderMovBars();else renderMovPie();}
function renderMovPie(){const cv=$("#chMovCat");if(!cv)return;if(_movChart){_movChart.destroy();_movChart=null;}
  const cm=new Map();_movPieRows.filter(m=>m.sentido==="Saída"&&!isForaAgregado(m)).forEach(m=>cm.set(m.categoria||"sem cat.",(cm.get(m.categoria||"sem cat.")||0)+m.valor));
  const cats=[...cm.entries()].sort((a,b)=>b[1]-a[1]);
  if($("#pieHint"))$("#pieHint").textContent=cats.length?`— ${cats.length} categorias · clique p/ abrir`:"— sem despesas no filtro";
  if(!cats.length)return;
  const pal=["#3b5bdb","#16a34a","#d97706","#dc2626","#7c3aed","#0891b2","#db2777","#65a30d","#ea580c","#0d9488","#9333ea","#475569"];
  _movChart=new Chart(cv,{type:"doughnut",data:{labels:cats.map(c=>c[0]),datasets:[{data:cats.map(c=>c[1]),backgroundColor:cats.map((c,i)=>pal[i%pal.length])}]},
    options:{onClick:(e,el)=>{if(el&&el.length){const cat=cats[el[0].index][0];const sel=$("#fc");if(sel){sel.value=(cat==="sem cat.")?"__none":cat;window._movFilter();}}},
    plugins:{legend:{position:"right",labels:{font:{size:10},boxWidth:12}},tooltip:{callbacks:{label:c=>c.label+": "+fmtBRL(c.parsed)}}}}});
}
/* rótulo humano de dia (Hoje/Ontem/dd Mmm) p/ os cards mobile */
function dayLabel(d){const t=todayISO();if(d===t)return"Hoje";if(d===addDaysISO(t,-1))return"Ontem";return d.slice(8,10)+" "+ML[+d.slice(5,7)-1];}
function renderMovTable(skipPie){const wrap=$("#movWrap");if(!wrap)return;
  const isMobile=window.matchMedia&&window.matchMedia("(max-width:920px)").matches;
  if(isMobile){ /* mobile: linha vira card, agrupado por dia, categoria/valor editáveis no toque */
    const days=[];let last=null;
    _movRows.forEach(m=>{if(m.data!==last){days.push({d:m.data,rows:[]});last=m.data;}days[days.length-1].rows.push(m);});
    wrap.innerHTML=bulkBar()+(days.map(g=>{const net=g.rows.reduce((s,m)=>s+(m.sentido==="Entrada"?m.valor:-m.valor),0);
      return`<div class="secttl"><span>${dayLabel(g.d)}</span><span class="num ${net>=0?"in":"out"}">${net>=0?"+":"−"} ${fmtBRL(Math.abs(net))}</span></div>
      <div class="panel ct-grp">${g.rows.map(m=>{const on=SEL.has(m._row);
        return`<div class="ct-row" onclick="${SELMODE?`selRow('${m._row}')`:`editMovimento('${m._row}')`}" role="button" tabindex="0" style="${on?"box-shadow:0 0 0 2px var(--primary) inset;border-radius:10px":""}">
        ${SELMODE?`<input type="checkbox" class="cb" ${on?"checked":""} onclick="event.stopPropagation();selRow('${m._row}')" style="margin-right:4px">`:""}
        <div class="ct-main"><b>${esc(m.descricao)}</b><small><span class="chip ${m.categoria?"":"none"}" onclick="${SELMODE?`event.stopPropagation();selRow('${m._row}')`:`event.stopPropagation();mvCatEdit('${m._row}',this)`}" title="Tocar pra trocar a categoria">${esc(m.categoria||"definir categoria")}</span> · ${esc(m.banco)}${movTagsHtml(m)?" · "+movTagsHtml(m):""}</small></div>
        <div class="ct-val num ${m.sentido==="Entrada"?"in":"out"}" onclick="${SELMODE?`event.stopPropagation();selRow('${m._row}')`:`event.stopPropagation();mvValEdit('${m._row}',this)`}" title="Tocar pra editar o valor">${m.sentido==="Entrada"?"+":"−"} ${fmtBRL(m.valor)}</div>
      </div>`;}).join("")}</div>`;}).join("")||`<div class="empty">Nenhum.</div>`)+`<div class="sub">${_movRows.length} resultado(s)</div>`;
    if(!skipPie)renderMovViz();return;}
  let html=`<div class="panel" style="padding:0;overflow:hidden"><table><thead><tr><th></th><th>Data</th><th>Descrição</th><th>Categoria</th><th>Banco</th><th class="num">Valor</th></tr></thead><tbody>${
   _movRows.map(m=>`<tr class="${SEL.has(m._row)?'sel':''}">
     <td onclick="toggleSel('${m._row}')"><input type="checkbox" class="cb" ${SEL.has(m._row)?'checked':''}></td>
     <td class="editable" onclick="inlineEdit(this,'${m._row}','data')">${fmtDate(m.data)}</td>
     <td style="cursor:pointer" onclick="editMovimento('${m._row}')"><b style="font-weight:500">${esc(m.descricao)}</b>${movTagsHtml(m)?`<div style="margin-top:3px">${movTagsHtml(m)}</div>`:""}</td>
     <td class="editable" onclick="inlineEdit(this,'${m._row}','categoria')">${m.categoria?`<span class="chip">${esc(m.categoria)}</span>`:`<span class="chip none">sem cat.</span>`}</td>
     <td class="editable" onclick="inlineEdit(this,'${m._row}','banco')">${esc(m.banco)}</td>
     <td class="num editable ${m.sentido==='Entrada'?'in':'out'}" onclick="inlineEdit(this,'${m._row}','valor')">${m.sentido==='Entrada'?'+':'−'} ${fmtBRL(m.valor)}</td></tr>`).join("")||`<tr><td colspan="6"><div class="empty">Nenhum.</div></td></tr>`}
   </tbody></table></div><div class="sub">${_movRows.length} resultado(s)</div>`;
  if(SEL.size)html+=`<div class="bulkbar"><b>${SEL.size} selecionado(s)</b><button class="btn sm" onclick="bulkCategorizar()">Definir categoria</button><button class="btn sm" onclick="bulkTags()">🏷️ Tags</button><button class="btn sm danger" onclick="bulkExcluir()">Excluir</button><button class="btn sm ghost" onclick="SEL.clear();renderMovTable(true)" style="margin-left:auto">Limpar</button></div>`;
  wrap.innerHTML=html;
  if(!skipPie)renderMovViz();
}
function inlineEdit(td,row,field){ if(td.classList.contains("editing"))return; const m=DB.movimentos.find(x=>x._row===row); if(!m)return;
  td.classList.add("editing"); let inp;
  if(field==="categoria"){inp=document.createElement("select");catOptsByTipo(m.sentido==="Entrada"?"entrada":"saida").filter(o=>o!=="__new").forEach(o=>{const op=document.createElement("option");op.value=o;op.textContent=o||"—";if(o===m.categoria)op.selected=true;inp.appendChild(op);});}
  else if(field==="banco"){inp=document.createElement("select");bancoOpts().forEach(o=>{const op=document.createElement("option");op.value=o;op.textContent=o;if(o===m.banco)op.selected=true;inp.appendChild(op);});}
  else if(field==="data"){inp=document.createElement("input");inp.type="date";inp.value=m.data;}
  else{inp=document.createElement("input");inp.type="number";inp.step="0.01";inp.value=m.valor;}
  td.innerHTML="";td.appendChild(inp);inp.focus();let done=false;
  const commit=async()=>{if(done)return;done=true;td.classList.remove("editing");await saveMovField(row,field,inp.value);renderMovTable();};
  inp.addEventListener("blur",commit);inp.addEventListener("keydown",e=>{if(e.key==="Enter")inp.blur();if(e.key==="Escape"){done=true;td.classList.remove("editing");renderMovTable();}});
}
/* grava um campo de movimento (compartilhado pela edição inline desktop e pelos cards mobile) */
async function saveMovField(row,field,v){const m=DB.movimentos.find(x=>x._row===row);if(!m)return;
  if(field==="valor")v=Math.abs(+v||0);if(field==="categoria")v=leafCat(v);
  if(String(m[field])===String(v))return;
  try{
    if(field==="categoria"){if(MODE==="live")await sbUpd("movimentos",row,{categoria_id:catId(v)});m.categoria=v;}
    else if(field==="banco"){if(MODE==="live")await sbUpd("movimentos",row,{conta_id:contaId(v)});m.banco=v;}
    else if(field==="data"){if(MODE==="live")await sbUpd("movimentos",row,{data:v});m.data=v;m.mes=+v.slice(5,7);m.ano=+v.slice(0,4);}
    else{if(MODE==="live")await sbUpd("movimentos",row,{valor:v});m.valor=v;}
    toast("Salvo");
  }catch(e){toast("Erro: "+e.message);}}
/* cards mobile: trocar categoria na própria linha */
function mvCatEdit(row,el){const m=DB.movimentos.find(x=>x._row===row);if(!m||el.querySelector("select"))return;
  const sel=document.createElement("select");sel.className="ct-inl";
  catOptsByTipo(m.sentido==="Entrada"?"entrada":"saida").filter(o=>o!=="__new").forEach(o=>{const op=document.createElement("option");op.value=o;op.textContent=o||"—";if(o===m.categoria)op.selected=true;sel.appendChild(op);});
  el.replaceWith(sel);sel.focus();let done=false;
  const commit=async()=>{if(done)return;done=true;await saveMovField(row,"categoria",sel.value);renderMovTable(true);};
  sel.addEventListener("change",commit);sel.addEventListener("blur",commit);}
/* cards mobile: editar valor na própria linha */
function mvValEdit(row,el){const m=DB.movimentos.find(x=>x._row===row);if(!m||el.querySelector("input"))return;
  const inp=document.createElement("input");inp.type="number";inp.step="0.01";inp.value=m.valor;inp.className="ct-inl";
  el.textContent="";el.appendChild(inp);inp.focus();let done=false;
  const commit=async()=>{if(done)return;done=true;await saveMovField(row,"valor",inp.value);renderMovTable(true);};
  inp.addEventListener("blur",commit);inp.addEventListener("keydown",e=>{if(e.key==="Enter")inp.blur();if(e.key==="Escape"){done=true;renderMovTable(true);}});}
function bulkCategorizar(){modal({title:`Categoria em ${SEL.size} movimento(s)`,fields:[{name:"categoria",label:"Categoria",type:"select",options:catOpts()}],onSave:async v=>{const cat=leafCat(v.categoria),cid=catId(v.categoria),ids=[...SEL];if(MODE==="live")for(const id of ids)await sbUpd("movimentos",id,{categoria_id:cid});ids.forEach(id=>{const m=DB.movimentos.find(x=>x._row===id);if(m)m.categoria=cat;});toast(`${ids.length} categorizados`);await afterWrite();}});}
function bulkExcluir(){confirmDel(`Excluir ${SEL.size} movimento(s)?`,async()=>{const ids=[...SEL];if(MODE==="live")for(const id of ids){try{await sbDel("movimentos",id);}catch(e){}}DB.movimentos=DB.movimentos.filter(x=>!SEL.has(x._row));toast(`${ids.length} excluídos`);await afterWrite();});}
/* ===== Auto-categorizar v2: aprende do PRÓPRIO histórico + preview editável =====
   O v1 só usava regras/glossário (vazios nas visões pessoais → "não funciona").
   Agora: além das regras, todo movimento JÁ categorizado ensina — descrição
   normalizada (sem números) vira chave de 3/2/1 tokens → categoria mais frequente. */
const mvNorm=s=>String(s||"").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\d+/g," ").replace(/[^A-Z ]/g," ").replace(/\s+/g," ").trim();
function histSuggester(){
  const maps=[new Map(),new Map(),new Map()];   // chaves de 3, 2 e 1 token(s)
  DB.movimentos.filter(m=>m.categoria&&!isForaAgregado(m)).forEach(m=>{
    const tk=mvNorm(m.descricao).split(" ").filter(Boolean);if(!tk.length)return;
    [3,2,1].forEach((n,i)=>{if(tk.length<n)return;const k=m.sentido+"|"+tk.slice(0,n).join(" ");
      let e=maps[i].get(k);if(!e){e={};maps[i].set(k,e);}e[m.categoria]=(e[m.categoria]||0)+1;});
  });
  const best=e=>Object.entries(e).sort((a,b)=>b[1]-a[1])[0];
  return m=>{const tk=mvNorm(m.descricao).split(" ").filter(Boolean);if(!tk.length)return"";
    for(let i=0;i<3;i++){const n=[3,2,1][i];if(tk.length<n)continue;const e=maps[i].get(m.sentido+"|"+tk.slice(0,n).join(" "));
      if(e){const b=best(e);if(b&&(n>1||b[1]>=3))return b[0];}}   // 1 token só com 3+ confirmações (menos ruído)
    return"";};
}
function autoCategorizar(){
  const semCat=DB.movimentos.filter(m=>!m.categoria&&!isForaAgregado(m)&&(!MV_MES||monthKey(m.data)===MV_MES));
  if(!semCat.length){toast(MV_MES?"Nada sem categoria em "+mkLabel(MV_MES)+" — troque pra “Ver tudo” pra varrer o resto":"Tudo categorizado 🎉");return;}
  const hist=histSuggester();
  const itens=semCat.map(m=>({m,sug:suggestCategoria(m.descricao)||hist(m)})).sort((a,b)=>(b.sug?1:0)-(a.sug?1:0)||b.m.data.localeCompare(a.m.data));
  const nSug=itens.filter(x=>x.sug).length,CAP=150;
  const opts=tipo=>catOptsByTipo(tipo).filter(o=>o!=="__new");
  const rows=itens.slice(0,CAP).map((x,i)=>{const tipo=x.m.sentido==="Entrada"?"entrada":"saida";
    let list=opts(tipo);
    /* sugestão que é subcategoria casa pelo final; categoria fora da lista da visão entra como opção extra */
    const hit=x.sug?(list.find(o=>o===x.sug)||list.find(o=>o.endsWith("› "+x.sug))||""):"";
    if(x.sug&&!hit)list=[x.sug,...list];
    const selVal=hit||x.sug||"";
    return`<tr style="border-top:1px solid var(--border)">
    <td style="padding:6px 4px"><input type="checkbox" class="cb" data-ac="${i}" ${x.sug?"checked":""}></td>
    <td style="padding:6px 8px"><b style="font-weight:550;font-size:12.5px">${esc(x.m.descricao)}</b><div class="sub" style="font-size:10.5px;margin:0">${fmtDate(x.m.data)} · ${esc(x.m.banco)} · <span class="${x.m.sentido==="Entrada"?"in":"out"}">${fmtBRL(x.m.valor)}</span></div></td>
    <td style="padding:6px 4px"><select data-acsel="${i}" style="max-width:170px;font-size:12px">${list.map(o=>`<option value="${esc(o)}" ${o===selVal?"selected":""}>${o||"—"}</option>`).join("")}</select>${x.sug?`<div class="sub" style="font-size:9.5px;margin:1px 0 0">✨ do seu histórico</div>`:""}</td></tr>`;}).join("");
  const bg=el(`<div class="modal-bg"><div class="modal" style="width:min(680px,96vw)"><h3>✨ Auto-categorizar</h3><div class="body" style="gap:6px">
    <div class="sub" style="margin:0">${semCat.length} sem categoria${MV_MES?" em "+mkLabel(MV_MES):""} · <b>${nSug}</b> com sugestão aprendida do que você já categorizou. Revise e aplique — nada é gravado sem você confirmar.${semCat.length>CAP?` <b>(mostrando ${CAP}; rode de novo pro resto)</b>`:""}</div>
    <div style="overflow:auto;max-height:56vh"><table style="width:100%;border-collapse:collapse"><tbody>${rows}</tbody></table></div>
  </div><div class="foot"><button class="btn ghost" data-act="cancel">Cancelar</button><button class="btn" data-act="apply">Aplicar marcados</button></div></div></div>`);
  document.body.appendChild(bg);const close=()=>bg.remove();
  bg.addEventListener("click",e=>{if(e.target===bg)close();});bg.querySelector('[data-act=cancel]').onclick=close;
  bg.querySelector('[data-act=apply]').onclick=async()=>{
    const btn=bg.querySelector('[data-act=apply]');btn.disabled=true;let n=0;
    for(let i=0;i<Math.min(itens.length,CAP);i++){
      const ck=bg.querySelector(`[data-ac="${i}"]`),sel=bg.querySelector(`[data-acsel="${i}"]`);
      if(!ck||!ck.checked||!sel||!sel.value)continue;
      const cat=leafCat(sel.value);
      try{if(MODE==="live")await sbUpd("movimentos",itens[i].m._row,{categoria_id:catId(sel.value)});itens[i].m.categoria=cat;n++;}catch(e){}
    }
    close();toast(n?`${n} categorizados ✓`:"Nenhum marcado com categoria");if(n)await afterWrite();
  };
}

/* ===== Conciliação ===== */
function scoreMatch(m,valor,data){const dv=Math.abs(m.valor-valor);if(dv>Math.max(0.5,valor*0.02))return 0;const dd=data?Math.abs((new Date(m.data)-new Date(data))/864e5):999;if(dd>30)return 0;return 100-dd-(dv/Math.max(valor,1))*20;}
function conciliar(tipo,row){const it=(tipo==="pagar"?DB.contasPagar:DB.aReceber).find(x=>x._row===row);if(!it)return;const av=tipo==="pagar"?it.valor:it.previstoLiquido,ad=tipo==="pagar"?it.vencimento:it.dataPrevista,sd=tipo==="pagar"?"Saída":"Entrada";const cands=DB.movimentos.filter(m=>m.sentido===sd).map(m=>({m,s:scoreMatch(m,av,ad)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s).slice(0,8);
  const body=`<div class="sub" style="margin-bottom:8px">Conciliar <b>${esc(tipo==="pagar"?it.descricao:it.linha)}</b> (${fmtBRL(av)}) com:</div><div style="display:flex;flex-direction:column;gap:7px">${cands.length?cands.map(c=>`<label class="cand"><input type="radio" name="cand" value="${c.m._row}"><span style="flex:1">${fmtDate(c.m.data)} · ${esc(c.m.descricao)}</span><b class="${sd==="Entrada"?"in":"out"}">${fmtBRL(c.m.valor)}</b></label>`).join(""):'<div class="empty">Nenhum candidato. Importe o extrato.</div>'}</div>`;
  modal({title:"Conciliar",extraHTML:body,saveLabel:"Conciliar",onSave:async(v,bg)=>{const sel=bg.querySelector("input[name=cand]:checked");if(!sel){toast("Escolha um");return false;}const st=tipo==="pagar"?"pago":"recebido";if(MODE==="live")await sbUpd("previstos",row,{status:st});it.status=st;toast("Conciliado ✓");await afterWrite();}});}

/* ===== Pagar / Receber ===== */
function viewPagar(){const rows=DB.contasPagar;$("#view").innerHTML=`<div class="row"><div><h1>Contas a Pagar</h1><div class="sub">${rows.length} contas</div></div><button class="btn" onclick="addPagar()">+ Adicionar</button></div><div class="panel"><table><thead><tr><th>Vencimento</th><th>Descrição</th><th>Categoria</th><th>Banco</th><th class="num">Valor</th><th>Status</th><th></th></tr></thead><tbody>${rows.map(p=>`<tr><td style="cursor:pointer" onclick="editPagar('${p._row}')">${fmtDate(p.vencimento)}</td><td style="cursor:pointer" onclick="editPagar('${p._row}')">${esc(p.descricao)}${p.recorrencia?` <span class="chip">${esc(p.recorrencia)}</span>`:""}</td><td><span class="chip">${esc(p.categoria||"—")}</span></td><td>${esc(p.banco||"—")}</td><td class="num out">${fmtBRL(p.valor)}</td><td><span class="pill ${p.status}">${p.status}</span></td><td>${p.status==="aberto"?`<button class="btn ghost sm" onclick="conciliar('pagar','${p._row}')">Conciliar</button>`:""}</td></tr>`).join("")||`<tr><td colspan="7"><div class="empty">Nenhuma.</div></td></tr>`}</tbody></table></div>`;}
function addMonthsDate(iso,n){let[y,m,d]=iso.split("-").map(Number);m+=n;y+=Math.floor((m-1)/12);m=((m-1)%12+12)%12+1;const last=new Date(y,m,0).getDate();if(d>last)d=last;return`${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;}
function pagarFields(forAdd){const f=[{name:"descricao",label:"Descrição"},{name:"vencimento",label:"Vencimento",type:"date"},{name:"valor",label:"Valor (R$)",type:"number"},{name:"categoria",label:"Categoria",type:"select",options:catOptsByTipo("saida").filter(o=>o!=="__new")},{name:"banco",label:"Banco",type:"select",options:bancoOpts()},{name:"recorrencia",label:"Recorrência",type:"select",options:[{v:"",l:"Pontual"},"mensal","semanal","anual",{v:"parcelado",l:"Parcelado"}]}];if(forAdd)f.push({name:"parcelas",label:"Número de parcelas",type:"number",placeholder:"Ex.: 12",showIf:{field:"recorrencia",val:"parcelado"}});return f;}
async function addPagar(){if(isAll()){toast("O consolidado é leitura — escolha uma visão pra lançar");return;}modal({title:"Nova conta a pagar",fields:pagarFields(true),values:{vencimento:todayISO(),parcelas:2},onSave:async v=>{if(!v.descricao){toast("Descrição");return false;}
  const parcelado=v.recorrencia==="parcelado",N=parcelado?Math.max(1,Math.round(+v.parcelas||1)):1,rec=parcelado?"":v.recorrencia,valor=Math.abs(+v.valor||0),catNome=leafCat(v.categoria);
  for(let i=0;i<N;i++){const venc=N>1?addMonthsDate(v.vencimento,i):v.vencimento;const desc=N>1?`${v.descricao} (${i+1}/${N})`:v.descricao;
    const o={_row:"p"+Date.now()+i,descricao:desc,vencimento:venc,valor,categoria:catNome,banco:v.banco,status:"aberto",recorrencia:rec};
    if(MODE==="live")o._row=await sbIns("previstos",{descricao:desc,valor,vencimento:venc||null,tipo:"pagar",status:"aberto",visao:VISAO,recorrencia:rec||null,conta_id:contaId(v.banco),categoria_id:catId(v.categoria)});
    DB.contasPagar.push(o);}
  toast(N>1?`${N} parcelas lançadas`:"Lançada");await afterWrite();}});}
function editPagar(row){const p=DB.contasPagar.find(x=>x._row===row);if(!p)return;const mhEd=modal({title:"Editar conta a pagar",fields:[...pagarFields(true),{name:"status",label:"Status",type:"select",options:["aberto","pago","cancelado"]}],values:{...p,parcelas:2},extraHTML:`<button class="btn danger sm" style="align-self:flex-start" onclick="delPrev('contasPagar','${row}')">Excluir</button>`,onSave:async v=>{
  const parcelado=v.recorrencia==="parcelado",N=parcelado?Math.max(1,Math.round(+v.parcelas||1)):1,valor=Math.abs(+v.valor||0),base=String(v.descricao||"").replace(/\s*\(\d+\/\d+\)\s*$/,"");
  if(parcelado&&N>1){const d1=`${base} (1/${N})`;
    if(MODE==="live")await sbUpd("previstos",row,{descricao:d1,valor,vencimento:v.vencimento||null,status:v.status,recorrencia:null,conta_id:contaId(v.banco),categoria_id:catId(v.categoria)});
    Object.assign(p,{descricao:d1,vencimento:v.vencimento,valor,categoria:leafCat(v.categoria),banco:v.banco,status:v.status,recorrencia:""});
    for(let i=1;i<N;i++){const venc=addMonthsDate(v.vencimento,i),desc=`${base} (${i+1}/${N})`,o={_row:"p"+Date.now()+i,descricao:desc,vencimento:venc,valor,categoria:leafCat(v.categoria),banco:v.banco,status:"aberto",recorrencia:""};if(MODE==="live")o._row=await sbIns("previstos",{descricao:desc,valor,vencimento:venc||null,tipo:"pagar",status:"aberto",visao:VISAO,recorrencia:null,conta_id:contaId(v.banco),categoria_id:catId(v.categoria)});DB.contasPagar.push(o);}
    toast(`${N} parcelas geradas`);
  }else{const rec=parcelado?"":v.recorrencia,kindPg=recKind(rec);
    if(kindPg&&isPrevAberto(p.status)&&v.status==="pago"){
      /* pagar RECORRENTE pelo modal não mata a série: esta linha vira instância PAGA
         e nasce um template aberto na próxima ocorrência (mesmo modelo do ✓ das Contas do mês) */
      const nx=stepRec((v.vencimento||todayISO()).slice(0,10),kindPg,1);
      if(MODE==="live")await sbUpd("previstos",row,{descricao:v.descricao,valor,vencimento:v.vencimento||null,status:"pago",recorrencia:null,conta_id:contaId(v.banco),categoria_id:catId(v.categoria)});
      Object.assign(p,{descricao:v.descricao,vencimento:v.vencimento,valor,categoria:leafCat(v.categoria),banco:v.banco,status:"pago",recorrencia:""});
      const o={_row:"p"+Date.now(),descricao:v.descricao,vencimento:nx,valor,categoria:leafCat(v.categoria),banco:v.banco,status:"aberto",recorrencia:rec};
      if(MODE==="live")o._row=await sbIns("previstos",{descricao:v.descricao,valor,vencimento:nx,tipo:"pagar",status:"aberto",visao:(p.visao||VISAO),recorrencia:rec,conta_id:contaId(v.banco),categoria_id:catId(v.categoria)});
      DB.contasPagar.push(o);toast("Pago ✓ · próxima ocorrência criada pra "+fmtDate(nx));
    }else{if(MODE==="live")await sbUpd("previstos",row,{descricao:v.descricao,valor,vencimento:v.vencimento||null,status:v.status,recorrencia:rec||null,conta_id:contaId(v.banco),categoria_id:catId(v.categoria)});Object.assign(p,{descricao:v.descricao,vencimento:v.vencimento,valor,categoria:leafCat(v.categoria),banco:v.banco,status:v.status,recorrencia:rec});toast("Atualizado");}}
  await afterWrite();}});
  anexSection(mhEd.bg,"previsto",row,VISAO);entField(mhEd.bg,"previstos",row,p.descricao);}
function viewReceber(){const rows=DB.aReceber;$("#view").innerHTML=`<div class="row"><div><h1>A Receber</h1><div class="sub">${rows.length} previstos</div></div><button class="btn" onclick="addReceber()">+ Adicionar</button></div><div class="panel"><table><thead><tr><th>Data prevista</th><th>Descrição</th><th>Conta</th><th class="num">Previsto</th><th>Status</th><th></th></tr></thead><tbody>${rows.map(p=>`<tr><td style="cursor:pointer" onclick="editReceber('${p._row}')">${fmtDate(p.dataPrevista)}</td><td style="cursor:pointer" onclick="editReceber('${p._row}')">${esc(p.linha)}${p.recorrencia?` <span class="chip">${esc(p.recorrencia)}</span>`:""}</td><td>${esc(p.conta||"—")}</td><td class="num in">${fmtBRL(p.previstoLiquido)}</td><td><span class="pill ${p.status}">${p.status}</span></td><td>${p.status!=="recebido"?`<button class="btn ghost sm" onclick="conciliar('receber','${p._row}')">Conciliar</button>`:""}</td></tr>`).join("")||`<tr><td colspan="6"><div class="empty">Nenhum.</div></td></tr>`}</tbody></table></div>`;}
function receberFields(forAdd){const f=[{name:"descricao",label:"Descrição"},{name:"dataPrevista",label:"Data prevista",type:"date"},{name:"valor",label:"Valor (R$)",type:"number"},{name:"conta",label:"Conta destino",type:"select",options:bancoOpts()},{name:"recorrencia",label:"Recorrência",type:"select",options:[{v:"",l:"Pontual"},"mensal","semanal","anual",{v:"parcelado",l:"Parcelado"}]}];if(forAdd)f.push({name:"parcelas",label:"Número de parcelas",type:"number",placeholder:"Ex.: 12",showIf:{field:"recorrencia",val:"parcelado"}});return f;}
function addReceber(){if(isAll()){toast("O consolidado é leitura — escolha uma visão pra lançar");return;}modal({title:"Novo previsto a receber",fields:receberFields(true),values:{dataPrevista:todayISO(),parcelas:2},onSave:async v=>{if(!v.descricao){toast("Descrição");return false;}
  const parcelado=v.recorrencia==="parcelado",N=parcelado?Math.max(1,Math.round(+v.parcelas||1)):1,rec=parcelado?"":v.recorrencia,valor=Math.abs(+v.valor||0);
  for(let i=0;i<N;i++){const dt=N>1?addMonthsDate(v.dataPrevista,i):v.dataPrevista;const desc=N>1?`${v.descricao} (${i+1}/${N})`:v.descricao;
    const o={_row:"r"+Date.now()+i,linha:desc,dataPrevista:dt,previstoLiquido:valor,conta:v.conta,status:"aberto",recorrencia:rec};
    if(MODE==="live")o._row=await sbIns("previstos",{descricao:desc,valor,vencimento:dt||null,tipo:"receber",status:"aberto",visao:VISAO,recorrencia:rec||null,conta_id:contaId(v.conta)});
    DB.aReceber.push(o);}
  toast(N>1?`${N} parcelas lançadas`:"Lançado");await afterWrite();}});}
function editReceber(row){const p=DB.aReceber.find(x=>x._row===row);if(!p)return;modal({title:"Editar previsto",fields:[...receberFields(true),{name:"status",label:"Status",type:"select",options:["aberto","recebido","cancelado"]}],values:{descricao:p.linha,dataPrevista:p.dataPrevista,valor:p.previstoLiquido,conta:p.conta,status:p.status,recorrencia:p.recorrencia,parcelas:2},extraHTML:`<button class="btn danger sm" style="align-self:flex-start" onclick="delPrev('aReceber','${row}')">Excluir</button>`,onSave:async v=>{
  const parcelado=v.recorrencia==="parcelado",N=parcelado?Math.max(1,Math.round(+v.parcelas||1)):1,valor=Math.abs(+v.valor||0),base=String(v.descricao||"").replace(/\s*\(\d+\/\d+\)\s*$/,"");
  if(parcelado&&N>1){const d1=`${base} (1/${N})`;
    if(MODE==="live")await sbUpd("previstos",row,{descricao:d1,valor,vencimento:v.dataPrevista||null,status:v.status,recorrencia:null,conta_id:contaId(v.conta)});
    Object.assign(p,{linha:d1,dataPrevista:v.dataPrevista,previstoLiquido:valor,conta:v.conta,status:v.status,recorrencia:""});
    for(let i=1;i<N;i++){const dt=addMonthsDate(v.dataPrevista,i),desc=`${base} (${i+1}/${N})`,o={_row:"r"+Date.now()+i,linha:desc,dataPrevista:dt,previstoLiquido:valor,conta:v.conta,status:"aberto",recorrencia:""};if(MODE==="live")o._row=await sbIns("previstos",{descricao:desc,valor,vencimento:dt||null,tipo:"receber",status:"aberto",visao:VISAO,recorrencia:null,conta_id:contaId(v.conta)});DB.aReceber.push(o);}
    toast(`${N} parcelas geradas`);
  }else{const rec=parcelado?"":v.recorrencia,kindRc=recKind(rec);
    if(kindRc&&isPrevAberto(p.status)&&v.status==="recebido"){
      /* mesmo guard do pagar: recorrente recebida vira instância + novo template na próxima ocorrência */
      const nx=stepRec((v.dataPrevista||todayISO()).slice(0,10),kindRc,1);
      if(MODE==="live")await sbUpd("previstos",row,{descricao:v.descricao,valor,vencimento:v.dataPrevista||null,status:"recebido",recorrencia:null,conta_id:contaId(v.conta)});
      Object.assign(p,{linha:v.descricao,dataPrevista:v.dataPrevista,previstoLiquido:valor,conta:v.conta,status:"recebido",recorrencia:""});
      const o={_row:"r"+Date.now(),linha:v.descricao,dataPrevista:nx,previstoLiquido:valor,conta:v.conta,status:"aberto",recorrencia:rec};
      if(MODE==="live")o._row=await sbIns("previstos",{descricao:v.descricao,valor,vencimento:nx,tipo:"receber",status:"aberto",visao:(p.visao||VISAO),recorrencia:rec,conta_id:contaId(v.conta)});
      DB.aReceber.push(o);toast("Recebido ✓ · próxima ocorrência criada pra "+fmtDate(nx));
    }else{if(MODE==="live")await sbUpd("previstos",row,{descricao:v.descricao,valor,vencimento:v.dataPrevista||null,status:v.status,recorrencia:rec||null,conta_id:contaId(v.conta)});Object.assign(p,{linha:v.descricao,dataPrevista:v.dataPrevista,previstoLiquido:valor,conta:v.conta,status:v.status,recorrencia:rec});toast("Atualizado");}}
  await afterWrite();}});}
async function delPrev(coll,row){if(MODE==="live"){try{await sbDel("previstos",row);}catch(e){toast("Erro: "+e.message);return;}}DB[coll]=DB[coll].filter(x=>x._row!==row);document.querySelectorAll(".modal-bg").forEach(b=>b.remove());toast("Excluído");await afterWrite();}

/* ===== Contas do mês (visão Pessoal · Família/Jucá) =====
   Agenda mensal que FUNDE pagar+receber: recorrência materializa a linha do mês,
   ✓ de 1 toque dá baixa + lança o movimento (ou concilia com o que o extrato/Pluggy
   já trouxe). Recorrente pago: cria instância PAGA e ROLA a âncora do template pra
   próxima ocorrência — a projeção do fluxo nunca morre ao pagar (bug antigo). */
let CT={mes:null,tab:"pagar"},_ctRows=[],CT_UNDO={};
const ctHoje=()=>todayISO();
/* ocorrências do mês mk (abertas + pagas) da aba tab; âncora vencida de mês anterior entra no mês corrente */
function ctOcc(tab,mk){
  const de=mk+"-01",ate=mk+"-"+pad2(daysInMonth(+mk.slice(0,4),+mk.slice(5,7)));
  const tk=ctHoje().slice(0,7);
  const src=tab==="pagar"?DB.contasPagar:DB.aReceber;
  const paidSt=tab==="pagar"?"pago":"recebido";
  const out=[];
  (src||[]).forEach(p=>{
    const anchor=((tab==="pagar"?p.vencimento:p.dataPrevista)||"").slice(0,10);if(!anchor)return;
    const val=Number(tab==="pagar"?p.valor:p.previstoLiquido)||0;
    const desc=tab==="pagar"?p.descricao:p.linha;
    if(isPrevAberto(p.status)){
      ocorrencias(anchor,p.recorrencia,de,ate).forEach(d=>out.push({p,data:d,valor:val,desc,paid:false}));
      if(mk===tk&&anchor.slice(0,7)<mk)out.push({p,data:anchor,valor:val,desc,paid:false,late:true});
    }else if((p.status||"").toLowerCase()===paidSt&&anchor>=de&&anchor<=ate){
      out.push({p,data:anchor,valor:val,desc,paid:true});
    }
  });
  return out.sort((a,b)=>a.data<b.data?-1:1);
}
/* agenda unificada do mês corrente (pagar+receber abertos) — alimenta o "Precisa de você" da home */
function ctAgenda(){
  const tk=ctHoje().slice(0,7),hoje=ctHoje();
  const all=[...ctOcc("pagar",tk).map(x=>({...x,tipo:"pagar"})),...ctOcc("receber",tk).map(x=>({...x,tipo:"receber"}))].filter(x=>!x.paid);
  const late=all.filter(x=>x.data<hoje).sort((a,b)=>a.data<b.data?-1:1);
  const next=all.filter(x=>x.data>=hoje).sort((a,b)=>a.data<b.data?-1:1);
  return{late,next};
}
function viewContas(){
  if(!CT.mes)CT.mes=ctHoje().slice(0,7);
  const mk=CT.mes,tk=ctHoje().slice(0,7),hoje=ctHoje(),fim7=addDaysISO(hoje,6);
  const rows=ctOcc(CT.tab,mk);_ctRows=rows;
  const open=rows.filter(r=>!r.paid),paid=rows.filter(r=>r.paid);
  const sum=a=>a.reduce((s,r)=>s+r.valor,0);
  const isPg=CT.tab==="pagar";
  const grp={late:[],week:[],rest:[],fut:[]};
  open.forEach((r,i)=>{r._i=rows.indexOf(r);
    if(mk<tk||r.data<hoje)grp.late.push(r);
    else if(mk===tk&&r.data<=fim7)grp.week.push(r);
    else if(mk===tk)grp.rest.push(r);
    else grp.fut.push(r);});
  paid.forEach(r=>{r._i=rows.indexOf(r);});
  const row=r=>{const d=r.data,rec=recKind(r.p.recorrencia),banco=isPg?r.p.banco:r.p.conta;
    return`<div class="ct-row ${r.paid?"paid":""} ${(!r.paid&&(r.late||d<hoje))?"late":""}" onclick="ctEdit(${r._i})" role="button" tabindex="0">
    <button class="ck" onclick="event.stopPropagation();ctPay(${r._i})" aria-label="${r.paid?"Desfazer":"Marcar como "+(isPg?"paga":"recebida")}">✓</button>
    <div class="dot-day"><b>${d.slice(8,10)}</b><span>${ML[+d.slice(5,7)-1]}</span></div>
    <div class="ct-main"><b>${esc(r.desc)}</b><small>${rec?`<span class="chip rec">${esc(r.p.recorrencia)}</span> · `:""}${esc(banco||"—")}${(!r.paid&&(r.late||d<hoje)&&mk===tk)?` · <span class="ct-latebdg">em atraso</span>`:""}</small></div>
    <div class="ct-val num ${isPg?"":"in"}" onclick="event.stopPropagation();ctValEdit(${r._i},this)" title="Tocar pra editar o valor">${fmtBRL(r.valor)}</div></div>`;};
  const sect=(t,arr,cls)=>arr.length?`<div class="secttl"><span class="${cls||""}">${t}</span><span class="num">${fmtBRL(sum(arr))}</span></div><div class="panel ct-grp">${arr.map(row).join("")}</div>`:"";
  const tabBtn=(id,l)=>`<button class="btn ${CT.tab===id?"":"ghost"} sm" onclick="CT.tab='${id}';viewContas()">${l}</button>`;
  $("#view").innerHTML=`<div class="row"><div><h1>Contas do mês</h1><div class="sub">Compromissos da casa · toque no ✓ pra dar baixa (lança o movimento junto)</div></div>
    <div class="controls" style="margin:0"><button class="btn ghost sm" onclick="CT.mes=addMonth(CT.mes,-1);viewContas()" aria-label="Mês anterior">‹</button><div style="font-weight:660;min-width:96px;text-align:center">${mkLabel(mk)}</div><button class="btn ghost sm" onclick="CT.mes=addMonth(CT.mes,1);viewContas()" aria-label="Próximo mês">›</button></div></div>
  <div class="controls"><div class="seg" style="display:inline-flex;gap:4px">${tabBtn("pagar","A pagar")}${tabBtn("receber","A receber")}</div><button class="btn" style="margin-left:auto" onclick="${isPg?"addPagar()":"addReceber()"}">+ Nova</button></div>
  <div class="kpis" style="grid-template-columns:repeat(2,1fr)">
    <div class="kpi"><div class="lbl">${isPg?"🗓️ Compromissos de":"🗓️ Previsto pra"} ${mkLabel(mk)}</div><div class="val">${fmtBRL(sum(rows))}</div><div class="hint">${rows.length} lançamento(s)</div></div>
    <div class="kpi"><div class="lbl">${isPg?"Ainda falta":"Ainda a receber"}</div><div class="val ${isPg?"out":"in"}">${fmtBRL(sum(open))}</div><div class="hint">${isPg?"pago":"recebido"} ${fmtBRL(sum(paid))}</div></div>
  </div>
  ${sect(isPg?"Atrasadas":"Atrasados",grp.late,"out")}
  ${sect("Esta semana",grp.week)}
  ${sect("Até o fim do mês",grp.rest)}
  ${sect("No mês",grp.fut)}
  ${sect(isPg?"Pagas":"Recebidos",paid,"in")}
  ${rows.length?"":`<div class="panel"><div class="empty">Nada em ${mkLabel(mk)}. Use “+ Nova” pra cadastrar um compromisso${isPg?" (aluguel, escola, luz…)":""} — recorrente aparece aqui todo mês sozinho.</div></div>`}`;
}
function ctEdit(i){const r=_ctRows[i];if(!r)return;(CT.tab==="pagar"?editPagar:editReceber)(r.p._row);}
/* edição inline do valor na própria linha */
function ctValEdit(i,el){const r=_ctRows[i];if(!r||el.querySelector("input"))return;
  const inp=document.createElement("input");inp.type="number";inp.step="0.01";inp.value=r.valor;inp.className="ct-inl";
  el.textContent="";el.appendChild(inp);inp.focus();let done=false;
  const commit=async()=>{if(done)return;done=true;const v=Math.abs(+inp.value||0);
    if(v&&v!==r.valor){try{if(MODE==="live")await sbUpd("previstos",r.p._row,{valor:v});
      if(CT.tab==="pagar")r.p.valor=v;else r.p.previstoLiquido=v;toast("Valor salvo ✓");}catch(e){toast("Erro: "+e.message);}}
    viewContas();};
  inp.addEventListener("blur",commit);inp.addEventListener("keydown",e=>{if(e.key==="Enter")inp.blur();if(e.key==="Escape"){done=true;viewContas();}});}
/* ✓ de 1 toque: dá baixa + lança/concilia o movimento; recorrente rola a âncora */
async function ctPay(i){
  const r=_ctRows[i];if(!r)return;const p=r.p,isPg=CT.tab==="pagar";
  if(r.paid)return ctUndo(r);
  const paidSt=isPg?"pago":"recebido",sentido=isPg?"Saída":"Entrada";
  const banco=isPg?p.banco:p.conta,kind=recKind(p.recorrencia),hoje=ctHoje();
  /* o extrato (Pluggy/import) já trouxe esse valor? → concilia em vez de duplicar.
     Janela: até 7 dias do VENCIMENTO ou de HOJE (atrasado pago hoje casa com o débito de hoje). */
  const _dd=(a,b)=>Math.abs((new Date(a)-new Date(b))/864e5);
  const match=DB.movimentos.find(m=>m.sentido===sentido&&!isForaAgregado(m)&&Math.abs(m.valor-r.valor)<=Math.max(0.5,r.valor*0.02)&&Math.min(_dd(m.data,r.data),_dd(m.data,ctHoje()))<=7);
  const und={mov:null,inst:null,tpl:null,prevAnchor:null,coll:isPg?"contasPagar":"aReceber"};
  try{
    if(kind){
      /* instância PAGA do mês + template rola pra próxima ocorrência (projeção continua viva) */
      let instId="p"+Date.now();
      if(MODE==="live")instId=await sbIns("previstos",{descricao:r.desc,valor:r.valor,vencimento:r.data,tipo:isPg?"pagar":"receber",status:paidSt,visao:VISAO,recorrencia:null,conta_id:contaId(banco),categoria_id:catId(p.categoria||"")});
      const inst=isPg?{_row:instId,descricao:r.desc,vencimento:r.data,valor:r.valor,categoria:p.categoria||"",banco,status:paidSt,recorrencia:""}
                     :{_row:instId,linha:r.desc,dataPrevista:r.data,previstoLiquido:r.valor,conta:banco,status:paidSt,recorrencia:""};
      DB[und.coll].push(inst);und.inst=instId;
      const anchor=((isPg?p.vencimento:p.dataPrevista)||"").slice(0,10);
      /* rola a âncora pra depois da ocorrência paga; ocorrências PULADAS (mais antigas,
         ainda devidas) viram previstos avulsos ABERTOS — pagar julho não apaga junho */
      let nx=anchor,g=0;const skipped=[];
      while(nx<=r.data&&g++<600){if(nx<r.data)skipped.push(nx);nx=stepRec(nx,kind,1);}
      und.tpl=p._row;und.prevAnchor=anchor;und.skipped=[];
      for(const d of skipped){
        let skId="p"+Date.now()+Math.random().toString(36).slice(2,5);
        if(MODE==="live")skId=await sbIns("previstos",{descricao:r.desc,valor:r.valor,vencimento:d,tipo:isPg?"pagar":"receber",status:"aberto",visao:VISAO,recorrencia:null,conta_id:contaId(banco),categoria_id:catId(p.categoria||"")});
        DB[und.coll].push(isPg?{_row:skId,descricao:r.desc,vencimento:d,valor:r.valor,categoria:p.categoria||"",banco,status:"aberto",recorrencia:""}
                              :{_row:skId,linha:r.desc,dataPrevista:d,previstoLiquido:r.valor,conta:banco,status:"aberto",recorrencia:""});
        und.skipped.push(skId);
      }
      if(MODE==="live")await sbUpd("previstos",p._row,{vencimento:nx});
      if(isPg)p.vencimento=nx;else p.dataPrevista=nx;
    }else{
      if(MODE==="live")await sbUpd("previstos",p._row,{status:paidSt});
      p.status=paidSt;und.inst=p._row;
    }
    if(match){toast((isPg?"Pago":"Recebido")+" ✓ · conciliado com o extrato");}
    else{await lancarMov({data:hoje,descricao:r.desc,valor:r.valor,sentido,banco:banco||bancoOpts()[0]||"",categoria:p.categoria||""});
      und.mov=DB.movimentos[0]&&DB.movimentos[0]._row;
      toast((isPg?"Pago":"Recebido")+" ✓ · lançado em "+(banco||"conta"));}
    CT_UNDO[und.inst]=und;
  }catch(e){toast("Erro: "+e.message);}
  await afterWrite();
}
/* desfazer: toque no ✓ de uma linha paga */
async function ctUndo(r){
  const p=r.p,isPg=CT.tab==="pagar",und=CT_UNDO[p._row];
  try{
    if(und){
      if(und.mov){try{if(MODE==="live")await sbDel("movimentos",und.mov);}catch(e){}DB.movimentos=DB.movimentos.filter(m=>m._row!==und.mov);}
      if(und.tpl){ /* instância de recorrente: apaga a instância (e as avulsas puladas) e rola a âncora de volta */
        try{if(MODE==="live")await sbDel("previstos",p._row);}catch(e){}
        DB[und.coll]=DB[und.coll].filter(x=>x._row!==p._row);
        for(const skId of(und.skipped||[])){try{if(MODE==="live")await sbDel("previstos",skId);}catch(e){}DB[und.coll]=DB[und.coll].filter(x=>x._row!==skId);}
        const tpl=DB[und.coll].find(x=>x._row===und.tpl);
        if(tpl){if(MODE==="live")await sbUpd("previstos",und.tpl,{vencimento:und.prevAnchor});
          if(isPg)tpl.vencimento=und.prevAnchor;else tpl.dataPrevista=und.prevAnchor;}
      }else{
        if(MODE==="live")await sbUpd("previstos",p._row,{status:"aberto"});p.status="aberto";
      }
      delete CT_UNDO[p._row];
    }else{ /* sem histórico da sessão: só reabre */
      if(MODE==="live")await sbUpd("previstos",p._row,{status:"aberto"});p.status="aberto";
    }
    toast("Desfeito — voltou pra aberto");
  }catch(e){toast("Erro: "+e.message);}
  await afterWrite();
}

/* ===== Comissões LP (PIPEX · divisão de comissão do Daniel) =====
   Extrato .xls (HTML disfarçado) do Daniel → marca quem entra na divisão →
   "Salvar mês" persiste em lp_comissao_meses/lp_comissao_itens e lança o
   líquido em `previstos` (tipo=receber, conciliável como qualquer previsto).
   Carteira + fluxo recorrente persistem em lp_carteira (scripts/lp_comissao.sql).
   Fórmula: líquido = comissão × %divisão × (1 − %imposto). */
let LP={cart:[],meses:[],itens:null,per:null,sel:{},q:"",qc:"",tab:"meses",pdiv:50,pimp:6,pover:20,fyc:{},fycComp:"",err:null,_demoItens:{}};
const lpNum=s=>{s=String(s??"").trim();if(!s)return NaN;s=s.replace(/\./g,"").replace(",",".");const v=parseFloat(s);return isNaN(v)?NaN:v;};   // números BR do extrato (1.234,56)
const lpISO=s=>{const m=String(s||"").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);return m?`${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`:String(s||"").slice(0,10);};
const lpCalc=c=>{const div=c*LP.pdiv/100,imp=div*LP.pimp/100;return{div,imp,liq:div-imp};};
const lpSit=it=>{const k=LP.cart.find(c=>c.apolice===it.apolice);return k?(k.no_fluxo?"fluxo":"carteira"):"fora";};
async function lpLoad(){if(MODE!=="live"){if(!LP.cart.length)LP.cart=[{apolice:"2100001",segurado:"CLIENTE DEMO UM",no_fluxo:true,acordo:true,status:"Ativa",premio:318.5,periodicidade:"Mensal",ativo:true},{apolice:"2100002",segurado:"CLIENTE DEMO DOIS",no_fluxo:false,acordo:false,status:"Ativa",premio:447.68,periodicidade:"Mensal",ativo:true}];if((LP.meses||[]).length){LP.fycComp=LP.meses[0].mes_label;LP.fyc={};(LP._demoItens[LP.meses[0].competencia]||[]).forEach(x=>LP.fyc[x.apolice]=Number(x.comissao||0));}LP.err=null;return true;}
  const[ca,ms]=await Promise.all([sb.from("lp_carteira").select("*").order("segurado"),sb.from("lp_comissao_meses").select("*").order("competencia",{ascending:false})]);
  if(ca.error||ms.error){const e=(ca.error||ms.error).message;LP.err=/does not exist|relation|schema cache/i.test(e)?"Tabelas lp_* ainda não existem — rode scripts/lp_comissao.sql no SQL Editor do Supabase.":e;return false;}
  LP.cart=ca.data||[];LP.meses=ms.data||[];LP.err=null;
  /* FYC por apólice do último mês fechado — base do override MFB e da previsão do acordo */
  LP.fyc={};LP.fycComp="";
  if(LP.meses.length){const it=await sb.from("lp_comissao_itens").select("apolice,comissao").eq("competencia",LP.meses[0].competencia);if(!it.error){LP.fycComp=LP.meses[0].mes_label||LP.meses[0].competencia;(it.data||[]).forEach(x=>LP.fyc[x.apolice]=Number(x.comissao||0));}}
  return true;}
function lpParseExtrato(text){const doc=new DOMParser().parseFromString(text,"text/html");const agg={};let per=null;
  [...doc.querySelectorAll("tr")].forEach(tr=>{const td=[...tr.querySelectorAll("td")];if(td.length<20)return;const cell=i=>(td[i]?.textContent||"").trim();
    const ap=cell(7).replace(/\D/g,"");if(!ap)return;const com=lpNum(cell(19));if(isNaN(com))return;
    if(!per)per={ini:cell(1),fim:cell(2),mes:cell(0)};
    if(!agg[ap])agg[ap]={apolice:ap,segurado:cell(9),comissao:0,linhas:0};agg[ap].comissao+=com;agg[ap].linhas++;});
  return{itens:Object.values(agg).map(c=>({...c,comissao:Math.round(c.comissao*100)/100})),per};}
function lpFile(ev){const f=ev.target.files[0];if(!f)return;const rd=new FileReader();
  rd.onload=e=>{try{const{itens,per}=lpParseExtrato(e.target.result);if(!itens.length){toast("Nenhuma linha reconhecida nesse arquivo");return;}
    LP.itens=itens;LP.per=per;LP.q="";LP.sel={};itens.forEach(it=>{LP.sel[it.apolice]=lpSit(it)==="fluxo";});lpRender();toast(`${itens.length} clientes no extrato`);}catch(err){toast("Não consegui ler: "+err.message);}};
  rd.readAsText(f,"ISO-8859-1");}
function lpToggle(ap,v){LP.sel[ap]=v;lpRenderTable();}
function lpSelAll(v){(LP.itens||[]).forEach(it=>{if(v){if(lpSit(it)!=="fora")LP.sel[it.apolice]=true;}else LP.sel[it.apolice]=false;});lpRenderTable();}
function lpSelFluxo(){(LP.itens||[]).forEach(it=>LP.sel[it.apolice]=lpSit(it)==="fluxo");lpRenderTable();}
function lpNovo(){LP.itens=null;LP.per=null;LP.sel={};lpRender();}
function lpTotals(){let n=0,com=0,div=0,imp=0;(LP.itens||[]).forEach(it=>{if(LP.sel[it.apolice]){n++;const r=lpCalc(it.comissao);com+=it.comissao;div+=r.div;imp+=r.imp;}});return{n,com,div,imp,liq:div-imp};}
function lpRenderTable(){const tb=document.getElementById("lpTb");if(!tb)return;const q=(LP.q||"").toUpperCase();
  const ord=it=>({fluxo:0,carteira:1,fora:2}[lpSit(it)]);
  const rows=[...(LP.itens||[])].sort((a,b)=>{const na=a.comissao<0,nb=b.comissao<0;if(na!==nb)return na?1:-1;if(ord(a)!==ord(b))return ord(a)-ord(b);return b.comissao-a.comissao;});
  const gname=it=>it.comissao<0?"Estornos / cancelamentos":lpSit(it)==="fluxo"?"Já no fluxo (pré-marcados)":lpSit(it)==="carteira"?"Candidatos — na sua carteira":"Candidatos — fora da carteira";
  let cur=null,html="";
  rows.forEach(it=>{if(q&&!(it.segurado||"").toUpperCase().includes(q))return;const g=gname(it);if(g!==cur){cur=g;html+=`<tr class="lp-grp"><td colspan="8">${esc(g)}</td></tr>`;}
    const on=!!LP.sel[it.apolice],r=lpCalc(it.comissao),sit=lpSit(it),neg=it.comissao<0?" lp-neg":"";
    html+=`<tr${on?"":' class="lp-off"'}><td><input type="checkbox" ${on?"checked":""} onchange="lpToggle('${it.apolice}',this.checked)"></td><td>${esc(it.segurado)}</td><td><span class="chip">${esc(it.apolice)}</span></td><td><span class="chip lp-${sit==="carteira"?"cart":sit}">${sit==="fluxo"?"no fluxo":sit==="carteira"?"na carteira":"fora"}</span></td><td class="num${neg}">${fmtBRL(it.comissao)}</td><td class="num${neg}">${fmtBRL(r.div)}</td><td class="num">${fmtBRL(r.imp)}</td><td class="num${neg}">${fmtBRL(r.liq)}</td></tr>`;});
  tb.innerHTML=html||`<tr><td colspan="8"><div class="empty">Nada bateu com a busca.</div></td></tr>`;
  const t=lpTotals(),set=(id,v)=>{const x=document.getElementById(id);if(x)x.textContent=v;};
  set("lpKSel",t.n);set("lpKCom",fmtBRL(t.com));set("lpKDiv",fmtBRL(t.div));set("lpKImp",fmtBRL(t.imp));set("lpKLiq",fmtBRL(t.liq));
  const fd=document.getElementById("lpFDiv"),fi=document.getElementById("lpFImp");if(fd)fd.textContent=LP.pdiv+"%";if(fi)fi.textContent=LP.pimp+"%";}
function lpRender(){const tab=(id,lab)=>`<button class="btn ${LP.tab===id?"":"ghost"} sm" onclick="lpTabSet('${id}')">${lab}</button>`;
  $("#view").innerHTML=`<div class="row"><div><h1>Comissões LP</h1><div class="sub">Life Planner Daniel · acordo Pipe X (${LP.pdiv}% − ${LP.pimp}% imp.) · override MFB (${LP.pover}% s/ FYC)</div></div></div>
  ${LP.err?`<div class="panel"><div class="empty">⚠ ${esc(LP.err)}</div></div>`:""}
  <div class="controls" style="margin-bottom:12px">${tab("meses","📅 Meses / fechamento")}${tab("carteira","👥 Carteira de clientes")}</div><div id="lpBody"></div>`;
  if(LP.tab==="carteira")lpRenderCarteira();else lpRenderMeses();}
function lpTabSet(t){LP.tab=t;lpRender();}
function lpRenderMeses(){const hist=(LP.meses||[]).map(m=>`<tr><td>${esc(m.mes_label||m.competencia)}</td><td>${fmtDate(m.periodo_ini)} → ${fmtDate(m.periodo_fim)}</td><td class="num">${fmtBRL(m.base)}</td><td class="num in">${fmtBRL(m.liquido)}</td><td><span class="pill ${m.status}">${esc(m.status)}</span>${m.recebido_em?` <span class="chip">${fmtDate(m.recebido_em)}</span>`:""}</td><td style="white-space:nowrap"><button class="btn ghost sm" onclick="lpVerMes('${m.competencia}')">Editar</button>${m.status==="aberto"?` <button class="btn ghost sm" onclick="lpMarcarRecebido('${m.competencia}')">Recebido ✓</button>`:""}</td></tr>`).join("");
  const editor=LP.itens?`
  <div class="panel"><div class="row" style="margin-bottom:10px"><div><h2 style="margin:0">Extrato ${esc((LP.per?.mes||"").split(" ")[0]||"")}</h2><div class="sub">Compensatório: <b>${esc(LP.per?.ini||"?")} → ${esc(LP.per?.fim||"?")}</b> · ${(LP.itens||[]).length} clientes · líquido = comissão × <b id="lpFDiv">${LP.pdiv}%</b> × (1 − <b id="lpFImp">${LP.pimp}%</b>)</div></div><button class="btn ghost sm" onclick="lpNovo()">Trocar extrato</button></div>
    <div class="controls" style="margin-bottom:10px"><div class="fld"><label class="sub" style="margin:0">% Divisão</label><input type="number" min="0" max="100" step="1" value="${LP.pdiv}" oninput="LP.pdiv=+this.value||0;lpRenderTable()" style="width:80px"></div><div class="fld"><label class="sub" style="margin:0">% Imposto (Simples)</label><input type="number" min="0" max="100" step="0.1" value="${LP.pimp}" oninput="LP.pimp=+this.value||0;lpRenderTable()" style="width:80px"></div><div class="fld" style="flex:1"><label class="sub" style="margin:0">Buscar segurado</label><input placeholder="Buscar..." value="${esc(LP.q)}" oninput="LP.q=this.value;lpRenderTable()"></div></div>
    <div class="kpis" style="margin-bottom:12px"><div class="kpi"><div class="lbl">Selecionados</div><div class="val" id="lpKSel">0</div></div><div class="kpi"><div class="lbl">Comissão (base)</div><div class="val" id="lpKCom">R$ 0</div></div><div class="kpi"><div class="lbl">Divisão</div><div class="val" id="lpKDiv">R$ 0</div></div><div class="kpi"><div class="lbl">Imposto</div><div class="val" id="lpKImp">R$ 0</div></div><div class="kpi"><div class="lbl">Líquido a receber</div><div class="val in" id="lpKLiq">R$ 0</div></div></div>
    <div class="controls" style="margin-bottom:8px"><button class="btn ghost sm" onclick="lpSelAll(true)">Marcar todos da carteira</button><button class="btn ghost sm" onclick="lpSelFluxo()">Só os do fluxo</button><button class="btn ghost sm" onclick="lpSelAll(false)">Limpar</button></div>
    <table><thead><tr><th style="width:34px"></th><th>Segurado</th><th>Apólice</th><th>Situação</th><th class="num">Comissão</th><th class="num">Divisão</th><th class="num">Imposto</th><th class="num">Líquido</th></tr></thead><tbody id="lpTb"></tbody></table>
    <div class="controls" style="margin-top:12px;align-items:flex-end"><div class="fld"><label class="sub" style="margin:0">Vencimento (a receber)</label><input type="date" id="lpVenc" value="${lpISO(LP.per?.fim)||todayISO()}"></div><div class="fld"><label class="sub" style="margin:0">Conta destino</label><select id="lpConta">${bancoOpts().map(o=>`<option>${esc(o)}</option>`).join("")}</select></div><button class="btn" onclick="lpSalvarMes()">Salvar mês + lançar A Receber</button></div>
    <div class="sub" style="margin-top:8px">Quem você marcar continua <b>no fluxo</b> nos próximos meses (persistido na carteira). Estornos negativos marcados abatem do total.</div>
  </div>`:`
  <div class="panel"><h2 style="margin:0 0 6px">Novo mês</h2><div class="sub" style="margin-bottom:10px">Anexe o extrato de comissão completo do Daniel (o .xls que a seguradora exporta). Eu agrego por apólice, cruzo com a sua carteira (${LP.cart.length} apólices) e pré-marco quem já está no fluxo.</div><input type="file" accept=".xls,.html,.htm" onchange="lpFile(event)"></div>`;
  document.getElementById("lpBody").innerHTML=`<div class="panel"><h2 style="margin:0 0 8px">Meses fechados</h2><table><thead><tr><th>Mês</th><th>Período</th><th class="num">Base</th><th class="num">Líquido</th><th>Status</th><th></th></tr></thead><tbody>${hist||`<tr><td colspan="6"><div class="empty">Nenhum mês fechado ainda.</div></td></tr>`}</tbody></table></div>
  ${editor}`;
  lpRenderTable();}
/* --- aba Carteira: base das duas frentes (override MFB 20% s/ FYC + acordo Pipe X) --- */
function lpFator(){return LP.pdiv/100*(1-LP.pimp/100);}
function lpRenderCarteira(){const ativas=LP.cart.filter(c=>/ativa/i.test(c.status||""));
  const premioMes=ativas.filter(c=>/mensal/i.test(c.periodicidade||"")).reduce((s,c)=>s+Number(c.premio||0),0);
  const fycTot=Object.values(LP.fyc).reduce((s,v)=>s+v,0),over=fycTot*LP.pover/100;
  /* REGRA (Gustavo 07/07): a base da previsao NAO e quem esta no acordo — e o FLUXO DOS
     MARCADOS (acordo && no_fluxo). So entra quem paga ate o dia 20; quem nao pagou rola pro
     mes seguinte. O `no_fluxo` e dado VIVO: o fechamento do mes o grava (lpFecharMes) e o
     lp-load.mjs preserva no reload. Projetar sobre `acordo` inflava a previsao com quem esta
     no acordo mas nao pagou — em Jun/26 eram 6 apolices, R$ 424,25/mes a mais. */
  const noAcordo=LP.cart.filter(c=>c.acordo);
  const noFluxo=LP.cart.filter(c=>c.acordo&&c.no_fluxo);
  const foraDoFluxo=noAcordo.length-noFluxo.length;
  const prev=noFluxo.reduce((s,c)=>s+(LP.fyc[c.apolice]||0),0)*lpFator();
  const nCli=new Set(LP.cart.map(c=>c.segurado)).size;
  document.getElementById("lpBody").innerHTML=`
  <div class="kpis"><div class="kpi"><div class="lbl">Clientes / apólices</div><div class="val">${nCli} / ${LP.cart.length}</div><div class="hint">${ativas.length} apólices ativas</div></div>
    <div class="kpi"><div class="lbl">Prêmio mensal (ativas)</div><div class="val">${fmtBRL(premioMes)}</div></div>
    <div class="kpi"><div class="lbl">FYC ${esc(LP.fycComp||"último mês")}</div><div class="val">${fmtBRL(fycTot)}</div><div class="hint">comissão do Daniel no mês</div></div>
    <div class="kpi"><div class="lbl">Override MFB (${LP.pover}%)</div><div class="val in" id="lpKOver">${fmtBRL(over)}</div><div class="hint">sua receita PJ estimada/mês</div></div>
    <div class="kpi"><div class="lbl">No acordo Pipe X</div><div class="val">${noAcordo.length}</div><div class="hint">apólices marcadas</div></div>
    <div class="kpi"><div class="lbl">Previsão Pipe X/mês</div><div class="val in" id="lpKPrev">${fmtBRL(prev)}</div><div class="hint">${LP.pdiv}% × (1−${LP.pimp}%) s/ FYC de quem está <b>no fluxo</b> (${noFluxo.length})${foraDoFluxo?` · ${foraDoFluxo} no acordo fora do fluxo`:""}</div></div></div>
  <div class="panel"><div class="controls" style="margin-bottom:10px"><div class="fld"><label class="sub" style="margin:0">% Override MFB</label><input type="number" min="0" max="100" step="1" value="${LP.pover}" oninput="LP.pover=+this.value||0;lpRenderCarteira()" style="width:80px"></div><div class="fld" style="flex:1"><label class="sub" style="margin:0">Buscar cliente</label><input placeholder="Buscar..." value="${esc(LP.qc)}" oninput="LP.qc=this.value;lpRenderCartTable()"></div><button class="btn" onclick="lpPrevRecorrente()">Lançar previsão recorrente (${fmtBRL(prev)}/mês)</button></div>
  <table><thead><tr><th>Segurado</th><th>Apólice</th><th>Status</th><th class="num">Prêmio</th><th class="num">FYC ${esc(LP.fycComp||"—")}</th><th class="num">Override ${LP.pover}%</th><th style="text-align:center">Acordo Pipe X</th><th class="num">Prev. Pipe X</th></tr></thead><tbody id="lpCartTb"></tbody></table>
  <div class="sub" style="margin-top:8px">O <b>override</b> incide sobre o FYC de toda a produção do Daniel (sua receita MFB, visão PJ). A coluna <b>Acordo Pipe X</b> marca os clientes do acordo comercial (${LP.pdiv}% − imposto) — só eles entram na previsão de receita do Pipe X. FYC vem do último mês fechado na aba Meses.</div></div>`;
  lpRenderCartTable();}
function lpRenderCartTable(){const tb=document.getElementById("lpCartTb");if(!tb)return;const q=(LP.qc||"").toUpperCase();
  const rows=[...LP.cart].sort((a,b)=>(b.acordo?1:0)-(a.acordo?1:0)||(a.segurado||"").localeCompare(b.segurado||"")||String(a.apolice).localeCompare(String(b.apolice)));
  tb.innerHTML=rows.filter(c=>!q||(c.segurado||"").toUpperCase().includes(q)).map(c=>{const fyc=LP.fyc[c.apolice],canc=c.status&&!/ativa/i.test(c.status);
    return`<tr${c.acordo?"":' class="lp-off"'}><td>${esc(c.segurado)}${c.no_fluxo?' <span class="chip lp-fluxo">no fluxo</span>':""}</td><td><span class="chip">${esc(c.apolice)}</span></td><td><span class="chip${canc?" lp-fora":""}">${esc(c.status||"—")}</span></td><td class="num">${c.premio!=null?fmtBRL(c.premio)+(c.periodicidade?`<span class="sub"> /${esc(String(c.periodicidade).toLowerCase().slice(0,3))}</span>`:""):"—"}</td><td class="num${fyc<0?" lp-neg":""}">${fyc!=null?fmtBRL(fyc):"—"}</td><td class="num">${fyc!=null?fmtBRL(fyc*LP.pover/100):"—"}</td><td style="text-align:center"><input type="checkbox" ${c.acordo?"checked":""} onchange="lpAcordo('${esc(c.apolice)}',this.checked)"></td><td class="num in">${c.acordo&&c.no_fluxo&&fyc!=null?fmtBRL(fyc*lpFator()):"—"}</td></tr>`;}).join("")||`<tr><td colspan="8"><div class="empty">Carteira vazia — rode a carga (carga-lp-carteira.local.sql).</div></td></tr>`;}
async function lpAcordo(ap,v){const k=LP.cart.find(c=>String(c.apolice)===String(ap));if(!k)return;
  if(MODE==="live"){const u=await sb.from("lp_carteira").update({acordo:v}).eq("apolice",k.apolice);if(u.error){toast("Erro: "+u.error.message);return;}}
  k.acordo=v;lpRenderCarteira();}
async function lpPrevRecorrente(){const prev=Math.round(LP.cart.filter(c=>c.acordo&&c.no_fluxo).reduce((s,c)=>s+(LP.fyc[c.apolice]||0),0)*lpFator()*100)/100;
  if(!(prev>0)){toast("Previsão zerada — a base é quem está NO FLUXO (marcado no acordo + selecionado no fechamento do mês)");return;}
  const DESC="Previsão comissão LP (acordo)";
  const d=new Date(),m=d.getMonth()+2,yy=d.getFullYear()+Math.floor((m-1)/12),mm=((m-1)%12)+1,prox=`${yy}-${String(mm).padStart(2,"0")}-20`;
  modal({title:"Previsão recorrente de receita",extraHTML:`<div class="sub">Cria/atualiza <b>1 previsto mensal</b> em A Receber de <b>${fmtBRL(prev)}</b> (FYC ${esc(LP.fycComp||"?")} do acordo × ${LP.pdiv}% × (1−${LP.pimp}%)), vencendo todo dia 20 a partir de ${fmtDate(prox)}. Ele aparece no Fluxo de Caixa como projeção. Quando fechar o mês real na aba Meses, o lançamento real entra separado — ajuste ou exclua a previsão se necessário.</div>`,saveLabel:"Lançar previsão",onSave:async()=>{
    const ex=(DB.aReceber||[]).find(p=>p.linha===DESC);
    if(ex){if(MODE==="live")await sbUpd("previstos",ex._row,{valor:prev,vencimento:prox});ex.previstoLiquido=prev;ex.dataPrevista=prox;toast("Previsão atualizada: "+fmtBRL(prev)+"/mês");}
    else{const o={_row:"r"+Date.now(),linha:DESC,dataPrevista:prox,previstoLiquido:prev,conta:"",status:"aberto",recorrencia:"mensal"};if(MODE==="live")o._row=await sbIns("previstos",{descricao:DESC,valor:prev,vencimento:prox,tipo:"receber",status:"aberto",visao:VISAO,recorrencia:"mensal"});DB.aReceber.push(o);toast("Previsão recorrente lançada: "+fmtBRL(prev)+"/mês");}}});}
async function viewComissoesLP(){$("#view").innerHTML=`<div class="row"><div><h1>Comissões LP</h1><div class="sub">Carregando…</div></div></div>`;await lpLoad();lpRender();}
async function lpSalvarMes(){const t=lpTotals();if(!LP.itens||!LP.itens.length){toast("Carregue um extrato primeiro");return;}
  const comp=(lpISO(LP.per?.fim)||todayISO()).slice(0,7),label=(LP.per?.mes||"").split(" ")[0]||comp,venc=document.getElementById("lpVenc")?.value||lpISO(LP.per?.fim),conta=document.getElementById("lpConta")?.value||"",liq=Math.round(t.liq*100)/100,base=Math.round(t.com*100)/100,desc=`Comissão LP Daniel · ${label}`;
  try{
    if(MODE==="live"){
      const exist=(LP.meses||[]).find(m=>m.competencia===comp);let pid=exist?.previsto_id||null;
      if(pid){try{await sbUpd("previstos",pid,{descricao:desc,valor:liq,vencimento:venc||null,conta_id:contaId(conta)});}catch(e){pid=null;}}
      if(!pid)pid=await sbIns("previstos",{descricao:desc,valor:liq,vencimento:venc||null,tipo:"receber",status:"aberto",visao:VISAO,conta_id:contaId(conta)});
      const up=await sb.from("lp_comissao_meses").upsert({competencia:comp,mes_label:label,periodo_ini:lpISO(LP.per?.ini)||null,periodo_fim:lpISO(LP.per?.fim)||null,pct_div:LP.pdiv,pct_imp:LP.pimp,base,liquido:liq,previsto_id:pid},{onConflict:"competencia"});if(up.error)throw new Error(up.error.message);
      const del=await sb.from("lp_comissao_itens").delete().eq("competencia",comp);if(del.error)throw new Error(del.error.message);
      const rows=LP.itens.map(it=>({competencia:comp,apolice:it.apolice,segurado:it.segurado,comissao:it.comissao,linhas:it.linhas||0,situacao:lpSit(it),selecionado:!!LP.sel[it.apolice]}));
      for(let i=0;i<rows.length;i+=200){const ins=await sb.from("lp_comissao_itens").insert(rows.slice(i,i+200));if(ins.error)throw new Error(ins.error.message);}
      for(const it of LP.itens){const k=LP.cart.find(c=>c.apolice===it.apolice),on=!!LP.sel[it.apolice];
        if(k){if(!!k.no_fluxo!==on){const u=await sb.from("lp_carteira").update({no_fluxo:on}).eq("apolice",it.apolice);if(!u.error)k.no_fluxo=on;}}
        else if(on){const n=await sb.from("lp_carteira").insert({apolice:it.apolice,segurado:it.segurado,no_fluxo:true});if(!n.error)LP.cart.push({apolice:it.apolice,segurado:it.segurado,no_fluxo:true,ativo:true});}}
    }else{
      const exist=(LP.meses||[]).findIndex(m=>m.competencia===comp),row={competencia:comp,mes_label:label,periodo_ini:lpISO(LP.per?.ini),periodo_fim:lpISO(LP.per?.fim),pct_div:LP.pdiv,pct_imp:LP.pimp,base,liquido:liq,status:exist>=0?LP.meses[exist].status:"aberto"};
      if(exist>=0)LP.meses[exist]={...LP.meses[exist],...row};else LP.meses.unshift(row);
      LP._demoItens[comp]=LP.itens.map(it=>({...it,situacao:lpSit(it),selecionado:!!LP.sel[it.apolice]}));
      LP.itens.forEach(it=>{const k=LP.cart.find(c=>c.apolice===it.apolice),on=!!LP.sel[it.apolice];if(k)k.no_fluxo=on;else if(on)LP.cart.push({apolice:it.apolice,segurado:it.segurado,no_fluxo:true,ativo:true});});
      DB.aReceber.push({_row:"r"+Date.now(),linha:desc,dataPrevista:venc,previstoLiquido:liq,conta,status:"aberto",recorrencia:""});
    }
    toast(`Mês ${label} salvo · ${fmtBRL(liq)} lançado em A Receber`);LP.itens=null;LP.per=null;LP.sel={};if(MODE==="live")DB=await loadData();await lpLoad();lpRender();
  }catch(e){toast("Erro ao salvar: "+e.message);}}
async function lpVerMes(comp){const m=(LP.meses||[]).find(x=>x.competencia===comp);if(!m)return;
  let its=[];if(MODE==="live"){const r=await sb.from("lp_comissao_itens").select("*").eq("competencia",comp);if(r.error){toast("Erro: "+r.error.message);return;}its=r.data||[];}else its=LP._demoItens[comp]||[];
  LP.itens=its.map(x=>({apolice:x.apolice,segurado:x.segurado,comissao:Number(x.comissao||0),linhas:x.linhas||0}));
  LP.per={ini:fmtDate(m.periodo_ini),fim:fmtDate(m.periodo_fim),mes:(m.mes_label||comp)+" (Mensal)"};LP.pdiv=Number(m.pct_div||50);LP.pimp=Number(m.pct_imp||6);LP.q="";LP.sel={};its.forEach(x=>LP.sel[x.apolice]=!!x.selecionado);lpRender();}
async function lpMarcarRecebido(comp){const m=(LP.meses||[]).find(x=>x.competencia===comp);if(!m)return;
  modal({title:"Marcar recebido",extraHTML:`<div class="sub">Confirmar recebimento de <b>${fmtBRL(m.liquido)}</b> (${esc(m.mes_label||comp)}) do Daniel?</div>`,saveLabel:"Recebido ✓",onSave:async()=>{const hoje=todayISO();
    if(MODE==="live"){const u=await sb.from("lp_comissao_meses").update({status:"recebido",recebido_em:hoje}).eq("competencia",comp);if(u.error)throw new Error(u.error.message);if(m.previsto_id){try{await sbUpd("previstos",m.previsto_id,{status:"recebido"});}catch(e){}}DB=await loadData();await lpLoad();}
    else{m.status="recebido";m.recebido_em=hoje;const p=DB.aReceber.find(x=>x.linha===`Comissão LP Daniel · ${m.mes_label}`);if(p)p.status="recebido";}
    toast("Recebido ✓");lpRender();}});}

/* ===== Cartões (lê dos movimentos lançados nas contas tipo cartão) ===== */
const cardContas=()=>(DB.contas||[]).filter(c=>c.tipo==="cartao"||/cart/i.test(c.nome));
let CART_SEL=null, FAT_SEL=null;
/* Config de fatura por cartao (dia do mes): f=fechamento, v=vencimento. Default: fecha fim do mes, vence 10. */
/* pag = conta que PAGA a fatura (o débito real sai dela, não do cartão) */
const FATURA_CFG={"cartao inter empresas":{f:3,v:10,pag:"Inter PJ"},"cartao inter microbusiness":{f:3,v:10,pag:"Inter PJ"},"cartao inter pf":{f:5,v:12,pag:"Inter PF"},"cartao nubank familia":{f:3,v:10,pag:"Conta Nubank Familia"}}; // Nubank: vence 10 (creditData Pluggy), fecha ~7 dias antes
const cfgKey=n=>(n||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,""); // ignora acento
const faturaCfg=n=>FATURA_CFG[cfgKey(n)]||{f:31,v:10};
/* mes-fatura (YYYY-MM) de uma compra, pela data de FECHAMENTO (compra depois do fechamento cai na proxima fatura) */
function faturaMes(diso,close){let a=(diso||"").split("-").map(Number);let y=a[0],m=a[1],d=a[2];if(d>close){m++;if(m>12){m=1;y++;}}return y+"-"+String(m).padStart(2,"0");}
const faturaVenc=(fk,vd)=>fk+"-"+String(Math.min(vd,28)).padStart(2,"0");
/* data de FECHAMENTO da fatura fk (dia f, respeitando mês curto: fev fecha no 28/29) */
const faturaFech=(fk,fd)=>{const[y,m]=fk.split("-").map(Number);const last=new Date(y,m,0).getDate();return fk+"-"+String(Math.min(fd,last)).padStart(2,"0");};
const stBadge=st=>({paga:'background:#e7f6ec;color:#16a34a',aberta:'background:#eef2ff;color:#4f46e5',vencida:'background:#fef2f2;color:#dc2626',futura:'background:#f1f5f9;color:#64748b'}[st]||'');
const stLabel=st=>({paga:'Paga',aberta:'Aberta',vencida:'Vencida',futura:'Futura'}[st]||st);
/* Agrupa os lançamentos de um cartão por FATURA e resolve o status de cada uma.
   Extraído da tela porque a automação (fatura fechada → conta a pagar) precisa
   exatamente do mesmo cálculo — status divergente entre tela e automação seria
   o caminho curto pra gerar conta a pagar de fatura já quitada. */
function faturasDoCartao(nome){
  const cfg=faturaCfg(nome),hoje=todayISO();
  const movs=DB.movimentos.filter(m=>m.banco===nome);
  // agrupa por FATURA (data de fechamento)
  const fat=new Map();movs.forEach(m=>{const k=faturaMes(m.data,cfg.f);if(!fat.has(k))fat.set(k,{fk:k,compras:0,pagtos:0,n:0,txs:[]});const f=fat.get(k);f.txs.push(m);if(m.sentido==="Saída"){f.compras+=m.valor;f.n++;}else f.pagtos+=m.valor;});
  const fs=[...fat.values()].sort((a,b)=>a.fk.localeCompare(b.fk));
  /* Status ANCORADO NO BANCO (fonte da verdade = saldo_atual que o Pluggy grava:
     é a dívida real do cartão hoje). Se a dívida real cabe nas faturas ainda não
     vencidas, NENHUMA fatura fechada está em aberto — independente de gaps de
     histórico (pagamentos anteriores à janela de sync que não estão na base).
     Fallback sem saldo do banco: saldo devedor acumulado (pagamento pós-fechamento
     quita a fatura mais antiga). */
  fs.forEach(f=>{f.venc=faturaVenc(f.fk,cfg.v);f.fech=faturaFech(f.fk,cfg.f);f.fechada=hoje>f.fech;f.saldo=f.compras-f.pagtos;});
  const totalPag=fs.reduce((s,f)=>s+f.pagtos,0),totCompras0=fs.reduce((s,f)=>s+f.compras,0);
  const _cta=(DB.contas||[]).find(x=>x.nome===nome);
  const bancoDev=(_cta&&_cta.saldo_atual!=null&&isFinite(+_cta.saldo_atual))?+_cta.saldo_atual:null;
  if(bancoDev!=null){
    /* compara com compras BRUTAS não-vencidas: pagamento antecipado na corrente já
       reduziu a dívida do banco, então descontá-lo aqui contaria em dobro */
    const abertasBrutas=fs.filter(f=>f.venc>=hoje).reduce((s,f)=>s+f.compras,0);
    let excesso=bancoDev-abertasBrutas; // o que a dívida real NÃO explica pelas faturas correntes/futuras
    fs.slice().reverse().forEach(f=>{ if(f.venc>=hoje){f.status="aberta";return;}
      if(excesso>1){f.status="vencida";excesso-=Math.max(0,f.saldo);}else f.status="paga";});
  }else{
    let cumC=0;
    fs.forEach(f=>{cumC+=f.compras;f.status=f.venc<hoje?((totalPag+0.01>=cumC)?"paga":"vencida"):"aberta";});
  }
  return{cfg,movs,fat,fs,totalPag,totCompras0,bancoDev,conta:_cta};
}

/* ===== Fatura fechada → conta a pagar automática ==========================
   Quando a fatura FECHA (passou o dia de fechamento), ela nasce sozinha em
   Contas a Pagar com vencimento no dia do cartão. As regras que evitam bagunça:
   · valor = COMPRAS do ciclo. Pagamento que cai depois do fechamento quita a
     fatura ANTERIOR (é assim que `faturaMes` agrupa), então descontá-lo aqui
     subestimaria a conta;
   · idempotente: 1 conta por (cartão, fatura). Reconhece pelo carimbo em
     `observacao` e, na falta dele, por qualquer conta a pagar já ligada ao
     cartão vencendo no mesmo mês — pega também as que ele lançou na mão;
   · enquanto está ABERTA o valor é atualizado (o sync ainda traz compra
     retroativa); depois de paga/cancelada nunca mais encosta; valor digitado
     na mão também é intocável;
   · janela CURTA (7 dias depois do vencimento): a conta nasce quando a fatura
     FECHA, não retroativamente. Fatura velha o app não tem como saber se foi
     paga fora da janela de sync — chutar viraria atraso fantasma no Modo
     Financeiro. Os 7 dias são só a folga pra ele passar uma semana sem abrir
     o app. Nunca escreve em visão que a pessoa não pode editar.
   ========================================================================= */
const FAT_AUTO_KEY="cfin_fatura_auto_v1",FAT_STAMP_KEY="cfin_fatura_auto_run_v1",FAT_TAG="auto:fatura",FAT_JANELA=7;
const faturaAutoOn=()=>{try{return localStorage.getItem(FAT_AUTO_KEY)!=="0";}catch(e){return true;}};
const faturaTag=(cartao,fk)=>FAT_TAG+" "+cfgKey(cartao)+" "+fk;
const faturaDesc=(cartao,fk)=>`Fatura ${cartao} ${fk.slice(5,7)}/${fk.slice(0,4)}`;
/* CONTA PAGADORA da fatura. A conta a pagar NÃO pode ficar amarrada ao cartão:
   o ✓ das Contas do mês lança o movimento na conta do previsto (`ctPay`), e uma
   Saída no cartão é lida como COMPRA por `faturasDoCartao` — a fatura seguinte
   viria inflada. O débito real sai da conta corrente; é lá que ele mora.
   Mapa explícito em FATURA_CFG.pag; fallback = conta não-cartão da mesma visão
   que compartilha um pedaço do nome do cartão (ex.: "Cartao Inter PF" → "Inter PF"). */
function faturaContaPag(cartao){
  const L=(DB.contas||[]).filter(c=>c.ativo!==false&&c.tipo!=="cartao"&&!/cart/i.test(c.nome));
  const alvo=faturaCfg(cartao).pag;
  if(alvo){const c=L.find(x=>cfgKey(x.nome)===cfgKey(alvo));if(c)return c.nome;}
  const toks=cfgKey(cartao).split(/\s+/).filter(t=>t.length>2&&t!=="cartao");
  const c=L.find(x=>{const k=cfgKey(x.nome);return toks.some(t=>k.indexOf(t)>=0);});
  return c?c.nome:null;
}
/* conta a pagar que já representa esta fatura (carimbo › descrição › cartão citado no mês) */
function faturaPrevisto(cartao,fk){
  const venc=faturaVenc(fk,faturaCfg(cartao).v),tag=faturaTag(cartao,fk),desc=faturaDesc(cartao,fk),L=DB.contasPagar||[];
  const k=cfgKey(cartao);
  return L.find(p=>(p.obs||"").indexOf(tag)>=0)
      ||L.find(p=>p.descricao===desc)
      /* lançada na mão: mesmo mês e o cartão aparece no nome OU na conta
         (pega tanto a antiga presa ao cartão quanto a presa à conta pagadora) */
      ||L.find(p=>monthKey(p.vencimento)===monthKey(venc)&&(p.banco===cartao||cfgKey(p.descricao||"").indexOf(k)>=0))
      ||null;
}
async function faturaGravar(cartao,f){
  const visao=((DB.contas||[]).find(c=>c.nome===cartao)||{}).visao||VISAO;
  if(!podeEditar(visao))return{acao:"sem-permissao"};
  const total=Math.round(f.compras*100)/100;
  if(total<=0)return{acao:"vazia"};
  const ja=faturaPrevisto(cartao,f.fk);
  if(ja){
    if(String(ja.status||"").toLowerCase()!=="aberto")return{acao:"nada",prev:ja};
    if((ja.obs||"").indexOf(FAT_TAG)<0)return{acao:"manual",prev:ja};
    if(Math.abs(Number(ja.valor||0)-total)<0.01)return{acao:"nada",prev:ja};
    if(MODE==="live")await sbUpd("previstos",ja._row,{valor:total});
    ja.valor=total;return{acao:"atualizado",prev:ja,valor:total};
  }
  const pag=faturaContaPag(cartao);   /* débito sai da conta corrente, não do cartão */
  const o={_row:"p"+Date.now(),descricao:faturaDesc(cartao,f.fk),vencimento:f.venc,valor:total,categoria:"Pagamento fatura cartão",banco:pag||"",status:"aberto",recorrencia:"",obs:faturaTag(cartao,f.fk)};
  if(MODE==="live")o._row=await sbIns("previstos",{descricao:o.descricao,valor:total,vencimento:f.venc,tipo:"pagar",status:"aberto",visao,conta_id:pag?contaId(pag):null,categoria_id:catId("Pagamento fatura cartão"),observacao:o.obs});
  DB.contasPagar.push(o);
  return{acao:"criado",prev:o,valor:total};
}
/* varre os cartões da visão aberta; 1x por dia por visão (ou forçado pelo toggle) */
async function faturaAutoRun(opt){if(isAll())return;   /* automação de escrita não roda no consolidado */
  
  opt=opt||{};
  if(MODE!=="live"||!faturaAutoOn())return 0;
  const hoje=todayISO();
  if(!opt.forcar){
    let st={};try{st=JSON.parse(localStorage.getItem(FAT_STAMP_KEY)||"{}");}catch(e){}
    if(st[VISAO]===hoje)return 0;
    st[VISAO]=hoje;try{localStorage.setItem(FAT_STAMP_KEY,JSON.stringify(st));}catch(e){}
  }
  const d=new Date(hoje+"T12:00:00");d.setDate(d.getDate()-FAT_JANELA);const corte=d.toISOString().slice(0,10);
  let n=0;
  for(const c of cardContas()){
    let fs;try{fs=faturasDoCartao(c.nome).fs;}catch(e){continue;}
    for(const f of fs){
      if(!f.fechada||f.venc<corte||f.status==="paga")continue;
      try{const r=await faturaGravar(c.nome,f);if(r.acao==="criado"||r.acao==="atualizado")n++;}catch(e){}
    }
  }
  if(n)toast(n===1?"Fatura fechada virou conta a pagar ✓":n+" faturas viraram contas a pagar ✓");
  return n;
}
function faturaAutoSet(on){
  try{localStorage.setItem(FAT_AUTO_KEY,on?"1":"0");}catch(e){}
  if(!on){toast("Automático desligado");viewCartoes();return;}
  toast("Automático ligado");
  faturaAutoRun({forcar:true}).then(()=>viewCartoes()).catch(e=>toast("Erro: "+e.message));
}

/* ===== Cartões 2.0 (30/08) — hierarquia: 1) painel de TODOS os cartões, 2) "quanto
   pago e quando" em destaque, 3) régua enxuta (histórico sob demanda), 4) lançamentos
   em cards no mobile. Status continua ancorado na dívida real do banco. */
let CART_HIST=false;
/* resumo de UM cartão pro painel geral e pro hero: qual é o PRÓXIMO pagamento */
function cartaoResumo(nome){
  const f=faturasDoCartao(nome),hoje=todayISO();
  const vencidas=f.fs.filter(x=>x.status==="vencida");
  const fechadas=f.fs.filter(x=>x.fechada&&x.status==="aberta").sort((a,b)=>a.venc.localeCompare(b.venc));
  const corrente=f.fs.find(x=>!x.fechada&&x.venc>=hoje)||null;
  let prox=null;
  if(vencidas.length)prox={tipo:"atraso",valor:vencidas.reduce((s,x)=>s+Math.max(0,x.saldo),0),quando:vencidas[0].venc,fk:vencidas[vencidas.length-1].fk};
  else if(fechadas.length)prox={tipo:"fechada",valor:fechadas[0].compras,quando:fechadas[0].venc,fk:fechadas[0].fk};
  /* fatura corrente = COMPRAS brutas do ciclo (31/08): pagamento que cai DENTRO do ciclo
     quita a fatura ANTERIOR (é assim que faturaMes agrupa) — descontar aqui zerava o hero
     ("Set/26 R$ 0,00" com 3,2k de compras) */
  else if(corrente)prox={tipo:"corrente",valor:corrente.compras,quando:corrente.fech,fk:corrente.fk};
  const gastoAteHoje=f.movs.filter(m=>m.sentido==="Saída"&&m.data<=hoje).reduce((s,m)=>s+m.valor,0);
  return{f,prox,gastoAteHoje,conta:f.conta,bancoDev:f.bancoDev};
}
function cartoesGeralPanel(cards){
  const hoje=todayISO();
  return`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(225px,1fr));gap:10px;margin-bottom:14px">${cards.map(c=>{
    const r=cartaoResumo(c.nome),ativo=c.nome===CART_SEL;
    const p=r.prox;
    const proxTxt=!p?`<span class="sub" style="margin:0">sem fatura</span>`
      :p.tipo==="atraso"?`<b style="color:#dc2626">⚠️ em atraso ${fmtBRL(p.valor)}</b> <span class="sub" style="margin:0">desde ${fmtDate(p.quando)}</span>`
      :p.tipo==="fechada"?`<b>Pagar ${fmtBRL(p.valor)}</b> <span class="sub" style="margin:0">até ${fmtDate(p.quando)}</span>`
      :`<span class="sub" style="margin:0">fatura aberta ${fmtBRL(Math.max(0,p.valor))} · fecha ${fmtDate(p.quando)}</span>`;
    const semFeed=(r.bancoDev==null);
    const ultMov=semFeed?(r.f.movs.filter(m=>m.data<=hoje).map(m=>m.data).sort().pop()||null):null;
    const feedTag=semFeed
      ?(ultMov&&frescorDias(ultMov)>7?`<div style="font-size:9px;margin-top:2px;color:#dc2626;font-weight:700">⚠️ sem feed do banco · últ. lançamento ${fmtDate(ultMov)}</div>`:"")
      :frescorTag(r.conta&&r.conta.saldo_atualizado_em);
    return`<div onclick="CART_SEL='${esc(c.nome)}';FAT_SEL=null;viewCartoes()" role="button" tabindex="0" style="cursor:pointer;background:var(--card);border:1px solid ${ativo?'var(--primary)':'var(--border)'};border-radius:12px;padding:12px 14px;${ativo?'box-shadow:0 0 0 1px var(--primary) inset':''}">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:6px"><b style="font-size:13px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">💳 ${esc(c.nome)}</b>${ativo?'<span class="sub" style="margin:0;font-size:10px">aberto</span>':''}</div>
      <div class="out" style="font-size:19px;font-weight:700;margin:4px 0 0">${fmtBRL(r.bancoDev!=null?r.bancoDev:r.gastoAteHoje)}</div>
      <div class="sub" style="margin:0;font-size:10px">${r.bancoDev!=null?"dívida no banco":"gasto lançado (sem feed)"}</div>
      ${feedTag}
      <div style="margin-top:8px;font-size:12.5px">${proxTxt}</div>
    </div>`;}).join("")}</div>`;
}
function viewCartoes(){const cards=cardContas();
  if(!cards.length){$("#view").innerHTML=`<div class="row"><div><h1>Cartões</h1></div></div><div class="panel"><div class="empty">Nenhum cartão cadastrado. Crie em Configurações › Cartões.</div></div>`;return;}
  if(!CART_SEL||!cards.some(c=>c.nome===CART_SEL))CART_SEL=cards[0].nome;
  const isMob=window.matchMedia&&window.matchMedia("(max-width:920px)").matches;
  const hoje=todayISO(),R=cartaoResumo(CART_SEL),_f=R.f;
  const cfg=_f.cfg,movs=_f.movs,fat=_f.fat,fs=_f.fs,totalPag=_f.totalPag,totCompras0=_f.totCompras0,bancoDev=_f.bancoDev;
  if(!FAT_SEL||!fat.has(FAT_SEL))FAT_SEL=(R.prox&&R.prox.fk)||(fs[fs.length-1]||{fk:""}).fk;
  const sel=fat.get(FAT_SEL)||{fk:"",compras:0,pagtos:0,n:0,txs:[],venc:""};
  const parcFut=movs.filter(m=>m.sentido==="Saída"&&m.data>hoje);
  const parcFutTot=parcFut.reduce((s,m)=>s+m.valor,0);
  const contaCard=R.conta;
  const atzCard=(()=>{if(!contaCard||!contaCard.saldo_atualizado_em)return"";const ts=contaCard.saldo_atualizado_em,d=frescorDias(ts),ftx=fmtDate(String(ts).slice(0,10));
    return(d!=null&&d>3)?`<b style="color:#dc2626">⚠️ feed parado · dado de ${ftx} (${d}d)</b>`:`dado do banco de ${ftx}`;})();
  const melhorDia=(cfg.f%31)+1;
  /* HERO: quanto pago e quando */
  const p=R.prox;
  const hero=!p?`<div class="sub">Sem faturas.</div>`
    :p.tipo==="atraso"?`<div class="lbl" style="font-size:12px;color:#dc2626;font-weight:700">⚠️ FATURA EM ATRASO</div><div class="val out" style="font-size:30px;font-weight:750">${fmtBRL(p.valor)}</div><div class="sub" style="margin:2px 0 0">vencida desde ${fmtDate(p.quando)} — regularizar no banco</div>`
    :p.tipo==="fechada"?`<div class="lbl" style="font-size:12px">💳 Próximo pagamento</div><div class="val out" style="font-size:30px;font-weight:750">${fmtBRL(p.valor)}</div><div class="sub" style="margin:2px 0 0">fatura ${mkLabel(p.fk)} fechada · vence <b>${fmtDate(p.quando)}</b>${faturaPrevisto(CART_SEL,p.fk)?' · 📄 já em Contas a Pagar':''}</div>`
    :`<div class="lbl" style="font-size:12px">💳 Fatura aberta (${mkLabel(p.fk)})</div><div class="val out" style="font-size:30px;font-weight:750">${fmtBRL(Math.max(0,p.valor))}</div><div class="sub" style="margin:2px 0 0">até agora · fecha <b>${fmtDate(p.quando)}</b> · nada vencendo antes disso</div>`;
  const confer=bancoDev!=null?(()=>{const calc=totCompras0-totalPag;const d=calc-bancoDev;return`🏦 dívida no banco <b>${fmtBRL(bancoDev)}</b>${atzCard?` <span class="sub" style="margin:0;font-size:11px">(${atzCard})</span>`:""} · lançamentos ${fmtBRL(calc)} ${Math.abs(d)<=50?'<b style="color:#16a34a">✔ confere</b>':`Δ ${fmtBRL(d)} <span title="Diferença normalmente = histórico anterior à janela de sincronização. O status das faturas usa a dívida real do banco.">ⓘ</span>`}`;})():`<b style="color:#dc2626">sem feed do banco</b> — status estimado pelos lançamentos`;
  /* régua ENXUTA: atrasadas + 3 últimas + corrente + 1 futura; resto atrás de "histórico" */
  let _ci=fs.findIndex(f=>f.venc>=hoje);if(_ci<0)_ci=fs.length-1;
  /* ciclo corrente = a fatura em que uma compra de HOJE cai (não "1ª com venc futuro":
     com buraco de meses, a futura distante virava "corrente" e perdia o selo Futura) */
  const curFk=faturaMes(hoje,cfg.f);
  const passadas=fs.filter(f=>f.fk<curFk),futuras=fs.filter(f=>f.fk>curFk);
  /* futuras só entram na régua se forem o mês SEGUINTE — parcela solta lá em 2027 não polui */
  const janela=[...passadas.slice(-3),...fs.filter(f=>f.fk===curFk),...(futuras[0]&&futuras[0].fk===addMonth(curFk,1)?[futuras[0]]:[])];
  const foraJanela=fs.filter(f=>!janela.includes(f));
  const showFs=(CART_HIST?fs.slice():janela.slice()).reverse();
  const futEscondidas=foraJanela.filter(f=>f.venc>hoje);
  /* COR SEGUE O STATUS (31/08, queixa dele): antes seguia compras−pagtos do CICLO — como o
     pagamento cai no ciclo SEGUINTE, fatura PAGA ficava vermelha. E fatura futura de parcela
     aparecia "Aberta" (parecia conta em aberto): agora é "Futura", cinza. */
  const regua=`<div style="display:flex;gap:10px;overflow-x:auto;padding:2px 2px 4px">${showFs.map(f=>{
     const st=f.fk>curFk?"futura":f.status;
     const vCls=st==="paga"?"in":(st==="vencida"?"out":"");
     return`
     <div onclick="FAT_SEL='${f.fk}';viewCartoes()" style="cursor:pointer;flex:0 0 auto;min-width:150px;border:1px solid var(--border);border-radius:12px;padding:10px 12px;background:var(--card);${st==="futura"?"opacity:.75;":""}${f.fk===FAT_SEL?'box-shadow:0 0 0 2px var(--primary) inset;border-color:var(--primary)':''}">
       <div style="display:flex;justify-content:space-between;align-items:center;gap:6px"><b style="font-size:12.5px">${mkLabel(f.fk)}${faturaPrevisto(CART_SEL,f.fk)?` <span title="Já está em Contas a Pagar" style="font-size:11px">📄</span>`:""}</b><span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:99px;${stBadge(st)}">${stLabel(st)}</span></div>
       <div style="font-size:18px;font-weight:700;margin:5px 0 2px" class="${vCls}">${fmtBRL(f.compras)}</div>
       <div class="sub" style="margin:0;font-size:10.5px">venc ${fmtDate(f.venc)} · ${f.n} compras</div>
     </div>`;}).join("")||`<div class="empty">Sem faturas.</div>`}</div>
   <div class="sub" style="margin:2px 0 12px;font-size:11px">${foraJanela.length?`<span class="link" onclick="CART_HIST=!CART_HIST;viewCartoes()">${CART_HIST?"‹ esconder histórico/futuras":`ver todas as ${fs.length} faturas ›`}</span>${!CART_HIST&&futEscondidas.length?` · ${parcFut.length} parcela(s) futura(s) somando ${fmtBRL(parcFutTot)} espalhadas até ${fmtDate((futEscondidas[futEscondidas.length-1]||{}).venc||hoje)}`:""}`:(parcFut.length?`${parcFut.length} parcela(s) futura(s) somando ${fmtBRL(parcFutTot)}`:"")}</div>`;
  /* lançamentos: cards no mobile, tabela no desktop */
  const txs=(sel.txs||[]).slice().sort((a,b)=>b.data.localeCompare(a.data));
  const rowClick=m=>SELMODE?`selRow('${m._row}')`:`editMovimento('${m._row}')`;
  const lanc=bulkBar()+(isMob
    ?txs.map(m=>{const on=SEL.has(m._row);return`<div class="ct-row" onclick="${rowClick(m)}" role="button" tabindex="0" style="cursor:pointer;${on?"box-shadow:0 0 0 2px var(--primary) inset;border-radius:10px":""}">
        ${SELMODE?`<input type="checkbox" class="cb" ${on?"checked":""} onclick="event.stopPropagation();selRow('${m._row}')" style="margin-right:4px">`:""}
        <div class="dot-day"><b>${m.data.slice(8,10)}</b><span>${ML[+m.data.slice(5,7)-1]}</span></div>
        <div class="ct-main"><b>${esc(m.descricao)}</b><small>${m.categoria?esc(m.categoria):'<span class="chip none">sem cat.</span>'}${movTagsHtml(m)?" · "+movTagsHtml(m):""}</small></div>
        <div class="ct-val num ${m.sentido==='Entrada'?'in':''}">${m.sentido==='Entrada'?'+':'−'} ${fmtBRL(m.valor)}</div></div>`;}).join("")||`<div class="empty">Sem lançamentos nesta fatura.</div>`
    :`<table><thead><tr>${SELMODE?"<th></th>":""}<th>Data</th><th>Descrição</th><th>Categoria</th><th class="num">Valor</th></tr></thead><tbody>${txs.map(m=>`<tr style="cursor:pointer${SEL.has(m._row)?";background:var(--chip,#eef2ff)":""}" onclick="${rowClick(m)}">${SELMODE?`<td><input type="checkbox" class="cb" ${SEL.has(m._row)?"checked":""} onclick="event.stopPropagation();selRow('${m._row}')"></td>`:""}<td>${fmtDate(m.data)}</td><td>${esc(m.descricao)}${movTagsHtml(m)?`<div style="margin-top:2px">${movTagsHtml(m)}</div>`:""}</td><td>${m.categoria?`<span class="chip">${esc(m.categoria)}</span>`:`<span class="chip none">sem cat.</span>`}</td><td class="num ${m.sentido==='Entrada'?'in':'out'}">${m.sentido==='Entrada'?'+':'−'} ${fmtBRL(m.valor)}</td></tr>`).join("")||`<tr><td colspan="5"><div class="empty">Sem lançamentos nesta fatura.</div></td></tr>`}</tbody></table>`);
  $("#view").innerHTML=`<div class="row"><div><h1>Cartões</h1><div class="sub">toque num cartão pra abrir o detalhe</div></div></div>
  ${cartoesGeralPanel(cards)}
  <div class="panel">
    <div class="row" style="margin:0 0 6px"><h2 style="margin:0">💳 ${esc(CART_SEL)}</h2><span class="sub" style="margin:0;font-size:11px">fecha dia ${cfg.f} · vence dia ${cfg.v} · melhor dia de compra ${melhorDia}</span></div>
    ${hero}
    <div class="sub" style="margin:10px 0 0;font-size:12px">${confer}</div>
    <label class="sub" style="display:inline-flex;align-items:center;gap:6px;margin:8px 0 0;cursor:pointer;font-size:12px"><input type="checkbox" ${faturaAutoOn()?"checked":""} onchange="faturaAutoSet(this.checked)" style="margin:0"> Fatura fechada vira Conta a Pagar sozinha${(()=>{const pg=faturaContaPag(CART_SEL);return pg?` <b>· debita em ${esc(pg)}</b>`:` <b style="color:#dc2626">· sem conta pagadora definida</b>`;})()}</label>
  </div>
  ${regua}
  <div class="panel"><div class="row"><h2 style="margin:0">Fatura ${mkLabel(sel.fk)} · ${sel.txs.length} lançamentos${sel.pagtos?` <span class="sub" style="font-weight:400;font-size:11px">compras ${fmtBRL(sel.compras)} · pagamentos ${fmtBRL(sel.pagtos)}</span>`:""}</h2><div style="display:flex;gap:8px">${selBtn()}<button class="btn ghost sm" onclick="gerarFatura('${sel.fk}')">Gerar conta a pagar</button></div></div>
   ${lanc}</div>`;}
/* botão manual: mesmo caminho da automação (antes ele duplicava a cada clique) */
async function gerarFatura(fk){if(isAll()){toast("Escolha uma visão pra gerar a conta");return;}
  const cartao=CART_SEL,f=faturasDoCartao(cartao).fs.find(x=>x.fk===fk);
  if(!f){toast("Fatura não encontrada");return;}
  try{
    const r=await faturaGravar(cartao,f);
    toast({criado:"Fatura lançada em Contas a Pagar ✓",atualizado:"Conta a pagar atualizada pro valor da fatura ✓",nada:"Essa fatura já está em Contas a Pagar",manual:"Já existe uma conta a pagar lançada na mão pra essa fatura",vazia:"Fatura sem compras",'sem-permissao':"Você não pode editar a visão deste cartão"}[r.acao]||"");
    if(r.acao==="criado")route("pagar");else viewCartoes();
  }catch(e){toast("Erro: "+e.message);}
}

/* ===== Importar ===== */
function viewImportar(){$("#view").innerHTML=`<div class="row"><div><h1>Importar</h1><div class="sub">Tipo + destino + arquivo (ou cole)</div></div></div><div class="panel"><div class="controls"><div class="fld"><label class="sub" style="margin:0">Tipo</label><select id="impTipo"><option value="auto">Detectar</option><option value="ofx">Extrato OFX</option><option value="csv">Extrato CSV</option><option value="fatura">Fatura cartão</option><option value="compensatio">Compensatio</option></select></div><div class="fld"><label class="sub" style="margin:0">Lançar em</label><select id="impDest"></select></div></div><div class="controls"><input id="impFile" type="file" accept=".ofx,.qfx,.csv,.txt,.xml,.pdf,.xlsx,.jpg,.jpeg,.png,.webp,.heic"><span class="sub">ou cole ↓ · PDF/foto lê com IA</span></div><textarea id="imp" placeholder="Cole o conteúdo..." style="width:100%;height:120px;font-family:ui-monospace,monospace;font-size:12px"></textarea><div style="margin-top:10px"><button class="btn" onclick="doImport()">Processar</button></div><div id="impOut" style="margin-top:14px"></div></div>`;const fill=()=>{const t=$("#impTipo").value;const opts=(t==="fatura")?cartaoOpts():bancoOpts();$("#impDest").innerHTML=opts.map(o=>`<option>${esc(o)}</option>`).join("");};$("#impTipo").onchange=fill;fill();}
function doImport(){const file=$("#impFile").files[0];
  if(file){const ext=file.name.toLowerCase().split(".").pop();
    if(["pdf","jpg","jpeg","png","webp","heic","heif"].includes(ext))return importViaIA(file,ext);
    if(["xlsx","xls"].includes(ext)){$("#impOut").innerHTML=`<div class="empty">Excel ainda não: exporte como CSV ou cole o texto.</div>`;return;}
    const rd=new FileReader();rd.onload=()=>runImport(rd.result);rd.readAsText(file);return;}
  runImport($("#imp").value);}
function renderImportPreview(r,dest){if(!r.txs.length){$("#impOut").innerHTML=`<div class="empty">Nada reconhecido.</div>`;return;}r.txs.forEach(x=>x.cat=suggestCategoria(x.description));const tot=r.txs.reduce((s,x)=>s+(x.sign==="Entrada"?x.amount:-x.amount),0);window._imp={r,dest};$("#impOut").innerHTML=`<div class="sub" style="margin-bottom:8px">Detectado <b>${r.kind.toUpperCase()}</b> · ${r.txs.length} transações · líquido ${fmtBRL(tot)} · destino <b>${esc(dest)}</b>${(r.saldo_final!=null&&isFinite(r.saldo_final))?` · saldo final <b>${fmtBRL(r.saldo_final)}</b> → vira o saldo da conta`:""}</div><table><thead><tr><th>Data</th><th>Descrição</th><th>Cat. sugerida</th><th class="num">Valor</th></tr></thead><tbody>${r.txs.map(x=>`<tr><td>${fmtDate(x.date)}</td><td>${esc(x.description)}</td><td>${x.cat?`<span class="chip">${esc(x.cat)}</span>`:`<span class="chip none">—</span>`}</td><td class="num ${x.sign==="Entrada"?"in":"out"}">${x.sign==="Entrada"?"+":"−"} ${fmtBRL(x.amount)}</td></tr>`).join("")}</tbody></table><div style="margin-top:10px"><button class="btn" onclick="lancarImport()">Lançar ${r.txs.length} ${MODE==="live"?"no Supabase":"(demo)"}</button></div>`;}
function runImport(text){if(!text||!text.trim()){toast("Anexe ou cole");return;}const tipo=$("#impTipo").value,dest=$("#impDest").value,r=parseByType(text,tipo);renderImportPreview(r,dest);}
/* PDF/foto/print → Gemini (Edge Function importar-extrato). A chave fica no servidor; só o upload sobe pra própria função, e o preview/dedup/categoria reusam o fluxo do OFX. */
const MIME={pdf:"application/pdf",jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",webp:"image/webp",heic:"image/heic",heif:"image/heif"};
function importViaIA(file,ext){
  if(!HAS_KEY){$("#impOut").innerHTML=`<div class="empty">Leitura por IA precisa do app conectado (modo LIVE). Em demo, use OFX/CSV.</div>`;return;}
  const dest=$("#impDest").value,tipo=$("#impTipo").value;
  $("#impOut").innerHTML=`<div class="sub">🤖 Lendo ${ext.toUpperCase()} com IA… pode levar alguns segundos.</div>`;
  const rd=new FileReader();
  rd.onload=async()=>{
    const b64=String(rd.result).split(",")[1]||"";
    try{
      const resp=await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/importar-extrato`,{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${CONFIG.SUPABASE_ANON_KEY}`,"apikey":CONFIG.SUPABASE_ANON_KEY},body:JSON.stringify({file_base64:b64,mime_type:MIME[ext]||file.type||"image/jpeg"})});
      const data=await resp.json().catch(()=>({}));
      if(!resp.ok){const over=resp.status===503||data.status===503||data.status===429||/sobrecarreg|high demand|UNAVAILABLE/i.test((data.detail||"")+(data.error||""));$("#impOut").innerHTML=`<div class="empty">${over?"⏳ A IA está sobrecarregada nesse instante. Espera uns segundos e clica <b>Processar</b> de novo.":`IA falhou: ${esc(data.error||resp.status)}. Tente uma foto mais nítida ou exporte OFX.`}</div>`;return;}
      const txs=(data.transactions||[]).map(t=>({date:t.date,description:t.description,amount:Math.abs(+t.amount||0),sign:t.sign==="Entrada"?"Entrada":"Saída"})).filter(t=>t.date&&t.amount>0);
      if(!txs.length){$("#impOut").innerHTML=`<div class="empty">A IA não achou transações nesse arquivo. Tente uma imagem mais nítida ou o extrato em OFX/CSV.</div>`;return;}
      renderImportPreview({kind:tipo==="fatura"?"fatura":"ia",txs,saldo_final:(data.saldo_final!=null&&isFinite(+data.saldo_final))?+data.saldo_final:null},dest);
    }catch(e){$("#impOut").innerHTML=`<div class="empty">Erro ao chamar a IA: ${esc(e.message||e)}.</div>`;}
  };
  rd.readAsDataURL(file);
}
async function lancarImport(){const{r,dest}=window._imp||{};if(!r)return;const isFat=r.kind==="fatura";
  /* GUARD ANTI-DUPLICATA (count-aware): valida CADA linha entrante contra o que JÁ existe,
     independente da fonte (extrato novo, antigo, sync, IA). Impressão digital data+valor+sinal+conta,
     por CONTAGEM (multiset): se o banco tem 2 e o arquivo traz 4, entram só as 2 que faltam.
     Resolve: reimport do mesmo extrato (0 novas), extrato retroativo sobre dados de sync (só o gap),
     e transações legítimas repetidas no mesmo dia (ex.: 4× lavanderia R$14,99 — antes o Set descartava 3). */
  const norm=s=>String(s||"").trim().toLowerCase();
  const keyOf=(d,v,desc,c,sign)=>isFat?[d,v,norm(desc),norm(c)].join("|"):[d,v,sign,norm(c)].join("|");
  const cnt=new Map();
  (isFat?DB.cartoes:DB.movimentos).forEach(m=>{const k=isFat?keyOf(m.data,m.valor,m.descricao,m.cartao):keyOf(m.data,m.valor,m.descricao,m.banco,m.sentido);cnt.set(k,(cnt.get(k)||0)+1);});
  let n=0,dup=0,err=0;
  for(const x of r.txs){
    const key=keyOf(x.date,x.amount,x.description,dest,x.sign);
    const c=cnt.get(key)||0;
    if(c>0){cnt.set(key,c-1);dup++;continue;}
    try{
      if(isFat){const o={_row:"k"+Date.now()+n,data:x.date,descricao:x.description,cartao:dest,valor:x.amount,subcategoria:x.cat||"",mesFatura:x.date.slice(5,7)+"/"+x.date.slice(0,4)};if(MODE==="live")o._row=await sbIns("cartao_transacoes",{cartao_id:contaId(dest),data_compra:x.date,data_fatura:x.date.slice(0,7)+"-01",descricao:x.description,valor:x.amount,parcela_atual:1,parcela_total:1,categoria_id:catId(x.cat),visao:VISAO,hash:uhash(x.description+x.date+x.amount)});DB.cartoes.unshift(o);}
      else{const o={_row:"d"+Date.now()+n,data:x.date,descricao:x.description,valor:x.amount,sentido:x.sign,banco:dest,categoria:x.cat||"",mes:+x.date.slice(5,7),ano:+x.date.slice(0,4)};if(MODE==="live")o._row=await sbIns("movimentos",{data:x.date,descricao_original:x.description,descricao_limpa:x.description,valor:x.amount,sinal:x.sign==="Entrada"?1:-1,conta_id:contaId(dest),categoria_id:catId(x.cat),visao:VISAO,hash:uhash(x.description+x.date+x.amount+(x.bal!=null?"|"+x.bal:""))});DB.movimentos.unshift(o);}
      n++;
    }catch(e){err++;}
  }
  /* saldo override: o saldo final do extrato vira o saldo OFICIAL da conta (igual ao sync do Inter) — o card passa a bater com o banco mesmo com duplicata ou histórico faltando, pois contaSaldos ignora a soma cega quando há saldo_atual. Guarda: extrato mais antigo não sobrescreve saldo mais novo. */
  let saldoMsg="";
  if(!isFat&&r.saldo_final!=null&&isFinite(r.saldo_final)){
    const conta=(DB.contas||[]).find(c=>c.id===contaId(dest));
    if(conta){
      const refDate=(r.txs.reduce((mx,x)=>x.date>mx?x.date:mx,"")||todayISO()).slice(0,10);
      const prevD=conta.saldo_atualizado_em?String(conta.saldo_atualizado_em).slice(0,10):"";
      if(!prevD||refDate>=prevD){
        const sf=Number(r.saldo_final),ts=new Date().toISOString();
        try{if(MODE==="live")await sbUpd("contas",conta.id,{saldo_atual:sf,saldo_atualizado_em:ts});conta.saldo_atual=sf;conta.saldo_atualizado_em=ts;saldoMsg="saldo da conta → "+fmtBRL(sf);}catch(e){}
      }
    }
  }
  toast([`${n} lançados`,dup?`${dup} ignorados (já existiam)`:"",saldoMsg,err?`${err} com erro`:""].filter(Boolean).join(" · "));
  await afterWrite();route(isFat?"cartoes":"movimentos");}

/* ===== Fluxo de Caixa (realizado + projeção c/ recorrentes) ===== */
let FLUXO_H=6;
function viewFluxo(){const tk=todayISO().slice(0,7);
  const real=[...new Set(DB.movimentos.map(m=>monthKey(m.data)).filter(Boolean))].sort().filter(k=>k<=tk).slice(-FLUXO_H);
  const months=[]; let cur=real.length?real[0]:tk; const end=addMonth(tk,6);
  // monta sequência contígua do 1º realizado até tk+6
  let g=cur; const last=addMonth(tk,6); while(g<=last){months.push(g);g=addMonth(g,1);}
  const ent={},sai={};DB.movimentos.filter(m=>!isForaAgregado(m)).forEach(m=>{const k=monthKey(m.data);if(m.sentido==="Entrada")ent[k]=(ent[k]||0)+m.valor;else sai[k]=(sai[k]||0)+m.valor;});
  // projeção: previstos abertos por mês de vencimento; recorrentes mensais replicam pra frente
  const rec={},pag={},orc={},pagCats={};
  // inclui o mês CORRENTE na projeção (realizado + a receber/pagar do mês + VENCIDOS em aberto)
  // ocorrências normais do mês + a ÂNCORA VENCIDA (aberta) somada no mês corrente — recorrente ou não:
  // ex.: MJM venc 20/06 aberto + recorrência de 20/07 ⇒ julho mostra 2× (o atrasado não some)
  DB.aReceber.filter(a=>(a.status||"").toLowerCase()!=="recebido").forEach(a=>{const k=monthKey(a.dataPrevista);if(!k)return;months.forEach(mm=>{if(mm<tk)return;let x=0;if(mm===k||(a.recorrencia==="mensal"&&mm>=k))x++;if(mm===tk&&k<tk)x++;if(x)rec[mm]=(rec[mm]||0)+x*a.previstoLiquido;});});
  DB.contasPagar.filter(c=>(c.status||"").toLowerCase()==="aberto"&&!isPrevFatura(c)).forEach(c=>{const k=monthKey(c.vencimento);if(!k)return;months.forEach(mm=>{if(mm<tk)return;let x=0;if(mm===k||(c.recorrencia==="mensal"&&mm>=k))x++;if(mm===tk&&k<tk)x++;if(x){pagCats[mm]=pagCats[mm]||new Set();if(c.categoria)pagCats[mm].add(c.categoria);pag[mm]=(pag[mm]||0)+x*c.valor;}});});
  /* Orçamento como projeção de despesa VARIÁVEL.
     Só entra a categoria que NÃO tem conta a pagar prevista naquele mês — assim
     o teto de "Mercado" projeta, mas o teto de "Moradia" não soma em cima do
     condomínio que já está cadastrado. Fica em linha separada pra você distinguir
     compromisso (boleto) de estimativa (média). */
  const ORC=(typeof loadOrc==="function"?loadOrc():{})||{};
  months.forEach(mm=>{ if(mm<tk) return;
    const mb=ORC[mm]; if(!mb) return;
    const jaPrevisto=pagCats[mm]||new Set();
    let t=0; Object.keys(mb).forEach(cat=>{ if(!jaPrevisto.has(cat)) t+=Number(mb[cat]||0); });
    if(t>0) orc[mm]=t;
  });
  // ACUMULADO ANCORADO NO SALDO REAL (30/08): a soma cega de movimentos não tem saldo de
  // abertura e derivava um acumulado deslocado da realidade. Âncora: no fim do mês corrente,
  // acumulado = saldo real das contas (override do banco) + previstos restantes do mês.
  // Passado deriva pra trás (acc−net), futuro pra frente.
  const data=months.map(k=>{const proje=k>=tk;const fut=k>tk;const e=ent[k]||0,s=sai[k]||0,r=proje?(rec[k]||0):0,p=proje?(pag[k]||0):0,o=proje?(orc[k]||0):0;const net=(e-s)+(r-p-o);return{k,e,s,r,p,o,net,acc:0,proje:fut};});
  const i0=data.findIndex(c=>c.k===tk);
  if(i0>=0){data[i0].acc=saldoCorrente()+(rec[tk]||0)-(pag[tk]||0)-(orc[tk]||0);
    for(let i=i0+1;i<data.length;i++)data[i].acc=data[i-1].acc+data[i].net;
    for(let i=i0-1;i>=0;i--)data[i].acc=data[i+1].acc-data[i+1].net;
  }else{let acc=0;data.forEach(c=>{acc+=c.net;c.acc=acc;});}
  const cell=(v,cls,k,t)=>`<td class="${v?cls:''} fxc" data-k="${k}" data-t="${t}" style="${v?'cursor:pointer':''}" title="${v?'Ver detalhes':''}">${v?fmtBRL(v):"—"}</td>`;
  $("#view").innerHTML=`<div class="row"><div><h1>Fluxo de Caixa</h1><div class="sub">Realizado + projeção. <span class="pj">Roxo</span> = a receber/pagar cadastrado. <span class="orcx">Âmbar</span> = teto do Orçamento nas categorias sem conta cadastrada. Acumulado ancorado no saldo real das contas hoje.</div></div><select id="fh"><option value="3">3m</option><option value="6" selected>6m</option><option value="12">12m</option></select></div>
   <div class="panel" style="overflow-x:auto"><table class="cf"><thead><tr><th class="h">Mês</th>${data.map(c=>`<th>${mkLabel(c.k)}${c.proje?' <span class="pj">•</span>':''}</th>`).join("")}</tr></thead><tbody>
    <tr><td class="h">Entradas</td>${data.map(c=>cell(c.e,"in",c.k,"e")).join("")}</tr>
    <tr><td class="h">Saídas</td>${data.map(c=>cell(c.s,"out",c.k,"s")).join("")}</tr>
    <tr><td class="h">A receber (prev.)</td>${data.map(c=>`<td class="${c.r?'pj':''} fxc" data-k="${c.k}" data-t="r" style="${c.r?'cursor:pointer':''}">${c.r?fmtBRL(c.r):"—"}</td>`).join("")}</tr>
    <tr><td class="h">A pagar (prev.)</td>${data.map(c=>`<td class="${c.p?'pj':''} fxc" data-k="${c.k}" data-t="p" style="${c.p?'cursor:pointer':''}">${c.p?'−'+fmtBRL(c.p):"—"}</td>`).join("")}</tr>
    <tr><td class="h">Orçamento (est.)</td>${data.map(c=>`<td class="${c.o?'orcx':''} fxc" data-k="${c.k}" data-t="o" style="${c.o?'cursor:pointer':''}">${c.o?'−'+fmtBRL(c.o):"—"}</td>`).join("")}</tr>
    <tr style="border-top:2px solid var(--border)"><td class="h"><b>Saldo do mês</b></td>${data.map(c=>`<td class="${c.net>=0?'in':'out'}"><b>${fmtBRL(c.net)}</b></td>`).join("")}</tr>
    <tr><td class="h"><b>Saldo acumulado</b></td>${data.map(c=>`<td class="${c.acc>=0?'in':'out'}"><b>${fmtBRL(c.acc)}</b></td>`).join("")}</tr>
   </tbody></table></div><div class="panel"><h2>Saldo acumulado projetado</h2><canvas id="chAcc" height="90"></canvas></div>`;
  $("#fh").value=String(FLUXO_H);$("#fh").onchange=e=>{FLUXO_H=+e.target.value;viewFluxo();};
  document.querySelectorAll("#view td.fxc").forEach(td=>{td.onclick=()=>{if(td.textContent.trim()!=="—")fluxoDrill(td.dataset.k,td.dataset.t);};});
  _charts.forEach(c=>c.destroy());_charts=[];_charts.push(new Chart($("#chAcc"),{type:"line",data:{labels:data.map(c=>mkLabel(c.k)),datasets:[{label:"Saldo",data:data.map(c=>c.acc),borderColor:"#3b5bdb",backgroundColor:"rgba(59,91,219,.12)",fill:true,tension:.25,pointBackgroundColor:data.map(c=>c.proje?"#7c3aed":"#3b5bdb")}]},options:{plugins:{legend:{display:false}},scales:{y:{ticks:{callback:fmtK}}}}}));
}

/* ===== DRE ===== */
let DRE_MODE="ano",DRE_ANO=null,DRE_MES=null;
/* Modal genérico de drill-down (usado por DRE e Fluxo de Caixa).
   ATENÇÃO: titulo/sub/rowsHtml entram como HTML — callers devem esc() qualquer dado de usuário;
   só HTML hardcoded seguro (<b>, <span>) pode vir sem escape. */
function drillModal(titulo,sub,rowsHtml){
  const ov=document.createElement("div");
  ov.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px";
  ov.innerHTML=`<div style="background:var(--card,#fff);border-radius:14px;padding:16px;max-width:680px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.3);max-height:82vh;display:flex;flex-direction:column">
    <div class="row" style="margin:0 0 10px;align-items:flex-start"><div><h2 style="margin:0">${titulo}</h2><div class="sub">${sub}</div></div><button id="drillX" class="btn ghost sm">✕</button></div>
    <div style="overflow:auto"><table style="width:100%;border-collapse:collapse;font-size:13px"><tbody>${rowsHtml}</tbody></table></div></div>`;
  document.body.appendChild(ov);
  const onKey=e=>{if(e.key==="Escape")close();};
  const close=()=>{ov.remove();document.removeEventListener("keydown",onKey);};
  ov.onclick=e=>{if(e.target===ov)close();};
  ov.querySelector("#drillX").onclick=close;
  document.addEventListener("keydown",onKey);
}
const _drillRow=(dt,desc,extra,valor,cls)=>`<tr style="border-top:1px solid var(--border)"><td style="white-space:nowrap;padding:5px 8px">${dt}</td><td style="padding:5px 8px">${desc}</td><td class="sub" style="white-space:nowrap;padding:5px 8px">${extra}</td><td class="num ${cls}" style="text-align:right;white-space:nowrap;padding:5px 8px">${valor}</td></tr>`;
/* Drill-down: clicar numa linha do DRE abre as movimentações que a compõem (mesmo período/filtro) */
function dreDrill(cat){
  const inDre=m=>DRE_MODE==="ano"?m.ano===DRE_ANO:(m.ano===DRE_ANO&&m.mes===DRE_MES);
  const items=DB.movimentos.filter(m=>inDre(m)&&!isForaAgregado(m)&&(m.categoria||"Outras")===cat).sort((a,b)=>a.data<b.data?1:-1);
  const tot=items.reduce((s,m)=>s+Number(m.valor||0),0);
  const per=DRE_MODE==="ano"?("ano "+DRE_ANO):(ML[DRE_MES-1]+"/"+DRE_ANO);
  const linhas=items.map(m=>_drillRow((m.data||"").slice(8,10)+"/"+(m.data||"").slice(5,7),esc(m.descricao||""),esc(m.banco||""),fmtBRL(m.valor),m.sentido==='Entrada'?'in':'out')).join("")||`<tr><td colspan="4" class="sub" style="padding:12px">Nenhuma movimentação.</td></tr>`;
  drillModal(esc(cat),`${items.length} movimento(s) · ${per} · total <b>${fmtBRL(tot)}</b>`,linhas);
}
/* Drill-down do Fluxo de Caixa: célula (mês × tipo) mostra o que compõe o valor.
   t: e=Entradas s=Saídas r=A receber p=A pagar */
function fluxoDrill(k,t){
  const tk=todayISO().slice(0,7);
  const nomes={e:"Entradas",s:"Saídas",r:"A receber (previsto)",p:"A pagar (previsto)",o:"Orçamento estimado (categorias sem conta cadastrada)"};
  let linhas="",tot=0,n=0;
  if(t==="o"){
    const ORC=(typeof loadOrc==="function"?loadOrc():{})||{};
    const mb=ORC[k]||{};
    // mesmas categorias que o viewFluxo somou: as que NAO tem conta a pagar prevista no mes
    const jaPrevisto=new Set();
    DB.contasPagar.filter(c=>(c.status||"").toLowerCase()==="aberto"&&!isPrevFatura(c)).forEach(c=>{
      const vk=monthKey(c.vencimento); if(!vk)return;
      if(vk===k||(c.recorrencia==="mensal"&&k>=vk)||(k===tk&&vk<tk)){ if(c.categoria)jaPrevisto.add(c.categoria); }
    });
    const items=Object.keys(mb).filter(cat=>!jaPrevisto.has(cat)&&Number(mb[cat]||0)>0)
      .map(cat=>({cat,valor:Number(mb[cat])})).sort((a,b)=>b.valor-a.valor);
    n=items.length; tot=items.reduce((acc,x)=>acc+x.valor,0);
    linhas=items.map(x=>_drillRow("teto",esc(x.cat),"média mai–ago/26",fmtBRL(x.valor),"out")).join("");
  }else if(t==="e"||t==="s"){
    const items=DB.movimentos.filter(m=>monthKey(m.data)===k&&!isForaAgregado(m)&&(t==="e"?m.sentido==="Entrada":m.sentido==="Saída")).sort((a,b)=>a.data<b.data?1:-1);
    n=items.length;tot=items.reduce((s,m)=>s+Number(m.valor||0),0);
    linhas=items.map(m=>_drillRow((m.data||"").slice(8,10)+"/"+(m.data||"").slice(5,7),esc(m.descricao||""),esc(m.categoria||m.banco||""),fmtBRL(m.valor),t==="e"?"in":"out")).join("");
  }else{
    const lista=t==="r"?DB.aReceber:DB.contasPagar;
    const abertos=lista.filter(x=>t==="r"?((x.status||"").toLowerCase()!=="recebido"):((x.status||"").toLowerCase()==="aberto"&&!isPrevFatura(x)));
    const items=[];
    abertos.forEach(x=>{
      const venc=t==="r"?x.dataPrevista:x.vencimento, vk=monthKey(venc);
      if(!vk)return;
      const val=Number(t==="r"?x.previstoLiquido:x.valor)||0, desc=t==="r"?x.linha:x.descricao;
      // ocorrência do mês k (recorrente projeta a partir da âncora)
      if(vk===k||(x.recorrencia==="mensal"&&k>=vk))items.push({venc:k+"-"+(venc||"").slice(8,10),vencido:false,desc,valor:val});
      // âncora VENCIDA (aberta) listada no mês corrente — espelha a soma da célula
      if(k===tk&&vk<tk)items.push({venc,vencido:true,desc,valor:val});
    });
    n=items.length;tot=items.reduce((s,x)=>s+x.valor,0);
    linhas=items.sort((a,b)=>a.venc<b.venc?-1:1).map(x=>_drillRow((x.venc||"").slice(8,10)+"/"+(x.venc||"").slice(5,7),esc(x.desc||"")+(x.vencido?' <span style="color:#dc2626;font-weight:700;font-size:11px">VENCIDO</span>':''),x.vencido?"em atraso":"previsto",fmtBRL(x.valor),t==="r"?"in":"out")).join("");
  }
  if(!linhas)linhas=`<tr><td colspan="4" class="sub" style="padding:12px">Nada neste mês.</td></tr>`;
  drillModal(nomes[t]+" · "+mkLabel(k),`${n} item(ns) · total <b>${fmtBRL(tot)}</b>`,linhas);
}
function viewDRE(){ DRE_ANO=DRE_ANO||yearsList()[0]||new Date().getFullYear();DRE_MES=DRE_MES||new Date().getMonth()+1;
  const inDre=m=>DRE_MODE==="ano"?m.ano===DRE_ANO:(m.ano===DRE_ANO&&m.mes===DRE_MES);
  const rows=DB.movimentos.filter(m=>inDre(m)&&!isForaAgregado(m));
  const receitas={},grupos={};let totRec=0,totDesp=0;
  rows.forEach(m=>{const g=dreGrupo(m.categoria,m.sentido==="Entrada"?"entrada":"saida");if(!g)return;
    if(m.sentido==="Entrada"){receitas[m.categoria||"Outras"]=(receitas[m.categoria||"Outras"]||0)+m.valor;totRec+=m.valor;}
    else{grupos[g]=grupos[g]||{};grupos[g][m.categoria||"Outras"]=(grupos[g][m.categoria||"Outras"]||0)+m.valor;totDesp+=m.valor;}});
  const result=totRec-totDesp;const margem=totRec?(result/totRec*100):0;
  const secReceita=`<tr style="background:#f0fdf4"><td class="h"><b>RECEITAS</b></td><td class="num in"><b>${fmtBRL(totRec)}</b></td></tr>${Object.entries(receitas).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<tr class="dre-line" data-cat="${esc(k)}" style="cursor:pointer"><td class="h" style="padding-left:22px">${esc(k)} <span class="sub" style="font-size:10px">›</span></td><td class="num in">${fmtBRL(v)}</td></tr>`).join("")}`;
  const ordemG=[...DRE_ORDEM_DESP.filter(g=>grupos[g]),...Object.keys(grupos).filter(g=>!DRE_ORDEM_DESP.includes(g))];
  const secDesp=ordemG.filter(g=>grupos[g]).map(g=>{const sub=grupos[g];const tg=Object.values(sub).reduce((a,b)=>a+b,0);return `<tr style="background:#fef2f2"><td class="h"><b>${g}</b></td><td class="num out"><b>−${fmtBRL(tg)}</b></td></tr>${Object.entries(sub).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<tr class="dre-line" data-cat="${esc(k)}" style="cursor:pointer"><td class="h" style="padding-left:22px">${esc(k)} <span class="sub" style="font-size:10px">›</span></td><td class="num out">−${fmtBRL(v)}</td></tr>`).join("")}`;}).join("");
  $("#view").innerHTML=`<div class="row"><div><h1>DRE</h1><div class="sub">Demonstração de Resultado — ${DRE_MODE==="ano"?("ano "+DRE_ANO):(ML[DRE_MES-1]+"/"+DRE_ANO)}</div></div>
    <div class="controls" style="margin:0"><select id="dm"><option value="ano" ${DRE_MODE==="ano"?"selected":""}>Anual</option><option value="mes" ${DRE_MODE==="mes"?"selected":""}>Mensal</option></select><select id="da">${yearsList().map(y=>`<option ${y===DRE_ANO?"selected":""}>${y}</option>`).join("")}</select>${DRE_MODE==="mes"?`<select id="dmes">${ML.map((n,i)=>`<option value="${i+1}" ${i+1===DRE_MES?"selected":""}>${n}</option>`).join("")}</select>`:""}</div></div>
  <div class="kpis"><div class="kpi"><div class="lbl">Receita</div><div class="val in">${fmtBRL(totRec)}</div></div><div class="kpi"><div class="lbl">Despesas</div><div class="val out">${fmtBRL(totDesp)}</div></div><div class="kpi"><div class="lbl">Resultado</div><div class="val ${result>=0?'in':'out'}">${fmtBRL(result)}</div></div><div class="kpi"><div class="lbl">Margem</div><div class="val ${margem>=0?'in':'out'}">${margem.toFixed(1)}%</div></div></div>
  <div class="panel"><table class="cf"><tbody>${secReceita}${secDesp}<tr style="border-top:2px solid var(--fg)"><td class="h"><b>RESULTADO LÍQUIDO</b></td><td class="num ${result>=0?'in':'out'}"><b>${fmtBRL(result)}</b></td></tr></tbody></table>
   <div class="sub" style="margin-top:8px">Agrupamento pelo campo <b>Grupo no DRE</b> de cada categoria (Configurações › Linhas do DRE). Onde não houver grupo definido, cai na heurística pelo nome.</div></div>`;
  $("#dm").onchange=e=>{DRE_MODE=e.target.value;viewDRE();};$("#da").onchange=e=>{DRE_ANO=+e.target.value;viewDRE();};if($("#dmes"))$("#dmes").onchange=e=>{DRE_MES=+e.target.value;viewDRE();};
  document.querySelectorAll("#view tr.dre-line").forEach(tr=>tr.onclick=()=>dreDrill(tr.dataset.cat));
}

/* ===== Orçamento ===== */
let ORC_MES=null;
function viewOrcamento(){ ORC_MES=ORC_MES||todayISO().slice(0,7); const orc=loadOrc();const mb=orc[ORC_MES]||{};
  const cats=DB.categorias.filter(c=>!c.parent_id);
  const realByCat={};DB.movimentos.filter(m=>monthKey(m.data)===ORC_MES&&!isForaAgregado(m)).forEach(m=>{realByCat[m.categoria||"—"]=(realByCat[m.categoria||"—"]||0)+(m.sentido==="Entrada"?m.valor:-m.valor);});
  const saidas=cats.filter(c=>c.tipo==="saida"),entradas=cats.filter(c=>c.tipo==="entrada");
  let planDesp=0,realDesp=0,planRec=0,realRec=0;
  const rowFor=(c,isRec)=>{const plan=+(mb[c.nome]||0);const real=Math.abs(realByCat[c.nome]||0);if(isRec){planRec+=plan;realRec+=real;}else{planDesp+=plan;realDesp+=real;}
    const pct=plan?Math.min(100,real/plan*100):0;const over=!isRec&&plan&&real>plan;
    return `<tr><td class="h">${esc(c.nome)}</td><td class="num"><input type="number" step="0.01" value="${plan||""}" data-cat="${esc(c.nome)}" style="width:110px;text-align:right" placeholder="0"></td><td class="num ${isRec?'in':'out'}">${fmtBRL(real)}</td><td class="num ${over?'out':''}">${plan?fmtBRL(plan-real):"—"}</td><td style="width:120px"><div class="bar"><i style="width:${pct}%;background:${over?'var(--expense)':isRec?'var(--income)':'var(--primary)'}"></i></div></td></tr>`;};
  $("#view").innerHTML=`<div class="row"><div><h1>Orçamento</h1><div class="sub">Planejado × realizado — ${mkLabel(ORC_MES)}</div></div><input id="om" type="month" value="${ORC_MES}"></div>
   <div class="panel"><h2>Receitas</h2><table><thead><tr><th>Categoria</th><th class="num">Planejado</th><th class="num">Realizado</th><th class="num">Saldo</th><th>%</th></tr></thead><tbody>${entradas.map(c=>rowFor(c,true)).join("")}</tbody></table></div>
   <div class="panel"><h2>Despesas</h2><table><thead><tr><th>Categoria</th><th class="num">Planejado</th><th class="num">Realizado</th><th class="num">Saldo</th><th>%</th></tr></thead><tbody>${saidas.map(c=>rowFor(c,false)).join("")}</tbody></table></div>
   <div class="kpis"><div class="kpi"><div class="lbl">Receita planejada</div><div class="val in">${fmtBRL(planRec)}</div><div class="hint">realizado ${fmtBRL(realRec)}</div></div>
    <div class="kpi"><div class="lbl">Despesa planejada</div><div class="val out">${fmtBRL(planDesp)}</div><div class="hint">realizado ${fmtBRL(realDesp)}</div></div>
    <div class="kpi"><div class="lbl">🎯 Lucro planejado</div><div class="val ${planRec-planDesp>=0?'in':'out'}">${fmtBRL(planRec-planDesp)}</div></div>
    <div class="kpi"><div class="lbl">Lucro realizado</div><div class="val ${realRec-realDesp>=0?'in':'out'}">${fmtBRL(realRec-realDesp)}</div></div></div>
   <div class="sub">${MODE==="live"?`Salvo no Supabase, por visão (<b>${esc(VISAO_LABEL)}</b>).`+(hasLocalOrc()?` <span class="link" onclick="importOrcLocal()">Importar o orçamento deste navegador ›</span>`:""):"Modo demo — salvo só neste navegador."}</div>`;
  $("#om").onchange=e=>{ORC_MES=e.target.value;viewOrcamento();};
  $("#view").querySelectorAll("input[data-cat]").forEach(inp=>inp.onchange=async()=>{try{await setOrcamento(ORC_MES,inp.dataset.cat,+inp.value||0);}catch(e){toast("Erro ao salvar: "+e.message);}viewOrcamento();});
}

/* ===== Configurações (contas/cartões/categorias) ===== */
let CFG_TAB="contas";
/* ===== Tags (rótulos por tipo/origem, independente da conta) ===== */
const tagById=id=>(DB.tags||[]).find(t=>t.id===id)||null;
function tagChip(t){const c=t.cor;const st=c?`background:${esc(c)}22;border:1px solid ${esc(c)}66;color:${esc(c)}`:"";return `<span class="chip" style="${st}">🏷️ ${esc(t.nome)}</span>`;}
function tagsPanel(){
  const tags=(DB.tags||[]).slice().sort((a,b)=>String(a.nome).localeCompare(String(b.nome),"pt"));
  const rows=tags.map(t=>`<tr><td>${tagChip(t)}</td><td class="num"><button class="btn ghost sm" onclick="editTag('${t.id}')">Editar</button><button class="btn danger sm" onclick="delTag('${t.id}')">Excluir</button></td></tr>`).join("")
    ||`<tr><td colspan="2"><div class="empty">Nenhuma tag ainda. Crie as primeiras (ex.: PJ, PF, Pessoal, Investimento).</div></td></tr>`;
  return `<div class="panel" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap"><span class="sub" style="margin:0;flex:1;min-width:220px">Tags classificam a transação por <b>tipo/origem</b> (PJ, PF…) <b>independente da conta</b> de onde saiu. Uma transação pode ter várias — atribua no editar de cada movimento.</span><button class="btn" onclick="addTag()">+ Tag</button></div>
   <div class="panel" style="padding:0;overflow:hidden"><table><tbody>${rows}</tbody></table></div>`;
}
function addTag(){modal({title:"Nova tag",fields:[{name:"nome",label:"Nome",placeholder:"Ex.: PJ, PF, Pessoal"},{name:"cor",label:"Cor",type:"color",default:"#2f6f5e"}],onSave:async v=>{if(!v.nome.trim()){toast("Dê um nome");return false;}if(MODE!=="live"){toast("Tags só no modo logado");return false;}try{await sbIns("tags",{nome:v.nome.trim(),cor:v.cor||null,visao:"AMBOS"});}catch(e){toast("Erro: "+e.message);return false;}toast("Tag criada");await afterWrite();}});}
function editTag(id){const t=tagById(id);if(!t)return;modal({title:"Editar tag",fields:[{name:"nome",label:"Nome"},{name:"cor",label:"Cor",type:"color",default:t.cor||"#2f6f5e"}],values:{nome:t.nome,cor:t.cor||"#2f6f5e"},onSave:async v=>{if(!v.nome.trim()){toast("Dê um nome");return false;}if(MODE==="live"){try{await sbUpd("tags",id,{nome:v.nome.trim(),cor:v.cor||null});}catch(e){toast("Erro: "+e.message);return false;}}t.nome=v.nome.trim();t.cor=v.cor||null;toast("Atualizada");await afterWrite();}});}
function delTag(id){const t=tagById(id);if(!t)return;confirmDel(`Excluir a tag "${t.nome}"? Ela sai de todas as transações que a tinham.`,async()=>{if(MODE==="live"){try{await sbDel("tags",id);}catch(e){toast("Erro: "+e.message);return;}}document.querySelectorAll(".modal-bg").forEach(b=>b.remove());toast("Excluída");await afterWrite();});}

/* ===== ACESSOS (multiusuário por visão) =====================================
   Permissão mora em app_usuarios/usuario_visoes, chaveada por E-MAIL — assim dá
   pra pré-autorizar alguém ANTES do primeiro login (o user_id só nasce no login).
   Enquanto a migração `scripts/acessos-multiusuario-2026-08-01.sql` não rodar, as
   tabelas não existem: PERM.legacy=true e o app segue como era (tudo liberado). */
let PERM={admin:false,legacy:true,email:"",visoes:{}};
const podeVer   =c=>PERM.legacy||PERM.admin||!!(PERM.visoes[c]&&PERM.visoes[c].ler);
const podeEditar=c=>PERM.legacy||PERM.admin||!!(PERM.visoes[c]&&PERM.visoes[c].escrever);
const visoesVisiveis=()=>PROFILES.filter(p=>podeVer(p.code));

async function loadPerm(){
  PERM={admin:false,legacy:true,email:"",visoes:{}};
  if(MODE!=="live")return;
  try{
    const{data:s}=await sb.auth.getSession();
    PERM.email=((s&&s.session&&s.session.user&&s.session.user.email)||"").toLowerCase();
    const[u,v]=await Promise.all([
      sb.from("app_usuarios").select("admin,nome").eq("email",PERM.email).maybeSingle(),
      sb.from("usuario_visoes").select("visao,ler,escrever").eq("email",PERM.email)]);
    /* tabela ainda não existe (migração não rodou) → mantém o comportamento antigo */
    if(u.error&&/(does not exist|schema cache)/i.test(u.error.message||""))return;
    PERM.legacy=false;
    PERM.admin=!!(u.data&&u.data.admin);
    ((v&&v.data)||[]).forEach(r=>PERM.visoes[r.visao]={ler:r.ler!==false,escrever:!!r.escrever});
  }catch(e){/* qualquer falha → legacy, nunca trancar o app por causa disso */}
}

/* Painel de administração: só aparece pra quem é admin. */
function acessosPanel(){
  const codes=PROFILES.map(p=>p.code);
  const users=(ACESSOS.users||[]);
  const cel=(u,code)=>{const p=(ACESSOS.perm[u.email]||{})[code]||{};
    const cb=(campo,on)=>`<label class="acc-cb"><input type="checkbox" ${on?"checked":""} ${u.admin?"disabled":""} onchange="acessoSet('${esc(u.email)}','${code}','${campo}',this.checked)"><span>${campo==="ler"?"ver":"editar"}</span></label>`;
    return `<td>${u.admin?`<span class="chip">tudo</span>`:cb("ler",p.ler)+cb("escrever",p.escrever)}</td>`;};
  return `<div class="panel">
    <h2>Quem tem acesso <button class="btn sm" onclick="acessoAdd()">+ Pessoa</button></h2>
    <div class="sub" style="margin-bottom:10px">A pessoa entra com o Google dela e só enxerga o que estiver marcado aqui. Pode cadastrar o e-mail <b>antes</b> do primeiro login. <b>Ver</b> = leitura; <b>editar</b> = pode lançar e alterar.</div>
    <div style="overflow-x:auto"><table><thead><tr><th>Pessoa</th>${codes.map(c=>`<th>${esc(PROFILES.find(p=>p.code===c).label)}</th>`).join("")}<th></th></tr></thead>
    <tbody>${users.map(u=>`<tr>
      <td><b>${esc(u.nome||u.email.split("@")[0])}</b>${u.admin?` <span class="chip">admin</span>`:""}<div class="sub" style="margin:0">${esc(u.email)}</div></td>
      ${codes.map(c=>cel(u,c)).join("")}
      <td class="num">${u.email===PERM.email?`<span class="chip">você</span>`:`<button class="btn danger sm" onclick="acessoDel('${esc(u.email)}')">Remover</button>`}</td>
    </tr>`).join("")||`<tr><td colspan="${codes.length+2}"><div class="empty">Ninguém cadastrado ainda.</div></td></tr>`}</tbody></table></div>
  </div>`;
}
let ACESSOS={users:[],perm:{}};
async function acessosLoad(){
  const[u,v]=await Promise.all([
    sb.from("app_usuarios").select("email,nome,admin").order("admin",{ascending:false}),
    sb.from("usuario_visoes").select("email,visao,ler,escrever")]);
  if(u.error)throw new Error(u.error.message);
  ACESSOS.users=u.data||[];ACESSOS.perm={};
  ((v&&v.data)||[]).forEach(r=>{(ACESSOS.perm[r.email]=ACESSOS.perm[r.email]||{})[r.visao]={ler:r.ler,escrever:r.escrever};});
}
async function acessoSet(email,visao,campo,valor){
  const atual=(ACESSOS.perm[email]||{})[visao]||{ler:false,escrever:false};
  const row={email,visao,ler:campo==="ler"?valor:!!atual.ler,escrever:campo==="escrever"?valor:!!atual.escrever};
  if(row.escrever)row.ler=true;                    /* quem edita, vê */
  if(!row.ler)row.escrever=false;                  /* tirou o ver, tira o editar */
  const{error}=await sb.from("usuario_visoes").upsert(row,{onConflict:"email,visao"});
  if(error){toast("Erro: "+error.message);return;}
  (ACESSOS.perm[email]=ACESSOS.perm[email]||{})[visao]=row;
  toast("Acesso atualizado ✓");viewConfig();
}
function acessoAdd(){
  modal({title:"Dar acesso a alguém",fields:[
    {name:"email",label:"E-mail do Google dela(e)"},
    {name:"nome",label:"Nome (como você chama)"}],
    onSave:async v=>{
      const email=(v.email||"").trim().toLowerCase();
      if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){toast("E-mail inválido");return false;}
      const{error}=await sb.from("app_usuarios").upsert({email,nome:v.nome||null,admin:false},{onConflict:"email"});
      if(error){toast("Erro: "+error.message);return false;}
      await acessosLoad();toast("Cadastrada ✓ — agora marque as visões");viewConfig();
    }});
}
async function acessoDel(email){
  modal({title:"Remover acesso",fields:[],extraHTML:`<div class="sub">Tira <b>${esc(email)}</b> do app. Nenhum lançamento é apagado — só o acesso.</div>`,saveLabel:"Remover",onSave:async()=>{
    const{error}=await sb.from("app_usuarios").delete().eq("email",email);
    if(error){toast("Erro: "+error.message);return false;}
    await acessosLoad();toast("Acesso removido");viewConfig();
  }});
}
function viewConfig(){const tab=(id,lbl)=>`<button class="${CFG_TAB===id?'on':''}" onclick="CFG_TAB='${id}';viewConfig()">${lbl}</button>`;
  let body="";
  if(CFG_TAB==="contas"||CFG_TAB==="cartoes"){const isCard=CFG_TAB==="cartoes";const list=(DB.contas||[]).filter(c=>isCard?(c.tipo==="cartao"||/cart/i.test(c.nome)):!(c.tipo==="cartao"||/cart/i.test(c.nome)));
    body=`<div class="panel"><h2>${isCard?"Cartões":"Contas"} <button class="btn sm" onclick="addConta('${isCard?'cartao':'corrente'}')">+ ${isCard?'Cartão':'Conta'}</button></h2><table><thead><tr><th>Nome</th><th>Banco</th><th>Tipo</th><th></th></tr></thead><tbody>${list.map(c=>`<tr><td><b>${esc(c.nome)}</b></td><td>${esc(c.banco||"—")}</td><td>${esc(c.tipo||"—")}</td><td class="num"><button class="btn ghost sm" onclick="editConta('${c.id}')">Editar</button><button class="btn danger sm" onclick="delConta('${c.id}')">Excluir</button></td></tr>`).join("")||`<tr><td colspan="4"><div class="empty">Nenhum.</div></td></tr>`}</tbody></table></div>`;}
  else if(CFG_TAB==="dre"){
    const optG=c=>`<select onchange="setGrupoDre('${c.id}',this.value)" style="min-width:180px">${["",...DRE_GRUPOS].map(g=>`<option value="${esc(g)}" ${(c.grupo_dre||"")===g?"selected":""}>${g||"— automático"}</option>`).join("")}</select>`;
    const secD=(tipo,t)=>{const arr=DB.categorias.filter(c=>c.tipo===tipo).sort((a,b)=>(a.parent_id?1:0)-(b.parent_id?1:0)||a.nome.localeCompare(b.nome));return `<div class="panel"><h2>${t} (${arr.length})</h2><table><thead><tr><th>Categoria</th><th>Grupo no DRE</th></tr></thead><tbody>${arr.map(c=>`<tr><td>${c.parent_id?"↳ ":""}<b>${esc(c.nome)}</b></td><td>${optG(c)}</td></tr>`).join("")||`<tr><td colspan="2"><div class="empty">Nenhuma.</div></td></tr>`}</tbody></table></div>`;};
    body=`<div class="sub" style="margin-bottom:10px">Defina em qual linha do DRE cada categoria entra. <b>Em branco = automático</b> (heurística pelo nome). Receitas costumam ficar em "Receitas"; despesas em Custos / Operacionais / Impostos / Outras.</div>`+secD("saida","Saídas")+secD("entrada","Entradas");
  }
  else{const amb=c=>(c.visao||"AMBOS")==="AMBOS"?` <span class="chip" title="Compartilhada: aparece em TODOS os módulos">🌐 compartilhada</span>`:"";
    const sec=(tipo,t)=>{const arr=catTopsSorted(tipo);return`<div class="panel"><h2>${t} (${arr.length}) <button class="btn sm" onclick="addCat('${tipo}')">+ Categoria</button></h2><table><tbody>${arr.map(p=>{const subs=catSubsSorted(p);return`<tr><td><b>${esc(p.nome)}</b>${amb(p)}</td><td class="num"><button class="btn ghost sm" onclick="addSub('${p.id}')">+ Sub</button><button class="btn ghost sm" onclick="editCat('${p.id}')">Editar</button><button class="btn danger sm" onclick="delCat('${p.id}')">Excluir</button></td></tr>${subs.map(s=>`<tr class="subrow"><td>↳ <span class="chip">${esc(s.nome)}</span>${amb(s)}</td><td class="num"><button class="btn ghost sm" onclick="editCat('${s.id}')">Editar</button><button class="btn danger sm" onclick="delCat('${s.id}')">Excluir</button></td></tr>`).join("")}`;}).join("")||`<tr><td><div class="empty">Nenhuma.</div></td></tr>`}</tbody></table></div>`;};
    const nAmb=DB.categorias.filter(c=>(c.visao||"AMBOS")==="AMBOS").length;
    body=`<div class="panel" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap"><button class="btn soft" onclick="catOrganizar()">🧹 Organizar por módulo</button><span class="sub" style="margin:0;flex:1;min-width:220px">Cada visão é um módulo com as SUAS categorias. ${nAmb?`<b>${nAmb}</b> ainda estão marcadas 🌐 compartilhada (aparecem em todos os módulos) — o organizador analisa onde cada uma é usada e sugere o destino; nada muda sem você confirmar.`:"Tudo organizado 🎉"}</span></div>`+sec("entrada","Entradas")+sec("saida","Saídas");}
  if(CFG_TAB==="tags")body=tagsPanel();
  if(CFG_TAB==="acessos")body=PERM.admin?acessosPanel():`<div class="panel"><div class="empty">Só o administrador vê esta aba.</div></div>`;
  if(CFG_TAB==="contatos"){
    body=`<div class="panel"><h2>Contatos & Clientes <button class="btn sm" onclick="entNova().then(n=>{if(n)entLoad(true).then(()=>viewConfig());})">+ Novo</button></h2>
      <div class="sub">Cadastro único de quem você paga/recebe (Débora, Pedro França, MJM…). Movimentos e contas apontam pra cá — é o ID de cliente do sistema; os apelidos alimentam a detecção automática.</div>
      <div id="entList" class="ent-list" style="margin-top:10px"><div class="empty">Carregando…</div></div></div>`;
    setTimeout(async()=>{await entLoad(true);const box=document.getElementById("entList");if(!box)return;
      if(entOff()){box.innerHTML=`<div class="empty">${MODE==="live"?"Ainda não ativado — rode <b>scripts/integridade-fase1.sql</b> no SQL Editor (1x) e recarregue.":"Disponível no modo live (logado)."}</div>`;return;}
      box.innerHTML=ENT_CACHE.rows.map(e=>`<div class="ent-item" onclick="entEditar('${e.id}')"><span class="ent-ic">${e.tipo==="empresa"?"🏢":e.tipo==="orgao"?"🏛":"👤"}</span><span class="ent-nm"><b>${esc(e.nome)}</b><small>${e.visao==="AMBOS"?"🌐 todas as visões":esc(e.visao)}${(e.apelidos||[]).length?" · "+esc(e.apelidos.join(", ")):""}</small></span><span class="sub" style="margin:0">editar ›</span></div>`).join("")||`<div class="empty">Nenhum contato ainda. Toque em <b>+ Novo</b> — os movimentos e contas passam a apontar pra ele.</div>`;
    },0);
  }
  if(CFG_TAB==="trilha")body=`<div class="panel"><h2>🧾 Trilha de auditoria</h2>
    <div class="sub">Registro automático de TODA alteração em movimentos, contas a pagar/receber, contas, categorias e contatos — quem mudou, quando, o antes e o depois. Pega qualquer caminho: o app, o sync do Pluggy/Inter e até o SQL Editor.</div>
    <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
      <button class="btn" onclick="audVer()">Abrir a trilha completa</button>
      <button class="btn ghost" onclick="audVer('movimentos')">Só movimentos</button>
      <button class="btn ghost" onclick="audVer('previstos')">Só contas a pagar/receber</button>
    </div></div>`;
  $("#view").innerHTML=`<div class="row"><div><h1>Configurações</h1><div class="sub">Fonte de verdade que alimenta os selects de lançamento</div></div></div><div class="tabs">${tab("contas","Contas")}${tab("cartoes","Cartões")}${tab("categorias","Categorias")}${tab("tags","🏷️ Tags")}${tab("dre","Linhas do DRE")}${tab("contatos","👥 Contatos")}${tab("trilha","🧾 Trilha")}${PERM.admin?tab("acessos","🔐 Acessos"):""}</div>${body}`;
}
function contaFields(tipo){return[{name:"nome",label:"Nome"},{name:"banco",label:"Banco"},{name:"tipo",label:"Tipo",type:"select",options:["corrente","cartao","investimento","caixa"],default:tipo}];}
function addConta(tipo){modal({title:"Nova "+(tipo==="cartao"?"cartão":"conta"),fields:contaFields(tipo),onSave:async v=>{if(!v.nome){toast("Nome");return false;}const o={id:"co"+Date.now(),nome:v.nome,banco:v.banco,tipo:v.tipo,ativo:true};if(MODE==="live")o.id=await sbIns("contas",{nome:v.nome,banco:v.banco||null,tipo:v.tipo,ativo:true});DB.contas.push(o);toast("Criada");await afterWrite();}});}
function editConta(id){const c=DB.contas.find(x=>x.id===id);if(!c)return;modal({title:"Editar conta",fields:contaFields(c.tipo),values:{...c},onSave:async v=>{if(MODE==="live")await sbUpd("contas",id,{nome:v.nome,banco:v.banco||null,tipo:v.tipo});Object.assign(c,{nome:v.nome,banco:v.banco,tipo:v.tipo});toast("Atualizada");await afterWrite();}});}
function delConta(id){const c=DB.contas.find(x=>x.id===id);if(!c)return;confirmDel(`Excluir "${c.nome}"? (lançamentos vinculados podem bloquear)`,async()=>{if(MODE==="live"){try{await sbDel("contas",id);}catch(e){toast("Não dá: há lançamentos nessa conta. Edite-os antes.");return;}}DB.contas=DB.contas.filter(x=>x.id!==id);document.querySelectorAll(".modal-bg").forEach(b=>b.remove());toast("Excluída");await afterWrite();});}
function addCat(tipo){modal({title:"Nova categoria",fields:[{name:"nome",label:"Nome"},{name:"tipo",label:"Tipo",type:"select",options:[{v:"entrada",l:"Entrada"},{v:"saida",l:"Saída"}],default:tipo}],onSave:async v=>{if(!v.nome){toast("Nome");return false;}const o={id:"cat"+Date.now(),nome:v.nome,tipo:v.tipo,parent_id:null};if(MODE==="live")o.id=await sbIns("categorias",{nome:v.nome,tipo:v.tipo,visao:VISAO});DB.categorias.push(o);toast("Criada");await afterWrite();}});}
/* Gerenciador de subcategorias: ADICIONA QUANTAS QUISER sem fechar o modal
   (Enter ou botão; aceita várias separadas por vírgula), lista as existentes
   e mostra erro por item se o servidor recusar. */
function addSub(pid){const p=DB.categorias.find(c=>c.id===pid);if(!p)return;
  const bg=el(`<div class="modal-bg"><div class="modal"><h3>Subcategorias de ${esc(p.nome)}</h3><div class="body" style="gap:8px">
    <div class="sub" style="margin:0">Quantas quiser — digite e dê Enter. Dica: separe várias por vírgula pra criar de uma vez.</div>
    <div style="display:flex;gap:8px"><input id="subNew" placeholder="Ex.: Mensalidade, Material, Uniforme" style="flex:1"><button class="btn" id="subAdd">Adicionar</button></div>
    <div id="subList" style="max-height:40vh;overflow:auto"></div>
  </div><div class="foot"><button class="btn ghost" id="subClose">Fechar</button></div></div></div>`);
  document.body.appendChild(bg);
  const render=()=>{const subs=catSubsSorted(p);bg.querySelector('#subList').innerHTML=subs.length?subs.map(s=>`<div style="display:flex;align-items:center;gap:8px;padding:6px 2px;border-bottom:1px solid var(--border)"><span class="chip">${esc(s.nome)}</span><span style="flex:1"></span><button class="btn danger sm" onclick="delCat('${s.id}')">Excluir</button></div>`).join(""):`<div class="empty" style="padding:12px">Nenhuma ainda.</div>`;};
  const close=()=>{bg.remove();viewConfig();};
  bg.querySelector('#subClose').onclick=close;bg.addEventListener('click',e=>{if(e.target===bg)close();});
  const add=async()=>{const inp=bg.querySelector('#subNew');const nomes=inp.value.split(",").map(s=>s.trim()).filter(Boolean);
    if(!nomes.length){toast("Digite o nome da subcategoria");return;}
    let ok=0;
    for(const nome of nomes){
      if(DB.categorias.some(s=>s.parent_id===pid&&String(s.nome).toLowerCase()===nome.toLowerCase())){toast(`"${nome}" já existe nessa categoria`);continue;}
      const o={id:"cat"+Date.now()+Math.random().toString(36).slice(2,4),nome,tipo:p.tipo,parent_id:pid};
      try{if(MODE==="live")o.id=await sbIns("categorias",{nome,tipo:p.tipo,visao:VISAO,parent_id:pid});DB.categorias.push(o);ok++;}
      catch(e){toast(`Não criou "${nome}": ${e.message}`);}
    }
    if(ok){toast(ok>1?`${ok} subcategorias criadas ✓`:"Subcategoria criada ✓");inp.value="";render();}
    inp.focus();};
  bg.querySelector('#subAdd').onclick=add;
  bg.querySelector('#subNew').addEventListener('keydown',e=>{if(e.key==="Enter"){e.preventDefault();add();}});
  render();bg.querySelector('#subNew').focus();
}
function editCat(id){const c=DB.categorias.find(x=>x.id===id);if(!c)return;modal({title:"Editar categoria",fields:[{name:"nome",label:"Nome"}],values:{nome:c.nome},onSave:async v=>{if(!v.nome){toast("Nome");return false;}if(MODE==="live")await sbUpd("categorias",id,{nome:v.nome});c.nome=v.nome;toast("Atualizada");await afterWrite();}});}
function delCat(id){const c=DB.categorias.find(x=>x.id===id);if(!c)return;const subs=DB.categorias.filter(s=>s.parent_id===id).length;confirmDel(`Excluir "${c.nome}"${subs?` e ${subs} subcategorias`:""}?`,async()=>{if(MODE==="live"){try{await sbDel("categorias",id);}catch(e){toast("Erro: "+e.message);return;}}DB.categorias=DB.categorias.filter(x=>x.id!==id&&x.parent_id!==id);document.querySelectorAll(".modal-bg").forEach(b=>b.remove());toast("Excluída");await afterWrite();});}

/* ===== Organizar categorias por módulo (visão) =====
   Legado: quase tudo nasceu "AMBOS" → categoria de negócio vazava pra Família e vice-versa.
   Analisa ONDE cada compartilhada é usada (movimentos+cartões+previstos de TODAS as visões) e
   sugere destino. REGRA DE SEGURANÇA: só sugere mover quando o uso é EXCLUSIVO de um módulo —
   mover nunca tira o nome de um lançamento de outro módulo. Sistema (transferência/fatura/
   saldo inicial) fica compartilhada. Preview editável; nada grava sem confirmar. */
async function catOrganizar(){
  const alvo=DB.categorias.filter(c=>(c.visao||"AMBOS")==="AMBOS").sort((a,b)=>(a.parent_id?1:0)-(b.parent_id?1:0)||String(a.nome).localeCompare(String(b.nome),"pt"));
  if(!alvo.length){toast("Nenhuma categoria compartilhada — módulos já organizados 🎉");return;}
  toast("Analisando o uso em todos os módulos…");
  const uso=new Map();const conta=(id,v)=>{if(!id||!v)return;let e=uso.get(id);if(!e){e={};uso.set(id,e);}e[v]=(e[v]||0)+1;};
  if(MODE==="live"){
    const qs=await Promise.all([
      sb.from("movimentos").select("categoria_id,visao").not("categoria_id","is",null).limit(50000),
      sb.from("cartao_transacoes").select("categoria_id,visao").not("categoria_id","is",null).limit(50000),
      sb.from("previstos").select("categoria_id,visao").not("categoria_id","is",null).limit(20000)]);
    for(const q of qs){if(q.error){toast("Erro na análise: "+q.error.message);return;}(q.data||[]).forEach(r=>conta(r.categoria_id,r.visao));}
  }else{DB.movimentos.forEach(m=>conta(catId(m.categoria),VISAO));}
  const SISTEMA=/transfer|fatura|saldo inicial/i;
  const parentSug=new Map();
  const plano=alvo.map(c=>{
    const u=uso.get(c.id)||{},vs=Object.keys(u);
    let sug="AMBOS",why="";
    if(SISTEMA.test(c.nome||"")){sug="AMBOS";why="sistema — fica compartilhada";}
    else if(vs.length===1){sug=vs[0];why=`uso só em ${vs[0]} (${u[vs[0]]}×)`;}
    else if(vs.length===0){sug=c.parent_id?(parentSug.get(c.parent_id)||"AMBOS"):"AMBOS";why=c.parent_id&&sug!=="AMBOS"?"segue a categoria-mãe":"sem uso — você decide";}
    else{sug="AMBOS";why="usada em "+vs.map(v=>`${v} ${u[v]}×`).join(" · ")+" — fica compartilhada";}
    if(!c.parent_id)parentSug.set(c.id,sug);
    return{c,sug,why};
  });
  const nMove=plano.filter(p=>p.sug!=="AMBOS").length;
  const optDest=sel=>[["AMBOS","🌐 compartilhada"],...PROFILES.map(p=>[p.code,p.icon+" "+p.label])].map(([v,l])=>`<option value="${v}" ${v===sel?"selected":""}>${l}</option>`).join("");
  const rows=plano.map((p,i)=>`<tr style="border-top:1px solid var(--border)">
    <td style="padding:6px 8px">${p.c.parent_id?"↳ ":""}<b style="font-weight:550;font-size:12.5px">${esc(p.c.nome)}</b> <span class="chip">${p.c.tipo==="entrada"?"entrada":"saída"}</span><div class="sub" style="font-size:10.5px;margin:0">${esc(p.why)}</div></td>
    <td style="padding:6px 4px"><select data-org="${i}" style="font-size:12px">${optDest(p.sug)}</select></td></tr>`).join("");
  const bg=el(`<div class="modal-bg"><div class="modal" style="width:min(640px,96vw)"><h3>🧹 Organizar categorias por módulo</h3><div class="body" style="gap:6px">
    <div class="sub" style="margin:0">${alvo.length} compartilhada(s) analisadas · <b>${nMove}</b> com uso exclusivo de um módulo (sugeridas pra migrar). Mover é seguro: só sugerimos quando NENHUM outro módulo usa. Ajuste o destino se quiser e aplique.</div>
    <div style="overflow:auto;max-height:56vh"><table style="width:100%;border-collapse:collapse"><tbody>${rows}</tbody></table></div>
  </div><div class="foot"><button class="btn ghost" data-act="cancel">Cancelar</button><button class="btn" data-act="apply">Aplicar organização</button></div></div></div>`);
  document.body.appendChild(bg);const close=()=>bg.remove();
  bg.addEventListener("click",e=>{if(e.target===bg)close();});bg.querySelector('[data-act=cancel]').onclick=close;
  bg.querySelector('[data-act=apply]').onclick=async()=>{
    const btn=bg.querySelector('[data-act=apply]');btn.disabled=true;let n=0,err=0;
    for(let i=0;i<plano.length;i++){
      const sel=bg.querySelector(`[data-org="${i}"]`);if(!sel)continue;
      const dest=sel.value,c=plano[i].c;
      if(dest===(c.visao||"AMBOS"))continue;
      try{if(MODE==="live")await sbUpd("categorias",c.id,{visao:dest});c.visao=dest;n++;}catch(e){err++;}
    }
    close();toast(n?`${n} categoria(s) organizadas ✓${err?` · ${err} com erro`:""}`:"Nada pra mudar");if(n)await afterWrite();
  };
}
async function setGrupoDre(id,val){const c=DB.categorias.find(x=>x.id===id);if(!c)return;const prev=c.grupo_dre;c.grupo_dre=val||null;try{if(MODE==="live")await sbUpd("categorias",id,{grupo_dre:val||null});toast(val?("→ "+val):"Grupo removido (auto)");}catch(e){c.grupo_dre=prev;toast("Erro: "+e.message);}}

/* ===== Router + Init ===== */
/* ===== Central Financeira — consolidado de TODAS as visões ===== */
let CENTRAL=null;
function _finalizeCentral(per){const visoes=PROFILES.map(p=>{const P=per[p.code];P.entPrev=P.entReal+P.entAReal;P.saiPrev=P.saiReal+P.saiAReal;P.proj=P.saldo+P.entAReal-P.saiAReal;return P;});
  const sum=k=>visoes.reduce((s,v)=>s+v[k],0);
  return{visoes,totalSaldo:sum("saldo"),totalEntPrev:sum("entPrev"),totalSaiPrev:sum("saiPrev"),totalProj:sum("proj")};}
function _emptyPer(){const per={};PROFILES.forEach(p=>per[p.code]={...p,saldo:0,entReal:0,saiReal:0,entAReal:0,saiAReal:0});return per;}
function _demoCentral(){const d=new Date();const{de,ate}=monthBounds(d.getFullYear(),d.getMonth()+1);const o=overviewNumbers(de,ate);const per=_emptyPer();const P=per[VISAO];if(P){P.saldo=o.saldoTotal;P.entReal=o.entReal;P.saiReal=o.saiReal;P.entAReal=o.entAReal;P.saiAReal=o.saiAReal;}return _finalizeCentral(per);}
async function loadCentral(){
  if(MODE==="demo")return _demoCentral();
  const d=new Date();const{de,ate}=monthBounds(d.getFullYear(),d.getMonth()+1);
  const codes=PROFILES.map(p=>p.code).concat("AMBOS");
  const[contas,cats,mv,pv]=await Promise.all([
    sb.from("contas").select("id,nome,tipo,visao,saldo_atual,saldo_atualizado_em,ativo").in("visao",codes),
    sb.from("categorias").select("id,nome").in("visao",codes),
    sb.from("movimentos").select("data,descricao_limpa,descricao_original,valor,sinal,categoria_id,visao,observacao,conta_id").gte("data",de).lte("data",ate).limit(20000),
    sb.from("previstos").select("valor,vencimento,tipo,status,recorrencia,visao,descricao,observacao").in("visao",codes).limit(20000)]);
  const enumNovo=[contas,mv,pv].some(r=>r.error&&(/invalid input value for enum/i.test(r.error.message||"")||r.error.code==="22P02"));
  if(enumNovo)return _finalizeCentral(_emptyPer());
  for(const r of[contas,mv,pv])if(r.error)throw new Error(r.error.message);
  const catName=new Map(((cats.data)||[]).map(c=>[c.id,c.nome]));
  const per=_emptyPer();
  (contas.data||[]).forEach(c=>{const P=per[c.visao];if(!P)return;const isCard=c.tipo==="cartao"||/cart/i.test(c.nome||"");if(!isCard&&c.saldo_atual!=null)P.saldo+=Number(c.saldo_atual);
    if(c.ativo!==false&&c.saldo_atual!=null&&!/fora do extrato/i.test(c.nome||"")){const d=frescorDias(c.saldo_atualizado_em);if(d!=null&&d>3)P.feedN=(P.feedN||0)+1;}});
  const tipoConta=new Map(((contas.data)||[]).map(c=>[c.id,c.tipo]));
  (mv.data||[]).forEach(r=>{const P=per[r.visao];if(!P)return;const m={categoria:catName.get(r.categoria_id)||"",descricao:r.descricao_limpa||r.descricao_original||"",observacao:r.observacao||"",valor:Number(r.valor||0),sentido:r.sinal===1?"Entrada":"Saída",_cartao:tipoConta.get(r.conta_id)==="cartao"};if(isInterno(m)||isInterVisao(m))return;if(m.sentido==="Entrada")P.entReal+=m.valor;else P.saiReal+=m.valor;});
  const hoje=todayISO();
  (pv.data||[]).forEach(p=>{const P=per[p.visao];if(!P||!isPrevAberto(p.status))return;
    if(p.tipo==="pagar"&&(p.vencimento||"")<hoje){P.atrasN=(P.atrasN||0)+1;P.atrasTot=(P.atrasTot||0)+Number(p.valor||0);}
    if(p.tipo==="pagar"&&isPrevFatura(p))return;const occ=ocorrencias(p.vencimento,p.recorrencia,de,ate).length;if(!occ)return;if(p.tipo==="receber")P.entAReal+=occ*Number(p.valor||0);else if(p.tipo==="pagar")P.saiAReal+=occ*Number(p.valor||0);});
  return _finalizeCentral(per);}
function centralRow(v){const active=v.code===VISAO;return`<div onclick="setVisao('${v.code}')" role="button" tabindex="0" style="cursor:pointer;display:flex;align-items:center;gap:12px;background:var(--card);border:1px solid ${active?'var(--primary)':'var(--border)'};border-radius:12px;padding:12px 14px;margin-bottom:8px;box-shadow:var(--shadow)">
  <div style="font-size:20px;width:26px;text-align:center">${v.icon}</div>
  <div style="flex:1;min-width:0"><div style="font-weight:660">${esc(v.label)}</div><div class="sub" style="font-size:11px">${esc(v.grupo)}${active?' · aberta agora':''}</div>${(v.atrasN||v.feedN)?`<div style="font-size:10.5px;font-weight:700;margin-top:2px">${v.atrasN?`<span style="color:#dc2626">⚠️ ${v.atrasN} conta(s) atrasada(s) · ${fmtK(v.atrasTot)}</span>`:""}${v.atrasN&&v.feedN?" · ":""}${v.feedN?`<span style="color:#d97706">🔌 feed parado (${v.feedN})</span>`:""}</div>`:""}</div>
  <div style="text-align:right"><div class="${v.saldo>=0?'in':'out'}" style="font-weight:700;font-variant-numeric:tabular-nums">${fmtBRL(v.saldo)}</div><div class="sub" style="font-size:10px">abrir ›</div></div>
</div>`;}
function viewCentral(){const c=CENTRAL||_finalizeCentral(_emptyPer());
  const grupos=["Negócios","Pessoal"].map(g=>{const vs=c.visoes.filter(v=>v.grupo===g);if(!vs.length)return'';return`<div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:700;margin:18px 2px 8px">${g==='Pessoal'?'Vida':g}</div>${vs.map(centralRow).join("")}`;}).join("");
  $("#view").innerHTML=`
  <div class="row"><div><h1>Central financeira</h1><div class="sub">Consolidado de todas as visões · mês atual</div></div></div>
  <div class="panel" style="background:#0b1220;color:#fff;border:0">
    <div style="font-size:12px;opacity:.75">💰 Saldo consolidado</div>
    <div style="font-size:30px;font-weight:720;letter-spacing:-.02em;margin-top:2px;font-variant-numeric:tabular-nums">${fmtBRL(c.totalSaldo)}</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:16px">
      <div><div style="font-size:11px;opacity:.7">Entradas prev.</div><div style="font-size:16px;font-weight:600;color:#4ade80">${fmtBRL(c.totalEntPrev)}</div></div>
      <div><div style="font-size:11px;opacity:.7">Saídas prev.</div><div style="font-size:16px;font-weight:600;color:#f87171">${fmtBRL(c.totalSaiPrev)}</div></div>
      <div><div style="font-size:11px;opacity:.7">Projetado</div><div style="font-size:16px;font-weight:600;color:#a5b4fc">${fmtBRL(c.totalProj)}</div></div>
    </div>
  </div>
  <div style="font-size:13px;color:var(--muted);margin:6px 2px 0">Escolha uma visão para abrir o detalhe.</div>
  ${grupos}`;
}
/* =====================================================================
   MODO FINANCEIRO · Contas a Pagar  (rota "financeiro")
   Versão VIVA do dashboard `contas_agosto_2026.html`: lê `previstos`
   (tipo=pagar) de TODAS as visões que a pessoa pode ver — por isso NÃO
   usa DB.contasPagar, que é só da visão aberta.
   BUCKETS = iguais aos do dashboard estático: linhas JÁ CADASTRADAS,
   sem projeção de recorrência (quem projeta recorrente é a Visão Geral /
   Contas do mês). Assim os números batem 1:1 com a tabela.
   ESCRITA: o ✓ respeita `podeEditar(visao da linha)` e, em linha
   recorrente, usa o MESMO modelo do ✓ das Contas do mês — nasce uma
   instância PAGA no dia e o template rola pra próxima ocorrência (pagar
   agosto não mata a série). Não lança movimento: aqui as contas vêm de
   várias visões e o extrato (Pluggy/Inter) traz o débito real.
   ===================================================================== */
let FP={mes:null,vis:new Set(),dados:null,carregando:false,erro:"",hor:(()=>{try{const raw=localStorage.getItem("cfin_fp_hor");if(raw==null)return 1;const h=+raw;return[0,1,3,6].indexOf(h)>=0?h:1;}catch(e){return 1;}})()},FP_UNDO={},FP_GEN=0;
const FP_EST_RX=/perspectiva|estimativa/i;
const fpProfile=c=>PROFILES.find(p=>p.code===c)||{code:c,label:c==="AMBOS"?"Compartilhado":c,grupo:"",icon:"●",cor:"#64748b",corBg:"#eef0f3"};
const fpSum=a=>a.reduce((s,r)=>s+r.valor,0);
const fpDDMM=s=>(s||"").slice(8,10)+"/"+(s||"").slice(5,7);
const fpPago=r=>String(r.status||"").toLowerCase()==="pago";
const fpBadge=cd=>{const p=fpProfile(cd);return `<span class="fp-badge" style="background:${p.corBg};color:${p.cor}">${esc(p.label)}</span>`;};

/* ---- drill-down: todo valor da tela abre a lista exata de contas que ele soma ---- */
const FP_DRILL={ab:["Tudo em aberto","mês + atrasadas + meses futuros"],mesAberto:["A pagar no recorte","ainda a vencer no período selecionado"],mesPago:["Já pago no recorte","baixadas no período"],atras:["Atrasado","venceu e não foi pago (inclui o mês)"],prox:["Fora do recorte","a vencer depois do período selecionado"],vencidasNoMes:["Já vencido no mês","do mês, já passaram do vencimento"]};
function fpDrillGo(id){document.querySelectorAll('.modal-bg').forEach(b=>b.remove());fpDetalhe(id);}
function fpDrowRows(list){const hoje=todayISO();return list.map(r=>{const late=!fpPago(r)&&r.venc<hoje;return `<div class="fp-drow" onclick="fpDrillGo('${r.id}')"><span class="fp-drow-day ${late?"late":""}">${fpDDMM(r.venc)}</span><span class="fp-drow-desc"><b>${esc(r.desc)}</b>${(r.conta||r.categoria)?`<span class="fp-obs">${esc([r.conta,r.categoria].filter(Boolean).join(" · "))}</span>`:""}</span>${fpBadge(r.visao)}<span class="fp-drow-val out">${fmtBRL(r.valor)}</span></div>`;}).join("")||`<div class="empty">Nada nesta lista.</div>`;}
function fpDrill(bucket,visao){
  const c=FP.calc;if(!c)return;
  let list=(c[bucket]||[]).slice().sort((a,b)=>a.venc<b.venc?-1:(a.venc>b.venc?1:0));
  if(visao)list=list.filter(r=>r.visao===visao);
  const meta=FP_DRILL[bucket]||["Contas",""],pv=visao?fpProfile(visao):null;
  const head=`<div class="fp-dhead">${pv?`<span class="fp-badge" style="background:${pv.corBg};color:${pv.cor}">${esc(pv.label)}</span>`:""}<span class="sub" style="margin:0">${esc(meta[1])} · ${list.length} conta(s)</span><b class="num out" style="margin-left:auto">${fmtBRL(fpSum(list))}</b></div>`;
  const podeAbrir=visao&&podeVer(visao)&&["ab","mesAberto","atras","prox"].indexOf(bucket)>=0;
  const foot=podeAbrir?`<div style="margin-top:12px"><button class="btn ghost sm" onclick="document.querySelectorAll('.modal-bg').forEach(b=>b.remove());fpAbrirEm('${visao}')">Abrir em ${esc(pv.label)} ›</button></div>`:"";
  modal({title:mkLabel(c.mk)+" · "+meta[0],extraHTML:`${head}<div class="fp-dlist">${fpDrowRows(list)}</div>${foot}`});
}
function fpDrillDay(d){
  const c=FP.calc;if(!c)return;
  const list=c.mesAberto.filter(r=>r.venc===d).sort((a,b)=>b.valor-a.valor);
  const head=`<div class="fp-dhead"><span class="sub" style="margin:0">${list.length} conta(s) vencendo neste dia</span><b class="num out" style="margin-left:auto">${fmtBRL(fpSum(list))}</b></div>`;
  modal({title:fmtDate(d),extraHTML:`${head}<div class="fp-dlist">${fpDrowRows(list)}</div>`});
}

/* carrega previstos a pagar de todas as visões visíveis (RLS filtra o resto) */
async function fpLoad(){
  if(MODE==="demo"){
    const rows=(DB.contasPagar||[]).filter(p=>p.vencimento).map(p=>({id:p._row,desc:p.descricao||"",valor:Math.abs(Number(p.valor)||0),venc:(p.vencimento||"").slice(0,10),status:p.status||"aberto",rec:p.recorrencia||"",visao:VISAO,conta:p.banco||"",categoria:p.categoria||"",obs:"",conta_id:null,categoria_id:null,est:FP_EST_RX.test(p.descricao||"")}));
    return{rows,semVenc:0};
  }
  const codes=visoesVisiveis().map(p=>p.code).concat("AMBOS");
  const[pv,ct,cg]=await Promise.all([
    sb.from("previstos").select("id,descricao,valor,vencimento,tipo,status,recorrencia,visao,conta_id,categoria_id,observacao").eq("tipo","pagar").in("visao",codes).order("vencimento").limit(20000),
    sb.from("contas").select("id,nome").in("visao",codes),
    sb.from("categorias").select("id,nome").in("visao",codes)]);
  /* visão nova ainda não provisionada no enum → vazio em vez de quebrar (igual loadData) */
  if([pv,ct,cg].some(r=>r.error&&(/invalid input value for enum/i.test(r.error.message||"")||r.error.code==="22P02")))return{rows:[],semVenc:0};
  if(pv.error)throw new Error(pv.error.message);
  const cn=new Map((((ct||{}).data)||[]).map(c=>[c.id,c.nome])),kn=new Map((((cg||{}).data)||[]).map(c=>[c.id,c.nome]));
  const todas=(pv.data||[]);
  const rows=todas.filter(p=>p.vencimento).map(p=>({
    id:p.id,desc:p.descricao||"",valor:Math.abs(Number(p.valor)||0),venc:String(p.vencimento).slice(0,10),
    status:p.status||"aberto",rec:p.recorrencia||"",visao:p.visao,conta_id:p.conta_id||null,categoria_id:p.categoria_id||null,
    conta:cn.get(p.conta_id)||"",categoria:kn.get(p.categoria_id)||"",obs:p.observacao||"",
    est:FP_EST_RX.test(p.descricao||"")}));
  return{rows,semVenc:todas.length-rows.length};
}

/* buckets do mês selecionado + recortes de visão */
function fpCalc(){
  const mk=FP.mes,{de,ate}=monthBounds(+mk.slice(0,4),+mk.slice(5,7)),hoje=todayISO();
  /* RECORTE DE PERÍODO (31/08, pedido dele): o período selecionado manda — em "Mês" você vê
     o mês; futuro só entra quando amplia pra 3m/6m/Tudo. Nada de 78k de "próximos meses"
     dominando uma tela de agosto. */
  const hor=(FP.hor==null?1:FP.hor);   /* 1|3|6 meses · 0 = tudo */
  const fimFk=hor===0?null:addMonth(mk,hor-1);
  const fimAte=fimFk?fimFk+"-"+pad2(daysInMonth(+fimFk.slice(0,4),+fimFk.slice(5,7))):null;
  const perLbl=hor===1?("em "+mkLabel(mk)):hor===0?("de "+mkLabel(mk)+" em diante"):(mkLabel(mk)+" → "+mkLabel(fimFk));
  const rows=(FP.dados.rows||[]).filter(r=>!FP.vis.size||FP.vis.has(r.visao));
  const ab=rows.filter(r=>isPrevAberto(r.status));           /* exclui pago e cancelado */
  const noPer=r=>r.venc>=de&&(fimAte?r.venc<=fimAte:true);
  /* ATRASADO = venceu e não foi pago, INCLUINDO o mês corrente (31/08: IPTU de 10/08 aparecia
     como "a pagar no mês" com Atrasado zerado — contra-intuitivo). "A pagar" = ainda VAI vencer. */
  const atras=ab.filter(r=>r.venc<hoje).sort((a,b)=>a.venc<b.venc?-1:1);
  const mesAberto=ab.filter(r=>r.venc>=hoje&&noPer(r)).sort((a,b)=>a.venc<b.venc?-1:1);
  const mesAbertoTotal=ab.filter(noPer).sort((a,b)=>a.venc<b.venc?-1:1);   /* inclui vencidas do recorte (gráfico) */
  const mesPago=rows.filter(r=>fpPago(r)&&noPer(r)).sort((a,b)=>a.venc<b.venc?-1:1);
  const prox=fimAte?ab.filter(r=>r.venc>fimAte&&r.venc>=hoje).sort((a,b)=>a.venc<b.venc?-1:1):[];
  const vencidasNoMes=atras.filter(r=>r.venc>=de&&r.venc<=ate);
  return{mk,de,ate,hoje,hor,fimFk,fimAte,perLbl,rows,ab,mesAberto,mesAbertoTotal,mesPago,atras,prox,vencidasNoMes};
}

/* ---- interações ---- */
function fpMes(n){FP.mes=addMonth(FP.mes,n);viewFinanceiro();}
function fpHor(h){FP.hor=h;try{localStorage.setItem("cfin_fp_hor",String(h));}catch(e){}viewFinanceiro();}
function fpHojeMes(){FP.mes=todayISO().slice(0,7);viewFinanceiro();}
function fpVisTgl(code){if(!code){FP.vis.clear();}else if(FP.vis.has(code)){FP.vis.delete(code);}else{FP.vis.add(code);}viewFinanceiro();}
function fpRecarregar(){FP.dados=null;FP.erro="";viewFinanceiro();}

/* ---- render ---- */
function viewFinanceiro(){
  if(!FP.mes)FP.mes=todayISO().slice(0,7);
  if(FP.erro){
    $("#view").innerHTML=`<div class="row"><div><h1>Modo Financeiro</h1><div class="sub">Contas a pagar · todas as visões que você enxerga</div></div></div>
      <div class="panel"><h2>Não consegui carregar</h2><div class="sub">${esc(FP.erro)}</div><div style="margin-top:12px"><button class="btn" onclick="fpRecarregar()">Tentar de novo</button></div></div>`;
    return;}
  if(!FP.dados){
    /* geração: uma recarga disparada depois de gravar SEMPRE vence a que estava no ar
       (senão a resposta antiga voltava por cima e mostrava o valor pré-baixa) */
    const gen=++FP_GEN;FP.carregando=true;
    fpLoad().then(d=>{if(gen===FP_GEN)FP.dados=d;},e=>{if(gen===FP_GEN)FP.erro=e.message||String(e);})
      .then(()=>{if(gen!==FP_GEN)return;FP.carregando=false;if(CURRENT==="financeiro")viewFinanceiro();});
    $("#view").innerHTML=`<div class="row"><div><h1>Modo Financeiro</h1><div class="sub">Contas a pagar · todas as visões que você enxerga</div></div></div><div class="panel"><div class="empty">Carregando contas…</div></div>`;
    return;}

  const c=fpCalc(),hoje=c.hoje;FP.calc=c;   /* guardado pro drill-down (clique nos valores) */
  const codesComLinha=[...new Set((FP.dados.rows||[]).map(r=>r.visao))];
  const podeAlgo=codesComLinha.some(cd=>podeEditar(cd));

  /* filtros por frente */
  const chip=(code,label,cor)=>`<button class="${(!code&&!FP.vis.size)||(code&&FP.vis.has(code))?"on":""}" style="--c:${cor||"var(--primary)"}" onclick="fpVisTgl(${code?`'${code}'`:""})">${code?`<span class="fp-dot" style="--c:${cor}"></span>`:"◎ "}${esc(label)}</button>`;
  const filtros=`<div class="fp-fil">${chip("","Todas")}${codesComLinha.map(cd=>{const p=fpProfile(cd);return chip(cd,p.label,p.cor);}).join("")}</div>`;

  /* KPIs — “total em aberto” e “próximos” são de TODAS as competências */
  const kpi=(lbl,val,hint,cls,bucket)=>`<div class="kpi${bucket?" clk":""}"${bucket?` onclick="fpDrill('${bucket}')" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click();}" title="Ver as contas desse total"`:""}><div class="lbl">${lbl}${bucket?`<span class="kpi-go">›</span>`:""}</div><div class="val ${cls||""}">${fmtBRL(val)}</div><div class="hint">${hint}</div></div>`;
  /* ORDEM (31/08, pedido do Gustavo): o mês manda — o antigo card líder "Total em aberto"
     somava TODOS os meses futuros numa tela ancorada em Ago/26 e "a conta não batia".
     Ele vai pro FIM, renomeado, dizendo às claras o que soma. */
  const kpis=`<div class="fp-kpis">
    ${kpi("A pagar "+c.perLbl,fpSum(c.mesAberto),c.mesAberto.length+" conta(s) ainda a vencer no recorte","","mesAberto")}
    ${kpi("Atrasado",fpSum(c.atras),c.atras.length+" conta(s) que venceram e não foram pagas","cr","atras")}
    ${kpi("Já pago "+(c.hor===1?"· "+mkLabel(c.mk):"no recorte"),fpSum(c.mesPago),c.mesPago.length+" baixada(s)","gd","mesPago")}
    ${c.hor===0?kpi("Tudo em aberto",fpSum(c.ab),c.ab.length+" conta(s) = recorte + atrasadas","","ab"):""}
  </div>
  ${c.prox.length?`<div class="sub" style="margin:-6px 2px 12px">${c.prox.length} conta(s) fora do recorte (depois de ${mkLabel(c.fimFk)}) somando <b>${fmtBRL(fpSum(c.prox))}</b> · <span class="link" onclick="fpDrill('prox')">ver</span> · <span class="link" onclick="fpHor(0)">ampliar pra Tudo</span></div>`:""}`;

  /* card por frente */
  const cards=codesComLinha.filter(cd=>!FP.vis.size||FP.vis.has(cd)).map(cd=>{
    const p=fpProfile(cd),f=a=>a.filter(r=>r.visao===cd);
    const abV=f(c.ab),mAb=f(c.mesAberto),mPg=f(c.mesPago),atr=f(c.atras),px=f(c.prox);
    const ln=(k,arr,cls,bucket)=>{const on=bucket&&arr.length;return `<div class="fp-line${on?" clk":""}"${on?` onclick="fpDrill('${bucket}','${cd}')"`:""}><span class="k">${k}<span class="q">${arr.length}</span></span><span class="v ${arr.length&&cls?cls:""}">${fmtBRL(fpSum(arr))}</span></div>`;};
    const abOn=abV.length;
    return `<div class="panel fp-vcard" style="--c:${p.cor}">
      <div class="fp-vh"><span class="fp-dot"></span><span class="fp-vt">${esc(p.label)}</span><span class="fp-vtag">· ${esc(p.grupo==="Pessoal"?"Vida":p.grupo||"—")}</span></div>
      ${ln("A pagar "+c.perLbl,mAb,"","mesAberto")}
      ${ln("Já pago",mPg,"in","mesPago")}
      ${ln("Atrasado",atr,"out","atras")}
      ${c.hor===0?`<div class="fp-line tot${abOn?" clk":""}"${abOn?` onclick="fpDrill('ab','${cd}')"`:""}><span class="k">Tudo em aberto</span><span class="v">${fmtBRL(fpSum(abV))}</span></div>`
        :`<div class="fp-line tot"><span class="k">Aberto no recorte + atrasadas</span><span class="v">${fmtBRL(fpSum(mAb)+fpSum(atr))}</span></div>`}
    </div>`;}).join("");

  /* gráfico: dia de vencimento × frente (só o que está EM ABERTO no mês) */
  const byDay={};
  c.mesAbertoTotal.filter(r=>r.venc<=c.ate).forEach(r=>{(byDay[r.venc]=byDay[r.venc]||{tot:0,por:{},itens:[]});byDay[r.venc].tot+=r.valor;byDay[r.venc].por[r.visao]=(byDay[r.venc].por[r.visao]||0)+r.valor;byDay[r.venc].itens.push(r);});
  const dias=Object.keys(byDay).sort(),maxDia=Math.max(1,...dias.map(d=>byDay[d].tot));
  const chart=dias.length?`<div class="fp-chart">${dias.map(d=>{
    const o=byDay[d],late=d<hoje,h=v=>Math.max(3,Math.round(v/maxDia*145));
    const segs=Object.keys(o.por).map(cd=>`<div class="fp-seg" style="--c:${fpProfile(cd).cor};height:${h(o.por[cd])}px"></div>`).join("");
    const tip=fmtDate(d)+" — "+o.itens.map(i=>i.desc+": "+fmtBRL(i.valor)).join(" · ")+" · clique pra abrir";
    return `<div class="fp-col clk ${late?"late":""}" title="${esc(tip)}" onclick="fpDrillDay('${d}')">
      <div class="fp-cval">${fmtK(o.tot)}</div><div class="fp-stack">${segs}</div><div class="fp-cday">${fpDDMM(d)}</div></div>`;}).join("")}</div>`
    :`<div class="empty">Nada em aberto vencendo em ${mkLabel(c.mk)}.</div>`;
  const legenda=`<div class="fp-legend">${codesComLinha.filter(cd=>!FP.vis.size||FP.vis.has(cd)).map(cd=>{const p=fpProfile(cd);return `<span class="li"><span class="fp-dot" style="--c:${p.cor}"></span> ${esc(p.label)}</span>`;}).join("")}<span class="li" style="margin-left:auto"><span style="color:var(--expense)">●</span> dia já vencido</span></div>`;

  /* tabelas */
  const badgeV=cd=>{const p=fpProfile(cd);return `<span class="fp-badge" style="background:${p.corBg};color:${p.cor}">${esc(p.label)}</span>`;};
  const situacao=r=>fpPago(r)?`<span class="fp-badge pago">✓ Paga</span>`
    :(r.venc<hoje?`<span class="fp-badge late">● Vencida</span>`
    :(r.est?`<span class="fp-badge est">~ Estimativa</span>`:`<span class="fp-badge open">A pagar</span>`));
  const acao=r=>{
    if(fpPago(r))return FP_UNDO[r.id]?`<button class="btn ghost sm" title="Desfazer a baixa" onclick="event.stopPropagation();fpUndo('${r.id}')">↩︎</button>`:"";
    return podeEditar(r.visao)?`<button class="btn ghost sm" title="Marcar como paga" onclick="event.stopPropagation();fpPay('${r.id}')" aria-label="Marcar como paga">✓</button>`:"";};
  /* ação na 1ª coluna: no celular o ✓ fica sempre à vista (mesmo lugar do ✓ das Contas do mês) */
  const tr=(r,comSit)=>`<tr class="fp-tr" onclick="fpDetalhe('${r.id}')">
    <td class="fp-act">${acao(r)}</td>
    <td class="fp-day ${(!fpPago(r)&&r.venc<hoje)?"late":""}">${fpDDMM(r.venc)}</td>
    <td><div class="fp-desc">${esc(r.desc)}</div>${r.conta||r.categoria?`<div class="fp-obs">${esc([r.conta,r.categoria].filter(Boolean).join(" · "))}</div>`:""}</td>
    <td>${badgeV(r.visao)}</td>
    ${comSit?`<td>${situacao(r)}</td>`:""}
    <td class="num out">${fmtBRL(r.valor)}</td></tr>`;
  const tabela=(list,comSit,vazio)=>`<div class="fp-wrap"><table><thead><tr><th></th><th>Venc.</th><th>Conta</th><th>Frente</th>${comSit?"<th>Situação</th>":""}<th class="num">Valor</th></tr></thead>
    <tbody>${list.map(r=>tr(r,comSit)).join("")||`<tr><td colspan="${comSit?6:5}"><div class="empty">${esc(vazio)}</div></td></tr>`}</tbody></table></div>`;

  const semVenc=FP.dados.semVenc?`<div class="sub" style="margin:-6px 2px 12px">⚠️ ${FP.dados.semVenc} conta(s) sem data de vencimento ficaram de fora — abra <b>Contas a Pagar</b> na visão delas pra datar.</div>`:"";

  $("#view").innerHTML=`
  <div class="row">
    <div><h1>Modo Financeiro · Contas a Pagar</h1><div class="sub">${mkLabel(c.mk)} — ${codesComLinha.length} frente(s) que você enxerga, separadas e consolidadas${podeAlgo?" · toque no ✓ pra dar baixa":""}</div></div>
    <div class="controls" style="margin:0">
      <button class="btn ghost sm" onclick="fpMes(-1)" aria-label="Mês anterior">‹</button>
      <div style="font-weight:660;min-width:92px;text-align:center">${mkLabel(c.mk)}</div>
      <button class="btn ghost sm" onclick="fpMes(1)" aria-label="Próximo mês">›</button>
      ${c.mk!==todayISO().slice(0,7)?`<button class="btn ghost sm" onclick="fpHojeMes()">hoje</button>`:""}
      <span style="width:8px"></span>
      ${[[1,"Mês"],[3,"3m"],[6,"6m"],[0,"Tudo"]].map(([h,l])=>`<button class="btn ${c.hor===h?"":"ghost"} sm" onclick="fpHor(${h})">${l}</button>`).join("")}
      <button class="btn sm" onclick="addPagar()" title="Lança na visão aberta (${esc(VISAO_LABEL)})">+ Nova</button>
    </div>
  </div>
  <div class="controls">${filtros}<button class="btn ghost sm" style="margin-left:auto" onclick="fpRecarregar()">↻ Atualizar</button></div>
  ${semVenc}
  ${kpis}
  <div class="secttl"><span>Visão separada</span><span class="sub" style="margin:0;text-transform:none;letter-spacing:0;font-weight:500">cada frente com o próprio subtotal</span></div>
  <div class="fp-views">${cards||`<div class="panel"><div class="empty">Nenhuma conta a pagar cadastrada nas visões que você enxerga.</div></div>`}</div>
  <div class="secttl" style="margin-top:20px"><span>Por dia de vencimento · ${mkLabel(c.mk)}</span><span class="num">${fmtBRL(fpSum(c.mesAbertoTotal.filter(r=>r.venc<=c.ate)))}</span></div>
  <div class="panel">
    ${legenda}
    ${chart}
    <div class="fp-lboxes">
      <div class="fp-lbox red clk" onclick="fpDrill('atras')"><div class="ll">Atrasado · venceu e não pagou</div><div class="lv">${fmtBRL(fpSum(c.atras))}</div><div class="lm">${c.atras.length} conta(s), incluindo as do próprio mês</div></div>
      <div class="fp-lbox clk" onclick="fpDrill('vencidasNoMes')"><div class="ll">Já vencido dentro do mês</div><div class="lv">${fmtBRL(fpSum(c.vencidasNoMes))}</div><div class="lm">${c.vencidasNoMes.length} conta(s) do mês que já passaram do vencimento</div></div>
      <div class="fp-lbox clk" onclick="fpDrill('mesAberto')"><div class="ll">A pagar ${c.perLbl}</div><div class="lv">${fmtBRL(fpSum(c.mesAberto))}</div><div class="lm">${c.mesAberto.length} conta(s) ainda a vencer</div></div>
    </div>
  </div>
  <div class="secttl" style="margin-top:20px"><span>Detalhamento · ${c.perLbl}</span><span class="num">${fmtBRL(fpSum(c.mesAbertoTotal))} em aberto</span></div>
  ${tabela([...c.mesAbertoTotal,...c.mesPago].sort((a,b)=>a.venc<b.venc?-1:(a.venc>b.venc?1:0)),true,"Nenhuma conta "+c.perLbl+".")}
  <div class="fp-grid2">
    <div>
      <div class="secttl" style="margin-top:0"><span class="out">Atrasadas · meses anteriores</span><span class="num">${fmtBRL(fpSum(c.atras))}</span></div>
      ${tabela(c.atras,false,"Nada atrasado. 🎉")}
    </div>
    <div>
      <div class="secttl" style="margin-top:0"><span>Fora do recorte${c.fimFk?" · depois de "+mkLabel(c.fimFk):""}</span><span class="num">${fmtBRL(fpSum(c.prox))}</span></div>
      ${tabela(c.prox,false,c.hor===0?"O recorte Tudo já cobre o futuro.":"Nada além do recorte.")}
    </div>
  </div>
  <div class="sub" style="margin:10px 2px 30px">Lê a tabela <code>previstos</code> (tipo “pagar”) ao vivo. Mostra as contas <b>já cadastradas</b> — recorrentes não são projetados aqui (quem projeta é a Visão Geral / Contas do mês). Itens com “PERSPECTIVA/ESTIMATIVA” na descrição vêm marcados como estimativa.</div>`;
}

/* detalhe da linha: no mesmo escopo abre o editor de sempre; fora dele, leitura + atalho */
function fpDetalhe(id){
  const r=(FP.dados&&FP.dados.rows||[]).find(x=>x.id===id);if(!r)return;
  const p=fpProfile(r.visao),mesma=(r.visao===VISAO||VFILTER.indexOf(r.visao)>=0);
  const info=[["Vencimento",fmtDate(r.venc)],["Valor",fmtBRL(r.valor)],["Frente",p.label],["Situação",fpPago(r)?"Paga":(r.venc<todayISO()?"Vencida":"A pagar")],
    ["Conta",r.conta||"—"],["Categoria",r.categoria||"—"],["Recorrência",r.rec||"pontual"]];
  const body=`<div style="display:flex;flex-direction:column;gap:7px">
    ${info.map(([k,v])=>`<div style="display:flex;justify-content:space-between;gap:12px;font-size:13px"><span class="sub" style="margin:0">${esc(k)}</span><b style="font-weight:600">${esc(v)}</b></div>`).join("")}
    ${r.obs?`<div class="sub" style="margin-top:6px;white-space:pre-wrap">${esc(r.obs)}</div>`:""}
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
      ${(!fpPago(r)&&podeEditar(r.visao))?`<button class="btn sm" onclick="document.querySelectorAll('.modal-bg').forEach(b=>b.remove());fpPay('${r.id}')">✓ Marcar como paga</button>`:""}
      ${mesma?`<button class="btn ghost sm" onclick="document.querySelectorAll('.modal-bg').forEach(b=>b.remove());editPagar('${r.id}')">✏️ Editar</button>`
             :`<button class="btn ghost sm" onclick="document.querySelectorAll('.modal-bg').forEach(b=>b.remove());fpAbrirEm('${r.visao}')">Abrir em ${esc(p.label)} ›</button>`}
      <button class="btn ghost sm" onclick="document.querySelectorAll('.modal-bg').forEach(b=>b.remove());audVer('previstos','${r.id}')">🧾 Histórico</button>
    </div></div>`;
  const mh=modal({title:r.desc,extraHTML:body});
  anexSection(mh.bg,"previsto",r.id,r.visao);   /* boletos/comprovantes desta conta */
  entField(mh.bg,"previstos",r.id,r.desc);      /* contato/cliente (integridade) */
}
async function fpAbrirEm(code){await setVisao(code);route(IS_PESSOAL?"contas":"pagar");}

/* =====================================================================
   ANEXOS — documentos financeiros (boletos, comprovantes, notas)
   Bucket privado 'anexos-financeiro'; metadados em public.anexos.
   RLS por visão (mesmo app_pode de previstos). Só no modo live.
   DDL versionada em scripts/anexos-financeiro.sql (rodar 1× no SQL Editor).
   ===================================================================== */
const ANEX_BUCKET="anexos-financeiro";
const anexIcon=(mime,nome)=>{const s=(mime||"")+"|"+(nome||"");return /pdf/i.test(s)?"📄":/(png|jpe?g|webp|heic|heif|image)/i.test(s)?"🖼️":"📎";};
const anexTam=n=>{n=+n||0;return n<1024?n+" B":n<1048576?Math.round(n/1024)+" KB":(n/1048576).toFixed(1)+" MB";};
const anexCol=scope=>scope==="previsto"?"previsto_id":"movimento_id";

/* injeta a seção de anexos dentro de um modal já aberto (bg) */
async function anexSection(bg,scope,id,visao){
  if(MODE!=="live"||!bg||!id)return;
  const body=bg.querySelector(".body");if(!body)return;
  const podeEd=podeEditar(visao);
  const wrap=el(`<div class="anx"><div class="anx-hd"><span class="anx-ttl">📎 Anexos</span>${podeEd?`<label class="btn ghost sm anx-add">+ Anexar<input type="file" accept="application/pdf,image/*" hidden multiple></label>`:""}</div><div class="anx-list"><div class="anx-empty sub">Carregando…</div></div></div>`);
  body.appendChild(wrap);
  const listEl=wrap.querySelector(".anx-list");
  async function refresh(){
    let rows;
    try{const{data,error}=await sb.from("anexos").select("id,nome,path,mime,tamanho,created_at").eq(anexCol(scope),id).order("created_at");if(error)throw error;rows=data||[];}
    catch(e){listEl.innerHTML=`<div class="anx-empty sub">${/relation|schema cache|does not exist|anexos/i.test(e.message)?"Anexos ainda não ativados — rode <b>scripts/anexos-financeiro.sql</b> no SQL Editor.":"Não deu pra carregar: "+esc(e.message)}</div>`;return;}
    if(!rows.length){listEl.innerHTML=`<div class="anx-empty sub">Nenhum anexo ainda.${podeEd?" Toque em <b>+ Anexar</b> pra subir um boleto ou comprovante.":""}</div>`;return;}
    listEl.innerHTML=rows.map(a=>`<div class="anx-item"><span class="anx-ic">${anexIcon(a.mime,a.nome)}</span><span class="anx-meta"><b>${esc(a.nome)}</b><small>${anexTam(a.tamanho)} · ${fmtDate((a.created_at||"").slice(0,10))}</small></span><span class="anx-acts"><button class="btn ghost sm" data-open="${esc(a.path)}">Abrir</button>${podeEd?`<button class="btn ghost sm anx-del" data-del="${a.id}" data-path="${esc(a.path)}" title="Remover">🗑</button>`:""}</span></div>`).join("");
    listEl.querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>anexAbrir(b.dataset.open));
    listEl.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>anexRemover(b.dataset.del,b.dataset.path,refresh));
  }
  const inp=wrap.querySelector(".anx-add input");
  if(inp)inp.onchange=async ev=>{const files=[...ev.target.files];ev.target.value="";for(const f of files)await anexUpload(f,scope,id,visao,listEl);refresh();};
  refresh();
}

async function anexUpload(file,scope,id,visao,listEl){
  if(file.size>15*1024*1024){toast(file.name+": passou de 15 MB");return;}
  const ext=(file.name.split(".").pop()||"bin").toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,8)||"bin";
  const path=`${visao}/${scope}/${id}/${uhash(file.name+"|"+file.size+"|"+id).slice(3)}_${Math.abs(Date.now()%1e7)}.${ext}`;
  let ph;if(listEl){ph=el(`<div class="anx-empty sub">⏳ Enviando ${esc(file.name)}…</div>`);listEl.prepend(ph);}
  try{
    const up=await sb.storage.from(ANEX_BUCKET).upload(path,file,{contentType:file.type||undefined,upsert:false});
    if(up.error)throw up.error;
    const ins=await sb.from("anexos").insert({visao,[anexCol(scope)]:id,nome:file.name,path,mime:file.type||null,tamanho:file.size});
    if(ins.error){try{await sb.storage.from(ANEX_BUCKET).remove([path]);}catch(_){}throw ins.error;}
    toast("Anexado: "+file.name);
  }catch(e){toast("Falha ao anexar: "+(/relation|schema cache|does not exist|bucket|not found/i.test(e.message)?"anexos ainda não ativados no banco":e.message));}
  finally{if(ph)ph.remove();}
}
async function anexAbrir(path){
  try{const{data,error}=await sb.storage.from(ANEX_BUCKET).createSignedUrl(path,300);if(error)throw error;window.open(data.signedUrl,"_blank","noopener");}
  catch(e){toast("Não abri: "+e.message);}
}
async function anexRemover(id,path,after){
  if(!confirm("Remover este anexo? (o arquivo é apagado do armazenamento)"))return;
  try{const d=await sb.from("anexos").delete().eq("id",id);if(d.error)throw d.error;try{await sb.storage.from(ANEX_BUCKET).remove([path]);}catch(_){}toast("Anexo removido");after&&after();}
  catch(e){toast("Não removi: "+e.message);}
}

/* =====================================================================
   INTEGRIDADE — Entidades (contatos/clientes) + Trilha de auditoria
   Cadastro único de contrapartes (Débora, Pedro França, MJM...) com ID
   próprio; movimentos/previstos apontam via entidade_id. Trilha = tabela
   audit_log preenchida por TRIGGER no banco (pega app, cron e SQL Editor).
   Tudo DORMENTE até rodar scripts/integridade-fase1.sql — a UI degrada
   com aviso, nunca quebra (mesmo padrão dos anexos).
   ===================================================================== */
let ENT_CACHE=null;
async function entLoad(force){
  if(MODE!=="live")return{rows:[],byId:new Map(),off:true};
  if(ENT_CACHE&&!force)return ENT_CACHE;
  try{
    const{data,error}=await sb.from("entidades").select("id,nome,tipo,visao,apelidos").eq("ativo",true).order("nome");
    if(error)throw error;
    ENT_CACHE={rows:data||[],byId:new Map((data||[]).map(e=>[e.id,e]))};
  }catch(e){ENT_CACHE={rows:[],byId:new Map(),off:true};}
  return ENT_CACHE;
}
const entOff=()=>!ENT_CACHE||ENT_CACHE.off;
const entNome=id=>{const e=ENT_CACHE&&ENT_CACHE.byId.get(id);return e?e.nome:"";};
/* sugestão: entidade cujo nome/apelido aparece na descrição */
function entMatch(desc){
  if(entOff()||!desc)return null;const d=String(desc).toLowerCase();
  return ENT_CACHE.rows.find(e=>[e.nome,...(e.apelidos||[])].some(n=>n&&n.length>2&&d.includes(n.toLowerCase())))||null;
}
async function entOf(tabela,id){
  if(entOff()||!id)return null;
  try{const{data,error}=await sb.from(tabela).select("entidade_id").eq("id",id).single();if(error)throw error;return(data&&data.entidade_id)||null;}
  catch(e){return null;}
}
/* injeta "Contato/Cliente" num modal já aberto; troca grava na hora */
async function entField(bg,tabela,id,desc){
  if(MODE!=="live"||!bg||!id)return;
  await entLoad();if(entOff())return;   /* SQL ainda não rodou: nem mostra */
  const body=bg.querySelector(".body");if(!body)return;
  const atual=await entOf(tabela,id),sug=!atual&&entMatch(desc);
  const opts=[`<option value="">—</option>`]
    .concat(ENT_CACHE.rows.map(e=>`<option value="${e.id}" ${e.id===atual?"selected":""}>${esc(e.nome)}</option>`))
    .concat([`<option value="__new">＋ Novo contato…</option>`]).join("");
  const w=el(`<div class="fld"><label>Contato/Cliente${sug?` <span class="link" data-sug>✨ usar "${esc(sug.nome)}"</span>`:""}</label><select>${opts}</select></div>`);
  body.appendChild(w);
  const sel=w.querySelector("select");
  const gravar=async v=>{try{await sbUpd(tabela,id,{entidade_id:v||null});toast(v?"Contato vinculado":"Contato removido");}catch(e){toast("Não vinculei: "+e.message);}};
  sel.onchange=async()=>{
    if(sel.value==="__new"){const nome=await entNova(desc);await entLoad(true);
      if(nome){const e=ENT_CACHE.rows.find(x=>x.nome===nome);sel.innerHTML=opts;if(e){sel.insertAdjacentHTML("afterbegin","");sel.value="";const o=document.createElement("option");o.value=e.id;o.textContent=e.nome;o.selected=true;sel.appendChild(o);await gravar(e.id);return;}}
      sel.value=atual||"";return;}
    await gravar(sel.value);
  };
  const s=w.querySelector("[data-sug]");if(s)s.onclick=async()=>{sel.value=sug.id;await gravar(sug.id);s.remove();};
}
function entNova(descSug){
  return new Promise(res=>{modal({title:"Novo contato/cliente",fields:[
    {name:"nome",label:"Nome"},
    {name:"tipo",label:"Tipo",type:"select",options:[{v:"pessoa",l:"Pessoa"},{v:"empresa",l:"Empresa"},{v:"orgao",l:"Órgão/Governo"}]},
    {name:"visao",label:"Visível em",type:"select",options:[{v:"AMBOS",l:"🌐 Todas as visões"},...PROFILES.map(p=>({v:p.code,l:p.icon+" "+p.label}))]},
    {name:"apelidos",label:"Apelidos p/ detecção (separar por vírgula)",placeholder:"ex.: Debora Tayna, D. Santos"},
    {name:"telefone",label:"Telefone"},{name:"email",label:"E-mail"}],
    saveLabel:"Criar",onSave:async v=>{
      if(!v.nome){toast("Nome obrigatório");return false;}
      try{await sbIns("entidades",{nome:v.nome.trim(),tipo:v.tipo||"pessoa",visao:v.visao||"AMBOS",apelidos:String(v.apelidos||"").split(",").map(s=>s.trim()).filter(Boolean),telefone:v.telefone||null,email:v.email||null});toast("Contato criado");res(v.nome.trim());}
      catch(e){toast(/relation|does not exist|schema cache/i.test(e.message)?"Entidades ainda não ativadas — rode scripts/integridade-fase1.sql":"Erro: "+e.message);return false;}
    }});});
}
async function entEditar(id){
  const e=ENT_CACHE&&ENT_CACHE.byId.get(id);if(!e)return;
  const full=await sb.from("entidades").select("*").eq("id",id).single();
  const v=full.data||e;
  modal({title:"Editar contato",fields:[
    {name:"nome",label:"Nome"},
    {name:"tipo",label:"Tipo",type:"select",options:[{v:"pessoa",l:"Pessoa"},{v:"empresa",l:"Empresa"},{v:"orgao",l:"Órgão/Governo"}]},
    {name:"visao",label:"Visível em",type:"select",options:[{v:"AMBOS",l:"🌐 Todas as visões"},...PROFILES.map(p=>({v:p.code,l:p.icon+" "+p.label}))]},
    {name:"apelidos",label:"Apelidos (vírgula)"},{name:"telefone",label:"Telefone"},{name:"email",label:"E-mail"},{name:"observacao",label:"Observação",type:"textarea"}],
    values:{...v,apelidos:(v.apelidos||[]).join(", ")},
    extraHTML:`<div style="display:flex;gap:8px;margin-top:4px"><button class="btn ghost sm" onclick="document.querySelectorAll('.modal-bg').forEach(b=>b.remove());audVer('entidades','${id}')">🧾 Histórico</button><button class="btn danger sm" onclick="entArquivar('${id}')">Arquivar</button></div>`,
    onSave:async o=>{
      await sbUpd("entidades",id,{nome:o.nome,tipo:o.tipo,visao:o.visao,apelidos:String(o.apelidos||"").split(",").map(s=>s.trim()).filter(Boolean),telefone:o.telefone||null,email:o.email||null,observacao:o.observacao||null});
      await entLoad(true);toast("Contato atualizado");if(CURRENT==="config")viewConfig();
    }});
}
async function entArquivar(id){
  if(!confirm("Arquivar este contato? (os vínculos existentes ficam)"))return;
  try{await sbUpd("entidades",id,{ativo:false});await entLoad(true);document.querySelectorAll(".modal-bg").forEach(b=>b.remove());toast("Contato arquivado");if(CURRENT==="config")viewConfig();}catch(e){toast(e.message);}
}

/* ---- trilha de auditoria (viewer) ---- */
const AUD_LBL={INSERT:["＋","criado","in"],UPDATE:["✎","alterado",""],DELETE:["✕","excluído","out"]};
function audFmtVal(v){if(v==null)return"—";if(typeof v==="object")return esc(JSON.stringify(v)).slice(0,80);const s=String(v);return esc(s.length>60?s.slice(0,57)+"…":s);}
async function audVer(tabela,registroId){
  if(MODE!=="live"){toast("Trilha só no modo live");return;}
  let rows;
  try{
    let q=sb.from("audit_log").select("id,tabela,registro_id,acao,visao,autor,antes,depois,campos,criado_em").order("criado_em",{ascending:false}).limit(80);
    if(tabela)q=q.eq("tabela",tabela);
    if(registroId)q=q.eq("registro_id",registroId);
    const{data,error}=await q;if(error)throw error;rows=data||[];
  }catch(e){
    modal({title:"🧾 Trilha de auditoria",extraHTML:`<div class="sub">${/relation|does not exist|schema cache/i.test(e.message)?"A trilha ainda não foi ativada — rode <b>scripts/integridade-fase1.sql</b> no SQL Editor (1x). A partir daí TODA alteração em movimentos, contas a pagar, contas, categorias e contatos fica registrada: quem mudou, quando e o quê.":"Erro: "+esc(e.message)}</div>`});
    return;
  }
  const linha=r=>{
    const[a,lbl,cls]=AUD_LBL[r.acao]||["?",r.acao,""];
    const quando=new Date(r.criado_em).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});
    const quem=r.autor==="sistema"?"🤖 sistema (sync)":esc(r.autor||"?");
    const alvo=(r.depois&&(r.depois.descricao||r.depois.descricao_original||r.depois.nome))||(r.antes&&(r.antes.descricao||r.antes.descricao_original||r.antes.nome))||"";
    const difs=(r.acao==="UPDATE"&&r.campos||[]).map(c=>`<div class="aud-dif"><span class="k">${esc(c)}</span> ${audFmtVal(r.antes&&r.antes[c])} <span class="seta">→</span> <b>${audFmtVal(r.depois&&r.depois[c])}</b></div>`).join("");
    return`<div class="aud-item"><div class="aud-top"><span class="aud-ic ${cls}">${a}</span><b>${esc(r.tabela)}</b> ${lbl} · <span class="sub" style="margin:0">${quando} · ${quem}</span></div>${alvo?`<div class="aud-alvo">${esc(alvo)}</div>`:""}${difs}</div>`;
  };
  modal({title:"🧾 Trilha de auditoria"+(registroId?" · este registro":tabela?" · "+tabela:""),
    extraHTML:`<div class="sub" style="margin-bottom:8px">${rows.length} evento(s) mais recentes${registroId?"":" · tudo que mudou no banco, por qualquer caminho (app, sync, SQL)"}</div><div class="aud-list">${rows.map(linha).join("")||'<div class="empty">Nenhum evento registrado ainda.</div>'}</div>`});
}

/* ✓ dar baixa — recorrente rola a série (não mata), pontual só muda o status */
async function fpPay(id){
  const r=(FP.dados&&FP.dados.rows||[]).find(x=>x.id===id);if(!r||fpPago(r))return;
  const p=fpProfile(r.visao);
  if(!podeEditar(r.visao)){toast("Você não pode editar a visão "+p.label);return;}
  if(MODE!=="live"){toast("Modo demo: a baixa não é gravada");return;}
  const kind=recKind(r.rec),und={id,visao:r.visao,inst:null,tpl:null,prevAnchor:null};
  try{
    if(kind){
      /* mesmo modelo do ✓ das Contas do mês: instância PAGA no dia + template rola */
      und.inst=await sbIns("previstos",{descricao:r.desc,valor:r.valor,vencimento:r.venc,tipo:"pagar",status:"pago",visao:r.visao,recorrencia:null,conta_id:r.conta_id,categoria_id:r.categoria_id,observacao:r.obs||null});
      const nx=stepRec(r.venc,kind,1);
      await sbUpd("previstos",r.id,{vencimento:nx});
      und.tpl=r.id;und.prevAnchor=r.venc;
      FP_UNDO[und.inst]=und;
      toast("Paga ✓ · próxima ocorrência em "+fmtDate(nx));
    }else{
      await sbUpd("previstos",r.id,{status:"pago"});
      FP_UNDO[r.id]={...und,simples:true};
      toast("Paga ✓");
    }
  }catch(e){toast("Erro: "+e.message);return;}
  await fpAfterWrite(r.visao);
}
/* ↩︎ desfazer (só o que foi baixado nesta sessão) */
async function fpUndo(id){
  const und=FP_UNDO[id];if(!und)return;
  try{
    if(und.simples){await sbUpd("previstos",id,{status:"aberto"});}
    else{await sbDel("previstos",und.inst);await sbUpd("previstos",und.tpl,{vencimento:und.prevAnchor});}
    delete FP_UNDO[id];toast("Desfeito — voltou pra aberto");
  }catch(e){toast("Erro: "+e.message);return;}
  await fpAfterWrite(und.visao);
}
/* recarrega o painel; se a linha era da visão aberta, recarrega o DB dela também */
async function fpAfterWrite(visao){
  FP.dados=null;
  if(VFILTER.indexOf(visao)>=0){try{DB=await loadData();}catch(e){}}
  viewFinanceiro();
}

const ROUTES={central:viewCentral,financeiro:viewFinanceiro,dashboard:viewDashboard,fluxo:viewFluxo,dre:viewDRE,orcamento:viewOrcamento,movimentos:viewMovimentos,contas:viewContas,pagar:viewPagar,receber:viewReceber,comissoes:viewComissoesLP,cartoes:viewCartoes,importar:viewImportar,config:viewConfig};
document.getElementById("nav").addEventListener("click",e=>{const a=e.target.closest("a");if(a&&!NAV_EDIT){route(a.dataset.route);closeDrawer();}});
/* cruzou o breakpoint mobile↔desktop (rotação/resize)? re-renderiza a view atual */
try{const _bp=window.matchMedia("(max-width:920px)");(_bp.addEventListener?_bp.addEventListener("change",()=>{if(DB)(ROUTES[CURRENT]||viewDashboard)();}):_bp.addListener(()=>{if(DB)(ROUTES[CURRENT]||viewDashboard)();}));}catch(e){}
/* ===== Drawer mobile (sidebar off-canvas) ===== */
function openDrawer(){document.getElementById("sideNav").classList.add("open");document.getElementById("sideOv").classList.add("show");}
function closeDrawer(){const s=document.getElementById("sideNav"),o=document.getElementById("sideOv");if(s)s.classList.remove("open");if(o)o.classList.remove("show");}
/* ---- bottom nav (mobile): atalhos + ＋ de lançamento rápido ---- */
(function(){
  const b=document.getElementById("bnav");if(!b)return;
  b.addEventListener("click",e=>{
    const a=e.target.closest("a");if(!a)return;
    if(a.dataset.bnav==="menu"){openDrawer();return;}
    if(a.dataset.route)route(a.dataset.route);
  });
  const f=document.getElementById("bnavFab");if(f)f.onclick=()=>quickAdd();
})();
function quickAdd(){
  const bg=el(`<div class="modal-bg sheet"><div class="modal qadd"><h3>O que você quer lançar?</h3><div class="qadd-grid">
    <button class="qa" data-a="mov"><span class="qi">↕</span><b>Lançamento</b><small>entrada, saída ou transferência</small></button>
    <button class="qa" data-a="pagar"><span class="qi">▣</span><b>Conta a pagar</b><small>compromisso com vencimento</small></button>
    <button class="qa" data-a="receber"><span class="qi">◳</span><b>A receber</b><small>previsão de entrada</small></button>
  </div><div class="foot"><button class="btn ghost" data-act="cancel">Cancelar</button></div></div></div>`);
  document.body.appendChild(bg);const close=()=>bg.remove();
  bg.addEventListener("click",e=>{if(e.target===bg)close();});bg.querySelector('[data-act=cancel]').onclick=close;
  bg.querySelectorAll(".qa").forEach(x=>x.onclick=()=>{close();({mov:()=>movimentoModal(),pagar:()=>addPagar(),receber:()=>addReceber()})[x.dataset.a]();});
}
(function(){const t=document.getElementById("navToggle"),o=document.getElementById("sideOv");if(t)t.onclick=openDrawer;if(o)o.onclick=closeDrawer;})();
/* ===== Seletor de perfil PJ ↔ PF ===== */
function profileUrls(){const root=new URL(CUR_PROFILE.path?"../":"./",location.href);const u={};PROFILES.forEach(p=>u[p.code]=new URL(p.path,root).href);return u;}
/* itens do menu de visões (usado pelo seletor do topo) */
/* o menu só oferece as visões que a pessoa pode ver (admin vê todas) */
function visaoMenuItems(){const vis=visoesVisiveis();return `<a data-code="__central" class="${VISAO==='ALL'?'cur':''}">◎ Todas as visões</a>`+["Negócios","Pessoal"].map(g=>{const arr=vis.filter(p=>p.grupo===g);return arr.length?`<div class="profile-grp">${g==='Pessoal'?'Vida':g}</div>`+arr.map(p=>`<a data-code="${p.code}" class="${p.code===VISAO?"cur":""}">${p.icon} ${esc(p.label)}</a>`).join(""):"";}).join("");}
/* aplica a escolha do menu (Central consolidada ou uma visão) */
function visaoPick(code){if(code==="__central"){if(VISAO==="ALL")route("dashboard");else setVisao("ALL");return;}if(code===VISAO){route("dashboard");return;}setVisao(code);}
/* SELETOR DE VISÃO no topo: mostra onde estou (visão ativa ou Central) e troca */
function renderTopSwitch(){
  const box=document.getElementById("vswBox");if(!box)return;
  const onCentral=CURRENT==="central";
  const icon=onCentral?"◎":(CUR_PROFILE.icon||"●");
  const label=onCentral?"Todas as visões":VISAO_LABEL;
  const sub=onCentral?"Central consolidada":(CUR_PROFILE.grupo==="Pessoal"?"Vida":CUR_PROFILE.grupo);
  box.innerHTML=`<div class="vsw-chip" id="vswChip" title="Trocar visão"><span class="vsw-ic">${icon}</span><div class="vsw-tx"><div class="vsw-cur">${esc(label)}</div><div class="vsw-sub">${esc(sub)}</div></div><span class="vsw-caret">▾</span></div><div class="vsw-menu" id="vswMenu">${visaoMenuItems()}</div>`;
  const chip=box.querySelector("#vswChip"),menu=box.querySelector("#vswMenu");
  chip.onclick=e=>{e.stopPropagation();menu.classList.toggle("open");};
  menu.querySelectorAll("a").forEach(a=>a.onclick=()=>{menu.classList.remove("open");visaoPick(a.dataset.code);});
  const mt=document.querySelector(".mtop-brand");if(mt)mt.textContent=label;
}
/* chip de conta no rodapé (identidade + acesso a senha/sair); a troca de visão vive no topo */
function renderProfile(email){const pb=document.getElementById("profileBox");if(!pb)return;pb.style.display="block";pb.dataset.email=email||"";
  const ini=((email||VISAO_LABEL||"?").trim()[0]||"?").toUpperCase();
  pb.innerHTML=`<div class="profile-chip" style="cursor:default"><div class="av">${esc(ini)}</div><div style="min-width:0"><div class="pn">${esc(VISAO_LABEL)}</div><div class="ps" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(email||"conta conectada")}</div></div></div>`;
}
/* fecha os menus abertos ao clicar fora — registrado uma vez */
document.addEventListener("click",()=>{document.querySelectorAll(".vsw-menu.open,.profile-menu.open").forEach(m=>m.classList.remove("open"));});
/* ===== PWA: service worker + aviso de atualização ===== */
(function(){
  if(!("serviceWorker" in navigator))return;
  const banner=document.getElementById("updBanner"),btn=document.getElementById("updBtn");
  const showUpd=sw=>{banner.classList.add("show");btn.onclick=()=>{btn.textContent="Atualizando…";if(sw)sw.postMessage({type:"SKIP_WAITING"});};};
  let reloaded=false;
  navigator.serviceWorker.addEventListener("controllerchange",()=>{if(reloaded)return;reloaded=true;location.reload();});
  window.addEventListener("load",async()=>{
    try{
      const reg=await navigator.serviceWorker.register("sw.js");
      if(reg.waiting)showUpd(reg.waiting);                 // já tem versão nova esperando
      reg.addEventListener("updatefound",()=>{             // chegou versão nova agora
        const nw=reg.installing;
        nw&&nw.addEventListener("statechange",()=>{if(nw.state==="installed"&&navigator.serviceWorker.controller)showUpd(reg.waiting||nw);});
      });
      setInterval(()=>reg.update(),60*60*1000);            // checa atualização de hora em hora
    }catch(e){}
  });
})();

/* ===== Botão manual "Atualizar app" — força buscar a versão mais nova ===== */
async function checarAtualizacao(){
  toast("Procurando atualização…");
  try{
    if("serviceWorker" in navigator){
      const reg=await navigator.serviceWorker.getRegistration();
      if(reg){ await reg.update(); if(reg.waiting){ reg.waiting.postMessage({type:"SKIP_WAITING"}); return; } } // SW novo → controllerchange recarrega
    }
  }catch(e){}
  try{ if(window.caches){ const ks=await caches.keys(); await Promise.all(ks.map(k=>caches.delete(k))); } }catch(e){} // sem SW esperando → limpa cache e recarrega fresco
  location.reload();
}
(function(){const b=document.getElementById("forceUpd");if(b)b.onclick=checarAtualizacao;})();

/* ===== Auth gate ===== */
const gate=document.getElementById("gate");
const showGate=()=>{gate.classList.add("show");document.getElementById("logoutBtn").style.display="none";};
const hideGate=()=>gate.classList.remove("show");

let _booted=false;
async function bootApp(){
  document.getElementById("verTag").textContent="v"+(window.APP_VERSION||"3.0");
  syncChrome();   /* marca, DRE, env, perfil da visão ativa */
  if(MODE==="live"){document.getElementById("logoutBtn").style.display="block";document.getElementById("pwBtn").style.display="block";
    try{const{data}=await sb.auth.getSession();renderProfile(data&&data.session&&data.session.user&&data.session.user.email);}catch(e){renderProfile();}}
  if(_booted)return;_booted=true;
  try{const d=new Date();PERIOD.ano=d.getFullYear();PERIOD.mes=d.getMonth()+1;PERIOD.mode="mes";
    await loadPerm();
    if(!PERM.legacy&&!PERM.admin&&!visoesVisiveis().length){
      document.getElementById("view").innerHTML=`<div class="panel"><h2>Acesso ainda não liberado</h2><div class="sub">Sua conta (<b>${esc(PERM.email)}</b>) entrou, mas ainda não tem nenhuma visão liberada. Peça pro Gustavo marcar em <b>Configurações › Acessos</b>.</div></div>`;
      return;}
    /* caiu numa visão que essa pessoa não pode ver → manda pra primeira liberada */
    if(!podeVer(VISAO)){const primeira=visoesVisiveis()[0];if(primeira)applyVisao(primeira.code);}
    if(PERM.admin){try{await acessosLoad();}catch(e){}}
    DB=await loadData();
    try{await faturaAutoRun();}catch(e){}   /* fatura que fechou vira conta a pagar (1x/dia por visão) */
    try{CENTRAL=await loadCentral();}catch(e){CENTRAL=_finalizeCentral(_emptyPer());}
    route("central");}   /* app único: entra pela Central consolidada */
  catch(e){document.getElementById("view").innerHTML=`<div class="panel"><h2>Erro ao carregar</h2><div class="sub">${esc(e.message)}</div></div>`;}
}

let SIGNUP=false;  // false=entrar, true=primeiro acesso (criar senha)
const gErr=document.getElementById("gErr"),gBtn=document.getElementById("gBtn"),gToggle=document.getElementById("gToggle");
function setMode(su){
  SIGNUP=su;gErr.textContent="";gErr.classList.remove("gate-ok");
  gBtn.textContent=su?"Criar senha e entrar":"Entrar";
  document.getElementById("gPass").setAttribute("autocomplete",su?"new-password":"current-password");
  gToggle.innerHTML=su?`Já tenho senha? <span>Entrar</span>`:`Primeiro acesso? <span>Criar minha senha</span>`;
}
gToggle.querySelector("span")&&gToggle.addEventListener("click",e=>{if(e.target.tagName==="SPAN")setMode(!SIGNUP);});

document.getElementById("gateForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const email=document.getElementById("gEmail").value.trim(),pass=document.getElementById("gPass").value;
  gErr.textContent="";gErr.classList.remove("gate-ok");gBtn.disabled=true;gBtn.textContent=SIGNUP?"Criando…":"Entrando…";
  try{
    if(SIGNUP){
      if(pass.length<6)throw new Error("A senha precisa de pelo menos 6 caracteres.");
      const{data,error}=await sb.auth.signUp({email,password:pass});
      if(error)throw error;
      if(data&&data.session){hideGate();await bootApp();}          // autoconfirm ON → entra direto
      else{gErr.classList.add("gate-ok");gErr.textContent="Conta criada! Confirme pelo link no seu e-mail e depois entre.";setMode(false);}
    }else{
      const{error}=await sb.auth.signInWithPassword({email,password:pass});
      if(error)throw error;
      hideGate();await bootApp();
    }
  }catch(ex){
    const m=ex.message||"";
    gErr.textContent=/already registered|already exists/i.test(m)?"Essa conta já existe — use Entrar.":
                     /invalid|credentials/i.test(m)?"E-mail ou senha incorretos.":m;
  }finally{gBtn.disabled=false;setMode(SIGNUP);}
});

/* Login com Google (OAuth). Requer o provider Google habilitado no painel do Supabase.
   Volta pra MESMA URL (preserva a visão PJ/Família). Email+senha continua funcionando em paralelo. */
{const gg=document.getElementById("gGoogle");if(gg)gg.addEventListener("click",async()=>{
  gErr.textContent="";gErr.classList.remove("gate-ok");gg.disabled=true;
  try{const{error}=await sb.auth.signInWithOAuth({provider:"google",options:{redirectTo:location.href.split("#")[0]}});if(error)throw error;}
  catch(ex){gErr.textContent="Google: "+(ex.message||ex);gg.disabled=false;}
});}

document.getElementById("logoutBtn").addEventListener("click",async()=>{try{await sb.auth.signOut();}catch(e){}location.reload();});
document.getElementById("pwBtn").addEventListener("click",()=>{
  modal({title:"Alterar senha",fields:[{name:"p1",label:"Nova senha (mín. 6)",type:"password"},{name:"p2",label:"Repita a nova senha",type:"password"}],saveLabel:"Salvar",onSave:async v=>{
    if(!v.p1||v.p1.length<6){toast("Senha muito curta");return false;}
    if(v.p1!==v.p2){toast("As senhas não batem");return false;}
    const{error}=await sb.auth.updateUser({password:v.p1});
    if(error){toast("Erro: "+error.message);return false;}
    toast("Senha atualizada ✓");
  }});
});

(async function init(){
  if(MODE!=="live"){await bootApp();return;}          // demo: sem login
  const{data}=await sb.auth.getSession();
  if(data&&data.session){await bootApp();}             // sessão salva → entra direto
  else{showGate();}                                    // senão → tela de login
})();

/* ===== Guard-rail de regressão (silencioso quando saudável) =====
   Roda no boot; só loga erro se um invariante quebrar. Protege contra
   o bug de fuso voltar (data YYYY-MM-DD NUNCA pode virar o dia anterior). */
(function selfCheck(){try{const f=[];
  if(fmtDate("2026-05-30")!=="30/05/2026")f.push("fmtDate (off-by-one de fuso?)");
  if(!/^\d{4}-\d{2}-\d{2}$/.test(todayISO()))f.push("todayISO (formato)");
  if(parseAmount("R$ 1.234,56")!==1234.56)f.push("parseAmount");
  if(parseAmount("-50,00")!==-50)f.push("parseAmount negativo");
  if(uhash("abc")!==uhash("abc"))f.push("uhash não-determinístico");
  if(ocorrencias("2026-08-03","mensal","2026-07-01","2026-07-31").length)f.push("ocorrencias RETROATIVA (série antes da âncora — bug da mensalidade jul→ago)");
  if((ocorrencias("2026-06-05","mensal","2026-07-01","2026-07-31")[0]||"")!=="2026-07-05")f.push("ocorrencias forward (projeção mensal)");
  if(!isInterno({sentido:"Entrada",_cartao:true,banco:"Cartao Teste",categoria:"",descricao:"PAGAMENTO ON LINE"}))f.push("pagamento de fatura no cartão contando como RECEITA (bug ago/26)");
  if(isInterno({sentido:"Saída",_cartao:true,banco:"Cartao Teste",categoria:"",descricao:"IFOOD"}))f.push("compra de cartão marcada como interna (some do gasto)");
  if(!isPrevFatura({descricao:"Fatura Cartao Inter PF 09/2026",obs:""}))f.push("previsto de fatura não reconhecido (dupla contagem em saídas previstas)");
  if(isPrevFatura({descricao:"Faturamento cliente X",obs:""}))f.push("isPrevFatura pegando não-fatura");
  if(!isInterno({sentido:"Saída",banco:"Inter PF",categoria:"Pagamento de fatura",descricao:"qualquer"}))f.push("categoria 'Pagamento de fatura' não é interna");
  if(!isInterVisao({descricao:"Transferência Recebida|OUTLIERS"}))f.push("transferência inter-visão truncada pelo feed não netada (receita fantasma no consolidado)");
  if(!isInterVisao({descricao:"Pix enviado  — Gustavo Melo Juca"}))f.push("saída inter-visão não netada");
  if(isInterVisao({descricao:"Pix recebido de MARIA BETANIA ALMEIDA"}))f.push("isInterVisao pegando terceiro (esconderia receita real)");
  {const _c=[{apolice:"A",acordo:true,no_fluxo:true},{apolice:"B",acordo:true,no_fluxo:false}];
   if(_c.filter(x=>x.acordo&&x.no_fluxo).length!==1)f.push("previsão LP projetando sobre o acordo em vez do fluxo (infla a receita do Pipe X)");}
  if(f.length)console.error("⚠ Central Financeira — self-check FALHOU:",f.join(" · "));
}catch(e){console.error("⚠ self-check erro:",e.message);}})();
