function queueTile(lod, tx, tz, visible = false, center = false, overview = false) {
  const key = tileKey(lod, tx, tz);
  if (state.tiles.has(key)) return false;
  const pending = state.pendingTiles.get(key);
  if (pending) {
    if (visible && !pending.visible || center && !pending.center || overview && !pending.overview) {
      pending.visible = pending.visible || visible;
      pending.center = pending.center || center;
      pending.overview = pending.overview || overview;
      pending.priority = tilePriority(lod, tx, tz, pending.visible, pending.attempts || 0, pending.center, pending.overview);
    }
    return false;
  }
  const existing = state.tileQueue.get(key);
  if (existing) {
    if (visible && !existing.visible || center && !existing.center || overview && !existing.overview) {
      existing.visible = existing.visible || visible;
      existing.center = existing.center || center;
      existing.overview = existing.overview || overview;
      existing.priority = tilePriority(lod, tx, tz, existing.visible, existing.attempts || 0, existing.center, existing.overview);
    }
    return false;
  }
  const priority = tilePriority(lod, tx, tz, visible, 0, center, overview);
  state.tileQueue.set(key, { lod, tx, tz, priority, visible, center, overview, runId: state.runId, attempts: 0, seq: ++tileQueueSeq });
  if (center) preemptForCenterTile(priority);
  if (state.tileQueue.size > MAX_TILE_QUEUE) pruneTileQueue();
  scheduleTilePump();
  return true;
}

function tilePriority(lod, tx, tz, visible = false, attempts = 0, center = false, overview = false) {
  const b = LODS[lod].blocks;
  const cx = tx * b + b / 2;
  const cz = tz * b + b / 2;
  const view = predictedTileView();
  let priority = Math.hypot(cx - view.x, cz - view.z) + attempts * TILE_RETRY_PENALTY;
  if (visible) priority -= VISIBLE_TILE_PRIORITY_BOOST;
  if (overview) priority -= OVERVIEW_TILE_PRIORITY_BOOST;
  if (center) priority -= CENTER_TILE_PRIORITY_BOOST;
  if (lod > 0) priority -= COARSE_TILE_PRIORITY_BOOST / lod;
  return priority;
}

function predictedTileView() {
  if (!((dragStart && pointerMoved) || momentumRaf)) return { x: state.viewX, z: state.viewZ };
  return {
    x: state.viewX + panVel.x * MOVING_TILE_LOOKAHEAD_MS,
    z: state.viewZ + panVel.z * MOVING_TILE_LOOKAHEAD_MS
  };
}

function rapidPanActive() {
  return !!((dragStart && pointerMoved) || momentumRaf) && Math.hypot(panVel.x, panVel.z) * 1000 > 1400;
}

function tileKeepMargin(baseMargin) {
  return rapidPanActive() ? RAPID_PAN_CANCEL_MARGIN : baseMargin;
}

function bulkTileKey(lod, txMin, txMax, tzMin, tzMax) {
  return `${lod}:${txMin},${tzMin}-${txMax},${tzMax}`;
}

function queueCenterTileBulk(range) {
  if (!state.loaded || !state.showBiomes || !dimensionCaps().biomes) return false;
  const cfg = LODS[range.lod];
  const maxTiles = Math.max(1, Math.floor(MAX_BIOME_REQUEST_SAMPLES / cfg.samples));
  const size = Math.max(1, Math.min(maxTiles, CENTER_BULK_RADIUS * 2 + 1));
  const width = range.txMax - range.txMin + 1;
  const height = range.tzMax - range.tzMin + 1;
  const cols = Math.min(size, width);
  const rows = Math.min(size, height);
  const centerTx = Math.floor(predictedTileView().x / cfg.blocks);
  const centerTz = Math.floor(predictedTileView().z / cfg.blocks);
  const txMin = clamp(centerTx - Math.floor(cols / 2), range.txMin, range.txMax - cols + 1);
  const tzMin = clamp(centerTz - Math.floor(rows / 2), range.tzMin, range.tzMax - rows + 1);
  const txMax = txMin + cols - 1;
  const tzMax = tzMin + rows - 1;
  const bulkKey = bulkTileKey(range.lod, txMin, txMax, tzMin, tzMax);
  if (state.pendingTileBulk.has(bulkKey)) return false;

  let missing = 0;
  for (let tz = tzMin; tz <= tzMax; tz++) {
    for (let tx = txMin; tx <= txMax; tx++) {
      const key = tileKey(range.lod, tx, tz);
      if (state.tiles.has(key)) continue;
      missing++;
    }
  }
  if (!missing) return false;
  loadTileBulk({ lod: range.lod, txMin, txMax, tzMin, tzMax, runId: state.runId, key: bulkKey });
  return true;
}

