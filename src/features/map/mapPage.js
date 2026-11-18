/**
 * mapPage.js — 旅程內的「地圖」頁籤（v0.14.0，2026-11-18 使用者看過示範頁後決定「照建議」）。
 *
 * 版面：
 *   上方一排分頁：「全部」＋ Day 1、Day 2…（跟行程頁一樣可以左右捲動，旅程進行中的那天有「今天」）
 *   地圖（Leaflet＋OpenStreetMap 圖磚），右上「篩選」、左下「N 個地點沒有座標」、右下「我的位置」
 *
 * 顯示哪些點：
 *   全部：這趟「想去的地點」清單裡有座標的地點（航班、住宿、活動、行程、筆記用到的地點本來就會自動加入）。
 *         標記用分類的顏色和圖示，不編號、不連線。
 *   Day N：那天行程頁上有地點的項目，照行程頁的順序編號並用虛線連起來：
 *          行程項目、航班（出發機場 → 抵達機場）、住宿入住／退房、排進來的住宿、活動的地點（照活動裡的順序）。
 *          同一個地點同一天出現兩次只放一個標記，編號寫「1・6」；路線照樣連回去。
 *   沒有座標的地點不畫，左下角顯示數量，點了列出來，再點一個打開預覽。
 *
 * 樣式：
 *   約略座標（Place.geoApprox，v0.13.7）：標記虛線外框、變淡；小卡片註明「可能差幾公里」；連到它的路線比較淡。
 *   去過（TripPlace.visited）：標記變淡＋右下角小勾。
 *   地圖底圖一律是淺色（深色模式也是，使用者決定），所以標記用固定的淺色分類色（寫在 map.css）。
 *   v0.14.2：OSM 標準地圖太雜亂（使用者回報）→ 用 CSS 濾鏡把底圖去色、調淡（只套在圖磚，標記不受影響）。
 *
 * 點標記：上方跳出小卡片（Leaflet popup，map.css 改成跟隨 App 主題），「導航」打開 Google 地圖，
 *         「詳細」打開「想去的地點」的預覽（tripPlaceDetail，跟清單頁同一個）。
 * 篩選：底部面板勾分類；「全部」和每一天共用；篩完沒有點時顯示「顯示全部分類」。
 * 畫面範圍：每次進入、換分頁、改篩選都自動縮放到看得到全部的點；
 *           離其他點很遠的（例如機場，離中位數超過 25 公里）先不算進範圍，點有 4 個以上才這樣做。
 * 我的位置：按了才問定位權限，只在畫面上顯示藍點，不存、不送出。
 *
 * 資安：
 *   - 標記、小卡片、面板的文字一律用 html`` 跳脫；導航只用 navigationUrl（只允許 http/https）。
 *   - 圖磚請求用 referrerPolicy "strict-origin-when-cross-origin"：OpenStreetMap 規定要有 Referer，
 *     App 整體是 no-referrer，只有圖磚帶上網域（https://martin0517for.github.io/），不含路徑與旅程 id。
 *   - 座標只來自本機資料；定位結果只放在畫面上。
 */
import { html, render } from "../../core/html.js";
import { icon } from "../../core/icons.js";
import { openSheet } from "../../core/sheet.js";
import { isValidLatLng, navigationUrl } from "../../core/geo.js";
import { formatDateShort } from "../../core/dates.js";
import { loadLeaflet } from "../../core/leaflet.js";
import { placeStore, PLACE_CATEGORIES, categoryLabel } from "../../data/places.js";
import { tripPlaceStore } from "../../data/tripPlaces.js";
import { tripUsages, tripUsedPlaceIds } from "../../data/tripPlaceUsage.js";
import { tripDays, dayContent } from "../schedule/timeline.js";
import { flightTitle } from "../flights/flightDetail.js";
import { openTripPlaceDetail } from "../lists/tripPlaceDetail.js";
import { openPlaceDetail } from "../places/placeDetail.js";

const ALL_CATS = PLACE_CATEGORIES.map((c) => c.value);
const FOCUS_RADIUS_M = 25000;

// 看哪一頁、篩選：同一趟旅程裡記住（換到別趟旅程時重置）
const state = { tripId: "", tab: 0, cats: new Set(ALL_CATS) };
// 目前畫面上的地圖（離開地圖頁時清掉）
let live = null;

