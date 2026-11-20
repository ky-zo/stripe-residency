import { clayStudio } from './clay-mesh.js';

const tau = Math.PI * 2;

function makeTools(T) {
  const box = new T.BoxGeometry(1, 1, 1);
  const tube = new T.CylinderGeometry(1, 1, 1, 6, 1, false);
  const bead = new T.SphereGeometry(1, 10, 7);
  const up = new T.Vector3(0, 1, 0);
  const direction = new T.Vector3();
  const quaternion = new T.Quaternion();
  const euler = new T.Euler();

  const block = (part, color, x, y, z, width, height, depth) => {
    part.piece(box, color, x, y, z, [width, height, depth]);
  };
  const rod = (part, color, a, b, radius) => {
    direction.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const length = direction.length();
    if (length === 0) return;
    quaternion.setFromUnitVectors(up, direction.divideScalar(length));
    euler.setFromQuaternion(quaternion);
    part.piece(tube, color, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2,
      (a[2] + b[2]) / 2, [radius, length, radius], [euler.x, euler.y, euler.z]);
  };
  const oval = (part, color, x, y, z, rx, ry, rz, rotation = [0, 0, 0]) => {
    part.piece(bead, color, x, y, z, [rx, ry, rz], rotation);
  };
  return { block, rod, oval, dispose() { box.dispose(); tube.dispose(); bead.dispose(); } };
}

