/**
 * service-worker.js — 讓 App 在沒網路時也能打開（Phase 6）。
 *
 * 策略：
 *   1. 自己的程式檔（同網域）→「網路優先」：有網路就一律抓最新版，所以每次推上 GitHub
 *      之後，手機重新開 App 就會看到新版；抓到的同時存一份到快取。
 *      沒網路時才改用快取裡上一次的版本。
 *   2. 外部的字體與 Leaflet（Google Fonts、cdnjs）→「快取優先」：這些檔案不會變，
 *      存過一次就直接用快取，省流量也比較快。
 *   3. 地圖圖磚、天氣、匯率等其他外部請求 → 不攔截，維持一般網路行為。
 *
 * 不需要維護「要快取哪些檔案」的清單：App 開過一次，載入過的檔案就都進了快取。
 * 注意：這裡只快取「程式」，旅程資料本來就存在 localStorage，跟快取無關。
 */

const CACHE_NAME = "travel-planner-v1";

const CDN_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com", "cdnjs.cloudflare.com"];

self.addEventListener("install", (event) => {
  // 先存首頁，確保離線時至少打得開
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(["./", "./index.html", "./manifest.json"]))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // 清掉舊版本名稱的快取（之後若把 CACHE_NAME 改成 v2，v1 會在這裡被刪掉）
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

  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(req));
  } else if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(req));
  }
  // 其他外部請求不呼叫 respondWith，交給瀏覽器照常處理
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const res = await fetch(req, { cache: "no-cache" }); // 每次都向伺服器確認是否有新版
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    // 沒網路：用快取。網址帶 #/trips 之類的 hash 不影響比對；找不到就退回首頁
    return (await cache.match(req, { ignoreSearch: true })) || (await cache.match("./index.html"));
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  // 跨網域的字體回應可能是 opaque（status 0），一樣可以存起來使用
  if (res.ok || res.type === "opaque") cache.put(req, res.clone());
  return res;
}