export function renderMap(container, trip) {
  destroyLive();
  if (state.tripId !== trip.id) Object.assign(state, { tripId: trip.id, tab: 0, cats: new Set(ALL_CATS) });
  // 舊資料補上：這趟用到的地點如果還不在清單裡就加進去（同清單頁）
  tripPlaceStore.addMany(trip.id, tripUsedPlaceIds(trip.id).filter((id) => placeStore.get(id)));

  render(
    container,
    html`
      <div class="map-page">
        <div class="day-tabs map-tabs" role="tablist" aria-label="全部或第幾天"></div>
        <div class="map-wrap">
          <div class="map-canvas"></div>
          <div class="map-notice" hidden></div>
          <button type="button" class="map-fab map-fab--filter" data-action="filter" hidden></button>
          <button type="button" class="map-fab map-fab--missing" data-action="missing" hidden></button>
          <button type="button" class="map-fab map-fab--locate" data-action="locate" aria-label="我的位置" hidden>${icon("locate")}</button>
          <div class="map-empty" hidden></div>
          <div class="map-toast" role="status" hidden></div>
        </div>
      </div>
    `
  );
  const root = container.querySelector(".map-page");
  const ctx = { trip, root, L: null, map: null, layers: null, me: null };
  live = ctx;
  paintTabs(ctx);
  wire(ctx);
  showLoading(ctx);

  loadLeaflet()
    .then((L) => {
      if (live !== ctx || !document.body.contains(root)) return; // 載入時已經離開地圖頁
      ctx.L = L;
      createMap(ctx);
      draw(ctx, { fit: true });
    })
    .catch(() => {
      if (live !== ctx) return;
      const box = root.querySelector(".map-empty");
      box.hidden = false;
      render(
        box,
        html`<p>地圖程式載入失敗</p><div class="muted">請確認有網路，再按一次重新載入。</div>
             <button type="button" class="btn btn--ghost" data-action="retry">重新載入</button>`
      );
    });
}

// 離開地圖頁（換到別的頁籤）時把 Leaflet 清掉，避免殘留的事件與記憶體
window.addEventListener("hashchange", () => {
  setTimeout(() => {
    if (live && !document.body.contains(live.root)) destroyLive();
  }, 0);
});

function destroyLive() {
  if (!live) return;
  if (live.map) live.map.remove();
  live = null;
}

function showLoading(ctx) {
  const box = ctx.root.querySelector(".map-empty");
  box.hidden = false;
  render(box, html`<p class="map-loading"><span class="spin" aria-hidden="true"></span>正在載入地圖…</p>`);
}

// ---------- 分頁 ----------
function paintTabs(ctx) {
  const info = tripDays(ctx.trip);
  if (state.tab > info.days.length) state.tab = 0;
  const tabsEl = ctx.root.querySelector(".map-tabs");
  const old = tabsEl.scrollLeft;
  const total = tripPlaces(ctx.trip).filter((x) => hasCoords(x.place)).length;
  render(
    tabsEl,
    html`
      <button type="button" role="tab" class="day-tab day-tab--all ${state.tab === 0 ? "is-active" : ""}"
              aria-selected="${state.tab === 0 ? "true" : "false"}" data-tab="0">
        <b>全部</b><small>${total} 個地點</small>
      </button>
      ${info.days.map(
        (d) => html`
          <button type="button" role="tab" class="day-tab ${d.day === state.tab ? "is-active" : ""}"
                  aria-selected="${d.day === state.tab ? "true" : "false"}" data-tab="${d.day}">
            <b>Day ${d.day}</b>
            ${d.date ? html`<small>${formatDateShort(d.date)}</small>` : ""}
            ${d.day === info.todayDay ? html`<span class="day-tab__today">今天</span>` : ""}
          </button>
        `
      )}
    `
  );
  tabsEl.scrollLeft = old;
  const active = tabsEl.querySelector(".day-tab.is-active");
  if (active) {
    const left = active.offsetLeft - tabsEl.offsetLeft;
    if (left < tabsEl.scrollLeft) tabsEl.scrollLeft = Math.max(0, left - 16);
    else if (left + active.offsetWidth > tabsEl.scrollLeft + tabsEl.clientWidth) {
      tabsEl.scrollLeft = left + active.offsetWidth - tabsEl.clientWidth + 16;
    }
  }
}

// ---------- 資料 ----------
const hasCoords = (place) => Boolean(place) && isValidLatLng(place.lat, place.lng);

/** 這趟清單裡的地點（地點已刪除的略過） → [{ entry, place }] */
function tripPlaces(trip) {
  return tripPlaceStore
    .listByTrip(trip.id)
    .map((entry) => ({ entry, place: placeStore.get(entry.placeId) }))
    .filter((x) => x.place);
}