async function loadTileBulk(job) {
  const cfg = LODS[job.lod];
  const s = cfg.samples;
  const cols = job.txMax - job.txMin + 1;
  const rows = job.tzMax - job.tzMin + 1;
  const started = performance.now();
  let request = null;
  let completed = false;
  try {
    request = workerRequest("biomeTile", {
      seed: state.seed,
      version: state.version,
      dimension: state.dimension,
      x: job.txMin * cfg.blocks,
      z: job.tzMin * cfg.blocks,
      w: cols * s,
      h: rows * s,
      scale: cfg.scale,
      skipBitmap: true
    });
    state.pendingTileBulk.set(job.key, { ...job, request });
    for (let tz = job.tzMin; tz <= job.tzMax; tz++) {
      for (let tx = job.txMin; tx <= job.txMax; tx++) {
        const key = tileKey(job.lod, tx, tz);
        if (state.tiles.has(key)) continue;
        state.tileQueue.delete(key);
        state.pendingTiles.set(key, {
          lod: job.lod, tx, tz, key, request,
          visible: true, center: true, bulkKey: job.key,
          runId: job.runId, attempts: 0
        });
      }
    }
    updateChunkPill();
    const data = await withTimeout(request, TILE_REQUEST_TIMEOUT, "Tile request timed out");
    recordTileLatency(performance.now() - started);
    if (job.runId !== state.runId || !data.grid) return;
    const totalW = cols * s;
    let built = 0;
    for (let tileZ = 0; tileZ < rows; tileZ++) {
      for (let tileX = 0; tileX < cols; tileX++) {
        const tx = job.txMin + tileX;
        const tz = job.tzMin + tileZ;
        const key = tileKey(job.lod, tx, tz);
        const pending = state.pendingTiles.get(key);
        if (!pending || pending.runId !== state.runId || !tileJobRelevant(pending, TILE_RESULT_KEEP_MARGIN)) continue;
        const grid = new Uint16Array(s * s);
        for (let lz = 0; lz < s; lz++) {
          const src = (tileZ * s + lz) * totalW + tileX * s;
          grid.set(data.grid.subarray(src, src + s), lz * s);
        }
        state.tiles.set(key, createTile(grid, job.lod, tx, tz));
        state.pendingTiles.delete(key);
        built++;
      }
    }
    completed = true;
    if (built) {
      pruneTileCache();
      requestRender();
    }
  } catch (err) {
    if (err?.name !== "AbortError") console.warn("Bulk tile failed", err);
  } finally {
    state.pendingTileBulk.delete(job.key);
    if (!completed) {
      for (let tz = job.tzMin; tz <= job.tzMax; tz++) {
        for (let tx = job.txMin; tx <= job.txMax; tx++) {
          state.pendingTiles.delete(tileKey(job.lod, tx, tz));
        }
      }
    }
    updateChunkPill();
    pumpTiles();
  }
}

function preemptForCenterTile(candidatePriority) {
  if (state.pendingTiles.size < tileRequestLimit()) return;
  let worstKey = "";
  let worstJob = null;
  let worstPriority = candidatePriority;
  for (const [key, pending] of state.pendingTiles) {
    if (pending.center) continue;
    const priority = tilePriority(pending.lod, pending.tx, pending.tz, pending.visible, pending.attempts || 0, pending.center, pending.overview);
    if (priority > worstPriority) {
      worstPriority = priority;
      worstKey = key;
      worstJob = pending;
    }
  }
  if (!worstJob) return;
  worstJob.request?.cancel?.();
  state.pendingTiles.delete(worstKey);
}

