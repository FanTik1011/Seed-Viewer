const BASE_PATH = (window.SEED_VIEWER_BASE_PATH || "").replace(/\/$/, "");
const API = BASE_PATH;
const TILE_BLOCKS = 256;
const WORKER_URL = `${BASE_PATH}/static/seed-worker.js`;
const CPU_CORES = Math.max(2, navigator.hardwareConcurrency || 4);
const SAMPLE_SCALE = 8;
const TILE_SAMPLES = TILE_BLOCKS / SAMPLE_SCALE;
const MAX_BIOME_REQUEST_SAMPLES = 256;
const MAX_TILE_CACHE = 1600;
const MAX_TILE_QUEUE = 320;
const MAX_TILE_REQUESTS = Math.max(4, Math.min(10, CPU_CORES));
const MAX_DRAW_TILES = 240;
const TILE_REQUEST_TIMEOUT = 15000;

const STRUCT_REQUEST_TIMEOUT = 15000;
const MAX_TILE_ATTEMPTS = 3;
const TILE_RETRY_PENALTY = 4000;
const PREFETCH_MARGIN = 1;
const MAX_TILE_ENQUEUE_PER_RENDER = 48;
const CENTER_TILE_ENQUEUE = 16;
const CENTER_BULK_RADIUS = 1;
const MAX_TILE_QUEUE_WHILE_LOADING = 150;
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

const WORKER_POOL_SIZE = Math.max(2, Math.min(8, CPU_CORES));
const VISIBLE_TILE_PRIORITY_BOOST = 1_000_000;
const COARSE_TILE_PRIORITY_BOOST = 300_000;
const OVERVIEW_TILE_PRIORITY_BOOST = 900_000;
const CENTER_TILE_PRIORITY_BOOST = 350_000;
const TILE_BUILD_BATCH = 18;
const TILE_BUILD_FRAME_BUDGET = 8;
const TILE_PENDING_VIEW_MARGIN = 2;
const RAPID_PAN_CANCEL_MARGIN = 0;
const MOVING_TILE_LOOKAHEAD_MS = 140;

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

function performanceHints() {
  return state.capabilities?.performance || {};
}

function tileRequestLimit() {
  const hinted = Number(performanceHints().tileRequests);
  const serverLimit = Number.isFinite(hinted) && hinted > 0 ? hinted : MAX_TILE_REQUESTS;
  let limit = Math.max(1, Math.min(MAX_TILE_REQUESTS, Math.floor(serverLimit)));
  const latency = Number(state.tileLatencyMs || 0);
  if (latency > 2600) limit = Math.min(limit, 2);
  else if (latency > 1400) limit = Math.min(limit, 4);
  if (navigator.connection?.saveData) limit = Math.min(limit, 3);
  return limit;
}

function workerPoolTarget() {
  const hinted = Number(performanceHints().workerPool);
  const serverLimit = Number.isFinite(hinted) && hinted > 0 ? hinted : WORKER_POOL_SIZE;
  return Math.max(1, Math.min(WORKER_POOL_SIZE, Math.floor(serverLimit)));
}
