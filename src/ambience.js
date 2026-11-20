// Island sound, synthesized in the browser so nothing has to download: surf on the shore,
// a gamelan drifting from the warung, wind in the palms, birds and a gecko, passing showers
// and the splashes people make. The world reports where the listener is and what the sky is doing.
let ctx=null,master=null,audible=false,timer=null;
let white,pink,brown,hall;
const bus={};
const scene={shore:.5,music:.5,rain:0,wind:.35};

function buffer(seconds,fill){
  const data=ctx.createBuffer(2,Math.floor(ctx.sampleRate*seconds),ctx.sampleRate);
  for(let c=0;c<2;c++){
    const out=data.getChannelData(c);fill(out);
    // Crossfade the ends so the loop has no seam.
    const fade=Math.floor(ctx.sampleRate*.08);
    for(let i=0;i<fade;i++)out[i]=out[out.length-fade+i]*(1-i/fade)+out[i]*(i/fade);
  }
  return data;
}
function loop(source,...chain){
  const node=ctx.createBufferSource();node.buffer=source;node.loop=true;
  let last=node;for(const next of chain)last=last.connect(next);
  node.start(0,Math.random()*source.duration);
  return node;
}
function gain(value=0){const g=ctx.createGain();g.gain.value=value;return g;}
function filter(type,frequency,q=.7){const f=ctx.createBiquadFilter();f.type=type;f.frequency.value=frequency;f.Q.value=q;return f;}
function pan(value){const p=ctx.createStereoPanner();p.pan.value=value;return p;}
const ease=(param,value,time=.8)=>param.setTargetAtTime(value,ctx.currentTime,time);

function build(){
  ctx=new (window.AudioContext||window.webkitAudioContext)();
  const limiter=ctx.createDynamicsCompressor();
  limiter.threshold.value=-14;limiter.ratio.value=4;limiter.attack.value=.01;limiter.release.value=.3;
  master=gain(0);master.connect(limiter).connect(ctx.destination);

  white=buffer(2,out=>{for(let i=0;i<out.length;i++)out[i]=Math.random()*2-1;});
  pink=buffer(6,out=>{
    let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
    for(let i=0;i<out.length;i++){
      const w=Math.random()*2-1;
      b0=.99886*b0+w*.0555179;b1=.99332*b1+w*.0750759;b2=.969*b2+w*.153852;
      b3=.8665*b3+w*.3104856;b4=.55*b4+w*.5329522;b5=-.7616*b5-w*.016898;
      out[i]=(b0+b1+b2+b3+b4+b5+b6+w*.5362)*.11;b6=w*.115926;
    }
  });
  brown=buffer(8,out=>{let p=0;for(let i=0;i<out.length;i++){p=(p+(Math.random()*2-1)*.075)/1.026;out[i]=p*2;}});

  // A soft open-air reverb for the instruments, birds and splashes.
  hall=ctx.createConvolver();
  hall.buffer=buffer(2.8,out=>{for(let i=0;i<out.length;i++)out[i]=(Math.random()*2-1)*(1-i/out.length)**3.2;});
  const wet=gain(.32);hall.connect(wet).connect(master);

  for(const name of ['surf','wind','rain','music','life','fx'])bus[name]=gain(0);
  for(const name of ['surf','wind','rain'])bus[name].connect(master);
  for(const [name,send] of [['music',.55],['life',.6],['fx',.18]]){
    bus[name].connect(master);const s=gain(send);bus[name].connect(s).connect(hall);
  }

  // Surf: a low roll that rises and falls with the tide, and a brighter wash over the sand.
  const swell=gain(.7),tide=ctx.createOscillator(),depth=gain(.29);
  tide.frequency.value=.093;tide.connect(depth).connect(swell.gain);tide.start();
  loop(brown,filter('lowpass',1050),swell,bus.surf);
  const wash=gain(.16),wave=ctx.createOscillator(),reach=gain(.12);
  wave.frequency.value=.061;wave.connect(reach).connect(wash.gain);wave.start();
  loop(pink,filter('bandpass',1500,.5),wash,bus.surf);

  // Wind through the palms. Gusts are scheduled in the clock below.
  bus.gust=gain(0);bus.rustle=gain(0);
  loop(pink,filter('bandpass',480,.55),bus.gust,bus.wind);
  loop(white,filter('highpass',3200),filter('lowpass',8000),bus.rustle,bus.wind);

  // Rain on leaves and sand.
  loop(white,filter('highpass',1100),filter('lowpass',7000),gain(.5),bus.rain);
  loop(pink,filter('lowpass',600),gain(.6),bus.rain);
  apply();
}

