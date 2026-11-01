/**
 * scheduleLinks.js — 航班、住宿、活動跟「行程」之間的連動（v0.8.3，使用者決定）。
 *
 * 規則
 *   - 有日期的：照日期自動出現在行程頁（航班：出發那天；住宿：入住卡、退房卡；活動：每一天）。
 *     在行程頁按「從行程移除」只拿掉「這一天的這張卡」，記在那天 DayPlan.hidden；本身不改，總覽頁照常顯示。
 *     總覽頁的預覽按「加入行程」→ 清掉所有天的移除紀錄，自動放回它日期的那幾天（預設位置）。
 *   - 沒有日期的：從行程頁（或總覽頁的「排進行程」）排進某天，記在那天 DayPlan.placed。
 *     活動、住宿可以排在好幾天；航班只能排一天（選別天＝搬過去）。「從行程移除」＝從那天拿掉。
 *   - 之後填了日期 → 「排進來」的紀錄全部清掉，改照日期出現（表單存檔後呼叫 afterSaved）。
 *   - 在「新增行程 → 總覽項目」選了有日期、但在別天的 → 確認後把日期改到這天（時間不變、天數不變）。
 *
 * kind：flight｜stay｜activity
 */
import { html } from "../../core/html.js";
import { icon } from "../../core/icons.js";
import { openSheet } from "../../core/sheet.js";
import { formatDateShort, addDays, parseDate, daysBetween } from "../../core/dates.js";
import { tripStore } from "../../data/trips.js";
import { dayPlanStore } from "../../data/dayPlans.js";
import { flightStore } from "../../data/flights.js";
import { accommodationStore } from "../../data/accommodations.js";
import { activityStore, daysOf } from "../../data/activities.js";
import { tripDays, isDated, placedRef, orderWithNewItem } from "./timeline.js";

export { isDated };

/** 這個項目可能用到的所有引用（清除紀錄用） */
export function allRefs(kind, obj) {
  if (kind === "flight") return [`f:${obj.id}`];
  if (kind === "stay") return [`s:${obj.id}`, `si:${obj.id}`, `so:${obj.id}`];
  return [`a:${obj.id}`];
}

/** 「Day 2・12-02（三）」 */
export function dayText(d) {
  return d.date ? `Day ${d.day}・${formatDateShort(d.date)}` : `Day ${d.day}`;
}

/**
 * 有日期的項目在旅程期間內出現在哪幾天 → [{ day, date, refs, hidden }]
 *   hidden：這天的卡全部被「從行程移除」了
 */
export function datedDays(trip, kind, obj, info = tripDays(trip)) {
  if (!info.dated) return [];
  const byDate = new Map(info.days.map((d) => [d.date, d]));
  const hits = new Map(); // day → { day, date, refs }
  const add = (date, ref) => {
    const d = date && byDate.get(date);
    if (!d) return;
    if (!hits.has(d.day)) hits.set(d.day, { day: d.day, date: d.date, refs: [] });
    hits.get(d.day).refs.push(ref);
  };
  if (kind === "flight") add(obj.departureTime.slice(0, 10), `f:${obj.id}`);
  else if (kind === "stay") {
    add(obj.checkInDate, `si:${obj.id}`);
    add(obj.checkOutDate, `so:${obj.id}`);
  } else if (obj.startDate) {
    const n = daysOf(obj) || 1;
    for (let i = 0; i < n; i++) add(addDays(obj.startDate, i), `a:${obj.id}`);
  }
  return [...hits.values()]
    .sort((a, b) => a.day - b.day)
    .map((h) => {
      const plan = dayPlanStore.get(trip.id, h.day);
      const hidden = Boolean(plan) && h.refs.every((r) => plan.hidden.includes(r));
      return { ...h, hidden };
    });
}

/**
 * 在行程裡的狀態：
 *   { type: "tripUndated" }        有日期，但旅程沒有日期（設定日期後才會出現）
 *   { type: "outside" }            有日期，但在旅程期間外
 *   { type: "dated", days }        有日期，在旅程期間內（days 見 datedDays）
 *   { type: "undated", days }      沒有日期；days＝排在哪幾天（第幾天的數字）
 */
