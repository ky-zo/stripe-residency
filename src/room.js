import { initialBall } from '../shared/ball.js';

const memberStorage='stripe-residency.member.v1';
const ticketKey='palm-hours.stay.v1';
export function createRoom(events) {
  let socket=null,wanted=false,tries=0,attempt=0,retry,heartbeat,admissionTimer,offset=0,hasTime=false;
  let state={status:'offline',players:[],claims:{},members:[],ownId:null,ball:initialBall};
  let ticket;try{ticket=sessionStorage.getItem(ticketKey);}catch{}
  let saved={};
  try{saved=JSON.parse(localStorage.getItem(memberStorage)||'{}')||{};}catch{}
  let pendingMember=null;
  function storeMember(value){
    saved=value;
    try{if(value.key)localStorage.setItem(memberStorage,JSON.stringify(value));else localStorage.removeItem(memberStorage);}catch{}
  }
  function memberError(message){
    if(!pendingMember)return;
    clearTimeout(pendingMember.timeout);pendingMember.reject(new Error(message));pendingMember=null;
  }
  function sendMember(){
    if(!pendingMember||state.status!=='online'||pendingMember.sent===socket)return;
    if(send({...pendingMember.fields,type:pendingMember.op,key:saved.key}))pendingMember.sent=socket;
  }
  function saveMember(fields,op='saveMember'){
    if(pendingMember)return Promise.reject(new Error('Your member is already being saved.'));
    if(!saved.key)storeMember({key:crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','')});
    return new Promise((resolve,reject)=>{
      pendingMember={fields,op,resolve,reject,sent:null,timeout:setTimeout(()=>memberError('The island took too long to reply. Try again.'),18000)};
      open();sendMember();
    });
  }
  function rememberIdentity(){
    const id=state.players.find(p=>p.id===state.ownId)?.memberId;
    const member=id&&state.members.find(m=>m.id===id);
    if(member&&saved.key&&JSON.stringify(member)!==JSON.stringify(saved.profile))storeMember({...saved,profile:member});
    else if(!id&&saved.profile&&!pendingMember)storeMember({key:saved.key});
  }
  let lastSent=null,lastSendAt=0;
  function status(value){state={...state,status:value};events.state(state);}
  function send(packet){
    if(socket?.readyState!==WebSocket.OPEN)return false;
    socket.send(JSON.stringify(packet));return true;
  }
  function syncTime(t){
    if(!Number.isFinite(t))return;
    const next=t-Date.now();
    offset=hasTime?offset*.75+next*.25:next;hasTime=true;
  }
  function reconnect(){
    tries++;status('reconnecting');
    retry=setTimeout(connect,Math.min(9000,350*2**Math.min(tries,5))+Math.random()*240);
  }
  async function connect(){
    if(!wanted)return;
    const current=++attempt;
    status(tries?'reconnecting':'connecting');
    let ws;
    try{
      const response=await fetch('/api/connection',{cache:'no-store',signal:AbortSignal.timeout(10000)});
      if(!response.ok)throw new Error('Room unavailable');
      const data=await response.json();
      if(current!==attempt||!wanted)return;
      const url=new URL(data.url,location.href);
      if(url.protocol==='https:')url.protocol='wss:';
      if(url.protocol==='http:')url.protocol='ws:';
      ws=new WebSocket(url);socket=ws;
    }catch{
      if(current===attempt&&wanted)reconnect();
      return;
    }
    admissionTimer=setTimeout(()=>{
      if(ws!==socket||!wanted||state.status==='online')return;
      socket=null;try{ws.close(4000,'Retry room admission');}catch{}reconnect();
    },9000);
    ws.onopen=()=>{if(ws===socket)send({type:'hello',ticket,memberKey:saved.key});};
    ws.onmessage=e=>{
      if(ws!==socket)return;
      let m;try{m=JSON.parse(e.data);}catch{return;}
      syncTime(m.serverTime);
      if(m.type==='welcome'){
        clearTimeout(admissionTimer);tries=0;ticket=m.ticket;try{sessionStorage.setItem(ticketKey,ticket);}catch{}
        state={status:'online',ownId:m.id,players:m.players,claims:m.claims,members:m.members||[],ball:m.ball};
        lastSent=null;lastSendAt=0;rememberIdentity();events.state(state,true);sendMember();
        clearInterval(heartbeat);heartbeat=setInterval(()=>send({type:'ping'}),18000);
      }else if(m.type==='state'){
        state={...state,players:m.players,claims:m.claims,members:m.members||[],ball:m.ball};rememberIdentity();events.state(state);
      }else if(m.type==='memberResult'){
        const request=pendingMember;
        if(!request || request.op!==m.op)return;
        clearTimeout(request.timeout);pendingMember=null;
        if(m.memberId)storeMember({...saved,profile:{...request.fields,id:m.memberId}});
        else storeMember({});
        request.resolve(saved.profile||null);
      }else if(m.type==='move'){
        const who=state.players.find(p=>p.id===m.id);if(who)Object.assign(who,{x:m.x,z:m.z,yaw:m.yaw,walking:m.walking,at:m.at});
        events.move?.(m);
      }else if(m.type==='wave'){
        const who=state.players.find(p=>p.id===m.id);if(who)who.waveAt=m.at;events.wave(m);
      }else if(m.type==='ball'){state.ball=m.ball;events.ball(m.ball);}
      else if(m.type==='correct'){events.correct(m.player);lastSent=null;}
      else if(m.type==='error'){if(m.code==='member'&&pendingMember)memberError(m.text);else events.error(m);}
    };
    ws.onclose=e=>{
      if(ws!==socket)return;
      socket=null;clearTimeout(admissionTimer);clearInterval(heartbeat);
      if(!wanted)return;
      if(e.code===4001){wanted=false;status('offline');events.error({code:'session',text:'This player opened the island in another tab.'});return;}
      reconnect();
    };
    ws.onerror=()=>{try{ws.close();}catch{}};
  }
  function open(){if(wanted)return;wanted=true;tries=0;connect();}
  function close(){
    wanted=false;attempt++;memberError('You left the courtyard. Try again to save your member.');clearTimeout(retry);clearTimeout(admissionTimer);clearInterval(heartbeat);const old=socket;socket=null;
    if(old)try{old.close(1000,'Left the courtyard');}catch{}
    state={...state,players:[],claims:{},ownId:null,status:'offline'};events.state(state);
  }
  function trigger(type,extra={}){
    if(state.status!=='online'){events.error({code:'offline',text:'Joining the shared island. Try again in a moment.'});return false;}
    return send({type,...extra});
  }
  function pose(x,z,yaw,walking,force=false){
    if(state.status!=='online')return;
    const now=performance.now();
    if(!force&&now-lastSendAt<95)return;
    if(!force&&lastSent&&Math.hypot(x-lastSent.x,z-lastSent.z)<.024&&Math.abs(yaw-lastSent.yaw)<.035&&walking===lastSent.walking)return;
    if(send({type:'move',x,z,yaw,walking})){lastSent={x,z,yaw,walking};lastSendAt=now;}
  }
  return {open,close,trigger,pose,saveMember,removeMember:()=>saveMember({},'removeMember'),myMember:()=>saved.profile||null,now:()=>Date.now()+offset,get:()=>state};
}
