// Millimetre-scale differences in the face, the frames and the smile distinguish the cast.
// Coordinates are local to the head. Each colored surface is solid geometry for the toy export.
const tau=Math.PI*2;
const eyeHeight=-.035;
const cocoa='#392b28';
const notes={
  phuctm97:       [.131,.003,.047,.020,'bright'],
  ky__zo:         [.143,-.003,.047,.015,'crooked'],
  erwin_ai:       [.135,.002,.059,.025,'bright'],
  dannypostma:    [.139,.005,.042,.017,'quiet'],
  josefbuettgen:  [.144,-.004,.047,.021,'quiet'],
  melanieklenner: [.138,.001,.058,.026,'bright'],
  ann_nnng:       [.143,-.006,.043,.017,'quiet'],
  loaibassam:     [.143,.005,.046,.018,'crooked'],
  sup_nim:        [.146,-.003,.044,.020,'quiet'],
  founderish:     [.142,.002,.056,.023,'bright'],
  tdinh_me:       [.142,-.002,.047,.014,'quiet'],
  rameerez:       [.139,.002,.059,.027,'bright'],
  fiachrarm:      [.137,.003,.055,.022,'bright'],
  praneethpike:   [.140,-.004,.045,.018,'quiet'],
  sandrokratz:    [.141,.002,.043,.017,'crooked'],
  odd_joel:       [.133,.001,.062,.026,'crescent'],
  ayysoni:        [.146,.006,.054,.023,'bright'],
  yongfook:       [.136,.002,.046,.019,'crooked'],
  caitbhri:       [.143,-.007,.041,.018,'quiet'],
  neilhanyd:      [.135,.001,.049,.018,'quiet'],
  jesslozanos:    [.143,-.004,.055,.023,'crooked'],
  visitor:        [.141,-.004,.049,.020,'bright']
};

export function faceRadius(y) {
  const h=Math.max(-1,Math.min(1,(y-.002)/.314));
  const round=Math.max(.00008,1-h*h)**.422;
  const cheek=1+.039*Math.exp(-(((h+.26)/.33)**2));
  const jaw=1-.116*Math.max(0,(-h-.22)/.78)**1.3;
  return [.317*round*cheek*jaw,.273*round];
}

function puff(x,y) {
  return .025*Math.exp(-(((Math.abs(x)-.190)/.074)**2)-(((y+.104)/.071)**2));
}

export function faceZ(x,y) {
  const [rx,rz]=faceRadius(y);
  const forward=Math.sqrt(Math.max(.002,1-(x/rx)**2));
  return forward*(rz+puff(x,y));
}

function point(a,y,relief=0) {
  const [rx,rz]=faceRadius(y),s=Math.sin(a),c=Math.cos(a),x=rx*s;
  return [(rx+relief)*s,y,(rz+relief+(c>0?puff(x,y):0))*c];
}

function paintFace(part,look,mix) {
  const points=[],indices=[],colors=[];
  const sides=64,lats=38;
  const raw=mix(look.skin,look.skin,0);
  const warmTarget=raw.r>.52?'#ee968a':raw.r>.28?'#ce776c':'#b16359';
  const peach=mix(look.skin,warmTarget,.82);
  for(let row=0;row<=lats;row++) {
    const elevation=(row/lats-.5)*Math.PI;
    const y=.002+.314*Math.sin(elevation);
    for(let col=0;col<sides;col++) {
      const a=col/sides*tau,w=Math.max(0,Math.cos(a)),p=point(a,y);
      points.push(...p);
      const cheek=Math.exp(-(((Math.abs(p[0])-.188)/.065)**2)-(((y+.101)/.042)**2));
      const color=mix(raw,peach,cheek*w**.7*.84);
      const clay=.995+.005*Math.sin(61*p[0]+25*y)*Math.cos(59*y-27*p[2]);
      colors.push(color.r*clay,color.g*clay,color.b*clay);
    }
  }
  for(let row=0;row<lats;row++) for(let col=0;col<sides;col++) {
    const a=row*sides+col,b=row*sides+(col+1)%sides;
    indices.push(a,b,a+sides,b,b+sides,a+sides);
  }
  for(let i=1;i<sides-1;i++) {
    indices.push(0,i+1,i,sides*lats,sides*lats+i,sides*lats+i+1);
  }
  part.surface(look.skin,points,indices,colors);
}

