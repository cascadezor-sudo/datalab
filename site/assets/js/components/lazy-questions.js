/**
 * Lazy Questions Component
 * Loads question content on-demand using <template> to reduce memory
 */

(function () {
  "use strict";

  // Перевод интерфейса (ядро — сниппет theme-boot). В тестах под Node его нет:
  // остаётся русский текст с подставленными значениями.
  const t =
    window.t ||
    ((text, params) =>
      text.replace(/\{(\w+)\}/g, (match, key) => params?.[key] ?? match));

  // Prevent double initialization
  if (window.__lazyQuestionsInitialized) {
    return;
  }
  window.__lazyQuestionsInitialized = true;

  // CRITICAL: Set flag IMMEDIATELY to prevent global KaTeX rendering
  // This script must be loaded BEFORE init-head.js
  const setFlagWhenReady = () => {
    const questions = document.querySelectorAll("#questions > li.question");
    if (questions.length > 0) {
      window.__lazyQuestionsActive = true;
      console.log("Lazy loading: Activated for", questions.length, "questions");
    }
  };

  // Try immediately if DOM is already parsed
  if (document.readyState !== "loading") {
    setFlagWhenReady();
  }

  // Also try when DOM is interactive (before DOMContentLoaded)
  if (document.readyState === "loading") {
    document.addEventListener("readystatechange", () => {
      if (document.readyState === "interactive") {
        setFlagWhenReady();
      }
    });
  }

  /**
   * Add a bottom collapse control for long opened questions.
   */
  function ensureBottomCollapseControl(questionLi) {
    const nameEl = questionLi.querySelector(".name");
    const container = questionLi.querySelector(".content");
    if (!nameEl || !container) return null;

    let footer = questionLi.querySelector(".question-collapse-footer");
    let button = questionLi.querySelector(".question-collapse-bottom");

    if (!footer) {
      footer = document.createElement("div");
      footer.className = "question-collapse-footer";
    }

    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "question-collapse-bottom";
      button.innerHTML =
        '<span class="question-collapse-bottom__icon" aria-hidden="true"></span>';
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleQuestion(questionLi, { focusTitle: true });
      });
    }

    button.setAttribute("aria-controls", container.id || nameEl.id);
    button.setAttribute("aria-label", t("Свернуть тему"));
    button.setAttribute("aria-expanded", "true");
    footer.appendChild(button);

    const actionsContainer =
      questionLi.querySelector(".question-difficulty-container") || questionLi;

    if (footer.parentElement !== actionsContainer) {
      actionsContainer.appendChild(footer);
    } else if (actionsContainer.lastElementChild !== footer) {
      actionsContainer.appendChild(footer);
    }

    return button;
  }

  /**
   * Toggle question content
   */
  function toggleQuestion(questionLi, options = {}) {
    const nameEl = questionLi.querySelector(".name");
    const container = questionLi.querySelector(".content");

    if (!nameEl || !container) return;

    const questionId = nameEl.id;
    const isLoaded = nameEl.dataset.loaded === "true";
    const isVisible = container.style.display !== "none";

    // If visible, hide it
    if (isVisible) {
      container.style.display = "none";
      nameEl.dataset.expanded = "false";
      nameEl.setAttribute("aria-expanded", "false");
      if (options.focusTitle) {
        const prefersReducedMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        nameEl.focus({ preventScroll: true });
        questionLi.scrollIntoView({
          block: "start",
          behavior: prefersReducedMotion ? "auto" : "smooth",
        });
      }
      return;
    }

    // Show container
    container.style.display = "";
    nameEl.dataset.expanded = "true";
    nameEl.setAttribute("aria-expanded", "true");

    // If already loaded, just show
    if (isLoaded) {
      ensureBottomCollapseControl(questionLi);
      return;
    }

    // Load from template
    const template = document.getElementById(`tpl-${questionId}`);
    if (!template) return;

    // Insert CLEAN HTML from template (not processed DOM)
    container.innerHTML = template.innerHTML;
    nameEl.dataset.loaded = "true";

    // Render KaTeX only in this question
    if (typeof renderMathInElement === "function") {
      try {
        renderMathInElement(container, {
          delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "$", right: "$", display: false },
            { left: "\\(", right: "\\)", display: false },
            { left: "\\[", right: "\\]", display: true },
          ],
          throwOnError: false,
        });
      } catch (e) {
        console.warn("KaTeX rendering failed:", e);
      }
    }

    // Initialize info-cards for this question
    if (window.initInfoCards && typeof window.initInfoCards === "function") {
      try {
        window.initInfoCards(container);
      } catch (e) {
        console.warn("Info cards initialization failed:", e);
      }
    }

    // Автообёртка терминов из TERM_DEFINITIONS (data-term-scope) и инициализация тултипов
    if (
      document.body &&
      document.body.getAttribute("data-term-scope") &&
      window.autoWrapTermTooltips &&
      window.initTermTooltips
    ) {
      try {
        window.autoWrapTermTooltips(container, function () {
          window.initTermTooltips(container);
        });
      } catch (e) {
        console.warn("Term tooltips auto-wrap failed:", e);
      }
    }

    // Initialize code blocks with syntax highlighting
    setTimeout(() => {
      const codeBlocks = container.querySelectorAll(".code-block");
      if (codeBlocks.length > 0) {
        console.log(
          `Found ${codeBlocks.length} code blocks in question: ${questionId}`,
        );

        // Ensure inlineCodeHighlighter is available
        if (!window.inlineCodeHighlighter && window.InlineCodeHighlighter) {
          window.inlineCodeHighlighter = new window.InlineCodeHighlighter();
        }

        if (
          window.inlineCodeHighlighter &&
          typeof window.inlineCodeHighlighter.processCodeBlock === "function"
        ) {
          codeBlocks.forEach((block) => {
            // Check if already processed
            const hasContainer = block.querySelector(".code-container");
            const hasHeader = block.querySelector(".code-header");

            if (!hasContainer && !hasHeader) {
              try {
                window.inlineCodeHighlighter.processCodeBlock(block);
                console.log(`Processed code block in question: ${questionId}`);
              } catch (e) {
                console.warn("Failed to process code block:", e);
              }
            } else {
              console.log(
                `Code block already processed in question: ${questionId}`,
              );
            }
          });
        } else {
          console.warn("inlineCodeHighlighter not available yet");
        }
      }
    }, 200);

    // Reinitialize difficulty rating and progress for this question
    if (
      window.difficultyRating &&
      typeof window.difficultyRating.addDifficultyRatingUI === "function"
    ) {
      try {
        // Check if difficulty UI already exists
        if (!questionLi.querySelector(".question-difficulty-container")) {
          window.difficultyRating.addDifficultyRatingUI(questionLi, questionId);
          console.log(`Added difficulty rating to question: ${questionId}`);
        }
      } catch (e) {
        console.warn("Difficulty rating initialization failed:", e);
      }
    }

    ensureBottomCollapseControl(questionLi);

    // Reinitialize image zoom
    if (window.reinitImageZoom) {
      setTimeout(() => window.reinitImageZoom(), 100);
    }

    console.log(`Loaded question: ${questionId}`);
  }

  /**
   * Ensure a question is expanded (never collapses).
   * Exposed globally so anchor-scroll.js and questions-toc.js can call it.
   */
  window.expandQuestion = function (questionId) {
    var nameEl = document.getElementById(questionId);
    if (!nameEl) return;
    var questionLi = nameEl.closest(".question");
    if (!questionLi) return;
    var content = questionLi.querySelector(".content");
    if (content && content.style.display === "none") {
      toggleQuestion(questionLi);
    }
  };

  /**
   * Unload question content to free memory
   */
  function unloadQuestion(questionLi) {
    const nameEl = questionLi.querySelector(".name");
    const container = questionLi.querySelector(".content");

    if (!nameEl || !container) return;
    if (nameEl.dataset.loaded !== "true") return;

    // Clear DOM
    container.replaceChildren();
    nameEl.dataset.loaded = "false";

    console.log(`Unloaded question: ${nameEl.id}`);
  }

  /**
   * Initialize lazy loading
   */
  function init() {
    const questions = document.querySelectorAll("#questions > li.question");

    if (questions.length === 0) {
      return;
    }

    console.log(
      `Lazy questions: Converting ${questions.length} questions to templates (all collapsed by default)`,
    );

    // CRITICAL: Convert ALL questions to templates FIRST (before any processing)
    // This saves the original HTML before inline-code-highlighter or other scripts process it
    questions.forEach((question, index) => {
      const nameEl = question.querySelector(".name");
      const content = question.querySelector(".content");

      if (!nameEl || !content) return;

      const questionId = nameEl.id || `q-${index}`;
      nameEl.id = questionId;
      content.id = content.id || `content-${questionId}`;

      // Save original HTML to template
      const template = document.createElement("template");
      template.id = `tpl-${questionId}`;
      template.innerHTML = content.innerHTML;
      document.body.appendChild(template);

      // Mark question metadata
      nameEl.style.cursor = "pointer";
      content.dataset.questionId = questionId;

      content.innerHTML = "";
      content.style.display = "none";
      nameEl.dataset.loaded = "false";
      nameEl.dataset.expanded = "false";
      nameEl.setAttribute("role", "button");
      nameEl.setAttribute("tabindex", "0");
      nameEl.setAttribute("aria-expanded", "false");
      nameEl.setAttribute("aria-controls", content.id);
    });

    console.log(
      `Lazy questions: Saved ${questions.length} templates, all collapsed until click`,
    );

    // Render KaTeX for visible question titles when it's available
    const renderInitialKaTeX = () => {
      if (typeof renderMathInElement !== "function") {
        console.log("KaTeX not yet available, waiting...");
        return false;
      }

      // Render KaTeX for ALL question titles (they are always visible)
      questions.forEach((question, index) => {
        const nameEl = question.querySelector(".name");
        if (nameEl) {
          try {
            renderMathInElement(nameEl, {
              delimiters: [
                { left: "$$", right: "$$", display: true },
                { left: "$", right: "$", display: false },
                { left: "\\(", right: "\\)", display: false },
                { left: "\\[", right: "\\]", display: true },
              ],
              throwOnError: false,
            });
          } catch (e) {
            console.warn("KaTeX rendering failed for question title", index, e);
          }
        }
      });

      return true;
    };

    // Try to render immediately
    if (!renderInitialKaTeX()) {
      // If KaTeX not available, wait for DOMContentLoaded
      document.addEventListener("DOMContentLoaded", () => {
        setTimeout(renderInitialKaTeX, 100);
      });
    }

    // Click handler for question names
    document.addEventListener("click", (e) => {
      const nameEl = e.target.closest(".question .name");
      if (!nameEl) return;

      const questionLi = nameEl.closest(".question");
      if (questionLi) {
        toggleQuestion(questionLi);
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const nameEl = e.target.closest(".question .name");
      if (!nameEl) return;
      e.preventDefault();
      const questionLi = nameEl.closest(".question");
      if (questionLi) {
        toggleQuestion(questionLi);
      }
    });

    // Integrate with HideQuestions
    const originalHide = window.HideQuestions;
    window.HideQuestions = function () {
      if (originalHide) originalHide();

      // Unload hidden questions after delay
      setTimeout(() => {
        questions.forEach((q) => {
          const content = q.querySelector(".content");
          if (content && content.style.display === "none") {
            unloadQuestion(q);
          }
        });
      }, 1000);
    };

    console.log("Lazy questions: Initialized");

    // Notify progress tracker that lazy questions are ready
    // Dispatch custom event so progress tracker can initialize
    const event = new CustomEvent("lazyQuestionsReady", {
      detail: { questionCount: questions.length },
    });
    document.dispatchEvent(event);

    // Also call directly if already loaded
    if (
      window.questionProgressTracker &&
      window.questionProgressTracker.isInitialized
    ) {
      setTimeout(() => {
        console.log("Lazy questions: Notifying progress tracker");
        window.questionProgressTracker.addProgressToQuestions();
      }, 100);
    }
  }

  // Initialize IMMEDIATELY to save original HTML before any processing
  // CRITICAL: Must run BEFORE inline-code-highlighter's DOMContentLoaded
  // We try multiple strategies to run as early as possible:

  // Strategy 1: Try immediately (works if script is at end of body)
  const tryInit = () => {
    const questions = document.querySelectorAll("#questions > li.question");
    if (questions.length > 0) {
      init();
      return true;
    }
    return false;
  };

  // Try now
  if (tryInit()) {
    // Success!
  } else if (document.readyState === "loading") {
    // Strategy 2: Wait for interactive (before DOMContentLoaded)
    document.addEventListener("readystatechange", () => {
      if (document.readyState === "interactive") {
        tryInit();
      }
    });
  } else {
    // Strategy 3: DOM already loaded, try now
    tryInit();
  }
})();
