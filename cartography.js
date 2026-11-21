import {resolveAreaPalette} from './area-palettes.js';

// Both modes derive their water, roads, buildings, vegetation and type from the
// current area. Recoloring a loaded map only requires changing its paint.
export function cartographicPalette(theme, mode='wireframe') {
  const scheme = theme?.palette && theme?.lightPalette ? theme : resolveAreaPalette(theme || {}, theme ? [theme] : []);
  return mode==='city' ? scheme.lightPalette : scheme.palette;
}

export function buildMapStyle(city,mode='wireframe') {
 const p=cartographicPalette(city,mode);
 const src='openmaptiles';const line=(id,layer,color,width,filter,extra={})=>({id,type:'line',source:src,'source-layer':layer,...(filter?{filter}:{}),layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':color,'line-width':width,...extra}});
 const major=['in',['get','class'],['literal',['motorway','trunk','primary']]];
 const arterial=['in',['get','class'],['literal',['secondary','tertiary']]];
 const local=['in',['get','class'],['literal',['minor','service','street','residential','unclassified']]];
 const labelName=['coalesce',['get','name:en'],['get','name:latin'],['get','name']];
 const labelPaint={'text-color':p.label,'text-halo-color':p.background,'text-halo-width':1.4};
 const placeLabel=(id,classes,minzoom,maxzoom,layout)=>({
  id,type:'symbol',source:src,'source-layer':'place',minzoom,maxzoom,
  filter:['in',['get','class'],['literal',classes]],
  layout:{'text-field':labelName,'text-transform':'uppercase','text-font':['Noto Sans Regular'],'text-size':12,'text-padding':5,'symbol-sort-key':['to-number',['get','rank'],99],...layout},
  paint:labelPaint
 });
 const width=(a,b,c)=>['interpolate',['linear'],['zoom'],7,a,12,b,17,c];
 return {version:8,name:`IN A PINCH · ${city.name} · ${p.name}`,metadata:{cityId:city.id,mode,theme:p.name},glyphs:'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',sources:{[src]:{type:'vector',url:'https://tiles.openfreemap.org/planet',attribution:'© OpenFreeMap © OpenMapTiles · Data © OpenStreetMap contributors'}},layers:[
  {id:'background',type:'background',paint:{'background-color':p.background}},
  {id:'green-space',type:'fill',source:src,'source-layer':'landcover',filter:['in',['get','class'],['literal',['wood','grass','wetland']]],paint:{'fill-color':p.park,'fill-opacity':.5}},
  {id:'parks',type:'fill',source:src,'source-layer':'park',paint:{'fill-color':p.park,'fill-opacity':.65}},
  {id:'water',type:'fill',source:src,'source-layer':'water',paint:{'fill-color':p.water}},
  line('waterways','waterway',p.water,width(.3,.8,2)),
  {id:'building-ink',type:'fill',source:src,'source-layer':'building',minzoom:13,paint:{'fill-color':p.local,'fill-opacity':mode==='city'?.12:.075}},
  line('building-contours','building',p.local,width(0,.1,.6),null,{'line-opacity':.35}),
  line('major-road-glow','transportation',p.highway,width(.5,3,8),major,{'line-opacity':mode==='city'?.08:.17,'line-blur':2}),
  line('local-streets','transportation',p.local,width(.08,.35,1.25),local,{'line-opacity':.8}),
  line('footpaths','transportation',p.local,width(0,.25,.7),['in',['get','class'],['literal',['path','pedestrian','track']]],{'line-opacity':.55,'line-dasharray':[2,3]}),
  line('arterial-roads','transportation',p.arterial,width(.25,.8,2.1),arterial),
  line('major-roads','transportation',p.highway,width(.4,1.3,3),major),
  line('rail-lines','transportation',p.arterial,width(.15,.4,1),['==',['get','class'],'rail'],{'line-opacity':.45,'line-dasharray':[3,3]}),
  {...line('state-boundaries','boundary',p.label,1.1,['==',['get','admin_level'],4],{'line-opacity':.46,'line-dasharray':[3,2]}),maxzoom:10},
  {...line('country-boundaries','boundary',p.label,1.4,['==',['get','admin_level'],2],{'line-opacity':.62}),maxzoom:10},
  placeLabel('regional-place-names',['city','town','village','hamlet'],4,13,{
   'text-size':['interpolate',['linear'],['zoom'],4,10,10,13]
  }),
  placeLabel('state-names',['state','province'],2,8,{
   'text-size':['interpolate',['linear'],['zoom'],2,10,6,13],
   'text-letter-spacing':.12,'text-padding':8
  }),
  {id:'neighborhood-names',type:'symbol',source:src,'source-layer':'place',minzoom:10,filter:['in',['get','class'],['literal',['suburb','neighbourhood','quarter','borough','town']]],layout:{'text-field':['coalesce',['get','name:latin'],['get','name']],'text-font':['Noto Sans Regular'],'text-size':11,'text-letter-spacing':.12,'text-transform':'uppercase','text-max-width':10},paint:{'text-color':p.label,'text-opacity':.68,'text-halo-color':p.background,'text-halo-width':2}},
  {id:'street-names',type:'symbol',source:src,'source-layer':'transportation_name',minzoom:14,layout:{'symbol-placement':'line','text-transform':'uppercase','text-field':['coalesce',['get','name:latin'],['get','name']],'text-font':['Noto Sans Regular'],'text-size':11,'text-max-angle':25,'text-padding':10},paint:{'text-color':p.label,'text-opacity':.85,'text-halo-color':p.background,'text-halo-width':1.5}},
  // Invisible POI layer keeps real business geometry available for venue discovery.
  {id:'venue-discovery',type:'circle',source:src,'source-layer':'poi',minzoom:14,paint:{'circle-radius':0,'circle-opacity':0}}
 ]};
}
