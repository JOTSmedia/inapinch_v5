// Read only the detailed POI tiles intersecting the settled map window. This
// path does not depend on a WebGL renderer, a city guide or an API credential.
import {decodeTile,pointToCoordinates} from './scripts/vector-poi.mjs';
import {venueKind} from './venue-data.js';
import {rememberWireTile} from './wire-world.js';

const DETAIL_ZOOM = 14;
const MIN_DETAIL_VIEW_ZOOM = 12;
const TILE_COUNT = 2 ** DETAIL_ZOOM;
const TILEJSON = 'https://tiles.openfreemap.org/planet';
const MAX_TILES_PER_VIEW = 64;
const VIEW_TIMEOUT_MS = 18000;
const CACHED_TILES = 160;
const CACHED_FEATURES = 40000;
const MAX_LATITUDE = 85.05112878;
const wrap = (n, size) => ((n % size) + size) % size;

function longitudeSpan(west, east) {
  const delta = east - west;
  if (Math.abs(delta) >= 360) return 360;
  return delta < 0 ? delta + 360 : delta;
}

function tileY(latitude) {
  const lat = Math.min(MAX_LATITUDE, Math.max(-MAX_LATITUDE, latitude));
  const value = (1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2;
  return Math.max(0, Math.min(TILE_COUNT - 1, Math.floor(value * TILE_COUNT)));
}

export function detailTiles(bounds, zoom) {
  if (!bounds || !Number.isFinite(zoom) || zoom < MIN_DETAIL_VIEW_ZOOM) return [];
  const {west, east, north, south} = bounds;
  if (![west, east, north, south].every(Number.isFinite) || north <= south ||
      south > MAX_LATITUDE || north < -MAX_LATITUDE) return [];
  // Leaflet can report an unwrapped longitude after dragging over the dateline.
  const left = wrap(west + 180, 360);
  const span = longitudeSpan(west, east);
  if (!span) return [];
  const minX = Math.floor(left / 360 * TILE_COUNT);
  const maxX = Math.floor((left + span) / 360 * TILE_COUNT);
  const minY = tileY(north), maxY = tileY(south);
  if ((maxX - minX + 1) * (maxY - minY + 1) > MAX_TILES_PER_VIEW) return [];
  const result = [];
  const centerX = (minX + maxX) / 2, centerY = (minY + maxY) / 2;
  for (let column = minX; column <= maxX; column++) {
    for (let y = minY; y <= maxY; y++) {
      const x = wrap(column, TILE_COUNT);
      result.push({x, y, key:DETAIL_ZOOM + '/' + x + '/' + y, distance:(column-centerX)**2 + (y-centerY)**2});
    }
  }
  return result.sort((a, b) => a.distance - b.distance);
}

function insideView(coordinates, bounds) {
  const [lng, lat] = coordinates;
  return lat >= bounds.south && lat <= bounds.north &&
    wrap(lng - bounds.west, 360) <= longitudeSpan(bounds.west, bounds.east) + 1e-9;
}

function parseVenues(bytes, tile) {
  const features = [];
  for (const point of decodeTile(bytes, 'poi').poi || []) {
    const kind = venueKind(point.properties);
    if (!kind || point.x == null || point.y == null) continue;
    const {lat, lng} = pointToCoordinates(point.x, point.y, DETAIL_ZOOM, tile.x, tile.y, point.extent);
    features.push({
      type:'Feature', id:point.id, properties:point.properties,
      geometry:{type:'Point', coordinates:[wrap(lng + 180, 360) - 180, lat]}
    });
  }
  return features;
}

async function request(fetchImpl, url, parent, read, timeLeft = 12000) {
  // Keep the timeout active through body consumption as well as headers.
  const controller = new AbortController();
  const stop = () => controller.abort();
  parent.addEventListener('abort', stop, {once:true});
  if (parent.aborted) stop();
  const timer = setTimeout(stop, Math.min(12000, timeLeft));
  try {
    const response = await fetchImpl(url, {signal:controller.signal, credentials:'omit'});
    if (!response.ok) throw Error('Venue data HTTP ' + response.status);
    return await read(response);
  } finally {
    clearTimeout(timer);
    parent.removeEventListener('abort', stop);
  }
}

export function createViewportDiscovery({onUpdate, includeFeature = () => true, fetchImpl = globalThis.fetch} = {}) {
  const cache = new Map();
  let featureCount = 0, current = null, template = null, templateDate = 0;

  function cacheTile(key, features) {
    if (features.length > CACHED_FEATURES) return;
    if (cache.has(key)) {
      featureCount -= cache.get(key).length;
      cache.delete(key);
    }
    cache.set(key, features);
    featureCount += features.length;
    while (cache.size > CACHED_TILES || featureCount > CACHED_FEATURES) {
      const oldest = cache.keys().next().value;
      featureCount -= cache.get(oldest).length;
      cache.delete(oldest);
    }
  }

  async function getTemplate(signal) {
    if (template && Date.now() - templateDate < 12 * 60 * 60 * 1000) return template;
    const meta = await request(fetchImpl, TILEJSON, signal, response => response.json());
    const path = meta.tiles?.find(url => typeof url === 'string' && url.startsWith('https://') &&
      ['{x}', '{y}', '{z}'].every(token => url.includes(token)));
    if (!path) throw Error('Missing vector tile template');
    if (!signal.aborted) {
      if (template && template !== path) {cache.clear(); featureCount = 0;}
      template = path;
      templateDate = Date.now();
    }
    return path;
  }

  function cancel() {
    current?.abort();
    current = null;
  }

  async function load(bounds, zoom) {
    cancel();
    const controller = new AbortController();
    const {signal} = controller;
    current = controller;
    const deadline = Date.now() + VIEW_TIMEOUT_MS;
    const tiles = detailTiles(bounds, zoom);
    const features = new Map(), missing = [];
    let completedTiles = 0, failedTiles = 0, notification = null;

    function snapshot(state) {
      return {state, features:[...features.values()], completedTiles, failedTiles, totalTiles:tiles.length};
    }

    function publish(state) {
      if (signal.aborted) return;
      const event = snapshot(state);
      onUpdate?.(event);
      return event;
    }

    function collect(points) {
      for (const feature of points) {
        const coordinates = feature.geometry.coordinates;
        if (!insideView(coordinates, bounds) || !includeFeature(feature)) continue;
        // Buffered copies from adjacent tiles resolve to the same world point.
        const key = [feature.id ?? '', feature.properties.subclass || feature.properties.class,
          feature.properties.name || '', coordinates[0].toFixed(5), coordinates[1].toFixed(5)].join('|');
        features.set(key, feature);
      }
      completedTiles++;
    }

    if (!tiles.length) return publish('overview');
    for (const tile of tiles) {
      if (!cache.has(tile.key)) {missing.push(tile); continue;}
      const cached = cache.get(tile.key);
      cache.delete(tile.key);
      cache.set(tile.key, cached);
      collect(cached);
    }
    if (!missing.length) return publish('ready');
    publish('loading');

    let tilePath;
    try {
      tilePath = await getTemplate(signal);
    } catch {
      failedTiles = missing.length;
      return publish(completedTiles ? 'partial' : 'error');
    }
    async function worker() {
      while (!signal.aborted && missing.length) {
        const timeLeft = deadline - Date.now();
        if (timeLeft <= 0) {
          failedTiles += missing.length;
          missing.length = 0;
          break;
        }
        const tile = missing.shift();
        const url = tilePath.replace('{z}', DETAIL_ZOOM).replace('{x}', tile.x).replace('{y}', tile.y);
        try {
          const bytes = await request(fetchImpl, url, signal, async response => {
            if (/text\/html|application\/json/i.test(response.headers.get('content-type') || ''))
              throw Error('Unexpected vector tile format');
            return new Uint8Array(await response.arrayBuffer());
          }, timeLeft);
          if (signal.aborted) return;
          rememberWireTile(tile,bytes);
          const points = parseVenues(bytes, tile);
          cacheTile(tile.key, points);
          collect(points);
        } catch {
          if (signal.aborted) return;
          failedTiles++;
        }
        // Dense tiles can contain thousands of venues. Coalesce partial updates
        // so list/marker rendering cannot starve the fetch workers.
        if (notification === null)
          notification = setTimeout(() => {notification = null; publish('loading');}, 400);
      }
    }
    try {
      await Promise.all(Array.from({length:Math.min(missing.length, 3)}, worker));
    } finally {
      clearTimeout(notification);
    }
    if (failedTiles && !signal.aborted) templateDate = 0; // refresh a potentially retired template on retry
    return publish(!failedTiles ? 'ready' : completedTiles ? 'partial' : 'error');
  }

  return {load, cancel};
}
