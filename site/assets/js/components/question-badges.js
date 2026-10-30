/**
 * Question Badges Component
 * Adds badges to questions and provides filtering functionality
 */
class QuestionBadges {
  constructor() {
    this.badgeTypes = {
      required: t("Обязательно"),
      additional: t("Дополнительно"),
      later: t("Можно учить позже"),
      research: t("Ресерч"),
    };

    this.activeFilters = new Set(Object.keys(this.badgeTypes));
    this.questions = [];
    this.observer = null;
  }

  /**
   * Initialize badges on page load
   */
  init() {
    const questionsContainer = document.getElementById("questions");
    if (!questionsContainer) {
      return;
    }

    this.questions = Array.from(
      questionsContainer.querySelectorAll("li.question"),
    );

    if (this.questions.length === 0) {
      return;
    }

    // Add badges to all questions
    this.addBadgesToQuestions();

    // Add filter controls
    this.addFilterControls();

    // Apply initial filter
    this.applyFilters();

    // Set up MutationObserver to restore badges if they're removed
    this.setupBadgeObserver();

    // Also set up periodic check to restore badges after other components load
    // This handles cases where components modify DOM after initial load
    setTimeout(() => {
      this.restoreAllBadges();
    }, 500);

    setTimeout(() => {
      this.restoreAllBadges();
    }, 1500);
  }

  /**
   * Add badge(s) to a question if they don't exist
   * Supports multiple badges separated by spaces: data-badge-type="additional"
   */
  addBadgeToQuestion(questionElement) {
    const nameDiv = questionElement.querySelector(".name");
    if (!nameDiv) {
      return;
    }

    // Get badge types from data attribute or default to 'required'
    const badgeTypesStr = questionElement.dataset.badgeType || "required";

    // Parse badge types (support space-separated or comma-separated)
    const badgeTypes = badgeTypesStr
      .split(/[\s,]+/)
      .map((type) => type.trim())
      .filter((type) => type && this.badgeTypes[type]); // Only valid badge types

    // If no valid badge types, default to 'required'
    if (badgeTypes.length === 0) {
      badgeTypes.push("required");
    }

    // Add each badge type
    badgeTypes.forEach((badgeType) => {
      // Check if this specific badge already exists
      const existingBadge = nameDiv.querySelector(
        `.question-badge[data-badge-type="${badgeType}"]`,
      );
      if (existingBadge) {
        return; // Skip if this badge type already exists
      }

      // Бейдж — только цветной кружок, расшифровка в фильтрах над списком
      // и в тултипе.
      const badge = document.createElement("span");
      badge.className = `question-badge ${badgeType}`;
      badge.dataset.badgeType = badgeType;
      badge.title = this.badgeTypes[badgeType];
      badge.setAttribute("role", "img");
      badge.setAttribute("aria-label", this.badgeTypes[badgeType]);

      // Insert badge after the name content
      nameDiv.appendChild(badge);
    });

    this.addDeliveryBadgeToQuestion(questionElement, nameDiv);
    this.addDifficultyPillToQuestion(questionElement, nameDiv);
    this.addInterviewMeterToQuestion(questionElement, nameDiv);

    // Store badge types in question element (space-separated)
    questionElement.dataset.badgeType = badgeTypes.join(" ");
  }

  /**
   * Плашка сложности по data-difficulty (md-пайплайн) или по классу .name
   * (рукописные вопросы вроде bank/hr.html помечены только классом).
   */
  addDifficultyPillToQuestion(questionElement, nameDiv) {
    if (nameDiv.querySelector(".question-difficulty-pill")) return;

    const byClass = nameDiv.classList.contains("question-hard-title")
      ? "hard"
      : nameDiv.classList.contains("question-difficulty-medium")
        ? "medium"
        : nameDiv.classList.contains("question-difficulty-easy")
          ? "easy"
          : "";
    const difficulty = questionElement.dataset.difficulty || byClass;
    const labels = {
      easy: t("Легко"),
      medium: t("Средне"),
      hard: t("Сложно"),
    };
    if (!labels[difficulty]) return;

    const pill = document.createElement("span");
    pill.className = `question-difficulty-pill question-difficulty-pill--${difficulty}`;
    pill.textContent = labels[difficulty];
    pill.title = t("Сложность: {level}", {
      level: labels[difficulty].toLowerCase(),
    });
    nameDiv.appendChild(pill);
  }

