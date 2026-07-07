#include "../cubiomes/generator.h"
#include "../cubiomes/finders.h"
#include "../cubiomes/biomes.h"
#include <stdlib.h>
#include <string.h>
#include <stdio.h>

// ---- Biome grid ----
// Returns flat array of biome IDs for a region
// x, z = top-left block coords (multiples of scale recommended)
// w, h = width/height in samples
// scale = 1 block, 4, 16, 64, 256
int* get_biome_grid_dim(long long seed, int mc, int dim, int x, int z, int w, int h, int scale);

int* get_biome_grid(long long seed, int mc, int x, int z, int w, int h, int scale) {
    return get_biome_grid_dim(seed, mc, DIM_OVERWORLD, x, z, w, h, scale);
}

int* get_biome_grid_dim(long long seed, int mc, int dim, int x, int z, int w, int h, int scale) {
    Generator g;
    setupGenerator(&g, mc, 0);
    applySeed(&g, dim, (uint64_t)seed);

    int *out = (int*)malloc(w * h * sizeof(int));
    if (!out) return NULL;

    Range r;
    r.scale = scale;
    r.x = x / scale;
    r.z = z / scale;
    r.sx = w;
    r.sz = h;
    r.y = 64 / scale;
    r.sy = 1;

    int *biomeIds = allocCache(&g, r);
    if (!biomeIds) {
        free(out);
        return NULL;
    }

    genBiomes(&g, biomeIds, r);

    for (int i = 0; i < w * h; i++) {
        out[i] = biomeIds[i];
    }

    free(biomeIds);
    return out;
}

void free_array(int *arr) {
    if (arr) free(arr);
}

// ---- Spawn ----
typedef struct { int x; int z; } SpawnPos;

SpawnPos get_spawn(long long seed, int mc) {
    Generator g;
    setupGenerator(&g, mc, 0);
    applySeed(&g, DIM_OVERWORLD, (uint64_t)seed);
    Pos p = getSpawn(&g);
    SpawnPos sp = {p.x, p.z};
    return sp;
}

// ---- Strongholds ----
typedef struct { int x; int z; int ring; } SHPos;

int get_strongholds(long long seed, int mc, SHPos *out, int maxCount) {
    Generator g;
    setupGenerator(&g, mc, 0);
    applySeed(&g, DIM_OVERWORLD, (uint64_t)seed);

    StrongholdIter sh;
    initFirstStronghold(&sh, mc, (uint64_t)seed);

    int count = 0;
    while (count < maxCount) {
        int ret = nextStronghold(&sh, &g);
        if (ret <= 0) break;
        out[count].x = sh.pos.x;
        out[count].z = sh.pos.z;
        out[count].ring = sh.ringnum;
        count++;
    }
    return count;
}

// ---- Generic overworld structures (village, monument, mansion, outpost, ancient city, trial chambers) ----
typedef struct { int x; int z; } StructPos;
int get_dim_structures(long long seed, int mc, int dim, int structType, int areaX, int areaZ, int areaW, int areaH, StructPos *out, int maxCount);

int get_structures(long long seed, int mc, int structType, int areaX, int areaZ, int areaW, int areaH, StructPos *out, int maxCount) {
    Generator g;
    setupGenerator(&g, mc, 0);
    applySeed(&g, DIM_OVERWORLD, (uint64_t)seed);

    StructureConfig sc;
    if (!getStructureConfig(structType, mc, &sc)) return 0;

    int count = 0;
    int regW = sc.regionSize;
    int regH = sc.regionSize;

    int rX0 = (int)floor((double)areaX / (regW * 16));
    int rZ0 = (int)floor((double)areaZ / (regH * 16));
    int rX1 = (int)floor((double)(areaX + areaW) / (regW * 16)) + 1;
    int rZ1 = (int)floor((double)(areaZ + areaH) / (regH * 16)) + 1;

    for (int rz = rZ0; rz <= rZ1 && count < maxCount; rz++) {
        for (int rx = rX0; rx <= rX1 && count < maxCount; rx++) {
            Pos p;
            if (!getStructurePos(structType, mc, (uint64_t)seed, rx, rz, &p)) continue;
            // basic viable biome check (skip terrain check for speed)
            if (!isViableStructurePos(structType, &g, p.x, p.z, 0)) continue;
            out[count].x = p.x;
            out[count].z = p.z;
            count++;
        }
    }
    return count;
}

// ---- Nether structures (Fortress, Bastion) ----
int get_nether_structures(long long seed, int mc, int structType, int areaX, int areaZ, int areaW, int areaH, StructPos *out, int maxCount) {
    return get_dim_structures(seed, mc, DIM_NETHER, structType, areaX, areaZ, areaW, areaH, out, maxCount);
}

// ---- Generic structures by dimension (Nether and End capable) ----
int get_dim_structures(long long seed, int mc, int dim, int structType, int areaX, int areaZ, int areaW, int areaH, StructPos *out, int maxCount) {
    Generator g;
    setupGenerator(&g, mc, 0);
    applySeed(&g, dim, (uint64_t)seed);

    StructureConfig sc;
    if (!getStructureConfig(structType, mc, &sc)) return 0;

    int count = 0;
    int regW = sc.regionSize;

    int rX0 = (int)floor((double)areaX / (regW * 16)) - 1;
    int rZ0 = (int)floor((double)areaZ / (regW * 16)) - 1;
    int rX1 = (int)floor((double)(areaX + areaW) / (regW * 16)) + 1;
    int rZ1 = (int)floor((double)(areaZ + areaH) / (regW * 16)) + 1;

    for (int rz = rZ0; rz <= rZ1 && count < maxCount; rz++) {
        for (int rx = rX0; rx <= rX1 && count < maxCount; rx++) {
            Pos p;
            if (!getStructurePos(structType, mc, (uint64_t)seed, rx, rz, &p)) continue;
            out[count].x = p.x;
            out[count].z = p.z;
            count++;
        }
    }
    return count;
}
