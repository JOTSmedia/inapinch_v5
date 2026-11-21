// These are cartographic treatments, not land-cover classifications. States
// provide a visual starting point; named places and counties override it.
// Regional references: USGS physiographic provinces (pubs.usgs.gov/of/2023/1059/)
// and the actual Census/NYC NTA names used by the local area index.
import {usRegions} from './us-geography.js';

const stateGroups={
  island:'AS GU HI MP PR VI',
  mountain:'AK CO ID MT NH UT VT WV WY',
  desert:'AZ NM NV',
  lake:'MI MN WI',
  prairie:'IA IL IN KS ND NE OK SD TX',
  forest:'AL CT GA KY MA ME NC NJ NY OR PA SC TN VA WA',
  river:'AR MO MS OH',
  delta:'LA',
  coastal:'CA DE FL RI',
  bay:'MD',
  capital:'DC'
};
const stateStyles=new Map();
for(const [family,codes] of Object.entries(stateGroups)){
  for(const code of codes.split(' '))stateStyles.set(code,family);
}

const guideStyles={
  'key-west':'island',nyc:'metro',miami:'neon',la:'metro',austin:'river',sf:'bay',
  chicago:'lake',seattle:'bay','new-orleans':'delta',nashville:'river',boston:'bay',dc:'capital',
  'san-diego':'coastal',portland:'river',denver:'mountain','las-vegas':'neon',phoenix:'desert',
  atlanta:'metro',charleston:'coastal',savannah:'river',orlando:'lake',honolulu:'island',
  dallas:'metro',houston:'industrial'
};

