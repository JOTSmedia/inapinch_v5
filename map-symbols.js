import {symbol} from './place-detail.js';
import {escapeHTML} from './logic.js';

export const facilityLabels = {
  public:'Free public restroom', toilet:'Mapped restroom', bed:'Hotel or lodging', food:'Restaurant', glass:'Bar or pub',
  cup:'Café or bakery', fuel:'Gas or travel center', road:'Rest area', shower:'Shower facility',
  book:'Library', tree:'Park or outdoor site', transit:'Transit station or terminal', culture:'Arts or sports venue', shop:'Shop or market', building:'Civic or other venue',
  mixed:'Multiple facility types'
};

const compactCount = new Intl.NumberFormat('en-US',{notation:'compact',maximumSignificantDigits:2});
export function commonFacilities(mix) {
  return Object.keys(mix||{}).filter(kind=>Object.hasOwn(facilityLabels,kind) && mix[kind]>0)
    .sort((a,b)=>mix[b]-mix[a]).slice(0,3);
}

function handleSpace(event) {
  if(event.key!==' ')return;
  event.preventDefault();
  event.stopPropagation();
  if(event.type==='keyup')event.currentTarget.click();
}

// DivIcon can recycle an element on setIcon. MarkerCluster also creates icons
// repeatedly as children change, and Leaflet only applies its alt option to IMG.
function mapSymbolIcon(L,className,html,label,cluster) {
  const icon=L.divIcon({className,html,iconSize:[44,44],iconAnchor:[22,22],tooltipAnchor:[0,-12]});
  const makeElement=icon.createIcon;
  icon.createIcon=old=>{
    const node=makeElement.call(icon,old);
    node.setAttribute('aria-label',label);
    node.addEventListener('keydown',handleSpace);
    node.addEventListener('keyup',handleSpace);
    // Plugin clusters build their icon after Leaflet first binds their tooltip.
    // Their replacement DIV therefore needs its own keyboard focus listeners.
    if(cluster){
      node.addEventListener('focus',()=>cluster.openTooltip());
      node.addEventListener('blur',()=>cluster.closeTooltip());
    }
    return node;
  };
  return icon;
}
export function venueMapIcon(L,place,kind,accessLabel,selected) {
  const access=place.access==='public'?'public':place.access==='paid'?'paid':'unknown';
  const mark=access==='public'?'✓':access==='paid'?'$':'?';
  const label=[place.name,facilityLabels[kind],accessLabel,'Open location profile'].join(' · ');
  const html='<span class="map-pin'+(selected?' selected':'')+'" data-facility="'+kind+'" aria-hidden="true">'+
    '<span class="pin-pictogram">'+symbol(kind)+'</span><span class="pin-access-mark">'+mark+'</span></span>';
  return mapSymbolIcon(L,'pin-wrapper',html,label);
}
export function groupMapIcon(L,className,count,kind,mix,label,cluster) {
  const types=commonFacilities(mix);
  if(kind==='mixed' && types.length===1)kind=types[0];
  if(!Object.hasOwn(facilityLabels,kind))kind='mixed';
  const glyph=kind==='mixed'?'':'<span class="cluster-glyph">'+symbol(kind)+'</span>';
  const ticks=kind==='mixed' && types.length>1?'<span class="cluster-mix">'+
    types.map(type=>'<i data-facility="'+type+'"></i>').join('')+'</span>':'';
  const value=count<1000?String(count):compactCount.format(count);
  const html='<span class="map-count-symbol" data-facility="'+kind+'" aria-hidden="true">'+glyph+
    '<span class="cluster-total">'+value+'</span>'+ticks+'</span>';
  return mapSymbolIcon(L,className,html,label,cluster);
}
export function bindMapTip(marker,heading,description) {
  const html='<strong>'+escapeHTML(heading)+'</strong><span>'+escapeHTML(description)+'</span>';
  if(marker.getTooltip())marker.setTooltipContent(html);
  else {
    marker.bindTooltip(html,{className:'place-tooltip',direction:'top',offset:[0,-4],opacity:1});
    marker.on('click',()=>marker.closeTooltip());
  }
}
