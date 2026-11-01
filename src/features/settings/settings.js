/**
 * settings.js — 設定頁（v0.10.0，2026-11-01 使用者決定）。
 *
 * 三塊：
 *   外觀：跟隨系統／淺色／深色（分段切換，選了馬上套用，存在 data/settings.js）
 *   資料備份：上次備份時間、「匯出備份」「匯入備份」
 *     - 匯出：產生 JSON 檔，iPhone 跳出分享選單（存到「檔案」、iCloud、LINE、AirDrop…）；
 *       不支援分享的瀏覽器改成直接下載。成功後記下「上次備份」時間（取消分享不算）。
 *     - 匯入：選檔案 → 嚴格檢查（data/backup.js）→ 底部面板顯示內容與警告 →「取代全部」才寫入。
 *       檢查不過就整份拒絕，手機資料不動。
 *   關於：只有版本號（使用者決定）
 */
import { html, render } from "../../core/html.js";
import { icon } from "../../core/icons.js";
import { openSheet } from "../../core/sheet.js";
import { applyTheme } from "../../core/theme.js";
import { navigate } from "../../core/router.js";
import { APP_VERSION } from "../../core/version.js";
import { settingsStore, THEMES } from "../../data/settings.js";
import { buildBackup, backupFileName, parseBackup, restoreBackup, MAX_FILE_BYTES } from "../../data/backup.js";

export function renderSettings(container) {
  paint(container);
  return { eyebrow: "Settings", title: "設定" };
}

function paint(container) {
  const settings = settingsStore.get();
  render(
    container,
    html`
      <div class="set-sec">外觀</div>
      <div class="set-card">
        <div class="segmented" role="radiogroup" aria-label="外觀">
          ${THEMES.map(
            (t) => html`
              <button type="button" role="radio" class="segmented__item ${settings.theme === t.value ? "is-active" : ""}"
                      aria-checked="${settings.theme === t.value ? "true" : "false"}" data-theme-value="${t.value}">${t.label}</button>
            `
          )}
        </div>
      </div>

      <div class="set-sec">資料備份</div>
      <div class="set-card">
        <div class="set-row"><span>上次備份</span><span class="mono">${settings.lastBackupAt ? formatStamp(settings.lastBackupAt) : "還沒有備份過"}</span></div>
        <div class="set-btns">
          <button type="button" class="btn btn--primary" data-action="export">匯出備份</button>
          <button type="button" class="btn btn--ghost" data-action="import">匯入備份</button>
        </div>
        <p class="set-note">匯出會跳出分享選單，可以存到「檔案」、iCloud 或傳給自己。換手機或資料不見時，用「匯入備份」還原。</p>
        <input type="file" accept=".json,application/json" data-file hidden />
      </div>

      <div class="set-sec">關於</div>
      <div class="set-card">
        <div class="set-row"><span>版本</span><span class="mono">${APP_VERSION}</span></div>
      </div>
    `
  );

  container.querySelectorAll("[data-theme-value]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const theme = btn.dataset.themeValue;
      if (!settingsStore.set({ theme })) return window.alert("儲存失敗：手機本機空間不足，或瀏覽器不允許儲存");
      applyTheme(theme);
      paint(container);
    })
  );
  container.querySelector('[data-action="export"]').addEventListener("click", async () => {
    await exportBackup();
    paint(container);
  });

  const fileInput = container.querySelector("[data-file]");
  container.querySelector('[data-action="import"]').addEventListener("click", () => {
    fileInput.value = ""; // 同一個檔案再選一次也會觸發
    fileInput.click();
  });
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) return window.alert("無法匯入：檔案太大（上限 5 MB）");
    let text;
    try {
      text = await file.text();
    } catch {
      return window.alert("無法匯入：讀不到這個檔案");
    }
    const parsed = parseBackup(text);
    if (!parsed.ok) return window.alert(`無法匯入，手機上的資料沒有變動。\n\n${parsed.errors.join("\n")}`);
    openImportConfirm(parsed, () => paint(container));
  });
}

/** 匯出：分享選單（iPhone）或下載；成功時記下上次備份時間。回傳 true＝完成 */
async function exportBackup() {
  const name = backupFileName();
  const json = JSON.stringify(buildBackup(), null, 2);
  const file = new File([json], name, { type: "application/json" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      settingsStore.set({ lastBackupAt: new Date().toISOString() });
      return true;
    } catch (e) {
      if (e && e.name === "AbortError") return false; // 使用者取消分享
      // 其他錯誤（例如不允許分享）→ 改用下載
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  settingsStore.set({ lastBackupAt: new Date().toISOString() });
  return true;
}

/** 匯入前確認（底部面板）：顯示備份時間、內容數量、警告 */
function openImportConfirm(parsed, onDone) {
  const when = parsed.exportedAt && !Number.isNaN(Date.parse(parsed.exportedAt)) ? formatStamp(parsed.exportedAt) : "不明";
  openSheet({
    title: "匯入備份",
    body: html`
      <div class="set-row"><span>備份時間</span><span class="mono">${when}${parsed.version ? `・版本 ${parsed.version}` : ""}</span></div>
      <ul class="imp-list">
        ${parsed.summary.map((s) => html`<li>${s.count} ${s.label}</li>`)}
      </ul>
      <div class="imp-warn">${icon("warning")}<span>手機上<b>目前的資料會全部被取代</b>，無法復原。建議先匯出一份目前的資料。</span></div>
      <button type="button" class="btn btn--ghost btn--block" data-action="export-first">先匯出目前的資料</button>
      <div class="form__actions form__actions--spaced">
        <button type="button" class="btn btn--ghost" data-action="cancel">取消</button>
        <button type="button" class="btn btn--danger" data-action="replace">取代全部</button>
      </div>
    `,
    onMount(panel, close) {
      panel.querySelector('[data-action="cancel"]').addEventListener("click", close);
      panel.querySelector('[data-action="export-first"]').addEventListener("click", async () => {
        if (await exportBackup()) panel.querySelector('[data-action="export-first"]').textContent = "已匯出目前的資料";
      });
      panel.querySelector('[data-action="replace"]').addEventListener("click", () => {
        const result = restoreBackup(parsed.data);
        if (!result.ok) return window.alert(result.errors.join("\n"));
        applyTheme(settingsStore.get().theme);
        close();
        window.alert("匯入完成");
        onDone();
        navigate("/trips");
      });
    },
  });
}

/** ISO → 本地時間「2026-11-01 21:40」 */
function formatStamp(iso) {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
