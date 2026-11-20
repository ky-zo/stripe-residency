// One sky for the whole island. Weather follows the room clock, so every visitor
// sees and hears the same passing shower at the same moment.
const CYCLE=16*60*1000;
const unit=n=>{const s=Math.sin(n*127.1+311.7)*43758.5453;return s-Math.floor(s);};
const ease=t=>{const u=Math.max(0,Math.min(1,t));return u*u*(3-2*u);};

// rain and wind run from 0 to 1. Two of every three cycles bring a tropical shower of a few minutes.
export function weatherAt(time){
  const cycle=Math.floor(time/CYCLE),t=time/CYCLE-cycle;
  let rain=0;
  if(unit(cycle)<.67){
    const start=.22+.38*unit(cycle+.31),length=.14+.08*unit(cycle+.57),x=(t-start)/length;
    if(x>0&&x<1)rain=(.55+.45*unit(cycle+.83))*ease(x/.2)*ease((1-x)/.24);
  }
  const breeze=.32+.16*Math.sin(time/97000)+.10*Math.sin(time/23000+1.7);
  return {rain,wind:Math.min(1,breeze+.55*rain)};
}
