/**
 * 清單項目預覽 Modal（唯讀）：點清單項目的內容區塊會開這個，
 * 不會直接進編輯——裡面按「✎ 編輯」才會開 checklistItemFormView.js。
 */
import { openChecklistItemForm } from "./checklistItemFormView.js";
import { linkifyHtml } from "../../core/linkify.js";
import { listHasPlaceField } from "../../data/models/ChecklistItem.js";

/**
 * 開啟清單項目預覽（唯讀）。點項目本身開這個，不是直接進編輯；
 * 要編輯的話在預覽裡按「✎ 編輯」。
 */
export function openChecklistItemDetailView({ tripId, listType, item, onEdited }) {
  const showPlace = listHasPlaceField(listType);

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal-sheet" role="dialog" aria-modal="true">
      <div class="modal-sheet__header">
        <h2>${escapeHtml(item.text)}</h2>
        <button class="modal-sheet__close" aria-label="關閉">&times;</button>
      </div>

      ${showPlace && item.place ? detailRow("📍 地點", escapeHtml(item.place.name)) : ""}
      ${item.notes ? detailRow("備註", linkifyHtml(item.notes)) : ""}
      ${!item.notes && !(showPlace && item.place) ? `<p class="settings-hint">還沒有其他內容，點「編輯」可以補上地點或備註。</p>` : ""}

      <div class="modal-actions">
        <button class="btn btn--ghost btn--block" data-action="close">關閉</button>
        <button class="btn btn--primary btn--block" data-action="edit">✎ 編輯</button>
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
    openChecklistItemForm({
      tripId,
      listType,
      existingItem: item,
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

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
