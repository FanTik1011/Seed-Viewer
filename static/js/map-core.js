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

function tileKey(lod, tx, tz) {
  return `${lod}:${tx},${tz}`;
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

function activeStructureTypes() {
  return Object.keys(STRUCT_META)
    .filter(key => key !== "spawn" && key !== "Stronghold")
    .filter(key => state.vis[key] && isFeatureAvailable(key));
}

function usesLegacyBiomeLayers(version = state.version) {
  return ["1.16", "1.17"].includes(version);
}

function applyVersionLods(version = state.version) {
  LODS = usesLegacyBiomeLayers(version) ? LEGACY_LODS : MODERN_LODS;
}

function featureDataLoaded(key) {
  if (key === "spawn") return !!state.structures.spawn;
  if (key === "Stronghold") return Array.isArray(state.structures.strongholds);
  return Array.isArray(state.structures[key]);
}

function requestRender() {
  if (raf) return;
  raf = requestAnimationFrame(render);
}

function resetUiCaches() {
  hudCache = "";
  selectedPanelCache = "";
  chunkPillCache = "";
}

function invalidateMarkers() {
  if (frozenMarkerSnapshot) {
    markerRefreshPending = true;
    return;
  }
  markerCache = null;
}

function freezeMarkers() {
  if (frozenMarkerSnapshot) return;
  frozenMarkerSnapshot = markerCache || lastMarkerSnapshot;
  if (!frozenMarkerSnapshot || !frozenMarkerSnapshot.length) {
    frozenMarkerSnapshot = buildMarkers();
    markerCache = frozenMarkerSnapshot;
    lastMarkerSnapshot = frozenMarkerSnapshot;
  }
}

function unfreezeMarkers() {
  if (!frozenMarkerSnapshot) return;
  frozenMarkerSnapshot = null;
  if (markerRefreshPending) {
    markerRefreshPending = false;
    markerCache = null;
    visibleMarkers();
    requestRender();
  }
}

function scheduleStructureStream(delay = 240, reset = false) {
  if (structureStreamTimer && !reset) return;
  clearTimeout(structureStreamTimer);
  if (!state.loaded) return;
  structureStreamTimer = setTimeout(() => {
    structureStreamTimer = 0;
    if (!mapIsMoving()) streamStructures();
    else scheduleStructureStream(260, true);
  }, delay);
}

function cancelMomentum() {
  if (momentumRaf) {
    cancelAnimationFrame(momentumRaf);
    momentumRaf = 0;
  }
}

function cancelZoomAnim() {
  if (zoomRaf) {
    cancelAnimationFrame(zoomRaf);
    zoomRaf = 0;
  }
}

function startZoomTo(target, sx = state.width / 2, sy = state.height / 2) {
  if (!state.loaded) return;
  cancelMomentum();
  clearTimeout(structureStreamTimer);
  freezeMarkers();
  const before = screenToWorld(sx, sy);
  state.zoomTarget = clamp(target, MIN_ZOOM, MAX_ZOOM);
  state.zoomAnchor = { sx, sy, wx: before.x, wz: before.z };
  if (!zoomRaf) zoomRaf = requestAnimationFrame(animateZoom);
}

function animateZoom() {
  const t = state.zoomTarget;
  const diff = t - state.zoom;
  if (Math.abs(diff) <= Math.max(0.0008, t * 0.004)) {
    state.zoom = t;
    zoomRaf = 0;
    unfreezeMarkers();
    loadVisibleStructuresNow();
  } else {
    state.zoom += diff * ZOOM_EASE;
    zoomRaf = requestAnimationFrame(animateZoom);
  }
  const a = state.zoomAnchor;
  if (a) {
    state.viewX = a.wx - (a.sx - state.width / 2) * state.zoom;
    state.viewZ = a.wz - (a.sy - state.height / 2) * state.zoom;
  }
  scheduleUrlUpdate();
  primeVisibleBiomeTiles();
  requestRender();
}

function startMomentum(vx, vz) {
  cancelMomentum();
  if (Math.hypot(vx, vz) < 0.015) {
    unfreezeMarkers();
    loadVisibleStructuresNow();
    return;
  }
  let last = performance.now();
  const step = ts => {
    const dt = Math.min(40, ts - last);
    last = ts;
    state.viewX += vx * dt;
    state.viewZ += vz * dt;
    const f = Math.pow(PAN_FRICTION, dt / 16.67);
    vx *= f;
    vz *= f;
    scheduleUrlUpdate();
    primeVisibleBiomeTiles();
    requestRender();
    if (Math.hypot(vx, vz) > 0.01) {
      momentumRaf = requestAnimationFrame(step);
    } else {
      momentumRaf = 0;
      unfreezeMarkers();
      loadVisibleStructuresNow();
    }
  };
  freezeMarkers();
  momentumRaf = requestAnimationFrame(step);
}

function zoomToSlider(z) {
  return Math.log(z / MIN_ZOOM) / Math.log(MAX_ZOOM / MIN_ZOOM);
}

function sliderToZoom(t) {
  return MIN_ZOOM * Math.pow(MAX_ZOOM / MIN_ZOOM, clamp(t, 0, 1));
}

function setZoomImmediate(z) {
  cancelZoomAnim();
  state.zoom = clamp(z, MIN_ZOOM, MAX_ZOOM);
  state.zoomTarget = state.zoom;
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

function pickLod() {
  const wWorld = state.width * state.zoom;
  const hWorld = state.height * state.zoom;
  for (let i = 0; i < LODS.length - 1; i++) {
    const b = LODS[i].blocks;
    const count = (Math.ceil(wWorld / b) + 3) * (Math.ceil(hWorld / b) + 3);
    if (count <= MAX_DRAW_TILES) return i;
  }
  return LODS.length - 1;
}

function biomeTileRange(lod) {
  const b = LODS[lod].blocks;
  const tl = screenToWorld(0, 0);
  const br = screenToWorld(state.width, state.height);
  const range = {
    lod,
    blocks: b,
    txMin: Math.floor(tl.x / b) - TILE_VIEW_MARGIN,
    txMax: Math.floor(br.x / b) + TILE_VIEW_MARGIN,
    tzMin: Math.floor(tl.z / b) - TILE_VIEW_MARGIN,
    tzMax: Math.floor(br.z / b) + TILE_VIEW_MARGIN
  };
  range.count = (range.txMax - range.txMin + 1) * (range.tzMax - range.tzMin + 1);
  range.tilePx = b / state.zoom;
  return range;
}
