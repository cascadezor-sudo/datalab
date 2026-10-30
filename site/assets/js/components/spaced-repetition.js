(function () {
  "use strict";

  // Перевод интерфейса (ядро — сниппет theme-boot). В тестах под Node его нет:
  // остаётся русский текст с подставленными значениями.
  const t =
    window.t ||
    ((text, params) =>
      text.replace(/\{(\w+)\}/g, (match, key) => params?.[key] ?? match));

  /**
   * Карточки приходят от callable `getTeorminCards` уже отфильтрованными по
   * доступам ученика. Раньше страница качала teormin-cards.json из вебрута —
   * файл отдавал теорминимум по всем разделам платформы кому угодно, минуя
   * любой клиентский фильтр.
   */
  class SpacedRepetitionSystem {
    constructor() {
      this.db = null;
      this.user = null;
      this.cards = [];
      this.reviewState = {};
      this.progressData = {};
      this.hiddenCardsCount = 0;
      this.accessibleCount = 0;
      this.loadedScope = null;
      this.accessKey = null;
      this.accessLoadFailed = false;
      this.accessThrottled = false;
      this.throttleMessage = "";
      this.accessResolved = false;
      this.filteredQueue = [];
      this.currentIndex = 0;
      this.sessionGraded = 0;
      this.saveFailed = false;
      this.mode = "due";
      this.category = "";
      this.topicPage = "";
      this.blockFrom = "";
      this.blockTo = "";
      this.blockManifest = {};
      this.search = "";
      this.todayStart = this.startOfToday();
      // Достижения за повторение подводятся пачкой, а не на каждую карточку:
      // за сессию их бывает несколько десятков, и вызов функции на каждую
      // стоил бы столько же чтений, сколько вся страница.
      this.ungradedSinceSync = 0;
      this.repetitionSyncTimer = null;
      this.repetitionSyncInFlight = false;
    }

    /**
     * Сколько оценок копим, прежде чем позвать сервер.
     *
     * Порог и пауза выбраны так, чтобы обычная сессия (10–40 карточек)
     * укладывалась в один-два вызова, а серверный лимит (12 вызовов в час)
     * оставался недостижимым при честной работе.
     */
    static get REPETITION_SYNC_BATCH() {
      return 20;
    }

    static get REPETITION_SYNC_DELAY_MS() {
      return 15000;
    }

    async initialize(firebaseConfig) {
      if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
      this.db = firebase.database();
      await this.loadBlockManifest();

      firebase.auth().onAuthStateChanged(async (user) => {
        if (!user) {
          window.location.href = "/index.html";
          return;
        }
        this.user = user;
        await this.loadReviewData();
        this.watchMaterialAccess();
      });
    }

    /**
     * Первый снимок доступов запускает загрузку карточек, последующие —
     * только если набор разделов действительно изменился: ментор выдал тариф
     * или authGuard дописал стартовый набор новому ученику.
     */
    watchMaterialAccess() {
      if (this.accessWatchBound) return;
      this.accessWatchBound = true;
      this.db.ref(`users/${this.user.uid}/materialAccess`).on(
        "value",
        (snapshot) => {
          const accessKey = Object.entries(snapshot.val() || {})
            .filter(([, granted]) => granted === true)
            .map(([categoryId]) => categoryId)
            .sort()
            .join(",");
          // Тот же набор разделов — повторный запрос не нужен. Исключение:
          // прошлая загрузка упала, и переподключение к базе — наш шанс
          // повторить её, иначе страница осталась бы пустой до перезагрузки.
          if (accessKey === this.accessKey && !this.accessLoadFailed) return;
          this.accessKey = accessKey;
          // Объём выводим из режима, а не из прошлой загрузки: после неудачи
          // loadedScope сбрасывается, и «Все карточки» молча остались бы с
          // набором по прогрессу — без ошибки и без шанса перезапроситься.
          this.loadCards(this.scopeForMode(this.mode));
        },
        (error) => {
          // Без обработчика ошибка чтения молча не вызвала бы колбэк, и
          // страница навсегда осталась бы на «Загрузка карточек».
          console.error("SpacedRepetition: access watch failed", error);
          this.cards = [];
          this.hiddenCardsCount = 0;
          this.accessLoadFailed = true;
          this.accessResolved = true;
          this.render();
        },
      );
    }

    startOfToday() {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    }

    async loadBlockManifest() {
      try {
        const response = await fetch(
          "/assets/js/config/teormin-card-blocks.json",
          { cache: "no-cache" },
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const manifest = await response.json();
        this.blockManifest = manifest && manifest.pages ? manifest.pages : {};
      } catch (error) {
        // Block filters are an enhancement. Keep card review usable if the
        // optional metadata file is temporarily unavailable.
        console.error("SpacedRepetition: failed to load block metadata", error);
        this.blockManifest = {};
      }
    }

    getCardBlock(card) {
      const fromManifest =
        this.blockManifest[card.targetPage]?.blocks?.[card.questionId];
      const block = fromManifest ?? card.blockNumber ?? card.block;
      const number = Number(block);
      return Number.isInteger(number) && number > 0 ? number : null;
    }

    getTopics() {
      const topics = new Map();
      this.cards.forEach((card) => {
        if (!card.targetPage) return;
        if (
          this.category &&
          this.getCardCategoryId(card) !== this.category
        ) {
          return;
        }
        const metadata = this.blockManifest[card.targetPage];
        const categoryName = card.category?.name || t("Раздел");
        topics.set(card.targetPage, {
          page: card.targetPage,
          title: metadata?.title || card.questionTitle || card.targetPage,
          categoryName,
        });
      });
      return Array.from(topics.values()).sort((a, b) =>
        `${a.categoryName} ${a.title}`.localeCompare(
          `${b.categoryName} ${b.title}`,
          undefined,
          { sensitivity: "base" },
        ),
      );
    }

    getAvailableBlocks() {
      if (!this.topicPage) return [];
      const blocks = new Set();
      this.cards.forEach((card) => {
        if (card.targetPage !== this.topicPage) return;
        if (
          this.category &&
          this.getCardCategoryId(card) !== this.category
        ) {
          return;
        }
        const block = this.getCardBlock(card);
        if (block !== null) blocks.add(block);
      });
      return Array.from(blocks).sort((a, b) => a - b);
    }

    /**
     * @param {"progress"|"all"} scope По умолчанию сервер присылает только
     * карточки пройденных вопросов — их и показывают все режимы, кроме «Все
     * карточки». Полный набор запрашивается один раз, когда он понадобится.
     */
    async loadCards(scope = "progress") {
      try {
        const result = await window.achievementApi.getTeorminCards(scope);
        this.cards = Array.isArray(result.cards) ? result.cards : [];
        this.accessibleCount = Number(result.accessibleCount || 0);
        this.hiddenCardsCount = Math.max(
          Number(result.totalCount || 0) - this.accessibleCount,
          0,
        );
        this.loadedScope = result.scope === "all" ? "all" : "progress";
        this.accessLoadFailed = false;
        this.accessThrottled = false;
        this.throttleMessage = "";
      } catch (error) {
        // Fail closed, как material-access-guard: не смогли получить свой
        // набор — не показываем ничего.
        console.error("SpacedRepetition: failed to load cards", error);
        this.cards = [];
        this.accessibleCount = 0;
        this.hiddenCardsCount = 0;
        this.loadedScope = null;
        this.accessLoadFailed = true;
        // Отказ по персональному лимиту вызовов держится до конца окна, и
        // совет «обнови страницу» здесь вредит: каждое обновление тратит ещё
        // одну попытку и продлевает блокировку. Показываем, что произошло.
        this.accessThrottled =
          error?.status === 429 || error?.code === "RESOURCE_EXHAUSTED";
        this.throttleMessage = this.accessThrottled ? error.message : "";
      }
      this.accessResolved = true;
      this.currentIndex = 0;
      const categoryEl = document.getElementById("sr-category");
      if (categoryEl) categoryEl.dataset.ready = "";
      this.render();
    }

    /** «Все карточки» — единственный режим, которому нужен полный набор. */
    scopeForMode(mode) {
      return mode === "all" ? "all" : "progress";
    }

    async ensureCardsForMode(mode) {
      if (this.scopeForMode(mode) !== "all" || this.loadedScope === "all") {
        return;
      }
      await this.loadCards("all");
    }

    async loadReviewData() {
      try {
        const [reviewsSnap, progressSnap] = await Promise.all([
          this.db.ref(`users/${this.user.uid}/spaced_repetition`).once("value"),
          this.db.ref(`users/${this.user.uid}/progress`).once("value"),
        ]);
        this.reviewState = reviewsSnap.val() || {};
        this.progressData = progressSnap.val() || {};
        // Если в учебном плане ещё нет отмеченных вопросов,
        // очередь 'due' окажется полностью пустой (0 карточек).
        // В этом случае по умолчанию показываем 'all' ("Все карточки"), чтобы сразу были доступны все материалы.
        const hasCompleted = Object.values(this.progressData).some(
          (p) => p && (p.completed === true || p.status === "completed")
        );
        if (!hasCompleted) {
          this.mode = "all";
        }
        // Один пересчёт на открытие страницы — ради тех, у кого повторения
        // уже есть, а достижений за них никогда не было: до этой задачи их не
        // существовало. Дальше он не понадобится, пока ученик не оценит
        // карточку. Пустая ветка вызова не стоит.
        if (Object.keys(this.reviewState).length > 0) {
          this.syncRepetitionProgress({ force: true });
        }
      } catch (error) {
        // Прогресс влияет только на режимы выдачи, не на доступ к материалу.
        console.error("SpacedRepetition: failed to load review data", error);
        this.reviewState = {};
        this.progressData = {};
        this.mode = "all";
      }
    }

    getCardState(card) {
      return this.reviewState[card.id] || null;
    }

    isCardFromCompletedQuestion(card) {
      return this.progressData[card.questionId]?.completed === true;
    }

    isDue(card) {
      const state = this.getCardState(card);
      if (!state || !state.nextReviewAt) return true;
      return state.nextReviewAt <= Date.now();
    }

    isNew(card) {
      return !this.getCardState(card);
    }

    getCardCategoryId(card) {
      return card.category && card.category.id ? card.category.id : "";
    }

    getCardsInSelection() {
      const availableBlocks =
        this.blockFrom || this.blockTo ? this.getAvailableBlocks() : [];
      const blockFrom = this.blockFrom
        ? Number(this.blockFrom)
        : availableBlocks[0];
      const blockTo = this.blockTo
        ? Number(this.blockTo)
        : availableBlocks[availableBlocks.length - 1];
      return this.cards
        .filter((card) => {
          if (this.category && this.getCardCategoryId(card) !== this.category) {
            return false;
          }
          if (this.topicPage && card.targetPage !== this.topicPage) {
            return false;
          }
          if (this.blockFrom || this.blockTo) {
            const cardBlock = this.getCardBlock(card);
            if (cardBlock === null || availableBlocks.length === 0) return false;
            if (cardBlock < blockFrom || cardBlock > blockTo) return false;
          }
          return true;
        });
    }

    getFilteredCards() {
      const query = this.search.trim().toLowerCase();
      return this.getCardsInSelection()
        .filter((card) => {
          if (query) {
            const haystack = [
              card.promptText,
              card.answerText,
              card.questionTitle,
              card.targetPage,
              card.category && card.category.name,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();
            if (!haystack.includes(query)) return false;
          }
          if (this.mode === "completed") {
            return this.isCardFromCompletedQuestion(card);
          }
          if (this.mode === "new") {
            return this.isNew(card) && this.isCardFromCompletedQuestion(card);
          }
          if (this.mode === "all") return true;
          return this.isDue(card) && this.isCardFromCompletedQuestion(card);
        })
        .sort((a, b) => {
          const aState = this.getCardState(a);
          const bState = this.getCardState(b);
          const aDue = aState?.nextReviewAt || 0;
          const bDue = bState?.nextReviewAt || 0;
          if (aDue !== bDue) return aDue - bDue;
          return a.id.localeCompare(b.id);
        });
    }

    getStats() {
      const scopedCards = this.getCardsInSelection();
      const scopedCardIds = new Set(scopedCards.map((card) => card.id));
      const completedCards = scopedCards.filter((card) =>
        this.isCardFromCompletedQuestion(card),
      );
      const dueCards = completedCards.filter((card) => this.isDue(card));
      const newCards = completedCards.filter((card) => this.isNew(card));
      const reviewedCards = completedCards.filter((card) =>
        Boolean(this.getCardState(card)?.lastReviewedAt),
      );
      const closedCards = reviewedCards.filter((card) => !this.isDue(card));
      const matureCards = reviewedCards.filter((card) => {
        const state = this.getCardState(card);
        return (
          !this.isDue(card) &&
          (state?.repetitions || 0) >= 3 &&
          (state?.intervalDays || 0) >= 7
        );
      });
      const reviewedToday = Object.entries(this.reviewState).filter(
        ([cardId, state]) =>
          scopedCardIds.has(cardId) && state.lastReviewedAt >= this.todayStart,
      ).length;
      return {
        due: dueCards.length,
        new: newCards.length,
        reviewedToday,
        total: completedCards.length,
        learning: Math.max(reviewedCards.length - matureCards.length, 0),
        closed: closedCards.length,
        mature: matureCards.length,
        all: scopedCards.length,
      };
    }

    getCategories() {
      const map = new Map();
      this.cards.forEach((card) => {
        if (!card.category || !card.category.id) return;
        map.set(card.category.id, card.category);
      });
      return Array.from(map.values()).sort((a, b) =>
        String(a.name).localeCompare(String(b.name)),
      );
    }

    render({ focus = false, cardId } = {}) {
      // Пока доступы не проверены, любой рендер показал бы весь набор — в том
      // числе разделы, которых у ученика нет.
      if (!this.accessResolved) return;
      this.renderFilters();
      this.filteredQueue = this.getFilteredCards();
      if (cardId !== undefined) {
        this.currentIndex = Math.max(
          this.filteredQueue.findIndex((card) => card.id === cardId),
          0,
        );
      }
      if (this.currentIndex >= this.filteredQueue.length) this.currentIndex = 0;
      this.renderStats();
      this.renderCard({ focus });
    }

    renderFilters() {
      const modeEl = document.getElementById("sr-mode");
      const categoryEl = document.getElementById("sr-category");
      const topicEl = document.getElementById("sr-topic");
      const blockFromEl = document.getElementById("sr-block-from");
      const blockToEl = document.getElementById("sr-block-to");
      const searchEl = document.getElementById("sr-search");
      if (!modeEl || !categoryEl || !topicEl || !searchEl) return;

      const categories = this.getCategories();
      if (!categoryEl.dataset.ready) {
        const options = categories
          .map(
            (category) =>
              `<option value="${this.escapeAttr(category.id)}">${this.escapeHtml(category.name)}</option>`,
          )
          .join("");
        categoryEl.innerHTML = `<option value="">${t("Все разделы")}</option>${options}`;
        categoryEl.dataset.ready = "true";
      }

      if (
        this.category &&
        !categories.some((category) => category.id === this.category)
      ) {
        this.category = "";
        this.topicPage = "";
        this.blockFrom = "";
        this.blockTo = "";
      }

      const topics = this.getTopics();
      const topicOptions = topics
        .map((topic) => {
          const label = this.category
            ? topic.title
            : `${topic.categoryName} — ${topic.title}`;
          return `<option value="${this.escapeAttr(topic.page)}">${this.escapeHtml(label)}</option>`;
        })
        .join("");
      topicEl.innerHTML = `<option value="">${t("Все темы")}</option>${topicOptions}`;
      if (!topics.some((topic) => topic.page === this.topicPage)) {
        this.topicPage = "";
        this.blockFrom = "";
        this.blockTo = "";
      }
      topicEl.value = this.topicPage;

      const availableBlocks = this.getAvailableBlocks();
      const fromOptions = availableBlocks
        .map(
          (block) =>
            `<option value="${block}">${t("Блок {number}", { number: block })}</option>`,
        )
        .join("");
      if (!availableBlocks.includes(Number(this.blockFrom))) this.blockFrom = "";
      if (!availableBlocks.includes(Number(this.blockTo))) this.blockTo = "";
      if (
        this.blockFrom &&
        this.blockTo &&
        Number(this.blockTo) < Number(this.blockFrom)
      ) {
        this.blockTo = this.blockFrom;
      }
      if (blockFromEl && blockToEl) {
        blockFromEl.innerHTML = `<option value="">${t("с начала")}</option>${fromOptions}`;
        blockToEl.innerHTML = `<option value="">${t("до конца")}</option>${fromOptions}`;
        blockFromEl.value = this.blockFrom;
        blockToEl.value = this.blockTo;
        const blocksUnavailable = !this.topicPage || availableBlocks.length === 0;
        blockFromEl.disabled = blocksUnavailable;
        blockToEl.disabled = blocksUnavailable;
        const blockFilter = blockFromEl.closest(".sr-block-filter");
        if (blockFilter) {
          blockFilter.title = !this.topicPage
            ? t("Сначала выбери тему")
            : availableBlocks.length === 0
              ? t("В этой теме блоки не размечены")
              : t("Выбери один блок или диапазон блоков");
        }
      }

      modeEl.value = this.mode;
      categoryEl.value = this.category;
      searchEl.value = this.search;
    }

    renderStats() {
      const stats = this.getStats();
      const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
      };
      setText("sr-stat-due", stats.due);
      setText("sr-stat-new", stats.new);
      setText("sr-stat-reviewed", stats.reviewedToday);
      setText("sr-stat-mature", stats.mature);
    }

    renderCard({ focus = false } = {}) {
      const container = document.getElementById("sr-card-container");
      if (!container) return;

      const card = this.filteredQueue[this.currentIndex];
      if (!card) {
        const done = this.isSessionDone();
        const showAllBtn =
          this.mode !== "all"
            ? `
          <div style="margin-top: 1.25rem;">
            <button type="button" class="sr-btn sr-btn-primary" data-sr-action="show-all" style="cursor: pointer; padding: 0.65rem 1.4rem; font-weight: 500; font-size: 0.95rem;">
              ${t("Показать все карточки")}
            </button>
          </div>
        `
            : "";
        container.innerHTML = `
          <div class="sr-empty${done ? " sr-done" : ""}">
            <strong>${this.escapeHtml(this.emptyStateTitle())}</strong>
            <span>${this.escapeHtml(this.emptyStateHint())}</span>
            ${showAllBtn}
          </div>
        `;
        return;
      }

      const state = this.getCardState(card);
      const categoryName = card.category?.name || t("Раздел");
      const categoryIcon = card.category?.icon || "";
      // Прогресс — по сессии, а не по позиции: в режиме «К повторению»
      // оценённая карточка выпадает из очереди, и «N из M» скакал бы.
      const remaining = this.filteredQueue.length;
      const progress = Math.round(
        (this.sessionGraded / (this.sessionGraded + remaining)) * 100,
      );
      const lastGradeChip = state?.lastGrade
        ? `<span class="sr-chip"><b>${t("Прошлая оценка")}</b> ${this.escapeHtml(
            this.gradeLabels()[state.lastGrade]?.short || state.lastGrade,
          )}</span>`
        : "";
      const previous = state || { repetitions: 0, intervalDays: 0, ease: 2.5 };
      const gradeButton = (grade, key, label) =>
        `<button type="button" class="sr-grade-btn sr-btn-${grade}" data-sr-grade="${grade}"><kbd>${key}</kbd><span>${label}</span><small>${this.escapeHtml(
          this.formatInterval(this.schedule(previous, grade).intervalDays),
        )}</small></button>`;

      container.innerHTML = `
        ${this.saveFailed ? `<div class="sr-save-error" role="alert">${t("Оценка не сохранилась — проверь соединение")}</div>` : ""}
        <article class="sr-card" id="sr-current-card">
          <div class="sr-progress-track" aria-hidden="true">
            <div class="sr-progress-fill" style="width: ${progress}%"></div>
          </div>
          <div class="sr-card-top">
            <div class="sr-card-title-block">
              <div class="sr-card-kicker">${this.escapeHtml(categoryIcon)} ${this.escapeHtml(categoryName)}</div>
              <h2 class="sr-card-title">${this.escapeHtml(card.questionTitle)}</h2>
            </div>
            <a class="sr-open-link" href="${this.escapeAttr(card.href)}" target="_blank" rel="noopener">${t("Теория")}</a>
          </div>
          <div class="sr-card-meta">
            <span class="sr-chip"><b>${t("Осталось")}</b> ${remaining}</span>
            ${lastGradeChip}
          </div>
          <button type="button" class="sr-flip-card" data-sr-action="flip" aria-expanded="false">
            <span class="sr-flip-side sr-flip-front">
              <span class="sr-side-label">${t("Вопрос")}</span>
              <span class="sr-side-content">${card.promptHtml}</span>
              <span class="sr-flip-hint">${t("Нажми, чтобы показать ответ")}</span>
            </span>
            <span class="sr-flip-side sr-flip-back">
              <span class="sr-side-label">${t("Ответ")}</span>
              <span class="sr-side-content">${card.answerHtml}</span>
              <span class="sr-flip-hint">${t("Оцени, насколько легко вспомнил")}</span>
            </span>
          </button>
          <div class="sr-quick-actions">
            <button type="button" class="sr-btn sr-btn-primary sr-show-answer" data-sr-action="show">${t("Показать ответ")}</button>
            <button type="button" class="sr-btn sr-btn-ghost" data-sr-action="skip">${t("Пропустить")}</button>
            <span class="sr-keys">${t("Space — ответ, 1–4 — оценка, S — пропустить")}</span>
          </div>
          <div class="sr-grade-actions">
            ${gradeButton("again", 1, t("Не помню"))}
            ${gradeButton("hard", 2, t("Трудно"))}
            ${gradeButton("good", 3, t("Нормально"))}
            ${gradeButton("easy", 4, t("Легко"))}
          </div>
        </article>
      `;

      this.renderMath(container);
      if (focus) {
        container
          .querySelector(".sr-flip-card")
          ?.focus({ preventScroll: true });
      }
    }

    /** Через сколько карточка вернётся — подпись под кнопкой оценки. */
    formatInterval(intervalDays) {
      if (!intervalDays) return t("10 мин");
      return t("{n} д", { n: intervalDays });
    }

    gradeCurrentCard(grade) {
      const card = this.filteredQueue[this.currentIndex];
      if (!card || !this.user) return;

      const previous = this.getCardState(card) || {
        repetitions: 0,
        intervalDays: 0,
        ease: 2.5,
      };
      const next = this.schedule(previous, grade);
      const state = {
        ...next,
        lastGrade: grade,
        lastReviewedAt: Date.now(),
        updatedAt: Date.now(),
      };

      this.reviewState[card.id] = state;
      // Не ждём ответа сервера: RTDB сперва применяет запись локально, и
      // ученик переходит к следующей карточке без паузы.
      this.db
        .ref(`users/${this.user.uid}/spaced_repetition/${card.id}`)
        .set(state)
        .then(() => {
          // Связь вернулась — плашка уйдёт со следующей карточкой.
          this.saveFailed = false;
        })
        .catch((error) => {
          console.error("SpacedRepetition: failed to save grade", error);
          this.saveFailed = true;
          this.renderCard();
        });
      this.sessionGraded += 1;
      this.scheduleRepetitionSync();
      // Оценённая карточка может выпасть из очереди (режим «К повторению»),
      // поэтому следующую ищем по id, а не сдвигом индекса.
      const nextId = this.filteredQueue[this.currentIndex + 1]?.id;
      this.render({ focus: true, cardId: nextId ?? null });
    }

    /**
     * Попросить сервер пересчитать достижения за повторение.
     *
     * Оценку карточки страница по-прежнему пишет сама — это её собственные
     * данные под своим `auth.uid`. Считает достижения сервер: числу, которое
     * прислал браузер, платформа не верит нигде.
     *
     * Зовём либо когда накопилась пачка оценок, либо когда ученик перестал
     * отвечать. Ошибку глотаем молча: достижения — премия поверх повторения,
     * и упавший запрос не должен мешать заниматься дальше.
     */
    scheduleRepetitionSync() {
      this.ungradedSinceSync += 1;
      clearTimeout(this.repetitionSyncTimer);
      if (
        this.ungradedSinceSync >= SpacedRepetitionSystem.REPETITION_SYNC_BATCH
      ) {
        this.syncRepetitionProgress();
        return;
      }
      this.repetitionSyncTimer = setTimeout(
        () => this.syncRepetitionProgress(),
        SpacedRepetitionSystem.REPETITION_SYNC_DELAY_MS,
      );
    }

    async syncRepetitionProgress({ force = false } = {}) {
      clearTimeout(this.repetitionSyncTimer);
      // Оценки, пришедшие во время запроса, не должны потеряться: счётчик
      // обнуляем до вызова, а параллельный вызов не запускаем — сервер всё
      // равно считает по снимку всей ветки, и второй проход ничего не добавит.
      if ((!this.ungradedSinceSync && !force) || this.repetitionSyncInFlight)
        return;
      this.ungradedSinceSync = 0;
      this.repetitionSyncInFlight = true;
      try {
        const synced = await window.achievementApi?.syncRepetitionProgress?.();
        window.walletUi?.showCredit(synced?.wallet);
      } catch (error) {
        console.warn("SpacedRepetition: achievement sync failed", error);
      } finally {
        this.repetitionSyncInFlight = false;
      }
    }

    schedule(previous, grade) {
      let ease = Number(previous.ease) || 2.5;
      let repetitions = Number(previous.repetitions) || 0;
      let intervalDays = Number(previous.intervalDays) || 0;

      if (grade === "again") {
        repetitions = 0;
        intervalDays = 0;
        ease = Math.max(1.3, ease - 0.2);
      } else {
        repetitions += 1;
        if (grade === "hard") {
          intervalDays = Math.max(1, Math.round(intervalDays * 1.2) || 1);
          ease = Math.max(1.3, ease - 0.15);
        } else if (grade === "easy") {
          intervalDays =
            repetitions === 1
              ? 4
              : Math.max(4, Math.round(intervalDays * ease * 1.3));
          ease = Math.min(3.0, ease + 0.15);
        } else {
          intervalDays =
            repetitions === 1
              ? 1
              : repetitions === 2
                ? 3
                : Math.max(2, Math.round(intervalDays * ease));
        }
      }

      const nextReviewAt =
        grade === "again"
          ? Date.now() + 10 * 60 * 1000
          : this.todayStart + intervalDays * 24 * 60 * 60 * 1000;

      return { repetitions, intervalDays, ease, nextReviewAt };
    }

    gradeLabels() {
      return {
        again: { short: t("Не помню") },
        hard: { short: t("Трудно") },
        good: { short: t("Нормально") },
        easy: { short: t("Легко") },
      };
    }

    skipCurrentCard() {
      if (!this.filteredQueue.length) return;
      this.currentIndex = (this.currentIndex + 1) % this.filteredQueue.length;
      this.renderCard({ focus: true });
    }

    showAnswer() {
      const card = document.getElementById("sr-current-card");
      if (card) {
        card.classList.add("is-answer-visible");
        const flipCard = card.querySelector(".sr-flip-card");
        if (flipCard) flipCard.setAttribute("aria-expanded", "true");
        this.renderMath(card);
      }
    }

    toggleAnswer() {
      const card = document.getElementById("sr-current-card");
      if (!card) return;
      if (card.classList.contains("is-answer-visible")) {
        card.classList.remove("is-answer-visible");
        const flipCard = card.querySelector(".sr-flip-card");
        if (flipCard) flipCard.setAttribute("aria-expanded", "false");
      } else {
        this.showAnswer();
      }
    }

    bindEvents() {
      const modeEl = document.getElementById("sr-mode");
      const categoryEl = document.getElementById("sr-category");
      const topicEl = document.getElementById("sr-topic");
      const blockFromEl = document.getElementById("sr-block-from");
      const blockToEl = document.getElementById("sr-block-to");
      const searchEl = document.getElementById("sr-search");
      const resetEl = document.getElementById("sr-reset");
      const cardContainer = document.getElementById("sr-card-container");

      if (modeEl) {
        modeEl.addEventListener("change", async () => {
          this.mode = modeEl.value;
          this.currentIndex = 0;
          this.sessionGraded = 0;
          // «Все карточки» просит у сервера остальной набор, остальные режимы
          // работают на уже загруженных карточках пройденных вопросов.
          await this.ensureCardsForMode(this.mode);
          this.render();
        });
      }
      if (categoryEl) {
        categoryEl.addEventListener("change", () => {
          this.category = categoryEl.value;
          this.topicPage = "";
          this.blockFrom = "";
          this.blockTo = "";
          this.currentIndex = 0;
          this.sessionGraded = 0;
          this.render();
        });
      }
      if (topicEl) {
        topicEl.addEventListener("change", () => {
          this.topicPage = topicEl.value;
          this.blockFrom = "";
          this.blockTo = "";
          this.currentIndex = 0;
          this.sessionGraded = 0;
          this.render();
        });
      }
      if (blockFromEl) {
        blockFromEl.addEventListener("change", () => {
          this.blockFrom = blockFromEl.value;
          if (
            this.blockTo &&
            Number(this.blockTo) < Number(this.blockFrom)
          ) {
            this.blockTo = this.blockFrom;
          }
          this.currentIndex = 0;
          this.sessionGraded = 0;
          this.render();
        });
      }
      if (blockToEl) {
        blockToEl.addEventListener("change", () => {
          this.blockTo = blockToEl.value;
          if (
            this.blockFrom &&
            Number(this.blockTo) < Number(this.blockFrom)
          ) {
            this.blockFrom = this.blockTo;
          }
          this.currentIndex = 0;
          this.sessionGraded = 0;
          this.render();
        });
      }
      if (searchEl) {
        searchEl.addEventListener("input", () => {
          this.search = searchEl.value;
          this.currentIndex = 0;
          this.sessionGraded = 0;
          this.render();
        });
      }
      if (resetEl) {
        resetEl.addEventListener("click", async () => {
          const hasCompleted = Object.values(this.progressData).some(
            (p) => p && (p.completed === true || p.status === "completed")
          );
          this.mode = hasCompleted ? "due" : "all";
          this.category = "";
          this.topicPage = "";
          this.blockFrom = "";
          this.blockTo = "";
          this.search = "";
          this.currentIndex = 0;
          this.sessionGraded = 0;
          const category = document.getElementById("sr-category");
          if (category) category.dataset.ready = "";
          await this.ensureCardsForMode(this.mode);
          this.render();
        });
      }
      if (cardContainer) {
        cardContainer.addEventListener("click", async (event) => {
          const actionBtn = event.target.closest("[data-sr-action]");
          if (actionBtn) {
            const action = actionBtn.dataset.srAction;
            if (action === "show-all") {
              this.mode = "all";
              const modeEl = document.getElementById("sr-mode");
              if (modeEl) modeEl.value = "all";
              await this.ensureCardsForMode("all");
              this.render();
              return;
            }
            if (action === "show") this.showAnswer();
            if (action === "flip") this.toggleAnswer();
            if (action === "skip") this.skipCurrentCard();
            return;
          }

          const gradeBtn = event.target.closest("[data-sr-grade]");
          if (gradeBtn) this.gradeCurrentCard(gradeBtn.dataset.srGrade);
        });
      }

      document.addEventListener("keydown", (event) => {
        const target = event.target;
        if (
          target &&
          (target.matches("input, select, textarea") ||
            target.closest("[contenteditable='true']"))
        ) {
          return;
        }

        if (event.code === "Space") {
          // На кнопке (в том числе на самой карточке, куда уходит фокус после
          // оценки) Space нажимает её штатно; перехват здесь дал бы второй
          // переворот на keyup.
          if (target?.closest?.("button")) return;
          event.preventDefault();
          this.showAnswer();
          return;
        }

        const gradeByKey = {
          Digit1: "again",
          Digit2: "hard",
          Digit3: "good",
          Digit4: "easy",
        };
        if (gradeByKey[event.code]) {
          const card = document.getElementById("sr-current-card");
          if (card && card.classList.contains("is-answer-visible")) {
            event.preventDefault();
            this.gradeCurrentCard(gradeByKey[event.code]);
          }
          return;
        }

        if (event.key.toLowerCase() === "s") {
          event.preventDefault();
          this.skipCurrentCard();
        }
      });
    }

    renderMath(root) {
      if (typeof renderMathInElement !== "function") return;
      try {
        renderMathInElement(root, {
          delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "$", right: "$", display: false },
            { left: "\\(", right: "\\)", display: false },
            { left: "\\[", right: "\\]", display: true },
          ],
          throwOnError: false,
        });
      } catch (error) {
        console.warn("Spaced repetition: math render failed", error);
      }
    }

    formatDate(timestamp) {
      const date = new Date(timestamp);
      const today = new Date(this.todayStart);
      const tomorrow = new Date(this.todayStart + 24 * 60 * 60 * 1000);
      if (date >= today && date < tomorrow) return t("сегодня");
      return date.toLocaleDateString(window.i18n?.locale || "ru-RU", {
        day: "2-digit",
        month: "2-digit",
      });
    }

    /**
     * Очередь «К повторению» пуста, но пройденные карточки есть: либо ученик
     * только что всё повторил, либо на сегодня ничего не назначено. Это
     * успех, а не пустой режим.
     */
    isSessionDone() {
      if (this.accessLoadFailed || this.filteredQueue.length) return false;
      if (this.search || this.category) return this.sessionGraded > 0;
      return (
        this.sessionGraded > 0 ||
        (this.mode === "due" && this.getStats().total > 0)
      );
    }

    /** Когда вернётся ближайшая карточка из пройденных вопросов. */
    nextReviewAt() {
      return this.cards
        .filter((card) => this.isCardFromCompletedQuestion(card))
        .map((card) => this.getCardState(card)?.nextReviewAt || 0)
        .filter((at) => at > Date.now())
        .reduce((min, at) => (min && min < at ? min : at), 0);
    }

    /** Ученику не открыт ни один раздел с карточками. */
    hasNoAccessibleCards() {
      return this.accessibleCount === 0 && this.hiddenCardsCount > 0;
    }

    emptyStateTitle() {
      if (this.accessThrottled) return t("Слишком много запросов");
      if (this.accessLoadFailed) return t("Не удалось проверить доступы");
      if (this.hasNoAccessibleCards()) return t("Разделы ещё не открыты");
      if (this.isSessionDone()) return t("Всё повторено");
      return t("Нет карточек для этого режима");
    }

    emptyStateHint() {
      if (this.accessThrottled) {
        return (
          this.throttleMessage ||
          t(
            "Карточки запрашивались слишком часто. Подожди немного — обновление страницы сейчас не поможет.",
          )
        );
      }
      if (this.accessLoadFailed) {
        return t(
          "Обнови страницу или обратись к ментору — без проверки доступов карточки не показываем.",
        );
      }
      if (this.hasNoAccessibleCards()) {
        return t(
          "Карточки самопроверки появятся вместе с разделами твоего тарифа. Напиши ментору, если ждёшь доступ.",
        );
      }
      if (this.isSessionDone()) {
        const next = this.nextReviewAt();
        const reviewed = this.getStats().reviewedToday;
        return next
          ? t("Сегодня: {n}. Следующая карточка — {date}.", {
              n: reviewed,
              date: this.formatDate(next),
            })
          : t("Сегодня: {n}.", { n: reviewed });
      }
      return t(
        'Если вы только начали или ещё не отмечали темы в учебном плане, переключитесь на «Все карточки».',
      );
    }

    escapeHtml(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    escapeAttr(value) {
      return this.escapeHtml(value);
    }
  }

  window.SpacedRepetitionSystem = SpacedRepetitionSystem;
})();
