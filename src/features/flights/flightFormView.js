/**
 * 新增/編輯航班的表單 Modal。出發地點跟抵達地點都是透過
 * openPlacePicker() 開啟地點選擇器來選，不是自己打字輸入，
 * 這樣才能确保存的是同一份 Place 資料的 id，而不是打錯字的機場名稱。
 */
import { flightService } from "../../services/flightService.js";
import { placeService } from "../../services/placeService.js";
import { createFlightDraft } from "../../data/models/Flight.js";
import { openPlacePicker } from "../places/placePickerView.js";

export function openFlightForm({ tripId, existingFlight = null, onSaved }) {
  const draft = existingFlight ? { ...existingFlight } : createFlightDraft(tripId);
  const isEdit = !!existingFlight;
  let departurePlace = draft.departurePlaceId ? placeService.getPlace(draft.departurePlaceId) : null;
  let arrivalPlace = draft.arrivalPlaceId ? placeService.getPlace(draft.arrivalPlaceId) : null;

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal-sheet" role="dialog" aria-modal="true">
      <div class="modal-sheet__header">
        <h2>${isEdit ? "編輯航班" : "新增航班"}</h2>
        <button class="modal-sheet__close" aria-label="關閉">&times;</button>
      </div>
      <div class="field-row">
        <div class="field">
          <label for="fl-airline">航空公司</label>
          <input id="fl-airline" type="text" placeholder="例如：長榮航空" value="${escapeAttr(draft.airline)}" />
        </div>
        <div class="field">
          <label for="fl-no">航班編號</label>
          <input id="fl-no" type="text" placeholder="例如：BR198" value="${escapeAttr(draft.flightNo)}" />
        </div>
      </div>

      <div class="field">
        <label>出發地點</label>
        <button type="button" class="place-select-btn" data-action="pick-departure">
          <span id="fl-departure-label">${departurePlace ? escapeHtml(departurePlace.name) : "選擇機場 / 地點"}</span>
          <span>›</span>
        </button>
      </div>
      <div class="field">
        <label for="fl-dep-time">出發時間</label>
        <input id="fl-dep-time" type="datetime-local" value="${draft.departureTime || ""}" />
      </div>

      <div class="perforation" style="margin: var(--space-4) 0;"></div>

      <div class="field">
        <label>抵達地點</label>
        <button type="button" class="place-select-btn" data-action="pick-arrival">
          <span id="fl-arrival-label">${arrivalPlace ? escapeHtml(arrivalPlace.name) : "選擇機場 / 地點"}</span>
          <span>›</span>
        </button>
      </div>
      <div class="field">
        <label for="fl-arr-time">抵達時間</label>
        <input id="fl-arr-time" type="datetime-local" value="${draft.arrivalTime || ""}" />
      </div>

      <div class="field">
        <label for="fl-notes">備註</label>
        <textarea id="fl-notes" rows="2">${escapeHtml(draft.notes)}</textarea>
      </div>

      <div class="field" id="fl-errors" style="color: var(--color-coral); font-size: 0.85rem; display: none;"></div>
      <div class="modal-actions">
        <button class="btn btn--ghost btn--block" data-action="cancel">取消</button>
        <button class="btn btn--primary btn--block" data-action="save">${isEdit ? "儲存變更" : "新增航班"}</button>
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

  backdrop.querySelector('[data-action="pick-departure"]').addEventListener("click", () => {
    openPlacePicker({
      defaultCategory: "airport",
      onSelect: (place) => {
        departurePlace = place;
        backdrop.querySelector("#fl-departure-label").textContent = place.name;
      },
    });
  });

  backdrop.querySelector('[data-action="pick-arrival"]').addEventListener("click", () => {
    openPlacePicker({
      defaultCategory: "airport",
      onSelect: (place) => {
        arrivalPlace = place;
        backdrop.querySelector("#fl-arrival-label").textContent = place.name;
      },
    });
  });

  backdrop.querySelector('[data-action="save"]').addEventListener("click", () => {
    const input = {
      ...draft,
      airline: backdrop.querySelector("#fl-airline").value.trim(),
      flightNo: backdrop.querySelector("#fl-no").value.trim(),
      departurePlaceId: departurePlace ? departurePlace.id : null,
      departureTime: backdrop.querySelector("#fl-dep-time").value,
      arrivalPlaceId: arrivalPlace ? arrivalPlace.id : null,
      arrivalTime: backdrop.querySelector("#fl-arr-time").value,
      notes: backdrop.querySelector("#fl-notes").value.trim(),
    };

    const result = isEdit
      ? flightService.updateFlight(existingFlight.id, input)
      : flightService.createFlight(input);

    if (!result.ok) {
      const errBox = backdrop.querySelector("#fl-errors");
      errBox.style.display = "block";
      errBox.textContent = result.errors.join("、");
      return;
    }

    close();
    if (onSaved) onSaved(result.flight);
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
