import {escapeHTML as e, normalize} from './logic.js';
import {usRegions} from './us-geography.js';
import {listStatePlaces} from './area-geography.js';
import {stateExtent} from './city-extents.js';
import {destinationMap, wireDestinationMap, bindStateSearch, placeMatches, buildPlaceSearch} from './destination-picker.js';
// A file URL may change only its fragment through the History API. Keep the
// normal hosted query syntax as the internal route in both entry points.
export function routeURL(href = location.href) {
  const url = new URL(href);
  if (url.protocol === 'file:' && url.hash.startsWith('#pinch?')) {
    url.search = url.hash.slice(7);
    url.hash = '';
  }
  return url;
}
export function writeRouteURL(route, push = false) {
  const current = new URL(location.href);
  let target = route;
  if (current.protocol === 'file:') {
    target = new URL(current);
    target.hash = 'pinch?' + route.searchParams.toString();
  }
  if (target.href === current.href) return;
  try { history[push ? 'pushState' : 'replaceState'](null,'',target); }
  catch (error) {
    // Restricted embedded file previews may disable history entirely.
    if (current.protocol !== 'file:' || error.name !== 'SecurityError') throw error;
  }
}
export let cities = [];
export const nationalGuide = {
  id:'us', code:'US', name:'United States', state:'', region:'United States',
  lat:39, lng:-98, deep:'#133f40', accent:'#177166', highlight:'#f9d781',
  theme:'National atlas', motif:'atlas', art:'assets/cities/us.svg',
  headline:['THE U.S.', 'RESTROOM ATLAS.'],
  tagline:'Find a restroom on your route, from downtown to the next town over.'
};
const $ = id => document.getElementById(id);
export function nearestCity(position) {
  const rad=Math.PI/180;
  return [...cities].sort((a,b)=>{
    const distance=c=>Math.acos(Math.min(1,Math.max(-1,Math.sin(position.lat*rad)*Math.sin(c.lat*rad)+Math.cos(position.lat*rad)*Math.cos(c.lat*rad)*Math.cos((position.lng-c.lng)*rad))));
    return distance(a)-distance(b);
  })[0];
}
export function applyCity(city, {resetDestination=false} = {}) {
  const national = city.id === nationalGuide.id;
  const label = national ? 'U.S. atlas' : city.name;
  const reset = $('reset-map-btn');
  if(resetDestination || document.body.dataset.destination!==city.id){
    const description = `Return to ${label}`;
    reset.title = description.toUpperCase();
    reset.setAttribute('aria-label', description);
  }
  document.body.dataset.destination = city.id;
  document.querySelectorAll('button[data-city]').forEach(button => {
    const current = button.dataset.city === city.id;
    button.classList.toggle('is-current',current);
    button.setAttribute('aria-pressed', String(current));
  });
  document.querySelectorAll('button[data-national-overview]').forEach(button => button.classList.toggle('is-current',national));
}

