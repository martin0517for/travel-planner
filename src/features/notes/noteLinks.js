/**
 * noteLinks.js — 地點預覽裡的「筆記 N」區塊（v0.12.1，2026-11-05 使用者決定）。
 *
 * 用在：清單「想去的地點」的地點預覽（tripPlaceDetail.js）、行程頁有地點的項目預覽（itemDetail.js）。
 * 只列這趟旅程、用到這個地點的筆記；沒有就整塊不顯示。
 * 每列只顯示類型圖示＋標題（完成的不變淡）；順序同筆記頁：未完成在前、完成在後，新的排上面。
 *
 * notesUsingPlace(tripId, placeId)      → 筆記陣列（已排好）
 * notesSection(notes, { clickable })    → html 區塊；clickable 時每列右邊有 ›，點了疊上筆記預覽
 * wireNoteLinks(panel, { backLabel })   → 綁定點擊：疊上「只看內容」的筆記預覽（noteDetail.js 的 stacked）
 *
 * 不會一層疊一層（P-5）：疊上來的地點預覽、疊上來的筆記預覽裡，地點和筆記都只顯示、不能點。
 */
import { html } from "../../core/html.js";
import { icon } from "../../core/icons.js";
import { noteStore, noteKind, noteKindLabel } from "../../data/notes.js";
import { openNoteDetail } from "./noteDetail.js";

export function notesUsingPlace(tripId, placeId) {
  const list = noteStore.listByTrip(tripId).filter((n) => n.placeIds.includes(placeId)); // listByTrip 已經新的在上面
  return [...list.filter((n) => !n.done), ...list.filter((n) => n.done)];
}

export function notesSection(notes, { clickable = true } = {}) {
  if (!notes.length) return "";
  return html`
    <div class="detail-row">
      <div class="detail-row__label">筆記<span class="act-count">${notes.length}</span></div>
      <ul class="act-places act-places--detail note-links">${notes.map((n) => row(n, clickable))}</ul>
    </div>
  `;
}

function row(n, clickable) {
  const k = noteKind(n.kind);
  const inner = html`
    <span class="place-row__icon ${k.cat}" title="${noteKindLabel(n)}">${icon(k.icon)}</span>
    <span class="act-place__body"><span class="act-place__name">${n.title}</span></span>
  `;
  return clickable
    ? html`<li class="act-place">
        <button type="button" class="act-place__open" data-open-note="${n.id}" aria-label="看筆記「${n.title}」">
          ${inner}<span class="act-place__more" aria-hidden="true">${icon("back")}</span>
        </button>
      </li>`
    : html`<li class="act-place">${inner}</li>`;
}

export function wireNoteLinks(panel, { backLabel = "返回" } = {}) {
  panel.querySelectorAll("[data-open-note]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const note = noteStore.get(btn.dataset.openNote);
      if (note) openNoteDetail({ note, stacked: true, backLabel });
    })
  );
}
