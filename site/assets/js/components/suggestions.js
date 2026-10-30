/**
 * Доска предложений (/suggestions.html). Всё через callable из
 * functions/index.js: listSuggestions, createSuggestion, toggleSuggestionVote,
 * setSuggestionStatus. Узел suggestions браузеру закрыт правилами.
 */
(function () {
  "use strict";

  const CATEGORY_LABELS = {
    site: "Сайт",
    materials: "Материалы",
    mentorship: "Менторство",
    other: "Другое",
  };
  const STATUS_LABELS = {
    open: "Открыто",
    planned: "Запланировано",
    in_progress: "В работе",
    done: "Внедрено",
    declined: "Отклонено",
    duplicate: "Дубль",
  };
  const VOTABLE = new Set(["open", "planned", "in_progress"]);
  const ARROW =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg>';

  const state = { view: "active", category: "", isStaff: false, items: [] };
  const $ = (selector) => document.querySelector(selector);
  const api = (name, data) => window.achievementApi.call(name, data);

  function escapeHtml(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char],
    );
  }

  function formatDate(ms) {
    return new Date(ms).toLocaleDateString(window.i18n?.locale || "ru-RU", {
      day: "numeric",
      month: "long",
    });
  }

  function cardHtml(item) {
    const votable = VOTABLE.has(item.status) && !state.isStaff;
    const staff = state.isStaff
      ? `<div class="sg-staff">
          <select data-status-select aria-label="${escapeHtml(t("Статус"))}">
            ${Object.entries(STATUS_LABELS)
              .map(
                ([key, label]) =>
                  `<option value="${key}"${key === item.status ? " selected" : ""}>${escapeHtml(t(label))}</option>`,
              )
              .join("")}
          </select>
          <input data-note maxlength="500" value="${escapeHtml(item.statusNote)}" placeholder="${escapeHtml(t("Примечание для учеников"))}" aria-label="${escapeHtml(t("Примечание"))}" />
          <button type="button" class="sg-button" data-save-status>${escapeHtml(t("Сохранить"))}</button>
        </div>`
      : "";
    return `<article class="sg-card" data-id="${escapeHtml(item.id)}">
      <button type="button" class="sg-vote" data-vote aria-pressed="${item.myVote}"
        aria-label="${escapeHtml(t("Голосов: {count}", { count: item.votes }))}"${votable ? "" : " disabled"}>
        ${ARROW}<span data-votes>${item.votes}</span>
      </button>
      <div>
        <h3 class="sg-title">${escapeHtml(item.title)}</h3>
        ${item.body ? `<p class="sg-body">${escapeHtml(item.body)}</p>` : ""}
        <div class="sg-meta">
          <span class="sg-chip" data-status="${escapeHtml(item.status)}">${escapeHtml(t(STATUS_LABELS[item.status] || item.status))}</span>
          <span class="sg-chip">${escapeHtml(t(CATEGORY_LABELS[item.category] || item.category))}</span>
          <span>${escapeHtml(item.isMine ? t("Ты") : item.authorName)} · ${escapeHtml(formatDate(item.createdAt))}</span>
        </div>
        ${item.statusNote ? `<p class="sg-note">${escapeHtml(item.statusNote)}</p>` : ""}
        ${staff}
      </div>
    </article>`;
  }

  function render() {
    const list = $("#sg-list");
    list.innerHTML = state.items.length
      ? state.items.map(cardHtml).join("")
      : `<p class="sg-empty">${escapeHtml(t("Здесь пока пусто."))}</p>`;
  }

  async function load() {
    const list = $("#sg-list");
    list.innerHTML = `<p class="sg-empty">${escapeHtml(t("Загружаем предложения…"))}</p>`;
    try {
      const result = await window.achievementApi.call(
        "listSuggestions",
        { view: state.view, category: state.category },
        { retry: true },
      );
      state.items = result.items || [];
      state.isStaff = Boolean(result.isStaff);
      // Персонал не голосует и не пишет идеи от себя — только разбирает.
      $("#sg-form").hidden = state.isStaff;
      render();
    } catch (error) {
      console.warn("Предложения недоступны:", error);
      list.innerHTML = `<div class="sg-empty"><p>${escapeHtml(t("Не удалось загрузить предложения."))}</p>
        <button type="button" class="sg-button" data-retry>${escapeHtml(t("Повторить"))}</button></div>`;
    }
  }

  async function vote(card) {
    const item = state.items.find((row) => row.id === card.dataset.id);
    if (!item) return;
    // Оптимистично: число меняется сразу, при ошибке откатывается.
    const before = { votes: item.votes, myVote: item.myVote };
    item.myVote = !item.myVote;
    item.votes += item.myVote ? 1 : -1;
    render();
    try {
      Object.assign(item, await api("toggleSuggestionVote", { id: item.id }));
    } catch (error) {
      Object.assign(item, before);
      console.warn("Голос не засчитан:", error);
    }
    render();
  }

  async function saveStatus(card, button) {
    button.disabled = true;
    try {
      await api("setSuggestionStatus", {
        id: card.dataset.id,
        status: card.querySelector("[data-status-select]").value,
        note: card.querySelector("[data-note]").value,
      });
      await load();
    } catch (error) {
      button.disabled = false;
      console.warn("Статус не сохранён:", error);
    }
  }

  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const status = $("#sg-form-status");
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    status.textContent = "";
    try {
      await api("createSuggestion", {
        title: $("#sg-title").value,
        body: $("#sg-body").value,
        category: $("#sg-category").value,
      });
      form.reset();
      status.textContent = t("Опубликовано. Спасибо!");
      state.view = "active";
      syncPressed("[data-view]", "view");
      await load();
    } catch (error) {
      status.textContent = error.message || t("Не удалось отправить.");
    } finally {
      button.disabled = false;
    }
  }

  function syncPressed(selector, key) {
    for (const button of document.querySelectorAll(selector)) {
      const value = button.dataset[key] ?? "";
      button.setAttribute("aria-pressed", String(value === state[key]));
    }
  }

  function bind() {
    $("#sg-form").addEventListener("submit", submit);
    for (const button of document.querySelectorAll("[data-view]")) {
      button.addEventListener("click", () => {
        state.view = button.dataset.view;
        syncPressed("[data-view]", "view");
        load();
      });
    }
    for (const button of document.querySelectorAll("[data-category]")) {
      button.addEventListener("click", () => {
        state.category = button.dataset.category;
        syncPressed("[data-category]", "category");
        load();
      });
    }
    $("#sg-list").addEventListener("click", (event) => {
      const card = event.target.closest(".sg-card");
      if (event.target.closest("[data-retry]")) load();
      else if (card && event.target.closest("[data-vote]")) vote(card);
      else if (card && event.target.closest("[data-save-status]"))
        saveStatus(card, event.target.closest("[data-save-status]"));
    });
  }

  async function init() {
    if (!window.firebase || !window.configLoader) return;
    const firebaseConfig = await window.configLoader.loadFirebaseConfig();
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    bind();
    let started = false;
    firebase.auth().onAuthStateChanged((user) => {
      if (!user || started) return;
      started = true;
      load();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
