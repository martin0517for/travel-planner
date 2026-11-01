/**
 * itemForm.js — 新增／編輯行程項目（整頁表單，⑤ 每日行程，2026-11-01）。
 *
 * openItemForm({ trip, day, item, onSaved })
 *   item 為 null → 新增到 day 那天；有值 → 編輯（可以改「第幾天」，把項目搬到別天）
 *
 * 新增入口只有一個「＋」（使用者決定）：同一個表單可以選地點、也可以打文字，至少填一項。
 *   - 有地點：以地點名稱為主，文字是補充說明（顯示在名稱下方）
 *   - 沒地點：文字就是項目名稱，另外選類型（移動／用餐／休息／其他）決定圖示
 * 其他欄位：時間（只用來顯示）、交通方式（怎麼到下一站，快速選項＋文字）、備註。
 * 每人費用：資料預留，表單不顯示（編輯時保留原本的值）。
 *
 * 新項目放在「預設位置」：有時間就依時間插入，沒時間放最下面（入住卡之前）。
 *
 * v0.8.2：新增時最上面有分段切換「行程項目｜活動」（使用者決定）。切到「活動」：
 *   - 新增活動：開活動表單；有日期的旅程，開始日帶入這一天。存好後：
 *       有日期 → 照日期自動出現；沒日期 → 記在這一天（DayPlan.activityIds）
 *   - 選擇已有的活動（列表見 timeline.js 的 activityChoices）：
 *       有日期的旅程 → 開始日改成這一天（好幾天的活動，結束日一起移，天數不變）
 *       沒日期的旅程 → 記在這一天（同一個活動可以排在好幾天）
 */
import { html, raw, render } from "../../core/html.js";
import { icon } from "../../core/icons.js";
import { openSheet } from "../../core/sheet.js";
import { formatDateShort, addDays } from "../../core/dates.js";
import { dayPlanStore, LIMITS, ITEM_KINDS, TRANSPORT_PICKS } from "../../data/dayPlans.js";
import { activityStore, daysOf } from "../../data/activities.js";
import { placeStore } from "../../data/places.js";
import { mountPlaceField } from "../places/placePicker.js";
import { openActivityForm } from "../activities/activityForm.js";
import { tripDays, orderWithNewItem, activityChoices } from "./timeline.js";

// 所有文字欄位用同一組設定（同一種鍵盤，避免切換欄位時鍵盤高度不同而跳動）
const TEXT_ATTRS = 'autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" type="search" enterkeyhint="done"';

const KIND_ICONS = { move: "move", meal: "restaurant", rest: "rest", other: "dot" };
export const kindIcon = (kind) => KIND_ICONS[kind] || "dot";

/** 「Day 2・04-02（四）」 */
export function dayLabel(d) {
  return d.date ? `Day ${d.day}・${formatDateShort(d.date)}` : `Day ${d.day}`;
}

