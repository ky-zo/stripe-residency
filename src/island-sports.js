import {createWaterGear} from './water-gear.js';
import {createSportScenery} from './sport-scenery.js';
import {PADEL,SURF,padelBallAt} from '../shared/sports.js';
import {SWIM_LEVEL} from '../shared/mobility.js';

export function addIslandSports(T,scene){
  const scenery=createSportScenery(T),gear=createWaterGear(T);
  scene.add(scenery.root,gear.boat);
  const parked=gear.createBoard();parked.position.set(SURF.x,.14,SURF.z);parked.rotation.set(.11,-.58,-.08);scene.add(parked);
  const active=new Map();let frame=0;
  function equip(id,figure,mode,pose,boost=0){
    if(mode!=='surf'&&mode!=='padel')return;
    let item=active.get(id);
    if(item?.mode!==mode||item.figure!==figure){
      item?.mesh.removeFromParent();
      const mesh=mode==='surf'?gear.createBoard():scenery.createRacket();
      if(mode==='surf')scene.add(mesh);else figure.rightHand.add(mesh);
      item={mode,figure,mesh,swell:mesh.getObjectByName('Swell')};active.set(id,item);
    }
    item.frame=frame;
    if(mode==='surf'){
      item.mesh.position.set(pose.x,pose.y-.08,pose.z);
      item.mesh.rotation.set(pose.pitch||0,pose.yaw,pose.roll||0,'YXZ');
      if(item.swell){item.swell.visible=true;item.swell.scale.setScalar(1+boost*.32);}
    }
  }
  function finish(boat,court,time){
    for(const [id,item] of active)if(item.frame!==frame){item.mesh.removeFromParent();active.delete(id);}
    const wave=time/1000*1.65+boat.x*.26+boat.z*.18;
    gear.boat.position.set(boat.x,SWIM_LEVEL+.045*Math.sin(wave),boat.z);
    gear.boat.rotation.set(.022*Math.cos(wave),boat.yaw,.032*Math.sin(wave*.8),'YXZ');
    const ball=padelBallAt(court?.shot,time);
    scenery.ball.position.set(ball.x,ball.y,ball.z);
  }
  return {begin(){frame++;},equip,finish};
}

// Only permanent barriers enter the walking grid. Players enter the padel court through its west gates.
export const sportObstacles=[
  {x:12.05,z:-4.66,w:2.28,d:1.70},
  {x:PADEL.x+2.30,z:PADEL.z,w:.12,d:7.2},
  ...[-1,1].flatMap(side=>[
    {x:PADEL.x,z:PADEL.z+3.60*side,w:4.60,d:.12},
    {x:PADEL.x-2.30,z:PADEL.z+2.37*side,w:.12,d:2.46}
  ]),
  {x:PADEL.x,z:PADEL.z,w:4.6,d:.09},
];
