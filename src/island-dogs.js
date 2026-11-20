import { clayStudio } from './clay-mesh.js';

const libraries = new WeakMap();
const tau = Math.PI * 2;
// Both puppies share Poopi's apricot coat.
const apricot = '#c38a66', deepApricot = '#ad7352';
const lightApricot = '#dcab88', espresso = '#302729';

function smooth(a, b, value) {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// Short, curved fibres in one tile. Mipmaps average the relief when the dogs are far away.
function plushClay(T) {
  const size = 96, values = new Float32Array(size * size);
  let seed = 2371;
  const random = () => ((seed = (Math.imul(seed,1664525) + 1013904223) >>> 0) / 4294967296);
  for (let strand = 0; strand < 410; strand++) {
    const x = random()*size, y = random()*size, angle = -.55 + .9*(random()-.5);
    const length = 3 + 6*random(), curl = (random()-.5)*2.3;
    for (let n = 0; n <= 16; n++) {
      const t = n/16, arc = curl*Math.sin(Math.PI*t);
      const px = x + t*length*Math.cos(angle) - arc*Math.sin(angle);
      const py = y + t*length*Math.sin(angle) + arc*Math.cos(angle);
      const ix = Math.floor(px), iy = Math.floor(py), fx = px-ix, fy = py-iy;
      for (let j=0; j<2; j++) for (let i=0; i<2; i++) {
        const at = ((iy+j+size)%size)*size + (ix+i+size)%size;
        values[at] += Math.sin(Math.PI*t) * (i ? fx : 1-fx) * (j ? fy : 1-fy);
      }
    }
  }
  const pixels = new Uint8Array(size*size*4);
  values.forEach((value,i) => {
    const tone = Math.round(210 + 45*(1-Math.exp(-value*.74)));
    pixels.set([tone,tone,tone,255],i*4);
  });
  // Untextured parts sample a white corner so the metal tag and eye glints keep their finish.
  for (const i of [0,size-1,size*(size-1),size*size-1]) pixels.fill(255,i*4,i*4+4);
  const grain = new T.DataTexture(pixels,size,size,T.RGBAFormat);
  grain.wrapS = grain.wrapT = T.RepeatWrapping;
  grain.generateMipmaps = true; grain.minFilter = T.LinearMipmapLinearFilter; grain.magFilter = T.LinearFilter;
  grain.needsUpdate = true;
  const material = clayStudio(T).clay.clone();
  material.roughness = .92; material.map = grain; material.bumpMap = grain; material.bumpScale = .016;
  return material;
}

function spot(T, part, radii, head, direction, width, height, phase) {
  const center = new T.Vector3(...direction).normalize();
  const right = new T.Vector3(center.z, 0, -center.x).normalize();
  const up = new T.Vector3().crossVectors(center, right), p = new T.Vector3(), normal = new T.Vector3();
  const vertices = [], normals = [], faces = [], sides = 34, levels = 6;
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
  part.surface(deepApricot, vertices, faces, null, normals);
}

// A few overlapping, rounded locks follow the grain of the coat. Their roots tuck under the clay.
function fur(T, part, radii, corgi, head) {
  const [rx, ry, rz] = radii;
  const unit = new T.Vector3(), normal = new T.Vector3(), center = new T.Vector3(), across = new T.Vector3();
  const tangent = new T.Vector3(), point = new T.Vector3(), bent = new T.Vector3(), axes = new T.Vector3(rx,ry,rz);
  function shell(dir, out, n) {
    const cheek = head ? 1 + .075 * Math.exp(-((dir.y + .30) ** 2) / .10) : 1;
    out.set(dir.x * rx * cheek, dir.y * ry, dir.z * rz);
    n.set(dir.x / (rx * cheek), dir.y / ry, dir.z / rz).normalize();
  }
  function lock(color, directions, width, height, side = 1) {
    const path = new T.CatmullRomCurve3(directions.map(([x,y,z]) => new T.Vector3(side*x,y,z).normalize()));
    const verts = [], norms = [], faces = [], rows = 7, cols = 6;
    for (let i=0; i<=rows; i++) {
      const t=i/rows, round=Math.sin(Math.PI*t)**.72, spread=width*(.16+.84*round);
      path.getPoint(t,unit).normalize(); shell(unit,center,normal);
      path.getTangent(t,tangent).multiply(axes).normalize();
      across.crossVectors(normal,tangent).normalize();
      const cheek = head ? 1 + .075 * Math.exp(-((unit.y + .30) ** 2) / .10) : 1;
      for (let j=0; j<=cols; j++) {
        const s=2*j/cols-1, crest=height*round*(.68+.26*t), profile=1-s*s;
        point.copy(center).addScaledVector(across,s*spread);
        bent.set(point.x/(rx*cheek),point.y/ry,point.z/rz).normalize(); shell(bent,point,normal);
        point.addScaledVector(normal,crest*profile*profile-.0016);
        normal.addScaledVector(across,4*s*profile*crest/spread).normalize();
        verts.push(point.x,point.y,point.z); norms.push(normal.x,normal.y,normal.z);
        if (i<rows && j<cols) {const a=i*(cols+1)+j, b=a+cols+1;faces.push(a,b,a+1,a+1,b,b+1);}
      }
    }
    part.surface(color,verts,faces,null,norms);
  }
  const warm = '#c7906c', soft = '#cd9874';
  if (head) {
    lock(soft, [[-.32,.78,.58],[-.27,.90,.37],[-.09,1,.18],[.15,1,.08]], .032,.018);
    lock(warm, [[-.01,.80,.58],[.08,.94,.33],[.22,1,.11],[.33,.90,-.14]], .029,.010);
    if (!corgi) lock(warm, [[-.63,.76,.33],[-.49,.92,.20],[-.28,.97,.10],[-.18,.97,-.14]], .026,.011);
    for (const side of [-1, 1]) {
      const color = !corgi && side < 0 ? '#b27a57' : warm;
      lock(color, [[.76,.16,.62],[.89,.08,.45],[.99,-.11,.25],[.99,-.31,.05]], .025,.011,side);
      if (corgi) lock(warm, [[.77,-.16,.61],[.90,-.25,.43],[.98,-.39,.23],[.90,-.52,.08]], .024,.010,side);
    }
  } else {
    for (const side of [-1,1]) {
      const shoulder = !corgi && side < 0 ? '#b27a57' : warm;
      lock(shoulder, [[.69,.51,.52],[.79,.47,.41],[.89,.32,.28],[.95,.20,.23]], .030,.012,side);
      lock(shoulder, [[.82,.12,.54],[.90,.20,.42],[.95,.12,.33],[.97,.05,.25]], .028,.010,side);
      const rump = !corgi && side > 0 ? '#b27a57' : warm;
      lock(rump, [[.66,.56,-.50],[.77,.43,-.55],[.80,.27,-.61],[.72,.05,-.72]], .027,.011,side);
    }
  }
}

// Paint follows the curved coat, including the far side of each figure.
function coat(T, part, radii, corgi, head) {
  const base = new T.Color(apricot), shade = new T.Color(deepApricot);
  const light = new T.Color(lightApricot), color = new T.Color();
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
        const blazeWidth = .13 - .075 * smooth(.02, .75, y) + .018 * Math.sin(y * 5);
        const blaze = smooth(blazeWidth + .04, blazeWidth - .03, Math.abs(x - .028 * y)) * smooth(.48,.67,z) * smooth(.82,.64,y);
        const cheeks = smooth(-.36,-.62, y + .07 * Math.cos(u * 4) - .05 * z);
        color.lerp(light, Math.max(.69 * blaze, .35 * cheeks));
      } else if (corgi) {
        color.lerp(shade, .34 * smooth(.04, .72, y - .21 * z));
        const bib = smooth(.67, .84, z - .30 * y + .035 * Math.cos(x * 8));
        color.lerp(light, Math.max(.48 * bib, .24 * smooth(-.59,-.79,y)));
      }
      const nap = Math.sin(10*x + 6*z + 1.3*Math.sin(5*y)) * Math.sin(9*y - 4*z);
      color.multiplyScalar(1 + .037 * nap);
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
  fur(T, part, radii, corgi, head);
}