export function scheduleStatus(trip, kind, obj, info = tripDays(trip)) {
  if (isDated(kind, obj)) {
    if (!info.dated) return { type: "tripUndated" };
    const days = datedDays(trip, kind, obj, info);
    return days.length ? { type: "dated", days } : { type: "outside" };
  }
  return { type: "undated", days: dayPlanStore.daysPlaced(trip.id, placedRef(kind, obj)) };
}

const dayList = (days) => days.map((d) => `Day ${typeof d === "number" ? d : d.day}`).join("、");

/** 預覽「行程」那一行的文字 */
export function statusText(st) {
  if (st.type === "tripUndated") return "旅程還沒有日期，設定日期後會自動出現";
  if (st.type === "outside") return "日期在旅程期間外";
  if (st.type === "undated") return st.days.length ? `${dayList(st.days)}（日期未定）` : "日期未定，還沒排進行程";
  const shown = st.days.filter((d) => !d.hidden);
  const removed = st.days.filter((d) => d.hidden);
  return [shown.length ? dayList(shown) : "", removed.length ? `已從 ${dayList(removed)} 移除` : ""].filter(Boolean).join("・");
}

// ---------------------------------------------------------------- 動作

/** 行程頁的「從行程移除」：有日期 → 這天不顯示；排進來的 → 從這天拿掉。本身都不改。 */
export function removeFromDay(trip, kind, obj, day) {
  if (isDated(kind, obj)) {
    const d = datedDays(trip, kind, obj).find((x) => x.day === day);
    return dayPlanStore.hide(trip.id, day, d ? d.refs : []);
  }
  return dayPlanStore.unplace(trip.id, day, placedRef(kind, obj));
}

/** 總覽頁的「加入行程」：清掉移除紀錄（day 有值只清那天） */
export function addBack(trip, kind, obj, day = 0) {
  return dayPlanStore.unhide(trip.id, allRefs(kind, obj), day);
}

/** 把沒有日期的項目排進某天（預設位置） */
export function placeOn(trip, kind, obj, dayInfo) {
  const ref = placedRef(kind, obj);
  const order = orderWithNewItem(trip, dayInfo.day, dayInfo.date, ref, kind === "activity" ? obj.startTime : "");
  return dayPlanStore.place(trip.id, dayInfo.day, ref, order, { single: kind === "flight" });
}

/** "YYYY-MM-DD..." 的日期部分平移 delta 天，後面的時間不變 */
function shift(value, delta) {
  return value ? addDays(value.slice(0, 10), delta) + value.slice(10) : "";
}

/** 有日期的項目改到某一天開始：時間不變；好幾天的（活動、住宿）天數不變 */
export function moveTo(kind, obj, date) {
  let result;
  if (kind === "flight") {
    const delta = daysBetween(parseDate(obj.departureTime.slice(0, 10)), parseDate(date));
    result = flightStore.update(obj.id, { ...obj, departureTime: shift(obj.departureTime, delta), arrivalTime: shift(obj.arrivalTime, delta) });
  } else if (kind === "stay") {
    const base = obj.checkInDate || obj.checkOutDate;
    const delta = daysBetween(parseDate(base), parseDate(date));
    result = accommodationStore.update(obj.id, { ...obj, checkInDate: shift(obj.checkInDate, delta), checkOutDate: shift(obj.checkOutDate, delta) });
  } else {
    const n = daysOf(obj) || 1;
    result = activityStore.update(obj.id, { ...obj, startDate: date, endDate: n > 1 ? addDays(date, n - 1) : "" });
  }
  // 日期換了：之前的移除、排進來、順序紀錄都清掉，照新日期、預設位置出現
  if (result.ok) dayPlanStore.forget(obj.tripId, allRefs(kind, obj));
  return result;
}

/** 表單存檔後：有日期了 → 清掉「排進來」的紀錄（改照日期出現） */
export function afterSaved(kind, obj) {
  if (obj && isDated(kind, obj)) dayPlanStore.forget(obj.tripId, [placedRef(kind, obj)]);
}

/** 刪除後：清掉所有行程紀錄 */
export function afterDeleted(kind, obj) {
  dayPlanStore.forget(obj.tripId, allRefs(kind, obj));
}

// ---------------------------------------------------------------- 預覽裡的區塊

/**
 * 預覽裡的「行程」一行＋按鈕。
 *   scheduleDay 有值（從行程頁打開）：只顯示「行程」一行（底部按鈕由預覽自己放「從行程移除」）
 *   總覽頁打開：有日期、被移除過 →「加入行程」；沒有日期 →「排進行程」（先選第幾天）
 */
