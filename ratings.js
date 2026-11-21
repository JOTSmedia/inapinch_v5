import {escapeHTML} from './logic.js';

// Separate keys let tabs edit different stops independently. An unavailable storage API
// leaves this tab's selections usable in memory for the rest of the visit.
const prefix='in-a-pinch:v5:rating:';
const scores=new Map();
const temporary=new Set();
let bound=false;
let storageUnavailable=false;
let onChange=()=>{};
let onToast=()=>{};

function validScore(value) {
  if(typeof value==='string' && /^[1-5]$/.test(value)) return Number(value);
  return Number.isInteger(value) && value>=1 && value<=5 ? value : null;
}
function accept(id,value) {
  const score=validScore(value);
  if(score!==null)scores.set(id,score);else scores.delete(id);
}
function readStored(){
  try{
    const storage=globalThis.localStorage;
    for(let i=0;i<storage.length;i++){
      const key=storage.key(i);
      if(key?.startsWith(prefix))accept(key.slice(prefix.length),storage.getItem(key));
    }
  }catch{storageUnavailable=true;}
}
function changedElsewhere(event){
  if(event.key===null){scores.clear();temporary.clear();onChange();return;}
  if(!event.key?.startsWith(prefix))return;
  const id=event.key.slice(prefix.length);
  temporary.delete(id);
  try{accept(id,globalThis.localStorage.getItem(event.key));}
  catch{accept(id,event.newValue);}
  onChange();
}
export function initRatings(changeCallback,toastCallback){
  if(typeof changeCallback==='function')onChange=changeCallback;
  if(typeof toastCallback==='function')onToast=toastCallback;
  if(!bound){
    readStored();
    document.addEventListener('click',handleRatingClick);
    document.addEventListener('keydown',handleRatingKeydown);
    globalThis.window?.addEventListener('storage',changedElsewhere);
    bound=true;
  }
  onChange();
}
export function getRating(id){return {myRating:scores.get(id)??null};}

function changeScore(id,score) {
  if(typeof id!=='string' || !id || (score!==null && validScore(score)===null))return;
  accept(id,score);
  try{
    if(score===null)globalThis.localStorage.removeItem(prefix+id);
    else globalThis.localStorage.setItem(prefix+id,String(score));
    storageUnavailable=false;temporary.delete(id);
  }catch{
    storageUnavailable=true;temporary.add(id);
  }
  onChange();
  const action=score===null?'Rating cleared':'Your rating is '+score+' out of 5';
  onToast(action+(temporary.has(id)?' for this visit. Browser storage is unavailable.':score===null?' on this device.':'. Saved on this device.'));
  queueMicrotask(()=>{
    const controls=document.querySelectorAll('[data-rating-action="select"]');
    const active=[...controls].find(control=>control.dataset.ratingId===id && Number(control.dataset.ratingValue)===(score??1));
    active?.focus({preventScroll:true});
  });
}
export function handleRatingClick(event){
  const control=event.target?.closest?.('[data-rating-action]');
  if(!control || control.disabled)return false;
  const {ratingAction,ratingId,ratingValue}=control.dataset;
  if(ratingAction!=='select' && ratingAction!=='remove')return false;
  const score=validScore(ratingValue);
  if(ratingAction==='select' && score===null)return false;
  event.preventDefault();event.stopPropagation();
  changeScore(ratingId,ratingAction==='remove'?null:score);
  return true;
}
export function handleRatingKeydown(event){
  const control=event.target?.closest?.('[data-rating-action="select"]');
  if(!control || control.disabled || !['ArrowRight','ArrowLeft','ArrowUp','ArrowDown','Home','End'].includes(event.key))return false;
  const current=validScore(control.dataset.ratingValue)??1;
  const forward=event.key==='ArrowRight'||event.key==='ArrowDown';
  const score=event.key==='Home'?1:event.key==='End'?5:((current-1+(forward?1:4))%5)+1;
  event.preventDefault();event.stopPropagation();
  changeScore(control.dataset.ratingId,score);
  return true;
}
export function ratingSummaryHTML(id){
  const score=scores.get(id);
  return score ? `<div class="rating-summary own-rating"><span aria-hidden="true">★</span> Your rating · ${score}/5</div>` : '';
}
export function ratingPanelHTML(id) {
  const safe=escapeHTML(id),score=scores.get(id)??0;
  const stars=[1,2,3,4,5].map(value=>`<button type="button" class="rating-star${value<=score?' selected':''}" role="radio" aria-checked="${score===value}" aria-label="${value} ${value===1?'star':'stars'}" tabindex="${value===(score||1)?'0':'-1'}" data-rating-id="${safe}" data-rating-action="select" data-rating-value="${value}"><span aria-hidden="true">★</span></button>`).join('');
  const location=storageUnavailable||temporary.has(id) ? 'Browser storage is unavailable. New ratings stay in this tab for this visit.' : 'Saved only in this browser on this device.';
  return `<section class="stop-section personal-rating" data-rating-panel="${safe}" aria-label="Your personal restroom rating">
    <div class="personal-rating-heading"><h3>Your rating</h3>${score?`<button type="button" data-rating-id="${safe}" data-rating-action="remove" aria-label="Clear your rating">Clear</button>`:''}</div>
    <p>Rate a restroom you’ve used.</p>
    <div class="rating-stars" role="radiogroup" aria-label="Your rating from 1 to 5 stars">${stars}</div>
    <div class="personal-rating-note">${location}</div></section>`;
}
