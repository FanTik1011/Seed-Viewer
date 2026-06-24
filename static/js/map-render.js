function render() {
  raf = 0;
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = MAP_BG;
  ctx.fillRect(0, 0, state.width, state.height);
  if (!state.loaded) return;

  const gridRange = visibleTileRange();
  const canStreamBiomes = dimensionCaps().biomes;
  const lod = pickLod();
  const range = biomeTileRange(lod);
  const detailedBiomes = canStreamBiomes && state.showBiomes && range.count <= MAX_DRAW_TILES && range.tilePx >= 10;
  els.distanceNote.classList.toggle("visible", state.showBiomes && !detailedBiomes);
  els.distanceNote.querySelector("span").textContent = canStreamBiomes
    ? "Zoom in to stream detailed biomes"
    : "Biome streaming for this dimension needs a rebuilt native library";
  trimTileQueueToView(range);
  cancelStaleTileRequests();
  dropStaleTileBuilds();
  if (detailedBiomes) {
    queueCenterTiles(range);
    pumpTiles();
    queueCoarseFallbacks(range);
    drawBiomes(range);
    prefetchAround(range);
    drawMapVignette();
  } else {
    drawSeedmapLoadingMap(range);
  }
  if (state.showGrid && gridRange.tilePx >= 12) drawGrid(gridRange);
  if (state.showAxes) drawAxes();
  drawSelection();
  drawStructures();
  updateHud();
  if (!mapIsMoving()) updateSelectedPanel();
  updateChunkPill();
  pumpTiles();
  if (!mapIsMoving()) scheduleStructureStream(320);
}

function prefetchAround(range) {

  if (!state.showBiomes || !dimensionCaps().biomes || mapIsMoving()) return;
  if (state.pendingTiles.size > tileRequestLimit() / 2 || state.tileQueue.size > MAX_TILE_QUEUE * .35) return;
  for (let tz = range.tzMin - PREFETCH_MARGIN; tz <= range.tzMax + PREFETCH_MARGIN; tz++) {
    for (let tx = range.txMin - PREFETCH_MARGIN; tx <= range.txMax + PREFETCH_MARGIN; tx++) {
      if (tx >= range.txMin && tx <= range.txMax && tz >= range.tzMin && tz <= range.tzMax) continue;
      queueTile(range.lod, tx, tz);
    }
  }
}

function primeVisibleBiomeTiles() {
  if (!state.loaded || !state.showBiomes || !dimensionCaps().biomes) return;
  const lod = pickLod();
  const range = biomeTileRange(lod);
  if (range.count > MAX_DRAW_TILES || range.tilePx < 10) return;
  trimTileQueueToView(range);
  cancelStaleTileRequests();
  queueCenterTiles(range);
  pumpTiles();
}

function queueCoarseFallbacks(range) {
  if (!state.showBiomes || !dimensionCaps().biomes || range.lod >= LODS.length - 1) return;
  const startX = range.txMin * range.blocks;
  const endX = (range.txMax + 1) * range.blocks - 1;
  const startZ = range.tzMin * range.blocks;
  const endZ = (range.tzMax + 1) * range.blocks - 1;
  const lod = range.lod + 1;
  const cfg = LODS[lod];
  const txMin = Math.floor(startX / cfg.blocks);
  const txMax = Math.floor(endX / cfg.blocks);
  const tzMin = Math.floor(startZ / cfg.blocks);
  const tzMax = Math.floor(endZ / cfg.blocks);
  for (let tz = tzMin; tz <= tzMax; tz++) {
    for (let tx = txMin; tx <= txMax; tx++) {
      queueTile(lod, tx, tz, false);
    }
  }
}

function queueCenterTiles(range) {
  if (!state.showBiomes || !dimensionCaps().biomes) return;
  let queued = 0;
  for (const item of orderedTiles(range)) {
    if (queued >= CENTER_TILE_ENQUEUE) break;
    if (queueTile(range.lod, item.tx, item.tz, true, true)) queued++;
  }
}

function mapIsMoving() {

  return !!((dragStart && pointerMoved) || momentumRaf || zoomRaf);
}

function drawFallbackTile(fineLod, tx, tz, pos, tilePx) {
  const fine = LODS[fineLod];
  const wx = tx * fine.blocks;
  const wz = tz * fine.blocks;
  for (let lod = fineLod + 1; lod < LODS.length; lod++) {
    const c = LODS[lod];
    const ctx2 = Math.floor(wx / c.blocks);
    const ctz = Math.floor(wz / c.blocks);
    const tile = state.tiles.get(tileKey(lod, ctx2, ctz));
    if (!tile) continue;
    const sx = (wx - ctx2 * c.blocks) / c.scale;
    const sy = (wz - ctz * c.blocks) / c.scale;
    const sSize = fine.blocks / c.scale;
    ctx.drawImage(tile.canvas, sx, sy, sSize, sSize, pos.x, pos.y, tilePx + 1, tilePx + 1);
    tile.last = performance.now();
    return true;
  }
  return false;
}

