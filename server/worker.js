import { DurableObject } from 'cloudflare:workers';
import { residents } from '../src/residents.js';
import { SEATS, PLAY_SPOTS, npcLandPose } from '../src/island-life.js';
import {beachRadius,climbPose,climbSpots,inLagoon,JUMP_MS,jumpLift,landRadius,shoreActivity,SCOOTER_START,scooterSpot,waterAtCoast,waterEntry} from '../shared/mobility.js';
import { activityId, activitySeat, climbKey } from '../shared/activities.js';
import { ballAt, colors, initialBall } from '../shared/ball.js';
import { acceptsRoomPass, hasInvitation, invitationCookie, invitationPage } from '../shared/invitations.js';

import {memberDetails, validMemberKey} from '../shared/members.js';

const handles=residents.map(r=>r.handle);
const seatById=id=>SEATS.find(s=>String(s.id)===String(id));
const grace=120000;
const limit=64;
const signed=(v)=>Math.round(v*100)/100;
const finite=(...nums)=>nums.every(Number.isFinite);
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const publicPlayer=p=>({id:p.id,memberId:p.memberId||null,handle:p.handle,color:p.color,x:p.x,z:p.z,yaw:p.yaw,walking:p.walking,at:p.lastMove,seat:p.seat,waveAt:p.waveAt,jumpAt:p.jumpAt||0,progress:p.progress||0});
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
    if(url.pathname==='/api/members')return env.ISLAND.getByName('palm-hours-residency').fetch(req);
    if(url.pathname==='/api/connection')return Response.json({url:'/live'},{headers:{'Cache-Control':'private, no-store'}});
    if(url.pathname==='/api/invite'){
      // A local Vite preview uses a same-origin WebSocket proxy.
      return Response.json({path:local?'/':'/join/'+key},{headers:{'Cache-Control':'private, no-store'}});
    }
    const file=(join||url.pathname==='/')?new URL('/index.html',url):url.pathname==='/palm-hours-figures.zip'?new URL('/stripe-residency-figures.zip',url):url;
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
    this.sql.exec('CREATE TABLE IF NOT EXISTS members (id TEXT PRIMARY KEY, owner_key TEXT UNIQUE NOT NULL, name TEXT NOT NULL, note TEXT NOT NULL, appearance TEXT NOT NULL, joined INTEGER NOT NULL)');
    if (!this.sql.exec('PRAGMA table_info(stays)').toArray().some(column => column.name === 'member_id')) {
      this.sql.exec('ALTER TABLE stays ADD COLUMN member_id TEXT');
    }
    this.sql.exec('CREATE UNIQUE INDEX IF NOT EXISTS stays_member ON stays(member_id) WHERE member_id IS NOT NULL');
    this.peers=new Map();
    for(const ws of ctx.getWebSockets()){
      const p=ws.deserializeAttachment();if(p?.id)this.peers.set(p.id,{ws,p});
    }
    this.scooter=JSON.parse(this.sql.exec('SELECT pose FROM toys WHERE id=2').toArray()[0]?.pose||JSON.stringify(SCOOTER_START));
    const now=Date.now();
    for(const row of this.sql.exec('SELECT * FROM stays WHERE gone IS NULL').toArray()){
      if(!this.peers.has(row.id)){
        row.memberId=row.member_id;
        this.dismount(row);
        this.persist(row,now);
      }
    }
    this.prune(now);
    this.ball=JSON.parse(this.sql.exec('SELECT pose FROM toys WHERE id=1').toArray()[0]?.pose||JSON.stringify(initialBall));
  }
  directory(){
    return this.sql.exec('SELECT id,name,note,appearance FROM members ORDER BY joined,id').toArray().map(m=>({...m,appearance:JSON.parse(m.appearance)}));
  }
  async fetch(request){
    if(new URL(request.url).pathname==='/api/members'){
      return Response.json({members:this.directory()},{headers:{'Cache-Control':'private, no-store'}});
    }
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
    return {players:[...this.peers.values()].map(({p})=>publicPlayer(p)),claims,members:this.directory(),ball:this.ball,scooter:this.scooter,serverTime:Date.now()};
  }
  changed(){this.broadcast({type:'state',...this.state()});}
  remember(p,ws){ws.serializeAttachment(p);}
  persist(p,gone=null){
    this.sql.exec('UPDATE stays SET handle=?,seat=?,x=?,z=?,yaw=?,gone=?,member_id=? WHERE id=?',p.handle,p.seat,p.x,p.z,p.yaw,gone,p.memberId||null,p.id);
  }
  playSpot(id,key){
    if(id==='climb')return climbSpots.find(s=>s.key===key);
    if(id==='ride')return scooterSpot(this.scooter);
    return PLAY_SPOTS.find(s=>s.id===id);
  }
  parkScooter({x,z,yaw}){
    this.scooter={x,z,yaw};
    this.sql.exec('INSERT OR REPLACE INTO toys (id,pose) VALUES (2,?)',JSON.stringify(this.scooter));
  }
  dismount(p,exit){
    const id=activityId(p.seat);
    if(id==='ride'){
      this.parkScooter(p);
      if(exit&&finite(exit.x,exit.z)&&dist(exit,p)<1.1&&inLagoon(exit.x,exit.z)&&!shoreActivity(null,exit.x,exit.z)){
        p.x=signed(exit.x);p.z=signed(exit.z);
      }
    }else if(id==='swim'&&exit&&finite(exit.x,exit.z)&&beachRadius(p.x,p.z)<1.22&&landRadius(exit.x,exit.z)<1.01&&dist(exit,p)<5.3){
      p.x=signed(exit.x);p.z=signed(exit.z);
    }else{
      const spot=this.playSpot(id,climbKey(p.seat)),seat=seatById(p.seat);
      if(spot)Object.assign(p,spot.land);
      if(seat)Object.assign(p,{x:signed(seat.x-Math.sin(seat.facing)*.7),z:signed(seat.z-Math.cos(seat.facing)*.7),yaw:seat.facing+Math.PI});
    }
    p.seat=null;p.walking=false;p.progress=0;p.jumpAt=0;
  }
  join(ws,ticket,now,memberKey){
    this.prune(now);
    const member=validMemberKey(memberKey)?this.sql.exec('SELECT id FROM members WHERE owner_key=?',memberKey).toArray()[0]:null;
    const previous=typeof ticket==='string' && ticket.length<120?this.sql.exec('SELECT * FROM stays WHERE ticket=?',ticket).toArray()[0]:null;
    const memberStay=member?this.sql.exec('SELECT * FROM stays WHERE member_id=?',member.id).toArray()[0]:null;
    const resume=memberStay || (previous&&(!previous.member_id||previous.member_id===member?.id)?previous:null);
    let p;
    if(resume){
      const old=this.peers.get(resume.id);
      p=old?{...old.p}:{...resume};
      // Persisted tickets never enter presence packets or socket attachments.
      ticket=resume.ticket;
      p.memberId=member?.id||null;
      delete p.ticket;delete p.gone;delete p.member_id;
      if(old&&old.ws!==ws){this.peers.delete(p.id);old.ws.serializeAttachment({replaced:true});try{old.ws.close(4001,'This player reconnected');}catch{}}
      this.sql.exec('UPDATE stays SET gone=NULL,member_id=? WHERE id=?',p.memberId,p.id);
    }else{
      const used=new Set([...this.peers.values()].map(v=>v.p.color));
      const color=colors.find(c=>!used.has(c))||colors[this.peers.size%colors.length];
      const n=this.peers.size;
      p={id:crypto.randomUUID(),memberId:member?.id||null,handle:null,color,x:signed(.08+Math.sin(n*2.39)*Math.min(1.45,.27*n)),z:signed(5.25+Math.cos(n*2.39)*Math.min(.65,.12*n)),yaw:-.48,seat:null};
      ticket=crypto.randomUUID()+'.'+crypto.randomUUID();
      this.sql.exec('INSERT INTO stays (id,ticket,color,x,z,yaw,member_id) VALUES (?,?,?,?,?,?,?)',p.id,ticket,color,p.x,p.z,p.yaw,p.memberId);
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
    if(!attached?.id){if(!attached?.replaced&&msg.type==='hello')this.join(ws,msg.ticket,now,msg.memberKey);return;}
    const peer=this.peers.get(attached.id);if(!peer||peer.ws!==ws)return;
    const p=peer.p;p.lastSeen=now;
    const reject=(code,text)=>send(ws,{type:'error',code,text});
    if(msg.type==='ping'){this.remember(p,ws);send(ws,{type:'pong',serverTime:now});return;}
    if(msg.type==='move'){
      if(!finite(msg.x,msg.z,msg.yaw))return;
      const id=activityId(p.seat),elapsed=(now-p.lastMove)/1000;
      if(p.seat!==null&&!['swim','ride','climb'].includes(id))return;
      let pose={x:msg.x,z:msg.z,yaw:msg.yaw},progress=0,nextActivity=id;
      if(id==='climb'){
        const spot=this.playSpot(id,climbKey(p.seat));
        if(!spot||!Number.isFinite(msg.progress)||msg.progress<0||msg.progress>1||Math.abs(msg.progress-(p.progress||0))>elapsed*.8+.09){
          send(ws,{type:'correct',player:publicPlayer(p)});return;
        }
        progress=msg.progress;pose=climbPose(spot,progress);
      }else{
        const speed=id==='ride'?8.8:id==='swim'?4.8:6.1;
        if(!inLagoon(msg.x,msg.z)||dist(msg,p)>Math.min(23,elapsed*speed+1.1)){send(ws,{type:'correct',player:publicPlayer(p)});return;}
        nextActivity=shoreActivity(id,msg.x,msg.z,jumpLift(p.jumpAt,now));
      }
      if(elapsed<.045&&nextActivity===id)return;
      Object.assign(p,{x:signed(pose.x),z:signed(pose.z),yaw:signed(Math.atan2(Math.sin(pose.yaw),Math.cos(pose.yaw))),progress,walking:msg.walking===true,lastMove:now});
      if(nextActivity!==id){
        p.seat=nextActivity==='swim'?activitySeat('swim',p.id):null;p.jumpAt=0;
        this.ctx.storage.transactionSync(()=>{
          if(id==='ride')this.parkScooter(SCOOTER_START);
          this.persist(p);
        });
        this.remember(p,ws);this.changed();return;
      }
      this.remember(p,ws);this.broadcast({type:'move',id:p.id,x:p.x,z:p.z,yaw:p.yaw,progress,walking:p.walking,at:now},ws);return;
    }
    if(msg.type==='jump'){
      if(p.seat!==null||now-(p.jumpAt||0)<JUMP_MS+70)return;
      p.jumpAt=now;this.remember(p,ws);this.broadcast({type:'jump',id:p.id,at:now});return;
    }
    if(msg.type==='saveMember'||msg.type==='removeMember'){
      if(!validMemberKey(msg.key)){reject('member','Reopen the member form and try again.');return;}
      const record=this.sql.exec('SELECT id FROM members WHERE owner_key=?',msg.key).toArray()[0];
      if(p.memberId && p.memberId!==record?.id){reject('member','This member belongs to a different browser.');return;}
      if(msg.type==='removeMember'){
        if(!record||p.memberId!==record.id){reject('member','Open your own member to remove it.');return;}
        this.ctx.storage.transactionSync(()=>{
          this.sql.exec('DELETE FROM members WHERE id=?',record.id);
          p.memberId=null;
          this.persist(p);
        });
      }else{
        const details=memberDetails(msg);
        if(!details){reject('member','Check your name and appearance, then try again.');return;}
        const id=record?.id||crypto.randomUUID();
        const existing=this.sql.exec('SELECT id,gone FROM stays WHERE member_id=? AND id<>?',id,p.id).toArray()[0];
        if(existing&&existing.gone===null){reject('member','Your member is already on the island in another tab.');return;}
        this.ctx.storage.transactionSync(()=>{
          if(existing)this.sql.exec('UPDATE stays SET member_id=NULL WHERE id=?',existing.id);
          this.sql.exec('INSERT INTO members (id,owner_key,name,note,appearance,joined) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,note=excluded.note,appearance=excluded.appearance',
            id,msg.key,details.name,details.note,JSON.stringify(details.appearance),now);
          p.memberId=id;p.handle=null;
          this.persist(p);
        });
      }
      this.remember(p,ws);
      send(ws,{type:'memberResult',memberId:p.memberId,op:msg.type});
      this.changed();return;
    }
    if(msg.type==='claim'){
      if(!handles.includes(msg.handle))return;
      this.prune(now);
      const owner=this.sql.exec('SELECT id FROM stays WHERE handle=?',msg.handle).toArray()[0];
      if(owner&&owner.id!==p.id){reject('taken','Someone else is already playing this resident.');send(ws,{type:'state',...this.state()});return;}
      if(p.handle!==msg.handle){
        this.dismount(p);
        const pose=npcLandPose(handles.indexOf(msg.handle),now);
        Object.assign(p,{handle:msg.handle,seat:null,x:signed(pose.x),z:signed(pose.z),yaw:signed(pose.yaw),walking:false,lastMove:now});
      }
    }else if(msg.type==='release'){
      p.handle=null;
    }else if(msg.type==='sit'){
      const seat=seatById(msg.seat);
      if(!seat||p.seat!==null||dist(p,seat)>2.8){reject('seat','Walk up to an open seat first.');return;}
      const owner=this.sql.exec('SELECT id FROM stays WHERE seat=?',String(seat.id)).toArray()[0];
      if(owner&&owner.id!==p.id){reject('seat','Someone just sat there. Try another seat.');return;}
      Object.assign(p,{seat:String(seat.id),x:seat.x,z:seat.z,yaw:seat.facing,walking:false});
    }else if(msg.type==='activity'){
      const spot=this.playSpot(msg.id,msg.key);
      // Tabs loaded before depth-based movement still send a separate beach-entry request.
      const coastline=spot?.id==='swim'&&msg.shore===true&&landRadius(p.x,p.z)>.90;
      if(!spot||p.seat!==null||(!coastline&&dist(p,spot.land)>2.8)){reject('activity','Walk up to the activity first.');return;}
      const seat=activitySeat(spot.id,p.id,spot.key);
      if(this.sql.exec('SELECT id FROM stays WHERE seat=? AND id<>?',seat,p.id).toArray().length){
        reject('activity',spot.id==='ride'?'Someone is riding the motorbike.':spot.id==='climb'?'Someone is on this palm. Try another tree.':'The sunbed is occupied.');return;
      }
      const origin=coastline?waterAtCoast(p.x,p.z):spot.id==='swim'?waterEntry(p.id):spot.id==='climb'?climbPose(spot,0):spot.land;
      Object.assign(p,{x:origin.x,z:origin.z,yaw:origin.yaw,seat,progress:0,jumpAt:0,walking:false,lastMove:now});
    }else if(msg.type==='stand'){
      this.dismount(p,msg.exit);p.lastMove=now;
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
    this.dismount(p);this.persist(p,Date.now());
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
