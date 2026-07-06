const ICONS = {
  map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M9 18 3 21V6l6-3 6 3 6-3v15l-6 3-6-3Z"/><path d="M9 3v15M15 6v15"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m8 5 11 7-11 7V5Z"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="m15 15 6 6"/><path d="m4 4 5 5"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20.8 4.6c-2-2-5.2-2-7.1 0L12 6.3l-1.7-1.7c-2-2-5.2-2-7.1 0s-2 5.2 0 7.1L12 20.5l8.8-8.8c2-1.9 2-5.1 0-7.1Z"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></svg>',
  target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 12a9 9 0 0 1-15.5 6.2"/><path d="M3 12A9 9 0 0 1 18.5 5.8"/><path d="M3 20v-6h6M21 4v6h-6"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 5v14M5 12h14"/></svg>',
  minus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M5 12h14"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-7h6v7"/></svg>',
  layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/><path d="m3 18 9 5 9-5"/></svg>',
  village: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg>',
  diamond: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M6 3h12l4 6-10 12L2 9l4-6Z"/><path d="M2 9h20M8 3l4 18 4-18"/></svg>',
  ruin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 21h16"/><path d="M6 21V9h4v12M14 21V9h4v12"/><path d="M4 9h16l-8-5-8 5Z"/></svg>',
  tower: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M7 21V8l5-4 5 4v13"/><path d="M5 21h14M9 11h6M10 15h4"/></svg>',
  wave: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 16c3 0 3-2 6-2s3 2 6 2 3-2 6-2"/><path d="M3 10c3 0 3-2 6-2s3 2 6 2 3-2 6-2"/></svg>',
  axe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m14 4 6 6-4 4-6-6 4-4Z"/><path d="m2 22 10-10"/><path d="m13 7 4 4"/></svg>',
  flame: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 22c4 0 7-3 7-7 0-3-2-6-5-8 .3 2-.5 3.5-2 4-1-3-3-5-6-7 .5 4-2 6-2 10 0 4 4 8 8 8Z"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/></svg>',
  key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="7.5" cy="14.5" r="4.5"/><path d="M11 11 21 1M16 6l2 2M14 8l2 2"/></svg>',
  slime: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="4" y="6" width="16" height="14" rx="3"/><path d="M8 13h.01M16 13h.01M9 17h6"/></svg>',
  mine: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 17h16M6 17l2-10h8l2 10M8 7l8 10M16 7 8 17"/></svg>',
  portal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M7 21V7l5-4 5 4v14"/><path d="M10 21V9h4v12"/><path d="M7 12h10"/></svg>',
  temple: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 21h18"/><path d="M5 21V9l7-5 7 5v12"/><path d="M9 21v-7h6v7"/></svg>',
  hut: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 12h16L12 5 4 12Z"/><path d="M6 12v8h12v-8"/><path d="M9 20v-4h6v4"/></svg>',
  chest: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 10h16v10H4z"/><path d="M4 10l2-5h12l2 5"/><path d="M12 10v10M9 14h6"/></svg>',
  ship: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 15h16l-3 5H7l-3-5Z"/><path d="M12 4v11M12 5l5 4-5 4"/></svg>',
  snow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 3v18M5 7l14 10M19 7 5 17"/><circle cx="12" cy="12" r="2"/></svg>',
  fossil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M6 17c4-5 8-5 12-1"/><path d="M5 10c3-4 8-4 13 0"/><path d="M7 14h10M9 11v6M15 11v6"/></svg>',
  cave: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 20c1-8 4-13 9-16 5 3 8 8 9 16H3Z"/><path d="M9 20c0-4 1-6 3-8 2 2 3 4 3 8"/></svg>',
  lava: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 16c2-3 4 3 8 0s6 3 8 0"/><path d="M8 12c1-3 3-4 4-8 2 3 4 5 4 8 0 3-2 5-4 5s-4-2-4-5Z"/></svg>',
  geode: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m12 3 8 6v9l-8 3-8-3V9l8-6Z"/><path d="m12 7 4 4-4 6-4-6 4-4Z"/></svg>',
  apple: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 8c3-3 8-1 8 5 0 5-3 8-6 8-1 0-1.5-.5-2-.5s-1 .5-2 .5c-3 0-6-3-6-8 0-6 5-8 8-5Z"/><path d="M12 8c0-3 2-5 5-5"/></svg>'
};

