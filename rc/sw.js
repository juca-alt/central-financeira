/* Service worker — app-shell cache + atualização controlada (perfil R.C).
   Pra publicar nova versão: suba os arquivos e BUMPE o CACHE abaixo. */
const CACHE = "cfin-rc-v4.5";
const SHELL = ["./", "./index.html", "../app.css", "../app.js", "./manifest.webmanifest",
  "../icon-192.png", "../icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks =>
    Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("message", e => {
  if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (u.hostname.includes("supabase") || u.hostname.includes("jsdelivr")) return; // dados: sempre rede
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request).then(r => {
      const cp = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, cp));
      return r;
    }).catch(() => caches.match(e.request).then(m => m || caches.match("./index.html")))
  );
});
