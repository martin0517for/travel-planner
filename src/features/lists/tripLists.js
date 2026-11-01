/**
 * tripLists.js — 旅程內的「清單」頁籤（2026-11-01，計畫書 9.2）。
 *
 * 上方分段切換：想去的地點｜筆記（v0.9.0，筆記在 features/notes/tripNotes.js）。
 *
 * 「想去的地點」版面（由上到下）：
 *   搜尋框（只搜尋這趟清單裡的地點）＋「＋」從地點資料庫加入
 *   地區篩選列、分類篩選列（只列出這趟清單裡用到的）
 *   三個區塊：未排入 → 已排入 → 去過（各自顯示數量；沒有地點的區塊不顯示）
 *     - 未排入、去過：依加入先後排列
 *     - 已排入（v0.8.1）：航班 → 住宿 → 活動 → Day 1 → Day 2 …（見 data/tripPlaceUsage.js）
 *     - 勾選框只有點框本身才會勾「去過」；點其他地方開預覽
 *     - 已排入：變淡，右邊小標簡短註明用在哪裡（「航班」「住宿」、活動名稱、「Day 2」，兩種以上顯示最前面那個「航班 +1」）
 *     - 去過：打勾＋變淡（使用者決定不加刪除線）
 *
 * 篩選條件存在這個檔案的變數裡；換到別趟旅程時重置。
 */
import { html, render } from "../../core/html.js";
import { icon } from "../../core/icons.js";
import { placeStore, PLACE_CATEGORIES, categoryLabel } from "../../data/places.js";
import { tripPlaceStore } from "../../data/tripPlaces.js";
import { tripUsages, tripUsedPlaceIds } from "../../data/tripPlaceUsage.js";
import { openTripPlaceAdder } from "./tripPlaceAdder.js";
import { openTripPlaceDetail } from "./tripPlaceDetail.js";
import { renderTripNotes } from "../notes/tripNotes.js";

const state = { tripId: "", tab: "places", area: "", category: "", q: "" };

const TABS = [
  { key: "places", label: "想去的地點" },
  { key: "notes", label: "筆記" }, // v0.9.0：原本的「想買的東西」改成「筆記」（類型見 data/notes.js）
];

/**
 * 某個地點在這趟旅程用在哪裡 → [{ short, full }]，例如 [{ short: "去程航班", full: "去程航班 BR198" }]。
 * 空陣列代表「未排入」。看航班、住宿、活動、每日行程（data/tripPlaceUsage.js）。
 */
const scheduledIn = tripUsages;

export function renderTripLists(container, trip) {
  if (state.tripId !== trip.id) {
    Object.assign(state, { tripId: trip.id, area: "", category: "", q: "" });
  }
  // 舊資料補上：這趟航班、住宿已經用到的地點，如果還不在清單裡就加進去（已在的會略過，不會重複寫入）
  tripPlaceStore.addMany(trip.id, tripUsedPlaceIds(trip.id).filter((id) => placeStore.get(id)));
  paint(container, trip);
}

function paint(container, trip) {
  // 重畫前記住篩選列左右捲到哪裡（同地點資料庫 2026-10-13 的修正）
  const chipScroll = {};
  container.querySelectorAll(".chips[aria-label]").forEach((row) => {
    chipScroll[row.getAttribute("aria-label")] = row.scrollLeft;
  });

  render(
    container,
    html`
      <div class="segmented" role="tablist" aria-label="清單種類">
        ${TABS.map(
          (t) => html`
            <button type="button" role="tab" class="segmented__item ${state.tab === t.key ? "is-active" : ""}"
                    aria-selected="${state.tab === t.key ? "true" : "false"}" data-tab="${t.key}">${t.label}</button>
          `
        )}
      </div>
      <div id="list-body"></div>
    `
  );

  container.querySelectorAll("[data-tab]").forEach((btn) =>
    btn.addEventListener("click", () => {
      if (state.tab === btn.dataset.tab) return;
      state.tab = btn.dataset.tab;
      paint(container, trip);
    })
  );

  const body = container.querySelector("#list-body");
  if (state.tab === "notes") {
    renderTripNotes(body, trip);
    return;
  }
  paintPlaces(body, trip, chipScroll);
}

