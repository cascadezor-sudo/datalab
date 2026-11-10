/* Синхронизация классов palette-* переехала в сниппет theme-boot: она нужна
   до первой отрисовки, а этот файл подключается уже после стилей. Отсюда
   пользуемся тем, что сниппет положил в window.__applyPaletteClasses и
   window.__normalizePalette. */

// Перевод интерфейса: t() и window.i18n кладёт сниппет theme-boot. На паре
// страниц без сниппета остаётся русский как есть.
if (typeof window.t !== "function")
  window.t = (text, params) =>
    text.replace(/\{(\w+)\}/g, (match, key) => params?.[key] ?? match);

// Favicon на всех страницах с навигацией
(function () {
  try {
    var link = document.querySelector('link[rel="icon"]');
    if (!link || link.getAttribute("href") === "/favicon.ico") {
      var favicon = document.createElement("link");
      favicon.rel = "icon";
      favicon.type = "image/svg+xml";
      favicon.href = typeof window.normalizeSiteUrl === "function" ? window.normalizeSiteUrl("/favicon.svg") : "/favicon.svg";
      document.head.appendChild(favicon);
      if (link) link.remove();
    }
  } catch (e) {}
})();

function getActivePage() {
  const path = window.location.pathname;
  if (path === "/") return "home";
  if (path.includes("/main.html")) return "home";
  if (path.includes("/news.html")) return "news";
  if (path.includes("/curator/")) return "curator";

  // Обрабатываем специальные случаи для страниц прогресса
  if (path.includes("/calender/roadmap.html")) return "roadmap";
  if (path.includes("/roadmap/interactive.html"))
    return "materials-map-interactive";
  if (path.includes("/roadmap/index.html")) return "materials-map";
  if (path.includes("/calender/") || path.includes("/calender/index.html"))
    return "calender";
  if (path.includes("/mentor-stats/progress.html")) return "mentor-progress";
  if (path.includes("/mentor-stats/students-management.html"))
    return "mentor-access";
  if (path.includes("/leaderboard.html")) return "leaderboard";

  // «/achievements.html» → «achievements»: id ссылок навбара без расширения.
  return path
    .replace(/^\/(en\/)?(ai\/)?/, "/")
    .split("/")[1]
    .replace(/\.html$/, "");
}

function createSimpleLink(link, activePage) {
  const a = document.createElement("a");
  a.href = typeof window.normalizeSiteUrl === "function" ? window.normalizeSiteUrl(link.href) : link.href;
  if (link.icon || link.hint) {
    a.classList.add("dropdown-link");
    if (link.icon) {
      const icon = document.createElement("img");
      icon.className = "dropdown-link__icon";
      const rawIconPath = `/assets/icons/${link.icon}.svg`;
      icon.src = typeof window.normalizeSiteUrl === "function" ? window.normalizeSiteUrl(rawIconPath) : rawIconPath;
      icon.alt = "";
      icon.width = 20;
      icon.height = 20;
      icon.decoding = "async";
      a.appendChild(icon);
    }
    const body = document.createElement("span");
    body.className = "dropdown-link__body";
    const text = document.createElement("span");
    text.className = "dropdown-link__text";
    text.textContent = link.text;
    body.appendChild(text);
    if (link.hint) {
      const hint = document.createElement("span");
      hint.className = "dropdown-link__hint";
      hint.textContent = link.hint;
      body.appendChild(hint);
    }
    a.appendChild(body);
  } else {
    a.textContent = link.text;
  }
  if (link.id === activePage) {
    a.classList.add("active");
    a.setAttribute("aria-current", "page");
  }
  return a;
}

/**
 * Пункты меню: `{ href, text, id }` — ссылка, `{ element }` — готовый узел
 * (кнопка «Оформление», «Выйти»), `{ items, className, title }` — группа
 * (колонка мега-меню). Возвращает true, если среди ссылок есть текущая
 * страница: тогда подсвечивается и сам триггер.
 */
function appendDropdownItems(parent, items, activePage) {
  let active = false;
  for (const item of items) {
    if (item.items) {
      const group = document.createElement("div");
      group.className = item.className || "dropdown-group";
      if (item.title) {
        const heading = document.createElement("span");
        heading.className = "dropdown-group__title";
        heading.textContent = item.title;
        group.appendChild(heading);
      }
      if (appendDropdownItems(group, item.items, activePage)) active = true;
      parent.appendChild(group);
    } else if (item.element) {
      parent.appendChild(item.element);
    } else {
      const link = createSimpleLink(item, activePage);
      if (item.className) link.classList.add(item.className);
      if (link.classList.contains("active")) active = true;
      parent.appendChild(link);
    }
  }
  return active;
}

// Счётчик нужен для aria-controls: у каждого списка должен быть свой id,
// иначе скринридер не поймёт, каким именно меню управляет триггер.
let dropdownInstanceCounter = 0;

// Тот же aria-controls, но для кнопки мобильного меню. Навбар на странице
// один, поэтому здесь хватает фиксированного id.
const NAV_LINKS_ID = "nav-primary-links";

/**
 * Дропдаун навбара. `title` — строка или узел (аватар в меню аккаунта),
 * `options.className` — модификатор (`dropdown--mega`, `nav-account`),
 * `options.label` — подпись триггера для скринридера, если в нём не текст.
 */
