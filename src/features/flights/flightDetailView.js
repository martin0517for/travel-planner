import { openFlightForm } from "./flightFormView.js";

/**
 * 開啟航班詳情檢視（唯讀）。
 * flight：要顯示的航班物件（需帶 departurePlace / arrivalPlace，來自 flightService.listByTrip）。
 * onEdited()：使用者從這裡點「編輯」並存檔後呼叫，方便外層重新整理畫面。
 */
export function openFlightDetailView({ tripId, flight, onEdited }) {
  const dep = flight.departurePlace ? flight.departurePlace.name : "未指定地點";
  const arr = flight.arrivalPlace ? flight.arrivalPlace.name : "未指定地點";

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal-sheet" role="dialog" aria-modal="true">
      <div class="modal-sheet__header">
        <h2>${escapeHtml(flight.airline)} ${escapeHtml(flight.flightNo)}</h2>
        <button class="modal-sheet__close" aria-label="關閉">&times;</button>
      </div>

      <span class="stub-page__badge" style="margin-bottom: var(--space-4);">✈ 航班</span>

      ${detailRow("出發", `${escapeHtml(dep)}<br>${formatDT(flight.departureTime)}`)}
      ${detailRow("抵達", `${escapeHtml(arr)}<br>${formatDT(flight.arrivalTime)}`)}
      ${flight.notes ? detailRow("備註", escapeHtml(flight.notes)) : ""}

      <div class="modal-actions">
        <button class="btn btn--ghost btn--block" data-action="close">關閉</button>
        <button class="btn btn--primary btn--block" data-action="edit">✎ 編輯航班</button>
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
  backdrop.querySelector('[data-action="close"]').addEventListener("click", close);

  backdrop.querySelector('[data-action="edit"]').addEventListener("click", () => {
    close();
    openFlightForm({
      tripId,
      existingFlight: flight,
      onSaved: () => {
        if (onEdited) onEdited();
      },
    });
  });
}

function detailRow(label, value) {
  return `
    <div class="detail-row">
      <div class="detail-row__label">${label}</div>
      <div class="detail-row__value">${value}</div>
    </div>
  `;
}

function formatDT(value) {
  if (!value) return "—";
  return value.replace("T", " ");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
