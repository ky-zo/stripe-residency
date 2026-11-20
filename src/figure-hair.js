const TAU=Math.PI*2;
const longCuts=new Set(['long','halfUp','wings','curtains','bangs','layered']);

function strand(part,look,mix,faceZ,path,width,thickness,tint=0,taper=.27) {
  const points=path.map(([x,y,lift=.018])=>{
    const scalp=faceZ(x,Math.min(y-.006,.313));
    return [x,y+.009,scalp+lift+.012];
  });
  const color=mix(look.hair,'#aa846b',tint);
  part.lock(color,points,width,thickness*1.42,Math.max(.32,taper),16);
}

function sideSweep(part,look,mix,faceZ) {
  const hair=[
    [[[.14,.278],[.083,.326],[-.005,.337],[-.100,.307],[-.181,.245],[-.245,.177]],.059,.034,.036],
    [[[.172,.250],[.133,.298],[.059,.309],[-.030,.281],[-.100,.226],[-.182,.198],[-.257,.134]],.062,.034,.014],
    [[[.173,.227],[.125,.272],[.070,.264],[.001,.227],[-.080,.196],[-.159,.181],[-.238,.123]],.054,.030,.047],
    [[[.146,.239],[.192,.269],[.232,.236],[.251,.176],[.272,.117]],.046,.028,.026],
    [[[.217,.249],[.254,.239],[.274,.187],[.288,.130],[.293,.081]],.040,.025,.017]
  ];
  for(const [line,w,h,shade] of hair) strand(part,look,mix,faceZ,line,w,h,shade);
}

function shortCut(part,look,mix,faceZ) {
  if(look.style==='swoop') return sideSweep(part,look,mix,faceZ);
  const {id,style}=look;
  const spiky=style==='silverQuiff',tousled=id==='fiachrarm';
  const high=style==='quiff'||spiky,tidy=style==='combed'||style==='fade';
  const height=spiky?.375:id==='josefbuettgen'?.369:high?.354:tidy?.333:.346;
  const count=tousled?6:spiky?6:tidy?4:5;
  const direction=id==='josefbuettgen'||id==='founderish'?-1:1;
  for(let i=0;i<count;i++) {
    const f=i/(count-1),x=(-.179+f*.360)*direction,wave=Math.sin(i*2.45)*.008;
    const h=height-.062*Math.abs(f-.51)*1.85+wave;
    const sweep=(tidy?.094:tousled?.043:spiky?.074:.060)*direction;
    const base=.210-.035*Math.abs(f-.46)*1.8+(high?.015:0)+wave;
    const path=[[x+sweep*.30,h-.055,-.012],[x+sweep*.85,h-.008,.010],
      [x+sweep*.90,h+.007,.030],[x+sweep*.18,h-.001,.064],
      [x-sweep*.58,base+.048,.049],[x-sweep*.86,base+.012,.021]];
    if(tousled) {path[2][0]+=.014*Math.sin(i*1.77);path[4][1]+=.013*Math.cos(i);}
    if(tidy) {path[4][0]-=.030*direction;path[5][0]-=.032*direction;}
    if(spiky) {path[1][1]+=.017;path[3][0]-=.025;}
    strand(part,look,mix,faceZ,path,tousled?.046:tidy?.051:.056,spiky?.033:.030,.014+.030*(i%3)/2,spiky?.15:.28);
  }
  // The shorter temple pieces turn back toward the ear and connect the forelock to the cap.
  for(const s of [-1,1]) {
    const shade=spiky?.20:.018;
    strand(part,look,mix,faceZ,[[s*.185,.243],[s*.227,.233],[s*.263,.192],[s*.281,.146],
      [s*.283,.099]],spiky?.035:.043,.025,shade,.32);
    if(spiky) strand(part,look,mix,faceZ,[[s*.239,.204],[s*.264,.168],[s*.283,.127],[s*.290,.086]],.021,.015,.30,.25);
  }
}

function curls(part,look,mix) {
  const {hair,id}=look,small=id==='sup_nim',tall=id==='loaibassam';
  const rows=small?[13,9,4]:[11,8,4];
  for(const [row,n] of rows.entries()) {
    const radius=[.233,.155,.064][row];
    for(let j=0;j<n;j++) {
      const a=j/n*TAU+row*.57,rad=radius+.011*Math.sin(j*2.42+row);
      const w=(small?.057:.068)+.006*Math.cos(j*3.45+row);
      const y=[.194,.258,.300][row]+Math.cos(a)*.017+(tall?.021:0);
      const s=Math.sin(a),c=Math.cos(a);
      const cx=s*rad,cz=c*rad*.91-.008;
      const ink=mix(hair,'#94745f',.017+.045*(1+Math.sin(j*1.83+row))*.5);
      part.oval(ink,cx,y,cz,w*1.04,w*.90,w*.96,[.12,a,.22*Math.sin(j*2.12)]);
      if((j+row)%2===1||c>.5) {
        const curl=[];
        for(let k=0;k<6;k++) {
          const phase=.11+k/5*4.0,across=Math.sin(phase)*w*.76;
          const front=w*(.68+.24*Math.sin(k/5*Math.PI));
          curl.push([cx+c*across+s*front,y+Math.cos(phase)*w*.60+.015,cz-s*across+c*front]);
        }
        part.lock(mix(ink,'#aa856c',.047),curl,w*.39,w*.36,.36,12);
      }
    }
  }
}