// Small, rounded ears: the top follows a half ellipse instead of rising to a point.
function corgiEar(part, side) {
  const rows = [
    [-.030, .050, .028, -.004, 0], [-.010, .056, .031, -.002, 0],
    [.015, .058, .032, .002, -.001], [.040, .054, .030, .007, -.003],
    [.060, .043, .025, .012, -.005], [.074, .029, .018, .016, -.006],
    [.081, .016, .011, .018, -.006], [.084, .004, .004, .018, -.006]
  ];
  part.loft(apricot, rows.map(([y, x, z, cx, cz]) => [y, x, z, side * cx, cz]), 20);
  const vertices = [], faces = [], widths = [.26, .60, .66, .63, .52, .28];
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
  part.surface('#b17363', vertices, faces);
}

function floppyEar(part, side) {
  const color = side < 0 ? deepApricot : '#ba8360';
  const rows = [
    [-.187,.013,.022,side*.050,.044],[-.179,.029,.046,side*.058,.041],
    [-.153,.042,.069,side*.064,.038],[-.114,.049,.076,side*.063,.026],
    [-.058,.050,.066,side*.048,.010],[-.016,.044,.056,side*.022,-.001],
    [.016,.034,.044,side*.004,-.008],[.029,.015,.023,-side*.005,-.009]
  ];
  const rings=(rows.length-1)*2, sides=24, verts=[], faces=[];
  for (let i=0;i<=rings;i++) {
    const a=rows[Math.floor(i/2)], b=rows[Math.ceil(i/2)], t=i/rings;
    const [y,rx,rz,cx,cz]=a.map((x,j)=>(x+b[j])*.5);
    for (let j=0;j<sides;j++) {
      const u=tau*j/sides, turn=.87*Math.sin(5.4*t+side*.3);
      const wave=.0042*Math.sin(Math.PI*t)*(.65*Math.cos(4*u+turn)+.35*Math.cos(7*u+turn*.8));
      verts.push(cx+(rx+wave)*Math.sin(u), y, cz+(rz+wave)*Math.cos(u));
      if (i<rings) {
        const a=i*sides+j, b=i*sides+(j+1)%sides;
        faces.push(a,b,a+sides,b,b+sides,a+sides);
      }
    }
  }
  for (const i of [0,rings]) {
    const [y,,,cx,cz]=rows[i/2], tip=verts.length/3;
    verts.push(cx,y,cz);
    for (let j=0;j<sides;j++) {
      const a=i*sides+j,b=i*sides+(j+1)%sides;
      if (i) faces.push(tip,a,b); else faces.push(tip,b,a);
    }
  }
  part.surface(color,verts,faces);
}

