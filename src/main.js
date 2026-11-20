import { residents } from './residents.js';
import { icon, renderIcons } from './icons.js';
import { toggleSound } from './ambience.js';
import { createRoom } from './room.js';
import { createPartyUI } from './party-ui.js';
import { getFocus, beginFocus, toggleFocus, endFocus } from './focus.js';

const $=id=>document.getElementById(id);
renderIcons();
const byHandle=new Map(residents.map(r=>[r.handle,r]));
const list=$('resident-list'),profile=$('profile-dialog'),help=$('help-dialog');
const postcard=$('postcard'),play=$('play-space'),host=$('world-host');
const portraitUrl=h=>'/portraits/'+h+'.webp';
const motion=matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth';
let world,worldTask,inWorld=false,sitting=false,entryRevision=0,noticeTimer;
let party,ballNear=false,pickerOpen=false,restoreSeat=false,worldReady=false,pendingFind=null;
let activeResident,modelDispose=null,artRevision=0,downloading=false,lastTrigger=null;

const room=createRoom({
  state(state,welcome){
    if(worldReady)world.applyRoom(state,welcome);
    updateParty();updateProfileClaim();
    if(welcome)finishEntry();
  },
  wave(m){world?.wave(m);},ball(b){world?.setBall(b);},correct(p){world?.correct(p);},
  error(m){
    world?.clearRequest();notice(m.text||'The room is reconnecting.',3200);
    if(profile.open){const status=$('claim-status');status.textContent=m.text;status.hidden=false;}
  }
});
function updateParty(){party?.render({...room.get(),nearBall:ballNear,seated:sitting});}
function finishEntry(){
  if(!worldReady||!inWorld||room.get().status!=='online')return;
  if(requestedClaim){const h=requestedClaim;requestedClaim=null;room.trigger('claim',{handle:h});}
  else if(pendingFind){const h=pendingFind;pendingFind=null;world.find(h);}
  else if(restoreSeat&&getFocus()&&!sitting)world.takeSeat(null,true);
  restoreSeat=false;
}
let invitationUrl=location.pathname.startsWith('/join/')?location.origin+location.pathname:null;
async function copyInvite(){
  if(!invitationUrl){
    const response=await fetch('/api/invite',{cache:'no-store'});
    if(!response.ok)throw new Error('Invitation unavailable');
    const data=await response.json();invitationUrl=new URL(data.path,location.href).href;
  }
  const url=invitationUrl;
  try{await navigator.clipboard.writeText(url);return {url,copied:true};}catch{return {url,copied:false};}
}
party=createPartyUI({residents,onClaim:handle=>room.trigger('claim',{handle}),onRelease:()=>room.trigger('release'),onWave:()=>room.trigger('wave'),
  onInvite:copyInvite,onKick:()=>world?.kick(),onPicker(open){pickerOpen=open;world?.setBlocked(open||profile.open||help.open);if(!open&&inWorld)host.focus({preventScroll:true});}});
updateParty();
function updateProfileClaim(){
  if(!activeResident)return;
  const state=room.get(),owner=state.claims[activeResident.handle];
  const mine=Boolean(owner)&&owner===state.ownId,used=Boolean(owner)&&!mine;
  const b=$('claim-profile');
  b.disabled=used || (inWorld&&state.status!=='online');
  b.innerHTML=icon('walk')+(mine?'Release character':used?'Already claimed':'Play as '+activeResident.shortName);
  $('find-resident').hidden=mine;
}
let requestedClaim=null;
function playAsResident(){
  const r=activeResident;
  if(!r)return;
  if(room.get().claims[r.handle]===room.get().ownId&&room.get().ownId){room.trigger('release');return;}
  requestedClaim=r.handle;lastTrigger=null;dismiss(profile);
  enterWorld(null,true);
}
$('claim-profile').addEventListener('click',playAsResident);

function renderClock(){
  $('clock').textContent=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Makassar',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date())+' WITA';
}
renderClock();setInterval(renderClock,15000);
for(const [i,r] of residents.entries()){
  const card=document.createElement('button');
  card.className='resident';card.type='button';card.setAttribute('aria-label','Meet '+r.name);card.dataset.handle=r.handle;
  const tile=document.createElement('span');tile.className='portrait-tile';
  const photo=new Image(544,544);photo.src=portraitUrl(r.handle);photo.alt='';photo.loading=i<8?'eager':'lazy';photo.decoding='async';
  const name=document.createElement('span');name.className='resident-name';name.textContent=r.name;
  const role=document.createElement('span');role.className='resident-role';role.textContent=r.role;
  tile.append(photo);card.append(tile,name,role);card.addEventListener('click',()=>openProfile(r.handle,card));list.append(card);
}
function expandRoster(expanded) {
  list.classList.toggle('expanded',expanded);
  const button=$('all');button.setAttribute('aria-expanded',String(expanded));
  button.innerHTML=icon(expanded?'row':'grid')+'<span>'+(expanded?'Show less':'View all '+residents.length)+'</span>';
  if(!expanded)list.scrollLeft=0;
}
expandRoster(false);
$('all').addEventListener('click',()=>expandRoster(!list.classList.contains('expanded')));
function activeNav(which){$('nav-island').classList.toggle('active',which==='island');$('nav-residents').classList.toggle('active',which==='residents');}
$('nav-residents').addEventListener('click',()=>{expandRoster(true);activeNav('residents');});
$('nav-island').addEventListener('click',()=>{activeNav('island');if(inWorld)leaveWorld();});
document.querySelector('.wordmark').addEventListener('click',()=>{activeNav('island');if(inWorld)leaveWorld();});
window.addEventListener('scroll',()=>{
  const section=$('residents').getBoundingClientRect();
  activeNav(section.top<innerHeight*.36?'residents':'island');
},{passive:true});

