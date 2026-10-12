/**
 * 新增/編輯清單項目的表單 Modal（記事本／必買清單用）。
 * 行李清單不會呼叫這個表單新增（行李清單用頁面上的快速輸入列），
 * 但行李清單項目要補備註時，一樣是呼叫這裡編輯——
 * showPlace 這個布林值決定要不要顯示「地點」欄位（只有記事本/必買清單才有）。
 */
import { checklistService } from "../../services/checklistService.js";
import { placeService } from "../../services/placeService.js";
import { createChecklistItemDraft, listHasPlaceField } from "../../data/models/ChecklistItem.js";
import { openPlacePicker } from "../places/placePickerView.js";
import { openPhotoViewer } from "../photos/photoViewer.js";
import { svgIcon } from "../../core/icons.js";
import {
  compressImage,
  storageUsedChars,
  photosChars,
  PHOTO_MAX_COUNT,
  STORAGE_BUDGET_CHARS,
} from "../../core/photos.js";

/**
 * 開啟清單項目表單。行李清單只有「項目」＋「備註」；記事本／必買清單多一個「地點」。
 * existingItem 為 null 表示新增；有值則為編輯。
 */
export function openChecklistItemForm({ tripId, listType, existingItem = null, onSaved }) {
  const draft = existingItem ? { ...existingItem } : createChecklistItemDraft(tripId, listType);
  const isEdit = !!existingItem;
  const showPlace = listHasPlaceField(listType);
  let place = showPlace && draft.placeId ? placeService.getPlace(draft.placeId) : null;
  // 表單裡目前的照片（還沒按儲存前都只在這裡，不會寫進 localStorage）
  let photos = [...(draft.photos || [])];
  // 這個項目原本已存的照片字元數：計算容量時要扣掉，因為儲存後會被 photos 取代
  const savedPhotoChars = photosChars(existingItem?.photos);
  let busy = false; // 壓縮中，暫時不能儲存

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal-sheet" role="dialog" aria-modal="true">
      <div class="modal-sheet__header">
        <h2>${isEdit ? "編輯項目" : "新增項目"}</h2>
        <button class="modal-sheet__close" aria-label="關閉">&times;</button>
      </div>

      <div class="field">
        <label for="ci-text">項目</label>
        <input id="ci-text" type="text" placeholder="例如：想吃的餐廳、想買的伴手禮" value="${escapeAttr(draft.text)}" />
      </div>

      ${
        showPlace
          ? `<div class="field">
               <label>地點（選填）</label>
               <button type="button" class="place-select-btn" data-action="pick-place">
                 <span id="ci-place-label">${place ? escapeHtml(place.name) : "選擇地點"}</span>
                 <span>›</span>
               </button>
               ${place ? `<button type="button" id="ci-clear-place" class="edit-place-link">✕ 清除地點</button>` : ""}
             </div>`
          : ""
      }

      <div class="field">
        <label for="ci-notes">備註</label>
        <textarea id="ci-notes" rows="2" placeholder="可以貼網址，會自動變成可點擊連結">${escapeHtml(draft.notes)}</textarea>
      </div>

      <div class="field">
        <div class="photo-field__label-row">
          <label>照片</label>
          <span class="photo-field__count" id="ci-photo-count"></span>
        </div>
        <div class="photo-row" id="ci-photo-row"></div>
        <input type="file" id="ci-photo-input" accept="image/*" multiple style="display: none" />
        <div class="photo-hint" id="ci-photo-hint"></div>
      </div>

      <div class="field" id="ci-errors" style="color: var(--color-coral); font-size: 0.85rem; display: none;"></div>
      <div class="modal-actions">
        <button class="btn btn--ghost btn--block" data-action="cancel">取消</button>
        <button class="btn btn--primary btn--block" data-action="save">${isEdit ? "儲存變更" : "新增"}</button>
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

  if (showPlace) {
    backdrop.querySelector('[data-action="pick-place"]').addEventListener("click", () => {
      openPlacePicker({
        onSelect: (selected) => {
          place = selected;
          rerenderPlaceField();
        },
      });
    });

    const clearBtn = backdrop.querySelector("#ci-clear-place");
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        place = null;
        rerenderPlaceField();
      });
    }
  }

  function rerenderPlaceField() {
    if (!showPlace) return;
    backdrop.querySelector("#ci-place-label").textContent = place ? place.name : "選擇地點";
    const existingClear = backdrop.querySelector("#ci-clear-place");
    if (place && !existingClear) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.id = "ci-clear-place";
      btn.className = "edit-place-link";
      btn.textContent = "✕ 清除地點";
      btn.addEventListener("click", () => {
        place = null;
        rerenderPlaceField();
      });
      backdrop.querySelector('[data-action="pick-place"]').insertAdjacentElement("afterend", btn);
    } else if (!place && existingClear) {
      existingClear.remove();
    }
  }

  // ---- 照片欄位 ----
  const photoRow = backdrop.querySelector("#ci-photo-row");
  const photoInput = backdrop.querySelector("#ci-photo-input");

  /** 儲存後 localStorage 大約會用到多少字元 */
  function projectedChars(extra = 0) {
    return storageUsedChars() - savedPhotoChars + photosChars(photos) + extra;
  }

  function renderPhotos(message = "") {
    photoRow.innerHTML =
      photos
        .map(
          (src, i) => `
        <div class="photo-thumb">
          <img src="${src}" alt="" data-view="${i}" />
          <button type="button" class="photo-thumb__remove" data-remove="${i}" aria-label="移除這張照片">&times;</button>
        </div>`
        )
        .join("") +
      (photos.length < PHOTO_MAX_COUNT
        ? `<button type="button" class="photo-add-btn" data-action="add-photo" ${busy ? "disabled" : ""}>
             ${svgIcon("photo")}<span>${busy ? "處理中" : "新增"}</span>
           </button>`
        : "");

    backdrop.querySelector("#ci-photo-count").textContent = `${photos.length} / ${PHOTO_MAX_COUNT}`;
    const percent = Math.min(100, Math.round((projectedChars() / STORAGE_BUDGET_CHARS) * 100));
    const hint = backdrop.querySelector("#ci-photo-hint");
    hint.classList.toggle("is-error", !!message);
    hint.textContent = message || `最多 ${PHOTO_MAX_COUNT} 張，會自動壓縮後儲存於本機・本機空間已用 ${percent}%`;

    photoRow.querySelectorAll("[data-view]").forEach((el) =>
      el.addEventListener("click", () => openPhotoViewer(photos, Number(el.dataset.view)))
    );
    photoRow.querySelectorAll("[data-remove]").forEach((el) =>
      el.addEventListener("click", () => {
        photos.splice(Number(el.dataset.remove), 1);
        renderPhotos();
      })
    );
    photoRow.querySelector('[data-action="add-photo"]')?.addEventListener("click", () => photoInput.click());
  }

  photoInput.addEventListener("change", async () => {
    const files = [...photoInput.files].slice(0, PHOTO_MAX_COUNT - photos.length);
    photoInput.value = ""; // 清掉，下次選同一張也會觸發 change
    if (!files.length) return;

    busy = true;
    renderPhotos();
    let message = "";
    for (const file of files) {
      try {
        const dataUrl = await compressImage(file);
        if (projectedChars(dataUrl.length) > STORAGE_BUDGET_CHARS) {
          message = "本機空間不足，無法再加入照片。可以先移除其他項目的照片";
          break;
        }
        photos.push(dataUrl);
      } catch {
        message = "有照片無法讀取，請換一張試試";
      }
    }
    busy = false;
    renderPhotos(message);
  });

  renderPhotos();

  backdrop.querySelector('[data-action="save"]').addEventListener("click", () => {
    if (busy) return;
    const input = {
      text: backdrop.querySelector("#ci-text").value.trim(),
      placeId: showPlace && place ? place.id : null,
      notes: backdrop.querySelector("#ci-notes").value.trim(),
      photos,
    };

    const result = isEdit
      ? checklistService.updateItem(existingItem.id, input)
      : checklistService.addItem(tripId, listType, input);

    if (!result.ok) {
      const errBox = backdrop.querySelector("#ci-errors");
      errBox.style.display = "block";
      errBox.textContent = result.errors.join("、");
      return;
    }

    close();
    if (onSaved) onSaved();
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
