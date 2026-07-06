const API = self.location.pathname.replace(/\/static\/seed-worker\.js$/, "");
const controllers = new Map();
const UNKNOWN_BIOME_RGB = [38, 45, 41];
const BIOME_COLORS = {
  0:"#0059d7",1:"#a4d34f",2:"#f8e283",3:"#709159",4:"#19792d",5:"#0d7a6e",
  6:"#558e64",7:"#005fcc",8:"#ce382d",9:"#f2f4f3",10:"#57c2e4",11:"#a9e0e9",
  12:"#dfe8eb",13:"#98a3bf",14:"#e1c9bb",15:"#d6ad7b",16:"#fdec9a",17:"#e8b73a",
  18:"#226d22",19:"#0c625d",20:"#538e4b",21:"#139626",22:"#206e23",23:"#269c31",
  24:"#0045a5",25:"#938c8c",26:"#bcdbd2",27:"#25b12b",28:"#06a906",29:"#276031",
  30:"#00605d",31:"#024344",32:"#2b7631",33:"#1e5a20",34:"#649460",35:"#c8b615",
  36:"#b6a605",37:"#c66631",38:"#c6541a",39:"#ab3c11",40:"#846fb2",41:"#a892d0",
  42:"#ccbcef",43:"#6b598f",44:"#28a8dc",45:"#1985ca",
  46:"#176ba5",47:"#074a9a",48:"#03357c",49:"#012660",50:"#021d4b",
  51:"#59a739",52:"#339241",53:"#93b455",127:"#080808",
  129:"#a4d34f",130:"#eab131",131:"#64845e",132:"#1ea623",133:"#0a6859",134:"#4c8161",
  140:"#a6afc7",149:"#19a923",151:"#26992e",155:"#1ace22",156:"#05c508",157:"#216322",
  158:"#024d4b",160:"#3d7f3e",161:"#2a7530",162:"#528150",163:"#d9c811",164:"#beb708",
  165:"#dd6523",166:"#bc5016",167:"#a9330c",168:"#26c929",169:"#189e1e",170:"#6a3e11",
  171:"#a81d1d",172:"#176e6b",173:"#414258",174:"#528641",175:"#23ac6c",177:"#6cba3b",
  178:"#55a652",179:"#e2ebed",180:"#cedce7",181:"#bdcedb",182:"#869f83",183:"#1c1c36",
  184:"#288458",185:"#fcacc2",186:"#dde5e8",187:"#dcb40a"
};
const BIOME_RGB = new Map(Object.entries(BIOME_COLORS).map(([id, hex]) => [Number(id), hexToRgb(hex)]));
const WATER_BIOMES = new Set([0, 7, 10, 11, 24, 44, 45, 46, 47, 48, 49, 50]);
const DEEP_WATER_BIOMES = new Set([24, 47, 48, 49, 50]);
const BEACH_BIOMES = new Set([16, 26]);
const SAND_BIOMES = new Set([2, 16, 17, 26, 130]);
const FOREST_BIOMES = new Set([4, 18, 21, 27, 28, 29, 32, 33, 132, 155, 156, 157, 168, 169, 185]);
const BIOME_TILE_RENDER_SCALE = 1;

