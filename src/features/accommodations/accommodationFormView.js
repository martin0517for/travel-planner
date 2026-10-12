/**
 * 新增/編輯住宿的表單 Modal。跟 flightFormView.js 幾乎一樣的結構，
 * 只是欄位換成入住/退房日期、確認碼，地點一樣透過 openPlacePicker 選。
 */
import { accommodationService } from "../../services/accommodationService.js";
import { placeService } from "../../services/placeService.js";
import { createAccommodationDraft } from "../../data/models/Accommodation.js";
import { openPlacePicker } from "../places/placePickerView.js";

export function openAccommodationForm({ tripId, existingAccommodation = null, onSaved }) {
  const draft = existingAccommodation ? { ...existingAccommodation } : createAccommodationDraft(tripId);
  const isEdit = !!existingAccommodation;
  let place = draft.placeId ? placeService.getPlace(draft.placeId) : null;

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal-sheet" role="dialog" aria-modal="true">
      <div class="modal-sheet__header">
        <h2>${isEdit ? "編輯住宿" : "新增住宿"}</h2>
        <button class="modal-sheet__close" aria-label="關閉">&times;</button>
      </div>

      <div class="field">
        <label>住宿地點</label>
        <button type="button" class="place-select-btn" data-action="pick-place">
          <span id="ac-place-label">${place ? escapeHtml(place.name) : "選擇飯店 / 住宿地點"}</span>
          <span>›</span>
        </button>
      </div>

      <div class="field-row">
        <div class="field">
          <label for="ac-checkin">入住日期</label>
          <input id="ac-checkin" type="date" value="${draft.checkIn || ""}" />
        </div>
        <div class="field">
          <label for="ac-checkout">退房日期</label>
          <input id="ac-checkout" type="date" value="${draft.checkOut || ""}" />
        </div>
      </div>

      <div class="field">
        <label for="ac-confirm">訂房確認碼</label>
        <input id="ac-confirm" type="text" value="${escapeAttr(draft.confirmationNo)}" />
      </div>

      <div class="field">
        <label for="ac-notes">備註</label>
        <textarea id="ac-notes" rows="2">${escapeHtml(draft.notes)}</textarea>
      </div>

      <div class="field" id="ac-errors" style="color: var(--color-coral); font-size: 0.85rem; display: none;"></div>
      <div class="modal-actions">
        <button class="btn btn--ghost btn--block" data-action="cancel">取消</button>
        <button class="btn btn--primary btn--block" data-action="save">${isEdit ? "儲存變更" : "新增住宿"}</button>
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
    openPlacePicker({
      defaultCategory: "hotel",
      onSelect: (selected) => {
        place = selected;
        backdrop.querySelector("#ac-place-label").textContent = selected.name;
      },
    });
  });

  backdrop.querySelector('[data-action="save"]').addEventListener("click", () => {
    const input = {
      ...draft,
      placeId: place ? place.id : null,
      checkIn: backdrop.querySelector("#ac-checkin").value,
      checkOut: backdrop.querySelector("#ac-checkout").value,
      confirmationNo: backdrop.querySelector("#ac-confirm").value.trim(),
      notes: backdrop.querySelector("#ac-notes").value.trim(),
    };

    const result = isEdit
      ? accommodationService.updateAccommodation(existingAccommodation.id, input)
      : accommodationService.createAccommodation(input);

    if (!result.ok) {
      const errBox = backdrop.querySelector("#ac-errors");
      errBox.style.display = "block";
      errBox.textContent = result.errors.join("、");
      return;
    }

    close();
    if (onSaved) onSaved(result.accommodation);
  });
}

function escapeAttr(str) {
  return String(str || "").replace(/"/g, "&quot;");
}
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