/** 某一天行程頁上有地點的項目（照順序） → [{ placeId, what }] */
function dayStops(trip, day) {
  const info = tripDays(trip);
  const d = info.days[day - 1];
  if (!d) return [];
  const { entries } = dayContent(trip, d.day, d.date);
  const out = [];
  const push = (placeId, what) => placeId && out.push({ placeId, what });
  for (const e of entries) {
    const x = e.data;
    switch (e.kind) {
      case "item":
        push(x.placeId, x.text ? `行程：${x.text}` : "行程");
        break;
      case "flight": {
        const name = flightTitle(x);
        push(x.departurePlaceId, `航班 ${name} 出發`);
        push(x.arrivalPlaceId, `航班 ${name} 抵達`);
        break;
      }
      case "checkin":
        push(x.placeId, "住宿入住");
        break;
      case "checkout":
        push(x.placeId, "住宿退房");
        break;
      case "stay":
        push(x.placeId, "住宿");
        break;
      case "activity":
        x.placeIds.forEach((id) => push(id, `活動：${x.title}`));
        break;
    }
  }
  return out;
}

/**
 * 這一頁要畫的點 → { points: [{ place, entry, nums, whats }], route: [placeId…], missing: [{ place, entry }], hasAny }
 *   hasAny：這一頁有沒有任何地點（不管有沒有座標），用來決定空畫面的文字
 */
function collect(trip) {
  const list = tripPlaces(trip);
  const entryOf = new Map(list.map((x) => [x.place.id, x.entry]));
  if (state.tab === 0) {
    return {
      points: list.filter((x) => hasCoords(x.place)).map((x) => ({ ...x, nums: [], whats: [] })),
      route: [],
      missing: list.filter((x) => !hasCoords(x.place)),
      hasAny: list.length > 0,
    };
  }
  const stops = dayStops(trip, state.tab);
  const points = [];
  const byPlace = new Map();
  const route = [];
  const missing = new Map();
  let n = 0;
  for (const s of stops) {
    const place = placeStore.get(s.placeId);
    if (!place) continue;
    const entry = entryOf.get(place.id) || null;
    if (!hasCoords(place)) {
      missing.set(place.id, { place, entry });
      continue;
    }
    n += 1;
    route.push(place.id);
    const hit = byPlace.get(place.id);
    if (hit) {
      hit.nums.push(n);
      if (!hit.whats.includes(s.what)) hit.whats.push(s.what);
    } else {
      const pt = { place, entry, nums: [n], whats: [s.what] };
      byPlace.set(place.id, pt);
      points.push(pt);
    }
  }
  return { points, route, missing: [...missing.values()], hasAny: stops.length > 0 };
}

// ---------- 地圖 ----------
function createMap(ctx) {
  const L = ctx.L;
  const el = ctx.root.querySelector(".map-canvas");
  const map = L.map(el, { zoomControl: false, attributionControl: true, minZoom: 2, maxZoom: 19, worldCopyJump: true }).setView([25.04, 121.56], 5);
  map.attributionControl.setPrefix(false);
  const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    // OSM 規定要帶 Referer；只有圖磚這樣設定（App 其他地方維持 no-referrer）
    referrerPolicy: "strict-origin-when-cross-origin",
    className: "map-tiles", // map.css 用濾鏡把底圖調成淡灰（v0.14.2）
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
  }).addTo(map);
  // 底圖載入失敗時上方提示；之後一輪圖磚全部載入成功（例如網路恢復後移動地圖）才收起來
  const notice = ctx.root.querySelector(".map-notice");
  let failed = 0;
  tiles.on("loading", () => (failed = 0));
  tiles.on("tileerror", () => {
    failed += 1;
    notice.textContent = navigator.onLine === false ? "沒有網路，地圖底圖暫時無法顯示；標記照常顯示。" : "地圖底圖有部分載入失敗，網路可能不穩。";
    notice.hidden = false;
  });
  tiles.on("load", () => {
    if (!failed) notice.hidden = true;
  });
  ctx.map = map;
  ctx.layers = { markers: L.layerGroup().addTo(map), routes: L.layerGroup().addTo(map) };
  ctx.root.querySelector(".map-empty").hidden = true;
  ["filter", "missing", "locate"].forEach((a) => (ctx.root.querySelector(`[data-action="${a}"]`).hidden = false));
}

