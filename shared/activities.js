export function activitySeat(id,playerId,key){
  if(id==='swim'||id==='surf')return 'play:'+id+':'+playerId;
  if(id==='climb'||id==='padel'||id==='boat')return 'play:'+id+':'+key;
  if(id==='ride'||id==='lounge'||id==='boulder')return 'play:'+id;
  return null;
}

export function activityId(seat){
  if(typeof seat!=='string'||!seat.startsWith('play:'))return null;
  const id=seat.split(':')[1];
  return ['lounge','swim','climb','ride','surf','boat','padel','boulder'].includes(id)?id:null;
}

export function climbKey(seat){return activityId(seat)==='climb'?seat.split(':')[2]:null;}
