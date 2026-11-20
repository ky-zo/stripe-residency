import assert from 'node:assert/strict';
import test from 'node:test';
import {residentRoads} from '../scripts/bake-npc-routes.mjs';
import {npcLandPose,npcPadelShot,npcPose,outings,SWIMMER_INDEX} from '../src/island-life.js';
import {NPC_CYCLE} from '../src/npc-outings.js';
import {NPC_ROUTES} from '../src/npc-routes.js';
import {groundHeight,SWIM_LEVEL} from '../shared/mobility.js';
import {PADEL,padelBallAt} from '../shared/sports.js';

const start=1700000100000-1700000100000%(NPC_CYCLE*1000);

test('baked routes match the timetable and keep to walkable sand',()=>{
  const roads=residentRoads();
  for(const {key,from,to} of outings.requests){
    const route=NPC_ROUTES[key];
    assert.ok(route,'run node scripts/bake-npc-routes.mjs: no route for '+key);
    const [first,last]=[route[0],route.at(-1)];
    assert.ok(Math.hypot(first[0]-from.x,first[1]-from.z)<.02&&Math.hypot(last[0]-to.x,last[1]-to.z)<.02,'stale route '+key);
    for(let i=1;i<route.length;i++)for(let k=0;k<=20;k++){
      const x=route[i-1][0]+(route[i][0]-route[i-1][0])*k/20,z=route[i-1][1]+(route[i][1]-route[i-1][1])*k/20;
      if(i>1&&i<route.length-1)assert.ok(roads.canStand(x,z),key+' crosses furniture at '+x.toFixed(2)+','+z.toFixed(2));
      assert.ok(groundHeight(x,z)>SWIM_LEVEL,key+' walks into the sea');
    }
  }
});

test('every resident heads out for something each cycle and comes home without jumping',()=>{
  for(let i=0;i<21;i++){
    if(i===SWIMMER_INDEX)continue;
    assert.ok(outings.timeline(i,start/1000/NPC_CYCLE).length>0,'resident '+i+' has nothing to do');
    let prior=null;const seen=new Set();
    for(let ms=start;ms<start+2*NPC_CYCLE*1000;ms+=100){
      const pose=npcPose(i,ms);
      assert.ok([pose.x,pose.z,pose.y,pose.yaw].every(Number.isFinite));
      seen.add(pose.activity);
      // Walkers stay under two units a second. Surfers ride faster, still slower than a player's board.
      if(prior)assert.ok(Math.hypot(pose.x-prior.x,pose.z-prior.z)<(pose.activity==='surf'?.55:.25),'resident '+i+' jumps at '+(ms-start)/1000+'s');
      const land=npcLandPose(i,ms);
      assert.ok(groundHeight(land.x,land.z)>SWIM_LEVEL+.1,'resident '+i+' would be claimed into the sea');
      prior=pose;
    }
    assert.ok(seen.size>2,'resident '+i+' only ever '+[...seen].join(', '));
  }
});

test('two residents rally on the court, and each hit comes off a racket',()=>{
  let rallying=0;
  for(let ms=start;ms<start+NPC_CYCLE*1000;ms+=250){
    const shot=npcPadelShot(ms);
    if(!shot)continue;
    rallying++;
    if(Math.abs(ms-shot.start)>130)continue;
    const hitter=[...Array(21).keys()].map(i=>npcPose(i,shot.start)).find(p=>p.activity==='padel'&&Math.sign(p.z-PADEL.z)===Math.sign(shot.z-PADEL.z));
    assert.ok(hitter,'nobody is there to hit the shot');
    const ball=padelBallAt(shot,shot.start);
    assert.ok(Math.hypot(hitter.x-ball.x,hitter.z-ball.z)<.8);
  }
  assert.ok(rallying>NPC_CYCLE*4*.5,'the court is busy most of the cycle');
});

test('residents make way when players take the court, the boulder or a palm',()=>{
  const free=[],busy=[];
  for(let ms=start;ms<start+NPC_CYCLE*1000;ms+=500)for(let i=0;i<21;i++){
    const pose=npcPose(i,ms);
    if(['padel','boulder','climb'].includes(pose.activity))free.push([i,ms,pose.activity]);
  }
  assert.ok(free.length);
  const taken={padel:true,boulder:true,palms:{west:new Set([0,1,2]),north:new Set([0,1,2]),east:new Set([0,1,2])},seats:new Set([8,9])};
  for(const [i,ms] of free){
    const pose=npcPose(i,ms,taken);
    assert.ok(!['padel','boulder','climb'].includes(pose.activity));
    if(Math.abs(pose.x-PADEL.x)<2.3)assert.ok(Math.abs(pose.z-PADEL.z)>3.6,'still on court');
  }
  assert.equal(npcPadelShot(start+30000)!==null,true);
});
