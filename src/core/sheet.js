/**
 * sheet.js — 彈出畫面（表單、預覽都用這個）。
 *
 * 用法：
 *   openSheet({
 *     title: "新增旅程",
 *     body: html`...`,            // 必須是 html`...` 產生的內容
 *     onMount(panel, close) { … } // 綁定按鈕事件；呼叫 close() 關閉
 *   });
 *
 * 兩種外觀（自動判斷，2026-10-13 第三次修正 iPhone 鍵盤問題後決定）：
 *   1. 有輸入框的「表單」→ 整頁顯示（page 模式）
 *      表單就是一般的網頁內容，點輸入框時由 iPhone 自己平順地捲動到那一欄，
 *      不用任何程式去對抗鍵盤，所以不會跳動。開啟時隱藏後面的頁面並捲到最上面，
 *      關閉後回到原本的捲動位置。
 *   2. 沒有輸入框的「預覽」→ 從底部滑出的面板（sheet 模式），不會叫出鍵盤。
 *
 * 之前試過、已放棄的做法（原因記在開發紀錄）：
 *   - 開啟時自動 focus：滑出動畫途中跳鍵盤，畫面錯位
 *   - 用 visualViewport 讓面板跟著鍵盤：和 iPhone 自己推動畫面有時間差，會跳一下
 *   - 點擊瞬間把輸入框移到上方再 focus：面板被捲到奇怪的位置
 *
 * 關閉方式：按 ×、電腦上按 Esc、（sheet 模式）點背景。
 */
import { html, render } from "./html.js";

const openPages = []; // 目前開著的整頁表單（可能疊好幾層）

export function openSheet({ title, body, onMount }) {
  const wrapper = document.createElement("div");
  render(
    wrapper,
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
  const panel = wrapper.querySelector(".sheet");
  const isPage = Boolean(
    panel.querySelector('input:not([type="radio"]):not([type="checkbox"]), textarea, select')
  );
  const previousFocus = document.activeElement;
  const scrollY = window.scrollY;

  if (isPage) {
    // ---- 整頁表單 ----
    wrapper.className = "sheet-page";
    openPages.forEach((p) => (p.hidden = true)); // 疊在上面時，先藏起下面那層
    openPages.push(wrapper);
    document.body.classList.add("has-page-sheet"); // CSS 會隱藏原本的頁面
    document.body.appendChild(wrapper);
    window.scrollTo(0, 0);
  } else {
    // ---- 底部面板 ----
    wrapper.className = "sheet-backdrop";
    document.body.style.top = `-${scrollY}px`;
    document.body.classList.add("is-locked");
    document.body.appendChild(wrapper);
    wrapper.addEventListener("click", (e) => {
      if (e.target === wrapper) close();
    });
  }

  function close() {
    document.removeEventListener("keydown", onKey);
    wrapper.remove();
    if (isPage) {
      openPages.splice(openPages.indexOf(wrapper), 1);
      const below = openPages[openPages.length - 1];
      if (below) below.hidden = false;
      else document.body.classList.remove("has-page-sheet");
    } else {
      document.body.classList.remove("is-locked");
      document.body.style.top = "";
    }
    window.scrollTo(0, scrollY);
    if (previousFocus && previousFocus.focus) previousFocus.focus({ preventScroll: true });
  }
  function onKey(e) {
    if (e.key === "Escape") close();
  }

  panel.querySelector(".sheet__close").addEventListener("click", close);
  document.addEventListener("keydown", onKey);

  if (onMount) onMount(panel, close);
  return { close, panel };
}
