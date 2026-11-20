import data from './portrait-sculpts.json' with { type: 'json' };

// Each head retains its offline clay portrait's measured three-dimensional surface.
// The outer rim joins a complete skull. Eyes, teeth, brows and eyewear are molded pieces.
const outline=[10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109];
const eyeLoops=[
  [33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246],
  [362,382,381,380,374,373,390,249,263,466,388,387,386,385,384,398]
];
const eyebrows=[[[70,46],[63,53],[105,52],[66,65],[107,55]],[[336,285],[296,295],[334,282],[293,283],[300,276]]];
const mouthLoop=[78,95,88,178,87,14,317,402,318,324,308,415,310,311,312,13,82,81,80,191];
const tau=Math.PI*2;
const toLinear=Array.from({length:256},(_,i)=>{const v=i/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});
const range=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));

function typed(base64,type) {
  const bytes=Uint8Array.from(atob(base64),ch=>ch.charCodeAt(0));
  return new type(bytes.buffer);
}
const triangles=typed(data.faces,Uint16Array);
const midpoints=typed(data.midpoints,Uint16Array);
const original=typed(data.original,Uint16Array);

function midpoint(a,b) { return a.map((n,j)=>(n+b[j])/2); }
function centroid(points) { return points.reduce((sum,p)=>sum.map((n,j)=>n+p[j]/points.length),[0,0,0]); }

function dataFor(id) {
  const entry=data.residents[id];
  if(!entry) return null;
  const base=typed(entry[0],Int16Array),ink=typed(entry[1],Uint8Array);
  const landmarks=Array.from({length:478},(_,i)=>[base[i*3]/data.scale,base[i*3+1]/data.scale,base[i*3+2]/data.scale]);
  const positions=landmarks.slice(0,468);
  const normals=Array.from({length:468},()=>[0,0,0]);
  for(let i=0;i<original.length;i+=3) {
    const [ai,bi,ci]=[original[i],original[i+1],original[i+2]];
    const [a,b,c]=[landmarks[ai],landmarks[bi],landmarks[ci]];
    const x=b.map((v,k)=>v-a[k]),y=c.map((v,k)=>v-a[k]);
    const n=[x[1]*y[2]-x[2]*y[1],x[2]*y[0]-x[0]*y[2],x[0]*y[1]-x[1]*y[0]];
    for(const idx of [ai,bi,ci]) for(let j=0;j<3;j++) normals[idx][j]+=n[j];
  }
  function normalize(v) { const length=Math.hypot(...v)||1;return v.map(x=>x/length); }
  for(let i=0;i<normals.length;i++) normals[i]=normalize(normals[i]);
  for(let i=0;i<midpoints.length;i+=2) {
    const a=midpoints[i],b=midpoints[i+1];
    positions.push(midpoint(positions[a],positions[b]));
    normals.push(normalize(midpoint(normals[a],normals[b])));
  }
  const paint=new Float32Array(ink.length);
  for(let i=0;i<ink.length;i++) paint[i]=toLinear[ink[i]];
  return {landmarks,positions,paint,normals:normals.flat(),mouth:typed(entry[2],Uint8Array)};
}

