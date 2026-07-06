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
const RENDER_WATER_BIOMES = new Set([0, 7, 10, 11, 24, 44, 45, 46, 47, 48, 49, 50]);
const DEEP_WATER_BIOMES = new Set([24, 47, 48, 49, 50]);
const BEACH_BIOMES = new Set([16, 26]);
const SAND_BIOMES = new Set([2, 16, 17, 26, 130]);
const FOREST_BIOMES = new Set([4, 18, 21, 27, 28, 29, 32, 33, 132, 155, 156, 157, 168, 169, 185]);

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
    const worldX = baseX + lx * sc;
    const worldZ = baseZ + lz * sc;
    if (allVis) {
      const rgb = BIOME_RGB.get(biomeId) || UNKNOWN_BIOME_RGB;
      applyStylizedBiomePixel(data, j, rgb, displayGrid, s, lx, lz, worldX, worldZ, biomeId);
    } else {
      const color = biomePixelColor(biomeId, worldX, worldZ);
      data[j] = (color >> 16) & 255; data[j + 1] = (color >> 8) & 255; data[j + 2] = color & 255;
      data[j + 3] = 255;
    }
    if (++lx === s) { lx = 0; lz++; }
  }
  c.putImageData(img, 0, 0);
  const canvas = upscaleBiomeCanvas(cnv, s, BIOME_TILE_RENDER_SCALE);
  return { canvas, grid, displayGrid, lod, tx, tz, samples: s, scale: cfg.scale, blocks: cfg.blocks, last: performance.now() };
}

function upscaleBiomeCanvas(source, samples, scale) {
  if (scale <= 1) return source;
  const sourceCtx = source.getContext("2d", { alpha: false });
  if (!sourceCtx) return source;
  const sourceData = sourceCtx.getImageData(0, 0, samples, samples).data;
  const size = samples * scale;
  const out = document.createElement("canvas");
  out.width = size;
  out.height = size;
  const outCtx = out.getContext("2d", { alpha: false });
  if (!outCtx) return source;
  const outImg = outCtx.createImageData(size, size);
  const outData = outImg.data;
  for (let y = 0; y < size; y++) {
    const sy = (y + 0.5) / scale - 0.5;
    const y0 = Math.max(0, Math.min(samples - 1, Math.floor(sy)));
    const y1 = Math.max(0, Math.min(samples - 1, y0 + 1));
    const ty = sy <= 0 || y0 === y1 ? 0 : sy - y0;
    for (let x = 0; x < size; x++) {
      const sx = (x + 0.5) / scale - 0.5;
      const x0 = Math.max(0, Math.min(samples - 1, Math.floor(sx)));
      const x1 = Math.max(0, Math.min(samples - 1, x0 + 1));
      const tx = sx <= 0 || x0 === x1 ? 0 : sx - x0;
      const i00 = (y0 * samples + x0) * 4;
      const i10 = (y0 * samples + x1) * 4;
      const i01 = (y1 * samples + x0) * 4;
      const i11 = (y1 * samples + x1) * 4;
      const outI = (y * size + x) * 4;
      for (let c = 0; c < 3; c++) {
        const top = sourceData[i00 + c] + (sourceData[i10 + c] - sourceData[i00 + c]) * tx;
        const bottom = sourceData[i01 + c] + (sourceData[i11 + c] - sourceData[i01 + c]) * tx;
        outData[outI + c] = top + (bottom - top) * ty;
      }
      outData[outI + 3] = 255;
    }
  }
  softenBiomePixels(outData, size);
  outCtx.putImageData(outImg, 0, 0);
  return out;
}

function softenBiomePixels(data, size) {
  const copy = new Uint8ClampedArray(data);
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const i = (y * size + x) * 4;
      const n = ((y - 1) * size + x) * 4;
      const s = ((y + 1) * size + x) * 4;
      const w = (y * size + x - 1) * 4;
      const e = (y * size + x + 1) * 4;
      for (let c = 0; c < 3; c++) {
        const avg = (copy[i + c] * 4 + copy[n + c] + copy[s + c] + copy[w + c] + copy[e + c]) / 8;
        data[i + c] = copy[i + c] * 0.58 + avg * 0.42;
      }
    }
  }
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
    return tintBiome(rgb, worldX, worldZ, biomeId);
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

