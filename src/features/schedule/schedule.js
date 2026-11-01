/**
 * schedule.js — 旅程內的「行程」頁籤：每日行程 Timeline（⑤，2026-11-01）。
 *
 * 版面（由上到下）：
 *   提示（沒有日期的旅程／有行程在旅程日期外）
 *   Day 分頁（Day 1＋短日期，可以左右捲動；沒日期的旅程最後有「＋」新增一天）
 *   這一天的標題＋右邊「排序」（按了才顯示 ▲▼，再按「完成」收起）
 *   色帶「入住：飯店名」（這晚住哪裡）
 *   Timeline：行程項目、航班、退房／入住、活動，全部手動排序
 *   「＋ 新增行程」
 *
 * 點任何一列先開預覽（行程項目、航班、住宿、活動各自的預覽），預覽裡再按「編輯」。
 * 旅程進行中時，第一次打開這趟旅程的行程頁會自動跳到今天。
 * 目前看哪一天、是否在排序，存在這個檔案的變數裡；換到別趟旅程時重置。
 */
import { html, render } from "../../core/html.js";
import { icon } from "../../core/icons.js";
import { navigationUrl } from "../../core/geo.js";
import { formatDateShort } from "../../core/dates.js";
import { navigate } from "../../core/router.js";
import { dayPlanStore, LIMITS } from "../../data/dayPlans.js";
import { placeStore, categoryLabel } from "../../data/places.js";
import { directionLabel } from "../../data/flights.js";
import { tripDays, dayContent, outOfRangePlans } from "./timeline.js";
import { openItemForm, kindIcon, dayLabel } from "./itemForm.js";
import { openItemDetail, itemTitle } from "./itemDetail.js";
import { openOutOfRange } from "./outOfRange.js";
import { openTripForm } from "../trips/tripForm.js";
import { openFlightDetail, flightTitle, airportName } from "../flights/flightDetail.js";
import { openAccommodationDetail, stayTitle } from "../accommodations/accommodationDetail.js";
import { openActivityDetail } from "../activities/activityDetail.js";

const state = { tripId: "", day: 1, sorting: false };

export function renderSchedule(container, trip, refresh) {
  const info = tripDays(trip);
  if (state.tripId !== trip.id) {
    // 換到這趟旅程：進行中就跳到今天，否則 Day 1
    Object.assign(state, { tripId: trip.id, day: info.todayDay || 1, sorting: false });
  }
  if (state.day > info.days.length) state.day = info.days.length;
  if (state.day < 1) state.day = 1;
  paint(container, trip, refresh);
}