function refreshTilePriorities() {
  for (const job of state.tileQueue.values()) {
    job.priority = tilePriority(job.lod, job.tx, job.tz, job.visible, job.attempts || 0, job.center, job.overview);
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

    cancelAllTileRequests();
    state.tileQueue.clear();
    updateChunkPill();
    return;
  }
  const requestLimit = tileRequestLimit();
  if (state.pendingTiles.size >= requestLimit || !state.tileQueue.size) return;
  refreshTilePriorities();
  const sorted = [...state.tileQueue.values()].sort((a, b) => a.priority - b.priority || a.seq - b.seq);
  let i = 0;
  while (state.pendingTiles.size < requestLimit && i < sorted.length) {
    const next = sorted[i++];
    state.tileQueue.delete(tileKey(next.lod, next.tx, next.tz));
    loadTile(next);
  }
}

function pruneTileQueue() {
  refreshTilePriorities();
  const keep = [...state.tileQueue.entries()]
    .sort((a, b) => a[1].priority - b[1].priority || a[1].seq - b[1].seq)
    .slice(0, MAX_TILE_QUEUE);
  state.tileQueue = new Map(keep);
}

function trimTileQueueToView(range) {
  if (!state.tileQueue.size) return;
  const margin = tileKeepMargin(TILE_QUEUE_VIEW_MARGIN);
  for (const [key, job] of state.tileQueue) {
    if (!tileJobRelevant(job, margin) || job.runId !== state.runId) {
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
  const margin = tileKeepMargin(TILE_PENDING_VIEW_MARGIN);
  for (const [key, pending] of state.pendingTiles) {
    if (pending.runId !== state.runId || !tileJobRelevant(pending, margin)) {
      pending.request?.cancel?.();
      state.pendingTiles.delete(key);
    }
  }
  updateChunkPill();
}

function cancelAllTileRequests() {
  for (const pending of state.pendingTiles.values()) {
    pending.request?.cancel?.();
  }
  state.pendingTiles.clear();
  state.pendingTileBulk.clear();
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

function recordTileLatency(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return;
  state.tileLatencyMs = state.tileLatencyMs
    ? state.tileLatencyMs * 0.82 + ms * 0.18
    : ms;
}

function requeueTile(job) {
  const key = tileKey(job.lod, job.tx, job.tz);
  if (state.tiles.has(key) || state.pendingTiles.has(key) || state.tileQueue.has(key)) return;
  const attempts = (job.attempts || 0) + 1;
  const priority = tilePriority(job.lod, job.tx, job.tz, job.visible, attempts, job.center, job.overview);
  state.tileQueue.set(key, { lod: job.lod, tx: job.tx, tz: job.tz, priority, visible: job.visible, center: job.center, overview: job.overview, runId: job.runId, attempts, seq: ++tileQueueSeq });
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
  const started = performance.now();
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
    recordTileLatency(performance.now() - started);
    if (job.runId !== state.runId || !data.grid) return;
    if (!tileJobRelevant(job, TILE_RESULT_KEEP_MARGIN)) return;
    tileBuildQueue.push({ key, grid: data.grid, bitmap: data.bitmap, lod: job.lod, tx: job.tx, tz: job.tz, visible: job.visible, center: job.center, overview: job.overview, attempts: job.attempts || 0, runId: job.runId });
    queued = true;
    scheduleTileBuild();
  } catch (err) {

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
  tileBuildQueue.sort((a, b) =>
    tilePriority(a.lod, a.tx, a.tz, a.visible, a.attempts || 0, a.center, a.overview) -
    tilePriority(b.lod, b.tx, b.tz, b.visible, b.attempts || 0, b.center, b.overview)
  );
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

  if (built) pruneTileCache();
  updateChunkPill();

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

function versionAtLeast(version, minimum) {
  const current = String(version || "0").split(".").map(Number);
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
