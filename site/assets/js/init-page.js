// /assets/js/init-page.js

// Импортируем систему уведомлений
// import './notifications.js'; // Раскомментировать после исправления модулей

// Подключение увеличения изображений на всех страницах с init-page.js (в т.ч. с lazy-questions)
(function () {
  const ragChatAssetVersion = "20260809-markdown-fix";
  const zoomCssPath = "/assets/css/image-zoom.css";
  const zoomScriptPath = "/assets/js/components/image-zoom.js";
  const questionReportsCssPath = "/assets/css/question-reports.css";
  const questionAiHelpCssPath = `/assets/css/question-ai-help.css?v=${ragChatAssetVersion}`;
  const ragChatCssPath = `/assets/css/rag-chat.css?v=${ragChatAssetVersion}`;
  if (!document.querySelector('link[href="' + zoomCssPath + '"]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = zoomCssPath;
    document.head.appendChild(link);
  }
  if (!document.querySelector('link[href="' + questionReportsCssPath + '"]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = questionReportsCssPath;
    document.head.appendChild(link);
  }
  if (!document.querySelector('link[href="' + questionAiHelpCssPath + '"]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = questionAiHelpCssPath;
    document.head.appendChild(link);
  }
  if (!document.querySelector('link[href="' + ragChatCssPath + '"]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = ragChatCssPath;
    document.head.appendChild(link);
  }
  if (
    !document.querySelector('script[src="' + zoomScriptPath + '"]') &&
    !window.__imageZoomInitialized
  ) {
    const script = document.createElement("script");
    script.src = zoomScriptPath;
    script.async = true;
    document.body.appendChild(script);
  }
})();

// Загружаем скрипт геймификации для проверки достижений
if (!window.gamificationSystem) {
  const script = document.createElement("script");
  script.src = "/assets/js/components/gamification.js";
  document.head.appendChild(script);
}

// Загружаем систему авто-разблокировки разделов
if (!window.autoUnlock) {
  const script = document.createElement("script");
  script.src = "/assets/js/components/auto-unlock.js";
  document.head.appendChild(script);
}

// Scroll-to-top button behavior with enhanced animations
window.addEventListener("scroll", function () {
  const btn = document.getElementById("scrollToTopBtn");
  if (!btn) return;

  if (window.pageYOffset > 300) {
    btn.style.display = "block";
    // Добавляем небольшую задержку для плавной анимации
    setTimeout(() => {
      btn.style.opacity = "1";
      btn.style.transform = "scale(1)";
    }, 50);
  } else {
    btn.style.opacity = "0";
    btn.style.transform = "scale(0.8)";
    // Скрываем кнопку после анимации
    setTimeout(() => {
      btn.style.display = "none";
    }, 300);
  }
});

document
  .getElementById("scrollToTopBtn")
  ?.addEventListener("click", function () {
    const btn = this;

    // Добавляем эффект клика
    btn.style.transform = "scale(0.95)";

    // Плавная прокрутка наверх
    window.scrollTo({ top: 0, behavior: "smooth" });

    // Возвращаем нормальный размер
    setTimeout(() => {
      btn.style.transform = "scale(1)";
    }, 150);
  });

async function ensureMaterialAccessGuard() {
  window.runMaterialAccessGuard = async () => false;
  return true;
}

// Initialize question progress tracking and difficulty rating
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Material access guard: block page if student has no access to this category
    const guardReady = await ensureMaterialAccessGuard();
    if (guardReady) {
      const blocked = await window.runMaterialAccessGuard();
      if (blocked) return;
    }

    // Load lazy-init first for optimization
    if (!window.lazyInit) {
      const lazyScript = document.createElement("script");
      lazyScript.src = "/assets/js/components/lazy-init.js";
      await new Promise((resolve) => {
        lazyScript.onload = resolve;
        document.head.appendChild(lazyScript);
      });
    }

    // Check if required classes are available (only needed on question pages)
    if (typeof QuestionProgressTracker === "undefined") {
      return;
    }

    if (typeof DifficultyRating === "undefined") {
      return;
    }

    const firebaseConfig = await window.configLoader.loadFirebaseConfig();

    // Экземпляры берём те, что уже лежат на window: их создают сами файлы
    // компонентов в момент загрузки, и до конца этой асинхронной функции
    // именно с ними работает question-presentation.js. Раньше здесь
    // создавались новые, а построенные до этого звёзды и кнопки оставались
    // привязанными к старому объекту — у него onAuthStateChanged не
    // подписан, currentUser навсегда null, и клик по звезде отвечал
    // «User must be authenticated to rate difficulty».
    if (!window.questionProgressTracker) {
      window.questionProgressTracker = new QuestionProgressTracker();
    }
    if (!window.questionProgressTracker.isInitialized) {
      await window.questionProgressTracker.initialize(firebaseConfig);
    }

    // Start progress tracker initialization (non-blocking)
    window.questionProgressTracker.addProgressToQuestions();

    // То же самое для оценки сложности — см. комментарий выше.
    if (!window.difficultyRating) {
      window.difficultyRating = new DifficultyRating();
    }
    if (!window.difficultyRating.isInitialized) {
      await window.difficultyRating.initialize(firebaseConfig);
    }

    // Delay difficulty rating to not block initial render
    setTimeout(() => {
      window.difficultyRating.addDifficultyRatingToQuestions();
    }, 200);

    // Additional update after everything is loaded
    setTimeout(() => {
      if (window.difficultyRating) {
        window.difficultyRating.updateAllProgressButtons();
      }
    }, 1500);

    if (
      document.querySelector("li.question") &&
      !document.querySelector(
        'script[src="/assets/js/components/question-reports.js"]',
      )
    ) {
      const questionReportsScript = document.createElement("script");
      questionReportsScript.src = "/assets/js/components/question-reports.js";
      document.body.appendChild(questionReportsScript);
    }

    if (document.querySelector("li.question")) {
      const ragChatAssetVersion = "20260809-markdown-fix";
      const questionAiHelpScriptPath = `/assets/js/components/question-ai-help.js?v=${ragChatAssetVersion}`;
      const ragChatScriptPath = `/assets/js/components/rag-chat.js?v=${ragChatAssetVersion}`;
      const loadQuestionAiHelp = () => {
        if (
          !window.__questionAiHelpInitialized &&
          !document.querySelector("script[data-question-ai-help-script]")
        ) {
          const questionAiHelpScript = document.createElement("script");
          questionAiHelpScript.src = questionAiHelpScriptPath;
          questionAiHelpScript.dataset.questionAiHelpScript = "true";
          document.body.appendChild(questionAiHelpScript);
        }
      };

      if (
        !window.__ragChatInitialized &&
        !document.querySelector("script[data-rag-chat-script]")
      ) {
        const ragChatScript = document.createElement("script");
        ragChatScript.src = ragChatScriptPath;
        ragChatScript.dataset.ragChatScript = "true";
        ragChatScript.onload = loadQuestionAiHelp;
        ragChatScript.onerror = loadQuestionAiHelp;
        document.body.appendChild(ragChatScript);
      } else {
        loadQuestionAiHelp();
      }
    }

    // Инициализируем систему геймификации для проверки достижений
    if (window.gamificationSystem) {
      try {
        await window.gamificationSystem.initialize(firebaseConfig);
      } catch (error) {
        console.error("Failed to initialize gamification system:", error);
      }
    }

    // Инициализируем систему уведомлений для всех страниц
    if (window.notificationSystem) {
      try {
        await window.notificationSystem.initialize(firebaseConfig);
      } catch (error) {
        console.error("Failed to initialize notification system:", error);
      }
    }
  } catch (error) {
    console.error(
      "Failed to initialize progress tracking and difficulty rating:",
      error,
    );
  }
});
