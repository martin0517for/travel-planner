/**
 * 新增/編輯「單一天行程項目」的表單 Modal。除了選地點、填時間備註，
 * 還多一個「✎ 編輯地點資料」捷徑（選好地點後才會出現），
 * 讓使用者不用跳去地點資料庫，就能直接補齊那個地點的完整資料。
 */
import { dayPlanService } from "../../services/dayPlanService.js";
import { placeService } from "../../services/placeService.js";
import { createItemDraft, ITEM_CATEGORIES } from "../../data/models/DayPlan.js";
import { openPlacePicker } from "../places/placePickerView.js";
import { openPlaceForm } from "../places/placeFormView.js";

export function openItineraryItemForm({ tripId, date, existingItem = null, onSaved }) {
  const draft = existingItem ? { ...existingItem } : createItemDraft();
  const isEdit = !!existingItem;
  let place = draft.placeId ? placeService.getPlace(draft.placeId) : null;

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal-sheet" role="dialog" aria-modal="true">
      <div class="modal-sheet__header">
        <h2>${isEdit ? "編輯行程項目" : "新增行程項目"}</h2>
        <button class="modal-sheet__close" aria-label="關閉">&times;</button>
      </div>

      <div class="field">
        <label>地點</label>
        <button type="button" class="place-select-btn" data-action="pick-place">
          <span id="it-place-label">${place ? escapeHtml(place.name) : "選擇景點 / 餐廳 / 地點"}</span>
          <span>›</span>
        </button>
        <button type="button" id="it-edit-place-link" class="edit-place-link" data-action="edit-place" style="display: ${place ? "inline-flex" : "none"};">✎ 編輯地點資料（地址／電話／網站／備註等）</button>
      </div>

      <div class="field-row">
        <div class="field">
          <label for="it-category">類別</label>
          <select id="it-category">
            ${ITEM_CATEGORIES.map(
              (c) => `<option value="${c.value}" ${draft.category === c.value ? "selected" : ""}>${c.icon} ${c.label}</option>`
            ).join("")}
          </select>
        </div>
        <div class="field">
          <label for="it-time">時間</label>
          <input id="it-time" type="time" value="${draft.time || ""}" />
        </div>
      </div>

      <div class="field">
        <label for="it-notes">備註</label>
        <textarea id="it-notes" rows="2">${escapeHtml(draft.notes)}</textarea>
      </div>

      <div class="field" id="it-errors" style="color: var(--color-coral); font-size: 0.85rem; display: none;"></div>
      <div class="modal-actions">
        <button class="btn btn--ghost btn--block" data-action="cancel">取消</button>
        <button class="btn btn--primary btn--block" data-action="save">${isEdit ? "儲存變更" : "新增項目"}</button>
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

  backdrop.querySelector('[data-action="pick-place"]').addEventListener("click", () => {
    const categoryHint = backdrop.querySelector("#it-category").value;
    openPlacePicker({
      defaultCategory: categoryHint === "other" ? "attraction" : categoryHint,
      onSelect: (selected) => {
        place = selected;
        backdrop.querySelector("#it-place-label").textContent = selected.name;
        backdrop.querySelector("#it-edit-place-link").style.display = "inline-flex";
      },
    });
  });

  backdrop.querySelector('[data-action="edit-place"]').addEventListener("click", () => {
    if (!place) return;
    openPlaceForm({
      existingPlace: place,
      onSaved: (updated) => {
        place = updated;
        backdrop.querySelector("#it-place-label").textContent = updated.name;
      },
    });
  });

  backdrop.querySelector('[data-action="save"]').addEventListener("click", () => {
    const input = {
      placeId: place ? place.id : null,
      category: backdrop.querySelector("#it-category").value,
      time: backdrop.querySelector("#it-time").value,
      notes: backdrop.querySelector("#it-notes").value.trim(),
    };

    const result = isEdit
      ? dayPlanService.updateItem(tripId, date, existingItem.id, input)
      : dayPlanService.addItem(tripId, date, input);

    if (!result.ok) {
      const errBox = backdrop.querySelector("#it-errors");
      errBox.style.display = "block";
      errBox.textContent = result.errors.join("、");
      return;
    }

    close();
    if (onSaved) onSaved();
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