function drawBiomes(range, queueVisible = true) {
  const cfg = LODS[range.lod];
  const tilePx = cfg.blocks / state.zoom;
  const tiles = orderedTiles(range);
  let queuedThisFrame = 0;
  const queueBudget = state.tileQueue.size > MAX_TILE_QUEUE_WHILE_LOADING
    ? CENTER_TILE_ENQUEUE
    : MAX_TILE_ENQUEUE_PER_RENDER;
  for (const item of tiles) {
      const { tx, tz } = item;
      const key = tileKey(range.lod, tx, tz);
      const pos = worldToScreen(tx * cfg.blocks, tz * cfg.blocks);
      const tile = state.tiles.get(key);
      if (state.showBiomes && tile) {
        tile.last = performance.now();
        ctx.drawImage(tile.canvas, pos.x, pos.y, tilePx + 1, tilePx + 1);
      } else if (state.showBiomes && drawFallbackTile(range.lod, tx, tz, pos, tilePx)) {

      } else {
        drawPendingTile(pos, tilePx, item.dist);
      }
      if (queueVisible && state.showBiomes && !tile && queuedThisFrame < queueBudget) {
        if (queueTile(range.lod, tx, tz, true, item.dist < 2.2)) queuedThisFrame++;
      }
  }
  if (queuedThisFrame >= queueBudget && queueBudget > 0) requestRender();
}

function drawSeedmapLoadingMap(range) {
  ctx.save();
  drawBiomes(range, false);
  ctx.strokeStyle = "rgba(255,255,255,.18)";
  ctx.lineWidth = 1;
  drawLoadedTileOutline(range);
  ctx.restore();
}

function orderedTiles(range) {
  const cx = state.viewX / range.blocks;
  const cz = state.viewZ / range.blocks;
  const tiles = [];
  for (let tz = range.tzMin; tz <= range.tzMax; tz++) {
    for (let tx = range.txMin; tx <= range.txMax; tx++) {
      tiles.push({ tx, tz, dist: Math.hypot(tx + .5 - cx, tz + .5 - cz) });
    }
  }
  return tiles.sort((a, b) => a.dist - b.dist);
}

function drawPendingTile(pos, tilePx, dist) {
  if (tilePx < 18) return;
  const alpha = clamp(.08 - dist * .006, .018, .055);
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  ctx.fillRect(pos.x, pos.y, tilePx + 1, tilePx + 1);
}

function drawLoadedTileOutline(range) {
  const cfg = LODS[range.lod];
  const tilePx = cfg.blocks / state.zoom;
  if (tilePx < 10) return;
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,.42)";
  ctx.lineWidth = 1;
  for (let tz = range.tzMin; tz <= range.tzMax; tz++) {
    for (let tx = range.txMin; tx <= range.txMax; tx++) {
      if (!state.tiles.has(tileKey(range.lod, tx, tz))) continue;
      const pos = worldToScreen(tx * cfg.blocks, tz * cfg.blocks);
      ctx.strokeRect(Math.round(pos.x) + .5, Math.round(pos.y) + .5, Math.round(tilePx), Math.round(tilePx));
    }
  }
  ctx.restore();
}

function drawMapVignette() {

}

function drawGrid(range) {
  const tilePx = TILE_BLOCKS / state.zoom;
  if (tilePx < 18) return;
  ctx.lineWidth = 1;
  ctx.strokeStyle = tilePx > 80 ? "rgba(6,18,22,.30)" : "rgba(6,18,22,.20)";
  for (let tx = range.txMin; tx <= range.txMax + 1; tx++) {
    const x = worldToScreen(tx * TILE_BLOCKS, 0).x;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, state.height);
    ctx.stroke();
  }
  for (let tz = range.tzMin; tz <= range.tzMax + 1; tz++) {
    const y = worldToScreen(0, tz * TILE_BLOCKS).y;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(state.width, y);
    ctx.stroke();
  }
  if (tilePx > 54) drawGridLabels(range);
}

