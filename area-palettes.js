import {regionFlagInks} from './flag-palettes.js';
import {guideInks,boroughInks} from './city-inks.js';
import {municipalPalettes} from './municipal-palettes.js';

const nationalInk={name:'Continental survey',basis:'Blue, red and pale paper tones draw on the United States flag.',sourceLabel:'U.S. Government Publishing Office · Our Flag',sourceURL:'https://www.govinfo.gov/app/details/CDOC-109sdoc18',colors:['#29486b','#bc3f42','#e9dfc3']};
const guideNames={
  'FL|key west':'key-west','NY|new york city':'nyc','NY|new york':'nyc','FL|miami':'miami','CA|los angeles':'la','TX|austin':'austin','CA|san francisco':'sf',
  'IL|chicago':'chicago','WA|seattle':'seattle','LA|new orleans':'new-orleans','TN|nashville':'nashville','MA|boston':'boston','DC|washington':'dc','DC|washington dc':'dc',
  'CA|san diego':'san-diego','OR|portland':'portland','CO|denver':'denver','NV|las vegas':'las-vegas','AZ|phoenix':'phoenix','GA|atlanta':'atlanta',
  'SC|charleston':'charleston','GA|savannah':'savannah','FL|orlando':'orlando','HI|honolulu':'honolulu','HI|urban honolulu':'honolulu','TX|dallas':'dallas','TX|houston':'houston',
  'NJ|jersey city':'jersey-city','NJ|hoboken':'hoboken','NJ|trenton':'trenton','NJ|newark':'newark-nj','NJ|montclair':'montclair',
  'PA|philadelphia':'philadelphia','PA|pittsburgh':'pittsburgh','MI|detroit':'detroit','IN|indianapolis':'indianapolis','IN|indianapolis city balance':'indianapolis',
  'NY|buffalo':'buffalo','WI|milwaukee':'milwaukee','MN|minneapolis':'minneapolis','MO|kansas city':'kansas-city-mo','MO|st louis':'st-louis',
  'NC|charlotte':'charlotte','FL|tampa':'tampa','TX|san antonio':'san-antonio','CA|san jose':'san-jose','MD|baltimore':'baltimore','CA|sacramento':'sacramento'
};
const text=value=>typeof value==='string'?value.trim():value?.name?.trim()||value?.label?.trim()||'';
const normalized=s=>s.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[’ʻ‘']/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const regionCodes=Object.fromEntries(Object.entries(regionFlagInks).map(([code,ink])=>[normalized(ink.region),code]));
const boroughNames={'the bronx':'bronx','staten island borough':'staten island'};
function regionCode(area) {
  const raw=area.stateCode||area.state?.code||area.region?.code||area.state||area.region||area.code||'';
  const name=text(raw);
  return regionFlagInks[name.toUpperCase()]?name.toUpperCase():regionCodes[normalized(name)]||'';
}

function bytes(hex) {return hex.slice(1).match(/../g).map(pair=>parseInt(pair,16));}
function hex(channels) {return '#'+channels.map(n=>Math.max(0,Math.min(255,Math.round(n))).toString(16).padStart(2,'0')).join('');}
function mix(first,second,t){
  const a=bytes(first),b=bytes(second);
  return hex(a.map((channel,i)=>channel*(1-t)+b[i]*t));
}
function luminance(color){
  const values=bytes(color).map(value=>{const s=value/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;});
  return values[0]*.2126+values[1]*.7152+values[2]*.0722;
}
function contrastRatio(a,b){const l1=luminance(a),l2=luminance(b);return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);}
function contrastInk(ink,ground,target,toward){
  if(contrastRatio(ink,ground)>=target)return ink;
  // Binary search changes the source ink only as much as the target requires.
  let low=0,high=1;
  for(let i=0;i<8;i++){
    const middle=(low+high)/2;
    if(contrastRatio(mix(ink,toward,middle),ground)<target)low=middle;else high=middle;
  }
  return mix(ink,toward,high);
}
function seed(value) {
  let hash=2166136261;
  for(const character of value){hash^=character.codePointAt(0);hash=Math.imul(hash,16777619);}
  return hash>>>0;
}
function cartographicInks(reference,key,regionalVariation){
  const [a,b,c]=reference.colors;
  // Independently vary source-ink mixtures using the full place hierarchy.
  // Administrative boundaries, rather than pan position, anchor a treatment.
  const grain=seed(key),phase=(grain&255)/255,tone=((grain>>>8)&255)/255,weight=((grain>>>16)&255)/255;
  const family=(grain>>>24)%3;
  const primary=regionalVariation?[a,c,b][family]:a;
  const secondary=regionalVariation?[b,a,c][family]:b;
  const counter=regionalVariation?[c,b,a][family]:c;
  const ink=mix(primary,counter,.06+tone*(regionalVariation ? .31 : .13));
  const route=mix(secondary,counter,phase*(regionalVariation ? .25 : .13));
  const side=mix(counter,primary,.12+.31*weight);
  const background=mix('#0a121c',ink,.10+.09*phase);
  const water=mix('#082031',mix(ink,'#3988ab',.33),.12+.12*tone);
  const park=mix(background,mix(side,'#468265',.6),.32+.06*weight);
  const local=contrastInk(mix(side,'#8b9b9e',.36),background,3.8,'#e0ecea');
  const arterial=contrastInk(side,background,5.8,'#f3e9d5');
  const highway=contrastInk(route,background,6.2,'#fff0ce');
  const label=contrastInk(mix('#e5ede8',ink,.12),background,8,'#ffffff');
  const paper=mix('#fbf9f3',ink,.035+.025*weight);
  const darkText='#10232e';
  const lightPalette={name:reference.name,background:paper,water:mix('#c3deeb',ink,.11),park:mix('#dbe9d4',counter,.10),
    local:contrastInk(mix('#a9afa9',side,.20),paper,2.65,darkText),arterial:contrastInk(side,paper,4.0,darkText),
    highway:contrastInk(route,paper,4.7,darkText),label:contrastInk(mix(darkText,ink,.30),paper,7,darkText)};
  const deep=contrastInk(mix('#102734',ink,.30), '#ffffff',8,darkText);
  return {palette:{name:reference.name,background,water,park,local,highway,arterial,label},lightPalette,deep,
    accent:contrastInk(mix(ink,route,.25),'#ffffff',4.8,darkText),
    highlight:contrastInk(route,deep,6,'#fff2d8')};
}
const municipalIndex=new Map();
for(const row of Object.values(municipalPalettes)){
  if(!row?.state||!row?.city||!row.colors?.length)continue;
  municipalIndex.set(row.state.toUpperCase()+'|'+normalized(row.city),row);
}

