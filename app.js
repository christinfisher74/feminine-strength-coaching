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
function todayView(){
  const name=APP.client.preferred_name||APP.client.first_name||'there';
  const workout=APP.workouts.filter(w=>w.scheduled_date===today());
  const latest=APP.progressEntries[0];
  const checkin=APP.todayCheckin;
  return `
    <section class="welcome">
      <div class="eyebrow">${esc(fmtLong(today()))}</div>
      <h1>Good morning, ${esc(name)}.</h1>
      <p>Your progress is built through the things you do consistently. Let's focus on today.</p>
    </section>
    <section class="stats-grid">
      <article class="stat-card"><div class="stat-label">Today's workouts</div><div class="stat-value">${workout.length}</div><div class="stat-foot">Scheduled for today</div></article>
      <article class="stat-card"><div class="stat-label">Progress entries</div><div class="stat-value">${APP.progressEntries.length}</div><div class="stat-foot">Recorded entries</div></article>
      <article class="stat-card"><div class="stat-label">Movement logs</div><div class="stat-value">${APP.movementLogs.length}</div><div class="stat-foot">Recent activity records</div></article>
    </section>
    <section class="section">
      <div class="section-heading"><div><div class="eyebrow">Your plan</div><h2>Today's training</h2></div><button class="text-btn" data-goto="training">View all</button></div>
      ${workout.length?workout.map(workoutCard).join(''):'<div class="empty card">No workout is scheduled for today. Use today for recovery, movement, or whatever your plan calls for.</div>'}
    </section>
    <section class="section">
      <div class="section-heading"><div><div class="eyebrow">Daily check-in</div><h2>How are you feeling?</h2></div></div>
      ${checkin?`<div class="card checkin-card"><div class="status-pill">Check-in completed</div><p>Your check-in for today has been recorded.</p></div>`:checkinView()}
    </section>
    <section class="section">
      <div class="section-heading"><div><div class="eyebrow">A little perspective</div><h2>Your latest progress</h2></div><button class="text-btn" data-goto="progress">View progress</button></div>
      ${latest?`<div class="card"><div class="stat-label">Latest entry · ${esc(fmtDate(latest.entry_date))}</div><p>${esc(latest.notes||latest.metric_name||'Progress entry recorded.')}</p>${latest.value!=null?`<div class="stat-value">${esc(latest.value)} ${esc(latest.unit||'')}</div>`:''}</div>`:'<div class="empty card">Your progress entries will appear here as you log them.</div>'}
    </section>`;
}

