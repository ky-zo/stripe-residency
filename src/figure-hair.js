const TAU=Math.PI*2;
const longCuts=new Set(['long','halfUp','wings','curtains','bangs','layered']);

function restOnForehead(path,faceZ,padding=.015) {
  for(const p of path) {
    if(p[2]>.098&&p[1]<.309) {
      const surface=faceZ(p[0],p[1]-.012)*1.05+padding;
      const temple=Math.max(0,Math.min(1,(Math.abs(p[0])-.145)/.082));
      p[2]=Math.max(surface,p[2]+(Math.min(p[2],surface+.012)-p[2])*temple);
    }
  }
  return path;
}

function shortLocks(part,look,mix,faceZ) {
  const {style,hair,id}=look;
  const swept=style==='swoop',spiky=style==='silverQuiff';
  const tall=style==='quiff'||spiky;
  const clipped=style==='combed'||style==='fade';
  const count=swept?9:clipped?8:10;
  const height=tall?(spiky?.376:id==='fiachrarm'?.337:.355):clipped?.321:.339;
  const brown=spiky?'#c0b2a7':'#bf976d';
  const lightness=swept?.031:spiky?.11:.075;
  for(let j=0;j<count;j++) {
    const t=j/(count-1),x=(t-.5)*.418;
    const dome=Math.sqrt(Math.max(.02,1-(x/.31)**2));
    const wave=Math.sin(j*2.72)*.011;
    const path=swept?[
      [.158-.098*t,.256-.015*t,-.130+.063*t],
      [.191-.105*t,.304-.012*t,-.017+.036*t],
      [.133-.174*t,.333-.017*t,.092+.047*t],
      [.028-.193*t,.291-.027*t,.180+.027*t],
      [-.058-.168*t,.223-.043*t,.212-.038*t],
      [-.135-.114*t,.137-.031*t,.212-.094*t]
    ]:[
      [x*.76+.034,.224*dome,-.155],
      [x*.90+.035,.296*dome,-.101],
      [x*.92+.032+wave,(height+wave)*dome,-.008],
      [x*.93+.014+wave,(height+.002+wave)*dome,.091],
      [x*.95-.016,(height-.038+wave)*dome,.168],
      [x*.90-.053,(clipped?.225:.206)*dome+.017*Math.sin(t*2.4)+wave,.214-.038*Math.abs(t-.47)*2]
    ];
    if(clipped) for(const p of path) {p[0]+=.040*t;p[2]-=.015;}
    if(tall) {
      for(let k=2;k<5;k++) path[k][0]-=.011*Math.sin(j*.85+k*.49);
      if(id==='fiachrarm') { path[3][0]+=.016*Math.sin(j*1.2);path[4][1]+=.011*Math.cos(j*.9); }
    }
    const shade=mix(hair,brown,lightness*(.35+.65*(.5+.5*Math.sin(j*2.34))));
    restOnForehead(path,faceZ,swept?.015:.020);
    part.lock(shade,path,swept?.046:clipped?.041:.048,tall?.035:.025,.11,15);
    if(j%2===1) {
      const thread=path.slice(1,-1).map(([x,y,z],k)=>[x-.004,y+.015*Math.sin((k+1)*.61),z+.010]);
      part.stroke(mix(hair,brown,lightness*1.35),thread,.0042,.12,10,5);
    }
  }
  if(tall||style==='swept'||style==='combed') {
    const tousled=id==='fiachrarm',pushed=id==='josefbuettgen'||id==='sandrokratz',neat=style==='combed';
    const strands=tousled?10:neat?5:pushed?5:spiky?7:6;
    for(let j=0;j<strands;j++) {
      const t=j/(strands-1),x=(t-.5)*.374+.011*Math.sin(j*3.13+1.3);
      const side=Math.abs(t-.47)*2,rag=Math.sin(j*2.09)*.012;
      const y=.222-.049*side+rag+(pushed?.021:neat?.013:0);
      const shift=(spiky?.060:tousled?.039:neat?.098:pushed?.077:.068)*(1+.23*Math.sin(j*1.84));
      const bend=tousled?.017*Math.sin(j*2.52):spiky?-.012*Math.cos(j*.94):.008;
      const path=[[x+shift*.25,y+.070,.140],[x+shift,y+.081+bend,.153],
        [x+shift*(tousled?.68:.92),y+.064+rag,.190],[x+shift*.26+bend,y+.030,.217],
        [x-shift*.37,y,.230],[x-shift*.45+bend,y-.006+rag,.228]];
      restOnForehead(path,faceZ,.024);
      const width=(tousled?.026:neat?.029:pushed?.033:.034)+rag*.18;
      part.lock(mix(hair,brown,lightness*(.45+.55*(j%3)/2)),path,width,tousled?.016:.019,.045,12);
      if(j%2===0&&!neat) {
        const fiber=path.slice(1,-1).map(([a,b,c],k)=>[a+.004,b+.011-k*.001,c+.009+k*.0015]);
        part.stroke(mix(hair,brown,lightness*1.5),fiber,.0026,.15,8,5);
      }
    }
  }
  if(spiky) for(const s of [-1,1]) {
    for(let j=0;j<8;j++) {
      const t=j/7,z=-.121+t*.248;
      part.lock(mix(hair,'#c4bbb0',.29+.14*Math.sin(j*.9)),[[s*(.262+.019*Math.cos(t)),.172,z-.027],
        [s*(.294-.016*Math.abs(t-.56)),.111,z],[s*(.294-.018*Math.abs(t-.5)),.067,z+.006]],.012,.009,.10,6);
    }
  }
}

