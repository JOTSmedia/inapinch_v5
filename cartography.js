import {resolveAreaPalette} from './area-palettes.js';
import {mapIdentity} from './map-identities.js';
import {wireLayers} from './wire-world.js';

// These are physical pen choices. Widths are in screen pixels near street zoom.
// Every treatment uses the same real source features so a theme switch keeps
// the tile cache, label placement, venue queries and map camera intact.
const survey = {
  street:1.38, arterial:2.65, highway:3.75, casing:.7, halo:.12, blur:1.4,
  shore:.55, shoreBand:.9, runoff:2.1, vegetation:.2, roof:.52, roofEdge:.5,
  rail:.86, railDash:[4,3], pathDash:[2,3], bridge:.18, ferry:.42,
  waterMark:'ripple', parkMark:'grass', roofMark:'hatch', waterPrint:.21, parkPrint:.20, roofPrint:.16
};
const pens = {
  national:{street:1.3,highway:3.35,roof:.40,waterPrint:.12,parkPrint:.14,roofPrint:.08},
  island:{street:1.60,arterial:2.65,highway:3.35,casing:1.2,shore:1.25,shoreBand:3.4,runoff:1.45,
    vegetation:.32,roof:.58,rail:.6,bridge:.55,ferry:.72,pathDash:[1,3],waterMark:'shoal',parkMark:'palms',roofMark:'slats'},
  neon:{street:1.65,arterial:3.3,highway:4.4,casing:1.9,halo:.52,blur:3.4,shore:1.45,shoreBand:3.0,
    roof:.80,roofEdge:.95,bridge:.68,rail:1.25,railDash:[1,2],waterMark:'glint',parkMark:'fans',roofMark:'steps',roofPrint:.27},
  metro:{street:1.95,arterial:3.0,highway:3.65,casing:1.15,halo:.10,shore:.95,shoreBand:.65,
    roof:.94,roofEdge:.9,rail:1.9,railDash:[6,1.5],bridge:.76,pathDash:[1.5,2.5],waterMark:'dashes',parkMark:'canopy',roofMark:'brick',roofPrint:.30},
  bay:{street:1.5,arterial:2.75,highway:3.80,casing:.85,shore:1.15,shoreBand:2.9,runoff:2.3,roof:.65,
    bridge:.86,ferry:.86,railDash:[4,2],waterMark:'swell',parkMark:'canopy',roofMark:'hatch',waterPrint:.33},
  coastal:{street:1.40,arterial:3.25,highway:4.2,casing:1.25,shore:.82,shoreBand:2.5,runoff:1.85,
    bridge:.58,ferry:.60,roofEdge:.62,waterMark:'surf',parkMark:'grass',roofMark:'slats',waterPrint:.29},
  mountain:{street:1.25,arterial:2.55,highway:3.6,casing:.62,shore:.64,runoff:2.8,
    vegetation:.62,roof:.45,roofEdge:.58,rail:1.1,pathDash:[1,2],waterMark:'dashes',parkMark:'needles',roofMark:'hatch',parkPrint:.38},
  desert:{street:1.28,arterial:2.85,highway:4.1,casing:1.14,halo:.10,shore:.4,shoreBand:.4,runoff:1.65,
    vegetation:.46,roof:.62,roofEdge:.67,railDash:[6,4],pathDash:[3,2],waterMark:'glint',parkMark:'scrub',roofMark:'sand',parkPrint:.32},
  river:{street:1.50,arterial:2.90,highway:3.75,casing:.80,shore:1.10,shoreBand:1.95,runoff:3.6,
    vegetation:.4,bridge:.77,rail:1.3,railDash:[5,2],waterMark:'current',parkMark:'grass',roofMark:'hatch',waterPrint:.33},
  prairie:{street:1.32,arterial:2.70,highway:3.80,casing:.75,shore:.6,runoff:2.25,vegetation:.46,
    roof:.46,rail:1.45,railDash:[7,2],pathDash:[3,3],waterMark:'dashes',parkMark:'furrows',roofMark:'slats',parkPrint:.41},
  lake:{street:1.7,arterial:2.85,highway:3.85,casing:.80,shore:1.3,shoreBand:2.45,runoff:2.45,
    roof:.74,rail:1.58,railDash:[4,1.6],bridge:.66,ferry:.74,waterMark:'swell',parkMark:'canopy',roofMark:'brick',waterPrint:.34},
  forest:{street:1.35,arterial:2.45,highway:3.45,casing:.58,runoff:2.75,vegetation:.72,
    roof:.45,roofEdge:.42,rail:1.14,pathDash:[1,2],waterMark:'current',parkMark:'needles',roofMark:'slats',parkPrint:.44},
  capital:{street:1.55,arterial:3.8,highway:3.85,casing:1.45,halo:.17,shore:.8,shoreBand:1.3,
    vegetation:.56,roof:.80,roofEdge:.88,bridge:.62,rail:1.12,waterMark:'ripple',parkMark:'parterre',roofMark:'hatch',parkPrint:.34},
  industrial:{street:1.55,arterial:2.85,highway:4.05,casing:1.15,shore:.95,shoreBand:1.45,
    rail:2.00,railDash:[2,1.3],bridge:.81,roof:.98,roofEdge:.96,waterMark:'dashes',parkMark:'grass',roofMark:'saw',roofPrint:.43},
  delta:{street:1.45,arterial:2.8,highway:3.7,casing:.88,shore:1.12,shoreBand:2.85,runoff:3.5,
    vegetation:.59,roof:.64,bridge:.72,ferry:.75,railDash:[3,2],waterMark:'current',parkMark:'reeds',roofMark:'brick',waterPrint:.36,parkPrint:.33}
};

