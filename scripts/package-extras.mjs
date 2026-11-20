import fs from 'node:fs/promises';
import * as T from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { zipSync } from 'three/addons/libs/fflate.module.js';
import { residents } from '../src/residents.js';
import { createFigure } from '../src/models.js';

class BlobReader {
  async readAsArrayBuffer(blob) {
    this.result=await blob.arrayBuffer();
    this.onloadend?.();
  }
}
globalThis.FileReader ??= BlobReader;
const entries={};
for(const r of residents){
  const figure=createFigure(T,r.handle);
  const bytes=await new GLTFExporter().parseAsync(figure.root,{binary:true,onlyVisible:true});
  entries['palm-hours-'+r.handle+'.glb']=new Uint8Array(bytes);
}
await fs.writeFile('build/island/palm-hours-figures.zip',zipSync(entries,{level:6}));
await fs.mkdir('dist/server',{recursive:true});
await fs.copyFile('server/sites.js','dist/server/index.js');
await fs.mkdir('dist/.openai',{recursive:true});
await fs.copyFile('.openai/hosting.json','dist/.openai/hosting.json');
console.log('Packaged all '+residents.length+' GLB figures and the private Site entry.');
