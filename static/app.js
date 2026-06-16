const API = "";
const TILE_BLOCKS = 256;
const WORKER_URL = "/static/seed-worker.js";
const SAMPLE_SCALE = 8;
const TILE_SAMPLES = TILE_BLOCKS / SAMPLE_SCALE;
const MAX_TILE_CACHE = 520;
const MAX_TILE_QUEUE = 150;
const MAX_TILE_REQUESTS = 4;
const MAX_DRAW_TILES = 420;
const MIN_ZOOM = 0.75;
const MAX_ZOOM = 3.2;
const DEFAULT_ZOOM = 3.2;
const INITIAL_SCAN_RADIUS = 6144;

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

const STRUCT_META = {
  spawn: { label:"Spawn Point", icon:"home", color:"#edf3ee" },
  Stronghold: { label:"Stronghold", icon:"diamond", color:"#b99cff" },
  Village: { label:"Village", icon:"village", color:"#f2b84b" },
  Monument: { label:"Monument", icon:"wave", color:"#5cc8f2" },
  Mansion: { label:"Mansion", icon:"tower", color:"#f06a65" },
  Outpost: { label:"Outpost", icon:"axe", color:"#fb9657" },
  Ancient_City: { label:"Ancient City", icon:"ruin", color:"#6aa9ff" },
  Trial_Chambers: { label:"Trial Chamber", icon:"shield", color:"#57d68d" },
  Fortress: { label:"Fortress", icon:"flame", color:"#ef5c55" },
  Bastion: { label:"Bastion", icon:"key", color:"#d24b42" },
  Desert_Temple: { label:"Desert Temple", icon:"temple", color:"#e8ca68" },
  Jungle_Temple: { label:"Jungle Temple", icon:"temple", color:"#71b85e" },
  Witch_Hut: { label:"Witch Hut", icon:"hut", color:"#8ac177" },
  Igloo: { label:"Igloo", icon:"snow", color:"#dce8f4" },
  Ocean_Ruins: { label:"Ocean Ruins", icon:"wave", color:"#4fc8df" },
  Shipwreck: { label:"Shipwreck", icon:"ship", color:"#57c7d9" },
  Ruined_Portal: { label:"Ruined Portal", icon:"portal", color:"#b56cff" },
  Ruined_Portal_Nether: { label:"Nether Portal", icon:"portal", color:"#c46cff" },
  Treasure: { label:"Treasure", icon:"chest", color:"#ffd45c" },
  Mineshaft: { label:"Mineshaft", icon:"mine", color:"#c69a5b" },
  Desert_Well: { label:"Desert Well", icon:"temple", color:"#e4c26e" },
  Geode: { label:"Geode", icon:"geode", color:"#bb9cff" },
  Trail_Ruins: { label:"Trail Ruins", icon:"ruin", color:"#c99662" },
  End_City: { label:"End City", icon:"tower", color:"#d9c8ff" },
  End_Gateway: { label:"End Gateway", icon:"portal", color:"#bfb3ff" },
  End_Island: { label:"End Island", icon:"diamond", color:"#efe5b4" }
};

