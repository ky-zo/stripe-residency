import { clayStudio } from './clay-mesh.js';

// Wardrobe, silhouettes and facial details come from the residents' profile portraits.
// Accessories make their projects legible even at courtyard scale.
const looks = {
  phuctm97: { skin: '#edb68d', hair: '#211c25', style: 'swoop', top: '#6185a1', pants: '#354453', outfit: 'denimHood', glasses: 'square', prop: 'house', smile: 'open' },
  ky__zo: { skin: '#d6a078', hair: '#684d3b', style: 'parted', top: '#373642', pants: '#807b70', outfit: 'tee', prop: 'helicopter', smile: 'crooked' },
  erwin_ai: { skin: '#f2c09e', hair: '#83573e', style: 'swept', top: '#3c6051', pants: '#47515b', outfit: 'pendant', beard: 'short', prop: 'lens', smile: 'open' },
  dannypostma: { skin: '#e7b193', hair: '#41312f', style: 'knot', top: '#c54e3a', pants: '#463c40', outfit: 'silk', glasses: 'wire', beard: 'full', prop: 'camera' },
  josefbuettgen: { skin: '#e6af85', hair: '#95532d', style: 'quiff', top: '#de663a', pants: '#4c6576', outfit: 'lanyard', prop: 'fish' },
  melanieklenner: { skin: '#f0c3a2', hair: '#655044', style: 'halfUp', top: '#efe5d9', pants: '#83927a', outfit: 'blouse', prop: 'mallet', slim: true, smile: 'open' },
  ann_nnng: { skin: '#e2ad85', hair: '#282528', style: 'long', top: '#e9e4d4', pants: '#756254', outfit: 'turtleneck', prop: 'monitor', slim: true },
  loaibassam: { skin: '#ddb08e', hair: '#332c2c', style: 'curls', top: '#514d53', pants: '#8b9188', outfit: 'henley', prop: 'clipboard', slim: true },
  sup_nim: { skin: '#b88467', hair: '#302a2b', style: 'curls', top: '#f0e9d8', pants: '#5a635f', outfit: 'openCollar', beard: 'shadow', prop: 'flowers' },
  founderish: { skin: '#dbaa89', hair: '#50413a', style: 'fade', top: '#393f49', pants: '#687c7b', outfit: 'tee', beard: 'goatee', smile: 'open', prop: 'flag' },
  tdinh_me: { skin: '#dca579', hair: '#292b2b', style: 'curtains', top: '#526d7c', pants: '#494c4d', outfit: 'buttonDown', prop: 'toolbox' },
  rameerez: { skin: '#d9a680', hair: '#332b2a', style: 'curls', top: '#33383d', pants: '#717b76', outfit: 'tee', beard: 'full', prop: 'ruby', smile: 'open' },
  fiachrarm: { skin: '#f2c6a4', hair: '#e7c784', style: 'fringe', top: '#e8ac42', pants: '#5e7572', outfit: 'polo', prop: 'calendar', smile: 'open' },
  praneethpike: { skin: '#b77f5f', hair: '#302a29', style: 'shaved', top: '#4a4140', pants: '#757465', outfit: 'tee', glasses: 'square', beard: 'short', prop: 'rabbit' },
  sandrokratz: { skin: '#d9a57c', hair: '#67422d', style: 'quiff', top: '#3e454a', pants: '#677068', outfit: 'bomber', beard: 'shadow', prop: 'carabiner', slim: true },
  odd_joel: { skin: '#deb393', hair: '#342e2d', style: 'cap', top: '#6889a2', pants: '#625b57', outfit: 'crossbody', glasses: 'softSquare', prop: 'phone', smile: 'open' },
  ayysoni: { skin: '#bf8b69', hair: '#292628', style: 'wings', top: '#e5dfd3', pants: '#575655', outfit: 'stripes', beard: 'goatee', prop: 'board', smile: 'open' },
  yongfook: { skin: '#d2a182', hair: '#34343e', style: 'silverQuiff', top: '#424252', pants: '#656671', outfit: 'coat', beard: 'shadow', prop: 'bear', slim: true },
  caitbhri: { skin: '#e2b297', hair: '#392d2c', style: 'bangs', top: '#ede8d8', pants: '#768275', outfit: 'tee', jewelry: 'studs', prop: 'directory', slim: true },
  neilhanyd: { skin: '#e6ad90', hair: '#322e30', style: 'combed', top: '#354455', pants: '#46515b', outfit: 'suit', glasses: 'thinSquare', prop: 'blockchainBook' },
  jesslozanos: { skin: '#ddb091', hair: '#654737', style: 'layered', top: '#343f43', pants: '#67747d', outfit: 'drapedCollar', jewelry: 'hoops', smile: 'crooked', prop: 'airplane', slim: true },
  visitor: { skin: '#c58d69', hair: '#3b302c', style: 'bucket', top: '#86a996', pants: '#536558', outfit: 'fieldJacket', prop: null },
};

const faceLevels = [
  [-.304, .057, .082], [-.286, .142, .144], [-.242, .218, .197],
  [-.176, .273, .237], [-.09, .304, .26], [.015, .315, .272],
  [.102, .305, .263], [.19, .274, .233], [.261, .205, .178],
  [.302, .125, .100], [.317, .029, .036]
];
const tau = Math.PI * 2;
const paper = '#fff5dc';
const dark = '#353737';
const perStudio = new WeakMap();
// Width, height, eye opening, nose width, natural head tilt.
const expressions = {
  phuctm97:[.98,1,.86,1.05,-.018], ky__zo:[1.03,.97,.9,1.08,.024],
  erwin_ai:[.96,1,.91,.95,-.011], dannypostma:[.98,1.015,.97,1.16,.018],
  josefbuettgen:[.96,1.02,1,.91,-.026], melanieklenner:[.94,1,1.04,.91,.046],
  ann_nnng:[.94,1,.95,.88,-.046], loaibassam:[.91,1.025,1.04,1.04,.013],
  sup_nim:[.97,1,.98,1.06,-.016], founderish:[1.03,.97,.91,.97,-.024],
  tdinh_me:[1.02,.97,.86,1.08,.014], rameerez:[1,.98,.93,1.06,.012],
  fiachrarm:[.94,.96,1.10,.83,-.018], praneethpike:[1.06,.98,.91,1.12,.016],
  sandrokratz:[.93,1.025,.88,1.05,-.012], odd_joel:[1.02,.97,.78,1.03,.032],
  ayysoni:[1.02,.98,.9,1.08,-.034], yongfook:[.95,1,.86,1.06,.012],
  caitbhri:[.98,.985,1.12,.91,-.012], neilhanyd:[1.04,1.015,.78,1.06,.01],
  jesslozanos:[.94,1.015,.90,.92,-.065],
  visitor:[1,1,1,1,0]
};

function faceRadius(y) {
  if (y <= faceLevels[0][0]) return faceLevels[0].slice(1);
  for (let i = 1; i < faceLevels.length; i++) {
    if (faceLevels[i][0] < y) continue;
    const [low, high] = [faceLevels[i - 1], faceLevels[i]];
    const t = (y - low[0]) / (high[0] - low[0]);
    return [low[1] + (high[1] - low[1]) * t, low[2] + (high[2] - low[2]) * t];
  }
  return faceLevels.at(-1).slice(1);
}

function faceZ(x, y) {
  const [rx, rz] = faceRadius(y);
  return rz * Math.sqrt(Math.max(.025, 1 - (x / rx) ** 2));
}

function facePath(xy, clearance = .008) {
  return xy.map(([x, y]) => [x, y, faceZ(x, y) + clearance]);
}

function scalpPoint(a, p, lift=0) {
  const y = Math.cos(p) * .32;
  const [rx,rz] = faceRadius(y);
  const crown = y > .302 ? Math.min(1, (.321-y)/.018) : 1;
  return [Math.sin(a) * (rx + .015 + lift) * crown, y+.011+lift*.6,
    Math.cos(a) * (rz + .016 + lift) * crown];
}

function hairline(a) {
  return 1.045+(1-Math.cos(a))*.48+Math.abs(Math.sin(a))*.23+Math.sin(a*3)*.035;
}

