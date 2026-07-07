const API = self.location.pathname.replace(/\/static\/seed-worker\.js$/, "");
const controllers = new Map();
const UNKNOWN_BIOME_RGB = [38, 45, 41];
// Official cubiomes biome colors (cubiomes/util.c initBiomeColors), the same
// palette mcseedmap.net credits as its source — in turn based on Amidst's
// biome color table, tuned for clear contrast between neighboring biomes
// rather than raw vanilla map-item colors.
const BIOME_COLORS = {
  0:"#000070",1:"#8DB360",2:"#FA9418",3:"#606060",4:"#056621",5:"#0B6A5F",
  6:"#07F9B2",7:"#0000FF",8:"#572526",9:"#8080FF",10:"#7070D6",11:"#A0A0FF",
  12:"#FFFFFF",13:"#A0A0A0",14:"#FF00FF",15:"#A000FF",16:"#FADE55",17:"#D25F12",
  18:"#22551C",19:"#163933",20:"#72789A",21:"#507B0A",22:"#2C4205",23:"#60930F",
  24:"#000030",25:"#A2A284",26:"#FAF0C0",27:"#307444",28:"#1F5F32",29:"#40511A",
  30:"#31554A",31:"#243F36",32:"#596651",33:"#454F3E",34:"#5B7352",35:"#BDB25F",
  36:"#A79D64",37:"#D94515",38:"#B09765",39:"#CA8C65",40:"#4B4BAB",41:"#C9C959",
  42:"#B5B536",43:"#7070CC",44:"#0000AC",45:"#000090",46:"#202070",47:"#000050",
  48:"#000040",49:"#202038",50:"#404090",51:"#2F560F",52:"#47840E",53:"#789E31",
  127:"#000000",129:"#B5DB88",130:"#FFBC40",131:"#888888",132:"#2D8E49",
  133:"#339287",134:"#2FFFDA",140:"#B4DCDC",149:"#78A332",151:"#88BB37",
  155:"#589C6C",156:"#47875A",157:"#687942",158:"#597D72",160:"#818E79",
  161:"#6D7766",162:"#839B7A",163:"#E5DA87",164:"#CFC58C",165:"#FF6D3D",
  166:"#D8BF8D",167:"#F2B48D",168:"#849500",169:"#5C6C04",170:"#4D3A2E",
  171:"#981A11",172:"#49907B",173:"#645F63",174:"#4E3012",175:"#283C00",
  177:"#60A445",178:"#47726C",179:"#C4C4C4",180:"#DCDCC8",181:"#B0B3CE",
  182:"#7B8F74",183:"#031F29",184:"#2CCC8E",185:"#FF91C8",186:"#696D95"
};
function hexToRgb(hex) {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function clamp8(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v | 0;
}

// A light saturation/brightness lift once at load time, so per-pixel
// rendering only has to do a cheap multiply (see tintBiome) instead of
// repeating this math per pixel. Kept subtle now that BIOME_COLORS is the
// cubiomes/Amidst palette, which is already tuned for contrast — boosting it
// hard (like a raw vanilla palette needs) would just wash it out.
function vividRgb([r, g, b]) {
  const avg = (r + g + b) / 3;
  const sat = 1.1;
  const bright = 1.03;
  return [
    clamp8((avg + (r - avg) * sat) * bright),
    clamp8((avg + (g - avg) * sat) * bright),
    clamp8((avg + (b - avg) * sat) * bright),
  ];
}

const BIOME_RGB = new Map(Object.entries(BIOME_COLORS).map(([id, hex]) => [Number(id), vividRgb(hexToRgb(hex))]));

// Water/void biomes stay flat-shaded so oceans read as smooth rather than noisy.
const RELIEF_FLAT_BIOMES = new Set([0, 7, 10, 11, 24, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 127]);
// Lattice spacing for the fake heightmap, in chunks (broad hills + finer
// detail octave). A single bilinear-noise octave alone looks like a grid of
// perfectly round "bullseye" bumps — blending in the fine octave breaks
// that up (see terrainHeight below).
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
// Coordinates are chunk-scale (world >> 4). This runs once per fetched tile
// (not per animation frame), so it stays cheap even on slow hosts like Heroku.
function terrainHeight(cx, cz) {
  return latticeHeight(cx, cz, RELIEF_CELL, 0) * 0.72 + latticeHeight(cx, cz, RELIEF_CELL_FINE, 97) * 0.28;
}

// Hypsometric color ramp: a light elevation-based tint (green low, tan/khaki
// mid, gray/white high) layered on top of the biome color, not replacing it.
// mcseedmap (and Amidst, whose palette BIOME_COLORS now uses) keep biome
// color as the primary signal and treat terrain/contour as a secondary
// overlay — a high RELIEF_TINT_WEIGHT here washed every biome into the same
// look, which is exactly what looked "broken".
const RELIEF_TINT_WEIGHT = 0.3;

// Hillshade + hypsometric ramp from the fake heightmap. The topographic
// contour lines are drawn separately as a vector overlay on the main thread
// (see tile-stream.js), so this only needs to do slope lighting, not its own
// banding. Written as scalar math with no intermediate objects/arrays (this
// runs per pixel while a tile is being built, so allocations here turn into
// GC churn).
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

function decodeBiomeGrid(data) {
  if (data?.gridEncoding !== "u8-b64" || typeof data.grid !== "string") return data;
  const raw = atob(data.grid);
  const grid = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) grid[i] = raw.charCodeAt(i);
  data.grid = grid;
  data.gridEncoding = "u8";
  return data;
}