function workoutCard(w){
  const exercises=w.client_workout_exercises||[];
  const done=String(w.status||'').toLowerCase()==='completed';
  return `<article class="workout-card card">
    <div class="workout-card-top"><div><div class="eyebrow">${esc(w.scheduled_date?fmtDate(w.scheduled_date):'Workout')}</div><h3>${esc(w.name||w.title||'Assigned workout')}</h3></div><span class="status-pill ${done?'complete':''}">${done?'Completed':esc(w.status||'Assigned')}</span></div>
    ${w.notes?`<p class="sub">${esc(w.notes)}</p>`:''}
    ${exercises.length?`<div class="exercise-list">${exercises.map((e,i)=>exerciseRow(e,i)).join('')}</div>`:'<p class="sub">Exercise details have not been added yet.</p>'}
    ${w.duration_minutes?`<div class="meta-line">${esc(w.duration_minutes)} minutes</div>`:''}
  </article>`;
}
function exerciseRow(e,i){
  const name=e.exercise_name||e.name||e.exercise?.name||'Exercise';
  return `<div class="exercise-row"><div class="exercise-number">${i+1}</div><div class="exercise-info"><strong>${esc(name)}</strong><div class="exercise-meta">${[e.sets?`${e.sets} sets`:null,e.reps?`${e.reps} reps`:null,e.rest_seconds?`${e.rest_seconds}s rest`:null].filter(Boolean).map(esc).join(' · ')}</div>${e.coaching_cues||e.notes?`<p>${esc(e.coaching_cues||e.notes)}</p>`:''}${e.video_url?`<a href="${esc(e.video_url)}" target="_blank" rel="noopener">Exercise demonstration ↗</a>`:''}</div></div>`;
}
function trainingView(){
  const upcoming=APP.workouts.filter(w=>String(w.status||'').toLowerCase()!=='completed');
  const completed=APP.workouts.filter(w=>String(w.status||'').toLowerCase()==='completed');
  return `<section class="page-intro"><div class="eyebrow">Your programming</div><h1>Training</h1><p>See your assigned workouts and the exercises that make up each session.</p></section>
    <section class="section"><h2>Assigned workouts</h2>${upcoming.length?upcoming.map(workoutCard).join(''):'<div class="empty card">No assigned workouts are showing right now.</div>'}</section>
    <section class="section"><h2>Completed workouts</h2>${completed.length?completed.map(workoutCard).join(''):'<div class="empty card">Completed workouts will appear here when they are marked complete.</div>'}</section>`;
}
function nutritionView(){
  const s=APP.nutritionSettings||{};
  return `<section class="page-intro"><div class="eyebrow">Food & nourishment</div><h1>Nutrition</h1><p>Build consistency with the nutrition habits and targets set for you.</p></section>
    <section class="stats-grid">
      ${s.calorie_target?`<article class="stat-card"><div class="stat-label">Daily calorie target</div><div class="stat-value">${esc(s.calorie_target)}</div></article>`:''}
      ${s.protein_target?`<article class="stat-card"><div class="stat-label">Protein target</div><div class="stat-value">${esc(s.protein_target)}g</div></article>`:''}
      ${s.water_target?`<article class="stat-card"><div class="stat-label">Water target</div><div class="stat-value">${esc(s.water_target)}</div></article>`:''}
    </section>
    <section class="section"><div class="section-heading"><h2>Recent nutrition logs</h2></div>
    ${APP.nutritionLogs.length?APP.nutritionLogs.map(x=>`<article class="log-card card"><div class="eyebrow">${esc(fmtDate(x.log_date))}</div><strong>${esc(x.meal_name||x.meal_type||'Nutrition entry')}</strong><p>${esc(x.description||x.food||x.notes||'Entry recorded')}</p>${x.calories!=null?`<div class="meta-line">${esc(x.calories)} calories</div>`:''}</article>`).join(''):'<div class="empty card">Your nutrition entries will appear here.</div>'}</section>`;
}
function movementView(){
  return `<section class="page-intro"><div class="eyebrow">Daily activity</div><h1>Movement</h1><p>All movement counts. This space keeps your activity history together.</p></section>
    <section class="section"><h2>Recent movement</h2>
    ${APP.movementLogs.length?APP.movementLogs.map(x=>`<article class="log-card card"><div class="eyebrow">${esc(fmtDate(x.log_date))}</div><strong>${esc(x.activity_type||x.activity||'Movement')}</strong><p>${esc(x.notes||x.description||'Activity logged')}</p>${x.duration_minutes?`<div class="meta-line">${esc(x.duration_minutes)} minutes</div>`:''}${x.steps?`<div class="meta-line">${esc(x.steps)} steps</div>`:''}</article>`).join(''):'<div class="empty card">Your movement logs will appear here.</div>'}</section>`;
}
function progressView(){
  return `<section class="page-intro"><div class="eyebrow">Your journey</div><h1>Progress</h1><p>Progress is more than one number. Review the entries you've recorded over time.</p></section>
    <section class="section"><h2>Progress history</h2>
    ${APP.progressEntries.length?APP.progressEntries.map(x=>`<article class="log-card card"><div class="eyebrow">${esc(fmtDate(x.entry_date))}</div><strong>${esc(x.metric_name||x.metric||'Progress entry')}</strong>${x.value!=null?`<div class="stat-value">${esc(x.value)} ${esc(x.unit||'')}</div>`:''}${x.notes?`<p>${esc(x.notes)}</p>`:''}</article>`).join(''):'<div class="empty card">Your progress entries will appear here as they are recorded.</div>'}</section>`;
}
function resourcesView(){
  return `<section class="page-intro"><div class="eyebrow">Your resources</div><h1>Resources</h1><p>Guides, links, and materials shared with you by your coach.</p></section>
    <section class="section">${APP.resources.length?APP.resources.map(r=>`<article class="resource-card card"><strong>${esc(r.title||r.name||'Shared resource')}</strong>${r.description?`<p>${esc(r.description)}</p>`:''}${r.url?`<a href="${esc(r.url)}" target="_blank" rel="noopener">Open resource ↗</a>`:''}${r.file_url?`<a href="${esc(r.file_url)}" target="_blank" rel="noopener">View attachment ↗</a>`:''}</article>`).join(''):'<div class="empty card">Your coach hasn't shared any resources yet.</div>'}</section>`;
}
function checkinView(){
  if(!APP.checkinQuestions.length)return '<div class="empty card">No check-in questions have been assigned yet.</div>';
  return `<form id="checkinForm" class="card form-card"><p class="sub">Take a moment to check in with yourself.</p>${APP.checkinQuestions.map(q=>`<div class="field"><label for="q_${esc(q.field_key)}">${esc(q.question_text||q.label||q.field_key)}</label>${q.response_type==='text'?`<textarea class="input" id="q_${esc(q.field_key)}" name="${esc(q.field_key)}"></textarea>`:q.response_type==='number'?`<input class="input" type="number" id="q_${esc(q.field_key)}" name="${esc(q.field_key)}">`:`<select class="input" id="q_${esc(q.field_key)}" name="${esc(q.field_key)}"><option value="">Choose one</option>${(q.options||['Low','Moderate','Good','High']).map(o=>`<option>${esc(o)}</option>`).join('')}</select>`}</div>`).join('')}<button class="btn" type="submit">Submit check-in</button></form>`;
}
function bindClientEvents(){
  document.querySelectorAll('[data-goto]').forEach(b=>b.onclick=()=>{APP.activeTab=b.dataset.goto;renderClientView()});
  const form=document.getElementById('checkinForm');if(form)form.onsubmit=submitCheckin;
}
async function submitCheckin(e){
  e.preventDefault();const form=e.currentTarget;const values=Object.fromEntries(new FormData(form).entries());
  try{
    const {data,error}=await sb.from('checkins').insert({client_id:APP.client.id,checkin_date:today()}).select().single();if(error)throw error;
    const responses=APP.checkinQuestions.filter(q=>values[q.field_key]!==''&&values[q.field_key]!=null).map(q=>({checkin_id:data.id,question_id:q.id,response:values[q.field_key]}));
    if(responses.length){const result=await sb.from('checkin_responses').insert(responses);if(result.error)throw result.error}
    toast('Check-in submitted');await loadClientData(APP.client.id);renderClientView();
  }catch(err){errorToast(err.message||'Could not submit check-in')}
}
function renderCoachHub(){
  APP.mode='coach';
  renderTopbar('Coach Hub');
  document.getElementById('nav').classList.add('hide');
  document.getElementById('main').innerHTML=`
    <section class="page-intro">
      <div class="eyebrow">Feminine Strength Co.</div>
      <h1>Your coaching dashboard</h1>
      <p>Your client roster, programming, and coaching notes in one place.</p>
    </section>
    <section class="stats-grid">
      <article class="stat-card"><div class="stat-label">Active clients</div><div class="stat-value">${APP.coachClients.length}</div></article>
      <article class="stat-card"><div class="stat-label">Exercise library</div><div class="stat-value">${APP.exercises.length}</div></article>
      <article class="stat-card"><div class="stat-label">Workout templates</div><div class="stat-value">${APP.templates.length}</div></article>
    </section>
    <section class="section">
      <div class="section-heading"><div><div class="eyebrow">Your roster</div><h2>Clients</h2></div></div>
      <div class="client-grid">
        ${APP.coachClients.length?APP.coachClients.map(c=>`
          <button class="client-card card" data-client="${esc(c.id)}">
            <span class="avatar">${esc(initials((c.preferred_name||c.first_name||'')+' '+(c.last_name||'')))}</span>
            <span class="client-card-info"><strong>${esc([c.preferred_name||c.first_name,c.last_name].filter(Boolean).join(' ')||'Client')}</strong><small>${esc(c.email||'Client profile')}</small></span>
            <span class="client-arrow">›</span>
          </button>`).join(''):'<div class="empty card">No clients are assigned to your coach account yet. Check the existing client and coach assignment records in Supabase.</div>'}
      </div>
    </section>
    <section id="coachDetail"></section>`;
  document.querySelectorAll('[data-client]').forEach(b=>b.onclick=()=>openCoachClient(b.dataset.client));
}

