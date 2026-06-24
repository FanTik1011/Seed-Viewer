function initWorker() {
  if (!("Worker" in window)) return;
  destroyWorkers();
  workerPool = [];
  workerLoads = [];
  for (let i = 0; i < workerPoolTarget(); i++) {
    const w = new Worker(WORKER_URL);
    w.addEventListener("message", event => {
      const { id, ok, data, error } = event.data || {};
      const job = workerJobs.get(id);
      if (!job) return;
      workerJobs.delete(id);
      workerLoads[job.workerIndex] = Math.max(0, (workerLoads[job.workerIndex] || 1) - 1);
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
          workerLoads[job.workerIndex] = Math.max(0, (workerLoads[job.workerIndex] || 1) - 1);
        }
      }
    });
    workerPool.push(w);
    workerLoads.push(0);
  }
}

function destroyWorkers() {
  if (!workerPool.length) return;
  cancelWorldWorkerJobs();
  for (const worker of workerPool) worker.terminate();
  workerPool = [];
  workerLoads = [];
  workerCursor = 0;
}

function tuneWorkerPool() {
  if (!("Worker" in window)) return;
  if (workerPool.length === workerPoolTarget()) return;
  initWorker();
}

function workerRequest(type, payload = {}) {
  if (!workerPool.length) {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const promise = directRequest(type, payload, controller?.signal);
    promise.cancel = () => controller?.abort();
    return promise;
  }
  let workerIndex = workerCursor % workerPool.length;
  for (let i = 0; i < workerPool.length; i++) {
    if ((workerLoads[i] || 0) < (workerLoads[workerIndex] || 0)) workerIndex = i;
  }
  workerCursor = (workerIndex + 1) % workerPool.length;
  const w = workerPool[workerIndex];
  const id = ++workerSeq;
  const promise = new Promise((resolve, reject) => {
    workerLoads[workerIndex] = (workerLoads[workerIndex] || 0) + 1;
    workerJobs.set(id, { resolve, reject, worker: w, workerIndex, type, payload });
    w.postMessage({ id, type, payload });
  });
  promise.cancel = () => {
    const job = workerJobs.get(id);
    if (!job) return;
    workerJobs.delete(id);
    workerLoads[job.workerIndex] = Math.max(0, (workerLoads[job.workerIndex] || 1) - 1);
    w.postMessage({ id, type: "cancel" });
    job.reject(new DOMException("Request canceled", "AbortError"));
  };
  return promise;
}

function cancelWorkerJob(id, reason = "Request canceled") {
  const job = workerJobs.get(id);
  if (!job) return;
  workerJobs.delete(id);
  workerLoads[job.workerIndex] = Math.max(0, (workerLoads[job.workerIndex] || 1) - 1);
  job.worker.postMessage({ id, type: "cancel" });
  job.reject(new DOMException(reason, "AbortError"));
}

function cancelWorldWorkerJobs() {
  for (const [id, job] of [...workerJobs]) {
    if (job.type === "biomeTile" || job.type === "structures" || job.type === "structureType") {
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
      scale: String(payload.scale),
      format: "bin"
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
      radius: String(payload.radius),
      limit: String(payload.limit || 8),
      required: payload.required
    });
    url = `${API}/api/search_seeds?${params}`;
  } else if (type === "capabilities") {
    url = `${API}/api/capabilities`;
  }
  const response = await fetch(url, { signal });
  const contentType = response.headers.get("content-type") || "";
  if (type === "biomeTile" && response.ok && !contentType.includes("application/json")) {
    const buffer = await response.arrayBuffer();
    const expected = Math.max(0, Number(payload.w) * Number(payload.h));
    return {
      seed: payload.seed,
      version: payload.version,
      dimension: payload.dimension || "overworld",
      x: payload.x,
      z: payload.z,
      w: payload.w,
      h: payload.h,
      scale: payload.scale,
      grid: new Uint16Array(buffer, 0, Math.min(expected, buffer.byteLength / 2))
    };
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) throw new Error(data.error || "Request failed");
  return data;
}
