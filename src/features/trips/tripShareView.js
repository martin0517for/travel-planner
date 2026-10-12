/**
 * 分享旅程 Modal。這個 App 沒有伺服器，所以「分享」= 匯出一個 JSON 檔案，
 * 對方用同一個 App 匯入（見 tripListView.js 的 importSharedTrip 函式），
 * 實際的資料打包/還原邏輯在 services/tripShareService.js。
 */
import { tripShareService } from "../../services/tripShareService.js";

export function openTripShareForm({ tripId, tripName }) {
  const canSystemShare = typeof navigator.share === "function";

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal-sheet" role="dialog" aria-modal="true">
      <div class="modal-sheet__header">
        <h2>分享旅程</h2>
        <button class="modal-sheet__close" aria-label="關閉">&times;</button>
      </div>

      <p class="settings-hint">
        這個 App 沒有伺服器，資料都存在裝置裡，所以「分享」是匯出一個檔案，
        對方用同一個 Travel Planner App 匯入，就會在他的裝置上建立一趟一樣的旅程（各自獨立，之後互不影響）。
      </p>

      <div class="field" style="margin-top: var(--space-4);">
        <label class="form-checkbox-row">
          <input type="checkbox" id="share-include-checklists" />
          <span class="form-checkbox-row__body">
            <span class="form-checkbox-row__title">包含清單內容</span>
            <span class="form-checkbox-row__hint">行李清單／記事本／必買清單，預設不分享</span>
          </span>
        </label>
      </div>

      <div class="field" id="share-errors" style="color: var(--color-coral); font-size: 0.85rem; display: none;"></div>

      <div class="modal-actions">
        <button class="btn btn--ghost btn--block" data-action="cancel">取消</button>
        ${canSystemShare ? `<button class="btn btn--gold btn--block" data-action="system-share">分享…</button>` : ""}
        <button class="btn btn--primary btn--block" data-action="download">⬇ 下載分享檔</button>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);

  function close() {
    backdrop.remove();
  }

  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });
  backdrop.querySelector(".modal-sheet__close").addEventListener("click", close);
  backdrop.querySelector('[data-action="cancel"]').addEventListener("click", close);

  function buildFile() {
    const includeChecklists = backdrop.querySelector("#share-include-checklists").checked;
    const payload = tripShareService.buildSharePayload(tripId, { includeChecklists });
    if (!payload) return null;
    const filename = `${sanitizeFilename(tripName || "旅程")}-分享.json`;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    return new File([blob], filename, { type: "application/json" });
  }

  backdrop.querySelector('[data-action="download"]').addEventListener("click", () => {
    const file = buildFile();
    if (!file) return;
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    close();
  });

  const systemShareBtn = backdrop.querySelector('[data-action="system-share"]');
  if (systemShareBtn) {
    systemShareBtn.addEventListener("click", async () => {
      const file = buildFile();
      if (!file) return;
      try {
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: `${tripName || "旅程"}分享檔` });
        } else {
          // 有些瀏覽器 navigator.share 存在但不支援分享檔案，退回分享純文字說明
          await navigator.share({ title: `${tripName || "旅程"}`, text: "這是我用 Travel Planner 規劃的旅程，檔案請用下載的方式取得。" });
        }
        close();
      } catch (err) {
        // 使用者取消分享時也會丟這個錯誤，安靜略過即可
      }
    });
  }
}

function sanitizeFilename(name) {
  return String(name).replace(/[\\/:*?"<>|]/g, "").trim() || "旅程";
}
