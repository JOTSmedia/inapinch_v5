import {decodeTile} from './scripts/vector-poi.mjs';

// Parallel oblique projection leaves every street-level coordinate fixed.
// Only height moves a vertex off its footprint. Roofs, facades and density
// ridges share the same projection, with legible limits at very close zoom.
const circumference=40075016.686;
const empty=()=>({type:'FeatureCollection',features:[]});
const projectX=lng=>(lng+180)/360;
const projectY=lat=>(1-Math.asinh(Math.tan(Math.min(85.051129,Math.max(-85.051129,lat))*Math.PI/180))/Math.PI)/2;
const geographic=(x,y)=>[x*360-180,Math.atan(Math.sinh(Math.PI*(1-2*y)))*180/Math.PI];
const feature=(part,type,coordinates,order=0)=>({type:'Feature',properties:{part,order},geometry:{type,coordinates}});
const lines=(part,paths)=>feature(part,'MultiLineString',paths);
const roofPoint=(point,height)=>geographic(point[0]+height*.34,point[1]-height*.72);
// The detailed venue reader already fetches these tiles. Share a bounded
// cache on raster devices so the 3D drawing can run without WebGL or an
// additional network request. A malformed building layer cannot hide POIs.
const rasterTiles=new Map(),fallbackListeners=new Set();
let cachedBytes=0;
export function rememberWireTile(tile,bytes){
  if(!fallbackListeners.size || !bytes?.length)return;
  const previous=rasterTiles.get(tile.key);
  if(previous){cachedBytes-=previous.bytes.length;rasterTiles.delete(tile.key);}
  rasterTiles.set(tile.key,{...tile,bytes,buildings:null});cachedBytes+=bytes.length;
  while(rasterTiles.size>16 || cachedBytes>6*1024*1024){
    const key=rasterTiles.keys().next().value;
    cachedBytes-=rasterTiles.get(key).bytes.length;rasterTiles.delete(key);
  }
  for(const update of fallbackListeners)update();
}
function cachedBuildings(box,zoom){
  if(zoom<14)return [];
  const frame=frameFor(box,zoom),out=[];
  for(const tile of rasterTiles.values()){
    const side=16384,west=tile.x/side;
    const shift=Math.round((frame.east+frame.west)/2-west);
    if(west+shift>frame.east || west+shift+1/side<frame.west || tile.y/side>frame.south || (tile.y+1)/side<frame.north)continue;
    if(!tile.buildings){
      tile.buildings=[];
      try{
        for(const item of decodeTile(tile.bytes,'building').building || []){
          if(!item.polygons?.length)continue;
          const polygons=item.polygons.map(polygon=>polygon.map(ring=>ring.map(([x,y])=>geographic(
            (tile.x+x/item.extent)/side,(tile.y+y/item.extent)/side))));
          tile.buildings.push({properties:item.properties,geometry:{type:'MultiPolygon',coordinates:polygons}});
        }
      }catch{/* Other tile layers and the street basemap remain usable. */}
    }
    for(const building of tile.buildings)out.push(building);
  }
  return out;
}
let coverageRequest;
function coverage(){
  if(!coverageRequest)coverageRequest=fetch('data/wire-coverage.json').then(async response=>{
    if(!response.ok)throw Error('Coverage grid unavailable');
    const data=await response.json();
    const bytes=Uint8Array.from(atob(data.rows),c=>c.charCodeAt(0));
    return unpackCoverage(bytes,data.zoom,data.cells);
  }).catch(()=>{coverageRequest=null;return null;});
  return coverageRequest;
}

