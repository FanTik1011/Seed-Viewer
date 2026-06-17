const API = "";
const TILE_BLOCKS = 256;
const WORKER_URL = "/static/seed-worker.js";
const SAMPLE_SCALE = 8;
const TILE_SAMPLES = TILE_BLOCKS / SAMPLE_SCALE;
const MAX_TILE_CACHE = 650;
const MAX_TILE_QUEUE = 120;
const MAX_TILE_REQUESTS = Math.max(2, Math.min(4, Math.floor((navigator.hardwareConcurrency || 4) / 2)));
const MAX_DRAW_TILES = 240;
const TILE_REQUEST_TIMEOUT = 9000;
// Backstop so a hung structure request can't stall the loader or the region
// streamer's in-flight counter (which would otherwise stop locations loading).
const STRUCT_REQUEST_TIMEOUT = 15000;
const MAX_TILE_ATTEMPTS = 3;
const TILE_RETRY_PENALTY = 4000;
const PREFETCH_MARGIN = 0;
const MAX_TILE_ENQUEUE_PER_RENDER = 10;
const MAX_TILE_QUEUE_WHILE_LOADING = 36;
const TILE_VIEW_MARGIN = 0;
const TILE_QUEUE_VIEW_MARGIN = 0;
const TILE_RESULT_KEEP_MARGIN = 0;

// Marker rendering thresholds. Above LITE_LIMIT on-screen markers (or while the
// map is moving) draw cheap dots; above LABEL_LIMIT stop drawing per-marker text.
const MARKER_LITE_LIMIT = 200;
const MARKER_LABEL_LIMIT = 50;
const MARKER_CLUSTER_LIMIT = 120;
// Zoomed further out than this (blocks/px) structure markers are drawn as
// clusters (count badges) instead of full markers — still visible, but compact.
const MARKER_MAX_ZOOM = 5;
const DENSE_MARKER_MAX_ZOOM = 2.2;
const DENSE_MARKER_TYPES = new Set([
  "Mineshaft", "Ruined_Portal", "Treasure", "Shipwreck", "Trail_Ruins",
  "Dungeon", "Cave", "Ravine", "Lava_Pool", "Apple", "Desert_Well"
]);

// Structure streaming: the world is divided into square regions; as the view
// moves, regions that scroll into sight are fetched once and their structures
// merged into the running set, so markers accumulate instead of vanishing.
const STRUCT_REGION = 3072;            // blocks per structure-fetch region
const STRUCT_REGION_MARGIN = 0;        // load the viewport first; nearby areas stream after movement
const MAX_STRUCT_REGION_REQUESTS = 2;  // concurrent region fetches (keeps workers free for tiles)
const STRUCT_BULK_RADIUS = 2048;       // compact first pass around the current view
const STRUCT_BULK_MAX_RADIUS = 3072;   // cap bulk scans so far-zoom views stay responsive
const STRUCT_VIEW_BUFFER = 768;        // small edge buffer; keeps first result quick
const MAX_STREAM_MARKERS = 3500;       // soft cap on accumulated structures before pruning
const STRUCT_KEEP_RADIUS = 2;          // regions around the view kept when pruning
const STRUCT_DEFER_DELAY = 140;        // lower-priority locations load just after the first paint
const STRUCT_FAST_TYPES = [
  "Village", "Ancient_City", "Mansion", "Monument", "Outpost",
  "Desert_Temple", "Jungle_Temple", "Witch_Hut", "Igloo"
];

const WORKER_POOL_SIZE = Math.max(2, Math.min(3, Math.ceil((navigator.hardwareConcurrency || 4) / 3)));
const VISIBLE_TILE_PRIORITY_BOOST = 1_000_000;
const COARSE_TILE_PRIORITY_BOOST = 500_000;
const TILE_BUILD_BATCH = 6;
const TILE_BUILD_FRAME_BUDGET = 4;
const TILE_PENDING_VIEW_MARGIN = 2;


const MODERN_LODS = [
  { blocks: 256,   samples: 32,  scale: 8  },
  { blocks: 1024,  samples: 32,  scale: 32 },
  { blocks: 4096,  samples: 64,  scale: 64 },
  { blocks: 16384, samples: 256, scale: 64 }
];
const LEGACY_LODS = [
  { blocks: 256,   samples: 16,  scale: 16 },
  { blocks: 1024,  samples: 64,  scale: 16 },
  { blocks: 4096,  samples: 64,  scale: 64 },
  { blocks: 16384, samples: 256, scale: 64 }
];
let LODS = MODERN_LODS;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 8;   // was 16: cap how far the map can zoom out (smaller view area → faster location loading)
const DEFAULT_ZOOM = 2;
const ZOOM_EASE = 0.25;
const PAN_FRICTION = 0.9;
const INITIAL_SCAN_RADIUS = 2048;
const MANUAL_SCAN_RADIUS = 3072;
const MAP_BG = "#17158b";
const EMPTY_TILE_COLORS = ["#17158b", "#17158b"];
const UNKNOWN_BIOME_RGB = [38, 45, 41];

const ICONS = {
  map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M9 18 3 21V6l6-3 6 3 6-3v15l-6 3-6-3Z"/><path d="M9 3v15M15 6v15"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m8 5 11 7-11 7V5Z"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="m15 15 6 6"/><path d="m4 4 5 5"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1"/></svg>',
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
  0:"#155ec5",1:"#9fc45c",2:"#ead887",3:"#728a62",4:"#257536",5:"#1a766c",
  6:"#5e8769",7:"#1362bd",8:"#bd473f",9:"#e9ecea",10:"#63b9d4",11:"#a8d7df",
  12:"#d8e0e3",13:"#9aa2b7",14:"#d8c4b8",15:"#caa981",16:"#f1e29a",17:"#d5ae4a",
  18:"#2d6a2d",19:"#17625d",20:"#5b8755",21:"#228d32",22:"#2b6b2e",23:"#34923d",
  24:"#0f4a9d",25:"#8e8e8e",26:"#b9d3cb",27:"#35a43a",28:"#189d18",29:"#315f39",
  30:"#0b615e",31:"#0b4849",32:"#36723b",33:"#285a2a",34:"#6b8d68",35:"#b7a928",
  36:"#a89b18",37:"#b66b42",38:"#b65b2d",39:"#9f4522",44:"#3ba0c9",45:"#2c82b9",
  46:"#276b9a",47:"#174f91",48:"#113b78",49:"#0c2d61",50:"#0b244f",127:"#111111",
  129:"#9fc45c",130:"#d6a943",131:"#697f65",132:"#2e9b32",133:"#16675a",134:"#557c64",
  140:"#a6adbf",149:"#299d31",151:"#34903a",155:"#2dbc34",156:"#19b51c",157:"#2b622c",
  158:"#0b514f",160:"#477a48",161:"#35713a",162:"#5a7c58",163:"#c5b826",164:"#afa91b",
  165:"#c96b37",166:"#ad5728",167:"#9d3d1d",168:"#38b83a",169:"#27942c",170:"#68431d",
  171:"#9c2d2d",172:"#236b69",173:"#484958",174:"#58804b",175:"#33a06d",177:"#70ac4a",
  178:"#5f9c5d",179:"#dbe3e5",180:"#c9d5df",181:"#bac8d3",182:"#899987",183:"#24243b",
  184:"#347e5b",185:"#f2a9bd",186:"#d6dde0"
};

Object.assign(BIOME_COLORS, {
  0:"#000070",1:"#8DB360",2:"#FA9418",3:"#606060",4:"#056621",5:"#0B6659",
  6:"#07F9B2",7:"#0000FF",8:"#BF3B3B",9:"#8080FF",10:"#7070D6",11:"#A0A0FF",
  12:"#FFFFFF",13:"#A0A0A0",14:"#FF00FF",15:"#A000FF",16:"#FADE55",17:"#D25F12",
  18:"#22551C",19:"#163933",20:"#72789A",21:"#537B09",22:"#2C4205",23:"#628B17",
  24:"#000030",25:"#A2A284",26:"#FAF0C0",27:"#307444",28:"#1F5F32",29:"#40511A",
  30:"#31554A",31:"#243F36",32:"#596651",33:"#454F3E",34:"#507050",35:"#BDB25F",
  36:"#A79D64",37:"#D94515",38:"#B09765",39:"#CA8C65",40:"#8080FF",41:"#8080FF",
  42:"#8080FF",43:"#8080FF",44:"#0000AC",45:"#000090",46:"#202070",47:"#000050",
  48:"#000040",49:"#202038",50:"#404090",127:"#000000",129:"#B5DB88",130:"#FFBC40",
  131:"#888888",132:"#2D8E49",133:"#338E81",134:"#2FFFDA",140:"#B4DCDC",
  149:"#7BA331",151:"#8AB33F",155:"#589C6C",156:"#47875A",157:"#687942",
  158:"#597D72",160:"#818E79",161:"#6D7766",162:"#789878",163:"#E5DA87",
  164:"#CFC58C",165:"#FF6D3D",166:"#D8BF8D",167:"#F2B48D",168:"#768E14",
  169:"#3B470A",170:"#5E3830",171:"#DD0808",172:"#49907B",173:"#403636",
  174:"#507050",175:"#59C93C",177:"#60A445",178:"#47783E",179:"#FFFFFF",
  180:"#B0B0B0",181:"#D8D8D8",182:"#A2A284",183:"#303050",184:"#2F6F50",
  185:"#F7B2C4",186:"#C9D6C9"
});
const BIOME_RGB = new Map(Object.entries(BIOME_COLORS).map(([id, hex]) => [Number(id), hexToRgb(hex)]));

const BIOME_NAMES = {
  0:"Ocean",1:"Plains",2:"Desert",3:"Mountains",4:"Forest",5:"Taiga",6:"Swamp",7:"River",
  8:"Nether Wastes",9:"The End",10:"Frozen Ocean",11:"Frozen River",12:"Snowy Tundra",
  14:"Mushroom Fields",16:"Beach",17:"Desert Hills",18:"Wooded Hills",21:"Jungle",
  24:"Deep Ocean",27:"Birch Forest",29:"Dark Forest",30:"Snowy Taiga",32:"Giant Tree Taiga",
  35:"Savanna",37:"Badlands",44:"Warm Ocean",45:"Lukewarm Ocean",46:"Cold Ocean",
  47:"Deep Warm Ocean",48:"Deep Lukewarm Ocean",49:"Deep Cold Ocean",50:"Deep Frozen Ocean",
  170:"Soul Sand Valley",171:"Crimson Forest",172:"Warped Forest",173:"Basalt Deltas",
  174:"Dripstone Caves",175:"Lush Caves",177:"Meadow",178:"Grove",179:"Snowy Slopes",
  180:"Jagged Peaks",181:"Frozen Peaks",182:"Stony Peaks",183:"Deep Dark",
  184:"Mangrove Swamp",185:"Cherry Grove",186:"Pale Garden"
};

const VILLAGE_LABEL_RULES = [
  { label:"Snowy Village", match: name => /snow|frozen|ice|grove/i.test(name) },
  { label:"Taiga Village", match: name => /taiga/i.test(name) },
  { label:"Savanna Village", match: name => /savanna/i.test(name) },
  { label:"Desert Village", match: name => /desert/i.test(name) },
  { label:"Plains Village", match: name => /plains|meadow|sunflower/i.test(name) }
];

const ICON_ASSET_BASE = "/static/icons/";
const ICON_ASSETS = {
  spawn: "spawn-point.svg",
  Stronghold: "stronghold.svg",
  Monument: "monument.svg",
  Mansion: "mansion.svg",
  Outpost: "outpost.svg",
  Ancient_City: "ancient-city.svg",
  Trial_Chambers: "trial-chamber.svg",
  Desert_Temple: "desert-temple.svg",
  Jungle_Temple: "jungle-temple.svg",
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
  Village: { label:"Village", icon:"village", color:"#f2b84b" },
  Monument: { label:"Monument", icon:"wave", asset:iconAsset("Monument"), color:"#5cc8f2" },
  Mansion: { label:"Mansion", icon:"tower", asset:iconAsset("Mansion"), color:"#f06a65" },
  Outpost: { label:"Outpost", icon:"axe", asset:iconAsset("Outpost"), color:"#fb9657" },
  Ancient_City: { label:"Ancient City", icon:"ruin", asset:iconAsset("Ancient_City"), color:"#6aa9ff" },
  Trial_Chambers: { label:"Trial Chamber", icon:"shield", asset:iconAsset("Trial_Chambers"), color:"#57d68d" },
  Fortress: { label:"Fortress", icon:"flame", color:"#ef5c55" },
  Bastion: { label:"Bastion", icon:"key", color:"#d24b42" },
  Desert_Temple: { label:"Desert Temple", icon:"temple", asset:iconAsset("Desert_Temple"), color:"#e8ca68" },
  Jungle_Temple: { label:"Jungle Temple", icon:"temple", asset:iconAsset("Jungle_Temple"), color:"#71b85e" },
  Witch_Hut: { label:"Witch Hut", icon:"hut", color:"#8ac177" },
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
  "1.21": new Set(["Ruined_Portal","Ruined_Portal_Nether","Geode","Ancient_City","Trail_Ruins","Trial_Chambers","Fortress","Bastion","End_City","End_Gateway","End_Island"])
};
const OVERWORLD_FEATURES = new Set(["spawn","Stronghold","Village","Monument","Mansion","Outpost","Ancient_City","Trial_Chambers","Desert_Temple","Jungle_Temple","Witch_Hut","Igloo","Ocean_Ruins","Shipwreck","Ruined_Portal","Treasure","Mineshaft","Desert_Well","Geode","Trail_Ruins"]);
const NETHER_FEATURES = new Set(["Fortress","Bastion","Ruined_Portal_Nether"]);
const END_FEATURES = new Set(["End_City","End_Gateway","End_Island"]);
const OVERWORLD_BASE_FEATURES = new Set(["spawn","Stronghold","Village","Monument","Mansion","Outpost","Desert_Temple","Jungle_Temple","Witch_Hut","Igloo","Ocean_Ruins","Shipwreck","Treasure","Mineshaft","Desert_Well"]);
const DEFAULT_DISABLED_FEATURES = new Set([
  "Ocean_Ruins", "Trial_Chambers", "Geode",
  "Mineshaft", "Ruined_Portal", "Treasure", "Shipwreck", "Trail_Ruins",
  "Dungeon", "Cave", "Ravine", "Lava_Pool", "Apple", "Desert_Well"
]);

