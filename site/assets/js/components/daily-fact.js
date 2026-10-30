class DailyFact {
  constructor() {
    this.facts = [];
    this.container = null;
    this.currentFact = null;
    this.storageKey = "lastFactDate";
    this.seenFactsKey = "dailyFactSeen";
    this.timerInterval = null;
    this.hoursInMilliseconds = 12 * 60 * 60 * 1000; // 12 часов в миллисекундах
    this.autoCloseTimer = null;
    this.timerStartTime = null;
    this.timerRemaining = null;
    this.isPaused = false;
  }

  formatTimeRemaining(milliseconds) {
    const hours = Math.floor(milliseconds / (60 * 60 * 1000));
    const minutes = Math.floor((milliseconds % (60 * 60 * 1000)) / (60 * 1000));

    return t("{hours} ч {minutes} мин", { hours, minutes });
  }

  updateTimer() {
    const lastTime = localStorage.getItem(this.storageKey);
    if (!lastTime) return;

    const now = Date.now();
    const timeSinceLastFact = now - parseInt(lastTime);
    const timeRemaining = Math.max(
      0,
      this.hoursInMilliseconds - timeSinceLastFact,
    );

    const timerElement = document.getElementById("factTimer");
    if (timerElement) {
      if (timeRemaining > 0) {
        timerElement.textContent = t("Следующий факт через: {time}", {
          time: this.formatTimeRemaining(timeRemaining),
        });
      } else {
        timerElement.textContent = t("Доступен новый факт!");
      }
    }

    // Если время вышло, показываем новый факт
    if (timeRemaining <= 0) {
      clearInterval(this.timerInterval);
      this.showRandomFact();
    }
  }

  async initialize() {
    try {
      // Load facts
      const response = await fetch("/assets/js/config/daily-facts.json");
      const data = await response.json();

      // Convert grouped structure to flat array with categories
      // Structure: { facts: { "ML": [{text: "..."}, ...], "DL": [...] } }
      this.facts = [];
      if (
        data.facts &&
        typeof data.facts === "object" &&
        !Array.isArray(data.facts)
      ) {
        // New structure: grouped by category
        for (const [category, facts] of Object.entries(data.facts)) {
          for (const fact of facts) {
            this.facts.push({ ...fact, category });
          }
        }
      } else {
        // Old structure: flat array (for backward compatibility)
        this.facts = data.facts || [];
      }

      // Create container if not exists
      this.createContainer();

      // Check if we should show fact today
      const shouldShow = this.shouldShowFactToday();

      if (shouldShow) {
        this.showRandomFact();
      } else {
      }
    } catch (error) {
      console.error("Error initializing daily fact:", error);
    }
  }

  createContainer() {
    // Create container if it doesn't exist
    if (!this.container) {
      this.container = document.createElement("div");
      this.container.className = "daily-fact-container";
      document.body.appendChild(this.container);
    }
  }

  shouldShowFactToday() {
    const lastTime = localStorage.getItem(this.storageKey);

    if (!lastTime) {
      return true;
    }

    const now = Date.now();
    const timeSinceLastFact = now - parseInt(lastTime);
    const hoursInMilliseconds = this.hoursInMilliseconds; // Используем значение из конструктора (12 часов)

    return timeSinceLastFact > hoursInMilliseconds;
  }

  // Ключ факта — хеш текста (FNV-1a), а не индекс: индексы съезжают при любой
  // правке daily-facts.json, и «уже показанные» указывали бы на другие факты.
  static factKey(text) {
    let hash = 0x811c9dc5;
    for (const char of String(text)) {
      hash = Math.imul(hash ^ char.codePointAt(0), 0x01000193) >>> 0;
    }
    return hash.toString(36);
  }

  /**
   * Колода без повторов: факт выбирается из ещё не показанных, и только когда
   * показаны все, колода начинается заново. Возвращает обновлённый список
   * ключей показанных фактов — ключи удалённых из файла фактов из него выпадают.
   */
  static pickUnseen(facts, seenKeys, random = Math.random) {
    const keys = facts.map((fact) => DailyFact.factKey(fact.text));
    const seen = new Set(seenKeys.filter((key) => keys.includes(key)));
    let pool = keys
      .map((key, index) => index)
      .filter((i) => !seen.has(keys[i]));
    if (!pool.length) {
      // Новый круг: не начинаем его с факта, которым закончился прошлый.
      const last = seenKeys[seenKeys.length - 1];
      seen.clear();
      pool = keys.map((key, index) => index);
      if (pool.length > 1) pool = pool.filter((i) => keys[i] !== last);
    }
    const index = pool[Math.floor(random() * pool.length)];
    return { fact: facts[index], index, seen: [...seen, keys[index]] };
  }

  readSeenFacts() {
    try {
      const stored = JSON.parse(localStorage.getItem(this.seenFactsKey));
      return Array.isArray(stored) ? stored.map(String) : [];
    } catch {
      return [];
    }
  }

  getRandomFact() {
    return DailyFact.pickUnseen(this.facts, this.readSeenFacts());
  }

  escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  showRandomFact() {
    // Clean up any existing fact first
    if (this.container && this.container.querySelector(".daily-fact-popup")) {
      this.closeFact();
      // Wait for cleanup to complete before showing new fact
      setTimeout(() => {
        this.createNewFact();
      }, 350);
    } else {
      this.createNewFact();
    }
  }

  createNewFact() {
    try {
      const { fact, seen } = this.getRandomFact();
      if (!fact || !fact.text) {
        console.warn("Invalid fact data");
        return;
      }

      this.currentFact = fact;

      // Escape HTML to prevent XSS and rendering issues
      const category = this.escapeHtml(fact.category || "");
      const factText = fact.text || "";
      const factLink = fact.link ? this.escapeHtml(fact.link) : null;

      const html = `
              <div class="daily-fact-popup">
                  <div class="daily-fact-header">
                      <span class="daily-fact-category">${category}</span>
                      <span class="daily-fact-title">${t("Факт дня")}</span>
                      <button class="daily-fact-close" aria-label="${t("Закрыть факт")}">×</button>
                  </div>
                  <div class="daily-fact-content">
                      <p>
                          ${
                            factLink
                              ? `<a href="${factLink}" class="daily-fact-link">${this.escapeHtml(factText)}</a>`
                              : this.escapeHtml(factText)
                          }
                      </p>
                      <div class="daily-fact-timer" id="factTimer"></div>
                  </div>
                  <div class="daily-fact-progress"></div>
              </div>
          `;

      this.container.innerHTML = html;

      // Render KaTeX formulas in the fact text
      this.renderMathInFact();

      // Add event listeners
      const popup = this.container.querySelector(".daily-fact-popup");
      if (!popup) {
        console.warn("Popup element not found");
        return;
      }

      const closeButton = this.container.querySelector(".daily-fact-close");
      if (closeButton) {
        closeButton.addEventListener("click", (e) => {
          e.stopPropagation();
          this.closeFact();
        });
      }

      // Close on click anywhere on the card (except links and math formulas)
      popup.addEventListener("click", (e) => {
        // Don't close if clicking on a link or KaTeX formula
        if (
          e.target.tagName === "A" ||
          e.target.closest("a") ||
          e.target.closest(".katex")
        ) {
          return;
        }
        this.closeFact();
      });

      // Pause timer on hover
      popup.addEventListener("mouseenter", () => {
        this.pauseTimer();
      });

      // Resume timer on mouse leave
      popup.addEventListener("mouseleave", () => {
        this.resumeTimer();
      });

      // Save current timestamp and the deck of already shown facts
      localStorage.setItem(this.storageKey, Date.now().toString());
      localStorage.setItem(this.seenFactsKey, JSON.stringify(seen));

      // Add animation class after a small delay
      setTimeout(() => {
        const popupElement = this.container.querySelector(".daily-fact-popup");
        if (popupElement && popupElement.parentElement) {
          popupElement.classList.add("show");
        }
      }, 100);

      // Start auto-close timer (10 seconds)
      this.startTimer(10000);
    } catch (error) {
      console.error("Error creating new fact:", error);
    }
  }

  renderMathInFact() {
    // Check if renderMathInElement is available
    if (typeof renderMathInElement === "function") {
      const factContent = this.container.querySelector(".daily-fact-content");
      if (factContent) {
        try {
          renderMathInElement(factContent, {
            delimiters: [
              { left: "$$", right: "$$", display: true },
              { left: "$", right: "$", display: false },
              { left: "\\(", right: "\\)", display: false },
              { left: "\\[", right: "\\]", display: true },
            ],
            throwOnError: false,
            errorColor: "#cc0000",
            strict: false,
          });
        } catch (error) {
          console.warn("Error rendering Math in daily fact:", error);
        }
      }
    } else {
      console.warn(
        "renderMathInElement is not available. KaTeX may not be loaded yet.",
      );
    }
  }

  startTimer(duration) {
    // Clear any existing timer
    if (this.autoCloseTimer) {
      clearTimeout(this.autoCloseTimer);
      this.autoCloseTimer = null;
    }

    this.timerStartTime = Date.now();
    this.timerRemaining = duration;
    this.isPaused = false;

    this.autoCloseTimer = setTimeout(() => {
      this.closeFact();
    }, duration);
  }

  pauseTimer() {
    if (!this.autoCloseTimer || this.isPaused || !this.timerStartTime) return;

    // Calculate remaining time
    const elapsed = Date.now() - this.timerStartTime;
    this.timerRemaining = Math.max(0, this.timerRemaining - elapsed);

    // Clear the timer
    clearTimeout(this.autoCloseTimer);
    this.autoCloseTimer = null;
    this.isPaused = true;
  }

  resumeTimer() {
    if (!this.isPaused || !this.timerRemaining || this.timerRemaining <= 0)
      return;

    // Restart timer with remaining time
    this.timerStartTime = Date.now();
    this.isPaused = false;

    this.autoCloseTimer = setTimeout(() => {
      this.closeFact();
    }, this.timerRemaining);
  }

  closeFact() {
    // Clear auto-close timer if exists
    if (this.autoCloseTimer) {
      clearTimeout(this.autoCloseTimer);
      this.autoCloseTimer = null;
    }

    // Reset timer state
    this.timerStartTime = null;
    this.timerRemaining = null;
    this.isPaused = false;

    const popup = this.container.querySelector(".daily-fact-popup");
    if (popup) {
      popup.classList.remove("show");
      popup.classList.add("hide");
    }

    // Remove container after animation
    setTimeout(() => {
      this.container.innerHTML = "";
    }, 300);
  }
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  const dailyFact = new DailyFact();
  dailyFact.initialize();
});

// Export to window for global access
window.DailyFact = DailyFact;

// DEBUG: Add function to force show fact
window.showDailyFact = () => {
  if (window.dailyFact) {
    window.dailyFact.showRandomFact();
  } else {
  }
};

// DEBUG: Add function to reset fact timer
window.resetDailyFact = () => {
  localStorage.removeItem("lastFactDate");
  location.reload();
};