function paint(container, trip, refresh) {
  const info = tripDays(trip);
  const dayInfo = info.days[state.day - 1];
  const { entries, bands } = dayContent(trip, dayInfo.day, dayInfo.date);
  const extra = outOfRangePlans(trip, info);
  const plan = dayPlanStore.get(trip.id, dayInfo.day);
  const isLastUndated = !info.dated && dayInfo.day === info.days.length && dayInfo.day > 1;
  const canRemoveDay = isLastUndated && !(plan && plan.items.length);
  if (entries.length < 2) state.sorting = false;
  const sorting = state.sorting;

  // 重畫前記住 Day 分頁左右捲到哪裡（會整頁重畫的畫面要保留捲動位置）
  const oldTabs = container.querySelector(".day-tabs");
  const tabScroll = oldTabs ? oldTabs.scrollLeft : null;

  const repaint = () => paint(container, trip, refresh);
  const goDay = (day) => {
    if (day) state.day = day;
    refresh();
  };

  render(
    container,
    html`
      ${!info.dated
        ? html`
            <div class="sch-notice">
              <span>旅程還沒有日期：先用 Day 1、Day 2 排。設定日期後，航班、住宿、活動會自動放進當天。</span>
              <button type="button" class="btn btn--small" data-action="set-dates">設定日期</button>
            </div>
          `
        : ""}
      ${extra.length
        ? html`
            <div class="sch-notice sch-notice--warn">
              ${icon("warning")}
              <span>有 ${extra.length} 天的行程在旅程日期外（${extra.map((p) => `Day ${p.day}`).join("、")}），目前不會顯示。</span>
              <button type="button" class="btn btn--small" data-action="out-of-range">處理</button>
            </div>
          `
        : ""}

      <div class="day-tabs" role="tablist" aria-label="第幾天">
        ${info.days.map(
          (d) => html`
            <button type="button" role="tab" class="day-tab ${d.day === dayInfo.day ? "is-active" : ""}"
                    aria-selected="${d.day === dayInfo.day ? "true" : "false"}" data-day="${d.day}">
              <b>Day ${d.day}</b>
              ${d.date ? html`<small>${formatDateShort(d.date)}</small>` : ""}
              ${d.day === info.todayDay ? html`<span class="day-tab__today">今天</span>` : ""}
            </button>
          `
        )}
        ${!info.dated && info.days.length < LIMITS.undatedDays
          ? html`<button type="button" class="day-tab day-tab--add" data-action="add-day" aria-label="新增一天">${icon("plus")}</button>`
          : ""}
      </div>

      <div class="sch-head">
        <div class="sch-head__title">
          <h2>Day ${dayInfo.day}</h2>
          ${dayInfo.date ? html`<span class="sch-head__date">${formatDateShort(dayInfo.date, true)}</span>` : ""}
        </div>
        ${canRemoveDay ? html`<button type="button" class="btn btn--small" data-action="remove-day">刪除這天</button>` : ""}
        ${entries.length >= 2
          ? html`<button type="button" class="btn btn--small ${sorting ? "btn--primary" : ""}" data-action="sort">${sorting ? "完成" : "排序"}</button>`
          : ""}
      </div>
      ${sorting ? html`<p class="field__hint">用 ▲▼ 調整順序，好了按「完成」。</p>` : ""}

      ${bands.map(
        (b) => html`
          <button type="button" class="sch-band cat--hotel" data-stay="${b.stay.id}">
            ${icon("hotel")}<span>入住：${stayTitle(b.stay)}</span>
          </button>
        `
      )}

      ${entries.length
        ? html`<ol class="sch ${sorting ? "is-sorting" : ""}">${entries.map((e, i) => row(e, i, entries.length, sorting))}</ol>`
        : html`<p class="muted sch-empty">這天還沒有安排。</p>`}

      ${sorting
        ? ""
        : html`<button type="button" class="btn btn--ghost btn--block sch-add" data-action="add">${icon("plus")}新增行程</button>`}
    `
  );

  // Day 分頁：還原左右位置；目前這天沒有完整露出時捲到看得見
  const tabs = container.querySelector(".day-tabs");
  if (tabScroll !== null) tabs.scrollLeft = tabScroll;
  const active = tabs.querySelector(".day-tab.is-active");
  if (active) {
    const left = active.offsetLeft - tabs.offsetLeft;
    if (left < tabs.scrollLeft) tabs.scrollLeft = Math.max(0, left - 16);
    else if (left + active.offsetWidth > tabs.scrollLeft + tabs.clientWidth) {
      tabs.scrollLeft = left + active.offsetWidth - tabs.clientWidth + 16;
    }
  }

  tabs.querySelectorAll("[data-day]").forEach((btn) =>
    btn.addEventListener("click", () => {
      state.day = Number(btn.dataset.day);
      state.sorting = false;
      repaint();
    })
  );

  const on = (sel, fn) => {
    const el = container.querySelector(sel);
    if (el) el.addEventListener("click", fn);
  };

  on('[data-action="set-dates"]', () =>
    openTripForm({ trip, onSaved: () => goDay(), onDeleted: () => navigate("/trips") })
  );
  on('[data-action="out-of-range"]', () => openOutOfRange({ trip, onChanged: () => goDay() }));
  on('[data-action="add-day"]', () => {
    const next = info.days.length + 1;
    const result = dayPlanStore.addDay(trip.id, next);
    if (!result.ok) return window.alert(result.errors.join("\n"));
    state.day = next;
    state.sorting = false;
    repaint();
  });
  on('[data-action="remove-day"]', () => {
    if (!window.confirm(`確定要刪除 Day ${dayInfo.day} 嗎？`)) return;
    const result = dayPlanStore.removeDay(trip.id, dayInfo.day);
    if (!result.ok) return window.alert(result.errors.join("\n"));
    state.day = dayInfo.day - 1;
    repaint();
  });
  on('[data-action="sort"]', () => {
    state.sorting = !state.sorting;
    repaint();
  });
  on('[data-action="add"]', () =>
    openItemForm({ trip, day: dayInfo.day, onSaved: (_, toDay) => goDay(toDay) })
  );

  // 色帶：點了開住宿預覽
  container.querySelectorAll(".sch-band").forEach((btn) =>
    btn.addEventListener("click", () => {
      const band = bands.find((b) => b.stay.id === btn.dataset.stay);
      if (band) openAccommodationDetail({ stay: band.stay, onChanged: () => goDay() });
    })
  );

  // 點一列 → 開預覽（排序中不開，避免誤觸）
  container.querySelectorAll("[data-open]").forEach((btn) =>
    btn.addEventListener("click", () => {
      if (state.sorting) return;
      const entry = entries[Number(btn.dataset.open)];
      if (entry) openEntry(entry, { trip, dayInfo, goDay });
    })
  );

  // ▲▼：跟上一個／下一個交換，存下整天的順序
  container.querySelectorAll("[data-move]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const i = Number(btn.dataset.index);
      const j = btn.dataset.move === "up" ? i - 1 : i + 1;
      if (j < 0 || j >= entries.length) return;
      const refs = entries.map((e) => e.ref);
      [refs[i], refs[j]] = [refs[j], refs[i]];
      const result = dayPlanStore.setOrder(trip.id, dayInfo.day, refs);
      if (!result.ok) return window.alert(result.errors.join("\n"));
      const scrollY = window.scrollY;
      repaint();
      window.scrollTo(0, scrollY);
      // 焦點留在同一個項目的同一顆按鈕上，連續點比較順
      const again = container.querySelector(`[data-move="${btn.dataset.move}"][data-index="${j}"]`);
      if (again && !again.disabled) again.focus({ preventScroll: true });
    })
  );
}

