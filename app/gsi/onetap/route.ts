// Google One Tap's "intermediate iframe" for agents' IDX websites (user, 10/18). Google only shows
// One Tap on web addresses registered for our client, and agent sites live on many addresses
// (peter-stefanatos.openhousepal.com...). So the site embeds THIS page from openhousepal.com
// (components/website-public/IdxOneTap) and Google runs One Tap inside it for any same-site parent
// (*.openhousepal.com). The token never leaves this frame: it goes to our backend, which checks it
// with Google and makes the agent's lead; the frame then saves only the visitor's name + email in
// the shared first-party cookie the site's forms read (lib/visitor.ts) and tells the parent it's done.
//
// A bare page on purpose (a route handler, not a page): no app header, sign-in check or loader, and
// a transparent background so only Google's box shows over the agent's site.
const API = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '')

export const dynamic = 'force-dynamic'

export function GET() {
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<style>html,body{margin:0;padding:0;background:transparent}</style>
<script src="https://accounts.google.com/gsi/intermediatesupport"></script>
</head><body>
<script>
(function () {
  var API = ${JSON.stringify(API)};
  var q = new URLSearchParams(location.search);
  var site = q.get('site') || '';
  function inter() { return (window.google && google.accounts && google.accounts.id && google.accounts.id.intermediate) || null; }
  function close() { try { inter() && inter().notifyParentClose(); } catch (e) {} }
  function done() { try { inter() && inter().notifyParentDone(); } catch (e) {} }
  if (!site || window.self === window.top) return;
  function saveVisitor(v) {
    var h = location.hostname;
    var domain = (h === 'openhousepal.com' || /\\.openhousepal\\.com$/.test(h)) ? '; domain=.openhousepal.com' : '';
    var secure = location.protocol === 'https:' ? '; secure' : '';
    var value = encodeURIComponent(JSON.stringify({ n: v.name || '', f: v.first_name || '', e: v.email }));
    document.cookie = 'ohp_visitor=' + value + '; path=/; max-age=' + (60 * 60 * 24 * 365) + '; samesite=lax' + domain + secure;
  }
  function start(cfg) {
    if (!cfg || !cfg.client_id || !(window.google && google.accounts && google.accounts.id)) { close(); return; }
    var local = location.hostname === 'localhost';
    google.accounts.id.initialize({
      client_id: cfg.client_id,
      allowed_parent_origin: local ? location.origin : 'https://*.openhousepal.com',
      context: 'signin',
      itp_support: true,
      use_fedcm_for_prompt: true,
      cancel_on_tap_outside: false,
      auto_select: false,
      intermediate_iframe_close_callback: close,
      callback: function (resp) {
        if (!resp || !resp.credential) { close(); return; }
        fetch(API + '/public/sites/' + encodeURIComponent(site) + '/google-visitor', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credential: resp.credential, page_url: q.get('page') || undefined, listing_key: q.get('lk') || undefined })
        }).then(function (r) { return r.ok ? r.json() : null; })
          .then(function (v) { if (v && v.email) saveVisitor(v); })
          .catch(function () {})
          .then(done);
      }
    });
    google.accounts.id.prompt();
  }
  fetch(API + '/public/sites/' + encodeURIComponent(site) + '/google-visitor')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (cfg) {
      if (!cfg || !cfg.client_id) { close(); return; }
      var s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = function () { start(cfg); };
      s.onerror = close;
      document.head.appendChild(s);
    })
    .catch(close);
})();
</script>
</body></html>`
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
