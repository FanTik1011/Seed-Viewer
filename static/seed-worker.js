const API = "";
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
  48:"#000040",49:"#202038",50:"#404090",127:"#000000",129:"#B5DB88",130:"#FFBC40",
  131:"#888888",132:"#2D8E49",133:"#338E81",134:"#2FFFDA",140:"#B4DCDC",
  149:"#7BA331",151:"#8AB33F",155:"#589C6C",156:"#47875A",157:"#687942",
  158:"#597D72",160:"#818E79",161:"#6D7766",162:"#789878",163:"#E5DA87",
  164:"#CFC58C",165:"#FF6D3D",166:"#D8BF8D",167:"#F2B48D",168:"#768E14",
  169:"#3B470A",170:"#5E3830",171:"#DD0808",172:"#49907B",173:"#403636",
  174:"#507050",175:"#59C93C",177:"#60A445",178:"#47783E",179:"#FFFFFF",
  180:"#B0B0B0",181:"#D8D8D8",182:"#A2A284",183:"#303050",184:"#2F6F50",
  185:"#F7B2C4",186:"#C9D6C9"
};
const BIOME_RGB = new Map(Object.entries(BIOME_COLORS).map(([id, hex]) => [Number(id), hexToRgb(hex)]));

function hexToRgb(hex) {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function terrainNoise(x, z) {
  let v = Math.imul(x ^ 0x45d9f3b, 0x27d4eb2d) ^ Math.imul(z ^ 0x119de1f3, 0x165667b1);
  v ^= v >>> 15;
  return ((v >>> 0) % 1000) / 1000;
}

function tintBiome(rgb, x, z, biomeId) {
  // Amidst-style flat biome colors: solid color per biome, no per-pixel noise.
  return (rgb[0] << 16) | (rgb[1] << 8) | rgb[2];
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
    const color = tintBiome(BIOME_RGB.get(biomeId) || UNKNOWN_BIOME_RGB, (baseX + lx * scale) >> 4, (baseZ + lz * scale) >> 4, biomeId);
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
        scale: String(payload.scale)
      });
      data = await getJson(`/api/biomes?${params}`, controller?.signal);
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
      data = await getJson("/api/random_seed", controller?.signal);
    } else if (type === "searchSeeds") {
      const params = new URLSearchParams({
        version: payload.version,
        attempts: String(payload.attempts),
        radius: String(payload.radius),
        limit: String(payload.limit || 8),
        required: payload.required
      });
      data = await getJson(`/api/search_seeds?${params}`, controller?.signal);
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
