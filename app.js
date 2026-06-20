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
    <div class="ver" id="verTag">v2.0</div>
    <nav class="nav" id="nav">
      <a data-route="dashboard" class="active"><span class="ico">▦</span> Visão Geral</a>
      <a data-route="fluxo"><span class="ico">📈</span> Fluxo de Caixa</a>
      <a data-route="dre" id="navDre"><span class="ico">📊</span> DRE</a>
      <a data-route="orcamento"><span class="ico">🎯</span> Orçamento</a>
      <div class="grp">Lançamentos</div>
      <a data-route="movimentos"><span class="ico">↕</span> Movimentos</a>
      <a data-route="pagar"><span class="ico">▣</span> Contas a Pagar</a>
      <a data-route="receber"><span class="ico">◳</span> A Receber</a>
      <a data-route="cartoes"><span class="ico">▭</span> Cartões</a>
      <a data-route="importar"><span class="ico">⭱</span> Importar</a>
      <div class="grp">Sistema</div>
      <a data-route="config"><span class="ico">⚙</span> Configurações</a>
    </nav>
    <div class="spacer"></div>
    <div class="env" id="envBox"></div>
    <div class="profile" id="profileBox" style="display:none"></div>
    <div class="logout" id="pwBtn" style="display:none">🔑 Alterar senha</div>
    <div class="logout" id="logoutBtn" style="display:none">Sair</div>
  </aside>
  <main class="main" id="view"></main>
</div>
<div class="toast" id="toast"></div>
<div class="upd" id="updBanner">
  <span>🔄 Nova versão disponível</span>
  <button id="updBtn">Atualizar agora</button>
</div>
`;
document.body.insertAdjacentHTML("afterbegin", SHELL_HTML);

/* ---------- camada de dados (Supabase + DEMO) ---------- */
/* =====================================================================
   DADOS — Supabase (anon) + DEMO. v2.0
   ===================================================================== */
const HAS_KEY=!!(window.CONFIG&&window.CONFIG.SUPABASE_ANON_KEY);
const sb=HAS_KEY?supabase.createClient(CONFIG.SUPABASE_URL,CONFIG.SUPABASE_ANON_KEY):null;
const MODE=HAS_KEY?"live":"demo";
const VISAO=(window.CONFIG&&window.CONFIG.VISAO)||"PJ";   // escopo deste app
const VISAO_LABEL=({PJ:"PJ",PF:"Pessoa Física",FAMILIA:"Família"})[VISAO]||VISAO;
try{document.title="Central Financeira "+VISAO_LABEL;}catch(e){}
const VFILTER=[VISAO,"AMBOS"];                            // o que este app enxerga
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

const INTERNO_CAT_RX=/transfer[eê]ncia|saldo inicial|aplica[cç][aã]o|investiment|resgate|pagamento fatura/i;
const INTERNO_DESC_RX=/\b(aplica[cç][aã]o|resgate|pagamento\s+fatura|fatura\s+cart[aã]o|transfer[eê]ncia\s+interna|transf\s+entre\s+contas)\b/i;
const isInterno=m=>INTERNO_CAT_RX.test(m.categoria||"")||INTERNO_DESC_RX.test(m.descricao||"");

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

/* orçamento (localStorage; persistência server entra com tabela orcamentos depois) */
const ORC_KEY="cfin_orc_v1";
function loadOrc(){try{return JSON.parse(localStorage.getItem(ORC_KEY)||"{}");}catch(e){return{};}}
function saveOrc(o){try{localStorage.setItem(ORC_KEY,JSON.stringify(o));}catch(e){}}

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
  const [contas,cats,mv,ct,pv,rg,gl]=await Promise.all([
    sb.from("contas").select("id,nome,banco,tipo,ativo,visao").in("visao",VFILTER),
    sb.from("categorias").select("*").in("visao",VFILTER),
    sb.from("movimentos").select("id,data,descricao_original,descricao_limpa,valor,sinal,conta_id,categoria_id").in("visao",VFILTER).order("data",{ascending:false}).limit(20000),
    sb.from("cartao_transacoes").select("id,data_compra,data_fatura,descricao,valor,cartao_id,categoria_id").in("visao",VFILTER).order("data_compra",{ascending:false}).limit(20000),
    sb.from("previstos").select("id,descricao,valor,vencimento,tipo,status,conta_id,categoria_id,recorrencia").in("visao",VFILTER).order("vencimento").limit(20000),
    sb.from("regras_classificacao").select("padrao,peso,categoria_id,ativo").limit(5000),
    sb.from("glossario_termos").select("termo,categoria_sugerida_id").in("visao",VFILTER).limit(5000)]);
  for(const r of[contas,cats,mv,ct,pv])if(r.error)throw new Error(r.error.message);
  const cb=new Map(contas.data.map(c=>[c.id,c])),kb=new Map(cats.data.map(c=>[c.id,c])),nameOf=id=>kb.get(id)?.nome||"";
  const movimentos=mv.data.map(r=>({_row:r.id,data:(r.data||"").slice(0,10),descricao:r.descricao_limpa||r.descricao_original||"",banco:cb.get(r.conta_id)?.nome||"",valor:Number(r.valor||0),sentido:r.sinal===1?"Entrada":"Saída",categoria:nameOf(r.categoria_id),mes:r.data?+r.data.slice(5,7):null,ano:r.data?+r.data.slice(0,4):null}));
  const cartoes=ct.data.map(r=>({_row:r.id,data:(r.data_compra||"").slice(0,10),descricao:r.descricao||"",cartao:cb.get(r.cartao_id)?.nome||"",valor:Number(r.valor||0),subcategoria:nameOf(r.categoria_id),mesFatura:(r.data_fatura||"").slice(5,7)+"/"+(r.data_fatura||"").slice(0,4)}));
  const contasPagar=pv.data.filter(p=>p.tipo==="pagar").map(p=>({_row:p.id,descricao:p.descricao,vencimento:(p.vencimento||"").slice(0,10),valor:Number(p.valor||0),categoria:nameOf(p.categoria_id),banco:cb.get(p.conta_id)?.nome||"",status:p.status,recorrencia:p.recorrencia||""}));
  const aReceber=pv.data.filter(p=>p.tipo==="receber").map(p=>({_row:p.id,linha:p.descricao,dataPrevista:(p.vencimento||"").slice(0,10),previstoLiquido:Number(p.valor||0),status:p.status,conta:cb.get(p.conta_id)?.nome||"",recorrencia:p.recorrencia||""}));
  const regras=((rg&&rg.data)||[]).filter(r=>r.ativo!==false&&r.categoria_id).map(r=>({padrao:r.padrao,peso:r.peso||1,cat:nameOf(r.categoria_id)}));
  const glossario=((gl&&gl.data)||[]).filter(g=>g.categoria_sugerida_id).map(g=>({termo:g.termo,cat:nameOf(g.categoria_sugerida_id)}));
  return{movimentos,contasPagar,aReceber,cartoes,categorias:cats.data,contas:contas.data,regras,glossario};
}
async function sbIns(t,p){const{data,error}=await sb.from(t).insert(p).select("id").single();if(error)throw new Error(error.message);return data.id;}
async function sbUpd(t,id,p){const{error}=await sb.from(t).update(p).eq("id",id);if(error)throw new Error(error.message);}
async function sbDel(t,id){const{error}=await sb.from(t).delete().eq("id",id);if(error)throw new Error(error.message);}

/* ---------- parsers + UI + router + init ---------- */
/* ===== Parsers ===== */
function parseAmount(s){if(s==null)return NaN;if(typeof s==="number")return s;let t=String(s).trim().replace(/R\$|\s/g,"");const neg=/^-/.test(t)||/\(.*\)/.test(t)||/D$/i.test(t);t=t.replace(/^[-+]/,"").replace(/[()CD]/gi,"");if(/,/.test(t)&&/\./.test(t))t=t.replace(/\./g,"").replace(",",".");else if(/,/.test(t))t=t.replace(",",".");const n=parseFloat(t);return isNaN(n)?NaN:(neg?-n:n);}
function normDate(s){const t=(s||"").trim();let m=t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);if(m)return`${m[1]}-${m[2].padStart(2,"0")}-${m[3].padStart(2,"0")}`;m=t.match(/^(\d{4})(\d{2})(\d{2})/);if(m)return`${m[1]}-${m[2]}-${m[3]}`;m=t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);if(m){let y=m[3];if(y.length===2)y=(+y>50?"19":"20")+y;return`${y}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;}return"";}
function parseOFX(text){const out=[];const re=/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;let m;while(m=re.exec(text)){const blk=m[1];const g=t=>{const r=new RegExp(`<${t}>([^<\\r\\n]*)`,"i").exec(blk);return r?r[1].trim():"";};const dt=normDate(g("DTPOSTED").slice(0,8));const amt=parseAmount(g("TRNAMT"));if(!dt||isNaN(amt))continue;out.push({date:dt,description:g("MEMO")||g("NAME")||"",amount:Math.abs(amt),sign:amt<0?"Saída":"Entrada"});}return out;}
function parseCSV(text){const lines=text.split(/\r?\n/).filter(l=>l.trim());if(!lines.length)return[];const sep=[";",",","\t"].map(s=>[s,lines[0].split(s).length]).sort((a,b)=>b[1]-a[1])[0][0];const rows=lines.map(l=>l.split(sep).map(c=>c.trim()));let hi=-1;for(let i=0;i<Math.min(8,rows.length);i++){const c=rows[i].join("|").toLowerCase();if(/data|date/.test(c)&&/valor|amount|vlr/.test(c)){hi=i;break;}}const header=(hi>=0?rows[hi]:["data","descricao","valor"]).map(h=>h.toLowerCase());const data=hi>=0?rows.slice(hi+1):rows;const col=rx=>header.findIndex(h=>rx.test(h));const di=Math.max(col(/data|date/),0),vi=col(/valor|amount|vlr/),ddi=Math.max(col(/desc|histor|memo|estabele/),1);const out=[];for(const r of data){if(!r||r.every(c=>!c))continue;const dt=normDate(r[di]||"");const amt=parseAmount(vi>=0?r[vi]:r[2]);if(!dt||isNaN(amt)||amt===0)continue;out.push({date:dt,description:r[ddi]||"",amount:Math.abs(amt),sign:amt<0?"Saída":"Entrada"});}return out;}
function detectCompensatio(t){return/extrato\s+consolidado\s+de\s+comiss[ãa]o/i.test(t)||(/master\s+franqueado/i.test(t)&&/compensatio/i.test(t));}
function parseCompensatio(text){const out=[];const rx=/(FYC|Renova[çc][ãa]o|Override|Porte|Transfer[êe]ncia|Recapture)/i;const vrx=/(-?\(?\s*(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}\)?)\s*$/;for(const ln of text.split(/\n/)){if(/Comiss[ãa]o\s+Bruta|Vr\.?\s*Bruto\s+a\s+Receber/i.test(ln))continue;const mr=ln.match(rx),mv=ln.match(vrx);if(mr&&mv){const v=parseAmount(mv[1]);const ded=/\b(desc\.?|estorno)\b/i.test(ln);out.push({date:todayISO().slice(0,8)+"30",description:mr[0]+" — Compensatio MFB",amount:Math.abs(v),sign:ded?"Saída":"Entrada"});}}return out;}
function parseByType(text,tipo){if(tipo==="compensatio"||(tipo==="auto"&&detectCompensatio(text)))return{kind:"compensatio",txs:parseCompensatio(text)};if(tipo==="ofx"||(tipo==="auto"&&/<STMTTRN|<OFX/i.test(text)))return{kind:"ofx",txs:parseOFX(text)};return{kind:tipo==="fatura"?"fatura":"csv",txs:parseCSV(text)};}

