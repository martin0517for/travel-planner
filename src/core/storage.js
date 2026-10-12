/**
 * storage.js — 本機儲存（localStorage）的唯一出入口。
 *
 * 規則：
 *   - v2 的資料一律存在 "tp2_" 開頭的 key，絕不讀寫舊版的 "tp_*"，新舊版互不影響。
 *   - 讀取時資料壞掉（被手動改壞、格式不對）不會讓 App 當掉，而是回傳空陣列。
 *   - 寫入失敗（空間滿、無痕模式）會回傳 false，呼叫的地方要告訴使用者。
 *
 * 之後若要換成雲端資料庫，只要換掉這個檔案的實作。
 */
const PREFIX = "tp2_";

export function readCollection(name) {
  try {
    const raw = localStorage.getItem(PREFIX + name);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function writeCollection(name, items) {
  try {
    localStorage.setItem(PREFIX + name, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}

/**
 * 產生不容易重複、無法被猜到的 id（例如 "trip_k3x9q2m7a1bc"）。
 * 使用瀏覽器的密碼學亂數，而不是 Math.random。
 */
export function newId(prefix) {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  const rand = Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 14);
  return `${prefix}_${rand}`;
}

/** id 只允許英數與底線（從網址進來的 id 先用這個檢查，避免奇怪字元） */
export function isValidId(id) {
  return typeof id === "string" && /^[a-z0-9_]{3,40}$/.test(id);
}
