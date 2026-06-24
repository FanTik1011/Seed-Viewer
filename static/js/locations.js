function villageLabelAt(x, z) {
  const biome = biomeAt(x, z);
  if (!biome || biome === "Biome loading" || biome === "Biome unavailable") return STRUCT_META.Village.label;
  const rule = VILLAGE_LABEL_RULES.find(item => item.match(biome));
  return rule ? rule.label : "Plains Village";
}

function markerMetaFor(key, point) {
  const meta = STRUCT_META[key];
  if (key !== "Village") return meta;

  if (!point._label || point._label === STRUCT_META.Village.label) {
    point._label = villageLabelAt(point.x, point.z);
  }
  return { ...meta, label: point._label };
}

function buildMarkers() {
  const markers = [];
  if (state.vis.spawn && isFeatureAvailable("spawn") && state.structures.spawn) {
    markers.push({ type:"spawn", ...state.structures.spawn, ...STRUCT_META.spawn });
  }
  if (state.vis.Stronghold && isFeatureAvailable("Stronghold") && Array.isArray(state.structures.strongholds)) {
    for (const sh of state.structures.strongholds) {
      markers.push({ type:"Stronghold", x:sh.x, z:sh.z, ring:sh.ring, ...STRUCT_META.Stronghold });
    }
  }
  for (const key of Object.keys(STRUCT_META)) {
    if (key === "spawn" || key === "Stronghold" || !state.vis[key]) continue;
    if (!isFeatureAvailable(key)) continue;
    const list = state.structures[key];
    if (!Array.isArray(list)) continue;
    for (const point of list) markers.push({ type:key, x:point.x, z:point.z, ...markerMetaFor(key, point) });
  }
  return markers;
}

function visibleMarkers() {
  if (frozenMarkerSnapshot) return frozenMarkerSnapshot;
  if (markerCache) return markerCache;
  if (mapIsMoving() && lastMarkerSnapshot.length) return lastMarkerSnapshot;
  markerCache = buildMarkers();
  lastMarkerSnapshot = markerCache;
  return markerCache;
}

function nearestMarker(mx, my) {
  let best = null;
  let bestDist = 18;
  for (const marker of visibleMarkers()) {
    if (shouldHideDenseMarker(marker)) continue;
    const p = worldToScreen(marker.x, marker.z);
    const dist = Math.hypot(p.x - mx, p.y - my);
    if (dist < bestDist) {
      bestDist = dist;
      best = marker;
    }
  }
  return best;
}

function updateHud() {
  const zoomText = state.zoom.toFixed(state.zoom < 10 ? 1 : 0);
  const key = `${state.cursor.x}|${state.cursor.z}|${zoomText}`;
  if (key === hudCache) return;
  hudCache = key;
  if (els.coordX) els.coordX.textContent = state.cursor.x;
  if (els.coordZ) els.coordZ.textContent = state.cursor.z;
  if (els.zoomLabel) els.zoomLabel.textContent = zoomText;
  if (els.zoomRange && document.activeElement !== els.zoomRange) {
    els.zoomRange.value = String(zoomToSlider(state.zoom));
  }
}

function updateChunkPill() {
  const n = state.pendingTiles.size + state.tileQueue.size;
  const visible = state.loaded && n > 0;
  const text = n === 1 ? "Loading 1 chunk" : `Loading ${n} chunks`;
  const key = `${visible}|${text}`;
  if (key === chunkPillCache) return;
  chunkPillCache = key;
  els.chunkPill.classList.toggle("visible", visible);
  els.chunkLabel.textContent = text;
}

function biomeAt(wx, wz) {
  if (!dimensionCaps().biomes) return state.dimension === "nether" ? "Nether preview" : state.dimension === "end" ? "End preview" : "Biome unavailable";
  for (let lod = 0; lod < LODS.length; lod++) {
    const cfg = LODS[lod];
    const tx = Math.floor(wx / cfg.blocks);
    const tz = Math.floor(wz / cfg.blocks);
    const tile = state.tiles.get(tileKey(lod, tx, tz));
    if (!tile) continue;
    const localX = Math.floor((wx - tx * cfg.blocks) / cfg.scale);
    const localZ = Math.floor((wz - tz * cfg.blocks) / cfg.scale);
    const id = tile.grid[localZ * cfg.samples + localX];
    return biomeName(id);
  }
  return "Biome loading";
}

