import {loadLodgingIndex} from './lodging-index.js';
// A latitude-sorted index avoids expanding every library record on a neighborhood pan.
const librariesFile = './data/national-libraries.json';

function westToEast(bounds, longitude) {
  if (Math.abs(bounds.east - bounds.west) >= 360) return true;
  const span = ((bounds.east - bounds.west) % 360 + 360) % 360;
  const offset = ((longitude - bounds.west) % 360 + 360) % 360;
  return offset <= span;
}

function expand({row, meta}) {
  const [id, name, street, city, state, zip, lat, lng, precision] = row;
  const approximate = precision === 'approximate';
  const locality = [city, state].filter(Boolean).join(', ');
  return {
    id, name, lat, lng, cityId:'us', locality:city, state, neighborhood:locality || 'United States',
    address:[street, locality, zip].filter(Boolean).join(', '),
    addressKnown:Boolean(street), category:'Public library',
    evidenceType:'imls-library', dynamicListing:true,
    coordinateAccuracy:approximate ? 'approximate' : 'mapped-point', priority:50, access:'unknown',
    bathroomConfirmed:false, accessible:null, changingTable:null, purchaseLikely:false,
    accessNote:'Restroom access and opening hours are unverified.',
    accessibilityNote:'Restroom accessibility is unverified.',
    note:approximate ? 'The federal survey gives an approximate pin for this branch. Check its street address and ask the branch about restroom access and hours.' :
      'This public library location was reported in the federal survey. Ask the branch about restroom access and hours.',
    checkedLabel:meta.surveyLabel || meta.title,
    searchTerms:'library libraries branch',
    sources:[{label:meta.title, url:meta.sourceUrl}]
  };
}

export function createNationalIndex(datasets) {
  const rows = [];
  const byId = new Map();
  for (const dataset of datasets) {
    for (const row of dataset.rows) {
      const entry = {row, meta:dataset.meta};
      if (byId.has(row[0])) throw new Error('Duplicate national directory ID: '+row[0]);
      rows.push(entry);
      byId.set(row[0],entry);
    }
  }
  rows.sort((a,b)=>a.row[6]-b.row[6]);
  function inBounds(bounds) {
    let from=0, end=rows.length;
    while (from<end) {
      const mid=Math.floor((from+end)/2);
      if (rows[mid].row[6] < bounds.south) from=mid+1;
      else end=mid;
    }
    const result=[];
    for (let i=from; i<rows.length && rows[i].row[6]<=bounds.north; i++) {
      if (westToEast(bounds, rows[i].row[7])) result.push(rows[i]);
    }
    return result;
  }
  return {
    count:rows.length,
    get(id){const entry=byId.get(id); return entry && expand(entry);},
    query(bounds){return inBounds(bounds).map(expand);},
    overview(bounds,zoom){
      const cells=new Map();
      const scale=2**Math.max(0,Math.floor(zoom)+2);
      for (const entry of inBounds(bounds)) {
        const lat=entry.row[6], lng=entry.row[7];
        const sin=Math.sin(lat*Math.PI/180);
        const x=Math.floor((lng+180)/360*scale);
        const y=Math.floor((.5-Math.log((1+sin)/(1-sin))/(4*Math.PI))*scale);
        const key=x+','+y;
        let cell=cells.get(key);
        if (!cell) {
          cell={lat:0,lng:0,count:0,bounds:{south:lat,west:lng,north:lat,east:lng},entry};
          cells.set(key,cell);
        }
        cell.lat+=lat; cell.lng+=lng; cell.count++;
        cell.bounds.south=Math.min(cell.bounds.south,lat);
        cell.bounds.west=Math.min(cell.bounds.west,lng);
        cell.bounds.north=Math.max(cell.bounds.north,lat);
        cell.bounds.east=Math.max(cell.bounds.east,lng);
      }
      return Array.from(cells.values(),({lat,lng,count,bounds,entry})=>({
        lat:lat/count,lng:lng/count,count,bounds,...(count===1 ? {place:expand(entry)} : {})
      }));
    }
  };
}

const travelDirectories = ['./data/travel-ta.json', './data/travel-loves.json', './data/travel-pilot.json', './data/travel-rest-areas.json'];

async function readDirectory(path) {
  const response=await fetch(path);
  if(!response.ok)throw Error('Directory unavailable: '+path);
  return response.json();
}

export async function loadNationalIndex() {
  const [lodgingResult,libraries,...directories]=await Promise.allSettled([loadLodgingIndex(), ...[librariesFile,...travelDirectories].map(readDirectory)]);
  const lodging=lodgingResult.status==='fulfilled'?lodgingResult.value:null;
  if(!lodging && libraries.status==='rejected' && directories.every(r=>r.status==='rejected'))throw Error('National directories unavailable');
  const library=createNationalIndex(libraries.status==='fulfilled'?[libraries.value]:[]);
  const stops=new Map();
  for(const result of directories){
    if(result.status!=='fulfilled')continue;
    for(const p of result.value.locations)stops.set(p.id,p);
  }
  return {
    count:library.count+stops.size+(lodging?.count||0),
    lodgingCount:lodging?.count||0,
    lodgingOverview(bounds,options){return lodging?.overview(bounds,options)||[];},
    partial:[lodgingResult,libraries,...directories].some(r=>r.status==='rejected'),
    get(id){return stops.get(id)||library.get(id)||lodging?.get(id);},
    query(bounds,{includeLodging=true}={}){
      const rows=[];
      for(const p of stops.values()){
        if(p.lat>=bounds.south && p.lat<=bounds.north && westToEast(bounds,p.lng))rows.push(p);
      }
      return rows.concat(library.query(bounds),includeLodging&&lodging?lodging.query(bounds):[]);
    }
  };
}
