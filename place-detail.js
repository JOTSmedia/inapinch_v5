import {escapeHTML as e, scheduleStatus, directionsURL, distanceMiles, isRoadside, isFoodVenue, isLodging, businessListingURL} from './logic.js';

const paths = {
  public:'<path d="M3 5h7v7H3zm0 7h14c0 4-2 6-6 6H8c-3 0-5-2-5-6Zm5 6v3h6v-4m1-11 2 2 4-5"/>',
  transit:'<rect x="5" y="3" width="14" height="15" rx="4"/><path d="M5 11h14m-7-8v8M8 18l-3 4m11-4 3 4M9 14h.1m5.9 0h.1"/>',
  culture:'<path d="M3 21h18M4 8l8-5 8 5H4Zm2 2v7m4-7v7m4-7v7m4-7v7M4 18h16"/>',
  mixed:'<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
  road:'<path d="m8 3-5 18m13-18 5 18M12 3v3m0 4v4m0 4v3"/>',
  shop:'<path d="M4 10h16v11H4Zm-1 0 2-6h14l2 6M9 10v2m6-2v2m-6 9v-6h6v6"/>',
  toilet:'<path d="M4 3h6v8H4zM4 11h16c0 4.5-3.5 7-7 7h-2c-4 0-7-2.5-7-7Zm5 7v3h7l-1-3M18 8v3"/>',
  shower:'<path d="M4 21V7a4 4 0 0 1 8 0v1m-3 4a4 4 0 0 1 8 0Zm1 4-1 2m5-2-1 2m5-2-1 2"/>',
  fuel:'<path d="M4 21V5a1 1 0 0 1 1-1h8v17M3 21h12M5 7h6v5H5zm8 6h2c2 0 1 5 3 5 1 0 2-1 2-3v-5l-4-4"/>',
  food:'<path d="M4 3v5a3 3 0 0 0 6 0V3M7 3v18m12 0V3c-3 1.5-5 5-5 10h5"/>',
  bed:'<path d="M3 19V6m18 13v-8a2 2 0 0 0-2-2h-7v6m-9 0h18m-17 0V9h4a3 3 0 0 1 3 3v3"/>',
  glass:'<path d="M3 4h18l-9 10-9-10Zm9 10v6m-5 1h10M7 8h10"/>',
  cup:'<path d="M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 9h2a3 3 0 0 1 0 6h-2M3 21h16M7 3v2m5-2v2"/>',
  book:'<path d="M3 5c4-1 6-.5 9 2 3-2.5 5-3 9-2v13c-4-1-6-.5-9 2-3-2.5-5-3-9-2V5Zm9 2v13"/>',
  tree:'<path d="m12 2 5 7h-2l5 7h-6v5h-4v-5H4l5-7H7z"/>',
  building:'<path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h1m4 0h1m-6 4h1m4 0h1m-4 8v-4h4v4"/>',
  pin:'<path d="M20 10c0 5.5-8 12-8 12S4 15.5 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  walk:'<circle cx="14" cy="4" r="2"/><path d="m7 11 4-4 4 3 4 1M10 16l-3 6m5-10-2 4 5 2 2 4M11 7l1 5"/>',
  drive:'<path d="m3 13 2-6h14l2 6v5H3zm0 0h18M5 18v2m14-2v2m-13-5h2m8 0h2"/>',
  save:'<path d="M6 4h12v17l-6-4-6 4z"/>',
  share:'<path d="M12 16V3m-5 5 5-5 5 5M5 14v7h14v-7"/>',
  phone:'<path d="M5 3h4l2 5-3 2a14 14 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2A18 18 0 0 1 3 5a2 2 0 0 1 2-2Z"/>',
  source:'<path d="M14 3h7v7m-1-6-10 10M10 4H4v16h16v-6"/>',
  copy:'<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h4"/>',
  check:'<path d="m4 12 5 5L20 6"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>'
};
export function symbol(name) {
  return '<svg class="stop-icon" aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + (paths[name] || paths.pin) + '</svg>';
}

