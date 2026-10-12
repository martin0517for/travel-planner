import { openAccommodationForm } from "./accommodationFormView.js";

/**
 * 開啟住宿詳情檢視（唯讀）。
 * accommodation：要顯示的住宿物件（需帶 place，來自 accommodationService.listByTrip）。
 * onEdited()：使用者從這裡點「編輯」並存檔後呼叫，方便外層重新整理畫面。
 */
export function openAccommodationDetailView({ tripId, accommodation, onEdited }) {
  const placeName = accommodation.place ? accommodation.place.name : "地點已刪除";

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal-sheet" role="dialog" aria-modal="true">
      <div class="modal-sheet__header">
        <h2>${escapeHtml(placeName)}</h2>
        <button class="modal-sheet__close" aria-label="關閉">&times;</button>
      </div>

      <span class="stub-page__badge" style="margin-bottom: var(--space-4);">🛏 住宿</span>

      ${detailRow("入住", accommodation.checkIn || "—")}
      ${detailRow("退房", accommodation.checkOut || "—")}
      ${accommodation.confirmationNo ? detailRow("確認碼", escapeHtml(accommodation.confirmationNo)) : ""}
      ${
        accommodation.place && accommodation.place.address
          ? detailRow("地址", escapeHtml(accommodation.place.address))
          : ""
      }
      ${
        accommodation.place && accommodation.place.googleMapsUrl
          ? detailRow("Google Maps", `<a href="${escapeAttr(accommodation.place.googleMapsUrl)}" target="_blank" rel="noopener noreferrer">開啟導航 →</a>`)
          : ""
      }
      ${accommodation.notes ? detailRow("備註", escapeHtml(accommodation.notes)) : ""}

      <div class="modal-actions">
        <button class="btn btn--ghost btn--block" data-action="close">關閉</button>
        <button class="btn btn--primary btn--block" data-action="edit">✎ 編輯住宿</button>
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
    openAccommodationForm({
      tripId,
      existingAccommodation: accommodation,
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

function escapeAttr(str) {
  return String(str || "").replace(/"/g, "&quot;");
}
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
