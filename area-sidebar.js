import {resolveAreaPalette} from './area-palettes.js';
import {regionSilhouettes} from './region-silhouettes.js';

const nationalArea = {level:'country',label:'United States',shortLabel:'United States',state:null};
const levels = {
  country:'National atlas', state:'State', county:'County', city:'City or community',
  borough:'Borough', neighborhood:'Neighborhood', outside:'Map area'
};
const territories = new Set(['AS','GU','MP','PR','VI']);
const number = new Intl.NumberFormat('en-US');
let activeTheme;
let activeThemeKey;
let activeHeadingKey;

function valueOf(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function jurisdictionLabel(area) {
  if (area.level === 'neighborhood' && area.approximate) return 'Nearby neighborhood';
  if (area.level !== 'state') return levels[area.level] || 'Map area';
  if (area.state?.code === 'DC') return 'Federal district';
  return territories.has(area.state?.code) ? 'U.S. territory' : 'State';
}

export function describeMapArea(area = nationalArea) {
  const level = area.level || 'country';
  const state = valueOf(area.state?.name);
  const county = valueOf(area.county), city = valueOf(area.city), borough = valueOf(area.borough);
  const name = valueOf({country:'United States', state, county, city, borough,
    neighborhood:area.neighborhood, outside:'Center outside the U.S.'}[level]) ||
    valueOf(area.shortLabel) || valueOf(area.label) || 'Map area';
  let parents;
  if (level==='outside') parents=['Choose a U.S. destination to explore the atlas'];
  else if (level==='country') parents=['U.S. restroom atlas'];
  else if (level==='state') parents=['United States'];
  else if (level==='neighborhood') parents=[borough,city || county,state];
  else if (level==='borough') parents=[city,state];
  else if (level==='city') parents=[county,state];
  else parents=[state];
  const seen=new Set([name.toLocaleLowerCase('en-US')]);
  const context=parents.filter(item=>{
    if(!item)return false;
    const lower=item.toLocaleLowerCase('en-US');
    if(seen.has(lower))return false;
    seen.add(lower);return true;
  }).join(' · ');
  const code=level==='country'?'US':level==='outside'?'':valueOf(area.state?.code);
  const searchName=name.length<=32 ? name : valueOf(area.state?.name) || 'this map area';
  const approximate=level==='neighborhood' && Boolean(area.approximate);
  return {level,name,context,code,kind:jurisdictionLabel(area),approximate,
    locationNote:approximate?'Approximate · OpenStreetMap place label':'',
    search:level==='outside'?'Search mapped places':level==='country'?'Search this map area':`Search ${searchName}`};
}

export function stateLocator(code, center) {
  const geometry=regionSilhouettes[code];
  if(!geometry)return null;
  const [mx,my,sx,sy,path]=geometry;
  if(!Number.isFinite(center?.lat)||!Number.isFinite(center?.lng))return {path,point:null};
  const delta=((center.lng-mx+180)%360+360)%360-180;
  const x=64+delta*sx, y=42-(center.lat-my)*sy;
  const point=x>=0&&x<=128&&y>=0&&y<=84 ? [x,y] : null;
  return {path,point};
}

function setText(node, text) {
  if(node && node.textContent!==text)node.textContent=text;
}
function el(id) { return document.getElementById(id); }
function httpSource(url) {
  try {
    const target=new URL(url);
    return ['https:','http:'].includes(target.protocol)?target.href:null;
  } catch {return null;}
}

function defaultTheme() {
  const scheme=resolveAreaPalette(nationalArea,[]);
  return {...scheme,id:'us',name:'United States',themeName:scheme.themeName||scheme.name};
}

export function getAreaTheme() {
  return activeTheme || defaultTheme();
}

function updateTheme(area, heading, guides) {
  const guide=['city','borough','neighborhood'].includes(heading.level) && area.guideId ?
    guides.find(item=>item.id===area.guideId) : null;
  const scheme=resolveAreaPalette(area,guides);
  const themeName=scheme.themeName || scheme.name;
  activeTheme={...scheme,id:guide?.id||'us',name:heading.name,themeName};
  // Also update when guides finish loading after the initial area resolved.
  const artwork=guide?'guide':heading.level==='country'?'national':'survey';
  const identity=[scheme.key,guide?.id||'',artwork,themeName].join('|');
  if(activeThemeKey===identity)return;
  activeThemeKey=identity;
  const root=document.documentElement;
  const art=guide?.art || (heading.level==='country'?'assets/cities/us.svg':null);
  const properties={
    '--city-deep':scheme.deep, '--city-accent':scheme.accent,'--city-highlight':scheme.highlight,
    '--city-art':art?`url("${art}")`:'none'
  };
  const swatches=Array.isArray(scheme.sourceColors)?scheme.sourceColors:[];
  ['deep','accent','highlight'].forEach((key,i)=>{
    properties['--area-swatch-'+(i+1)] = /^#[0-9a-f]{6}$/i.test(swatches[i])?swatches[i]:scheme[key];
  });
  for(const [key,value] of Object.entries(properties))root.style.setProperty(key,value);
  document.body.dataset.city=guide?.id || 'us';
  document.body.dataset.motif=guide?.motif || 'atlas';
  document.body.dataset.areaArt=artwork;
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta)meta.content=scheme.deep;
  const details=el('area-design');
  if(details){
    details.open=false;
    details.hidden=!themeName;
    setText(el('area-treatment'),themeName);
    setText(el('area-design-basis'),valueOf(scheme.basis));
    const link=el('area-design-source');
    const url=httpSource(scheme.sourceURL);
    if(link){
      link.hidden=!url;
      if(url){link.href=url;setText(link,valueOf(scheme.sourceLabel)||'Palette source');}
      else link.removeAttribute('href');
    }
  }
  const about=el('about-data-link');
  if(about){
    about.href=guide?`data/${guide.id}.json`:'data/atlas-sources.json';
    setText(about,guide?`View ${guide.name} guide data`:'Nationwide map sources');
  }
  document.dispatchEvent(new CustomEvent('areathemechange',{detail:activeTheme}));
  document.dispatchEvent(new CustomEvent('citychange',{detail:activeTheme}));
}

