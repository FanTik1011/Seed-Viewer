const API = "";

async function getJson(path) {
  const response = await fetch(`${API}${path}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) {
    throw new Error(data.error || `Request failed with ${response.status}`);
  }
  return data;
}

self.onmessage = async event => {
  const { id, type, payload = {} } = event.data || {};
  if (!id || !type) return;

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
      data = await getJson(`/api/biomes?${params}`);
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
      data = await getJson(`/api/all_structures?${params}`);
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
      data = await getJson(`/api/structures?${params}`);
    } else if (type === "randomSeed") {
      data = await getJson("/api/random_seed");
    } else if (type === "searchSeeds") {
      const params = new URLSearchParams({
        version: payload.version,
        attempts: String(payload.attempts),
        radius: String(payload.radius),
        limit: String(payload.limit || 8),
        required: payload.required
      });
      data = await getJson(`/api/search_seeds?${params}`);
    } else if (type === "capabilities") {
      data = await getJson("/api/capabilities");
    } else {
      throw new Error(`Unknown worker task: ${type}`);
    }
    self.postMessage({ id, ok: true, data });
  } catch (err) {
    self.postMessage({ id, ok: false, error: err.message || "Worker request failed" });
  }
};
