/**
 * tripPlaceDetail.js — 旅程清單裡某個地點的預覽（底部面板，唯讀）。
 *
 * openTripPlaceDetail({ entry, place, trip, usedIn, onChanged })
 *   usedIn：[{ short, full }]，見 data/tripPlaceUsage.js
 *
 * 版面（2026-11-01 第 ② 小步，使用者決定）：
 *   分類、地區、狀態（未排入／已排入：…／去過）
 *   導航、參考連結 按鈕
 *   地址、地點備註（地點資料庫的，所有旅程共用）
 *   這趟的備註（放最下面；只屬於這趟）
 *   底部「從清單移除｜編輯備註」，下方小連結「編輯地點資料」（會影響所有旅程）
 *
 * - 移除只會把地點移出這趟的清單，共用地點資料庫不受影響。
 *   已排入（用在航班、住宿；之後還有活動、行程）的地點不能移除：按鈕變灰，下方寫原因（2026-11-01 使用者決定）。
 * - 編輯備註、編輯地點資料存好後，重新打開更新過的預覽。
 */
import { html, safeUrl } from "../../core/html.js";
import { icon } from "../../core/icons.js";
import { openSheet } from "../../core/sheet.js";
import { linkify, linkSource } from "../../core/linkify.js";
import { navigationUrl } from "../../core/geo.js";
import { categoryLabel, placeStore } from "../../data/places.js";
import { tripPlaceStore } from "../../data/tripPlaces.js";
import { openPlaceForm } from "../places/placeForm.js";
import { openTripPlaceNotesForm } from "./tripPlaceNotesForm.js";

export function openTripPlaceDetail({ entry, place, trip, usedIn = [], onChanged }) {
  const usedText = usedIn.map((u) => u.full).join("、");
  const status = entry.visited ? "去過" : usedIn.length ? `已排入：${usedText}` : "未排入";
  const nav = navigationUrl(place);
  const website = safeUrl(place.website);

  /** 存好之後：先讓清單重畫，再用最新資料重新打開預覽 */
  function reopen() {
    if (onChanged) onChanged();
    const freshEntry = tripPlaceStore.get(entry.id);
    const freshPlace = freshEntry && placeStore.get(freshEntry.placeId);
    if (freshEntry && freshPlace) openTripPlaceDetail({ entry: freshEntry, place: freshPlace, trip, usedIn, onChanged });
  }

  openSheet({
    title: place.name,
    body: html`
      <div class="detail-badges">
        <span class="badge cat--${place.category}">${icon(place.category)}${categoryLabel(place.category)}</span>
        ${place.area ? html`<span class="badge">${place.area}</span>` : ""}
        <span class="badge tp-status ${entry.visited ? "is-visited" : ""}">${entry.visited ? icon("check") : ""}${status}</span>
      </div>

      <div class="detail-actions">
        ${nav
          ? html`<a class="btn btn--primary" href="${nav}" target="_blank" rel="noopener noreferrer">${icon("navigate")}導航</a>`
          : ""}
        ${website
          ? html`<a class="btn btn--ghost" href="${website}" target="_blank" rel="noopener noreferrer">${icon("globe")}<span class="btn__label">${linkSource(website)}</span></a>`
          : ""}
      </div>
      <p class="field__hint nav-hint">${safeUrl(place.mapsUrl) ? "導航會打開保存的 Google 地圖連結" : "沒有保存 Google 地圖連結，導航會用「名稱＋地區」搜尋"}</p>

      ${place.address ? detailRow("地址", place.address) : ""}
      ${place.notes ? detailRow("地點備註（所有旅程共用）", linkify(place.notes), true) : ""}

      <div class="tp-notes">
        <div class="detail-row__label">這趟的備註</div>
        ${entry.notes
          ? html`<div class="detail-row__value is-prewrap">${linkify(entry.notes)}</div>`
          : html`<div class="muted">還沒有寫這趟的備註</div>`}
      </div>

      <div class="form__actions form__actions--spaced">
        <button type="button" class="btn btn--danger" data-action="remove" ${usedIn.length ? html`disabled` : ""}>從清單移除</button>
        <button type="button" class="btn btn--primary" data-action="notes">編輯備註</button>
      </div>
      ${usedIn.length
        ? html`<p class="field__hint tp-remove-hint">用在：${usedText}。要先從那裡移除，才能移出清單。</p>`
        : ""}
      <button type="button" class="link-btn tp-edit-place" data-action="edit-place">
        編輯地點資料（會影響所有旅程）
      </button>
    `,
    onMount(panel, close) {
      panel.querySelector('[data-action="remove"]').addEventListener("click", () => {
        if (usedIn.length) return; // 已排入的不能移除（按鈕已停用，這裡再擋一次）
        if (!window.confirm(`要把「${place.name}」從這趟的清單移除嗎？\n（地點資料庫裡的資料不會被刪除）`)) return;
        const result = tripPlaceStore.remove(entry.id);
        if (!result.ok) {
          window.alert(result.errors.join("\n"));
          return;
        }
        close();
        if (onChanged) onChanged();
      });
      panel.querySelector('[data-action="notes"]').addEventListener("click", () => {
        close();
        openTripPlaceNotesForm({ entry, place, trip, onSaved: reopen });
      });
      panel.querySelector('[data-action="edit-place"]').addEventListener("click", () => {
        close();
        openPlaceForm({ place, onSaved: reopen, onDeleted: onChanged });
      });
    },
  });
}

function detailRow(label, value, preWrap = false) {
  return html`
    <div class="detail-row">
      <div class="detail-row__label">${label}</div>
      <div class="detail-row__value ${preWrap ? "is-prewrap" : ""}">${value}</div>
    </div>
  `;
}
