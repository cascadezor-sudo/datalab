/**
 * Сутки платформы: YYYY-MM-DD в Europe/Moscow — то же правило, что у сервера
 * (`functions/day-key.js`). Раньше день считали по-разному: сервер по UTC,
 * браузер по локальному времени, — и три часа в сутки они расходились.
 *
 * Определение продублировано в каждом файле, который считает день, и защищено
 * проверкой на уже существующее значение. Причина в подключении: это обычные
 * <script>, а не модули, и `const` на верхнем уровне второго такого файла
 * уронил бы его целиком на переобъявлении. Один общий файл потребовал бы
 * нового <script> на каждой из 200+ страниц — это отдельная задача.
 */
window.platformDayKey =
  window.platformDayKey ||
  (function () {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Moscow",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return function platformDayKey(value) {
      const parts = {};
      const source = new Date(value === undefined ? Date.now() : value);
      for (const part of formatter.formatToParts(source)) {
        parts[part.type] = part.value;
      }
      return `${parts.year}-${parts.month}-${parts.day}`;
    };
  })();

(function () {
  // Перевод интерфейса (ядро — сниппет theme-boot). В тестах под Node его нет:
  // остаётся русский текст с подставленными значениями.
  const t =
    window.t ||
    ((text, params) =>
      text.replace(/\{(\w+)\}/g, (match, key) => params?.[key] ?? match));
  const plural = (count, forms) =>
    window.i18n?.plural ? window.i18n.plural(count, forms) : forms.ru[2];
  const locale = () => window.i18n?.locale || "ru-RU";

  const WEEKDAY_LABELS = [t("Пн"), "", t("Ср"), "", t("Пт"), "", ""];
  const MONTH_LABELS = [
    t("Янв"),
    t("Фев"),
    t("Мар"),
    t("Апр"),
    t("Май"),
    t("Июн"),
    t("Июл"),
    t("Авг"),
    t("Сен"),
    t("Окт"),
    t("Ноя"),
    t("Дек"),
  ];
  const REPORT_FORMS = {
    ru: ["отчет", "отчета", "отчетов"],
    en: ["report", "reports"],
  };
  const QUESTION_FORMS = {
    ru: ["вопрос", "вопроса", "вопросов"],
    en: ["question", "questions"],
  };

  function startOfLocalDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  /**
   * Сегодняшний день платформы как объект Date для календарной арифметики.
   *
   * Сетка считает недели и смещения обычным локальным Date — это безопасно,
   * потому что такие объекты здесь означают календарный день, а не момент
   * времени. А вот точка отсчёта «сегодня» обязана совпадать с сервером,
   * иначе у ученика восточнее Москвы последняя клетка сетки и его же стрик
   * в достижениях указывали бы на разные дни.
   */
  function platformToday() {
    return parseDateKey(window.platformDayKey()) || startOfLocalDay(new Date());
  }

  function formatDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function parseDateKey(key) {
    if (!key || typeof key !== "string") return null;
    const match = key.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  function getMonday(date) {
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = startOfLocalDay(date);
    monday.setDate(monday.getDate() + diff);
    return monday;
  }

  function formatHumanDate(date) {
    return date.toLocaleDateString(locale(), {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function addActivity(map, dateKey, type, amount) {
    if (!dateKey) return;
    if (!map.has(dateKey)) {
      map.set(dateKey, { reports: 0, questions: 0 });
    }
    map.get(dateKey)[type] += amount;
  }

  function collectReportActivity(reports) {
    const entries = [];
    if (!reports || typeof reports !== "object") return entries;

    Object.entries(reports).forEach(([key, report]) => {
      if (!report || typeof report !== "object") return;
      let dateKey = report.date || key;

      if (!parseDateKey(dateKey) && report.timestamp) {
        dateKey = window.platformDayKey(report.timestamp);
      }

      if (parseDateKey(dateKey)) entries.push(dateKey);
    });

    return entries;
  }

  function collectQuestionActivity(progress) {
    const entries = [];
    if (!progress || typeof progress !== "object") return entries;

    Object.values(progress).forEach((item) => {
      if (!item || !item.timestamp) return;
      entries.push(window.platformDayKey(item.timestamp));
    });

    return entries;
  }

  function getIntensity(activity) {
    if (!activity) return 0;
    const score = activity.reports * 2 + activity.questions;
    if (score <= 0) return 0;
    if (score <= 1) return 1;
    if (score <= 3) return 2;
    if (score <= 6) return 3;
    return 4;
  }

  function buildCalendarDays(weeksCount) {
    const today = platformToday();
    const lastWeekStart = getMonday(today);
    const firstDay = new Date(lastWeekStart);
    firstDay.setDate(firstDay.getDate() - (weeksCount - 1) * 7);

    const days = [];
    for (let week = 0; week < weeksCount; week++) {
      for (let weekday = 0; weekday < 7; weekday++) {
        const date = new Date(firstDay);
        date.setDate(firstDay.getDate() + week * 7 + weekday);
        days.push({
          date,
          key: formatDateKey(date),
          isFuture: date > today,
          week,
          weekday,
        });
      }
    }
    return days;
  }

  /**
   * Число серии сетка не считает: его считает сервер (functions/streak.js) и
   * кладёт в `users/<uid>/streakState`. Свой цикл здесь давал третье в
   * браузере значение — без заморозок, поэтому после любого пропуска он
   * показывал ноль там, где на главной стояла живая серия.
   *
   * `null` означает «сервер ещё не считал» — это не то же самое, что ноль, и
   * рисуется прочерком.
   */
  function serverStreak(streakState) {
    const value = Number(streakState?.current);
    return Number.isFinite(value) ? value : null;
  }

  function buildMonthLabels(days, weeksCount) {
    const labels = [];
    let lastMonth = -1;

    for (let week = 0; week < weeksCount; week++) {
      const monday = days[week * 7]?.date;
      if (!monday) continue;
      const month = monday.getMonth();
      if (month !== lastMonth) {
        labels.push(
          `<span style="grid-column:${week + 1}">${MONTH_LABELS[month]}</span>`,
        );
        lastMonth = month;
      }
    }

    return labels.join("");
  }

  function render(container, activityMap, options, streakState) {
    const weeksCount = options.weeks || 26;
    const days = buildCalendarDays(weeksCount);
    const activeDays = Array.from(activityMap.values()).filter(
      (day) => day.reports > 0 || day.questions > 0,
    ).length;
    const totalReports = Array.from(activityMap.values()).reduce(
      (sum, day) => sum + day.reports,
      0,
    );
    const totalQuestions = Array.from(activityMap.values()).reduce(
      (sum, day) => sum + day.questions,
      0,
    );
    const streak = serverStreak(streakState);

    container.innerHTML = `
      <div class="activity-grid-card">
        <div class="activity-grid-header">
          <div>
            <h3 class="activity-grid-title">${t("Активность")}</h3>
            <p class="activity-grid-subtitle">${t("Отчеты и решенные вопросы за последние {weeks} недель", { weeks: weeksCount })}</p>
          </div>
          <div class="activity-grid-stats">
            <span><strong>${streak === null ? "—" : streak}</strong> ${t("дней streak")}</span>
            <span><strong>${activeDays}</strong> ${plural(activeDays, { ru: ["активный день", "активных дня", "активных дней"], en: ["active day", "active days"] })}</span>
            <span><strong>${totalQuestions}</strong> ${plural(totalQuestions, QUESTION_FORMS)}</span>
            <span><strong data-wallet-balance>—</strong> <span data-wallet-unit>${t("градов")}</span></span>
          </div>
        </div>
        <div class="activity-grid-scroll" aria-label="${t("Календарь активности")}">
          <div class="activity-grid-months" style="grid-template-columns: repeat(${weeksCount}, var(--activity-cell-size));">
            ${buildMonthLabels(days, weeksCount)}
          </div>
          <div class="activity-grid-body">
            <div class="activity-grid-weekdays">
              ${WEEKDAY_LABELS.map((label) => `<span>${label}</span>`).join("")}
            </div>
            <div class="activity-grid-cells" style="grid-template-columns: repeat(${weeksCount}, var(--activity-cell-size));">
              ${days
                .map((day) => {
                  const activity = activityMap.get(day.key);
                  const level = day.isFuture ? 0 : getIntensity(activity);
                  const reports = activity?.reports || 0;
                  const questions = activity?.questions || 0;
                  const title = day.isFuture
                    ? `${formatHumanDate(day.date)}: ${t("будущий день")}`
                    : `${formatHumanDate(day.date)}: ${reports} ${plural(reports, REPORT_FORMS)}, ${questions} ${plural(questions, QUESTION_FORMS)}`;
                  return `<span class="activity-grid-cell ${day.isFuture ? "is-future" : ""}" data-level="${level}" title="${title}" aria-label="${title}"></span>`;
                })
                .join("")}
            </div>
          </div>
        </div>
        <div class="activity-grid-footer">
          <span>${totalReports} ${plural(totalReports, REPORT_FORMS)}</span>
          <div class="activity-grid-legend" aria-label="${t("Легенда активности")}">
            <span>${t("Меньше")}</span>
            <span class="activity-grid-cell" data-level="0"></span>
            <span class="activity-grid-cell" data-level="1"></span>
            <span class="activity-grid-cell" data-level="2"></span>
            <span class="activity-grid-cell" data-level="3"></span>
            <span class="activity-grid-cell" data-level="4"></span>
            <span>${t("Больше")}</span>
          </div>
        </div>
      </div>
    `;
  }

  function renderError(container, message) {
    container.innerHTML = `
      <div class="activity-grid-card activity-grid-card--empty">
        <h3 class="activity-grid-title">${t("Активность")}</h3>
        <p class="activity-grid-subtitle">${message}</p>
      </div>
    `;
  }

  async function load({ db, uid, container, weeks = 26 }) {
    if (!container) return;
    if (!db || !uid) {
      renderError(container, t("Не удалось загрузить пользователя."));
      return;
    }

    container.innerHTML = `
      <div class="activity-grid-card activity-grid-card--loading">
        <h3 class="activity-grid-title">${t("Активность")}</h3>
        <div class="activity-grid-loading-row"></div>
        <div class="activity-grid-loading-row short"></div>
      </div>
    `;

    try {
      const [reportsSnap, progressSnap, streakSnap] = await Promise.all([
        db.ref(`daily_reports/${uid}`).once("value"),
        db.ref(`users/${uid}/progress`).once("value"),
        // Компактный узел из нескольких полей: сетку он не удорожает, а
        // избавляет её от собственного подсчёта серии.
        db.ref(`users/${uid}/streakState`).once("value"),
      ]);

      const activityMap = new Map();
      collectReportActivity(reportsSnap.val()).forEach((dateKey) =>
        addActivity(activityMap, dateKey, "reports", 1),
      );
      collectQuestionActivity(progressSnap.val()).forEach((dateKey) =>
        addActivity(activityMap, dateKey, "questions", 1),
      );

      render(container, activityMap, { weeks }, streakSnap.val());
      window.walletUi?.refresh?.();
    } catch (error) {
      console.error("Activity grid load failed:", error);
      renderError(container, t("Не удалось загрузить активность."));
    }
  }

  window.ActivityGrid = {
    load,
    _private: {
      collectReportActivity,
      collectQuestionActivity,
      serverStreak,
      formatDateKey,
    },
  };
})();
