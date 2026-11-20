import assert from 'node:assert/strict';
import {mkdtemp,readdir,rm,writeFile} from 'node:fs/promises';
import {once} from 'node:events';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {unstable_dev} from 'wrangler';
import {defaultAppearance} from '../shared/members.js';
import {SCOOTER_START} from '../shared/mobility.js';

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
  assert.ok(!Object.hasOwn(welcome,'ticket'));
  return {socket,id:welcome.id,send,receive};
}

test('visitors exist only on live sockets; upgrading removes both former guest tables',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'island-visits-'));
  const config=join(dir,'wrangler.json');
  const script=fileURLToPath(new URL('../server/worker.js',import.meta.url));
  const persistTo=join(dir,'state');
  await writeFile(config,JSON.stringify({name:'visit-test',main:script,compatibility_date:'2026-01-15',
    vars:{LOCAL_DEVELOPMENT:'true'},durable_objects:{bindings:[{name:'ISLAND',class_name:'Courtyard'}]},migrations:[{tag:'v1',new_sqlite_classes:['Courtyard']}]}));
  const start=()=>unstable_dev(script,{config,persistTo,ip:'127.0.0.1',port:0,inspectorPort:0,local:true,
    vars:{LOCAL_DEVELOPMENT:'true'},logLevel:'error',experimental:{disableExperimentalWarning:true,disableDevRegistry:true,watch:false}});
  let worker;const sockets=[];
  t.after(async()=>{for(const socket of sockets)socket.close();if(worker)await worker.stop();await rm(dir,{recursive:true,force:true});});
  worker=await start();
  const lobby=async()=>{
    const response=await fetch('http://127.0.0.1:'+worker.port+'/api/members');
    assert.equal(response.status,200);assert.deepEqual(await response.json(),{members:[]});
  };
  await lobby();
  await worker.stop();worker=null;
  const files=await readdir(persistTo,{recursive:true});
  const item=files.find(name=>name.includes('Courtyard')&&name.endsWith('.sqlite')&&!name.endsWith('metadata.sqlite'));
  assert.ok(item,'the test room uses its own SQLite database');
  const dbPath=join(persistTo,item),before=new DatabaseSync(dbPath);
  const parking={...SCOOTER_START,x:2.43};
  before.exec("CREATE TABLE members(name TEXT); INSERT INTO members VALUES ('Past guest'); CREATE TABLE stays(ticket TEXT); INSERT INTO stays VALUES ('old visit')");
  before.prepare('INSERT OR REPLACE INTO toys (id,pose) VALUES (2,?)').run(JSON.stringify(parking));before.close();
  worker=await start();
  const observer=await player(worker.port);sockets.push(observer.socket);
  const guest=await player(worker.port);sockets.push(guest.socket);
  guest.send('setGuest',{name:'Reef visitor',note:'A drawing',appearance:defaultAppearance});
  const visible=await observer.receive(m=>m.members?.some(g=>g.name==='Reef visitor'));
  assert.deepEqual(visible.scooter,parking);
  assert.equal(visible.members.find(g=>g.name==='Reef visitor').id,guest.id);
  await lobby();
  const verifyTables=()=>{
    const db=new DatabaseSync(dbPath,{readOnly:true});
    try{assert.deepEqual(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('members','stays','toys') ORDER BY name").all().map(r=>r.name),['toys']);}
    finally{db.close();}
  };
  verifyTables();
  guest.send('claim',{handle:'powpow'});
  await observer.receive(m=>m.claims?.powpow===guest.id);
  guest.socket.close();
  await observer.receive(m=>m.type==='state'&&!m.players.some(p=>p.id===guest.id)&&!m.claims.powpow&&!m.members.some(g=>g.id===guest.id)&&m.serverTime>=visible.serverTime);
  observer.send('claim',{handle:'powpow'});
  await observer.receive(m=>m.claims?.powpow===observer.id);
  await lobby();verifyTables();
});
