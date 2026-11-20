export function activitySeat(id,playerId,key,slot=0){
  if(id==='swim'||id==='surf')return 'play:'+id+':'+playerId;
  if(id==='climb')return 'play:climb:'+key+':'+slot;
  if(id==='padel'||id==='boat')return 'play:'+id+':'+key;
  if(id==='ride'||id==='lounge'||id==='boulder')return 'play:'+id;
  return null;
}

export function activityId(seat){
  if(typeof seat!=='string'||!seat.startsWith('play:'))return null;
  const id=seat.split(':')[1];
  return ['lounge','swim','climb','ride','surf','boat','padel','boulder'].includes(id)?id:null;
}

export function climbKey(seat){return activityId(seat)==='climb'?seat.split(':')[2]:null;}
// Which side of the trunk a climber holds. Seats from before shared palms have none.
export function climbSlot(seat){return activityId(seat)==='climb'?Number(seat.split(':')[3])||0:0;}