export function unpackCoverage(bytes,zoom,length){
  const keys=new Uint32Array(length),counts=new Uint32Array(length);
  let cursor=0,previous=0;
  function read(){
    let value=0,factor=1;
    for(let i=0;i<5 && cursor<bytes.length;i++){
      const byte=bytes[cursor++]; value+=(byte%128)*factor;
      if(byte<128)return value;
      factor*=128;
    }
    throw Error('Invalid coverage grid');
  }
  for(let i=0;i<length;i++){previous+=read();keys[i]=previous;counts[i]=read();}
  if(cursor!==bytes.length)throw Error('Invalid coverage grid length');
  return {keys,counts,zoom};
}
function lowerBound(values,target){
  let left=0,right=values.length;
  while(left<right){
    const mid=(left+right)>>>1;
    if(values[mid]<target)left=mid+1;else right=mid;
  }
  return left;
}
function frameFor(bounds,zoom){
  const west=projectX(bounds.west);
  let east=projectX(bounds.east);
  if(east<west)east+=Math.ceil(west-east);
  const north=projectY(bounds.north),south=projectY(bounds.south);
  const size=256*2**zoom,pad=48/size;
  return {west:west-pad,east:east+pad,north:Math.max(0,north-pad),south:Math.min(1,south+pad),size,zoom};
}
function groundGrid(frame){
  const n=2**Math.max(1,Math.min(20,Math.round(frame.zoom+1.7)));
  const x1=Math.floor(frame.west*n),x2=Math.ceil(frame.east*n),y1=Math.floor(frame.north*n),y2=Math.ceil(frame.south*n);
  const grid=[],easting=[];
  for(let x=x1;x<=x2;x++)grid.push([geographic(x/n,y1/n),geographic(x/n,y2/n)]);
  for(let y=y1;y<=y2;y++)grid.push([geographic(x1/n,y/n),geographic(x2/n,y/n)]);
  for(let x=x1;x<=x2;x+=1)for(let y=y1;y<=y2;y+=1){
    if(x%2 || y%2)continue;
    const dx=3/frame.size;
    easting.push([geographic(x/n-dx,y/n),geographic(x/n+dx,y/n)],[geographic(x/n,y/n-dx),geographic(x/n,y/n+dx)]);
  }
  return [lines('grid',grid),lines('register',easting)];
}
function densityMesh(grid,frame){
  if(!grid || frame.zoom>14.5)return [];
  const level=Math.max(2,Math.min(grid.zoom,Math.round(frame.zoom+4.1))),n=2**level;
  const raw=2**grid.zoom,bin=raw/n;
  const left=Math.floor(frame.west*n)-1,right=Math.ceil(frame.east*n)+1;
  const top=Math.max(0,Math.floor(frame.north*n)-1),bottom=Math.min(n-1,Math.ceil(frame.south*n)+1);
  const first=lowerBound(grid.keys,top*bin*raw),end=lowerBound(grid.keys,(bottom+1)*bin*raw);
  // A linear sweep only visits occupied rows inside this viewport's latitude band.
  const cells=new Map(),stride=right-left+1;
  for(let i=first;i<end;i++){
    const rawY=Math.floor(grid.keys[i]/raw),y=Math.floor(rawY/bin),x=Math.floor((grid.keys[i]-rawY*raw)/bin);
    for(let world=Math.ceil((left-x)/n);world<=Math.floor((right-x)/n);world++){
      const column=x+world*n,id=(y-top)*stride+column-left;
      cells.set(id,(cells.get(id)||0)+grid.counts[i]);
    }
  }
  const vertices=new Map(),hot=[],cool=[],crest=[],facets=[];
  const reference=16*2**((13-level)*1.15);
  function vertex(x,y){
    const id=(y-top)*stride+x-left;
    if(vertices.has(id))return vertices.get(id);
    const count=cells.get(id)||0;
    const relief=1.66*Math.pow(count/(count+reference),.81);
    const point=roofPoint([(x+.5)/n,(y+.5)/n],Math.min(relief/n,28/frame.size));
    vertices.set(id,point);return point;
  }
  // Draw each edge once. The ring of zero-count neighbors brings isolated
  // populated cells back to the geographic plane without inventing stops.
  for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){
    const id=(y-top)*stride+x-left,a=cells.get(id)||0,b=cells.get(id+1)||0;
    const c=cells.get(id+stride)||0,d=cells.get(id+stride+1)||0;
    if(a||b)(a>reference*1.15 && b>reference*1.15?crest:a&&b?hot:cool).push([vertex(x,y),vertex(x+1,y)]);
    if(a||c)(a>reference*1.15 && c>reference*1.15?crest:a&&c?hot:cool).push([vertex(x,y),vertex(x,y+1)]);
    if((a&&d) || ((a||d) && (b||c)))cool.push([vertex(x,y),vertex(x+1,y+1)]);
    if(a && b && d && b>Math.min(a,d)*1.35)facets.push([[vertex(x,y),vertex(x+1,y),vertex(x+1,y+1),vertex(x,y)]]);
    if(a && c && d && d>Math.min(a,c)*1.35)facets.push([[vertex(x,y),vertex(x,y+1),vertex(x+1,y+1),vertex(x,y)]]);
  }
  return [feature('facet','MultiPolygon',facets),lines('mesh',cool),lines('ridge',hot),lines('crest',crest)].filter(f=>f.geometry.coordinates.length);
}