  /**
   * Шкала «как часто спрашивают на собеседованиях», 1–5 (data-interview).
   * Пять точек, закрашено N; цвет — от красного (1) к зелёному (5).
   */
  addInterviewMeterToQuestion(questionElement, nameDiv) {
    if (nameDiv.querySelector(".question-interview")) return;

    const level = Number(questionElement.dataset.interview);
    if (!Number.isInteger(level) || level < 1 || level > 5) return;

    const hints = {
      1: t("практически не спрашивают"),
      2: t("спрашивают редко"),
      3: t("спрашивают примерно в половине случаев"),
      4: t("спрашивают часто, 60–70% собеседований"),
      5: t("спрашивают почти всегда, 80–90% собеседований"),
    };
    const label = t("На собеседованиях: {level} из 5 — {hint}", {
      level,
      hint: hints[level],
    });

    const meter = document.createElement("span");
    meter.className = "question-interview";
    meter.dataset.level = String(level);
    meter.setAttribute("role", "img");
    meter.setAttribute("aria-label", label);
    meter.title = label;
    meter.innerHTML =
      `<span class="question-interview__label" aria-hidden="true">${t("собес")}</span>` +
      "<i></i><i></i><i></i><i></i><i></i>";
    nameDiv.appendChild(meter);
  }

  addDeliveryBadgeToQuestion(questionElement, nameDiv) {
    const delivery = String(questionElement.dataset.delivery || "")
      .trim()
      .toLowerCase();
    if (!delivery) return;

    const labels = {
      ide: t("Можно сдавать в IDE"),
      local: t("Можно сдавать вне сайта"),
      offline: t("Можно сдавать вне сайта"),
      external: t("Можно сдавать вне сайта"),
    };

    const existingBadge = nameDiv.querySelector(".question-delivery-badge");
    if (existingBadge) return;

    const badge = document.createElement("span");
    badge.className = `question-delivery-badge question-delivery-badge--${delivery}`;
    badge.textContent = labels[delivery] || labels.external;
    badge.dataset.delivery = delivery;
    nameDiv.appendChild(badge);
  }

  /**
   * Add badges to all questions
   */
  addBadgesToQuestions() {
    this.questions.forEach((question) => {
      this.addBadgeToQuestion(question);
    });
  }

  /**
   * Add filter controls to the page
   * If .section-shell__filters exists, build toolbar row (chips + count). Otherwise legacy card layout.
   */
  addFilterControls() {
    const shellFilters = document.querySelector(".section-shell__filters");
    const badgeDotColors = {
      required: "#ef4444",
      additional: "#f59e0b",
      later: "#94a3b8",
      research: "#8b5cf6",
    };

    if (shellFilters) {
      // Toolbar: слева чипы, справа "Показано…"
      const filterRow = document.createElement("div");
      filterRow.className = "badge-filters filters-row";

      const filtersLeft = document.createElement("div");
      filtersLeft.className = "filters-left";

      Object.keys(this.badgeTypes).forEach((badgeType) => {
        const labelEl = document.createElement("label");
        labelEl.className = "filter-chip";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = true;
        checkbox.dataset.badgeType = badgeType;
        checkbox.addEventListener("change", () =>
          this.handleFilterChange(badgeType, checkbox.checked),
        );

        const dot = document.createElement("span");
        dot.className = "filter-dot";
        dot.style.background = badgeDotColors[badgeType] || "#94a3b8";

        labelEl.appendChild(checkbox);
        labelEl.appendChild(dot);
        labelEl.appendChild(
          document.createTextNode(this.badgeTypes[badgeType]),
        );

        // Анимация нажатия: класс вместо :active (надёжно на тач-устройствах)
        labelEl.addEventListener("pointerdown", (e) => {
          labelEl.classList.add("filter-chip-press");
          labelEl.setPointerCapture(e.pointerId);
        });
        labelEl.addEventListener("pointerup", (e) => {
          labelEl.classList.remove("filter-chip-press");
          labelEl.releasePointerCapture(e.pointerId);
        });
        labelEl.addEventListener("pointercancel", (e) => {
          labelEl.classList.remove("filter-chip-press");
          labelEl.releasePointerCapture(e.pointerId);
        });

        filtersLeft.appendChild(labelEl);
      });

      const filtersRight = document.createElement("div");
      filtersRight.className = "filters-right";
      const countDisplay = document.createElement("span");
      countDisplay.className = "filters-count question-count";
      countDisplay.textContent = t("Показано: {visible} из {total}", {
        visible: 0,
        total: 0,
      });
      filtersRight.appendChild(countDisplay);

      // Стрелка у заголовка — ссылка на источник; подписи у неё нет,
      // поэтому расшифровка живёт здесь, рядом с легендой кружков.
      if (document.querySelector("#questions li.question[data-title-link]")) {
        const hint = document.createElement("span");
        hint.className = "filters-hint";
        hint.innerHTML = `<span class="question-title-link__indicator" aria-hidden="true">↗</span> ${t("ссылка на источник")}`;
        filtersLeft.appendChild(hint);
      }

      filterRow.appendChild(filtersLeft);
      filterRow.appendChild(filtersRight);
      shellFilters.appendChild(filterRow);
      return;
    }

    // Legacy: card layout (с лейблом «Фильтры»)
    const filterContainer = document.createElement("div");
    filterContainer.className = "badge-filters";

    const headerRow = document.createElement("div");
    headerRow.className = "badge-filters-header";
    const label = document.createElement("span");
    label.className = "filter-label";
    label.textContent = t("Фильтры");
    headerRow.appendChild(label);
    const countDisplay = document.createElement("span");
    countDisplay.className = "question-count";
    countDisplay.textContent = t("Показано: {visible} из {total}", {
      visible: 0,
      total: 0,
    });
    headerRow.appendChild(countDisplay);

    filterContainer.appendChild(headerRow);

    const buttonsRow = document.createElement("div");
    buttonsRow.className = "badge-filters-buttons";
    Object.keys(this.badgeTypes).forEach((badgeType) => {
      const labelElement = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = true;
      checkbox.dataset.badgeType = badgeType;
      checkbox.addEventListener("change", () =>
        this.handleFilterChange(badgeType, checkbox.checked),
      );
      const badgePreview = document.createElement("span");
      badgePreview.className = `question-badge ${badgeType}`;
      labelElement.appendChild(checkbox);
      labelElement.appendChild(badgePreview);
      labelElement.appendChild(
        document.createTextNode(this.badgeTypes[badgeType]),
      );
      buttonsRow.appendChild(labelElement);
    });
    filterContainer.appendChild(buttonsRow);

    const controlsDiv = document.querySelector(".controls");
    if (!controlsDiv) return;
    controlsDiv.parentNode.insertBefore(
      filterContainer,
      controlsDiv.nextSibling,
    );
  }