function drawGridLabels(range) {
  ctx.save();
  ctx.font = "12px Cascadia Mono, Consolas, monospace";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  for (let tx = range.txMin; tx <= range.txMax + 1; tx++) {
    const wx = tx * TILE_BLOCKS;
    const x = worldToScreen(wx, 0).x;
    if (x < -30 || x > state.width + 30) continue;
    drawGridTag(String(wx), x, state.height - 18);
  }
  ctx.textAlign = "center";
  for (let tz = range.tzMin; tz <= range.tzMax + 1; tz++) {
    const wz = tz * TILE_BLOCKS;
    const y = worldToScreen(0, wz).y;
    if (y < -30 || y > state.height + 30) continue;
    drawGridTag(String(wz), state.width - 30, y);
  }
  ctx.restore();
}

function drawGridTag(text, x, y) {
  const w = Math.max(34, ctx.measureText(text).width + 10);
  ctx.fillStyle = "rgba(7,12,14,.74)";
  roundRect(x - w / 2, y - 11, w, 22, 5, true, false);
  ctx.fillStyle = "rgba(239,246,241,.9)";
  ctx.fillText(text, x, y + .5);
}

function drawAxes() {
  const origin = worldToScreen(0, 0);
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,.22)";
  ctx.setLineDash([5, 5]);
  if (origin.x >= 0 && origin.x <= state.width) {
    ctx.beginPath();
    ctx.moveTo(origin.x, 0);
    ctx.lineTo(origin.x, state.height);
    ctx.stroke();
  }
  if (origin.y >= 0 && origin.y <= state.height) {
    ctx.beginPath();
    ctx.moveTo(0, origin.y);
    ctx.lineTo(state.width, origin.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSelection() {
  if (!state.selected) return;
  const p = worldToScreen(state.selected.x, state.selected.z);
  if (p.x < -40 || p.y < -40 || p.x > state.width + 40 || p.y > state.height + 40) return;
  ctx.save();
  ctx.strokeStyle = "#edf3ee";
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.arc(p.x, p.y, 15, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawStructures() {
  const all = visibleMarkers();
  const moving = mapIsMoving();

  const onScreenMarkers = [];
  for (const m of all) {
    if (shouldHideDenseMarker(m)) continue;
    const sx = state.width / 2 + (m.x - state.viewX) / state.zoom;
    const sy = state.height / 2 + (m.z - state.viewZ) / state.zoom;
    if (sx < -70 || sy < -70 || sx > state.width + 70 || sy > state.height + 70) continue;
    onScreenMarkers.push(m);
  }

  if (state.zoom > MARKER_MAX_ZOOM || onScreenMarkers.length > MARKER_CLUSTER_LIMIT || moving && onScreenMarkers.length > MARKER_LABEL_LIMIT) {
    drawMarkerClusters(onScreenMarkers, true);
    return;
  }
  const lite = onScreenMarkers.length > MARKER_LITE_LIMIT;
  const allowLabel = !moving && onScreenMarkers.length <= MARKER_LABEL_LIMIT;
  for (const marker of onScreenMarkers) drawMarker(marker, lite, allowLabel);
}

function shouldHideDenseMarker(marker) {
  if (marker.type === "spawn" || marker.type === "Stronghold" || marker.type === "Village") return false;
  return DENSE_MARKER_TYPES.has(marker.type) && state.zoom > DENSE_MARKER_MAX_ZOOM;
}

function drawMarkerClusters(markers, lite = false) {
  const cells = new Map();
  const cellSize = markers.length > 450 ? 70 : markers.length > 220 ? 58 : 46;
  for (const marker of markers) {
    const p = worldToScreen(marker.x, marker.z);
    const key = `${Math.floor(p.x / cellSize)},${Math.floor(p.y / cellSize)}`;
    const group = cells.get(key) || { count: 0, x: 0, y: 0, color: marker.color, marker };
    group.count++;
    group.x += p.x;
    group.y += p.y;
    if (group.count === 1 || marker.type === "spawn") {
      group.color = marker.color;
      group.marker = marker;
    }
    cells.set(key, group);
  }
  for (const group of cells.values()) {
    group.x /= group.count;
    group.y /= group.count;
    if (group.count === 1) {
      drawMarker(group.marker, lite, false);
    } else {
      drawClusterBadge(group, lite);
    }
  }
}

function drawClusterBadge(group, lite = false) {
  const r = group.count > 99 ? 16 : 14;
  ctx.save();
  ctx.translate(group.x, group.y);
  if (!lite) {
    ctx.shadowColor = "rgba(0,0,0,.52)";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
  }
  ctx.fillStyle = "#111719";
  ctx.strokeStyle = group.color + "dd";
  ctx.lineWidth = 2;
  roundRect(-r, -r, r * 2, r * 2, 4, true, true);
  ctx.fillStyle = group.color + "22";
  roundRect(-r + 3, -r + 3, (r - 3) * 2, (r - 3) * 2, 3, true, false);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#f8fbf9";
  ctx.font = "800 11px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(group.count > 999 ? "999+" : String(group.count), 0, 1);
  ctx.restore();
}

function drawMarker(marker, lite = false, allowLabel = true) {
  const p = worldToScreen(marker.x, marker.z);
  if (p.x < -70 || p.y < -70 || p.x > state.width + 70 || p.y > state.height + 70) return;
  const selected = isSelectedMarker(marker);

  if (lite && !selected && marker.type !== "spawn") {
    ctx.fillStyle = "rgba(5,8,10,.72)";
    ctx.beginPath();
    ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = marker.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const color = marker.color;
  const scale = state.zoom <= 2 ? 1.08 : state.zoom <= 6 ? .96 : .82;
  const size = 27 * scale;
  const half = size / 2;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.shadowColor = "rgba(0,0,0,.48)";
  ctx.shadowBlur = selected ? 16 : 10;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = color + (selected ? "46" : "24");
  ctx.beginPath();
  ctx.arc(0, 0, half + 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = selected ? "#172119" : "#101518";
  ctx.strokeStyle = color + "ee";
  ctx.lineWidth = selected ? 2.4 : 1.8;
  roundRect(-half, -half, size, size, 5, true, true);
  ctx.fillStyle = color;
  roundRect(-half + 4, -half + 4, size - 8, size - 8, 3, true, false);
  ctx.fillStyle = "rgba(255,255,255,.22)";
  ctx.fillRect(-half + 5, -half + 5, size - 10, 2);
  if (!drawMarkerAsset(marker.asset, size)) drawMarkerGlyph(marker.icon, "#07100d", size);
  ctx.restore();
  if (selected || marker.type === "spawn" || allowLabel) drawMarkerLabel(marker, p, color);
}

function isSelectedMarker(marker) {
  return !!state.selected &&
    Math.round(marker.x) === state.selected.x &&
    Math.round(marker.z) === state.selected.z &&
    marker.type === state.selected.type;
}

function labelWidth(label) {
  let w = labelWidthCache.get(label);
  if (w === undefined) {
    w = ctx.measureText(label).width + 14;
    labelWidthCache.set(label, w);
  }
  return w;
}

function drawMarkerLabel(marker, p, color) {
  const label = marker.ring ? `${marker.label} ${marker.ring}` : marker.label;
  ctx.save();
  ctx.font = "600 12px Inter, system-ui, sans-serif";
  ctx.textBaseline = "middle";
  const w = labelWidth(label);
  const x = Math.min(state.width - w - 8, Math.max(8, p.x + 16));
  const y = Math.min(state.height - 18, Math.max(18, p.y - 13));
  ctx.fillStyle = "rgba(9,11,15,.84)";
  ctx.strokeStyle = color + "90";
  ctx.lineWidth = 1;
  roundRect(x, y - 12, w, 24, 5, true, true);
  ctx.fillStyle = "#f5f7f8";
  ctx.fillText(label, x + 7, y);
  ctx.restore();
}

function drawMarkerGlyph(icon, color, size) {
  const glyph = MARKER_GLYPHS[icon] || MARKER_GLYPHS.target;
  const cell = Math.max(1.45, size / 17);
  const start = -cell * 4.5;
  ctx.fillStyle = color;
  for (let y = 0; y < glyph.length; y++) {
    for (let x = 0; x < glyph[y].length; x++) {
      if (glyph[y][x] !== "#") continue;
      ctx.fillRect(start + x * cell, start + y * cell, cell * .88, cell * .88);
    }
  }
}

function drawMarkerAsset(asset, size) {
  if (!asset) return false;
  const img = markerImage(asset);
  if (!img.complete || !img.naturalWidth) return false;
  const inset = Math.max(1, size * .08);
  ctx.drawImage(img, -size / 2 + inset, -size / 2 + inset, size - inset * 2, size - inset * 2);
  return true;
}

function markerImage(asset) {
  let img = markerImageCache.get(asset);
  if (img) return img;
  img = new Image();
  img.decoding = "async";
  img.onload = requestRender;
  img.src = asset;
  markerImageCache.set(asset, img);
  return img;
}

function line(points) {
  ctx.beginPath();
  points.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
  ctx.stroke();
}
function rect(x, y, w, h) {
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.stroke();
}
function poly(points, close) {
  ctx.beginPath();
  points.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
  if (close) ctx.closePath();
  ctx.stroke();
}
function bezier(x1,y1,c1x,c1y,c2x,c2y,x2,y2) {
  ctx.beginPath();
  ctx.moveTo(x1,y1);
  ctx.bezierCurveTo(c1x,c1y,c2x,c2y,x2,y2);
  ctx.stroke();
}
function roundRect(x, y, w, h, r, fill, stroke) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}
