/**
 * 旅程地圖分頁（#/trips/:id/map）。用 Leaflet + OpenStreetMap 畫地圖，
 * Leaflet 套件是用 core/leafletLoader.js 動態載入的（不是一開始就載入，
 * 只有真的進到地圖分頁才會下載這個套件）。
 * 「全部」分頁顯示這趟旅程用到的所有地點；選特定一天則畫出
 * 那天行程項目的路線（依順序連線＋編號 Marker）。
 */
import { tripService } from "../../services/tripService.js";
import { accommodationService } from "../../services/accommodationService.js";
import { flightService } from "../../services/flightService.js";
import { dayPlanService } from "../../services/dayPlanService.js";
import { buildDateRange } from "../../data/models/DayPlan.js";
import { PLACE_CATEGORIES } from "../../data/models/Place.js";
import { loadLeaflet } from "../../core/leafletLoader.js";
import { openPlaceDetailView } from "../places/placeDetailView.js";

export function renderTripMapView(container, params) {
  const trip = tripService.getTrip(params.id);

  if (!trip) {
    container.innerHTML = `
      <a href="#/trips" class="back-link">← 返回我的旅程</a>
      <div class="empty-state"><h2>找不到這趟旅程</h2></div>
    `;
    return;
  }

  const titleEl = document.getElementById("topbar-title");
  const eyebrowEl = document.getElementById("topbar-eyebrow");
  if (titleEl) titleEl.textContent = `${trip.destination || trip.name} · 地圖`;
  if (eyebrowEl) eyebrowEl.textContent = "MAP";

  const dates = buildDateRange(trip.startDate, trip.endDate);

  const wrapper = document.createElement("div");
  wrapper.className = "map-page";
  wrapper.innerHTML = `
    <a href="#/trips/${trip.id}" class="back-link">← 返回旅程總覽</a>

    <div class="day-tabs" id="map-day-tabs">
      <button class="day-tab is-active" data-date="">全部</button>
      ${dates
        .map((d, i) => `<button class="day-tab" data-date="${d}">Day ${i + 1}<span>${formatShortDate(d)}</span></button>`)
        .join("")}
    </div>

    <div class="chip-row" id="map-layer-chips">
      ${PLACE_CATEGORIES_UI.map((c) => `<button class="chip is-active" data-cat="${c.value}" style="border-color:${c.color}; color:${c.color};">${c.label}</button>`).join("")}
    </div>

    <div id="trip-map" class="trip-map"></div>
    <p class="map-hint" id="map-hint" style="display:none;"></p>
  `;
  container.appendChild(wrapper);

  loadLeaflet()
    .then((L) => {
      initMap(L, wrapper, trip, dates);
    })
    .catch(() => {
      wrapper.querySelector("#trip-map").outerHTML = `
        <div class="empty-state">
          <h2>地圖載入失敗</h2>
          <p>請確認網路連線後重新整理頁面。</p>
        </div>
      `;
    });
}

// 給圖層 chip 用（跟 PLACE_CATEGORIES 相同資料，另外取名避免跟 import 混淆）
const PLACE_CATEGORIES_UI = PLACE_CATEGORIES;

