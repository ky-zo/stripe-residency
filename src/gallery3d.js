import * as T from 'three';
import { createFigure } from './models.js';
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;

function contactShadow() {
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=96;
  const ctx=canvas.getContext('2d');
  const fade=ctx.createRadialGradient(48,48,4,48,48,48);
  fade.addColorStop(0,'rgba(78,88,66,0.24)');
  fade.addColorStop(.61,'rgba(78,88,66,0.18)');
  fade.addColorStop(1,'rgba(78,88,66,0)');
  ctx.fillStyle=fade;ctx.fillRect(0,0,96,96);
  const texture=new T.CanvasTexture(canvas);
  texture.colorSpace=T.SRGBColorSpace;
  return new T.Mesh(new T.PlaneGeometry(2.12,1.95),
    new T.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false}));
}

function portraitBackdrop(tone){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
  const ctx=canvas.getContext('2d');
  const light=new T.Color(tone).lerp(new T.Color('#fff0de'),.32);
  const edge=new T.Color(tone).lerp(new T.Color('#6a776c'),.10);
  const shade=ctx.createRadialGradient(48,39,3,58,49,103);
  shade.addColorStop(0,light.getStyle());shade.addColorStop(.77,tone);shade.addColorStop(1,edge.getStyle());
  ctx.fillStyle=shade;ctx.fillRect(0,0,128,128);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;return texture;
}

export function showModel(host,handle,appearance,backdrop) {
  const renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));
  renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=T.VSMShadowMap;
  const scene=new T.Scene();
  const tone=backdrop||appearance?.shirt||'#c7d3ba';
  scene.background=portraitBackdrop(tone);
  const camera=new T.PerspectiveCamera(31,1,.1,20);
  scene.add(new T.HemisphereLight('#fff8ee','#eddcd0',1.9));
  const key=new T.DirectionalLight('#fff2d9',2.1);
  key.position.set(-2.6,4.2,3.6);key.castShadow=true;key.shadow.mapSize.set(512,512);
  key.shadow.camera.left=-1.6;key.shadow.camera.right=1.6;key.shadow.camera.top=2;key.shadow.camera.bottom=-1.4;
  key.shadow.camera.near=.1;key.shadow.camera.far=13;key.shadow.normalBias=.010;
  key.shadow.radius=7;key.shadow.blurSamples=8;scene.add(key);
  const fill=new T.DirectionalLight('#f1f6ff',1.05);
  fill.position.set(3,1.9,3.8);scene.add(fill);
  const figure=createFigure(T,appearance?'visitor':handle,{appearance});
  scene.add(figure.root);
  const bounds=new T.Box3().setFromObject(figure.root),center=bounds.getCenter(new T.Vector3());
  const size=bounds.getSize(new T.Vector3());
  const plinthColor=new T.Color(tone).lerp(new T.Color('#f7eddb'),.49);
  const base=new T.Mesh(new T.CylinderGeometry(.56,.59,.073,64),new T.MeshStandardMaterial({color:plinthColor,roughness:.93}));
  base.position.y=bounds.min.y-.055;base.receiveShadow=true;scene.add(base);
  const floor=contactShadow();
  floor.rotation.x=-Math.PI/2;floor.position.set(.035,base.position.y-.055,.006);scene.add(floor);
  host.replaceChildren(renderer.domElement);
  function resize(){
    const w=host.clientWidth,h=host.clientHeight;
    if(!w||!h)return;
    renderer.setSize(w,h,false);camera.aspect=w/h;
    const fit=Math.max((size.y+.13)*1.25,Math.max(size.x*1.45,1.56)/camera.aspect);
    const distance=fit/(2*Math.tan(T.MathUtils.degToRad(camera.fov/2)));
    camera.position.set(0,center.y+.13*distance,distance);
    camera.lookAt(0,center.y-.065,0);camera.updateProjectionMatrix();
  }
  const resizeObserver=new ResizeObserver(resize);
  resizeObserver.observe(host);resize();
  let frame,drag=null,last=performance.now(),angle=-.2,pausedUntil=0;
  function render(now) {
    const dt=Math.min((now-last)/1000,.05);last=now;
    if(!reduced && drag===null && now>pausedUntil) angle+=dt*.23;
    figure.root.rotation.y=angle;
    figure.animate(reduced?0:now/1000,false,false);
    renderer.render(scene,camera);frame=requestAnimationFrame(render);
  }
  function down(e){drag=e.clientX;host.setPointerCapture(e.pointerId);host.focus({preventScroll:true});}
  function move(e){if(drag===null)return;angle+=(e.clientX-drag)*.013;drag=e.clientX;pausedUntil=performance.now()+5000;}
  function up(){drag=null;}
  function keyboard(e){if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();angle+=e.key==='ArrowLeft'?-.27:.27;pausedUntil=performance.now()+5000;}}
  host.addEventListener('pointerdown',down);host.addEventListener('pointermove',move);host.addEventListener('pointerup',up);host.addEventListener('pointercancel',up);host.addEventListener('keydown',keyboard);
  frame=requestAnimationFrame(render);
  return () => {
    cancelAnimationFrame(frame);resizeObserver.disconnect();
    host.removeEventListener('pointerdown',down);host.removeEventListener('pointermove',move);host.removeEventListener('pointerup',up);host.removeEventListener('pointercancel',up);host.removeEventListener('keydown',keyboard);
    base.geometry.dispose();base.material.dispose();floor.geometry.dispose();floor.material.map.dispose();floor.material.dispose();
    // Figure meshes share their geometry and materials with the island and other portraits.
    scene.background.dispose();key.shadow.dispose();renderer.dispose();renderer.forceContextLoss();host.replaceChildren();
  };
}

export async function downloadFigure(handle,appearance) {
  const {GLTFExporter}=await import('three/addons/exporters/GLTFExporter.js');
  const figure=createFigure(T,appearance?'visitor':handle,{appearance});
  figure.animate(0,false,false);
  const binary=await new GLTFExporter().parseAsync(figure.root,{binary:true,onlyVisible:true});
  const url=URL.createObjectURL(new Blob([binary],{type:'model/gltf-binary'}));
  const link=document.createElement('a');link.href=url;link.download='stripe-residency-'+handle.replace(':','-')+'.glb';link.click();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
}
