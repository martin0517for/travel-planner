/**
 * placeList.js — 地點資料庫頁（所有旅程共用，從右上角地點圖示進入）。
 *
 * 版面（由上到下）：
 *   搜尋框（只搜尋手機裡已存的地點，不會連網）
 *   地區篩選列（全部／東京／京都…，可以左右滑動）
 *   分類篩選列（全部／景點／餐廳…）
 *   地點列表：分類圖示、名稱、地區・地址、標籤
 *
 * 篩選條件存在這個檔案的變數裡：離開再回來時會保留，關掉 App 後重置。
 *
 * 快速加入（計畫書 9.2 第 ④ 小步，2026-11-01 使用者決定）：
 *   只有從某趟旅程裡打開時（trip 有值）才出現。每個地點左邊一個圓圈（跟「加入想去的地點」畫面同一種）：
 *   空心＝不在這趟清單，點一下直接加入；實心打勾＝已在清單，點一下先確認再移除。
 *   已排入（航班、住宿使用中）的不能移除，跳出提醒用在哪裡。
 *   點地點其他地方照常打開地點預覽。
 */
import { html, render } from "../../core/html.js";
import { icon } from "../../core/icons.js";
import { placeStore, PLACE_CATEGORIES, categoryLabel } from "../../data/places.js";
import { isValidLatLng } from "../../core/geo.js";
import { openPlaceForm } from "./placeForm.js";
import { openPlaceDetail } from "./placeDetail.js";
import { tripPlaceStore } from "../../data/tripPlaces.js";
import { tripUsages } from "../../data/tripPlaceUsage.js";

const filters = { area: "", category: "", q: "" };
let currentTrip = null; // 從某趟旅程裡打開時的那趟旅程（快速加入用）

export function renderPlaceList(container, { trip = null } = {}) {
  currentTrip = trip;
  paint(container);
  return { eyebrow: "Places", title: "地點資料庫" };
}

function paint(container) {
  const places = placeStore.list();
  const areas = placeStore.areas();
  if (filters.area && !areas.includes(filters.area)) filters.area = "";

  // 重畫前記住兩排篩選列左右捲到哪裡（2026-10-13 實機：點右邊的分類後，整排會跳回最左邊）
  const chipScroll = {};
  container.querySelectorAll(".chips[aria-label]").forEach((row) => {
    chipScroll[row.getAttribute("aria-label")] = row.scrollLeft;
  });

  render(
    container,
    html`
      ${places.length === 0
        ? html`
            <div class="empty">
              <div class="empty__icon">${icon("places")}</div>
              <h2>還沒有任何地點</h2>
              <p>把想去的景點、餐廳、飯店先存進來，之後排行程、記清單都可以直接選用。</p>
              <button type="button" class="btn btn--primary" data-action="add">${icon("plus")}新增地點</button>
            </div>
          `
        : html`
            ${currentTrip
              ? html`<p class="field__hint quick-add-hint">點左邊圓圈，加入「${currentTrip.name}」的想去地點</p>`
              : ""}
            <div class="place-toolbar">
              <label class="search-box">
                ${icon("search")}
                <span class="sr-only">搜尋地點</span>
                <input type="search" id="place-q" placeholder="搜尋名稱、地址、標籤" value="${filters.q}"
                       autocomplete="off" enterkeyhint="search" />
              </label>
              <button type="button" class="btn btn--primary btn--icon" data-action="add" aria-label="新增地點">${icon("plus")}</button>
            </div>

            ${areas.length
              ? html`
                  <div class="chips" role="group" aria-label="地區">
                    ${chip("area", "", "全部地區", filters.area === "")}
                    ${areas.map((a) => chip("area", a, a, filters.area === a))}
                  </div>
                `
              : ""}
            <div class="chips" role="group" aria-label="分類">
              ${chip("category", "", "全部", filters.category === "")}
              ${PLACE_CATEGORIES.map((c) => chip("category", c.value, c.label, filters.category === c.value, c.value))}
            </div>

            <div class="place-results" id="place-results"></div>
          `}
    `
  );

  container.querySelectorAll('[data-action="add"]').forEach((btn) =>
    btn.addEventListener("click", () =>
      openPlaceForm({ defaults: { area: filters.area, category: filters.category }, onSaved: () => paint(container) })
    )
  );

  // 還原篩選列的左右位置；若選中的那顆沒有完整露出，再輕輕捲到看得見
  container.querySelectorAll(".chips[aria-label]").forEach((row) => {
    const saved = chipScroll[row.getAttribute("aria-label")];
    if (saved) row.scrollLeft = saved;
    const active = row.querySelector(".chip.is-active");
    if (!active) return;
    const r = row.getBoundingClientRect();
    const a = active.getBoundingClientRect();
    if (a.left < r.left) row.scrollLeft -= r.left - a.left + 16;
    else if (a.right > r.right) row.scrollLeft += a.right - r.right + 16;
  });

  container.querySelectorAll("[data-filter]").forEach((btn) =>
    btn.addEventListener("click", () => {
      filters[btn.dataset.filter] = btn.dataset.value;
      paint(container);
    })
  );

  const q = container.querySelector("#place-q");
  if (q) {
    q.addEventListener("input", () => {
      filters.q = q.value;
      paintResults(container, places);
    });
    paintResults(container, places);
  }
}