function createDropdown(title, links, activePage, options = {}) {
  const dropdown = document.createElement("div");
  dropdown.className = "dropdown";
  if (options.className) dropdown.classList.add(options.className);

  const content = document.createElement("div");
  content.className = "dropdown-content";
  content.id = `nav-dropdown-${++dropdownInstanceCounter}`;

  // Именно <button>, а не <a>: ссылка без href выпадает из обхода Tab,
  // из-за чего разделы навбара вообще нельзя было открыть с клавиатуры.
  const button = document.createElement("button");
  button.type = "button";
  if (typeof title === "string") button.textContent = title;
  else button.appendChild(title);
  if (options.label) button.setAttribute("aria-label", options.label);
  button.className = "dropdown-btn";
  button.setAttribute("aria-haspopup", "true");
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-controls", content.id);
  dropdown.appendChild(button);

  // Триггер подсвечен, когда текущая страница — одна из его ссылок.
  if (appendDropdownItems(content, links, activePage))
    button.classList.add("active");

  dropdown.appendChild(content);

  function setExpanded(open) {
    button.setAttribute("aria-expanded", open ? "true" : "false");
  }

  // Раскрытие на десктопе делает CSS (:hover / :focus-within), поэтому JS
  // не «открывает» меню, а лишь снимает подавление и держит aria-expanded
  // в согласии с тем, что реально видно.
  function dismiss() {
    dropdown.classList.add("dropdown-dismissed");
    dropdown.classList.remove("open");
    setExpanded(false);
  }
  function undismiss() {
    dropdown.classList.remove("dropdown-dismissed");
  }

  // Добавляем обработчик для мобильной версии
  button.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation(); // Предотвращаем всплытие события
    const isMobile = window.innerWidth <= 768;
    if (!isMobile) {
      // На десктопе клик по триггеру ничего не переключает, но фокус после
      // него остаётся на кнопке — снимаем подавление, иначе меню, закрытое
      // до этого по Escape, обратно не откроется.
      undismiss();
      setExpanded(true);
      return;
    }
    const wasOpen = dropdown.classList.contains("open");

    // Закрываем все открытые дропдауны
    document.querySelectorAll(".dropdown.open").forEach((otherDropdown) => {
      otherDropdown.classList.remove("open");
    });

    // Если дропдаун не был открыт, открываем его
    if (!wasOpen) {
      undismiss();
      dropdown.classList.add("open");
      setExpanded(true);
    } else {
      // Повторный тап закрывает — но фокус остаётся на кнопке внутри
      // .dropdown, а значит :focus-within открыл бы список обратно.
      dismiss();
    }
  });

  dropdown.addEventListener("keydown", function (e) {
    if (e.key === "Escape" || e.key === "Esc") {
      dismiss();
      // Фокус обязан вернуться на триггер: иначе после закрытия он падает
      // на <body> и следующий Tab начинает обход навигации заново.
      button.focus();
      return;
    }
    if (e.key === "ArrowDown" || e.key === "Down") {
      // Стрелка вниз с триггера — вход в список без прохода Tab'ом.
      const first = content.querySelector("a, button");
      if (first) {
        undismiss();
        setExpanded(true);
        if (e.target === button) {
          e.preventDefault();
          first.focus();
        }
      }
      return;
    }
    if (e.key === "Tab") {
      // Уход по Tab — обычное закрытие, подавление снимаем, чтобы
      // возврат Shift+Tab снова открывал меню.
      undismiss();
    }
  });

  // aria-expanded должен повторять то, что показывает CSS: меню видно, пока
  // внутри .dropdown есть фокус или курсор.
  dropdown.addEventListener("focusin", function () {
    if (!dropdown.classList.contains("dropdown-dismissed")) setExpanded(true);
  });
  dropdown.addEventListener("focusout", function (e) {
    if (!e.relatedTarget || !dropdown.contains(e.relatedTarget)) {
      undismiss();
      setExpanded(false);
    }
  });
  dropdown.addEventListener("mouseenter", function () {
    undismiss();
    setExpanded(true);
  });
  dropdown.addEventListener("mouseleave", function () {
    if (!dropdown.contains(document.activeElement)) setExpanded(false);
  });

  // Закрываем дропдаун при клике вне его
  document.addEventListener("click", function (e) {
    if (!dropdown.contains(e.target)) {
      dropdown.classList.remove("open");
    }
  });

  return dropdown;
}

const NAV_ROLE_CACHE_KEY = "datalab_nav_role_cache_v1";
const NAV_ROLE_CACHE_TTL = 24 * 60 * 60 * 1000;

// «Только материалы» отчётов не пишут (сервер им и откажет): формат кладётся
// атрибутом на <html>, а ссылки на отчёты прячет одно правило в navigation.css.
// Кэш в localStorage — чтобы пункт меню не мигал на каждой странице.
const NAV_FORMAT_CACHE_KEY = "datalab_nav_learning_format_v1";
function applyLearningFormat(format) {
  const materials = format === "materials";
  if (materials) document.documentElement.dataset.learningFormat = "materials";
  else delete document.documentElement.dataset.learningFormat;
  try {
    if (materials) localStorage.setItem(NAV_FORMAT_CACHE_KEY, "materials");
    else localStorage.removeItem(NAV_FORMAT_CACHE_KEY);
  } catch (error) {
    /* ignore */
  }
}
try {
  if (localStorage.getItem(NAV_FORMAT_CACHE_KEY) === "materials")
    document.documentElement.dataset.learningFormat = "materials";
} catch (error) {
  /* ignore */
}

function isCuratorNavigationRole(role) {
  return (
    role === "curator" ||
    role === "admin-helper" ||
    role === "mentor" ||
    role === "admin"
  );
}

