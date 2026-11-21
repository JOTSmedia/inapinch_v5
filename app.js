import {loadHotelContext,mergeLodgingEvidence} from './hotel-context.js';
import {renderPlaceSheet, detailAreaLabel, detailCategoryIcon, symbol} from './place-detail.js';
import {escapeHTML as e, distanceMiles, scheduleStatus, filterPlaces, directionsURL, isFoodVenue, isLodging, isRoadside, businessListingURL, shouldLocateOnStart, preferredMapStyle} from './logic.js';
import {initCityGuide, applyCity, routeURL, writeRouteURL} from './city-guide.js';
import {addVectorMap} from './vector-map.js';
import {placeFromFeature, createVenueMatcher, getCachedPlaces, saveVenues, deleteCachedPlaces} from './venue-data.js';
import {createViewportDiscovery} from './us-viewport.js';
import {usRegionAt, usRegionsInBounds, usRegions} from './us-geography.js';
import {resolveMapArea} from './area-geography.js';
import {cityGuideExtent, stateExtent} from './city-extents.js';
import {getAreaTheme, presentMapArea, presentAreaCounts} from './area-sidebar.js';
import {getMapNeighborhood} from './map-labels.js';
import {loadNationalIndex} from './national-index.js';
import {loadVenueAtlas, atlasBuckets} from './national-venues.js';
import {bindMapTip, commonFacilities, facilityLabels, groupMapIcon, venueMapIcon} from './map-symbols.js';
import {mapBounds, intersects, pointFilter, markerGroups, groupDetailPins, streetClusterRadius} from './atlas-view.js';
import {chooseStackedStops} from './stacked-stops.js';
import {addStreetMap} from './street-map.js';
import {attachAerialImagery} from './aerial-imagery.js';
import {attachMapTooltips} from './map-tooltips.js';
import {stateExtent as regionBoundsForRow} from './city-extents.js';
import {attachAreaContour} from './area-contour.js';
import {attachMapInstruments} from './map-instruments.js';
import {attachStateSelection} from './state-selection.js';
import {initMobileHud} from './mobile-hud.js';
import {createOcean} from './ocean.js';
import {initRatings,ratingSummaryHTML,ratingPanelHTML,getRating} from './ratings.js';

const $ = id => document.getElementById(id);
const icon = (name, cls='') => {
  const shapes = {
    shower:'<path d="M4 21V7a4 4 0 0 1 8 0v1m-3 4a4 4 0 0 1 8 0Zm1 4-1 2m5-2-1 2m5-2-1 2"/>',
    phone:'<path d="M5 3h4l2 5-3 2a14 14 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2A18 18 0 0 1 3 5a2 2 0 0 1 2-2Z"/>',
    fuel:'<path d="M4 21V5a1 1 0 0 1 1-1h8v17M3 21h12M5 7h6v5H5zm8 6h2c2 0 1 5 3 5 1 0 2-1 2-3v-5l-4-4"/>',
    bookmark:'<path d="M6 4h12v17l-6-4-6 4z"/>',
    drive:'<path d="m3 13 2-6h14l2 6v5H3zm0 0h18M5 18v2m14-2v2m-13-5h2m8 0h2"/>',
    pin:'<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    walk:'<circle cx="14" cy="4" r="2"/><path d="m7 11 4-4 4 3 4 1M10 16l-3 6m5-10-2 4 5 2 2 4M11 7l1 5"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    share:'<path d="M12 16V3m-5 5 5-5 5 5M5 14v7h14v-7"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
    access:'<circle cx="12" cy="4" r="2"/><path d="M11 8v6h6l3 6M11 10l5 1M8 11a6 6 0 1 0 7 9"/>',
    close:'<path d="m6 6 12 12M6 18 18 6"/>',
    source:'<path d="M14 3h7v7m-1-6-10 10M10 4H4v16h16v-6"/>',
    toilet:'<path d="M5 3h6v8H5zM5 11h15c0 5-3 7-7 7H9c-3 0-4-3-4-7Zm5 7v3h6v-4M18 8v3"/>',
  };
  return `<svg class="ui-icon ${cls}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes[name] || shapes.pin}</svg>`;
};

function renderFacilityKey() {
  const key=$('facility-key-items');
  if(key)key.innerHTML=Object.entries(facilityLabels).map(([kind,label])=>
    `<span class="facility-key" data-facility="${kind}"><span class="facility-key-icon">${symbol(kind)}</span><span>${label}</span></span>`
  ).join('');
}
function clusterKind() {
  if(filters.has('lodging'))return 'bed';
  if(filters.has('showers'))return 'shower';
  if(filters.has('confirmed'))return 'toilet';
  if(filters.has('roadside'))return 'fuel';
  return 'mixed';
}
let places = [];
let city;
let cityGuide;
let cityRevision=0;
let positionAccuracy=0;
let resultRanks=new Map();
let placeIndex=new Map();
let visibleLimit=60;
let nationalIndex;
let venueAtlas;
let catalogRequest;
let catalogFailed=false;
let areaTargets=[];
const DETAIL_ATLAS_ZOOM=9;
let indexRequest;
let currentGuide = [];
let viewport;
let discovery;
let refreshTimer;
let activeArea;
let detailGeography;
let hotelJob;
let resetRegion;
let firstFocus;
let cameraReady = false;
let cameraFlying = false;
let cameraApplying = false;
let fittedIdentity = null;
let atlasLayer;
let pendingSpot;
let navigating = 0;
let panRevision = 0;
const guides = new Map();
const savedPlaces = new Map();
const converted = new WeakMap();
let mapObserver;
let meta = {};
let map;
let markerLayer;
let userMarker;
let userCircle;
let position = null;
let selectedId = null;
let savedOnly = false;
let locating = false;
let filters = new Set();
let markers = new Map();
let view = 'map';
let toastTimeout;
let lastDetailTrigger;
let resultOrigin;
let mobileHud;
let saved = new Set();
try {
  const value = JSON.parse(localStorage.getItem('in-a-pinch:saved') || '[]');
  if (Array.isArray(value)) saved = new Set(value.filter(x => typeof x === 'string').slice(0,500));
} catch { /* The map also works when browser storage is unavailable. */ }

function toast(message) {
  $('toast').textContent = message;
  $('toast').classList.add('visible');
  $('toast').hidden = false;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => { $('toast').classList.remove('visible'); $('toast').hidden = true; }, 4300);
}

function guideFor(place) {
  return cityGuide?.cities.find(c=>c.id===place.cityId) || city;
}
const accessLabel = p => ({public:'Free & public',paid:'Admission required',customers:'Purchase likely',unknown:'Check access'})[p.access] || 'Check access';
const accessClass = p => p.access === 'public' ? 'free' : p.access === 'paid' ? 'paid' : 'unknown';
const shortDistance = p => {
  if (!position) return '';
  const mi = distanceMiles(position,p);
  return mi < .1 ? `${Math.max(20,Math.round(mi*5280/20)*20)} ft` : `${mi < 10 ? mi.toFixed(1) : Math.round(mi).toLocaleString()} mi`;
};

function getResults() {
  const results = filterPlaces(savedOnly ? [...savedPlaces.values()] : places,{query:$('search-input').value,filters,savedOnly,saved});
  const sort = $('sort-select').value;
  if (sort === 'name') results.sort((a,b) => a.name.localeCompare(b.name));
  else if (sort === 'rating') results.sort((a,b) => (getRating(b.id).myRating ?? 0)-(getRating(a.id).myRating ?? 0) || a.name.localeCompare(b.name));
  else if (sort === 'distance' && position) results.sort((a,b) => distanceMiles(position,a)-distanceMiles(position,b));
  else results.sort((a,b) => (a.access === 'public' ? 0:1)-(b.access === 'public' ? 0:1) || (a.priority ?? 50)-(b.priority ?? 50) || a.name.localeCompare(b.name));
  return results;
}

const compactMapTotal=new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1});
function setMapCount(count,fullLabel,shortLabel){
  const full=$('map-count'),compact=$('map-count-compact');
  if(full)full.textContent=count.toLocaleString()+' '+fullLabel;
  if(compact)compact.textContent=compactMapTotal.format(count)+' '+shortLabel;
}