function hairCap(part, color, boundary) {
  const positions = [], indices = [];
  const slices = 48, rings = 15;
  for (let k = 0; k <= rings; k++) {
    const t = 1 - k / rings;
    for (let j = 0; j < slices; j++) {
      const a = j / slices * tau;
      const p = Math.max(.010, t * boundary(a));
      positions.push(...scalpPoint(a,p));
    }
  }
  for (let k = 0; k < rings; k++) {
    for (let j = 0; j < slices; j++) {
      const a = k * slices + j, b = k * slices + (j + 1) % slices;
      indices.push(a, b, a + slices, b, b + slices, a + slices);
    }
  }
  part.surface(color, positions, indices);
}

function hairRidges(part,look,mix) {
  if (['shaved','cap','bucket','curls'].includes(look.style)) return;
  const divided=['long','halfUp','parted','wings','curtains','layered','bangs'].includes(look.style);
  const pulled=look.style==='knot';
  const color=mix(look.hair,'#c9aa88',.073);
  const shadow=mix(look.hair,'#241e22',.25);
  for (let i=0;i<18;i++) {
    const strand=(i/18-.5)*tau;
    const shift=divided?-Math.sign(strand)*.4:pulled?Math.sin(strand)*.32:.67;
    const path=[];
    for(let j=0;j<7;j++) {
      const t=j/6;
      const a=strand+shift*(1-t);
      const p=.43+(hairline(a)-.43)*t;
      path.push(scalpPoint(a,p,.004));
    }
    part.stroke(i%3===1?color:shadow,path,i%3===1?.0054:.0037,.12,10,5);
  }
  // A few tapered ends interrupt the edge of a swept fringe at the temples.
  if (!divided && !pulled) {
    for(const a of [-1.17,-.90,-.65,.77,1.11]) {
      const path=[];
      for(let j=0;j<5;j++) {
        const t=j/4;
        const angle=a+.29*(1-t);
        path.push(scalpPoint(angle,.80+(hairline(a)+.084-.80)*t,.008*(1-t)));
      }
      part.stroke(look.hair,path,.014,.09,10,6);
    }
  }
}

function hairstyle(part, look, mix) {
  const { style, hair, skin } = look;
  const shine = mix(hair, '#aa9584', .10);
  const ridge = mix(hair, '#958575', .045);
  if (style === 'shaved') {
    hairCap(part, mix(skin, hair, .12), a => .72 + (1 - Math.cos(a)) * .54 + Math.abs(Math.sin(a)) * .23);
    for (const s of [-1, 1]) {
      part.oval(mix(skin, hair, .43), .298 * s, .052, -.035, .018, .111, .085, [0, 0, -.08 * s]);
    }
    return;
  }
  hairCap(part, hair, hairline);
  if (style === 'cap' || style === 'bucket') {
    const capColor = style === 'cap' ? '#a49f90' : '#df9470';
    part.loft(capColor, [[.114,.304,.253],[.13,.334,.282],[.204,.318,.278],[.283,.265,.244],[.328,.16,.147],[.346,.038,.04]]);
    if (style === 'cap') {
      part.oval('#777c77', 0,.136,.236,.237,.028,.166, [-.07,0,0]);
      part.oval(capColor, 0,.143,.235,.237,.025,.166,[-.07,0,0]);
      part.dot(capColor, 0, .348, -.015, .022, .014, .022);
      part.block('#dcd6bd', 0,.229,.264,.102,.048,.014,[-.4,0,0]);
    } else {
      part.loft(capColor, [[.087,.372,.313],[.099,.396,.333],[.121,.36,.309],[.157,.312,.269]], 32);
      part.loft('#8b614e', [[.149,.336,.290],[.154,.338,.291],[.182,.331,.289],[.186,.330,.287]],32);
    }
    return;
  }

  if (style === 'knot') {
    part.oval('#9d5a4c', 0,.259,-.199,.102,.088,.10,[-.25,0,0]);
    part.oval(hair, -.025,.312,-.214,.134,.096,.12,[-.25,0,.2]);
    for (const s of [-1,1]) {
      part.stroke(ridge, [[s*.254,.112,.13],[s*.223,.219,.095],[s*.13,.29,-.015],[s*.065,.3,-.142]],.009,.25);
    }
    return;
  }

  if (style === 'combed') {
    part.oval(hair,-.026,.242,.111,.212,.058,.109,[-.13,.12,-.12]);
    part.oval(hair,.077,.228,.127,.127,.052,.092,[-.15,.11,-.19]);
    for(let j=0;j<4;j++) {
      const lift=j*.012;
      part.stroke(ridge,[[-.200,.178+lift,.166],[-.119,.218+lift,.214],
        [.003,.232+lift,.207],[.108,.241+lift,.143],[.172,.212+lift,.099]],.0065,.20,11);
    }
    return;
  }

  const long = ['long','halfUp','curtains','wings','bangs','layered'].includes(style);
  if (long || style === 'parted') {
    if (long) {
      const ends = ['long','halfUp','bangs','layered'].includes(style) ? -.43 : style === 'wings' ? -.29 : -.185;
      part.oval(hair,0,(ends+.25)/2,-.139,.312,(.27-ends)/2,.165);
      for (const s of [-1,1]) {
        const tucked = style === 'halfUp' || (style==='bangs' && s>0) || (style==='layered' && s<0);
        part.oval(hair,s*(tucked?.267:.26),(ends+.18)/2,tucked?-.037:.018,
          tucked?.066:.084,(.21-ends)/2,tucked?.108:.125,[.045,0,s*.06]);
        const end = [s*(style==='wings'?.34:.265), ends+.035, style==='long'?.105:-.004];
        part.stroke(ridge, [[s*.17,.241,.153],[s*.247,.114,.177],[s*.28,-.087,.126],end],.018,.25,12);
        if (style === 'wings') {
          part.oval(hair,s*.291,-.175,.016,.084,.105,.1, [.1,0,-s*.56]);
        }
        if (style === 'layered') {
          const amber=mix(hair,'#b47b51',.18);
          for(let j=0;j<2;j++) {
            const z=(tucked?-.035:.075)-j*.054;
            part.stroke(j?ridge:amber,[[s*.227,.172,z+.102],[s*.285,.056,z+.074],
              [s*.284,-.072,z+.085],[s*.26,-.179,z+.099],
              [s*.294,-.287,z+.077],[s*(.299+j*.033),-.374,z+.022]],j?.031:.021,.14,15,7);
          }
          if(s>0) {
            part.stroke(mix(hair,'#bc835b',.15),[[.225,.165,.135],[.274,.066,.146],
              [.290,-.040,.146],[.258,-.147,.167],[.267,-.241,.177],[.314,-.292,.155],
              [.363,-.282,.111]],.037,.13,17,8);
            part.stroke(amber,[[.268,-.177,.144],[.271,-.251,.146],[.292,-.312,.153],
              [.343,-.351,.124],[.383,-.335,.089]],.022,.14,13,7);
          }
        }
      }
      if (style === 'halfUp') {
        part.oval(hair,0,.02,-.25,.162,.22,.10);
        part.dot('#88746a',0,-.04,-.33,.025,.025,.016);
      }
    }
    if(style==='bangs') {
      for(let j=-3;j<=3;j++) {
        const x=j*.054;
        const bottom=.104+Math.abs(j)*.009+(j===0?.014:0);
        const points=facePath([[x*.68,.256],[x*.85,.211],[x,.172],[x+.011*Math.sign(j),bottom]],.024);
        part.stroke(j%2?ridge:hair,points,.034,.09,12,8);
      }
      return;
    }
    for (const s of [-1,1]) {
      const partOffset=style==='layered'?-.035:0;
      part.oval(hair,s*.128+partOffset,.223,.134,.170,.084,.126,[.02,s*.18,-s*.47]);
      part.stroke(ridge, [[s*.018,.294,.13],[s*.089,.268,.194],[s*.174,.216,.218],
        [s*.249,.146,.169]],.014,.22,10);
      if (style==='parted') {
        part.oval(hair,s*.190,.138,.183,.077,.101,.048,[-.12,s*.14,-s*.4]);
      }
    }
    return;
  }

  if (style === 'curls') {
    for (let row = 0; row < 2; row++) {
      const count = row ? 8 : 13;
      for (let j = 0; j < count; j++) {
        const a = j/count*tau + row*.27;
        const radius = row ? .143 : .237;
        const ripples = Math.sin(j*3.81+row)*.011;
        part.dot(j%4===1?ridge:hair,Math.sin(a)*radius,
          (row?.289:.191) + Math.cos(a)*.022 + ripples, Math.cos(a)*radius*.82,
          .092+ripples,.078+Math.cos(j)*.013,.088+ripples,[0,a,.22*Math.sin(j)]);
      }
    }
    part.oval(ridge,.004,.314,-.028,.117,.065,.108);
    return;
  }

  if (style === 'swoop' || style === 'fringe') {
    const blond = style === 'fringe';
    part.oval(hair,-.015,.207,.164,.240,.107,.116,[.04,.12,-.27]);
    for (let j = 0; j < 4; j++) {
      const x = (j-1.5)*.091;
      part.oval(j===2?ridge:hair,x,.181+x*.21,.192- Math.abs(x)*.23,
        .121,blond?.086:.092,.095,[.04,.13,-.39]);
    }
    part.stroke(shine,[[.182,.253,.128],[.094,.247,.208],[-.03,.207,.259],[-.171,.128,.22]],.009,.15,12);
    return;
  }

  const high = style === 'quiff' || style === 'silverQuiff';
  if (style === 'silverQuiff') {
    for (const s of [-1,1]) part.oval('#756c72',s*.29,.072,-.023,.031,.098,.10);
  }
  part.oval(hair,-.016,high?.244:.218,.119,.229,high?.117:.094,.132,[-.23,.09,-.21]);
  for (let j = 0; j < 3; j++) {
    const x = (j - 1) * .097;
    part.oval(j===1?ridge:hair,x,(high?.253:.215) + (1-j)*.014,
      .124 - Math.abs(x)*.2,.145,high?.105:.088,.115,[-.25, .10,-.26]);
  }
  part.stroke(shine, [[-.205,.17,.160],[-.122,.258,.210],[.013,high?.315:.286,.15],
    [.138,.269,.075]], .011,.22,12);
}

