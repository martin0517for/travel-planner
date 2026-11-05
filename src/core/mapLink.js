/**
 * mapLink.js — 從 Google 地圖連結讀出地點名稱（v0.13.1，2026-11-06 使用者決定）。
 *
 * 兩種連結：
 *   - 完整網址（google.com/maps/place/淺草寺/@35.71,139.79…、maps.google.com/?q=店名, 地址…）
 *     → 在 App 裡直接解析，不連網。
 *   - 短網址（maps.app.goo.gl/…、goo.gl/maps/…，iPhone 分享給的都是這種）裡沒有名稱，
 *     瀏覽器又展開不了，所以請轉接服務（worker/link-reader.js 的 /maps）讀出轉址的目的地，
 *     再用同一套規則解析。
 *
 * 匯出：
 *   mapLinkKind(text)        "full"｜"short"｜"other-map"｜""（不是地圖連結）
 *   parseGoogleMapsUrl(url)  → { name, address, coords }（讀不到的欄位是 "" 或 null）
 *   readMapLink(url, signal) → { ok: true, name, address, coords } 或 { ok: false, error }
 *
 * 規則（E-2）：名稱裡有逗號時，逗號前＝名稱、逗號後＝地址（`?q=店名, 地址` 這種格式）。
 * 只有座標的圖釘（/place/35.71,139.79）當作沒有名稱。
 *
 * 資安：
 *   - 轉接服務回傳的網址必須還是 https 的 Google 地圖網址，否則當作讀不到。
 *   - 名稱、地址一律當成不可信資料：去掉控制字元與不可見字元、合併空白、名稱 60 字、地址 160 字；
 *     表單用 .value 帶入，存檔仍走 places.js 的檢查。
 *   - 只送出使用者貼的短網址，不帶旅程資料、Cookie、Referer；CSP 不用改（同一個轉接服務網域）。
 */
import { safeUrl } from "./html.js";
import { parseCoordinates } from "./geo.js";

const MAPS_API = "https://tp-link-reader.martin0517for.workers.dev/maps";
const TIMEOUT_MS = 10000;
const MAX_RESPONSE = 5000;
const LIMITS = { name: 60, address: 160 };

function parse(text) {
  const url = safeUrl(String(text || "").trim());
  if (!url || url.length > 2000) return null;
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

const GOOGLE_HOST = /^(?:www\.|maps\.)?google\.[a-z]{2,3}(?:\.[a-z]{2})?$/;

function isShort(u) {
  const h = u.hostname.toLowerCase();
  return u.protocol === "https:" &&
    ((h === "maps.app.goo.gl" && /^\/[A-Za-z0-9_-]{4,40}\/?$/.test(u.pathname)) ||
     (h === "goo.gl" && /^\/maps\/[A-Za-z0-9_-]{4,40}\/?$/.test(u.pathname)));
}

function isFull(u) {
  const h = u.hostname.toLowerCase();
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  if (!GOOGLE_HOST.test(h)) return false;
  return h.startsWith("maps.") || u.pathname === "/maps" || u.pathname.startsWith("/maps/");
}

/** 連結的種類：full（Google 完整網址）、short（Google 短網址）、other-map（其他地圖）、""（不是地圖連結） */
export function mapLinkKind(text) {
  const u = parse(text);
  if (!u) return "";
  if (isShort(u)) return "short";
  if (isFull(u)) return "full";
  const h = u.hostname.toLowerCase();
  if (/(^|\.)goo\.gl$|(^|\.)maps\.apple\.com$|(^|\.)maps\.apple$|(^|\.)openstreetmap\.org$/.test(h)) return "other-map";
  return "";
}

/** 一行文字：去掉控制字元與不可見字元（零寬、方向控制），合併空白 */
function oneLine(v, max) {
  if (typeof v !== "string") return "";
  const s = v.replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁩﻿]/g, " ").replace(/\s+/g, " ").trim();
  return [...s].slice(0, max).join("").trim();
}

function decodePart(seg) {
  try {
    return decodeURIComponent(seg.replace(/\+/g, " "));
  } catch {
    return seg.replace(/\+/g, " ");
  }
}

/** 「店名, 地址」→ { name, address }；只有座標、沒有任何文字的 → 空的 */
function splitNameAddress(text) {
  const s = oneLine(text, 500);
  if (!s || parseCoordinates(s)) return { name: "", address: "" };
  const i = s.search(/[,，]/);
  const name = oneLine(i >= 0 ? s.slice(0, i) : s, LIMITS.name);
  const address = i >= 0 ? oneLine(s.slice(i + 1), LIMITS.address) : "";
  if (!/[\p{L}\p{N}]/u.test(name) || parseCoordinates(name)) return { name: "", address: "" };
  return { name, address: /[\p{L}\p{N}]/u.test(address) ? address : "" };
}

/** 解析 Google 地圖完整網址 → { name, address, coords } */
export function parseGoogleMapsUrl(text) {
  const empty = { name: "", address: "", coords: null };
  const u = parse(text);
  if (!u || !isFull(u)) return empty;
  const coords = parseCoordinates(u.href);
  let raw = "";
  const m = u.pathname.match(/^\/maps\/(?:place|search)\/([^/]+)/);
  if (m) raw = decodePart(m[1]);
  if (!raw) raw = u.searchParams.get("q") || u.searchParams.get("query") || "";
  return { ...splitNameAddress(raw), coords };
}

/** 讀出連結裡的名稱（短網址透過轉接服務展開）。signal：表單關掉或重讀時中止 */
export async function readMapLink(text, signal) {
  const kind = mapLinkKind(text);
  if (kind === "full") {
    const r = parseGoogleMapsUrl(text);
    return r.name ? { ok: true, ...r } : { ok: false, error: "這個連結裡沒有名稱" };
  }
  if (kind !== "short") return { ok: false, error: kind === "other-map" ? "只能從 Google 地圖連結帶入名稱" : "這不是 Google 地圖連結" };

  const short = parse(text).href;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const onAbort = () => controller.abort();
  if (signal) signal.addEventListener("abort", onAbort);
  try {
    const res = await fetch(`${MAPS_API}?url=${encodeURIComponent(short)}`, {
      method: "GET",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
      signal: controller.signal,
    });
    const raw = await res.text();
    if (raw.length > MAX_RESPONSE) return { ok: false, error: "回應格式不對" };
    const d = JSON.parse(raw);
    // 舊版轉接服務沒有 /maps → 404「找不到」，一樣當成讀不到
    if (!d || d.ok !== true || typeof d.url !== "string" || mapLinkKind(d.url) !== "full") return { ok: false, error: "短網址展開不了" };
    const r = parseGoogleMapsUrl(d.url);
    return r.name ? { ok: true, ...r } : { ok: false, error: "這個連結裡沒有名稱" };
  } catch {
    return { ok: false, error: controller.signal.aborted ? "讀取逾時" : "連線失敗" };
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", onAbort);
  }
}