function readCachedNavigationRole() {
  try {
    const raw = localStorage.getItem(NAV_ROLE_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (!cached || !cached.uid || !cached.role || !cached.updatedAt)
      return null;
    if (Date.now() - cached.updatedAt > NAV_ROLE_CACHE_TTL) return null;
    return cached;
  } catch (error) {
    return null;
  }
}

function writeCachedNavigationRole(uid, role) {
  try {
    if (!uid || !role) return;
    localStorage.setItem(
      NAV_ROLE_CACHE_KEY,
      JSON.stringify({
        uid,
        role,
        updatedAt: Date.now(),
      }),
    );
  } catch (error) {
    /* ignore */
  }
}

function clearCachedNavigationRole() {
  try {
    localStorage.removeItem(NAV_ROLE_CACHE_KEY);
  } catch (error) {
    /* ignore */
  }
}

function getInitialNavigationVariant() {
  const cached = readCachedNavigationRole();
  return isCuratorNavigationRole(cached?.role) ? "curator" : "default";
}

function getInitialNavigationRole() {
  return readCachedNavigationRole()?.role || null;
}

function getCabinetNavigationLink(role) {
  if (role === "curator" || role === "admin-helper") {
    return { href: "/curator/student.html", text: t("Кабинет"), id: "curator" };
  }

  return {
    href: "/mentor-stats/index.html",
    text: t("Кабинет"),
    id: "mentor-stats",
  };
}

// Колонки мега-меню «Материалы». Новая колонка (например, «Аналитика») —
// ещё один элемент массива, вёрстка сетки подстроится сама.
function materialColumns() {
  return [
    {
      title: t("Основы"),
      links: [
        {
          href: "/python/",
          text: "Python",
          id: "python",
          icon: "python",
          hint: t("Синтаксис, ООП, библиотеки"),
        },
        {
          href: "/math/",
          text: t("Математика"),
          id: "math",
          icon: "math",
          hint: t("Алгебра, анализ, вероятности"),
        },
        {
          href: "/db/",
          text: t("Базы данных"),
          id: "db",
          icon: "db",
          hint: "SQL, PostgreSQL, Redis, DWH",
        },
        {
          href: "/github/",
          text: "Git",
          id: "github",
          icon: "online-git",
          hint: t("Коммиты, ветки, GitHub"),
        },
        {
          href: "/linux/",
          text: "Linux",
          id: "linux",
          icon: "online-linux",
          hint: t("Терминал и командная строка"),
        },
      ],
    },
    {
      title: "Machine Learning",
      links: [
        {
          href: "/ai/ml/",
          text: t("Машинное обучение"),
          id: "ml",
          icon: "ml",
          hint: t("Классика, DL, NLP, CV"),
        },
        {
          href: "/ai/mlops/",
          text: "MLOps",
          id: "mlops",
          icon: "online-mlops",
          hint: t("Docker, Kubernetes, мониторинг"),
        },
        {
          href: "/practise/",
          text: t("Практика"),
          id: "practise",
          icon: "online-practice",
          hint: t("Задачи по Python, SQL и ML"),
        },
        {
          href: "/bank/",
          text: t("Банк вопросов"),
          id: "bank",
          icon: "online-bank",
          hint: t("Вопросы с реальных собесов"),
        },
      ],
    },
    {
      title: t("Аналитика"),
      links: [
        {
          href: "/analytics/index.html",
          text: t("Продуктовая аналитика"),
          id: "analytics-hub",
          icon: "topics-progress",
          hint: t("Все разделы: A/B, метрики, BI"),
        },
        {
          href: "/analytics/product/ab.html",
          text: "A/B-тестирование",
          id: "analytics-ab",
          icon: "probability",
          hint: t("Статистика, дизайн, CUPED"),
        },
        {
          href: "/analytics/product/metrics.html",
          text: t("Продуктовые метрики"),
          id: "analytics-metrics",
          icon: "leaderboard",
          hint: t("Retention, воронки, экономика"),
        },
        {
          href: "/analytics/product/research.html",
          text: t("Исследования и BI"),
          id: "analytics-research",
          icon: "research",
          hint: t("Causal, логирование, DataLens"),
        },
        {
          href: "/analytics/bank/product.html",
          text: t("Практика и собесы"),
          id: "analytics-bank",
          icon: "interviews",
          hint: t("Тренажёр A/B и банк вопросов"),
        },
      ],
    },
  ];
}

function createMaterialsMenuItems() {
  return [
    {
      className: "dropdown-mega__top",
      items: [
        {
          href: "/roadmap/index.html",
          text: t("Карта разделов"),
          id: "materials-map",
        },
        {
          href: "/roadmap/interactive.html",
          text: t("Интерактивная: ML"),
          id: "materials-map-interactive",
          className: "dropdown-mega__secondary",
        },
        {
          href: "/analytics/roadmap/interactive.html",
          text: t("Интерактивная: Аналитика"),
          id: "materials-map-analytics",
          className: "dropdown-mega__secondary",
        },
      ],
    },
    {
      className: "dropdown-mega__columns",
      items: materialColumns().map((column) => ({
        title: column.title,
        items: column.links,
      })),
    },
    {
      className: "dropdown-mega__footer",
      items: [
        { href: "/materials/", text: t("Доп. источники и литература"), id: "materials" },
      ],
    },
  ];
}

// ── Меню аккаунта: аватар, профиль, оформление, язык, выход ────────────────
//
// Аватар и имя читаются точечно в applyRoleNavigation (avatarUrl, firstName,
// displayName) — навбар пересобирается при смене роли, поэтому данные живут
// здесь, а не в самом узле.

let navAccountInfo = null; // { avatarUrl, name } после входа

const GENERIC_AVATAR_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="8" r="4" fill="currentColor"/><path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" fill="currentColor"/></svg>';

function fillNavAvatar(avatar) {
  const name = String(navAccountInfo?.name || "").trim();
  const initial = name ? name[0].toUpperCase() : "";
  avatar.textContent = "";
  avatar.innerHTML = "";
  if (navAccountInfo?.avatarUrl) {
    const image = document.createElement("img");
    image.src = navAccountInfo.avatarUrl;
    image.alt = "";
    image.decoding = "async";
    // Битая ссылка на аватар — показываем букву, а не пустой кружок.
    image.addEventListener("error", () => {
      navAccountInfo = { ...navAccountInfo, avatarUrl: null };
      fillNavAvatar(avatar);
    });
    avatar.appendChild(image);
  } else if (initial) {
    avatar.textContent = initial;
  } else {
    avatar.innerHTML = GENERIC_AVATAR_SVG;
  }
}

function renderNavAvatars() {
  document.querySelectorAll(".nav-avatar").forEach(fillNavAvatar);
}

// То же, что делала кнопка «Выйти» на главной. auth.signOut подменён в
// authGuard.js: он ещё и закрывает сессию входа на сервере.
function navLogout() {
  if (!window.confirm(t("Выйти из аккаунта?"))) return;
  try {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
  } catch (error) {
    /* ignore */
  }
  const done = () => {
    window.location.href = "/index.html";
  };
  // firebase.auth() бросает синхронно, если приложение не поднялось: тогда
  // хранилище уже очищено, и без редиректа человек остался бы на странице.
  try {
    if (window.firebase?.apps?.length) {
      firebase.auth().signOut().then(done, done);
      return;
    }
  } catch (error) {
    /* уходим на вход в любом случае */
  }
  done();
}

function createMenuButton(text, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = text;
  button.addEventListener("click", onClick);
  return button;
}

function createAccountMenu(activePage) {
  const avatar = document.createElement("span");
  avatar.className = "nav-avatar";
  avatar.setAttribute("aria-hidden", "true");
  fillNavAvatar(avatar);

  const appearance = createMenuButton(t("Оформление"), openAppearanceModal);
  // id читают init-head.js и updateThemeIcon; класс appearance-trigger
  // говорит им не переписывать подпись названием палитры.
  appearance.id = "theme-toggle-nav";
  appearance.className = "appearance-trigger";

  const logout = createMenuButton(t("Выйти"), navLogout);
  logout.className = "nav-logout-item";

  return createDropdown(
    avatar,
    [
      { href: "/profile.html", text: t("Профиль"), id: "profile" },
      { href: "/news.html", text: t("Новости"), id: "news" },
      { href: "/suggestions.html", text: t("Предложения"), id: "suggestions" },
      { element: appearance },
      { element: createLanguageToggle() },
      { element: logout },
    ],
    activePage,
    { className: "nav-account", label: t("Меню аккаунта") },
  );
}

function isMacPlatform() {
  return /Mac|iPod|iPhone|iPad/.test(window.navigator?.platform || "");
}

// Поиск выглядит как поле ввода, но открывает палитру ⌘K — тот же каталог,
// что и по сочетанию клавиш.
function createSearchTrigger() {
  const mac = isMacPlatform();
  const button = document.createElement("button");
  button.type = "button";
  button.className = "nav-search-btn";
  button.setAttribute("aria-label", t("Поиск"));
  button.setAttribute("aria-keyshortcuts", mac ? "Meta+K" : "Control+K");
  button.innerHTML =
    '<svg class="nav-search-btn__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="m20 20-3.5-3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
    `<span class="nav-search-btn__label">${t("Поиск")}</span>` +
    `<kbd aria-hidden="true">${mac ? "⌘K" : "Ctrl K"}</kbd>`;
  button.addEventListener("click", function () {
    if (typeof window.openCommandPalette === "function")
      window.openCommandPalette();
  });
  return button;
}

function createNavigation(options = {}) {
  if (window.skipNavigation) return null;

  const nav = document.createElement("nav");
  nav.id = "navbar";
  nav.dataset.navVariant = options.variant || "default";
  nav.dataset.navRole = options.role || "student";

  // На странице бывает несколько <nav>; без имени скринридер объявляет их
  // одинаково и не даёт выбрать нужный.
  nav.setAttribute("aria-label", t("Основная навигация"));

  // На десктопе .nav-links — display: contents: его пункты встают в общий
  // ряд навбара, а меню аккаунта CSS уводит в правый край. На телефоне это
  // выезжающая панель, и пункты аккаунта оказываются в её конце.
  const linkContainer = document.createElement("div");
  linkContainer.className = "nav-links";
  linkContainer.id = NAV_LINKS_ID;

  // Добавляем кнопку мобильного меню
  const mobileMenuBtn = document.createElement("button");
  mobileMenuBtn.type = "button";
  mobileMenuBtn.className = "mobile-menu-btn";
  mobileMenuBtn.innerHTML = "☰";
  // Подпись кнопки — «☰», скринридер прочитал бы её как безымянную кнопку.
  mobileMenuBtn.setAttribute("aria-label", t("Меню навигации"));
  mobileMenuBtn.setAttribute("aria-expanded", "false");
  mobileMenuBtn.setAttribute("aria-controls", NAV_LINKS_ID);
  mobileMenuBtn.onclick = () => {
    const shown = linkContainer.classList.toggle("show");
    mobileMenuBtn.innerHTML = shown ? "✕" : "☰";
    mobileMenuBtn.setAttribute("aria-expanded", shown ? "true" : "false");
  };
  nav.appendChild(mobileMenuBtn);

  const activePage = getActivePage();

  // Логотип ведёт на главную (раньше — пункт «🏠 Домой»).
  const logo = document.createElement("a");
  logo.href = typeof window.normalizeSiteUrl === "function" ? window.normalizeSiteUrl("/main.html") : "/main.html";
  logo.className = "nav-logo";
  logo.setAttribute("aria-label", t("DataLab — на главную"));
  logo.innerHTML =
    ('<img src="' + (typeof window.normalizeSiteUrl === 'function' ? window.normalizeSiteUrl('/favicon.svg') : '/favicon.svg') + '" alt="" width="28" height="28" />') +
    '<span class="nav-logo__text">DataLab</span>';
  if (activePage === "home") logo.setAttribute("aria-current", "page");
  nav.appendChild(logo);

  linkContainer.appendChild(
    createDropdown(t("Материалы"), createMaterialsMenuItems(), activePage, {
      className: "dropdown--mega",
    }),
  );

  // Дропдаун "Прогресс"
  const progressLinks = [
    { href: "/spaced-repetition.html", text: t("Повторение карточек"), id: "spaced-repetition" },
    { href: "/calender/", text: t("Доска задач"), id: "calender" },
    { href: "/leaderboard.html", text: t("Лидерборд"), id: "leaderboard" },
    { href: "/my-reports.html", text: t("Отчеты"), id: "my-reports" },
    { href: "/tests/", text: t("Тесты"), id: "tests" },
    { href: "/achievements.html", text: t("Достижения"), id: "achievements" },
  ];
  linkContainer.appendChild(
    createDropdown(t("Прогресс"), progressLinks, activePage),
  );

  linkContainer.appendChild(
    createSimpleLink(
      { href: "/ai/interviews/", text: t("Собесы"), id: "interviews" },
      activePage,
    ),
  );

  if (options.variant === "curator") {
    const cabinetLink = getCabinetNavigationLink(options.role);
    const cabinetLinkElement = createSimpleLink(cabinetLink, activePage);
    const isMentorStatsPage =
      window.location.pathname.includes("/mentor-stats/");
    if (
      cabinetLink.id === "curator"
        ? activePage === "curator"
        : isMentorStatsPage
    ) {
      cabinetLinkElement.classList.add("active");
      cabinetLinkElement.setAttribute("aria-current", "page");
    }
    linkContainer.appendChild(cabinetLinkElement);
  }

  nav.appendChild(linkContainer);

  nav.appendChild(createSearchTrigger());
  nav.appendChild(createOnlineBadge(options.role));

  // Меню аккаунта — последним и в DOM, и визуально: Tab идёт слева
  // направо (поиск, бейджи, аватар), как видит глаз.
  nav.appendChild(createAccountMenu(activePage));

  return nav;
}

// ── Язык интерфейса ─────────────────────────────────────────────────────────
//
// Выбор живёт в localStorage (его читает theme-boot до первой отрисовки) и в
// users/<uid>/lang — чтобы переехать на другое устройство. Выбор на этом
// устройстве главнее: профиль только подхватывает его, а устройство без
// выбора один раз берёт язык из профиля.

let languageSync = null; // { db, uid } после входа

function readStoredLanguage() {
  try {
    const value = localStorage.getItem("lang");
    return value === "en" || value === "ru" ? value : null;
  } catch (error) {
    return null;
  }
}

function currentLanguage() {
  return window.i18n?.lang === "en" ? "en" : "ru";
}

// Каталоги материалов — тот же список, что scripts/_lib/en-pages.js (MATERIAL_DIRS).
const MATERIAL_PATH =
  /^\/(ai|python|math|db|github|linux|practise|bank|roadmap|materials)(\/|$)/;
function isMaterialPath(pathname) {
  return MATERIAL_PATH.test(pathname);
}

function isEnglishMaterialPath(pathname) {
  return /^\/en(\/|$)/.test(pathname);
}

async function switchLanguage(next) {
  window.i18n?.remember(next);
  if (languageSync) {
    try {
      await languageSync.db.ref(`users/${languageSync.uid}/lang`).set(next);
    } catch (error) {
      /* устройство запомнило выбор — профиль догонит при следующем входе */
    }
  }
  // Английские копии материалов живут под /en/: уходя на русский, покидаем
  // их, а переходя на английский со страницы материала — идём в копию.
  const { pathname, search, hash } = window.location;
  if (next === "en" && isMaterialPath(pathname)) {
    window.location.href = `/en${pathname}${search}${hash}`;
    return;
  }
  if (next === "ru" && isEnglishMaterialPath(pathname)) {
    window.location.href =
      (pathname.replace(/^\/en/, "") || "/") + search + hash;
    return;
  }
  window.location.reload();
}

function syncLanguageWithProfile(db, uid, profileLang) {
  languageSync = { db, uid };
  const stored = readStoredLanguage();
  const saved =
    profileLang === "en" || profileLang === "ru" ? profileLang : null;
  if (stored) {
    if (saved !== stored)
      db.ref(`users/${uid}/lang`)
        .set(stored)
        .catch(() => {});
    return;
  }
  if (
    saved &&
    saved !== currentLanguage() &&
    !isEnglishMaterialPath(window.location.pathname)
  ) {
    window.i18n?.remember(saved);
    // Перезагрузка — только если выбор записался: при запрещённом
    // localStorage (или без сниппета) каждая загрузка снова видела бы пустое
    // хранилище и перезагружала страницу бесконечно.
    if (readStoredLanguage() === saved) window.location.reload();
  }
}

function createLanguageToggle() {
  const next = currentLanguage() === "en" ? "ru" : "en";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "nav-lang-btn";
  button.textContent = next === "en" ? "English" : "Русский";
  // Подпись — на том языке, на который переключаем: её должен понять тот,
  // кто текущего языка не знает.
  button.lang = next;
  button.title = next === "en" ? "Switch to English" : "Переключить на русский";
  button.setAttribute("aria-label", button.title);
  button.addEventListener("click", () => switchLanguage(next));
  return button;
}

function isStaffNavigationRole(role) {
  return (
    role === "mentor" ||
    role === "admin" ||
    role === "curator" ||
    role === "admin-helper"
  );
}

// ── Онлайн: сколько учеников сейчас на сайте ───────────────────────────────
//
// Число считает сервер раз в 5 минут (functions/online-presence.js) и кладёт
// в online_public — один крошечный узел, общий для всех. Персоналу бейдж
// служит ссылкой на страницу со статистикой. По наведению (или фокусу — на
// телефоне это тап) раскрывается «кто где»: счётчики по разделам без имён.
// Ключ раздела собирает authGuard.js (presenceSectionKey), названия — отсюда.

// Подпись раздела — [иконка, текст]. Иконка — имя файла из /assets/icons/ в
// общем стиле сайта (градиентная плитка с белым глифом); эмодзи здесь не
// используются: на разных системах они выглядят по-разному и спорят с навбаром.
const ONLINE_PAGE_LABELS = {
  main: ["online-home", t("На главной")],
  "spaced-repetition": ["topics-progress", t("Повторяют карточки")],
  leaderboard: ["leaderboard", t("Смотрят лидерборд")],
  // achievements.svg — спрайт символов, как картинка он пустой: у строки своя иконка.
  achievements: ["online-achievements", t("Смотрят достижения")],
  "my-reports": ["online-report", t("Пишут отчёт")],
  news: ["online-news", t("Читают новости")],
};
const ONLINE_GROUP_LABELS = {
  python: ["python", "Python"],
  math: ["math", t("Математика")],
  ml: ["ml", "ML"],
  mlops: ["online-mlops", "MLOps"],
  linux: ["online-linux", "Linux"],
  db: ["db", t("Базы данных")],
  github: ["online-git", "GitHub"],
  practise: ["online-practice", t("Практика")],
  bank: ["online-bank", t("Банк вопросов")],
  interviews: ["interviews", t("Собеседования")],
  roadmap: ["roadmap", t("Роадмап")],
  profile: ["online-profile", t("Профиль")],
  guide: ["guide", t("Гайд")],
};
const ONLINE_OTHER_LABEL = ["online-other", t("Другие страницы")];
let onlineCategoryLabels = null;
let onlineCategoryLabelsLoading = null;

/** Раздел по ключу присутствия: ML-материалы лежат под ai/, группа — сегмент после него. */
function onlineGroup(key) {
  return key.replace(/^(en__)?(ai__)?/, "").split("__")[0];
}

/** Иконка страницы вопросов: своя у NLP, иначе — по первому сегменту пути. */
function onlineSectionIcon(key) {
  if (key.replace(/^en__/, "").startsWith("ai__ml__nlp")) return "nlp";
  const group = onlineGroup(key);
  return Object.hasOwn(ONLINE_GROUP_LABELS, group)
    ? ONLINE_GROUP_LABELS[group][0]
    : ONLINE_OTHER_LABEL[0];
}

/**
 * Строки поповера `[текст, число, иконка]`: счётчики разделов, склеенные по
 * названию, крупные сверху, «Другие страницы» — в конце.
 */
function onlineSectionRows(sections, categoryLabels) {
  const totals = new Map();
  for (const [key, count] of Object.entries(sections || {})) {
    // Object.hasOwn: ключ приходит из базы, а "constructor" на обычном объекте
    // нашёл бы унаследованную функцию вместо названия.
    const own = (map, name) =>
      map && Object.hasOwn(map, name) ? map[name] : null;
    const category = own(categoryLabels, key);
    const [icon, label] = category
      ? [onlineSectionIcon(key), category]
      : own(ONLINE_PAGE_LABELS, key) ||
        own(ONLINE_GROUP_LABELS, onlineGroup(key)) ||
        ONLINE_OTHER_LABEL;
    const row = totals.get(label) || { count: 0, icon };
    row.count += Number(count) || 0;
    totals.set(label, row);
  }
  const other = ONLINE_OTHER_LABEL[1];
  return [...totals.entries()]
    .filter(([, row]) => row.count > 0)
    .sort(
      ([leftLabel, left], [rightLabel, right]) =>
        (leftLabel === other) - (rightLabel === other) ||
        right.count - left.count,
    )
    .map(([label, row]) => [label, row.count, row.icon]);
}

/** Иконка строки загружается из файла раздела. */
function createOnlineSectionIcon(icon) {
  const image = document.createElement("img");
  image.className = "nav-online-popover__icon";
  image.src = `/assets/icons/${icon}.svg`;
  image.alt = "";
  image.width = 18;
  image.height = 18;
  image.decoding = "async";
  return image;
}

function renderOnlineSections() {
  const rows = onlineSectionRows(onlineLast?.sections, onlineCategoryLabels);
  const minutes =
    Number(onlineLast?.sampleMinutes) || ONLINE_DEFAULT_STEP_MINUTES;
  document.querySelectorAll(".nav-online-popover").forEach((popover) => {
    const head = document.createElement("span");
    head.className = "nav-online-popover__head";
    head.textContent = t("Учеников на сайте за последние {minutes} минут", {
      minutes,
    });
    popover.hidden = false;
    popover.replaceChildren(
      head,
      ...rows.map(([label, count, icon]) => {
        const row = document.createElement("span");
        row.className = "nav-online-popover__row";
        const name = document.createElement("span");
        name.className = "nav-online-popover__name";
        name.append(createOnlineSectionIcon(icon), label);
        // span, а не strong: глобальное правило strong красит текст градиентом.
        const value = document.createElement("span");
        value.className = "nav-online-popover__count";
        value.textContent = String(count);
        row.append(name, value);
        return row;
      }),
    );
  });
}

// Названия разделов нужны только тому, кто раскрыл поповер, — конфиг
// подгружается по первому наведению, а не на каждой странице платформы.
function loadOnlineCategoryLabels() {
  // Кэшируется обещание, а не результат: неудачная загрузка (сеть моргнула)
  // сбрасывает его, и следующее наведение пробует снова.
  onlineCategoryLabelsLoading ||= (async () => {
    try {
      const loader = window.categoriesConfigLoader;
      const config = loader?.loadCategoriesConfig
        ? await loader.loadCategoriesConfig()
        : await (
            await fetch("/assets/js/config/categories-config.json")
          ).json();
      const labels = {};
      for (const category of Object.values(config.categories || {})) {
        const label = String(
          category.displayNameRu || category.displayName || "",
        ).trim();
        for (const pagePath of category.questionPaths || []) {
          labels[window.presenceSectionKey(`/${pagePath}`)] = label;
          // Английская копия страницы (/en/…) — тот же раздел.
          labels[window.presenceSectionKey(`/en/${pagePath}`)] = label;
        }
      }
      onlineCategoryLabels = labels;
      renderOnlineSections();
    } catch (error) {
      // Без конфига разделы подпишутся группами (Python, ML, …) — тоже читаемо.
      onlineCategoryLabelsLoading = null;
    }
  })();
  return onlineCategoryLabelsLoading;
}

// Замер считается устаревшим после двух с половиной пропущенных шагов; шаг
// публикует сервер (online_public/sampleMinutes), время — тоже серверное:
// часы ученика могут врать на десятки минут.
const ONLINE_STALE_STEPS = 2.5;
// Первая версия замера шаг не публиковала и считала раз в 20 минут: пока
// функции не передеплоены, порог устаревания обязан исходить из её шага.
const ONLINE_DEFAULT_STEP_MINUTES = 20;
let onlineClockOffset = 0;
let onlineLast = null;
let onlineSubscribed = false;

function renderOnlineCount() {
  // Замеры встали (функция не задеплоена или упала) — старое число не показываем.
  const stepMs =
    (Number(onlineLast?.sampleMinutes) || ONLINE_DEFAULT_STEP_MINUTES) *
    60 *
    1000;
  const fresh =
    onlineLast &&
    Date.now() + onlineClockOffset - Number(onlineLast.updatedAt) <
      stepMs * ONLINE_STALE_STEPS;
  document.querySelectorAll(".nav-online-badge").forEach((badge) => {
    badge.hidden = !fresh;
    if (!fresh) return;
    const count = Number(onlineLast.count) || 0;
    badge.querySelector("[data-online-count]").textContent = String(count);
  });
  renderOnlineSections();
}

function createOnlineBadge(role) {
  const isStaff = isStaffNavigationRole(role);
  const badge = document.createElement(isStaff ? "a" : "span");
  if (isStaff) badge.href = "/mentor-stats/online.html";
  badge.className = "nav-online-badge";
  badge.hidden = true;
  badge.innerHTML =
    '<span class="nav-online-badge__dot" aria-hidden="true"></span>' +
    `<span data-online-count>0</span><span class="nav-online-badge__word"> ${t("онлайн")}</span>` +
    '<span class="nav-online-popover" id="nav-online-popover" role="tooltip" hidden></span>';
  // Содержимое бейджа («12 онлайн») читается само, подробности — описанием.
  badge.setAttribute("aria-describedby", "nav-online-popover");
  if (!isStaff) badge.tabIndex = 0; // фокус = тап на телефоне
  if (typeof window.presenceSectionKey === "function") {
    badge.addEventListener("mouseenter", loadOnlineCategoryLabels);
    badge.addEventListener("focusin", loadOnlineCategoryLabels);
  }
  // Навбар пересобирается после чтения роли — новый бейдж рисуем сразу.
  setTimeout(renderOnlineCount, 0);
  return badge;
}

function mountOnlineBadge(db) {
  if (onlineSubscribed) return;
  onlineSubscribed = true;
  // Замеры встали — новых событий не будет, прятать число приходится по таймеру.
  setInterval(renderOnlineCount, 5 * 60 * 1000);
  db.ref(".info/serverTimeOffset").on("value", (snapshot) => {
    onlineClockOffset = Number(snapshot.val()) || 0;
  });
  db.ref("online_public").on(
    "value",
    (snapshot) => {
      onlineLast = snapshot.val();
      renderOnlineCount();
    },
    () => {
      // Правила ещё не выпущены — бейдж остаётся скрытым.
    },
  );
}

async function getNavigationFirebaseConfig() {
  if (window.configLoader && window.configLoader.loadFirebaseConfig) {
    return window.configLoader.loadFirebaseConfig();
  }
  const response = await fetch("/config/firebase-config.json");
  return response.json();
}

function waitForFirebaseAuth(timeoutMs = 2500) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    function check() {
      if (window.firebase && firebase.auth && firebase.database) {
        resolve();
        return;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        reject(
          new Error("Firebase SDK is not available for navigation role check"),
        );
        return;
      }
      setTimeout(check, 120);
    }
    check();
  });
}