function muzzle(part, corgi) {
  const front = corgi ? .151 : .141;
  if (corgi) {
    part.oval('#956053', 0, -.071, front + .014, .048, .024, .027);
    part.dot('#df8b82', .009, -.084, front + .026, .022, .017, .018);
  }
  for (const side of [-1, 1]) {
    part.oval('#d39a75', side * .034, -.042, front, .063, .049, .062, [0, side * .11, side * .07]);
    for (const [x, y, z] of [[.042,-.049,.059],[.063,-.047,.054],[.052,-.061,.053]]) {
      part.dot('#976447', side * x, y, front + z, .0038, .0036, .003);
    }
    if (!corgi) {
      const smile = [[0,-.055],[.013,-.065],[.032,-.068],[.054,-.057]].map(([x,y]) => {
        const depth = .062 * Math.sqrt(Math.max(0, 1 - ((x-.034)/.063)**2 - ((y+.042)/.049)**2));
        return [side*x, y, front + depth + .002];
      });
      part.stroke('#8d5c47', smile, .0031, .24, 8, 5);
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
  const start = new T.Color(corgi ? apricot : deepApricot), tip = new T.Color(lightApricot), col = new T.Color();
  const delta = new T.Vector3();
  for (let i = 0; i <= rings; i++) {
    const t = i / rings, center = curve.getPointAt(t);
    const r = corgi ? .005 + .051 * Math.sin(Math.PI * (.22 + .78 * t)) ** .67 : .005 + .029 * (1 - t ** 2);
    col.copy(start).lerp(tip, smooth(.74, .91, t));
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
  part.dot(tip, ...end, .006);
}

function paw(part, corgi, side, rear) {
  const hip = corgi ? .147 : .165, color = !corgi && rear && side > 0 ? deepApricot : apricot;
  part.oval(color, 0, -.024, -.004, corgi ? .056 : .043, .088, rear ? .072 : .052, [rear ? -.18 : .04, 0, 0]);
  const foot = corgi ? .056 : .047;
  part.loft(!corgi && rear && side > 0 ? '#a56d4c' : '#b98260', [
    [-hip+.004,foot*.67,.048,0,.020],[-hip+.009,foot*.96,.059,0,.021],
    [-hip+.024,foot,.065,0,.024],[-hip+.043,foot*.92,.058,0,.020],
    [-hip+.067,foot*.75,.041,0,.009],[-hip+.084,foot*.55,.029,0,.002]
  ], 16);
  for (const toe of [-1, 1]) {
    part.stroke('#98694a', [[toe*.014,-hip+.033,.082],[toe*.016,-hip+.027,.087],[toe*.017,-hip+.021,.087]], .0022, .25, 4, 4);
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
function makePattern(T, corgi, material) {
  const studio = clayStudio(T), part = new studio.Part(), joints = [], ids = [], texture = [];
  function plush(draw) {
    const first=part.positions.length;
    draw();
    for (let i=first; i<part.positions.length; i+=3) {
      const x=part.positions[i], y=part.positions[i+1], z=part.positions[i+2], uv=i/3*2;
      texture[uv]=(x + .29*z + .22*y)*5.4;
      texture[uv+1]=(z - .43*x + .76*y)*5.4;
    }
  }
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
    plush(() => coat(T, p, corgi ? [.177,.151,.287] : [.151,.129,.239], corgi, false));
    neckwear(p, corgi);
  });
  const head = joint('Head', body, [0, corgi ? .165 : .154, corgi ? .217 : .187], p => {
    plush(() => coat(T, p, corgi ? [.185,.157,.155] : [.171,.152,.148], corgi, true));
    muzzle(p, corgi);
    if (corgi) for (const side of [-1, 1]) p.dot(lightApricot, side*.100,.069,.111,.024,.010,.013,[0,side*.33,side*.19]);
  });
  joint('Eyes', head, [0,.025,0], p => faceEyes(p, corgi));
  for (const side of [-1,1]) joint(side < 0 ? 'Left ear' : 'Right ear', head,
    [side * (corgi ? .114 : .142), corgi ? .118 : .081, corgi ? -.020 : -.010], p => plush(() => corgi ? corgiEar(p, side) : floppyEar(p, side)));
  joint('Tail', body, [0,.019,corgi ? -.244 : -.202], p => plush(() => tail(T, p, corgi)));
  for (const rear of [false, true]) for (const side of [-1,1]) {
    const x = corgi ? .106 : .088, hipY = corgi ? .147 : .165;
    const z = rear ? (corgi ? -.173 : -.143) : (corgi ? .151 : .135);
    joint((rear ? 'Rear' : 'Front') + (side < 0 ? ' left paw' : ' right paw'), body, [x * side, hipY - bodyY, z], p => plush(() => paw(p, corgi, side, rear)));
  }
  const geometry = part.finish(), skin = new Uint8Array(ids.length * 4), weights = new Uint8Array(skin.length);
  ids.forEach((id, i) => { skin[i * 4] = id; weights[i * 4] = 255; });
  geometry.setAttribute('skinIndex', new T.Uint8BufferAttribute(skin, 4));
  geometry.setAttribute('skinWeight', new T.Uint8BufferAttribute(weights, 4, true));
  const uv = new Float32Array(ids.length*2);
  texture.forEach((value,i) => {uv[i]=value;});
  geometry.setAttribute('uv', new T.BufferAttribute(uv,2));
  return { geometry, joints, material };
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
  root.scale.setScalar(corgi ? .65 : 1);
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
  return { name, root, animate, labelHeight: corgi ? .53 : .66 };
}

// Both ground pivots sit between the four paws. Local forward is +Z.
export function createIslandDogs(T) {
  if (!libraries.has(T)) {
    const material = plushClay(T);
    libraries.set(T, [makePattern(T, true, material), makePattern(T, false, material)]);
  }
  return libraries.get(T).map((pattern, i) => puppy(T, pattern, i === 0));
}