function facialHair(part, look, mix) {
  if (!look.beard) return;
  const full = look.beard === 'full';
  const goatee = look.beard === 'goatee';
  const color = full ? mix(look.hair,'#59403b',.09) :
    mix(look.skin,look.hair,look.beard === 'shadow' ? .29 : .69);
  const vertices=[], faces=[], tints=[];
  const slices=38, rows=5;
  for(let row=0;row<=rows;row++) {
    const t=row/rows;
    for(let j=0;j<slices;j++) {
      const a=j/slices*tau;
      const side=Math.abs(Math.sin(a));
      const top= -.154 + (goatee?.095:.163)*side**2.8 - .048*Math.max(0,-Math.cos(a));
      const bottom= -.298 + side*.029;
      const y=bottom+(top-bottom)*t;
      const [rx,rz]=faceRadius(y);
      const depth=full ? .014 + .012*(1-t) : .006;
      vertices.push(Math.sin(a)*(rx+depth), y-(full?.045*(1-t):0),
        Math.cos(a)*(rz+depth));
      const tone=mix(color,look.skin,((full?.35:.80)*t**4));
      tints.push(tone.r,tone.g,tone.b);
    }
  }
  for(let row=0;row<rows;row++) for(let j=0;j<slices;j++) {
    const a=row*slices+j,b=row*slices+(j+1)%slices;
    faces.push(a,b,a+slices,b,b+slices,a+slices);
  }
  for(let j=1;j<slices-1;j++) faces.push(0,j+1,j);
  part.surface(color,vertices,faces,tints);
  for (const s of [-1,1]) {
    part.stroke(color,facePath([[s*.003,-.081],[s*.029,-.076],[s*.063,-.088]],.009),full?.018:.012,.13);
  }
  if (goatee) part.oval(mix(color,look.hair,.35),0,-.199,faceZ(0,-.199),.06,.047,.014);
}

function glasses(part, style) {
  if (!style) return;
  const wire = style === 'wire';
  const thin = wire || style==='thinSquare';
  const square = style==='square' || style==='thinSquare';
  const color = wire ? '#767477' : '#343639';
  for (const s of [-1,1]) {
    const points=[];
    for (let k=0;k<=20;k++) {
      const t=k/20*tau, cs=Math.cos(t), sn=Math.sin(t);
      const power=wire?1:square?.48:.68;
      const x=s*.123 + .095 * Math.sign(cs)*Math.abs(cs)**power;
      const y=.031 + (wire?.078:.064) * Math.sign(sn)*Math.abs(sn)**power;
      points.push([x,y,faceZ(x,y)+.025]);
    }
    part.stroke(color,points,thin?.0065:.0105,1,32,6);
    if(style==='thinSquare') {
      part.stroke(color,facePath([[s*.033,.077],[s*.089,.096],[s*.173,.094],[s*.211,.075]],.026),.008,.75);
    }
    part.stroke(color,[[s*.211,.058,faceZ(.211,.058)+.025],
      [s*.268,.06,.145],[s*.306,.069,.044],[s*.31,.045,-.014]],thin?.0065:.009,1);
  }
  part.stroke(color,facePath([[-.027,.047],[0,.06],[.027,.047]],.029),thin?.0065:.009,1);
}

function openSmile(part, lip) {
  const strips = [
    [0,1,lip,.012],[.10,.51,'#fff0d6',.0145],[.74,.94,'#ce8475',.015]
  ];
  for (const [from,to,color,depth] of strips) {
    const points=[],faces=[];
    for (let i=0;i<=14;i++) {
      const ratio=i/7-1, x=.081*ratio;
      const upper=-.106+.020*ratio**2;
      const height=.037*Math.max(.002,1-ratio**2);
      for (const edge of [to,from]) {
        const y=upper-height*edge;
        points.push(x,y,faceZ(x,y)+depth);
      }
      if (i) {
        const a=(i-1)*2;
        faces.push(a,a+2,a+1,a+2,a+3,a+1);
      }
    }
    part.surface(color,points,faces);
  }
}

function faceClay(part,skin,mix) {
  const vertices=[],faces=[],tints=[];
  const rows=22,segments=48;
  for(let i=0;i<=rows;i++) {
    const y=-.304+(.317+.304)*i/rows;
    const [rx,rz]=faceRadius(y);
    for(let j=0;j<segments;j++) {
      const a=j/segments*tau,x=Math.sin(a)*rx,z=Math.cos(a)*rz;
      vertices.push(x,y,z);
      const cheek=Math.exp(-(((Math.abs(x)-.170)/.074)**2+((y+.045)/.053)**2));
      const warmth=cheek*.30*Math.max(0,Math.cos(a));
      const tint=mix(skin,'#db7b69',warmth);
      tints.push(tint.r,tint.g,tint.b);
    }
  }
  for(let i=0;i<rows;i++) for(let j=0;j<segments;j++) {
    const a=i*segments+j,b=i*segments+(j+1)%segments;
    faces.push(a,b,a+segments,b,b+segments,a+segments);
  }
  for(let j=1;j<segments-1;j++) {
    const top=rows*segments;
    faces.push(0,j+1,j,top,top+j,top+j+1);
  }
  part.surface(skin,vertices,faces,tints);
}

function makeHead(part, eyes, look, mix, expression) {
  const {skin, hair} = look;
  const blush = mix(skin,'#db8171',.30);
  const brows = mix(hair,'#4f3e36',.32);
  faceClay(part,skin,mix);
  for (const s of [-1,1]) {
    part.oval(skin,s*.305,-.009,-.002,.054,.082,.056,[.09,0,-s*.12]);
    part.oval(blush,s*.336,-.013,.025,.020,.044,.027,[0,s*.1,0]);
    const cx=s*.115;
    const outer=look.smile==='open'?.11:.105;
    part.stroke(brows,facePath([[cx-s*.064,.098],[cx-s*.014,.115],
    [cx+s*.033,outer],[cx+s*.055,.089]],.011),.013,.22);
    const z=faceZ(cx,.025)+.008;
    eyes.dot('#473631',cx,0,z,.034,.045*expression[2],.024,[0,s*.26,0]);
    eyes.dot('#30292d',cx+.001,.003,z+.010,.024,.034*expression[2],.019,[0,s*.2,0]);
    eyes.dot('#fff5db',cx-.010,.015*expression[2],z+.024,.008,.0095,.005);
  }
  facialHair(part,look,mix);
  const nose=mix(skin,'#d58f75',.25);
  const nw=expression[3];
  part.loft(nose,[[-.071,.012*nw,.011,0,.270],[-.063,.031*nw,.023,.002,.281],
    [-.046,.042*nw,.032,.003,.284],[-.024,.036*nw,.030,.002,.276],
    [.009,.024*nw,.021,0,.264],[.031,.014*nw,.013,0,.259]],20);
  const lip=mix(skin,'#7b413e',.62);
  if (look.smile==='open') {
    openSmile(part,lip);
  } else {
    part.stroke(lip,facePath([[-.071,-.097],[-.039,-.113],[.006,-.119],
      [.042,-.113],[.070,look.smile==='crooked'?-.090:-.101]],.009),.0085,.18);
  }
  hairstyle(part,look,mix);
  hairRidges(part,look,mix);
  glasses(part,look.glasses);
  if(look.jewelry==='studs') {
    for (const s of [-1,1]) part.dot('#ece5d3',s*.325,-.055,.057,.014,.014,.012);
  }
  if(look.jewelry==='hoops') {
    for (const s of [-1,1]) ring(part,'#d9ad6b',s*.322,-.073,.065,.019,.030,.005,s*.12);
  }
}

