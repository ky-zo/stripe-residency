import {canSwim, groundHeight, inLagoon, SWIM_LEVEL} from './mobility.js';

export const BOAT_START={x:-13.2,z:-3.4,yaw:-.89};
export const SURF={id:'surf',label:'Surfboards',x:-3.25,z:-6.71,hitY:.42,land:{x:-3.15,z:-6.50,yaw:Math.PI},water:{x:-3.75,z:-10.58,yaw:Math.PI}};
export const BOULDER={id:'boulder',label:'Bouldering rock',x:12.05,z:-4.45,hitY:1.18,land:{x:11.60,z:-3.05,yaw:Math.PI}};
export const PADEL={id:'padel',label:'Padel court',x:17,z:1,hitY:.30,land:{x:14.18,z:1.04,yaw:Math.PI/2}};
export const boulderSteps=[[11.60,0,-3.10],[11.65,.44,-3.33],[12,.96,-3.47],[12.32,1.42,-3.63],[12.29,1.98,-3.86],[12.12,2.27,-4.16]];
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

export function boulderPose(progress){
  const at=clamp(progress,0,1)*(boulderSteps.length-1),i=Math.min(Math.floor(at),boulderSteps.length-2),s=at-i;
  const [x,y,z]=boulderSteps[i],next=boulderSteps[i+1];
  return {x:x+(next[0]-x)*s,y:y+(next[1]-y)*s,z:z+(next[2]-z)*s,yaw:Math.PI,pitch:-.055*(1-progress),roll:0};
}
// The boulder's rounded top. Climbers who top out can walk, sit and hop up here, then jump down.
export const SUMMIT={id:'summit',label:'Top of the boulder',x:12.12,z:-4.62,rx:.50,rz:.46,y:2.284,capacity:3};
export const summitRadius=(x,z)=>Math.hypot((x-SUMMIT.x)/SUMMIT.rx,(z-SUMMIT.z)/SUMMIT.rz);
export const onSummit=(x,z)=>summitRadius(x,z)<=1.0001;
export const summitFloor=(x,z)=>SUMMIT.y-.014*Math.min(1,summitRadius(x,z))**2;
export function clampToSummit(x,z){
  const r=summitRadius(x,z);
  return r<=1?{x,z}:{x:SUMMIT.x+(x-SUMMIT.x)/r,z:SUMMIT.z+(z-SUMMIT.z)/r};
}
// The rock and its crash pads, as an ellipse on the sand. Jumpers land outside it.
const footprint=(x,z)=>Math.hypot((x-12.01)/1.45,(z+4.49)/1.29);
export const clearOfBoulder=(x,z)=>footprint(x,z)>=1.15;
export const LEAP_REACH=3.1;
// Jump the way the climber faces, or the nearest open way round, to the first sand they can stand on.
export function leapFrom(from,yaw,canLand){
  for(let k=0;k<16;k++){
    const turn=Math.ceil(k/2)*.4*(k%2?1:-1),a=yaw+turn,dx=Math.sin(a),dz=Math.cos(a);
    for(let d=.4;d<=LEAP_REACH-.1;d+=.05){
      const x=from.x+dx*d,z=from.z+dz*d;
      if(footprint(x,z)>=1.2&&canLand(x,z))return {x,z,yaw:a};
    }
  }
  return null;
}
// A short rise, then a fall onto the sand. Takes JUMP_MS, like any other jump.
export function leapPose(from,to,t){
  const s=clamp(t,0,1);
  return {x:from.x+(to.x-from.x)*s,y:from.y+(to.y-from.y)*s+2.8*s*(1-s),z:from.z+(to.z-from.z)*s};
}
export function surfEntry(players){
  for(let row=0;row<=players.length;row++){
    for(const lane of [0,1,-1,2,-2]){
      const x=SURF.water.x+lane*1.14,z=SURF.water.z-row*1.65;
      if(floatable(x,z)&&players.every(p=>Math.hypot(p.x-x,p.z-z)>1.08))return {x,z,yaw:SURF.water.yaw};
    }
  }
  return SURF.water;
}
export const boatSpot=pose=>({id:'boat',label:'Outrigger canoe',x:pose.x,z:pose.z,hitY:.13,land:pose});
export const isBoatSeat=seat=>seat==='play:boat:helm'||seat==='play:boat:bow';
// Up to two players a side. `play:padel:south` and `play:padel:south:1` both stand on the south half.
export const COURT_SLOTS=2;
export function courtSide(seat){
  if(typeof seat!=='string'||!seat.startsWith('play:padel:'))return null;
  const side=seat.split(':')[2];
  return side==='north'||side==='south'?side:null;
}
export const otherSide=side=>side==='south'?'north':'south';
export const sideSign=side=>side==='north'?-1:1;
export const onCourt=(x,z,side)=>Math.abs(x-PADEL.x)<=1.96&&(z-PADEL.z)*sideSign(side)>=.50&&(z-PADEL.z)*sideSign(side)<=3.30;
// A partner joins beside whoever already holds that half.
export const courtEntry=(side,slot=0)=>({x:PADEL.x+(slot?.95*sideSign(side):0),z:PADEL.z+sideSign(side)*2.30,yaw:side==='south'?Math.PI:0});
export const floatable=(x,z)=>inLagoon(x,z)&&groundHeight(x,z)<=SWIM_LEVEL-.09;
export function stepOffBoat(boat){
  const {x,z,yaw}=boat;
  for(const [side,fore] of [[1,0],[-1,0],[0,-1],[0,1]]){
    const px=x+1.23*(side*Math.cos(yaw)+fore*Math.sin(yaw)),pz=z+1.23*(-side*Math.sin(yaw)+fore*Math.cos(yaw));
    if(canSwim(px,pz))return {x:px,z:pz,yaw};
  }
  return {x,z,yaw};
}
export function seaPose(x,z,yaw,now,activity,seat){
  const t=now/1000,phase=t*2.12+x*.38+z*.47;
  if(activity==='surf')return {x,z,y:SWIM_LEVEL+.105+.115*Math.sin(phase),yaw,pitch:.08*Math.cos(phase),roll:.10*Math.sin(phase+.4)};
  const fore=seat==='play:boat:bow'?.52:-.52;
  return {x:x+Math.sin(yaw)*fore,z:z+Math.cos(yaw)*fore,y:SWIM_LEVEL+.14+.045*Math.sin(t*1.65+x*.26+z*.18),yaw,pitch:0,roll:0};
}
export const SURF_BOOST_MS=1650;
export function newPadelShot(x,z,side,now,rally=1,{practice=false,toWall=false}={}){
  const target=otherSide(side),sign=sideSign(target);
  const lane=clamp((PADEL.x-x)*.45+Math.sin(rally*2.31+sign)*.78,-1.30,1.30);
  return {x,z,toX:PADEL.x+lane,toZ:PADEL.z+sign*(toWall?3.48:2.30),target,start:now,duration:1750,rally,practice};
}
export function padelBallAt(shot,now){
  if(!shot)return {x:PADEL.x+.30,z:PADEL.z+1.90,y:.115};
  const t=clamp((now-shot.start)/shot.duration,0,1.35);
  const y=t<.76?.86*(1-t/.76)+1.19*Math.sin(Math.PI*t/.76):.11+.84*Math.max(0,Math.sin((t-.76)/.59*Math.PI));
  return {x:shot.x+(shot.toX-shot.x)*t,z:shot.z+(shot.toZ-shot.z)*t,y:Math.max(.11,y)};
}
export function canReturnPadel(shot,side,x,z,now){
  if(!shot)return true;
  const age=(now-shot.start)/shot.duration;
  if(shot.target!==side||age<.59||age>1.35)return false;
  const ball=padelBallAt(shot,now);return Math.hypot(x-ball.x,z-ball.z)<=1.67;
}
