/**
 * outOfRange.js — 「旅程日期外的行程」處理畫面（底部面板，⑤ 第 ④ 小步，2026-11-01）。
 *
 * 旅程日期改短（例如 6 天改 5 天），或沒日期時排了 7 天、之後補上的日期只有 5 天，
 * 多出來那幾天的行程資料保留不顯示（使用者決定），Timeline 上方提示「有 N 天的行程在旅程日期外」。
 * 按「處理」開這個畫面，每一天可以：
 *   - 移到最後一天：項目接在最後一天的最下面（照原本的順序）
 *   - 刪除：刪掉這天的所有項目（地點會留在想去的地點清單）
 */
import { html } from "../../core/html.js";
import { openSheet } from "../../core/sheet.js";
import { dayPlanStore } from "../../data/dayPlans.js";
import { tripDays, outOfRangePlans, dayContent } from "./timeline.js";
import { itemTitle } from "./itemDetail.js";
import { dayLabel } from "./itemForm.js";

export function openOutOfRange({ trip, onChanged }) {
  const info = tripDays(trip);
  const plans = outOfRangePlans(trip, info);
  if (!plans.length) return;
  const last = info.days[info.days.length - 1];

  openSheet({
    title: "旅程日期外的行程",
    body: html`
      <p class="muted">旅程現在是 ${info.days.length} 天，下面這幾天的行程不會顯示。可以搬到最後一天（${dayLabel(last)}），或刪除。</p>
      ${plans.map(
        (p) => html`
          <div class="oor-day">
            <div class="oor-day__head">
              <b>Day ${p.day}</b><span class="muted">${p.items.length + p.activities.length} 個項目</span>
            </div>
            <div class="oor-day__items">${[...p.items.map((it) => itemTitle(it)), ...p.activities.map((a) => a.title)].join("、")}</div>
            <div class="form__actions">
              <button type="button" class="btn btn--danger" data-delete="${p.day}">刪除</button>
              <button type="button" class="btn btn--primary" data-move="${p.day}">移到 Day ${last.day}</button>
            </div>
          </div>
        `
      )}
    `,
    onMount(panel, close) {
      const done = () => {
        close();
        if (onChanged) onChanged();
        // 還有其他天要處理時，重新打開
        if (outOfRangePlans(trip).length) openOutOfRange({ trip, onChanged });
      };
      panel.querySelectorAll("[data-move]").forEach((btn) =>
        btn.addEventListener("click", () => {
          const base = dayContent(trip, last.day, last.date).entries.map((e) => e.ref);
          const result = dayPlanStore.moveDayItems(trip.id, Number(btn.dataset.move), last.day, base);
          if (!result.ok) return window.alert(result.errors.join("\n"));
          done();
        })
      );
      panel.querySelectorAll("[data-delete]").forEach((btn) =>
        btn.addEventListener("click", () => {
          const day = Number(btn.dataset.delete);
          if (!window.confirm(`確定要刪除 Day ${day} 的所有項目嗎？這個動作無法復原。\n（地點會留在想去的地點清單）`)) return;
          const result = dayPlanStore.removeDay(trip.id, day);
          if (!result.ok) return window.alert(result.errors.join("\n"));
          done();
        })
      );
    },
  });
}
