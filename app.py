from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import ctypes
import os
import sys
import random
import struct
import logging
import math
from concurrent.futures import ThreadPoolExecutor, as_completed
from functools import wraps, lru_cache

# ─── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger(__name__)

app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app, origins=["http://localhost:*", "http://127.0.0.1:*"])

# ─── Load shared library (cross-platform) ─────────────────────────────────────
def _find_lib():
    base = os.path.dirname(os.path.abspath(__file__))
    if sys.platform.startswith("win"):
        names = ["libseedmap.dll", "libseedmap.so", "libseedmap.dylib"]
    elif sys.platform == "darwin":
        names = ["libseedmap.dylib", "libseedmap.so", "libseedmap.dll"]
    else:
        names = ["libseedmap.so", "libseedmap.dylib", "libseedmap.dll"]
    candidates = [os.path.join(base, name) for name in names]
    for path in candidates:
        if os.path.isfile(path):
            return path
    raise FileNotFoundError(
        f"Native library not found. Looked in: {candidates}\n"
        "Build libseedmap with your cubiomes wrapper and place it next to app.py."
    )

try:
    LIB_PATH = _find_lib()
    lib = ctypes.CDLL(LIB_PATH)
    log.info("Loaded library: %s", LIB_PATH)
except FileNotFoundError as e:
    log.critical(str(e))
    sys.exit(1)

# ─── Structs ───────────────────────────────────────────────────────────────────
class SpawnPos(ctypes.Structure):
    _fields_ = [("x", ctypes.c_int), ("z", ctypes.c_int)]

class SHPos(ctypes.Structure):
    _fields_ = [("x", ctypes.c_int), ("z", ctypes.c_int), ("ring", ctypes.c_int)]

class StructPos(ctypes.Structure):
    _fields_ = [("x", ctypes.c_int), ("z", ctypes.c_int)]

# ─── Function signatures ───────────────────────────────────────────────────────
lib.get_biome_grid.restype  = ctypes.POINTER(ctypes.c_int)
lib.get_biome_grid.argtypes = [
    ctypes.c_longlong, ctypes.c_int,
    ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int,
]

try:
    lib.get_biome_grid_dim.restype  = ctypes.POINTER(ctypes.c_int)
    lib.get_biome_grid_dim.argtypes = [
        ctypes.c_longlong, ctypes.c_int, ctypes.c_int,
        ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int,
    ]
    HAS_DIM_BIOMES = True
except AttributeError:
    HAS_DIM_BIOMES = False

lib.free_array.restype  = None
lib.free_array.argtypes = [ctypes.POINTER(ctypes.c_int)]

lib.get_spawn.restype  = SpawnPos
lib.get_spawn.argtypes = [ctypes.c_longlong, ctypes.c_int]

lib.get_strongholds.restype  = ctypes.c_int
lib.get_strongholds.argtypes = [
    ctypes.c_longlong, ctypes.c_int, ctypes.POINTER(SHPos), ctypes.c_int,
]

lib.get_structures.restype  = ctypes.c_int
lib.get_structures.argtypes = [
    ctypes.c_longlong, ctypes.c_int, ctypes.c_int,
    ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int,
    ctypes.POINTER(StructPos), ctypes.c_int,
]

lib.get_nether_structures.restype  = ctypes.c_int
lib.get_nether_structures.argtypes = [
    ctypes.c_longlong, ctypes.c_int, ctypes.c_int,
    ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int,
    ctypes.POINTER(StructPos), ctypes.c_int,
]

try:
    lib.get_dim_structures.restype  = ctypes.c_int
    lib.get_dim_structures.argtypes = [
        ctypes.c_longlong, ctypes.c_int, ctypes.c_int, ctypes.c_int,
        ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int,
        ctypes.POINTER(StructPos), ctypes.c_int,
    ]
    HAS_DIM_STRUCTURES = True
except AttributeError:
    HAS_DIM_STRUCTURES = False

# ─── Constants ─────────────────────────────────────────────────────────────────
MC_VERSIONS = {
    "1.16": 17,
    "1.17": 19,
    "1.18": 20,
    "1.19": 21,
    "1.20": 23,
    "1.21": 24,
}

