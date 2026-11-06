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

  // Google 地點的精確座標（優先）。data= 裡可能有好幾組：前面的是之前看過的地點（例如從 Tas Yard 點到別家店），
  // 這次這個地點排在最後 → 取最後一組（v0.13.7，2026-11-07 用 8 個實機網址確認）
  const precise = [...decoded.matchAll(new RegExp(`!3d${NUM}!4d${NUM}`, "g"))];
  for (let i = precise.length - 1; i >= 0; i--) {
    const pair = toPair(precise[i][1], precise[i][2]);
    if (pair) return pair;
  }
  const patterns = [
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

/**
 * 從 Google 地圖連結的 ftid（地點編號，例如 ftid=0x60188cb9586e6db9:0x9093260be65cfcf6，
 * 或 data= 裡的 !1s0x…:0x…）估算約略座標（v0.13.7，2026-11-07 使用者決定）。
 *
 * ftid 前半段是 S2 格子編號（Google 把地球切成格子的編號方式），換算成格子中心就是座標。
 * 這不是 Google 公開的規則，2026-11-07 用 9 個東京地點比對瀏覽器網址的 !3d!4d：
 * 6 個差 0.4～29 公尺，3 個差 3.5～9.7 公里（看起來是地點建檔時的位置，之後圖釘移過）。
 * 所以只在連結裡完全找不到座標時才用，存檔時標成「約略」（Place.geoApprox）。
 * 找不到或格式不對回傳 null。純計算，不連網。
 */
export function ftidCoords(text) {
  if (typeof text !== "string") return null;
  let s = text.slice(0, 2000);
  try {
    s = decodeURIComponent(s);
  } catch {
    /* 解碼失敗就用原字串 */
  }
  const FEATURE = "(0x[0-9a-f]{1,16}):0x[0-9a-f]{1,16}";
  let hex = null;
  const param = s.match(new RegExp(`[?&]ftid=${FEATURE}(?![0-9a-z])`, "i"));
  if (param) hex = param[1];
  else {
    // data= 裡 !1s 的地點編號（!5s 是所在的大樓，不用）；跟 !3d!4d 一樣取最後一個
    const all = [...s.matchAll(new RegExp(`!1s${FEATURE}(?![0-9a-z])`, "gi"))];
    if (all.length) hex = all[all.length - 1][1];
  }
  if (!hex) return null;
  const ll = s2CellCenter(BigInt(hex.toLowerCase()));
  return ll ? toPair(ll.lat, ll.lng) : null;
}

// ---- S2 格子編號 → 格子中心的緯度、經度（照 S2 函式庫 S2CellId::ToFaceIJOrientation、FaceUVtoXYZ 的算法） ----
const POS_TO_IJ = [[0, 1, 3, 2], [0, 2, 3, 1], [3, 2, 0, 1], [3, 1, 0, 2]];
const POS_TO_ORIENTATION = [1, 0, 0, 3];
const MAX_LEVEL = 30;

function s2CellCenter(id) {
  if (id <= 0n || id >= 1n << 64n) return null;
  const face = Number(id >> 61n);
  if (face > 5) return null;
  // 最低位的 1 決定層級：第 30 層（最細，約 1 公分）在第 0 位，每粗一層往上 2 位
  let low = 0;
  while (((id >> BigInt(low)) & 1n) === 0n) low++;
  if (low % 2 !== 0 || low > 2 * MAX_LEVEL) return null;
  const level = MAX_LEVEL - low / 2;

  let i = 0;
  let j = 0;
  let orientation = face & 1;
  for (let k = 0; k < level; k++) {
    const pos = Number((id >> BigInt(59 - 2 * k)) & 3n);
    const ij = POS_TO_IJ[orientation][pos];
    i = i * 2 + (ij >> 1);
    j = j * 2 + (ij & 1);
    orientation ^= POS_TO_ORIENTATION[pos];
  }
  const size = 2 ** (MAX_LEVEL - level);
  const s = (i * size + size / 2) / 2 ** MAX_LEVEL;
  const t = (j * size + size / 2) / 2 ** MAX_LEVEL;
  const u = stToUv(s);
  const v = stToUv(t);
  const [x, y, z] = [
    [1, u, v], [-u, 1, v], [-u, -v, 1], [-1, -v, -u], [v, -1, -u], [v, u, -1],
  ][face];
  const lat = (Math.atan2(z, Math.hypot(x, y)) * 180) / Math.PI;
  const lng = (Math.atan2(y, x) * 180) / Math.PI;
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

function stToUv(s) {
  return s >= 0.5 ? (4 * s * s - 1) / 3 : (1 - 4 * (1 - s) * (1 - s)) / 3;
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