function hexToRgb(hex) {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function terrainNoise(x, z) {
  let v = Math.imul(x ^ 0x45d9f3b, 0x27d4eb2d) ^ Math.imul(z ^ 0x119de1f3, 0x165667b1);
  v ^= v >>> 15;
  return ((v >>> 0) % 1000) / 1000;
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

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function mixChannel(a, b, t) {
  return a + (b - a) * t;
}

function stylizedBiomeRgb(rgb, worldX, worldZ, biomeId) {
  const n1 = smoothTerrainNoise(worldX >> 5, worldZ >> 5) - 0.5;
  const n2 = smoothTerrainNoise(worldX >> 8, worldZ >> 8) - 0.5;
  const n3 = smoothTerrainNoise(worldX >> 3, worldZ >> 3) - 0.5;
  let r = rgb[0], g = rgb[1], b = rgb[2];
  let contrast = 1 + n1 * 0.08 + n2 * 0.06;
  let lift = n2 * 5 + n3 * 2;

  if (WATER_BIOMES.has(biomeId)) {
    contrast = 1 + n1 * 0.055;
    lift = DEEP_WATER_BIOMES.has(biomeId) ? -10 + n2 * 4 : 2 + n2 * 4;
    r = mixChannel(r, 18, 0.24);
    g = mixChannel(g, 122, 0.18);
    b = mixChannel(b, 205, 0.18);
  } else if (SAND_BIOMES.has(biomeId)) {
    r = mixChannel(r, 242, 0.24);
    g = mixChannel(g, 215, 0.18);
    b = mixChannel(b, 126, 0.10);
    contrast = 1 + n1 * 0.06;
    lift += 6;
  } else if (FOREST_BIOMES.has(biomeId)) {
    r = mixChannel(r, 52, 0.16);
    g = mixChannel(g, 118, 0.16);
    b = mixChannel(b, 56, 0.10);
    lift -= 3;
    contrast = 1 + n1 * 0.10 + n2 * 0.06;
  } else {
    r = mixChannel(r, 134, 0.08);
    g = mixChannel(g, 174, 0.10);
    b = mixChannel(b, 78, 0.08);
  }

  return [
    Math.max(0, Math.min(255, r * contrast + lift)),
    Math.max(0, Math.min(255, g * contrast + lift)),
    Math.max(0, Math.min(255, b * contrast + lift))
  ];
}

function nearbyBiome(grid, s, x, z, predicate) {
  if (x > 0 && predicate(grid[z * s + x - 1])) return true;
  if (x + 1 < s && predicate(grid[z * s + x + 1])) return true;
  if (z > 0 && predicate(grid[(z - 1) * s + x])) return true;
  if (z + 1 < s && predicate(grid[(z + 1) * s + x])) return true;
  return false;
}

function nearbyBiomeDistance(grid, s, x, z, predicate, maxRadius) {
  for (let radius = 1; radius <= maxRadius; radius++) {
    for (let dz = -radius; dz <= radius; dz++) {
      const nz = z + dz;
      if (nz < 0 || nz >= s) continue;
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.abs(dx) !== radius && Math.abs(dz) !== radius) continue;
        const nx = x + dx;
        if (nx < 0 || nx >= s) continue;
        if (predicate(grid[nz * s + nx])) return radius;
      }
    }
  }
  return 0;
}

function biomeEdgeStrength(grid, s, x, z, id) {
  let edge = 0;
  if (x > 0 && grid[z * s + x - 1] !== id) edge++;
  if (x + 1 < s && grid[z * s + x + 1] !== id) edge++;
  if (z > 0 && grid[(z - 1) * s + x] !== id) edge++;
  if (z + 1 < s && grid[(z + 1) * s + x] !== id) edge++;
  return Math.min(1, edge / 3);
}