export function openItemForm({ trip, day, item = null, onSaved } = {}) {
  const isEdit = Boolean(item);
  const v = item || { placeId: "", text: "", kind: "other", time: "", transport: "", notes: "" };
  const info = tripDays(trip);
  let placeId = v.placeId;

  openSheet({
    title: isEdit ? "編輯行程" : "新增行程",
    body: html`
      <form class="form" novalidate>
        ${isEdit
          ? ""
          : html`
              <div class="segmented" role="tablist" aria-label="要新增什麼">
                <button type="button" role="tab" class="segmented__item is-active" aria-selected="true" data-mode="item">行程項目</button>
                <button type="button" role="tab" class="segmented__item" aria-selected="false" data-mode="activity">活動</button>
              </div>
            `}
        <div class="field">
          <label for="it-day">第幾天</label>
          <select id="it-day" name="day">
            ${info.days.map((d) => html`<option value="${d.day}" ${d.day === day ? html`selected` : ""}>${dayLabel(d)}</option>`)}
          </select>
        </div>

        <div data-pane="activity" hidden></div>

        <div data-pane="item">
        <div class="field" data-place></div>

        <div class="field">
          <label for="it-text">文字</label>
          <input id="it-text" ${raw(TEXT_ATTRS)} name="itText" maxlength="${LIMITS.text}" value="${v.text}" />
          <p class="field__hint field__hint--tight" data-text-hint></p>
        </div>

        <div class="field" data-kind>
          <div class="field__legend">類型</div>
          <div class="chips chips--wrap" role="radiogroup" aria-label="類型">
            ${ITEM_KINDS.map(
              (k) => html`
                <label class="chip chip--cat cat--kind chip--radio">
                  <input type="radio" name="kind" value="${k.value}" ${k.value === v.kind ? html`checked` : ""} />
                  ${icon(kindIcon(k.value))}${k.label}
                </label>
              `
            )}
          </div>
        </div>

        <div class="field">
          <label for="it-time">時間</label>
          <input id="it-time" name="time" type="time" value="${v.time}" />
          <p class="field__hint field__hint--tight">只用來顯示，不會自動調整順序（用「排序」調整）</p>
        </div>

        <div class="field">
          <label for="it-transport">交通方式</label>
          <input id="it-transport" ${raw(TEXT_ATTRS)} name="transport" maxlength="${LIMITS.transport}"
                 placeholder="例如：JR 山手線 15 分" value="${v.transport}" />
          <div class="quick-picks">
            ${TRANSPORT_PICKS.map((t) => html`<button type="button" class="tag tag--btn" data-transport="${t}">${t}</button>`)}
          </div>
        </div>

        <div class="field">
          <label for="it-notes">備註</label>
          <textarea id="it-notes" name="itNotes" rows="4" maxlength="${LIMITS.notes}"
                    autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
                    placeholder="例如：停留 2 小時、要先預約、攻略網址">${v.notes}</textarea>
          <p class="field__hint field__hint--tight" data-count></p>
        </div>

        <div class="form__errors" role="alert" hidden></div>

        <div class="form__actions">
          <button type="button" class="btn btn--ghost" data-action="cancel">取消</button>
          <button type="submit" class="btn btn--primary">${isEdit ? "儲存" : "新增"}</button>
        </div>
        </div>
      </form>
    `,
    onMount(panel, close) {
      const form = panel.querySelector("form");
      const errorsBox = panel.querySelector(".form__errors");
      const kindBox = panel.querySelector("[data-kind]");
      const textInput = form.elements.itText;
      const textHint = panel.querySelector("[data-text-hint]");
      const notes = form.elements.itNotes;
      const count = panel.querySelector("[data-count]");

      /** 有沒有選地點，決定文字欄的提示、是否顯示類型 */
      function syncPlace() {
        const has = Boolean(placeId);
        kindBox.hidden = has;
        textInput.placeholder = has ? "補充說明（可不填）" : "例如：搭 JR 到京都、午餐（附近找）";
        textHint.textContent = has
          ? "會顯示在地點名稱下方，例如：買限定御守"
          : "沒有選地點時，這就是項目的名稱（不會出現在地圖上）";
      }

      mountPlaceField(panel.querySelector("[data-place]"), {
        label: "地點（可不選）",
        emptyText: "選擇地點",
        iconName: "places",
        category: "",
        pickerTitle: "選擇地點",
        tripId: trip.id,
        value: placeId,
        onChange: (id) => {
          placeId = id;
          syncPlace();
        },
      });
      syncPlace();

      panel.querySelectorAll("[data-transport]").forEach((btn) =>
        btn.addEventListener("click", () => {
          form.elements.transport.value = btn.dataset.transport;
        })
      );

      const paintCount = () => (count.textContent = `${notes.value.length} / ${LIMITS.notes}`);
      notes.addEventListener("input", paintCount);
      paintCount();

      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const el = form.elements;
        const toDay = Number(el.day.value) || day;
        const target = info.days.find((d) => d.day === toDay) || { day: toDay, date: "" };
        const kindInput = form.querySelector('input[name="kind"]:checked');
        const input = {
          placeId: placeId && placeStore.get(placeId) ? placeId : "", // 已刪除的地點不存
          text: textInput.value,
          kind: kindInput ? kindInput.value : "other",
          time: el.time.value,
          transport: el.transport.value,
          notes: notes.value,
        };
        let result;
        if (!isEdit) {
          const order = orderWithNewItem(trip, target.day, target.date, "i:NEW", input.time.slice(0, 5));
          result = dayPlanStore.createItem(trip.id, target.day, input, order);
        } else {
          const found = dayPlanStore.findItem(trip.id, item.id);
          const moving = found && found.plan.day !== target.day;
          const order = moving ? orderWithNewItem(trip, target.day, target.date, `i:${item.id}`, input.time.slice(0, 5)) : undefined;
          result = dayPlanStore.updateItem(trip.id, item.id, input, { toDay: target.day, order });
        }
        if (!result.ok) {
          render(errorsBox, html`${result.errors.map((err) => html`<div>${err}</div>`)}`);
          errorsBox.hidden = false;
          return;
        }
        close();
        if (onSaved) onSaved(result.item, target.day);
      });

      panel.querySelector('[data-action="cancel"]').addEventListener("click", close);

      if (!isEdit) {
        mountActivityPane(panel, close, {
          trip,
          info,
          getDay: () => {
            const d = Number(form.elements.day.value) || day;
            return info.days.find((x) => x.day === d) || { day: d, date: "" };
          },
          onSaved,
        });
      }
    },
  });
}

