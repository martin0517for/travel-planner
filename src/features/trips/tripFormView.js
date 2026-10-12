import { tripService } from "../../services/tripService.js";
import { createTripDraft } from "../../data/models/Trip.js";

/**
 * 開啟旅程表單 Modal。這是「Modal 表單」的範例寫法，其他表單
 * （航班、住宿、地點、行程項目、清單項目…）都是同一套模式：
 *   1. 用 document.createElement 生一個 .modal-backdrop，塞進 document.body
 *      （不是塞進目前頁面的 wrapper，因為 Modal 要蓋在最上面）
 *   2. existingXxx 有值 = 編輯模式（表單先帶入舊資料），沒有 = 新增模式
 *   3. 「儲存」按鈕點下去才呼叫 service 做驗證＋寫入，
 *      驗證沒過就把錯誤訊息顯示在畫面上，不關閉 Modal
 *   4. 成功後呼叫 close() 關掉自己，再呼叫外面傳進來的 onSaved()，
 *      讓開啟這個表單的畫面知道「存好了，可以重新整理你自己」
 *
 * existingTrip 為 null 表示新增；有值則為編輯。
 * onSaved(trip) 存檔成功後呼叫，讓外層重新渲染列表。
 */
export function openTripForm({ existingTrip = null, onSaved }) {
  const draft = existingTrip ? { ...existingTrip } : createTripDraft();
  const isEdit = !!existingTrip;

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal-sheet" role="dialog" aria-modal="true">
      <div class="modal-sheet__header">
        <h2>${isEdit ? "編輯旅程" : "新增旅程"}</h2>
        <button class="modal-sheet__close" aria-label="關閉">&times;</button>
      </div>
      <div class="field">
        <label for="f-name">旅程名稱</label>
        <input id="f-name" type="text" placeholder="例如：東京賞櫻" value="${escapeAttr(draft.name)}" />
      </div>
      <div class="field">
        <label for="f-destination">目的地</label>
        <input id="f-destination" type="text" placeholder="例如：日本・東京" value="${escapeAttr(draft.destination)}" />
      </div>
      <div class="field-row">
        <div class="field">
          <label for="f-start">出發日期</label>
          <input id="f-start" type="date" value="${draft.startDate || ""}" />
        </div>
        <div class="field">
          <label for="f-end">結束日期</label>
          <input id="f-end" type="date" value="${draft.endDate || ""}" />
        </div>
      </div>
      <div class="field" id="f-errors" style="color: var(--color-coral); font-size: 0.85rem; display: none;"></div>
      <div class="modal-actions">
        <button class="btn btn--ghost btn--block" data-action="cancel">取消</button>
        <button class="btn btn--primary btn--block" data-action="save">${isEdit ? "儲存變更" : "建立旅程"}</button>
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

  backdrop.querySelector('[data-action="save"]').addEventListener("click", () => {
    const input = {
      ...draft,
      name: backdrop.querySelector("#f-name").value.trim(),
      destination: backdrop.querySelector("#f-destination").value.trim(),
      startDate: backdrop.querySelector("#f-start").value,
      endDate: backdrop.querySelector("#f-end").value,
    };

    const result = isEdit
      ? tripService.updateTrip(existingTrip.id, input)
      : tripService.createTrip(input);

    if (!result.ok) {
      const errBox = backdrop.querySelector("#f-errors");
      errBox.style.display = "block";
      errBox.textContent = result.errors.join("、");
      return;
    }

    close();
    if (onSaved) onSaved(result.trip);
  });
}

function escapeAttr(str) {
  return String(str || "").replace(/"/g, "&quot;");
}
