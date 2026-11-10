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

/**
 * Daily Reports System
 * Система ежедневных отчётов с геймификацией и streak-трекингом
 */

class DailyReportsSystem {
  constructor() {
    this.db = null;
    this.user = null;
    this.today = this.getTodayString();
    this.isSubmittingReport = false;
    this.streakThresholds = {
      3: "🔥",
      7: "🚀",
      14: "💎",
      30: "👑",
    };
  }

  /**
   * Инициализация системы отчётов
   */
  async initialize(firebaseConfig) {
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }

      this.db = firebase.database();

      // Слушаем изменения авторизации
      firebase.auth().onAuthStateChanged(async (user) => {
        this.user = user;
        if (user) {
          if (this.isStatsWidgetDisabledPage()) {
            this.removeStatsWidget();
            return;
          }
          // Сначала загружаем и обновляем статистику
          await this.loadUserStats();
          // Затем проверяем ежедневный отчёт
          await this.checkDailyReport();
        }
      });
    } catch (error) {}
  }

  /**
   * На главной и в истории отчётов этот тяжёлый сводный виджет не нужен.
   * Сами отчёты и явное напоминание на главной продолжают работать отдельно.
   */
  isStatsWidgetDisabledPage() {
    const path = window.location.pathname.replace(/\/+$/, "") || "/";
    return path === "/main.html" || path === "/my-reports.html";
  }

  removeStatsWidget() {
    document.getElementById("user-stats-widget")?.remove();
  }

  /**
   * Получить строку сегодняшней даты в формате YYYY-MM-DD по суткам платформы.
   *
   * Это значение сравнивается с полем `date` отчёта, а его проставляет сервер
   * (normalizeReport). Пока здесь стояло локальное время браузера, а на
   * сервере — UTC, у московского ученика с полуночи до трёх часов ночи
   * «сегодня» у клиента и у сервера были разными днями: отчёт уходил вчерашним
   * числом, а виджет продолжал требовать отчёт за сегодня.
   */
  getTodayString() {
    return window.platformDayKey();
  }

  /**
   * Проверить, есть ли отчёт за сегодня
   */
  async checkDailyReport() {
    if (!this.user) return;

    try {
      // Не показываем ученические напоминания ментору и curator
      const isStaff = await this.isStaffUser();
      if (isStaff) {
        return;
      }

      // Здесь читалась вся история отчётов ради переменной shouldShowModal,
      // которую потом никто не использовал: принудительное открытие модалки
      // убрали давно, напоминание живёт в main.html. Заодно ушла вторая копия
      // правила «есть ли отчёт за вчера» — оно теперь целиком на сервере, где
      // учитываются заморозки.
      this.hideDailyReportModal();

      // Обновляем статус в виджете (используем логику streak)
      const streakStatus = await this.checkTodayReportStatus();
      this.updateReportStatus(streakStatus);
    } catch (error) {
      console.error("Error checking daily report:", error);
    }
  }

  /**
   * Проверить статус активности за сегодня (отчёт + решенные вопросы)
   */
  async checkTodayReportStatus() {
    if (!this.user) return false;

    try {
      const todayActivity = await this.getUserActivityForDate(this.today);

      // Если есть активность за сегодня (отчет ИЛИ решенные вопросы)
      if (todayActivity.hasReport || todayActivity.hasSolvedQuestions) {
        return true;
      }

      // Сегодня активности нет — серия жива, только если её держит сервер.
      // Раньше здесь стояла своя проверка «а был ли вчера отчёт»: с
      // заморозками она врёт, потому что пропущенный день серию уже не рвёт.
      const streakState = await this.loadStreakState();
      return streakState.known && streakState.current > 0;
    } catch (error) {
      console.error("Error checking today activity status:", error);
      return false;
    }
  }

  /**
   * Получить роль текущего пользователя
   */
  async getCurrentUserRole() {
    if (!this.user) return null;
    try {
      const userRef = this.db.ref(`users/${this.user.uid}/role`);
      const snapshot = await userRef.once("value");
      return snapshot.val() || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Является ли пользователь «штатом» (admin, ментор или curator) — для них не показываем ученические уведомления и виджеты
   */
  async isStaffUser() {
    const role = await this.getCurrentUserRole();
    return role === "admin" || role === "mentor" || role === "curator";
  }

  /**
   * Проверить, является ли пользователь ментором
   */
  async checkMentorStatus() {
    if (!this.user) return false;

    try {
      const userRef = this.db.ref(`users/${this.user.uid}/role`);
      const snapshot = await userRef.once("value");
      const role = snapshot.val();

      return ["mentor", "curator", "admin", "admin-helper"].includes(role);
    } catch (error) {
      console.error("Error checking mentor status:", error);
      return false;
    }
  }

  /**
   * Показать модальное окно для заполнения отчёта
   */
  showDailyReportModal() {
    // Удаляем существующую модалку если есть
    const existingModal = document.getElementById("daily-report-modal");
    if (existingModal) {
      existingModal.remove();
    }

    const modal = document.createElement("div");
    modal.id = "daily-report-modal";
    modal.className = "daily-report-modal report-modal";
    modal.innerHTML = `
      <div class="daily-report-content">
        <div class="daily-report-header">
          <h2 class="report-title">${t("Ежедневный отчёт")}</h2>
          <div class="progress-bar">
            <div class="progress-fill"></div>
          </div>
          <button class="close-modal" onclick="window.dailyReportsSystem.hideDailyReportModal()" aria-label="${t("Закрыть")}">×</button>
        </div>
        
        <div class="daily-report-form">
          <form onsubmit="event.preventDefault(); window.dailyReportsSystem.submitDailyReport();">
            <section class="field-block" aria-labelledby="done-label">
              <div class="report-label" id="done-label">
                ${t("Что сделал(а) сегодня?")}
              </div>
              <div class="field">
                <textarea id="done-today" placeholder="${t("Например: Прошёл 3 темы по Python, решил 5 задач по линейной алгебре... Поддерживается markdown: [ссылка](url), списки с - или *, код через `код`")}" rows="3" aria-describedby="done-hint"></textarea>
                <div id="done-today-preview-container" style="display: none;">
                  <label class="preview-label">${t("Предварительный просмотр:")}</label>
                  <div id="done-today-preview" class="markdown-preview"></div>
                </div>
              </div>
            </section>
            
            <section class="field-block" aria-labelledby="plan-label">
              <div class="report-label" id="plan-label">
                ${t("Что планируешь дальше?")}
              </div>
              <div class="field">
                <textarea id="plan-tomorrow" placeholder="${t("Например: Продолжить изучение алгоритмов, решить задачи по статистике... Поддерживается markdown: [ссылка](url), списки с - или *, код через `код`")}" rows="3" aria-describedby="plan-hint"></textarea>
                <div id="plan-tomorrow-preview-container" style="display: none;">
                  <label class="preview-label">${t("Предварительный просмотр:")}</label>
                  <div id="plan-tomorrow-preview" class="markdown-preview"></div>
                </div>
              </div>
            </section>
            
            <section class="field-block" aria-labelledby="problems-label">
              <div class="report-label" id="problems-label">
                ${t("С какими трудностями столкнулся(ась)?")}
              </div>
              <div class="field">
                <textarea id="problems" placeholder="${t("Например: Не понимаю концепцию градиентного спуска, сложно настроить окружение... Поддерживается markdown: [ссылка](url), списки с - или *, код через `код`")}" rows="3" aria-describedby="problems-hint"></textarea>
                <div id="problems-preview-container" style="display: none;">
                  <label class="preview-label">${t("Предварительный просмотр:")}</label>
                  <div id="problems-preview" class="markdown-preview"></div>
                </div>
              </div>
            </section>
            
            <section class="field-block" aria-labelledby="mood-label">
              <div class="report-label" id="mood-label">
                ${t("Как ощущается процесс?")}
              </div>
              <div class="field">
                <select id="mood" class="mood-select" aria-describedby="mood-hint">
                  <option value="😎 Отлично" selected>${t("😎 Отлично")}</option>
                  <option value="🙂 Нормально">${t("🙂 Нормально")}</option>
                  <option value="😕 Устал">${t("😕 Устал")}</option>
                  <option value="🔥 В потоке">${t("🔥 В потоке")}</option>
                  <option value="💀 Выгорел">${t("💀 Выгорел")}</option>
                </select>
              </div>
            </section>
            
            <section class="field-block stats-fields" aria-labelledby="stats-label">
              <div class="report-label" id="stats-label">
                ${t("📊 Показатели дня (для статистики и лидерборда)")}
              </div>
              <div class="field stats-fields-row">
                <div class="stat-field">
                  <label for="hours-spent" class="stat-field-label">${t("Часов на учёбу")}</label>
                  <input type="number" id="hours-spent" class="stat-input" min="0" max="24" step="0.5" value="" placeholder="0" aria-describedby="hours-hint">
                  <span class="stat-field-hint" id="hours-hint">${t("ч")}</span>
                </div>
              </div>
            </section>
          </form>
        </div>
        
        <div class="form-actions">
          <div class="left-actions">
            <button type="button" class="skip-btn" onclick="window.dailyReportsSystem.hideDailyReportModal()">
              ${t("Отмена")} <span class="kbd">Esc</span>
            </button>
            <label class="rest-day-label">
              <input type="checkbox" id="isRestDay" class="rest-day-checkbox">
              <span class="rest-day-text">${t("😴 Сегодня выходной")}</span>
            </label>
          </div>
          <div class="right-actions">
            <button type="submit" class="btn-primary" onclick="window.dailyReportsSystem.submitDailyReport()">
              ${t("Отправить отчёт")}
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Показываем модальное окно с анимацией
    setTimeout(() => {
      modal.classList.add("show");
    }, 10);

    // Автофокус на первое поле
    setTimeout(() => {
      document.getElementById("done-today").focus();
    }, 100);

    // Добавляем обработчики для предварительного просмотра markdown
    setTimeout(() => {
      this.setupMarkdownPreview();

      // Инициализируем прогресс-полосу
      this.updateProgressBar();
    }, 200);

    // Добавляем обработчик для клавиши Escape
    const handleEscape = function (e) {
      if (e.key === "Escape") {
        e.preventDefault();
        this.hideDailyReportModal();
      }
    }.bind(this);

    document.addEventListener("keydown", handleEscape);

    // Сохраняем обработчик для последующего удаления
    modal._escapeHandler = handleEscape;
  }

  /**
   * Скрыть модальное окно
   */
  hideDailyReportModal() {
    const modal = document.getElementById("daily-report-modal");
    if (modal) {
      // Удаляем обработчик Escape
      if (modal._escapeHandler) {
        document.removeEventListener("keydown", modal._escapeHandler);
      }

      // Очищаем предварительные просмотры
      const previewContainers = [
        "done-today-preview-container",
        "plan-tomorrow-preview-container",
        "problems-preview-container",
      ];

      previewContainers.forEach((containerId) => {
        const container = document.getElementById(containerId);
        const preview = document.getElementById(
          containerId.replace("-container", ""),
        );
        if (container && preview) {
          container.style.display = "none";
          preview.innerHTML = "";
        }
      });

      // Добавляем класс для анимации закрытия
      modal.classList.add("closing");

      // Удаляем модальное окно после завершения анимации
      setTimeout(() => {
        if (modal.parentNode) {
          modal.remove();
        }
      }, 300);
    }
  }

  /**
   * Отправить ежедневный отчёт (защита от повторной отправки при лагах)
   */
  async submitDailyReport() {
    if (!this.user) return;
    if (this.isSubmittingReport) return;

    const doneToday = document.getElementById("done-today").value.trim();
    const planTomorrow = document.getElementById("plan-tomorrow").value.trim();
    const problems = document.getElementById("problems").value.trim();
    const topic = "Отчёт";
    const mood = document.getElementById("mood").value;
    const isRestDay = document.getElementById("isRestDay").checked;
    const hoursSpentEl = document.getElementById("hours-spent");
    const hoursSpent =
      hoursSpentEl && hoursSpentEl.value !== ""
        ? parseFloat(hoursSpentEl.value) || 0
        : 0;

    if (!doneToday && !isRestDay) {
      alert(
        t(
          'Пожалуйста, заполните хотя бы поле "Что сделал сегодня?" или отметьте выходной день',
        ),
      );
      return;
    }

    this.isSubmittingReport = true;
    const submitBtn = document.querySelector(
      '#daily-report-modal .btn-primary[type="submit"]',
    );
    const btnText = submitBtn ? submitBtn.textContent : "";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = t("Отправка...");
    }

    try {
      const reportData = {
        uid: this.user.uid,
        date: this.today,
        done: doneToday || (isRestDay ? "Выходной день" : ""),
        plan: planTomorrow || "Не указано",
        problems: problems || "Нет трудностей",
        topic: topic,
        mood: mood || "😎 Отлично",
        isRestDay: isRestDay,
        email: this.user.email,
        hoursSpent: Math.min(24, Math.max(0, hoursSpent)),
      };

      if (!window.achievementApi) {
        throw new Error("Achievement API is not loaded");
      }
      // The function stamps trusted time and evaluates achievements atomically.
      const result = await window.achievementApi.submitDailyReport(reportData);
      reportData.reportId = result.reportId;
      reportData.timestamp = Date.now();

      // Обновляем статистику пользователя
      await this.updateUserStats();

      // Перезагружаем виджет статистики
      await this.loadUserStats();

      // Скрываем модалку
      this.hideDailyReportModal();

      // Показываем уведомление об успехе
      this.showSuccessNotification();
      document.dispatchEvent(
        new CustomEvent("dailyReportSubmitted", { detail: reportData }),
      );

      // Обновляем UI
      this.updateReportStatus(true);
    } catch (error) {
      console.error("Error submitting daily report:", error);
      alert(t("Ошибка при отправке отчёта. Попробуйте ещё раз."));
    } finally {
      this.isSubmittingReport = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = btnText;
      }
    }
  }

  /**
   * Обновить статистику пользователя
   */
  async updateUserStats() {
    if (!this.user) return;

    try {
      // Получаем все отчёты пользователя
      const reportsRef = this.db.ref(`daily_reports/${this.user.uid}`);
      const reportsSnapshot = await reportsRef.once("value");
      const allReports = reportsSnapshot.val() || {};

      // Пересчитываем статистику на основе реальных данных
      const actualStats = await this.calculateActualStats(
        Object.values(allReports),
      );

      // Обновляем данные пользователя в Firebase
      await this.updateUserStatsInFirebase(actualStats);

      // Проверяем достижения после обновления статистики
      if (window.gamificationSystem) {
        await window.gamificationSystem.checkAchievements();
      }
    } catch (error) {
      console.error("Error updating user stats:", error);
    }
  }

  /**
   * Серия и заморозки — тем, что посчитал сервер.
   *
   * `known: false` означает «сервер ещё не считал», а не «ноль дней». Это два
   * разных состояния, и показывать «0 дней подряд» человеку, который вчера и
   * сегодня отчитался, хуже, чем показать прочерк: ноль читается как отнятая
   * серия. Пустым `streakState` бывает у нового ученика и в первые минуты
   * после выкладки, пока проекция не записана ни одним событием.
   */
  async loadStreakState() {
    const empty = {
      known: false,
      current: 0,
      freezesPerMonth: 0,
      freezesLeft: 0,
      lastActivityDay: null,
    };
    if (!this.user) return empty;

    try {
      const snapshot = await this.db
        .ref(`users/${this.user.uid}/streakState`)
        .once("value");
      const state = snapshot.val();
      if (!state || typeof state !== "object") return empty;
      const freezesPerMonth = Number(state.freezesPerMonth) || 0;
      const month = this.getTodayString().slice(0, 7);
      const usedThisMonth = (state.frozenDays || []).filter(
        (day) => String(day).slice(0, 7) === month,
      ).length;
      return {
        known: true,
        current: Number(state.current) || 0,
        freezesPerMonth,
        freezesLeft: Math.max(0, freezesPerMonth - usedThisMonth),
        lastActivityDay: state.lastActivityDay || null,
      };
    } catch (error) {
      console.error("Error loading streak state:", error);
      return empty;
    }
  }

  /** Подпись под числом серии: «дней подряд» плюс остаток заморозок. */
  streakLabel(state) {
    if (!state.known) return t("считаем серию");
    if (!state.freezesPerMonth || state.current === 0) return t("дней подряд");
    return `${t("дней подряд")} · 🧊 ${state.freezesLeft}`;
  }

  /** Пояснение к заморозкам. Живёт в title, чтобы не трогать разметку и стили. */
  streakHint(state) {
    if (!state.known) return t("Сервер ещё не пересчитал серию");
    if (!state.freezesPerMonth)
      return t("Дней подряд с отчётом или решённым вопросом");
    return t(
      "Серия не рвётся за пропущенный день, пока в месяце есть заморозки: осталось {left} из {total}",
      { left: state.freezesLeft, total: state.freezesPerMonth },
    );
  }

  /**
   * Показать скелетон виджета статистики (пока грузятся данные)
   */
  showStatsSkeleton() {
    if (this.isStatsWidgetDisabledPage()) {
      this.removeStatsWidget();
      return;
    }
    const isAchievements =
      window.location.pathname.includes("achievements.html");
    if (isAchievements) return;

    let statsWidget = document.getElementById("user-stats-widget");
    if (!statsWidget) {
      statsWidget = document.createElement("div");
      statsWidget.id = "user-stats-widget";
      statsWidget.className = "user-stats-widget user-stats-widget--skeleton";
      const container = document.querySelector(".container");
      const header = document.querySelector(".page-header");
      if (container && header) {
        container.insertBefore(statsWidget, header.nextSibling);
      }
    } else {
      statsWidget.classList.add("user-stats-widget--skeleton");
    }

    statsWidget.innerHTML = `
      <div class="stats-content">
        <div class="stats-streak stats-skeleton">
          <div class="skeleton-line skeleton-line--streak-value"></div>
          <div class="skeleton-line skeleton-line--streak-label"></div>
        </div>
        <div class="stats-grid">
          <div class="stat-item stats-skeleton"><div class="skeleton-line skeleton-line--value"></div><div class="skeleton-line skeleton-line--label"></div></div>
          <div class="stat-item stats-skeleton"><div class="skeleton-line skeleton-line--value"></div><div class="skeleton-line skeleton-line--label"></div></div>
          <div class="stat-item stats-skeleton"><div class="skeleton-line skeleton-line--value"></div><div class="skeleton-line skeleton-line--label"></div></div>
          <div class="stat-item stats-skeleton"><div class="skeleton-line skeleton-line--value"></div><div class="skeleton-line skeleton-line--label"></div></div>
          <div class="stat-item stats-skeleton"><div class="skeleton-line skeleton-line--value"></div><div class="skeleton-line skeleton-line--label"></div></div>
          <div class="stat-item stats-skeleton"><div class="skeleton-line skeleton-line--value"></div><div class="skeleton-line skeleton-line--label"></div></div>
        </div>
        <div class="stats-actions">
          <div class="skeleton-line skeleton-line--btn"></div>
        </div>
      </div>
    `;
  }

  /**
   * Загрузить статистику пользователя
   */
  async loadUserStats() {
    if (!this.user) return;

    if (this.isStatsWidgetDisabledPage()) {
      this.removeStatsWidget();
      return;
    }

    const isStaff = await this.isStaffUser();
    if (isStaff) return;
    if (window.location.pathname.includes("achievements.html")) return;

    this.showStatsSkeleton();

    try {
      // Получаем все отчёты пользователя для пересчёта статистики
      const reportsRef = this.db.ref(`daily_reports/${this.user.uid}`);
      const reportsSnapshot = await reportsRef.once("value");
      const allReports = reportsSnapshot.val() || {};

      // Пересчитываем статистику на основе реальных данных
      const actualStats = await this.calculateActualStats(
        Object.values(allReports),
      );

      // Обновляем данные пользователя в Firebase
      await this.updateUserStatsInFirebase(actualStats);

      await this.displayUserStats(actualStats);
    } catch (error) {
      console.error("Error loading user stats:", error);
      const statsWidget = document.getElementById("user-stats-widget");
      if (statsWidget) statsWidget.remove();
    }
  }

  /**
   * Отобразить статистику пользователя
   */
  async displayUserStats(userData) {
    if (this.isStatsWidgetDisabledPage()) {
      this.removeStatsWidget();
      return;
    }
    // Не показываем виджет streak/отчётов ментору и curator
    const isStaff = await this.isStaffUser();
    if (isStaff) {
      return;
    }

    // Проверяем, находимся ли мы на странице достижений
    if (window.location.pathname.includes("achievements.html")) {
      return;
    }

    let statsWidget = document.getElementById("user-stats-widget");
    if (!statsWidget) {
      statsWidget = document.createElement("div");
      statsWidget.id = "user-stats-widget";
      statsWidget.className = "user-stats-widget";
      const container = document.querySelector(".container");
      const header = document.querySelector(".page-header");
      if (container && header) {
        container.insertBefore(statsWidget, header.nextSibling);
      }
    }
    // Класс скелетона не снимаем до подстановки контента — иначе виджет «проседает» на время загрузки

    // Проверяем актуальный статус отчёта за сегодня (с учётом логики streak)
    const hasTodayReport = await this.checkTodayReportStatus();

    // Серию считает сервер (functions/streak.js) — здесь её только показывают.
    // Раньше здесь стоял свой пересчёт по отчётам и прогрессу, третий по счёту
    // в браузере, и заморозки ему были неизвестны в принципе.
    const streakState = await this.loadStreakState();
    const streak = streakState.current;
    const totalReports = userData.totalReports || 0;
    const totalStudyHours = userData.totalStudyHours ?? 0;
    const totalTasksCompleted = userData.totalTasksCompleted ?? 0;
    const weeklyStudyHours = userData.weeklyStudyHours ?? 0;
    const streakEmoji = streakState.known ? this.getStreakEmoji(streak) : "⏳";

    // Получаем данные о вопросах за сегодня и всего
    const todayQuestions = await this.getTodayQuestionsCount();
    const totalQuestions = await this.getTotalQuestionsCount();
    const todayReports = await this.getTodayReportsCount();

    // Debug: проверим данные из Firebase
    try {
      const progressRef = this.db.ref(`users/${this.user.uid}/progress`);
      const progressSnapshot = await progressRef.once("value");
      const progressData = progressSnapshot.val() || {};

      const reportsRef = this.db.ref(`daily_reports/${this.user.uid}`);
      const reportsSnapshot = await reportsRef.once("value");
      const reportsData = reportsSnapshot.val() || {};
    } catch (error) {
      console.error("Debug error:", error);
    }

    statsWidget.classList.remove("user-stats-widget--skeleton");
    statsWidget.innerHTML = `
      <div class="stats-content">
        <div class="stats-streak" title="${this.streakHint(streakState)}">
          <div class="streak-value"><span class="streak-emoji">${streakEmoji}</span> ${streakState.known ? streak : "—"}</div>
          <div class="streak-label">${this.streakLabel(streakState)}</div>
        </div>
        <div class="stats-grid">
          <div class="stat-item">
            <div class="stat-value">${todayQuestions}</div>
            <div class="stat-label">${t("вопросов сегодня")}</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${todayReports}</div>
            <div class="stat-label">${t("отчётов сегодня")}</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${totalStudyHours.toFixed(1)}</div>
            <div class="stat-label">${t("часов на учёбу")}</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${totalTasksCompleted}</div>
            <div class="stat-label">${t("задач выполнено")}</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${totalQuestions}</div>
            <div class="stat-label">${t("всего вопросов")}</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${totalReports}</div>
            <div class="stat-label">${t("всего отчётов")}</div>
          </div>
        </div>
        <div class="stats-actions">
          <button class="write-report-btn" onclick="window.dailyReportsSystem.showDailyReportModal()">
            ${t("📝 Написать отчёт")}
          </button>
          ${
            (await this.checkMentorStatus())
              ? `
            <button class="reset-stats-btn" onclick="window.dailyReportsSystem.resetUserStats()" title="${t("Сбросить статистику (только для менторов)")}">
              ${t("🔄 Сбросить статистику")}
            </button>
          `
              : ""
          }
        </div>
      </div>
    `;
  }

  /**
   * Получить эмодзи для streak
   */
  getStreakEmoji(streak) {
    if (streak >= 30) return "👑";
    if (streak >= 14) return "💎";
    if (streak >= 7) return "🚀";
    if (streak >= 3) return "🔥";
    return "💤";
  }

  /**
   * Получить количество решенных вопросов за сегодня
   */
  async getTodayQuestionsCount() {
    if (!this.user) return 0;

    try {
      const progressRef = this.db.ref(`users/${this.user.uid}/progress`);
      const snapshot = await progressRef.once("value");
      const progressData = snapshot.val() || {};

      const todayStr = this.getTodayString();
      let todayCount = 0;

      // Подсчитываем количество вопросов решенных сегодня
      Object.values(progressData).forEach((questionData) => {
        if (questionData.timestamp) {
          const date = new Date(questionData.timestamp);
          const dateStr = this.getDateString(date);
          if (dateStr === todayStr) {
            todayCount++;
          }
        }
      });

      return todayCount;
    } catch (error) {
      console.error("Error getting today questions count:", error);
      return 0;
    }
  }

  /**
   * Получить количество отчетов за сегодня
   */
  async getTodayReportsCount() {
    if (!this.user) return 0;

    try {
      const reportsRef = this.db.ref(`daily_reports/${this.user.uid}`);
      const snapshot = await reportsRef.once("value");
      const allReports = snapshot.val() || {};

      const todayStr = this.getTodayString();
      let todayCount = 0;

      Object.values(allReports).forEach((report) => {
        if (report.date === todayStr) {
          todayCount++;
        }
      });

      return todayCount;
    } catch (error) {
      console.error("Error getting today reports count:", error);
      return 0;
    }
  }

  /**
   * Получить общее количество решенных вопросов
   */
  async getTotalQuestionsCount() {
    if (!this.user) return 0;

    try {
      const progressRef = this.db.ref(`users/${this.user.uid}/progress`);
      const snapshot = await progressRef.once("value");
      const progressData = snapshot.val() || {};

      // Подсчитываем общее количество решенных вопросов
      // Каждый ключ в progressData - это решенный вопрос
      return Object.keys(progressData).length;
    } catch (error) {
      console.error("Error getting total questions count:", error);
      return 0;
    }
  }

  /**
   * Получить количество решенных вопросов за неделю
   */
  async getWeeklyQuestionsCount() {
    if (!this.user) return 0;

    try {
      const progressRef = this.db.ref(`users/${this.user.uid}/progress`);
      const snapshot = await progressRef.once("value");
      const progressData = snapshot.val() || {};

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      let weeklyCount = 0;

      Object.values(progressData).forEach((questionData) => {
        if (questionData.timestamp) {
          const questionDate = new Date(questionData.timestamp);
          if (questionDate >= weekAgo) {
            weeklyCount++;
          }
        }
      });

      return weeklyCount;
    } catch (error) {
      console.error("Error getting weekly questions count:", error);
      return 0;
    }
  }

  /**
   * Получить количество отчётов за неделю
   */
  async getWeeklyReportsCount() {
    if (!this.user) return 0;

    try {
      const reportsRef = this.db.ref(`daily_reports/${this.user.uid}`);
      const snapshot = await reportsRef.once("value");
      const allReports = snapshot.val() || {};

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      let weeklyCount = 0;
      Object.values(allReports).forEach((report) => {
        const reportDate = new Date(report.date);
        if (reportDate >= weekAgo) {
          weeklyCount++;
        }
      });

      return weeklyCount;
    } catch (error) {
      console.error("Error getting weekly reports count:", error);
      return 0;
    }
  }

  /**
   * Получить процент активности за неделю
   */
  async getActivityPercentage() {
    const weeklyCount = await this.getWeeklyReportsCount();
    const percentage = Math.round((weeklyCount / 7) * 100);
    return `${percentage}%`;
  }

  /**
   * Пересчитать статистику на основе реальных отчётов и активности
   */
  async calculateActualStats(reports) {
    if (!reports || reports.length === 0) {
      return {
        totalReports: 0,
        lastReportDate: null,
        weekendReports: 0,
        hasBothWeekendDays: false,
        totalStudyHours: 0,
        totalTasksCompleted: 0,
        weeklyStudyHours: 0,
      };
    }

    const sortedReports = reports.sort(
      (a, b) => new Date(a.date) - new Date(b.date),
    );
    const totalReports = reports.length;
    const lastReport = sortedReports[sortedReports.length - 1];
    const lastReportDate = lastReport ? lastReport.date : null;

    let totalStudyHours = 0;
    let totalTasksCompleted = 0;
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    let weeklyStudyHours = 0;

    reports.forEach((r) => {
      const h =
        typeof r.hoursSpent === "number"
          ? r.hoursSpent
          : parseFloat(r.hoursSpent) || 0;
      const t =
        typeof r.tasksCompleted === "number"
          ? r.tasksCompleted
          : parseInt(r.tasksCompleted, 10) || 0;
      totalStudyHours += h;
      totalTasksCompleted += t;
      if (new Date(r.date) >= weekAgo) {
        weeklyStudyHours += h;
      }
    });

    let weekendReports = 0;
    let hasSaturday = false;
    let hasSunday = false;
    const reportDates = [...new Set(reports.map((r) => r.date))];
    reportDates.forEach((dateStr) => {
      const date = new Date(dateStr);
      const dayOfWeek = date.getDay();
      if (dayOfWeek === 0) {
        hasSunday = true;
        weekendReports++;
      } else if (dayOfWeek === 6) {
        hasSaturday = true;
        weekendReports++;
      }
    });
    const hasBothWeekendDays = hasSaturday && hasSunday;

    return {
      totalReports,
      lastReportDate,
      weekendReports,
      hasBothWeekendDays,
      totalStudyHours,
      totalTasksCompleted,
      weeklyStudyHours,
    };
  }

  /**
   * Получить активность пользователя за день (отчеты + решенные вопросы)
   */
  async getUserActivityForDate(dateStr) {
    if (!this.user) return { hasReport: false, hasSolvedQuestions: false };

    try {
      // Проверяем наличие отчета за день
      const reportsRef = this.db.ref(`daily_reports/${this.user.uid}`);
      const reportsSnapshot = await reportsRef.once("value");
      const reports = reportsSnapshot.val() || {};

      let hasReport = false;
      Object.values(reports).forEach((report) => {
        if (report.date === dateStr) {
          hasReport = true;
        }
      });

      // Проверяем наличие решенных вопросов за день
      const progressRef = this.db.ref(`users/${this.user.uid}/progress`);
      const progressSnapshot = await progressRef.once("value");
      const progressData = progressSnapshot.val() || {};

      let hasSolvedQuestions = false;

      // Раньше границы дня собирались из new Date(dateStr) — а это полночь по
      // UTC, — после чего у неё брались локальные getFullYear/getMonth/getDate.
      // Для Москвы совпадение выходило случайным, для зоны западнее UTC окно
      // уезжало на сутки. Сравнивать ключи суток и проще, и однозначно.
      Object.values(progressData).forEach((questionData) => {
        if (
          questionData.timestamp &&
          window.platformDayKey(questionData.timestamp) === dateStr
        ) {
          hasSolvedQuestions = true;
        }
      });

      return { hasReport, hasSolvedQuestions };
    } catch (error) {
      console.error("Error getting user activity for date:", error);
      return { hasReport: false, hasSolvedQuestions: false };
    }
  }

  /**
   * Получить строку даты в формате YYYY-MM-DD по суткам платформы.
   */
  getDateString(date) {
    return window.platformDayKey(date);
  }

  /**
   * Обновить статистику пользователя в Firebase
   */
  async updateUserStatsInFirebase(stats) {
    // The callable report actions are the sole writer of these counters.
    // Retaining the method prevents breakage in legacy UI flows while avoiding
    // an extra client write after a full report-history read.
    return stats;
  }

  /**
   * Полная очистка статистики пользователя (для исправления проблем с устаревшими данными)
   */
  async resetUserStats() {
    if (!this.user) return;

    try {
      // Подтверждение
      if (
        !confirm(
          t(
            "Вы уверены, что хотите сбросить всю статистику? Это действие нельзя отменить.",
          ),
        )
      ) {
        return;
      }

      // Получаем все отчёты пользователя
      const reportsRef = this.db.ref(`daily_reports/${this.user.uid}`);
      const reportsSnapshot = await reportsRef.once("value");
      const allReports = reportsSnapshot.val() || {};

      // Пересчитываем статистику на основе реальных данных
      const actualStats = await this.calculateActualStats(
        Object.values(allReports),
      );

      // Обновляем данные пользователя в Firebase
      await this.updateUserStatsInFirebase(actualStats);

      // Перезагружаем виджет статистики
      await this.loadUserStats();

      // Проверяем достижения
      if (window.gamificationSystem) {
        await window.gamificationSystem.checkAchievements();
      }

      this.showNotification(t("Статистика успешно сброшена!"), "success");
      console.log("User stats reset:", actualStats);
    } catch (error) {
      console.error("Error resetting user stats:", error);
      this.showNotification(t("Ошибка при сбросе статистики"), "error");
    }
  }

  /**
   * Получить мотивационное сообщение
   */
  getMotivationMessage(streak, totalReports) {
    // Убираем мотивационную плашку
    return "";
  }

  /**
   * Обновить статус отчёта
   */
  updateReportStatus(hasReport) {
    const statusElement = document.getElementById("report-status");
    if (statusElement) {
      statusElement.textContent = hasReport ? "✅" : "❌";
    }
  }

  /**
   * Показать уведомление об успехе
   */
  showSuccessNotification() {
    this.showNotification(t("Отчёт отправлен! Отличная работа!"), "success");
  }

  /**
   * Удалить отчёт пользователя
   */
  async deleteReport(reportId) {
    if (!this.user) return;

    try {
      // Подтверждение удаления
      if (!confirm(t("Вы уверены, что хотите удалить этот отчёт?"))) {
        return;
      }

      // Сначала читаем все отчёты, чтобы пересчитать статистику без удалённого
      // (после remove() повторное чтение иногда ещё возвращает старые данные)
      const reportsRef = this.db.ref(`daily_reports/${this.user.uid}`);
      const reportsSnapshot = await reportsRef.once("value");
      const allReports = reportsSnapshot.val() || {};
      const remainingReports = Object.entries(allReports)
        .filter(([id]) => id !== reportId)
        .map(([, report]) => report);

      // Удаляем отчёт из Firebase
      if (!window.achievementApi)
        throw new Error("Achievement API is not loaded");
      await window.achievementApi.deleteDailyReport(reportId);

      // Пересчитываем статистику по оставшимся отчётам и пишем в Firebase
      const actualStats = await this.calculateActualStats(remainingReports);
      await this.updateUserStatsInFirebase(actualStats);

      // Проверяем достижения после обновления статистики
      if (window.gamificationSystem) {
        await window.gamificationSystem.checkAchievements();
      }

      // Обновляем виджет статистики на странице
      await this.loadUserStats();

      // Показываем уведомление об успехе
      this.showNotification(t("Отчёт успешно удалён!"), "success");

      console.log("Report deleted:", reportId);
    } catch (error) {
      console.error("Error deleting report:", error);
      this.showNotification(t("Ошибка при удалении отчёта"), "error");
    }
  }

  /**
   * Парсинг Markdown текста
   */
  parseMarkdown(text) {
    if (!text) return "";

    return (
      text
        // Convert bullet lists (both - and •)
        .replace(/^[\s]*[-•][\s]+(.+)$/gm, "<li>$1</li>")
        .replace(/(<li>.*<\/li>)/s, "<ul>$1</ul>")
        // Convert inline code
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        // Convert bold text
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        // Convert links
        .replace(
          /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
          '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
        )
        // Convert line breaks to paragraphs
        .split("\n\n")
        .map((paragraph) => {
          if (paragraph.trim()) {
            return `<p>${paragraph.trim()}</p>`;
          }
          return "";
        })
        .join("")
    );
  }

  /**
   * Обновление прогресс-полосы
   */
  updateProgressBar() {
    const progressFill = document.querySelector(".progress-fill");
    if (!progressFill) return;

    const textFields = ["done-today", "plan-tomorrow", "problems"];
    let filledFields = 0;

    textFields.forEach((fieldId) => {
      const field = document.getElementById(fieldId);
      if (field && field.value && field.value.trim() !== "") {
        filledFields++;
      }
    });

    const progress = (filledFields / textFields.length) * 100;
    progressFill.style.width = `${progress}%`;
  }
  setupMarkdownPreview() {
    const textFields = [
      {
        id: "done-today",
        previewId: "done-today-preview",
        containerId: "done-today-preview-container",
      },
      {
        id: "plan-tomorrow",
        previewId: "plan-tomorrow-preview",
        containerId: "plan-tomorrow-preview-container",
      },
      {
        id: "problems",
        previewId: "problems-preview",
        containerId: "problems-preview-container",
      },
    ];

    textFields.forEach((field) => {
      const textarea = document.getElementById(field.id);
      const previewContainer = document.getElementById(field.containerId);
      const previewDiv = document.getElementById(field.previewId);

      if (textarea && previewContainer && previewDiv) {
        // Auto-resize textarea function
        const autoResizeTextarea = () => {
          textarea.style.height = "auto";
          const scrollHeight = textarea.scrollHeight;
          const maxHeight = 300; // Максимальная высота из CSS
          const minHeight = 96; // Минимальная высота из CSS (для field-block)

          if (scrollHeight > maxHeight) {
            textarea.style.height = maxHeight + "px";
          } else if (scrollHeight < minHeight) {
            textarea.style.height = minHeight + "px";
          } else {
            textarea.style.height = scrollHeight + "px";
          }
        };

        // Initial resize
        autoResizeTextarea();

        textarea.addEventListener("input", () => {
          autoResizeTextarea();

          const text = textarea.value.trim();
          if (text && text.length > 0) {
            const parsedHtml = this.parseMarkdown(text);
            // Only show preview if there's actual markdown content (links, code, or lists)
            if (
              parsedHtml.includes("<a href=") ||
              parsedHtml.includes("<code>") ||
              parsedHtml.includes("<ul>") ||
              parsedHtml.includes("<li>")
            ) {
              previewDiv.innerHTML = parsedHtml;
              previewContainer.style.display = "block";
            } else {
              previewContainer.style.display = "none";
            }
          } else {
            previewContainer.style.display = "none";
          }
          // Обновляем прогресс-полосу
          this.updateProgressBar();
        });

        // Auto-resize on paste
        textarea.addEventListener("paste", () => {
          setTimeout(autoResizeTextarea, 10); // Небольшая задержка для обработки вставленного текста
        });
      }
    });
  }

  /**
   * Показать/скрыть подсказку о пользе отчётов
   */
  toggleHelpTooltip() {
    const existingTooltip = document.getElementById("help-tooltip");
    if (existingTooltip) {
      // Добавляем класс для анимации закрытия
      existingTooltip.classList.add("closing");

      // Удаляем подсказку после завершения анимации
      setTimeout(() => {
        if (existingTooltip.parentNode) {
          existingTooltip.remove();
        }
      }, 300);
      return;
    }

    const tooltip = document.createElement("div");
    tooltip.id = "help-tooltip";
    tooltip.className = "help-tooltip";
    tooltip.innerHTML = `
      <div class="help-tooltip-content">
        <div class="help-tooltip-header">
          <h4>${t("💡 Зачем вести отчёты?")}</h4>
          <button class="help-tooltip-close" onclick="window.dailyReportsSystem.toggleHelpTooltip()">×</button>
        </div>
        <div class="help-tooltip-body">
          <p class="help-intro">${t("Это ни к чему не обязывает, решаете сами; но и вам, и мне, кажется, будет легче отслеживать:")}</p>
          <ul class="help-benefits">
            <li><strong>${t("Какие на текущий момент трудности")}</strong> — ${t("чтобы я мог помочь с решением")}</li>
            <li><strong>${t("Каков прогресс")}</strong> — ${t("видеть динамику обучения и достижения")}</li>
            <li><strong>${t("Что получилось или не получилось сделать")}</strong> — ${t("анализировать эффективность методов")}</li>
            <li><strong>${t("При активном обучении — скидки на постоплату")}</strong><br>
                <span class="help-discount">${t("(например, при оффере в 250 000 р. и скидке в 7% — 17 500 р. вычитается)")}</span></li>
          </ul>
          <div class="help-footer">
            <p>📝 <strong>${t("Заполнение занимает 2-3 минуты")}</strong>${t(", но в перспективе вырабатывает привычку и придаёт пользу для обучения!")}</p>
          </div>
        </div>
      </div>
    `;

    // Добавляем обработчик клика вне подсказки
    const closeTooltip = function (e) {
      if (
        !tooltip.contains(e.target) &&
        !e.target.closest(".help-tooltip-btn")
      ) {
        // Добавляем класс для анимации закрытия
        tooltip.classList.add("closing");

        // Удаляем подсказку после завершения анимации
        setTimeout(() => {
          if (tooltip.parentNode) {
            tooltip.remove();
          }
        }, 300);

        document.removeEventListener("click", closeTooltip);
        document.removeEventListener("keydown", handleEscapeTooltip);
      }
    };

    // Добавляем обработчик для клавиши Escape
    const handleEscapeTooltip = function (e) {
      if (e.key === "Escape") {
        e.preventDefault();
        // Добавляем класс для анимации закрытия
        tooltip.classList.add("closing");

        // Удаляем подсказку после завершения анимации
        setTimeout(() => {
          if (tooltip.parentNode) {
            tooltip.remove();
          }
        }, 300);

        document.removeEventListener("click", closeTooltip);
        document.removeEventListener("keydown", handleEscapeTooltip);
      }
    };

    document.addEventListener("click", closeTooltip);
    document.addEventListener("keydown", handleEscapeTooltip);

    document.body.appendChild(tooltip);

    // Анимация появления
    setTimeout(() => {
      tooltip.classList.add("show");
    }, 10);
  }

  /**
   * Показать уведомление
   */
  showNotification(message, type = "success") {
    const notification = document.createElement("div");
    notification.className = `notification ${type}-notification`;

    // Добавляем иконку в зависимости от типа
    const icon = type === "success" ? "✅" : "❌";
    notification.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span>${icon}</span>
        <span>${message}</span>
      </div>
    `;

    // Стили для уведомления
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === "success" ? "#10b981" : "#ef4444"};
      color: white;
      padding: 16px 20px;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 10000;
      font-weight: 500;
      max-width: 300px;
      word-wrap: break-word;
      opacity: 0;
      transform: translateY(-20px);
      transition: all 0.3s ease;
    `;

    document.body.appendChild(notification);

    // Анимация появления
    setTimeout(() => {
      notification.style.opacity = "1";
      notification.style.transform = "translateY(0)";
    }, 100);

    // Удаляем уведомление через 3 секунды
    setTimeout(() => {
      notification.style.opacity = "0";
      notification.style.transform = "translateY(-20px)";
      setTimeout(() => {
        if (notification.parentNode) {
          notification.remove();
        }
      }, 300);
    }, 3000);
  }
  async getUserReports(days = 7) {
    if (!this.user) return [];

    try {
      const reportsRef = this.db.ref(`daily_reports/${this.user.uid}`);
      const snapshot = await reportsRef.once("value");
      const allReports = snapshot.val() || {};

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const recentReports = Object.entries(allReports)
        .filter(([, report]) => report && typeof report === "object")
        .map(([reportKey, report]) => ({
          ...report,
          reportId: report.reportId || reportKey,
        }))
        .filter((report) => {
          const reportDate = new Date(report.date);
          return reportDate >= cutoffDate;
        })
        .sort((a, b) => b.timestamp - a.timestamp);

      return recentReports;
    } catch (error) {
      console.error("Error getting user reports:", error);
      return [];
    }
  }

  /**
   * Получить все отчёты всех пользователей (для ментора)
   */
  async getAllReports(days = 7) {
    try {
      // Используем глобальный Firebase, если this.db не инициализирован
      const db = this.db || firebase.database();
      const reportsRef = db.ref("daily_reports");
      const snapshot = await reportsRef.once("value");
      const allReports = snapshot.val() || {};

      const recentReports = [];
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      Object.keys(allReports).forEach((uid) => {
        const userReports = allReports[uid];
        if (userReports && typeof userReports === "object") {
          Object.values(userReports).forEach((reportData) => {
            if (reportData && reportData.timestamp) {
              const reportDate = new Date(reportData.date);
              if (reportDate >= cutoffDate) {
                recentReports.push({
                  ...reportData,
                  uid: uid,
                });
              }
            }
          });
        }
      });

      return recentReports.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error("Error getting all reports:", error);
      return [];
    }
  }

  // forceUpdateUserStats удалён: метод никем не вызывался, а писал он
  // users/<чужой uid> и public_stats/<чужой uid> прямо из браузера — оба
  // паттерна запрещены DATA_ACCESS_STANDARD.md. Счётчики отчётов ведёт
  // refreshReportSummary на сервере, пересборку проекций — callable
  // rebuildStaffProjections.
}

// Создаём глобальный экземпляр
window.dailyReportsSystem = new DailyReportsSystem();
