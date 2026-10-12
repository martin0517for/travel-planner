/**
 * 地點選擇器 Modal：搜尋地點庫裡的地點，或直接新增一個並自動選定。
 * 這是共用元件——新增航班（選機場）、新增住宿（選飯店）、
 * 新增行程項目、新增清單項目，都是呼叫這裡的 openPlacePicker() 開啟。
 */
import { placeService } from "../../services/placeService.js";
import { openPlaceForm } from "./placeFormView.js";
import { PLACE_CATEGORIES } from "../../data/models/Place.js";

/**
 * 開啟地點選擇器。
 * 一律顯示地點庫中所有地點（不依情境過濾類別）——因為同一個地方在不同旅程可能有不同用途
 * （例如機場也可能被排進行程當作「交通」項目），交給使用者自己判斷比自動過濾更準確。
 * defaultCategory：使用者在這裡「新增地點」時，表單預設帶入的類別（僅影響新增，不影響搜尋結果）。
 * onSelect(place)：使用者選定地點後呼叫（新增地點後也會自動選定）。
 */
export function openPlacePicker({ defaultCategory = "attraction", onSelect }) {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal-sheet" role="dialog" aria-modal="true">
      <div class="modal-sheet__header">
        <h2>選擇地點</h2>
        <button class="modal-sheet__close" aria-label="關閉">&times;</button>
      </div>
      <div class="field">
        <input id="pp-search" type="text" placeholder="搜尋地點名稱或地址…" />
      </div>
      <div id="pp-results"></div>
      <div class="modal-actions">
        <button class="btn btn--gold btn--block" data-action="new">＋ 新增地點</button>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);

  function close() {
    backdrop.remove();
  }

  function paint() {
    const query = backdrop.querySelector("#pp-search").value;
    const places = placeService.listPlaces({ query });
    const resultsEl = backdrop.querySelector("#pp-results");

    if (places.length === 0) {
      resultsEl.innerHTML = `<p style="color: var(--color-ink-soft); font-size: 0.85rem;">找不到符合的地點，可以直接新增一個。</p>`;
      return;
    }

    resultsEl.innerHTML = places
      .map(
        (p) => `
      <button class="picker-item" data-id="${p.id}">
        <span class="picker-item__name">${escapeHtml(p.name)}</span>
        <span class="picker-item__meta">${categoryLabel(p.category)}${p.address ? " · " + escapeHtml(p.address) : ""}${(p.tags && p.tags.length) ? " · " + p.tags.map(escapeHtml).join("、") : ""}</span>
      </button>
    `
      )
      .join("");

    resultsEl.querySelectorAll(".picker-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        const place = placeService.getPlace(btn.dataset.id);
        close();
        if (onSelect) onSelect(place);
      });
    });
  }

  backdrop.querySelector("#pp-search").addEventListener("input", paint);
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });
  backdrop.querySelector(".modal-sheet__close").addEventListener("click", close);
  backdrop.querySelector('[data-action="new"]').addEventListener("click", () => {
    openPlaceForm({
      defaultCategory,
      onSaved: (place) => {
        close();
        if (onSelect) onSelect(place);
      },
    });
  });

  paint();
}

function categoryLabel(value) {
  return PLACE_CATEGORIES.find((c) => c.value === value)?.label || value;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