function buildingMesh(buildings,frame){
  if(frame.zoom<14 || !buildings.length)return [];
  const shapes=[],seen=new Set(),middle=(frame.west+frame.east)/2;
  for(const building of buildings){
    const prop=building.properties||{},g=building.geometry;
    if(!g || (g.type!=='Polygon' && g.type!=='MultiPolygon'))continue;
    const height=Number(prop.render_height??prop.height),base=Math.max(0,Number(prop.render_min_height??prop.min_height)||0);
    if(!Number.isFinite(height) || height<=base)continue;
    for(const polygon of g.type==='Polygon'?[g.coordinates]:g.coordinates){
      if(!polygon[0] || polygon[0].length<4)continue;
      const firstX=projectX(polygon[0][0][0]),copy=Math.round(middle-firstX);
      let west=Infinity,east=-Infinity,north=Infinity,south=-Infinity;
      for(const [lng,lat] of polygon[0]){
        const x=projectX(lng)+copy,y=projectY(lat);
        west=Math.min(west,x);east=Math.max(east,x);north=Math.min(north,y);south=Math.max(south,y);
      }
      if(east<frame.west || west>frame.east || south<frame.north || north>frame.south)continue;
      const footprint=(east-west)*(south-north)*frame.size**2;
      const m=1/(circumference*Math.cos(polygon[0][0][1]*Math.PI/180));
      // Compress extreme heights on mobile-size views so roofs do not cover
      // multiple city blocks. All vertices at the same height move together.
      const maximum=70/frame.size,top=Math.min(maximum,height*m),foot=top*base/height;
      if(footprint<7 || (top-foot)*frame.size<1.55)continue;
      const key=[west,east,north,south,height,base].join('|');
      if(seen.has(key))continue;
      seen.add(key);shapes.push({polygon,copy,top,foot,south,score:Math.sqrt(footprint)+(top-foot)*frame.size});
    }
  }
  // Tiny footprints retain their 2D base at dense scales. Keep the most
  // visible 3D shapes within a predictable geometry budget on phones.
  if(shapes.length>1000)shapes.sort((a,b)=>b.score-a.score).length=1000;
  shapes.sort((a,b)=>a.south-b.south);
  const output=[];
  for(const [order,{polygon,copy,top,foot}] of shapes.entries()){
    const walls=[],roof=[],edges=[],uprights=[];
    for(const ring of polygon){
      if(ring.length<4)continue;
      const pts=ring.map(([lng,lat])=>[projectX(lng)+copy,projectY(lat)]);
      const bottom=pts.map(p=>roofPoint(p,foot)),raised=pts.map(p=>roofPoint(p,top));
      roof.push(raised);edges.push(raised);
      let signed=0;
      for(let i=1;i<pts.length;i++)signed+=(pts[i-1][0]-pts[0][0])*(pts[i][1]-pts[0][1])-(pts[i][0]-pts[0][0])*(pts[i-1][1]-pts[0][1]);
      const exterior=ring===polygon[0];
      const side=(signed>=0?1:-1)*(exterior?1:-1);
      for(let i=1;i<pts.length;i++){
        const dx=pts[i][0]-pts[i-1][0],dy=pts[i][1]-pts[i-1][1];
        if(side*(.72*dx+.34*dy)>=0)continue;
        walls.push([[bottom[i-1],bottom[i],raised[i],raised[i-1],bottom[i-1]]]);
        if(Math.hypot(dx,dy)*frame.size>2.2)uprights.push([bottom[i-1],raised[i-1]],[bottom[i],raised[i]]);
      }
    }
    if(!roof.length)continue;
    if(walls.length)output.push(feature('wall','MultiPolygon',walls,order*2));
    output.push(feature('roof','Polygon',roof,order*2+1));
    if(uprights.length)output.push(lines('upright',uprights));
    output.push(lines('rim',edges));
  }
  return output;
}

