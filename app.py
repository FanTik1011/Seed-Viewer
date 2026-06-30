from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import base64
import ctypes
import os
import sys
import random
import logging
import math
from concurrent.futures import ThreadPoolExecutor, as_completed
from functools import lru_cache
from threading import RLock

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger(__name__)

def _normalise_base_path(value: str) -> str:
    value = (value or "").strip()
    if not value or value == "/":
        return ""
    return "/" + value.strip("/")


PUBLIC_BASE_PATH = _normalise_base_path(os.environ.get("PUBLIC_BASE_PATH", ""))
PUBLIC_PERF_MODE = os.environ.get("PUBLIC_PERF_MODE", "heroku" if os.environ.get("DYNO") else "").strip().lower()


class PrefixMiddleware:
    def __init__(self, app, prefix: str):
        self.app = app
        self.prefix = prefix

    def __call__(self, environ, start_response):
        path = environ.get("PATH_INFO", "")
        if self.prefix and (path == self.prefix or path.startswith(self.prefix + "/")):
            environ["SCRIPT_NAME"] = self.prefix
            environ["PATH_INFO"] = path[len(self.prefix):] or "/"
        return self.app(environ, start_response)


app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app, origins=["http://localhost:*", "http://127.0.0.1:*"])
if PUBLIC_BASE_PATH:
    app.wsgi_app = PrefixMiddleware(app.wsgi_app, PUBLIC_BASE_PATH)

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

class SpawnPos(ctypes.Structure):
    _fields_ = [("x", ctypes.c_int), ("z", ctypes.c_int)]

class SHPos(ctypes.Structure):
    _fields_ = [("x", ctypes.c_int), ("z", ctypes.c_int), ("ring", ctypes.c_int)]

class StructPos(ctypes.Structure):
    _fields_ = [("x", ctypes.c_int), ("z", ctypes.c_int)]

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

JAVA_MC_VERSIONS = {
    "1.16": 20,
    "1.17": 21,
    "1.18": 22,
    "1.19": 24,
    "1.20": 25,
    "1.21": 28,
    "26.1": 28,
    "26.2": 28,
}

JAVA_VERSION_FALLBACKS = {
    "26.1": "1.21",
    "26.2": "1.21",
}

BEDROCK_VERSION_FALLBACKS = {
    "bedrock_26.30": "1.21",
    "bedrock_26.20": "1.21",
    "bedrock_26.0": "1.21",
    "bedrock_1.21.120": "1.21",
    "bedrock_1.21.111": "1.21",
    "bedrock_1.21.110": "1.21",
    "bedrock_1.21.100": "1.21",
    "bedrock_1.21.90": "1.21",
    "bedrock_1.21.80": "1.21",
    "bedrock_1.21.70": "1.21",
    "bedrock_1.21.60": "1.21",
    "bedrock_1.21.50": "1.21",
    "bedrock_1.21": "1.21",
    "bedrock_1.20.60": "1.20",
    "bedrock_1.20": "1.20",
    "bedrock_1.19": "1.19",
    "bedrock_1.18": "1.18",
    "bedrock_1.17": "1.17",
    "bedrock_1.16": "1.16",
}