export function resolveAreaPalette(area={},guides=[]) {
  area=area||{};
  const level=area.level||area.kind||'';
  // The country view retains its center state for geography, but uses U.S. inks.
  if(['country','national','outside'].includes(level))area={level};
  const explicitId=area.guideId||area.id||'';
  const guide=guides.find(c=>c.id===explicitId);
  const state=regionCode(area)||regionCode(guide||{});
  const isGuide=Boolean(guideInks[explicitId]);
  let city=text(area.city)||((level==='city'||isGuide)?text(area.name):'');
  const rawBorough=normalized(text(area.borough));
  let borough=boroughNames[rawBorough]||rawBorough.replace(/ borough$/,'');
  if(state==='NY'&&!borough&&boroughInks[normalized(city)]){borough=normalized(city);city='New York City';}
  const neighborhood=text(area.neighborhood),county=text(area.county);
  const cityKey=state+'|'+normalized(city);
  const guideId=guideNames[cityKey]||((!city||isGuide&&normalized(city)===normalized(text(guide?.name)))&&isGuide?explicitId:'');
  const isNYC=state==='NY'&&(guideId==='nyc'||!city||normalized(city)==='new york');
  const boroughRef=isNYC?boroughInks[borough]:null;
  const municipality=municipalIndex.get(cityKey);
  const regionalRef=regionFlagInks[state];
  let reference=boroughRef||guideInks[guideId]||municipality||regionalRef||nationalInk;
  // Recognized guide fixtures may lack a name/code until the city list loads.
  if(!state&&!city&&isGuide)reference=guideInks[explicitId];
  const sourceScope=boroughRef?'borough':guideInks[guideId]||municipality?'city':regionalRef?'region':'national';
  const local=sourceScope==='borough'?borough:city||county;
  const section=[state,normalized(city||county),borough,normalized(neighborhood)].filter(Boolean);
  const key=[sourceScope,reference.name,...section].join('|');
  const regionalVariation=sourceScope==='region'&&Boolean(local||neighborhood);
  let name=reference.name;
  let basis=reference.basis;
  if(regionalVariation){
    name=(neighborhood||city||county)+' · '+reference.name;
    basis+=' This local variation changes the balance of those colors.';
  }else if(neighborhood){name=neighborhood+' · '+reference.name;}
  const refColors=reference.colors.length>=3?reference.colors:[reference.colors[0],reference.colors[1]||'#f4eee0',reference.colors[0]];
  const style=cartographicInks({...reference,name,colors:refColors},key,regionalVariation);
  return {key,name,themeName:name,basis,sourceScope,sourceLabel:reference.sourceLabel,sourceURL:reference.sourceURL,sourceColors:[...refColors],...style};
}