function curledLocks(part,look,mix) {
  const {hair,id}=look;
  const tight=id==='sup_nim';
  const high=id==='loaibassam';
  const density=tight?15:14;
  for(let row=0;row<3;row++) {
    const n=density-row*4;
    const radius=[.236,.167,.084][row];
    for(let j=0;j<n;j++) {
      const a=j/n*TAU+row*.54;
      const rr=radius+.009*Math.sin(j*2.32+row);
      const w=(tight?.051:.059)+.007*Math.sin(j*3.81+row);
      const baseY=[.187,.262,.299][row]+Math.cos(a)*.024+(high?.020:0);
      const r=[Math.sin(a),0,Math.cos(a)],t=[Math.cos(a),0,-Math.sin(a)];
      const c=[r[0]*rr,baseY,r[2]*rr*.85-.020];
      const shade=mix(hair,'#957b68',.025+.040*(.5+.5*Math.sin(j*1.79+row)));
      part.dot(shade,c[0],c[1],c[2],w*1.16,w*.90,w,[.12,a,.23*Math.sin(j)]);
      const path=[];
      for(let step=0;step<7;step++) {
        const f=step/6,phase=f*4.8+.34*Math.sin(j*2.21);
        const across=Math.sin(phase)*w*.77,up=Math.cos(phase)*w*.59;
        path.push([c[0]+t[0]*across+r[0]*w*(.57+.21*Math.sin(f*Math.PI)),c[1]+up+.018,
          c[2]+t[2]*across+r[2]*w*.63]);
      }
      part.lock(mix(shade,'#ad8a68',.034),path,w*.37,w*.34,.12,9);
    }
  }
}

function splitFringe(part,look,mix,faceZ) {
  const {hair,style}=look;
  const short=style==='parted';
  const off=style==='layered'?-.069:style==='curtains'?.003:style==='halfUp'?-.025:.00;
  for(const s of [-1,1]) {
    for(let j=0;j<5;j++) {
      const t=j/4,front=.235-.155*t;
      const path=[
        [off+s*(.016+.057*t),.305+.011*(1-t),-.080-.069*t],
        [off+s*(.036+.086*t),.332-.017*t,.020-.082*t],
        [off+s*(.085+.108*t),.310-.019*t,.126-.075*t],
        [off+s*(.145+.092*t),.251-.018*t,front],
        [off+s*(.207+.068*t),.177-.024*t,front-.006],
        [off+s*(.235+.035*t),short?.092-.018*t:.044-.061*t,front-.048]
      ];
      if(style==='halfUp'&&j>1) path[5][2]-=.067;
      if(short) {
        path[3][0]-=s*.033;
        path[4][0]-=s*.038;path[4][1]-=.020;
        path[5][0]+=s*.028;path[5][1]+=.036;
        path[5][2]+=.034;
      }
      if(style==='wings') {path[3][0]+=s*.011;path[4][0]+=s*.019;}
      restOnForehead(path,faceZ,.020+.008*(1-t));
      const tint=mix(hair,'#b18b69',.016+.037*(1-t));
      part.lock(tint,path,.043-.006*t,.028-.006*t,.075,15);
    }
  }
}

