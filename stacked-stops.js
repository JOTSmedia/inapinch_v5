// At maximum zoom a map cannot separate different stops at one entrance.
// Use the actual filtered members, including venue-specific access labels.
export function chooseStackedStops(records,onChoose,trigger,accessLabel,doc=document) {
  const dialog=doc.createElement('dialog');
  dialog.className='stacked-stops';dialog.setAttribute('aria-label','Choose a mapped stop');
  const header=doc.createElement('header');
  const title=doc.createElement('h2');title.textContent='Choose a stop';
  const close=doc.createElement('button');close.type='button';close.textContent='Close';
  const list=doc.createElement('div');list.className='stacked-stop-list';
  const closePicker=()=>{
    if(dialog.open && typeof dialog.close==='function')dialog.close();
    dialog.remove();
    const returnTo=trigger?.isConnected?trigger:doc.getElementById('map');
    returnTo?.focus({preventScroll:true});
  };
  close.addEventListener('click',closePicker);
  dialog.addEventListener('cancel',event=>{event.preventDefault();closePicker();});
  dialog.addEventListener('click',event=>{if(event.target===dialog)closePicker();});
  header.append(title,close);
  const sorted=[...records].sort((a,b)=>a.name.localeCompare(b.name)||String(a.id).localeCompare(String(b.id)));
  for(const place of sorted){
    const button=doc.createElement('button');button.type='button';
    const name=doc.createElement('strong');name.textContent=place.name;
    const note=doc.createElement('span');note.textContent=[place.category,accessLabel?.(place)].filter(Boolean).join(' · ');
    button.append(name,note);
    button.addEventListener('click',()=>{closePicker();onChoose(place.id);});
    list.append(button);
  }
  dialog.append(header,list);doc.body.append(dialog);
  if(typeof dialog.showModal==='function')dialog.showModal();
  else dialog.setAttribute('open','');
  list.firstElementChild?.focus({preventScroll:true});
}