// ---- Gamelan --------------------------------------------------------------
// Selisir, a five-tone pelog mode. Each instrument is a pair tuned a few hertz apart,
// so every note shimmers (ombak) the way a Balinese ensemble does.
const CENTS=[0,120,270,670,780],BASE=293.7;
const pitch=(step,octave=0)=>BASE*2**(Math.floor(step/5)+octave+CENTS[((step%5)+5)%5]/1200);
const PARTIALS=[[1,1,1],[2.76,.22,.45],[5.4,.07,.2]];
function bar(t,frequency,level,side,decay,beat=6.4){
  const out=ctx.createGain();
  out.gain.setValueAtTime(0,t);out.gain.linearRampToValueAtTime(level,t+.004);
  out.gain.exponentialRampToValueAtTime(.0001,t+decay);
  out.connect(pan(side)).connect(bus.music);
  for(const [ratio,amount,length] of PARTIALS)for(const shift of [0,beat]){
    const o=ctx.createOscillator(),g=ctx.createGain();
    o.frequency.value=(frequency+shift)*ratio;
    g.gain.setValueAtTime(amount*.5,t);g.gain.exponentialRampToValueAtTime(.0001,t+decay*length);
    o.connect(g).connect(out);o.start(t);o.stop(t+decay+.05);
  }
}
function gong(t,frequency,level,decay){
  const out=ctx.createGain();
  out.gain.setValueAtTime(0,t);out.gain.linearRampToValueAtTime(level,t+.03);
  out.gain.exponentialRampToValueAtTime(.0001,t+decay);
  out.connect(bus.music);
  for(const [ratio,amount] of [[1,1],[2.02,.32],[2.94,.12],[4.1,.05]])for(const shift of [0,.9]){
    const o=ctx.createOscillator();o.frequency.value=(frequency+shift)*ratio;
    const g=gain(amount*.5);o.connect(g).connect(out);o.start(t);o.stop(t+decay+.05);
  }
}
function tick(t,level){
  const o=ctx.createOscillator(),g=ctx.createGain();
  o.frequency.setValueAtTime(560,t);o.frequency.exponentialRampToValueAtTime(470,t+.08);
  g.gain.setValueAtTime(level,t);g.gain.exponentialRampToValueAtTime(.0001,t+.11);
  o.connect(g).connect(bus.music);o.start(t);o.stop(t+.13);
}
// Each line is a core melody: eight notes, two beats apiece, across one gong cycle.
const MELODIES=[[1,2,1,4,3,2,1,0],[1,2,1,4,3,2,1,0],[3,4,3,2,1,2,4,3],[0,1,2,1,4,3,2,0]];
const BEAT=60/64;
let music={beat:0,at:0,cycle:0,cyclesLeft:6,resting:false,soft:false};
function playBeat(t){
  const {beat,cycle}=music,melody=MELODIES[cycle%MELODIES.length];
  const index=Math.floor(beat/2),note=melody[index],next=melody[(index+1)%8];
  const human=()=>(Math.random()-.5)*.012,soft=music.soft?.55:1;
  if(beat===0)gong(t,55,.42,7.5);
  else if(beat===8)gong(t,110,.18,3.6);
  else if(beat===4||beat===12)gong(t,220,.07,2.2);
  tick(t+human(),.035);
  if(beat%2===0){
    bar(t+human(),pitch(note,-1),.11*soft,0,1.9);
    if(beat%4===0)bar(t,pitch(note,-2),.15,0,3.6,3.2);
  }
  // Gangsa kotekan: one player on the beat with the melody note, the other off it a step above.
  // In the last half beat both lean into the next note.
  for(let k=0;k<4;k++){
    const sixteenth=(beat%2)*4+k,ahead=sixteenth>=6,step=(ahead?next:note)+(k%2);
    if(music.soft&&k%2)continue;
    bar(t+k*BEAT/4+human(),pitch(step),(.055+.02*Math.random())*soft,k%2?.32:-.32,1.15,7);
  }
}
function scheduleMusic(until){
  while(music.at<until){
    if(music.resting){
      music={...music,resting:false,beat:0,cyclesLeft:5+Math.floor(Math.random()*4)};
      continue;
    }
    playBeat(music.at);
    music.at+=BEAT;music.beat=(music.beat+1)%16;
    if(music.beat===0){
      music.cycle++;music.cyclesLeft--;music.soft=Math.random()<.3;
      if(music.cyclesLeft<=0){
        // End on the gong, let it ring, then rest before the next piece.
        gong(music.at,55,.42,7.5);
        music.resting=true;music.at+=14+Math.random()*16;
      }
    }
  }
}