function clayMesh(T, part, material, name) {
  const mesh = new T.Mesh(part.finish(), material);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function buildCourt(T, studio, tools, glass) {
  const { block, rod, oval } = tools;
  const court = new studio.Part();
  const west = 14.7, east = 19.3, far = -2.6, near = 4.6;
  const rail = '#648c80', wire = '#658d7e', wood = '#c78659', cap = '#e4aa74';
  const ivory = '#e9e4cd';

  block(court, '#b09d7f', 17, -.034, 1, 4.64, .1, 7.24);
  block(court, '#408f81', 17, .007, 1, 4.56, .032, 7.16);
  // The quiet lengthwise variation is baked into the turf vertices.
  const greens = ['#4a9687', '#499688', '#469486', '#479587', '#499889'];
  for (let i = 0; i < greens.length; i++) {
    const x = west + .041 + (i + .5) * .9036;
    block(court, greens[i], x, .025, 1, .9036, .004, 7.115);
  }
  for (const z of [far, near]) block(court, '#baaa88', 17, .016, z, 4.64, .044, .065);
  for (const x of [west, east]) block(court, '#b9a984', x, .016, 1, .062, .044, 7.2);
  const serviceDistance = 2.48;
  for (const z of [1 - serviceDistance, 1 + serviceDistance]) {
    block(court, ivory, 17, .033, z, 4.49, .008, .031);
  }
  block(court, ivory, 17, .034, 1, .027, .01, serviceDistance * 2 + .09);

  // Glass at the ends and returns makes the enclosure legible from either side.
  const panels = [];
  function endGlass(ax, az, bx, bz, top, accent = false) {
    const base = .093;
    panels.push(ax, base, az, bx, base, bz, bx, top, bz, ax, base, az, bx, top, bz, ax, top, az);
    rod(court, rail, [ax, top, az], [bx, top, bz], .018);
    rod(court, rail, [ax, base, az], [bx, base, bz], .014);
    if (accent) {
      const at = (t, y) => [ax + (bx - ax) * t, y, az + (bz - az) * t];
      rod(court, '#a2bcac', at(.09, top * .61), at(.24, top * .81), .007);
      rod(court, '#a2bcac', at(.12, top * .53), at(.18, top * .61), .006);
    }
  }
  function post(x, z, h) {
    rod(court, wood, [x, .036, z], [x, h, z], .037);
    oval(court, cap, x, h, z, .045, .03, .045);
    rod(court, '#749582', [x, .033, z], [x, .109, z], .05);
  }
  function wireFence(x, az, bz) {
    const top = .87, low = .115;
    for (const y of [low, top]) rod(court, rail, [x, y, az], [x, y, bz], .021);
    for (let j = 1; j < 4; j++) {
      const y = low + (top - low) * j / 4;
      rod(court, wire, [x, y, az], [x, y, bz], .009);
    }
    const cells = Math.ceil((bz - az) / .25);
    for (let j = 1; j < cells; j++) {
      const z = az + (bz - az) * j / cells;
      rod(court, wire, [x, low, z], [x, top, z], .009);
    }
  }
  for (const z of [far, near]) {
    const s = z === far ? 1 : -1;
    const xs = [west, west + 1.53, east - 1.53, east];
    for (const x of xs) post(x, z, 1.26);
    for (let i = 0; i < xs.length - 1; i++) endGlass(xs[i], z, xs[i + 1], z, 1.235, i === 0);
    for (const x of [west, east]) {
      const end = z + s * 1.07;
      endGlass(x, z, x, end, 1.235);
      post(x, end, 1.26);
    }
  }
  const gateLow = -.14, gateHigh = 2.14;
  wireFence(west, far + 1.07, gateLow);
  wireFence(west, gateHigh, near - 1.07);
  post(west, gateLow, .90);
  post(west, gateHigh, .90);
  wireFence(east, far + 1.07, 1);
  wireFence(east, 1, near - 1.07);
  post(east, 1, .90);

  for (const x of [west, east]) {
    rod(court, '#a16e4d', [x, .04, 1], [x, .685, 1], .047);
    oval(court, '#e1ae77', x, .687, 1, .054, .034, .054);
  }
  const netLeft = west + .046, netRight = east - .046;
  const netTop = x => .626 + .044 * ((x - 17) / 2.3) ** 2;
  const bottom = .088, netColor = '#486e64';
  for (let i = 0; i <= 24; i++) {
    const x = netLeft + (netRight - netLeft) * i / 24;
    rod(court, netColor, [x, bottom, 1], [x, netTop(x), 1], .009);
  }
  for (let row = 0; row <= 5; row++) {
    const y = x => bottom + row / 5 * (netTop(x) - bottom);
    for (let i = 0; i < 6; i++) {
      const x = netLeft + (netRight - netLeft) * i / 6;
      const end = netLeft + (netRight - netLeft) * (i + 1) / 6;
      rod(court, row === 5 ? ivory : netColor, [x, y(x), 1], [end, y(end), 1], row === 5 ? .022 : .009);
    }
  }

  const panes = new T.BufferGeometry();
  panes.setAttribute('position', new T.Float32BufferAttribute(panels, 3));
  panes.computeVertexNormals();
  const glazing = new T.Mesh(panes, glass);
  glazing.name = 'Padel end glass';
  return [clayMesh(T, court, studio.clay, 'Padel court and net'), glazing];
}

function granite(T) {
  // The south edge of each ring follows the marked climbing route.
  const rings = [
    [-.08, 12.02, 1.30, -3.21, -5.61], [.12, 12.00, 1.40, -3.29, -5.72],
    [.45, 12.02, 1.43, -3.46, -5.76], [.98, 12.07, 1.34, -3.62, -5.71],
    [1.44, 12.10, 1.18, -3.79, -5.62], [1.98, 12.12, .92, -3.99, -5.47],
    [2.19, 12.14, .73, -4.07, -5.29], [2.27, 12.13, .56, -4.10, -5.12],
    [2.28, 12.09, .37, -4.23, -4.91]
  ];
  const sides = 23;
  const points = [], indices = [], colors = [];
  const shade = new T.Color('#788283'), light = new T.Color('#b7b2a4'), tint = new T.Color();
  const power = (v, p) => Math.sign(v) * Math.abs(v) ** p;
  for (let i = 0; i < rings.length; i++) {
    const [y, cx, rx, front, back] = rings[i];
    const mid = (front + back) * .5;
    for (let j = 0; j < sides; j++) {
      const a = tau * j / sides;
      const flank = Math.min(1, .12 + Math.abs(Math.sin(a)));
      const crag = flank * (.018 * Math.sin(5 * a + i * .29) + .027 * Math.cos(3 * a - i * .17));
      const lift = i === rings.length - 1 ? .003 : .014;
      points.push(cx + rx * power(Math.sin(a), .79) * (1 + crag),
        y + flank * lift * Math.sin(3 * a + i * .35), mid + (front - mid) * power(Math.cos(a), .79) * (1 + crag));
      const tone = .24 + .40 * i / (rings.length - 1) + .13 * Math.sin(3 * a + i * .53) + .065 * Math.cos(6 * a - i * .92);
      tint.copy(shade).lerp(light, tone);
      colors.push(tint.r, tint.g, tint.b);
      if (i === 0) continue;
      const bottom = (i - 1) * sides + j, next = (i - 1) * sides + (j + 1) % sides;
      indices.push(bottom, next, bottom + sides, next, next + sides, bottom + sides);
    }
  }
  const top = points.length / 3, last = (rings.length - 1) * sides;
  points.push(12.11, 2.284, -4.57);
  colors.push(light.r, light.g, light.b);
  for (let j = 0; j < sides; j++) indices.push(top, last + j, last + (j + 1) % sides);
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(points, 3));
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const stone = geometry.toNonIndexed();
  const p = stone.getAttribute('position'), n = stone.getAttribute('normal');
  const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3(), normal = new T.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i);
    b.fromBufferAttribute(p, i + 1).sub(a);
    c.fromBufferAttribute(p, i + 2).sub(a);
    const face = b.cross(c).normalize();
    for (let j = i; j < i + 3; j++) {
      normal.fromBufferAttribute(n, j).lerp(face, .29).normalize();
      n.setXYZ(j, normal.x, normal.y, normal.z);
    }
  }
  geometry.dispose();
  return stone;
}

