/**
 * tripPlaceNotesForm.js — 編輯「這趟的備註」（整頁表單，2026-11-01，9.2 第 ② 小步）。
 *
 * openTripPlaceNotesForm({ entry, place, trip, onSaved })
 *
 * 這趟的備註只屬於這一趟旅程，跟地點資料庫裡的「地點備註」（所有旅程共用）分開。
 * 例如「想吃季節限定的草莓聖代」「跟朋友約在這裡會合」。
 * 網址在預覽裡會自動變成可點的連結。清空後儲存就是刪除備註。
 */
import { html, render } from "../../core/html.js";
import { openSheet } from "../../core/sheet.js";
import { tripPlaceStore, LIMITS } from "../../data/tripPlaces.js";

export function openTripPlaceNotesForm({ entry, place, trip, onSaved }) {
  openSheet({
    title: "這趟的備註",
    body: html`
      <form class="form" novalidate>
        <p class="field__hint">
          「${place.name}」在「${trip.name}」這趟的備註，不會影響其他旅程。網址會自動變成連結。
        </p>
        <div class="field">
          <label for="tpn-notes">這趟的備註</label>
          <textarea id="tpn-notes" name="tripNotes" rows="6" maxlength="${LIMITS.notes}"
                    autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
                    placeholder="例如：想吃季節限定的草莓聖代">${entry.notes}</textarea>
          <p class="field__hint field__hint--tight tpn-count"></p>
        </div>

        <div class="form__errors" role="alert" hidden></div>

        <div class="form__actions">
          <button type="button" class="btn btn--ghost" data-action="cancel">取消</button>
          <button type="submit" class="btn btn--primary">儲存</button>
        </div>
      </form>
    `,
    onMount(panel, close) {
      const form = panel.querySelector("form");
      const textarea = form.elements.tripNotes;
      const count = panel.querySelector(".tpn-count");
      const errorsBox = panel.querySelector(".form__errors");

      const paintCount = () => (count.textContent = `${textarea.value.length} / ${LIMITS.notes}`);
      textarea.addEventListener("input", paintCount);
      paintCount();

      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const result = tripPlaceStore.updateNotes(entry.id, textarea.value.trim());
        if (!result.ok) {
          render(errorsBox, html`${result.errors.map((err) => html`<div>${err}</div>`)}`);
          errorsBox.hidden = false;
          return;
        }
        close();
        if (onSaved) onSaved(result.item);
      });
      panel.querySelector('[data-action="cancel"]').addEventListener("click", close);
    },
  });
}
