import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const bin=name=>fileURLToPath(new URL('../node_modules/.bin/'+name,import.meta.url));
if(!existsSync('build/island/index.html')){
  const build=spawnSync('npm',['run','build'],{stdio:'inherit'});
  if(build.status!==0)process.exit(build.status||1);
}
const api=spawn(bin('wrangler'),['dev','--local','--ip','127.0.0.1','--port','8797','--var','LOCAL_DEVELOPMENT:true','--show-interactive-dev-session=false'],{stdio:'inherit'});
const vite=spawn(bin('vite'),['--host','127.0.0.1',...process.argv.slice(2)],{stdio:'inherit'});
let stopping=false;
function end(code=0){
  if(stopping)return;
  stopping=true;api.kill('SIGTERM');vite.kill('SIGTERM');process.exitCode=code;
}
api.on('exit',code=>end(code||0));vite.on('exit',code=>end(code||0));
process.once('SIGINT',()=>end());process.once('SIGTERM',()=>end());
