function queueTile(lod, tx, tz, visible = false) {
  const key = tileKey(lod, tx, tz);
  if (state.tiles.has(key) || state.pendingTiles.has(key)) return false;
  const existing = state.tileQueue.get(key);
  if (existing) {
    if (existing.tileGen !== tileLoadGeneration) {
      state.tileQueue.delete(key);
    } else {
      if (visible && !existing.visible) {
        existing.visible = true;
        existing.priority = tilePriority(lod, tx, tz, true, existing.attempts || 0);
      }
      return false;
    }
  }
  const priority = tilePriority(lod, tx, tz, visible);
  state.tileQueue.set(key, { lod, tx, tz, priority, visible, runId: state.runId, tileGen: tileLoadGeneration, attempts: 0 });
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
  if (zoomTileLoadingPaused || zoomRaf) return;
  if (!dimensionCaps().biomes || !state.showBiomes) {

    cancelAllTileRequests();
    state.tileQueue.clear();
    updateChunkPill();
    return;
  }
  if (state.pendingTiles.size >= MAX_TILE_REQUESTS || !state.tileQueue.size) return;
  refreshTilePriorities();
  const sorted = [...state.tileQueue.values()].sort((a, b) => a.priority - b.priority);
  let i = 0;
  const now = performance.now();
  while (state.pendingTiles.size < MAX_TILE_REQUESTS && i < sorted.length) {
    const next = sorted[i++];
    if (next.retryAt && next.retryAt > now) continue;
    state.tileQueue.delete(tileKey(next.lod, next.tx, next.tz));
    loadTile(next);
    updateChunkPill();
  }
  if (state.pendingTiles.size < MAX_TILE_REQUESTS && [...state.tileQueue.values()].some(job => job.retryAt && job.retryAt > now)) {
    scheduleTilePumpLater();
  }
}

function scheduleTilePumpLater(delay = 380) {
  if (tileRetryPumpTimer) return;
  tileRetryPumpTimer = setTimeout(() => {
    tileRetryPumpTimer = 0;
    pumpTiles();
  }, delay);
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
    if (!tileJobRelevant(job, TILE_QUEUE_VIEW_MARGIN) || job.runId !== state.runId || job.tileGen !== tileLoadGeneration) {
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
    if (pending.runId !== state.runId || pending.tileGen !== tileLoadGeneration || !tileJobRelevant(pending, TILE_PENDING_VIEW_MARGIN)) {
      pending.request?.cancel?.();
      state.pendingTiles.delete(key);
    }
  }
  updateChunkPill();
}

function cancelAllTileRequests() {
  if (tileRetryPumpTimer) {
    clearTimeout(tileRetryPumpTimer);
    tileRetryPumpTimer = 0;
  }
  if (!state.pendingTiles.size) return;
  for (const pending of state.pendingTiles.values()) {
    pending.request?.cancel?.();
  }
  state.pendingTiles.clear();
}

function cancelTransientTileLoading() {
  tileLoadGeneration++;
  state.tileQueue.clear();
  tileBuildQueue.length = 0;
  cancelAllTileRequests();
  updateChunkPill();
}