function jug(T, style, color) {
  const grip = new T.SphereGeometry(1, 12, 8);
  const vertices = grip.getAttribute('position');
  const base = new T.Color(color), highlight = new T.Color('#e6d8b4'), tint = new T.Color();
  const paint = [];
  for (let i = 0; i < vertices.count; i++) {
    const x = vertices.getX(i), y = vertices.getY(i), z = vertices.getZ(i);
    const front = Math.max(0, z);
    const pocket = Math.exp(-((x + .12) ** 2 / .27 + (y + .16) ** 2 / .055)) * front;
    const width = x * (style === 1 ? .95 + .19 * y : 1 + .065 * x * y);
    const height = style === 2 ? y + .22 * x : y + .16 * x * x - .045;
    vertices.setXYZ(i, width, height, z * (1 + .10 * y) - pocket * (style === 0 ? .35 : .16));
    tint.copy(base).lerp(highlight, Math.max(0, y) ** 2 * .18).multiplyScalar(1 - pocket * .16);
    paint.push(tint.r, tint.g, tint.b);
  }
  grip.setAttribute('color', new T.Float32BufferAttribute(paint, 3));
  grip.computeVertexNormals();
  return grip;
}

function buildBoulder(T, studio, tools) {
  const stone = granite(T);
  const bare = new T.Mesh(stone, studio.clay);
  const ray = new T.Raycaster(new T.Vector3(), new T.Vector3(0, 0, -1));
  function surface(x, y) {
    ray.ray.origin.set(x, y, -2);
    return ray.intersectObject(bare, false)[0]?.point.z;
  }
  const boulder = new studio.Part();
  boulder.piece(stone, null);
  const coral = '#d88966', sage = '#76a495', yellow = '#dfb26b';
  // Warm jugs trace the main line. The other colored grips give the hands a choice.
  const holds = [
    [11.63, .385, .14, .078, -.09, coral], [12.00, .91, .14, .068, .13, coral],
    [12.32, 1.37, .15, .073, -.10, coral], [12.29, 1.92, .14, .07, .14, coral],
    [12.10, 2.18, .135, .058, -.06, coral], [11.40, .23, .10, .06, -.20, sage],
    [11.14, .73, .13, .08, .48, yellow], [11.52, 1.12, .11, .085, -.31, sage],
    [11.86, 1.56, .12, .072, -.26, yellow], [11.80, 1.86, .1, .065, .17, sage],
    [12.49, .49, .12, .082, .36, yellow], [12.82, .83, .10, .068, -.38, sage],
    [12.77, 1.61, .12, .075, -.39, sage], [12.62, 1.97, .087, .053, .26, yellow]
  ];
  for (let i = 0; i < holds.length; i++) {
    const [x, y, width, height, angle, color] = holds[i];
    const z = surface(x, y);
    if (z === undefined) continue;
    const depth = i < 5 ? .115 : .087;
    const grip = jug(T, i % 3, color);
    boulder.piece(grip, null, x, y, z + .025, [width, height, depth], [.09, 0, angle]);
    grip.dispose();
    tools.oval(boulder, studio.mix(color, '#605e50', .48), x + width * .40, y + height * .16, z + depth * .86 + .022, .012, .010, .004);
  }
  function mineral(color, path, width) {
    const points = [], faces = [];
    for (let i = 0; i < path.length - 1; i++) {
      const [ax, ay] = path[i], [bx, by] = path[i + 1];
      const length = Math.hypot(bx - ax, by - ay), steps = Math.ceil(length / .045);
      for (let j = 0; j <= steps; j++) {
        if (i && !j) continue;
        const t = j / steps, progress = (i + t) / (path.length - 1);
        const w = width * (.08 + .92 * Math.sin(progress * Math.PI)) * (.9 + .1 * Math.cos(i * 3 + t));
        const x = ax + t * (bx - ax), y = ay + t * (by - ay);
        const dx = (ay - by) * w / length, dy = (bx - ax) * w / length;
        const z1 = surface(x + dx, y + dy), z2 = surface(x - dx, y - dy);
        if (z1 === undefined || z2 === undefined) continue;
        const first = points.length / 3;
        points.push(x + dx, y + dy, z1 + .003, x - dx, y - dy, z2 + .003);
        if (first) faces.push(first - 2, first - 1, first, first, first - 1, first + 1);
      }
    }
    if (faces.length) boulder.surface(color, points, faces);
  }
  // Narrow mineral seams stay flush with the stone and taper away at both ends.
  mineral('#a8aaa0', [[10.86,.42],[11.04,.57],[11.12,.60],[11.28,.76],[11.49,.82],[11.65,.88]], .012);
  mineral('#9aa096', [[10.82,.39],[11.00,.52],[11.12,.54],[11.20,.62]], .007);
  mineral('#a8a99e', [[12.56,1.08],[12.73,1.18],[12.80,1.20],[12.96,1.35],[13.08,1.39]], .008);
  mineral('#a4a79c', [[11.64,1.70],[11.80,1.78],[11.91,1.91],[12.08,1.97]], .008);
  const sample = seed => (Math.sin(seed * 12.9898 + 31.71) * 43758.5453) % 1;
  for (let i = 0; i < 48; i++) {
    const x = 12.03 + sample(i + 1) * 1.31, y = .16 + Math.abs(sample(i + 91)) * 1.95;
    const radius = .008 + .01 * Math.abs(sample(i + 57));
    const tilt = sample(i + 73) * .77;
    mineral(i % 3 ? '#a8a89b' : '#848d85', [[x-radius,y-tilt*radius],[x,y],[x+radius,y+tilt*radius]], radius * .34);
  }
  stone.dispose();

  function mat(cx, cz, angle, top, band) {
    const v = (x, y, z) => [cx + Math.cos(angle) * x + Math.sin(angle) * z, y, cz - Math.sin(angle) * x + Math.cos(angle) * z];
    for (const sign of [-1, 1]) {
      let center = v(sign * .25, .034, 0);
      boulder.block(band, ...center, .497, .06, .77, [0, angle, 0]);
      center = v(sign * .25, .068, -.005);
      boulder.block(top, ...center, .48, .048, .744, [0, angle, 0]);
    }
    for (const z of [-.27, .27]) {
      tools.rod(boulder, band, v(-.075, .072, z), v(.075, .072, z), .015);
    }
    const path = [[-.083, .035, .376], [-.06, .032, .414], [.06, .032, .414], [.083, .035, .376]];
    boulder.stroke(band, path.map(p => v(...p)), .013, .86, 7, 5);
  }
  mat(11.5, -2.97, -.07, '#80a99b', '#537b70');
  mat(12.57, -3.10, .11, '#d69b78', '#aa765b');
  return clayMesh(T, boulder, studio.clay, 'Granite boulder, grips and crash pads');
}

