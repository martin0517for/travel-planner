/**
 * overviewPane.js — 新增行程的「總覽項目」分頁（v0.8.3，使用者決定）。
 *
 * 分航班、住宿、活動三段；每段最上面「＋ 新增…」，下面列出這趟「全部」的航班／住宿／活動，
 * 右邊標出跟選定這天的關係：
 *   已在這天（變灰、不能點）｜已移除（點了放回這天）｜日期未定（點了排進這天，不用填日期）
 *   Day N（在別天）、旅程期間外（點了先確認，再把日期改到這天；時間不變、天數不變）
 *   旅程沒有日期時，有日期的項目不能排（設定日期後會自動出現）
 *
 * 從這裡新增：住宿帶入入住日、活動帶入開始日（航班的出發時間要連時間一起選，不帶入）。
 * 存好後沒有日期 → 排進這天；有日期 → 照日期出現，跳到那天。
 * 規則細節見 scheduleLinks.js。
 */
import { html, render } from "../../core/html.js";
import { icon } from "../../core/icons.js";
import { formatDateShort } from "../../core/dates.js";
import { flightStore } from "../../data/flights.js";
import { accommodationStore } from "../../data/accommodations.js";
import { activityStore } from "../../data/activities.js";
import { flightTitle, airportName } from "../flights/flightDetail.js";
import { stayTitle, nightsText } from "../accommodations/accommodationDetail.js";
import { openFlightForm } from "../flights/flightForm.js";
import { openAccommodationForm } from "../accommodations/accommodationForm.js";
import { openActivityForm } from "../activities/activityForm.js";
import { scheduleStatus, datedDays, placeOn, addBack, moveTo, isDated } from "./scheduleLinks.js";

const SECTIONS = [
  { kind: "flight", title: "航班", add: "新增航班", icon: "plane", cat: "cat--transport", store: flightStore },
  { kind: "stay", title: "住宿", add: "新增住宿", icon: "hotel", cat: "cat--hotel", store: accommodationStore },
  { kind: "activity", title: "活動", add: "新增活動", icon: "ticket", cat: "cat--attraction", store: activityStore },
];

const titleOf = (kind, obj) => (kind === "flight" ? flightTitle(obj) : kind === "stay" ? stayTitle(obj) : obj.title);

/** 第 2 行：航班「桃園 → 成田・12-01 08:00」、住宿「12-01 → 12-03・2 晚」、活動「12-03 → 12-04・2 個地點」 */
function subOf(kind, o) {
  if (kind === "flight") {
    const route = [airportName(o.departurePlaceId), airportName(o.arrivalPlaceId)].filter(Boolean).join(" → ");
    const when = o.departureTime ? `${formatDateShort(o.departureTime.slice(0, 10))} ${o.departureTime.slice(11, 16)}` : "";
    return [route, when].filter(Boolean).join("・");
  }
  if (kind === "stay") {
    const dates = [o.checkInDate && formatDateShort(o.checkInDate), o.checkOutDate && formatDateShort(o.checkOutDate)].filter(Boolean).join(" → ");
    return [dates, nightsText(o), o.platform].filter(Boolean).join("・");
  }
  const dates = o.startDate ? formatDateShort(o.startDate) + (o.endDate ? ` → ${formatDateShort(o.endDate)}` : "") : "";
  const time = !o.endDate && o.startTime ? o.startTime : "";
  return [dates, time, o.placeIds.length ? `${o.placeIds.length} 個地點` : ""].filter(Boolean).join("・");
}

/** 這一列跟選定這天的關係 → { badge, action, extra }；action：null（不能點）｜unhide｜place｜move */
function rowState(trip, kind, obj, target, info) {
  const st = scheduleStatus(trip, kind, obj, info);
  if (st.type === "tripUndated") return { badge: "有日期", action: null };
  if (st.type === "outside") return { badge: "旅程期間外", action: "move" };
  if (st.type === "undated") {
    if (st.days.includes(target.day)) return { badge: "已在這天", action: null, here: true };
    return { badge: "日期未定", action: "place", extra: st.days.length ? `已排 ${st.days.map((d) => `Day ${d}`).join("、")}` : "" };
  }
  const hit = st.days.find((d) => d.day === target.day);
  if (hit) return hit.hidden ? { badge: "已移除", action: "unhide" } : { badge: "已在這天", action: null, here: true };
  const first = st.days[0].day;
  const last = st.days[st.days.length - 1].day;
  return { badge: first === last ? `Day ${first}` : `Day ${first}–${last}`, action: "move" };
}

/**
 * 掛上「總覽項目」分頁。
 *   pane：放內容的元素；getDay()：目前選的 { day, date }；close()：關掉新增行程表單
 *   onSaved(toDay)：完成後回到行程頁（跳到那天）
 */