export function wireScene(bounds,zoom,grid,buildings=[]){
  if(![bounds.west,bounds.east,bounds.north,bounds.south,zoom].every(Number.isFinite))return empty();
  const frame=frameFor(bounds,zoom);
  return {type:'FeatureCollection',features:[...groundGrid(frame),...densityMesh(grid,frame),...buildingMesh(buildings,frame)]};
}

const parts=(...kinds)=>['in',['get','part'],['literal',kinds]];
export function wireLayers(p,mode){
  const visible=mode==='wireframe';
  const stroke=(id,kinds,color,width,opacity)=>({id,type:'line',source:'wire-world',filter:parts(...kinds),
    paint:{'line-color':color,'line-width':width,'line-opacity':visible?opacity:0}});
  return [
    stroke('wire-grid',['grid'],p.accent,.65,.14),
    stroke('wire-grid-crossings',['register'],p.accent,.9,.43),
    {id:'wire-density-facets',type:'fill',source:'wire-world',filter:parts('facet'),
      paint:{'fill-color':p.accent,'fill-opacity':visible?.085:0,'fill-outline-color':'rgba(0,0,0,0)'}},
    stroke('wire-density-diagonals',['mesh'],p.local,.64,.27),
    stroke('wire-density-ridges',['ridge'],p.accent,.85,.47),
    stroke('wire-density-crests',['crest'],p.highway,1,.76),
    {id:'wire-architecture',type:'fill',source:'wire-world',filter:parts('roof','wall'),layout:{'fill-sort-key':['get','order']},
      paint:{'fill-color':['case',['==',['get','part'],'wall'],p.background,p.building],'fill-opacity':visible?.82:0}},
    stroke('wire-facades',['upright'],p.local,.75,.68),
    stroke('wire-roof-edges',['rim'],p.accent,1.06,.93)
  ];
}

