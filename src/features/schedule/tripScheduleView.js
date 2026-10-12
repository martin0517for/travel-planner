/**
 * 每日行程 Timeline（#/trips/:id/schedule）。這個檔案邏輯比較多，重點：
 *   - 依 Trip 的起訖日自動產生 Day 1, Day 2… 分頁（buildDateRange）
 *   - 每天的行程項目存在 DayPlan.items 陣列裡，順序就是顯示順序
 *     （手動排序＝直接交換陣列位置，見 dayPlanService.moveItem）
 *   - 當天有關聯的航班／住宿會額外「釘」在最上面/最下面顯示（itinerary-pin），
 *     這兩種是唯讀展示，不算在 DayPlan.items 裡，也不能手動排序
 */
import { tripService } from "../../services/tripService.js";
import { dayPlanService } from "../../services/dayPlanService.js";
import { flightService } from "../../services/flightService.js";
import { accommodationService } from "../../services/accommodationService.js";
import { buildDateRange, ITEM_CATEGORIES } from "../../data/models/DayPlan.js";
import { openItineraryItemForm } from "./itineraryItemFormView.js";
import { openPlaceDetailView } from "../places/placeDetailView.js";
import { openFlightDetailView } from "../flights/flightDetailView.js";
import { openAccommodationDetailView } from "../accommodations/accommodationDetailView.js";

export function renderTripScheduleView(container, params) {
  const wrapper = document.createElement("div");
  container.appendChild(wrapper);

  const trip = tripService.getTrip(params.id);
  if (!trip) {
    wrapper.innerHTML = `
      <a href="#/trips" class="back-link">← 返回我的旅程</a>
      <div class="empty-state"><h2>找不到這趟旅程</h2></div>
    `;
    return;
  }

  const titleEl = document.getElementById("topbar-title");
  const eyebrowEl = document.getElementById("topbar-eyebrow");
  if (titleEl) titleEl.textContent = `${trip.destination || trip.name} · 行程`;
  if (eyebrowEl) eyebrowEl.textContent = "SCHEDULE";

  const dates = buildDateRange(trip.startDate, trip.endDate);

  if (dates.length === 0) {
    wrapper.innerHTML = `
      <a href="#/trips/${trip.id}" class="back-link">← 返回旅程詳情</a>
      <div class="empty-state">
        <h2>尚未設定完整日期</h2>
        <p>請先到旅程詳情頁編輯出發與結束日期，才能建立每日行程。</p>
      </div>
    `;
    return;
  }

  let activeDate = dates[0];
  paint(wrapper, trip, dates, activeDate);
}