STRUCT_TYPES = {
    "Desert_Temple":        1,
    "Jungle_Temple":        2,
    "Witch_Hut":            3,
    "Igloo":                4,
    "Village":              5,
    "Ocean_Ruins":          6,
    "Shipwreck":            7,
    "Monument":             8,
    "Mansion":              9,
    "Outpost":              10,
    "Ruined_Portal":        11,
    "Ruined_Portal_Nether": 12,
    "Ancient_City":         13,
    "Treasure":             14,
    "Mineshaft":            15,
    "Desert_Well":          16,
    "Geode":                17,
    "Fortress":             18,
    "Bastion":              19,
    "End_City":             20,
    "End_Gateway":          21,
    "End_Island":           22,
    "Trail_Ruins":          23,
    "Trial_Chambers":       24,
}

DIM_IDS = {"overworld": 0, "nether": -1, "end": 1}
NETHER_STRUCTS = {"Fortress", "Bastion", "Ruined_Portal_Nether"}
END_STRUCTS = {"End_City", "End_Gateway", "End_Island"}
STRUCT_FALLBACK_CONFIG = {
    "Trail_Ruins": {"min_version": "1.20", "salt": 83469867, "region": 34, "chunk_range": 26},
    "Trial_Chambers": {"min_version": "1.21", "salt": 94251327, "region": 34, "chunk_range": 22},
}
JAVA_RAND_MULT = 0x5DEECE66D
JAVA_RAND_ADD = 0xB
JAVA_RAND_MASK = (1 << 48) - 1
U64_MASK = (1 << 64) - 1

# Structures available per version (using tuple comparison on version string key)
# version string → set of unlocked extras
_VERSION_EXTRAS = {
    "1.16": {"Ruined_Portal", "Ruined_Portal_Nether", "Fortress", "Bastion", "End_City", "End_Gateway", "End_Island"},
    "1.17": {"Ruined_Portal", "Ruined_Portal_Nether", "Geode", "Fortress", "Bastion", "End_City", "End_Gateway", "End_Island"},
    "1.18": {"Ruined_Portal", "Ruined_Portal_Nether", "Geode", "Fortress", "Bastion", "End_City", "End_Gateway", "End_Island"},
    "1.19": {"Ruined_Portal", "Ruined_Portal_Nether", "Geode", "Ancient_City", "Fortress", "Bastion", "End_City", "End_Gateway", "End_Island"},
    "1.20": {"Ruined_Portal", "Ruined_Portal_Nether", "Geode", "Ancient_City", "Trail_Ruins", "Fortress", "Bastion", "End_City", "End_Gateway", "End_Island"},
    "1.21": {"Ruined_Portal", "Ruined_Portal_Nether", "Geode", "Ancient_City", "Trail_Ruins", "Trial_Chambers", "Fortress", "Bastion", "End_City", "End_Gateway", "End_Island"},
}

OVERWORLD_BASE_STRUCTS = [
    "Village", "Monument", "Mansion", "Outpost",
    "Desert_Temple", "Jungle_Temple", "Witch_Hut", "Igloo",
    "Ocean_Ruins", "Shipwreck", "Treasure", "Mineshaft", "Desert_Well",
]

# ─── Limits ────────────────────────────────────────────────────────────────────
MAX_BIOME_W     = 256
MAX_BIOME_H     = 256
MAX_STRUCT_W    = 32768
MAX_STRUCT_H    = 32768
MAX_STRONGHOLDS = 128
MAX_STRUCTURES  = 512
MAX_SEARCH_ATTEMPTS = 250
MAX_SEARCH_RESULTS  = 24
MAX_SEARCH_RADIUS   = 6000

# ─── Helpers ───────────────────────────────────────────────────────────────────
def seed_to_int(seed_str: str) -> int:
    """Convert text seed → Java-style signed long, matching Minecraft's logic."""
    s = seed_str.strip()
    try:
        val = int(s)
    except ValueError:
        h = 0
        for ch in s:
            h = ctypes.c_int(31 * h + ord(ch)).value
        val = h
    return ctypes.c_longlong(val).value


