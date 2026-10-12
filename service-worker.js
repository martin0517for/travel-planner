/**
 * service-worker.js — 讓 App 沒網路時也打得開。
 *
 * 策略：自己的檔案一律「網路優先」——有網路就抓最新版（所以推上 GitHub 後，
 * 手機重開 App 就是新版），同時存一份到快取；沒網路時才用快取的版本。
 * 外部網址（之後的地圖圖磚、天氣、匯率）不攔截，交給瀏覽器照常處理。
 * 不需要維護檔案清單：App 開過一次，載入過的檔案就都進了快取。
 */
const CACHE_NAME = "travel-planner-v2";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(["./", "./index.html", "./manifest.json"])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // 刪掉舊版（v1）留下的快取
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(networkFirst(req));
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const res = await fetch(req, { cache: "no-cache" });
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    return (await cache.match(req, { ignoreSearch: true })) || (await cache.match("./index.html"));
  }
}
