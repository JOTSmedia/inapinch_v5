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

// Aggregate the actual filtered results in screen space. Even a national view
// with tens of thousands of points only creates a few dozen interactive pins.
export function markerGroups(places, map, facilityFor) {
  const buckets = new Map();
  const center = map.getCenter().lng;
  const zoom = map.getZoom();
  // Use the normal location pin at street level; dense city blocks use Leaflet clustering.
  const group = zoom < 13 || (zoom < 17 && places.length > 1500);
  const cell = zoom < 8 ? 64 : 48;
  for (const place of places) {
    const facility = facilityFor?.(place);
    const lng = place.lng + 360 * Math.round((center - place.lng) / 360);
    const pixel = map.project([place.lat, lng], zoom);
    const key = group ? Math.floor(pixel.x / cell) + '/' + Math.floor(pixel.y / cell) : place.id;
    let item = buckets.get(key);
    if (!item) {
      item = {place, facility, mix:{}, count:0, sumLat:0, sumLng:0, south:place.lat, north:place.lat, west:lng, east:lng};
      buckets.set(key, item);
    }
    if(facility)item.mix[facility]=(item.mix[facility]||0)+1;
    if(item.facility !== facility)item.facility='mixed';
    item.count++;
    item.sumLat += place.lat;
    item.sumLng += lng;
    item.south = Math.min(item.south, place.lat);
    item.north = Math.max(item.north, place.lat);
    item.west = Math.min(item.west, lng);
    item.east = Math.max(item.east, lng);
  }
  return buckets.values();
}