function selectLocation(location, screenPoint = null) {
  state.selected = {
    type: location.type || "point",
    label: location.label || "Selected point",
    icon: location.icon || "target",
    asset: location.asset || "",
    color: location.color || "#edf3ee",
    x: Math.round(location.x),
    z: Math.round(location.z),
    ring: location.ring
  };
  updateSelectedPanel();
  updateGoInputs(state.selected);
  if (screenPoint) openLocationPopover(screenPoint.x, screenPoint.y);
  requestRender();
}

function selectedPoint() {
  if (state.selected) return state.selected;
  if (state.structures.spawn) {
    return { type:"spawn", ...state.structures.spawn, ...STRUCT_META.spawn };
  }
  return { type:"point", label:"Map cursor", icon:"target", color:"#edf3ee", ...state.cursor };
}

function updateSelectedPanel() {
  const point = selectedPoint();
  if (!point || !els.selectedLabel) return;
  const chunkX = Math.floor(point.x / 16);
  const chunkZ = Math.floor(point.z / 16);
  const label = point.ring ? `${point.label} ring ${point.ring}` : point.label;
  const biome = state.loaded ? biomeAt(point.x, point.z) : "-";
  const key = `${point.type}|${label}|${point.icon}|${point.asset || ""}|${point.color}|${point.x}|${point.z}|${chunkX}|${chunkZ}|${biome}`;
  if (key === selectedPanelCache) return;
  selectedPanelCache = key;
  els.selectedIcon.style.setProperty("--icon", point.color);
  els.selectedIcon.innerHTML = iconMarkup(point.icon, point.asset);
  els.selectedLabel.textContent = label;
  els.selectedX.textContent = point.x;
  els.selectedZ.textContent = point.z;
  els.selectedChunk.textContent = `${chunkX}, ${chunkZ}`;
  els.selectedBiome.textContent = biome;
  updatePopover();
}

function updateGoInputs(point) {
  if (!point || document.activeElement === els.gotoX || document.activeElement === els.gotoZ) return;
  els.gotoX.value = Math.round(point.x);
  els.gotoZ.value = Math.round(point.z);
}

function openLocationPopover(sx, sy) {
  updatePopover();
  const w = 258;
  const h = 142;
  els.popover.style.left = `${Math.min(Math.max(12, sx + 16), state.width - w - 12)}px`;
  els.popover.style.top = `${Math.min(Math.max(12, sy + 16), state.height - h - 12)}px`;
  els.popover.classList.add("visible");
}

function closeLocationPopover() {
  els.popover.classList.remove("visible");
}

function updatePopover() {
  if (!els.popover || !state.selected) return;
  const point = selectedPoint();
  const chunkX = Math.floor(point.x / 16);
  const chunkZ = Math.floor(point.z / 16);
  const label = point.ring ? `${point.label} ring ${point.ring}` : point.label;
  els.popoverIcon.style.setProperty("--icon", point.color);
  els.popoverIcon.innerHTML = iconMarkup(point.icon, point.asset);
  els.popoverLabel.textContent = label;
  els.popoverCoords.textContent = `${point.x}, ${point.z}`;
  els.popoverChunk.textContent = `${chunkX}, ${chunkZ}`;
  els.popoverBiome.textContent = state.loaded ? biomeAt(point.x, point.z) : "-";
}

