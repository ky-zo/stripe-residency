import { onMat, PLAY_SPOTS, STRETCH_MAT, STUDIO_STOOL, SUNBEDS, WATER_Y } from './island-life.js';

const TAU=Math.PI*2;

function swimmerWakes(T,root) {
  const group=new T.Group();
  group.name='Swimmer wakes';
  root.add(group);
  const shapes=new T.BufferGeometry();
  const verts=[], indices=[];
  function crescent(rx,rz,z,a0,a1,width) {
    const first=verts.length/3, segments=18;
    for(let i=0;i<=segments;i++){
      const t=i/segments, a=a0+(a1-a0)*t, thickness=width*Math.sin(Math.PI*t)**.6;
      for(const side of [-1,1]) verts.push(Math.sin(a)*(rx+side*thickness),0,z+Math.cos(a)*(rz+side*thickness));
      if(i<segments) {
        const n=first+i*2;
        indices.push(n,n+1,n+2,n+2,n+1,n+3);
      }
    }
  }
  crescent(.50,.41,-.02,-1.34,1.20,.028);
  crescent(.67,.48,-.36,1.36,3.02,.022);
  crescent(.63,.57,-.43,3.08,4.95,.025);
  crescent(.81,.72,-.56,2.10,3.95,.019);
  shapes.setAttribute('position',new T.Float32BufferAttribute(verts,3));
  shapes.setIndex(indices);
  const foam=new T.MeshBasicMaterial({color:'#eff4d9',side:T.DoubleSide,transparent:true,opacity:.77,depthWrite:false});
  const dropsGeometry=new T.SphereGeometry(1,7,5);
  const dropPaint=new T.MeshStandardMaterial({color:'#cae6dc',roughness:.28,transparent:true,opacity:.90,depthWrite:false});
  const transform=new T.Object3D(), visible=new Map();
  function create(key) {
    const wake=new T.Group(), trails=new T.Mesh(shapes,foam);
    const drops=new T.InstancedMesh(dropsGeometry,dropPaint,6);
    trails.renderOrder=2;
    drops.renderOrder=2;
    drops.frustumCulled=false;
    wake.add(trails,drops);group.add(wake);
    const item={wake,trails,drops,last:0};
    visible.set(key,item);
    return item;
  }
  function clear(key) {
    const item=visible.get(key);
    if(!item)return;
    group.remove(item.wake);
    item.drops.dispose();
    visible.delete(key);
  }
  let lastSweep=0;
  return function setSwimmer(pose,serverTimeMs=0,key='resident') {
    if(serverTimeMs-lastSweep>700) {
      for(const [id,item] of visible)if(serverTimeMs-item.last>1100)clear(id);
      lastSweep=serverTimeMs;
    }
    if(!pose||pose.activity!=='swim'){clear(key);return;}
    const item=visible.get(key)||create(key);
    item.last=serverTimeMs;
    item.wake.position.set(pose.x,WATER_Y+.020,pose.z);
    item.wake.rotation.y=pose.yaw;
    const time=(serverTimeMs%120000)/1000;
    const pulse=.5+.5*Math.sin(time*3.45);
    item.trails.scale.set(.91+.10*pulse,1,.94+.11*pulse);
    for(let n=0;n<6;n++){
      const side=n%2 ? 1 : -1;
      const phase=(time*.85+(n%2)*.5+Math.floor(n/2)*.073)%1;
      const arc=Math.max(0,Math.sin(phase*Math.PI));
      const size=(.026+(.012*(n%3)))*arc;
      transform.position.set(side*(.26+.23*phase+n*.009),.025+arc*(.14+.028*(n%3)),.26-.49*phase+.025*n);
      transform.scale.set(size,size*1.28,size);
      transform.updateMatrix();item.drops.setMatrixAt(n,transform.matrix);
    }
    item.drops.instanceMatrix.needsUpdate=true;
  };
}

