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
const PENDING_LIKED_SEED_STORAGE_KEY = "seedmap.pendingLikedSeed.v1";
const PUBLIC_SEED_LIKES_STORAGE_KEY = "seedmap.publicSeedLikes.v1";
const LOCAL_SEED_USER_STORAGE_KEY = "seedmap.localUserId.v1";
const DAILY_SEED_SAVES_STORAGE_KEY = "seedmap.dailySeedSaves.v1";
const SEED_VAULT_TOKEN_STORAGE_KEY = "seedVaultToken";
const LEGACY_SEED_VAULT_TOKEN_STORAGE_KEY = "seedmap.seedVaultToken.v1";
const FAVORITE_SEEDS_LIMIT = 80;
const PUBLIC_SEEDS_LIMIT = 12;
const DAILY_SEED_SAVE_LIMIT = 10;
const SEED_API_BASE = String(window.SEED_VIEWER_SEED_API_BASE || API || "").replace(/\/$/, "");
const SEED_API_MODE = String(window.SEED_VIEWER_SEED_API_MODE || "").toLowerCase();
const SEED_AUTH_URL = String(window.SEED_VIEWER_AUTH_URL || "").trim();
const SEED_AUTH_COMPLETE_PARAM = "seedAuthComplete";
const SEED_VAULT_ENABLED = SEED_API_MODE === "seed-vault" || /(?:panel\.godlike|seed-vault|\/api\/v2)/i.test(SEED_API_BASE);
let seedAuthMode = "login";
let pendingSeedVaultAuth = null;
let frameHeightRaf = 0;
let frameResizeObserver = null;
const publicSeedPreviewJobs = new Map();

function appFrameHeight() {
  const doc = document.documentElement;
  const body = document.body;
  const panelBottom = els.publicSeedsPanel
    ? Math.ceil(els.publicSeedsPanel.getBoundingClientRect().bottom + window.scrollY)
    : 0;
  return Math.ceil(Math.max(
    doc?.scrollHeight || 0,
    body?.scrollHeight || 0,
    doc?.offsetHeight || 0,
    body?.offsetHeight || 0,
    panelBottom
  ));
}

function postFrameHeight() {
  frameHeightRaf = 0;
  if (window.parent === window) return;
  window.parent.postMessage({
    type: "seed-viewer:height",
    height: appFrameHeight()
  }, "*");
}

function queueFrameHeightPost() {
  if (frameHeightRaf) cancelAnimationFrame(frameHeightRaf);
  frameHeightRaf = requestAnimationFrame(postFrameHeight);
}

function initFrameResizeBridge() {
  queueFrameHeightPost();
  window.addEventListener("load", queueFrameHeightPost);
  window.addEventListener("resize", queueFrameHeightPost);
  if ("ResizeObserver" in window) {
    frameResizeObserver = new ResizeObserver(queueFrameHeightPost);
    frameResizeObserver.observe(document.body);
    if (els.publicSeedsPanel) frameResizeObserver.observe(els.publicSeedsPanel);
  }
}

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

function appDimension(value) {
  return value === "the_end" ? "end" : value || "overworld";
}

