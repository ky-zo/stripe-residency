export const SCOOTER_START = {x:1.34,z:5.82,yaw:Math.PI/2};
export const JUMP_MS = 720;
export const OCEAN_RADIUS = 100;
export const SWIM_LEVEL = -.64;
// Each ring is a fraction of the irregular coast, with its sand height in world units.
export const BEACH_PROFILE = [
  [.92,0], [.962,-.036], [1.004,-.17], [1.042,-.41],
  [1.083,-.57], [1.115,-.77], [1.205,-.965], [1.32,-1.52],
];
const KNEE_DEPTH=.30, STAND_DEPTH=.14, AXLE_DEPTH=.21;

export const PALMS = [
  {x:-9.68,z:.57,height:4.42,reach:2.43,leanX:-.57,leanZ:.05,key:'west',approach:[-9.17,1.19]},
  {x:-7.50,z:-5.76,height:4.83,reach:2.43,leanX:-.40,leanZ:-.13},
  {x:-.65,z:-6.45,height:4.43,reach:2.32,leanX:.66,leanZ:.03,key:'north',approach:[-.65,-5.76]},
  {x:8.50,z:-3.87,height:4.70,reach:2.46,leanX:.74,leanZ:-.16},
  {x:9.99,z:2.07,height:3.66,reach:2.03,leanX:.45,leanZ:.23,key:'east',approach:[9.17,2.00]},
];

export function palmTrunk(palm,t) {
  const bend=.22*t+.78*t*t;
  return {x:palm.x+palm.leanX*bend,y:palm.height*t,z:palm.z+palm.leanZ*bend};
}

export const climbSpots=PALMS.filter(p=>p.approach).map(palm=>{
  const [x,z]=palm.approach,yaw=Math.atan2(palm.x-x,palm.z-z);
  return {id:'climb',key:palm.key,label:'Coconut palm',palm,x:palm.x,z:palm.z,hitY:palm.height*.46,land:{x,z,yaw}};
});

// Up to three people share a palm, each gripping the trunk from a different side.
const CLIMB_SIDES=[0,2.1,-2.1];
export const CLIMBERS_PER_PALM=CLIMB_SIDES.length;
export const climbYaw=(spot,slot=0)=>spot.land.yaw+(CLIMB_SIDES[slot]||0);

export function climbPose(spot,progress,slot=0) {
  const t=.014+.66*Math.max(0,Math.min(1,progress));
  const p=palmTrunk(spot.palm,t),yaw=climbYaw(spot,slot);
  const grip=.25+(.28-.17*Math.pow(t,.68))*Math.sqrt(spot.palm.height/4.6);
  const above=palmTrunk(spot.palm,Math.min(1,t+.96/spot.palm.height));
  const dx=above.x-p.x,dy=above.y-p.y,dz=above.z-p.z;
  const across=dx*Math.cos(yaw)-dz*Math.sin(yaw),forward=dx*Math.sin(yaw)+dz*Math.cos(yaw);
  return {x:p.x-Math.sin(yaw)*grip,y:p.y,z:p.z-Math.cos(yaw)*grip,yaw,
    pitch:Math.atan2(forward,dy),roll:-Math.asin(across/Math.hypot(dx,dy,dz))};
}

export function scooterSpot(pose=SCOOTER_START) {
  return {id:'ride',label:'Motorbike',x:pose.x,z:pose.z,hitY:.57,land:{x:pose.x,z:pose.z,yaw:pose.yaw}};
}

export function shoreline(angle) {
  const a=Math.atan2(Math.sin(angle),Math.cos(angle));
  const inlet=.136*Math.exp(-(((a+1.315)/.26)**2));
  const eastBeach=1.17*Math.max(0,Math.cos(a))**4;
  return 1+eastBeach+.033*Math.sin(3*a-.45)+.016*Math.sin(6*a+1)+.012*Math.sin(9*a)-inlet;
}

export const landRadius=(x,z)=>Math.hypot(x/10.35,z/6.66);
export function beachRadius(x,z){
  const nx=x/11.7,nz=z/8.15;
  return Math.hypot(nx,nz)/shoreline(Math.atan2(nz,nx));
}
export function nearbyBeach(x,z){
  const scale=1.03/beachRadius(x,z);
  return {x:x*scale,z:z*scale};
}
export function waterAtCoast(x,z){
  const scale=1.17/beachRadius(x,z);
  return {x:x*scale,z:z*scale,yaw:Math.atan2(x,z)};
}
export function groundHeight(x,z) {
  if((x/11.7)**2+(z/8.15)**2<.55)return 0;
  const radius=beachRadius(x,z);
  if(radius<=BEACH_PROFILE[0][0])return 0;
  for(let i=1;i<BEACH_PROFILE.length;i++){
    const [outer,low]=BEACH_PROFILE[i];
    if(radius>outer)continue;
    const [inner,high]=BEACH_PROFILE[i-1];
    return high+(low-high)*(radius-inner)/(outer-inner);
  }
  return BEACH_PROFILE.at(-1)[1];
}
export const inLagoon=(x,z)=>x*x+z*z<=OCEAN_RADIUS*OCEAN_RADIUS;
export function shoreActivity(current,x,z,jumpHeight=0) {
  const depth=SWIM_LEVEL-groundHeight(x,z);
  if(current==='swim')return depth<=STAND_DEPTH?null:'swim';
  if(current==='ride')return depth>=AXLE_DEPTH?'swim':'ride';
  return depth-jumpHeight>=KNEE_DEPTH?'swim':null;
}
export function canSwim(x,z) {
  return inLagoon(x,z)&&shoreActivity('swim',x,z)==='swim';
}

export function waterEntry(id) {
  let n=0;
  for(const ch of String(id))n=(n*31+ch.charCodeAt(0))>>>0;
  return {x:2.32+(n%9-4)*.17,z:-9.52-(Math.floor(n/9)%5)*.17,yaw:Math.PI};
}

export function jumpLift(at,now) {
  const t=(now-at)/JUMP_MS;
  return at>0&&t>=0&&t<1?4.4*t*(1-t):0;
}

// A short bank of unused travel time absorbs packets that arrive together over the network.
export function movementCredit(previous,elapsed,rate,travel){
  const available=Math.min(rate*1.6,(previous??rate*.85)+Math.max(0,elapsed)*rate);
  return travel<=available+.012?Math.max(0,available-travel):null;
}
