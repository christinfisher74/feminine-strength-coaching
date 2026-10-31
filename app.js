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
function renderLogin(){
  document.getElementById('topbar').innerHTML='<div class="topbar-inner"><div><div class="brand">Feminine Strength Co.</div><div class="name">Client Portal</div><div class="role">Your coaching space, all in one place.</div></div></div>';
  document.getElementById('main').innerHTML='<section class="login-wrap"><div class="login-card card"><div class="eyebrow">Secure client access</div><div class="title">Welcome back</div><p class="sub">Sign in to access your personal coaching dashboard.</p><form id="loginForm" class="grid" style="margin-top:18px"><div class="field"><label>Email</label><input class="input" id="email" type="email" autocomplete="email" required></div><div class="field"><label>Password</label><input class="input" id="password" type="password" autocomplete="current-password" required></div><button class="btn" type="submit">Sign in</button><button class="btn ghost" type="button" id="resetPassword">Forgot password?</button></form><div id="loginMsg" class="sub" style="margin-top:12px"></div></div></section>';
  document.getElementById('loginForm').onsubmit=async e=>{e.preventDefault();const msg=document.getElementById('loginMsg');msg.textContent='Signing in…';const {error}=await sb.auth.signInWithPassword({email:document.getElementById('email').value.trim(),password:document.getElementById('password').value});if(error){msg.textContent=error.message;return}location.reload()};
  document.getElementById('resetPassword').onclick=async()=>{const email=document.getElementById('email').value.trim();const msg=document.getElementById('loginMsg');if(!email){msg.textContent='Enter your email first.';return}const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});msg.textContent=error?'Could not send reset email.': 'Password reset email sent.'};
}
function renderNoClient(){renderTopbar('Client setup');document.getElementById('main').innerHTML='<section class="center-card card"><div class="eyebrow">Account connected</div><div class="title">Your client profile is not assigned yet.</div><p class="sub">Your login works, but there is not yet a Feminine Strength Co. client record connected to this account. Christin needs to finish your setup in Coach Hub.</p><button class="btn" id="signOut">Sign out</button></section>';document.getElementById('signOut').onclick=signOut}
function renderError(e){renderTopbar('Connection issue');document.getElementById('main').innerHTML='<section class="center-card card"><div class="eyebrow">Feminine Strength Co.</div><div class="title">We could not load your portal.</div><p class="sub">'+esc(e?.message||'Unknown error')+'</p><button class="btn" onclick="location.reload()">Try again</button></section>'}

function renderTopbar(name){
  document.getElementById('topbar').innerHTML='<div class="topbar-inner"><div><div class="brand">Feminine Strength Co.</div><div class="name" id="headerName">'+esc(name)+'</div><div class="role">Coaching platform</div></div><div class="top-actions"><button class="mode-btn '+(APP.mode==='client'?'active':'')+'" data-mode="client">Client</button>'+(isCoach()?'<button class="mode-btn '+(APP.mode==='coach'?'active':'')+'" data-mode="coach">Coach Hub</button>':'')+'<button class="icon-btn" id="logout" title="Sign out">↪</button></div></div>';
  document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>switchMode(b.dataset.mode));document.getElementById('logout').onclick=signOut;
}
function renderNav(){const nav=document.getElementById('nav');nav.classList.remove('hide');nav.innerHTML=['today','training','nutrition','movement','progress','resources'].map(x=>'<button class="'+(APP.activeTab===x?'active':'')+'" data-tab="'+x+'">'+label(x)+'</button>').join('');nav.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{APP.activeTab=b.dataset.tab;renderClientView()})}
function renderClient(){APP.mode='client';renderClientView()}
function renderClientView(){renderTopbar('Hey, '+(APP.client.preferred_name||APP.client.first_name));renderNav();document.getElementById('main').innerHTML=clientView(APP.activeTab);bindClientEvents()}
function switchMode(mode){APP.mode=mode;if(mode==='coach'){renderCoachHub();return}APP.selectedClient=null;APP.activeTab='today';loadClientData(APP.client.id).then(renderClient).catch(renderError)}