/** 「活動」分頁：新增活動、選擇已有的活動（v0.8.2） */
function mountActivityPane(panel, close, { trip, info, getDay, onSaved }) {
  const itemPane = panel.querySelector('[data-pane="item"]');
  const actPane = panel.querySelector('[data-pane="activity"]');
  const tabs = panel.querySelectorAll("[data-mode]");
  let mode = "item";

  function paint() {
    const target = getDay();
    const choices = activityChoices(trip, target.day, info);
    const where = info.dated ? `開始日會帶入 ${formatDateShort(target.date)}` : `存好後排進 Day ${target.day}`;
    render(
      actPane,
      html`
        <button type="button" class="picker-btn act-new" data-action="new-activity">
          ${icon("plus")}
          <span class="picker-btn__text"><span class="picker-btn__name">新增活動</span><span class="picker-btn__sub">${where}</span></span>
        </button>

        <div class="field__legend act-choose__title">或選擇已有的活動</div>
        ${choices.length
          ? html`<ul class="act-choose">${choices.map((a) => choiceRow(a, info))}</ul>`
          : html`<p class="muted act-choose__empty">${info.dated
              ? "沒有可以選的活動。日期在旅程期間內的活動，會自動出現在當天。"
              : "沒有可以選的活動（這天已經排了的不會列出）。"}</p>`}
        <p class="field__hint">${info.dated
          ? "選了之後，活動的開始日會改成這一天（好幾天的活動，天數不變）。"
          : "選了之後排進這一天；同一個活動可以排在好幾天。"}</p>

        <div class="form__actions">
          <button type="button" class="btn btn--ghost" data-action="act-cancel">取消</button>
        </div>
      `
    );
    actPane.querySelector('[data-action="act-cancel"]').addEventListener("click", close);
    actPane.querySelector('[data-action="new-activity"]').addEventListener("click", () => newActivity(target));
    actPane.querySelectorAll("[data-pick]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const act = activityStore.get(btn.dataset.pick);
        if (act) pickActivity(act, target);
      })
    );
  }

  function setMode(next) {
    mode = next;
    tabs.forEach((t) => {
      const on = t.dataset.mode === mode;
      t.classList.toggle("is-active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
    });
    itemPane.hidden = mode !== "item";
    actPane.hidden = mode !== "activity";
    if (mode === "activity") paint();
  }
  tabs.forEach((t) => t.addEventListener("click", () => setMode(t.dataset.mode)));
  panel.querySelector('select[name="day"]').addEventListener("change", () => {
    if (mode === "activity") paint();
  });

  const done = (toDay) => {
    if (onSaved) onSaved(null, toDay);
  };

  /** 把沒有日期的活動記在這一天 */
  function place(act, target) {
    const order = orderWithNewItem(trip, target.day, target.date, `a:${act.id}`, act.startTime);
    return dayPlanStore.placeActivity(trip.id, target.day, act.id, order);
  }

  function pickActivity(act, target) {
    let result;
    if (info.dated) {
      // 有日期的旅程：開始日改成這一天；好幾天的活動結束日一起移
      if (act.startDate && !window.confirm(`把「${act.title}」改成 ${formatDateShort(target.date)} 開始？`)) return;
      const n = daysOf(act) || 1;
      result = activityStore.update(act.id, { ...act, startDate: target.date, endDate: n > 1 ? addDays(target.date, n - 1) : "" });
      if (result.ok) dayPlanStore.unplaceActivityEverywhere(trip.id, act.id);
    } else {
      result = place(act, target);
    }
    if (!result.ok) return window.alert(result.errors.join("\n"));
    close();
    done(target.day);
  }

  function newActivity(target) {
    close();
    openActivityForm({
      tripId: trip.id,
      defaults: target.date ? { startDate: target.date } : {},
      note: info.dated
        ? `從行程 Day ${target.day} 新增。沒填日期的話，會排在 Day ${target.day}。`
        : `從行程 Day ${target.day} 新增，存好後排進 Day ${target.day}。`,
      onSaved: (act) => {
        if (!act.startDate) {
          const result = place(act, target);
          if (!result.ok) window.alert(result.errors.join("\n"));
          return done(target.day);
        }
        // 有日期：照日期出現；開始日在旅程期間內就跳到那天
        const hit = info.days.find((d) => d.date === act.startDate);
        done(hit ? hit.day : target.day);
      },
    });
  }
}

function choiceRow(a, info) {
  const n = a.placeIds.length;
  const when = !a.startDate
    ? "日期未定"
    : `${formatDateShort(a.startDate)}${a.endDate ? ` → ${formatDateShort(a.endDate)}` : ""}・旅程期間外`;
  const placedDays = !a.startDate && !info.dated ? dayPlanStore.daysOfActivity(a.tripId, a.id) : [];
  const sub = [when, n ? `${n} 個地點` : "", placedDays.length ? `已排 ${placedDays.map((d) => `Day ${d}`).join("、")}` : ""]
    .filter(Boolean)
    .join("・");
  return html`
    <li>
      <button type="button" class="act-choose__row" data-pick="${a.id}">
        <span class="tl__icon cat--attraction">${icon("ticket")}</span>
        <span class="tl__body">
          <span class="tl__name">${a.title}</span>
          <span class="tl__sub">${sub}</span>
        </span>
      </button>
    </li>
  `;
}