function attachBiomeBitmap(data, payload) {
  if (!data?.grid || typeof OffscreenCanvas === "undefined") return;
  const s = Number(payload.w);
  if (!Number.isFinite(s) || s < 1 || Number(payload.h) !== s) return;
  const scale = Number(payload.scale);
  const baseX = Number(payload.x);
  const baseZ = Number(payload.z);
  const canvas = new OffscreenCanvas(s, s);
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return;
  const img = ctx.createImageData(s, s);
  const pixels = img.data;
  for (let i = 0; i < data.grid.length; i++) {
    const lx = i % s;
    const lz = Math.floor(i / s);
    const biomeId = data.grid[i];
    let color = tintBiome(BIOME_RGB.get(biomeId) || UNKNOWN_BIOME_RGB, (baseX + lx * scale) >> 4, (baseZ + lz * scale) >> 4, biomeId);
    color = applyBevel(color, edgeBevelDelta(data.grid, s, i, lx, lz, biomeId));
    const j = i * 4;
    pixels[j] = (color >> 16) & 255;
    pixels[j + 1] = (color >> 8) & 255;
    pixels[j + 2] = color & 255;
    pixels[j + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  data.bitmap = canvas.transferToImageBitmap();
}

async function getJson(path, signal) {
  const response = await fetch(`${API}${path}`, { signal });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) {
    throw new Error(data.error || `Request failed with ${response.status}`);
  }
  return data;
}

self.onmessage = async event => {
  const { id, type, payload = {} } = event.data || {};
  if (!id || !type) return;
  if (type === "cancel") {
    const controller = controllers.get(id);
    if (controller) {
      controller.abort();
      controllers.delete(id);
    }
    return;
  }

  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  if (controller) controllers.set(id, controller);
  try {
    let data;
    if (type === "biomeTile") {
      const params = new URLSearchParams({
        seed: payload.seed,
        version: payload.version,
        dimension: payload.dimension || "overworld",
        x: String(payload.x),
        z: String(payload.z),
        w: String(payload.w),
        h: String(payload.h),
        scale: String(payload.scale),
        format: "u8"
      });
      data = await getJson(`/api/biomes?${params}`, controller?.signal);
      decodeBiomeGrid(data);
      attachBiomeBitmap(data, payload);
    } else if (type === "structures") {
      const params = new URLSearchParams({
        seed: payload.seed,
        version: payload.version,
        dimension: payload.dimension || "overworld",
        x: String(payload.x),
        z: String(payload.z),
        w: String(payload.w),
        h: String(payload.h)
      });
      if (payload.types != null) params.set("types", payload.types);
      if (payload.core != null) params.set("core", payload.core ? "1" : "0");
      data = await getJson(`/api/all_structures?${params}`, controller?.signal);
    } else if (type === "structureType") {
      const params = new URLSearchParams({
        seed: payload.seed,
        version: payload.version,
        dimension: payload.dimension || "overworld",
        type: payload.structure,
        x: String(payload.x),
        z: String(payload.z),
        w: String(payload.w),
        h: String(payload.h)
      });
      data = await getJson(`/api/structures?${params}`, controller?.signal);
    } else if (type === "randomSeed") {
      const params = new URLSearchParams();
      if (payload.version) params.set("version", payload.version);
      data = await getJson(`/api/random_seed${params.toString() ? `?${params}` : ""}`, controller?.signal);
    } else if (type === "searchSeeds") {
      const params = new URLSearchParams({
        version: payload.version,
        attempts: String(payload.attempts),
        radius: String(payload.radius || payload.structureRadius || payload.biomeRadius || 1000),
        biome_radius: String(payload.biomeRadius || payload.radius || 1000),
        structure_radius: String(payload.structureRadius || payload.radius || 1000),
        limit: String(payload.limit || 8),
        required: payload.required || "",
        biomes: payload.biomes || ""
      });
      data = await getJson(`/api/search_seeds?${params}`, controller?.signal);
    } else if (type === "findBiome") {
      const params = new URLSearchParams({
        seed: payload.seed,
        version: payload.version,
        dimension: payload.dimension || "overworld",
        biome: String(payload.biome),
        origin: payload.origin || "spawn",
        x: String(payload.x ?? 0),
        z: String(payload.z ?? 0),
        radius: String(payload.radius),
        step: String(payload.step || 64),
        limit: String(payload.limit || 8)
      });
      data = await getJson(`/api/find_biome?${params}`, controller?.signal);
    } else if (type === "capabilities") {
      data = await getJson("/api/capabilities", controller?.signal);
    } else {
      throw new Error(`Unknown worker task: ${type}`);
    }
    const transfer = data?.bitmap ? [data.bitmap] : [];
    self.postMessage({ id, ok: true, data }, transfer);
  } catch (err) {
    self.postMessage({ id, ok: false, error: err.message || "Worker request failed" });
  } finally {
    controllers.delete(id);
  }
};
