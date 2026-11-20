import { DurableObject } from 'cloudflare:workers';
import { residents } from '../src/residents.js';
import { SEATS, npcPose } from '../src/island-life.js';
import { ballAt, colors, initialBall } from '../shared/ball.js';
import { acceptsRoomPass, hasInvitation, invitationCookie, invitationPage } from '../shared/invitations.js';

const handles=residents.map(r=>r.handle);
const seatById=id=>SEATS.find(s=>String(s.id)===String(id));
const grace=120000;
const limit=64;
const signed=(v)=>Math.round(v*100)/100;
const finite=(...nums)=>nums.every(Number.isFinite);
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const publicPlayer=p=>({id:p.id,handle:p.handle,color:p.color,x:p.x,z:p.z,yaw:p.yaw,walking:p.walking,at:p.lastMove,seat:p.seat,waveAt:p.waveAt});
const send=(ws,msg)=>{try{ws.send(JSON.stringify(msg));}catch{}};
const localHost=url=>['127.0.0.1','localhost','[::1]'].includes(url.hostname);
export default {
  async fetch(req,env){
    const url=new URL(req.url);
    const local=env.LOCAL_DEVELOPMENT==='true'&&localHost(url);
    const key=env.ISLAND_INVITE;
    const join=key && url.pathname==='/join/'+key;
    const member=hasInvitation(req,key);
    if(url.pathname==='/robots.txt')return new Response('User-agent: *\nDisallow: /\n');
    if(url.pathname==='/live'){
      const origin=req.headers.get('Origin');
      const direct=(!origin||origin===url.origin||local&&/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin))&&(local||member);
      if(!direct && !await acceptsRoomPass(url.searchParams.get('admit'),origin,env.ROOM_SIGNING_KEY))return invitationPage();
      if(req.headers.get('Upgrade')?.toLowerCase()!=='websocket')return new Response('WebSocket required',{status:426});
      return env.ISLAND.getByName('palm-hours-residency').fetch(req);
    }
    if(!local&&!join&&!member)return invitationPage();
    if(req.method!=='GET'&&req.method!=='HEAD')return new Response('Method unavailable',{status:405});
    if(url.pathname==='/api/connection')return Response.json({url:'/live'},{headers:{'Cache-Control':'private, no-store'}});
    if(url.pathname==='/api/invite'){
      // A local Vite preview uses a same-origin WebSocket proxy.
      return Response.json({path:local?'/':'/join/'+key},{headers:{'Cache-Control':'private, no-store'}});
    }
    const file=(join||url.pathname==='/')?new URL('/index.html',url):url;
    const asset=await env.ASSETS.fetch(new Request(file,{method:req.method,headers:req.headers}));
    const response=new Response(asset.body,asset);
    response.headers.set('Referrer-Policy','no-referrer');
    response.headers.set('X-Robots-Tag','noindex, nofollow');
    response.headers.set('X-Content-Type-Options','nosniff');
    if(join)response.headers.append('Set-Cookie',invitationCookie(key));
    if(join||file.pathname==='/index.html')response.headers.set('Cache-Control','private, no-store');
    return response;
  }
};