function racketGeometry(T, studio, tools) {
  const racket = new studio.Part();
  const head = new T.Shape();
  head.moveTo(0, .075);
  head.bezierCurveTo(-.035, .075, -.071, .157, -.112, .216);
  head.bezierCurveTo(-.168, .291, -.167, .421, -.109, .474);
  head.bezierCurveTo(-.054, .528, .054, .528, .109, .474);
  head.bezierCurveTo(.167, .421, .168, .291, .112, .216);
  head.bezierCurveTo(.071, .157, .035, .075, 0, .075);
  const throat = new T.Path();
  throat.moveTo(-.041, .222);
  throat.quadraticCurveTo(-.038, .229, .038, .225);
  throat.quadraticCurveTo(.051, .223, .034, .195);
  throat.lineTo(.007, .15);
  throat.quadraticCurveTo(0, .136, -.007, .150);
  throat.lineTo(-.037, .203);
  throat.quadraticCurveTo(-.045, .216, -.041, .222);
  head.holes.push(throat);
  for (const [y, count] of [[.267, 3], [.308, 4], [.350, 5], [.392, 4], [.434, 3]]) {
    for (let i = 0; i < count; i++) {
      const hole = new T.Path();
      hole.absarc((i - (count - 1) / 2) * .045, y, .012, 0, tau, false);
      head.holes.push(hole);
    }
  }
  const panel = new T.ExtrudeGeometry(head, { depth: .029, bevelEnabled: true, bevelSegments: 1, bevelSize: .002, bevelThickness: .003, curveSegments: 6 });
  const colors = [], normals = panel.getAttribute('normal'), vertices = panel.getAttribute('position');
  const teal = new T.Color('#397d72'), rim = new T.Color('#d38d68'), inside = new T.Color('#32695e');
  for (let i = 0; i < normals.count; i++) {
    const x = vertices.getX(i), y = vertices.getY(i);
    const hole = Math.abs(x) < .107 && y > .249 && y < .452;
    const color = Math.abs(normals.getZ(i)) > .89 ? teal : (hole ? inside : rim);
    colors.push(color.r, color.g, color.b);
  }
  panel.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  racket.piece(panel, null, 0, 0, -.0145);
  panel.dispose();
  const grip = '#ddbe95', butt = '#b57955';
  tools.rod(racket, grip, [0, -.089, 0], [0, .11, 0], .026);
  for (const y of [-.065, -.027, .011, .049, .087]) {
    tools.rod(racket, '#bda07c', [0, y, 0], [0, y + .008, 0], .027);
  }
  tools.rod(racket, butt, [0, -.101, 0], [0, -.086, 0], .033);
  tools.rod(racket, '#d39269', [0, .104, 0], [0, .123, 0], .029);
  return racket.finish();
}

