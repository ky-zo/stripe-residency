export const appearanceOptions = {
  skin: [['#f3d2b6','Ivory'],['#e7b494','Peach'],['#cf9872','Honey'],['#b77b55','Caramel'],['#925d42','Chestnut'],['#694333','Umber'],['#493027','Espresso']],
  hairStyle: [['short','Short'],['wavy','Wavy'],['long','Long'],['buzz','Buzz']],
  hair: [['#342a27','Espresso'],['#614234','Chestnut'],['#a35b38','Copper'],['#cfaa71','Honey blond'],['#a9a69d','Silver']],
  shirt: [['#698772','Sage'],['#d97859','Coral'],['#7570ac','Iris'],['#558a98','Lagoon'],['#d8ad64','Ochre'],['#f3e8d2','Linen']]
};
export const defaultAppearance = {skin:'#cf9872',hairStyle:'wavy',hair:'#342a27',shirt:'#698772'};
export const memberHandle = id => 'member:' + id;

export function readAppearance(value) {
  if (!value || typeof value !== 'object') return null;
  const result = {};
  for (const [part, options] of Object.entries(appearanceOptions)) {
    if (!options.some(([choice]) => choice === value[part])) return null;
    result[part] = value[part];
  }
  return result;
}
export function appearanceKey(value) {
  return value ? [value.skin,value.hairStyle,value.hair,value.shirt].join('/') : '';
}
export function memberDetails(input) {
  if (typeof input.name !== 'string' || (input.note != null && typeof input.note !== 'string')) return null;
  const clean = text => text.normalize('NFC').replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/gu,' ').replace(/\s+/gu,' ').trim();
  const name = clean(input.name), note = clean(input.note || ''), appearance = readAppearance(input.appearance);
  if (!name || [...name].length > 32 || [...note].length > 100 || !appearance) return null;
  return {name, note, appearance};
}
export const validMemberKey = key => typeof key === 'string' && /^[a-f0-9]{64}$/.test(key);