function descriptor(theme) {
  if(theme?.mapIdentity) return theme.mapIdentity;
  const guide=theme?.id && theme.id!=='us' ? theme.id : null;
  return mapIdentity(guide ? null : theme || {},guide);
}

export function cartographicPalette(theme, mode='wireframe') {
  const scheme=theme?.palette && theme?.lightPalette ? theme : resolveAreaPalette(theme || {},theme ? [theme] : []);
  const original=mode==='city' ? scheme.lightPalette : scheme.palette;
  // Legacy callers may supply a complete palette without area identity.
  if(!theme?.mapIdentity && theme?.palette) return {...original,building:original.local,border:original.arterial,accent:original.highway};
  const identity=descriptor(theme);
  const ink=mode==='city' ? identity.lightInks : identity.inks;
  return {...original,background:ink.background,water:ink.water,park:ink.park,building:ink.building,
    local:ink.minor,arterial:ink.accent,highway:ink.road,border:ink.border,accent:ink.accent,label:ink.label};
}

function treatment(identity) {
  const pen={...survey,...pens[identity.family]};
  // Motifs are tied to the particular city's observed street and shore form.
  switch(identity.motif) {
    case 'reef': pen.shoreBand=3.7; pen.parkMark='palms'; break;
    case 'subway': pen.rail=2.15; pen.roofEdge=1.04; break;
    case 'deco': pen.arterial=3.6; pen.roofMark='steps'; break;
    case 'ferry': pen.ferry=.97; pen.waterMark='current'; break;
    case 'wharf': pen.waterMark='dashes'; pen.roofMark='brick'; break;
    case 'suspension': pen.bridge=.96; pen.waterMark='swell'; break;
    case 'boulevard': pen.arterial=3.65; pen.casing=1.55; break;
    case 'breakwater': pen.shoreBand=3.1; pen.waterMark='shoal'; break;
    case 'marquee': pen.roofMark='glint'; pen.railDash=[3,2]; break;
    case 'truss': pen.bridge=.92; break;
    case 'loop': pen.rail=1.95; pen.railDash=[6,1.4]; break;
    case 'batwing': pen.parkMark='reeds'; break;
    case 'broadway': pen.arterial=3.4; pen.roofMark='brick'; break;
    case 'crescent': pen.shoreBand=3.15; pen.parkMark='reeds'; break;
    case 'radial': pen.arterial=3.95; pen.vegetation=.63; break;
    case 'front-range': pen.vegetation=.67; pen.pathDash=[1,1.65]; break;
    case 'canal': pen.runoff=3.45; pen.waterMark='dashes'; break;
    case 'canopy': pen.parkMark='canopy'; pen.parkPrint=.45; break;
    case 'tideway': pen.waterMark='current'; pen.shoreBand=2.85; pen.parkMark='reeds'; break;
    case 'squares': pen.parkMark='parterre'; pen.vegetation=.79; pen.arterial=2.85; break;
    case 'fountain': pen.waterMark='ripple'; pen.shoreBand=2.85; pen.rail=.93; break;
    case 'outrigger': pen.waterMark='surf'; pen.shoreBand=2.45; pen.arterial=3.05; break;
    case 'lattice': pen.roofMark='hatch'; pen.arterial=3.05; pen.railDash=[6,2]; break;
    case 'bayou': pen.runoff=3.5; pen.parkMark='reeds'; pen.shoreBand=2.55; break;
  }
  return pen;
}

