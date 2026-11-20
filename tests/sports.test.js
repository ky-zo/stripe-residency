import assert from 'node:assert/strict';
import test from 'node:test';
import {BOAT_START,BOULDER,PADEL,SURF,boulderPose,canReturnPadel,courtEntry,floatable,newPadelShot,onCourt,padelBallAt,stepOffBoat,surfEntry} from '../shared/sports.js';
import {OCEAN_RADIUS,canSwim,groundHeight,nearbyBeach,shoreActivity} from '../shared/mobility.js';
import {createNavigation} from '../src/navigation.js';

test('offshore travel surrounds the expanded beach and boats can route around the island',()=>{
  for(let i=0;i<24;i++){
    const a=i*Math.PI/12,x=Math.cos(a)*(OCEAN_RADIUS-1),z=Math.sin(a)*(OCEAN_RADIUS-1);
    assert.ok(canSwim(x,z));assert.ok(!canSwim(x*1.1,z*1.1));
    const beach=nearbyBeach(x,z);assert.equal(shoreActivity('swim',beach.x,beach.z),null);
  }
  const routes=createNavigation([],[],{step:.75,width:81,height:51,passable:floatable});
  for(const [from,to] of [[BOAT_START,{x:69,z:12}],[{x:0,z:78},{x:0,z:-82}],[{x:80,z:25},{x:-73,z:-22}]]){
    const route=routes.path(from,to);assert.deepEqual(route.at(-1),to);
    let prior=from;
    for(const point of route){
      for(let i=0;i<=200;i++)assert.ok(floatable(prior.x+(point.x-prior.x)*i/200,prior.z+(point.z-prior.z)*i/200));
      prior=point;
    }
    const exit=stepOffBoat({...to,yaw:.67});assert.ok(canSwim(exit.x,exit.z));
  }
});

test('both sports fit on dry land and the bouldering route reaches its summit',()=>{
  for(const x of [14.7,19.3])for(const z of [-2.6,4.6])assert.equal(groundHeight(x,z),0);
  assert.equal(groundHeight(BOULDER.land.x,BOULDER.land.z),0);assert.equal(groundHeight(SURF.land.x,SURF.land.z),0);assert.ok(canSwim(SURF.water.x,SURF.water.z));
  const surfers=[];
  for(let i=0;i<12;i++){
    const spot=surfEntry(surfers);
    assert.ok(canSwim(spot.x,spot.z));assert.ok(surfers.every(other=>Math.hypot(other.x-spot.x,other.z-spot.z)>1));
    surfers.push(spot);
  }
  let prior=boulderPose(0);
  for(let i=1;i<=100;i++){const next=boulderPose(i/100);assert.ok(next.y>=prior.y&&Math.hypot(next.x-prior.x,next.z-prior.z)<.04);prior=next;}
  assert.ok(prior.y>2.2);
});

test('a padel serve clears the net, bounces, and can be returned only on the receiving half',()=>{
  const serve=courtEntry('south'),receiver=courtEntry('north'),start=10000;
  assert.ok(onCourt(serve.x,serve.z,'south'));assert.ok(!onCourt(serve.x,serve.z,'north'));
  const shot=newPadelShot(serve.x,serve.z,'south',start);
  const mid=padelBallAt(shot,start+shot.duration*.5);
  assert.ok(Math.abs(mid.z-PADEL.z)<.05&&mid.y>.66);
  assert.ok(padelBallAt(shot,start+shot.duration*.76).y<=.12);
  assert.ok(!canReturnPadel(shot,'north',receiver.x,receiver.z,start+400));
  const contact=start+shot.duration*.91;
  assert.ok(canReturnPadel(shot,'north',receiver.x,receiver.z,contact));
  assert.ok(!canReturnPadel(shot,'south',serve.x,serve.z,contact));
  assert.ok(!canReturnPadel(shot,'north',receiver.x+4,receiver.z,contact));
  const practice=newPadelShot(serve.x,serve.z,'south',start,1,{toWall:true});
  assert.equal(practice.toZ,PADEL.z-3.48);
});
