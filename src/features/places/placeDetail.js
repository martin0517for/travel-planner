/**
 * placeDetail.js — 地點預覽（唯讀）。點列表上的地點會先開這個，
 * 在這裡可以直接「導航」或開官網。
 * 底部是「刪除｜編輯」（關閉用右上角的 ×）。
 */
import { html } from "../../core/html.js";
import { icon } from "../../core/icons.js";
import { openSheet } from "../../core/sheet.js";
import { linkify } from "../../core/linkify.js";
import { navigationUrl, isValidLatLng } from "../../core/geo.js";
import { safeUrl } from "../../core/html.js";
import { categoryLabel, placeStore } from "../../data/places.js";
import { openPlaceForm } from "./placeForm.js";

export function openPlaceDetail({ place, onChanged }) {
  const nav = navigationUrl(place);
  const website = safeUrl(place.website);
  const mapLink = safeUrl(place.mapsUrl);
  const hasCoords = isValidLatLng(place.lat, place.lng);

  openSheet({
    title: place.name,
    body: html`
      <div class="detail-badges">
        <span class="badge cat--${place.category}">${icon(place.category)}${categoryLabel(place.category)}</span>
        ${place.area ? html`<span class="badge">${place.area}</span>` : ""}
        ${place.tags.map((t) => html`<span class="tag">${t}</span>`)}
      </div>

      <div class="detail-actions">
        ${nav
          ? html`<a class="btn btn--primary" href="${nav}" target="_blank" rel="noopener noreferrer">${icon("navigate")}導航</a>`
          : ""}
        ${website
          ? html`<a class="btn btn--ghost" href="${website}" target="_blank" rel="noopener noreferrer">${icon("globe")}官網</a>`
          : ""}
      </div>
      ${place.searchName ? detailRow("Google 地圖搜尋名稱", place.searchName) : ""}

      ${place.address ? detailRow("地址", place.address) : ""}
      ${detailRow("座標", hasCoords ? `${place.lat}, ${place.lng}` : "尚未設定（不會顯示在 App 的地圖上）")}
      ${mapLink
        ? detailRow("地圖連結", html`<a href="${mapLink}" target="_blank" rel="noopener noreferrer">開啟保存的地圖連結</a>`)
        : ""}
      ${place.notes ? detailRow("備註", linkify(place.notes), true) : ""}

      <div class="form__actions form__actions--spaced">
        <button type="button" class="btn btn--danger" data-action="delete">刪除</button>
        <button type="button" class="btn btn--primary" data-action="edit">編輯</button>
      </div>
    `,
    onMount(panel, close) {
      panel.querySelector('[data-action="delete"]').addEventListener("click", () => {
        if (!window.confirm(`確定要刪除「${place.name}」嗎？這個動作無法復原。`)) return;
        const result = placeStore.remove(place.id);
        if (!result.ok) {
          window.alert(result.errors.join("\n"));
          return;
        }
        close();
        if (onChanged) onChanged();
      });
      panel.querySelector('[data-action="edit"]').addEventListener("click", () => {
        close();
        openPlaceForm({ place, onSaved: onChanged, onDeleted: onChanged });
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