const canvas = document.getElementById("map-canvas");
const ctx = canvas.getContext("2d", { alpha: false });
const els = {
  seedInput: document.getElementById("seed-input"),
  version: document.getElementById("version-select"),
  dimension: document.getElementById("dimension-select"),
  menuToggle: document.getElementById("menu-toggle"),
  sidebar: document.querySelector(".sidebar"),
  empty: document.getElementById("empty"),
  loader: document.getElementById("loader"),
  loaderTitle: document.getElementById("loader-title"),
  loaderText: document.getElementById("loader-text"),
  seedCard: document.getElementById("seed-card"),
  activeSeed: document.getElementById("active-seed-val"),
  coordX: document.getElementById("coord-x"),
  coordZ: document.getElementById("coord-z"),
  zoomLabel: document.getElementById("zoom-label"),
  chunkPill: document.getElementById("chunk-pill"),
  chunkLabel: document.getElementById("chunk-label"),
  toast: document.getElementById("toast"),
  tooltip: document.getElementById("tooltip"),
  ttName: document.getElementById("tt-name"),
  ttCoords: document.getElementById("tt-coords"),
  layerList: document.getElementById("layer-list"),
  structList: document.getElementById("struct-list"),
  structTotal: document.getElementById("struct-total"),
  selectedIcon: document.getElementById("selected-icon"),
  selectedLabel: document.getElementById("selected-label"),
  selectedX: document.getElementById("selected-x"),
  selectedZ: document.getElementById("selected-z"),
  selectedChunk: document.getElementById("selected-chunk"),
  selectedBiome: document.getElementById("selected-biome"),
  zoomRange: document.getElementById("zoom-range"),
  gotoX: document.getElementById("goto-x"),
  gotoZ: document.getElementById("goto-z"),
  distanceNote: document.getElementById("distance-note"),
  popover: document.getElementById("location-popover"),
  popoverIcon: document.getElementById("popover-icon"),
  popoverLabel: document.getElementById("popover-label"),
  popoverCoords: document.getElementById("popover-coords"),
  popoverChunk: document.getElementById("popover-chunk"),
  popoverBiome: document.getElementById("popover-biome"),
  shareUrlBtn: document.getElementById("share-url-btn")
};

const state = {
  seed: "",
  version: "1.20",
  dimension: "overworld",
  loaded: false,
  runId: 0,
  viewX: 0,
  viewZ: 0,
  zoom: DEFAULT_ZOOM,
  zoomTarget: DEFAULT_ZOOM,
  zoomAnchor: null,
  width: 1,
  height: 1,
  dpr: 1,
  tiles: new Map(),
  tileQueue: new Map(),
  pendingTiles: new Map(),
  structures: {},
  structFetched: new Set(),
  structSeen: {},
  showBiomes: true,
  showGrid: true,
  showAxes: false,
  cursor: { x: 0, z: 0 },
  selected: null,
  capabilities: null,
  vis: Object.fromEntries(Object.keys(STRUCT_META).map(k => [k, !DEFAULT_DISABLED_FEATURES.has(k)]))
};

let raf = 0;
let zoomRaf = 0;
let momentumRaf = 0;
let panSample = null;
let panVel = { x: 0, z: 0 };
let lastMoveT = 0;
let dragStart = null;
let dragView = null;
let pointerMoved = false;
let toastTimer = 0;
let workerPool = [];
let workerCursor = 0;
let workerSeq = 0;
const workerJobs = new Map();
let urlTimer = 0;
let autoLoadTimer = 0;
let tileBuildPending = false;
let tilePumpPending = false;
const tileBuildQueue = [];
const markerImageCache = new Map();
const labelWidthCache = new Map();
let markerCache = null;
let lastMarkerSnapshot = [];
let frozenMarkerSnapshot = null;
let markerRefreshPending = false;
let hudCache = "";
let selectedPanelCache = "";
let chunkPillCache = "";
let structRegionQueue = [];
let structRegionInFlight = 0;
let sidebarRefreshTimer = 0;
let structureStreamTimer = 0;


function initWorker() {
  if (!("Worker" in window)) return;
  workerPool = [];
  for (let i = 0; i < WORKER_POOL_SIZE; i++) {
    const w = new Worker(WORKER_URL);
    w.addEventListener("message", event => {
      const { id, ok, data, error } = event.data || {};
      const job = workerJobs.get(id);
      if (!job) return;
      workerJobs.delete(id);
      if (ok) {
        job.resolve(data);
      } else {
        job.reject(new Error(error || "Worker task failed"));
      }
    });
    w.addEventListener("error", event => {
      for (const [id, job] of workerJobs) {
        if (job.worker === w) {
          job.reject(new Error(event.message || "Worker failed"));
          workerJobs.delete(id);
        }
      }
    });
    workerPool.push(w);
  }
}

function workerRequest(type, payload = {}) {
  if (!workerPool.length) {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const promise = directRequest(type, payload, controller?.signal);
    promise.cancel = () => controller?.abort();
    return promise;
  }
  const w = workerPool[workerCursor];
  workerCursor = (workerCursor + 1) % workerPool.length;
  const id = ++workerSeq;
  const promise = new Promise((resolve, reject) => {
    workerJobs.set(id, { resolve, reject, worker: w, type, payload });
    w.postMessage({ id, type, payload });
  });
  promise.cancel = () => {
    const job = workerJobs.get(id);
    if (!job) return;
    workerJobs.delete(id);
    w.postMessage({ id, type: "cancel" });
    job.reject(new DOMException("Request canceled", "AbortError"));
  };
  return promise;
}

function cancelWorkerJob(id, reason = "Request canceled") {
  const job = workerJobs.get(id);
  if (!job) return;
  workerJobs.delete(id);
  job.worker.postMessage({ id, type: "cancel" });
  job.reject(new DOMException(reason, "AbortError"));
}

function cancelWorldWorkerJobs() {
  for (const [id, job] of [...workerJobs]) {
    if (job.type === "biomeTile" || job.type === "structures" || job.type === "structureType") {
      cancelWorkerJob(id, "World changed");
    }
  }
}

async function directRequest(type, payload = {}, signal = undefined) {
  let url = "";
  if (type === "biomeTile") {
    const params = new URLSearchParams({
      seed: payload.seed,
      version: payload.version,
      dimension: payload.dimension || "overworld",
      x: String(payload.x),
      z: String(payload.z),
      w: String(payload.w),
      h: String(payload.h),
      scale: String(payload.scale)
    });
    url = `${API}/api/biomes?${params}`;
  } else if (type === "structures") {
    const params = new URLSearchParams({
      seed: payload.seed,
      version: payload.version,
      dimension: payload.dimension || "overworld",
      x: String(payload.x),
      z: String(payload.z),
      w: String(payload.w),
      h: String(payload.h)
    });
    if (payload.types != null) params.set("types", payload.types);
    if (payload.core != null) params.set("core", payload.core ? "1" : "0");
    url = `${API}/api/all_structures?${params}`;
  } else if (type === "structureType") {
    const params = new URLSearchParams({
      seed: payload.seed,
      version: payload.version,
      dimension: payload.dimension || "overworld",
      type: payload.structure,
      x: String(payload.x),
      z: String(payload.z),
      w: String(payload.w),
      h: String(payload.h)
    });
    url = `${API}/api/structures?${params}`;
  } else if (type === "randomSeed") {
    url = `${API}/api/random_seed`;
  } else if (type === "searchSeeds") {
    const params = new URLSearchParams({
      version: payload.version,
      attempts: String(payload.attempts),
      radius: String(payload.radius),
      limit: String(payload.limit || 8),
      required: payload.required
    });
    url = `${API}/api/search_seeds?${params}`;
  } else if (type === "capabilities") {
    url = `${API}/api/capabilities`;
  }
  const response = await fetch(url, { signal });
  const data = await response.json();
  if (!response.ok || data.error) throw new Error(data.error || "Request failed");
  return data;
}

function setIcon(id, name, label) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = ICONS[name] + (label ? `<span>${label}</span>` : "");
}

function iconMarkup(iconName, asset = "") {
  if (asset) return `<img src="${asset}" alt="" loading="lazy" decoding="async">`;
  return ICONS[iconName] || ICONS.target;
}

function bootIcons() {
  document.getElementById("brand-icon").innerHTML = iconMarkup("map", iconAsset("spawn"));
  document.getElementById("empty-icon").innerHTML = iconMarkup("map", iconAsset("spawn"));
  setIcon("random-btn", "shuffle", "Random");
  setIcon("copy-seed-btn", "copy", "Copy seed");
  setIcon("copy-active-seed", "copy");
  if (document.getElementById("copy-cursor")) setIcon("copy-cursor", "copy");
  setIcon("zoom-in", "plus");
  setIcon("zoom-out", "minus");
  setIcon("copy-selected-coords", "copy", "Copy");
  setIcon("copy-selected-tp", "target", "/tp");
  setIcon("copy-popover-coords", "copy", "Copy");
  setIcon("copy-popover-tp", "target", "/tp");
  setIcon("reset-view-btn", "target", "Reset view");
  setIcon("go-btn", "play", "Go to location");
  setIcon("close-popover", "close");
  setIcon("share-url-btn", "link", "Share");
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  state.width = Math.max(1, Math.floor(rect.width));
  state.height = Math.max(1, Math.floor(rect.height));
  state.dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(state.width * state.dpr);
  canvas.height = Math.floor(state.height * state.dpr);
  requestRender();
}

function worldToScreen(wx, wz) {
  return {
    x: state.width / 2 + (wx - state.viewX) / state.zoom,
    y: state.height / 2 + (wz - state.viewZ) / state.zoom
  };
}

function screenToWorld(sx, sy) {
  return {
    x: Math.round(state.viewX + (sx - state.width / 2) * state.zoom),
    z: Math.round(state.viewZ + (sy - state.height / 2) * state.zoom)
  };
}

function tileKey(lod, tx, tz) {
  return `${lod}:${tx},${tz}`;
}

function dimensionCaps(dimension = state.dimension) {
  return state.capabilities?.dimensions?.[dimension] || {
    biomes: dimension === "overworld",
    structures: dimension !== "end",
    spawn: dimension === "overworld",
    strongholds: dimension === "overworld"
  };
}

function dimensionFeatureSet(dimension = state.dimension) {
  if (dimension === "nether") return NETHER_FEATURES;
  if (dimension === "end") return END_FEATURES;
  return OVERWORLD_FEATURES;
}

function isFeatureAvailable(key, version = state.version, dimension = state.dimension) {
  const set = dimensionFeatureSet(dimension);
  if (!set.has(key)) return false;
  if (OVERWORLD_BASE_FEATURES.has(key)) return true;
  if (dimension === "end" && !dimensionCaps(dimension).structures) return false;
  if (dimension !== "overworld" && (key === "spawn" || key === "Stronghold")) return false;
  return (VERSION_EXTRAS[version] || new Set()).has(key);
}

function activeStructureTypes() {
  return Object.keys(STRUCT_META)
    .filter(key => key !== "spawn" && key !== "Stronghold")
    .filter(key => state.vis[key] && isFeatureAvailable(key));
}

function usesLegacyBiomeLayers(version = state.version) {
  return ["1.16", "1.17"].includes(version);
}

function applyVersionLods(version = state.version) {
  LODS = usesLegacyBiomeLayers(version) ? LEGACY_LODS : MODERN_LODS;
}

