import {groundHeight} from '../shared/mobility.js';
import {dogPose} from '../shared/dogs.js';

// Places a dog for a room time. On the way back to its loop it follows `detour`, a walkable route,
// at whatever pace meets the loop on the shared schedule.
export function createDogRun(dog,detour=null){
  let route=null,routeFor=null;
  function walk(back,drop){
    if(routeFor!==drop){
      routeFor=drop;
      const points=[{x:drop.x,z:drop.z},...(detour?.(drop,back)||[])];
      const end=points.at(-1);
      if(Math.hypot(end.x-back.x,end.z-back.z)>.01)points.push({x:back.x,z:back.z});
      const lengths=[0];
      for(let i=1;i<points.length;i++)lengths.push(lengths[i-1]+Math.hypot(points[i].x-points[i-1].x,points[i].z-points[i-1].z));
      route={points,lengths};
    }
    return route;
  }
  return (serverTime,state=null)=>{
    const pose=dogPose(dog.name,state,serverTime);
    let {x,z,yaw}=pose;
    if(pose.back){
      const {points,lengths}=walk(pose.back,state.drop),goal=pose.progress*lengths.at(-1);
      let i=1;
      while(i<points.length-1&&lengths[i]<goal)i++;
      const a=points[i-1],b=points[i],span=lengths[i]-lengths[i-1],t=span?(goal-lengths[i-1])/span:1;
      x=a.x+(b.x-a.x)*t;z=a.z+(b.z-a.z)*t;
      if(span)yaw=Math.atan2(b.x-a.x,b.z-a.z);
    }
    dog.root.position.set(x,groundHeight(x,z),z);
    dog.root.rotation.y=yaw;
    dog.animate(pose.seconds,pose.moving);
  };
}
