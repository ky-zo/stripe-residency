import { clayStudio } from './clay-mesh.js';

const libraries = new WeakMap();
const tau = Math.PI * 2;
const honey = '#d98e48', cream = '#ffedcc', cocoa = '#62433c';
const espresso = '#352d30';

function smooth(a, b, value) {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function spot(T, part, radii, head, direction, width, height, phase) {
  const center = new T.Vector3(...direction).normalize();
  const right = new T.Vector3(center.z, 0, -center.x).normalize();
  const up = new T.Vector3().crossVectors(center, right), p = new T.Vector3(), normal = new T.Vector3();
  const vertices = [], normals = [], faces = [], sides = 44, levels = 7;
  const [rx, ry, rz] = radii;
  for (let i = 0; i <= levels; i++) for (let j = 0; j < sides; j++) {
    const angle = tau * j / sides, t = i / levels;
    const reach = t * (1 + .075 * Math.cos(3 * angle + phase) + .044 * Math.sin(2 * angle - .7));
    p.copy(center).addScaledVector(right, width * reach * Math.cos(angle))
      .addScaledVector(up, height * reach * Math.sin(angle)).normalize();
    const cheek = head ? 1 + .075 * Math.exp(-((p.y + .30) ** 2) / .10) : 1;
    normal.set(p.x / (rx * cheek), p.y / ry, p.z / rz).normalize();
    vertices.push(p.x * rx * cheek + normal.x * .0014, p.y * ry + normal.y * .0014, p.z * rz + normal.z * .0014);
    normals.push(normal.x, normal.y, normal.z);
    if (i < levels) {
      const a = i * sides + j, b = i * sides + (j + 1) % sides;
      if (i > 0) faces.push(a, a + sides, b);
      faces.push(b, a + sides, b + sides);
    }
  }
  part.surface(cocoa, vertices, faces, null, normals);
}

// Paint follows the curved coat, including the far side of each figure.
function coat(T, part, radii, corgi, head) {
  const base = new T.Color(corgi ? honey : '#f4e6ca');
  const shade = new T.Color(corgi ? '#b96e3e' : cocoa);
  const light = new T.Color(cream), color = new T.Color();
  const points = [], normals = [], tints = [], faces = [];
  const sides = head && corgi ? 48 : 36, rings = head && corgi ? 29 : 21;
  const [rx, ry, rz] = radii;
  for (let i = 0; i <= rings; i++) {
    const v = Math.PI * i / rings, y = Math.cos(v), ring = Math.sin(v);
    for (let j = 0; j < sides; j++) {
      const u = tau * j / sides, x = ring * Math.sin(u), z = ring * Math.cos(u);
      const cheek = head ? 1 + .075 * Math.exp(-((y + .30) ** 2) / .10) : 1;
      points.push(x * rx * cheek, y * ry, z * rz);
      const nx = x / (rx * cheek), ny = y / ry, nz = z / rz;
      const length = Math.hypot(nx, ny, nz);
      normals.push(nx / length, ny / length, nz / length);
      color.copy(base);
      if (corgi && head) {
        const blazeWidth = .21 - .12 * smooth(.02, .75, y) + .03 * Math.sin(y * 5);
        const blaze = smooth(blazeWidth + .045, blazeWidth - .035, Math.abs(x - .028 * y)) * smooth(.34, .56, z);
        const cheeks = smooth(-.12, -.26, y + .095 * Math.cos(u * 4) - .07 * z);
        color.lerp(light, Math.max(blaze, cheeks));
      } else if (corgi) {
        color.lerp(shade, .34 * smooth(.04, .72, y - .21 * z));
        const bib = smooth(.50, .66, z - .42 * y + .035 * Math.cos(x * 8));
        color.lerp(light, Math.max(bib, smooth(-.37, -.54, y)));
      }
      tints.push(color.r, color.g, color.b);
      if (i === rings) continue;
      const a = i * sides + j, b = i * sides + (j + 1) % sides;
      if (i > 0) faces.push(a, a + sides, b);
      if (i < rings - 1) faces.push(b, a + sides, b + sides);
    }
  }
  part.surface(null, points, faces, tints, normals);
  if (!corgi && head) spot(T, part, radii, true, [-.54,.19,.82], .66, .74, 1.2);
  if (!corgi && !head) {
    spot(T, part, radii, false, [.48,.34,-.83], 1.08, .98, 2.3);
    spot(T, part, radii, false, [-.86,.26,.42], .51, .54, -.6);
  }
}

function corgiEar(part, side) {
  const rows = [
    [-.035, .062, .037, -.006, 0], [-.015, .077, .043, -.003, 0],
    [.015, .078, .043, .004, 0], [.055, .066, .037, .016, -.005],
    [.094, .051, .027, .030, -.010], [.133, .031, .019, .046, -.014],
    [.157, .015, .011, .053, -.011], [.166, .003, .004, .051, -.008]
  ];
  part.loft(honey, rows.map(([y, x, z, cx, cz]) => [y, x, z, side * cx, cz]), 22);
  const vertices = [], faces = [], widths = [.10, .63, .70, .65, .46, .10];
  const inset = rows.slice(1, 7), cols = 8;
  inset.forEach(([y, rx, rz, cx, cz], i) => {
    for (let j = 0; j <= cols; j++) {
      const f = (2 * j / cols - 1) * widths[i];
      vertices.push(side * cx + f * rx, y, cz + rz * Math.sqrt(1 - f * f) + .0018);
      if (i < inset.length - 1 && j < cols) {
        const a = i * (cols + 1) + j, b = a + cols + 1;
        faces.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  });
  part.surface('#d68c79', vertices, faces);
}

function floppyEar(part, side) {
  const color = side < 0 ? cocoa : '#b37655';
  part.loft(color, [
    [-.187,.013,.022,side*.050,.044],[-.179,.029,.046,side*.058,.041],
    [-.153,.042,.069,side*.064,.038],[-.114,.049,.076,side*.063,.026],
    [-.058,.050,.066,side*.048,.010],[-.016,.044,.056,side*.022,-.001],
    [.016,.034,.044,side*.004,-.008],[.029,.015,.023,-side*.005,-.009]
  ], 18);
}

function muzzle(part, corgi) {
  const front = corgi ? .151 : .141;
  if (corgi) {
    part.oval('#755047', 0, -.071, front + .014, .048, .024, .027);
    part.dot('#df8b82', .009, -.084, front + .026, .022, .017, .018);
  }
  for (const side of [-1, 1]) {
    part.oval(cream, side * .034, -.042, front, .063, .049, .062, [0, side * .11, side * .07]);
    for (const [x, y, z] of [[.042,-.049,.059],[.063,-.047,.054],[.052,-.061,.053]]) {
      part.dot('#b28b68', side * x, y, front + z, .0038, .0036, .003);
    }
    if (!corgi) {
      const smile = [[0,-.055],[.013,-.065],[.032,-.068],[.054,-.057]].map(([x,y]) => {
        const depth = .062 * Math.sqrt(Math.max(0, 1 - ((x-.034)/.063)**2 - ((y+.042)/.049)**2));
        return [side*x, y, front + depth + .002];
      });
      part.stroke('#76584c', smile, .0031, .24, 8, 5);
    }
  }
  part.loft(espresso, [
    [-.044,.009,.009,0,front+.054],[-.039,.020,.013,0,front+.058],
    [-.027,.034,.020,0,front+.061],[-.018,.035,.019,0,front+.061],
    [-.011,.027,.015,0,front+.057],[-.008,.014,.009,0,front+.055]
  ], 16);
  part.dot('#796762', -.010, -.017, front + .076, .007, .003, .003);
}

function faceEyes(part, corgi) {
  for (const side of [-1, 1]) {
    const x = side * (corgi ? .083 : .078), z = corgi ? .137 : .132;
    part.dot(espresso, x, 0, z, .021, .027, .019, [0, side * .24, 0]);
    part.dot('#fff6db', x - .004, .008, z + .016, .0053);
  }
}

function tail(T, part, corgi) {
  const points = corgi ? [[0,-.012,.022],[.008,.016,-.023],[.012,.056,-.068],[.016,.103,-.080],[.009,.130,-.068]] :
    [[0,-.006,.016],[.002,.012,-.032],[.017,.040,-.084],[.031,.090,-.119],[.026,.145,-.125],[.005,.178,-.098]];
  const curve = new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p)));
  const rings = 15, sides = 14, frames = curve.computeFrenetFrames(rings, false);
  const verts = [], normals = [], colors = [], faces = [];
  const start = new T.Color(corgi ? honey : cocoa), tip = new T.Color(cream), col = new T.Color();
  const delta = new T.Vector3();
  for (let i = 0; i <= rings; i++) {
    const t = i / rings, center = curve.getPointAt(t);
    const r = corgi ? .005 + .051 * Math.sin(Math.PI * (.22 + .78 * t)) ** .67 : .005 + .029 * (1 - t ** 2);
    col.copy(start).lerp(tip, smooth(corgi ? .48 : .62, corgi ? .59 : .72, t));
    for (let j = 0; j < sides; j++) {
      const a = tau * j / sides;
      delta.copy(frames.normals[i]).multiplyScalar(Math.cos(a)).addScaledVector(frames.binormals[i], Math.sin(a));
      verts.push(center.x + r * delta.x, center.y + r * delta.y, center.z + r * delta.z);
      normals.push(delta.x, delta.y, delta.z); colors.push(col.r, col.g, col.b);
      if (i < rings) {
        const first = i * sides + j, next = i * sides + (j + 1) % sides;
        faces.push(first, next, first + sides, next, next + sides, first + sides);
      }
    }
  }
  part.surface(null, verts, faces, colors, normals);
  const end = points.at(-1);
  part.dot(cream, ...end, .006);
}

