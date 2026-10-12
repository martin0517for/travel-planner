/**
 * placeholder.js — 還沒實作的頁面先顯示這個，讓外框與導覽可以先測試。
 * 每完成一個功能，就把對應路由換成真正的頁面。
 */
import { html, render } from "../../core/html.js";

export function renderPlaceholder(container, { heading, note }) {
  render(
    container,
    html`
      <div class="placeholder">
        <div class="placeholder__badge">COMING SOON</div>
        <h2>${heading}</h2>
        <p>${note}</p>
      </div>
    `
  );
}
