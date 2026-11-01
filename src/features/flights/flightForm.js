/**
 * flightForm.js — 新增／編輯航班（整頁表單）。
 *
 * openFlightForm({ tripId, flight, onSaved })
 *   flight 為 null → 新增；有值 → 編輯
 *
 * 欄位全部可以空白，但至少要填一項。時間填機票上的當地時間。
 * 出發／抵達機場：第 2 步（選地點畫面）做好後才能選，目前只顯示「尚未選擇」，
 * 編輯時原本存的機場 id 會原樣保留。
 */
import { html, raw, render } from "../../core/html.js";
import { openSheet } from "../../core/sheet.js";
import { flightStore, FLIGHT_DIRECTIONS, LIMITS } from "../../data/flights.js";
import { placeStore } from "../../data/places.js";

// 所有文字欄位用同一組設定（同一種鍵盤，避免切換欄位時鍵盤高度不同而跳動）
const TEXT_ATTRS = 'autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" type="search" enterkeyhint="done"';

export function openFlightForm({ tripId, flight = null, onSaved } = {}) {
  const isEdit = Boolean(flight);
  const v = flight || {
    direction: "other", airline: "", flightNo: "", departurePlaceId: "", departureTime: "",
    arrivalPlaceId: "", arrivalTime: "", bookingRef: "", seat: "", notes: "",
  };
  // 機場目前不能在表單裡改，先記住原本的值
  const departurePlaceId = v.departurePlaceId;
  const arrivalPlaceId = v.arrivalPlaceId;

  openSheet({
    title: isEdit ? "編輯航班" : "新增航班",
    body: html`
      <form class="form" novalidate>
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

        ${airportField("出發機場", departurePlaceId)}
        <div class="field">
          <label for="fl-dep-time">出發時間（當地）</label>
          <input id="fl-dep-time" name="departureTime" type="datetime-local" value="${v.departureTime}" />
        </div>

        ${airportField("抵達機場", arrivalPlaceId)}
        <div class="field">
          <label for="fl-arr-time">抵達時間（當地）</label>
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
      const errorsBox = panel.querySelector(".form__errors");

      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const el = form.elements;
        const input = {
          direction: el.direction.value,
          airline: el.airline.value,
          flightNo: el.flightCode.value,
          departurePlaceId,
          departureTime: el.departureTime.value,
          arrivalPlaceId,
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
        close();
        if (onSaved) onSaved(result.flight);
      });

      panel.querySelector('[data-action="cancel"]').addEventListener("click", close);
    },
  });
}

/** 機場欄位（暫時版）：顯示目前存的機場名稱，或「尚未選擇」 */
function airportField(label, placeId) {
  const place = placeId ? placeStore.get(placeId) : null;
  return html`
    <div class="field">
      <div class="field__legend">${label}</div>
      <button type="button" class="picker-btn" disabled>
        <span class="picker-btn__text ${place ? "" : "is-empty"}">${place ? place.name : "尚未選擇"}</span>
      </button>
      <p class="field__hint field__hint--tight">下一步做好「選地點畫面」後，就能從地點資料庫選機場。</p>
    </div>
  `;
}