def _int_arg(name: str, default: int, lo: int | None = None, hi: int | None = None) -> int:
    """Parse and clamp a query-string integer with validation."""
    raw = request.args.get(name, str(default))
    try:
        v = int(raw)
    except ValueError:
        return default
    if lo is not None:
        v = max(lo, v)
    if hi is not None:
        v = min(hi, v)
    return v


def ctypes_call(fn, *args):
    """Wrap a ctypes call so a segfault-prone exception is caught gracefully."""
    try:
        return fn(*args)
    except Exception as exc:
        log.error("ctypes call failed: %s", exc, exc_info=True)
        raise RuntimeError("Native library call failed") from exc


def error(msg: str, code: int = 400):
    return jsonify({"error": msg}), code


def _dimension_arg() -> str:
    dimension = request.args.get("dimension", "overworld").strip().lower()
    return "overworld" if dimension != "overworld" else dimension


def _available_structures(version: str, dimension: str = "overworld") -> list[str]:
    extras = _VERSION_EXTRAS.get(version, set())

    names = list(OVERWORLD_BASE_STRUCTS)
    for name in ["Ruined_Portal", "Geode", "Ancient_City", "Trail_Ruins", "Trial_Chambers"]:
        if name in extras:
            names.append(name)
    return names


def _version_at_least(version: str, minimum: str) -> bool:
    def parts(value: str) -> tuple[int, ...]:
        return tuple(int(p) for p in value.split("."))

    current = parts(version)
    target = parts(minimum)
    size = max(len(current), len(target))
    return current + (0,) * (size - len(current)) >= target + (0,) * (size - len(target))


def _java_set_seed(value: int) -> int:
    return (value ^ JAVA_RAND_MULT) & JAVA_RAND_MASK


def _java_next(seed: int, bits: int) -> tuple[int, int]:
    seed = (seed * JAVA_RAND_MULT + JAVA_RAND_ADD) & JAVA_RAND_MASK
    return seed, seed >> (48 - bits)


def _java_next_int(seed: int, n: int) -> tuple[int, int]:
    m = n - 1
    if (m & n) == 0:
        seed, bits = _java_next(seed, 31)
        return seed, (n * bits) >> 31

    while True:
        seed, bits = _java_next(seed, 31)
        value = bits % n
        if ((bits - value + m) & 0xFFFFFFFF) < 0x80000000:
            return seed, value


def _fallback_feature_positions(seed: int, version: str, name: str,
                                x: int, z: int, w: int, h: int) -> list[dict]:
    cfg = STRUCT_FALLBACK_CONFIG.get(name)
    if not cfg or not _version_at_least(version, cfg["min_version"]):
        return []

    region = cfg["region"]
    span = region * 16
    rx0 = math.floor(x / span)
    rz0 = math.floor(z / span)
    rx1 = math.floor((x + w) / span) + 1
    rz1 = math.floor((z + h) / span) + 1
    world_seed = seed & U64_MASK
    points = []

    for rz in range(rz0, rz1 + 1):
        for rx in range(rx0, rx1 + 1):
            rng = _java_set_seed((rx * 341873128712 + rz * 132897987541 + world_seed + cfg["salt"]) & U64_MASK)
            rng, off_x = _java_next_int(rng, cfg["chunk_range"])
            rng, off_z = _java_next_int(rng, cfg["chunk_range"])
            points.append({"x": (rx * region + off_x) << 4, "z": (rz * region + off_z) << 4})

    return points[:MAX_STRUCTURES]


