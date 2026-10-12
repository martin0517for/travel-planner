/**
 * 新增/編輯地點的表單 Modal。跟 tripFormView.js 是同一種「Modal 表單」模式，
 * 比較特別的是經緯度用單一欄位輸入，貼上「25.08, 121.23」這種文字會自動解析
 * （parseLatLng 函式），因為使用者通常是直接從 Google Maps 複製座標貼過來。
 */
import { placeService } from "../../services/placeService.js";
import { createPlaceDraft, PLACE_CATEGORIES } from "../../data/models/Place.js";

/**
 * 開啟地點表單 Modal。
 * existingPlace 為 null 表示新增；有值則為編輯。
 * defaultCategory 給新增時預設分類（例如從「選住宿」情境開啟時預設 hotel）。
 * onSaved(place) 存檔成功後呼叫。
 */
export function openPlaceForm({ existingPlace = null, defaultCategory = "attraction", onSaved }) {
  const draft = existingPlace ? { ...existingPlace } : { ...createPlaceDraft(), category: defaultCategory };
  const isEdit = !!existingPlace;

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal-sheet" role="dialog" aria-modal="true">
      <div class="modal-sheet__header">
        <h2>${isEdit ? "編輯地點" : "新增地點"}</h2>
        <button class="modal-sheet__close" aria-label="關閉">&times;</button>
      </div>
      <div class="field">
        <label for="p-name">名稱</label>
        <input id="p-name" type="text" placeholder="例如：東京文華東方酒店" value="${escapeAttr(draft.name)}" />
      </div>
      <div class="field">
        <label for="p-category">類別</label>
        <select id="p-category">
          ${PLACE_CATEGORIES.map(
            (c) => `<option value="${c.value}" ${draft.category === c.value ? "selected" : ""}>${c.label}</option>`
          ).join("")}
        </select>
      </div>
      <div class="field">
        <label for="p-tags">自訂分類</label>
        <input id="p-tags" type="text" list="p-tags-suggestions" placeholder="例如：東京、必訪、家庭出遊（多個用逗號分隔）" value="${escapeAttr((draft.tags || []).join(", "))}" />
        <datalist id="p-tags-suggestions">
          ${placeService.listAllTags().map((t) => `<option value="${escapeAttr(t)}"></option>`).join("")}
        </datalist>
        <div style="font-size: 0.72rem; color: var(--color-ink-soft); margin-top: 4px;">自己輸入分類名稱即可（例如城市、行程段落），之後在地點資料庫可以用這個篩選。</div>
      </div>
      <div class="field">
        <label for="p-address">地址</label>
        <input id="p-address" type="text" value="${escapeAttr(draft.address)}" />
      </div>
      <div class="field">
        <label for="p-latlng">經緯度</label>
        <input id="p-latlng" type="text" placeholder="例如：25.08127994987264, 121.23120991173433" value="${latLngValue(draft)}" />
        <div style="font-size: 0.72rem; color: var(--color-ink-soft); margin-top: 4px;">可直接貼上 Google Maps 複製的座標（緯度, 經度），會自動解析。</div>
      </div>
      <div class="field">
        <label for="p-maps">Google Maps 連結</label>
        <input id="p-maps" type="text" placeholder="https://maps.google.com/..." value="${escapeAttr(draft.googleMapsUrl)}" />
      </div>
      <div class="field">
        <label for="p-website">官方網站</label>
        <input id="p-website" type="text" value="${escapeAttr(draft.website)}" />
      </div>
      <div class="field">
        <label for="p-notes">備註</label>
        <textarea id="p-notes" rows="2">${escapeHtml(draft.notes)}</textarea>
      </div>
      <div class="field" id="p-errors" style="color: var(--color-coral); font-size: 0.85rem; display: none;"></div>
      <div class="modal-actions">
        <button class="btn btn--ghost btn--block" data-action="cancel">取消</button>
        <button class="btn btn--primary btn--block" data-action="save">${isEdit ? "儲存變更" : "建立地點"}</button>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);

  function close() {
    backdrop.remove();
  }

  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });
  backdrop.querySelector(".modal-sheet__close").addEventListener("click", close);
  backdrop.querySelector('[data-action="cancel"]').addEventListener("click", close);

  backdrop.querySelector('[data-action="save"]').addEventListener("click", () => {
    const { lat, lng } = parseLatLng(backdrop.querySelector("#p-latlng").value);

    const input = {
      ...draft,
      name: backdrop.querySelector("#p-name").value.trim(),
      category: backdrop.querySelector("#p-category").value,
      tags: parseTags(backdrop.querySelector("#p-tags").value),
      address: backdrop.querySelector("#p-address").value.trim(),
      lat,
      lng,
      googleMapsUrl: backdrop.querySelector("#p-maps").value.trim(),
      website: backdrop.querySelector("#p-website").value.trim(),
      notes: backdrop.querySelector("#p-notes").value.trim(),
    };

    const result = isEdit
      ? placeService.updatePlace(existingPlace.id, input)
      : placeService.createPlace(input);

    if (!result.ok) {
      const errBox = backdrop.querySelector("#p-errors");
      errBox.style.display = "block";
      errBox.textContent = result.errors.join("、");
      return;
    }

    close();
    if (onSaved) onSaved(result.place);
  });
}

function escapeAttr(str) {
  return String(str || "").replace(/"/g, "&quot;");
}
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

/** 把逗號分隔的自訂分類字串轉成去重、去空白的陣列 */
function parseTags(raw) {
  if (!raw || !raw.trim()) return [];
  const seen = new Set();
  raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .forEach((t) => seen.add(t));
  return [...seen];
}

/** 把已存的 lat/lng 組成欄位預設值，例如 "25.081280, 121.231210" */
function latLngValue(draft) {
  if (draft.lat === null || draft.lat === undefined || draft.lng === null || draft.lng === undefined) return "";
  return `${draft.lat}, ${draft.lng}`;
}

/**
 * 容錯解析經緯度輸入：允許直接貼上像
 * 「桃園國際機場 經緯度: 25.08127994987264, 121.23120991173433」這種整段文字，
 * 只抓出裡面前兩個數字當作緯度、經度。
 */
function parseLatLng(raw) {
  if (!raw || !raw.trim()) return { lat: null, lng: null };
  const numbers = raw.match(/-?\d+(\.\d+)?/g);
  if (!numbers || numbers.length < 2) return { lat: null, lng: null };
  const lat = parseFloat(numbers[0]);
  const lng = parseFloat(numbers[1]);
  return { lat: isNaN(lat) ? null : lat, lng: isNaN(lng) ? null : lng };
}
