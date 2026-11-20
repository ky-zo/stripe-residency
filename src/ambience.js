let context, master;
let audible=false;
function buildOcean() {
  context=new (window.AudioContext || window.webkitAudioContext)();
  master=context.createGain();
  master.gain.value=0;
  master.connect(context.destination);
  const seconds=8;
  const buffer=context.createBuffer(2,context.sampleRate*seconds,context.sampleRate);
  for(let c=0;c<2;c++) {
    const data=buffer.getChannelData(c);
    let previous=0;
    for(let i=0;i<data.length;i++){
      previous=(previous+(Math.random()*2-1)*.075)/1.026;
      data[i]=previous*2;
    }
    const fade=Math.floor(context.sampleRate*.1);
    for(let i=0;i<fade;i++) {
      const mix=i/fade;
      data[i]=data[data.length-fade+i]*(1-mix)+data[i]*mix;
    }
  }
  const noise=context.createBufferSource(),filter=context.createBiquadFilter(),swell=context.createGain();
  noise.buffer=buffer;noise.loop=true;filter.type='lowpass';filter.frequency.value=1050;
  swell.gain.value=.7;
  const tide=context.createOscillator(),depth=context.createGain();
  tide.frequency.value=.093;depth.gain.value=.29;
  tide.connect(depth).connect(swell.gain);
  noise.connect(filter).connect(swell).connect(master);
  tide.start();noise.start();
}
export async function toggleSound() {
  if(!context)buildOcean();
  if(context.state==='suspended')await context.resume();
  audible=!audible;
  master.gain.setTargetAtTime(audible?.42:0,context.currentTime,.32);
  return audible;
}
