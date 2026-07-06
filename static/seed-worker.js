const API = self.location.pathname.replace(/\/static\/seed-worker\.js$/, "");
const controllers = new Map();
const UNKNOWN_BIOME_RGB = [38, 45, 41];
const BIOME_COLORS = {
  0:"#000070",1:"#8DB360",2:"#FA9418",3:"#606060",4:"#056621",5:"#0B6659",
  6:"#07F9B2",7:"#0000FF",8:"#BF3B3B",9:"#8080FF",10:"#7070D6",11:"#A0A0FF",
  12:"#FFFFFF",13:"#A0A0A0",14:"#FF00FF",15:"#A000FF",16:"#FADE55",17:"#D25F12",
  18:"#22551C",19:"#163933",20:"#72789A",21:"#537B09",22:"#2C4205",23:"#628B17",
  24:"#000030",25:"#A2A284",26:"#FAF0C0",27:"#307444",28:"#1F5F32",29:"#40511A",
  30:"#31554A",31:"#243F36",32:"#596651",33:"#454F3E",34:"#507050",35:"#BDB25F",
  36:"#A79D64",37:"#D94515",38:"#B09765",39:"#CA8C65",40:"#8080FF",41:"#8080FF",
  42:"#8080FF",43:"#8080FF",44:"#0000AC",45:"#000090",46:"#202070",47:"#000050",
  48:"#000040",49:"#202038",50:"#404090",51:"#8FA35A",52:"#1F8F4A",53:"#7F8F4A",
  127:"#000000",129:"#B5DB88",130:"#FFBC40",
  131:"#888888",132:"#2D8E49",133:"#338E81",134:"#2FFFDA",140:"#B4DCDC",
  149:"#7BA331",151:"#8AB33F",155:"#589C6C",156:"#47875A",157:"#687942",
  158:"#597D72",160:"#818E79",161:"#6D7766",162:"#789878",163:"#E5DA87",
  164:"#CFC58C",165:"#FF6D3D",166:"#D8BF8D",167:"#F2B48D",168:"#768E14",
  169:"#3B470A",170:"#5E3830",171:"#DD0808",172:"#49907B",173:"#403636",
  174:"#507050",175:"#59C93C",177:"#60A445",178:"#47783E",179:"#FFFFFF",
  180:"#B0B0B0",181:"#D8D8D8",182:"#A2A284",183:"#303050",184:"#2F6F50",
  185:"#F7B2C4",186:"#C9D6C9"
};
function hexToRgb(hex) {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function clamp8(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v | 0;
}

// Push each biome color toward richer saturation and slightly higher
// brightness once at load time, so per-pixel rendering only has to do a
// cheap multiply (see tintBiome) instead of repeating this math per pixel.
function vividRgb([r, g, b]) {
  const avg = (r + g + b) / 3;
  const sat = 1.28;
  const bright = 1.08;
  return [
    clamp8((avg + (r - avg) * sat) * bright),
    clamp8((avg + (g - avg) * sat) * bright),
    clamp8((avg + (b - avg) * sat) * bright),
  ];
}

const BIOME_RGB = new Map(Object.entries(BIOME_COLORS).map(([id, hex]) => [Number(id), vividRgb(hexToRgb(hex))]));

// Water/void biomes stay flat-shaded so oceans read as smooth rather than noisy.
const RELIEF_FLAT_BIOMES = new Set([0, 7, 10, 11, 24, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 127]);
// Lattice spacing for the fake heightmap, in chunks (broad hills + finer detail octave).
const RELIEF_CELL = 7;
const RELIEF_CELL_FINE = 3;
// Height-band spacing (0..1 scale) for the topographic contour-line accents:
// a coarser primary ring plus a finer hachure-style layer on top.
const RELIEF_CONTOUR_STEP = 0.05;
const RELIEF_CONTOUR_STEP_FINE = 0.018;

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
  return latticeHeight(cx, cz, RELIEF_CELL, 0) * 0.7 + latticeHeight(cx, cz, RELIEF_CELL_FINE, 97) * 0.3;
}

// Darkens a thin band each time `h` crosses a multiple of `step`, i.e. a
// topographic contour line at that height.
function contourDarken(h, step, width, strength) {
  const band = (h % step) / step;
  return band < width ? strength * (1 - band / width) : 0;
}

// Hillshade from the fake heightmap's slope, plus stacked contour-line rings
// (coarse + fine) for a topographic-map look.
function reliefLight(cx, cz, biomeId) {
  if (RELIEF_FLAT_BIOMES.has(biomeId)) return 1;
  const h = terrainHeight(cx, cz);
  const hx = terrainHeight(cx + 1, cz);
  const hz = terrainHeight(cx, cz + 1);
  let light = 1 + (h - hx) * 2.6 + (h - hz) * 1.9;
  light -= contourDarken(h, RELIEF_CONTOUR_STEP, 0.14, 0.16);
  light -= contourDarken(h, RELIEF_CONTOUR_STEP_FINE, 0.22, 0.08);
  return light < 0.48 ? 0.48 : light > 1.34 ? 1.34 : light;
}

function tintBiome(rgb, x, z, biomeId) {
  const light = reliefLight(x, z, biomeId);
  const r = clamp8(rgb[0] * light);
  const g = clamp8(rgb[1] * light);
  const b = clamp8(rgb[2] * light);
  return (r << 16) | (g << 8) | b;
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