function faceLine(xy,lift=0) {
  return xy.map(([x,y])=>[x,y,faceZ(x,y)+lift]);
}

function veneerBeard(part,look,mix) {
  const {beard,hair,skin,id}=look;
  const full=beard==='full',short=beard==='short';
  const moustache=full||short||beard==='goatee'||id==='yongfook';
  if(!beard) return;
  const shade=mix(hair,'#795241',.13);
  if(full||short||(beard==='shadow'&&id!=='yongfook')) {
    const pigment=full?shade:short?mix(skin,shade,.78):mix(skin,shade,.40);
    const points=[],indices=[],colors=[];
    const sides=66,rows=9;
    for(let row=0;row<=rows;row++) {
      const t=row/rows;
      for(let j=0;j<=sides;j++) {
        const a=(j/sides-.5)*3.83,side=Math.abs(a)/1.91;
        const temple=Math.exp(-(((Math.abs(a)-1.32)/.26)**2));
        const scallop=.006*Math.cos(a*8.8+.3)*Math.exp(-((a/.92)**2));
        const edgeOfSmile=Math.exp(-(((Math.abs(a)-.47)/.23)**2));
        const upper=(full?-.208:short?-.195:-.171)+.106*Math.sin(Math.min(1,side)*Math.PI*.8)**2+
          .096*temple+(full?.093:short?.062:.016)*edgeOfSmile+scallop;
        const lower=-.306+.098*side**2;
        const y=lower+(upper-lower)*t;
        const edge=Math.sin(j/sides*Math.PI)**.58;
        const relief=(full?.019:short?.009:.003)*edge*(.70+.30*Math.sin(t*Math.PI));
        const p=point(a,y,relief);
        p[1]-=(full?.014:.003)*(1-t)*edge;
        points.push(...p);
        const tint=mix(pigment,skin,(full?.17:.27)*t**5+(1-edge)*.13);
        colors.push(tint.r,tint.g,tint.b);
        if(row>0&&j>0) {
          const k=row*(sides+1)+j;
          indices.push(k-sides-2,k-sides-1,k-1,k-sides-1,k,k-1);
        }
      }
    }
    part.surface(pigment,points,indices,colors);
  }
  if(moustache) {
    const color=full?shade:mix(skin,shade,short?.77:.89);
    for(const s of [-1,1]) {
      const width=full?.107:short?.087:.060;
      const q=faceLine([[s*.002,-.111],[s*width*.26,-.100],[s*width*.57,-.098],
        [s*width*.86,-.108],[s*width,full?-.132:-.117]],.012);
      part.lock(color,q,full?.019:short?.012:.009,full?.014:.009,.35,11);
    }
  }
  if(beard==='goatee'||id==='yongfook') {
    const y=-.203,shape=beard==='goatee'?.039:.031;
    part.lock(mix(skin,shade,.74),faceLine([[-shape,y+.008],[0,y-.006],[shape,y+.011]],.006),.017,.011,.17,9);
  }
}

function rims(part,style,spacing,cy) {
  if(!style) return;
  const round=style==='wire',amber=style==='amber',soft=style==='softSquare';
  const ink=round?'#6c5a4c':amber?'#946a49':'#3d3836';
  const width=round?.087:soft?.093:.096, height=round?.074:amber?.054:.061;
  const rim=round?.0058:amber?.0069:style==='thinSquare'?.0073:.0092;
  const front=faceZ(spacing,cy)+.034;
  function framePoint(s,x,y) {return [s*spacing+x,cy+y,front-s*x*.38-y*y*.34];}
  for(const s of [-1,1]) {
    const path=[],power=round?1:soft?.70:amber?.66:.55;
    for(let j=0;j<=30;j++) {
      const a=j/30*tau,c=Math.cos(a),sn=Math.sin(a);
      path.push(framePoint(s,Math.sign(c)*Math.abs(c)**power*width,
        Math.sign(sn)*Math.abs(sn)**power*height));
    }
    part.stroke(ink,path,rim,.98,30,7);
    part.stroke(ink,[framePoint(s,s*width*.98,.018),[s*.269,.035,.181],
      [s*.318,.040,.065],[s*.321,.013,-.013]],rim*.81,1,9,6);
  }
  const inner=spacing-width+.002,z=front+width*.38;
  part.stroke(ink,[[-inner,cy+.012,z],[0,cy+.025,z+.008],[inner,cy+.012,z]],rim*.84,.94,9,6);
}

