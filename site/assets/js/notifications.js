// Система уведомлений для всего сайта
// Этот файл импортируется во все страницы для отображения индикаторов уведомлений

const DEADLINE_SOON_MS = 24 * 60 * 60 * 1000;
const OVERDUE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

class NotificationSystem {
  constructor() {
    this.unreadCount = 0;
    this.notifications = [];
    this.currentUser = null;
    this.db = null;
    this.isInitialized = false;
    this.updateInterval = null;
  }

  // Инициализация системы уведомлений
  async initialize(firebaseConfig) {
    if (this.isInitialized) return;

    try {
      // Инициализируем Firebase
      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }

      this.db = firebase.database();

      // Ждем авторизации пользователя
      await this.waitForAuth();

      // Загружаем уведомления
      await this.loadNotifications();

      // Запускаем периодическое обновление
      this.startUpdateInterval();

      // Обновляем индикаторы на всех страницах (первая загрузка без анимации)
      this.updateAllIndicators(true);

      this.isInitialized = true;
    } catch (error) {
      console.error("❌ Ошибка инициализации системы уведомлений:", error);
    }
  }

  // Ожидание авторизации пользователя
  waitForAuth() {
    return new Promise((resolve) => {
      const auth = firebase.auth();

      if (auth.currentUser) {
        this.currentUser = auth.currentUser;
        resolve();
        return;
      }

      const unsubscribe = auth.onAuthStateChanged((user) => {
        if (user) {
          this.currentUser = user;
          unsubscribe();
          resolve();
        }
      });
    });
  }

  // Загрузка уведомлений из Firebase
  async loadNotifications() {
    if (!this.db || !this.currentUser) return;

    try {
      // Загружаем статус прочитанных уведомлений
      const userNotificationsRef = this.db.ref(
        `users/${this.currentUser.uid}/notifications`,
      );
      let userNotificationsData = {};
      try {
        const userNotificationsSnapshot =
          await userNotificationsRef.once("value");
        userNotificationsData = userNotificationsSnapshot.val() || {};
      } catch (error) {
        if (
          error &&
          (error.code === "PERMISSION_DENIED" ||
            error.code === "permission_denied")
        ) {
          userNotificationsData = {};
        } else {
          throw error;
        }
      }

      // Загружаем события
      const eventsRef = this.db
        .ref("events")
        .orderByChild("studentId")
        .equalTo(this.currentUser.uid);
      const eventsSnapshot = await eventsRef.once("value");
      const eventsData = eventsSnapshot.val() || {};

      // Загружаем карточки доски. Если rules еще не задеплоены, не ломаем старые уведомления.
      let tasksData = {};
      try {
        const tasksRef = this.db
          .ref("kanbanTasks")
          .orderByChild("studentId")
          .equalTo(this.currentUser.uid);
        const tasksSnapshot = await tasksRef.once("value");
        tasksData = tasksSnapshot.val() || {};
      } catch (error) {
        if (
          error &&
          (error.code === "PERMISSION_DENIED" ||
            error.code === "permission_denied")
        ) {
          console.warn(
            "Доска задач пока недоступна для уведомлений: обновите Firebase rules для kanbanTasks.",
          );
        } else {
          throw error;
        }
      }

      const userNotifications = [];

      // Обрабатываем события
      for (const [eventId, event] of Object.entries(eventsData)) {
        if (event.studentId === this.currentUser.uid) {
          // Проверяем статус события - если помечено как "готово", пропускаем
          if (event.status === "completed" || event.status === "done") {
            continue;
          }

          if (event.createdAt) {
            const eventType = this.getEventType(event);
            const eventTitle = this.getEventTitle(event, eventType);
            const notificationText = this.getEventNotificationText(
              event,
              eventType,
            );

            const notificationId = `event-${eventId}`;
            const notificationData =
              userNotificationsData[notificationId] || {};
            const isRead = notificationData.read || false;
            const isViewed = notificationData.viewed || false;

            userNotifications.push({
              id: notificationId,
              type: "event",
              eventType: eventType,
              title: eventTitle,
              text: notificationText,
              eventId: eventId,
              timestamp: event.createdAt,
              read: isRead,
              viewed: isViewed,
              mentorId: event.createdBy,
              dueDate: event.dueAt,
              dueDateStr: this.formatDeadline(event.dueAt),
              deadlineState: this.getDeadlineState(event.dueAt),
              startDate: event.startAt,
            });
          }

          // Обрабатываем комментарии
          if (event.submissions) {
            for (const [commentId, comment] of Object.entries(
              event.submissions,
            )) {
              if (comment.author !== this.currentUser.uid) {
                const authorName = await this.getAuthorName(comment.author);
                const commentText = this.getCommentNotificationText(
                  comment,
                  event,
                );
                const commentTitle = t("Комментарий от {name} ({time})", {
                  name: authorName,
                  time: this.formatTime(comment.timestamp),
                });

                const commentNotificationId = `comment-${commentId}`;
                const commentNotificationData =
                  userNotificationsData[commentNotificationId] || {};
                const isCommentRead = commentNotificationData.read || false;
                const isCommentViewed = commentNotificationData.viewed || false;

                userNotifications.push({
                  id: commentNotificationId,
                  type: "comment",
                  title: commentTitle,
                  text: commentText,
                  eventId: eventId,
                  eventTitle: event.description || t("Задание"),
                  commentId: commentId,
                  timestamp: comment.timestamp,
                  read: isCommentRead,
                  viewed: isCommentViewed,
                  authorId: comment.author,
                  authorName: authorName,
                });
              }
            }
          }
        }
      }

      // Обрабатываем карточки доски
      for (const [taskId, task] of Object.entries(tasksData)) {
        if (task.studentId !== this.currentUser.uid) continue;
        if (
          task.status === "completed" ||
          task.status === "done" ||
          task.boardStatus === "done"
        ) {
          continue;
        }

        const eventType = this.getEventType(task);
        const notificationId = `task-${taskId}`;
        const notificationData = userNotificationsData[notificationId] || {};
        userNotifications.push({
          id: notificationId,
          type: "task",
          eventType,
          title: task.title || this.getEventTitle(task, eventType),
          text: this.getEventNotificationText(task, eventType),
          eventId: taskId,
          timestamp: task.createdAt || task.updatedAt || Date.now(),
          read: notificationData.read || false,
          viewed: notificationData.viewed || false,
          mentorId: task.createdBy,
          dueDate: task.dueAt,
          dueDateStr: this.formatDeadline(task.dueAt),
          deadlineState: this.getDeadlineState(task.dueAt),
          startDate: task.startAt,
          taskId,
        });
      }

      // Сортируем по времени (новые сначала)
      this.notifications = userNotifications.sort(
        (a, b) => b.timestamp - a.timestamp,
      );
      this.unreadCount = this.notifications.filter((n) => !n.read).length;
    } catch (error) {
      console.error("❌ Ошибка загрузки уведомлений:", error);
    }
  }

  // Определение типа события
  getEventType(event) {
    // Сначала проверяем поле type события
    if (event.type) {
      switch (event.type) {
        case "assignment":
        case "task":
          return "task";
        case "meeting":
          return "meeting";
        case "mock":
          return "mock";
        default:
          return "task";
      }
    }

    // Если поле type отсутствует, определяем по описанию (fallback)
    if (event.description) {
      const desc = event.description.toLowerCase();
      if (desc.includes("встреча") || desc.includes("meeting")) {
        return "meeting";
      } else if (
        desc.includes("собес") ||
        desc.includes("interview") ||
        desc.includes("мок")
      ) {
        return "mock";
      } else if (
        desc.includes("задание") ||
        desc.includes("assignment") ||
        desc.includes("task")
      ) {
        return "task";
      }
    }

    // По умолчанию считаем заданием
    return "task";
  }

  // Те же границы, что у серверного дайджеста в functions/student-notifications.js,
  // чтобы список на сайте совпадал с тем, что ученик получает в Telegram.
  getDeadlineState(dueAt, now = Date.now()) {
    const due = Date.parse(dueAt);
    if (!Number.isFinite(due)) return "";
    if (due < now) return now - due <= OVERDUE_WINDOW_MS ? "overdue" : "";
    return due - now <= DEADLINE_SOON_MS ? "soon" : "";
  }

  formatDeadline(dueAt) {
    const due = new Date(dueAt);
    if (Number.isNaN(due.getTime())) return "";
    return due.toLocaleDateString(window.i18n?.locale || "ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // Получение заголовка события
  getEventTitle(event, eventType) {
    let title = t("Новое задание");

    if (eventType === "meeting") {
      title = t("Новая встреча запланирована");
    } else if (eventType === "mock") {
      title = t("Новое мок-собеседование запланировано");
    }

    if (event.dueAt && eventType === "task") {
      title = t("Новое задание с дедлайном");
    }

    // НЕ добавляем время начала в заголовок для встреч и мок-собеседований

    // Имя берем из денормализованного поля: читать чужой профиль ради заголовка
    // запрещено правилами доступа, а прежний .then() дописывал строку уже после
    // return и никогда не попадал в уведомление.
    if (
      event.createdByName &&
      event.createdBy &&
      event.createdBy !== this.currentUser.uid
    ) {
      title = t("{title} от {name}", { title, name: event.createdByName });
    }

    return title;
  }

  // Получение текста уведомления о событии
  getEventNotificationText(event, eventType) {
    let text = event.description || t("Описание отсутствует");

    // НЕ добавляем дедлайн в текст - он отображается отдельно
    if (event.dueAt && eventType === "task") {
      const dueDate = new Date(event.dueAt);
      const dueDateStr = dueDate.toLocaleDateString(
        window.i18n?.locale || "ru-RU",
        {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        },
      );
      // НЕ добавляем в текст
    }

    // НЕ добавляем время начала в текст - только для внутреннего использования
    if (event.startAt && (eventType === "meeting" || eventType === "mock")) {
      const startDate = new Date(event.startAt);
      const startDateStr = startDate.toLocaleDateString(
        window.i18n?.locale || "ru-RU",
        {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        },
      );
      // НЕ добавляем в текст
    }

    // НЕ добавляем информацию о менторе - она уже есть в заголовке
    if (event.createdBy && event.createdBy !== this.currentUser.uid) {
      // Информация о менторе уже в заголовке
    }

    return text;
  }

  // Получение текста уведомления о комментарии
  getCommentNotificationText(comment, event) {
    let text = comment.text;

    if (event.description) {
      text += "\n\n" + t("📝 В задании: {task}", { task: event.description });
    }

    return text;
  }

  // Получение имени автора
  async getAuthorName(authorId) {
    if (!authorId) return t("Неизвестный");

    try {
      const userRef = this.db.ref(`users/${authorId}`);
      const userSnapshot = await userRef.once("value");
      const userData = userSnapshot.val();

      if (userData && userData.displayName) {
        return userData.displayName;
      } else if (userData && userData.email) {
        return userData.email;
      } else {
        return t("Пользователь {id}", { id: authorId.slice(0, 8) });
      }
    } catch (error) {
      if (
        error &&
        (error.code === "PERMISSION_DENIED" ||
          error.code === "permission_denied")
      ) {
        return t("Пользователь {id}", { id: authorId.slice(0, 8) });
      }
      console.warn(
        "Не удалось получить информацию о пользователе:",
        authorId,
        error,
      );
      return t("Пользователь {id}", { id: authorId.slice(0, 8) });
    }
  }

  // Форматирование времени
  formatTime(timestamp) {
    const time = new Date(timestamp);
    return time.toLocaleDateString(window.i18n?.locale || "ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // Запуск периодического обновления
  startUpdateInterval() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    // Обновляем каждые 5 минут
    this.updateInterval = setInterval(
      async () => {
        await this.loadNotifications();
        this.updateAllIndicators();
      },
      5 * 60 * 1000,
    );
    // При возврате на вкладку обновляем уведомления — тогда затемнение на главной пропадёт сразу после прочтения в профиле
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        this.loadNotifications().then(() => this.updateAllIndicators());
      }
    });
  }

  isMainPage() {
    return (
      document.body.classList.contains("main") ||
      (typeof window !== "undefined" &&
        window.location.pathname.includes("main.html"))
    );
  }

  // Обновление всех индикаторов на странице
  updateAllIndicators(isInitialLoad = false) {
    this.updateNavigationIndicators(isInitialLoad);
    this.updatePageTitleBadge();
    this.updateProfileIndicators(isInitialLoad);
    // На главной всегда убираем затемнение от интро-тура; при отсутствии непрочитанных — и на остальных страницах
    if (this.isMainPage() || this.unreadCount === 0) {
      this.removeIntroTourOverlay();
    }
  }

  // Удаление затемняющего overlay интро-тура с главной (чтобы затемнение пропадало после прочтения уведомлений)
  removeIntroTourOverlay() {
    try {
      // Идущий тур не трогаем: end() снял бы его без markIntroAsShown(), и при
      // следующем входе он запустился бы заново. Метод вызывается по таймеру
      // и на visibilitychange, так что иначе тур не пережил бы переключение вкладки.
      if (window.introTour && window.introTour.isActive) return;
      if (window.introTour && typeof window.introTour.end === "function") {
        window.introTour.end();
      }
      document
        .querySelectorAll(
          ".intro-tour-overlay, .intro-tour-spotlight, .intro-tour-tooltip",
        )
        .forEach(function (el) {
          el.remove();
        });
    } catch (e) {}
  }

  // Обновление индикаторов в навигации (на main.html красные точки не показываем)
  // У карточки «Обратная связь» (feedbacks) индикатор не показываем — он про события/комменты, не про фидбеки
  updateNavigationIndicators(isInitialLoad = false) {
    if (this.isMainPage()) {
      document
        .querySelectorAll(".nav-notification-indicator")
        .forEach(function (el) {
          el.style.display = "none";
        });
      return;
    }
    const profileLinks = document.querySelectorAll(
      'a[href*="profile"], a[href*="profile.html"]',
    );
    profileLinks.forEach((link) => {
      const href = (link.getAttribute("href") || "").toLowerCase();
      if (href.includes("feedbacks")) {
        const ind = link.querySelector(".nav-notification-indicator");
        if (ind) ind.remove();
        return;
      }
      let indicator = link.querySelector(".nav-notification-indicator");
      if (!indicator) {
        indicator = document.createElement("div");
        indicator.className = "nav-notification-indicator";
        link.style.position = "relative";
        link.appendChild(indicator);
      }
      this.updateIndicatorState(indicator, isInitialLoad);
    });
    const profileIcons = document.querySelectorAll(
      ".avatar, .profile-icon, .user-icon, [data-profile-icon]",
    );
    profileIcons.forEach((icon) => {
      let indicator = icon.querySelector(".nav-notification-indicator");
      if (!indicator) {
        indicator = document.createElement("div");
        indicator.className = "nav-notification-indicator";
        icon.style.position = "relative";
        icon.appendChild(indicator);
      }
      this.updateIndicatorState(indicator, isInitialLoad);
    });
  }

  // Обновление индикатора в заголовке страницы (на main.html бейдж не показываем)
  updatePageTitleBadge() {
    const pageTitle = document.querySelector("#title, h1");
    if (!pageTitle) return;
    const oldBadge = pageTitle.querySelector(".title-notification-badge");
    if (oldBadge) oldBadge.remove();
    if (this.isMainPage()) return;

    if (this.unreadCount > 0) {
      const badge = document.createElement("span");
      badge.className = "title-notification-badge";
      badge.textContent = ` (${this.unreadCount})`;
      badge.style.color = "#ef4444";
      badge.style.fontWeight = "bold";
      pageTitle.appendChild(badge);
    }
  }

  // Обновление индикаторов на странице профиля (на main.html красные точки в шапке не показываем)
  updateProfileIndicators(isInitialLoad = false) {
    if (this.isMainPage()) {
      document
        .querySelectorAll(
          ".header-notification-indicator, .avatar-notification-indicator",
        )
        .forEach(function (el) {
          el.style.display = "none";
        });
      return;
    }
    const profileHeader = document.querySelector(".page-header");
    if (profileHeader) {
      let headerIndicator = profileHeader.querySelector(
        ".header-notification-indicator",
      );
      if (!headerIndicator) {
        headerIndicator = document.createElement("div");
        headerIndicator.className = "header-notification-indicator";
        profileHeader.style.position = "relative";
        profileHeader.appendChild(headerIndicator);
      }
      this.updateIndicatorState(headerIndicator, isInitialLoad);
    }
    const avatar = document.querySelector("#avatar");
    if (avatar) {
      let avatarIndicator = avatar.querySelector(
        ".avatar-notification-indicator",
      );
      if (!avatarIndicator) {
        avatarIndicator = document.createElement("div");
        avatarIndicator.className = "avatar-notification-indicator";
        avatar.style.position = "relative";
        avatar.appendChild(avatarIndicator);
      }
      this.updateIndicatorState(avatarIndicator, isInitialLoad);
    }
  }

  // Обновление состояния индикатора
  updateIndicatorState(indicator, isInitialLoad = false) {
    if (this.unreadCount > 0) {
      indicator.classList.remove("hidden", "no-notifications");
      indicator.classList.add("has-notifications");
      indicator.style.display = "block";
    } else {
      indicator.classList.remove("has-notifications");
      indicator.classList.add("no-notifications");

      // При первой загрузке скрываем сразу без анимации
      if (isInitialLoad) {
        indicator.classList.add("hidden");
        indicator.style.display = "none";
      } else {
        // При последующих обновлениях используем анимацию
        setTimeout(() => {
          if (this.unreadCount === 0) {
            indicator.classList.add("hidden");
          }
        }, 1000);
      }
    }
  }

  // Получение количества непрочитанных уведомлений
  getUnreadCount() {
    return this.unreadCount;
  }

  // Получение всех уведомлений
  getNotifications() {
    return this.notifications;
  }

  // Очистка ресурсов
  destroy() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.isInitialized = false;
  }
}

// Создаем глобальный экземпляр
window.notificationSystem = new NotificationSystem();

// Автоматическая инициализация при загрузке страницы
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Ждем загрузки конфигурации Firebase
    if (window.configLoader) {
      const firebaseConfig = await window.configLoader.loadFirebaseConfig();
      await window.notificationSystem.initialize(firebaseConfig);
    }
  } catch (error) {
    console.error(
      "❌ Ошибка автоматической инициализации системы уведомлений:",
      error,
    );
  }
});
