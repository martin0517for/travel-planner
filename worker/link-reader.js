// link-reader.js — Travel Planner 的轉接服務（Cloudflare Worker，名稱 tp-link-reader）
//
// 用途：App（GitHub Pages）在瀏覽器裡讀不到 IG／Threads 的內容（跨網域限制），
//       所以由這個轉接服務代讀「公開貼文的文字」。只負責「讀」，整理標題的規則放在 App 裡。
//
// 介面：GET /api?url=<IG 或 Threads 貼文網址>
//   成功：{ ok: true,  source: "instagram"|"threads", author, text, url, via, topic }
//         topic：Threads 的主題標籤（例如「東京林檎製飴所」），沒有就 ""；IG 一律 ""（2026-11-03 加）
//   失敗：{ ok: false, source, url, error }
//
// 資安（倉庫是公開的，這裡不放任何密碼）：
//   - 只接受 https 的 instagram.com 貼文（p／reel／reels／tv）與 threads.net／threads.com 貼文網址，
//     其他網址一律拒絕，不能被當成任意網址的代理。轉址後的最終網址也要還在 IG／Threads。
//   - 只接受 GET /api；從其他網站的網頁呼叫（Origin 不是 App 網域）一律拒絕。
//   - 不記錄、不保存任何網址或內容；回應加 no-store。
//   - 回傳的文字有長度上限（author 60、text 5000），並去掉 HTML 標籤與不可見字元；
//     App 端仍然把它當成不可信內容（一律跳脫、存檔前再檢查）。
//
// 部署：在 Cloudflare 後台「編輯代碼」貼上整份檔案 → 部署。修改這份檔案後要再貼一次。

const APP_ORIGIN = "https://martin0517for.github.io";
const TIMEOUT_MS = 8000; // 每次對外讀取的時間上限
const MAX_HTML = 800000; // 最多讀前 800 KB
const TOPIC_TIMEOUT_MS = 3000; // Threads 嵌入版（只為了主題標籤）最多等 3 秒，超過就當作沒有，不拖累 App 的 10 秒上限

const UA_BOT = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";
const UA_BROWSER =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

export default {
  async fetch(request) {
    const u = new URL(request.url);
    const origin = request.headers.get("Origin");
    // 瀏覽器從別的網站呼叫時一定會帶 Origin；不是 App 網域就拒絕
    if (origin && origin !== APP_ORIGIN) return json({ ok: false, error: "不允許的來源" }, 403);
    if (request.method !== "GET") return json({ ok: false, error: "只接受 GET" }, 405);
    if (u.pathname !== "/api") return json({ ok: false, error: "找不到" }, 404);

    const target = parseTarget(u.searchParams.get("url"));
    if (!target) return json({ ok: false, error: "只接受 IG、Threads 貼文的 https 網址" }, 400);
    return json(await readPost(target));
  },
};

// ---- 網址檢查 ----
function parseTarget(raw) {
  const s = String(raw || "").trim();
  if (!s || s.length > 500) return null;
  let t;
  try {
    t = new URL(s);
  } catch {
    return null;
  }
  if (t.protocol !== "https:" || t.username || t.password || t.port) return null;
  const host = t.hostname.toLowerCase().replace(/^www\./, "");
  if (host === "instagram.com") {
    const m = t.pathname.match(/^\/(?:[A-Za-z0-9._]{1,30}\/)?(p|reel|reels|tv)\/([A-Za-z0-9_-]{5,40})\/?$/);
    if (!m) return null;
    const type = m[1] === "reels" ? "reel" : m[1];
    const url = `https://www.instagram.com/${type}/${m[2]}/`;
    return { source: "instagram", url, embed: `${url}embed/captioned/` };
  }
  if (host === "threads.net" || host === "threads.com") {
    // 貼文：/@帳號/post/代碼；分享短網址：/share/...、/t/...
    if (!/^\/(@[A-Za-z0-9._]{1,30}\/post\/[A-Za-z0-9_-]{5,40}|share\/[A-Za-z0-9_-]{1,40}|t\/[A-Za-z0-9_-]{1,40})\/?$/.test(t.pathname)) return null;
    return { source: "threads", url: `https://www.${host}${t.pathname}` };
  }
  return null;
}

/** 轉址後的最終網址也必須還在 IG／Threads（不然當成讀不到） */
function allowedHost(href) {
  try {
    const h = new URL(href).hostname.toLowerCase().replace(/^www\./, "");
    return h === "instagram.com" || h === "threads.net" || h === "threads.com";
  } catch {
    return false;
  }
}