function render() {
  placeIndex=new Map([...savedPlaces, ...places.map(p=>[p.id,p])]);
  if(resultOrigin && !placeIndex.has(selectedId))placeIndex.set(selectedId,resultOrigin.place);
  const areaCells = overviewCells();
  const results = areaCells.length ? [] : getResults();
  resultRanks=new Map(results.map((p,i)=>[p.id,i+1]));
  $('result-count').textContent = `${results.length.toLocaleString()} ${results.length === 1 ? 'mapped stop' : 'mapped stops'}`;
  setMapCount(results.length,savedOnly?'saved':'in view',savedOnly?'saved':results.length===1?'stop':'stops');
  if ($('total-count')) $('total-count').textContent = `${places.length} mapped stops`;
  document.querySelectorAll('#filters [data-filter]').forEach(button => {
    const active = button.dataset.filter === 'all' ? filters.size === 0 : filters.has(button.dataset.filter);
    button.classList.toggle('active',active);
    button.setAttribute('aria-pressed',String(active));
  });
  if ($('saved-btn')) {
    $('saved-btn').classList.toggle('active',savedOnly);
    $('saved-btn').setAttribute('aria-pressed',String(savedOnly));
    $('saved-btn').setAttribute('aria-label',`${savedOnly?'Show all places':'Show saved places'}${saved.size?` (${saved.size} saved)`:''}`);
    $('saved-btn').innerHTML = `${icon('bookmark')}${saved.size ? `<span class="saved-count">${saved.size}</span>`:''}`;
  }
  if (selectedId && !resultOrigin && !results.some(p => p.id === selectedId) && (!areaCells.length || !placeIndex.has(selectedId))) closeDetail(false);
  $('result-list').innerHTML = results.length ? results.slice(0,visibleLimit).map(p => {
    const status = scheduleStatus(p);
    return `<article class="result-card ${p.id === selectedId ? 'selected':''}" data-place="${e(p.id)}">
      <div class="card-topline"><span class="place-category"><span class="card-category-icon" data-facility="${placeIcon(p)}" aria-hidden="true">${symbol(placeIcon(p))}</span><b class="result-rank">${resultRanks.get(p.id)}</b>${e(p.category)} <span class="category-separator">·</span> ${e(p.neighborhood || p.locality || p.state || 'United States')}</span><button class="save-btn ${saved.has(p.id)?'is-saved':''}" data-save="${e(p.id)}" aria-label="${saved.has(p.id)?'Unsave':'Save'} ${e(p.name)}" aria-pressed="${saved.has(p.id)}">${icon('bookmark')}</button></div>
      <button class="card-main" data-select="${e(p.id)}" aria-label="View ${e(p.name)} details"><h3 class="place-name">${e(p.name)}</h3><p class="place-address">${e(p.address)}</p></button>
      <div class="card-tags"><span class="tag tag-${accessClass(p)}">${e(accessLabel(p))}</span>${p.bathroomConfirmed===false?'<span class="tag tag-unconfirmed">Bathroom unconfirmed</span>':''}${p.accessible === true ? `<span class="tag tag-accessible">${icon('access')}Accessible WC</span>`:''}</div>
      ${isFoodVenue(p)||isRoadside(p)||isLodging(p)?`<a class="business-listing-link" href="${e(businessListingURL(p,guideFor(p)))}" target="_blank" rel="noopener" aria-label="Find ${e(p.name)} on Google Maps">${icon('source')}View on Google Maps</a>`:''}
      ${p.showers===true?'<span class="tag tag-showers">Showers listed'+(p.showerCount?' · '+e(p.showerCount):'')+'</span>':''}
      ${ratingSummaryHTML(p.id)}
      <div class="card-bottom"><span class="hours-label status-${status.state}">${icon('clock')}${e(status.label)}</span>${position?`<span class="distance-label" title="STRAIGHT-LINE DISTANCE, NOT A WALKING ROUTE">${shortDistance(p)} away</span>`:`<button class="card-detail-link" data-select="${e(p.id)}" aria-label="More details about ${e(p.name)}">Details</button>`}</div>
    </article>`;
  }).join('')+(results.length>visibleLimit?`<button type="button" class="load-more-venues" data-more-venues>Show 60 more places <span>${Math.min(visibleLimit,results.length)} of ${results.length}</span></button>`:'') : `<div class="empty-state">${icon(savedOnly?'bookmark':'pin')}<h3>${savedOnly ? 'No saved stops match.' : !places.length && !filters.size && !$('search-input').value ? 'Stops in this area' : 'No matching stops'}</h3><p>${savedOnly ? 'Tap a bookmark on any bathroom to save it on this device. Saved places still follow your search and filters.' : filters.has('open') ? 'Only published restroom hours qualify. Unknown hours are excluded. Try removing a filter or search term.' : filters.has('accessible') ? 'This filter only includes specifically documented accessible restrooms. Other places may be accessible; their details are not confirmed.' : !places.length && !filters.size && !$('search-input').value ? e(areaMessage()) : 'Try another place name or clear a filter.'}</p><button class="secondary-action" data-clear>Show all bathrooms</button></div>`;
  const searchTerm=$('search-input').value.trim();
  if(searchTerm && !savedOnly){
    $('result-list').insertAdjacentHTML('afterbegin','<button type="button" class="destination-from-search" data-search-destinations>'+icon('pin')+'Find a city or state named “'+e(searchTerm)+'”</button>');
  }
  if(areaCells.length){renderAreaGroups(areaCells);}else{updateMarkers(results);}
  if(viewport)$('area-status').textContent=areaMessage();
  if ($('filter-note')) $('filter-note').textContent = areaCells.length ? 'Select an area to see individual stops.' : filters.has('open') ? `Published hours in each stop’s local time` : position ? 'Distances are straight-line estimates, not walking routes.' : 'Public facilities first. Tap a stop for access details.';
}

function pinIcon(place) {
  return venueMapIcon(window.L,place,placeIcon(place),accessLabel(place),selectedId===place.id);
}

function updateMarkers(results) {
  if (!map || !markerLayer) return;
  markerLayer.clearLayers();
  atlasLayer.clearLayers();
  markers.clear();
  const pins = [];
  const grouped=groupDetailPins(results.length,map.getZoom(),Boolean(window.L.markerClusterGroup));
  for (const group of markerGroups(results, map, placeIcon, grouped)) {
    const {count, place} = group;
    const latlng = [group.sumLat / count, group.sumLng / count];
    if (count > 1) {
      const heading=count.toLocaleString()+' stops';
      const label='Explore '+heading;
      const marker = window.L.marker(latlng,{
        icon:groupMapIcon(window.L,'atlas-cluster',count,group.facility || clusterKind(),group.mix,label),
        title:label.toUpperCase()
      });
      bindMapTip(marker,heading,'Explore these locations');
      marker.on('click', () => {
        if(map.getZoom()>=map.getMaxZoom() || (group.south===group.north && group.west===group.east)){
          chooseStackedStops(group.records,id=>openDetail(id,{fromMap:true}),marker.getElement(),accessLabel);
        }else {
          panRevision++;pendingSpot=null;
          cameraBounds(group, {maxZoom:Math.min(map.getMaxZoom(), map.getZoom() + 4), padding:[40,40]});
        }
      });
      marker.addTo(atlasLayer);
      continue;
    }
    const marker = window.L.marker(latlng, {facility:placeIcon(place),icon:pinIcon(place), title:place.name.toUpperCase(), alt:place.name, keyboard:true, riseOnHover:true, zIndexOffset:selectedId===place.id ? 500 : 0});
    bindMapTip(marker,place.name,facilityLabels[placeIcon(place)]+' · '+accessLabel(place));
    marker.on('click', () => openDetail(place.id, {fromMap:true}));
    pins.push(marker);
    markers.set(place.id, marker);
  }
  const target=grouped?atlasLayer:markerLayer;
  if (target.addLayers) target.addLayers(pins);
  else for (const pin of pins) target.addLayer(pin);
}

async function initializeMap() {
  if (!window.L) {
    $('map-status').hidden = false;
    $('map-status').textContent = 'The map could not load. All bathroom details and directions are available in the list.';
    setView('list');
    return;
  }
  const L = window.L;
  map = L.map('map',{zoomControl:false,minZoom:2,maxZoom:19,zoomSnap:.5,worldCopyJump:true,scrollWheelZoom:true,attributionControl:true});
  attachMapTooltips(map);
  attachAerialImagery(map,L);
  map.attributionControl.setPrefix(false);
  map.attributionControl.addAttribution('Map data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> · <a href="https://openfreemap.org/">OpenFreeMap</a> · <a href="https://openmaptiles.org/">OpenMapTiles</a>');
  L.control.zoom({position:'bottomright',zoomInTitle:'ZOOM IN',zoomOutTitle:'ZOOM OUT'}).addTo(map);
  L.control.scale({imperial:true,metric:false,position:'bottomleft',maxWidth:100}).addTo(map);
  homeView({animate:false});
  try { addVectorMap(map, L, city, $('map-status')); }
  catch { addStreetMap(map, L, $('map-status')); }
  attachStateSelection(map,L,code=>cityGuide?.selectState(code),()=>fittedIdentity?.level==='state'?fittedIdentity.state?.code:null);
  attachAreaContour(map,L,{initialTheme:getAreaTheme(city)});
  attachMapInstruments(map,L);
  markerLayer = L.markerClusterGroup ? L.markerClusterGroup({maxClusterRadius:streetClusterRadius,showCoverageOnHover:false,spiderfyOnMaxZoom:true,iconCreateFunction:cluster=>{
    const mix={};
    for(const marker of cluster.getAllChildMarkers()){
      const type=marker.options.facility;
      mix[type]=(mix[type]||0)+1;
    }
    const count=cluster.getChildCount(),heading=count.toLocaleString()+' stops';
    bindMapTip(cluster,heading,'Explore these locations');
    return groupMapIcon(L,'pin-cluster',count,clusterKind(),mix,'Explore '+heading,cluster);
  }}) : L.layerGroup();
  markerLayer.addTo(map);
  atlasLayer = L.layerGroup().addTo(map);
  function markUserNavigation(){
    panRevision++;pendingSpot=null;
    if(cameraFlying){cameraFlying=false;fittedIdentity=null;map.stop();}
  }
  map.on('dragstart',markUserNavigation);
  const canvas=map.getContainer();
  canvas.addEventListener('pointerdown',markUserNavigation,{passive:true});
  canvas.addEventListener('wheel',markUserNavigation,{passive:true});
  canvas.addEventListener('keydown',event=>{
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','='].includes(event.key))markUserNavigation();
  });
  map.on('placelabelsready',()=>{if(viewport)void refineNeighborhood(viewport);});
  map.on('movestart', beginMapMove);
  map.on('moveend resize', () => {
    clearTimeout(refreshTimer);
    refreshTimer=setTimeout(refreshViewport,120);
  });
  refreshViewport();
  mapObserver?.disconnect();
  const canvasElement=$('map');
  const credit=map.attributionControl.getContainer?.();
  mapObserver=new ResizeObserver(entries=>{
    for(const {target} of entries){
      if(target===canvasElement)map?.invalidateSize({pan:false});
      if(target===credit)$('app').style.setProperty('--map-credit-height',Math.ceil(credit.getBoundingClientRect().height)+'px');
    }
  });
  mapObserver.observe(canvasElement);
  if(credit)mapObserver.observe(credit);
}