export function addShoreActivities(T,root,art) {
  const {batch,props,block,ball,rod,stick,disc,obstacle,shadows,stool}=art;
  const at=(frame,x,y,z)=>{
    const p=onMat(frame,x,z);
    return [p.x,y,p.z];
  };
  const piece=(frame,tint,x,y,z,w,h,d)=>block(batch,tint,...at(frame,x,y,z),w,h,d,0,frame.facing);
  const brace=(frame,tint,x0,y0,z0,x1,y1,z1,r)=>stick(batch,tint,at(frame,x0,y0,z0),at(frame,x1,y1,z1),r);
  function blocker(frame,x,z,w,d) {
    const centre=onMat(frame,x,z), c=Math.abs(Math.cos(frame.facing)),s=Math.abs(Math.sin(frame.facing));
    obstacle(centre.x,centre.z,c*w+s*d,s*w+c*d);
  }

  function chaise(bed) {
    const offset=bed.upright ? -.59 : -.94;
    const peak=bed.upright ? 1.10 : .88;
    const seatTop=.43, foot=1.03, hinge=-.16;
    const honey='#ba8753', teak='#977044', shade='#77543a', pale='#e3b67c';
    for(const x of [-.38,.38]) {
      brace(bed,honey,x,.33,hinge,x,.33,foot,.049);
      brace(bed,honey,x,.33,hinge,x,peak-.052,offset,.047);
      brace(bed,teak,x,.095,-.49,x,.34,.42,.041);
      brace(bed,honey,x,.093,.77,x,.34,-.29,.043);
      brace(bed,shade,x,.093,-.50,x,.092,.78,.033);
      brace(bed,teak,x,.10,-.45,x,peak-.12,offset+.10,.032);
      const pin=at(bed,x,.247,.06);
      ball(batch,'#dbb87b',...pin,.050,.050,.049);
    }
    for(let i=0;i<9;i++)piece(bed,i%2?honey:'#ca9966',0,.358,hinge+(foot-hinge)*i/8,.85,.065,.106);
    for(let i=0;i<6;i++) {
      const t=i/5;
      const y=.37+(peak-.37)*t,z=hinge+(offset-hinge)*t;
      piece(bed,i%2?'#c89762':'#c2935c',0,y,z,.85,.063,.115);
    }
    function fabric(stripLeft,stripRight,z0,y0,z1,y1,tone) {
      batch.quad(at(bed,stripLeft,y0,z0),at(bed,stripRight,y0,z0),at(bed,stripRight,y1,z1),at(bed,stripLeft,y1,z1),tone);
    }
    const stripes=7, width=.731;
    for(let k=0;k<stripes;k++) {
      const a=-width/2+k*width/stripes,b=a+width/stripes, tone=k%2?'#f5e4bd':bed.colour;
      fabric(a,b,foot+.025,.397,foot-.055,seatTop,tone);
      fabric(a,b,foot-.055,seatTop,hinge,seatTop,tone);
      fabric(a,b,hinge,seatTop,offset,peak+.027,tone);
      fabric(a,b,offset,peak+.027,offset-.035,peak-.038,tone);
    }
    for(const side of [-1,1]){
      const edge=side*width*.5;
      brace(bed,pale,edge,seatTop+.002,foot-.03,edge,seatTop+.002,hinge,.012);
      brace(bed,pale,edge,seatTop,hinge,edge,peak+.035,offset,.012);
    }
    // A rolled headrest makes the loose end of the canvas readable from above.
    const pillowZ=offset+.075, pillowY=peak-.023;
    const endA=at(bed,-.31,pillowY,pillowZ), endB=at(bed,.31,pillowY,pillowZ);
    rod(batch,bed.upright?'#e8d8ad':'#f4dfb4',endA,endB,.080);
    for(const side of [-.23,.23]) {
      rod(batch,bed.colour,at(bed,side-.013,pillowY,pillowZ),at(bed,side+.013,pillowY,pillowZ),.082);
    }
    for(const z of [-.50,.10,.75])blocker(bed,0,z,.72,.52);
    shadows.ellipse(bed.x,bed.z,1.02,.69,.19);
  }
  for(const bed of SUNBEDS)chaise(bed);

  // The coconut and paper parasol sit beside the chairs, leaving every face in view.
  const drinks={...onMat(SUNBEDS[0],-.74,-.22),facing:SUNBEDS[0].facing};
  disc(batch,'#a47c4d',drinks.x,.295,drinks.z,.26,.075);
  for(let k=0;k<3;k++){
    const a=TAU*k/3;
    stick(batch,'#ae8457',at(drinks,.18*Math.cos(a),.035,.18*Math.sin(a)),at(drinks,.13*Math.cos(a),.27,.13*Math.sin(a)),.031);
  }
  ball(batch,'#91984b',...at(drinks,0,.429,0),.132,.128,.126);
  disc(batch,'#e8d5a3',drinks.x,.539,drinks.z,.074,.018);
  brace(drinks,'#f4dba4',0,.54,0,.085,.72,.026,.016);
  brace(drinks,'#a78053',-.03,.53,.01,-.09,.785,.035,.010);
  batch.stamp(props.pan,'#ce7c62',...at(drinks,-.09,.759,.035),.112,.057,.112,Math.PI,0,-.13);
  const f=STRETCH_MAT;
  piece(f,'#76988a',0,.034,0,.77,.044,1.57);
  for(const z of [-.68,-.62,.62,.68])piece(f,'#c1ccaa',0,.060,z,.74,.010,.027);
  rod(batch,'#94ad99',at(f,-.38,.084,-.74),at(f,.38,.084,-.74),.057);

  // A second computer sits on the far side of the public seaside table.
  const work=STUDIO_STOOL;
  stool(work.x,work.z,'#87a38c',work.y);
  obstacle(work.x,work.z,.52,.46);
  piece(work,'#aab5a6',0,.951,.42,.61,.052,.32);
  piece(work,'#60766e',0,.984,.39,.47,.014,.13);
  for(let i=0;i<3;i++)piece(work,'#91a099',0,.992,.346+i*.043,.43,.009,.010);
  piece(work,'#cbd0bb',0,.985,.300,.145,.011,.056);
  function panel(width,y0,y1,z0,z1,colour,rear=false) {
    const o=rear ? .014 : 0;
    batch.quad(at(work,-width/2,y0,z0+o),at(work,width/2,y0,z0+o),at(work,width/2,y1,z1+o),at(work,-width/2,y1,z1+o),colour);
  }
  panel(.61,.970,1.274,.568,.647,'#839f94',true);
  panel(.59,.981,1.263,.568,.643,'#435d59');
  panel(.507,1.008,1.239,.569,.628,'#b0d2bc');
  for(const [x,y] of [[-.04,1.16],[.04,1.16],[0,1.135]]) {
    const z=.584+(y-.97)*.26;
    piece(work,'#eeb1a9',x,y,z,.055,.052,.015);
  }

  const jetty={x:2.27,z:-6.32,facing:Math.PI};
  for(const sx of [-.32,.32]){
    brace(jetty,'#a77f51',sx,.018,-.12,sx,.012,1.58,.064);
    for(const sz of [-.04,.69,1.47]){
      const p=at(jetty,sx,-.30,sz);
      disc(batch,'#956e46',p[0],-.29,p[2],.072,1.05);
      disc(batch,'#c89d66',p[0],.234,p[2],.074,.035);
    }
  }
  for(let k=0;k<10;k++)piece(jetty,k%3===1?'#c7a473':'#d1ae7c',0,.143,.025+k*.155,.86,.083,.14);
  for(const x of [-.22,.22]){
    brace(jetty,'#7d8d7e',x,-.69,1.61,x,.29,1.49,.029);
    brace(jetty,'#91a292',x,.29,1.49,x,.29,1.27,.030);
    brace(jetty,'#899e8c',x,.29,1.27,x,.17,1.23,.029);
  }
  for(const h of [-.48,-.23,.018])brace(jetty,'#a0aa96',-.22,h,1.56,.22,h,1.56,.027);

  function bandedRing(x,y,z,r,faceWater) {
    const sections=8;
    const tube=new T.TorusGeometry(r,r*.234,9,8,TAU/sections);
    for(let k=0;k<sections;k++) {
      // Rotate the local arc before laying the buoy flat or hanging it on its post.
      const segment=tube.clone();
      segment.rotateZ(TAU*k/sections);
      if(faceWater)segment.rotateX(-Math.PI/2);
      batch.stamp(segment,k%2?'#f6e2b5':'#d97051',x,y,z,1,1,1);
      segment.dispose();
    }
    tube.dispose();
  }
  const station=PLAY_SPOTS[1];
  const markerZ=station.z-.08;
  disc(batch,'#b4895b',station.x,.51,markerZ,.078,1.04);
  disc(batch,'#caa672',station.x,1.045,markerZ,.085,.061);
  bandedRing(station.x,station.hitY,station.z,.225,false);
  obstacle(station.x,markerZ,.28,.26);
  bandedRing(4.92,WATER_Y+.071,-10.29,.255,true);
  const buoys=[[-.22,-12.05],[1.17,-12.22],[2.59,-12.31],[4.03,-12.23],[5.30,-11.97]];
  for(let i=0;i<buoys.length;i++) {
    const [x,z]=buoys[i];
    ball(batch,i%2?'#eddfb5':'#d98161',x,WATER_Y+.045,z,.090,.100,.090);
    if(i) {
      const [px,pz]=buoys[i-1];
      stick(batch,'#c6be96',[px,WATER_Y+.025,pz],[x,WATER_Y+.025,z],.010);
    }
  }
  return swimmerWakes(T,root);
}