$('sound').addEventListener('click',async()=>{
  const b=$('sound');
  try{
    const on=await toggleSound(),label=(on?'Turn off':'Turn on')+' island sounds';
    b.setAttribute('aria-label',label);b.setAttribute('aria-pressed',String(on));b.title=label;b.innerHTML=icon(on?'sound':'mute');
  }catch{b.title='Island audio is unavailable in this browser';b.setAttribute('aria-label',b.title);}
});

function clearModel() {
  artRevision++;
  if(modelDispose){modelDispose();modelDispose=null;}
  $('model-host').hidden=true;$('model-fallback').hidden=true;
}
function portraitView(){
  clearModel();
  $('profile-image').hidden=false;$('download-model').hidden=true;$('download-status').hidden=true;
  $('view-portrait').setAttribute('aria-pressed','true');$('view-model').setAttribute('aria-pressed','false');
}
function openProfile(handle,trigger=null){
  const r=byHandle.get(handle);
  if(!r)return;
  activeResident=r;lastTrigger=trigger;portraitView();$('claim-status').hidden=true;updateProfileClaim();
  const img=$('profile-image');img.src=portraitUrl(r.handle);img.alt='Clay portrait of '+r.name+' with a '+r.prop.toLowerCase()+'.';
  $('resident-role').textContent=r.role;$('resident-name').textContent=r.name;
  const user=$('resident-handle');user.href=r.profile;user.textContent='@'+r.handle;
  $('resident-bio').textContent=r.bio;$('resident-prop').textContent=r.prop;
  $('resident-source').href=r.source;$('resident-source').setAttribute('aria-label','Source for '+r.name+'’s field note');
  $('profile-art').style.backgroundColor=['#e8d4b9','#dae3cc','#eadbb9','#d6e4df','#ead4c8','#dcd8e5'][residents.indexOf(r)%6];
  if(!profile.open)profile.showModal();
  world?.setBlocked(true);
}
$('view-portrait').addEventListener('click',portraitView);
$('view-model').addEventListener('click',async()=>{
  if(!activeResident || $('view-model').getAttribute('aria-pressed')==='true')return;
  clearModel();
  const ticket=artRevision,r=activeResident;
  $('view-portrait').setAttribute('aria-pressed','false');$('view-model').setAttribute('aria-pressed','true');
  $('download-model').hidden=false;
  try{
    const {showModel}=await import('./gallery3d.js');
    if(ticket!==artRevision || !profile.open)return;
    $('model-host').hidden=false;modelDispose=showModel($('model-host'),r.handle);
    $('profile-image').hidden=true;
  }catch{
    if(ticket!==artRevision)return;
    $('model-host').hidden=true;$('profile-image').hidden=false;
    const fallback=$('model-fallback');fallback.textContent='This browser can download the figure for a 3D viewer.';fallback.hidden=false;
  }
});
$('download-model').addEventListener('click',async()=>{
  if(downloading||!activeResident)return;
  downloading=true;const b=$('download-model');b.disabled=true;
  try{const {downloadFigure}=await import('./gallery3d.js');await downloadFigure(activeResident.handle);}
  catch{const s=$('download-status');s.textContent='The download was interrupted. Try again.';s.hidden=false;}
  finally{downloading=false;b.disabled=false;}
});
function dismiss(dialog){if(dialog.open)dialog.close();}
$('close-profile').addEventListener('click',()=>dismiss(profile));
$('close-help').addEventListener('click',()=>dismiss(help));
for(const d of [profile,help]){
  d.addEventListener('click',e=>{
    if(e.target!==d)return;
    const r=d.getBoundingClientRect();
    if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dismiss(d);
  });
}
profile.addEventListener('close',()=>{
  clearModel();world?.setBlocked(help.open||pickerOpen);const target=lastTrigger;lastTrigger=null;
  if(target?.isConnected)target.focus({preventScroll:true});else if(inWorld)host.focus({preventScroll:true});
});
help.addEventListener('close',()=>{world?.setBlocked(profile.open||pickerOpen);host.focus({preventScroll:true});});
$('help').addEventListener('click',()=>{help.showModal();world?.setBlocked(true);});

