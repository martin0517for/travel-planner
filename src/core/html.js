/**
 * html.js — 安全地產生畫面 HTML（防 XSS 的核心工具）。
 *
 * 用法：
 *   import { html, raw, render } from "../core/html.js";
 *   const view = html`<h2>${trip.name}</h2><p>${trip.notes}</p>`;
 *   render(container, view);
 *
 * 規則：
 *   - 用 html`...` 包起來的範本裡，所有 ${...} 的值都會「自動跳脫」，
 *     就算旅程名稱是 <script>…</script>，畫面上也只會顯示成文字，不會被執行。
 *   - 陣列會自動展開（方便 items.map(i => html`...`)）。
 *   - null / undefined / false 會變成空字串（方便寫 ${cond && html`...`}）。
 *   - 巢狀的 html`...` 結果是「已經安全」的，不會被重複跳脫。
 *   - raw(str) 用來放「自己寫死、確定安全」的 HTML（例如 SVG 圖示）。
 *     **絕對不要把使用者輸入的文字傳給 raw()。**
 *
 * 全專案規定：畫面一律用 render(container, html`...`) 產生，
 * 不直接對 innerHTML 指派字串。
 */

const SAFE = Symbol("safe-html");

class SafeHtml {
  constructor(str) {
    this.value = str;
    this[SAFE] = true;
  }
  toString() {
    return this.value;
  }
}

const ESCAPE_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;" };

/** 把任何文字轉成可以安全放進 HTML（含屬性值）的字串 */
export function escapeHtml(value) {
  return String(value).replace(/[&<>"'`]/g, (ch) => ESCAPE_MAP[ch]);
}

function toSafeString(value) {
  if (value === null || value === undefined || value === false) return "";
  if (value && value[SAFE]) return value.value;
  if (Array.isArray(value)) return value.map(toSafeString).join("");
  return escapeHtml(value);
}

/** 範本標籤：插入的值自動跳脫 */
export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) {
    out += toSafeString(values[i]) + strings[i + 1];
  }
  return new SafeHtml(out);
}

/** 標記「確定安全」的 HTML（只能用在程式自己寫死的內容，例如 SVG 圖示） */
export function raw(trustedHtml) {
  return new SafeHtml(String(trustedHtml));
}

/** 把 html`...` 的結果畫進容器。只接受 SafeHtml，傳一般字串會直接報錯，避免誤用。 */
export function render(container, safe) {
  if (!safe || !safe[SAFE]) {
    throw new TypeError("render() 只接受 html`...` 產生的內容");
  }
  container.innerHTML = safe.value;
}

/**
 * 檢查網址是否安全可以當連結（只允許 http / https）。
 * 擋掉 javascript:、data: 之類可以執行程式的網址。回傳安全網址，或不安全時回傳 null。
 */
export function safeUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(String(value).trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}