function paint(wrapper, trip, dates, activeDate) {
  const items = dayPlanService.getItems(trip.id, activeDate);
  const accommodation = dayPlanService.getAccommodationForDate(trip.id, activeDate);

  // 當天有關聯的航班（出發或抵達落在這天）固定排最上面；
  // 當天有入住或退房的住宿固定排最下面。中間才是使用者手動排序的行程項目。
  const flightsToday = flightService
    .listByTrip(trip.id)
    .filter((f) => matchesDate(f.departureTime, activeDate) || matchesDate(f.arrivalTime, activeDate));
  const staysToday = accommodationService
    .listByTrip(trip.id)
    .filter((a) => a.checkIn === activeDate || a.checkOut === activeDate);

  const isEmpty = items.length === 0 && flightsToday.length === 0 && staysToday.length === 0;

  wrapper.innerHTML = `
    <a href="#/trips/${trip.id}" class="back-link">← 返回旅程詳情</a>

    <div class="day-tabs">
      ${dates
        .map(
          (d, i) => `<button class="day-tab ${d === activeDate ? "is-active" : ""}" data-date="${d}">Day ${i + 1}<span>${formatShortDate(d)}</span></button>`
        )
        .join("")}
    </div>

    <div class="perforation" style="margin: var(--space-4) 0;"></div>

    <div class="section-header">
      <h3>${formatFullDate(activeDate)}</h3>
      <button class="btn btn--ghost" data-action="add-item">＋ 新增項目</button>
    </div>

    ${
      accommodation
        ? `<div class="stay-band">🛏 入住：${escapeHtml(accommodation.place ? accommodation.place.name : "地點已刪除")}</div>`
        : ""
    }

    <div id="items-slot">
      ${isEmpty ? `<p class="section-empty">這天還沒有安排行程。</p>` : ""}
      ${flightsToday.map(flightPinHtml).join("")}
      ${items.map((item, i) => itemHtml(item, i, items.length)).join("")}
      ${staysToday.map((a) => stayPinHtml(a, activeDate)).join("")}
    </div>
  `;

  wrapper.querySelectorAll(".day-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      paint(wrapper, trip, dates, tab.dataset.date);
    });
  });

  wrapper.querySelector('[data-action="add-item"]').addEventListener("click", () => {
    openItineraryItemForm({
      tripId: trip.id,
      date: activeDate,
      onSaved: () => paint(wrapper, trip, dates, activeDate),
    });
  });

  // 點行程項目主要內容（地點名稱那一塊）：開啟地點詳情（唯讀，含網站/Maps/備註）
  wrapper.querySelectorAll("[data-action='view-place']").forEach((el) => {
    el.addEventListener("click", () => {
      const item = items.find((it) => it.id === el.dataset.id);
      if (!item || !item.place) return;
      openPlaceDetailView({
        place: item.place,
        onEdited: () => paint(wrapper, trip, dates, activeDate),
      });
    });
  });

  // Maps 連結自己會開新分頁，不要再觸發上面的「查看地點詳情」
  wrapper.querySelectorAll(".maps-link").forEach((a) => {
    a.addEventListener("click", (e) => e.stopPropagation());
  });

  wrapper.querySelectorAll("[data-action='edit-item']").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const item = items.find((it) => it.id === btn.dataset.id);
      openItineraryItemForm({
        tripId: trip.id,
        date: activeDate,
        existingItem: item,
        onSaved: () => paint(wrapper, trip, dates, activeDate),
      });
    });
  });

  wrapper.querySelectorAll("[data-action='delete-item']").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (confirm("確定要刪除這個行程項目嗎？")) {
        dayPlanService.deleteItem(trip.id, activeDate, btn.dataset.id);
        paint(wrapper, trip, dates, activeDate);
      }
    });
  });

  wrapper.querySelectorAll("[data-action='move-up']").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      dayPlanService.moveItem(trip.id, activeDate, btn.dataset.id, "up");
      paint(wrapper, trip, dates, activeDate);
    });
  });
  wrapper.querySelectorAll("[data-action='move-down']").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      dayPlanService.moveItem(trip.id, activeDate, btn.dataset.id, "down");
      paint(wrapper, trip, dates, activeDate);
    });
  });

  // 固定在最上面的航班／最下面的住宿：點擊先看唯讀詳情，詳情裡才有編輯按鈕
  wrapper.querySelectorAll("[data-action='view-flight-pin']").forEach((el) => {
    el.addEventListener("click", () => {
      const flight = flightsToday.find((f) => f.id === el.dataset.id);
      if (!flight) return;
      openFlightDetailView({
        tripId: trip.id,
        flight,
        onEdited: () => paint(wrapper, trip, dates, activeDate),
      });
    });
  });
  wrapper.querySelectorAll("[data-action='view-stay-pin']").forEach((el) => {
    el.addEventListener("click", () => {
      const accom = staysToday.find((a) => a.id === el.dataset.id);
      if (!accom) return;
      openAccommodationDetailView({
        tripId: trip.id,
        accommodation: accom,
        onEdited: () => paint(wrapper, trip, dates, activeDate),
      });
    });
  });
}