function dropStaleTileBuilds() {
  if (!tileBuildQueue.length) return;
  let dropped = false;
  for (let i = tileBuildQueue.length - 1; i >= 0; i--) {
    const job = tileBuildQueue[i];
    if (job.runId !== state.runId || job.tileGen !== tileLoadGeneration || !tileJobRelevant(job, TILE_RESULT_KEEP_MARGIN)) {
      tileBuildQueue.splice(i, 1);
      state.pendingTiles.delete(job.key);
      dropped = true;
    }
  }
  if (dropped) updateChunkPill();
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
  const retryAt = performance.now() + TILE_RETRY_BASE_DELAY * Math.pow(1.75, attempts - 1);
  state.tileQueue.set(key, { lod: job.lod, tx: job.tx, tz: job.tz, priority, visible: job.visible, runId: job.runId, tileGen: tileLoadGeneration, attempts, retryAt });
  if (state.tileQueue.size > MAX_TILE_QUEUE) pruneTileQueue();
  scheduleTilePumpLater(TILE_RETRY_BASE_DELAY);
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
    if (job.runId !== state.runId || job.tileGen !== tileLoadGeneration || !data.grid) return;
    if (!tileJobRelevant(job, TILE_RESULT_KEEP_MARGIN)) return;
    tileBuildQueue.push({ key, grid: data.grid, bitmap: data.bitmap, lod: job.lod, tx: job.tx, tz: job.tz, runId: job.runId, tileGen: job.tileGen });
    queued = true;
    scheduleTileBuild();
  } catch (err) {

    if (err?.name !== "AbortError" && job.runId === state.runId && job.tileGen === tileLoadGeneration && (job.attempts || 0) + 1 < MAX_TILE_ATTEMPTS) {
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
    if (job.runId === state.runId && job.tileGen === tileLoadGeneration && job.grid) {
      state.tiles.set(job.key, createTile(job.grid, job.lod, job.tx, job.tz, job.bitmap));
      built++;
    }
    state.pendingTiles.delete(job.key);
  }

  if (built) pruneTileCache();
  updateChunkPill();

  if (built && !mapIsMoving()) invalidateMarkers();
  if (processed) requestRender();
  pumpTiles();
  if (tileBuildQueue.length) scheduleTileBuild();
}

// Biomes that appear as diagonal noise stripes at water/land boundaries
const STRIPE_BIOMES = new Set([
  2, 17,                         // Desert, Desert Hills
  35, 36, 163, 164,              // Savanna, Savanna Plateau, Shattered Savanna variants
  37, 38, 39, 165, 166, 167,     // Badlands and all variants
]);
// Water biomes — only replace stripe pixels when fully surrounded by these
const WATER_BIOMES = new Set([
  0, 7, 10, 11, 24,              // Ocean, River, Frozen Ocean, Frozen River, Deep Ocean
  40, 41, 42, 43,                // End biomes (not water but irrelevant context)
  44, 45, 46, 47, 48, 49, 50,   // Warm/Lukewarm/Cold/Deep Ocean variants
]);

function smoothBiomeGrid(grid, s) {
  if (!grid || grid.length !== s * s) return grid;
  let changed = false;
  const result = Array.from(grid);
  for (let z = 1; z < s - 1; z++) {
    for (let x = 1; x < s - 1; x++) {
      const i = z * s + x;
      const c = grid[i];
      if (!STRIPE_BIOMES.has(c)) continue;
      const n = grid[(z - 1) * s + x];
      if (!WATER_BIOMES.has(n)) continue;
      const sn = grid[(z + 1) * s + x];
      if (n !== sn) continue;
      const w = grid[z * s + x - 1];
      if (n !== w) continue;
      const e = grid[z * s + x + 1];
      if (n !== e) continue;
      result[i] = n;
      changed = true;
    }
  }
  return changed ? result : grid;
}

