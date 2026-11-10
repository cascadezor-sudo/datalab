// Leaderboard Component

// Перевод: t() и window.i18n кладёт сниппет theme-boot. Под Node (тесты)
// сниппета нет — подставляем русский как есть.
if (typeof t !== "function")
  globalThis.t = (text, params) =>
    text.replace(/\{(\w+)\}/g, (match, key) => params?.[key] ?? match);

class Leaderboard {
  constructor() {
    this.firebaseConfig = null;
    this.db = null;
    this.currentUser = null;
    this.usersData = {};
    this.leaderboardData = [];
    this.publicStats = {};
    this.studentLearningFormats = {};
    this.currentUserRole = null;
    this.timeFilter = "all";
    this.sortKey = "questions";
    this.sortDir = "desc";
    this.categoryFilter = "all";
    this.subgroupFilter = "all";
    // Секция лидерборда: ученики на менторстве и покупатели доступа к
    // материалам соревнуются раздельно — форматы несравнимы между собой.
    this.formatFilter = "mentorship";
    this.formatFilterTouched = false;
    // Секции, доступные зрителю. Считает сервер и присылает в ответе
    // callable: ученик видит только свой зачёт, куратор — только менторство,
    // ментор — оба. До ответа держим один формат, чтобы в окне загрузки не
    // мигала вкладка, которой у зрителя может не быть.
    this.visibleFormats = ["mentorship"];
    this.accessPlansConfig = {};
    this.showInactiveStudents = false;
    this.editingSubgroupHistoryUserId = null;
    this.isInitialized = false;

    // Question categories mapping with automatic loading
    this.questionCategories = {};
    this.totalQuestionsByCategory = {};

    // Loading animation configuration - only wave animation
    this.loadingAnimationType = "wave";
  }

