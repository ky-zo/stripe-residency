import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {once} from 'node:events';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {unstable_dev} from 'wrangler';
import {DOG_NAMES,dogPose,dogReturn,loopPose} from '../shared/dogs.js';
import {groundHeight,shoreActivity} from '../shared/mobility.js';
import {BOULDER,LEAP_REACH,SUMMIT,boulderPose,clearOfBoulder,leapFrom,leapPose,onSummit,summitFloor} from '../shared/sports.js';
import {createNavigation} from '../src/navigation.js';
import {sportObstacles} from '../src/island-sports.js';

test('a set-down dog settles, then trots back to meet its loop without a jump',()=>{
  for(const name of DOG_NAMES){
    const at=1795000000000,drop={x:3.1,z:-.4,yaw:1.2,at};
    const back=dogReturn(name,drop),meet=loopPose(name,back.arrive);
    assert.ok(Math.hypot(back.x-meet.x,back.z-meet.z)<1e-6,'the trot ends where the loop is on arrival');
    const pace=Math.hypot(back.x-drop.x,back.z-drop.z)/((back.arrive-back.start)/1000);
    assert.ok(pace>1.9&&pace<2.3);
    const state={holder:null,drop};
    assert.deepEqual([dogPose(name,state,at+500).x,dogPose(name,state,at+500).z],[drop.x,drop.z]);
    for(const t of [back.arrive-1,back.arrive+1]){
      const p=dogPose(name,state,t),q=loopPose(name,t);
      assert.ok(Math.hypot(p.x-q.x,p.z-q.z)<.01);
    }
    assert.deepEqual(dogPose(name,{holder:'someone',drop:null},at),loopPose(name,at));
  }
});

test('the summit sits on the rock, and every leap from its rim lands on open sand',()=>{
  const top=boulderPose(1);
  assert.ok(onSummit(top.x,top.z),'the climbing route ends on the summit');
  assert.ok(Math.abs(summitFloor(top.x,top.z)-top.y)<.02);
  const nav=createNavigation(sportObstacles,[]);
  const canLand=(x,z)=>nav.canStand(x,z)&&!shoreActivity(null,x,z);
  for(let i=0;i<24;i++){
    const a=i*Math.PI/12,from={x:SUMMIT.x+Math.sin(a)*SUMMIT.rx*.95,z:SUMMIT.z+Math.cos(a)*SUMMIT.rz*.95};
    const land=leapFrom(from,a,canLand);
    assert.ok(land,'there is somewhere to land from every side');
    assert.ok(clearOfBoulder(land.x,land.z)&&Math.hypot(land.x-from.x,land.z-from.z)<=LEAP_REACH);
    assert.ok(groundHeight(land.x,land.z)>-.3);
  }
  const arc=leapPose({x:0,y:2.28,z:0},{x:2,y:0,z:0},.5);
  assert.ok(arc.y>1.1&&arc.x===1);
  assert.ok(clearOfBoulder(BOULDER.land.x,BOULDER.land.z));
});

async function player(port){
  const socket=new WebSocket('ws://127.0.0.1:'+port+'/live');
  const packets=[];
  socket.addEventListener('message',event=>packets.push(JSON.parse(event.data)));
  await once(socket,'open',{signal:AbortSignal.timeout(8000)});
  async function receive(match){
    const signal=AbortSignal.timeout(8000);
    while(!packets.some(match))await once(socket,'message',{signal});
    return packets.splice(packets.findIndex(match),1)[0];
  }
  const send=(type,fields={})=>socket.send(JSON.stringify({type,...fields}));
  send('hello');
  const welcome=await receive(m=>m.type==='welcome');
  return {socket,id:welcome.id,welcome,send,receive,clear:()=>packets.splice(0)};
}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