function eyesFor(eyes,happy,sleep,look,expr,spacing,cy,mood,mix) {
  const glossy=mix(cocoa,look.hair,.06);
  const baseCy=cy-eyeHeight;
  const halfHeight=.0275*expr[2];
  for(const s of [-1,1]) {
    const cx=s*spacing,z=faceZ(cx,cy),tilt=[0,s*.40,s*.05];
    const curve=(target,up)=>{
      const path=[];
      for(let j=0;j<=6;j++) {
        const v=j/3-1,x=cx+v*.027,y=cy+(1-v*v)*up;
        path.push([x,y-eyeHeight,faceZ(x,y)+.007]);
      }
      target.stroke(cocoa,path,.0065,.50,10,7);
    };
    if(mood==='crescent') curve(eyes,.014);
    else {
      eyes.oval(glossy,cx,baseCy,z+.005,.0170,halfHeight,.0115,tilt);
      const hx=cx-.0048,hy=cy+halfHeight*.31;
      const hz=z+.005+.0115*.92-s*(hx-cx)*.44;
      eyes.dot('#f9ebd5',hx,hy-eyeHeight,hz,.0035,.0039,.0022,tilt);
    }
    curve(happy,.0145);
    curve(sleep,-.0095);
  }
}

export function sculptPortrait(part,eyes,happy,sleep,look,expression,studio) {
  const mix=studio.mix, [spacing,offset,smile,curve,mood]=notes[look.id]||notes.visitor;
  const cy=eyeHeight+offset,compact=look.style==='bangs';
  paintFace(part,look,mix);
  const hairCovers=['long','bangs','halfUp','layered','wings'].includes(look.style);
  for(const s of [-1,1]) {
    const ex=hairCovers?.301:.324;
    part.oval(look.skin,s*ex,-.067,.003,hairCovers?.047:.061,.077,.055,[0,0,s*-.14]);
    const inner=mix(look.skin,'#c48071',.27);
    part.oval(inner,s*(ex+.027),-.066,.033,.020,.040,.018,[0,s*.45,0]);
    if(!compact) {
      const lift=cy+(look.glasses?.108:.087)+(mood==='bright'?.005:0);
      const ax=s*(spacing-.002),w=look.glasses?.034:.040;
      const path=faceLine([[ax-s*w,lift-.008],[ax-s*w*.38,lift+.005],[ax+s*w*.34,lift+.010],
        [ax+s*w,lift+.001+(mood==='crooked'?s*.006:0)]],.007);
      part.lock(mix(look.hair,'#735348',.14),path,look.glasses?.0085:.011,.008,.42,10);
    }
  }
  veneerBeard(part,look,mix);
  eyesFor(eyes,happy,sleep,look,expression,spacing,cy,mood,mix);
  const noseY=cy-.051,nose=mix(look.skin,'#d4937b',.22);
  part.oval(nose,0,noseY,faceZ(0,noseY)+.005,.031*expression[3],.023,.025,[.10,0,0]);
  const smileY=look.beard?-.144:-.139;
  const corners=faceLine([[-smile,smileY+.003],[-smile*.58,smileY-curve*.67],[0,smileY-curve],
    [smile*.59,smileY-curve*.64],[smile,smileY+(mood==='crooked'?.012:.003)]],.005);
  const mouth=mix('#57382c',look.skin,.026);
  part.stroke(mouth,corners,.0078,.56,15,8);
  if(look.id==='phuctm97') part.dot(mix(look.skin,'#654537',.84),.092,-.130,faceZ(.092,-.130)+.002,.0048,.0051,.003);
  rims(part,look.glasses,spacing,cy+.005);
}

export { eyeHeight };
