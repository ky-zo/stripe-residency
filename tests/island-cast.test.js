import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {residents} from '../src/residents.js';
import {createIslandDogs} from '../src/island-dogs.js';
import {createDogRun} from '../src/dog-runs.js';

test('PowPow is one playable resident with a link-free character card',()=>{
  const matches=residents.filter(r=>r.name==='PowPow');
  assert.equal(matches.length,1);
  const [profile]=matches;
  assert.equal(profile.shortName,'PowPow');assert.equal(profile.handle,'powpow');
  assert.ok(!profile.profile&&!profile.source&&!profile.sources&&!profile.bio);
});

test('both small island dogs run the same dry paths for every visitor',()=>{
  const dogs=createIslandDogs(T);
  assert.deepEqual(dogs.map(d=>d.name),['PowPow2','Poopi']);
  for(const dog of dogs){
    const initial=new T.Box3().setFromObject(dog.root);
    assert.ok(initial.max.y>.35&&initial.max.y<.90);
    let moving=false,paused=false;
    const other={name:dog.name,root:new T.Group(),animate(_seconds,run){if(run)moving=true;else paused=true;}};
    const update=createDogRun(T,dog),replay=createDogRun(T,other),bounds=new T.Box3();
    for(let ms=0;ms<60000;ms+=310){
      const time=1700000000000+ms;update(time);replay(time);
      assert.ok(dog.root.position.distanceTo(other.root.position)<.00001);
      assert.ok(dog.root.position.y>-.02);bounds.expandByPoint(dog.root.position);
    }
    assert.ok(moving&&paused);assert.ok(bounds.getSize(new T.Vector3()).length()>2);
  }
});
