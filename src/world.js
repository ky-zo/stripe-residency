import * as T from 'three';
import { buildEnvironment, insideWarung, WARUNG, WARUNG_FOOTPRINT, WARUNG_GALLEY, warungFloor } from './environment.js';
import {soundscape,splash} from './ambience.js';
import {weatherAt} from '../shared/weather.js';
import { createFigure } from './models.js';
import { createDrive } from './drive.js';
import {createIslandDogs} from './island-dogs.js';
import {createDogRun} from './dog-runs.js';
import { createScooter, SCOOTER_RIG } from './scooter.js';
import { beachRadius, groundHeight, inLagoon, nearbyBeach, palmTrunk, climbSpots, climbPose, climbYaw, CLIMBERS_PER_PALM, jumpLift, JUMP_MS, shoreActivity, SCOOTER_START, scooterSpot, SWIM_LEVEL, waterEntry } from '../shared/mobility.js';
import { createNavigation } from './navigation.js';

import { HOME, PLAY_SPOTS, SWIMMER_INDEX, npcPadelShot, npcPose, playPose, createBeachBall } from './island-life.js';
import { ballAt, initialBall } from '../shared/ball.js';
import {appearanceKey,memberHandle} from '../shared/members.js';
import {activityId,activitySeat,climbKey,climbSlot} from '../shared/activities.js';
import {BOAT_START,BOULDER,PADEL,SUMMIT,SURF,SURF_BOOST_MS,boatSpot,boulderPose,isBoatSeat,clampToSummit,courtSide,floatable,leapFrom,leapPose,onCourt,seaPose,sideSign,summitFloor,summitRadius} from '../shared/sports.js';
import {DOG_REACH,HELD_TURN} from '../shared/dogs.js';
import {addIslandSports,sportObstacles} from './island-sports.js';

