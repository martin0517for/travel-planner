/**
 * linkReader.js — 貼上 IG／Threads 連結，自動讀取標題和內容（v0.11.0，2026-11-02 使用者決定）。
 *
 * App 在瀏覽器裡讀不到 IG／Threads 的內容（跨網域限制），所以透過自己的轉接服務
 * （Cloudflare Worker `tp-link-reader`，程式在倉庫的 worker/link-reader.js）代讀。
 * 轉接服務只負責「讀」；整理成筆記的規則（organizeNote）在這裡，之後調整只要推 GitHub。
 *
 * 匯出：
 *   firstHttpsUrl(text)   從剪貼簿文字找出第一個 https 網址
 *   readableSource(url)   "instagram"｜"threads"｜""（轉接服務讀得了的網址才回傳來源）
 *   cleanLink(url)        IG／Threads 網址去掉 ?igsh= 這類追蹤參數
 *   linkKey(url)          比對「同一篇」用的鍵（重複連結檢查）
 *   readLink(url, signal) 呼叫轉接服務 → { ok, source, author, text, url } 或 { ok: false, error }
 *   organizeNote(data)    讀到的結果 → { title, url, body }
 *
 * 資安：
 *   - 轉接服務回傳的內容一律當成不可信：檢查型別、限制長度，網址只收 IG／Threads 的 https；
 *     畫面一律用 html`` 跳脫，存檔前還會經過 notes.js 的 validateNoteInput／normalizeNote。
 *   - 只送出貼文網址，不帶任何旅程資料、Cookie 或 Referer。
 *   - CSP 的 connect-src 只多開放轉接服務這一個網域（index.html）。
 *   - 讀不到（逾時、被擋、格式不對）一律退回「只帶入連結」，不會讓 App 卡住。
 */
import { safeUrl } from "./html.js";

export const LINK_READER_API = "https://tp-link-reader.martin0517for.workers.dev/api";
const TIMEOUT_MS = 10000; // 超過 10 秒當作讀不到（C-2）
const MAX_RESPONSE = 50000; // 回應超過這個長度就不處理
const LIMITS = { title: 60, body: 3000, author: 60 };

export const SOURCE_LABEL = { instagram: "Instagram", threads: "Threads" };

