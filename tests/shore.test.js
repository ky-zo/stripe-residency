import assert from 'node:assert/strict';
import test from 'node:test';
import {BEACH_PROFILE, groundHeight, shoreActivity, shoreline, SWIM_LEVEL} from '../shared/mobility.js';
import {createNavigation} from '../src/navigation.js';

function beachPoint(angle,radius){
  const scale=shoreline(angle)*radius;
  return [11.7*Math.cos(angle)*scale,8.15*Math.sin(angle)*scale];
}

test('the walkable beach follows the sand mesh around the entire island',()=>{
  const nav=createNavigation([],[]);
  for(let i=0;i<96;i++){
    const angle=i*Math.PI/48;
    for(const [radius,height] of BEACH_PROFILE){
      const point=beachPoint(angle,radius);
      assert.ok(Math.abs(groundHeight(...point)-height)<1e-8);
      if(height>SWIM_LEVEL-.30)assert.ok(nav.canStand(...point));
    }
  }
});

test('walkers wade to their knees, swimmers stand in shallower water, and wheels splash first',()=>{
  for(const angle of [0,.8,1.6,2.9,-1.315,-2.4]){
    const onSand=beachPoint(angle,1.08),ankles=beachPoint(angle,1.11);
    const shins=beachPoint(angle,1.165),knees=beachPoint(angle,1.2);
    assert.equal(shoreActivity(null,...onSand),null);
    assert.equal(shoreActivity(null,...shins),null);
    assert.equal(shoreActivity(null,...knees),'swim');
    assert.equal(shoreActivity(null,...knees,.45),null);
    assert.equal(shoreActivity('swim',...shins),'swim');
    assert.equal(shoreActivity('swim',...ankles),null);
    assert.equal(shoreActivity('ride',...ankles),'ride');
    assert.equal(shoreActivity('ride',...shins),'swim');
  }
});