function notice(message,delay=2300){
  const element=$('world-status');clearTimeout(noticeTimer);element.textContent=message;element.hidden=false;
  noticeTimer=setTimeout(()=>{element.hidden=true;},delay);
}
function nearby(item) {
  const b=$('interact');
  b.hidden=item?.type!=='resident';
  if(item)b.innerHTML=icon(item.type==='resident'?'chat':item.type==='ball'?'sparkle':'coffee')+(item.type==='resident'?'Meet '+item.resident.shortName:item.type==='ball'?'Kick ball':'Sit here');
}
function updateFocus(){
  updateParty();const focus=getFocus();
  $('focus-panel').hidden=!sitting||!focus;$('world-bottom').hidden=sitting&&Boolean(focus);
  $('seat').innerHTML=icon('coffee')+(focus?'Return to work':'Take a seat');
  if(!focus)return;
  $('focus-time').textContent=Math.floor(focus.seconds/60).toString().padStart(2,'0')+':'+(focus.seconds%60).toString().padStart(2,'0');
  $('focus-caption').textContent=focus.state==='finished'?'Session complete':focus.state==='paused'?'Taking a break':'At the worktable';
  $('focus-toggle').textContent=focus.state==='finished'?'Start again':focus.state==='paused'?'Resume':'Pause';
}
function cameraChanged(wide){
  const label=wide?'Follow the visitor':'Switch to a wide view';
  $('camera').title=label;$('camera').setAttribute('aria-label',label);$('camera').setAttribute('aria-pressed',String(wide));
}
const callbacks={
  room,onBallNear(value){ballNear=value;updateParty();},label:$('world-label'),youLabel:$('visitor-label'),onResident:openProfile,onNearby:nearby,notice,onCamera:cameraChanged,
  onSit(){sitting=true;if(!getFocus())beginFocus();updateFocus();$('world-status').hidden=true;},
  onLeaveSeat(){sitting=false;updateFocus();}
};
function getWorld(){
  if(!worldTask){
    worldTask=import('./world.js').then(({createWorld})=>{world=createWorld(host,residents,callbacks);return world;})
      .catch(e=>{worldTask=null;throw e;});
  }
  return worldTask;
}
async function enterWorld(findHandle=null,claiming=false){
  const ticket=++entryRevision;
  inWorld=true;worldReady=false;pendingFind=findHandle;postcard.hidden=true;play.hidden=false;activeNav('island');
  restoreSeat=!findHandle&&!claiming&&Boolean(getFocus());room.open();updateParty();
  window.scrollTo({top:0,behavior:motion});
  if(!world)notice('Opening the courtyard…',30000);
  try{
    const w=await getWorld();
    if(ticket!==entryRevision||!inWorld)return;
    $('world-status').hidden=true;clearTimeout(noticeTimer);
    w.setBlocked(false);w.start();worldReady=true;
    if(room.get().status==='online')w.applyRoom(room.get(),true);
    finishEntry();
    updateFocus();host.focus({preventScroll:true});
  }catch{
    if(ticket!==entryRevision)return;
    $('world-status').hidden=true;
    leaveWorld();
    let note=$('entry-error');
    if(!note){note=document.createElement('p');note.id='entry-error';note.className='entry-error';note.setAttribute('role','status');$('enter').after(note);}
    note.textContent='3D needs WebGL in this browser. The resident portraits and figure downloads are available below.';
  }
}
function leaveWorld(){
  ++entryRevision;inWorld=false;worldReady=false;pendingFind=null;world?.stop();room.close();restoreSeat=false;requestedClaim=null;
  postcard.hidden=false;play.hidden=true;clearTimeout(noticeTimer);
  $('enter').focus({preventScroll:true});
}
$('enter').addEventListener('click',()=>enterWorld());
$('leave').addEventListener('click',leaveWorld);
$('camera').addEventListener('click',()=>{world?.toggleCamera();host.focus({preventScroll:true});});
$('seat').addEventListener('click',()=>{world?.takeSeat();host.focus({preventScroll:true});});
$('interact').addEventListener('click',()=>world?.interact());
$('find-resident').addEventListener('click',()=>{
  const handle=activeResident.handle;lastTrigger=null;dismiss(profile);
  enterWorld(handle);
});
$('focus-toggle').addEventListener('click',()=>{toggleFocus();updateFocus();});
$('stand').addEventListener('click',()=>{endFocus();sitting=false;world?.stand();updateFocus();host.focus({preventScroll:true});});
window.addEventListener('pagehide',()=>room.close());
window.addEventListener('pageshow',e=>{if(e.persisted&&inWorld)room.open();});
setInterval(()=>{if(sitting)updateFocus();},500);
if(location.hash==='#residents')expandRoster(true);
if(getFocus() && location.hash!=='#residents')enterWorld();
