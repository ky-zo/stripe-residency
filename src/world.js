import * as T from 'three';
import { buildEnvironment } from './environment.js';
import { createFigure } from './models.js';
import { createDrive } from './drive.js';
import { createScooter, SCOOTER_RIG } from './scooter.js';
import { groundHeight, inLagoon, nearbyBeach, palmTrunk, climbSpots, climbPose, jumpLift, JUMP_MS, shoreActivity, SCOOTER_START, scooterSpot, SWIM_LEVEL, waterEntry } from '../shared/mobility.js';
import { createNavigation } from './navigation.js';

import { HOME, PLAY_SPOTS, SWIMMER_INDEX, npcPose, playPose, createBeachBall } from './island-life.js';
import { ballAt, initialBall } from '../shared/ball.js';
import {appearanceKey,memberHandle} from '../shared/members.js';
import {activityId,activitySeat,climbKey} from '../shared/activities.js';

const movementKeys=['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'];
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createWorld(host,residents,callbacks) {
  const renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  const mobile=matchMedia('(max-width: 650px), (pointer: coarse) and (max-width: 1024px)').matches;
  renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.4:1.55));
  renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=T.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate=false;
  renderer.shadowMap.needsUpdate=true;
  host.replaceChildren(renderer.domElement);
  const scene=new T.Scene();
  const camera=new T.PerspectiveCamera(40,1,.1,150);
  const environment=buildEnvironment(T,scene,{shadowSize:mobile?1024:1536});
  const ray=new T.Raycaster(),pointer=new T.Vector2(),ground=new T.Plane(new T.Vector3(0,1,0),0);
  const hitLayer=new T.Group(), hitObjects=[];
  const hitMaterial=new T.MeshBasicMaterial({visible:false});
  const bodyHit=new T.CylinderGeometry(.51,.51,1.72,10);
  const deskHit=new T.BoxGeometry(2.7,1.16,1.45);
  function addTarget(geometry,x,y,z,item) {
    const mesh=new T.Mesh(geometry,hitMaterial);
    mesh.position.set(x,y,z);mesh.userData.target=item;hitLayer.add(mesh);hitObjects.push(mesh);
    return mesh;
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
  const parkedSpot={...scooterSpot(),type:'activity'};
  const spots=[...PLAY_SPOTS,...climbSpots].map(s=>({...s,type:'activity'})).concat(parkedSpot);
  let scooter,vehicleLoad;
  function loadBike(){
    if(scooter)scene.remove(scooter.root);
    scooter=createScooter(T);scene.add(scooter.root);vehicleLoad='loading';
    scooter.ready.then(()=>{vehicleLoad='ready';}).catch(()=>{vehicleLoad='failed';});
  }
  loadBike();
  const drive=createDrive();
  const waterPlane=new T.Plane(new T.Vector3(0,1,0),-SWIM_LEVEL);
  let scooterHit,climbing=null,progress=0,climbTarget=null,climbRate=0,localJump=0;
  const stick={right:0,forward:0};
  for(const spot of spots){
    const area=spot.id==='climb'?new T.CylinderGeometry(.42,.54,spot.palm.height*.95,9):
      spot.id==='ride'?new T.BoxGeometry(.84,1.12,1.75):
      spot.id==='lounge'?new T.BoxGeometry(.94,.72,1.92):new T.SphereGeometry(.53,10,8);
    const mesh=addTarget(area,spot.x,spot.hitY,spot.z,spot);
    if(spot.id==='lounge')mesh.rotation.y=spot.land.yaw-Math.PI;
    if(spot.id==='ride')scooterHit=mesh;
    if(spot.id==='climb'){
      const top=palmTrunk(spot.palm,.93),dx=top.x-spot.x,dz=top.z-spot.z;
      mesh.position.set(spot.x+dx/2,top.y/2,spot.z+dz/2);
      mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(dx,top.y,dz).normalize());
    }
  }
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
  const roads=createNavigation(environment.obstacles,[],{clearance:.33});
  const avatar=new T.Group();scene.add(avatar);
  avatar.position.set(.08,0,5.25);avatar.rotation.y=-.48;
  function outfit(handle,color,appearance){
    const key=handle||('visitor:'+color+':'+appearanceKey(appearance));
    if(localKey===key)return;
    if(visitorFigure)avatar.remove(visitorFigure.root);
    visitorFigure=createFigure(T,handle||'visitor',{guestColor:color,appearance});
    avatar.add(visitorFigure.root);localKey=key;
  }
  outfit(null,'#e58a5f');
  const ring=new T.Mesh(new T.RingGeometry(.43,.48,48),new T.MeshBasicMaterial({color:'#f5cf77',side:T.DoubleSide,depthWrite:false}));
  ring.rotation.x=-Math.PI/2;scene.add(ring);
  const marker=new T.Mesh(new T.RingGeometry(.18,.23,32),new T.MeshBasicMaterial({color:'#42634a',side:T.DoubleSide,depthWrite:false,transparent:true,opacity:.78}));
  marker.rotation.x=-Math.PI/2;marker.position.y=.042;marker.visible=false;scene.add(marker);
  let running=false,blocked=false,frame=0,last=0,elapsed=0,shadowAt=0;
  let route=[],arrival=null,seated=null,doing=null,afterStand=null,nearest=null,hovered=null,spotlit=null,spotlightUntil=0;
  let angle=.105,tilt=.55,wide=!mobile,introView=!mobile,pointerStart=null,width=0,height=0;
  let travelView=null,orbitManuallyUntil=0,shorePending=false,shoreSentAt=0;
  let orbitRadius=0,following=null,repathAt=0,pendingSeat=null;
  const keys=new Set(),cameraFocus=new T.Vector3(0,.57,.4),desired=new T.Vector3(),offset=new T.Vector3();
  const projection=new T.Vector3(),groundHit=new T.Vector3(),seaHit=new T.Vector3(),surfaceHit=new T.Vector3();
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
    const trackSwim=doing==='swim'&&!wide;
    const active=!wide&&(trackSwim||doing==='ride'||doing==='climb');
    if(doing==='ride'&&!wide&&!pointerStart&&elapsed>orbitManuallyUntil&&Math.abs(drive.speed)>.20){
      const behind=avatar.rotation.y+Math.PI-angle;
      angle+=Math.atan2(Math.sin(behind),Math.cos(behind))*(1-Math.exp(-dt*2.6));
    }
    desired.set(active?p.x:p.x*follow,wide?1.0:doing==='climb'?p.y+1.16:trackSwim?-.20:.85+groundHeight(p.x,p.z),active?p.z:p.z*follow+(wide?-.62:-.65));
    const smoothing=snap||reduced?1:1-Math.exp(-dt*(active?9:3.7));
    cameraFocus.lerp(desired,smoothing);
    const horizontalRadius=wide?Math.max(15.8,12.6/camera.aspect):trackSwim?(narrow?6.3:8.6):narrow?8.6:12.15;
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
    labelAt(callbacks.youLabel,p,p.y+(doing==='swim'?.99:doing==='lounge'?1.18:1.85),!seated);
    const current=hovered || (elapsed<spotlightUntil?spotlit:null) || (nearest?.type==='resident' && !ensemble.claims[nearest.resident.handle]?nearest:null);
    if(current){
      const text=current.type==='resident'?current.resident.shortName:(current.label||'Guest');
      if(callbacks.label.textContent!==text)callbacks.label.textContent=text;
    }
    labelAt(callbacks.label,current,current?.labelY??(current?.type==='seat'?1.06:current?.type==='ball'?.87:1.87),!seated&&!doing&&current?.visible!==false);
  }
  function scanNearby() {
    const p=avatar.position;
    let closest=null,dist=1.68;
    if(!seated&&!doing)for(const point of [...byHandle.values(),...spots,...seats,ballTarget]){
      if(point.visible===false || (point.type==='seat'&&seatOwner(point)))continue;
      const d=distance(p,point.land||point);
      if(d<dist){dist=d;closest=point;}
    }
    if(!seated&&!doing&&spotlit?.visible!==false&&spotlit&&elapsed<spotlightUntil&&distance(spotlit.land||spotlit,p)<1.68)closest=spotlit;
    if(closest!==nearest){nearest=closest;callbacks.onNearby(nearest);}
    const close=!seated&&!doing&&distance(p,ballTarget)<2.32;
    if(close!==ballNear){ballNear=close;callbacks.onBallNear(close);}
  }
  function turn(yaw,dt){
    const now=avatar.rotation.y;
    avatar.rotation.y=now+Math.atan2(Math.sin(yaw-now),Math.cos(yaw-now))*(1-Math.exp(-dt*13));
  }
  function cancelWalk() { route=[];arrival=null;following=null;marker.visible=false; }
  function followCamera(){if(introView){introView=false;wide=false;callbacks.onCamera(false);}}
  function inputAxes(){
    const right=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'));
    const forward=Number(keys.has('w')||keys.has('arrowup'))-Number(keys.has('s')||keys.has('arrowdown'));
    return {right:right||stick.right,forward:forward||stick.forward};
  }
  function jump(){
    if(!running||blocked||doing||seated||pendingSeat||shorePending||ensemble.status!=='online')return;
    const now=room.now();
    if(now-Math.max(localJump,own?.jumpAt||0)<JUMP_MS+85)return;
    if(room.trigger('jump'))localJump=now;
  }
  function move(dt) {
    if(seated||doing==='lounge'||pendingSeat||shorePending||blocked||(ensemble.status!=='online'&&own))return false;
    const p=avatar.position,axes=inputAxes();
    if(doing==='climb'&&climbing){
      const before=progress;
      if(Math.abs(axes.forward)>.09){climbTarget=null;progress+=axes.forward*dt*.36;}
      else if(climbTarget!==null){
        progress+=T.MathUtils.clamp(climbTarget-progress,-dt*.40,dt*.40);
        if(Math.abs(progress-climbTarget)<.001){
          if(climbTarget===0)room.trigger('stand');
          climbTarget=null;
        }
      }
      progress=T.MathUtils.clamp(progress,0,1);
      climbRate=T.MathUtils.clamp((progress-before)/Math.max(.001,dt*.39),-1,1);
      return Math.abs(progress-before)>.0001;
    }
    const manual=Math.hypot(axes.right,axes.forward)>.08;
    if(manual){if(doing==='swim'&&route.length)afterStand=null;followCamera();cancelWalk();}
    if(doing==='ride'){
      const moving=drive.step(avatar,roads,dt,axes,route);
      if(!route.length)marker.visible=false;
      return moving;
    }
    const onWetSand=!doing&&groundHeight(p.x,p.z)<SWIM_LEVEL;
    const speed=doing==='swim'?2.85:onWetSand?1.85:manual?3.65:3.85;
    if(manual){
      const len=Math.max(1,Math.hypot(axes.right,axes.forward)),lr=axes.right/len,fb=-axes.forward/len;
      const x=lr*Math.cos(angle)+fb*Math.sin(angle),z=fb*Math.cos(angle)-lr*Math.sin(angle);
      const step=speed*dt,dx=x*step,dz=z*step;
      const lastX=p.x,lastZ=p.z;
      if(nav.canStand(p.x+dx,p.z))p.x+=dx;
      if(nav.canStand(p.x,p.z+dz))p.z+=dz;
      turn(Math.atan2(x,z),dt);
      return Math.abs(p.x-lastX)+Math.abs(p.z-lastZ)>.001;
    }
    if(following && elapsed>repathAt){
      repathAt=elapsed+.52;
      const target=following,d=distance(p,target.land||target);
      if(d<1.23){finishFind(target);return false;}
      const next=approachFor(target,p);
      if(next && (!route.length||distance(next,route.at(-1))>.44)){go(next,()=>finishFind(target),true);following=target;}
    }
    if(!route.length)return false;
    let budget=speed*dt;
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
    if(seated||doing==='climb'||doing==='lounge')return false;
    followCamera();
    const map=doing==='ride'?roads:nav;
    const points=map.path(avatar.position,point);
    if(!points?.length)return false;
    following=null;route=points;arrival=done;const end=points.at(-1);
    marker.visible=mark;marker.position.set(end.x,Math.max(SWIM_LEVEL,groundHeight(end.x,end.z))+.042,end.z);
    return true;
  }
  function seatOwner(seat){return ensemble.players.find(p=>p.seat!==null&&String(p.seat)===String(seat.id));}
  function takeSeat(seat,immediate=false) {
    if(doing){afterStand=()=>takeSeat(seat,immediate);stand();return;}
    if(seated||pendingSeat||shorePending)return;
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
  function takeActivity(id,key=null){
    if(doing===id||pendingSeat||shorePending)return;
    if(id==='ride'&&vehicleLoad==='failed'){loadBike();callbacks.notice('Loading the motorbike…');}
    if(seated||doing){afterStand=()=>takeActivity(id,key);stand();return;}
    if(ensemble.status!=='online'){callbacks.notice('Waiting for the shared island');return;}
    const candidates=spots.filter(s=>s.id===id&&(!key||s.key===key)).sort((a,b)=>distance(a.land,avatar.position)-distance(b.land,avatar.position));
    const spot=candidates.find(s=>!ensemble.players.some(p=>p.seat===activitySeat(id,own?.id,s.key)));
    if(!spot){callbacks.notice(id==='climb'?'This palm is occupied. Choose another tree.':id==='ride'?'Someone is riding the motorbike.':'The sunbed is occupied.');return;}
    const request=()=>{
      if(id==='swim'){go(waterEntry(own.id));return;}
      pendingSeat=spot;
      const p=avatar.position;room.pose(p.x,p.z,avatar.rotation.y,false,true);
      if(!room.trigger('activity',{id,key:spot.key}))pendingSeat=null;
    };
    if(distance(spot.land,avatar.position)<.8)request();
    else if(go(spot.land,request))callbacks.notice({swim:'Walking to the swimming cove',ride:'Walking to the motorbike',climb:'Walking to the palm',lounge:'Walking to the sunbed'}[id]);
  }
  function stand(){
    if(shorePending)return;
    if(doing==='climb'&&!afterStand&&progress>.025){climbTarget=0;callbacks.notice('Climbing down');}
    else if(doing==='ride'){
      const p=avatar.position,yaw=avatar.rotation.y;
      const exits=[1,-1].map(side=>({x:p.x+side*.72*Math.cos(yaw),z:p.z-side*.72*Math.sin(yaw)}));
      const exit=exits.find(q=>nav.canStand(q.x,q.z)&&!shoreActivity(null,q.x,q.z));
      room.pose(p.x,p.z,yaw,false,true);room.trigger('stand',{exit});
    }else if(doing==='swim'){
      const p=avatar.position;go(nearbyBeach(p.x,p.z));
    }else if(seated||doing)room.trigger('stand');
  }
  function approachFor(target,from) {
    if(target.land)return target.land;
    const candidates=Array.from({length:12},(_,i)=>({x:target.x+Math.sin(i*Math.PI/6)*.96,z:target.z+Math.cos(i*Math.PI/6)*.96}));
    candidates.sort((a,b)=>distance(a,from)-distance(b,from));
    return candidates.find(k=>nav.canStand(k.x,k.z));
  }
  function finishFind(target){
    if(!target.visible){cancelWalk();return;}
    if(distance(avatar.position,target.land||target)>1.63){following=target;repathAt=0;return;}
    cancelWalk();const p=avatar.position;
    avatar.rotation.y=Math.atan2(target.x-p.x,target.z-p.z);
    spotlit=target;spotlightUntil=elapsed+8;callbacks.notice('You found '+target.resident.shortName);
  }
  function find(handle){
    const target=byHandle.get(handle);
    if(own?.handle===handle||own?.memberId&&memberHandle(own.memberId)===handle)return;
    if(!target){callbacks.notice('This member is away from the island.');return;}
    if(seated||doing){afterStand=()=>find(handle);stand();return;}
    const destination=approachFor(target,avatar.position);
    if(!destination)return;
    introView=false;wide=false;callbacks.onCamera(false);spotlit=target;spotlightUntil=elapsed+16;
    if(go(destination,()=>finishFind(target))){following=target;repathAt=elapsed+.5;}
  }
  function kick(){
    if(seated||doing)return;
    if(distance(avatar.position,ballTarget)<2.35){room.trigger('kick');return;}
    const aim=approachFor(ballTarget,avatar.position);
    if(aim)go(aim,()=>room.trigger('kick'));
  }
  function interact(point=nearest) {
    if(!point||blocked||seated||doing)return;
    if(point.type==='resident'){cancelWalk();callbacks.onResident(point.resident.handle);}
    else if(point.type==='seat')takeSeat(point);
    else if(point.type==='activity')takeActivity(point.id,point.key);
    else if(point.type==='ball')kick();
  }
  function snap(p){avatar.position.set(p.x,p.y||0,p.z);avatar.rotation.y=p.yaw;shadowAt=-10;}
  function removeGuest(id,guest){
    scene.remove(guest.root);guests.delete(id);environment.setSwimmer(null,0,id);
    if(!guest.target)return;
    guest.target.visible=false;byHandle.delete(guest.target.resident.handle);
    hitLayer.remove(guest.hit);const idx=hitObjects.indexOf(guest.hit);if(idx>=0)hitObjects.splice(idx,1);
    if(following===guest.target)cancelWalk();
  }
  function applyRoom(state,welcome=false){
    ensemble=state;
    Object.assign(parkedSpot,scooterSpot(state.scooter||SCOOTER_START));
    parkedSpot.visible=!state.players.some(p=>activityId(p.seat)==='ride');
    scooterHit.layers.set(parkedSpot.visible?0:1);
    scooterHit.position.set(parkedSpot.x,groundHeight(parkedSpot.x,parkedSpot.z)+.58,parkedSpot.z);scooterHit.rotation.y=parkedSpot.land.yaw;
    if(state.status!=='online'){pendingSeat=null;shorePending=false;return;}
    const next=state.players.find(p=>p.id===state.ownId);
    if(!next)return;
    const directory=new Map((state.members||[]).map(m=>[m.id,m]));
    const member=directory.get(next.memberId);
    const prev=own;own=next;ballState=state.ball||initialBall;
    outfit(next.handle,next.color,member?.appearance);
    if(welcome||!prev||next.handle!==prev.handle||next.seat!==prev.seat){
      const crossing=shorePending&&!welcome&&prev?.seat!==next.seat;
      if(!crossing)cancelWalk();
      pendingSeat=null;shorePending=false;drive.reset();snap(next);
      const seat=seats.find(s=>String(s.id)===String(next.seat))||null;
      const oldSeat=seated,oldActivity=doing;seated=seat;doing=activityId(next.seat);ring.visible=!seat&&!doing;
      climbing=doing==='climb'?climbSpots.find(s=>s.key===climbKey(next.seat)):null;
      progress=next.progress||0;climbTarget=climbing&&!progress?1:null;localJump=next.jumpAt||0;
      if(['swim','climb','ride'].includes(doing)){
        if(!travelView)travelView={angle,tilt,wide};
        if(doing==='swim'){
          if(!crossing)angle=Math.PI-.31;
          tilt=.39;avatar.position.y=SWIM_LEVEL;
          if(oldActivity==='ride')callbacks.notice('Splash! The scooter is back at its parking spot.');
        }else if(doing==='ride'){angle=next.yaw+Math.PI;tilt=.47;}
        else if(climbing){angle=climbing.land.yaw+Math.PI+.54;tilt=.42;}
        wide=false;introView=false;callbacks.onCamera(false);if(!crossing)setCamera(0,true);
      }else if(travelView){
        if(crossing)tilt=travelView.tilt;else ({angle,tilt,wide}=travelView);
        travelView=null;callbacks.onCamera(wide);if(!crossing)setCamera(0,true);
      }
      if(seat&&!oldSeat)callbacks.onSit(seat);
      else if(!seat&&oldSeat)callbacks.onLeaveSeat();
      if(doing!==oldActivity||welcome){callbacks.onActivity(doing);environment.setSwimmer(null,0,'self');}
      if(!seated&&!doing&&afterStand){const resume=afterStand;afterStand=null;resume();}
    }
    for(const [id] of peers)if(!state.players.some(p=>p.id===id))environment.setSwimmer(null,0,id);
    peers.clear();
    for(const p of state.players){
      if(p.id!==state.ownId)peers.set(p.id,p);
    }
    for(const [id,guest] of guests){
      const p=peers.get(id),m=directory.get(p?.memberId);
      if(!p||p.handle||guest.look!==appearanceKey(m?.appearance)||guest.memberId!==(p.memberId||null))removeGuest(id,guest);
    }
    for(const p of peers.values())if(!p.handle&&!guests.has(p.id)){
      const m=directory.get(p.memberId);
      const guest=createFigure(T,'visitor',{guestColor:p.color,appearance:m?.appearance});
      guest.look=appearanceKey(m?.appearance);guest.memberId=p.memberId||null;
      guest.root.position.set(p.x,0,p.z);guest.root.rotation.y=p.yaw;
      scene.add(guest.root);guests.set(p.id,guest);
      if(m){
        const handle=memberHandle(m.id);
        guest.target={type:'resident',resident:{handle,shortName:m.name},x:p.x,z:p.z,visible:true};
        byHandle.set(handle,guest.target);guest.hit=addTarget(bodyHit,p.x,.86,p.z,guest.target);
      }
    }
    const name=next.handle?byHandle.get(next.handle).resident.shortName:member?.name;
    callbacks.youLabel.textContent=name?'You · '+name:'You';
    for(const [id,el] of peerLabels)if(!peers.has(id)){el.remove();peerLabels.delete(id);}
    for(const peer of peers.values()){
      let label=peerLabels.get(peer.id);
      if(!label){label=document.createElement('button');label.type='button';label.className='peer-label';label.dataset.player=peer.id;
        label.addEventListener('click',()=>{
          const pal=peers.get(peer.id);if(!pal)return;
           if(pal.handle||pal.memberId)find(pal.handle||memberHandle(pal.memberId));
          else{const target=guests.get(pal.id)?.root.position;if(target){const pos=approachFor(target,avatar.position);if(pos)go(pos);}}
          host.focus({preventScroll:true});
        });
        callbacks.label.parentElement.append(label);peerLabels.set(peer.id,label);}
      const name=peer.handle?byHandle.get(peer.handle).resident.shortName:directory.get(peer.memberId)?.name||'Guest';
      const target=guests.get(peer.id)?.target;if(target)target.resident.shortName=name;
      if(label.dataset.name!==name){label.dataset.name=name;label.textContent=name;label.setAttribute('aria-label','Walk to '+name);label.title='Walk to '+name;}
      label.dataset.handle=peer.handle||(peer.memberId?memberHandle(peer.memberId):'');label.style.setProperty('--guest-color',peer.color);
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
    root.position.y=p.y||0;
    const turnBy=Math.atan2(Math.sin(p.yaw-root.rotation.y),Math.cos(p.yaw-root.rotation.y));
    root.rotation.order='YXZ';
    root.rotation.y+=turnBy*alpha;root.rotation.x=p.pitch||0;root.rotation.z=p.roll||0;
    const walk=Boolean(p.walking&&(!p.at||now-p.at<750));
    fig.animate(reduced&&!walk&&!p.waveAt&&!['climb','ride','jump','swim'].includes(p.activity)?0:now/1000,walk,Boolean(p.seated),envelope(p.waveAt,now),p.activity);
  }
  function peerPose(p,now){
    const id=activityId(p.seat);
    if(id==='lounge')return {...playPose(id,now,p.id),waveAt:p.waveAt};
    if(id==='climb'){
      const spot=climbSpots.find(s=>s.key===climbKey(p.seat));
      if(spot)return {...p,...climbPose(spot,p.progress||0),activity:id,land:spot.land};
    }
    if(id==='swim')return {...p,...playPose(id,now,p.id,p)};
    const floor=groundHeight(p.x,p.z);
    if(id==='ride')return {...p,y:floor+SCOOTER_RIG.rider.y,activity:id};
    const lift=p.seat===null?jumpLift(p.jumpAt,now):0;
    return {...p,y:floor+lift,wading:floor+lift<SWIM_LEVEL-.015,activity:lift?'jump':'',seated:p.seat!==null};
  }
  function placeBike(x,z,yaw){
    const bike=scooter.root,dx=Math.sin(yaw)*.5,dz=Math.cos(yaw)*.5;
    const front=groundHeight(x+dx,z+dz),rear=groundHeight(x-dx,z-dz);
    bike.position.set(x,(front+rear)/2,z);
    bike.rotation.set(Math.atan(rear-front),yaw,0,'YXZ');
  }
  function updateScooter(dt){
    const rider=ensemble.players.find(p=>activityId(p.seat)==='ride');
    const bike=scooter.root;
    if(!rider){
      placeBike(parkedSpot.x,parkedSpot.z,parkedSpot.land.yaw);scooter.animate(dt,0,0);return;
    }
    const mine=rider.id===ensemble.ownId;
    const rendered=mine?avatar:rider.handle?figures[byHandle.get(rider.handle).index].root:guests.get(rider.id)?.root;
    if(!rendered)return;
    const change=Math.atan2(Math.sin(rendered.rotation.y-bike.rotation.y),Math.cos(rendered.rotation.y-bike.rotation.y));
    placeBike(rendered.position.x,rendered.position.z,rendered.rotation.y);
    scooter.animate(dt,mine?drive.speed:rider.walking?3:0,mine?drive.steer:T.MathUtils.clamp(-change/Math.max(.01,dt)*.45,-1,1));
    const body=mine?visitorFigure.root:rendered;
    body.position.y=bike.position.y+SCOOTER_RIG.rider.y-(mine?avatar.position.y:0);
    body.rotation.x=bike.rotation.x;body.rotation.z=scooter.riderFrame.rotation.z;
  }
  function positionTarget(info,hit,fig,pose){
    const {x,y,z}=fig.root.position;
    const low=pose.activity==='swim',lounging=pose.activity==='lounge'||pose.activity==='read';
    Object.assign(info,{x,z,land:pose.land||null,labelY:y+(low?.98:lounging?1.13:pose.seated?1.52:1.87)});
    hit.position.set(x,y+(low?.37:lounging?.61:.86),z);
    hit.scale.set(1,low?.56:lounging?.70:1,lounging?1.65:1);
    hit.rotation.y=fig.root.rotation.y;
  }
  function updateCast(dt,now){
    for(let i=0;i<figures.length;i++){
      const fig=figures[i],info=residentPositions[i];
      if(!info.visible){if(i===SWIMMER_INDEX)environment.setSwimmer(null,now);continue;}
      const holder=ensemble.claims[residents[i].handle],peer=holder&&peers.get(holder);
      let pose;
      if(peer)pose=peerPose(peer,now);
      else if(holder)pose={x:fig.root.position.x,z:fig.root.position.z,yaw:fig.root.rotation.y,walking:false};
      else pose=npcPose(i,now);
      if(!peer)pose.waveAt=replyWaves.get(residents[i].handle)||0;
      place(fig,pose,dt,now,holder);
      positionTarget(info,residentHits[i],fig,pose);
      if(i===SWIMMER_INDEX)environment.setSwimmer(!holder?pose:null,now);
      if(peer)environment.setSwimmer(pose,now,peer.id);
    }
    for(const [id,guest] of guests){
      const p=peers.get(id);if(!p)continue;
      const pose=peerPose(p,now);
      place(guest,pose,dt,now,id);environment.setSwimmer(pose,now,id);
      if(guest.target)positionTarget(guest.target,guest.hit,guest,pose);
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
      const guest=guests.get(id);
      const point=p.handle?byHandle.get(p.handle):guest?.target||guest?.root.position;
      labelAt(el,point,point?.labelY??((point?.y||0)+(activityId(p.seat)==='swim'?.98:1.92)));
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
      labelAt(item.el,item.point,(item.point.labelY??((item.point.y||0)+1.85))+.29,now>=item.at);
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
        hovered=null;host.classList.add('dragging');orbitManuallyUntil=elapsed+4;
        angle=pointerStart.angle-dx*.0065;tilt=T.MathUtils.clamp(pointerStart.tilt+dy*.004,.34,.98);
      }
    }else if(e.pointerType!=='touch'){
      hovered=rayAt(e);host.classList.toggle('targeting',Boolean(hovered));
    }
  }
  function pointerUp(e) {
    if(!pointerStart || pointerStart.id!==e.pointerId)return;
    const tap=!pointerStart.drag;pointerStart=null;host.classList.remove('dragging');
    if(!tap||blocked||seated||doing==='lounge')return;
    following=null;const picked=rayAt(e);
    if(doing==='climb'&&climbing){
      const bottom=new T.Vector3(climbing.x,0,climbing.z).project(camera);
      const top=climbPose(climbing,1),upper=new T.Vector3(top.x,top.y+1.1,top.z).project(camera);
      climbTarget=T.MathUtils.clamp((pointer.y-bottom.y)/(upper.y-bottom.y),0,1);return;
    }
    if(!doing&&picked){interact(picked);return;}
    if(!ray.ray.intersectPlane(ground,groundHit)||!ray.ray.intersectPlane(waterPlane,seaHit))return;
    // Trace the visible sand slope or water surface under the tap.
    let near=0,far=1;
    for(let i=0;i<10;i++){
      const t=(near+far)/2;surfaceHit.lerpVectors(groundHit,seaHit,t);
      if(surfaceHit.y>Math.max(SWIM_LEVEL,groundHeight(surfaceHit.x,surfaceHit.z)))near=t;else far=t;
    }
    if(inLagoon(surfaceHit.x,surfaceHit.z))go({x:surfaceHit.x,z:surfaceHit.z});
  }
  host.addEventListener('pointerdown',down);host.addEventListener('pointermove',pointerMove);host.addEventListener('pointerup',pointerUp);
  host.addEventListener('pointercancel',()=>{pointerStart=null;host.classList.remove('dragging');});
  host.addEventListener('pointerleave',()=>{hovered=null;host.classList.remove('targeting');});
  host.addEventListener('keydown',e=>{
    if(!running||blocked||e.metaKey||e.ctrlKey||e.altKey)return;
    const k=e.key.toLowerCase();
    if(movementKeys.includes(k)){e.preventDefault();keys.add(k);}
    if(k==='e'&&!e.repeat){e.preventDefault();if(doing)stand();else interact();}
    if(e.code==='Space'){e.preventDefault();if(!e.repeat)jump();}
    if(k==='q'&&!e.repeat){e.preventDefault();room.trigger('wave');}
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
    const dt=Math.min((now-last)/1000,.19);last=now;
    if(document.hidden||!onScreen||blocked)return;
    elapsed+=dt;
    const nowMs=room.now();
    updateCast(dt,nowMs);
    const walking=move(dt);
    const {x,z}=avatar.position,floor=groundHeight(x,z);
    const lift=!doing&&!seated?jumpLift(Math.max(localJump,own?.jumpAt||0),nowMs):0;
    let visualActivity=doing,effort=walking;
    visitorFigure.root.rotation.set(0,0,0,'YXZ');
    if(doing==='lounge'){
      const pose=playPose(doing,nowMs,own?.id);
      avatar.position.set(pose.x,pose.y,pose.z);avatar.rotation.y=pose.yaw;
    }else if(doing==='climb'&&climbing){
      const pose=climbPose(climbing,progress);avatar.position.set(pose.x,pose.y,pose.z);avatar.rotation.y=pose.yaw;
      visitorFigure.root.rotation.set(pose.pitch,0,pose.roll,'YXZ');effort=climbRate;
    }else if(doing==='swim'){
      const pose=playPose('swim',nowMs,own?.id,{x:avatar.position.x,z:avatar.position.z,yaw:avatar.rotation.y,walking});
      avatar.position.y=pose.y;environment.setSwimmer(pose,nowMs,'self');
    }else{
      avatar.position.y=floor+lift;
      if(lift>.001)visualActivity='jump';
      const wading=!doing&&!seated&&avatar.position.y<SWIM_LEVEL-.015;
      environment.setSwimmer(wading?{x,z,yaw:avatar.rotation.y,wading,walking}:null,nowMs,'self');
    }
    if(doing==='ride')effort=drive.speed/6.5;
    visitorFigure.root.position.y=doing==='ride'?SCOOTER_RIG.rider.y:0;
    visitorFigure.animate(reduced&&!walking&&!own?.waveAt&&!visualActivity?0:nowMs/1000,effort,Boolean(seated||doing==='lounge'),envelope(own?.waveAt,nowMs),visualActivity);
    if(own&&!seated&&doing!=='lounge'&&!pendingSeat){
      const crossing=doing!=='climb'&&shoreActivity(doing,x,z,lift)!==doing;
      if(!crossing||!shorePending||elapsed-shoreSentAt>.25){
        room.pose(x,z,avatar.rotation.y,walking,crossing,progress);
        if(crossing)shoreSentAt=elapsed;
      }
      shorePending=crossing;
    }
    ring.visible=!seated&&!doing&&floor>=SWIM_LEVEL;
    ring.position.set(x,.038+floor,z);
    ring.scale.setScalar(1+avatar.position.y*.15);updateScooter(dt);
    if(!reduced)environment.update(elapsed);
    if(elapsed-shadowAt>.33){renderer.shadowMap.needsUpdate=true;shadowAt=elapsed;}
    setCamera(dt);scanNearby();updateLabels();updateWaves(nowMs);
    renderer.render(scene,camera);
  }
  function start(){
    if(running)return;
    running=true;resize();last=performance.now();setCamera(0,true);updateCast(1,room.now());callbacks.onCamera(wide);scanNearby();frame=requestAnimationFrame(tick);
  }
  function stop(){running=false;cancelAnimationFrame(frame);keys.clear();cancelWalk();hovered=null;pendingSeat=null;afterStand=null;seated=null;doing=null;climbing=null;climbTarget=null;progress=0;localJump=0;stick.right=stick.forward=0;drive.reset();shorePending=false;own=null;if(travelView){({angle,tilt,wide}=travelView);travelView=null;}}
  function setBlocked(value){blocked=value;if(value){keys.clear();stick.right=stick.forward=0;pointerStart=null;hovered=null;}else if(running)last=performance.now();}
  function toggleCamera(){introView=false;wide=!wide;callbacks.onCamera(wide);return wide;}
  return {start,stop,find,takeSeat,takeActivity,stand,kick,jump,
    setStick(right,forward){stick.right=right;stick.forward=forward;},
    findGuest(id){const root=guests.get(id)?.root;if(!root)return;const dest=approachFor(root.position,avatar.position);if(dest){if(doing||seated){afterStand=()=>go(dest);stand();}else go(dest);}},
    interact:()=>interact(),toggleCamera,setBlocked,applyRoom,wave,
    setBall(b){ballState=b;},correct(p){cancelWalk();shorePending=false;drive.reset();progress=p.progress||0;snap(p);},clearRequest(){pendingSeat=null;shorePending=false;}};
}
