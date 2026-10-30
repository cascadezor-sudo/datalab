/**
 * Quiz System - Comprehensive Testing Platform
 * Интегрированная система тестирования с прогрессивным разблокированием
 */

class QuizSystem {
  constructor() {
    this.currentUser = null;
    this.db = null;
    this.firebaseConfig = null;
    this.isInitialized = false;
    this.quizRegistry = new Map();
    this.currentQuiz = null;
    this.quizResults = new Map();
  }

  /** Ensure quiz.css is loaded on pages that don't include it */
  ensureQuizStyles() {
    const href = "/assets/css/quiz.css";
    const existing = Array.from(document.styleSheets).find((s) => {
      try {
        return s.href && s.href.includes("assets/css/quiz.css");
      } catch {
        return false;
      }
    });
    if (existing) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.setAttribute("data-quiz-styles", "true");
    document.head.appendChild(link);
  }
  /**
   * Гарантирует наличие inline-code-highlighter.js на странице
   */
  ensureInlineCodeHighlighter() {
    return new Promise((resolve) => {
      if (window.inlineCodeHighlighter) {
        resolve(true);
        return;
      }
      const existing = document.querySelector(
        'script[data-inline-highlighter="true"]',
      );
      if (existing) {
        existing.addEventListener("load", () => {
          // If loaded after DOMContentLoaded, manually instantiate
          if (!window.inlineCodeHighlighter && window.InlineCodeHighlighter) {
            window.inlineCodeHighlighter = new window.InlineCodeHighlighter();
          }
          resolve(true);
        });
        existing.addEventListener("error", () => resolve(false));
        return;
      }
      const script = document.createElement("script");
      script.src = "/assets/js/components/inline-code-highlighter.js";
      script.async = true;
      script.defer = true;
      script.setAttribute("data-inline-highlighter", "true");
      script.onload = () => {
        if (!window.inlineCodeHighlighter && window.InlineCodeHighlighter) {
          window.inlineCodeHighlighter = new window.InlineCodeHighlighter();
        }
        resolve(true);
      };
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
  }

  /**
   * Экранирует HTML в тексте кода
   */
  escapeHtml(str) {
    if (typeof str !== "string") return str;
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /**
   * Рендеринг LaTeX формул, инлайн кода и блоков кода в тексте
   */
  renderLatex(text) {
    if (!text || typeof text !== "string") return text;

    // 1) Выносим тройные бэктики (блоки кода) в плейсхолдеры
    const codeBlocks = [];
    text = text.replace(/```([\s\S]*?)```/g, (_, code) => {
      const cleaned = code.trim().replace(/^([a-zA-Z0-9_-]+)\n?/, "");
      const safe = this.escapeHtml(cleaned);
      const html = `<pre class="quiz-code"><code>${safe}</code></pre>`;
      codeBlocks.push(html);
      return `__CODEBLOCK_${codeBlocks.length - 1}__`;
    });

    // 2) Выносим инлайн-код в плейсхолдеры
    const inlineBlocks = [];
    text = text.replace(/`([^`]+)`/g, (_, code) => {
      const html = `<code class="inline-code">${this.escapeHtml(code)}</code>`;
      inlineBlocks.push(html);
      return `__INLINE_${inlineBlocks.length - 1}__`;
    });

    // 3) Рендерим LaTeX ($$...$$ для display, $...$ для inline)
    if (typeof katex !== "undefined") {
      try {
        // Display mode: $$...$$
        text = text.replace(/\$\$([\s\S]+?)\$\$/g, (match, formula) => {
          try {
            return katex.renderToString(formula.trim(), {
              throwOnError: false,
              displayMode: true,
            });
          } catch (error) {
            console.warn("LaTeX rendering error (display):", error);
            return match;
          }
        });

        // Inline mode: $...$ (не захватываем пустые/пробельные и плейсхолдеры)
        text = text.replace(/\$(?!\s)([^$]+?)\$/g, (match, formula) => {
          // Пропускаем плейсхолдеры
          if (match.includes("__CODEBLOCK_") || match.includes("__INLINE_")) {
            return match;
          }
          try {
            return katex.renderToString(formula.trim(), {
              throwOnError: false,
              displayMode: false,
            });
          } catch (error) {
            console.warn("LaTeX rendering error (inline):", error);
            return match;
          }
        });
      } catch (error) {
        console.warn("LaTeX rendering error:", error);
      }
    } else {
      console.warn("KaTeX not loaded, skipping LaTeX rendering");
    }

    // 4) Возвращаем инлайн-код и код-блоки на место
    text = text.replace(/__INLINE_(\d+)__/g, (_, i) => inlineBlocks[+i] || "");
    text = text.replace(/__CODEBLOCK_(\d+)__/g, (_, i) => codeBlocks[+i] || "");

    return text;
  }

  /**
   * Рендеринг блоков кода из тройных обратных кавычек
   */
  renderCodeBlocks(text) {
    if (!text || typeof text !== "string") return text;

    // Безопасная обертка: убираем возможный заголовок языка и экранируем
    return text.replace(/```([\s\S]*?)```/g, (match, code) => {
      const cleaned = code.trim().replace(/^python\n?/i, "");
      const safe = this.escapeHtml(cleaned);
      return `<pre class="quiz-code"><code>${safe}</code></pre>`;
    });
  }

  /**
   * Рендеринг инлайн кода из обратных кавычек
   */
  renderInlineCode(text) {
    if (!text || typeof text !== "string") return text;

    // Безопасная инлайн-обертка
    return text.replace(
      /`([^`]+)`/g,
      (_, code) => `<code class="inline-code">${this.escapeHtml(code)}</code>`,
    );
  }

  /**
   * Инициализация системы тестов
   */
  async initialize(firebaseConfig) {
    try {
      this.firebaseConfig = firebaseConfig;

      // Инициализация Firebase если еще не сделано
      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }

      this.db = firebase.database();

      // Слушаем изменения состояния аутентификации
      firebase.auth().onAuthStateChanged(async (user) => {
        this.currentUser = user;
        if (user) {
          await this.loadUserQuizResults();
        } else {
          this.loadAnonymousQuizResults();
        }

        // Обновляем UI после изменения состояния аутентификации
        if (this.isInitialized) {
          this.renderQuizCatalog("quiz-catalog");
          // Обновляем статистику если функция доступна
          if (typeof updateQuizStats === "function") {
            updateQuizStats();
          }
        }
      });

      // Загружаем реестр тестов
      await this.loadQuizRegistry();

      this.isInitialized = true;

      // Автоинициализация UI
      await this.initializeUI();
    } catch (error) {
      console.error("Failed to initialize Quiz System:", error);
      await this.loadQuizRegistry();
      this.isInitialized = true;
      this.loadAnonymousQuizResults();
      await this.initializeUI();
    }
  }

  /**
   * Загрузка реестра тестов
   */
  async loadQuizRegistry({ bypassCache = false } = {}) {
    if (this._registryLoadPromise && !bypassCache) {
      return this._registryLoadPromise;
    }

    const loadPromise = (async () => {
      const url = bypassCache
        ? `/assets/data/quizzes/registry.json?v=${Date.now()}`
        : "/assets/data/quizzes/registry.json";

      try {
        const response = await fetch(url, { cache: "no-store" });
        if (response.ok) {
          const registry = await response.json();
          if (window.i18n?.lang === "en") {
            const en = await fetch("/assets/data/quizzes/registry.en.json")
              .then((r) => (r.ok ? r.json() : {}))
              .catch(() => ({}));
            for (const [id, text] of Object.entries(en)) {
              if (registry[id]) Object.assign(registry[id], text);
            }
          }
          this.quizRegistry = new Map(Object.entries(registry));
          this._registryFromFallback = false;
          return;
        }
        console.warn(`Quiz registry fetch failed: HTTP ${response.status}`);
      } catch (error) {
        console.error("Failed to load quiz registry:", error);
      }

      if (!this._registryFromFallback || this.quizRegistry.size === 0) {
        this.createFallbackRegistry();
        this._registryFromFallback = true;
      }
    })();

    if (!bypassCache) {
      this._registryLoadPromise = loadPromise;
    }

    return loadPromise;
  }

  /**
   * Файл теста на языке интерфейса. Английский перевод лежит рядом
   * (`<file>.en.json`) с теми же id вопросов и порядком вариантов: сервер
   * проверяет ответы по индексам из русского файла. Нет перевода — русский.
   */
  async fetchQuizFile(quizInfo) {
    const url = `/assets/data/quizzes/${quizInfo.file}`;
    if (window.i18n?.lang === "en") {
      try {
        const en = await fetch(url.replace(/\.json$/, ".en.json"));
        if (en.ok) return en;
      } catch (error) {
        console.warn("English quiz file unavailable:", error);
      }
    }
    return fetch(url);
  }

  async ensureRegistryLoaded(quizId) {
    await this.loadQuizRegistry();

    const normalizedQuizId = String(quizId || "").trim();
    if (normalizedQuizId && !this.quizRegistry.has(normalizedQuizId)) {
      await this.loadQuizRegistry({ bypassCache: true });
    }
  }

  /**
   * Создание fallback реестра тестов
   */
  createFallbackRegistry() {
    this.quizRegistry = new Map([
      [
        "deep-learning:intro",
        {
          id: "deep-learning:intro",
          title: "Введение в Deep Learning",
          description: "Проверьте свои знания основ глубокого обучения",
          file: "deep-learning-intro.json",
          category: "ml_dl",
          unlockType: "all-questions",
          timeLimit: 600,
        },
      ],
      [
        "python:basics",
        {
          id: "python:basics",
          title: "Основы Python",
          description: "Тест по базовым концепциям Python",
          file: "python-base.json",
          category: "python",
          unlockType: "all-questions",
          timeLimit: 1200,
        },
      ],
      [
        "math:calculus",
        {
          id: "math:calculus",
          title: "Математический анализ",
          description: "Проверка знаний основ математического анализа",
          file: "math-calculus.json",
          category: "math",
          unlockType: "all-questions",
          timeLimit: 720,
        },
      ],
      [
        "linux:basics",
        {
          id: "linux:basics",
          title: "Linux Basics",
          description: "Тест по Linux для ML-инженеров",
          file: "linux-basics.json",
          category: "linux",
          unlockType: "all-questions",
          timeLimit: 900,
        },
      ],
    ]);
  }

  /**
   * Загрузка теста по ID
   */
  async loadQuiz(quizId) {
    try {
      await this.ensureRegistryLoaded(quizId);
      const quizInfo = this.quizRegistry.get(quizId);
      if (!quizInfo) {
        throw new Error(`Quiz ${quizId} not found in registry`);
      }

      const response = await this.fetchQuizFile(quizInfo);
      if (!response.ok) {
        throw new Error(`Failed to load quiz file: ${response.status}`);
      }

      const quizData = await response.json();

      // Валидация структуры теста
      this.validateQuizStructure(quizData);

      // Объединяем данные из реестра с данными из файла
      // Примечание: questionsCount из реестра игнорируется, используется автоматический подсчет из JSON
      const mergedQuiz = {
        ...quizInfo,
        ...quizData,
        id: quizId,
      };

      return {
        ...mergedQuiz,
        threshold: this.getQuizThreshold(mergedQuiz),
        timeLimit: this.getQuizTimeLimit(mergedQuiz),
        // Всегда автоматически определяем количество вопросов из файла (игнорируем questionsCount из реестра)
        questionsCount: quizData.items ? quizData.items.length : 0,
      };
    } catch (error) {
      console.error(`Failed to load quiz ${quizId}:`, error);
      throw error;
    }
  }

  /**
   * Валидация структуры теста
   */
  validateQuizStructure(quiz) {
    const requiredFields = ["id", "title", "items"];
    const requiredItemFields = ["id", "type", "q", "options", "answer"];

    for (const field of requiredFields) {
      if (!quiz[field]) {
        throw new Error(`Quiz missing required field: ${field}`);
      }
    }

    if (!Array.isArray(quiz.items) || quiz.items.length === 0) {
      throw new Error("Quiz must have at least one question");
    }

    for (const item of quiz.items) {
      for (const field of requiredItemFields) {
        if (!item[field]) {
          throw new Error(
            `Question ${item.id} missing required field: ${field}`,
          );
        }
      }

      if (!Array.isArray(item.options) || item.options.length === 0) {
        throw new Error(`Question ${item.id} must have at least one option`);
      }

      if (!Array.isArray(item.answer) || item.answer.length === 0) {
        throw new Error(
          `Question ${item.id} must have at least one correct answer`,
        );
      }
    }
  }

  /**
   * Получение прогресса страницы
   */
  getPageProgress() {
    // Пытаемся использовать существующий трекер прогресса
    if (
      window.questionProgressTracker &&
      window.questionProgressTracker.isInitialized
    ) {
      const percentage =
        window.questionProgressTracker.getPageCompletionPercentage();
      const completedCount =
        window.questionProgressTracker.pageQuestions.filter((id) =>
          window.questionProgressTracker.isQuestionCompleted(id),
        ).length;
      const totalCount = window.questionProgressTracker.pageQuestions.length;

      return {
        done: completedCount,
        total: totalCount,
        ratio: percentage / 100,
      };
    }

    // Fallback - считаем DOM элементы
    const questionElements = document.querySelectorAll(
      "ol#questions > li.question",
    );
    if (questionElements.length === 0) {
      return { done: 0, total: 0, ratio: 0 };
    }

    const completedElements = Array.from(questionElements).filter(
      (li) =>
        li.classList.contains("question-completed") ||
        li.querySelector('input[type="checkbox"]:checked') ||
        li.getAttribute("data-completed") === "true",
    );

    return {
      done: completedElements.length,
      total: questionElements.length,
      ratio: questionElements.length
        ? completedElements.length / questionElements.length
        : 0,
    };
  }

  /**
   * Проверка доступности теста
   */
  isQuizUnlocked(quizInfo) {
    const { unlockType } = quizInfo;
    const threshold = this.getQuizThreshold(quizInfo);
    console.log(`[quiz] isQuizUnlocked(${quizInfo.id})`, {
      unlockType,
      threshold,
    });

    // 1. Всегда доступны тесты с unlockType: 'always'
    if (unlockType === "always") {
      console.log(`[quiz] Unlocked: always`);
      return true;
    }

    // 2. Уже пройдены (есть результаты теста)
    const lastResult = this.getLastQuizResult(quizInfo.id);
    if (lastResult) {
      console.log(`[quiz] Unlocked: already completed`);
      return true;
    }

    // 3. Проверяем прогресс по соответствующей странице курса из Firebase/localStorage
    const pageProgress = this.getPageProgressForQuiz(quizInfo.id);
    console.log(`[quiz] Page progress:`, pageProgress);
    if (pageProgress && pageProgress.ratio >= 1.0) {
      console.log(
        `[quiz] Unlocked: page completed (ratio=${pageProgress.ratio})`,
      );
      return true;
    }

    // 4. Если нет данных в Firebase, проверяем локальный прогресс на текущей странице
    // (Это нужно для обратной совместимости и отображения на страницах с вопросами)
    const { ratio, done, total } = this.getPageProgress();
    console.log(`[quiz] Local progress:`, { ratio, done, total });

    switch (unlockType) {
      case "all-questions":
        console.log(`[quiz] Check: all-questions, ratio=${ratio}`);
        return ratio >= 1.0;
      case "percent":
        console.log(`[quiz] Check: percent (>=${threshold}), ratio=${ratio}`);
        return ratio >= threshold;
      default:
        console.log(`[quiz] Locked: no unlock condition met`);
        return false; // Если нет данных, тест заблокирован
    }
  }

  /**
   * Сохранение информации о завершении страницы для конкретного квиза
   * @param {string} quizId - ID квиза
   * @param {number} totalQuestions - Количество вопросов на странице
   */
  savePageCompletion(quizId, totalQuestions) {
    // Сохраняем в Firebase и localStorage
    const completionData = {
      completed: true,
      totalQuestions: totalQuestions,
      timestamp: Date.now(),
    };

    // Сохраняем в Firebase для авторизованных пользователей
    if (this.currentUser && this.db) {
      try {
        this.db
          .ref(`users/${this.currentUser.uid}/pageCompletion/${quizId}`)
          .set(completionData);
      } catch (error) {
        console.error("Failed to save page completion to Firebase:", error);
      }
    }

    // Также сохраняем в localStorage для быстрого доступа
    try {
      const storageKey = this.currentUser
        ? `page_completion_${this.currentUser.uid}`
        : "page_completion_anonymous";

      const stored = localStorage.getItem(storageKey);
      const pageCompletionData = stored ? JSON.parse(stored) : {};

      pageCompletionData[quizId] = completionData;
      localStorage.setItem(storageKey, JSON.stringify(pageCompletionData));
    } catch (error) {
      console.error("Failed to save page completion to localStorage:", error);
    }
  }

  /**
   * Получение прогресса по странице для конкретного теста
   * @param {string} quizId - ID теста
   * @returns {Object|null} - Прогресс по странице или null
   */
  getPageProgressForQuiz(quizId) {
    // Проверяем, есть ли сохраненная информация о завершении страницы
    let pageCompletionData = {};

    // Пытаемся загрузить из localStorage (быстрый доступ)
    try {
      const storageKey = this.currentUser
        ? `page_completion_${this.currentUser.uid}`
        : "page_completion_anonymous";

      const stored = localStorage.getItem(storageKey);
      pageCompletionData = stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error("Failed to load page completion from localStorage:", error);
    }

    const completion = pageCompletionData[quizId];
    console.log(`[quiz] getPageProgressForQuiz(${quizId}):`, {
      found: !!completion,
      data: completion,
      allCompletions: Object.keys(pageCompletionData),
    });

    if (completion && completion.completed) {
      return {
        done: completion.totalQuestions || 0,
        total: completion.totalQuestions || 0,
        ratio: 1.0,
      };
    }

    return null;
  }

  /**
   * Идентификатор попытки: один на все повторы отправки.
   *
   * Сервер дедуплицирует по нему (`quiz-scoring.js`,
   * `appendQuizAttemptOnce`), поэтому повторная отправка после обрыва не
   * создаёт вторую строку в истории.
   */
  newAttemptRequestId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `quiz-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  /**
   * Сохранение результата теста
   */
  async saveQuizResult(quizId, result, requestId) {
    const resultData = {
      ...result,
      quizId,
      timestamp: Date.now(),
      userId: this.currentUser ? this.currentUser.uid : "anonymous",
    };

    // Сохранение только в Firebase (требуется авторизация)
    if (this.currentUser && this.db) {
      try {
        if (!window.achievementApi)
          throw new Error("Achievement API is not loaded");
        const saved = await window.achievementApi.submitQuizAttempt({
          quizId,
          answers: resultData.answers || {},
          answerFormat: resultData.answerFormat,
          timeSpent: resultData.timeSpent,
          timedOut: resultData.timedOut === true,
          ...(requestId ? { requestId } : {}),
        });
        Object.assign(resultData, saved.result);
        window.walletUi?.showCredit(saved.wallet);

        // Обновляем локальный кеш после успешного сохранения
        const results = this.quizResults.get(quizId) || [];
        results.push(resultData);
        this.quizResults.set(quizId, results);
      } catch (error) {
        console.error("Failed to save quiz result to Firebase:", error);
        throw error; // Прокидываем ошибку выше
      }
    } else {
      console.warn("User not authenticated - quiz results will not be saved");
      throw new Error("Authentication required to save quiz results");
    }

    // Отправка события для геймификации
    this.dispatchGamificationEvent(quizId, resultData);
  }

  /**
   * Отправка события для системы геймификации
   */
  dispatchGamificationEvent(quizId, resultData) {
    const event = new CustomEvent("gamification:quiz-finished", {
      detail: {
        quizId,
        result: resultData,
        score: resultData.score,
        correctAnswers: resultData.correct,
        totalQuestions: resultData.total,
      },
    });
    document.dispatchEvent(event);
  }

  /**
   * Загрузка результатов тестов пользователя
   */
  async loadUserQuizResults() {
    if (!this.currentUser || !this.db) return;

    try {
      if (window.achievementApi?.repairOfflineQuizResults) {
        await window.achievementApi.repairOfflineQuizResults();
      }
      const snapshot = await this.db
        .ref(`users/${this.currentUser.uid}/quizResults`)
        .once("value");
      const results = snapshot.val() || {};

      // Преобразуем в Map для быстрого доступа
      this.quizResults = new Map();
      Object.entries(results).forEach(([quizId, quizResults]) => {
        this.quizResults.set(quizId, Object.values(quizResults));
      });
    } catch (error) {
      console.error("Failed to load user quiz results:", error);
    }
  }

  /**
   * Загрузка результатов для анонимных пользователей
   * Теперь ничего не делаем - требуем авторизацию для тестов
   */
  loadAnonymousQuizResults() {
    this.quizResults = new Map();
    // Не загружаем из localStorage - только Firebase
  }

  /**
   * Получение последнего результата теста
   */
  getLastQuizResult(quizId) {
    const results = this.quizResults.get(quizId) || [];
    return results.length > 0 ? results[results.length - 1] : null;
  }

  /**
   * Получение лучшего результата теста
   */
  getBestQuizResult(quizId) {
    const results = this.quizResults.get(quizId) || [];
    if (results.length === 0) return null;

    return results.reduce((best, current) =>
      current.score > best.score ? current : best,
    );
  }

  /**
   * Получение лучшей сданной попытки теста.
   */
  getBestPassingQuizResult(quizId, threshold) {
    const results = this.quizResults.get(quizId) || [];
    const passingResults = results.filter((result) =>
      this.isPassingResult(result, threshold),
    );
    if (passingResults.length === 0) return null;

    return passingResults.reduce((best, current) =>
      current.score > best.score ? current : best,
    );
  }

  /**
   * Проверка сдачи теста с обратной совместимостью для старых результатов без поля passed.
   */
  isPassingResult(result, threshold) {
    if (!result) return false;
    if (typeof result.passed === "boolean") return result.passed;
    return Number(result.score || 0) >= threshold;
  }

  /**
   * Проходной порог берётся из JSON теста; fallback оставлен для старых записей registry.
   */
  getQuizThreshold(quizInfo) {
    const threshold = Number(quizInfo.threshold);
    return Number.isFinite(threshold) ? threshold : 0.8;
  }

  /**
   * Лимит времени в секундах. Основной источник — timeLimitSec в JSON теста.
   */
  getQuizTimeLimit(quizInfo) {
    const timeLimitSec = Number(quizInfo.timeLimitSec);
    if (Number.isFinite(timeLimitSec) && timeLimitSec > 0) return timeLimitSec;

    const timeLimit = Number(quizInfo.timeLimit);
    if (Number.isFinite(timeLimit) && timeLimit > 0) return timeLimit;

    return 600;
  }

  /**
   * Форматирование секунд как M:SS.
   */
  formatTime(seconds) {
    const safeSeconds = Math.max(0, Math.floor(seconds));
    return `${Math.floor(safeSeconds / 60)}:${(safeSeconds % 60).toString().padStart(2, "0")}`;
  }

  /**
   * Получение количества попыток теста
   */
  getQuizAttemptsCount(quizId) {
    const results = this.quizResults.get(quizId) || [];
    return results.length;
  }

  /**
   * Итоговый статус теста для карточек и каталога.
   */
  getQuizStatus(quizInfo, isUnlocked = this.isQuizUnlocked(quizInfo)) {
    if (!isUnlocked) {
      return {
        className: "locked",
        filterValue: "locked",
        label: t("Заблокирован"),
      };
    }

    const threshold = this.getQuizThreshold(quizInfo);
    const bestPassingResult = this.getBestPassingQuizResult(
      quizInfo.id,
      threshold,
    );
    if (bestPassingResult) {
      return {
        className: "completed",
        filterValue: "passed",
        label: t("Сдан"),
      };
    }

    if (this.getQuizAttemptsCount(quizInfo.id) > 0) {
      return {
        className: "not-passed",
        filterValue: "not-passed",
        label: t("Не сдан"),
      };
    }

    return {
      className: "not-started",
      filterValue: "not-started",
      label: t("Не приступал"),
    };
  }

  /**
   * Рендеринг карточки входа в тест с кешированием
   */
  async renderQuizEntry(element) {
    // Принудительно очищаем кеш для обновления стилей и данных
    element.dataset.lastState = "";
    element.dataset.version = "2025-01-27-v2";

    const quizId = String(element.dataset.quizId || "").trim();
    if (!quizId) return;

    await this.ensureRegistryLoaded(quizId);

    const quizInfo = this.quizRegistry.get(quizId);

    if (!quizInfo) {
      console.error(
        `Quiz ${quizId} not found in registry (${this.quizRegistry.size} entries${this._registryFromFallback ? ", fallback" : ""})`,
      );
      return;
    }

    // Асинхронно загружаем количество вопросов
    let questionsCount = 0;
    let quizConfig = quizInfo;
    try {
      const response = await this.fetchQuizFile(quizInfo);
      if (response.ok) {
        const quizData = await response.json();
        quizConfig = {
          ...quizInfo,
          ...quizData,
          id: quizInfo.id,
          threshold: this.getQuizThreshold({ ...quizInfo, ...quizData }),
          timeLimit: this.getQuizTimeLimit({ ...quizInfo, ...quizData }),
        };
        questionsCount = quizData.items ? quizData.items.length : 0;
      }
    } catch (error) {
      console.warn(`Failed to load questions count for ${quizId}:`, error);
    }
    quizConfig = {
      ...quizConfig,
      threshold: this.getQuizThreshold(quizConfig),
      timeLimit: this.getQuizTimeLimit(quizConfig),
    };

    const { ratio, done, total } = this.getPageProgress();

    // ВАЖНО: Проверяем и сохраняем завершение страницы ДО проверки кеша
    // Это нужно, чтобы при первой загрузке страницы с 100% прогрессом тест разблокировался
    if (ratio >= 1.0 && total > 0) {
      const existingCompletion = this.getPageProgressForQuiz(quizId);
      if (!existingCompletion) {
        // Если завершение еще не сохранено, сохраняем его
        this.savePageCompletion(quizId, total);
      }
    }

    const threshold = this.getQuizThreshold(quizConfig);
    const isUnlocked = this.isQuizUnlocked(quizConfig);
    const lastResult = this.getLastQuizResult(quizId);
    const bestResult = this.getBestQuizResult(quizId);
    const bestPassingResult = this.getBestPassingQuizResult(quizId, threshold);
    const attemptsCount = this.getQuizAttemptsCount(quizId);
    const progressPercentage = Math.round(ratio * 100);
    const quizStatus = this.getQuizStatus(quizConfig, isUnlocked);
    const statusClass = quizStatus.className;
    const buttonClass = isUnlocked ? "primary" : "";
    const buttonText = isUnlocked ? t("Начать тест") : t("Заблокировано");

    // Проверяем, является ли результат идеальным (100%)
    // Используем bestResult вместо lastResult для определения стиля
    // bestResult.score от 0 до 1, поэтому проверяем >= 0.99
    const isPerfectScore = bestResult && bestResult.score >= 0.99;
    const perfectClass = isPerfectScore ? "perfect-score" : "";

    // Кешируем состояние для избежания лишних перерендеров
    const currentState = `${quizId}-${isUnlocked}-${progressPercentage}-${bestResult ? bestResult.score : "none"}-${bestPassingResult ? bestPassingResult.score : "none"}-${attemptsCount}-${isPerfectScore}-${threshold}-${quizConfig.timeLimit}`;
    if (element.dataset.lastState === currentState) {
      return; // Состояние не изменилось, пропускаем рендер
    }

    element.dataset.lastState = currentState;

    // Тест блока (block-tests.js): прогресс по всей странице и категория к нему не относятся
    const isBlockTest = Boolean(quizConfig.block);

    element.innerHTML = `
      <div class="quiz-entry-heading">
        <span class="quiz-entry-kicker">${isBlockTest ? t("Тест блока {n}", { n: quizConfig.block }) : t("Контрольный тест")}</span>
        <h2>${isBlockTest ? t("Проверьте себя по блоку") : t("Проверьте понимание темы")}</h2>
      </div>
      <div class="quiz-card ${statusClass} ${perfectClass}" data-category="${quizConfig.category || "default"}">
        <div class="quiz-status ${statusClass}">${quizStatus.label}</div>
        
        <div class="quiz-card-header">
          <h3 class="quiz-card-title">${quizConfig.title}</h3>
          ${isBlockTest ? "" : `<span class="quiz-badge">${quizConfig.category}</span>`}
        </div>

        ${quizConfig.description ? `<p class="quiz-description">${quizConfig.description}</p>` : ""}
        
        <div class="quiz-meta">
          <div class="quiz-meta-item questions">
            <span class="quiz-meta-label">${t("Вопросы")}</span>
            <span class="quiz-meta-value">${questionsCount}</span>
          </div>
          <div class="quiz-meta-item time">
            <span class="quiz-meta-label">${t("Время")}</span>
            <span class="quiz-meta-value">${t("{minutes} мин", { minutes: Math.floor(quizConfig.timeLimit / 60) })}</span>
          </div>
          <div class="quiz-meta-item threshold">
            <span class="quiz-meta-label">${t("Порог")}</span>
            <span class="quiz-meta-value">${Math.round(threshold * 100)}%</span>
          </div>
          ${
            attemptsCount > 0
              ? `
            <div class="quiz-meta-item attempts">
              <span class="quiz-meta-label">${t("Попытки")}</span>
              <span class="quiz-meta-value">${attemptsCount}</span>
            </div>
          `
              : ""
          }
        </div>

        ${
          isBlockTest
            ? ""
            : `<div class="quiz-progress-section">
          <div class="quiz-progress">
            <span>${t("Прогресс по материалу: {done}/{total} ({percent}%)", { done, total, percent: progressPercentage })}</span>
            <div class="quiz-progress-bar">
              <div class="quiz-progress-fill" style="width: ${progressPercentage}%"></div>
            </div>
          </div>
        </div>`
        }

        <div class="quiz-results-section">
          ${
            lastResult
              ? `
            <div class="quiz-last-result">
              <strong>${t("Последняя попытка:")}</strong> ${Math.round(lastResult.score * 100)}%
              <span class="quiz-result-date">(${new Date(lastResult.timestamp).toLocaleDateString(window.i18n?.locale || "ru-RU")})</span>
            </div>
          `
              : ""
          }

          ${
            bestResult && bestResult !== lastResult
              ? `
            <div class="quiz-best-result">
              <strong>${t("Лучший результат:")}</strong> ${Math.round(bestResult.score * 100)}%
            </div>
          `
              : ""
          }
          ${
            bestPassingResult && bestPassingResult !== bestResult
              ? `
            <div class="quiz-best-result">
              <strong>${t("Лучшая сданная попытка:")}</strong> ${Math.round(bestPassingResult.score * 100)}%
            </div>
          `
              : ""
          }
        </div>

        <div class="quiz-actions-section">
          <button class="quiz-start-btn ${buttonClass}" 
                  ${isUnlocked ? "" : "disabled"}
                  data-quiz-id="${quizId}">
            ${buttonText}
          </button>
          
        </div>

        ${
          !isUnlocked
            ? `
          <div class="quiz-unlock-info">
            <strong>${t("Недоступно:")}</strong> ${t("завершите изучение материала для разблокировки теста")}
          </div>
        `
            : ""
        }
      </div>
    `;

    // Добавляем обработчик клика
    const button = element.querySelector(".quiz-start-btn");

    if (button && isUnlocked) {
      button.addEventListener("click", () => this.startQuiz(quizId));
    }

    // Обрабатываем блоки кода в описании
    setTimeout(async () => {
      await this.ensureInlineCodeHighlighter();
      if (window.inlineCodeHighlighter) {
        const codeBlocks = element.querySelectorAll(".code-block");
        codeBlocks.forEach((codeBlock) => {
          window.inlineCodeHighlighter.processCodeBlock(codeBlock);
        });
      }
    }, 10);
  }

  /**
   * Запуск теста
   */
  async startQuiz(quizId) {
    try {
      // Ensure styles for modal/code blocks present
      this.ensureQuizStyles();
      const quiz = await this.loadQuiz(quizId);
      this.currentQuiz = quiz;
      this.openQuizModal(quiz);
    } catch (error) {
      console.error("Failed to start quiz:", error);
      this.showError(t("Не удалось загрузить тест. Попробуйте позже."));
    }
  }

  /**
   * Открытие модального окна теста
   */
  openQuizModal(quiz) {
    // Удаляем существующие модальные окна если они есть
    const existingBackdrop = document.querySelector(".quiz-modal-backdrop");
    const existingModal = document.querySelector(".quiz-modal");
    if (existingBackdrop) document.body.removeChild(existingBackdrop);
    if (existingModal) document.body.removeChild(existingModal);

    const backdrop = document.createElement("div");
    backdrop.className = "quiz-modal-backdrop";

    const modal = document.createElement("div");
    modal.className = "quiz-modal";

    const panel = document.createElement("div");
    panel.className = "panel";

    modal.appendChild(panel);
    document.body.appendChild(backdrop);
    document.body.appendChild(modal);

    // Плавное открытие с небольшой задержкой для применения стилей
    requestAnimationFrame(() => {
      backdrop.classList.add("show");
      modal.classList.add("show");
    });

    // Состояние теста - всегда сбрасываем при новом запуске
    let currentQuestionIndex = 0;
    let correctAnswers = 0;
    const submittedAnswers = {};
    let startTime = Date.now();
    const threshold = this.getQuizThreshold(quiz);
    const timeLimitSec = this.getQuizTimeLimit(quiz);
    const deadline = startTime + timeLimitSec * 1000;
    let timerInterval = null;
    let hasEnded = false;
    let shuffledQuestions = quiz.shuffle
      ? this.shuffleArray([...quiz.items])
      : [...quiz.items];
    shuffledQuestions = shuffledQuestions.map((question) =>
      this.shuffleQuestionOptions(question),
    );

    // Сохранение попытки — общее для обычного финала и для истёкшего времени.
    //
    // Раньше ошибка записи уходила в console.warn, а ученик видел «Тест сдан»:
    // попытка пропадала молча, и в счётчике оставалась только та, что дошла до
    // сервера. Теперь экран результата и результат записи разведены — не
    // сохранилось, видно на месте, с кнопкой повтора. requestId один на все
    // повторы, сервер по нему дедуплицирует (quiz-scoring.js,
    // appendQuizAttemptOnce), поэтому «Сохранить ещё раз» не создаёт вторую
    // попытку.
    const persistAttempt = (result, requestId) => {
      const slot = panel.querySelector("[data-quiz-save]");
      if (slot) {
        slot.hidden = false;
        slot.className = "quiz-save-status pending";
        slot.textContent = t("Сохраняем результат…");
      }
      return this.saveQuizResult(quiz.id, result, requestId).then(
        () => {
          const done = panel.querySelector("[data-quiz-save]");
          if (done) done.hidden = true;
          if (typeof updateQuizStats === "function") updateQuizStats();
        },
        (error) => {
          console.warn("Quiz result was not saved:", error.message);
          const failed = panel.querySelector("[data-quiz-save]");
          if (!failed) return; // окно уже закрыли
          failed.hidden = false;
          failed.className = "quiz-save-status failed";
          failed.innerHTML = `
            <strong>${t("Результат не сохранён.")}</strong>
            ${t("Пока он не сохранён, попытка не попадёт в статистику.")}
            <button class="quiz-start-btn" data-action="save-retry">${t("Сохранить ещё раз")}</button>
          `;
          failed
            .querySelector('[data-action="save-retry"]')
            .addEventListener("click", () => persistAttempt(result, requestId));
        },
      );
    };

    // Результат попытки: неотвеченные вопросы считаются неверными — так же их
    // считает сервер, который пересчитывает балл по присланным ответам.
    const buildAttemptResult = (timedOut) => {
      const total = shuffledQuestions.length;
      const actualCorrect = Math.min(correctAnswers, total);
      const score = total ? actualCorrect / total : 0;
      return {
        score,
        passed: score >= threshold,
        threshold,
        timeLimit: timeLimitSec,
        timedOut,
        correct: actualCorrect,
        total,
        timeSpent: Math.min(
          timeLimitSec,
          Math.floor((Date.now() - startTime) / 1000),
        ),
        questions: shuffledQuestions.map((q) => q.id),
        answers: submittedAnswers,
        answerFormat: "original-option-indices-v2",
      };
    };

    const updateTimerDisplay = () => {
      const timerElement = panel.querySelector("[data-quiz-timer]");
      if (!timerElement) return;

      const remainingSec = Math.ceil((deadline - Date.now()) / 1000);
      timerElement.textContent = t("Осталось: {time}", {
        time: this.formatTime(remainingSec),
      });
      timerElement.classList.toggle("warning", remainingSec <= 60);
    };

    const expireQuiz = () => {
      if (hasEnded) return;
      hasEnded = true;
      if (timerInterval) clearInterval(timerInterval);
      if (panel._keyDownHandler) {
        panel.removeEventListener("keydown", panel._keyDownHandler);
        panel._keyDownHandler = null;
      }

      // Истёкшая попытка тоже попадает в историю: раньше она исчезала без
      // следа, и ученик видел в счётчике на попытку меньше, чем сделал.
      // Неотвеченные вопросы засчитываются неверными.
      const result = buildAttemptResult(true);

      panel.innerHTML = `
        <div class="quiz-modal-header">
          <h2 class="quiz-modal-title">${quiz.title}</h2>
          <button class="quiz-modal-close" data-action="close">✕</button>
        </div>

        <div class="quiz-results">
          <div class="quiz-score poor">${t("Время вышло")}</div>
          <div class="quiz-score-text">${t("Попытка засчитана по отвеченным вопросам.")}</div>
          <div class="quiz-score-details">
            ${t("Результат: {percent}% — {correct} из {total}", { percent: Math.round(result.score * 100), correct: result.correct, total: result.total })}<br>
            ${t("Лимит времени: {time}", { time: this.formatTime(timeLimitSec) })}<br>
            ${t("Чтобы сдать тест, начните попытку заново и наберите минимум {percent}%.", { percent: Math.round(threshold * 100) })}
          </div>
          <div class="quiz-save-status" data-quiz-save hidden></div>
        </div>

        <div class="quiz-actions">
          <button class="quiz-start-btn" data-action="close">${t("Закрыть")}</button>
          <button class="quiz-start-btn primary" data-action="retry">${t("Начать заново")}</button>
        </div>
      `;

      panel.querySelectorAll('[data-action="close"]').forEach((btn) => {
        btn.addEventListener("click", closeModal);
      });

      panel
        .querySelector('[data-action="retry"]')
        .addEventListener("click", () => {
          closeModal();
          setTimeout(() => this.startQuiz(quiz.id), 100);
        });

      persistAttempt(result, this.newAttemptRequestId());
    };

    const ensureTimeAvailable = () => {
      if (Date.now() < deadline) return true;
      expireQuiz();
      return false;
    };

    // Рендеринг вопроса
    const renderQuestion = () => {
      if (hasEnded) return;
      if (!ensureTimeAvailable()) return;
      const question = shuffledQuestions[currentQuestionIndex];
      const progressPercentage =
        ((currentQuestionIndex + 1) / shuffledQuestions.length) * 100;

      panel.innerHTML = `
        <div class="quiz-modal-header">
          <h2 class="quiz-modal-title">${quiz.title}</h2>
          <button class="quiz-modal-close" data-action="close">✕</button>
        </div>

        <div class="quiz-progress-indicator">
          <span class="quiz-progress-indicator-text">
            ${t("Вопрос {index} из {total}", { index: currentQuestionIndex + 1, total: shuffledQuestions.length })}
          </span>
          <span class="quiz-timer" data-quiz-timer></span>
          <div class="quiz-progress-indicator-bar">
            <div class="quiz-progress-indicator-fill" style="width: ${progressPercentage}%"></div>
          </div>
        </div>

        <div class="quiz-q">
          <h4>${this.renderLatex(question.q)}</h4>
          ${
            question.code
              ? (() => {
                  const safe = this.escapeHtml(
                    String(question.code).replace(/^python\n?/i, ""),
                  );
                  return `<pre class=\"quiz-code\"><code>${safe}</code></pre>`;
                })()
              : ""
          }
          <div class="quiz-options">
            ${question.options
              .map(
                (option, index) => `
              <label>
                <input type="${question.type === "multi" ? "checkbox" : "radio"}" 
                       name="question-${question.id}" 
                       value="${index}">
                <span>${this.renderLatex(option)}</span>
              </label>
            `,
              )
              .join("")}
          </div>
        </div>

        <div class="quiz-actions">
          <button class="quiz-start-btn quiz-question-close" data-action="close">${t("Закрыть")}</button>
          <button class="quiz-start-btn primary" data-action="next">${t("Проверить ответ")}</button>
        </div>
      `;
      updateTimerDisplay();

      // Добавляем обработчики
      panel.querySelectorAll('[data-action="close"]').forEach((btn) => {
        btn.addEventListener("click", closeModal);
      });

      const checkBtn = panel.querySelector('[data-action="next"]');
      checkBtn.addEventListener("click", () => {
        if (hasEnded) return;
        if (!ensureTimeAvailable()) return;
        checkAnswer(question);
      });

      panel.querySelectorAll(".quiz-options input").forEach((input) => {
        input.addEventListener("change", () => {
          const warning = panel.querySelector(".quiz-selection-warning");
          if (warning) warning.remove();
        });
      });

      // Устанавливаем фокус на кнопку "Проверить ответ" для работы с клавиатуры
      checkBtn.focus();

      // Очищаем все предыдущие обработчики клавиш
      if (panel._keyDownHandler) {
        panel.removeEventListener("keydown", panel._keyDownHandler);
      }

      // Добавляем обработчик клавиши Enter для отправки ответа
      const handleKeyDown = (event) => {
        if (event.key === "Enter") {
          // Проверяем, что ответ еще не был проверен
          if (!panel.querySelector(".quiz-result")) {
            event.preventDefault(); // Предотвращаем повторное срабатывание
            if (hasEnded) return;
            if (!ensureTimeAvailable()) return;
            checkAnswer(question);
          }
        }
      };

      // Добавляем обработчик к панели
      panel.addEventListener("keydown", handleKeyDown);

      // Сохраняем ссылку на обработчик для последующего удаления
      panel._keyDownHandler = handleKeyDown;

      // Подсветчик в модалке не используем — достаточно базового pre>code
    };

    // Проверка ответа
    const checkAnswer = (question) => {
      if (hasEnded) return;
      if (!ensureTimeAvailable()) return;
      // Проверяем, не был ли уже проверен этот вопрос
      if (panel.querySelector(".quiz-result")) {
        return; // Вопрос уже проверен
      }

      const inputs = panel.querySelectorAll(
        `input[name="question-${question.id}"]`,
      );
      const selectedAnswers = Array.from(inputs)
        .filter((input) => input.checked)
        .map((input) => parseInt(input.value));

      // Local feedback uses the displayed order, but the server scores against
      // the immutable order in the quiz JSON. Convert only the submitted copy.
      submittedAnswers[question.id] = selectedAnswers
        .map((displayIndex) => question.originalOptionIndexes?.[displayIndex])
        .filter((originalIndex) => Number.isInteger(originalIndex))
        .sort((left, right) => left - right);

      if (selectedAnswers.length === 0) {
        const existingWarning = panel.querySelector(".quiz-selection-warning");
        if (existingWarning) {
          existingWarning.focus();
          return;
        }

        const warningDiv = document.createElement("div");
        warningDiv.className = "quiz-selection-warning";
        warningDiv.setAttribute("role", "alert");
        warningDiv.setAttribute("tabindex", "-1");
        warningDiv.textContent = t("Выберите как минимум 1 ответ");
        panel.querySelector(".quiz-options").after(warningDiv);
        warningDiv.focus();
        return;
      }

      const isCorrect = this.checkAnswerCorrectness(question, selectedAnswers);
      if (isCorrect) {
        correctAnswers++;
      } else {
      }

      // Показываем результат
      const resultDiv = document.createElement("div");
      resultDiv.className = `quiz-result ${isCorrect ? "correct" : "incorrect"}`;
      resultDiv.innerHTML = `
        <span class="quiz-result-icon">${isCorrect ? "✅" : "❌"}</span>
        ${isCorrect ? t("Правильно!") : t("Неправильно.")}
        ${question.explain ? `<br><br>${this.renderLatex(question.explain)}` : ""}
      `;

      panel.querySelector(".quiz-q").appendChild(resultDiv);

      // Обновляем кнопку
      const nextBtn = panel.querySelector('[data-action="next"]');
      nextBtn.textContent =
        currentQuestionIndex + 1 < shuffledQuestions.length
          ? t("Следующий вопрос")
          : t("Завершить тест");

      // Удаляем старый обработчик и добавляем новый
      nextBtn.replaceWith(nextBtn.cloneNode(true));
      const newNextBtn = panel.querySelector('[data-action="next"]');
      newNextBtn.addEventListener("click", () => {
        if (hasEnded) return;
        if (!ensureTimeAvailable()) return;
        currentQuestionIndex++;
        if (currentQuestionIndex < shuffledQuestions.length) {
          renderQuestion();
        } else {
          finishQuiz();
        }
      });

      // Устанавливаем фокус на кнопку для работы с клавиатуры
      newNextBtn.focus();

      // Обновляем обработчик клавиши Enter для перехода к следующему вопросу
      const handleNextKeyDown = (event) => {
        if (event.key === "Enter") {
          event.preventDefault(); // Предотвращаем повторное срабатывание
          if (hasEnded) return;
          if (!ensureTimeAvailable()) return;
          currentQuestionIndex++;
          if (currentQuestionIndex < shuffledQuestions.length) {
            renderQuestion();
          } else {
            finishQuiz();
          }
        }
      };

      // Удаляем старый обработчик и добавляем новый
      if (panel._keyDownHandler) {
        panel.removeEventListener("keydown", panel._keyDownHandler);
      }
      panel.addEventListener("keydown", handleNextKeyDown);
      panel._keyDownHandler = handleNextKeyDown;

      // Блокируем выбор ответов
      inputs.forEach((input) => (input.disabled = true));
    };

    // Завершение теста
    const finishQuiz = () => {
      if (hasEnded) return;
      hasEnded = true;
      if (timerInterval) clearInterval(timerInterval);
      const result = buildAttemptResult(false);
      const { score, passed, correct: actualCorrect, timeSpent } = result;

      // Показываем результаты
      panel.innerHTML = `
        <div class="quiz-modal-header">
          <h2 class="quiz-modal-title">${quiz.title}</h2>
          <button class="quiz-modal-close" data-action="close">✕</button>
        </div>

        <div class="quiz-results">
          <div class="quiz-score ${this.getScoreClass(score)}">
            ${Math.round(score * 100)}%
          </div>
          <div class="quiz-score-text">${this.getScoreText(score)}</div>
          <div class="quiz-score-details">
            ${passed ? t("Тест сдан.") : t("Тест не сдан.")}<br>
            ${t("Проходной порог: {percent}%", { percent: Math.round(threshold * 100) })}<br>
            ${t("Правильных ответов: {correct} из {total}", { correct: actualCorrect, total: shuffledQuestions.length })}<br>
            ${t("Время выполнения: {time}", { time: this.formatTime(timeSpent) })}
          </div>
          <div class="quiz-save-status" data-quiz-save hidden></div>
        </div>

        <div class="quiz-actions">
          <button class="quiz-start-btn" data-action="close">${t("Закрыть")}</button>
          <button class="quiz-start-btn primary" data-action="retry">${t("Повторить тест")}</button>
        </div>
      `;

      // Добавляем обработчики
      panel.querySelectorAll('[data-action="close"]').forEach((btn) => {
        btn.addEventListener("click", closeModal);
      });

      panel
        .querySelector('[data-action="retry"]')
        .addEventListener("click", () => {
          closeModal();
          setTimeout(() => this.startQuiz(quiz.id), 100);
        });

      persistAttempt(result, this.newAttemptRequestId());
    };

    // Закрытие модального окна
    const closeModal = () => {
      if (timerInterval) clearInterval(timerInterval);
      document.removeEventListener("keydown", handleEscape);
      // Очищаем обработчики клавиш
      if (panel._keyDownHandler) {
        panel.removeEventListener("keydown", panel._keyDownHandler);
        panel._keyDownHandler = null;
      }

      // Плавное закрытие с анимацией
      backdrop.classList.remove("show");
      backdrop.classList.add("hide");
      modal.classList.remove("show");
      modal.classList.add("hide");

      // Удаляем элементы после завершения анимации
      setTimeout(() => {
        if (backdrop.parentNode) document.body.removeChild(backdrop);
        if (modal.parentNode) document.body.removeChild(modal);
        this.currentQuiz = null;
      }, 300); // Длительность анимации
    };

    // Закрытие по клику на backdrop
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) {
        closeModal();
      }
    });

    // Закрытие по Escape
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        closeModal();
        document.removeEventListener("keydown", handleEscape);
      }
    };
    document.addEventListener("keydown", handleEscape);

    // Начинаем тест
    renderQuestion();
    timerInterval = setInterval(() => {
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) {
        expireQuiz();
        return;
      }
      updateTimerDisplay();
    }, 1000);
  }

  /**
   * Проверка правильности ответа
   */
  checkAnswerCorrectness(question, selectedAnswers) {
    const correctAnswers = question.answer;

    if (correctAnswers.length !== selectedAnswers.length) {
      return false;
    }

    return correctAnswers.every((answer) => selectedAnswers.includes(answer));
  }

  /**
   * Fisher-Yates shuffle for questions and options.
   */
  shuffleArray(items) {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }

  /**
   * Randomizes option order and remaps correct answer indices.
   */
  shuffleQuestionOptions(question) {
    const optionsWithOriginalIndex = question.options.map((option, index) => ({
      option,
      originalIndex: index,
    }));
    const shuffledOptions = this.shuffleArray(optionsWithOriginalIndex);

    return {
      ...question,
      options: shuffledOptions.map((item) => item.option),
      originalOptionIndexes: shuffledOptions.map((item) => item.originalIndex),
      answer: shuffledOptions
        .map((item, index) =>
          question.answer.includes(item.originalIndex) ? index : null,
        )
        .filter((index) => index !== null)
        .sort((a, b) => a - b),
    };
  }

  /**
   * Получение CSS класса для оценки
   */
  getScoreClass(score) {
    if (score >= 0.9) return "excellent";
    if (score >= 0.7) return "good";
    if (score >= 0.5) return "average";
    return "poor";
  }

  /**
   * Получение текстового описания оценки
   */
  getScoreText(score) {
    if (score >= 0.9) return t("Отлично!");
    if (score >= 0.7) return t("Хорошо!");
    if (score >= 0.5) return t("Удовлетворительно");
    return t("Нужно подтянуть знания");
  }

  /**
   * Рендеринг каталога тестов
   */
  async renderQuizCatalog(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
      container.innerHTML = `<div class="quiz-loading"><div class="quiz-loading-spinner"></div>${t("Загрузка тестов...")}</div>`;

      // Асинхронно загружаем количество вопросов для каждого теста
      // Тесты блоков живут на страницах материалов, в каталоге их нет
      const quizInfos = Array.from(this.quizRegistry.values()).filter(
        (quizInfo) => !quizInfo.block,
      );
      const quizDataPromises = quizInfos.map(async (quizInfo) => {
        try {
          const response = await this.fetchQuizFile(quizInfo);
          if (response.ok) {
            const quizData = await response.json();
            const mergedQuizInfo = {
              ...quizInfo,
              ...quizData,
              id: quizInfo.id,
            };
            return {
              ...mergedQuizInfo,
              threshold: this.getQuizThreshold(mergedQuizInfo),
              timeLimit: this.getQuizTimeLimit(mergedQuizInfo),
              questionsCount: quizData.items ? quizData.items.length : 0,
            };
          }
        } catch (error) {
          console.warn(
            `Failed to load questions count for ${quizInfo.id}:`,
            error,
          );
        }
        return {
          ...quizInfo,
          questionsCount: 0,
        };
      });

      const quizInfosWithCounts = await Promise.all(quizDataPromises);

      const catalogHTML = quizInfosWithCounts
        .map((quizInfo) => {
          const isUnlocked = this.isQuizUnlocked(quizInfo);
          const lastResult = this.getLastQuizResult(quizInfo.id);
          const bestResult = this.getBestQuizResult(quizInfo.id);
          const threshold = this.getQuizThreshold(quizInfo);
          const bestPassingResult = this.getBestPassingQuizResult(
            quizInfo.id,
            threshold,
          );
          const attemptsCount = this.getQuizAttemptsCount(quizInfo.id);

          // Проверяем, является ли результат идеальным (100%)
          // Используем bestResult вместо lastResult для определения стиля
          const isPerfectScore = bestResult && bestResult.score >= 0.99;
          const perfectClass = isPerfectScore ? "perfect-score" : "";

          const quizStatus = this.getQuizStatus(quizInfo, isUnlocked);

          return `
          <div class="quiz-catalog-item ${quizStatus.className} ${perfectClass}" data-quiz-id="${quizInfo.id}" data-category="${quizInfo.category || "default"}" data-status="${quizStatus.filterValue}">
            <div class="quiz-catalog-header">
              <h3 class="quiz-catalog-title">${quizInfo.title}</h3>
              <span class="quiz-catalog-status ${quizStatus.className}">${quizStatus.label}</span>
            </div>
            
            <p class="quiz-catalog-description">${quizInfo.description || t("Описание отсутствует")}</p>
            
            <div class="quiz-catalog-meta">
              <div class="quiz-catalog-questions-count">
                <span class="quiz-catalog-meta-label">${t("Вопросы")}</span>
                <span>${quizInfo.questionsCount}</span>
              </div>
              <div class="quiz-catalog-time-limit">
                <span class="quiz-catalog-meta-label">${t("Время")}</span>
                <span>${t("{minutes} мин", { minutes: Math.floor(this.getQuizTimeLimit(quizInfo) / 60) })}</span>
              </div>
              <div class="quiz-catalog-time-limit">
                <span class="quiz-catalog-meta-label">${t("Порог")}</span>
                <span>${Math.round(threshold * 100)}%</span>
              </div>
              ${
                attemptsCount > 0
                  ? `
                <div class="quiz-catalog-attempts">
                  <span>${attemptsCount} ${attemptsCount === 1 ? t("попытка") : attemptsCount < 5 ? t("попытки") : t("попыток")}</span>
                </div>
              `
                  : ""
              }
            </div>

            ${
              lastResult
                ? `
              <div class="quiz-last-result">
                ${t("Последняя попытка:")} ${Math.round(lastResult.score * 100)}%
                <span class="quiz-result-date">(${new Date(lastResult.timestamp).toLocaleDateString(window.i18n?.locale || "ru-RU")})</span>
              </div>
            `
                : ""
            }

            ${
              bestResult && bestResult !== lastResult
                ? `
              <div class="quiz-best-result">
                ${t("Лучший результат:")} ${Math.round(bestResult.score * 100)}%
              </div>
            `
                : ""
            }
            ${
              bestPassingResult && bestPassingResult !== bestResult
                ? `
              <div class="quiz-best-result">
                ${t("Лучшая сданная попытка:")} ${Math.round(bestPassingResult.score * 100)}%
              </div>
            `
                : ""
            }

            <div class="quiz-actions">
              <button class="quiz-start-btn ${isUnlocked ? "primary" : ""}" 
                      ${isUnlocked ? "" : "disabled"}
                      data-quiz-id="${quizInfo.id}">
                ${isUnlocked ? t("Начать тест") : t("Заблокировано")}
              </button>
            </div>
          </div>
        `;
        })
        .join("");

      container.innerHTML = `<div class="quiz-catalog">${catalogHTML}</div>`;

      // Добавляем обработчики кликов только для разблокированных тестов
      container.querySelectorAll("[data-quiz-id]").forEach((btn) => {
        const quizId = btn.dataset.quizId;
        const quizInfo = this.quizRegistry.get(quizId);
        const isUnlocked = this.isQuizUnlocked(quizInfo);

        if (isUnlocked) {
          btn.addEventListener("click", () => {
            this.startQuiz(quizId);
          });
        } else {
          // Для заблокированных тестов добавляем обработчик с предупреждением
          btn.addEventListener("click", (e) => {
            e.preventDefault();
            this.showError(
              t(
                "Тест заблокирован. Завершите изучение материала для разблокировки.",
              ),
            );
          });
        }
      });
      document.dispatchEvent(new CustomEvent("quiz-catalog:rendered"));
    } catch (error) {
      console.error("Failed to render quiz catalog:", error);
      container.innerHTML = `<div class="quiz-error">${t("Ошибка загрузки каталога тестов")}</div>`;
    }
  }

  /**
   * Показ ошибки
   */
  showError(message) {
    // Создаем простое уведомление об ошибке
    const errorDiv = document.createElement("div");
    errorDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ef4444;
      color: white;
      padding: 16px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      font-weight: 500;
    `;
    errorDiv.textContent = message;

    document.body.appendChild(errorDiv);

    setTimeout(() => {
      if (document.body.contains(errorDiv)) {
        document.body.removeChild(errorDiv);
      }
    }, 5000);
  }

  /**
   * Загрузка завершений страниц из Firebase
   * И автоматическое определение завершенных страниц по прогрессу вопросов
   */
  async loadPageCompletions() {
    if (!this.currentUser || !this.db) {
      return;
    }

    try {
      const pageCompletionRef = this.db.ref(
        `users/${this.currentUser.uid}/pageCompletion`,
      );
      const snapshot = await pageCompletionRef.once("value");
      let pageCompletionData = snapshot.val() || {};

      // Сразу сохраняем данные из Firebase в localStorage для быстрого доступа
      if (pageCompletionData && Object.keys(pageCompletionData).length > 0) {
        const storageKey = `page_completion_${this.currentUser.uid}`;
        localStorage.setItem(storageKey, JSON.stringify(pageCompletionData));
      }

      // Загружаем прогресс по вопросам для автоматического определения завершенных страниц
      const progressRef = this.db.ref(`users/${this.currentUser.uid}/progress`);
      const progressSnapshot = await progressRef.once("value");
      const progressData = progressSnapshot.val() || {};

      // Загружаем структуру вопросов для определения принадлежности к категориям
      let questionsList = {};
      try {
        const response = await fetch("/assets/js/config/questions-list.json");
        questionsList = await response.json();
      } catch (error) {
        console.error("Failed to load questions list:", error);
      }

      // Для каждого квиза проверяем, завершена ли соответствующая страница
      this.quizRegistry.forEach((quizInfo, quizId) => {
        // Если уже есть сохраненное завершение, пропускаем
        if (pageCompletionData[quizId]) {
          return;
        }

        // Пытаемся определить завершение по прогрессу вопросов
        const categoryName = this.getQuestionPrefixForQuiz(quizId);
        if (!categoryName || !questionsList.categories) {
          return;
        }

        // Получаем список вопросов этой категории из questions-list.json
        const relatedQuestions = questionsList.categories[categoryName] || [];

        if (relatedQuestions.length === 0) {
          return;
        }

        // Проверяем, какие из этих вопросов завершены в прогрессе
        const completedQuestions = relatedQuestions.filter(
          (qId) => progressData[qId] && progressData[qId].completed,
        );

        // Если все вопросы завершены и их достаточно (минимум 5), считаем страницу завершенной
        if (
          relatedQuestions.length >= 5 &&
          completedQuestions.length === relatedQuestions.length
        ) {
          pageCompletionData[quizId] = {
            completed: true,
            totalQuestions: relatedQuestions.length,
            timestamp: Date.now(),
            autoDetected: true,
          };

          // Сохраняем в Firebase
          this.db
            .ref(`users/${this.currentUser.uid}/pageCompletion/${quizId}`)
            .set(pageCompletionData[quizId]);
        }
      });

      // Сохраняем в localStorage для быстрого доступа
      const storageKey = `page_completion_${this.currentUser.uid}`;
      localStorage.setItem(storageKey, JSON.stringify(pageCompletionData));
    } catch (error) {
      console.error("Failed to load page completions from Firebase:", error);
    }
  }

  /**
   * Категория вопросов, прохождение которой открывает тест.
   *
   * Категория объявлена в реестре (`questionCategory` в
   * assets/data/quizzes/registry.json) и совпадает с ключом
   * assets/js/config/questions-list.json. Раньше её угадывали из id квиза —
   * и угадывали мимо: `ml:nlp-base` превращался в `ml_nlp-base`, а такой
   * категории нет (в списке она `ml_nlp_base`), у `mlops:*` категории `mlops`
   * не существует вовсе. Для пятнадцати из двадцати девяти тестов
   * авто-разблокировка по пройденному материалу поэтому не срабатывала
   * никогда. Соответствие реестра и списка вопросов держит
   * tests/quiz-unlock-mapping.test.js.
   */
  getQuestionPrefixForQuiz(quizId) {
    if (!quizId) return null;
    const declared = this.quizRegistry.get(quizId)?.questionCategory;
    if (declared) return declared;
    // Реестр мог не догрузиться: дефисы в подкатегории — подчёркивания в
    // ключе списка вопросов («ml:nlp-base» → «ml_nlp_base»).
    const [category, subcategory] = String(quizId).split(":");
    if (!subcategory) return category || null;
    return `${category}_${subcategory}`.replace(/-/g, "_");
  }

  /**
   * Инициализация UI
   */
  async initializeUI() {
    // Ждем инициализации Firebase auth
    await new Promise((resolve) => {
      const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
        this.currentUser = user; // Устанавливаем currentUser
        unsubscribe();
        resolve();
      });
    });

