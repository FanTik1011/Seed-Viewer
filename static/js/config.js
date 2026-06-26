const BASE_PATH = (window.SEED_VIEWER_BASE_PATH || "").replace(/\/$/, "");
const API = BASE_PATH;
const TILE_BLOCKS = 256;
const WORKER_URL = `${BASE_PATH}/static/seed-worker.js`;
const SAMPLE_SCALE = 8;
const TILE_SAMPLES = TILE_BLOCKS / SAMPLE_SCALE;
const IS_LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[?::1\]?)$/.test(window.location.hostname);
const MAX_TILE_CACHE = 650;
const MAX_TILE_QUEUE = 120;
const MAX_TILE_REQUESTS = IS_LOCAL_HOST
  ? Math.max(2, Math.min(4, Math.floor((navigator.hardwareConcurrency || 4) / 2)))
  : 2;
const MAX_DRAW_TILES = 240;
const TILE_REQUEST_TIMEOUT = IS_LOCAL_HOST ? 12000 : 24000;

const STRUCT_REQUEST_TIMEOUT = 15000;
const MAX_TILE_ATTEMPTS = IS_LOCAL_HOST ? 3 : 4;
const TILE_RETRY_PENALTY = 5500;
const TILE_RETRY_BASE_DELAY = IS_LOCAL_HOST ? 450 : 1100;
const PREFETCH_MARGIN = 0;
const MAX_TILE_ENQUEUE_PER_RENDER = IS_LOCAL_HOST ? 10 : 6;
const MAX_TILE_QUEUE_WHILE_LOADING = IS_LOCAL_HOST ? 36 : 22;
const TILE_VIEW_MARGIN = 0;
const TILE_QUEUE_VIEW_MARGIN = 1;
const TILE_RESULT_KEEP_MARGIN = 1;

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

const WORKER_POOL_SIZE = Math.max(1, Math.min(MAX_TILE_REQUESTS, Math.ceil((navigator.hardwareConcurrency || 4) / 3)));
const VISIBLE_TILE_PRIORITY_BOOST = 1_000_000;
const COARSE_TILE_PRIORITY_BOOST = 500_000;
const TILE_BUILD_BATCH = 6;
const TILE_BUILD_FRAME_BUDGET = 4;
const TILE_PENDING_VIEW_MARGIN = IS_LOCAL_HOST ? 2 : 3;

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
const CAVE_BIOME_IDS = new Set([174, 175, 183]);
const SURFACE_BIOME_FALLBACK = 1;

function isCaveBiomeId(id) {
  return CAVE_BIOME_IDS.has(Number(id));
}