export function scheduleBlock({ kind, obj, scheduleDay = 0 }) {
  const trip = tripStore.get(obj.tripId);
  if (!trip) return "";
  const st = scheduleStatus(trip, kind, obj);
  const row = html`
    <div class="detail-row">
      <div class="detail-row__label">行程</div>
      <div class="detail-row__value">${statusText(st)}</div>
    </div>
  `;
  if (scheduleDay) return row;
  const removed = st.type === "dated" ? st.days.filter((d) => d.hidden) : [];
  if (removed.length) {
    return html`${row}
      <button type="button" class="btn btn--ghost btn--block sched-btn" data-sched="add">${icon("plus")}加入行程</button>
      <p class="field__hint center sched-hint">放回 ${removed.map(dayText).join("、")}</p>`;
  }
  if (st.type === "undated") {
    return html`${row}
      <button type="button" class="btn btn--ghost btn--block sched-btn" data-sched="place">${icon("plus")}排進行程</button>
      <p class="field__hint center sched-hint">${kind === "flight" ? "沒有日期的航班只能排在一天" : "先選要排在第幾天，可以排好幾天"}</p>`;
  }
  return row;
}

/** 綁定 scheduleBlock 的按鈕 */
export function wireScheduleBlock(panel, { kind, obj, close, onChanged }) {
  const trip = tripStore.get(obj.tripId);
  const add = panel.querySelector('[data-sched="add"]');
  if (add) {
    add.addEventListener("click", () => {
      const result = addBack(trip, kind, obj);
      if (!result.ok) return window.alert(result.errors.join("\n"));
      close();
      if (onChanged) onChanged();
    });
  }
  const place = panel.querySelector('[data-sched="place"]');
  if (place) {
    place.addEventListener("click", () => {
      close();
      openDayChooser({ trip, kind, obj, onDone: onChanged });
    });
  }
}

/** 預覽底部、行程頁打開時：「從行程移除｜編輯」＋說明 */
export function scheduleActions(day) {
  return html`
    <div class="form__actions form__actions--spaced">
      <button type="button" class="btn btn--ghost" data-action="unschedule">從行程移除</button>
      <button type="button" class="btn btn--primary" data-action="edit">編輯</button>
    </div>
    <p class="field__hint center sched-hint">只從 Day ${day} 移除，總覽頁和其他天還在。</p>
  `;
}

export function wireScheduleActions(panel, { kind, obj, day, close, onChanged }) {
  const btn = panel.querySelector('[data-action="unschedule"]');
  if (!btn) return;
  btn.addEventListener("click", () => {
    const trip = tripStore.get(obj.tripId);
    const result = trip ? removeFromDay(trip, kind, obj, day) : { ok: false, errors: ["找不到這趟旅程"] };
    if (!result.ok) return window.alert(result.errors.join("\n"));
    close();
    if (onChanged) onChanged();
  });
}

/** 「排進行程」：選第幾天（底部面板） */
export function openDayChooser({ trip, kind, obj, onDone }) {
  const info = tripDays(trip);
  const placed = new Set(dayPlanStore.daysPlaced(trip.id, placedRef(kind, obj)));
  openSheet({
    title: "排進行程",
    body: html`
      <p class="muted">${kind === "flight" ? "沒有日期的航班只能排在一天，選別天會搬過去。" : "選要排在第幾天（可以再回來排其他天）。"}</p>
      <ul class="act-choose">
        ${info.days.map(
          (d) => html`
            <li>
              <button type="button" class="act-choose__row ${placed.has(d.day) ? "is-here" : ""}" data-day="${d.day}"
                      ${placed.has(d.day) ? html`disabled` : ""}>
                <span class="tl__body"><span class="tl__name">${dayText(d)}</span></span>
                ${placed.has(d.day) ? html`<span class="badge">已排</span>` : ""}
              </button>
            </li>
          `
        )}
      </ul>
    `,
    onMount(panel, close) {
      panel.querySelectorAll("[data-day]").forEach((btn) =>
        btn.addEventListener("click", () => {
          const d = info.days.find((x) => x.day === Number(btn.dataset.day));
          if (!d) return;
          const result = placeOn(trip, kind, obj, d);
          if (!result.ok) return window.alert(result.errors.join("\n"));
          close();
          if (onDone) onDone(d.day);
        })
      );
    },
  });
}
