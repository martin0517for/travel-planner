/**
 * tripNotes.js — 清單頁籤的「筆記」分頁（v0.9.0，2026-11-01 使用者決定）。
 *
 * 每趟旅程自己的筆記：想買的東西、參考文章等。
 * 版面（由上到下）：
 *   搜尋框（只搜這趟：標題、內容、網址）＋「＋」新增
 *   類型篩選列（全部＋筆記／行程／想買／紀念品／其他；只列這趟用到的，只有一種時不顯示）
 *   「未完成」「完成」兩個區塊（各顯示數量；新的排上面）
 *     每列：勾選框（只有點框才會勾）、類型圖示、標題、連結來源（有連結時）
 *     完成＝打勾＋變淡，移到「完成」（不加刪除線）
 * 點一列 → 預覽（noteDetail.js）→ 編輯。
 */
import { html, render, safeUrl } from "../../core/html.js";
import { icon } from "../../core/icons.js";
import { linkSource } from "../../core/linkify.js";
import { noteStore, NOTE_KINDS, noteKind } from "../../data/notes.js";
import { openNoteForm } from "./noteForm.js";
import { openNoteDetail, doneLabel } from "./noteDetail.js";

const state = { tripId: "", kind: "", q: "" };

export function renderTripNotes(box, trip) {
  if (state.tripId !== trip.id) Object.assign(state, { tripId: trip.id, kind: "", q: "" });
  paint(box, trip);
}

function paint(box, trip) {
  const notes = noteStore.listByTrip(trip.id);
  const repaint = () => paint(box, trip);
  const openNew = () => openNoteForm({ tripId: trip.id, onSaved: repaint });

  if (!notes.length) {
    render(
      box,
      html`
        <div class="empty">
          <div class="empty__icon">${icon("note")}</div>
          <h2>還沒有筆記</h2>
          <p>記下這趟想買的東西、看到的攻略文章或貼文連結。</p>
          <button type="button" class="btn btn--primary" data-action="add">${icon("plus")}新增筆記</button>
        </div>
      `
    );
    box.querySelector('[data-action="add"]').addEventListener("click", openNew);
    return;
  }

  const kinds = NOTE_KINDS.filter((k) => notes.some((n) => n.kind === k.value));
  if (state.kind && !kinds.some((k) => k.value === state.kind)) state.kind = "";
  const oldChips = box.querySelector(".chips[aria-label]");
  const chipScroll = oldChips ? oldChips.scrollLeft : 0;

  render(
    box,
    html`
      <div class="place-toolbar">
        <label class="search-box">
          ${icon("search")}
          <span class="sr-only">搜尋這趟的筆記</span>
          <input type="search" id="nt-q" placeholder="搜尋這趟的筆記" value="${state.q}"
                 autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" />
        </label>
        <button type="button" class="btn btn--primary btn--icon" data-action="add" aria-label="新增筆記">${icon("plus")}</button>
      </div>
      ${kinds.length > 1
        ? html`
            <div class="chips" role="group" aria-label="筆記類型">
              <button type="button" class="chip ${state.kind ? "" : "is-active"}" data-kind="" aria-pressed="${state.kind ? "false" : "true"}">全部</button>
              ${kinds.map(
                (k) => html`
                  <button type="button" class="chip chip--cat ${k.cat} ${state.kind === k.value ? "is-active" : ""}"
                          data-kind="${k.value}" aria-pressed="${state.kind === k.value ? "true" : "false"}">${icon(k.icon)}${k.label}</button>
                `
              )}
            </div>
          `
        : ""}
      <div id="nt-results"></div>
    `
  );

  const chips = box.querySelector(".chips[aria-label]");
  if (chips) chips.scrollLeft = chipScroll;
  box.querySelector('[data-action="add"]').addEventListener("click", openNew);
  box.querySelectorAll("[data-kind]").forEach((btn) =>
    btn.addEventListener("click", () => {
      state.kind = btn.dataset.kind;
      repaint();
    })
  );
  const q = box.querySelector("#nt-q");
  q.addEventListener("input", () => {
    state.q = q.value;
    paintResults(box, notes, repaint);
  });
  q.addEventListener("keydown", (e) => {
    if (e.key === "Enter") q.blur(); // 按鍵盤的「搜尋」只收起鍵盤
  });
  paintResults(box, notes, repaint);
}

/** 只重畫列表（打字搜尋時不重畫搜尋框，游標和鍵盤才不會跳掉） */
function paintResults(box, notes, repaint) {
  const results = box.querySelector("#nt-results");
  const text = state.q.trim().toLowerCase();
  const shown = notes.filter(
    (n) => (!state.kind || n.kind === state.kind) && (!text || [n.title, n.body, n.url].some((t) => t.toLowerCase().includes(text)))
  );
  const groups = [
    { title: "未完成", list: shown.filter((n) => !n.done) },
    { title: "完成", list: shown.filter((n) => n.done) },
  ].filter((g) => g.list.length);

  render(
    results,
    groups.length
      ? html`${groups.map(
          (g) => html`
            <div class="tp-section"><span>${g.title}</span><span>${g.list.length}</span></div>
            <ul class="place-list tp-list">${g.list.map(row)}</ul>
          `
        )}`
      : html`<p class="muted center">沒有符合條件的筆記。</p>`
  );

  results.querySelectorAll("[data-done]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const note = noteStore.get(btn.dataset.done);
      if (!note) return;
      const result = noteStore.setDone(note.id, !note.done);
      if (!result.ok) return window.alert(result.errors.join("\n"));
      repaint();
    })
  );
  results.querySelectorAll("[data-open]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const note = noteStore.get(btn.dataset.open);
      if (note) openNoteDetail({ note, onChanged: repaint });
    })
  );
}

function row(n) {
  const k = noteKind(n.kind);
  const url = safeUrl(n.url);
  return html`
    <li class="tp-row ${n.done ? "is-visited" : ""}">
      <button type="button" class="tp-check ${n.done ? "is-checked" : ""}" data-done="${n.id}"
              role="checkbox" aria-checked="${n.done ? "true" : "false"}" aria-label="${doneLabel(n.kind)}：${n.title}">
        <span class="tp-check__box">${n.done ? icon("check") : ""}</span>
      </button>
      <button type="button" class="tp-row__main" data-open="${n.id}">
        <span class="place-row__icon ${k.cat}" title="${k.label}">${icon(k.icon)}</span>
        <span class="place-row__body">
          <span class="place-row__name">${n.title}</span>
          ${url ? html`<span class="note-link">${icon("link")}<span>${linkSource(url)}</span></span>` : ""}
        </span>
      </button>
    </li>
  `;
}
