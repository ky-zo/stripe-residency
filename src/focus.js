const length=25*60*1000;
try{localStorage.removeItem('palm-hours.focus.v1');}catch{}
let session=null;
export function getFocus() {
  if(!session)return null;
  const remaining=session.state==='running'?Math.max(0,session.until-Date.now()):session.remaining;
  if(!remaining && session.state==='running')session={...session,state:'finished',remaining:0};
  return {state:session.state,seconds:Math.ceil(remaining/1000)};
}
export function beginFocus() {
  session={state:'running',remaining:length,until:Date.now()+length};
  return getFocus();
}
export function toggleFocus() {
  const active=getFocus();
  if(!active || active.state==='finished')return beginFocus();
  const remaining=active.state==='running'?Math.max(0,session.until-Date.now()):session.remaining;
  session={state:active.state==='running'?'paused':'running',remaining,until:Date.now()+remaining};
  return getFocus();
}
export function endFocus(){session=null;}
