const BASE_PATH = (window.SEED_VIEWER_BASE_PATH || "").replace(/\/$/, "");
const API = BASE_PATH;
const TILE_BLOCKS = 256;
const WORKER_URL = `${BASE_PATH}/static/seed-worker.js`;
const SAMPLE_SCALE = 8;
const TILE_SAMPLES = TILE_BLOCKS / SAMPLE_SCALE;
const BIOME_TILE_RENDER_SCALE = 1;
const IS_LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[?::1\]?)$/.test(window.location.hostname);
const PERF_MODE = String(window.SEED_VIEWER_PERF_MODE || "").toLowerCase();
const IS_HEROKU = PERF_MODE === "heroku" || /\.herokuapp\.com$/i.test(window.location.hostname);
const SERVER_PERF_MODE = IS_HEROKU || PERF_MODE === "server" || PERF_MODE === "lite" || (!IS_LOCAL_HOST && PERF_MODE !== "quality");
const MAX_TILE_CACHE = SERVER_PERF_MODE ? 520 : 800;
const MAX_TILE_QUEUE = SERVER_PERF_MODE ? 96 : 180;
const MAX_TILE_REQUESTS = SERVER_PERF_MODE
  ? 3
  : IS_LOCAL_HOST ? Math.max(3, Math.min(6, Math.floor((navigator.hardwareConcurrency || 4) / 2))) : 5;
const MAX_DRAW_TILES = SERVER_PERF_MODE ? 220 : 300;
const MAX_HEIGHT_TILE_CACHE = SERVER_PERF_MODE ? 260 : 500;
const MAX_HEIGHT_REQUESTS = SERVER_PERF_MODE ? 1 : IS_LOCAL_HOST ? 4 : 3;
const DEFER_INITIAL_STRUCTURES = SERVER_PERF_MODE;
// Height/hillshade resolution adapts to zoom: full detail (matching the
// biome grid) when zoomed in close enough to actually see it, coarser (and
// cheaper) once tiles are small on screen and the extra detail would just be
// smoothed away anyway. Tiers are checked in order, first match wins.
const HEIGHT_SAMPLE_DIV_TIERS = SERVER_PERF_MODE ? [
  { maxZoom: 1.4, div: 2 },
  { maxZoom: 4.2, div: 3 },
  { maxZoom: Infinity, div: 5 }
] : [
  { maxZoom: 1.4, div: 1 },
  { maxZoom: 4.2, div: 2 },
  { maxZoom: Infinity, div: 4 }
];
const CONTOUR_INTERVAL = SERVER_PERF_MODE ? 18 : 12;
const TILE_REQUEST_TIMEOUT = IS_HEROKU ? 24000 : IS_LOCAL_HOST ? 12000 : 18000;

const STRUCT_REQUEST_TIMEOUT = SERVER_PERF_MODE ? 22000 : 15000;
const MAX_TILE_ATTEMPTS = 3;
const TILE_RETRY_PENALTY = 5500;
const TILE_RETRY_BASE_DELAY = IS_LOCAL_HOST ? 450 : 500;
const PREFETCH_MARGIN = 0;
const MAX_TILE_ENQUEUE_PER_RENDER = SERVER_PERF_MODE ? 18 : IS_LOCAL_HOST ? 60 : 36;
const MAX_TILE_QUEUE_WHILE_LOADING = SERVER_PERF_MODE ? 72 : IS_LOCAL_HOST ? 180 : 130;
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
const MAX_STRUCT_REGION_REQUESTS = SERVER_PERF_MODE ? 1 : 2;
const STRUCT_BULK_RADIUS = SERVER_PERF_MODE ? 1536 : 2048;
const STRUCT_BULK_MAX_RADIUS = SERVER_PERF_MODE ? 2304 : 3072;
const STRUCT_VIEW_BUFFER = SERVER_PERF_MODE ? 512 : 768;
const MAX_STREAM_MARKERS = SERVER_PERF_MODE ? 2200 : 3500;
const STRUCT_KEEP_RADIUS = 2;          
const STRUCT_DEFER_DELAY = SERVER_PERF_MODE ? 420 : 140;
const STRUCT_FAST_TYPES = [
  "Village", "Mansion", "Monument", "Outpost",
  "Desert_Temple", "Jungle_Temple", "Witch_Hut", "Igloo"
];