function placeIcon(place) {
  return detailCategoryIcon(place);
}
function detailHTML(place,resolvedArea) {
  const context=hotelJob?.id===place.id?hotelJob.context:null;
  const hotel=context?{...place,onSiteDining:context.onSiteDining,onSiteFacilities:context.onSiteFacilities}:place;
  return renderPlaceSheet(hotel,{guide:guideFor(place),area:resolvedArea,distance:shortDistance(place),
    saved:saved.has(place.id),checkedLabel:meta.checkedLabel,ratings:ratingPanelHTML(place.id),nearbyDining:context?.nearbyDining,showOnMap:Boolean(resultOrigin && map)});
}

function renderDetails(place, resolvedArea) {
  if(place)$('detail-content').innerHTML=detailHTML(place,resolvedArea);
}

// Replace only the two late-loading sections, leaving ratings, buttons, and
// the scroll position intact while neighborhood POIs are read from disk.
function patchHotelSections(place) {
  const template=document.createElement('template');
  template.innerHTML=detailHTML(place,detailGeography?.area);
  const panel=$('detail-panel'),scroll=panel.scrollTop;
  for(const selector of ['[data-hotel-facilities]','[data-hotel-dining]']){
    const old=$('detail-content').querySelector(selector),fresh=template.content.querySelector(selector);
    if(!old||!fresh||old.innerHTML===fresh.innerHTML)continue;
    const focus=old.contains(document.activeElement)?document.activeElement:null;
    const anchors=[...old.querySelectorAll('details')];
    for(const details of anchors.filter(x=>x.open)){
      const prior=details.previousElementSibling?.previousElementSibling?.textContent;
      const corresponding=[...fresh.querySelectorAll('details')].find(x=>x.previousElementSibling?.previousElementSibling?.textContent===prior);
      if(corresponding)corresponding.open=true;
    }
    const href=focus?.getAttribute('href');
    old.replaceWith(fresh);
    if(focus){
      const next=href?[...fresh.querySelectorAll('a')].find(a=>a.getAttribute('href')===href):fresh.querySelector('summary');
      (next||$('detail-close')).focus({preventScroll:true});
    }
  }
  panel.scrollTop=scroll;
}

function enrichHotel(place) {
  if(!isLodging(place)){hotelJob=null;return;}
  const key=[place.id,place.hotelFootprintId,place.lat,place.lng,place.femaId,place.onSiteDining?.length].join('|');
  if(hotelJob?.key===key){hotelJob.place=place;return;}
  const job={id:place.id,key,place,context:null};hotelJob=job;
  void loadHotelContext(place,{
    getAtlas:async()=>{if(!venueAtlas)await startAtlas();return venueAtlas;},
    getPlaces:()=>places
  }).then(context=>{
    if(hotelJob!==job||selectedId!==job.id)return;
    job.context=context;patchHotelSections(job.place);
  }).catch(()=>{ /* The property and its published sources remain usable. */ });
}

// Resolve the pin separately from the camera. A venue near a border can sit
// in a different municipality from the center of a viewport.
function paintSelectedDetail(place) {
  if(!place || selectedId!==place.id)return;
  enrichHotel(place);
  const key=place.lat+','+place.lng;
  if(detailGeography?.key===key){
    renderDetails(place,detailGeography.area);
    return;
  }
  const job={key,area:null};
  detailGeography=job;
  renderDetails(place);
  void resolveMapArea(place.lat,place.lng,18).then(area=>{
    if(job!==detailGeography || !selectedId)return;
    const active=placeIndex.get(selectedId);
    if(!active || active.lat+','+active.lng!==key)return;
    job.area=area;
    const line=$('detail-content').querySelector('[data-detail-locality]');
    if(line){
      const label=detailAreaLabel(active,guideFor(active),area?.level==='outside'?null:area);
      line.textContent=label;line.hidden=!label;
    }
  }).catch(()=>{ /* The underlying venue keeps its own locality and coordinates. */ });
}
function rememberResult(place,trigger) {
  const list=$('result-list'),tray=list.closest('.sidebar'),card=trigger.closest('[data-place]');
  const box=card.getBoundingClientRect(),trayBox=tray.getBoundingClientRect();
  return {id:place.id,place,tray,list,action:trigger.closest('.card-detail-link')?'.card-detail-link':'.card-main',
    index:Array.from(list.querySelectorAll('[data-place]')).indexOf(card),limit:visibleLimit,
    trayTop:tray.scrollTop,listTop:list.scrollTop,rowTop:box.height?box.top-trayBox.top:null};
}

function returnToResult(origin,id) {
  const {tray,list}=origin;
  const rank=resultRanks.get(id) || resultRanks.get(origin.id) || 0;
  if(rank>visibleLimit || visibleLimit<origin.limit){visibleLimit=Math.max(rank,origin.limit);render();}
  const rows=Array.from(list.querySelectorAll('[data-place]'));
  const row=rows.find(r=>r.dataset.place===id || r.dataset.place===origin.id) ||
    rows[Math.min(origin.index,rows.length-1)];
  tray.scrollTop=origin.trayTop;list.scrollTop=origin.listTop;
  if(row && origin.rowTop!==null){
    const container=origin.listTop>0?list:tray;
    container.scrollTop+=row.getBoundingClientRect().top-tray.getBoundingClientRect().top-origin.rowTop;
  }
  (row?.querySelector(origin.action) || row?.querySelector('.card-main') || $('search-input')).focus({preventScroll:true});
}

function openDetail(id,{fromMap=false,fromLink=false,resultTrigger=null}={}) {
  const place=placeIndex.get(id);
  if(!place)return;
  if(resultTrigger && selectedId && !resultOrigin)closeDetail(false);
  lastDetailTrigger=resultTrigger || document.activeElement;
  resultOrigin=resultTrigger?rememberResult(place,resultTrigger):null;
  // A late startup GPS fix must not move the map while a chosen row is open.
  if(resultOrigin)panRevision++;
  const previous=selectedId;
  pendingSpot=null;
  selectedId=id;
  $('detail-panel').hidden=false;
  $('detail-panel').classList.add('is-open');
  $('detail-panel').setAttribute('aria-hidden','false');
  $('detail-panel').setAttribute('aria-labelledby','detail-title');
  $('app').classList.toggle('result-preview',Boolean(resultOrigin));
  $('app').classList.add('detail-open');
  paintSelectedDetail(place);
  if(fromMap)setView('map');
  document.querySelectorAll('.result-card').forEach(card=>card.classList.toggle('selected',card.dataset.place===id));
  for(const key of [previous,id]){const m=markers.get(key), p=placeIndex.get(key);if(m&&p){m.setIcon(pinIcon(p));m.setZIndexOffset(key===id?500:0);}}
  if(map && !fromMap && !resultOrigin){
    const zoom=Math.max(map.getZoom(),16);
    panRevision++;
    setView('map');
    cameraPoint(place.lat,place.lng,zoom,{animate:!fromLink,offsetX:window.innerWidth>1000?180:0});
  }
  if(!resultOrigin)writeRouteURL(spotURL(place,{keepDestination:true}));
  $('detail-panel').scrollTop=0;
  if(!fromLink)$('detail-close').focus({preventScroll:true});
}

