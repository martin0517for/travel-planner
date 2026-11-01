/**
 * flightForm.js — 新增／編輯航班（整頁表單）。
 *
 * openFlightForm({ tripId, flight, onSaved })
 *   flight 為 null → 新增；有值 → 編輯
 *
 * 欄位全部可以空白，但至少要填一項。時間填機票上的當地時間。
 * 出發／抵達機場：按下去開「選地點畫面」（預先篩選「交通」分類，可以切到全部），
 * 選好後顯示機場名稱與地區，右邊有「清除」。
 */
import { html, raw, render } from "../../core/html.js";
import { openSheet } from "../../core/sheet.js";
import { flightStore, FLIGHT_DIRECTIONS, LIMITS } from "../../data/flights.js";
import { placeStore } from "../../data/places.js";
import { icon } from "../../core/icons.js";
import { openPlacePicker } from "../places/placePicker.js";

// 所有文字欄位用同一組設定（同一種鍵盤，避免切換欄位時鍵盤高度不同而跳動）
const TEXT_ATTRS = 'autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" type="search" enterkeyhint="done"';

export function openFlightForm({ tripId, flight = null, onSaved } = {}) {
  const isEdit = Boolean(flight);
  const v = flight || {
    direction: "other", airline: "", flightNo: "", departurePlaceId: "", departureTime: "",
    arrivalPlaceId: "", arrivalTime: "", bookingRef: "", seat: "", notes: "",
  };
  // 目前選的機場（按「儲存」才會寫入）
  const airports = { departure: v.departurePlaceId, arrival: v.arrivalPlaceId };

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

        <div class="field" data-airport="departure"></div>
        <div class="field">
          <label for="fl-dep-time">出發時間（當地）</label>
          <input id="fl-dep-time" name="departureTime" type="datetime-local" value="${v.departureTime}" />
        </div>

        <div class="field" data-airport="arrival"></div>
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

      // 畫出機場欄位，並綁定「選擇」「清除」
      const AIRPORT_LABELS = { departure: "出發機場", arrival: "抵達機場" };
      function paintAirport(key) {
        const box = panel.querySelector(`[data-airport="${key}"]`);
        render(box, airportField(AIRPORT_LABELS[key], airports[key]));
        box.querySelector("[data-pick]").addEventListener("click", () =>
          openPlacePicker({
            title: `選擇${AIRPORT_LABELS[key]}`,
            category: "transport", // 2026-11-01 機場併入交通
            selectedId: airports[key],
            onPick: (place) => {
              airports[key] = place.id;
              paintAirport(key);
            },
          })
        );
        const clear = box.querySelector("[data-clear]");
        if (clear)
          clear.addEventListener("click", () => {
            airports[key] = "";
            paintAirport(key);
          });
      }
      paintAirport("departure");
      paintAirport("arrival");

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
        close();
        if (onSaved) onSaved(result.flight);
      });

      panel.querySelector('[data-action="cancel"]').addEventListener("click", close);
    },
  });
}

/** 機場欄位：沒選時顯示「選擇機場」；選了顯示名稱＋地區，右邊有「清除」 */
function airportField(label, placeId) {
  const place = placeId ? placeStore.get(placeId) : null;
  const missing = placeId && !place; // 存了 id，但地點已經不存在
  return html`
    <div class="field__legend">${label}</div>
    <div class="picker-field">
      <button type="button" class="picker-btn ${place ? "has-value" : ""}" data-pick>
        ${icon("plane")}
        <span class="picker-btn__text">
          ${place
            ? html`<span class="picker-btn__name">${place.name}</span>${place.area ? html`<span class="picker-btn__sub">${place.area}</span>` : ""}`
            : html`<span class="is-empty">${missing ? "（地點已刪除）請重新選擇" : "選擇機場"}</span>`}
        </span>
      </button>
      ${placeId ? html`<button type="button" class="btn btn--small" data-clear>清除</button>` : ""}
    </div>
  `;
}
