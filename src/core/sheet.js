/**
 * sheet.js — 從螢幕底部滑出的面板（表單、預覽都用這個）。
 *
 * 用法：
 *   const sheet = openSheet({
 *     title: "新增旅程",
 *     body: html`...`,            // 必須是 html`...` 產生的內容
 *     onMount(panel, close) { … } // 綁定按鈕事件；呼叫 close() 關閉
 *   });
 *
 * 點背景、按右上角 ×、或電腦上按 Esc 都會關閉。
 * 開啟時鎖住後面頁面的捲動，避免在 iPhone 上滑動表單時連後面一起捲。
 */
import { html, render } from "./html.js";

export function openSheet({ title, body, onMount }) {
  const backdrop = document.createElement("div");
  backdrop.className = "sheet-backdrop";
  render(
    backdrop,
    html`
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <div class="sheet__handle" aria-hidden="true"></div>
        <div class="sheet__header">
          <h2 id="sheet-title" class="sheet__title">${title}</h2>
          <button type="button" class="sheet__close" aria-label="關閉">&times;</button>
        </div>
        <div class="sheet__body">${body}</div>
      </div>
    `
  );

  const previousFocus = document.activeElement;
  document.body.appendChild(backdrop);
  document.body.classList.add("is-locked");

  function close() {
    backdrop.remove();
    document.body.classList.remove("is-locked");
    document.removeEventListener("keydown", onKey);
    if (previousFocus && previousFocus.focus) previousFocus.focus();
  }
  function onKey(e) {
    if (e.key === "Escape") close();
  }

  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });
  backdrop.querySelector(".sheet__close").addEventListener("click", close);
  document.addEventListener("keydown", onKey);

  const panel = backdrop.querySelector(".sheet");
  if (onMount) onMount(panel, close);
  return { close, panel };
}
