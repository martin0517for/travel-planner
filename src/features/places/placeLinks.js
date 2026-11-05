/**
 * placeLinks.js — 「多個地點」的共用畫面：活動、筆記都用（v0.12.0，2026-11-03）。
 *
 * mountPlaceListField(box, { tripId, pickerTitle, placeIds, max, emptyText })
 *   表單裡的地點欄位：已選的地點（編號、分類圖示、名稱、地區，右邊 ▲▼ 調整順序、× 移除）
 *   ＋「選擇地點」按鈕（開多選畫面 placeMultiPicker.js）。回傳 { get() } 取得目前的地點 id。
 *   原本寫在 activityForm.js，筆記也要用，搬到這裡（畫面沒有改）。
 *
 * detailPlaceList(placeIds, { clickable })
 *   預覽裡的地點列表：每列是一顆按鈕（點了看地點預覽，名稱右邊有 ›），右邊「導航」。
 *   clickable＝false（v0.12.1，疊上來的筆記預覽）：只顯示、不能點，導航照常。
 *   地點已刪除的顯示「（地點已刪除）」、不能點。
 *
 * wirePlaceLinks(panel, { tripId, backLabel })
 *   綁定預覽裡的地點按鈕：打開這趟「想去的地點」的地點預覽，疊在原本的預覽上面（N-6）；
 *   關掉就回到原本的筆記／活動預覽。地點不在這趟清單時（理論上存檔時會自動加入），改開地點資料庫的預覽。
 *
 * 資安：只用存在資料裡、檢查過格式的地點 id；名稱一律跳脫；導航只用 navigationUrl（http/https）。
 */
import { html, render } from "../../core/html.js";
import { icon } from "../../core/icons.js";
import { navigationUrl } from "../../core/geo.js";
import { placeStore, categoryLabel } from "../../data/places.js";
import { tripPlaceStore } from "../../data/tripPlaces.js";
import { tripStore } from "../../data/trips.js";
import { tripUsages } from "../../data/tripPlaceUsage.js";
import { openPlaceMultiPicker } from "./placeMultiPicker.js";
import { openPlaceDetail } from "./placeDetail.js";
import { openTripPlaceDetail } from "../lists/tripPlaceDetail.js";

// ---- 表單欄位 ----

export function mountPlaceListField(box, { tripId, pickerTitle = "選擇地點", placeIds = [], max = 30, emptyText = "選擇地點（可以選很多個）" }) {
  let ids = [...placeIds]; // 目前選的地點（按「儲存」才會寫入）

  function paint() {
    render(
      box,
      html`
        <div class="field__legend">地點${ids.length ? html`<span class="act-count">${ids.length}</span>` : ""}</div>
        ${ids.length ? html`<ol class="act-places">${ids.map((id, i) => formRow(id, i, ids.length))}</ol>` : ""}
        <button type="button" class="picker-btn" data-action="pick-places">
          ${icon("plus")}
          <span class="picker-btn__text"><span class="is-empty">${ids.length ? "增加或取消地點" : emptyText}</span></span>
        </button>
      `
    );
    box.querySelector('[data-action="pick-places"]').addEventListener("click", () =>
      openPlaceMultiPicker({
        title: pickerTitle,
        tripId,
        selectedIds: ids,
        max,
        onDone: (next) => {
          ids = next;
          paint();
        },
      })
    );
    box.querySelectorAll("[data-move]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const i = Number(btn.dataset.index);
        const j = btn.dataset.move === "up" ? i - 1 : i + 1;
        if (j < 0 || j >= ids.length) return;
        [ids[i], ids[j]] = [ids[j], ids[i]];
        paint();
        // 重畫後把焦點留在同一個地點的同一顆按鈕上，連續點比較順
        const again = box.querySelector(`[data-move="${btn.dataset.move}"][data-index="${j}"]`);
        if (again && !again.disabled) again.focus({ preventScroll: true });
      })
    );
    box.querySelectorAll("[data-remove]").forEach((btn) =>
      btn.addEventListener("click", () => {
        ids.splice(Number(btn.dataset.remove), 1);
        paint();
      })
    );
  }
  paint();

  return {
    /** 已刪除的地點不存 */
    get: () => ids.filter((id) => placeStore.get(id)),
  };
}