const BIOME_COLORS = {
  0:"#0059d7",1:"#a4d34f",2:"#f8e283",3:"#709159",4:"#19792d",5:"#0d7a6e",
  6:"#558e64",7:"#005fcc",8:"#ce382d",9:"#f2f4f3",10:"#57c2e4",11:"#a9e0e9",
  12:"#dfe8eb",13:"#98a3bf",14:"#e1c9bb",15:"#d6ad7b",16:"#fdec9a",17:"#e8b73a",
  18:"#226d22",19:"#0c625d",20:"#538e4b",21:"#139626",22:"#206e23",23:"#269c31",
  24:"#0045a5",25:"#938c8c",26:"#bcdbd2",27:"#25b12b",28:"#06a906",29:"#276031",
  30:"#00605d",31:"#024344",32:"#2b7631",33:"#1e5a20",34:"#649460",35:"#c8b615",
  36:"#b6a605",37:"#c66631",38:"#c6541a",39:"#ab3c11",40:"#846fb2",41:"#a892d0",
  42:"#ccbcef",43:"#6b598f",44:"#28a8dc",45:"#1985ca",
  46:"#176ba5",47:"#074a9a",48:"#03357c",49:"#012660",50:"#021d4b",
  51:"#59a739",52:"#339241",53:"#93b455",127:"#080808",
  129:"#a4d34f",130:"#eab131",131:"#64845e",132:"#1ea623",133:"#0a6859",134:"#4c8161",
  140:"#a6afc7",149:"#19a923",151:"#26992e",155:"#1ace22",156:"#05c508",157:"#216322",
  158:"#024d4b",160:"#3d7f3e",161:"#2a7530",162:"#528150",163:"#d9c811",164:"#beb708",
  165:"#dd6523",166:"#bc5016",167:"#a9330c",168:"#26c929",169:"#189e1e",170:"#6a3e11",
  171:"#a81d1d",172:"#176e6b",173:"#414258",174:"#528641",175:"#23ac6c",177:"#6cba3b",
  178:"#55a652",179:"#e2ebed",180:"#cedce7",181:"#bdcedb",182:"#869f83",183:"#1c1c36",
  184:"#288458",185:"#fcacc2",186:"#dde5e8",187:"#dcb40a"
};