function skull(part,p,look,mix,faceNormals,faceColors) {
  const rim=outline.map(i=>p[i]);
  const vertices=[],faces=[],colors=[],normals=[];
  const latitude=[0,.19,.41,.58,.74,.86,.95,1];
  const beard=look.beard==='full' || look.beard==='short';
  for(let k=0;k<latitude.length;k++) {
    const t=latitude[k];
    for(const [j,[x,y,z]] of rim.entries()) {
      const a=Math.atan2(x,(y+.007));
      const restX=Math.sin(a)*.311,restY=Math.cos(a)*.303+.008;
      const s=Math.min(1,t/.42),u=Math.max(0,(t-.42)/.58);
      const arc=Math.cos(u*Math.PI/2);
      const px=(x+(restX-x)*s)*arc,py=(y+(restY-y)*s)*arc+.016*u;
      const pz=z*(1-s)-.015*s-.247*Math.sin(u*Math.PI/2);
      vertices.push(px,py,pz);
      const h=outline[j]*3,n=[px/.311**2,(py-.012)/.305**2,(pz+.012)/.269**2];
      const length=Math.hypot(...n)||1,blend=Math.min(1,t/.46);
      const value=n.map((v,k)=>faceNormals[h+k]*(1-blend)+v/length*blend);
      const l=Math.hypot(...value)||1;
      normals.push(...value.map(v=>v/l));
      const beardTone=beard?range((-y-.13)/.13,0,1)*Math.max(0,1-u*2)*.47:0;
      const tint=mix(look.skin,look.hair,beardTone),fade=range((t-.12)/.7,0,1);
      const blendColor=fade*fade*(3-2*fade);
      colors.push(...[tint.r,tint.g,tint.b].map((c,k)=>faceColors[h+k]+(c-faceColors[h+k])*blendColor));
    }
  }
  for(let k=0;k<latitude.length-1;k++) for(let j=0;j<rim.length;j++) {
    const a=k*rim.length+j,b=k*rim.length+(j+1)%rim.length;
    faces.push(a,b,a+rim.length,b,b+rim.length,a+rim.length);
  }
  part.surface(look.skin,vertices,faces,colors,normals);
}

function beardRelief(part,loaded,look,mix) {
  if(!look.beard) return;
  const {positions,paint,normals,landmarks:p}=loaded;
  const full=look.beard==='full',goatee=look.beard==='goatee',shadow=look.beard==='shadow';
  const lipY=(p[13][1]+p[14][1])/2,lipX=(p[61][0]+p[291][0])/2;
  const lipW=Math.abs(p[61][0]-p[291][0])*.5+.008;
  const lipH=Math.max(.019,(p[0][1]-p[17][1])*.53);
  const pigment=mix(look.hair,'#6d5043',shadow?.34:.09);
  const soften=v=>{const t=range(v,0,1);return t*t*(3-2*t);};
  for(let i=0;i<positions.length;i++) {
    const q=positions[i],x=q[0],y=q[1],side=Math.min(1,Math.abs(x)/.29);
    const high=lipY-.032+.146*side**2.35;
    let amount=soften((high-y)/.037);
    const lipEllipse=((x-lipX)/lipW)**2+((y-lipY)/lipH)**2;
    amount*=soften((lipEllipse-.78)/.45);
    if(goatee) amount*=.20+.72*Math.exp(-((x/.105)**2));
    amount*=full?.92:shadow?.22:goatee?.78:.63;
    const j=i*3,relief=amount*(full?.019:.007);
    q[0]+=normals[j]*relief;
    q[1]+=normals[j+1]*relief-Math.max(0,(-y-.22)*.16)*amount;
    q[2]+=normals[j+2]*relief;
    const variation=.92+.12*Math.sin(x*230+y*34)*Math.sin(y*149);
    for(let k=0;k<3;k++) {
      const ink=[pigment.r,pigment.g,pigment.b][k]*variation;
      paint[j+k]+=(ink-paint[j+k])*amount;
    }
  }
  if(!shadow) for(const [s,points] of [[-1,[72,73,74,61]],[1,[302,303,304,291]]]) {
    const path=points.map((idx,j)=>{const q=p[idx];return [q[0]+s*.003,q[1]+.006,q[2]+.006+j*.0007];});
    part.lock(mix(pigment,look.skin,full?.11:.33),path,full?.011:.007,full?.009:.006,.12,9);
  }
}

function dome(part,color,boundary,center,bulge,yOffset=0) {
  const vertices=[],faces=[];
  const ring=boundary.slice().sort((a,b)=>Math.atan2(a[1]-center[1],a[0]-center[0])-Math.atan2(b[1]-center[1],b[0]-center[0]));
  const n=ring.length;
  for(const t of [.003,.38,.72,1]) {
    for(const q of ring) vertices.push(center[0]+(q[0]-center[0])*t,center[1]+(q[1]-center[1])*t-yOffset,
      center[2]+(q[2]-center[2])*t+bulge*(1-t*t));
  }
  for(let j=0;j<n;j++) for(let k=0;k<3;k++) {
    const a=k*n+j,b=k*n+(j+1)%n;
    faces.push(a,a+n,b,a+n,b+n,b);
  }
  part.surface(color,vertices,faces);
}

