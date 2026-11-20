import { clayStudio } from './clay-mesh.js';

const gearGeometry = new WeakMap();
const teal = '#347e78', coral = '#e78762', honey = '#e7b579', cream = '#f9e6bb';
const bamboo = '#d5aa73', binding = '#645847';

function samples(from, to, count) {
  return Array.from({length:count+1}, (_, i) => from+(to-from)*i/count);
}

// Each pair is a cross-section of a painted band following the hull or the deck.
function ribbon(part, color, rows, reversed = false) {
  const points = [], indices = [];
  for (const [left, right] of rows) points.push(...left, ...right);
  for (let i=0; i<rows.length-1; i++) {
    const a=i*2;
    if (reversed) indices.push(a,a+2,a+1, a+1,a+2,a+3);
    else indices.push(a,a+1,a+2, a+1,a+3,a+2);
  }
  part.surface(color,points,indices);
}

function buildCanoe(Part) {
  const p=new Part();
  const stations=samples(-1,1,32);
  const length=1.59;
  const width=u=>.019+.397*Math.pow(Math.max(0,1-Math.abs(u)**2.18),.80);
  const rail=u=>.496+.147*Math.abs(u)**2.55+.026*u;
  const keel=u=>-.215+.30*Math.abs(u)**2.28+.019*u;
  const floor=u=>.128+.32*Math.abs(u)**2.35+.022*u;
  const outer=(u,side,w,h)=>[side*width(u)*w,keel(u)+(rail(u)-keel(u))*h,length*u];
  const inner=(u,side,w,h)=>[side*Math.max(.006,width(u)-.049)*w,floor(u)+(rail(u)-floor(u))*h,length*u];
  for (const s of [-1,1]) {
    const skin=[[.02,0,'#356e68'],[.55,.17,'#438c80'],[.83,.43,'#67a796'],
      [.945,.58,cream],[.987,.75,'#efd09c'],[1,.81,coral],[1,.88,'#356f67'],[1,.955,honey],[1,1]];
    for (let i=0;i<skin.length-1;i++) {
      const [w,h,paint]=skin[i],[w2,h2]=skin[i+1];
      ribbon(p,paint,stations.map(u=>[outer(u,s,w,h),outer(u,s,w2,h2)]),s<0);
    }
    const lining=[[.51,0,'#b78355'],[.80,.20,'#c99967'],[.94,.55,'#d6aa77'],[1,.91,'#e3b981'],[1,1]];
    for(let i=0;i<lining.length-1;i++) {
      const [w,h,paint]=lining[i],[w2,h2]=lining[i+1];
      ribbon(p,paint,stations.map(u=>[inner(u,s,w,h),inner(u,s,w2,h2)]),s>0);
    }
    ribbon(p,honey,stations.map(u=>[outer(u,s,1,1),inner(u,s,1,1)]),s<0);
    const guard=stations.map(u=>{const [x,y,z]=outer(u,s,1,.97);return [x,y+.004,z];});
    p.stroke('#bd8d59',guard,.015,.68,32,7);
  }
  ribbon(p,'#c29769',stations.map(u=>[inner(u,-1,.51,0),inner(u,1,.51,0)]),true);
  ribbon(p,'#356e68',stations.map(u=>[outer(u,-1,.02,0),outer(u,1,.02,0)]));
  for(const end of [-1,1]) {
    ribbon(p,teal,[[.02,0],[.83,.43],[1,.88],[1,1]].map(([w,h])=>
      [outer(end,-1,w,h),outer(end,1,w,h)]),end<0);
    // Short solid foredecks tie the two rails together. The centre stays open.
    const deck=samples(.664,.998,12).map(a=>{
      const u=end*a,y=rail(u)-.038,w=Math.max(.014,width(u)-.013);
      return [[-w,y,length*u],[w,y,length*u]];
    });
    ribbon(p,end>0?'#eabd82':'#d5a56f',deck,end>0);
    const y=rail(end)-.017;
    p.stroke(teal,[[0,y-.29,end*1.56],[0,y-.035,end*1.59],
      [0,y+.057,end*1.605],[0,y+.096,end*1.645]],.045,.62,13,9);
    p.dot(coral,0,y+.097,end*1.645,.029,.026,.036);
    for(let j=0;j<3;j++) {
      const u=end*(.704+j*.078),w=width(u)-.036,h=rail(u)-.034;
      p.stroke('#bd8e5c',[[-w,h,u*length],[0,h+.003,u*length],[w,h,u*length]],.006,.50,4,5);
    }
  }
  // Teak cross-benches and lower footrests for the helm and bow seats.
  for(const z of [-.52,.52]) {
    const w=width(z/length)*2-.026;
    p.block('#a87652',0,.478,z,w,.075,.206);
    for(const dz of [-.059,.059]) p.block('#e7b97e',0,.522,z+dz,w+.02,.035,.106);
    p.block('#c29863',0,.268,z+.245,.48,.047,.174);
    for(const s of [-1,1]) {
      p.dot(binding,s*(w*.5-.052),.540,z,.012,.003,.012);
      p.block('#bb8e5f',s*.148,.200,z+.245,.032,.132,.094);
    }
  }
  // Bent bamboo arms and bound twin floats are the silhouette of a Balinese jukung.
  for(const s of [-1,1]) {
    const x=s*.976;
    const floatPoint=(u,a)=>{
      const r=.094*Math.pow(Math.max(.001,1-u*u),.58);
      return [x+Math.cos(a)*r,.045+.113*Math.abs(u)**2.8+Math.sin(a)*r*.90,1.22*u];
    };
    for(const [from,to,color] of [[-1,-.88,teal],[-.88,-.80,coral],[-.8,.80,'#e7c591'],[.8,.88,coral],[.88,1,teal]]) {
      const ns=Math.max(3,Math.ceil((to-from)*12)),ring=samples(0,Math.PI*2,10);
      for(let j=0;j<ring.length-1;j++) {
        ribbon(p,color,samples(from,to,ns).map(u=>[floatPoint(u,ring[j]),floatPoint(u,ring[j+1])]));
      }
    }
    for(const z of [-.83,.82]) {
      const reach=z+Math.sign(z)*.055;
      p.stroke(bamboo,[[s*.302,.493,z],[s*.454,.548,z+.012],
        [s*.698,.478,z+.029],[s*.884,.287,reach],[x,.116,reach]],.041,.90,13,9);
      p.stroke('#b99060',[[s*.374,.48,z+.036],[s*.663,.410,z+.045],[s*.895,.20,reach+.026]],.018,.80,9,7);
      for(const shift of [-.02,.02]) {
        const ring=samples(-.60,Math.PI+.60,10).map(a=>[x+Math.cos(a)*.082,.056+Math.sin(a)*.084,reach+shift]);
        p.stroke(binding,ring,.009,.93,11,6);
      }
      p.stroke(binding,[[s*.345,.483,z-.031],[s*.352,.535,z-.019],[s*.368,.543,z+.024],[s*.38,.486,z+.041]],.009,.82,7,6);
    }
    const u=.80,xEye=s*(width(u)*.991),yEye=keel(u)+(rail(u)-keel(u))*.72;
    const rot=[0,-s*.38,0];
    p.oval('#f9e7bd',xEye,yEye,u*length,.016,.039,.076,rot);
    p.dot(teal,xEye+s*.014,yEye,u*length+.003,.011,.027,.034,rot);
    p.dot('#393f3c',xEye+s*.021,yEye+.003,u*length+.006,.008,.017,.017,rot);
  }
  return p.finish();
}

