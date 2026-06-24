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
  pendingTileBulk: new Map(),
  tileLatencyMs: 0,
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
let workerLoads = [];
let workerCursor = 0;
let workerSeq = 0;
const workerJobs = new Map();
let urlTimer = 0;
let autoLoadTimer = 0;
let tileBuildPending = false;
let tilePumpPending = false;
const tileBuildQueue = [];
let tileQueueSeq = 0;
const tilePreviewCache = new Map();
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
