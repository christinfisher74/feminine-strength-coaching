/* Feminine Strength Co. — Master Client Platform v2
   One application. Authenticated users determine which client data is loaded.
   No client name, client ID, or client programming is hard-coded here.
*/
const CFG=window.FSC_CONFIG||{};
const hasSupabase=!!(CFG.SUPABASE_URL&&CFG.SUPABASE_PUBLISHABLE_KEY&&window.supabase);
const sb=hasSupabase?window.supabase.createClient(CFG.SUPABASE_URL,CFG.SUPABASE_PUBLISHABLE_KEY):null;

const APP={session:null,profile:null,client:null,selectedClient:null,coachClients:[],exercises:[],templates:[],workouts:[],resources:[],checkinQuestions:[],todayCheckin:null,nutritionSettings:null,nutritionLogs:[],movementLogs:[],progressEntries:[],notes:[],activeTab:'today',mode:'client',timers:new Map()};

const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const today=()=>new Date().toISOString().slice(0,10);
const fmtDate=d=>d?new Date(d+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}):'—';
const fmtLong=d=>d?new Date(d+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'}):'—';
const dayName=()=>new Date().toLocaleDateString('en-US',{weekday:'long'});
const initials=name=>String(name||'FSC').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase();
const isCoach=()=>APP.profile?.role==='coach';
const currentClient=()=>APP.selectedClient||APP.client;
function toast(msg){const t=document.getElementById('toast');if(!t)return;t.textContent=msg;t.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.classList.remove('show'),2600)}
function errorToast(msg){console.error(msg);toast(msg)}
function setLoading(on){document.body.classList.toggle('loading',on)}
function label(x){return({today:'Today',training:'Training',nutrition:'Nutrition',movement:'Movement',progress:'Progress',resources:'Resources'})[x]||x}

async function init(){
  renderShell();
  if(!hasSupabase){renderSetup();return}
  setLoading(true);
  try{
    const {data,error}=await sb.auth.getSession();if(error)throw error;
    APP.session=data.session;
    if(!APP.session){renderLogin();return}
    await loadIdentity();
    if(isCoach()){
      APP.mode='coach';await loadCoachHub();renderCoachHub();
    }else{
      await loadClient(APP.session.user.id);
      if(!APP.client){renderNoClient();return}
      await loadClientData(APP.client.id);renderClient();
    }
  }catch(e){renderError(e)}finally{setLoading(false)}
  sb.auth.onAuthStateChange((_event,session)=>{APP.session=session;if(!session)location.reload()});
}

function renderShell(){document.getElementById('app').innerHTML='<div class="shell"><header class="topbar" id="topbar"></header><nav class="nav hide" id="nav"></nav><main id="main"></main></div>'}
function renderSetup(){document.getElementById('main').innerHTML='<section class="center-card card"><div class="eyebrow">Feminine Strength Co.</div><div class="title">Platform setup</div><p class="sub">Add your existing public anon/publishable key to <code>config.js</code> to connect this template to Supabase.</p><div class="notice">Never put a service-role or secret key in this app.</div></section>'}