async function applyRoleNavigation() {
  try {
    await waitForFirebaseAuth();
    const cfg = await getNavigationFirebaseConfig();
    const app = firebase.apps.length
      ? firebase.app()
      : firebase.initializeApp(cfg);
    const auth = firebase.auth(app);
    const db = firebase.database(app);
    auth.onAuthStateChanged(async (user) => {
      if (!user) {
        languageSync = null;
        navAccountInfo = null;
        renderNavAvatars();
        clearCachedNavigationRole();
        applyLearningFormat(null);
        const currentNav = document.querySelector("#navbar");
        if (currentNav?.dataset.navVariant === "curator") {
          const defaultNavigation = createNavigation({ variant: "default" });
          if (defaultNavigation) currentNav.replaceWith(defaultNavigation);
        }
        return;
      }
      // Точечные чтения, а не users/<uid> целиком (DATA_ACCESS_STANDARD.md).
      const [
        roleSnap,
        formatSnap,
        langSnap,
        avatarSnap,
        firstNameSnap,
        displayNameSnap,
      ] = await Promise.all([
        db.ref(`users/${user.uid}/role`).once("value"),
        db.ref(`users/${user.uid}/learningFormat`).once("value"),
        db.ref(`users/${user.uid}/lang`).once("value"),
        db.ref(`users/${user.uid}/avatarUrl`).once("value"),
        db.ref(`users/${user.uid}/firstName`).once("value"),
        db.ref(`users/${user.uid}/displayName`).once("value"),
      ]);
      navAccountInfo = {
        avatarUrl: avatarSnap.val() || null,
        name: firstNameSnap.val() || displayNameSnap.val() || user.email || "",
      };
      renderNavAvatars();
      syncLanguageWithProfile(db, user.uid, langSnap.val());
      const role = roleSnap.val();
      writeCachedNavigationRole(user.uid, role || "student");
      mountOnlineBadge(db);
      applyLearningFormat(
        isStaffNavigationRole(role) ? null : formatSnap.val(),
      );
      const currentNav = document.querySelector("#navbar");
      const expectedVariant = isCuratorNavigationRole(role)
        ? "curator"
        : "default";
      if (
        currentNav?.dataset.navVariant === expectedVariant &&
        currentNav?.dataset.navRole === (role || "student")
      ) {
        return;
      }
      const nextNavigation = createNavigation({
        variant: expectedVariant,
        role: role || "student",
      });
      if (!nextNavigation) return;
      if (currentNav) currentNav.replaceWith(nextNavigation);
      else insertNavigationIntoBody(nextNavigation);
      renderMathInNavigation();
      updateThemeIcon();
    });
  } catch (error) {
    // На страницах без Firebase SDK оставляем обычную навигацию.
  }
}

