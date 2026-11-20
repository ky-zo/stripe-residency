import './play.css';
import {bindThumbstick} from './play-controls.js';
import { residents } from './residents.js';
import { icon, renderIcons } from './icons.js';
import { toggleSound } from './ambience.js';
import { createRoom } from './room.js';
import { createPartyUI } from './party-ui.js';
import { getFocus, beginFocus, toggleFocus, endFocus } from './focus.js';
import {createMemberEditor,paintMember} from './member-ui.js';
import {memberHandle,appearanceKey} from '../shared/members.js';
import photoSources from '../photo-sources.json';

const $=id=>document.getElementById(id);
renderIcons();
const byHandle=new Map(residents.map(r=>[r.handle,r]));
const members=new Map(),memberCards=new Map();
const cardObserver=new IntersectionObserver(entries=>{
  for(const entry of entries)if(entry.isIntersecting){
    const card=entry.target,r=members.get(card.dataset.handle);
    if(r)paintMember(card.querySelector('img'),r.appearance);
    cardObserver.unobserve(card);
  }
},{rootMargin:'120px'});
let directoryVersion=0,activity=null;
const islandActivities={
  josefbuettgen:'Josef swims laps in the cove beside the wooden jetty.',
  odd_joel:'IndiJo stretches out on the terracotta-striped sunbed.',
  neilhanyd:'Neil has a book open on the sun deck.',
  ann_nnng:'Ann is at her laptop by the warung.',
  dannypostma:'Danny stops along his walk to photograph the island.',
  sandrokratz:'Sandro takes stretch breaks on the mat.'
};
const list=$('resident-list'),profile=$('profile-dialog'),help=$('help-dialog');
const postcard=$('postcard'),play=$('play-space'),host=$('world-host');
const portraitUrl=h=>'/portraits/'+h+'.webp';
const motion=matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth';
let world,worldTask,inWorld=false,sitting=false,entryRevision=0,noticeTimer;
let party,ballNear=false,pickerOpen=false,restoreSeat=false,worldReady=false,pendingFind=null;
let activeResident,modelDispose=null,artRevision=0,downloading=false,lastTrigger=null;