function parting(part,look,mix,faceZ) {
  const style=look.style,short=style==='parted',wave=style==='wings'||style==='layered';
  const center=style==='layered'?-.056:style==='halfUp'?-.032:short?.005:-.009;
  for(const s of [-1,1]) {
    const p=x=>center+s*x;
    const drift=s>0?.007:-.006;
    const inner=short?[
      [p(.004),.277],[p(.028),.327],[p(.089),.347+drift],[p(.151),.314],[p(.167),.252],
      [p(.145),.203],[p(.105),.168+drift]
    ]:[
      [p(.010),.271],[p(.025),.316],[p(.087),.328+drift],[p(.139),.294],
      [p(.173),.243],[p(.211),.200],[p(.248),wave?.143:.153]
    ];
    strand(part,look,mix,faceZ,inner,short?.062:.058,.039,.033,.34);
    const middle=[[p(.037),.295],[p(.097),.327+drift],[p(.171),.294],
      [p(.213),.238],[p(.222),.192],[p(.249),.145],[p(.267),short?.119:.083]];
    if(style==='halfUp') {middle[4][0]=p(.252);middle[5][0]=p(.274);}
    strand(part,look,mix,faceZ,middle,.057,.038,.050,.36);
    const outer=[[p(.111),.277],[p(.170),.285],[p(.230),.251],[p(.266),.195],
      [p(.283),.144],[p(.289),short?.087:.044]];
    strand(part,look,mix,faceZ,outer,.045,.032,.015,.33);
  }
}

function flowingHair(part,look,mix,faceZ) {
  const {hair,style}=look,wave=['layered','wings','bangs'].includes(style);
  const bottom=style==='wings'?-.231:style==='curtains'?-.161:style==='long'?-.338:-.401;
  const half=(.27-bottom)/2,long=bottom<-.32;
  part.oval(hair,0,.27-half,-.146,long?.329:.312,half,.165);
  for(let j=0;j<6;j++) {
    const x=(j-2.5)*.091,z=-.145-.153*Math.sqrt(Math.max(.03,1-(x/.307)**2));
    const curl=(wave?.039:.013)*Math.sin(1.27*j);
    const y=bottom+.015*Math.abs(j-2.5);
    const line=[[x*.53,.268,-.140],[x*.90,.165,z],[x+curl*.4,.010,z-.007],
      [x+curl,(y+.004)*.45,z-.009],[x-curl*.3,y+.088,z],[x+curl*.6,y,z+.028]];
    part.lock(mix(hair,'#a68267',.018+.032*((j%3)/2)),line,.066,.033,.30,15);
  }
  for(const s of [-1,1]) {
    const tucked=style==='halfUp'||(style==='layered'&&s<0);
    const z=tucked?-.041:.026;
    part.oval(hair,s*(long?.289:.277),(.18+bottom)/2,z,long?.092:.081,(.21-bottom)*.51,.105,[.042,0,s*.05]);
    for(let j=0;j<2;j++) {
      const x=(long?.302:.286)+j*.018;
      const a=(tucked?.034:.105)-j*.073,flip=wave?.054:.017;
      const line=[[s*.232,.200,Math.max(a+.08,faceZ(.232,.195)+.010)],
        [s*.270,.107,Math.max(a+.059,faceZ(.27,.102)+.006)],
        [s*(x+flip*.35),.006,a+.080],[s*(x-flip*.55),bottom*.33,a+.058],
        [s*(x+flip),bottom*.68,a+.039],[s*(x-flip*.15),bottom+.015*j,a+.001]];
      if(tucked)for(let k=2;k<line.length;k++)line[k][2]-=.026;
      part.lock(mix(hair,'#b78967',.031+.053*(1-j)),line,.059-j*.008,.045,.36,17);
    }
  }
  if(style==='halfUp') {
    part.oval(hair,0,.014,-.258,.123,.175,.084);
    part.oval('#94765c',0,-.026,-.337,.028,.017,.013);
  }
}

function softBangs(part,look,mix,faceZ) {
  const locks=[[-.185,.102,.044,-.021],[-.113,.111,.048,-.027],[-.039,.119,.044,-.008],
    [.030,.103,.048,.019],[.105,.123,.048,.031],[.171,.111,.043,.034]];
  for(let i=0;i<locks.length;i++) {
    const [x,y,w,shift]=locks[i];
    const line=[[x*.35,.298],[x*.54,.285],[x*.81,.246],[x,.196],
      [x+shift*.46,.148],[x+shift,y]];
    strand(part,look,mix,faceZ,line,w,.031,.016+.033*(i%2),.44);
  }
  for(const s of [-1,1]) strand(part,look,mix,faceZ,[[s*.141,.260],[s*.221,.218],[s*.259,.157],[s*.279,.098]],.040,.028,.023,.32);
}

export function groomHair(part,look,mix,faceZ) {
  if(look.style==='curls') return curls(part,look,mix);
  if(longCuts.has(look.style)) flowingHair(part,look,mix,faceZ);
  if(look.style==='bangs') return softBangs(part,look,mix,faceZ);
  if(longCuts.has(look.style)||look.style==='parted') return parting(part,look,mix,faceZ);
  shortCut(part,look,mix,faceZ);
}
