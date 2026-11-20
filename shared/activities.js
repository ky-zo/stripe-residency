export function activitySeat(id,playerId) {
  if(id==='swim')return 'play:swim:'+playerId;
  if(id==='lounge')return 'play:lounge';
  return null;
}

export function activityId(seat) {
  if(seat==='play:lounge')return 'lounge';
  if(typeof seat==='string'&&seat.startsWith('play:swim:'))return 'swim';
  return null;
}