function skinEye(part,eyes,p,loop,irisId,look,side,mix) {
  const rim=loop.map(i=>p[i]);
  const c=centroid(rim);
  const width=Math.max(...rim.map(v=>v[0]))-Math.min(...rim.map(v=>v[0]));
  const height=Math.max(...rim.map(v=>v[1]))-Math.min(...rim.map(v=>v[1]));
  const forward={left:rim.reduce((a,b)=>a[0]<b[0]?a:b),right:rim.reduce((a,b)=>a[0]>b[0]?a:b)};
  const slope=(forward.right[2]-forward.left[2])/Math.max(.04,width);
  const angle=-Math.atan(slope);
  const closed=rim.map(q=>[q[0],q[1],q[2]-.012]);
  dome(part,mix(look.skin,'#a96f5c',.12),closed,[c[0],c[1],c[2]-.008],.004);
  dome(eyes,'#d9c9b5',rim,c,.014,.025);
  const other=centroid(eyeLoops[side>0?0:1].map(i=>p[i]));
  const gaze=(p[irisId][0]-c[0]+p[side>0?468:473][0]-other[0])*.50;
  const ix=c[0]+range(gaze,-.009,.009),iy=c[1]+range(p[irisId][1]-c[1],-.002,.002);
  const rz=c[2]+(ix-c[0])*slope+.014;
  const rx=range(width*.34,.022,.040),ry=Math.min(rx,height*.485);
  const irisTone=look.iris||'#5e4535';
  eyes.oval('#453c35',ix,iy-.025,rz+.001,rx,ry,.005,[0,angle,0]);
  eyes.oval(irisTone,ix,iy-.025,rz+.004,rx*.81,ry*.80,.004,[0,angle,0]);
  eyes.dot('#252629',ix,iy-.025,rz+.007,rx*.52,ry*.56,.0037,[0,angle,0]);
  eyes.dot('#fff7db',ix-.0065,iy-.025+.0048,rz+.010,.0039,.0036,.002,[0,angle,0]);
  const upper=loop.slice(8).concat(loop[0]).map(i=>[p[i][0],p[i][1]+.001,p[i][2]+.003]);
  const lower=loop.slice(0,9).map(i=>[p[i][0],p[i][1]-.001,p[i][2]+.001]);
  part.stroke(mix(look.hair,look.skin,.29),upper,.0045,.23,11,5);
  part.stroke(mix(look.skin,'#b27260',.32),lower,.0036,.24,10,5);
  const browPairs=eyebrows[side>0?1:0];
  const top=browPairs.map(([a,b])=>{const q=midpoint(p[a],p[b]);q[2]+=.005;return q;});
  const browColor=mix(look.hair,'#815c47',.19);
  part.lock(browColor,top,.010,.010,.16);
}

function sculptMouth(part,p,look,mix,paint) {
  const gap=p[13][1]-p[14][1];
  const top=[78,191,80,81,82,13,312,311,310,415,308];
  const bottom=[78,95,88,178,87,14,317,402,318,324,308];
  const pts=[],idx=[],colors=[],normals=[];
  const interp=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
  for(let y=0;y<9;y++) for(let x=0;x<31;x++) {
    const u=x/3,i=Math.min(9,Math.floor(u)),v=y/8;
    const hi=interp(p[top[i]],p[top[i+1]],u-i),lo=interp(p[bottom[i]],p[bottom[i+1]],u-i);
    const q=interp(hi,lo,v),k=(y*31+x)*3;
    const lum=(paint[k]+paint[k+1]+paint[k+2])/(3*255);
    q[2]-=.001+Math.sin(v*Math.PI)*Math.min(.009,Math.max(0,gap)*.19)*(1-lum);
    pts.push(...q);colors.push(toLinear[paint[k]],toLinear[paint[k+1]],toLinear[paint[k+2]]);
    const nx=q[0]*2.1,ny=q[1]*.56,length=Math.hypot(nx,ny,1);
    normals.push(nx/length,ny/length,1/length);
    if(x&&y) {const j=y*31+x;idx.push(j-32,j-1,j-31,j-31,j-1,j);}
  }
  part.surface('#c89b87',pts,idx,colors,normals);
  const lower=[61,146,91,181,84,17,314,405,321,375,291].map(i=>[p[i][0],p[i][1]+.001,p[i][2]+.001]);
  part.stroke(mix(look.skin,'#b37064',.28),lower,.0027,.2,14,5);
}

