/**
 * 旅程總覽頁（進到一趟旅程後的「總覽」分頁）：顯示這趟旅程的航班、住宿，
 * 也是「詳情頁」的範例寫法。跟列表頁（tripListView.js）的差異是：
 * 這裡從網址參數 params.id 知道要顯示「哪一趟」旅程，
 * 資料存不存在（trip 是 null）要多處理一種畫面。
 */
import { tripService } from "../../services/tripService.js";
import { flightService } from "../../services/flightService.js";
import { accommodationService } from "../../services/accommodationService.js";
import { openFlightForm } from "../flights/flightFormView.js";
import { openAccommodationForm } from "../accommodations/accommodationFormView.js";
import { openFlightDetailView } from "../flights/flightDetailView.js";
import { openAccommodationDetailView } from "../accommodations/accommodationDetailView.js";
import { openTripShareForm } from "./tripShareView.js";

export function renderTripDetailView(container, params) {
  const wrapper = document.createElement("div");
  container.appendChild(wrapper);
  paint(wrapper, params.id);
}

function paint(wrapper, tripId) {
  const trip = tripService.getTrip(tripId);

  if (!trip) {
    wrapper.innerHTML = `
      <a href="#/trips" class="back-link">← 返回我的旅程</a>
      <div class="empty-state"><h2>找不到這趟旅程</h2><p>它可能已經被刪除了。</p></div>
    `;
    return;
  }

  // 讓頂部標題顯示這趟旅程的目的地
  const titleEl = document.getElementById("topbar-title");
  const eyebrowEl = document.getElementById("topbar-eyebrow");
  if (titleEl) titleEl.textContent = trip.destination || trip.name;
  if (eyebrowEl) eyebrowEl.textContent = "TRIP";

  const flights = flightService.listByTrip(tripId);
  const accommodations = accommodationService.listByTrip(tripId);

  wrapper.innerHTML = `
    <a href="#/trips" class="back-link">← 返回我的旅程</a>

    <div class="trip-detail-header">
      <div class="trip-detail-header__row">
        <h2>${escapeHtml(trip.name)}</h2>
        <button class="btn btn--ghost" data-action="share-trip">🔗 分享</button>
      </div>
      <div class="trip-detail-header__dates">${trip.startDate || "—"} → ${trip.endDate || "—"}</div>
    </div>

    <div class="perforation"></div>

    <div class="section-header">
      <h3>✈ 航班</h3>
      <button class="btn btn--ghost" data-action="add-flight">＋ 新增航班</button>
    </div>
    <div id="flights-slot">
      ${
        flights.length === 0
          ? `<p class="section-empty">還沒有航班資料。</p>`
          : flights.map(flightItemHtml).join("")
      }
    </div>

    <div class="perforation"></div>

    <div class="section-header">
      <h3>🛏 住宿</h3>
      <button class="btn btn--ghost" data-action="add-accommodation">＋ 新增住宿</button>
    </div>
    <div id="accommodations-slot">
      ${
        accommodations.length === 0
          ? `<p class="section-empty">還沒有住宿資料。</p>`
          : accommodations.map(accommodationItemHtml).join("")
      }
    </div>

    <div class="perforation"></div>
    <a href="#/places" class="back-link">管理地點資料庫 →</a>
  `;

  wrapper.querySelector('[data-action="share-trip"]').addEventListener("click", () => {
    openTripShareForm({ tripId, tripName: trip.name });
  });

  wrapper.querySelector('[data-action="add-flight"]').addEventListener("click", () => {
    openFlightForm({ tripId, onSaved: () => paint(wrapper, tripId) });
  });

  wrapper.querySelector('[data-action="add-accommodation"]').addEventListener("click", () => {
    openAccommodationForm({ tripId, onSaved: () => paint(wrapper, tripId) });
  });

  wrapper.querySelectorAll("[data-action='edit-flight']").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const flight = flightService.getFlight(btn.dataset.id);
      openFlightForm({ tripId, existingFlight: flight, onSaved: () => paint(wrapper, tripId) });
    });
  });
  wrapper.querySelectorAll("[data-action='delete-flight']").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (confirm("確定要刪除這筆航班嗎？")) {
        flightService.deleteFlight(btn.dataset.id);
        paint(wrapper, tripId);
      }
    });
  });
  // 點航班內容區塊：先看唯讀預覽，預覽裡才有「編輯」按鈕
  wrapper.querySelectorAll("[data-action='view-flight']").forEach((el) => {
    el.addEventListener("click", () => {
      const flight = flights.find((f) => f.id === el.dataset.id);
      if (!flight) return;
      openFlightDetailView({ tripId, flight, onEdited: () => paint(wrapper, tripId) });
    });
  });

  wrapper.querySelectorAll("[data-action='edit-accommodation']").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const accom = accommodationService.getAccommodation(btn.dataset.id);
      openAccommodationForm({ tripId, existingAccommodation: accom, onSaved: () => paint(wrapper, tripId) });
    });
  });
  wrapper.querySelectorAll("[data-action='delete-accommodation']").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (confirm("確定要刪除這筆住宿嗎？")) {
        accommodationService.deleteAccommodation(btn.dataset.id);
        paint(wrapper, tripId);
      }
    });
  });
  // 點住宿內容區塊：先看唯讀預覽，預覽裡才有「編輯」按鈕
  wrapper.querySelectorAll("[data-action='view-accommodation']").forEach((el) => {
    el.addEventListener("click", () => {
      const accom = accommodations.find((a) => a.id === el.dataset.id);
      if (!accom) return;
      openAccommodationDetailView({ tripId, accommodation: accom, onEdited: () => paint(wrapper, tripId) });
    });
  });
}

