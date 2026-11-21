// Public OpenStreetMap tiles. No account, API key, token, or billing setup.
// Only the current viewport is requested; browser HTTP caching stays intact.
export const STREET_TILE_URL='https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export function addStreetMap(map,L,status) {
  let loaded=0,failed=0;
  const tiles=L.tileLayer(STREET_TILE_URL,{
    maxZoom:19,
    referrerPolicy:'strict-origin-when-cross-origin',
    errorTileUrl:'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="256" height="256"%3E%3Cpath fill="%23e8eded" d="M0 0h256v256H0z"/%3E%3C/svg%3E',
    attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>'
  });
  tiles.on('loading',()=>{loaded=0;failed=0;status.hidden=true;});
  tiles.on('tileload',()=>{loaded++;});
  tiles.on('tileerror',()=>{failed++;});
  tiles.on('load',()=>{
    status.hidden=failed===0;
    if(failed)status.textContent=loaded
      ?'Some street-map tiles could not load. Bathroom pins, the list, and walking directions remain available.'
      :'The street map could not load. Check your connection; bathroom pins, the list, and walking directions remain available.';
  });
  tiles.addTo(map);
  return tiles;
}
