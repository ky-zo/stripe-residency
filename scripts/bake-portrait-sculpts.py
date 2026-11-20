"""Bake the clay portraits into offline, vertex-painted facial sculpts.

Authoring dependencies: Python 3.11, mediapipe 0.10.21, numpy, opencv-python,
Pillow, and triangle. The browser consumes the compact baked geometry only.
"""
import base64
import json
import re
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
import triangle
from PIL import Image
from scipy.spatial import cKDTree

ROOT = Path(__file__).resolve().parents[1]
OUTLINE = [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109]
LEFT_EYE = [33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246]
RIGHT_EYE = [362,382,381,380,374,373,390,249,263,466,388,387,386,385,384,398]
MOUTH = [78,95,88,178,87,14,317,402,318,324,308,415,310,311,312,13,82,81,80,191]
LEFT_BROW = [70,63,105,66,107,55,65,52,53,46]
RIGHT_BROW = [336,296,334,293,300,276,283,282,295,285]
SCALE = 32000


def packed(array, dtype):
    return base64.b64encode(np.asarray(array, dtype=dtype).tobytes()).decode('ascii')


def unit(v):
    return v / np.linalg.norm(v)


def sculpt(landmarks, width, height):
    p = landmarks * [width, -height, -width]
    right = unit(unit(p[263]-p[33])+unit(p[454]-p[234]))
    up = unit(p[10]-p[152]); up = unit(up-right*np.dot(up,right))
    front = unit(np.cross(right,up))
    aligned = p @ np.stack([right,up,front],axis=1)
    width = aligned[454,0]-aligned[234,0]
    face_height = aligned[10,1]-aligned[152,1]
    mid = [(aligned[234,0]+aligned[454,0])/2, (aligned[468,1]+aligned[473,1])/2,
           (aligned[234,2]+aligned[454,2])/2]
    q = aligned-np.array(mid)
    q[:,0] *= .58/width
    q[:,1] *= .50/face_height
    q[:,2] *= .58/width*.57
    q[:,1] += .034
    q[:,2] += .065
    # Compensate weak-perspective shear on the farther cheek of a turned portrait.
    center_offset = np.mean(q[[168,6,195,1],0])
    q[:,0] -= center_offset*np.clip(q[:,2]/.29,0,1)*.72
    # Open up the eyes gently at toy scale while keeping the photographed spacing and shape.
    for loop in [LEFT_EYE,RIGHT_EYE]:
        center=q[loop].mean(axis=0)
        dx=q[:,0]-center[0]; dy=q[:,1]-center[1]
        window=np.exp(-(dx/.091)**4-(dy/.047)**4)
        q[:,0]+=dx*.18*window
        q[:,1]+=dy*.53*window
    return q,front[0]


def triangulation(xy):
    loops=[OUTLINE, LEFT_EYE, RIGHT_EYE, MOUTH]
    segments=[[i,loop[(k+1)%len(loop)]] for loop in loops for k,i in enumerate(loop)]
    holes=[xy[loop].mean(axis=0) for loop in loops[1:]]
    result=triangle.triangulate({'vertices':xy,'segments':segments,'holes':holes},'pQ')
    if len(result['vertices']) != 468:
        raise RuntimeError('Unexpected landmark intersection')
    original=result['triangles'].copy()
    faces=original.tolist(); points=xy.tolist(); parents=[]
    for stage in range(2):
        splits={}; refined=[]
        def midpoint(a,b):
            key=(min(a,b),max(a,b))
            if key in splits: return splits[key]
            m=(np.array(points[a])+points[b])/2
            detail=(abs(abs(m[0])-.124)<.092 and -.015<m[1]<.135) or (abs(m[0])<.132 and -.208<m[1]<-.090)
            if stage and not detail: return None
            i=len(points);points.append(m.tolist());parents.append([a,b]);splits[key]=i
            return i
        for a,b,c in faces:
            ab,bc,ca=midpoint(a,b),midpoint(b,c),midpoint(c,a)
            if ab is None and bc is None and ca is None: refined.append([a,b,c]); continue
            if ab is not None and bc is not None and ca is not None:
                refined.extend([[a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]]); continue
            # Rotate to the single split, or to the one unsplit edge.
            verts=[a,b,c]; edges=[ab,bc,ca]
            if sum(i is not None for i in edges)==1:
                k=next(i for i,x in enumerate(edges) if x is not None)
                a,b,c=verts[k:]+verts[:k]; n=edges[k]; refined.extend([[a,n,c],[n,b,c]])
            else:
                k=edges.index(None); a,b,c=verts[k:]+verts[:k]
                n,m=edges[(k+1)%3],edges[(k+2)%3]
                refined.extend([[c,m,n],[a,b,m],[b,n,m]])
        faces=refined
    return original,np.array(faces),np.array(parents)


