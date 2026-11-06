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
 *   readMapLink(url, signal) → { ok: true, name, address, coords }（name 可能是 ""）或 { ok: false, error }
 *
 * 規則：`/maps/place/店名/` 整段是名稱；`?q=` 要把名稱和地址分開（見 splitQuery）。
 * 只有地址、沒有名稱時也回傳 ok（name 是 ""），表單只帶入地址（v0.13.3）。
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

/** 長得像地址開頭的一個詞：門牌（1-1、2-24-12、3丁目、5番地）、〒、郵遞區號接中文（106台北市） */
const ADDR_WORD = /^(?:〒|[0-9０-９]+[-−‐－ー][0-9０-９]|[0-9０-９]+(?:丁目|番地?|号|號)|[0-9０-９]{3,6}\p{Script=Han})/u;
/** 整段一開頭就是地址（可以先有國名）：日本〒150-6145 …、〒151-…、台灣106台北市…、1-1 Yoyogi… */
const ADDR_START = /^(?:(?:日本|台灣|臺灣|Japan|Taiwan)[、,\s]*(?:〒|[0-9０-９])|〒)/u;
/** 日本地址的英文寫法：`3 Chome-3-14`（3 丁目 3-14，也接受 Chōme），v0.13.5 */
const CHOME_START = /^[0-9０-９]+\s+ch[oō]me/iu;
const startsLikeAddress = (s) => ADDR_START.test(s) || ADDR_WORD.test(s) || CHOME_START.test(s);
/** 第 i 個詞是不是地址開頭：ADDR_WORD，或「數字＋下一個詞以 Chome 開頭」 */
const addressAt = (words, i) =>
  ADDR_WORD.test(words[i]) || (/^[0-9０-９]+$/.test(words[i]) && /^ch[oō]me/iu.test(words[i + 1] || ""));

/** 名稱、地址最後整理：去掉頭尾逗號、限制長度；名稱沒有字或只是座標 → 空的 */
function finish(name, address) {
  name = oneLine(String(name).replace(/^[,，\s]+|[,，\s]+$/g, ""), LIMITS.name);
  address = oneLine(String(address).replace(/^[,，\s]+|[,，\s]+$/g, ""), LIMITS.address);
  if (!/[\p{L}\p{N}]/u.test(name) || parseCoordinates(name)) name = "";
  if (!/[\p{L}\p{N}]/u.test(address) || parseCoordinates(address)) address = "";
  return { name, address };
}

/**
 * `?q=` 的文字 → { name, address }（v0.13.2、v0.13.3，2026-11-06 用實機連結修正）
 *   - 一開頭就是地址（澀谷 SKY：`日本〒150-6145 Tokyo, …`）→ 只有地址、沒有名稱。
 *   - `明治神宮 1-1 Yoyogikamizonocho, …`：名稱和地址之間只有空格 → 找第一個「長得像地址開頭」的詞
 *     （ADDR_WORD，前面至少要有一個詞）；只是以數字開頭（6)、1899、2）不算。
 *   - v0.13.5：第一個逗號後面一開頭就像地址（含 `3 Chome-3-14`）→ 先在逗號切開；
 *     一個一個詞找時，「數字＋下一個詞以 Chome 開頭」也算地址開頭。
 *   - 都找不到才用逗號：逗號前＝名稱、逗號後＝地址。
 *   - 已知限制：美國式地址（1600 Amphitheatre Pkwy）認不出來，會退回逗號規則。
 */
function splitQuery(text) {
  const s = oneLine(text, 500);
  if (!s || parseCoordinates(s)) return { name: "", address: "" };
  if (startsLikeAddress(s)) return finish("", s);
  // 第一個逗號後面一開頭就像地址 → 在逗號切開（Tas Yard, 3 Chome-3-14 Sendagaya, …，v0.13.5）
  const i = s.search(/[,，]/);
  if (i > 0 && startsLikeAddress(s.slice(i + 1).trim())) return finish(s.slice(0, i), s.slice(i + 1));
  const words = s.split(" ");
  const at = words.findIndex((w, k) => k > 0 && addressAt(words, k));
  if (at > 0) return finish(words.slice(0, at).join(" "), words.slice(at).join(" "));
  return i >= 0 ? finish(s.slice(0, i), s.slice(i + 1)) : finish(s, "");
}

/** `/maps/place/店名/` 的店名：整段都是名稱，不切地址（Milk Shop Luck Akihabara (Platform 6)）；一開頭就是地址時當成地址 */
function placeSegment(text) {
  const s = oneLine(text, 500);
  if (!s || parseCoordinates(s)) return { name: "", address: "" };
  return startsLikeAddress(s) ? finish("", s) : finish(s, "");
}

/** 解析 Google 地圖完整網址 → { name, address, coords } */
export function parseGoogleMapsUrl(text) {
  const empty = { name: "", address: "", coords: null };
  const u = parse(text);
  if (!u || !isFull(u)) return empty;
  const coords = parseCoordinates(u.href);
  const place = u.pathname.match(/^\/maps\/place\/([^/]+)/);
  if (place) {
    const r = placeSegment(decodePart(place[1]));
    if (r.name || r.address) return { ...r, coords };
  }
  const search = u.pathname.match(/^\/maps\/search\/([^/]+)/);
  const raw = (search && decodePart(search[1])) || u.searchParams.get("q") || u.searchParams.get("query") || "";
  return { ...splitQuery(raw), coords };
}

/** 讀出連結裡的名稱（短網址透過轉接服務展開）。signal：表單關掉或重讀時中止 */
export async function readMapLink(text, signal) {
  const kind = mapLinkKind(text);
  if (kind === "full") {
    const r = parseGoogleMapsUrl(text);
    return r.name || r.address ? { ok: true, ...r } : { ok: false, error: "這個連結裡沒有名稱" };
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
    return r.name || r.address ? { ok: true, ...r } : { ok: false, error: "這個連結裡沒有名稱" };
  } catch {
    return { ok: false, error: controller.signal.aborted ? "讀取逾時" : "連線失敗" };
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", onAbort);
  }
}