export class Courtyard extends DurableObject {
  constructor(ctx,env){
    super(ctx,env);this.ctx=ctx;this.sql=ctx.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS stays (id TEXT PRIMARY KEY, ticket TEXT NOT NULL UNIQUE, handle TEXT UNIQUE, color TEXT NOT NULL, seat TEXT UNIQUE, x REAL NOT NULL, z REAL NOT NULL, yaw REAL NOT NULL, gone INTEGER)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS toys (id INTEGER PRIMARY KEY, pose TEXT NOT NULL)');
    this.peers=new Map();
    for(const ws of ctx.getWebSockets()){
      const p=ws.deserializeAttachment();if(p?.id)this.peers.set(p.id,{ws,p});
    }
    const now=Date.now();
    for(const row of this.sql.exec('SELECT id FROM stays WHERE gone IS NULL')){
      if(!this.peers.has(row.id))this.sql.exec('UPDATE stays SET gone=?,seat=NULL WHERE id=?',now,row.id);
    }
    this.prune(now);
    this.ball=JSON.parse(this.sql.exec('SELECT pose FROM toys WHERE id=1').toArray()[0]?.pose||JSON.stringify(initialBall));
  }
  async fetch(){
    if(this.ctx.getWebSockets().length>=limit)return new Response('Island is full. Try again shortly.',{status:503});
    const pair=new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);pair[1].serializeAttachment({connected:Date.now()});
    await this.ensureAlarm();
    return new Response(null,{status:101,webSocket:pair[0]});
  }
  prune(now){return this.sql.exec('DELETE FROM stays WHERE gone IS NOT NULL AND gone<=?',now-grace).rowsWritten;}
  async ensureAlarm(){
    if((await this.ctx.storage.getAlarm())===null)await this.ctx.storage.setAlarm(Date.now()+30000);
  }
  broadcast(message,except=null){
    const payload=JSON.stringify(message);
    for(const {ws} of this.peers.values())if(ws!==except){try{ws.send(payload);}catch{}}
  }
  state(){
    const claims={};
    for(const r of this.sql.exec('SELECT id,handle FROM stays WHERE handle IS NOT NULL'))claims[r.handle]=r.id;
    return {players:[...this.peers.values()].map(({p})=>publicPlayer(p)),claims,ball:this.ball,serverTime:Date.now()};
  }
  changed(){this.broadcast({type:'state',...this.state()});}
  remember(p,ws){ws.serializeAttachment(p);}
  persist(p,gone=null){
    this.sql.exec('UPDATE stays SET handle=?,seat=?,x=?,z=?,yaw=?,gone=? WHERE id=?',p.handle,p.seat,p.x,p.z,p.yaw,gone,p.id);
  }
  join(ws,ticket,now){
    this.prune(now);
    const resume=typeof ticket==='string' && ticket.length<120?this.sql.exec('SELECT * FROM stays WHERE ticket=?',ticket).toArray()[0]:null;
    let p;
    if(resume){
      const old=this.peers.get(resume.id);
      p=old?{...old.p}:{...resume};
      // Persisted tickets never enter presence packets or socket attachments.
      delete p.ticket;delete p.gone;
      if(old&&old.ws!==ws){this.peers.delete(p.id);old.ws.serializeAttachment({replaced:true});try{old.ws.close(4001,'This player reconnected');}catch{}}
      this.sql.exec('UPDATE stays SET gone=NULL WHERE id=?',p.id);
    }else{
      const used=new Set([...this.peers.values()].map(v=>v.p.color));
      const color=colors.find(c=>!used.has(c))||colors[this.peers.size%colors.length];
      const n=this.peers.size;
      p={id:crypto.randomUUID(),handle:null,color,x:signed(.08+Math.sin(n*2.39)*Math.min(1.45,.27*n)),z:signed(5.25+Math.cos(n*2.39)*Math.min(.65,.12*n)),yaw:-.48,seat:null};
      ticket=crypto.randomUUID()+'.'+crypto.randomUUID();
      this.sql.exec('INSERT INTO stays (id,ticket,color,x,z,yaw) VALUES (?,?,?,?,?,?)',p.id,ticket,color,p.x,p.z,p.yaw);
    }
    Object.assign(p,{lastSeen:now,lastMove:now,walking:false,waveAt:p.waveAt||0});
    this.remember(p,ws);this.peers.set(p.id,{ws,p});
    send(ws,{type:'welcome',id:p.id,ticket,...this.state()});
    this.changed();
  }
  webSocketMessage(ws,raw){
    if(typeof raw!=='string'||raw.length>1000){ws.close(1009,'Invalid packet');return;}
    let msg;try{msg=JSON.parse(raw);}catch{return;}
    if(!msg||typeof msg!=='object')return;
    const attached=ws.deserializeAttachment(),now=Date.now();
    if(!attached?.id){if(!attached?.replaced&&msg.type==='hello')this.join(ws,msg.ticket,now);return;}
    const peer=this.peers.get(attached.id);if(!peer||peer.ws!==ws)return;
    const p=peer.p;p.lastSeen=now;
    const reject=(code,text)=>send(ws,{type:'error',code,text});
    if(msg.type==='ping'){this.remember(p,ws);send(ws,{type:'pong',serverTime:now});return;}
    if(msg.type==='move'){
      if(p.seat!==null||!finite(msg.x,msg.z,msg.yaw)||now-p.lastMove<45)return;
      const elapsed=(now-p.lastMove)/1000;
      if((msg.x/10.6)**2+(msg.z/6.9)**2>1.035||dist(msg,p)>Math.min(23,elapsed*6.1+1.1)){
        send(ws,{type:'correct',player:publicPlayer(p)});return;
      }
      Object.assign(p,{x:signed(msg.x),z:signed(msg.z),yaw:signed(Math.atan2(Math.sin(msg.yaw),Math.cos(msg.yaw))),walking:msg.walking===true,lastMove:now});
      this.remember(p,ws);this.broadcast({type:'move',id:p.id,x:p.x,z:p.z,yaw:p.yaw,walking:p.walking,at:now},ws);return;
    }
    if(msg.type==='claim'){
      if(!handles.includes(msg.handle))return;
      this.prune(now);
      const owner=this.sql.exec('SELECT id FROM stays WHERE handle=?',msg.handle).toArray()[0];
      if(owner&&owner.id!==p.id){reject('taken','Someone else is already playing this resident.');send(ws,{type:'state',...this.state()});return;}
      if(p.handle!==msg.handle){
        const pose=npcPose(handles.indexOf(msg.handle),now);
        Object.assign(p,{handle:msg.handle,seat:null,x:signed(pose.x),z:signed(pose.z+(pose.seated?.78:0)),yaw:signed(pose.yaw),walking:false,lastMove:now});
      }
    }else if(msg.type==='release'){
      p.handle=null;
    }else if(msg.type==='sit'){
      const seat=seatById(msg.seat);
      if(!seat||dist(p,seat)>2.8){reject('seat','Walk up to the seat first.');return;}
      const owner=this.sql.exec('SELECT id FROM stays WHERE seat=?',String(seat.id)).toArray()[0];
      if(owner&&owner.id!==p.id){reject('seat','Someone just sat there. Try another seat.');return;}
      Object.assign(p,{seat:String(seat.id),x:seat.x,z:seat.z,yaw:seat.facing,walking:false});
    }else if(msg.type==='stand'){
      const seat=seatById(p.seat);
      if(seat)Object.assign(p,{x:signed(seat.x-Math.sin(seat.facing)*.7),z:signed(seat.z-Math.cos(seat.facing)*.7),yaw:seat.facing+Math.PI});
      p.seat=null;p.lastMove=now;
    }else if(msg.type==='wave'){
      if(now-p.waveAt<1100)return;
      p.waveAt=now;this.remember(p,ws);this.broadcast({type:'wave',id:p.id,at:now});return;
    }else if(msg.type==='kick'){
      const here=ballAt(this.ball,now);
      if(p.seat!==null || dist(p,here)>2.5){reject('ball','Walk a little closer to kick the ball.');return;}
      if(now-this.ball.start<420)return;
      let dx=here.x-p.x,dz=here.z-p.z;const length=Math.hypot(dx,dz);
      if(length<.06){dx=Math.sin(p.yaw);dz=Math.cos(p.yaw);}else{dx/=length;dz/=length;}
      const inCourt=(x,z)=>(x/9.25)**2+(z/5.8)**2<1&&!(x < -1.9 && z < -1.2)&&!(x>1.25&&z<-.65);
      let travel=3.25;
      for(let step=.25;step<=3.25;step+=.25)if(!inCourt(here.x+dx*step,here.z+dz*step)){travel=step-.24;break;}
      if(travel<.55){dx=-dx;dz=-dz;travel=1.2;}
      const next={x:here.x,z:here.z,toX:signed(here.x+dx*travel),toZ:signed(here.z+dz*travel),start:now,duration:1150};
      this.sql.exec('INSERT OR REPLACE INTO toys (id,pose) VALUES (1,?)',JSON.stringify(next));this.ball=next;
      this.broadcast({type:'ball',ball:next,id:p.id});return;
    }else return;
    this.persist(p);this.remember(p,ws);this.changed();
  }
  leave(ws){
    const p=ws.deserializeAttachment();if(!p?.id||this.peers.get(p.id)?.ws!==ws)return;
    p.seat=null;p.walking=false;this.persist(p,Date.now());
    this.peers.delete(p.id);this.changed();
  }
  webSocketClose(ws,code,reason){this.leave(ws);try{ws.close([1005,1006,1015].includes(code)?1000:code,reason);}catch{}}
  webSocketError(ws){this.leave(ws);try{ws.close(1011,'Connection ended');}catch{}}
  async alarm(){
    const now=Date.now();
    for(const ws of this.ctx.getWebSockets()){
      const p=ws.deserializeAttachment();
      if(p?.replaced||now-(p?.lastSeen||p?.connected||0)>125000||(!p?.id&&now-p.connected>20000)){this.leave(ws);try{ws.close(1001,'Reconnect to the island');}catch{}}
    }
    if(this.prune(now))this.changed();
    if(this.ctx.getWebSockets().length||this.sql.exec('SELECT id FROM stays LIMIT 1').toArray().length)await this.ctx.storage.setAlarm(now+30000);
  }
}
