// Input inks are illustrational samples from the flag designs. Output map
// colors are mixed for legibility, rather than specifications for reproduction.
const federalBook='https://www.govinfo.gov/content/pkg/CDOC-109sdoc18/pdf/CDOC-109sdoc18.pdf';
const colors=s=>s.split(' ').map(hex=>'#'+hex);
const flags={
  AL:['Alabama','Crimson saltire','a crimson diagonal cross on white','aa233b f7f5ee c83248'],
  AK:['Alaska','Northern stars','gold stars against a deep blue field','102e60 ffbe36 fcdc78'],
  AZ:['Arizona','Copper star','a copper star, red and gold rays and a blue field','153b75 e98a46 ebbe39'],
  AR:['Arkansas','Diamond field','the blue diamond border against red and white','192e6b c43149 f7f4e8'],
  CA:['California','Bear flag','the red stripe, green ground and brown bear','64442c b73142 4a7851'],
  CO:['Colorado','Centennial rings','blue stripes, a red C and a gold disc','194889 e34843 ffcc47'],
  CT:['Connecticut','Grapevine shield','the blue field and golden surround of the shield','193c73 e2bd67 eee9d5'],
  DE:['Delaware','Buff diamond','a buff diamond on a field of colonial blue','598aa3 e3c092 f3dcac'],
  FL:['Florida','Cross and seal','the flag’s red diagonal cross, white field and golden seal border','a9273f dfb54c f4efe8'],
  GA:['Georgia','Peach State stripes','red and white stripes beneath a blue canton','18355d b7343f f3e7d7'],
  HI:['Hawaiʻi','Pacific stripes','bands of red, white and blue','193e6a ba3440 e9e8d8'],
  ID:['Idaho','Blue and gold','the blue field, gold seal border and red scroll','223e70 dea94c b43d46'],
  IL:['Illinois','Prairie eagle','the white field, golden sun and red ribbon of the state seal','b04742 efb24f f9f7e9'],
  IN:['Indiana','Torchlight','a gold torch and stars on deep blue','20376c e1af42 f5d481'],
  IA:['Iowa','Hawkeye tricolor','vertical blue, white and red fields','1d4279 d1464a f4ead6'],
  KS:['Kansas','Sunflower field','the gold sunflower and lettering on a blue field','1e3c71 edbd3c 7b913f'],
  KY:['Kentucky','Goldenrod blue','the seal’s goldenrod wreath on a navy field','183866 dbb349 779650'],
  LA:['Louisiana','Pelican field','a white pelican on deep blue, with red detail','234677 e8e8d9 b93941'],
  ME:['Maine','Pine and star','the dark blue field, pine and yellow star of the state flag','18395f deb850 4e7454'],
  MD:['Maryland','Calvert checks','black and gold checks with red and white quarters','242932 e6b943 c73e45'],
  MA:['Massachusetts','Bay State shield','the blue shield and gold emblem on a white field','24527e c8a457 f2efe4'],
  MI:['Michigan','Great Lakes seal','the blue flag field and earthy colors in its coat of arms','193969 b29055 679480'],
  MN:['Minnesota','North Star blue','dark blue, light blue and a white eight-pointed star','002d5d 52c9e8 f8fcfc'],
  MS:['Mississippi','Magnolia bands','the white magnolia, gold bands and deep red outer stripes','203957 caac66 b63546'],
  MO:['Missouri','River tricolor','the red, white and blue horizontal fields','243e75 c33f49 f4ede1'],
  MT:['Montana','Big Sky seal','a blue field with gold lettering and a mountainous seal','233f72 d5a74b 4d7b71'],
  NE:['Nebraska','Prairie gold','a dark blue field with gold and silver seal details','1f3e69 d4aa4a c6cbcc'],
  NV:['Nevada','Silver star','the blue field, silver star and gold banner','234679 cfd7db d6af52'],
  NH:['New Hampshire','Laurel blue','gold stars and a green laurel wreath on blue','213f70 d8ae49 59804c'],
  NJ:['New Jersey','Buff and blue','the buff field and blue shield of the state flag','476a8e debf86 f5dba6'],
  NM:['New Mexico','Zia field','the red Zia symbol on a field of yellow','af2636 f1c541 e96144'],
  NY:['New York','Empire blue','a blue field with the golden rising sun in the coat of arms','233b70 d7af48 75a9bd'],
  NC:['North Carolina','Carolina bars','a blue hoist beside red and white bands','224472 c93b47 e8e7e1'],
  ND:['North Dakota','Eagle and scroll','a deep blue field, golden eagle detail and red ribbon','243f6b c6a050 b94a50'],
  OH:['Ohio','Burgee rings','the blue triangle, red disc and white ring','1d3d70 c83747 f1eee5'],
  OK:['Oklahoma','Osage shield','the sky-blue field and tan shield with a green olive branch','4a93b9 c8a16a 668451'],
  OR:['Oregon','Beaver gold','gold emblems on a navy field','193865 e5ae4e f8ce7e'],
  PA:['Pennsylvania','Keystone blue','the blue field, dark horses and golden sheaves of the coat of arms','203f6a d0a25b 40564d'],
  RI:['Rhode Island','Anchor and stars','a golden anchor and blue ribbon against white','284b76 d8a73c f7f1d8'],
  SC:['South Carolina','Palmetto moon','a white palmetto and crescent against indigo','183864 ebeee7 93a8c4'],
  SD:['South Dakota','Sunburst seal','gold sun rays and lettering across sky blue','4584b4 f2be40 f0e7ce'],
  TN:['Tennessee','Three stars','the blue disc, white stars and red field','254274 d64449 f4eee3'],
  TX:['Texas','Lone Star field','the navy star panel and red and white stripes','173758 bb3842 f5eee3'],
  UT:['Utah','Beehive peaks','a gold beehive with blue sky, white peaks and a red base','173b61 e9b947 b83b40'],
  VT:['Vermont','Green Mountain seal','the pine and golden sheaves on a dark blue flag','25416e 71915c d6b254'],
  VA:['Virginia','Commonwealth blue','the blue flag and green wreath around its seal','214373 76985f e9e6ce'],
  WA:['Washington','Evergreen seal','the green flag field and the golden border of the seal','176b4e d5ba56 83b6c5'],
  WV:['West Virginia','Mountain State border','a blue border around a white field and red ribbon','214e86 c24451 f7f0d9'],
  WI:['Wisconsin','Badger field','a blue field, white lettering and a gold shield','234174 f3edda d6aa57'],
  WY:['Wyoming','Bison field','the white bison against blue and a red border','193959 c44049 f1efe5'],
  DC:['District of Columbia','Three stars','three red stars and two red bars on white','9f253b f7f0df d34952'],
  AS:['American Samoa','Pacific chevrons','the red-edged white triangle and dark blue field','1b365f bd3d46 f4eedb'],
  GU:['Guam','Proa coast','the blue field, red border and turquoise in the seal','223d78 ae384d 58b2bc'],
  MP:['Northern Mariana Islands','Latte stone','the white star and gray latte stone on blue','3475a3 a8b1ad f3f0e2'],
  PR:['Puerto Rico','Island stripes','the blue triangle and red and white stripes','2575ad c63b4b f7f3e8'],
  VI:['U.S. Virgin Islands','Island eagle','the yellow eagle, green olive branch and white field','ae8a39 e3be54 568057']
};
const newerFlags={
  MN:['Minnesota Secretary of State','https://www.sos.mn.gov/about-minnesota/state-symbols/state-flag'],
  MS:['Mississippi Secretary of State','https://www.sos.ms.gov/content/documents/ed_pubs/pubs/BlueBook20-24/1%20General%20Info%20Section.pdf'],
  UT:['Utah State Flag','https://flag.utah.gov/symbolism/'],
  LA:['Louisiana Secretary of State','https://www.sos.la.gov/archives/state-flag-and-seal'],
  DC:['Office of the Secretary, DC','https://os.dc.gov/page/dc-symbols']
};
export const regionFlagInks=Object.fromEntries(Object.entries(flags).map(([state,[region,name,description,swatches]])=>{
  const [sourceLabel,sourceURL]=newerFlags[state]||['U.S. Government Publishing Office · Our Flag',federalBook];
  return [state,{region,name,basis:'Inspired by '+description+' on the '+region+' flag.',sourceLabel,sourceURL,colors:colors(swatches)}];
}));
