/**
 * tripPlaceDetail.js — 旅程清單裡某個地點的預覽（底部面板，唯讀）。
 *
 * 第 ① 小步（2026-11-01）先做簡單版：分類、地區、地址、狀態，底部「從清單移除」。
 * 第 ② 小步再補：導航、參考連結、地點備註、這趟的備註（可編輯）。
 *
 * 移除只會把地點移出這趟的清單，共用地點資料庫不受影響。
 * 已排入（用在航班、住宿、行程）的地點不能移除（第 ③ 小步接上）。
 */
import { html } from "../../core/html.js";
import { icon } from "../../core/icons.js";
import { openSheet } from "../../core/sheet.js";
import { categoryLabel } from "../../data/places.js";
import { tripPlaceStore } from "../../data/tripPlaces.js";

export function openTripPlaceDetail({ entry, place, usedIn = [], onChanged }) {
  const status = entry.visited ? "去過" : usedIn.length ? `已排入：${usedIn.join("、")}` : "未排入";

  openSheet({
    title: place.name,
    body: html`
      <div class="detail-badges">
        <span class="badge cat--${place.category}">${icon(place.category)}${categoryLabel(place.category)}</span>
        ${place.area ? html`<span class="badge">${place.area}</span>` : ""}
      </div>
      ${place.address ? detailRow("地址", place.address) : ""}
      ${detailRow("狀態", status)}
      <div class="form__actions form__actions--spaced">
        <button type="button" class="btn btn--danger" data-action="remove">從清單移除</button>
      </div>
    `,
    onMount(panel, close) {
      panel.querySelector('[data-action="remove"]').addEventListener("click", () => {
        if (!window.confirm(`要把「${place.name}」從這趟的清單移除嗎？\n（地點資料庫裡的資料不會被刪除）`)) return;
        const result = tripPlaceStore.remove(entry.id);
        if (!result.ok) {
          window.alert(result.errors.join("\n"));
          return;
        }
        close();
        if (onChanged) onChanged();
      });
    },
  });
}

function detailRow(label, value) {
  return html`
    <div class="detail-row">
      <div class="detail-row__label">${label}</div>
      <div class="detail-row__value">${value}</div>
    </div>
  `;
}
