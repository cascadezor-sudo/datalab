/**
 * English Speaking Club на /ai/interviews/english-club.html: записи созвонов с
 * PDF-разборами и общий глоссарий. Всё отдаёт callable listEnglishClub (узлы
 * закрыты правилами). Ментор добавляет запись: файлы уходят в R2 (r2-upload.js),
 * фразы из ESC <дата>.glossary.json скилла schmidtml-esc — в saveEnglishClubRecord,
 * он же проверяет поля (functions/english-club.js). Разбор ошибок из ESC <дата>.md
 * разбирает тот же вызов, а показывает окно по кнопке в карточке созвона: данные
 * приходят отдельно (getEnglishClubMistakes) и только при первом открытии.
 */
(function () {
  const t =
    typeof window.t === "function"
      ? window.t
      : (s, vars) =>
          String(s).replace(/\{(\w+)\}/g, (m, k) =>
            vars && k in vars ? vars[k] : m,
          );

  const esc = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );

  // Ключи — TERM_CATEGORIES из functions/english-club.js.
  const CATEGORIES = [
    ["colleagues", t("Общение с коллегами")],
    ["pitch", "Self-pitch"],
    ["career", t("Собеседования и карьера")],
    ["tech", t("Технические объяснения")],
    ["culture", t("Культурные особенности")],
  ];

  let records = [];
  let glossary = [];
  let canEdit = false;
  // Секции глоссария свёрнуты: карточки появляются, когда секцию раскрыли.
  const openGroups = new Set();
  let dialog = null;
  let editingId = null;
  let activeXhr = null;
  let mistakesDialog = null;
  let mistakesSections = [];
  // «Просмотрено» — собственные данные ученика, как у записей собесов:
  // users/<uid>/watchedEnglishClub/<id> = время отметки, функции не нужны.
  // Достижения считают только записи собесов, поэтому узел отдельный.
  let watched = {};
  const mistakesCache = new Map();

  function formatDay(day) {
    return new Date(`${day}T00:00:00Z`).toLocaleDateString(
      window.i18n?.locale,
      {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      },
    );
  }

  function watchedRef(id = "") {
    const uid = firebase.auth().currentUser?.uid;
    if (!uid) return null;
    return firebase
      .database()
      .ref(`users/${uid}/watchedEnglishClub${id ? `/${id}` : ""}`);
  }

  async function loadWatched() {
    try {
      const snapshot = await watchedRef()?.once("value");
      watched = snapshot?.val() || {};
    } catch (error) {
      console.warn("English club: watched load failed", error);
    }
  }

  function watchedButton(id) {
    const on = Boolean(watched[id]);
    return `<button type="button" class="iv-watched-toggle${on ? " is-on" : ""}" data-ec-watched="${esc(id)}" aria-pressed="${on}">${esc(on ? t("✓ Просмотрено") : t("Отметить просмотренным"))}</button>`;
  }

  function renderWatchedCount() {
    const done = records.filter((record) => watched[record.id]).length;
    document.getElementById("ec-records-count").textContent = records.length
      ? `${t("Просмотрено")}: ${done} / ${records.length}`
      : "";
  }

  function syncWatched(id) {
    const button = document.querySelector(
      `[data-ec-watched="${CSS.escape(id)}"]`,
    );
    if (!button) return;
    button
      .closest(".ec-record")
      .classList.toggle("is-watched", Boolean(watched[id]));
    button.outerHTML = watchedButton(id);
    renderWatchedCount();
  }

  async function toggleWatched(id) {
    const previous = watched[id];
    const on = !previous;
    if (on) watched[id] = Date.now();
    else delete watched[id];
    syncWatched(id);
    try {
      const ref = watchedRef(id);
      if (!ref) throw new Error("not signed in");
      await (on
        ? ref.set(firebase.database.ServerValue.TIMESTAMP)
        : ref.remove());
    } catch (error) {
      console.warn("English club: watched save failed", error);
      if (previous) watched[id] = previous;
      else delete watched[id];
      syncWatched(id);
    }
  }

  function recordCard(record) {
    const url = esc(record.videoUrl);
    const media =
      record.mediaType === "audio"
        ? `<audio class="ec-media" controls preload="none" src="${url}"></audio>`
        : `<video class="ec-media" controls preload="metadata" controlsList="nodownload" src="${url}"></video>`;
    const pdf = record.pdfUrl
      ? `<a class="ec-pdf" href="${esc(record.pdfUrl)}" target="_blank" rel="noopener noreferrer">${esc(t("Открыть разбор (PDF)"))}</a>`
      : "";
    const mistakes = record.mistakesCount
      ? `<button type="button" class="ec-mistakes-open" data-ec-mistakes="${esc(record.id)}">${esc(t("Ошибки и как сказать правильнее"))} · ${esc(record.mistakesCount)}</button>`
      : "";
    const admin = canEdit
      ? `<span class="ir-admin"><button type="button" data-ec-edit="${esc(record.id)}">${esc(t("Изменить"))}</button><button type="button" data-ec-delete="${esc(record.id)}">${esc(t("Удалить"))}</button></span>`
      : "";
    return `<article class="ec-record${watched[record.id] ? " is-watched" : ""}">${media}<h3 class="ec-record-title">${esc(record.title)}</h3><time class="ec-record-date" datetime="${esc(record.addedAt)}">${esc(formatDay(record.addedAt))}</time>${record.description ? `<p>${esc(record.description)}</p>` : ""}${pdf}${mistakes}${watchedButton(record.id)}${admin}</article>`;
  }

  // Без <text>: глобальное body svg text { display: none } спрятало бы букву.
  const ICON_INFO =
    '<svg class="ec-term-icon" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="8" fill="currentColor"/><circle cx="8" cy="4.6" r="1.1" fill="#fff"/><rect x="7.1" y="7" width="1.8" height="5.2" rx=".7" fill="#fff"/></svg>';
  const ICON_SPEECH =
    '<svg class="ec-term-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5.5A2.5 2.5 0 0 1 5.5 3h9A2.5 2.5 0 0 1 17 5.5v6a2.5 2.5 0 0 1-2.5 2.5H9l-3.5 3v-3A2.5 2.5 0 0 1 3 11.5z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="6.8" cy="8.5" r="1" fill="currentColor"/><circle cx="10" cy="8.5" r="1" fill="currentColor"/><circle cx="13.2" cy="8.5" r="1" fill="currentColor"/></svg>';

  function termCard(term) {
    const when = term.when
      ? `<p class="ec-term-when">${ICON_INFO}<span><span class="sr-only">${esc(t("Когда:"))} </span>${esc(term.when)}</span></p>`
      : "";
    const example = term.example
      ? `<p class="ec-term-example">${ICON_SPEECH}<span lang="en">“${esc(term.example)}”</span></p>`
      : "";
    const admin = canEdit
      ? `<button type="button" class="ec-term-delete" data-ec-term-delete="${esc(term.key)}" aria-label="${esc(`${t("Удалить")}: ${term.phrase}`)}">×</button>`
      : "";
    return `<article class="ec-term"><h4 class="ec-term-phrase" lang="en">${esc(term.phrase)}</h4><p class="ec-term-meaning">${esc(term.meaning)}</p>${when}${example}${admin}</article>`;
  }

  const ICON_CROSS =
    '<svg class="ec-fix-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 3.5l9 9m0-9l-9 9" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
  const ICON_CHECK =
    '<svg class="ec-fix-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 8.5l3.8 3.8 7.2-8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ICON_BULB =
    '<svg class="ec-fix-bulb" viewBox="0 0 20 24" aria-hidden="true"><path d="M10 2.2a6.8 6.8 0 0 0-4 12.3c.7.5 1.2 1.3 1.2 2.2V17h5.6v-.3c0-.9.5-1.7 1.2-2.2a6.8 6.8 0 0 0-4-12.3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M7.5 20h5M8.5 22.5h3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

  // Английские цитаты внутри русского текста: прямые кавычки сливались с ним.
  // «…» с кириллицей — обычные русские кавычки, их не трогаем.
  function quoted(value) {
    const quote = (_, text) =>
      `<span class="ec-quote" lang="en">“${text}”</span>`;
    return esc(value)
      .replace(/&quot;(.+?)&quot;/g, quote)
      .replace(/«([^»а-яё]*[a-z][^»а-яё]*)»/gi, quote);
  }

  function fixCard(item) {
    return `<article class="ec-fix"><div class="ec-fix-said"><span class="ec-fix-label">${ICON_CROSS}${esc(t("Так сказали"))}</span><p lang="en">“${esc(item.said)}”</p></div><div class="ec-fix-better"><span class="ec-fix-label">${ICON_CHECK}${esc(t("Лучше сказать"))}</span><p lang="en">“${esc(item.better)}”</p></div><div class="ec-fix-why">${ICON_BULB}<p>${quoted(item.why)}</p></div></article>`;
  }

  function goodCard(line) {
    const dash = line.indexOf(" — ");
    const phrase = dash < 0 ? line : line.slice(0, dash);
    const note = dash < 0 ? "" : line.slice(dash + 3);
    const noteHtml = note
      ? `<p class="ec-good-note">${quoted(note[0].toUpperCase() + note.slice(1))}</p>`
      : "";
    return `<article class="ec-good-item">${ICON_CHECK}<div><p class="ec-good-phrase">${quoted(phrase)}</p>${noteHtml}</div></article>`;
  }

  // Пустые списки RTDB не хранит: summary и good у разбора может не быть.
  function mistakesSectionsOf(mistakes) {
    const summary = mistakes.summary || [];
    const good = mistakes.good || [];
    const intro = mistakes.intro
      ? `<p class="ec-mistakes-intro">${esc(mistakes.intro)}</p>`
      : "";
    return [
      ...(summary.length
        ? [
            {
              label: t("Коротко"),
              title: t("Коротко: что ломалось чаще всего"),
              html: `${intro}<dl class="ec-summary">${summary.map((point) => `<div><dt>${esc(point.title)}</dt><dd>${quoted(point.text)}</dd></div>`).join("")}</dl>`,
            },
          ]
        : []),
      ...(mistakes.groups || []).map((group) => ({
        label: group.title,
        title: group.title,
        count: group.items.length,
        html: group.items.map(fixCard).join(""),
      })),
      ...(good.length
        ? [
            {
              label: t("Что звучало хорошо"),
              title: t("Что звучало хорошо"),
              html: `<div class="ec-good">${good.map(goodCard).join("")}</div>`,
            },
          ]
        : []),
    ];
  }

  function mistakesLayoutHtml() {
    const tabs = mistakesSections
      .map(
        (section, index) =>
          `<button type="button" class="ec-mistakes-tab" role="tab" data-ec-section="${index}"><span>${esc(section.label)}</span>${section.count ? `<span class="ec-mistakes-tab-count">${section.count}</span>` : ""}</button>`,
      )
      .join("");
    return `<div class="ec-mistakes-layout"><div class="ec-mistakes-nav" role="tablist" aria-label="${esc(t("Разделы разбора"))}">${tabs}</div><div class="ec-mistakes-panel" role="tabpanel" tabindex="0"></div></div>`;
  }

  // Один раздел на экране: сто с лишним карточек лентой не прочитать.
  function showSection(index, { focusTab = false } = {}) {
    const section = mistakesSections[index];
    if (!section) return;
    const tabs = [...mistakesDialog.querySelectorAll(".ec-mistakes-tab")];
    tabs.forEach((tab, position) => {
      tab.setAttribute("aria-selected", String(position === index));
      tab.tabIndex = position === index ? 0 : -1;
    });
    tabs[index].scrollIntoView({ block: "nearest", inline: "nearest" });
    if (focusTab) tabs[index].focus();
    const next = mistakesSections[index + 1];
    const nextButton = next
      ? `<button type="button" class="ec-mistakes-next" data-ec-section="${index + 1}">${esc(t("Дальше: {title}", { title: next.label }))} →</button>`
      : "";
    const panel = mistakesDialog.querySelector(".ec-mistakes-panel");
    panel.innerHTML = `<h3>${esc(section.title)}</h3>${section.html}${nextButton}`;
    panel.scrollTop = 0;
  }

  function buildMistakesDialog() {
    mistakesDialog = document.createElement("dialog");
    mistakesDialog.className = "ec-mistakes";
    mistakesDialog.setAttribute("aria-labelledby", "ec-mistakes-title");
    mistakesDialog.innerHTML = `
      <header class="ec-mistakes-head">
        <div>
          <h2 id="ec-mistakes-title" tabindex="-1">${esc(t("Ошибки и как сказать правильнее"))}</h2>
          <p class="ec-mistakes-record"></p>
        </div>
        <button type="button" class="ec-mistakes-close" aria-label="${esc(t("Закрыть"))}">×</button>
      </header>
      <div class="ec-mistakes-body"></div>`;
    document.body.appendChild(mistakesDialog);
    mistakesDialog
      .querySelector(".ec-mistakes-close")
      .addEventListener("click", () => mistakesDialog.close());
    mistakesDialog.addEventListener("click", (event) => {
      const section = event.target.closest("[data-ec-section]");
      if (section) showSection(Number(section.dataset.ecSection));
      else if (event.target === mistakesDialog) mistakesDialog.close();
    });
    mistakesDialog.addEventListener("keydown", (event) => {
      const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[
        event.key
      ];
      const tab = event.target.closest?.(".ec-mistakes-tab");
      if (!step || !tab) return;
      event.preventDefault();
      showSection(Number(tab.dataset.ecSection) + step, { focusTab: true });
    });
  }

  async function openMistakes(id) {
    const record = records.find((entry) => entry.id === id);
    if (!record) return;
    if (!mistakesDialog) buildMistakesDialog();
    const body = mistakesDialog.querySelector(".ec-mistakes-body");
    mistakesDialog.querySelector(".ec-mistakes-record").textContent =
      `${record.title} · ${record.mistakesCount} ${window.i18n.plural(record.mistakesCount, { ru: ["ошибка", "ошибки", "ошибок"], en: ["mistake", "mistakes"] })}`;
    body.dataset.record = id;
    mistakesDialog.showModal();
    // Иначе браузер ставит фокус на × и сразу рисует вокруг него рамку.
    mistakesDialog.querySelector("#ec-mistakes-title").focus();
    // Пока шёл запрос, могли закрыть окно и открыть другой созвон.
    const current = () => body.dataset.record === id;
    const render = (mistakes) => {
      if (!current()) return;
      mistakesSections = mistakesSectionsOf(mistakes);
      body.innerHTML = mistakesLayoutHtml();
      showSection(0);
    };
    const message = (text) => {
      if (current())
        body.innerHTML = `<p class="interview-videos-empty">${esc(text)}</p>`;
    };
    if (mistakesCache.has(id)) {
      render(mistakesCache.get(id));
      return;
    }
    message(t("Загружаем…"));
    try {
      const { mistakes } = await window.staffApi.call(
        "getEnglishClubMistakes",
        { id },
      );
      if (!mistakes) throw new Error("empty");
      mistakesCache.set(id, mistakes);
      render(mistakes);
    } catch (error) {
      console.warn("English club: mistakes failed", error);
      message(t("Не удалось загрузить разбор."));
    }
  }

  function renderRecords() {
    document.getElementById("ec-records").innerHTML = records
      .map(recordCard)
      .join("");
    const empty = document.getElementById("ec-records-empty");
    empty.hidden = Boolean(records.length);
    empty.textContent = t("Записей пока нет.");
    renderWatchedCount();
  }

  function renderGlossary() {
    const query = document
      .getElementById("ec-search")
      .value.trim()
      .toLowerCase();
    const shown = glossary.filter(
      (term) =>
        !query ||
        `${term.phrase} ${term.meaning} ${term.example}`
          .toLowerCase()
          .includes(query),
    );
    // Поиск раскрывает секции с совпадениями: иначе результат пришлось бы искать.
    document.getElementById("ec-glossary").innerHTML = CATEGORIES.map(
      ([key, label]) => [
        key,
        label,
        shown.filter((term) => term.category === key),
      ],
    )
      .filter(([, , terms]) => terms.length)
      .map(([key, label, terms]) => {
        const open = Boolean(query) || openGroups.has(key);
        return `<details class="ec-group" data-group="${key}"${open ? " open" : ""}><summary class="ec-group-title">${esc(label)} <span class="ec-group-count">${terms.length}</span></summary><div class="ec-group-cards">${open ? terms.map(termCard).join("") : ""}</div></details>`;
      })
      .join("");
    const empty = document.getElementById("ec-glossary-empty");
    empty.hidden = Boolean(shown.length);
    empty.textContent = glossary.length
      ? t("Ничего не нашли — попробуйте другой запрос.")
      : t("Глоссарий пока пуст.");
    document.getElementById("ec-count").textContent = query
      ? t("Найдено: {count}", { count: shown.length })
      : t("Всего фраз: {count}", { count: glossary.length });
  }

  // toggle не всплывает — ловим на перехвате. Карточки дорисовываем только в
  // раскрытую секцию, а не перерисовываем список: фокус остаётся на заголовке.
  function onGroupToggle(event) {
    const group = event.target;
    if (!group.matches?.(".ec-group")) return;
    if (document.getElementById("ec-search").value.trim()) return;
    const key = group.dataset.group;
    if (group.open) openGroups.add(key);
    else openGroups.delete(key);
    const cards = group.querySelector(".ec-group-cards");
    if (group.open && !cards.children.length)
      cards.innerHTML = glossary
        .filter((term) => term.category === key)
        .map(termCard)
        .join("");
  }

  async function load() {
    try {
      const result = await window.staffApi.call("listEnglishClub");
      records = result.records || [];
      glossary = result.glossary || [];
      canEdit = Boolean(result.canEdit);
      mistakesCache.clear();
      await loadWatched();
      if (canEdit) initEditor();
      renderRecords();
      renderGlossary();
    } catch (error) {
      console.warn("English club: list failed", error);
      document.getElementById("ec-records-empty").textContent = t(
        "Не удалось загрузить страницу клуба.",
      );
    }
  }

  function buildDialog() {
    dialog = document.createElement("dialog");
    dialog.className = "iv-editor";
    dialog.innerHTML = `
      <form method="dialog" class="iv-editor__form">
        <h2 class="iv-editor__title"></h2>
        <label class="iv-editor__field">
          <span>${esc(t("Файл записи (видео или аудио)"))}</span>
          <input type="file" name="media" accept="video/mp4,video/webm,video/quicktime,audio/*" />
          <small class="iv-editor__current" data-current="media"></small>
        </label>
        <label class="iv-editor__field">
          <span>${esc(t("Название"))}</span>
          <input type="text" name="title" maxlength="120" required />
        </label>
        <label class="iv-editor__field">
          <span>${esc(t("Описание"))}</span>
          <textarea name="description" maxlength="500" rows="2"></textarea>
        </label>
        <label class="iv-editor__field">
          <span>${esc(t("Дата встречи"))}</span>
          <input type="date" name="addedAt" required />
        </label>
        <label class="iv-editor__field">
          <span>${esc(t("PDF разбора (необязательно)"))}</span>
          <input type="file" name="pdf" accept="application/pdf" />
          <small class="iv-editor__current" data-current="pdf"></small>
        </label>
        <label class="iv-editor__field">
          <span>${esc(t("Разбор, ESC <дата>.md (необязательно)"))}</span>
          <input type="file" name="review" accept=".md,text/markdown" />
          <small class="iv-editor__current" data-current="review"></small>
        </label>
        <label class="iv-editor__field">
          <span>${esc(t("Фразы для глоссария, ESC <дата>.glossary.json (необязательно)"))}</span>
          <input type="file" name="glossary" accept=".json,application/json" />
        </label>
        <progress class="iv-editor__progress" max="100" value="0" hidden></progress>
        <p class="iv-editor__status" role="status" aria-live="polite"></p>
        <div class="iv-editor__actions">
          <button type="button" class="iv-editor__cancel">${esc(t("Отмена"))}</button>
          <button type="submit" class="iv-editor__save">${esc(t("Сохранить"))}</button>
        </div>
      </form>`;
    document.body.appendChild(dialog);
    const form = dialog.querySelector("form");
    dialog.querySelector(".iv-editor__cancel").addEventListener("click", () => {
      if (activeXhr) activeXhr.abort();
      dialog.close();
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      save(form);
    });
  }

  function setStatus(text, progress) {
    dialog.querySelector(".iv-editor__status").textContent = text;
    const bar = dialog.querySelector(".iv-editor__progress");
    bar.hidden = progress == null;
    if (progress != null) bar.value = progress;
  }

  function open(record) {
    if (!dialog) buildDialog();
    const form = dialog.querySelector("form");
    form.reset();
    editingId = record ? record.id : null;
    dialog.querySelector(".iv-editor__title").textContent = record
      ? t("Изменить запись")
      : t("Новая запись");
    form.media.required = !record;
    form.title.value = record?.title || "";
    form.description.value = record?.description || "";
    form.addedAt.value =
      record?.addedAt ||
      window.platformDayKey?.() ||
      new Date().toISOString().slice(0, 10);
    const fileName = (url) => (url ? decodeURI(url).split("/").pop() : "");
    dialog.querySelector('[data-current="media"]').textContent = record
      ? t("Сейчас: {file}. Новый файл заменит его.", {
          file: fileName(record.videoUrl),
        })
      : "";
    dialog.querySelector('[data-current="pdf"]').textContent = record?.pdfUrl
      ? t("Сейчас: {file}", { file: fileName(record.pdfUrl) })
      : "";
    dialog.querySelector('[data-current="review"]').textContent =
      record?.mistakesCount
        ? t("Сейчас разобрано ошибок: {count}. Новый файл заменит разбор.", {
            count: record.mistakesCount,
          })
        : "";
    setStatus("", null);
    dialog.querySelector(".iv-editor__save").disabled = false;
    dialog.showModal();
  }

  function upload(file, label) {
    return window.r2Upload.upload(file, {
      onProgress: (percent) =>
        setStatus(
          t("Загружаем {label}: {percent}%", { label, percent }),
          percent,
        ),
      onXhr: (xhr) => {
        activeXhr = xhr;
      },
    });
  }

  // Файл читается первым: опечатка в JSON не должна стоить часа загрузки видео.
  async function readGlossary(file) {
    if (!file) return undefined;
    try {
      return JSON.parse(await file.text());
    } catch {
      throw new Error(t("Файл глоссария — не JSON."));
    }
  }

  // Разбирает файл сервер, но уже после загрузки медиа: чужой файл ловим здесь,
  // чтобы он не стоил часа ожидания.
  async function readReview(file) {
    if (!file) return undefined;
    const text = await file.text();
    if (!text.includes("## Ошибки и как сказать правильнее"))
      throw new Error(t("В файле нет раздела с ошибками."));
    return text;
  }

  async function save(form) {
    const current = records.find((record) => record.id === editingId);
    const button = dialog.querySelector(".iv-editor__save");
    button.disabled = true;
    try {
      const terms = await readGlossary(form.glossary.files[0]);
      const reviewMd = await readReview(form.review.files[0]);
      const media = form.media.files[0];
      const pdf = form.pdf.files[0];
      const videoUrl = media
        ? await upload(media, t("запись"))
        : current?.videoUrl;
      const pdfUrl = pdf ? await upload(pdf, "PDF") : current?.pdfUrl || "";
      setStatus(t("Сохраняем…"), null);
      await window.staffApi.call(
        "saveEnglishClubRecord",
        {
          ...(editingId ? { id: editingId } : {}),
          record: {
            title: form.title.value,
            description: form.description.value,
            addedAt: form.addedAt.value,
            videoUrl,
            pdfUrl,
          },
          ...(terms ? { glossary: terms } : {}),
          ...(reviewMd ? { reviewMd } : {}),
        },
        { retry: false },
      );
      dialog.close();
      await load();
    } catch (error) {
      setStatus(error?.message || t("Не удалось сохранить."), null);
      button.disabled = false;
    }
  }

  async function removeRecord(id) {
    const record = records.find((entry) => entry.id === id);
    if (!record) return;
    // confirm блокирует страницу, но это осознанное действие ментора.
    if (
      !window.confirm(
        t("Удалить запись «{title}»? Файл в хранилище останется.", {
          title: record.title,
        }),
      )
    )
      return;
    await callAndReload("deleteEnglishClubRecord", { id });
  }

  async function removeTerm(key) {
    const term = glossary.find((entry) => entry.key === key);
    if (!term) return;
    if (!window.confirm(t("Удалить «{name}» из базы?", { name: term.phrase })))
      return;
    await callAndReload("deleteEnglishClubTerm", { key });
  }

  async function callAndReload(name, data) {
    try {
      await window.staffApi.call(name, data, { retry: false });
      await load();
    } catch (error) {
      window.alert(error?.message || t("Не удалось удалить."));
    }
  }

  let editorReady = false;
  function initEditor() {
    if (editorReady) return;
    editorReady = true;
    const add = document.createElement("button");
    add.type = "button";
    add.className = "page-header-button";
    add.textContent = t("Добавить запись");
    add.addEventListener("click", () => open(null));
    document.querySelector(".page-header-cta")?.prepend(add);
    document
      .getElementById("main-content")
      .addEventListener("click", (event) => {
        const edit = event.target.closest("[data-ec-edit]");
        const del = event.target.closest("[data-ec-delete]");
        const term = event.target.closest("[data-ec-term-delete]");
        if (edit)
          open(records.find((record) => record.id === edit.dataset.ecEdit));
        else if (del) removeRecord(del.dataset.ecDelete);
        else if (term) removeTerm(term.dataset.ecTermDelete);
      });
  }

  document.addEventListener("DOMContentLoaded", () => {
    document
      .getElementById("ec-search")
      .addEventListener("input", renderGlossary);
    document
      .getElementById("ec-glossary")
      .addEventListener("toggle", onGroupToggle, true);
    document.getElementById("ec-records").addEventListener("click", (event) => {
      const open = event.target.closest("[data-ec-mistakes]");
      const toggle = event.target.closest("[data-ec-watched]");
      if (open) openMistakes(open.dataset.ecMistakes);
      else if (toggle) toggleWatched(toggle.dataset.ecWatched);
    });
    // Одновременно играет одна запись. play не всплывает — ловим на перехвате.
    document.addEventListener(
      "play",
      (event) => {
        document.querySelectorAll(".ec-media").forEach((media) => {
          if (media !== event.target) media.pause();
        });
      },
      true,
    );
    load();
  });
})();