function draw(ctx, { fit = false } = {}) {
  if (!ctx.map) return;
  const { L, map, layers, trip, root } = ctx;
  // 先關小卡片再清標記：清標記時 Leaflet 會關掉開著的小卡片，觸發 popupclose 換回圖示，
  // 那時標記已經在移除中，換圖示會在地圖上留下一個沒有清掉的舊標記（2026-11-18 測試發現）
  map.closePopup();
  ctx.clearing = true;
  layers.markers.clearLayers();
  layers.routes.clearLayers();
  ctx.clearing = false;

  const data = collect(trip);
  const visible = data.points.filter((pt) => state.cats.has(pt.place.category));

  for (const pt of visible) {
    const marker = L.marker([pt.place.lat, pt.place.lng], {
      icon: markerIcon(L, pt, false),
      riseOnHover: true,
      keyboard: true,
      title: pt.place.name,
      zIndexOffset: pt.entry && pt.entry.visited ? -100 : 0,
    });
    marker.bindPopup(() => popupContent(ctx, pt), {
      className: "map-popup",
      maxWidth: 260,
      minWidth: 220,
      autoPanPaddingTopLeft: [12, 64],
      autoPanPaddingBottomRight: [12, 64],
    });
    marker.on("popupopen", () => {
      marker.setIcon(markerIcon(L, pt, true));
      marker.setZIndexOffset(1000);
    });
    marker.on("popupclose", () => {
      if (ctx.clearing || !layers.markers.hasLayer(marker)) return;
      marker.setIcon(markerIcon(L, pt, false));
      marker.setZIndexOffset(pt.entry && pt.entry.visited ? -100 : 0);
    });
    marker.addTo(layers.markers);
  }

  // Day 模式：照順序用虛線連起來（只連篩選後看得到的點；同一地點連續出現不畫）
  if (state.tab !== 0) {
    const seq = data.route.filter((id) => state.cats.has(placeStore.get(id).category));
    for (let i = 0; i + 1 < seq.length; i++) {
      if (seq[i] === seq[i + 1]) continue;
      const a = placeStore.get(seq[i]);
      const b = placeStore.get(seq[i + 1]);
      L.polyline(
        [
          [a.lat, a.lng],
          [b.lat, b.lng],
        ],
        { className: "map-route", color: "#37352f", weight: 3, opacity: a.geoApprox || b.geoApprox ? 0.25 : 0.7, dashArray: "2 8", interactive: false }
      ).addTo(layers.routes);
    }
  }

  // 沒有座標的地點
  const miss = root.querySelector('[data-action="missing"]');
  miss.hidden = data.missing.length === 0;
  render(miss, html`${icon("warning")}<span>${state.tab === 0 ? "" : "這天 "}${data.missing.length} 個地點沒有座標</span>`);

  // 篩選按鈕：有篩掉分類時變成深色並寫剩幾類
  const off = ALL_CATS.length - state.cats.size;
  const fb = root.querySelector('[data-action="filter"]');
  fb.classList.toggle("is-on", off > 0);
  render(fb, html`${icon("filter")}<span>${off > 0 ? `篩選・${state.cats.size}` : "篩選"}</span>`);

  // 空畫面
  const empty = root.querySelector(".map-empty");
  empty.hidden = visible.length > 0;
  if (!visible.length) {
    if (data.points.length) {
      render(empty, html`<p>篩選的分類裡沒有地點</p><button type="button" class="btn btn--ghost" data-action="reset-filter">顯示全部分類</button>`);
    } else if (state.tab === 0) {
      render(
        empty,
        html`<p>${data.hasAny ? "這趟的地點都還沒有座標" : "這趟還沒有可以顯示在地圖上的地點"}</p>
             <div class="muted">地點有座標才會出現在地圖上：到地點資料庫編輯地點，用「搜尋位置」或「貼上座標」補上。</div>`
      );
    } else {
      render(
        empty,
        html`<p>${data.hasAny ? `Day ${state.tab} 的地點都還沒有座標` : `Day ${state.tab} 沒有排地點`}</p>
             <div class="muted">${data.hasAny ? "到地點資料庫補上座標就會出現。" : "在行程頁加入有地點的行程，就會出現在這裡。"}</div>`
      );
    }
  }

  if (fit && visible.length) fitTo(ctx, visible);
}

