/**
 * noteDetail.js — 筆記預覽（唯讀，底部面板，v0.9.0）。
 * 版面：類型徽章（完成時加「買了／看過／完成」）→「開啟連結」（顯示來源，例如 Instagram）
 *       → 內容（網址會變成連結）→ 底部「刪除｜編輯」。
 */
import { html, safeUrl } from "../../core/html.js";
import { icon } from "../../core/icons.js";
import { openSheet } from "../../core/sheet.js";
import { linkify, linkSource } from "../../core/linkify.js";
import { noteStore, noteKind } from "../../data/notes.js";
import { openNoteForm } from "./noteForm.js";

/** 完成時的說法：筆記＝看過、行程＝去過、想買／紀念品＝買了、其他＝完成（見 data/notes.js） */
export function doneLabel(kind) {
  return noteKind(kind).done;
}

export function openNoteDetail({ note, onChanged }) {
  const k = noteKind(note.kind);
  const url = safeUrl(note.url);

  openSheet({
    title: note.title,
    body: html`
      <div class="detail-badges">
        <span class="badge ${k.cat}">${icon(k.icon)}${k.label}</span>
        ${note.done ? html`<span class="badge tp-status is-visited">${icon("check")}${doneLabel(note.kind)}</span>` : ""}
      </div>

      ${url
        ? html`<div class="detail-actions">
            <a class="btn btn--ghost" href="${url}" target="_blank" rel="noopener noreferrer">${icon("globe")}<span class="btn__label">${linkSource(url)}</span></a>
          </div>`
        : ""}

      <div class="detail-row">
        <div class="detail-row__label">內容</div>
        ${note.body.trim()
          ? html`<div class="detail-row__value is-prewrap note-body">${linkify(note.body)}</div>`
          : html`<div class="detail-row__value muted">還沒有寫內容</div>`}
      </div>

      <div class="form__actions form__actions--spaced">
        <button type="button" class="btn btn--danger" data-action="delete">刪除</button>
        <button type="button" class="btn btn--primary" data-action="edit">編輯</button>
      </div>
    `,
    onMount(panel, close) {
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