def _points_for_structure(seed: int, mc: int, name: str, x: int, z: int, w: int, h: int, dimension: str = "overworld") -> list[dict]:
    arr = (StructPos * MAX_STRUCTURES)()
    type_id = STRUCT_TYPES[name]

    if name in NETHER_STRUCTS or dimension == "nether":
        n = ctypes_call(lib.get_nether_structures, seed, mc, type_id, x, z, w, h, arr, MAX_STRUCTURES)
    elif name in END_STRUCTS or dimension == "end":
        if not HAS_DIM_STRUCTURES:
            return []
        n = ctypes_call(lib.get_dim_structures, seed, mc, DIM_IDS["end"], type_id, x, z, w, h, arr, MAX_STRUCTURES)
    else:
        n = ctypes_call(lib.get_structures, seed, mc, type_id, x, z, w, h, arr, MAX_STRUCTURES)
    points = [{"x": arr[i].x, "z": arr[i].z} for i in range(n)]
    if not points and dimension == "overworld" and name in STRUCT_FALLBACK_CONFIG:
        version = next((v for v, code in MC_VERSIONS.items() if code == mc), "1.21")
        return _fallback_feature_positions(seed, version, name, x, z, w, h)
    return points


def _nearest_distance(points: list[dict], origin: dict) -> float | None:
    if not points:
        return None
    ox, oz = origin["x"], origin["z"]
    return min(((p["x"] - ox) ** 2 + (p["z"] - oz) ** 2) ** 0.5 for p in points)


@lru_cache(maxsize=4096)
def _biome_grid_cached(seed: int, mc: int, dim_id: int,
                       x: int, z: int, w: int, h: int, scale: int) -> tuple:
    """
    Biome generation is fully deterministic for a given seed/version/region,
    so the result is memoised. The native call releases the GIL, so with a
    threaded server several misses can compute in parallel; repeat views are
    served straight from this cache.
    """
    if dim_id == 0:
        ptr = ctypes_call(lib.get_biome_grid, seed, mc, x, z, w, h, scale)
    else:
        ptr = ctypes_call(lib.get_biome_grid_dim, seed, mc, dim_id, x, z, w, h, scale)
    if not ptr:
        raise RuntimeError("Biome generation failed")
    # ptr[:n] copies the whole buffer at C speed — far faster than a per-element
    # Python loop, which dominated large-tile (up to 256x256) generation time.
    n = w * h
    grid = tuple(ptr[:n])
    lib.free_array(ptr)
    return grid


# ─── Routes ────────────────────────────────────────────────────────────────────
@app.route('/')
def index():
    return send_from_directory('templates', 'index.html')


@app.route('/api/versions')
def versions():
    return jsonify(list(MC_VERSIONS.keys()))


@app.route('/api/capabilities')
def capabilities():
    return jsonify({
        "dimensions": {
            "overworld": {"biomes": True, "structures": True, "spawn": True, "strongholds": True},
        },
        "structures": {
            "overworld": _available_structures("1.21", "overworld") + ["Stronghold", "spawn"],
        },
    })


@app.route('/api/random_seed')
def random_seed():
    seed = random.randint(-9_999_999_999, 9_999_999_999)
    return jsonify({"seed": str(seed)})


@app.route('/api/biomes')
def biomes():
    """Return a biome-ID grid for a rectangular region."""
    seed_str = request.args.get('seed', '0')
    version  = request.args.get('version', '1.20')
    dimension = _dimension_arg()

    if version not in MC_VERSIONS:
        return error(f"Unknown version: {version!r}. Valid: {list(MC_VERSIONS)}")

    if dimension != "overworld" and not HAS_DIM_BIOMES:
        return error("Biome generation for Nether/End requires a rebuilt libseedmap with get_biome_grid_dim", 501)

    x     = _int_arg('x', -1024)
    z     = _int_arg('z', -1024)
    w     = _int_arg('w', 64,  lo=1, hi=MAX_BIOME_W)
    h     = _int_arg('h', 64,  lo=1, hi=MAX_BIOME_H)
    scale = _int_arg('scale', 16, lo=4, hi=64)

    mc   = MC_VERSIONS[version]
    seed = seed_to_int(seed_str)

    try:
        grid = list(_biome_grid_cached(seed, mc, DIM_IDS[dimension], x, z, w, h, scale))
    except RuntimeError as e:
        return error(str(e), 500)

    resp = jsonify({
        "seed": seed_str, "version": version, "dimension": dimension,
        "x": x, "z": z, "w": w, "h": h, "scale": scale,
        "grid": grid,
    })
    # Deterministic for these exact params → safe to cache hard in the browser.
    resp.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    return resp