MC_VERSIONS = {
    **JAVA_MC_VERSIONS,
    **{bedrock: JAVA_MC_VERSIONS[java] for bedrock, java in BEDROCK_VERSION_FALLBACKS.items()},
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
BEDROCK_OVERWORLD_STRUCTS = [
    "Village", "Monument", "Mansion", "Outpost",
    "Desert_Temple", "Jungle_Temple", "Witch_Hut", "Igloo",
    "Ocean_Ruins", "Shipwreck", "Treasure", "Mineshaft",
    "Ruined_Portal", "Ancient_City", "Trail_Ruins", "Trial_Chambers",
]
BEDROCK_NETHER_STRUCTS = ["Fortress", "Bastion", "Ruined_Portal_Nether"]
BEDROCK_END_STRUCTS = ["End_City"]
BEDROCK_SPAWN_BIOMES = {
    1, 4, 5, 18, 19, 21, 22, 27, 28, 29, 32, 33,
    129, 132, 149, 151, 155, 156, 157, 160, 161, 168, 169,
    177, 184, 185, 186,
}
BEDROCK_DEEP_OCEAN_BIOMES = {24, 48, 49, 50}
BEDROCK_SHIPWRECK_BIOMES = {0, 10, 16, 26, 44, 45, 46, 49, 50}
BEDROCK_OCEAN_RUIN_BIOMES = {0, 10, 24, 44, 45, 46, 48, 49, 50}
BEDROCK_VILLAGE_BIOMES = {1, 2, 5, 12, 35, 129, 177}
BEDROCK_IGLOO_BIOMES = {12, 13, 26, 30, 31, 158}
BEDROCK_DESERT_TEMPLE_BIOMES = {2, 17, 130}
BEDROCK_JUNGLE_TEMPLE_BIOMES = {21, 22, 23, 168, 169}
BEDROCK_WITCH_HUT_BIOMES = {6, 134}
_BEDROCK_BIOME_FILTERS: dict[str, set[int]] = {
    "Village": BEDROCK_VILLAGE_BIOMES,
    "Outpost": BEDROCK_VILLAGE_BIOMES,
    "Monument": BEDROCK_DEEP_OCEAN_BIOMES,
    "Mansion": {29},
    "Shipwreck": BEDROCK_SHIPWRECK_BIOMES,
    "Ocean_Ruins": BEDROCK_OCEAN_RUIN_BIOMES,
    "Igloo": BEDROCK_IGLOO_BIOMES,
    "Desert_Temple": BEDROCK_DESERT_TEMPLE_BIOMES,
    "Jungle_Temple": BEDROCK_JUNGLE_TEMPLE_BIOMES,
    "Witch_Hut": BEDROCK_WITCH_HUT_BIOMES,
}
JAVA_RAND_MULT = 0x5DEECE66D
JAVA_RAND_ADD = 0xB
JAVA_RAND_MASK = (1 << 48) - 1
U64_MASK = (1 << 64) - 1

_VERSION_EXTRAS = {
    "1.16": {"Ruined_Portal", "Ruined_Portal_Nether", "Fortress", "Bastion", "End_City", "End_Gateway", "End_Island"},
    "1.17": {"Ruined_Portal", "Ruined_Portal_Nether", "Geode", "Fortress", "Bastion", "End_City", "End_Gateway", "End_Island"},
    "1.18": {"Ruined_Portal", "Ruined_Portal_Nether", "Geode", "Fortress", "Bastion", "End_City", "End_Gateway", "End_Island"},
    "1.19": {"Ruined_Portal", "Ruined_Portal_Nether", "Geode", "Ancient_City", "Fortress", "Bastion", "End_City", "End_Gateway", "End_Island"},
    "1.20": {"Ruined_Portal", "Ruined_Portal_Nether", "Geode", "Ancient_City", "Trail_Ruins", "Fortress", "Bastion", "End_City", "End_Gateway", "End_Island"},
    "1.21": {"Ruined_Portal", "Ruined_Portal_Nether", "Geode", "Ancient_City", "Trail_Ruins", "Trial_Chambers", "Fortress", "Bastion", "End_City", "End_Gateway", "End_Island"},
    "26.1": {"Ruined_Portal", "Ruined_Portal_Nether", "Geode", "Ancient_City", "Trail_Ruins", "Trial_Chambers", "Fortress", "Bastion", "End_City", "End_Gateway", "End_Island"},
    "26.2": {"Ruined_Portal", "Ruined_Portal_Nether", "Geode", "Ancient_City", "Trail_Ruins", "Trial_Chambers", "Fortress", "Bastion", "End_City", "End_Gateway", "End_Island"},
}


def _generation_version(version: str) -> str:
    return BEDROCK_VERSION_FALLBACKS.get(version, JAVA_VERSION_FALLBACKS.get(version, version))


def _is_bedrock_version(version: str) -> bool:
    return version in BEDROCK_VERSION_FALLBACKS


OVERWORLD_BASE_STRUCTS = [
    "Village", "Monument", "Mansion", "Outpost",
    "Desert_Temple", "Jungle_Temple", "Witch_Hut", "Igloo",
    "Ocean_Ruins", "Shipwreck", "Treasure", "Mineshaft", "Desert_Well",
]

MAX_BIOME_W     = 256
MAX_BIOME_H     = 256
MAX_STRUCT_W    = 32768
MAX_STRUCT_H    = 32768
MAX_STRONGHOLDS = 128
MAX_STRUCTURES  = 512
MAX_STRUCTURE_WORKERS = max(2, min(4, (os.cpu_count() or 4) // 2))
MAX_SEARCH_ATTEMPTS = 250
MAX_SEARCH_RESULTS  = 24
MAX_SEARCH_RADIUS   = 6000
MAX_BIOME_FIND_SAMPLES = 65000
OVERWORLD_BIOME_SCALES = {1, 4, 16, 64, 256}
DIMENSION_BIOME_SCALES = {1, 4, 16, 64}
NATIVE_LOCK = RLock()

def seed_to_int(seed_str: str) -> int:
    s = seed_str.strip()
    try:
        val = int(s)
    except ValueError:
        h = 0
        for ch in s:
            h = ctypes.c_int(31 * h + ord(ch)).value
        val = h
    return ctypes.c_longlong(val).value


def _java_string_hash(value: str) -> int:
    h = 0
    for ch in value:
        h = ctypes.c_int(31 * h + ord(ch)).value
    return h


def bedrock_seed_to_int(seed_str: str) -> int:
    s = seed_str.strip()
    if not s or s == "-":
        return 0
    if s.lstrip("-").isdigit():
        try:
            return ctypes.c_longlong(int(s)).value
        except ValueError:
            return 0
    if s.startswith("0") or (len(s) > 1 and s[0] == "-" and s[1] == "0"):
        return ctypes.c_int(_java_string_hash(s)).value
    return ctypes.c_int(_java_string_hash(s)).value


def seed_for_version(seed_str: str, version: str) -> int:
    return bedrock_seed_to_int(seed_str) if _is_bedrock_version(version) else seed_to_int(seed_str)


def _int_arg(name: str, default: int, lo: int | None = None, hi: int | None = None) -> int:
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
    try:
        with NATIVE_LOCK:
            return fn(*args)
    except Exception as exc:
        log.error("ctypes call failed: %s", exc, exc_info=True)
        raise RuntimeError("Native library call failed") from exc


def error(msg: str, code: int = 400):
    return jsonify({"error": msg}), code


def _dimension_arg() -> str:
    dimension = request.args.get("dimension", "overworld").strip().lower()
    return dimension if dimension in DIM_IDS else "overworld"


def _allowed_biome_scales(dim_id: int) -> set[int]:
    return OVERWORLD_BIOME_SCALES if dim_id == DIM_IDS["overworld"] else DIMENSION_BIOME_SCALES


def _available_structures(version: str, dimension: str = "overworld") -> list[str]:
    if _is_bedrock_version(version):
        if dimension == "nether":
            return list(BEDROCK_NETHER_STRUCTS)
        if dimension == "end":
            return list(BEDROCK_END_STRUCTS)
        names = ["Stronghold"] + list(BEDROCK_OVERWORLD_STRUCTS)
        if not _version_at_least(version, "1.19"):
            names = [name for name in names if name != "Ancient_City"]
        if not _version_at_least(version, "1.20"):
            names = [name for name in names if name != "Trail_Ruins"]
        if not _version_at_least(version, "1.21"):
            names = [name for name in names if name != "Trial_Chambers"]
        return names

    extras = _VERSION_EXTRAS.get(_generation_version(version), set())

    names = list(OVERWORLD_BASE_STRUCTS)
    for name in ["Ruined_Portal", "Geode", "Ancient_City", "Trail_Ruins", "Trial_Chambers"]:
        if name in extras:
            names.append(name)
    return names


def _version_at_least(version: str, minimum: str) -> bool:
    def parts(value: str) -> tuple[int, ...]:
        return tuple(int(p) for p in _generation_version(value).split("."))

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


class BedrockMt:
    N = 624
    M = 397
    MATRIX_A = 0x9908B0DF
    UPPER_MASK = 0x80000000
    LOWER_MASK = 0x7FFFFFFF
    MAG_01 = (0, MATRIX_A)

    def __init__(self, seed: int):
        self.mt = [0] * self.N
        self.mti = self.N
        self.mt[0] = seed & 0xFFFFFFFF
        for i in range(1, self.M + 1):
            self.mt[i] = (1812433253 * (self.mt[i - 1] ^ (self.mt[i - 1] >> 30)) + i) & 0xFFFFFFFF
        self.mti_fast = self.M + 1

    def next_u32(self) -> int:
        if self.mti == self.N:
            self.mti = 0
        elif self.mti > self.N:
            self.mt[0] = 5489
            for i in range(1, self.N):
                self.mt[i] = (1812433253 * (self.mt[i - 1] ^ (self.mt[i - 1] >> 30)) + i) & 0xFFFFFFFF
            self.mti_fast = self.N
            self.mti = 0

        if self.mti >= self.N - self.M:
            if self.mti >= self.N - 1:
                y_mix = (self.mt[0] & self.LOWER_MASK) | (self.mt[self.N - 1] & self.UPPER_MASK)
                self.mt[self.N - 1] = (self.MAG_01[self.mt[0] & 1] ^ (y_mix >> 1) ^ self.mt[self.M - 1]) & 0xFFFFFFFF
            else:
                y_mix = (self.mt[self.mti + 1] & self.LOWER_MASK) | (self.mt[self.mti] & self.UPPER_MASK)
                self.mt[self.mti] = (
                    self.MAG_01[self.mt[self.mti + 1] & 1] ^
                    (y_mix >> 1) ^
                    self.mt[self.mti - (self.N - self.M)]
                ) & 0xFFFFFFFF
        else:
            y_mix = (self.mt[self.mti + 1] & self.LOWER_MASK) | (self.mt[self.mti] & self.UPPER_MASK)
            self.mt[self.mti] = (
                self.MAG_01[self.mt[self.mti + 1] & 1] ^
                (y_mix >> 1) ^
                self.mt[self.mti + self.M]
            ) & 0xFFFFFFFF
            if self.mti_fast < self.N:
                self.mt[self.mti_fast] = (
                    1812433253 *
                    (self.mt[self.mti_fast - 1] ^ (self.mt[self.mti_fast - 1] >> 30)) +
                    self.mti_fast
                ) & 0xFFFFFFFF
                self.mti_fast += 1

        y = self.mt[self.mti]
        self.mti += 1
        y ^= y >> 11
        y ^= (y << 7) & 0x9D2C5680
        y ^= (y << 15) & 0xEFC60000
        return (y ^ (y >> 18)) & 0xFFFFFFFF

    def next_int(self, n: int) -> int:
        if n <= 0:
            return 0
        if (n & (n - 1)) == 0:
            return self.next_u32() & (n - 1)
        return self.next_u32() % n

    def next_int_unbound(self) -> int:
        return self.next_u32() >> 1

    def next_float(self) -> float:
        return self.next_u32() / 4294967296.0


BEDROCK_STRUCTURE_CONFIG = {
    "Ancient_City":        {"salt": 20083232,  "region": 24, "range": 16, "mode": "large", "min": "1.19"},
    "Desert_Temple":       {"salt": 14357617,  "region": 32, "range": 24, "mode": "normal", "min": "1.16"},
    "Igloo":               {"salt": 14357617,  "region": 32, "range": 24, "mode": "normal", "min": "1.16"},
    "Jungle_Temple":       {"salt": 14357617,  "region": 32, "range": 24, "mode": "normal", "min": "1.16"},
    "Mansion":             {"salt": 10387319,  "region": 80, "range": 60, "mode": "large", "min": "1.16"},
    "Mineshaft":           {"salt": 0,         "region": 1,  "range": 1,  "mode": "mineshaft", "min": "1.16"},
    "Monument":            {"salt": 10387313,  "region": 32, "range": 27, "mode": "large", "min": "1.16"},
    "Ocean_Ruins":         {"salt": 14357621,  "region": 20, "range": 12, "mode": "ocean_ruin", "min": "1.16"},
    "Outpost":             {"salt": 165745296, "region": 80, "range": 56, "mode": "large", "min": "1.16"},
    "Ruined_Portal":       {"salt": 40552231,  "region": 40, "range": 25, "mode": "normal", "min": "1.16"},
    "Shipwreck":           {"salt": 165745295, "region": 24, "range": 20, "mode": "shipwreck", "min": "1.16"},
    "Witch_Hut":           {"salt": 14357617,  "region": 32, "range": 24, "mode": "normal", "min": "1.16"},
    "Treasure":            {"salt": 16842397,  "region": 4,  "range": 2,  "mode": "large", "min": "1.16"},
    "Village":             {"salt": 10387312,  "region": 34, "range": 26, "mode": "large", "min": "1.16"},
    "Bastion":             {"salt": 30084232,  "region": 30, "range": 26, "mode": "normal", "min": "1.16"},
    "Fortress":            {"salt": 30084232,  "region": 30, "range": 26, "mode": "normal", "min": "1.16"},
    "Ruined_Portal_Nether": {"salt": 40552231,  "region": 25, "range": 15, "mode": "normal", "min": "1.16"},
    "End_City":            {"salt": 10387313,  "region": 20, "range": 9,  "mode": "end_city", "min": "1.16"},
}

BEDROCK_LEGACY_CONFIG = {
    "Ocean_Ruins": {"region": 12, "range": 5},
    "Shipwreck": {"region": 10, "range": 5},
    "Village": {"region": 27, "range": 17},
}


def _bedrock_structure_seed(seed: int) -> int:
    value = seed & 0xFFFFFFFF
    if value >= 0x80000000:
        value -= 0x100000000
    return value & U64_MASK


def _bedrock_mt(seed: int, reg_x: int, reg_z: int, salt: int) -> BedrockMt:
    mixed = (reg_x * 341873128712 + reg_z * 132897987541 + seed + salt) & U64_MASK
    return BedrockMt(mixed)


def _bedrock_normal_pos(cfg: dict, seed: int, reg_x: int, reg_z: int) -> dict:
    mt = _bedrock_mt(seed, reg_x, reg_z, cfg["salt"])
    off_x = mt.next_int(cfg["range"])
    off_z = mt.next_int(cfg["range"])
    return {"x": ((reg_x * cfg["region"] + off_x) << 4) + 8,
            "z": ((reg_z * cfg["region"] + off_z) << 4) + 8}


def _bedrock_large_pos(cfg: dict, seed: int, reg_x: int, reg_z: int) -> dict:
    mt = _bedrock_mt(seed, reg_x, reg_z, cfg["salt"])
    off_x = (mt.next_int(cfg["range"]) + mt.next_int(cfg["range"])) >> 1
    off_z = (mt.next_int(cfg["range"]) + mt.next_int(cfg["range"])) >> 1
    return {"x": ((reg_x * cfg["region"] + off_x) << 4) + 8,
            "z": ((reg_z * cfg["region"] + off_z) << 4) + 8}


def _bedrock_mineshaft_pos(seed: int, chunk_x: int, chunk_z: int) -> dict | None:
    mt = BedrockMt(seed)
    r1 = mt.next_int_unbound()
    r2 = mt.next_int_unbound()
    mixed = ((r1 * chunk_x) ^ (r2 * chunk_z) ^ seed) & U64_MASK
    mt = BedrockMt(mixed)
    mt.next_int_unbound()
    if mt.next_float() < 0.004 and mt.next_int(80) < max(abs(chunk_x), abs(chunk_z)):
        return {"x": chunk_x * 16, "z": chunk_z * 16}
    return None


def _bedrock_position_for_region(name: str, cfg: dict, seed: int, mc: int, reg_x: int, reg_z: int) -> dict | None:
    if mc <= JAVA_MC_VERSIONS["1.17"] and name in BEDROCK_LEGACY_CONFIG:
        cfg = {**cfg, **BEDROCK_LEGACY_CONFIG[name]}
    mode = cfg["mode"]
    if mode == "normal":
        return _bedrock_normal_pos(cfg, seed, reg_x, reg_z)
    if mode == "large":
        return _bedrock_large_pos(cfg, seed, reg_x, reg_z)
    if mode == "shipwreck":
        return (_bedrock_large_pos if mc <= JAVA_MC_VERSIONS["1.17"] else _bedrock_normal_pos)(cfg, seed, reg_x, reg_z)
    if mode == "ocean_ruin":
        return (_bedrock_large_pos if mc <= JAVA_MC_VERSIONS["1.17"] else _bedrock_normal_pos)(cfg, seed, reg_x, reg_z)
    if mode == "end_city":
        pos = _bedrock_large_pos(cfg, seed, reg_x, reg_z)
        return pos if pos["x"] * pos["x"] + pos["z"] * pos["z"] >= 1008 * 1008 else None
    if mode == "mineshaft":
        return _bedrock_mineshaft_pos(seed, reg_x, reg_z)
    return None


def _biome_at_soft(seed: int, mc: int, x: int, z: int) -> int | None:
    try:
        grid = _biome_grid_cached(seed, mc, DIM_IDS["overworld"], x, z, 1, 1, 4)
    except RuntimeError:
        return None
    return grid[0] if grid else None


def _bedrock_candidate_valid(seed: int, mc: int, name: str, pos: dict, dimension: str) -> bool:
    if dimension != "overworld":
        return True
    biome = _biome_at_soft(seed, mc, pos["x"], pos["z"])
    if biome is None:
        return True
    if name == "Village":
        return biome in BEDROCK_VILLAGE_BIOMES
    if name == "Monument":
        return biome in BEDROCK_DEEP_OCEAN_BIOMES
    if name == "Mansion":
        return biome == 29
    if name == "Shipwreck":
        return biome in BEDROCK_SHIPWRECK_BIOMES
    if name == "Ocean_Ruins":
        return biome in BEDROCK_OCEAN_RUIN_BIOMES
    if name == "Igloo":
        return biome in BEDROCK_IGLOO_BIOMES
    if name == "Desert_Temple":
        return biome in BEDROCK_DESERT_TEMPLE_BIOMES
    if name == "Jungle_Temple":
        return biome in BEDROCK_JUNGLE_TEMPLE_BIOMES
    if name == "Witch_Hut":
        return biome in BEDROCK_WITCH_HUT_BIOMES
    return True


def _bedrock_java_feature_points(seed: int, version: str, name: str,
                                 x: int, z: int, w: int, h: int) -> list[dict]:
    cfg = STRUCT_FALLBACK_CONFIG.get(name)
    if not cfg or not _version_at_least(version, cfg["min_version"]):
        return []

    region = cfg["region"]
    span = region * 16
    rx0 = math.floor(x / span) - 1
    rz0 = math.floor(z / span) - 1
    rx1 = math.floor((x + w) / span) + 1
    rz1 = math.floor((z + h) / span) + 1
    world_seed = _bedrock_structure_seed(seed)
    points = []

    for rz in range(rz0, rz1 + 1):
        for rx in range(rx0, rx1 + 1):
            rng = _java_set_seed((rx * 341873128712 + rz * 132897987541 + world_seed + cfg["salt"]) & U64_MASK)
            rng, off_x = _java_next_int(rng, cfg["chunk_range"])
            rng, off_z = _java_next_int(rng, cfg["chunk_range"])
            pos = {"x": (rx * region + off_x) << 4, "z": (rz * region + off_z) << 4}
            if x <= pos["x"] < x + w and z <= pos["z"] < z + h:
                points.append(pos)
                if len(points) >= MAX_STRUCTURES:
                    return points
    return points


def _bedrock_scattered_stronghold(seed: int, grid_x: int, grid_z: int) -> dict | None:
    world_seed = _bedrock_structure_seed(seed)
    mixed = (784295783249 * grid_x + 827828252345 * grid_z + world_seed + 97858791) & U64_MASK
    mt = BedrockMt(mixed)
    min_x = grid_x * 200 + 50
    max_x = grid_x * 200 + 150
    min_z = grid_z * 200 + 50
    max_z = grid_z * 200 + 150
    chunk_x = min_x + mt.next_int(max_x - min_x)
    chunk_z = min_z + mt.next_int(max_z - min_z)
    if mt.next_float() >= 0.25:
        return None
    return {"x": (chunk_x << 4) + 8, "z": (chunk_z << 4) + 8}


def _bedrock_strongholds_in_area(seed: int, x: int, z: int, w: int, h: int) -> list[dict]:
    chunk_x0 = math.floor(x / 16)
    chunk_z0 = math.floor(z / 16)
    chunk_x1 = math.floor((x + w) / 16)
    chunk_z1 = math.floor((z + h) / 16)
    gx0 = math.floor(chunk_x0 / 200) - 1
    gz0 = math.floor(chunk_z0 / 200) - 1
    gx1 = math.floor(chunk_x1 / 200) + 1
    gz1 = math.floor(chunk_z1 / 200) + 1
    points = []

    for gz in range(gz0, gz1 + 1):
        for gx in range(gx0, gx1 + 1):
            pos = _bedrock_scattered_stronghold(seed, gx, gz)
            if not pos:
                continue
            if x <= pos["x"] < x + w and z <= pos["z"] < z + h:
                points.append({**pos, "ring": max(abs(gx), abs(gz))})
                if len(points) >= MAX_STRONGHOLDS:
                    return points
    points.sort(key=lambda p: (p["x"] * p["x"] + p["z"] * p["z"], p["x"], p["z"]))
    return points


def _bedrock_bulk_biome_filter(seed: int, mc: int, name: str,
                               candidates: list[dict],
                               area_x: int, area_z: int,
                               area_w: int, area_h: int) -> list[dict]:
    valid = _BEDROCK_BIOME_FILTERS.get(name)
    if valid is None:
        return candidates
    scale = 16
    gw = max(1, math.ceil(area_w / scale) + 1)
    gh = max(1, math.ceil(area_h / scale) + 1)
    try:
        grid = _biome_grid_cached(seed, mc, DIM_IDS["overworld"], area_x, area_z, gw, gh, scale)
    except RuntimeError:
        return candidates
    result = []
    for pos in candidates:
        gx = max(0, min(gw - 1, (pos["x"] - area_x) // scale))
        gz = max(0, min(gh - 1, (pos["z"] - area_z) // scale))
        if grid[gz * gw + gx] in valid:
            result.append(pos)
    return result


def _bedrock_points_for_structure(seed: int, mc: int, name: str,
                                  x: int, z: int, w: int, h: int,
                                  dimension: str = "overworld",
                                  version: str = "bedrock_1.21") -> list[dict]:
    if name == "Stronghold":
        return _bedrock_strongholds_in_area(seed, x, z, w, h) if dimension == "overworld" else []
    if name in STRUCT_FALLBACK_CONFIG:
        return _bedrock_java_feature_points(seed, version, name, x, z, w, h)

    cfg = BEDROCK_STRUCTURE_CONFIG.get(name)
    if not cfg:
        return []
    if dimension == "overworld" and name not in BEDROCK_OVERWORLD_STRUCTS:
        return []
    if dimension == "nether" and name not in BEDROCK_NETHER_STRUCTS:
        return []
    if dimension == "end" and name not in BEDROCK_END_STRUCTS:
        return []

    span = cfg["region"] * 16
    rx0 = math.floor(x / span) - 1
    rz0 = math.floor(z / span) - 1
    rx1 = math.floor((x + w) / span) + 1
    rz1 = math.floor((z + h) / span) + 1
    world_seed = _bedrock_structure_seed(seed)
    candidates = []
    for rz in range(rz0, rz1 + 1):
        for rx in range(rx0, rx1 + 1):
            pos = _bedrock_position_for_region(name, cfg, world_seed, mc, rx, rz)
            if not pos:
                continue
            if x <= pos["x"] < x + w and z <= pos["z"] < z + h:
                candidates.append(pos)

    if dimension != "overworld" or not candidates:
        return candidates[:MAX_STRUCTURES]

    return _bedrock_bulk_biome_filter(seed, mc, name, candidates, x, z, w, h)[:MAX_STRUCTURES]


def _bedrock_spawn(seed: int, mc: int) -> dict:
    # Bedrock spawn is always near (0, 0). Using Java biomes to approximate it
    # gives wrong positions for Bedrock seeds, causing the map to center far from
    # where Chunkbase centers. Return the origin so the initial view matches.
    return {"x": 0, "z": 0}


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


def _points_for_structure(seed: int, mc: int, name: str, x: int, z: int, w: int, h: int,
                          dimension: str = "overworld", version: str | None = None) -> list[dict]:
    if version and _is_bedrock_version(version):
        return _bedrock_points_for_structure(seed, mc, name, x, z, w, h, dimension, version)

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


def _find_nearest_biome_points(seed: int, mc: int, dim_id: int, biome_id: int,
                               origin: dict, radius: int, step: int, limit: int) -> tuple[list[dict], int, int]:
    sample_w = math.floor((radius * 2) / step) + 1
    sample_h = sample_w
    total = sample_w * sample_h
    if total > MAX_BIOME_FIND_SAMPLES:
        min_step = max(step, math.ceil((radius * 2) / math.sqrt(MAX_BIOME_FIND_SAMPLES)))
        allowed_scales = sorted(_allowed_biome_scales(dim_id))
        step = next((scale for scale in allowed_scales if scale >= min_step), allowed_scales[-1])
        sample_w = math.floor((radius * 2) / step) + 1
        sample_h = sample_w

    start_x = origin["x"] - radius
    start_z = origin["z"] - radius
    matches = []
    chunk = 128

    for sy in range(0, sample_h, chunk):
        h = min(chunk, sample_h - sy)
        for sx in range(0, sample_w, chunk):
            w = min(chunk, sample_w - sx)
            block_x = start_x + sx * step
            block_z = start_z + sy * step
            grid = _biome_grid_cached(seed, mc, dim_id, block_x, block_z, w, h, step)
            for i, value in enumerate(grid):
                if value != biome_id:
                    continue
                lx = i % w
                lz = i // w
                x = block_x + lx * step
                z = block_z + lz * step
                dist = math.hypot(x - origin["x"], z - origin["z"])
                if dist > radius:
                    continue
                matches.append({"x": x, "z": z, "distance": round(dist)})

    matches.sort(key=lambda p: (p["distance"], abs(p["x"] - origin["x"]) + abs(p["z"] - origin["z"])))
    return matches[:limit], sample_w * sample_h, step


def _parse_biome_ids(raw: str) -> list[int]:
    ids = []
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        try:
            value = int(part)
        except ValueError:
            continue
        if 0 <= value <= 255:
            ids.append(value)
    return ids


@lru_cache(maxsize=4096)
def _biome_grid_cached(seed: int, mc: int, dim_id: int,
                       x: int, z: int, w: int, h: int, scale: int) -> tuple:
    allowed_scales = _allowed_biome_scales(dim_id)
    if scale not in allowed_scales:
        raise RuntimeError(f"Unsupported biome scale: {scale}. Valid scales: {sorted(allowed_scales)}")
    n = w * h
    try:
        with NATIVE_LOCK:
            ptr = None
            if dim_id == 0:
                ptr = lib.get_biome_grid(seed, mc, x, z, w, h, scale)
            else:
                ptr = lib.get_biome_grid_dim(seed, mc, dim_id, x, z, w, h, scale)
            if not ptr:
                raise RuntimeError("Biome generation failed")
            try:
                grid = tuple(ptr[:n])
            finally:
                lib.free_array(ptr)
    except RuntimeError:
        raise
    except Exception as exc:
        log.error("Biome grid generation failed: %s", exc, exc_info=True)
        raise RuntimeError("Biome generation failed") from exc
    return grid


import time as _time
_CACHE_BUST = str(int(_time.time()))

@app.route('/')
def index():
    return render_template(
        'index.html',
        base_path=PUBLIC_BASE_PATH,
        cache_bust=_CACHE_BUST,
        perf_mode=PUBLIC_PERF_MODE,
    )


@app.route('/api/versions')
def versions():
    return jsonify(list(MC_VERSIONS.keys()))


@app.route('/api/capabilities')
def capabilities():
    return jsonify({
        "editions": {
            "java": {"native": True, "preview": False},
            "bedrock": {
                "native": True,
                "preview": False,
                "structures": True,
                "biomes": False,
            },
        },
        "dimensions": {
            "overworld": {"biomes": True, "structures": True, "spawn": True, "strongholds": True},
            "nether": {"biomes": HAS_DIM_BIOMES, "structures": True, "spawn": False, "strongholds": False},
            "end": {"biomes": HAS_DIM_BIOMES, "structures": HAS_DIM_STRUCTURES, "spawn": False, "strongholds": False},
        },
        "structures": {
            "overworld": _available_structures("1.21", "overworld") + ["Stronghold", "spawn"],
            "nether": _available_structures("1.21", "nether"),
            "end": _available_structures("1.21", "end"),
        },
    })


@app.route('/api/random_seed')
def random_seed():
    version = request.args.get("version", "1.20")
    if _is_bedrock_version(version):
        seed = random.randint(-(2**31), 2**31 - 1)
    else:
        seed = random.randint(-9_999_999_999, 9_999_999_999)
    return jsonify({"seed": str(seed)})


@app.route('/api/biomes')
def biomes():
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
    scale = _int_arg('scale', 16, lo=4, hi=256)
    dim_id = DIM_IDS[dimension]
    allowed_scales = _allowed_biome_scales(dim_id)
    if scale not in allowed_scales:
        return error(f"Unsupported biome scale: {scale}. Valid scales: {sorted(allowed_scales)}")

    mc   = MC_VERSIONS[version]
    seed = seed_for_version(seed_str, version)

    try:
        grid = _biome_grid_cached(seed, mc, dim_id, x, z, w, h, scale)
    except RuntimeError as e:
        return error(str(e), 500)

    if request.args.get("format") == "u8" and all(0 <= value <= 255 for value in grid):
        payload = {
            "seed": seed_str, "version": version, "dimension": dimension,
            "x": x, "z": z, "w": w, "h": h, "scale": scale,
            "gridEncoding": "u8-b64",
            "grid": base64.b64encode(bytes(grid)).decode("ascii"),
        }
    else:
        payload = {
            "seed": seed_str, "version": version, "dimension": dimension,
            "x": x, "z": z, "w": w, "h": h, "scale": scale,
            "grid": list(grid),
        }

    resp = jsonify(payload)
    resp.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    return resp


@app.route('/api/find_biome')
def find_biome():
    seed_str = request.args.get('seed', '0')
    version = request.args.get('version', '1.20')
    dimension = _dimension_arg()

    if version not in MC_VERSIONS:
        return error(f"Unknown version: {version!r}. Valid: {list(MC_VERSIONS)}")
    if dimension != "overworld" and not HAS_DIM_BIOMES:
        return error("Biome search for Nether/End requires a rebuilt libseedmap with get_biome_grid_dim", 501)

    biome_id = _int_arg('biome', 1, lo=0, hi=255)
    radius = _int_arg('radius', 3000, lo=256, hi=MAX_SEARCH_RADIUS)
    step = _int_arg('step', 64, lo=16, hi=256)
    limit = _int_arg('limit', 8, lo=1, hi=MAX_SEARCH_RESULTS)
    origin_mode = request.args.get('origin', 'spawn')
    dim_id = DIM_IDS[dimension]
    allowed_scales = _allowed_biome_scales(dim_id)
    if step not in allowed_scales:
        return error(f"Unsupported biome search step: {step}. Valid steps: {sorted(allowed_scales)}")

    mc = MC_VERSIONS[version]
    seed = seed_for_version(seed_str, version)
    if origin_mode == "spawn":
        try:
            p = ctypes_call(lib.get_spawn, seed, mc)
        except RuntimeError as e:
            return error(str(e), 500)
        origin = {"x": p.x, "z": p.z}
    else:
        origin = {
            "x": _int_arg('x', 0, lo=-30_000_000, hi=30_000_000),
            "z": _int_arg('z', 0, lo=-30_000_000, hi=30_000_000),
        }

    try:
        results, checked, used_step = _find_nearest_biome_points(
            seed, mc, dim_id, biome_id, origin, radius, step, limit
        )
    except RuntimeError as e:
        return error(str(e), 500)

    resp = jsonify({
        "seed": seed_str,
        "version": version,
        "dimension": dimension,
        "biome": biome_id,
        "origin": origin,
        "originMode": origin_mode,
        "radius": radius,
        "step": used_step,
        "checked": checked,
        "results": results,
    })
    resp.headers["Cache-Control"] = "no-store"
    return resp


@app.route('/api/spawn')
def spawn():
    seed_str = request.args.get('seed', '0')
    version  = request.args.get('version', '1.20')

    if version not in MC_VERSIONS:
        return error(f"Unknown version: {version!r}")

    mc   = MC_VERSIONS[version]
    seed = seed_for_version(seed_str, version)
    if _is_bedrock_version(version):
        return jsonify(_bedrock_spawn(seed, mc))

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
    if _is_bedrock_version(version):
        seed = seed_for_version(seed_str, version)
        radius = _int_arg("radius", 20000, lo=1024, hi=250000)
        points = _bedrock_strongholds_in_area(seed, -radius, -radius, radius * 2, radius * 2)
        return jsonify(points[:count])

    mc   = MC_VERSIONS[version]
    seed = seed_for_version(seed_str, version)

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
    if type_id is None and struct_name != "Stronghold":
        return error(f"Unknown structure type: {struct_name!r}. Valid: {list(STRUCT_TYPES)}")
    if struct_name not in _available_structures(version, dimension):
        return error(f"{struct_name!r} is not available in this viewer")

    x = _int_arg('x', -8192)
    z = _int_arg('z', -8192)
    w = _int_arg('w', 16384, lo=1, hi=MAX_STRUCT_W)
    h = _int_arg('h', 16384, lo=1, hi=MAX_STRUCT_H)

    mc   = MC_VERSIONS[version]
    seed = seed_for_version(seed_str, version)

    try:
        points = _points_for_structure(seed, mc, struct_name, x, z, w, h, dimension, version)
    except RuntimeError as e:
        return error(str(e), 500)

    return jsonify(points)


@app.route('/api/all_structures')
def all_structures():
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
    seed = seed_for_version(seed_str, version)
    available = [name for name in _available_structures(version, dimension) if name != "Stronghold"]
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
        if _is_bedrock_version(version):
            return "spawn", _bedrock_spawn(seed, mc)
        p = ctypes_call(lib.get_spawn, seed, mc)
        return "spawn", {"x": p.x, "z": p.z}

    def fetch_strongholds():
        if _is_bedrock_version(version):
            return "strongholds", _bedrock_strongholds_in_area(seed, x, z, w, h)
        arr = (SHPos * MAX_STRONGHOLDS)()
        n   = ctypes_call(lib.get_strongholds, seed, mc, arr, MAX_STRONGHOLDS)
        return "strongholds", [{"x": arr[i].x, "z": arr[i].z, "ring": arr[i].ring} for i in range(n)]

    def fetch_struct(sname):
        return sname, _points_for_structure(seed, mc, sname, x, z, w, h, dimension, version)

    include_core = request.args.get("core", "1") != "0"

    tasks = []
    if include_core and dimension == "overworld":
        tasks.append(fetch_spawn)
        tasks.append(fetch_strongholds)
    for sname in available:
        tasks.append(lambda s=sname: fetch_struct(s))

    if tasks:
        with ThreadPoolExecutor(max_workers=min(len(tasks), MAX_STRUCTURE_WORKERS)) as pool:
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
    version = request.args.get('version', '1.20')
    if version not in MC_VERSIONS:
        return error(f"Unknown version: {version!r}")

    attempts = _int_arg('attempts', 80, lo=1, hi=MAX_SEARCH_ATTEMPTS)
    default_radius = _int_arg('radius', 1000, lo=128, hi=MAX_SEARCH_RADIUS)
    structure_radius = _int_arg('structure_radius', default_radius, lo=128, hi=MAX_SEARCH_RADIUS)
    biome_radius = _int_arg('biome_radius', default_radius, lo=256, hi=MAX_SEARCH_RADIUS)
    limit = _int_arg('limit', 8, lo=1, hi=MAX_SEARCH_RESULTS)

    available = set(_available_structures(version, "overworld"))
    raw_required = request.args.get('required', '')
    required = [name for name in raw_required.split(',') if name in available]
    required_counts = {}
    for name in required:
        required_counts[name] = required_counts.get(name, 0) + 1
    required_biomes = _parse_biome_ids(request.args.get('biomes', ''))
    if not required and not required_biomes:
        return error("Choose at least one biome or valid structure for this version")

    mc = MC_VERSIONS[version]
    if _is_bedrock_version(version):
        candidates = [random.randint(-(2**31), 2**31 - 1) for _ in range(attempts)]
    else:
        candidates = [random.randint(-(2**63), 2**63 - 1) for _ in range(attempts)]

    def evaluate(seed: int):
        if _is_bedrock_version(version):
            spawn = _bedrock_spawn(seed, mc)
        else:
            spawn_pos = ctypes_call(lib.get_spawn, seed, mc)
            spawn = {"x": spawn_pos.x, "z": spawn_pos.z}

        found = {}
        nearest = {}
        found_biomes = {}
        nearest_biomes = {}
        score = 0.0

        for name, needed in required_counts.items():
            x = spawn["x"] - structure_radius
            z = spawn["z"] - structure_radius
            size = structure_radius * 2
            points = _points_for_structure(seed, mc, name, x, z, size, size, "overworld", version)
            if len(points) < needed:
                return None
            points.sort(key=lambda p: (p["x"] - spawn["x"]) ** 2 + (p["z"] - spawn["z"]) ** 2)
            chosen = points[:needed]
            distances = [math.hypot(p["x"] - spawn["x"], p["z"] - spawn["z"]) for p in chosen]
            if not distances or distances[-1] > structure_radius * 1.42:
                return None
            found[name] = points[:max(8, needed)]
            nearest[name] = round(distances[0])
            score += sum(distances)

        for biome_id in required_biomes:
            points, _, used_step = _find_nearest_biome_points(
                seed, mc, DIM_IDS["overworld"], biome_id, spawn, biome_radius, 64, 4
            )
            if not points:
                return None
            nearest_biomes[str(biome_id)] = points[0]["distance"]
            found_biomes[str(biome_id)] = points
            score += points[0]["distance"] + used_step * 0.1

        return {
            "seed": str(seed),
            "spawn": spawn,
            "score": round(score),
            "nearest": nearest,
            "structures": found,
            "nearestBiomes": nearest_biomes,
            "biomes": found_biomes,
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
        "radius": max(structure_radius, biome_radius),
        "structureRadius": structure_radius,
        "biomeRadius": biome_radius,
        "required": required,
        "requiredCounts": required_counts,
        "biomes": required_biomes,
        "results": matches[:limit],
    })


@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Not found"}), 404

@app.errorhandler(500)
def server_error(e):
    return jsonify({"error": "Internal server error"}), 500


if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    log.info("Starting SeedMap on port %d (debug=%s)", port, debug)
    app.run(debug=debug, host='0.0.0.0', port=port, threaded=True)
