import { DurableObject } from 'cloudflare:workers';
import { matchingResident, residents } from '../src/residents.js';
import { SEATS, PLAY_SPOTS, npcLandPose } from '../src/island-life.js';
import {beachRadius,CLIMBERS_PER_PALM,climbPose,climbSpots,inLagoon,JUMP_MS,jumpLift,movementCredit,shoreActivity,SCOOTER_START,scooterSpot,waterAtCoast,waterEntry} from '../shared/mobility.js';
import { activityId, activitySeat, climbKey, climbSlot } from '../shared/activities.js';
import { ballAt, colors, initialBall } from '../shared/ball.js';
import { acceptsRoomPass, hasInvitation, invitationCookie, invitationPage } from '../shared/invitations.js';

import {memberDetails} from '../shared/members.js';
import {BOAT_START, BOULDER, PADEL, SURF, SURF_BOOST_MS, isBoatSeat, boatSpot, boulderPose, canReturnPadel, courtEntry, courtSide, floatable, newPadelShot, onCourt, otherSide, padelBallAt, stepOffBoat, surfEntry} from '../shared/sports.js';

// Keep retired public identifiers out of guest cards without publishing those identifiers.
const retiredWords=new Set([0xf0085011,0xaeb237ed,0xc1f4b8d1,0xe63cf52a]);
function guestDetails(input){
  const details=memberDetails(input);
  if(!details)return null;
  const words=(details.name+' '+details.note).normalize('NFKC').toLowerCase().match(/[a-z0-9]+/g)||[];
  for(const word of words){
    let hash=2166136261;
    for(const c of word)hash=Math.imul(hash^c.charCodeAt(0),16777619);
    if(retiredWords.has(hash>>>0))return null;
  }
  return details;
}
const handles=residents.map(r=>r.handle);
const seatById=id=>SEATS.find(s=>String(s.id)===String(id));
const limit=64;
const signed=(v)=>Math.round(v*100)/100;
const finite=(...nums)=>nums.every(Number.isFinite);
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const publicPlayer=p=>({id:p.id,memberId:p.guest?.id||null,handle:p.handle,color:p.color,x:p.x,z:p.z,yaw:p.yaw,walking:p.walking,at:p.lastMove,seat:p.seat,waveAt:p.waveAt,jumpAt:p.jumpAt||0,progress:p.progress||0,strokeAt:p.strokeAt||0});
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
    // Only the shared toys survive a visit. Retire the two former player tables on upgrade.
    ctx.storage.transactionSync(()=>{
      this.sql.exec('DROP TABLE IF EXISTS stays');
      this.sql.exec('DROP TABLE IF EXISTS members');
      this.sql.exec('CREATE TABLE IF NOT EXISTS toys (id INTEGER PRIMARY KEY, pose TEXT NOT NULL)');
    });
    this.sockets=new Map();
    this.boat={...BOAT_START};this.boatVacatedAt=0;this.court={shot:null,best:0};this.courtTimer=null;
    for(const ws of ctx.getWebSockets()){
      // Release sockets attached by the previous hibernating room.
      try{ws.serializeAttachment(null);ws.close(1001,'Reconnect to the island');}catch{}
    }
    this.scooter=JSON.parse(this.sql.exec('SELECT pose FROM toys WHERE id=2').toArray()[0]?.pose||JSON.stringify(SCOOTER_START));
    this.ball=JSON.parse(this.sql.exec('SELECT pose FROM toys WHERE id=1').toArray()[0]?.pose||JSON.stringify(initialBall));
  }
  async fetch(request){
    // Older lobbies request a directory. Visitors are visible only inside the live room.
    if(new URL(request.url).pathname==='/api/members')return Response.json({members:[]},{headers:{'Cache-Control':'private, no-store'}});
    if(this.sockets.size>=limit)return new Response('Island is full. Try again shortly.',{status:503});
    const [client,ws]=Object.values(new WebSocketPair());
    ws.accept();
    this.sockets.set(ws,{p:null,lastSeen:Date.now()});
    ws.addEventListener('message',event=>this.onMessage(ws,event.data));
    ws.addEventListener('close',()=>{this.leave(ws);try{ws.close(1000,'Visit ended');}catch{}});
    ws.addEventListener('error',()=>{this.leave(ws);try{ws.close(1011,'Connection ended');}catch{}});
    if(await this.ctx.storage.getAlarm()===null)await this.ctx.storage.setAlarm(Date.now()+30000);
    return new Response(null,{status:101,webSocket:client});
  }
  broadcast(message,except=null){
    const payload=JSON.stringify(message);
    for(const [ws,{p}] of this.sockets)if(p&&ws!==except){try{ws.send(payload);}catch{}}
  }
  state(){
    const players=[],claims={},members=[];
    for(const {p} of this.sockets.values()){
      if(!p)continue;
      players.push(publicPlayer(p));
      if(p.handle)claims[p.handle]=p.id;
      if(p.guest)members.push(p.guest);
    }
    return {players,claims,members,ball:this.ball,scooter:this.scooter,boat:this.boat,court:this.court,serverTime:Date.now()};
  }
  occupied(field,value,except){
    for(const {p} of this.sockets.values())if(p&&p!==except&&p[field]===value)return true;
    return false;
  }
  changed(){this.broadcast({type:'state',...this.state()});}
  playSpot(id,key){
    if(id==='boat')return boatSpot(this.boat);
    if(id==='boulder')return BOULDER;
    if(id==='padel')return PADEL;
    if(id==='surf')return SURF;
    if(id==='climb')return climbSpots.find(s=>s.key===key);
    if(id==='ride')return scooterSpot(this.scooter);
    return PLAY_SPOTS.find(s=>s.id===id);
  }
  parkScooter({x,z,yaw}){
    this.scooter={x,z,yaw};
    this.sql.exec('INSERT OR REPLACE INTO toys (id,pose) VALUES (2,?)',JSON.stringify(this.scooter));
  }
  courtClock(){
    clearTimeout(this.courtTimer);
    const shot=this.court.shot;if(!shot)return;
    const occupied=this.occupied('seat','play:padel:'+shot.target);
    const end=shot.start+shot.duration*(occupied?1.35:1);
    this.courtTimer=setTimeout(()=>{
      if(this.court.shot!==shot)return;
      const now=Date.now(),hasReceiver=this.occupied('seat','play:padel:'+shot.target);
      if(hasReceiver&&now<shot.start+shot.duration*1.35){this.courtClock();return;}
      if(!hasReceiver&&this.occupied('seat','play:padel:'+otherSide(shot.target))){
        const ball=padelBallAt(shot,end);
        this.court.shot=newPadelShot(ball.x,ball.z,shot.target,now,shot.rally,{practice:true});
      }else this.court.shot=null;
      this.courtClock();this.changed();
    },Math.max(1,end-Date.now()));
  }
  releaseSport(p){
    if(courtSide(p.seat)){this.court.shot=null;this.courtClock();}
    if(isBoatSeat(p.seat)){
      const companion=[...this.sockets.values()].find(s=>s.p!==p&&isBoatSeat(s.p?.seat));
      if(!companion)this.boatVacatedAt=Date.now();
      else if(p.seat==='play:boat:helm')companion.p.seat='play:boat:helm';
    }
  }
  moveBoat(p){
    this.boat={x:p.x,z:p.z,yaw:p.yaw};
    for(const {p:other} of this.sockets.values()){
      if(other?.seat==='play:boat:bow')Object.assign(other,this.boat,{walking:p.walking,lastMove:p.lastMove});
    }
  }
  dismount(p,exit){
    const id=activityId(p.seat);
    this.releaseSport(p);
    if(id==='boat'||id==='surf'){
      const landing=id==='boat'?stepOffBoat(this.boat):p;
      const swimming=shoreActivity('swim',landing.x,landing.z)==='swim';
      Object.assign(p,{x:landing.x,z:landing.z,seat:swimming?activitySeat('swim',p.id):null,progress:0,jumpAt:0,walking:false});
      return;
    }
    if(id==='ride'){
      this.parkScooter(p);
      if(exit&&finite(exit.x,exit.z)&&dist(exit,p)<1.1&&inLagoon(exit.x,exit.z)&&!shoreActivity(null,exit.x,exit.z)){
        p.x=signed(exit.x);p.z=signed(exit.z);
      }
    }else if(id==='swim'&&exit&&finite(exit.x,exit.z)&&beachRadius(p.x,p.z)<1.22&&beachRadius(exit.x,exit.z)<1.06&&dist(exit,p)<5.3){
      p.x=signed(exit.x);p.z=signed(exit.z);
    }else{
      const spot=this.playSpot(id,climbKey(p.seat)),seat=seatById(p.seat);
      if(spot)Object.assign(p,spot.land);
      if(seat)Object.assign(p,{x:signed(seat.x-Math.sin(seat.facing)*.7),z:signed(seat.z-Math.cos(seat.facing)*.7),yaw:seat.facing+Math.PI});
    }
    p.seat=null;p.walking=false;p.progress=0;p.jumpAt=0;
  }
  join(ws,session,msg,now){
    const active=[...this.sockets.values()].map(s=>s.p).filter(Boolean);
    const n=active.length,used=new Set(active.map(p=>p.color));
    const color=colors.find(c=>!used.has(c))||colors[n%colors.length];
    const p={id:crypto.randomUUID(),guest:null,handle:null,color,seat:null,walking:false,waveAt:0,lastMove:now,
      x:signed(.08+Math.sin(n*2.39)*Math.min(1.45,.27*n)),z:signed(5.25+Math.cos(n*2.39)*Math.min(.65,.12*n)),yaw:-.48};
    // An open page may reintroduce itself after a network interruption.
    const guest=msg.guest&&guestDetails(msg.guest);
    if(guest&&!matchingResident(guest.name))p.guest={id:p.id,...guest};
    if(handles.includes(msg.handle)&&!this.occupied('handle',msg.handle)){
      Object.assign(p,npcLandPose(handles.indexOf(msg.handle),now),{handle:msg.handle});
    }
    session.p=p;
    send(ws,{type:'welcome',id:p.id,...this.state()});this.changed();
  }
  onMessage(ws,raw){
    if(typeof raw!=='string'||raw.length>1000){ws.close(1009,'Invalid packet');return;}
    let msg;try{msg=JSON.parse(raw);}catch{return;}
    if(!msg||typeof msg!=='object')return;
    const session=this.sockets.get(ws);if(!session)return;
    const now=Date.now();session.lastSeen=now;
    const p=session.p;
    if(!p){if(msg.type==='hello')this.join(ws,session,msg,now);return;}
    const reject=(code,text)=>send(ws,{type:'error',code,text});
    if(msg.type==='ping'){send(ws,{type:'pong',serverTime:now});return;}
    if(msg.type==='move'){
      if(!finite(msg.x,msg.z,msg.yaw))return;
      const id=activityId(p.seat),elapsed=(now-p.lastMove)/1000;
      if(p.seat!==null&&!['swim','ride','climb','boulder','surf','boat','padel'].includes(id)||p.seat==='play:boat:bow')return;
      let pose={x:msg.x,z:msg.z,yaw:msg.yaw},progress=0,nextActivity=id,credit;
      const balance=session.motionSeat===p.seat?session.motionCredit:null;
      if(id==='climb'||id==='boulder'){
        const spot=this.playSpot(id,climbKey(p.seat));
        credit=movementCredit(balance,elapsed,.8,Math.abs(msg.progress-(p.progress||0)));
        if(!spot||!Number.isFinite(msg.progress)||msg.progress<0||msg.progress>1||credit===null){
          send(ws,{type:'correct',player:publicPlayer(p)});return;
        }
        progress=msg.progress;pose=id==='boulder'?boulderPose(progress):climbPose(spot,progress,climbSlot(p.seat));
      }else{
        const speed={ride:8.8,swim:4.8,boat:10,surf:now-(p.strokeAt||0)<SURF_BOOST_MS+350?8.8:6.4,padel:5}[id]||6.1;
        credit=movementCredit(balance,elapsed,speed,dist(msg,p));
        if(!inLagoon(msg.x,msg.z)||credit===null){send(ws,{type:'correct',player:publicPlayer(p)});return;}
        if(id==='padel'&&!onCourt(msg.x,msg.z,courtSide(p.seat))||id==='boat'&&!floatable(msg.x,msg.z)){
          send(ws,{type:'correct',player:publicPlayer(p)});return;
        }
        if(id==='surf')nextActivity=floatable(msg.x,msg.z)?'surf':null;
        else if(id!=='padel'&&id!=='boat')nextActivity=shoreActivity(id,msg.x,msg.z,jumpLift(p.jumpAt,now));
      }
      session.motionCredit=credit;session.motionSeat=p.seat;
      Object.assign(p,{x:signed(pose.x),z:signed(pose.z),yaw:signed(Math.atan2(Math.sin(pose.yaw),Math.cos(pose.yaw))),progress,walking:msg.walking===true,lastMove:now});
      if(nextActivity!==id){
        p.seat=nextActivity==='swim'?activitySeat('swim',p.id):null;p.jumpAt=0;
        if(id==='ride')this.parkScooter(SCOOTER_START);
        this.changed();return;
      }
      if(id==='boat')this.moveBoat(p);
      this.broadcast({type:'move',id:p.id,x:p.x,z:p.z,yaw:p.yaw,progress,walking:p.walking,at:now,...(id==='boat'?{boat:this.boat}:{})},ws);return;
    }
    if(msg.type==='sportAction'){
      const id=activityId(p.seat);
      if(id==='surf'){
        if(now-(p.strokeAt||0)<SURF_BOOST_MS+250)return;
        p.strokeAt=now;
      }else if(id==='padel'){
        const side=courtSide(p.seat),shot=this.court.shot;
        if(!canReturnPadel(shot,side,p.x,p.z,now)){
          reject('padel',shot?.target===side?'Move close and swing as the ball bounces.':'Wait for the return.');return;
        }
        if(now-(p.strokeAt||0)<350)return;
        const ball=shot?padelBallAt(shot,now):p;
        const solo=!this.occupied('seat','play:padel:'+otherSide(side));
        this.court.shot=newPadelShot(ball.x,ball.z,side,now,(shot?.rally||0)+1,{toWall:solo});
        this.court.best=Math.max(this.court.best,this.court.shot.rally);p.strokeAt=now;this.courtClock();
      }else return;
      this.changed();return;
    }
    if(msg.type==='jump'){
      if(p.seat!==null||now-(p.jumpAt||0)<JUMP_MS+70)return;
      p.jumpAt=now;this.broadcast({type:'jump',id:p.id,at:now});return;
    }
    if(msg.type==='saveMember'||msg.type==='removeMember'){
      reject('member','Refresh the island to join as a guest for this visit.');return;
    }
    if(msg.type==='setGuest'||msg.type==='clearGuest'){
      if(msg.type==='setGuest'){
        const details=guestDetails(msg);
        if(!details){reject('member','Choose a different guest name or description.');return;}
        const resident=matchingResident(details.name);
        if(resident){reject('member','Open '+resident.name+' in the resident list, or choose another guest name.');return;}
        p.guest={id:p.id,...details};p.handle=null;
      }else p.guest=null;
      send(ws,{type:'guestResult',guest:p.guest,op:msg.type});
      this.changed();return;
    }
    if(msg.type==='claim'){
      if(!handles.includes(msg.handle))return;
      if(this.occupied('handle',msg.handle,p)){reject('taken','Someone else is already playing this resident.');send(ws,{type:'state',...this.state()});return;}
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
      if(this.occupied('seat',String(seat.id),p)){reject('seat','Someone just sat there. Try another seat.');return;}
      Object.assign(p,{seat:String(seat.id),x:seat.x,z:seat.z,yaw:seat.facing,walking:false});
    }else if(msg.type==='activity'){
      const spot=this.playSpot(msg.id,msg.key);
      // Tabs loaded before depth-based movement still send a separate beach-entry request.
      const coastline=spot?.id==='swim'&&msg.shore===true&&beachRadius(p.x,p.z)>.90;
      const fromWater=activityId(p.seat)==='swim'&&['boat','surf'].includes(spot?.id);
      if(!spot||(p.seat!==null&&!fromWater)||(!coastline&&dist(p,spot.land)>2.8)){reject('activity','Move a little closer to the activity.');return;}
      let key=spot.key;
      if(spot.id==='boat')key=this.occupied('seat','play:boat:helm')?'bow':'helm';
      if(spot.id==='padel')key=this.occupied('seat','play:padel:south')?'north':'south';
      let seat=activitySeat(spot.id,p.id,key);
      // Climbers share a palm from different sides of the trunk.
      for(let slot=1;spot.id==='climb'&&slot<CLIMBERS_PER_PALM&&this.occupied('seat',seat,p);slot++)seat=activitySeat('climb',p.id,key,slot);
      if(this.occupied('seat',seat,p)){
        if(['boulder','boat','padel'].includes(spot.id)){reject('activity',{boulder:'Someone is on the boulder.',boat:'Both canoe seats are taken.',padel:'Two players are already on court.'}[spot.id]);return;}
        reject('activity',spot.id==='ride'?'Someone is riding the motorbike.':spot.id==='climb'?'This palm is full. Try another tree.':'The sunbed is occupied.');return;
      }
      let origin=spot.land;
      if(coastline)origin=waterAtCoast(p.x,p.z);
      else if(spot.id==='swim')origin=waterEntry(p.id);
      else if(spot.id==='climb')origin=climbPose(spot,0,climbSlot(seat));
      else if(spot.id==='boulder')origin=boulderPose(0);
      else if(spot.id==='surf')origin=surfEntry([...this.sockets.values()].map(s=>s.p).filter(Boolean));
      else if(spot.id==='padel')origin=courtEntry(key);
      Object.assign(p,{x:origin.x,z:origin.z,yaw:origin.yaw,seat,progress:0,strokeAt:0,jumpAt:0,walking:false,lastMove:now});
      if(spot.id==='padel')this.courtClock();
      if(spot.id==='boat')this.boatVacatedAt=0;
    }else if(msg.type==='stand'){
      this.dismount(p,msg.exit);p.lastMove=now;
    }else if(msg.type==='wave'){
      if(now-p.waveAt<1100)return;
      p.waveAt=now;this.broadcast({type:'wave',id:p.id,at:now});return;
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
    this.changed();
  }
  leave(ws){
    const session=this.sockets.get(ws);
    if(!session)return;
    this.sockets.delete(ws);
    if(!session.p)return;
    this.releaseSport(session.p);
    if(![...this.sockets.values()].some(s=>s.p)){this.boat={...BOAT_START};this.court.best=0;}
    if(activityId(session.p.seat)==='ride')this.parkScooter(session.p);
    this.changed();
  }
  crewNearby(){
    for(const {p} of this.sockets.values())if(p&&(isBoatSeat(p.seat)||dist(p,this.boat)<6))return true;
    return false;
  }
  async alarm(){
    const now=Date.now();
    for(const [ws,session] of this.sockets){
      if(now-session.lastSeen<(session.p?125000:20000))continue;
      this.leave(ws);try{ws.close(1001,'Reconnect to the island');}catch{}
    }
    if(this.boatVacatedAt&&now-this.boatVacatedAt>45000&&!this.crewNearby()){
      this.boat={...BOAT_START};this.boatVacatedAt=0;this.changed();
    }
    if(this.sockets.size)await this.ctx.storage.setAlarm(now+30000);
  }
}