async function openCoachClient(clientId){
  const detail=document.getElementById('coachDetail');
  if(detail)detail.innerHTML='<div class="card">Loading client information…</div>';
  try{await loadCoachClient(clientId);renderSelectedCoachClient()}
  catch(e){errorToast(e.message||'Could not load client')}
}

function renderSelectedCoachClient(){
  const c=APP.selectedClient;if(!c)return;
  const name=[c.preferred_name||c.first_name,c.last_name].filter(Boolean).join(' ')||'Client';
  const workouts=APP.workouts||[];
  const assigned=workouts.filter(w=>String(w.status||'').toLowerCase()!=='completed');
  const completed=workouts.filter(w=>String(w.status||'').toLowerCase()==='completed');
  const detail=document.getElementById('coachDetail');
  if(!detail)return;
  detail.innerHTML=`
    <section class="section client-detail">
      <div class="section-heading">
        <div><div class="eyebrow">Selected client</div><h2>${esc(name)}</h2><p class="sub">${esc(c.email||'')}</p></div>
        <button class="btn ghost" id="backRoster">Back to roster</button>
      </div>
      <div class="stats-grid">
        <article class="stat-card"><div class="stat-label">Assigned workouts</div><div class="stat-value">${assigned.length}</div></article>
        <article class="stat-card"><div class="stat-label">Completed workouts</div><div class="stat-value">${completed.length}</div></article>
        <article class="stat-card"><div class="stat-label">Progress entries</div><div class="stat-value">${APP.progressEntries.length}</div></article>
      </div>
      <div class="detail-grid">
        <section class="card">
          <div class="eyebrow">Client profile</div><h3>Client information</h3>
          <div class="detail-list">
            ${c.email?`<div><small>Email</small><strong>${esc(c.email)}</strong></div>`:''}
            ${c.phone?`<div><small>Phone</small><strong>${esc(c.phone)}</strong></div>`:''}
            ${c.goals?`<div><small>Goals</small><strong>${esc(c.goals)}</strong></div>`:''}
            ${c.notes?`<div><small>Profile notes</small><p>${esc(c.notes)}</p></div>`:''}
          </div>
        </section>
        <section class="card">
          <div class="eyebrow">Coaching tools</div><h3>Coach notes</h3>
          <form id="coachNoteForm" class="grid">
            <div class="field"><label for="coachNote">Add a private note</label><textarea class="input" id="coachNote" rows="4" placeholder="Session observations, programming decisions, follow-up…"></textarea></div>
            <button class="btn" type="submit">Save private note</button>
          </form>
          <div class="notes-list">${APP.notes.length?APP.notes.map(n=>`
            <article class="note-entry">
              <div class="note-meta"><span>${esc(fmtDate((n.created_at||'').slice(0,10)))}</span><span class="status-pill">${n.private_to_coach?'Private':'Client visible'}</span></div>
              <p>${esc(n.note||'')}</p>
            </article>`).join(''):'<p class="sub">No coaching notes yet.</p>'}</div>
        </section>
      </div>
      <section class="section">
        <div class="section-heading"><div><div class="eyebrow">Programming</div><h3>Assigned workouts</h3></div></div>
        ${assigned.length?assigned.map(workoutCard).join(''):'<div class="empty card">No assigned workouts found for this client.</div>'}
      </section>
      <section class="section">
        <div class="section-heading"><div><div class="eyebrow">Training history</div><h3>Completed workouts</h3></div></div>
        ${completed.length?completed.map(workoutCard).join(''):'<div class="empty card">No completed workouts found.</div>'}
      </section>
      <section class="section">
        <div class="section-heading"><div><div class="eyebrow">Client history</div><h3>Recent progress</h3></div></div>
        ${APP.progressEntries.length?APP.progressEntries.slice(0,8).map(x=>`
          <article class="log-card card"><div class="eyebrow">${esc(fmtDate(x.entry_date))}</div><strong>${esc(x.metric_name||x.metric||'Progress entry')}</strong>${x.value!=null?`<div class="stat-value">${esc(x.value)} ${esc(x.unit||'')}</div>`:''}${x.notes?`<p>${esc(x.notes)}</p>`:''}</article>`).join(''):'<div class="empty card">No progress entries recorded yet.</div>'}
      </section>
    </section>`;
  document.getElementById('backRoster').onclick=()=>renderCoachHub();
  document.getElementById('coachNoteForm').onsubmit=saveCoachNote;
}

async function saveCoachNote(e){
  e.preventDefault();
  const field=document.getElementById('coachNote');
  const note=field?.value.trim();
  if(!note){toast('Enter a note first.');return}
  try{
    const {error}=await sb.from('coach_notes').insert({
      client_id:APP.selectedClient.id,
      coach_user_id:APP.session.user.id,
      note,
      private_to_coach:true
    });
    if(error)throw error;
    toast('Private note saved');
    await openCoachClient(APP.selectedClient.id);
  }catch(err){errorToast(err.message||'Could not save note')}
}

async function signOut(){
  if(!sb)return;
  const {error}=await sb.auth.signOut();
  if(error){errorToast(error.message);return}
  location.reload();
}

document.addEventListener('DOMContentLoaded',init);
