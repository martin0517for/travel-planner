/**
 * 我的旅程列表（首頁）。這是「列表頁」的範例寫法，其他列表頁
 * （地點資料庫、清單…）都是同一套模式：
 *   renderXxxView(container) 只負責建一個空的 wrapper 掛到畫面上，
 *   實際內容都在 paint(wrapper) 裡用 innerHTML 整塊重寫，
 *   資料變了就重新呼叫 paint() 重畫一次（沒有框架幫忙做局部更新，
 *   整塊重寫是最簡單、不容易出 bug 的做法）。
 */
import { tripService } from "../../services/tripService.js";
import { tripShareService } from "../../services/tripShareService.js";
import { openTripForm } from "./tripFormView.js";

export function renderTripListView(container) {
  const wrapper = document.createElement("div");
  container.appendChild(wrapper);
  paint(wrapper);
}

function paint(wrapper) {
  const trips = tripService.listTrips();

  // 用 innerHTML 整塊寫入 HTML 字串（不是一個一個 createElement），
  // 空狀態（沒有旅程）跟正常列表分開兩種畫面。
  if (trips.length === 0) {
    wrapper.innerHTML = `
      <div class="empty-state">
        <h2>還沒有任何旅程</h2>
        <p>建立第一趟旅程，開始規劃你的行程、住宿與航班。</p>
        <button class="btn btn--gold" data-action="add">＋ 新增旅程</button>
        <button class="edit-place-link" data-action="import-share" style="margin-top: var(--space-4); display: block; text-align: center; width: 100%;">收到旅程分享檔？點此匯入</button>
      </div>
    `;
  } else {
    wrapper.innerHTML = `
      <div class="trip-list">
        ${trips.map((trip) => tripCardHtml(trip)).join("")}
      </div>
      <button class="edit-place-link" data-action="import-share" style="display: block; text-align: center; width: 100%; margin: var(--space-4) 0;">收到旅程分享檔？點此匯入</button>
    `;
  }

  // 上面 innerHTML 已經把舊的按鈕全部換成新的 DOM 元素（舊按鈕上原本綁的
  // 事件監聽器也一起消失了），所以這裡要重新 querySelectorAll 一次、
  // 重新綁事件。這個「先設定好 data-action，重畫完再重新綁」的動作
  // 之後每個檔案都會重複出現。
  wrapper.querySelectorAll("[data-action='add']").forEach((btn) => {
    btn.addEventListener("click", () => {
      openTripForm({ onSaved: () => paint(wrapper) });
    });
  });

  wrapper.querySelectorAll("[data-action='edit']").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const trip = tripService.getTrip(btn.dataset.id);
      openTripForm({ existingTrip: trip, onSaved: () => paint(wrapper) });
    });
  });

  wrapper.querySelectorAll("[data-action='delete']").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (confirm("確定要刪除這趟旅程嗎？此動作無法復原。")) {
        tripService.deleteTrip(btn.dataset.id);
        paint(wrapper);
      }
    });
  });

  wrapper.querySelectorAll(".trip-card").forEach((card) => {
    card.addEventListener("click", () => {
      window.location.hash = `/trips/${card.dataset.id}`;
    });
  });

  wrapper.querySelectorAll("[data-action='import-share']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "application/json";
      input.addEventListener("change", () => {
        const file = input.files[0];
        if (file) importSharedTrip(file);
      });
      input.click();
    });
  });

  // 浮動新增按鈕（列表非空時顯示）
  if (trips.length > 0 && !wrapper.querySelector(".btn--fab")) {
    const fab = document.createElement("button");
    fab.className = "btn btn--gold btn--fab";
    fab.setAttribute("aria-label", "新增旅程");
    fab.textContent = "＋";
    fab.addEventListener("click", () => {
      openTripForm({ onSaved: () => paint(wrapper) });
    });
    wrapper.appendChild(fab);
  }
}

function importSharedTrip(file) {
  const reader = new FileReader();
  reader.onload = () => {
    let payload;
    try {
      payload = JSON.parse(reader.result);
    } catch {
      alert("這個檔案看起來不是有效的分享檔（JSON 格式錯誤）。");
      return;
    }
    const result = tripShareService.importSharePayload(payload);
    if (!result.ok) {
      alert(result.errors.join("、"));
      return;
    }
    window.location.hash = `/trips/${result.trip.id}`;
  };
  reader.readAsText(file);
}

function tripCardHtml(trip) {
  const countdownLabel = countdownText(trip.countdown);
  return `
    <div class="trip-card" data-id="${trip.id}">
      <div class="trip-card__main">
        <div class="trip-card__title">${escapeHtml(trip.name)}</div>
        <div class="trip-card__subtitle">${escapeHtml(trip.destination)}</div>
        <div class="trip-card__dates">${trip.startDate || "—"} → ${trip.endDate || "—"}</div>
      </div>
      <div class="trip-card__stub">
        <div class="trip-card__countdown-num">${countdownLabel.num}</div>
        <div class="trip-card__countdown-label">${countdownLabel.label}</div>
      </div>
      <div class="trip-card__actions">
        <button class="trip-card__icon-btn" data-action="edit" data-id="${trip.id}" aria-label="編輯">✎</button>
        <button class="trip-card__icon-btn" data-action="delete" data-id="${trip.id}" aria-label="刪除">🗑</button>
      </div>
    </div>
  `;
}

function countdownText(days) {
  if (days === null) return { num: "–", label: "未設定" };
  if (days > 0) return { num: days, label: "天後出發" };
  if (days === 0) return { num: "今天", label: "出發" };
  return { num: "已出發", label: "" };
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
