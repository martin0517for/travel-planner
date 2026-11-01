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
 * 新增時最上面有分段切換「行程項目｜總覽項目」（v0.8.2 活動、v0.8.3 加上航班與住宿，使用者決定）。
 * 「總覽項目」分頁見 overviewPane.js。
 */
import { html, raw, render } from "../../core/html.js";
import { icon } from "../../core/icons.js";
import { openSheet } from "../../core/sheet.js";
import { clearLabel, wireClearButtons } from "../../core/fieldClear.js";
import { formatDateShort } from "../../core/dates.js";
import { dayPlanStore, LIMITS, ITEM_KINDS, TRANSPORT_PICKS } from "../../data/dayPlans.js";
import { placeStore } from "../../data/places.js";
import { mountPlaceField } from "../places/placePicker.js";
import { tripDays, orderWithNewItem } from "./timeline.js";
import { mountOverviewPane } from "./overviewPane.js";

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
                <button type="button" role="tab" class="segmented__item" aria-selected="false" data-mode="overview">總覽項目</button>
              </div>
            `}
        <div class="field">
          <label for="it-day">第幾天</label>
          <select id="it-day" name="day">
            ${info.days.map((d) => html`<option value="${d.day}" ${d.day === day ? html`selected` : ""}>${dayLabel(d)}</option>`)}
          </select>
        </div>

        <div data-pane="overview" hidden></div>

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
          ${clearLabel("it-time", "時間")}
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
      wireClearButtons(form); // 日期、時間欄位的「清除」（v0.8.3）
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
        // 「行程項目｜總覽項目」切換；總覽項目分頁第一次切過去時才畫，換「第幾天」時重畫
        const itemPane = panel.querySelector('[data-pane="item"]');
        const ovPane = panel.querySelector('[data-pane="overview"]');
        const tabs = panel.querySelectorAll("[data-mode]");
        let pane = null;
        const getDay = () => {
          const d = Number(form.elements.day.value) || day;
          return info.days.find((x) => x.day === d) || { day: d, date: "" };
        };
        const setMode = (mode) => {
          tabs.forEach((t) => {
            const on = t.dataset.mode === mode;
            t.classList.toggle("is-active", on);
            t.setAttribute("aria-selected", on ? "true" : "false");
          });
          itemPane.hidden = mode !== "item";
          ovPane.hidden = mode !== "overview";
          if (mode === "overview") {
            if (pane) pane.paint();
            else pane = mountOverviewPane(ovPane, { trip, info, getDay, close, onSaved: (toDay) => onSaved && onSaved(null, toDay) });
          }
        };
        tabs.forEach((t) => t.addEventListener("click", () => setMode(t.dataset.mode)));
        form.elements.day.addEventListener("change", () => {
          if (!ovPane.hidden && pane) pane.paint();
        });
      }
    },
  });
}

