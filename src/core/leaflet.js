/**
 * leaflet.js — 地圖程式 Leaflet 的載入器（v0.14.0 地圖頁）。
 *
 * Leaflet 1.9.4 的官方檔案放在 public/vendor/leaflet/（從 npm 套件 leaflet@1.9.4 複製，沒有修改）：
 *   - 從自己的網域載入：CSP 的 script-src、style-src 不用開放外部網域；
 *     Service Worker 也會把它存進快取，沒網路時地圖頁照樣打得開（只是底圖圖片出不來）。
 *   - 只有進入地圖頁時才載入（其他頁面不需要，不拖慢 App 開啟）。
 *   - 加上完整性驗證（SRI）：檔案內容跟官方不一樣（被改過）時瀏覽器會拒絕執行。
 *     sha384 是用官方檔案算的；sha256 跟 Leaflet 官網公布的值一致（2026-11-18 比對）。
 *
 * 用法：const L = await loadLeaflet();  失敗時 reject（例如第一次打開就沒網路）。
 */
const BASE = "./public/vendor/leaflet/";
const JS_SRI = "sha384-cxOPjt7s7Iz04uaHJceBmS+qpjv2JkIHNVcuOrM+YHwZOmJGBXI00mdUXEq65HTH";
const CSS_SRI = "sha384-sHL9NAb7lN7rfvG5lfHpm643Xkcjzp4jFvuavGOndn6pjVqS6ny56CAt3nsEVT4H";

let loading = null;

export function loadLeaflet() {
  if (window.L && window.L.version) return Promise.resolve(window.L);
  if (loading) return loading;
  loading = Promise.all([loadCss(), loadJs()])
    .then(() => {
      if (!window.L || !window.L.version) throw new Error("Leaflet 沒有正確載入");
      return window.L;
    })
    .catch((err) => {
      loading = null; // 下次進入地圖頁再試一次
      throw err;
    });
  return loading;
}

function loadJs() {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = BASE + "leaflet.js";
    s.integrity = JS_SRI;
    s.crossOrigin = "anonymous";
    s.onload = () => resolve();
    s.onerror = () => {
      s.remove();
      reject(new Error("地圖程式載入失敗"));
    };
    document.head.appendChild(s);
  });
}

function loadCss() {
  if (document.querySelector('link[data-leaflet]')) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = BASE + "leaflet.css";
    l.integrity = CSS_SRI;
    l.crossOrigin = "anonymous";
    l.dataset.leaflet = "";
    l.onload = () => resolve();
    l.onerror = () => {
      l.remove();
      reject(new Error("地圖樣式載入失敗"));
    };
    // 放在 App 自己的樣式前面，App 的 map.css 才蓋得過 Leaflet 預設樣式
    const first = document.querySelector('link[rel="stylesheet"]');
    document.head.insertBefore(l, first);
  });
}