// ---- Island life ----------------------------------------------------------
function chirp(t){
  const kind=Math.floor(Math.random()*3),side=Math.random()*1.6-.8,level=.035+.03*Math.random();
  const notes=kind===0?3+Math.floor(Math.random()*4):kind===1?2:9;
  for(let i=0;i<notes;i++){
    const o=ctx.createOscillator(),g=ctx.createGain(),start=t+i*(kind===2?.055:kind===1?.22:.11);
    const high=kind===1?(i?1650:2350):2600+Math.random()*1400;
    o.frequency.setValueAtTime(kind===1?high:high*.8,start);
    o.frequency.exponentialRampToValueAtTime(kind===1?high*.82:high*1.18,start+(kind===1?.18:.06));
    g.gain.setValueAtTime(0,start);g.gain.linearRampToValueAtTime(level,start+.01);
    g.gain.exponentialRampToValueAtTime(.0001,start+(kind===1?.2:.07));
    o.connect(g).connect(pan(side)).connect(bus.life);o.start(start);o.stop(start+.25);
  }
}
// The tokay gecko: a throaty "to-keh", repeated a few times from somewhere in the trees.
function gecko(t){
  const side=Math.random()*1.4-.7,calls=3+Math.floor(Math.random()*4);
  for(let i=0;i<calls;i++){
    for(const [offset,high,low,length] of [[0,430,380,.07],[.12,340,250,.15]]){
      const start=t+i*.78+offset,o=ctx.createOscillator(),throat=filter('bandpass',900,3),g=ctx.createGain();
      o.type='sawtooth';o.frequency.setValueAtTime(high,start);o.frequency.exponentialRampToValueAtTime(low,start+length);
      g.gain.setValueAtTime(0,start);g.gain.linearRampToValueAtTime(.075*(1-i*.08),start+.015);
      g.gain.exponentialRampToValueAtTime(.0001,start+length+.04);
      o.connect(throat).connect(g).connect(pan(side)).connect(bus.life);o.start(start);o.stop(start+length+.06);
    }
  }
}
function burst(t,source,shape,level,attack,decay,side=0,target=bus.fx){
  const node=ctx.createBufferSource();node.buffer=source;
  const g=ctx.createGain();
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(level,t+attack);g.gain.exponentialRampToValueAtTime(.0001,t+attack+decay);
  let last=node;for(const f of shape)last=last.connect(f);
  last.connect(g).connect(pan(side)).connect(target);
  node.start(t,Math.random()*(source.duration-attack-decay-.1));node.stop(t+attack+decay+.05);
}
function breaker(t){
  const sweep=filter('lowpass',420,.6);
  sweep.frequency.setValueAtTime(420,t);sweep.frequency.exponentialRampToValueAtTime(2100,t+.9);sweep.frequency.exponentialRampToValueAtTime(700,t+3);
  burst(t,pink,[sweep],.22,.9,2.4,Math.random()*1.2-.6,bus.surf);
}
function thunder(t){
  const rumble=filter('lowpass',140,.5);
  burst(t,brown,[rumble],.55,.35,5.5,Math.random()*.8-.4,bus.rain);
}
function drip(t,level){
  const o=ctx.createOscillator(),g=ctx.createGain(),f=1800+Math.random()*2600;
  o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(f*1.4,t+.02);
  g.gain.setValueAtTime(level,t);g.gain.exponentialRampToValueAtTime(.0001,t+.03);
  o.connect(g).connect(pan(Math.random()*1.6-.8)).connect(bus.rain);o.start(t);o.stop(t+.04);
}
let next={bird:2,gecko:25,breaker:4,thunder:30,gust:0,drip:0},gustLevel=.4;
function scheduleLife(now){
  if(now>next.bird){if(scene.rain<.3)chirp(now+.05);next.bird=now+3+Math.random()*7;}
  if(now>next.gecko){if(scene.rain<.5)gecko(now+.1);next.gecko=now+40+Math.random()*60;}
  if(now>next.breaker){breaker(now+.05);next.breaker=now+5.5+Math.random()*6;}
  if(now>next.thunder){if(scene.rain>.72)thunder(now+.2);next.thunder=now+35+Math.random()*55;}
  if(now>next.drip){
    for(let n=Math.round(scene.rain*5);n>0;n--)drip(now+Math.random()*.1,.02+.03*Math.random());
    next.drip=now+.1;
  }
  if(now>next.gust){
    // Gusts wander toward a new strength every second or two.
    gustLevel+=(Math.random()-.5)*.5;gustLevel=Math.max(.15,Math.min(1,gustLevel));
    const strength=gustLevel*(.25+.75*scene.wind);
    ease(bus.gust.gain,.38*strength,.9);ease(bus.rustle.gain,.05*strength*strength,.7);
    next.gust=now+1+Math.random()*1.4;
  }
}
function clock(){
  if(!ctx||ctx.state!=='running')return;
  const now=ctx.currentTime;
  if(music.at<now)music.at=now+.1;
  scheduleMusic(now+.3);scheduleLife(now);
}