function closeDetail(restoreFocus=true) {
  const previous=selectedId,origin=resultOrigin;
  resultOrigin=null;
  selectedId=null;
  detailGeography=null;hotelJob=null;
  $('detail-panel').hidden=true;
  $('detail-panel').classList.remove('is-open');
  $('detail-panel').setAttribute('aria-hidden','true');
  $('app').classList.remove('detail-open','result-preview');
  document.querySelectorAll('.result-card.selected').forEach(c=>c.classList.remove('selected'));
  if(markers.has(previous) && placeIndex.has(previous)){
    const marker=markers.get(previous);marker.setIcon(pinIcon(placeIndex.get(previous)));marker.setZIndexOffset(0);
  }
  if(origin)mobileHud?.sync();
  if(!origin && previous && routeURL().searchParams.get('spot')===previous){const url=routeURL();url.searchParams.delete('spot');url.searchParams.delete('near');writeRouteURL(url);}
  if(restoreFocus && origin)returnToResult(origin,previous);
  else if(restoreFocus && lastDetailTrigger?.isConnected)lastDetailTrigger.focus({preventScroll:true});
  lastDetailTrigger=null;
}

function toggleSaved(id) {
  const inDetail=$('detail-content').contains(document.activeElement);
  if(saved.has(id)){
    saved.delete(id);savedPlaces.delete(id);void deleteCachedPlaces([id]);
  }else{
    const place=placeIndex.get(id);
    if(!place)return;
    saved.add(id);savedPlaces.set(id,place);void saveVenues([place]);
  }
  let persisted=true;
  try{localStorage.setItem('in-a-pinch:saved',JSON.stringify([...saved]));}catch{persisted=false;}
  render();
  if(selectedId===id)paintSelectedDetail(placeIndex.get(id));
  const replacement=(inDetail?$('detail-content'):$('result-list')).querySelector(`[data-save="${CSS.escape(id)}"]`);
  if(replacement)replacement.focus({preventScroll:true});else $('saved-btn').focus({preventScroll:true});
  toast(saved.has(id)?persisted?'Saved on this device.':'Saved for this session. Browser storage is unavailable.':'Removed from your saved spots.');
}

function spotURL(place,{keepDestination=false}={}) {
  const url=routeURL();
  // The currently browsed destination can contain supplemental US records.
  // Closing an open pin should return to the same city, state or town.
  if(!keepDestination || !url.searchParams.has('city'))url.searchParams.set('city',place.cityId || 'us');
  url.searchParams.set('spot',place.id);
  url.searchParams.set('near',place.lat + ',' + place.lng);
  return url;
}

async function sharePlace(id) {
  const place=placeIndex.get(id);
  const url=location.protocol === 'file:' ? new URL(businessListingURL(place,guideFor(place))) : spotURL(place);
  try{
    if(navigator.share)await navigator.share({title:`${place.name.toUpperCase()} · IN A PINCH`,text:'WHEN YOU GOTTA GO, YOU GOTTA GO',url:url.href});
    else {await navigator.clipboard.writeText(url.href);toast('Bathroom link copied.');}
  }catch(error){
    if(error.name==='AbortError')return;
    toast(location.protocol === 'file:' ? 'Use the Google Maps link in the listing to share this stop.' : 'Copy the address from your browser to share this stop.');
  }
}

async function copyCoordinates(button) {
  const value=button.dataset.copyCoordinates;
  try{
    await navigator.clipboard.writeText(value);
    toast('Coordinates copied.');
  }catch{
    const range=document.createRange();
    const field=button.parentElement?.querySelector('[data-coordinate-value]');
    if(field){range.selectNodeContents(field);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);}
    toast('Map coordinates: '+value);
  }
}
function setView(next) {
  view=next;
  $('app').dataset.view=next;
  $('app').classList.toggle('view-list',next==='list');
  $('app').classList.toggle('view-map',next==='map');
  $('map-view-btn').classList.toggle('active',next==='map');
  $('list-view-btn').classList.toggle('active',next==='list');
  $('map-view-btn').setAttribute('aria-pressed',String(next==='map'));
  $('list-view-btn').setAttribute('aria-pressed',String(next==='list'));
  if(map)requestAnimationFrame(()=>map.invalidateSize({pan:false}));
}

function drawPosition({focus=false}={}) {
  if(!map||!position)return;
  if(userMarker)map.removeLayer(userMarker);
  if(userCircle)map.removeLayer(userCircle);
  userMarker=null;userCircle=null;
  if(!usRegionAt(position.lat,position.lng))return;
  userMarker=window.L.marker([position.lat,position.lng],{icon:window.L.divIcon({className:'user-location-marker',html:'<span class="user-location-halo"></span><span class="user-location-dot"></span>',iconSize:[24,24],iconAnchor:[12,12]}),title:'YOUR APPROXIMATE LOCATION',zIndexOffset:1500}).addTo(map);
  userMarker.bindTooltip('You are here',{direction:'top',offset:[0,-13]});
  userCircle=window.L.circle([position.lat,position.lng],{radius:Math.max(10,Math.min(positionAccuracy,2000)),color:'#40dceb',fillOpacity:.08,weight:1,interactive:false}).addTo(map);
  if(focus)cameraPoint(position.lat,position.lng,16);
}

function locate({auto=false}={}) {
  if(locating)return;
  if(!navigator.geolocation){
    $('location-status').textContent='Location unavailable. Pan the U.S. map or choose a destination.';
    return;
  }
  const revision=cityRevision, initialPan=panRevision;
  locating=true;$('locate-btn').disabled=true;$('locate-btn').setAttribute('aria-busy','true');
  $('location-status').textContent=auto?'Finding your city and nearby stops…':'Waiting for your location…';
  const finish=()=>{locating=false;$('locate-btn').disabled=false;$('locate-btn').removeAttribute('aria-busy');};
  navigator.geolocation.getCurrentPosition(async result=>{
    position={lat:result.coords.latitude,lng:result.coords.longitude};positionAccuracy=result.coords.accuracy;
    // A slow permission prompt must not override a city chosen in the meantime.
    if(auto&&(revision!==cityRevision||initialPan!==panRevision)){finish();render();drawPosition();return;}
    try{
      const region=usRegionAt(position.lat,position.lng);
      if(!region){
        $('location-status').textContent='Your location is outside the U.S. map. Choose a state or city to explore.';
        return;
      }
      const local=await resolveMapArea(position.lat,position.lng,16);
      if(revision!==cityRevision || initialPan!==panRevision)return;
      const guide=local.guideId || 'us';
      const prior=routeURL();
      const isSpecific=['state','place','spot','near'].some(key=>prior.searchParams.has(key));
      if(guide!==city.id || isSpecific || resetRegion){
        if(await cityGuide.select(guide,{push:!auto,preserveCamera:true})===false)return;
      }
      if(initialPan!==panRevision)return;
      const route=routeURL();
      route.searchParams.set('city',guide);
      for(const key of ['state','place','spot','near'])route.searchParams.delete(key);
      writeRouteURL(route,!auto);
      $('sort-select').value='distance';render();drawPosition({focus:true});
      $('location-status').textContent=`Near you · ${region.name} · accuracy about ${Math.max(1,Math.round(positionAccuracy*3.28084))} ft`;
    }catch{toast('Unable to load this location. Pan the map or choose a destination.');}
    finally{finish();}
  },error=>{
    finish();
    if(auto&&(revision!==cityRevision||initialPan!==panRevision))return;
    const message=error.code===1?'Location is off. Select a state on the map or search for a city.':error.code===3?'Location timed out. Choose a city, or tap Find near me to retry.':'Location couldn’t be found. You can still pan the U.S. map.';
    $('location-status').textContent=message;
    if($('sort-select').value==='distance')$('sort-select').value='recommended';
    if(!auto)toast(message);
  },{enableHighAccuracy:true,timeout:12000,maximumAge:120000});
}

function initMapStyle() {
  let remembered='wireframe';try{remembered=(localStorage.getItem('in-a-pinch:v5:map-style') || localStorage.getItem('in-a-pinch:v4:map-style') || localStorage.getItem('in-a-pinch:v3:map-style'))||remembered;}catch{}
  const picker=$('map-layer-picker');
  const summary=picker.querySelector('summary');
  function setStyle(value){
    const style=preferredMapStyle(value);document.body.dataset.mapStyle=style;
    const label={wireframe:'3D wireframe',city:'Daylight streets',satellite:'Aerial imagery'}[style];
    $('map-layer-name').textContent=label;summary.setAttribute('aria-label','Change map layer. Current layer: '+label);
    for(const button of document.querySelectorAll('[data-map-style-option]'))button.setAttribute('aria-pressed',String(button.dataset.mapStyleOption===style));
    try{localStorage.setItem('in-a-pinch:v5:map-style',style);}catch{}
    document.dispatchEvent(new CustomEvent('mapstylechange',{detail:style}));
  }
  setStyle(remembered);
  picker.querySelectorAll('[data-map-style-option]').forEach(button=>button.addEventListener('click',()=>{
    setStyle(button.dataset.mapStyleOption);picker.open=false;summary.focus({preventScroll:true});
  }));
  document.addEventListener('pointerdown',event=>{if(picker.open && !picker.contains(event.target))picker.open=false;});
  document.addEventListener('focusin',event=>{if(picker.open && !picker.contains(event.target))picker.open=false;});
  picker.addEventListener('keydown',event=>{
    if(event.key==='Escape' && picker.open){event.preventDefault();event.stopPropagation();picker.open=false;summary.focus();}
  });
}