const movementKeys=['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'];
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const DOG_TAG_RANGE=3.6;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
// Figures stand on the warung boards as well as the sand.
const floorAt=(x,z)=>Math.max(groundHeight(x,z),warungFloor(x,z));

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
  const camera=new T.PerspectiveCamera(40,1,.1,360);
  const environment=buildEnvironment(T,scene,{shadowSize:mobile?1024:1536});
  const sports=addIslandSports(T,scene);
  // Showers fall in a column around the camera's focus. Each drop is a short slanted streak.
  const DROPS=mobile?700:1300,rainSpan=26;
  const rainPoints=new Float32Array(DROPS*6),drops=Array.from({length:DROPS},()=>({x:0,y:Math.random()*14,z:0,speed:8+Math.random()*3}));
  const rainGeometry=new T.BufferGeometry();rainGeometry.setAttribute('position',new T.BufferAttribute(rainPoints,3));
  const rainLines=new T.LineSegments(rainGeometry,new T.LineBasicMaterial({color:'#e4edf0',transparent:true,opacity:0,depthWrite:false}));
  rainLines.frustumCulled=false;rainLines.visible=false;scene.add(rainLines);
  for(const d of drops){d.x=(Math.random()-.5)*rainSpan;d.z=(Math.random()-.5)*rainSpan;}
  const forcedSky=new URLSearchParams(location.search).get('sky');
  const skyAt=now=>forcedSky==='rain'?{rain:1,wind:1}:forcedSky==='clear'?{rain:0,wind:.3}:weatherAt(now);
  let sky={rain:0,wind:.3},skyCheckedAt=-9,soundAt=0,lastLift=0;
  const splashTimes=new Map(),peerSeats=new Map();
  const listenerRight=new T.Vector3();
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
  const dogs=createIslandDogs(T).map(dog=>{
    scene.add(dog.root);
    const label=document.createElement('span');
    label.className='dog-label';label.dataset.dog=dog.name;label.textContent=dog.name;label.hidden=true;
    label.setAttribute('role','img');label.setAttribute('aria-label',dog.name+', island dog');
    callbacks.label.parentElement.append(label);
    const item={type:'dog',name:dog.name,label:dog.name,x:0,z:0,visible:true};
    // A returning dog takes the walkable way round the furniture.
    return {...dog,label,item,run:createDogRun(dog,(from,to)=>nav.path(from,to))};
  });
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
  const canoeSpot={...boatSpot(BOAT_START),type:'activity'};
  const spots=[...PLAY_SPOTS,...climbSpots,BOULDER,PADEL,SURF].map(s=>({...s,type:'activity'})).concat(parkedSpot,canoeSpot);
  let scooter,vehicleLoad;
  function loadBike(){
    if(scooter)scene.remove(scooter.root);
    scooter=createScooter(T);scene.add(scooter.root);vehicleLoad='loading';
    scooter.ready.then(()=>{vehicleLoad='ready';}).catch(()=>{vehicleLoad='failed';});
  }
  loadBike();
  const drive=createDrive();
  const waterPlane=new T.Plane(new T.Vector3(0,1,0),-SWIM_LEVEL),summitPlane=new T.Plane(new T.Vector3(0,1,0),-SUMMIT.y);
  const leapOffset=new T.Vector3(),upAxis=new T.Vector3(0,1,0);
  let scooterHit,boatHit,climbing=null,climbSide=0,progress=0,climbTarget=null,climbRate=0,localJump=0,leaping=false,summitAsked=-9,wasAirborne=false;
  const stick={right:0,forward:0};
  for(const spot of spots){
    const area=spot.id==='climb'?new T.CylinderGeometry(.42,.54,spot.palm.height*.95,9):
      spot.id==='ride'?new T.BoxGeometry(.84,1.12,1.75):
      spot.id==='boat'?new T.BoxGeometry(1.15,.85,2.95):spot.id==='boulder'?new T.BoxGeometry(2.40,2.25,1.85):
      spot.id==='padel'?new T.BoxGeometry(4.60,.65,7.2):spot.id==='surf'?new T.BoxGeometry(1.05,.85,2.25):
      spot.id==='lounge'?new T.BoxGeometry(.94,.72,1.92):new T.SphereGeometry(.53,10,8);
    const mesh=addTarget(area,spot.x,spot.hitY,spot.z,spot);
    if(spot.id==='lounge')mesh.rotation.y=spot.land.yaw-Math.PI;
    if(spot.id==='ride')scooterHit=mesh;
    if(spot.id==='boat')boatHit=mesh;
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
  const dogHit=new T.SphereGeometry(.40,10,8);
  for(const dog of dogs)dog.hit=addTarget(dogHit,0,.3,0,dog.item);
  // On the boulder top E sits or stands. The prompt reads from whichever of these is nearest.
  const perchSit={type:'perch',label:'Top of the boulder',sit:true},perchStand={type:'perch',label:'Top of the boulder',sit:false};
  hitLayer.updateMatrixWorld(true);
  // Paths use the island's permanent furniture. Passing residents give one another room.
  const obstacles=environment.obstacles.concat(sportObstacles);
  const nav=createNavigation(obstacles,[]),roads=createNavigation(obstacles.concat(WARUNG_FOOTPRINT),[],{clearance:.33});
  const seaRoutes=createNavigation([],[],{step:.75,width:81,height:51,passable:floatable});
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
  let route=[],arrival=null,seated=null,doing=null,afterStand=null,nearest=null,promptHolding='',hovered=null,spotlit=null,spotlightUntil=0;
  let angle=.105,tilt=.55,wide=!mobile,introView=!mobile,pointerStart=null,width=0,height=0;
  let travelView=null,orbitManuallyUntil=0,shorePending=false,shoreSentAt=0;
  let orbitRadius=0,following=null,repathAt=0,pendingSeat=null;
  const keys=new Set(),cameraFocus=new T.Vector3(0,.57,.4),desired=new T.Vector3(),offset=new T.Vector3();
  const heading=new T.Vector2(),lead=new T.Vector2(),lastSeen=new T.Vector2();
  const projection=new T.Vector3(),groundHit=new T.Vector3(),seaHit=new T.Vector3(),surfaceHit=new T.Vector3();
  function resize() {
    width=host.clientWidth;height=host.clientHeight;
    if(!width||!height)return;
    camera.aspect=width/height;camera.updateProjectionMatrix();
    renderer.setSize(width,height,false);
  }
  const observer=new ResizeObserver(resize);observer.observe(host);
  // The warung's walls and roof as one box, a little larger for the eaves.
  const house={x0:WARUNG_FOOTPRINT.x-WARUNG_FOOTPRINT.w/2-.3,x1:WARUNG_FOOTPRINT.x+WARUNG_FOOTPRINT.w/2+.3,
    z0:WARUNG_FOOTPRINT.z-WARUNG_FOOTPRINT.d/2-.4,z1:WARUNG_FOOTPRINT.z+WARUNG_FOOTPRINT.d/2+.4,top:3.75};
  // Whether the warung stands between a camera at orbit angle `a` and the walker's head.
  function houseHides(a,p,horizontal){
    const r=horizontal/Math.cos(tilt),ex=cameraFocus.x+Math.sin(a)*Math.cos(tilt)*r,ey=cameraFocus.y+Math.sin(tilt)*r,ez=cameraFocus.z+Math.cos(a)*Math.cos(tilt)*r;
    for(let k=1;k<28;k++){
      const t=k/28,x=ex+(p.x-ex)*t,y=ey+(p.y+1.15-ey)*t,z=ez+(p.z-ez)*t;
      if(y<house.top&&x>house.x0&&x<house.x1&&z>house.z0&&z<house.z1)return true;
    }
    return false;
  }
  function setCamera(dt,snap=false) {
    const p=avatar.position;
    const narrow=camera.aspect<.95;
    const follow=T.MathUtils.lerp(wide?.04:(narrow?.88:.68),1,T.MathUtils.smoothstep(Math.hypot(p.x,p.z),13,28));
    const trackSwim=doing==='swim'&&!wide;
    const active=!wide&&Boolean(doing)&&doing!=='lounge';
    // Smoothed ground velocity. A jump of more than 12 m/s is a snap or correction.
    const vx=dt?(p.x-lastSeen.x)/dt:0,vz=dt?(p.z-lastSeen.y)/dt:0;lastSeen.set(p.x,p.z);
    if(snap||!dt||Math.hypot(vx,vz)>12)heading.set(0,0);
    else heading.lerp({x:vx,y:vz},1-Math.exp(-dt*5));
    const speed=heading.length(),handsOff=!wide&&!reduced&&!pointerStart&&elapsed>orbitManuallyUntil,followFrom=angle;
    if((doing==='ride'||doing==='boat')&&!wide&&!pointerStart&&elapsed>orbitManuallyUntil&&(Math.abs(drive.speed)>.20||own?.seat==='play:boat:bow'&&own.walking)){
      const behind=avatar.rotation.y+Math.PI+(doing==='boat'?.67:0)-angle;
      angle+=Math.atan2(Math.sin(behind),Math.cos(behind))*(1-Math.exp(-dt*2.6));
    }else if((!doing||doing==='swim')&&handsOff&&speed>.6){
      // On foot the view eases round behind the walk. Heading toward the camera leaves it put.
      const behind=Math.atan2(heading.x,heading.y)+Math.PI-angle,turnBy=Math.atan2(Math.sin(behind),Math.cos(behind));
      const weight=1-T.MathUtils.smoothstep(Math.abs(turnBy),1.75,2.45);
      angle+=turnBy*(1-Math.exp(-dt*.14*weight*Math.min(1,speed/3.6)));
    }
    // Lead the frame a little in the direction of travel.
    const leads=!wide&&!reduced&&(!doing||['swim','ride','boat','surf'].includes(doing));
    const reach=leads?Math.min(speed*.3,doing==='ride'||doing==='boat'||doing==='surf'?1.9:1.1):0;
    const aim=speed>.05?reach/speed:0;
    lead.lerp({x:heading.x*aim,y:heading.y*aim},snap?1:1-Math.exp(-dt*2.2));
    desired.set(active?p.x:p.x*follow,wide?1.0:climbing?p.y+1.1:doing==='summit'?SUMMIT.y+.85:trackSwim?-.20:doing==='surf'||doing==='boat'?.12:.85+floorAt(p.x,p.z),active?p.z:p.z*follow+(wide?-.62:-.65));
    desired.x+=lead.x;desired.z+=lead.y;
    if(doing==='padel'&&!wide)desired.set(PADEL.x,.40,PADEL.z);
    const smoothing=snap||reduced?1:1-Math.exp(-dt*(active?9:3.7));
    cameraFocus.lerp(desired,smoothing);
    const horizontalRadius=wide?Math.max(15.8,12.6/camera.aspect):doing==='padel'?Math.max(8,5.85/camera.aspect):trackSwim?(narrow?6.3:8.6):doing==='boulder'||doing==='summit'?(narrow?6.8:8.2):narrow?8.6:12.15;
    orbitRadius+= (horizontalRadius-orbitRadius)*(snap||!orbitRadius||reduced?1:1-Math.exp(-dt*3.1));
    // Behind the warung, the view swings round the nearer way until the walker is back in sight.
    if((!doing||doing==='swim')&&handsOff&&!snap&&distance(p,WARUNG_FOOTPRINT)<9&&!insideWarung(p.x,p.z)&&houseHides(angle,p,orbitRadius)){
      if(!houseHides(followFrom,p,orbitRadius))angle=followFrom;
      else for(let k=1;k<=44;k++){
        const step=Math.ceil(k/2)*.12*(k%2?1:-1);
        if(!houseHides(angle+step,p,orbitRadius)){angle+=(step+Math.sign(step)*.18)*(1-Math.exp(-dt*2.4));break;}
      }
    }
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
    if(doing==='boat'){
      const fore=own?.seat==='play:boat:bow'?.52:-.52,yaw=avatar.rotation.y;
      labelAt(callbacks.youLabel,{x:p.x+Math.sin(yaw)*fore,z:p.z+Math.cos(yaw)*fore},p.y+1.49);
    }else labelAt(callbacks.youLabel,p,p.y+(doing==='swim'?.99:doing==='lounge'?1.18:own?.rest?1.36:1.85),!seated);
    for(const dog of dogs){
      const position=dog.root.position;
      // A dog's name tag shows only once you are close enough to greet it.
      labelAt(dog.label,position,position.y+dog.labelHeight,dog.item.visible&&distance(p,position)<DOG_TAG_RANGE);
    }
    const current=hovered || (elapsed<spotlightUntil?spotlit:null) || (nearest?.type==='resident' && !ensemble.claims[nearest.resident.handle]?nearest:null);
    if(current){
      const text=current.type==='resident'?current.resident.shortName:(current.label||'Guest');
      if(callbacks.label.textContent!==text)callbacks.label.textContent=text;
    }
    labelAt(callbacks.label,current,current?.labelY??(current?.type==='seat'?1.06:current?.type==='ball'?.87:1.87),!seated&&!doing&&current?.visible!==false&&current?.type!=='dog');
  }
  function scanNearby() {
    const p=avatar.position;
    let closest=null,dist=1.68;
    // Places come before people. Someone on a palm shares its footing, so a free palm wins the tie.
    const nearbyItems=doing==='swim'?[canoeSpot,spots.find(s=>s.id==='surf')]:[...spots,...seats,ballTarget,...dogs.map(d=>d.item),...byHandle.values()];
    const carried=heldDog();
    if(doing==='summit')closest=own?.rest?perchStand:perchSit;
    else if(carried&&!seated&&!doing)closest=carried.item;
    else if(!seated&&(!doing||doing==='swim'))for(const point of nearbyItems){
      if(point.visible===false)continue;
      const d=distance(p,point.land||point);
      if(d>=dist || point.type==='seat'&&seatOwner(point) || point.type==='activity'&&!spotOpen(point))continue;
      dist=d;closest=point;
    }
    if(!seated&&!doing&&!carried&&spotlit?.visible!==false&&spotlit&&elapsed<spotlightUntil&&distance(spotlit.land||spotlit,p)<1.68)closest=spotlit;
    // Picking up or setting down a dog changes the prompt for the same dog.
    const holding=carried?.name||'';
    if(closest!==nearest||holding!==promptHolding){nearest=closest;promptHolding=holding;callbacks.onNearby(nearest);}
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
    if(!running||blocked||seated||pendingSeat||shorePending||ensemble.status!=='online')return;
    if(doing==='surf'||doing==='padel'){room.trigger('sportAction');return;}
    if(doing==='summit'){
      if(own?.rest){toggleRest();return;}
      if(leaping)return;
      // At the rim, facing out, a jump carries you off the rock.
      const p=avatar.position,r=summitRadius(p.x,p.z),yaw=avatar.rotation.y;
      const out=Math.atan2((p.x-SUMMIT.x)/SUMMIT.rx,(p.z-SUMMIT.z)/SUMMIT.rz);
      if(r>.74&&Math.cos(yaw-out)>.3){leap();return;}
    }else if(doing)return;
    const now=room.now();
    if(now-Math.max(localJump,own?.jumpAt||0)<JUMP_MS+85)return;
    if(room.trigger('jump'))localJump=now;
  }
  function move(dt) {
    if(seated||doing==='lounge'||pendingSeat||shorePending||blocked||(ensemble.status!=='online'&&own))return false;
    if(leaping||landing(room.now())||doing==='summit'&&own?.rest)return false;
    const p=avatar.position,axes=inputAxes();
    if(climbing){
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
      if(doing==='boulder'&&progress>=.995&&!pendingSeat&&elapsed-summitAsked>2.5){
        // Topping out steps onto the summit, where the climber walks freely.
        pendingSeat=SUMMIT;climbTarget=null;summitAsked=elapsed;
        room.pose(p.x,p.z,avatar.rotation.y,false,true,progress);
        if(!room.trigger('summit'))pendingSeat=null;
      }
      climbRate=T.MathUtils.clamp((progress-before)/Math.max(.001,dt*.39),-1,1);
      return Math.abs(progress-before)>.0001;
    }
    const manual=Math.hypot(axes.right,axes.forward)>.08;
    if(manual){if(doing==='swim'&&route.length)afterStand=null;followCamera();cancelWalk();}
    if(doing==='boat'&&own?.seat==='play:boat:bow')return false;
    if(doing==='ride'||doing==='boat'){
      const moving=drive.step(avatar,doing==='boat'?seaRoutes:roads,dt,axes,route);
      if(!route.length)marker.visible=false;
      return moving;
    }
    // In the air, low furniture and bushes pass beneath. Landing on one slides you off onto open sand.
    const air=doing?0:jumpLift(Math.max(localJump,own?.jumpAt||0),room.now());
    if(!doing&&!air&&wasAirborne&&!nav.canStand(p.x,p.z))slideOff(p);
    wasAirborne=air>0;
    const onWetSand=!doing&&groundHeight(p.x,p.z)<SWIM_LEVEL;
    const boost=doing==='surf'&&room.now()-(own?.strokeAt||0)<SURF_BOOST_MS;
    const speed=doing==='surf'?(boost?6.7:4.25):doing==='padel'?3.2:doing==='summit'?1.55:doing==='swim'?2.85:onWetSand?1.85:manual?3.65:3.85;
    if(manual){
      const len=Math.max(1,Math.hypot(axes.right,axes.forward)),lr=axes.right/len,fb=-axes.forward/len;
      const x=lr*Math.cos(angle)+fb*Math.sin(angle),z=fb*Math.cos(angle)-lr*Math.sin(angle);
      const step=speed*dt,dx=x*step,dz=z*step;
      const lastX=p.x,lastZ=p.z;
      const canMove=doing==='padel'?(x,z)=>onCourt(x,z,courtSide(own.seat)):doing==='summit'?(x,z)=>summitRadius(x,z)<=1:
        air?(x,z)=>nav.canStand(x,z)||clears(x,z,air):nav.canStand;
      if(canMove(p.x+dx,p.z))p.x+=dx;
      if(canMove(p.x,p.z+dz))p.z+=dz;
      if(doing!=='padel')turn(Math.atan2(x,z),dt);
      return Math.abs(p.x-lastX)+Math.abs(p.z-lastZ)>.001;
    }
    if(following && elapsed>repathAt){
      repathAt=elapsed+.52;
      const target=following,d=distance(p,target.land||target);
      if(d<1.23){finishFind(target);return false;}
      const next=approachFor(target,p);
      if(next && (!route.length||distance(next,route.at(-1))>.44)){go(next,()=>finishFind(target),true);following=target;}
    }
    if(boost&&!route.length){
      const x=p.x+Math.sin(avatar.rotation.y)*speed*dt,z=p.z+Math.cos(avatar.rotation.y)*speed*dt;
      if(floatable(x,z)){p.x=x;p.z=z;return true;}
    }
    if(!route.length)return false;
    let budget=speed*dt;
    while(route.length && budget>0){
      const next=route[0],dx=next.x-p.x,dz=next.z-p.z,len=Math.hypot(dx,dz);
      if(len>.02&&doing!=='padel')turn(Math.atan2(dx,dz),dt);
      if(len<=budget){p.x=next.x;p.z=next.z;route.shift();budget-=len;}
      else{p.x+=dx*budget/len;p.z+=dz*budget/len;budget=0;}
    }
    if(!route.length){
      marker.visible=false;
      const done=arrival;arrival=null;done?.();
    }
    return true;
  }
  function clears(x,z,height){
    return inLagoon(x,z)&&obstacles.every(o=>o.h<height-.04||Math.abs(x-o.x)>=o.w/2+.24||Math.abs(z-o.z)>=o.d/2+.24);
  }
  function slideOff(p){
    const yaw=avatar.rotation.y;
    for(let r=.1;r<=1.6;r+=.1)for(const turn of [0,.5,-.5,1,-1,1.6,-1.6,2.2,-2.2,Math.PI]){
      const x=p.x+Math.sin(yaw+turn)*r,z=p.z+Math.cos(yaw+turn)*r;
      if(nav.canStand(x,z)){p.x=x;p.z=z;return;}
    }
    const n=nav.nearest(p);if(n){p.x=n.x;p.z=n.z;}
  }
  function go(point,done=null,mark=true) {
    if(seated||climbing||doing==='lounge'||own?.seat==='play:boat:bow')return false;
    if(doing==='padel'){
      const sign=sideSign(courtSide(own.seat));
      route=[{x:T.MathUtils.clamp(point.x,PADEL.x-1.94,PADEL.x+1.94),z:PADEL.z+sign*T.MathUtils.clamp((point.z-PADEL.z)*sign,.52,3.28)}];
      marker.visible=false;return true;
    }
    if(doing==='summit'){
      const end=clampToSummit(point.x,point.z);route=[end];arrival=done;following=null;
      marker.visible=mark;marker.position.set(end.x,summitFloor(end.x,end.z)+.042,end.z);return true;
    }
    if(doing==='boat'&&!floatable(point.x,point.z))return false;
    followCamera();
    const map=doing==='ride'?roads:doing==='boat'?seaRoutes:nav;
    const points=map.path(avatar.position,point);
    if(!points?.length)return false;
    following=null;route=points;arrival=done;const end=points.at(-1);
    marker.visible=mark;marker.position.set(end.x,Math.max(SWIM_LEVEL,floorAt(end.x,end.z))+.042,end.z);
    return true;
  }
  function seatOwner(seat){return ensemble.players.find(p=>p.seat!==null&&String(p.seat)===String(seat.id));}
  function spotOpen({id,key}){
    if(id==='climb')return ensemble.players.filter(p=>climbKey(p.seat)===key).length<CLIMBERS_PER_PALM;
    if(id==='boat'||id==='padel')return ensemble.players.filter(p=>activityId(p.seat)===id).length<(id==='padel'?4:2);
    return !ensemble.players.some(p=>p.seat===activitySeat(id,own?.id,key));
  }
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
    const approach=seat.approach||{x:seat.x-Math.sin(seat.facing)*.71,z:seat.z-Math.cos(seat.facing)*.71};
    if(immediate&&distance(seat,p)<2.15)request();
    else if(go(approach,request))callbacks.notice('Walking to '+seat.label);
  }
  function takeActivity(id,key=null){
    if(doing===id||pendingSeat||shorePending)return;
    if(id==='ride'&&vehicleLoad==='failed'){loadBike();callbacks.notice('Loading the motorbike…');}
    const waterBoarding=doing==='swim'&&(id==='boat'||id==='surf');
    if(seated||doing&&!waterBoarding){afterStand=()=>takeActivity(id,key);stand();return;}
    if(ensemble.status!=='online'){callbacks.notice('Waiting for the shared island');return;}
    const candidates=spots.filter(s=>s.id===id&&(!key||s.key===key)).sort((a,b)=>distance(a.land,avatar.position)-distance(b.land,avatar.position));
    const spot=candidates.find(spotOpen);
    if(!spot){callbacks.notice({climb:'This palm is full. Choose another tree.',ride:'Someone is riding the motorbike.',boat:'Both canoe seats are taken.',padel:'Four players are already on court.',boulder:'Someone is on the boulder.'}[id]||'The sunbed is occupied.');return;}
    const request=()=>{
      if(id==='swim'){go(waterEntry(own.id));return;}
      if(id==='boat'&&distance(avatar.position,spot.land)>2.7){callbacks.notice('The canoe moved. Board it when it comes alongside.');return;}
      pendingSeat=spot;
      const p=avatar.position;room.pose(p.x,p.z,avatar.rotation.y,false,true);
      if(!room.trigger('activity',{id,key:spot.key}))pendingSeat=null;
    };
    if(distance(spot.land,avatar.position)<(id==='boat'?2.35:.8))request();
    else if(go(spot.land,request))callbacks.notice({swim:'Walking to the swimming cove',ride:'Walking to the motorbike',climb:'Walking to the palm',lounge:'Walking to the sunbed',surf:'Heading to the surfboards',boat:'Heading to the canoe',boulder:'Walking to the boulder',padel:'Walking to the padel court'}[id]);
  }
  function stand(){
    if(shorePending)return;
    if(doing==='summit'){leap();return;}
    if(climbing&&!afterStand&&progress>.025){climbTarget=0;callbacks.notice('Climbing down');}
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
    if(seated||doing&&doing!=='swim'){afterStand=()=>find(handle);stand();return;}
    const destination=approachFor(target,avatar.position);
    if(!destination)return;
    introView=false;wide=false;callbacks.onCamera(false);spotlit=target;spotlightUntil=elapsed+16;
    if(go(destination,()=>finishFind(target))){following=target;repathAt=elapsed+.5;}
  }
  function visitWarung(){
    if(seated||doing&&doing!=='swim'){afterStand=visitWarung;stand();return;}
    if(pendingSeat||shorePending)return;
    introView=false;wide=false;callbacks.onCamera(false);
    const galley=WARUNG_GALLEY;
    if(distance(avatar.position,galley)<.3){avatar.rotation.y=galley.yaw;return;}
    if(go(galley,()=>{avatar.rotation.y=galley.yaw;callbacks.notice('Behind the warung counter');}))callbacks.notice('Walking into the warung');
  }
  function kick(){
    if(seated||doing)return;
    if(distance(avatar.position,ballTarget)<2.35){room.trigger('kick');return;}
    const aim=approachFor(ballTarget,avatar.position);
    if(aim)go(aim,()=>room.trigger('kick'));
  }
  function heldDog(id=ensemble.ownId){
    return id?dogs.find(d=>ensemble.dogs?.[d.name]?.holder===id)||null:null;
  }
  function toggleDog(item){
    const mine=heldDog(),p=avatar.position,yaw=avatar.rotation.y;
    if(mine){
      // Set the dog down a step ahead, where it can stand.
      const spot={x:p.x+Math.sin(yaw)*.55,z:p.z+Math.cos(yaw)*.55};
      room.pose(p.x,p.z,yaw,false,true);
      room.trigger('dog',{name:mine.name,hold:false,spot:nav.canStand(spot.x,spot.z)?spot:null});
      return;
    }
    if(seated||doing||!item?.visible)return;
    const pick=()=>{
      if(distance(avatar.position,item)>DOG_REACH)return;
      const q=avatar.position;room.pose(q.x,q.z,avatar.rotation.y,false,true);
      room.trigger('dog',{name:item.name,hold:true});
    };
    if(distance(p,item)<=DOG_REACH){cancelWalk();avatar.rotation.y=Math.atan2(item.x-p.x,item.z-p.z);pick();}
    else if(go({x:item.x,z:item.z},pick))callbacks.notice('Running after '+item.name);
  }
  function toggleRest(){
    if(doing!=='summit'||pendingSeat||leaping||landing(room.now()))return;
    cancelWalk();const p=avatar.position;room.pose(p.x,p.z,avatar.rotation.y,false,true);
    room.trigger('rest',{on:!own?.rest});
  }
  // Jump from the summit to open sand: the way you face, or the nearest clear way round.
  function leap(){
    if(doing!=='summit'||leaping||pendingSeat)return;
    const p=avatar.position,yaw=avatar.rotation.y;
    const out=Math.atan2((p.x-SUMMIT.x)/SUMMIT.rx,(p.z-SUMMIT.z)/SUMMIT.rz);
    const aim=summitRadius(p.x,p.z)>.2&&Math.cos(yaw-out)<.2?out:yaw;
    const exit=leapFrom(p,aim,(x,z)=>nav.canStand(x,z)&&!shoreActivity(null,x,z));
    if(own?.rest)room.trigger('rest',{on:false});
    leaping=true;cancelWalk();room.pose(p.x,p.z,yaw,false,true);
    if(!room.trigger('stand',{exit}))leaping=false;
  }
  const landing=now=>Boolean(own?.from&&own.seat===null&&now-own.jumpAt<JUMP_MS);
  function interact(point=nearest) {
    if(!point||blocked||seated)return;
    if(point.type==='perch'){toggleRest();return;}
    if(doing&&!(doing==='swim'&&['boat','surf'].includes(point.id)))return;
    if(point.type==='dog'){toggleDog(point);return;}
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
  function clearVisitors(){
    for(const [id,guest] of guests)removeGuest(id,guest);
    for(const id of peers.keys())environment.setSwimmer(null,0,id);
    peers.clear();
    for(const label of peerLabels.values())label.remove();
    peerLabels.clear();
    for(const bubble of waveLabels.values())bubble.el.remove();
    waveLabels.clear();
  }
  function applyRoom(state,welcome=false){
    ensemble=state;
    Object.assign(parkedSpot,scooterSpot(state.scooter||SCOOTER_START));
    parkedSpot.visible=!state.players.some(p=>activityId(p.seat)==='ride');
    scooterHit.layers.set(parkedSpot.visible?0:1);
    scooterHit.position.set(parkedSpot.x,groundHeight(parkedSpot.x,parkedSpot.z)+.58,parkedSpot.z);scooterHit.rotation.y=parkedSpot.land.yaw;
    if(state.status!=='online'){pendingSeat=null;shorePending=false;clearVisitors();return;}
    const next=state.players.find(p=>p.id===state.ownId);
    if(!next)return;
    const directory=new Map((state.members||[]).map(m=>[m.id,m]));
    const member=directory.get(next.memberId);
    const prev=own;own=next;ballState=state.ball||initialBall;
    outfit(next.handle,next.color,member?.appearance);
    if(welcome||!prev||next.handle!==prev.handle||next.seat!==prev.seat){
      const crossing=shorePending&&!welcome&&prev?.seat!==next.seat;
      if(!crossing)cancelWalk();
      pendingSeat=null;shorePending=false;leaping=false;drive.reset();snap(next);
      const seat=seats.find(s=>String(s.id)===String(next.seat))||null;
      const oldSeat=seated,oldActivity=doing;seated=seat;doing=activityId(next.seat);ring.visible=!seat&&!doing;
      climbing=doing==='boulder'?BOULDER:doing==='climb'?climbSpots.find(s=>s.key===climbKey(next.seat)):null;climbSide=climbSlot(next.seat);
      progress=next.progress||0;climbTarget=doing==='climb'&&!progress?1:null;localJump=next.jumpAt||0;
      if(doing&&doing!=='lounge'){
        if(!travelView)travelView={angle,tilt,wide};
        if(doing==='swim'){
          if(!crossing)angle=Math.PI-.31;
          tilt=.39;avatar.position.y=SWIM_LEVEL;
          if(oldActivity==='ride')callbacks.notice('Splash! The scooter is back at its parking spot.');
        }else if(doing==='padel'){angle=courtSide(next.seat)==='south'?0:Math.PI;tilt=.68;}
        else if(doing==='surf'){angle=next.yaw+Math.PI;tilt=.37;}
        else if(doing==='boat'){angle=next.yaw+Math.PI+.67;tilt=.43;}
        else if(doing==='ride'){angle=next.yaw+Math.PI;tilt=.47;}
        else if(climbing){angle=(doing==='climb'?climbYaw(climbing,climbSide):climbing.land.yaw)+Math.PI+.54;tilt=.42;}
        else if(doing==='summit'){tilt=Math.max(tilt,.5);callbacks.notice('Topped out!');}
        wide=false;introView=false;callbacks.onCamera(false);if(!crossing)setCamera(0,true);
      }else if(travelView){
        if(crossing)tilt=travelView.tilt;else ({angle,tilt,wide}=travelView);
        travelView=null;callbacks.onCamera(wide);if(!crossing)setCamera(0,true);
      }
      if(seat&&!oldSeat)callbacks.onSit(seat);
      else if(!seat&&oldSeat)callbacks.onLeaveSeat();
      if(doing!==oldActivity||welcome||prev?.seat!==next.seat){callbacks.onActivity(doing,next.seat);environment.setSwimmer(null,0,'self');}
      if(!welcome&&prev&&doing!==oldActivity){
        const p=avatar.position;
        if(['swim','surf','boat'].includes(doing)&&oldActivity!=='swim')splashAt('enter',doing==='swim'?.95:.55,p.x,p.z);
        else if(oldActivity==='boat'||oldActivity==='surf')splashAt('enter',.8,p.x,p.z);
        else if(oldActivity==='swim'&&!doing)splashAt('enter',.3,p.x,p.z);
      }
      if(!seated&&(!doing||doing==='swim'&&['surf','boat'].includes(oldActivity))&&afterStand){const resume=afterStand;afterStand=null;resume();}
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
  const swingEffort=(at,now)=>at&&now-at<550?Math.sin(Math.PI*Math.max(0,now-at)/550):0;
  function place(fig,p,dt,now,actorId){
    const root=fig.root;
    const d=Math.hypot(root.position.x-p.x,root.position.z-p.z);
    const alpha=d>2.2||!actorId?1:1-Math.exp(-dt*14);
    root.position.x+=(p.x-root.position.x)*alpha;root.position.z+=(p.z-root.position.z)*alpha;
    root.position.y=p.y||0;
    const turnBy=Math.atan2(Math.sin(p.yaw-root.rotation.y),Math.cos(p.yaw-root.rotation.y));
    root.rotation.order='YXZ';
    root.rotation.y+=turnBy*alpha;root.rotation.x=p.pitch||0;root.rotation.z=p.roll||0;
    // Residents climbing down send -1 so the climb cycle runs backwards.
    const walk=p.walking&&(!p.at||now-p.at<750)?(p.walking<0?-1:1):0;
    const effort=p.activity==='padel'?swingEffort(p.strokeAt,now):walk;
    fig.animate(reduced&&!walk&&!p.waveAt&&!['climb','ride','jump','swim','surf','boat','boat-passenger','padel','boulder'].includes(p.activity)?0:now/1000,effort,Boolean(p.seated),envelope(p.waveAt,now),p.activity,p.progress||0,Boolean(p.holding));
  }
  function peerPose(p,now){
    const id=activityId(p.seat);
    if(id==='boulder')return {...p,...boulderPose(p.progress||0),activity:id};
    if(id==='boat'){const b=liveBoat();return {...p,...seaPose(b.x,b.z,b.yaw,now,id,p.seat),activity:p.seat==='play:boat:bow'?'boat-passenger':id};}
    if(id==='surf')return {...p,...seaPose(p.x,p.z,p.yaw,now,id,p.seat),activity:id};
    if(id==='padel')return {...p,y:0,activity:id};
    if(id==='lounge')return {...playPose(id,now,p.id),waveAt:p.waveAt};
    if(id==='climb'){
      const spot=climbSpots.find(s=>s.key===climbKey(p.seat));
      if(spot)return {...p,...climbPose(spot,p.progress||0,climbSlot(p.seat)),activity:id,land:spot.land};
    }
    if(id==='swim')return {...p,...playPose(id,now,p.id,p)};
    if(id==='summit'){
      const lift=p.rest?0:jumpLift(p.jumpAt,now);
      return {...p,y:summitFloor(p.x,p.z)+lift,activity:p.rest?'perch':lift?'jump':'',seated:false};
    }
    const floor=floorAt(p.x,p.z);
    if(p.seat===null&&p.from&&now-p.jumpAt<JUMP_MS)return {...p,...leapPose(p.from,{x:p.x,y:floor,z:p.z},(now-p.jumpAt)/JUMP_MS),activity:'jump',seated:false};
    if(id==='ride')return {...p,y:floor+SCOOTER_RIG.rider.y,activity:id};
    const lift=p.seat===null?jumpLift(p.jumpAt,now):0;
    const bench=p.seat!==null&&seats.find(s=>String(s.id)===String(p.seat))?.leisure;
    return {...p,y:floor+lift,wading:floor+lift<SWIM_LEVEL-.015,activity:lift?'jump':bench?'bench':'',seated:p.seat!==null};
  }
  // The server never echoes a paddler's own strokes, so on their screen the avatar steers the canoe.
  function liveBoat(){
    return own?.seat==='play:boat:helm'?{x:avatar.position.x,z:avatar.position.z,yaw:avatar.rotation.y}:room.get().boat||BOAT_START;
  }
  // The crew sit in the canoe as it is drawn this frame instead of trailing behind it.
  function seatCrew(boat,now){
    for(const p of ensemble.players){
      if(p.id===ensemble.ownId||!isBoatSeat(p.seat))continue;
      const root=p.handle?figures[byHandle.get(p.handle)?.index]?.root:guests.get(p.id)?.root;
      if(!root)continue;
      const pose=seaPose(boat.x,boat.z,boat.yaw,now,'boat',p.seat);
      root.position.set(pose.x,pose.y,pose.z);root.rotation.y=pose.yaw;
    }
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
    Object.assign(info,{x,z,land:pose.land||null,labelY:y+(low?.98:lounging?1.13:pose.activity==='perch'?1.36:pose.seated?1.52:1.87)});
    hit.position.set(x,y+(low?.37:lounging?.61:.86),z);
    hit.scale.set(1,low?.56:lounging?.70:1,lounging?1.65:1);
    hit.rotation.y=fig.root.rotation.y;
  }
  // Shared spots players hold right now. Residents on the timetable make way for them.
  function heldSpots(now){
    const busy={padel:false,boulder:false,palms:{},seats:new Set()};
    for(const p of ensemble.players){
      const id=activityId(p.seat);
      if(id==='padel')busy.padel=true;
      else if(id==='boulder'||id==='summit')busy.boulder=true;
      else if(id==='climb')(busy.palms[climbKey(p.seat)]??=new Set()).add(climbSlot(p.seat));
      else if(p.seat!==null&&p.seat!==undefined&&!id)busy.seats.add(Number(p.seat));
    }
    const shot=ensemble.court?.shot;
    if(shot&&now-shot.start<6000)busy.padel=true;
    return busy;
  }
  // A resident whose spot was just taken, or who was just let go, walks to the timetable instead of jumping.
  const onFoot=p=>!p.y&&!['swim','surf','climb','boulder','lounge','read'].includes(p.activity);
  const trails=[];let lastCast=0,residentRally=null;
  function makeWay(i,fig,pose,dt){
    const prior=trails[i],root=fig.root.position;
    const trail=trails[i]={x:pose.x,z:pose.z,foot:onFoot(pose),route:prior?.route??null,goal:prior?.goal??null};
    if(!prior||!trail.foot){trail.route=null;return pose;}
    const jump=Math.hypot(pose.x-prior.x,pose.z-prior.z);
    if(!trail.route&&prior.foot&&jump>.4+2.5*dt&&jump<10){trail.route=roads.path(root,pose)||[];trail.goal={x:pose.x,z:pose.z};}
    if(!trail.route)return pose;
    if(Math.hypot(trail.goal.x-pose.x,trail.goal.z-pose.z)>1.2){trail.route=roads.path(root,pose)||[];trail.goal={x:pose.x,z:pose.z};}
    const steps=[...trail.route,{x:pose.x,z:pose.z}];
    let x=root.x,z=root.z,yaw=fig.root.rotation.y,budget=1.7*dt;
    while(budget>0&&steps.length){
      const next=steps[0],d=Math.hypot(next.x-x,next.z-z);
      if(d>.001)yaw=Math.atan2(next.x-x,next.z-z);
      if(d<=budget){x=next.x;z=next.z;budget-=d;steps.shift();}
      else{x+=(next.x-x)*budget/d;z+=(next.z-z)*budget/d;budget=0;}
    }
    if(!steps.length){trail.route=null;return pose;}
    trail.route=steps.slice(0,-1);
    return {...pose,x,z,y:floorAt(x,z),yaw,walking:true,seated:false,activity:'',strokeAt:0,land:null};
  }
  function updateCast(dt,now){
    // After a hidden tab, everyone simply appears where the timetable has them.
    if(now-lastCast>500)trails.length=0;
    lastCast=now;
    const busy=heldSpots(now);
    residentRally=busy.padel?null:npcPadelShot(now);
    for(let i=0;i<figures.length;i++){
      const fig=figures[i],info=residentPositions[i];
      if(!info.visible){if(i===SWIMMER_INDEX)environment.setSwimmer(null,now);continue;}
      const holder=ensemble.claims[residents[i].handle],peer=holder&&peers.get(holder);
      let pose;
      if(peer)pose=peerPose(peer,now);
      else if(holder)pose={x:fig.root.position.x,z:fig.root.position.z,yaw:fig.root.rotation.y,walking:false};
      else pose=makeWay(i,fig,npcPose(i,now,busy),dt);
      if(!peer)pose.waveAt=replyWaves.get(residents[i].handle)||0;
      else pose.holding=Boolean(heldDog(peer.id));
      place(fig,pose,dt,now,holder);
      positionTarget(info,residentHits[i],fig,pose);
      if(i===SWIMMER_INDEX)environment.setSwimmer(!holder?pose:null,now);
      else if(!holder){environment.setSwimmer(pose,now,'npc'+i);sports.equip('npc'+i,fig,pose.activity,{...pose,x:fig.root.position.x,z:fig.root.position.z},pose.boost||0);}
      if(holder)trails[i]={x:fig.root.position.x,z:fig.root.position.z,foot:onFoot(pose)};
      if(peer){environment.setSwimmer(pose,now,peer.id);sports.equip(peer.id,fig,pose.activity,{...pose,x:fig.root.position.x,z:fig.root.position.z},Number(now-(peer.strokeAt||0)<SURF_BOOST_MS));}
    }
    for(const [id,guest] of guests){
      const p=peers.get(id);if(!p)continue;
      const pose=peerPose(p,now);pose.holding=Boolean(heldDog(id));
      place(guest,pose,dt,now,id);environment.setSwimmer(pose,now,id);sports.equip(id,guest,pose.activity,{...pose,x:guest.root.position.x,z:guest.root.position.z},Number(now-(p.strokeAt||0)<SURF_BOOST_MS));
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
    if(climbing){
      const base=doing==='boulder'?BOULDER.land:climbing;
      const bottom=new T.Vector3(base.x,0,base.z).project(camera);
      const top=doing==='boulder'?boulderPose(1):climbPose(climbing,1,climbSide),upper=new T.Vector3(top.x,top.y+(doing==='boulder'?.02:1.1),top.z).project(camera);
      climbTarget=T.MathUtils.clamp((pointer.y-bottom.y)/(upper.y-bottom.y),0,1);return;
    }
    if(doing==='summit'){
      if(ray.ray.intersectPlane(summitPlane,surfaceHit)&&summitRadius(surfaceHit.x,surfaceHit.z)<1.6)go(surfaceHit);
      return;
    }
    if(picked&&(!doing||doing==='swim'&&['boat','surf'].includes(picked.id))){interact(picked);return;}
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
    if(k==='e'&&!e.repeat){e.preventDefault();if(doing==='summit')toggleRest();else if(!doing||doing==='swim'&&['boat','surf'].includes(nearest?.id))interact();else stand();}
    if(e.code==='Space'){e.preventDefault();if(!e.repeat)jump();}
    if(k==='q'&&!e.repeat){e.preventDefault();room.trigger('wave');}
  });
  window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
  host.addEventListener('blur',()=>keys.clear());
  window.addEventListener('blur',()=>keys.clear());
  function updateRain(dt){
    const w=sky.rain;
    rainLines.visible=w>.01;
    if(!rainLines.visible)return;
    rainLines.material.opacity=.42*Math.min(1,w*1.4);
    const cx=cameraFocus.x,cz=cameraFocus.z,slant=.10+.22*sky.wind,count=Math.floor(DROPS*Math.min(1,.25+w));
    for(let i=0;i<DROPS;i++){
      const d=drops[i],o=i*6;
      d.y-=d.speed*dt;d.x+=slant*d.speed*dt;
      if(d.y<-.7||Math.abs(d.x)>rainSpan/2){d.y+=14;d.x=(Math.random()-.5)*rainSpan;d.z=(Math.random()-.5)*rainSpan;}
      const x=cx+d.x,z=cz+d.z,y=i<count?d.y:-50;
      rainPoints[o]=x;rainPoints[o+1]=y;rainPoints[o+2]=z;
      rainPoints[o+3]=x-slant*.38;rainPoints[o+4]=y+.38;rainPoints[o+5]=z;
    }
    rainGeometry.attributes.position.needsUpdate=true;
  }
  // Where the listener stands sets the mix: surf near the water, the gamelan near the warung.
  function listen(now){
    if(elapsed-skyCheckedAt>1){sky=skyAt(now);skyCheckedAt=elapsed;environment.setWeather(sky.rain);}
    if(elapsed-soundAt<.25)return;
    soundAt=elapsed;
    const p=avatar.position,toWarung=Math.hypot(p.x-WARUNG.x,p.z-WARUNG.z);
    const shore=doing==='swim'||doing==='surf'||doing==='boat'?1:T.MathUtils.smoothstep(beachRadius(p.x,p.z),.62,1.08);
    soundscape({shore,music:1-T.MathUtils.smoothstep(toWarung,4,22),rain:sky.rain,wind:sky.wind});
  }
  // Splashes: louder close by, panned to where they happen on screen.
  function splashAt(key,strength,x,z,every=0){
    const now=elapsed;
    if(every&&now-(splashTimes.get(key)||-9)<every)return;
    splashTimes.set(key,now);
    listenerRight.setFromMatrixColumn(camera.matrixWorld,0);
    const dx=x-cameraFocus.x,dz=z-cameraFocus.z,d=Math.hypot(dx,dz);
    splash(strength,Math.max(0,d-2),d>.5?T.MathUtils.clamp((dx*listenerRight.x+dz*listenerRight.z)/d,-1,1)*.7:0);
  }
  function waterSounds(now,walking,wading){
    const p=avatar.position;
    if(doing==='swim'&&walking)splashAt('self',.3,p.x,p.z,1.05);
    else if(doing==='boat'&&own?.seat==='play:boat:helm'&&walking)splashAt('self',.26,p.x,p.z,.95);
    else if(wading&&walking)splashAt('self',.14+.5*(SWIM_LEVEL-p.y),p.x,p.z,.34);
    if(doing==='surf'&&own?.strokeAt&&own.strokeAt!==splashTimes.get('stroke')){splashTimes.set('stroke',own.strokeAt);splashAt('surf',.45,p.x,p.z);}
    for(const peer of peers.values()){
      const id=activityId(peer.seat),before=peerSeats.get(peer.id);
      if(before!==undefined&&before!==peer.seat&&(id==='swim'||id==='surf'||id==='boat')&&activityId(before)!=='swim')splashAt(peer.id,.8,peer.x,peer.z);
      else if(id==='swim'&&peer.walking&&now-peer.at<750)splashAt(peer.id,.3,peer.x,peer.z,1.2);
      peerSeats.set(peer.id,peer.seat);
    }
  }
  // Carried dogs ride in their holder's arms. Everyone else follows the shared schedule.
  function holderRoot(id){
    if(id===ensemble.ownId)return avatar;
    const p=peers.get(id);
    if(p?.handle){const info=byHandle.get(p.handle);return info?.index===undefined?null:figures[info.index].root;}
    return guests.get(id)?.root||null;
  }
  function updateDogs(now){
    for(const dog of dogs){
      const state=ensemble.dogs?.[dog.name],holder=state?.holder?holderRoot(state.holder):null;
      if(holder){
        const yaw=holder.rotation.y;
        dog.root.position.set(holder.position.x+Math.sin(yaw)*dog.hold.z,holder.position.y+dog.hold.y,holder.position.z+Math.cos(yaw)*dog.hold.z);
        dog.root.rotation.y=yaw+HELD_TURN;
        dog.animate(now/1000,false);
      }else{
        dog.run(now,state);
        // A dog just set down drops from its holder's arms to the sand.
        const since=state?.drop?now-state.drop.at:Infinity;
        if(since>=0&&since<260)dog.root.position.y+=dog.hold.y*(1-since/260)**2;
      }
      Object.assign(dog.item,{x:dog.root.position.x,z:dog.root.position.z,visible:!state?.holder});
      dog.hit.position.set(dog.root.position.x,dog.root.position.y+.26,dog.root.position.z);
      dog.hit.layers.set(state?.holder?1:0);
    }
  }
  let onScreen=true;
  const visibilityObserver=new IntersectionObserver(entries=>{onScreen=entries[0].isIntersecting;});
  visibilityObserver.observe(host);
  function tick(now){
    if(!running)return;
    frame=requestAnimationFrame(tick);
    const dt=Math.min((now-last)/1000,.19);last=now;
    if(document.hidden||!onScreen||blocked)return;
    elapsed+=dt;
    const nowMs=room.now();sports.begin();
    listen(nowMs);
    updateCast(dt,nowMs);
    const walking=move(dt);
    const {x,z}=avatar.position,floor=floorAt(x,z);
    const dropping=landing(nowMs);
    const lift=(!doing||doing==='summit'&&!own?.rest)&&!seated&&!dropping?jumpLift(Math.max(localJump,own?.jumpAt||0),nowMs):0;
    let visualActivity=doing,effort=walking;
    visitorFigure.root.rotation.set(0,0,0,'YXZ');visitorFigure.root.position.z=0;
    if(doing==='lounge'){
      const pose=playPose(doing,nowMs,own?.id);
      avatar.position.set(pose.x,pose.y,pose.z);avatar.rotation.y=pose.yaw;
    }else if(climbing){
      const pose=doing==='boulder'?boulderPose(progress):climbPose(climbing,progress,climbSide);avatar.position.set(pose.x,pose.y,pose.z);avatar.rotation.y=pose.yaw;
      visitorFigure.root.rotation.set(pose.pitch,0,pose.roll,'YXZ');effort=climbRate;
    }else if(doing==='surf'||doing==='boat'){
      const riding=own?.seat==='play:boat:bow';
      if(riding){const b=room.get().boat||BOAT_START;avatar.position.x=b.x;avatar.position.z=b.z;avatar.rotation.y=b.yaw;}
      const pose=seaPose(avatar.position.x,avatar.position.z,avatar.rotation.y,nowMs,doing,own?.seat);
      avatar.position.y=pose.y;
      if(doing==='boat')visitorFigure.root.position.z=riding?.52:-.52;
      else{visitorFigure.root.rotation.set(pose.pitch,0,pose.roll,'YXZ');sports.equip('self',visitorFigure,doing,pose,Number(nowMs-(own?.strokeAt||0)<SURF_BOOST_MS));}
      if(riding)visualActivity='boat-passenger';
      waterSounds(nowMs,walking,false);
    }else if(doing==='swim'){
      const pose=playPose('swim',nowMs,own?.id,{x:avatar.position.x,z:avatar.position.z,yaw:avatar.rotation.y,walking});
      avatar.position.y=pose.y;environment.setSwimmer(pose,nowMs,'self');waterSounds(nowMs,walking,false);
    }else if(seated?.leisure){
      avatar.position.y=floor;visualActivity='bench';
    }else if(doing==='summit'){
      avatar.position.y=summitFloor(x,z)+lift;
      visualActivity=own?.rest?'perch':lift>.001?'jump':'';
    }else if(dropping){
      // The avatar already stands where it lands. The figure flies there from the summit.
      const arc=leapPose(own.from,{x,y:floor,z},(nowMs-own.jumpAt)/JUMP_MS);
      avatar.position.y=floor;visualActivity='jump';
      leapOffset.set(arc.x-x,arc.y-floor,arc.z-z).applyAxisAngle(upAxis,-avatar.rotation.y);
      environment.setSwimmer(null,nowMs,'self');
    }else{
      avatar.position.y=floor+lift;
      if(lift>.001)visualActivity='jump';
      const wading=!doing&&!seated&&avatar.position.y<SWIM_LEVEL-.015;
      environment.setSwimmer(wading?{x,z,yaw:avatar.rotation.y,wading,walking}:null,nowMs,'self');
      if(wading&&lift<.001&&lastLift>.001)splashAt('land',.55,x,z);
      waterSounds(nowMs,walking,wading);
    }
    if(doing==='padel'){effort=swingEffort(own?.strokeAt,nowMs);sports.equip('self',visitorFigure,doing);}
    if(doing==='ride')effort=drive.speed/6.5;
    const currentBoat=liveBoat();
    Object.assign(canoeSpot,boatSpot(currentBoat));
    boatHit.position.set(currentBoat.x,SWIM_LEVEL+.29,currentBoat.z);boatHit.rotation.y=currentBoat.yaw;boatHit.updateMatrixWorld();
    sports.finish(currentBoat,residentRally?{...ensemble.court,shot:residentRally}:ensemble.court,nowMs);seatCrew(currentBoat,nowMs);
    const helm=ensemble.players.find(p=>p.seat==='play:boat:helm');
    const paddling=helm?.id===own?.id?walking:helm?.walking&&nowMs-helm.at<750;
    environment.setSwimmer(helm&&paddling?{...currentBoat,activity:'canoe-wake'}:null,nowMs,'canoe');
    visitorFigure.root.position.y=doing==='ride'?SCOOTER_RIG.rider.y:0;
    if(dropping)visitorFigure.root.position.copy(leapOffset);else visitorFigure.root.position.x=0;
    visitorFigure.animate(reduced&&!walking&&!own?.waveAt&&!visualActivity?0:nowMs/1000,effort,Boolean(seated||doing==='lounge'),envelope(own?.waveAt,nowMs),visualActivity,progress,Boolean(heldDog()));
    updateDogs(nowMs);
    if(own&&!seated&&doing!=='lounge'&&own.seat!=='play:boat:bow'&&!pendingSeat&&!dropping&&!leaping){
      const crossing=doing==='surf'?!floatable(x,z):(!doing||doing==='ride'||doing==='swim')&&shoreActivity(doing,x,z,lift)!==doing;
      if(!crossing||!shorePending||elapsed-shoreSentAt>.25){
        room.pose(x,z,avatar.rotation.y,walking,crossing,doing==='summit'?0:progress);
        if(crossing)shoreSentAt=elapsed;
      }
      shorePending=crossing;
    }
    ring.visible=!seated&&!doing&&floor>=SWIM_LEVEL;
    ring.position.set(x,.038+floor,z);
    ring.scale.setScalar(1+avatar.position.y*.15);updateScooter(dt);
    if(!reduced)environment.update(elapsed);
    environment.setCutaway(!doing&&insideWarung(x,z)?1:0,reduced?0:dt);
    if(elapsed-shadowAt>.33){renderer.shadowMap.needsUpdate=true;shadowAt=elapsed;}
    lastLift=lift;
    setCamera(dt);updateRain(reduced?dt*.5:dt);scanNearby();updateLabels();updateWaves(nowMs);
    renderer.render(scene,camera);
  }
  function start(){
    if(running)return;
    running=true;resize();last=performance.now();setCamera(0,true);updateCast(1,room.now());callbacks.onCamera(wide);scanNearby();frame=requestAnimationFrame(tick);
  }
  function stop(){
    running=false;cancelAnimationFrame(frame);keys.clear();cancelWalk();clearVisitors();
    ensemble={status:'offline',players:[],claims:{},ownId:null};own=null;nearest=hovered=spotlit=null;
    pendingSeat=null;afterStand=null;seated=null;doing=null;climbing=null;climbSide=0;climbTarget=null;progress=0;localJump=0;leaping=false;
    stick.right=stick.forward=0;drive.reset();shorePending=false;outfit(null,'#e58a5f');callbacks.youLabel.textContent='You';
    if(travelView){({angle,tilt,wide}=travelView);travelView=null;}
  }
  function setBlocked(value){blocked=value;if(value){keys.clear();stick.right=stick.forward=0;pointerStart=null;hovered=null;}else if(running)last=performance.now();}
  function correct(p){
    const destination=route.at(-1),onArrival=arrival,tracked=following,showMarker=marker.visible;
    cancelWalk();shorePending=false;drive.reset();progress=p.progress||0;snap(p);
    if(destination&&doing===activityId(p.seat)&&go(destination,onArrival,showMarker))following=tracked;
  }
  function toggleCamera(){introView=false;wide=!wide;callbacks.onCamera(wide);return wide;}
  return {start,stop,find,takeSeat,takeActivity,visitWarung,stand,kick,jump,
    setStick(right,forward){stick.right=right;stick.forward=forward;},
    interact:()=>interact(),holding:()=>heldDog()?.name||null,
    takeBench(){const bench=seats.filter(s=>s.leisure);takeSeat(bench.find(s=>!seatOwner(s))||bench[0]);},
    // Head for the nearest dog nobody is carrying.
    fetchDog(){
      if(heldDog()){callbacks.notice('You are already carrying '+heldDog().name);return;}
      if(seated||doing){afterStand=()=>this.fetchDog();stand();return;}
      const p=avatar.position,free=dogs.filter(d=>d.item.visible).sort((a,b)=>distance(a.item,p)-distance(b.item,p))[0];
      if(free)toggleDog(free.item);else callbacks.notice('Both dogs are being carried');
    },toggleCamera,setBlocked,applyRoom,wave,
    setBall(b){ballState=b;},correct,clearRequest(){pendingSeat=null;shorePending=false;leaping=false;}};
}