function apply(){
  if(!ctx)return;
  ease(bus.surf.gain,.30+.62*scene.shore);
  ease(bus.wind.gain,.55+.45*scene.wind,1.5);
  ease(bus.rain.gain,.55*scene.rain,1.6);
  ease(bus.music.gain,(.16+.54*scene.music)*(1-.45*scene.rain),1.2);
  ease(bus.life.gain,1-.7*scene.rain,2);
  ease(bus.fx.gain,1,.1);
}

// shore and music are 0..1 nearness to the water and to the warung; rain and wind come from the sky.
export function soundscape(update){
  let changed=false;
  for(const key of Object.keys(scene))if(Number.isFinite(update[key])&&Math.abs(update[key]-scene[key])>.02){scene[key]=update[key];changed=true;}
  if(changed&&audible)apply();
}

// A splash: strength runs from a wading step (about .2) to a dive (1); distance is in metres.
export function splash(strength=1,distance=0,side=0){
  if(!audible||ctx?.state!=='running')return;
  const level=strength*Math.max(0,1-distance/18)**2;
  if(level<.015)return;
  const t=ctx.currentTime+.01,sweep=filter('bandpass',2600,.8);
  sweep.frequency.setValueAtTime(2800,t);sweep.frequency.exponentialRampToValueAtTime(650,t+.32+.25*strength);
  burst(t,white,[sweep],.42*level,.006,.28+.42*strength,side);
  burst(t,pink,[filter('lowpass',700)],.35*level*strength,.01,.35+.3*strength,side);
  for(let i=Math.round(2+strength*6);i>0;i--){
    const start=t+.04+Math.random()*(.25+.4*strength),o=ctx.createOscillator(),g=ctx.createGain(),f=700+Math.random()*1500;
    o.frequency.setValueAtTime(f,start);o.frequency.exponentialRampToValueAtTime(f*1.7,start+.035);
    g.gain.setValueAtTime(.06*level,start);g.gain.exponentialRampToValueAtTime(.0001,start+.045);
    o.connect(g).connect(pan(side+(Math.random()-.5)*.4)).connect(bus.fx);o.start(start);o.stop(start+.06);
  }
}

export const soundOn=()=>audible;

// A hidden tab goes quiet; the island picks up again when it comes back.
document.addEventListener('visibilitychange',()=>{
  if(!ctx||!audible)return;
  if(document.hidden)ctx.suspend();else ctx.resume().then(()=>{music.at=Math.max(music.at,ctx.currentTime+.1);});
});

export async function toggleSound() {
  if(!ctx)build();
  audible=!audible;
  if(audible){
    if(ctx.state==='suspended')await ctx.resume();
    apply();ease(master.gain,.9,.35);
    clearInterval(timer);timer=setInterval(clock,90);clock();
  }else{
    ease(master.gain,0,.25);clearInterval(timer);timer=null;
    // Let the fade finish, then let the audio thread sleep.
    setTimeout(()=>{if(!audible&&ctx.state==='running')ctx.suspend();},900);
  }
  return audible;
}