/* ===== Modal + helpers ===== */
const $=s=>document.querySelector(s);
const el=h=>{const d=document.createElement("div");d.innerHTML=h.trim();return d.firstElementChild;};
const bancoOpts=()=>[...new Set([...(DB.contas||[]).filter(c=>c.ativo!==false).map(c=>c.nome),...DB.movimentos.map(m=>m.banco)].filter(Boolean))];
const cartaoOpts=()=>[...new Set([...(DB.contas||[]).filter(c=>/cart/i.test(c.nome)||c.tipo==="cartao").map(c=>c.nome),...DB.cartoes.map(c=>c.cartao)].filter(Boolean))];
function catOptsByTipo(tipo){const out=[""];DB.categorias.filter(c=>!c.parent_id&&(!tipo||c.tipo===tipo)).forEach(p=>{out.push(p.nome);DB.categorias.filter(s=>s.parent_id===p.id).forEach(s=>out.push(p.nome+" › "+s.nome));});out.push("__new");return out;}
const catOpts=()=>catOptsByTipo("").filter(o=>o!=="__new");
/* grupos por tipo p/ optgroup (subcategorias aninhadas sob o pai) */
function catGroupsByTipo(tipo){const tops=DB.categorias.filter(c=>!c.parent_id&&(!tipo||c.tipo===tipo));const withSubs=[],gerais=[];tops.forEach(p=>{const subs=DB.categorias.filter(s=>s.parent_id===p.id);if(subs.length)withSubs.push({parent:p.nome,items:[p.nome,...subs.map(s=>p.nome+" › "+s.nome)]});else gerais.push(p.nome);});return{withSubs,gerais};}
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
async function afterWrite(){ if(MODE==="live"){ try{DB=await loadData();}catch(e){toast("Reload: "+e.message);} } SEL.clear(); (ROUTES[CURRENT]||viewDashboard)(); }

/* ===== período ===== */
const yearsList=()=>[...new Set((DB.movimentos||[]).map(m=>m.ano).filter(Boolean))].sort((a,b)=>b-a);
let PERIOD={mode:"ano",ano:null,mes:null,de:"",ate:""};
function inPeriod(m){if(PERIOD.mode==="ano")return m.ano===PERIOD.ano;if(PERIOD.mode==="mes")return m.ano===PERIOD.ano&&m.mes===PERIOD.mes;if(PERIOD.mode==="range")return(!PERIOD.de||m.data>=PERIOD.de)&&(!PERIOD.ate||m.data<=PERIOD.ate);return true;}
function periodLabel(){if(PERIOD.mode==="ano")return"ano "+PERIOD.ano;if(PERIOD.mode==="mes")return ML[PERIOD.mes-1]+"/"+PERIOD.ano;return(PERIOD.de?fmtDate(PERIOD.de):"início")+" → "+(PERIOD.ate?fmtDate(PERIOD.ate):"hoje");}

let DB=null,CURRENT="dashboard",SEL=new Set();
function route(name){if(name==="dre"&&VISAO!=="PJ")name="dashboard";CURRENT=name;SEL.clear();document.querySelectorAll("#nav a").forEach(a=>a.classList.toggle("active",a.dataset.route===name));(ROUTES[name]||viewDashboard)();}
function kpis(){const reais=DB.movimentos.filter(m=>inPeriod(m)&&!isInterno(m));const ent=reais.filter(m=>m.sentido==="Entrada").reduce((s,m)=>s+m.valor,0);const sai=reais.filter(m=>m.sentido==="Saída").reduce((s,m)=>s+m.valor,0);const aPagar=DB.contasPagar.filter(c=>(c.status||"").toLowerCase()==="aberto").reduce((s,c)=>s+c.valor,0);const aReceber=DB.aReceber.filter(a=>(a.status||"").toLowerCase()!=="recebido").reduce((s,a)=>s+a.previstoLiquido,0);return{ent,sai,saldo:ent-sai,aPagar,aReceber,proj:(ent-sai)+aReceber-aPagar};}

