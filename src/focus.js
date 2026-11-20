const key='palm-hours.focus.v1';
const length=25*60*1000;
function read() {
  try {
    const value=JSON.parse(localStorage.getItem(key));
    if(value && ['running','paused','finished'].includes(value.state) && Number.isFinite(value.remaining) && Number.isFinite(value.until) && value.remaining>=0 && value.remaining<=length) return value;
  } catch {}
  return null;
}
let session=read();
function save() {
  try { if(session)localStorage.setItem(key,JSON.stringify(session));else localStorage.removeItem(key); }catch{}
}
export function getFocus() {
  if(!session)return null;
  const remaining=session.state==='running'?Math.max(0,session.until-Date.now()):session.remaining;
  if(!remaining && session.state==='running'){session={...session,state:'finished',remaining:0};save();}
  return {state:session.state,seconds:Math.ceil(remaining/1000)};
}
export function beginFocus() {
  session={state:'running',remaining:length,until:Date.now()+length};
  save();return getFocus();
}
export function toggleFocus() {
  const active=getFocus();
  if(!active || active.state==='finished')return beginFocus();
  const remaining=active.state==='running'?Math.max(0,session.until-Date.now()):session.remaining;
  session={state:active.state==='running'?'paused':'running',remaining,until:Date.now()+remaining};
  save();return getFocus();
}
export function endFocus(){session=null;save();}
