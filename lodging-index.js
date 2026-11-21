// Compact tuples stay in latitude order. Expand only the visible hotels;
// a national overview uses small per-cell counts without creating detail cards.
function visibleLongitude(bounds,lng) {
  const span=bounds.east-bounds.west;
  return Math.abs(span)>=360 || ((lng-bounds.west)%360+360)%360<=((span%360)+360)%360;
}
function expandLodging(row, meta) {
  const [id,femaId,name,street,city,state,zip,phone,kind,lat,lng,method,matchedAddress]=row;
  const profile=meta.operatorProfiles?.[id];
  const locality=[city,state].filter(Boolean).join(', ');
  const sources=[];
  if(profile)sources.push({label:'Property guest rooms',url:profile.roomSource},{label:'Property dining',url:profile.diningUrl});
  if(femaId)sources.push({label:'USFA Hotel-Motel National Master List · '+femaId,url:meta.source});
  if(method==='interpolated'||method==='osm-address')sources.push({label:'U.S. Census Bureau address geocoding',url:meta.census});
  if(id.startsWith('us-osm-')){
    const encoded=id.slice(7),type=encoded[0]==='n'?'node':encoded[0]==='w'?'way':null;
    // An "a" marks a Geofabrik area feature. Its numeric ID alone does not
    // distinguish an OSM way from a relation. The coordinate link is reliable.
    const url=type?'https://www.openstreetmap.org/'+type+'/'+encoded.slice(1):
      'https://www.openstreetmap.org/?mlat='+lat+'&mlon='+lng+'#map=18/'+lat+'/'+lng;
    sources.push({label:'Mapped property location',url});
  }
  const federalNote=femaId?'This location is listed in the U.S. Fire Administration lodging directory. ':'';
  return {
    id,cityId:'us',name,category:kind,state,locality:city,neighborhood:locality,lat,lng,femaId:femaId||undefined,
    address:[street,locality,zip].filter(Boolean).join(', '),addressKnown:Boolean(street),phone:phone||undefined,
    lodging:true,lodgingEvidence:true,evidenceType:profile?'operator-lodging':'usfa-lodging',dynamicListing:true,
    coordinateAccuracy:method==='interpolated'?'interpolated-address':'facility',coordinateMethod:method,
    ...(matchedAddress?{matchedAddress}:{}),priority:55,access:'unknown',bathroomConfirmed:false,accessible:null,
    changingTable:null,showers:null,purchaseLikely:false,accessNote:'Ask the front desk whether visitors can use a lobby bathroom.',
    note:federalNote+(method==='interpolated'?'The map estimates the property location along its street address range. Check the street address for the entrance.':'The pin marks the lodging property.'),
    ...(profile?{website:profile.website,guestRoomBathroom:true,guestRoomShower:profile.guestRoomShower,guestRoomNote:profile.guestRoomNote,
      onSiteDining:[{name:profile.diningName,category:'Restaurant',evidenceType:'operator',sourceUrl:profile.diningUrl,sourceLabel:'Property dining directory'}]}:{}),
    sources,checkedLabel:(profile?'Property listings': 'USFA lodging directory')+' · '+meta.checked,
    searchTerms:[kind,'lodging hotel motel',profile?.diningName].filter(Boolean).join(' ')
  };
}

export function createLodgingIndex(dataset){
  if(!dataset?.meta || !Array.isArray(dataset.rows))throw Error('Invalid lodging index');
  const {rows,meta}=dataset,ids=new Map(rows.map((r,i)=>[r[0],i]));
  // Zoom nine matches the national venue atlas's overview resolution.
  const cells=new Map(),scale=512;
  function coordinates(x,y){
    return {west:x/scale*360-180,east:(x+1)/scale*360-180,north:Math.atan(Math.sinh(Math.PI*(1-2*y/scale)))*180/Math.PI,south:Math.atan(Math.sinh(Math.PI*(1-2*(y+1)/scale)))*180/Math.PI};
  }
  for(const r of rows){
    const lat=r[9],lng=r[10],sin=Math.sin(lat*Math.PI/180);
    const x=Math.floor((lng+180)/360*scale),y=Math.floor((.5-Math.log((1+sin)/(1-sin))/(4*Math.PI))*scale);
    const key=r[5]+'|'+x+'|'+y;
    if(!cells.has(key))cells.set(key,{state:r[5],bounds:coordinates(x,y),all:[0,0,0],extra:[0,0,0]});
    const c=cells.get(key);
    for(const bucket of (r[11]==='interpolated'?[c.all,c.extra]:[c.all])){bucket[0]++;bucket[1]+=lat;bucket[2]+=lng;}
  }
  function query(bounds){
    let lo=0,hi=rows.length;
    while(lo<hi){const mid=Math.floor((lo+hi)/2);if(rows[mid][9]<bounds.south)lo=mid+1;else hi=mid;}
    const found=[];
    for(let i=lo;i<rows.length&&rows[i][9]<=bounds.north;i++)if(visibleLongitude(bounds,rows[i][10]))found.push(expandLodging(rows[i],meta));
    return found;
  }
  function overview(bounds,{onlyAdditional=false}={}){
    const groups=[];
    for(const cell of cells.values()){
      const [count,sumLat,sumLng]=onlyAdditional?cell.extra:cell.all;
      if(!count||cell.bounds.north<bounds.south||cell.bounds.south>bounds.north)continue;
      const cellMid=(cell.bounds.west+cell.bounds.east)/2;
      const pad=(cell.bounds.east-cell.bounds.west)/2;
      if(!visibleLongitude({...bounds,west:bounds.west-pad,east:bounds.east+pad},cellMid))continue;
      groups.push({state:cell.state,bounds:cell.bounds,count,lat:sumLat/count,lng:sumLng/count});
    }
    return groups;
  }
  return {count:rows.length,query,overview,get(id){const i=ids.get(id);return i===undefined?undefined:expandLodging(rows[i],meta);}};
}

export async function loadLodgingIndex() {
  const response=await fetch('./data/national-lodging.json');
  if(!response.ok)throw Error('National lodging data unavailable');
  return createLodgingIndex(await response.json());
}