/* ===== Lançamento (modal pro: tipo, transferência, categoria por tipo, criar no fluxo) ===== */
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
      <div class="fld"><label>Conta origem</label><select id="f_orig">${banco.map(b=>`<option>${esc(b)}</option>`).join("")}</select></div>
      <div class="fld"><label>Conta destino</label><select id="f_dest">${banco.map((b,i)=>`<option ${i===1?"selected":""}>${esc(b)}</option>`).join("")}</select></div>
      <div class="sub">Não afeta resultado: cria saída na origem + entrada no destino, marcadas como internas.</div>
    </div>
  </div><div class="foot">${isEdit?`<button class="btn danger" id="del" style="margin-right:auto">Excluir</button>`:""}<button class="btn ghost" id="cancel">Cancelar</button><button class="btn" id="save">Salvar</button></div></div></div>`);
  document.body.appendChild(bg); const close=()=>bg.remove();
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
function promptCat(tipo){return new Promise(res=>{modal({title:"Nova categoria ("+(tipo==="entrada"?"entrada":"saída")+")",fields:[{name:"nome",label:"Nome"}],saveLabel:"Criar",onSave:async v=>{if(!v.nome){toast("Nome");return false;}let id="cat"+Date.now();if(MODE==="live")id=await sbIns("categorias",{nome:v.nome,tipo:tipo,visao:"AMBOS"});DB.categorias.push({id,nome:v.nome,tipo:tipo,parent_id:null});toast("Categoria criada");res(v.nome);}});});}
async function lancarMov(o){const row={_row:"d"+Date.now()+Math.random().toString(36).slice(2,5),data:o.data,descricao:o.descricao,valor:o.valor,sentido:o.sentido,banco:o.banco,categoria:o.categoria,mes:+o.data.slice(5,7),ano:+o.data.slice(0,4)};if(MODE==="live")row._row=await sbIns("movimentos",{data:o.data,descricao_original:o.descricao,descricao_limpa:o.descricao,valor:o.valor,sinal:o.sentido==="Entrada"?1:-1,conta_id:contaId(o.banco),categoria_id:catId(o.categoria),visao:VISAO,hash:uhash(o.descricao+o.data+o.valor)});DB.movimentos.unshift(row);}
async function editMovSave(row,o){const m=DB.movimentos.find(x=>x._row===row);if(MODE==="live")await sbUpd("movimentos",row,{data:o.data,descricao_original:o.descricao,descricao_limpa:o.descricao,valor:o.valor,sinal:o.sentido==="Entrada"?1:-1,conta_id:contaId(o.banco),categoria_id:catId(o.categoria)});if(m)Object.assign(m,{...o,mes:+o.data.slice(5,7),ano:+o.data.slice(0,4)});}
function editMovimento(row){const m=DB.movimentos.find(x=>x._row===row);if(m)movimentoModal(m);}
function addMovimento(){movimentoModal(null);}
async function delMovimento(row){if(MODE==="live"){try{await sbDel("movimentos",row);}catch(e){toast("Erro: "+e.message);return;}}DB.movimentos=DB.movimentos.filter(x=>x._row!==row);toast("Excluído");await afterWrite();}

/* ===== Dashboard ===== */
function periodControls(){let inner="";if(PERIOD.mode==="ano")inner=`<select id="pAno">${yearsList().map(y=>`<option ${y===PERIOD.ano?"selected":""}>${y}</option>`).join("")}</select>`;else if(PERIOD.mode==="mes")inner=`<select id="pAno">${yearsList().map(y=>`<option ${y===PERIOD.ano?"selected":""}>${y}</option>`).join("")}</select><select id="pMes">${ML.map((n,i)=>`<option value="${i+1}" ${i+1===PERIOD.mes?"selected":""}>${n}</option>`).join("")}</select>`;else inner=`<input id="pDe" type="date" value="${PERIOD.de}"> <span class="sub">até</span> <input id="pAte" type="date" value="${PERIOD.ate}">`;
  return`<div class="controls"><select id="pMode"><option value="ano" ${PERIOD.mode==="ano"?"selected":""}>Por ano</option><option value="mes" ${PERIOD.mode==="mes"?"selected":""}>Por mês</option><option value="range" ${PERIOD.mode==="range"?"selected":""}>Período</option></select>${inner}</div>`;}
function wirePeriod(){$("#pMode").onchange=e=>{PERIOD.mode=e.target.value;if(PERIOD.mode==="mes"&&!PERIOD.mes)PERIOD.mes=new Date().getMonth()+1;viewDashboard();};if($("#pAno"))$("#pAno").onchange=e=>{PERIOD.ano=+e.target.value;viewDashboard();};if($("#pMes"))$("#pMes").onchange=e=>{PERIOD.mes=+e.target.value;viewDashboard();};if($("#pDe"))$("#pDe").onchange=e=>{PERIOD.de=e.target.value;viewDashboard();};if($("#pAte"))$("#pAte").onchange=e=>{PERIOD.ate=e.target.value;viewDashboard();};}
let _charts=[];
function contaSaldos(){const b=new Map();(DB.contas||[]).forEach(c=>b.set(c.nome,0));DB.movimentos.forEach(m=>{const n=m.banco||"(sem conta)";b.set(n,(b.get(n)||0)+(m.sentido==="Entrada"?m.valor:-m.valor));});return b;}
function saldoCard(){const b=contaSaldos();let tot=0;
  const items=[...b.entries()].filter(([n,v])=>v!==0||n!=="(sem conta)").sort((a,b)=>b[1]-a[1]).map(([n,v])=>{tot+=v;const card=/cart/i.test(n);return`<div style="flex:1;min-width:150px;background:var(--card,#fff);border:1px solid var(--bd,#e5e7eb);border-radius:10px;padding:10px 12px"><div class="sub" style="font-size:11px">${card?'💳 ':'🏦 '}${esc(n)}</div><div class="${v>=0?'in':'out'}" style="font-size:17px;font-weight:600">${fmtBRL(v)}</div></div>`;}).join("");
  return`<div class="panel"><h2>Saldos por conta</h2><div style="display:flex;flex-wrap:wrap;gap:10px">${items}<div style="flex:1;min-width:150px;background:#0f172a;color:#fff;border-radius:10px;padding:10px 12px"><div style="font-size:11px;opacity:.8">💰 TOTAL GERAL</div><div style="font-size:17px;font-weight:700">${fmtBRL(tot)}</div></div></div></div>`;}
function viewDashboard(){const k=kpis();
  $("#view").innerHTML=`<div class="row"><div><h1>Visão Geral</h1><div class="sub">Painel financeiro — ${periodLabel()}</div></div><button class="btn" onclick="addMovimento()">+ Lançar</button></div>${periodControls()}
  <div class="kpis"><div class="kpi"><div class="lbl">💰 Saldo</div><div class="val ${k.saldo>=0?'in':'out'}">${fmtBRL(k.saldo)}</div><div class="hint">entradas − saídas (sem internos)</div></div>
   <div class="kpi"><div class="lbl">📈 Entradas</div><div class="val in">${fmtBRL(k.ent)}</div></div>
   <div class="kpi"><div class="lbl">📉 Saídas</div><div class="val out">${fmtBRL(k.sai)}</div></div>
   <div class="kpi"><div class="lbl">🔮 Saldo projetado</div><div class="val ${k.proj>=0?'in':'out'}">${fmtBRL(k.proj)}</div><div class="hint">+receber ${fmtK(k.aReceber)} −pagar ${fmtK(k.aPagar)}</div></div></div>
  ${saldoCard()}
  <div class="grid2"><div class="panel"><h2>Fluxo mensal</h2><canvas id="chFlow" height="120"></canvas></div><div class="panel"><h2>Top categorias (saídas)</h2><canvas id="chCat" height="120"></canvas></div></div>
  <div class="panel"><h2>Movimentos do período</h2>${miniMov(DB.movimentos.filter(inPeriod).sort((a,b)=>b.data.localeCompare(a.data)).slice(0,10))}</div>`;
  wirePeriod();_charts.forEach(c=>c.destroy());_charts=[];
  const rows=DB.movimentos.filter(m=>inPeriod(m)&&!isInterno(m));const bk=new Map();rows.forEach(m=>{const kk=monthKey(m.data);if(!bk.has(kk))bk.set(kk,{e:0,s:0});const b=bk.get(kk);if(m.sentido==="Entrada")b.e+=m.valor;else b.s+=m.valor;});const keys=[...bk.keys()].sort();
  _charts.push(new Chart($("#chFlow"),{type:"bar",data:{labels:keys.map(mkLabel),datasets:[{label:"Entradas",data:keys.map(k=>bk.get(k).e),backgroundColor:"#16a34a",borderRadius:5},{label:"Saídas",data:keys.map(k=>bk.get(k).s),backgroundColor:"#dc2626",borderRadius:5}]},options:{plugins:{legend:{position:"bottom"}},scales:{y:{ticks:{callback:fmtK}}}}}));
  const cm=new Map();rows.filter(m=>m.sentido==="Saída").forEach(m=>cm.set(m.categoria||"—",(cm.get(m.categoria||"—")||0)+m.valor));const cats=[...cm.entries()].sort((a,b)=>b[1]-a[1]).slice(0,7);
  _charts.push(new Chart($("#chCat"),{type:"doughnut",data:{labels:cats.map(c=>c[0]),datasets:[{data:cats.map(c=>c[1]),backgroundColor:["#3b5bdb","#16a34a","#d97706","#dc2626","#7c3aed","#0891b2","#db2777"]}]},options:{plugins:{legend:{position:"right",labels:{font:{size:10}}}}}}));
}
function miniMov(rows){if(!rows.length)return`<div class="empty">Sem movimentos.</div>`;return`<table><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Banco</th><th class="num">Valor</th></tr></thead><tbody>${rows.map(m=>`<tr style="cursor:pointer" onclick="editMovimento('${m._row}')"><td>${fmtDate(m.data)}</td><td>${esc(m.descricao)}</td><td>${m.categoria?`<span class="chip">${esc(m.categoria)}</span>`:`<span class="chip none">sem cat.</span>`}</td><td>${esc(m.banco)}</td><td class="num ${m.sentido==='Entrada'?'in':'out'}">${m.sentido==='Entrada'?'+':'−'} ${fmtBRL(m.valor)}</td></tr>`).join("")}</tbody></table>`;}

/* ===== Movimentos (multi-seleção + edição inline) ===== */
function toggleSel(id){if(SEL.has(id))SEL.delete(id);else SEL.add(id);renderMovTable(true);}
let _movRows=[],_movPieRows=[],_movChart=null;
const isCartaoConta=n=>{const c=(DB.contas||[]).find(x=>x.nome===n);return c?c.tipo==="cartao":/cart/i.test(n||"");};
function viewMovimentos(){
  $("#view").innerHTML=`<div class="row"><div><h1>Movimentos</h1><div class="sub">${DB.movimentos.length} lançamentos · clique numa célula p/ editar inline · clique numa fatia da pizza p/ filtrar categoria</div></div>
   <div style="display:flex;gap:8px"><button class="btn soft" onclick="autoCategorizar()">✨ Auto-categorizar</button><button class="btn" onclick="addMovimento()">+ Lançar</button></div></div>
  <div class="controls"><input id="fq" placeholder="Buscar..." style="min-width:180px"><select id="fs"><option value="">Sentido: todos</option><option>Entrada</option><option>Saída</option></select><select id="ft"><option value="">Conta/Cartão: tudo</option><option value="conta">🏦 Só contas</option><option value="cartao">💳 Só cartões</option></select><select id="fb"><option value="">Banco: todos</option>${bancoOpts().map(b=>`<option>${esc(b)}</option>`).join("")}</select><select id="fc"><option value="">Categoria: todas</option><option value="__none">⚠ Sem categoria</option>${[...new Set(DB.movimentos.map(m=>m.categoria).filter(Boolean))].sort().map(c=>`<option>${esc(c)}</option>`).join("")}</select></div>
  <div class="panel" style="margin-bottom:12px"><h2>Despesas por categoria <span class="sub" id="pieHint" style="font-weight:400"></span></h2><canvas id="chMovCat" height="100"></canvas></div>
  <div id="movWrap"></div>`;
  window._movFilter=()=>{const q=$("#fq").value.toLowerCase(),s=$("#fs").value,b=$("#fb").value,c=$("#fc").value,t=$("#ft").value;
    const base=DB.movimentos.filter(m=>(!q||m.descricao.toLowerCase().includes(q))&&(!s||m.sentido===s)&&(!b||m.banco===b)&&(!t||(t==="cartao"?isCartaoConta(m.banco):!isCartaoConta(m.banco))));
    _movPieRows=base;
    _movRows=base.filter(m=>(c===""||(c==="__none"?!m.categoria:m.categoria===c))).sort((a,b)=>b.data.localeCompare(a.data));renderMovTable();};
  const _filtD=debounce(window._movFilter,180);
  $("#fq").oninput=_filtD;
  ["fs","fb","fc","ft"].forEach(id=>{$("#"+id).onchange=window._movFilter;});window._movFilter();
}
function renderMovPie(){const cv=$("#chMovCat");if(!cv)return;if(_movChart){_movChart.destroy();_movChart=null;}
  const cm=new Map();_movPieRows.filter(m=>m.sentido==="Saída"&&!isInterno(m)).forEach(m=>cm.set(m.categoria||"sem cat.",(cm.get(m.categoria||"sem cat.")||0)+m.valor));
  const cats=[...cm.entries()].sort((a,b)=>b[1]-a[1]);
  if($("#pieHint"))$("#pieHint").textContent=cats.length?`— ${cats.length} categorias · clique p/ abrir`:"— sem despesas no filtro";
  if(!cats.length)return;
  const pal=["#3b5bdb","#16a34a","#d97706","#dc2626","#7c3aed","#0891b2","#db2777","#65a30d","#ea580c","#0d9488","#9333ea","#475569"];
  _movChart=new Chart(cv,{type:"doughnut",data:{labels:cats.map(c=>c[0]),datasets:[{data:cats.map(c=>c[1]),backgroundColor:cats.map((c,i)=>pal[i%pal.length])}]},
    options:{onClick:(e,el)=>{if(el&&el.length){const cat=cats[el[0].index][0];const sel=$("#fc");if(sel){sel.value=(cat==="sem cat.")?"__none":cat;window._movFilter();}}},
    plugins:{legend:{position:"right",labels:{font:{size:10},boxWidth:12}},tooltip:{callbacks:{label:c=>c.label+": "+fmtBRL(c.parsed)}}}}});
}
function renderMovTable(skipPie){const wrap=$("#movWrap");if(!wrap)return;
  let html=`<div class="panel" style="padding:0;overflow:hidden"><table><thead><tr><th></th><th>Data</th><th>Descrição</th><th>Categoria</th><th>Banco</th><th class="num">Valor</th></tr></thead><tbody>${
   _movRows.map(m=>`<tr class="${SEL.has(m._row)?'sel':''}">
     <td onclick="toggleSel('${m._row}')"><input type="checkbox" class="cb" ${SEL.has(m._row)?'checked':''}></td>
     <td class="editable" onclick="inlineEdit(this,'${m._row}','data')">${fmtDate(m.data)}</td>
     <td style="cursor:pointer" onclick="editMovimento('${m._row}')"><b style="font-weight:500">${esc(m.descricao)}</b></td>
     <td class="editable" onclick="inlineEdit(this,'${m._row}','categoria')">${m.categoria?`<span class="chip">${esc(m.categoria)}</span>`:`<span class="chip none">sem cat.</span>`}</td>
     <td class="editable" onclick="inlineEdit(this,'${m._row}','banco')">${esc(m.banco)}</td>
     <td class="num editable ${m.sentido==='Entrada'?'in':'out'}" onclick="inlineEdit(this,'${m._row}','valor')">${m.sentido==='Entrada'?'+':'−'} ${fmtBRL(m.valor)}</td></tr>`).join("")||`<tr><td colspan="6"><div class="empty">Nenhum.</div></td></tr>`}
   </tbody></table></div><div class="sub">${_movRows.length} resultado(s)</div>`;
  if(SEL.size)html+=`<div class="bulkbar"><b>${SEL.size} selecionado(s)</b><button class="btn sm" onclick="bulkCategorizar()">Definir categoria</button><button class="btn sm danger" onclick="bulkExcluir()">Excluir</button><button class="btn sm ghost" onclick="SEL.clear();renderMovTable(true)" style="margin-left:auto">Limpar</button></div>`;
  wrap.innerHTML=html;
  if(!skipPie)renderMovPie();
}
function inlineEdit(td,row,field){ if(td.classList.contains("editing"))return; const m=DB.movimentos.find(x=>x._row===row); if(!m)return;
  td.classList.add("editing"); let inp;
  if(field==="categoria"){inp=document.createElement("select");catOptsByTipo(m.sentido==="Entrada"?"entrada":"saida").filter(o=>o!=="__new").forEach(o=>{const op=document.createElement("option");op.value=o;op.textContent=o||"—";if(o===m.categoria)op.selected=true;inp.appendChild(op);});}
  else if(field==="banco"){inp=document.createElement("select");bancoOpts().forEach(o=>{const op=document.createElement("option");op.value=o;op.textContent=o;if(o===m.banco)op.selected=true;inp.appendChild(op);});}
  else if(field==="data"){inp=document.createElement("input");inp.type="date";inp.value=m.data;}
  else{inp=document.createElement("input");inp.type="number";inp.step="0.01";inp.value=m.valor;}
  td.innerHTML="";td.appendChild(inp);inp.focus();let done=false;
  const commit=async()=>{if(done)return;done=true;td.classList.remove("editing");let v=inp.value;if(field==="valor")v=Math.abs(+v||0);if(field==="categoria")v=leafCat(v);
    if(String(m[field])!==String(v)){try{if(field==="categoria"){if(MODE==="live")await sbUpd("movimentos",row,{categoria_id:catId(v)});m.categoria=v;}else if(field==="banco"){if(MODE==="live")await sbUpd("movimentos",row,{conta_id:contaId(v)});m.banco=v;}else if(field==="data"){if(MODE==="live")await sbUpd("movimentos",row,{data:v});m.data=v;m.mes=+v.slice(5,7);m.ano=+v.slice(0,4);}else{if(MODE==="live")await sbUpd("movimentos",row,{valor:v});m.valor=v;}toast("Salvo");}catch(e){toast("Erro: "+e.message);}}renderMovTable();};
  inp.addEventListener("blur",commit);inp.addEventListener("keydown",e=>{if(e.key==="Enter")inp.blur();if(e.key==="Escape"){done=true;td.classList.remove("editing");renderMovTable();}});
}
function bulkCategorizar(){modal({title:`Categoria em ${SEL.size} movimento(s)`,fields:[{name:"categoria",label:"Categoria",type:"select",options:catOpts()}],onSave:async v=>{const cat=leafCat(v.categoria),cid=catId(v.categoria),ids=[...SEL];if(MODE==="live")for(const id of ids)await sbUpd("movimentos",id,{categoria_id:cid});ids.forEach(id=>{const m=DB.movimentos.find(x=>x._row===id);if(m)m.categoria=cat;});toast(`${ids.length} categorizados`);await afterWrite();}});}
function bulkExcluir(){confirmDel(`Excluir ${SEL.size} movimento(s)?`,async()=>{const ids=[...SEL];if(MODE==="live")for(const id of ids){try{await sbDel("movimentos",id);}catch(e){}}DB.movimentos=DB.movimentos.filter(x=>!SEL.has(x._row));toast(`${ids.length} excluídos`);await afterWrite();});}
async function autoCategorizar(){const semCat=DB.movimentos.filter(m=>!m.categoria&&!isInterno(m));let n=0;const upd=[];for(const m of semCat){const s=suggestCategoria(m.descricao);if(s){m.categoria=s;upd.push([m._row,catId(s)]);n++;}}if(!n){toast("Nada para auto-categorizar");return;}if(MODE==="live")for(const[id,cid]of upd){try{await sbUpd("movimentos",id,{categoria_id:cid});}catch(e){}}toast(`${n} categorizados automaticamente`);await afterWrite();}

/* ===== Conciliação ===== */
function scoreMatch(m,valor,data){const dv=Math.abs(m.valor-valor);if(dv>Math.max(0.5,valor*0.02))return 0;const dd=data?Math.abs((new Date(m.data)-new Date(data))/864e5):999;if(dd>30)return 0;return 100-dd-(dv/Math.max(valor,1))*20;}
function conciliar(tipo,row){const it=(tipo==="pagar"?DB.contasPagar:DB.aReceber).find(x=>x._row===row);if(!it)return;const av=tipo==="pagar"?it.valor:it.previstoLiquido,ad=tipo==="pagar"?it.vencimento:it.dataPrevista,sd=tipo==="pagar"?"Saída":"Entrada";const cands=DB.movimentos.filter(m=>m.sentido===sd).map(m=>({m,s:scoreMatch(m,av,ad)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s).slice(0,8);
  const body=`<div class="sub" style="margin-bottom:8px">Conciliar <b>${esc(tipo==="pagar"?it.descricao:it.linha)}</b> (${fmtBRL(av)}) com:</div><div style="display:flex;flex-direction:column;gap:7px">${cands.length?cands.map(c=>`<label class="cand"><input type="radio" name="cand" value="${c.m._row}"><span style="flex:1">${fmtDate(c.m.data)} · ${esc(c.m.descricao)}</span><b class="${sd==="Entrada"?"in":"out"}">${fmtBRL(c.m.valor)}</b></label>`).join(""):'<div class="empty">Nenhum candidato. Importe o extrato.</div>'}</div>`;
  modal({title:"Conciliar",extraHTML:body,saveLabel:"Conciliar",onSave:async(v,bg)=>{const sel=bg.querySelector("input[name=cand]:checked");if(!sel){toast("Escolha um");return false;}const st=tipo==="pagar"?"pago":"recebido";if(MODE==="live")await sbUpd("previstos",row,{status:st});it.status=st;toast("Conciliado ✓");await afterWrite();}});}

/* ===== Pagar / Receber ===== */
function viewPagar(){const rows=DB.contasPagar;$("#view").innerHTML=`<div class="row"><div><h1>Contas a Pagar</h1><div class="sub">${rows.length} contas</div></div><button class="btn" onclick="addPagar()">+ Adicionar</button></div><div class="panel"><table><thead><tr><th>Vencimento</th><th>Descrição</th><th>Categoria</th><th>Banco</th><th class="num">Valor</th><th>Status</th><th></th></tr></thead><tbody>${rows.map(p=>`<tr><td style="cursor:pointer" onclick="editPagar('${p._row}')">${fmtDate(p.vencimento)}</td><td style="cursor:pointer" onclick="editPagar('${p._row}')">${esc(p.descricao)}${p.recorrencia?` <span class="chip">${esc(p.recorrencia)}</span>`:""}</td><td><span class="chip">${esc(p.categoria||"—")}</span></td><td>${esc(p.banco||"—")}</td><td class="num out">${fmtBRL(p.valor)}</td><td><span class="pill ${p.status}">${p.status}</span></td><td>${p.status==="aberto"?`<button class="btn ghost sm" onclick="conciliar('pagar','${p._row}')">Conciliar</button>`:""}</td></tr>`).join("")||`<tr><td colspan="7"><div class="empty">Nenhuma.</div></td></tr>`}</tbody></table></div>`;}
function addMonthsDate(iso,n){let[y,m,d]=iso.split("-").map(Number);m+=n;y+=Math.floor((m-1)/12);m=((m-1)%12+12)%12+1;const last=new Date(y,m,0).getDate();if(d>last)d=last;return`${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;}
function pagarFields(forAdd){const f=[{name:"descricao",label:"Descrição"},{name:"vencimento",label:"Vencimento",type:"date"},{name:"valor",label:"Valor (R$)",type:"number"},{name:"categoria",label:"Categoria",type:"select",options:catOptsByTipo("saida").filter(o=>o!=="__new")},{name:"banco",label:"Banco",type:"select",options:bancoOpts()},{name:"recorrencia",label:"Recorrência",type:"select",options:[{v:"",l:"Pontual"},"mensal","semanal","anual",{v:"parcelado",l:"Parcelado"}]}];if(forAdd)f.push({name:"parcelas",label:"Número de parcelas",type:"number",placeholder:"Ex.: 12",showIf:{field:"recorrencia",val:"parcelado"}});return f;}
async function addPagar(){modal({title:"Nova conta a pagar",fields:pagarFields(true),values:{vencimento:todayISO(),parcelas:2},onSave:async v=>{if(!v.descricao){toast("Descrição");return false;}
  const parcelado=v.recorrencia==="parcelado",N=parcelado?Math.max(1,Math.round(+v.parcelas||1)):1,rec=parcelado?"":v.recorrencia,valor=Math.abs(+v.valor||0),catNome=leafCat(v.categoria);
  for(let i=0;i<N;i++){const venc=N>1?addMonthsDate(v.vencimento,i):v.vencimento;const desc=N>1?`${v.descricao} (${i+1}/${N})`:v.descricao;
    const o={_row:"p"+Date.now()+i,descricao:desc,vencimento:venc,valor,categoria:catNome,banco:v.banco,status:"aberto",recorrencia:rec};
    if(MODE==="live")o._row=await sbIns("previstos",{descricao:desc,valor,vencimento:venc||null,tipo:"pagar",status:"aberto",visao:VISAO,recorrencia:rec||null,conta_id:contaId(v.banco),categoria_id:catId(v.categoria)});
    DB.contasPagar.push(o);}
  toast(N>1?`${N} parcelas lançadas`:"Lançada");await afterWrite();}});}