function createTile(grid, lod, tx, tz, bitmap = null) {
  const cfg = LODS[lod];
  const s = cfg.samples;
  const displayGrid = smoothBiomeGrid(surfaceBiomeGrid(grid, s), s);
  if (bitmap && displayGrid === grid && allBiomesVisible()) {
    return { canvas: bitmap, grid, displayGrid, lod, tx, tz, samples: s, scale: cfg.scale, blocks: cfg.blocks, last: performance.now() };
  }
  if (bitmap) bitmap.close?.();
  const cnv = document.createElement("canvas");
  cnv.width = s;
  cnv.height = s;
  const c = cnv.getContext("2d", { alpha: false });
  const img = c.createImageData(s, s);
  const data = img.data;
  const baseX = tx * cfg.blocks;
  const baseZ = tz * cfg.blocks;
  const sc = cfg.scale;
  const allVis = allBiomesVisible();
  let lx = 0, lz = 0, j = 0;
  for (let i = 0; i < displayGrid.length; i++, j += 4) {
    const biomeId = displayGrid[i];
    if (allVis) {
      const rgb = BIOME_RGB.get(biomeId) || UNKNOWN_BIOME_RGB;
      let color = tintBiome(rgb, (baseX + lx * sc) >> 4, (baseZ + lz * sc) >> 4, biomeId);
      color = applyBevel(color, edgeBevelDelta(displayGrid, s, i, lx, lz, biomeId));
      data[j] = (color >> 16) & 255; data[j + 1] = (color >> 8) & 255; data[j + 2] = color & 255;
    } else {
      let color = biomePixelColor(biomeId, baseX + lx * sc, baseZ + lz * sc);
      color = applyBevel(color, edgeBevelDelta(displayGrid, s, i, lx, lz, biomeId));
      data[j] = (color >> 16) & 255; data[j + 1] = (color >> 8) & 255; data[j + 2] = color & 255;
    }
    data[j + 3] = 255;
    if (++lx === s) { lx = 0; lz++; }
  }
  c.putImageData(img, 0, 0);
  return { canvas: cnv, grid, displayGrid, lod, tx, tz, samples: s, scale: cfg.scale, blocks: cfg.blocks, last: performance.now() };
}

function surfaceBiomeGrid(grid, samples) {
  if (!grid.some(isCaveBiomeId)) return grid;
  const display = grid.slice();
  for (let i = 0; i < display.length; i++) {
    if (!isCaveBiomeId(display[i])) continue;
    display[i] = nearestSurfaceBiome(grid, i, samples);
  }
  return display;
}

function nearestSurfaceBiome(grid, index, samples) {
  const x = index % samples;
  const z = Math.floor(index / samples);
  for (let radius = 1; radius <= 8; radius++) {
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.abs(dx) !== radius && Math.abs(dz) !== radius) continue;
        const nx = x + dx;
        const nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= samples || nz >= samples) continue;
        const id = grid[nz * samples + nx];
        if (!isCaveBiomeId(id)) return id;
      }
    }
  }
  return SURFACE_BIOME_FALLBACK;
}

function allBiomesVisible() {
  return Object.values(state.biomeVis).every(Boolean);
}

function biomePixelColor(biomeId, worldX, worldZ) {
  const rgb = BIOME_RGB.get(biomeId) || UNKNOWN_BIOME_RGB;
  if (state.biomeVis[String(biomeId)] !== false) {
    return tintBiome(rgb, worldX >> 4, worldZ >> 4, biomeId);
  }
  const shade = 20 + ((Math.abs((worldX >> 5) + (worldZ >> 5)) % 2) * 7);
  return (shade << 16) | ((shade + 4) << 8) | (shade + 8);
}

function rebuildBiomeTileCanvases() {
  for (const [key, tile] of [...state.tiles]) {
    if (!tile?.grid) continue;
    const [lodPart, coordPart] = key.split(":");
    const [txPart, tzPart] = coordPart.split(",");
    state.tiles.set(key, createTile(tile.grid, Number(lodPart), Number(txPart), Number(tzPart)));
  }
  requestRender();
}

// Water/void biomes stay flat-shaded so oceans read as smooth rather than noisy.
const RELIEF_FLAT_BIOMES = new Set([0, 7, 10, 11, 24, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 127]);
// Lattice spacing for the fake heightmap, in chunks (broad hills + finer
// detail octave). A single bilinear-noise octave alone looks like a grid of
// perfectly round "bullseye" bumps — both terrainHeight and contourHeight
// blend in the fine octave (contourHeight more lightly) to break that up.
const RELIEF_CELL = 9;
const RELIEF_CELL_FINE = 4;