function buildBall(T, studio) {
  const ball = new studio.Part();
  ball.oval('#c3da52', 0, 0, 0, .101, .101, .101);
  const seam = [];
  for (let i = 0; i <= 28; i++) {
    const t = i * tau / 28, latitude = .62 * Math.sin(2 * t + .4);
    seam.push([.101 * Math.cos(latitude) * Math.cos(t), .101 * Math.sin(latitude), .101 * Math.cos(latitude) * Math.sin(t)]);
  }
  ball.stroke('#f0ecc9', seam, .0046, 1, 42, 5);
  return clayMesh(T, ball, studio.clay, 'Lime padel ball');
}

export function createSportScenery(T) {
  const studio = clayStudio(T), tools = makeTools(T);
  const glass = new T.MeshStandardMaterial({ color: '#a5d5c6', roughness: .42, transparent: true, opacity: .16, depthWrite: false, side: T.DoubleSide });
  glass.forceSinglePass = true;
  const root = new T.Group();
  root.name = 'Island sports';
  const ball = buildBall(T, studio);
  ball.position.set(15.64, .13, 3.31);
  root.add(...buildCourt(T, studio, tools, glass), buildBoulder(T, studio, tools), ball);
  const racket = racketGeometry(T, studio, tools);
  tools.dispose();
  function createRacket() {
    const grip = new T.Group();
    grip.name = 'Padel racket grip';
    const mesh = new T.Mesh(racket, studio.clay);
    mesh.name = 'Perforated padel racket';
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    grip.add(mesh);
    return grip;
  }
  return { root, ball, createRacket };
}