    // Загружаем результаты тестов только для авторизованных пользователей
    if (this.currentUser) {
      await this.loadUserQuizResults();
      // ВАЖНО: Загружаем завершения страниц из Firebase
      await this.loadPageCompletions();
    } else {
      this.quizResults = new Map();
    }

    // Рендеринг карточек входа в тесты
    document.querySelectorAll(".quiz-entry").forEach((element) => {
      this.renderQuizEntry(element);
    });

    // Рендеринг каталога тестов
    this.renderQuizCatalog("quiz-catalog");

    // Обновляем статистику если функция доступна
    if (typeof updateQuizStats === "function") {
      updateQuizStats();
    }

    // Слушаем изменения прогресса с дебаунсингом
    let progressUpdateTimeout;
    document.addEventListener("progress:updated", () => {
      clearTimeout(progressUpdateTimeout);
      progressUpdateTimeout = setTimeout(async () => {
        const elements = document.querySelectorAll(".quiz-entry");
        for (const element of elements) {
          await this.renderQuizEntry(element);
        }
      }, 300); // Дебаунсинг 300мс
    });

    // Также слушаем изменения в трекере прогресса напрямую
    if (window.questionProgressTracker) {
      const originalUpdateUI = window.questionProgressTracker.updateUI;
      window.questionProgressTracker.updateUI = async function () {
        originalUpdateUI.call(this);
        const elements = document.querySelectorAll(".quiz-entry");
        for (const element of elements) {
          if (window.quizSystem) {
            await window.quizSystem.renderQuizEntry(element);
          }
        }
      };
    }

