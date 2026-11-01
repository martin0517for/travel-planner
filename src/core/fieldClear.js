/**
 * fieldClear.js — 日期、時間欄位的「清除」（v0.8.3，使用者決定）。
 *
 * iPhone 的日期／時間選擇器不一定有清除按鈕，所以有值時在標題右邊顯示小字「清除」：
 *   ${clearLabel("act-start-date", "開始日")}
 *   <input id="act-start-date" type="date" ...>
 *   …onMount 裡呼叫 wireClearButtons(panel)
 * 按「清除」會清空欄位並發出 input、change 事件（表單裡的連動照常運作，例如「共 N 天」）。
 * 不會自動 focus，避免叫出鍵盤或選擇器。
 */
import { html } from "./html.js";

/** 欄位標題＋右邊的「清除」（沒值時隱藏） */
export function clearLabel(inputId, label) {
  return html`
    <div class="field__head">
      <label for="${inputId}">${label}</label>
      <button type="button" class="field__clear" data-clear="${inputId}" hidden aria-label="清除${label}">清除</button>
    </div>
  `;
}

/** 綁定 root 裡所有「清除」按鈕；回傳 sync()，程式改了欄位值後可以呼叫它更新按鈕 */
export function wireClearButtons(root) {
  const pairs = [...root.querySelectorAll("[data-clear]")]
    .map((btn) => ({ btn, input: root.querySelector(`#${CSS.escape(btn.dataset.clear)}`) }))
    .filter((p) => p.input);
  const sync = () => pairs.forEach(({ btn, input }) => (btn.hidden = !input.value));
  // 掛在 root：表單程式自己改了別的欄位（例如開始日改了、結束日跟著調整）也會更新
  root.addEventListener("input", sync);
  root.addEventListener("change", sync);
  for (const { btn, input } of pairs) {
    btn.addEventListener("click", () => {
      input.value = "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      sync();
    });
  }
  sync();
  return sync;
}
