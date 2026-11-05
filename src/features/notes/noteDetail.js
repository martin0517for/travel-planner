/**
 * noteDetail.js — 筆記預覽（唯讀，底部面板，v0.9.0）。
 * 版面：類型徽章（完成時加「買了／看過／完成」）→「開啟連結」（顯示來源，例如 Instagram）
 *       → 地點列表（v0.12.0：編號、分類圖示、名稱、地區，右邊「導航」；點地點 → 疊上地點預覽）
 *       → 內容（網址會變成連結）→ 底部「刪除｜編輯」。
 * stacked（v0.12.1）：從地點預覽、行程項目預覽點筆記時，疊在上面、只看內容：
 *   地點列表不能再點（只留導航），底部「返回地點／返回行程」＋「到筆記頁編輯」
 *   （關掉所有預覽，跳到「清單 → 筆記」並打開這則的完整預覽）。
 */
import { html, safeUrl } from "../../core/html.js";
import { icon } from "../../core/icons.js";
import { openSheet } from "../../core/sheet.js";
import { linkify, linkSource } from "../../core/linkify.js";
import { noteStore, noteKind, noteKindLabel } from "../../data/notes.js";
import { openNoteForm } from "./noteForm.js";
import { detailPlaceList, wirePlaceLinks } from "../places/placeLinks.js";
import { closeAllSheets } from "../../core/sheet.js";
import { showTripNote } from "../lists/tripLists.js";

/** 完成時的說法：筆記＝看過、行程＝去過、想買／紀念品＝買了、其他＝完成（見 data/notes.js） */
export function doneLabel(kind) {
  return noteKind(kind).done;
}

export function openNoteDetail({ note, onChanged, stacked = false, backLabel = "返回" }) {
  const k = noteKind(note.kind);
  const url = safeUrl(note.url);

  openSheet({
    title: note.title,
    body: html`
      <div class="detail-badges">
        <span class="badge ${k.cat}">${icon(k.icon)}${noteKindLabel(note)}</span>
        ${note.done ? html`<span class="badge tp-status is-visited">${icon("check")}${doneLabel(note.kind)}</span>` : ""}
      </div>

      ${url
        ? html`<div class="detail-actions">
            <a class="btn btn--ghost" href="${url}" target="_blank" rel="noopener noreferrer">${icon("globe")}<span class="btn__label">${linkSource(url)}</span></a>
          </div>`
        : ""}

      ${note.placeIds.length
        ? html`<div class="detail-row">
            <div class="detail-row__label">地點</div>
            ${detailPlaceList(note.placeIds, { clickable: !stacked })}
          </div>`
        : ""}

      <div class="detail-row">
        <div class="detail-row__label">內容</div>
        ${note.body.trim()
          ? html`<div class="detail-row__value is-prewrap note-body">${linkify(note.body)}</div>`
          : html`<div class="detail-row__value muted">還沒有寫內容</div>`}
      </div>

      ${stacked
        ? html`<div class="form__actions form__actions--spaced">
            <button type="button" class="btn btn--ghost" data-action="back">${icon("back")}${backLabel}</button>
            <button type="button" class="btn btn--primary" data-action="goto">到筆記頁編輯</button>
          </div>`
        : html`<div class="form__actions form__actions--spaced">
            <button type="button" class="btn btn--danger" data-action="delete">刪除</button>
            <button type="button" class="btn btn--primary" data-action="edit">編輯</button>
          </div>`}
    `,
    onMount(panel, close) {
      if (stacked) {
        panel.querySelector('[data-action="back"]').addEventListener("click", close);
        panel.querySelector('[data-action="goto"]').addEventListener("click", () => {
          closeAllSheets();
          showTripNote(note.tripId, note.id);
        });
        return;
      }
      wirePlaceLinks(panel, { tripId: note.tripId, backLabel: "返回筆記" });
      panel.querySelector('[data-action="delete"]').addEventListener("click", () => {
        if (!window.confirm(`確定要刪除「${note.title}」嗎？這個動作無法復原。`)) return;
        const result = noteStore.remove(note.id);
        if (!result.ok) return window.alert(result.errors.join("\n"));
        close();
        if (onChanged) onChanged();
      });
      panel.querySelector('[data-action="edit"]').addEventListener("click", () => {
        close();
        openNoteForm({
          tripId: note.tripId,
          note,
          onSaved: (fresh) => {
            if (onChanged) onChanged();
            openNoteDetail({ note: fresh, onChanged }); // 存好後打開更新過的預覽
          },
        });
      });
    },
  });
}
