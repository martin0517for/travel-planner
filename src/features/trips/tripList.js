/**
 * tripList.js — 「我的旅程」列表頁。
 *
 * 排序：
 *   上方「即將出發」：進行中 → 即將出發（出發日近的在前）→ 日期未定
 *   下方「已結束」：最近結束的在前
 * 卡片樣式：登機證（左邊資訊，右邊黑色票根顯示倒數）
 */
import { html, render } from "../../core/html.js";
import { icon } from "../../core/icons.js";
import { tripStatus, formatRange } from "../../core/dates.js";
import { tripStore } from "../../data/trips.js";
import { openTripForm } from "./tripForm.js";
import { navigate } from "../../core/router.js";

export function renderTripList(container) {
  paint(container);
  return { eyebrow: "Trips", title: "我的旅程", back: null };
}

function paint(container) {
  const trips = tripStore.list().map((t) => ({ ...t, status: tripStatus(t.startDate, t.endDate) }));

  const order = { ongoing: 0, upcoming: 1, none: 2 };
  const active = trips
    .filter((t) => t.status.kind !== "ended")
    .sort((a, b) => order[a.status.kind] - order[b.status.kind] || (a.startDate || "").localeCompare(b.startDate || ""));
  const ended = trips
    .filter((t) => t.status.kind === "ended")
    .sort((a, b) => (b.endDate || b.startDate).localeCompare(a.endDate || a.startDate));

  render(
    container,
    html`
      ${trips.length === 0
        ? html`
            <div class="empty">
              <div class="empty__icon">${icon("plane")}</div>
              <h2>還沒有任何旅程</h2>
              <p>建立第一趟旅程，開始規劃行程、住宿與航班。</p>
              <button type="button" class="btn btn--primary" data-action="add">${icon("plus")}新增旅程</button>
            </div>
          `
        : html`
            <div class="section-head">
              <h2 class="section-head__title">即將出發</h2>
              <button type="button" class="btn btn--small" data-action="add">${icon("plus")}新增</button>
            </div>
            ${active.length
              ? html`<div class="trip-list">${active.map(tripCard)}</div>`
              : html`<p class="muted">目前沒有即將出發的旅程。</p>`}
            ${ended.length
              ? html`
                  <div class="section-head section-head--spaced">
                    <h2 class="section-head__title">已結束</h2>
                  </div>
                  <div class="trip-list trip-list--ended">${ended.map(tripCard)}</div>
                `
              : ""}
          `}
    `
  );

  container.querySelectorAll('[data-action="add"]').forEach((btn) =>
    btn.addEventListener("click", () =>
      openTripForm({ onSaved: (trip) => navigate(`/trips/${trip.id}`) })
    )
  );
}

function tripCard(trip) {
  return html`
    <a class="trip-card" href="#/trips/${trip.id}">
      <div class="trip-card__main">
        <div class="trip-card__name">${trip.name}</div>
        ${trip.destination ? html`<div class="trip-card__dest">${trip.destination}</div>` : ""}
        <div class="trip-card__dates">${formatRange(trip.startDate, trip.endDate)}</div>
      </div>
      <div class="trip-card__stub">${stubContent(trip.status)}</div>
    </a>
  `;
}

/** 票根上的大數字與小字 */
function stubContent(status) {
  switch (status.kind) {
    case "upcoming":
      return status.days === 0
        ? html`<span class="stub__big">GO</span><span class="stub__small">TODAY</span>`
        : html`<span class="stub__big">${status.days}</span><span class="stub__small">${status.days === 1 ? "DAY" : "DAYS"}</span>`;
    case "ongoing":
      return html`<span class="stub__small">DAY</span><span class="stub__big">${status.day}</span><span class="stub__small">OF ${status.total}</span>`;
    case "ended":
      return html`<span class="stub__small">DONE</span>`;
    default:
      return html`<span class="stub__big">—</span><span class="stub__small">TBD</span>`;
  }
}
