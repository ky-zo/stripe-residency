import {groundHeight} from '../shared/mobility.js';

const runs={
  PowPow2:{
    points:[[-1.36,5.22],[-1.25,4.78],[-.96,4.54],[-.65,4.56],[-.53,4.80],[-.62,5.18],[-.56,5.59],[-.31,6.00],[-.26,6.34],[-.50,6.53],[-.83,6.49],[-1.04,6.22],[-1.26,5.78]],
    speed:1.23,rest:1.15,offset:2.7,
  },
  Poopi:{
    points:[[-1.89,1.20],[-2.07,.05],[-.79,-.91],[-.83,-1.56],[-.30,-2.02],[1.41,-2.22],[1.87,-1.77],[2.80,-.68],[2.72,.31],[2.08,.68],[1.37,1.03],[.04,2.22],[-.52,2.64],[-1.24,2.38],[-1.86,2.00]],
    speed:1.49,rest:1.7,offset:5.1,
  },
};

export function createDogRun(T,dog){
  const {points,speed,rest,offset}=runs[dog.name];
  const curve=new T.CatmullRomCurve3(points.map(([x,z])=>new T.Vector3(x,0,z)),true);
  const travel=curve.getLength()/speed,direction=new T.Vector3();
  return serverTime=>{
    const seconds=serverTime/1000+offset,phase=seconds%(travel+rest);
    const t=Math.min(1,phase/travel);
    // Ease into and out of the sniff at the same spot each lap.
    const ramp=.07;
    let along=(t-ramp/2)/(1-ramp);
    if(t<ramp)along=t*t/(2*ramp*(1-ramp));
    if(t>1-ramp)along=1-(1-t)**2/(2*ramp*(1-ramp));
    curve.getPointAt(along,dog.root.position);
    curve.getTangentAt(along,direction);
    dog.root.position.y=groundHeight(dog.root.position.x,dog.root.position.z);
    dog.root.rotation.y=Math.atan2(direction.x,direction.z);
    dog.animate(seconds,phase<travel);
  };
}