const WORKER_POOL_SIZE = SERVER_PERF_MODE ? Math.min(2, MAX_TILE_REQUESTS) : Math.max(1, Math.min(MAX_TILE_REQUESTS, Math.ceil((navigator.hardwareConcurrency || 4) / 3)));
const VISIBLE_TILE_PRIORITY_BOOST = 1_000_000;
const COARSE_TILE_PRIORITY_BOOST = 500_000;
const TILE_BUILD_BATCH = SERVER_PERF_MODE ? 5 : 8;
const TILE_BUILD_FRAME_BUDGET = SERVER_PERF_MODE ? 3.5 : 5;
const TILE_PENDING_VIEW_MARGIN = SERVER_PERF_MODE ? 1 : IS_LOCAL_HOST ? 2 : 3;
const ZOOM_TILE_SETTLE_DELAY = SERVER_PERF_MODE ? 260 : 140;

const MODERN_LODS = [
  { blocks: 256,   samples: 64,  scale: 4  },
  { blocks: 1024,  samples: 64,  scale: 16 },
  { blocks: 4096,  samples: 64,  scale: 64 },
  { blocks: 16384, samples: 256, scale: 64 }
];
const HEROKU_MODERN_LODS = [
  { blocks: 256,   samples: 64,  scale: 4  },
  { blocks: 1024,  samples: 64,  scale: 16 },
  { blocks: 4096,  samples: 64,  scale: 64 },
  { blocks: 16384, samples: 256, scale: 64 }
];
const LEGACY_LODS = [
  { blocks: 256,   samples: 16,  scale: 16 },
  { blocks: 1024,  samples: 64,  scale: 16 },
  { blocks: 4096,  samples: 64,  scale: 64 },
  { blocks: 16384, samples: 256, scale: 64 }
];
let LODS = IS_HEROKU ? HEROKU_MODERN_LODS : MODERN_LODS;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 8;   
const DEFAULT_ZOOM = 2;
const ZOOM_EASE = 0.25;
const PAN_FRICTION = 0.9;
const INITIAL_SCAN_RADIUS = SERVER_PERF_MODE ? 1536 : 2048;
const MANUAL_SCAN_RADIUS = SERVER_PERF_MODE ? 2304 : 3072;
const MAP_BG = "#17158b";
const EMPTY_TILE_COLORS = ["#17158b", "#17158b"];
const UNKNOWN_BIOME_RGB = [38, 45, 41];
const CAVE_BIOME_IDS = new Set([174, 175, 183, 187]);
const SURFACE_BIOME_FALLBACK = 1;
const JAVA_VERSION_FALLBACKS = {
  "26.2": "1.21",
  "26.1": "1.21"
};
const BEDROCK_VERSION_FALLBACKS = {
  "bedrock_26.30": "1.21",
  "bedrock_26.20": "1.21",
  "bedrock_26.0": "1.21",
  "bedrock_1.21.120": "1.21",
  "bedrock_1.21.111": "1.21",
  "bedrock_1.21.110": "1.21",
  "bedrock_1.21.100": "1.21",
  "bedrock_1.21.90": "1.21",
  "bedrock_1.21.80": "1.21",
  "bedrock_1.21.70": "1.21",
  "bedrock_1.21.60": "1.21",
  "bedrock_1.21.50": "1.21",
  "bedrock_1.21": "1.21",
  "bedrock_1.20.60": "1.20",
  "bedrock_1.20": "1.20",
  "bedrock_1.19": "1.19",
  "bedrock_1.18": "1.18",
  "bedrock_1.17": "1.17",
  "bedrock_1.16": "1.16"
};

function isCaveBiomeId(id) {
  return CAVE_BIOME_IDS.has(Number(id));
}

function generationVersion(version) {
  const value = version == null && typeof state !== "undefined" ? state.version : version;
  return BEDROCK_VERSION_FALLBACKS[value] || JAVA_VERSION_FALLBACKS[value] || value || "1.20";
}

function isBedrockVersion(version) {
  const value = version == null && typeof state !== "undefined" ? state.version : version;
  return Object.prototype.hasOwnProperty.call(BEDROCK_VERSION_FALLBACKS, value);
}

function editionLabel(version) {
  return isBedrockVersion(version) ? "Bedrock seeds" : "Java seeds";
}
