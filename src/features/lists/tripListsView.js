/**
 * 清單分頁（#/trips/:id/lists）：行李清單／記事本／必買清單三個分頁。
 * 重點差異：
 *   - showCheckbox：記事本沒有打勾功能，行李清單/必買清單有
 *   - showPlace：只有記事本/必買清單有「地點」欄位跟完整表單新增，
 *     行李清單用頁面上方的快速輸入列（一個 <input> + Enter）新增，比較快
 *   - checkbox 現在是獨立元素（不包在 <label> 裡），只有點方框本身才會打勾，
 *     點內容區塊是開預覽（見 checklistItemDetailView.js）
 */
import { tripService } from "../../services/tripService.js";
import { checklistService } from "../../services/checklistService.js";
import { CHECKLIST_TYPES, listHasPlaceField } from "../../data/models/ChecklistItem.js";
import { openChecklistItemForm } from "./checklistItemFormView.js";
import { openChecklistItemDetailView } from "./checklistItemDetailView.js";
import { linkifyHtml } from "../../core/linkify.js";
import { svgIcon } from "../../core/icons.js";

export function renderTripListsView(container, params) {
  const trip = tripService.getTrip(params.id);

  if (!trip) {
    container.innerHTML = `
      <a href="#/trips" class="back-link">← 返回我的旅程</a>
      <div class="empty-state"><h2>找不到這趟旅程</h2></div>
    `;
    return;
  }

  const titleEl = document.getElementById("topbar-title");
  const eyebrowEl = document.getElementById("topbar-eyebrow");
  if (titleEl) titleEl.textContent = `${trip.destination || trip.name} · 清單`;
  if (eyebrowEl) eyebrowEl.textContent = "LISTS";

  const wrapper = document.createElement("div");
  container.appendChild(wrapper);

  let activeType = "packing";
  paint(wrapper, trip, activeType);
}

function paint(wrapper, trip, activeType) {
  const items = checklistService.listItems(trip.id, activeType);
  const meta = CHECKLIST_TYPES.find((t) => t.value === activeType);
  const showPlace = listHasPlaceField(activeType);
  const showCheckbox = activeType !== "wishlist"; // 記事本不需要打勾完成的概念
  const doneCount = items.filter((i) => i.isDone).length;

  wrapper.innerHTML = `
    <a href="#/trips/${trip.id}" class="back-link">← 返回旅程總覽</a>

    <div class="segmented" id="list-type-segmented" style="margin-top: var(--space-3);">
      ${CHECKLIST_TYPES.map(
        (t) => `<button class="segmented__item ${t.value === activeType ? "is-active" : ""}" data-type="${t.value}"><span class="list-type-icon">${t.icon}</span>${t.label}</button>`
      ).join("")}
    </div>

    ${
      showCheckbox && items.length > 0
        ? `<p class="settings-hint" style="margin-top: var(--space-3);">已完成 ${doneCount} / ${items.length} 項</p>`
        : ""
    }

    ${
      showPlace
        ? `<div class="section-header" style="margin-top: var(--space-3);">
             <h3><span class="list-type-icon">${meta.icon}</span>${meta.label}</h3>
             <button class="btn btn--ghost" data-action="add-detail-item">＋ 新增項目</button>
           </div>`
        : `<form id="quick-add-form" class="quick-add">
             <input type="text" id="quick-add-input" placeholder="${meta.placeholder}" autocomplete="off" />
             <button type="submit" class="btn btn--gold">＋</button>
           </form>`
    }

    <div id="checklist-slot">
      ${
        items.length === 0
          ? `<p class="section-empty">還沒有項目，${showPlace ? "點上面「＋ 新增項目」加一筆。" : "在上面輸入後按 Enter 或「＋」新增；新增後點內容可預覽、補上備註。"}</p>`
          : items.map((item) => checklistItemHtml(item, showCheckbox, showPlace)).join("")
      }
    </div>
  `;

  wrapper.querySelectorAll("#list-type-segmented [data-type]").forEach((btn) => {
    btn.addEventListener("click", () => {
      paint(wrapper, trip, btn.dataset.type);
    });
  });

  const quickAddForm = wrapper.querySelector("#quick-add-form");
  if (quickAddForm) {
    quickAddForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = wrapper.querySelector("#quick-add-input");
      const result = checklistService.addItem(trip.id, activeType, { text: input.value });
      if (result.ok) paint(wrapper, trip, activeType);
    });
  }

  const addDetailBtn = wrapper.querySelector('[data-action="add-detail-item"]');
  if (addDetailBtn) {
    addDetailBtn.addEventListener("click", () => {
      openChecklistItemForm({
        tripId: trip.id,
        listType: activeType,
        onSaved: () => paint(wrapper, trip, activeType),
      });
    });
  }

  // 只有點「框」本身才打勾，不會被點內容誤觸
  wrapper.querySelectorAll("[data-action='toggle']").forEach((checkbox) => {
    checkbox.addEventListener("click", (e) => e.stopPropagation());
    checkbox.addEventListener("change", () => {
      checklistService.toggleDone(checkbox.dataset.id);
      paint(wrapper, trip, activeType);
    });
  });

  // 點內容區塊開預覽（唯讀），要編輯在預覽裡按「✎ 編輯」
  wrapper.querySelectorAll("[data-action='preview']").forEach((el) => {
    el.addEventListener("click", () => {
      const item = checklistService.getItem(el.dataset.id);
      if (!item) return;
      openChecklistItemDetailView({
        tripId: trip.id,
        listType: activeType,
        item,
        onEdited: () => paint(wrapper, trip, activeType),
      });
    });
  });

  wrapper.querySelectorAll("[data-action='delete-checklist-item']").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      checklistService.deleteItem(btn.dataset.id);
      paint(wrapper, trip, activeType);
    });
  });
}

function checklistItemHtml(item, showCheckbox, showPlace) {
  const placeLine = showPlace && item.place ? `<div class="checklist-item__meta">📍 ${escapeHtml(item.place.name)}</div>` : "";
  const notesLine = item.notes ? `<div class="checklist-item__meta">${linkifyHtml(item.notes)}</div>` : "";
  const photoCount = (item.photos || []).length;
  const photoLine = photoCount
    ? `<div class="checklist-item__meta checklist-item__photos">${svgIcon("photo")}${photoCount} 張照片</div>`
    : "";

  return `
    <div class="checklist-item ${item.isDone ? "is-done" : ""}">
      ${
        showCheckbox
          ? `<input type="checkbox" class="checklist-item__checkbox" data-action="toggle" data-id="${item.id}" ${item.isDone ? "checked" : ""} aria-label="標記完成" />`
          : ""
      }
      <div class="checklist-item__body" data-action="preview" data-id="${item.id}" role="button" tabindex="0">
        <span class="checklist-item__text">${escapeHtml(item.text)}</span>
        ${placeLine}
        ${notesLine}
        ${photoLine}
      </div>
      <div class="checklist-item__actions">
        <button type="button" class="trip-card__icon-btn" data-action="delete-checklist-item" data-id="${item.id}" aria-label="刪除">🗑</button>
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
