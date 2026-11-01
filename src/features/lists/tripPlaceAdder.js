/**
 * tripPlaceAdder.js — 從共用地點資料庫「一次勾選多個」加入這趟的想去地點清單（2026-11-01）。
 *
 * openTripPlaceAdder({ trip, onDone })
 *
 * 版面：搜尋框＋「＋」新增新地點 → 地區、分類篩選列 → 地點清單（點一下勾選／取消）
 *       → 最下方「加入 N 個地點」按鈕（一個都沒選時不能按）。
 * - 已經在這趟清單裡的地點顯示「已加入」，不能再選。
 * - 「＋」直接新增新地點：存進共用地點資料庫，並自動勾選（按「加入」後進入這趟的清單）。
 * - 有搜尋框，所以照規則以整頁顯示（core/sheet.js）。
 * - 搜尋框輸入中（鍵盤開著）時，暫時藏起最下方的按鈕，避免 iPhone 鍵盤讓固定在下方的元素跳動。
 */
import { html, render } from "../../core/html.js";
import { icon } from "../../core/icons.js";
import { openSheet } from "../../core/sheet.js";
import { placeStore, PLACE_CATEGORIES, categoryLabel } from "../../data/places.js";
import { tripPlaceStore } from "../../data/tripPlaces.js";
import { openPlaceForm } from "../places/placeForm.js";

export function openTripPlaceAdder({ trip, onDone }) {
  const filters = { area: "", category: "", q: "" };
  const selected = []; // 依點選順序保存 placeId，加入清單時照這個順序
  const already = tripPlaceStore.placeIdsOf(trip.id);

  openSheet({
    title: "加入想去的地點",
    body: html`
      <div class="place-toolbar">
        <label class="search-box">
          ${icon("search")}
          <span class="sr-only">搜尋地點資料庫</span>
          <input type="search" id="adder-q" placeholder="搜尋地點資料庫" autocomplete="off"
                 autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" />
        </label>
        <button type="button" class="btn btn--primary btn--icon" data-action="new" aria-label="新增新地點">${icon("plus")}</button>
      </div>
      <div class="adder-filters"></div>
      <div class="adder-results"></div>
      <div class="adder-bar">
        <button type="button" class="btn btn--primary btn--block" data-action="confirm" disabled>選擇要加入的地點</button>
      </div>
    `,
    onMount(panel, close) {
      // 搜尋框在最上面，不需要表單用的「底部半個螢幕留白」；按鈕捲到底時才會貼齊畫面底部
      panel.classList.add("sheet--no-tail");
      const q = panel.querySelector("#adder-q");
      const filtersBox = panel.querySelector(".adder-filters");
      const resultsBox = panel.querySelector(".adder-results");
      const bar = panel.querySelector(".adder-bar");
      const confirmBtn = panel.querySelector('[data-action="confirm"]');

      function paintBar() {
        confirmBtn.disabled = selected.length === 0;
        confirmBtn.textContent = selected.length ? `加入 ${selected.length} 個地點` : "選擇要加入的地點";
      }

      function paintFilters() {
        const areas = placeStore.areas();
        if (filters.area && !areas.includes(filters.area)) filters.area = "";
        const saved = {};
        filtersBox.querySelectorAll(".chips[aria-label]").forEach((r) => (saved[r.getAttribute("aria-label")] = r.scrollLeft));
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
        filtersBox.querySelectorAll(".chips[aria-label]").forEach((r) => {
          const s = saved[r.getAttribute("aria-label")];
          if (s) r.scrollLeft = s;
        });
        filtersBox.querySelectorAll("[data-filter]").forEach((btn) =>
          btn.addEventListener("click", () => {
            filters[btn.dataset.filter] = btn.dataset.value;
            paintFilters();
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
        render(
          resultsBox,
          html`
            ${shown.length
              ? html`
                  <p class="field__hint adder-hint">點一下勾選，可以選很多個</p>
                  <ul class="place-list">${shown.map((p) => adderRow(p, selected.includes(p.id), already.has(p.id)))}</ul>
                `
              : html`<p class="muted center">${all.length ? "沒有符合條件的地點。" : "地點資料庫還是空的。"}</p>`}
            <button type="button" class="btn btn--ghost btn--block picker-add" data-action="new">
              ${icon("plus")}<span class="btn__label">${text ? `新增「${filters.q.trim()}」` : "新增新地點"}</span>
            </button>
          `
        );
        resultsBox.querySelectorAll("[data-toggle]").forEach((btn) =>
          btn.addEventListener("click", () => {
            const id = btn.dataset.toggle;
            const i = selected.indexOf(id);
            if (i === -1) selected.push(id);
            else selected.splice(i, 1);
            const on = i === -1;
            btn.classList.toggle("is-selected", on);
            btn.setAttribute("aria-checked", on ? "true" : "false");
            btn.querySelector(".adder-check").classList.toggle("is-on", on);
            paintBar();
          })
        );
        resultsBox.querySelector('[data-action="new"]').addEventListener("click", addNew);
      }

      function addNew() {
        openPlaceForm({
          defaults: { name: filters.q.trim(), category: filters.category, area: filters.area },
          onSaved: (place) => {
            if (place && !selected.includes(place.id)) selected.push(place.id);
            paintFilters();
            paintResults();
            paintBar();
          },
        });
      }

      panel.querySelector('.place-toolbar [data-action="new"]').addEventListener("click", addNew);
      q.addEventListener("input", () => {
        filters.q = q.value;
        paintResults();
      });
      q.addEventListener("keydown", (e) => {
        if (e.key === "Enter") q.blur();
      });
      q.addEventListener("focus", () => bar.classList.add("is-hidden"));
      q.addEventListener("blur", () => bar.classList.remove("is-hidden"));

      confirmBtn.addEventListener("click", () => {
        // 加入前再確認地點還存在
        const ids = selected.filter((id) => placeStore.get(id));
        const result = tripPlaceStore.addMany(trip.id, ids);
        if (!result.ok) {
          window.alert(result.errors.join("\n"));
          return;
        }
        close();
        if (onDone) onDone(result.added);
      });

      paintFilters();
      paintResults();
      paintBar();
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

function adderRow(p, isSelected, isAdded) {
  const sub = [p.area, p.address].filter(Boolean).join("・");
  return html`
    <li>
      <button type="button" class="place-row adder-row ${isSelected ? "is-selected" : ""} ${isAdded ? "is-added" : ""}"
              ${isAdded ? html`disabled` : html`data-toggle="${p.id}"`}
              role="checkbox" aria-checked="${isSelected || isAdded ? "true" : "false"}">
        <span class="adder-check ${isSelected ? "is-on" : ""}" aria-hidden="true">${icon("check")}</span>
        <span class="place-row__icon cat--${p.category}" title="${categoryLabel(p.category)}">${icon(p.category)}</span>
        <span class="place-row__body">
          <span class="place-row__name">${p.name}</span>
          ${sub ? html`<span class="place-row__sub">${sub}</span>` : ""}
        </span>
        ${isAdded ? html`<span class="adder-row__added">已加入</span>` : ""}
      </button>
    </li>
  `;
}