function paw(part, corgi, side, rear) {
  const hip = corgi ? .147 : .165, color = corgi ? honey : rear && side > 0 ? cocoa : '#ebd8b7';
  part.oval(color, 0, -.024, -.004, corgi ? .056 : .043, .088, rear ? .072 : .052, [rear ? -.18 : .04, 0, 0]);
  const foot = corgi ? .056 : .047;
  part.loft(cream, [
    [-hip+.004,foot*.67,.048,0,.020],[-hip+.009,foot*.96,.059,0,.021],
    [-hip+.024,foot,.065,0,.024],[-hip+.043,foot*.92,.058,0,.020],
    [-hip+.067,foot*.75,.041,0,.009],[-hip+.084,foot*.55,.029,0,.002]
  ], 16);
  for (const toe of [-1, 1]) {
    part.stroke('#d5bea1', [[toe*.014,-hip+.033,.082],[toe*.016,-hip+.027,.087],[toe*.017,-hip+.021,.087]], .0022, .25, 4, 4);
  }
}

function neckwear(part, corgi) {
  if (corgi) {
    part.oval('#578b7b', 0,.052,.16,.148,.094,.123,[-.22,0,0]);
    part.loft('#639d85', [[-.052,.003,.004, .013,.243],[-.020,.035,.011,.010,.254],
      [.034,.102,.021,.003,.258],[.059,.114,.022,0,.241],[.078,.115,.020,0,.220]], 20);
    part.dot('#e6c38b', .017,-.012,.265,.006);
  } else {
    part.oval('#b96554', 0,.048,.128,.130,.074,.110,[-.24,0,0]);
    part.dot('#c48748', 0,.008,.233,.029,.031,.010);
    part.dot('#f2c671', 0,.010,.239,.022,.024,.006);
  }
}