const FEATURE_CATALOG = [
  { key:"spawn", supported:true },
  { key:"Slime_Chunk", label:"Slime Chunk", icon:"slime", color:"#78dc67" },
  { key:"Village", supported:true },
  { key:"Ancient_City", supported:true },
  { key:"Dungeon", label:"Dungeon", icon:"ruin", color:"#9f8f7a" },
  { key:"Stronghold", supported:true },
  { key:"Mansion", supported:true },
  { key:"Monument", supported:true },
  { key:"Outpost", supported:true },
  { key:"Mineshaft", supported:true },
  { key:"Ruined_Portal", supported:true },
  { key:"Ruined_Portal_Nether", supported:true },
  { key:"Jungle_Temple", supported:true },
  { key:"Desert_Temple", supported:true },
  { key:"Witch_Hut", supported:true },
  { key:"Treasure", supported:true },
  { key:"Shipwreck", supported:true },
  { key:"Igloo", supported:true },
  { key:"Ocean_Ruins", supported:true },
  { key:"Fossil", label:"Fossil", icon:"fossil", color:"#d4c0a4" },
  { key:"Cave", label:"Cave", icon:"cave", color:"#9aa2b7" },
  { key:"Ravine", label:"Ravine", icon:"cave", color:"#bd8c64" },
  { key:"Lava_Pool", label:"Lava Pool", icon:"lava", color:"#ff7047" },
  { key:"Geode", supported:true },
  { key:"Apple", label:"Apple", icon:"apple", color:"#ff7373" },
  { key:"Ore_Veins", label:"Ore Veins", icon:"mine", color:"#9fb6c8" },
  { key:"Desert_Well", supported:true },
  { key:"Trail_Ruins", supported:true },
  { key:"Trial_Chambers", supported:true },
  { key:"Fortress", supported:true },
  { key:"Bastion", supported:true },
  { key:"End_City", supported:true },
  { key:"End_Gateway", supported:true },
  { key:"End_Island", supported:true }
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
  width: 1,
  height: 1,
  dpr: 1,
  tiles: new Map(),
  tileQueue: new Map(),
  pendingTiles: new Set(),
  structures: {},
  showBiomes: true,
  showGrid: true,
  showAxes: true,
  cursor: { x: 0, z: 0 },
  selected: null,
  capabilities: null,
  vis: Object.fromEntries(Object.keys(STRUCT_META).map(k => [k, true]))
};

let raf = 0;
let dragStart = null;
let dragView = null;
let pointerMoved = false;
let toastTimer = 0;
let worker = null;
let workerSeq = 0;
const workerJobs = new Map();
let urlTimer = 0;
let autoLoadTimer = 0;
let tileBuildPending = false;
const tileBuildQueue = [];

function initWorker() {
  if (!("Worker" in window)) return;
  worker = new Worker(WORKER_URL);
  worker.addEventListener("message", event => {
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
  worker.addEventListener("error", event => {
    for (const job of workerJobs.values()) job.reject(new Error(event.message || "Worker failed"));
    workerJobs.clear();
    worker = null;
  });
}

function workerRequest(type, payload = {}) {
  if (!worker) return directRequest(type, payload);
  const id = ++workerSeq;
  return new Promise((resolve, reject) => {
    workerJobs.set(id, { resolve, reject });
    worker.postMessage({ id, type, payload });
  });
}

async function directRequest(type, payload = {}) {
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
    url = `${API}/api/all_structures?${params}`;
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
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok || data.error) throw new Error(data.error || "Request failed");
  return data;
}

function setIcon(id, name, label) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = ICONS[name] + (label ? `<span>${label}</span>` : "");
}

