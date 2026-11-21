import {distanceMiles,isLodgingKind} from './logic.js';
import {usRegionAt} from './us-geography.js';

const categories = {
  toilets: 'Mapped restroom', restaurant: 'Restaurant', bar: 'Bar', pub: 'Pub',
  beer: 'Pub', biergarten: 'Beer garden', cafe: 'Café', fast_food: 'Fast food',
  food_court: 'Food hall', nightclub: 'Nightclub', ice_cream: 'Ice cream shop',
  bakery: 'Bakery', fuel: 'Gas station', rest_area: 'Rest area',
  services: 'Highway service area', library: 'Library', convenience: 'Convenience store',
  supermarket: 'Supermarket', grocery: 'Grocery store', mall: 'Shopping mall',
  department_store: 'Department store', community_centre: 'Community center',
  visitor_centre: 'Visitor center', visitor_center: 'Visitor center',
  museum: 'Museum', railway_station: 'Rail station', bus_station: 'Bus station', ferry_terminal: 'Ferry terminal',
  campground: 'Campground', camp_site: 'Campground', campsite: 'Campground',
  picnic_site: 'Picnic area', park: 'Park', hotel: 'Hotel', motel: 'Motel', inn: 'Inn', resort: 'Resort', aparthotel: 'Aparthotel',
  apartment_hotel: 'Apartment hotel', resort_hotel: 'Resort hotel', extended_stay_hotel: 'Extended-stay hotel', motor_inn: 'Motor inn',
  cinema: 'Cinema', theatre: 'Theater', stadium: 'Stadium', railway_station: 'Railway station',
  caravan_site: 'RV park', marketplace: 'Market', arts_centre: 'Arts center', sports_hall: 'Sports hall',
  sports_centre: 'Sports center', fitness_centre: 'Fitness center', theme_park: 'Theme park', zoo: 'Zoo',
  pharmacy: 'Pharmacy', chemist: 'Pharmacy', ice_rink: 'Ice rink', hostel: 'Hostel', guest_house: 'Guesthouse',
  shower: 'Mapped shower', showers: 'Mapped shower', post_office: 'Post office', town_hall: 'Town hall',
  courthouse: 'Courthouse', public_building: 'Public building', bookshop: 'Bookstore', books: 'Bookstore',
  doityourself: 'Hardware store', garden_centre: 'Garden center', laundry: 'Laundromat'
};
const foodKinds = new Set(['restaurant','bar','pub','beer','biergarten','cafe','fast_food','food_court','nightclub','ice_cream','bakery']);
const featureIdInListing = /^(?:us|[a-z][a-z0-9-]*)-poi-(-?\d+)$/;

export function venueCategory(kind) { return categories[kind]; }

export function venueKind(properties = {}) {
  return [properties.subclass, properties.class, properties.tourism].find(kind => Object.hasOwn(categories, kind)) || null;
}

function textValue(...values) {
  return values.find(value => typeof value === 'string' && value.trim())?.trim() || '';
}

function featureId(value) {
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return value;
  return Number.isSafeInteger(value) ? String(value) : null;
}

