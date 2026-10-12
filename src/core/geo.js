/**
 * geo.js — 座標相關工具：解析地圖連結、OpenStreetMap 搜尋、產生導航網址。
 *
 * 座標格式：lat（緯度，-90～90）、lng（經度，-180～180），數字。
 */
import { safeUrl } from "./html.js";

export function isValidLatLng(lat, lng) {
  return (
    typeof lat === "number" && typeof lng === "number" &&
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

function toPair(a, b) {
  const lat = Number(a);
  const lng = Number(b);
  return isValidLatLng(lat, lng) ? { lat: round(lat), lng: round(lng) } : null;
}

/** 小數點後 6 位（約 10 公分），夠精準也不會存一長串 */
function round(n) {
  return Math.round(n * 1e6) / 1e6;
}

const NUM = "(-?\\d{1,3}(?:\\.\\d+)?)";

/**
 * 從使用者貼上的文字找出座標。支援：
 *   - 直接貼座標：「35.6586, 139.7454」（Google 地圖長按地點可以複製）
 *   - Google 地圖完整網址：…/@35.6586,139.7454,17z…、…!3d35.6586!4d139.7454…、?q=35.6,139.7
 *   - Apple 地圖網址：…?ll=35.6586,139.7454…、…coordinate=35.6586,139.7454…
 * 找不到回傳 null。
 * 注意：maps.app.goo.gl 這種「短網址」裡沒有座標，網頁 App 也無法展開它（瀏覽器的安全限制），
 * 這種情況只會保存連結本身。
 */
export function parseCoordinates(text) {
  if (typeof text !== "string") return null;
  const s = text.trim().slice(0, 2000);
  if (!s) return null;

  // 直接是座標。容許常見的複製格式（2026-10-13 實機回報「(35.71, 139.79)」無法辨識）：
  //   35.71, 139.79　／　(35.71, 139.79)　／　[35.71,139.79]　／　35.71 139.79
  //   35.71° N, 139.79° E（南緯 S、西經 W 會轉成負數）
  const bare = s.replace(/[()（）\[\]{}「」]/g, "").trim();
  let m = bare.match(new RegExp(`^${NUM}\\s*[,，\\s]\\s*${NUM}$`));
  if (m) return toPair(m[1], m[2]);
  m = bare.match(/^(\d{1,3}(?:\.\d+)?)\s*°?\s*([NSns])\s*[,，]?\s*(\d{1,3}(?:\.\d+)?)\s*°?\s*([EWew])$/);
  if (m) {
    const lat = Number(m[1]) * (/[Ss]/.test(m[2]) ? -1 : 1);
    const lng = Number(m[3]) * (/[Ww]/.test(m[4]) ? -1 : 1);
    return toPair(lat, lng);
  }

  let decoded = s;
  try {
    decoded = decodeURIComponent(s);
  } catch {
    /* 解碼失敗就用原字串 */
  }

  const patterns = [
    new RegExp(`!3d${NUM}!4d${NUM}`), // Google 地點的精確座標（優先）
    new RegExp(`@${NUM},${NUM}`), // Google 地圖畫面中心
    new RegExp(`[?&](?:ll|q|query|coordinate|destination|daddr|sll)=${NUM},\\s*${NUM}`), // Google / Apple 參數
  ];
  for (const re of patterns) {
    m = decoded.match(re);
    if (m) {
      const pair = toPair(m[1], m[2]);
      if (pair) return pair;
    }
  }
  return null;
}

/** 這段文字看起來是不是地圖連結（用來決定要不要保存成「地圖連結」） */
export function looksLikeMapUrl(text) {
  const url = safeUrl(text);
  if (!url) return null;
  const host = new URL(url).hostname;
  return /(^|\.)google\.[a-z.]+$|(^|\.)goo\.gl$|(^|\.)maps\.apple\.com$|(^|\.)maps\.apple$|(^|\.)openstreetmap\.org$/.test(host)
    ? url
    : null;
}

/**
 * 用 OpenStreetMap（Nominatim）搜尋地點。
 * 隱私：只送出搜尋文字，不送任何旅程資料。依 Nominatim 使用規範：
 *   只在使用者按「搜尋」時才查詢（不會邊打字邊查）、每秒最多 1 次、標示來源網站。
 * 回傳 [{ name, address, lat, lng }]，每筆都檢查過格式；失敗時丟出錯誤訊息。
 */
let lastSearchAt = 0;
export async function searchPlaces(query) {
  const q = String(query || "").trim().slice(0, 120);
  if (!q) throw new Error("請先輸入要搜尋的名稱");

  const wait = 1100 - (Date.now() - lastSearchAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastSearchAt = Date.now();

  const url =
    "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&addressdetails=0" +
    "&accept-language=zh-TW,zh,ja,en&q=" + encodeURIComponent(q);

  let res;
  try {
    // 只告訴對方「從哪個網站來」（網域），不帶完整網址，符合 Nominatim 要求標示來源的規範
    res = await fetch(url, { referrerPolicy: "strict-origin", credentials: "omit" });
  } catch {
    throw new Error("無法連線到搜尋服務，請確認網路，或改用貼上地圖連結");
  }
  if (!res.ok) throw new Error("搜尋服務暫時無法使用，請稍後再試，或改用貼上地圖連結");

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error("搜尋結果格式不正確");
  }
  if (!Array.isArray(data)) return [];

  return data
    .slice(0, 6)
    .map((item) => {
      const pair = item && toPair(item.lat, item.lon);
      if (!pair) return null;
      const full = typeof item.display_name === "string" ? item.display_name.slice(0, 200) : "";
      const name = typeof item.name === "string" && item.name ? item.name.slice(0, 60) : full.split(",")[0];
      return { name, address: full, ...pair };
    })
    .filter(Boolean);
}

/**
 * 導航用的網址（2026-10-13 使用者決定）：
 *   有保存「Google 地圖連結」就直接打開它；沒有就用「名稱＋地區」在 Google 地圖搜尋。
 * 座標不用在導航，只用在 App 內的地圖標示。
 */
export function navigationUrl(place) {
  const saved = safeUrl(place.mapsUrl);
  if (saved) return saved;
  const q = [place.name, place.area].filter(Boolean).join(" ").trim();
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null;
}
