const TAU = Math.PI * 2;
const clamp = (n, low = 0, high = 1) => Math.min(high, Math.max(low, n));
function smooth(t) {
  const unit = clamp(t);
  return unit * unit * (3 - 2 * unit);
}
const turn = (from, to, t) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * t;

export const WORK_DESKS = [
  { x: 3.15, z: -3.65, label: 'Garden table', mint: true },
  { x: 6.80, z: -1.4, label: 'Seaside table', mint: false },
];

export const WORK_MATS = [
  { x: -6.95, z: 2.61, facing: -.60, label: 'Frangipani mat', colour: '#bd7a57' },
  { x: 7.05, z: 2.52, facing: .57, label: 'Palm mat', colour: '#669183' },
];

export function onMat(mat, across, forward) {
  const s = Math.sin(mat.facing), c = Math.cos(mat.facing);
  return { x: mat.x + c * across + s * forward, z: mat.z - s * across + c * forward };
}

export const SEATS = [
  ...WORK_DESKS.map(({x,z,label}, id) => ({ id, x, z: z + 1.05, facing: Math.PI, label })),
  ...WORK_DESKS.map(({x,z,label}, i) => ({ id: i + 2, x: x - .75, z: z - .90, facing: 0, label: label + ', back stool' })),
  ...WORK_MATS.flatMap((mat, i) => [-.68,.68].map((across, j) => ({
    id: 4 + i * 2 + j, ...onMat(mat, across, -.25), facing: mat.facing, label: mat.label + (j ? ', right cushion' : ', left cushion'),
  }))),
];

export const SWIMMER_INDEX = 4;
export const WATER_Y = -.64;
export const SWIM_LANDING = {x:2.05,z:-5.85,yaw:Math.PI};

const sunDeck = {x:-3.92,z:4.12,facing:1.16};
export const SUNBEDS = [-.99,0,.99].map((across,i)=>({
  ...onMat(sunDeck,across,0),facing:sunDeck.facing,
  upright:i===1,colour:['#cb795a','#719789','#778fa8'][i],
}));
export const STUDIO_STOOL = {x:7.55,y:.235,z:-2.29,facing:0};
export const STRETCH_MAT = {x:5.12,z:3.88,facing:-.55};

const loungeLand=(bed)=>({...onMat(bed,0,1.50),yaw:bed.facing+Math.PI});
export const PLAY_SPOTS = [
  {id:'lounge',label:'Sunbed',x:SUNBEDS[2].x,z:SUNBEDS[2].z,hitY:.48,land:loungeLand(SUNBEDS[2])},
  {id:'swim',label:'Swimming cove',x:3.72,z:-6.16,hitY:.8,land:{x:2.88,z:-5.63,yaw:Math.PI}},
];
const stations = new Map([
  [6,{...STUDIO_STOOL,activity:'work',land:{x:8.18,z:-2.82,yaw:-.83}}],
  [15,{...SUNBEDS[0],activity:'lounge',land:loungeLand(SUNBEDS[0])}],
  [19,{...SUNBEDS[1],activity:'read',land:loungeLand(SUNBEDS[1])}],
]);

// Cast order matches the resident directory. Each row follows one curved walk from
// home, through a control point, to a conversation with the other two in its group.
const walks = [
  // group, home x/z and gaze, control x/z, meeting x/z, optional warung stool
  [0,-6.42,-1.57, Math.PI, -6.67,-.60, -6.45,.22, true],
  [0,-3.79,-1.55, Math.PI, -4.02,-.38, -5.15,.65, true],
  [0,-8.27,.40, -.63, -8.03,.03, -7.14,.95],
  [2,4.60,-1.09, .68, 4.79,-1.98, 4.94,-2.89],
  [1,-1.75,-4.76, 2.57, -1.65,-3.44, -1.34,-2.20],
  [1,.44,-5.52, -.76, .47,-4.02, .33,-2.86],
  [2,6.53,-4.53, -2.45, 5.95,-4.10, 5.91,-3.63],
  [2,8.80,-1.87, .45, 8.47,-3.25, 7.03,-3.49],
  [4,4.47,.07, .84, 4.43,1.03, 3.71,1.43],
  [3,-5.75,4.12, .29, -5.25,2.73, -5.10,1.76],
  [3,-3.89,1.10, -1.10, -4.26,1.77, -3.98,2.22],
  [3,-1.59,3.09, .72, -2.13,2.29, -3.13,1.62],
  [1,1.46,-.49, .62, 1.13,-1.23, .53,-1.55],
  [4,1.41,2.45, -1.25, 1.74,1.88, 2.41,1.42],
  [4,5.12,3.88, -.17, 4.52,3.17, 3.58,2.68],
  [5,-3.45,5.36, -.74, -2.72,4.64, -1.63,4.30],
  [5,.16,1.21, 2.21, -.14,2.27, -.39,3.43],
  [5,2.87,5.21, .46, 2.13,4.34, .79,4.12],
  [6,-2.78,.60, 1.27, -2.67,-.09, -2.13,-.81],
  [6,.80,.17, -.82, .42,-.62, -.56,-.82],
  [6,-.95,1.63, -2.55, -1.06,.92, -1.37,.29],
];