function ring(part, color, x, y, z, rx, ry, line, tilt=0) {
  const points=[];
  for (let i=0;i<=20;i++) {
    const a=i/20*tau;
    points.push([x+Math.cos(a)*rx-Math.sin(a)*ry*tilt,
      y+Math.sin(a)*ry+Math.cos(a)*rx*tilt,z]);
  }
  part.stroke(color,points,line,1,28,7);
}

function bookProp(p,kind) {
  const directory=kind==='directory';
  const cover=directory?'#eec24d':'#346f76';
  const spine=directory?'#d5a13b':'#2a5863';
  const width=directory?.152:.178,height=directory?.188:.209;
  p.block(cover,0,0,-.032,width,height,.015);
  p.block('#e5d6aa',.001,0,0,width-.007,height-.013,.060);
  p.block(cover,0,0,.032,width,height,.016);
  p.block(spine,-width/2+.007,0,0,.021,height,.078);
  if(directory) {
    p.stroke('#574e37',[[-.040,.040,.043],[-.026,.055,.044],[.006,.061,.044],
      [.030,.051,.044],[.040,.040,.043]],.008,.8,10);
    for(const x of [-.036,.036]) p.block('#574e37',x,.036,.045,.019,.018,.009,[0,0,x>0?-.32:.32]);
    for(const y of [-.021,-.039]) p.block('#776537',.002,y,.043,.073,.006,.004);
    for(const [i,tint] of ['#e68e62','#88a28a','#a4a6a3'].entries()) {
      p.block(tint,width/2, .042-i*.033,0,.013,.019,.030);
    }
  } else {
    for(const [x,y] of [[-.039,.027],[.012,.054],[.044,.006]]) {
      p.stroke('#b1d4bb',[[x-.015,y,.044],[x,y+.009,.044],[x+.015,y,.044],[x,y-.010,.044],[x-.015,y,.044]],.004,.90,8,5);
      p.stroke('#b1d4bb',[[x-.015,y,.044],[x-.014,y-.019,.044],[x,y-.026,.044],[x+.014,y-.018,.044],[x+.015,y,.044]],.004,.9,8,5);
      p.block('#b1d4bb',x,y-.017,.045,.004,.016,.004);
    }
    p.stroke('#d7b674',[[-.023,.028,.044],[-.011,.035,.044],[.005,.043,.044]],.0035,1,4);
    p.stroke('#d7b674',[[.025,.040,.044],[.032,.030,.044],[.038,.017,.044]],.0035,1,4);
    p.block('#e4dab8',.010,-.053,.042,.094,.007,.004);
    p.block('#a6c1b2',.008,-.068,.042,.061,.005,.004);
  }
}

function airplaneWing(p,color,corners,thickness=.009) {
  const signedArea=corners.reduce((sum,[x,z],i)=>{
    const next=corners[(i+1)%corners.length];
    return sum+x*next[1]-z*next[0];
  },0);
  const outline=signedArea<0?corners:corners.slice().reverse();
  const points=[],faces=[],n=outline.length;
  for (const y of [-thickness/2,thickness/2]) {
    for(const [x,z] of outline) points.push(x,y,z);
  }
  for(let i=1;i<n-1;i++) faces.push(0,i+1,i,n,n+i,n+i+1);
  for(let i=0;i<n;i++) {
    const j=(i+1)%n;
    faces.push(i,j,n+i,j,n+j,n+i);
  }
  p.surface(color,points,faces);
}

function passengerJet(p) {
  const white='#f2ebd8',blue='#6988a0',trim='#c57862';
  p.oval(white,0,.003,0,.149,.027,.031);
  p.oval(blue,-.103,.013,.006,.036,.015,.024,[0,0,-.10]);
  for(const s of [-1,1]) {
    airplaneWing(p,'#d6d7ca',[[-.044,s*.015],[.016,s*.014],[.091,s*.130],
      [.068,s*.136],[.030,s*.111]]);
    airplaneWing(p,blue,[[.072,s*.012],[.111,s*.012],[.137,s*.063],[.118,s*.068]],.006);
    p.oval('#dadaca',.018,-.017,s*.062,.035,.015,.015);
    p.dot('#697473',-.013,-.017,s*.062,.006,.010,.010);
    for(const x of [-.06,-.033,-.006,.022,.047]) p.dot('#647c88',x,.009,s*.028,.005,.005,.003);
  }
  p.surface(trim,[.069,.020,0,.114,.020,0,.132,.075,0,.107,.072,0],[0,1,2,0,2,3]);
  p.surface(trim,[.069,.020,-.002,.114,.020,-.002,.132,.075,-.002,.107,.072,-.002],[0,2,1,0,3,2]);
  p.stroke(trim,[[.112,.02,0],[.122,.047,0],[.131,.074,0]],.004,.8,5);
}

