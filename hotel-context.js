import {distanceMiles,isFoodVenue,isLodging,normalize} from './logic.js';

function unionByKey(primary=[],more=[],keyOf) {
  const merged=[],seen=new Set();
  for(const value of [...primary,...more]){
    const key=keyOf(value);
    if(key&&!seen.has(key)){seen.add(key);merged.push(value);}
  }
  return merged;
}

// Keep the guide's published access facts and canonical ID while carrying
// through independent identity, address, phone and private-room information.
export function mergeLodgingEvidence(target, incoming) {
  if(!isLodging(target)||!isLodging(incoming))return;
  const footprint=incoming.hotelFootprintId||(/^us-osm-a\d+$/.test(incoming.id)?incoming.id:null);
  if(footprint&&!target.hotelFootprintId)target.hotelFootprintId=footprint;
  if(!incoming.lodgingEvidence)return;
  target.lodging=true;target.lodgingEvidence=true;
  for(const key of ['femaId','website','phone','guestRoomNote','guestRoomBathroom','guestRoomShower']){
    if(incoming[key]!=null && target[key]==null)target[key]=incoming[key];
  }
  if(incoming.addressKnown&&(!target.address||target.addressKnown===false)){
    target.address=incoming.address;target.addressKnown=true;
  }
  for(const field of ['onSiteDining','onSiteFacilities']){
    if(incoming[field]?.length)target[field]=unionByKey(target[field],incoming[field],v=>[v.id,v.name,v.sourceUrl].join('|'));
  }
  target.sources=unionByKey(target.sources,incoming.sources,s=>s.url);
}

let footprintRequest;
function localFootprints(){
  if(!footprintRequest)footprintRequest=fetch('./data/hotel-dining.json').then(async r=>{
    if(!r.ok)throw Error('Hotel footprint listings unavailable');
    return r.json();
  }).catch(error=>{footprintRequest=null;throw error;});
  return footprintRequest;
}

const radius=.3;
function diningKey(name){return normalize(name).replace(/^the\s+/,'');}
export function nearbyForHotel(hotel,candidates,onSite=[]){
  const insideIds=new Set(onSite.map(x=>x.id).filter(Boolean));
  const insideNames=new Set(onSite.filter(x=>x.name&&!Number.isFinite(x.lat)).map(x=>diningKey(x.name)));
  const unique=new Map();
  for(const venue of candidates){
    if(!venue||venue.id===hotel.id||insideIds.has(venue.id)||venue.nameKnown===false||!venue.name||!isFoodVenue(venue)||isLodging(venue))continue;
    if(!Number.isFinite(venue.lat)||!Number.isFinite(venue.lng))continue;
    const name=diningKey(venue.name);
    if(!name||insideNames.has(name))continue;
    const distance=distanceMiles(hotel,venue);
    if(distance>radius||!Number.isFinite(distance))continue;
    if(onSite.some(w=>w.name&&diningKey(w.name)===name&&Number.isFinite(w.lat)&&distanceMiles(venue,w)<.012))continue;
    const id=venue.id||name+'|'+venue.lat+'|'+venue.lng;
    if(!unique.has(id))unique.set(id,{place:venue,distanceMiles:distance});
  }
  return [...unique.values()].sort((a,b)=>a.distanceMiles-b.distanceMiles||a.place.name.localeCompare(b.place.name)).slice(0,40);
}

export async function loadHotelContext(hotel,{getAtlas,getPlaces=()=>[],getFootprints=localFootprints}={}){
  const delta=radius/68.7;
  const deltaLng=Math.min(180,delta/Math.max(.001,Math.cos(hotel.lat*Math.PI/180)));
  const bounds={south:hotel.lat-delta,north:hotel.lat+delta,west:hotel.lng-deltaLng,east:hotel.lng+deltaLng};
  const footprintId=hotel.hotelFootprintId||hotel.id;
  const [footprint,nearby]=await Promise.allSettled([
    /^us-osm-a\d+$/.test(footprintId)?getFootprints():Promise.resolve(null),
    Promise.resolve().then(async()=>{const atlas=await getAtlas?.();return atlas?atlas.query(bounds):null;})
  ]);
  const data=footprint.status==='fulfilled'?footprint.value:null;
  const mappedDining=data?.byHotel?.[footprintId]||[],facilities=data?.facilitiesByHotel?.[footprintId]||[];
  const authoritative=hotel.onSiteDining||[];
  const onSite=unionByKey(authoritative,mappedDining,item=>[item.id,item.name,item.sourceUrl].join('|'))
    .filter(item=>item.evidenceType!=='mapped-footprint'||!authoritative.some(official=>official.evidenceType==='operator'&&diningKey(official.name)===diningKey(item.name)));
  const atlasRows=nearby.status==='fulfilled'?nearby.value?.records||[]:[];
  return {onSiteDining:onSite,onSiteFacilities:unionByKey(hotel.onSiteFacilities,facilities,item=>item.id||item.sourceUrl),
    nearbyDining:nearbyForHotel(hotel,[...getPlaces(),...atlasRows],onSite)};
}