const room=createRoom({
  state(state,welcome){
    if(state.status==='online'){directoryVersion++;renderMembers(state.members);}
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
const memberEditor=createMemberEditor({
  async onSave(details){await room.saveMember(details);if(!inWorld)await enterWorld(null,true);},
  async onRemove(){await room.removeMember();if(!inWorld){await fetchDirectory();room.close();}},
  onToggle(open){syncBlock();if(!open&&inWorld)host.focus({preventScroll:true});}
});
function openMember(){memberEditor.open(room.myMember());}
function showActivities(){if(!help.open)help.showModal();syncBlock();}
function syncBlock(){world?.setBlocked(profile.open||help.open||pickerOpen||memberEditor.isOpen());}
$('join-member').addEventListener('click',openMember);
function updateParty(){party?.render({...room.get(),nearBall:ballNear,seated:sitting});if(inWorld)paintPresence();}
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
  onInvite:copyInvite,onKick:()=>world?.kick(),onMember:openMember,onActivities:showActivities,paintAvatar:paintMember,
  onPicker(open){pickerOpen=open;syncBlock();if(!open&&inWorld&&!memberEditor.isOpen())host.focus({preventScroll:true});}});
updateParty();
new ResizeObserver(([bar])=>play.style.setProperty('--action-height',Math.ceil(bar.contentRect.height)+'px')).observe(play.querySelector('.party-controls'));
function updateProfileClaim(){
  if(!activeResident)return;
  const state=room.get(),owner=state.claims[activeResident.handle];
  const mine=Boolean(owner)&&owner===state.ownId,used=Boolean(owner)&&!mine;
  const b=$('claim-profile');
  if(activeResident.custom){
    const isOwn=room.myMember()?.id===activeResident.id;
    b.hidden=!isOwn;b.disabled=false;b.textContent='Edit your member';
    $('find-resident').hidden=isOwn;
    return;
  }
  b.hidden=false;
  b.disabled=used || (inWorld&&state.status!=='online');
  b.innerHTML=icon('walk')+(mine?'Release character':used?'Already claimed':'Play as '+activeResident.shortName);
  $('find-resident').hidden=mine;
}
let requestedClaim=null;
function playAsResident(){
  const r=activeResident;
  if(!r)return;
  if(r.custom){dismiss(profile);openMember();return;}
  if(room.get().claims[r.handle]===room.get().ownId&&room.get().ownId){room.trigger('release');return;}
  lastTrigger=null;dismiss(profile);
  if(inWorld){room.trigger('claim',{handle:r.handle});host.focus({preventScroll:true});}
  else{requestedClaim=r.handle;enterWorld(null,true);}
}
$('claim-profile').addEventListener('click',playAsResident);

function renderClock(){
  $('clock').textContent=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Makassar',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date())+' WITA';
}
renderClock();setInterval(renderClock,15000);
function addCard(r,i){
  const card=document.createElement('button');
  card.className='resident';card.type='button';card.setAttribute('aria-label','Meet '+r.name);card.dataset.handle=r.handle;
  const tile=document.createElement('span');tile.className='portrait-tile';
  const photo=new Image(544,544);photo.alt='';photo.loading=i<8?'eager':'lazy';photo.decoding='async';
  if(r.custom)cardObserver.observe(card);else photo.src=portraitUrl(r.handle);
  const name=document.createElement('span');name.className='resident-name';name.textContent=r.name;card.dataset.short=r.shortName||r.name;
  const role=document.createElement('span');role.className='resident-role';role.textContent=r.role;
  tile.append(photo);card.append(tile,name,role);card.addEventListener('click',()=>openProfile(r.handle,card));list.append(card);
  return {card,photo,name};
}
residents.forEach(addCard);
function renderMembers(directory){
  const seen=new Set();
  for(const entry of directory||[]){
    const h=memberHandle(entry.id),r={...entry,handle:h,custom:true,shortName:entry.name,role:'Island member'};
    seen.add(h);
    const previous=members.get(h);members.set(h,r);
    if(!previous){memberCards.set(h,addCard(r,residents.length+memberCards.size));}
    else{
      const {card,name}=memberCards.get(h);
      if(previous.name!==r.name){name.textContent=r.name;card.setAttribute('aria-label','Meet '+r.name);}
      if(appearanceKey(previous.appearance)!==appearanceKey(r.appearance))cardObserver.observe(card);
      if(profile.open&&activeResident?.handle===h&&JSON.stringify(previous)!==JSON.stringify(r))openProfile(h,lastTrigger);
    }
  }
  for(const h of members.keys())if(!seen.has(h)){
    if(profile.open&&activeResident?.handle===h)dismiss(profile);
    const card=memberCards.get(h).card;cardObserver.unobserve(card);card.remove();memberCards.delete(h);members.delete(h);
  }
  const join=$('join-member');join.firstChild.textContent=room.myMember()?'Edit your member ':'Join as yourself ';
  expandRoster(list.classList.contains('expanded'));
}
async function fetchDirectory(){
  const version=directoryVersion;
  try{
    const response=await fetch('/api/members',{cache:'no-store'});
    if(response.ok){const data=await response.json();if(version===directoryVersion)renderMembers(data.members);}
  }catch{/* Live room snapshots also carry the directory. */}
}
let hudFolded=false,gameFullscreen=false,originalScroll=0;
const roster=$('residents'),prevButton=roster.querySelector('.hud-prev'),nextButton=roster.querySelector('.hud-next');
const guestsOnHud=new Map();
function paintPresence(){
  const state=room.get(),online=new Set(),guests=new Set();
  const atStart=list.scrollLeft<3;let changed=false;
  for(const p of state.players){
    const handle=p.handle||(p.memberId?memberHandle(p.memberId):null);
    if(handle){online.add(handle);continue;}
    guests.add(p.id);
    if(guestsOnHud.has(p.id))continue;
    const mine=p.id===state.ownId,name=mine?'You':'Guest';
    const chip=document.createElement('button');chip.type='button';chip.className='resident hud-guest';
    chip.dataset.short=name;chip.dataset.present='true';chip.title=mine?'Your visitor':'Find this visitor';
    chip.setAttribute('aria-label',chip.title);chip.disabled=mine;
    const portrait=document.createElement('span');portrait.className='portrait-tile guest-tile';
    portrait.style.setProperty('--visitor-colour',p.color);portrait.innerHTML=icon('walk');
    chip.append(portrait);chip.addEventListener('click',()=>{world?.findGuest(p.id);host.focus({preventScroll:true});});
    list.append(chip);guestsOnHud.set(p.id,chip);changed=true;
  }
  for(const [id,chip] of guestsOnHud)if(!guests.has(id)){chip.remove();guestsOnHud.delete(id);changed=true;}
  for(const card of list.querySelectorAll('[data-handle]')){
    const value=String(online.has(card.dataset.handle));
    if(card.dataset.present!==value){card.dataset.present=value;changed=true;}
  }
  if(changed&&atStart)requestAnimationFrame(()=>{if(inWorld)list.scrollLeft=0;});
}
function syncRail(){
  const visible=inWorld&&!hudFolded;
  prevButton.hidden=nextButton.hidden=!visible;
  prevButton.disabled=list.scrollLeft<=2;
  nextButton.disabled=list.scrollLeft+list.clientWidth>=list.scrollWidth-2;
}
list.addEventListener('scroll',syncRail,{passive:true});
new ResizeObserver(syncRail).observe(list);
list.addEventListener('wheel',e=>{
  if(!inWorld||e.ctrlKey||Math.abs(e.deltaX)>=Math.abs(e.deltaY))return;
  list.scrollLeft+=e.deltaY;e.preventDefault();
},{passive:false});
for(const [button,sign] of [[prevButton,-1],[nextButton,1]])button.addEventListener('click',()=>list.scrollBy({left:sign*Math.max(110,list.clientWidth*.78),behavior:motion}));
function expandRoster(expanded) {
  const button=$('all');
  if(inWorld){
    roster.classList.toggle('folded',hudFolded);
    button.setAttribute('aria-expanded',String(!hudFolded));
    button.setAttribute('aria-label',hudFolded?'Show residents':'Hide residents');
    button.title=hudFolded?'Show residents':'Hide residents';
    button.innerHTML=icon('grid')+'<span>Residents</span>';
  }else{
    roster.classList.remove('folded');list.classList.toggle('expanded',expanded);
    button.setAttribute('aria-expanded',String(expanded));button.removeAttribute('aria-label');button.removeAttribute('title');
    const label=expanded?'Show less':'View all '+(residents.length+members.size);
    button.innerHTML=icon(expanded?'row':'grid')+'<span>'+label+'</span>';
  }
  syncRail();
}
$('all').addEventListener('click',()=>{
  if(inWorld){hudFolded=!hudFolded;expandRoster(false);return;}
  const expand=!list.classList.contains('expanded');expandRoster(expand);if(!expand)list.scrollLeft=0;else fetchDirectory();
});
renderMembers([]);fetchDirectory();
function activeNav(which){$('nav-island').classList.toggle('active',which==='island');$('nav-residents').classList.toggle('active',which==='residents');}
$('nav-residents').addEventListener('click',()=>{expandRoster(true);activeNav('residents');if(!inWorld)fetchDirectory();});
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
  const r=byHandle.get(handle)||members.get(handle);
  if(!r)return;
  activeResident=r;lastTrigger=trigger;portraitView();$('claim-status').hidden=true;updateProfileClaim();
  const img=$('profile-image');
  img.removeAttribute('data-look');
  if(r.custom){img.removeAttribute('src');paintMember(img,r.appearance);}
  else img.src=portraitUrl(r.handle);
  img.alt=r.custom?'Clay figure of '+r.name:'Clay portrait of '+r.name+' with a '+r.prop.toLowerCase()+'.';
  $('resident-role').textContent=r.role;$('resident-name').textContent=r.name;
  const user=$('resident-handle'),source=$('resident-source'),bio=$('resident-bio');
  $('resident-links').hidden=source.hidden=$('resident-prop').closest('.keepsake').hidden=Boolean(r.custom);
  if(!r.custom){user.href=r.profile;user.textContent='@'+r.handle;source.href=r.source;source.setAttribute('aria-label','Source for '+r.name+'’s field note');$('resident-prop').textContent=r.prop;}
  if(!r.custom)$('resident-photo').href=photoSources[r.handle];
  bio.textContent=r.custom?r.note:r.bio;bio.hidden=!bio.textContent;
  const detail=$('resident-activity');detail.textContent=islandActivities[r.handle]||'';detail.hidden=!detail.textContent;
  $('profile-art').style.backgroundColor=r.custom?'#e6e8db':r.backdrop;
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
    $('model-host').hidden=false;modelDispose=showModel($('model-host'),r.handle,r.appearance,r.backdrop);
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
  try{const r=activeResident;const {downloadFigure}=await import('./gallery3d.js');await downloadFigure(r.handle,r.appearance);}
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
  clearModel();syncBlock();if(memberEditor.isOpen())return;const target=lastTrigger;lastTrigger=null;
  if(target?.isConnected)target.focus({preventScroll:true});else if(inWorld)host.focus({preventScroll:true});
});
help.addEventListener('close',()=>{syncBlock();if(inWorld)host.focus({preventScroll:true});});
$('help').addEventListener('click',showActivities);
$('activity-list').addEventListener('click',e=>{
  const id=e.target.closest('[data-activity]')?.dataset.activity;
  if(!id)return;help.close();syncBlock();
  if(id==='desk')world?.takeSeat();else world?.takeActivity(id);
});

