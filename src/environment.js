import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { COURT_BENCH, onMat, SEATS, WATER_Y, WORK_DESKS, WORK_MATS } from './island-life.js';
import { BEACH_PROFILE, PALMS, beachRadius, palmTrunk, shoreline } from '../shared/mobility.js';
import { PADEL } from '../shared/sports.js';
import { addShoreActivities } from './shore-art.js';

const TAU = Math.PI * 2;

// The warung's boards sit above the sand. Visitors step up from the east side.
export const WARUNG = { x: -5.15, z: -3.70 };
export const WARUNG_GALLEY = { x: WARUNG.x + .35, z: WARUNG.z - .04, yaw: 0 };
export const WARUNG_FOOTPRINT = { x: WARUNG.x + .17, z: WARUNG.z, w: 6.40, d: 2.62 };
export function warungFloor(x, z) {
  const lx = x - WARUNG.x, lz = z - WARUNG.z;
  if (Math.abs(lz) <= 1.27 && Math.abs(lx) <= 2.85) return .225;
  if (lx > 2.85 && lx <= 3.19 && lz >= -.58 && lz <= .64) return .115;
  return 0;
}
export function insideWarung(x, z) {
  const lx = x - WARUNG.x, lz = z - WARUNG.z;
  return Math.abs(lx) <= 2.85 && lz > -1.27 && lz < .9;
}
const lerp = (a, b, amount) => a + (b - a) * amount;

function randomStream(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

// The little pieces of a diorama share vertex colours and one draw call per batch.
function makeBatch(T, name) {
  const positions = [];
  const normals = [];
  const colours = [];
  const indices = [];
  const tones = new Map();
  const transform = new T.Object3D();
  const normalMatrix = new T.Matrix3();
  const point = new T.Vector3();
  const normal = new T.Vector3();
  const edgeA = new T.Vector3();
  const edgeB = new T.Vector3();
  const up = new T.Vector3(0, 1, 0);

  function tone(key) {
    if (!tones.has(key)) tones.set(key, new T.Color(key));
    return tones.get(key);
  }

  function append(geometry, colour) {
    const source = geometry.attributes.position;
    const sourceNormals = geometry.attributes.normal;
    const offset = positions.length / 3;
    const c = tone(colour);
    transform.updateMatrix();
    normalMatrix.getNormalMatrix(transform.matrix);
    for (let i = 0; i < source.count; i++) {
      point.fromBufferAttribute(source, i).applyMatrix4(transform.matrix);
      normal.fromBufferAttribute(sourceNormals, i).applyNormalMatrix(normalMatrix);
      positions.push(point.x, point.y, point.z);
      normals.push(normal.x, normal.y, normal.z);
      colours.push(c.r, c.g, c.b);
    }
    const src = geometry.index?.array;
    for (let i = 0; i < (src?.length ?? source.count); i++) indices.push(offset + (src ? src[i] : i));
  }

  function stamp(geometry, colour, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
    transform.position.set(x, y, z);
    transform.rotation.set(rx, ry, rz);
    transform.scale.set(sx, sy, sz);
    append(geometry, colour);
  }

  function between(geometry, colour, a, b, radius, depth = radius) {
    transform.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    point.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const length = point.length();
    if (length < 0.0001) return;
    transform.quaternion.setFromUnitVectors(up, point.multiplyScalar(1 / length));
    transform.scale.set(radius, length, depth);
    append(geometry, colour);
  }

  function face(a, b, c, colour) {
    edgeA.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    edgeB.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
    normal.crossVectors(edgeA, edgeB).normalize();
    const offset = positions.length / 3;
    const vertices = [a,b,c];
    for (let i = 0; i < vertices.length; i++) {
      const p = vertices[i];
      const tint = tone(Array.isArray(colour) ? colour[i] : colour);
      positions.push(...p);
      normals.push(normal.x, normal.y, normal.z);
      colours.push(tint.r, tint.g, tint.b);
    }
    indices.push(offset, offset + 1, offset + 2);
  }

  function quad(a, b, c, d, colour) {
    face(a, b, c, Array.isArray(colour) ? [colour[0],colour[1],colour[2]] : colour);
    face(a, c, d, Array.isArray(colour) ? [colour[0],colour[2],colour[3]] : colour);
  }

  function finish(material, parent, casts = true) {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('color', new T.Float32BufferAttribute(colours, 3));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    positions.length = 0;
    normals.length = 0;
    colours.length = 0;
    indices.length = 0;
    tones.clear();
    const mesh = new T.Mesh(geometry, material);
    mesh.name = name;
    mesh.castShadow = casts;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  return { stamp, between, face, quad, finish };
}

function makeContactShadows(T) {
  const positions = [], colours = [], indices = [];
  const colour = new T.Color('#6e5141');
  function ellipse(x, z, rx, rz, opacity = 0.22) {
    const offset = positions.length / 3;
    for (const [radius, alpha] of [[0.03, opacity], [0.61, opacity * 0.72], [1, 0]]) {
      for (let i = 0; i < 20; i++) {
        const angle = TAU * i / 20;
        positions.push(x + Math.cos(angle) * radius * rx, 0.018, z + Math.sin(angle) * radius * rz);
        colours.push(colour.r, colour.g, colour.b, alpha);
      }
    }
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < 20; i++) {
        const a = offset + row * 20 + i, b = offset + row * 20 + (i + 1) % 20;
        indices.push(a, b, a + 20, b, b + 20, a + 20);
      }
    }
  }
  function finish(parent) {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new T.Float32BufferAttribute(colours, 4));
    geometry.setIndex(indices);
    const mat = new T.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: T.DoubleSide });
    const mesh = new T.Mesh(geometry, mat);
    mesh.name = 'Soft contact shadows';
    mesh.renderOrder = 1;
    parent.add(mesh);
  }
  return { ellipse, finish };
}

// Turf lies over the sand as one soft-edged layer. Each patch fades out at its rim,
// so overlapping patches read as one lawn and the outer edge melts into the beach.
function makeLawns(T, random) {
  const positions = [], normals = [], colours = [], indices = [];
  const greens = ['#8dab60', '#9fb86b', '#7f9f59'].map(c => new T.Color(c));
  const rim = new T.Color('#c2c286');
  const tint = new T.Color();
  const rings = [[.22, 1], [.46, 1], [.66, 1], [.80, .92], [.90, .5], [1, 0]];
  const patches = [];
  function vertex(x, z, f, alpha) {
    const a = .5 + .5 * Math.sin(x * .83 + 1.7 * Math.sin(z * .41));
    const b = .5 + .5 * Math.sin(z * 1.13 - x * .37 + .6);
    tint.copy(greens[0]).lerp(greens[1], a * .8).lerp(greens[2], b * .45).lerp(rim, Math.max(0, (f - .6) / .4));
    positions.push(x, .006, z);
    normals.push(0, 1, 0);
    colours.push(tint.r, tint.g, tint.b, alpha);
  }
  // Each patch is a wobbly ellipse that stops short of the wet sand.
  function patch(cx, cz, rx, rz, { angle = 0, limit = .8, sides = 72 } = {}) {
    const p1 = random() * TAU, p2 = random() * TAU, p3 = random() * TAU;
    const reach = [];
    for (let i = 0; i < sides; i++) {
      const a = TAU * i / sides, c = Math.cos(a), s = Math.sin(a);
      const u = c * Math.cos(angle) + s * Math.sin(angle), v = s * Math.cos(angle) - c * Math.sin(angle);
      const wobble = 1 + .09 * Math.sin(3 * a + p1) + .06 * Math.sin(5 * a + p2) + .035 * Math.sin(11 * a + p3);
      const outer = wobble / Math.hypot(u / rx, v / rz);
      let r = .2;
      while (r < outer && beachRadius(cx + c * r, cz + s * r) < limit) r += .05;
      reach.push(r);
    }
    const offset = positions.length / 3;
    vertex(cx, cz, 0, 1);
    for (const [f, alpha] of rings) {
      for (let i = 0; i < sides; i++) {
        const a = TAU * i / sides;
        vertex(cx + Math.cos(a) * reach[i] * f, cz + Math.sin(a) * reach[i] * f, f, alpha);
      }
    }
    const at = (ring, i) => offset + 1 + ring * sides + (i % sides);
    for (let i = 0; i < sides; i++) indices.push(offset, at(0, i + 1), at(0, i));
    for (let ring = 0; ring < rings.length - 1; ring++) {
      for (let i = 0; i < sides; i++) {
        indices.push(at(ring, i), at(ring, i + 1), at(ring + 1, i + 1));
        indices.push(at(ring, i), at(ring + 1, i + 1), at(ring + 1, i));
      }
    }
    const shape = { cx, cz, rx, rz, sides, reach };
    patches.push(shape);
    return shape;
  }
  function finish(parent) {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('color', new T.Float32BufferAttribute(colours, 4));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    const material = new T.MeshStandardMaterial({ vertexColors: true, transparent: true, depthWrite: false, roughness: 1 });
    const mesh = new T.Mesh(geometry, material);
    mesh.name = 'Lawns';
    mesh.receiveShadow = true;
    // Draw before the court glass, water and contact shadows so they all layer on top.
    mesh.renderOrder = -1;
    parent.add(mesh);
    return mesh;
  }
  return { patch, patches, finish };
}

