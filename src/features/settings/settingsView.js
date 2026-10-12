/**
 * 設定頁（#/settings）：外觀（深色模式）、語言、預設貨幣、
 * 資料備份（匯出/匯入全部 App 資料）、PWA 安裝。
 */
import { settingsService } from "../../services/settingsService.js";
import { CURRENCY_OPTIONS } from "../../data/models/Settings.js";
import { APP_STORAGE_KEYS } from "../../core/dataKeys.js";

export function renderSettingsView(container) {
  const wrapper = document.createElement("div");
  container.appendChild(wrapper);
  paint(wrapper);
}

function paint(wrapper) {
  const settings = settingsService.getSettings();

  wrapper.innerHTML = `
    <h2 style="margin-top: var(--space-2);">設定</h2>

    <div class="settings-section">
      <h3 class="settings-section__title">外觀</h3>
      <div class="segmented" id="theme-segmented">
        ${themeOptionHtml("light", "☀ 淺色", settings.theme)}
        ${themeOptionHtml("dark", "☾ 深色", settings.theme)}
        ${themeOptionHtml("system", "⚙ 跟隨系統", settings.theme)}
      </div>
    </div>

    <div class="perforation"></div>

    <div class="settings-section">
      <h3 class="settings-section__title">語言</h3>
      <div class="field">
        <select id="language-select" disabled>
          <option value="zh-Hant" selected>繁體中文</option>
        </select>
        <div class="settings-hint">目前僅支援繁體中文，未來會開放更多語言。</div>
      </div>
    </div>

    <div class="perforation"></div>

    <div class="settings-section">
      <h3 class="settings-section__title">預設貨幣</h3>
      <div class="field">
        <select id="currency-select">
          ${CURRENCY_OPTIONS.map(
            (c) => `<option value="${c.value}" ${settings.currency === c.value ? "selected" : ""}>${c.label}</option>`
          ).join("")}
        </select>
        <div class="settings-hint">之後旅遊工具裡的匯率換算會用這個當預設幣別。</div>
      </div>
    </div>

    <div class="perforation"></div>

    <div class="settings-section">
      <h3 class="settings-section__title">資料備份</h3>
      <p class="settings-hint">所有資料都存在這台裝置的瀏覽器裡，清除瀏覽器資料就會不見。建議定期匯出備份，或換裝置前先匯出、再到新裝置匯入。</p>
      <div class="modal-actions" style="margin-top: var(--space-3);">
        <button class="btn btn--ghost btn--block" id="export-btn">⬇ 匯出資料</button>
        <button class="btn btn--ghost btn--block" id="import-btn">⬆ 匯入資料</button>
      </div>
      <input type="file" id="import-file-input" accept="application/json" style="display:none;" />
    </div>

    <div class="perforation"></div>

    <div class="settings-section">
      <h3 class="settings-section__title">安裝為 App</h3>
      <p class="settings-hint" id="install-hint">
        ${
          window.__deferredInstallPrompt
            ? "這台裝置可以直接安裝，點下面的按鈕即可加到主畫面／桌面。"
            : "iOS：Safari 分享選單 → 加入主畫面。Android／桌面 Chrome：網址列或選單裡的「安裝應用程式」。"
        }
      </p>
      ${window.__deferredInstallPrompt ? `<button class="btn btn--gold btn--block" id="install-btn">📲 安裝 App</button>` : ""}
    </div>
  `;

  wrapper.querySelectorAll("#theme-segmented [data-theme-value]").forEach((btn) => {
    btn.addEventListener("click", () => {
      settingsService.updateSettings({ theme: btn.dataset.themeValue });
      paint(wrapper);
    });
  });

  wrapper.querySelector("#currency-select").addEventListener("change", (e) => {
    settingsService.updateSettings({ currency: e.target.value });
  });

  wrapper.querySelector("#export-btn").addEventListener("click", exportData);

  wrapper.querySelector("#import-btn").addEventListener("click", () => {
    wrapper.querySelector("#import-file-input").click();
  });

  wrapper.querySelector("#import-file-input").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) importData(file, wrapper);
  });

  const installBtn = wrapper.querySelector("#install-btn");
  if (installBtn) {
    installBtn.addEventListener("click", async () => {
      const promptEvent = window.__deferredInstallPrompt;
      if (!promptEvent) return;
      promptEvent.prompt();
      await promptEvent.userChoice;
      window.__deferredInstallPrompt = null;
      paint(wrapper);
    });
  }
}

function themeOptionHtml(value, label, current) {
  return `<button class="segmented__item ${current === value ? "is-active" : ""}" data-theme-value="${value}">${label}</button>`;
}

function exportData() {
  const data = {};
  APP_STORAGE_KEYS.forEach((key) => {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      try {
        data[key] = JSON.parse(raw);
      } catch {
        /* 忽略壞掉的資料，不放進匯出檔 */
      }
    }
  });

  const payload = { exportedAt: new Date().toISOString(), app: "travel-planner", data };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `travel-planner-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importData(file, wrapper) {
  const reader = new FileReader();
  reader.onload = () => {
    let parsed;
    try {
      parsed = JSON.parse(reader.result);
    } catch {
      alert("這個檔案看起來不是有效的備份檔（JSON 格式錯誤）。");
      return;
    }
    if (!parsed || typeof parsed.data !== "object") {
      alert("這個檔案看起來不是這個 App 匯出的備份檔。");
      return;
    }
    if (!confirm("匯入會覆蓋目前這台裝置上的所有旅程、地點、航班、住宿、行程資料，確定要繼續嗎？")) {
      return;
    }
    APP_STORAGE_KEYS.forEach((key) => {
      if (key in parsed.data) {
        localStorage.setItem(key, JSON.stringify(parsed.data[key]));
      }
    });
    alert("匯入完成，頁面即將重新整理。");
    window.location.reload();
  };
  reader.readAsText(file);
}