@app.route('/api/spawn')
def spawn():
    seed_str = request.args.get('seed', '0')
    version  = request.args.get('version', '1.20')

    if version not in MC_VERSIONS:
        return error(f"Unknown version: {version!r}")

    mc   = MC_VERSIONS[version]
    seed = seed_to_int(seed_str)
    try:
        p = ctypes_call(lib.get_spawn, seed, mc)
    except RuntimeError as e:
        return error(str(e), 500)

    return jsonify({"x": p.x, "z": p.z})


@app.route('/api/strongholds')
def strongholds():
    seed_str = request.args.get('seed', '0')
    version  = request.args.get('version', '1.20')
    count    = _int_arg('count', 24, lo=1, hi=MAX_STRONGHOLDS)

    if version not in MC_VERSIONS:
        return error(f"Unknown version: {version!r}")

    mc   = MC_VERSIONS[version]
    seed = seed_to_int(seed_str)

    arr = (SHPos * MAX_STRONGHOLDS)()
    try:
        n = ctypes_call(lib.get_strongholds, seed, mc, arr, count)
    except RuntimeError as e:
        return error(str(e), 500)

    result = [{"x": arr[i].x, "z": arr[i].z, "ring": arr[i].ring} for i in range(n)]
    return jsonify(result)


@app.route('/api/structures')
def structures():
    seed_str    = request.args.get('seed', '0')
    version     = request.args.get('version', '1.20')
    struct_name = request.args.get('type', 'Village')
    dimension   = _dimension_arg()

    if version not in MC_VERSIONS:
        return error(f"Unknown version: {version!r}")

    type_id = STRUCT_TYPES.get(struct_name)
    if type_id is None:
        return error(f"Unknown structure type: {struct_name!r}. Valid: {list(STRUCT_TYPES)}")
    if struct_name not in _available_structures(version, "overworld"):
        return error(f"{struct_name!r} is not available in this viewer")

    x = _int_arg('x', -8192)
    z = _int_arg('z', -8192)
    w = _int_arg('w', 16384, lo=1, hi=MAX_STRUCT_W)
    h = _int_arg('h', 16384, lo=1, hi=MAX_STRUCT_H)

    mc   = MC_VERSIONS[version]
    seed = seed_to_int(seed_str)

    try:
        points = _points_for_structure(seed, mc, struct_name, x, z, w, h, dimension)
    except RuntimeError as e:
        return error(str(e), 500)

    return jsonify(points)


@app.route('/api/all_structures')
def all_structures():
    """
    Fetch spawn, strongholds, and all applicable structure types in parallel.
    Uses ThreadPoolExecutor so ctypes calls (which release the GIL while in C)
    overlap instead of queuing serially.
    """
    seed_str = request.args.get('seed', '0')
    version  = request.args.get('version', '1.20')
    dimension = _dimension_arg()

    if version not in MC_VERSIONS:
        return error(f"Unknown version: {version!r}")

    x = _int_arg('x', -8192)
    z = _int_arg('z', -8192)
    w = _int_arg('w', 16384, lo=1, hi=MAX_STRUCT_W)
    h = _int_arg('h', 16384, lo=1, hi=MAX_STRUCT_H)

    mc   = MC_VERSIONS[version]
    seed = seed_to_int(seed_str)
    available = _available_structures(version, dimension)
    types_arg = request.args.get("types")
    if types_arg is not None:
        requested_types = {
            name.strip()
            for name in types_arg.split(",")
            if name.strip()
        }
        available = [name for name in available if name in requested_types]
    if dimension == "end" and not HAS_DIM_STRUCTURES:
        available = []

    response = {}

    def fetch_spawn():
        p = ctypes_call(lib.get_spawn, seed, mc)
        return "spawn", {"x": p.x, "z": p.z}

    def fetch_strongholds():
        arr = (SHPos * MAX_STRONGHOLDS)()
        n   = ctypes_call(lib.get_strongholds, seed, mc, arr, MAX_STRONGHOLDS)
        return "strongholds", [{"x": arr[i].x, "z": arr[i].z, "ring": arr[i].ring} for i in range(n)]

    def fetch_struct(sname):
        return sname, _points_for_structure(seed, mc, sname, x, z, w, h, dimension)

    include_core = request.args.get("core", "1") != "0"

    tasks = []
    if include_core and dimension == "overworld":
        tasks.extend([fetch_spawn, fetch_strongholds])
    for sname in available:
        tasks.append(lambda s=sname: fetch_struct(s))

    # Use min(len(tasks), 8) workers — more than 8 won't help for cubiomes
    if tasks:
        with ThreadPoolExecutor(max_workers=min(len(tasks), 10)) as pool:
            futures = {pool.submit(t): t.__name__ for t in tasks}
            for future in as_completed(futures):
                try:
                    key, value = future.result()
                    response[key] = value
                except Exception as exc:
                    log.error("Structure fetch failed: %s", exc, exc_info=True)

    resp = jsonify(response)
    resp.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    return resp


