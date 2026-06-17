bootIcons();
initWorker();
bindEvents();
resizeCanvas();
loadCapabilities().finally(() => {
  buildSidebar();
  hydrateFromUrl();
});
