const BASE_PATH = (window.SEED_VIEWER_BASE_PATH || "").replace(/\/$/, "");
const API = BASE_PATH;
const TILE_BLOCKS = 256;
const WORKER_URL = `${BASE_PATH}/static/seed-worker.js`;
const CPU_CORES = Math.max(2, navigator.hardwareConcurrency || 4);
const SAMPLE_SCALE = 8;
const TILE_SAMPLES = TILE_BLOCKS / SAMPLE_SCALE;
const MAX_TILE_CACHE = 900;
const MAX_TILE_QUEUE = 220;
const MAX_TILE_REQUESTS = Math.max(3, Math.min(8, CPU_CORES - 1));
const MAX_DRAW_TILES = 240;
const TILE_REQUEST_TIMEOUT = 15000;

const STRUCT_REQUEST_TIMEOUT = 15000;
const MAX_TILE_ATTEMPTS = 3;
const TILE_RETRY_PENALTY = 4000;
const PREFETCH_MARGIN = 0;
const MAX_TILE_ENQUEUE_PER_RENDER = 24;
const MAX_TILE_QUEUE_WHILE_LOADING = 80;
const TILE_VIEW_MARGIN = 0;
const TILE_QUEUE_VIEW_MARGIN = 0;
const TILE_RESULT_KEEP_MARGIN = 0;

const MARKER_LITE_LIMIT = 200;
const MARKER_LABEL_LIMIT = 50;
const MARKER_CLUSTER_LIMIT = 120;

const MARKER_MAX_ZOOM = 5;
const DENSE_MARKER_MAX_ZOOM = 2.2;
const DENSE_MARKER_TYPES = new Set([
  "Mineshaft", "Ruined_Portal", "Treasure", "Shipwreck", "Trail_Ruins",
  "Dungeon", "Cave", "Ravine", "Lava_Pool", "Apple", "Desert_Well"
]);

const STRUCT_REGION = 3072;            
const STRUCT_REGION_MARGIN = 0;        
const MAX_STRUCT_REGION_REQUESTS = 2;  
const STRUCT_BULK_RADIUS = 2048;       
const STRUCT_BULK_MAX_RADIUS = 3072;   
const STRUCT_VIEW_BUFFER = 768;        
const MAX_STREAM_MARKERS = 3500;       
const STRUCT_KEEP_RADIUS = 2;          
const STRUCT_DEFER_DELAY = 140;        
const STRUCT_FAST_TYPES = [
  "Village", "Ancient_City", "Mansion", "Monument", "Outpost",
  "Desert_Temple", "Jungle_Temple", "Witch_Hut", "Igloo"
];

const WORKER_POOL_SIZE = Math.max(2, Math.min(6, CPU_CORES - 1));
const VISIBLE_TILE_PRIORITY_BOOST = 1_000_000;
const COARSE_TILE_PRIORITY_BOOST = 500_000;
const TILE_BUILD_BATCH = 10;
const TILE_BUILD_FRAME_BUDGET = 6;
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
const MAX_ZOOM = 8;   
const DEFAULT_ZOOM = 2;
const ZOOM_EASE = 0.25;
const PAN_FRICTION = 0.9;
const INITIAL_SCAN_RADIUS = 2048;
const MANUAL_SCAN_RADIUS = 3072;
const MAP_BG = "#17158b";
const EMPTY_TILE_COLORS = ["#17158b", "#17158b"];
const UNKNOWN_BIOME_RGB = [38, 45, 41];