def resample(base, parents):
    points=np.zeros((len(base)+len(parents),base.shape[1]),np.float32);points[:len(base)]=base
    for i,(a,b) in enumerate(parents,len(base)): points[i]=(points[a]+points[b])/2
    return points


def palette(source):
    looks={}
    for m in re.finditer(r"^  (\w+): \{ skin: '(#[0-9a-f]+)', hair: '(#[0-9a-f]+)'.*?\},",source,re.M):
        looks[m[1]]={'skin':np.array(list(bytes.fromhex(m[2][1:])),dtype=float),
                     'glasses':'glasses:' in m[0], 'beard':'beard:' in m[0]}
    return looks


def painted_vertices(image,uv,shape,parents,look,yaw):
    uv_dense=resample(uv[:468],parents); xyz=resample(shape[:468],parents)
    factor=760/image.shape[1]; rgb=cv2.resize(image,None,fx=factor,fy=factor,interpolation=cv2.INTER_AREA)
    uv_small=uv*factor
    if look['glasses']:
        # Remove frame pigment from the cheeks. Frames are rebuilt separately in clay.
        selection=np.zeros(rgb.shape[:2],np.uint8); protect=np.zeros_like(selection)
        for lids,brows in [(LEFT_EYE,LEFT_BROW),(RIGHT_EYE,RIGHT_BROW)]:
            contour=uv_small[lids]; ctr=contour.mean(0)
            enlarged=ctr+(contour-ctr)*[1.90,2.65]
            cv2.fillPoly(selection,[enlarged.astype('int32')],255)
            for path in [lids,brows]:
                cv2.fillPoly(protect,[uv_small[path].astype('int32')],255)
        dark=np.max(rgb,axis=2)<119
        ink=(dark & (selection>0) & (protect==0)).astype('uint8')*255
        ink=cv2.dilate(ink,np.ones((3,3),np.uint8));ink[protect>0]=0
        rgb=cv2.inpaint(rgb,ink,4,cv2.INPAINT_TELEA)
    filters=cv2.GaussianBlur(rgb,(0,0),1.1)
    def sample(coords):
        pix=np.rint(coords*factor).astype('int32');return filters[np.clip(pix[:,1],0,len(filters)-1),np.clip(pix[:,0],0,filters.shape[1]-1)].astype(float)
    skin=look['skin']; base=np.median(sample(uv[[4, 50,280,117,346,151,9,205,425]]),axis=0)
    multiplier=np.clip(skin/np.maximum(1,base),.68,1.55)
    ink=np.clip(sample(uv_dense)*multiplier,0,255)
    if abs(yaw)>.14:
        # Use the visible cheek for the occluded outer strip on three-quarter portraits.
        mirrored=xyz[:,:2].copy();mirrored[:,0]*=-1
        _,indices=cKDTree(xyz[:,:2]).query(mirrored)
        blend=np.clip((np.sign(yaw)*xyz[:,0]-.04)/.12,0,1)*np.clip((abs(yaw)-.14)/.22,0,1)
        ink=ink+(ink[indices]-ink)*blend[:,None]
    improbable=(ink[:,2]>ink[:,0]*1.03)|(ink[:,1]>ink[:,0]*1.06)
    ink[improbable]=ink[improbable]*.12+skin*.88
    # Fade to the surrounding clay at the sculpt seam, with color relief in the center.
    contour=xyz[OUTLINE,:2].astype('float32')
    distances=np.array([max(0,cv2.pointPolygonTest(contour,tuple(map(float,pt[:2])),True)) for pt in xyz]);weight=np.clip(distances/.032,0,1)
    weight=weight*weight*(3-2*weight)
    x,y=xyz[:,0],xyz[:,1]
    brow=np.exp(-((abs(x)-.127)/.079)**4-((y-.101)/.020)**4)
    lips=np.exp(-(x/.117)**4-((y-shape[13,1]+.008)/.044)**4)
    beard=np.clip((-y-.081)/.065,0,1) if look['beard'] else np.zeros_like(y)
    mask=np.maximum.reduce([brow*.33,lips*.36,beard*.53])
    ink=skin+(ink-skin)*((.37+mask)*weight)[:,None]
    upper=[78,191,80,81,82,13,312,311,310,415,308]
    lower=[78,95,88,178,87,14,317,402,318,324,308]
    h=np.linspace(0,10,31);rows=[]
    for j in range(9):
        t=j/8
        hi=np.stack([np.interp(h,np.arange(11),uv[upper,a]) for a in (0,1)],axis=1)
        lo=np.stack([np.interp(h,np.arange(11),uv[lower,a]) for a in (0,1)],axis=1)
        rows.extend(hi+(lo-hi)*t)
    mouth=sample(np.array(rows))*multiplier
    return np.clip(np.rint(ink),0,255).astype('uint8'),np.clip(np.rint(mouth),0,255).astype('uint8')


