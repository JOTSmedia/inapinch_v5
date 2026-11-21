// Bounds and land in assets/key-west-ocean-mask.svg share the exact extent of
// assets/key-west-map.json. Leaflet reprojects this overlay on pan and zoom.
const regionalEtchings = {wave:'reef',grid:'squares',soundings:'wharf',tideline:'tideway',
  relief:'front-range',strata:'canal',current:'batwing',section:'lattice',ripple:'fountain',axis:'radial',meander:'bayou'};
const coastBounds = [[24.53,-81.82],[24.59,-81.725]];
function coordinate(value, axes) {
  return Math.abs(value).toFixed(3) + '°' + (value < 0 ? axes[1] : axes[0]);
}

export function attachMapInstruments(map, L) {
  const readout = document.getElementById('map-edition-center');
  if (!readout || !map?.on || !map?.whenReady) return;
  const art = document.getElementById('map-surface-art');
  const etching = document.getElementById('map-edition-etch');
  const platePane = art && (map.getPane('mapSurface') || map.createPane('mapSurface'));
  if (platePane) {
    platePane.style.pointerEvents = 'none';
    platePane.style.zIndex = '225';
    platePane.append(art);
  }
  function alignFrame() {
    if (!art || !ready) return;
    const size = map.getSize();
    const origin = map.containerPointToLayerPoint([0,0]);
    L.DomUtil.setPosition(art, origin);
    art.style.width = size.x + 'px';
    art.style.height = size.y + 'px';
  }
  function engrave() {
    const chosen = document.body.dataset.mapMotif || 'survey';
    const symbol = document.getElementById('etch-'+chosen) ? chosen : regionalEtchings[chosen] || 'survey';
    etching?.setAttribute('href','#etch-'+symbol);
  }
  const stage = document.querySelector('.ocean-footage');
  const video = stage?.querySelector('video');
  let posterLayer, videoLayer, ready = false;
  function removeCoast() {
    if (!posterLayer) return;
    map.removeLayer(posterLayer);
    map.removeLayer(videoLayer);
    posterLayer = videoLayer = null;
    if (video) {
      video.classList.remove('leaflet-image-layer','leaflet-zoom-animated','key-west-sea-film');
      video.style.removeProperty('transform');
      video.style.removeProperty('width');
      video.style.removeProperty('height');
      video.style.removeProperty('opacity');
      stage.append(video);
    }
  }
  function updateCoast() {
    const surface = document.body.dataset;
    if (!ready || !video || !L?.imageOverlay || !L.videoOverlay) return;
    const show = surface.mapStyle !== 'satellite' && surface.city === 'key-west' &&
      (surface.mapRenderer === 'raster' || surface.waterSurface === 'coastline') &&
      map.getBounds().intersects(L.latLngBounds(coastBounds));
    if (!show) { removeCoast(); return; }
    if (posterLayer) return;
    const pane = map.getPane('keyWestSea') || map.createPane('keyWestSea');
    pane.classList.add('key-west-sea-pane');
    pane.style.zIndex = '215';
    pane.style.pointerEvents = 'none';
    pane.setAttribute('aria-hidden','true');
    const options = {pane:'keyWestSea',interactive:false};
    posterLayer = L.imageOverlay(video.poster, coastBounds, {...options, className:'key-west-sea-poster', alt:''}).addTo(map);
    videoLayer = L.videoOverlay(video, coastBounds, {...options, className:'key-west-sea-film',autoplay:false,muted:true,playsInline:true,loop:true}).addTo(map);
  }
  function update() {
    if (!ready) return;
    const center = map.getCenter();
    const longitude = ((center.lng + 180) % 360 + 360) % 360 - 180;
    readout.textContent = coordinate(center.lat,'NS') + '  ' + coordinate(longitude,'EW');
    updateCoast();
  }
  const events = ['areathemechange','citychange','keywestsurfacechange','mapstylechange'];
  function onTheme() { engrave(); updateCoast(); }
  for (const type of events) document.addEventListener(type, onTheme);
  const observer = new MutationObserver(updateCoast);
  observer.observe(document.body,{attributes:true,attributeFilter:['data-map-renderer','data-city']});
  map.on('move zoom resize',alignFrame);
  map.on('moveend',update);
  map.whenReady(() => {ready = true; engrave(); alignFrame(); update();});
  map.once('unload',() => {
    ready = false;
    observer.disconnect();
    map.off('move zoom resize',alignFrame);
    map.off('moveend',update);
    for (const type of events) document.removeEventListener(type,onTheme);
    removeCoast();
  });
}