function chip(filter, value, label, active, category) {
  return html`
    <button type="button" class="chip ${active ? "is-active" : ""} ${category ? `chip--cat cat--${category}` : ""}"
            data-filter="${filter}" data-value="${value}" aria-pressed="${active ? "true" : "false"}">
      ${category ? icon(category) : ""}${label}
    </button>
  `;
}

/** 只重畫列表部分（打字搜尋時不重畫搜尋框，游標和鍵盤才不會跳掉） */
function paintResults(container, places) {
  const box = container.querySelector("#place-results");
  const q = filters.q.trim().toLowerCase();
  const shown = places.filter(
    (p) =>
      (!filters.area || p.area === filters.area) &&
      (!filters.category || p.category === filters.category) &&
      (!q || [p.name, p.address, p.area, p.notes, p.geoQuery, ...p.tags].some((t) => t.toLowerCase().includes(q)))
  );

  const inTrip = currentTrip ? tripPlaceStore.placeIdsOf(currentTrip.id) : null;
  render(
    box,
    shown.length
      ? html`
          <div class="place-count">${shown.length} 個地點</div>
          <ul class="place-list">${shown.map((p) => placeRow(p, inTrip))}</ul>
        `
      : html`<p class="muted center">沒有符合條件的地點。</p>`
  );

  box.querySelectorAll("[data-quick]").forEach((btn) =>
    btn.addEventListener("click", () => toggleQuick(btn.dataset.quick, () => paintResults(container, places)))
  );
  box.querySelectorAll("[data-place]").forEach((row) =>
    row.addEventListener("click", () => {
      const place = placeStore.get(row.dataset.place);
      if (place) openPlaceDetail({ place, onChanged: () => paint(container) });
    })
  );
}

/** 快速加入：不在清單 → 直接加入；已在清單 → 確認後移除（已排入的不能移除） */
function toggleQuick(placeId, done) {
  const trip = currentTrip;
  const place = placeStore.get(placeId);
  if (!trip || !place) return;
  const entry = tripPlaceStore.listByTrip(trip.id).find((t) => t.placeId === placeId);
  let result;
  if (!entry) {
    result = tripPlaceStore.addMany(trip.id, [placeId]);
  } else {
    const used = tripUsages(trip.id, placeId);
    if (used.length) {
      window.alert(`「${place.name}」用在：${used.map((u) => u.full).join("、")}。\n要先從那裡移除，才能移出清單。`);
      return;
    }
    if (!window.confirm(`要把「${place.name}」從「${trip.name}」的清單移除嗎？\n（地點資料庫裡的資料不會被刪除）`)) return;
    result = tripPlaceStore.remove(entry.id);
  }
  if (!result.ok) {
    window.alert(result.errors.join("\n"));
    return;
  }
  done();
}

function placeRow(p, inTrip) {
  const sub = [p.area, p.address].filter(Boolean).join("・");
  const quick = inTrip
    ? html`
        <button type="button" class="quick-add" data-quick="${p.id}" role="checkbox"
                aria-checked="${inTrip.has(p.id) ? "true" : "false"}" aria-label="加入想去的地點：${p.name}">
          <span class="adder-check ${inTrip.has(p.id) ? "is-on" : ""}" aria-hidden="true">${icon("check")}</span>
        </button>
      `
    : "";
  return html`
    <li class="${inTrip ? "tp-row" : ""}">
      ${quick}
      <button type="button" class="place-row ${inTrip ? "tp-row__main" : ""}" data-place="${p.id}">
        <span class="place-row__icon cat--${p.category}" title="${categoryLabel(p.category)}">${icon(p.category)}</span>
        <span class="place-row__body">
          <span class="place-row__name">${p.name}</span>
          ${sub ? html`<span class="place-row__sub">${sub}</span>` : ""}
          ${p.tags.length ? html`<span class="tag-list">${p.tags.map((t) => html`<span class="tag">${t}</span>`)}</span>` : ""}
        </span>
        ${isValidLatLng(p.lat, p.lng) ? "" : html`<span class="place-row__nocoord" title="尚未設定座標">未定位</span>`}
      </button>
    </li>
  `;
}