function featureDataLoaded(key) {
  if (key === "spawn") return !!state.structures.spawn;
  if (key === "Stronghold") return Array.isArray(state.structures.strongholds);
  return Array.isArray(state.structures[key]);
}

function requestRender() {
  if (raf) return;
  raf = requestAnimationFrame(render);
}

function resetUiCaches() {
  hudCache = "";
  selectedPanelCache = "";
  chunkPillCache = "";
}

function invalidateMarkers() {
  if (frozenMarkerSnapshot) {
    markerRefreshPending = true;
    return;
  }
  markerCache = null;
}

function freezeMarkers() {
  if (frozenMarkerSnapshot) return;
  frozenMarkerSnapshot = markerCache || lastMarkerSnapshot;
  if (!frozenMarkerSnapshot || !frozenMarkerSnapshot.length) {
    frozenMarkerSnapshot = buildMarkers();
    markerCache = frozenMarkerSnapshot;
    lastMarkerSnapshot = frozenMarkerSnapshot;
  }
}

function unfreezeMarkers() {
  if (!frozenMarkerSnapshot) return;
  frozenMarkerSnapshot = null;
  if (markerRefreshPending) {
    markerRefreshPending = false;
    markerCache = null;
    visibleMarkers();
    requestRender();
  }
}

function scheduleStructureStream(delay = 240, reset = false) {
  if (structureStreamTimer && !reset) return;
  clearTimeout(structureStreamTimer);
  if (!state.loaded) return;
  structureStreamTimer = setTimeout(() => {
    structureStreamTimer = 0;
    if (!mapIsMoving()) streamStructures();
    else scheduleStructureStream(260, true);
  }, delay);
}

function cancelMomentum() {
  if (momentumRaf) {
    cancelAnimationFrame(momentumRaf);
    momentumRaf = 0;
  }
}

function cancelZoomAnim() {
  if (zoomRaf) {
    cancelAnimationFrame(zoomRaf);
    zoomRaf = 0;
  }
}

// Ease state.zoom toward state.zoomTarget while keeping the anchor world-point
// pinned under its screen position — a smooth, cursor-anchored zoom.
function startZoomTo(target, sx = state.width / 2, sy = state.height / 2) {
  if (!state.loaded) return;
  cancelMomentum();
  clearTimeout(structureStreamTimer);
  freezeMarkers();
  const before = screenToWorld(sx, sy);
  state.zoomTarget = clamp(target, MIN_ZOOM, MAX_ZOOM);
  state.zoomAnchor = { sx, sy, wx: before.x, wz: before.z };
  if (!zoomRaf) zoomRaf = requestAnimationFrame(animateZoom);
}

function animateZoom() {
  const t = state.zoomTarget;
  const diff = t - state.zoom;
  if (Math.abs(diff) <= Math.max(0.0008, t * 0.004)) {
    state.zoom = t;
    zoomRaf = 0;
    unfreezeMarkers();
    loadVisibleStructuresNow();
  } else {
    state.zoom += diff * ZOOM_EASE;
    zoomRaf = requestAnimationFrame(animateZoom);
  }
  const a = state.zoomAnchor;
  if (a) {
    state.viewX = a.wx - (a.sx - state.width / 2) * state.zoom;
    state.viewZ = a.wz - (a.sy - state.height / 2) * state.zoom;
  }
  scheduleUrlUpdate();
  requestRender();
}

// Glide the view after a flick, with frame-rate-independent friction.
function startMomentum(vx, vz) {
  cancelMomentum();
  if (Math.hypot(vx, vz) < 0.015) {
    unfreezeMarkers();
    loadVisibleStructuresNow();
    return;
  }
  let last = performance.now();
  const step = ts => {
    const dt = Math.min(40, ts - last);
    last = ts;
    state.viewX += vx * dt;
    state.viewZ += vz * dt;
    const f = Math.pow(PAN_FRICTION, dt / 16.67);
    vx *= f;
    vz *= f;
    scheduleUrlUpdate();
    requestRender();
    if (Math.hypot(vx, vz) > 0.01) {
      momentumRaf = requestAnimationFrame(step);
    } else {
      momentumRaf = 0;
      unfreezeMarkers();
      loadVisibleStructuresNow();
    }
  };
  freezeMarkers();
  momentumRaf = requestAnimationFrame(step);
}

function zoomToSlider(z) {
  return Math.log(z / MIN_ZOOM) / Math.log(MAX_ZOOM / MIN_ZOOM);
}

function sliderToZoom(t) {
  return MIN_ZOOM * Math.pow(MAX_ZOOM / MIN_ZOOM, clamp(t, 0, 1));
}

// Set zoom instantly (slider, programmatic jumps) and keep the animator in sync.
function setZoomImmediate(z) {
  cancelZoomAnim();
  state.zoom = clamp(z, MIN_ZOOM, MAX_ZOOM);
  state.zoomTarget = state.zoom;
}

function visibleTileRange() {
  const tl = screenToWorld(0, 0);
  const br = screenToWorld(state.width, state.height);
  const range = {
    txMin: Math.floor(tl.x / TILE_BLOCKS) - 1,
    txMax: Math.floor(br.x / TILE_BLOCKS) + 1,
    tzMin: Math.floor(tl.z / TILE_BLOCKS) - 1,
    tzMax: Math.floor(br.z / TILE_BLOCKS) + 1
  };
  range.count = (range.txMax - range.txMin + 1) * (range.tzMax - range.tzMin + 1);
  range.tilePx = TILE_BLOCKS / state.zoom;
  return range;
}

// Choose the finest LOD whose tiles still cover the viewport within the draw
// budget. Coarser tiers keep the on-screen tile count low when zoomed far out.
function pickLod() {
  const wWorld = state.width * state.zoom;
  const hWorld = state.height * state.zoom;
  for (let i = 0; i < LODS.length - 1; i++) {
    const b = LODS[i].blocks;
    const count = (Math.ceil(wWorld / b) + 3) * (Math.ceil(hWorld / b) + 3);
    if (count <= MAX_DRAW_TILES) return i;
  }
  return LODS.length - 1;
}

function biomeTileRange(lod) {
  const b = LODS[lod].blocks;
  const tl = screenToWorld(0, 0);
  const br = screenToWorld(state.width, state.height);
  const range = {
    lod,
    blocks: b,
    txMin: Math.floor(tl.x / b) - TILE_VIEW_MARGIN,
    txMax: Math.floor(br.x / b) + TILE_VIEW_MARGIN,
    tzMin: Math.floor(tl.z / b) - TILE_VIEW_MARGIN,
    tzMax: Math.floor(br.z / b) + TILE_VIEW_MARGIN
  };
  range.count = (range.txMax - range.txMin + 1) * (range.tzMax - range.tzMin + 1);
  range.tilePx = b / state.zoom;
  return range;
}

function render() {
  raf = 0;
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = MAP_BG;
  ctx.fillRect(0, 0, state.width, state.height);
  if (!state.loaded) return;

  const gridRange = visibleTileRange();
  const canStreamBiomes = dimensionCaps().biomes;
  const lod = pickLod();
  const range = biomeTileRange(lod);
  const detailedBiomes = canStreamBiomes && state.showBiomes && range.count <= MAX_DRAW_TILES && range.tilePx >= 10;
  els.distanceNote.classList.toggle("visible", state.showBiomes && !detailedBiomes);
  els.distanceNote.querySelector("span").textContent = canStreamBiomes
    ? "Zoom in to stream detailed biomes"
    : "Biome streaming for this dimension needs a rebuilt native library";
  trimTileQueueToView(range);
  cancelStaleTileRequests();
  dropStaleTileBuilds();
  if (detailedBiomes) {
    queueCoarseFallbacks(range);
    drawBiomes(range);
    prefetchAround(range);
    drawMapVignette();
  } else {
    drawSeedmapLoadingMap(range);
  }
  if (state.showGrid && gridRange.tilePx >= 12) drawGrid(gridRange);
  if (state.showAxes) drawAxes();
  drawSelection();
  drawStructures();
  updateHud();
  if (!mapIsMoving()) updateSelectedPanel();
  updateChunkPill();
  pumpTiles();
  if (!mapIsMoving()) scheduleStructureStream(320);
}

function prefetchAround(range) {
  // Warm a ring just outside the viewport so a pan reveals ready tiles.
  // queueTile prioritises by distance to view centre, so these naturally
  // load after everything currently on screen. While moving, skip this so drag
  // stays smooth; visible tiles are still queued by drawBiomes().
  if (!state.showBiomes || !dimensionCaps().biomes || mapIsMoving()) return;
  if (state.pendingTiles.size > MAX_TILE_REQUESTS / 2 || state.tileQueue.size > MAX_TILE_QUEUE * .35) return;
  for (let tz = range.tzMin - PREFETCH_MARGIN; tz <= range.tzMax + PREFETCH_MARGIN; tz++) {
    for (let tx = range.txMin - PREFETCH_MARGIN; tx <= range.txMax + PREFETCH_MARGIN; tx++) {
      if (tx >= range.txMin && tx <= range.txMax && tz >= range.tzMin && tz <= range.tzMax) continue;
      queueTile(range.lod, tx, tz);
    }
  }
}

function queueCoarseFallbacks(range) {
  if (!state.showBiomes || !dimensionCaps().biomes || range.lod >= LODS.length - 1) return;
  const startX = range.txMin * range.blocks;
  const endX = (range.txMax + 1) * range.blocks - 1;
  const startZ = range.tzMin * range.blocks;
  const endZ = (range.tzMax + 1) * range.blocks - 1;
  const lod = range.lod + 1;
  const cfg = LODS[lod];
  const txMin = Math.floor(startX / cfg.blocks);
  const txMax = Math.floor(endX / cfg.blocks);
  const tzMin = Math.floor(startZ / cfg.blocks);
  const tzMax = Math.floor(endZ / cfg.blocks);
  for (let tz = tzMin; tz <= tzMax; tz++) {
    for (let tx = txMin; tx <= txMax; tx++) {
      queueTile(lod, tx, tz, true);
    }
  }
}

function mapIsMoving() {
  // A press that hasn't moved yet (a click/tap) is not motion — only an actual
  // drag, momentum glide, or zoom counts, so clicking never flips markers to the
  // cheap dot style.
  return !!((dragStart && pointerMoved) || momentumRaf || zoomRaf);
}


function drawFallbackTile(fineLod, tx, tz, pos, tilePx) {
  const fine = LODS[fineLod];
  const wx = tx * fine.blocks;
  const wz = tz * fine.blocks;
  for (let lod = fineLod + 1; lod < LODS.length; lod++) {
    const c = LODS[lod];
    const ctx2 = Math.floor(wx / c.blocks);
    const ctz = Math.floor(wz / c.blocks);
    const tile = state.tiles.get(tileKey(lod, ctx2, ctz));
    if (!tile) continue;
    const sx = (wx - ctx2 * c.blocks) / c.scale;
    const sy = (wz - ctz * c.blocks) / c.scale;
    const sSize = fine.blocks / c.scale;
    ctx.drawImage(tile.canvas, sx, sy, sSize, sSize, pos.x, pos.y, tilePx + 1, tilePx + 1);
    tile.last = performance.now();
    return true;
  }
  return false;
}

function drawBiomes(range, queueVisible = true) {
  const cfg = LODS[range.lod];
  const tilePx = cfg.blocks / state.zoom;
  const tiles = orderedTiles(range);
  let queuedThisFrame = 0;
  const queueBudget = state.tileQueue.size > MAX_TILE_QUEUE_WHILE_LOADING ? 0 : MAX_TILE_ENQUEUE_PER_RENDER;
  for (const item of tiles) {
      const { tx, tz } = item;
      const key = tileKey(range.lod, tx, tz);
      const pos = worldToScreen(tx * cfg.blocks, tz * cfg.blocks);
      const tile = state.tiles.get(key);
      if (state.showBiomes && tile) {
        tile.last = performance.now();
        ctx.drawImage(tile.canvas, pos.x, pos.y, tilePx + 1, tilePx + 1);
      } else if (state.showBiomes && drawFallbackTile(range.lod, tx, tz, pos, tilePx)) {
      
      } else {
        drawPendingTile(pos, tilePx, item.dist);
      }
      if (queueVisible && state.showBiomes && !tile && queuedThisFrame < queueBudget) {
        if (queueTile(range.lod, tx, tz, true)) queuedThisFrame++;
      }
  }
  if (queuedThisFrame >= queueBudget && queueBudget > 0) requestRender();
}

function drawSeedmapLoadingMap(range) {
  ctx.save();
  drawBiomes(range, false);
  ctx.strokeStyle = "rgba(255,255,255,.18)";
  ctx.lineWidth = 1;
  drawLoadedTileOutline(range);
  ctx.restore();
}

function orderedTiles(range) {
  const cx = state.viewX / range.blocks;
  const cz = state.viewZ / range.blocks;
  const tiles = [];
  for (let tz = range.tzMin; tz <= range.tzMax; tz++) {
    for (let tx = range.txMin; tx <= range.txMax; tx++) {
      tiles.push({ tx, tz, dist: Math.hypot(tx + .5 - cx, tz + .5 - cz) });
    }
  }
  return tiles.sort((a, b) => a.dist - b.dist);
}

