async function randomSeed() {
  const data = await workerRequest("randomSeed");
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
  els.menuToggle.setAttribute("aria-expanded", String(!collapsed));
  els.menuToggle.title = collapsed ? "Expand bottom menu" : "Collapse bottom menu";
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
  primeVisibleBiomeTiles();
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
    primeVisibleBiomeTiles();
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
  els.seedInput.addEventListener("input", () => scheduleAutoLoad());
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
    primeVisibleBiomeTiles();
    requestRender();
  });
  els.zoomRange.min = "0";
  els.zoomRange.max = "1";
  els.zoomRange.step = "0.001";
  els.zoomRange.addEventListener("input", event => {
    setZoomImmediate(sliderToZoom(Number(event.target.value)));
    scheduleUrlUpdate();
    primeVisibleBiomeTiles();
    requestRender();
  });
  els.version.addEventListener("change", () => {
    if (state.loaded) loadWorld({ seed: state.seed, version: els.version.value, dimension: els.dimension.value, centerX: state.viewX, centerZ: state.viewZ, zoom: state.zoom });
    else scheduleAutoLoad(0);
  });
  els.dimension.addEventListener("change", () => {
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
  const zoom = parseSharedZoom(params.get("zoom"), platform);
  if (version && [...els.version.options].some(option => option.value === version)) {
    els.version.value = version;
  }
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
  const match = String(platform).match(/java_(\d+)_(\d+)/);
  return match ? `${match[1]}.${match[2]}` : "";
}

function parseNumberParam(value) {
  if (value == null || value === "") return NaN;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

function parseSharedZoom(value, platform = "") {
  const n = parseNumberParam(value);
  if (!Number.isFinite(n)) return NaN;
  if (platform || n < 0) return clamp(4 / Math.pow(2, n), MIN_ZOOM, MAX_ZOOM);
  if (n <= 0) return NaN;
  return clamp(4 / n, MIN_ZOOM, MAX_ZOOM);
}

async function loadCapabilities() {
  try {
    state.capabilities = await workerRequest("capabilities");
    tuneWorkerPool();
  } catch (err) {
    console.warn("Capabilities unavailable", err);
  }
}