/** 縮放到看得到這些點；離其他點很遠的（機場之類）先不算（4 個點以上才這樣做） */
function fitTo(ctx, visible) {
  const { L, map } = ctx;
  let list = visible;
  if (visible.length >= 4) {
    const med = (arr) => {
      const s = [...arr].sort((x, y) => x - y);
      return s[Math.floor(s.length / 2)];
    };
    const center = L.latLng(med(visible.map((p) => p.place.lat)), med(visible.map((p) => p.place.lng)));
    const near = visible.filter((p) => center.distanceTo([p.place.lat, p.place.lng]) <= FOCUS_RADIUS_M);
    if (near.length >= Math.ceil(visible.length / 2)) list = near;
  }
  const bounds = L.latLngBounds(list.map((p) => [p.place.lat, p.place.lng]));
  if (list.length === 1) map.setView(bounds.getCenter(), 15);
  else map.fitBounds(bounds, { paddingTopLeft: [40, 70], paddingBottomRight: [40, 70], maxZoom: 16 });
}

function markerIcon(L, pt, selected) {
  const p = pt.place;
  const num = pt.nums.join("・");
  const visited = Boolean(pt.entry && pt.entry.visited);
  const cls = ["mk", `mk--${p.category}`];
  if (num) cls.push("mk--num");
  if (num.length > 2) cls.push("mk--wide");
  if (p.geoApprox) cls.push("mk--approx");
  if (visited) cls.push("mk--visited");
  if (selected) cls.push("is-selected");
  const w = num.length > 2 ? 18 + num.length * 9 : 32;
  const el = document.createElement("div");
  render(
    el,
    html`<div class="mk__dot">${num ? num : icon(p.category)}</div>${visited ? html`<span class="mk__check">${icon("check")}</span>` : ""}`
  );
  return L.divIcon({ className: cls.join(" "), html: el, iconSize: [w, 32], iconAnchor: [w / 2, 16], popupAnchor: [0, -16] });
}

function popupContent(ctx, pt) {
  const p = pt.place;
  const visited = Boolean(pt.entry && pt.entry.visited);
  let line;
  if (pt.nums.length) {
    line = html`<div class="map-card__line">Day ${state.tab}｜第 <b>${pt.nums.join("・")}</b> 站・${pt.whats.join("、")}${visited ? "・去過了" : ""}</div>`;
  } else {
    const used = tripUsages(ctx.trip.id, p.id);
    const status = used.length ? `已排入：${[...new Set(used.map((u) => u.short))].join("、")}` : "未排入";
    line = html`<div class="map-card__line">${visited ? "去過了・" : ""}${status}</div>`;
  }
  const nav = navigationUrl(p);
  const el = document.createElement("div");
  el.className = "map-card";
  render(
    el,
    html`
      <div class="map-card__head">
        <span class="map-card__icon cat--${p.category}">${icon(p.category)}</span>
        <div>
          <div class="map-card__name">${p.name}</div>
          <div class="map-card__sub">${[categoryLabel(p.category), p.area].filter(Boolean).join("・")}</div>
        </div>
      </div>
      ${line}
      ${p.geoApprox ? html`<div class="map-card__warn">約略位置：從 Google 地圖連結估算，可能差幾公里</div>` : ""}
      <div class="map-card__actions">
        ${nav ? html`<a class="map-btn map-btn--primary" href="${nav}" target="_blank" rel="noopener noreferrer">${icon("navigate")}導航</a>` : ""}
        <button type="button" class="map-btn" data-action="detail">詳細</button>
      </div>
    `
  );
  el.querySelector('[data-action="detail"]').addEventListener("click", () => openDetail(ctx, p.id));
  return el;
}

function openDetail(ctx, placeId) {
  const trip = ctx.trip;
  const place = placeStore.get(placeId);
  if (!place) return;
  const entry = tripPlaceStore.listByTrip(trip.id).find((e) => e.placeId === placeId);
  const onChanged = () => {
    if (live !== ctx) return;
    paintTabs(ctx);
    draw(ctx);
  };
  if (entry) openTripPlaceDetail({ entry, place, trip, usedIn: tripUsages(trip.id, placeId), onChanged });
  else openPlaceDetail({ place, onChanged });
}

