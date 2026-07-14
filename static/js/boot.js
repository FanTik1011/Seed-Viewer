bootIcons();
initFavoriteSeeds();
initWorker();
bindEvents();
resizeCanvas();
if (window.matchMedia("(max-width: 700px)").matches) {
  els.sidebar.classList.add("is-collapsed");
  document.body.classList.add("sidebar-hidden");
  els.menuToggle.setAttribute("aria-expanded", "false");
  els.menuToggle.title = "Expand sidebar";
}
loadCapabilities().finally(() => {
  buildSidebar();
  hydrateFromUrl();
});
