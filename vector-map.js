import {buildMapStyle,cartographicPalette,mapPatterns} from './cartography.js';
import {getAreaTheme} from './area-sidebar.js';
import {attachPlaceLabels} from './map-labels.js';
import {addStreetMap} from './street-map.js';
import {attachKeyWestWater} from './key-west-water.js';

function rasterFilter(color, mode) {
  const [r,g,b]=color.slice(1).match(/../g).map(c=>parseInt(c,16)/255);
  const max=Math.max(r,g,b), spread=max-Math.min(r,g,b);
  const phase=!spread ? 0 : max===r ? (g-b)/spread : max===g ? (b-r)/spread+2 : (r-g)/spread+4;
  const angle=Math.round(phase*60-50);
  return mode==='city' ? 'grayscale(.85) sepia(.32) saturate(1.25) hue-rotate('+angle+'deg)' :
    'grayscale(1) invert(.96) contrast(1.22) brightness(.88) sepia(.8) saturate(1.65) hue-rotate('+angle+'deg)';
}

function paintChanges(gl, oldStyle, nextStyle) {
  const oldLayers=new Map(oldStyle.layers.map(layer=>[layer.id,layer]));
  for(const layer of nextStyle.layers){
    const previous=oldLayers.get(layer.id).paint;
    for(const [prop,value] of Object.entries(layer.paint)){
      const prior=previous[prop];
      if(prior===value || Array.isArray(value) && JSON.stringify(prior)===JSON.stringify(value)) continue;
      gl.setPaintProperty(layer.id,prop,value);
    }
  }
}

export function addVectorMap(map, L, city, status) {
  let theme=getAreaTheme(city) || city;
  let mode=document.body.dataset.mapStyle || 'wireframe';
  let applied=buildMapStyle(theme,mode), wanted=applied;
  let layer, gl, raster, timer, frame, detachLabels, detachWater, disposed=false, fallback=false, lastLabelView='';
  let labelCache;
  let imageStyle, imageData;
  function patternImages(){
    if(!imageData)imageData=mapPatterns(theme,mode);
    return imageData;
  }
  function registerPatterns(){
    if(!gl.hasImage || !gl.addImage || imageStyle===wanted)return;
    for(const [id,pixels] of Object.entries(patternImages())){
      if(gl.hasImage(id))gl.updateImage(id,pixels);
      else gl.addImage(id,pixels,{pixelRatio:1});
    }
    imageStyle=wanted;
  }
  function missingPattern(event){
    if(disposed || fallback || !event.id.startsWith('atlas-'))return;
    const pixels=patternImages()[event.id];
    if(pixels && !gl.hasImage(event.id))gl.addImage(event.id,pixels,{pixelRatio:1});
  }
  function surfaceColors(){
    const p=cartographicPalette(theme,mode);
    const root=document.documentElement.style;
    root.setProperty('--cartographic-bg',p.background);
    root.setProperty('--atlas-raster-filter',rasterFilter(p.arterial,mode));
    root.setProperty('--atlas-raster-tint',p.background);
    if(fallback){
      map.getPane('tilePane')?.style.setProperty('filter','var(--atlas-raster-filter)');
      map.getContainer().style.setProperty('background-color','var(--atlas-raster-tint)','important');
    }
  }
  function repaint(){
    frame=null;
    if(disposed || fallback || !gl) return;
    // Wait for style initialization. In-flight map tile loads never cause a
    // camera reset; the next style.load or idle applies the newest theme.
    if(!gl.getLayer('background'))return;
    registerPatterns();
    if(applied===wanted)return;
    paintChanges(gl,applied,wanted);
    applied=wanted;
  }
  function update(event){
    if(disposed)return;
    const next=event.type==='areathemechange' ? event.detail || theme : theme;
    const nextMode=event.type==='mapstylechange' && ['wireframe','city'].includes(event.detail) ? event.detail : document.body.dataset.mapStyle || 'wireframe';
    if(next===theme && nextMode===mode)return;
    theme=next || theme;
    mode=nextMode;
    surfaceColors();
    if(!fallback){
      imageData=null;
      wanted=buildMapStyle(theme,mode);
      if(frame==null)frame=requestAnimationFrame(repaint);
    }
  }
  function rasterize(){
    if(disposed || fallback)return raster;
    fallback=true;clearTimeout(timer);detachLabels?.();detachWater?.();detachWater=null;
    if(layer && map.hasLayer(layer))map.removeLayer(layer);
    document.body.dataset.mapRenderer='raster';
    surfaceColors();
    raster=addStreetMap(map,L,status);
    return raster;
  }
  function moving(){lastLabelView='';labelCache=undefined;}
  function onIdle(){
    if(disposed || fallback)return;
    repaint();
    if(!gl.getSource('openmaptiles') || !gl.isSourceLoaded('openmaptiles'))return;
    clearTimeout(timer);status.hidden=true;
    const center=map.getCenter(), zoom=map.getZoom();
    const key=[center.lat,center.lng,zoom].join('/');
    if(zoom>=14 && key!==lastLabelView){
      lastLabelView=key;labelCache=undefined;
      map.fire('placelabelsready');
    }
  }
  document.addEventListener('areathemechange',update);
  document.addEventListener('mapstylechange',update);
  map.on('movestart',moving);
  map.once('unload',()=>{
    disposed=true;
    clearTimeout(timer);
    if(frame!=null)cancelAnimationFrame(frame);
    document.removeEventListener('areathemechange',update);
    document.removeEventListener('mapstylechange',update);
    detachLabels?.();
    detachWater?.();
    map.off('movestart',moving);
  });
  surfaceColors();
  if(!window.maplibregl || !L.maplibreGL)return rasterize();
  try{
    layer=L.maplibreGL({style:applied,interactive:false,attributionControl:false,padding:.1}).addTo(map);
    gl=layer.getMaplibreMap();
    document.body.dataset.mapRenderer='vector';
    detachWater=attachKeyWestWater(gl,map);
    detachLabels=attachPlaceLabels(map,()=>{
      if(disposed || fallback || !gl.getSource('openmaptiles') || !gl.isSourceLoaded('openmaptiles'))return [];
      return labelCache ??= gl.querySourceFeatures('openmaptiles',{sourceLayer:'place'});
    });
    gl.on('idle',onIdle);
    gl.on('styleimagemissing',missingPattern);
    gl.on('style.load',repaint);
    gl.on('webglcontextlost',rasterize);
    timer=setTimeout(()=>{if(!disposed && !gl.isSourceLoaded('openmaptiles'))rasterize();},15000);
    return layer;
  }catch{return rasterize();}
}