function renderMathInNavigation() {
  // Рендерим KaTeX формулы в навигации
  const navbar = document.querySelector("#navbar");
  if (!navbar) return;

  // Проверяем доступность renderMathInElement с повторной попыткой
  if (typeof renderMathInElement === "function") {
    try {
      renderMathInElement(navbar, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "$", right: "$", display: false },
          { left: "\\(", right: "\\)", display: false },
          { left: "\\[", right: "\\]", display: true },
        ],
        throwOnError: false,
      });
    } catch (error) {
      console.warn("Error rendering Math in navigation:", error);
    }
  } else {
    // Если KaTeX еще не загружен, пробуем через небольшую задержку
    setTimeout(() => {
      if (typeof renderMathInElement === "function") {
        try {
          renderMathInElement(navbar, {
            delimiters: [
              { left: "$$", right: "$$", display: true },
              { left: "$", right: "$", display: false },
              { left: "\\(", right: "\\)", display: false },
              { left: "\\[", right: "\\]", display: true },
            ],
            throwOnError: false,
          });
        } catch (error) {
          console.warn("Error rendering Math in navigation (retry):", error);
        }
      }
    }, 100);
  }
}

// Навбар встаёт ПОСЛЕ skip-link, а не первым узлом body. Иначе первый Tab на
// странице уходит в меню, и ссылка «к содержимому» теряет весь смысл: до неё
// пришлось бы протабать всю навигацию. Ссылки в разметке может не быть —
// тогда поведение прежнее.
function insertNavigationIntoBody(navigation) {
  let anchor = document.body.firstChild;
  const children = document.body.children || [];
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    // Перебираем только сплошной блок skip-link'ов в начале body: такая же
    // ссылка где-то ниже по странице не должна утащить навигацию за собой.
    if (!child.classList || !child.classList.contains("skip-link")) break;
    anchor = child.nextSibling;
  }
  document.body.insertBefore(navigation, anchor);
}
function insertNavigation() {
  const existingNav = document.querySelector("#navbar");
  if (existingNav) existingNav.remove();

  const navigation = createNavigation({
    variant: getInitialNavigationVariant(),
    role: getInitialNavigationRole(),
  });
  if (navigation) {
    insertNavigationIntoBody(navigation);

    // Подключаем Command Palette (единый каталог ⌘K / /)
    if (!window.openCommandPalette) {
      const script = document.createElement("script");
      script.src = typeof window.normalizeSiteUrl === "function" ? window.normalizeSiteUrl("/assets/js/components/command-palette.js") : "/assets/js/components/command-palette.js";
      script.async = true;
      document.head.appendChild(script);
    }

    // Рендерим KaTeX формулы в навигации
    renderMathInNavigation();
    applyRoleNavigation();

    // Оба узла ищем внутри одного #navbar и оба проверяем на null. Раньше это
    // были два независимых document.querySelector, ничем не связанных с
    // навбаром, который существовал в момент подписки: слушатели висят на
    // document и переживают и повторный insertNavigation (он сначала удаляет
    // старый #navbar), и замену навбара в applyRoleNavigation при смене роли.
    // В любой момент между удалением и вставкой .mobile-menu-btn отсутствует,
    // а `mobileMenuBtn.contains(...)` вызывался без проверки — и в обработчике
    // resize даже без условия «меню открыто».
    function findMobileMenuNodes() {
      const navbar = document.querySelector("#navbar");
      if (!navbar) return null;
      const linkContainer = navbar.querySelector(".nav-links");
      const mobileMenuBtn = navbar.querySelector(".mobile-menu-btn");
      if (!linkContainer || !mobileMenuBtn) return null;
      return { linkContainer, mobileMenuBtn };
    }

    function closeMobileMenu(nodes) {
      nodes.linkContainer.classList.remove("show");
      nodes.mobileMenuBtn.innerHTML = "☰";
      // Иначе кнопка навсегда останется «раскрытой» для скринридера.
      nodes.mobileMenuBtn.setAttribute("aria-expanded", "false");
    }

    // Закрываем мобильное меню при клике вне его
    document.addEventListener("click", (e) => {
      const nodes = findMobileMenuNodes();
      if (!nodes) return;
      if (!nodes.linkContainer.classList.contains("show")) return;
      if (
        !nodes.linkContainer.contains(e.target) &&
        !nodes.mobileMenuBtn.contains(e.target)
      ) {
        closeMobileMenu(nodes);
      }
    });

    // Закрываем мобильное меню при изменении размера окна
    window.addEventListener("resize", () => {
      const nodes = findMobileMenuNodes();
      if (!nodes) return;
      if (window.innerWidth > 768) closeMobileMenu(nodes);
    });
  }
}

