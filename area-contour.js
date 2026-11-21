import {getAreaBoundary} from './area-geography.js';

const paneName='jurisdictionContour';
const supported=new Set(['state','county','city','borough','neighborhood']);
const nearestLongitude=(lng,anchor)=>lng+360*Math.round((anchor-lng)/360);

// Align every ring with one longitude interval. Islands and holes on either
// side of the date line then stay together when Leaflet shows a wrapped world.
function continuousGeometry(boundary) {
  const source=boundary?.rings?.filter(ring=>ring.length>=4);
  if(!source?.length)return null;
  const largest=source.reduce((a,b)=>a.length>=b.length?a:b);
  const anchor=largest[0][0];
  const rings=[];
  let south=Infinity,north=-Infinity,west=Infinity,east=-Infinity;
  for(const ring of source){
    let previous=anchor;
    const line=[];
    for(const [longitude,latitude] of ring){
      const lng=nearestLongitude(longitude,previous);
      previous=lng;west=Math.min(west,lng);east=Math.max(east,lng);
      south=Math.min(south,latitude);north=Math.max(north,latitude);
      line.push([latitude,lng]);
    }
    if(line[0][0]!==line.at(-1)[0] || line[0][1]!==line.at(-1)[1])line.push(line[0]);
    rings.push(line);
  }
  return {rings,south,north,west,east};
}

function silhouette(geometry) {
  if(!geometry)return '';
  const {west,east,south,north,rings}=geometry;
  const ratio=Math.cos((north+south)*Math.PI/360);
  const scale=Math.min(116/Math.max(.00001,(east-west)*ratio),74/Math.max(.00001,north-south));
  const midX=(west+east)/2,midY=(south+north)/2;
  let path='';
  for(const ring of rings){
    let drawn=0,lastX,lastY;
    for(let i=0;i<ring.length-1;i++){
      const [lat,lng]=ring[i],x=(lng-midX)*scale*ratio+64,y=(midY-lat)*scale+42;
      if(i && drawn>=3 && Math.hypot(x-lastX,y-lastY)<.55)continue;
      path+=(drawn?'L':'M')+x.toFixed(1)+' '+y.toFixed(1);
      drawn++;lastX=x;lastY=y;
    }
    if(drawn)path+='Z';
  }
  return path;
}

export function contourSilhouette(boundary) {
  return silhouette(continuousGeometry(boundary));
}

function areaKey(area) {
  if(!area?.state?.code || !supported.has(area.level) || area.approximate)return '';
  return [area.state.code,area.level,area.id || area.guideId || area.shortLabel].join('|');
}

export function attachAreaContour(map,L,{initialTheme,readBoundary=getAreaBoundary,events=document}={}) {
  const pane=map.getPane(paneName) || map.createPane(paneName);
  pane.style.zIndex='385';pane.style.pointerEvents='none';pane.setAttribute('aria-hidden','true');
  const renderer=L.canvas({pane:paneName,padding:.2});
  const shared={pane:paneName,renderer,interactive:false,bubblingMouseEvents:false,fill:false,
    smoothFactor:1,lineCap:'round',lineJoin:'round'};
  let casing,line,geometry,world,key='',theme=initialTheme,mode=events.body?.dataset?.mapStyle || 'wireframe';
  let revision=0,failed=false,disposed=false;
  function publish(path='') {
    events.dispatchEvent(new CustomEvent('areacontourchange',{detail:{area:theme?.area || null,path}}));
  }
  function removeShape() {
    if(casing)map.removeLayer(casing);
    if(line)map.removeLayer(line);
    casing=null;line=null;geometry=null;world=null;
  }
  function style() {
    const dark=mode==='wireframe';
    const inks=dark?theme?.mapIdentity?.inks:theme?.mapIdentity?.lightInks;
    const base=inks?.background || (dark?theme?.palette?.background:theme?.lightPalette?.background);
    const stroke=inks?.border || (dark?theme?.highlight:theme?.deep);
    casing?.setStyle({color:base || (dark?'#15252d':'#fffdf5'),weight:3,opacity:.90});
    line?.setStyle({color:stroke || (dark?'#f4d888':'#355344'),weight:1.55,opacity:.95,dashArray:'6 3.5'});
  }
  function draw() {
    if(!geometry)return;
    const {rings,east,west}=geometry;
    const turn=Math.round((map.getCenter().lng-(east+west)/2)/360);
    if(turn===world)return;
    world=turn;
    const points=turn===0?rings:rings.map(ring=>ring.map(([lat,lng])=>[lat,lng+turn*360]));
    if(!line) {
      casing=L.polyline(points,shared).addTo(map);
      line=L.polyline(points,shared).addTo(map);
    }else{
      casing.setLatLngs(points);line.setLatLngs(points);
    }
    style();
  }
  async function apply(next,retry=false) {
    if(disposed)return;
    theme=next;
    const target=areaKey(theme?.area);
    if(key===target && !retry){style();draw();return;}
    const token=++revision;key=target;failed=false;removeShape();publish();
    if(!target)return;
    try{
      const raw=await readBoundary(theme.area);
      if(disposed || token!==revision)return;
      geometry=continuousGeometry(raw);
      if(!geometry)return;
      draw();publish(silhouette(geometry));
    }catch{if(token===revision && !disposed)failed=true;}
  }
  const change=event=>{void apply(event.detail);};
  const recolor=event=>{mode=event.detail;style();};
  const moved=()=>{if(failed)void apply(theme,true);else draw();};
  events.addEventListener('areathemechange',change);events.addEventListener('mapstylechange',recolor);
  map.on('moveend',moved);
  function detach(){
    if(disposed)return;
    disposed=true;revision++;removeShape();
    if(map.hasLayer(renderer))map.removeLayer(renderer);
    events.removeEventListener('areathemechange',change);events.removeEventListener('mapstylechange',recolor);
    map.off('moveend',moved);map.off('unload',detach);
  }
  map.on('unload',detach);
  if(initialTheme)void apply(initialTheme);
  return detach;
}
