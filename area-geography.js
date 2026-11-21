import {usRegionAt, usRegionRings} from './us-geography.js';

// Bundles are local classic-script assets so a shared site and the double-click
// edition can both look up a place without contacting a geocoding service.
const awaiting = new Map();
const stateData = new Map();
function loadState(code) {
  if (stateData.has(code)) return stateData.get(code);
  if (!/^[A-Z]{2}$/.test(code)) return Promise.reject(Error('Invalid state'));
  globalThis.inAPinchAreaData = (key,data) => awaiting.get(key)?.(data);
  const request = new Promise((resolve,reject) => {
    const script=document.createElement('script');
    const clean=()=>{clearTimeout(timeout);awaiting.delete(code);script.remove();};
    const failed=()=>{clean();reject(Error('Area boundaries unavailable'));};
    const timeout=setTimeout(failed,12000);
    awaiting.set(code, async packed=>{
      clean();
      try {
        const compressed=Uint8Array.from(atob(packed),c=>c.charCodeAt(0));
        const decoded=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
        resolve(await new Response(decoded).json());
      } catch(error) {reject(error);}
    });
    script.onerror=failed;
    script.src='./data/area/'+code+'.js';
    document.head.append(script);
  });
  stateData.set(code,request);
  request.catch(()=>{if(stateData.get(code)===request)stateData.delete(code);});
  // Keep nearby states handy without retaining nationwide boundaries after a tour.
  request.then(()=>{
    while(stateData.size>7){
      const oldest=[...stateData.keys()].find(key=>!awaiting.has(key));
      if(!oldest)break;
      stateData.delete(oldest);
    }
  },()=>{});
  return request;
}

const guideCities = new Map([
  ['FL|Key West','key-west'],['NY|New York City','nyc'],['FL|Miami','miami'],
  ['CA|Los Angeles','la'],['TX|Austin','austin'],['CA|San Francisco','sf'],
  ['IL|Chicago','chicago'],['WA|Seattle','seattle'],['LA|New Orleans','new-orleans'],
  ['TN|Nashville','nashville'],['MA|Boston','boston'],['DC|Washington','dc'],
  ['CA|San Diego','san-diego'],['OR|Portland','portland'],['CO|Denver','denver'],
  ['NV|Las Vegas','las-vegas'],['AZ|Phoenix','phoenix'],['GA|Atlanta','atlanta'],
  ['SC|Charleston','charleston'],['GA|Savannah','savannah'],['FL|Orlando','orlando'],
  ['HI|Honolulu','honolulu'],['TX|Dallas','dallas'],['TX|Houston','houston']
]);

function displayCity(name,code) {
  if(code==='NY' && name==='New York')return 'New York City';
  if(code==='HI' && name==='Urban Honolulu')return 'Honolulu';
  if(code==='TN' && name.startsWith('Nashville-Davidson'))return 'Nashville';
  return name;
}

const ringsCache=new WeakMap();
function ringsFor(record) {
  if(ringsCache.has(record))return ringsCache.get(record);
  const rings=record[4].map(encoded=>{
    const bytes=atob(encoded);
    let x=0,y=0,offset=0;
    const ring=[];
    const signed=()=>{
      let n=0,scale=1;
      while(offset<bytes.length){
        const byte=bytes.charCodeAt(offset++);
        n+=(byte&127)*scale;
        if(byte<128)return n%2?-(n+1)/2:n/2;
        scale*=128;
      }
      throw Error('Truncated area boundary');
    };
    while(offset<bytes.length){x+=signed();y+=signed();ring.push(x,y);}
    return ring;
  });
  ringsCache.set(record,rings);
  return rings;
}

// County/municipality source shapes may include disjoint islands and holes.
// The even–odd rule handles both and includes a shared edge in either polygon.
function contains(record,lat,lng) {
  const [w,s,e,n]=record[3];
  if(lng*1e4<w || lng*1e4>e || lat*1e4<s || lat*1e4>n)return false;
  const x=lng*1e5, y=lat*1e5;
  let inside=false;
  for(const ring of ringsFor(record)){
    for(let i=2;i<ring.length;i+=2){
      const a=ring[i-2],b=ring[i-1],u=ring[i],v=ring[i+1];
      if((b>y)!==(v>y) && x<(u-a)*(y-b)/(v-b)+a)inside=!inside;
      if(Math.abs((x-a)*(v-b)-(y-b)*(u-a))<1e-6 &&
         x>=Math.min(a,u) && x<=Math.max(a,u) && y>=Math.min(b,v) && y<=Math.max(b,v))return true;
    }
  }
  return inside;
}