function initMap(L, wrapper, trip, dates) {
  const mapEl = wrapper.querySelector("#trip-map");
  const map = L.map(mapEl, { scrollWheelZoom: true }).setView([23.9739, 120.9821], 6); // 預設台灣中心，有資料後會自動 fitBounds

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(map);

  setTimeout(() => map.invalidateSize(), 0);

  const layerGroups = {};
  PLACE_CATEGORIES.forEach((c) => {
    layerGroups[c.value] = L.layerGroup().addTo(map);
  });
  let routeLayer = L.layerGroup().addTo(map);

  let activeDate = "";

  function clearAll() {
    Object.values(layerGroups).forEach((g) => g.clearLayers());
    routeLayer.clearLayers();
  }

  function addPlaceMarker(place, options = {}) {
    if (!place || place.lat == null || place.lng == null) return null;
    const categoryMeta = PLACE_CATEGORIES.find((c) => c.value === place.category) || PLACE_CATEGORIES[0];
    const group = layerGroups[categoryMeta.value];
    if (!group) return null;

    const marker = options.numbered
      ? L.marker([place.lat, place.lng], { icon: numberedIcon(L, options.number, categoryMeta.color) })
      : L.circleMarker([place.lat, place.lng], {
          radius: 9,
          color: "#fbfbf8",
          weight: 2,
          fillColor: categoryMeta.color,
          fillOpacity: 0.95,
        });

    marker.bindPopup(buildPopup(place, categoryMeta));
    marker.addTo(group);
    return marker;
  }

  function buildPopup(place, categoryMeta) {
    const el = document.createElement("div");
    el.className = "map-popup";
    el.innerHTML = `
      <div class="map-popup__title">${escapeHtml(place.name)}</div>
      <div class="map-popup__meta">${categoryMeta.label}${place.address ? " · " + escapeHtml(place.address) : ""}</div>
      <div class="map-popup__actions">
        <button type="button" class="map-popup__btn" data-role="detail">詳情</button>
        ${
          place.googleMapsUrl
            ? `<a class="map-popup__btn" href="${escapeAttr(place.googleMapsUrl)}" target="_blank" rel="noopener noreferrer">導航 →</a>`
            : `<a class="map-popup__btn" href="${escapeAttr(googleMapsSearchUrl(place))}" target="_blank" rel="noopener noreferrer">導航 →</a>`
        }
      </div>
    `;
    el.querySelector('[data-role="detail"]').addEventListener("click", () => {
      openPlaceDetailView({ place });
    });
    return el;
  }

  function render(dateFilter) {
    clearAll();
    const bounds = [];

    if (!dateFilter) {
      // 全部：這趟旅程用到的所有地點（住宿、航班機場、每天的行程項目），不畫路線
      accommodationService.listByTrip(trip.id).forEach((a) => {
        const m = addPlaceMarker(a.place);
        if (m) bounds.push(m.getLatLng());
      });
      flightService.listByTrip(trip.id).forEach((f) => {
        [f.departurePlace, f.arrivalPlace].forEach((p) => {
          const m = addPlaceMarker(p);
          if (m) bounds.push(m.getLatLng());
        });
      });
      dates.forEach((date) => {
        dayPlanService.getItems(trip.id, date).forEach((item) => {
          const m = addPlaceMarker(item.place);
          if (m) bounds.push(m.getLatLng());
        });
      });
    } else {
      // 特定一天：畫出行程路線（依順序連線＋編號），另外標出當天住宿
      const items = dayPlanService
        .getItems(trip.id, dateFilter)
        .filter((it) => it.place && it.place.lat != null && it.place.lng != null);

      const latlngs = [];
      items.forEach((item, i) => {
        const m = addPlaceMarker(item.place, { numbered: true, number: i + 1 });
        if (m) {
          bounds.push(m.getLatLng());
          latlngs.push(m.getLatLng());
        }
      });

      if (latlngs.length > 1) {
        L.polyline(latlngs, { color: "#37352f", weight: 3, opacity: 0.55, dashArray: "6, 8" }).addTo(routeLayer);
      }

      const stay = dayPlanService.getAccommodationForDate(trip.id, dateFilter);
      if (stay && stay.place) {
        const m = addPlaceMarker(stay.place);
        if (m) bounds.push(m.getLatLng());
      }
    }

    const hint = wrapper.querySelector("#map-hint");
    if (bounds.length === 0) {
      hint.style.display = "block";
      hint.textContent = "這趟旅程的地點還沒有經緯度資料，先到「地點資料庫」幫地點補上經緯度，才能顯示在地圖上。";
      map.setView([23.9739, 120.9821], 6);
    } else {
      hint.style.display = "none";
      map.fitBounds(bounds, { padding: [32, 32], maxZoom: 15 });
    }
  }

  render(activeDate);

  wrapper.querySelectorAll("#map-day-tabs .day-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      wrapper.querySelectorAll("#map-day-tabs .day-tab").forEach((t) => t.classList.remove("is-active"));
      tab.classList.add("is-active");
      activeDate = tab.dataset.date;
      render(activeDate);
    });
  });

  wrapper.querySelectorAll("#map-layer-chips .chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const cat = chip.dataset.cat;
      const group = layerGroups[cat];
      const isActive = chip.classList.toggle("is-active");
      if (isActive) {
        map.addLayer(group);
        chip.style.background = "";
        chip.style.color = chip.dataset.color || chip.style.color;
      } else {
        map.removeLayer(group);
      }
    });
  });

  // 讓 chip 用類別色當底色（打開）／灰階（關閉），視覺上更好分辨
  wrapper.querySelectorAll("#map-layer-chips .chip").forEach((chip) => {
    const meta = PLACE_CATEGORIES.find((c) => c.value === chip.dataset.cat);
    if (!meta) return;
    chip.style.background = meta.color;
    chip.style.color = "#fbfbf8";
    chip.style.borderColor = meta.color;
    chip.dataset.color = meta.color;
    chip.addEventListener("click", () => {
      const isActive = chip.classList.contains("is-active");
      if (isActive) {
        chip.style.background = meta.color;
        chip.style.color = "#fbfbf8";
      } else {
        chip.style.background = "transparent";
        chip.style.color = meta.color;
      }
    });
  });
}

function numberedIcon(L, number, color) {
  return L.divIcon({
    className: "map-number-icon",
    html: `<span style="background:${color};">${number}</span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function googleMapsSearchUrl(place) {
  if (place.lat != null && place.lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}`;
}

function formatShortDate(dateStr) {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
function escapeAttr(str) {
  return String(str || "").replace(/"/g, "&quot;");
}