function tintBiome(rgb, worldX, worldZ, biomeId) {
  const [r, g, b] = stylizedBiomeRgb(rgb, worldX, worldZ, biomeId);
  return (r << 16) | (g << 8) | b;
}

function stylizedBiomeRgb(rgb, worldX, worldZ, biomeId) {
  const n1 = smoothTerrainNoise(worldX >> 5, worldZ >> 5) - 0.5;
  const n2 = smoothTerrainNoise(worldX >> 8, worldZ >> 8) - 0.5;
  const n3 = smoothTerrainNoise(worldX >> 3, worldZ >> 3) - 0.5;
  let r = rgb[0], g = rgb[1], b = rgb[2];
  let contrast = 1 + n1 * 0.08 + n2 * 0.06;
  let lift = n2 * 5 + n3 * 2;

  if (RENDER_WATER_BIOMES.has(biomeId)) {
    contrast = 1 + n1 * 0.055;
    lift = DEEP_WATER_BIOMES.has(biomeId) ? -10 + n2 * 4 : 2 + n2 * 4;
    r = mixChannel(r, 18, 0.24);
    g = mixChannel(g, 122, 0.18);
    b = mixChannel(b, 205, 0.18);
  } else if (SAND_BIOMES.has(biomeId)) {
    r = mixChannel(r, 242, 0.24);
    g = mixChannel(g, 215, 0.18);
    b = mixChannel(b, 126, 0.10);
    contrast = 1 + n1 * 0.06;
    lift += 6;
  } else if (FOREST_BIOMES.has(biomeId)) {
    r = mixChannel(r, 52, 0.16);
    g = mixChannel(g, 118, 0.16);
    b = mixChannel(b, 56, 0.10);
    lift -= 3;
    contrast = 1 + n1 * 0.10 + n2 * 0.06;
  } else {
    r = mixChannel(r, 134, 0.08);
    g = mixChannel(g, 174, 0.10);
    b = mixChannel(b, 78, 0.08);
  }

  return [
    clampByte(r * contrast + lift),
    clampByte(g * contrast + lift),
    clampByte(b * contrast + lift)
  ];
}

function applyStylizedBiomePixel(data, j, rgb, grid, s, x, z, worldX, worldZ, biomeId) {
  const water = RENDER_WATER_BIOMES.has(biomeId);
  const waterDist = nearbyBiomeDistance(grid, s, x, z, id => RENDER_WATER_BIOMES.has(id), 3);
  const landDist = nearbyBiomeDistance(grid, s, x, z, id => !RENDER_WATER_BIOMES.has(id), 3);
  const besideWater = waterDist > 0;
  const besideLand = landDist > 0;
  let [r, g, b] = stylizedBiomeRgb(rgb, worldX, worldZ, biomeId);

  if (water && besideLand) {
    const t = landDist === 1 ? 0.38 : landDist === 2 ? 0.22 : 0.12;
    r = mixChannel(r, 72, t);
    g = mixChannel(g, 190, t);
    b = mixChannel(b, 224, t * 0.9);
  } else if (!water && besideWater) {
    const shore = waterDist === 1 ? 0.36 : waterDist === 2 ? 0.2 : 0.1;
    const beachTint = BEACH_BIOMES.has(biomeId) || SAND_BIOMES.has(biomeId) ? shore * 1.2 : shore;
    r = mixChannel(r, 238, beachTint);
    g = mixChannel(g, 211, beachTint * 0.95);
    b = mixChannel(b, 128, beachTint * 0.62);
  }

  const edge = biomeEdgeStrength(grid, s, x, z, biomeId);
  if (edge && !water) {
    const shade = 1 - edge * 0.07;
    r *= shade; g *= shade; b *= shade;
  }

  data[j] = clampByte(r);
  data[j + 1] = clampByte(g);
  data[j + 2] = clampByte(b);
  data[j + 3] = 255;
}

