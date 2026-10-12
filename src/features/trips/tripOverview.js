/**
 * tripOverview.js — 旅程「總覽」頁。
 * 目前只有上方的旅程資訊與「編輯」；航班、住宿區塊會在後續步驟加入。
 */
import { html, render } from "../../core/html.js";
import { tripStatus, formatRange } from "../../core/dates.js";
import { openTripForm } from "./tripForm.js";
import { navigate } from "../../core/router.js";

export function renderTripOverview(container, trip, refresh) {
  const status = tripStatus(trip.startDate, trip.endDate);
  render(
    container,
    html`
      <section class="trip-head">
        <div class="trip-head__row">
          <div class="trip-head__info">
            <h2 class="trip-head__name">${trip.name}</h2>
            ${trip.destination ? html`<div class="trip-head__dest">${trip.destination}</div>` : ""}
            <div class="trip-head__dates">${formatRange(trip.startDate, trip.endDate)}</div>
          </div>
          <button type="button" class="btn btn--small" data-action="edit">編輯</button>
        </div>
        <div class="trip-head__status">${statusText(status)}</div>
      </section>

      <div class="perforation" aria-hidden="true"></div>

      <p class="muted center">航班、住宿會在後續步驟加入這一頁。</p>
    `
  );

  container.querySelector('[data-action="edit"]').addEventListener("click", () =>
    openTripForm({
      trip,
      onSaved: refresh,
      onDeleted: () => navigate("/trips"),
    })
  );
}

function statusText(status) {
  switch (status.kind) {
    case "upcoming":
      return status.days === 0 ? "今天出發！" : `還有 ${status.days} 天出發`;
    case "ongoing":
      return `旅程進行中・第 ${status.day} 天／共 ${status.total} 天`;
    case "ended":
      return "旅程已結束";
    default:
      return "出發日期未定";
  }
}
