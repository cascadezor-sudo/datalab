/**
 * Question Presentation Component
 * Displays questions in a modal presentation mode with left/right navigation
 */

(function () {
  "use strict";

  // Перевод интерфейса (ядро — сниппет theme-boot). В тестах под Node его нет:
  // остаётся русский текст с подставленными значениями.
  const t =
    window.t ||
    ((text, params) =>
      text.replace(/\{(\w+)\}/g, (match, key) => params?.[key] ?? match));

  let currentQuestionIndex = 0;
  let questions = [];
  let modal = null;
  let isOpen = false;
  let slideMenuOpen = false;

  /**
   * Ensure CSS is loaded
   */
  function ensureStyles() {
    if (document.querySelector('link[href*="question-presentation.css"]')) {
      return; // Already loaded
    }

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/assets/css/question-presentation.css";
    document.head.appendChild(link);
  }

  /**
   * Initialize the presentation system
   */
  function init() {
    // Ensure CSS is loaded
    ensureStyles();

    // Find all questions on the page
    const questionElements = document.querySelectorAll(
      "#questions > li.question",
    );
    if (questionElements.length === 0) {
      return; // No questions found
    }

    // Extract question data
    questions = Array.from(questionElements).map((el, index) => {
      const nameEl = el.querySelector(".name");
      const contentEl = el.querySelector(".content");

      // Check if question is marked as hard (class is on .name, not on <li>)
      const isHard = !!el.querySelector(".name.question-hard-title");

      // Get content - check if it's in a template (lazy loaded)
      let content = "";
      if (contentEl) {
        // Check if content is empty (lazy loaded)
        if (
          contentEl.children.length === 0 &&
          nameEl &&
          nameEl.dataset.loaded === "false"
        ) {
          // Load from template
          const questionId = nameEl.id;
          const template = document.getElementById(`tpl-${questionId}`);
          if (template) {
            content = template.innerHTML || "";
            console.log(
              `Loaded content from template for question: ${questionId}`,
            );
          }
        } else {
          content = contentEl.innerHTML;
        }
      }

      // If code blocks are already processed, restore them to original state
      // This is needed because processed blocks have .code-container structure
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = content;
      const processedCodeBlocks = tempDiv.querySelectorAll(".code-block");

      processedCodeBlocks.forEach((block) => {
        // Check if this block has been processed (has code-container)
        const codeContainer = block.querySelector(".code-container");
        if (codeContainer) {
          // Extract original code from the processed block
          // IMPORTANT: Get code from .code-text, NOT from .code-content
          // because .code-content includes .line-numbers which we don't want
          let codeText = codeContainer.querySelector(".code-text");

          if (!codeText) {
            // Fallback: try .code-content but exclude .line-numbers
            const codeContent = codeContainer.querySelector(".code-content");
            if (codeContent) {
              // Clone to avoid modifying original
              const clone = codeContent.cloneNode(true);
              // Remove line numbers
              const lineNumbers = clone.querySelector(".line-numbers");
              if (lineNumbers) {
                lineNumbers.remove();
              }
              codeText = clone;
            }
          }

          if (codeText) {
            // Get original code text (preserve whitespace)
            // textContent will extract plain text even if codeText contains HTML from syntax highlighting
            let originalCode = "";
            if (codeText.nodeType === Node.TEXT_NODE) {
              originalCode = codeText.textContent || "";
            } else if (codeText.nodeType === Node.ELEMENT_NODE) {
              // For elements, textContent extracts all text without HTML tags
              originalCode = codeText.textContent || codeText.innerText || "";
            } else {
              originalCode = String(codeText);
            }

            // Clean up: remove any line number artifacts that might have leaked
            // Line numbers are typically padded (e.g., "  1", "  2") or just numbers
            originalCode = originalCode.replace(/^\s*\d+\s*$/gm, ""); // Remove lines that are just numbers

            const dataLang = block.getAttribute("data-lang") || "";

            // Restore to original unprocessed state
            block.innerHTML = originalCode.trim();
            if (dataLang) {
              block.setAttribute("data-lang", dataLang);
            } else {
              // Try to preserve language from processed block if available
              const langSpan = codeContainer.querySelector(".code-lang");
              if (langSpan) {
                const lang = langSpan.textContent.trim().toLowerCase();
                if (lang) {
                  block.setAttribute("data-lang", lang);
                }
              }
            }
          }
        }
      });

      // Update content with restored code blocks
      if (processedCodeBlocks.length > 0) {
        content = tempDiv.innerHTML;
      }

      return {
        index: index,
        name: nameEl
          ? nameEl.textContent.trim()
          : t("Вопрос {n}", { n: index + 1 }),
        menuName: nameEl
          ? getMenuQuestionTitle(nameEl)
          : t("Вопрос {n}", { n: index + 1 }),
        nameHtml: nameEl ? nameEl.innerHTML : t("Вопрос {n}", { n: index + 1 }), // Preserve HTML including badges
        nameId: nameEl ? nameEl.id || null : null,
        content: content,
        originalElement: el,
        isHard: isHard,
      };
    });

    if (questions.length === 0) {
      return;
    }

    // Create modal structure
    createModal();

    // Add button to controls if it exists
    addPresentationButton();

    // Add keyboard navigation
    setupKeyboardNavigation();
  }

  /**
   * Add presentation button to controls
   */
  function addPresentationButton() {
    const controls = document.querySelector(".controls");
    if (!controls) {
      // Try alternative selectors
      const altControls =
        document.querySelector("div.controls") ||
        document.querySelector('[class*="controls"]');
      if (!altControls) {
        return false; // No controls section found
      }
      // Use alternative controls
      const button = createButton();
      if (button) {
        altControls.appendChild(button);
        return true;
      }
      return false;
    }

    // Check if button already exists
    const existingButton = controls.querySelector(
      ".question-presentation-trigger",
    );
    if (existingButton) {
      return true; // Button already exists
    }

    const button = createButton();
    if (button) {
      // Try to add to .main-controls first (where other buttons are)
      const mainControls = controls.querySelector(".main-controls");
      if (mainControls) {
        mainControls.appendChild(button);
      } else {
        // If no .main-controls, add to the beginning of .controls
        // Find the first button or control element to insert before
        const firstButton = controls.querySelector("button");
        if (firstButton) {
          controls.insertBefore(button, firstButton);
        } else {
          // If no buttons found, just append
          controls.appendChild(button);
        }
      }

      // Verify button was added
      const addedButton = controls.querySelector(
        ".question-presentation-trigger",
      );
      if (addedButton) {
        // Force visibility one more time after a short delay
        setTimeout(() => {
          addedButton.style.setProperty("display", "inline-block", "important");
          addedButton.style.setProperty("visibility", "visible", "important");
          addedButton.style.setProperty("opacity", "1", "important");
        }, 100);
      }
      return !!addedButton;
    }
    return false;
  }

  /**
   * Create presentation button element
   */
  function createButton() {
    try {
      const button = document.createElement("button");
      button.className = "question-presentation-trigger";
      button.type = "button";
      button.textContent = t("Режим презентации");
      button.title = t(
        "Открыть вопросы в режиме презентации (удобно для записи видео)",
      );

      // Ensure button is visible with inline styles
      button.style.cssText =
        "display: inline-block !important; visibility: visible !important; opacity: 1 !important; position: relative !important; z-index: 1 !important; margin-left: 8px !important; padding: 8px 16px !important; border: none !important; border-radius: 8px !important; background: linear-gradient(135deg, #6a5af9, #a55deb) !important; color: white !important; font-size: 14px !important; font-weight: 500 !important; cursor: pointer !important;";

      // Add click handler
      button.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (questions.length > 0) {
          open(0);
        } else {
          // Try to initialize first
          init();
          if (questions.length > 0) {
            open(0);
          }
        }
      });

      return button;
    } catch (error) {
      return null;
    }
  }

  /**
   * Create the modal structure
   */
  function createModal() {
    // Modal backdrop
    modal = document.createElement("div");
    modal.id = "question-presentation-modal";
    modal.className = "question-presentation-modal";
    modal.innerHTML = `
      <div class="question-presentation-content">
        <button class="question-presentation-close" aria-label="${t("Закрыть")}">✕</button>
        <div class="question-presentation-header">
          <div class="question-presentation-header-top">
            <div class="question-presentation-counter">
              <span id="question-presentation-current">1</span> / <span id="question-presentation-total">${questions.length}</span>
            </div>
            <button class="question-presentation-menu-toggle" id="question-presentation-menu-toggle" type="button" aria-label="${t("Выбрать слайд")}" aria-expanded="false" aria-controls="question-presentation-menu">
              <span></span>
              <span></span>
              <span></span>
            </button>
          </div>
          <div class="question-presentation-title" id="question-presentation-title"></div>
          <div class="question-presentation-menu" id="question-presentation-menu" aria-label="${t("Выбор слайда")}"></div>
        </div>
        <div class="question-presentation-body" id="question-presentation-body">
          <!-- Question content will be inserted here -->
        </div>
        <div class="question-presentation-controls">
          <button class="question-presentation-btn question-presentation-prev" id="question-presentation-prev" aria-label="${t("Предыдущий вопрос")}">
            ← ${t("Назад")}
          </button>
          <button class="question-presentation-btn question-presentation-next" id="question-presentation-next" aria-label="${t("Следующий вопрос")}">
            ${t("Далее")} →
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Event listeners
    const closeBtn = modal.querySelector(".question-presentation-close");
    const prevBtn = modal.querySelector("#question-presentation-prev");
    const nextBtn = modal.querySelector("#question-presentation-next");
    const menuToggle = modal.querySelector(
      "#question-presentation-menu-toggle",
    );

    closeBtn.addEventListener("click", close);
    prevBtn.addEventListener("click", () => navigate(-1));
    nextBtn.addEventListener("click", () => navigate(1));
    menuToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      setSlideMenuOpen(!slideMenuOpen);
    });

    // Close on backdrop click
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        close();
      }
    });

    modal.addEventListener("click", (e) => {
      if (!slideMenuOpen) return;
      if (
        !e.target.closest(".question-presentation-menu") &&
        !e.target.closest(".question-presentation-menu-toggle")
      ) {
        setSlideMenuOpen(false);
      }
    });

    // Prevent body scroll when modal is open
    const originalOverflow = document.body.style.overflow;
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        document.body.style.overflow = originalOverflow;
      }
    });
  }

  /**
   * Open the presentation modal
   */
  function open(startIndex = 0) {
    if (questions.length === 0) {
      console.warn("No questions found for presentation");
      return;
    }

    currentQuestionIndex = Math.max(
      0,
      Math.min(startIndex, questions.length - 1),
    );
    isOpen = true;
    modal.classList.add("active");
    document.body.style.overflow = "hidden";
    setSlideMenuOpen(false);

    // Remove any presentation trigger buttons that might have been cloned into the modal
    const triggerButtons = modal.querySelectorAll(
      ".question-presentation-trigger",
    );
    triggerButtons.forEach((btn) => btn.remove());

    renderQuestion();
  }

  /**
   * Close the presentation modal
   */
  function close() {
    isOpen = false;
    modal.classList.remove("active");
    document.body.style.overflow = "";
    setSlideMenuOpen(false);
  }

  /**
   * Navigate to next/previous question
   */
  function navigate(direction) {
    const newIndex = currentQuestionIndex + direction;
    if (newIndex >= 0 && newIndex < questions.length) {
      currentQuestionIndex = newIndex;
      renderQuestion();
    }
  }

  /**
   * Jump directly to a selected question
   */
  function goToQuestion(index) {
    if (index < 0 || index >= questions.length) return;
    currentQuestionIndex = index;
    setSlideMenuOpen(false);
    renderQuestion();
  }

  /**
   * Open or close the slide picker
   */
  function setSlideMenuOpen(open) {
    slideMenuOpen = !!open;
    const menu = document.getElementById("question-presentation-menu");
    const toggle = document.getElementById("question-presentation-menu-toggle");

    if (menu) {
      menu.classList.toggle("active", slideMenuOpen);
    }

    if (toggle) {
      toggle.classList.toggle("active", slideMenuOpen);
      toggle.setAttribute("aria-expanded", slideMenuOpen ? "true" : "false");
    }

    if (slideMenuOpen) {
      const activeItem = menu?.querySelector(
        ".question-presentation-menu-item.active",
      );
      activeItem?.scrollIntoView({ block: "nearest" });
    }
  }

  /**
   * Update the slide picker list
   */
  function renderSlideMenu() {
    const menu = document.getElementById("question-presentation-menu");
    if (!menu) return;

    menu.innerHTML = questions
      .map((question, index) => {
        const isActive = index === currentQuestionIndex;
        const label =
          question.menuName || question.name || `Slide ${index + 1}`;
        return `
          <button class="question-presentation-menu-item${isActive ? " active" : ""}" type="button" data-question-index="${index}" aria-current="${isActive ? "true" : "false"}">
            <span class="question-presentation-menu-number">${index + 1}</span>
            <span class="question-presentation-menu-title">${escapeHtml(label)}</span>
          </button>
        `;
      })
      .join("");

    menu
      .querySelectorAll(".question-presentation-menu-item")
      .forEach((item) => {
        item.addEventListener("click", () => {
          goToQuestion(Number(item.dataset.questionIndex));
        });
      });
  }

  /**
   * Get a clean title for the slide picker.
   * The real slide title keeps source links and badges; the menu stays compact.
   */
  function getMenuQuestionTitle(nameEl) {
    const clone = nameEl.cloneNode(true);
    clone
      .querySelectorAll(
        [
          ".question-title-link__indicator",
          ".question-badge",
          ".question-delivery-badge",
          ".question-difficulty-pill",
          ".question-interview",
        ].join(","),
      )
      .forEach((el) => el.remove());

    return (
      clone.textContent
        .replace(/\s+/g, " ")
        .replace(/[↗↑]\s*Источник\b/gi, "")
        .replace(
          /\b(Обязательно|Дополнительно|Можно учить позже|Ресерч)\b/gi,
          "",
        )
        .trim() || nameEl.textContent.trim()
    );
  }

  /**
   * Escape text for safe insertion into menu markup
   */
  function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = value;
    return div.innerHTML;
  }

  /**
   * Render the current question
   */
  function renderQuestion() {
    const question = questions[currentQuestionIndex];
    if (!question) return;
    setSlideMenuOpen(false);

    // Update counter
    const currentEl = document.getElementById("question-presentation-current");
    const totalEl = document.getElementById("question-presentation-total");
    if (currentEl) currentEl.textContent = currentQuestionIndex + 1;
    if (totalEl) totalEl.textContent = questions.length;

    // Update title (prefer current DOM so number and <code> are in sync with the list)
    const titleEl = document.getElementById("question-presentation-title");
    if (titleEl) {
      const nameDiv = question.originalElement?.querySelector(".name");
      const titleHtml = nameDiv
        ? nameDiv.innerHTML
        : question.nameHtml || question.name;
      titleEl.innerHTML = titleHtml;
      // Add/remove hard class based on question difficulty
      if (question.isHard) {
        titleEl.classList.add("question-hard-title");
      } else {
        titleEl.classList.remove("question-hard-title");
      }
    }

    // Update header styling for hard questions
    const headerEl = document.querySelector(".question-presentation-header");
    if (headerEl) {
      if (question.isHard) {
        headerEl.classList.add("question-hard-header");
      } else {
        headerEl.classList.remove("question-hard-header");
      }
    }

    // Update content wrapper styling for hard questions
    const contentWrapper = document.querySelector(
      ".question-presentation-content",
    );
    if (contentWrapper) {
      if (question.isHard) {
        contentWrapper.classList.add("question-hard-content");
      } else {
        contentWrapper.classList.remove("question-hard-content");
      }
    }

    // Update content
    const bodyEl = document.getElementById("question-presentation-body");
    if (bodyEl) {
      bodyEl.scrollTop = 0;
      bodyEl.innerHTML = question.content;
      bodyEl.scrollTop = 0;
      requestAnimationFrame(() => {
        bodyEl.scrollTop = 0;
      });

      // Remove presentation trigger button if it was cloned into the modal
      const triggerButton = bodyEl.querySelector(
        ".question-presentation-trigger",
      );
      if (triggerButton) {
        triggerButton.remove();
      }

      // Re-initialize components that need to be re-rendered
      // Re-initialize info cards first (they need to be converted from .info-card-auto)
      const infoCardPlaceholders = bodyEl.querySelectorAll(".info-card-auto");
      if (infoCardPlaceholders.length > 0 && window.infoCards) {
        infoCardPlaceholders.forEach((placeholder) => {
          const type = placeholder.dataset.type || "definition";
          const title = placeholder.dataset.title || "";
          const content = placeholder.innerHTML.trim();

          const card = document.createElement("div");
          card.className = `info-card ${type}`;
          card.innerHTML = `
            <div class="info-icon"></div>
            <div class="info-content">
              <div class="info-title">${title}</div>
              ${content}
            </div>
          `;
          placeholder.replaceWith(card);
        });
      }

      // Re-render KaTeX formulas
      if (window.renderMathInElement) {
        renderMathInElement(bodyEl, {
          delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "\\[", right: "\\]", display: true },
            { left: "$", right: "$", display: false },
            { left: "\\(", right: "\\)", display: false },
          ],
          throwOnError: false,
        });
      }

      // Re-initialize term tooltips in the modal (content is cloned, new nodes have no listeners)
      if (typeof window.initTermTooltips === "function") {
        window.initTermTooltips(bodyEl);
      }

      // Process code blocks with syntax highlighting
      // Wait a bit to ensure inlineCodeHighlighter is initialized
      setTimeout(() => {
        const codeBlocks = bodyEl.querySelectorAll(".code-block");
        if (codeBlocks.length > 0) {
          // Ensure inlineCodeHighlighter is available
          if (!window.inlineCodeHighlighter && window.InlineCodeHighlighter) {
            window.inlineCodeHighlighter = new window.InlineCodeHighlighter();
          }

          if (
            window.inlineCodeHighlighter &&
            typeof window.inlineCodeHighlighter.processCodeBlock === "function"
          ) {
            codeBlocks.forEach((block) => {
              // Check if already processed (has code-container or code-header)
              const hasContainer = block.querySelector(".code-container");
              const hasHeader = block.querySelector(".code-header");

              if (!hasContainer && !hasHeader) {
                // Not processed yet, process it
                try {
                  // Get original code before processing
                  const originalCode = block.textContent || block.innerText;
                  const dataLang = block.getAttribute("data-lang");

                  // Process the block
                  window.inlineCodeHighlighter.processCodeBlock(block);
                } catch (error) {
                  // If processing fails, preserve the code as-is
                }
              } else {
                // Already processed, but might need to re-process for modal
                // Check if it's a cloned processed block that needs re-initialization
                const codeContainer = block.querySelector(".code-container");
                if (codeContainer) {
                  // Re-initialize copy button and other interactive elements
                  const copyBtn = codeContainer.querySelector(".copy-btn");
                  if (copyBtn) {
                    const codeContent =
                      codeContainer.querySelector(".code-content");
                    if (codeContent) {
                      const codeText =
                        codeContent.textContent || codeContent.innerText;
                      // Re-attach copy functionality
                      copyBtn.onclick = () => {
                        navigator.clipboard.writeText(codeText).then(() => {
                          copyBtn.textContent = `✓ ${t("Скопировано")}`;
                          setTimeout(() => {
                            copyBtn.textContent = "Copy";
                          }, 2000);
                        });
                      };
                    }
                  }
                }
              }
            });
          }
        }
      }, 150);

      // Add difficulty rating and progress tracking UI
      addQuestionControls(bodyEl, question);

      // Update difficulty display after a short delay to ensure it's synced
      if (question.nameId && window.difficultyRating) {
        setTimeout(() => {
          const modalContainer = bodyEl.querySelector(
            ".question-difficulty-container",
          );
          if (modalContainer) {
            updateDifficultyDisplayInModal(modalContainer, question.nameId);
          }
          // Also trigger original update to sync both
          if (
            typeof window.difficultyRating.updateDifficultyDisplay ===
            "function"
          ) {
            window.difficultyRating.updateDifficultyDisplay(question.nameId);
          }
        }, 200);
      }
    }

    // Update navigation buttons
    const prevBtn = document.getElementById("question-presentation-prev");
    const nextBtn = document.getElementById("question-presentation-next");

    if (prevBtn) {
      prevBtn.disabled = currentQuestionIndex === 0;
      prevBtn.style.opacity = currentQuestionIndex === 0 ? "0.5" : "1";
    }

    if (nextBtn) {
      nextBtn.disabled = currentQuestionIndex === questions.length - 1;
      nextBtn.style.opacity =
        currentQuestionIndex === questions.length - 1 ? "0.5" : "1";
    }

    renderSlideMenu();
  }

  /**
   * Add difficulty rating and progress controls to question in modal
   */
  function addQuestionControls(bodyEl, question) {
    if (!question.nameId) return;

    const questionId = question.nameId;

    // Check if controls already exist
    if (bodyEl.querySelector(".question-difficulty-container")) {
      return;
    }

    // Create a wrapper for controls
    const controlsWrapper = document.createElement("div");
    controlsWrapper.className = "question-presentation-controls-wrapper";

    // Add difficulty rating if available
    if (
      window.difficultyRating &&
      typeof window.difficultyRating.addDifficultyRatingUI === "function"
    ) {
      // Use the original question element if available, otherwise create a temporary one
      const questionElement =
        question.originalElement ||
        document.querySelector(`#${questionId}`)?.closest(".question");

      if (questionElement) {
        // Check if difficulty rating already exists on the original element
        let difficultyContainer = questionElement.querySelector(
          ".question-difficulty-container",
        );

        if (!difficultyContainer) {
          // Add difficulty rating UI to original element
          window.difficultyRating.addDifficultyRatingUI(
            questionElement,
            questionId,
          );
          difficultyContainer = questionElement.querySelector(
            ".question-difficulty-container",
          );
        }

        if (difficultyContainer) {
          // Clone the difficulty container for the modal
          const clonedContainer = difficultyContainer.cloneNode(true);

          // Re-attach event listeners for the cloned container
          const progressBtn = clonedContainer.querySelector(
            ".difficulty-progress-btn",
          );
          if (progressBtn && window.questionProgressTracker) {
            progressBtn.addEventListener("click", async (e) => {
              e.stopPropagation();
              const newState =
                !window.questionProgressTracker.isQuestionCompleted(questionId);
              await window.questionProgressTracker.markQuestionCompleted(
                questionId,
                newState,
              );
              window.questionProgressTracker.updateQuestionVisualState(
                questionElement,
                newState,
              );
              if (
                window.difficultyRating &&
                typeof window.difficultyRating.updateProgressButtonState ===
                  "function"
              ) {
                window.difficultyRating.updateProgressButtonState(
                  progressBtn,
                  newState,
                );
              }
              window.questionProgressTracker.updateUI();
              // Update the button in modal
              updateProgressButtonInModal(progressBtn, newState);
            });
          }

          // Re-attach star click listeners
          const stars = clonedContainer.querySelectorAll(
            ".difficulty-star[data-rating]",
          );
          stars.forEach((star) => {
            star.addEventListener("click", async (e) => {
              e.stopPropagation();
              const rating = parseInt(star.dataset.rating);
              if (window.difficultyRating) {
                await window.difficultyRating.rateQuestionDifficulty(
                  questionId,
                  rating,
                );
                // Update display in both original and modal
                setTimeout(() => {
                  if (
                    window.difficultyRating &&
                    typeof window.difficultyRating.updateDifficultyDisplay ===
                      "function"
                  ) {
                    window.difficultyRating.updateDifficultyDisplay(questionId);
                  }
                  // Also update the cloned container in modal
                  updateDifficultyDisplayInModal(clonedContainer, questionId);
                }, 150);
              }
            });
          });

          // Кнопка «В тексте ошибка?» вешает обработчик на оригинал — клон
          // его не копирует, поэтому пересылаем клик туда.
          // «Свернуть тему» на слайде сворачивать нечего.
          clonedContainer.querySelector(".question-collapse-footer")?.remove();
          const forwardSelector = ".question-report-btn";
          const originals =
            difficultyContainer.querySelectorAll(forwardSelector);
          clonedContainer
            .querySelectorAll(forwardSelector)
            .forEach((button, index) => {
              button.addEventListener("click", (e) => {
                e.stopPropagation();
                button.closest("details")?.removeAttribute("open");
                originals[index]?.click();
              });
            });

          controlsWrapper.appendChild(clonedContainer);
        }
      }
    }

    // Append controls to body
    if (controlsWrapper.children.length > 0) {
      bodyEl.appendChild(controlsWrapper);

      // Update difficulty display if available
      if (
        window.difficultyRating &&
        typeof window.difficultyRating.updateDifficultyDisplay === "function"
      ) {
        setTimeout(() => {
          window.difficultyRating.updateDifficultyDisplay(questionId);
          // Also update the cloned container in modal
          const modalContainer = bodyEl.querySelector(
            ".question-difficulty-container",
          );
          if (modalContainer) {
            updateDifficultyDisplayInModal(modalContainer, questionId);
          }
        }, 100);
      }
    }
  }

  /**
   * Update difficulty display in modal container
   */
  function updateDifficultyDisplayInModal(container, questionId) {
    if (!window.difficultyRating || !container) return;

    const starsFill = container.querySelector(".stars-track .stars-fill");
    const averageDisplay = container.querySelector(".difficulty-average");
    const userRatingDisplay = container.querySelector(
      ".difficulty-user-rating",
    );
    const progressBtn = container.querySelector(".difficulty-progress-btn");

    // Get rating data from difficultyRating component
    const userRating = window.difficultyRating.getUserRating
      ? window.difficultyRating.getUserRating(questionId)
      : null;
    // Update stars fill with only the current student's own rating.
    if (starsFill) {
      const safeUserRating = Math.max(0, Math.min(5, Number(userRating) || 0));
      const percent = (safeUserRating / 5) * 100;
      starsFill.style.width = `${percent}%`;
    }

    // Hide aggregate stats from students.
    if (averageDisplay) {
      averageDisplay.textContent = "";
      averageDisplay.style.display = "none";
    }

    // Update user rating display
    if (userRatingDisplay) {
      if (userRating) {
        userRatingDisplay.textContent = t(
          "Ваша оценка: {rating} (нажми еще раз для отмены)",
          { rating: userRating },
        );
        userRatingDisplay.style.display = "block";
      } else {
        userRatingDisplay.style.display = "none";
      }
    }

    // Update progress button
    if (progressBtn && window.questionProgressTracker) {
      const isCompleted =
        window.questionProgressTracker.isQuestionCompleted(questionId);
      updateProgressButtonInModal(progressBtn, isCompleted);
    }

    // Update active star state in stars-base
    const starsBase = container.querySelector(".stars-base");
    if (starsBase && userRating) {
      const baseStars = starsBase.querySelectorAll(
        ".difficulty-star[data-rating]",
      );
      baseStars.forEach((star) => {
        const starRating = parseInt(star.dataset.rating);
        if (starRating <= userRating) {
          star.classList.add("active");
        } else {
          star.classList.remove("active");
        }
      });
    }
  }

  /**
   * Update progress button state in modal
   */
  function updateProgressButtonInModal(btn, isCompleted) {
    if (isCompleted) {
      btn.classList.add("completed");
      btn.innerHTML = '<span class="progress-icon">✓</span>' + t("Прочитано");
    } else {
      btn.classList.remove("completed");
      btn.innerHTML = '<span class="progress-icon">✓</span>' + t("Прочитано");
    }
  }

  /**
   * Setup keyboard navigation
   */
  function setupKeyboardNavigation() {
    document.addEventListener("keydown", (e) => {
      if (!isOpen) return;
      // Поверх слайда открываются окно замечания и чат: их поля и Escape
      // принадлежат им, иначе стрелки листали бы слайды при наборе текста.
      if (
        e.target.closest?.(
          "input, textarea, select, [contenteditable], .question-report-modal, #ml-chat-window, #ml-chat-fullscreen-modal",
        )
      )
        return;

      // Prevent default for navigation keys
      switch (e.key) {
        case "Escape":
          e.preventDefault();
          if (slideMenuOpen) {
            setSlideMenuOpen(false);
          } else {
            close();
          }
          break;
        case "ArrowLeft":
          e.preventDefault();
          navigate(-1);
          break;
        case "ArrowRight":
          e.preventDefault();
          navigate(1);
          break;
      }
    });
  }

  /**
   * Public API
   */
  window.QuestionPresentation = {
    open: open,
    close: close,
    navigate: navigate,
    goToQuestion: goToQuestion,
    init: init,
  };

  // Auto-initialize when DOM is ready
  let initialized = false;
  let buttonObserver = null;

  function tryInitialize() {
    if (initialized) {
      return;
    }

    // Check if questions exist
    const questionElements = document.querySelectorAll(
      "#questions > li.question",
    );
    const controls = document.querySelector(".controls");

    if (questionElements.length > 0) {
      // Questions found, initialize
      if (questions.length === 0) {
        init();
      }

      // Try to add button if controls exist
      if (controls) {
        const buttonAdded = addPresentationButton();
        if (buttonAdded) {
          initialized = true;
          // Watch for button removal and restore it
          watchForButtonRemoval(controls);
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Watch for button removal and restore it
   */
  function watchForButtonRemoval(controls) {
    if (buttonObserver) {
      buttonObserver.disconnect();
    }

    buttonObserver = new MutationObserver((mutations) => {
      const button = controls.querySelector(".question-presentation-trigger");
      if (!button && initialized) {
        // Button was removed, restore it
        setTimeout(() => {
          addPresentationButton();
        }, 100);
      }
    });

    buttonObserver.observe(controls, {
      childList: true,
      subtree: false,
    });
  }

  // Initialize when DOM is ready
  function startInitialization() {
    // Try immediately
    if (tryInitialize()) {
      return;
    }

    // If not ready, wait for DOMContentLoaded
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        setTimeout(() => {
          tryInitialize();
          setupMutationObserver();
        }, 100);
      });
    } else {
      // DOM already loaded, try with delays
      setTimeout(tryInitialize, 100);
      setTimeout(tryInitialize, 500);
      setTimeout(() => {
        tryInitialize();
        setupMutationObserver();
      }, 1000);
    }

    // Also try on window load
    window.addEventListener("load", () => {
      setTimeout(tryInitialize, 100);
    });
  }

  // Setup MutationObserver to watch for controls element
  function setupMutationObserver() {
    // Wait for body to exist
    if (!document.body) {
      setTimeout(setupMutationObserver, 100);
      return;
    }

    // Use MutationObserver to watch for controls element
    const observer = new MutationObserver((mutations) => {
      if (
        !initialized &&
        document.querySelector(".controls") &&
        document.querySelectorAll("#questions > li.question").length > 0
      ) {
        tryInitialize();
      }
    });

    // Start observing
    try {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    } catch (error) {
      // Fallback if observer fails
    }
  }

  // Start initialization
  startInitialization();

  // Also expose a manual initialization function for debugging
  window.initQuestionPresentation = function () {
    initialized = false;
    return tryInitialize();
  };
})();
