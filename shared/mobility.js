export const SCOOTER_START = {x:1.34,z:5.82,yaw:Math.PI/2};
export const JUMP_MS = 720;
export const SWIM_LEVEL = -.64;

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

export function climbPose(spot,progress) {
  const t=.014+.66*Math.max(0,Math.min(1,progress));
  const p=palmTrunk(spot.palm,t),yaw=spot.land.yaw;
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
  return 1+.033*Math.sin(3*a-.45)+.016*Math.sin(6*a+1)+.012*Math.sin(9*a)-inlet;
}

export const landRadius=(x,z)=>Math.hypot(x/10.35,z/6.66);
export function beachRadius(x,z){
  const nx=x/11.7,nz=z/8.15;
  return Math.hypot(nx,nz)/shoreline(Math.atan2(nz,nx));
}
export function waterAtCoast(x,z){
  const scale=1.17/beachRadius(x,z);
  return {x:x*scale,z:z*scale,yaw:Math.atan2(x,z)};
}
export function landAtCoast(x,z){
  const scale=.955/landRadius(x,z);
  return {x:x*scale,z:z*scale};
}
export function canSwim(x,z) {
  return (x/17.8)**2+(z/14.6)**2<=1 && beachRadius(x,z)>=1.12;
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