function makeProp(p, kind) {
  if(kind==='directory'||kind==='blockchainBook') {
    bookProp(p,kind);
  } else if(kind==='airplane') {
    passengerJet(p);
  } else if (kind==='house') {
    p.block('#e2b780',0,0,0,.201,.152,.146);
    for (const s of [-1,1]) {
      p.block('#bd6048',s*.059,.095,0,.145,.028,.184,[0,0,-s*.46]);
    }
    p.block('#357565',-.044,-.024,.075,.047,.095,.013);
    p.block('#5b8290',.051,.008,.075,.048,.045,.012);
    p.block(paper,.05,.005,.084,.006,.045,.005);
    p.block('#ad674e',.06,.124,-.036,.027,.043,.033);
  } else if (kind==='helicopter') {
    p.oval('#8eab8b',-.035,0,0,.091,.056,.057);
    p.oval('#668a8b',-.07,.011,.029,.063,.043,.034);
    p.stroke('#8eab8b',[[.021,0,0],[.078,.005,0],[.168,.028,0]],.022,.68);
    p.block('#688770',.162,.035,0,.035,.075,.017,[0,0,.33]);
    p.oval('#484d50',.16,.031,.017,.008,.047,.008,[0,0,-.35]);
    p.oval('#484d50',.16,.031,.017,.047,.008,.008,[0,0,-.35]);
    p.block('#504944',-.036,.064,0,.014,.052,.014);
    p.block('#4b5351',-.036,.090,0,.257,.012,.021,[0,.15,0]);
    p.dot('#e7b354',-.036,.093,0,.015,.009,.015);
    for (const s of [-1,1]) {
      p.stroke('#655b54',[[-.077,-.035,s*.025],[-.061,-.064,s*.048],
        [.033,-.064,s*.048],[.044,-.035,s*.022]],.006,1);
      p.block('#48494b',-.013,-.066,s*.048,.143,.012,.014);
    }
  } else if (kind==='lens') {
    p.stroke('#397679',[[-.058,-.117,0],[-.031,-.066,0],[.006,-.004,0]],.019,.90);
    p.oval('#9bd5cc',.033,.046,0,.079,.08,.019);
    ring(p,'#3c9ca0',.033,.046,.004,.08,.082,.014);
    p.stroke('#e4f6dd',[[.005,.071,.020],[.014,.085,.019],[.028,.091,.018]],.006,.32);
  } else if (kind==='camera') {
    p.block('#4e5756',0,0,0,.225,.148,.092);
    p.block('#d7d3b9',0,.053,0,.225,.049,.095);
    p.block('#6f726e',-.046,.091,-.006,.069,.036,.055);
    p.dot('#dfb36a',.067,.080,0,.014,.011,.015);
    p.oval('#383d43',-.023,-.009,.060,.064,.064,.043);
    p.oval('#89928f',-.023,-.009,.083,.052,.052,.024);
    p.oval('#475d67',-.023,-.009,.099,.040,.040,.014);
    p.dot('#a5c7c6',-.036,.005,.111,.012,.011,.004);
    p.block('#a4a89b',.074,.025,.05,.031,.020,.006);
    p.block('#363b3e',-.005,0,-.049,.134,.086,.007);
  } else if (kind==='fish') {
    p.oval('#b2dcd4',0,-.003,0,.111,.104,.095);
    p.oval('#8ecbc6',0,-.031,.013,.103,.074,.085);
    p.oval('#c4e5d9',0,.078,0,.089,.017,.077);
    p.oval('#8cc2bd',0,.086,0,.075,.007,.062);
    p.oval('#c3dccc',0,-.099,0,.072,.012,.059);
    p.oval('#e78b48',-.01,-.018,.085,.051,.029,.019, [0,0,.14]);
    p.dot('#d37543',.041,-.015,.081,.026,.026,.012, [0,0,-.3]);
    p.dot('#473e39',-.038,-.012,.100,.005);
    p.stroke(paper,[[-.086,.001,.049],[-.086,.033,.048],[-.066,.057,.05]],.005,.50);
    p.dot('#e7fff0',.059,.033,.079,.009);
  } else if (kind==='mallet') {
    p.stroke('#a2704c',[[-.068,-.119,0],[-.01,.015,0],[.09,.232,0]],.013,.87);
    p.stroke('#695143',[[-.069,-.12,0],[-.057,-.091,0],[-.045,-.063,0]],.017,.9);
    p.oval('#d9a36b',.097,.241,.003,.081,.032,.032,[0,0,-.38]);
    p.dot('#ad7854',.166,.214,.003,.015,.027,.028,[0,0,-.38]);
  } else if (kind==='monitor') {
    p.block('#d985a4',0,.018,0,.222,.165,.113);
    p.block('#f0a9bd',0,.02,.027,.212,.151,.080);
    p.block('#554d67',-.005,.027,.072,.161,.105,.018);
    p.block('#8cb5af',-.002,.028,.083,.135,.085,.009);
    for (const [x,y] of [[-.019,.036],[0,.036],[.019,.036],[-.009,.022],[.009,.022],[0,.011]]) {
      p.block('#f3cece',x,y,.09,.013,.014,.006);
    }
    p.block('#ab7290',0,-.078,0,.055,.050,.054);
    p.block('#e19cb1',0,-.098,.012,.140,.022,.092);
    p.dot('#fcdfab',.083,-.033,.069,.007,.007,.004);
  } else if (kind==='clipboard') {
    p.block('#9273b9',0,0,0,.170,.218,.027);
    p.block('#f6e9ce',0,-.004,.018,.143,.174,.011);
    p.block('#6f5b8d',0,.091,.025,.074,.029,.019);
    for (let j=0;j<3;j++) {
      const y=.042-j*.041;
      p.stroke('#6e9e88',[[-.054,y,.027],[-.045,y-.007,.028],[-.033,y+.009,.028]],.004,.78,5);
      p.block('#a7a09a',.017,y,.025,.061,.006,.004);
    }
  } else if (kind==='flowers') {
    for (const [x,y,z,color] of [[-.060,.115,.006,'#e7979d'],[.036,.128,-.01,'#eab75f'],
      [.004,.155,.012,'#e3b3ae'],[.061,.097,.020,'#c8859f']]) {
      p.stroke('#65866b',[[0,-.084,0],[x*.5,.044,z*.5],[x,y,z]],.005,1);
      for (let j=0;j<5;j++) {
        const a=j/5*tau;
        p.dot(color,x+Math.cos(a)*.020,y+Math.sin(a)*.02,z+.004,.016,.016,.010);
      }
      p.dot('#efc85c',x,y,z+.016,.012,.012,.008);
    }
    p.oval('#709c74',-.037,.058,.004,.037,.014,.009,[0,.17,-.60]);
    p.oval('#709c74',.031,.041,.004,.035,.012,.009,[0,-.2,.55]);
    p.loft('#cfab80',[[-.104,.018,.019,.002,0],[-.081,.022,.021],[.041,.046,.037]],12);
    p.block('#d2877f',0,-.043,.017,.075,.019,.016,[0,0,.09]);
  } else if (kind==='flag') {
    p.stroke('#a47450',[[-.054,-.130,0],[-.054,.03,0],[-.054,.188,0]],.010,.96);
    p.dot('#d6a851',-.054,.19,0,.015);
    p.surface('#e9af43',[-.051,.171,.003, .039,.18,-.016, .128,.14,.009, .099,.107,.008,
      .13,.074,.009, .039,.104,-.016, -.051,.092,.003],[0,1,5,0,5,6,1,2,3,1,3,5,3,4,5,5,1,0,6,5,0,3,2,1,5,3,1,5,4,3]);
    p.dot('#ffe1a3',.014,.132,.001,.016,.016,.006);
  } else if (kind==='toolbox') {
    p.block('#45857f',0,-.034,0,.235,.108,.124);
    p.block('#659c8b',0,.025,0,.242,.045,.13);
    p.stroke('#504c49',[[-.054,.044,0],[-.051,.087,0],[.050,.087,0],[.054,.044,0]],.012,.95);
    for(const x of [-.070,.070]) p.block('#d4bb92',x,.001,.066,.020,.031,.010);
  } else if (kind==='ruby') {
    const n=8, bottom=[0,-.118,0], vertices=[], top=[];
    for(let i=0;i<n;i++) {
      const a=(i+.5)/n*tau;
      vertices.push([Math.sin(a)*.127,.007,Math.cos(a)*.095]);
      top.push([Math.sin(a)*.069,.075,Math.cos(a)*.054]);
    }
    const tones=['#ca4960','#f07578','#b7405a','#dc5971'];
    for(let i=0;i<n;i++) {
      const j=(i+1)%n;
      p.surface(tones[i%4],[...bottom,...vertices[j],...vertices[i]],[0,1,2]);
      p.surface(tones[(i+1)%4],[...vertices[i],...vertices[j],...top[i],...top[j]],[0,1,2,1,3,2]);
      p.surface('#f18c8c',[0,.075,0,...top[i],...top[j]],[0,1,2]);
    }
  } else if (kind==='calendar') {
    p.block('#ab6350',0,0,0,.185,.191,.066);
    p.block(paper,0,-.006,.028,.184,.177,.055);
    p.block('#d06b54',0,.065,.057,.187,.046,.018);
    for(const x of [-.05,.05]) ring(p,'#696f68',x,.090,.015,.011,.022,.005);
    const ink='#677669';
    for(const x of [-.028,.028]) p.block(ink,x,-.013,.058,.008,.071,.004);
    for(const y of [-.047,-.014,.020]) p.block(ink,0,y,.059,.058,.007,.004);
  } else if (kind==='rabbit') {
    p.oval('#f0e8d7',0,-.038,0,.063,.080,.057);
    p.dot(paper,0,.029,.014,.060,.053,.057);
    for(const s of [-1,1]) {
      p.oval(paper,s*.027,.106,.005,.020,.068,.018,[.05,0,-s*.16]);
      p.oval('#dca59b',s*.027,.112,.019,.009,.044,.005,[.05,0,-s*.16]);
      p.dot(dark,s*.024,.039,.064,.006,.007,.004);
      p.dot('#e2d7c8',s*.042,-.093,.024,.034,.022,.042);
    }
    p.dot('#d28f83',0,.020,.070,.008,.006,.005);
    p.dot(paper,0,-.058,-.055,.027,.029,.026);
  } else if (kind==='carabiner') {
    p.stroke('#d77b53',[[-.052,-.074,0],[-.071,-.039,0],[-.016,.081,0],
      [.041,.115,0],[.065,.091,0],[.059,.059,0],[.011,-.061,0],
      [-.021,-.088,0],[-.052,-.074,0]],.020,1,25,8);
    p.stroke('#d4c9b2',[[.058,.068,.002],[.043,.034,.002],[.018,-.031,.002]],.020,1);
    p.stroke('#71968c',[[.049,.045,.003],[.038,.019,.003],[.032,.005,.003]],.024,.95);
  } else if (kind==='phone' || kind==='board') {
    if (kind==='phone') {
      p.block('#464b50',0,0,0,.133,.212,.024);
      p.block('#a5b0a7',0,0,.013,.120,.195,.007);
      p.block('#334546',0,0,.019,.111,.181,.006);
      p.stroke('#a4d8af',[[-.035,.017,.024],[-.018,.003,.024],[-.035,-.011,.024]],.005,.82);
      p.block('#a4d8af',.014,-.013,.023,.03,.008,.004);
      p.dot(dark,-.037,.071,-.016,.014,.014,.007);
    } else {
      p.block('#517e6c',0,0,0,.193,.14,.036);
      p.block('#283c3e',0,.011,.026,.143,.091,.020);
      const pixels=[[-1,-1],[0,-1],[1,-1],[-1,0],[0,0],[1,0],[-1,1],[0,1],[1,1],[-3,0],[3,0],[0,-3],[0,3],[-2,2],[2,2],[-2,-2],[2,-2]];
      for (const [x,y] of pixels) p.block('#e7bb61',x*.010,y*.010+.01,.038,.009,.009,.004);
      for (const x of [-.079,.079]) for (const y of [-.054,.054]) p.dot('#cdb880',x,y,.02,.005);
      p.block('#b9b3a1',-.024,-.057,0,.035,.023,.030);
    }
  } else if (kind==='bear') {
    const fur='#b57d57', snout='#dfb986';
    p.oval(fur,0,-.044,0,.066,.079,.052);
    p.dot(fur,0,.044,.006,.071,.060,.055);
    for(const s of [-1,1]) {
      p.dot(fur,s*.054,.089,.003,.027);
      p.dot(snout,s*.056,.091,.022,.015,.015,.007);
      p.dot('#483c39',s*.026,.051,.056,.006);
      p.oval(fur,s*.061,-.038,0,.027,.043,.030,[0,0,s*.35]);
      p.dot(fur,s*.036,-.101,.016,.031,.028,.04);
    }
    p.dot(snout,0,.029,.054,.030,.022,.018);
    p.dot('#4d4037',0,.039,.071,.010,.007,.005);
    p.oval(snout,0,-.049,.046,.039,.048,.009);
  }
}