const cities={
  AK:{island:'Adak|Unalaska|Kodiak|Sitka|Ketchikan',coastal:'Juneau|Nome|Seward|Homer|Utqiagvik|Valdez',river:'Fairbanks|Bethel|Galena',mountain:'Anchorage|Palmer'},
  AL:{bay:'Mobile|Daphne|Fairhope',coastal:'Gulf Shores|Orange Beach',industrial:'Birmingham|Bessemer',river:'Tuscaloosa|Florence|Decatur'},
  AR:{mountain:'Eureka Springs|Mountain View',river:'Fort Smith|Pine Bluff|North Little Rock',delta:'Helena-West Helena|West Memphis'},
  AZ:{mountain:'Flagstaff|Prescott|Pinetop-Lakeside',desert:'Phoenix|Mesa|Scottsdale|Tucson|Tempe|Yuma',lake:'Lake Havasu City|Page'},
  CA:{bay:'San Francisco|Oakland|Berkeley|Alameda|Sausalito|Richmond|San Jose|Palo Alto|San Mateo|Foster City',
    coastal:'San Diego|Santa Cruz|Monterey|Carmel-by-the-Sea|Santa Barbara|Ventura|Oceanside|Half Moon Bay|Huntington Beach|Pismo Beach',
    metro:'Los Angeles|Pasadena|Burbank|Beverly Hills',industrial:'Long Beach|Carson|Vernon',
    desert:'Palm Springs|Palm Desert|Indio|Twentynine Palms|El Centro|Blythe|Barstow|Lancaster',
    river:'Redding|Stockton|Fresno|Bakersfield',lake:'South Lake Tahoe|Tahoe City|Big Bear Lake',
    forest:'Arcata|Crescent City|Trinidad',mountain:'Truckee|Mammoth Lakes|Bishop',island:'Avalon'},
  CO:{mountain:'Denver|Boulder|Aspen|Breckenridge|Telluride|Estes Park|Vail|Ouray|Durango',prairie:'Limon|Burlington|Sterling',
    river:'Grand Junction|Glenwood Springs|Pueblo'},
  CT:{river:'Middletown|Old Saybrook',coastal:'New London|Stonington|New Haven',industrial:'Waterbury|Bridgeport'},
  DE:{coastal:'Rehoboth Beach|Lewes|Bethany Beach|Fenwick Island',river:'Wilmington|New Castle'},
  FL:{island:'Key West|Marathon|Islamorada|Key Biscayne|Sanibel|Marco Island|Anna Maria',
    neon:'Miami|Miami Beach',bay:'Tampa|St. Petersburg|Clearwater|Pensacola',lake:'Orlando|Winter Park|Lake Wales|Okeechobee|Lakeland',
    coastal:'Daytona Beach|Fort Lauderdale|West Palm Beach|Naples|Destin|Fernandina Beach|Cocoa Beach',
    river:'Jacksonville|Palatka|Fort Myers'},
  GA:{metro:'Atlanta|Decatur',river:'Savannah|Augusta|Columbus|Macon-Bibb County',island:'Tybee Island|St. Simons',
    mountain:'Blue Ridge|Dahlonega|Helen',coastal:'Brunswick|Darien'},
  IA:{river:'Dubuque|Davenport|Burlington|Sioux City|Council Bluffs|Cedar Rapids',lake:'Okoboji|Spirit Lake'},
  ID:{lake:"Coeur d'Alene|Sandpoint|McCall",river:'Idaho Falls|Twin Falls|Lewiston',mountain:'Sun Valley|Ketchum'},
  IL:{lake:'Chicago|Evanston|Wilmette|Waukegan',river:'Peoria|Quincy|Rock Island|Alton|Cairo',industrial:'Joliet|East St. Louis'},
  IN:{industrial:'Gary|East Chicago',lake:'Michigan City|Porter|Beverly Shores',river:'Evansville|Madison|New Albany|Terre Haute'},
  KS:{river:'Wichita|Lawrence|Kansas City|Atchison',prairie:'Dodge City|Garden City|Hays'},
  KY:{river:'Louisville|Louisville/Jefferson County metro government (balance)|Covington|Newport|Paducah|Owensboro',
    mountain:'Harlan|Pikeville',industrial:'Ashland'},
  LA:{delta:'New Orleans|Houma|Thibodaux',river:'Shreveport|Monroe|Natchitoches|Alexandria',lake:'Lake Charles|Mandeville'},
  MA:{bay:'Boston|Quincy|Provincetown|Gloucester',river:'Cambridge|Springfield',industrial:'Lowell|Lawrence|Fall River',
    island:'Nantucket|Oak Bluffs|Edgartown',mountain:'North Adams|Pittsfield'},
  MD:{bay:'Baltimore|Cambridge|Havre de Grace',coastal:'Ocean City',river:'Cumberland|Hancock',metro:'Bethesda|Silver Spring|College Park'},
  ME:{coastal:'Portland|Rockland|Eastport|Bath',island:'Bar Harbor|Southwest Harbor',river:'Bangor|Lewiston',lake:'Greenville|Rangeley'},
  MI:{industrial:'Detroit|Dearborn|Flint|Pontiac',lake:'Marquette|Traverse City|Muskegon|Petoskey|Holland|Port Huron',
    island:'Mackinac Island',river:'Grand Rapids|Saginaw|Sault Ste. Marie',forest:'Ironwood|Grayling'},
  MN:{lake:'Duluth|Grand Marais|Two Harbors|Bemidji',river:'Minneapolis|Winona|Red Wing|Moorhead|Stillwater',industrial:'Hibbing|Virginia'},
  MO:{river:'Kansas City|St. Louis|St. Charles|Hannibal|Cape Girardeau|St. Joseph',lake:'Osage Beach|Lake Ozark',mountain:'Branson'},
  MS:{delta:'Clarksdale|Greenville|Cleveland|Indianola',coastal:'Gulfport|Biloxi|Pascagoula|Bay St. Louis',river:'Natchez|Vicksburg'},
  MT:{mountain:'Whitefish|Bozeman|Red Lodge',river:'Missoula|Great Falls|Billings|Miles City',industrial:'Butte-Silver Bow (balance)|Anaconda-Deer Lodge County'},
  NC:{mountain:'Asheville|Boone|Blowing Rock|Black Mountain',coastal:'Nags Head|Kitty Hawk|Wrightsville Beach|Morehead City',
    island:'Ocracoke|Bald Head Island',river:'Wilmington|New Bern',metro:'Charlotte|Durham'},
  ND:{river:'Fargo|Grand Forks|Williston|Wahpeton',lake:'Devils Lake',prairie:'Dickinson|Minot'},
  NE:{river:'Omaha|Bellevue|North Platte|Nebraska City|Scottsbluff',prairie:'Kearney|Grand Island'},
  NH:{mountain:'North Conway|Lincoln|Gorham',lake:'Laconia|Meredith|Wolfeboro',coastal:'Hampton|Rye',river:'Portsmouth|Manchester|Nashua'},
  NJ:{metro:'Jersey City|Hackensack|Elizabeth|Union City|West New York|Fort Lee|Secaucus',river:'Hoboken|Edgewater|Weehawken|Lambertville|Camden|Red Bank',
    industrial:'Newark|Paterson|Bayonne|Linden',forest:'Montclair|Upper Montclair|Medford|Tabernacle',
    coastal:'Cape May|Ocean City|Asbury Park|Long Branch|Point Pleasant Beach|Wildwood|Belmar|Sea Bright',
    neon:'Atlantic City',island:'Beach Haven|Ship Bottom|Surf City|Barnegat Light',mountain:'Vernon|Highland Lakes'},
  NM:{mountain:'Taos|Ruidoso|Los Alamos|Red River|Angel Fire',desert:'Alamogordo|Deming|Gallup',river:'Albuquerque|Las Cruces|Truth or Consequences'},
  NV:{neon:'Las Vegas|North Las Vegas|Paradise|Winchester|Reno',lake:'Incline Village|Stateline',mountain:'Mount Charleston',desert:'Henderson|Boulder City|Pahrump|Elko'},
  NY:{metro:'New York|New York City|Yonkers|White Plains|New Rochelle',lake:'Buffalo|Rochester|Ithaca|Geneva|Canandaigua|Oswego|Plattsburgh|Jamestown',
    river:'Troy|Hudson|Kingston|Poughkeepsie|Beacon|Niagara Falls|Binghamton',mountain:'Lake Placid|Tannersville|Hunter',
    forest:'Saranac Lake|Old Forge',coastal:'Long Beach|Montauk|Greenport|Southampton',island:'Shelter Island|Ocean Beach|Fire Island'},
  OH:{lake:'Cleveland|Lakewood|Sandusky|Vermilion',industrial:'Toledo|Youngstown|Akron|Canton',
    river:'Cincinnati|Marietta|Portsmouth|Dayton',island:'Put-in-Bay|Kelleys Island'},
  OK:{river:'Tulsa|Muskogee',mountain:'Medicine Park',forest:'Broken Bow|Tahlequah',prairie:'Enid|Woodward'},
  OR:{river:'Portland|Astoria|Eugene|Hood River|The Dalles',coastal:'Cannon Beach|Newport|Bandon|Seaside',
    mountain:'Bend|Sisters|Government Camp',desert:'Burns|Christmas Valley',forest:'Oakridge'},
  PA:{industrial:'Pittsburgh|Bethlehem|Scranton|Johnstown|Allentown',metro:'Philadelphia',lake:'Erie',
    river:'Wilkes-Barre|Easton|Williamsport|New Hope|Reading',mountain:'Jim Thorpe|Mount Pocono'},
  RI:{bay:'Warwick|East Providence|Bristol|Newport|Jamestown',coastal:'Narragansett|Westerly',industrial:'Pawtucket|Woonsocket',island:'New Shoreham'},
  SC:{coastal:'Charleston|Myrtle Beach|North Myrtle Beach|Folly Beach',island:'Hilton Head Island|Isle of Palms|Kiawah Island',
    river:'Beaufort|Georgetown',industrial:'Spartanburg|North Charleston'},
  SD:{mountain:'Rapid City|Custer|Lead|Deadwood',river:'Sioux Falls|Yankton|Fort Pierre',prairie:'Brookings|Mitchell'},
  TN:{river:'Nashville|Memphis|Chattanooga|Knoxville|Clarksville',mountain:'Gatlinburg|Pigeon Forge|Townsend',industrial:'Kingsport'},
  TX:{river:'Austin|San Antonio|Waco|San Marcos|Laredo|Brownsville',industrial:'Houston|Beaumont|Port Arthur|Baytown|Texas City',
    metro:'Dallas|Fort Worth|Arlington|Plano',coastal:'Corpus Christi|Port Aransas|Rockport',island:'Galveston|South Padre Island',
    desert:'El Paso|Marfa|Alpine|Presidio',prairie:'Lubbock|Amarillo|Wichita Falls',forest:'Lufkin|Nacogdoches'},
  UT:{mountain:'Salt Lake City|Park City|Ogden|Logan|Provo',desert:'Moab|St. George|Kanab|Springdale|Escalante|Bluff'},
  VA:{bay:'Norfolk|Hampton|Cape Charles|Poquoson',coastal:'Virginia Beach',industrial:'Newport News|Portsmouth',
    mountain:'Roanoke|Blacksburg|Abingdon|Lexington',metro:'Arlington|Falls Church',river:'Alexandria|Lynchburg|Fredericksburg'},
  VT:{lake:'Burlington|South Burlington|Shelburne',mountain:'Stowe|Killington|Manchester|Jay',river:'Brattleboro|White River Junction'},
  WA:{bay:'Seattle|Tacoma|Bellingham|Bremerton|Gig Harbor|Port Townsend',island:'Friday Harbor|Bainbridge Island|Oak Harbor',
    river:'Spokane|Wenatchee|Vancouver|Richland|Pasco|Kennewick',mountain:'Leavenworth|North Bend',coastal:'Ocean Shores|Long Beach|Westport'},
  WI:{lake:'Milwaukee|Sheboygan|Manitowoc|Bayfield|Superior|Kenosha|Lake Geneva',bay:'Green Bay|Sturgeon Bay',
    river:'La Crosse|Eau Claire|Appleton|Wausau|Wisconsin Rapids'},
  WV:{river:'Wheeling|Parkersburg|Huntington|Harpers Ferry|Morgantown',mountain:'Beckley|Davis|Elkins',industrial:'Weirton'},
  WY:{mountain:'Jackson|Teton Village|Cody|Laramie',river:'Casper|Green River',prairie:'Gillette|Torrington'}
};