export function placeFromFeature(feature) {
  if (feature?.geometry?.type !== 'Point' || !Array.isArray(feature.geometry.coordinates)) return null;
  const properties = feature.properties || {};
  const kind = venueKind(properties);
  if (!kind) return null;

  const [lng, lat] = feature.geometry.coordinates;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const region = usRegionAt(lat, lng);
  if (!region) return null;

  const category = categories[kind];
  const mappedName = textValue(properties['name:latin'], properties.name, properties['name:en'], properties.name_en);
  const restroom = kind === 'toilets';
  const lodging = isLodgingKind(kind);
  const locality = textValue(properties['addr:city']);
  const street = textValue(properties['addr:street']);
  const address = street ? [textValue(properties['addr:housenumber']),street].filter(Boolean).join(' ') : '';
  const latText = lat.toFixed(6), lngText = lng.toFixed(6);
  const sourceId = featureId(feature.id);
  // A tile feature ID belongs to the POI source layer. It is not a raw OSM node ID.
  const id = sourceId !== null ? 'us-poi-' + sourceId :
    ['us-point', kind, lat.toFixed(5), lng.toFixed(5), encodeURIComponent(mappedName.normalize('NFC'))].join('-');

  return {
    id, cityId: 'us', state: region.code, locality, name: mappedName || (restroom ? category : 'Mapped ' + category.toLowerCase()),
    nameKnown: Boolean(mappedName), category, neighborhood: locality ? locality + ', ' + region.code : region.name,
    address: address || latText + ', ' + lngText, addressKnown: Boolean(address), lat, lng,
    coordinateAccuracy: restroom ? 'restroom' : 'mapped-point', access: 'unknown',
    accessNote: restroom ? 'Check onsite for access, fees and availability.' : lodging ? 'Ask the front desk whether visitors may use a lobby restroom.' : 'Ask staff about bathroom access and any purchase requirement.',
    bathroomConfirmed: restroom, lodging, accessible: null, changingTable: null,
    showers: kind === 'shower' || kind === 'showers' || (!lodging && properties.shower === 'yes') ? true : null, purchaseLikely: foodKinds.has(kind),
    priority: restroom ? 40 : 60, evidenceType: 'vector-poi', sourceFeatureId: sourceId, dynamicListing: true,
    note: restroom ? 'A restroom is mapped here. Public access, opening hours and accessibility are unverified.' :
      'This location may have a bathroom. Check with the operator before relying on it.',
    checkedLabel: 'Community map data · access unverified',
    sources: [
      {label: 'Inspect this mapped location', url: 'https://www.openstreetmap.org/?mlat=' + latText + '&mlon=' + lngText + '#map=19/' + latText + '/' + lngText},
      {label: 'Map data provider', url: 'https://openfreemap.org/'}
    ]
  };
}

function sourceIdOf(place) {
  return featureId(place.sourceFeatureId) ?? featureIdInListing.exec(place.id)?.[1] ?? null;
}

function nameKey(place) {
  // Generic labels can't distinguish neighboring facilities such as paired restrooms.
  if (place.nameKnown === false || place.name === 'Mapped restroom' || !place.name) return null;
  return place.name.normalize('NFKD').toLowerCase().replace(/\p{Mark}/gu, '').replace(/[^\p{Letter}\p{Number}]+/gu, ' ').trim() || null;
}

export function createVenueMatcher(existing = []) {
  const ids = new Map(), sourceIds = new Map(), names = new Map(), unnamed = new Map();

  function alias(id, place) {
    if (!id || !place) return;
    ids.set(id, place);
    const sourceId = featureIdInListing.exec(id)?.[1];
    if (sourceId !== undefined) sourceIds.set(sourceId, place);
  }
  function appendBucket(index, key, place) {
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(place);
  }

  function add(place) {
    alias(place.id,place);
    const sourceId = sourceIdOf(place);
    if (sourceId !== null && !sourceIds.has(sourceId)) sourceIds.set(sourceId, place);
    const name = nameKey(place);
    if (!Number.isFinite(place.lat)) return;
    if (name) appendBucket(names, name + '|' + Math.floor(place.lat * 100), place);
    else appendBucket(unnamed, place.category + '|' + Math.floor(place.lat * 1000), place);
  }
  function byId(id) {
    return ids.get(id) || sourceIds.get(featureIdInListing.exec(id)?.[1]);
  }
  function find(place) {
    if (!place) return undefined;
    const sameFeature = byId(place.id) || sourceIds.get(sourceIdOf(place));
    if (sameFeature) return sameFeature;
    const name = nameKey(place);
    if (!Number.isFinite(place.lat)) return undefined;
    if (!name) {
      const latitudeBand = Math.floor(place.lat * 1000);
      for (let band = latitudeBand - 1; band <= latitudeBand + 1; band++) {
        const nearby = unnamed.get(place.category + '|' + band) || [];
        const match = nearby.find(other =>
          other.evidenceType !== place.evidenceType && distanceMiles(other,place) <= 2 / 1609.344);
        if (match) return match;
      }
      return undefined;
    }
    const latitudeBand = Math.floor(place.lat * 100);
    const roadside = ['Rest area','Highway service area','Gas station'].includes(place.category);
    let closest, closestMiles = Infinity;
    for (let band = latitudeBand - 1; band <= latitudeBand + 1; band++) {
      for (const other of names.get(name + '|' + band) || []) {
        if ((other.category === 'Mapped restroom') !== (place.category === 'Mapped restroom')) continue;
        // Preserve nearby branches and stops on opposite sides of a divided highway.
        const sameSource = other.evidenceType && other.evidenceType === place.evidenceType;
        const limit = sameSource ? 2 / 1609.344 : roadside ? .012 : .028;
        const miles = distanceMiles(other, place);
        if (miles < limit && miles < closestMiles) { closest = other; closestMiles = miles; }
      }
    }
    return closest;
  }

  existing.forEach(add);
  return {add, alias, byId, find};
}