export function attachWireWorld(map,L,{getGL,getMode,getPalette}){
  if(!map.getBounds || !map.getSize)return {refresh(){},dispose(){}};
  let grid=null,stopped=false,last='',lastStreets='',timer,rasterLayer,renderer,loading=false;
  function removeRaster(){
    if(rasterLayer){map.removeLayer(rasterLayer);rasterLayer=null;}
  }
  function rasterScene(scene,p){
    if(!L.geoJSON || !L.canvas || !map.createPane)return;
    if(!renderer){
      const pane=map.getPane('wireSurface') || map.createPane('wireSurface');
      pane.style.zIndex='214';pane.style.pointerEvents='none';pane.setAttribute('aria-hidden','true');
      renderer=L.canvas({pane:'wireSurface',padding:.28});
    }
    const styles={
      grid:{color:p.accent,weight:.65,opacity:.18},register:{color:p.accent,weight:.9,opacity:.46},
      facet:{fill:true,stroke:false,fillColor:p.accent,fillOpacity:.09},
      mesh:{color:p.local,weight:.64,opacity:.32},ridge:{color:p.accent,weight:.85,opacity:.55},
      crest:{color:p.highway,weight:1,opacity:.82},
      wall:{fill:true,stroke:false,fillColor:p.background,fillOpacity:.85},
      roof:{fill:true,stroke:false,fillColor:p.building,fillOpacity:.8},
      upright:{color:p.local,weight:.75,opacity:.7},rim:{color:p.accent,weight:1.05,opacity:.92}
    };
    // One Leaflet canvas path per material keeps thousands of small roofs
    // out of the DOM and out of Leaflet's interactive target registry.
    const batches=new Map();
    for(const item of scene.features){
      const part=item.properties.part;
      if(!batches.has(part))batches.set(part,[]);
      const geometry=item.geometry;
      if(geometry.type==='Polygon')batches.get(part).push(geometry.coordinates);
      else for(const coordinates of geometry.coordinates)batches.get(part).push(coordinates);
    }
    const batched=empty();
    for(const part of Object.keys(styles)){
      if(batches.has(part))batched.features.push(feature(part,styles[part].fill?'MultiPolygon':'MultiLineString',batches.get(part)));
    }
    const options={pane:'wireSurface',renderer,interactive:false,bubblingMouseEvents:false,
      style:f=>({fill:false,...styles[f.properties.part],interactive:false,renderer,pane:'wireSurface',smoothFactor:.2})};
    removeRaster();
    rasterLayer=L.geoJSON(batched,options).addTo(map);
  }
  function update(){
    timer=null;if(stopped)return;
    const gl=getGL(),source=gl?.getSource('wire-world');
    if(getMode()!=='wireframe'){
      if(last)source?.setData?.(empty());
      removeRaster();last='';lastStreets='';return;
    }
    if(!grid && !loading){
      loading=true;void coverage().then(value=>{loading=false;if(stopped || !value)return;grid=value;last='';schedule();});
    }
    const bounds=map.getBounds(),zoom=map.getZoom(),p=getPalette();
    const box={west:bounds.getWest(),east:bounds.getEast(),north:bounds.getNorth(),south:bounds.getSouth()};
    const streets=zoom>=14 && gl?.getSource('openmaptiles') && gl.isSourceLoaded('openmaptiles');
    const key=[zoom,box.west,box.east,box.north,box.south,Boolean(grid),Boolean(streets),Boolean(gl),p.accent,p.local].join('|');
    if(last===key)return;
    if(gl && !source?.setData)return;
    last=key;
    const buildings=streets?gl.querySourceFeatures('openmaptiles',{sourceLayer:'building'}):gl?[]:cachedBuildings(box,zoom);
    const scene=wireScene(box,zoom,grid,buildings);
    if(gl){removeRaster();source.setData(scene);}else rasterScene(scene,p);
    if(streets)lastStreets=[zoom,box.west,box.south,box.east,box.north].join('|');
  }
  function schedule(){
    if(timer==null && !stopped)timer=setTimeout(update,24);
  }
  function newTile(){last='';schedule();}
  function refresh(reason){
    if(reason==='fallback')fallbackListeners.add(newTile);
    if(reason==='idle'){
      if(getMode()!=='wireframe')return;
      const bounds=map.getBounds(),key=[map.getZoom(),bounds.getWest(),bounds.getSouth(),bounds.getEast(),bounds.getNorth()].join('|');
      if(key===lastStreets)return;
    }
    if(reason==='fallback' || reason==='style')last='';
    schedule();
  }
  map.on('moveend resize',schedule);
  // Camera and tiles settle separately. The first render can use the bundled
  // regional relief while streets are still on the network.
  return {refresh,dispose(){
    stopped=true;clearTimeout(timer);removeRaster();fallbackListeners.delete(newTile);
    if(!fallbackListeners.size){rasterTiles.clear();cachedBytes=0;}
    if(renderer && map.hasLayer(renderer))map.removeLayer(renderer);
    map.off('moveend resize',schedule);
  }};
}
