import {usRegions,usRegionAt,usRegionsInBounds,usRegionPolygons,usRegionView} from './us-geography.js';

export const STATE_SELECTION_MAX_ZOOM=6.5;
const paneName='stateSelection';
const dayColors=['#597d82','#81684b','#587454','#7d6885','#4b758c'];
const nightColors=['#87d3c9','#e4c283','#a8c783','#c1aed6','#8fbedf'];
const statesByName=[...usRegions].sort((a,b)=>a.name.localeCompare(b.name,'en'));
let outlines;

function sourceOutlines() {
  if(outlines)return outlines;
  outlines=statesByName.map(({code,name},i)=>{
    const parts=usRegionPolygons(code).map(rings=>{
      let west=Infinity,east=-Infinity,south=Infinity,north=-Infinity;
      const latlngs=rings.map(ring=>ring.map(([lng,lat])=>{
        west=Math.min(lng,west);east=Math.max(lng,east);
        south=Math.min(lat,south);north=Math.max(lat,north);
        return [lat,lng];
      }));
      return {west,east,south,north,latlngs};
    });
    return {code,name,colorIndex:i%nightColors.length,parts};
  });
  return outlines;
}

// Keep each Aleutian island on the visible copy of the world. Applying one
// longitude shift to *all* Alaska geometry can omit islands across the date line.
function visibleParts(state,bounds) {
  const parts=[];
  for(let i=0;i<state.parts.length;i++){
    const part=state.parts[i];
    if(part.south>bounds.north || part.north<bounds.south)continue;
    const first=Math.ceil((bounds.west-part.east)/360),last=Math.floor((bounds.east-part.west)/360);
    for(let world=first;world<=last;world++)parts.push({index:i,world,part});
  }
  return parts;
}

function leafCoordinates(parts) {
  return parts.map(({part,world})=>world===0 ? part.latlngs :
    part.latlngs.map(ring=>ring.map(([lat,lng])=>[lat,lng+world*360])));
}

