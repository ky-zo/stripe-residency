import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

// Positions are local to the ground point under the saddle. The front wheel faces +Z.
export const SCOOTER_RIG = {
  width: .82, length: 1.68, height: 1.11, front: .97, rear: .71,
  rider: { x: 0, y: .065, z: 0 },
  saddle: { x: 0, y: .705, z: 0 },
  grips: [{ x: -.29, y: .99, z: .40 }, { x: .29, y: .99, z: .40 }],
  floorboards: [{ x: -.15, y: .315, z: .23 }, { x: .15, y: .315, z: .23 }]
};

let sharedModel;
function loadScooter() {
  if (!sharedModel) {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    sharedModel = loader.loadAsync('/models/quackparty-scooter.glb').then(gltf => {
      gltf.scene.traverse(part => {
        if (part.isMesh) {
          part.castShadow = true;
          part.receiveShadow = true;
        }
      });
      return gltf.scene;
    }).catch(error => {
      sharedModel = undefined;
      throw error;
    });
  }
  return sharedModel;
}

// dt is seconds, speed is signed world units per second, and +1 steers right.
// Place the figure at SCOOTER_RIG.rider inside riderFrame to bank with the scooter.
export function createScooter(T) {
  const root = new T.Group();
  root.name = 'QuackParty Bali scooter';
  const riderFrame = new T.Group();
  root.add(riderFrame);
  let chassis, frontWheel, rearWheel;
  let steering = 0, wheelAngle = 0;
  function pose() {
    if (!chassis) return;
    chassis.morphTargetInfluences[0] = steering;
    // The original fork is raked, so steering also carries the axle slightly sideways.
    frontWheel.position.x = .017 * steering;
    frontWheel.rotation.set(wheelAngle, steering * .225, 0, 'YXZ');
    rearWheel.rotation.x = wheelAngle;
  }
  const ready = loadScooter().then(template => {
    const model = template.clone(true);
    chassis = model.getObjectByName('Chassis');
    frontWheel = model.getObjectByName('FrontWheel');
    rearWheel = model.getObjectByName('RearWheel');
    riderFrame.add(model);
    pose();
    return root;
  });
  function animate(dt = 0, speed = 0, steer = 0) {
    const elapsed = T.MathUtils.clamp(dt, 0, .16);
    const smooth = 1 - Math.exp(-elapsed * 12);
    steering += (T.MathUtils.clamp(steer, -1, 1) - steering) * smooth;
    const bank = -steering * Math.min(1, Math.abs(speed) / 3.2) * .135;
    riderFrame.rotation.z += (bank - riderFrame.rotation.z) * smooth;
    wheelAngle = (wheelAngle + speed * elapsed / .211) % (Math.PI * 2);
    pose();
  }
  return { root, riderFrame, animate, ready };
}