function editPagar(row){const p=DB.contasPagar.find(x=>x._row===row);if(!p)return;modal({title:"Editar conta a pagar",fields:[...pagarFields(true),{name:"status",label:"Status",type:"select",options:["aberto","pago","cancelado"]}],values:{...p,parcelas:2},extraHTML:`<button class="btn danger sm" style="align-self:flex-start" onclick="delPrev('contasPagar','${row}')">Excluir</button>`,onSave:async v=>{
  const parcelado=v.recorrencia==="parcelado",N=parcelado?Math.max(1,Math.round(+v.parcelas||1)):1,valor=Math.abs(+v.valor||0),base=String(v.descricao||"").replace(/\s*\(\d+\/\d+\)\s*$/,"");
  if(parcelado&&N>1){const d1=`${base} (1/${N})`;
    if(MODE==="live")await sbUpd("previstos",row,{descricao:d1,valor,vencimento:v.vencimento||null,status:v.status,recorrencia:null,conta_id:contaId(v.banco),categoria_id:catId(v.categoria)});
    Object.assign(p,{descricao:d1,vencimento:v.vencimento,valor,categoria:leafCat(v.categoria),banco:v.banco,status:v.status,recorrencia:""});
    for(let i=1;i<N;i++){const venc=addMonthsDate(v.vencimento,i),desc=`${base} (${i+1}/${N})`,o={_row:"p"+Date.now()+i,descricao:desc,vencimento:venc,valor,categoria:leafCat(v.categoria),banco:v.banco,status:"aberto",recorrencia:""};if(MODE==="live")o._row=await sbIns("previstos",{descricao:desc,valor,vencimento:venc||null,tipo:"pagar",status:"aberto",visao:VISAO,recorrencia:null,conta_id:contaId(v.banco),categoria_id:catId(v.categoria)});DB.contasPagar.push(o);}
    toast(`${N} parcelas geradas`);
  }else{const rec=parcelado?"":v.recorrencia;if(MODE==="live")await sbUpd("previstos",row,{descricao:v.descricao,valor,vencimento:v.vencimento||null,status:v.status,recorrencia:rec||null,conta_id:contaId(v.banco),categoria_id:catId(v.categoria)});Object.assign(p,{descricao:v.descricao,vencimento:v.vencimento,valor,categoria:leafCat(v.categoria),banco:v.banco,status:v.status,recorrencia:rec});toast("Atualizado");}
  await afterWrite();}});}
