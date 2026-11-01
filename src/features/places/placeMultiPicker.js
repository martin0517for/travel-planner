/**
 * placeMultiPicker.js — 一次勾選多個地點的選地點畫面（9.5 活動用，2026-11-01）。
 *
 * openPlaceMultiPicker({ title, tripId, selectedIds, onDone })
 *   title        畫面標題，例如「選擇活動的地點」
 *   tripId       有值時，這趟「想去的地點」清單裡的地點排前面，分成「這趟的地點」「其他地點」兩段
 *   selectedIds  目前已選的地點（會先打勾；點一下取消）
 *   onDone(ids)  按下方「完成」後呼叫，ids 依「原本的順序＋新勾選的先後」排列
 *
 * 外觀、操作跟清單頁的「加入想去的地點」多選畫面一樣（使用者已在實機確認過不會跳）：
 * 搜尋框＋「＋」新增 → 地區、分類篩選列 → 地點清單（點一下勾選／取消）→ 最下方按鈕。
 * - 有搜尋框，所以照規則以整頁顯示（core/sheet.js），疊在活動表單上面；關閉後回到表單，已填內容保留。
 * - 「＋」直接新增新地點：存進共用地點資料庫，並自動勾選。
 * - 搜尋框輸入中（鍵盤開著）時，暫時藏起最下方的按鈕。
 * - 按右上角 × 關閉＝不套用這次的變更。
 */
import { html, render } from "../../core/html.js";
import { icon } from "../../core/icons.js";
import { openSheet } from "../../core/sheet.js";
import { placeStore, PLACE_CATEGORIES, categoryLabel } from "../../data/places.js";
import { tripPlaceStore } from "../../data/tripPlaces.js";
import { openPlaceForm } from "./placeForm.js";

export function openPlaceMultiPicker({ title = "選擇地點", tripId = "", selectedIds = [], max = 30, onDone } = {}) {
  const filters = { area: "", category: "", q: "" };
  const selected = selectedIds.filter((id) => placeStore.get(id)); // 已刪除的地點不帶進來

  openSheet({
    title,
    body: html`
      <div class="place-toolbar">
        <label class="search-box">
          ${icon("search")}
          <span class="sr-only">搜尋地點資料庫</span>
          <input type="search" id="multi-q" placeholder="搜尋地點資料庫" autocomplete="off"
                 autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" />
        </label>
        <button type="button" class="btn btn--primary btn--icon" data-action="new" aria-label="新增新地點">${icon("plus")}</button>
      </div>
      <div class="adder-filters"></div>
      <div class="adder-results"></div>
      <div class="adder-bar">
        <button type="button" class="btn btn--primary btn--block" data-action="confirm">完成</button>
      </div>
    `,
    onMount(panel, close) {
      panel.classList.add("sheet--no-tail");
      const q = panel.querySelector("#multi-q");
      const filtersBox = panel.querySelector(".adder-filters");
      const resultsBox = panel.querySelector(".adder-results");
      const bar = panel.querySelector(".adder-bar");
      const confirmBtn = panel.querySelector('[data-action="confirm"]');

      function paintBar() {
        confirmBtn.textContent = selected.length ? `完成（已選 ${selected.length} 個地點）` : "完成（不選地點）";
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
        // 保留篩選列原本的左右位置（2026-10-13 的規則）
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

      /** 有 tripId 時分成「這趟的地點」「其他地點」；任一段是空的就不顯示標題 */
      function groupByTrip(list) {
        if (!tripId) return [{ title: "", list }];
        const inTrip = tripPlaceStore.placeIdsOf(tripId);
        const mine = list.filter((p) => inTrip.has(p.id));
        const others = list.filter((p) => !inTrip.has(p.id));
        if (!mine.length || !others.length) return [{ title: "", list }];
        return [
          { title: "這趟的地點", list: mine },
          { title: "其他地點", list: others },
        ];
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
                  <p class="field__hint adder-hint">點一下勾選，再點一次取消</p>
                  ${groupByTrip(shown).map(
                    (g) => html`
                      ${g.title ? html`<div class="tp-section"><span>${g.title}</span><span>${g.list.length}</span></div>` : ""}
                      <ul class="place-list">${g.list.map((p) => row(p, selected.includes(p.id)))}</ul>
                    `
                  )}
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
            if (i === -1) {
              if (selected.length >= max) {
                window.alert(`一個活動最多 ${max} 個地點`);
                return;
              }
              selected.push(id);
            } else {
              selected.splice(i, 1);
            }
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
            if (place && !selected.includes(place.id) && selected.length < max) selected.push(place.id);
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
        const ids = selected.filter((id) => placeStore.get(id)); // 完成前再確認地點還存在
        close();
        if (onDone) onDone(ids);
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

function row(p, isSelected) {
  const sub = [p.area, p.address].filter(Boolean).join("・");
  return html`
    <li>
      <button type="button" class="place-row adder-row ${isSelected ? "is-selected" : ""}" data-toggle="${p.id}"
              role="checkbox" aria-checked="${isSelected ? "true" : "false"}">
        <span class="adder-check ${isSelected ? "is-on" : ""}" aria-hidden="true">${icon("check")}</span>
        <span class="place-row__icon cat--${p.category}" title="${categoryLabel(p.category)}">${icon(p.category)}</span>
        <span class="place-row__body">
          <span class="place-row__name">${p.name}</span>
          ${sub ? html`<span class="place-row__sub">${sub}</span>` : ""}
        </span>
      </button>
    </li>
  `;
}