export const HOME = walks.map(([,x,z,yaw],i) =>
  i===SWIMMER_INDEX ? {...SWIM_LANDING} : stations.has(i) ? {...stations.get(i).land} : {x,z,yaw});

const conversations = [
  {period:26.8, offset:8.1}, {period:31.7, offset:19.6}, {period:29.2, offset:2.7},
  {period:34.3, offset:11.8}, {period:27.6, offset:24.2}, {period:32.1, offset:15.1},
  {period:30.9, offset:5.5},
];

function seed(index, salt) {
  let n = Math.imul(index + 5, 0x85ebca6b) ^ Math.imul(salt + 1, 0xc2b2ae35);
  n = Math.imul(n ^ n >>> 16, 0x7feb352d);
  return ((n ^ n >>> 15) >>> 0) / 4294967296;
}

const paths = walks.map(([group,x,z,homeYaw,cx,cz,mx,mz,stool], i) => {
  const {period, offset} = conversations[group];
  const companions = walks.filter((r,j) => j !== i && r[0] === group && !stations.has(j) && j!==SWIMMER_INDEX);
  const gaze = companions.map(r => Math.atan2(r[6] - mx, r[7] - mz));
  if(gaze.length===1)gaze.push(gaze[0]+.18);
  const length = Math.hypot(cx-x,cz-z) + Math.hypot(mx-cx,mz-cz);
  const speed = .65 + .25 * seed(i,0);
  const depart = .7 + 5.5 * seed(i,1);
  const leave = period * (.48 + .20 * seed(i,2));
  const backControl = [cx + (seed(i,3) - .5) * .37, cz + (seed(i,4) - .5) * .36];
  return { x,z,cx,cz,mx,mz,homeYaw,stool:Boolean(stool),period,offset,gaze,depart,leave,
    outward:length / speed, homeward:length / (speed * (1.01 + .14 * seed(i,5))),
    backControl, phase:seed(i,6) * TAU,
  };
});

function atRest(path, seconds, home) {
  const gaze = path.gaze;
  if (!home) {
    const listener = smooth((Math.sin(seconds * .77 + path.phase) + .47) / .94);
    return turn(gaze[0], gaze[1], listener) + .035 * Math.sin(seconds * 1.3 + path.phase);
  }
  const glance = path.stool ? .17 : .34;
  return path.homeYaw + glance * Math.sin(seconds * .51 + path.phase) + .07 * Math.sin(seconds * .91 + path.phase);
}

function inMotion(path, t, returning, seconds) {
  // Ease the first and last few steps. The middle of the walk stays at a steady pace.
  const ramp = .17;
  const unit = 1 / (1 - ramp);
  const travel = t < ramp ? unit * t*t / (2*ramp)
    : t > 1-ramp ? 1 - unit*(1-t)*(1-t)/(2*ramp) : unit*(t-ramp*.5);
  const a = 1 - travel;
  const fromX = returning ? path.mx : path.x, fromZ = returning ? path.mz : path.z;
  const toX = returning ? path.x : path.mx, toZ = returning ? path.z : path.mz;
  const cx = returning ? path.backControl[0] : path.cx, cz = returning ? path.backControl[1] : path.cz;
  const x = a*a*fromX + 2*a*travel*cx + travel*travel*toX;
  const z = a*a*fromZ + 2*a*travel*cz + travel*travel*toZ;
  const heading = Math.atan2(a*(cx-fromX)+travel*(toX-cx), a*(cz-fromZ)+travel*(toZ-cz));
  let yaw = turn(atRest(path,seconds,!returning), heading, smooth(t/.19));
  yaw = turn(yaw,atRest(path,seconds,returning),smooth((t-.77)/.23));
  return {x,z,y:0,yaw,walking:true,seated:false,activity:'walk',land:null};
}

/**
 * Pose for an unclaimed resident at a shared wall-clock time.
 * y is the absolute floor / waterline height supplied to the figure's root.
 * land marks a safe place on the sand for approaching or claiming an activity.
 */
export function npcPose(index, serverTimeMs) {
  const path = paths[index];
  if (!path) return null;
  const seconds = Number.isFinite(serverTimeMs) ? serverTimeMs / 1000 : 0;
  if(index===SWIMMER_INDEX) {
    return swimPose(seconds,0,2.49,-9.64,.99,.24,14.8,SWIM_LANDING);
  }
  const station=stations.get(index);
  if(station) return {x:station.x,z:station.z,y:station.y??0,yaw:station.facing,walking:false,seated:true,activity:station.activity,land:station.land};
  const clock = ((seconds + path.offset) % path.period + path.period) % path.period;
  if (clock >= path.depart && clock < path.depart + path.outward) {
    return inMotion(path, (clock - path.depart) / path.outward, false, seconds);
  }
  if (clock >= path.leave && clock < path.leave + path.homeward) {
    return inMotion(path,(clock-path.leave)/path.homeward,true,seconds);
  }
  const home = clock < path.depart || clock >= path.leave + path.homeward;
  const x=home ? path.x : path.mx, z=home ? path.z : path.mz, seated=home && path.stool;
  let activity=seated ? 'sit' : 'idle', yaw=atRest(path,seconds,home);
  if(index===3){
    activity='photograph';
    yaw=(home ? -1.69 : -1.24) + .23*Math.sin(seconds*.44);
  }else if(index===14 && home){
    activity='stretch';yaw=STRETCH_MAT.facing;
  }
  return {x,z,y:0,yaw,walking:false,seated,activity,land:seated ? {x,z:z+.79,yaw:0} : null};
}