function apiDimension(value) {
  return value === "end" ? "the_end" : value || "overworld";
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

function localSeedUserId() {
  try {
    let id = localStorage.getItem(LOCAL_SEED_USER_STORAGE_KEY);
    if (!id) {
      id = `local-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
      localStorage.setItem(LOCAL_SEED_USER_STORAGE_KEY, id);
    }
    return id;
  } catch {
    return "local-user";
  }
}

function currentSeedUser() {
  const user = window.SEED_VIEWER_USER || window.GODLIKE_USER || null;
  const id = String(user?.id || user?.userId || localSeedUserId());
  return {
    id,
    name: String(user?.name || user?.username || user?.displayName || "You"),
    avatar: String(user?.avatar || user?.avatarUrl || "")
  };
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function readDailySeedSaves() {
  try {
    const value = JSON.parse(localStorage.getItem(DAILY_SEED_SAVES_STORAGE_KEY) || "null");
    if (!value || value.date !== todayKey() || !Array.isArray(value.keys)) {
      return { date: todayKey(), keys: [] };
    }
    return { date: value.date, keys: [...new Set(value.keys.map(String).filter(Boolean))] };
  } catch {
    return { date: todayKey(), keys: [] };
  }
}

function writeDailySeedSaves(value) {
  try {
    localStorage.setItem(DAILY_SEED_SAVES_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // The backend still enforces the production limit.
  }
}

function dailySeedSaveLimitReached(item) {
  const key = item?.key || "";
  if (!key || favoriteSeedIndex(key) >= 0) return false;
  const value = readDailySeedSaves();
  return !value.keys.includes(key) && value.keys.length >= DAILY_SEED_SAVE_LIMIT;
}

function rememberDailySeedSave(item) {
  const key = item?.key || "";
  if (!key) return;
  const value = readDailySeedSaves();
  if (!value.keys.includes(key)) value.keys.push(key);
  writeDailySeedSaves({ date: value.date, keys: value.keys.slice(-DAILY_SEED_SAVE_LIMIT) });
}

function dailySeedSaveCount() {
  return readDailySeedSaves().keys.length;
}

function seedSavedMessage(base = "Seed saved") {
  return `${base} (${Math.min(dailySeedSaveCount(), DAILY_SEED_SAVE_LIMIT)}/${DAILY_SEED_SAVE_LIMIT} today)`;
}

function seedVaultToken() {
  const token = window.SEED_VIEWER_SEED_VAULT_TOKEN || window.SEED_VAULT_TOKEN || "";
  if (token) return String(token);
  try {
    return localStorage.getItem(SEED_VAULT_TOKEN_STORAGE_KEY)
      || localStorage.getItem(LEGACY_SEED_VAULT_TOKEN_STORAGE_KEY)
      || "";
  } catch {
    return "";
  }
}

function writeSeedVaultToken(token) {
  const value = String(token || "").trim();
  if (!value) return false;
  try {
    localStorage.setItem(SEED_VAULT_TOKEN_STORAGE_KEY, value);
  } catch {
    return false;
  }
  return true;
}

function clearSeedVaultToken() {
  try {
    localStorage.removeItem(SEED_VAULT_TOKEN_STORAGE_KEY);
    localStorage.removeItem(LEGACY_SEED_VAULT_TOKEN_STORAGE_KEY);
  } catch {
    // If storage is unavailable, the next request will still fail and show auth again.
  }
}

function sanitizeFavorite(item) {
  const seed = normalizeFavoriteSeed(item?.seed);
  if (!seed) return null;
  const version = String(item.version || "1.20");
  const dimension = appDimension(String(item.dimension || "overworld"));
  const likedByMe = Boolean(item.likedByMe ?? item.liked_by_me ?? false);
  const likedBy = Array.isArray(item.likedBy)
    ? [...new Set(item.likedBy.map(id => String(id)).filter(Boolean))].slice(0, 500)
    : likedByMe ? [currentSeedUser().id] : [];
  const rawLikes = Number.isFinite(Number(item.likes_count))
    ? Number(item.likes_count)
    : Number.isFinite(Number(item.likes)) ? Number(item.likes) : 1;
  const user = item.user && typeof item.user === "object" ? {
    id: String(item.user.id || ""),
    name: String(item.user.name || "Player").slice(0, 48),
    avatar: String(item.user.avatar || "")
  } : null;
  const nearbySource = Array.isArray(item.nearby_locations) ? item.nearby_locations : item.nearby;
  return {
    id: String(item.id || item.apiId || ""),
    key: favoriteKey(seed, version, dimension),
    title: String(item.title || `Seed ${seed}`).slice(0, 255),
    seed,
    version,
    versionLabel: item.versionLabel || version,
    dimension,
    dimensionLabel: item.dimensionLabel || dimensionText(dimension),
    centerX: Number.isFinite(Number(item.centerX)) ? Math.round(Number(item.centerX)) : 0,
    centerZ: Number.isFinite(Number(item.centerZ)) ? Math.round(Number(item.centerZ)) : 0,
    spawnX: Number.isFinite(Number(item.spawnX ?? item.spawn_x)) ? Math.round(Number(item.spawnX ?? item.spawn_x)) : 0,
    spawnZ: Number.isFinite(Number(item.spawnZ ?? item.spawn_z)) ? Math.round(Number(item.spawnZ ?? item.spawn_z)) : 0,
    zoom: Number.isFinite(Number(item.zoom)) ? Number(item.zoom) : DEFAULT_ZOOM,
    previewUrl: String(item.previewUrl || item.preview_url || ""),
    savedAt: item.savedAt || item.created_at || new Date().toISOString(),
    lastLoadedAt: item.lastLoadedAt || item.updated_at || "",
    loadCount: Math.max(0, Number(item.loadCount) || 0),
    likes: Math.max(likedBy.length, rawLikes),
    likedByMe,
    likedBy,
    user,
    nearby: Array.isArray(nearbySource) ? nearbySource.slice(0, 4).map(location => ({
      label: String(location.label || "Location").slice(0, 48),
      x: Number.isFinite(Number(location.x)) ? Math.round(Number(location.x)) : 0,
      z: Number.isFinite(Number(location.z)) ? Math.round(Number(location.z)) : 0,
      distance: Math.max(0, Math.round(Number(location.distance) || 0))
    })) : []
  };
}

function seedApiUrl(path) {
  return `${SEED_API_BASE}${path}`;
}

function seedApiIsCrossOrigin() {
  try {
    return new URL(SEED_API_BASE || window.location.origin, window.location.origin).origin !== window.location.origin;
  } catch {
    return false;
  }
}

function seedVaultPath(path) {
  const base = SEED_API_BASE.toLowerCase();
  if (base.endsWith("/api/v2/seed-vault")) return path.replace(/^\/api\/v2\/seed-vault/, "");
  if (base.endsWith("/api/v2")) return path.replace(/^\/api\/v2/, "");
  return path;
}

async function seedApiRequest(path, options = {}) {
  const token = seedVaultToken();
  const response = await fetch(seedApiUrl(path), {
    credentials: seedApiIsCrossOrigin() ? "omit" : "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    },
    ...options
  });
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok) {
    const error = new Error(data?.message || `Seed API ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

function seedApiResponseItem(data) {
  return data?.data || data?.seed || data;
}

function seedApiResponseList(data) {
  return Array.isArray(data?.data) ? data.data : Array.isArray(data?.seeds) ? data.seeds : Array.isArray(data) ? data : [];
}

function apiPreviewUrl(value) {
  const url = String(value || "").trim();
  if (!url || url.startsWith("data:") || url.startsWith("blob:")) return "";
  return url.slice(0, 2000);
}

function seedVaultPayload(item) {
  const previewUrl = apiPreviewUrl(item.previewUrl);
  return {
    title: item.title || `Seed ${item.seed}`,
    seed: item.seed,
    version: item.version || "1.20",
    dimension: apiDimension(item.dimension),
    centerX: Math.round(Number(item.centerX) || 0),
    centerZ: Math.round(Number(item.centerZ) || 0),
    spawnX: Math.round(Number(item.spawnX) || 0),
    spawnZ: Math.round(Number(item.spawnZ) || 0),
    ...(previewUrl ? { preview_url: previewUrl } : {}),
    nearby_locations: Array.isArray(item.nearby) ? item.nearby.slice(0, 4).map(location => ({
      label: location.label || "Location",
      x: Math.round(Number(location.x) || 0),
      z: Math.round(Number(location.z) || 0),
      distance: Math.max(0, Math.round(Number(location.distance) || 0))
    })) : []
  };
}

function setSeedAuthMode(mode) {
  seedAuthMode = mode === "register" ? "register" : "login";
  const registering = seedAuthMode === "register";
  els.seedAuthTitle && (els.seedAuthTitle.textContent = registering ? "Create account" : "Log in");
  els.seedAuthLoginTab?.classList.toggle("is-active", !registering);
  els.seedAuthRegisterTab?.classList.toggle("is-active", registering);
  els.seedAuthNameRow?.classList.toggle("is-hidden", !registering);
  els.seedAuthConfirmRow?.classList.toggle("is-hidden", !registering);
  if (els.seedAuthSubmit) els.seedAuthSubmit.textContent = registering ? "Create account" : "Log in";
  if (els.seedAuthName) els.seedAuthName.required = registering;
  if (els.seedAuthPasswordConfirm) els.seedAuthPasswordConfirm.required = registering;
  if (els.seedAuthPassword) els.seedAuthPassword.autocomplete = registering ? "new-password" : "current-password";
  if (els.seedAuthError) els.seedAuthError.textContent = "";
}

function setSeedAuthVisible(visible, mode = seedAuthMode, pending = null) {
  if (!els.seedAuthModal) return false;
  if (visible) {
    pendingSeedVaultAuth = pending || pendingSeedVaultAuth;
    setSeedAuthMode(mode);
    els.seedAuthModal.classList.remove("is-hidden");
    els.seedAuthModal.setAttribute("aria-hidden", "false");
    setTimeout(() => els.seedAuthEmail?.focus(), 0);
  } else {
    els.seedAuthModal.classList.add("is-hidden");
    els.seedAuthModal.setAttribute("aria-hidden", "true");
    if (els.seedAuthError) els.seedAuthError.textContent = "";
  }
  queueFrameHeightPost();
  return true;
}

function requestSeedVaultAuth(item, action = "save") {
  if (setSeedAuthVisible(true, "login", { item, action })) return;
  if (SEED_AUTH_URL) startSeedAuthFlow(item);
  else showToast("Login required to save seeds");
}

function requireSeedVaultAuth(item, action = "save") {
  if (!SEED_VAULT_ENABLED || seedVaultToken()) return true;
  requestSeedVaultAuth(item, action);
  return false;
}

function seedAuthMessage(error) {
  const data = error?.data || {};
  if (data.errors && typeof data.errors === "object") {
    const first = Object.values(data.errors).flat().find(Boolean);
    if (first) return String(first);
  }
  return data.message || error?.message || "Auth failed";
}

async function submitSeedAuth(event) {
  event?.preventDefault();
  if (!els.seedAuthForm || !SEED_VAULT_ENABLED) return;
  const email = els.seedAuthEmail?.value.trim() || "";
  const password = els.seedAuthPassword?.value || "";
  const name = els.seedAuthName?.value.trim() || "";
  const passwordConfirmation = els.seedAuthPasswordConfirm?.value || "";
  const registering = seedAuthMode === "register";
  if (els.seedAuthError) els.seedAuthError.textContent = "";
  if (registering && password !== passwordConfirmation) {
    if (els.seedAuthError) els.seedAuthError.textContent = "Passwords do not match";
    return;
  }

  const payload = registering
    ? { email, name, password, password_confirmation: passwordConfirmation }
    : { email, password };
  const path = seedVaultPath(`/api/v2/seed-vault/auth/${registering ? "register" : "login"}`);
  els.seedAuthSubmit?.setAttribute("disabled", "true");
  try {
    const data = await seedApiRequest(path, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    const token = data?.data?.token || data?.token || "";
    if (!writeSeedVaultToken(token)) throw new Error("Token was not returned");
    const pending = pendingSeedVaultAuth;
    pendingSeedVaultAuth = null;
    setSeedAuthVisible(false);
    showToast(registering ? "Account created" : "Logged in");
    await loadPublicSeedCards();
    if (pending?.item) {
      if (pending.action === "like") await togglePublicSeedLike(pending.item);
      else await addFavoriteSeed(pending.item, { skipAuth: true });
    }
  } catch (err) {
    console.warn("SeedVault auth failed", err);
    if (els.seedAuthError) els.seedAuthError.textContent = seedAuthMessage(err);
  } finally {
    els.seedAuthSubmit?.removeAttribute("disabled");
  }
}

function authReturnUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set(SEED_AUTH_COMPLETE_PARAM, "1");
  return url.toString();
}

function seedAuthWasCompleted() {
  return new URLSearchParams(window.location.search).get(SEED_AUTH_COMPLETE_PARAM) === "1";
}

function clearSeedAuthReturnParam() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(SEED_AUTH_COMPLETE_PARAM)) return;
  url.searchParams.delete(SEED_AUTH_COMPLETE_PARAM);
  window.history.replaceState(null, "", url.toString());
}

function buildSeedAuthUrl(item) {
  const target = new URL(SEED_AUTH_URL, window.location.origin);
  target.searchParams.set("seedId", item.seed);
  target.searchParams.set("version", item.version);
  target.searchParams.set("dimension", item.dimension);
  target.searchParams.set("redirect", authReturnUrl());
  return target.toString();
}

function startSeedAuthFlow(item) {
  try {
    sessionStorage.setItem(PENDING_LIKED_SEED_STORAGE_KEY, JSON.stringify(item));
  } catch {
    // Auth can still continue; the seed is also present in query params.
  }
  showToast("Opening registration");
  window.location.href = buildSeedAuthUrl(item);
}

function upsertFavoriteSeed(item) {
  const clean = sanitizeFavorite(item);
  if (!clean) return null;
  const index = favoriteSeedIndex(clean.key);
  if (index >= 0) {
    const previous = state.favoriteSeeds[index];
    state.favoriteSeeds[index] = {
      ...previous,
      ...clean,
      id: clean.id || previous.id,
      user: clean.user || previous.user,
      previewUrl: clean.previewUrl || previous.previewUrl,
      savedAt: previous.savedAt || clean.savedAt,
      likes: Number.isFinite(Number(clean.likes)) ? Number(clean.likes) : previous.likes
    };
  } else {
    state.favoriteSeeds.unshift(clean);
    state.favoriteSeeds = state.favoriteSeeds.slice(0, FAVORITE_SEEDS_LIMIT);
  }
  return clean;
}

function sameSeedItem(a, b) {
  if (!a || !b) return false;
  return Boolean(a.id && b.id && a.id === b.id) || a.key === b.key;
}

async function saveFavoriteSeedToApi(item) {
  if (SEED_VAULT_ENABLED) {
    if (!requireSeedVaultAuth(item)) return null;
    const created = await seedApiRequest(seedVaultPath("/api/v2/seed-vault/seeds"), {
      method: "POST",
      body: JSON.stringify(seedVaultPayload(item))
    });
    let clean = sanitizeFavorite(seedApiResponseItem(created));
    if (clean && (Number(item.likes) || 0) > 0) {
      const liked = await seedApiRequest(seedVaultPath(`/api/v2/seed-vault/seeds/${encodeURIComponent(clean.id)}/like`), {
        method: "POST"
      });
      clean = sanitizeFavorite(seedApiResponseItem(liked)) || clean;
    }
    return clean;
  }
  const data = await seedApiRequest("/api/seeds/save", {
    method: "POST",
    body: JSON.stringify(item)
  });
  return sanitizeFavorite(seedApiResponseItem(data));
}

async function deleteFavoriteSeedFromApi(item) {
  const clean = sanitizeFavorite(item);
  if (!clean) return;
  if (SEED_VAULT_ENABLED) {
    if (!clean.id) return;
    await seedApiRequest(seedVaultPath(`/api/v2/seed-vault/seeds/${encodeURIComponent(clean.id)}`), {
      method: "DELETE"
    });
    return;
  }
  await seedApiRequest("/api/seeds/delete", {
    method: "POST",
    body: JSON.stringify(clean)
  });
}

function readPublicSeedLikes() {
  try {
    const raw = JSON.parse(localStorage.getItem(PUBLIC_SEED_LIKES_STORAGE_KEY) || "[]");
    return new Set(Array.isArray(raw) ? raw : []);
  } catch {
    return new Set();
  }
}

function writePublicSeedLikes(keys) {
  try {
    localStorage.setItem(PUBLIC_SEED_LIKES_STORAGE_KEY, JSON.stringify([...keys]));
  } catch {
    // Non-critical; this only prevents duplicate local likes in one browser.
  }
}

function publicSeedIsLiked(item) {
  if (item.likedByMe) return true;
  const user = currentSeedUser();
  const liked = readPublicSeedLikes();
  return liked.has(item.key) || (Array.isArray(item.likedBy) && item.likedBy.map(String).includes(user.id));
}

function currentNearbyLocations(limit = 3) {
  if (!state.loaded || typeof buildMarkers !== "function") return [];
  const originX = Number.isFinite(state.viewX) ? state.viewX : 0;
  const originZ = Number.isFinite(state.viewZ) ? state.viewZ : 0;
  const seen = new Set();
  return buildMarkers()
    .filter(marker => marker && marker.type !== "spawn" && Number.isFinite(marker.x) && Number.isFinite(marker.z))
    .map(marker => ({
      label: marker.label || marker.type || "Location",
      x: Math.round(marker.x),
      z: Math.round(marker.z),
      distance: Math.round(Math.hypot(marker.x - originX, marker.z - originZ))
    }))
    .filter(location => {
      const key = `${location.label}|${location.x}|${location.z}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}

async function togglePublicSeedLike(item) {
  const clean = sanitizeFavorite(item);
  if (!clean) return;
  if (SEED_VAULT_ENABLED) {
    if (!requireSeedVaultAuth(clean, "like")) return;
    const wasLiked = publicSeedIsLiked(clean);
    try {
      let target = clean;
      if (!target.id) {
        const created = await seedApiRequest(seedVaultPath("/api/v2/seed-vault/seeds"), {
          method: "POST",
          body: JSON.stringify(seedVaultPayload(target))
        });
        target = sanitizeFavorite(seedApiResponseItem(created)) || target;
      }
      const data = await seedApiRequest(seedVaultPath(`/api/v2/seed-vault/seeds/${encodeURIComponent(target.id)}/like`), {
        method: wasLiked ? "DELETE" : "POST"
      });
      const apiItem = sanitizeFavorite(seedApiResponseItem(data));
      if (apiItem) {
        upsertFavoriteSeed(apiItem);
        const index = state.publicSeeds.findIndex(seed => sameSeedItem(seed, apiItem));
        if (index >= 0) state.publicSeeds[index] = apiItem;
        else state.publicSeeds.unshift(apiItem);
        writeFavoriteSeeds();
        renderFavoriteSeeds();
        renderPublicSeedCards();
        updateFavoriteButtons();
      }
      showToast(wasLiked ? "Seed unliked" : "Seed liked");
      await loadPublicSeedCards();
    } catch (err) {
      console.warn("SeedVault like failed", err);
      showToast("Seed like failed");
    }
    return;
  }
  const user = currentSeedUser();
  const liked = readPublicSeedLikes();
  const wasLiked = publicSeedIsLiked(clean);
  if (wasLiked) liked.delete(clean.key);
  else liked.add(clean.key);
  writePublicSeedLikes(liked);
  const likedBy = new Set((clean.likedBy || []).map(String));
  if (wasLiked) likedBy.delete(user.id);
  else likedBy.add(user.id);
  clean.likedBy = [...likedBy];
  clean.likes = Math.max(0, clean.likedBy.length || (Number(clean.likes) || 1) + (wasLiked ? -1 : 1));
  if (!clean.user) clean.user = user;
  upsertFavoriteSeed(clean);
  state.publicSeeds = state.publicSeeds.map(seed => sameSeedItem(seed, clean) ? { ...seed, likes: clean.likes } : seed);
  writeFavoriteSeeds();
  renderFavoriteSeeds();
  renderPublicSeedCards();
  updateFavoriteButtons();
  showToast(wasLiked ? "Seed unliked" : "Seed liked");
  try {
    const data = await seedApiRequest(wasLiked ? "/api/seeds/unlike" : "/api/seeds/like", {
      method: "POST",
      body: JSON.stringify({ ...clean, user })
    });
    const apiItem = sanitizeFavorite(data.seed || data);
    if (apiItem) {
      upsertFavoriteSeed(apiItem);
      state.publicSeeds = state.publicSeeds.map(seed => sameSeedItem(seed, apiItem) ? apiItem : seed);
      writeFavoriteSeeds();
      renderFavoriteSeeds();
      renderPublicSeedCards();
      updateFavoriteButtons();
    }
  } catch (err) {
    console.warn("Seed like API unavailable; using local like", err);
  }
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

function captureSpawnPreview(spawn) {
  if (!state.loaded || !spawn || !canvas.width || !canvas.height || typeof render !== "function") return "";
  const previous = {
    viewX: state.viewX,
    viewZ: state.viewZ,
    zoom: state.zoom,
    zoomTarget: state.zoomTarget,
    selected: state.selected
  };
  try {
    state.viewX = Math.round(spawn.x);
    state.viewZ = Math.round(spawn.z);
    state.zoom = clampMapZoom(DEFAULT_ZOOM);
    state.zoomTarget = state.zoom;
    render();

    const out = document.createElement("canvas");
    out.width = 640;
    out.height = 360;
    const outCtx = out.getContext("2d", { alpha: false });
    outCtx.imageSmoothingEnabled = false;

    const aspect = out.width / out.height;
    let sw = canvas.width;
    let sh = Math.round(sw / aspect);
    if (sh > canvas.height) {
      sh = canvas.height;
      sw = Math.round(sh * aspect);
    }
    const sx = Math.max(0, Math.round((canvas.width - sw) / 2));
    const sy = Math.max(0, Math.round((canvas.height - sh) / 2));
    outCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, out.width, out.height);
    return out.toDataURL("image/jpeg", .78);
  } catch (err) {
    console.warn("Could not capture spawn preview", err);
    return "";
  } finally {
    state.viewX = previous.viewX;
    state.viewZ = previous.viewZ;
    state.zoom = previous.zoom;
    state.zoomTarget = previous.zoomTarget;
    state.selected = previous.selected;
    render();
  }
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function previewTileStats() {
  if (!state.loaded || !dimensionCaps().biomes || !state.showBiomes) return { ready: true, loaded: 0, target: 0 };
  const lod = pickLod();
  const range = biomeTileRange(lod);
  const cfg = LODS[lod];
  let loaded = 0;
  for (let tz = range.tzMin; tz <= range.tzMax; tz += 1) {
    for (let tx = range.txMin; tx <= range.txMax; tx += 1) {
      if (state.tiles.has(tileKey(lod, tx, tz))) loaded += 1;
    }
  }
  const centerKey = tileKey(
    lod,
    Math.floor(state.viewX / cfg.blocks),
    Math.floor(state.viewZ / cfg.blocks)
  );
  const target = Math.min(range.count, Math.max(6, Math.ceil(range.count * .18)));
  return {
    ready: state.tiles.has(centerKey) && loaded >= target,
    loaded,
    target
  };
}

async function captureRealSpawnPreview(spawn) {
  if (!state.loaded || !spawn) return "";
  const previous = {
    viewX: state.viewX,
    viewZ: state.viewZ,
    zoom: state.zoom,
    zoomTarget: state.zoomTarget,
    selected: state.selected
  };
  try {
    state.viewX = Math.round(spawn.x);
    state.viewZ = Math.round(spawn.z);
    state.zoom = clampMapZoom(DEFAULT_ZOOM);
    state.zoomTarget = state.zoom;
    for (let i = 0; i < 18; i += 1) {
      render();
      pumpTiles();
      const stats = previewTileStats();
      if (stats.ready) break;
      await wait(i < 4 ? 80 : 140);
    }
    render();
    return captureSpawnPreview(spawn);
  } finally {
    state.viewX = previous.viewX;
    state.viewZ = previous.viewZ;
    state.zoom = previous.zoom;
    state.zoomTarget = previous.zoomTarget;
    state.selected = previous.selected;
    render();
  }
}

function shadedPreviewRgb(rgb, x, z, biomeId) {
  const noise = seededNoise((Number(biomeId) || 1) * 2654435761, x, z);
  const shade = .88 + noise * .18;
  return [
    clamp(Math.round(rgb[0] * shade), 0, 255),
    clamp(Math.round(rgb[1] * shade), 0, 255),
    clamp(Math.round(rgb[2] * shade), 0, 255)
  ];
}

async function createSpawnBiomePreview(item, spawn) {
  if (!item?.seed || !spawn || !dimensionCaps(item.dimension).biomes) return "";
  const samplesW = 192;
  const samplesH = 108;
  const sampleScale = 16;
  try {
    const data = await workerRequest("biomeTile", {
      seed: item.seed,
      version: item.version,
      dimension: item.dimension || "overworld",
      x: Math.round(spawn.x - (samplesW * sampleScale) / 2),
      z: Math.round(spawn.z - (samplesH * sampleScale) / 2),
      w: samplesW,
      h: samplesH,
      scale: sampleScale
    });
    if (!data?.grid?.length) return "";
    const out = document.createElement("canvas");
    out.width = 768;
    out.height = 432;
    const outCtx = out.getContext("2d", { alpha: false });
    const img = outCtx.createImageData(samplesW, samplesH);
    const pixels = img.data;
    for (let z = 0; z < samplesH; z += 1) {
      for (let x = 0; x < samplesW; x += 1) {
        const i = z * samplesW + x;
        const biomeId = Number(data.grid[i]);
        const rgb = shadedPreviewRgb(BIOME_RGB.get(biomeId) || UNKNOWN_BIOME_RGB, x, z, biomeId);
        const p = i * 4;
        pixels[p] = rgb[0];
        pixels[p + 1] = rgb[1];
        pixels[p + 2] = rgb[2];
        pixels[p + 3] = 255;
      }
    }
    const src = document.createElement("canvas");
    src.width = samplesW;
    src.height = samplesH;
    src.getContext("2d", { alpha: false }).putImageData(img, 0, 0);
    outCtx.imageSmoothingEnabled = false;
    outCtx.drawImage(src, 0, 0, out.width, out.height);
    outCtx.fillStyle = "rgba(0,0,0,.06)";
    outCtx.fillRect(0, 0, out.width, out.height);
    return out.toDataURL("image/jpeg", .84);
  } catch (err) {
    console.warn("Could not render spawn biome preview", err);
    return "";
  }
}

function currentFavoritePayload() {
  const seed = normalizeFavoriteSeed(els.seedInput.value || state.seed);
  const version = els.version.value;
  const dimension = els.dimension.value || "overworld";
  const matchesLoadedWorld = state.loaded && state.seed === seed && state.version === version && state.dimension === dimension;
  const spawn = matchesLoadedWorld && state.structures?.spawn ? state.structures.spawn : null;
  const now = new Date().toISOString();
  const user = currentSeedUser();
  return sanitizeFavorite({
    seed,
    version,
    versionLabel: selectedOptionText(els.version) || version,
    dimension,
    dimensionLabel: dimensionText(dimension),
    centerX: matchesLoadedWorld ? state.viewX : 0,
    centerZ: matchesLoadedWorld ? state.viewZ : 0,
    spawnX: spawn ? spawn.x : 0,
    spawnZ: spawn ? spawn.z : 0,
    zoom: matchesLoadedWorld ? state.zoom : DEFAULT_ZOOM,
    savedAt: now,
    lastLoadedAt: matchesLoadedWorld ? now : "",
    loadCount: matchesLoadedWorld ? 1 : 0,
    likes: 1,
    likedBy: [user.id],
    user,
    nearby: matchesLoadedWorld ? currentNearbyLocations(3) : []
  });
}

async function addFavoriteSeed(item, options = {}) {
  if (!item) {
    showToast("Enter a seed first");
    return;
  }
  let cleanItem = sanitizeFavorite(item);
  if (!cleanItem) return;
  if (SEED_VAULT_ENABLED && !options.skipAuth && !seedVaultToken()) {
    requireSeedVaultAuth(cleanItem, "save");
    return;
  }
  if (!SEED_VAULT_ENABLED && !options.skipAuth && SEED_AUTH_URL && !seedAuthWasCompleted()) {
    startSeedAuthFlow(cleanItem);
    return;
  }
  if (!options.skipDailyLimit && dailySeedSaveLimitReached(cleanItem)) {
    showToast(`Daily limit reached: ${DAILY_SEED_SAVE_LIMIT} seeds`);
    return;
  }
  const sameLoadedSeed = state.loaded
    && state.seed === cleanItem.seed
    && state.version === cleanItem.version
    && state.dimension === cleanItem.dimension;
  const previewSpawn = !cleanItem.previewUrl && sameLoadedSeed && state.structures?.spawn
    ? { x: state.structures.spawn.x, z: state.structures.spawn.z }
    : null;

  const saved = upsertFavoriteSeed(cleanItem);
  writeFavoriteSeeds();
  renderFavoriteSeeds();
  renderPublicSeedCards();
  updateFavoriteButtons();
  showToast(options.fromAuth ? "Seed saved after registration" : "Seed saved");

  if (previewSpawn) {
    createSpawnBiomePreview(saved, previewSpawn).then(previewUrl => {
      if (!previewUrl) return;
      const latest = state.favoriteSeeds.find(seed => sameSeedItem(seed, saved)) || saved;
      const withPreview = sanitizeFavorite({ ...latest, previewUrl });
      if (!withPreview) return;
      upsertFavoriteSeed(withPreview);
      rememberGeneratedPublicPreview(withPreview);
      writeFavoriteSeeds();
      renderFavoriteSeeds();
      renderPublicSeedCards();
      updateFavoriteButtons();
      queueFrameHeightPost();
    }).catch(err => {
      console.warn("Could not attach seed preview", err);
    });
  }

  try {
    const apiItem = await saveFavoriteSeedToApi(saved);
    if (apiItem) upsertFavoriteSeed(apiItem);
    rememberDailySeedSave(apiItem || saved);
    writeFavoriteSeeds();
    renderFavoriteSeeds();
    updateFavoriteButtons();
    showToast(seedSavedMessage(options.fromAuth ? "Seed saved after registration" : "Seed saved"));
    await loadPublicSeedCards();
  } catch (err) {
    console.warn("Seed API save unavailable; using local favorites", err);
    if (SEED_VAULT_ENABLED) {
      state.favoriteSeeds = state.favoriteSeeds.filter(seed => !sameSeedItem(seed, saved));
      writeFavoriteSeeds();
      renderFavoriteSeeds();
      renderPublicSeedCards();
      updateFavoriteButtons();
      if (err?.status === 429) {
        showToast(`Daily limit reached: ${DAILY_SEED_SAVE_LIMIT} seeds`);
      } else if ([400, 401, 403].includes(Number(err?.status))) {
        clearSeedVaultToken();
        requestSeedVaultAuth(cleanItem, "save");
        showToast("Please log in again");
      } else {
        showToast("SeedVault save failed");
      }
    } else {
      rememberDailySeedSave(saved);
      showToast(seedSavedMessage("Seed saved locally"));
    }
  }
}

async function toggleCurrentFavorite() {
  const item = currentFavoritePayload();
  if (!item) {
    showToast("Enter a seed first");
    return;
  }
  const index = favoriteSeedIndex(item.key);
  if (index >= 0) {
    await removeFavoriteSeed(item.key);
  } else {
    await addFavoriteSeed(item);
  }
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

async function removeFavoriteSeed(key) {
  const index = favoriteSeedIndex(key);
  if (index < 0) return;
  const removed = state.favoriteSeeds[index];
  state.favoriteSeeds.splice(index, 1);
  state.publicSeeds = state.publicSeeds.filter(seed => !sameSeedItem(seed, removed));
  writeFavoriteSeeds();
  renderFavoriteSeeds();
  renderPublicSeedCards();
  updateFavoriteButtons();
  showToast("Favorite removed");
  try {
    await deleteFavoriteSeedFromApi(removed);
    await loadPublicSeedCards();
  } catch (err) {
    console.warn("Seed API delete unavailable; removed locally", err);
  }
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
        <span class="meta-item"><span class="meta-label">Last loaded</span><b class="meta-value">${escapeHtml(compactDate(item.lastLoadedAt))}</b></span>
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

function publicSeedSource() {
  if (SEED_VAULT_ENABLED) return state.publicSeeds.slice(0, PUBLIC_SEEDS_LIMIT);
  if (state.publicSeeds.length) return state.publicSeeds.slice(0, PUBLIC_SEEDS_LIMIT);
  return state.favoriteSeeds.slice(0, PUBLIC_SEEDS_LIMIT).map(item => ({ ...item, localOnly: true }));
}

function publicSeedLikesText(item) {
  const likes = Math.max(0, Number(item.likes) || 0);
  return `${likes} ${likes === 1 ? "like" : "likes"}`;
}

function distanceText(distance) {
  const blocks = Math.max(0, Math.round(Number(distance) || 0));
  return `${blocks} ${blocks === 1 ? "block" : "blocks"}`;
}

function isTopSeed(item, items) {
  const maxLikes = Math.max(0, ...items.map(seed => Number(seed.likes) || 0));
  return maxLikes > 1 && (Number(item.likes) || 0) === maxLikes;
}

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededPercent(hash, shift, min, max) {
  return min + (((hash >>> shift) & 255) / 255) * (max - min);
}

function cssUrl(value) {
  return String(value || "").replace(/["\\\n\r]/g, "");
}

function seededNoise(seed, x, z) {
  let n = seed ^ Math.imul(x + 101, 374761393) ^ Math.imul(z + 37, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function previewPalette(dimension) {
  if (dimension === "nether") {
    return {
      water: "#351017",
      waterEdge: "#52151d",
      low: "#5f241d",
      mid: "#7a2d1e",
      high: "#9b3b20",
      snow: "#d85f2e",
      forest: "#2a1517",
      shore: "#ba6f3b",
      grid: "rgba(24,10,12,.28)"
    };
  }
  if (dimension === "end") {
    return {
      water: "#10101b",
      waterEdge: "#1b1930",
      low: "#817f52",
      mid: "#b4b06e",
      high: "#d7d28a",
      snow: "#ece7aa",
      forest: "#343125",
      shore: "#cbc681",
      grid: "rgba(30,28,42,.30)"
    };
  }
  return {
    water: "#091e9c",
    waterEdge: "#173bbb",
    low: "#7faa54",
    grass: "#8bb45b",
    mid: "#5f963f",
    high: "#3f7f3f",
    hill: "#6b7d57",
    stone: "#858d85",
    snow: "#e8eef0",
    forest: "#21633b",
    forest2: "#0f6f35",
    shore: "#f3dc64",
    grid: "rgba(8,28,18,.22)"
  };
}

function minecraftPreviewSvg(item) {
  const seed = hashString(`${item.seed}|${item.version}|${item.dimension}`);
  const palette = previewPalette(item.dimension);
  const cols = 32;
  const rows = 14;
  const cell = 16;
  const waterBand = seededPercent(seed, 0, 4, 19);
  const lakeX = seededPercent(seed, 8, 10, 28);
  const lakeY = seededPercent(seed, 16, 2, 11);
  const lakeR = seededPercent(seed, 24, 2.4, 4.8);
  const riverOffset = seededPercent(seed, 5, 7, 25);
  const snowCenterX = seededPercent(seed, 13, 8, 27);
  const snowCenterY = seededPercent(seed, 21, 1, 9);
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cols * cell} ${rows * cell}" shape-rendering="crispEdges">`];
  parts.push(`<rect width="100%" height="100%" fill="${palette.mid}"/>`);
  for (let z = 0; z < rows; z += 1) {
    for (let x = 0; x < cols; x += 1) {
      const n = seededNoise(seed, x, z);
      const n2 = seededNoise(seed ^ 0x9e3779b9, Math.floor(x / 2), Math.floor(z / 2));
      const n3 = seededNoise(seed ^ 0x85ebca6b, x + 11, z + 7);
      const coastLine = waterBand + Math.sin((z + seed % 11) * 0.75) * 2.2 + Math.sin(z * 1.7) * 0.8;
      const riverLine = riverOffset + Math.sin((z + seed % 13) * 0.72) * 3.6;
      const river = Math.abs(x - riverLine) < (n3 > 0.64 ? 1.25 : 0.85);
      const coast = x < coastLine;
      const lake = Math.hypot((x - lakeX) / 1.45, z - lakeY) < lakeR + (n2 - .5);
      const nearWater = Math.abs(x - coastLine) < 1.5 || Math.abs(x - riverLine) < 1.7 || Math.abs(Math.hypot((x - lakeX) / 1.45, z - lakeY) - lakeR) < 1.2;
      const mountain = Math.hypot((x - snowCenterX) / 1.3, z - snowCenterY) < 4.4 && n2 > 0.18;
      let color = n < 0.24 ? palette.low : n < 0.52 ? palette.grass || palette.mid : palette.mid;
      if (coast || river || lake) color = n > 0.18 ? palette.water : palette.waterEdge;
      else if (nearWater && n > 0.25) color = palette.shore;
      else if (mountain && n > 0.68) color = palette.snow;
      else if (mountain && n > 0.38) color = palette.stone || palette.high;
      else if (n2 > 0.74) color = palette.forest;
      else if (n3 > 0.86) color = palette.forest2 || palette.high;
      else if (n > 0.82) color = palette.high;
      parts.push(`<rect x="${x * cell}" y="${z * cell}" width="${cell}" height="${cell}" fill="${color}"/>`);
      if (!(coast || river || lake) && n3 > 0.90) {
        parts.push(`<rect x="${x * cell + 5}" y="${z * cell + 5}" width="6" height="6" fill="${palette.high}" opacity=".78"/>`);
      }
    }
  }
  parts.push(`<path d="M0 0H${cols * cell}V${rows * cell}H0Z" fill="none" stroke="${palette.grid}" stroke-width="1"/>`);
  parts.push(`</svg>`);
  return `data:image/svg+xml,${encodeURIComponent(parts.join(""))}`;
}

function spawnPreviewStyle(item) {
  const url = cssUrl(item.previewUrl);
  return url ? `background-image:linear-gradient(180deg, rgba(0,0,0,.04), rgba(0,0,0,.18)),url('${url}');` : "";
}

function minecraftPreviewCells(item) {
  if (item.previewUrl) return "";
  const seed = hashString(`${item.seed}|${item.version}|${item.dimension}`);
  const palette = previewPalette(item.dimension);
  const cols = 32;
  const rows = 14;
  const waterBand = seededPercent(seed, 0, 4, 18);
  const lakeX = seededPercent(seed, 8, 10, 28);
  const lakeY = seededPercent(seed, 16, 2, 11);
  const lakeR = seededPercent(seed, 24, 2.8, 5.2);
  const lake2X = seededPercent(seed, 3, 5, 24);
  const lake2Y = seededPercent(seed, 11, 2, 12);
  const lake2R = seededPercent(seed, 19, 1.8, 3.4);
  const riverOffset = seededPercent(seed, 5, 7, 25);
  const snowCenterX = seededPercent(seed, 13, 8, 27);
  const snowCenterY = seededPercent(seed, 21, 1, 9);
  const cells = [];

  for (let z = 0; z < rows; z += 1) {
    for (let x = 0; x < cols; x += 1) {
      const n = seededNoise(seed, x, z);
      const n2 = seededNoise(seed ^ 0x9e3779b9, Math.floor(x / 2), Math.floor(z / 2));
      const n3 = seededNoise(seed ^ 0x85ebca6b, x + 11, z + 7);
      const coastLine = waterBand + Math.sin((z + seed % 11) * 0.75) * 2.4 + Math.sin(z * 1.7) * 0.9;
      const riverLine = riverOffset + Math.sin((z + seed % 13) * 0.72) * 3.8;
      const river = Math.abs(x - riverLine) < (n3 > 0.64 ? 1.35 : 0.95);
      const coast = x < coastLine;
      const lake = Math.hypot((x - lakeX) / 1.45, z - lakeY) < lakeR + (n2 - .5);
      const lake2 = Math.hypot((x - lake2X) / 1.2, z - lake2Y) < lake2R + (n - .5);
      const nearWater = Math.abs(x - coastLine) < 1.5
        || Math.abs(x - riverLine) < 1.7
        || Math.abs(Math.hypot((x - lakeX) / 1.45, z - lakeY) - lakeR) < 1.2
        || Math.abs(Math.hypot((x - lake2X) / 1.2, z - lake2Y) - lake2R) < 1.1;
      const mountain = Math.hypot((x - snowCenterX) / 1.3, z - snowCenterY) < 4.4 && n2 > 0.18;
      let color = n < 0.24 ? palette.low : n < 0.52 ? palette.grass || palette.mid : palette.mid;
      if (coast || river || lake || lake2) color = n > 0.18 ? palette.water : palette.waterEdge;
      else if (nearWater && n > 0.25) color = palette.shore;
      else if (mountain && n > 0.68) color = palette.snow;
      else if (mountain && n > 0.38) color = palette.stone || palette.high;
      else if (n2 > 0.74) color = palette.forest;
      else if (n3 > 0.86) color = palette.forest2 || palette.high;
      else if (n > 0.82) color = palette.high;
      cells.push(`<span class="public-seed-map-cell" style="background:${color}"></span>`);
    }
  }

  return `<div class="public-seed-map-grid" aria-hidden="true">${cells.join("")}</div>`;
}

function previewPlaceholder(item) {
  if (item.previewUrl) return "";
  return `<div class="public-seed-preview-placeholder"><strong>Generating preview</strong><span>Building a real spawn map preview</span></div>`;
}

function rememberGeneratedPublicPreview(item) {
  if (!item?.previewUrl) return;
  state.publicSeeds = state.publicSeeds.map(seed => sameSeedItem(seed, item) ? { ...seed, previewUrl: item.previewUrl } : seed);
  const favoriteIndex = favoriteSeedIndex(item.key);
  if (favoriteIndex >= 0) {
    state.favoriteSeeds[favoriteIndex] = { ...state.favoriteSeeds[favoriteIndex], previewUrl: item.previewUrl };
    writeFavoriteSeeds();
  }
}

async function hydratePublicSeedPreview(item, card) {
  if (!item || item.previewUrl || !card?.isConnected) return;
  const jobKey = item.id || item.key;
  if (publicSeedPreviewJobs.has(jobKey)) return;
  const job = (async () => {
    const spawn = {
      x: Number.isFinite(Number(item.spawnX)) ? Number(item.spawnX) : Number(item.centerX) || 0,
      z: Number.isFinite(Number(item.spawnZ)) ? Number(item.spawnZ) : Number(item.centerZ) || 0
    };
    const previewUrl = await createSpawnBiomePreview(item, spawn);
    if (!previewUrl) return;
    const updated = { ...item, previewUrl };
    rememberGeneratedPublicPreview(updated);
    const liveCard = card.isConnected ? card : els.publicSeedsList?.querySelector(`[data-seed-key="${CSS.escape(jobKey)}"]`);
    const preview = liveCard?.querySelector(".public-seed-preview");
    if (!preview) return;
    preview.classList.add("has-preview");
    preview.setAttribute("style", spawnPreviewStyle(updated));
    preview.querySelector(".public-seed-preview-placeholder")?.remove();
  })().finally(() => publicSeedPreviewJobs.delete(jobKey));
  publicSeedPreviewJobs.set(jobKey, job);
}

function buildSeedCardShareUrl(item) {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("seed", item.seed);
  url.searchParams.set("version", item.version);
  url.searchParams.set("dimension", item.dimension || "overworld");
  url.searchParams.set("x", String(Math.round(Number(item.centerX) || 0)));
  url.searchParams.set("z", String(Math.round(Number(item.centerZ) || 0)));
  url.searchParams.set("zoom", (4 / (Number(item.zoom) || DEFAULT_ZOOM)).toFixed(3).replace(/0+$/, "").replace(/\.$/, ""));
  url.searchParams.set("load", "1");
  return url.toString();
}

function renderPublicSeedCards() {
  if (!els.publicSeedsList || !els.publicSeedsEmpty) return;
  const items = publicSeedSource();
  els.publicSeedsList.innerHTML = "";
  els.publicSeedsEmpty.classList.toggle("hidden", items.length > 0);
  els.publicSeedsPanel?.classList.toggle("has-seeds", items.length > 0);
  if (els.publicSeedsCount) {
    els.publicSeedsCount.textContent = `${items.length} ${items.length === 1 ? "seed" : "seeds"}`;
  }

  for (const item of items) {
    const clean = sanitizeFavorite(item);
    if (!clean) continue;
    const topSeed = isTopSeed(clean, items);
    const locations = clean.nearby?.length ? clean.nearby : [];
    const liked = publicSeedIsLiked(clean);
    const userName = clean.user?.name || "Community";
    const card = document.createElement("article");
    card.className = `public-seed-card${topSeed ? " is-top-seed" : ""}${liked ? " is-liked" : ""}`;
    card.dataset.seedKey = clean.id || clean.key;
    card.innerHTML = `
      <div class="public-seed-preview${clean.previewUrl ? " has-preview" : ""}" style="${spawnPreviewStyle(clean)}">
        ${previewPlaceholder(clean)}
        <span class="public-seed-rank">${topSeed ? "Top seed" : "Featured"}</span>
        <button class="public-seed-likes" type="button" title="${liked ? "Unlike this seed" : "Like this seed"}" aria-pressed="${String(liked)}">${ICONS.heart}<span>${escapeHtml(publicSeedLikesText(clean))}</span></button>
        <span class="public-seed-spawn-pin" title="Spawn point" aria-label="Spawn point">${iconMarkup("map", STRUCT_META.spawn.asset)}</span>
      </div>
      <div class="public-seed-footer">
        <span class="public-seed-value">${escapeHtml(clean.seed)}</span>
        <button class="icon-only public-copy" type="button" title="Copy seed">${ICONS.copy}</button>
      </div>
      <div class="public-seed-sub">${escapeHtml(clean.versionLabel || clean.version)} &middot; ${escapeHtml(clean.dimensionLabel || dimensionText(clean.dimension))} &middot; by ${escapeHtml(userName)}</div>
      <div class="public-seed-meta">
        <span>Spawn ${escapeHtml(clean.spawnX)}, ${escapeHtml(clean.spawnZ)}</span>
        <span>Saved ${escapeHtml(compactDate(clean.savedAt))}</span>
      </div>
      <div class="public-seed-nearby">
        ${locations.length
          ? locations.map(location => `<span>${escapeHtml(location.label)} <b>${escapeHtml(distanceText(location.distance))}</b></span>`).join("")
          : `<span>No nearby locations saved yet</span>`}
      </div>
      <div class="public-seed-actions">
        <button class="mini-link public-load" type="button">${ICONS.play}<span>Load</span></button>
        <button class="mini-link public-share" type="button">${ICONS.link}<span>Share</span></button>
      </div>
    `;
    card.querySelector(".public-seed-likes").addEventListener("click", () => togglePublicSeedLike(clean));
    card.querySelector(".public-load").addEventListener("click", () => loadFavoriteSeed(clean));
    card.querySelector(".public-copy").addEventListener("click", () => copyText(clean.seed, "Seed copied"));
    card.querySelector(".public-share").addEventListener("click", () => copyText(buildSeedCardShareUrl(clean), "Seed link copied"));
    els.publicSeedsList.append(card);
    hydratePublicSeedPreview(clean, card);
  }
  queueFrameHeightPost();
}

async function loadPublicSeedCards() {
  if (!els.publicSeedsList || state.publicSeedsBusy) return;
  state.publicSeedsBusy = true;
  els.refreshPublicSeeds?.classList.add("is-loading");
  try {
    const path = SEED_VAULT_ENABLED
      ? seedVaultPath(`/api/v2/seed-vault/public-seeds?page=1&per_page=${PUBLIC_SEEDS_LIMIT}`)
      : `/api/seeds/public?limit=${PUBLIC_SEEDS_LIMIT}`;
    const data = await seedApiRequest(path, { method: "GET", headers: {} });
    const seeds = seedApiResponseList(data);
    state.publicSeeds = seeds.map(sanitizeFavorite).filter(Boolean);
  } catch (err) {
    console.warn("Public seed API unavailable; using local favorites", err);
    state.publicSeeds = [];
  } finally {
    state.publicSeedsBusy = false;
    els.refreshPublicSeeds?.classList.remove("is-loading");
    renderPublicSeedCards();
  }
}

async function restorePendingLikedSeed() {
  if (!seedAuthWasCompleted()) return;
  let item = null;
  try {
    item = sanitizeFavorite(JSON.parse(sessionStorage.getItem(PENDING_LIKED_SEED_STORAGE_KEY) || "null"));
    sessionStorage.removeItem(PENDING_LIKED_SEED_STORAGE_KEY);
  } catch {
    item = null;
  }
  clearSeedAuthReturnParam();
  if (item) await addFavoriteSeed(item, { skipAuth: true, fromAuth: true });
}

function initFavoriteSeeds() {
  readFavoriteSeeds();
  renderFavoriteSeeds();
  renderPublicSeedCards();
  updateFavoriteButtons();
  loadPublicSeedCards();
  restorePendingLikedSeed();
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

function startPinch() {
  cancelMomentum();
  cancelZoomAnim();
  freezeMarkers();
  beginZoomTilePause();
  dragStart = null;
  panSample = null;
  canvas.classList.remove("dragging");
  const pts = Array.from(activePointers.values());
  const rect = canvas.getBoundingClientRect();
  pinchStartDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
  pinchStartZoom = state.zoom;
  pinchAnchor = screenToWorld(
    (pts[0].x + pts[1].x) / 2 - rect.left,
    (pts[0].y + pts[1].y) / 2 - rect.top
  );
}

function updatePinch() {
  const pts = Array.from(activePointers.values());
  if (pts.length < 2 || !pinchAnchor) return;
  const rect = canvas.getBoundingClientRect();
  const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
  const sx = (pts[0].x + pts[1].x) / 2 - rect.left;
  const sy = (pts[0].y + pts[1].y) / 2 - rect.top;
  state.zoom = clampMapZoom(pinchStartZoom * (pinchStartDist / dist));
  state.zoomTarget = state.zoom;
  state.viewX = pinchAnchor.x - (sx - state.width / 2) * state.zoom;
  state.viewZ = pinchAnchor.z - (sy - state.height / 2) * state.zoom;
  scheduleUrlUpdate();
  requestRender();
}

function endPinch() {
  pinchAnchor = null;
  unfreezeMarkers();
  scheduleZoomTileLoad();
  loadVisibleStructuresNow();
}

function bindEvents() {
  window.addEventListener("resize", resizeCanvas);
  canvas.addEventListener("pointerdown", event => {
    if (!state.loaded) return;
    const isFirst = activePointers.size === 0;
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    try { canvas.setPointerCapture(event.pointerId); } catch { /* pointer already gone */ }
    els.tooltip.classList.remove("visible");
    if (activePointers.size === 2) {
      startPinch();
      return;
    }
    if (activePointers.size > 2 || !isFirst) return;
    cancelMomentum();
    cancelZoomAnim();
    freezeMarkers();
    dragStart = { x: event.clientX, y: event.clientY };
    dragView = { x: state.viewX, z: state.viewZ };
    pointerMoved = false;
    panSample = { x: state.viewX, z: state.viewZ, t: performance.now() };
    panVel = { x: 0, z: 0 };
    canvas.classList.add("dragging");
  });
  canvas.addEventListener("pointerup", event => {
    const wasPinching = activePointers.size >= 2;
    activePointers.delete(event.pointerId);
    try { canvas.releasePointerCapture(event.pointerId); } catch { /* already released */ }
    if (wasPinching) {
      canvas.classList.remove("dragging");
      if (activePointers.size < 2) endPinch();
      return;
    }
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
    canvas.classList.remove("dragging");
  });
  canvas.addEventListener("pointerleave", () => {
    if (!dragStart) els.tooltip.classList.remove("visible");
  });
  canvas.addEventListener("pointercancel", event => {
    const wasPinching = activePointers.size >= 2;
    activePointers.delete(event.pointerId);
    dragStart = null;
    panSample = null;
    canvas.classList.remove("dragging");
    if (wasPinching && activePointers.size < 2) endPinch();
    else if (!wasPinching) {
      unfreezeMarkers();
      loadVisibleStructuresNow();
    }
  });
  canvas.addEventListener("pointermove", event => {
    if (activePointers.has(event.pointerId)) {
      activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }
    if (activePointers.size >= 2) {
      updatePinch();
      return;
    }
    handlePointerMove(event);
  });
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
  els.refreshPublicSeeds?.addEventListener("click", loadPublicSeedCards);
  els.seedAuthForm?.addEventListener("submit", submitSeedAuth);
  els.seedAuthLoginTab?.addEventListener("click", () => setSeedAuthMode("login"));
  els.seedAuthRegisterTab?.addEventListener("click", () => setSeedAuthMode("register"));
  els.seedAuthClose?.addEventListener("click", () => {
    pendingSeedVaultAuth = null;
    setSeedAuthVisible(false);
  });
  els.seedAuthBackdrop?.addEventListener("click", () => {
    pendingSeedVaultAuth = null;
    setSeedAuthVisible(false);
  });
  window.addEventListener("keydown", event => {
    if (event.key === "Escape" && els.seedAuthModal && !els.seedAuthModal.classList.contains("is-hidden")) {
      pendingSeedVaultAuth = null;
      setSeedAuthVisible(false);
      return;
    }
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
