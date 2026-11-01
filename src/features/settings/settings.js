/**
 * settings.js — 設定頁。
 * 目前只有最下方的版本號；深色模式、資料備份等設定之後加入。
 */
import { html, render } from "../../core/html.js";
import { APP_VERSION } from "../../core/version.js";

export function renderSettings(container) {
  render(
    container,
    html`
      <div class="placeholder">
        <div class="placeholder__badge">COMING SOON</div>
        <h2>設定</h2>
        <p>深色模式、資料備份等設定會放在這裡。</p>
      </div>
      <p class="app-version">版本 ${APP_VERSION}</p>
    `
  );
  return { eyebrow: "Settings", title: "設定" };
}