function spectacles(part,p,look) {
  if(!look.glasses) return;
  const circular=look.glasses==='wire';
  const tint=circular?'#6d6862':look.glasses==='amber'?'#805937':'#353435';
  const centers=[];
  for (let side=0;side<2;side++) {
    const loop=eyeLoops[side].map(i=>p[i]),c=centroid(loop);
    const xSpan=(Math.max(...loop.map(v=>v[0]))-Math.min(...loop.map(v=>v[0])));
    const rx=Math.max(.078,xSpan*.74),ry=circular?.077:.054;
    const direction=side?1:-1;
    const factor=circular?1:look.glasses==='softSquare'?.72:.56;
    const z0=c[2]+.039;
    const points=[];
    for (let j=0;j<=26;j++) {
      const a=j/26*tau,cs=Math.cos(a),sn=Math.sin(a);
      const x=Math.sign(cs)*Math.abs(cs)**factor*rx;
      points.push([c[0]+x,c[1]+.008+Math.sign(sn)*Math.abs(sn)**factor*ry,z0-direction*x*.18]);
    }
    part.stroke(tint,points,circular?.0052:look.glasses==='amber'?.0062:look.glasses==='thinSquare'?.0065:.0086,.97,32,6);
    part.stroke(tint,[[c[0]+direction*rx*.95,c[1]+.028,z0-rx*.15],
      [direction*.254,c[1]+.036,.166],[direction*.307,.069,.05],[direction*.309,.044,-.018]],circular?.0055:.0073,1,9,5);
    centers.push([c[0]-direction*rx,c[1]+.021,z0+rx*.16]);
  }
  const center=midpoint(...centers);center[1]+=.009;center[2]+=.010;
  part.stroke(tint,[centers[0],center,centers[1]],circular?.0055:.007,1,7,6);
}

export function sculptPortrait(part,eyes,id,look,studio) {
  const loaded=dataFor(id);
  if(!loaded) return false;
  const {landmarks:p,positions,paint}=loaded;
  beardRelief(part,loaded,look,studio.mix);
  skull(part,p,look,studio.mix,loaded.normals,loaded.paint);
  part.surface(look.skin,positions.flat(),triangles,paint,loaded.normals);
  for(const s of [-1,1]) {
    const tucked=['long','bangs','wings','curtains'].includes(look.style)||
      ((look.style==='layered'||look.style==='halfUp')&&s>0);
    const earX=(s<0?p[234][0]:p[454][0])+s*(tucked?-.010:.010);
    const ear=studio.mix(look.skin,'#c48774',.25);
    part.oval(look.skin,earX,-.018,-.005,tucked?.035:.053,.079,.049,[.10,0,-s*.13]);
    part.oval(ear,earX+s*(tucked?.009:.023),-.019,.015,.021,.047,.028,[0,s*.38,-s*.10]);
    part.stroke(studio.mix(look.skin,'#f0c8a1',.24),[[earX+s*.019,.020,.034],[earX+s*.026,-.003,.04],[earX+s*.018,-.032,.039]],.006,.22,7,5);
  }
  skinEye(part,eyes,p,eyeLoops[0],468,look,-1,studio.mix);
  skinEye(part,eyes,p,eyeLoops[1],473,look,1,studio.mix);
  sculptMouth(part,p,look,studio.mix,loaded.mouth);
  spectacles(part,p,look);
  return true;
}
