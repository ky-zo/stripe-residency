import { initialBall } from '../shared/ball.js';
import {isBoatSeat} from '../shared/sports.js';

export function createRoom(events) {
  let socket=null,wanted=false,tries=0,attempt=0,retry,heartbeat,admissionTimer,offset=0,hasTime=false;
  let state={status:'offline',players:[],claims:{},members:[],ownId:null,ball:initialBall};
  // Discard credentials and profiles cached by older versions without reading them.
  try{localStorage.removeItem('stripe-residency.member.v1');}catch{}
  try{sessionStorage.removeItem('palm-hours.stay.v1');}catch{}
  let guest=null,preferredHandle=null,pendingGuest=null;
  function guestError(message){
    if(!pendingGuest)return;
    clearTimeout(pendingGuest.timeout);pendingGuest.reject(new Error(message));pendingGuest=null;
  }
  function sendGuest(){
    if(!pendingGuest||state.status!=='online'||pendingGuest.sent===socket)return;
    if(send({...pendingGuest.fields,type:pendingGuest.op}))pendingGuest.sent=socket;
  }
  function setGuest(fields,op='setGuest'){
    if(pendingGuest)return Promise.reject(new Error('Your guest is already joining.'));
    return new Promise((resolve,reject)=>{
      pendingGuest={fields,op,resolve,reject,sent:null,timeout:setTimeout(()=>guestError('The island took too long to reply. Try again.'),18000)};
      open();sendGuest();
    });
  }
  function syncGuest(){
    const me=state.players.find(p=>p.id===state.ownId);
    preferredHandle=me?.handle||null;
    guest=state.members.find(m=>m.id===me?.memberId)||null;
  }
  let lastSent=null,lastSendAt=0;
  function status(value){state={...state,status:value,ownId:null,claims:{},members:[],players:[]};events.state(state);}
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
    ws.onopen=()=>{if(ws===socket)send({type:'hello',guest,handle:preferredHandle});};
    ws.onmessage=e=>{
      if(ws!==socket)return;
      let m;try{m=JSON.parse(e.data);}catch{return;}
      syncTime(m.serverTime);
      if(m.type==='welcome'){
        clearTimeout(admissionTimer);tries=0;
        state={status:'online',ownId:m.id,players:m.players,claims:m.claims,members:m.members||[],ball:m.ball,scooter:m.scooter,boat:m.boat,court:m.court};
        lastSent=null;lastSendAt=0;syncGuest();events.state(state,true);sendGuest();
        clearInterval(heartbeat);heartbeat=setInterval(()=>send({type:'ping'}),18000);
      }else if(m.type==='state'){
        state={...state,players:m.players,claims:m.claims,members:m.members||[],ball:m.ball,scooter:m.scooter,boat:m.boat,court:m.court};syncGuest();events.state(state);
      }else if(m.type==='guestResult'){
        const request=pendingGuest;
        if(!request||request.op!==m.op)return;
        clearTimeout(request.timeout);pendingGuest=null;guest=m.guest||null;
        request.resolve(guest);
      }else if(m.type==='move'){
        const who=state.players.find(p=>p.id===m.id);if(who)Object.assign(who,{x:m.x,z:m.z,yaw:m.yaw,progress:m.progress||0,walking:m.walking,at:m.at});
        if(m.boat){
          state.boat=m.boat;
          for(const p of state.players)if(isBoatSeat(p.seat))Object.assign(p,m.boat,{walking:m.walking,at:m.at});
        }
        events.move?.(m);
      }else if(m.type==='jump'){
        const who=state.players.find(p=>p.id===m.id);if(who)who.jumpAt=m.at;
      }else if(m.type==='wave'){
        const who=state.players.find(p=>p.id===m.id);if(who)who.waveAt=m.at;events.wave(m);
      }else if(m.type==='ball'){state.ball=m.ball;events.ball(m.ball);}
      else if(m.type==='correct'){events.correct(m.player);lastSent=null;}
      else if(m.type==='error'){if(m.code==='member'&&pendingGuest)guestError(m.text);else events.error(m);}
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
    wanted=false;attempt++;guestError('You left the island.');guest=null;preferredHandle=null;clearTimeout(retry);clearTimeout(admissionTimer);clearInterval(heartbeat);const old=socket;socket=null;
    if(old)try{old.close(1000,'Left the courtyard');}catch{}
    status('offline');
  }
  function trigger(type,extra={}){
    if(state.status!=='online'){events.error({code:'offline',text:'Joining the shared island. Try again in a moment.'});return false;}
    return send({type,...extra});
  }
  function pose(x,z,yaw,walking,force=false,progress=0){
    if(state.status!=='online')return;
    const now=performance.now();
    if(!force&&now-lastSendAt<95)return;
    if(!force&&lastSent&&Math.hypot(x-lastSent.x,z-lastSent.z)<.024&&Math.abs(yaw-lastSent.yaw)<.035&&Math.abs(progress-lastSent.progress)<.003&&walking===lastSent.walking)return;
    if(send({type:'move',x,z,yaw,walking,progress})){lastSent={x,z,yaw,walking,progress};lastSendAt=now;}
  }
  return {open,close,trigger,pose,setGuest,clearGuest:()=>setGuest({},'clearGuest'),myGuest:()=>guest,now:()=>Date.now()+offset,get:()=>state};
}
