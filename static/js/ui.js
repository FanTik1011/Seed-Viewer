async function randomSeed() {
  const data = await workerRequest("randomSeed", { version: els.version.value });
  els.seedInput.value = data.seed;
  loadWorld({ seed: data.seed, version: els.version.value, dimension: els.dimension.value });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function showLoader(title, text) {
  els.loaderTitle.textContent = title;
  els.loaderText.textContent = text;
  els.loader.classList.add("visible");
}

function hideLoader() {
  els.loader.classList.remove("visible");
}

function showToast(message) {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add("visible");
  toastTimer = setTimeout(() => els.toast.classList.remove("visible"), 1400);
}

async function copyText(text, message = "Copied") {
  try {
    await navigator.clipboard.writeText(String(text));
  } catch {
    const ta = document.createElement("textarea");
    ta.value = String(text);
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  showToast(message);
}

const FAVORITE_SEEDS_STORAGE_KEY = "seedmap.favoriteSeeds.v1";
const FAVORITE_SEEDS_LIMIT = 80;

function normalizeFavoriteSeed(seed) {
  return String(seed || "").trim();
}

function favoriteKey(seed, version, dimension) {
  return `${normalizeFavoriteSeed(seed)}|${version || "1.20"}|${dimension || "overworld"}`;
}

function currentFavoriteKey() {
  const seed = normalizeFavoriteSeed(els.seedInput.value || state.seed);
  if (!seed) return "";
  return favoriteKey(seed, els.version.value, els.dimension.value || "overworld");
}

function selectedOptionText(select) {
  return select?.selectedOptions?.[0]?.textContent?.trim() || select?.value || "";
}

function dimensionText(value) {
  return value === "nether" ? "Nether" : value === "end" ? "The End" : "Overworld";
}

function compactDate(value) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear());
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${day}.${month}.${year} ${hour}:${minute}`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function sanitizeFavorite(item) {
  const seed = normalizeFavoriteSeed(item?.seed);
  if (!seed) return null;
  const version = String(item.version || "1.20");
  const dimension = String(item.dimension || "overworld");
  return {
    key: favoriteKey(seed, version, dimension),
    seed,
    version,
    versionLabel: item.versionLabel || version,
    dimension,
    dimensionLabel: item.dimensionLabel || dimensionText(dimension),
    centerX: Number.isFinite(Number(item.centerX)) ? Math.round(Number(item.centerX)) : 0,
    centerZ: Number.isFinite(Number(item.centerZ)) ? Math.round(Number(item.centerZ)) : 0,
    zoom: Number.isFinite(Number(item.zoom)) ? Number(item.zoom) : DEFAULT_ZOOM,
    savedAt: item.savedAt || new Date().toISOString(),
    lastLoadedAt: item.lastLoadedAt || "",
    loadCount: Math.max(0, Number(item.loadCount) || 0)
  };
}

function readFavoriteSeeds() {
  try {
    const raw = JSON.parse(localStorage.getItem(FAVORITE_SEEDS_STORAGE_KEY) || "[]");
    const seen = new Set();
    state.favoriteSeeds = (Array.isArray(raw) ? raw : [])
      .map(sanitizeFavorite)
      .filter(item => item && !seen.has(item.key) && seen.add(item.key))
      .slice(0, FAVORITE_SEEDS_LIMIT);
  } catch {
    state.favoriteSeeds = [];
  }
}

function writeFavoriteSeeds() {
  try {
    localStorage.setItem(FAVORITE_SEEDS_STORAGE_KEY, JSON.stringify(state.favoriteSeeds.slice(0, FAVORITE_SEEDS_LIMIT)));
  } catch {
    showToast("Favorites could not be saved");
  }
}

function favoriteSeedIndex(key = currentFavoriteKey()) {
  if (!key) return -1;
  return state.favoriteSeeds.findIndex(item => item.key === key);
}

function updateFavoriteButtons() {
  const active = favoriteSeedIndex() !== -1;
  [els.likeSeedBtn, els.likeActiveSeed].forEach(btn => {
    if (!btn) return;
    btn.classList.toggle("is-liked", active);
    btn.setAttribute("aria-pressed", String(active));
    btn.title = active ? "Remove from favorite seeds" : "Like current seed";
  });
  if (els.favoritesBtn) {
    const count = state.favoriteSeeds.length;
    els.favoritesBtn.dataset.count = String(count);
    els.favoritesBtn.classList.toggle("has-favorites", count > 0);
  }
}

function currentFavoritePayload() {
  const seed = normalizeFavoriteSeed(els.seedInput.value || state.seed);
  const version = els.version.value;
  const dimension = els.dimension.value || "overworld";
  const matchesLoadedWorld = state.loaded && state.seed === seed && state.version === version && state.dimension === dimension;
  const now = new Date().toISOString();
  return sanitizeFavorite({
    seed,
    version,
    versionLabel: selectedOptionText(els.version) || version,
    dimension,
    dimensionLabel: dimensionText(dimension),
    centerX: matchesLoadedWorld ? state.viewX : 0,
    centerZ: matchesLoadedWorld ? state.viewZ : 0,
    zoom: matchesLoadedWorld ? state.zoom : DEFAULT_ZOOM,
    savedAt: now,
    lastLoadedAt: matchesLoadedWorld ? now : "",
    loadCount: matchesLoadedWorld ? 1 : 0
  });
}

function toggleCurrentFavorite() {
  const item = currentFavoritePayload();
  if (!item) {
    showToast("Enter a seed first");
    return;
  }
  const index = favoriteSeedIndex(item.key);
  if (index >= 0) {
    state.favoriteSeeds.splice(index, 1);
    showToast("Removed from favorites");
  } else {
    state.favoriteSeeds.unshift(item);
    state.favoriteSeeds = state.favoriteSeeds.slice(0, FAVORITE_SEEDS_LIMIT);
    showToast("Seed liked");
  }
  writeFavoriteSeeds();
  renderFavoriteSeeds();
  updateFavoriteButtons();
}

function setFavoritesVisible(visible) {
  if (!els.favoritesPanel) return;
  if (visible && els.finderPanel && !els.finderPanel.classList.contains("is-hidden")) setFinderVisible(false);
  els.favoritesPanel.classList.toggle("is-hidden", !visible);
  els.favoritesPanel.setAttribute("aria-hidden", String(!visible));
  els.favoritesBtn?.setAttribute("aria-expanded", String(visible));
  document.body.classList.toggle("favorites-open", visible);
  if (visible) renderFavoriteSeeds();
}

function markFavoriteLoaded(item) {
  const index = favoriteSeedIndex(item.key);
  if (index < 0) return;
  state.favoriteSeeds[index] = {
    ...state.favoriteSeeds[index],
    centerX: Number.isFinite(state.viewX) ? Math.round(state.viewX) : item.centerX,
    centerZ: Number.isFinite(state.viewZ) ? Math.round(state.viewZ) : item.centerZ,
    zoom: Number.isFinite(state.zoom) ? state.zoom : item.zoom,
    lastLoadedAt: new Date().toISOString(),
    loadCount: (Number(state.favoriteSeeds[index].loadCount) || 0) + 1
  };
  writeFavoriteSeeds();
  renderFavoriteSeeds();
  updateFavoriteButtons();
}

function loadFavoriteSeed(item) {
  els.seedInput.value = item.seed;
  if ([...els.version.options].some(option => option.value === item.version)) els.version.value = item.version;
  if ([...els.dimension.options].some(option => option.value === item.dimension)) els.dimension.value = item.dimension;
  loadWorld({
    seed: item.seed,
    version: els.version.value,
    dimension: els.dimension.value,
    centerX: item.centerX,
    centerZ: item.centerZ,
    zoom: item.zoom || DEFAULT_ZOOM
  }).then(() => {
    if (state.loaded && state.seed === item.seed && state.version === els.version.value && state.dimension === els.dimension.value) {
      markFavoriteLoaded(item);
    }
  });
  showToast("Favorite seed loaded");
}

function removeFavoriteSeed(key) {
  const index = favoriteSeedIndex(key);
  if (index < 0) return;
  state.favoriteSeeds.splice(index, 1);
  writeFavoriteSeeds();
  renderFavoriteSeeds();
  updateFavoriteButtons();
  showToast("Favorite removed");
}

function renderFavoriteSeeds() {
  if (!els.favoritesList || !els.favoritesEmpty) return;
  els.favoritesList.innerHTML = "";
  els.favoritesEmpty.classList.toggle("hidden", state.favoriteSeeds.length > 0);
  for (const item of state.favoriteSeeds) {
    const card = document.createElement("div");
    card.className = "favorite-seed-card";
    card.innerHTML = `
      <div class="favorite-seed-main">
        <span class="favorite-seed-value">${escapeHtml(item.seed)}</span>
        <span class="favorite-seed-sub">${escapeHtml(item.versionLabel || item.version)} · ${escapeHtml(item.dimensionLabel || dimensionText(item.dimension))}</span>
      </div>
      <div class="favorite-seed-meta">
        <span class="meta-item"><span class="meta-label">Saved</span><b class="meta-value">${escapeHtml(compactDate(item.savedAt))}</b></span>
        <span class="meta-item"><span class="meta-label">Loaded</span><b class="meta-value">${escapeHtml(compactDate(item.lastLoadedAt))}</b></span>
        <span class="meta-item"><span class="meta-label">Loads</span><b class="meta-value">${escapeHtml(item.loadCount || 0)}</b></span>
        <span class="meta-item"><span class="meta-label">Center</span><b class="meta-value">${escapeHtml(`${item.centerX}, ${item.centerZ}`)}</b></span>
      </div>
      <div class="favorite-seed-actions">
        <button class="mini-link favorite-load" type="button">Load</button>
        <button class="mini-link favorite-copy" type="button">Copy</button>
        <button class="icon-only favorite-remove" type="button" title="Remove favorite">${ICONS.trash}</button>
      </div>
    `;
    card.querySelector(".favorite-load").addEventListener("click", () => loadFavoriteSeed(item));
    card.querySelector(".favorite-copy").addEventListener("click", () => copyText(item.seed, "Seed copied"));
    card.querySelector(".favorite-remove").addEventListener("click", () => removeFavoriteSeed(item.key));
    els.favoritesList.append(card);
  }
}

function initFavoriteSeeds() {
  readFavoriteSeeds();
  renderFavoriteSeeds();
  updateFavoriteButtons();
}

function copyCoords(point, label = "Coordinates copied") {
  copyText(`${point.x}, ${point.z}`, label);
}

function copyTp(point, label = "TP command copied") {
  copyText(`/tp ${point.x} ~ ${point.z}`, label);
}

function buildShareUrl() {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  const seed = state.seed || els.seedInput.value.trim();
  if (seed) url.searchParams.set("seed", seed);
  url.searchParams.set("version", state.version || els.version.value);
  url.searchParams.set("dimension", state.dimension || els.dimension.value || "overworld");
  url.searchParams.set("x", String(Math.round(state.viewX)));
  url.searchParams.set("z", String(Math.round(state.viewZ)));
  url.searchParams.set("zoom", (4 / state.zoom).toFixed(3).replace(/0+$/, "").replace(/\.$/, ""));
  url.searchParams.set("load", "1");
  return url.toString();
}

function scheduleUrlUpdate() {
  clearTimeout(urlTimer);
  urlTimer = setTimeout(() => {
    if (!state.loaded || !state.seed) return;
    window.history.replaceState(null, "", buildShareUrl());
  }, 180);
}

function shareUrl() {
  if (!state.loaded && !els.seedInput.value.trim()) {
    showToast("Load a seed first");
    return;
  }
  copyText(buildShareUrl(), "Share URL copied");
}

function updateEditionLabel(version = els.version.value) {
  if (!els.editionLabel) return;
  els.editionLabel.textContent = editionLabel(version);
}

function scheduleAutoLoad(delay = 900) {
  clearTimeout(autoLoadTimer);
  const seed = els.seedInput.value.trim();
  if (!seed) return;
  autoLoadTimer = setTimeout(() => {
    const nextSeed = els.seedInput.value.trim();
    if (!nextSeed) return;
    const nextVersion = els.version.value;
    const nextDimension = els.dimension.value || "overworld";
    const sameWorld = state.loaded &&
      state.seed === nextSeed &&
      state.version === nextVersion &&
      state.dimension === nextDimension;
    if (sameWorld) return;
    loadWorld({
      seed: nextSeed,
      version: nextVersion,
      dimension: nextDimension,
      centerX: state.loaded ? state.viewX : undefined,
      centerZ: state.loaded ? state.viewZ : undefined,
      zoom: state.loaded ? state.zoom : undefined,
      silent: true
    });
  }, delay);
}

function toggleBottomMenu() {
  const collapsed = !els.sidebar.classList.contains("is-collapsed");
  els.sidebar.classList.toggle("is-collapsed", collapsed);
  document.body.classList.toggle("sidebar-hidden", collapsed);
  els.menuToggle.setAttribute("aria-expanded", String(!collapsed));
  els.menuToggle.title = collapsed ? "Expand sidebar" : "Collapse sidebar";
}

function setFinderVisible(visible) {
  if (visible && els.favoritesPanel && !els.favoritesPanel.classList.contains("is-hidden")) setFavoritesVisible(false);
  els.finderPanel.classList.toggle("is-hidden", !visible);
  els.finderOpen.classList.toggle("visible", !visible);
  els.finderPanel.setAttribute("aria-hidden", String(!visible));
  els.finderOpen.setAttribute("aria-expanded", String(visible));
  els.finderClose.setAttribute("aria-expanded", String(visible));
  document.body.classList.toggle("finder-hidden", !visible);
  if (visible) {
    requestAnimationFrame(() => {
      if (els.finderBiomeFilter) els.finderBiomeFilter.focus({ preventScroll: true });
    });
  } else {
    requestAnimationFrame(() => {
      if (els.finderOpen) els.finderOpen.focus({ preventScroll: true });
    });
  }
}

function goToCoordinates() {
  const x = Number(els.gotoX.value);
  const z = Number(els.gotoZ.value);
  if (!Number.isFinite(x) || !Number.isFinite(z)) {
    showToast("Enter valid X and Z");
    return;
  }
  cancelMomentum();
  cancelZoomAnim();
  state.viewX = Math.round(x);
  state.viewZ = Math.round(z);
  if (state.loaded) {
    selectLocation({ label:"Map point", icon:"target", color:"#edf3ee", x, z }, { x: state.width / 2, y: state.height / 2 });
  } else {
    state.cursor = { x: Math.round(x), z: Math.round(z) };
  }
  scheduleUrlUpdate();
  requestRender();
}

function selectLocationAt(event) {
  if (!state.loaded) return;
  const rect = canvas.getBoundingClientRect();
  const sx = event.clientX - rect.left;
  const sy = event.clientY - rect.top;
  const marker = nearestMarker(sx, sy);
  if (marker) {
    selectLocation(marker, { x: sx, y: sy });
    showToast(`${marker.label} selected`);
    return;
  }
  const point = screenToWorld(sx, sy);
  selectLocation({ label:"Map point", icon:"target", color:"#edf3ee", ...point }, { x: sx, y: sy });
}

function handlePointerMove(event) {
  const rect = canvas.getBoundingClientRect();
  const sx = event.clientX - rect.left;
  const sy = event.clientY - rect.top;
  state.cursor = screenToWorld(sx, sy);
  updateHud();

  if (dragStart) {
    if (Math.hypot(event.clientX - dragStart.x, event.clientY - dragStart.y) > 3) pointerMoved = true;
    state.viewX = dragView.x - (event.clientX - dragStart.x) * state.zoom;
    state.viewZ = dragView.z - (event.clientY - dragStart.y) * state.zoom;
    const now = performance.now();
    if (panSample) {
      const dt = now - panSample.t;
      if (dt > 0) {
        const nvx = (state.viewX - panSample.x) / dt;
        const nvz = (state.viewZ - panSample.z) / dt;
        panVel.x = panVel.x * 0.5 + nvx * 0.5;
        panVel.z = panVel.z * 0.5 + nvz * 0.5;
      }
    }
    panSample = { x: state.viewX, z: state.viewZ, t: now };
    lastMoveT = now;
    requestRender();
    return; 
  }

  const marker = nearestMarker(sx, sy);
  if (marker) {
    els.ttName.textContent = marker.ring ? `${marker.label} ring ${marker.ring}` : marker.label;
    els.ttCoords.textContent = `X ${marker.x}  Z ${marker.z}`;
    els.tooltip.style.left = `${Math.min(sx + 14, state.width - 210)}px`;
    els.tooltip.style.top = `${Math.max(12, sy - 8)}px`;
    els.tooltip.classList.add("visible");
  } else if (state.loaded) {
    const biome = biomeAt(state.cursor.x, state.cursor.z);
    els.ttName.textContent = biome;
    els.ttCoords.textContent = `X ${state.cursor.x}  Z ${state.cursor.z}`;
    els.tooltip.style.left = `${Math.min(sx + 14, state.width - 210)}px`;
    els.tooltip.style.top = `${Math.max(12, sy - 8)}px`;
    els.tooltip.classList.add("visible");
  }
}

function bindEvents() {
  window.addEventListener("resize", resizeCanvas);
  canvas.addEventListener("pointerdown", event => {
    if (!state.loaded) return;
    cancelMomentum();
    cancelZoomAnim();
    freezeMarkers();
    dragStart = { x: event.clientX, y: event.clientY };
    dragView = { x: state.viewX, z: state.viewZ };
    pointerMoved = false;
    panSample = { x: state.viewX, z: state.viewZ, t: performance.now() };
    panVel = { x: 0, z: 0 };
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add("dragging");
    els.tooltip.classList.remove("visible");
  });
  canvas.addEventListener("pointerup", event => {
    if (!pointerMoved) selectLocationAt(event);
    if (pointerMoved) {
      scheduleUrlUpdate();

      if (performance.now() - lastMoveT < 70) startMomentum(panVel.x, panVel.z);
      else {
        unfreezeMarkers();
        loadVisibleStructuresNow();
      }
    } else {
      unfreezeMarkers();
    }
    dragStart = null;
    panSample = null;
    canvas.releasePointerCapture(event.pointerId);
    canvas.classList.remove("dragging");
  });
  canvas.addEventListener("pointerleave", () => {
    if (!dragStart) els.tooltip.classList.remove("visible");
  });
  canvas.addEventListener("pointercancel", () => {
    dragStart = null;
    panSample = null;
    canvas.classList.remove("dragging");
    unfreezeMarkers();
    loadVisibleStructuresNow();
  });
  canvas.addEventListener("pointermove", handlePointerMove);
  canvas.addEventListener("dblclick", () => {
    selectLocation({ label:"Map point", icon:"target", color:"#edf3ee", ...state.cursor });
    copyCoords(state.selected);
    requestRender();
  });
  canvas.addEventListener("wheel", event => {
    if (!state.loaded) return;
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const sx = event.clientX - rect.left;
    const sy = event.clientY - rect.top;

    const mag = Math.min(Math.abs(event.deltaY), 120);
    const stepBase = event.ctrlKey ? 0.012 : 0.0045;
    const step = Math.exp(stepBase * mag);
    const base = state.zoomTarget || state.zoom;
    const factor = event.deltaY > 0 ? step : 1 / step;
    startZoomTo(base * factor, sx, sy);
  }, { passive: false });

  els.menuToggle.addEventListener("click", toggleBottomMenu);
  els.seedInput.addEventListener("input", () => {
    scheduleAutoLoad();
    updateFavoriteButtons();
  });
  els.seedInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      scheduleAutoLoad(0);
    }
  });
  document.getElementById("random-btn").addEventListener("click", randomSeed);
  document.getElementById("zoom-in").addEventListener("click", () => startZoomTo((state.zoomTarget || state.zoom) * .6));
  document.getElementById("zoom-out").addEventListener("click", () => startZoomTo((state.zoomTarget || state.zoom) * 1.66));
  document.getElementById("copy-cursor")?.addEventListener("click", () => copyCoords(state.cursor));
  document.getElementById("copy-selected-coords").addEventListener("click", () => copyCoords(selectedPoint()));
  document.getElementById("copy-selected-tp").addEventListener("click", () => copyTp(selectedPoint()));
  document.getElementById("copy-popover-coords").addEventListener("click", () => copyCoords(selectedPoint()));
  document.getElementById("copy-popover-tp").addEventListener("click", () => copyTp(selectedPoint()));
  document.getElementById("close-popover").addEventListener("click", closeLocationPopover);
  document.getElementById("select-all-features").addEventListener("click", () => setAllFeatures(true));
  document.getElementById("deselect-all-features").addEventListener("click", () => setAllFeatures(false));
  document.getElementById("deselect-all-biomes").addEventListener("click", () => setAllBiomes(false));
  els.finderBtn.addEventListener("click", searchMatchingSeeds);
  els.finderRadius.addEventListener("input", () => {
    clearFinderResults();
    updateFinderHint();
  });
  els.finderAttempts.addEventListener("change", () => {
    clearFinderResults();
    updateFinderHint();
  });
  els.finderBiomeFilter.addEventListener("input", buildFinderBiomePicker);
  els.finderStructureFilter.addEventListener("input", buildFinderStructurePicker);
  els.finderRadiusPresets.querySelectorAll("[data-radius]").forEach(btn => {
    btn.addEventListener("click", () => setFinderRadius(Number(btn.dataset.radius)));
  });
  document.getElementById("finder-clear-biomes").addEventListener("click", () => {
    state.finderBiomes.clear();
    clearFinderResults();
    buildFinderBiomePicker();
    updateFinderHint();
  });
  document.getElementById("finder-clear-structures").addEventListener("click", () => {
    state.finderStructures.clear();
    clearFinderResults();
    buildFinderStructurePicker();
    updateFinderHint();
  });
  els.finderClose.addEventListener("click", () => setFinderVisible(false));
  els.finderOpen.addEventListener("click", () => setFinderVisible(true));
  els.likeSeedBtn?.addEventListener("click", toggleCurrentFavorite);
  els.likeActiveSeed?.addEventListener("click", toggleCurrentFavorite);
  els.favoritesBtn?.addEventListener("click", () => setFavoritesVisible(true));
  els.favoritesClose?.addEventListener("click", () => setFavoritesVisible(false));
  window.addEventListener("keydown", event => {
    if (event.key === "Escape" && !els.finderPanel.classList.contains("is-hidden")) {
      setFinderVisible(false);
    }
    if (event.key === "Escape" && els.favoritesPanel && !els.favoritesPanel.classList.contains("is-hidden")) {
      setFavoritesVisible(false);
    }
  });
  document.getElementById("go-btn").addEventListener("click", goToCoordinates);
  els.gotoX.addEventListener("keydown", event => { if (event.key === "Enter") goToCoordinates(); });
  els.gotoZ.addEventListener("keydown", event => { if (event.key === "Enter") goToCoordinates(); });
  document.getElementById("copy-seed-btn").addEventListener("click", () => {
    const seed = state.seed || els.seedInput.value.trim();
    if (seed) copyText(seed, "Seed copied");
  });
  document.getElementById("copy-active-seed").addEventListener("click", () => state.seed && copyText(state.seed, "Seed copied"));
  document.getElementById("reset-view-btn").addEventListener("click", () => {
    if (!state.structures.spawn) return;
    cancelMomentum();
    state.viewX = state.structures.spawn.x;
    state.viewZ = state.structures.spawn.z;
    setZoomImmediate(DEFAULT_ZOOM);
    selectLocation({ type:"spawn", ...state.structures.spawn, ...STRUCT_META.spawn });
    scheduleUrlUpdate();
    requestRender();
  });
  els.zoomRange.min = "0";
  els.zoomRange.max = "1";
  els.zoomRange.step = "0.001";
  els.zoomRange.addEventListener("input", event => {
    setZoomImmediate(sliderToZoom(Number(event.target.value)));
    scheduleUrlUpdate();
    requestRender();
  });
  els.version.addEventListener("change", () => {
    updateEditionLabel(els.version.value);
    updateFavoriteButtons();
    if (state.loaded) loadWorld({ seed: state.seed, version: els.version.value, dimension: els.dimension.value, centerX: state.viewX, centerZ: state.viewZ, zoom: state.zoom });
    else scheduleAutoLoad(0);
  });
  els.dimension.addEventListener("change", () => {
    updateFavoriteButtons();
    if (state.loaded) loadWorld({ seed: state.seed, version: els.version.value, dimension: els.dimension.value, centerX: state.viewX, centerZ: state.viewZ, zoom: state.zoom });
    else scheduleAutoLoad(0);
    buildSidebar();
  });
  els.shareUrlBtn.addEventListener("click", shareUrl);
}

function hydrateFromUrl() {
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
  const params = new URLSearchParams(window.location.search || hash);
  const seed = params.get("seed");
  const platform = params.get("platform");
  const version = params.get("version") || platformToVersion(platform);
  const dimension = parseDimension(params.get("dimension"));
  const centerX = parseNumberParam(params.get("x"));
  const centerZ = parseNumberParam(params.get("z"));
  const zoom = parseChunkbaseZoom(params.get("zoom"));
  if (version && [...els.version.options].some(option => option.value === version)) {
    els.version.value = version;
  }
  updateEditionLabel(els.version.value);
  if (dimension) {
    els.dimension.value = dimension;
    state.dimension = dimension;
  }
  if (seed) {
    els.seedInput.value = seed;
    loadWorld({
      seed,
      version: els.version.value,
      dimension: els.dimension.value,
      centerX,
      centerZ,
      zoom
    });
  }
}

function parseDimension(value) {
  return value === "overworld" ? "overworld" : "";
}

function platformToVersion(platform) {
  if (!platform) return "";
  const value = String(platform);
  const javaMatch = value.match(/java_(\d+)_(\d+)/);
  if (javaMatch) return `${javaMatch[1]}.${javaMatch[2]}`;
  const bedrockMatch = value.match(/bedrock[_-](\d+)(?:[_-](\d+))?(?:[_-](\d+))?/);
  if (!bedrockMatch) return "";
  const parts = bedrockMatch.slice(1).filter(Boolean);
  return `bedrock_${parts.join(".")}`;
}

function parseNumberParam(value) {
  if (value == null || value === "") return NaN;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

function parseChunkbaseZoom(value) {
  const n = parseNumberParam(value);
  if (!Number.isFinite(n) || n <= 0) return NaN;
  return clampMapZoom(4 / n);
}

async function loadCapabilities() {
  try {
    state.capabilities = await workerRequest("capabilities");
  } catch (err) {
    console.warn("Capabilities unavailable", err);
  }
}
