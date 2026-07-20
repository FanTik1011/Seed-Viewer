function setIcon(id, name, label) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = ICONS[name] + (label ? `<span>${label}</span>` : "");
}

function iconMarkup(iconName, asset = "") {
  if (asset) return `<img src="${asset}" alt="" loading="lazy" decoding="async">`;
  return ICONS[iconName] || ICONS.target;
}

function bootIcons() {
  document.getElementById("brand-icon").innerHTML = iconMarkup("map", iconAsset("spawn"));
  document.getElementById("empty-icon").innerHTML = iconMarkup("map", iconAsset("spawn"));
  setIcon("random-btn", "shuffle", "Random");
  setIcon("like-seed-btn", "heart");
  setIcon("favorites-btn", "list", "Favorites");
  setIcon("copy-seed-btn", "copy", "Copy seed");
  setIcon("like-active-seed", "heart");
  setIcon("copy-active-seed", "copy");
  if (document.getElementById("copy-cursor")) setIcon("copy-cursor", "copy");
  setIcon("zoom-in", "plus");
  setIcon("zoom-out", "minus");
  setIcon("copy-selected-coords", "copy", "Copy");
  setIcon("copy-selected-tp", "target", "/tp");
  setIcon("copy-popover-coords", "copy", "Copy");
  setIcon("copy-popover-tp", "target", "/tp");
  setIcon("reset-view-btn", "target", "Reset view");
  setIcon("go-btn", "play", "Go to location");
  setIcon("find-biome-btn", "search", "Find seeds");
  setIcon("close-finder", "close");
  setIcon("open-finder-btn", "search", "Seed Finder");
  setIcon("close-popover", "close");
  setIcon("share-url-btn", "link", "Share");
  setIcon("close-favorites", "close");
  setIcon("refresh-public-seeds", "shuffle");
  setIcon("seed-auth-close", "close");
  if (document.getElementById("favorites-head-icon")) {
    document.getElementById("favorites-head-icon").innerHTML = iconMarkup("heart");
  }
}
