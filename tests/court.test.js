import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {once} from 'node:events';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {unstable_dev} from 'wrangler';
import {PADEL,courtEntry,courtSide,onCourt,padelBallAt} from '../shared/sports.js';

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
  return {socket,id:welcome.id,send,receive,packets};
}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

test('four visitors play doubles on the padel court and a fifth is turned away',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'island-court-'));
  const config=join(dir,'wrangler.json');
  const script=fileURLToPath(new URL('../server/worker.js',import.meta.url));
  await writeFile(config,JSON.stringify({name:'court-test',main:script,compatibility_date:'2026-01-15',
    vars:{LOCAL_DEVELOPMENT:'true'},durable_objects:{bindings:[{name:'ISLAND',class_name:'Courtyard'}]},migrations:[{tag:'v1',new_sqlite_classes:['Courtyard']}]}));
  const worker=await unstable_dev(script,{config,persistTo:join(dir,'state'),ip:'127.0.0.1',port:0,inspectorPort:0,local:true,
    vars:{LOCAL_DEVELOPMENT:'true'},logLevel:'error',experimental:{disableExperimentalWarning:true,disableDevRegistry:true,watch:false}});
  const visitors=[];
  t.after(async()=>{for(const v of visitors)v.socket.close();await worker.stop();await rm(dir,{recursive:true,force:true});});
  for(let i=0;i<5;i++)visitors.push(await player(worker.port));
  // Walk from the arrival lawn to the court gate in strides the room accepts.
  for(const [x,z] of [[5,4],[10,2.5],[PADEL.land.x,PADEL.land.z]]){
    await pause(1100);
    for(const v of visitors)v.send('move',{x,z,yaw:1.4,walking:true});
  }
  await pause(200);
  const seats=[];
  for(const v of visitors.slice(0,4)){
    v.send('activity',{id:'padel'});
    const state=await v.receive(m=>m.type==='state'&&m.players.find(p=>p.id===v.id)?.seat?.startsWith('play:padel'));
    const me=state.players.find(p=>p.id===v.id);
    seats.push(me.seat);
    assert.ok(onCourt(me.x,me.z,courtSide(me.seat)),'each player starts on their own half');
  }
  assert.deepEqual(seats,['play:padel:south','play:padel:north','play:padel:south:1','play:padel:north:1']);
  const partner=courtEntry('south',1);
  assert.ok(Math.abs(partner.x-PADEL.x)>.5,'partners start side by side');
  const late=visitors[4];
  late.send('activity',{id:'padel'});
  const refusal=await late.receive(m=>m.type==='error');
  assert.match(refusal.text,/Four players/);

  // South serves. Either northern player can take the return.
  visitors[0].send('sportAction');
  const served=await visitors[3].receive(m=>m.type==='state'&&m.court?.shot);
  const shot=served.court.shot;
  assert.equal(shot.target,'north');
  await pause(Math.max(0,shot.start+shot.duration*.86-Date.now()));
  const ball=padelBallAt(shot,Date.now());
  visitors[3].send('move',{x:ball.x+.4,z:ball.z-.2,yaw:0,walking:true});
  await pause(60);
  visitors[3].send('sportAction');
  const returned=await visitors[0].receive(m=>m.type==='state'&&m.court?.shot?.rally===2);
  assert.equal(returned.court.shot.target,'south');
});
