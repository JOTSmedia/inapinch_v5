import {escapeHTML as e, normalize} from './logic.js';
import {regionSilhouettes} from './region-silhouettes.js';
import {usRegions, usRegionView} from './us-geography.js';

const insetCodes=['AK','HI','PR','VI','GU','MP','AS'];
const offshore=new Set(insetCodes);
const callouts=['VT','NH','MA','RI','CT','NJ','DE','MD','DC'];
const orderedStates=[...usRegions].sort((a,b)=>a.name.localeCompare(b.name));
const statesByCode=new Map(usRegions.map(region=>[region.code,region]));
const radians=Math.PI/180;
const conicN=(Math.sin(29.5*radians)+Math.sin(45.5*radians))/2;
const conicC=Math.cos(29.5*radians)**2+2*conicN*Math.sin(29.5*radians);
function project(lat,lng) {
  const angle=(lng+96)*radians*conicN;
  const radius=Math.sqrt(conicC-2*conicN*Math.sin(lat*radians))/conicN;
  return [radius*Math.sin(angle),radius*Math.cos(angle)];
}

// Reproject the bundled Census outlines to an Albers equal-area U.S. map.
// Offshore regions keep their own geographic outlines in the labeled insets.
let projectedMap;
function mainland() {
  if(projectedMap)return projectedMap;
  let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
  const statePaths=orderedStates.filter(region=>!offshore.has(region.code)).map(region=>{
    const [mx,my,sx,sy,path]=regionSilhouettes[region.code];
    const points=[...path.matchAll(/([ML])(-?[\d.]+) (-?[\d.]+)|(Z)/g)].map(match=>{
      if(match[4])return 'Z';
      const [x,y]=project(my+(42-Number(match[3]))/sy,mx+(Number(match[2])-64)/sx);
      left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
      return [match[1],x,y];
    });
    const anchor=usRegionView(region.code);
    return {...region,points,anchor:project(anchor.lat,anchor.lng)};
  });
  const scale=Math.min(580/(right-left),324/(bottom-top));
  const x=v=>Number((11+(v-left)*scale).toFixed(1));
  const y=v=>Number((12+(v-top)*scale).toFixed(1));
  projectedMap=statePaths.map(({code,name,points,anchor})=>({code,name,
    path:points.map(p=>p==='Z'?'Z':p[0]+x(p[1])+' '+y(p[2])).join(''),
    x:x(anchor[0]),y:y(anchor[1])}));
  return projectedMap;
}

export function stateOptions(query='') {
  const q=normalize(query);
  return orderedStates.filter(s=>!q || normalize(s.name).includes(q) || s.code.toLowerCase()===q);
}
export function placeMatches(places, query='') {
  const q=normalize(query);
  if(!q)return places;
  const starts=[], rest=[];
  for(const p of places){
    const name=normalize(p.name),label=normalize(p.label || p.name);
    if(name.startsWith(q))starts.push(p);
    else if(name.includes(q)||label.includes(q))rest.push(p);
  }
  return [...starts,...rest];
}
export function destinationMap(current='') {
  const active=mainland().some(p=>p.code===current)?current:'KS';
  const shapes=mainland().map(p=>{
    const callout=callouts.indexOf(p.code), cy=46+callout*22;
    const tag=callout<0 ? '<text x="'+p.x+'" y="'+p.y+'">'+p.code+'</text>' :
      '<polyline class="dp-leader" points="'+p.x+','+p.y+' 578,'+cy+' 603,'+cy+'"/><rect class="dp-map-key" x="604" y="'+(cy-9)+'" width="33" height="19" rx="4"/><text x="620.5" y="'+cy+'">'+p.code+'</text>';
    return '<g class="dp-state" role="button" data-map-state="'+p.code+'" tabindex="'+(p.code===active?'0':'-1')+'" aria-label="'+e(p.name)+'" aria-pressed="'+(p.code===current)+'"><title>'+e(p.name.toUpperCase())+'</title><path class="dp-shape" d="'+p.path+'"/>'+tag+'</g>';
  }).join('');
  const insets=insetCodes.map(code=>{
    const region=statesByCode.get(code),short={VI:'U.S. Virgin Islands',MP:'N. Mariana Islands'}[code] || region.name;
    return '<button class="dp-inset" type="button" data-map-state="'+code+'" aria-label="'+e(region.name)+'" aria-pressed="'+(code===current)+'"><svg viewBox="0 0 128 84" aria-hidden="true"><path d="'+regionSilhouettes[code][4]+'"/></svg><span>'+e(short)+'</span></button>';
  }).join('');
  return '<svg class="dp-us-map" viewBox="0 0 652 348" role="group" aria-label="Contiguous U.S. states and Washington, D.C." aria-describedby="dp-map-keys"><desc id="dp-map-keys">Use the arrow keys to move between states and Enter to open the map.</desc>'+shapes+'</svg><div class="dp-insets" role="group" aria-label="Alaska, Hawaii and U.S. territories">'+insets+'</div>';
}

