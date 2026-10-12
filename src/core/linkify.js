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