/** 這趟清單的每一筆，配上地點資料；地點已不存在的略過 */
function loadEntries(tripId) {
  return tripPlaceStore
    .listByTrip(tripId)
    .map((entry) => ({ entry, place: placeStore.get(entry.placeId) }))
    .filter((x) => x.place);
}

function paintPlaces(box, trip, chipScroll) {
  const items = loadEntries(trip.id);
  const repaint = () => paintPlaces(box, trip, rememberChipScroll(box));
  const openAdder = () => openTripPlaceAdder({ trip, onDone: repaint });

  if (!items.length) {
    render(
      box,
      html`
        <div class="empty">
          <div class="empty__icon">${icon("places")}</div>
          <h2>還沒有想去的地點</h2>
          <p>從地點資料庫挑選這趟想去的景點、餐廳，之後排行程時可以直接選用。</p>
          <button type="button" class="btn btn--primary" data-action="add">${icon("plus")}從地點資料庫加入</button>
        </div>
      `
    );
    box.querySelector('[data-action="add"]').addEventListener("click", openAdder);
    return;
  }

  // 篩選列只列出這趟清單裡用到的地區、分類
  const areas = [...new Set(items.map((x) => x.place.area).filter(Boolean))];
  const cats = PLACE_CATEGORIES.filter((c) => items.some((x) => x.place.category === c.value));
  if (state.area && !areas.includes(state.area)) state.area = "";
  if (state.category && !cats.some((c) => c.value === state.category)) state.category = "";

  render(
    box,
    html`
      <div class="place-toolbar">
        <label class="search-box">
          ${icon("search")}
          <span class="sr-only">搜尋這趟的地點</span>
          <input type="search" id="tp-q" placeholder="搜尋這趟的地點" value="${state.q}"
                 autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" />
        </label>
        <button type="button" class="btn btn--primary btn--icon" data-action="add" aria-label="從地點資料庫加入">${icon("plus")}</button>
      </div>
      ${areas.length > 1
        ? html`
            <div class="chips" role="group" aria-label="地區">
              ${chip("area", "", "全部地區", state.area === "")}
              ${areas.map((a) => chip("area", a, a, state.area === a))}
            </div>
          `
        : ""}
      ${cats.length > 1
        ? html`
            <div class="chips" role="group" aria-label="分類">
              ${chip("category", "", "全部", state.category === "")}
              ${cats.map((c) => chip("category", c.value, c.label, state.category === c.value, c.value))}
            </div>
          `
        : ""}
      <div id="tp-results"></div>
    `
  );

  restoreChipScroll(box, chipScroll);
  box.querySelector('[data-action="add"]').addEventListener("click", openAdder);
  box.querySelectorAll("[data-filter]").forEach((btn) =>
    btn.addEventListener("click", () => {
      state[btn.dataset.filter] = btn.dataset.value;
      repaint();
    })
  );
  const q = box.querySelector("#tp-q");
  q.addEventListener("input", () => {
    state.q = q.value;
    paintResults(box, trip, items, repaint);
  });
  q.addEventListener("keydown", (e) => {
    if (e.key === "Enter") q.blur(); // 按鍵盤的「搜尋」只收起鍵盤
  });
  paintResults(box, trip, items, repaint);
}

