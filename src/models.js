import { clayStudio } from './clay-mesh.js';
import { sculptPortrait, eyeHeight, faceRadius, faceZ } from './portrait-sculpt.js';
import { groomHair } from './figure-hair.js';

// Wardrobe, silhouettes and facial details come from the residents' profile portraits.
// Accessories make their projects legible even at island scale.
const looks = {
  phuctm97: { skin: '#edb68d', hair: '#211c25', style: 'swoop', top: '#59769b', pants: '#354453', outfit: 'denimHood', glasses: 'square', prop: 'house' },
  ky__zo: { skin: '#d6a078', hair: '#684d3b', style: 'parted', top: '#373642', pants: '#807b70', outfit: 'tee', prop: 'helicopter' },
  erwin_ai: { skin: '#f2c09e', hair: '#83573e', style: 'swept', top: '#3c6051', pants: '#47515b', outfit: 'pendant', beard: 'short', prop: 'lens' },
  powpow: { skin: '#e7b193', hair: '#41312f', style: 'knot', top: '#c54e3a', pants: '#463c40', outfit: 'silk', glasses: 'wire', beard: 'full', prop: 'camera' },
  josefbuettgen: { skin: '#e6af85', hair: '#95532d', style: 'quiff', top: '#de663a', pants: '#4c6576', outfit: 'lanyard', prop: 'fish' },
  melanieklenner: { skin: '#f0c3a2', hair: '#805b40', style: 'halfUp', top: '#efe5d9', pants: '#83927a', outfit: 'blouse', prop: 'mallet', slim: true },
  ann_nnng: { skin: '#e2ad85', hair: '#282528', style: 'long', top: '#e9e4d4', pants: '#756254', outfit: 'turtleneck', prop: 'monitor', slim: true },
  loaibassam: { skin: '#ddb08e', hair: '#332c2c', style: 'curls', top: '#514d53', pants: '#8b9188', outfit: 'henley', prop: 'clipboard', slim: true },
  sup_nim: { skin: '#b88467', hair: '#302a2b', style: 'curls', top: '#f0e9d8', pants: '#5a635f', outfit: 'openCollar', beard: 'shadow', prop: 'flowers' },
  founderish: { skin: '#dbaa89', hair: '#50413a', style: 'fade', top: '#393f49', pants: '#687c7b', outfit: 'tee', beard: 'short', prop: 'flag' },
  tdinh_me: { skin: '#dca579', hair: '#292b2b', style: 'curtains', top: '#354b68', pants: '#494c4d', outfit: 'buttonDown', prop: 'toolbox' },
  rameerez: { skin: '#d9a680', hair: '#332b2a', style: 'curls', top: '#33383d', pants: '#717b76', outfit: 'tee', beard: 'full', prop: 'ruby' },
  fiachrarm: { skin: '#edbb96', hair: '#8e694e', style: 'quiff', top: '#e9ddca', pants: '#4b4c4d', outfit: 'checked', glasses:'amber', prop: 'calendar' },
  praneethpike: { skin: '#b77f5f', hair: '#302a29', style: 'shaved', top: '#4a4140', pants: '#757465', outfit: 'tee', glasses: 'square', beard: 'short', prop: 'rabbit' },
  sandrokratz: { skin: '#d9a57c', hair: '#73533c', style: 'quiff', top: '#514940', pants: '#677068', outfit: 'bomber', prop: 'carabiner', slim: true },
  odd_joel: { skin: '#deb393', hair: '#342e2d', style: 'cap', top: '#6889a2', pants: '#625b57', outfit: 'crossbody', glasses: 'softSquare', prop: 'phone' },
  ayysoni: { skin: '#bf8b69', hair: '#292628', style: 'wings', top: '#e5dfd3', pants: '#575655', outfit: 'stripes', beard: 'full', prop: 'board' },
  yongfook: { skin: '#d2a182', hair: '#34343e', style: 'silverQuiff', top: '#424252', pants: '#656671', outfit: 'coat', beard: 'shadow', prop: 'bear', slim: true },
  caitbhri: { skin: '#e2b297', hair: '#4b342b', style: 'bangs', top: '#ede8d8', pants: '#768275', outfit: 'tee', jewelry: 'studs', prop: 'directory', slim: true },
  neilhanyd: { skin: '#e6ad90', hair: '#322e30', style: 'combed', top: '#354455', pants: '#46515b', outfit: 'suit', glasses: 'thinSquare', prop: 'blockchainBook' },
  jesslozanos: { skin: '#ddb091', hair: '#654737', style: 'layered', top: '#343f43', pants: '#67747d', outfit: 'drapedCollar', jewelry: 'hoops', prop: 'airplane', slim: true },
  visitor: { skin: '#c58d69', hair: '#3b302c', style: 'bucket', top: '#86a996', pants: '#536558', outfit: 'fieldJacket', prop: null },
};

const tau = Math.PI * 2;
const paper = '#fff5dc';
const dark = '#353737';
const perStudio = new WeakMap();
// Width, height, eye opening, nose width, natural head tilt.
const expressions = {
  phuctm97:[.98,1,.86,1.05,-.018], ky__zo:[.99,1.00,.95,1.08,.046],
  erwin_ai:[.96,1,.91,.95,-.011], powpow:[.98,1.015,.97,1.16,.018],
  josefbuettgen:[.96,1.02,1,.91,-.026], melanieklenner:[.94,1,1.04,.91,.046],
  ann_nnng:[.94,1,.95,.88,-.046], loaibassam:[.91,1.025,1.04,1.04,.013],
  sup_nim:[.97,1,.98,1.06,-.016], founderish:[1.03,.97,.91,.97,-.024],
  tdinh_me:[1.02,.97,.86,1.08,.014], rameerez:[1,.98,.93,1.06,.012],
  fiachrarm:[.97,1.03,1,.98,-.018], praneethpike:[1.06,.98,.91,1.12,.016],
  sandrokratz:[.93,1.025,.88,1.05,-.012], odd_joel:[1.02,.97,.78,1.03,.032],
  ayysoni:[1.02,.98,.9,1.08,-.034], yongfook:[.95,1,.86,1.06,.012],
  caitbhri:[.98,.985,1.12,.91,-.012], neilhanyd:[1.04,1.015,.78,1.06,.01],
  jesslozanos:[.94,1.015,.90,.92,-.085],
  visitor:[1,1,1,1,0]
};

