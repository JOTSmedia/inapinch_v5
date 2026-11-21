// Original night-map inks. Road, minor and accent are line inks. Water, park
// and building are area fills. Descriptions name the geography behind each
// treatment without implying that every named feature is a mapped route.
export const guideMapIdentities = {
  'key-west': {
    family:'island', motif:'reef', name:'Key West shoal chart',
    description:'Turquoise water surrounds the small blocks of Old Town. Warm shell and sand tones follow the streets toward the harbor.',
    inks:{background:'#172d32', water:'#075667', road:'#ffd582', minor:'#87b9ae',
      park:'#315748', building:'#34464a', border:'#88d1cb', accent:'#5ce5e1', label:'#f9f5de'}
  },
  nyc: {
    family:'metro', motif:'subway', name:'Five-borough transit',
    description:'Taxi yellow traces the avenues across graphite blocks. Electric blue picks out the crossings between the boroughs.',
    inks:{background:'#171c25', water:'#183954', road:'#ffd334', minor:'#8b95a1',
      park:'#234b3c', building:'#343943', border:'#94aeca', accent:'#61b8ff', label:'#fbf9f1'}
  },
  miami: {
    family:'neon', motif:'deco', name:'Ocean Drive after dark',
    description:'Hot pink and pool cyan follow Biscayne Bay’s causeways and the narrow beachfront blocks of Miami Beach.',
    inks:{background:'#241337', water:'#10455c', road:'#ff73b1', minor:'#b28bc6',
      park:'#22494a', building:'#4e2c55', border:'#b5a2dd', accent:'#52f3ee', label:'#fff2fc'}
  },
  la: {
    family:'coastal', motif:'boulevard', name:'Los Angeles golden hour',
    description:'Apricot boulevards cross the basin under indigo foothills. The Pacific and the broad freeway curves break up the street grid.',
    inks:{background:'#292037', water:'#243e61', road:'#ffc581', minor:'#bb98ac',
      park:'#3a4b47', building:'#49344c', border:'#b791d4', accent:'#ff9990', label:'#fff1de'}
  },
  austin: {
    family:'river', motif:'batwing', name:'Congress Avenue at dusk',
    description:'Limestone streets meet Lady Bird Lake beneath Congress Avenue Bridge. Verde accents follow the greenbelt through the city.',
    inks:{background:'#182923', water:'#185251', road:'#e5d19a', minor:'#91ab8f',
      park:'#2c5435', building:'#394139', border:'#a2baa7', accent:'#70e4a7', label:'#fcf5dc'}
  },
  sf: {
    family:'bay', motif:'suspension', name:'Golden Gate marine layer',
    description:'Bridge orange cuts through cool bay blue. Fog-silver streets climb the peninsula and meet the piers along the Embarcadero.',
    inks:{background:'#1b303b', water:'#124c65', road:'#ff9d72', minor:'#9cb4bd',
      park:'#30534e', building:'#384854', border:'#8dc9d6', accent:'#ffd49b', label:'#f5f6e9'}
  },
  chicago: {
    family:'lake', motif:'loop', name:'Lakefront and the Loop',
    description:'The red accents of Chicago’s flag stand out against lake blue. Silver streets turn at right angles around the elevated Loop.',
    inks:{background:'#142633', water:'#12516e', road:'#dae8df', minor:'#8aa5b4',
      park:'#2b4a43', building:'#33424c', border:'#8ec3db', accent:'#ff796f', label:'#f7f9ef'}
  },
  seattle: {
    family:'bay', motif:'ferry', name:'Seattle ferry soundings',
    description:'Rain-silver routes cross the isthmus between Puget Sound and Lake Washington. Ferry-green accents pull the eye toward the waterfront.',
    inks:{background:'#1b2a35', water:'#183f62', road:'#cfdee2', minor:'#8eaeb1',
      park:'#2d5144', building:'#37474f', border:'#91c9cb', accent:'#a5df70', label:'#f3f7ec'}
  },
  'new-orleans': {
    family:'delta', motif:'crescent', name:'The Mississippi crescent',
    description:'Brass-colored streets fan out from the Mississippi bends. Purple blocks and cypress green give the French Quarter a distinct edge.',
    inks:{background:'#291d32', water:'#28505a', road:'#f6cb75', minor:'#b693ad',
      park:'#385636', building:'#493849', border:'#b1bea3', accent:'#83d3a2', label:'#fff2dd'}
  },
  nashville: {
    family:'river', motif:'broadway', name:'Broadway and the Cumberland',
    description:'Amber routes follow the bend of the Cumberland and the line of Lower Broadway. Dark blue blocks set off the bright storefront colors.',
    inks:{background:'#202639', water:'#21445e', road:'#ffbe51', minor:'#b1a4a1',
      park:'#3a4c41', building:'#3e4052', border:'#b8adce', accent:'#e79ebb', label:'#fff2d7'}
  },
  boston: {
    family:'bay', motif:'wharf', name:'Boston harbor pilot',
    description:'Copper-green water cuts into the harbor wharves. Brick and parchment tones follow the winding streets around Beacon Hill and the Common.',
    inks:{background:'#25282c', water:'#1d4c51', road:'#f1cca7', minor:'#aca79c',
      park:'#344f3e', building:'#483d3c', border:'#95c2b5', accent:'#e69b84', label:'#f6f2de'}
  },
  dc: {
    family:'capital', motif:'radial', name:'Federal avenues',
    description:'Limestone avenues radiate from circles and squares. A red accent and the long green axis of the National Mall break through the diagonal plan.',
    inks:{background:'#222734', water:'#244355', road:'#f4dfc0', minor:'#a9a5ae',
      park:'#344e36', building:'#424554', border:'#bdadba', accent:'#ff9390', label:'#fff4e3'}
  },
  'san-diego': {
    family:'coastal', motif:'breakwater', name:'San Diego harbor light',
    description:'Kelp green and deep Pacific water define the bay. Sand-gold streets wrap the harbor and the headland at Point Loma.',
    inks:{background:'#292924', water:'#145261', road:'#efcc79', minor:'#a2b19b',
      park:'#40543b', building:'#43433a', border:'#8cc4bf', accent:'#76decc', label:'#fff5d9'}
  },
  portland: {
    family:'forest', motif:'truss', name:'Willamette crossings',
    description:'A sequence of bridges stitches the street grid across the Willamette. Fir green, rain blue and rose pick out the river and its approaches.',
    inks:{background:'#162e2c', water:'#1c4c62', road:'#d6d69a', minor:'#93b9a6',
      park:'#26513c', building:'#344640', border:'#8cc3b6', accent:'#edaaa7', label:'#f4f6df'}
  },
  denver: {
    family:'mountain', motif:'front-range', name:'Front Range survey',
    description:'Alpenglow and slate trace the diagonal downtown grid at the meeting of Cherry Creek and the South Platte.',
    inks:{background:'#252837', water:'#264a63', road:'#ffcc80', minor:'#a8a5ba',
      park:'#394f41', building:'#414457', border:'#a2b4d4', accent:'#f79688', label:'#faf3e1'}
  },
  'las-vegas': {
    family:'neon', motif:'marquee', name:'Desert marquee',
    description:'A champagne-gold spine runs down the Strip through burgundy blocks. Electric violet picks out the junctions along the desert grid.',
    inks:{background:'#281925', water:'#264555', road:'#ffcf6a', minor:'#c995a3',
      park:'#414a39', building:'#533144', border:'#d7a2b3', accent:'#e89dff', label:'#fff3df'}
  },
  phoenix: {
    family:'desert', motif:'canal', name:'Sonoran canal grid',
    description:'The canals cut diagonally through Phoenix’s long street grid. Clay, saguaro green and pale copper recall the Salt River Valley.',
    inks:{background:'#332622', water:'#295255', road:'#f4bf82', minor:'#c5a68c',
      park:'#41513b', building:'#514039', border:'#d2af91', accent:'#9fdaa2', label:'#fff1d9'}
  },
  atlanta: {
    family:'forest', motif:'canopy', name:'Peachtree canopy',
    description:'Warm routes thread through wooded neighborhoods and across the Downtown Connector. Copper accents follow the city’s winding ridge roads.',
    inks:{background:'#192b27', water:'#204852', road:'#f1c99c', minor:'#9db3a0',
      park:'#2b5038', building:'#37483e', border:'#a5c4ac', accent:'#f29f8d', label:'#fbf3db'}
  },
  charleston: {
    family:'coastal', motif:'tideway', name:'Charleston tidal chart',
    description:'Marsh green meets harbor blue where the Ashley and Cooper rivers join. Pale yellow streets mark the peninsula and its bridge approaches.',
    inks:{background:'#27302e', water:'#154a57', road:'#f4d58c', minor:'#a6b6a1',
      park:'#3e5342', building:'#444941', border:'#94c7be', accent:'#eeac98', label:'#fff7df'}
  },
  savannah: {
    family:'forest', motif:'squares', name:'Savannah garden wards',
    description:'Live-oak green sets off the chain of squares in the historic street plan. Pale limestone routes lead from the riverfront toward Forsyth Park.',
    inks:{background:'#242e25', water:'#284a48', road:'#e6dbac', minor:'#a5b196',
      park:'#38543a', building:'#424637', border:'#b7c394', accent:'#e9b785', label:'#faf4dc'}
  },
  orlando: {
    family:'lake', motif:'fountain', name:'Lake Eola afterglow',
    description:'Violet blocks frame the scattered lakes of central Orlando. The fountain at Lake Eola inspires mint accents against the blue water.',
    inks:{background:'#28243d', water:'#244e67', road:'#f4c9a1', minor:'#b19dca',
      park:'#365049', building:'#443c57', border:'#a6bdd4', accent:'#80e3cd', label:'#fbf3fa'}
  },
  honolulu: {
    family:'island', motif:'outrigger', name:'Waikīkī and the ridges',
    description:'A bright reef-blue shoreline meets volcanic green. Warm streets follow the coast between Honolulu Harbor, Waikīkī and Diamond Head.',
    inks:{background:'#1c302e', water:'#11576b', road:'#f8c89c', minor:'#95bcac',
      park:'#31553b', building:'#3b4842', border:'#8ccdc5', accent:'#ef9f9a', label:'#fff6df'}
  },
  dallas: {
    family:'prairie', motif:'lattice', name:'Trinity silverwork',
    description:'Steel-silver roads pick out Dallas’s angular downtown grid against midnight blue. The Trinity floodplain cuts a broad green corridor to the west.',
    inks:{background:'#1b2638', water:'#25465a', road:'#dce3e5', minor:'#99a9bd',
      park:'#374d40', building:'#364253', border:'#9dbcd4', accent:'#94d5fc', label:'#f2f5f1'}
  },
  houston: {
    family:'industrial', motif:'bayou', name:'Buffalo Bayou works',
    description:'Copper-orange roads cross the bayous and ring the city in broad freeway arcs. Blue steel and dark green distinguish port, water and parkland.',
    inks:{background:'#1d2a36', water:'#174b59', road:'#ffb177', minor:'#96aeb5',
      park:'#2f4c40', building:'#384755', border:'#9dcacb', accent:'#77d6d2', label:'#faf1df'}
  }
};