/** 只重畫列表（打字搜尋時不重畫搜尋框，游標和鍵盤才不會跳掉） */
function paintResults(box, trip, items, repaint) {
  const results = box.querySelector("#tp-results");
  const text = state.q.trim().toLowerCase();
  const shown = items.filter(
    ({ entry, place: p }) =>
      (!state.area || p.area === state.area) &&
      (!state.category || p.category === state.category) &&
      (!text || [p.name, p.area, p.address, p.geoQuery, entry.notes, ...p.tags].some((t) => t.toLowerCase().includes(text)))
  );

  const withStatus = shown.map((x) => ({ ...x, usedIn: scheduledIn(trip.id, x.place.id) }));
  const groups = [
    { key: "todo", title: "未排入", list: withStatus.filter((x) => !x.entry.visited && !x.usedIn.length) },
    {
      key: "scheduled",
      title: "已排入",
      // 航班 → 住宿 → 活動 → Day 1、Day 2 …（用最前面那個用途排；相同時維持加入先後）
      list: withStatus.filter((x) => !x.entry.visited && x.usedIn.length).sort((a, b) => a.usedIn[0].rank - b.usedIn[0].rank),
    },
    { key: "visited", title: "去過", list: withStatus.filter((x) => x.entry.visited) },
  ].filter((g) => g.list.length);

  render(
    results,
    groups.length
      ? html`${groups.map(
          (g) => html`
            <div class="tp-section">
              <span>${g.title}</span><span>${g.list.length}</span>
            </div>
            <ul class="place-list tp-list">${g.list.map(row)}</ul>
          `
        )}`
      : html`<p class="muted center">沒有符合條件的地點。</p>`
  );

  results.querySelectorAll("[data-visit]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const entry = tripPlaceStore.get(btn.dataset.visit);
      if (!entry) return;
      const result = tripPlaceStore.setVisited(entry.id, !entry.visited);
      if (!result.ok) {
        window.alert(result.errors.join("\n"));
        return;
      }
      repaint();
    })
  );
  results.querySelectorAll("[data-open]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const entry = tripPlaceStore.get(btn.dataset.open);
      const place = entry && placeStore.get(entry.placeId);
      if (place) openTripPlaceDetail({ entry, place, trip, usedIn: scheduledIn(trip.id, place.id), onChanged: repaint });
    })
  );
}

function row({ entry, place: p, usedIn }) {
  const sub = [p.area, p.address].filter(Boolean).join("・");
  const cls = entry.visited ? "is-visited" : usedIn.length ? "is-scheduled" : "";
  return html`
    <li class="tp-row ${cls}">
      <button type="button" class="tp-check ${entry.visited ? "is-checked" : ""}" data-visit="${entry.id}"
              role="checkbox" aria-checked="${entry.visited ? "true" : "false"}" aria-label="去過：${p.name}">
        <span class="tp-check__box">${entry.visited ? icon("check") : ""}</span>
      </button>
      <button type="button" class="tp-row__main" data-open="${entry.id}">
        <span class="place-row__icon cat--${p.category}" title="${categoryLabel(p.category)}">${icon(p.category)}</span>
        <span class="place-row__body">
          <span class="place-row__name">${p.name}</span>
          ${sub ? html`<span class="place-row__sub">${sub}</span>` : ""}
          ${entry.notes.trim()
            ? html`<span class="tp-row__note">${icon("note")}<span>${entry.notes.trim().split("\n")[0]}</span></span>`
            : ""}
        </span>
        ${usedIn.length ? html`<span class="tp-row__used">${usedLabel(usedIn)}</span>` : ""}
      </button>
    </li>
  `;
}

/** 小標：相同的只算一次，例如兩段住宿同一家飯店只顯示「住宿」；不同的顯示「航班 +1」 */
function usedLabel(usedIn) {
  const shorts = [...new Set(usedIn.map((u) => u.short))];
  return shorts.length > 1 ? `${shorts[0]} +${shorts.length - 1}` : shorts[0];
}

function chip(filter, value, label, active, category) {
  return html`
    <button type="button" class="chip ${active ? "is-active" : ""} ${category ? `chip--cat cat--${category}` : ""}"
            data-filter="${filter}" data-value="${value}" aria-pressed="${active ? "true" : "false"}">
      ${category ? icon(category) : ""}${label}
    </button>
  `;
}

function rememberChipScroll(box) {
  const saved = {};
  box.querySelectorAll(".chips[aria-label]").forEach((r) => (saved[r.getAttribute("aria-label")] = r.scrollLeft));
  return saved;
}

/** 還原篩選列的左右位置；若選中的那顆沒有完整露出，再輕輕捲到看得見 */
function restoreChipScroll(box, saved) {
  box.querySelectorAll(".chips[aria-label]").forEach((r) => {
    const s = saved && saved[r.getAttribute("aria-label")];
    if (s) r.scrollLeft = s;
    const active = r.querySelector(".chip.is-active");
    if (!active) return;
    const rr = r.getBoundingClientRect();
    const a = active.getBoundingClientRect();
    if (a.left < rr.left) r.scrollLeft -= rr.left - a.left + 16;
    else if (a.right > rr.right) r.scrollLeft += a.right - rr.right + 16;
  });
}
