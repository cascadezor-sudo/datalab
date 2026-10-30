/**
 * Тесты блоков: после каждого блока страницы материалов («Блок N» — <h3>,
 * прямой ребёнок ol#questions) стоит необязательный тест — самопроверка,
 * блоки ничем не закрываются. Тесты — обычные квизы реестра с полями `page`
 * (путь без ведущего слэша и без en/) и `block` (номер из заголовка).
 * Карточку теста рисует quiz.js, этот файл только вставляет её после блока.
 */
(function () {
  "use strict";

  function parseBlockNumber(text) {
    const match = String(text || "").match(/(?:Блок|Block)\s*(\d+)/i);
    return match ? Number(match[1]) : null;
  }

  function pagePath(pathname) {
    return String(pathname || "")
      .replace(/^\/(en\/)?/, "")
      .replace(/\/$/, "/index.html");
  }

  function collectBlocks(list) {
    const blocks = [];
    for (const child of list.children) {
      if (child.tagName === "H3") {
        const number = parseBlockNumber(child.textContent);
        if (number !== null) blocks.push({ number, heading: child, items: [] });
      } else if (blocks.length && child.classList.contains("question")) {
        blocks[blocks.length - 1].items.push(child);
      }
    }
    return blocks;
  }

  async function loadRegistry() {
    const response = await fetch("/assets/data/quizzes/registry.json");
    return response.ok ? response.json() : {};
  }

  function insertQuizEntry(block, entry) {
    const card = document.createElement("div");
    card.className = "quiz-entry block-test-entry";
    card.id = `block-test-${block.number}`;
    card.dataset.quizId = entry.id;
    const last = block.items[block.items.length - 1] || block.heading;
    last.after(card);
    return card;
  }

  async function init() {
    const list = document.querySelector("ol#questions");
    if (!list) return;
    const page = pagePath(window.location.pathname);
    // Своей карточки на странице может не быть — тогда quiz.js не поднялся сам.
    // Создаём систему сразу, до сетевых запросов: init-head.js ждёт
    // window.quizSystem всего 5 секунд, а карточки она дорисует сама
    // (MutationObserver на ol#questions).
    if (!window.quizSystem && typeof QuizSystem === "function") {
      window.quizSystem = new QuizSystem(); // eslint-disable-line no-undef
    }
    const registry = await loadRegistry().catch(() => ({}));
    const entries = new Map(
      Object.values(registry)
        .filter((entry) => entry.page === page && entry.block)
        .map((entry) => [Number(entry.block), entry]),
    );
    if (!entries.size) return;

    const cards = collectBlocks(list)
      .filter((block) => entries.has(block.number))
      .map((block) => insertQuizEntry(block, entries.get(block.number)));

    if (window.quizSystem?.isInitialized) {
      cards.forEach((card) => window.quizSystem.renderQuizEntry(card));
    }
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { parseBlockNumber, pagePath };
    return;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