const shirtLevels = [
  [.435,.167,.122], [.45,.195,.137], [.486,.21,.146], [.566,.208,.147],
  [.692,.221,.151], [.765,.233,.145], [.805,.223,.134], [.844,.185,.113],
  [.879,.13,.094], [.896,.083,.069]
];

function shirtZ(x,y) {
  let hi=shirtLevels.findIndex(row => row[0]>=y);
  if (hi<0) hi=shirtLevels.length-1;
  const upper=shirtLevels[hi], lower=shirtLevels[Math.max(0,hi-1)];
  const t=upper[0]===lower[0]?0:(y-lower[0])/(upper[0]-lower[0]);
  const rx=lower[1]+(upper[1]-lower[1])*t;
  const rz=lower[2]+(upper[2]-lower[2])*t;
  return rz*Math.sqrt(Math.max(.025,1-(x/rx)**2));
}

function shirtPath(xy, d=.006) {
  return xy.map(([x,y])=>[x,y,shirtZ(x,y)+d]);
}

function shirtPatch(part,color,outline,depth=.007) {
  const center=outline.reduce((sum,p)=>[sum[0]+p[0]/outline.length,sum[1]+p[1]/outline.length],[0,0]);
  const vertices=[],faces=[];
  // Fabric follows the convex body over the whole width of the panel.
  // Tessellation keeps the center of larger triangles above the shirt surface.
  for(let edge=0;edge<outline.length;edge++) {
    let a=outline[edge],b=outline[(edge+1)%outline.length];
    if((a[0]-center[0])*(b[1]-center[1])<(a[1]-center[1])*(b[0]-center[0])) {
      [a,b]=[b,a];
    }
    const detail=5, rows=[];
    for(let j=0;j<=detail;j++) {
      const row=[];
      for(let k=0;k<=j;k++) {
        const u=(j-k)/detail,v=k/detail;
        const x=center[0]+(a[0]-center[0])*u+(b[0]-center[0])*v;
        const y=center[1]+(a[1]-center[1])*u+(b[1]-center[1])*v;
        row.push(vertices.length/3);
        vertices.push(x,y,shirtZ(x,y)+depth);
      }
      rows.push(row);
      if(j>0) for(let k=0;k<j;k++) {
        faces.push(rows[j-1][k],row[k],row[k+1]);
        if(k<j-1) faces.push(rows[j-1][k],row[k+1],rows[j-1][k+1]);
      }
    }
  }
  part.surface(color,vertices,faces);
}

