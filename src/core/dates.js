/**
 * dates.js — 日期工具。日期一律用 "YYYY-MM-DD" 字串儲存。
 *
 * 注意（舊版的坑）：new Date("2027-03-25") 會被當成「UTC 午夜」，
 * 在台灣（UTC+8）可能差一天。這裡一律用「本地時間」解析日期。
 */

/** "YYYY-MM-DD" → 本地時間午夜的 Date；格式錯誤或日期不存在（例如 2/30）回傳 null */
export function parseDate(str) {
  if (typeof str !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const [y, m, d] = str.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

export function isValidDate(str) {
  return parseDate(str) !== null;
}

function today() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** 兩個日期相差幾天（b - a），用四捨五入避開夏令時間造成的小數 */
export function daysBetween(a, b) {
  return Math.round((b - a) / DAY_MS);
}

/**
 * 旅程目前的狀態，給票根顯示用：
 *   { kind: "none" }                       沒填出發日
 *   { kind: "upcoming", days: 12 }         還有 12 天出發（0 = 今天出發）
 *   { kind: "ongoing", day: 3, total: 6 }  旅程進行中，第 3 天（共 6 天）
 *   { kind: "ended" }                      已結束
 */
export function tripStatus(startDate, endDate) {
  const start = parseDate(startDate);
  if (!start) return { kind: "none" };
  const end = parseDate(endDate) || start;
  const now = today();
  if (now < start) return { kind: "upcoming", days: daysBetween(now, start) };
  if (now > end) return { kind: "ended" };
  return { kind: "ongoing", day: daysBetween(start, now) + 1, total: daysBetween(start, end) + 1 };
}

/** 顯示用："2027-03-25 → 03-30"（同年時省略結束日的年份） */
export function formatRange(startDate, endDate) {
  if (!startDate) return "日期未定";
  if (!endDate || endDate === startDate) return startDate;
  const sameYear = startDate.slice(0, 4) === endDate.slice(0, 4);
  return `${startDate} → ${sameYear ? endDate.slice(5) : endDate}`;
}