export function mountOverviewPane(pane, { trip, info, getDay, close, onSaved }) {
  function paint() {
    const target = getDay();
    const rows = SECTIONS.map((sec) => ({
      ...sec,
      list: sec.store.listByTrip(trip.id).map((obj) => ({ obj, state: rowState(trip, sec.kind, obj, target, info) })),
    }));
    const hasTripUndated = rows.some((r) => r.list.some((x) => x.state.badge === "有日期"));
    const addHint = (kind) =>
      kind === "flight"
        ? `不填出發時間就排在 Day ${target.day}`
        : info.dated
          ? `日期帶入 ${formatDateShort(target.date)}；不填日期就排在 Day ${target.day}`
          : `存好後排進 Day ${target.day}`;

    render(
      pane,
      html`
        ${rows.map(
          (sec) => html`
            <div class="ov-sec"><span>${sec.title}</span>${sec.list.length ? html`<span>${sec.list.length}</span>` : ""}</div>
            <button type="button" class="picker-btn ov-add" data-new="${sec.kind}">
              ${icon("plus")}
              <span class="picker-btn__text">
                <span class="picker-btn__name">${sec.add}</span>
                <span class="picker-btn__sub">${addHint(sec.kind)}</span>
              </span>
            </button>
            ${sec.list.length
              ? html`<ul class="act-choose">${sec.list.map(({ obj, state }) => row(sec, obj, state))}</ul>`
              : ""}
          `
        )}
        ${hasTripUndated ? html`<p class="field__hint">標「有日期」的：旅程設定日期後，會自動出現在當天。</p>` : ""}
        <p class="field__hint">點「日期未定」的直接排進這天；在別天或旅程期間外的，確認後把日期改到這天（時間、天數不變）。</p>
        <div class="form__actions">
          <button type="button" class="btn btn--ghost" data-action="ov-cancel">取消</button>
        </div>
      `
    );

    pane.querySelector('[data-action="ov-cancel"]').addEventListener("click", close);
    pane.querySelectorAll("[data-new]").forEach((btn) => btn.addEventListener("click", () => createNew(btn.dataset.new, target)));
    pane.querySelectorAll("[data-pick]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const [kind, id] = btn.dataset.pick.split("|");
        const sec = SECTIONS.find((s) => s.kind === kind);
        const obj = sec && sec.store.get(id);
        if (obj) pick(kind, obj, target);
      })
    );
  }

  function pick(kind, obj, target) {
    const state = rowState(trip, kind, obj, target, info);
    let result;
    if (state.action === "unhide") result = addBack(trip, kind, obj, target.day);
    else if (state.action === "place") result = placeOn(trip, kind, obj, target);
    else if (state.action === "move") {
      if (!window.confirm(`把「${titleOf(kind, obj)}」改到 ${formatDateShort(target.date)}（Day ${target.day}）？\n時間不變；好幾天的，天數不變。`)) return;
      result = moveTo(kind, obj, target.date);
    } else return;
    if (!result.ok) return window.alert(result.errors.join("\n"));
    close();
    if (onSaved) onSaved(target.day);
  }

  function createNew(kind, target) {
    close();
    const note = `從行程 Day ${target.day} 新增。${kind === "flight" ? "沒填出發時間" : "沒填日期"}的話，會排在 Day ${target.day}。`;
    const after = (obj) => {
      if (!obj) return onSaved && onSaved(target.day);
      if (!isDated(kind, obj)) {
        const result = placeOn(trip, kind, obj, target);
        if (!result.ok) window.alert(result.errors.join("\n"));
        return onSaved && onSaved(target.day);
      }
      // 有日期：照日期出現，跳到它在旅程裡的第一天
      const days = datedDays(trip, kind, obj, info);
      if (onSaved) onSaved(days.length ? days[0].day : target.day);
    };
    const date = info.dated ? target.date : "";
    if (kind === "flight") openFlightForm({ tripId: trip.id, note, onSaved: after });
    else if (kind === "stay") openAccommodationForm({ tripId: trip.id, defaults: date ? { checkInDate: date } : {}, note, onSaved: after });
    else openActivityForm({ tripId: trip.id, defaults: date ? { startDate: date } : {}, note, onSaved: after });
  }

  paint();
  return { paint };
}

function row(sec, obj, state) {
  const sub = [subOf(sec.kind, obj), state.extra].filter(Boolean).join("・");
  const disabled = !state.action;
  return html`
    <li>
      <button type="button" class="act-choose__row ${disabled ? "is-here" : ""}" data-pick="${sec.kind}|${obj.id}"
              ${disabled ? html`disabled` : ""}>
        <span class="tl__icon ${sec.cat}">${icon(sec.icon)}</span>
        <span class="tl__body">
          <span class="tl__name">${titleOf(sec.kind, obj)}</span>
          ${sub ? html`<span class="tl__sub">${sub}</span>` : ""}
        </span>
        <span class="badge">${state.badge}</span>
      </button>
    </li>
  `;
}
