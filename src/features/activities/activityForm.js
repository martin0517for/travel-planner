/**
 * activityForm.js — 新增／編輯活動（整頁表單，計畫書 9.5，2026-11-01）。
 *
 * openActivityForm({ tripId, activity, defaults, note, onSaved })
 *   activity 為 null → 新增；有值 → 編輯
 *   defaults：新增時預先帶入的欄位（v0.8.2 從行程頁新增時帶入開始日）
 *   note：表單最上方的提示文字（v0.8.2 從行程頁新增時說明會排在哪一天）
 * 活動存好後有日期 → 從行程頁「排在某天」的紀錄移除（改照日期出現，v0.8.2）。
 *
 * 欄位：名稱（必填）、開始日／結束日、開始時間／結束時間、地點（多個，可用 ▲▼ 調整順序）、內容。
 * - 只去一天：結束日可以不填。結束日的日曆最早只能選到開始日；有日期時顯示「共 N 天」。
 * - 地點：按「選擇地點」開多選畫面（這趟的地點排前面，找不到可直接新增）；
 *   選好的地點列在表單裡，每個右邊有 ▲▼（調整順序）和 ×（移除）。
 * - 內容最多 3000 字，下方顯示字數；網址在預覽裡會變成連結。
 */
import { html, raw, render } from "../../core/html.js";
import { openSheet } from "../../core/sheet.js";
import { clearLabel, wireClearButtons } from "../../core/fieldClear.js";
import { activityStore, LIMITS, daysOf } from "../../data/activities.js";
import { afterSaved } from "../schedule/scheduleLinks.js";
import { mountPlaceListField } from "../places/placeLinks.js";

// 所有文字欄位用同一組設定（同一種鍵盤，避免切換欄位時鍵盤高度不同而跳動）
const TEXT_ATTRS = 'autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" type="search" enterkeyhint="done"';

export function openActivityForm({ tripId, activity = null, defaults = {}, note = "", onSaved } = {}) {
  const isEdit = Boolean(activity);
  const v = activity || { title: "", startDate: "", endDate: "", startTime: "", endTime: "", placeIds: [], notes: "", ...defaults };
  const theTripId = tripId || (activity && activity.tripId) || "";

  openSheet({
    title: isEdit ? "編輯活動" : "新增活動",
    body: html`
      <form class="form" novalidate>
        ${note ? html`<p class="field__hint">${note}</p>` : ""}
        <div class="field">
          <label for="act-title">名稱</label>
          <input id="act-title" ${raw(TEXT_ATTRS)} name="actTitle" maxlength="${LIMITS.title}"
                 placeholder="例如：環球影城" value="${v.title}" />
        </div>

        <div class="field-row">
          <div class="field">
            ${clearLabel("act-start-date", "開始日")}
            <input id="act-start-date" name="startDate" type="date" value="${v.startDate}" />
          </div>
          <div class="field">
            ${clearLabel("act-end-date", "結束日")}
            <input id="act-end-date" name="endDate" type="date" value="${v.endDate}" />
          </div>
        </div>
        <p class="field__hint" data-days></p>

        <div class="field-row">
          <div class="field">
            ${clearLabel("act-start-time", "開始時間")}
            <input id="act-start-time" name="startTime" type="time" value="${v.startTime}" />
          </div>
          <div class="field">
            ${clearLabel("act-end-time", "結束時間")}
            <input id="act-end-time" name="endTime" type="time" value="${v.endTime}" />
          </div>
        </div>

        <div class="field" data-places></div>

        <div class="field">
          <label for="act-notes">內容</label>
          <textarea id="act-notes" name="actNotes" rows="6" maxlength="${LIMITS.notes}"
                    autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
                    placeholder="例如：快速通關順序、票價、攻略網址">${v.notes}</textarea>
          <p class="field__hint field__hint--tight" data-count></p>
        </div>

        <div class="form__errors" role="alert" hidden></div>

        <div class="form__actions">
          <button type="button" class="btn btn--ghost" data-action="cancel">取消</button>
          <button type="submit" class="btn btn--primary">${isEdit ? "儲存" : "新增"}</button>
        </div>
      </form>
    `,
    onMount(panel, close) {
      const form = panel.querySelector("form");
      wireClearButtons(form); // 日期、時間欄位的「清除」（v0.8.3）
      const errorsBox = panel.querySelector(".form__errors");
      const startDate = form.elements.startDate;
      const endDate = form.elements.endDate;
      const daysBox = panel.querySelector("[data-days]");
      const placesBox = panel.querySelector("[data-places]");
      const notes = form.elements.actNotes;
      const count = panel.querySelector("[data-count]");

      // 結束日的日曆最早只能選到開始日；有開始日時顯示「共 N 天」
      function syncDates() {
        endDate.min = startDate.value || "";
        const n = daysOf({ startDate: startDate.value, endDate: endDate.value });
        daysBox.textContent = n === null ? "只去一天的話，結束日可以不填" : n === 1 ? "一天的活動" : `共 ${n} 天`;
      }
      startDate.addEventListener("change", () => {
        if (startDate.value && endDate.value && endDate.value < startDate.value) endDate.value = startDate.value;
        syncDates();
      });
      endDate.addEventListener("change", syncDates);
      syncDates();

      const paintCount = () => (count.textContent = `${notes.value.length} / ${LIMITS.notes}`);
      notes.addEventListener("input", paintCount);
      paintCount();

      // 地點區塊（v0.12.0 搬到 places/placeLinks.js，筆記也用同一套）
      const places = mountPlaceListField(placesBox, {
        tripId: theTripId,
        pickerTitle: "選擇活動的地點",
        placeIds: v.placeIds,
        max: LIMITS.places,
      });

      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const el = form.elements;
        const input = {
          title: el.actTitle.value,
          startDate: startDate.value,
          endDate: endDate.value,
          startTime: el.startTime.value,
          endTime: el.endTime.value,
          placeIds: places.get(), // 已刪除的地點不存
          notes: notes.value,
        };
        const result = isEdit ? activityStore.update(activity.id, input) : activityStore.create(theTripId, input);
        if (!result.ok) {
          render(errorsBox, html`${result.errors.map((err) => html`<div>${err}</div>`)}`);
          errorsBox.hidden = false;
          return;
        }
        // 有日期了：照日期出現，行程頁「排在某天」的紀錄不再需要
        afterSaved("activity", result.activity);
        close();
        if (onSaved) onSaved(result.activity);
      });

      panel.querySelector('[data-action="cancel"]').addEventListener("click", close);
    },
  });
}