function viewReceber(){const rows=DB.aReceber;$("#view").innerHTML=`<div class="row"><div><h1>A Receber</h1><div class="sub">${rows.length} previstos</div></div><button class="btn" onclick="addReceber()">+ Adicionar</button></div><div class="panel"><table><thead><tr><th>Data prevista</th><th>Descrição</th><th>Conta</th><th class="num">Previsto</th><th>Status</th><th></th></tr></thead><tbody>${rows.map(p=>`<tr><td style="cursor:pointer" onclick="editReceber('${p._row}')">${fmtDate(p.dataPrevista)}</td><td style="cursor:pointer" onclick="editReceber('${p._row}')">${esc(p.linha)}${p.recorrencia?` <span class="chip">${esc(p.recorrencia)}</span>`:""}</td><td>${esc(p.conta||"—")}</td><td class="num in">${fmtBRL(p.previstoLiquido)}</td><td><span class="pill ${p.status}">${p.status}</span></td><td>${p.status!=="recebido"?`<button class="btn ghost sm" onclick="conciliar('receber','${p._row}')">Conciliar</button>`:""}</td></tr>`).join("")||`<tr><td colspan="6"><div class="empty">Nenhum.</div></td></tr>`}</tbody></table></div>`;}
function receberFields(forAdd){const f=[{name:"descricao",label:"Descrição"},{name:"dataPrevista",label:"Data prevista",type:"date"},{name:"valor",label:"Valor (R$)",type:"number"},{name:"conta",label:"Conta destino",type:"select",options:bancoOpts()},{name:"recorrencia",label:"Recorrência",type:"select",options:[{v:"",l:"Pontual"},"mensal","semanal","anual",{v:"parcelado",l:"Parcelado"}]}];if(forAdd)f.push({name:"parcelas",label:"Número de parcelas",type:"number",placeholder:"Ex.: 12",showIf:{field:"recorrencia",val:"parcelado"}});return f;}
function addReceber(){modal({title:"Novo previsto a receber",fields:receberFields(true),values:{dataPrevista:todayISO(),parcelas:2},onSave:async v=>{if(!v.descricao){toast("Descrição");return false;}
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
  }else{const rec=parcelado?"":v.recorrencia;if(MODE==="live")await sbUpd("previstos",row,{descricao:v.descricao,valor,vencimento:v.dataPrevista||null,status:v.status,recorrencia:rec||null,conta_id:contaId(v.conta)});Object.assign(p,{linha:v.descricao,dataPrevista:v.dataPrevista,previstoLiquido:valor,conta:v.conta,status:v.status,recorrencia:rec});toast("Atualizado");}
  await afterWrite();}});}
async function delPrev(coll,row){if(MODE==="live"){try{await sbDel("previstos",row);}catch(e){toast("Erro: "+e.message);return;}}DB[coll]=DB[coll].filter(x=>x._row!==row);document.querySelectorAll(".modal-bg").forEach(b=>b.remove());toast("Excluído");await afterWrite();}

/* ===== Cartões (lê dos movimentos lançados nas contas tipo cartão) ===== */
const cardContas=()=>(DB.contas||[]).filter(c=>c.tipo==="cartao"||/cart/i.test(c.nome));
let CART_SEL=null;
function viewCartoes(){const cards=cardContas();
  if(!cards.length){$("#view").innerHTML=`<div class="row"><div><h1>Cartões</h1></div></div><div class="panel"><div class="empty">Nenhum cartão cadastrado. Crie em Configurações › Cartões.</div></div>`;return;}
  if(!CART_SEL||!cards.some(c=>c.nome===CART_SEL))CART_SEL=cards[0].nome;
  const movs=DB.movimentos.filter(m=>m.banco===CART_SEL);
  // saldo da fatura (dívida) = saídas(compras) − entradas(pagamentos)
  const compras=movs.filter(m=>m.sentido==="Saída"),pagtos=movs.filter(m=>m.sentido==="Entrada");
  const totCompras=compras.reduce((s,m)=>s+m.valor,0),totPagtos=pagtos.reduce((s,m)=>s+m.valor,0),saldo=totCompras-totPagtos;
  // faturas a pagar vinculadas (Contas a Pagar com "fatura" na descrição)
  const faturasAbertas=(DB.contasPagar||[]).filter(p=>/fatura/i.test(p.descricao)&&p.status==="aberto");
  // agrupa por competência = mês da compra
  const fat=new Map();movs.forEach(m=>{const k=monthKey(m.data);if(!fat.has(k))fat.set(k,{comp:k,compras:0,pagtos:0,n:0});const f=fat.get(k);if(m.sentido==="Saída"){f.compras+=m.valor;f.n++;}else f.pagtos+=m.valor;});
  const fs=[...fat.values()].sort((a,b)=>b.comp.localeCompare(a.comp));
  const parc=compras.filter(m=>/parcela|\/\d+/i.test(m.descricao));
  $("#view").innerHTML=`<div class="row"><div><h1>Cartões</h1><div class="sub">Controle de fatura — lê dos lançamentos na conta do cartão</div></div>
    ${cards.length>1?`<select onchange="CART_SEL=this.value;viewCartoes()">${cards.map(c=>`<option ${c.nome===CART_SEL?"selected":""}>${esc(c.nome)}</option>`).join("")}</select>`:""}</div>
   <div class="kpis"><div class="kpi"><div class="lbl">💳 Fatura em aberto (saldo)</div><div class="val ${saldo>0?'out':'in'}">${fmtBRL(saldo)}</div><div class="hint">compras − pagamentos</div></div>
    <div class="kpi"><div class="lbl">Compras (total)</div><div class="val out">${fmtBRL(totCompras)}</div><div class="hint">${compras.length} lançamentos</div></div>
    <div class="kpi"><div class="lbl">Pagamentos (total)</div><div class="val in">${fmtBRL(totPagtos)}</div><div class="hint">${pagtos.length} pagamentos</div></div>
    <div class="kpi"><div class="lbl">📅 Próxima fatura</div><div class="val">${faturasAbertas.length?fmtDate(faturasAbertas.sort((a,b)=>a.vencimento.localeCompare(b.vencimento))[0].vencimento):"—"}</div><div class="hint">${faturasAbertas.length?fmtBRL(faturasAbertas[0].valor):"em Contas a Pagar"}</div></div></div>
   <div class="panel"><h2>Faturas por competência (mês de compra)</h2><table><thead><tr><th>Competência</th><th class="num">Compras</th><th class="num">Pagamentos</th><th class="num">Líquido</th><th></th></tr></thead><tbody>${fs.map(f=>`<tr><td><b>${mkLabel(f.comp)}</b> <span class="sub" style="margin:0">(${f.n})</span></td><td class="num out">${fmtBRL(f.compras)}</td><td class="num in">${f.pagtos?fmtBRL(f.pagtos):"—"}</td><td class="num ${f.compras-f.pagtos>0?'out':'in'}">${fmtBRL(f.compras-f.pagtos)}</td><td><button class="btn ghost sm" onclick="gerarFatura('${f.comp}')">Gerar conta a pagar</button></td></tr>`).join("")||`<tr><td colspan="5"><div class="empty">Sem lançamentos.</div></td></tr>`}</tbody></table></div>
   ${parc.length?`<div class="panel"><h2>Parcelados detectados (${parc.length})</h2><table><tbody>${parc.map(m=>`<tr><td>${fmtDate(m.data)}</td><td>${esc(m.descricao)}</td><td class="num out">${fmtBRL(m.valor)}</td></tr>`).join("")}</tbody></table><div class="sub">Dica: edite a descrição com "1/5" etc. e o controle de parcelas futuras entra no próximo incremento.</div></div>`:""}
   <div class="panel"><h2>Lançamentos do cartão (${movs.length})</h2><table><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th class="num">Valor</th></tr></thead><tbody>${movs.slice().sort((a,b)=>b.data.localeCompare(a.data)).map(m=>`<tr style="cursor:pointer" onclick="editMovimento('${m._row}')"><td>${fmtDate(m.data)}</td><td>${esc(m.descricao)}</td><td>${m.categoria?`<span class="chip">${esc(m.categoria)}</span>`:`<span class="chip none">sem cat.</span>`}</td><td class="num ${m.sentido==='Entrada'?'in':'out'}">${m.sentido==='Entrada'?'+':'−'} ${fmtBRL(m.valor)}</td></tr>`).join("")||`<tr><td colspan="4"><div class="empty">Sem lançamentos.</div></td></tr>`}</tbody></table></div>`;}