function getStoredAppearance() {
  const raw = localStorage.getItem("palette");
  const palette = window.__normalizePalette(raw || "vibecode");
  if (raw === "classic") {
    try {
      localStorage.setItem("palette", "vibecode");
    } catch (e) {
      /* ignore */
    }
  }
  return {
    theme: localStorage.getItem("theme") || "light",
    palette,
  };
}

/* Модалка оформления — единственное место, откуда тему меняют руками.
   Само применение делегировано сниппету theme-boot: он владеет и атрибутом
   html[data-theme], и зеркальным классом на body. */
function applyAppearance({ theme, palette }) {
  const nextTheme = theme || "light";
  const nextPalette = window.__applyPaletteClasses(palette);
  window.__applyTheme(window.__resolveTheme(nextTheme));

  localStorage.setItem("theme", nextTheme);
  localStorage.setItem("palette", nextPalette);

  updateThemeIcon();
  updateAppearanceModalState();

  if (typeof updateThemeIcons === "function") {
    updateThemeIcons();
  }
}

function updateThemeIcon() {
  const isDark = document.body.classList.contains("dark");
  const palette = window.__normalizePalette(
    localStorage.getItem("palette") || "vibecode",
  );
  const PALETTE_NAV_LABEL = {
    vibecode: "DataLab",
    earth: "Earth",
    sepia: "Sepia",
    graphite: "Graphite",
  };
  const label = PALETTE_NAV_LABEL[palette] || "DataLab";

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
}

