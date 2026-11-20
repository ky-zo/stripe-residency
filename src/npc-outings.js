import {climbPose,climbSpots,groundHeight,shoreline,SWIM_LEVEL} from '../shared/mobility.js';
import {BOULDER,PADEL,SURF,boulderPose,courtEntry,newPadelShot,padelBallAt,seaPose} from '../shared/sports.js';
import {NPC_ROUTES} from './npc-routes.js';

// Residents nobody is playing keep a shared timetable on the room clock, so every visitor sees the
// same match, class or swim. Each outing starts and ends at home: walk out on a baked route, play, walk back.
export const NPC_CYCLE=300;
const TAU=Math.PI*2,RAMP=.8,HIT=1.575;
const clamp=(n,low=0,high=1)=>Math.min(high,Math.max(low,n));
const smooth=t=>{const u=clamp(t);return u*u*(3-2*u);};
const turn=(from,to,t)=>from+Math.atan2(Math.sin(to-from),Math.cos(to-from))*t;
const lerp=(a,b,t)=>a+(b-a)*t;
const span=(a,b)=>Math.hypot(b.x-a.x,b.z-a.z);
const headingOf=(a,b)=>Math.atan2(b.x-a.x,b.z-a.z);

// `at` is seconds into the cycle. At `at + stay` the cast heads home, wherever they got to.
export const SESSIONS=[
  {kind:'padel',at:0,stay:100,cast:[7,8]},
  {kind:'padel',at:100,stay:100,cast:[3,12]},
  {kind:'padel',at:200,stay:95,cast:[6,13]},
  // Sandro teaches from his own mat. The students take the mats in cast order.
  {kind:'yoga',at:20,stay:110,cast:[14,13,15,16,19]},
  {kind:'yoga',at:170,stay:110,cast:[14,9,17,20]},
  {kind:'climb',at:40,stay:75,palm:'north',cast:[5]},
  {kind:'climb',at:40,stay:75,palm:'west',cast:[0]},
  {kind:'climb',at:130,stay:75,palm:'west',cast:[2]},
  {kind:'climb',at:150,stay:75,palm:'east',cast:[7]},
  {kind:'climb',at:210,stay:75,palm:'north',cast:[18]},
  {kind:'boulder',at:10,stay:90,cast:[6]},
  {kind:'boulder',at:150,stay:85,cast:[8]},
  {kind:'swim',at:10,stay:80,beach:'west',cast:[2]},
  {kind:'swim',at:30,stay:85,beach:'southwest',cast:[9]},
  {kind:'swim',at:50,stay:90,beach:'south',cast:[10]},
  {kind:'swim',at:60,stay:85,beach:'cove',cast:[18]},
  {kind:'swim',at:180,stay:85,beach:'cove',cast:[5]},
  {kind:'swim',at:190,stay:90,beach:'west',cast:[0]},
  {kind:'swim',at:200,stay:90,beach:'south',cast:[15]},
  {kind:'swim',at:200,stay:90,beach:'southeast',cast:[19]},
  {kind:'surf',at:60,stay:105,lane:0,cast:[1]},
  {kind:'surf',at:120,stay:100,lane:-1,cast:[11]},
  {kind:'surf',at:200,stay:90,lane:1,cast:[10]},
  {kind:'desk',at:5,stay:70,seat:0,cast:[12]},
  {kind:'desk',at:10,stay:75,seat:3,cast:[11]},
  {kind:'desk',at:40,stay:80,seat:1,cast:[17]},
  {kind:'desk',at:40,stay:80,seat:2,cast:[20]},
  {kind:'desk',at:180,stay:85,seat:0,cast:[16]},
  {kind:'desk',at:200,stay:80,seat:3,cast:[1]},
];

