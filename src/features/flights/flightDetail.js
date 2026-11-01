/**
 * flightDetail.js — 航班預覽（唯讀，底部滑出面板）。
 * 點總覽頁上的航班會先開這個；底部是「刪除｜編輯」（關閉用右上角的 ×）。
 */
import { html } from "../../core/html.js";
import { openSheet } from "../../core/sheet.js";
import { linkify } from "../../core/linkify.js";
import { formatDateTime } from "../../core/dates.js";
import { flightStore, directionLabel } from "../../data/flights.js";
import { placeStore } from "../../data/places.js";
import { openFlightForm } from "./flightForm.js";

/** 航班的顯示名稱：航班號碼 → 航空公司 → 「航班」 */
export function flightTitle(f) {
  return f.flightNo || f.airline || "航班";
}

/** 機場名稱：找得到地點就顯示名稱；存了 id 但地點已不存在時顯示提醒 */
export function airportName(placeId) {
  if (!placeId) return "";
  const place = placeStore.get(placeId);
  return place ? place.name : "（地點已刪除）";
}

export function openFlightDetail({ flight, onChanged }) {
  const dep = airportName(flight.departurePlaceId);
  const arr = airportName(flight.arrivalPlaceId);

  openSheet({
    title: flightTitle(flight),
    body: html`
      <div class="detail-badges">
        <span class="badge">${directionLabel(flight.direction)}</span>
        ${flight.flightNo && flight.airline ? html`<span class="badge">${flight.airline}</span>` : ""}
      </div>

      ${detailRow("出發", [dep, formatDateTime(flight.departureTime, true)].filter(Boolean).join("\n") || "未填")}
      ${detailRow("抵達", [arr, formatDateTime(flight.arrivalTime, true)].filter(Boolean).join("\n") || "未填")}
      ${flight.bookingRef ? detailRow("訂位代號", flight.bookingRef, false, true) : ""}
      ${flight.seat ? detailRow("座位", flight.seat, false, true) : ""}
      ${flight.notes ? detailRow("備註", linkify(flight.notes)) : ""}

      <div class="form__actions form__actions--spaced">
        <button type="button" class="btn btn--danger" data-action="delete">刪除</button>
        <button type="button" class="btn btn--primary" data-action="edit">編輯</button>
      </div>
    `,
    onMount(panel, close) {
      panel.querySelector('[data-action="delete"]').addEventListener("click", () => {
        if (!window.confirm(`確定要刪除航班「${flightTitle(flight)}」嗎？這個動作無法復原。`)) return;
        const result = flightStore.remove(flight.id);
        if (!result.ok) {
          window.alert(result.errors.join("\n"));
          return;
        }
        close();
        if (onChanged) onChanged();
      });
      panel.querySelector('[data-action="edit"]').addEventListener("click", () => {
        close();
        openFlightForm({ tripId: flight.tripId, flight, onSaved: onChanged });
      });
    },
  });
}

function detailRow(label, value, preWrap = true, mono = false) {
  return html`
    <div class="detail-row">
      <div class="detail-row__label">${label}</div>
      <div class="detail-row__value ${preWrap ? "is-prewrap" : ""} ${mono ? "mono" : ""}">${value}</div>
    </div>
  `;
}