function buildBoard(Part) {
  const p=new Part();
  const width=z=>.008+.317*Math.pow(Math.max(0,1-(z*.965+.035)**2),.67)*(1-.09*z);
  const deck=(f,t)=>{
    const z=t+f*.088*(1-t*t);
    return [f*width(z),.045+.034*(1-f*f)+.009*Math.abs(z)**3,z];
  };
  const paint=[[-1,-.831,teal],[-.831,-.798,cream],[-.798,-.688,coral],[-.688,-.648,honey],
    [-.648,-.611,cream],[-.611,-.538,'#82b9a3'],[-.538,.470,cream],[.470,.498,'#e9bb77'],
    [.498,.553,coral],[.553,.586,cream],[.586,1,'#eac38b']];
  const cross=[-1,-.78,-.48,-.18,-.015,.015,.18,.48,.78,1];
  for(const [a,b,paintColor] of paint) {
    const line=samples(a,b,Math.max(2,Math.ceil((b-a)*22)));
    for(let i=0;i<cross.length-1;i++){
      const f=cross[i],g=cross[i+1],color=f===-.015?'#bb946d':paintColor;
      ribbon(p,color,line.map(t=>[deck(f,t),deck(g,t)]),true);
    }
  }
  const stations=samples(-1,1,40);
  const rim=(z,s,w,y)=>[s*width(z)*w,y+.009*Math.abs(z)**3,z];
  for(const s of [-1,1]) {
    const profile=[[.82,-.031,'#e6a970'],[.975,-.013,'#d88761'],[1.018,.017,coral],[1,.045]];
    for(let i=0;i<profile.length-1;i++) {
      const [w,y,c]=profile[i],[v,h]=profile[i+1];
      ribbon(p,c,stations.map(z=>[rim(z,s,w,y),rim(z,s,v,h)]),s<0);
    }
  }
  ribbon(p,'#e6b884',stations.map(z=>[rim(z,-1,.82,-.031),rim(z,1,.82,-.031)]));
  for(const z of [-1,1]) {
    const points=[rim(z,-1,1,.045),rim(z,-1,.82,-.031),rim(z,1,.82,-.031),rim(z,1,1,.045),deck(0,z)];
    p.surface(coral,points.flat(),z<0?[0,2,1,0,3,2,0,4,3]:[0,1,2,0,2,3,0,3,4]);
  }
  // A small swept single fin stays visible when the board is carried ashore.
  const fin=s=>[[s*.014,-.023,-.47],[s*.011,-.161,-.70],[s*.006,-.176,-.795],
    [s*.007,-.096,-.745],[s*.014,-.023,-.735]];
  for(const s of [-1,1]) p.surface(teal,fin(s).flat(),s<0?[0,2,1,0,3,2,0,4,3]:[0,1,2,0,2,3,0,3,4]);
  ribbon(p,teal,fin(-1).map((pt,i)=>[pt,fin(1)[i]]),true);
  return p.finish();
}