export function attachStateSelection(map,L,onSelect,getFocusedState=()=>null) {
  // Browsers without a path renderer can still use the destination picker.
  if(!map?.createPane || !L?.polygon || !L.svg || typeof onSelect!=='function')return ()=>{};
  const renderer=L.svg({pane:paneName,padding:.1});
  if(!renderer)return ()=>{};
  const pane=map.getPane(paneName) || map.createPane(paneName);
  pane.style.zIndex='390'; // Above base tiles, below the ordinary overlay and marker panes.
  pane.setAttribute('role','group');
  pane.setAttribute('aria-label','Choose a state or territory. Use arrow keys to browse, then Enter to select.');
  const doc=map.getContainer().ownerDocument;
  const layers=new Map();
  let focusCode,clickTimer,disposed=false;

  function paint(item) {
    const day=doc.body?.dataset.mapStyle==='city';
    const color=(day?dayColors:nightColors)[item.state.colorIndex];
    const active=item.hovered || item.focused;
    item.layer.setStyle({
      color:active?(day?'#183e50':'#fff0ba'):day?'#48616a':'#bdcfd2',
      weight:active?2.4:1.1, opacity:active?.98:.66,
      fillColor:color,fillOpacity:active?.32:.105
    });
  }
  function repaint(){for(const item of layers.values())paint(item);}
  function cancelClick(){clearTimeout(clickTimer);clickTimer=undefined;}
  function isSelectable(code) {
    return !disposed && map.getZoom()<=STATE_SELECTION_MAX_ZOOM && getFocusedState()!==code && layers.has(code);
  }
  function activate(code){cancelClick();if(isSelectable(code))onSelect(code);}
  function setTabStop(code) {
    if(!layers.has(code))return;
    focusCode=code;
    for(const [key,item] of layers)item.layer.getElement()?.setAttribute('tabindex',key===code?'0':'-1');
  }
  function focusLabelPoint(state) {
    const center=map.getCenter(),bounds=map.getBounds(),anchor=usRegionView(state.code);
    const corrected=anchor.lng+360*Math.round((center.lng-anchor.lng)/360);
    if(bounds.contains([anchor.lat,corrected]))return [anchor.lat,corrected];
    // The keyboard focus can enter a small fragment of a much larger state.
    for(const {world,part} of layers.get(state.code).parts){
      for(const [lat,lng] of part.latlngs[0]){
        const point=[lat,lng+world*360];
        if(bounds.contains(point))return point;
      }
    }
    return center;
  }
  function keydown(event,state) {
    if(event.altKey || event.metaKey || event.ctrlKey)return;
    if(event.key==='Enter' || event.key===' '){
      event.preventDefault();event.stopPropagation();
      if(!event.repeat)activate(state.code);
      return;
    }
    const direction={ArrowRight:1,ArrowDown:1,ArrowLeft:-1,ArrowUp:-1}[event.key];
    if(!direction && event.key!=='Home' && event.key!=='End')return;
    event.preventDefault();event.stopPropagation();
    const choices=statesByName.filter(s=>layers.has(s.code));
    const index=choices.findIndex(s=>s.code===state.code);
    const next=event.key==='Home'?0:event.key==='End'?choices.length-1:(index+direction+choices.length)%choices.length;
    layers.get(choices[next].code)?.layer.getElement()?.focus({preventScroll:true});
  }
  function add(state,parts,key) {
    const layer=L.polygon(leafCoordinates(parts),{pane:paneName,renderer,fill:true,stroke:true,
      interactive:true,bubblingMouseEvents:true,smoothFactor:.8,className:'state-selection-path'});
    const item={state,parts,key,layer,hovered:false,focused:false};
    layers.set(state.code,item);
    paint(item);
    layer.addTo(map);
    layer.bindTooltip(state.name,{direction:'auto',sticky:true,opacity:1});
    layer.on('mouseover',()=>{item.hovered=true;paint(item);});
    layer.on('mouseout',()=>{item.hovered=false;paint(item);});
    layer.on('click',event=>{
      // Preserve Leaflet double-click zoom, drag and touch gestures. Markers
      // occupy their own higher pane and never dispatch clicks on this layer.
      cancelClick();
      if((event.originalEvent?.detail || 0)>1 || map.dragging?.moving?.())return;
      clickTimer=setTimeout(()=>activate(state.code),320);
    });
    const node=layer.getElement();
    if(!node)return;
    node.setAttribute('role','button');
    node.setAttribute('aria-label','View '+state.name+' map');
    node.setAttribute('aria-keyshortcuts','Enter Space ArrowLeft ArrowRight');
    node.setAttribute('tabindex','-1');
    node.addEventListener('focus',()=>{
      setTabStop(state.code);item.focused=true;paint(item);layer.openTooltip(focusLabelPoint(state));
    });
    node.addEventListener('blur',()=>{item.focused=false;paint(item);layer.closeTooltip();});
    node.addEventListener('keydown',event=>keydown(event,state));
  }
  function remove(code,item) {
    const node=item.layer.getElement();
    if(node && doc.activeElement===node)map.getContainer().focus({preventScroll:true});
    map.removeLayer(item.layer);layers.delete(code);
  }
  function refresh() {
    if(disposed)return;
    const overview=map.getZoom()<=STATE_SELECTION_MAX_ZOOM;
    const visible=new Set();
    if(overview){
      const b=map.getBounds(),west=b.getWest(),rawEast=b.getEast();
      const bounds={west,east:rawEast<west?rawEast+360*Math.ceil((west-rawEast)/360):rawEast,south:b.getSouth(),north:b.getNorth()};
      const selected=getFocusedState();
      if([west,bounds.east,bounds.south,bounds.north].every(Number.isFinite)){
        const intersecting=new Set(usRegionsInBounds(bounds).map(region=>region.code));
        for(const state of sourceOutlines()){
          if(state.code===selected || !intersecting.has(state.code))continue;
          const parts=visibleParts(state,bounds);
          if(!parts.length)continue;
          visible.add(state.code);
          const key=parts.map(p=>p.index+':'+p.world).join(',');
          const item=layers.get(state.code);
          if(!item)add(state,parts,key);
          else if(item.key!==key){
            item.parts=parts;item.key=key;item.layer.setLatLngs(leafCoordinates(parts));
          }
        }
      }
    }
    for(const [code,item] of layers)if(!visible.has(code))remove(code,item);
    if(layers.size){
      const {lat,lng}=map.getCenter(),center=usRegionAt(lat,lng)?.code;
      setTabStop(layers.has(focusCode)?focusCode:layers.has(center)?center:layers.keys().next().value);
    }
  }
  function detach() {
    if(disposed)return;
    disposed=true;cancelClick();
    map.off('zoomend moveend resize',refresh);
    map.off('dblclick dragstart movestart zoomstart',cancelClick);
    map.off('unload',detach);
    doc.removeEventListener('mapstylechange',repaint);
    for(const [code,item] of layers)remove(code,item);
    if(map.hasLayer(renderer))map.removeLayer(renderer);
  }
  map.on('zoomend moveend resize',refresh);
  map.on('dblclick dragstart movestart zoomstart',cancelClick);
  map.on('unload',detach);
  doc.addEventListener('mapstylechange',repaint);
  refresh();
  return detach;
}
