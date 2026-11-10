/**
 * Command Palette — единый каталог платформы (⌘K / Ctrl+K / /)
 * Стеклянная панель, fuzzy-поиск, навигация с клавиатуры.
 */
(function () {
  const scriptPath = document.currentScript?.src
    ? new URL(document.currentScript.src).pathname
    : "";
  const sitePrefix = scriptPath.match(/^(.*)\/assets\/js\/components\/command-palette\.js$/)?.[1] || "";

  function navigationHref(route) {
    if (!sitePrefix || !route?.startsWith("/") || route.startsWith("//")) return route;
    if (route === sitePrefix || route.startsWith(`${sitePrefix}/`)) return route;
    return `${sitePrefix}${route}`;
  }

  // Перевод интерфейса (ядро — сниппет theme-boot). В тестах под Node его нет:
  // остаётся русский текст с подставленными значениями.
  const t =
    window.t ||
    ((text, params) =>
      text.replace(/\{(\w+)\}/g, (match, key) => params?.[key] ?? match));

  const TYPE_LABELS = {
    roadmap: "Изучение",
    practice: "Практика",
    quiz: "Тесты",
    tool: "Инструменты",
    profile: "Профиль",
    interview: "Собесы",
    page: "Страницы",
    content: "Из текста",
    action: "Действие",
  };
  const TYPE_DISPLAY_MAP = {
    material: "roadmap",
  };
  const CATEGORY_ORDER = [
    "roadmap",
    "practice",
    "quiz",
    "tool",
    "interview",
    "page",
    // Совпадения в тексте страниц стоят после страниц: пока запрос попадает
    // в название, вкладка по умолчанию должна остаться привычной, а «Из
    // текста» — становиться первой только тогда, когда по названиям ничего
    // не нашлось. renderSidebar выбирает первую непустую по этому порядку.
    "content",
    "profile",
    "action",
  ];

  function getDisplayType(type) {
    return TYPE_DISPLAY_MAP[type] || type;
  }

  function getTypeLabel(type) {
    const label = TYPE_LABELS[getDisplayType(type)];
    return label ? t(label) : "";
  }

  // Страницы роадмапа называются так же, как страницы с материалом
  // («Classic ML», «Python»…), поэтому в списке им нужна отличающая плашка.
  const ROADMAP_BADGE_LABEL = "Роадмап";

  function isRoadmapRoute(route) {
    return /^\/((?:ai|analytics)\/)?roadmap(\/|$)/.test(String(route || ""));
  }

  // Плашка нужна только самим страницам роадмапа. Одного маршрута мало:
  // на /roadmap/ ведёт ещё «Прогресс по темам» из группы «Профиль»,
  // а ей плашка только мешает.
  function getCatalogBadge(item) {
    if (item.badge) return item.badge;
    const route = item.route;
    const type = item.type || inferTypeFromRoute(route);
    return type === "roadmap" && isRoadmapRoute(route)
      ? t(ROADMAP_BADGE_LABEL)
      : "";
  }

  function toStaticCatalogItems() {
    return CATALOG.map((item, id) => ({
      ...item,
      id,
      badge: getCatalogBadge(item),
    }));
  }

  const CATALOG = [
    {
      title: "Карта разделов",
      type: "roadmap",
      tags: ["карта", "путь", "роадмап", "map", "path", "roadmap"],
      route: "/roadmap/index.html",
    },
    {
      title: "Карта разделов (интерактивная)",
      type: "roadmap",
      tags: [
        "карта",
        "интерактив",
        "визуальная",
        "map",
        "interactive",
        "visual",
      ],
      route: "/roadmap/interactive.html",
    },
    {
      title: "Пререквизиты",
      type: "roadmap",
      tags: ["база", "старт", "prerequisites", "basics", "start"],
      route: "/roadmap/prerequisites.html",
    },
    {
      title: "Математика",
      type: "roadmap",
      tags: ["math", "алгебра", "анализ", "mathematics", "algebra", "calculus"],
      route: "/roadmap/math.html",
    },
    {
      title: "Python",
      type: "roadmap",
      tags: ["python", "язык", "language"],
      route: "/roadmap/python.html",
    },
    {
      title: "Linux",
      type: "roadmap",
      tags: ["linux", "ос", "os"],
      route: "/roadmap/linux.html",
    },
    {
      title: "Classic ML",
      type: "roadmap",
      tags: ["ml", "классика", "алгоритмы", "classic", "algorithms"],
      route: "/ai/roadmap/classic_ml.html",
    },
    {
      title: "Deep Learning",
      type: "roadmap",
      tags: ["dl", "нейросети", "глубокое", "neural networks", "deep learning"],
      route: "/ai/roadmap/dl.html",
    },
    {
      title: "NLP Base",
      type: "roadmap",
      tags: ["nlp", "язык", "текст", "language", "text"],
      route: "/ai/roadmap/nlp-base.html",
    },
    {
      title: "NLP Advanced",
      type: "roadmap",
      tags: ["nlp", "язык", "текст", "language", "text"],
      route: "/ai/roadmap/nlp-advanced.html",
    },
    {
      title: "NLP Optimization",
      type: "roadmap",
      tags: ["nlp", "оптимизация", "llm", "optimization"],
      route: "/ai/roadmap/nlp-optimization.html",
    },
    {
      title: "NLP RAG",
      type: "roadmap",
      tags: ["rag", "retrieval", "llm", "поиск", "search"],
      route: "/ai/roadmap/nlp-rag.html",
    },
    {
      title: "NLP Agents",
      type: "roadmap",
      tags: ["agents", "агенты", "nlp"],
      route: "/ai/roadmap/nlp-agents.html",
    },
    {
      title: "Архитектуры DL",
      type: "roadmap",
      tags: ["модели", "архитектуры", "models", "architectures"],
      route: "/ai/roadmap/models-dl.html",
    },
    {
      title: "Архитектуры NLP",
      type: "roadmap",
      tags: ["модели", "архитектуры", "nlp", "models", "architectures"],
      route: "/ai/roadmap/models-nlp.html",
    },
    {
      title: "Архитектуры CV",
      type: "roadmap",
      tags: ["модели", "архитектуры", "models", "architectures"],
      route: "/ai/roadmap/models-cv.html",
    },
    {
      title: "CV",
      type: "roadmap",
      tags: ["cv", "зрение", "изображения", "vision", "images"],
      route: "/ai/roadmap/cv.html",
    },
    {
      title: "Deep Learning CV",
      type: "roadmap",
      tags: [
        "cv",
        "детекция",
        "сегментация",
        "диффузия",
        "генерация",
        "detection",
        "segmentation",
        "diffusion",
        "generation",
      ],
      route: "/ai/roadmap/cv-dl.html",
    },
    {
      title: "Time Series",
      type: "roadmap",
      tags: ["временные ряды", "прогноз", "time series", "forecasting"],
      route: "/ai/roadmap/timeseries.html",
    },
    {
      title: "Рекомендательные системы",
      type: "roadmap",
      tags: [
        "recsys",
        "рекомендации",
        "recommendations",
        "recommender systems",
      ],
      route: "/ai/roadmap/recsys.html",
    },
    {
      title: "Scoring",
      type: "roadmap",
      tags: ["скоринг", "кредитный скоринг", "scoring", "credit scoring"],
      route: "/ai/roadmap/scoring.html",
    },
    {
      title: "MLSD",
      type: "roadmap",
      tags: ["архитектура", "system design", "mlsd", "architecture"],
      route: "/ai/roadmap/architecture.html",
    },
    {
      title: "Git",
      type: "roadmap",
      tags: ["git", "github", "версии", "versions"],
      route: "/roadmap/github.html",
    },
    {
      title: "MLOps / Cloud",
      type: "roadmap",
      tags: ["mlops", "infra", "cloud"],
      route: "/ai/roadmap/mlops-cloud.html",
    },
    {
      title: "MLOps / Databases",
      type: "roadmap",
      tags: ["mlops", "infra", "db", "databases"],
      route: "/ai/roadmap/mlops-db.html",
    },
    {
      title: "Базы данных / Redis",
      type: "roadmap",
      tags: ["db", "databases", "базы", "redis", "кэш", "cache"],
      route: "/roadmap/db-redis.html",
    },
    {
      title: "Базы данных / PostgreSQL",
      type: "roadmap",
      tags: ["db", "databases", "базы", "postgresql", "postgres", "sql"],
      route: "/roadmap/db-postgresql.html",
    },
    {
      title: "Базы данных / DWH и ClickHouse",
      type: "roadmap",
      tags: ["db", "databases", "базы", "dwh", "clickhouse", "data lake"],
      route: "/roadmap/db-dwh.html",
    },
    {
      title: "Python для анализа данных",
      type: "roadmap",
      tags: ["python", "pandas", "numpy", "jupyter", "matplotlib", "seaborn"],
      route: "/roadmap/python-data.html",
    },
    {
      title: "Продуктовая аналитика",
      type: "roadmap",
      tags: ["аналитика", "analytics", "product", "продукт"],
      route: "/analytics/roadmap/index.html",
    },
    {
      title: "Карта аналитика (интерактивная)",
      type: "roadmap",
      tags: [
        "карта",
        "интерактив",
        "аналитика",
        "map",
        "interactive",
        "analytics",
      ],
      route: "/analytics/roadmap/interactive.html",
    },
    {
      title: "А/Б-тесты I",
      type: "roadmap",
      tags: ["аналитика", "аб", "a/b", "ab", "эксперимент", "experiment"],
      route: "/analytics/roadmap/ab.html",
    },
    {
      title: "А/Б-тесты II",
      type: "roadmap",
      tags: ["аналитика", "аб", "a/b", "ab", "mde", "дизайн эксперимента"],
      route: "/analytics/roadmap/ab-design.html",
    },
    {
      title: "Продуктовые метрики",
      type: "roadmap",
      tags: [
        "аналитика",
        "метрики",
        "metrics",
        "retention",
        "воронка",
        "funnel",
      ],
      route: "/analytics/roadmap/metrics.html",
    },
    {
      title: "Логирование продукта",
      type: "roadmap",
      tags: ["аналитика", "логирование", "события", "logging", "events"],
      route: "/analytics/roadmap/logging.html",
    },
    {
      title: "Продуктовые исследования",
      type: "roadmap",
      tags: ["аналитика", "исследование", "research"],
      route: "/analytics/roadmap/research.html",
    },
    {
      title: "BI и дашборды",
      type: "roadmap",
      tags: ["аналитика", "bi", "дашборд", "dashboard", "datalens", "superset"],
      route: "/analytics/roadmap/bi.html",
    },
    {
      title: "Инструменты экспериментов",
      type: "roadmap",
      tags: ["аналитика", "growthbook", "firebase", "varioqube", "сплит"],
      route: "/analytics/roadmap/tools.html",
    },
    {
      title: "MLOps / Docker",
      type: "roadmap",
      tags: ["mlops", "деплой", "docker", "deploy"],
      route: "/ai/roadmap/mlops-docker.html",
    },
    {
      title: "MLOps / Kubernetes",
      type: "roadmap",
      tags: ["mlops", "k8s", "kubernetes"],
      route: "/ai/roadmap/mlops-k8s.html",
    },
    {
      title: "MLOps / Kafka",
      type: "roadmap",
      tags: ["mlops", "kafka", "streaming"],
      route: "/ai/roadmap/mlops-kafka.html",
    },
    {
      title: "MLOps / Prometheus",
      type: "roadmap",
      tags: ["mlops", "monitoring", "prometheus"],
      route: "/ai/roadmap/mlops-prometheus.html",
    },
    {
      title: "MLOps / Grafana",
      type: "roadmap",
      tags: ["mlops", "monitoring", "grafana"],
      route: "/ai/roadmap/mlops-grafana.html",
    },
    {
      title: "MLOps / MLflow",
      type: "roadmap",
      tags: ["mlops", "experiments", "tracking", "mlflow"],
      route: "/ai/roadmap/mlops-mlflow.html",
    },
    {
      title: "MLOps / TensorBoard",
      type: "roadmap",
      tags: ["mlops", "experiments", "tracking", "tensorboard"],
      route: "/ai/roadmap/mlops-tensorboard.html",
    },
    {
      title: "MLOps / Weights & Biases",
      type: "roadmap",
      tags: ["mlops", "experiments", "tracking", "wandb"],
      route: "/ai/roadmap/mlops-wandb.html",
    },
    {
      title: "MLOps / ClearML",
      type: "roadmap",
      tags: ["mlops", "experiments", "tracking", "clearml"],
      route: "/ai/roadmap/mlops-clearml.html",
    },

    {
      title: "Советы по сдаче практики",
      type: "practice",
      tags: ["практика", "задачи", "practice", "tasks"],
      route: "/practise/tips.html",
    },
    {
      title: "Math",
      type: "practice",
      tags: ["практика", "задачи", "practice", "tasks"],
      route: "/practise/math.html",
    },
    {
      title: "PostgreSQL",
      type: "practice",
      tags: [
        "практика",
        "задачи",
        "db",
        "postgresql",
        "sql",
        "practice",
        "tasks",
      ],
      route: "/practise/db/postgresql.html",
    },
    {
      title: "Redis",
      type: "practice",
      tags: ["практика", "задачи", "db", "redis", "practice", "tasks"],
      route: "/practise/db/redis.html",
    },
    {
      title: "Python Base",
      type: "practice",
      tags: ["практика", "задачи", "base", "practice", "tasks"],
      route: "/practise/python/base.html",
    },
    {
      title: "Python Advanced",
      type: "practice",
      tags: ["практика", "задачи", "advanced", "practice", "tasks"],
      route: "/practise/python/advanced.html",
    },
    {
      title: "Classic ML",
      type: "practice",
      tags: ["практика", "задачи", "practice", "tasks"],
      route: "/ai/practise/classic_ml.html",
    },
    {
      title: "DL",
      type: "practice",
      tags: ["практика", "задачи", "practice", "tasks"],
      route: "/ai/practise/dl.html",
    },
    {
      title: "CV",
      type: "practice",
      tags: ["практика", "задачи", "practice", "tasks"],
      route: "/ai/practise/cv.html",
    },
    {
      title: "NLP",
      type: "practice",
      tags: ["практика", "задачи", "practice", "tasks"],
      route: "/ai/practise/nlp.html",
    },
    // tips

    {
      title: "Linux",
      type: "tool",
      tags: ["linux", "инструменты", "tools"],
      route: "/linux/",
    },
    { title: "Git", type: "tool", tags: ["git", "github"], route: "/github/" },
    {
      title: "MLOps",
      type: "tool",
      tags: ["mlops", "инфраструктура", "деплой", "infrastructure", "deploy"],
      route: "/ai/mlops/",
    },
    {
      title: "MLOps / Docker",
      type: "tool",
      tags: ["docker", "container", "контейнеры", "mlops"],
      route: "/ai/mlops/docker.html",
    },
    {
      title: "MLOps / Kubernetes",
      type: "tool",
      tags: ["kubernetes", "k8s", "оркестрация", "mlops", "orchestration"],
      route: "/ai/mlops/k8s.html",
    },
    {
      title: "MLOps / Kafka",
      type: "tool",
      tags: ["kafka", "streaming", "очереди", "mlops", "queues"],
      route: "/ai/mlops/kafka.html",
    },
    {
      title: "MLOps / Cloud",
      type: "tool",
      tags: ["cloud", "облако", "infra", "mlops"],
      route: "/ai/mlops/infra/cloud.html",
    },
    {
      title: "MLOps / Databases",
      type: "tool",
      tags: ["db", "database", "базы", "infra", "mlops"],
      route: "/ai/mlops/infra/db.html",
    },
    {
      title: "Базы данных",
      type: "tool",
      tags: ["db", "database", "базы", "redis", "postgresql"],
      route: "/db/",
    },
    {
      title: "Базы данных / Redis",
      type: "tool",
      tags: ["redis", "кэш", "cache", "in-memory", "db", "базы"],
      route: "/db/redis.html",
    },
    {
      title: "Базы данных / PostgreSQL",
      type: "tool",
      tags: [
        "postgresql",
        "postgres",
        "sql",
        "индексы",
        "db",
        "базы",
        "indexes",
      ],
      route: "/db/postgresql.html",
    },
    {
      title: "MLOps / Prometheus",
      type: "tool",
      tags: ["prometheus", "metrics", "метрики", "monitoring", "mlops"],
      route: "/ai/mlops/monitoring/prometheus.html",
    },
    {
      title: "MLOps / Grafana",
      type: "tool",
      tags: ["grafana", "grafana", "dashboard", "monitoring", "mlops"],
      route: "/ai/mlops/monitoring/grafana.html",
    },
    {
      title: "MLOps / MLflow",
      type: "tool",
      tags: ["mlflow", "tracking", "experiments", "mlops"],
      route: "/ai/mlops/experiments-tracking/mlflow.html",
    },
    {
      title: "MLOps / TensorBoard",
      type: "tool",
      tags: ["tensorboard", "tracking", "metrics", "mlops"],
      route: "/ai/mlops/experiments-tracking/tensorboard.html",
    },
    {
      title: "MLOps / Weights & Biases",
      type: "tool",
      tags: ["wandb", "weights biases", "tracking", "experiments", "mlops"],
      route: "/ai/mlops/experiments-tracking/wandb.html",
    },
    {
      title: "MLOps / ClearML",
      type: "tool",
      tags: ["clearml", "tracking", "orchestration", "mlops"],
      route: "/ai/mlops/experiments-tracking/clearml.html",
    },

    {
      title: "Собеседования",
      type: "interview",
      tags: ["собесы", "интервью", "interviews"],
      route: "/ai/interviews/",
    },
    {
      title: "Банк вопросов",
      type: "interview",
      tags: ["вопросы", "алго", "hr", "questions", "question bank"],
      route: "/bank/",
    },
    {
      title: "Резюме",
      type: "interview",
      tags: ["резюме", "cv", "resume"],
      route: "/ai/interviews/cv.html",
    },
    {
      title: "Легенда",
      type: "interview",
      tags: ["легенда", "legend"],
      route: "/ai/interviews/legend.html",
    },
    {
      title: "Поведенческое интервью",
      type: "interview",
      tags: [
        "поведенческое",
        "поведенческое интервью",
        "soft skills",
        "behavioral",
        "STAR",
        "CARL",
      ],
      route: "/ai/interviews/behavioral.html",
    },
    {
      title: "Испытательный срок",
      type: "interview",
      tags: [
        "испыталка",
        "испытательный срок",
        "онбординг",
        "probation",
        "onboarding",
      ],
      route: "/ai/interviews/probation.html",
    },
    {
      title: "Роли в Data и ML",
      type: "interview",
      tags: ["роли", "data", "ml", "roles"],
      route: "/ai/interviews/roles.html",
    },
    {
      title: "LinkedIn",
      type: "interview",
      tags: ["linkedin", "профиль", "profile"],
      route: "/ai/interviews/linkedin.html",
    },
    {
      title: "Источники вакансий",
      type: "interview",
      tags: ["вакансии", "jobs"],
      route: "/ai/interviews/jobs.html",
    },
    // videos, scrum, ip-sz, hh, dictionary
    {
      title: "Видеозаписи",
      type: "interview",
      tags: ["видео", "записи", "video", "recordings"],
      route: "/ai/interviews/videos.html",
    },
    {
      title: "English Speaking Club",
      type: "interview",
      tags: ["английский", "english", "esc", "глоссарий", "self-pitch"],
      route: "/ai/interviews/english-club.html",
    },
    {
      title: "Scrum",
      type: "interview",
      tags: ["скрам", "scrum"],
      route: "/ai/interviews/scrum.html",
    },
    {
      title: "ИП и самозанятость",
      type: "interview",
      tags: ["ип", "самозанятость", "self-employment", "sole proprietor"],
      route: "/ai/interviews/ip-sz.html",
    },
    {
      title: "HH",
      type: "interview",
      tags: ["hh", "вакансии", "jobs"],
      route: "/ai/interviews/hh.html",
    },
    {
      title: "Словарь IT-сленга",
      type: "interview",
      tags: ["словарь", "it-сленг", "glossary", "it slang"],
      route: "/ai/interviews/dictionary.html",
    },

    {
      title: "Доп. источники",
      type: "material",
      tags: ["материалы", "книги", "materials", "books", "resources"],
      route: "/materials/",
    },
    {
      title: "Новости",
      type: "material",
      tags: ["новости", "news"],
      route: "/news.html",
    },
    {
      title: "Предложения",
      type: "material",
      tags: [
        "предложения",
        "идеи",
        "фидбек",
        "suggestions",
        "ideas",
        "feedback",
      ],
      route: "/suggestions.html",
    },

    {
      title: "Доска задач",
      type: "profile",
      tags: [
        "доска",
        "kanban",
        "задания",
        "дедлайны",
        "board",
        "tasks",
        "deadlines",
      ],
      route: "/calender/",
    },
    {
      title: "Профиль",
      type: "profile",
      tags: ["профиль", "аккаунт", "profile", "account"],
      route: "/profile.html",
    },
    {
      title: "Прогресс по темам",
      type: "profile",
      tags: ["прогресс", "темы", "progress", "topics"],
      route: "/roadmap/",
    },
    {
      title: "Уведомления",
      type: "profile",
      tags: ["уведомления", "notifications"],
      route: "/profile/notifications.html",
    },
    {
      title: "Настройки",
      type: "profile",
      tags: ["настройки", "settings"],
      route: "/profile/settings.html",
    },
    {
      title: "Офферы",
      type: "profile",
      tags: ["офферы", "offers"],
      route: "/offers.html",
    },
    {
      title: "Обратная связь",
      type: "profile",
      tags: ["фидбек", "feedback"],
      route: "/profile/feedbacks.html",
    },
    {
      title: "Лидерборд",
      type: "profile",
      tags: ["лидерборд", "рейтинг", "leaderboard", "ranking"],
      route: "/leaderboard.html",
    },
    {
      title: "Отчёты",
      type: "profile",
      tags: ["отчёты", "reports"],
      route: "/my-reports.html",
    },
    {
      title: "Тесты",
      type: "profile",
      tags: ["тесты", "tests"],
      route: "/tests/",
    },
    {
      title: "Достижения",
      type: "profile",
      tags: ["достижения", "achievements"],
      route: "/achievements.html",
    },

    {
      title: "Создать отчёт",
      type: "action",
      tags: ["отчёт", "report", "daily"],
      route: "/my-reports.html#new",
    },
    {
      title: "Видео-гайд",
      type: "action",
      tags: ["гайд", "guide", "tour", "видео", "video"],
      route: "/guide/index.html",
    },
    {
      title: "Первые шаги",
      type: "action",
      tags: ["первые шаги", "start", "first steps", "getting started"],
      route: "/start.html",
    },
  ].map((item, id) => ({ ...item, id: `fallback-${id}` }));

  const DATA_SOURCES = {
    categories: "/assets/js/config/categories-config.json",
    quizzes: "/assets/data/quizzes/registry.json",
  };
  const STATIC_SUPPLEMENT_TYPES = new Set(["roadmap", "profile", "action"]);
  const HIDDEN_CATALOG_ROUTE_PATTERNS = [
    /^\/mentor-stats(?:\/|$)/,
    /^\/curator(?:\/|$)/,
    /^\/admin(?:\/|$)/,
  ];

  // Отказ по персональному лимиту вызовов держится до конца окна, поэтому
  // повторять запрос бессмысленно: каждая попытка только добавляет отказ и
  // запись в счётчик.
  function isThrottled(error) {
    return error?.status === 429 || error?.code === "RESOURCE_EXHAUSTED";
  }

  let catalogItems = toStaticCatalogItems();
  let catalogLoadPromise = null;
  let catalogStatus = "idle";
  let overlay = null;
  let panel = null;
  let inputEl = null;
  let sidebarEl = null;
  let listEl = null;
  let selectedIndex = 0;
  let selectedCategory =
    null; /* тип выбранной категории в сайдбаре; при открытии = первая */
  let filtered = [];
  let stylesInjected = false;

  function injectStyles() {
    if (stylesInjected) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/assets/css/command-palette.css";
    document.head.appendChild(link);
    stylesInjected = true;
  }

  function fuzzyMatch(query, str) {
    if (!query) return true;
    const q = query.toLowerCase().trim();
    const s = (str || "").toLowerCase();
    let i = 0;
    for (let j = 0; j < s.length && i < q.length; j++) {
      if (s[j] === q[i]) i++;
    }
    return i === q.length;
  }

  /**
   * Поисковый индекс содержит полный текст страниц, поэтому лежит не в
   * вебруте: callable getSearchCatalog отдаёт только те страницы, которые
   * ученик может открыть. Палитра и раньше умела работать без индекса —
   * на ошибке останется статический каталог.
   */
  async function fetchSearchCatalog() {
    if (!window.achievementApi) {
      throw new Error("Command palette: achievementApi is unavailable");
    }
    const result = await window.achievementApi.getSearchCatalog();
    return Array.isArray(result.entries) ? result.entries : [];
  }

  async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    return response.json();
  }

  function normalizeRoute(route) {
    if (!route || typeof route !== "string") return "";
    if (route.startsWith("http") || route.startsWith("#")) return route;
    return route.startsWith("/") ? route : `/${route}`;
  }

  function normalizeText(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function cleanCatalogTitle(title) {
    let normalized = normalizeText(title)
      .replace(/^[\p{Extended_Pictographic}\u2600-\u27bf]\ufe0f?\s*/u, "")
      .trim();
    normalized = stripCatalogPrefix(normalized);

    const duplicateParts = normalized.split(/\s+-\s+/);
    if (
      duplicateParts.length === 2 &&
      duplicateParts[0].toLowerCase() === duplicateParts[1].toLowerCase()
    ) {
      normalized = duplicateParts[0];
    }

    return normalized;
  }

  function joinMeta(...parts) {
    return uniq(parts.map(cleanCatalogTitle)).join(" · ");
  }

  function isNoisySearchTitle(title) {
    const normalized = normalizeText(title).toLowerCase();
    return (
      !normalized ||
      normalized.includes("загрузка") ||
      normalized.includes("нет видео") ||
      normalized.includes("вседlclassic") ||
      normalized.includes("всеdlclassic") ||
      normalized.includes("онлайн")
    );
  }

  function uniq(values) {
    const seen = new Set();
    const result = [];
    (values || []).forEach((value) => {
      const normalized = normalizeText(value);
      if (!normalized) return;
      const key = normalized.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      result.push(normalized);
    });
    return result;
  }

  function stripCatalogPrefix(title) {
    const normalized = normalizeText(title);
    return normalized.replace(
      /^(Вопросы по [^-]+|Math Практика|Python Практика|Рекомендательные системы)\s+-\s+/i,
      "",
    );
  }

  function inferTypeFromRoute(route) {
    if (/^\/((?:ai|analytics)\/)?roadmap\//.test(route)) return "roadmap";
    if (/^\/((?:ai|analytics)\/)?practise\//.test(route)) return "practice";
    if (
      /^\/((?:ai|analytics)\/)?bank\//.test(route) ||
      /^\/ai\/interviews\//.test(route)
    )
      return "interview";
    if (/^\/tests\//.test(route)) return "quiz";
    if (/^\/profile/.test(route) || /^\/my-reports/.test(route))
      return "profile";
    if (/^\/(linux|github|ai\/mlops|db)\//.test(route)) return "tool";
    if (/^\/(ai\/ml|math|python)\//.test(route)) return "material";
    return "page";
  }

  function isHiddenCatalogRoute(route) {
    const cleanRoute = normalizeRoute(route)
      .split(/[?#]/)[0]
      .replace(/\/index\.html$/, "");
    return HIDDEN_CATALOG_ROUTE_PATTERNS.some((pattern) =>
      pattern.test(cleanRoute),
    );
  }

  function addCatalogItem(items, seen, item) {
    const route = normalizeRoute(item.route || item.url);
    const title = cleanCatalogTitle(item.title);
    if (!route || !title) return;
    if (isHiddenCatalogRoute(route)) return;

    const type = item.type || inferTypeFromRoute(route);
    // /bank/ и /bank/index.html — одна и та же страница, но заводились дважды
    // и с разными названиями.
    const key =
      item.dedupeKey || `${type}|${route.replace(/\/index\.html$/, "/")}`;
    const existing = seen.get(key);
    if (existing) {
      existing.tags = uniq([...(existing.tags || []), ...(item.tags || [])]);
      existing.searchText = normalizeText(
        `${existing.searchText || ""} ${item.searchText || ""}`,
      );
      return;
    }

    const next = {
      ...item,
      id: item.id || `catalog-${items.length}`,
      title,
      route,
      type,
      badge: getCatalogBadge({ ...item, route, type }),
      tags: uniq(item.tags || []),
      searchText: normalizeText(item.searchText || ""),
      meta: normalizeText(item.meta || ""),
    };
    seen.set(key, next);
    items.push(next);
  }

  function getCategoryTags(categoryKey, category, groups) {
    const group = groups && category && groups[category.group];
    return uniq([
      categoryKey,
      category && category.displayName,
      category && category.displayNameRu,
      group && group.title,
      group && group.titleEn,
    ]);
  }

  // Названия страниц берём из поискового индекса: в конфиге у всех страниц
  // категории лежит одно и то же имя, и «Математика» шесть раз подряд
  // не даёт понять, где алгебра, а где матан.
  function createPageTitleLookup(searchIndex) {
    const byRoute = new Map();
    (searchIndex || []).forEach((entry) => {
      if (!entry || !entry.url || !entry.title) return;
      const route = normalizeRoute(entry.url);
      if (route.includes("#") || byRoute.has(route)) return;
      if (isNoisySearchTitle(entry.title)) return;
      byRoute.set(route, entry.title);
    });
    return byRoute;
  }

  // Страницы роадмапа в поисковый индекс не попадают, поэтому их названия
  // берём из статического каталога — там они выверены вручную.
  function createRoadmapTitleLookup() {
    const byRoute = new Map();
    CATALOG.forEach((item) => {
      if (item.type !== "roadmap" || !item.route) return;
      byRoute.set(normalizeRoute(item.route), cleanCatalogTitle(item.title));
    });
    return byRoute;
  }

  function buildCategoryItems(data, pageTitles, items, seen) {
    const categories = data && data.categories;
    const groups = (data && data.groups) || {};
    if (!categories || typeof categories !== "object") return;

    const roadmapTitles = createRoadmapTitleLookup();
    // На одну страницу роадмапа ссылаются несколько категорий: на
    // /roadmap/python.html — «Python», «Python Base Practice» и «Python
    // Advanced Practice». Собираем все ссылки и заводим страницу один раз.
    const roadmapRefs = new Map();

    Object.entries(categories).forEach(([categoryKey, category]) => {
      if (!category.roadmapUrl) return;
      const route = normalizeRoute(category.roadmapUrl);
      const ref = roadmapRefs.get(route) || {
        key: categoryKey,
        tags: [],
        candidates: [],
      };
      ref.tags.push(...getCategoryTags(categoryKey, category, groups));
      ref.candidates.push({
        title: category.displayNameRu || category.displayName || categoryKey,
        meta: groups[category.group] && (groups[category.group].title || ""),
      });
      roadmapRefs.set(route, ref);
    });

    // Роадмапы заводим первыми: те же страницы попадаются и в questionPaths
    // (scoring, prerequisites, architecture), и тогда выверенное название
    // проигрывало бы имени категории.
    roadmapRefs.forEach((ref, route) => {
      const curated = roadmapTitles.get(route);
      // Подпись берём у категории, чьё имя совпадает с выверенным названием
      // страницы, иначе роадмап Python подписывался бы практикой.
      const owner =
        (curated &&
          ref.candidates.find(
            (candidate) =>
              cleanCatalogTitle(candidate.title).toLowerCase() ===
              curated.toLowerCase(),
          )) ||
        ref.candidates[0];
      addCatalogItem(items, seen, {
        id: `roadmap-${ref.key}`,
        title: curated || owner.title,
        type: inferTypeFromRoute(route),
        route,
        tags: ["roadmap", "роадмап", ...ref.tags],
        meta: owner.meta,
      });
    });

    Object.entries(categories).forEach(([categoryKey, category]) => {
      const title =
        category.displayNameRu || category.displayName || categoryKey;
      const tags = getCategoryTags(categoryKey, category, groups);
      const groupTitle =
        groups[category.group] && (groups[category.group].title || "");

      (category.questionPaths || []).forEach((path, index) => {
        const route = normalizeRoute(path);
        // В конфиге у всех страниц категории одно и то же имя, поэтому
        // «Математика» шла шесть раз подряд. Берём собственное название
        // страницы из поискового индекса.
        const pageTitle = pageTitles.get(route) || title;
        addCatalogItem(items, seen, {
          id: `category-${categoryKey}-${index}`,
          title: pageTitle,
          type: inferTypeFromRoute(route),
          route,
          // Категория уходит в подпись и в теги: так видно, что «Алгебра» —
          // это математика, и поиск по «математика» её находит. У категории
          // из одной страницы имя совпадает с названием — не повторяем его.
          tags: [...tags, title],
          meta: joinMeta(
            // Сравниваем так же, как рисуем: cleanCatalogTitle срезает эмодзи
            // и префиксы, иначе «🎬 Записи собеседований» и «Записи
            // собеседований» считались бы разными.
            cleanCatalogTitle(pageTitle).toLowerCase() ===
              cleanCatalogTitle(title).toLowerCase()
              ? ""
              : title,
            groupTitle,
          ),
        });
      });
    });
  }

  function buildQuizItems(registry, items, seen) {
    if (!registry || typeof registry !== "object") return;
    Object.entries(registry).forEach(([quizId, quiz]) => {
      addCatalogItem(items, seen, {
        id: `quiz-${quizId}`,
        title: quiz.title || quizId,
        type: "quiz",
        route: `/tests/?quiz=${encodeURIComponent(quizId)}`,
        tags: [
          "тест",
          "квиз",
          "quiz",
          "test",
          quizId,
          quiz.category,
          quiz.difficulty,
        ],
        meta: quiz.difficulty || quiz.category || "",
        searchText: quiz.description || "",
      });
    });
  }

  // Подпись для страницы, которой не досталось категории: название ближайшей
  // родительской страницы. Так «Python» из /materials/python/ отличается
  // от «Python» из /python/.
  function findParentPageTitle(route, pageTitles) {
    const segments = route.split("/").filter(Boolean);
    for (let depth = segments.length - 1; depth > 0; depth -= 1) {
      const parent = `/${segments.slice(0, depth).join("/")}/`;
      const parentTitle = pageTitles.get(parent);
      if (parentTitle) return parentTitle;
    }
    return "";
  }

  // getSearchCatalog отдаёт только название и адрес: полный текст страниц не
  // покидает сервер, поэтому палитра ищет страницы по названиям, а не по их
  // содержимому.
  function buildSearchIndexItems(searchIndex, pageTitles, items, seen) {
    if (!Array.isArray(searchIndex)) return;
    searchIndex.forEach((entry, index) => {
      if (!entry || !entry.title || !entry.url) return;
      const route = normalizeRoute(entry.url);
      if (route.includes("#")) return;
      if (isNoisySearchTitle(entry.title)) return;
      // Страницу, заведённую категорией, здесь не пропускаем: addCatalogItem
      // подмешает ей содержимое.
      addCatalogItem(items, seen, {
        id: `search-${index}`,
        title: entry.title,
        type: inferTypeFromRoute(route),
        route,
        tags: ["страница", "поиск", "page", "search"],
        meta: joinMeta(findParentPageTitle(route, pageTitles)),
      });
    });
  }

  /**
   * Полнотекстовый поиск живёт на сервере. search-index.json содержит текст
   * всех страниц платформы, поэтому в браузер он не попадает вовсе: callable
   * searchPageContent ищет по нему сам и возвращает только фрагмент вокруг
   * совпадения и только по страницам, которые ученик и так вправе открыть.
   *
   * Каталог палитры при этом остаётся прежним — эти записи живут отдельно и
   * пересобираются на каждый запрос, а не подмешиваются в catalogItems: иначе
   * фрагменты прошлого запроса продолжали бы находиться по следующему.
   */
  const CONTENT_MIN_QUERY = 3;
  // Запрос уходит не на каждую букву: 300 мс — пауза, после которой человек
  // уже дописал слово, а лимит вызовов не выбирается набором фразы.
  const CONTENT_DEBOUNCE_MS = 300;
  let contentQuery = "";
  let contentItems = [];
  let contentTimer = null;
  let contentDisabled = false;

  function toContentItems(results) {
    return (Array.isArray(results) ? results : []).map((entry, index) => ({
      id: `content-${index}`,
      title: cleanCatalogTitle(entry.title),
      type: "content",
      route: normalizeRoute(entry.url),
      tags: ["текст", "поиск", "text", "search"],
      // Фрагмент приходит с сервера уже обрезанным; renderList его экранирует.
      meta: normalizeText(entry.snippet),
    }));
  }

  function resetContentResults() {
    if (contentTimer) clearTimeout(contentTimer);
    contentTimer = null;
    contentQuery = "";
    contentItems = [];
  }

  function scheduleContentSearch(query) {
    if (contentTimer) clearTimeout(contentTimer);
    contentTimer = null;
    if (contentDisabled || !window.achievementApi) return;
    if (query.length < CONTENT_MIN_QUERY) {
      contentQuery = "";
      contentItems = [];
      return;
    }
    if (query === contentQuery) return;
    contentTimer = setTimeout(async () => {
      try {
        const result = await window.achievementApi.searchPageContent(query);
        // Пока шёл ответ, ученик мог дописать запрос — старая выдача уже не
        // про то, что он видит в строке.
        if (!inputEl || inputEl.value.trim() !== query) return;
        contentQuery = query;
        contentItems = toContentItems(result && result.results);
        runSearch();
      } catch (error) {
        // Отказ по лимиту держится до конца окна: повторять на каждое
        // нажатие бессмысленно, только добавит отказов в счётчик.
        if (isThrottled(error)) contentDisabled = true;
        console.warn("Command palette content search failed:", error.message);
      }
    }, CONTENT_DEBOUNCE_MS);
  }

  // Совпадения из текста добавляются к найденному по названиям, а не заменяют
  // его: страница, найденная по заголовку, полезнее абзаца внутри неё.
  function withContentResults(byQuery, query) {
    if (!contentItems.length || query !== contentQuery) return byQuery;
    const seen = new Set(byQuery.map((item) => item.route));
    const { direction } = document.documentElement.dataset;
    return byQuery.concat(
      contentItems.filter(
        (item) =>
          !seen.has(item.route) &&
          !routeHiddenForDirection(item.route, direction),
      ),
    );
  }

  async function ensureCatalogLoaded() {
    if (catalogStatus === "ready") return catalogItems;
    if (catalogLoadPromise) return catalogLoadPromise;

    catalogStatus = "loading";
    catalogLoadPromise = (async () => {
      const [categories, quizzes, search] = await Promise.allSettled([
        fetchJson(DATA_SOURCES.categories),
        fetchJson(DATA_SOURCES.quizzes),
        fetchSearchCatalog(),
      ]);

      const categoryData = categories.value || null;
      const quizRegistry = quizzes.value || null;
      const searchIndex = Array.isArray(search.value) ? search.value : [];
      const items = [];
      const seen = new Map();

      const pageTitles = createPageTitleLookup(searchIndex);

      buildCategoryItems(categoryData, pageTitles, items, seen);
      buildQuizItems(quizRegistry, items, seen);
      buildSearchIndexItems(searchIndex, pageTitles, items, seen);

      CATALOG.filter((item) => STATIC_SUPPLEMENT_TYPES.has(item.type)).forEach(
        (item) => addCatalogItem(items, seen, item),
      );

      const failed = [categories, quizzes, search].filter(
        (result) => result.status === "rejected",
      );
      if (failed.length > 0) {
        console.warn(
          "Command palette: some catalog sources failed:",
          failed.map((result) => result.reason && result.reason.message),
        );
      }

      catalogItems =
        items.length > 0
          ? items.map((item, id) => ({ ...item, id }))
          : toStaticCatalogItems();
      // Каталог без поискового индекса неполон: getSearchCatalog мог упасть,
      // потому что achievementApi ещё не загрузился или сессия не поднялась.
      // Не кэшируем такой результат — следующее открытие палитры повторит.
      //
      // Исключение — отказ по лимиту вызовов: он продержится до конца окна,
      // и повтор на каждое нажатие ⌘K только доливал бы отказов и записей в
      // счётчик. В этом случае остаёмся на статическом каталоге насовсем.
      const throttled = isThrottled(search.reason);
      catalogStatus =
        search.status === "rejected" && !throttled ? "idle" : "ready";
      if (catalogStatus === "idle") catalogLoadPromise = null;
      return catalogItems;
    })().catch((error) => {
      console.warn("Command palette catalog load failed:", error.message);
      catalogItems = toStaticCatalogItems();
      catalogStatus = isThrottled(error) ? "ready" : "idle";
      if (catalogStatus === "idle") catalogLoadPromise = null;
      return catalogItems;
    });

    return catalogLoadPromise;
  }

  // Текст страницы вместе с её вопросами доходит до сотни килобайт,
  // поэтому склеиваем поисковую строку один раз, а не на каждое нажатие.
  function getSearchable(item) {
    if (item.searchable === undefined) {
      // Название и вкладка ищутся и по-русски, и в языке интерфейса.
      const shownTitle = t(item.title || "");
      item.searchable = [
        item.title,
        shownTitle,
        (item.tags || []).join(" "),
        TYPE_LABELS[getDisplayType(item.type)],
        getTypeLabel(item.type),
        item.meta,
        item.searchText,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      item.lowerTitle = shownTitle.toLowerCase();
      item.lowerTags = (item.tags || []).join(" ").toLowerCase();
    }
    return item.searchable;
  }

  // Простого «нашлось» мало: запрос попадает и в теги, и в описания квизов,
  // из-за чего одноимённая страница уезжала вниз. Чем ближе совпадение к
  // названию, тем выше запись.
  function rankItem(item, q, words) {
    if (item.lowerTitle === q) return 0;
    if (item.lowerTitle.includes(q)) return 1;
    if (words.every((w) => item.lowerTitle.includes(w))) return 2;
    if (words.every((w) => item.lowerTags.includes(w))) return 3;
    if (words.every((w) => (item.meta || "").toLowerCase().includes(w)))
      return 4;
    return 5;
  }

  // Направление ученика (data-direction на <html> ставит navigation.js,
  // персоналу — нет): аналитику не предлагаем ML-разделов, кроме Classic ML
  // и того, что правило directionVisibility (categories-config.json) ему
  // оставляет; ML-ученику — ничего из /analytics/.
  const ML_ONLY_ROUTE =
    /^\/(?:ai\/(?:ml|mlops|practise|bank|roadmap|materials\/research)\/|ai\/interviews\/(?:mlsd|videos|english-club|algo-tasks|company-question-bank|mock-question-bank)\.html|roadmap\/interactive\.html|db\/redis\.html|roadmap\/db-redis\.html|practise\/db\/redis\.html)/;
  const ML_ROUTES_FOR_ANALYSTS = new Set([
    "/ai/ml/classic.html",
    "/ai/mlops/infra/db.html",
    "/ai/practise/classic_ml.html",
    "/ai/bank/classic-ml.html",
    "/ai/roadmap/classic_ml.html",
    "/ai/roadmap/mlops-db.html",
  ]);
  function routeHiddenForDirection(route, direction) {
    const path = String(route || "")
      .split(/[?#]/)[0]
      .replace(/^\/en\//, "/");
    if (direction === "ml") return path.startsWith("/analytics/");
    if (direction !== "analytics") return false;
    return ML_ONLY_ROUTE.test(path) && !ML_ROUTES_FOR_ANALYSTS.has(path);
  }

  // «Только материалы» отчётов не пишут; формат на <html> ставит navigation.js.
  function visibleCatalogItems() {
    const root = document.documentElement;
    const reportsAllowed = root.dataset.learningFormat !== "materials";
    return catalogItems.filter(
      (item) =>
        (reportsAllowed || !/^\/my-reports/.test(item.route)) &&
        !routeHiddenForDirection(item.route, root.dataset.direction),
    );
  }

  function filterCatalog(query) {
    const q = (query || "").trim().toLowerCase();
    if (!q) return visibleCatalogItems();
    const words = q.split(/\s+/).filter(Boolean);
    return visibleCatalogItems()
      .filter((item) => {
        const searchable = getSearchable(item);
        return words.every(
          (w) =>
            searchable.includes(w) ||
            fuzzyMatch(w, item.lowerTitle) ||
            fuzzyMatch(w, item.lowerTags),
        );
      })
      .map((item, order) => ({ item, order, rank: rankItem(item, q, words) }))
      .sort((a, b) => a.rank - b.rank || a.order - b.order)
      .map((scored) => scored.item);
  }

  function getGroupsByCategory(items) {
    const groups = {};
    CATEGORY_ORDER.forEach((type) => {
      groups[type] = [];
    });
    items.forEach((item) => {
      const displayType = getDisplayType(item.type);
      if (groups[displayType]) groups[displayType].push(item);
    });
    return CATEGORY_ORDER.filter((type) => groups[type].length > 0).map(
      (type) => ({
        type,
        label: t(TYPE_LABELS[type]),
        items: groups[type],
      }),
    );
  }

  function buildDOM() {
    if (overlay) return;
    injectStyles();
    overlay = document.createElement("div");
    overlay.className = "cp-overlay";
    overlay.setAttribute("aria-hidden", "true");

    panel = document.createElement("div");
    panel.className = "cp-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", t("Каталог платформы"));

    const searchWrap = document.createElement("div");
    searchWrap.className = "cp-search-wrap";

    const searchField = document.createElement("div");
    searchField.className = "cp-search-field";

    const iconSvg = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg",
    );
    iconSvg.setAttribute("class", "cp-search-icon");
    iconSvg.setAttribute("viewBox", "0 0 24 24");
    iconSvg.setAttribute("fill", "none");
    iconSvg.setAttribute("stroke", "currentColor");
    iconSvg.setAttribute("stroke-width", "2");
    iconSvg.setAttribute("stroke-linecap", "round");
    iconSvg.setAttribute("stroke-linejoin", "round");
    iconSvg.setAttribute("aria-hidden", "true");
    const iconCircle = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle",
    );
    iconCircle.setAttribute("cx", "11");
    iconCircle.setAttribute("cy", "11");
    iconCircle.setAttribute("r", "8");
    const iconLine = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "line",
    );
    iconLine.setAttribute("x1", "21");
    iconLine.setAttribute("y1", "21");
    iconLine.setAttribute("x2", "16.65");
    iconLine.setAttribute("y2", "16.65");
    iconSvg.appendChild(iconCircle);
    iconSvg.appendChild(iconLine);

    inputEl = document.createElement("input");
    inputEl.type = "text";
    inputEl.className = "cp-input";
    inputEl.placeholder = t("rag, ranking, wandb, теория вероятностей...");
    inputEl.autocomplete = "off";
    inputEl.setAttribute("aria-label", t("Поиск по каталогу"));

    searchField.appendChild(iconSvg);
    searchField.appendChild(inputEl);
    searchWrap.appendChild(searchField);

    const body = document.createElement("div");
    body.className = "cp-body";

    sidebarEl = document.createElement("div");
    sidebarEl.className = "cp-sidebar";
    sidebarEl.setAttribute("role", "navigation");

    listEl = document.createElement("div");
    listEl.className = "cp-list";
    listEl.setAttribute("role", "listbox");

    const footer = document.createElement("div");
    footer.className = "cp-footer";
    footer.setAttribute("aria-hidden", "true");
    [
      ["↑↓", t("навигация")],
      ["↩", t("открыть")],
      ["Esc", t("закрыть")],
    ].forEach(([key, label]) => {
      const hint = document.createElement("span");
      hint.className = "cp-hint";
      const kbd = document.createElement("kbd");
      kbd.textContent = key;
      hint.appendChild(kbd);
      hint.appendChild(document.createTextNode("\u00a0" + label));
      footer.appendChild(hint);
    });

    body.appendChild(sidebarEl);
    body.appendChild(listEl);
    panel.appendChild(searchWrap);
    panel.appendChild(body);
    panel.appendChild(footer);
    overlay.appendChild(panel);

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });

    inputEl.addEventListener("input", () => {
      scheduleContentSearch(inputEl.value.trim());
      runSearch();
    });
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, filtered.length - 1);
        renderList();
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        renderList();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const item = filtered[selectedIndex];
        if (item) navigate(item);
        return;
      }
    });

    document.body.appendChild(overlay);
  }

  function applyCategory(byQuery) {
    return selectedCategory
      ? byQuery.filter((i) => getDisplayType(i.type) === selectedCategory)
      : byQuery;
  }

  function runSearch() {
    const query = inputEl.value.trim();
    const byQuery = withContentResults(filterCatalog(query), query);
    if (!selectedCategory && byQuery.length > 0) {
      selectedCategory = getDisplayType(byQuery[0].type);
    }
    // Порядок важен: renderSidebar переключает вкладку, если в текущей
    // ничего не нашлось. Отберём записи раньше — список окажется пустым
    // при подсвеченной вкладке с результатами.
    renderSidebar(byQuery);
    filtered = applyCategory(byQuery);
    selectedIndex = 0;
    renderList();
  }

  function setCategory(type) {
    selectedCategory = type;
    const query = inputEl.value.trim();
    const byQuery = withContentResults(filterCatalog(query), query);
    renderSidebar(byQuery);
    filtered = applyCategory(byQuery);
    selectedIndex = 0;
    renderList();
  }

  function renderSidebar(byQuery) {
    const categoriesWithItems = CATEGORY_ORDER.filter((type) =>
      byQuery.some((item) => getDisplayType(item.type) === type),
    );
    if (categoriesWithItems.length === 0) {
      sidebarEl.innerHTML = "";
      return;
    }
    if (!selectedCategory || !categoriesWithItems.includes(selectedCategory)) {
      selectedCategory = categoriesWithItems[0];
    }
    sidebarEl.innerHTML = "";
    categoriesWithItems.forEach((type) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "cp-category" +
        (type === selectedCategory ? " cp-category-active" : "");
      btn.textContent = getTypeLabel(type);
      btn.setAttribute("role", "tab");
      btn.setAttribute(
        "aria-selected",
        type === selectedCategory ? "true" : "false",
      );
      btn.addEventListener("click", () => setCategory(type));
      sidebarEl.appendChild(btn);
    });
  }

  function renderList() {
    listEl.innerHTML = "";
    listEl.setAttribute(
      "aria-activedescendant",
      filtered[selectedIndex] ? `cp-item-${filtered[selectedIndex].id}` : "",
    );
    if (filtered.length === 0) {
      const empty = document.createElement("div");
      empty.className = "cp-empty";
      empty.innerHTML =
        '<span class="cp-empty-icon">⌕</span><span class="cp-empty-text">' +
        (selectedCategory
          ? t("В этой категории ничего не найдено")
          : t("Ничего не найдено")) +
        "</span>";
      listEl.appendChild(empty);
      return;
    }
    const label = selectedCategory ? getTypeLabel(selectedCategory) : "";
    if (label) {
      const groupTitle = document.createElement("div");
      groupTitle.className = "cp-group-title";
      groupTitle.textContent = label;
      listEl.appendChild(groupTitle);
    }
    filtered.forEach((item, i) => {
      const row = document.createElement("a");
      row.href = navigationHref(item.route);
      row.className =
        "cp-item" + (i === selectedIndex ? " cp-item-active" : "");
      row.id = `cp-item-${item.id}`;
      row.setAttribute("role", "option");
      const metaHtml = item.meta
        ? `<span class="cp-item-meta">${escapeHtml(item.meta)}</span>`
        : "";
      const badgeHtml = item.badge
        ? `<span class="cp-item-badge">${escapeHtml(item.badge)}</span>`
        : "";
      row.innerHTML = `<span class="cp-item-main"><span class="cp-item-head"><span class="cp-item-title">${escapeHtml(t(item.title))}</span>${badgeHtml}</span>${metaHtml}</span><span class="cp-item-arrow" aria-hidden="true">→</span>`;
      row.addEventListener("click", (e) => {
        // Cmd/Ctrl/Shift+клик — штатное «открыть в новой вкладке» по href.
        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        navigate(item);
      });
      listEl.appendChild(row);
    });
    const activeEl = listEl.querySelector(".cp-item-active");
    if (activeEl)
      activeEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function escapeHtml(s) {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  function navigate(item) {
    close();
    window.location.href = navigationHref(item.route);
  }

  async function open() {
    buildDOM();
    overlay.classList.add("cp-open");
    overlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    inputEl.value = "";
    // Строка пуста — фрагменты прошлого открытия к ней не относятся.
    resetContentResults();
    selectedCategory = CATEGORY_ORDER[0];
    selectedIndex = 0;
    const byQuery = filterCatalog("");
    if (
      !byQuery.some((item) => getDisplayType(item.type) === selectedCategory)
    ) {
      selectedCategory = byQuery[0] ? getDisplayType(byQuery[0].type) : null;
    }
    renderSidebar(byQuery);
    filtered = applyCategory(byQuery);
    renderList();
    requestAnimationFrame(() => {
      inputEl.focus();
    });
    if (catalogStatus !== "ready") {
      ensureCatalogLoaded().then(() => {
        if (!overlay || !overlay.classList.contains("cp-open")) return;
        runSearch();
      });
    }
  }

  function close() {
    if (!overlay) return;
    overlay.classList.remove("cp-open");
    overlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    inputEl.blur();
  }

  function toggle() {
    if (overlay && overlay.classList.contains("cp-open")) close();
    else open();
  }

  function init() {
    document.addEventListener("keydown", (e) => {
      const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (mod && e.key === "k") {
        e.preventDefault();
        toggle();
        return;
      }
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target;
        const isInput =
          target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable);
        if (!isInput) {
          e.preventDefault();
          open();
        }
      }
      if (
        e.key === "Escape" &&
        overlay &&
        overlay.classList.contains("cp-open")
      ) {
        close();
      }
    });
  }

  window.openCommandPalette = open;
  window.closeCommandPalette = close;
  window.toggleCommandPalette = toggle;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