// County identifiers are useful when the map center falls outside municipalities.
const counties={
  AK:{island:'Aleutians East|Aleutians West|Kodiak Island|Prince of Wales-Hyder',river:'Yukon-Koyukuk|Bethel',coastal:'Nome|Bristol Bay'},
  AL:{bay:'Mobile|Baldwin'}, AR:{delta:'Phillips|Chicot|Desha|Mississippi|Crittenden'},
  AZ:{mountain:'Coconino',desert:'Pima|Maricopa|Yuma'},
  CA:{bay:'San Francisco|San Mateo|Alameda|Santa Clara|Contra Costa|Marin',mountain:'Alpine|Mono|Inyo|Plumas|Sierra',
    desert:'Imperial',forest:'Humboldt|Del Norte|Trinity',river:'Sacramento|San Joaquin|Yuba|Sutter|Colusa',metro:'Los Angeles'},
  CO:{prairie:'Baca|Cheyenne|Kiowa|Kit Carson|Lincoln|Phillips|Prowers|Sedgwick|Washington|Yuma',
    mountain:'Summit|Eagle|Pitkin|San Juan|San Miguel'},
  CT:{coastal:'Southeastern Connecticut|South Central Connecticut',river:'Lower Connecticut River Valley'},
  DE:{coastal:'Sussex'}, FL:{island:'Monroe',lake:'Lake|Orange|Highlands|Okeechobee',bay:'Hillsborough|Pinellas|Bay',coastal:'Broward|Brevard|Volusia|St. Johns'},
  GA:{coastal:'Glynn|Chatham|McIntosh|Camden',mountain:'Fannin|Towns|Rabun|Union|Lumpkin',metro:'Fulton|DeKalb'},
  IL:{lake:'Lake',river:'Adams|Rock Island|Peoria|Alexander',metro:'Cook|DuPage'},
  IN:{industrial:'Lake',lake:'Porter|LaPorte',river:'Floyd|Clark|Vanderburgh'},
  KS:{prairie:'Finney|Ford|Ellis|Chase',metro:'Johnson|Wyandotte'}, KY:{mountain:'Harlan|Pike|Letcher',river:'Campbell|Kenton|McCracken'},
  LA:{delta:'Orleans|Plaquemines|Lafourche|Terrebonne|St. Bernard',forest:'Bienville|Claiborne|Winn',river:'Caddo|Ouachita'},
  MA:{island:'Nantucket|Dukes',coastal:'Barnstable',mountain:'Berkshire',bay:'Suffolk'},
  MD:{mountain:'Garrett|Allegany',coastal:'Worcester',metro:'Montgomery|Prince George’s'},
  ME:{coastal:'Knox|Lincoln|Hancock',forest:'Piscataquis|Somerset'},
  MI:{lake:'Leelanau|Grand Traverse|Alger|Muskegon|Emmet',industrial:'Wayne|Genesee'},
  MN:{lake:'Lake|Cook|Crow Wing',river:'Winona|Wabasha|Houston',prairie:'Pipestone|Murray|Rock'},
  MO:{mountain:'Stone|Taney',delta:'Pemiscot|New Madrid',metro:'St. Louis'}, MS:{delta:'Coahoma|Bolivar|Sunflower|Leflore|Washington|Quitman|Sharkey|Issaquena',
    coastal:'Hancock|Harrison|Jackson'},MT:{prairie:'Sheridan|Daniels|Roosevelt|Fallon|Carter'},
  NC:{mountain:'Buncombe|Watauga|Avery|Swain|Jackson|Haywood',coastal:'Dare|Carteret|Brunswick|New Hanover',metro:'Mecklenburg|Wake'},
  NJ:{metro:'Hudson|Bergen|Essex|Union',coastal:'Monmouth|Ocean|Atlantic|Cape May',mountain:'Sussex|Warren',river:'Salem|Mercer',forest:'Burlington|Cumberland'},
  NM:{mountain:'Taos|Los Alamos|San Miguel',desert:'Luna|Hidalgo|Otero'},
  NY:{metro:'Bronx|Kings|New York|Queens|Westchester|Nassau',island:'Richmond',coastal:'Suffolk',
    river:'Dutchess|Columbia|Rensselaer|Albany|Rockland|Greene',lake:'Erie|Niagara|Oswego|Cayuga|Seneca|Yates|Ontario|Tompkins',
    mountain:'Essex|Hamilton|Ulster|Delaware|Warren',forest:'Franklin|Lewis'},
  OH:{lake:'Erie|Ottawa|Lake|Ashtabula|Lorain',industrial:'Mahoning|Summit',metro:'Cuyahoga'},
  OK:{forest:'McCurtain|Pushmataha',prairie:'Cimarron|Texas|Beaver'},OR:{coastal:'Clatsop|Tillamook|Lincoln|Coos|Curry',
    river:'Multnomah|Hood River|Wasco',desert:'Harney|Malheur',mountain:'Deschutes'},
  PA:{industrial:'Allegheny|Lehigh|Lackawanna|Cambria',metro:'Philadelphia',lake:'Erie',mountain:'Monroe|Carbon|Pike'},
  RI:{island:'Newport',coastal:'Washington'},SC:{coastal:'Charleston|Beaufort|Horry|Georgetown',mountain:'Oconee|Pickens'},
  SD:{mountain:'Custer|Lawrence',river:'Hughes|Yankton'},TN:{mountain:'Sevier|Blount|Carter',river:'Shelby|Hamilton|Davidson'},
  TX:{coastal:'Nueces|Aransas|Galveston|Cameron|Matagorda',desert:'El Paso|Hudspeth|Presidio|Brewster|Culberson',
    prairie:'Potter|Randall|Lubbock',forest:'Angelina|Nacogdoches|Tyler',metro:'Dallas|Tarrant',industrial:'Harris|Jefferson'},
  UT:{desert:'Grand|Wayne|Garfield|Kane|Washington|San Juan',mountain:'Summit|Wasatch'},
  VA:{bay:'Northumberland|Mathews|Lancaster',coastal:'Accomack|Northampton',metro:'Arlington|Fairfax',mountain:'Highland|Bath|Giles|Bland'},
  WA:{island:'San Juan|Island',coastal:'Pacific|Grays Harbor',bay:'King|Kitsap|Pierce',river:'Benton|Franklin|Walla Walla|Clark'},
  WI:{lake:'Door|Bayfield|Manitowoc|Sheboygan|Douglas',river:'La Crosse|Eau Claire|Pepin'},
  WY:{mountain:'Teton|Park|Sublette',prairie:'Goshen|Platte|Niobrara'}
};
const capitals={
  AL:'Montgomery',AK:'Juneau',AZ:'Phoenix',AR:'Little Rock',CA:'Sacramento',CO:'Denver',CT:'Hartford',DE:'Dover',
  FL:'Tallahassee',GA:'Atlanta',HI:'Honolulu',ID:'Boise',IL:'Springfield',IN:'Indianapolis',IA:'Des Moines',KS:'Topeka',
  KY:'Frankfort',LA:'Baton Rouge',ME:'Augusta',MD:'Annapolis',MA:'Boston',MI:'Lansing',MN:'St. Paul',MS:'Jackson',
  MO:'Jefferson City',MT:'Helena',NE:'Lincoln',NV:'Carson City',NH:'Concord',NJ:'Trenton',NM:'Santa Fe',NY:'Albany',
  NC:'Raleigh',ND:'Bismarck',OH:'Columbus',OK:'Oklahoma City',OR:'Salem',PA:'Harrisburg',RI:'Providence',SC:'Columbia',
  SD:'Pierre',TN:'Nashville',TX:'Austin',UT:'Salt Lake City',VT:'Montpelier',VA:'Richmond',WA:'Olympia',WV:'Charleston',
  WI:'Madison',WY:'Cheyenne',DC:'Washington'
};
const nycNeighborhoods={
  neon:'Midtown-Times Square|Times Square',industrial:'Brooklyn Navy Yard|Sunset Park (West)',
  river:'Financial District-Battery Park City|Long Island City-Hunters Point',
  bay:'Sheepshead Bay-Manhattan Beach-Gerritsen Beach|Pelham Bay-Country Club-City Island',
  coastal:'Coney Island-Sea Gate|Brighton Beach|Far Rockaway-Bayswater|Rockaway Beach-Arverne-Edgemere|Breezy Point-Belle Harbor-Rockaway Park-Broad Channel|Jacob Riis Park-Fort Tilden-Breezy Point Tip',
  island:"Randall's Island|Hart Island|North & South Brother Islands|The Battery-Governors Island-Ellis Island-Liberty Island"
};

