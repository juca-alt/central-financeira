/* Sub-app APOSENTADO — SW kill-switch: limpa os caches antigos desta pasta,
   se desregistra e recarrega a aba (que então cai no redirect da index). */
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) {
  e.waitUntil((async function () {
    try { var ks = await caches.keys(); await Promise.all(ks.map(function (k) { return caches.delete(k); })); } catch (err) {}
    try { await self.registration.unregister(); } catch (err) {}
    try {
      var cs = await self.clients.matchAll({ type: "window" });
      cs.forEach(function (c) { c.navigate(c.url); });
    } catch (err) {}
  })());
});
/* Sem cache: tudo vai direto pra rede enquanto o kill-switch não terminou. */
self.addEventListener("fetch", function () {});