/** A navigable land origin for a player taking over an NPC, including the swimmer. */
export function npcLandPose(index, serverTimeMs) {
  const pose=npcPose(index,serverTimeMs);
  if(!pose)return null;
  if(pose.land)return pose.land;
  const path=paths[index];
  if(path.stool && Math.abs(pose.x-path.x)<.52 && Math.abs(pose.z-path.z)<.49) {
    return {x:path.x,z:path.z+.79,yaw:0};
  }
  return {x:pose.x,z:pose.z,yaw:pose.yaw};
}

function swimPose(seconds, offset, cx, cz, rx, rz, period, land) {
  const phase=(seconds%period)*TAU/period+offset;
  const x=cx+rx*Math.sin(phase), z=cz+rz*Math.cos(phase);
  const y=WATER_Y+.020*Math.sin((seconds%4.8)*TAU/2.4+offset);
  return {x,z,y,yaw:Math.atan2(rx*Math.cos(phase),-rz*Math.sin(phase)),walking:false,seated:false,activity:'swim',land};
}

/** Shared-clock figure pose while a player is using a leisure spot. */
export function playPose(id, serverTimeMs, playerId='guest') {
  if(id==='lounge') {
    const bed=SUNBEDS[2];
    return {x:bed.x,z:bed.z,y:0,yaw:bed.facing,walking:false,seated:true,activity:'lounge',land:PLAY_SPOTS[0].land};
  }
  if(id!=='swim')return null;
  let hash=2166136261;
  const name=String(playerId);
  for(let i=0;i<name.length;i++) hash=Math.imul(hash^name.charCodeAt(i),16777619);
  hash=Math.imul(hash^hash>>>16,0x85ebca6b);
  hash=(hash^hash>>>13)>>>0;
  const phase=TAU*hash/4294967296, lane=hash%4;
  const seconds=Number.isFinite(serverTimeMs)?serverTimeMs/1000:0;
  return swimPose(seconds,phase,2.65+.025*lane,-10.65-.30*lane,1.09,.22,17.6+lane*.9,PLAY_SPOTS[1].land);
}

/** An eight-panel vinyl beach ball. Its object origin is the centre of the ball. */
export function createBeachBall(T) {
  const radius = .32, panels = 8;
  const sphere = new T.SphereGeometry(radius,48,26);
  const geometry = sphere.toNonIndexed();
  sphere.dispose();
  const position = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  const colour = new Float32Array(position.count * 3);
  const paints = ['#e67956','#fff0cf','#5cafa7','#fff0cf','#e8b54e','#fff0cf','#6fa8ab','#fff0cf'].map(v=>new T.Color(v));
  const cap = new T.Color('#f8e4b5'), valve = new T.Color('#be9565');
  for(let i=0;i<position.count;i+=3) {
    let mx=0, my=0, mz=0;
    for(let k=i;k<i+3;k++){mx+=position.getX(k);my+=position.getY(k);mz+=position.getZ(k);}
    const longitude = (Math.atan2(mz,-mx)+TAU)%TAU;
    const pole = Math.abs(my/(3*radius));
    const paint = pole>.994 ? valve : pole>.958 ? cap : paints[Math.floor(longitude/TAU*panels)%panels];
    for (let k=i;k<i+3;k++) {
      const x=position.getX(k), y=position.getY(k), z=position.getZ(k);
      const latitude=y/radius, azimuth=Math.atan2(z,-x);
      const seam=Math.pow((1+Math.cos(azimuth*panels))*.5,11);
      const relief=1-.013*seam*(1-latitude*latitude);
      const twist=.24*(1-latitude*latitude), c=Math.cos(twist), s=Math.sin(twist);
      const rotatedX=x*c+z*s, rotatedZ=-x*s+z*c;
      position.setXYZ(k,rotatedX*relief,y*relief,rotatedZ*relief);
      normal.setXYZ(k,rotatedX/radius,y/radius,rotatedZ/radius);
      const shade=1-.055*seam*(1-latitude*latitude);
      colour.set([paint.r*shade,paint.g*shade,paint.b*shade],k*3);
    }
  }
  geometry.setAttribute('color',new T.BufferAttribute(colour,3));
  geometry.computeBoundingSphere();
  const mesh=new T.Mesh(geometry,new T.MeshStandardMaterial({vertexColors:true,roughness:.47,metalness:.015}));
  mesh.name='Beach ball';
  mesh.castShadow=true; mesh.receiveShadow=true;
  return mesh;
}