function gerarFatura(compKey){const cartao=CART_SEL;const comp=compKey.slice(5,7)+"/"+compKey.slice(0,4);const due=compKey+"-10";
  const total=DB.movimentos.filter(m=>m.banco===cartao&&monthKey(m.data)===compKey&&m.sentido==="Saída").reduce((s,m)=>s+m.valor,0);
  const o={_row:"p"+Date.now(),descricao:`Fatura ${cartao} ${comp}`,vencimento:due,valor:total,categoria:"Pagamento fatura cartão",banco:cartao,status:"aberto",recorrencia:""};(async()=>{if(MODE==="live")o._row=await sbIns("previstos",{descricao:o.descricao,valor:o.valor,vencimento:due,tipo:"pagar",status:"aberto",visao:VISAO,conta_id:contaId(cartao),categoria_id:catId("Pagamento fatura cartão")});DB.contasPagar.push(o);toast("Fatura lançada");route("pagar");})().catch(e=>toast("Erro: "+e.message));}

/* ===== Importar ===== */
function viewImportar(){$("#view").innerHTML=`<div class="row"><div><h1>Importar</h1><div class="sub">Tipo + destino + arquivo (ou cole)</div></div></div><div class="panel"><div class="controls"><div class="fld"><label class="sub" style="margin:0">Tipo</label><select id="impTipo"><option value="auto">Detectar</option><option value="ofx">Extrato OFX</option><option value="csv">Extrato CSV</option><option value="fatura">Fatura cartão</option><option value="compensatio">Compensatio</option></select></div><div class="fld"><label class="sub" style="margin:0">Lançar em</label><select id="impDest"></select></div></div><div class="controls"><input id="impFile" type="file" accept=".ofx,.qfx,.csv,.txt,.xml,.pdf,.xlsx"><span class="sub">ou cole ↓</span></div><textarea id="imp" placeholder="Cole o conteúdo..." style="width:100%;height:120px;font-family:ui-monospace,monospace;font-size:12px"></textarea><div style="margin-top:10px"><button class="btn" onclick="doImport()">Processar</button></div><div id="impOut" style="margin-top:14px"></div></div>`;const fill=()=>{const t=$("#impTipo").value;const opts=(t==="fatura")?cartaoOpts():bancoOpts();$("#impDest").innerHTML=opts.map(o=>`<option>${esc(o)}</option>`).join("");};$("#impTipo").onchange=fill;fill();}
function doImport(){const file=$("#impFile").files[0];if(file){const ext=file.name.toLowerCase().split(".").pop();if(["pdf","xlsx","xls"].includes(ext)){$("#impOut").innerHTML=`<div class="empty">Parser de ${ext.toUpperCase()} entra no próximo incremento. Use OFX/CSV ou cole o texto.</div>`;return;}const rd=new FileReader();rd.onload=()=>runImport(rd.result);rd.readAsText(file);return;}runImport($("#imp").value);}
function runImport(text){if(!text||!text.trim()){toast("Anexe ou cole");return;}const tipo=$("#impTipo").value,dest=$("#impDest").value,r=parseByType(text,tipo);if(!r.txs.length){$("#impOut").innerHTML=`<div class="empty">Nada reconhecido.</div>`;return;}r.txs.forEach(x=>x.cat=suggestCategoria(x.description));const tot=r.txs.reduce((s,x)=>s+(x.sign==="Entrada"?x.amount:-x.amount),0);window._imp={r,dest};$("#impOut").innerHTML=`<div class="sub" style="margin-bottom:8px">Detectado <b>${r.kind.toUpperCase()}</b> · ${r.txs.length} transações · líquido ${fmtBRL(tot)} · destino <b>${esc(dest)}</b></div><table><thead><tr><th>Data</th><th>Descrição</th><th>Cat. sugerida</th><th class="num">Valor</th></tr></thead><tbody>${r.txs.map(x=>`<tr><td>${fmtDate(x.date)}</td><td>${esc(x.description)}</td><td>${x.cat?`<span class="chip">${esc(x.cat)}</span>`:`<span class="chip none">—</span>`}</td><td class="num ${x.sign==="Entrada"?"in":"out"}">${x.sign==="Entrada"?"+":"−"} ${fmtBRL(x.amount)}</td></tr>`).join("")}</tbody></table><div style="margin-top:10px"><button class="btn" onclick="lancarImport()">Lançar ${r.txs.length} ${MODE==="live"?"no Supabase":"(demo)"}</button></div>`;}
async function lancarImport(){const{r,dest}=window._imp||{};if(!r)return;const isFat=r.kind==="fatura";
  /* dedup: pula transações idênticas às já existentes (evita double-count ao reimportar o mesmo extrato) */
  const norm=s=>String(s||"").trim().toLowerCase();
  const keyOf=(d,v,desc,c,sign)=>isFat?[d,v,norm(desc),norm(c)].join("|"):[d,v,norm(desc),sign,norm(c)].join("|");
  const seen=new Set((isFat?DB.cartoes:DB.movimentos).map(m=>isFat?keyOf(m.data,m.valor,m.descricao,m.cartao):keyOf(m.data,m.valor,m.descricao,m.banco,m.sentido)));
  let n=0,dup=0,err=0;
  for(const x of r.txs){
    const key=keyOf(x.date,x.amount,x.description,dest,x.sign);
    if(seen.has(key)){dup++;continue;}
    seen.add(key);
    try{
      if(isFat){const o={_row:"k"+Date.now()+n,data:x.date,descricao:x.description,cartao:dest,valor:x.amount,subcategoria:x.cat||"",mesFatura:x.date.slice(5,7)+"/"+x.date.slice(0,4)};if(MODE==="live")o._row=await sbIns("cartao_transacoes",{cartao_id:contaId(dest),data_compra:x.date,data_fatura:x.date.slice(0,7)+"-01",descricao:x.description,valor:x.amount,parcela_atual:1,parcela_total:1,categoria_id:catId(x.cat),visao:VISAO,hash:uhash(x.description+x.date+x.amount)});DB.cartoes.unshift(o);}
      else{const o={_row:"d"+Date.now()+n,data:x.date,descricao:x.description,valor:x.amount,sentido:x.sign,banco:dest,categoria:x.cat||"",mes:+x.date.slice(5,7),ano:+x.date.slice(0,4)};if(MODE==="live")o._row=await sbIns("movimentos",{data:x.date,descricao_original:x.description,descricao_limpa:x.description,valor:x.amount,sinal:x.sign==="Entrada"?1:-1,conta_id:contaId(dest),categoria_id:catId(x.cat),visao:VISAO,hash:uhash(x.description+x.date+x.amount)});DB.movimentos.unshift(o);}
      n++;
    }catch(e){err++;}
  }
  toast([`${n} lançados`,dup?`${dup} ignorados (já existiam)`:"",err?`${err} com erro`:""].filter(Boolean).join(" · "));
  await afterWrite();route(isFat?"cartoes":"movimentos");}

/* ===== Fluxo de Caixa (realizado + projeção c/ recorrentes) ===== */
let FLUXO_H=6;
function viewFluxo(){const tk=todayISO().slice(0,7);
  const real=[...new Set(DB.movimentos.map(m=>monthKey(m.data)).filter(Boolean))].sort().filter(k=>k<=tk).slice(-FLUXO_H);
  const months=[]; let cur=real.length?real[0]:tk; const end=addMonth(tk,6);
  // monta sequência contígua do 1º realizado até tk+6
  let g=cur; const last=addMonth(tk,6); while(g<=last){months.push(g);g=addMonth(g,1);}
  const ent={},sai={};DB.movimentos.filter(m=>!isInterno(m)).forEach(m=>{const k=monthKey(m.data);if(m.sentido==="Entrada")ent[k]=(ent[k]||0)+m.valor;else sai[k]=(sai[k]||0)+m.valor;});
  // projeção: previstos abertos por mês de vencimento; recorrentes mensais replicam pra frente
  const rec={},pag={};
  DB.aReceber.filter(a=>(a.status||"").toLowerCase()!=="recebido").forEach(a=>{const k=monthKey(a.dataPrevista);if(!k)return;months.forEach(mm=>{if(mm<=tk)return;if(mm===k||(a.recorrencia==="mensal"&&mm>=k))rec[mm]=(rec[mm]||0)+a.previstoLiquido;});});
  DB.contasPagar.filter(c=>(c.status||"").toLowerCase()==="aberto").forEach(c=>{const k=monthKey(c.vencimento);if(!k)return;months.forEach(mm=>{if(mm<=tk)return;if(mm===k||(c.recorrencia==="mensal"&&mm>=k))pag[mm]=(pag[mm]||0)+c.valor;});});
  let base=0;DB.movimentos.filter(m=>!isInterno(m)&&monthKey(m.data)<months[0]).forEach(m=>base+=m.sentido==="Entrada"?m.valor:-m.valor);
  let acc=base;const data=months.map(k=>{const proje=k>tk;const e=ent[k]||0,s=sai[k]||0,r=proje?(rec[k]||0):0,p=proje?(pag[k]||0):0;const net=(e-s)+(r-p);acc+=net;return{k,e,s,r,p,net,acc,proje};});
  const cell=(v,cls)=>`<td class="${v?cls:''}">${v?fmtBRL(v):"—"}</td>`;
  $("#view").innerHTML=`<div class="row"><div><h1>Fluxo de Caixa</h1><div class="sub">Realizado + projeção (a receber/pagar + recorrentes). <span class="pj">Roxo</span> = projetado.</div></div><select id="fh"><option value="3">3m</option><option value="6" selected>6m</option><option value="12">12m</option></select></div>
   <div class="panel" style="overflow-x:auto"><table class="cf"><thead><tr><th class="h">Mês</th>${data.map(c=>`<th>${mkLabel(c.k)}${c.proje?' <span class="pj">•</span>':''}</th>`).join("")}</tr></thead><tbody>
    <tr><td class="h">Entradas</td>${data.map(c=>cell(c.e,"in")).join("")}</tr>
    <tr><td class="h">Saídas</td>${data.map(c=>cell(c.s,"out")).join("")}</tr>
    <tr><td class="h">A receber (prev.)</td>${data.map(c=>`<td class="${c.r?'pj':''}">${c.r?fmtBRL(c.r):"—"}</td>`).join("")}</tr>
    <tr><td class="h">A pagar (prev.)</td>${data.map(c=>`<td class="${c.p?'pj':''}">${c.p?'−'+fmtBRL(c.p):"—"}</td>`).join("")}</tr>
    <tr style="border-top:2px solid var(--border)"><td class="h"><b>Saldo do mês</b></td>${data.map(c=>`<td class="${c.net>=0?'in':'out'}"><b>${fmtBRL(c.net)}</b></td>`).join("")}</tr>
    <tr><td class="h"><b>Saldo acumulado</b></td>${data.map(c=>`<td class="${c.acc>=0?'in':'out'}"><b>${fmtBRL(c.acc)}</b></td>`).join("")}</tr>
   </tbody></table></div><div class="panel"><h2>Saldo acumulado projetado</h2><canvas id="chAcc" height="90"></canvas></div>`;
  $("#fh").value=String(FLUXO_H);$("#fh").onchange=e=>{FLUXO_H=+e.target.value;viewFluxo();};
  _charts.forEach(c=>c.destroy());_charts=[];_charts.push(new Chart($("#chAcc"),{type:"line",data:{labels:data.map(c=>mkLabel(c.k)),datasets:[{label:"Saldo",data:data.map(c=>c.acc),borderColor:"#3b5bdb",backgroundColor:"rgba(59,91,219,.12)",fill:true,tension:.25,pointBackgroundColor:data.map(c=>c.proje?"#7c3aed":"#3b5bdb")}]},options:{plugins:{legend:{display:false}},scales:{y:{ticks:{callback:fmtK}}}}}));
}

