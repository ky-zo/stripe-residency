import * as T from 'three';
import {createFigure} from './models.js';
import {appearanceKey} from '../shared/members.js';

let renderer, scene, camera, current;
const images=new Map();

export function memberPortrait(appearance){
  const version=appearanceKey(appearance);
  if(images.has(version))return images.get(version);
  if(!renderer){
    renderer=new T.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'low-power'});
    renderer.setSize(320,320,false);
    renderer.outputColorSpace=T.SRGBColorSpace;
    scene=new T.Scene();
    scene.add(new T.HemisphereLight('#fff6e6','#cdbcae',1.65));
    const key=new T.DirectionalLight('#fff1dc',2.35);key.position.set(-2.2,4,3.2);scene.add(key);
    const fill=new T.DirectionalLight('#e0ecff',.72);fill.position.set(2.8,2,-1);scene.add(fill);
    camera=new T.PerspectiveCamera(26,1,.1,12);
  }
  scene.background=new T.Color(appearance.shirt).lerp(new T.Color('#fff4dc'),.68);
  if(current)scene.remove(current);
  const figure=createFigure(T,'visitor',{appearance});
  current=figure.root;scene.add(current);current.rotation.y=-.15;
  figure.animate(2.55,false,false);
  const bounds=new T.Box3().setFromObject(current);
  const h=bounds.max.y-bounds.min.y;
  const center=h*.69, distance=h*.70/(2*Math.tan(T.MathUtils.degToRad(camera.fov/2)));
  camera.position.set(0,center+.10,distance);camera.lookAt(0,center,0);camera.updateProjectionMatrix();
  renderer.render(scene,camera);
  const src=renderer.domElement.toDataURL('image/webp',.85);
  if(images.size>=96)images.delete(images.keys().next().value);
  images.set(version,src);
  return src;
}