const glyphs = {
  ripple:[[[0,6],[3,5],[6,6]]], swell:[[[0,6],[3,4],[6,4],[9,6],[12,6]]],
  surf:[[[0,7],[4,5],[7,5],[10,7]],[[2,9],[5,8]]],
  current:[[[0,7],[4,7],[8,4],[12,4]],[[7,8],[10,6]]],
  shoal:[[[0,6],[2,4],[4,6],[6,4],[8,6]],[[10,8],[11,8]]],
  glint:[[[2,5],[8,5]],[[5,2],[5,8]]], dashes:[[[0,5],[6,5]],[[9,5],[10,5]]],
  grass:[[[2,7],[1,5]],[[3,7],[3,3]],[[4,7],[6,5]]],
  palms:[[[4,8],[5,4],[2,3]],[[5,4],[5,2],[7,2]],[[5,4],[8,4],[9,5]]],
  fans:[[[1,6],[4,8],[8,3]],[[4,8],[3,3]]], canopy:[[[2,6],[2,4],[4,3],[6,5],[4,7],[2,6]]],
  needles:[[[1,7],[4,3],[7,7]],[[3,7],[4,5],[5,7]]],
  scrub:[[[1,8],[4,6],[6,7]],[[4,6],[4,3]]], furrows:[[[1,6],[6,2]],[[3,8],[8,4]],[[6,9],[10,6]]],
  parterre:[[[1,5],[4,2],[7,5],[4,8],[1,5]]], reeds:[[[2,8],[1,3]],[[4,8],[4,1]],[[6,8],[7,4]]],
  hatch:[[[1,7],[6,2]],[[5,7],[10,2]]], slats:[[[0,4],[8,4]],[[0,7],[8,7]]],
  brick:[[[0,4],[9,4]],[[4,4],[4,7]],[[6,7],[10,7]]],
  steps:[[[0,8],[0,5],[3,5],[3,2],[6,2]],[[3,9],[3,7],[6,7],[6,4],[8,4]]],
  sand:[[[1,7],[4,6]],[[7,3],[8,3]],[[8,8],[10,7]]],
  saw:[[[0,7],[3,3],[3,7],[6,3],[6,7],[9,3]]]
};

// Tileable, transparent 32px stamps. Fills clip them to the actual water,
// vegetation and building polygons. No map-sized ornamental texture is used.
function stamp(mark, color, rotation, phase) {
  const size=32, data=new Uint8Array(size*size*4);
  const rgb=color.slice(1).match(/../g).map(v=>parseInt(v,16));
  const cos=Math.cos(rotation), sin=Math.sin(rotation);
  function dot(x,y,ox,oy){
    const a=(x-5)*cos-(y-5)*sin+ox, b=(x-5)*sin+(y-5)*cos+oy;
    const u=Math.floor(a),v=Math.floor(b);
    for(let dy=0;dy<=1;dy++) for(let dx=0;dx<=1;dx++){
      const i=4*(((v+dy+size)%size)*size+(u+dx+size)%size);
      const alpha=Math.round(230*(1-Math.abs(a-u-dx))*(1-Math.abs(b-v-dy)));
      data[i]=rgb[0];data[i+1]=rgb[1];data[i+2]=rgb[2];data[i+3]=Math.max(data[i+3],alpha);
    }
  }
  for(const [ox,oy] of [[7+phase,8],[23+phase,24]]) for(const path of glyphs[mark]){
    for(let j=1;j<path.length;j++){
      const [x,y]=path[j-1],[a,b]=path[j],steps=Math.ceil(Math.hypot(a-x,b-y)*2);
      for(let i=0;i<=steps;i++) dot(x+(a-x)*i/steps,y+(b-y)*i/steps,ox,oy);
    }
  }
  return {width:size,height:size,data};
}

