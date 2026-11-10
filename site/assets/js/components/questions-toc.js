// Lightweight Questions TOC sidebar for question pages
(function () {
  if (typeof document === "undefined") return;

  // Перевод интерфейса (ядро — сниппет theme-boot). В тестах под Node его нет:
  // остаётся русский текст с подставленными значениями.
  const t =
    window.t ||
    ((text, params) =>
      text.replace(/\{(\w+)\}/g, (match, key) => params?.[key] ?? match));

  function injectStyles() {
    if (document.getElementById("questions-toc-styles")) return;
    const style = document.createElement("style");
    style.id = "questions-toc-styles";
    style.textContent = `
      .questions-toc {
        position: fixed;
        top: 80px;
        right: 20px;
        width: 350px;
        max-height: calc(100vh - 120px);
        overflow: auto;
        background: var(--card-bg, #ffffff);
        border: 1px solid var(--border, #e5e7eb);
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.08);
        z-index: 1000;
        transition: width .25s ease;
      }

      .questions-toc__header {
        position: sticky;
        top: 0;
        background: var(--card-bg, #ffffff);
        padding: 12px 14px 8px 14px;
        border-bottom: 1px solid var(--border, #e5e7eb);
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 700;
        z-index: 10;
      }

      .questions-toc__title {
        flex: 1;
      }

      .questions-toc__toggle {
        appearance: none;
        border: 1px solid var(--border, #e5e7eb);
        background: var(--bg-primary, #ffffff);
        color: var(--text-color, #111827);
        border-radius: 8px;
        padding: 6px 10px;
        cursor: pointer;
        transition: background .2s ease;
      }

      .questions-toc__toggle:hover {
        background: var(--bg-tertiary, #f3f4f6);
      }

      /* Progress bar in TOC */
      .questions-toc__progress {
        padding: 12px 14px 12px 14px;
        border-bottom: 1px solid var(--border, #e5e7eb);
      }

      .questions-toc__progress-bar {
        height: 6px;
        background: rgba(226, 232, 240, 0.6);
        border-radius: 999px;
        overflow: hidden;
        margin-bottom: 8px;
      }

      .questions-toc__progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #10b981, #059669);
        border-radius: 999px;
        transition: width 0.3s ease;
      }

      .questions-toc__progress-text {
        font-size: 12px;
        color: var(--text-secondary, #64748b);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .questions-toc__progress-percent {
        font-weight: 600;
        color: var(--text-color, #111827);
      }

      .questions-toc__progress.is-complete .questions-toc__progress-text,
      .questions-toc__progress.is-complete .questions-toc__progress-percent {
        color: var(--success, #52745f);
        font-weight: 700;
      }

      /* Dark theme progress */
      body.dark .questions-toc__progress-bar {
        background: rgba(71, 85, 105, 0.4);
      }

      body.dark .questions-toc__progress-fill {
        background: linear-gradient(90deg, #34d399, #10b981);
      }

      .questions-toc__search {
        margin: 10px 12px 0 12px;
      }

      .questions-toc__search input {
        width: 100%;
        padding: 8px 10px;
        border: 1px solid var(--border, #e5e7eb);
        border-radius: 8px;
        background: var(--bg-primary, #ffffff);
        color: var(--text-color, #111827);
      }

      .questions-toc__list {
        list-style: none;
        margin: 8px 0 12px 0;
        padding: 0 8px 8px 8px;
      }

      .questions-toc__item {
        margin: 0;
      }

      .questions-toc__link {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 8px;
        border-radius: 8px;
        text-decoration: none;
        color: var(--text-color, #111827);
        transition: background .2s ease;
        min-width: 0;
      }

      .questions-toc__link .questions-toc__title {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .questions-toc__link--h2 {
        font-weight: 600;
        padding-left: 8px;
        margin-top: 8px;
        border-top: 1px solid var(--border, #e5e7eb);
        padding-top: 12px;
      }

      .questions-toc__link--h3 {
        padding-left: 32px;
        font-size: 0.9em;
        color: var(--text-secondary, #64748b);
      }

      .questions-toc__item--h2 {
        margin-top: 4px;
      }

      .questions-toc__item--h3 {
        margin-top: 2px;
      }

      .questions-toc__link:hover {
        background: linear-gradient(135deg, rgba(59,130,246,0.10) 0%, rgba(236,72,153,0.08) 100%);
      }

      .questions-toc__link.active {
        background: rgba(139, 92, 246, 0.16);
        color: #4c1d95;
        font-weight: 600;
      }

      .questions-toc__index {
        display: inline-block;
        min-width: 24px;
        text-align: right;
        color: #64748b;
        font-variant-numeric: tabular-nums;
        transition: color .2s ease;
      }

      /* Completed indicator */
      .questions-toc__done {
        display: none;
        flex-shrink: 0;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #10b981;
        color: #fff;
        font-size: 9px;
        font-weight: 800;
        align-items: center;
        justify-content: center;
        line-height: 1;
      }

      .questions-toc__link.completed .questions-toc__index {
        color: #10b981;
        font-weight: 700;
      }

      .questions-toc__link.completed .questions-toc__done {
        display: flex;
      }

      body.dark .questions-toc__link.completed .questions-toc__index {
        color: #34d399;
      }

      body.dark .questions-toc__done {
        background: #059669;
      }

      /* Inline code formatting inside titles */
      .questions-toc__title code {
        font-family: var(--code-font, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace);
        font-size: 12px;
        padding: 1px 6px;
        border-radius: 6px;
        background: #f3f4f6;
        color: #111827;
        border: 1px solid #e5e7eb;
      }

      /* Плавающая кнопка-триггер мобильного TOC (нижний лист). Левый нижний
         угол — не пересекается с кнопками "наверх"/чата в правом углу. */
      .questions-toc-fab {
        display: none;
        position: fixed;
        bottom: 16px;
        left: 16px;
        z-index: 9990;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        border: none;
        background: linear-gradient(135deg, #7c3aed, #4f46e5);
        color: #fff;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
        cursor: pointer;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        line-height: 1;
      }

      .questions-toc-backdrop {
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.4);
        z-index: 9994;
      }

      .questions-toc-backdrop.visible {
        display: block;
      }

      @media (max-width: 1200px) {
        .questions-toc-fab {
          display: flex;
        }

        /* Вместо полного скрытия — нижний лист, открываемый кнопкой-триггером. */
        .questions-toc {
          top: auto;
          left: 0;
          right: 0;
          bottom: 0;
          width: 100%;
          max-height: 80vh;
          border-radius: 16px 16px 0 0;
          transform: translateY(100%);
          transition: transform 0.25s ease;
          z-index: 9995;
        }

        .questions-toc.mobile-open {
          transform: translateY(0);
        }

        /* Десктопное "свёрнуть в полоску" не имеет смысла как нижний лист. */
        .questions-toc.collapsed {
          width: 100%;
        }

        .questions-toc.collapsed .questions-toc__title,
        .questions-toc.collapsed .questions-toc__progress,
        .questions-toc.collapsed .questions-toc__search,
        .questions-toc.collapsed .questions-toc__list {
          display: revert;
        }

        /* Роль кнопки ⟷ здесь берёт на себя FAB открытия/закрытия. */
        .questions-toc__toggle {
          display: none;
        }
      }

      @media (max-width: 480px) {
        .questions-toc-fab {
          bottom: 12px;
          left: 12px;
          width: 44px;
          height: 44px;
          font-size: 18px;
        }
      }

      /* Пока открыт мобильный нижний лист — прячем соседние плавающие кнопки
         и открытое окно чата (у них более высокий z-index и они перекрывали
         бы нижнюю часть листа). */
      body.questions-toc-open #ml-chat-button,
      body.questions-toc-open #ml-chat-window,
      body.questions-toc-open #scrollToTopBtn,
      body.questions-toc-open #goBackBtn {
        display: none !important;
      }

      /* Dark theme overrides */
      body.dark .questions-toc {
        background: var(--bg-secondary, #0f172a);
        border-color: rgba(148, 163, 184, 0.15);
        color: var(--text-color, #e5e7eb);
      }

      body.dark .questions-toc__header {
        background: var(--bg-secondary, #0f172a);
        border-bottom-color: rgba(148, 163, 184, 0.15);
      }

      body.dark .questions-toc__search input {
        background: var(--bg-primary, #0b1220);
        color: var(--text-color, #e5e7eb);
        border-color: rgba(148, 163, 184, 0.25);
      }

      body.dark .questions-toc__toggle {
        background: var(--bg-primary, #0b1220);
        color: var(--text-color, #e5e7eb);
        border-color: rgba(148, 163, 184, 0.25);
      }

      body.dark .questions-toc__toggle:hover {
        background: rgba(148, 163, 184, 0.12);
      }

      body.dark .questions-toc__link {
        color: var(--text-color, #e5e7eb);
      }

      body.dark .questions-toc__link:hover {
        background: rgba(148, 163, 184, 0.12);
      }

      body.dark .questions-toc__link.active {
        background: rgba(139, 92, 246, 0.22);
        color: #c4b5fd;
      }

      body.dark .questions-toc__link--h2 {
        border-top-color: rgba(148, 163, 184, 0.15);
      }

      body.dark .questions-toc__link--h3 {
        color: rgba(148, 163, 184, 0.8);
      }

      /* Dark theme inline code */
      body.dark .questions-toc__title code {
        background: rgba(148, 163, 184, 0.12);
        color: #e5e7eb;
        border-color: rgba(148, 163, 184, 0.25);
      }

      /* Dark theme scrollbar */
      body.dark .questions-toc {
        scrollbar-width: thin;
        scrollbar-color: var(--primary-color, #6a5acd) rgba(148, 163, 184, 0.12);
      }

      body.dark .questions-toc::-webkit-scrollbar {
        width: 10px;
        height: 10px;
      }

      body.dark .questions-toc::-webkit-scrollbar-track {
        background: rgba(148, 163, 184, 0.12);
        border-radius: 10px;
      }

      body.dark .questions-toc::-webkit-scrollbar-thumb {
        background: var(--primary-color, #6a5acd);
        border-radius: 10px;
        border: 2px solid rgba(148, 163, 184, 0.12);
      }

      body.dark .questions-toc::-webkit-scrollbar-thumb:hover {
        background: rgba(106, 90, 205, 0.8);
      }

      /* Collapsed state */
      .questions-toc.collapsed {
        width: 64px;
      }

      .questions-toc.collapsed .questions-toc__title,
      .questions-toc.collapsed .questions-toc__progress,
      .questions-toc.collapsed .questions-toc__search,
      .questions-toc.collapsed .questions-toc__list {
        display: none;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * TOC title without external-source chrome (↗ / «Источник») — те же элементы на странице
   * остаются в основном заголовке вопроса.
   */
  function tocTitleFromQuestionName(nameEl) {
    const sourceLink = nameEl.querySelector("a.question-title-link");
    if (sourceLink) {
      const clone = sourceLink.cloneNode(true);
      clone
        .querySelectorAll(".question-title-link__indicator")
        .forEach((node) => node.remove());
      return {
        titleHtml: clone.innerHTML.trim(),
        titleText: clone.textContent.trim(),
      };
    }
    const link = nameEl.querySelector("a");
    return {
      titleHtml: (link && link.innerHTML
        ? link.innerHTML
        : nameEl.innerHTML
      ).trim(),
      titleText: (link && link.textContent
        ? link.textContent
        : nameEl.textContent
      ).trim(),
    };
  }

  function ensureId(element, prefix) {
    if (!element.id) {
      const text = element.textContent
        .trim()
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-")
        .substring(0, 50);
      element.id = `${prefix}-${text}-${Date.now()}`;
    }
    return element.id;
  }

  function getQuestionItems() {
    const questionsContainer = document.querySelector("ol#questions");
    if (!questionsContainer) return [];

    const allItems = [];
    let questionIndex = 0;

    // Get all direct children of #questions (questions and h2/h3 headings)
    const children = Array.from(questionsContainer.children);

    children.forEach((child) => {
      // Handle h2 headings (between questions, outside of <li class="question">)
      if (child.tagName === "H2") {
        const id = ensureId(child, "section");
        const titleHtml = child.innerHTML.trim();
        const titleText = child.textContent.trim();
        allItems.push({
          type: "h2",
          id,
          titleHtml,
          titleText,
          element: child,
        });
      }
      // Handle h3 headings (between questions, outside of <li class="question">)
      else if (child.tagName === "H3") {
        const id = ensureId(child, "subsection");
        const titleHtml = child.innerHTML.trim();
        const titleText = child.textContent.trim();
        allItems.push({
          type: "h3",
          id,
          titleHtml,
          titleText,
          element: child,
        });
      }
      // Handle questions
      else if (child.classList.contains("question")) {
        const nameEl = child.querySelector(".name");
        if (nameEl) {
          const id = nameEl.id || nameEl.querySelector("[id]")?.id;
          if (id) {
            questionIndex++;
            const { titleHtml, titleText } = tocTitleFromQuestionName(nameEl);
            allItems.push({
              type: "question",
              id,
              titleHtml: titleHtml || t("Вопрос {n}", { n: questionIndex }),
              titleText: titleText || t("Вопрос {n}", { n: questionIndex }),
              index: questionIndex,
              element: nameEl,
            });
          }
        }
      }
    });

    return allItems;
  }

  function createToc(items) {
    const toc = document.createElement("nav");
    toc.className = "questions-toc";

    const header = document.createElement("div");
    header.className = "questions-toc__header";
    header.innerHTML = `<span class="questions-toc__title">${t("Навигация по вопросам")}</span>`;

    const toggleBtn = document.createElement("button");
    toggleBtn.className = "questions-toc__toggle";
    toggleBtn.type = "button";
    toggleBtn.title = t("Свернуть/развернуть");
    toggleBtn.setAttribute(
      "aria-label",
      t("Свернуть/развернуть панель навигации"),
    );
    toggleBtn.textContent = "⟷";
    header.appendChild(toggleBtn);

    // Create progress bar section
    const progressSection = document.createElement("div");
    progressSection.className = "questions-toc__progress";
    progressSection.id = "toc-progress-section";
    progressSection.innerHTML = `
      <div class="questions-toc__progress-bar">
        <div class="questions-toc__progress-fill" id="toc-progress-fill" style="width: 0%"></div>
      </div>
      <div class="questions-toc__progress-text">
        <span id="toc-progress-text">${t("Прочитано: {done} из {total}", {
          done: 0,
          total: items.filter((i) => i.type === "question").length,
        })}</span>
        <span class="questions-toc__progress-percent" id="toc-progress-percent">0%</span>
      </div>
    `;

    const searchWrap = document.createElement("div");
    searchWrap.className = "questions-toc__search";
    const searchInput = document.createElement("input");
    searchInput.type = "search";
    searchInput.placeholder = t("Фильтр вопросов...");
    searchWrap.appendChild(searchInput);

    const list = document.createElement("ul");
    list.className = "questions-toc__list";

    function renderList(filter = "") {
      list.innerHTML = "";
      const norm = filter.trim().toLowerCase();
      items.forEach((item) => {
        if (
          norm &&
          !item.titleText.toLowerCase().includes(norm) &&
          !(item.index && String(item.index).includes(norm))
        )
          return;

        const li = document.createElement("li");
        li.className = `questions-toc__item${item.type === "h2" ? " questions-toc__item--h2" : ""}${item.type === "h3" ? " questions-toc__item--h3" : ""}`;

        const a = document.createElement("a");
        let linkClass = "questions-toc__link";
        if (item.type === "h2") linkClass += " questions-toc__link--h2";
        if (item.type === "h3") linkClass += " questions-toc__link--h3";
        a.className = linkClass;
        a.href = `#${item.id}`;

        let content = "";
        if (item.type === "question" && item.index) {
          content = `<span class="questions-toc__index">${item.index}.</span><span class="questions-toc__title">${item.titleHtml}</span><span class="questions-toc__done" aria-hidden="true">✓</span>`;
        } else {
          content = `<span class="questions-toc__title">${item.titleHtml}</span>`;
        }
        a.innerHTML = content;

        a.addEventListener("click", (e) => {
          e.preventDefault();
          const target = document.getElementById(item.id);
          if (!target) return;

          const doScroll = () => {
            const top =
              target.getBoundingClientRect().top + window.pageYOffset - 180;
            window.scrollTo({ top, behavior: "auto" });
            setTimeout(() => scrollToActiveLink(a), 50);
            const questionElement = target.closest(".question");
            if (questionElement) {
              setTimeout(() => {
                questionElement.classList.add("question-highlight");
                setTimeout(
                  () => questionElement.classList.remove("question-highlight"),
                  2000,
                );
              }, 50);
            }
          };

          // Expand question if it's collapsed (lazy-questions hides content)
          const questionEl = target.closest(".question");
          const contentEl = questionEl && questionEl.querySelector(".content");
          if (contentEl && contentEl.style.display === "none") {
            if (window.expandQuestion) {
              window.expandQuestion(item.id);
            } else {
              const nameEl = questionEl.querySelector(".name");
              if (nameEl) nameEl.click();
            }
            setTimeout(doScroll, 230);
          } else {
            doScroll();
          }

          history.replaceState(null, "", `#${item.id}`);

          // Закрывает мобильный нижний лист (если открыт); no-op на десктопе.
          toc.dispatchEvent(new CustomEvent("toc:navigate"));
        });

        li.appendChild(a);
        list.appendChild(li);
      });
    }

    // ── Completed-state sync ─────────────────────────────────────────────────

    function refreshCompletedState() {
      if (!window.questionProgressTracker) return;
      list.querySelectorAll('.questions-toc__link[href^="#"]').forEach((a) => {
        const id = a.getAttribute("href").slice(1);
        if (window.questionProgressTracker.isQuestionCompleted(id)) {
          a.classList.add("completed");
        } else {
          a.classList.remove("completed");
        }
      });

      const questionItems = items.filter((item) => item.type === "question");
      const total = questionItems.length;
      const done = questionItems.reduce(
        (count, item) =>
          count + Number(window.questionProgressTracker.isQuestionCompleted(item.id)),
        0,
      );
      const percent = total ? Math.round((done / total) * 100) : 0;
      const isComplete = total > 0 && done === total;
      const fill = progressSection.querySelector(".questions-toc__progress-fill");
      const text = progressSection.querySelector("#toc-progress-text");
      const percentage = progressSection.querySelector("#toc-progress-percent");

      if (fill) fill.style.width = `${percent}%`;
      if (text) {
        text.textContent = isComplete
          ? t("Тема пройдена")
          : t("Прочитано: {done} из {total}", { done, total });
      }
      if (percentage) percentage.textContent = `${percent}%`;
      progressSection.classList.toggle("is-complete", isComplete);
      progressSection.setAttribute(
        "aria-label",
        t("Прочитано: {done} из {total}", { done, total }),
      );
    }

    // Retry until the progress tracker is available, then hook into updateUI
    function hookProgressTracker() {
      if (
        window.questionProgressTracker &&
        typeof window.questionProgressTracker.updateUI === "function"
      ) {
        const orig = window.questionProgressTracker.updateUI.bind(
          window.questionProgressTracker,
        );
        window.questionProgressTracker.updateUI = function () {
          orig();
          refreshCompletedState();
        };
        // Call immediately (may be empty if Firebase hasn't loaded yet)
        refreshCompletedState();
        // Safety-net retries for async Firebase data arrival
        setTimeout(refreshCompletedState, 600);
        setTimeout(refreshCompletedState, 1800);
      } else {
        setTimeout(hookProgressTracker, 350);
      }
    }
    setTimeout(hookProgressTracker, 200);

    // Also refresh after lazy questions are ready (data may arrive around the same time)
    document.addEventListener("lazyQuestionsReady", function () {
      setTimeout(refreshCompletedState, 400);
    });

    // ─────────────────────────────────────────────────────────────────────────

    searchInput.addEventListener("input", () => {
      renderList(searchInput.value);
      refreshCompletedState();
    });
    renderList("");

    toc.appendChild(header);
    toc.appendChild(progressSection);
    toc.appendChild(searchWrap);
    toc.appendChild(list);

    // Persistence of collapsed state
    const applyCollapsed = (collapsed) => {
      if (collapsed) toc.classList.add("collapsed");
      else toc.classList.remove("collapsed");
      try {
        localStorage.setItem("questionsTocCollapsed", collapsed ? "1" : "0");
      } catch (_) {}
    };

    let saved = null;
    try {
      saved = localStorage.getItem("questionsTocCollapsed");
    } catch (_) {
      saved = null;
    }
    if (saved === "1") toc.classList.add("collapsed");

    toggleBtn.addEventListener("click", () => {
      const willCollapse = !toc.classList.contains("collapsed");
      applyCollapsed(willCollapse);
    });

    toggleBtn.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleBtn.click();
      }
    });

    return toc;
  }

  function scrollToActiveLink(activeLink) {
    if (!activeLink) return;

    const toc = activeLink.closest(".questions-toc");
    if (!toc) return;

    // Check if link is visible in viewport of the navigation panel
    const linkRect = activeLink.getBoundingClientRect();
    const tocRect = toc.getBoundingClientRect();

    // If link is outside visible area (with some margin), scroll to it
    const headerHeight = 60; // Approximate header height
    const bottomMargin = 20;
    if (
      linkRect.top < tocRect.top + headerHeight ||
      linkRect.bottom > tocRect.bottom - bottomMargin
    ) {
      activeLink.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
    }
  }

  function setupScrollSpy(items, container) {
    const links = Array.from(
      container.querySelectorAll(".questions-toc__link"),
    );

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = entry.target.id;
          const link = links.find((a) => a.getAttribute("href") === `#${id}`);
          if (!link) return;
          if (entry.isIntersecting) {
            links.forEach((l) => l.classList.remove("active"));
            link.classList.add("active");

            // Scroll navigation panel to show active link
            setTimeout(() => {
              scrollToActiveLink(link);
            }, 100);
          }
        });
      },
      { root: null, rootMargin: "0px 0px -70% 0px", threshold: 0.0 },
    );

    items.forEach((item) => {
      const el = item.element || document.getElementById(item.id);
      if (el) observer.observe(el);
    });
  }

  /**
   * На узких экранах (≤1200px) .questions-toc становится нижним листом,
   * скрытым по умолчанию. Добавляет плавающую кнопку-триггер и бэкдроп для
   * открытия/закрытия, не трогая логику данных/поиска/прогресса в createToc().
   */
  function setupMobileToc(toc) {
    const fab = document.createElement("button");
    fab.type = "button";
    fab.className = "questions-toc-fab";
    fab.setAttribute("aria-label", t("Открыть навигацию по вопросам"));
    fab.textContent = "☰";
    document.body.appendChild(fab);

    const backdrop = document.createElement("div");
    backdrop.className = "questions-toc-backdrop";
    document.body.appendChild(backdrop);

    const openMobileToc = () => {
      toc.classList.add("mobile-open");
      backdrop.classList.add("visible");
      document.body.classList.add("questions-toc-open");
      document.body.style.overflow = "hidden";
    };
    const closeMobileToc = () => {
      toc.classList.remove("mobile-open");
      backdrop.classList.remove("visible");
      document.body.classList.remove("questions-toc-open");
      document.body.style.overflow = "";
    };

    fab.addEventListener("click", () => {
      if (toc.classList.contains("mobile-open")) closeMobileToc();
      else openMobileToc();
    });
    backdrop.addEventListener("click", closeMobileToc);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && toc.classList.contains("mobile-open")) {
        closeMobileToc();
      }
    });
    // Закрываем нижний лист при переходе по вопросу (событие из createToc()).
    toc.addEventListener("toc:navigate", closeMobileToc);
    // Закрываем лист, если окно расширили выше 1200px, пока он был открыт —
    // иначе .questions-toc вернётся к десктопному сайдбару под ещё видимым
    // бэкдропом, а FAB и скрытые плавающие кнопки не восстановятся.
    window.addEventListener("resize", () => {
      if (window.innerWidth > 1200 && toc.classList.contains("mobile-open")) {
        closeMobileToc();
      }
    });
  }

  function init() {
    const items = getQuestionItems();
    if (items.length === 0) return;
    injectStyles();
    const toc = createToc(items);
    document.body.appendChild(toc);
    setupScrollSpy(items, toc);
    setupMobileToc(toc);

    // Render KaTeX in TOC titles
    renderMathInToc(toc);

    // Notify other components that TOC is ready
    setTimeout(() => {
      if (window.questionProgressTracker) {
        window.questionProgressTracker.updateOverallProgress();
      }
    }, 100);
  }

  function renderMathInToc(toc) {
    // Wait for KaTeX to be available
    const tryRender = () => {
      if (typeof renderMathInElement !== "function") {
        console.log("KaTeX not yet available for TOC, waiting...");
        setTimeout(tryRender, 100);
        return;
      }

      // Render math in all TOC titles
      const titles = toc.querySelectorAll(".questions-toc__title");
      titles.forEach((title) => {
        try {
          renderMathInElement(title, {
            delimiters: [
              { left: "$$", right: "$$", display: true },
              { left: "$", right: "$", display: false },
              { left: "\\(", right: "\\)", display: false },
              { left: "\\[", right: "\\]", display: true },
            ],
            throwOnError: false,
          });
        } catch (e) {
          console.warn("KaTeX rendering failed for TOC title:", e);
        }
      });

      console.log("KaTeX rendered in TOC");
    };

    // Try immediately or wait for DOMContentLoaded
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () =>
        setTimeout(tryRender, 100),
      );
    } else {
      setTimeout(tryRender, 100);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
