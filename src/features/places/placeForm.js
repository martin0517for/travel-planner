/**
 * placeForm.js — 新增／編輯地點（底部滑出面板）。
 *
 * openPlaceForm({ place, defaults, onSaved, onDeleted })
 *   place     null → 新增；有值 → 編輯
 *   defaults  新增時的預設值（例如列表正篩選「東京」時，地區先帶入東京）
 *   onSaved(place)  存好之後呼叫（之後「選擇地點」時新增完可以直接選用）
 *
 * 「Google 地圖連結」：從 Google 地圖「分享」複製的連結，按「導航」時直接打開它。
 * 「地圖標示位置（座標）」：只用在 App 內的地圖標示，有兩種設定方式：
 *   1. 搜尋框（預設等於名稱，可另外修改）：用 OpenStreetMap 搜尋，從結果中點選
 *   2. 貼上座標（或含座標的完整地圖連結），自動解析
 */
import { html, render } from "../../core/html.js";
import { icon } from "../../core/icons.js";
import { openSheet } from "../../core/sheet.js";
import { placeStore, PLACE_CATEGORIES, LIMITS } from "../../data/places.js";
import { parseCoordinates, looksLikeMapUrl, searchPlaces, isValidLatLng } from "../../core/geo.js";

export function openPlaceForm({ place = null, defaults = {}, onSaved, onDeleted } = {}) {
  const isEdit = Boolean(place);
  const v = place || {
    name: "", category: defaults.category || "attraction", area: defaults.area || "",
    tags: [], address: "", lat: null, lng: null, mapsUrl: "", website: "", notes: "",
  };
  // 位置的暫存狀態（按「儲存」才會寫入）
  let coords = isValidLatLng(v.lat, v.lng) ? { lat: v.lat, lng: v.lng } : null;
  const areas = placeStore.areas();

  openSheet({
    title: isEdit ? "編輯地點" : "新增地點",
    body: html`
      <form class="form" novalidate>
        <div class="field">
          <label for="pl-title">名稱 <span class="field__required">必填</span></label>
          <input id="pl-title" name="placeTitle" type="search" enterkeyhint="done" maxlength="${LIMITS.name}" autocomplete="off" autocorrect="off"
                 placeholder="例如：淺草寺" value="${v.name}" />
        </div>

        <fieldset class="field">
          <legend class="field__legend">分類</legend>
          <div class="chips chips--wrap">
            ${PLACE_CATEGORIES.map(
              (c) => html`
                <label class="chip chip--cat cat--${c.value} chip--radio">
                  <input type="radio" name="category" value="${c.value}" ${c.value === v.category ? "checked" : ""} />
                  ${icon(c.value)}${c.label}
                </label>
              `
            )}
          </div>
        </fieldset>

        <div class="field">
          <label for="pl-area">地區</label>
          <input id="pl-area" name="area" type="search" enterkeyhint="done" maxlength="${LIMITS.area}" autocomplete="off"
                 list="pl-area-options" placeholder="例如：東京" value="${v.area}" />
          <datalist id="pl-area-options">${areas.map((a) => html`<option value="${a}"></option>`)}</datalist>
          ${areas.length
            ? html`<div class="quick-picks">${areas.slice(0, 6).map((a) => html`<button type="button" class="tag tag--btn" data-area="${a}">${a}</button>`)}</div>`
            : ""}
        </div>

        <div class="field">
          <label for="pl-mapurl">Google 地圖連結</label>
          <input id="pl-mapurl" name="placeMapUrl" type="search" enterkeyhint="done" inputmode="url" autocomplete="off"
                 autocorrect="off" autocapitalize="off" placeholder="https://maps.app.goo.gl/…" value="${v.mapsUrl}" />
          <p class="field__hint field__hint--tight">在 Google 地圖按「分享」→「複製連結」貼上。按「導航」會直接打開這個連結；沒填就用名稱搜尋。</p>
        </div>

        <fieldset class="field location">
          <legend class="field__legend">地圖標示位置（座標）</legend>
          <div class="location__status" id="pl-loc-status"></div>

          <div class="location__query">
            <input id="pl-query" type="search" enterkeyhint="search" autocomplete="off" autocorrect="off"
                   maxlength="120" aria-label="搜尋位置用的文字" placeholder="輸入要搜尋的地點" value="${v.name}" />
            <button type="button" class="btn btn--small" data-action="search">${icon("search")}搜尋</button>
          </div>
          <p class="field__hint field__hint--tight">預設跟名稱一樣，可以改成日文或英文名稱再搜尋，不會影響上面的名稱。</p>
          <div class="location__results" id="pl-results" aria-live="polite"></div>

          <div class="location__paste">
            <input id="pl-paste" type="search" enterkeyhint="done" inputmode="url" autocomplete="off"
                   placeholder="或貼上座標，例如 35.71, 139.79" />
            <button type="button" class="btn btn--small" data-action="parse">套用</button>
          </div>
          <p class="field__hint" id="pl-paste-msg">只用在 App 內的地圖標示。Google 地圖長按地點，可以複製座標貼上。</p>
        </fieldset>

        <div class="field">
          <label for="pl-address">地址</label>
          <input id="pl-address" name="placeAddr" type="search" enterkeyhint="done" maxlength="${LIMITS.address}" autocomplete="off" value="${v.address}" />
        </div>

        <div class="field">
          <label for="pl-tags">標籤</label>
          <input id="pl-tags" name="tags" type="search" enterkeyhint="done" autocomplete="off" placeholder="用逗號分隔，例如：必訪, 雨天備案"
                 value="${v.tags.join(", ")}" />
        </div>

        <div class="field">
          <label for="pl-website">官網</label>
          <input id="pl-website" name="website" type="search" enterkeyhint="done" inputmode="url" autocomplete="off" placeholder="https://"
                 value="${v.website}" />
        </div>

        <div class="field">
          <label for="pl-notes">備註</label>
          <textarea id="pl-notes" name="notes" rows="3" maxlength="${LIMITS.notes}"
                    placeholder="營業時間、推薦菜色…網址會自動變成連結">${v.notes}</textarea>
        </div>

        <div class="form__errors" role="alert" hidden></div>
        <div class="form__actions">
          <button type="button" class="btn btn--ghost" data-action="cancel">取消</button>
          <button type="submit" class="btn btn--primary">${isEdit ? "儲存" : "新增"}</button>
        </div>
        ${isEdit ? html`<button type="button" class="btn btn--danger-text" data-action="delete">刪除這個地點</button>` : ""}
      </form>
    `,
    onMount(panel, close) {
      const form = panel.querySelector("form");
      const errorsBox = panel.querySelector(".form__errors");
      const statusBox = panel.querySelector("#pl-loc-status");
      const resultsBox = panel.querySelector("#pl-results");
      const pasteInput = panel.querySelector("#pl-paste");
      const pasteMsg = panel.querySelector("#pl-paste-msg");
      const searchBtn = panel.querySelector('[data-action="search"]');
      const mapUrlInput = form.elements.placeMapUrl;
      const queryInput = panel.querySelector("#pl-query");

      // 搜尋框預設跟名稱同步；使用者自己改過搜尋框之後，就不再跟著名稱變
      let queryEdited = false;
      queryInput.addEventListener("input", () => { queryEdited = true; });
      form.elements.placeTitle.addEventListener("input", () => {
        if (!queryEdited) queryInput.value = form.elements.placeTitle.value;
      });

      function paintStatus() {
        render(
          statusBox,
          coords
            ? html`
                <span class="location__ok">${icon("pin")}已定位 <span class="mono">${coords.lat}, ${coords.lng}</span></span>
                <button type="button" class="link-btn" data-action="clear-coords">清除</button>
              `
            : html`<span class="muted">尚未定位（不會顯示在 App 的地圖上）</span>`
        );
        const clear = statusBox.querySelector('[data-action="clear-coords"]');
        if (clear) clear.addEventListener("click", () => { coords = null; paintStatus(); });
      }
      paintStatus();

      // 地區快速選擇
      panel.querySelectorAll("[data-area]").forEach((b) =>
        b.addEventListener("click", () => { form.elements.area.value = b.dataset.area; })
      );

      // 1. 用名稱搜尋
      searchBtn.addEventListener("click", async () => {
        const query = queryInput.value.trim() || form.elements.placeTitle.value.trim();
        searchBtn.disabled = true;
        render(resultsBox, html`<p class="muted">搜尋中…</p>`);
        try {
          const results = await searchPlaces(query);
          render(
            resultsBox,
            results.length
              ? html`
                  <p class="field__hint">點選正確的那一個：</p>
                  ${results.map(
                    (r, i) => html`
                      <button type="button" class="result" data-index="${i}">
                        <span class="result__name">${r.name}</span>
                        <span class="result__addr">${r.address}</span>
                      </button>
                    `
                  )}
                  <p class="field__hint">搜尋資料來源：© OpenStreetMap 貢獻者</p>
                `
              : html`<p class="muted">找不到結果。可以把搜尋框改成日文或英文名稱再試，或改用貼上座標。</p>`
          );
          resultsBox.querySelectorAll("[data-index]").forEach((b) =>
            b.addEventListener("click", () => {
              const r = results[Number(b.dataset.index)];
              coords = { lat: r.lat, lng: r.lng };
              if (!form.elements.placeAddr.value.trim()) form.elements.placeAddr.value = r.address.slice(0, LIMITS.address);
              render(resultsBox, html``);
              paintStatus();
            })
          );
        } catch (err) {
          render(resultsBox, html`<p class="form__errors">${err.message}</p>`);
        } finally {
          searchBtn.disabled = false;
        }
      });

      // 在搜尋框按鍵盤的「搜尋」鍵 → 執行搜尋（不要送出整個表單）
      queryInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          searchBtn.click();
        }
      });

      // 2. 貼上座標（也接受含座標的完整地圖連結；是地圖連結且上方連結欄還空著，就順便填進去）
      function applyPaste() {
        const text = pasteInput.value.trim();
        if (!text) return;
        const found = parseCoordinates(text);
        const url = looksLikeMapUrl(text);
        if (url && !mapUrlInput.value.trim()) mapUrlInput.value = url;
        if (found) {
          coords = found;
          pasteMsg.textContent = "已取得座標。";
        } else if (url) {
          pasteMsg.textContent = "這個連結裡沒有座標（短網址無法解析），已填入上方的 Google 地圖連結。要在 App 地圖上標示，請用上方的搜尋框搜尋，或貼上座標。";
        } else {
          pasteMsg.textContent = "看不懂這段內容。請貼上「35.71, 139.79」格式的座標。";
        }
        pasteInput.value = "";
        paintStatus();
      }

      // 連結欄：貼上的完整連結裡如果有座標、而且還沒定位，順便帶入座標
      mapUrlInput.addEventListener("change", () => {
        const found = parseCoordinates(mapUrlInput.value);
        if (found && !coords) {
          coords = found;
          paintStatus();
        }
      });
      panel.querySelector('[data-action="parse"]').addEventListener("click", applyPaste);
      pasteInput.addEventListener("paste", () => setTimeout(applyPaste, 0));

      function showErrors(errors) {
        render(errorsBox, html`${errors.map((e) => html`<div>${e}</div>`)}`);
        errorsBox.hidden = false;
        errorsBox.scrollIntoView({ block: "center", behavior: "smooth" });
      }

      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const input = {
          name: form.elements.placeTitle.value,
          category: form.elements.category.value,
          area: form.elements.area.value,
          tags: form.elements.tags.value,
          address: form.elements.placeAddr.value,
          lat: coords ? coords.lat : null,
          lng: coords ? coords.lng : null,
          mapsUrl: mapUrlInput.value,
          website: form.elements.website.value,
          notes: form.elements.notes.value,
        };
        const result = isEdit ? placeStore.update(place.id, input) : placeStore.create(input);
        if (!result.ok) return showErrors(result.errors);
        close();
        if (onSaved) onSaved(result.place);
      });

      panel.querySelector('[data-action="cancel"]').addEventListener("click", close);

      const delBtn = panel.querySelector('[data-action="delete"]');
      if (delBtn) {
        delBtn.addEventListener("click", () => {
          if (!window.confirm(`確定要刪除「${place.name}」嗎？這個動作無法復原。`)) return;
          const result = placeStore.remove(place.id);
          if (!result.ok) return showErrors(result.errors);
          close();
          if (onDeleted) onDeleted();
        });
      }

    },
  });
}
