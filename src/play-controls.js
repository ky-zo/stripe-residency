export function bindThumbstick(pad,send){
  const knob=pad.querySelector('span');
  let pointer=null;
  function clear(){
    pointer=null;knob.style.transform='';
    pad.classList.remove('pressed');send(0,0);
  }
  function move(event){
    if(event.pointerId!==pointer)return;
    const box=pad.getBoundingClientRect(),radius=box.width*.36;
    const x=(event.clientX-box.left-box.width/2)/radius;
    const y=(event.clientY-box.top-box.height/2)/radius;
    const length=Math.max(1,Math.hypot(x,y));
    const dx=x/length,dy=y/length;
    knob.style.transform='translate('+dx*radius*.72+'px,'+dy*radius*.72+'px)';
    send(dx,-dy);
  }
  pad.addEventListener('pointerdown',event=>{
    if(pointer!==null||event.button!==0)return;
    event.preventDefault();pointer=event.pointerId;pad.setPointerCapture(pointer);
    pad.classList.add('pressed');move(event);
  });
  pad.addEventListener('pointermove',move);
  for(const type of ['pointerup','pointercancel','lostpointercapture'])pad.addEventListener(type,event=>{if(event.pointerId===pointer)clear();});
  window.addEventListener('blur',clear);
  return clear;
}