// ---- 讀取：先用最穩的方式，失敗再換 ----
async function readPost(p) {
  if (p.source === "instagram") {
    // 1. 嵌入版（測試時最穩定）
    const e = await get(p.embed, UA_BROWSER);
    if (e.html) {
      const author = pick(e.html, /class="UsernameText"[^>]*>([\s\S]*?)</i);
      let text = toText(pick(e.html, /class="Caption"[^>]*>([\s\S]*?)<div class="CaptionComments/i, false));
      if (author && text.startsWith(author)) text = text.slice(author.length).trim();
      if (text) return done(p.source, author, text, p.url, "embed");
    }
    // 2. 一般網址（預覽機器人），從 og:description 取 『…: "內文"』
    const o = await get(p.url, UA_BOT);
    if (o.html) {
      const d = meta(o.html, "og:description");
      const m = d.match(/^[\s\S]*?\s-\s+(\S+)[^:]*:\s*"([\s\S]*)"\.?\s*$/);
      if (m) return done(p.source, m[1], m[2], p.url, "og");
    }
    return { ok: false, source: p.source, url: p.url, error: "IG 沒有回應內容（可能暫時被擋）" };
  }

  const r = await get(p.url, UA_BOT);
  if (r.html) {
    const text = meta(r.html, "og:description");
    const author = (meta(r.html, "og:title").match(/@([A-Za-z0-9._]+)/) || [])[1] || "";
    const ogUrl = meta(r.html, "og:url");
    const url = ogUrl && allowedHost(ogUrl) ? ogUrl : r.url && allowedHost(r.url) ? r.url : p.url;
    if (text) {
      const res = done(p.source, author, text, url, "og");
      res.topic = await threadsTopic(res.url);
      return res;
    }
  }
  return { ok: false, source: p.source, url: p.url, error: "Threads 沒有回應內容" };
}

/**
 * Threads 主題標籤（帳號右邊的「› 東京林檎製飴所」，2026-11-03 加）。
 * 一般網址的頁面裡沒有，只有嵌入版有；嵌入版畫面上的字會被截斷（「東京林檎製�...」），
 * 完整名稱在連結的 q= 參數裡（href 含 serp_type=tags）。
 * 讀不到、找不到、格式不對一律回傳 ""，不影響內文。
 */
async function threadsTopic(postUrl) {
  const m = String(postUrl || "").match(/^https:\/\/www\.threads\.(?:net|com)\/(@[A-Za-z0-9._]{1,30})\/post\/([A-Za-z0-9_-]{5,40})/);
  if (!m) return "";
  const e = await get(`https://www.threads.com/${m[1]}/post/${m[2]}/embed`, UA_BROWSER, TOPIC_TIMEOUT_MS);
  if (!e.html) return "";
  const href = (e.html.match(/<a[^>]+href="([^"]*serp_type=tags[^"]*)"/i) || [])[1];
  if (!href) return "";
  try {
    const q = new URL(decode(href), "https://www.threads.com").searchParams.get("q") || "";
    return clip(q.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " "), 60);
  } catch {
    return "";
  }
}

function done(source, author, text, url, via) {
  return { ok: true, source, author: clip(author, 60), text: clip(text, 5000), url: cleanUrl(url), via, topic: "" };
}

/** 去掉查詢參數與 hash（?igsh=、?xmt= 這類追蹤參數） */
function cleanUrl(s) {
  try {
    const x = new URL(s);
    x.search = "";
    x.hash = "";
    return x.href;
  } catch {
    return "";
  }
}

const INVISIBLE = /[​-‏‪-‮⁦-⁩﻿]/g;
function clip(s, n) {
  return [...String(s || "").replace(INVISIBLE, "").trim()].slice(0, n).join("");
}

async function get(href, ua, timeout = TIMEOUT_MS) {
  try {
    const res = await fetch(href, {
      headers: { "User-Agent": ua, "Accept-Language": "zh-TW,zh;q=0.9,ja;q=0.8,en;q=0.7" },
      redirect: "follow",
      signal: AbortSignal.timeout(timeout),
    });
    if (res.status !== 200 || !allowedHost(res.url) || res.url.includes("/accounts/login")) return { status: res.status };
    return { status: 200, url: res.url, html: (await res.text()).slice(0, MAX_HTML) };
  } catch {
    return { status: 0 };
  }
}

// ---- 文字處理 ----
function meta(html, prop) {
  const tag = (html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*>`, "i")) || [])[0] || "";
  return decode((tag.match(/content=["']([^"']*)["']/i) || [])[1] || "");
}
function pick(s, re, dec = true) {
  const m = s.match(re);
  return m ? (dec ? decode(m[1]).trim() : m[1]) : "";
}
function toText(s) {
  return decode(s.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " "))
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}
function decode(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeChar(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeChar(+d))
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
function safeChar(n) {
  return Number.isInteger(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": APP_ORIGIN,
      Vary: "Origin",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}