function hexToRgb(hex) {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

const BIOME_RGB = new Map(Object.entries(BIOME_COLORS).map(([id, hex]) => [Number(id), hexToRgb(hex)]));

const BIOME_NAMES = {
  0:"Ocean",1:"Plains",2:"Desert",3:"Mountains",4:"Forest",5:"Taiga",6:"Swamp",7:"River",
  8:"Nether Wastes",9:"The End",10:"Frozen Ocean",11:"Frozen River",12:"Snowy Tundra",
  13:"Snowy Mountains",14:"Mushroom Fields",15:"Mushroom Field Shore",16:"Beach",
  17:"Desert Hills",18:"Wooded Hills",19:"Taiga Hills",20:"Mountain Edge",21:"Jungle",
  22:"Jungle Hills",23:"Jungle Edge",24:"Deep Ocean",25:"Stone Shore",26:"Snowy Beach",
  27:"Birch Forest",28:"Birch Forest Hills",29:"Dark Forest",30:"Snowy Taiga",
  31:"Snowy Taiga Hills",32:"Giant Tree Taiga",33:"Giant Tree Taiga Hills",
  34:"Wooded Mountains",35:"Savanna",36:"Savanna Plateau",37:"Badlands",
  38:"Wooded Badlands Plateau",39:"Badlands Plateau",40:"Small End Islands",
  41:"End Midlands",42:"End Highlands",43:"End Barrens",44:"Warm Ocean",45:"Lukewarm Ocean",46:"Cold Ocean",
  47:"Deep Warm Ocean",48:"Deep Lukewarm Ocean",49:"Deep Cold Ocean",50:"Deep Frozen Ocean",
  51:"Seasonal Forest",52:"Rainforest",53:"Shrubland",127:"The Void",
  129:"Sunflower Plains",130:"Desert Lakes",131:"Gravelly Mountains",
  132:"Flower Forest",133:"Taiga Mountains",134:"Swamp Hills",140:"Ice Spikes",
  149:"Modified Jungle",151:"Modified Jungle Edge",155:"Tall Birch Forest",
  156:"Tall Birch Hills",157:"Dark Forest Hills",158:"Snowy Taiga Mountains",
  160:"Giant Spruce Taiga",161:"Giant Spruce Taiga Hills",
  162:"Modified Gravelly Mountains",163:"Shattered Savanna",164:"Shattered Savanna Plateau",
  165:"Eroded Badlands",166:"Modified Wooded Badlands Plateau",167:"Modified Badlands Plateau",
  168:"Bamboo Jungle",169:"Bamboo Jungle Hills",
  170:"Soul Sand Valley",171:"Crimson Forest",172:"Warped Forest",173:"Basalt Deltas",
  174:"Dripstone Caves",175:"Lush Caves",177:"Meadow",178:"Grove",179:"Snowy Slopes",
  180:"Jagged Peaks",181:"Frozen Peaks",182:"Stony Peaks",183:"Deep Dark",
  184:"Mangrove Swamp",185:"Cherry Grove",186:"Pale Garden",187:"Sulfur Caves"
};

const MODERN_BIOME_NAMES = {
  3:"Windswept Hills",
  12:"Snowy Plains",
  23:"Sparse Jungle",
  25:"Stony Shore",
  34:"Windswept Forest",
  38:"Wooded Badlands",
  131:"Windswept Gravelly Hills",
  32:"Old Growth Pine Taiga",
  155:"Old Growth Birch Forest",
  160:"Old Growth Spruce Taiga",
  163:"Windswept Savanna"
};

const VILLAGE_LABEL_RULES = [
  { label:"Snowy Village", match: name => /snow|frozen|ice|grove/i.test(name) },
  { label:"Taiga Village", match: name => /taiga/i.test(name) },
  { label:"Savanna Village", match: name => /savanna/i.test(name) },
  { label:"Desert Village", match: name => /desert/i.test(name) },
  { label:"Plains Village", match: name => /plains|meadow|sunflower/i.test(name) }
];

const ICON_ASSET_BASE = `${BASE_PATH}/static/icons/`;
const ICON_ASSETS = {
  spawn: "spawn-point.svg",
  Stronghold: "stronghold.svg",
  Village: "village.svg",
  Monument: "monument.svg",
  Mansion: "mansion.svg",
  Outpost: "outpost.svg",
  Ancient_City: "ancient-city.svg",
  Trial_Chambers: "trial-chamber.svg",
  Desert_Temple: "desert-temple.svg",
  Jungle_Temple: "jungle-temple.svg",
  Witch_Hut: "witch-hut.svg",
  Igloo: "igloo.svg",
  Shipwreck: "shipwreck.svg",
  Ruined_Portal: "ruined-portal.svg",
  Ruined_Portal_Nether: "ruined-portal.svg",
  Treasure: "treasure.svg",
  Mineshaft: "mineshaft.svg",
  Desert_Well: "desert-well.svg",
  Geode: "geode.svg",
  Trail_Ruins: "trail-ruins.svg",
  Slime_Chunk: "slime-chunk.svg",
  Dungeon: "dungeon.svg",
  Fossil: "fossil.svg",
  Cave: "cave.svg",
  Ravine: "ravine.svg",
  Lava_Pool: "lava-pool.svg",
  Apple: "apple.svg",
  Ore_Veins: "ore-veins.svg"
};

function iconAsset(key) {
  return ICON_ASSETS[key] ? `${ICON_ASSET_BASE}${ICON_ASSETS[key]}` : "";
}

const STRUCT_META = {
  spawn: { label:"Spawn Point", icon:"home", asset:iconAsset("spawn"), color:"#edf3ee" },
  Stronghold: { label:"Stronghold", icon:"diamond", asset:iconAsset("Stronghold"), color:"#b99cff" },
  Village: { label:"Village", icon:"village", asset:iconAsset("Village"), color:"#f2b84b" },
  Monument: { label:"Monument", icon:"wave", asset:iconAsset("Monument"), color:"#5cc8f2" },
  Mansion: { label:"Mansion", icon:"tower", asset:iconAsset("Mansion"), color:"#f06a65" },
  Outpost: { label:"Outpost", icon:"axe", asset:iconAsset("Outpost"), color:"#fb9657" },
  Ancient_City: { label:"Ancient City", icon:"ruin", asset:iconAsset("Ancient_City"), color:"#6aa9ff" },
  Trial_Chambers: { label:"Trial Chamber", icon:"shield", asset:iconAsset("Trial_Chambers"), color:"#57d68d" },
  Fortress: { label:"Fortress", icon:"flame", color:"#ef5c55" },
  Bastion: { label:"Bastion", icon:"key", color:"#d24b42" },
  Desert_Temple: { label:"Desert Temple", icon:"temple", asset:iconAsset("Desert_Temple"), color:"#e8ca68" },
  Jungle_Temple: { label:"Jungle Temple", icon:"temple", asset:iconAsset("Jungle_Temple"), color:"#71b85e" },
  Witch_Hut: { label:"Witch Hut", icon:"hut", asset:iconAsset("Witch_Hut"), color:"#8ac177" },
  Igloo: { label:"Igloo", icon:"snow", asset:iconAsset("Igloo"), color:"#dce8f4" },
  Ocean_Ruins: { label:"Ocean Ruins", icon:"wave", color:"#4fc8df" },
  Shipwreck: { label:"Shipwreck", icon:"ship", asset:iconAsset("Shipwreck"), color:"#57c7d9" },
  Ruined_Portal: { label:"Ruined Portal", icon:"portal", asset:iconAsset("Ruined_Portal"), color:"#b56cff" },
  Ruined_Portal_Nether: { label:"Nether Portal", icon:"portal", asset:iconAsset("Ruined_Portal_Nether"), color:"#c46cff" },
  Treasure: { label:"Treasure", icon:"chest", asset:iconAsset("Treasure"), color:"#ffd45c" },
  Mineshaft: { label:"Mineshaft", icon:"mine", asset:iconAsset("Mineshaft"), color:"#c69a5b" },
  Desert_Well: { label:"Desert Well", icon:"temple", asset:iconAsset("Desert_Well"), color:"#e4c26e" },
  Geode: { label:"Geode", icon:"geode", asset:iconAsset("Geode"), color:"#bb9cff" },
  Trail_Ruins: { label:"Trail Ruins", icon:"ruin", asset:iconAsset("Trail_Ruins"), color:"#c99662" },
  End_City: { label:"End City", icon:"tower", color:"#d9c8ff" },
  End_Gateway: { label:"End Gateway", icon:"portal", color:"#bfb3ff" },
  End_Island: { label:"End Island", icon:"diamond", color:"#efe5b4" }
};

const FEATURE_CATALOG = [
  { key:"spawn", supported:true },
  { key:"Slime_Chunk", label:"Slime Chunk", icon:"slime", asset:iconAsset("Slime_Chunk"), color:"#78dc67" },
  { key:"Village", supported:true },
  { key:"Ancient_City", supported:true },
  { key:"Dungeon", label:"Dungeon", icon:"ruin", asset:iconAsset("Dungeon"), color:"#9f8f7a" },
  { key:"Stronghold", supported:true },
  { key:"Mansion", supported:true },
  { key:"Monument", supported:true },
  { key:"Outpost", supported:true },
  { key:"Mineshaft", supported:true },
  { key:"Ruined_Portal", supported:true },
  { key:"Jungle_Temple", supported:true },
  { key:"Desert_Temple", supported:true },
  { key:"Witch_Hut", supported:true },
  { key:"Treasure", supported:true },
  { key:"Shipwreck", supported:true },
  { key:"Igloo", supported:true },
  { key:"Ocean_Ruins", supported:true },
  { key:"Fossil", label:"Fossil", icon:"fossil", asset:iconAsset("Fossil"), color:"#d4c0a4" },
  { key:"Cave", label:"Cave", icon:"cave", asset:iconAsset("Cave"), color:"#9aa2b7" },
  { key:"Ravine", label:"Ravine", icon:"cave", asset:iconAsset("Ravine"), color:"#bd8c64" },
  { key:"Lava_Pool", label:"Lava Pool", icon:"lava", asset:iconAsset("Lava_Pool"), color:"#ff7047" },
  { key:"Geode", supported:true },
  { key:"Apple", label:"Apple", icon:"apple", asset:iconAsset("Apple"), color:"#ff7373" },
  { key:"Ore_Veins", label:"Ore Veins", icon:"mine", asset:iconAsset("Ore_Veins"), color:"#9fb6c8" },
  { key:"Desert_Well", supported:true },
  { key:"Trail_Ruins", supported:true },
  { key:"Trial_Chambers", supported:true }
];

const MARKER_GLYPHS = {
  home: [
    "....#....",
    "...###...",
    "..#####..",
    ".#######.",
    "..#####..",
    "..#...#..",
    "..#...#..",
    "..#####..",
    "........."
  ],
  village: [
    "...###...",
    "..#####..",
    ".#######.",
    "..#.#.#..",
    ".#######.",
    ".#..#..#.",
    ".#..#..#.",
    ".#######.",
    "........."
  ],
  diamond: [
    "....#....",
    "...###...",
    "..#####..",
    ".#######.",
    "#########",
    ".#######.",
    "..#####..",
    "...###...",
    "....#...."
  ],
  wave: [
    ".........",
    ".###..###",
    "##.####.#",
    "#...##..#",
    ".........",
    ".###..###",
    "##.####.#",
    "#...##..#",
    "........."
  ],
  tower: [
    ".#.#.#.#.",
    ".#######.",
    "..#####..",
    "..#.#.#..",
    "..#####..",
    "..#...#..",
    "..#...#..",
    ".#######.",
    "........."
  ],
  axe: [
    ".....###.",
    "....####.",
    "...####..",
    "..###....",
    ".###.....",
    "###......",
    ".#.......",
    "#........",
    "........."
  ],
  ruin: [
    "..#####..",
    ".#######.",
    "....#....",
    "..#.#.#..",
    "..#.#.#..",
    "..#.#.#..",
    "..#...#..",
    ".#######.",
    "........."
  ],
  shield: [
    "..#####..",
    ".#######.",
    "#########",
    "#########",
    ".#######.",
    ".#######.",
    "..#####..",
    "...###...",
    "....#...."
  ],
  flame: [
    "....#....",
    "...##....",
    "..####...",
    ".######..",
    ".###.##..",
    "#######..",
    ".#####...",
    "..###....",
    "...#....."
  ],
  key: [
    "..###....",
    ".#...#...",
    ".#...#...",
    "..###....",
    "....###..",
    "......#..",
    "....###..",
    "......#..",
    "........."
  ],
  target: [
    "...###...",
    "..#...#..",
    ".#..#..#.",
    ".#..#..#.",
    ".###.###.",
    ".#..#..#.",
    ".#..#..#.",
    "..#...#..",
    "...###..."
  ]
};

const VERSION_EXTRAS = {
  "1.16": new Set(["Ruined_Portal","Ruined_Portal_Nether","Fortress","Bastion","End_City","End_Gateway","End_Island"]),
  "1.17": new Set(["Ruined_Portal","Ruined_Portal_Nether","Geode","Fortress","Bastion","End_City","End_Gateway","End_Island"]),
  "1.18": new Set(["Ruined_Portal","Ruined_Portal_Nether","Geode","Fortress","Bastion","End_City","End_Gateway","End_Island"]),
  "1.19": new Set(["Ruined_Portal","Ruined_Portal_Nether","Geode","Ancient_City","Fortress","Bastion","End_City","End_Gateway","End_Island"]),
  "1.20": new Set(["Ruined_Portal","Ruined_Portal_Nether","Geode","Ancient_City","Trail_Ruins","Fortress","Bastion","End_City","End_Gateway","End_Island"]),
  "1.21": new Set(["Ruined_Portal","Ruined_Portal_Nether","Geode","Ancient_City","Trail_Ruins","Trial_Chambers","Fortress","Bastion","End_City","End_Gateway","End_Island"]),
  "26.4": new Set(["Ruined_Portal","Ruined_Portal_Nether","Geode","Ancient_City","Trail_Ruins","Trial_Chambers","Fortress","Bastion","End_City","End_Gateway","End_Island"]),
  "26.3": new Set(["Ruined_Portal","Ruined_Portal_Nether","Geode","Ancient_City","Trail_Ruins","Trial_Chambers","Fortress","Bastion","End_City","End_Gateway","End_Island"]),
  "26.2": new Set(["Ruined_Portal","Ruined_Portal_Nether","Geode","Ancient_City","Trail_Ruins","Trial_Chambers","Fortress","Bastion","End_City","End_Gateway","End_Island"]),
  "26.1": new Set(["Ruined_Portal","Ruined_Portal_Nether","Geode","Ancient_City","Trail_Ruins","Trial_Chambers","Fortress","Bastion","End_City","End_Gateway","End_Island"])
};
const OVERWORLD_FEATURES = new Set(["spawn","Stronghold","Village","Monument","Mansion","Outpost","Ancient_City","Trial_Chambers","Desert_Temple","Jungle_Temple","Witch_Hut","Igloo","Ocean_Ruins","Shipwreck","Ruined_Portal","Treasure","Mineshaft","Desert_Well","Geode","Trail_Ruins"]);
const NETHER_FEATURES = new Set(["Fortress","Bastion","Ruined_Portal_Nether"]);
const END_FEATURES = new Set(["End_City","End_Gateway","End_Island"]);
const BEDROCK_OVERWORLD_FEATURES = new Set(["spawn","Stronghold","Village","Monument","Mansion","Outpost","Ancient_City","Trial_Chambers","Desert_Temple","Jungle_Temple","Witch_Hut","Igloo","Ocean_Ruins","Shipwreck","Ruined_Portal","Treasure","Mineshaft","Trail_Ruins"]);
const BEDROCK_NETHER_FEATURES = new Set(["Fortress","Bastion","Ruined_Portal_Nether"]);
const BEDROCK_END_FEATURES = new Set(["End_City"]);
const OVERWORLD_BASE_FEATURES = new Set(["spawn","Stronghold","Village","Monument","Mansion","Outpost","Desert_Temple","Jungle_Temple","Witch_Hut","Igloo","Ocean_Ruins","Shipwreck","Treasure","Mineshaft","Desert_Well"]);
const DEFAULT_DISABLED_FEATURES = new Set([
  "Ancient_City", "Ocean_Ruins", "Trial_Chambers", "Geode",
  "Mineshaft", "Ruined_Portal", "Treasure", "Shipwreck", "Trail_Ruins",
  "Dungeon", "Cave", "Ravine", "Lava_Pool", "Apple", "Desert_Well"
]);
