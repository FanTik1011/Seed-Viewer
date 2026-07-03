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
  updateEditionLabel(version);
  state.loaded = false;
  resetUiCaches();
  cancelWorldWorkerJobs();
  cancelAllTileRequests();
  clearTimeout(zoomTileSettleTimer);
  zoomTileSettleTimer = 0;
  zoomTileLoadingPaused = false;
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
    state.zoom = Number.isFinite(options.zoom) ? clampMapZoom(options.zoom) : clampMapZoom(DEFAULT_ZOOM);
    state.zoomTarget = state.zoom;
    cancelZoomAnim();
    cancelMomentum();
    if (data.spawn) selectLocation({ type:"spawn", ...data.spawn, ...STRUCT_META.spawn });
    els.activeSeed.textContent = seed;
    els.seedCard.classList.add("visible");
    updateFavoriteButtons();
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

let lastStructBulk = null;
function loadVisibleStructuresNow() {
  if (!state.loaded || !dimensionCaps().structures || !activeStructureTypes().length) return;
  const radius = visibleStructureRadius();
  if (lastStructBulk && lastStructBulk.runId === state.runId) {
    const moved = Math.hypot(state.viewX - lastStructBulk.x, state.viewZ - lastStructBulk.z);

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

function streamStructures() {
  if (!state.loaded || !dimensionCaps().structures) return;
  if (!activeStructureTypes().length) return;
  const view = structRegionRange();

  const ccx = Math.round((view.rxMin + view.rxMax) / 2);
  const ccz = Math.round((view.rzMin + view.rzMax) / 2);
  const r = {
    rxMin: Math.max(view.rxMin, ccx - STRUCT_KEEP_RADIUS),
    rxMax: Math.min(view.rxMax, ccx + STRUCT_KEEP_RADIUS),
    rzMin: Math.max(view.rzMin, ccz - STRUCT_KEEP_RADIUS),
    rzMax: Math.min(view.rzMax, ccz + STRUCT_KEEP_RADIUS)
  };

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
      state.structFetched.add(key); 
      structRegionQueue.push({ rx, rz, key });
    }
  }
  drainStructureRegions();
}

function drainStructureRegions() {
  if (structRegionInFlight >= MAX_STRUCT_REGION_REQUESTS || !structRegionQueue.length) return;

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

        if (runId !== state.runId || err?.name === "AbortError") return;
        state.structFetched.delete(job.key); 
        console.warn("Structure region failed", err);
      })
      .finally(() => {

        structRegionInFlight = Math.max(0, structRegionInFlight - 1);
        drainStructureRegions();
      });
  }
}

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

function scheduleSidebarRefresh() {
  clearTimeout(sidebarRefreshTimer);
  sidebarRefreshTimer = setTimeout(() => {
    if (state.loaded) buildSidebar();
  }, 220);
}