  /**
   * Handle filter checkbox change
   */
  handleFilterChange(badgeType, isChecked) {
    if (isChecked) {
      this.activeFilters.add(badgeType);
    } else {
      this.activeFilters.delete(badgeType);
    }

    this.applyFilters();
  }

  /**
   * Apply filters to questions
   * Shows question if at least one of its badges is active
   */
  applyFilters() {
    this.questions.forEach((question) => {
      const badgeTypesStr = question.dataset.badgeType || "required";

      // Parse badge types (support space-separated or comma-separated)
      const badgeTypes = badgeTypesStr
        .split(/[\s,]+/)
        .map((type) => type.trim())
        .filter((type) => type && this.badgeTypes[type]);

      // If no valid badge types, default to 'required'
      if (badgeTypes.length === 0) {
        badgeTypes.push("required");
      }

      // Show question if at least one of its badge types is active
      const hasActiveBadge = badgeTypes.some((badgeType) =>
        this.activeFilters.has(badgeType),
      );

      if (hasActiveBadge) {
        question.classList.remove("hidden-by-filter");
      } else {
        question.classList.add("hidden-by-filter");
      }
    });

    // Update question count if there's a counter
    this.updateQuestionCount();
  }

  /**
   * Update visible question count
   */
  updateQuestionCount() {
    const visibleCount = this.questions.filter(
      (q) => !q.classList.contains("hidden-by-filter"),
    ).length;
    const totalCount = this.questions.length;
    const text = t("Показано: {visible} из {total}", {
      visible: visibleCount,
      total: totalCount,
    });

    document
      .querySelectorAll(".question-count, .filters-count")
      .forEach((el) => {
        el.textContent = text;
      });
  }

