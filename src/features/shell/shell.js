/**
 * shell.js — App 外框：依目前頁面畫出頂部列與底部導覽列。
 *
 * 每個頁面提供一份「頁面資訊」(meta)：
 *   eyebrow   頂部小字（英文大寫），例如 "TRIPS"
 *   title     頂部大標題
 *   back      返回按鈕要去的路徑；null 表示不顯示返回
 *   tripId    有值代表在某趟旅程裡 → 顯示底部 4 頁籤導覽
 *   active    底部導覽目前在哪一頁："overview" | "schedule" | "map" | "lists"
 *   hideSettings  true 時右上角不顯示齒輪（設定頁本身）
 */
import { html, render } from "../../core/html.js";
import { icon } from "../../core/icons.js";

const TRIP_TABS = [
  { key: "overview", label: "總覽", icon: "overview", path: (id) => `/trips/${id}` },
  { key: "schedule", label: "行程", icon: "schedule", path: (id) => `/trips/${id}/schedule` },
  { key: "map", label: "地圖", icon: "map", path: (id) => `/trips/${id}/map` },
  { key: "lists", label: "清單", icon: "lists", path: (id) => `/trips/${id}/lists` },
];

export function renderShell(meta) {
  renderTopbar(meta);
  renderNavbar(meta);
  document.title = meta.title ? `${meta.title}｜旅行規劃` : "旅行規劃";
}

function renderTopbar({ eyebrow, title, back, hideSettings }) {
  const topbar = document.getElementById("topbar");
  render(
    topbar,
    html`
      ${back
        ? html`<a class="icon-btn" href="#${back}" aria-label="返回">${icon("back")}</a>`
        : html`<span class="icon-btn icon-btn--placeholder" aria-hidden="true"></span>`}
      <div class="topbar__titles">
        <div class="topbar__eyebrow">${eyebrow}</div>
        <h1 class="topbar__title">${title}</h1>
      </div>
      ${hideSettings
        ? html`<span class="icon-btn icon-btn--placeholder" aria-hidden="true"></span>`
        : html`<a class="icon-btn" href="#/settings" aria-label="設定">${icon("settings")}</a>`}
    `
  );
}

function renderNavbar({ tripId, active }) {
  const navbar = document.getElementById("navbar");
  const show = Boolean(tripId);
  navbar.hidden = !show;
  document.body.classList.toggle("has-navbar", show);
  if (!show) {
    render(navbar, html``);
    return;
  }
  // tripId 放進網址前先編碼，避免特殊字元破壞網址
  const id = encodeURIComponent(tripId);
  render(
    navbar,
    html`${TRIP_TABS.map(
      (tab) => html`
        <a class="navbar__item ${tab.key === active ? "is-active" : ""}" href="#${tab.path(id)}"
           ${tab.key === active ? html`aria-current="page"` : ""}>
          ${icon(tab.icon)}
          <span>${tab.label}</span>
        </a>
      `
    )}`
  );
}
