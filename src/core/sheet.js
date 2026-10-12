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
 *
 * iPhone 鍵盤的處理（2026-10-13 修正跳畫面的 bug）：
 *   1. 打開面板時「不自動」把游標放進輸入框。自動 focus 會在滑出動畫途中跳出鍵盤，
 *      iPhone 依動畫中的位置捲動，結束後畫面就錯位，正在輸入的欄位被推出畫面外。
 *   2. 鍵盤出現時，用 visualViewport（扣掉鍵盤後真正看得到的範圍）調整面板的高度與位置，
 *      讓面板永遠在鍵盤上方，不會被鍵盤蓋住。
 *   3. 點了某個輸入框後，等鍵盤升起，再把那一格捲到面板中間。
 *   4. 鎖住後面頁面：用 position: fixed 固定 body，iPhone 才不會連後面頁面一起捲動，
 *      關閉時再回到原本的捲動位置。
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
  const panel = backdrop.querySelector(".sheet");

  // ---- 鎖住後面的頁面 ----
  const scrollY = window.scrollY;
  document.body.style.top = `-${scrollY}px`;
  document.body.classList.add("is-locked");
  document.body.appendChild(backdrop);

  // ---- 讓面板跟著「扣掉鍵盤後的可視範圍」 ----
  // （這裡用 JS 設定樣式屬性，不受 CSP 對 HTML style="..." 的限制）
  const vv = window.visualViewport;
  function fitToViewport() {
    if (!vv) return;
    backdrop.style.top = `${vv.offsetTop}px`;
    backdrop.style.height = `${vv.height}px`;
    backdrop.style.bottom = "auto";
  }
  if (vv) {
    vv.addEventListener("resize", fitToViewport);
    vv.addEventListener("scroll", fitToViewport);
    fitToViewport();
  }

  // ---- 點了輸入框後，等鍵盤升起再把它捲到面板中間 ----
  function onFocusIn(e) {
    const el = e.target;
    if (!el.matches("input, textarea, select")) return;
    setTimeout(() => {
      if (document.activeElement === el) el.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 350);
  }
  panel.addEventListener("focusin", onFocusIn);

  function close() {
    if (vv) {
      vv.removeEventListener("resize", fitToViewport);
      vv.removeEventListener("scroll", fitToViewport);
    }
    document.removeEventListener("keydown", onKey);
    backdrop.remove();
    document.body.classList.remove("is-locked");
    document.body.style.top = "";
    window.scrollTo(0, scrollY);
    if (previousFocus && previousFocus.focus) previousFocus.focus({ preventScroll: true });
  }
  function onKey(e) {
    if (e.key === "Escape") close();
  }

  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });
  backdrop.querySelector(".sheet__close").addEventListener("click", close);
  document.addEventListener("keydown", onKey);

  if (onMount) onMount(panel, close);
  return { close, panel };
}
