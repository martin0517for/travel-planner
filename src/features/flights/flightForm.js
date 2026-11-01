/**
 * flightForm.js — 新增／編輯航班（整頁表單）。
 *
 * openFlightForm({ tripId, flight, defaults, note, onSaved })
 *   flight 為 null → 新增；有值 → 編輯
 *   defaults／note：從行程頁新增時預先帶入的欄位、表單最上方的說明（v0.8.3）
 * 存好後有出發時間 → 清掉行程頁「排進來」的紀錄（改照日期出現）。
 *
 * 欄位全部可以空白，但至少要填一項。時間填機票上的當地時間。
 * 出發／抵達機場：按下去開「選地點畫面」（預先篩選「交通」分類，可以切到全部），
 * 選好後顯示機場名稱與地區，右邊有「清除」。
 */
import { html, raw, render } from "../../core/html.js";
import { openSheet } from "../../core/sheet.js";
import { clearLabel, wireClearButtons } from "../../core/fieldClear.js";
import { flightStore, FLIGHT_DIRECTIONS, LIMITS } from "../../data/flights.js";
import { mountPlaceField } from "../places/placePicker.js";
import { afterSaved } from "../schedule/scheduleLinks.js";

// 所有文字欄位用同一組設定（同一種鍵盤，避免切換欄位時鍵盤高度不同而跳動）
const TEXT_ATTRS = 'autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" type="search" enterkeyhint="done"';

export function openFlightForm({ tripId, flight = null, defaults = {}, note = "", onSaved } = {}) {
  const isEdit = Boolean(flight);
  const v = flight || {
    direction: "other", airline: "", flightNo: "", departurePlaceId: "", departureTime: "",
    arrivalPlaceId: "", arrivalTime: "", bookingRef: "", seat: "", notes: "", ...defaults,
  };
  // 目前選的機場（按「儲存」才會寫入）
  const airports = { departure: v.departurePlaceId, arrival: v.arrivalPlaceId };

  openSheet({
    title: isEdit ? "編輯航班" : "新增航班",
    body: html`
      <form class="form" novalidate>
        ${note ? html`<p class="field__hint">${note}</p>` : ""}
        <fieldset class="field">
          <legend class="field__legend">類型</legend>
          <div class="chips chips--wrap">
            ${FLIGHT_DIRECTIONS.map(
              (d) => html`
                <label class="chip chip--radio chip--plain">
                  <input type="radio" name="direction" value="${d.value}" ${d.value === v.direction ? "checked" : ""} />
                  ${d.label}
                </label>
              `
            )}
          </div>
        </fieldset>

        <div class="field-row">
          <div class="field">
            <label for="fl-no">航班號碼</label>
            <input id="fl-no" ${raw(TEXT_ATTRS)} name="flightCode" maxlength="${LIMITS.flightNo}"
                   class="is-upper" placeholder="例如：BR198" value="${v.flightNo}" />
          </div>
          <div class="field">
            <label for="fl-airline">航空公司</label>
            <input id="fl-airline" ${raw(TEXT_ATTRS)} name="airline" maxlength="${LIMITS.airline}"
                   placeholder="例如：長榮航空" value="${v.airline}" />
          </div>
        </div>

        <div class="field" data-airport="departure"></div>
        <div class="field">
          ${clearLabel("fl-dep-time", "出發時間（當地）")}
          <input id="fl-dep-time" name="departureTime" type="datetime-local" value="${v.departureTime}" />
        </div>

        <div class="field" data-airport="arrival"></div>
        <div class="field">
          ${clearLabel("fl-arr-time", "抵達時間（當地）")}
          <input id="fl-arr-time" name="arrivalTime" type="datetime-local" value="${v.arrivalTime}" />
        </div>
        <p class="field__hint">時間照機票填當地時間，例如出發填台灣時間、抵達填日本時間。</p>

        <div class="field-row">
          <div class="field">
            <label for="fl-ref">訂位代號</label>
            <input id="fl-ref" ${raw(TEXT_ATTRS)} name="bookingRef" maxlength="${LIMITS.bookingRef}"
                   class="is-upper" placeholder="例如：6ABC2D" value="${v.bookingRef}" />
          </div>
          <div class="field">
            <label for="fl-seat">座位</label>
            <input id="fl-seat" ${raw(TEXT_ATTRS)} name="seat" maxlength="${LIMITS.seat}"
                   class="is-upper" placeholder="例如：32A" value="${v.seat}" />
          </div>
        </div>

        <div class="field">
          <label for="fl-notes">備註</label>
          <textarea id="fl-notes" name="notes" rows="3" maxlength="${LIMITS.notes}"
                    autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
                    placeholder="例如：行李 23kg × 2">${v.notes}</textarea>
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

      // 機場欄位（選地點畫面預先篩選「交通」，2026-11-01 機場併入交通）
      const AIRPORT_LABELS = { departure: "出發機場", arrival: "抵達機場" };
      for (const key of ["departure", "arrival"]) {
        mountPlaceField(panel.querySelector(`[data-airport="${key}"]`), {
          label: AIRPORT_LABELS[key],
          emptyText: "選擇機場",
          iconName: "plane",
          category: "transport",
          tripId: tripId || (flight && flight.tripId) || "",
          pickerTitle: `選擇${AIRPORT_LABELS[key]}`,
          value: airports[key],
          onChange: (id) => (airports[key] = id),
        });
      }

      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const el = form.elements;
        const input = {
          direction: el.direction.value,
          airline: el.airline.value,
          flightNo: el.flightCode.value,
          departurePlaceId: airports.departure,
          departureTime: el.departureTime.value,
          arrivalPlaceId: airports.arrival,
          arrivalTime: el.arrivalTime.value,
          bookingRef: el.bookingRef.value,
          seat: el.seat.value,
          notes: el.notes.value,
        };
        const result = isEdit ? flightStore.update(flight.id, input) : flightStore.create(tripId, input);
        if (!result.ok) {
          render(errorsBox, html`${result.errors.map((err) => html`<div>${err}</div>`)}`);
          errorsBox.hidden = false;
          return;
        }
        afterSaved("flight", result.flight);
        close();
        if (onSaved) onSaved(result.flight);
      });

      panel.querySelector('[data-action="cancel"]').addEventListener("click", close);
    },
  });
}