def smooth_surface(xyz,faces):
    neighbors=[set() for _ in range(468)]
    for a,b,c in faces:
        neighbors[a].update([b,c]);neighbors[b].update([c,a]);neighbors[c].update([a,b])
    protected=set(LEFT_EYE+RIGHT_EYE+MOUTH+OUTLINE+[1,4,6,98,327])
    for _ in range(2):
        source=xyz.copy()
        for i,adjacent in enumerate(neighbors):
            if not adjacent or i in protected: continue
            pts=source[list(adjacent)]; delta=np.linalg.norm(pts[:,:2]-source[i,:2],axis=1)
            weight=1/np.maximum(.006,delta)
            value=np.average(pts[:,2],weights=weight)
            xyz[i,2]+=(value-source[i,2])*.34


def main():
    looks=palette((ROOT/'src/models.js').read_text()); records={}
    unique=sorted((ROOT/'public/portraits').glob('*.webp'))
    with mp.solutions.face_mesh.FaceMesh(static_image_mode=True,max_num_faces=1,refine_landmarks=True,min_detection_confidence=.22) as mesh:
        for path in unique:
            im=np.array(Image.open(path).convert('RGB'))
            result=mesh.process(im)
            if not result.multi_face_landmarks: raise RuntimeError('No sculpture landmarks for '+path.stem)
            lm=np.array([[p.x,p.y,p.z] for p in result.multi_face_landmarks[0].landmark])
            xyz,yaw=sculpt(lm,im.shape[1],im.shape[0]);uv=lm[:,:2]*[im.shape[1],im.shape[0]]
            records[path.stem.lower()]=(xyz,uv,im,yaw)
    xy=np.mean([xyz[:468,:2] for xyz,_,_,_ in records.values()],axis=0)
    original,faces,parents=triangulation(xy); residents={}
    for name,(xyz,uv,im,yaw) in records.items():
        smooth_surface(xyz,original)
        ink,mouth=painted_vertices(im,uv,xyz,parents,looks[name],yaw)
        residents[name]=[packed(np.rint(xyz*SCALE),'<i2'),packed(ink,'uint8'),packed(mouth,'uint8')]
    payload={'scale':SCALE,'original':packed(original,'<u2'),'faces':packed(faces,'<u2'),'midpoints':packed(parents,'<u2'),'residents':residents}
    (ROOT/'src/portrait-sculpts.json').write_text(json.dumps(payload,separators=(',',':'))+'\n')
    print(f'{len(records)} sculpts, {len(parents)+468} face vertices and {len(faces)} triangles each.')

if __name__=='__main__': main()
