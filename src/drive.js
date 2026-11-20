const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const toward=(a,b,step)=>a+clamp(b-a,-step,step);

// The same throttle, steering and collisions drive keyboard, thumbstick and tap routes.
export function createDrive(){
  let speed=0,steer=0;
  return {
    get speed(){return speed;},get steer(){return steer;},
    reset(){speed=steer=0;},
    step(avatar,nav,dt,axes,route){
      const p=avatar.position;
      let throttle=axes.forward,turn=axes.right;
      const following=route.length>0;
      if(following){
        const next=route[0],dx=next.x-p.x,dz=next.z-p.z,dist=Math.hypot(dx,dz);
        if(dist<.24){route.shift();if(!route.length){speed=steer=0;return false;}return this.step(avatar,nav,dt,axes,route);}
        const aim=Math.atan2(dx,dz)-avatar.rotation.y;
        const delta=Math.atan2(Math.sin(aim),Math.cos(aim));
        turn=clamp(-delta*1.55,-1,1);
        throttle=Math.max(.20,Math.cos(delta))*Math.min(1,Math.max(.32,dist*.9));
      }
      const desired=throttle>=0?throttle*6.5:throttle*2.4;
      const brake=!throttle||Math.sign(desired)!==Math.sign(speed);
      speed=toward(speed,desired,dt*(brake?11:5.6));
      steer=toward(steer,turn,dt*6);
      const grip=Math.min(1,.44+Math.abs(speed)*.91);
      avatar.rotation.y-=steer*dt*(following?3.7:2.55)*grip*(speed<0?-1:1);
      const distance=speed*dt,steps=Math.max(1,Math.ceil(Math.abs(distance)/.11));
      const dx=Math.sin(avatar.rotation.y)*distance/steps,dz=Math.cos(avatar.rotation.y)*distance/steps;
      for(let i=0;i<steps;i++){
        const x=p.x+dx,z=p.z+dz,axle=speed>=0?.49:-.40;
        const clear=nav.canStand(x,z)&&nav.canStand(x+axle*Math.sin(avatar.rotation.y),z+axle*Math.cos(avatar.rotation.y));
        if(!clear){speed=0;if(following&&route.length===1&&Math.hypot(route[0].x-x,route[0].z-z)<.7)route.shift();return false;}
        p.x+=dx;p.z+=dz;
      }
      return Math.abs(speed)>.045;
    }
  };
}