function biomeCatalog() {
  return Object.keys(BIOME_NAMES)
    .map(id => ({ id, label: biomeName(Number(id)), color: BIOME_COLORS[id] || "#5f6b6a" }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function buildBiomeSelect() {
  if (!els.finderBiome) return;
  if (els.finderBiome.dataset.version === state.version && els.finderBiome.options.length) return;
  const current = els.finderBiome.value;
  els.finderBiome.innerHTML = "";
  for (const biome of biomeCatalog()) {
    const option = document.createElement("option");
    option.value = biome.id;
    option.textContent = biome.label;
    els.finderBiome.append(option);
  }
  if (current && [...els.finderBiome.options].some(option => option.value === current)) {
    els.finderBiome.value = current;
  }
  els.finderBiome.dataset.version = state.version;
}

function buildFinderStructureSelect() {
  if (!els.finderStructure) return;
  const current = els.finderStructure.value;
  els.finderStructure.innerHTML = "";
  const none = document.createElement("option");
  none.value = "";
  none.textContent = "Any / no structure";
  els.finderStructure.append(none);
  for (const feature of FEATURE_CATALOG) {
    if (!feature.supported || feature.key === "spawn" || feature.key === "Stronghold") continue;
    if (!isFeatureAvailable(feature.key)) continue;
    const meta = STRUCT_META[feature.key];
    if (!meta) continue;
    const option = document.createElement("option");
    option.value = feature.key;
    option.textContent = meta.label;
    els.finderStructure.append(option);
  }
  const preferred = current || "Village";
  if ([...els.finderStructure.options].some(option => option.value === preferred)) {
    els.finderStructure.value = preferred;
  }
}

function updateFinderHint() {
  if (!els.finderStatus || state.finderBusy) return;
  if (state.finderResults.length) return;
  const biome = biomeName(Number(els.finderBiome.value || 1));
  const structure = els.finderStructure?.value ? els.finderStructure.selectedOptions[0].textContent : "no required structure";
  els.finderStatus.textContent = `Will look for ${biome} and ${structure} near spawn.`;
}

async function searchMatchingSeeds() {
  const biomeId = Number(els.finderBiome.value || 1);
  const structure = els.finderStructure.value || "";
  const biomeRadius = 1500;
  const structureRadius = 1500;
  const attempts = 100;
  state.finderBusy = true;
  els.finderBtn.disabled = true;
  els.finderStatus.textContent = "Searching good seeds...";
  els.finderResults.innerHTML = "";
  try {
    const data = await workerRequest("searchSeeds", {
      version: els.version.value,
      attempts,
      biomeRadius,
      structureRadius,
      radius: Math.max(biomeRadius, structureRadius),
      limit: 8,
      required: structure,
      biomes: String(biomeId)
    });
    state.finderResults = data.results || [];
    renderSeedSearchResults(data);
  } catch (err) {
    console.error(err);
    els.finderStatus.textContent = "Seed search failed.";
    showToast("Seed search failed");
  } finally {
    state.finderBusy = false;
    els.finderBtn.disabled = false;
  }
}

function renderSeedSearchResults(data) {
  const biomeId = String(data.biomes?.[0] ?? els.finderBiome.value);
  const biomeLabel = biomeName(Number(biomeId));
  const structure = data.required?.[0] || "";
  const count = data.results?.length || 0;
  els.finderStatus.textContent = count
    ? `${count} good seed${count === 1 ? "" : "s"} found. Best result is first.`
    : "No good seed found this time. Press Find seeds again.";
  els.finderResults.innerHTML = "";
  if (!count) return;
  for (const item of data.results) {
    const biomePoint = item.biomes?.[biomeId]?.[0];
    const structPoint = structure ? item.structures?.[structure]?.[0] : null;
    const structLabel = structure ? STRUCT_META[structure]?.label || structure : "No structure";
    const card = document.createElement("div");
    card.className = "seed-result-card";
    card.innerHTML = `
      <div class="seed-result-head">
        <span class="seed-mono">${item.seed}</span>
        <button class="mini-link load-seed" type="button">Load</button>
      </div>
      <div class="seed-result-meta">
        <span>Spawn <b>${item.spawn.x}, ${item.spawn.z}</b></span>
        <span>${biomeLabel} <b>${item.nearestBiomes?.[biomeId] ?? "-"}m</b>${biomePoint ? ` at ${biomePoint.x}, ${biomePoint.z}` : ""}</span>
        <span>${structLabel} <b>${structure ? (item.nearest?.[structure] ?? "-") + "m" : "off"}</b>${structPoint ? ` at ${structPoint.x}, ${structPoint.z}` : ""}</span>
      </div>
    `;
    card.querySelector(".load-seed").addEventListener("click", () => {
      els.seedInput.value = item.seed;
      loadWorld({
        seed: item.seed,
        version: els.version.value,
        dimension: "overworld",
        centerX: biomePoint?.x ?? item.spawn.x,
        centerZ: biomePoint?.z ?? item.spawn.z,
        zoom: Math.min(state.zoom || DEFAULT_ZOOM, DEFAULT_ZOOM)
      });
      showToast("Seed loaded");
    });
    els.finderResults.append(card);
  }
}

function setAllBiomes(active) {
  for (const id of Object.keys(state.biomeVis)) state.biomeVis[id] = active;
  rebuildBiomeTileCanvases();
  buildSidebar();
}

function toggleBiome(id) {
  state.biomeVis[id] = !state.biomeVis[id];
  rebuildBiomeTileCanvases();
  buildSidebar();
}

function buildSidebar() {
  invalidateMarkers();
  buildBiomeSelect();
  buildFinderStructureSelect();
  els.layerList.innerHTML = "";
  els.layerList.append(
    makeLayerRow("layers", "Biomes", "#57d68d", null, state.showBiomes, () => {
      state.showBiomes = !state.showBiomes;
      buildSidebar();
      requestRender();
    }),
    makeLayerRow("target", "Grid Lines", "#5cc8f2", null, state.showGrid, () => {
      state.showGrid = !state.showGrid;
      buildSidebar();
      requestRender();
    })
  );

  els.structList.innerHTML = "";
  let total = 0;
  for (const feature of FEATURE_CATALOG) {
    const key = feature.key;
    const meta = feature.supported ? STRUCT_META[key] : feature;
    if (!meta) continue;
    const available = feature.supported && isFeatureAvailable(key);
    const hasData = featureDataLoaded(key);
    const count = hasData ? structureCount(key) : null;
    if (available) total += count;
    els.structList.append(makeLayerRow(meta.icon, meta.label, meta.color, available ? count : null, available ? state.vis[key] : false, () => toggleFeature(key, meta, available), { disabled: !available, asset: meta.asset }));
  }
  els.structTotal.textContent = total;

  els.biomeList.innerHTML = "";
  for (const biome of biomeCatalog()) {
    els.biomeList.append(makeBiomeRow(biome));
  }
  updateFinderHint();
}

async function toggleFeature(key, meta, available) {
  if (!available) {
    showToast(`${meta.label} is not available for ${state.version} ${state.dimension}`);
    return;
  }
  const next = !state.vis[key];
  state.vis[key] = next;
  buildSidebar();
  requestRender();
  if (!next || !state.loaded || key === "spawn" || key === "Stronghold") return;

  state.structFetched = new Set();
  const radius = visibleStructureRadius();
  markRegionsFetched(state.viewX, state.viewZ, radius);
  startVisibleStructureBulk(state.runId, state.viewX, state.viewZ, radius);
  scheduleStructureStream(160, true);
}

function setAllFeatures(active) {
  for (const feature of FEATURE_CATALOG) {
    if (feature.supported && feature.key in state.vis && isFeatureAvailable(feature.key)) state.vis[feature.key] = active;
  }
  buildSidebar();
  requestRender();
  if (active && state.loaded) {
    state.structFetched = new Set();
    const radius = visibleStructureRadius();
    markRegionsFetched(state.viewX, state.viewZ, radius);
    startVisibleStructureBulk(state.runId, state.viewX, state.viewZ, radius);
    scheduleStructureStream(160, true);
  }
}

function structureCount(key) {
  if (key === "spawn") return state.structures.spawn ? 1 : 0;
  if (key === "Stronghold") return Array.isArray(state.structures.strongholds) ? state.structures.strongholds.length : 0;
  return Array.isArray(state.structures[key]) ? state.structures[key].length : 0;
}

function makeLayerRow(iconName, label, color, count, active, onClick, options = {}) {
  const row = document.createElement("button");
  row.className = `layer-row ${active ? "" : "is-off"} ${options.disabled ? "is-disabled" : ""}`;
  row.type = "button";
  row.title = options.disabled ? `${label} is not available in this build yet` : label;
  if (options.disabled) row.setAttribute("aria-disabled", "true");
  row.style.setProperty("--icon", color);
  row.innerHTML = `
    <span class="layer-icon">${iconMarkup(iconName, options.asset)}</span>
    <span class="layer-label">${label}</span>
    ${count == null ? `<span class="count muted">-</span>` : `<span class="count">${count}</span>`}
    <span class="switch ${active ? "on" : ""}"></span>
  `;
  row.addEventListener("click", onClick);
  return row;
}

function makeBiomeRow(biome) {
  const row = document.createElement("button");
  const active = state.biomeVis[biome.id] !== false;
  row.className = `layer-row biome-row ${active ? "" : "is-off"}`;
  row.type = "button";
  row.title = biome.label;
  row.style.setProperty("--icon", biome.color);
  row.innerHTML = `
    <span class="biome-swatch" style="background:${biome.color}"></span>
    <span class="layer-label">${biome.label}</span>
    <span class="switch ${active ? "on" : ""}"></span>
  `;
  row.addEventListener("click", () => toggleBiome(biome.id));
  return row;
}