export function detailCategoryIcon(place) {
  const category=place.category || '';
  if (isLodging(place) || /hostel|guesthouse|guest house/i.test(category)) return 'bed';
  if (place.access==='public' && place.bathroomConfirmed===true && /restroom|toilet|public facility/i.test(category)) return 'public';
  if (/restroom|toilet/i.test(category)) return 'toilet';
  if (/shower/i.test(category)) return 'shower';
  if (/rest area|rest stop|service area|service plaza/i.test(category)) return 'road';
  if (isRoadside(place)) return 'fuel';
  if (/café|cafe|coffee|bakery|ice cream/i.test(category)) return 'cup';
  if (/\bbar\b|\bpub\b|beer garden|nightclub/i.test(category)) return 'glass';
  if (/store|supermarket|market|mall|pharmacy|laundromat|garden center/i.test(category)) return 'shop';
  if (isFoodVenue(place)) return 'food';
  if (place.showers===true) return 'shower';
  if (/station|bus terminal|ferry terminal|airport|transit/i.test(category)) return 'transit';
  if (/museum|arts cent|theat|cinema|stadium|sports|fitness|ice rink|zoo/i.test(category)) return 'culture';
  if (/library/i.test(category)) return 'book';
  if (/park|beach|campground|garden|picnic/i.test(category)) return 'tree';
  return 'building';
}

export function publishedPhone(value) {
  if (typeof value !== 'string') return null;
  const label=value.trim();
  const match=/^([+\d().\s-]+?)(?:\s*(?:x|ext\.?|extension)\s*(\d{1,6}))?$/i.exec(label);
  if (!match) return null;
  const digits=match[1].replace(/\D/g,'');
  if (!/^1?[2-9]\d{2}[2-9]\d{6}$/.test(digits)) return null;
  return {label,href:'tel:+1'+digits.slice(-10)+(match[2]?';ext='+match[2]:'')};
}