// ---------- 面板 ----------
function openFilter(ctx) {
  const draft = new Set(state.cats);
  const chips = () => html`${PLACE_CATEGORIES.map(
    (c) => html`<button type="button" class="chip chip--cat cat--${c.value} ${draft.has(c.value) ? "is-active" : ""}"
                        aria-pressed="${draft.has(c.value) ? "true" : "false"}" data-cat="${c.value}">${icon(c.value)}${c.label}</button>`
  )}`;
  openSheet({
    title: "篩選分類",
    body: html`
      <div class="map-filter-chips">${chips()}</div>
      <p class="field__hint">點一下切換。「全部」和每一天共用同一個篩選。</p>
      <div class="form__actions form__actions--spaced">
        <button type="button" class="btn btn--ghost" data-action="all">全部顯示</button>
        <button type="button" class="btn btn--primary" data-action="done">完成</button>
      </div>
    `,
    onMount(panel, close) {
      const box = panel.querySelector(".map-filter-chips");
      panel.addEventListener("click", (e) => {
        const chip = e.target.closest("[data-cat]");
        if (chip) {
          const v = chip.dataset.cat;
          if (draft.has(v)) draft.delete(v);
          else draft.add(v);
          render(box, chips());
          return;
        }
        const a = e.target.closest("[data-action]");
        if (!a) return;
        if (a.dataset.action === "all") {
          ALL_CATS.forEach((v) => draft.add(v));
          render(box, chips());
        } else if (a.dataset.action === "done") {
          state.cats = new Set(draft);
          close();
          if (live === ctx) draw(ctx, { fit: true });
        }
      });
    },
  });
}

function openMissing(ctx) {
  const list = collect(ctx.trip).missing;
  openSheet({
    title: "沒有座標的地點",
    body: html`
      <p class="field__hint">這些地點不會出現在地圖上。點地點看預覽；要補座標請到地點資料庫編輯（搜尋位置或貼上座標）。</p>
      <ul class="map-missing">
        ${list.map(
          (x) => html`
            <li>
              <button type="button" data-id="${x.place.id}">
                <span class="place-row__icon cat--${x.place.category}">${icon(x.place.category)}</span>
                <span class="map-missing__name">${x.place.name}</span>
                ${x.place.area ? html`<small>${x.place.area}</small>` : ""}
              </button>
            </li>
          `
        )}
      </ul>
    `,
    onMount(panel, close) {
      panel.addEventListener("click", (e) => {
        const b = e.target.closest("[data-id]");
        if (!b) return;
        close();
        openDetail(ctx, b.dataset.id);
      });
    },
  });
}

// ---------- 我的位置 ----------
let toastTimer = null;
function toast(ctx, msg) {
  const t = ctx.root.querySelector(".map-toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 4000);
}

function locate(ctx) {
  if (!ctx.map) return;
  if (!("geolocation" in navigator)) {
    toast(ctx, "這個瀏覽器不支援定位。");
    return;
  }
  const btn = ctx.root.querySelector('[data-action="locate"]');
  btn.classList.add("is-busy");
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      btn.classList.remove("is-busy");
      if (live !== ctx) return;
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      if (!isValidLatLng(lat, lng)) return;
      const L = ctx.L;
      if (ctx.me) ctx.me.remove();
      ctx.me = L.marker([lat, lng], {
        interactive: false,
        keyboard: false,
        zIndexOffset: 2000,
        icon: L.divIcon({ className: "me-dot", html: "<span></span>", iconSize: [18, 18], iconAnchor: [9, 9] }),
      }).addTo(ctx.map);
      ctx.map.setView([lat, lng], Math.max(ctx.map.getZoom(), 15));
      btn.classList.add("is-on");
    },
    (err) => {
      btn.classList.remove("is-busy");
      if (live !== ctx) return;
      toast(
        ctx,
        err && err.code === 1
          ? "沒有定位權限：到 iPhone「設定 → 隱私權與安全性 → 定位服務」允許 Safari 網站使用定位。"
          : "目前取不到位置，請稍後再試。"
      );
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
  );
}

// ---------- 事件 ----------
function wire(ctx) {
  const root = ctx.root;
  root.querySelector(".map-tabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-tab]");
    if (!b) return;
    state.tab = Number(b.dataset.tab) || 0;
    paintTabs(ctx);
    draw(ctx, { fit: true });
  });
  root.querySelector(".map-wrap").addEventListener("click", (e) => {
    const a = e.target.closest("[data-action]");
    if (!a || !root.contains(a)) return;
    switch (a.dataset.action) {
      case "filter":
        openFilter(ctx);
        break;
      case "missing":
        openMissing(ctx);
        break;
      case "locate":
        locate(ctx);
        break;
      case "reset-filter":
        state.cats = new Set(ALL_CATS);
        draw(ctx, { fit: true });
        break;
      case "retry":
        renderMap(root.parentElement, ctx.trip);
        break;
    }
  });
}