export function mergeVenuePlaces(existing, candidates) {
  const matcher = createVenueMatcher(existing);
  const additions = [];
  for (const place of candidates) {
    if (!place || matcher.find(place)) continue;
    additions.push(place);
    matcher.add(place);
  }
  return additions;
}

// Persist only the points the user bookmarked. Storage can be unavailable in private browsing.
let savedDb, legacyDb;
function openVenuesDB(name, create) {
  return new Promise(resolve => {
    try {
      if (!globalThis.indexedDB) return resolve(null);
      const request = globalThis.indexedDB.open(name, 1);
      request.onupgradeneeded = () => {
        if (create) request.result.createObjectStore('venues', {keyPath: 'id'});
        else request.transaction.abort(); // First V4 install, no V3 cache to read.
      };
      request.onblocked = request.onerror = () => resolve(null);
      request.onsuccess = () => resolve(request.result);
    } catch { resolve(null); }
  });
}
function bookmarksDB() {
  return savedDb ??= openVenuesDB('in-a-pinch-v4-bookmarks', true);
}
async function readIds(db, ids) {
  if (!db || !ids.length) return [];
  try {
    const store = db.transaction('venues', 'readonly').objectStore('venues');
    const rows = await Promise.all(ids.map(id => new Promise(resolve => {
      const r = store.get(id);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => resolve(null);
    })));
    return rows.filter(Boolean);
  } catch { return []; }
}
export async function getCachedPlaces(ids) {
  const keys = [...new Set(ids)].filter(id => typeof id === 'string');
  const places = await readIds(await bookmarksDB(), keys);
  const found = new Set(places.map(place => place.id));
  const legacyIds = keys.filter(id => !found.has(id) && !id.startsWith('us-') && id.includes('-poi-'));
  if (legacyIds.length) {
    legacyDb ??= openVenuesDB('in-a-pinch-v3-venue-cache', false);
    places.push(...await readIds(await legacyDb, legacyIds));
  }
  return places;
}
async function updateBookmarks(values, method) {
  if (!values.length) return true;
  try {
    const db = await bookmarksDB();
    if (!db) return false;
    return await new Promise(resolve => {
      const tx = db.transaction('venues', 'readwrite');
      const store = tx.objectStore('venues');
      tx.oncomplete = () => resolve(true);
      tx.onerror = tx.onabort = () => resolve(false);
      for (const value of values) store[method](value);
    });
  } catch { return false; }
}
export function saveVenues(places) { return updateBookmarks(places, 'put'); }
export function deleteCachedPlaces(ids) { return updateBookmarks(ids, 'delete'); }
