;/*
 * Short alias for /infinite-game.js.
 * Console loader:
 *   ;var s=document.createElement("script");s.src="/ig.js?"+Date.now();document.head.appendChild(s)
 */
(function () {
  var existing = window.pslInfiniteGame;
  if (existing && existing.start) {
    existing.start();
    return;
  }
  var script = document.createElement('script');
  script.src = '/infinite-game.js?cache=' + Date.now();
  document.head.appendChild(script);
})();