function scalpPoint(a, p, lift=0) {
  const y = Math.cos(p) * .32;
  const [rx,rz] = faceRadius(y);
  const crown = y > .302 ? Math.min(1, (.321-y)/.018) : 1;
  return [Math.sin(a) * (rx + .015 + lift) * crown, y+.011+lift*.6,
    Math.cos(a) * (rz + .016 + lift) * crown];
}

function hairline(a) {
  return .805+(1-Math.cos(a))*.55+Math.abs(Math.sin(a))*.30+Math.sin(a*3)*.035;
}

function hairCap(part, color, boundary, lift=0) {
  const positions = [], indices = [];
  const slices = 48, rings = 15;
  for (let k = 0; k <= rings; k++) {
    const t = 1 - k / rings;
    for (let j = 0; j < slices; j++) {
      const a = j / slices * tau;
      const p = Math.max(.010, t * boundary(a));
      positions.push(...scalpPoint(a,p,lift));
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
  if (!['knot','combed'].includes(look.style)) return;
  const pulled=look.style==='knot';
  const count=pulled?11:7;
  for (let i=0;i<count;i++) {
    const strand=(i/count-.5)*tau;
    const shift=pulled?Math.sin(strand)*.65:.70;
    const path=[];
    for(let j=0;j<7;j++) {
      const t=j/6;
      const a=strand+shift*(1-t);
      const p=.43+(hairline(a)-.43)*t;
      path.push(scalpPoint(a,p,.008));
    }
    part.lock(mix(look.hair,'#b99574',.024+.034*(i%3)/2),path,pulled?.034:.023,pulled?.021:.015,.28,12);
  }
}

function hairstyle(part, look, mix) {
  const { style, hair, skin } = look;
  const ridge = mix(hair, '#958575', .045);
  if (style === 'shaved') {
    const edge=a=>.76+(1-Math.cos(a))*.58+Math.abs(Math.sin(a))*.22;
    hairCap(part,mix(skin,hair,.70),edge);
    for(let j=0;j<85;j++) {
      const a=j*2.39996,t=.12+.84*Math.sqrt((j+.5)/85),p=edge(a)*t;
      const center=scalpPoint(a,p,.0028);
      const tip=scalpPoint(a+.043,p-.050,.0031);
      part.stroke(mix(skin,hair,.56+.30*(j%3)/2),[center,tip],.0032,.2,3,4);
    }
    return;
  }
  const faded=['quiff','silverQuiff','fade'].includes(style)||look.id==='sup_nim';
  if(faded) {
    const sides=style==='silverQuiff'?mix(hair,'#b6b2a6',.68):mix(hair,skin,.17);
    hairCap(part,sides,hairline);
    hairCap(part,hair,a=>.67+(1-Math.cos(a))*.33+Math.abs(Math.sin(a))*.17,.0065);
  } else hairCap(part,hair,hairline);
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
    part.oval('#a84c3e',-.081,.291,-.158,.120,.072,.094,[-.31,0,.2]);
    part.oval(hair,-.10,.315,-.207,.122,.083,.107,[-.25,0,.2]);
    for(let j=0;j<6;j++) {
      const a=tau*j/6;
      part.oval(mix(hair,'#a07d5e',.062),-.10+.074*Math.sin(a),.321+.040*Math.cos(a),
        -.222,.058,.050,.076,[.2*Math.cos(a),a,.33]);
      part.oval(j%2?'#b4503c':'#c05a43',-.082+.096*Math.sin(a),.291+.031*Math.cos(a),
        -.165,.031,.026,.039,[.30,a,.1]);
    }
    for (const s of [-1,1]) {
      part.stroke(ridge, [[s*.254,.112,.13],[s*.223,.219,.095],[s*.13,.29,-.015],[s*.065,.3,-.142]],.009,.25);
    }
    return;
  }

  groomHair(part,look,mix,faceZ);
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
  if(kind==='reading') {
    for(const s of [-1,1]) {
      p.block('#4d8179',s*.054,0,0,.12,.15,.018,[0,s*.37,0]);
      p.block('#ebe1c6',s*.053,.004,.014,.109,.137,.022,[0,s*.37,0]);
      for(const y of [-.030,-.012,.009,.030]) p.block('#a49e8b',s*.052,y,.033,.073,.0038,.003,[0,s*.37,0]);
    }
  } else if(kind==='directory'||kind==='blockchainBook') {
    bookProp(p,kind);
  } else if(kind==='airplane') {
    passengerJet(p);
  } else if (kind==='house') {
    p.block('#e7b27d',0,0,0,.201,.152,.146);
    p.block('#ad7954',0,-.083,.010,.226,.019,.173);
    for (const s of [-1,1]) {
      p.block('#bd6048',s*.059,.095,0,.145,.028,.184,[0,0,-s*.46]);
      p.surface('#d49463',[-.105,.074,s*.073,.105,.074,s*.073,0,.130,s*.073],s>0?[0,1,2]:[0,2,1]);
      p.block('#c78352',s*.064,.003,.075,.046,.048,.014);
      p.block('#86958b',s*.064,.003,.084,.032,.036,.008);
      p.block(paper,s*.064,.003,.089,.004,.034,.003);
      p.block(paper,s*.064,.003,.089,.031,.004,.003);
      p.dot('#749463',s*.082,-.054,.093,.019,.025,.015);
      p.block('#a9664c',s*.082,-.069,.092,.029,.018,.023);
      for(let j=0;j<5;j++) {
        const z=-.071+j*.035;
        p.stroke('#cf7953',[[s*.004,.134,z],[s*.055,.111,z],[s*.115,.086,z]],.005,.76,4,5);
      }
    }
    p.block('#a7744e',0,-.026,.078,.054,.102,.014);
    p.block('#548266',0,-.028,.085,.039,.091,.009);
    p.dot('#ddbf77',.012,-.035,.092,.004);
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
    for(const [y,radius,width,color] of [[.084,.078,.004,'#b2d6cf'],[.049,.097,.0023,'#9ccac4']]) {
      const circle=Array.from({length:31},(_,j)=>[Math.sin(j/30*tau)*radius,y,Math.cos(j/30*tau)*radius]);
      p.stroke(color,circle,width,.97,30,6);
    }
    p.oval('#aaad92',0,-.082,0,.067,.016,.066);
    for(const [x,z,r,ink] of [[-.038,.017,.016,'#a89678'],[.023,-.036,.014,'#b6ac91'],
      [.035,.013,.018,'#a48e77'],[-.005,.031,.009,'#c3ad84']]) p.dot(ink,x,-.070,z,r,r*.58,r*.81);
    for(const [x,z,h] of [[.046,-.024,.057],[.050,-.006,.044],[-.036,-.032,.032]]) {
      p.lock('#718f72',[[x,-.073,z],[x-.008,-.066+h*.30,z],[x+.004,-.070+h*.74,z],[x-.005,-.074+h,z]],.006,.003,.19,6);
    }
    p.oval('#ed9746',-.014,-.009,.009,.047,.029,.022,[0,0,.15]);
    p.dot('#d87939',.038,-.005,.005,.030,.023,.010,[0,0,.48]);
    p.dot('#f1aa4e',.040,-.015,.005,.025,.018,.009,[0,0,-.47]);
    p.dot('#d97b37',-.007,.017,.007,.020,.013,.006,[0,0,-.22]);
    for(const s of [-1,1]) {
      p.dot('#f2ac55',-.003,-.014,.009+s*.019,.022,.011,.004,[0,.15*s,.24]);
      p.dot('#513f35',-.041,-.003,.009+s*.015,.0055,.006,.004);
    }
    p.stroke('#e0f0dd',[[-.086,-.003,.056],[-.092,.020,.050],[-.079,.050,.052]],.0038,.25,9,5);
    p.dot('#d5e9df',-.064,.014,.025,.0045);
    p.dot('#c6e4d8',-.068,.031,.023,.006);
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
    for (const [x,y,z,color] of [[-.060,.115,.006,'#d97b60'],[.036,.128,-.01,'#eaba61'],
      [.004,.155,.012,'#e09170'],[.061,.097,.020,'#ca696b']]) {
      p.stroke('#65866b',[[0,-.084,0],[x*.5,.044,z*.5],[x,y,z]],.005,1);
      for (let j=0;j<5;j++) {
        const a=j/5*tau;
        p.dot(color,x+Math.cos(a)*.020,y+Math.sin(a)*.02,z+.004,.016,.016,.010);
      }
      p.dot('#efc85c',x,y,z+.016,.012,.012,.008);
    }
    for(const [x,z,turn] of [[-.046,-.020,.61],[.044,-.022,-.45],[.008,-.037,-.16]]) {
      p.oval('#6f935f',x,.092,z,.017,.065,.010,[-.10,0,turn]);
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
    p.stroke('#c78855',[[-.054,.044,0],[-.051,.087,0],[.050,.087,0],[.054,.044,0]],.012,.95);
    for(const x of [-.070,.070]) p.block('#d4bb92',x,.001,.066,.020,.031,.010);
  } else if (kind==='ruby') {
    const n=8,tones=['#a92e48','#d7505a','#861f3f','#ca3848','#e97572','#ac243e'];
    const levels=[[-.092,.050,.039,.10],[-.053,.102,.072,.43],[.018,.124,.093,.05],[.072,.087,.065,.50],[.089,.047,.039,.12]];
    const rings=levels.map(([y,x,z,twist])=>Array.from({length:n},(_,i)=>{
      const a=(i+twist)/n*tau;return [Math.sin(a)*x,y,Math.cos(a)*z];
    }));
    for(let i=0;i<n;i++) {
      const j=(i+1)%n;
      for(let r=0;r<rings.length-1;r++) {
        const a=rings[r],b=rings[r+1],tone=i*3+r*2;
        p.surface(tones[tone%6],[...a[i],...a[j],...b[i]],[0,1,2]);
        p.surface(tones[(tone+1+i%2)%6],[...a[j],...b[j],...b[i]],[0,1,2]);
      }
      p.surface('#d36369',[0,.089,0,...rings[4][i],...rings[4][j]],[0,1,2]);
      p.surface('#8f2d42',[0,-.092,0,...rings[0][j],...rings[0][i]],[0,1,2]);
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
  part.loft(look.skin,[[.843,.109,.095,0,.022],[.878,.107,.10,0,.025],
    [.926,.098,.102,0,.040],[.959,.093,.108,0,.056],[.981,.102,.108,0,.061]]);
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
        part.stroke('#b3a38b',shirtPath([[s*.106,.724],[s*.114,.686],[s*.146,.679],[s*.161,.718]],.009),.004,.7,8);
        part.stroke('#aeb1a3',shirtPath([[s*.101,.729],[s*.129,.727],[s*.157,.731]],.010),.006,.78,6);
        part.dot('#cba879',s*.13,.713,shirtZ(s*.13,.713)+.013,.005,.005,.004);
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
  } else if(outfit==='checked') {
    const check=mix(top,'#a59182',.45);
    for(let i=0;i<10;i++) {
      const y=.477+i*.038;
      const row=shirtLevels.findIndex(level=>level[0]>=y);
      const a=shirtLevels[row-1],b=shirtLevels[row],t=(y-a[0])/(b[0]-a[0]);
      const rx=a[1]+(b[1]-a[1])*t+.002,rz=a[2]+(b[2]-a[2])*t+.002;
      part.loft(check,[[y,rx,rz],[y+.003,rx,rz]],24);
    }
    for(let i=0;i<16;i++) {
      const a=i/16*tau;
      const path=shirtLevels.slice(2,-1).map(([y,rx,rz])=>[Math.sin(a)*(rx+.002),y,Math.cos(a)*(rz+.002)]);
      part.stroke(check,path,.0024,.74,9,4);
    }
  }
  if(outfit==='buttonDown') {
    part.loft(top,[[.846,.109,.088],[.871,.113,.094],[.893,.099,.086],[.899,.092,.082]],26);
    part.stroke(deep,shirtPath([[0,.854],[0,.738],[0,.587]],.007),.0045,.88);
    for(const y of [.839,.779,.714,.649,.585]) part.dot('#8d97a2',0,y,shirtZ(0,y)+.012,.006,.006,.004);
  } else if (['polo','blouse','checked','openCollar','silk','drapedCollar'].includes(outfit)) {
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
      for(const y of (outfit==='checked'?[.792,.725,.659,.592,.526]:[.78,.721])) {
        part.dot(deep,0,y,shirtZ(0,y)+.010,.006,.006,.004);
      }
    }
    if(outfit==='drapedCollar') {
      part.dot('#727c7c',.012,.776,shirtZ(.012,.776)+.014,.013,.013,.006);
    }
    if(outfit==='polo') {
      part.stroke(edge,shirtPath([[.074,.730],[.096,.685],[.127,.685],[.149,.728]],.005),.004,.66,7);
      part.block('#54686a',.112,.716,shirtZ(.112,.716)+.006,.036,.018,.008,[0,.39,0]);
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
      part.block('#cbcbbf',0,.729,shirtZ(0,.729)+.014,.024,.038,.009,[0,0,.08]);
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
  const {mix}=studio;
  const jacket=['denimHood','bomber','coat','fieldJacket','buttonDown','checked','stripes','silk','blouse','suit','drapedCollar','henley','openCollar'].includes(look.outfit);
  const handX=side*.073;
  if(jacket) {
    part.oval(look.skin,side*.070,-.241,.075,.041,.041,.041,[-.30,0,0]);
    part.loft(look.top,[[-.231,.044,.046,side*.072,.06],[-.215,.055,.052,side*.073,.055],
      [-.118,.060,.067,side*.057,.017],[-.003,.079,.088,side*.014,.001],[.034,.064,.064],
      [.051,.041,.040],[.058,.009,.010]],18);
    part.oval(mix(look.top,'#4c4a45',.17),side*.07,-.217,.059,.052,.025,.051,[-.26,0,0]);
    if(look.outfit==='suit') {
      part.oval('#e7e5d9',side*.070,-.231,.064,.048,.017,.048,[-.28,0,0]);
    }
  } else {
    part.oval(look.skin,side*.061,-.183,.043,.049,.105,.049,[-.37,0,side*.05]);
    part.loft(look.top,[[-.131,.063,.068,side*.060,.011],[-.115,.07,.069,side*.057,.009],
      [-.051,.080,.077,side*.037,.004],[.009,.078,.081,side*.009,0],[.043,.047,.049],[.054,.013,.013]],18);
    part.oval(mix(look.top,'#52483f',.16),side*.058,-.121,.012,.067,.016,.068);
  }
  part.oval(look.skin,handX,-.260,.089,.057,.065,.058,[-.32,0,side*.05]);
  part.dot(look.skin,handX-side*.037,-.255,.125,.029,.035,.027,[-.12,0,side*.27]);

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

const keepsakePoses={
  house:[0,.657,.241,1.43,.115],helicopter:[-.015,.672,.246,1.36,.11],lens:[-.061,.695,.235,1.46,.066],
  camera:[0,.680,.254,1.40,.107],fish:[0,.665,.246,1.49,.115],mallet:[.104,.700,.226,1.60,.060],
  monitor:[0,.660,.248,1.38,.117],clipboard:[0,.673,.232,1.40,.088],flowers:[0,.684,.255,1.43,.075],
  flag:[.060,.688,.254,1.50,.063],toolbox:[0,.657,.248,1.44,.115],ruby:[0,.67,.247,1.41,.106],
  calendar:[0,.664,.239,1.44,.104],rabbit:[0,.652,.248,1.51,.084],carabiner:[.015,.688,.245,1.55,.08],
  phone:[.065,.699,.233,1.48,.058],board:[0,.678,.244,1.52,.115],bear:[0,.664,.255,1.50,.082],
  directory:[0,.663,.243,1.57,.101],blockchainBook:[0,.676,.244,1.54,.112],airplane:[0,.685,.261,1.46,.113]
};

function clearKeepsake(T,kind,library) {
  if(kind!=='fish'&&kind!=='lens') return null;
  const key='clear/'+kind;
  if(!library.has(key)) {
    const profile=[.003,-.094,.051,-.094,.071,-.083,.091,-.056,.105,-.025,.108,.002,
      .105,.028,.098,.050,.083,.073,.078,.083,.078,.086];
    let geometry;
    if(kind==='fish') {
      const points=[];
      for(let j=0;j<profile.length;j+=2) points.push(new T.Vector2(profile[j],profile[j+1]));
      geometry=new T.LatheGeometry(points,32);
      geometry.normalizeNormals();
    } else {
      geometry=new T.SphereGeometry(1,22,12);
      geometry.scale(.078,.079,.010);
      geometry.translate(.033,.046,0);
    }
    const material=new T.MeshStandardMaterial({color:kind==='fish'?'#b2d9d6':'#6cbebd',
      roughness:.19,metalness:.05,transparent:true,opacity:kind==='fish'?.21:.38,depthWrite:false,
      side:T.DoubleSide,forceSinglePass:true});
    library.set(key,{geometry,material});
  }
  const {geometry,material}=library.get(key);
  const mesh=new T.Mesh(geometry,material);
  const [x,y,z,size]=keepsakePoses[kind];
  mesh.name=kind==='fish'?'Glass fishbowl':'Magnifying lens';
  mesh.position.set(x,y,z);
  mesh.scale.setScalar(size);
  mesh.rotation.set(-.055,-.08,-.035);
  return mesh;
}

function dressedBody(studio,look) {
  const part=new studio.Part();
  makeBody(part,look,studio.mix);
  const bare=part.finish();
  if(!look.prop) return {body:bare,bare};
  const [x,y,z,size]=keepsakePoses[look.prop];
  const item=new studio.Part();makeProp(item,look.prop);
  const geo=item.finish();
  const angle=look.prop==='airplane'?[-.56,.13,-.16]:[-.055,-.08,-.035];
  part.piece(geo,null,x,y,z,[size,size,size],angle);
  geo.dispose();
  return {body:part.finish(),bare};
}

function figureHead(studio,look,expression) {
  const {Part,mix}=studio;
  const head=new Part(),eyes=new Part(),happy=new Part(),sleep=new Part();
  sculptPortrait(head,eyes,happy,sleep,look,expression,studio);
  hairstyle(head,look,mix);
  hairRidges(head,look,mix);
  if(look.jewelry==='studs') for (const s of [-1,1]) head.dot('#eee2bb',s*.322,-.095,.048,.013,.013,.011);
  if(look.jewelry==='hoops') for (const s of [-1,1]) ring(head,'#d9ad6b',s*.315,-.094,.056,.018,.026,.005,s*.12);
  return {head:head.finish(),eyes:eyes.finish(),happy:happy.finish(),sleep:sleep.finish()};
}

function figureLimbs(studio,look) {
  const {Part,mix}=studio;
  return [-1,1].map(side=>{
    const arm=new Part(),thigh=new Part(),shin=new Part();
    makeArm(arm,side,look,studio);
    makeLeg(thigh,shin,side,look,mix);
    return {arm:arm.finish(),thigh:thigh.finish(),shin:shin.finish()};
  });
}

function buildPieces(studio,look,expression) {
  return {...dressedBody(studio,look),...figureHead(studio,look,expression),limbs:figureLimbs(studio,look)};
}

const guestHair={short:'swept',wavy:'parted',long:'layered',buzz:'shaved'};
const activities=new Set(['lounge','swim','read','work','stretch','photograph','climb','ride','jump',
  'surf','boat','boat-passenger','boulder','padel']);

// The origin is the lower hand. The long blade can reach the water from either bench.
function drawCanoePaddle(p) {
  p.loft('#bb895d',[[-.76,.020,.018],[-.57,.022,.021],[.23,.019,.020],[.304,.020,.021]],12);
  p.oval('#d9aa76',0,.315,0,.064,.025,.025);
  p.loft('#e9b979',[[-1.068,.010,.008],[-1.049,.060,.017],[-1.006,.091,.019],
    [-.911,.104,.024],[-.817,.083,.025],[-.718,.047,.024],[-.659,.019,.020]],16);
  p.loft('#537e75',[[-1.07,.009,.010],[-1.056,.047,.017],[-1.032,.078,.022],[-1.010,.094,.022]],16);
  p.stroke('#d09962',[[0,-1.036,.019],[0,-.925,.026],[0,-.810,.027],[0,-.683,.021]],.006,.4,11,6);
  for(const y of [-.047,.015]) p.loft('#977252',[[y,.022,.022],[y+.020,.022,.022]],10);
}
const swatch=(value,fallback)=>typeof value==='string'&&/^#[\da-f]{6}$/i.test(value)?value.toLowerCase():fallback;

function customPieces(studio,library,look,expression) {
  const h='custom/head/'+[look.skin,look.hair,look.style].join('/');
  const c='custom/clothes/'+[look.skin,look.top].join('/');
  if(!library.has(h)) library.set(h,figureHead(studio,look,expression));
  if(!library.has(c)) library.set(c,{...dressedBody(studio,look),limbs:figureLimbs(studio,look)});
  return {...library.get(h),...library.get(c)};
}

function greetingPalm(studio,skin) {
  const palm=new studio.Part();
  palm.oval(skin,0,.041,0,.047,.060,.029);
  palm.oval(skin,-.043,.047,.002,.022,.034,.020,[0,0,.58]);
  for(const [x,y] of [[-.025,.084],[.000,.092],[.025,.081]]) {
    palm.oval(skin,x,y,0,.018,.029,.019,[0,0,-x*4]);
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
  const body=recolor(pieces.body);
  return {
    ...pieces,
    body,bare:body,
    head:recolor(pieces.head),
    limbs:pieces.limbs.map(limb=>({...limb,arm:recolor(limb.arm)}))
  };
}

/** A reusable clay collectible. The origin is between the soles and forward is +Z. */
export function createFigure(T,handle='visitor',{guestColor,appearance}={}) {
  const requested=String(handle).replace(/^@/,'').toLowerCase();
  const id=Object.hasOwn(looks,requested)?requested:'visitor';
  let look={...looks[id],id};
  const expression=expressions[id];
  const studio=clayStudio(T);
  if(!perStudio.has(studio)) perStudio.set(studio,new Map());
  const library=perStudio.get(studio);
  let pieces;
  if(id==='visitor' && appearance && typeof appearance==='object') {
    look={...look,skin:swatch(appearance.skin,look.skin),hair:swatch(appearance.hair,look.hair),
      top:swatch(appearance.shirt,swatch(guestColor,look.top)),
      style:Object.hasOwn(guestHair,appearance.hairStyle)?guestHair[appearance.hairStyle]:'swept'};
    pieces=customPieces(studio,library,look,expression);
  } else {
    if(!library.has(id)) library.set(id,buildPieces(studio,look,expression));
    pieces=library.get(id);
  }
  if(id==='visitor' && !appearance && typeof guestColor==='string' && /^#[\da-f]{6}$/i.test(guestColor)) {
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
  torso.scale.x=look.slim?1.024:1.075;
  const clearProp=clearKeepsake(T,look.prop,library);
  if(clearProp) torso.add(clearProp);
  const head=mesh(pieces.head,pose,0,1.198,0);
  head.name='Head';
  head.scale.set(expression[0]*1.135,expression[1]*1.080,1.12);
  const eyes=mesh(pieces.eyes,head,0,eyeHeight,0);
  eyes.material=studio.eyeClay;
  const limbs=pieces.limbs.map((piece,i)=>{
    const side=i*2-1;
    const arm=mesh(piece.arm,pose,side*(look.slim?.215:.226),.817,0);
    const thigh=mesh(piece.thigh,pose,side*.102,.50,0);
    const shin=mesh(piece.shin,thigh,0,-.205,0);
    return {arm,thigh,shin,side,armDirection:new T.Vector3(side*.073,-.26,.089).normalize()};
  });
  const hash=Array.from(id).reduce((sum,c)=>sum+c.charCodeAt(0)*.149,0);
  const aim=new T.Vector3(),rotation=new T.Quaternion();
  const wrist=new T.Vector3(),poseInverse=new T.Quaternion();
  const rightHand=new T.Group();
  rightHand.name='Right hand grip';
  pose.add(rightHand);
  const paddleHand=new T.Vector3(),paddleAxis=new T.Vector3(),up=new T.Vector3(0,1,0);
  const racketEuler=new T.Euler(0,0,0,'YXZ'),sole=new T.Vector3();
  const signature=keepsakePoses[look.prop];
  const contextProps=new Map();
  let palm=null,lastActivity='';
  function aimHand(limb,x,y,z,weight=1) {
    aim.set(x-limb.arm.position.x,y-limb.arm.position.y,z-limb.arm.position.z).normalize();
    rotation.setFromUnitVectors(limb.armDirection,aim);
    limb.arm.quaternion.slerp(rotation,weight);
  }
  // A grip is anchored to the vehicle or the bark while the body moves behind it.
  // Only the shoulder-to-palm distance changes. The hand retains its round width.
  function grip(limb,x,y,z,minLength=.80) {
    aim.set(x,y,z).sub(pose.position).applyQuaternion(poseInverse).sub(limb.arm.position);
    const arm=limb.arm;
    const lengthY=Math.sqrt(Math.max(0,aim.lengthSq()-.073**2-.089**2));
    arm.scale.y=T.MathUtils.clamp(lengthY/.260,minLength,1.62);
    wrist.set(limb.side*.073,-.260*arm.scale.y,.089).normalize();
    arm.quaternion.setFromUnitVectors(wrist,aim.normalize());
  }
  function changeActivity(activity) {
    if(activity===lastActivity) return;
    lastActivity=activity;
    torso.geometry=activity?pieces.bare:pieces.body;
    if(clearProp) clearProp.visible=!activity;
    for(const item of contextProps.values()) item.visible=false;
    const prop=activity==='read'?'reading':activity==='photograph'?'camera':activity==='boat'?'paddle':null;
    if(!prop) return;
    let item=contextProps.get(prop);
    if(!item) {
      const key='activity-prop/'+prop;
      if(!library.has(key)) {
        const drawing=new studio.Part();
        if(prop==='paddle') drawCanoePaddle(drawing); else makeProp(drawing,prop);
        library.set(key,drawing.finish());
      }
      item=mesh(library.get(key),prop==='paddle'?root:pose);item.name='Activity '+prop;contextProps.set(prop,item);
    }
    item.visible=true;
    if(prop==='paddle') return;
    const reading=prop==='reading';
    item.position.set(reading?0:.025,reading?.687:.982,reading?.255:.265);
    item.rotation.set(reading?.91:-.09,reading?Math.PI:0,reading?0:-.05);
    item.scale.setScalar(reading?1.42:1.22);
  }
  let walkWeight=0,seatWeight=0,previousTime,jumpStart=0;
  let travelPhase=hash%2<1?.85:Math.PI+.85;
  let paddlePhase=.23,forehandStart=-Infinity,padelPressed=false;
  function animate(time=0,walking=false,seated=false,wave=0,activity='',progress=0) {
    activity=activities.has(activity)?activity:'';
    if(activity==='jump'&&lastActivity!=='jump') jumpStart=time;
    if(activity==='padel'&&lastActivity!=='padel') {forehandStart=-Infinity;padelPressed=false;}
    changeActivity(activity);
    const bouldering=activity==='boulder',climbing=activity==='climb'||bouldering;
    const riding=activity==='ride',jumping=activity==='jump',surfing=activity==='surf';
    const paddling=activity==='boat',boating=paddling||activity==='boat-passenger',padel=activity==='padel';
    const topOut=bouldering?T.MathUtils.clamp(Number(progress)||0,0,1):0;
    const mantle=topOut?T.MathUtils.smoothstep(topOut,.47,.74):0;
    const stand=topOut?T.MathUtils.smoothstep(topOut,.80,.995):0;
    const crouch=mantle*(1-stand);
    const traveling=climbing||riding;
    const sitting=boating||(seated&&!traveling&&!jumping&&!surfing&&!padel)||activity==='read'||activity==='work'||activity==='lounge';
    const delta=previousTime===undefined?1:Math.max(0,Math.min(.16,time-previousTime));
    previousTime=time;
    const ease=1-Math.exp(-delta*15);
    const movement=T.MathUtils.clamp(Number(walking)||0,-1,1);
    const targetWalk=traveling||paddling||surfing?Math.abs(movement):sitting?0:Math.max(0,movement);
    walkWeight+=(targetWalk-walkWeight)*ease;
    seatWeight+=(Number(Boolean(sitting))-seatWeight)*ease;
    if(traveling&&movement) {
      travelPhase=(travelPhase+delta*(bouldering?3.8:climbing?4.5:7.3)*walkWeight*Math.sign(movement))%tau;
    }
    if(paddling&&movement) paddlePhase=(paddlePhase+delta*3.65*walkWeight*Math.sign(movement))%tau;
    if(padel&&movement>.10&&(!padelPressed||time-forehandStart>.75)&&time-forehandStart>.38) forehandStart=time;
    if(padel) padelPressed=movement>.10;
    const shot=padel?Math.min(1,(time-forehandStart)/.55):1;
    const windup=padel?Math.sin(Math.PI*Math.min(1,shot/.38)):0;
    const contact=padel?Math.sin(Math.PI*T.MathUtils.clamp((shot-.19)/.56,0,1)):0;
    const follow=padel?T.MathUtils.smoothstep(shot,.28,.64)*(1-T.MathUtils.smoothstep(shot,.68,1)):0;
    const greeting=Math.max(0,Math.min(1,Number(wave)||0));
    const shake=Math.sin(time*14+hash);
    const reach=Math.cos(time*6.4+hash);
    const step=Math.sin(time*8.8+hash),breath=Math.sin(time*2+hash);
    const stridePhase=traveling?Math.sin(travelPhase):0;
    const airborne=jumping?T.MathUtils.clamp((time-jumpStart)/.72,0,1):0;
    const tuck=jumping?Math.sin(airborne*Math.PI):0;
    const pushOff=jumping?Math.max(0,1-airborne/.18):0;
    const landing=jumping?Math.max(0,1-Math.abs(airborne-.88)/.12):0;
    const strokeFront=paddling?Math.sin(paddlePhase):0;
    const recovery=paddling?Math.max(0,Math.cos(paddlePhase))*walkWeight:0;
    pose.position.x=0;
    pose.position.y=.004*(1+breath)+Math.abs(step)*.032*walkWeight-.015*seatWeight;
    pose.position.z=0;
    pose.rotation.x=.045*walkWeight+.041*seatWeight;
    pose.rotation.y=0;
    pose.rotation.z=step*.024*walkWeight+.044*greeting;
    head.position.z=0;
    head.rotation.y=Math.sin(time*.69+hash)*(.041+.038*walkWeight);
    head.rotation.x=.013*breath+.096*seatWeight;
    head.rotation.z=expression[4]*1.32+.011*Math.sin(time*.82+hash)-(.095+.018*shake)*greeting;
    if(activity==='lounge') {
      pose.rotation.x=-.88+.016*breath;
      pose.position.y=.455-.5*Math.cos(pose.rotation.x);
      pose.position.z=-.5*Math.sin(pose.rotation.x);
      head.rotation.x=.46+.025*breath;
    } else if(activity==='swim') {
      pose.rotation.x=1.05+.045*Math.sin(time*2.2+hash);
      pose.position.y=-.346+.035*Math.sin(time*2.2+hash);
      pose.position.z=-.76;
      pose.rotation.z=.11*Math.sin(time*2.2+hash);
      head.rotation.x=-.75+.06*breath;head.rotation.y=.16*Math.sin(time*2.2+hash);
    } else if(activity==='read') {
      pose.rotation.x=-.12;pose.position.z=.064;pose.position.y=-.034;
      head.rotation.x=.28+.025*breath;
    } else if(activity==='work') {
      head.rotation.x=.20+.045*Math.sin(time*2.9+hash);
    } else if(activity==='stretch') {
      pose.rotation.z=-.12-.11*Math.sin(time*.9+hash);
      head.rotation.z-=.095;
    } else if(activity==='photograph') {
      head.rotation.x=.103+.045*Math.sin(time*1.4+hash);
      head.rotation.z-=.07;
    } else if(climbing) {
      pose.position.set(.024*stridePhase,.031+.012*walkWeight*Math.cos(2*travelPhase),.027);
      pose.rotation.set(-.058,.038*stridePhase,-.052*stridePhase);
      if(bouldering) {
        pose.position.x+=.040*stridePhase;
        pose.rotation.y+=.114*stridePhase;
        pose.rotation.z-=.038*stridePhase;
      }
      head.position.z=bouldering?-.101:-.086;
      head.rotation.x=-.29+.040*Math.cos(travelPhase);
      head.rotation.y=.12*stridePhase;
      if(mantle) {
        pose.position.x*=1-mantle;pose.position.z=.027*(1-mantle)+.016*crouch;
        const transfer=.064*Math.sin(Math.PI*T.MathUtils.clamp((topOut-.79)/.21,0,1));
        pose.position.y=T.MathUtils.lerp(pose.position.y,-.098*crouch+.016*stand+transfer,mantle);
        pose.rotation.set(T.MathUtils.lerp(pose.rotation.x,.52*crouch+.018*stand,mantle),
          pose.rotation.y*(1-mantle),pose.rotation.z*(1-mantle));
        head.position.z*=1-mantle;
        head.rotation.set(T.MathUtils.lerp(head.rotation.x,.11*crouch-.055*stand,mantle),
          head.rotation.y*(1-mantle)+.065*stand*breath,head.rotation.z);
      }
    } else if(riding) {
      // Keep the hips over a 0.64-high saddle through the forward lean.
      const lean=.070+.050*walkWeight;
      pose.position.set(0,.640-.407*Math.cos(lean)+.004*walkWeight*Math.cos(2*travelPhase),-.407*Math.sin(lean));
      pose.rotation.set(lean,0,.017*stridePhase*walkWeight);
      head.rotation.x=-lean*.72+.013*breath;
      head.rotation.z-=pose.rotation.z*.65;
    } else if(jumping) {
      // The world owns the height of the jump. The rig anticipates, tucks, then braces.
      pose.position.y=.004-.017*pushOff-.042*landing;
      pose.rotation.set(-.088*tuck+.070*pushOff+.095*landing,0,.052*tuck);
      head.rotation.x=-.17*tuck+.045*pushOff+.087*landing;
      head.rotation.z-=.058*tuck;
    } else if(surfing) {
      const bank=Math.sin(time*1.85+hash);
      pose.rotation.set(.085+.030*walkWeight,1.24+.09*bank,-.024*bank);
      head.rotation.y=-.79+.062*bank;
      head.rotation.x=-.06+.018*breath;
      head.rotation.z-=.063*bank;
    } else if(boating) {
      const lean=paddling?.085+.088*strokeFront:.005+.019*breath;
      pose.rotation.set(lean,paddling?.20+.16*strokeFront:-.09,paddling?-.046-.020*recovery:.010*breath);
      pose.position.set(paddling?.043:0,.410-.407*Math.cos(lean),-.407*Math.sin(lean));
      head.rotation.y=paddling?-.15+.075*strokeFront:.20+.16*Math.sin(time*.68+hash);
      head.rotation.x=-.72*lean;
      if(paddling) {
        paddleHand.set(.350+.024*recovery,.549+.035*recovery,.18+.150*strokeFront);
        paddleAxis.set(-.48,.86-.36*recovery,-.055-.30*strokeFront-.84*recovery).normalize();
        const paddle=contextProps.get('paddle');
        paddle.position.copy(paddleHand);paddle.quaternion.setFromUnitVectors(up,paddleAxis);
      }
    } else if(padel) {
      pose.position.set(-.016-.018*windup+.048*follow,-.052-.014*windup,.014);
      pose.rotation.set(.090+.060*contact,.10-.43*windup+.50*follow,-.025+.054*follow);
      head.rotation.y=-pose.rotation.y*.63;head.rotation.x=-.065+.027*contact;
    }
    if(traveling||paddling||padel) poseInverse.copy(pose.quaternion).invert();
    const blink=(time+hash)%(4.2+(hash%1.5));
    const resting=activity==='lounge';
    const delighted=greeting>.71||(jumping&&airborne>.25&&airborne<.74);
    eyes.geometry=resting?pieces.sleep:delighted?pieces.happy:pieces.eyes;
    eyes.scale.y=(resting||delighted)?1:blink<.17?.11+.89*Math.min(1,Math.abs(blink-.085)/.065):1;
    let soleHeights=0;
    for(const limb of limbs) {
      const {arm,thigh,shin,side}=limb;
      const stride=step*side;
      thigh.rotation.x=-stride*.48*walkWeight-1.30*seatWeight;
      thigh.rotation.z=0;
      shin.rotation.x=Math.max(0,stride)*.42*walkWeight+1.30*seatWeight;
      shin.rotation.z=0;
      shin.scale.y=1;
      arm.rotation.x=stride*.39*walkWeight-.043+.021*breath-.94*seatWeight;
      arm.rotation.y=0;
      arm.rotation.z=side*(.06+.037*walkWeight+.061*seatWeight);
      arm.scale.y=1;
      if(seatWeight>.02) arm.rotation.x+=Math.sin(time*4.4+side)*.033*seatWeight;
      if(!activity && signature) {
        const [x,y,z,,spread]=signature;
        arm.scale.y=1.14;
        aimHand(limb,x+side*(spread+.004),y-.036,z+.043,.97-walkWeight*.18);
      } else if(activity==='read') {
        aimHand(limb,side*.111,.657,.247);
      } else if(activity==='work') {
        arm.scale.y=1.24;
        aimHand(limb,side*.145,.744+.014*Math.sin(time*7.2+side),.33);
      } else if(activity==='photograph') {
        aimHand(limb,.018+side*.106,.951+.014*Math.sin(time*1.4+hash),.228);
      } else if(activity==='lounge') {
        thigh.rotation.x=-.57;shin.rotation.x=.12;
        aimHand(limb,side*.20,.593,.119);
      } else if(activity==='stretch') {
        thigh.rotation.z=side*.14;
        arm.scale.y=1.25;
        aimHand(limb,side*.20-.145,1.12,.04);
      } else if(activity==='swim') {
        const stroke=Math.sin(time*2.2+hash+side*1.07),kick=Math.sin(time*5.3+hash)*side;
        thigh.rotation.x=kick*.25;shin.rotation.x=.15+Math.max(0,-kick)*.38;
        const recovery=Math.max(0,Math.cos(time*2.2+hash+side*1.07));
        aimHand(limb,side*(.33+.18*(1+stroke)/2),.89+.24*stroke,.065-.23*recovery);
      } else if(climbing) {
        const high=side*stridePhase;
        const release=Math.max(0,side*Math.cos(travelPhase))*walkWeight;
        // Opposite knee and hand rise together. The lifted hand clears the bark to regrip.
        if(bouldering) {
          const rimY=T.MathUtils.clamp(.975-(topOut-.55)*2.76,.19,.98);
          const limit=rimY+.21*(1-T.MathUtils.smoothstep(topOut,.445,.537));
          const handY=T.MathUtils.lerp(Math.min(.946+.153*high,limit),rimY,mantle);
          const lipDepth=T.MathUtils.lerp(.283-.067*release,.50,mantle);
          grip(limb,side*T.MathUtils.lerp(.224+.054*release,.288,mantle),
            T.MathUtils.lerp(handY,.561+.008*breath,stand),
            T.MathUtils.lerp(lipDepth,.092,stand),.80-.38*mantle);
        } else grip(limb,side*(.140+.032*release),.938+.120*high,.303-.043*release);
        thigh.rotation.x=(bouldering?-1.05:-.96)+.39*high;
        thigh.rotation.z=side*((bouldering?.45:.22)+.035*release);
        shin.rotation.x=(bouldering?1.02:.86)-.40*high;
        shin.rotation.z=-side*.12;
        if(mantle) {
          thigh.rotation.x=T.MathUtils.lerp(thigh.rotation.x,-(1.02+.26*side)*crouch-.104*stand,mantle);
          thigh.rotation.z=T.MathUtils.lerp(thigh.rotation.z,side*(.28*crouch+.075*stand),mantle);
          shin.rotation.x=T.MathUtils.lerp(shin.rotation.x,(1.78+.13*side)*crouch+.17*stand,mantle);
          shin.rotation.z*=1-.63*mantle;
          if(side>0) {
            const lead=T.MathUtils.smoothstep(topOut,.585,.767)*(1-T.MathUtils.smoothstep(topOut,.835,.98));
            thigh.rotation.x-=.84*lead;shin.rotation.x+=1.10*lead;
          }
        }
      } else if(riding) {
        grip(limb,side*.29,.925,.400);
        thigh.rotation.x=-1.00+.018*stridePhase*side*walkWeight;
        thigh.rotation.z=side*.18;
        shin.rotation.x=.83-.027*stridePhase*side*walkWeight;
        shin.rotation.z=-side*.13;
        shin.scale.y=1.23;
      } else if(jumping) {
        thigh.rotation.x=-(side>0?1.18:.36)*tuck-.33*pushOff-.59*landing;
        thigh.rotation.z=side*(.07+.19*tuck);
        shin.rotation.x=(side>0?1.66:1.29)*tuck+.56*pushOff+.85*landing;
        arm.rotation.x=-.17-(.45+.13*side)*tuck+.31*pushOff+.20*landing;
        arm.rotation.z=side*(.26+(1.50+.27*side)*tuck+.24*landing);
      } else if(surfing) {
        const bend=.57+.16*walkWeight+.048*breath;
        thigh.rotation.x=-bend+.044*side;
        thigh.rotation.z=side*.42;
        shin.rotation.x=1.55*bend-.058*side;
        shin.rotation.z=-side*.02;
        arm.scale.y=1.26;
        aimHand(limb,side*.63,.843-side*(.083+.040*breath),.078+.048*side);
        sole.set(0,-.2935,.035).applyQuaternion(shin.quaternion).add(shin.position)
          .applyQuaternion(thigh.quaternion).add(thigh.position).applyQuaternion(pose.quaternion);
        limb.deckHeight=sole.y;soleHeights+=sole.y;
      } else if(boating) {
        thigh.rotation.x=-1.27;thigh.rotation.z=side*.20;
        shin.rotation.x=1.02;shin.rotation.z=-side*.095;
        if(paddling) {
          const along=side<0?.32:0;
          grip(limb,paddleHand.x+paddleAxis.x*along,paddleHand.y+paddleAxis.y*along,paddleHand.z+paddleAxis.z*along);
        } else aimHand(limb,side*.17,.586,.197);
      } else if(padel) {
        thigh.rotation.x=-.46+side*(.091+.14*follow);
        thigh.rotation.z=side*(.31+.035*windup);
        shin.rotation.x=.81-side*(.10+.14*follow);
        shin.rotation.z=-side*.047;
        if(side<0) grip(limb,-.319-.079*windup+.322*follow,
          .682+.047*windup+.192*follow,.155-.166*windup+.227*contact+.105*follow);
        else aimHand(limb,.303+.048*windup+.054*follow,.714+.075*contact,.206-.136*follow);
      }
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
      if(side<0) {
        rightHand.position.set(-.073,-.260,.089).multiply(arm.scale).applyQuaternion(arm.quaternion).add(arm.position);
        if(padel) {
          racketEuler.set(.30+.38*contact-.33*windup,-.14-.68*windup+.82*follow,.92+.67*windup-1.57*follow);
          rightHand.quaternion.setFromEuler(racketEuler).premultiply(poseInverse);
        } else rightHand.quaternion.copy(arm.quaternion);
      }
    }
    if(surfing) {
      const average=soleHeights/2;
      pose.position.y=-average-.004;
      // A small extension at either ankle keeps both soles planted through the bank.
      for(const limb of limbs) {
        sole.set(0,-.2935,0).applyQuaternion(limb.shin.quaternion)
          .applyQuaternion(limb.thigh.quaternion).applyQuaternion(pose.quaternion);
        limb.shin.scale.y+=(average-limb.deckHeight)/sole.y;
      }
    }
    if(palm) palm.visible=greeting>.025;
  }
  animate(0);
  return {root,animate,rightHand};
}
