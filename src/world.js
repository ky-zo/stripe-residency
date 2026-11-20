import * as T from 'three';
import { buildEnvironment } from './environment.js';
import { createFigure } from './models.js';
import { createNavigation } from './navigation.js';

import { HOME, npcPose, createBeachBall } from './island-life.js';
import { ballAt, initialBall } from '../shared/ball.js';

const movementKeys=['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'];
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createWorld(host,residents,callbacks) {
  const renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  const mobile=matchMedia('(max-width: 650px)').matches;
  renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.4:1.55));
  renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=T.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate=false;
  renderer.shadowMap.needsUpdate=true;
  host.replaceChildren(renderer.domElement);
  const scene=new T.Scene();
  const camera=new T.PerspectiveCamera(40,1,.1,150);
  const environment=buildEnvironment(T,scene);
  const ray=new T.Raycaster(),pointer=new T.Vector2(),ground=new T.Plane(new T.Vector3(0,1,0),0);
  const hitLayer=new T.Group(), hitObjects=[];
  const hitMaterial=new T.MeshBasicMaterial({visible:false});
  const bodyHit=new T.CylinderGeometry(.51,.51,1.72,10);
  const deskHit=new T.BoxGeometry(2.7,1.16,1.45);
  function addTarget(geometry,x,y,z,item) {
    const mesh=new T.Mesh(geometry,hitMaterial);
    mesh.position.set(x,y,z);mesh.userData.target=item;hitLayer.add(mesh);hitObjects.push(mesh);
  }
  scene.add(hitLayer);
  const residentPositions=[],figures=[],byHandle=new Map(),residentHits=[];
  const peers=new Map(),guests=new Map(),peerLabels=new Map(),waveLabels=new Map(),replyWaves=new Map();
  const room=callbacks.room;
  let ensemble={status:'offline',players:[],claims:{},ownId:null};
  let own=null,ballState=initialBall,localKey='',visitorFigure,ballNear=false;
  for(const [i,resident] of residents.entries()){
    const home=HOME[i],figure=createFigure(T,resident.handle);
    figure.root.position.set(home.x,0,home.z);figure.root.rotation.y=home.yaw;scene.add(figure.root);
    const info={type:'resident',resident,x:home.x,z:home.z,visible:true,index:i};
    byHandle.set(resident.handle,info);residentPositions.push(info);figures.push(figure);
    addTarget(bodyHit,home.x,.86,home.z,info);residentHits.push(hitObjects.at(-1));
  }
  const seats=environment.seats.map(s=>({...s,type:'seat'}));
  const chairHit=new T.CylinderGeometry(.48,.48,.85,10);
  seats.forEach(s=>addTarget(chairHit,s.x,.43,s.z,s));
  seats.filter(s=>s.id<2).forEach(s=>addTarget(deskHit,s.x,.58,s.z-.9,s));
  const ball=createBeachBall(T);scene.add(ball);
  const ballTarget={type:'ball',x:0,z:0,label:'Beach ball'};
  addTarget(new T.SphereGeometry(.48,12,8),0,.38,0,ballTarget);
  const ballHit=hitObjects.at(-1);
  hitLayer.updateMatrixWorld(true);
  // Paths use the island's permanent furniture. Passing residents give one another room.
  const nav=createNavigation(environment.obstacles,[]);
  const avatar=new T.Group();scene.add(avatar);
  avatar.position.set(.08,0,5.25);avatar.rotation.y=-.48;
  function outfit(handle,color){
    const key=(handle||'visitor')+':'+(handle?'':color);
    if(localKey===key)return;
    if(visitorFigure)avatar.remove(visitorFigure.root);
    visitorFigure=createFigure(T,handle||'visitor',{guestColor:color});
    avatar.add(visitorFigure.root);localKey=key;
  }
  outfit(null,'#e58a5f');
  const ring=new T.Mesh(new T.RingGeometry(.43,.48,48),new T.MeshBasicMaterial({color:'#f5cf77',side:T.DoubleSide,depthWrite:false}));
  ring.rotation.x=-Math.PI/2;scene.add(ring);
  const marker=new T.Mesh(new T.RingGeometry(.18,.23,32),new T.MeshBasicMaterial({color:'#42634a',side:T.DoubleSide,depthWrite:false,transparent:true,opacity:.78}));
  marker.rotation.x=-Math.PI/2;marker.position.y=.042;marker.visible=false;scene.add(marker);
  let running=false,blocked=false,frame=0,last=0,elapsed=0,shadowAt=0;
  let route=[],arrival=null,seated=null,nearest=null,hovered=null,spotlit=null,spotlightUntil=0;
  let angle=.105,tilt=.55,wide=!mobile,introView=!mobile,pointerStart=null,width=0,height=0;
  let orbitRadius=0,following=null,repathAt=0,pendingSeat=null;
  const keys=new Set(),cameraFocus=new T.Vector3(0,.57,.4),desired=new T.Vector3(),offset=new T.Vector3();
  const projection=new T.Vector3(),groundHit=new T.Vector3();
  function resize() {
    width=host.clientWidth;height=host.clientHeight;
    if(!width||!height)return;
    camera.aspect=width/height;camera.updateProjectionMatrix();
    renderer.setSize(width,height,false);
  }
  const observer=new ResizeObserver(resize);observer.observe(host);
  function setCamera(dt,snap=false) {
    const p=avatar.position;
    const narrow=camera.aspect<.95;
    const follow=wide?.04:(narrow?.88:.68);
    desired.set(p.x*follow,wide?1.0:.79,p.z*follow+(wide?-.62:-.65));
    const smoothing=snap || reduced?1:1-Math.exp(-dt*3.7);
    cameraFocus.lerp(desired,smoothing);
    const horizontalRadius=wide?Math.max(15.8,12.6/camera.aspect):narrow?8.6:12.15;
    orbitRadius+= (horizontalRadius-orbitRadius)*(snap||!orbitRadius||reduced?1:1-Math.exp(-dt*3.1));
    const radius=orbitRadius/Math.cos(tilt);
    offset.set(Math.sin(angle)*Math.cos(tilt)*radius,Math.sin(tilt)*radius,Math.cos(angle)*Math.cos(tilt)*radius);
    camera.position.copy(cameraFocus).add(offset);camera.lookAt(cameraFocus);camera.updateMatrixWorld();
  }
  function labelAt(el,item,y,visible=true) {
    if(!item||!visible){el.hidden=true;return;}
    projection.set(item.x,y,item.z).project(camera);
    if(projection.z>1||projection.z<0||Math.abs(projection.x)>.98||Math.abs(projection.y)>.97){el.hidden=true;return;}
    el.hidden=false;el.style.left=((projection.x+1)*width*.5)+'px';el.style.top=((1-projection.y)*height*.5)+'px';
  }
  function updateLabels() {
    const p=avatar.position;
    labelAt(callbacks.youLabel,p,1.85,!seated);
    const current=hovered || (elapsed<spotlightUntil?spotlit:null) || (nearest?.type==='resident' && !ensemble.claims[nearest.resident.handle]?nearest:null);
    if(current){
      const text=current.type==='resident'?current.resident.shortName:(current.label||'Guest');
      if(callbacks.label.textContent!==text)callbacks.label.textContent=text;
    }
    labelAt(callbacks.label,current,current?.type==='seat'?1.06:current?.type==='ball'?.87:1.87,!seated && current?.visible!==false);
  }
  function scanNearby() {
    const p=avatar.position;
    let closest=null,dist=1.68;
    if(!seated)for(const point of [...residentPositions,...seats,ballTarget]){
      if(point.visible===false || (point.type==='seat'&&seatOwner(point)))continue;
      const d=distance(p,point);
      if(d<dist){dist=d;closest=point;}
    }
    if(!seated&&spotlit?.visible!==false&&spotlit&&elapsed<spotlightUntil&&distance(spotlit,p)<1.68)closest=spotlit;
    if(closest!==nearest){nearest=closest;callbacks.onNearby(nearest);}
    const close=!seated&&distance(p,ballTarget)<2.32;
    if(close!==ballNear){ballNear=close;callbacks.onBallNear(close);}
  }
  function turn(yaw,dt){
    const now=avatar.rotation.y;
    avatar.rotation.y=now+Math.atan2(Math.sin(yaw-now),Math.cos(yaw-now))*(1-Math.exp(-dt*13));
  }
  function cancelWalk() { route=[];arrival=null;following=null;marker.visible=false; }
  function followCamera(){if(introView){introView=false;wide=false;callbacks.onCamera(false);}}
  function manualVector(){
    const lr=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'));
    const fb=Number(keys.has('s')||keys.has('arrowdown'))-Number(keys.has('w')||keys.has('arrowup'));
    if(!lr&&!fb)return null;
    const len=Math.hypot(lr,fb);
    return {x:(lr*Math.cos(angle)+fb*Math.sin(angle))/len,z:(fb*Math.cos(angle)-lr*Math.sin(angle))/len};
  }
  function move(dt) {
    if(seated || pendingSeat || blocked || (ensemble.status!=='online'&&own))return false;
    const p=avatar.position,manual=manualVector();
    if(manual){
      followCamera();cancelWalk();
      const step=3.65*dt,dx=manual.x*step,dz=manual.z*step;
      const lastX=p.x,lastZ=p.z;
      if(nav.canStand(p.x+dx,p.z))p.x+=dx;
      if(nav.canStand(p.x,p.z+dz))p.z+=dz;
      turn(Math.atan2(manual.x,manual.z),dt);
      return Math.abs(p.x-lastX)+Math.abs(p.z-lastZ)>.001;
    }
    if(following && elapsed>repathAt){
      repathAt=elapsed+.52;
      const target=following,d=distance(p,target);
      if(d<1.23){finishFind(target);return false;}
      const next=approachFor(target,p);
      if(next && (!route.length||distance(next,route.at(-1))>.44)){go(next,()=>finishFind(target),true);following=target;}
    }
    if(!route.length)return false;
    let budget=3.85*dt;
    while(route.length && budget>0){
      const next=route[0],dx=next.x-p.x,dz=next.z-p.z,len=Math.hypot(dx,dz);
      if(len>.02)turn(Math.atan2(dx,dz),dt);
      if(len<=budget){p.x=next.x;p.z=next.z;route.shift();budget-=len;}
      else{p.x+=dx*budget/len;p.z+=dz*budget/len;budget=0;}
    }
    if(!route.length){
      marker.visible=false;
      const done=arrival;arrival=null;done?.();
    }
    return true;
  }
  function go(point,done=null,mark=true) {
    if(seated)return false;
    followCamera();
    const points=nav.path(avatar.position,point);
    if(!points?.length)return false;
    following=null;route=points;arrival=done;const end=points.at(-1);
    marker.visible=mark;marker.position.set(end.x,.042,end.z);
    return true;
  }
  function seatOwner(seat){return ensemble.players.find(p=>p.seat!==null&&String(p.seat)===String(seat.id));}
  function takeSeat(seat,immediate=false) {
    if(seated||pendingSeat)return;
    if(ensemble.status!=='online'){callbacks.notice('Waiting for the shared island');return;}
    const p=avatar.position;
    seat=seat||[...seats].filter(s=>!seatOwner(s)).sort((a,b)=>distance(a,p)-distance(b,p))[0];
    if(!seat||seatOwner(seat)){callbacks.notice('That spot is occupied. Pick another cushion or stool.');return;}
    const request=()=>{
      pendingSeat=seat;
      // Flush the arrival position before asking the room to occupy the seat.
      room.pose(p.x,p.z,avatar.rotation.y,false,true);
      room.trigger('sit',{seat:String(seat.id)});
    };
    const approach={x:seat.x-Math.sin(seat.facing)*.71,z:seat.z-Math.cos(seat.facing)*.71};
    if(immediate&&distance(seat,p)<2.15)request();
    else if(go(approach,request))callbacks.notice('Walking to '+seat.label);
  }
  function stand(){if(seated)room.trigger('stand');}
  function approachFor(target,from) {
    const candidates=Array.from({length:12},(_,i)=>({x:target.x+Math.sin(i*Math.PI/6)*.96,z:target.z+Math.cos(i*Math.PI/6)*.96}));
    candidates.sort((a,b)=>distance(a,from)-distance(b,from));
    return candidates.find(k=>nav.canStand(k.x,k.z));
  }
  function finishFind(target){
    if(distance(avatar.position,target)>1.63){following=target;repathAt=0;return;}
    cancelWalk();const p=avatar.position;
    avatar.rotation.y=Math.atan2(target.x-p.x,target.z-p.z);
    spotlit=target;spotlightUntil=elapsed+8;callbacks.notice('You found '+target.resident.shortName);
  }
  let findAfterStand=null;
  function find(handle){
    const target=byHandle.get(handle);
    if(!target||own?.handle===handle)return;
    if(seated){findAfterStand=handle;stand();return;}
    const destination=approachFor(target,avatar.position);
    if(!destination)return;
    introView=false;wide=false;callbacks.onCamera(false);spotlit=target;spotlightUntil=elapsed+16;
    if(go(destination,()=>finishFind(target))){following=target;repathAt=elapsed+.5;}
  }
  function kick(){
    if(seated)return;
    if(distance(avatar.position,ballTarget)<2.35){room.trigger('kick');return;}
    const aim=approachFor(ballTarget,avatar.position);
    if(aim)go(aim,()=>room.trigger('kick'));
  }
  function interact(point=nearest) {
    if(!point||blocked||seated)return;
    if(point.type==='resident'){cancelWalk();callbacks.onResident(point.resident.handle);}
    else if(point.type==='seat')takeSeat(point);
    else if(point.type==='ball')kick();
  }
  function snap(p){avatar.position.set(p.x,0,p.z);avatar.rotation.y=p.yaw;shadowAt=-10;}
  function applyRoom(state,welcome=false){
    ensemble=state;
    if(state.status!=='online'){pendingSeat=null;return;}
    const next=state.players.find(p=>p.id===state.ownId);
    if(!next)return;
    const prev=own;own=next;ballState=state.ball||initialBall;
    if(welcome||!prev||next.handle!==prev.handle||next.seat!==prev.seat){
      cancelWalk();pendingSeat=null;outfit(next.handle,next.color);snap(next);
      const seat=seats.find(s=>String(s.id)===String(next.seat))||null;
      const oldSeat=seated;seated=seat;ring.visible=!seat;
      if(seat&&!oldSeat)callbacks.onSit(seat);
      else if(!seat&&oldSeat)callbacks.onLeaveSeat();
      if(!seated&&findAfterStand){const h=findAfterStand;findAfterStand=null;find(h);}
    }
    peers.clear();
    for(const p of state.players){
      if(p.id!==state.ownId)peers.set(p.id,p);
    }
    for(const [id,guest] of guests)if(!peers.has(id)||peers.get(id).handle){scene.remove(guest.root);guests.delete(id);}
    for(const p of peers.values())if(!p.handle&&!guests.has(p.id)){
      const guest=createFigure(T,'visitor',{guestColor:p.color});
      guest.root.position.set(p.x,0,p.z);guest.root.rotation.y=p.yaw;
      scene.add(guest.root);guests.set(p.id,guest);
    }
    callbacks.youLabel.textContent=next.handle?'You · '+byHandle.get(next.handle).resident.shortName:'You';
    for(const [id,el] of peerLabels)if(!peers.has(id)){el.remove();peerLabels.delete(id);}
    for(const peer of peers.values()){
      let label=peerLabels.get(peer.id);
      if(!label){label=document.createElement('button');label.type='button';label.className='peer-label';label.dataset.player=peer.id;
        label.addEventListener('click',()=>{
          const pal=peers.get(peer.id);if(!pal)return;
          if(pal.handle)find(pal.handle);
          else{const target=guests.get(pal.id)?.root.position;if(target){const pos=approachFor(target,avatar.position);if(pos)go(pos);}}
          host.focus({preventScroll:true});
        });
        callbacks.label.parentElement.append(label);peerLabels.set(peer.id,label);}
      const name=peer.handle?byHandle.get(peer.handle).resident.shortName:'Guest';
      if(label.dataset.name!==name){label.dataset.name=name;label.textContent=name;label.setAttribute('aria-label','Walk to '+name);label.title='Walk to '+name;}
      label.dataset.handle=peer.handle||'';label.style.setProperty('--guest-color',peer.color);
    }
    for(let i=0;i<figures.length;i++){
      const show=next.handle!==residents[i].handle;
      figures[i].root.visible=show;residentPositions[i].visible=show;
      residentHits[i].layers.set(show?0:1);
    }
  }
  const envelope=(at,now)=>{const age=(now-(at||0))/1000;return Math.max(0,Math.min(1,age*7,(1.85-age)*3.7));};
  function place(fig,p,dt,now,actorId){
    const root=fig.root;
    const d=Math.hypot(root.position.x-p.x,root.position.z-p.z);
    const alpha=d>2.2||!actorId?1:1-Math.exp(-dt*14);
    root.position.x+=(p.x-root.position.x)*alpha;root.position.z+=(p.z-root.position.z)*alpha;
    const turnBy=Math.atan2(Math.sin(p.yaw-root.rotation.y),Math.cos(p.yaw-root.rotation.y));
    root.rotation.y+=turnBy*alpha;
    const walk=Boolean(p.walking&&(!p.at||now-p.at<750));
    fig.animate(reduced&&!walk&&!p.waveAt&&!p.seated?0:now/1000,walk,Boolean(p.seated),envelope(p.waveAt,now));
  }
  function updateCast(dt,now){
    for(let i=0;i<figures.length;i++){
      const fig=figures[i],info=residentPositions[i];
      if(!info.visible)continue;
      const holder=ensemble.claims[residents[i].handle],peer=holder&&peers.get(holder);
      let pose;
      if(peer)pose={...peer,seated:peer.seat!==null};
      else if(holder)pose={x:fig.root.position.x,z:fig.root.position.z,yaw:fig.root.rotation.y,walking:false};
      else pose=npcPose(i,now);
      if(!peer)pose.waveAt=replyWaves.get(residents[i].handle)||0;
      place(fig,pose,dt,now,holder);
      info.x=fig.root.position.x;info.z=fig.root.position.z;
      residentHits[i].position.set(info.x,.86,info.z);
    }
    for(const [id,guest] of guests){
      const p=peers.get(id);if(p)place(guest,{...p,seated:p.seat!==null},dt,now,id);
    }
    const b=ballAt(ballState,now);
    ball.position.set(b.x,b.y,b.z);ball.rotation.z=b.roll*.78;ball.rotation.x=b.roll*.63;
    ballHit.position.copy(ball.position);Object.assign(ballTarget,{x:b.x,z:b.z});
    hitLayer.updateMatrixWorld(true);
  }
  function waveIcon(id,point,at){
    let item=waveLabels.get(id);
    if(!item){
      const el=document.createElement('div');el.className='wave-bubble';el.textContent='👋';el.setAttribute('aria-hidden','true');
      callbacks.label.parentElement.append(el);item={el};waveLabels.set(id,item);
    }
    Object.assign(item,{point,at});
  }
  function wave(message){
    const person=ensemble.players.find(p=>p.id===message.id);if(!person)return;
    person.waveAt=message.at;
    const self=person.id===ensemble.ownId;
    const point=self?avatar.position:person.handle?byHandle.get(person.handle):guests.get(person.id)?.root.position;
    if(point)waveIcon(person.id,point,message.at);
    const start=self?avatar.position:person;
    const around=residentPositions.filter(r=>r.visible&&!ensemble.claims[r.resident.handle]&&distance(r,start)<2.7).sort((a,b)=>distance(a,start)-distance(b,start))[0];
    if(around){replyWaves.set(around.resident.handle,message.at+480);waveIcon(around.resident.handle,around,message.at+480);}
  }
  function updateWaves(now){
    let nearestOffscreen=null;
    for(const [id,el] of peerLabels){
      const p=peers.get(id);if(!p)continue;
      const point=p.handle?byHandle.get(p.handle):guests.get(id)?.root.position;
      labelAt(el,point,1.92);
      el.classList.remove('offscreen');
      if(!el.hidden)continue;
      if(!point||projection.z<0||projection.z>1)continue;
      const d=distance(avatar.position,point);
      if(!nearestOffscreen||d<nearestOffscreen.d)nearestOffscreen={el,d,x:projection.x,y:projection.y};
    }
    if(nearestOffscreen){
      const {el,x,y}=nearestOffscreen;
      el.hidden=false;el.classList.add('offscreen');
      el.style.left=T.MathUtils.clamp((x+1)*width*.5,54,width-54)+'px';
      el.style.top=T.MathUtils.clamp((1-y)*height*.5,81,height-116)+'px';
    }
    for(const [id,item] of waveLabels){
      if(now-item.at>2100){item.el.remove();waveLabels.delete(id);continue;}
      labelAt(item.el,item.point,2.18,now>=item.at);
    }
  }
  function rayAt(e) {
    const rect=host.getBoundingClientRect();
    pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
    ray.setFromCamera(pointer,camera);
    return ray.intersectObjects(hitObjects,false)[0]?.object.userData.target ?? null;
  }
  function down(e) {
    if(blocked || e.button!==0 || pointerStart)return;
    host.focus({preventScroll:true});host.setPointerCapture(e.pointerId);
    pointerStart={id:e.pointerId,x:e.clientX,y:e.clientY,angle,tilt,drag:false};
  }
  function pointerMove(e) {
    if(blocked)return;
    if(pointerStart){
      if(e.pointerId!==pointerStart.id)return;
      const dx=e.clientX-pointerStart.x,dy=e.clientY-pointerStart.y;
      if(!pointerStart.drag && Math.hypot(dx,dy)>6)pointerStart.drag=true;
      if(pointerStart.drag){
        hovered=null;host.classList.add('dragging');
        angle=pointerStart.angle-dx*.0065;tilt=T.MathUtils.clamp(pointerStart.tilt+dy*.004,.34,.98);
      }
    }else if(e.pointerType!=='touch'){
      hovered=rayAt(e);host.classList.toggle('targeting',Boolean(hovered));
    }
  }
  function pointerUp(e) {
    if(!pointerStart || pointerStart.id!==e.pointerId)return;
    const tap=!pointerStart.drag;pointerStart=null;host.classList.remove('dragging');
    if(!tap || blocked || seated)return;
    following=null;const picked=rayAt(e);
    if(picked){interact(picked);return;}
    if(ray.ray.intersectPlane(ground,groundHit) && (groundHit.x/10.9)**2+(groundHit.z/7.2)**2<1.08){
      go({x:groundHit.x,z:groundHit.z});
    }
  }
  host.addEventListener('pointerdown',down);host.addEventListener('pointermove',pointerMove);host.addEventListener('pointerup',pointerUp);
  host.addEventListener('pointercancel',()=>{pointerStart=null;host.classList.remove('dragging');});
  host.addEventListener('pointerleave',()=>{hovered=null;host.classList.remove('targeting');});
  host.addEventListener('keydown',e=>{
    if(!running||blocked||e.metaKey||e.ctrlKey||e.altKey)return;
    const k=e.key.toLowerCase();
    if(movementKeys.includes(k)){e.preventDefault();keys.add(k);}
    if(k==='e'&&!e.repeat){e.preventDefault();interact();}
    if(e.code==='Space'&&!e.repeat){e.preventDefault();room.trigger('wave');}
  });
  window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
  host.addEventListener('blur',()=>keys.clear());
  window.addEventListener('blur',()=>keys.clear());
  let onScreen=true;
  const visibilityObserver=new IntersectionObserver(entries=>{onScreen=entries[0].isIntersecting;});
  visibilityObserver.observe(host);
  function tick(now){
    if(!running)return;
    frame=requestAnimationFrame(tick);
    const dt=Math.min((now-last)/1000,.075);last=now;
    if(document.hidden||!onScreen||blocked)return;
    elapsed+=dt;
    const nowMs=room.now();
    updateCast(dt,nowMs);
    const walking=move(dt);
    visitorFigure.animate(nowMs/1000,walking,Boolean(seated),envelope(own?.waveAt,nowMs));
    if(own && !seated && !pendingSeat)room.pose(avatar.position.x,avatar.position.z,avatar.rotation.y,walking);
    ring.position.set(avatar.position.x,.038,avatar.position.z);
    if(!reduced)environment.update(elapsed);
    if(elapsed-shadowAt>.33){renderer.shadowMap.needsUpdate=true;shadowAt=elapsed;}
    setCamera(dt);scanNearby();updateLabels();updateWaves(nowMs);
    renderer.render(scene,camera);
  }
  function start(){
    if(running)return;
    running=true;resize();last=performance.now();setCamera(0,true);updateCast(1,room.now());callbacks.onCamera(wide);scanNearby();frame=requestAnimationFrame(tick);
  }
  function stop(){running=false;cancelAnimationFrame(frame);keys.clear();cancelWalk();hovered=null;}
  function setBlocked(value){blocked=value;if(value){keys.clear();pointerStart=null;hovered=null;}else if(running)last=performance.now();}
  function toggleCamera(){introView=false;wide=!wide;callbacks.onCamera(wide);return wide;}
  return {start,stop,find,takeSeat,stand,kick,interact:()=>interact(),toggleCamera,setBlocked,applyRoom,wave,
    setBall(b){ballState=b;},correct(p){cancelWalk();snap(p);},clearRequest(){pendingSeat=null;}};
}
