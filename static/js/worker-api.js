function initWorker() {
  if (!("Worker" in window)) return;
  workerPool = [];
  for (let i = 0; i < WORKER_POOL_SIZE; i++) {
    const w = new Worker(WORKER_URL);
    w.addEventListener("message", event => {
      const { id, ok, data, error } = event.data || {};
      const job = workerJobs.get(id);
      if (!job) return;
      workerJobs.delete(id);
      if (ok) {
        job.resolve(data);
      } else {
        job.reject(new Error(error || "Worker task failed"));
      }
    });
    w.addEventListener("error", event => {
      for (const [id, job] of workerJobs) {
        if (job.worker === w) {
          job.reject(new Error(event.message || "Worker failed"));
          workerJobs.delete(id);
        }
      }
    });
    workerPool.push(w);
  }
}

function workerRequest(type, payload = {}) {
  if (!workerPool.length) {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const promise = directRequest(type, payload, controller?.signal);
    promise.cancel = () => controller?.abort();
    return promise;
  }
  const w = workerPool[workerCursor];
  workerCursor = (workerCursor + 1) % workerPool.length;
  const id = ++workerSeq;
  const promise = new Promise((resolve, reject) => {
    workerJobs.set(id, { resolve, reject, worker: w, type, payload });
    w.postMessage({ id, type, payload });
  });
  promise.cancel = () => {
    const job = workerJobs.get(id);
    if (!job) return;
    workerJobs.delete(id);
    w.postMessage({ id, type: "cancel" });
    job.reject(new DOMException("Request canceled", "AbortError"));
  };
  return promise;
}

function cancelWorkerJob(id, reason = "Request canceled") {
  const job = workerJobs.get(id);
  if (!job) return;
  workerJobs.delete(id);
  job.worker.postMessage({ id, type: "cancel" });
  job.reject(new DOMException(reason, "AbortError"));
}

function cancelWorldWorkerJobs() {
  for (const [id, job] of [...workerJobs]) {
    if (job.type === "biomeTile" || job.type === "structures" || job.type === "structureType" || job.type === "findBiome") {
      cancelWorkerJob(id, "World changed");
    }
  }
}

async function directRequest(type, payload = {}, signal = undefined) {
  let url = "";
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
    url = `${API}/api/biomes?${params}`;
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
    url = `${API}/api/all_structures?${params}`;
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
    url = `${API}/api/structures?${params}`;
  } else if (type === "randomSeed") {
    url = `${API}/api/random_seed`;
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
    url = `${API}/api/search_seeds?${params}`;
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
    url = `${API}/api/find_biome?${params}`;
  } else if (type === "capabilities") {
    url = `${API}/api/capabilities`;
  }
  const response = await fetch(url, { signal });
  const data = await response.json();
  if (!response.ok || data.error) throw new Error(data.error || "Request failed");
  return data;
}
