// Синхронизация palette-* и раннее применение темы жили здесь и в
// navigation.js двумя копиями. Обе убраны: единственный источник —
// сниппет theme-boot, он же кладёт в window.__normalizePalette и
// window.__applyPaletteClasses то, чем пользуется код ниже.

// Favicon (SVG)
(function () {
  const link = document.querySelector('link[rel="icon"]');
  if (!link || link.getAttribute("href") === "/favicon.ico") {
    const favicon = document.createElement("link");
    favicon.rel = "icon";
    favicon.type = "image/svg+xml";
    favicon.href = typeof window.normalizeSiteUrl === "function" ? window.normalizeSiteUrl("/favicon.svg") : "/favicon.svg";
    document.head.appendChild(favicon);
    if (link) link.remove();
  }
})();

// Подключение memory optimizer (загружается первым для оптимизации)
(function () {
  const memoryOptimizerScript = document.createElement("script");
  memoryOptimizerScript.src = typeof window.normalizeSiteUrl === "function" ? window.normalizeSiteUrl("/assets/js/components/memory-optimizer.js") : "/assets/js/components/memory-optimizer.js";
  memoryOptimizerScript.async = true;
  document.head.appendChild(memoryOptimizerScript);
})();

// Lightweight achievement UI is shared by authenticated pages. The catalogue is
// fetched only when a card or a toast actually needs to be rendered.
(function () {
  const notificationCss = document.createElement("link");
  notificationCss.rel = "stylesheet";
  notificationCss.href = typeof window.normalizeSiteUrl === "function" ? window.normalizeSiteUrl("/assets/css/achievement-notifications.css") : "/assets/css/achievement-notifications.css";
  document.head.appendChild(notificationCss);

  const catalogScript = document.createElement("script");
  catalogScript.src = typeof window.normalizeSiteUrl === "function" ? window.normalizeSiteUrl("/assets/js/components/achievement-catalog.js") : "/assets/js/components/achievement-catalog.js";
  catalogScript.async = false;
  const apiScript = document.createElement("script");
  apiScript.src = typeof window.normalizeSiteUrl === "function" ? window.normalizeSiteUrl("/assets/js/components/achievement-api.js") : "/assets/js/components/achievement-api.js";
  apiScript.async = false;
  const notificationsScript = document.createElement("script");
  notificationsScript.src = typeof window.normalizeSiteUrl === "function" ? window.normalizeSiteUrl("/assets/js/components/achievement-notifications.js") : "/assets/js/components/achievement-notifications.js";
  notificationsScript.async = false;
  catalogScript.onload = () => {
    document.head.appendChild(apiScript);
    document.head.appendChild(notificationsScript);
  };
  document.head.appendChild(catalogScript);
})();

// Подключение lazy questions CSS
(function () {
  const lazyQuestionsCSS = document.createElement("link");
  lazyQuestionsCSS.rel = "stylesheet";
  lazyQuestionsCSS.href = typeof window.normalizeSiteUrl === "function" ? window.normalizeSiteUrl("/assets/css/lazy-questions.css") : "/assets/css/lazy-questions.css";
  document.head.appendChild(lazyQuestionsCSS);
})();

// Подключение image-zoom CSS
(function () {
  const imageZoomCSS = document.createElement("link");
  imageZoomCSS.rel = "stylesheet";
  imageZoomCSS.href = typeof window.normalizeSiteUrl === "function" ? window.normalizeSiteUrl("/assets/css/image-zoom.css") : "/assets/css/image-zoom.css";
  document.head.appendChild(imageZoomCSS);
})();

// Подключение копирования исходника display-формул.
(function () {
  if (window.__mathCopyInitialized || window.__mathCopyScriptRequested) return;
  window.__mathCopyScriptRequested = true;
  const script = document.createElement("script");
  script.src = typeof window.normalizeSiteUrl === "function" ? window.normalizeSiteUrl("/assets/js/components/math-copy.js") : "/assets/js/components/math-copy.js";
  script.async = true;
  document.head.appendChild(script);
})();

// Ранняя проверка доступа (страницы с init-head, но без navigation.js)
(function primeMaterialAccessCheckFromInitHead() {
  if (
    window.__materialAccessPrimeApplied ||
    window.__materialAccessGuardScriptRequested
  ) {
    return;
  }
  let raw = window.location.pathname.replace(/^\/(en\/)?/, "");
  if (raw === "" || raw.endsWith("/")) raw += "index.html";
  const excluded = {
    "roadmap/index.html": true,
    "roadmap/interactive.html": true,
  };
  if (excluded[raw]) return;
  const protectedPrefixes = [
    "math/",
    "ai/ml/",
    "python/",
    "ai/mlops/",
    "github/",
    "linux/",
    "db/",
    "practise/",
    "bank/",
    "roadmap/",
    "ai/practise/",
    "ai/bank/",
    "ai/roadmap/",
  ];
  // Offline mode: all materials are accessible, do not hide body
  window.__materialAccessPrimeApplied = true;
  window.__materialAccessGuardScriptRequested = true;
  window.runMaterialAccessGuard = async () => false;
})();

