/**
 * accommodationDetail.js — 住宿預覽（唯讀，底部滑出面板）。
 * 點總覽頁上的住宿會先開這個；有飯店時上方有「導航」按鈕（開飯店的 Google 地圖），
 * 底部是「刪除｜編輯」（關閉用右上角的 ×）。
 * v0.8.3：多一行「行程」；被移除過 →「加入行程」，沒有日期 →「排進行程」。
 *         從行程頁打開（scheduleDay＝第幾天）時，底部改成「從行程移除｜編輯」，不能刪除。
 */
import { html } from "../../core/html.js";
import { icon } from "../../core/icons.js";
import { openSheet } from "../../core/sheet.js";
import { linkify } from "../../core/linkify.js";
import { navigationUrl } from "../../core/geo.js";
import { formatDateShort } from "../../core/dates.js";
import { accommodationStore, nightsOf } from "../../data/accommodations.js";
import { placeStore } from "../../data/places.js";
import { openAccommodationForm } from "./accommodationForm.js";
import { scheduleBlock, wireScheduleBlock, scheduleActions, wireScheduleActions, afterDeleted } from "../schedule/scheduleLinks.js";

/** 住宿的顯示名稱：飯店名稱 →（地點已刪除）→「住宿」 */
export function stayTitle(stay) {
  if (!stay.placeId) return "住宿";
  const place = placeStore.get(stay.placeId);
  return place ? place.name : "住宿（地點已刪除）";
}

/** "03-25（四）15:00" 這樣的入住／退房文字 */
export function stayWhen(date, time, withYear = false) {
  return [formatDateShort(date, withYear), time].filter(Boolean).join(" ");
}

export function nightsText(stay) {
  const n = nightsOf(stay);
  return n === null ? "" : n === 0 ? "不過夜" : `${n} 晚`;
}

export function openAccommodationDetail({ stay, scheduleDay = 0, onChanged }) {
  const place = stay.placeId ? placeStore.get(stay.placeId) : null;
  const nav = place ? navigationUrl(place) : null;
  const nights = nightsText(stay);

  openSheet({
    title: stayTitle(stay),
    body: html`
      <div class="detail-badges">
        ${nights ? html`<span class="badge">${nights}</span>` : ""}
        ${place && place.area ? html`<span class="badge">${place.area}</span>` : ""}
        ${stay.platform ? html`<span class="badge">${stay.platform}</span>` : ""}
      </div>

      ${nav
        ? html`<div class="detail-actions">
            <a class="btn btn--primary" href="${nav}" target="_blank" rel="noopener noreferrer">${icon("navigate")}導航</a>
          </div>`
        : ""}

      ${detailRow("入住", stayWhen(stay.checkInDate, stay.checkInTime, true) || "未填")}
      ${detailRow("退房", stayWhen(stay.checkOutDate, stay.checkOutTime, true) || "未填")}
      ${place && place.address ? detailRow("地址", place.address) : ""}
      ${stay.bookingRef ? detailRow("訂房代號", stay.bookingRef, true) : ""}
      ${stay.notes ? detailRow("備註", linkify(stay.notes), false, true) : ""}
      ${scheduleBlock({ kind: "stay", obj: stay, scheduleDay })}

      ${scheduleDay
        ? scheduleActions(scheduleDay)
        : html`<div class="form__actions form__actions--spaced">
            <button type="button" class="btn btn--danger" data-action="delete">刪除</button>
            <button type="button" class="btn btn--primary" data-action="edit">編輯</button>
          </div>`}
    `,
    onMount(panel, close) {
      wireScheduleBlock(panel, { kind: "stay", obj: stay, close, onChanged });
      wireScheduleActions(panel, { kind: "stay", obj: stay, day: scheduleDay, close, onChanged });
      panel.querySelector('[data-action="delete"]')?.addEventListener("click", () => {
        if (!window.confirm(`確定要刪除住宿「${stayTitle(stay)}」嗎？這個動作無法復原。`)) return;
        const result = accommodationStore.remove(stay.id);
        if (!result.ok) {
          window.alert(result.errors.join("\n"));
          return;
        }
        afterDeleted("stay", stay);
        close();
        if (onChanged) onChanged();
      });
      panel.querySelector('[data-action="edit"]').addEventListener("click", () => {
        close();
        openAccommodationForm({ tripId: stay.tripId, stay, onSaved: onChanged });
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