export function mapPatterns(theme,mode='wireframe'){
  const identity=descriptor(theme),pen=treatment(identity),p=cartographicPalette(theme,mode);
  const angle=((identity.angle || 0)%180-90)*Math.PI/720,phase=Number(identity.variant)||0;
  return {
    'atlas-water-print':stamp(pen.waterMark,p.border,0,phase),
    'atlas-park-print':stamp(pen.parkMark,p.local,angle,phase),
    'atlas-roof-print':stamp(pen.roofMark,p.local,angle,phase)
  };
}

const src='openmaptiles';
const classes=(...names)=>['in',['get','class'],['literal',names]];
const major=classes('motorway','trunk','primary'), arterial=classes('secondary','tertiary');
const local=classes('minor','service','street','residential','unclassified','living_street');
const rail=classes('rail','transit');
const green=classes('wood','forest','grass','wetland','scrub','farmland','heath','meadow');
const width=(a,b,c)=>['interpolate',['linear'],['zoom'],7,a,12,b,17,c];
const zoomOpacity=(value,start,end)=>['interpolate',['linear'],['zoom'],start,0,end,value];
function line(id,layer,color,stroke,filter,extra={}) {
  return {id,type:'line',source:src,'source-layer':layer,...(filter?{filter}:{}),
    layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':color,'line-width':stroke,...extra}};
}
function fill(id,layer,paint,filter) {
  return {id,type:'fill',source:src,'source-layer':layer,...(filter?{filter}:{}),paint};
}

export function buildMapStyle(city,mode='wireframe') {
 const p=cartographicPalette(city,mode),identity=descriptor(city),pen=treatment(identity);
 const daylight=mode==='city';
 const pressure=.94+(identity.intensity ?? .5)*.12;
 const roadWidth=(small,middle,large)=>width(small,middle,Number((large*pressure).toFixed(2)));
 const labelName=['coalesce',['get','name:en'],['get','name:latin'],['get','name']];
 const labelPaint={'text-color':p.label,'text-halo-color':p.background,'text-halo-width':1.4};
 const placeLabel=(id,groups,minzoom,maxzoom,layout)=>({
  id,type:'symbol',source:src,'source-layer':'place',minzoom,maxzoom,filter:classes(...groups),
  layout:{'text-field':labelName,'text-transform':'uppercase','text-font':['Noto Sans Regular'],'text-size':12,'text-padding':5,'symbol-sort-key':['to-number',['get','rank'],99],...layout},
  paint:labelPaint
 });
 return {version:8,name:`IN A PINCH · ${city.name} · ${identity.name}`,
  metadata:{cityId:city.id,mode,theme:p.name,family:identity.family,motif:identity.motif},
  transition:{duration:160,delay:0},glyphs:'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources:{'wire-world':{type:'geojson',data:{type:'FeatureCollection',features:[]},tolerance:.35,buffer:96},[src]:{type:'vector',url:'https://tiles.openfreemap.org/planet',attribution:'© OpenFreeMap © OpenMapTiles · Data © OpenStreetMap contributors'}},layers:[
  {id:'background',type:'background',paint:{'background-color':p.background}},
  fill('green-space','landcover',{'fill-color':p.park,'fill-opacity':.77},green),
  fill('parks','park',{'fill-color':p.park,'fill-opacity':.88}),
  fill('vegetation-print','landcover',{'fill-pattern':'atlas-park-print','fill-opacity':zoomOpacity(pen.parkPrint,8,13)},green),
  fill('park-print','park',{'fill-pattern':'atlas-park-print','fill-opacity':zoomOpacity(pen.parkPrint*.75,11,15)}),
  line('park-edges','park',p.local,width(.15,.45,1.25),null,{'line-opacity':pen.vegetation}),
  fill('water','water',{'fill-color':p.water}),
  fill('charted-water','water',{'fill-pattern':'atlas-water-print','fill-opacity':zoomOpacity(identity.motif==='reef'?0:pen.waterPrint,7,12)}),
  // The broad and narrow strokes share the same mapped shoreline. Their
  // centerlines coincide; widths and opacity produce a crisp inner keyline.
  line('shore-band','water',p.border,width(.16,pen.shoreBand,pen.shoreBand*1.9),null,{'line-opacity':daylight?.14:.22}),
  line('shoreline','water',p.border,width(.12,pen.shore*.6,pen.shore),null,{'line-opacity':.68}),
  line('waterways','waterway',p.water,width(.4,1,pen.runoff)),
  {...fill('building-ink','building',{'fill-color':p.building,'fill-opacity':pen.roof}),minzoom:13},
  {...fill('roof-print','building',{'fill-pattern':'atlas-roof-print','fill-opacity':zoomOpacity(pen.roofPrint,15,17)}),minzoom:15},
  line('building-contours','building',p.local,width(0,.12,pen.roofEdge),null,{'line-opacity':daylight?.60:.52}),
  ...wireLayers(p,mode),
  line('ferry-routes','transportation',p.accent,width(.25,.7,1.5),classes('ferry'),{'line-opacity':pen.ferry,'line-dasharray':[2,4]}),
  line('major-road-glow','transportation',p.accent,roadWidth(1.2,3.5,pen.highway+pen.casing*3.2),major,{'line-opacity':daylight?pen.halo*.68:Math.min(.64,.20+pen.halo),'line-blur':pen.blur}),
  line('main-road-casings','transportation',p.border,roadWidth(.45,1.75,pen.highway+2*pen.casing),major,{'line-opacity':daylight?.64:.52}),
  line('avenue-casings','transportation',p.border,roadWidth(.25,1.04,pen.arterial+1.5*pen.casing),arterial,{'line-opacity':daylight?.50:.40}),
  line('bridge-decks','transportation',p.accent,roadWidth(.5,2.8,pen.highway+2*pen.casing+1.5),
    ['all',['==',['get','brunnel'],'bridge'],['any',major,arterial,local]],{'line-opacity':pen.bridge}),
  line('local-streets','transportation',p.local,roadWidth(.12,.48,pen.street),local,{'line-opacity':.90}),
  line('footpaths','transportation',p.local,width(0,.27,.94),classes('path','pedestrian','track'),{'line-opacity':.65,'line-dasharray':pen.pathDash}),
  line('arterial-roads','transportation',p.arterial,roadWidth(.28,.94,pen.arterial),arterial),
  line('major-roads','transportation',p.highway,roadWidth(.46,1.45,pen.highway),major),
  line('rail-lines','transportation',p.accent,width(.18,.55,pen.rail),rail,{'line-opacity':.72,'line-dasharray':pen.railDash}),
  {...line('state-boundaries','boundary',p.border,1.15,['==',['get','admin_level'],4],{'line-opacity':.60,'line-dasharray':[3,2]}),maxzoom:10},
  {...line('country-boundaries','boundary',p.label,1.4,['==',['get','admin_level'],2],{'line-opacity':.62}),maxzoom:10},
  placeLabel('regional-place-names',['city','town','village','hamlet'],4,13,{
   'text-size':['interpolate',['linear'],['zoom'],4,10,10,13]
  }),
  placeLabel('state-names',['state','province'],2,8,{
   'text-size':['interpolate',['linear'],['zoom'],2,10,6,13],
   'text-letter-spacing':.12,'text-padding':8
  }),
  {id:'neighborhood-names',type:'symbol',source:src,'source-layer':'place',minzoom:10,filter:classes('suburb','neighbourhood','quarter','borough','town'),layout:{'text-field':labelName,'text-font':['Noto Sans Regular'],'text-size':11,'text-letter-spacing':.12,'text-transform':'uppercase','text-max-width':10},paint:{'text-color':p.label,'text-opacity':.82,'text-halo-color':p.background,'text-halo-width':2}},
  {id:'street-names',type:'symbol',source:src,'source-layer':'transportation_name',minzoom:14,layout:{'symbol-placement':'line','text-transform':'uppercase','text-field':labelName,'text-font':['Noto Sans Regular'],'text-size':11,'text-max-angle':25,'text-padding':10},paint:{'text-color':p.label,'text-opacity':.95,'text-halo-color':p.background,'text-halo-width':1.5}},
  {id:'venue-discovery',type:'circle',source:src,'source-layer':'poi',minzoom:14,paint:{'circle-radius':0,'circle-opacity':0}}
 ]};
}
