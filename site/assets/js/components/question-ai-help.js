(function () {
  "use strict";

  // Перевод интерфейса (ядро — сниппет theme-boot). В тестах под Node его нет:
  // остаётся русский текст с подставленными значениями.
  const t =
    window.t ||
    ((text, params) =>
      text.replace(/\{(\w+)\}/g, (match, key) => params?.[key] ?? match));

  if (window.__questionAiHelpInitialized) return;
  window.__questionAiHelpInitialized = true;

  let initTimer = null;
  let selectionPopover = null;
  let activeSelectionQuestion = null;
  let activeSelectedText = "";

  function getQuestionId(questionEl) {
    const nameEl = questionEl.querySelector(".name");
    return questionEl.dataset.mdId || nameEl?.id || questionEl.id || "";
  }

  function getQuestionTitle(questionEl) {
    const nameEl = questionEl.querySelector(".name");
    return (nameEl?.innerText || nameEl?.textContent || "Вопрос")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeKatex(root) {
    if (!root || !root.querySelectorAll) return;

    const processedTargets = new Set();
    root.querySelectorAll(".katex").forEach((katexEl) => {
      const annotation = katexEl.querySelector(
        'annotation[encoding="application/x-tex"]',
      );
      const tex = (annotation?.textContent || "").trim();
      if (!tex) return;

      const displayWrapper = katexEl.closest(".katex-display");
      const target =
        displayWrapper && root.contains(displayWrapper)
          ? displayWrapper
          : katexEl;
      if (processedTargets.has(target)) return;
      processedTargets.add(target);

      const delimiter = target.classList?.contains("katex-display")
        ? "$$"
        : "$";
      target.replaceWith(
        document.createTextNode(` ${delimiter}${tex}${delimiter} `),
      );
    });
  }

  function cleanText(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .replace(/\s+([,.;:!?])/g, "$1")
      .trim();
  }

  function getSelectedText(selection, range) {
    try {
      const clone = range.cloneContents();
      normalizeKatex(clone);
      const text = cleanText(clone.textContent);
      if (text) return text;
    } catch (_) {}

    return cleanText(selection?.toString());
  }

  function getQuestionText(questionEl) {
    const content = questionEl.querySelector(".content") || questionEl;
    const clone = content.cloneNode(true);
    clone.querySelectorAll("script,style,template,button").forEach((node) => {
      node.remove();
    });
    normalizeKatex(clone);
    return cleanText(clone.textContent || clone.innerText).slice(0, 2200);
  }

  function getQuestionUrl(questionEl) {
    try {
      const url = new URL(window.location.href);
      const questionId = getQuestionId(questionEl);
      if (questionId) url.hash = questionId;
      return url.toString();
    } catch (_) {
      return window.location.href;
    }
  }

  function loadScriptOnce(src) {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      return new Promise((resolve, reject) => {
        if (window.ragChat?.askWithContext) {
          resolve();
          return;
        }
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
        setTimeout(resolve, 2500);
      });
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.body.appendChild(script);
    });
  }

  async function ensureRagChat() {
    if (window.ragChat?.askWithContext) return true;

    const assetVersion = "20260809-markdown-fix";
    const cssPath = `/assets/css/rag-chat.css?v=${assetVersion}`;
    if (!document.querySelector(`link[href="${cssPath}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = cssPath;
      document.head.appendChild(link);
    }

    try {
      await loadScriptOnce(
        `/assets/js/components/rag-chat.js?v=${assetVersion}`,
      );
    } catch (error) {
      console.error("Failed to load RAG chat:", error);
    }

    return Boolean(window.ragChat?.askWithContext);
  }

  function getQuestionNeighbors(questionEl) {
    const questions = Array.from(document.querySelectorAll("li.question"));
    const index = questions.indexOf(questionEl);
    if (index < 0) return [];

    return [questions[index - 1], questions[index + 1]]
      .filter(Boolean)
      .map((item) => {
        const questionId = getQuestionId(item);
        return {
          questionId,
          title: getQuestionTitle(item),
          url: getQuestionUrl(item),
          completed: Boolean(
            window.questionProgressTracker?.isQuestionCompleted?.(questionId),
          ),
        };
      })
      .filter((topic) => topic.questionId && topic.title && topic.url);
  }

  function getLearnerProgress(questionEl) {
    const tracker = window.questionProgressTracker;
    const questionId = getQuestionId(questionEl);
    const pageQuestions = tracker?.pageQuestions || [];
    const completedOnPage = pageQuestions.filter((id) =>
      tracker?.isQuestionCompleted?.(id),
    ).length;
    return {
      currentQuestionCompleted: Boolean(
        tracker?.isQuestionCompleted?.(questionId),
      ),
      completedOnPage,
      totalOnPage: pageQuestions.length,
    };
  }

  const ACTIONS = {
    simplify: {
      label: t("Объяснить проще"),
      prompt:
        "Объясни этот вопрос простыми словами. Дай интуицию и ключевую идею.",
    },
    example: {
      label: t("Дать пример"),
      prompt: "Дай один короткий прикладной пример для текущего вопроса.",
    },
    check: {
      label: t("Проверить понимание"),
      prompt: "Задай три контрольных вопроса по текущему материалу.",
    },
    related: {
      label: t("Соседние темы"),
      prompt: "Покажи, как текущая тема связана с соседними темами.",
    },
  };

  async function askQuestion(questionEl, mode = "simplify", selectedText = "") {
    if (!questionEl) return;
    const ragReady = await ensureRagChat();
    if (!ragReady) {
      console.warn("RAG chat is not available on this page.");
      return;
    }

    const action = ACTIONS[mode] || ACTIONS.simplify;
    const neighbors = getQuestionNeighbors(questionEl);
    window.ragChat.askWithContext({
      mode,
      userPrompt: selectedText
        ? "Объясни выделенный фрагмент простыми словами. Покажи, как он связан с вопросом, и дай короткий пример."
        : action.prompt,
      selectedText: selectedText || "",
      questionId: getQuestionId(questionEl),
      questionTitle: getQuestionTitle(questionEl),
      questionText: getQuestionText(questionEl),
      pageUrl: getQuestionUrl(questionEl),
      neighbors,
      learnerProgress: getLearnerProgress(questionEl),
    });
  }

  function addQuestionButton(questionEl) {
    if (!questionEl) return;

    let section = questionEl.querySelector(".question-ai-help-section");
    let menu = questionEl.querySelector(".question-ai-help-menu");

    if (!section) {
      section = document.createElement("div");
      section.className = "question-ai-help-section";
    }

    if (!menu) {
      // Replace the previous inline action row if the page was initialized by
      // an older cached script before this one finished loading.
      section.querySelector(".question-ai-help-actions")?.remove();

      menu = document.createElement("details");
      menu.className = "question-ai-help-menu";
      const summary = document.createElement("summary");
      summary.textContent = t("Ассистент");

      const actions = document.createElement("div");
      actions.className = "question-ai-help-actions";
      Object.entries(ACTIONS).forEach(([mode, action]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "question-ai-help-btn";
        button.textContent = action.label;
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          menu.open = false;
          askQuestion(questionEl, mode);
        });
        actions.appendChild(button);
      });
      menu.append(summary, actions);
      section.appendChild(menu);
    }

    const progress = questionEl.querySelector(".question-difficulty-container");
    if (progress) {
      if (section.parentElement !== progress) {
        progress.appendChild(section);
      }
    } else if (section.parentElement !== questionEl) {
      questionEl.appendChild(section);
    }
  }

  function ensureSelectionPopover() {
    if (selectionPopover) return selectionPopover;

    selectionPopover = document.createElement("button");
    selectionPopover.type = "button";
    selectionPopover.className = "question-ai-selection-popover";
    selectionPopover.textContent = t("Объяснить");
    selectionPopover.addEventListener("mousedown", (event) => {
      event.preventDefault();
    });
    selectionPopover.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (activeSelectionQuestion && activeSelectedText) {
        askQuestion(activeSelectionQuestion, "simplify", activeSelectedText);
      }
      hideSelectionPopover();
      try {
        window.getSelection()?.removeAllRanges();
      } catch (_) {}
    });

    document.body.appendChild(selectionPopover);
    return selectionPopover;
  }

  function hideSelectionPopover() {
    activeSelectionQuestion = null;
    activeSelectedText = "";
    if (selectionPopover) {
      selectionPopover.classList.remove("is-visible");
    }
  }

  function updateSelectionPopover() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      hideSelectionPopover();
      return;
    }

    const range = selection.getRangeAt(0);
    const parentElement =
      range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
        ? range.commonAncestorContainer
        : range.commonAncestorContainer.parentElement;
    const questionEl = parentElement?.closest?.("li.question");
    if (!questionEl) {
      hideSelectionPopover();
      return;
    }

    const selectedText = getSelectedText(selection, range);
    if (selectedText.length < 3) {
      hideSelectionPopover();
      return;
    }

    const rect = range.getBoundingClientRect();
    if (!rect || (!rect.width && !rect.height)) {
      hideSelectionPopover();
      return;
    }

    activeSelectionQuestion = questionEl;
    activeSelectedText = selectedText.slice(0, 2000);

    const popover = ensureSelectionPopover();
    popover.style.left = `${Math.min(
      window.innerWidth - 150,
      Math.max(12, rect.left + rect.width / 2 - 55),
    )}px`;
    popover.style.top = `${Math.max(12, rect.top + window.scrollY - 42)}px`;
    popover.classList.add("is-visible");
  }

  function initAll() {
    document.querySelectorAll("li.question").forEach(addQuestionButton);
  }

  function scheduleInit() {
    if (initTimer) return;
    initTimer = setTimeout(() => {
      initTimer = null;
      initAll();
    }, 150);
  }

  document.addEventListener("selectionchange", () => {
    window.clearTimeout(window.__questionAiSelectionTimer);
    window.__questionAiSelectionTimer = window.setTimeout(
      updateSelectionPopover,
      80,
    );
  });
  document.addEventListener("scroll", hideSelectionPopover, true);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hideSelectionPopover();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAll);
  } else {
    initAll();
  }

  document.addEventListener("lazyQuestionsReady", scheduleInit);
  new MutationObserver(scheduleInit).observe(document.body, {
    childList: true,
    subtree: true,
  });
})();