/** 從一段文字找出第一個 https 網址（剪貼簿裡常常是「看看這篇 https://…」） */
export function firstHttpsUrl(text) {
  const m = String(text || "").match(/https:\/\/[^\s<>"'「」『』（）()]+/);
  if (!m) return "";
  return m[0].replace(/[.,，。、！!？?…]+$/, "").slice(0, 500);
}

function parse(url) {
  try {
    const u = new URL(String(url || "").trim());
    return u.protocol === "https:" ? u : null;
  } catch {
    return null;
  }
}
const hostOf = (u) => u.hostname.toLowerCase().replace(/^www\./, "");

/** 轉接服務讀得了的網址：IG 貼文／Reels、Threads 貼文與分享短網址 */
export function readableSource(url) {
  const u = parse(url);
  if (!u) return "";
  const host = hostOf(u);
  if (host === "instagram.com" && /^\/(?:[A-Za-z0-9._]{1,30}\/)?(p|reel|reels|tv)\/[A-Za-z0-9_-]{5,40}\/?$/.test(u.pathname)) return "instagram";
  if ((host === "threads.net" || host === "threads.com") &&
      /^\/(@[A-Za-z0-9._]{1,30}\/post\/[A-Za-z0-9_-]{5,40}|share\/[A-Za-z0-9_-]{1,40}|t\/[A-Za-z0-9_-]{1,40})\/?$/.test(u.pathname)) return "threads";
  return "";
}

/** IG／Threads 網址去掉查詢參數與 hash；其他網址照原樣 */
export function cleanLink(url) {
  const u = parse(url);
  if (!u || !readableSource(url)) return String(url || "").trim();
  u.search = "";
  u.hash = "";
  return u.href;
}

/** 比對同一篇用的鍵：不分 www、threads.net／.com、reels／reel、結尾斜線、查詢參數 */
export function linkKey(url) {
  const u = parse(url) || (() => { try { return new URL(String(url || "").trim()); } catch { return null; } })();
  if (!u) return "";
  let host = hostOf(u);
  if (host === "threads.net") host = "threads.com";
  let path = u.pathname.replace(/\/+$/, "");
  if (host === "instagram.com") {
    const m = path.match(/\/(p|reel|reels|tv)\/([A-Za-z0-9_-]+)$/);
    if (m) path = `/${m[1] === "reels" ? "reel" : m[1]}/${m[2]}`; // 帳號前綴也拿掉
  }
  // IG／Threads 的查詢參數只是追蹤用；其他網站的參數可能代表不同頁面，保留
  const keepQuery = !(host === "instagram.com" || host === "threads.com");
  return `${host}${path}${keepQuery ? u.search : ""}`;
}

const str = (v, max) => (typeof v === "string" ? [...v].slice(0, max).join("") : "");

/** 呼叫轉接服務。signal：使用者按「取消讀取」時中止 */
export async function readLink(url, signal) {
  const source = readableSource(url);
  if (!source) return { ok: false, error: "只能讀取 IG、Threads 貼文的連結" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const onAbort = () => controller.abort();
  if (signal) signal.addEventListener("abort", onAbort);
  try {
    const res = await fetch(`${LINK_READER_API}?url=${encodeURIComponent(url)}`, {
      method: "GET",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
      signal: controller.signal,
    });
    const raw = await res.text();
    if (raw.length > MAX_RESPONSE) return { ok: false, error: "回應格式不對" };
    const d = JSON.parse(raw);
    if (!d || d.ok !== true || typeof d.text !== "string" || !d.text.trim()) {
      return { ok: false, error: (d && typeof d.error === "string" && str(d.error, 60)) || "讀不到內容" };
    }
    // 回傳的網址必須還是 IG／Threads 的 https 網址，否則用使用者貼的
    const back = typeof d.url === "string" && safeUrl(d.url) && readableSource(d.url) ? d.url : cleanLink(url);
    return {
      ok: true,
      source: d.source === "threads" ? "threads" : d.source === "instagram" ? "instagram" : source,
      author: str(d.author, LIMITS.author).replace(/[^A-Za-z0-9._]/g, ""),
      text: str(d.text, 5000),
      url: back,
    };
  } catch {
    return { ok: false, error: controller.signal.aborted ? "讀取逾時或已取消" : "連線失敗" };
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", onAbort);
  }
}

// ---- 整理成筆記（2026-11-02 使用者決定：現有規則＋T-1～T-3） ----

/** 去掉 #標籤 後的一行；用來當標題 */
const withoutTags = (line) => line.replace(/#[^\s#]+/g, "").replace(/\s{2,}/g, " ").trim();

/** T-1：去掉 #標籤、@帳號、網址後，沒有任何文字或數字（只有分隔符號、emoji）→ 不算有意義的一行 */
function meaningful(line) {
  const core = withoutTags(line).replace(/@[A-Za-z0-9._]+/g, "").replace(/https?:\/\/\S+/g, "");
  return /[\p{L}\p{N}]/u.test(core);
}

/** T-2 用：一行有幾個「字」（中日韓每個字算一個，英文、數字每個詞算一個） */
function wordCount(line) {
  return (withoutTags(line).match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]|[\p{L}\p{N}]+/gu) || []).length;
}

/** T-3：超過 30 字時，切在第一個句子結尾（。！？!?）之後 */
function cutSentence(title) {
  const chars = [...title];
  if (chars.length <= 30) return title;
  const i = chars.findIndex((c) => "。！？!?".includes(c));
  if (i >= 0 && i < chars.length - 1) {
    const cut = chars.slice(0, i + 1).join("").trim();
    if (meaningful(cut)) return cut;
  }
  return title;
}

export function organizeNote(d) {
  const text = String(d.text || "").replace(/\r/g, "").trim();
  const lines = text.split("\n").map((s) => s.trim()).filter(meaningful);
  let title = lines.length ? withoutTags(lines[0]) : "";
  if (title && lines.length > 1 && wordCount(lines[0]) <= 3) title = `${title}｜${withoutTags(lines[1])}`; // T-2
  title = cutSentence(title); // T-3
  if (!title) {
    const label = d.source === "threads" ? "Threads" : "IG";
    title = `${label}${d.author ? ` @${d.author}` : ""} 的貼文`;
  }
  return {
    title: [...title].slice(0, LIMITS.title).join(""),
    url: d.url,
    body: [...text].slice(0, LIMITS.body).join(""),
  };
}
