const CACHE = 'docstitcher-v9.17';
const ASSETS = [
  '/assets/style.css',
  '/assets/app.js',
  '/assets/i18n.js',
  '/manifest.webmanifest',
];

// HTML pages are NEVER cached — they always require network
const HTML_PAGES = ['/', '/index.html', '/app.html', '/tools.html'];

self.addEventListener('install', e => {
  // Only pre-cache static assets, NOT html pages
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // HTML pages: always network-first, no cache fallback
  // If offline, the fetch will fail and the browser shows its own error (or the page JS will catch it)
  const isHtmlPage = HTML_PAGES.some(p => url.pathname === p || url.pathname.endsWith('.html'));
  if (isHtmlPage) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' }).catch(() => {
        // Return a minimal offline-block page so the user sees something useful
        return new Response(
          `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>No Internet — DocStitcher</title>
          <style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0c111d;color:#f0f4ff;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:24px}.card{background:#131929;border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:48px 40px;max-width:420px}.icon{font-size:56px;margin-bottom:20px}.title{font-size:22px;font-weight:800;margin-bottom:10px}.sub{color:#8492a6;font-size:14px;line-height:1.6;margin-bottom:28px}.btn{background:linear-gradient(135deg,#f9a825,#f96b3f);color:#0c111d;font-weight:800;font-size:14px;padding:14px 28px;border-radius:12px;border:none;cursor:pointer}
          </style></head><body>
          <div class="card"><div class="icon">📵</div>
          <div class="title">No Internet Connection</div>
          <div class="sub">DocStitcher requires an active internet connection to run. Please connect to Wi-Fi or mobile data and try again.</div>
          <button class="btn" onclick="location.reload()">Try Again</button></div>
          </body></html>`,
          { status: 503, headers: { 'Content-Type': 'text/html' } }
        );
      })
    );
    return;
  }

  // Static assets: cache-first (fonts, CSS, JS)
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
