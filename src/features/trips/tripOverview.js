/**
 * tripOverview.js — 旅程「總覽」頁。
 * 上方是旅程資訊與「編輯」，下面是航班、住宿區塊（2026-11-01）。
 * 兩個區塊用「日期時間軸」列表（方案 B）：左邊日期、中間圖示、右邊名稱與時間。
 */
import { html, render } from "../../core/html.js";
import { tripStatus, formatRange, parseDate, formatDateShort } from "../../core/dates.js";
import { placeStore } from "../../data/places.js";
import { openTripForm } from "./tripForm.js";
import { navigate } from "../../core/router.js";
import { icon } from "../../core/icons.js";
import { flightStore, directionLabel } from "../../data/flights.js";
import { openFlightForm } from "../flights/flightForm.js";
import { openFlightDetail, flightTitle, airportName } from "../flights/flightDetail.js";
import { accommodationStore } from "../../data/accommodations.js";
import { openAccommodationForm } from "../accommodations/accommodationForm.js";
import { openAccommodationDetail, stayTitle, nightsText } from "../accommodations/accommodationDetail.js";

export function renderTripOverview(container, trip, refresh) {
  const status = tripStatus(trip.startDate, trip.endDate);
  const flights = flightStore.listByTrip(trip.id);
  const stays = accommodationStore.listByTrip(trip.id);
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
        ? html`<ul class="tl">${flights.map(flightRow)}</ul>`
        : html`<p class="muted">還沒有航班。</p>`}

      <div class="section-head section-head--spaced">
        <h3 class="section-head__title">住宿</h3>
        <button type="button" class="btn btn--small" data-action="add-stay">${icon("plus")}新增</button>
      </div>
      ${stays.length
        ? html`<ul class="tl">${stays.map(stayRow)}</ul>`
        : html`<p class="muted">還沒有住宿。</p>`}
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

  container.querySelector('[data-action="add-stay"]').addEventListener("click", () =>
    openAccommodationForm({ tripId: trip.id, onSaved: refresh })
  );
  container.querySelectorAll("[data-stay]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const stay = stays.find((s) => s.id === btn.dataset.stay);
      if (stay) openAccommodationDetail({ stay, onChanged: refresh });
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

/**
 * 時間軸列（2026-11-01 使用者選方案 B）：左邊大大的日期，中間分類圖示，右邊名稱／路線／時間。
 * 沒有日期時左邊顯示「未定」。
 */
const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
function dateCol(dateStr) {
  const d = parseDate(dateStr);
  if (!d) return html`<span class="tl__date is-empty"><b>—</b><small>未定</small></span>`;
  return html`<span class="tl__date"><b>${d.getDate()}</b><small>${d.getMonth() + 1}月・${WEEKDAYS[d.getDay()]}</small></span>`;
}

function flightRow(f) {
  const route = [airportName(f.departurePlaceId), airportName(f.arrivalPlaceId)].filter(Boolean).join(" → ");
  const times = [f.departureTime.slice(11, 16), f.arrivalTime.slice(11, 16)].filter(Boolean).join(" → ");
  const meta = [times, f.seat && `座位 ${f.seat}`].filter(Boolean).join(" · ");
  const dir = f.direction === "other" ? "" : directionLabel(f.direction);
  return html`
    <li>
      <button type="button" class="tl__row" data-flight="${f.id}">
        ${dateCol(f.departureTime.slice(0, 10))}
        <span class="tl__icon cat--transport">${icon("plane")}</span>
        <span class="tl__body">
          <span class="tl__title"><span class="tl__name">${flightTitle(f)}</span>${dir ? html`<span class="badge">${dir}</span>` : ""}</span>
          ${route ? html`<span class="tl__sub">${route}</span>` : ""}
          ${meta ? html`<span class="tl__meta">${meta}</span>` : ""}
        </span>
      </button>
    </li>
  `;
}

function stayRow(s) {
  const place = s.placeId ? placeStore.get(s.placeId) : null;
  const sub = [place && place.area, s.platform].filter(Boolean).join(" · ");
  const nights = nightsText(s);
  const out = s.checkOutDate ? `→ ${formatDateShort(s.checkOutDate)}` : "";
  const meta = [out, nights].filter(Boolean).join(" · ");
  return html`
    <li>
      <button type="button" class="tl__row" data-stay="${s.id}">
        ${dateCol(s.checkInDate)}
        <span class="tl__icon cat--hotel">${icon("hotel")}</span>
        <span class="tl__body">
          <span class="tl__title"><span class="tl__name">${stayTitle(s)}</span></span>
          ${sub ? html`<span class="tl__sub">${sub}</span>` : ""}
          ${meta ? html`<span class="tl__meta">${meta}</span>` : ""}
        </span>
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