function openAppearanceModal() {
  let modal = document.querySelector(".appearance-modal-backdrop");
  if (!modal) {
    modal = createAppearanceModal();
    window.i18n?.translate(modal);
    document.body.appendChild(modal);
  }

  updateAppearanceModalState();
  modal.hidden = false;
  requestAnimationFrame(() => modal.classList.add("show"));
}

function closeAppearanceModal() {
  const modal = document.querySelector(".appearance-modal-backdrop");
  if (!modal) return;
  modal.classList.remove("show");
  setTimeout(() => {
    modal.hidden = true;
  }, 180);
}

function createAppearanceModal() {
  const modal = document.createElement("div");
  modal.className = "appearance-modal-backdrop";
  modal.hidden = true;
  modal.innerHTML = `
    <div class="appearance-modal" role="dialog" aria-modal="true" aria-labelledby="appearance-title">
      <div class="appearance-modal__header">
        <div>
          <span class="appearance-modal__kicker">Настройки интерфейса</span>
          <h2 id="appearance-title">Оформление платформы</h2>
        </div>
        <button type="button" class="appearance-modal__close" data-appearance-close aria-label="Закрыть">×</button>
      </div>

      <section class="appearance-modal__section">
        <h3>Тема</h3>
        <div class="appearance-options" data-appearance-group="theme">
          <button type="button" class="appearance-option" data-theme-value="light">
            <span class="appearance-option__title">Светлая</span>
            <span class="appearance-option__text">Тёплый светлый фон для чтения днём.</span>
          </button>
          <button type="button" class="appearance-option" data-theme-value="dark">
            <span class="appearance-option__title">Тёмная</span>
            <span class="appearance-option__text">Контрастный режим для вечерней работы.</span>
          </button>
        </div>
      </section>

      <section class="appearance-modal__section">
        <h3>Вариант оформления</h3>
        <div class="appearance-options appearance-options--palette" data-appearance-group="palette">
          <button type="button" class="appearance-option appearance-option--vibecode" data-palette-value="vibecode">
            <span class="appearance-option__swatches">
              <span style="background:#3b6ef6"></span>
              <span style="background:#0ea5e9"></span>
            </span>
            <span class="appearance-option__title">DataLab</span>
            <span class="appearance-option__text">Глубокий обсидиан в тёмной теме, чистый сланец в светлой и сапфирово-индиговый акцент.</span>
          </button>
          <button type="button" class="appearance-option appearance-option--earth" data-palette-value="earth">
            <span class="appearance-option__swatches">
              <span style="background:#166534"></span>
              <span style="background:#92400e"></span>
            </span>
            <span class="appearance-option__title">Earth</span>
            <span class="appearance-option__text">Зелёный и коричневый, тёплая природная гамма.</span>
          </button>
          <button type="button" class="appearance-option appearance-option--sepia" data-palette-value="sepia">
            <span class="appearance-option__swatches">
              <span style="background:#9c4221"></span>
              <span style="background:#5c3d2e"></span>
            </span>
            <span class="appearance-option__title">Sepia</span>
            <span class="appearance-option__text">Тёплая «бумага», терракота и сиена — удобно для длинного чтения.</span>
          </button>
          <button type="button" class="appearance-option appearance-option--graphite" data-palette-value="graphite">
            <span class="appearance-option__swatches">
              <span style="background:#475569"></span>
              <span style="background:#64748b"></span>
            </span>
            <span class="appearance-option__title">Graphite</span>
            <span class="appearance-option__text">Нейтральный графит и сланец, мало отвлечений.</span>
          </button>
        </div>
      </section>

      <p class="appearance-modal__status" data-appearance-status role="status" aria-live="polite"></p>
    </div>
  `;

  modal.addEventListener("click", (event) => {
    if (
      event.target === modal ||
      event.target.closest("[data-appearance-close]")
    ) {
      closeAppearanceModal();
    }
  });

  modal.querySelectorAll("[data-theme-value]").forEach((button) => {
    button.addEventListener("click", () => {
      applyAppearance({
        ...getStoredAppearance(),
        theme: button.dataset.themeValue,
      });
    });
  });

  modal.querySelectorAll("[data-palette-value]").forEach((button) => {
    button.addEventListener("click", () => {
      applyAppearance({
        ...getStoredAppearance(),
        palette: button.dataset.paletteValue,
      });
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeAppearanceModal();
  });

  return modal;
}

const APPEARANCE_THEME_NAMES = {
  light: t("светлая"),
  dark: t("тёмная"),
  system: t("как в системе"),
};
const APPEARANCE_PALETTE_NAMES = {
  vibecode: "DataLab",
  earth: "Earth",
  sepia: "Sepia",
  graphite: "Graphite",
};

function updateAppearanceModalState() {
  const modal = document.querySelector(".appearance-modal-backdrop");
  if (!modal) return;

  const stored = getStoredAppearance();
  modal.querySelectorAll("[data-theme-value]").forEach((button) => {
    const active = button.dataset.themeValue === stored.theme;
    button.classList.toggle("active", active);
    // Выбор отмечался только классом: незрячий пользователь не понимал,
    // какой вариант сейчас включён.
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
  modal.querySelectorAll("[data-palette-value]").forEach((button) => {
    const active = button.dataset.paletteValue === stored.palette;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });

  // Смена темы и палитры видна только глазами — весь отклик чисто
  // визуальный. Живая область проговаривает результат.
  const status = modal.querySelector("[data-appearance-status]");
  if (status) {
    const theme = APPEARANCE_THEME_NAMES[stored.theme] || stored.theme;
    const palette = APPEARANCE_PALETTE_NAMES[stored.palette] || stored.palette;
    status.textContent = t("Тема: {theme}. Оформление: {palette}.", {
      theme,
      palette,
    });
  }
}

// Ранняя проверка доступа: сразу скрываем контент на защищённых разделах (до paint body)
(function primeMaterialAccessCheckUI() {
  if (window.__materialAccessPrimeApplied) return;
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
    "ai/interviews/",
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

// Инициализация при загрузке страницы
document.addEventListener("DOMContentLoaded", () => {
  // Тему здесь больше не восстанавливаем: к этому моменту страница уже
  // отрисована, а сниппет theme-boot применил её ещё в <head>. Осталось
  // подписать переключатель.
  insertNavigation();
  updateThemeIcon();
});
