// The National Map publishes RGB photo tiles in Web Mercator, addressed z/y/x.
// Its imagery service ends at scale 1:9028 (z16). Leaflet enlarges that level
// for closer inspection while pins retain their full coordinate precision.
export const aerialTemplate='https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}';

export function attachAerialImagery(map,L,doc=document){
  const notice=doc.getElementById('aerial-notice');
  const message=doc.getElementById('aerial-message');
  const retry=doc.getElementById('aerial-retry');
  if(!notice || !message || !retry || !map?.createPane || !L?.tileLayer)return;
  let layer=null;
  const show=(text='',canRetry=false)=>{
    message.textContent=text;retry.hidden=!canRetry;notice.hidden=!text;
  };
  function clear(){
    if(!layer)return;
    const old=layer;layer=null;map.removeLayer(old);show();
  }
  function mount(){
    if(layer)return;
    const pane=map.getPane('aerialImagery') || map.createPane('aerialImagery');
    pane.style.zIndex='250';pane.style.pointerEvents='none';
    const tiles=L.tileLayer(aerialTemplate,{
      pane:'aerialImagery',tileSize:256,minZoom:2,maxZoom:19,maxNativeZoom:16,
      keepBuffer:1,updateWhenIdle:true,referrerPolicy:'strict-origin-when-cross-origin',
      attribution:'Imagery: USDA, <a href="https://www.usgs.gov/the-national-map-data-delivery" target="_blank" rel="noopener">USGS The National Map</a>'
    });
    let failures=0;
    layer=tiles;
    // Transparent missing tiles reveal the street basemap underneath.
    tiles.on('loading',()=>{if(layer===tiles){failures=0;show('Loading aerial imagery…');}});
    tiles.on('tileerror',event=>{
      if(layer!==tiles)return;
      failures++;if(event.tile)event.tile.style.visibility='hidden';
    });
    tiles.on('load',()=>{if(layer===tiles)show(failures?'Some aerial photos are unavailable. Showing the base map in those areas.':'',failures>0);});
    show('Loading aerial imagery…');tiles.addTo(map);
  }
  function apply(){if(doc.body.dataset.mapStyle==='satellite')mount();else clear();}
  function reload(){if(layer){clear();apply();}}
  doc.addEventListener('mapstylechange',apply);retry.addEventListener('click',reload);
  function detach(){
    doc.removeEventListener('mapstylechange',apply);retry.removeEventListener('click',reload);
    map.off('unload',detach);clear();
  }
  map.on('unload',detach);apply();
  return detach;
}
