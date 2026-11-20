import {appearanceOptions,appearanceKey,defaultAppearance,memberDetails} from '../shared/members.js';
import './member.css';

const labels={skin:'Skin tone',hairStyle:'Hairstyle',hair:'Hair color',shirt:'Shirt color'};
const byId=id=>document.getElementById(id);

export async function paintMember(image,appearance){
  const key=appearanceKey(appearance);
  image.dataset.look=key;
  try{
    const {memberPortrait}=await import('./member-image.js');
    if(image.dataset.look===key)image.src=memberPortrait(appearance);
  }catch{
    if(image.dataset.look===key){image.removeAttribute('src');image.alt='Clay figure preview unavailable';}
  }
}

export function createMemberEditor({onSave,onRemove,onToggle}){
  const dialog=byId('member-dialog'),form=byId('member-form'),options=byId('member-options');
  const name=byId('member-name'),note=byId('member-note'),feedback=byId('member-feedback');
  const submit=byId('member-submit'),remove=byId('member-remove'),close=byId('member-close');
  const photo=new Image(136,136);
  photo.alt='';byId('member-preview').append(photo);
  const inputs=new Map();
  let appearance,editing=false,working=false,confirmRemove=false;
  for(const [part,choices] of Object.entries(appearanceOptions)){
    const field=document.createElement('fieldset'),legend=document.createElement('legend'),row=document.createElement('div');
    legend.textContent=labels[part];row.className='look-choices';field.append(legend,row);options.append(field);
    for(const [value,label] of choices){
      const item=document.createElement('label'),input=document.createElement('input'),swatch=document.createElement('span');
      input.type='radio';input.name=part;input.value=value;input.setAttribute('aria-label',label);item.title=label;
      item.className=part==='hairStyle'?'hair-choice':'color-choice';
      if(part==='hairStyle')swatch.textContent=label;else swatch.style.setProperty('--swatch',value);
      input.addEventListener('change',()=>{appearance={...appearance,[part]:value};paintMember(photo,appearance);});
      item.append(input,swatch);row.append(item);inputs.set(part+value,input);
    }
  }
  function busy(value){
    working=value;submit.disabled=value;remove.disabled=value;close.disabled=value;
    form.querySelectorAll('input').forEach(el=>{el.disabled=value;});
  }
  function open(member){
    editing=Boolean(member);confirmRemove=false;busy(false);feedback.textContent='';
    name.value=member?.name||'';note.value=member?.note||'';appearance={...(member?.appearance||defaultAppearance)};
    for(const [part,value] of Object.entries(appearance)) {const input=inputs.get(part+value);if(input)input.checked=true;}
    paintMember(photo,appearance);
    byId('member-title').textContent=editing?'Your island member':'Join the residency';
    submit.textContent=editing?'Save and play':'Join the island';remove.textContent='Remove my member';remove.hidden=!editing;
    if(!dialog.open){dialog.showModal();onToggle(true);}
    (matchMedia('(pointer:coarse)').matches?byId('member-title'):name).focus({preventScroll:true});
  }
  close.addEventListener('click',()=>dialog.close());
  dialog.addEventListener('cancel',e=>{if(working)e.preventDefault();});
  dialog.addEventListener('close',()=>onToggle(false));
  form.addEventListener('submit',async e=>{
    e.preventDefault();if(working)return;
    const details=memberDetails({name:name.value,note:note.value,appearance});
    if(!details){feedback.textContent='Enter a name to join the island.';name.focus();return;}
    busy(true);feedback.textContent='';submit.textContent='Saving…';
    try{await onSave(details);dialog.close();}
    catch(error){feedback.textContent=error.message;submit.textContent=editing?'Save and play':'Join the island';}
    finally{busy(false);}
  });
  remove.addEventListener('click',async()=>{
    if(working)return;
    if(!confirmRemove){confirmRemove=true;remove.textContent='Confirm removal';feedback.textContent='This removes your figure from the resident list.';return;}
    busy(true);
    try{await onRemove();dialog.close();}
    catch(error){feedback.textContent=error.message;}
    finally{busy(false);}
  });
  return {open,isOpen:()=>dialog.open};
}
