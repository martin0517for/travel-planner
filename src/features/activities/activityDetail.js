/**
 * activityDetail.js — 活動預覽（唯讀，底部滑出面板，計畫書 9.5，2026-11-01）。
 * 點總覽頁上的活動會先開這個。
 * 版面：天數徽章 → 日期、時間 → 地點列表（照活動裡排的順序，每個右邊有「導航」）→ 內容
 *       → 底部「刪除｜編輯」（關閉用右上角的 ×）。
 * v0.8.3：多一行「行程」；被移除過 →「加入行程」，沒有日期 →「排進行程」。
 *         從行程頁打開（scheduleDay＝第幾天）時，底部改成「從行程移除｜編輯」，不能刪除。
 */
import { html } from "../../core/html.js";
import { icon } from "../../core/icons.js";
import { openSheet } from "../../core/sheet.js";
import { linkify } from "../../core/linkify.js";
import { navigationUrl } from "../../core/geo.js";
import { formatDateShort } from "../../core/dates.js";
import { activityStore, daysOf } from "../../data/activities.js";
import { scheduleBlock, wireScheduleBlock, scheduleActions, wireScheduleActions, afterDeleted } from "../schedule/scheduleLinks.js";
import { placeStore, categoryLabel } from "../../data/places.js";
import { openActivityForm } from "./activityForm.js";

/** 地點名稱（已刪除的略過）：總覽頁第 2 行、預覽共用 */
export function activityPlaces(act) {
  return act.placeIds.map((id) => placeStore.get(id)).filter(Boolean);
}

/** 總覽頁第 2 行：「哈利波特區・任天堂世界 +2」（只列前兩個） */
export function activityPlacesShort(act) {
  const names = activityPlaces(act).map((p) => p.name);
  if (!names.length) return "";
  return names.slice(0, 2).join("・") + (names.length > 2 ? ` +${names.length - 2}` : "");
}

/** 總覽頁第 3 行：一段日期「→ 04-05（一）・共 3 天」；一天「09:00 → 21:00」；都沒有就空字串 */
export function activityMeta(act) {
  if (act.endDate) return `→ ${formatDateShort(act.endDate)}・共 ${daysOf(act)} 天`;
  return timeRange(act);
}

function timeRange(act) {
  if (act.startTime && act.endTime) return `${act.startTime} → ${act.endTime}`;
  if (act.startTime) return `${act.startTime} 開始`;
  if (act.endTime) return `${act.endTime} 結束`;
  return "";
}

/** 預覽的「時間」文字：一段日期時寫成「第一天 09:00 開始・最後一天 18:00 結束」 */
function detailTime(act) {
  if (!act.endDate) return timeRange(act);
  return [act.startTime && `第一天 ${act.startTime} 開始`, act.endTime && `最後一天 ${act.endTime} 結束`]
    .filter(Boolean)
    .join("・");
}

export function openActivityDetail({ activity, scheduleDay = 0, onChanged }) {
  const act = activity;
  const days = daysOf(act);
  const places = act.placeIds.map((id) => ({ id, place: placeStore.get(id) }));
  const dateText = act.endDate
    ? `${formatDateShort(act.startDate, true)} → ${formatDateShort(act.endDate, true)}`
    : formatDateShort(act.startDate, true);
  const time = detailTime(act);

  openSheet({
    title: act.title,
    body: html`
      <div class="detail-badges">
        <span class="badge">${days === null ? "日期未定" : days === 1 ? "一天" : `共 ${days} 天`}</span>
        ${places.length ? html`<span class="badge">${places.length} 個地點</span>` : ""}
      </div>

      ${detailRow("日期", dateText || "未填", true)}
      ${time ? detailRow("時間", time, true) : ""}

      <div class="detail-row">
        <div class="detail-row__label">地點</div>
        ${places.length
          ? html`<ol class="act-places act-places--detail">${places.map(({ place }, i) => detailPlace(place, i))}</ol>`
          : html`<div class="detail-row__value muted">還沒有選地點</div>`}
      </div>

      ${act.notes ? detailRow("內容", linkify(act.notes), false, true) : ""}

      ${scheduleBlock({ kind: "activity", obj: act, scheduleDay })}

      ${scheduleDay
        ? scheduleActions(scheduleDay)
        : html`<div class="form__actions form__actions--spaced">
            <button type="button" class="btn btn--danger" data-action="delete">刪除</button>
            <button type="button" class="btn btn--primary" data-action="edit">編輯</button>
          </div>`}
    `,
    onMount(panel, close) {
      wireScheduleBlock(panel, { kind: "activity", obj: act, close, onChanged });
      wireScheduleActions(panel, { kind: "activity", obj: act, day: scheduleDay, close, onChanged });
      panel.querySelector('[data-action="delete"]')?.addEventListener("click", () => {
        if (!window.confirm(`確定要刪除活動「${act.title}」嗎？這個動作無法復原。\n（活動裡的地點會留在想去的地點清單）`)) return;
        const result = activityStore.remove(act.id);
        if (!result.ok) {
          window.alert(result.errors.join("\n"));
          return;
        }
        afterDeleted("activity", act);
        close();
        if (onChanged) onChanged();
      });
      panel.querySelector('[data-action="edit"]').addEventListener("click", () => {
        close();
        openActivityForm({ tripId: act.tripId, activity: act, onSaved: onChanged });
      });
    },
  });
}

function detailPlace(place, index) {
  if (!place) {
    return html`
      <li class="act-place">
        <span class="act-place__num">${index + 1}</span>
        <span class="act-place__body"><span class="act-place__name is-missing">（地點已刪除）</span></span>
      </li>
    `;
  }
  const nav = navigationUrl(place);
  return html`
    <li class="act-place">
      <span class="act-place__num">${index + 1}</span>
      <span class="place-row__icon cat--${place.category}" title="${categoryLabel(place.category)}">${icon(place.category)}</span>
      <span class="act-place__body">
        <span class="act-place__name">${place.name}</span>
        ${place.area ? html`<span class="act-place__sub">${place.area}</span>` : ""}
      </span>
      ${nav
        ? html`<a class="btn btn--small act-place__nav" href="${nav}" target="_blank" rel="noopener noreferrer">${icon("navigate")}導航</a>`
        : ""}
    </li>
  `;
}

function detailRow(label, value, mono = false, preWrap = false) {
  return html`
    <div class="detail-row">
      <div class="detail-row__label">${label}</div>
      <div class="detail-row__value ${mono ? "mono" : ""} ${preWrap ? "is-prewrap" : ""}">${value}</div>
    </div>
  `;
}
