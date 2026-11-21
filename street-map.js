// Public OpenStreetMap tiles. No account, API key, token, or billing setup.
// Only the current viewport is requested; browser HTTP caching stays intact.
export const STREET_TILE_URL='https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export function addStreetMap(map,L,status) {
  let loaded=0,failed=0;
  const failedTiles=new WeakSet();
  const message=status.querySelector?.('[data-street-message]') || status;
  const retry=status.querySelector?.('[data-retry-street]');
  const tiles=L.tileLayer(STREET_TILE_URL,{
    maxZoom:19,
    referrerPolicy:'strict-origin-when-cross-origin',
    errorTileUrl:'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="256" height="256"%3E%3C/svg%3E',
    attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>'
  });
  tiles.on('loading',()=>{loaded=0;failed=0;status.hidden=true;});
  tiles.on('tileload',event=>{if(!event?.tile || !failedTiles.has(event.tile))loaded++;});
  tiles.on('tileerror',event=>{failed++;if(event?.tile)failedTiles.add(event.tile);});
  tiles.on('load',()=>{
    status.hidden=failed===0;
    if(failed)message.textContent=loaded?'Partial street detail':'Street detail offline';
  });
  const reload=()=>tiles.redraw();
  retry?.addEventListener('click',reload);
  map.once?.('unload',()=>retry?.removeEventListener('click',reload));
  tiles.addTo(map);
  return tiles;
}