function webURL(value) {
  if (typeof value!=='string' || !value.trim()) return null;
  try {const url=new URL(value);return ['http:','https:'].includes(url.protocol) ? url.href : null;}
  catch {return null;}
}
function sourceLinks(place) {
  const links=new Map();
  for(const source of place.sources || []) {
    const href=webURL(source?.url);
    if(href && !links.has(href)) links.set(href,source.label || new URL(href).hostname);
  }
  return [...links].map(([href,label])=>`<a href="${e(href)}" target="_blank" rel="noopener">${e(label)}${symbol('source')}</a>`).join('');
}
function coordinates(place) {
  return Number.isFinite(place.lat) && Number.isFinite(place.lng) && Math.abs(place.lat)<=90 && Math.abs(place.lng)<=180
    ? place.lat.toFixed(5)+', '+place.lng.toFixed(5) : '';
}
export function detailAreaLabel(place, guide, area) {
  if (typeof area==='string' && area.trim()) return area.trim();
  const neighborhood=place.neighborhood?.replace(/ area$/i,'');
  const sourceArea=neighborhood || [place.locality,place.state].filter(Boolean).join(', ');
  // A coarse state/country fix must not displace a more precise locality on the record.
  if(area?.level!=='outside' && area){
    if(['country','state'].includes(area.level) && sourceArea)return sourceArea;
    const state=typeof area.state==='object' ? (area.state?.code || area.state?.name) : area.state;
    const parts=[area.neighborhood,area.borough,area.city || area.locality || area.county,area.stateCode || state]
      .filter(x=>typeof x==='string' && x.trim()).map(x=>x.trim());
    if(parts.length && (area.neighborhood || area.borough || area.city || area.locality || area.county))return [...new Set(parts)].join(', ');
    if(typeof area.label==='string' && area.label.trim())return area.label.trim();
    if(parts.length)return parts.join(', ');
  }
  if(sourceArea)return sourceArea;
  return guide && guide.id===place.cityId && guide.id!=='us' ? [guide.name,guide.state].filter(Boolean).join(', ') : '';
}
function evidence(place) {
  if (isLodging(place)) return place.bathroomConfirmed===true
    ? {label:'Restroom documented at this property',tone:'documented',icon:'check'}
    : {label:'Lobby restroom unconfirmed',tone:'unconfirmed',icon:'info'};
  if(place.bathroomConfirmed===true){
    const mapped=['osm','osm-venue','vector-poi','osm-atlas'].includes(place.evidenceType);
    return {label:mapped?'Community-mapped restroom':'Documented restroom',tone:'documented',icon:'check'};
  }
  return {label:'Restroom unconfirmed',tone:'unconfirmed',icon:'info'};
}
function admission(place) {
  if (isLodging(place)) {
    const visitorRules={public:'Public restroom access listed',paid:'Paid restroom access listed',customers:'Restroom access listed for customers'};
    return place.bathroomConfirmed===true && visitorRules[place.access] || 'Visitor restroom access unconfirmed';
  }
  const main={public:'Public access',paid:'Admission required',customers:'Customer access · purchase may be required'};
  return main[place.access] || 'Entry rules and fees unconfirmed';
}
function usefulAccessNote(place) {
  const value=place.accessNote?.trim() || '';
  if(isLodging(place) && value==='Ask the front desk whether visitors may use a lobby restroom.')return '';
  // Omit generic database messages already represented by the access/evidence fields.
  if(!value || /^(public (park |beach )?restrooms?$|public restroom documented; check the operator for closures\.?$|bathroom access has not been verified|bathroom access, fees|a restroom is mapped here, but public access|ask staff about (restroom|bathroom) access|check onsite for access|check with the travel stop about restroom access|check posted entry rules, hours|purchase likely required\. ask staff|restroom access and opening hours are unverified)/i.test(value)) return '';
  return value;
}
function arrivalNote(place){
  const note=place.note?.trim() || '';
  if(!note) return '';
  if(/^(this location appears in the FHWA truck parking inventory|this stop appears in the Pilot location directory|love’s lists this facility|love's lists this facility|this location is listed by TravelCenters|mapped business location|community-mapped restroom point|this location may have a bathroom|a restroom is mapped here|this bar or restaurant is a mapped venue|this is a real venue to check|this is a public library|this public library location was reported in the federal survey|the federal survey gives an approximate pin for this branch|the survey identifies this as a library)/i.test(note)) return '';
  const cleaned=note.replace(/^Published restroom information is linked below\. This pin marks the facility area; follow restroom signs on arrival\. Access may change\.?\s*/i,'').replace(/^Library outlet listed in the IMLS Public Libraries Survey\..*$/i,'').trim();
  return cleaned===place.accessNote ? '' : cleaned;
}
function fact(label,value) {
  return `<div class="stop-fact"><dt>${e(label)}</dt><dd>${e(value)}</dd></div>`;
}
function recordedDate(place,fallback) {
  if(place.sourceUpdatedAt && /^\d{4}-\d\d-\d\d/.test(place.sourceUpdatedAt)) return 'Map edit · '+place.sourceUpdatedAt.slice(0,10);
  return place.checkedLabel || (place.sourceSnapshot?'Map snapshot · '+place.sourceSnapshot:'') || fallback || '';
}
function sourceKind(place) {
  if(place.evidenceType==='operator-directory'||place.evidenceType==='operator')return 'Operator information';
  if(place.evidenceType==='federal-inventory')return 'Federal highway inventory';
  if(place.evidenceType==='official')return 'Published facility information';
  if(place.evidenceType==='public-library'||place.id?.startsWith('us-library-'))return 'Public library survey';
  if(['osm','osm-venue','vector-poi','osm-atlas'].includes(place.evidenceType))return 'OpenStreetMap contributors';
  return 'Listing sources';
}

export function showerDescription(place) {
  if (place.showers!==true) return place.showers===false ? 'The source reports no showers' : '';
  const count=place.showerCount;
  if(Number.isInteger(count) && count>0) return count+(count===1?' shower listed':' showers listed');
  return 'Showers listed';
}

const diningCategories={restaurant:'Restaurant',bar:'Bar',pub:'Pub',biergarten:'Beer garden',cafe:'Café',fast_food:'Fast food',food_court:'Food hall',nightclub:'Nightclub',ice_cream:'Ice cream',bakery:'Bakery'};

function venueNameKey(value) {
  return value.normalize('NFKD').replace(/\p{Mark}/gu,'').toLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu,' ').trim();
}
function diningList(title, entries) {
  if(!entries.length) return '';
  const items=entries.map(item=>
    `<li><a href="${e(item.href)}" target="_blank" rel="noopener"${item.source?' title="'+e(item.source.toUpperCase())+'"':''}>${e(item.name)}${symbol('source')}</a>${item.caption?`<span>${e(item.caption)}</span>`:''}</li>`
  );
  return `<h4>${e(title)}</h4><ul>${items.slice(0,3).join('')}</ul>${items.length>3?`<details class="stop-more"><summary>${items.length-3} more listings</summary><ul>${items.slice(3).join('')}</ul></details>`:''}`;
}

function mappedHotelFacilities(place) {
  if(!Array.isArray(place.onSiteFacilities)) return '';
  const facilities=[];
  for(const item of place.onSiteFacilities) {
    const kind={toilets:'Restroom',shower:'Shower',showers:'Shower'}[item?.kind];
    const href=webURL(item?.sourceUrl);
    if(!kind || !href || item.evidenceType!=='mapped-footprint') continue;
    const name=typeof item.name==='string' && item.name.trim();
    facilities.push({name:name || kind,href,caption:name?kind:coordinates(item),source:'Open the mapped facility record'});
  }
  return facilities.length ? `<div class="stop-dining">${diningList('Facilities mapped inside the property footprint',facilities)}<p class="stop-footnote">Visitor entry is unconfirmed for these mapped facilities.</p></div>` : '';
}
function hotelDining(place, nearbyDining) {
  const official=[], documented=[], mapped=[], nearby=[], knownIds=new Set(), knownNames=new Map();
  const venues=Array.isArray(place.onSiteDining)?place.onSiteDining:[];
  function seen(venue) {
    const key=venueNameKey(venue.name);
    if(!key || (venue.id && knownIds.has(venue.id))) return true;
    if(venue.id) knownIds.add(venue.id);
    const others=knownNames.get(key) || [];
    const duplicate=others.some(other=>!coordinates(other) || !coordinates(venue) || distanceMiles(other,venue)<0.012);
    others.push(venue);
    knownNames.set(key,others);
    return duplicate;
  }
  // Prefer the operator citation if an independent mapped point names the same dining room.
  for(const [group,list] of [['operator',official],['documented',documented],['mapped-footprint',mapped]]) {
    for(const venue of venues) {
      if(!venue || typeof venue.name!=='string' || !venue.name.trim()) continue;
      const href=webURL(venue.sourceUrl);
      if(!href) continue;
      const type=venue.evidenceType || (/(^|\.)openstreetmap\.org$/i.test(new URL(href).hostname)?'mapped-footprint':'documented');
      if(type!==group) continue;
      if(seen(venue)) continue;
      list.push({name:venue.name.trim(),href,source:venue.sourceLabel,caption:venue.category || diningCategories[venue.kind]});
    }
  }
  const candidates=Array.isArray(nearbyDining)?nearbyDining:[];
  for(const item of candidates) {
    const venue=item?.place, miles=item?.distanceMiles;
    if(!venue || venue.id===place.id || !coordinates(venue) || !isFoodVenue(venue) || isLodging(venue) ||
      venue.nameKnown===false || typeof venue.name!=='string' || !venue.name.trim() || !Number.isFinite(miles) || miles<0 || miles>0.3) continue;
    if(seen(venue)) continue;
    const distance=miles<0.01?'Under 50 ft':miles<0.1?Math.round(miles*5280/10)*10+' ft':miles.toFixed(1)+' mi';
    nearby.push({name:venue.name,href:businessListingURL(venue),caption:[venue.category,distance].filter(Boolean).join(' · ')});
    if(nearby.length===3) break;
  }
  return `<section class="stop-section stop-dining" data-hotel-dining aria-label="Food and drink"><h3>Food &amp; drink</h3>
    ${diningList('Listed by the property',official)}${diningList('Documented on-site dining',documented)}${diningList('Mapped inside the property footprint',mapped)}
    ${!official.length && !documented.length && !mapped.length?'<p>On-site dining is unconfirmed.</p>':''}
    ${diningList('Mapped nearby',nearby)}${nearby.length?'<p class="stop-footnote">Distances are straight-line measurements from the lodging pin.</p>':''}</section>`;
}

export function renderPlaceSheet(place, {guide, area, distance='', saved=false, checkedLabel='', ratings='', now, nearbyDining=[]}={}) {
  const wc=evidence(place), coords=coordinates(place), locality=detailAreaLabel(place,guide,area);
  const address=place.address?.trim() || '';
  const placeholder=/^(?:street )?address (?:not|unknown|unavailable)|^[+-]?[\d.]+,\s*[+-]?[\d.]+$/i.test(address);
  const hasStreet=Boolean(address) && place.addressKnown!==false && !placeholder;
  // A highway exit, mile marker or route can still be a useful destination with no street address.
  const waypoint=address && !placeholder ? address : '';
  const phone=publishedPhone(place.phone);
  const road=isRoadside(place), hotel=isLodging(place), status=scheduleStatus(place,now);
  const hotelWebsite=hotel && webURL(place.website);
  const accessNote=usefulAccessNote(place), arrival=arrivalNote(place);
  const facts=[], unknown=[];
  if(place.hours?.scope==='restroom' && place.hours.label)facts.push(fact('Restroom hours',place.hours.label));
  else if(place.hours?.label && place.hours.scope==='unknown')facts.push(fact('Restroom hours',place.hours.label));
  else unknown.push('restroom hours');
  if(place.venueHours)facts.push(fact('Venue hours',place.venueHours));
  if(place.accessible===true || place.accessible===false)facts.push(fact('Wheelchair access',place.accessibilityNote || (place.accessible?'Accessible restroom listed':'Reported inaccessible')));
  else unknown.push('wheelchair access');
  if(place.changingTable===true || place.changingTable===false)facts.push(fact('Changing table',place.changingTable?'Listed':'Reported absent'));
  else unknown.push('changing table');
  if(typeof place.showers==='boolean')facts.push(fact(hotel?'Property showers':'Showers',showerDescription(place)));
  else if(road)unknown.push('showers');
  if(place.showers===true && Number.isInteger(place.accessibleShowerCount) && place.accessibleShowerCount>=0)facts.push(fact('Accessible showers',place.accessibleShowerCount+' listed by the operator'));
  const links=sourceLinks(place);
  const sourceDate=recordedDate(place,!place.dynamicListing && place.cityId===guide?.id ? checkedLabel : '');
  const business=(isFoodVenue(place)||road||hotel) && coords;
  const areaText=locality;
  const infoCopy=['approximate','interpolated-address'].includes(place.coordinateAccuracy) ? 'Approximate map pin' : place.coordinateAccuracy==='restroom'?'Restroom pin':'Facility pin';
  const coordButton=!hasStreet && coords ? `<button type="button" class="stop-coordinates" data-copy-coordinates="${e(coords)}" aria-label="Copy coordinates ${e(coords)}">${e(coords)}${symbol('copy')}</button>` : '';
  const venueHoursNote=place.venueHours && place.hours?.scope!=='restroom' ? '<p class="stop-footnote">Venue hours describe the business. Restroom hours may differ.</p>' : '';
  const showerHoursNote=place.showers===true && !hotel ? '<p class="stop-footnote">Check with the operator for shower fees and availability.</p>' : '';

  return `<article class="stop-sheet">
    <header class="stop-head">
      <div class="stop-category"><span class="stop-category-icon" data-facility="${detailCategoryIcon(place)}">${symbol(detailCategoryIcon(place))}</span><span>${e(place.category || 'Mapped location')}</span></div>
      <h2 id="detail-title">${e(place.name || 'Mapped location')}</h2>
      <p data-detail-locality class="stop-area" ${areaText?'':'hidden'}>${e(areaText)}</p>
    </header>
    <section class="stop-destination" aria-label="Destination and directions">
      <div class="stop-address">${symbol('pin')}<div>${waypoint?`<p>${e(waypoint)}</p>`:''}${coordButton}${!waypoint && !coords?'<p>Address unavailable</p>':''}
      <span class="stop-pin-caption">${e(infoCopy)}${distance?' · '+e(distance)+' straight-line distance':''}</span></div></div>
      ${coords?`<a class="stop-directions" href="${e(directionsURL(place))}" target="_blank" rel="noopener">${symbol(road||hotel?'drive':'walk')}${road||hotel?'Driving directions':'Walking directions'}</a>`:''}
      <div class="stop-buttons">
        <button type="button" data-save="${e(place.id)}" aria-pressed="${saved}">${symbol('save')}${saved?'Saved':'Save'}</button>
        <button type="button" data-share="${e(place.id)}">${symbol('share')}Share</button>
        ${phone?`<a href="${e(phone.href)}" aria-label="Call ${e(place.name)} at ${e(phone.label)}" title="${e(phone.label.toUpperCase())}">${symbol('phone')}Call</a>`:''}
      </div>
    </section>
    <section class="stop-access" aria-label="Restroom access"><div class="stop-evidence" data-tone="${wc.tone}">${symbol(wc.icon)}${e(wc.label)}</div>
      <h3>${e(admission(place))}</h3>${accessNote?`<p>${e(accessNote)}</p>`:''}
      ${hotel?`<p>Guest-room bathrooms and showers generally require a reservation. Ask the front desk about lobby restroom access or a day-use shower.</p>${place.guestRoomNote?`<p><strong>Guest rooms</strong> · ${e(place.guestRoomNote)}</p>`:''}`:''}
      ${status.state!=='unknown'?`<p class="stop-hours-status" data-state="${e(status.state)}">${e(status.label)}</p>`:''}
    </section>
    ${arrival?`<section class="stop-section stop-arrival"><h3>At this location</h3><p>${e(arrival)}</p></section>`:''}
    <section class="stop-section"><h3>Hours &amp; facilities</h3>
      ${facts.length?`<dl class="stop-facts">${facts.join('')}</dl>`:''}
      ${hotel?`<div data-hotel-facilities>${mappedHotelFacilities(place)}</div>`:''}
      ${venueHoursNote}${showerHoursNote}
      ${unknown.length?`<p class="stop-unknown"><strong>Not documented</strong><span>${e(unknown.join(' · '))}</span></p>`:''}
    </section>
    ${hotel?hotelDining(place,nearbyDining):''}
    ${phone || business || hotelWebsite?`<div class="stop-contact">${phone?`<a href="${e(phone.href)}">${symbol('phone')}${e(phone.label)}</a>`:''}${hotelWebsite?`<a href="${e(hotelWebsite)}" target="_blank" rel="noopener">${symbol('source')}Property website</a>`:''}${business?`<a href="${e(businessListingURL(place,guide||{}))}" target="_blank" rel="noopener">${symbol('source')}Find this business on Google Maps</a>`:''}</div>`:''}
    ${ratings}
    <details class="stop-sources"><summary><span>Sources &amp; dates</span><span aria-hidden="true">＋</span></summary>
      <div><p class="stop-source-type">${e(sourceKind(place))}</p>${sourceDate?`<p class="stop-source-date">${e(sourceDate)}</p>`:''}
      ${links?`<div class="stop-source-links">${links}</div>`:'<p>Source link unavailable.</p>'}</div></details>
  </article>`;
}
