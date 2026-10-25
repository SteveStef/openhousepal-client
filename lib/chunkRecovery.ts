// Site-wide "it tried, failed and nothing ever happened" guard (user, 10/24). The usual cause on a
// live site, worst on iPhone Safari in a NEW TAB (a full page load): one of the page's JavaScript
// files fails to load - a deploy replaced it moments before, or a phone on a weak signal dropped
// that one request - and the page then never starts: a dark screen / the loader with nothing
// happening, while a second try works. This tiny inline script (in <head>, so it is listening
// before the first script tag loads) notices exactly that - a /_next/static script that failed, a
// "ChunkLoadError", or an app page whose code still hasn't started 15s in (PageGate sets
// window.__ohpHydrated) - and reloads the page once (never more than once every 20s, so it can't loop).
export const CHUNK_RECOVERY_SCRIPT = `(function(){
  var KEY = 'ohp-chunk-reload'; window.__ohpChunkGuard = 1;
  function reloadOnce(){
    try { var last = +(sessionStorage.getItem(KEY) || 0); if (Date.now() - last < 20000) return; sessionStorage.setItem(KEY, String(Date.now())); } catch (e) { return; }
    location.reload();
  }
  var CHUNK = /ChunkLoadError|Loading chunk [^ ]+ failed|Loading CSS chunk|dynamically imported module|Importing a module script failed/i;
  window.addEventListener('error', function(e){
    var t = e && e.target;
    if (t && t.tagName === 'SCRIPT' && /\\/_next\\/static\\//.test(t.src || '')) return reloadOnce();
    if (e && e.message && CHUNK.test(e.message)) reloadOnce();
  }, true);
  window.addEventListener('unhandledrejection', function(e){
    var r = e && e.reason; var m = r ? String((r.name || '') + ': ' + (r.message || r)) : '';
    if (CHUNK.test(m)) reloadOnce();
  });
  setTimeout(function(){
    if (!window.__ohpHydrated && document.querySelector('.ohp-gate-hold')) reloadOnce();
  }, 15000);
})();`