function applyStylizedBiomePixel(pixels, j, rgb, grid, s, x, z, worldX, worldZ, biomeId) {
  const water = WATER_BIOMES.has(biomeId);
  const waterDist = nearbyBiomeDistance(grid, s, x, z, id => WATER_BIOMES.has(id), 3);
  const landDist = nearbyBiomeDistance(grid, s, x, z, id => !WATER_BIOMES.has(id), 3);
  const besideWater = waterDist > 0;
  const besideLand = landDist > 0;
  let [r, g, b] = stylizedBiomeRgb(rgb, worldX, worldZ, biomeId);

  if (water && besideLand) {
    const t = landDist === 1 ? 0.38 : landDist === 2 ? 0.22 : 0.12;
    r = mixChannel(r, 72, t);
    g = mixChannel(g, 190, t);
    b = mixChannel(b, 224, t * 0.9);
  } else if (!water && besideWater) {
    const shore = waterDist === 1 ? 0.36 : waterDist === 2 ? 0.2 : 0.1;
    const beachTint = BEACH_BIOMES.has(biomeId) || SAND_BIOMES.has(biomeId) ? shore * 1.2 : shore;
    r = mixChannel(r, 238, beachTint);
    g = mixChannel(g, 211, beachTint * 0.95);
    b = mixChannel(b, 128, beachTint * 0.62);
  }

  const edge = biomeEdgeStrength(grid, s, x, z, biomeId);
  if (edge && !water) {
    const shade = 1 - edge * 0.07;
    r *= shade; g *= shade; b *= shade;
  }

  pixels[j] = r;
  pixels[j + 1] = g;
  pixels[j + 2] = b;
  pixels[j + 3] = 255;
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

function decodeHeightGrid(data) {
  if (data?.gridEncoding !== "f32-b64" || typeof data.grid !== "string") return data;
  const raw = atob(data.grid);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  data.grid = new Float32Array(bytes.buffer);
  data.gridEncoding = "f32";
  return data;
}

// Relief-shading light, fixed direction from the northwest. Flat ground
// renders as neutral mid-gray so an 'overlay' blend leaves it unchanged;
// slopes facing the light brighten, slopes away from it darken.
const HILLSHADE_LIGHT = { x: -0.68, z: -0.54, y: 0.52 };
// Gamma curve instead of a flat multiplier: gentle slopes (rolling plains,
// where the real elevation change is only a couple of blocks) get boosted
// disproportionately so they still show visible texture, while already-steep
// slopes (mountains) aren't pushed further into saturation.
const HILLSHADE_GAIN = 82;
const HILLSHADE_GAMMA = 0.58;
// mapApproxHeight is an approximation, not real terrain — it has occasional
// single-sample spikes (e.g. at biome/ocean edges) that would otherwise
// blow out to pure black/white. Smoothing + a slope clamp keeps those from
// dominating the shading.
const HILLSHADE_MAX_SLOPE = 1.05;

function smoothedHeight(grid, s, x, z) {
  let sum = 0;
  for (let dz = -1; dz <= 1; dz++) {
    const row = (z + dz) * s;
    sum += grid[row + x - 1] + grid[row + x] + grid[row + x + 1];
  }
  return sum / 9;
}

function clampSlope(v) {
  return Math.max(-HILLSHADE_MAX_SLOPE, Math.min(HILLSHADE_MAX_SLOPE, v));
}

function clampByte(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

// `grid` is padded with a 2-sample halo (paddedSamples = inner + 4): one ring
// so the 3x3 smoothing has real neighbors at the tile edge, and one more so
// the gradient afterwards does too. Without it, adjacent tiles' shading would
// disagree right at the boundary (a visible seam).
function buildHillshadeBitmap(grid, paddedSamples, scale) {
  const inner = paddedSamples - 4;
  if (typeof OffscreenCanvas === "undefined" || inner < 2) return null;
  const canvas = new OffscreenCanvas(inner, inner);
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return null;
  const L = HILLSHADE_LIGHT;
  const lightLen = Math.hypot(L.x, L.z, L.y);
  const lx = L.x / lightLen, lz = L.z / lightLen, ly = L.y / lightLen;
  const baseDot = ly; // dot product for flat ground (normal = 0,0,1)
  const img = ctx.createImageData(inner, inner);
  const data = img.data;
  for (let z = 2; z < 2 + inner; z++) {
    for (let x = 2; x < 2 + inner; x++) {
      const hL = smoothedHeight(grid, paddedSamples, x - 1, z);
      const hR = smoothedHeight(grid, paddedSamples, x + 1, z);
      const hU = smoothedHeight(grid, paddedSamples, x, z - 1);
      const hD = smoothedHeight(grid, paddedSamples, x, z + 1);
      const dHx = clampSlope((hR - hL) / (2 * scale));
      const dHz = clampSlope((hD - hU) / (2 * scale));
      const nLen = Math.hypot(dHx, dHz, 1);
      const nx = -dHx / nLen, nz = -dHz / nLen, ny = 1 / nLen;
      const dot = nx * lx + nz * lz + ny * ly;
      const raw = dot - baseDot;
      const shade = Math.sign(raw) * Math.pow(Math.abs(raw), HILLSHADE_GAMMA) * HILLSHADE_GAIN;
      const terrace = Math.abs((smoothedHeight(grid, paddedSamples, x, z) % 12) - 6);
      const gray = 128 + shade - Math.max(0, 2.8 - terrace) * 1.6;
      // Warm highlight on lit slopes, cool shadow on the rest — a flat gray
      // hillshade reads as fog; a slight color split reads as sunlight.
      const tint = shade > 0 ? shade * 0.14 : shade * 0.20;
      const i = ((z - 2) * inner + (x - 2)) * 4;
      data[i] = clampByte(gray + tint + (shade > 0 ? 3 : 0));
      data[i + 1] = clampByte(gray + tint * 0.32 + (shade > 0 ? 2 : 0));
      data[i + 2] = clampByte(gray - tint - (shade < 0 ? 3 : 0));
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.transferToImageBitmap();
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
    const j = i * 4;
    applyStylizedBiomePixel(
      pixels,
      j,
      BIOME_RGB.get(biomeId) || UNKNOWN_BIOME_RGB,
      data.grid,
      s,
      lx,
      lz,
      baseX + lx * scale,
      baseZ + lz * scale,
      biomeId
    );
  }
  ctx.putImageData(img, 0, 0);
  const out = upscaleBiomeCanvas(canvas, s, BIOME_TILE_RENDER_SCALE);
  data.bitmap = out.transferToImageBitmap();
}

function upscaleBiomeCanvas(source, samples, scale) {
  if (scale <= 1) return source;
  const sourceCtx = source.getContext("2d", { alpha: false });
  if (!sourceCtx) return source;
  const sourceData = sourceCtx.getImageData(0, 0, samples, samples).data;
  const size = samples * scale;
  const out = new OffscreenCanvas(size, size);
  const outCtx = out.getContext("2d", { alpha: false });
  if (!outCtx) return source;
  const outImg = outCtx.createImageData(size, size);
  const outData = outImg.data;
  for (let y = 0; y < size; y++) {
    const sy = (y + 0.5) / scale - 0.5;
    const y0 = Math.max(0, Math.min(samples - 1, Math.floor(sy)));
    const y1 = Math.max(0, Math.min(samples - 1, y0 + 1));
    const ty = sy <= 0 || y0 === y1 ? 0 : sy - y0;
    for (let x = 0; x < size; x++) {
      const sx = (x + 0.5) / scale - 0.5;
      const x0 = Math.max(0, Math.min(samples - 1, Math.floor(sx)));
      const x1 = Math.max(0, Math.min(samples - 1, x0 + 1));
      const tx = sx <= 0 || x0 === x1 ? 0 : sx - x0;
      const i00 = (y0 * samples + x0) * 4;
      const i10 = (y0 * samples + x1) * 4;
      const i01 = (y1 * samples + x0) * 4;
      const i11 = (y1 * samples + x1) * 4;
      const outI = (y * size + x) * 4;
      for (let c = 0; c < 3; c++) {
        const top = sourceData[i00 + c] + (sourceData[i10 + c] - sourceData[i00 + c]) * tx;
        const bottom = sourceData[i01 + c] + (sourceData[i11 + c] - sourceData[i01 + c]) * tx;
        outData[outI + c] = top + (bottom - top) * ty;
      }
      outData[outI + 3] = 255;
    }
  }
  softenBiomePixels(outData, size);
  outCtx.putImageData(outImg, 0, 0);
  return out;
}

function softenBiomePixels(data, size) {
  const copy = new Uint8ClampedArray(data);
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const i = (y * size + x) * 4;
      const n = ((y - 1) * size + x) * 4;
      const s = ((y + 1) * size + x) * 4;
      const w = (y * size + x - 1) * 4;
      const e = (y * size + x + 1) * 4;
      for (let c = 0; c < 3; c++) {
        const avg = (copy[i + c] * 4 + copy[n + c] + copy[s + c] + copy[w + c] + copy[e + c]) / 8;
        data[i + c] = copy[i + c] * 0.58 + avg * 0.42;
      }
    }
  }
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
    } else if (type === "heightTile") {
      const params = new URLSearchParams({
        seed: payload.seed,
        version: payload.version,
        x: String(payload.x),
        z: String(payload.z),
        w: String(payload.w),
        h: String(payload.h),
        scale: String(payload.scale),
        format: "f32"
      });
      data = await getJson(`/api/heights?${params}`, controller?.signal);
      decodeHeightGrid(data);
      if (data?.grid) data.shadeBitmap = buildHillshadeBitmap(data.grid, Number(payload.w), Number(payload.scale));
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
    const transfer = [];
    if (data?.bitmap) transfer.push(data.bitmap);
    if (data?.shadeBitmap) transfer.push(data.shadeBitmap);
    if (data?.grid instanceof Float32Array) transfer.push(data.grid.buffer);
    self.postMessage({ id, ok: true, data }, transfer);
  } catch (err) {
    self.postMessage({ id, ok: false, error: err.message || "Worker request failed" });
  } finally {
    controllers.delete(id);
  }
};