function nameKey(value){
  return (typeof value==='string'?value:'').normalize('NFKD').replace(/\p{Mark}/gu,'').toLowerCase()
    .replace(/\bst[. ]+/g,'saint ').replace(/[’'ʻ]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
}
function familyIndex(definitions){
  const index=new Map();
  for(const [code,families] of Object.entries(definitions)){
    for(const [family,names] of Object.entries(families)){
      for(const name of names.split('|'))index.set(code+'|'+nameKey(name),family);
    }
  }
  return index;
}
const cityIndex=familyIndex(cities),countyIndex=familyIndex(counties);
const neighborhoodIndex=familyIndex({NY:nycNeighborhoods});
const stateByName=new Map(usRegions.map(region=>[nameKey(region.name),region.code]));
const boroughs=new Set(['manhattan','bronx','the bronx','brooklyn','queens','staten island']);
function countyKey(name){
  return nameKey(name).replace(/\s+(?:city and borough|planning region|census area|municipality|county|parish|borough)$/,'');
}

export function regionMapFamily(area={}){
  const which=area.level || area.kind;
  if(which==='country' || which==='outside')return 'metro';
  const possible=area.state?.code || area.stateCode || area.state?.name || area.state || (which==='state'?area.shortLabel:'');
  const code=stateStyles.has(String(possible).toUpperCase())?String(possible).toUpperCase():stateByName.get(nameKey(possible));
  const base=stateStyles.get(code)||'metro';
  if(which==='state')return base;
  const guideId=area.guideId || (!which && Object.hasOwn(guideStyles,area.id)?area.id:null);
  if(!code)return typeof guideStyles[guideId]==='string'?guideStyles[guideId]:base;
  const prefix=code+'|';
  let local=area.city || area.locality || (which==='city'||which==='place'||(!which && guideId)?area.shortLabel||area.name:'');
  if(local && typeof local==='object')local=local.name;
  const town=nameKey(local).replace(/ metropolitan government balance$| city balance$/,'');
  const borough=nameKey(area.borough);
  const isNYC=code==='NY' && (guideId==='nyc' || town==='new york city' || town==='new york' || boroughs.has(borough));
  if(isNYC && which!=='county'){
    const neighborhood=neighborhoodIndex.get(prefix+nameKey(area.neighborhood));
    if(neighborhood)return neighborhood;
    return borough==='staten island'?'island':'metro';
  }
  if(which!=='county'){
    const guide=guideStyles[guideId];
    if(typeof guide==='string')return guide;
    const cityFamily=cityIndex.get(prefix+town);
    if(cityFamily)return cityFamily;
    if(town && town===nameKey(capitals[code]))return 'capital';
  }
  const county=area.county?.name || area.county || (which==='county'?area.shortLabel||area.name:'');
  return countyIndex.get(prefix+countyKey(county)) || base;
}
