/**
 * placePicker.js — 選地點畫面（Place Picker），航班選機場、住宿選飯店共用（2026-11-01）。
 *
 * openPlacePicker({ title, category, selectedId, onPick })
 *   title       畫面標題，例如「選擇出發機場」
 *   category    預先選好的分類篩選（例如 "airport"），使用者可以切到「全部」
 *   selectedId  目前已選的地點，清單上會打勾
 *   onPick(place)  選好之後呼叫（畫面會自己關閉）
 *
 * 版面：搜尋框＋「新增地點」按鈕 → 地區篩選列 → 分類篩選列 → 地點清單。
 * 有搜尋框，所以照「要打字的畫面一律整頁」的規則，以整頁顯示，疊在原本的表單上面；
 * 關閉後回到原本的表單，已經填的內容不會不見。
 *
 * 找不到時可以直接新增：開完整的地點表單，名稱帶入搜尋框的文字、分類帶入預設分類，
 * 存好後自動選中並回到原本的表單。
 *
 * 之後做「旅程地點清單」（計畫書 9.2）時，這裡要把這趟旅程的地點排在最前面。
 */
import { html, render } from "../../core/html.js";
import { icon } from "../../core/icons.js";
import { openSheet } from "../../core/sheet.js";
import { placeStore, PLACE_CATEGORIES, categoryLabel } from "../../data/places.js";
import { openPlaceForm } from "./placeForm.js";

export function openPlacePicker({ title = "選擇地點", category = "", selectedId = "", onPick } = {}) {
  const filters = { area: "", category, q: "" };

  openSheet({
    title,
    body: html`
      <div class="place-toolbar">
        <label class="search-box">
          ${icon("search")}
          <span class="sr-only">搜尋地點</span>
          <input type="search" id="picker-q" placeholder="搜尋名稱、地區、地址" autocomplete="off"
                 autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" />
        </label>
        <button type="button" class="btn btn--primary btn--icon" data-action="add" aria-label="新增地點">${icon("plus")}</button>
      </div>
      <div class="picker-filters"></div>
      <div class="picker-results"></div>
    `,
    onMount(panel, close) {
      const q = panel.querySelector("#picker-q");
      const filtersBox = panel.querySelector(".picker-filters");
      const resultsBox = panel.querySelector(".picker-results");

      function pick(place) {
        close();
        if (onPick) onPick(place);
      }

      function paintFilters() {
        const areas = placeStore.areas();
        if (filters.area && !areas.includes(filters.area)) filters.area = "";
        render(
          filtersBox,
          html`
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
          `
        );
        // 選中的篩選鈕若沒有完整露出，捲到看得見（例如「機場」在最右邊）
        filtersBox.querySelectorAll(".chips").forEach((row) => {
          const active = row.querySelector(".chip.is-active");
          if (active) row.scrollLeft = Math.max(0, active.offsetLeft - row.clientWidth + active.offsetWidth + 16);
        });
        filtersBox.querySelectorAll("[data-filter]").forEach((btn) =>
          btn.addEventListener("click", () => {
            const row = btn.closest(".chips");
            const scroll = row.scrollLeft;
            filters[btn.dataset.filter] = btn.dataset.value;
            paintFilters();
            // 保留篩選列原本的左右位置（同地點資料庫 2026-10-13 的修正）
            const label = row.getAttribute("aria-label");
            const newRow = filtersBox.querySelector(`.chips[aria-label="${label}"]`);
            if (newRow) newRow.scrollLeft = scroll;
            paintResults();
          })
        );
      }

      /** 只重畫清單（打字搜尋時不重畫搜尋框，游標和鍵盤才不會跳掉） */
      function paintResults() {
        const all = placeStore.list();
        const text = filters.q.trim().toLowerCase();
        const shown = all.filter(
          (p) =>
            (!filters.area || p.area === filters.area) &&
            (!filters.category || p.category === filters.category) &&
            (!text || [p.name, p.area, p.address, p.geoQuery, ...p.tags].some((t) => t.toLowerCase().includes(text)))
        );
        const filtered = Boolean(filters.area || filters.category || text);

        render(
          resultsBox,
          html`
            ${shown.length
              ? html`<ul class="place-list">${shown.map((p) => pickerRow(p, p.id === selectedId))}</ul>`
              : html`<p class="muted center">${all.length ? "沒有符合條件的地點。" : "地點資料庫還是空的。"}</p>`}
            ${filtered && all.length
              ? html`<p class="field__hint center">找不到？可以切到「全部」，或按右上角「＋」新增。</p>`
              : ""}
            <button type="button" class="btn btn--ghost btn--block picker-add" data-action="add">
              ${icon("plus")}<span class="btn__label">${text ? `新增「${filters.q.trim()}」` : "新增地點"}</span>
            </button>
          `
        );
        resultsBox.querySelectorAll("[data-pick]").forEach((row) =>
          row.addEventListener("click", () => {
            const place = placeStore.get(row.dataset.pick);
            if (place) pick(place);
          })
        );
        resultsBox.querySelector('[data-action="add"]').addEventListener("click", addPlace);
      }

      function addPlace() {
        openPlaceForm({
          defaults: { name: filters.q.trim(), category: filters.category || category, area: filters.area },
          onSaved: (place) => pick(place),
        });
      }

      panel.querySelector('.place-toolbar [data-action="add"]').addEventListener("click", addPlace);
      q.addEventListener("input", () => {
        filters.q = q.value;
        paintResults();
      });
      q.addEventListener("keydown", (e) => {
        if (e.key === "Enter") q.blur(); // 按鍵盤的「搜尋」只收起鍵盤
      });

      paintFilters();
      paintResults();
    },
  });
}

function chip(filter, value, label, active, category) {
  return html`
    <button type="button" class="chip ${active ? "is-active" : ""} ${category ? `chip--cat cat--${category}` : ""}"
            data-filter="${filter}" data-value="${value}" aria-pressed="${active ? "true" : "false"}">
      ${category ? icon(category) : ""}${label}
    </button>
  `;
}

function pickerRow(p, selected) {
  const sub = [p.area, p.address].filter(Boolean).join("・");
  return html`
    <li>
      <button type="button" class="place-row ${selected ? "is-selected" : ""}" data-pick="${p.id}"
              aria-current="${selected ? "true" : "false"}">
        <span class="place-row__icon cat--${p.category}" title="${categoryLabel(p.category)}">${icon(p.category)}</span>
        <span class="place-row__body">
          <span class="place-row__name">${p.name}</span>
          ${sub ? html`<span class="place-row__sub">${sub}</span>` : ""}
        </span>
        ${selected ? html`<span class="place-row__check" aria-label="目前選擇">${icon("check")}</span>` : ""}
      </button>
    </li>
  `;
}
