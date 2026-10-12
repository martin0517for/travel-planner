/**
 * 地點資料庫管理頁（#/places）：瀏覽/新增/編輯/刪除所有地點，
 * 可依固定類別、自訂分類篩選。跟 tripListView.js 是同一種「列表頁」模式。
 */
import { placeService } from "../../services/placeService.js";
import { openPlaceForm } from "./placeFormView.js";
import { PLACE_CATEGORIES } from "../../data/models/Place.js";

export function renderPlaceListView(container) {
  const wrapper = document.createElement("div");
  container.appendChild(wrapper);
  paint(wrapper, null, null);
}

function paint(wrapper, activeCategory, activeTag) {
  const places = placeService.listPlaces({ category: activeCategory, tag: activeTag });
  const allTags = placeService.listAllTags();

  wrapper.innerHTML = `
    <a href="#/trips" class="back-link">← 返回我的旅程</a>
    <h2 style="margin-top: var(--space-3);">地點資料庫</h2>
    <p style="color: var(--color-ink-soft); font-size: 0.85rem;">所有飯店、景點、餐廳、車站共用同一份地點資料，新增行程、住宿、航班時可直接選用。</p>

    ${
      allTags.length > 0
        ? `<div class="chip-row">
            <button class="chip chip--tag ${activeTag === null ? "is-active" : ""}" data-tag="">全部分類</button>
            ${allTags
              .map((t) => `<button class="chip chip--tag ${activeTag === t ? "is-active" : ""}" data-tag="${escapeAttr(t)}">${escapeHtml(t)}</button>`)
              .join("")}
          </div>`
        : ""
    }

    <div class="chip-row">
      <button class="chip ${activeCategory === null ? "is-active" : ""}" data-cat="">全部類別</button>
      ${PLACE_CATEGORIES.map(
        (c) => `<button class="chip ${activeCategory === c.value ? "is-active" : ""}" data-cat="${c.value}">${c.label}</button>`
      ).join("")}
    </div>

    <div class="perforation"></div>
    ${
      places.length === 0
        ? `<div class="empty-state"><h2>還沒有地點</h2><p>新增地點後，之後規劃行程、住宿、航班時就能直接選用。</p></div>`
        : `<div class="place-list">${places.map(placeCardHtml).join("")}</div>`
    }
    <button class="btn btn--gold btn--fab" data-action="add" aria-label="新增地點">＋</button>
  `;

  wrapper.querySelectorAll("[data-cat]").forEach((chip) => {
    chip.addEventListener("click", () => {
      paint(wrapper, chip.dataset.cat || null, activeTag);
    });
  });

  wrapper.querySelectorAll("[data-tag]").forEach((chip) => {
    chip.addEventListener("click", () => {
      paint(wrapper, activeCategory, chip.dataset.tag || null);
    });
  });

  wrapper.querySelector('[data-action="add"]').addEventListener("click", () => {
    openPlaceForm({ onSaved: () => paint(wrapper, activeCategory, activeTag) });
  });

  wrapper.querySelectorAll("[data-action='edit']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const place = placeService.getPlace(btn.dataset.id);
      openPlaceForm({ existingPlace: place, onSaved: () => paint(wrapper, activeCategory, activeTag) });
    });
  });

  wrapper.querySelectorAll("[data-action='delete']").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (confirm("確定要刪除這個地點嗎？已被行程/住宿/航班引用的地點刪除後會顯示「地點已刪除」。")) {
        placeService.deletePlace(btn.dataset.id);
        paint(wrapper, activeCategory, activeTag);
      }
    });
  });
}

function placeCardHtml(place) {
  const label = PLACE_CATEGORIES.find((c) => c.value === place.category)?.label || place.category;
  const tags = place.tags || [];
  return `
    <div class="place-card">
      <div class="place-card__main">
        <div class="place-card__name">${escapeHtml(place.name)}</div>
        <div class="place-card__meta">${label}${place.address ? " · " + escapeHtml(place.address) : ""}</div>
        ${tags.length > 0 ? `<div class="place-card__tags">${tags.map((t) => `<span class="place-card__tag">${escapeHtml(t)}</span>`).join("")}</div>` : ""}
      </div>
      <div class="place-card__actions">
        <button class="trip-card__icon-btn" data-action="edit" data-id="${place.id}" aria-label="編輯">✎</button>
        <button class="trip-card__icon-btn" data-action="delete" data-id="${place.id}" aria-label="刪除">🗑</button>
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
function escapeAttr(str) {
  return String(str || "").replace(/"/g, "&quot;");
}
