bootIcons();
initFavoriteSeeds();
initWorker();
bindEvents();
resizeCanvas();
loadCapabilities().finally(() => {
  buildSidebar();
  hydrateFromUrl();
});
