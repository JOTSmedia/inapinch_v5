// A locally rendered, geographically faithful Key West map.
// Geometry © OpenStreetMap contributors, ODbL 1.0. See scripts/build_vector_map.py.
import {escapeHTML as e} from './logic.js';

export async function addIslandMap(map) {
  const L=window.L;
  const response=await fetch('./assets/key-west-map.json');
  if(!response.ok)throw new Error('Island map geometry unavailable');
  const geo=await response.json();
  const features=geo.features;
  const group=kind=>({type:'FeatureCollection',features:features.filter(f=>f.properties.kind===kind)});
  [['coast',200],['land',210],['parks',220],['water',230],['buildings',240],['roadBorder',260],['roads',270],['mapLabels',420]].forEach(([name,z])=>{
    map.createPane(name);map.getPane(name).style.zIndex=z;map.getPane(name).style.pointerEvents='none';
  });
  const vector=(kind,pane,style)=>L.geoJSON(group(kind),{pane,interactive:false,style,renderer:L.canvas({pane,padding:.3})}).addTo(map);
  vector('land','coast',{color:'#b6eee2',weight:12,fill:false,opacity:1,lineJoin:'round'});
  vector('land','land',{color:'#f3bdac',weight:1.3,fillColor:'#fff0df',fillOpacity:1});
  vector('park','parks',{color:'#aed398',weight:.5,fillColor:'#cee8a5',fillOpacity:1});
  vector('beach','parks',{color:'#efc96d',weight:.7,fillColor:'#ffe196',fillOpacity:1});
  vector('water','water',{color:'#31a6cd',weight:1,fillColor:'#51b8d7',fillOpacity:1});
  vector('runway','roads',{color:'#87b9ac',weight:1,fillColor:'#a3c4b7',fillOpacity:1});
  const buildingLayer=vector('building','buildings',{color:'#e4b5ab',weight:.7,fillColor:'#f1d1bf',fillOpacity:.8});
  const major=new Set(['primary','primary_link','secondary','secondary_link','tertiary','tertiary_link','trunk','trunk_link']);
  const walking=new Set(['footway','path','pedestrian','cycleway','steps']);
  function roadStyle(feature,border=false){
    const z=map.getZoom(),p=feature.properties;
    const isMain=major.has(p.highway),isFoot=walking.has(p.highway),duval=/duval/i.test(p.name||'');
    const scale=z>=17?1.65:z>=16?1.35:z>=15?1:.8;
    const weight=(isMain?5:duval?4:isFoot?1.2:2.3)*scale;
    return {color:border?'#fffaf0':duval?'#f3a2a7':isMain?'#f5cd79':isFoot?'#d3bca4':'#ffffff',weight:border?weight+2.5:weight,opacity:isFoot?(z>=15?.75:0):1,dashArray:isFoot?'2 5':null,lineCap:'round',lineJoin:'round'};
  }
  const roadBorder=L.geoJSON(group('road'),{pane:'roadBorder',interactive:false,style:f=>roadStyle(f,true),renderer:L.canvas({pane:'roadBorder',padding:.3})}).addTo(map);
  const roads=L.geoJSON(group('road'),{pane:'roads',interactive:false,style:f=>roadStyle(f,false),renderer:L.canvas({pane:'roads',padding:.3})}).addTo(map);
  const labels=L.layerGroup().addTo(map);
  const priorityNames=['Duval Street','Whitehead Street','White Street','North Roosevelt Boulevard','South Roosevelt Boulevard','Truman Avenue','Flagler Avenue','College Road','Caroline Street','Eaton Street','Fleming Street','Simonton Street','Southard Street','Olivia Street','Catherine Street','United Street','South Street','Palm Avenue','Grinnell Street'];
  const streetLabels=[];
  for(const name of priorityNames){
    const matched=features.filter(f=>f.properties.kind==='road' && f.properties.name===name && f.geometry.type==='LineString');
    if(!matched.length)continue;
    const longest=matched.sort((a,b)=>lineLength(b.geometry.coordinates)-lineLength(a.geometry.coordinates))[0].geometry.coordinates;
    const middle=longest[Math.floor(longest.length/2)],a=longest[0],b=longest[longest.length-1];
    let angle=-Math.atan2(b[1]-a[1],(b[0]-a[0])*.91)*180/Math.PI;
    if(angle>90)angle-=180;if(angle< -90)angle+=180;
    streetLabels.push({name,lat:middle[1],lng:middle[0],angle,priority:priorityNames.indexOf(name)});
  }
  const neighborhoods=features.filter(f=>f.properties.kind==='label' && ['quarter','neighbourhood','town'].includes(f.properties.place)).map(f=>({name:f.properties.name.replace('Truman Annex1','Truman Annex').toUpperCase(),lat:f.geometry.coordinates[1],lng:f.geometry.coordinates[0],min:f.properties.place==='neighbourhood'?16:14}));
  const geography=[
    {name:'KEY WEST',lat:24.565,lng:-81.8007,kind:'island-title',min:12,max:14.8},
    {name:'Atlantic Ocean',lat:24.5406,lng:-81.7805,kind:'ocean-label',min:12,max:15.8},
    {name:'Key West Harbor',lat:24.5614,lng:-81.8126,kind:'ocean-label',min:15,max:18},
    {name:'EYW AIRPORT',lat:24.5568,lng:-81.7569,kind:'airport-label',min:14,max:17},
  ];
  function label(p,kind,angle=0){
    const html=`<span style="--label-angle:${angle.toFixed(1)}deg">${e(p.name.replace('Boulevard','Blvd').replace('Street','St').replace('Avenue','Ave').replace('North ','N. ').replace('South ','S. '))}</span>`;
    L.marker([p.lat,p.lng],{pane:'mapLabels',interactive:false,keyboard:false,icon:L.divIcon({className:`island-label ${kind}`,html,iconSize:[180,32],iconAnchor:[90,16]})}).addTo(labels);
  }
  function drawLabels(){
    labels.clearLayers();const z=map.getZoom();
    const used=[];
    for(const p of neighborhoods){
      if(z<p.min || z>17.5)continue;
      const point=map.latLngToContainerPoint([p.lat,p.lng]);
      used.push({x:point.x,y:point.y});label(p,'neighborhood-label');
    }
    for(const p of geography)if(z>=p.min && z<=p.max)label(p,p.kind);
    for(const p of streetLabels){
      if(z<14.5 || (z<15.5 && p.priority>7))continue;
      const point=map.latLngToContainerPoint([p.lat,p.lng]);
      if(used.some(q=>Math.abs(q.x-point.x)<90 && Math.abs(q.y-point.y)<35))continue;
      used.push({x:point.x,y:point.y});label(p,'street-label',p.angle);
    }
    if(z>=16.5){if(!map.hasLayer(buildingLayer))buildingLayer.addTo(map);}else if(map.hasLayer(buildingLayer))map.removeLayer(buildingLayer);
    roadBorder.setStyle(f=>roadStyle(f,true));roads.setStyle(f=>roadStyle(f,false));
  }
  drawLabels();map.on('zoomend moveend',drawLabels);
  map.attributionControl.addAttribution('Island map · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors');
  return {geo,drawLabels};
}

function lineLength(points){
  let n=0;for(let i=1;i<points.length;i++)n+=Math.hypot((points[i][0]-points[i-1][0])*.91,points[i][1]-points[i-1][1]);return n;
}
