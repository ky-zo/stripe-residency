export const initialBall={x:1.2,z:2.35,toX:1.2,toZ:2.35,start:0,duration:1};
export function ballAt(ball,time) {
  const t=Math.max(0,Math.min(1,(time-ball.start)/ball.duration));
  const ease=1-(1-t)**2;
  return {x:ball.x+(ball.toX-ball.x)*ease,z:ball.z+(ball.toZ-ball.z)*ease,y:.32+Math.abs(Math.sin(t*Math.PI*2))*.44*(1-t),roll:ease*Math.hypot(ball.toX-ball.x,ball.toZ-ball.z)/.32};
}
export const colors=['#e58a5f','#77aaa0','#e4b754','#8e81ad','#88a763','#dc8296','#72a6c4','#c5885d'];
