// Community-mapped place points provide supplementary labels. A point cannot
// establish a boundary. The caller supplies the authoritative municipal lookup.
import {distanceMiles} from './logic.js';

const SOURCES = new WeakMap();
const classes = new Set(['neighbourhood','neighborhood','quarter','suburb']);
const normalizedName = value => value.normalize('NFKC').trim().toLocaleLowerCase('en-US');

export function attachPlaceLabels(map, readFeatures) {
  SOURCES.set(map, readFeatures);
  return () => {if(SOURCES.get(map)===readFeatures)SOURCES.delete(map);};
}

export async function getMapNeighborhood(map, center, zoom, resolveAt) {
  const read = SOURCES.get(map);
  if (!read || !center || zoom < 14 || !Number.isFinite(zoom) || typeof resolveAt !== 'function') return null;
  const lat = center.lat, lng = center.lng;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  // Large suburban point labels can be miles apart. Never extend their names
  // across that gap or across adjacent city boundaries.
  const maxMeters = zoom < 15 ? 650 : zoom < 16 ? 520 : 420;
  const byName = new Map();
  let features;
  try { features=read(); } catch { return null; }
  for (const feature of features || []) {
    const p=feature.properties;
    if (!p || !classes.has(p.class) || feature.geometry?.type!=='Point') continue;
    const name=[p['name:en'],p['name:latin'],p.name].find(x=>typeof x==='string' && x.trim());
    if (!name) continue;
    const [x,y]=feature.geometry.coordinates || [];
    if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(y)>90) continue;
    const candidate={name:name.trim(),lat:y,lng:((x+180)%360+360)%360-180,className:p.class};
    const meters=distanceMiles(center,candidate)*1609.344;
    if (meters>maxMeters) continue;
    const key=normalizedName(name);
    if (!byName.has(key) || meters<byName.get(key).meters) byName.set(key,{...candidate,meters});
  }
  const [nearest,second]=[...byName.values()].sort((a,b)=>a.meters-b.meters);
  if (!nearest || second && second.meters-nearest.meters<Math.max(90,nearest.meters*.5)) return null;
  try {
    const [municipal,anchor]=await Promise.all([
      resolveAt(lat,((lng+180)%360+360)%360-180),resolveAt(nearest.lat,nearest.lng)
    ]);
    if (typeof municipal!=='string' || !municipal || municipal!==anchor || SOURCES.get(map)!==read) return null;
    if (map.getCenter && (distanceMiles(center,map.getCenter())>0.0001 || map.getZoom()!==zoom)) return null;
    return {name:nearest.name,lat:nearest.lat,lng:nearest.lng,className:nearest.className,source:'OpenStreetMap place label',approximate:true};
  } catch {return null;}
}
