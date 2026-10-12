/**
 * 地點詳情檢視 Modal（唯讀）：顯示地址/網站/Google Maps/經緯度/備註，
 * 裡面有「✎ 編輯地點資料」按鈕才會真的進到可編輯的表單（placeFormView.js）。
 * 這個「先看唯讀詳情，要編輯再點進去」的模式，行程項目/航班/住宿/清單項目都在用。
 */
import { openPlaceForm } from "./placeFormView.js";
import { PLACE_CATEGORIES } from "../../data/models/Place.js";
import { linkifyHtml } from "../../core/linkify.js";

/**
 * 開啟地點詳情檢視（唯讀）。
 * place：要顯示的地點物件。
 * onEdited(updatedPlace)：使用者從這裡點「編輯地點資料」並存檔後呼叫，方便外層重新整理畫面。
 */
export function openPlaceDetailView({ place, onEdited }) {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal-sheet" role="dialog" aria-modal="true">
      <div class="modal-sheet__header">
        <h2>${escapeHtml(place.name)}</h2>
        <button class="modal-sheet__close" aria-label="關閉">&times;</button>
      </div>

      <div class="detail-badges">
        <span class="detail-badge" style="border-color: ${categoryColor(place.category)}; color: ${categoryColor(place.category)};">${categoryLabel(place.category)}</span>
        ${(place.tags || []).map((t) => `<span class="detail-badge detail-badge--tag">${escapeHtml(t)}</span>`).join("")}
      </div>

      ${detailRow("📍 地址", place.address ? escapeHtml(place.address) : "")}
      ${
        place.website
          ? detailRow("🔗 網站", `<a href="${escapeAttr(normalizeUrl(place.website))}" target="_blank" rel="noopener noreferrer">${escapeHtml(place.website)}</a>`)
          : ""
      }
      ${
        place.googleMapsUrl
          ? detailRow("🗺 Google Maps", `<a href="${escapeAttr(place.googleMapsUrl)}" target="_blank" rel="noopener noreferrer">開啟導航 →</a>`)
          : ""
      }
      ${place.lat != null && place.lng != null ? detailRow("經緯度", `${place.lat}, ${place.lng}`) : ""}
      ${place.notes ? detailRow("備註", linkifyHtml(place.notes)) : ""}

      <div class="modal-actions">
        <button class="btn btn--ghost btn--block" data-action="close">關閉</button>
        <button class="btn btn--primary btn--block" data-action="edit-place">✎ 編輯地點資料</button>
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

  backdrop.querySelector('[data-action="edit-place"]').addEventListener("click", () => {
    close();
    openPlaceForm({
      existingPlace: place,
      onSaved: (updated) => {
        if (onEdited) onEdited(updated);
      },
    });
  });
}

function detailRow(label, value) {
  if (!value) return "";
  return `
    <div class="detail-row">
      <div class="detail-row__label">${label}</div>
      <div class="detail-row__value">${value}</div>
    </div>
  `;
}

function categoryLabel(value) {
  return PLACE_CATEGORIES.find((c) => c.value === value)?.label || value;
}

function categoryColor(value) {
  return PLACE_CATEGORIES.find((c) => c.value === value)?.color || "#787774";
}

function normalizeUrl(url) {
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

function escapeAttr(str) {
  return String(str || "").replace(/"/g, "&quot;");
}
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