/* ===== DRE ===== */
let DRE_MODE="ano",DRE_ANO=null,DRE_MES=null;
function viewDRE(){ DRE_ANO=DRE_ANO||yearsList()[0]||new Date().getFullYear();DRE_MES=DRE_MES||new Date().getMonth()+1;
  const inDre=m=>DRE_MODE==="ano"?m.ano===DRE_ANO:(m.ano===DRE_ANO&&m.mes===DRE_MES);
  const rows=DB.movimentos.filter(m=>inDre(m)&&!isInterno(m));
  const receitas={},grupos={};let totRec=0,totDesp=0;
  rows.forEach(m=>{const g=dreGrupo(m.categoria,m.sentido==="Entrada"?"entrada":"saida");if(!g)return;
    if(m.sentido==="Entrada"){receitas[m.categoria||"Outras"]=(receitas[m.categoria||"Outras"]||0)+m.valor;totRec+=m.valor;}
    else{grupos[g]=grupos[g]||{};grupos[g][m.categoria||"Outras"]=(grupos[g][m.categoria||"Outras"]||0)+m.valor;totDesp+=m.valor;}});
  const result=totRec-totDesp;const margem=totRec?(result/totRec*100):0;
  const secReceita=`<tr style="background:#f0fdf4"><td class="h"><b>RECEITAS</b></td><td class="num in"><b>${fmtBRL(totRec)}</b></td></tr>${Object.entries(receitas).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<tr><td class="h" style="padding-left:22px">${esc(k)}</td><td class="num in">${fmtBRL(v)}</td></tr>`).join("")}`;
  const ordemG=[...DRE_ORDEM_DESP.filter(g=>grupos[g]),...Object.keys(grupos).filter(g=>!DRE_ORDEM_DESP.includes(g))];
  const secDesp=ordemG.filter(g=>grupos[g]).map(g=>{const sub=grupos[g];const tg=Object.values(sub).reduce((a,b)=>a+b,0);return `<tr style="background:#fef2f2"><td class="h"><b>${g}</b></td><td class="num out"><b>−${fmtBRL(tg)}</b></td></tr>${Object.entries(sub).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<tr><td class="h" style="padding-left:22px">${esc(k)}</td><td class="num out">−${fmtBRL(v)}</td></tr>`).join("")}`;}).join("");
  $("#view").innerHTML=`<div class="row"><div><h1>DRE</h1><div class="sub">Demonstração de Resultado — ${DRE_MODE==="ano"?("ano "+DRE_ANO):(ML[DRE_MES-1]+"/"+DRE_ANO)}</div></div>
    <div class="controls" style="margin:0"><select id="dm"><option value="ano" ${DRE_MODE==="ano"?"selected":""}>Anual</option><option value="mes" ${DRE_MODE==="mes"?"selected":""}>Mensal</option></select><select id="da">${yearsList().map(y=>`<option ${y===DRE_ANO?"selected":""}>${y}</option>`).join("")}</select>${DRE_MODE==="mes"?`<select id="dmes">${ML.map((n,i)=>`<option value="${i+1}" ${i+1===DRE_MES?"selected":""}>${n}</option>`).join("")}</select>`:""}</div></div>
  <div class="kpis"><div class="kpi"><div class="lbl">Receita</div><div class="val in">${fmtBRL(totRec)}</div></div><div class="kpi"><div class="lbl">Despesas</div><div class="val out">${fmtBRL(totDesp)}</div></div><div class="kpi"><div class="lbl">Resultado</div><div class="val ${result>=0?'in':'out'}">${fmtBRL(result)}</div></div><div class="kpi"><div class="lbl">Margem</div><div class="val ${margem>=0?'in':'out'}">${margem.toFixed(1)}%</div></div></div>
  <div class="panel"><table class="cf"><tbody>${secReceita}${secDesp}<tr style="border-top:2px solid var(--fg)"><td class="h"><b>RESULTADO LÍQUIDO</b></td><td class="num ${result>=0?'in':'out'}"><b>${fmtBRL(result)}</b></td></tr></tbody></table>
   <div class="sub" style="margin-top:8px">Agrupamento pelo campo <b>Grupo no DRE</b> de cada categoria (Configurações › Linhas do DRE). Onde não houver grupo definido, cai na heurística pelo nome.</div></div>`;
  $("#dm").onchange=e=>{DRE_MODE=e.target.value;viewDRE();};$("#da").onchange=e=>{DRE_ANO=+e.target.value;viewDRE();};if($("#dmes"))$("#dmes").onchange=e=>{DRE_MES=+e.target.value;viewDRE();};
}