function buildSwell(T,Part) {
  const foam=new Part();
  const point=(u,v)=>{
    const fan=Math.max(0,1-u*u)**.52;
    const crest=-1.045+.63*u*u+.13*u;
    const face=Math.exp(-((v-.40)**2)/(v<.40?.014:.073));
    const shoulder=.121*Math.exp(-((u+.48)**2)/.08)+.061*Math.exp(-((u-.51)**2)/.12);
    const height=-.100+fan*(.045+(.218+shoulder)*face);
    const z=crest+(.40-v)*(1.37*fan+.16)+.064*face;
    return [u*(.94+.11*fan),height,z];
  };
  const trough=new T.Color('#357f92'),water=new T.Color('#33a9b3'),lip=new T.Color('#8de1cf'),tint=new T.Color();
  const points=[],colors=[],indices=[];
  const across=36,along=20;
  for(let a=0;a<=across;a++) for(let b=0;b<=along;b++) {
    const u=2*a/across-1,v=b/along,p=point(u,v);
    points.push(...p);
    const face=Math.exp(-((v-.38)**2)/.060);
    tint.copy(trough).lerp(water,.21+.75*face).lerp(lip,.79*Math.exp(-((v-.39)**2)/.018));
    const feather=Math.min(1,(1-Math.abs(u))*7.5,Math.sin(Math.PI*v)*3.2);
    colors.push(tint.r,tint.g,tint.b,feather*(.60+.35*face));
    if(a<across&&b<along) {const k=a*(along+1)+b;indices.push(k,k+along+1,k+1,k+1,k+along+1,k+along+2);}
  }
  const wave=new T.BufferGeometry();
  wave.setAttribute('position',new T.Float32BufferAttribute(points,3));
  wave.setAttribute('color',new T.Float32BufferAttribute(colors,4));
  wave.setIndex(indices);wave.computeVertexNormals();
  for(const [a,b] of [[-.956,-.78],[-.750,-.41],[-.375,.035],[.07,.37],[.394,.70],[.745,.910]]) {
    const line=samples(a,b,12);
    const cap=line.map((u,i)=>{
      const broad=.032*Math.sin(Math.PI*i/(line.length-1))**.64;
      const center=.393+.012*Math.sin(17*u);
      const front=point(u,center-broad),back=point(u,center+broad);
      front[1]+=.014;back[1]+=.017;
      return [front,back];
    });
    ribbon(foam,'#d3efdf',cap,true);
    const path=line.map(u=>{const p=point(u,.39+.014*Math.sin(17*u));p[1]+=.018;return p;});
    foam.stroke('#f4f5dc',path,.032,.24,12,7);
  }
  for(let i=0;i<13;i++) {
    const u=-.92+i*.151,p=point(u,.316+.034*Math.sin(i*3.35));p[1]+=.011;
    foam.dot(i%3?'#c6e8de':'#edf3df',...p,.022+.009*Math.sin(i),.010,.016);
  }
  for(const s of [-1,1]) {
    const wake=[[s*.208,.043,-.855],[s*.280,.056,-.738],[s*.343,.046,-.60],[s*.350,.038,-.475]];
    foam.stroke('#d7eee0',wake,.014,.19,11,6);
  }
  return {wave,foam:foam.finish()};
}