function drawPendingTile(pos, tilePx, dist) {
  if (tilePx < 18) return;
  const alpha = clamp(.08 - dist * .006, .018, .055);
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  ctx.fillRect(pos.x, pos.y, tilePx + 1, tilePx + 1);
}

function drawLoadedTileOutline(range) {
  const cfg = LODS[range.lod];
  const tilePx = cfg.blocks / state.zoom;
  if (tilePx < 10) return;
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,.42)";
  ctx.lineWidth = 1;
  for (let tz = range.tzMin; tz <= range.tzMax; tz++) {
    for (let tx = range.txMin; tx <= range.txMax; tx++) {
      if (!state.tiles.has(tileKey(range.lod, tx, tz))) continue;
      const pos = worldToScreen(tx * cfg.blocks, tz * cfg.blocks);
      ctx.strokeRect(Math.round(pos.x) + .5, Math.round(pos.y) + .5, Math.round(tilePx), Math.round(tilePx));
    }
  }
  ctx.restore();
}

function drawMapVignette() {
  // Disabled: the edge vignette looked like a persistent top header strip.
}

function drawGrid(range) {
  const tilePx = TILE_BLOCKS / state.zoom;
  if (tilePx < 18) return;
  ctx.lineWidth = 1;
  ctx.strokeStyle = tilePx > 80 ? "rgba(6,18,22,.30)" : "rgba(6,18,22,.20)";
  for (let tx = range.txMin; tx <= range.txMax + 1; tx++) {
    const x = worldToScreen(tx * TILE_BLOCKS, 0).x;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, state.height);
    ctx.stroke();
  }
  for (let tz = range.tzMin; tz <= range.tzMax + 1; tz++) {
    const y = worldToScreen(0, tz * TILE_BLOCKS).y;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(state.width, y);
    ctx.stroke();
  }
  if (tilePx > 54) drawGridLabels(range);
}

function drawGridLabels(range) {
  ctx.save();
  ctx.font = "12px Cascadia Mono, Consolas, monospace";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  for (let tx = range.txMin; tx <= range.txMax + 1; tx++) {
    const wx = tx * TILE_BLOCKS;
    const x = worldToScreen(wx, 0).x;
    if (x < -30 || x > state.width + 30) continue;
    drawGridTag(String(wx), x, state.height - 18);
  }
  ctx.textAlign = "center";
  for (let tz = range.tzMin; tz <= range.tzMax + 1; tz++) {
    const wz = tz * TILE_BLOCKS;
    const y = worldToScreen(0, wz).y;
    if (y < -30 || y > state.height + 30) continue;
    drawGridTag(String(wz), state.width - 30, y);
  }
  ctx.restore();
}

function drawGridTag(text, x, y) {
  const w = Math.max(34, ctx.measureText(text).width + 10);
  ctx.fillStyle = "rgba(7,12,14,.74)";
  roundRect(x - w / 2, y - 11, w, 22, 5, true, false);
  ctx.fillStyle = "rgba(239,246,241,.9)";
  ctx.fillText(text, x, y + .5);
}

