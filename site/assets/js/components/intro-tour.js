/**
 * Interactive Intro Tour Component
 * Shows first-time users a guided tour of the platform
 */

(function () {
  "use strict";

  // Перевод интерфейса (ядро — сниппет theme-boot). В тестах под Node его нет:
  // остаётся русский текст с подставленными значениями.
  const t =
    window.t ||
    ((text, params) =>
      text.replace(/\{(\w+)\}/g, (match, key) => params?.[key] ?? match));

  class IntroTour {
    constructor() {
      this.currentStep = 0;
      this.steps = [];
      this.overlay = null;
      this.spotlight = null;
      this.tooltip = null;
      this.isActive = false;
      this.db = null;
      this.user = null;
    }

    /**
     * Initialize the tour
     */
    async initialize(firebaseConfig) {
      try {
        // Initialize Firebase if not already done
        if (!firebase.apps.length) {
          firebase.initializeApp(firebaseConfig);
        }

        this.db = firebase.database();

        // Wait for auth - this happens in background without blocking UI
        firebase.auth().onAuthStateChanged(async (user) => {
          if (user) {
            this.user = user;

            // Check if intro has been shown - silently in background
            const shouldShow = await this.shouldShowIntro();

            if (shouldShow) {
              // Start tour immediately without delay
              const started = this.start();

              // Показать тур не удалось (нет ни одной цели на странице) —
              // не блокируем остальной онбординг.
              if (!started) {
                await this.ensureDisplayNameSet();
              }
            } else {
              // If intro is already completed, still require display name once
              await this.ensureDisplayNameSet();
            }
          }
        });

        return true;
      } catch (error) {
        console.error("Failed to initialize intro tour:", error);
        return false;
      }
    }

    /**
     * Check if intro should be shown
     */
    async shouldShowIntro() {
      try {
        if (localStorage.getItem("introShown") === "true") return false;
      } catch (e) {}

      if (!this.user || !this.db) return false;

      try {
        // Check Firebase
        const userRef = this.db.ref(`users/${this.user.uid}/introShown`);
        const snapshot = await userRef.once("value");
        const introShown = snapshot.val();

        // Show intro if flag is not set or is false
        if (introShown === true) {
          try { localStorage.setItem("introShown", "true"); } catch (e) {}
          return false;
        }
        return false; // Default offline: don't annoy user on every launch
      } catch (error) {
        console.error("Error checking intro status:", error);
        return false;
      }
    }

    /**
     * Mark intro as shown
     */
    async markIntroAsShown() {
      try {
        localStorage.setItem("introShown", "true");
      } catch (e) {}

      if (!this.user || !this.db) return;

      try {
        const userRef = this.db.ref(`users/${this.user.uid}`);
        await userRef.update({
          introShown: true,
          introShownAt: Date.now(),
        });

        console.log("Intro marked as shown");
      } catch (error) {
        console.error("Error marking intro as shown:", error);
      }
    }

    /**
     * Tour step definitions in page order.
     *
     * Разметка main.html меняется чаще, чем тур, поэтому шаги описаны данными и
     * перед стартом фильтруются по реально присутствующим и видимым целям
     * (см. defineSteps). Все селекторы без `dynamic: true` проверяются тестом
     * tests/intro-tour.test.js против main.html — если разметку снова
     * перепишут, тест упадёт вместо тихо разваливающегося тура.
     */
    static STEP_DEFINITIONS = [
      {
        target: ".page-header",
        title: "👋 Добро пожаловать!",
        content:
          "Привет! Давай познакомимся с платформой. Это займет всего минуту. Важно: прокликай тур до конца и нажми «Завершить», иначе он будет повторяться при следующих входах.",
        position: "bottom",
        highlightPadding: 20,
      },
      {
        target: "#mainToday",
        title: "🎯 Сегодня",
        content:
          "Стартовая полоса дня: карточки теорминимума к повторению, задачи с доски и новый фидбек от ментора — со счётчиками и переходом в один клик.",
        position: "bottom",
        highlightPadding: 12,
      },
      {
        target: ".main-catalog-card",
        title: "🔎 Единый каталог",
        content:
          "Кнопка каталога открывает поиск по всем разделам, материалам и вопросам — одной строкой, без блужданий по меню.",
        position: "bottom",
        highlightPadding: 12,
        highlight: true,
      },
      {
        target: ".main-focus-card",
        title: "📚 Обучение",
        content:
          "Роадмап, учебный план на неделю и профиль с достижениями, отчётами и тестами.",
        // Не "left": ниже 960px .main-priority-grid схлопывается в одну колонку,
        // карточка занимает всю ширину и тултип слева накрыл бы её же.
        position: "bottom",
        highlightPadding: 12,
      },
      {
        // Навбар рисует navigation.js уже после загрузки страницы, поэтому цель
        // динамическая: в статической разметке main.html её нет.
        target: "#navbar",
        dynamic: true,
        ignoreTopOffset: true,
        title: "🧭 Верхнее меню",
        content:
          "Отсюда доступны карта разделов, собеседования, дополнительные материалы, лидерборд, новости и профиль.",
        position: "bottom",
        highlightPadding: 8,
      },
      {
        target: '.cards-grid a.card[href*="guide/index.html"]',
        title: "🎬 Видео-гайд",
        content: "Двухминутное видео обо всех возможностях платформы.",
        position: "top",
        highlightPadding: 15,
        highlight: true,
      },
      {
        target: '.cards-grid a.card[href*="start.html"]',
        title: "📘 Первые шаги",
        content:
          "Если ты в начале пути — начни отсюда. Базовые знания и инструменты.",
        position: "top",
        highlightPadding: 15,
      },
      {
        target: ".page-header-text",
        title: "✨ Готов начать?",
        content:
          "Отлично! Теперь нажми «Завершить»: после этого тур больше не будет запускаться каждый раз, а платформа предложит выбрать имя и ник для удобного взаимодействия.",
        position: "bottom",
        highlightPadding: 20,
      },
    ];

    /**
     * Define tour steps: keep only the ones whose target exists on this page.
     */
    defineSteps() {
      const available = IntroTour.STEP_DEFINITIONS.filter((step) =>
        this.isStepAvailable(step),
      );

      // «Завершить» всегда на последнем реально показываемом шаге, иначе тур
      // закончится без кнопки и introShown не будет записан.
      this.steps = available.map((step, index) => ({
        ...step,
        isLast: index === available.length - 1,
      }));

      return this.steps;
    }

    /**
     * Check that step target is present and actually visible
     */
    isStepAvailable(step) {
      let element = null;
      try {
        element = document.querySelector(step.target);
      } catch (error) {
        console.warn("Invalid intro tour selector:", step.target, error);
        return false;
      }

      if (!element) return false;

      if (element.hidden) return false;
      if (
        typeof element.closest === "function" &&
        element.closest("[hidden]")
      ) {
        return false;
      }

      if (typeof element.getBoundingClientRect === "function") {
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return false;
      }

      if (typeof window.getComputedStyle === "function") {
        const style = window.getComputedStyle(element);
        if (
          style &&
          (style.display === "none" || style.visibility === "hidden")
        ) {
          return false;
        }
      }

      return true;
    }

    /**
     * Start the tour
     */
    start() {
      // Тур уже на экране — это успех, а не «показать не удалось»: иначе
      // вызывающий код решит, что интро не было, и откроет модалку имени
      // поверх работающего тура.
      if (this.isActive) return true;

      // Prepare tour
      this.defineSteps();

      if (this.steps.length === 0) {
        // Ни одна цель не найдена (например, разметку страницы переписали).
        // Молча выходим, чтобы не показывать пустой оверлей.
        console.warn("Intro tour has no visible targets, skipping");
        return false;
      }

      this.currentStep = 0;
      this.isActive = true;

      // Create overlay and show first step immediately
      this.createOverlay();
      this.showStep(0);
      return true;
    }

    /**
     * Create overlay elements
     */
    createOverlay() {
      // Create overlay
      this.overlay = document.createElement("div");
      this.overlay.className = "intro-tour-overlay visible";

      // Create spotlight
      this.spotlight = document.createElement("div");
      this.spotlight.className = "intro-tour-spotlight";

      // Create tooltip
      this.tooltip = document.createElement("div");
      this.tooltip.className = "intro-tour-tooltip";

      // Append to body
      document.body.appendChild(this.overlay);
      document.body.appendChild(this.spotlight);
      document.body.appendChild(this.tooltip);

      // Click overlay to skip
      this.overlay.addEventListener("click", (e) => {
        if (e.target === this.overlay) {
          this.skip();
        }
      });
    }

    /**
     * Show specific step
     */
    showStep(stepIndex) {
      if (stepIndex < 0) {
        return;
      }

      if (stepIndex >= this.steps.length) {
        // Шаги кончились — это нормальное завершение, а не отмена:
        // помечаем интро как показанное, иначе тур повторится при следующем входе.
        this.finish();
        return;
      }

      this.currentStep = stepIndex;
      const step = this.steps[stepIndex];
      const target = document.querySelector(step.target);

      if (!target) {
        console.warn(`Target not found for step ${stepIndex}:`, step.target);
        this.next();
        return;
      }

      // Check if element is already in viewport
      const rect = target.getBoundingClientRect();
      const isInViewport =
        rect.top >= this.getViewportTopOffset(step) &&
        rect.left >= 0 &&
        rect.bottom <= window.innerHeight &&
        rect.right <= window.innerWidth;

      if (!isInViewport) {
        // Scroll target into view only if needed
        target.scrollIntoView({ behavior: "smooth", block: "center" });

        // Wait for scroll to complete
        setTimeout(() => {
          this.highlightElement(target, step);
          this.showTooltip(target, step, stepIndex);
        }, 400);
      } else {
        // Element already visible, show immediately
        this.highlightElement(target, step);
        this.showTooltip(target, step, stepIndex);
      }
    }

    /**
     * Highlight element
     */
    highlightElement(element, step) {
      // Use fixed positioning relative to viewport
      this.updateSpotlightPosition(element, step);

      // Add special highlight class if needed
      if (step.highlight) {
        this.spotlight.classList.add("special-highlight");
      } else {
        this.spotlight.classList.remove("special-highlight");
      }

      // Show spotlight
      this.spotlight.style.opacity = "1";

      // Update position on scroll and resize
      this.setupSpotlightListeners(element, step);
    }

    /**
     * Update spotlight position
     */
    updateSpotlightPosition(element, step) {
      const rect = element.getBoundingClientRect();
      const padding = step.highlightPadding || 10;
      const viewportTop = this.getViewportTopOffset(step);
      const top = Math.max(viewportTop + 8, rect.top - padding);
      const left = Math.max(8, rect.left - padding);
      const width = Math.min(
        rect.width + padding * 2,
        window.innerWidth - left - 8,
      );
      const height = Math.max(
        0,
        Math.min(rect.height + padding * 2, window.innerHeight - top - 8),
      );

      // Use fixed positioning - always relative to current viewport
      this.spotlight.style.position = "fixed";
      this.spotlight.style.top = `${top}px`;
      this.spotlight.style.left = `${left}px`;
      this.spotlight.style.width = `${width}px`;
      this.spotlight.style.height = `${height}px`;
      this.spotlight.style.visibility = "visible";
    }

    /**
     * Keep tour UI below the sticky navbar.
     */
    getViewportTopOffset(step) {
      // Шаг, который подсвечивает сам навбар, не нужно опускать под навбар.
      if (step && step.ignoreTopOffset) return 0;

      const navbar = document.getElementById("navbar");
      if (!navbar) return 0;

      const rect = navbar.getBoundingClientRect();
      const style = window.getComputedStyle(navbar);
      const isStickyTop =
        (style.position === "sticky" || style.position === "fixed") &&
        rect.top <= 1;

      return isStickyTop ? Math.max(0, rect.bottom) : 0;
    }

    /**
     * Setup spotlight listeners for scroll and resize
     */
    setupSpotlightListeners(element, step) {
      // Remove old listeners if exist
      if (this.scrollListener) {
        window.removeEventListener("scroll", this.scrollListener);
        window.removeEventListener("resize", this.scrollListener);
      }

      // Create new listener that updates position
      this.scrollListener = () => {
        // Навбар целиком заменяется в applyRoleNavigation() после чтения роли,
        // поэтому цель перезапрашиваем: у снятого со страницы узла
        // getBoundingClientRect() вернул бы нули и схлопнул подсветку.
        const current = document.querySelector(step.target) || element;
        this.updateSpotlightPosition(current, step);

        // Also update tooltip position if visible
        if (this.tooltip && this.tooltip.style.opacity === "1") {
          this.positionTooltip(current.getBoundingClientRect(), step);
        }
      };

      // Listen to both scroll and resize events
      window.addEventListener("scroll", this.scrollListener, { passive: true });
      window.addEventListener("resize", this.scrollListener, { passive: true });
    }

    /**
     * Show tooltip
     */
    showTooltip(element, step, stepIndex) {
      const rect = element.getBoundingClientRect();

      // Make tooltip visible
      this.tooltip.style.visibility = "visible";

      // Create tooltip content
      this.tooltip.innerHTML = `
        <div class="intro-tour-tooltip-content">
          <div class="intro-tour-tooltip-header">
            <h3>${t(step.title)}</h3>
            <button class="intro-tour-close" onclick="window.introTour.skip()">×</button>
          </div>
          <div class="intro-tour-tooltip-body">
            <p>${t(step.content)}</p>
          </div>
          <div class="intro-tour-tooltip-footer">
            <div class="intro-tour-progress">
              <span>${stepIndex + 1} / ${this.steps.length}</span>
            </div>
            <div class="intro-tour-buttons">
              ${stepIndex > 0 ? `<button class="intro-tour-btn intro-tour-btn-back" onclick="window.introTour.previous()">${t("Назад")}</button>` : ""}
              ${
                step.isLast
                  ? `<button class="intro-tour-btn intro-tour-btn-primary" onclick="window.introTour.finish()">${t("Завершить")}</button>`
                  : `<button class="intro-tour-btn intro-tour-btn-primary" onclick="window.introTour.next()">${t("Далее")}</button>`
              }
            </div>
          </div>
        </div>
      `;

      // Position tooltip
      this.positionTooltip(rect, step);

      // Show tooltip
      this.tooltip.style.opacity = "1";
    }

    /**
     * Position tooltip relative to target
     */
    positionTooltip(targetRect, step) {
      const position = (step && step.position) || "bottom";
      const tooltipRect = this.tooltip.getBoundingClientRect();
      const margin = 20;

      let top, left;

      switch (position) {
        case "top":
          top = targetRect.top - tooltipRect.height - margin;
          left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
          break;
        case "bottom":
          top = targetRect.bottom + margin;
          left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
          break;
        case "left":
          top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
          left = targetRect.left - tooltipRect.width - margin;
          break;
        case "right":
          top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
          left = targetRect.right + margin;
          break;
        default:
          top = targetRect.bottom + margin;
          left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
      }

      // Keep tooltip within viewport
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const viewportTop = this.getViewportTopOffset(step);
      const minTop = viewportTop + 12;

      if (left < 10) left = 10;
      if (left + tooltipRect.width > viewportWidth - 10) {
        left = viewportWidth - tooltipRect.width - 10;
      }
      if (top < minTop) top = minTop;
      if (top + tooltipRect.height > viewportHeight - 10) {
        top = viewportHeight - tooltipRect.height - 10;
      }

      this.tooltip.style.top = `${top}px`;
      this.tooltip.style.left = `${left}px`;
    }

    /**
     * Go to next step
     */
    next() {
      this.showStep(this.currentStep + 1);
    }

    /**
     * Go to previous step
     */
    previous() {
      this.showStep(this.currentStep - 1);
    }

    /**
     * Skip tour
     */
    skip() {
      if (
        confirm(
          t(
            "Пропустить знакомство с платформой? Ты всегда сможешь посмотреть видео-гайд.",
          ),
        )
      ) {
        this.markIntroAsShown();
        this.end();
      }
    }

    /**
     * Finish tour
     */
    async finish() {
      await this.markIntroAsShown();

      // Grant achievement for completing onboarding
      if (window.gamificationSystem) {
        await window.gamificationSystem.grantAchievement("onboarding_complete");
      }

      this.end();

      // Show success message
      this.showSuccessMessage();

      // Force user to set display name right after intro completion
      await this.ensureDisplayNameSet();
    }

    /**
     * End tour
     */
    end() {
      if (!this.isActive) return;

      // Remove all listeners
      if (this.scrollListener) {
        window.removeEventListener("scroll", this.scrollListener);
        window.removeEventListener("resize", this.scrollListener);
        this.scrollListener = null;
      }

      // Remove elements
      if (this.overlay) this.overlay.remove();
      if (this.spotlight) this.spotlight.remove();
      if (this.tooltip) this.tooltip.remove();

      this.isActive = false;
      console.log("Intro tour ended");
    }

    /**
     * Show success message
     */
    showSuccessMessage() {
      const message = document.createElement("div");
      message.className = "intro-tour-success";
      message.innerHTML = `
        <div class="intro-tour-success-content">
          <div class="intro-tour-success-icon">🎉</div>
          <h3>${t("Отлично!")}</h3>
          <p>${t("Теперь ты знаешь, как пользоваться платформой")}</p>
        </div>
      `;

      document.body.appendChild(message);

      // Auto-remove after 3 seconds
      setTimeout(() => {
        message.style.animation = "fadeOut 0.3s ease-out";
        setTimeout(() => message.remove(), 300);
      }, 3000);
    }

    /**
     * Restart tour (for testing)
     */
    async restart() {
      if (this.isActive) {
        this.end();
      }

      // Reset flag in Firebase
      if (this.user && this.db) {
        const userRef = this.db.ref(`users/${this.user.uid}`);
        await userRef.update({
          introShown: false,
        });
      }

      // Restart
      setTimeout(() => this.start(), 500);
    }

    /**
     * Ensure user has display name set in profile
     */
    async ensureDisplayNameSet() {
      if (!this.user || !this.db) return;

      try {
        const userRef = this.db.ref(`users/${this.user.uid}`);
        const snapshot = await userRef.once("value");
        const userData = snapshot.val() || {};
        const displayName = (userData.displayName || "").trim();

        if (displayName) {
          return;
        }

        await this.showRequiredDisplayNameModal();
      } catch (error) {
        console.error("Failed to ensure display name is set:", error);
      }
    }

    /**
     * Show mandatory display name modal (cannot be skipped)
     */
    showRequiredDisplayNameModal() {
      return new Promise((resolve) => {
        const existingModal = document.querySelector(
          ".intro-name-modal-overlay",
        );
        if (existingModal) {
          resolve();
          return;
        }

        const overlay = document.createElement("div");
        overlay.className = "intro-name-modal-overlay";

        overlay.innerHTML = `
          <div class="intro-name-modal" role="dialog" aria-modal="true" aria-labelledby="introNameTitle">
            <h3 id="introNameTitle">${t("Как тебя зовут?")}</h3>
            <p class="intro-name-description">
              ${t("Укажи имя, фамилию и ник в Telegram — они будут видны в лидерборде.")}
            </p>
            <form class="intro-name-form" novalidate>
              <div class="intro-name-row">
                <div class="intro-name-col">
                  <label for="introFirstNameInput" class="intro-name-label">${t("Имя")}</label>
                  <input
                    id="introFirstNameInput"
                    class="intro-name-input"
                    type="text"
                    maxlength="20"
                    autocomplete="given-name"
                    placeholder="${t("Иван")}"
                    required
                  />
                </div>
                <div class="intro-name-col">
                  <label for="introLastNameInput" class="intro-name-label">${t("Фамилия")}</label>
                  <input
                    id="introLastNameInput"
                    class="intro-name-input"
                    type="text"
                    maxlength="20"
                    autocomplete="family-name"
                    placeholder="${t("Иванов")}"
                    required
                  />
                </div>
              </div>
              <label for="introTelegramInput" class="intro-name-label" style="margin-top:12px">${t("Ник в Telegram")}</label>
              <input
                id="introTelegramInput"
                class="intro-name-input"
                type="text"
                maxlength="33"
                autocomplete="off"
                placeholder="@nickname"
                required
              />
              <p class="intro-name-error" hidden></p>
              <p class="intro-name-hint">${t("В лидерборде:")} <em id="introNamePreview">${t("Иван Иванов (@telegram)")}</em></p>
              <button type="submit" class="intro-name-submit">${t("Сохранить")}</button>
            </form>
          </div>
        `;

        document.body.appendChild(overlay);

        const form = overlay.querySelector(".intro-name-form");
        const firstInput = overlay.querySelector("#introFirstNameInput");
        const lastInput = overlay.querySelector("#introLastNameInput");
        const telegramInput = overlay.querySelector("#introTelegramInput");
        const errorEl = overlay.querySelector(".intro-name-error");
        const submitBtn = overlay.querySelector(".intro-name-submit");
        const preview = overlay.querySelector("#introNamePreview");

        const wordPattern = /^[A-Za-zА-Яа-яЁё][A-Za-zА-Яа-яЁё'-]{0,19}$/;
        const telegramPattern = /^@?[A-Za-z][A-Za-z0-9_]{4,31}$/;

        const setError = (text) => {
          errorEl.textContent = text;
          errorEl.hidden = !text;
        };

        const updatePreview = () => {
          const fn = firstInput.value.trim() || t("Имя");
          const ln = lastInput.value.trim() || t("Фамилия");
          const raw = telegramInput.value.trim();
          const tg = raw
            ? raw.startsWith("@")
              ? raw
              : `@${raw}`
            : "@telegram";
          preview.textContent = `${fn} ${ln} (${tg})`;
        };

        [firstInput, lastInput, telegramInput].forEach((el) =>
          el.addEventListener("input", updatePreview),
        );

        firstInput.focus();

        form.addEventListener("submit", async (event) => {
          event.preventDefault();

          const firstName = firstInput.value.trim();
          const lastName = lastInput.value.trim();
          const rawTelegram = telegramInput.value.trim();
          const telegramValue = rawTelegram.startsWith("@")
            ? rawTelegram
            : `@${rawTelegram}`;

          if (!firstName) {
            setError(t("Введи имя"));
            return;
          }
          if (!wordPattern.test(firstName)) {
            setError(t("Имя: только буквы, дефис или апостроф"));
            return;
          }
          if (!lastName) {
            setError(t("Введи фамилию"));
            return;
          }
          if (!wordPattern.test(lastName)) {
            setError(t("Фамилия: только буквы, дефис или апостроф"));
            return;
          }
          if (!rawTelegram) {
            setError(t("Укажи ник в Telegram"));
            return;
          }
          if (!telegramPattern.test(rawTelegram)) {
            setError(
              t(
                "Неверный формат ника: от 5 букв/цифр/подчёркиваний, начиная с буквы",
              ),
            );
            return;
          }

          submitBtn.disabled = true;
          setError("");

          const displayName = `${firstName} ${lastName} (${telegramValue})`;

          try {
            const userRef = this.db.ref(`users/${this.user.uid}`);
            await userRef.update({
              displayName,
              firstName,
              lastName,
              telegram: telegramValue,
              lastUpdated: Date.now(),
              displayNameSetAt: Date.now(),
            });

            const title = document.getElementById("title");
            if (title) {
              title.textContent = t("Привет, {name}!", { name: firstName });
            }

            overlay.remove();
            resolve();
          } catch (error) {
            console.error("Failed to save required display name:", error);
            submitBtn.disabled = false;
            setError(
              t("Не удалось сохранить. Проверь интернет и попробуй снова."),
            );
          }
        });
      });
    }
  }

  // Create global instance
  window.IntroTour = IntroTour;
  window.introTour = new IntroTour();

  // Export for modules
  if (typeof module !== "undefined" && module.exports) {
    module.exports = IntroTour;
  }
})();
