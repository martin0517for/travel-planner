/**
 * itemDetail.js — 行程項目預覽（唯讀，底部滑出面板，⑤ 每日行程，2026-11-01）。
 * 點 Timeline 上的項目會先開這個。
 * 版面：分類／類型、第幾天徽章 →（有地點）導航 → 時間、說明、交通方式、地址、備註 → 底部「刪除｜編輯」。
 */
import { html } from "../../core/html.js";
import { icon } from "../../core/icons.js";
import { openSheet } from "../../core/sheet.js";
import { linkify } from "../../core/linkify.js";
import { navigationUrl } from "../../core/geo.js";
import { dayPlanStore, kindLabel } from "../../data/dayPlans.js";
import { placeStore, categoryLabel } from "../../data/places.js";
import { openItemForm, kindIcon, dayLabel } from "./itemForm.js";

/** 項目的名稱：有地點用地點名稱（地點已刪除時提醒），沒地點用文字 */
export function itemTitle(item) {
  if (item.placeId) {
    const place = placeStore.get(item.placeId);
    return place ? place.name : item.text || "（地點已刪除）";
  }
  return item.text;
}

export function openItemDetail({ trip, dayInfo, item, onChanged }) {
  const place = item.placeId ? placeStore.get(item.placeId) : null;
  const nav = place ? navigationUrl(place) : null;
  const sub = place ? item.text : "";

  openSheet({
    title: itemTitle(item),
    body: html`
      <div class="detail-badges">
        ${place
          ? html`<span class="badge cat--${place.category}">${icon(place.category)}${categoryLabel(place.category)}</span>`
          : item.placeId
            ? html`<span class="badge">地點已刪除</span>`
            : html`<span class="badge">${icon(kindIcon(item.kind))}${kindLabel(item.kind)}</span>`}
        <span class="badge">${dayLabel(dayInfo)}</span>
        ${place && place.area ? html`<span class="badge">${place.area}</span>` : ""}
      </div>

      ${nav
        ? html`
            <div class="detail-actions">
              <a class="btn btn--primary" href="${nav}" target="_blank" rel="noopener noreferrer">${icon("navigate")}導航</a>
            </div>
          `
        : ""}

      ${detailRow("時間", item.time || "未填", true)}
      ${sub ? detailRow("說明", sub) : ""}
      ${item.transport ? detailRow("交通方式", item.transport) : ""}
      ${place && place.address ? detailRow("地址", place.address) : ""}
      ${item.notes ? detailRow("備註", linkify(item.notes), false, true) : ""}

      <div class="form__actions form__actions--spaced">
        <button type="button" class="btn btn--danger" data-action="delete">刪除</button>
        <button type="button" class="btn btn--primary" data-action="edit">編輯</button>
      </div>
    `,
    onMount(panel, close) {
      panel.querySelector('[data-action="delete"]').addEventListener("click", () => {
        const what = itemTitle(item);
        const extra = place ? "\n（地點會留在想去的地點清單）" : "";
        if (!window.confirm(`確定要從行程刪除「${what}」嗎？${extra}`)) return;
        const result = dayPlanStore.removeItem(trip.id, item.id);
        if (!result.ok) {
          window.alert(result.errors.join("\n"));
          return;
        }
        close();
        if (onChanged) onChanged();
      });
      panel.querySelector('[data-action="edit"]').addEventListener("click", () => {
        close();
        openItemForm({ trip, day: dayInfo.day, item, onSaved: (_, toDay) => onChanged && onChanged(toDay) });
      });
    },
  });
}

function detailRow(label, value, mono = false, preWrap = false) {
  return html`
    <div class="detail-row">
      <div class="detail-row__label">${label}</div>
      <div class="detail-row__value ${mono ? "mono" : ""} ${preWrap ? "is-prewrap" : ""}">${value}</div>
    </div>
  `;
}