function nearbyBiome(grid, s, x, z, predicate) {
  if (x > 0 && predicate(grid[z * s + x - 1])) return true;
  if (x + 1 < s && predicate(grid[z * s + x + 1])) return true;
  if (z > 0 && predicate(grid[(z - 1) * s + x])) return true;
  if (z + 1 < s && predicate(grid[(z + 1) * s + x])) return true;
  return false;
}

function nearbyBiomeDistance(grid, s, x, z, predicate, maxRadius) {
  for (let radius = 1; radius <= maxRadius; radius++) {
    for (let dz = -radius; dz <= radius; dz++) {
      const nz = z + dz;
      if (nz < 0 || nz >= s) continue;
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.abs(dx) !== radius && Math.abs(dz) !== radius) continue;
        const nx = x + dx;
        if (nx < 0 || nx >= s) continue;
        if (predicate(grid[nz * s + nx])) return radius;
      }
    }
  }
  return 0;
}

function biomeEdgeStrength(grid, s, x, z, id) {
  let edge = 0;
  if (x > 0 && grid[z * s + x - 1] !== id) edge++;
  if (x + 1 < s && grid[z * s + x + 1] !== id) edge++;
  if (z > 0 && grid[(z - 1) * s + x] !== id) edge++;
  if (z + 1 < s && grid[(z + 1) * s + x] !== id) edge++;
  return Math.min(1, edge / 3);
}

function mixChannel(a, b, t) {
  return a + (b - a) * t;
}

