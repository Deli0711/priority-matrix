/* Service worker Priority Matrix — cache-first untuk shell, network-only untuk API.
   Path sengaja relatif supaya tetap benar saat app di-host di subfolder
   (mis. GitHub Pages /priority-matrix/). */

const CACHE = 'pm-shell-v3'
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg', './logo.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL).catch(() => undefined))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)

  // Jangan pernah cache panggilan API (OpenRouter) — harus selalu live
  if (url.origin !== self.location.origin) return

  // Navigasi: network-first, fallback ke shell yang tersimpan (agar tetap bisa dibuka offline)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put('./index.html', copy)).catch(() => undefined)
          return res
        })
        .catch(() => caches.match('./index.html').then((r) => r || Response.error()))
    )
    return
  }

  // Aset statis: cache-first (nama file ber-hash, aman)
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached
      return fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => undefined)
          }
          return res
        })
        .catch(() => cached || Response.error())
    })
  )
})