function refreshResults() {
  if(viewport?.cells?.length)applyViewport(viewport);
  else render();
}
function clearFilters() {
  filters.clear();savedOnly=false;$('search-input').value='';closeDetail(false);refreshResults();
}

function bindEvents() {
  let queryRevision=0;
  $('search-input').addEventListener('input',()=>{queryRevision++;visibleLimit=60;refreshResults();});
  $('search-input').addEventListener('keydown',async event=>{
    const query=event.target.value.trim();
    if(event.key!=='Enter' || !query || !cityGuide)return;
    event.preventDefault();
    const results=getResults();
    const exact=results.find(place=>place.name.localeCompare(query,undefined,{sensitivity:'base'})===0);
    if(exact){openDetail(exact.id);return;}
    const started=++queryRevision, pan=panRevision, guide=cityRevision;
    const isCurrent=()=>started===queryRevision && pan===panRevision && guide===cityRevision && $('search-input').value.trim()===query;
    try{if(await cityGuide.findDestination?.(query,{isCurrent}))return;}
    catch{if(isCurrent() && !results.length)toast('The destination directory could not load. Try a state or city in the picker.');}
    if(isCurrent() && results.length===1 && placeIndex.has(results[0].id))openDetail(results[0].id);
  });
  $('filters').addEventListener('click',event=>{
    const button=event.target.closest('[data-filter]');if(!button)return;
    visibleLimit=60;const value=button.dataset.filter;
    if(value==='all')filters.clear();else{if(value==='free')filters.delete('purchase');if(value==='purchase')filters.delete('free');filters.has(value)?filters.delete(value):filters.add(value);}
    refreshResults();
  });
  $('sort-select').addEventListener('change',()=>{if($('sort-select').value==='distance'&&!position)locate();else render();});
  $('saved-btn')?.addEventListener('click',async()=>{savedOnly=!savedOnly;refreshResults();if(savedOnly){setView('list');await restoreSaved();render();}});
  $('locate-btn').addEventListener('click',locate);
  $('reset-map-btn').addEventListener('click',()=>{panRevision++;pendingSpot=null;closeDetail(false);setView('map');homeView();});
  $('map-view-btn').addEventListener('click',()=>setView('map'));
  $('list-view-btn').addEventListener('click',()=>setView('list'));
  $('detail-close').addEventListener('click',()=>closeDetail());
  $('about-btn').addEventListener('click',()=>{$('about-dialog').showModal();});
  $('about-close').addEventListener('click',()=>{$('about-dialog').close();});
  $('about-dialog').addEventListener('click',event=>{if(event.target===$('about-dialog')){const r=$('about-dialog').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)$('about-dialog').close();}});
  $('area-retry').addEventListener('click',()=>{if(!nationalIndex || nationalIndex.partial)void startIndex();if(!venueAtlas)void startAtlas();refreshViewport();});
  document.addEventListener('click',event=>{
    if(resultOrigin && event.target.matches?.('.workspace')){closeDetail();return;}
    const key=document.querySelector('.map-key[open]');
    if(key && !key.contains(event.target))key.open=false;
    if(event.target.closest('[data-national-overview]')){event.preventDefault();pendingSpot=null;panRevision++;setView('map');void cityGuide?.select('us').catch(()=>toast('Unable to open the atlas.'));return;}
    if(event.target.closest('button[data-city]'))pendingSpot=null;
    const areaButton=event.target.closest('[data-atlas-target]');
    if(areaButton){const area=areaTargets[Number(areaButton.dataset.atlasTarget)];if(area)focusArea(area);return;}
    if(event.target.closest('[data-search-destinations]')){cityGuide?.open({query:$('search-input').value.trim()});return;}
    if(event.target.closest('[data-more-venues]')){visibleLimit+=60;render();return;}
    if(event.target.closest('[data-discover-venues]')){setView('map');if(map)map.setZoom(Math.max(15.5,map.getZoom()));toast('Pan the map to see nearby stops.');return;}
    const saveButton=event.target.closest('[data-save]');if(saveButton){toggleSaved(saveButton.dataset.save);return;}
    if(event.target.closest('[data-show-on-map]') && resultOrigin && map){
      const place=placeIndex.get(selectedId) || resultOrigin.place;
      document.dispatchEvent(new Event('atlasboundsrequest'));
      closeDetail(false);setView('map');panRevision++;
      cameraPoint(place.lat,place.lng,Math.max(17,map.getZoom()));
      map.getContainer().focus({preventScroll:true});return;
    }
    const selectButton=event.target.closest('[data-select]');
    if(selectButton){openDetail(selectButton.dataset.select,{resultTrigger:selectButton});return;}
    if(event.target.closest('[data-jump-ratings]')){
      const stars=$('detail-content').querySelector('[data-rating-action="select"][tabindex="0"]');
      stars?.focus({preventScroll:true});stars?.scrollIntoView?.({block:'center',inline:'nearest'});return;
    }
    const copy=event.target.closest('[data-copy-coordinates]');if(copy){void copyCoordinates(copy);return;}
    const shareButton=event.target.closest('[data-share]');if(shareButton){sharePlace(shareButton.dataset.share);return;}
    if(event.target.closest('[data-clear]'))clearFilters();
    const card=event.target.closest('.result-card');
    if(card && !event.target.closest('button,a,input,select'))openDetail(card.dataset.place,{resultTrigger:card});
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'){
      const key=document.querySelector?.('.map-key[open]');
      if(key){key.open=false;key.querySelector('summary')?.focus();return;}
    }
    if(event.key==='Escape' && selectedId && !$('about-dialog').open && !$('cities-dialog').open)closeDetail();
    if(event.key==='/' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName) && !$('about-dialog').open && !$('cities-dialog').open){event.preventDefault();$('search-input').focus();}
  });
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&city){applyCity(city);render();if(selectedId)paintSelectedDetail(placeIndex.get(selectedId));}});
  setInterval(()=>{
    if(!city || document.hidden || $('result-list').contains(document.activeElement) || $('detail-panel').contains(document.activeElement))return;
    applyCity(city);render();if(selectedId)paintSelectedDetail(placeIndex.get(selectedId));
  },60000);
}


function beginMapMove() {
  // A pan/zoom initiated by the user releases the selected boundary's label.
  // Leaflet's own camera events also pass here during a programmatic fit.
  if(!cameraApplying && !cameraFlying)fittedIdentity=null;
  clearTimeout(refreshTimer);discovery?.cancel();viewport=null;
}

function destinationIdentity(destination) {
  if(destination.kind==='country')return {id:'us',level:'country',label:'United States',shortLabel:'United States',state:null};
  const state=usRegions.find(region=>region.code===destination.state);
  if(!state)return null;
  if(destination.kind==='state')return {id:state.code,level:'state',label:state.name,shortLabel:state.name,state};
  const name=destination.name;
  return {id:destination.id||destination.guideId,level:'city',state,city:name,guideId:destination.guideId||null,
    shortLabel:name,label:name+', '+state.code,county:destination.county||null};
}