/* ===== Orçamento ===== */
let ORC_MES=null;
function viewOrcamento(){ ORC_MES=ORC_MES||todayISO().slice(0,7); const orc=loadOrc();const mb=orc[ORC_MES]||{};
  const cats=DB.categorias.filter(c=>!c.parent_id);
  const realByCat={};DB.movimentos.filter(m=>monthKey(m.data)===ORC_MES&&!isInterno(m)).forEach(m=>{realByCat[m.categoria||"—"]=(realByCat[m.categoria||"—"]||0)+(m.sentido==="Entrada"?m.valor:-m.valor);});
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
   <div class="sub">O orçamento é salvo localmente neste navegador. Persistência no Supabase (tabela de orçamento) entra como incremento.</div>`;
  $("#om").onchange=e=>{ORC_MES=e.target.value;viewOrcamento();};
  $("#view").querySelectorAll("input[data-cat]").forEach(inp=>inp.onchange=()=>{const o=loadOrc();o[ORC_MES]=o[ORC_MES]||{};o[ORC_MES][inp.dataset.cat]=+inp.value||0;saveOrc(o);viewOrcamento();});
}

/* ===== Configurações (contas/cartões/categorias) ===== */
let CFG_TAB="contas";
function viewConfig(){const tab=(id,lbl)=>`<button class="${CFG_TAB===id?'on':''}" onclick="CFG_TAB='${id}';viewConfig()">${lbl}</button>`;
  let body="";
  if(CFG_TAB==="contas"||CFG_TAB==="cartoes"){const isCard=CFG_TAB==="cartoes";const list=(DB.contas||[]).filter(c=>isCard?(c.tipo==="cartao"||/cart/i.test(c.nome)):!(c.tipo==="cartao"||/cart/i.test(c.nome)));
    body=`<div class="panel"><h2>${isCard?"Cartões":"Contas"} <button class="btn sm" onclick="addConta('${isCard?'cartao':'corrente'}')">+ ${isCard?'Cartão':'Conta'}</button></h2><table><thead><tr><th>Nome</th><th>Banco</th><th>Tipo</th><th></th></tr></thead><tbody>${list.map(c=>`<tr><td><b>${esc(c.nome)}</b></td><td>${esc(c.banco||"—")}</td><td>${esc(c.tipo||"—")}</td><td class="num"><button class="btn ghost sm" onclick="editConta('${c.id}')">Editar</button><button class="btn danger sm" onclick="delConta('${c.id}')">Excluir</button></td></tr>`).join("")||`<tr><td colspan="4"><div class="empty">Nenhum.</div></td></tr>`}</tbody></table></div>`;}
  else if(CFG_TAB==="dre"){
    const optG=c=>`<select onchange="setGrupoDre('${c.id}',this.value)" style="min-width:180px">${["",...DRE_GRUPOS].map(g=>`<option value="${esc(g)}" ${(c.grupo_dre||"")===g?"selected":""}>${g||"— automático"}</option>`).join("")}</select>`;
    const secD=(tipo,t)=>{const arr=DB.categorias.filter(c=>c.tipo===tipo).sort((a,b)=>(a.parent_id?1:0)-(b.parent_id?1:0)||a.nome.localeCompare(b.nome));return `<div class="panel"><h2>${t} (${arr.length})</h2><table><thead><tr><th>Categoria</th><th>Grupo no DRE</th></tr></thead><tbody>${arr.map(c=>`<tr><td>${c.parent_id?"↳ ":""}<b>${esc(c.nome)}</b></td><td>${optG(c)}</td></tr>`).join("")||`<tr><td colspan="2"><div class="empty">Nenhuma.</div></td></tr>`}</tbody></table></div>`;};
    body=`<div class="sub" style="margin-bottom:10px">Defina em qual linha do DRE cada categoria entra. <b>Em branco = automático</b> (heurística pelo nome). Receitas costumam ficar em "Receitas"; despesas em Custos / Operacionais / Impostos / Outras.</div>`+secD("saida","Saídas")+secD("entrada","Entradas");
  }
  else{const tops=DB.categorias.filter(c=>!c.parent_id);const sec=(tipo,t)=>{const arr=tops.filter(c=>c.tipo===tipo);return`<div class="panel"><h2>${t} (${arr.length}) <button class="btn sm" onclick="addCat('${tipo}')">+ Categoria</button></h2><table><tbody>${arr.map(p=>{const subs=DB.categorias.filter(s=>s.parent_id===p.id);return`<tr><td><b>${esc(p.nome)}</b></td><td class="num"><button class="btn ghost sm" onclick="addSub('${p.id}')">+ Sub</button><button class="btn ghost sm" onclick="editCat('${p.id}')">Editar</button><button class="btn danger sm" onclick="delCat('${p.id}')">Excluir</button></td></tr>${subs.map(s=>`<tr class="subrow"><td>↳ <span class="chip">${esc(s.nome)}</span></td><td class="num"><button class="btn ghost sm" onclick="editCat('${s.id}')">Editar</button><button class="btn danger sm" onclick="delCat('${s.id}')">Excluir</button></td></tr>`).join("")}`;}).join("")||`<tr><td><div class="empty">Nenhuma.</div></td></tr>`}</tbody></table></div>`;};body=sec("entrada","Entradas")+sec("saida","Saídas");}
  $("#view").innerHTML=`<div class="row"><div><h1>Configurações</h1><div class="sub">Fonte de verdade que alimenta os selects de lançamento</div></div></div><div class="tabs">${tab("contas","Contas")}${tab("cartoes","Cartões")}${tab("categorias","Categorias")}${tab("dre","Linhas do DRE")}</div>${body}`;
}
function contaFields(tipo){return[{name:"nome",label:"Nome"},{name:"banco",label:"Banco"},{name:"tipo",label:"Tipo",type:"select",options:["corrente","cartao","investimento","caixa"],default:tipo}];}
function addConta(tipo){modal({title:"Nova "+(tipo==="cartao"?"cartão":"conta"),fields:contaFields(tipo),onSave:async v=>{if(!v.nome){toast("Nome");return false;}const o={id:"co"+Date.now(),nome:v.nome,banco:v.banco,tipo:v.tipo,ativo:true};if(MODE==="live")o.id=await sbIns("contas",{nome:v.nome,banco:v.banco||null,tipo:v.tipo,ativo:true});DB.contas.push(o);toast("Criada");await afterWrite();}});}
function editConta(id){const c=DB.contas.find(x=>x.id===id);if(!c)return;modal({title:"Editar conta",fields:contaFields(c.tipo),values:{...c},onSave:async v=>{if(MODE==="live")await sbUpd("contas",id,{nome:v.nome,banco:v.banco||null,tipo:v.tipo});Object.assign(c,{nome:v.nome,banco:v.banco,tipo:v.tipo});toast("Atualizada");await afterWrite();}});}
function delConta(id){const c=DB.contas.find(x=>x.id===id);if(!c)return;confirmDel(`Excluir "${c.nome}"? (lançamentos vinculados podem bloquear)`,async()=>{if(MODE==="live"){try{await sbDel("contas",id);}catch(e){toast("Não dá: há lançamentos nessa conta. Edite-os antes.");return;}}DB.contas=DB.contas.filter(x=>x.id!==id);document.querySelectorAll(".modal-bg").forEach(b=>b.remove());toast("Excluída");await afterWrite();});}
function addCat(tipo){modal({title:"Nova categoria",fields:[{name:"nome",label:"Nome"},{name:"tipo",label:"Tipo",type:"select",options:[{v:"entrada",l:"Entrada"},{v:"saida",l:"Saída"}],default:tipo}],onSave:async v=>{if(!v.nome){toast("Nome");return false;}const o={id:"cat"+Date.now(),nome:v.nome,tipo:v.tipo,parent_id:null};if(MODE==="live")o.id=await sbIns("categorias",{nome:v.nome,tipo:v.tipo,visao:"AMBOS"});DB.categorias.push(o);toast("Criada");await afterWrite();}});}
function addSub(pid){const p=DB.categorias.find(c=>c.id===pid);if(!p)return;modal({title:"Nova subcategoria de "+p.nome,fields:[{name:"nome",label:"Nome"}],onSave:async v=>{if(!v.nome){toast("Nome");return false;}const o={id:"cat"+Date.now(),nome:v.nome,tipo:p.tipo,parent_id:pid};if(MODE==="live")o.id=await sbIns("categorias",{nome:v.nome,tipo:p.tipo,visao:"AMBOS",parent_id:pid});DB.categorias.push(o);toast("Criada");await afterWrite();}});}
function editCat(id){const c=DB.categorias.find(x=>x.id===id);if(!c)return;modal({title:"Editar categoria",fields:[{name:"nome",label:"Nome"}],values:{nome:c.nome},onSave:async v=>{if(!v.nome){toast("Nome");return false;}if(MODE==="live")await sbUpd("categorias",id,{nome:v.nome});c.nome=v.nome;toast("Atualizada");await afterWrite();}});}
function delCat(id){const c=DB.categorias.find(x=>x.id===id);if(!c)return;const subs=DB.categorias.filter(s=>s.parent_id===id).length;confirmDel(`Excluir "${c.nome}"${subs?` e ${subs} subcategorias`:""}?`,async()=>{if(MODE==="live"){try{await sbDel("categorias",id);}catch(e){toast("Erro: "+e.message);return;}}DB.categorias=DB.categorias.filter(x=>x.id!==id&&x.parent_id!==id);document.querySelectorAll(".modal-bg").forEach(b=>b.remove());toast("Excluída");await afterWrite();});}

async function setGrupoDre(id,val){const c=DB.categorias.find(x=>x.id===id);if(!c)return;const prev=c.grupo_dre;c.grupo_dre=val||null;try{if(MODE==="live")await sbUpd("categorias",id,{grupo_dre:val||null});toast(val?("→ "+val):"Grupo removido (auto)");}catch(e){c.grupo_dre=prev;toast("Erro: "+e.message);}}

/* ===== Router + Init ===== */
const ROUTES={dashboard:viewDashboard,fluxo:viewFluxo,dre:viewDRE,orcamento:viewOrcamento,movimentos:viewMovimentos,pagar:viewPagar,receber:viewReceber,cartoes:viewCartoes,importar:viewImportar,config:viewConfig};
document.getElementById("nav").addEventListener("click",e=>{const a=e.target.closest("a");if(a){route(a.dataset.route);closeDrawer();}});
/* ===== Drawer mobile (sidebar off-canvas) ===== */
function openDrawer(){document.getElementById("sideNav").classList.add("open");document.getElementById("sideOv").classList.add("show");}
function closeDrawer(){const s=document.getElementById("sideNav"),o=document.getElementById("sideOv");if(s)s.classList.remove("open");if(o)o.classList.remove("show");}
(function(){const t=document.getElementById("navToggle"),o=document.getElementById("sideOv");if(t)t.onclick=openDrawer;if(o)o.onclick=closeDrawer;})();
/* ===== Seletor de perfil PJ ↔ PF ===== */
function profileUrls(){const root=(VISAO!=="PJ")?new URL("../",location.href):new URL("./",location.href);return{PJ:root.href,FAMILIA:new URL("pf/",root).href};}
function renderProfile(email){const pb=document.getElementById("profileBox");if(!pb)return;pb.style.display="block";
  const u=profileUrls();const ini=((email||VISAO||"?").trim()[0]||"?").toUpperCase();
  pb.innerHTML=`<div class="profile-chip" id="profChip"><div class="av">${esc(ini)}</div><div><div class="pn">Perfil ${esc(VISAO_LABEL)}</div><div class="ps">trocar perfil ▾</div></div></div>`+
    `<div class="profile-menu" id="profMenu"><a data-url="${esc(u.PJ)}" class="${VISAO==="PJ"?"cur":""}">🏢 Pessoa Jurídica (PJ)</a><a data-url="${esc(u.FAMILIA)}" class="${VISAO!=="PJ"?"cur":""}">🏠 Financeiro Família</a></div>`;
  const chip=pb.querySelector("#profChip"),menu=pb.querySelector("#profMenu");
  chip.onclick=e=>{e.stopPropagation();menu.classList.toggle("open");};
  menu.querySelectorAll("a").forEach(a=>a.onclick=()=>{const isCur=a.classList.contains("cur");if(isCur){menu.classList.remove("open");return;}location.href=a.dataset.url;});
  document.addEventListener("click",()=>menu.classList.remove("open"));
}
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

/* ===== Auth gate ===== */
const gate=document.getElementById("gate");
const showGate=()=>{gate.classList.add("show");document.getElementById("logoutBtn").style.display="none";};
const hideGate=()=>gate.classList.remove("show");

let _booted=false;
async function bootApp(){
  document.getElementById("verTag").textContent="v"+(window.APP_VERSION||"3.0");
  /* Escopo: DRE é só do PJ; PF/Família usam Orçamento. Mesmo código, muda CONFIG.VISAO. */
  {const _dre=document.getElementById("navDre");if(_dre)_dre.style.display=(VISAO==="PJ")?"":"none";
   const _br=document.querySelector(".brand");if(_br&&VISAO!=="PJ")_br.innerHTML='<span class="dot">₿</span> Central Financeira <b style="opacity:.6;font-weight:600">'+VISAO_LABEL+'</b>';}
  document.getElementById("envBox").innerHTML=MODE==="live"?`<span class="badge-live">LIVE</span> <b>v${window.APP_VERSION}</b> · <b>${VISAO_LABEL}</b><br>Supabase conectado`:`<span class="badge-demo">DEMO</span> <b>v${window.APP_VERSION}</b><br>Dados de exemplo`;
  if(MODE==="live"){document.getElementById("logoutBtn").style.display="block";document.getElementById("pwBtn").style.display="block";
    try{const{data}=await sb.auth.getSession();renderProfile(data&&data.session&&data.session.user&&data.session.user.email);}catch(e){renderProfile();}}
  if(_booted)return;_booted=true;
  try{DB=await loadData();const ys=yearsList();PERIOD.ano=ys[0]||new Date().getFullYear();PERIOD.mes=new Date().getMonth()+1;route("dashboard");}
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
  if(f.length)console.error("⚠ Central Financeira — self-check FALHOU:",f.join(" · "));
}catch(e){console.error("⚠ self-check erro:",e.message);}})();
