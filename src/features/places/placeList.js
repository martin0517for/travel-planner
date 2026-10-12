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
 */
import { html, render } from "../../core/html.js";
import { icon } from "../../core/icons.js";
import { placeStore, PLACE_CATEGORIES, categoryLabel } from "../../data/places.js";
import { isValidLatLng } from "../../core/geo.js";
import { openPlaceForm } from "./placeForm.js";
import { openPlaceDetail } from "./placeDetail.js";

const filters = { area: "", category: "", q: "" };

export function renderPlaceList(container) {
  paint(container);
  return { eyebrow: "Places", title: "地點資料庫" };
}

function paint(container) {
  const places = placeStore.list();
  const areas = placeStore.areas();
  if (filters.area && !areas.includes(filters.area)) filters.area = "";

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
      (!q || [p.name, p.searchName, p.address, p.area, p.notes, ...p.tags].some((t) => t.toLowerCase().includes(q)))
  );

  render(
    box,
    shown.length
      ? html`
          <div class="place-count">${shown.length} 個地點</div>
          <ul class="place-list">${shown.map(placeRow)}</ul>
        `
      : html`<p class="muted center">沒有符合條件的地點。</p>`
  );

  box.querySelectorAll("[data-place]").forEach((row) =>
    row.addEventListener("click", () => {
      const place = placeStore.get(row.dataset.place);
      if (place) openPlaceDetail({ place, onChanged: () => paint(container) });
    })
  );
}

function placeRow(p) {
  const sub = [p.area, p.address].filter(Boolean).join("・");
  return html`
    <li>
      <button type="button" class="place-row" data-place="${p.id}">
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
