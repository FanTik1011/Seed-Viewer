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
    const grid = tile.displayGrid || tile.grid;
    const id = grid[localZ * cfg.samples + localX];
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

function buildFinderBiomePicker() {
  if (!els.finderBiomeList) return;
  const known = new Set(Object.keys(BIOME_NAMES));
  state.finderBiomes = new Set([...state.finderBiomes].filter(id => known.has(String(id))));
  const filter = finderFilterText(els.finderBiomeFilter);
  const biomes = biomeCatalog()
    .filter(biome => !filter || biome.label.toLowerCase().includes(filter))
    .sort((a, b) => Number(state.finderBiomes.has(b.id)) - Number(state.finderBiomes.has(a.id)) || a.label.localeCompare(b.label));
  els.finderBiomeList.innerHTML = "";
  for (const biome of biomes) {
    els.finderBiomeList.append(makeFinderChip({
      value: biome.id,
      label: biome.label,
      color: biome.color,
      selected: state.finderBiomes.has(biome.id),
      onClick: () => toggleFinderBiome(biome.id)
    }));
  }
  if (!biomes.length) els.finderBiomeList.append(makeFinderEmpty("No matching biomes"));
  updateFinderSummary();
}

function buildFinderStructurePicker() {
  if (!els.finderStructureList) return;
  const filter = finderFilterText(els.finderStructureFilter);
  const options = finderStructureOptions()
    .filter(item => !filter || item.meta.label.toLowerCase().includes(filter))
    .sort((a, b) => Number(state.finderStructures.has(b.key)) - Number(state.finderStructures.has(a.key)) || a.meta.label.localeCompare(b.meta.label));
  const available = new Set(options.map(item => item.key));
  const allAvailable = new Set(finderStructureOptions().map(item => item.key));
  state.finderStructures = new Map([...state.finderStructures].filter(([key, count]) => allAvailable.has(key) && count > 0));
  els.finderStructureList.innerHTML = "";
  for (const item of options) {
    const count = state.finderStructures.get(item.key) || 0;
    els.finderStructureList.append(makeFinderChip({
      value: item.key,
      label: item.meta.label,
      color: item.meta.color,
      icon: item.meta.icon,
      asset: item.meta.asset,
      selected: count > 0,
      count,
      onClick: () => addFinderStructure(item.key),
      onRemove: () => removeFinderStructure(item.key)
    }));
  }
  if (!options.length) els.finderStructureList.append(makeFinderEmpty("No matching structures"));
  updateFinderSummary();
}

function finderStructureOptions() {
  return FEATURE_CATALOG
    .filter(feature => feature.supported && feature.key !== "spawn" && feature.key !== "Stronghold")
    .filter(feature => isFeatureAvailable(feature.key))
    .map(feature => ({ key: feature.key, meta: STRUCT_META[feature.key] }))
    .filter(item => item.meta);
}

function makeFinderChip({ value, label, color, icon, asset, selected, count = 0, onClick, onRemove }) {
  const chipLabel = count > 1 ? `${label} x${count}` : label;
  const chip = document.createElement("button");
  chip.className = `finder-chip ${selected ? "is-selected" : ""}`;
  chip.type = "button";
  chip.title = selected ? `Add another ${label}` : `Add ${label}`;
  chip.setAttribute("aria-pressed", selected ? "true" : "false");
  chip.style.setProperty("--chip", color || "#8cff63");
  chip.innerHTML = `
    <span class="${asset || icon ? "finder-chip-icon" : "finder-chip-dot"}">${asset || icon ? iconMarkup(icon || "target", asset) : ""}</span>
    <span class="finder-chip-label">${chipLabel}</span>
    ${count > 1 ? `<span class="finder-chip-count">x${count}</span>` : ""}
  `;
  chip.addEventListener("click", onClick);
  if (!onRemove || !selected) return chip;

  const wrap = document.createElement("span");
  wrap.className = "finder-chip-wrap";
  wrap.style.setProperty("--chip", color || "#8cff63");
  const remove = document.createElement("button");
  remove.className = "finder-chip-minus";
  remove.type = "button";
  remove.title = `Remove one ${label}`;
  remove.textContent = "-";
  remove.addEventListener("click", event => {
    event.stopPropagation();
    onRemove();
  });
  wrap.append(chip, remove);
  return wrap;
}

function makeFinderEmpty(text) {
  const item = document.createElement("div");
  item.className = "finder-empty";
  item.textContent = text;
  return item;
}

function finderFilterText(input) {
  return String(input?.value || "").trim().toLowerCase();
}

function clearFinderResults() {
  state.finderResults = [];
  if (els.finderResults) els.finderResults.innerHTML = "";
}

