export function activitySeat(id,playerId,key){
  if(id==='swim')return 'play:swim:'+playerId;
  if(id==='climb')return 'play:climb:'+key;
  if(id==='ride'||id==='lounge')return 'play:'+id;
  return null;
}

export function activityId(seat){
  if(typeof seat!=='string'||!seat.startsWith('play:'))return null;
  const id=seat.split(':')[1];
  return ['lounge','swim','climb','ride'].includes(id)?id:null;
}

export function climbKey(seat){return activityId(seat)==='climb'?seat.split(':')[2]:null;}