function makeWater(T, root) {
  const material = new T.ShaderMaterial({
    transparent:true,
    depthWrite:false,
    uniforms: {
      time: { value: 0 },
      deep: { value: new T.Color('#579aa8') }, lagoon: { value: new T.Color('#6abdb5') },
      shore: { value: new T.Color('#b2dac7') }, sun: { value: new T.Color('#f5edcf') },
      horizon: { value: new T.Color('#d3e1d8') },
    },
    vertexShader: `
      varying vec2 worldXZ;
      varying vec3 eyePosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        worldXZ = worldPosition.xz;
        vec4 mv = viewMatrix * worldPosition;
        eyePosition = mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec2 worldXZ;
      varying vec3 eyePosition;
      uniform vec3 deep, lagoon, shore, sun, horizon;
      uniform float time;
      void main() {
        vec2 p = worldXZ;
        float angle = atan(p.y / 8.15, p.x / 11.7);
        float bayAngle=(angle+1.315)/.26;
        float eastBeach = 1.17 * pow(max(0.0,cos(angle)),4.0);
        float edge = 1.0 + eastBeach + .033*sin(3.0*angle-.45) + .016*sin(6.0*angle+1.0) + .012*sin(9.0*angle) - .136*exp(-bayAngle*bayAngle);
        float radius = length(p / vec2(11.7,8.15)) / edge;
        float shoal = 1.0 - smoothstep(1.12,1.62,radius + .024*sin(p.x*.75));
        float tint = sin(p.x*.24+p.y*.48)*.045 + sin(p.y*.7-p.x*.16)*.025;
        vec3 colour = mix(deep, lagoon, .45 + .50*shoal + tint*2.0);
        colour = mix(colour,shore,shoal*.81);
        float scroll = time*.48;
        float line = sin(p.y*5.8 + .68*sin(p.x*.85+p.y*.46) + .43*sin(p.x*.42-scroll) + scroll*.90);
        float windows = sin(p.x*1.7+p.y*.71+scroll*.48) + .62*sin(p.x*.72-p.y*1.5-scroll*.44);
        float glints = smoothstep(.89,.992,line)*smoothstep(.65,1.27,windows);
        float band = (sin(radius*82.0 - time*.92 + .48*sin(angle*21.0)) + 1.0)*.5;
        float beachRipples = smoothstep(.82,.99,band)*(1.0-smoothstep(1.06,1.29,radius));
        float lap = 1.136 + .010*sin(11.0*angle+.7*time) + .009*sin(17.0*angle-.41*time) + .012*sin(time*.62);
        float foam = (1.0-smoothstep(.002,.011,abs(radius-lap)))*(.22+.55*smoothstep(-.63,.62,sin(angle*8.0+time*.33)));
        colour = mix(colour,sun,min(.9,glints*.39 + beachRipples*.21 + foam));
        colour = mix(colour,horizon,smoothstep(26.0,110.0,length(eyePosition))*.76);
        // Let shoes, wheels and wet sand show through the first few steps of surf.
        float shallows = 1.0-smoothstep(1.19,1.29,radius);
        float cove = 1.0-smoothstep(.52,1.29,length((p-vec2(2.60,-10.55))/vec2(3.35,2.08)));
        gl_FragColor = vec4(colour,1.0-max(.38*shallows,.47*cove));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new T.Mesh(new T.PlaneGeometry(1100, 1100), material);
  mesh.name = 'Lagoon and shallows';
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = WATER_Y;
  const shelf=new T.Mesh(new T.PlaneGeometry(27,23),new T.MeshBasicMaterial({color:'#8ebdb1'}));
  shelf.name='Shallow sandy seabed';
  shelf.rotation.x=-Math.PI/2;
  shelf.position.set(2.60,-2.0,-11.7);
  root.add(shelf);
  root.add(mesh);
  return t => { material.uniforms.time.value = t; };
}

export function buildEnvironment(T, scene, {shadowSize=1536}={}) {
  const root = new T.Group();
  root.name = 'Stripe Residency island';
  scene.add(root);
  const random = randomStream(950441);
  const pick = list => list[Math.floor(random() * list.length)];
  const range = (min, max) => lerp(min, max, random());
  const landscape = makeBatch(T, 'Sand, beach and coastal planting');
  const details = makeBatch(T, 'Warung, desks and garden');
  // The roof, awning and sign fade while you stand inside so the galley stays in view.
  const roof = makeBatch(T, 'Warung roof and awning');
  const cutawaySigns = [];
  const shadows = makeContactShadows(T);
  const clay = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.91, side: T.DoubleSide });
  const grain = new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: T.DoubleSide });
  const props = {
    box: new RoundedBoxGeometry(1, 1, 1, 1, 0.11),
    board: new T.BoxGeometry(1, 1, 1),
    ball: new T.SphereGeometry(1, 12, 8),
    oval: new T.SphereGeometry(1, 8, 5),
    rock: new T.DodecahedronGeometry(1, 0),
    pipe: new T.CylinderGeometry(1, 1, 1, 10),
    finePipe: new T.CylinderGeometry(1, 1, 1, 6),
    taper: new T.CylinderGeometry(0.82, 1, 1, 10),
    trunk: new T.CylinderGeometry(0.95, 1, 1, 12),
    pot: new T.CylinderGeometry(1, 0.72, 1, 16),
    pan: new T.CylinderGeometry(1, 0.62, 1, 20),
  };
  const block = (batch, tone, x, y, z, w, h, d, rx = 0, ry = 0, rz = 0) =>
    batch.stamp(props.box, tone, x, y, z, w, h, d, rx, ry, rz);
  const board = (batch, tone, x, y, z, w, h, d, rx = 0, ry = 0, rz = 0) =>
    batch.stamp(props.board, tone, x, y, z, w, h, d, rx, ry, rz);
  const ball = (batch, tone, x, y, z, a, b, c, rx = 0, ry = 0, rz = 0) =>
    batch.stamp(props.ball, tone, x, y, z, a, b, c, rx, ry, rz);
  const rod = (batch, tone, a, b, radius) => batch.between(props.pipe, tone, a, b, radius);
  const stick = (batch, tone, a, b, radius) => batch.between(props.finePipe, tone, a, b, radius);
  const disc = (batch, tone, x, y, z, radius, height, zRadius = radius) =>
    batch.stamp(props.pipe, tone, x, y, z, radius, height, zRadius);
  const obstacles = [];
  const animated = [];
  // h is the top of the obstacle. A jump clears anything lower than the jumper's feet; the rest stays solid.
  const obstacle = (x, z, w, d, h = Infinity) => obstacles.push({ x, z, w, d, h });
  const palette = {
    darkLeaf: '#37694b', green: '#558457', young: '#91a95d',
    deep: '#254d42', teal: '#44857a', ink: '#243f36',
    wood: '#aa6a40', woodDark: '#77472f', rattan: '#c38a50',
    ivory: '#fff0c9', yellow: '#e3b247', clay: '#c76c43', red: '#c55940',
  };

  scene.background = new T.Color('#d4e6df');
  scene.fog = new T.FogExp2('#d1e1d8', 0.009);
  const clearSky = scene.background.clone(), clearHaze = scene.fog.color.clone();
  const showerSky = new T.Color('#a9b9b8'), showerHaze = new T.Color('#aebdbb');
  let weather = 0;
  const sky = new T.HemisphereLight('#fffaed', '#e6d3ba', 1.67);
  const sunlight = new T.DirectionalLight('#fff1db', 2.14);
  sunlight.position.set(-8, 15, 7.8);
  sunlight.target.position.set(0, 0, -0.4);
  sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(shadowSize, shadowSize);
  Object.assign(sunlight.shadow.camera, { left: -15, right: 15, top: 13, bottom: -13, near: 1, far: 43 });
  sunlight.shadow.camera.updateProjectionMatrix();
  sunlight.shadow.normalBias = 0.025;
  sunlight.shadow.bias = -0.00018;
  sunlight.shadow.radius = 3;
  root.add(sky, sunlight, sunlight.target);
  animated.push(makeWater(T, root));

  const segments = 96;
  const coastalRing = (i, radius, height) => {
    const angle = (i % segments) / segments * TAU;
    const variation = shoreline(angle) * radius;
    return [11.7 * Math.cos(angle) * variation, height, 8.15 * Math.sin(angle) * variation];
  };

  const sandBands=['#dcc59d','#e5cba4','#ead1ac','#eed7b4','#e8d3b0','#d7c6a6','#c6c4a4','#a0b5a5'];
  const surfaceRings = [0,.19,.37,.57,.75,BEACH_PROFILE[0][0]];
  function sandTone(radius, i) {
    const [x,,z] = coastalRing(i,radius,0);
    const tint = .54 + .21*Math.sin(x*.65+.64*Math.cos(z)) + .20*Math.sin(z*.72-x*.29);
    const weight = .38*tint + Math.max(0,radius-.54)*.66;
    return '#' + new T.Color('#f0d9b5').lerp(new T.Color('#ceb78f'),weight).getHexString();
  }
  for (let i = 0; i < segments; i++) {
    for(let k=1;k<surfaceRings.length;k++) {
      const r0=surfaceRings[k-1], r1=surfaceRings[k];
      landscape.quad(coastalRing(i,r0,0),coastalRing(i+1,r0,0),coastalRing(i+1,r1,0),coastalRing(i,r1,0),[sandTone(r0,i),sandTone(r0,i+1),sandTone(r1,i+1),sandTone(r1,i)]);
    }
    for (let j = 1; j < BEACH_PROFILE.length; j++) {
      const [r1, h1] = BEACH_PROFILE[j-1], [r2, h2] = BEACH_PROFILE[j], tone=sandBands[j];
      const innerA=j===1 ? sandTone(r1,i) : sandBands[j-1];
      const innerB=j===1 ? sandTone(r1,i+1) : sandBands[j-1];
      landscape.quad(coastalRing(i, r1, h1), coastalRing(i + 1, r1, h1), coastalRing(i + 1, r2, h2), coastalRing(i, r2, h2), [innerA,innerB,tone,tone]);
    }
  }

  function paving(x, z, rx, rz, colour, angle = 0) {
    const points = [];
    for (let i = 0; i < 8; i++) {
      const phase = TAU * i / 8;
      const px = Math.cos(phase) * rx * range(0.86, 1.07);
      const pz = Math.sin(phase) * rz * range(0.86, 1.07);
      points.push([x + px * Math.cos(angle) - pz * Math.sin(angle), 0.012, z + px * Math.sin(angle) + pz * Math.cos(angle)]);
    }
    for (let i = 0; i < 8; i++) landscape.face([x, 0.015, z], points[(i + 1) % 8], points[i], colour);
  }

  // A worn line of limestone pavers leaves the open sand between the tables playable.
  for (let i = 0; i < 12; i++) {
    const t = i / 11;
    const x = lerp(-7.3, 7.9, t);
    const z = -1.35 + 1.55 * Math.sin(Math.PI * t) + range(-0.12, 0.12);
    paving(x, z, range(0.45, 0.70), range(0.25, 0.43), pick(['#eed5aa','#f0d7ac','#e2bf8c','#f1d9af']), range(-0.35,0.35));
  }
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    paving(-0.36 + t * 0.94, 1 + 5.15 * t, 0.52, 0.26, pick(['#edcfa1','#f0d4a8','#e3c28f']), range(-0.4, 0.4));
  }
  for (let i = 0; i < 220; i++) {
    const angle = range(0, TAU), r = Math.sqrt(random()) * 0.93;
    const x = Math.cos(angle) * r * 11.6, z = Math.sin(angle) * r * 8;
    const size = range(0.016, 0.065);
    landscape.stamp(props.rock, pick(['#d9b785','#d9b988','#efd4a8','#e0c395']), x, 0.01, z, size, size * 0.20, size * 0.56, 0, range(0,TAU), 0);
  }

  function sign(x, y, z, width, height, word, kind, tilt = 0) {
    const canvas = document.createElement('canvas');
    const landscapeSign = kind === 'warung';
    canvas.width = landscapeSign ? 1024 : 280;
    canvas.height = landscapeSign ? 206 : 320;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.fillStyle = landscapeSign ? '#264c3e' : '#304b42';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(250,234,194,.10)';
    for (let i = 0; i < 550; i++) ctx.fillRect(random() * w, random() * h, range(0.8, 3), range(0.8, 3));
    ctx.strokeStyle = '#e9dba7';
    ctx.lineWidth = landscapeSign ? 4 : 3;
    ctx.strokeRect(landscapeSign ? 16 : 9, landscapeSign ? 12 : 9, w - (landscapeSign ? 32 : 18), h - (landscapeSign ? 24 : 18));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff1c4';
    if (landscapeSign) {
      ctx.font = 'bold 147px Georgia, serif';
      ctx.fillText(word, w / 2, h / 2 + 6);
      for (const cx of [89, w - 89]) {
        for (let k = 0; k < 8; k++) {
          const a = k * TAU / 8;
          ctx.beginPath();
          ctx.ellipse(cx + 15 * Math.cos(a), h / 2 + 15 * Math.sin(a), 10, 4.5, a, 0, TAU);
          ctx.fill();
        }
        ctx.beginPath(); ctx.arc(cx, h / 2, 5, 0, TAU); ctx.fill();
      }
    } else {
      ctx.font = 'italic bold 55px Georgia, serif';
      ctx.fillText(word, w / 2, 74);
      ctx.strokeStyle = '#e0cb90';
      ctx.beginPath(); ctx.moveTo(42, 120); ctx.lineTo(w-42,120); ctx.stroke();
      ctx.font = 'bold 33px Georgia, serif';
      ctx.fillText('Nasi', w / 2, 167);
      ctx.fillText('Kopi', w / 2, 223);
      ctx.fillText('Es teh', w / 2, 272);
    }
    const tex = new T.CanvasTexture(canvas);
    tex.colorSpace = T.SRGBColorSpace;
    tex.anisotropy = 4;
    const mesh = new T.Mesh(new T.PlaneGeometry(width, height), new T.MeshBasicMaterial({ map: tex, toneMapped: false }));
    mesh.name = word;
    mesh.position.set(x,y,z);
    mesh.rotation.x = tilt;
    root.add(mesh);
    return mesh;
  }

  function flower(batch, x, y, z, radius, colour = '#fff1c6') {
    for (let k = 0; k < 5; k++) {
      const a = k * TAU / 5;
      batch.stamp(props.oval, colour, x + radius * 0.52 * Math.cos(a), y + radius * 0.12, z + radius * 0.52 * Math.sin(a), radius * 0.52, radius * 0.2, radius * 0.29, 0, -a, 0);
    }
    batch.stamp(props.oval, '#efb24b', x, y + radius * 0.25, z, radius * .23, radius * .19, radius * .23);
  }

  // A folded leaf has a sunlit rib and two different green faces.
  function blade(batch, origin, angle, length, width, lift, drop, leftTone, rightTone) {
    const c = Math.cos(angle), s = Math.sin(angle);
    const samples = [];
    for (const t of [0, .24, .56, .80, 1]) {
      const bend = Math.sin(Math.PI * t);
      const w = width * Math.pow(Math.max(0.001, bend), .65) * (1.18 - .33 * t);
      const distance = length * t;
      const x = origin[0] + c * distance, z = origin[2] + s * distance;
      const y = origin[1] + lift * t + bend * lift * .62 - drop * t * t;
      samples.push([[x - s * w, y - w * .26, z + c * w], [x, y + w * .17, z], [x + s * w, y - w * .37, z - c * w]]);
    }
    for (let i = 0; i < samples.length - 1; i++) {
      const a = samples[i], b = samples[i+1];
      batch.quad(a[1],a[0],b[0],b[1],leftTone);
      batch.quad(a[2],a[1],b[1],b[2],rightTone);
    }
  }

  function tropicalPlant(x, y, z, scale, flowers = false) {
    const shades = [['#517c53','#639056'],['#638b5c','#7b995e'],['#789651','#94a457'],['#426e51','#538052']];
    for (let i = 0; i < 10; i++) {
      const pair = pick(shades), angle = i * 2.4 + range(-.45,.45);
      const inner = i > 6;
      blade(details, [x, y, z], angle, range(.50, .91) * scale * (inner ? .58 : 1), range(.10,.18)*scale, (inner ? .91 : .64) * scale, range(.12,.32)*scale, ...pair);
    }
    if (flowers) {
      for (let i = 0; i < 3; i++) {
        const px = x + range(-.25,.25)*scale, py = y + range(.65,.99)*scale, pz = z + range(-.26,.26)*scale;
        stick(details, '#698658', [x, y+.04, z], [px, py, pz], .019*scale);
        flower(details, px, py, pz, .12*scale, i === 1 ? '#edab83' : '#fff0c1');
      }
    }
  }

  function planter(x, z, scale, flowers = false, tone = '#c47850') {
    const radius = scale * .38, h = scale * .62;
    details.stamp(props.pot, tone, x, h/2+.025, z, radius, h, radius);
    disc(details,'#d99665',x,h*.91,z,radius*1.07,h*.12);
    disc(details,'#624a36',x,h+.015,z,radius*.91,.04);
    tropicalPlant(x,h,z,scale*.83,flowers);
    shadows.ellipse(x,z,radius*1.7,radius*1.3,.24);
  }

  function seaGrape(x,z,size,bloom) {
    const colours=['#4e7851','#638658','#789159','#829963','#5c8056'];
    for(let k=0;k<8;k++) {
      const a=k*2.4, r=size*Math.sqrt(k/8)*.50;
      const px=x+Math.cos(a)*r, pz=z+Math.sin(a)*r, py=size*range(.27,.55);
      stick(details,'#8b7654',[x,.025,z],[px,py,pz],.034*size);
      details.stamp(props.oval,pick(colours),px,py,pz,.22*size,.17*size,.24*size,.1,a,.1);
      for(let n=0;n<3;n++) {
        const dir=a+n*2.1, lx=px+Math.cos(dir)*.19*size,lz=pz+Math.sin(dir)*.19*size;
        details.stamp(props.oval,pick(colours),lx,py+.064*size,lz,.18*size,.045*size,.098*size,-.24,-dir,.18);
      }
      if(bloom && k%3===0) flower(details,px,py+.17*size,pz,.111*size,bloom);
    }
    shadows.ellipse(x,z,size*.80,size*.67,.18);
  }

  function bananaPlant(x,z,size) {
    const greens=[['#52814e','#759457'],['#709859','#8ea55e'],['#4e794d','#659151']];
    for(let i=0;i<6;i++) {
      const angle=i*2.4, c=Math.cos(angle),s=Math.sin(angle);
      const h=(i%3===0 ? 1.05 : .75)*size;
      const tip=[x+c*.22*size,h,z+s*.22*size];
      rod(details,i%2 ? '#a1a368' : '#89a36b',[x+c*.035,.03,z+s*.035],tip,.027*size);
      blade(details,tip,angle,(i%3===0?.72:1.05)*size,.21*size,(i%3===0?.51:.36)*size,.51*size,...greens[i%3]);
    }
  }

  function littleShrine(x,z) {
    const stone=['#6b705e','#7a7c65','#949078','#5e695d'];
    const layers=[
      [.10,.20,.91,stone[0]],[.23,.10,.78,stone[2]],[.32,.12,.70,stone[1]],
      [.47,.26,.58,stone[0]],[.66,.13,.72,stone[2]],[.75,.085,.82,stone[3]],
      [.83,.08,.72,stone[2]],[1.02,.32,.48,stone[0]],[1.22,.09,.69,stone[1]],
      [1.31,.095,.59,stone[2]],[1.39,.08,.47,stone[0]],[1.48,.13,.32,stone[1]],
    ];
    for (const [y,h,w,tone] of layers) block(details,tone,x,y,z,w,h,w);
    for(let row=0;row<3;row++) for(let col=0;col<7;col++) {
      const tone=(col+row)%2 ? '#39473d' : '#dfd9bc';
      board(details,tone,x+(col-3)*.084,.39+row*.084,z+.299,.084,.086,.016);
      board(details,tone,x-.299,.39+row*.084,z+(col-3)*.084,.015,.086,.084);
      board(details,tone,x+.299,.39+row*.084,z+(col-3)*.084,.015,.086,.084);
    }
    block(details,'#354c40',x,1.02,z+.247,.29,.18,.027);
    for(const side of [-1,1]) {
      block(details,stone[2],x+side*.218,1.03,z+.23,.08,.34,.085);
      ball(details,stone[1],x+side*.261,1.28,z+.22,.077,.12,.077,0,0,side*.32);
    }
    ball(details,'#7b816d',x,1.60,z,.096,.12,.096);
    ball(details,'#a4a77f',x,1.71,z,.046,.07,.05);
    block(details,'#ab9c62',x,.814,z+.37,.30,.039,.15);
    for(let i=0;i<3;i++) flower(details,x+(i-1)*.092,.849,z+.36,.070,i===1?'#e38d45':'#f0c65c');
    obstacle(x,z,.90,.90);
    shadows.ellipse(x,z,.76,.62,.23);
  }

  function palm(tree) {
    const {x,z,height,reach}=tree;
    const levels = 12;
    const trunk = t => { const p=palmTrunk(tree,t);return [p.x,p.y,p.z]; };
    const bark = ['#a1764e','#b18a59','#bd9261','#aa8054'];
    for (let j = 0; j < levels; j++) {
      const t = j/levels, end = (j+1)/levels;
      const radius = lerp(.28,.112,Math.pow(t,.68)) * Math.sqrt(height/4.6);
      details.between(props.trunk, bark[j % bark.length], trunk(t), trunk(end+.004), radius);
      if (j) details.between(props.pipe,'#cfab75',trunk(t),trunk(t+.009),radius*1.025);
    }
    const crown = trunk(1);
    const leaves = makeBatch(T, 'Coconut palm fronds');
    const phase = range(0,TAU);
    function frond(angle, length, pitch, drop, spread) {
      const c = Math.cos(angle), s = Math.sin(angle);
      const spine = t => [length*t*c, pitch*t + .77*Math.sin(Math.PI*t) - drop*t*t, length*t*s];
      for (let k = 0; k < 5; k++) stick(leaves, '#78934d', spine(k/5), spine((k+1)/5), .033*(1-k/6));
      const tones = [['#416f46','#59834c'],['#568249','#6c914b'],['#69954e','#82a252'],['#4b784d','#648e52']];
      const leafTone = pick(tones);
      for (let k=0;k<6;k++) {
        const t0=k/6,t1=(k+1)/6,p0=spine(t0),p1=spine(t1);
        const edge=(p,t,side)=>[p[0]-s*side*.105*Math.sin(t*Math.PI),p[1]-.033,p[2]+c*side*.105*Math.sin(t*Math.PI)];
        leaves.quad(p0,edge(p0,t0,1),edge(p1,t1,1),p1,leafTone[0]);
        leaves.quad(edge(p0,t0,-1),p0,p1,edge(p1,t1,-1),leafTone[1]);
      }
      for (let i = 0; i < 11; i++) {
        const t = .10 + i*.075;
        const p = spine(t);
        const feather = (.20 + .67*Math.sin(t*Math.PI)**.68) * spread * (1.2-.52*t);
        for (const side of [-1,1]) {
          const a = angle + side*(1.16-.42*t);
          const green = i > 7 && random() > .68 ? ['#799b55','#8ba65b'] : leafTone;
          blade(leaves, p, a, feather, (.101+.071*Math.sin(t*Math.PI))*spread, .055, .31*feather, ...green);
        }
      }
      blade(leaves,spine(.8),angle,length*.25,.095,.04,.16,...leafTone);
    }
    for (let i = 0; i < 9; i++) {
      const a = phase + TAU*i/9 + range(-.13,.13);
      frond(a, reach*range(.85,1.10), range(.28,.63), range(.71,1.12), reach/2.45);
    }
    for (let i = 0; i < 4; i++) {
      const a = phase + TAU*i/4+.35;
      frond(a, reach*range(.53,.69), range(.7,1.0), range(.1,.4), reach/3.1);
    }
    for (let i = 0; i < 4; i++) {
      const a = i*1.52;
      ball(details, i%2 ? '#9a9a4c' : '#ab9d51', crown[0]+.15*Math.cos(a), crown[1]-.18-(i%2)*.1, crown[2]+.17*Math.sin(a), .14,.18,.14,0,a,.17);
    }
    const moving = leaves.finish(clay,root);
    moving.position.set(...crown);
    animated.push(t => {
      moving.rotation.z = Math.sin(t*.49+phase)*.020;
      moving.rotation.x = Math.sin(t*.31+phase)*.013;
    });
    shadows.ellipse(x+.05,z+.02,.61,.4,.27);
    obstacle(x,z,.62,.62);
  }

  function shelfBottles(x, y, z, n, spacing) {
    const glazes = ['#ad5c3a','#c8ae72','#66988b','#f1cf91','#8b954f'];
    for (let i=0;i<n;i++) {
      const px=x+i*spacing, h=range(.18,.34), r=range(.054,.092);
      const glaze = pick(glazes);
      details.stamp(props.taper,glaze,px,y+h*.42,z,r,h*.84,r);
      disc(details,glaze,px,y+h*.89,z,r*.54,h*.22);
      disc(details,'#a98758',px,y+h*1.06,z,r*.59,h*.13);
      if (i%2===0) disc(details,'#e3d3a7',px,y+h*.49,z,r*1.015,h*.24);
    }
  }
  function bowl(x, y, z, radius, glaze) {
    details.stamp(props.pan,glaze,x,y+radius*.25,z,radius,radius*.50,radius);
    disc(details,'#e9d6b2',x,y+radius*.52,z,radius*.92,radius*.035);
    disc(details,'#b1895d',x,y+radius*.54,z,radius*.73,radius*.025);
  }

  function warung() {
    const cx = WARUNG.x, cz = WARUNG.z;
    const x = local => cx + local, z = local => cz + local;
    block(details,'#ccac82',cx,.075,cz,5.70,.15,2.54);
    block(details,'#d9b690',cx,.16,cz,5.54,.13,2.44);
    block(details,'#dcbb8f',cx,1.30,z(-1.14),5.20,2.23,.20);
    // A timber step leads through the open east side to the galley behind the counter.
    block(details,'#c49f74',x(3.02),.055,z(.03),.34,.11,1.22);
    block(details,'#d7b48a',x(3.02),.112,z(.03),.30,.012,1.16);
    for (const sx of [-2.43,2.43]) {
      if (sx < 0) block(details,'#d0a978',x(sx),.58,cz,.17,.94,2.28);
      else block(details,'#d0a978',x(sx),.58,z(-.88),.17,.94,.52);
      for (const sz of [-1.01,1.13]) {
        block(details,palette.woodDark,x(sx),1.44,z(sz),.17,2.52,.17);
        block(details,'#d6b17b',x(sx),.42,z(sz),.22,.40,.22);
        block(details,'#b78051',x(sx),2.51,z(sz),.27,.14,.27);
      }
    }
    for (const xx of [-1.65,.17,1.63]) block(details,'#967249',x(xx),1.43,z(-1.015),.10,2.15,.10);
    block(details,'#855b3c',cx,2.59,z(-1.01),5.43,.18,.19);
    block(details,'#825534',cx,2.57,z(1.21),5.65,.17,.21);

    // Two spice shelves, enamel dishes, and a stocked counter live under the eaves.
    for (const sy of [1.19,1.77]) {
      block(details,'#8a6042',x(-.57),sy,z(-.83),2.76,.10,.34);
      shelfBottles(x(-1.79),sy+.05,z(-.8),9,.285);
    }
    block(details,'#637569',x(1.67),1.51,z(-.89),.94,1.32,.23);
    block(details,'#96a391',x(1.67),1.54,z(-.75),.77,1.04,.055);
    for (const dx of [-.24,0,.24]) block(details,'#6c8173',x(1.67+dx),1.54,z(-.70),.035,1,.04);
    block(details,'#856646',cx,.63,z(.96),4.90,.91,.57);
    for (let i=0;i<22;i++) {
      const px=x(-2.33+i*.222);
      block(details, i%3===1 ? '#698a73' : '#718e73',px,.62,z(1.257),.209,.71,.056);
    }
    block(details,'#8c9b77',cx,.30,z(1.295),4.95,.10,.077);
    block(details,'#b67e4e',cx,1.11,z(.96),5.19,.16,.77);
    block(details,'#d39d68',cx,1.18,z(.98),5.23,.07,.79);
    // A small enamel host plaque hangs on the wooden counter.
    const plaqueX=x(.52),plaqueZ=z(1.332);
    for(const off of [-.31,.31]) {
      stick(details,'#a48755',[plaqueX+off,.86,plaqueZ],[plaqueX+off,1.03,plaqueZ-.014],.011);
    }
    block(details,'#365646',plaqueX,.705,plaqueZ,.92,.419,.047);
    block(details,'#f6e7c3',plaqueX,.706,plaqueZ+.024,.886,.384,.023);
    if(typeof Image!=='undefined'){
      const logo=new T.TextureLoader().load('/brand/stripe.svg');
      logo.colorSpace=T.SRGBColorSpace;
      logo.anisotropy=4;
      const lettering=new T.Mesh(new T.PlaneGeometry(.63,.2625),new T.MeshBasicMaterial({map:logo,transparent:true,depthWrite:false,toneMapped:false}));
      lettering.name='Stripe enamel plaque';
      lettering.position.set(plaqueX,.703,plaqueZ+.039);
      root.add(lettering);
    }
    for(const off of [-.382,.382]){
      ball(details,'#cba766',plaqueX+off,.71,plaqueZ+.043,.017,.017,.010);
    }
    for(let i=0;i<3;i++) bowl(x(-1.99+i*.38),1.215,z(1.05),.195,['#5f8a79','#dfaa72','#729b8a'][i]);
    bowl(x(.98),1.215,z(.97),.37,'#a16e42');
    for (let i=0;i<10;i++) {
      const a=i*2.4, rr=.20*Math.sqrt(i/10);
      ball(details,i%3 ? '#dc9c3f' : '#95a250',x(.98)+Math.cos(a)*rr,1.45+range(0,.12),z(.97)+Math.sin(a)*rr,.103,.10,.099);
    }
    for (let i=0;i<3;i++) {
      const px=x(1.61+i*.20);
      disc(details,['#deb895','#b16b4d','#e2bc87'][i],px,1.37,z(.99),.079,.29);
      disc(details,'#846d50',px,1.53,z(.99),.082,.045);
    }
    block(details,'#b5b6a0',x(-.45),1.49,z(.87),1.07,.54,.48);
    block(details,'#819994',x(-.45),1.53,z(1.12),.95,.36,.035);
    block(details,'#d3ceb0',x(-.45),1.53,z(1.147),.036,.38,.034);
    block(details,'#e1cfab',x(-.45),1.77,z(.87),1.12,.055,.52);

    // Clay pantiles laid in four hipped roof panels.
    const roofFront = [[-3.01,2.62,1.34],[3.01,2.62,1.34],[2.00,3.76,0],[-2.00,3.76,0]];
    const roofBack = [[3.01,2.62,-1.43],[-3.01,2.62,-1.43],[-2.00,3.76,0],[2.00,3.76,0]];
    const west = [[-3.01,2.62,-1.43],[-3.01,2.62,1.34],[-2.00,3.76,0],[-2.00,3.76,0]];
    const east = [[3.01,2.62,1.34],[3.01,2.62,-1.43],[2.00,3.76,0],[2.00,3.76,0]];
    const tiles=['#bc6042','#c66a48','#cc7150','#cf7750','#b96142','#d17a54','#c86b49'];
    function tiledPanel(corners, columns) {
      const sample=(u,v,raise=0) => {
        const a = corners[0].map((value,j)=>lerp(value,corners[1][j],u));
        const b = corners[3].map((value,j)=>lerp(value,corners[2][j],u));
        return [x(lerp(a[0],b[0],v)),lerp(a[1],b[1],v)+raise,z(lerp(a[2],b[2],v))];
      };
      roof.quad(sample(0,0),sample(1,0),sample(1,1),sample(0,1),'#995336');
      const rows = 5;
      for (let row=0;row<rows;row++) {
        for(let col=0;col<columns;col++) {
          const u0=(col+.014)/columns, u1=(col+.986)/columns, um=lerp(u0,u1,.42);
          const v0=row/rows, v1=(row+1.035)/rows;
          const colour=pick(tiles);
          const a=sample(u0,v0,.025), b=sample(um,v0,.077), c=sample(u1,v0,.020);
          const d=sample(u0,v1,.013), e=sample(um,v1,.043), f=sample(u1,v1,.012);
          roof.quad(a,b,e,d,colour); roof.quad(b,c,f,e,colour);
          roof.face(a,sample(um,v0,.010),b,'#a25438');
          roof.face(b,sample(um,v0,.010),c,'#a25438');
        }
      }
    }
    tiledPanel(roofFront,24); tiledPanel(roofBack,24); tiledPanel(west,10); tiledPanel(east,10);
    rod(roof,'#ab583a',[x(-2.04),3.77,cz],[x(2.04),3.77,cz],.105);
    for(const side of [-1,1]) {
      const xx=x(side*1.99);
      rod(roof,'#ba6944',[xx,3.78,cz],[xx+side*.14,3.89,cz],.074);
      ball(roof,'#bc6b46',xx+side*.16,3.93,cz,.071,.11,.068,0,0,-side*.20);
      ball(roof,'#d48554',xx+side*.13,4.015,cz,.043,.073,.05,0,0,side*.22);
    }
    for(const side of [-1,1]) {
      for(const zz of [-1.43,1.34]) rod(roof,'#be6944',[x(side*3.01),2.64,z(zz)],[x(side*2),3.76,cz],.075);
    }
    block(details,'#845034',cx,2.56,z(1.34),6.03,.16,.14);
    block(roof,'#97643c',cx,2.52,z(1.46),2.95,.64,.14,-.09);
    cutawaySigns.push(sign(cx,2.535,z(1.55),2.82,.51,'WARUNG','warung',-.09));
    for(const xx of [-2.34,2.34]) {
      rod(roof,'#9d7549',[x(xx),2.18,z(1.24)],[x(xx),1.91,z(2.15)],.047);
      rod(roof,'#8b673f',[x(xx),1.52,z(1.19)],[x(xx),1.94,z(2.10)],.04);
    }
    const start=-2.71, width=5.42, stripes=15;
    for(let i=0;i<stripes;i++) {
      const ax=x(start+width*i/stripes), bx=x(start+width*(i+1)/stripes);
      const shade=i%2 ? '#467e69' : '#f6e6bc';
      const topA=[ax,2.205,z(1.23)],topB=[bx,2.205,z(1.23)];
      const edgeA=[ax,1.955,z(2.13)],edgeB=[bx,1.955,z(2.13)];
      roof.quad(topA,topB,edgeB,edgeA,shade);
      let previous=[ax,1.85,z(2.145)];
      for(let k=1;k<=6;k++){
        const t=k/6;
        const bottom=[lerp(ax,bx,t),1.85-.105*Math.sin(t*Math.PI)**.76,z(2.145)];
        roof.quad([lerp(ax,bx,(k-1)/6),1.955,z(2.13)],[lerp(ax,bx,t),1.955,z(2.13)],bottom,previous,shade);
        previous=bottom;
      }
    }
    for(const xx of [-1.65,1.65]) {
      stick(details,'#74583d',[x(xx),2.48,z(.60)],[x(xx),2.18,z(.60)],.017);
      details.stamp(props.pan,'#e0ac66',x(xx),2.11,z(.60),.17,.13,.17);
      ball(details,'#ffe7a5',x(xx),2.015,z(.60),.07,.085,.07);
    }
    for(const side of [-1,1]) {
      const xx=x(side*2.55);
      for(let cluster=0;cluster<5;cluster++) {
        const advance=cluster*.15, yy=2.57-advance*.17;
        for(let j=0;j<4;j++) {
          const px=xx-side*advance+range(-.04,.04), py=yy-j*range(.060,.092);
          details.stamp(props.oval,pick(['#5b8052','#70904e','#879e58']),px,py,z(1.48+range(-.02,.035)),.065,.093,.041,range(-.3,.3),0,range(-.61,.61));
        }
      }
    }
    // Slim freestanding chalkboard drawn up against the end of the counter.
    const mx=x(2.66), mz=z(1.83);
    block(details,'#8e6142',mx,.67,mz,.72,1.0,.11,-.13);
    sign(mx,.68,mz+.065,.62,.87,'Menu','menu',-.13);
    for(const shift of [-.29,.29]) {
      rod(details,'#94704b',[mx+shift,.06,mz+.12],[mx+shift,1.17,mz-.05],.041);
      rod(details,'#9a7653',[mx+shift,.05,mz-.32],[mx+shift,1.15,mz-.05],.036);
    }
    planter(x(-2.81),z(1.30),.96,true);
    planter(x(2.80),z(-1.62),.89,false,'#c89269');
    obstacle(cx,z(-.965),5.72,.61);
    obstacle(cx,z(.92),5.72,.70);
    obstacle(x(-2.60),z(-.045),.52,1.24);
    obstacle(mx,mz,.76,.52);
    shadows.ellipse(cx,cz+.16,3.28,1.71,.30);
  }
  warung();
  littleShrine(-8.63,-1.72);
  seaGrape(-9.08,-2.02,.83,'#f2ad78');
  seaGrape(-7.97,-1.67,.57,'#f8da9e');
  bananaPlant(-8.09,-4.87,1.42);
  bananaPlant(-2.03,-4.83,1.22);

  function mug(x, y, z, colour, radius = .088) {
    details.stamp(props.pot,colour,x,y+radius,z,radius,radius*1.85,radius);
    disc(details,'#684831',x,y+radius*1.91,z,radius*.76,.014);
    const a=[x+radius*.69,y+radius*1.55,z], b=[x+radius*1.38,y+radius*1.52,z];
    const c=[x+radius*1.38,y+radius*.70,z], d=[x+radius*.66,y+radius*.63,z];
    stick(details,colour,a,b,radius*.17); stick(details,colour,b,c,radius*.17); stick(details,colour,c,d,radius*.17);
  }

  function laptop(x, y, z, mint) {
    const shell = mint ? '#90a59a' : '#a59c88';
    block(details,shell,x,y+.035,z+.085,.72,.062,.46);
    block(details,'#656f66',x,y+.071,z+.04,.54,.013,.18);
    for(let k=0;k<3;k++) {
      const zz=z-.013+k*.049;
      board(details,'#909b8b',x,y+.082,zz,.50,.011,.010);
    }
    block(details,'#b2b6a4',x,y+.073,z+.213,.18,.012,.095);
    const tilt=-.19, cy=y+.26, cz=z-.105;
    block(details,shell,x,cy,cz,.73,.46,.054,tilt);
    // A tiny clay-coloured desktop is visible when you pull up a chair.
    block(details,'#344f4b',x,cy+.003,cz+.030,.65,.37,.012,tilt);
    block(details,mint ? '#7dbdb1' : '#e9b185',x-.023,cy+.007,cz+.038,.49,.25,.013,tilt);
    for(let i=0;i<3;i++) {
      const lineY=cy+.060-i*.047;
      board(details,mint ? '#d8e5bf' : '#fff0cb',x-.085,lineY,cz+.061+(cy-lineY)*.19,.23+i*.035,.016,.009,tilt);
    }
  }

  function stool(x, z, colour, rise=0) {
    for (const dx of [-.17,.17]) {
      for (const dz of [-.14,.14]) rod(details,'#927147',[x+dx*1.3,.035,z+dz*1.3],[x+dx,.44+rise,z+dz],.044);
    }
    for(const side of [-.17,.17]) rod(details,'#ab8858',[x+side,.20+rise*.5,z-.17],[x+side,.20+rise*.5,z+.17],.028);
    block(details,colour,x,.451+rise,z,.53,.115,.46);
    shadows.ellipse(x,z,.47,.37,.20);
  }

  function desk({x, z, mint}) {
    const width=2.45, depth=1.16;
    for(let row=0;row<3;row++) {
      for(let col=0;col<4;col++) {
        const px=x+(col-1.5)*.67+(row%2)*.12, pz=z+(row-1)*.55;
        paving(px,pz,range(.31,.41),range(.24,.33),pick(['#dbbf97','#dfc49b','#e6cca4']),range(-.18,.18));
      }
    }
    for(const side of [-1,1]) {
      const dx=side*(width/2-.22);
      for(const dz of [-.38,.38]) {
        rod(details,'#487262',[x+dx*1.07,.04,z+dz*1.12],[x+dx,.83,z+dz],.065);
      }
      rod(details,'#70907b',[x+dx*1.03,.24,z-.39],[x+dx*1.03,.24,z+.39],.047);
    }
    block(details,'#8f623f',x,.69,z,width-.23,.19,depth-.19);
    for(let k=0;k<4;k++) {
      block(details,['#c18d59','#c99563','#bf8a56','#cca071'][k],x,.844,z-.437+k*.291,width,.14,.282);
    }
    laptop(x,.914,z,mint);
    mug(x+.61,.914,z+.17,mint ? '#e6ae64' : '#69968a',.091);
    block(details,'#e4bf89',x-.72,.940,z-.25,.44,.048,.37,0,-.17);
    block(details,mint ? '#ba6f50' : '#748c77',x-.72,.966,z-.25,.45,.020,.38,0,-.17);
    stick(details,'#5f5546',[x-.87,.990,z-.26],[x-.58,.990,z-.16],.014);
    const vaseX=x+(mint?.88:1.02),vaseZ=z+(mint?-.23:.34);
    details.stamp(props.pot,'#efe1b9',vaseX,1.025,vaseZ,.115,.22,.115);
    stick(details,'#597b50',[vaseX,1.10,vaseZ],[vaseX,1.32,vaseZ-.03],.015);
    blade(details,[vaseX,1.13,vaseZ],.7,.14,.056,.11,.03,'#70926b','#87a466');
    flower(details,vaseX,1.34,vaseZ-.03,.094);
    stool(x,z+1.05,mint ? '#6d937a' : '#d1905c');
    stool(x-.75,z-.90,'#a67e51');
    obstacle(x,z,width,depth,.92);
    obstacle(x-.75,z-.90,.51,.44,.5);
    shadows.ellipse(x,z,1.65,.88,.27);
  }
  for (const workDesk of WORK_DESKS) desk(workDesk);
  stool(-6.42,-1.57,'#bd855b');
  stool(-3.79,-1.55,'#c08b5c');
  obstacle(-6.42,-1.57,.51,.44,.5);
  obstacle(-3.79,-1.55,.51,.44,.5);

  function beachMat(mat, index) {
    const {facing, colour} = mat;
    const c=Math.cos(facing), s=Math.sin(facing);
    const point=(across,height,forward)=>{
      const p=onMat(mat,across,forward);
      return [p.x,height,p.z];
    };
    const matBlock=(tone,across,height,forward,w,h,d)=>{
      const [x,y,z]=point(across,height,forward);
      block(details,tone,x,y,z,w,h,d,0,facing);
    };
    const edge='#dcc18a', honey='#bd985d';
    matBlock('#ba9869',0,.031,0,2.85,.035,1.86);
    matBlock('#ddbc83',0,.052,0,2.82,.025,1.84);
    for(const side of [-1,1]){
      for(const [offset,width,tint] of [[1.32,.10,colour],[1.22,.035,colour],[1.13,.04,'#f6deaa']]) {
        matBlock(tint,side*offset,.070,0,width,.012,1.83);
      }
      for(let j=0;j<18;j++) {
        const z=-.87+j*.103;
        stick(details, j%3===0 ? honey : edge,point(side*1.41,.053,z),point(side*1.50,.033,z+side*.022),.012);
      }
    }
    for(let j=0;j<15;j++) {
      matBlock(j%3 ? '#d3ad76' : '#e8c995',0,.068,-.79+j*.113,2.20,.009,.013);
    }
    for(const across of [-.68,.68]) {
      const p=onMat(mat,across,-.25);
      details.stamp(props.pot,honey,p.x,.202,p.z,.354,.268,.354);
      for (const y of [.105,.16,.215,.274,.318]) disc(details,y>.3?'#b08650':'#d3ad71',p.x,y,p.z,.307+(y-.10)*.205,.026);
      ball(details,colour,p.x,.372,p.z,.363,.101,.342,0,facing);
      ball(details,index ? '#81aa94' : '#d48b65',p.x,.412,p.z,.332,.056,.315,0,facing);
      for(let i=0;i<12;i++){
        const a=TAU*i/12, b=a+.24;
        stick(details,'#b48c56',[p.x+Math.cos(a)*.305,.108,p.z+Math.sin(a)*.305],[p.x+Math.cos(b)*.349,.314,p.z+Math.sin(b)*.349],.010);
      }
      shadows.ellipse(p.x,p.z,.48,.42,.15);
    }
    for(const across of [-.75,.75]) {
      for(const front of [.40,.72]) {
        const a=point(across*1.04,.075,front), b=point(across,.55,front);
        rod(details,'#9b7248',a,b,.047);
      }
    }
    matBlock('#b47e50',0,.563,.56,1.90,.105,.63);
    for(let j=0;j<3;j++) matBlock(j===1?'#cea071':'#c99663',0,.624,.355+j*.204,1.90,.040,.197);
    matBlock('#75938b',-.33,.662,.54,.53,.042,.35);
    matBlock('#617871',-.33,.687,.54,.34,.012,.107);
    function screen(across,w,y0,y1,start,depth,tone) {
      details.quad(point(across-w/2,y0,start),point(across+w/2,y0,start),point(across+w/2,y1,start+depth),point(across-w/2,y1,start+depth),tone);
    }
    screen(-.33,.52,.677,.985,.697,.074,'#71938b');
    screen(-.33,.457,.712,.947,.691,.061,'#345955');
    screen(-.33,.365,.741,.917,.691,.042,index?'#e8ad83':'#9bc2a7');
    const cup=onMat(mat,.15,.72);
    mug(cup.x,.643,cup.z,index?'#dcad6c':'#83a393',.067);
    matBlock('#e1c487',.46,.661,.45,.42,.035,.30);
    matBlock(index?'#81a298':'#c57d56',.46,.686,.45,.42,.014,.30);
    stick(details,'#6e6051',point(.31,.707,.40),point(.58,.707,.49),.011);
    const centre=onMat(mat,0,.56);
    obstacle(centre.x,centre.z,Math.abs(c)*1.86+Math.abs(s)*.58,Math.abs(s)*1.86+Math.abs(c)*.58,1.0);
    shadows.ellipse(centre.x,centre.z,1.03,.41,.17);
  }
  WORK_MATS.forEach(beachMat);
  const setSwimmer=addShoreActivities(T,root,{batch:details,props,block,ball,rod,stick,disc,obstacle,shadows,stool});

  function parasol(x, z, h, radius) {
    rod(details,'#865f3d',[x,.08,z],[x,h+.14,z],.060);
    disc(details,'#c9945a',x,.13,z,.26,.17);
    // A Balinese tedung has a domed scalloped canopy, a carved finial, and hanging fringe.
    const ribs=14, level=[
      [0,.32],[.24,.29],[.59,.18],[.85,.02],[1,-.12],
    ];
    function p(angle,r,y) { return [x+Math.cos(angle)*r*radius,h+y,z+Math.sin(angle)*r*radius]; }
    for(let k=0;k<ribs;k++){
      const a=TAU*k/ribs, b=TAU*(k+1)/ribs, m=(a+b)/2;
      const tone=k%2 ? '#e0a542' : '#edb452';
      const lightTone=k%2 ? '#e9b354' : '#f2c46b';
      for(let j=0;j<level.length-1;j++){
        const [r0,h0]=level[j], [r1,h1]=level[j+1];
        details.quad(p(a,r0,h0),p(m,r0,h0+.013*r0),p(m,r1,h1+.017*r1),p(a,r1,h1),lightTone);
        details.quad(p(m,r0,h0+.013*r0),p(b,r0,h0),p(b,r1,h1),p(m,r1,h1+.017*r1),tone);
      }
      details.quad(p(a,.89,-.018),p(m,.89,0),p(m,.91,-.010),p(a,.91,-.031),'#fff0be');
      details.quad(p(m,.89,0),p(b,.89,-.018),p(b,.91,-.031),p(m,.91,-.010),'#fff0be');
      details.quad(p(a,1,-.12),p(m,1,-.101),p(m,1,-.235),p(a,1,-.17),'#eab054');
      details.quad(p(m,1,-.101),p(b,1,-.12),p(b,1,-.17),p(m,1,-.235),'#e9b252');
      stick(details,'#e9c27a',p(a,.98,-.10),p(a,.99,-.34),.014);
      details.stamp(props.oval,'#f4d28a',...p(a,.99,-.34),.038,.067,.039);
      if(k%2===0) stick(details,'#a78454',[x,h-.63,z],p(a,.75,.060),.021);
    }
    disc(details,'#d9a748',x,h+.35,z,.103,.094);
    ball(details,'#e6ba61',x,h+.45,z,.07,.10,.07);
    disc(details,'#dba743',x,h+.556,z,.034,.10);
    obstacle(x,z,.28,.28);
    shadows.ellipse(x,z,.37,.26,.20);
  }
  parasol(4.98,-4.44,2.64,1.48);

  PALMS.forEach(palm);

  // Compact gardens around the perimeter keep sight lines open in the middle.
  const beds=[
    [-9.43,-1.91,2.25,1.25,8],[-7.65,-5.49,2.52,.85,6],[-3.18,-6.28,1.95,.79,5],
    [.30,-6.55,2.30,.82,8],[7.63,-4.74,1.90,.76,6],[9.71,1.85,1.04,1.67,6],
    [-9.57,2.83,.98,1.42,5],[8.67,3.64,1.02,.68,4],
    [-6.85,5.69,.86,.48,3],[5.91,6.06,.82,.51,3],
  ];
  const stones=['#baac8d','#c4b694','#a7a68d','#d4bf98','#c1ab87'];
  for(const [bx,bz,rx,rz,count] of beds) {
    paving(bx,bz,rx*1.12,rz*1.11,'#d6bd88',range(-.2,.2));
    for(let j=0;j<count;j++){
      const a=j*2.40+range(-.25,.25), r=Math.sqrt(random());
      const px=bx+Math.cos(a)*rx*r, pz=bz+Math.sin(a)*rz*r;
      tropicalPlant(px,.015,pz,range(.34,.76),j%4===0);
    }
    for(let j=0;j<4;j++){
      const a=range(0,TAU);
      landscape.stamp(props.rock,pick(stones),bx+Math.cos(a)*rx,.08,bz+Math.sin(a)*rz,range(.13,.32),range(.08,.19),range(.13,.30),range(-1,1),range(-1,1),range(-1,1));
    }
  }
  for(const [x,z,size,bloom] of [
    [-10.04,2.50,.91,'#f8dcc0'],[-8.99,3.13,.76,'#e6aa8b'],[-7.43,-5.33,1.01,null],
    [-2.56,-5.80,.94,'#f4d493'],[.21,-6.25,1.04,null],[.91,-6.55,.56,'#e6aa79'],
    [7.23,-4.49,.88,'#f6d49d'],[9.20,-3.05,1.12,null],[9.44,1.90,1.03,'#f0b387'],
    [8.88,3.77,.72,null],[-6.86,5.77,.64,'#f7d7a8'],[5.94,6.10,.61,'#f6e0b4'],
  ]) seaGrape(x,z,size,bloom);
  bananaPlant(-1.27,-6.13,1.00);
  bananaPlant(8.62,-4.23,1.43);
  bananaPlant(9.67,2.34,.98);
  for(let i=0;i<68;i++) {
    const a=range(0,TAU), r=range(1.022,1.09)*shoreline(a);
    const h=lerp(-.25,-.63,(r/shoreline(a)-1.022)/.068);
    const scale=sizeAtShore(a)*range(.09,.24);
    landscape.stamp(props.rock,pick(stones),Math.cos(a)*11.7*r,h,Math.sin(a)*8.15*r,scale*1.4,scale*.69,scale,range(.1,1),range(0,TAU),range(-.4,.4));
  }
  function sizeAtShore(a) { return .75+.75*Math.pow(Math.abs(Math.sin(a+.55)),1.8); }

  function pennants() {
    const a=[-2.43,2.64,-4.66], b=[-.66,3.19,-6.41], c=[4.98,2.82,-4.44];
    function string(from,to,n) {
      const p=t=>[lerp(from[0],to[0],t),lerp(from[1],to[1],t)-.29*Math.sin(t*Math.PI),lerp(from[2],to[2],t)];
      for(let i=0;i<14;i++) stick(details,'#927a57',p(i/14),p((i+1)/14),.012);
      for(let i=0;i<n;i++) {
        const t=(i+.5)/n, w=.16/(Math.hypot(to[0]-from[0],to[2]-from[2]));
        const l=p(t-w), r=p(t+w), tip=p(t);
        tip[1]-=.22; tip[2]+=.06;
        details.face(l,r,tip,['#c87552','#e5b75c','#f5dfab','#7c9b80'][i%4]);
      }
    }
    string(a,b,3); string(b,c,7);
  }
  pennants();

  // Far-off headlands are shallow open profiles both to keep their silhouette calm
  // and to keep the horizon out of the way of the little island.
  const distance = makeBatch(T,'Distant Bali headlands');
  const coast = [
    [-42,-31,15,4.4,7,'#8fae9c'],[-27,-40,17,5.8,6,'#98b6a3'],
    [-8,-49,20,5.6,8,'#abc2ac'],[11,-48,15,4.0,6,'#a6bda7'],
    [27,-34,10,3.9,5,'#94b19b'],[39,-26,14,5.2,6,'#87a99a'],
  ];
  for(const [hx,hz,rx,hy,rz,tone] of coast) {
    let previous=null;
    const peak=range(-.27,.27);
    for(let i=0;i<=24;i++) {
      const t=i/24*2-1;
      const height=hy*Math.max(0,1-Math.abs(t-peak)*.92)**1.45 * (1+.11*Math.sin(t*8)) + range(-.18,.18);
      const xx=hx+t*rx;
      const ridge=[xx,height-.68,hz+Math.sin(t*3)*rz*.3];
      const foot=[xx,-.75,hz+rz*(.48+.29*Math.sin((t+.3)*Math.PI))];
      if(previous) distance.quad(previous.foot,foot,ridge,previous.ridge,tone);
      previous={ridge,foot};
    }
  }
  const oceanHills=distance.finish(grain,root,false);
  // Keep the painted headlands beyond the navigable water in every direction.
  oceanHills.scale.setScalar(4);
  oceanHills.position.y=WATER_Y*(1-oceanHills.scale.y);
  oceanHills.receiveShadow=false;

  // Everything below draws from the shared random stream after the existing art,
  // so adding it leaves every earlier plant and pebble where it was.
  const lawns = makeLawns(T, random);
  // The padel spit is lawn almost to the waterline. Smaller lawns sit behind the warung and the tables.
  lawns.patch(16.4,.6,7.6,7.2,{limit:.88});
  lawns.patch(9.0,-4.1,2.8,1.9,{angle:-.2,limit:.86});
  lawns.patch(-7.6,-1.2,3.4,3.0,{angle:.25,limit:.86});
  lawns.patch(-1.4,-5.2,3.0,1.5,{angle:.1,limit:.85});
  lawns.patch(1.6,-4.85,2.4,1.25,{angle:-.15,limit:.85});

  function bush(x, z, size, bloom = null) {
    const greens = ['#4f7c4f','#5d8954','#6b9358','#7a9d5d'];
    const lumps = [];
    for (let k = 0; k < 7; k++) {
      const a = k * 2.4 + range(-.3,.3), r = k ? size * range(.26,.40) : 0;
      const radius = size * (k ? range(.26,.36) : .42);
      const lx = x + Math.cos(a)*r, lz = z + Math.sin(a)*r, ly = k ? radius*range(.85,1.15) : size*.46;
      lumps.push([lx,ly,lz,radius]);
      ball(details, k ? pick(greens) : greens[1], lx, ly, lz, radius, radius*.86, radius, 0, a, 0);
    }
    if (bloom) {
      const light = '#' + new T.Color(bloom).lerp(new T.Color('#fff4dc'),.35).getHexString();
      for (let k = 0; k < 12; k++) {
        const [lx,ly,lz,r] = lumps[1 + k % 6], a = range(0,TAU), up = range(.2,.9), out = Math.sqrt(1-up*up);
        const dot = size * range(.085,.115);
        details.stamp(props.oval, k%3 ? bloom : light, lx+Math.cos(a)*out*r, ly+up*r*.86, lz+Math.sin(a)*out*r, dot, dot*.62, dot, 0, a, 0);
      }
    }
    obstacle(x,z,size*1.2,size*1.2,size*.95);
    shadows.ellipse(x,z,size*.95,size*.8,.22);
  }

  // Frangipani: a pale forked trunk with leaf rosettes and cream flowers at each tip.
  function frangipani(x, z, size) {
    const fork = [x + .05*size, .85*size, z];
    rod(details,'#9d8a72',[x,0,z],fork,.075*size);
    disc(details,'#8d7a63',x,.04,z,.11*size,.08);
    for (let k = 0; k < 4; k++) {
      const a = k*TAU/4 + range(-.4,.4) + .3;
      const mid = [fork[0]+Math.cos(a)*.32*size, fork[1]+.38*size, fork[2]+Math.sin(a)*.32*size];
      const tip = [fork[0]+Math.cos(a)*.62*size, fork[1]+range(.62,.85)*size, fork[2]+Math.sin(a)*.62*size];
      rod(details,'#9d8a72',fork,mid,.05*size);
      rod(details,'#b09b7f',mid,tip,.036*size);
      for (let j = 0; j < 7; j++) {
        blade(details,tip,j*TAU/7+range(-.2,.2),size*range(.34,.46),size*.09,size*.10,size*.17,'#567f4d','#6f9556');
      }
      for (let j = 0; j < 3; j++) {
        flower(details,tip[0]+range(-.09,.09)*size,tip[1]+.07*size,tip[2]+range(-.09,.09)*size,.10*size,j%2 ? '#fff3d8' : '#fbe4bd');
      }
    }
    obstacle(x,z,.36*size,.36*size);
    shadows.ellipse(x+.1,z,.95*size,.8*size,.20);
  }

  // A slatted bench along z, facing east toward the court.
  function bench(x, z) {
    for (const dz of [-.55,.55]) block(details,'#77472f',x,.20,z+dz,.36,.40,.09);
    block(details,'#9c6440',x,.40,z,.44,.05,1.40);
    for (const dx of [-.13,0,.13]) board(details,'#b97c4c',x+dx,.44,z,.11,.035,1.38);
    for (const dz of [-.55,.55]) block(details,'#77472f',x-.2,.62,z+dz,.06,.48,.08,0,0,.14);
    block(details,'#b97c4c',x-.23,.74,z,.05,.17,1.38,0,0,.14);
    obstacle(x,z,.5,1.46,.8);
    shadows.ellipse(x,z,.42,.80,.22);
  }

  // The padel lawn: stepping stones to the west gate, a bench, shade trees and hedging.
  for (let i = 0; i < 6; i++) {
    const t = i/5;
    paving(lerp(10.55,13.75,t),1.04+.16*Math.sin(t*Math.PI*1.4),range(.30,.38),range(.21,.27),pick(['#e3cfa6','#d9c39a','#e9d5ae']),range(-.4,.4));
  }
  bench(COURT_BENCH.x,COURT_BENCH.z);
  frangipani(12.75,3.45,1.1);
  frangipani(20.5,.75,.85);
  for (const [x,z,size,bloom] of [
    [15.0,-3.85,.75,null],[16.25,-3.62,.6,'#d98a9a'],[13.85,-4.75,.68,null],
    [13.3,4.65,.72,'#d98a9a'],[12.15,5.15,.55,null],
    [20.15,-1.2,.5,null],[20.0,2.6,.58,'#e89c7c'],
    [10.9,4.95,.62,'#e89c7c'],[11.65,5.4,.45,null],[15.55,5.25,.42,'#d98a9a'],
  ]) bush(x,z,size,bloom);
  tropicalPlant(18.55,.015,-3.35,.55);
  tropicalPlant(14.25,.015,5.3,.5,true);
  tropicalPlant(17.9,.015,4.95,.45);

  // Grass tufts gather toward each lawn's rim and break up its outline.
  const tuftTones = [['#6f8f51','#93ae66'],['#7c9a57','#a7bb72'],['#6a8a52','#8aa75e']];
  const keepClear = [
    { x:PADEL.x, z:PADEL.z, w:4.9, d:7.5 },
    { x:12.15, z:1.04, w:3.9, d:.85 },
    WARUNG_FOOTPRINT,
    ...WORK_DESKS.map(({x,z}) => ({ x, z, w:3.0, d:2.0 })),
  ];
  const clearAt = (x, z) => beachRadius(x,z) < .86 &&
    !keepClear.some(o => Math.abs(x-o.x) < o.w/2 && Math.abs(z-o.z) < o.d/2) &&
    !obstacles.some(o => Math.abs(x-o.x) < o.w/2+.12 && Math.abs(z-o.z) < o.d/2+.12);
  function tuft(x, z, size) {
    const [base, tip] = pick(tuftTones);
    for (let k = 0, blades = 4 + Math.floor(random()*3); k < blades; k++) {
      const a = range(0,TAU), h = size*range(.7,1.15), lean = range(.15,.45)*h, w = size*.07;
      const bx = x + Math.cos(a)*size*.18, bz = z + Math.sin(a)*size*.18;
      const sx = -Math.sin(a)*w, sz = Math.cos(a)*w;
      landscape.face([bx-sx,.004,bz-sz],[bx+sx,.004,bz+sz],[bx+Math.cos(a)*lean,h,bz+Math.sin(a)*lean],[base,base,tip]);
    }
  }
  for (const { cx, cz, rx, rz, sides, reach } of lawns.patches) {
    for (let n = Math.round(rx*rz*8); n > 0; n--) {
      const i = Math.floor(random()*sides), f = random() < .6 ? range(.62,1.02) : Math.sqrt(random())*.62;
      const a = TAU*i/sides + range(-.04,.04);
      const x = cx + Math.cos(a)*reach[i]*f, z = cz + Math.sin(a)*reach[i]*f;
      if (clearAt(x,z)) tuft(x,z,range(.12,.22)*(f > .9 ? .8 : 1));
    }
  }
  lawns.finish(root);

  landscape.finish(grain,root,false);
  details.finish(clay,root);
  const roofClay = clay.clone();
  roofClay.transparent = true;
  roof.finish(roofClay,root);
  const cutawayMaterials = [roofClay, ...cutawaySigns.map(mesh => mesh.material)];
  for (const material of cutawayMaterials) material.transparent = true;
  let cutaway = 0;
  shadows.finish(root);
  for(const geometry of Object.values(props)) geometry.dispose();
  return {
    obstacles, seats:SEATS, setSwimmer,
    update(t) { for (const animate of animated) animate(t); },
    // 0 is a clear day. Toward 1 the sky greys, the haze thickens and the sun softens for a shower.
    setWeather(rain) {
      const w = Math.min(1, rain) * .8;
      if (Math.abs(w - weather) < .002) return;
      weather = w;
      scene.background.copy(clearSky).lerp(showerSky, w);
      scene.fog.color.copy(clearHaze).lerp(showerHaze, w);
      scene.fog.density = .009 + .011 * w;
      sky.intensity = 1.67 - .50 * w;
      sunlight.intensity = 2.14 - 1.20 * w;
    },
    // Fades toward 1 while the local player is inside; snaps with dt = 0.
    setCutaway(target, dt) {
      if (cutaway === target) return;
      cutaway = dt ? cutaway + (target - cutaway) * (1 - Math.exp(-dt * 7)) : target;
      if (Math.abs(cutaway - target) < .003) cutaway = target;
      for (const material of cutawayMaterials) material.opacity = 1 - cutaway * .84;
    },
  };
}