// A point on the coast at a fraction of the beach radius, in the frame of the sand mesh.
function coast(angle,radius){
  const s=shoreline(angle)*radius;
  return {x:11.7*Math.cos(angle)*s,z:8.15*Math.sin(angle)*s};
}
// Swimmers leave their towel on dry sand, wade to knee depth, then swim a loop out and back.
function beach(angle,reach,width,sweep=1){
  const shore=coast(angle,.95),water=coast(angle,1.215),d=span(shore,water);
  const out={x:(water.x-shore.x)/d,z:(water.z-shore.z)/d};
  return {shore,water,out,across:{x:out.z*sweep,z:-out.x*sweep},reach,width};
}
export const BEACHES={
  west:beach(Math.PI-.10,2.3,1.1),
  southwest:beach(2.05,2.1,1.0,-1),
  south:beach(1.60,2.4,1.2),
  southeast:beach(1.20,2.2,1.0,-1),
  cove:beach(-.98,1.5,1.3,-1),
};
const rackAngle=Math.atan2(SURF.land.z/8.15,SURF.land.x/11.7);
const surfLane=lane=>{
  const spot=beach(rackAngle+lane*.21,3.3,1.05,lane<0?-1:1);
  return {...spot,shore:SURF.land};
};

function seed(index,salt){
  let n=Math.imul(index+11,0x85ebca6b)^Math.imul(salt+3,0xc2b2ae35);
  n=Math.imul(n^n>>>16,0x7feb352d);
  return ((n^n>>>15)>>>0)/4294967296;
}

function path(points){
  const pts=points.map(p=>Array.isArray(p)?{x:p[0],z:p[1]}:{x:p.x,z:p.z}).filter((p,i,all)=>!i||span(all[i-1],p)>.001);
  const acc=[0];
  for(let i=1;i<pts.length;i++)acc.push(acc[i-1]+span(pts[i-1],pts[i]));
  return {pts,acc,length:acc.at(-1)};
}
function pointOn(route,s){
  const {pts,acc,length}=route;
  if(pts.length<2)return {...pts[0]};
  s=clamp(s,0,length);
  let i=1;
  while(i<pts.length-1&&acc[i]<s)i++;
  const a=pts[i-1],b=pts[i],t=(s-acc[i-1])/((acc[i]-acc[i-1])||1);
  return {x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t};
}
// Corners round off a little. The ends of every route stay exactly where they are.
function softPoint(route,s){
  const d=Math.min(.28,s,route.length-s);
  if(d<=0)return pointOn(route,s);
  const a=pointOn(route,s-d),b=pointOn(route,s),c=pointOn(route,s+d);
  return {x:(a.x+2*b.x+c.x)/4,z:(a.z+2*b.z+c.z)/4};
}
export const walkTime=(length,speed)=>length<.03?0:length/speed+RAMP;
function travelled(t,length,speed){
  const total=walkTime(length,speed);
  if(total<=0)return length;
  if(total<2*RAMP+.01)return length*smooth(t/total);
  if(t<RAMP)return speed*t*t/(2*RAMP);
  if(t>total-RAMP)return length-speed*(total-t)**2/(2*RAMP);
  return speed*(t-RAMP/2);
}
// A walk along `route` that turns out of `fromYaw` and settles into `toYaw` at the far end.
function walkAlong(route,t,speed,{back=false,fromYaw,toYaw,water=false}={}){
  const total=walkTime(route.length,speed);
  let s=travelled(clamp(t,0,total),route.length,speed);
  if(back)s=route.length-s;
  const p=softPoint(route,s),ahead=pointOn(route,s+(back?-.35:.35)),behind=pointOn(route,s+(back?.35:-.35));
  let yaw=span(behind,ahead)>.01?headingOf(behind,ahead):fromYaw??0;
  if(fromYaw!==undefined)yaw=turn(fromYaw,yaw,smooth(t/.6));
  if(toYaw!==undefined)yaw=turn(yaw,toYaw,smooth((t-total+.6)/.6));
  const floor=groundHeight(p.x,p.z);
  return {x:p.x,z:p.z,y:water?floor:0,yaw,walking:t>0&&t<total,seated:false,activity:'',land:null,
    wading:water&&floor<SWIM_LEVEL-.015};
}
const standing=(spot,yaw,land=null)=>({x:spot.x,z:spot.z,y:0,yaw,walking:false,seated:false,activity:'',land});
// Progress up a wall in a few pulls, pausing briefly on each hold.
function pulls(t,duration,count){
  const x=clamp(t/duration)*count,k=Math.min(count-1,Math.floor(x));
  return (k+smooth(x-k))/count;
}