export function createAreaResolver(readState=loadState) {
  return async function areaAt(lat,lng,zoom) {
    const normalized=((lng+180)%360+360)%360-180;
    const state=usRegionAt(lat,lng);
    const result={state,county:null,city:null,borough:null,neighborhood:null,guideId:null,
      id:state?.code||'outside',level:state?'state':'outside',
      label:state?.name||'Outside U.S. coverage',shortLabel:state?.name||'Outside U.S. coverage'};
    if(zoom<5 && state){
      return {...result,id:'us',level:'country',label:'United States',shortLabel:'United States'};
    }
    if(!state || zoom<7)return result;
    try{
      const matches=new Map();
      const rows=await readState(state.code);
      for(const record of rows){
        const kind=record[0];
        if((kind==='n' && zoom<14) || (kind!=='c' && zoom<10))continue;
        if(!matches.has(kind) && contains(record,lat,normalized))matches.set(kind,record);
      }
      const county=matches.get('c'),nta=matches.get('n');
      // Incorporated cities/towns take precedence over statistical places.
      // At street scale show an enclosed CDP before its parent township.
      const municipality=matches.get('p') || (zoom>=14?matches.get('d'):null) || matches.get('m') || matches.get('d');
      result.county=county?.[2] || null;
      result.borough=nta?.[5] || county?.[5] || null;
      result.city=result.borough?'New York City':municipality?displayCity(municipality[2],state.code):null;
      result.neighborhood=nta?.[2] || null;
      result.guideId=zoom>=10 && result.city ? guideCities.get(state.code+'|'+result.city)||null : null;
      let record,level,name,qualifier=state.code;
      if(zoom>=14 && nta){record=nta;level='neighborhood';name=nta[2];qualifier=result.borough+', NY';}
      else if(zoom>=12 && result.borough){record=county||nta;level='borough';name=result.borough;qualifier='NYC';}
      else if(zoom>=10 && result.city){record=municipality||county;level='city';name=result.city;}
      else if(county){record=county;level='county';name=result.county;}
      if(record){
        result.id=record[0]+':'+record[1];result.level=level;result.shortLabel=name;
        result.label=level==='neighborhood'?name+' · '+qualifier:name+', '+qualifier;
      }
    }catch{/* If a jurisdiction bundle cannot load, its state name is still authoritative. */}
    return result;
  };
}

export const resolveMapArea=createAreaResolver();

// Return only source geometry that represents the requested administrative level.
// Point-only neighborhood labels have no boundary in the local source.
export async function getAreaBoundary(area,readState=loadState) {
  const code=area?.state?.code;
  if(!code || area.approximate)return null;
  if(area.level==='state'){
    const rings=usRegionRings(code);
    return rings.length ? {rings} : null;
  }
  if(!['county','city','borough','neighborhood'].includes(area.level))return null;
  const kinds={county:'c',city:'pdm',borough:'c',neighborhood:'n'}[area.level];
  const rows=await readState(code);
  let record=rows.find(r=>kinds.includes(r[0]) && r[0]+':'+r[1]===area.id);
  // A saved guide uses its guide slug until the center-point lookup runs.
  // NYC's boroughs share the geometry of their published county boundaries.
  if(!record && area.level==='city' && area.guideId){
    record=rows.find(r=>'pd'.includes(r[0]) && guideCities.get(code+'|'+displayCity(r[2],code))===area.guideId);
  }
  if(!record && area.level==='borough' && area.borough){
    record=rows.find(r=>r[0]==='c' && r[5]===area.borough);
  }
  if(!record)return null;
  const rings=ringsFor(record).map(flat=>{
    const ring=[];
    for(let i=0;i<flat.length;i+=2)ring.push([flat[i]/1e5,flat[i+1]/1e5]);
    return ring;
  });
  return {rings};
}

