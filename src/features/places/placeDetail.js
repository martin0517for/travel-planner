/**
 * placeDetail.js — 地點預覽（唯讀）。點列表上的地點會先開這個，
 * 在這裡可以直接「導航」或開官網；要修改按「編輯」。
 */
import { html } from "../../core/html.js";
import { icon } from "../../core/icons.js";
import { openSheet } from "../../core/sheet.js";
import { linkify } from "../../core/linkify.js";
import { navigationUrl, isValidLatLng } from "../../core/geo.js";
import { safeUrl } from "../../core/html.js";
import { categoryLabel } from "../../data/places.js";
import { openPlaceForm } from "./placeForm.js";

export function openPlaceDetail({ place, onChanged }) {
  const nav = navigationUrl(place);
  const website = safeUrl(place.website);
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

      ${place.address ? detailRow("地址", place.address) : ""}
      ${detailRow("座標", hasCoords ? `${place.lat}, ${place.lng}` : "尚未設定（地圖上不會顯示，導航會改用名稱搜尋）")}
      ${place.notes ? detailRow("備註", linkify(place.notes), true) : ""}

      <div class="form__actions form__actions--spaced">
        <button type="button" class="btn btn--ghost" data-action="close">關閉</button>
        <button type="button" class="btn btn--primary" data-action="edit">編輯</button>
      </div>
    `,
    onMount(panel, close) {
      panel.querySelector('[data-action="close"]').addEventListener("click", close);
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
