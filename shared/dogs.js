// The island dogs trot fixed loops on the room clock, so every visitor sees them in the same place.
// A visitor may carry one. Once it is set down, it rests a moment and then trots back to its loop.
export const DOG_RUNS={
  PowPow2:{
    points:[[-1.36,5.22],[-1.25,4.78],[-.96,4.54],[-.65,4.56],[-.53,4.80],[-.62,5.18],[-.56,5.59],[-.31,6.00],[-.26,6.34],[-.50,6.53],[-.83,6.49],[-1.04,6.22],[-1.26,5.78]],
    speed:1.23,rest:1.15,offset:2.7,
  },
  Poopi:{
    points:[[-1.89,1.20],[-2.07,.05],[-.79,-.91],[-.83,-1.56],[-.30,-2.02],[1.41,-2.22],[1.87,-1.77],[2.80,-.68],[2.72,.31],[2.08,.68],[1.37,1.03],[.04,2.22],[-.52,2.64],[-1.24,2.38],[-1.86,2.00]],
    speed:1.49,rest:1.7,offset:5.1,
  },
};
export const DOG_NAMES=Object.keys(DOG_RUNS);
export const DOG_REACH=1.7;
// A carried dog lies across its holder's arms, facing their left.
export const HELD_TURN=Math.PI/2;
const SETTLE_MS=1600,TROT=2.1;

// Closed centripetal Catmull-Rom, evaluated exactly as three.js CatmullRomCurve3 does.
function spline(points){
  const l=points.length;
  const gap=(a,b)=>((a[0]-b[0])**2+(a[1]-b[1])**2)**.25;
  function cubic(x0,x1,x2,x3,dt0,dt1,dt2,t){
    let t1=(x1-x0)/dt0-(x2-x0)/(dt0+dt1)+(x2-x1)/dt1;
    let t2=(x2-x1)/dt1-(x3-x1)/(dt1+dt2)+(x3-x2)/dt2;
    t1*=dt1;t2*=dt1;
    const c2=-3*x1+3*x2-2*t1-t2,c3=2*x1-2*x2+t1+t2,s=t*t;
    return x1+t1*t+c2*s+c3*(s*t);
  }
  function point(t){
    const p=l*t;
    let i=Math.floor(p);const w=p-i;
    i+=i>0?0:(Math.floor(Math.abs(i)/l)+1)*l;
    const p0=points[(i-1)%l],p1=points[i%l],p2=points[(i+1)%l],p3=points[(i+2)%l];
    let dt0=gap(p0,p1),dt1=gap(p1,p2),dt2=gap(p2,p3);
    if(dt1<1e-4)dt1=1;
    if(dt0<1e-4)dt0=dt1;
    if(dt2<1e-4)dt2=dt1;
    return [cubic(p0[0],p1[0],p2[0],p3[0],dt0,dt1,dt2,w),cubic(p0[1],p1[1],p2[1],p3[1],dt0,dt1,dt2,w)];
  }
  const lengths=[0];
  let last=point(0);
  for(let n=1;n<=200;n++){
    const next=point(n/200);
    lengths.push(lengths[n-1]+Math.hypot(next[0]-last[0],next[1]-last[1]));last=next;
  }
  const total=lengths[200];
  function along(u){
    const target=u*total;
    let low=0,high=200;
    while(low<=high){
      const i=Math.floor(low+(high-low)/2),c=lengths[i]-target;
      if(c<0)low=i+1;else if(c>0)high=i-1;else{high=i;break;}
    }
    if(lengths[high]===target)return high/200;
    return (high+(target-lengths[high])/(lengths[high+1]-lengths[high]))/200;
  }
  return {total,at(u){
    const t=along(u),a=point(Math.max(0,t-.0001)),b=point(Math.min(1,t+.0001)),[x,z]=point(t);
    return {x,z,yaw:Math.atan2(b[0]-a[0],b[1]-a[1])};
  }};
}

const loops=new Map();
function loopFor(name){
  if(!loops.has(name)){
    const run=DOG_RUNS[name],curve=spline(run.points);
    loops.set(name,{...run,curve,travel:curve.total/run.speed});
  }
  return loops.get(name);
}

// Where a dog is on its own loop at a room time, and how far into the lap it is.
export function loopPose(name,time){
  const {curve,travel,rest,offset}=loopFor(name);
  const seconds=time/1000+offset,phase=seconds%(travel+rest);
  const t=Math.min(1,phase/travel);
  // Ease into and out of the sniff at the same spot each lap.
  const ramp=.07;
  let u=(t-ramp/2)/(1-ramp);
  if(t<ramp)u=t*t/(2*ramp*(1-ramp));
  if(t>1-ramp)u=1-(1-t)**2/(2*ramp*(1-ramp));
  return {...curve.at(u),seconds,moving:phase<travel};
}

// A set-down dog settles, then trots in a line to meet its loop where the loop will be on arrival.
export function dogReturn(name,drop){
  const start=drop.at+SETTLE_MS;
  let arrive=start;
  for(let i=0;i<24;i++){
    const p=loopPose(name,arrive);
    arrive=start+Math.hypot(p.x-drop.x,p.z-drop.z)/TROT*1000;
  }
  const meet=loopPose(name,arrive);
  return {start,arrive,x:meet.x,z:meet.z};
}

// The dog's spot on the ground at a room time. A held dog is wherever its holder is.
export function dogPose(name,state,time){
  const drop=state?.drop;
  if(!drop||state.holder)return loopPose(name,time);
  const back=dogReturn(name,drop),seconds=time/1000+loopFor(name).offset;
  if(time>=back.arrive)return loopPose(name,time);
  if(time<=back.start)return {x:drop.x,z:drop.z,yaw:drop.yaw,seconds,moving:false,settling:true};
  const t=(time-back.start)/(back.arrive-back.start);
  return {x:drop.x+(back.x-drop.x)*t,z:drop.z+(back.z-drop.z)*t,yaw:Math.atan2(back.x-drop.x,back.z-drop.z),seconds,moving:true,back,progress:t};
}
