// Accumulate colored clay pieces into one indexed mesh per animated part.
// Normals are transformed along with each piece so the material is smooth at any scale.
const studios = new WeakMap();

export function clayStudio(T) {
  if (studios.has(T)) return studios.get(T);
  const ellipsoid = new T.SphereGeometry(1, 17, 12);
  const palm = new T.SphereGeometry(1, 13, 9);
  const bead = new T.SphereGeometry(1, 11, 8);
  const speck = new T.SphereGeometry(1, 8, 6);
  const box = roundedBlock(T);
  const pixel = new T.BoxGeometry(2, 2, 2);
  const colorCache = new Map();
  const buffer = new T.Vector3();
  const normal = new T.Vector3();
  const matrix = new T.Matrix4();
  const normalMatrix = new T.Matrix3();
  const quaternion = new T.Quaternion();
  const position = new T.Vector3();
  const scale = new T.Vector3();
  const euler = new T.Euler();
  const clay = new T.MeshStandardMaterial({
    vertexColors: true, roughness: .84, metalness: 0
  });
  const eyeClay=new T.MeshStandardMaterial({vertexColors:true,roughness:.50,metalness:0});

  function paint(value) {
    if (value?.isColor) return value;
    if (!colorCache.has(value)) colorCache.set(value, new T.Color(value));
    return colorCache.get(value);
  }

  class Part {
    positions = [];
    normals = [];
    colors = [];
    indices = [];

    piece(geometry, color, x = 0, y = 0, z = 0, sizes = [1, 1, 1], rotations = [0, 0, 0]) {
      quaternion.setFromEuler(euler.set(...rotations));
      matrix.compose(position.set(x, y, z), quaternion, scale.set(...sizes));
      normalMatrix.getNormalMatrix(matrix);
      const first = this.positions.length / 3;
      const vertexColors = color === null ? geometry.getAttribute('color') : null;
      const tint = vertexColors ? null : paint(color);
      const vertices = geometry.getAttribute('position');
      const normals = geometry.getAttribute('normal');
      for (let i = 0; i < vertices.count; i++) {
        buffer.fromBufferAttribute(vertices, i).applyMatrix4(matrix);
        normal.fromBufferAttribute(normals, i).applyNormalMatrix(normalMatrix);
        this.positions.push(buffer.x, buffer.y, buffer.z);
        this.normals.push(normal.x, normal.y, normal.z);
        if (vertexColors) {
          this.colors.push(vertexColors.getX(i), vertexColors.getY(i), vertexColors.getZ(i));
        } else {
          this.colors.push(tint.r, tint.g, tint.b);
        }
      }
      if (geometry.index) {
        for (const index of geometry.index.array) this.indices.push(first + index);
      } else {
        for (let i = 0; i < vertices.count; i++) this.indices.push(first + i);
      }
    }

    oval(color, x, y, z, rx, ry, rz, rotation = [0, 0, 0]) {
      const shape = Math.max(rx, ry, rz) < .102 ? palm : ellipsoid;
      this.piece(shape, color, x, y, z, [rx, ry, rz], rotation);
    }

    dot(color, x, y, z, rx, ry = rx, rz = rx, rotation = [0, 0, 0]) {
      const shape = Math.max(rx, ry, rz) < .023 ? speck : bead;
      this.piece(shape, color, x, y, z, [rx, ry, rz], rotation);
    }

    block(color, x, y, z, width, height, depth, rotation = [0, 0, 0]) {
      const shape = Math.max(width, height, depth) < .04 ? pixel : box;
      this.piece(shape, color, x, y, z, [width / 2, height / 2, depth / 2], rotation);
    }

    // Each level stores height, x-radius, z-radius, and optional center offsets.
    loft(color, levels, sides = 24, roundness = 1) {
      const points = [];
      const faces = [];
      for (const [y, rx, rz, cx = 0, cz = 0] of levels) {
        for (let j = 0; j < sides; j++) {
          const angle = j / sides * Math.PI * 2;
          const sine = Math.sin(angle);
          const cosine = Math.cos(angle);
          points.push(cx + rx * Math.sign(sine) * Math.abs(sine) ** roundness,
            y, cz + rz * Math.sign(cosine) * Math.abs(cosine) ** roundness);
        }
      }
      for (let i = 0; i < levels.length - 1; i++) {
        for (let j = 0; j < sides; j++) {
          const a = i * sides + j;
          const b = i * sides + (j + 1) % sides;
          faces.push(a, b, a + sides, b, b + sides, a + sides);
        }
      }
      for (const [level, up] of [[0, false], [levels.length - 1, true]]) {
        const first = points.length / 3;
        for (let j = 0; j < sides; j++) {
          const i = (level * sides + j) * 3;
          points.push(points[i], points[i + 1], points[i + 2]);
        }
        for (let j = 1; j < sides - 1; j++) {
          if (up) faces.push(first, first + j, first + j + 1);
          else faces.push(first, first + j + 1, first + j);
        }
      }
      this.surface(color, points, faces);
    }

    surface(color, points, indices, vertexTints, vertexNormals) {
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.Float32BufferAttribute(points, 3));
      if (vertexTints) {
        geo.setAttribute('color', new T.Float32BufferAttribute(vertexTints, 3));
      }
      geo.setIndex(ArrayBuffer.isView(indices) ? new T.BufferAttribute(indices, 1) : indices);
      if(vertexNormals) geo.setAttribute('normal',new T.Float32BufferAttribute(vertexNormals,3));
      else geo.computeVertexNormals();
      this.piece(geo, vertexTints ? null : color);
      geo.dispose();
    }

    // A tapered round stroke. Useful for hair ridges, embroidered seams and expressions.
    stroke(color, path, radius, taper = 0.7, segments = 10, sides = 6) {
      const curve = new T.CatmullRomCurve3(path.map(p => new T.Vector3(...p)), false, 'centripetal');
      const frame = curve.computeFrenetFrames(segments, false);
      const points = [];
      const faces = [];
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const c = curve.getPointAt(t);
        const factor = radius * (taper + (1 - taper) * Math.sin(t * Math.PI));
        for (let j = 0; j < sides; j++) {
          const a = j * Math.PI * 2 / sides;
          const p = c.clone().addScaledVector(frame.normals[i], Math.cos(a) * factor)
            .addScaledVector(frame.binormals[i], Math.sin(a) * factor);
          points.push(p.x, p.y, p.z);
        }
      }
      for (let i = 0; i < segments; i++) {
        for (let j = 0; j < sides; j++) {
          const a = i * sides + j;
          const b = i * sides + (j + 1) % sides;
          faces.push(a, b, a + sides, b, b + sides, a + sides);
        }
      }
      this.surface(color, points, faces);
    }

    // A tapered elliptical lock follows the curvature of the skull and keeps a sculpted ridge.
    lock(color,path,width,thickness,taper=.08,steps=11) {
      const curve=new T.CatmullRomCurve3(path.map(p=>new T.Vector3(...p)),false,'centripetal');
      const points=[],faces=[],colors=[];
      const tint=paint(color),sides=9;
      const outward=new T.Vector3(),across=new T.Vector3(),point=new T.Vector3();
      for(let i=0;i<=steps;i++) {
        const t=i/steps,c=curve.getPointAt(t),tangent=curve.getTangentAt(t);
        outward.set(c.x/.31,(c.y-.015)/.33,c.z/.27).normalize();
        outward.addScaledVector(tangent,-outward.dot(tangent));
        if(outward.lengthSq()<.001) outward.set(0,0,1);
        outward.normalize();
        across.crossVectors(outward,tangent).normalize();
        const size=taper+(1-taper)*Math.sin(t*Math.PI)**.61;
        for(let j=0;j<sides;j++) {
          const a=j/sides*Math.PI*2;
          const ridge=Math.sin(a);
          point.copy(c).addScaledVector(across,Math.cos(a)*width*size)
            .addScaledVector(outward,ridge*thickness*size);
          points.push(point.x,point.y,point.z);
          const sheen=.92+.14*Math.max(0,ridge)*(.8+.2*Math.sin(4*a));
          colors.push(tint.r*sheen,tint.g*sheen,tint.b*sheen);
        }
      }
      for(let i=0;i<steps;i++) for(let j=0;j<sides;j++) {
        const a=i*sides+j,b=i*sides+(j+1)%sides;
        faces.push(a,b,a+sides,b,b+sides,a+sides);
      }
      for(const t of [0,1]) {
        const center=curve.getPointAt(t),direction=curve.getTangentAt(t);
        center.addScaledVector(direction,(t?1:-1)*thickness*taper*.75);
        const tip=points.length/3,first=t*steps*sides;
        points.push(center.x,center.y,center.z);
        colors.push(tint.r,tint.g,tint.b);
        for(let j=0;j<sides;j++) {
          const a=first+j,b=first+(j+1)%sides;
          if(t) faces.push(a,b,tip); else faces.push(b,a,tip);
        }
      }
      this.surface(color,points,faces,colors);
    }

    finish() {
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.Float32BufferAttribute(this.positions, 3));
      geo.setAttribute('normal', new T.Float32BufferAttribute(this.normals, 3));
      geo.setAttribute('color', new T.Float32BufferAttribute(this.colors, 3));
      geo.setIndex(this.indices);
      geo.computeBoundingSphere();
      return geo;
    }
  }

  const studio = {
    Part, clay, eyeClay,
    mix(a, b, amount) { return paint(a).clone().lerp(paint(b), amount); }
  };
  studios.set(T, studio);
  return studio;
}

// Beveled faces with analytic corner normals and shared tooling for props and footwear.
function roundedBlock(T) {
  const geometry = new T.BoxGeometry(2, 2, 2, 4, 4, 4);
  const pos = geometry.getAttribute('position');
  const norm = geometry.getAttribute('normal');
  const p = new T.Vector3();
  const nearest = new T.Vector3();
  const outward = new T.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    nearest.set(
      T.MathUtils.clamp(p.x, -0.68, 0.68),
      T.MathUtils.clamp(p.y, -0.68, 0.68),
      T.MathUtils.clamp(p.z, -0.68, 0.68)
    );
    outward.subVectors(p, nearest).normalize();
    p.copy(nearest).addScaledVector(outward, 0.32);
    pos.setXYZ(i, p.x, p.y, p.z);
    norm.setXYZ(i, outward.x, outward.y, outward.z);
  }
  return geometry;
}