function openEntry(entry, { trip, dayInfo, goDay }) {
  const onChanged = (toDay) => goDay(typeof toDay === "number" ? toDay : undefined);
  switch (entry.kind) {
    case "item":
      return openItemDetail({ trip, dayInfo, item: entry.data, onChanged });
    case "flight":
      return openFlightDetail({ flight: entry.data, onChanged });
    case "checkin":
    case "checkout":
      return openAccommodationDetail({ stay: entry.data, onChanged });
    case "activity":
      return openActivityDetail({ activity: entry.data, onChanged });
  }
}

/** Timeline 的一列：左邊時間、圖示、名稱＋第 2 行；右邊導航（排序中改成 ▲▼） */
function row(entry, index, total, sorting) {
  const v = view(entry);
  return html`
    <li class="sch-row ${entry.kind === "item" ? "" : "is-auto"}">
      <button type="button" class="sch-row__main" data-open="${index}">
        <span class="sch-row__time ${v.time ? "" : "is-empty"}">${v.time || "--:--"}</span>
        <span class="tl__icon ${v.cat}">${icon(v.icon)}</span>
        <span class="tl__body">
          <span class="tl__title">
            <span class="tl__name">${v.title}</span>
            ${v.badge ? html`<span class="badge ${v.badgeCat || ""}">${v.badge}</span>` : ""}
          </span>
          ${v.sub ? html`<span class="tl__sub">${v.sub}</span>` : ""}
          ${v.meta ? html`<span class="sch-row__meta">${v.meta}</span>` : ""}
        </span>
      </button>
      ${sorting
        ? html`
            <span class="sch-row__sort">
              <button type="button" class="act-place__btn" data-move="up" data-index="${index}" aria-label="往上移"
                      ${index === 0 ? html`disabled` : ""}>${icon("up")}</button>
              <button type="button" class="act-place__btn" data-move="down" data-index="${index}" aria-label="往下移"
                      ${index === total - 1 ? html`disabled` : ""}>${icon("down")}</button>
            </span>
          `
        : v.nav
          ? html`<a class="sch-row__nav" href="${v.nav}" target="_blank" rel="noopener noreferrer" aria-label="導航到${v.title}">${icon("navigate")}</a>`
          : ""}
    </li>
  `;
}

/** 每種項目在 Timeline 上的樣子 */
function view(entry) {
  const d = entry.data;
  switch (entry.kind) {
    case "item": {
      const place = d.placeId ? placeStore.get(d.placeId) : null;
      const meta = [d.transport && `→ ${d.transport}`, d.notes && firstLine(d.notes)].filter(Boolean).join("・");
      if (d.placeId) {
        return {
          time: d.time,
          title: itemTitle(d),
          icon: place ? place.category : "pin",
          cat: place ? `cat--${place.category}` : "cat--kind",
          badge: place ? categoryLabel(place.category) : "",
          badgeCat: place ? `cat--${place.category}` : "",
          sub: d.text,
          meta,
          nav: place ? navigationUrl(place) : null,
        };
      }
      return { time: d.time, title: d.text, icon: kindIcon(d.kind), cat: "cat--kind", meta };
    }
    case "flight": {
      const route = [airportName(d.departurePlaceId), airportName(d.arrivalPlaceId)].filter(Boolean).join(" → ");
      // 跨日抵達時寫出抵達日期（抵達那天不會再顯示這個航班）
      const sameDay = d.arrivalTime.slice(0, 10) === d.departureTime.slice(0, 10);
      const arrive = d.arrivalTime ? `抵達 ${sameDay ? "" : formatDateShort(d.arrivalTime.slice(0, 10)) + " "}${d.arrivalTime.slice(11, 16)}` : "";
      return {
        time: entry.time,
        title: flightTitle(d),
        icon: "plane",
        cat: "cat--transport",
        badge: d.direction === "other" ? "" : directionLabel(d.direction),
        sub: route,
        meta: arrive,
      };
    }
    case "checkout":
    case "checkin": {
      const place = d.placeId ? placeStore.get(d.placeId) : null;
      return {
        time: entry.time,
        title: `${entry.kind === "checkin" ? "入住" : "退房"}：${stayTitle(d)}`,
        icon: "hotel",
        cat: "cat--hotel",
        sub: place && place.area,
        nav: place ? navigationUrl(place) : null,
      };
    }
    case "activity": {
      const n = d.placeIds.length;
      const lastDay = entry.total > 1 && entry.nth === entry.total;
      // 結束時間：一天的活動、或一段日期的最後一天才顯示
      const meta = (entry.total === 1 || lastDay) && d.endTime ? `${d.endTime} 結束` : "";
      return {
        time: entry.allDay ? "整天" : entry.time,
        title: d.title,
        icon: "ticket",
        cat: "cat--attraction",
        badge: entry.total > 1 ? `第 ${entry.nth} 天／共 ${entry.total} 天` : "",
        sub: n ? `${n} 個地點` : "",
        meta,
      };
    }
  }
  return { title: "" };
}

function firstLine(text) {
  return text.trim().split(/\r?\n/)[0];
}

export { dayLabel };