test('visitors carry the dogs one at a time, and climbers can stand, sit, hop and leap on the boulder',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'island-play-'));
  const config=join(dir,'wrangler.json');
  const script=fileURLToPath(new URL('../server/worker.js',import.meta.url));
  await writeFile(config,JSON.stringify({name:'play-test',main:script,compatibility_date:'2026-01-15',
    vars:{LOCAL_DEVELOPMENT:'true'},durable_objects:{bindings:[{name:'ISLAND',class_name:'Courtyard'}]},migrations:[{tag:'v1',new_sqlite_classes:['Courtyard']}]}));
  const worker=await unstable_dev(script,{config,persistTo:join(dir,'state'),ip:'127.0.0.1',port:0,inspectorPort:0,local:true,
    vars:{LOCAL_DEVELOPMENT:'true'},logLevel:'error',experimental:{disableExperimentalWarning:true,disableDevRegistry:true,watch:false}});
  const sockets=[];
  t.after(async()=>{for(const socket of sockets)socket.close();await worker.stop();await rm(dir,{recursive:true,force:true});});
  const a=await player(worker.port);sockets.push(a.socket);
  const b=await player(worker.port);sockets.push(b.socket);
  const me=state=>state.players.find(p=>p.id===a.id);

  // PowPow2's loop runs beside the arrival spot.
  assert.deepEqual(a.welcome.dogs.PowPow2,{holder:null,drop:null});
  a.send('dog',{name:'PowPow2',hold:true});
  let seen=await b.receive(m=>m.type==='state'&&m.dogs?.PowPow2?.holder===a.id);
  b.send('dog',{name:'PowPow2',hold:true});
  assert.match((await b.receive(m=>m.type==='error'&&m.code==='dog')).text,/carrying PowPow2/);
  a.send('dog',{name:'__proto__',hold:true});
  const spot={x:me(seen).x+.4,z:me(seen).z};
  a.send('dog',{name:'PowPow2',hold:false,spot});
  seen=await b.receive(m=>m.type==='state'&&m.dogs?.PowPow2?.drop);
  assert.equal(seen.dogs.PowPow2.holder,null);
  assert.deepEqual([seen.dogs.PowPow2.drop.x,seen.dogs.PowPow2.drop.z],[Math.round(spot.x*100)/100,Math.round(spot.z*100)/100]);

  // Sitting down sets a carried dog at the holder's feet.
  a.send('dog',{name:'PowPow2',hold:true});
  await b.receive(m=>m.type==='state'&&m.dogs?.PowPow2?.holder===a.id);

  // Walk to the boulder in steps the room accepts, then climb it.
  let at={x:me(seen).x,z:me(seen).z};
  const goal=BOULDER.land;
  while(Math.hypot(goal.x-at.x,goal.z-at.z)>.05){
    const d=Math.hypot(goal.x-at.x,goal.z-at.z),step=Math.min(d,.5);
    at={x:at.x+(goal.x-at.x)/d*step,z:at.z+(goal.z-at.z)/d*step};
    a.send('move',{x:at.x,z:at.z,yaw:0,walking:true});await pause(95);
  }
  a.send('activity',{id:'boulder'});
  seen=await b.receive(m=>m.type==='state'&&me(m)?.seat==='play:boulder');
  assert.equal(seen.dogs.PowPow2.holder,null,'the climber set the dog down first');
  a.send('summit');
  assert.match((await a.receive(m=>m.type==='error')).text,/top of the boulder/);
  for(let progress=.1;progress<1.05;progress+=.1){
    a.send('move',{x:0,z:0,yaw:0,walking:true,progress:Math.min(1,progress)});await pause(140);
  }
  a.send('summit');
  seen=await b.receive(m=>m.type==='state'&&me(m)?.seat==='play:summit:'+a.id);
  const top=me(seen);assert.ok(onSummit(top.x,top.z));

  // Walk across the top; stepping off the rim is corrected.
  a.send('move',{x:SUMMIT.x,z:SUMMIT.z-.1,yaw:Math.PI,walking:true});
  await b.receive(m=>m.type==='move'&&m.id===a.id&&Math.abs(m.z-(SUMMIT.z-.1))<.02);
  a.send('move',{x:SUMMIT.x+1.5,z:SUMMIT.z,yaw:0,walking:true});
  await a.receive(m=>m.type==='correct');
  a.send('jump');
  await b.receive(m=>m.type==='jump'&&m.id===a.id);
  a.send('rest',{on:true});
  seen=await b.receive(m=>m.type==='state'&&me(m)?.rest===true);
  await pause(800);
  a.send('jump');
  a.send('rest',{on:false});
  seen=await b.receive(m=>m.type==='state'&&me(m)?.rest===false);
  assert.ok(!b.clear().some(m=>m.type==='jump'),'no hop while sitting');

  // Leaping off lands outside the rock, and everyone sees where from.
  const exit={x:SUMMIT.x,z:SUMMIT.z+1.95};
  a.send('stand',{exit});
  seen=await b.receive(m=>m.type==='state'&&me(m)?.seat===null);
  const landed=me(seen);
  assert.deepEqual([landed.x,landed.z],[Math.round(exit.x*100)/100,Math.round(exit.z*100)/100]);
  assert.ok(landed.from&&Math.abs(landed.from.y-summitFloor(SUMMIT.x,SUMMIT.z-.1))<.02&&landed.jumpAt>0);
  assert.equal(landed.rest,false);
});