function itemHtml(item, index, total) {
  const meta = ITEM_CATEGORIES.find((c) => c.value === item.category) || ITEM_CATEGORIES[ITEM_CATEGORIES.length - 1];
  const placeName = item.place ? item.place.name : "（地點已刪除）";
  const mapsUrl = item.place ? item.place.googleMapsUrl : "";
  return `
    <div class="itinerary-item">
      <div class="itinerary-item__order">
        <button class="reorder-btn" data-action="move-up" data-id="${item.id}" ${index === 0 ? "disabled" : ""} aria-label="上移">▲</button>
        <button class="reorder-btn" data-action="move-down" data-id="${item.id}" ${index === total - 1 ? "disabled" : ""} aria-label="下移">▼</button>
      </div>

      <div class="itinerary-item__time">
        ${item.time ? `<span class="itinerary-item__time-value">${item.time}</span>` : `<span class="itinerary-item__time-value itinerary-item__time-value--empty">--:--</span>`}
        <span class="itinerary-item__time-icon">${meta.icon}</span>
      </div>

      <div class="itinerary-item__main" data-action="view-place" data-id="${item.id}" role="button" tabindex="0">
        <div class="itinerary-item__title">${escapeHtml(placeName)}</div>
        <div class="itinerary-item__sub">
          <span class="itinerary-item__tag" style="--tag-color: ${meta.color}; --tag-color-dark: ${meta.colorDark};">${meta.label}</span>
          ${item.notes ? `<span>${escapeHtml(item.notes)}</span>` : ""}
          ${mapsUrl ? `<a class="maps-link" href="${escapeAttr(mapsUrl)}" target="_blank" rel="noopener noreferrer">📍 導航</a>` : ""}
        </div>
      </div>

      <div class="record-item__actions">
        <button class="trip-card__icon-btn" data-action="edit-item" data-id="${item.id}" aria-label="編輯">✎</button>
        <button class="trip-card__icon-btn" data-action="delete-item" data-id="${item.id}" aria-label="刪除">🗑</button>
      </div>
    </div>
  `;
}

function flightPinHtml(flight) {
  const dep = flight.departurePlace ? flight.departurePlace.name : "未指定地點";
  const arr = flight.arrivalPlace ? flight.arrivalPlace.name : "未指定地點";
  return `
    <div class="itinerary-pin itinerary-pin--flight" data-action="view-flight-pin" data-id="${flight.id}" role="button" tabindex="0">
      <div class="itinerary-pin__tag">✈ 航班</div>
      <div class="itinerary-pin__main">
        <div class="itinerary-pin__title">${escapeHtml(flight.airline)} ${escapeHtml(flight.flightNo)}</div>
        <div class="itinerary-pin__line">出發：${escapeHtml(dep)} ${formatDT(flight.departureTime)}</div>
        <div class="itinerary-pin__line">抵達：${escapeHtml(arr)} ${formatDT(flight.arrivalTime)}</div>
      </div>
    </div>
  `;
}

function stayPinHtml(accom, activeDate) {
  const placeName = accom.place ? accom.place.name : "地點已刪除";
  const stage = accom.checkIn === activeDate ? "入住" : accom.checkOut === activeDate ? "退房" : "住宿中";
  return `
    <div class="itinerary-pin itinerary-pin--stay" data-action="view-stay-pin" data-id="${accom.id}" role="button" tabindex="0">
      <div class="itinerary-pin__tag">🛏 ${stage}</div>
      <div class="itinerary-pin__main">
        <div class="itinerary-pin__title">${escapeHtml(placeName)}</div>
        <div class="itinerary-pin__line">${accom.checkIn || "—"} → ${accom.checkOut || "—"}</div>
      </div>
    </div>
  `;
}

function matchesDate(datetimeLocal, date) {
  return !!datetimeLocal && datetimeLocal.slice(0, 10) === date;
}

function formatDT(value) {
  if (!value) return "—";
  return value.replace("T", " ");
}

function formatShortDate(dateStr) {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatFullDate(dateStr) {
  const d = new Date(dateStr);
  const weekday = ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
  return `${dateStr}（週${weekday}）`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function escapeAttr(str) {
  return String(str || "").replace(/"/g, "&quot;");
}
