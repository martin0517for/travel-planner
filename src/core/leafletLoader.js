/**
 * 動態載入 Leaflet（CSS + JS，from cdnjs）。
 * 只有真的進到地圖分頁才會載入，其他頁面不用背這個函式庫的重量。
 * 多次呼叫會共用同一個 Promise，不會重複注入 <script>/<link>。
 */
let leafletPromise = null;

export function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;

  leafletPromise = new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    script.onload = () => resolve(window.L);
    script.onerror = () => reject(new Error("Leaflet 載入失敗，請確認網路連線"));
    document.head.appendChild(script);
  });

  return leafletPromise;
}
