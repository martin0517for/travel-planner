/**
 * tripOverview.js — 旅程「總覽」頁。
 * 上方是旅程資訊與「編輯」，下面是航班區塊（2026-11-01）；住宿區塊之後加入。
 * 航班區塊目前是簡單列表，第 4 步再做正式排版。
 */
import { html, render } from "../../core/html.js";
import { tripStatus, formatRange } from "../../core/dates.js";
import { openTripForm } from "./tripForm.js";
import { navigate } from "../../core/router.js";
import { icon } from "../../core/icons.js";
import { formatDateTime } from "../../core/dates.js";
import { flightStore, directionLabel } from "../../data/flights.js";
import { openFlightForm } from "../flights/flightForm.js";
import { openFlightDetail, flightTitle, airportName } from "../flights/flightDetail.js";

export function renderTripOverview(container, trip, refresh) {
  const status = tripStatus(trip.startDate, trip.endDate);
  const flights = flightStore.listByTrip(trip.id);
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

      <div class="section-head">
        <h3 class="section-head__title">航班</h3>
        <button type="button" class="btn btn--small" data-action="add-flight">${icon("plus")}新增</button>
      </div>
      ${flights.length
        ? html`<ul class="place-list">${flights.map(flightRow)}</ul>`
        : html`<p class="muted">還沒有航班。</p>`}

      <p class="muted center section-head--spaced">住宿會在後續步驟加入這一頁。</p>
    `
  );

  container.querySelector('[data-action="add-flight"]').addEventListener("click", () =>
    openFlightForm({ tripId: trip.id, onSaved: refresh })
  );
  container.querySelectorAll("[data-flight]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const flight = flights.find((f) => f.id === btn.dataset.flight);
      if (flight) openFlightDetail({ flight, onChanged: refresh });
    })
  );

  container.querySelector('[data-action="edit"]').addEventListener("click", () =>
    openTripForm({
      trip,
      onSaved: refresh,
      onDeleted: () => navigate("/trips"),
    })
  );
}

function flightRow(f) {
  const route = [airportName(f.departurePlaceId), airportName(f.arrivalPlaceId)].filter(Boolean).join(" → ");
  const time = formatDateTime(f.departureTime);
  return html`
    <li>
      <button type="button" class="place-row" data-flight="${f.id}">
        <span class="place-row__icon cat--transport">${icon("plane")}</span>
        <span class="place-row__body">
          <span class="place-row__name">${flightTitle(f)}</span>
          ${route ? html`<span class="place-row__sub">${route}</span>` : ""}
          ${time ? html`<span class="place-row__sub mono">${time}</span>` : ""}
        </span>
        <span class="badge">${directionLabel(f.direction)}</span>
      </button>
    </li>
  `;
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
