/**
 * accommodationForm.js — 新增／編輯住宿（整頁表單）。
 *
 * openAccommodationForm({ tripId, stay, onSaved })
 *   stay 為 null → 新增；有值 → 編輯
 *
 * 欄位全部可以空白，但至少要填一項。
 * 飯店：按下去開選地點畫面（預先篩選「住宿」），找不到可以直接新增。
 * 退房日不能早於入住日；兩個日期都有時顯示「共 N 晚」。
 * 訂房平台：可自己打字，下方有快速選項，點一下帶入。
 */
import { html, raw, render } from "../../core/html.js";
import { openSheet } from "../../core/sheet.js";
import { accommodationStore, PLATFORM_PICKS, LIMITS, nightsOf } from "../../data/accommodations.js";
import { mountPlaceField } from "../places/placePicker.js";

// 所有文字欄位用同一組設定（同一種鍵盤，避免切換欄位時鍵盤高度不同而跳動）
const TEXT_ATTRS = 'autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" type="search" enterkeyhint="done"';

export function openAccommodationForm({ tripId, stay = null, onSaved } = {}) {
  const isEdit = Boolean(stay);
  const v = stay || {
    placeId: "", checkInDate: "", checkInTime: "", checkOutDate: "", checkOutTime: "",
    platform: "", bookingRef: "", notes: "",
  };
  let placeId = v.placeId; // 目前選的飯店（按「儲存」才會寫入）

  openSheet({
    title: isEdit ? "編輯住宿" : "新增住宿",
    body: html`
      <form class="form" novalidate>
        <div class="field" data-hotel></div>

        <div class="field-row">
          <div class="field">
            <label for="st-in-date">入住日</label>
            <input id="st-in-date" name="checkInDate" type="date" value="${v.checkInDate}" />
          </div>
          <div class="field">
            <label for="st-in-time">入住時間</label>
            <input id="st-in-time" name="checkInTime" type="time" value="${v.checkInTime}" />
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label for="st-out-date">退房日</label>
            <input id="st-out-date" name="checkOutDate" type="date" value="${v.checkOutDate}" />
          </div>
          <div class="field">
            <label for="st-out-time">退房時間</label>
            <input id="st-out-time" name="checkOutTime" type="time" value="${v.checkOutTime}" />
          </div>
        </div>
        <p class="field__hint" data-nights></p>

        <div class="field">
          <label for="st-platform">訂房平台</label>
          <input id="st-platform" ${raw(TEXT_ATTRS)} name="platform" maxlength="${LIMITS.platform}"
                 placeholder="例如：Agoda" value="${v.platform}" />
          <div class="quick-picks">
            ${PLATFORM_PICKS.map((p) => html`<button type="button" class="tag tag--btn" data-platform="${p}">${p}</button>`)}
          </div>
        </div>

        <div class="field">
          <label for="st-ref">訂房代號</label>
          <input id="st-ref" ${raw(TEXT_ATTRS)} name="bookingRef" maxlength="${LIMITS.bookingRef}"
                 placeholder="例如：1234567890" value="${v.bookingRef}" />
        </div>

        <div class="field">
          <label for="st-notes">備註</label>
          <textarea id="st-notes" name="notes" rows="3" maxlength="${LIMITS.notes}"
                    autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
                    placeholder="例如：含早餐、可寄放行李">${v.notes}</textarea>
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
      const errorsBox = panel.querySelector(".form__errors");
      const inDate = form.elements.checkInDate;
      const outDate = form.elements.checkOutDate;
      const nightsBox = panel.querySelector("[data-nights]");

      mountPlaceField(panel.querySelector("[data-hotel]"), {
        label: "飯店",
        emptyText: "選擇飯店",
        iconName: "hotel",
        category: "hotel",
        tripId: tripId || (stay && stay.tripId) || "",
        pickerTitle: "選擇飯店",
        value: placeId,
        onChange: (id) => (placeId = id),
      });

      // 退房日的日曆最早只能選到入住日；兩個日期都有時顯示「共 N 晚」
      function syncDates() {
        outDate.min = inDate.value || "";
        const n = nightsOf({ checkInDate: inDate.value, checkOutDate: outDate.value });
        nightsBox.textContent = n === null ? "" : n === 0 ? "當天退房（不過夜）" : `共 ${n} 晚`;
        nightsBox.hidden = n === null;
      }
      inDate.addEventListener("change", () => {
        if (inDate.value && outDate.value && outDate.value < inDate.value) outDate.value = inDate.value;
        syncDates();
      });
      outDate.addEventListener("change", syncDates);
      syncDates();

      panel.querySelectorAll("[data-platform]").forEach((btn) =>
        btn.addEventListener("click", () => {
          form.elements.platform.value = btn.dataset.platform;
        })
      );

      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const el = form.elements;
        const input = {
          placeId,
          checkInDate: inDate.value,
          checkInTime: el.checkInTime.value,
          checkOutDate: outDate.value,
          checkOutTime: el.checkOutTime.value,
          platform: el.platform.value,
          bookingRef: el.bookingRef.value,
          notes: el.notes.value,
        };
        const result = isEdit ? accommodationStore.update(stay.id, input) : accommodationStore.create(tripId, input);
        if (!result.ok) {
          render(errorsBox, html`${result.errors.map((err) => html`<div>${err}</div>`)}`);
          errorsBox.hidden = false;
          return;
        }
        close();
        if (onSaved) onSaved(result.stay);
      });

      panel.querySelector('[data-action="cancel"]').addEventListener("click", close);
    },
  });
}