export function createWaterGear(T) {
  const {Part,clay}=clayStudio(T);
  if(!gearGeometry.has(T)) {
    const swell=buildSwell(T,Part);
    const deck=clay.clone();
    deck.transparent=true;
    gearGeometry.set(T,{
      hull:buildCanoe(Part),board:buildBoard(Part),deck,...swell,
      water:new T.MeshStandardMaterial({vertexColors:true,roughness:.55,transparent:true,opacity:.92,depthWrite:false,side:T.DoubleSide}),
      whitewater:new T.MeshStandardMaterial({vertexColors:true,roughness:.73,transparent:true,opacity:.94,depthWrite:false})
    });
    gearGeometry.get(T).water.forceSinglePass=true;
  }
  const geo=gearGeometry.get(T);
  const put=(parent,name,shape,material=clay)=>{
    const mesh=new T.Mesh(shape,material);mesh.name=name;mesh.receiveShadow=material===clay;
    mesh.castShadow=material===clay;parent.add(mesh);return mesh;
  };
  const boat=new T.Group();boat.name='Jukung';put(boat,'Painted dugout and bamboo outriggers',geo.hull);
  function createBoard() {
    const board=new T.Group();board.name='Surfboard';board.renderOrder=2;
    const deck=put(board,'Striped single-fin board',geo.board,geo.deck);
    deck.renderOrder=2;deck.castShadow=true;deck.receiveShadow=true;
    const swell=new T.Group();swell.name='Swell';swell.visible=false;board.add(swell);
    // The transparent lagoon covers the whole scene and writes no depth. Composite
    // the local water and its foam after it, retaining the board's depth silhouette.
    swell.renderOrder=3;
    put(swell,'Wave face',geo.wave,geo.water).renderOrder=3;
    put(swell,'Broken foam crest',geo.foam,geo.whitewater).renderOrder=4;
    return board;
  }
  return {boat,createBoard};
}