function flightItemHtml(flight) {
  const dep = flight.departurePlace ? flight.departurePlace.name : "未指定地點";
  const arr = flight.arrivalPlace ? flight.arrivalPlace.name : "未指定地點";
  return `
    <div class="record-item">
      <div class="record-item__main" data-action="view-flight" data-id="${flight.id}" role="button" tabindex="0">
        <div class="record-item__title">${escapeHtml(flight.airline)} ${escapeHtml(flight.flightNo)}</div>
        <div class="record-item__sub">
          <div>出發：${escapeHtml(dep)} ${formatDT(flight.departureTime)}</div>
          <div>抵達：${escapeHtml(arr)} ${formatDT(flight.arrivalTime)}</div>
        </div>
      </div>
      <div class="record-item__actions">
        <button class="trip-card__icon-btn" data-action="edit-flight" data-id="${flight.id}" aria-label="編輯">✎</button>
        <button class="trip-card__icon-btn" data-action="delete-flight" data-id="${flight.id}" aria-label="刪除">🗑</button>
      </div>
    </div>
  `;
}

function accommodationItemHtml(accom) {
  const placeName = accom.place ? accom.place.name : "地點已刪除";
  return `
    <div class="record-item">
      <div class="record-item__main" data-action="view-accommodation" data-id="${accom.id}" role="button" tabindex="0">
        <div class="record-item__title">${escapeHtml(placeName)}</div>
        <div class="record-item__sub">${accom.checkIn || "—"} → ${accom.checkOut || "—"}${accom.confirmationNo ? " · 確認碼 " + escapeHtml(accom.confirmationNo) : ""}</div>
      </div>
      <div class="record-item__actions">
        <button class="trip-card__icon-btn" data-action="edit-accommodation" data-id="${accom.id}" aria-label="編輯">✎</button>
        <button class="trip-card__icon-btn" data-action="delete-accommodation" data-id="${accom.id}" aria-label="刪除">🗑</button>
      </div>
    </div>
  `;
}

function formatDT(value) {
  if (!value) return "—";
  return value.replace("T", " ");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
