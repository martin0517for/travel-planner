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

  // ---- 防止 iPhone 點輸入框時「整個畫面跳一下」（2026-10-13 實機回報）----
  // 原因：iPhone 跳出鍵盤時，會先把整個畫面往上推（平移可視範圍）讓輸入框露出來，
  //      上面的程式再把面板對齊回去，兩個動作有時間差，看起來就是跳一下。
  // 做法（業界常用的 iOS 技巧）：手指放開的那一刻，先把輸入框「暫時移到畫面最上方」再 focus，
  //      iPhone 以為輸入框已經看得到，就不會推畫面；下一個畫格再移回原位。
  //      鍵盤升起後，由我們自己在面板內「捲動」讓輸入框露出來（不動整個畫面）。
  const TEXT_INPUT = 'input:not([type="radio"]):not([type="checkbox"]):not([type="button"]), textarea';
  // 手指是在「滑動」而不是「點」的話，不要攔截（不然滑過輸入框也會跳出鍵盤）
  let touchStart = null;
  panel.addEventListener("touchstart", (e) => {
    const t = e.touches[0];
    touchStart = { x: t.clientX, y: t.clientY };
  }, { passive: true });
  function onTouchEnd(e) {
    const t = e.changedTouches[0];
    if (!touchStart || Math.abs(t.clientX - touchStart.x) > 10 || Math.abs(t.clientY - touchStart.y) > 10) return;
    const el = e.target.closest ? e.target.closest(TEXT_INPUT) : null;
    if (!el || !panel.contains(el) || document.activeElement === el || el.disabled || el.readOnly) return;
    e.preventDefault();
    el.style.transform = "translateY(-2000px)";
    el.focus({ preventScroll: true });
    requestAnimationFrame(() => {
      el.style.transform = "";
    });
  }
  panel.addEventListener("touchend", onTouchEnd, { passive: false });

  // 讓目前輸入的欄位在面板裡看得到：只捲面板本身、瞬間完成、需要時才捲
  function revealFocused() {
    const el = document.activeElement;
    if (!el || !panel.contains(el) || !el.matches(TEXT_INPUT + ", select")) return;
    const box = panel.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const margin = 24;
    if (r.bottom > box.bottom - margin) panel.scrollTop += r.bottom - box.bottom + margin;
    else if (r.top < box.top + margin) panel.scrollTop -= box.top + margin - r.top;
  }
  panel.addEventListener("focusin", () => setTimeout(revealFocused, 0));
  if (vv) vv.addEventListener("resize", revealFocused);

  function close() {
    if (vv) {
      vv.removeEventListener("resize", fitToViewport);
      vv.removeEventListener("resize", revealFocused);
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