    // Оптимизированное наблюдение за изменениями DOM
    let mutationTimeout;
    const observer = new MutationObserver((mutations) => {
      // Проверяем только релевантные изменения
      const relevantMutations = mutations.filter((mutation) => {
        if (mutation.type === "attributes") {
          return (
            mutation.attributeName === "data-completed" ||
            mutation.attributeName === "class"
          );
        }
        return mutation.type === "childList";
      });

      if (relevantMutations.length > 0) {
        clearTimeout(mutationTimeout);
        mutationTimeout = setTimeout(async () => {
          const elements = document.querySelectorAll(".quiz-entry");
          for (const element of elements) {
            await this.renderQuizEntry(element);
          }
        }, 500); // Дебаунсинг 500мс
      }
    });

    const questionsContainer = document.querySelector("ol#questions");
    if (questionsContainer) {
      observer.observe(questionsContainer, {
        attributes: true,
        attributeFilter: ["data-completed", "class"], // Только нужные атрибуты
        childList: true,
        subtree: false, // Не отслеживаем глубоко вложенные изменения
      });
    }
  }
}

// Создаем глобальный экземпляр только при необходимости
let quizSystemInstance = null;

function getQuizSystem() {
  if (!quizSystemInstance) {
    quizSystemInstance = new QuizSystem();
  }
  return quizSystemInstance;
}

function bootQuizSystemIfNeeded() {
  const hasQuizElements =
    document.querySelector(".quiz-entry") ||
    document.getElementById("quiz-catalog");
  if (hasQuizElements) {
    window.quizSystem = getQuizSystem();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootQuizSystemIfNeeded);
} else {
  bootQuizSystemIfNeeded();
}

// Экспорт для использования в модулях
if (typeof module !== "undefined" && module.exports) {
  module.exports = QuizSystem;
}