function clampByte(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
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

// Whether height data (hillshade + contour lines) is available at all for
// the current world. Independent of the "Contour Lines" toggle, which only
// controls whether the line strokes themselves are drawn — the hillshade
// stays on regardless so turning lines off doesn't also flatten the relief.
function reliefDataActive() {
  return state.dimension === "overworld" &&
    !isBedrockVersion(state.version) && dimensionCaps().heights;
}

// Requests a 2-sample halo around the tile: one ring for the hillshade's 3x3
// smoothing, one more for the gradient after that, so both read real
// neighboring terrain instead of a clamped edge — otherwise adjacent tiles'
// shading disagrees right at the boundary (a visible seam).
const HEIGHT_HALO = 2;

function heightSampleDiv() {
  for (const tier of HEIGHT_SAMPLE_DIV_TIERS) {
    if (state.zoom <= tier.maxZoom) return tier.div;
  }
  return HEIGHT_SAMPLE_DIV_TIERS[HEIGHT_SAMPLE_DIV_TIERS.length - 1].div;
}

// Height tiles are keyed by resolution tier too — the same world tile at a
// coarser div is different data, not a cache hit.
function heightTileKey(lod, tx, tz) {
  return `${tileKey(lod, tx, tz)}:${heightSampleDiv()}`;
}

function ensureHeightTile(lod, tx, tz) {
  if (!reliefDataActive()) return;
  const key = heightTileKey(lod, tx, tz);
  if (state.heightTiles.has(key) || state.heightPending.has(key)) return;
  if (state.heightPending.size >= MAX_HEIGHT_REQUESTS) return;
  const cfg = LODS[lod];
  const div = heightSampleDiv();
  const hSamples = Math.max(8, Math.round(cfg.samples / div));
  const hScale = Math.round(cfg.blocks / hSamples);
  const padded = hSamples + HEIGHT_HALO * 2;
  const runId = state.runId;
  state.heightPending.add(key);
  workerRequest("heightTile", {
    seed: state.seed,
    version: state.version,
    x: tx * cfg.blocks - HEIGHT_HALO * hScale,
    z: tz * cfg.blocks - HEIGHT_HALO * hScale,
    w: padded,
    h: padded,
    scale: hScale
  }).then(data => {
    state.heightPending.delete(key);
    if (runId !== state.runId || !data?.grid) return;
    const grid = extractInnerGrid(data.grid, padded, hSamples, HEIGHT_HALO);
    // mapApproxHeight is noisy at the block-by-block level (real terrain
    // isn't, but this approximation has small spurious jitter). Building
    // contours straight off the raw grid turns that jitter into a messy
    // scribble; smoothing first gives clean, deliberate-looking bands.
    const smoothed = smoothInnerGrid(data.grid, padded, hSamples, HEIGHT_HALO);
    state.heightTiles.set(key, {
      grid,
      samples: hSamples,
      scale: hScale,
      lod, tx, tz,
      last: performance.now(),
      contourPath: buildContourPath(smoothed, hSamples, CONTOUR_INTERVAL),
      shadeBitmap: data.shadeBitmap || null
    });
    pruneHeightTileCache();
    requestRender();
  }).catch(() => {
    state.heightPending.delete(key);
  });
}

function pruneHeightTileCache() {
  if (state.heightTiles.size <= MAX_HEIGHT_TILE_CACHE) return;
  const sorted = [...state.heightTiles.entries()].sort((a, b) => a[1].last - b[1].last);
  for (let i = 0; i < sorted.length - MAX_HEIGHT_TILE_CACHE; i++) state.heightTiles.delete(sorted[i][0]);
}

function extractInnerGrid(padded, paddedSamples, innerSamples, margin) {
  const out = new Float32Array(innerSamples * innerSamples);
  for (let j = 0; j < innerSamples; j++) {
    for (let i = 0; i < innerSamples; i++) {
      out[j * innerSamples + i] = padded[(j + margin) * paddedSamples + (i + margin)];
    }
  }
  return out;
}

function smoothInnerGrid(padded, paddedSamples, innerSamples, margin) {
  const out = new Float32Array(innerSamples * innerSamples);
  for (let j = 0; j < innerSamples; j++) {
    const z = j + margin;
    for (let i = 0; i < innerSamples; i++) {
      const x = i + margin;
      let sum = 0;
      for (let dz = -1; dz <= 1; dz++) {
        const row = (z + dz) * paddedSamples;
        sum += padded[row + x - 1] + padded[row + x] + padded[row + x + 1];
      }
      out[j * innerSamples + i] = sum / 9;
    }
  }
  return out;
}

// Builds a Path2D of contour lines in grid-cell-index space (independent of
// zoom/pan), so it can be cached per tile and only re-scaled when drawn.
// Uses a lightweight marching-squares pass with edge interpolation: this keeps
// the topographic lines from turning into thick stair-stepped biome borders.
function buildContourPath(grid, samples, interval) {
  const path = new Path2D();
  const contourValue = v => Math.floor(v / interval) * interval;
  const addSegment = (a, b) => {
    path.moveTo(a[0], a[1]);
    path.lineTo(b[0], b[1]);
  };
  for (let z = 0; z < samples - 1; z++) {
    for (let x = 0; x < samples - 1; x++) {
      const i = z * samples + x;
      const h00 = grid[i];
      const h10 = grid[i + 1];
      const h11 = grid[i + samples + 1];
      const h01 = grid[i + samples];
      const minH = Math.min(h00, h10, h11, h01);
      const maxH = Math.max(h00, h10, h11, h01);
      const start = Math.ceil(minH / interval) * interval;
      for (let level = start; level < maxH; level += interval) {
        if (level <= minH) continue;
        const points = [];
        if ((h00 < level) !== (h10 < level)) points.push(interpPoint(x, z, x + 1, z, h00, h10, level));
        if ((h10 < level) !== (h11 < level)) points.push(interpPoint(x + 1, z, x + 1, z + 1, h10, h11, level));
        if ((h11 < level) !== (h01 < level)) points.push(interpPoint(x + 1, z + 1, x, z + 1, h11, h01, level));
        if ((h01 < level) !== (h00 < level)) points.push(interpPoint(x, z + 1, x, z, h01, h00, level));
        if (points.length === 2) {
          addSegment(points[0], points[1]);
        } else if (points.length === 4) {
          addSegment(points[0], points[1]);
          addSegment(points[2], points[3]);
        }
      }
    }
  }
  return path;
}

function interpPoint(x1, z1, x2, z2, h1, h2, level) {
  const t = h1 === h2 ? 0.5 : clamp((level - h1) / (h2 - h1), 0, 1);
  return [x1 + (x2 - x1) * t, z1 + (z2 - z1) * t];
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