  /**
   * Set up MutationObserver to restore badges if they're removed by other components
   */
  setupBadgeObserver() {
    if (!window.MutationObserver) {
      return;
    }

    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if a question element was added or modified
              const questionElement = node.classList?.contains("question")
                ? node
                : node.closest?.("li.question");

              if (questionElement) {
                // Small delay to let other components finish their modifications
                setTimeout(() => {
                  this.addBadgeToQuestion(questionElement);
                }, 100);
              }

              // Check if a .name div was modified
              const nameDiv = node.classList?.contains("name")
                ? node
                : node.querySelector?.(".name");

              if (nameDiv) {
                const questionElement = nameDiv.closest("li.question");
                if (questionElement) {
                  // Check if all expected badges exist
                  const badgeTypesStr =
                    questionElement.dataset.badgeType || "required";
                  const badgeTypes = badgeTypesStr
                    .split(/[\s,]+/)
                    .map((type) => type.trim())
                    .filter((type) => type && this.badgeTypes[type]);

                  if (badgeTypes.length === 0) {
                    badgeTypes.push("required");
                  }

                  const missingBadges = badgeTypes.filter((badgeType) => {
                    return !nameDiv.querySelector(
                      `.question-badge[data-badge-type="${badgeType}"]`,
                    );
                  });

                  if (missingBadges.length > 0) {
                    // Some badges are missing, restore them
                    setTimeout(() => {
                      this.addBadgeToQuestion(questionElement);
                    }, 100);
                  }
                }
              }
            }
          });

          // Also check for removed badges
          mutation.removedNodes.forEach((node) => {
            if (
              node.nodeType === Node.ELEMENT_NODE &&
              node.classList?.contains("question-badge")
            ) {
              const questionElement = node.closest("li.question");
              if (questionElement) {
                // Badge was removed, restore it after a delay
                setTimeout(() => {
                  this.addBadgeToQuestion(questionElement);
                }, 100);
              }
            }
          });
        }

        // Handle textContent changes that might remove badges
        if (
          mutation.type === "characterData" ||
          (mutation.type === "childList" &&
            mutation.target.classList?.contains("name"))
        ) {
          const nameDiv = mutation.target.classList?.contains("name")
            ? mutation.target
            : mutation.target.querySelector?.(".name");

          if (nameDiv) {
            const questionElement = nameDiv.closest("li.question");
            if (questionElement) {
              // Check if all expected badges exist
              const badgeTypesStr =
                questionElement.dataset.badgeType || "required";
              const badgeTypes = badgeTypesStr
                .split(/[\s,]+/)
                .map((type) => type.trim())
                .filter((type) => type && this.badgeTypes[type]);

              if (badgeTypes.length === 0) {
                badgeTypes.push("required");
              }

              const missingBadges = badgeTypes.filter((badgeType) => {
                return !nameDiv.querySelector(
                  `.question-badge[data-badge-type="${badgeType}"]`,
                );
              });

              if (missingBadges.length > 0) {
                setTimeout(() => {
                  this.addBadgeToQuestion(questionElement);
                }, 150);
              }
            }
          }
        }
      });
    });

    // Observe all question elements
    this.questions.forEach((question) => {
      const nameDiv = question.querySelector(".name");
      if (nameDiv) {
        this.observer.observe(nameDiv, {
          childList: true,
          subtree: true,
          characterData: true,
        });
      }
    });
  }

  /**
   * Restore badges for all questions that are missing them
   */
  restoreAllBadges() {
    this.questions.forEach((question) => {
      const nameDiv = question.querySelector(".name");
      if (!nameDiv) {
        return;
      }

      // Get expected badge types
      const badgeTypesStr = question.dataset.badgeType || "required";
      const badgeTypes = badgeTypesStr
        .split(/[\s,]+/)
        .map((type) => type.trim())
        .filter((type) => type && this.badgeTypes[type]);

      if (badgeTypes.length === 0) {
        badgeTypes.push("required");
      }

      // Check if all expected badges exist
      const missingBadges = badgeTypes.filter((badgeType) => {
        return !nameDiv.querySelector(
          `.question-badge[data-badge-type="${badgeType}"]`,
        );
      });

      // Restore if any badges are missing
      if (missingBadges.length > 0) {
        this.addBadgeToQuestion(question);
      }
    });
  }
}

// Initialize on page load
let questionBadgesInstance = null;

document.addEventListener("DOMContentLoaded", () => {
  questionBadgesInstance = new QuestionBadges();
  questionBadgesInstance.init();
  // Раньше window.questionBadges присваивался при загрузке файла, когда
  // экземпляра ещё не было, — снаружи всегда лежал null.
  window.questionBadges = questionBadgesInstance;
});

// Also initialize after a delay to catch components that load later
setTimeout(() => {
  if (questionBadgesInstance) {
    questionBadgesInstance.restoreAllBadges();
  } else {
    questionBadgesInstance = new QuestionBadges();
    questionBadgesInstance.init();
    window.questionBadges = questionBadgesInstance;
  }
}, 2000);