export function createOutings({homes,nextHome,homePose,seats,mats,teacherMat}){
  const speed=homes.map((_,i)=>.95+.2*seed(i,7));
  const palms=Object.fromEntries(climbSpots.map(s=>[s.key,s]));
  const outings=homes.map(()=>[]);
  const requests=[];
  SESSIONS.forEach((session,id)=>session.cast.forEach((i,slot)=>{
    const o={...session,id,i,slot,yaw:0};
    if(session.kind==='padel'){o.side=slot?'north':'south';o.dock=courtEntry(o.side);o.yaw=o.side==='south'?Math.PI:0;}
    else if(session.kind==='yoga'){o.dock=slot?mats[slot-1]:teacherMat;o.yaw=o.dock.facing;}
    else if(session.kind==='climb'){
      const spot=o.spot=palms[session.palm];o.dock=spot.land;o.yaw=spot.land.yaw;
      // Walk round the trunk to the side being climbed, then step in to grip it.
      o.tails=[0,1,2].map(slot=>{
        const grip=climbPose(spot,0,slot),r=span(spot.palm,spot.land);
        const from=Math.atan2(spot.land.x-spot.palm.x,spot.land.z-spot.palm.z);
        const to=Math.atan2(grip.x-spot.palm.x,grip.z-spot.palm.z),sweep=Math.atan2(Math.sin(to-from),Math.cos(to-from));
        const arc=[1,2,3].map(k=>({x:spot.palm.x+r*Math.sin(from+sweep*k/3),z:spot.palm.z+r*Math.cos(from+sweep*k/3)}));
        return path([spot.land,...(Math.abs(sweep)>.2?arc:[]),grip]);
      });
    }
    else if(session.kind==='boulder'){o.dock=BOULDER.land;o.yaw=Math.PI;}
    else if(session.kind==='swim'){o.beach=BEACHES[session.beach];o.dock=o.beach.shore;o.yaw=headingOf(o.beach.shore,o.beach.water);}
    else if(session.kind==='surf'){o.beach=surfLane(session.lane);o.dock=SURF.land;o.yaw=headingOf(SURF.land,o.beach.water);}
    else if(session.kind==='desk'){
      const seat=o.seatSpot=seats[session.seat];
      o.dock={x:seat.x-Math.sin(seat.facing)*.72,z:seat.z-Math.cos(seat.facing)*.72};o.yaw=seat.facing;
      o.tail=path([o.dock,seat]);
    }
    const home=homes[i],start=home.exit||home,key=i+'>'+venue(o);
    if(span(start,o.dock)>.03)requests.push({key,from:{x:start.x,z:start.z},to:{x:o.dock.x,z:o.dock.z}});
    const baked=NPC_ROUTES[key]||[[start.x,start.z],[o.dock.x,o.dock.z]];
    o.route=path([home,...(home.exit?[home.exit]:[]),...baked,o.dock]);
    o.walk=walkTime(o.route.length,speed[i]);
    outings[i].push(o);
  }));
  for(const list of outings)list.sort((a,b)=>a.at-b.at);

  function venue(o){
    return {padel:'padel-'+o.side,yoga:'yoga-'+o.slot,climb:'palm-'+o.palm,boulder:'boulder',
      swim:'beach-'+SESSIONS[o.id].beach,surf:'surf'+o.lane,desk:'desk-'+o.seat}[o.kind];
  }

  // Departures wait for the resident to be home from a chat. Every leg ends with them home again.
  function timeline(i,cycle){
    const list=outings[i];
    if(!list.length)return [];
    const previous=list.at(-1),prior=(cycle-1)*NPC_CYCLE+previous.at+previous.stay+previous.walk;
    let floor=nextHome(i,prior),legs=[];
    for(const o of list){
      const start=cycle*NPC_CYCLE+o.at,until=start+o.stay;
      const depart=nextHome(i,Math.max(start,floor)),arrive=depart+o.walk;
      if(arrive>until-6)continue;
      const back=until+o.walk,end=nextHome(i,back);
      legs.push({o,depart,arrive,until,back,end});floor=end;
    }
    return legs;
  }
  function legAt(i,t){
    const cycle=Math.floor(t/NPC_CYCLE);
    for(const c of [cycle-1,cycle])for(const leg of timeline(i,c))if(t>=leg.depart&&t<leg.end)return {...leg,cycle:c};
    return null;
  }
  function legFor(i,o,cycle){return timeline(i,cycle).find(leg=>leg.o.id===o.id)||null;}

  // ----- Padel: both players reach their baseline, then rally point after point until it is time to go.
  const PADEL_POINT_GAP=2.2,MISS=1.75*1.15;
  function match(o,cycle){
    const session=SESSIONS[o.id],[south,north]=session.cast.map(i=>outings[i].find(x=>x.id===o.id));
    const a=legFor(south.i,south,cycle),b=legFor(north.i,north,cycle);
    if(!a||!b)return null;
    const from=Math.max(a.arrive,b.arrive)+1.5,to=a.until-2;
    return to-from>6?{from,to,cycle,salt:o.id*131+cycle*17}:null;
  }
  function pointsOf(game){
    const list=[];
    for(let p=0,at=game.from+PADEL_POINT_GAP;;p++){
      const shots=4+Math.floor(seed(game.salt+p,5)*9),length=(shots-1)*HIT+MISS+PADEL_POINT_GAP;
      if(at+length>game.to)break;
      list.push({at,shots,length,server:p%2?'north':'south',p});at+=length;
    }
    return list;
  }
  function rally(game,point){
    if(point.cache)return point.cache;
    const shots=[];let side=point.server,sign=side==='south'?1:-1;
    let x=PADEL.x-.25*sign,z=PADEL.z+sign*2.12;
    for(let j=0;j<point.shots;j++){
      const shot=newPadelShot(x,z,side,(point.at+j*HIT)*1000,j+1+point.p*3+game.salt%7);
      shots.push(shot);
      const ball=padelBallAt(shot,(point.at+(j+1)*HIT)*1000);x=ball.x;z=ball.z;side=shot.target;
    }
    return point.cache=shots;
  }
  // The racket hand sits a little to one side of the body.
  function bodyAt(ball,side){
    const sign=side==='south'?1:-1;
    return {x:clamp(ball.x-.32*sign,PADEL.x-1.9,PADEL.x+1.9),z:PADEL.z+sign*clamp((ball.z-PADEL.z)*sign+.15,.62,3.2)};
  }
  function padelPose(o,leg,t,busy){
    const bench=busy?.padel&&[8,9].map(id=>seats[id]).filter(Boolean).sort((a,b)=>Number(b.id===8+o.slot)-Number(a.id===8+o.slot)).find(s=>!busy.seats?.has(s.id));
    if(busy?.padel)return bench?{x:bench.x,z:bench.z,y:0,yaw:bench.facing,walking:false,seated:true,activity:'sit',land:{...PADEL.land}}:standing({x:13.95,z:o.side==='south'?2.55:-.55},Math.PI/2);
    const ready={...o.dock},pose={x:ready.x,z:ready.z,y:0,yaw:o.yaw,walking:false,seated:false,activity:'padel',land:null,strokeAt:0};
    const game=match(o,leg.cycle);
    if(!game||t<game.from||t>=game.to)return pose;
    const points=pointsOf(game);
    if(!points.length)return pose;
    // Where this player stands as a point begins: the server at the ball, the receiver ready.
    const startOf=point=>point?(point.server===o.side?bodyAt(rally(game,point)[0],o.side):ready):ready;
    const at=(spot,u)=>{pose.x=lerp(pose.x,spot.x,u);pose.z=lerp(pose.z,spot.z,u);};
    const k0=points.findLastIndex(p=>p.at<=t),point=points[k0];
    if(!point){at(startOf(points[0]),smooth((t-game.from)/(points[0].at-game.from)));return pose;}
    if(t>=point.at+point.length)return pose;
    const shots=rally(game,point),n=point.shots,keys=[{t:point.at,...startOf(point)}];
    shots.forEach((shot,j)=>{
      if(shot.target===o.side)return;
      if(j)keys.push({t:point.at+j*HIT,...bodyAt(shot,o.side)});
      if(point.at+j*HIT<=t+.25)pose.strokeAt=(point.at+j*HIT-.25)*1000;
    });
    // The receiver of the last shot lunges for it and misses.
    const last=shots.at(-1);
    if(last.target===o.side){
      const lunge=bodyAt(padelBallAt(last,(point.at+n*HIT)*1000),o.side),prior=keys.at(-1);
      keys.push({t:point.at+n*HIT,x:lerp(prior.x,lunge.x,.62),z:lerp(prior.z,lunge.z,.62)});
    }
    keys.push({t:point.at+(n-1)*HIT+MISS+.5,...ready},{t:point.at+point.length,...startOf(points[k0+1])});
    const k=Math.max(0,keys.findLastIndex(key=>key.t<=t)),a=keys[k],b=keys[Math.min(k+1,keys.length-1)];
    pose.x=a.x;pose.z=a.z;
    if(b.t>a.t)at(b,smooth((t-a.t)/(b.t-a.t)));
    pose.yaw=o.yaw+.18*Math.sin((t-point.at)*1.7+o.slot);
    return pose;
  }
  // The shot in flight on the court, while two residents rally there.
  function padelShot(t){
    const cycle=Math.floor(t/NPC_CYCLE);
    for(const c of [cycle,cycle-1])for(const o of outings.flat()){
      if(o.kind!=='padel'||o.slot)continue;
      const game=match(o,c);
      if(!game||t<game.from||t>=game.to)continue;
      const point=pointsOf(game).findLast(p=>p.at<=t);
      if(!point)return null;
      const shots=rally(game,point);
      return shots[Math.min(shots.length-1,Math.floor((t-point.at)/HIT))];
    }
    return null;
  }

  // ----- Palms and the boulder: a few climbs, resting between them.
  const CLIMB=[6.5,4.5,5,2.5],CLIMB_LAP=CLIMB.reduce((a,b)=>a+b);
  function palmPose(o,leg,t,busy){
    const taken=busy?.palms?.[o.spot.key],slot=[1,2,0].find(s=>!taken?.has(s));
    const look=Math.atan2(o.spot.palm.x-o.dock.x,o.spot.palm.z-o.dock.z);
    if(slot===undefined)return standing(o.dock,look,{...o.dock,yaw:look});
    const tail=o.tails[slot],tailTime=walkTime(tail.length,.75),land={...o.dock,yaw:o.yaw};
    const start=leg.arrive+tailTime,end=leg.until-tailTime;
    if(t<start)return {...walkAlong(tail,t-leg.arrive,.75,{fromYaw:o.yaw,toYaw:climbPose(o.spot,0,slot).yaw}),land};
    if(t>=end)return {...walkAlong(tail,t-end,.75,{back:true,fromYaw:climbPose(o.spot,0,slot).yaw,toYaw:o.yaw}),land};
    const laps=Math.max(1,Math.floor((end-start)/CLIMB_LAP)),wait=(end-start-laps*CLIMB_LAP)/2;
    const u=t-start-wait,base=climbPose(o.spot,0,slot);
    if(u<0||u>=laps*CLIMB_LAP)return standing(base,base.yaw,land);
    const k=u%CLIMB_LAP,[up,top,down]=CLIMB;
    let progress=1,walking=0;
    if(k<up){progress=pulls(k,up,4);walking=1;}
    else if(k<up+top)progress=1;
    else if(k<up+top+down){progress=1-pulls(k-up-top,down,4);walking=-1;}
    else return standing(base,base.yaw,land);
    return {...climbPose(o.spot,progress,slot),walking,seated:false,activity:'climb',progress,land};
  }
  const BOULDER_LAP=[2.5,10,5,7,3],BOULDER_TOTAL=BOULDER_LAP.reduce((a,b)=>a+b);
  function boulderNpcPose(o,leg,t,busy){
    const land={...BOULDER.land};
    if(busy?.boulder)return standing({x:11.0,z:-2.55},2.62,land);
    const length=leg.until-leg.arrive,laps=Math.max(1,Math.floor(length/BOULDER_TOTAL)),wait=(length-laps*BOULDER_TOTAL)/2;
    const u=t-leg.arrive-wait,[look,up,top,down]=BOULDER_LAP;
    if(u<0||u>=laps*BOULDER_TOTAL)return standing(BOULDER.land,Math.PI,land);
    const k=u%BOULDER_TOTAL;
    let progress=0,walking=0;
    if(k<look)return standing(BOULDER.land,Math.PI,land);
    if(k<look+up){progress=pulls(k-look,up,5);walking=1;}
    else if(k<look+up+top)progress=1;
    else if(k<look+up+top+down){progress=1-pulls(k-look-up-top,down,5);walking=-1;}
    else return standing(BOULDER.land,Math.PI,land);
    return {...boulderPose(progress),walking,seated:false,activity:'boulder',progress,land};
  }

  // ----- Swimming and surfing: wade out, loop through deeper water, wade back.
  function loopAt(spot,theta){
    const {water,out,across,reach,width}=spot,f=reach*(1-Math.cos(theta)),l=width*Math.sin(theta);
    const dx=out.x*reach*Math.sin(theta)+across.x*width*Math.cos(theta),dz=out.z*reach*Math.sin(theta)+across.z*width*Math.cos(theta);
    return {x:water.x+out.x*f+across.x*l,z:water.z+out.z*f+across.z*l,yaw:Math.atan2(dx,dz)};
  }
  function loopLength(spot){
    let length=0,last=loopAt(spot,0);
    for(let k=1;k<=48;k++){const next=loopAt(spot,k/48*TAU);length+=span(last,next);last=next;}
    return length;
  }
  function waterPose(o,leg,t,ms,surfing){
    const spot=o.beach,shore=spot.shore,pause=surfing?1.5:0;
    const wade=path([shore,spot.water]),wadeTime=walkTime(wade.length,.6);
    const land={...shore,yaw:o.yaw+Math.PI},inward=headingOf(spot.water,shore);
    const start=leg.arrive+pause+wadeTime,end=leg.until-pause-wadeTime;
    if(t<leg.arrive+pause)return standing(shore,o.yaw,land);
    if(t<start)return {...walkAlong(wade,t-leg.arrive-pause,.6,{water:true}),land};
    if(t>=leg.until-pause)return standing(shore,inward,land);
    if(t>=end)return {...walkAlong(wade,t-end,.6,{back:true,water:true}),land};
    const length=end-start,loop=spot.loop??=loopLength(spot);
    // Surfers catch a swell every few seconds and carry its speed for a moment.
    const surge=u=>surfing?1.55*u+1.2*(Math.floor(u/6.5)*1.65+Math.min(u%6.5,1.65)):.62*u;
    const laps=Math.max(1,Math.round(surge(length)/loop)),u=t-start;
    // Ease away from the shallows and back into them; the loop itself keeps its pace.
    const r=Math.min(.2,1.2/length),q=surge(u)/surge(length);
    const eased=q<r?q*q/(2*r*(1-r)):q>1-r?1-(1-q)**2/(2*r*(1-r)):(q-r/2)/(1-r);
    const way=loopAt(spot,TAU*laps*eased);
    let yaw=turn(o.yaw,way.yaw,smooth(u/.9));
    yaw=turn(yaw,inward,smooth((u-length+.9)/.9));
    if(surfing){
      const boost=u>2&&u<length-2&&u%6.5<1.65?1:0;
      return {...seaPose(way.x,way.z,yaw,ms,'surf'),walking:true,seated:false,activity:'surf',boost,land};
    }
    return {x:way.x,z:way.z,y:SWIM_LEVEL+.02*Math.sin(ms/1000*2.6+o.i),yaw,walking:false,seated:false,activity:'swim',land};
  }

  // ----- Desks: step up behind the chair, sit down to work.
  function deskPose(o,leg,t,busy){
    const seat=o.seatSpot,land={...o.dock,yaw:seat.facing+Math.PI};
    if(busy?.seats?.has(seat.id))return standing({x:o.dock.x+Math.cos(seat.facing)*.55,z:o.dock.z-Math.sin(seat.facing)*.55},seat.facing,land);
    const tailTime=walkTime(o.tail.length,.6);
    if(t<leg.arrive+tailTime)return {...walkAlong(o.tail,t-leg.arrive,.6,{fromYaw:o.yaw,toYaw:seat.facing}),land};
    if(t>=leg.until-tailTime)return {...walkAlong(o.tail,t-leg.until+tailTime,.6,{back:true,fromYaw:seat.facing,toYaw:o.yaw}),land};
    return {x:seat.x,z:seat.z,y:0,yaw:seat.facing,walking:false,seated:true,activity:'work',land};
  }

  function activityPose(o,leg,t,busy,ms){
    if(o.kind==='padel')return padelPose(o,leg,t,busy);
    if(o.kind==='yoga')return {x:o.dock.x,z:o.dock.z,y:0,yaw:o.yaw,walking:false,seated:false,activity:'yoga',land:null};
    if(o.kind==='climb')return palmPose(o,leg,t,busy);
    if(o.kind==='boulder')return boulderNpcPose(o,leg,t,busy);
    if(o.kind==='swim'||o.kind==='surf')return waterPose(o,leg,t,ms,o.kind==='surf');
    if(o.kind==='desk')return deskPose(o,leg,t,busy);
    return standing(o.dock,o.yaw);
  }

  /** A resident's pose while out on the timetable, or null while they keep their usual routine. */
  function pose(i,seconds,busy=null){
    const leg=legAt(i,seconds);
    if(!leg)return null;
    const {o}=leg,ms=seconds*1000,v=speed[i];
    if(seconds<leg.arrive){
      const settle=activityPose(o,leg,leg.arrive+1e-3,busy,ms).yaw;
      return walkAlong(o.route,seconds-leg.depart,v,{fromYaw:homePose(i,seconds).yaw,toYaw:settle});
    }
    if(seconds<leg.until)return activityPose(o,leg,seconds,busy,ms);
    if(seconds<leg.back){
      const leave=activityPose(o,leg,leg.until-1e-3,busy,ms).yaw;
      return walkAlong(o.route,seconds-leg.until,v,{back:true,fromYaw:leave,toYaw:homePose(i,seconds).yaw});
    }
    return homePose(i,seconds);
  }
  return {pose,padelShot,requests,outings,timeline};
}