@app.route('/api/search_seeds')
def search_seeds():
    """
    Find random Minecraft Java seeds that have selected structures near spawn.
    This is intentionally bounded so the Flask dev server stays responsive.
    """
    version = request.args.get('version', '1.20')
    if version not in MC_VERSIONS:
        return error(f"Unknown version: {version!r}")

    attempts = _int_arg('attempts', 80, lo=1, hi=MAX_SEARCH_ATTEMPTS)
    radius = _int_arg('radius', 2000, lo=128, hi=MAX_SEARCH_RADIUS)
    limit = _int_arg('limit', 8, lo=1, hi=MAX_SEARCH_RESULTS)

    available = set(_available_structures(version, "overworld"))
    raw_required = request.args.get('required', 'Village')
    required = [name for name in raw_required.split(',') if name in available]
    if not required:
        return error("Choose at least one valid structure for this version")

    mc = MC_VERSIONS[version]
    candidates = [random.randint(-(2**63), 2**63 - 1) for _ in range(attempts)]

    def evaluate(seed: int):
        spawn_pos = ctypes_call(lib.get_spawn, seed, mc)
        spawn = {"x": spawn_pos.x, "z": spawn_pos.z}
        x = spawn["x"] - radius
        z = spawn["z"] - radius
        size = radius * 2

        found = {}
        nearest = {}
        score = 0.0

        for name in required:
            points = _points_for_structure(seed, mc, name, x, z, size, size, "overworld")
            if not points:
                return None
            dist = _nearest_distance(points, spawn)
            if dist is None or dist > radius * 1.42:
                return None
            points.sort(key=lambda p: (p["x"] - spawn["x"]) ** 2 + (p["z"] - spawn["z"]) ** 2)
            found[name] = points[:8]
            nearest[name] = round(dist)
            score += dist

        return {
            "seed": str(seed),
            "spawn": spawn,
            "score": round(score),
            "nearest": nearest,
            "structures": found,
        }

    matches = []
    with ThreadPoolExecutor(max_workers=min(8, attempts)) as pool:
        futures = [pool.submit(evaluate, seed) for seed in candidates]
        for future in as_completed(futures):
            try:
                match = future.result()
            except Exception as exc:
                log.warning("Seed search candidate failed: %s", exc)
                continue
            if match:
                matches.append(match)

    matches.sort(key=lambda item: item["score"])
    return jsonify({
        "version": version,
        "attempts": attempts,
        "radius": radius,
        "required": required,
        "results": matches[:limit],
    })


# ─── Error handlers ────────────────────────────────────────────────────────────
@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Not found"}), 404

@app.errorhandler(500)
def server_error(e):
    return jsonify({"error": "Internal server error"}), 500


# ─── Entry point ───────────────────────────────────────────────────────────────
if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    log.info("Starting SeedMap on port %d (debug=%s)", port, debug)
    app.run(debug=debug, host='0.0.0.0', port=port, threaded=True)