  /**
   * Initialize the leaderboard
   */
  async initialize(firebaseConfig) {
    try {
      this.firebaseConfig = firebaseConfig;

      // Initialize Firebase
      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }

      this.db = firebase.database();
      this.initSubgroupHistoryEditor();

      // Load questions list first
      await this.loadQuestionsList();
      await this.loadAccessPlansConfig();

      // Continue with auth and other initialization...
      firebase.auth().onAuthStateChanged((user) => {
        this.currentUser = user;
        if (user) {
          // Load leaderboard data once when user is authenticated
          this.loadLeaderboardData();
        } else {
          this.showLoginMessage();
        }
      });

      this.isInitialized = true;
    } catch (error) {
      console.error("Failed to initialize leaderboard:", error);
      this.showError(t("Ошибка инициализации лидерборда"));
    }
  }

  /**
   * Start listening to real-time updates from Firebase
   */
  startRealtimeUpdates() {
    // Cross-user staff data is loaded explicitly through callable API.
    // Do not restore a browser listener on /users here.
    return;
  }

  /**
   * Load leaderboard data from Firebase (optimized)
   */
  async loadLeaderboardData() {
    try {
      if (!this.currentUser) {
        return;
      }

      // Show loading state
      this.showLoadingState();

      this.currentUserRole = await this.loadCurrentUserRole();
      if (!this.canReadPrivateLeaderboard()) {
        await this.loadPublicLeaderboardData();
        return;
      }

      const staffData = await window.staffApi.getStaffLeaderboardData();
      this.usersData = staffData.users || {};
      this.allAchievements = staffData.achievements || {};
      this.publicStats = staffData.publicStats || {};
      this.studentLearningFormats = staffData.studentLearningFormats || {};
      this.applyVisibleFormats(staffData.visibleFormats);

      this.applyDefaultFormatFilter();
      await this.processLeaderboardDataOptimized();
      this.applySort();
      this.updateUI();
    } catch (error) {
      console.error("Failed to load leaderboard data:", error);

      // Публичный путь тоже может упасть — например, callable ещё не выкачен
      // или отвечает холодным стартом. Без своего catch исключение отсюда
      // становится необработанным (loadLeaderboardData вызывают без await), и
      // ученик остаётся один на один с вечным скелетоном загрузки.
      if (error.code === "PERMISSION_DENIED") {
        try {
          await this.loadPublicLeaderboardData();
          return;
        } catch (publicError) {
          console.error("Failed to load public leaderboard:", publicError);
        }
      }
      this.showError(t("Ошибка загрузки данных лидерборда"));
    }
  }

  async loadCurrentUserRole() {
    try {
      const roleSnapshot = await this.db
        .ref(`users/${this.currentUser.uid}/role`)
        .once("value");
      return String(roleSnapshot.val() || "student").toLowerCase();
    } catch (_error) {
      return "student";
    }
  }

  canReadPrivateLeaderboard() {
    return ["mentor", "curator", "admin", "admin-helper"].includes(
      this.currentUserRole,
    );
  }

  normalizeSelectedAchievement(value) {
    const id =
      typeof value === "string" ? value : value?.id || value?.achievementId;
    if (typeof id === "string" && /^[a-z0-9_-]+$/i.test(id)) return { id };
    const legacyTitle =
      typeof value === "object" ? value?.title || value?.name : null;
    return typeof legacyTitle === "string" && legacyTitle.trim()
      ? { legacyTitle: legacyTitle.trim() }
      : null;
  }

  /**
   * Строки публичного лидерборда.
   *
   * `knownStudents` — профили из callable, то есть реальные ученики каталога.
   * В `public_stats` попадают и учётки, которые завели аккаунт и исчезли, не
   * дойдя до карточки ученика: у них нет ни имени, ни формата, и в таблице
   * они выглядели бы безымянными «Участниками». Раньше их прятал порог
   * активности, теперь — отсутствие профиля.
   */
  buildUsersDataFromPublicStats(publicStats, knownStudents = null) {
    const users = {};
    Object.entries(publicStats || {}).forEach(([uid, stats]) => {
      if (!stats || typeof stats !== "object") return;
      if (this.isStaffLeaderboardUser(stats)) return;
      if (knownStudents && !knownStudents[uid]) return;
      users[uid] = {
        displayName: stats.displayName || "Участник",
        avatarUrl: stats.avatarUrl || null,
        selectedAchievement: this.normalizeSelectedAchievement(
          stats.selectedAchievementId || stats.selectedAchievement,
        ),
        subgroup: stats.subgroup || "",
        status: stats.status || "active",
        role: stats.role || "student",
        progress: Object.fromEntries(
          Object.entries(stats.progress || {}).map(([questionId, value]) => [
            questionId,
            typeof value === "number"
              ? { completed: true, timestamp: value }
              : value,
          ]),
        ),
        completedQuestionsCount: Number(
          stats.completedQuestions || stats.totalTasksCompleted || 0,
        ),
        quizResults: stats.quizResults || {},
        registrationDate: stats.registrationDate || null,
        subgroupHistory: stats.subgroupHistory || null,
        finishedAt: stats.finishedAt || null,
      };
    });
    return users;
  }

  // syncPublicLeaderboardSummaries удалён: метод никем не вызывался, а делал
  // ровно то, что делает серверный rebuildStaffProjections — только из
  // браузера и корневым ref().update() по чужим public_stats. Ветка теперь
  // закрыта на запись правилами, так что этот код всё равно не смог бы
  // отработать.

  /**
   * Публичный лидерборд ученика.
   *
   * Счётчики, форматы и имена приходят одним callable, который отдаёт только
   * ту секцию, где зритель соревнуется сам: `public_stats` и
   * `student_learning_formats` закрыты правилами, поэтому читать их из
   * браузера больше нельзя — и чужая когорта в браузер не попадает вовсе.
   */
  async loadPublicLeaderboardData() {
    const [publicView, ownUserSnapshot, ownAchievementsSnapshot] =
      await Promise.all([
        window.staffApi.getPublicLeaderboard(),
        this.db.ref(`users/${this.currentUser.uid}`).once("value"),
        this.db.ref(`user_achievements/${this.currentUser.uid}`).once("value"),
      ]);

    const publicProfiles = publicView?.profiles || {};
    this.publicStats = publicView?.publicStats || {};
    this.studentLearningFormats = publicView?.studentLearningFormats || {};
    this.applyVisibleFormats(publicView?.visibleFormats);
    this.usersData = this.buildUsersDataFromPublicStats(
      this.publicStats,
      publicProfiles,
    );
    Object.keys(this.usersData).forEach((uid) => {
      const profile = publicProfiles?.[uid];
      if (profile?.displayName) {
        this.usersData[uid].displayName = profile.displayName;
      }
      // Проекция форматов появилась раньше callable-профилей: для учёток без
      // записи формат берём из профиля.
      const publicFormat =
        this.studentLearningFormats[uid] || profile?.learningFormat;
      this.usersData[uid].learningFormat =
        publicFormat === "materials" ? "materials" : "mentorship";
      // Присваиваем только реальные ключи: пустой массив навсегда перекрыл
      // бы `accessPlanGrants` собственной учётки, которые домешиваются ниже,
      // и в окне «функции ещё не выкачены» бейдж пропал бы и у самого зрителя.
      if (profile?.accessPlanKeys?.length) {
        this.usersData[uid].accessPlanKeys = profile.accessPlanKeys;
      }
    });

    const ownUserData = ownUserSnapshot.val() || {};
    if (Object.keys(ownUserData).length > 0) {
      this.usersData[this.currentUser.uid] = {
        ...(this.usersData[this.currentUser.uid] || {}),
        ...ownUserData,
      };
      this.publicStats[this.currentUser.uid] = {
        ...(this.publicStats[this.currentUser.uid] || {}),
        totalStudyHours:
          this.publicStats[this.currentUser.uid]?.totalStudyHours ??
          ownUserData.totalStudyHours ??
          0,
      };
    }

    this.allAchievements = {
      [this.currentUser.uid]: ownAchievementsSnapshot.val() || {},
    };

    this.applyDefaultFormatFilter();
    await this.processLeaderboardDataOptimized();
    this.applySort();
    this.updateUI();
  }

  /**
   * Generate loading animation HTML - only wave animation
   * @returns {string} - HTML string for loading animation
   */
  generateLoadingAnimation() {
    return `
      <div class="loading-wave">
        <div class="loading-wave-bar"></div>
        <div class="loading-wave-bar"></div>
        <div class="loading-wave-bar"></div>
        <div class="loading-wave-bar"></div>
        <div class="loading-wave-bar"></div>
      </div>
    `;
  }

  /**
   * Show loading state — skeleton rows
   */
  showLoadingState() {
    const leaderboardList = document.getElementById("leaderboardList");
    if (!leaderboardList) return;

    // Stat cards skeleton
    if (window.SkeletonLoader) {
      SkeletonLoader.show("stat", "#leaderboardStats", 3);
    }

    const skeletonRow = () => `
      <div class="leaderboard-entry--skeleton">
        <div class="sk sk-circle sk-lb-rank" style="width:36px;height:36px"></div>
        <div class="sk sk-circle sk-lb-avatar" style="width:40px;height:40px"></div>
        <div class="sk-lb-info" style="flex:1;display:flex;flex-direction:column;gap:7px">
          <div class="sk sk-lb-name" style="height:14px;width:55%"></div>
          <div class="sk sk-lb-email" style="height:11px;width:38%"></div>
        </div>
        <div class="sk-lb-stats" style="display:flex;gap:16px">
          <div class="sk sk-lb-stat" style="width:36px;height:14px"></div>
          <div class="sk sk-lb-stat" style="width:36px;height:14px"></div>
          <div class="sk sk-lb-stat" style="width:36px;height:14px"></div>
          <div class="sk sk-lb-stat" style="width:36px;height:14px"></div>
          <div class="sk sk-lb-stat" style="width:36px;height:14px"></div>
        </div>
      </div>`;

    leaderboardList.innerHTML = `<div class="leaderboard--skeleton">${Array(8).fill(0).map(skeletonRow).join("")}</div>`;
  }

  /**
   * Process raw user data into leaderboard format (optimized)
   */
  async processLeaderboardDataOptimized() {
    const leaderboardEntries = [];
    const finishedUsers = [];
    const staffProfiles = [];

    // Process all users in a single pass
    for (const userId of Object.keys(this.usersData)) {
      const userData = this.usersData[userId];
      if (this.isHiddenStaffUser(userData)) continue;

      const progress = userData.progress || {};

      // Check user status and set default to 'active' if not set
      let userStatus = userData.status || "active";
      const isFinished = userStatus === "finished" || userStatus === "departed";

      // If user doesn't have a status, set it to 'active' in Firebase
      if (!userData.status) {
        this.setDefaultUserStatus(userId);
        userStatus = "active";
      }

      // Filter by category (including 'all' via allowed ID set)
      let filteredProgress = progress;
      const allowedIds = this.getAllowedIdsForCategory(this.categoryFilter);
      if (allowedIds) {
        const tmp = {};
        Object.keys(progress).forEach((questionId) => {
          if (allowedIds.has(questionId)) {
            tmp[questionId] = progress[questionId];
          }
        });
        filteredProgress = tmp;
      }

      // Filter by time if needed
      if (this.timeFilter !== "all") {
        const cutoffTime = this.getCutoffTime(this.timeFilter);
        const timeFilteredProgress = {};
        Object.keys(filteredProgress).forEach((questionId) => {
          const questionData = filteredProgress[questionId];
          if (questionData.timestamp && questionData.timestamp >= cutoffTime) {
            timeFilteredProgress[questionId] = questionData;
          }
        });
        filteredProgress = timeFilteredProgress;
      }

      // Filter by subgroup if needed. Подгруппы — понятие менторства:
      // покупателей материалов фильтр не касается, иначе выбранная подгруппа
      // обнуляла бы счётчик соседней вкладки.
      if (
        this.subgroupFilter !== "all" &&
        userData.learningFormat !== "materials"
      ) {
        const userSubgroup = userData.subgroup || "";
        if (this.subgroupFilter === "none") {
          // Show only users without subgroup
          if (userSubgroup !== "") {
            continue; // Skip this user
          }
        } else {
          // Show only users with specific subgroup
          if (userSubgroup !== this.subgroupFilter) {
            continue; // Skip this user
          }
        }
      }

      // Calculate stats
      let completedQuestions = Object.keys(filteredProgress).filter(
        (qId) => filteredProgress[qId].completed,
      );
      if (
        completedQuestions.length === 0 &&
        this.categoryFilter === "all" &&
        this.timeFilter === "all" &&
        !this.canReadPrivateLeaderboard() &&
        Number.isFinite(Number(userData.completedQuestionsCount)) &&
        Number(userData.completedQuestionsCount) > 0
      ) {
        completedQuestions = Array.from({
          length: Number(userData.completedQuestionsCount),
        });
      }

      const totalQuestions = this.getTotalQuestionsForCategory(
        this.categoryFilter,
      );
      const progressPercentage =
        totalQuestions > 0
          ? Math.min(
              Math.round((completedQuestions.length / totalQuestions) * 100),
              100,
            )
          : 0;

      // Get last activity
      const lastActivity = this.getLastActivity(filteredProgress);

      // Get user info
      const userInfo = this.getUserInfo(userId, userData);

      // Get user achievements (optimized - no database call)
      const userAchievements = this.getUserAchievementsOptimized(userId);
      const totalAchievements =
        typeof window.gamificationSystem !== "undefined" &&
        window.gamificationSystem.achievements
          ? Object.keys(window.gamificationSystem.achievements).length
          : 0;
      const achievementPercent =
        totalAchievements > 0
          ? Math.min(
              100,
              Math.round((userAchievements.length / totalAchievements) * 100),
            )
          : 0;
      const studyHours = Number(
        (this.publicStats[userId] &&
          this.publicStats[userId].totalStudyHours) ||
          0,
      );
      const { quizzesSolved, quizAveragePercent } = this.getQuizStats(
        userData.quizResults || {},
        userData.quizStats || null,
      );

      // У сотрудника public_stats нет, поэтому часы приходят нулевыми. Строку
      // всё равно рисуем: через неё редактируются статус, подгруппа и даты
      // переходов выпускника, ставшего куратором. Но в рейтинг она не входит —
      // такие записи уходят в отдельную секцию под списком учеников.
      const isStaffProfile = this.retainsStudentProfile(userData);

      // В общем зачёте строку получает каждый ученик, а не только начавший
      // заниматься: купивший доступ к материалам может ещё не решить ни одного
      // вопроса, и его отсутствие в таблице выглядит как потерянная оплата.
      // Ноль — валидный старт. (Безымянные учётки сюда не доходят: их
      // отсеивают buildUsersDataFromPublicStats и серверные сборщики.)
      //
      // А вот выбранный срез — «за неделю», отдельная категория — обязан
      // сужать таблицу: там ноль означает «в этот период не занимался», и
      // показывать такую строку значит превращать фильтр в декорацию.
      const isFilteredView =
        this.timeFilter !== "all" || this.categoryFilter !== "all";
      if (
        isFilteredView &&
        completedQuestions.length === 0 &&
        !isStaffProfile
      ) {
        continue;
      }
      const entry = {
        isStaffProfile: isStaffProfile,
        userId: userId,
        userInfo: userInfo,
        completedQuestions: completedQuestions.length,
        progressPercentage: progressPercentage,
        lastActivity: lastActivity,
        totalQuestions: totalQuestions,
        status: userStatus,
        isFinished: isFinished,
        achievements: userAchievements,
        achievementPercent,
        studyHours: studyHours,
        quizzesSolved,
        quizAveragePercent,
        registrationDate: userData.registrationDate || null,
        subgroupHistory: userData.subgroupHistory || null,
        finishedAt: userData.finishedAt || null,
      };

      if (isStaffProfile) {
        staffProfiles.push(entry);
      } else if (isFinished) {
        finishedUsers.push(entry);
      } else {
        leaderboardEntries.push(entry);
      }
    }

    // Sort active users by completed questions (descending), then by study hours
    leaderboardEntries.sort((a, b) => {
      if (b.completedQuestions !== a.completedQuestions) {
        return b.completedQuestions - a.completedQuestions;
      }
      return (b.studyHours || 0) - (a.studyHours || 0);
    });

    // Sort finished users by last activity (descending)
    finishedUsers.sort((a, b) => b.lastActivity - a.lastActivity);

    staffProfiles.sort((a, b) =>
      a.userInfo.displayName.localeCompare(b.userInfo.displayName, "ru"),
    );

    // Combine: active users first, then finished users, then staff profiles
    this.leaderboardData = [
      ...leaderboardEntries,
      ...finishedUsers,
      ...staffProfiles,
    ];
  }

  /**
   * Get quiz stats from quizResults (users/{uid}/quizResults)
   * @param {Object} quizResults - { quizId: { pushId: { score, timestamp }, ... }, ... }
   * @param {Object|null} aggregate - compact server-side quiz summary
   * @returns {{ quizzesSolved: number, quizAveragePercent: number }}
   */
  getQuizStats(quizResults, aggregate = null) {
    if (aggregate && typeof aggregate === "object") {
      const breakdown = aggregate.quizBreakdown || {};
      const solved = Number(aggregate.completedQuizzes);
      const quizzesSolved = Number.isFinite(solved)
        ? solved
        : Object.keys(breakdown).length;
      const bestScores = Object.values(breakdown)
        .map((quiz) => Number(quiz?.bestScore))
        .filter(Number.isFinite);
      const average = bestScores.length
        ? bestScores.reduce((sum, score) => sum + score, 0) / bestScores.length
        : Number(aggregate.averageScore) || 0;
      return {
        quizzesSolved,
        quizAveragePercent: Math.round(average <= 1 ? average * 100 : average),
      };
    }
    const quizIds = Object.keys(quizResults);
    if (quizIds.length === 0)
      return { quizzesSolved: 0, quizAveragePercent: 0 };
    let sumBest = 0;
    quizIds.forEach((quizId) => {
      const attempts = Object.values(quizResults[quizId] || {});
      const best = attempts.length
        ? Math.max(
            ...attempts.map((a) => (typeof a.score === "number" ? a.score : 0)),
          )
        : 0;
      sumBest += best;
    });
    const quizAveragePercent = Math.round((sumBest / quizIds.length) * 100);
    return { quizzesSolved: quizIds.length, quizAveragePercent };
  }

  /**
   * Set sort column and direction, then re-render
   */
  setSort(key) {
    if (this.sortKey === key) {
      this.sortDir = this.sortDir === "asc" ? "desc" : "asc";
    } else {
      this.sortKey = key;
      this.sortDir = "desc";
    }
    this.applySort();
    this.updateUI();
  }

  /**
   * Apply current sort to leaderboardData
   */
  applySort() {
    const key = this.sortKey;
    // desc = 1 (larger first: vb - va), asc = -1 (smaller first: va - vb)
    const dir = this.sortDir === "asc" ? -1 : 1;
    const getVal = (entry, k) => {
      if (k === "questions") return entry.completedQuestions ?? 0;
      if (k === "hours") return entry.studyHours ?? 0;
      if (k === "quizzes") return entry.quizzesSolved ?? 0;
      if (k === "quizPercent") return entry.quizAveragePercent ?? 0;
      if (k === "achievementPercent") return entry.achievementPercent ?? 0;
      return 0;
    };
    this.leaderboardData.sort((a, b) => {
      // 0) Сотрудники с сохранённой ученической историей не участвуют в
      //    рейтинге и всегда идут последними — отдельной секцией под списком
      if (a.isStaffProfile !== b.isStaffProfile) {
        return a.isStaffProfile ? 1 : -1;
      }

      // 1) Всегда держим завершивших обучение (finished/departed) внизу,
      //    независимо от выбранного ключа сортировки и направления
      if (a.isFinished !== b.isFinished) {
        return a.isFinished ? 1 : -1; // active/other сначала, finished/departed — в конце
      }

      // 2) Внутри каждой группы сортируем по выбранному ключу
      const va = getVal(a, key);
      const vb = getVal(b, key);
      if (va !== vb) return (vb - va) * dir;
      // tie-break: always by questions descending (more questions first)
      return getVal(b, "questions") - getVal(a, "questions");
    });
  }

  /**
   * Process raw user data into leaderboard format (legacy)
   */
  async processLeaderboardData() {
    const leaderboardEntries = [];
    const finishedUsers = [];
    const staffProfiles = [];

    for (const userId of Object.keys(this.usersData)) {
      const userData = this.usersData[userId];
      if (this.isHiddenStaffUser(userData)) continue;

      const progress = userData.progress || {};

      // Check user status and set default to 'active' if not set
      let userStatus = userData.status || "active";
      const isFinished = userStatus === "finished" || userStatus === "departed";

      // If user doesn't have a status, set it to 'active' in Firebase
      if (!userData.status) {
        this.setDefaultUserStatus(userId);
        userStatus = "active";
      }

      // Filter by category (including 'all' via allowed ID set)
      let filteredProgress = progress;
      const allowedIds = this.getAllowedIdsForCategory(this.categoryFilter);
      if (allowedIds) {
        const tmp = {};
        Object.keys(progress).forEach((questionId) => {
          if (allowedIds.has(questionId)) {
            tmp[questionId] = progress[questionId];
          }
        });
        filteredProgress = tmp;
      }

      // Filter by time if needed
      if (this.timeFilter !== "all") {
        const cutoffTime = this.getCutoffTime(this.timeFilter);
        const timeFilteredProgress = {};
        Object.keys(filteredProgress).forEach((questionId) => {
          const questionData = filteredProgress[questionId];
          if (questionData.timestamp && questionData.timestamp >= cutoffTime) {
            timeFilteredProgress[questionId] = questionData;
          }
        });
        filteredProgress = timeFilteredProgress;
      }

      // Calculate stats
      const completedQuestions = Object.keys(filteredProgress).filter(
        (qId) => filteredProgress[qId].completed,
      );

      const totalQuestions = this.getTotalQuestionsForCategory(
        this.categoryFilter,
      );
      const progressPercentage =
        totalQuestions > 0
          ? Math.min(
              Math.round((completedQuestions.length / totalQuestions) * 100),
              100,
            )
          : 0;

      // Get last activity
      const lastActivity = this.getLastActivity(filteredProgress);

      // Get user info
      const userInfo = this.getUserInfo(userId, userData);

      // Get user achievements
      const userAchievements = await this.getUserAchievements(userId);

      const isStaffProfile = this.retainsStudentProfile(userData);
      if (completedQuestions.length > 0 || isStaffProfile) {
        const entry = {
          isStaffProfile: isStaffProfile,
          userId: userId,
          userInfo: userInfo,
          completedQuestions: completedQuestions.length,
          progressPercentage: progressPercentage,
          lastActivity: lastActivity,
          totalQuestions: totalQuestions,
          status: userStatus,
          isFinished: isFinished,
          achievements: userAchievements,
        };

        if (isStaffProfile) {
          staffProfiles.push(entry);
        } else if (isFinished) {
          finishedUsers.push(entry);
        } else {
          leaderboardEntries.push(entry);
        }
      }
    }

    // Sort active users by completed questions (descending), then by progress percentage
    leaderboardEntries.sort((a, b) => {
      if (b.completedQuestions !== a.completedQuestions) {
        return b.completedQuestions - a.completedQuestions;
      }
      return b.progressPercentage - a.progressPercentage;
    });

    // Sort finished users by last activity (descending)
    finishedUsers.sort((a, b) => b.lastActivity - a.lastActivity);

    staffProfiles.sort((a, b) =>
      a.userInfo.displayName.localeCompare(b.userInfo.displayName, "ru"),
    );

    // Combine: active users first, then finished users, then staff profiles
    this.leaderboardData = [
      ...leaderboardEntries,
      ...finishedUsers,
      ...staffProfiles,
    ];
  }

  /**
   * Get cutoff time for time filter
   * @param {string} timeFilter - Time filter value
   * @returns {number} - Cutoff timestamp
   */
  getCutoffTime(timeFilter) {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const week = 7 * day;
    const month = 30 * day;
    const year = 365 * day;

    switch (timeFilter) {
      case "week":
        return now - week;
      case "month":
        return now - month;
      case "year":
        return now - year;
      default:
        return 0;
    }
  }

  /**
   * Get total questions for a category
   * @param {string} category - Category name
   * @returns {number} - Total questions count
   */
  getTotalQuestionsForCategory(category) {
    if (category === "all") {
      // Count UNIQUE question IDs across all categories (как в профиле)
      const uniqueIds = new Set();
      Object.entries(this.questionCategories).forEach(([catName, ids]) => {
        if (catName === "interviews") return; // пропускаем агрегат
        if (Array.isArray(ids)) {
          ids.forEach((id) => uniqueIds.add(id));
        }
      });
      return uniqueIds.size;
    }

    // Handle combined interviews category
    if (category === "interviews") {
      const interviewCategories = [
        "interviews_python",
        "interviews_dl",
        "interviews_nlp",
        "interviews_cv",
        "interviews_classic_ml",
        "interviews_math",
        "interviews_hr",
        "interviews_vision",
        "interviews_recsys",
        "interviews_mlops",
      ];

      return interviewCategories.reduce((total, cat) => {
        return total + (this.totalQuestionsByCategory[cat] || 0);
      }, 0);
    }

    return this.totalQuestionsByCategory[category] || 0;
  }

  /**
   * Build allowed ID set for a given category
   * @param {string} category
   * @returns {Set<string>|null}
   */
  getAllowedIdsForCategory(category) {
    try {
      if (category === "all") {
        const set = new Set();
        Object.entries(this.questionCategories).forEach(([catName, ids]) => {
          if (catName === "interviews") return;
          if (Array.isArray(ids)) ids.forEach((id) => set.add(id));
        });
        return set;
      }
      if (category === "interviews") {
        const set = new Set();
        const interviewCategories = [
          "interviews_python",
          "interviews_dl",
          "interviews_nlp",
          "interviews_cv",
          "interviews_classic_ml",
          "interviews_math",
          "interviews_hr",
          "interviews_vision",
          "interviews_recsys",
          "interviews_mlops",
        ];
        interviewCategories.forEach((cat) => {
          const ids = this.questionCategories[cat] || [];
          ids.forEach((id) => set.add(id));
        });
        return set;
      }
      const ids = this.questionCategories[category] || [];
      return new Set(Array.isArray(ids) ? ids : []);
    } catch (e) {
      return null;
    }
  }

  /**
   * Get last activity timestamp
   * @param {Object} progress - User progress data
   * @returns {number} - Last activity timestamp
   */
  getLastActivity(progress) {
    let lastActivity = 0;

    Object.values(progress).forEach((questionData) => {
      if (questionData.timestamp && questionData.timestamp > lastActivity) {
        lastActivity = questionData.timestamp;
      }
    });

    return lastActivity;
  }

  /**
   * Get user information
   * @param {string} userId - User ID
   * @param {Object} userData - User data from Firebase
   * @returns {Object} - User info object
   */
  getUserInfo(userId, userData) {
    // Try to get user info from Firebase Auth or user data
    let displayName = "Участник";
    let email = "";
    let selectedAchievement = null;
    let subgroup = null;

    const firstName = String(userData.firstName || "").trim();
    const lastName = String(userData.lastName || userData.surname || "").trim();
    const telegram = String(userData.telegram || "").trim();
    const profileName = [firstName, lastName].filter(Boolean).join(" ");

    if (profileName) {
      displayName = telegram ? `${profileName} (${telegram})` : profileName;
    } else if (userData.displayName) {
      displayName = userData.displayName;
    } else if (userData.email) {
      email = userData.email;
      displayName = email.split("@")[0];
    }

    // Get selected achievement
    selectedAchievement = this.normalizeSelectedAchievement(
      userData.selectedAchievementId || userData.selectedAchievement,
    );

    // Materials-only customers are not part of a mentorship subgroup.
    if (userData.subgroup && userData.learningFormat !== "materials") {
      subgroup = userData.subgroup;
    }

    // If no display name is set, show a placeholder
    if (!displayName || displayName === "Участник") {
      displayName = t("Участник {id}", { id: userId.substring(0, 6) });
    }

    return {
      displayName: displayName,
      email: email,
      avatar: this.generateAvatar(displayName),
      avatarUrl: userData.avatarUrl
        ? userData.avatarUrl.indexOf("?t=") === -1
          ? userData.avatarUrl + "?t=" + Date.now()
          : userData.avatarUrl
        : null,
      selectedAchievement: selectedAchievement,
      subgroup: subgroup,
      role: userData.role || null,
      assignedStaffUid:
        userData.assignedStaffUid ||
        userData.assignedMentorUid ||
        userData.assignedCuratorUid ||
        null,
      learningFormat:
        userData.learningFormat === "materials" ? "materials" : "mentorship",
      accessPlanKeys: this.resolveAccessPlanKeys(userData),
      accessPlanGrantedAt: this.resolveAccessPlanDates(userData),
    };
  }

  /**
   * Даты выдачи тарифов. Приходят только персоналу — в публичном профиле их
   * нет, поэтому у остальных зрителей подсказка покажет прочерк.
   * @param {Object} userData
   * @returns {Object} - Ключ тарифа → timestamp
   */
  resolveAccessPlanDates(userData) {
    const grants = userData?.accessPlanGrants;
    if (grants && typeof grants === "object" && Object.keys(grants).length) {
      return Object.fromEntries(
        Object.entries(grants)
          .map(([key, grant]) => [key, Number(grant?.grantedAt) || null])
          .filter(([, grantedAt]) => grantedAt),
      );
    }
    // Учётки до накопительных грантов: ключ такого тарифа resolveAccessPlanKeys
    // уже отдаёт, поэтому и дату берём оттуда же — иначе у ряда всегда прочерк.
    const [legacyKey] = this.resolveAccessPlanKeys(userData);
    const legacyDate = Number(userData?.accessPlan?.grantedAt) || null;
    return legacyKey && legacyDate ? { [legacyKey]: legacyDate } : {};
  }

  /**
   * Ключи выданных тарифов ученика. Персоналу их отдаёт callable лидерборда
   * (`accessPlanGrants` из staff_directory), остальным — публичный профиль,
   * поэтому оба источника нормализуются в один отсортированный список.
   * @param {Object} userData
   * @returns {Array<string>}
   */
  resolveAccessPlanKeys(userData) {
    if (Array.isArray(userData?.accessPlanKeys)) {
      return [...userData.accessPlanKeys].sort();
    }
    const grants = userData?.accessPlanGrants;
    if (grants && typeof grants === "object") {
      const keys = Object.keys(grants).sort();
      if (keys.length) return keys;
    }
    // Учётки до накопительных грантов: записан только последний тариф.
    const plan = userData?.accessPlan;
    if (!plan?.id) return [];
    return [plan.trackId ? `${plan.id}__${plan.trackId}` : String(plan.id)];
  }

  /**
   * Названия тарифов лежат в публичном categories-config.json — по ключу вида
   * `professional__cv` из него собирается человекочитаемая метка.
   */
  async loadAccessPlansConfig() {
    try {
      const config =
        await window.categoriesConfigLoader?.loadCategoriesConfig?.();
      this.accessPlansConfig = config?.accessPlans || {};
    } catch (_error) {
      this.accessPlansConfig = {};
    }
  }

  /**
   * Сколько разделов открывает тариф — мера «широты» доступа. Ею сравниваются
   * накопленные тарифы: и в бейдже, и в порядке рядов подсказки.
   * @param {string} id - Идентификатор тарифа
   * @returns {number}
   */
  accessPlanCoverage(id) {
    const plan = (this.accessPlansConfig || {})[id];
    if (!plan) return 0;
    return plan.allCategories
      ? Number.MAX_SAFE_INTEGER
      : (plan.categories || []).length;
  }

  /**
   * Тарифы накопительные, поэтому «главный» из выданных — самый широкий: его
   * показывает бейдж строки, им же помечается ряд подсказки.
   * @param {Array<string>} keys - Ключи тарифов
   * @returns {string} - Идентификатор тарифа или пустая строка
   */
  widestAccessPlanId(keys) {
    const ids = (keys || [])
      .map((key) => String(key).split("__")[0])
      .filter(Boolean);
    if (!ids.length) return "";
    return ids.reduce((best, id) =>
      this.accessPlanCoverage(id) > this.accessPlanCoverage(best) ? id : best,
    );
  }

  /**
   * Метка уровня доступа: тарифы накопительные, поэтому показываем самый
   * широкий из выданных, а докупленные специализации внутри него — в скобках.
   * «Профессиональный трек (Computer Vision · NLP)».
   * @param {Array<string>} keys - Ключи тарифов
   * @returns {string} - Метка или пустая строка
   */
  formatAccessPlanLabel(keys) {
    const plans = this.accessPlansConfig || {};
    const grants = (keys || [])
      .map((key) => {
        const [id, trackId = ""] = String(key).split("__");
        return { id, trackId };
      })
      .filter((grant) => grant.id);
    if (!grants.length) return "";

    const widest = this.widestAccessPlanId(keys);

    // Тариф, которого нет в конфиге (переименованный или устаревший ключ),
    // молча пропускаем: сырой идентификатор рядом с именем ученика увидели бы
    // все, а он ничего не объясняет.
    const plan = plans[widest];
    if (!plan?.displayName) return "";

    const tracks = grants
      .filter((grant) => grant.id === widest && grant.trackId)
      .map(
        (grant) =>
          plan.tracks?.[grant.trackId]?.displayName ||
          grant.trackId.toUpperCase(),
      );
    return tracks.length
      ? `${plan.displayName} (${tracks.join(" · ")})`
      : plan.displayName;
  }

  /**
   * Staff accounts are operational users and should not compete with students.
   * @param {Object} userData
   * @returns {boolean}
   */
  isStaffLeaderboardUser(userData) {
    const role = String(userData?.role || "")
      .trim()
      .toLowerCase();
    return ["mentor", "curator", "admin", "admin-helper"].includes(role);
  }

  /**
   * Сотрудник, повышенный из учеников той же учёткой: в публичный лидерборд он
   * не попадает, но в кабинете персонала остаётся со всей своей историей —
   * статусом, подгруппами и датами переходов.
   * @param {Object} userData
   * @returns {boolean}
   */
  retainsStudentProfile(userData) {
    return (
      userData?.retainStudentProfile === true &&
      this.isStaffLeaderboardUser(userData)
    );
  }

  /**
   * Учётки, которых в списке быть не должно: сотрудники без сохранённой
   * ученической истории.
   * @param {Object} userData
   * @returns {boolean}
   */
  isHiddenStaffUser(userData) {
    return (
      this.isStaffLeaderboardUser(userData) &&
      !this.retainsStudentProfile(userData)
    );
  }

  /**
   * Escape dynamic badge text inserted into a rendered HTML row.
   * @param {unknown} value - Dynamic Firebase value
   * @returns {string} - Escaped HTML text
   */
  escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => {
      const entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };
      return entities[character];
    });
  }

  /**
   * Resolve the first and last name shown in staff-only assignment badges.
   * @param {Object} staff - Staff record from Firebase
   * @returns {string} - Staff full name or a safe fallback
   */
  getStaffBadgeName(staff) {
    const firstName = (staff.firstName || "").trim();
    const lastName = (staff.lastName || staff.surname || "").trim();
    const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

    if (fullName) return fullName;

    const source = staff.displayName || staff.email?.split("@")[0] || "";
    return (
      source
        .replace(/\(.*?\)/g, "")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .join(" ") || t("Без имени")
    );
  }

  /**
   * Generate avatar initials
   * @param {string} name - User name
   * @returns {string} - Avatar initials
   */
  generateAvatar(name) {
    // First 2 letters of the first word (e.g. "Иван Иванов (@tg)" → "ИВ")
    const firstWord = name.split(/[\s(@]/)[0].replace(/[^A-Za-zА-Яа-яЁё]/g, "");
    return (firstWord + "??").substring(0, 2).toUpperCase();
  }

  /**
   * Update the UI with current leaderboard data
   */
  updateUI() {
    this.updateFormatTabs();
    this.updateStats();
    this.updateSortArrows();
    this.updateLeaderboardList();
    this.updateLastUpdateTime();
    this.updateAdminNotice();
  }

  /**
   * Update sort arrows in header
   */
  updateSortArrows() {
    document
      .querySelectorAll(".sortable-header .sort-arrow")
      .forEach((span) => {
        const key = span.getAttribute("data-sort-key");
        const isActive = this.sortKey === key;
        span.textContent = !isActive
          ? "↕"
          : this.sortDir === "asc"
            ? "↑"
            : "↓";
        span.className = "sort-arrow" + (isActive ? " sort-arrow-active" : "");
      });
  }

  /**
   * Update statistics
   */
  updateStats() {
    const visibleEntries = this.getVisibleLeaderboardEntries();
    const totalUsers = visibleEntries.length;
    const totalQuestions = visibleEntries.reduce(
      (sum, entry) => sum + entry.completedQuestions,
      0,
    );
    const totalHours = visibleEntries.reduce(
      (sum, entry) => sum + (entry.studyHours || 0),
      0,
    );

    // Restore stat card HTML if skeleton was shown (skeleton replaces innerHTML)
    const statsContainer = document.getElementById("leaderboardStats");
    if (statsContainer && statsContainer.dataset.skActive) {
      const original = statsContainer.dataset.skOriginal;
      if (original) statsContainer.innerHTML = original;
      if (window.SkeletonLoader) SkeletonLoader.hide("#leaderboardStats");
    }

    const totalUsersEl = document.getElementById("totalUsers");
    const totalQuestionsEl = document.getElementById("totalQuestions");
    const totalHoursEl = document.getElementById("totalHours");
    if (!totalUsersEl || !totalQuestionsEl || !totalHoursEl) return;

    totalUsersEl.textContent = "0";
    totalQuestionsEl.textContent = "0";
    totalHoursEl.textContent = "0";

    setTimeout(() => animateNumber(totalUsersEl, 0, totalUsers, 2000), 0);
    setTimeout(
      () => animateNumber(totalQuestionsEl, 0, totalQuestions, 2000),
      200,
    );
    setTimeout(
      () =>
        animateNumber(
          totalHoursEl,
          0,
          Math.round(totalHours * 10) / 10,
          2000,
          (v) => v.toFixed(1),
        ),
      400,
    );
  }

  /**
   * Days between a timestamp/ISO-string and now (or between two timestamps).
   * Returns null if the input is falsy.
   */
  normalizeTimestamp(ts) {
    if (!ts) return null;
    if (typeof ts === "number") return Number.isFinite(ts) ? ts : null;
    if (typeof ts === "string") {
      const parsed = new Date(ts).getTime();
      return Number.isFinite(parsed) ? parsed : null;
    }
    if (typeof ts === "object") {
      if (typeof ts.seconds === "number") return ts.seconds * 1000;
      if (typeof ts._seconds === "number") return ts._seconds * 1000;
      if (typeof ts.toMillis === "function") return ts.toMillis();
      if (typeof ts.valueOf === "function") {
        const value = Number(ts.valueOf());
        if (Number.isFinite(value)) return value;
      }
    }
    return null;
  }

  /**
   * Format a timestamp as a short Russian date: "15 апр 2026"
   */
  formatShortDate(ts) {
    const normalized = this.normalizeTimestamp(ts);
    if (!normalized) return null;
    const d = new Date(normalized);
    if (isNaN(d)) return null;
    // По-английски — "Apr 15, 2026"; русский вид оставляем прежним.
    if (window.i18n?.lang === "en") {
      return d.toLocaleDateString(window.i18n.locale, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    }
    const months = [
      "янв",
      "фев",
      "мар",
      "апр",
      "май",
      "июн",
      "июл",
      "авг",
      "сен",
      "окт",
      "ноя",
      "дек",
    ];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }

  /**
   * Build the preview-card HTML for a leaderboard entry.
   */
  buildPreviewCard(entry) {
    const html = [];

    // Header: student name
    html.push(
      `<div class="lb-preview-header">${entry.userInfo.displayName}</div>`,
    );

    // Подгруппы — понятие менторства. Покупателю материалов их не назначают,
    // поэтому четыре пустых прочерка ему ничего не сообщали: он видит историю
    // выданных тарифов.
    html.push(
      ...(entry.userInfo.learningFormat === "materials"
        ? this.buildAccessPlanPreviewRows(entry)
        : this.buildSubgroupPreviewRows(entry)),
    );

    return html.join("");
  }

  /**
   * История подгрупп ученика на менторстве: все четыре этапа с датами
   * назначения, текущий помечен стрелкой.
   * @param {Object} entry - Строка лидерборда
   * @returns {Array<string>} - HTML рядов превью
   */
  buildSubgroupPreviewRows(entry) {
    const rows = [
      `<div class="lb-preview-section">${t("История подгрупп")}</div>`,
    ];

    const currentSg = entry.userInfo.subgroup;
    const history = entry.subgroupHistory || {};
    const stages = [
      { key: "start", label: "1. Start" },
      { key: "main", label: "2. Main" },
      { key: "market", label: "3. Market" },
      { key: "employed", label: "4. Employed" },
    ];

    for (const stage of stages) {
      let assignedAt = history[stage.key] && history[stage.key].assignedAt;
      const isCurrent = stage.key === currentSg;
      if (!assignedAt && stage.key === "start" && isCurrent) {
        assignedAt = entry.registrationDate || null;
      }
      const dateStr = this.formatShortDate(assignedAt);

      rows.push(`
        <div class="lb-preview-row${isCurrent ? " lb-current-sg" : ""}">
          <span class="lb-preview-icon">${isCurrent ? "▶" : "·"}</span>
          <span class="lb-preview-label">${stage.label}</span>
          <span class="lb-preview-value${dateStr ? "" : " lb-dash"}">${dateStr || "—"}</span>
        </div>`);
    }

    return rows;
  }

  /**
   * Выданные тарифы покупателя материалов: по ряду на тариф, от узкого к
   * широкому. Стрелкой помечен тот, что стоит бейджем в строке. Дата выдачи
   * известна только персоналу (она лежит в `accessPlanGrants`), поэтому у
   * остальных зрителей вместо неё прочерк.
   * @param {Object} entry - Строка лидерборда
   * @returns {Array<string>} - HTML рядов превью
   */
  buildAccessPlanPreviewRows(entry) {
    const rows = [
      `<div class="lb-preview-section">${t("Уровень доступа")}</div>`,
    ];
    const plans = this.accessPlanPreviewRows(entry.userInfo);

    if (!plans.length) {
      // Пустой список значит одно из двух: тарифа нет вовсе — или он есть, но
      // не нашёлся в конфиге (переименованный ключ, незагруженный
      // categories-config.json, непроставленный публичный профиль). Второе —
      // незнание, и выдавать его за «не назначен» нельзя: бейдж в такой
      // ситуации намеренно молчит.
      const hasUnknownPlan = (entry.userInfo?.accessPlanKeys || []).length > 0;
      rows.push(`
        <div class="lb-preview-row">
          <span class="lb-preview-icon">·</span>
          <span class="lb-preview-label">${hasUnknownPlan ? t("Тариф не распознан") : t("Тариф не назначен")}</span>
          <span class="lb-preview-value lb-dash">—</span>
        </div>`);
    }

    for (const plan of plans) {
      const dateStr = this.formatShortDate(plan.grantedAt);
      rows.push(`
        <div class="lb-preview-row lb-preview-row-plan${plan.isCurrent ? " lb-current-sg" : ""}">
          <span class="lb-preview-icon">${plan.isCurrent ? "▶" : "·"}</span>
          <span class="lb-preview-label">${this.escapeHtml(plan.label)}</span>
          <span class="lb-preview-value${dateStr ? "" : " lb-dash"}">${dateStr || "—"}</span>
        </div>`);
    }

    // Ученик мог учиться на менторстве и перейти на материалы:
    // setStaffLearningFormat снимает подгруппу, но историю переходов
    // сохраняет. Кнопки подгрупп и редактор дат для такой строки скрыты,
    // поэтому подсказка — единственное место, где эта история видна.
    if (this.hasSubgroupHistory(entry.subgroupHistory)) {
      rows.push('<hr class="lb-preview-divider" />');
      rows.push(...this.buildSubgroupPreviewRows(entry));
    }

    const registered = this.formatShortDate(entry.registrationDate);
    rows.push('<hr class="lb-preview-divider" />');
    rows.push(`
        <div class="lb-preview-row">
          <span class="lb-preview-icon">·</span>
          <span class="lb-preview-label">${t("На платформе с")}</span>
          <span class="lb-preview-value${registered ? "" : " lb-dash"}">${registered || "—"}</span>
        </div>`);

    return rows;
  }

  /**
   * Тарифы ученика — по одной записи на тариф: докупленные специализации
   * одного тарифа собираются в тот же ряд, что и в бейдже. Порядок — от
   * узкого доступа к широкому, как этапы подгрупп идут по возрастанию.
   * @param {Object} userInfo - Нормализованные данные участника
   * @returns {Array<{label: string, grantedAt: number|null, isCurrent: boolean}>}
   */
  /**
   * Есть ли у ученика хоть одна проставленная дата перехода по подгруппам.
   * @param {Object} history - users/<uid>/subgroupHistory
   * @returns {boolean}
   */
  hasSubgroupHistory(history) {
    return Object.values(history || {}).some((stage) => stage?.assignedAt);
  }

  accessPlanPreviewRows(userInfo) {
    const keys = userInfo?.accessPlanKeys || [];
    const dates = userInfo?.accessPlanGrantedAt || {};
    const byPlan = new Map();

    for (const key of keys) {
      const id = String(key).split("__")[0];
      if (!id) continue;
      const group = byPlan.get(id) || { id, keys: [], grantedAt: null };
      group.keys.push(key);
      const grantedAt = Number(dates[key]) || null;
      if (grantedAt && grantedAt > (group.grantedAt || 0)) {
        group.grantedAt = grantedAt;
      }
      byPlan.set(id, group);
    }

    // Бейдж в строке показывает самый широкий тариф — им же помечаем ряд,
    // чтобы подсказка читалась вместе со строкой. Сравниваем по
    // идентификатору: два тарифа могут носить одно название.
    const badgeId = this.widestAccessPlanId(keys);
    return [...byPlan.values()]
      .sort(
        (a, b) => this.accessPlanCoverage(a.id) - this.accessPlanCoverage(b.id),
      )
      .map((group) => ({
        label: this.formatAccessPlanLabel(group.keys),
        grantedAt: group.grantedAt,
        isCurrent: group.id === badgeId,
      }))
      .filter((plan) => plan.label);
  }

  /** ru: [один, два, пять], en: [one, many]; без i18n (тесты) — по-русски. */
  plural(n, ru, en) {
    if (window.i18n) return window.i18n.plural(n, { ru, en });
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return ru[0];
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return ru[1];
    return ru[2];
  }

  /**
   * Get subgroup badge HTML
   */
  getSubgroupBadge(subgroup) {
    if (!subgroup) return "";

    const subgroupMap = {
      start: { text: "1. Start", class: "subgroup-start" },
      main: { text: "2. Main", class: "subgroup-main" },
      market: { text: "3. Market", class: "subgroup-market" },
      employed: { text: "4. Employed", class: "subgroup-employed" },
    };

    const subgroupInfo = subgroupMap[subgroup];
    if (!subgroupInfo) return "";

    return `<span class="subgroup-badge ${subgroupInfo.class}" title="${t("Подгруппа: {name}", { name: subgroupInfo.text })}">${subgroupInfo.text}</span>`;
  }

  /**
   * Render only the exceptional commercial format.
   * Mentorship is the default and is already represented by subgroup badges.
   */
  getLearningFormatBadge(learningFormat) {
    if (learningFormat !== "materials") return "";
    return `<span class="learning-format-badge materials" title="${t("Формат обучения: Только материалы")}">${t("Только материалы")}</span>`;
  }

  /**
   * Уровень доступа покупателя материалов — тариф, который ему выдали.
   * Для менторства бейдж не рисуется: там роль играет подгруппа.
   * @param {Object} userInfo - Нормализованные данные участника
   * @returns {string} - HTML бейджа или пустая строка
   */
  getAccessPlanBadge(userInfo) {
    if (userInfo?.learningFormat !== "materials") return "";
    const label = this.formatAccessPlanLabel(userInfo.accessPlanKeys);
    if (!label) return "";
    const safeLabel = this.escapeHtml(label);
    return `<span class="access-plan-badge" title="${t("Уровень доступа: {plan}", { plan: safeLabel })}">${safeLabel}</span>`;
  }

  /**
   * Render the staff-only badge showing who leads a student.
   * @param {Object} userInfo - Normalized leaderboard user data
   * @returns {string} - Badge HTML or an empty string
   */
  getAssignedStaffBadge(userInfo) {
    if (
      !this.canReadPrivateLeaderboard() ||
      !userInfo.assignedStaffUid ||
      userInfo.role === "mentor" ||
      userInfo.role === "curator"
    ) {
      return "";
    }

    const staff = this.usersData[userInfo.assignedStaffUid];
    if (!staff || !this.isStaffLeaderboardUser(staff)) {
      return "";
    }

    const name = this.escapeHtml(this.getStaffBadgeName(staff));
    return `<span class="assigned-staff-badge" title="${t("Ответственный: {name}", { name })}">${name}</span>`;
  }

  /**
   * Finished and departed students are hidden initially, but remain available
   * from the leaderboard without changing filters or reloading data.
   */
  getVisibleLeaderboardEntries() {
    const ranked = this.rankedEntriesForFormat(this.formatFilter);
    return this.showInactiveStudents
      ? ranked
      : ranked.filter((entry) => !entry.isFinished);
  }

  /**
   * Строки рейтинга одной секции. Менторство и «только материалы» — разные
   * продукты с разным объёмом доступа, поэтому в общем зачёте не смешиваются:
   * места, статистика над таблицей и сортировка считаются внутри секции.
   * @param {string} format - "mentorship" | "materials"
   * @returns {Array<Object>}
   */
  rankedEntriesForFormat(format) {
    return this.leaderboardData.filter(
      (entry) =>
        !entry.isStaffProfile && entry.userInfo.learningFormat === format,
    );
  }

  /**
   * Сколько строк показывает секция. «Показать ещё» принадлежит открытой
   * вкладке, поэтому счётчик соседней всегда считает только активных — иначе
   * он прыгал бы от нажатия, которое к этой секции не относится.
   * @param {string} format - "mentorship" | "materials"
   * @returns {number}
   */
  countEntriesForFormat(format) {
    const ranked = this.rankedEntriesForFormat(format);
    const includeInactive =
      this.showInactiveStudents && format === this.formatFilter;
    return includeInactive
      ? ranked.length
      : ranked.filter((entry) => !entry.isFinished).length;
  }

  /**
   * Сотрудники, повышенные из учеников: в рейтинге не участвуют и мест не
   * занимают, но строки нужны персоналу для правки статуса, подгруппы и дат.
   * @returns {Array<Object>}
   */
  getStaffProfileEntries() {
    // Сотрудник ведёт менторство: во вкладке «Только материалы» его строке
    // делать нечего.
    if (this.formatFilter !== "mentorship") return [];
    return this.leaderboardData.filter((entry) => entry.isStaffProfile);
  }

  /**
   * Переключение секции лидерборда. Доступно всем — ментору, кураторам и
   * ученикам: обе таблицы публичны, соревноваться можно в своей и смотреть
   * соседнюю.
   * @param {string} format - "mentorship" | "materials"
   */
  async setFormatFilter(format) {
    if (this.applyFormatFilter(format)) {
      const subgroupSelect = document.getElementById("subgroupFilter");
      if (subgroupSelect) subgroupSelect.value = "all";
      await this.processLeaderboardDataOptimized();
      this.applySort();
    }
    this.updateUI();
  }

  /**
   * Список секций, разрешённых зрителю. Считает сервер, потому что он же
   * решает, чьи данные вообще отдать: рисовать вкладку, за которой пустая
   * выдача, — значит показывать существование чужой когорты.
   *
   * Пустой или невалидный ответ (например, функции ещё не выкачены) не
   * расширяет доступ: остаётся секция, в которой зритель уже находится.
   *
   * @param {string[]|undefined} formats
   */
  applyVisibleFormats(formats) {
    const allowed = Array.isArray(formats)
      ? formats.filter(
          (format) => format === "mentorship" || format === "materials",
        )
      : [];
    this.visibleFormats = allowed.length
      ? [...new Set(allowed)]
      : [this.formatFilter];
    if (!this.visibleFormats.includes(this.formatFilter)) {
      this.formatFilter = this.visibleFormats[0];
    }
  }

  /** Доступна ли зрителю секция. */
  canViewFormat(format) {
    return this.visibleFormats.includes(format);
  }

  /**
   * Стартовая секция — та, в которой соревнуется сам зритель: иначе покупатель
   * доступа к материалам открывает таблицу, где его нет, со статистикой чужой
   * когорты. Работает один раз: после ручного переключения выбор зрителя
   * переживает обновление данных.
   *
   * Зрителю с одной доступной секцией выбирать нечего — она и открывается.
   */
  applyDefaultFormatFilter() {
    if (this.visibleFormats.length === 1) {
      this.formatFilter = this.visibleFormats[0];
      return;
    }
    if (this.formatFilterTouched || !this.currentUser) return;
    const ownData = this.usersData[this.currentUser.uid];
    if (!ownData) return;
    this.formatFilter =
      ownData.learningFormat === "materials" ? "materials" : "mentorship";
  }

  /**
   * Состояние переключателя секций.
   * @param {string} format - "mentorship" | "materials"
   * @returns {boolean} - Нужно ли пересобрать данные (сброшен фильтр подгрупп)
   */
  applyFormatFilter(format) {
    const next = format === "materials" ? "materials" : "mentorship";
    // Вкладки недоступной секции в разметке нет, но обработчик клика — не
    // место для доверия к DOM: переключение мимо прав игнорируется.
    if (!this.canViewFormat(next)) return false;
    this.formatFilterTouched = true;
    if (this.formatFilter === next) return false;
    this.formatFilter = next;
    this.showInactiveStudents = false;

    // Подгруппы существуют только на менторстве: с выбранной подгруппой
    // вкладка материалов оказалась бы пустой всегда.
    if (next === "materials" && this.subgroupFilter !== "all") {
      this.subgroupFilter = "all";
      return true;
    }
    return false;
  }

  /** Подсветить активную вкладку, обновить счётчики и подпись секции. */
  updateFormatTabs() {
    const tabs = document.getElementById("leaderboardTabs");
    if (tabs) {
      tabs.querySelectorAll(".leaderboard-tab").forEach((tab) => {
        const format = tab.dataset.format;
        // Недоступную секцию убираем из разметки целиком: сама вкладка со
        // счётчиком рассказала бы, сколько человек в чужой когорте.
        tab.hidden = !this.canViewFormat(format);
        if (tab.hidden) return;
        const isActive = format === this.formatFilter;
        tab.classList.toggle("active", isActive);
        tab.setAttribute("aria-selected", isActive ? "true" : "false");
        const counter = tab.querySelector(".leaderboard-tab-count");
        if (counter) counter.textContent = this.countEntriesForFormat(format);
      });
      // Переключать нечего — переключателя нет.
      tabs.hidden = this.visibleFormats.length < 2;
    }

    const hint = document.getElementById("leaderboardFormatHint");
    if (hint) {
      hint.textContent =
        this.formatFilter === "materials"
          ? t(
              "Ученики с доступом к материалам платформы. Рядом с именем — выданный уровень доступа; подгруппы для этого формата не назначаются.",
            )
          : t(
              "Ученики на менторстве. Места и статистика считаются внутри секции.",
            );
    }

    // Фильтр подгрупп относится только к менторству.
    const subgroupSelect = document.getElementById("subgroupFilter");
    if (subgroupSelect)
      subgroupSelect.hidden = this.formatFilter === "materials";
  }

  toggleInactiveStudents() {
    this.showInactiveStudents = !this.showInactiveStudents;
    this.updateUI();
  }

  /**
   * Update leaderboard list
   */
  updateLeaderboardList() {
    const leaderboardList = document.getElementById("leaderboardList");
    const visibleEntries = this.getVisibleLeaderboardEntries();
    const staffEntries = this.getStaffProfileEntries();
    const inactiveStudentsCount = this.rankedEntriesForFormat(
      this.formatFilter,
    ).filter((entry) => entry.isFinished).length;

    if (visibleEntries.length === 0 && staffEntries.length === 0) {
      const hasOnlyInactiveStudents = inactiveStudentsCount > 0;
      leaderboardList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🏆</div>
          <div class="empty-state-title">${hasOnlyInactiveStudents ? t("Нет активных учеников") : t("Пока нет данных")}</div>
          <div class="empty-state-description">
            ${hasOnlyInactiveStudents ? t("Завершившие обучение и покинувшие курс скрыты по умолчанию.") : this.formatFilter === "materials" ? t("В этой секции пока никого нет — здесь появятся ученики с доступом только к материалам.") : t("Начните изучать материалы, чтобы появиться в лидерборде!")}
          </div>
          ${hasOnlyInactiveStudents ? `<button type="button" class="show-inactive-students-btn" data-action="toggle-inactive">${t("Показать ещё")}</button>` : ""}
        </div>
      `;
      leaderboardList
        .querySelector('[data-action="toggle-inactive"]')
        ?.addEventListener("click", () => this.toggleInactiveStudents());
      return;
    }

    const entriesHTML = visibleEntries
      .map((entry, index) => this.renderLeaderboardEntry(entry, index + 1))
      .join("");
    const staffEntriesHTML = staffEntries.length
      ? `
      <div class="staff-profiles-section">
        <div class="staff-profiles-title">${t("Сотрудники с историей ученика")}</div>
        <div class="staff-profiles-hint">${t("Не участвуют в рейтинге. Строки нужны для правки статуса, подгруппы и дат переходов.")}</div>
      </div>${staffEntries.map((entry) => this.renderLeaderboardEntry(entry, null)).join("")}`
      : "";

    leaderboardList.innerHTML = `${entriesHTML}${
      inactiveStudentsCount > 0
        ? `
      <div class="inactive-students-toggle-wrap">
        <button type="button" class="show-inactive-students-btn" data-action="toggle-inactive">
          ${this.showInactiveStudents ? t("Скрыть завершивших и покинувших") : t("Показать ещё")}
          <span class="show-inactive-students-count">${this.showInactiveStudents ? "" : `(${inactiveStudentsCount})`}</span>
        </button>
      </div>`
        : ""
    }${staffEntriesHTML}`;
    leaderboardList
      .querySelector('[data-action="toggle-inactive"]')
      ?.addEventListener("click", () => this.toggleInactiveStudents());
    if (window.achievementCatalog) {
      window.achievementCatalog
        .load()
        .then((catalog) => {
          leaderboardList
            .querySelectorAll(".achievement-status")
            .forEach((node) => {
              const legacyTitle = node.dataset.achievementTitle
                ? decodeURIComponent(node.dataset.achievementTitle)
                : "";
              const achievement =
                catalog.byId.get(node.dataset.achievementId) ||
                catalog.achievements.find((item) => item.title === legacyTitle);
              if (!achievement) {
                node.remove();
                return;
              }
              node.replaceChildren(
                window.achievementCatalog.icon(
                  achievement,
                  "achievement-status-icon",
                  achievement.title,
                ),
              );
              node.title = achievement.title;
            });
        })
        .catch(() => {});
    }
    this.attachPreviewHover(leaderboardList);
  }

  /**
   * Render one leaderboard row.
   * @param {Object} entry - Prepared leaderboard entry
   * @param {number|null} rank - Место в рейтинге; null — строка вне рейтинга
   * @returns {string} - Row HTML
   */
  renderLeaderboardEntry(entry, rank) {
    const rankClass = rank === null ? "" : this.getRankClass(rank);
    const isCurrentUser =
      this.currentUser && entry.userId === this.currentUser.uid;

    const isPaused = entry.status === "pause";
    const statusClass = entry.isFinished
      ? "finished-user"
      : isPaused
        ? "paused-user"
        : "";
    const statusIcon =
      entry.status === "finished"
        ? "🎓"
        : entry.status === "departed"
          ? "👋"
          : entry.status === "pause"
            ? "⏸️"
            : "";
    const statusText =
      entry.status === "finished"
        ? t("Завершил обучение")
        : entry.status === "departed"
          ? t("Покинул курс")
          : entry.status === "pause"
            ? t("На паузе")
            : "";
    const subgroupBadge = this.getSubgroupBadge(entry.userInfo.subgroup);
    const learningFormatBadge = this.getLearningFormatBadge(
      entry.userInfo.learningFormat,
    );
    const accessPlanBadge = this.getAccessPlanBadge(entry.userInfo);
    const assignedStaffBadge = this.getAssignedStaffBadge(entry.userInfo);

    // Store preview HTML for later hover attachment (keyed by userId)
    if (!this._previewCache) this._previewCache = new Map();
    this._previewCache.set(entry.userId, this.buildPreviewCard(entry));

    const studyHours =
      entry.studyHours != null && entry.studyHours > 0
        ? Number(entry.studyHours).toFixed(1)
        : "0";
    return `
        <div class="leaderboard-entry ${isCurrentUser ? "current-user" : ""} ${statusClass} ${entry.isStaffProfile ? "staff-profile-entry" : ""}" data-uid="${entry.userId}">
          <div class="rank ${rankClass}">${rank === null ? "—" : rank}</div>
          <div class="user-info">
            <div class="user-avatar">${entry.userInfo.avatarUrl ? `<img src="${entry.userInfo.avatarUrl}" alt="${entry.userInfo.avatar}" draggable="false">` : entry.userInfo.avatar}</div>
            <div class="user-details">
              <div class="user-name">
                ${statusIcon ? `<span class="status-icon" title="${statusText}">${statusIcon}</span>` : ""}
                ${entry.userInfo.displayName}
                ${entry.userInfo.role === "curator" ? '<span class="role-badge role-badge-helper" title="Curator">Curator</span>' : ""}
                ${learningFormatBadge}
                ${accessPlanBadge}
                ${subgroupBadge}
                ${assignedStaffBadge}
                ${entry.userInfo.selectedAchievement?.id ? `<span class="achievement-status" data-achievement-id="${entry.userInfo.selectedAchievement.id}" title="${t("Выбранное достижение")}"></span>` : entry.userInfo.selectedAchievement?.legacyTitle ? `<span class="achievement-status" data-achievement-title="${encodeURIComponent(entry.userInfo.selectedAchievement.legacyTitle)}" title="${t("Выбранное достижение")}"></span>` : ""}
              </div>
              ${entry.userInfo.email ? `<div class="user-email">${entry.userInfo.email}</div>` : ""}
              ${statusText ? `<div class="user-status">${statusText}</div>` : ""}
              ${
                this.isAdmin()
                  ? `
                <div class="admin-controls">
                  <div class="admin-controls-row">
                    <span class="admin-controls-label">${t("Статус:")}</span>
                    <button class="status-btn active" onclick="leaderboard.updateUserStatus('${entry.userId}', 'active')" title="${t("Активный ученик")}">${t("Активный")}</button>
                    <button class="status-btn pause" onclick="leaderboard.updateUserStatus('${entry.userId}', 'pause')" title="${t("На паузе")}">${t("Пауза")}</button>
                    <button class="status-btn finished" onclick="leaderboard.updateUserStatus('${entry.userId}', 'finished')" title="${t("Завершил обучение")}">${t("Завершил")}</button>
                    <button class="status-btn departed" onclick="leaderboard.updateUserStatus('${entry.userId}', 'departed')" title="${t("Покинул курс")}">${t("Покинул")}</button>
                  </div>
                  ${
                    entry.userInfo.learningFormat === "materials"
                      ? `
                  <div class="admin-controls-row admin-subgroup-unavailable">
                    <span class="admin-controls-label">${t("Подгруппа:")}</span>
                    <span>${t("Не назначается для формата «Только материалы»")}</span>
                  </div>`
                      : `
                  <div class="admin-controls-row">
                    <span class="admin-controls-label">${t("Подгруппа:")}</span>
                    <button class="status-btn subgroup-start" onclick="leaderboard.updateUserSubgroup('${entry.userId}', 'start')" title="1. Start">1. Start</button>
                    <button class="status-btn subgroup-main" onclick="leaderboard.updateUserSubgroup('${entry.userId}', 'main')" title="2. Main">2. Main</button>
                    <button class="status-btn subgroup-market" onclick="leaderboard.updateUserSubgroup('${entry.userId}', 'market')" title="3. Market">3. Market</button>
                    <button class="status-btn subgroup-employed" onclick="leaderboard.updateUserSubgroup('${entry.userId}', 'employed')" title="4. Employed">4. Employed</button>
                    <button class="status-btn subgroup-history-edit" onclick="leaderboard.openSubgroupHistoryEditor('${entry.userId}')" title="${t("Редактировать даты переходов")}">${t("Даты")}</button>
                  </div>`
                  }
                </div>
              `
                  : ""
              }
            </div>
          </div>
          <div class="questions-count">${entry.completedQuestions}</div>
          <div class="hours-count">${t("{hours} ч", { hours: studyHours })}</div>
          <div class="achievements-count">${entry.achievementPercent != null ? entry.achievementPercent + "%" : "—"}</div>
          <div class="quizzes-count">${entry.quizzesSolved || 0}</div>
          <div class="quiz-percent">${entry.quizAveragePercent != null ? entry.quizAveragePercent + "%" : "—"}</div>
        </div>
      `;
  }


  /**
   * Attach mouse-enter/leave listeners to each row to show the shared
   * fixed-position preview tooltip.
   */
  attachPreviewHover(container) {
    const tooltip = this.getPreviewTooltip();

    container
      .querySelectorAll(".leaderboard-entry[data-uid]")
      .forEach((row) => {
        const html =
          this._previewCache && this._previewCache.get(row.dataset.uid);
        if (!html) return;

        row.addEventListener("mouseenter", () => {
          tooltip.innerHTML = html;
          tooltip.style.visibility = "hidden";
          tooltip.style.display = "block";

          const rowRect = row.getBoundingClientRect();
          const tipRect = tooltip.getBoundingClientRect();
          const gap = 8;

          // Horizontal: start at rank-column width (≈80px) from row left, clamped to viewport
          let left = rowRect.left + 80;
          if (left + tipRect.width + 12 > window.innerWidth) {
            left = window.innerWidth - tipRect.width - 12;
          }

          // Vertical: prefer above the row
          let top;
          if (rowRect.top - tipRect.height - gap >= 10) {
            top = rowRect.top - tipRect.height - gap;
          } else {
            top = rowRect.bottom + gap;
          }

          tooltip.style.left = left + "px";
          tooltip.style.top = top + "px";
          tooltip.style.visibility = "";
        });

        row.addEventListener("mouseleave", () => {
          tooltip.style.display = "none";
        });
      });
  }

  /** Lazily create / return the single shared preview tooltip element. */
  getPreviewTooltip() {
    let tip = document.getElementById("lbPreviewTooltip");
    if (!tip) {
      tip = document.createElement("div");
      tip.id = "lbPreviewTooltip";
      tip.className = "lb-preview-card";
      tip.style.display = "none";
      tip.style.position = "fixed";
      document.body.appendChild(tip);
    }
    return tip;
  }

  /**
   * Get rank class for styling
   * @param {number} rank - User rank
   * @returns {string} - CSS class name
   */
  getRankClass(rank) {
    if (rank <= 3) return ["gold", "silver", "bronze"][rank - 1];
    return "other";
  }

  /**
   * Update last update time
   */
  updateLastUpdateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString(window.i18n?.locale || "ru-RU");
    document.getElementById("lastUpdate").textContent = t(
      "Последнее обновление: {time}",
      { time: timeString },
    );
  }

  /**
   * Show error message
   * @param {string} message - Error message
   */
  showError(message) {
    const leaderboardList = document.getElementById("leaderboardList");
    leaderboardList.innerHTML = `
      <div class="error-message">${message}</div>
    `;
  }

  /**
   * Show login message when user is not authenticated
   */
  showLoginMessage() {
    const leaderboardList = document.getElementById("leaderboardList");

    if (!this.currentUser) {
      // User not authenticated
      leaderboardList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔐</div>
          <div class="empty-state-title">${t("Требуется вход в систему")}</div>
          <div class="empty-state-description">
            ${t("Для просмотра лидерборда необходимо войти в систему.")}
            <br><br>
            <a href="/main.html" class="login-link">${t("Войти в систему")}</a>
          </div>
        </div>
      `;
    } else {
      // User authenticated but no data loaded yet (shouldn't happen with new logic)
      leaderboardList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔄</div>
          <div class="empty-state-title">${t("Загрузка данных...")}</div>
          <div class="empty-state-description">
            ${t("Пожалуйста, подождите, пока загружаются данные лидерборда.")}
          </div>
        </div>
      `;
    }

    // Hide stats when not authenticated or no data loaded
    document.getElementById("totalUsers").textContent = "0";
    document.getElementById("totalQuestions").textContent = "0";
    const totalHoursEl = document.getElementById("totalHours");
    if (totalHoursEl) totalHoursEl.textContent = "0";
  }

  /**
   * Set time filter
   * @param {string} filter - Time filter value
   */
  async setTimeFilter(filter) {
    this.timeFilter = filter;
    await this.processLeaderboardDataOptimized();
    this.updateUI();
  }

  /**
   * Set category filter
   * @param {string} filter - Category filter value
   */
  async setCategoryFilter(filter) {
    this.categoryFilter = filter;
    await this.processLeaderboardDataOptimized();
    this.updateUI();
  }

  /**
   * Set subgroup filter
   * @param {string} filter - Subgroup filter value
   */
  async setSubgroupFilter(filter) {
    this.subgroupFilter = filter;
    await this.processLeaderboardDataOptimized();
    this.updateUI();
  }

  /**
   * Refresh leaderboard data
   */
  async refresh() {
    if (!this.currentUser) {
      this.showLoginMessage();
      return;
    }

    // Данные лидерборда приходят через кэшируемые callable. Без сброса кэша
    // «Обновить» в пределах TTL перерисовывал бы ту же самую таблицу.
    window.staffApi?.clearCache?.();
    await this.loadLeaderboardData();
  }

  /**
   * Load questions list from generated JSON
   */
  async loadQuestionsList() {
    try {
      const response = await fetch("/assets/js/config/questions-list.json");
      if (!response.ok) {
        throw new Error(`Failed to load questions list: ${response.status}`);
      }

      const questionsData = await response.json();

      this.questionCategories = questionsData.categories;
      this.totalQuestionsByCategory = questionsData.totals;
    } catch (error) {
      console.error("Failed to load questions list:", error);
      // Fallback: initialize empty categories from config
      try {
        if (window.categoriesConfigLoader) {
          const config =
            await window.categoriesConfigLoader.loadCategoriesConfig();
          if (config) {
            const emptyCategories = {};
            const emptyTotals = {};
            Object.keys(config.categories).forEach((key) => {
              emptyCategories[key] = [];
              emptyTotals[key] = 0;
            });
            Object.keys(config.combinedCategories).forEach((key) => {
              emptyCategories[key] = [];
              emptyTotals[key] = 0;
            });
            this.questionCategories = emptyCategories;
            this.totalQuestionsByCategory = emptyTotals;
            return;
          }
        }
      } catch (configError) {
        console.warn(
          "Failed to load categories config for fallback:",
          configError,
        );
      }
      // Ultimate fallback: empty object
      this.questionCategories = {};
      this.totalQuestionsByCategory = {};
    }
  }

  /**
   * Check if current user is admin (mentor or curator)
   */
  isAdmin() {
    if (!this.currentUser) {
      return false;
    }
    const userData = this.usersData[this.currentUser.uid];
    return (
      userData &&
      (userData.role === "mentor" ||
        userData.role === "curator" ||
        userData.role === "admin")
    );
  }

  /**
   * Update admin notice visibility
   */
  updateAdminNotice() {
    const adminNotice = document.getElementById("adminNotice");
    if (adminNotice) {
      adminNotice.style.display = this.isAdmin() ? "block" : "none";
    }


    // Add/remove mentor-user class to body for CSS styling
    if (this.isAdmin()) {
      document.body.classList.add("mentor-user");
    } else {
      document.body.classList.remove("mentor-user");
    }
  }

  /**
   * Update user status in Firebase
   */
  async updateUserStatus(userId, status) {
    try {
      if (!this.currentUser) {
        console.error("User not authenticated");
        return;
      }

      // Check if user is admin
      if (!this.isAdmin()) {
        console.error("User not authorized to update status");
        this.showNotification(
          t("У вас нет прав для изменения статуса учеников"),
          "error",
        );
        return;
      }

      const result = await window.staffApi.setStaffStudentStatus(
        userId,
        status,
      );
      if (this.usersData[userId]) {
        this.usersData[userId].status = result.status;
        this.usersData[userId].subgroup = result.subgroup;
        this.usersData[userId].finishedAt = result.finishedAt;
      }
      this.publicStats[userId] = {
        ...(this.publicStats[userId] || {}),
        status: result.status,
        subgroup: result.subgroup,
        finishedAt: result.finishedAt,
        updatedAt: result.updatedAt,
      };
      await this.processLeaderboardDataOptimized();
      this.applySort();
      this.updateUI();

      // Show success message
      this.showNotification(
        t("Статус ученика обновлен: {status}", {
          status: this.getStatusText(status),
        }),
        "success",
      );
    } catch (error) {
      console.error("Failed to update user status:", error);
      this.showNotification(
        t("Ошибка при обновлении статуса ученика"),
        "error",
      );
    }
  }

  /**
   * Update user subgroup in Firebase
   */
  async updateUserSubgroup(userId, subgroup) {
    try {
      if (!this.currentUser) {
        console.error("User not authenticated");
        return;
      }

      // Check if user is admin
      if (!this.isAdmin()) {
        console.error("User not authorized to update subgroup");
        this.showNotification(
          t("У вас нет прав для изменения подгруппы учеников"),
          "error",
        );
        return;
      }

      if (this.usersData[userId]?.learningFormat === "materials") {
        this.showNotification(
          t("Для формата «Только материалы» подгруппа не назначается"),
          "error",
        );
        return;
      }

      const result = await window.staffApi.setStaffSubgroup(userId, subgroup);
      if (this.usersData[userId]) this.usersData[userId].subgroup = subgroup;
      this.publicStats[userId] = {
        ...(this.publicStats[userId] || {}),
        subgroup,
        updatedAt: result.updatedAt,
      };
      await this.processLeaderboardDataOptimized();
      this.applySort();
      this.updateUI();

      // Show success message
      this.showNotification(
        t("Подгруппа ученика обновлена: {subgroup}", {
          subgroup: this.getSubgroupText(subgroup),
        }),
        "success",
      );
    } catch (error) {
      console.error("Failed to update user subgroup:", error);
      this.showNotification(
        t("Ошибка при обновлении подгруппы ученика"),
        "error",
      );
    }
  }

  initSubgroupHistoryEditor() {
    const modal = document.getElementById("subgroupHistoryModal");
    const form = document.getElementById("subgroupHistoryForm");
    const closeBtn = document.getElementById("subgroupHistoryClose");
    const cancelBtn = document.getElementById("subgroupHistoryCancel");
    if (!modal || !form) return;

    const close = () => this.closeSubgroupHistoryEditor();
    closeBtn?.addEventListener("click", close);
    cancelBtn?.addEventListener("click", close);
    modal.addEventListener("click", (event) => {
      if (event.target === modal) close();
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      this.saveSubgroupHistoryEditor();
    });
  }

  getSubgroupStages() {
    return [
      { key: "start", label: "1. Start", inputId: "subgroupHistoryStart" },
      { key: "main", label: "2. Main", inputId: "subgroupHistoryMain" },
      { key: "market", label: "3. Market", inputId: "subgroupHistoryMarket" },
      {
        key: "employed",
        label: "4. Employed",
        inputId: "subgroupHistoryEmployed",
      },
    ];
  }

  formatDatetimeLocal(ts) {
    if (!ts) return "";
    const date = new Date(Number(ts));
    if (Number.isNaN(date.getTime())) return "";
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  parseDatetimeLocal(value) {
    if (!value) return null;
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  openSubgroupHistoryEditor(userId) {
    if (!this.isAdmin()) {
      this.showNotification(
        t("У вас нет прав для редактирования дат"),
        "error",
      );
      return;
    }

    const entry = this.leaderboardData.find((item) => item.userId === userId);
    if (!entry) {
      this.showNotification(t("Ученик не найден в лидерборде"), "error");
      return;
    }

    this.editingSubgroupHistoryUserId = userId;
    const modal = document.getElementById("subgroupHistoryModal");
    const studentEl = document.getElementById("subgroupHistoryStudent");
    const history = entry.subgroupHistory || {};

    if (studentEl) {
      studentEl.textContent = entry.userInfo.displayName || userId;
    }

    this.getSubgroupStages().forEach((stage) => {
      const input = document.getElementById(stage.inputId);
      if (!input) return;
      input.value = this.formatDatetimeLocal(history[stage.key]?.assignedAt);
    });

    if (modal && typeof modal.showModal === "function") {
      modal.showModal();
    }
  }

  closeSubgroupHistoryEditor() {
    const modal = document.getElementById("subgroupHistoryModal");
    this.editingSubgroupHistoryUserId = null;
    if (modal?.open) modal.close();
  }

  async saveSubgroupHistoryEditor() {
    try {
      const userId = this.editingSubgroupHistoryUserId;
      if (!userId) return;
      if (!this.isAdmin()) {
        this.showNotification(
          t("У вас нет прав для редактирования дат"),
          "error",
        );
        return;
      }

      const historyForMemory = {};
      this.getSubgroupStages().forEach((stage) => {
        const input = document.getElementById(stage.inputId);
        const timestamp = this.parseDatetimeLocal(input?.value || "");
        if (timestamp) historyForMemory[stage.key] = { assignedAt: timestamp };
      });
      await window.staffApi.setStaffSubgroupHistory(userId, historyForMemory);

      const userData = this.usersData[userId] || {};
      userData.subgroupHistory = historyForMemory;
      this.usersData[userId] = userData;
      const row = this.leaderboardData.find((item) => item.userId === userId);
      if (row) row.subgroupHistory = historyForMemory;
      if (this.publicStats[userId]) {
        this.publicStats[userId].subgroupHistory = historyForMemory;
      }

      this.closeSubgroupHistoryEditor();
      await this.processLeaderboardDataOptimized();
      this.applySort();
      this.updateUI();
      this.showNotification(t("Даты переходов обновлены"), "success");
    } catch (error) {
      console.error("Failed to update subgroup history:", error);
      this.showNotification(t("Ошибка при сохранении дат переходов"), "error");
    }
  }

  /**
   * Get status text for display
   */
  getStatusText(status) {
    const statusMap = {
      active: "Активный",
      pause: "На паузе",
      finished: "Завершил обучение",
      departed: "Покинул курс",
    };
    return statusMap[status] ? t(statusMap[status]) : status;
  }

  /**
   * Get subgroup text for display
   */
  getSubgroupText(subgroup) {
    const subgroupMap = {
      start: "1. Start",
      main: "2. Main",
      market: "3. Market",
      employed: "4. Employed",
    };
    return subgroupMap[subgroup] || subgroup;
  }

  /**
   * Show notification
   */
  showNotification(message, type = "info") {
    // Create notification element
    const notification = document.createElement("div");
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    // Add styles
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === "success" ? "#10b981" : type === "error" ? "#ef4444" : "var(--brand)"};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 10000;
      font-size: 14px;
      font-weight: 500;
      animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(notification);

    // Remove after 3 seconds
    setTimeout(() => {
      notification.style.animation = "slideOut 0.3s ease";
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  /**
   * Set default status for user if not set
   */
  async setDefaultUserStatus(userId) {
    try {
      if (!this.db) {
        console.error("Database not initialized");
        return;
      }

      // Set default status to 'active' for users without status
      await window.staffApi.setStaffStudentStatus(userId, "active");
    } catch (error) {
      console.error("Failed to set default user status:", error);
    }
  }

  /**
   * Получить достижения пользователя (оптимизированная версия - без database calls)
   */
  getUserAchievementsOptimized(userId) {
    try {
      // В Firebase в user_achievements/{userId} ключи — это achievement.id (snake_case: classic_ml_beginner, category_specialist)
      const achievementIds = this.allAchievements[userId] || {};
      const allAchievements =
        window.gamificationSystem && window.gamificationSystem.achievements
          ? window.gamificationSystem.achievements
          : null;
      if (!allAchievements) return [];

      const achievementList = [];
      Object.keys(achievementIds).forEach((achievementId) => {
        // В gamification ключи объекта — camelCase (mlBeginner), а в Firebase — id (classic_ml_beginner). Ищем по id.
        const achievement = Object.values(allAchievements).find(
          (a) => a.id === achievementId,
        );
        if (achievement) {
          achievementList.push({
            id: achievement.id,
            title: achievement.title,
            description: achievement.description,
            icon: achievement.icon,
          });
        }
      });
      return achievementList;
    } catch (error) {
      console.error("Error getting user achievements:", error);
      return [];
    }
  }

  /**
   * Получить достижения пользователя (legacy - с database calls)
   */
  async getUserAchievements(userId) {
    try {
      const achievementsRef = this.db.ref(`user_achievements/${userId}`);
      const snapshot = await achievementsRef.once("value");
      const achievementIds = snapshot.val() || {};
      const allAchievements =
        window.gamificationSystem && window.gamificationSystem.achievements
          ? window.gamificationSystem.achievements
          : null;
      if (!allAchievements) return [];

      const achievementList = [];
      Object.keys(achievementIds).forEach((achievementId) => {
        const achievement = Object.values(allAchievements).find(
          (a) => a.id === achievementId,
        );
        if (achievement) {
          achievementList.push({
            id: achievement.id,
            title: achievement.title,
            description: achievement.description,
            icon: achievement.icon,
          });
        }
      });
      return achievementList;
    } catch (error) {
      console.error("Error getting user achievements:", error);
      return [];
    }
  }

  /**
   * Cleanup resources
   */
  destroy() {
    // Stop Firebase listeners
    if (this.db) {
      this.db.ref("users").off();
    }
  }
}

// Export for use in modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = Leaderboard;
}