async function loadIdentity(){const {data,error}=await sb.from('profiles').select('*').eq('id',APP.session.user.id).maybeSingle();if(error)throw error;APP.profile=data}
async function loadClient(userId){const {data,error}=await sb.from('clients').select('*').eq('user_id',userId).maybeSingle();if(error)throw error;APP.client=data}
async function loadClientData(clientId){
  const [w,r,ns,n,m,p,notes,cq,qs]=await Promise.all([
    sb.from('client_workouts').select('*, client_workout_exercises(*)').eq('client_id',clientId).order('scheduled_date',{ascending:true,nullsFirst:false}).order('created_at',{ascending:false}),
    sb.from('client_resources').select('*').eq('client_id',clientId).order('created_at',{ascending:false}),
    sb.from('nutrition_settings').select('*').eq('client_id',clientId).maybeSingle(),
    sb.from('nutrition_logs').select('*').eq('client_id',clientId).order('log_date',{ascending:false}).order('created_at',{ascending:false}).limit(100),
    sb.from('movement_logs').select('*').eq('client_id',clientId).order('log_date',{ascending:false}).limit(100),
    sb.from('progress_entries').select('*').eq('client_id',clientId).order('entry_date',{ascending:false}).limit(100),
    sb.from('coach_notes').select('*').eq('client_id',clientId).eq('private_to_coach',false).order('created_at',{ascending:false}),
    sb.from('checkins').select('*').eq('client_id',clientId).eq('checkin_date',today()).maybeSingle(),
    sb.from('client_checkin_questions').select('*, checkin_questions(*)').eq('client_id',clientId).eq('active',true).order('sort_order')
  ]);
  for(const x of [w,r,ns,n,m,p,notes,cq,qs])if(x.error)throw x.error;
  APP.workouts=w.data||[];APP.resources=r.data||[];APP.nutritionSettings=ns.data;APP.nutritionLogs=n.data||[];APP.movementLogs=m.data||[];APP.progressEntries=p.data||[];APP.notes=notes.data||[];APP.todayCheckin=cq.data;APP.checkinQuestions=(qs.data||[]).map(x=>x.checkin_questions).filter(Boolean);
  if(APP.todayCheckin){const {data,error}=await sb.from('checkin_responses').select('*').eq('checkin_id',APP.todayCheckin.id);if(error)throw error;APP.todayCheckin.responses={};(data||[]).forEach(r=>{const q=APP.checkinQuestions.find(x=>x.id===r.question_id);if(q)APP.todayCheckin.responses[q.field_key]=r.response})}
}
async function loadCoachHub(){
  const {data,error}=await sb.from('coach_clients').select('client_id, clients(*)').eq('coach_user_id',APP.session.user.id).order('created_at');if(error)throw error;APP.coachClients=(data||[]).map(x=>x.clients).filter(Boolean);
  const ex=await sb.from('exercises').select('*').order('name');if(ex.error)throw ex.error;APP.exercises=ex.data||[];
  const tp=await sb.from('workout_templates').select('*').eq('created_by',APP.session.user.id).order('name');if(tp.error)throw tp.error;APP.templates=tp.data||[];
}
async function loadCoachClient(clientId){const c=await sb.from('clients').select('*').eq('id',clientId).single();if(c.error)throw c.error;APP.selectedClient=c.data;await loadClientData(clientId);const notes=await sb.from('coach_notes').select('*').eq('client_id',clientId).order('created_at',{ascending:false});if(notes.error)throw notes.error;APP.notes=notes.data||[]}

function clientView(tab){switch(tab){case'training':return trainingView();case'nutrition':return nutritionView();case'movement':return movementView();case'progress':return progressView();case'resources':return resourcesView();default:return todayView()}}
