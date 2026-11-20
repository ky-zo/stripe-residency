const STEP = .45;
const WIDTH = 49;
const HEIGHT = 33;
const directions = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
const squared = (a, b) => (a.x-b.x)**2 + (a.z-b.z)**2;

export function createNavigation(obstacles, residents) {
  function canStand(x, z) {
    if ((x/10.35)**2 + (z/6.66)**2 > 1) return false;
    if (obstacles.some(o => Math.abs(x-o.x) < o.w/2+.24 && Math.abs(z-o.z) < o.d/2+.24)) return false;
    return !residents.some(p => (x-p.x)**2 + (z-p.z)**2 < .50**2);
  }
  const nodes = Array.from({length: WIDTH*HEIGHT}, (_, id) => {
    const x = (id%WIDTH-(WIDTH-1)/2)*STEP;
    const z = (Math.floor(id/WIDTH)-(HEIGHT-1)/2)*STEP;
    return {id, x, z, open:canStand(x,z)};
  });
  function nearest(point) {
    let best, min = Infinity;
    for (const n of nodes) {
      if (!n.open) continue;
      const d = squared(n,point);
      if (d < min) { min=d; best=n; }
    }
    return best;
  }
  function direct(a,b) {
    const steps = Math.ceil(Math.sqrt(squared(a,b))/.15);
    for (let i=1;i<=steps;i++) {
      const t=i/steps;
      if (!canStand(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t)) return false;
    }
    return true;
  }
  function path(from,to) {
    if (canStand(to.x,to.z) && direct(from,to)) return [to];
    const start=nearest(from), end=nearest(to);
    if (!start || !end) return null;
    const reached=new Map([[start.id,{cost:0, previous:null}]]), frontier=[{node:start,score:0}];
    while (frontier.length) {
      let index=0;
      for(let i=1;i<frontier.length;i++) if(frontier[i].score<frontier[index].score) index=i;
      const {node}=frontier.splice(index,1)[0];
      if (node===end) break;
      for(const [dx,dz] of directions) {
        const next=nodes[node.id+dx+dz*WIDTH];
        if (!next?.open || Math.abs(next.x-node.x)>STEP*1.1) continue;
        if (dx && dz && (!nodes[node.id+dx]?.open || !nodes[node.id+dz*WIDTH]?.open)) continue;
        const cost=reached.get(node.id).cost + Math.hypot(dx,dz)*STEP;
        if (cost>=(reached.get(next.id)?.cost??Infinity)) continue;
        reached.set(next.id,{cost,previous:node.id});
        frontier.push({node:next,score:cost+Math.sqrt(squared(next,end))});
      }
    }
    if (!reached.has(end.id)) return null;
    const points=[];
    for(let id=end.id;id!==null;id=reached.get(id).previous) points.unshift(nodes[id]);
    if (canStand(to.x,to.z) && direct(end,to)) points.push(to);
    const result=[];
    let anchor=from;
    for(let i=0;i<points.length;) {
      let furthest=i;
      while(furthest+1<points.length && direct(anchor,points[furthest+1])) furthest++;
      result.push(points[furthest]);
      anchor=points[furthest]; i=furthest+1;
    }
    return result;
  }
  return {canStand,path};
}