function toggleFinderBiome(id) {
  if (state.finderBiomes.has(id)) state.finderBiomes.delete(id);
  else state.finderBiomes.add(id);
  clearFinderResults();
  buildFinderBiomePicker();
  updateFinderHint();
}

function addFinderStructure(key) {
  const next = Math.min((state.finderStructures.get(key) || 0) + 1, 8);
  state.finderStructures.set(key, next);
  clearFinderResults();
  buildFinderStructurePicker();
  updateFinderHint();
}

function removeFinderStructure(key) {
  const next = (state.finderStructures.get(key) || 0) - 1;
  if (next > 0) state.finderStructures.set(key, next);
  else state.finderStructures.delete(key);
  clearFinderResults();
  buildFinderStructurePicker();
  updateFinderHint();
}

function finderRadius() {
  const value = Number(els.finderRadius?.value || 1500);
  return clamp(Number.isFinite(value) ? Math.round(value) : 1500, 256, 6000);
}

function finderAttempts() {
  const value = Number(els.finderAttempts?.value || 100);
  return clamp(Number.isFinite(value) ? Math.round(value) : 100, 1, 250);
}

function setFinderRadius(value) {
  if (!els.finderRadius) return;
  els.finderRadius.value = finderRadiusValue(value);
  clearFinderResults();
  updateFinderHint();
}

function finderRadiusValue(value) {
  return clamp(Number.isFinite(Number(value)) ? Math.round(Number(value)) : 1500, 256, 6000);
}

function updateFinderRadiusPresetState() {
  if (!els.finderRadiusPresets) return;
  const radius = finderRadius();
  for (const btn of els.finderRadiusPresets.querySelectorAll("[data-radius]")) {
    btn.classList.toggle("is-active", Number(btn.dataset.radius) === radius);
  }
}

function updateFinderHint() {
  if (!els.finderStatus || state.finderBusy) return;
  if (state.finderResults.length) return;
  const biomeCount = state.finderBiomes.size;
  const structureCount = finderStructureTotal();
  const parts = [];
  if (biomeCount) parts.push(`${biomeCount} biome${biomeCount === 1 ? "" : "s"}`);
  if (structureCount) parts.push(`${structureCount} structure${structureCount === 1 ? "" : "s"}`);
  els.finderStatus.textContent = parts.length
    ? `Looking for ${parts.join(" + ")} within ${finderRadius()} blocks. ${finderAttempts()} seeds per run.`
    : "Pick at least one biome or structure.";
  updateFinderSummary();
  updateFinderRadiusPresetState();
}