const placeLists = new WeakMap();
const typeLabels={p:'Incorporated place',d:'Census-designated place',m:'Township'};
function pickerBounds(record){
  const [w,s,e,n]=record[3].map(value=>value/1e4);
  if(e-w<=180)return {west:w,south:s,east:e,north:n};
  // An Aleutian place can wrap across 180 degrees. Leaflet accepts continuous longitudes.
  let west=Infinity,east=-Infinity;
  for(const ring of ringsFor(record))for(let i=0;i<ring.length;i+=2){
    let x=ring[i]/1e5;
    if(x>0)x-=360;
    west=Math.min(west,x);east=Math.max(east,x);
  }
  return {west,south:s,east,north:n};
}

function representative(record){
  const all=ringsFor(record);
  const main=all.reduce((largest,ring)=>ring.length>largest.length?ring:largest,[]);
  let first=Infinity,last=-Infinity;
  for(let i=1;i<main.length;i+=2){first=Math.min(first,main[i]);last=Math.max(last,main[i]);}
  // Pick a point strictly inside the polygon along a scanline through an outer ring.
  const y=(first+(last-first)*.507)+.001;
  const crossings=[];
  for(const ring of all){
    for(let i=2;i<ring.length;i+=2){
      const ax=ring[i-2],ay=ring[i-1],bx=ring[i],by=ring[i+1];
      if((ay>y)!==(by>y))crossings.push(ax+(bx-ax)*(y-ay)/(by-ay));
    }
  }
  crossings.sort((a,b)=>a-b);
  let chosen,span=-1;
  for(let i=1;i<crossings.length;i+=2){
    const length=crossings[i]-crossings[i-1];
    if(length>span){span=length;chosen=(crossings[i]+crossings[i-1])/2;}
  }
  return chosen===undefined?null:{lat:y/1e5,lng:chosen/1e5};
}

export async function listStatePlaces(code,readState=loadState){
  const state=String(code).toUpperCase();
  if(!/^[A-Z]{2}$/.test(state))return [];
  const rows=await readState(state);
  if(placeLists.has(rows))return placeLists.get(rows);
  const counties=rows.filter(r=>r[0]==='c');
  const byCountyId=new Map(counties.map(r=>[r[1],r[2]]));
  const grouped=new Map();
  for(const record of rows){
    if(!Object.hasOwn(typeLabels,record[0]))continue;
    const name=displayCity(record[2],state);
    if(!grouped.has(name))grouped.set(name,[]);
    grouped.get(name).push(record);
  }
  const result=[];
  for(const [name,group] of grouped){
    const seen=new Map();
    for(const r of group){
      // Some Census town subdivisions and incorporated towns describe the same
      // legal place. Coextensive same-name entries share one picker option.
      const key=r[3].join('/');
      const prior=seen.get(key);
      if(!prior || (prior[0]!=='p' && r[0]==='p'))seen.set(key,r);
    }
    const ambiguous=seen.size>1;
    const localLabels=new Map();
    for(const r of seen.values()){
      let county=r[0]==='m'?byCountyId.get(r[1].slice(0,5)):null;
      if(ambiguous && !county){
        const spot=representative(r);
        if(spot)county=counties.find(c=>contains(c,spot.lat,spot.lng))?.[2];
      }
      const type=r[6]==='CDP'?'Census-designated place':r[6]?r[6][0].toUpperCase()+r[6].slice(1):typeLabels[r[0]];
      const label=ambiguous?[name,type,county].filter(Boolean).join(' · '):name;
      const place={id:r[0]+':'+r[1],name,type,bounds:pickerBounds(r),state,guideId:guideCities.get(state+'|'+name)||null,county:county||null,label};
      if(!localLabels.has(label))localLabels.set(label,[]);
      localLabels.get(label).push(place);
    }
    for(const colliding of localLabels.values()){
      for(const place of colliding){
        if(colliding.length>1)place.label+=' · '+place.id.slice(2);
        result.push(place);
      }
    }
  }
  result.sort((a,b)=>a.label.localeCompare(b.label,'en'));
  placeLists.set(rows,result);
  return result;
}