// The coat, face, paws and accessories share one skinned mesh and one material per puppy.
function makePattern(T, corgi) {
  const studio = clayStudio(T), part = new studio.Part(), joints = [], ids = [];
  function joint(name, parent, at, draw) {
    const origin = at.map((value, i) => value + (joints[parent]?.origin[i] || 0));
    const index = joints.push({ name, parent, at, origin }) - 1;
    const before = part.positions.length;
    draw(part);
    for (let i = before; i < part.positions.length; i += 3) {
      part.positions[i] += origin[0]; part.positions[i + 1] += origin[1]; part.positions[i + 2] += origin[2];
      ids.push(index);
    }
    return index;
  }
  const bodyY = corgi ? .227 : .219;
  const body = joint('Body', -1, [0, bodyY, corgi ? -.050 : -.032], p => {
    coat(T, p, corgi ? [.177,.151,.287] : [.151,.129,.239], corgi, false);
    neckwear(p, corgi);
  });
  const head = joint('Head', body, [0, corgi ? .165 : .154, corgi ? .217 : .187], p => {
    coat(T, p, corgi ? [.185,.157,.155] : [.171,.152,.148], corgi, true);
    muzzle(p, corgi);
    if (corgi) for (const side of [-1, 1]) p.dot('#edbb84', side*.100,.069,.111,.025,.011,.014,[0,side*.33,side*.19]);
  });
  joint('Eyes', head, [0,.025,0], p => faceEyes(p, corgi));
  for (const side of [-1,1]) joint(side < 0 ? 'Left ear' : 'Right ear', head,
    [side * (corgi ? .110 : .142), corgi ? .111 : .081, corgi ? -.020 : -.010], p => corgi ? corgiEar(p, side) : floppyEar(p, side));
  joint('Tail', body, [0,.019,corgi ? -.244 : -.202], p => tail(T, p, corgi));
  for (const rear of [false, true]) for (const side of [-1,1]) {
    const x = corgi ? .106 : .088, hipY = corgi ? .147 : .165;
    const z = rear ? (corgi ? -.173 : -.143) : (corgi ? .151 : .135);
    joint((rear ? 'Rear' : 'Front') + (side < 0 ? ' left paw' : ' right paw'), body, [x * side, hipY - bodyY, z], p => paw(p, corgi, side, rear));
  }
  const geometry = part.finish(), skin = new Uint8Array(ids.length * 4), weights = new Uint8Array(skin.length);
  ids.forEach((id, i) => { skin[i * 4] = id; weights[i * 4] = 255; });
  geometry.setAttribute('skinIndex', new T.Uint8BufferAttribute(skin, 4));
  geometry.setAttribute('skinWeight', new T.Uint8BufferAttribute(weights, 4, true));
  return { geometry, joints, material: studio.clay };
}