function drawAxes() {
  const origin = worldToScreen(0, 0);
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,.22)";
  ctx.setLineDash([5, 5]);
  if (origin.x >= 0 && origin.x <= state.width) {
    ctx.beginPath();
    ctx.moveTo(origin.x, 0);
    ctx.lineTo(origin.x, state.height);
    ctx.stroke();
  }
  if (origin.y >= 0 && origin.y <= state.height) {
    ctx.beginPath();
    ctx.moveTo(0, origin.y);
    ctx.lineTo(state.width, origin.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSelection() {
  if (!state.selected) return;
  const p = worldToScreen(state.selected.x, state.selected.z);
  if (p.x < -40 || p.y < -40 || p.x > state.width + 40 || p.y > state.height + 40) return;
  ctx.save();
  ctx.strokeStyle = "#edf3ee";
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.arc(p.x, p.y, 15, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawStructures() {
  const all = visibleMarkers();
  const moving = mapIsMoving();
  // Single pass: collect just the markers actually on screen.
  const onScreenMarkers = [];
  for (const m of all) {
    if (shouldHideDenseMarker(m)) continue;
    const sx = state.width / 2 + (m.x - state.viewX) / state.zoom;
    const sy = state.height / 2 + (m.z - state.viewZ) / state.zoom;
    if (sx < -70 || sy < -70 || sx > state.width + 70 || sy > state.height + 70) continue;
    onScreenMarkers.push(m);
  }
  // Zoomed out: show clusters (count badges) so locations stay visible without
  // clutter or lag. Zoomed in: full markers, labelled for every visible spot
  // (dots only when moving or extremely dense).
  if (state.zoom > MARKER_MAX_ZOOM || onScreenMarkers.length > MARKER_CLUSTER_LIMIT || moving && onScreenMarkers.length > MARKER_LABEL_LIMIT) {
    drawMarkerClusters(onScreenMarkers, true);
    return;
  }
  const lite = onScreenMarkers.length > MARKER_LITE_LIMIT;
  const allowLabel = !moving && onScreenMarkers.length <= MARKER_LABEL_LIMIT;
  for (const marker of onScreenMarkers) drawMarker(marker, lite, allowLabel);
}

function shouldHideDenseMarker(marker) {
  if (marker.type === "spawn" || marker.type === "Stronghold" || marker.type === "Village") return false;
  return DENSE_MARKER_TYPES.has(marker.type) && state.zoom > DENSE_MARKER_MAX_ZOOM;
}

function drawMarkerClusters(markers, lite = false) {
  const cells = new Map();
  const cellSize = markers.length > 450 ? 70 : markers.length > 220 ? 58 : 46;
  for (const marker of markers) {
    const p = worldToScreen(marker.x, marker.z);
    const key = `${Math.floor(p.x / cellSize)},${Math.floor(p.y / cellSize)}`;
    const group = cells.get(key) || { count: 0, x: 0, y: 0, color: marker.color, marker };
    group.count++;
    group.x += p.x;
    group.y += p.y;
    if (group.count === 1 || marker.type === "spawn") {
      group.color = marker.color;
      group.marker = marker;
    }
    cells.set(key, group);
  }
  for (const group of cells.values()) {
    group.x /= group.count;
    group.y /= group.count;
    if (group.count === 1) {
      drawMarker(group.marker, lite, false);
    } else {
      drawClusterBadge(group, lite);
    }
  }
}

function drawClusterBadge(group, lite = false) {
  const r = group.count > 99 ? 16 : 14;
  ctx.save();
  ctx.translate(group.x, group.y);
  if (!lite) {
    ctx.shadowColor = "rgba(0,0,0,.52)";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
  }
  ctx.fillStyle = "#111719";
  ctx.strokeStyle = group.color + "dd";
  ctx.lineWidth = 2;
  roundRect(-r, -r, r * 2, r * 2, 4, true, true);
  ctx.fillStyle = group.color + "22";
  roundRect(-r + 3, -r + 3, (r - 3) * 2, (r - 3) * 2, 3, true, false);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#f8fbf9";
  ctx.font = "800 11px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(group.count > 999 ? "999+" : String(group.count), 0, 1);
  ctx.restore();
}

function drawMarker(marker, lite = false, allowLabel = true) {
  const p = worldToScreen(marker.x, marker.z);
  if (p.x < -70 || p.y < -70 || p.x > state.width + 70 || p.y > state.height + 70) return;
  const selected = isSelectedMarker(marker);
  // Cheap dot for dense / moving views. Selected + spawn always stay detailed.
  if (lite && !selected && marker.type !== "spawn") {
    ctx.fillStyle = "rgba(5,8,10,.72)";
    ctx.beginPath();
    ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = marker.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const color = marker.color;
  const scale = state.zoom <= 2 ? 1.08 : state.zoom <= 6 ? .96 : .82;
  const size = 27 * scale;
  const half = size / 2;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.shadowColor = "rgba(0,0,0,.48)";
  ctx.shadowBlur = selected ? 16 : 10;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = color + (selected ? "46" : "24");
  ctx.beginPath();
  ctx.arc(0, 0, half + 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = selected ? "#172119" : "#101518";
  ctx.strokeStyle = color + "ee";
  ctx.lineWidth = selected ? 2.4 : 1.8;
  roundRect(-half, -half, size, size, 5, true, true);
  ctx.fillStyle = color;
  roundRect(-half + 4, -half + 4, size - 8, size - 8, 3, true, false);
  ctx.fillStyle = "rgba(255,255,255,.22)";
  ctx.fillRect(-half + 5, -half + 5, size - 10, 2);
  if (!drawMarkerAsset(marker.asset, size)) drawMarkerGlyph(marker.icon, "#07100d", size);
  ctx.restore();
  if (selected || marker.type === "spawn" || allowLabel) drawMarkerLabel(marker, p, color);
}

function isSelectedMarker(marker) {
  return !!state.selected &&
    Math.round(marker.x) === state.selected.x &&
    Math.round(marker.z) === state.selected.z &&
    marker.type === state.selected.type;
}

function labelWidth(label) {
  let w = labelWidthCache.get(label);
  if (w === undefined) {
    w = ctx.measureText(label).width + 14;
    labelWidthCache.set(label, w);
  }
  return w;
}

function drawMarkerLabel(marker, p, color) {
  const label = marker.ring ? `${marker.label} ${marker.ring}` : marker.label;
  ctx.save();
  ctx.font = "600 12px Inter, system-ui, sans-serif";
  ctx.textBaseline = "middle";
  const w = labelWidth(label);
  const x = Math.min(state.width - w - 8, Math.max(8, p.x + 16));
  const y = Math.min(state.height - 18, Math.max(18, p.y - 13));
  ctx.fillStyle = "rgba(9,11,15,.84)";
  ctx.strokeStyle = color + "90";
  ctx.lineWidth = 1;
  roundRect(x, y - 12, w, 24, 5, true, true);
  ctx.fillStyle = "#f5f7f8";
  ctx.fillText(label, x + 7, y);
  ctx.restore();
}

function drawMarkerGlyph(icon, color, size) {
  const glyph = MARKER_GLYPHS[icon] || MARKER_GLYPHS.target;
  const cell = Math.max(1.45, size / 17);
  const start = -cell * 4.5;
  ctx.fillStyle = color;
  for (let y = 0; y < glyph.length; y++) {
    for (let x = 0; x < glyph[y].length; x++) {
      if (glyph[y][x] !== "#") continue;
      ctx.fillRect(start + x * cell, start + y * cell, cell * .88, cell * .88);
    }
  }
}

function drawMarkerAsset(asset, size) {
  if (!asset) return false;
  const img = markerImage(asset);
  if (!img.complete || !img.naturalWidth) return false;
  const inset = Math.max(1, size * .08);
  ctx.drawImage(img, -size / 2 + inset, -size / 2 + inset, size - inset * 2, size - inset * 2);
  return true;
}

function markerImage(asset) {
  let img = markerImageCache.get(asset);
  if (img) return img;
  img = new Image();
  img.decoding = "async";
  img.onload = requestRender;
  img.src = asset;
  markerImageCache.set(asset, img);
  return img;
}

function line(points) {
  ctx.beginPath();
  points.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
  ctx.stroke();
}
function rect(x, y, w, h) {
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.stroke();
}
function poly(points, close) {
  ctx.beginPath();
  points.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
  if (close) ctx.closePath();
  ctx.stroke();
}
function bezier(x1,y1,c1x,c1y,c2x,c2y,x2,y2) {
  ctx.beginPath();
  ctx.moveTo(x1,y1);
  ctx.bezierCurveTo(c1x,c1y,c2x,c2y,x2,y2);
  ctx.stroke();
}
function roundRect(x, y, w, h, r, fill, stroke) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

function queueTile(lod, tx, tz, visible = false) {
  const key = tileKey(lod, tx, tz);
  if (state.tiles.has(key) || state.pendingTiles.has(key)) return false;
  const existing = state.tileQueue.get(key);
  if (existing) {
    if (visible && !existing.visible) {
      existing.visible = true;
      existing.priority = tilePriority(lod, tx, tz, true, existing.attempts || 0);
    }
    return false;
  }
  const priority = tilePriority(lod, tx, tz, visible);
  state.tileQueue.set(key, { lod, tx, tz, priority, visible, runId: state.runId, attempts: 0 });
  if (state.tileQueue.size > MAX_TILE_QUEUE) pruneTileQueue();
  scheduleTilePump();
  return true;
}

function tilePriority(lod, tx, tz, visible = false, attempts = 0) {
  const b = LODS[lod].blocks;
  const cx = tx * b + b / 2;
  const cz = tz * b + b / 2;
  let priority = Math.hypot(cx - state.viewX, cz - state.viewZ) + attempts * TILE_RETRY_PENALTY;
  if (visible) priority -= VISIBLE_TILE_PRIORITY_BOOST;
  if (lod > 0) priority -= COARSE_TILE_PRIORITY_BOOST / lod;
  return priority;
}

function refreshTilePriorities() {
  for (const job of state.tileQueue.values()) {
    job.priority = tilePriority(job.lod, job.tx, job.tz, job.visible, job.attempts || 0);
  }
}

function scheduleTilePump() {
  if (tilePumpPending) return;
  tilePumpPending = true;
  queueMicrotask(() => {
    tilePumpPending = false;
    pumpTiles();
  });
}

function pumpTiles() {
  if (!state.loaded) return;
  if (!dimensionCaps().biomes || !state.showBiomes) {
    // Biomes off/unavailable: stop loading chunks and clear the pill rather than
    // leaving queued/pending tiles that keep "Loading chunks" on screen.
    // Cached tiles are kept, so re-enabling biomes redraws instantly.
    cancelAllTileRequests();
    state.tileQueue.clear();
    updateChunkPill();
    return;
  }
  if (state.pendingTiles.size >= MAX_TILE_REQUESTS || !state.tileQueue.size) return;
  refreshTilePriorities();
  const sorted = [...state.tileQueue.values()].sort((a, b) => a.priority - b.priority);
  let i = 0;
  while (state.pendingTiles.size < MAX_TILE_REQUESTS && i < sorted.length) {
    const next = sorted[i++];
    state.tileQueue.delete(tileKey(next.lod, next.tx, next.tz));
    loadTile(next);
  }
}

function pruneTileQueue() {
  refreshTilePriorities();
  const keep = [...state.tileQueue.entries()]
    .sort((a, b) => a[1].priority - b[1].priority)
    .slice(0, MAX_TILE_QUEUE);
  state.tileQueue = new Map(keep);
}

function trimTileQueueToView(range) {
  if (!state.tileQueue.size) return;
  for (const [key, job] of state.tileQueue) {
    if (!tileJobRelevant(job, TILE_QUEUE_VIEW_MARGIN) || job.runId !== state.runId) {
      state.tileQueue.delete(key);
    }
  }
}

function currentTileRangeForLod(lod) {
  return biomeTileRange(lod);
}

function tileJobRelevant(job, margin = 0) {
  return tileJobInRange(job, currentTileRangeForLod(job.lod), margin);
}

function tileJobInRange(job, range, margin = 0) {
  return job.lod === range.lod &&
    job.tx >= range.txMin - margin && job.tx <= range.txMax + margin &&
    job.tz >= range.tzMin - margin && job.tz <= range.tzMax + margin;
}

function cancelStaleTileRequests() {
  if (!state.pendingTiles.size) return;
  for (const [key, pending] of state.pendingTiles) {
    if (pending.runId !== state.runId || !tileJobRelevant(pending, TILE_PENDING_VIEW_MARGIN)) {
      pending.request?.cancel?.();
      state.pendingTiles.delete(key);
    }
  }
  updateChunkPill();
}

function cancelAllTileRequests() {
  if (!state.pendingTiles.size) return;
  for (const pending of state.pendingTiles.values()) {
    pending.request?.cancel?.();
  }
  state.pendingTiles.clear();
}

function dropStaleTileBuilds() {
  if (!tileBuildQueue.length) return;
  for (let i = tileBuildQueue.length - 1; i >= 0; i--) {
    const job = tileBuildQueue[i];
    if (job.runId !== state.runId || !tileJobRelevant(job, TILE_RESULT_KEEP_MARGIN)) {
      tileBuildQueue.splice(i, 1);
      state.pendingTiles.delete(job.key);
    }
  }
}

function withTimeout(promise, ms, message = "Request timed out") {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      promise.cancel?.();
      reject(new Error(message));
    }, ms);
    promise.then(
      value => { clearTimeout(timer); resolve(value); },
      err => { clearTimeout(timer); reject(err); }
    );
  });
}

function requeueTile(job) {
  const key = tileKey(job.lod, job.tx, job.tz);
  if (state.tiles.has(key) || state.pendingTiles.has(key) || state.tileQueue.has(key)) return;
  const attempts = (job.attempts || 0) + 1;
  const priority = tilePriority(job.lod, job.tx, job.tz, job.visible, attempts);
  state.tileQueue.set(key, { lod: job.lod, tx: job.tx, tz: job.tz, priority, visible: job.visible, runId: job.runId, attempts });
  if (state.tileQueue.size > MAX_TILE_QUEUE) pruneTileQueue();
}

async function loadTile(job) {
  const cfg = LODS[job.lod];
  const key = tileKey(job.lod, job.tx, job.tz);
  if (!dimensionCaps().biomes) return;
  const bx = job.tx * cfg.blocks;
  const bz = job.tz * cfg.blocks;
  let queued = false;
  let retry = false;
  let request = null;
  try {
    request = workerRequest("biomeTile", {
        seed: state.seed,
        version: state.version,
        dimension: state.dimension,
        x: bx,
        z: bz,
        w: cfg.samples,
        h: cfg.samples,
        scale: cfg.scale
    });
    state.pendingTiles.set(key, { ...job, key, request });
    updateChunkPill();
    const data = await withTimeout(
      request,
      TILE_REQUEST_TIMEOUT,
      "Tile request timed out"
    );
    if (job.runId !== state.runId || !data.grid) return;
    if (!tileJobRelevant(job, TILE_RESULT_KEEP_MARGIN)) return;
    tileBuildQueue.push({ key, grid: data.grid, bitmap: data.bitmap, lod: job.lod, tx: job.tx, tz: job.tz, runId: job.runId });
    queued = true;
    scheduleTileBuild();
  } catch (err) {
    // A blip shouldn't leave a permanent hole: retry a couple of times,
    // de-prioritised, as long as the tile is still in the current world.
    if (err?.name !== "AbortError" && job.runId === state.runId && (job.attempts || 0) + 1 < MAX_TILE_ATTEMPTS) {
      retry = true;
    } else {
      if (err?.name !== "AbortError") console.warn("Tile failed", err);
    }
  } finally {
    if (!queued) {
      state.pendingTiles.delete(key);
      if (retry) requeueTile(job);
      updateChunkPill();
      requestRender();
    }
  }
}

function scheduleTileBuild() {
  if (tileBuildPending) return;
  tileBuildPending = true;
  requestAnimationFrame(buildQueuedTiles);
}

function buildQueuedTiles() {
  tileBuildPending = false;
  dropStaleTileBuilds();
  let processed = 0;
  let built = 0;
  const deadline = performance.now() + TILE_BUILD_FRAME_BUDGET;
  while (tileBuildQueue.length && processed < TILE_BUILD_BATCH && performance.now() < deadline) {
    const job = tileBuildQueue.shift();
    processed++;
    if (job.runId === state.runId && job.grid) {
      state.tiles.set(job.key, createTile(job.grid, job.lod, job.tx, job.tz, job.bitmap));
      built++;
    }
    state.pendingTiles.delete(job.key);
  }
  // Prune once per batch (not per tile): a full cache sort per built tile was a
  // real per-frame cost while streaming. A brief transient over the cap is fine.
  if (built) pruneTileCache();
  updateChunkPill();
  // Village labels depend on biome tiles; refresh them once tiles settle, but
  // never mid-pan (that would rebuild the marker list during a drag).
  if (built && !mapIsMoving()) invalidateMarkers();
  if (processed) requestRender();
  pumpTiles();
  if (tileBuildQueue.length) scheduleTileBuild();
}

function createTile(grid, lod, tx, tz, bitmap = null) {
  const cfg = LODS[lod];
  const s = cfg.samples;
  if (bitmap) {
    return { canvas: bitmap, grid, lod, samples: s, scale: cfg.scale, blocks: cfg.blocks, last: performance.now() };
  }
  const cnv = document.createElement("canvas");
  cnv.width = s;
  cnv.height = s;
  const c = cnv.getContext("2d", { alpha: false });
  const img = c.createImageData(s, s);
  const data = img.data;
  for (let i = 0; i < grid.length; i++) {
    const lx = i % s;
    const lz = Math.floor(i / s);
    const worldX = tx * cfg.blocks + lx * cfg.scale;
    const worldZ = tz * cfg.blocks + lz * cfg.scale;
    const biomeId = grid[i];
    const color = tintBiome(BIOME_RGB.get(biomeId) || UNKNOWN_BIOME_RGB, worldX >> 4, worldZ >> 4, biomeId);
    const j = i * 4;
    data[j] = (color >> 16) & 255;
    data[j + 1] = (color >> 8) & 255;
    data[j + 2] = color & 255;
    data[j + 3] = 255;
  }
  c.putImageData(img, 0, 0);
  return { canvas: cnv, grid, lod, samples: s, scale: cfg.scale, blocks: cfg.blocks, last: performance.now() };
}

function tintBiome(rgb, x, z, biomeId) {
  // Amidst-style flat biome colors: render each biome as its solid color with no
  // per-pixel noise/shading, so the map looks clean instead of grainy.
  // (x, z, biomeId kept for signature compatibility with callers.)
  return (rgb[0] << 16) | (rgb[1] << 8) | rgb[2];
}

function smoothTerrainNoise(x, z) {
  const center = terrainNoise(x, z) * 4;
  const edges =
    terrainNoise(x - 1, z) +
    terrainNoise(x + 1, z) +
    terrainNoise(x, z - 1) +
    terrainNoise(x, z + 1);
  const corners =
    terrainNoise(x - 1, z - 1) +
    terrainNoise(x + 1, z - 1) +
    terrainNoise(x - 1, z + 1) +
    terrainNoise(x + 1, z + 1);
  return (center + edges * 2 + corners) / 16;
}

function terrainNoise(x, z) {
  let v = Math.imul(x ^ 0x45d9f3b, 0x27d4eb2d) ^ Math.imul(z ^ 0x119de1f3, 0x165667b1);
  v ^= v >>> 15;
  return ((v >>> 0) % 1000) / 1000;
}

function pruneTileCache() {
  if (state.tiles.size <= MAX_TILE_CACHE) return;
  const sorted = [...state.tiles.entries()].sort((a, b) => a[1].last - b[1].last);
  for (let i = 0; i < sorted.length - MAX_TILE_CACHE; i++) state.tiles.delete(sorted[i][0]);
}

function hexToRgb(hex) {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function villageLabelAt(x, z) {
  const biome = biomeAt(x, z);
  if (!biome || biome === "Biome loading" || biome === "Biome unavailable") return STRUCT_META.Village.label;
  const rule = VILLAGE_LABEL_RULES.find(item => item.match(biome));
  return rule ? rule.label : "Plains Village";
}

function markerMetaFor(key, point) {
  const meta = STRUCT_META[key];
  if (key !== "Village") return meta;
  // Resolve the village's biome-specific name once (biomes may not be loaded at
  // first), then cache it on the point so rebuilding the marker list doesn't
  // re-run a biome lookup per village every time.
  if (!point._label || point._label === STRUCT_META.Village.label) {
    point._label = villageLabelAt(point.x, point.z);
  }
  return { ...meta, label: point._label };
}

function buildMarkers() {
  const markers = [];
  if (state.vis.spawn && isFeatureAvailable("spawn") && state.structures.spawn) {
    markers.push({ type:"spawn", ...state.structures.spawn, ...STRUCT_META.spawn });
  }
  if (state.vis.Stronghold && isFeatureAvailable("Stronghold") && Array.isArray(state.structures.strongholds)) {
    for (const sh of state.structures.strongholds) {
      markers.push({ type:"Stronghold", x:sh.x, z:sh.z, ring:sh.ring, ...STRUCT_META.Stronghold });
    }
  }
  for (const key of Object.keys(STRUCT_META)) {
    if (key === "spawn" || key === "Stronghold" || !state.vis[key]) continue;
    if (!isFeatureAvailable(key)) continue;
    const list = state.structures[key];
    if (!Array.isArray(list)) continue;
    for (const point of list) markers.push({ type:key, x:point.x, z:point.z, ...markerMetaFor(key, point) });
  }
  return markers;
}

// The marker set only changes when structures, layer visibility, version or
// dimension change — never per frame. Caching it removes the biggest source of
// pan jank (a full rebuild + per-village biome lookup on every frame).
function visibleMarkers() {
  if (frozenMarkerSnapshot) return frozenMarkerSnapshot;
  if (markerCache) return markerCache;
  if (mapIsMoving() && lastMarkerSnapshot.length) return lastMarkerSnapshot;
  markerCache = buildMarkers();
  lastMarkerSnapshot = markerCache;
  return markerCache;
}

function nearestMarker(mx, my) {
  let best = null;
  let bestDist = 18;
  for (const marker of visibleMarkers()) {
    if (shouldHideDenseMarker(marker)) continue;
    const p = worldToScreen(marker.x, marker.z);
    const dist = Math.hypot(p.x - mx, p.y - my);
    if (dist < bestDist) {
      bestDist = dist;
      best = marker;
    }
  }
  return best;
}

function updateHud() {
  const zoomText = state.zoom.toFixed(state.zoom < 10 ? 1 : 0);
  const key = `${state.cursor.x}|${state.cursor.z}|${zoomText}`;
  if (key === hudCache) return;
  hudCache = key;
  if (els.coordX) els.coordX.textContent = state.cursor.x;
  if (els.coordZ) els.coordZ.textContent = state.cursor.z;
  if (els.zoomLabel) els.zoomLabel.textContent = zoomText;
  if (els.zoomRange && document.activeElement !== els.zoomRange) {
    els.zoomRange.value = String(zoomToSlider(state.zoom));
  }
}

function updateChunkPill() {
  const n = state.pendingTiles.size + state.tileQueue.size;
  const visible = state.loaded && n > 0;
  const text = n === 1 ? "Loading 1 chunk" : `Loading ${n} chunks`;
  const key = `${visible}|${text}`;
  if (key === chunkPillCache) return;
  chunkPillCache = key;
  els.chunkPill.classList.toggle("visible", visible);
  els.chunkLabel.textContent = text;
}

function biomeAt(wx, wz) {
  if (!dimensionCaps().biomes) return state.dimension === "nether" ? "Nether preview" : state.dimension === "end" ? "End preview" : "Biome unavailable";
  for (let lod = 0; lod < LODS.length; lod++) {
    const cfg = LODS[lod];
    const tx = Math.floor(wx / cfg.blocks);
    const tz = Math.floor(wz / cfg.blocks);
    const tile = state.tiles.get(tileKey(lod, tx, tz));
    if (!tile) continue;
    const localX = Math.floor((wx - tx * cfg.blocks) / cfg.scale);
    const localZ = Math.floor((wz - tz * cfg.blocks) / cfg.scale);
    const id = tile.grid[localZ * cfg.samples + localX];
    return BIOME_NAMES[id] || `Biome ${id}`;
  }
  return "Biome loading";
}

function selectLocation(location, screenPoint = null) {
  state.selected = {
    type: location.type || "point",
    label: location.label || "Selected point",
    icon: location.icon || "target",
    asset: location.asset || "",
    color: location.color || "#edf3ee",
    x: Math.round(location.x),
    z: Math.round(location.z),
    ring: location.ring
  };
  updateSelectedPanel();
  updateGoInputs(state.selected);
  if (screenPoint) openLocationPopover(screenPoint.x, screenPoint.y);
  requestRender();
}

function selectedPoint() {
  if (state.selected) return state.selected;
  if (state.structures.spawn) {
    return { type:"spawn", ...state.structures.spawn, ...STRUCT_META.spawn };
  }
  return { type:"point", label:"Map cursor", icon:"target", color:"#edf3ee", ...state.cursor };
}

function updateSelectedPanel() {
  const point = selectedPoint();
  if (!point || !els.selectedLabel) return;
  const chunkX = Math.floor(point.x / 16);
  const chunkZ = Math.floor(point.z / 16);
  const label = point.ring ? `${point.label} ring ${point.ring}` : point.label;
  const biome = state.loaded ? biomeAt(point.x, point.z) : "-";
  const key = `${point.type}|${label}|${point.icon}|${point.asset || ""}|${point.color}|${point.x}|${point.z}|${chunkX}|${chunkZ}|${biome}`;
  if (key === selectedPanelCache) return;
  selectedPanelCache = key;
  els.selectedIcon.style.setProperty("--icon", point.color);
  els.selectedIcon.innerHTML = iconMarkup(point.icon, point.asset);
  els.selectedLabel.textContent = label;
  els.selectedX.textContent = point.x;
  els.selectedZ.textContent = point.z;
  els.selectedChunk.textContent = `${chunkX}, ${chunkZ}`;
  els.selectedBiome.textContent = biome;
  updatePopover();
}

function updateGoInputs(point) {
  if (!point || document.activeElement === els.gotoX || document.activeElement === els.gotoZ) return;
  els.gotoX.value = Math.round(point.x);
  els.gotoZ.value = Math.round(point.z);
}

function openLocationPopover(sx, sy) {
  updatePopover();
  const w = 258;
  const h = 142;
  els.popover.style.left = `${Math.min(Math.max(12, sx + 16), state.width - w - 12)}px`;
  els.popover.style.top = `${Math.min(Math.max(12, sy + 16), state.height - h - 12)}px`;
  els.popover.classList.add("visible");
}

function closeLocationPopover() {
  els.popover.classList.remove("visible");
}

function updatePopover() {
  if (!els.popover || !state.selected) return;
  const point = selectedPoint();
  const chunkX = Math.floor(point.x / 16);
  const chunkZ = Math.floor(point.z / 16);
  const label = point.ring ? `${point.label} ring ${point.ring}` : point.label;
  els.popoverIcon.style.setProperty("--icon", point.color);
  els.popoverIcon.innerHTML = iconMarkup(point.icon, point.asset);
  els.popoverLabel.textContent = label;
  els.popoverCoords.textContent = `${point.x}, ${point.z}`;
  els.popoverChunk.textContent = `${chunkX}, ${chunkZ}`;
  els.popoverBiome.textContent = state.loaded ? biomeAt(point.x, point.z) : "-";
}

function buildSidebar() {
  invalidateMarkers();
  els.layerList.innerHTML = "";
  els.layerList.append(
    makeLayerRow("layers", "Biomes", "#57d68d", null, state.showBiomes, () => {
      state.showBiomes = !state.showBiomes;
      buildSidebar();
      requestRender();
    }),
    makeLayerRow("target", "Grid Lines", "#5cc8f2", null, state.showGrid, () => {
      state.showGrid = !state.showGrid;
      buildSidebar();
      requestRender();
    })
  );

  els.structList.innerHTML = "";
  let total = 0;
  for (const feature of FEATURE_CATALOG) {
    const key = feature.key;
    const meta = feature.supported ? STRUCT_META[key] : feature;
    if (!meta) continue;
    const available = feature.supported && isFeatureAvailable(key);
    const hasData = featureDataLoaded(key);
    const count = hasData ? structureCount(key) : null;
    if (available) total += count;
    els.structList.append(makeLayerRow(meta.icon, meta.label, meta.color, available ? count : null, available ? state.vis[key] : false, () => toggleFeature(key, meta, available), { disabled: !available, asset: meta.asset }));
  }
  els.structTotal.textContent = total;
}

async function toggleFeature(key, meta, available) {
  if (!available) {
    showToast(`${meta.label} is not available for ${state.version} ${state.dimension}`);
    return;
  }
  const next = !state.vis[key];
  state.vis[key] = next;
  buildSidebar();
  requestRender();
  if (!next || !state.loaded || key === "spawn" || key === "Stronghold") return;
  // Enabling a structure type: pull the current view in one bulk request first,
  // then let the region streamer quietly fill the surrounding area.
  state.structFetched = new Set();
  const radius = visibleStructureRadius();
  markRegionsFetched(state.viewX, state.viewZ, radius);
  startVisibleStructureBulk(state.runId, state.viewX, state.viewZ, radius);
  scheduleStructureStream(160, true);
}

function setAllFeatures(active) {
  for (const feature of FEATURE_CATALOG) {
    if (feature.supported && feature.key in state.vis && isFeatureAvailable(feature.key)) state.vis[feature.key] = active;
  }
  buildSidebar();
  requestRender();
  if (active && state.loaded) {
    state.structFetched = new Set();
    const radius = visibleStructureRadius();
    markRegionsFetched(state.viewX, state.viewZ, radius);
    startVisibleStructureBulk(state.runId, state.viewX, state.viewZ, radius);
    scheduleStructureStream(160, true);
  }
}

function structureCount(key) {
  if (key === "spawn") return state.structures.spawn ? 1 : 0;
  if (key === "Stronghold") return Array.isArray(state.structures.strongholds) ? state.structures.strongholds.length : 0;
  return Array.isArray(state.structures[key]) ? state.structures[key].length : 0;
}

function makeLayerRow(iconName, label, color, count, active, onClick, options = {}) {
  const row = document.createElement("button");
  row.className = `layer-row ${active ? "" : "is-off"} ${options.disabled ? "is-disabled" : ""}`;
  row.type = "button";
  row.title = options.disabled ? `${label} is not available in this build yet` : label;
  if (options.disabled) row.setAttribute("aria-disabled", "true");
  row.style.setProperty("--icon", color);
  row.innerHTML = `
    <span class="layer-icon">${iconMarkup(iconName, options.asset)}</span>
    <span class="layer-label">${label}</span>
    ${count == null ? `<span class="count muted">-</span>` : `<span class="count">${count}</span>`}
    <span class="switch ${active ? "on" : ""}"></span>
  `;
  row.addEventListener("click", onClick);
  return row;
}

async function loadWorld(options = {}) {
  const seed = (options.seed || els.seedInput.value).trim();
  const version = options.version || els.version.value;
  const dimension = options.dimension || els.dimension.value || "overworld";
  if (!seed) {
    if (!options.silent) showToast("Enter a seed first");
    return;
  }
  state.runId++;
  const runId = state.runId;
  state.seed = seed;
  state.version = version;
  state.dimension = dimension;
  applyVersionLods(version);
  els.seedInput.value = seed;
  els.version.value = version;
  els.dimension.value = dimension;
  state.loaded = false;
  resetUiCaches();
  cancelWorldWorkerJobs();
  cancelAllTileRequests();
  state.tiles.clear();
  state.tileQueue.clear();
  tileBuildQueue.length = 0;
  state.structures = {};
  resetStructureStream();
  state.selected = null;
  els.empty.classList.add("hidden");
  showLoader("Loading seed", "Preparing fast map preview...");
  try {
    const data = await fetchStructuresAround(0, 0, options.radius || INITIAL_SCAN_RADIUS, []);
    if (runId !== state.runId) return;
    state.structures = data;
    state.structSeen = {};
    state.loaded = true;
    state.viewX = Number.isFinite(options.centerX) ? Math.round(options.centerX) : (data.spawn?.x ?? 0);
    state.viewZ = Number.isFinite(options.centerZ) ? Math.round(options.centerZ) : (data.spawn?.z ?? 0);
    state.zoom = Number.isFinite(options.zoom) ? clamp(options.zoom, MIN_ZOOM, MAX_ZOOM) : DEFAULT_ZOOM;
    state.zoomTarget = state.zoom;
    cancelZoomAnim();
    cancelMomentum();
    if (data.spawn) selectLocation({ type:"spawn", ...data.spawn, ...STRUCT_META.spawn });
    els.activeSeed.textContent = seed;
    els.seedCard.classList.add("visible");
    buildSidebar();
    scheduleUrlUpdate();
    requestRender();
    const center = { x: state.viewX, z: state.viewZ };
    const radius = Math.max(options.radius || INITIAL_SCAN_RADIUS, visibleStructureRadius());
    markRegionsFetched(center.x, center.z, radius);
    startVisibleStructureBulk(runId, center.x, center.z, radius);
    scheduleStructureStream(180, true);
  } catch (err) {
    if (runId !== state.runId) return;
    console.error(err);
    els.empty.classList.remove("hidden");
    showToast("World load failed");
  } finally {
    if (runId === state.runId) hideLoader();
  }
}

async function scanCurrentArea() {
  if (!state.loaded) {
    showToast("Load a seed first");
    return;
  }
  // Re-fetch the regions in view (existing markers are kept; dedup avoids
  // duplicates). Mostly redundant now that structures stream automatically.
  const r = structRegionRange();
  for (let rz = r.rzMin; rz <= r.rzMax; rz++) {
    for (let rx = r.rxMin; rx <= r.rxMax; rx++) {
      state.structFetched.delete(`${rx},${rz}`);
    }
  }
  scheduleUrlUpdate();
  const radius = Math.max(MANUAL_SCAN_RADIUS, visibleStructureRadius());
  markRegionsFetched(state.viewX, state.viewZ, radius);
  startVisibleStructureBulk(state.runId, state.viewX, state.viewZ, radius);
  scheduleStructureStream(180, true);
  showToast("Refreshing this area");
}

async function fetchStructuresAround(cx, cz, radius, types = activeStructureTypes()) {
  const x = Math.round(cx - radius);
  const z = Math.round(cz - radius);
  const size = radius * 2;
  // withTimeout aborts (and cancels) a request that never answers, so the
  // loader hides and the streamer's in-flight slot is always released.
  return withTimeout(workerRequest("structures", {
    seed: state.seed,
    version: state.version,
    dimension: state.dimension,
    x,
    z,
    w: size,
    h: size,
    types: types.join(","),
    core: types.length === 0
  }), STRUCT_REQUEST_TIMEOUT, "Structure request timed out");
}

// ─── Structure streaming ──────────────────────────────────────────────────────
// Reset the streamed-region bookkeeping for a fresh world/layer set.
function resetStructureStream() {
  state.structFetched = new Set();
  state.structSeen = {};
  structRegionQueue = [];
  lastStructBulk = null;
  markerCache = null;
  lastMarkerSnapshot = [];
  frozenMarkerSnapshot = null;
  markerRefreshPending = false;
}

// Mark every region overlapping a square (centre cx,cz; half-size radius) as
// already fetched, so a one-shot bulk load isn't re-requested region by region.
function markRegionsFetched(cx, cz, radius) {
  const rxMin = Math.floor((cx - radius) / STRUCT_REGION);
  const rxMax = Math.floor((cx + radius) / STRUCT_REGION);
  const rzMin = Math.floor((cz - radius) / STRUCT_REGION);
  const rzMax = Math.floor((cz + radius) / STRUCT_REGION);
  for (let rz = rzMin; rz <= rzMax; rz++) {
    for (let rx = rxMin; rx <= rxMax; rx++) state.structFetched.add(`${rx},${rz}`);
  }
}

function unmarkRegionsFetched(cx, cz, radius) {
  const rxMin = Math.floor((cx - radius) / STRUCT_REGION);
  const rxMax = Math.floor((cx + radius) / STRUCT_REGION);
  const rzMin = Math.floor((cz - radius) / STRUCT_REGION);
  const rzMax = Math.floor((cz + radius) / STRUCT_REGION);
  for (let rz = rzMin; rz <= rzMax; rz++) {
    for (let rx = rxMin; rx <= rxMax; rx++) state.structFetched.delete(`${rx},${rz}`);
  }
}

// Merge a fetched region's structures into the running set, de-duplicating so
// the same point fetched from overlapping requests is never added twice.
function mergeStreamedStructures(data) {
  let added = 0;
  if (data.spawn && !state.structures.spawn) state.structures.spawn = data.spawn;
  if (Array.isArray(data.strongholds) && !Array.isArray(state.structures.strongholds)) {
    state.structures.strongholds = data.strongholds;
  }
  for (const [key, value] of Object.entries(data)) {
    if (key === "spawn" || key === "strongholds" || !Array.isArray(value)) continue;
    let arr = state.structures[key];
    if (!arr) arr = state.structures[key] = [];
    let seen = state.structSeen[key];
    if (!seen) {
      seen = state.structSeen[key] = new Set(arr.map(p => `${p.x},${p.z}`));
    }
    for (const p of value) {
      const k = `${p.x},${p.z}`;
      if (seen.has(k)) continue;
      seen.add(k);
      arr.push({ x: p.x, z: p.z });
      added++;
    }
  }
  return added;
}

function structRegionRange() {
  const tl = screenToWorld(0, 0);
  const br = screenToWorld(state.width, state.height);
  return {
    rxMin: Math.floor(tl.x / STRUCT_REGION) - STRUCT_REGION_MARGIN,
    rxMax: Math.floor(br.x / STRUCT_REGION) + STRUCT_REGION_MARGIN,
    rzMin: Math.floor(tl.z / STRUCT_REGION) - STRUCT_REGION_MARGIN,
    rzMax: Math.floor(br.z / STRUCT_REGION) + STRUCT_REGION_MARGIN
  };
}

function visibleStructureRadius() {
  const halfView = Math.max(state.width * state.zoom, state.height * state.zoom) / 2;
  return Math.ceil(clamp(Math.max(STRUCT_BULK_RADIUS, halfView + STRUCT_VIEW_BUFFER), STRUCT_BULK_RADIUS, STRUCT_BULK_MAX_RADIUS));
}

function startVisibleStructureBulk(runId, cx, cz, radius) {
  const types = activeStructureTypes();
  if (!types.length || !dimensionCaps().structures) return;
  const fast = priorityStructureTypes(types);
  const first = fast.length ? fast : types;
  const rest = types.filter(type => !first.includes(type));

  fetchStructureBatch(runId, cx, cz, radius, first, true);
  if (rest.length) {
    setTimeout(() => fetchStructureBatch(runId, cx, cz, radius, rest, false), STRUCT_DEFER_DELAY);
  }
}

function priorityStructureTypes(types) {
  return STRUCT_FAST_TYPES.filter(type => types.includes(type));
}

// Called when the map settles after a pan/zoom. Instead of waiting for the
// debounced, region-by-region streamer, fetch the whole visible area in one
// bulk request right away (fast types first) so locations show up immediately
// on the new chunks. A guard skips refetching when the view barely moved.
let lastStructBulk = null;
function loadVisibleStructuresNow() {
  if (!state.loaded || !dimensionCaps().structures || !activeStructureTypes().length) return;
  const radius = visibleStructureRadius();
  if (lastStructBulk && lastStructBulk.runId === state.runId) {
    const moved = Math.hypot(state.viewX - lastStructBulk.x, state.viewZ - lastStructBulk.z);
    // Still inside the area we just bulk-loaded → just top up the edges quietly.
    if (moved < STRUCT_REGION * 0.5 && lastStructBulk.radius >= radius) {
      scheduleStructureStream(80, true);
      return;
    }
  }
  lastStructBulk = { x: state.viewX, z: state.viewZ, radius, runId: state.runId };
  markRegionsFetched(state.viewX, state.viewZ, radius);
  startVisibleStructureBulk(state.runId, state.viewX, state.viewZ, radius);
  scheduleStructureStream(80, true);
}

function fetchStructureBatch(runId, cx, cz, radius, types, primary) {
  if (runId !== state.runId || !state.loaded || !types.length) return;
  fetchStructuresAround(cx, cz, radius, types)
    .then(data => {
      if (runId !== state.runId || !state.loaded) return;
      const added = mergeStreamedStructures(data);
      if (!added) return;
      pruneFarStructures();
      invalidateMarkers();
      scheduleSidebarRefresh();
      requestRender();
    })
    .catch(err => {
      if (runId !== state.runId || err?.name === "AbortError") return;
      if (primary) unmarkRegionsFetched(cx, cz, radius);
      console.warn(primary ? "Visible structures failed" : "Deferred structures failed", err);
      scheduleStructureStream(primary ? 260 : 520, true);
    });
}

// Cheap: called every frame. Enqueues only regions never fetched, so once an
// area is loaded panning back over it costs nothing.
function streamStructures() {
  if (!state.loaded || !dimensionCaps().structures) return;
  if (!activeStructureTypes().length) return;
  const view = structRegionRange();
  // Bound the streamed area to the radius we keep in memory, so a very wide
  // zoom can't try to fetch the whole world at once. Locations still appear
  // (as clusters) for this central band, then more load as you pan.
  const ccx = Math.round((view.rxMin + view.rxMax) / 2);
  const ccz = Math.round((view.rzMin + view.rzMax) / 2);
  const r = {
    rxMin: Math.max(view.rxMin, ccx - STRUCT_KEEP_RADIUS),
    rxMax: Math.min(view.rxMax, ccx + STRUCT_KEEP_RADIUS),
    rzMin: Math.max(view.rzMin, ccz - STRUCT_KEEP_RADIUS),
    rzMax: Math.min(view.rzMax, ccz + STRUCT_KEEP_RADIUS)
  };

  // Drop queued regions that scrolled far out of view (and let them be
  // re-fetched later) so a fast pan doesn't chase stale regions.
  if (structRegionQueue.length) {
    structRegionQueue = structRegionQueue.filter(job => {
      const keep = job.rx >= r.rxMin - 1 && job.rx <= r.rxMax + 1 &&
                   job.rz >= r.rzMin - 1 && job.rz <= r.rzMax + 1;
      if (!keep) state.structFetched.delete(job.key);
      return keep;
    });
  }

  for (let rz = r.rzMin; rz <= r.rzMax; rz++) {
    for (let rx = r.rxMin; rx <= r.rxMax; rx++) {
      const key = `${rx},${rz}`;
      if (state.structFetched.has(key)) continue;
      state.structFetched.add(key); // optimistic — removed again if the fetch fails
      structRegionQueue.push({ rx, rz, key });
    }
  }
  drainStructureRegions();
}

function drainStructureRegions() {
  if (structRegionInFlight >= MAX_STRUCT_REGION_REQUESTS || !structRegionQueue.length) return;
  // Nearest region to the view centre first.
  const cx = state.viewX, cz = state.viewZ;
  structRegionQueue.sort((a, b) => {
    const da = Math.hypot((a.rx + .5) * STRUCT_REGION - cx, (a.rz + .5) * STRUCT_REGION - cz);
    const db = Math.hypot((b.rx + .5) * STRUCT_REGION - cx, (b.rz + .5) * STRUCT_REGION - cz);
    return da - db;
  });
  while (structRegionInFlight < MAX_STRUCT_REGION_REQUESTS && structRegionQueue.length) {
    const job = structRegionQueue.shift();
    const runId = state.runId;
    structRegionInFlight++;
    fetchStructureRegion(job.rx, job.rz, runId)
      .catch(err => {
        // World changed or request canceled: ignore quietly so stale/aborted
        // requests never surface as real console errors.
        if (runId !== state.runId || err?.name === "AbortError") return;
        state.structFetched.delete(job.key); // allow a later retry
        console.warn("Structure region failed", err);
      })
      .finally(() => {
        // Always release the slot (clamped so a late settle can't go negative),
        // otherwise the streamer would stop fetching further locations.
        structRegionInFlight = Math.max(0, structRegionInFlight - 1);
        drainStructureRegions();
      });
  }
}

// Keep accumulated structures from growing without bound over a long session.
// When over the cap, drop points in regions far from the current view (and
// un-mark those regions so they re-stream if revisited). Nearby markers stay,
// so this never disturbs normal movement.
function pruneFarStructures() {
  let total = 0;
  for (const key of Object.keys(state.structures)) {
    if (key === "spawn") continue;
    const v = state.structures[key];
    if (Array.isArray(v)) total += v.length;
  }
  if (total <= MAX_STREAM_MARKERS) return;

  const r = structRegionRange();
  const cx = (r.rxMin + r.rxMax) / 2;
  const cz = (r.rzMin + r.rzMax) / 2;
  const near = (x, z) =>
    Math.abs(Math.floor(x / STRUCT_REGION) - cx) <= STRUCT_KEEP_RADIUS &&
    Math.abs(Math.floor(z / STRUCT_REGION) - cz) <= STRUCT_KEEP_RADIUS;

  for (const key of Object.keys(state.structures)) {
    if (key === "spawn" || key === "strongholds") continue;
    const arr = state.structures[key];
    if (!Array.isArray(arr)) continue;
    const seen = state.structSeen[key];
    const kept = [];
    for (const p of arr) {
      if (near(p.x, p.z)) kept.push(p);
      else if (seen) seen.delete(`${p.x},${p.z}`);
    }
    state.structures[key] = kept;
  }
  for (const rkey of [...state.structFetched]) {
    const [rx, rz] = rkey.split(",").map(Number);
    if (Math.abs(rx - cx) > STRUCT_KEEP_RADIUS || Math.abs(rz - cz) > STRUCT_KEEP_RADIUS) {
      state.structFetched.delete(rkey);
    }
  }
  invalidateMarkers();
}

async function fetchStructureRegion(rx, rz, runId) {
  const types = activeStructureTypes();
  if (!types.length) return;
  const data = await withTimeout(workerRequest("structures", {
    seed: state.seed,
    version: state.version,
    dimension: state.dimension,
    x: rx * STRUCT_REGION,
    z: rz * STRUCT_REGION,
    w: STRUCT_REGION,
    h: STRUCT_REGION,
    types: types.join(",")
  }), STRUCT_REQUEST_TIMEOUT, "Structure region timed out");
  if (runId !== state.runId) return;
  const added = mergeStreamedStructures(data);
  if (added) {
    pruneFarStructures();
    scheduleSidebarRefresh();
  }
  invalidateMarkers();
  requestRender();
}

// Sidebar shows live counts; refreshing its DOM on every merge would thrash, so
// debounce it.
function scheduleSidebarRefresh() {
  clearTimeout(sidebarRefreshTimer);
  sidebarRefreshTimer = setTimeout(() => {
    if (state.loaded) buildSidebar();
  }, 220);
}

async function randomSeed() {
  const data = await workerRequest("randomSeed");
  els.seedInput.value = data.seed;
  loadWorld({ seed: data.seed, version: els.version.value, dimension: els.dimension.value });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function showLoader(title, text) {
  els.loaderTitle.textContent = title;
  els.loaderText.textContent = text;
  els.loader.classList.add("visible");
}

function hideLoader() {
  els.loader.classList.remove("visible");
}

function showToast(message) {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add("visible");
  toastTimer = setTimeout(() => els.toast.classList.remove("visible"), 1400);
}

async function copyText(text, message = "Copied") {
  try {
    await navigator.clipboard.writeText(String(text));
  } catch {
    const ta = document.createElement("textarea");
    ta.value = String(text);
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  showToast(message);
}

function copyCoords(point, label = "Coordinates copied") {
  copyText(`${point.x}, ${point.z}`, label);
}

function copyTp(point, label = "TP command copied") {
  copyText(`/tp ${point.x} ~ ${point.z}`, label);
}

function buildShareUrl() {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  const seed = state.seed || els.seedInput.value.trim();
  if (seed) url.searchParams.set("seed", seed);
  url.searchParams.set("version", state.version || els.version.value);
  url.searchParams.set("dimension", state.dimension || els.dimension.value || "overworld");
  url.searchParams.set("x", String(Math.round(state.viewX)));
  url.searchParams.set("z", String(Math.round(state.viewZ)));
  url.searchParams.set("zoom", (4 / state.zoom).toFixed(3).replace(/0+$/, "").replace(/\.$/, ""));
  url.searchParams.set("load", "1");
  return url.toString();
}

function scheduleUrlUpdate() {
  clearTimeout(urlTimer);
  urlTimer = setTimeout(() => {
    if (!state.loaded || !state.seed) return;
    window.history.replaceState(null, "", buildShareUrl());
  }, 180);
}

function shareUrl() {
  if (!state.loaded && !els.seedInput.value.trim()) {
    showToast("Load a seed first");
    return;
  }
  copyText(buildShareUrl(), "Share URL copied");
}

function scheduleAutoLoad(delay = 900) {
  clearTimeout(autoLoadTimer);
  const seed = els.seedInput.value.trim();
  if (!seed) return;
  autoLoadTimer = setTimeout(() => {
    const nextSeed = els.seedInput.value.trim();
    if (!nextSeed) return;
    const nextVersion = els.version.value;
    const nextDimension = els.dimension.value || "overworld";
    const sameWorld = state.loaded &&
      state.seed === nextSeed &&
      state.version === nextVersion &&
      state.dimension === nextDimension;
    if (sameWorld) return;
    loadWorld({
      seed: nextSeed,
      version: nextVersion,
      dimension: nextDimension,
      centerX: state.loaded ? state.viewX : undefined,
      centerZ: state.loaded ? state.viewZ : undefined,
      zoom: state.loaded ? state.zoom : undefined,
      silent: true
    });
  }, delay);
}

function toggleBottomMenu() {
  const collapsed = !els.sidebar.classList.contains("is-collapsed");
  els.sidebar.classList.toggle("is-collapsed", collapsed);
  els.menuToggle.setAttribute("aria-expanded", String(!collapsed));
  els.menuToggle.title = collapsed ? "Expand bottom menu" : "Collapse bottom menu";
}

function goToCoordinates() {
  const x = Number(els.gotoX.value);
  const z = Number(els.gotoZ.value);
  if (!Number.isFinite(x) || !Number.isFinite(z)) {
    showToast("Enter valid X and Z");
    return;
  }
  cancelMomentum();
  cancelZoomAnim();
  state.viewX = Math.round(x);
  state.viewZ = Math.round(z);
  if (state.loaded) {
    selectLocation({ label:"Map point", icon:"target", color:"#edf3ee", x, z }, { x: state.width / 2, y: state.height / 2 });
  } else {
    state.cursor = { x: Math.round(x), z: Math.round(z) };
  }
  scheduleUrlUpdate();
  requestRender();
}

function selectLocationAt(event) {
  if (!state.loaded) return;
  const rect = canvas.getBoundingClientRect();
  const sx = event.clientX - rect.left;
  const sy = event.clientY - rect.top;
  const marker = nearestMarker(sx, sy);
  if (marker) {
    selectLocation(marker, { x: sx, y: sy });
    showToast(`${marker.label} selected`);
    return;
  }
  const point = screenToWorld(sx, sy);
  selectLocation({ label:"Map point", icon:"target", color:"#edf3ee", ...point }, { x: sx, y: sy });
}

function handlePointerMove(event) {
  const rect = canvas.getBoundingClientRect();
  const sx = event.clientX - rect.left;
  const sy = event.clientY - rect.top;
  state.cursor = screenToWorld(sx, sy);
  updateHud();

  if (dragStart) {
    if (Math.hypot(event.clientX - dragStart.x, event.clientY - dragStart.y) > 3) pointerMoved = true;
    state.viewX = dragView.x - (event.clientX - dragStart.x) * state.zoom;
    state.viewZ = dragView.z - (event.clientY - dragStart.y) * state.zoom;
    const now = performance.now();
    if (panSample) {
      const dt = now - panSample.t;
      if (dt > 0) {
        const nvx = (state.viewX - panSample.x) / dt;
        const nvz = (state.viewZ - panSample.z) / dt;
        panVel.x = panVel.x * 0.5 + nvx * 0.5;
        panVel.z = panVel.z * 0.5 + nvz * 0.5;
      }
    }
    panSample = { x: state.viewX, z: state.viewZ, t: now };
    lastMoveT = now;
    requestRender();
    return; // While dragging, skip hover detection (nearestMarker + biomeAt + tooltip).
  }

  const marker = nearestMarker(sx, sy);
  if (marker) {
    els.ttName.textContent = marker.ring ? `${marker.label} ring ${marker.ring}` : marker.label;
    els.ttCoords.textContent = `X ${marker.x}  Z ${marker.z}`;
    els.tooltip.style.left = `${Math.min(sx + 14, state.width - 210)}px`;
    els.tooltip.style.top = `${Math.max(12, sy - 8)}px`;
    els.tooltip.classList.add("visible");
  } else if (state.loaded) {
    const biome = biomeAt(state.cursor.x, state.cursor.z);
    els.ttName.textContent = biome;
    els.ttCoords.textContent = `X ${state.cursor.x}  Z ${state.cursor.z}`;
    els.tooltip.style.left = `${Math.min(sx + 14, state.width - 210)}px`;
    els.tooltip.style.top = `${Math.max(12, sy - 8)}px`;
    els.tooltip.classList.add("visible");
  }
}

function bindEvents() {
  window.addEventListener("resize", resizeCanvas);
  canvas.addEventListener("pointerdown", event => {
    if (!state.loaded) return;
    cancelMomentum();
    cancelZoomAnim();
    freezeMarkers();
    dragStart = { x: event.clientX, y: event.clientY };
    dragView = { x: state.viewX, z: state.viewZ };
    pointerMoved = false;
    panSample = { x: state.viewX, z: state.viewZ, t: performance.now() };
    panVel = { x: 0, z: 0 };
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add("dragging");
    els.tooltip.classList.remove("visible");
  });
  canvas.addEventListener("pointerup", event => {
    if (!pointerMoved) selectLocationAt(event);
    if (pointerMoved) {
      scheduleUrlUpdate();
      // Only glide if the pointer was still moving at release.
      if (performance.now() - lastMoveT < 70) startMomentum(panVel.x, panVel.z);
      else {
        unfreezeMarkers();
        loadVisibleStructuresNow();
      }
    } else {
      unfreezeMarkers();
    }
    dragStart = null;
    panSample = null;
    canvas.releasePointerCapture(event.pointerId);
    canvas.classList.remove("dragging");
  });
  canvas.addEventListener("pointerleave", () => {
    if (!dragStart) els.tooltip.classList.remove("visible");
  });
  canvas.addEventListener("pointercancel", () => {
    dragStart = null;
    panSample = null;
    canvas.classList.remove("dragging");
    unfreezeMarkers();
    loadVisibleStructuresNow();
  });
  canvas.addEventListener("pointermove", handlePointerMove);
  canvas.addEventListener("dblclick", () => {
    selectLocation({ label:"Map point", icon:"target", color:"#edf3ee", ...state.cursor });
    copyCoords(state.selected);
    requestRender();
  });
  canvas.addEventListener("wheel", event => {
    if (!state.loaded) return;
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const sx = event.clientX - rect.left;
    const sy = event.clientY - rect.top;
    // Exponential step keeps mouse notches and trackpad swipes feeling continuous.
    const mag = Math.min(Math.abs(event.deltaY), 120);
    const stepBase = event.ctrlKey ? 0.012 : 0.0045;
    const step = Math.exp(stepBase * mag);
    const base = state.zoomTarget || state.zoom;
    const factor = event.deltaY > 0 ? step : 1 / step;
    startZoomTo(base * factor, sx, sy);
  }, { passive: false });

  els.menuToggle.addEventListener("click", toggleBottomMenu);
  els.seedInput.addEventListener("input", () => scheduleAutoLoad());
  els.seedInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      scheduleAutoLoad(0);
    }
  });
  document.getElementById("random-btn").addEventListener("click", randomSeed);
  document.getElementById("zoom-in").addEventListener("click", () => startZoomTo((state.zoomTarget || state.zoom) * .6));
  document.getElementById("zoom-out").addEventListener("click", () => startZoomTo((state.zoomTarget || state.zoom) * 1.66));
  document.getElementById("copy-cursor")?.addEventListener("click", () => copyCoords(state.cursor));
  document.getElementById("copy-selected-coords").addEventListener("click", () => copyCoords(selectedPoint()));
  document.getElementById("copy-selected-tp").addEventListener("click", () => copyTp(selectedPoint()));
  document.getElementById("copy-popover-coords").addEventListener("click", () => copyCoords(selectedPoint()));
  document.getElementById("copy-popover-tp").addEventListener("click", () => copyTp(selectedPoint()));
  document.getElementById("close-popover").addEventListener("click", closeLocationPopover);
  document.getElementById("select-all-features").addEventListener("click", () => setAllFeatures(true));
  document.getElementById("deselect-all-features").addEventListener("click", () => setAllFeatures(false));
  document.getElementById("go-btn").addEventListener("click", goToCoordinates);
  els.gotoX.addEventListener("keydown", event => { if (event.key === "Enter") goToCoordinates(); });
  els.gotoZ.addEventListener("keydown", event => { if (event.key === "Enter") goToCoordinates(); });
  document.getElementById("copy-seed-btn").addEventListener("click", () => {
    const seed = state.seed || els.seedInput.value.trim();
    if (seed) copyText(seed, "Seed copied");
  });
  document.getElementById("copy-active-seed").addEventListener("click", () => state.seed && copyText(state.seed, "Seed copied"));
  document.getElementById("reset-view-btn").addEventListener("click", () => {
    if (!state.structures.spawn) return;
    cancelMomentum();
    state.viewX = state.structures.spawn.x;
    state.viewZ = state.structures.spawn.z;
    setZoomImmediate(DEFAULT_ZOOM);
    selectLocation({ type:"spawn", ...state.structures.spawn, ...STRUCT_META.spawn });
    scheduleUrlUpdate();
    requestRender();
  });
  els.zoomRange.min = "0";
  els.zoomRange.max = "1";
  els.zoomRange.step = "0.001";
  els.zoomRange.addEventListener("input", event => {
    setZoomImmediate(sliderToZoom(Number(event.target.value)));
    scheduleUrlUpdate();
    requestRender();
  });
  els.version.addEventListener("change", () => {
    if (state.loaded) loadWorld({ seed: state.seed, version: els.version.value, dimension: els.dimension.value, centerX: state.viewX, centerZ: state.viewZ, zoom: state.zoom });
    else scheduleAutoLoad(0);
  });
  els.dimension.addEventListener("change", () => {
    if (state.loaded) loadWorld({ seed: state.seed, version: els.version.value, dimension: els.dimension.value, centerX: state.viewX, centerZ: state.viewZ, zoom: state.zoom });
    else scheduleAutoLoad(0);
    buildSidebar();
  });
  els.shareUrlBtn.addEventListener("click", shareUrl);
}

function hydrateFromUrl() {
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
  const params = new URLSearchParams(window.location.search || hash);
  const seed = params.get("seed");
  const platform = params.get("platform");
  const version = params.get("version") || platformToVersion(platform);
  const dimension = parseDimension(params.get("dimension"));
  const centerX = parseNumberParam(params.get("x"));
  const centerZ = parseNumberParam(params.get("z"));
  const zoom = parseChunkbaseZoom(params.get("zoom"));
  if (version && [...els.version.options].some(option => option.value === version)) {
    els.version.value = version;
  }
  if (dimension) {
    els.dimension.value = dimension;
    state.dimension = dimension;
  }
  if (seed) {
    els.seedInput.value = seed;
    loadWorld({
      seed,
      version: els.version.value,
      dimension: els.dimension.value,
      centerX,
      centerZ,
      zoom
    });
  }
}

function parseDimension(value) {
  return value === "overworld" ? "overworld" : "";
}

function platformToVersion(platform) {
  if (!platform) return "";
  const match = String(platform).match(/java_(\d+)_(\d+)/);
  return match ? `${match[1]}.${match[2]}` : "";
}

function parseNumberParam(value) {
  if (value == null || value === "") return NaN;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

function parseChunkbaseZoom(value) {
  const n = parseNumberParam(value);
  if (!Number.isFinite(n) || n <= 0) return NaN;
  return clamp(4 / n, MIN_ZOOM, MAX_ZOOM);
}

async function loadCapabilities() {
  try {
    state.capabilities = await workerRequest("capabilities");
  } catch (err) {
    console.warn("Capabilities unavailable", err);
  }
}

bootIcons();
initWorker();
bindEvents();
resizeCanvas();
loadCapabilities().finally(() => {
  buildSidebar();
  hydrateFromUrl();
});