function latticeNoise(gx, gz, salt) {
  let v = Math.imul((gx + salt) ^ 0x27d4eb2d, 0x85ebca6b) ^ Math.imul((gz - salt) ^ 0xc2b2ae35, 0x165667b1);
  v ^= v >>> 13;
  v = Math.imul(v, 0x27d4eb2d);
  v ^= v >>> 16;
  return (v >>> 0) / 4294967295;
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function latticeHeight(cx, cz, cell, salt) {
  const gx = Math.floor(cx / cell);
  const gz = Math.floor(cz / cell);
  const fx = smoothstep((cx - gx * cell) / cell);
  const fz = smoothstep((cz - gz * cell) / cell);
  const h00 = latticeNoise(gx, gz, salt);
  const h10 = latticeNoise(gx + 1, gz, salt);
  const h01 = latticeNoise(gx, gz + 1, salt);
  const h11 = latticeNoise(gx + 1, gz + 1, salt);
  const top = h00 + (h10 - h00) * fx;
  const bot = h01 + (h11 - h01) * fx;
  return top + (bot - top) * fz;
}

// Cubiomes only exposes biome ids (no real heightmap), so we fake one: two
// bilinear-interpolated value-noise lattices (broad hills + finer detail)
// blended together give rolling terrain instead of per-block static.
// Coordinates are chunk-scale (world >> 4).
function terrainHeight(cx, cz) {
  return latticeHeight(cx, cz, RELIEF_CELL, 0) * 0.72 + latticeHeight(cx, cz, RELIEF_CELL_FINE, 97) * 0.28;
}

// Contour lines (see buildReliefTile below) lean much more heavily on the
// broad octave than the pixel shading does — enough fine detail to avoid the
// single-octave "bullseye" look, but not so much that lines turn into dense
// hatching.
function contourHeight(cx, cz) {
  return latticeHeight(cx, cz, RELIEF_CELL, 0) * 0.85 + latticeHeight(cx, cz, RELIEF_CELL_FINE, 97) * 0.15;
}

// Hypsometric color ramp: a light elevation-based tint (green low, tan/khaki
// mid, gray/white high) layered on top of the biome color, not replacing it.
// mcseedmap (and Amidst, whose palette BIOME_COLORS now uses) keep biome
// color as the primary signal and treat terrain/contour as a secondary
// overlay — a high RELIEF_TINT_WEIGHT here washed every biome into the same
// look, which is exactly what looked "broken".
const RELIEF_TINT_WEIGHT = 0.3;

// Hillshade + hypsometric ramp from the fake heightmap. The topographic
// contour lines are drawn separately as a vector overlay (see
// buildReliefTile/drawReliefContours) so this only needs to do slope
// lighting, not its own banding. Written as scalar math with no intermediate
// objects/arrays (this runs per pixel while a tile is being built, so
// allocations here turn into GC churn).
function tintBiome(rgb, cx, cz, biomeId) {
  let r = rgb[0], g = rgb[1], b = rgb[2];
  if (!RELIEF_FLAT_BIOMES.has(biomeId)) {
    const h = terrainHeight(cx, cz);
    const hx = terrainHeight(cx + 1, cz);
    const hz = terrainHeight(cx, cz + 1);
    let light = 1 + (h - hx) * 2.9 + (h - hz) * 2.1;
    light = light < 0.42 ? 0.42 : light > 1.4 ? 1.4 : light;

    let rr, rg, rb;
    if (h < 0.28) {
      const t = h / 0.28;
      rr = 46 + (132 - 46) * t; rg = 74 + (156 - 74) * t; rb = 44 + (92 - 44) * t;
    } else if (h < 0.46) {
      const t = (h - 0.28) / 0.18;
      rr = 132 + (196 - 132) * t; rg = 156 + (182 - 156) * t; rb = 92 + (132 - 92) * t;
    } else if (h < 0.64) {
      const t = (h - 0.46) / 0.18;
      rr = 196 + (180 - 196) * t; rg = 182 + (168 - 182) * t; rb = 132 + (146 - 132) * t;
    } else if (h < 0.8) {
      const t = (h - 0.64) / 0.16;
      rr = 180 + (206 - 180) * t; rg = 168 + (206 - 168) * t; rb = 146 + (202 - 146) * t;
    } else {
      const t = Math.min(1, (h - 0.8) / 0.2);
      rr = 206 + (240 - 206) * t; rg = 206 + (240 - 206) * t; rb = 202 + (238 - 202) * t;
    }

    r = r + (rr - r) * RELIEF_TINT_WEIGHT;
    g = g + (rg - g) * RELIEF_TINT_WEIGHT;
    b = b + (rb - b) * RELIEF_TINT_WEIGHT;
    r *= light; g *= light; b *= light;
  }
  return (clamp8(r) << 16) | (clamp8(g) << 8) | clamp8(b);
}

// Emboss biome borders (coastlines, mountain edges, ...) with a cheap
// highlight/shadow rim so patch boundaries read as raised/sunken terrain
// rather than flat cutouts. `grid`/`s`/`i` come from the tile's own pixel
// loop, so this is just a handful of array reads, no extra tile fetches.
function edgeBevelDelta(grid, s, i, lx, lz, biomeId) {
  let d = 0;
  if (lz > 0 && grid[i - s] !== biomeId) d += 16;
  if (lx > 0 && grid[i - 1] !== biomeId) d += 16;
  if (lz < s - 1 && grid[i + s] !== biomeId) d -= 16;
  if (lx < s - 1 && grid[i + 1] !== biomeId) d -= 16;
  return d;
}

function applyBevel(color, delta) {
  if (!delta) return color;
  const r = clamp8(((color >> 16) & 255) + delta);
  const g = clamp8(((color >> 8) & 255) + delta);
  const b = clamp8((color & 255) + delta);
  return (r << 16) | (g << 8) | b;
}

function highlightedBiomeColor(color, biomeId, worldX, worldZ) {
  if (isCaveBiomeId(state.highlightedBiome)) return color;
  const selected = String(biomeId) === String(state.highlightedBiome);
  if (!selected) {
    return mixPackedColor(color, 0x0a0e12, 0.22);
  }
  return mixPackedColor(color, 0xf8ffe8, 0.16);
}

function mixPackedColor(a, b, t) {
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;
  return ((ar + (br - ar) * t) << 16) |
    ((ag + (bg - ag) * t) << 8) |
    (ab + (bb - ab) * t);
}

function pruneTileCache() {
  if (state.tiles.size <= MAX_TILE_CACHE) return;
  const sorted = [...state.tiles.entries()].sort((a, b) => a[1].last - b[1].last);
  for (let i = 0; i < sorted.length - MAX_TILE_CACHE; i++) state.tiles.delete(sorted[i][0]);
  pruneReliefTiles();
}

// --- Topographic contour-line overlay -------------------------------------
// Real cubiomes data has no heightmap, so contour lines are traced from the
// same fake `contourHeight` field used for hillshading (broad octave only —
// see contourHeight above), via marching squares. Unlike the per-pixel
// shading, these are vector line segments (a Path2D per tile) stroked at a
// fixed 1 CSS-pixel width regardless of zoom, so they stay thin and smooth
// instead of looking like blocky pixel noise.
//
// Contour tiles piggyback on the already-fetched LOD0 biome tile (same
// 256-block footprint) for two things: they only get built once that tile's
// biome grid is cached (no extra network fetches), and they use its grid to
// mask contour lines to land only (oceans/rivers stay clean).
const RELIEF_GRID_N = 16;         // marching-squares cells per axis per tile
const RELIEF_LINE_STEP = 0.08;    // contour spacing on the 0..1 height scale — wider gaps, fewer lines
const RELIEF_BUILD_BUDGET = 6;    // tiles built per frame while panning/zooming
const MAX_RELIEF_TILE_CACHE = 400;
const reliefTiles = new Map();
// Reused scratch buffers for buildReliefTile — every entry gets overwritten
// before it's read on each call, and builds run synchronously one at a time,
// so reuse is safe and avoids allocating two new TypedArrays per tile.
const RELIEF_PTS = RELIEF_GRID_N + 1;
const reliefHeightScratch = new Float32Array(RELIEF_PTS * RELIEF_PTS);
const reliefLandScratch = new Uint8Array(RELIEF_PTS * RELIEF_PTS);

function reliefKey(tx, tz) {
  return `${tx},${tz}`;
}

function biomeGridSample(tile, blockX, blockZ) {
  const s = tile.samples;
  const grid = tile.displayGrid || tile.grid;
  const sx = Math.min(s - 1, Math.max(0, Math.round(blockX / tile.scale)));
  const sz = Math.min(s - 1, Math.max(0, Math.round(blockZ / tile.scale)));
  return grid[sz * s + sx];
}

function frac(t, va, vb) {
  return va !== vb ? (t - va) / (vb - va) : 0.5;
}

// Standard marching-squares single-level cell trace (corners: top-left,
// top-right, bottom-right, bottom-left). Complementary cases (c and 15-c)
// produce the same boundary line, so only 8 distinct patterns are needed.
// Edge points are computed inline (no per-call closures/arrays) since this
// runs for every contour crossing in every cell of every tile being built.
function marchCell(path, tl, tr, br, bl, x0, z0, x1, z1, t) {
  const idx = (tl >= t ? 8 : 0) | (tr >= t ? 4 : 0) | (br >= t ? 2 : 0) | (bl >= t ? 1 : 0);
  if (idx === 0 || idx === 15) return;
  const dx = x1 - x0, dz = z1 - z0;
  switch (idx) {
    case 1: case 14:
      path.moveTo(x0, z0 + dz * frac(t, tl, bl));
      path.lineTo(x0 + dx * frac(t, bl, br), z1);
      break;
    case 2: case 13:
      path.moveTo(x0 + dx * frac(t, bl, br), z1);
      path.lineTo(x1, z0 + dz * frac(t, tr, br));
      break;
    case 3: case 12:
      path.moveTo(x0, z0 + dz * frac(t, tl, bl));
      path.lineTo(x1, z0 + dz * frac(t, tr, br));
      break;
    case 4: case 11:
      path.moveTo(x0 + dx * frac(t, tl, tr), z0);
      path.lineTo(x1, z0 + dz * frac(t, tr, br));
      break;
    case 6: case 9:
      path.moveTo(x0 + dx * frac(t, tl, tr), z0);
      path.lineTo(x0 + dx * frac(t, bl, br), z1);
      break;
    case 7: case 8:
      path.moveTo(x0 + dx * frac(t, tl, tr), z0);
      path.lineTo(x0, z0 + dz * frac(t, tl, bl));
      break;
    case 5:
      path.moveTo(x0 + dx * frac(t, tl, tr), z0);
      path.lineTo(x1, z0 + dz * frac(t, tr, br));
      path.moveTo(x0 + dx * frac(t, bl, br), z1);
      path.lineTo(x0, z0 + dz * frac(t, tl, bl));
      break;
    case 10:
      path.moveTo(x0 + dx * frac(t, tl, tr), z0);
      path.lineTo(x0, z0 + dz * frac(t, tl, bl));
      path.moveTo(x0 + dx * frac(t, bl, br), z1);
      path.lineTo(x1, z0 + dz * frac(t, tr, br));
      break;
  }
}

// Builds one tile's contour Path2D, or returns null if its biome tile isn't
// cached yet (the caller retries later — cheap, just a Map lookup).
function buildReliefTile(tx, tz) {
  const biomeTile = state.tiles.get(tileKey(0, tx, tz));
  if (!biomeTile) return null;
  const blocks = LODS[0].blocks;
  const chunkSize = blocks >> 4;
  const n = RELIEF_GRID_N;
  const cellChunks = chunkSize / n;
  const baseCx = (tx * blocks) >> 4;
  const baseCz = (tz * blocks) >> 4;
  const baseX = tx * blocks;
  const baseZ = tz * blocks;
  const pts = n + 1;
  const heights = reliefHeightScratch;
  const land = reliefLandScratch;
  for (let gz = 0; gz < pts; gz++) {
    for (let gx = 0; gx < pts; gx++) {
      const idx = gz * pts + gx;
      heights[idx] = contourHeight(baseCx + gx * cellChunks, baseCz + gz * cellChunks);
      const biomeId = biomeGridSample(biomeTile, Math.min(blocks, gx * cellChunks * 16), Math.min(blocks, gz * cellChunks * 16));
      land[idx] = RELIEF_FLAT_BIOMES.has(biomeId) ? 0 : 1;
    }
  }
  const path = new Path2D();
  for (let gz = 0; gz < n; gz++) {
    for (let gx = 0; gx < n; gx++) {
      const i00 = gz * pts + gx;
      const i10 = i00 + 1;
      const i01 = i00 + pts;
      const i11 = i01 + 1;
      if (!land[i00] && !land[i10] && !land[i01] && !land[i11]) continue;
      const tl = heights[i00], tr = heights[i10], bl = heights[i01], br = heights[i11];
      const minV = Math.min(tl, tr, bl, br);
      const maxV = Math.max(tl, tr, bl, br);
      const lvl0 = Math.ceil(minV / RELIEF_LINE_STEP);
      const lvl1 = Math.floor(maxV / RELIEF_LINE_STEP);
      if (lvl0 > lvl1) continue;
      const x0 = baseX + gx * cellChunks * 16;
      const x1 = baseX + (gx + 1) * cellChunks * 16;
      const z0 = baseZ + gz * cellChunks * 16;
      const z1 = baseZ + (gz + 1) * cellChunks * 16;
      for (let lvl = lvl0; lvl <= lvl1; lvl++) {
        marchCell(path, tl, tr, br, bl, x0, z0, x1, z1, lvl * RELIEF_LINE_STEP);
      }
    }
  }
  return { tx, tz, path, last: performance.now() };
}

// Builds any missing, currently-visible contour tiles, spending at most
// RELIEF_BUILD_BUDGET per call so a big pan/zoom jump can't spike a frame.
// Prunes its own cache independently of the biome-tile lifecycle, so it
// can't grow unbounded even if biome tiles rarely churn.
function pumpReliefTiles(range) {
  let built = 0;
  for (let tz = range.tzMin; tz <= range.tzMax; tz++) {
    for (let tx = range.txMin; tx <= range.txMax; tx++) {
      const key = reliefKey(tx, tz);
      if (reliefTiles.has(key)) continue;
      const tile = buildReliefTile(tx, tz);
      if (!tile) continue;
      reliefTiles.set(key, tile);
      if (++built >= RELIEF_BUILD_BUDGET) {
        pruneReliefTiles();
        return;
      }
    }
  }
  if (built) pruneReliefTiles();
}

function pruneReliefTiles() {
  if (reliefTiles.size <= MAX_RELIEF_TILE_CACHE) return;
  const sorted = [...reliefTiles.entries()].sort((a, b) => a[1].last - b[1].last);
  for (let i = 0; i < sorted.length - MAX_RELIEF_TILE_CACHE; i++) reliefTiles.delete(sorted[i][0]);
}

function versionAtLeast(version, minimum) {
  const current = String(generationVersion(version) || "0").split(".").map(Number);
  const target = String(minimum || "0").split(".").map(Number);
  const size = Math.max(current.length, target.length);
  for (let i = 0; i < size; i++) {
    const a = current[i] || 0;
    const b = target[i] || 0;
    if (a !== b) return a > b;
  }
  return true;
}

function biomeName(id) {
  if (versionAtLeast(state.version, "1.18") && MODERN_BIOME_NAMES[id]) return MODERN_BIOME_NAMES[id];
  return BIOME_NAMES[id] || `Biome ${id}`;
}
