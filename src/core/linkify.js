/**
 * linkify.js — 把備註裡的網址變成可以點的連結（安全版本）。
 *
 * 做法：先把文字切成「一般文字」和「網址」，一般文字照常跳脫；
 * 網址再經過 safeUrl() 確認是 http/https 才做成連結，並加上 rel="noopener noreferrer"。
 * 換行會保留（靠 CSS 的 white-space: pre-wrap）。
 */
import { html, safeUrl } from "./html.js";

const URL_RE = /https?:\/\/[^\s<>"'，。、）)]+/g;

export function linkify(text) {
  const s = String(text || "");
  const parts = [];
  let last = 0;
  for (const match of s.matchAll(URL_RE)) {
    parts.push(s.slice(last, match.index));
    const url = safeUrl(match[0]);
    parts.push(
      url
        ? html`<a href="${url}" target="_blank" rel="noopener noreferrer">${match[0]}</a>`
        : match[0]
    );
    last = match.index + match[0].length;
  }
  parts.push(s.slice(last));
  return html`${parts}`;
}

/**
 * linkSource(url) — 依網址顯示來源名稱，給「參考連結」按鈕用。
 *   instagram.com → Instagram、threads.net / threads.com → Threads、
 *   facebook.com / fb.com → Facebook、youtube.com / youtu.be → YouTube、
 *   其他網站顯示網域（去掉 www.），例如 tabelog.com。
 * 只讀網址的主機名稱，不會連網；回傳的是純文字，畫面上一樣會跳脫。
 */
const KNOWN_SOURCES = [
  [["instagram.com"], "Instagram"],
  [["threads.net", "threads.com"], "Threads"],
  [["facebook.com", "fb.com", "fb.me"], "Facebook"],
  [["youtube.com", "youtu.be"], "YouTube"],
];

export function linkSource(url) {
  let host;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return "參考連結";
  }
  for (const [domains, label] of KNOWN_SOURCES) {
    if (domains.some((d) => host === d || host.endsWith("." + d))) return label;
  }
  return host.replace(/^www\./, "") || "參考連結";
}