function bootIcons() {
  document.getElementById("brand-icon").innerHTML = ICONS.map;
  document.getElementById("empty-icon").innerHTML = ICONS.map;
  setIcon("random-btn", "shuffle", "Random");
  setIcon("scan-btn", "refresh", "Scan area");
  setIcon("copy-seed-btn", "copy", "Copy seed");
  setIcon("copy-active-seed", "copy");
  setIcon("copy-cursor", "copy");
  setIcon("zoom-in", "plus");
  setIcon("zoom-out", "minus");
  setIcon("copy-selected-coords", "copy", "Copy");
  setIcon("copy-selected-tp", "target", "/tp");
  setIcon("copy-popover-coords", "copy", "Copy");
  setIcon("copy-popover-tp", "target", "/tp");
  setIcon("reset-view-btn", "target", "Reset view");
  setIcon("scan-current-btn", "refresh", "Scan area");
  setIcon("go-btn", "target", "Go");
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

function tileKey(tx, tz) {
  return `${tx},${tz}`;
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

function requestRender() {
  if (raf) return;
  raf = requestAnimationFrame(render);
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

function render() {
  raf = 0;
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#080a09";
  ctx.fillRect(0, 0, state.width, state.height);
  if (!state.loaded) return;

  const range = visibleTileRange();
  const canStreamBiomes = dimensionCaps().biomes;
  const detailedBiomes = canStreamBiomes && state.showBiomes && range.count <= MAX_DRAW_TILES && range.tilePx >= 10;
  els.distanceNote.classList.toggle("visible", state.showBiomes && !detailedBiomes);
  els.distanceNote.querySelector("span").textContent = canStreamBiomes
    ? "Zoom in to stream detailed biomes"
    : "Biome streaming for this dimension needs a rebuilt native library";
  trimTileQueueToView(range);
  if (detailedBiomes) {
    drawBiomes(range);
  } else {
    drawDistantMap();
  }
  if (state.showGrid && range.tilePx >= 12) drawGrid(range);
  if (state.showAxes) drawAxes();
  drawSelection();
  drawStructures();
  updateHud();
  updateSelectedPanel();
  updateChunkPill();
  pumpTiles();
}

function drawBiomes(range) {
  const tilePx = TILE_BLOCKS / state.zoom;
  for (let tz = range.tzMin; tz <= range.tzMax; tz++) {
    for (let tx = range.txMin; tx <= range.txMax; tx++) {
      const key = tileKey(tx, tz);
      const pos = worldToScreen(tx * TILE_BLOCKS, tz * TILE_BLOCKS);
      const tile = state.tiles.get(key);
      if (state.showBiomes && tile) {
        tile.last = performance.now();
        ctx.drawImage(tile.canvas, pos.x, pos.y, tilePx + 1, tilePx + 1);
      } else {
        ctx.fillStyle = ((tx + tz) & 1) ? "#101411" : "#0d110f";
        ctx.fillRect(pos.x, pos.y, tilePx + 1, tilePx + 1);
      }
      if (state.showBiomes && !tile) queueTile(tx, tz);
    }
  }
}

function drawDistantMap() {
  ctx.save();
  const step = Math.max(28, Math.min(88, 520 / state.zoom));
  ctx.fillStyle = state.dimension === "nether" ? "#160808" : state.dimension === "end" ? "#0d0a16" : "#08100d";
  ctx.fillRect(0, 0, state.width, state.height);
  for (let y = -step; y < state.height + step; y += step) {
    for (let x = -step; x < state.width + step; x += step) {
      const world = screenToWorld(x, y);
      const n = terrainNoise(Math.floor(world.x / 64), Math.floor(world.z / 64));
      const water = n < .28;
      const ridge = n > .78;
      if (state.dimension === "nether") {
        ctx.fillStyle = n < .25 ? "rgba(105,31,28,.35)" : ridge ? "rgba(230,91,48,.24)" : "rgba(88,24,22,.22)";
      } else if (state.dimension === "end") {
        ctx.fillStyle = n < .2 ? "rgba(52,44,78,.22)" : ridge ? "rgba(224,213,156,.2)" : "rgba(132,115,158,.16)";
      } else {
        ctx.fillStyle = water ? "rgba(45,122,151,.24)" : ridge ? "rgba(184,153,92,.18)" : "rgba(72,139,78,.16)";
      }
      ctx.fillRect(x, y, step + 1, step + 1);
    }
  }
  ctx.strokeStyle = "rgba(255,255,255,.035)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= state.width; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, state.height);
    ctx.stroke();
  }
  for (let y = 0; y <= state.height; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(state.width, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawGrid(range) {
  const tilePx = TILE_BLOCKS / state.zoom;
  if (tilePx < 18) return;
  ctx.lineWidth = 1;
  ctx.strokeStyle = tilePx > 80 ? "rgba(5,12,24,.28)" : "rgba(5,12,24,.18)";
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
    drawGridTag(String(wx), x, 18);
    drawGridTag(String(wx), x, state.height - 18);
  }
  ctx.textAlign = "center";
  for (let tz = range.tzMin; tz <= range.tzMax + 1; tz++) {
    const wz = tz * TILE_BLOCKS;
    const y = worldToScreen(0, wz).y;
    if (y < -30 || y > state.height + 30) continue;
    drawGridTag(String(wz), 30, y);
    drawGridTag(String(wz), state.width - 30, y);
  }
  ctx.restore();
}

function drawGridTag(text, x, y) {
  const w = Math.max(34, ctx.measureText(text).width + 10);
  ctx.fillStyle = "rgba(8,10,14,.78)";
  roundRect(x - w / 2, y - 11, w, 22, 5, true, false);
  ctx.fillStyle = "rgba(241,245,248,.88)";
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
  if (state.zoom >= 18) {
    drawMarkerClusters(all);
    return;
  }
  for (const marker of all) drawMarker(marker);
}

function drawMarkerClusters(markers) {
  const cells = new Map();
  const cellSize = state.zoom >= 44 ? 56 : 44;
  for (const marker of markers) {
    const p = worldToScreen(marker.x, marker.z);
    if (p.x < -70 || p.y < -70 || p.x > state.width + 70 || p.y > state.height + 70) continue;
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
      drawMarker(group.marker);
    } else {
      drawClusterBadge(group);
    }
  }
}

function drawClusterBadge(group) {
  const r = group.count > 99 ? 16 : 14;
  ctx.save();
  ctx.translate(group.x, group.y);
  ctx.shadowColor = "rgba(0,0,0,.52)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;
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

function drawMarker(marker) {
  const p = worldToScreen(marker.x, marker.z);
  if (p.x < -70 || p.y < -70 || p.x > state.width + 70 || p.y > state.height + 70) return;
  const color = marker.color;
  const scale = state.zoom <= 2 ? 1.08 : state.zoom <= 6 ? .96 : .82;
  const size = 27 * scale;
  const half = size / 2;
  const selected = isSelectedMarker(marker);
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
  drawMarkerGlyph(marker.icon, "#07100d", size);
  ctx.restore();
  if (selected || marker.type === "spawn" || state.zoom <= 2.5) drawMarkerLabel(marker, p, color);
}

function isSelectedMarker(marker) {
  return !!state.selected &&
    Math.round(marker.x) === state.selected.x &&
    Math.round(marker.z) === state.selected.z &&
    marker.type === state.selected.type;
}

function drawMarkerLabel(marker, p, color) {
  const label = marker.ring ? `${marker.label} ${marker.ring}` : marker.label;
  ctx.save();
  ctx.font = "600 12px Inter, system-ui, sans-serif";
  ctx.textBaseline = "middle";
  const w = ctx.measureText(label).width + 14;
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

function queueTile(tx, tz) {
  const key = tileKey(tx, tz);
  if (state.tiles.has(key) || state.pendingTiles.has(key) || state.tileQueue.has(key)) return;
  const cx = tx * TILE_BLOCKS + TILE_BLOCKS / 2;
  const cz = tz * TILE_BLOCKS + TILE_BLOCKS / 2;
  const priority = Math.hypot(cx - state.viewX, cz - state.viewZ);
  state.tileQueue.set(key, { tx, tz, priority, runId: state.runId });
  if (state.tileQueue.size > MAX_TILE_QUEUE) pruneTileQueue();
}

function pumpTiles() {
  if (!state.loaded) return;
  if (!dimensionCaps().biomes) {
    state.tileQueue.clear();
    updateChunkPill();
    return;
  }
  while (state.pendingTiles.size < MAX_TILE_REQUESTS && state.tileQueue.size) {
    const next = [...state.tileQueue.values()].sort((a, b) => a.priority - b.priority)[0];
    state.tileQueue.delete(tileKey(next.tx, next.tz));
    loadTile(next);
  }
}

function pruneTileQueue() {
  const keep = [...state.tileQueue.entries()]
    .sort((a, b) => a[1].priority - b[1].priority)
    .slice(0, MAX_TILE_QUEUE);
  state.tileQueue = new Map(keep);
}

function trimTileQueueToView(range) {
  if (!state.tileQueue.size) return;
  const margin = 3;
  for (const [key, job] of state.tileQueue) {
    const offscreen = job.tx < range.txMin - margin || job.tx > range.txMax + margin ||
      job.tz < range.tzMin - margin || job.tz > range.tzMax + margin ||
      job.runId !== state.runId;
    if (offscreen) state.tileQueue.delete(key);
  }
}

async function loadTile(job) {
  const key = tileKey(job.tx, job.tz);
  if (!dimensionCaps().biomes) return;
  state.pendingTiles.add(key);
  updateChunkPill();
  const bx = job.tx * TILE_BLOCKS;
  const bz = job.tz * TILE_BLOCKS;
  let queued = false;
  try {
    const data = await workerRequest("biomeTile", {
      seed: state.seed,
      version: state.version,
      dimension: state.dimension,
      x: bx,
      z: bz,
      w: TILE_SAMPLES,
      h: TILE_SAMPLES,
      scale: SAMPLE_SCALE
    });
    if (job.runId !== state.runId || !data.grid) return;
    tileBuildQueue.push({ key, grid: data.grid, tx: job.tx, tz: job.tz, runId: job.runId });
    queued = true;
    scheduleTileBuild();
  } catch (err) {
    console.warn("Tile failed", err);
  } finally {
    if (!queued) {
      state.pendingTiles.delete(key);
      updateChunkPill();
      requestRender();
    }
  }
}

function scheduleTileBuild() {
  if (tileBuildPending) return;
  tileBuildPending = true;
  const run = deadline => buildQueuedTiles(deadline);
  if ("requestIdleCallback" in window) {
    requestIdleCallback(run, { timeout: 80 });
  } else {
    setTimeout(() => run({ timeRemaining: () => 8 }), 0);
  }
}

function buildQueuedTiles(deadline) {
  tileBuildPending = false;
  let built = 0;
  while (tileBuildQueue.length && (built < 2 || deadline.timeRemaining() > 5)) {
    const job = tileBuildQueue.shift();
    if (job.runId === state.runId && job.grid) {
      state.tiles.set(job.key, createTile(job.grid, job.tx, job.tz));
      pruneTileCache();
      built++;
    }
    state.pendingTiles.delete(job.key);
  }
  updateChunkPill();
  if (built) requestRender();
  if (tileBuildQueue.length) scheduleTileBuild();
}

function createTile(grid, tx, tz) {
  const cnv = document.createElement("canvas");
  cnv.width = TILE_SAMPLES;
  cnv.height = TILE_SAMPLES;
  const c = cnv.getContext("2d", { alpha: false });
  const img = c.createImageData(TILE_SAMPLES, TILE_SAMPLES);
  for (let i = 0; i < grid.length; i++) {
    const lx = i % TILE_SAMPLES;
    const lz = Math.floor(i / TILE_SAMPLES);
    const rgb = tintBiome(hexToRgb(BIOME_COLORS[grid[i]] || "#252a27"), tx * TILE_SAMPLES + lx, tz * TILE_SAMPLES + lz, grid[i]);
    const j = i * 4;
    img.data[j] = rgb[0];
    img.data[j + 1] = rgb[1];
    img.data[j + 2] = rgb[2];
    img.data[j + 3] = 255;
  }
  c.putImageData(img, 0, 0);
  return { canvas: cnv, grid, last: performance.now() };
}

function tintBiome(rgb, x, z, biomeId) {
  const n = terrainNoise(x, z);
  const water = biomeId === 0 || biomeId === 7 || (biomeId >= 44 && biomeId <= 50);
  const snowy = biomeId === 10 || biomeId === 11 || biomeId === 12 || biomeId === 179 || biomeId === 180 || biomeId === 181;
  const strength = water ? 12 : snowy ? 6 : 18;
  const shade = Math.round((n - .5) * strength);
  return [
    clamp(rgb[0] + shade, 0, 255),
    clamp(rgb[1] + shade, 0, 255),
    clamp(rgb[2] + shade, 0, 255)
  ];
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

function visibleMarkers() {
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
    for (const point of list) markers.push({ type:key, x:point.x, z:point.z, ...STRUCT_META[key] });
  }
  return markers;
}

function nearestMarker(mx, my) {
  let best = null;
  let bestDist = 18;
  for (const marker of visibleMarkers()) {
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
  els.coordX.textContent = state.cursor.x;
  els.coordZ.textContent = state.cursor.z;
  els.zoomLabel.textContent = state.zoom.toFixed(state.zoom < 10 ? 1 : 0);
  if (els.zoomRange && document.activeElement !== els.zoomRange) {
    els.zoomRange.value = String(state.zoom);
  }
}

function updateChunkPill() {
  const n = state.pendingTiles.size + state.tileQueue.size;
  els.chunkPill.classList.toggle("visible", state.loaded && n > 0);
  els.chunkLabel.textContent = n === 1 ? "Loading 1 chunk" : `Loading ${n} chunks`;
}

function biomeAt(wx, wz) {
  if (!dimensionCaps().biomes) return state.dimension === "nether" ? "Nether preview" : state.dimension === "end" ? "End preview" : "Biome unavailable";
  const tx = Math.floor(wx / TILE_BLOCKS);
  const tz = Math.floor(wz / TILE_BLOCKS);
  const tile = state.tiles.get(tileKey(tx, tz));
  if (!tile) return "Biome loading";
  const localX = Math.floor((wx - tx * TILE_BLOCKS) / SAMPLE_SCALE);
  const localZ = Math.floor((wz - tz * TILE_BLOCKS) / SAMPLE_SCALE);
  const id = tile.grid[localZ * TILE_SAMPLES + localX];
  return BIOME_NAMES[id] || `Biome ${id}`;
}

function selectLocation(location, screenPoint = null) {
  state.selected = {
    type: location.type || "point",
    label: location.label || "Selected point",
    icon: location.icon || "target",
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
  els.selectedIcon.style.setProperty("--icon", point.color);
  els.selectedIcon.innerHTML = ICONS[point.icon] || ICONS.target;
  els.selectedLabel.textContent = label;
  els.selectedX.textContent = point.x;
  els.selectedZ.textContent = point.z;
  els.selectedChunk.textContent = `${chunkX}, ${chunkZ}`;
  els.selectedBiome.textContent = state.loaded ? biomeAt(point.x, point.z) : "-";
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
  els.popoverIcon.innerHTML = ICONS[point.icon] || ICONS.target;
  els.popoverLabel.textContent = label;
  els.popoverCoords.textContent = `${point.x}, ${point.z}`;
  els.popoverChunk.textContent = `${chunkX}, ${chunkZ}`;
  els.popoverBiome.textContent = state.loaded ? biomeAt(point.x, point.z) : "-";
}

function buildSidebar() {
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
    }),
    makeLayerRow("plus", "World Axes", "#f2b84b", null, state.showAxes, () => {
      state.showAxes = !state.showAxes;
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
    const count = structureCount(key);
    if (available) total += count;
    els.structList.append(makeLayerRow(meta.icon, meta.label, meta.color, available ? count : null, available ? state.vis[key] : false, () => {
      if (!available) {
        showToast(`${meta.label} is not available for ${state.version} ${state.dimension}`);
        return;
      }
      state.vis[key] = !state.vis[key];
      buildSidebar();
      requestRender();
    }, { disabled: !available }));
  }
  els.structTotal.textContent = total;
}

function setAllFeatures(active) {
  for (const feature of FEATURE_CATALOG) {
    if (feature.supported && feature.key in state.vis && isFeatureAvailable(feature.key)) state.vis[feature.key] = active;
  }
  buildSidebar();
  requestRender();
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
    <span class="layer-icon">${ICONS[iconName] || ICONS.target}</span>
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
  els.seedInput.value = seed;
  els.version.value = version;
  els.dimension.value = dimension;
  state.loaded = false;
  state.tiles.clear();
  state.tileQueue.clear();
  state.pendingTiles.clear();
  tileBuildQueue.length = 0;
  state.structures = {};
  state.selected = null;
  els.empty.classList.add("hidden");
  showLoader("Loading world", `Finding ${dimension} structures...`);
  try {
    const data = await fetchStructuresAround(0, 0, options.radius || INITIAL_SCAN_RADIUS);
    if (runId !== state.runId) return;
    state.structures = data;
    state.loaded = true;
    state.viewX = Number.isFinite(options.centerX) ? Math.round(options.centerX) : (data.spawn?.x ?? 0);
    state.viewZ = Number.isFinite(options.centerZ) ? Math.round(options.centerZ) : (data.spawn?.z ?? 0);
    state.zoom = Number.isFinite(options.zoom) ? clamp(options.zoom, MIN_ZOOM, MAX_ZOOM) : DEFAULT_ZOOM;
    if (data.spawn) selectLocation({ type:"spawn", ...data.spawn, ...STRUCT_META.spawn });
    els.activeSeed.textContent = seed;
    els.seedCard.classList.add("visible");
    buildSidebar();
    scheduleUrlUpdate();
    requestRender();
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
  showLoader("Scanning area", `Refreshing ${state.dimension} structures near map center...`);
  try {
    const data = await fetchStructuresAround(state.viewX, state.viewZ, INITIAL_SCAN_RADIUS);
    state.structures = data;
    buildSidebar();
    scheduleUrlUpdate();
    requestRender();
  } catch (err) {
    console.error(err);
    showToast("Area scan failed");
  } finally {
    hideLoader();
  }
}

async function fetchStructuresAround(cx, cz, radius) {
  const x = Math.round(cx - radius);
  const z = Math.round(cz - radius);
  const size = radius * 2;
  return workerRequest("structures", {
    seed: state.seed,
    version: state.version,
    dimension: state.dimension,
    x,
    z,
    w: size,
    h: size
  });
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

function scheduleAutoLoad(delay = 650) {
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
    requestRender();
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
    dragStart = { x: event.clientX, y: event.clientY };
    dragView = { x: state.viewX, z: state.viewZ };
    pointerMoved = false;
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add("dragging");
  });
  canvas.addEventListener("pointerup", event => {
    if (!pointerMoved) selectLocationAt(event);
    if (pointerMoved) scheduleUrlUpdate();
    dragStart = null;
    canvas.releasePointerCapture(event.pointerId);
    canvas.classList.remove("dragging");
  });
  canvas.addEventListener("pointerleave", () => {
    if (!dragStart) els.tooltip.classList.remove("visible");
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
    const before = screenToWorld(sx, sy);
    const factor = event.deltaY > 0 ? 1.22 : 0.82;
    state.zoom = clamp(state.zoom * factor, MIN_ZOOM, MAX_ZOOM);
    state.viewX = before.x - (sx - state.width / 2) * state.zoom;
    state.viewZ = before.z - (sy - state.height / 2) * state.zoom;
    scheduleUrlUpdate();
    requestRender();
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
  document.getElementById("scan-btn").addEventListener("click", scanCurrentArea);
  document.getElementById("scan-current-btn").addEventListener("click", scanCurrentArea);
  document.getElementById("zoom-in").addEventListener("click", () => { state.zoom = clamp(state.zoom * .72, MIN_ZOOM, MAX_ZOOM); scheduleUrlUpdate(); requestRender(); });
  document.getElementById("zoom-out").addEventListener("click", () => { state.zoom = clamp(state.zoom * 1.38, MIN_ZOOM, MAX_ZOOM); scheduleUrlUpdate(); requestRender(); });
  document.getElementById("copy-cursor").addEventListener("click", () => copyCoords(state.cursor));
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
    state.viewX = state.structures.spawn.x;
    state.viewZ = state.structures.spawn.z;
    state.zoom = DEFAULT_ZOOM;
    selectLocation({ type:"spawn", ...state.structures.spawn, ...STRUCT_META.spawn });
    scheduleUrlUpdate();
    requestRender();
  });
  els.zoomRange.addEventListener("input", event => {
    state.zoom = clamp(Number(event.target.value) || 4, MIN_ZOOM, MAX_ZOOM);
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
  return ["overworld", "nether", "end"].includes(value) ? value : "";
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
