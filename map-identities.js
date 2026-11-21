import {guideMapIdentities} from './guide-map-identities.js';
import {regionMapFamily} from './regional-map-identities.js';
import {resolveAreaPalette} from './area-palettes.js';

// Each row supplies the ground, water, vegetation, structures, main roads and
// second ink for one drawing tradition. Local flag colors are mixed in below.
const families = {
  national:['Continental atlas','meridian','#0c1c2b','#0b3148','#1e3c37','#304a59','#e9d39f','#91ddec'],
  island:['Island chart','wave','#063c40','#088791','#276342','#37655a','#fbd99f','#95efe1'],
  neon:['Neon boulevard','marquee','#231533','#154560','#303f49','#563353','#ff86bf','#60ecec'],
  metro:['City grid','grid','#1a222d','#203f58','#254438','#3b4552','#ffca57','#74c6e7'],
  bay:['Harbor chart','soundings','#162f41','#176577','#314e43','#3a515a','#ffc38d','#94e4dc'],
  coastal:['Coast chart','tideline','#133849','#246d85','#285546','#3d5763','#f2cc86','#93e4de'],
  mountain:['Alpine survey','relief','#292b43','#21506b','#305447','#4b4759','#eeca92','#adbaff'],
  desert:['Desert survey','strata','#422f36','#315964','#565442','#69505a','#ffca86','#85e1d4'],
  river:['River survey','current','#123b3b','#226379','#344e35','#415e56','#e9c67d','#9ae1c1'],
  prairie:['Plains survey','section','#333628','#275668','#51562b','#555744','#ead795','#b0da88'],
  lake:['Lakeshore chart','ripple','#183347','#245d84','#315044','#355463','#f1ce90','#9ae1ff'],
  forest:['Woodland survey','canopy','#19352f','#24596a','#386044','#3d5146','#f0d5a6','#9fdcaa'],
  capital:['Civic plan','axis','#262f49','#2d526b','#334f49','#495472','#f3d49a','#bbcdfc'],
  industrial:['Works plan','truss','#34343b','#31596a','#405044','#535663','#ffbf7e','#a7dfea'],
  delta:['Delta chart','meander','#193732','#246252','#3c5234','#435a4c','#ecc686','#a5dda1']
};
function mix(a,b,weight){
  const channels=[1,3,5].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-weight)+parseInt(b.slice(i,i+2),16)*weight));
  return '#'+channels.map(value=>value.toString(16).padStart(2,'0')).join('');
}
function hash(value){
  let n=2166136261;
  for(const c of value)n=Math.imul(n ^ c.codePointAt(0),16777619);
  return n>>>0;
}
function placeName(value){return String(typeof value==='string'?value:value?.name||'').trim();}
function channel(value){const n=value/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;}
function lum(color){return [1,3,5].reduce((sum,i,j)=>sum+channel(parseInt(color.slice(i,i+2),16))*[.2126,.7152,.0722][j],0);}
function legible(color,ground,min,toward) {
  const l=lum(ground);
  for(let i=0;i<=12;i++){
    const ink=mix(color,toward,i/12),v=lum(ink);
    if((Math.max(l,v)+.05)/(Math.min(l,v)+.05)>=min)return ink;
  }
  return toward;
}
function dayColors(inks){
  const paper=mix('#fff6e5',inks.background,.075);
  const dark='#132431';
  return {
    background:paper,water:mix('#e4fbfc',inks.water,.48),park:mix('#eef1dd',inks.park,.24),
    building:mix(paper,inks.building,.26),border:mix(dark,inks.border,.30),
    road:legible(inks.road,paper,4.3,dark),minor:legible(inks.minor,paper,3.0,dark),
    accent:legible(inks.accent,paper,4.2,dark),label:mix(dark,inks.background,.28)
  };
}
export function mapIdentity(area, guideId, scheme) {
  const level=area?.level || (guideId && guideId!=='us'?'city':'country');
  const national=['country','outside','national'].includes(level);
  const guide=national?null:guideMapIdentities[guideId || area?.guideId];
  const geo=area || {};
  const state=geo.state?.code || geo.stateCode || placeName(geo.state);
  const city=placeName(geo.city),borough=level==='borough'||level==='neighborhood'?placeName(geo.borough):'';
  const hood=level==='neighborhood'?placeName(geo.neighborhood):'';
  const locality=hood || borough || city || placeName(geo.county) || geo.state?.name || geo.shortLabel || '';
  const family=guide?.family || (national?'national':regionMapFamily(geo));
  const [familyName,motif,ground,sea,trees,block,main,glow]=families[family] || families.national;
  let placeKey=[state,level,city || placeName(geo.county) || locality,borough,hood,geo.id || ''];
  if(level==='state')placeKey=[state,level];
  if(guide)placeKey=[guideId || geo.guideId,borough,hood];
  const key=national?'national':placeKey.filter(Boolean).join('|').normalize('NFC').toLowerCase();
  const seed=hash(key),variant=seed%8;
  const colors=(scheme || resolveAreaPalette(geo)).sourceColors;
  const civic=colors[(seed>>>4)%colors.length], secondary=colors[((seed>>>4)+1)%colors.length];
  const variation=(seed>>>16)/65535;
  let inks;
  if(guide){
    inks={...guide.inks};
    if(borough || hood){
      inks.background=mix(inks.background,civic,.12+.08*variation);
      inks.building=mix(inks.building,civic,.20+.12*variation);
      inks.accent=legible(mix(inks.accent,secondary,.35),inks.background,4.5,'#fff5db');
      inks.road=legible(mix(inks.road,civic,.22),inks.background,4.8,'#fff5db');
    }
  }else{
    const local=!national, strength=local ? .25+.18*variation : .08;
    const background=mix(ground,civic,local ? .09+.085*variation : .03);
    const water=mix(sea,secondary,local ? .14+.12*variation : .05);
    const road=legible(mix(main,civic,strength),background,4.8,'#fff3d7');
    const accent=legible(mix(glow,secondary,strength),background,4.6,'#fbf9e1');
    inks={background,water,road,accent,minor:legible(mix(road,accent,.58),background,3.8,'#fff3e1'),
      park:mix(trees,secondary,strength*.6),building:mix(block,civic,strength),
      border:mix(accent,road,.40),label:'#f6f5e8'};
  }
  return {key,family,motif:guide?.motif || motif,name:guide?.name || familyName,
    description:guide?.description || (national?'A continental chart with state boundaries and grouped stops.':familyName+' linework uses local colors.'),
    variant,angle:(seed>>>5)%180,step:13+(seed>>>13)%16,intensity:.35+.6*variation,inks,lightInks:dayColors(inks)};
}