export function wireDestinationMap(container, activate, status) {
  const controls=()=>Array.from(container.querySelectorAll('.dp-state'));
  const highlight=target=>{const region=statesByCode.get(target?.dataset.mapState);if(region)status.textContent=region.name;};
  container.addEventListener('pointerover',event=>highlight(event.target.closest('[data-map-state]')));
  container.addEventListener('pointerleave',()=>{status.textContent=container.querySelector('[aria-pressed="true"]')?.getAttribute('aria-label') || 'United States';});
  container.addEventListener('focusin',event=>highlight(event.target.closest('[data-map-state]')));
  container.addEventListener('click',event=>{
    const target=event.target.closest('[data-map-state]');
    if(target)activate(target.dataset.mapState);
  });
  container.addEventListener('keydown',event=>{
    const target=event.target.closest('.dp-state');if(!target)return;
    if(['Enter',' '].includes(event.key)){event.preventDefault();activate(target.dataset.mapState);return;}
    const directions={ArrowRight:[1,0],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowUp:[0,-1]};
    if(!Object.hasOwn(directions,event.key) && !['Home','End'].includes(event.key))return;
    event.preventDefault();
    const nodes=controls();
    let next=event.key==='End'?nodes.length-1:0;
    if(directions[event.key]){
      const [vx,vy]=directions[event.key],origin=mainland().find(row=>row.code===target.dataset.mapState);
      let score=Infinity;next=nodes.indexOf(target);
      for(const [i,state] of mainland().entries()){
        const dx=state.x-origin.x,dy=state.y-origin.y,forward=dx*vx+dy*vy;
        if(forward<=0)continue;
        const offset=Math.abs(dx*vy-dy*vx),cost=Math.hypot(dx,dy)+offset*2;
        if(cost<score){score=cost;next=i;}
      }
    }
    nodes.forEach((item,i)=>item.setAttribute('tabindex',i===next?'0':'-1'));
    nodes[next].focus();
  });
}

