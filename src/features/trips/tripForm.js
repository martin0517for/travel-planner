/**
 * tripForm.js — 新增／編輯旅程的表單（底部滑出面板）。
 *
 * openTripForm({ trip, onSaved, onDeleted })
 *   trip 為 null → 新增；有值 → 編輯（最下面多一個「刪除旅程」）
 */
import { html, render } from "../../core/html.js";
import { openSheet } from "../../core/sheet.js";
import { tripStore, NAME_MAX, DESTINATION_MAX } from "../../data/trips.js";

export function openTripForm({ trip = null, onSaved, onDeleted } = {}) {
  const isEdit = Boolean(trip);
  const v = trip || { name: "", destination: "", startDate: "", endDate: "" };

  openSheet({
    title: isEdit ? "編輯旅程" : "新增旅程",
    body: html`
      <form class="form" novalidate>
        <div class="field">
          <label for="trip-title">旅程名稱 <span class="field__required">必填</span></label>
          <input id="trip-title" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" name="tripTitle" type="search" enterkeyhint="done" maxlength="${NAME_MAX}"
                 placeholder="例如：東京賞櫻" value="${v.name}" required />
        </div>
        <div class="field">
          <label for="trip-destination">目的地</label>
          <input id="trip-destination" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" name="destination" type="search" enterkeyhint="done" maxlength="${DESTINATION_MAX}"
                 placeholder="例如：東京" value="${v.destination}" />
        </div>
        <div class="field-row">
          <div class="field">
            <label for="trip-start">出發日</label>
            <input id="trip-start" name="startDate" type="date" value="${v.startDate}" />
          </div>
          <div class="field">
            <label for="trip-end">回程日</label>
            <input id="trip-end" name="endDate" type="date" value="${v.endDate}" />
          </div>
        </div>
        <p class="field__hint">日期還沒確定可以先空著，之後再補。</p>

        <div class="form__errors" role="alert" hidden></div>

        <div class="form__actions">
          <button type="button" class="btn btn--ghost" data-action="cancel">取消</button>
          <button type="submit" class="btn btn--primary">${isEdit ? "儲存" : "新增"}</button>
        </div>

        ${isEdit ? html`<button type="button" class="btn btn--danger-text" data-action="delete">刪除這趟旅程</button>` : ""}
      </form>
    `,
    onMount(panel, close) {
      const form = panel.querySelector("form");
      const errorsBox = panel.querySelector(".form__errors");
      const start = form.elements.startDate;
      const end = form.elements.endDate;

      // 選了出發日後，回程日的日曆最早只能選到出發日
      const syncMin = () => {
        end.min = start.value || "";
      };
      start.addEventListener("change", () => {
        syncMin();
        if (start.value && end.value && end.value < start.value) end.value = start.value;
      });
      syncMin();

      function showErrors(errors) {
        render(errorsBox, html`${errors.map((e) => html`<div>${e}</div>`)}`);
        errorsBox.hidden = false;
      }

      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const input = {
          name: form.elements.tripTitle.value,
          destination: form.elements.destination.value,
          startDate: start.value,
          endDate: end.value,
        };
        const result = isEdit ? tripStore.update(trip.id, input) : tripStore.create(input);
        if (!result.ok) {
          showErrors(result.errors);
          return;
        }
        close();
        if (onSaved) onSaved(result.trip);
      });

      panel.querySelector('[data-action="cancel"]').addEventListener("click", close);

      const delBtn = panel.querySelector('[data-action="delete"]');
      if (delBtn) {
        delBtn.addEventListener("click", () => {
          if (!window.confirm(`確定要刪除「${trip.name}」嗎？這個動作無法復原。`)) return;
          const result = tripStore.remove(trip.id);
          if (!result.ok) {
            showErrors(result.errors);
            return;
          }
          close();
          if (onDeleted) onDeleted();
        });
      }
    },
  });
}
