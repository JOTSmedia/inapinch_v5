export function escapeHTML(value = '') {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

export function normalize(value = '') {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function distanceMiles(a, b) {
  const rad = Math.PI / 180;
  const dlat = (b.lat - a.lat) * rad;
  const dlng = (b.lng - a.lng) * rad;
  const s = Math.sin(dlat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dlng / 2) ** 2;
  return 3958.7613 * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(Math.max(0, 1 - s)));
}

export function scheduleStatus(place, now = new Date()) {
  if (place.hours?.scope !== 'restroom' || !place.hours?.schedule) return {state:'unknown', label:'Hours unconfirmed'};
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone:place.timezone || 'America/New_York', weekday:'short', hour:'2-digit', minute:'2-digit', hourCycle:'h23'
  }).formatToParts(now);
  const part = type => parts.find(p => p.type === type)?.value;
  const day = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(part('weekday'));
  const minute = Number(part('hour')) * 60 + Number(part('minute'));
  const schedule = place.hours.schedule;
  const intervals = schedule[day];
  if (!Array.isArray(intervals)) return {state:'unknown', label:'Hours unconfirmed'};
  let open = intervals.some(([start,end]) => end > start ? minute >= start && minute < end : minute >= start);
  const yesterday = schedule[(day + 6) % 7] || [];
  open ||= yesterday.some(([start,end]) => end < start && minute < end);
  return {state:open ? 'open' : 'closed', label:open ? 'Open by schedule' : 'Closed by schedule'};
}

export function filterPlaces(places, {query='', filters=new Set(), savedOnly=false, saved=new Set(), now=new Date()} = {}) {
  const terms = normalize(query).split(' ').filter(Boolean);
  return places.filter(place => {
    if (savedOnly && !saved.has(place.id)) return false;
    if (filters.has('showers') && place.showers !== true) return false;
    if (filters.has('roadside') && !isRoadside(place)) return false;
    if (filters.has('lodging') && !isLodging(place)) return false;
    if (filters.has('free') && place.access !== 'public') return false;
    if (filters.has('purchase') && !place.purchaseLikely && place.access !== 'customers') return false;
    if (filters.has('confirmed') && place.bathroomConfirmed !== true) return false;
    if (filters.has('accessible') && place.accessible !== true) return false;
    if (filters.has('open') && scheduleStatus(place, now).state !== 'open') return false;
    if (!terms.length) return true;
    const haystack = normalize([place.name,place.address,place.neighborhood,place.category,place.searchTerms,place.access === 'public' ? 'free public' : place.access].join(' '));
    return terms.every(t => haystack.includes(t));
  });
}

export function isRoadside(place) {
  return place.roadside === true || /gas station|fuel station|truck stop|travel cent(?:er|re)|rest area|rest stop|service area|service plaza|motorway services/i.test(place.category || '');
}

const hotelKinds = new Set(['hotel','motel','inn','resort','aparthotel','apartment_hotel','resort_hotel','extended_stay_hotel','motor_inn']);
export function isLodgingKind(kind) {
  return hotelKinds.has(kind);
}
export function isLodging(place) {
  if (place.lodging === true) return true;
  const kind = String(place.category || '').trim().toLowerCase().replace(/[ -]+/g,'_');
  return isLodgingKind(kind);
}

export function directionsURL(place) {
  const url = new URL('https://www.google.com/maps/dir/');
  url.search = new URLSearchParams({api:'1',destination:`${place.lat},${place.lng}`,travelmode:isRoadside(place)||isLodging(place)?'driving':'walking'}).toString();
  return url.href;
}

export function isFoodVenue(place) {
  return /restaurant|\bbar\b|\bpub\b|beer garden|café|cafe|food hall|fast food|nightclub/i.test(place.category || '') || place.purchaseLikely === true;
}
export function businessListingURL(place, city = {}) {
  const url = new URL('https://www.google.com/maps/search/');
  const coordinates = Number.isFinite(place.lat) && Number.isFinite(place.lng)
    ? place.lat.toFixed(5) + ',' + place.lng.toFixed(5) : '';
  const address = place.addressKnown === false ? coordinates : place.address;
  const guide = place.cityId === 'us' || (place.cityId && place.cityId !== city.id) ? {} : city;
  const query = place.nameKnown === false ? coordinates :
    [place.name, address, place.locality || guide.name, place.state || guide.state].filter(Boolean).join(', ');
  url.searchParams.set('api', '1');
  url.searchParams.set('query', query);
  if (place.googlePlaceId) url.searchParams.set('query_place_id', place.googlePlaceId);
  return url.href;
}
export function shouldLocateOnStart(href) {
  const params=new URL(href).searchParams;
  return !params.has('city') && !params.has('spot');
}
export function preferredMapStyle(value) {
  return value==='city' || value==='satellite' ? value : 'wireframe';
}
