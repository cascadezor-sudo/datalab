(function () {
  "use strict";

  // Перевод интерфейса (ядро — сниппет theme-boot). В тестах под Node его нет:
  // остаётся русский текст с подставленными значениями.
  const t =
    window.t ||
    ((text, params) =>
      text.replace(/\{(\w+)\}/g, (match, key) => params?.[key] ?? match));

  const STORAGE_KEY = "start_diagnostic_result";
  const PROGRESS_KEY = "start_diagnostic_progress";
  /* Версия набора вопросов. Подняли до 2, когда диагностику расширили с 50 до
     70 вопросов и переписали формулировки: проценты старых прохождений с
     новыми несравнимы, поэтому результат прошлой версии показываем с пометкой,
     а не молча выдаём за актуальный срез. */
  const QUESTIONS_VERSION = 2;
  const DOMAINS = {
    python: {
      title: "Python",
      shortTitle: "Python",
      roadmapUrl: "/roadmap/python.html",
      materialUrl: "/python/base.html",
      practiceUrl: "/practise/python/base.html",
      lowAction: "Начни с Python Base",
      mediumAction: "Закрой пробелы в Python",
      highAction: "Можно пропустить базовый Python",
    },
    math: {
      title: "Математика",
      shortTitle: "Math",
      roadmapUrl: "/roadmap/math.html",
      materialUrl: "/math/algebra.html",
      practiceUrl: "/practise/math.html",
      lowAction: "Закрой алгебру и базовую статистику",
      mediumAction: "Повтори ключевые темы математики",
      highAction: "Можно идти дальше, возвращаясь точечно",
    },
    classicMl: {
      title: "Classic ML",
      shortTitle: "Classic ML",
      roadmapUrl: "/ai/roadmap/classic_ml.html",
      materialUrl: "/ai/ml/classic.html",
      practiceUrl: "/ai/practise/classic_ml.html",
      lowAction: "Начни с Classic ML",
      mediumAction: "Закрепи метрики, CV и базовые модели",
      highAction: "Переходи к DL после контрольного квиза",
    },
    dl: {
      title: "Deep Learning",
      shortTitle: "DL",
      roadmapUrl: "/ai/roadmap/dl.html",
      materialUrl: "/ai/ml/dl.html",
      practiceUrl: "/ai/practise/dl.html",
      lowAction: "DL пока изучай после Classic ML",
      mediumAction: "Закрой оптимизацию, регуляризацию и attention",
      highAction: "Можно двигаться к NLP и архитектурам",
    },
    nlp: {
      title: "NLP",
      shortTitle: "NLP",
      roadmapUrl: "/ai/roadmap/nlp-base.html",
      materialUrl: "/ai/ml/nlp/base.html",
      practiceUrl: "/ai/practise/nlp.html",
      lowAction: "Начни с NLP Base после Classic ML/DL",
      mediumAction: "Закрепи эмбеддинги, attention и transformers",
      highAction: "Переходи к RAG, Agents и Optimization",
    },
  };

  /* Банк вопросов лежит отдельным файлом (start-diagnostic-questions.js):
     70 вопросов удобнее править и проверять тестом, когда они не перемешаны
     с логикой экрана. Если скрипт не подключили, показываем это явно, а не
     пустую диагностику из нуля вопросов. */
  const QUESTIONS = window.StartDiagnosticQuestions?.QUESTIONS ?? [];

  shuffleQuestionOptions();

  const state = {
    index: 0,
    answers: new Array(QUESTIONS.length).fill(null),
    result: null,
  };

  function getRoot() {
    return document.getElementById("start-diagnostic");
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderInlineCode(value) {
    return escapeHtml(value).replace(/`([^`]+)`/g, "<code>$1</code>");
  }

  function shuffleArray(items) {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [
        shuffled[swapIndex],
        shuffled[index],
      ];
    }
    return shuffled;
  }

  function shuffleQuestionOptions() {
    QUESTIONS.forEach((question) => {
      question.options = shuffleArray(question.options);
    });
  }

  function getDomainQuestionCount(domain) {
    return QUESTIONS.filter((question) => question.domain === domain).length;
  }

  function getSavedResult() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.warn("Failed to read diagnostic result:", error);
      return null;
    }
  }

  /* Ответы храним по ходу прохождения: 70 вопросов — это 20-30 минут, и
     перезагрузка страницы, случайный «назад» или редирект authGuard раньше
     стирали всё сделанное без возможности продолжить.

     Храним не индекс варианта, а его текст: shuffleQuestionOptions
     перемешивает варианты при каждой загрузке страницы, так что после
     перезагрузки тот же индекс указывал бы на другой ответ. Заодно это
     защищает от правок банка — переформулированный вариант просто не найдётся
     и вопрос останется без ответа. */
  function saveProgress() {
    try {
      localStorage.setItem(
        PROGRESS_KEY,
        JSON.stringify({
          version: QUESTIONS_VERSION,
          index: state.index,
          answers: state.answers.map((answerIndex, questionIndex) =>
            answerIndex === null
              ? null
              : (QUESTIONS[questionIndex].options[answerIndex]?.label ?? null),
          ),
        }),
      );
    } catch (error) {
      console.warn("Failed to save diagnostic progress:", error);
    }
  }

  function clearProgress() {
    try {
      localStorage.removeItem(PROGRESS_KEY);
    } catch (error) {
      console.warn("Failed to clear diagnostic progress:", error);
    }
  }

  function restoreProgress() {
    try {
      const raw = localStorage.getItem(PROGRESS_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (
        saved?.version !== QUESTIONS_VERSION ||
        !Array.isArray(saved.answers) ||
        saved.answers.length !== QUESTIONS.length
      ) {
        clearProgress();
        return;
      }
      state.answers = saved.answers.map((label, questionIndex) => {
        if (typeof label !== "string") return null;
        const optionIndex = QUESTIONS[questionIndex].options.findIndex(
          (option) => option.label === label,
        );
        return optionIndex >= 0 ? optionIndex : null;
      });
      state.index = Math.min(
        Math.max(Number(saved.index) || 0, 0),
        QUESTIONS.length - 1,
      );
    } catch (error) {
      console.warn("Failed to restore diagnostic progress:", error);
    }
  }

  function saveLocalResult(result) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
    } catch (error) {
      console.warn("Failed to save diagnostic result:", error);
    }
  }

  async function initializeFirebaseIfNeeded() {
    if (typeof firebase === "undefined") return false;
    if (firebase.apps.length) return true;
    if (!window.configLoader?.loadFirebaseConfig) return false;

    try {
      const firebaseConfig = await window.configLoader.loadFirebaseConfig();
      firebase.initializeApp(firebaseConfig);
      return true;
    } catch (error) {
      console.warn("Failed to initialize Firebase for diagnostic:", error);
      return false;
    }
  }

  async function getFirebaseUser() {
    if (!(await initializeFirebaseIfNeeded())) return null;
    if (firebase.auth().currentUser) return firebase.auth().currentUser;

    return await new Promise((resolve) => {
      const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
        unsubscribe();
        resolve(user ?? null);
      });
    });
  }

  async function saveFirebaseResult(result) {
    const saveState = document.getElementById("diagnostic-save-state");
    try {
      if (
        typeof firebase === "undefined" ||
        typeof firebase.database !== "function"
      ) {
        if (saveState)
          saveState.textContent = t("Результат сохранён в этом браузере.");
        return;
      }

      const user = await getFirebaseUser();
      if (!user) {
        if (saveState)
          saveState.textContent = t("Результат сохранён в этом браузере.");
        return;
      }

      await firebase
        .database()
        .ref(`users/${user.uid}/diagnostic/start`)
        .set(result);
      if (saveState) saveState.textContent = t("Результат сохранён в профиле.");
    } catch (error) {
      console.warn("Failed to save diagnostic result to Firebase:", error);
      if (saveState)
        saveState.textContent = t("Результат сохранён в этом браузере.");
    }
  }

  function buildScores() {
    const scores = {};
    Object.keys(DOMAINS).forEach((domain) => {
      scores[domain] = {
        correct: 0,
        total: getDomainQuestionCount(domain),
        percent: 0,
      };
    });

    state.answers.forEach((answer, index) => {
      const question = QUESTIONS[index];
      if (!question || answer === null) return;
      scores[question.domain].correct +=
        QUESTIONS[index].options[answer]?.score ?? 0;
    });

    Object.values(scores).forEach((score) => {
      score.percent = score.total
        ? Math.round((score.correct / score.total) * 100)
        : 0;
    });

    return scores;
  }

  /* Пороги пересчитаны под 14 вопросов в разделе и более сложный набор.
     При десяти вопросах «уверенно» начиналось ровно с 8/10 = 80%. На
     четырнадцати ближайшие значения — 11/14 = 79% и 12/14 = 86%, так что
     прежние 80% незаметно подняли планку до 12 правильных из 14, а вопросы
     при этом стали труднее. Берём 75% (11 из 14) для «уверенно» и 45%
     (7 из 14, ровно половина) для «есть пробелы». */
  function getLevel(score) {
    if (score.percent >= 75) return "high";
    if (score.percent >= 45) return "medium";
    return "low";
  }

  function getStatusLabel(level) {
    if (level === "high") return t("уверенно");
    if (level === "medium") return t("есть пробелы");
    return t("начать с базы");
  }

  function getBadgeLabel(level) {
    if (level === "high") return t("можно пропустить");
    if (level === "medium") return t("повторить");
    return t("в фокус");
  }

  function getBadgeClass(level) {
    if (level === "high") return "diagnostic-route-item__badge--skip";
    if (level === "medium") return "diagnostic-route-item__badge--start";
    return "diagnostic-route-item__badge--focus";
  }

  function getActionText(domain, level) {
    const config = DOMAINS[domain];
    if (level === "high") return t(config.highAction);
    if (level === "medium") return t(config.mediumAction);
    return t(config.lowAction);
  }

  function buildRoute(scores) {
    const prerequisites = ["python", "math"];
    const core = ["classicMl", "dl", "nlp"];
    const weakPrerequisites = prerequisites.filter(
      (domain) => getLevel(scores[domain]) !== "high",
    );

    const route = [];

    weakPrerequisites.forEach((domain) => {
      route.push({
        domain,
        level: getLevel(scores[domain]),
        reason:
          domain === "python"
            ? "Python нужен для практики, задач и чтения кода в материалах."
            : "Математика будет постоянно встречаться в ML, метриках и оптимизации.",
      });
    });

    const firstWeakCore = core.find(
      (domain) => getLevel(scores[domain]) !== "high",
    );
    if (firstWeakCore) {
      route.push({
        domain: firstWeakCore,
        level: getLevel(scores[firstWeakCore]),
        reason:
          "Это ближайший содержательный блок, который даст максимальный прирост.",
      });
    }

    core
      .filter(
        (domain) =>
          domain !== firstWeakCore && getLevel(scores[domain]) !== "low",
      )
      .forEach((domain) => {
        route.push({
          domain,
          level: getLevel(scores[domain]),
          reason:
            getLevel(scores[domain]) === "high"
              ? "Базу можно не перечитывать подряд, лучше пройти контрольные вопросы и двигаться дальше."
              : "Тему стоит повторять точечно после основного фокуса.",
        });
      });

    if (route.length === 0) {
      route.push({
        domain: "nlp",
        level: "high",
        reason:
          "Диагностика выглядит сильной: начинай с продвинутых NLP-блоков и практики.",
      });
    }

    return route.slice(0, 5);
  }

  function finishDiagnostic() {
    const scores = buildScores();
    const result = {
      completedAt: new Date().toISOString(),
      version: QUESTIONS_VERSION,
      scores,
      route: buildRoute(scores),
      answers: state.answers.map((answerIndex, index) => ({
        domain: QUESTIONS[index].domain,
        question: QUESTIONS[index].text,
        selected: answerIndex,
        correct: QUESTIONS[index].options[answerIndex]?.score === 1,
      })),
    };
    state.result = result;
    clearProgress();
    saveLocalResult(result);
    renderResults(result);
    saveFirebaseResult(result);
  }

  function renderQuestion() {
    const root = getRoot();
    if (!root) return;

    const question = QUESTIONS[state.index];
    const selected = state.answers[state.index];
    const answeredCount = state.answers.filter(
      (answer) => answer !== null,
    ).length;
    const progressPercent = Math.round(
      (answeredCount / QUESTIONS.length) * 100,
    );

    root.innerHTML = `
      <div class="diagnostic-progress">
        <div class="diagnostic-progress__top">
          <span>${t("Вопрос {index} из {total}", { index: state.index + 1, total: QUESTIONS.length })}</span>
          <span>${t("{answered}/{total} отвечено", { answered: answeredCount, total: QUESTIONS.length })}</span>
        </div>
        <div class="diagnostic-progress__bar">
          <div class="diagnostic-progress__fill" style="width: ${progressPercent}%"></div>
        </div>
      </div>
      <div class="diagnostic-question">
        <div class="diagnostic-question__domain">${escapeHtml(t(DOMAINS[question.domain].title))}</div>
        <div class="diagnostic-question__text">${renderInlineCode(question.text)}</div>
        <div class="diagnostic-options">
          ${question.options
            .map(
              (option, optionIndex) => `
                <button class="diagnostic-option${selected === optionIndex ? " is-selected" : ""}" type="button" data-option-index="${optionIndex}">
                  <span class="diagnostic-option__marker">✓</span>
                  <span>
                    <span class="diagnostic-option__label">${renderInlineCode(option.label)}</span>
                  </span>
                </button>
              `,
            )
            .join("")}
        </div>
      </div>
      <div class="diagnostic-actions">
        <button class="diagnostic-btn diagnostic-btn--secondary" type="button" data-action="restart">${t("Сбросить")}</button>
        <div class="diagnostic-actions__group">
          <button class="diagnostic-btn diagnostic-btn--secondary" type="button" data-action="prev" ${state.index === 0 ? "disabled" : ""}>${t("Назад")}</button>
          <button class="diagnostic-btn diagnostic-btn--primary" type="button" data-action="next" ${selected === null ? "disabled" : ""}>
            ${state.index === QUESTIONS.length - 1 ? t("Получить маршрут") : t("Дальше")}
          </button>
        </div>
      </div>
    `;
  }

  function renderResults(result) {
    const root = getRoot();
    if (!root) return;

    const outdated = (result.version || 1) < QUESTIONS_VERSION;

    root.innerHTML = `
      <div class="diagnostic-results">
        ${
          outdated
            ? `<p class="diagnostic-outdated">${t("Это результат прошлой версии теста. Набор обновлён: стало 70 вопросов и они сложнее — пройди заново, чтобы увидеть актуальный срез.")}</p>`
            : ""
        }
        <div class="diagnostic-results__summary">
          ${Object.entries(DOMAINS)
            .map(([domain, config]) => {
              const score = result.scores[domain];
              const level = getLevel(score);
              return `
                <div class="diagnostic-score-card">
                  <div class="diagnostic-score-card__label">${config.shortTitle}</div>
                  <div class="diagnostic-score-card__value">${score.correct}/${score.total}</div>
                  <div class="diagnostic-score-card__status">${getStatusLabel(level)}</div>
                </div>
              `;
            })
            .join("")}
        </div>
        <div class="diagnostic-route">
          <div class="diagnostic-route__title">${t("Рекомендованный маршрут")}</div>
          ${result.route.map(renderRouteItem).join("")}
        </div>
        <div class="diagnostic-actions">
          <span class="diagnostic-save-state" id="diagnostic-save-state">${t("Результат сохранён в этом браузере.")}</span>
          <div class="diagnostic-actions__group">
            <button class="diagnostic-btn diagnostic-btn--secondary" type="button" data-action="restart">${t("Пройти заново")}</button>
            <a class="diagnostic-btn diagnostic-btn--primary" href="${DOMAINS[result.route[0].domain].roadmapUrl}">${t("Открыть первый шаг")}</a>
          </div>
        </div>
      </div>
    `;
  }

  function renderRouteItem(item, index) {
    const config = DOMAINS[item.domain];
    return `
      <div class="diagnostic-route-item">
        <div class="diagnostic-route-item__top">
          <div class="diagnostic-route-item__title">${index + 1}. ${getActionText(item.domain, item.level)}</div>
          <span class="diagnostic-route-item__badge ${getBadgeClass(item.level)}">${getBadgeLabel(item.level)}</span>
        </div>
        <p class="diagnostic-route-item__text">${t(item.reason)}</p>
        <div class="diagnostic-route-item__links">
          <a href="${config.roadmapUrl}">RoadMap</a>
          <a href="${config.materialUrl}">${t("Материал")}</a>
          <a href="${config.practiceUrl}">${t("Практика")}</a>
        </div>
      </div>
    `;
  }

  function resetDiagnostic() {
    state.index = 0;
    shuffleQuestionOptions();
    state.answers = new Array(QUESTIONS.length).fill(null);
    state.result = null;
    clearProgress();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.warn("Failed to reset diagnostic result:", error);
    }
    renderQuestion();
  }

  function bindEvents() {
    const root = getRoot();
    if (!root) return;

    root.addEventListener("click", (event) => {
      const optionButton = event.target.closest("[data-option-index]");
      if (optionButton) {
        state.answers[state.index] = Number(optionButton.dataset.optionIndex);
        saveProgress();
        renderQuestion();
        return;
      }

      const actionButton = event.target.closest("[data-action]");
      if (!actionButton) return;

      const action = actionButton.dataset.action;
      if (action === "restart") {
        resetDiagnostic();
        return;
      }
      if (action === "prev" && state.index > 0) {
        state.index -= 1;
        saveProgress();
        renderQuestion();
        return;
      }
      if (action === "next") {
        if (state.answers[state.index] === null) return;
        if (state.index === QUESTIONS.length - 1) {
          finishDiagnostic();
        } else {
          state.index += 1;
          saveProgress();
          renderQuestion();
        }
      }
    });
  }

  function init() {
    const root = getRoot();
    if (!root) return;

    if (QUESTIONS.length === 0) {
      root.innerHTML = `<div class="diagnostic-empty">${t("Не удалось загрузить вопросы диагностики. Обнови страницу.")}</div>`;
      console.error(
        "start-diagnostic: банк вопросов не загружен, проверьте подключение start-diagnostic-questions.js",
      );
      return;
    }

    bindEvents();
    const savedResult = getSavedResult();
    if (savedResult?.scores && Array.isArray(savedResult.route)) {
      state.result = savedResult;
      renderResults(savedResult);
      return;
    }
    restoreProgress();
    renderQuestion();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
