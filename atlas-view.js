// Leaflet can report longitudes outside ±180 after crossing the date line.
export function mapBounds(map) {
  const b = map.getBounds();
  return {south:b.getSouth(), west:b.getWest(), north:b.getNorth(), east:b.getEast()};
}

function segments(west, east) {
  if (Math.abs(east - west) >= 360) return [[-180, 180]];
  const left = ((west + 180) % 360 + 360) % 360 - 180;
  const width = ((east - west) % 360 + 360) % 360;
  return left + width <= 180 ? [[left, left + width]] : [[left, 180], [-180, left + width - 360]];
}

export function intersects(a, b) {
  if (a.south > b.north || b.south > a.north) return false;
  const other = segments(b.west, b.east);
  return segments(a.west, a.east).some(([w, e]) => other.some(([x, y]) => w <= y && x <= e));
}

export function pointFilter(bounds) {
  const intervals = segments(bounds.west, bounds.east);
  return p => p.lat >= bounds.south && p.lat <= bounds.north &&
    intervals.some(([w, e]) => p.lng >= w && p.lng <= e);
}

// First put records into world-anchored grid cells. Reconcile adjacent cell
// centroids so two labels cannot straddle a grid line a few pixels apart.
export function screenGroups(records,map,radius,weightFor) {
  const zoom=map.getZoom(),center=map.getCenter().lng;
  const grid=new Map();
  const key=(x,y)=>x+'/'+y;
  const cellSize=radius;
  for(const record of records){
    const lng=record.lng+360*Math.round((center-record.lng)/360);
    const pixel=map.project([record.lat,lng],zoom);
    const id=key(Math.floor(pixel.x/cellSize),Math.floor(pixel.y/cellSize));
    let group=grid.get(id);
    if(!group){group={records:[],count:0,sumLat:0,sumLng:0};grid.set(id,group);}
    const weight=weightFor(record);
    group.count+=weight;group.sumLat+=record.lat*weight;group.sumLng+=lng*weight;
    group.records.push(record);
  }
  const active=new Map();
  const accepted=new Set();
  // Prioritize dense cell centers. Sorting the ties by world cell keeps the
  // positions independent of changes in list order (e.g. name vs distance).
  const ordered=[...grid].sort((a,b)=>b[1].count-a[1].count || a[0].localeCompare(b[0]));
  for(const [,group] of ordered){
    for(;;){
      const point=map.project([group.sumLat/group.count,group.sumLng/group.count],zoom);
      const col=Math.floor(point.x/radius),row=Math.floor(point.y/radius);
      let near=null,best=radius*radius;
      for(let x=col-1;x<=col+1;x++){
        for(let y=row-1;y<=row+1;y++){
          for(const other of active.get(key(x,y)) || []){
            const d=(other.x-point.x)**2+(other.y-point.y)**2;
            if(d<best){best=d;near=other;}
          }
        }
      }
      if(!near){
        const id=key(col,row);
        if(!active.has(id))active.set(id,new Set());
        active.get(id).add({x:point.x,y:point.y,id,group});accepted.add(group);break;
      }
      active.get(near.id).delete(near);accepted.delete(near.group);
      group.count+=near.group.count;group.sumLat+=near.group.sumLat;group.sumLng+=near.group.sumLng;
      // An unrestricted national filter can contain more rows than allowed
      // as positional arguments to Array.push.
      for(const record of near.group.records)group.records.push(record);
    }
  }
  return accepted;
}

export function streetClusterRadius(zoom) {
  if(zoom>=18)return 44;
  if(zoom>=16)return 48;
  return 58;
}
export function groupDetailPins(count,zoom,nativeCluster) {
  return !nativeCluster || zoom<13 || (zoom<17 && count>1500);
}

// Aggregate actual filtered stops in screen space. On detailed views the
// bundled marker cluster plugin handles short-range grouping and spiderfying.
export function markerGroups(places,map,facilityFor,grouped=groupDetailPins(places.length,map.getZoom(),true)) {
  const center=map.getCenter().lng,zoom=map.getZoom();
  const radius=zoom<8?76:zoom<13?61:streetClusterRadius(zoom);
  const groups=grouped?screenGroups(places,map,radius,()=>1):places.map(place=>({
    records:[place],count:1,sumLat:place.lat,sumLng:place.lng+360*Math.round((center-place.lng)/360)
  }));
  return Array.from(groups,group=>{
    const item={...group,place:group.records[0],facility:null,mix:{},
      south:Infinity,north:-Infinity,west:Infinity,east:-Infinity};
    for(const place of group.records){
      const facility=facilityFor?.(place);
      if(facility){item.mix[facility]=(item.mix[facility] || 0)+1;
        item.facility=item.facility && item.facility!==facility?'mixed':facility;}
      const lng=place.lng+360*Math.round((center-place.lng)/360);
      item.south=Math.min(item.south,place.lat);item.north=Math.max(item.north,place.lat);
      item.west=Math.min(item.west,lng);item.east=Math.max(item.east,lng);
    }
    return item;
  });
}