// Receives the resolved center of the active viewport. Destination selection,
// filters, camera, bookmarks and URL are owned by the app.
export function presentMapArea(area, guides=[], center) {
  area=area||nationalArea;
  const heading=describeMapArea(area);
  if(typeof document==='undefined')return heading;
  updateTheme(area,heading,guides);
  const headingKey=[heading.kind,heading.name,heading.code,heading.context].join('|');
  if(activeHeadingKey!==headingKey){
    activeHeadingKey=headingKey;
    document.body.dataset.areaLevel=heading.level;
    setText(el('area-name'),heading.name);
    setText(el('area-level'),heading.kind);
    setText(el('area-parent'),heading.context);
    const note=el('area-location-note');
    if(note){note.hidden=!heading.locationNote;setText(note,heading.locationNote);}
    setText(el('current-city-code'),heading.code);
    const centerLabel=heading.approximate?'Near '+heading.name:heading.name;
    setText(el('current-city-name'),centerLabel);
    const title=el('area-name');
    if(title)title.dataset.length=heading.name.length>32?'long':heading.name.length>20?'medium':'short';
    const picker=el('city-picker-btn');
    if(picker)picker.setAttribute('aria-label',`Browse destinations. Map centered ${heading.approximate ? "near "+heading.name : "on "+heading.name}.`);
    const areaLabel=[centerLabel,heading.context].filter(Boolean).join(', ');
    const map=el('map');if(map)map.setAttribute('aria-label',`Interactive restroom map. ${areaLabel}.`);
    const list=el('result-list');if(list)list.setAttribute('aria-label',`Mapped stops and areas for ${areaLabel}`);
    const search=el('search-input');
    if(search){search.placeholder=heading.search;search.setAttribute('aria-label',`Search stops in the visible map area around ${heading.name}`);}
    document.title=`IN A PINCH V5 · ${centerLabel.toUpperCase()} · RESTROOM ATLAS`;
  }
  const locator=stateLocator(heading.code,center);
  const art=el('area-locator');
  if(art){
    art.hidden=!locator;
    if(locator){
      const outline=el('area-outline');
      if(outline.getAttribute('d')!==locator.path)outline.setAttribute('d',locator.path);
      const cross=el('locator-cross');
      if(locator.point){cross.removeAttribute('hidden');cross.setAttribute('transform',`translate(${locator.point[0].toFixed(2)} ${locator.point[1].toFixed(2)})`);}
      else cross.setAttribute('hidden','');
    }
  }
  return heading;
}

export function areaCountLabels({total,restrooms,scope='view',state='loading'}={}) {
  const valid=Number.isSafeInteger(total)&&Number.isSafeInteger(restrooms)&&total>=0&&restrooms>=0&&restrooms<=total;
  const known=valid && (total>0 || state==='ready' || state==='outside');
  const catalog=scope==='cells';
  return {
    scope:catalog?'Visible atlas areas':'In view',
    note:state==='partial'?'Partial data':state==='loading'?'Loading':catalog?'Bundled atlas':'All listings',
    description:catalog?'Community-map records and additional lodging locations in atlas areas touching the screen. Some edge cells extend beyond the screen.':'All loaded places inside this view, before search and filters.',
    wc:known?number.format(restrooms):'—',other:known?number.format(total-restrooms):'—'
  };
}

export function presentAreaCounts(values) {
  const stats=areaCountLabels(values);
  if(typeof document==='undefined')return stats;
  setText(el('area-count-scope'),stats.scope);
  setText(el('area-count-scope-note'),stats.note);
  setText(el('area-count-wc'),stats.wc);
  setText(el('area-count-other'),stats.other);
  const box=el('area-counts');
  if(box){box.title=stats.description.toUpperCase();box.setAttribute('aria-label',stats.description);}
  return stats;
}