function useCameraAnimation(animate) {
  return Boolean(animate && cameraReady && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

function prepareCamera(animate) {
  const motion=useCameraAnimation(animate);
  if(cameraReady){
    map.stop();
    // The list can hide the mobile map. Measure it again after revealing it
    // so the geographic extent is fitted to its current, visible canvas.
    const canvas=map.getContainer?.(), size=map.getSize?.();
    if(canvas?.clientWidth && canvas.clientHeight && size &&
       (size.x!==canvas.clientWidth || size.y!==canvas.clientHeight))map.invalidateSize({pan:false});
  }
  cameraReady=true;
  cameraFlying=motion;
  if(motion)map.once('moveend',()=>{cameraFlying=false;});
  return motion;
}

function cameraBounds(bounds,{animate=true,maxZoom=17,padding=[20,24],identity=null}={}) {
  if(!map || !bounds)return;
  const known=cameraReady;
  const motion=prepareCamera(animate);
  const center=(bounds.west+bounds.east)/2;
  const turn=known?360*Math.round((map.getCenter().lng-center)/360):0;
  const corners=[[bounds.south,bounds.west+turn],[bounds.north,bounds.east+turn]];
  const options={padding,maxZoom,animate:motion};
  const app=$('app');
  if(app?.dataset?.mobileHud && app.dataset.view==='map'){
    // Explicit navigation may begin in search or list view. Collapse the tray
    // synchronously so this single fit uses its final, measured footprint.
    if(app.dataset.hudTray==='open')document.dispatchEvent(new Event('atlasboundsrequest'));
    const frame=map.getContainer?.()?.getBoundingClientRect?.();
    if(frame?.width>0 && frame.height>0){
      const box=selector=>app.querySelector(selector)?.getBoundingClientRect();
      const overlaps=rect=>rect?.width>0 && rect.height>0 && rect.right>frame.left &&
        rect.left<frame.right && rect.top<frame.bottom && rect.bottom>frame.top;
      const bar=box('.map-topbar'),tray=box('.sidebar');
      let left=0,bottom=0;
      const top=overlaps(bar)?Math.max(0,bar.bottom-frame.top):0;
      if(overlaps(tray)){
        // Short landscape screens use a half-width drawer. The right side
        // stays open all the way to the bottom even when the drawer is tall.
        const rightRoom=frame.right-tray.right;
        if(frame.width>frame.height && rightRoom>=Math.max(140,frame.width*.38)){
          left=Math.max(0,tray.right-frame.left);
        }else bottom=Math.max(0,frame.bottom-tray.top);
      }
      const edges=(before,after,span,margin)=>{
        // Handle tiny split screens and keyboard transitions without giving
        // Leaflet zero or negative space for its getBoundsZoom calculation.
        const minimum=Math.min(32,span/3);
        const scale=Math.min(1,(span-minimum)/Math.max(1,before+after));
        const gap=Math.min(margin,Math.max(0,(span-(before+after)*scale-minimum)/2));
        return [Math.floor(before*scale+gap),Math.floor(after*scale+gap)];
      };
      const [x1,x2]=edges(left,0,frame.width,padding[0]);
      const [y1,y2]=edges(top,bottom,frame.height,padding[1]);
      options.paddingTopLeft=[x1,y1];
      options.paddingBottomRight=[x2,y2];
    }
  }
  fittedIdentity=identity;
  cameraApplying=true;
  try{
    if(motion)map.flyToBounds(corners,{...options,duration:1.25});
    else map.fitBounds(corners,options);
  }finally{cameraApplying=false;}
  // Selecting a different region with identical bounds may emit no move event.
  if(viewport && identity){viewport.identity=identity;describeViewport(viewport,identity);}
}

function cameraPoint(lat,lng,zoom,{animate=true,offsetX=0}={}) {
  if(!map)return;
  fittedIdentity=null;
  const known=cameraReady;
  const motion=prepareCamera(animate);
  const wrapped=known?lng+360*Math.round((map.getCenter().lng-lng)/360):lng;
  let target=[lat,wrapped];
  if(offsetX)target=map.unproject(map.project(target,zoom).add([offsetX,0]),zoom);
  if(motion)map.flyTo(target,zoom,{animate:true,duration:1.1});
  else map.setView(target,zoom,{animate:false});
}

function focusDestination(destination,{animate=true}={}) {
  if(!destination)return;
  const bounds=destination.bounds || (destination.kind==='state'?stateExtent(destination.state):null);
  if(!bounds)return;
  const identity=destinationIdentity(destination);
  resetRegion={...destination,name:identity?.shortLabel || destination.name,bounds};
  const reset=$('reset-map-btn');
  const description='Return to '+resetRegion.name;
  reset.title=description.toUpperCase();reset.setAttribute('aria-label',description);
  panRevision++;pendingSpot=null;
  setView(map?'map':'list');
  // A restored state/place was already framed when the Leaflet map was created.
  if(firstFocus===destination){firstFocus=null;return;}
  cameraBounds(bounds,{animate,identity});
}

function homeView({animate=true}={}) {
  if(!map || !city)return;
  if(resetRegion?.bounds)cameraBounds(resetRegion.bounds,{animate,identity:destinationIdentity(resetRegion)});
  else if(city.id==='us')cameraBounds({south:24.5,west:-124.8,north:49.5,east:-66.8},{animate,padding:[16,24],identity:destinationIdentity({kind:'country'})});
  else {
    const bounds=cityGuideExtent(city.id);
    if(bounds)cameraBounds(bounds,{animate,identity:destinationIdentity({kind:'city',state:city.state,name:city.name,guideId:city.id})});
    else cameraPoint(city.lat,city.lng,13,{animate});
  }
}

function startAtlas() {
  if(catalogRequest)return catalogRequest;
  catalogFailed=false;
  catalogRequest=loadVenueAtlas().then(catalog=>{
    venueAtlas=catalog;
    if(viewport){readAtlasArea(viewport);applyViewport(viewport);}
  }).catch(()=>{
    catalogFailed=true;catalogRequest=null;
    if(viewport)applyViewport(viewport);
  });
  return catalogRequest;
}

function readAtlasArea(area) {
  if(!venueAtlas || !area.regions.length)return;
  const summary=venueAtlas.overview(area.bounds,false);
  const dense=area.zoom<14 && summary.reduce((sum,cell)=>sum+cell.count,0)>12000;
  if(area.zoom<DETAIL_ATLAS_ZOOM || dense){
    area.cells=summary;
    return;
  }
  area.atlasLoading=true;
  void venueAtlas.query(area.bounds).then(result=>{
    if(viewport!==area)return;
    area.atlasPlaces=result.records;
    area.atlasFailed=result.partial;
  }).catch(()=>{area.atlasFailed=true;}).finally(()=>{
    if(viewport!==area)return;
    area.atlasLoading=false;
    applyViewport(area);
  });
}

function supplementalHotelCells(area) {
  if(!nationalIndex)return [];
  return area.additionalHotels ??= (nationalIndex.lodgingOverview?.(area.bounds,{onlyAdditional:true}) || []).map(cell=>({...cell,mix:{bed:cell.count}}));
}
function groupedView(area) {
  return Boolean(map && area?.cells?.length && !savedOnly && !$('search-input').value.trim()
    && (filters.size===0 || filters.size===1 && ['roadside','confirmed','lodging','purchase'].some(kind=>filters.has(kind))));
}
function overviewCells() {
  if(!groupedView(viewport))return [];
  if(filters.has('purchase'))return viewport.diningCells ??= venueAtlas.overview(viewport.bounds,'dining');
  if(filters.has('roadside'))return viewport.roadCells ??= venueAtlas.overview(viewport.bounds,'roadside');
  if(filters.has('confirmed'))return viewport.toiletCells ??= venueAtlas.overview(viewport.bounds,true);
  if(filters.has('lodging')){
    viewport.hotelCells ??= venueAtlas.overview(viewport.bounds,'lodging');
    return viewport.hotelCells.concat(supplementalHotelCells(viewport));
  }
  return viewport.cells.concat(supplementalHotelCells(viewport));
}

function focusArea(area) {
  if(area.kind==='state' && area.bounds){void cityGuide?.selectState(area.state);return;}
  pendingSpot=null;panRevision++;
  setView('map');
  cameraPoint(area.lat,area.lng,Math.min(14,Math.max(9,map.getZoom()+4)));
}

function renderAreaGroups(cells) {
  markerLayer.clearLayers();atlasLayer.clearLayers();markers.clear();
  const regions=new Map();
  for(const cell of cells){
    let region=regions.get(cell.state);
    if(!region){region={count:0,anchor:cell};regions.set(cell.state,region);}
    region.count+=cell.count;
    if(cell.count>region.anchor.count)region.anchor=cell;
  }
  const list=[...regions.entries()].sort((a,b)=>b[1].count-a[1].count);
  const noun=filters.has('confirmed')?'mapped restrooms':filters.has('roadside')?'gas & highway stops':filters.has('lodging')?'hotels & motels':filters.has('purchase')?'food & drink stops':'mapped stops';
  areaTargets=list.map(([state,r])=>({...r.anchor,name:viewport.regions.find(region=>region.code===state)?.name||state,kind:'state',bounds:regionBoundsForRow(state)}));
  $('result-count').textContent='Explore by area';
  const count=cells.reduce((sum,c)=>sum+c.count,0);
  $('total-count').textContent=count.toLocaleString()+' '+noun+' in these map areas';
  setMapCount(count,noun+' in these areas',count===1?'stop':'stops');
  const labels=new Map(viewport.regions.map(r=>[r.code,r.name]));
  $('result-list').innerHTML=list.map(([state,r],index)=>`<article class="result-card"><button type="button" class="card-main atlas-area-link" data-atlas-target="${index}"><span><strong class="place-name">${e(labels.get(state)||state)}</strong><span class="place-address">${r.count.toLocaleString()} ${noun} in these map areas</span></span><span aria-hidden="true">＋</span></button></article>`).join('');
  for(const group of atlasBuckets(cells,map)){
    const types=commonFacilities(group.mix).map(type=>facilityLabels[type]);
    const stateCode=map.getZoom()<=6.5 && fittedIdentity?.level!=='state' && group.states?.length===1?group.states[0]:null;
    const heading=group.count.toLocaleString()+' '+noun;
    const action=stateCode?'View '+(labels.get(stateCode)||stateCode)+' map':'Explore these locations';
    const label=[heading,...types,action].join(' · ');
    const marker=window.L.marker([group.lat,group.lng],{title:label.toUpperCase(),
      icon:groupMapIcon(window.L,'atlas-cluster',group.count,clusterKind(),group.mix,label)});
    bindMapTip(marker,heading,[...types,action].join(' · '));
    marker.on('click',()=>{
      if(stateCode)void cityGuide?.selectState(stateCode);
      else if(group.bounds.east>group.bounds.west || group.bounds.north>group.bounds.south){
        panRevision++;pendingSpot=null;
        cameraBounds(group.bounds,{maxZoom:Math.min(14,map.getZoom()+4),padding:[34,34]});
      }else focusArea(group.anchor);
    });
    marker.addTo(atlasLayer);
  }
}

let indexFailed = false;
async function startIndex() {
  if(indexRequest)return indexRequest;
  indexFailed=false;
  indexRequest=loadNationalIndex().then(index=>{
    nationalIndex=index;
    if(index.partial){indexFailed=true;indexRequest=null;}
    if(viewport){viewport.indexRows=null;viewport.additionalHotels=null;viewport.coverageTotals=null;applyViewport(viewport);}
    else if(!map && city?.id==='us'){places=index.query({west:-180,east:180,south:-90,north:90});render();}
  }).catch(()=>{
    indexFailed=true;indexRequest=null;
    if(viewport)applyViewport(viewport);
  });
  return indexRequest;
}

function fetchGuide(id) {
  if(guides.has(id))return guides.get(id);
  const request=fetch('./data/'+id+'.json').then(async response=>{
    if(!response.ok)throw Error('Guide unavailable');
    const data=await response.json();
    if(!Array.isArray(data.locations))throw Error('Invalid guide');
    return data;
  });
  // Keep only a few recently requested guides in memory.
  guides.set(id,request);
  if(guides.size>4)guides.delete(guides.keys().next().value);
  request.catch(()=>{if(guides.get(id)===request)guides.delete(id);});
  return request;
}

function areaMessage() {
  if(!viewport)return 'Move the map to explore nearby stops.';
  if(!viewport.regions.length)return 'This view is outside U.S. coverage. Pan back or choose a state.';
  const state=viewport.detail.state;
  if(state==='error')return 'Neighborhood listings could not load. Retry to check this area.';
  if(state==='partial')return 'Some neighborhood listings could not load. Retry for the remaining area.';
  if(indexFailed || catalogFailed || viewport.guideFailed || viewport.atlasFailed)return 'Part of the directory could not load. Retry for more stops.';
  if(state==='loading')return 'Finding mapped places in this area…';
  if(!nationalIndex || !venueAtlas || viewport.atlasLoading || viewport.guidesLoading)return 'Loading the directory for this area…';
  if(filters.has('lodging'))return 'Hotels and motels. Check the front desk for lobby access or a room for a private shower.';
  if(filters.has('showers'))return 'Shows locations with documented showers. Check each listing for access and fees.';
  if(viewport.cells?.length)return !groupedView(viewport) ? 'Zoom in to search and filter all neighborhood listings.' : 'Select a map area to explore its stops.';
  if(state==='overview')return places.length ? 'Zoom in for restaurants, gas stations and individual restrooms.' : 'Zoom in to check this area for neighborhood stops.';
  return places.length ? 'Mapped stops in this view. Select a pin for access details.' : 'No stops are mapped in this view. Zoom out or try a nearby town.';
}

function applyViewport(area) {
  if(viewport!==area)return;
  const inView=pointFilter(area.bounds);
  // The featured guides carry the most detailed access facts. Keep their IDs
  // when a community map tile describes the same establishment.
  // All aliases in this view refer to the same record object, including when
  // an operator directory supplies additional details for a bundled guide pin.
  const records=area.guidePlaces.filter(inView).map(place=>({...place}));
  const matcher=createVenueMatcher(records);
  const add=place=>{
    if(!place)return;
    const match=matcher.find(place);
    if(!match){
      const record={...place};
      matcher.add(record);records.push(record);
      return;
    }
    matcher.alias(place.id,match);
    if(isLodging(place))mergeLodgingEvidence(match,place);
    if(place.roadside===true)match.roadside=true;
    const operator = place.evidenceType==='operator-directory';
    const officialShower = typeof place.showers==='boolean' && operator;
    const existingOfficial = match.showerSourceType==='operator-directory' ||
      (match.evidenceType==='operator-directory' && typeof match.showers==='boolean');
    if(officialShower || (place.showers===true && !existingOfficial)){
      match.showers=place.showers;
      if(officialShower)match.showerSourceType='operator-directory';
      if(place.showerCount!=null)match.showerCount=place.showerCount;
      if(place.accessibleShowerCount!=null)match.accessibleShowerCount=place.accessibleShowerCount;
      if(place.showerNote && (operator || !match.showerNote))match.showerNote=place.showerNote;
    }
    if(place.phone && !match.phone && place.evidenceType==='operator-directory')match.phone=place.phone;
    if(place.showers===true || place.roadside===true){
      const urls=new Set((match.sources||[]).map(source=>source.url));
      const additional=[];
      for(const source of place.sources||[]){
        if(!urls.has(source.url)){additional.push(source);urls.add(source.url);}
      }
      if(additional.length)match.sources=[...(match.sources||[]),...additional];
    }
  };
  if(nationalIndex && !groupedView(area) && !(area.cells.length && savedOnly)){
    const includeLodging=!area.cells.length || filters.has('lodging') || Boolean($('search-input').value.trim());
    if(area.indexRows && area.indexIncludesLodging!==undefined && area.indexIncludesLodging!==includeLodging)area.indexRows=null;
    area.indexIncludesLodging=includeLodging;
    area.indexRows ??= nationalIndex.query(area.bounds,{includeLodging});
    for(const place of area.indexRows)add(place);
  }
  for(const place of area.atlasPlaces)add(place);
  for(const feature of area.detail.features){
    if(!converted.has(feature))converted.set(feature,placeFromFeature(feature));
    add(converted.get(feature));
  }
  // Preserve the open detail during tile requests when its pin is still visible.
  const selected=placeIndex.get(selectedId);
  if(selected && inView(selected)){
    const available=matcher.find(selected);
    if(available)matcher.alias(selected.id,available);else add(selected);
    const promoted=matcher.byId(selected.id);
    if(promoted){
      const changed=['id','roadside','showers','showerCount','accessibleShowerCount','showerNote','phone','address','femaId','lodgingEvidence','hotelFootprintId','guestRoomNote','website']
        .some(field=>promoted[field]!==selected[field]) || promoted.sources?.length!==selected.sources?.length || promoted.onSiteDining?.length!==selected.onSiteDining?.length;
      if(resultOrigin)resultOrigin.place=promoted;
      if(promoted.id!==selectedId){selectedId=promoted.id;if(!resultOrigin)writeRouteURL(spotURL(promoted));}
      if(changed)paintSelectedDetail(promoted);
    }
  }
  places=records;
  for(const p of records)if(saved.has(p.id))savedPlaces.set(p.id,p);
  render();
  updateCoverageCounts(area,records);
  $('area-status').textContent=areaMessage();
  $('area-retry').hidden=!(indexFailed || catalogFailed || area.guideFailed || area.atlasFailed || ['error','partial'].includes(area.detail.state));
  if(pendingSpot){
    const match=matcher.byId(pendingSpot.id) || (pendingSpot.place && matcher.find(pendingSpot.place));
    if(match){openDetail(match.id,{fromLink:true});}
    else if(area.detail.state==='ready' && !area.guidesLoading && !area.atlasLoading && nationalIndex && venueAtlas){
      $('area-status').textContent='The shared listing is absent from this map update. Showing nearby stops.';
    }
  }
}

function updateCoverageCounts(area,records) {
  const partial=indexFailed || catalogFailed || area.guideFailed || area.atlasFailed || ['error','partial'].includes(area.detail.state);
  const loading=!venueAtlas || !nationalIndex || area.atlasLoading || area.guidesLoading || area.detail.state==='loading';
  const state=!area.regions.length?'outside':partial?'partial':loading?'loading':'ready';
  if(area.cells.length){
    area.toiletCells??=venueAtlas.overview(area.bounds,true);
    area.coverageTotals??={
      total:area.cells.concat(supplementalHotelCells(area)).reduce((n,c)=>n+c.count,0),
      restrooms:area.toiletCells.reduce((n,c)=>n+c.count,0)
    };
    presentAreaCounts({...area.coverageTotals,scope:'cells',state});
  }else{
    presentAreaCounts({total:records.length,restrooms:records.reduce((n,p)=>n+Number(p.bathroomConfirmed===true),0),scope:'view',state});
  }
}
function describeViewport(area,identity) {
  if(viewport!==area)return;
  if(fittedIdentity)identity=fittedIdentity;
  activeArea=identity;
  const guides=cityGuide?.cities || (city?.id!=='us'&&city?[city]:[]);
  presentMapArea(identity,guides,area.center);
}
async function refineNeighborhood(area) {
  const identity=area.identity;
  if(viewport!==area || fittedIdentity || !identity?.city || identity.neighborhood || area.zoom<14 || area.labelPending || area.mapLabel)return;
  area.labelPending=true;
  try{
    const key=a=>a?.state?.code && a.city ? [a.state.code,a.city,a.borough||''].join('|'):null;
    const name=await getMapNeighborhood(map,area.center,area.zoom,async (lat,lng)=>key(await resolveMapArea(lat,lng,18)));
    if(viewport!==area || !name || name.name.toLowerCase()===identity.city.toLowerCase())return;
    area.mapLabel=name;
    describeViewport(area,{...identity,level:'neighborhood',neighborhood:name.name,shortLabel:name.name,
      label:name.name+' · '+identity.label,approximate:true,neighborhoodSource:name.source});
  }finally{area.labelPending=false;}
}
function followMapArea(area) {
  if(fittedIdentity){area.identity=fittedIdentity;describeViewport(area,fittedIdentity);return;}
  const {center,zoom}=area;
  const state=usRegionAt(center.lat,center.lng);
  let fallback;
  if(!area.regions.length)fallback={level:'outside',label:'Outside the U.S.',state:null};
  else if(zoom<5 || !state)fallback={level:'country',label:'United States',state:null};
  else fallback={level:'state',state,label:state.name};
  // Show the new jurisdiction promptly without flashing between a city and
  // its state on each short drag once its boundaries are in memory.
  const timer=setTimeout(()=>describeViewport(area,fallback),150);
  if(!activeArea || activeArea.state?.code!==fallback.state?.code || fallback.level==='outside')describeViewport(area,fallback);
  if(!area.regions.length || zoom<5){clearTimeout(timer);describeViewport(area,fallback);return;}
  void resolveMapArea(center.lat,center.lng,zoom).then(identity=>{
    if(viewport!==area || fittedIdentity)return;
    area.identity=identity;
    describeViewport(area,identity);
    void refineNeighborhood(area);
  }).catch(()=>describeViewport(area,fallback)).finally(()=>clearTimeout(timer));
}
function refreshViewport() {
  if(!map)return;
  discovery?.cancel();
  const bounds=mapBounds(map), zoom=map.getZoom();
  const regionList=usRegionsInBounds(bounds);
  const guideList=(cityGuide?.cities || (city.id==='us'?[]:[city])).filter(g=>zoom>=9 && intersects(bounds,g.guideBounds));
  const more=guideList.filter(g=>g.id!==city.id);
  const area={
    bounds, zoom, center:map.getCenter(), regions:regionList, detail:{state:'overview',features:[]}, guidesLoading:more.length>0, guideFailed:false,
    atlasPlaces:[],cells:[],atlasLoading:false,atlasFailed:false,
    guidePlaces:guideList.some(g=>g.id===city.id) ? currentGuide : []
  };
  viewport=area;
  followMapArea(area);
  if(!resultOrigin)visibleLimit=60;
  readAtlasArea(area);
  if(more.length){
    void Promise.allSettled(more.map(g=>fetchGuide(g.id))).then(results=>{
      if(viewport!==area)return;
      for(const result of results){
        if(result.status==='fulfilled')area.guidePlaces=area.guidePlaces.concat(result.value.locations);
        else area.guideFailed=true;
      }
      area.guidesLoading=false;
      applyViewport(area);
    });
  }
  if(!regionList.length){applyViewport(area);return;}
  discovery ??= createViewportDiscovery({onUpdate:update=>{
    if(!viewport)return;
    viewport.detail=update;
    applyViewport(viewport);
  }});
  void discovery.load(bounds,zoom);
}

async function changeCity(next,{destination=null,preserveCamera=false}={}) {
  const revision=++navigating;
  const initial=!city;
  const routeAtStart=routeURL();
  if(!initial && !preserveCamera)panRevision++;
  closeDetail(false);
  if(routeAtStart.searchParams.has('spot'))writeRouteURL(routeAtStart);
  pendingSpot=null;
  clearTimeout(refreshTimer);discovery?.cancel();viewport=null;
  resetRegion=destination || null;
  city=next;cityRevision++;meta={};currentGuide=[];
  places=[];visibleLimit=60;
  filters.clear();savedOnly=false;$('search-input').value='';
  $('sort-select').value=position?'distance':'recommended';
  $('location-status').textContent='';
  applyCity(next);
  if(initial){
    firstFocus=destination;
    document.body.dataset.mapRenderer='pending';
    $('map-status').hidden=true;
    await initializeMap();
  }else if(!destination && !preserveCamera){
    setView(map?'map':'list');
    homeView();
  }
  if(revision!==navigating)return false;
  // Load guide records independently of the flight. A later pan or destination
  // keeps its camera; a late response only refreshes the current visible data.
  async function loadDirectory(){
    try{
      const data=next.id==='us'?{locations:[],meta:{}}:await fetchGuide(next.id);
      if(revision!==navigating)return;
      meta=data.meta || {};currentGuide=data.locations;
      if(!map){
        places=city.id==='us' && nationalIndex ? nationalIndex.query({west:-180,east:180,south:-90,north:90}) : currentGuide;
        render();
      }else if(!cameraFlying)refreshViewport();
      if($('checked-date'))$('checked-date').textContent=meta.checkedLabel || 'See each listing';
    }catch{
      if(revision===navigating)toast('The city guide could not load. The nationwide map is still available.');
    }
  }
  const loading=loadDirectory();
  if(initial)await loading;
  if(revision!==navigating)return false;
  drawPosition();
  return true;
}

let savedRequest;
async function restoreSaved() {
  if(savedRequest)return savedRequest;
  if(!nationalIndex)await startIndex();
  const missing=[...saved].filter(id=>!savedPlaces.has(id));
  if(!missing.length)return;
  savedRequest=(async()=>{
    const remember=p=>{if(p && saved.has(p.id))savedPlaces.set(p.id,p);};
    for(const p of await getCachedPlaces(missing))remember(p);
    for(const id of missing)remember(nationalIndex?.get(id));
    const legacy=new Set(missing.filter(id=>!savedPlaces.has(id) && !id.startsWith('us-')));
    if(legacy.size){
      // V1–V3 saved IDs did not contain a reliable guide prefix.
      const res=await fetch('./locations.json');
      if(!res.ok)return;
      const list=(await res.json()).locations;
      const needed=new Set(list.filter(p=>legacy.has(p.id)).map(p=>p.cityId));
      await Promise.all([...needed].map(async id=>{
        const data=await fetchGuide(id);
        for(const p of data.locations)if(legacy.has(p.id))remember(p);
      }));
    }
  })().catch(()=>toast('Some saved stops could not be loaded.')).finally(()=>{savedRequest=null;});
  return savedRequest;
}

async function restoreSpot() {
  const url=routeURL();
  const id=url.searchParams.get('spot');
  pendingSpot=null;
  if(!id)return;
  let known=placeIndex.get(id) || currentGuide.find(p=>p.id===id) || nationalIndex?.get(id);
  const raw=url.searchParams.get('near');
  const near=raw?.split(',').map(Number);
  if(!known && !near && city && city.id!=='us'){
    const revision=cityRevision, pan=panRevision;
    try{known=(await fetchGuide(city.id)).locations.find(p=>p.id===id);}
    catch{return;}
    if(revision!==cityRevision || pan!==panRevision || routeURL().searchParams.get('spot')!==id)return;
  }
  const point=known || (near?.length===2 && near.every(Number.isFinite) && Math.abs(near[0])<=90 && Math.abs(near[1])<=180 ? {lat:near[0],lng:near[1]} : null);
  if(!point)return;
  pendingSpot={id,place:known};
  if(map){
    cameraPoint(point.lat,point.lng,16,{animate:false});
    // Covers links targeting a point already centered in the current view.
    refreshViewport();
  }else if(known){placeIndex.set(id,known);openDetail(id,{fromLink:true});}
}

async function start() {
  const route=routeURL();
  const autoLocate=shouldLocateOnStart(route.href) && !route.searchParams.has('state') && !route.searchParams.has('place');
  renderFacilityKey();bindEvents();mobileHud=initMobileHud({setView,closeDetail});initMapStyle();createOcean();
  new ResizeObserver(()=>{
    const top=document.querySelector('.sidebar').getBoundingClientRect().bottom-document.querySelector('.workspace').getBoundingClientRect().top+12;
    $('app').style.setProperty('--mobile-controls-top',top+'px');
  }).observe(document.querySelector('.sidebar'));
  document.addEventListener('restorecityspot',restoreSpot);
  void startIndex();void startAtlas();
  try {
    cityGuide=await initCityGuide(changeCity,focusDestination);
    setView(map?'map':'list');
    restoreSpot();
    if(autoLocate)locate({auto:true});
    void initRatings(()=>{render();if(selectedId && placeIndex.has(selectedId))paintSelectedDetail(placeIndex.get(selectedId));},toast);
  } catch(error) {
    setView('list');$('result-count').textContent='The directory couldn’t load';
    $('result-list').innerHTML='<div class="empty-state"><h3>Directory unavailable</h3><p>Refresh to try loading the map again.</p><button class="secondary-action" id="reload-btn">Retry</button></div>';
    $('reload-btn').addEventListener('click',()=>location.reload());
    console.error(error);
  }
}
start();