function makeBody(part,look,mix) {
  const {top, outfit} = look;
  const deep=mix(top,'#433b38',.24), edge=mix(top,'#e4d7bc',.22);
  part.loft(look.pants,[[.407,.113,.102],[.424,.178,.129],[.472,.194,.131],[.495,.148,.115]]);
  part.oval(look.skin,0,.883,0,.093,.079,.087);
  part.loft(top,shirtLevels);
  part.stroke(deep,shirtPath([[-.131,.462],[-.073,.456],[.008,.456],[.091,.46],[.152,.466]],.003),.005,.3);
  const jackets=['bomber','coat','fieldJacket','denimHood'];
  if (jackets.includes(outfit)) {
    const under=outfit==='denimHood'?'#c84c42':outfit==='coat'?'#54505d':'#ede2ca';
    shirtPatch(part,under,[[-.072,.457],[.068,.457],[.067,.69],[.110,.837],[.069,.879],
      [-.07,.879],[-.11,.837],[-.068,.696]],.009);
    for(const s of [-1,1]) {
      part.stroke(edge,shirtPath([[s*.073,.463],[s*.073,.674],[s*.094,.773],[s*.106,.843]],.015),.007,.74);
      shirtPatch(part,edge,[[s*.117,.79],[s*.181,.817],[s*.128,.863],[s*.086,.871]].sort((a,b)=>Math.atan2(a[1]-.836,a[0]-s*.128)-Math.atan2(b[1]-.836,b[0]-s*.128)),.012);
    }
    if(outfit==='denimHood') {
      part.oval(under,0,.858,-.039,.169,.073,.118);
      part.stroke(under,shirtPath([[-.081,.865],[-.059,.842],[0,.816],[.06,.844],[.084,.866]],.018),.021,.71);
      for (const s of [-1,1]) {
        part.stroke('#ead8ba',shirtPath([[s*.04,.823],[s*.040,.785],[s*.045,.751]],.018),.005,.92);
      }
    }
    if (outfit==='coat') {
      for(const s of [-1,1]) {
        part.oval(top,s*.104,.863,-.024,.049,.096,.090,[.14,0,-s*.41]);
      }
    }
  } else if(outfit==='suit') {
    const shirt='#e9e9de',tie='#555e69',lapel=mix(top,'#729099',.16);
    shirtPatch(part,shirt,[[-.084,.862],[-.028,.694],[0,.653],[.084,.862],[.068,.880],[-.067,.880]],.010);
    shirtPatch(part,tie,[[-.008,.844],[-.017,.704],[0,.684],[.019,.705],[.007,.844]],.017);
    shirtPatch(part,tie,[[-.019,.857],[0,.830],[.019,.857],[.012,.868],[-.012,.868]],.020);
    for(const s of [-1,1]) {
      shirtPatch(part,lapel,[[s*.100,.867],[s*.171,.835],[s*.114,.798],
        [s*.150,.783],[s*.016,.636],[s*.052,.759]],.013);
      shirtPatch(part,shirt,[[s*.019,.854],[s*.055,.807],[s*.084,.860],[s*.069,.879]],.017);
    }
    part.dot('#59606a',.013,.613,shirtZ(.013,.613)+.011,.009,.009,.005);
    part.stroke(lapel,shirtPath([[.093,.744],[.118,.747],[.145,.750]],.008),.004,.90);
  } else if (outfit==='stripes') {
    for(const y of [.527,.579,.636,.693,.748,.803]) {
      const row=shirtLevels.findIndex(level=>level[0]>=y);
      const a=shirtLevels[row-1],b=shirtLevels[row],f=(y-a[0])/(b[0]-a[0]);
      const rx=a[1]+(b[1]-a[1])*f+.0015,rz=a[2]+(b[2]-a[2])*f+.0015;
      part.loft('#56565a',[[y,rx,rz],[y+.014,rx,rz]]);
    }
  }
  if (['polo','blouse','buttonDown','openCollar','silk','drapedCollar'].includes(outfit)) {
    const collar=outfit==='openCollar'?mix(top,'#b1b8a4',.18):
      outfit==='drapedCollar'?mix(top,'#82918f',.14):edge;
    for(const s of [-1,1]) {
      const low=outfit==='drapedCollar'?.760:.783;
      const outline=[[s*.022,.825],[s*.085,.882],[s*.151,.848],[s*.089,low]];
      if(s<0) outline.reverse();
      shirtPatch(part,collar,outline,.012);
    }
    if(outfit==='openCollar') {
      shirtPatch(part,look.skin,[[-.062,.869],[0,.774],[.062,.869]],.013);
    }
    if (outfit!=='blouse') {
      part.stroke(deep,shirtPath([[0,.812],[0,.748],[0,.686]],.006),.005,.8);
      for(const y of (outfit==='buttonDown'?[.792,.725,.659,.592,.526]:[.78,.721])) {
        part.dot(outfit==='buttonDown'?'#c5beaa':deep,0,y,shirtZ(0,y)+.010,.006,.006,.004);
      }
    }
    if(outfit==='drapedCollar') {
      part.dot('#727c7c',.012,.776,shirtZ(.012,.776)+.014,.013,.013,.006);
    }
    if(outfit==='polo'||outfit==='buttonDown') {
      part.stroke(edge,shirtPath([[.074,.730],[.096,.685],[.127,.685],[.149,.728]],.005),.004,.66,7);
      if(outfit==='polo') part.block('#54686a',.112,.716,shirtZ(.112,.716)+.006,.036,.018,.008,[0,.39,0]);
    }
  } else if (outfit==='turtleneck') {
    part.loft(top,[[.853,.116,.094],[.86,.125,.101],[.911,.105,.088],[.928,.094,.081]]);
  } else if (!jackets.includes(outfit) && outfit!=='suit') {
    part.stroke(deep,shirtPath([[-.105,.869],[-.068,.846],[0,.838],[.070,.847],[.104,.869]],.009),.009,.76);
  }
  if(outfit==='henley') {
    part.stroke(deep,shirtPath([[0,.838],[0,.783],[0,.734]],.006),.009,1);
    for(const y of [.798,.757]) part.dot('#95928b',0,y,shirtZ(0,y)+.019,.007,.007,.004);
  }
  if(outfit==='pendant'||outfit==='lanyard') {
    const lanyard=outfit==='lanyard';
    const cord=lanyard?'#578aa8':'#b7b5a6';
    part.stroke(cord,shirtPath([[-.104,.871],[-.078,.806],[0,lanyard?.628:.747],[.077,.808],[.104,.871]],.013),lanyard?.011:.005,.9,12);
    if(lanyard) {
      part.block('#ecddbb',0,.60,shirtZ(0,.6)+.020,.061,.058,.013);
      part.block('#78a2ad',0,.612,shirtZ(0,.6)+.028,.047,.016,.004);
      part.oval('#e9b584',0,.735,shirtZ(0,.735)+.002,.072,.054,.007);
    } else {
      part.dot('#c7c9b7',0,.729,shirtZ(0,.729)+.019,.018,.022,.008);
    }
  }
  if(['turtleneck','crossbody','fieldJacket'].includes(outfit)) {
    const strap=outfit==='turtleneck'?'#816748':outfit==='crossbody'?'#626a73':'#a17a54';
    part.stroke(strap,shirtPath([[.125,.85],[.083,.782],[-.006,.691],[-.101,.594],[-.181,.511]],.016),.015,1,12,7);
    part.stroke(strap,[[.125,.85,.08],[.15,.851,-.037],[.07,.733,-.14],[-.09,.58,-.13],[-.18,.50,-.071]],.013,1,10);
    if(outfit!=='crossbody') {
      part.block(strap,-.164,.52,.091,.102,.09,.063,[0,-.28,-.12]);
    }
  }
}

function makeArm(part,side,look,studio) {
  const {mix,Part}=studio;
  const jacket=['denimHood','bomber','coat','fieldJacket','buttonDown','stripes','silk','blouse','suit','drapedCollar'].includes(look.outfit);
  const handX=side*.073;
  if(jacket) {
    part.oval(look.skin,side*.070,-.241,.075,.041,.041,.041,[-.30,0,0]);
    part.loft(look.top,[[-.231,.044,.046,side*.072,.06],[-.215,.055,.052,side*.073,.055],
      [-.118,.060,.067,side*.057,.017],[-.003,.079,.088,side*.014,.001],[.037,.058,.058]],18);
    part.oval(mix(look.top,'#4c4a45',.17),side*.07,-.217,.059,.052,.025,.051,[-.26,0,0]);
    if(look.outfit==='suit') {
      part.oval('#e7e5d9',side*.070,-.231,.064,.048,.017,.048,[-.28,0,0]);
    }
  } else {
    part.oval(look.skin,side*.061,-.183,.043,.049,.105,.049,[-.37,0,side*.05]);
    part.loft(look.top,[[-.131,.063,.068,side*.060,.011],[-.115,.07,.069,side*.057,.009],
      [-.051,.080,.077,side*.037,.004],[.009,.078,.081,side*.009,0],[.047,.039,.047]],18);
    part.oval(mix(look.top,'#52483f',.16),side*.058,-.121,.012,.067,.016,.068);
  }
  part.oval(look.skin,handX,-.260,.089,.051,.064,.055,[-.32,0,side*.05]);
  part.dot(look.skin,handX-side*.034,-.255,.122,.025,.033,.023,[-.12,0,side*.27]);
  if(side>0 && look.prop) {
    const accessory = new Part();
    makeProp(accessory,look.prop);
    const geo=accessory.finish();
    const angle=look.prop==='airplane'?[-.58,.13,-.18]:[-.11,-.13,-.08];
    part.piece(geo,null,handX+.05,-.214,.145,[1,1,1],angle);
    geo.dispose();
  }
  if(side<0 && ['lanyard','crossbody'].includes(look.outfit)) {
    part.oval(look.outfit==='crossbody'?'#cb796d':'#648399',handX,-.220,.069,.052,.014,.052,[-.3,0,0]);
  }
}

function makeLeg(upper,lower,side,look,mix) {
  const shorts=['polo','fieldJacket'].includes(look.outfit);
  const fabric=look.pants;
  upper.loft(fabric,[[-.220,.081,.086,0,.006],[-.19,.085,.088,0,.006],
    [-.069,.091,.093,side*.003,.001],[-.012,.095,.093],[.042,.070,.078]],18);
  lower.loft(shorts?look.skin:fabric,[[-.220,.062,.066,0,.007],[-.192,.067,.073],
    [-.10,.077,.081],[-.015,.082,.084],[.029,.079,.079]],18);
  if(shorts) lower.oval(mix(fabric,'#3e4745',.14),0,-.017,.003,.083,.024,.086);
  else lower.oval(mix(fabric,'#3e4745',.17),0,-.197,.004,.070,.022,.074);
  const shoe=look.outfit==='coat'?'#60554d':look.outfit==='fieldJacket'?'#b37858':
    look.outfit==='polo'?'#c6c7b8':'#e2d7bc';
  lower.block('#a79983',0,-.276,.035,.155,.035,.221,[0,-side*.035,0]);
  lower.oval(shoe,0,-.243,.038,.079,.046,.111,[-.06,-side*.035,0]);
  for(const z of [.049,.074]) lower.stroke(paper,[[-.029,-.209,z],[0,-.204,z+.003],[.029,-.209,z]],.0035,.6,5);
}

function buildPieces(studio,look,expression) {
  const {Part,mix}=studio;
  const body=new Part(), head=new Part(), eyes=new Part();
  makeBody(body,look,mix);
  makeHead(head,eyes,look,mix,expression);
  const limbs=[-1,1].map(side=>{
    const arm=new Part(),thigh=new Part(),shin=new Part();
    makeArm(arm,side,look,studio);
    makeLeg(thigh,shin,side,look,mix);
    return {arm:arm.finish(),thigh:thigh.finish(),shin:shin.finish()};
  });
  return {body:body.finish(),head:head.finish(),eyes:eyes.finish(),limbs};
}