function notice(message,delay=2300){
  const element=$('world-status');clearTimeout(noticeTimer);element.textContent=message;element.hidden=false;
  noticeTimer=setTimeout(()=>{element.hidden=true;},delay);
}
function nearby(item) {
  const b=$('interact');
  b.hidden=item?.type!=='resident'&&item?.type!=='activity';
  if(b.hidden)return;
  b.innerHTML=icon(item.type==='resident'?'chat':'sun');
  b.append(document.createTextNode(item.type==='resident'?'Meet '+item.resident.shortName:({swim:'Take a dip',lounge:'Lounge here',ride:'Ride motorbike',climb:'Climb palm'})[item.id]));
}
const clearStick=bindThumbstick($('thumbstick'),(right,forward)=>world?.setStick(right,forward));
$('jump').addEventListener('click',()=>{world?.jump();host.focus({preventScroll:true});});
function updateFocus(){
  updateParty();const focus=getFocus();
  $('focus-panel').hidden=!sitting||!focus;$('world-bottom').hidden=sitting&&Boolean(focus);
  const exits={swim:'Back to shore',lounge:'Get up',climb:'Climb down',ride:'Park motorbike'};
  const label=exits[activity]||(focus?'Return to work':'Take a seat');
  play.dataset.activity=activity||'walk';
  $('jump').hidden=Boolean(sitting||activity);
  $('thumbstick').hidden=Boolean(sitting||activity==='lounge');
  document.querySelector('.move-hint span').textContent=({swim:'Tap water to swim · Drag to look',ride:'W / S to drive · A / D to steer',climb:'Up to climb · Down to descend',lounge:'Resting on the sunbed'})[activity]||'Tap to walk · Drag to look';
  $('seat').innerHTML=icon(activity?'walk':'coffee')+label;
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
  onActivity(value){activity=value;updateFocus();},
  onSit(){sitting=true;if(!getFocus())beginFocus();updateFocus();$('world-status').hidden=true;},
  onLeaveSeat(){sitting=false;if(getFocus()?.state==='running')toggleFocus();updateFocus();}
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
  if(!inWorld){
    originalScroll=window.scrollY;hudFolded=false;document.body.classList.add('playing');
    if(navigator.userActivation?.isActive&&document.fullscreenEnabled&&!document.fullscreenElement){
      document.documentElement.requestFullscreen({navigationUI:'hide'}).then(()=>{if(inWorld)gameFullscreen=true;else if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});}).catch(()=>{});
    }
  }
  inWorld=true;worldReady=false;pendingFind=findHandle;postcard.hidden=true;play.hidden=false;activeNav('island');
  restoreSeat=!findHandle&&!claiming&&Boolean(getFocus());room.open();updateParty();expandRoster(false);list.scrollLeft=0;
  window.scrollTo({top:0,behavior:motion});
  if(!world)notice('Opening the courtyard…',30000);
  try{
    const w=await getWorld();
    if(ticket!==entryRevision||!inWorld)return;
    $('world-status').hidden=true;clearTimeout(noticeTimer);
    syncBlock();w.start();worldReady=true;
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
  activity=null;sitting=false;clearStick();postcard.hidden=false;play.hidden=true;clearTimeout(noticeTimer);
  document.body.classList.remove('playing');
  if(gameFullscreen&&document.fullscreenElement)document.exitFullscreen().catch(()=>{});
  gameFullscreen=false;for(const chip of guestsOnHud.values())chip.remove();guestsOnHud.clear();
  expandRoster(list.classList.contains('expanded'));window.scrollTo({top:originalScroll,behavior:'instant'});fetchDirectory();
  $('enter').focus({preventScroll:true});
}
$('enter').addEventListener('click',()=>enterWorld());
$('leave').addEventListener('click',leaveWorld);
$('camera').addEventListener('click',()=>{world?.toggleCamera();host.focus({preventScroll:true});});
$('seat').addEventListener('click',()=>{if(activity)world?.stand();else world?.takeSeat();host.focus({preventScroll:true});});
$('interact').addEventListener('click',()=>world?.interact());
$('find-resident').addEventListener('click',()=>{
  const handle=activeResident.handle;lastTrigger=null;dismiss(profile);
  if(inWorld)world?.find(handle);else enterWorld(handle);
});
$('focus-toggle').addEventListener('click',()=>{toggleFocus();updateFocus();});
$('stand').addEventListener('click',()=>{endFocus();sitting=false;world?.stand();updateFocus();host.focus({preventScroll:true});});
window.addEventListener('pagehide',()=>room.close());
window.addEventListener('pageshow',e=>{if(e.persisted){if(inWorld)room.open();else fetchDirectory();}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!inWorld)fetchDirectory();});
setInterval(()=>{if(sitting)updateFocus();},500);
if(location.hash==='#residents')expandRoster(true);
if(getFocus() && location.hash!=='#residents')enterWorld();