function formRow(id, index, total) {
  const p = placeStore.get(id);
  return html`
    <li class="act-place">
      <span class="act-place__num">${index + 1}</span>
      ${p
        ? html`<span class="place-row__icon cat--${p.category}" title="${categoryLabel(p.category)}">${icon(p.category)}</span>
            <span class="act-place__body">
              <span class="act-place__name">${p.name}</span>
              ${p.area ? html`<span class="act-place__sub">${p.area}</span>` : ""}
            </span>`
        : html`<span class="act-place__body"><span class="act-place__name is-missing">（地點已刪除）</span></span>`}
      <button type="button" class="act-place__btn" data-move="up" data-index="${index}" aria-label="往上移"
              ${index === 0 ? html`disabled` : ""}>${icon("up")}</button>
      <button type="button" class="act-place__btn" data-move="down" data-index="${index}" aria-label="往下移"
              ${index === total - 1 ? html`disabled` : ""}>${icon("down")}</button>
      <button type="button" class="act-place__btn" data-remove="${index}" aria-label="移除這個地點">${icon("remove")}</button>
    </li>
  `;
}

// ---- 預覽 ----

export function detailPlaceList(placeIds, { clickable = true } = {}) {
  return html`<ol class="act-places act-places--detail">${placeIds.map((id, i) => detailRow(placeStore.get(id), i, clickable))}</ol>`;
}

function detailRow(place, index, clickable = true) {
  if (!place) {
    return html`
      <li class="act-place">
        <span class="act-place__num">${index + 1}</span>
        <span class="act-place__body"><span class="act-place__name is-missing">（地點已刪除）</span></span>
      </li>
    `;
  }
  const nav = navigationUrl(place);
  if (!clickable) {
    return html`
      <li class="act-place">
        <span class="act-place__num">${index + 1}</span>
        <span class="place-row__icon cat--${place.category}" title="${categoryLabel(place.category)}">${icon(place.category)}</span>
        <span class="act-place__body">
          <span class="act-place__name">${place.name}</span>
          ${place.area ? html`<span class="act-place__sub">${place.area}</span>` : ""}
        </span>
        ${nav
          ? html`<a class="btn btn--small act-place__nav" href="${nav}" target="_blank" rel="noopener noreferrer">${icon("navigate")}導航</a>`
          : ""}
      </li>
    `;
  }
  return html`
    <li class="act-place">
      <button type="button" class="act-place__open" data-open-place="${place.id}" aria-label="看「${place.name}」的地點資料">
        <span class="act-place__num">${index + 1}</span>
        <span class="place-row__icon cat--${place.category}" title="${categoryLabel(place.category)}">${icon(place.category)}</span>
        <span class="act-place__body">
          <span class="act-place__name">${place.name}</span>
          ${place.area ? html`<span class="act-place__sub">${place.area}</span>` : ""}
        </span>
        <span class="act-place__more" aria-hidden="true">${icon("back")}</span>
      </button>
      ${nav
        ? html`<a class="btn btn--small act-place__nav" href="${nav}" target="_blank" rel="noopener noreferrer">${icon("navigate")}導航</a>`
        : ""}
    </li>
  `;
}

/** 點地點 → 疊上這趟「想去的地點」的地點預覽（關掉回到原本的預覽） */
export function wirePlaceLinks(panel, { tripId, backLabel = "返回" }) {
  panel.querySelectorAll("[data-open-place]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const place = placeStore.get(btn.dataset.openPlace);
      if (!place) return;
      const trip = tripStore.get(tripId);
      const entry = trip && tripPlaceStore.listByTrip(trip.id).find((t) => t.placeId === place.id);
      if (entry) {
        openTripPlaceDetail({ entry, place, trip, usedIn: tripUsages(trip.id, place.id), stacked: true, backLabel });
      } else {
        openPlaceDetail({ place, stacked: true, backLabel });
      }
    })
  );
}