async function searchMatchingSeeds() {
  const biomeIds = [...state.finderBiomes];
  const structures = finderStructureRequestList();
  if (!biomeIds.length && !structures.length) {
    showToast("Pick at least one target");
    updateFinderHint();
    return;
  }
  const radius = finderRadius();
  if (els.finderRadius) els.finderRadius.value = radius;
  const biomeRadius = radius;
  const structureRadius = radius;
  const attempts = finderAttempts();
  state.finderBusy = true;
  els.finderBtn.disabled = true;
  els.finderStatus.textContent = `Searching ${attempts} seeds within ${radius} blocks...`;
  els.finderResults.innerHTML = "";
  try {
    const data = await workerRequest("searchSeeds", {
      version: els.version.value,
      attempts,
      biomeRadius,
      structureRadius,
      radius: Math.max(biomeRadius, structureRadius),
      limit: 8,
      required: structures.join(","),
      biomes: biomeIds.join(",")
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
  const biomeIds = (data.biomes || []).map(String);
  const structures = structureCountsFromList(data.required || []);
  const structureEntries = [...structures.entries()];
  const count = data.results?.length || 0;
  els.finderStatus.textContent = count
    ? `${count} good seed${count === 1 ? "" : "s"} found. Best match is first.`
    : "No good seed found this time. Press Find seeds again.";
  els.finderResults.innerHTML = "";
  if (!count) return;
  for (const item of data.results) {
    const biomeLines = biomeIds.map(id => {
      const point = item.biomes?.[id]?.[0];
      return finderResultLine(biomeName(Number(id)), item.nearestBiomes?.[id], point);
    }).join("");
    const structureLines = structureEntries.map(([key, needed]) => {
      const points = item.structures?.[key] || [];
      const label = needed > 1 ? `${STRUCT_META[key]?.label || key} x${needed}` : STRUCT_META[key]?.label || key;
      return finderResultLine(label, item.nearest?.[key], points[0], points.length);
    }).join("");
    const firstBiomePoint = biomeIds.map(id => item.biomes?.[id]?.[0]).find(Boolean);
    const firstStructPoint = structureEntries.map(([key]) => item.structures?.[key]?.[0]).find(Boolean);
    const center = firstBiomePoint || firstStructPoint || item.spawn;
    const card = document.createElement("div");
    card.className = "seed-result-card";
    card.innerHTML = `
      <div class="seed-result-head">
        <span class="seed-mono">${item.seed}</span>
        <button class="mini-link load-seed" type="button">Load</button>
      </div>
      <div class="seed-result-meta">
        <span>Spawn <b>${item.spawn.x}, ${item.spawn.z}</b></span>
        ${biomeLines}
        ${structureLines}
      </div>
    `;
    card.querySelector(".load-seed").addEventListener("click", () => {
      els.seedInput.value = item.seed;
      loadWorld({
        seed: item.seed,
        version: els.version.value,
        dimension: "overworld",
        centerX: center.x,
        centerZ: center.z,
        zoom: Math.min(state.zoom || DEFAULT_ZOOM, DEFAULT_ZOOM)
      });
      showToast("Seed loaded");
    });
    els.finderResults.append(card);
  }
}

function finderResultLine(label, distance, point, foundCount = 0) {
  const dist = distance == null ? "-" : `${distance}m`;
  const count = foundCount > 1 ? ` (${foundCount} found)` : "";
  const coords = point ? ` at ${point.x}, ${point.z}` : "";
  return `<span>${label} <b>${dist}</b>${count}${coords}</span>`;
}

function finderStructureTotal() {
  return [...state.finderStructures.values()].reduce((sum, count) => sum + count, 0);
}

function updateFinderSummary() {
  if (!els.finderSummary) return;
  const chips = [];
  for (const id of state.finderBiomes) {
    const color = BIOME_COLORS[id] || "#8cff63";
    chips.push({ type: "biome", key: id, label: biomeName(Number(id)), color });
  }
  for (const [key, count] of state.finderStructures) {
    const meta = STRUCT_META[key];
    if (!meta) continue;
    chips.push({ type: "structure", key, label: count > 1 ? `${meta.label} x${count}` : meta.label, color: meta.color });
  }
  els.finderSummary.innerHTML = "";
  els.finderSummary.classList.toggle("is-empty", chips.length === 0);
  if (!chips.length) {
    els.finderSummary.textContent = "No targets selected";
    return;
  }
  for (const item of chips) {
    const chip = document.createElement("button");
    chip.className = "finder-summary-chip";
    chip.type = "button";
    chip.style.setProperty("--chip", item.color);
    chip.title = `Remove ${item.label}`;
    chip.innerHTML = `<span></span><b>${item.label}</b>`;
    chip.addEventListener("click", () => {
      if (item.type === "biome") state.finderBiomes.delete(item.key);
      else state.finderStructures.delete(item.key);
      clearFinderResults();
      buildFinderBiomePicker();
      buildFinderStructurePicker();
      updateFinderHint();
    });
    els.finderSummary.append(chip);
  }
}

function finderStructureRequestList() {
  const list = [];
  for (const [key, count] of state.finderStructures) {
    for (let i = 0; i < count; i++) list.push(key);
  }
  return list;
}

function structureCountsFromList(list) {
  const counts = new Map();
  for (const key of list) counts.set(key, (counts.get(key) || 0) + 1);
  return counts;
}

function setAllBiomes(active) {
  for (const id of Object.keys(state.biomeVis)) state.biomeVis[id] = true;
  state.highlightedBiome = null;
  rebuildBiomeTileCanvases();
  buildSidebar();
  if (!active) showToast("Biome highlight cleared");
}

function toggleBiome(id) {
  for (const biomeId of Object.keys(state.biomeVis)) state.biomeVis[biomeId] = true;
  if (isCaveBiomeId(id)) {
    state.highlightedBiome = null;
    rebuildBiomeTileCanvases();
    buildSidebar();
    showToast(`${biomeName(Number(id))} is hidden on surface map`);
    return;
  }
  state.highlightedBiome = state.highlightedBiome === id ? null : id;
  rebuildBiomeTileCanvases();
  buildSidebar();
  showToast(state.highlightedBiome ? `${biomeName(Number(id))} highlighted` : "Biome highlight cleared");
}

function buildSidebar() {
  invalidateMarkers();
  buildFinderBiomePicker();
  buildFinderStructurePicker();
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
  const highlighted = state.highlightedBiome === biome.id;
  row.className = `layer-row biome-row ${active ? "" : "is-off"} ${highlighted ? "is-highlighted" : ""}`;
  row.type = "button";
  row.title = highlighted ? `${biome.label} highlighted` : `Highlight ${biome.label}`;
  row.setAttribute("aria-pressed", highlighted ? "true" : "false");
  row.style.setProperty("--icon", biome.color);
  row.innerHTML = `
    <span class="biome-swatch" style="background:${biome.color}"></span>
    <span class="layer-label">${biome.label}</span>
    <span class="switch ${active ? "on" : ""}"></span>
  `;
  row.addEventListener("click", () => toggleBiome(biome.id));
  return row;
}