function greetingPalm(studio,skin) {
  const palm=new studio.Part();
  palm.oval(skin,0,.031,0,.044,.052,.024);
  palm.oval(skin,-.046,.049,0,.020,.038,.017,[0,0,.59]);
  for(const [x,y,length,angle] of [
    [-.030,.085,.036,.16],[-.010,.094,.04,.05],
    [.012,.09,.037,-.055],[.033,.078,.031,-.18]
  ]) {
    palm.oval(skin,x,y,0,.013,length,.014,[0,0,angle]);
  }
  return palm.finish();
}

function colorKey(r,g,b) {
  return Math.round(r*65535)*4294967296+Math.round(g*65535)*65536+Math.round(b*65535);
}

function guestPieces(T,studio,pieces,color) {
  const {mix}=studio;
  const original=looks.visitor.top;
  const dyes=new Map();
  function dye(before,after) {
    const a=before.isColor?before:new T.Color(before);
    const b=after.isColor?after:new T.Color(after);
    dyes.set(colorKey(a.r,a.g,a.b),b);
  }
  dye(original,color);
  for(const [shade,amount] of [['#433b38',.24],['#e4d7bc',.22],['#4c4a45',.17]]) {
    dye(mix(original,shade,amount),mix(color,shade,amount));
  }
  dye('#df9470',mix(color,'#f5d8ac',.31));
  dye('#8b614e',mix(color,'#46443c',.43));

  // Only the clothing dye changes. All guests reuse the same shape, normals and indices.
  function recolor(source) {
    const geometry=new T.BufferGeometry();
    geometry.setIndex(source.index);
    geometry.setAttribute('position',source.getAttribute('position'));
    geometry.setAttribute('normal',source.getAttribute('normal'));
    const colors=source.getAttribute('color').clone();
    for(let i=0;i<colors.count;i++) {
      const next=dyes.get(colorKey(colors.getX(i),colors.getY(i),colors.getZ(i)));
      if(next) colors.setXYZ(i,next.r,next.g,next.b);
    }
    geometry.setAttribute('color',colors);
    geometry.boundingSphere=source.boundingSphere;
    return geometry;
  }
  return {
    ...pieces,
    body:recolor(pieces.body),
    head:recolor(pieces.head),
    limbs:pieces.limbs.map(limb=>({...limb,arm:recolor(limb.arm)}))
  };
}

/** A reusable clay collectible. The origin is between the soles and forward is +Z. */
export function createFigure(T,handle='visitor',{guestColor}={}) {
  const requested=String(handle).replace(/^@/,'').toLowerCase();
  const id=Object.hasOwn(looks,requested)?requested:'visitor';
  const look=looks[id];
  const expression=expressions[id];
  const studio=clayStudio(T);
  if(!perStudio.has(studio)) perStudio.set(studio,new Map());
  const library=perStudio.get(studio);
  if(!library.has(id)) library.set(id,buildPieces(studio,look,expression));
  let pieces=library.get(id);
  if(id==='visitor' && typeof guestColor==='string' && /^#[\da-f]{6}$/i.test(guestColor)) {
    const color=guestColor.toLowerCase();
    const key='guest'+color;
    if(!library.has(key)) library.set(key,guestPieces(T,studio,pieces,color));
    pieces=library.get(key);
  }
  const root=new T.Group();
  root.name='Figure '+id;
  root.userData.handle=handle;
  const pose=new T.Group();
  root.add(pose);
  const mesh=(geo,parent,x=0,y=0,z=0)=>{
    const result=new T.Mesh(geo,studio.clay);
    result.position.set(x,y,z);
    result.castShadow=true;
    result.receiveShadow=true;
    parent.add(result);
    return result;
  };
  const torso=mesh(pieces.body,pose);
  if(look.slim) torso.scale.x=.95;
  const head=mesh(pieces.head,pose,0,1.214,0);
  head.name='Head';
  head.scale.set(expression[0],expression[1],1);
  const eyes=mesh(pieces.eyes,head,0,.025,0);
  const limbs=pieces.limbs.map((piece,i)=>{
    const side=i*2-1;
    const arm=mesh(piece.arm,pose,side*(look.slim?.199:.210),.817,0);
    const thigh=mesh(piece.thigh,pose,side*.102,.50,0);
    const shin=mesh(piece.shin,thigh,0,-.205,0);
    return {arm,thigh,shin,side};
  });
  const hash=Array.from(id).reduce((sum,c)=>sum+c.charCodeAt(0)*.149,0);
  let palm=null;
  let walkWeight=0,seatWeight=0,previousTime;
  function animate(time=0,walking=false,seated=false,wave=0) {
    const delta=previousTime===undefined?1:Math.max(0,Math.min(.16,time-previousTime));
    previousTime=time;
    const ease=1-Math.exp(-delta*15);
    const targetWalk=seated?0:Math.min(1,Math.max(0,Number(walking)||0));
    walkWeight+=(targetWalk-walkWeight)*ease;
    seatWeight+=(Number(Boolean(seated))-seatWeight)*ease;
    const greeting=Math.max(0,Math.min(1,Number(wave)||0));
    const shake=Math.sin(time*14+hash);
    const reach=Math.cos(time*6.4+hash);
    const step=Math.sin(time*8.8+hash),breath=Math.sin(time*2+hash);
    pose.position.y=.004*(1+breath)+Math.abs(step)*.032*walkWeight-.015*seatWeight;
    pose.rotation.x=.045*walkWeight+.041*seatWeight;
    pose.rotation.z=step*.024*walkWeight+.044*greeting;
    head.rotation.y=Math.sin(time*.69+hash)*(.041+.038*walkWeight);
    head.rotation.x=.013*breath+.096*seatWeight;
    head.rotation.z=expression[4]+.011*Math.sin(time*.82+hash)-(.048+.015*shake)*greeting;
    const blink=(time+hash)%(4.2+(hash%1.5));
    eyes.scale.y=blink<.17?.11+.89*Math.min(1,Math.abs(blink-.085)/.065):1;
    for(const {arm,thigh,shin,side} of limbs) {
      const stride=step*side;
      thigh.rotation.x=-stride*.48*walkWeight-1.30*seatWeight;
      shin.rotation.x=Math.max(0,stride)*.42*walkWeight+1.30*seatWeight;
      arm.rotation.x=stride*.39*walkWeight-.043+.021*breath-.94*seatWeight;
      arm.rotation.y=0;
      arm.rotation.z=side*(.06+.037*walkWeight+.061*seatWeight);
      arm.scale.y=1;
      if(seatWeight>.02) arm.rotation.x+=Math.sin(time*4.4+side)*.033*seatWeight;
      if(side<0 && greeting>0) {
        // Trace a broad arc around the shoulder while keeping the open palm raised.
        const waveYaw=.13+.51*shake,waveRoll=-2.48+.25*shake;
        const wristY=-.272*1.34;
        const lateral=-.073*Math.cos(waveRoll)-wristY*Math.sin(waveRoll);
        const lift=-.073*Math.sin(waveRoll)+wristY*Math.cos(waveRoll);
        const forward=.089*Math.cos(waveYaw)-lateral*Math.sin(waveYaw);
        const peak=-Math.atan2(forward,lift);
        const span=Math.acos(.025/Math.hypot(lift,forward));
        const wavePitch=T.MathUtils.clamp(-.05+1.37*reach,peak-span,peak+span);
        arm.rotation.x+=(wavePitch-arm.rotation.x)*greeting;
        arm.rotation.y=waveYaw*greeting;
        arm.rotation.z+=(waveRoll-arm.rotation.z)*greeting;
        arm.scale.y+=.34*greeting;
        if(!palm) {
          const palmKey='palm'+look.skin;
          if(!library.has(palmKey)) library.set(palmKey,greetingPalm(studio,look.skin));
          palm=mesh(library.get(palmKey),pose);
          palm.name='Waving hand';
        }
        palm.position.set(-.073,-.272,.089).multiply(arm.scale).applyQuaternion(arm.quaternion).add(arm.position);
        palm.rotation.set(-.12-.12*shake,-.19+.29*Math.cos(time*14+hash),.3*shake);
        palm.scale.setScalar(greeting);
      }
    }
    if(palm) palm.visible=greeting>.025;
  }
  animate(0);
  return {root,animate};
}