export async function initCityGuide(onSelect,onFocus=()=>{}) {
  const response=await fetch('./cities.json');
  if(!response.ok)throw new Error('City guide unavailable');
  cities=await response.json();
  const states=new Map(usRegions.map(region=>[region.code,region]));
  const dialog=$('cities-dialog'), stateInput=$('state-jump'), cityInput=$('dp-place-query'), status=$('dp-place-status');
  const findGuide=id=>id===nationalGuide.id?nationalGuide:cities.find(c=>c.id===id);
  let selectedId,activeArea,draftState='',places=[],shown=[],placeLimit=8;
  let activeTab='atlas',lastMapState=null,loading=0,routeRevision=0;
  let queued=Promise.resolve(),pending=false,searchIndex,searchRun=0;
  function nationalSearch() {
    if(!searchIndex)searchIndex=fetch('./data/destination-index.json').then(async response=>{
      if(!response.ok)throw Error('Place search unavailable');
      return buildPlaceSearch(await response.json(),cities);
    }).catch(error=>{searchIndex=null;throw error;});
    return searchIndex;
  }

  function renderCities() {
    const query=normalize($('city-search').value),region=$('city-region').value;
    const results=cities.filter(c=>(!region||c.region===region) && normalize([c.name,c.state,c.code,c.region,c.theme].join(' ')).includes(query));
    $('city-search-count').textContent=results.length+' featured '+(results.length===1?'city':'cities');
    $('city-grid').innerHTML=results.map(c=>`<button type="button" class="city-card ${c.id===selectedId?'is-current':''}" data-city="${e(c.id)}" aria-pressed="${c.id===selectedId}" style="--card-color:${e(c.deep)};--card-accent:${e(c.highlight)}"><span class="city-postcard"><img src="${e(c.art)}" alt="" loading="lazy"><span class="city-code">${e(c.code)}</span><span class="city-current">Selected</span></span><span class="city-card-info"><strong>${e(c.name)}</strong><span>${e(c.state)} · ${e(c.theme)}</span></span></button>`).join('')||'<div class="city-empty"><h3>No matching featured cities</h3><button type="button" id="city-reset">Show all featured cities</button></div>';
  }
  function showTab(name,focus=false) {
    activeTab=name;
    for(const tab of ['atlas','guides']) {
      const selected=tab===name,button=$('dp-'+tab+'-tab');
      button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;
      $('dp-'+tab+'-panel').hidden=!selected;
      if(focus && selected)button.focus();
    }
  }
  for(const tab of ['atlas','guides']){
    const button=$('dp-'+tab+'-tab');
    button.addEventListener('click',()=>showTab(tab));
    button.addEventListener('keydown',event=>{
      if(!['Home','End','ArrowLeft','ArrowRight'].includes(event.key))return;
      event.preventDefault();showTab(event.key==='Home'?'atlas':event.key==='End'?'guides':tab==='atlas'?'guides':'atlas',true);
    });
  }
  async function showPlaces() {
    const run=++searchRun,query=cityInput.value.trim();
    let matches;
    if(draftState)matches=placeMatches(places,query);
    else if(query){
      status.textContent='Searching destinations…';
      shown=[];$('dp-place-results').innerHTML='';
      try{matches=(await nationalSearch())(query,activeArea?.state || findGuide(selectedId)?.state);}catch{
        if(run===searchRun){shown=[];status.textContent='Place search could not load.';$('dp-place-results').innerHTML='<button type="button" data-dp-retry>Retry search</button>';}
        return;
      }
      if(run!==searchRun)return;
    }else{
      shown=[];$('dp-place-results').innerHTML='';status.textContent='Search nationwide or select a state first.';return;
    }
    shown=matches.slice(0,placeLimit);
    status.textContent=matches.length ? matches.length.toLocaleString()+' mapped '+(matches.length===1?'place':'places') : 'No matching cities or towns.';
    $('dp-place-results').innerHTML=shown.map((p,i)=>`<button type="button" data-dp-place="${i}"><span>${e(p.label || p.name)}${draftState || p.kind==='state'?'':', '+e(p.state)}</span><small>${e(p.type || (p.kind==='state'?'State / territory':''))}</small></button>`).join('')+
      (matches.length>shown.length?'<button type="button" data-dp-more>Show more places</button>':'');
  }
  function paintSelection(code) {
    const map=$('dp-state-map');
    if(lastMapState===null){
      map.innerHTML=destinationMap(code);
      wireDestinationMap(map,selectState, $('dp-map-status'));
    }else{
      map.querySelectorAll('[data-map-state]').forEach(node=>node.setAttribute('aria-pressed',String(node.dataset.mapState===code)));
    }
    lastMapState=code;
    $('dp-map-status').textContent=states.get(code)?.name || 'United States';
  }
  async function chooseState(code) {
    const revision=++loading,region=states.get(code);++searchRun;
    draftState=region?code:'';places=[];shown=[];placeLimit=8;
    stateInput.value=region?.name || '';stateInput.dataset.selected=draftState;
    cityInput.value='';cityInput.disabled=Boolean(region);cityInput.placeholder=region?'Search cities or towns':'City or town, e.g. Montclair, NJ';
    $('dp-open-state').disabled=!region;
    $('dp-open-state').textContent=region?'View '+region.name+' map':'View state map';
    $('dp-place-results').innerHTML='';status.textContent=region?'Loading cities and towns…':'';
    paintSelection(draftState || activeArea?.state || findGuide(selectedId)?.state || '');
    if(!region){void showPlaces();return;}
    try{
      const loaded=await listStatePlaces(code);
      if(revision!==loading)return;
      places=loaded;cityInput.disabled=places.length===0;
      if(places.length)showPlaces();
      else status.textContent='Town boundaries are unavailable here. Open the state or territory map to browse stops.';
    }catch{
      if(revision!==loading)return;
      status.textContent='The town directory could not load.';
      $('dp-place-results').innerHTML='<button type="button" data-dp-retry>Retry town directory</button>';
    }
  }

  function destination(code,place) {
    const region=states.get(code),bounds=place?.bounds || stateExtent(code);
    return region && bounds ? {kind:place?'place':'state',state:code,id:place?.id,name:place?.name || region.name,bounds,guideId:place?.guideId} : null;
  }
  function setBusy(value) {
    pending=value;
    if(value)dialog.setAttribute('aria-busy','true');else dialog.removeAttribute('aria-busy');
    $('city-picker-btn').setAttribute('aria-busy',String(value));
  }
  async function navigate(id,area,{push=true,close=true,revision,preserveCamera=false,isCurrent=()=>true}={}) {
    const guide=findGuide(id);if(!guide || (revision!==undefined && revision!==routeRevision))return;
    const current=revision ?? ++routeRevision;
    const task=async()=>{
      if(current!==routeRevision || !isCurrent())return false;
      setBusy(true);$('dp-error').hidden=true;
      try{
        const accepted=await onSelect(guide,{destination:area,preserveCamera});
        if(current!==routeRevision || accepted===false)return false;
        selectedId=guide.id;activeArea=area || null;applyCity(guide,{resetDestination:true});
        if(area)await onFocus(area);
        if(current!==routeRevision)return;
        if(push){
          const url=routeURL();
          url.searchParams.set('city',guide.id);
          for(const key of ['spot','near','state','place'])url.searchParams.delete(key);
          if(area){url.searchParams.set('state',area.state);if(area.kind==='place')url.searchParams.set('place',area.id);}
          writeRouteURL(url,true);
        }
        try{localStorage.setItem('in-a-pinch:v5:city',guide.id);}catch{}
        if(close && dialog.open)dialog.close();
      }catch(error){
        $('dp-error').textContent='This destination could not load. Please try again.';$('dp-error').hidden=false;
        throw error;
      }finally{setBusy(false);}
    };
    const result=queued.then(task);queued=result.catch(()=>{});return result;
  }
  function select(id,options){return navigate(id,null,options);}
  function selectState(code,place) {
    const area=destination(code,place);
    if(!area || pending)return;
    void navigate(findGuide(place?.guideId)?.id || nationalGuide.id,area).catch(console.error);
  }
  async function activateMatch(match,{isCurrent=()=>true}={}) {
    if(!match || !isCurrent())return false;
    const revision=++routeRevision;
    let row=match;
    if(match.kind==='place' && !match.bounds){
      const rows=await listStatePlaces(match.state);
      if(revision!==routeRevision || !isCurrent())return false;
      row=rows.find(p=>p.id===match.id);
      if(!row)return false;
    }
    const area=destination(match.state,match.kind==='state'?null:row);
    if(!area)return false;
    return (await navigate(findGuide(row.guideId)?.id || nationalGuide.id,area,{revision,isCurrent}))!==false && revision===routeRevision;
  }
  async function findDestination(query,{isCurrent=()=>true,chooseTop=false}={}) {
    if(!query?.trim())return false;
    const revision=++routeRevision;
    const index=await nationalSearch();
    if(revision!==routeRevision || !isCurrent())return false;
    const matches=index(query,activeArea?.state || findGuide(selectedId)?.state);
    const key=normalize(query),exact=matches.filter(p=>p.key===key);
    const shorthand=['la','nyc','sf'].includes(key) || cities.some(c=>c.code.toLowerCase()===key);
    const qualified=matches[0]?.kind==='place' && (key.endsWith(' '+matches[0].state.toLowerCase()) || key.endsWith(' '+normalize(states.get(matches[0].state)?.name)));
    if(!chooseTop && !shorthand && !qualified && matches[0]?.kind!=='state' && (exact.length>1 || (!exact.length && matches.length>1))){
      open({query});return true;
    }
    return activateMatch(matches[0],{isCurrent});
  }
  function open({stateFirst=false,state,query=''}={}) {
    const code=!query && states.has(state)?state:'';
    if(!dialog.open || draftState!==code)void chooseState(code);
    renderCities();showTab(stateFirst || query?'atlas':activeTab);
    if(!dialog.open)dialog.showModal();
    if(query){cityInput.value=query;void showPlaces();cityInput.focus({preventScroll:true});}
    else $('cities-title').focus({preventScroll:true});
  }
  function currentPickerRequest() {
    const state=draftState,query=cityInput.value;
    return ()=>dialog.open && state===draftState && query===cityInput.value;
  }
  const combobox=bindStateSearch(stateInput,$('dp-state-toggle'),$('dp-state-options'),code=>void chooseState(code));
  $('dp-open-state').addEventListener('click',()=>selectState(draftState));
  $('dp-place-results').addEventListener('click',event=>{
    if(event.target.closest('[data-dp-more]')){placeLimit+=20;showPlaces();return;}
    if(event.target.closest('[data-dp-retry]')){if(draftState)void chooseState(draftState);else void showPlaces();return;}
    const btn=event.target.closest('[data-dp-place]');
    if(btn)void activateMatch(shown[Number(btn.dataset.dpPlace)],{isCurrent:currentPickerRequest()}).catch(console.error);
  });
  cityInput.addEventListener('input',()=>{placeLimit=8;showPlaces();});
  cityInput.addEventListener('keydown',event=>{
    if(event.key==='ArrowDown'){event.preventDefault();$('dp-place-results').querySelector('button')?.focus();}
    if(event.key==='Enter'){
      event.preventDefault();
      const isCurrent=currentPickerRequest();
      if(!draftState)void findDestination(cityInput.value,{isCurrent,chooseTop:true}).catch(console.error);
      else if(shown[0])void activateMatch(shown[0],{isCurrent}).catch(console.error);
    }
  });
  const featured=['key-west','nyc','miami','la','austin','sf'];
  $('city-shortcuts').innerHTML=featured.map(findGuide).filter(Boolean).map(c=>`<button type="button" data-city="${e(c.id)}" aria-pressed="false"><i style="background:${e(c.accent)}"></i>${e(c.id==='nyc'?'NYC':c.name)}</button>`).join('');
  $('city-region').innerHTML='<option value="">EVERY REGION</option>'+[...new Set(cities.map(c=>c.region))].sort().map(region=>`<option value="${e(region)}">${e(region.toUpperCase())}</option>`).join('');
  $('city-search').addEventListener('input',renderCities);
  $('city-region').addEventListener('change',renderCities);
  $('cities-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>combobox.close());
  for(const id of ['city-picker-btn','explore-cities-btn'])$(id).addEventListener('click',()=>open());
  dialog.addEventListener('click',event=>{
    if(event.target!==dialog)return;
    const r=dialog.getBoundingClientRect();
    if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();
  });
  document.addEventListener('click',event=>{
    if(event.target.closest('#city-reset')){$('city-search').value='';$('city-region').value='';renderCities();return;}
    const btn=event.target.closest('button[data-city]');if(btn && !pending)void select(btn.dataset.city).catch(console.error);
  });
  async function routeTo(params,preferred) {
    const revision=++routeRevision,requested=params.get('city'),code=params.get('state')?.toUpperCase();
    let area=null;
    if(states.has(code)){
      area=destination(code);
      const id=params.get('place');
      if(id){
        try{const rows=await listStatePlaces(code);const row=rows.find(p=>String(p.id)===id);if(row)area=destination(code,row);}catch{}
      }
    }
    const guide=findGuide(requested || area?.guideId || (area?nationalGuide.id:preferred)) || nationalGuide;
    await navigate(guide.id,area,{push:false,revision});
    return revision===routeRevision?guide:null;
  }
  window.addEventListener('popstate',()=>{
    void routeTo(routeURL().searchParams,nationalGuide.id).then(result=>{if(result)document.dispatchEvent(new CustomEvent('restorecityspot'));}).catch(console.error);
  });
  let preferred=nationalGuide.id;
  try{preferred=localStorage.getItem('in-a-pinch:v5:city')||preferred;}catch{}
  const params=routeURL().searchParams;
  if(params.has('spot')&&!params.has('city'))preferred=params.has('near')?nationalGuide.id:'key-west';
  const first=await routeTo(params,preferred);
  if(first){const url=routeURL();url.searchParams.set('city',first.id);writeRouteURL(url);}
  return {cities,select,open,findDestination};
}