function fallingLocks(part,look,mix) {
  const {hair,style}=look;
  const long=style!=='wings'&&style!=='curtains';
  const bottom=long?-.410:style==='wings'?-.255:-.160;
  const wave=style==='layered'||style==='wings'||style==='bangs';
  const mid=(bottom+.18)/2;
  part.oval(hair,0,(bottom+.26)/2,-.139,.302,(.27-bottom)/2,.151);
  for(let j=0;j<9;j++) {
    const x=(j-4)*.061;
    const z=-.150-.145*Math.sqrt(Math.max(.02,1-(x/.31)**2));
    const bend=(wave?.026:.010)*Math.sin(j*1.39);
    const y=bottom+.021*Math.abs(j-4);
    const path=[[x*.53,.276,-.145],[x*.84,.183,z+.006],[x+bend*.35,.040,z-.009],
      [x+bend,-.094,z-.011],[x-bend*.3,(y-.085)/2,z-.011],[x+bend,y,z+.024]];
    part.lock(mix(hair,'#ae886a',.025+.043*((j%3)/2)),path,.046,.027,.14,14);
  }
  for(const s of [-1,1]) {
    const tuck=(style==='halfUp')||(style==='bangs'&&s>0)||(style==='layered'&&s<0);
    const z=tuck?-.032:.049;
    part.oval(hair,s*.260,mid,z,tuck?.062:.079,(.21-bottom)*.50,tuck?.096:.104,[.037,0,s*.055]);
    for(let j=0;j<3;j++) {
      const f=j/2,front=z+.079-.096*f,ww=wave?.049:.017;
      const dir=style==='layered'?s*1.22:s;
      const path=[[s*(.207+.033*f),.205,front+.071],[s*.269,.110,front+.068],
        [s*(.278+.012*f),.007,front+.063],[s*.251,-.083,front+.066],
        [s*(.267+ww),bottom*.53,front+.033],
        [s*.290+dir*ww,bottom*.89,front+.004],[s*.28+dir*ww*(.4+f),bottom+.016*f,front-.012]];
      if(!long) {path[4][1]=-.103;path[5][1]=bottom*.89;}
      part.lock(mix(hair,'#c29369',.043+.058*(1-f)),path,.039-.006*f,.032-.004*f,.095,13);
    }
  }
  if(style==='halfUp') {
    part.oval(hair,0,.017,-.252,.126,.18,.083);
    part.dot('#887568',0,-.038,-.329,.025,.019,.011);
  }
}

export function groomHair(part,look,mix,faceZ) {
  if(look.style==='curls') return curledLocks(part,look,mix);
  if(longCuts.has(look.style)) fallingLocks(part,look,mix);
  if(look.style==='bangs') {
    for(let j=-4;j<=4;j++) {
      const x=j*.048,spread=Math.abs(j)/4;
      const path=[[x*.51,.278,.061],[x*.77,.273,.149],[x*.92,.224,.212-.048*spread],
        [x, .166,.248-.066*spread],[x+.013*Math.sin(j),.104+.020*spread+.012*(j===0),.261-.078*spread]];
      restOnForehead(path,faceZ,.014);
      part.lock(mix(look.hair,'#a88a66',.035+.025*(j%2===0)),path,.035,.025,.07,12);
    }
    return;
  }
  if(longCuts.has(look.style)||look.style==='parted') return splitFringe(part,look,mix,faceZ);
  shortLocks(part,look,mix,faceZ);
}