// Подключение KaTeX и инициализация
document.addEventListener("DOMContentLoaded", function () {
  // Render KaTeX only if lazy-questions is not active
  if (
    !window.__lazyQuestionsActive &&
    typeof renderMathInElement === "function"
  ) {
    renderMathInElement(document.body, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false },
        { left: "\\(", right: "\\)", display: false },
        { left: "\\[", right: "\\]", display: true },
      ],
      throwOnError: false,
    });
  }

  // Инициализация системы тестов
  initializeQuizSystem();

  // Загрузка и инициализация image-zoom
  loadImageZoom();
});

async function waitForQuizSystem(timeoutMs = 5000) {
  const started = Date.now();
  while (!window.quizSystem && Date.now() - started < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return window.quizSystem || null;
}

// Инициализация системы тестов
async function initializeQuizSystem() {
  try {
    const quizSystemPromise = waitForQuizSystem();
    const configResponse = await fetch("/config/firebase-config.json");
    const firebaseConfig = await configResponse.json();
    const quizSystem = await quizSystemPromise;

    if (quizSystem) {
      await quizSystem.initialize(firebaseConfig);
    }

    // Инициализируем систему уведомлений о достижениях
    if (window.globalAchievementNotifications) {
      await window.globalAchievementNotifications.initialize(firebaseConfig);
      console.log("Achievement notifications initialized");
    }
  } catch (error) {
    console.error("Failed to initialize quiz system:", error);
    const quizSystem = window.quizSystem || (await waitForQuizSystem());
    if (quizSystem) {
      await quizSystem.loadQuizRegistry();
    }
  }
}

// Загрузка image-zoom компонента (скрипт всегда подгружается из init-page.js на страницах с init-page;
// здесь оставляем только для страниц без init-page, где есть init-head и figure img)
function loadImageZoom() {
  if (window.__imageZoomInitialized) return;
  if (
    document.querySelector('script[src="/assets/js/components/image-zoom.js"]')
  )
    return;
  const script = document.createElement("script");
  script.src = typeof window.normalizeSiteUrl === "function" ? window.normalizeSiteUrl("/assets/js/components/image-zoom.js") : "/assets/js/components/image-zoom.js";
  script.async = true;
  document.body.appendChild(script);
}

// Темная тема: применяет её сниппет theme-boot в <head>, здесь остаётся
// только подпись переключателя. Своей копии toggleTheme тут больше нет —
// её никто не вызывал, а лишний экземпляр приходилось помнить при каждой
// правке темы.
function updateThemeIcons() {
  const isDark = document.body.classList.contains("dark");
  const palette = window.__normalizePalette(
    localStorage.getItem("palette") || "vibecode",
  );
  const PALETTE_NAV_LABEL = {
    vibecode: "Vibecode",
    earth: "Earth",
    sepia: "Sepia",
    graphite: "Graphite",
  };
  const label = PALETTE_NAV_LABEL[palette] || "Vibecode";

  // Обновляем иконку в навигации
  const themeToggleNav = document.getElementById("theme-toggle-nav");
  if (
    themeToggleNav &&
    !themeToggleNav.classList.contains("appearance-trigger")
  ) {
    themeToggleNav.textContent = `${label} · ${isDark ? "Dark" : "Light"}`;
  }

  // Обновляем иконку в других местах (например, в index.html)
  const themeIcons = document.querySelectorAll(".theme-icon");
  themeIcons.forEach((icon) => {
    icon.textContent = isDark ? "☀️" : "🌙";
  });

  // Также обновляем иконку через data-атрибут, если используется
  const themeToggles = document.querySelectorAll("[data-theme-toggle]");
  themeToggles.forEach((toggle) => {
    toggle.textContent = isDark ? "☀️" : "🌙";
  });
}

// Восстановление темы отсюда убрано: window.onload срабатывает после
// догрузки всех картинок, то есть заведомо позже первой отрисовки. Тему и
// палитру ставит сниппет theme-boot ещё в <head>.

// Обновляем иконки после полной загрузки DOM
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    if (typeof updateThemeIcons === "function") {
      updateThemeIcons();
    }
  }, 200);
});