function puppy(T, pattern, corgi) {
  const { geometry, material, joints } = pattern;
  const name = corgi ? 'PowPow2' : 'Poopi', root = new T.Group();
  root.name = name;
  const mesh = new T.SkinnedMesh(geometry, material), bones = [];
  mesh.name = name + ' clay puppy'; mesh.castShadow = true; mesh.receiveShadow = true;
  root.add(mesh);
  for (const joint of joints) {
    const bone = new T.Bone(); bone.name = joint.name; bone.position.set(...joint.at);
    (bones[joint.parent] || mesh).add(bone); bones.push(bone);
  }
  mesh.bind(new T.Skeleton(bones));
  mesh.boundingSphere = new T.Sphere(new T.Vector3(0,.30,0), .62);
  const [body, head, eyes, leftEar, rightEar, tailBone, ...legs] = bones;
  const footfall = [0, Math.PI, Math.PI + .18, .18];
  const hip = corgi ? .147 : .165, pawWidth = corgi ? .056 : .047;
  function animate(timeSeconds = 0, moving = false) {
    const t = timeSeconds + (corgi ? .7 : 2.8);
    const run = T.MathUtils.clamp(Number(moving) || 0, 0, 1), idle = 1 - run;
    const phase = t * (corgi ? 12.8 : 14.3), breath = Math.sin(t * 2.5);
    const nose = Math.max(0, Math.sin(t * .78)) ** 4 * idle;
    const bounce = .012 * run * (1 - Math.cos(phase * 2));
    body.position.y = joints[0].at[1] + bounce + .0017 * breath * idle;
    body.rotation.x = -.027 * Math.sin(phase * 2) * run;
    body.rotation.z = .028 * Math.sin(phase) * run;
    head.position.y = joints[1].at[1] - .042 * nose;
    head.rotation.set(.32 * nose + .047 * nose * Math.sin(t * 9.7) + .052 * run * Math.cos(phase * 2),
      .12 * Math.sin(t * 1.19) * idle + .034 * Math.sin(phase) * run, (corgi ? .050 : -.074) + .052 * Math.sin(t * .94) * idle);
    const lid = t % (corgi ? 4.05 : 3.71);
    eyes.scale.y = lid < .14 ? .12 + .88 * Math.abs(lid - .07) / .07 : 1;
    const flap = run * Math.sin(phase - .55) * (corgi ? .070 : .26);
    leftEar.rotation.z = -flap - .052 * Math.sin(t * 1.7) * idle;
    rightEar.rotation.z = flap + .040 * Math.sin(t * 1.53 + 1) * idle;
    leftEar.rotation.x = rightEar.rotation.x = run * Math.cos(phase - .40) * (corgi ? .036 : .15);
    tailBone.rotation.y = Math.sin(t * (corgi ? 9.1 : 8.1)) * (.52 + .25 * run);
    tailBone.rotation.x = .098 * Math.sin(t * 4.1) + .09 * run;
    const cp = Math.cos(body.rotation.x), ux = cp * Math.sin(body.rotation.z);
    const uy = cp * Math.cos(body.rotation.z), uz = -Math.sin(body.rotation.x);
    legs.forEach((leg, i) => {
      const swing = phase + footfall[i];
      const stride = Math.sin(swing) * run, angle = -(corgi ? .68 : .76) * stride;
      const flight = Math.max(0, Math.cos(swing));
      leg.rotation.x = angle;
      // The lowest point moves from heel to toe as a planted paw rolls through its stride.
      const c = Math.cos(angle), s = Math.sin(angle), py = uy * c + uz * s, pz = uz * c - uy * s;
      const sole = Math.min(
        py * (.004 - hip) + pz * .020 - Math.hypot(ux * pawWidth * .67, pz * .048),
        py * (.009 - hip) + pz * .021 - Math.hypot(ux * pawWidth * .96, pz * .059),
        py * (.024 - hip) + pz * .024 - Math.hypot(ux * pawWidth, pz * .065)
      );
      const targetY = .003 + run * .037 * flight ** 2;
      leg.position.y = (targetY - body.position.y - ux * leg.position.x - uz * leg.position.z - sole) / uy;
    });
  }
  animate(0, false);
  return { name, root, animate };
}

// Both ground pivots sit between the four paws. Local forward is +Z.
export function createIslandDogs(T) {
  if (!libraries.has(T)) libraries.set(T, [makePattern(T, true), makePattern(T, false)]);
  return libraries.get(T).map((pattern, i) => puppy(T, pattern, i === 0));
}