// The state search and the map choose the same geographic destination. The
// combobox also lets someone narrow the city/town directory before navigating.
export function bindStateSearch(input, toggle, list, choose) {
  let results=[],active=-1;
  function close() {
    list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');
  }
  function render(query) {
    results=stateOptions(query);if(!query)results.unshift({code:'',name:'All states and territories'});active=-1;
    list.innerHTML=results.map(s=>'<div role="option" aria-selected="false" id="dp-option-'+s.code+'" data-state-option="'+s.code+'">'+e(s.name)+'</div>').join('') || '<div class="dp-no-state">No matching states or territories.</div>';
    list.hidden=false;input.setAttribute('aria-expanded','true');input.removeAttribute('aria-activedescendant');
  }
  function commit(code) {
    if(code===''){input.value='';close();choose('');return;}
    const s=statesByCode.get(code);if(!s)return;
    input.value=s.name;close();choose(code);
  }
  input.addEventListener('input',()=>render(input.value));
  input.addEventListener('click',()=>{if(list.hidden)render(input.value===statesByCode.get(input.dataset.selected)?.name?'':input.value);});
  input.addEventListener('change',()=>{
    if(active>=0)return;
    const text=normalize(input.value), match=orderedStates.find(s=>normalize(s.name)===text || s.code.toLowerCase()===text);
    if(match)commit(match.code);
  });
  input.addEventListener('keydown',event=>{
    if(event.key==='Escape' && !list.hidden){event.preventDefault();event.stopPropagation();close();return;}
    if(event.key==='Enter' && !list.hidden){
      const selected=results[active] || (results.length===1?results[0]:null);
      if(selected){event.preventDefault();commit(selected.code);}return;
    }
    if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
    if(list.hidden && ['Home','End'].includes(event.key))return;
    event.preventDefault();if(list.hidden)render('');
    if(!results.length)return;
    if(active>=0)list.children[active].setAttribute('aria-selected','false');
    active=event.key==='Home'?0:event.key==='End'?results.length-1:event.key==='ArrowDown'?Math.min(active+1,results.length-1):active<0?results.length-1:Math.max(0,active-1);
    const option=list.children[active];option.setAttribute('aria-selected','true');input.setAttribute('aria-activedescendant',option.id);option.scrollIntoView({block:'nearest'});
  });
  input.addEventListener('blur',()=>{close();input.value=statesByCode.get(input.dataset.selected)?.name || '';});
  toggle.addEventListener('pointerdown',event=>event.preventDefault());
  toggle.addEventListener('click',()=>{if(list.hidden){input.focus();render('');}else close();});
  list.addEventListener('pointerdown',event=>event.preventDefault());
  list.addEventListener('click',event=>{const option=event.target.closest('[data-state-option]');if(option)commit(option.dataset.stateOption);});
  return {close};
}

export function buildPlaceSearch(index,guides) {
  const aliases=new Map(),featured=new Set();
  for(const guide of guides) {
    const names=[guide.name,guide.code,guide.id];
    if(guide.id==='la')names.push('LA');
    if(guide.id==='sf')names.push('SF');
    if(guide.id==='nyc')names.push('NYC');
    if(guide.id==='dc')names.push('Washington DC');
    const name=guide.id==='dc'?'Washington':guide.name;
    for(const alias of names)aliases.set(normalize(alias),{state:guide.state,name:normalize(name)});
    featured.add(guide.state+'|'+normalize(name));
  }
  const rows=Object.entries(index).flatMap(([state,records])=>records.map(([id,name,label])=>{
    const key=normalize(name);
    return {kind:'place',state,id,name,label:label || name,key,featured:featured.has(state+'|'+key)};
  }));
  const regions=orderedStates.map(s=>({kind:'state',name:s.name,state:s.code,label:s.name,key:normalize(s.name)}));
  return function search(input, preferredState='') {
    const query=normalize(input);if(!query)return [];
    const alias=aliases.get(query);
    const suffix=regions.find(s=>query.endsWith(' '+s.state.toLowerCase()) || query.endsWith(' '+s.key));
    const prefix=suffix?query.slice(0,query.lastIndexOf(' '+(query.endsWith(' '+suffix.key)?suffix.key:suffix.state.toLowerCase()))):query;
    const matches=[];
    for(const region of regions){
      if(suffix)continue;
      if(region.state.toLowerCase()===query || region.key===query)matches.push([alias?1:0,region]);
      else if(query.length>1 && region.key.startsWith(query))matches.push([5,region]);
    }
    for(const row of rows){
      if(suffix && row.state!==suffix.state)continue;
      const special=alias?.state===row.state && alias.name===row.key;
      let rank=special ? 0 : row.key===prefix ? 2 : prefix.length>=2 && row.key.startsWith(prefix) ? 7 :
        prefix.length>=3 && row.key.includes(' '+prefix) ? 10 : 99;
      if(rank===99)continue;
      if(rank>1 && row.featured)rank-=1;
      if(rank>1 && row.state===preferredState)rank-=.25;
      matches.push([rank,row]);
    }
    matches.sort((a,b)=>a[0]-b[0] || a[1].name.localeCompare(b[1].name,'en') || a[1].state.localeCompare(b[1].state));
    return matches.map(item=>item[1]);
  };
}
