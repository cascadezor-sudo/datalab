/**
 * Offline Achievement & Task Management API
 * Provides full offline persistence for:
 * 1. Question progress, ratings, and quizzes
 * 2. Automatic achievement checking & unlocking
 * 3. Kanban board tasks & Roadmap milestone scheduling
 * 4. Staff & student directory
 */
(function () {
  "use strict";

  function getDb() {
    return window.firebase ? window.firebase.database() : null;
  }

  const OFFLINE_STUDENT = {
    uid: "offline_user",
    displayName: "Студент (Офлайн)",
    email: "offline@datalab.local",
    role: "student",
    status: "active",
    assignedStaffUid: "offline_user",
    assignedMentorUid: "offline_user",
    assignedCuratorUid: "offline_user"
  };

  let cachedTeorminCards = null;
  async function loadAllTeorminCards() {
    if (cachedTeorminCards && cachedTeorminCards.length) {
      return cachedTeorminCards;
    }
    const paths = [
      "/assets/data/teormin-cards.json",
      "assets/data/teormin-cards.json",
      "/assets/js/config/teormin-cards.json",
      "assets/js/config/teormin-cards.json"
    ];
    for (const p of paths) {
      try {
        const res = await fetch(p);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.cards) && data.cards.length > 0) {
            cachedTeorminCards = data.cards;
            return cachedTeorminCards;
          }
        }
      } catch (e) {}
    }
    console.warn("AchievementApi: failed to load teormin-cards.json from any path");
    return [];
  }

  /**
   * Evaluates user progress against catalog achievements and unlocks eligible ones.
   */
  async function evaluateAchievements() {
    const db = getDb();
    if (!db) return { success: true };

    try {
      const [userSnap, unlockedSnap] = await Promise.all([
        db.ref("users/offline_user").once("value"),
        db.ref("user_achievements/offline_user").once("value")
      ]);

      const user = userSnap.val() || {};
      const progress = user.progress || {};
      const reports = user.reports || {};
      const quizResults = user.quizResults || {};
      const currentUnlocked = unlockedSnap.val() || {};

      // 1. Gather stats
      let completedQuestions = 0;
      const distinctTopicSet = new Set();
      for (const [qId, val] of Object.entries(progress)) {
        if (val === true || (val && val.completed !== false)) {
          completedQuestions++;
          const prefix = qId.split("_")[0];
          if (prefix) distinctTopicSet.add(prefix);
        }
      }

      const reportCount = Object.keys(reports).length;
      const quizCount = Object.keys(quizResults).length;
      let perfectQuizCount = 0;
      for (const attempt of Object.values(quizResults)) {
        if (attempt && (attempt.score === 100 || attempt.percent === 100)) {
          perfectQuizCount++;
        }
      }

      // Spaced repetition metrics
      let repReviewedCards = 0;
      let repMatureCards = 0;
      let repMaxIntervalDays = 0;
      let repEasyCards = 0;
      const repReviewDays = new Set();
      const repCategories = new Set();
      const nowMs = Date.now();

      for (const [cardId, state] of Object.entries(user.spaced_repetition || {})) {
        if (!state || !state.lastReviewedAt) continue;
        repReviewedCards++;
        if ((state.repetitions || 0) >= 3 && (state.intervalDays || 0) >= 7 && (state.nextReviewAt || 0) > nowMs) {
          repMatureCards++;
        }
        if ((state.intervalDays || 0) > repMaxIntervalDays) {
          repMaxIntervalDays = state.intervalDays;
        }
        if (state.lastGrade === "easy") {
          repEasyCards++;
        }
        repReviewDays.add(new Date(state.lastReviewedAt).toDateString());
        const qId = cardId.split("__")[0];
        if (qId) repCategories.add(qId);
      }

      // 2. Load catalog
      let catalog = [];
      try {
        const catRes = await fetch("/assets/data/achievements/catalog.json");
        if (catRes.ok) {
          const catJson = await catRes.json();
          catalog = catJson.achievements || [];
        }
      } catch (e) {
        // Fallback core rules if fetch fails
        catalog = [
          { id: "onboarding_complete", title: "Знакомство", category: "special", tier: "bronze", rule: { type: "onboarding" } },
          { id: "first_question", title: "Первый шаг", category: "volume", tier: "bronze", rule: { type: "questions", min: 1 } },
          { id: "ten_questions", title: "Разогрев", category: "volume", tier: "bronze", rule: { type: "questions", min: 10 } },
          { id: "fifty_questions", title: "В ритме", category: "volume", tier: "silver", rule: { type: "questions", min: 50 } },
          { id: "first_report", title: "Дорогой дневник..", category: "volume", tier: "bronze", rule: { type: "reports", min: 1 } },
          { id: "first_quiz", title: "Проба пера", category: "quiz", tier: "bronze", rule: { type: "quizzes", min: 1 } },
          { id: "three_day_streak", title: "Три дня подряд", category: "consistency", tier: "silver", rule: { type: "streak", min: 3 } }
        ];
      }

      const updates = {};
      const newlyUnlocked = [];
      const now = Date.now();

      catalog.forEach((ach) => {
        if (currentUnlocked[ach.id]) return;
        const rule = ach.rule || {};
        let shouldUnlock = false;

        if (rule.type === "questions") {
          shouldUnlock = completedQuestions >= (rule.min || 1);
        } else if (rule.type === "reports") {
          shouldUnlock = reportCount >= (rule.min || 1);
        } else if (rule.type === "quizzes") {
          shouldUnlock = quizCount >= (rule.min || 1);
        } else if (rule.type === "perfect_quiz_topics" || rule.type === "perfect_quizzes") {
          shouldUnlock = perfectQuizCount >= (rule.min || 1);
        } else if (rule.type === "distinct_topics") {
          shouldUnlock = distinctTopicSet.size >= (rule.min || 1);
        } else if (rule.type === "repetition_moment") {
          const m = rule.metric;
          const minVal = rule.min || 1;
          if (m === "reviewedCards") shouldUnlock = repReviewedCards >= minVal;
          else if (m === "matureCards") shouldUnlock = repMatureCards >= minVal;
          else if (m === "maxIntervalDays") shouldUnlock = repMaxIntervalDays >= minVal;
          else if (m === "reviewDays") shouldUnlock = repReviewDays.size >= minVal;
          else if (m === "reviewedCategories") shouldUnlock = repCategories.size >= minVal;
          else if (m === "easyCards") shouldUnlock = repEasyCards >= minVal;
        } else if (ach.id === "onboarding_complete" || rule.type === "onboarding") {
          shouldUnlock = true;
        } else if (rule.type === "streak" && (completedQuestions > 0 || reportCount > 0)) {
          shouldUnlock = true;
        }

        if (shouldUnlock) {
          updates[`user_achievements/offline_user/${ach.id}`] = {
            unlockedAt: now,
            title: ach.title,
            description: ach.description || "",
            category: ach.category || "special",
            tier: ach.tier || "bronze"
          };
          // Pushes notification event
          updates[`achievement_events/offline_user/evt_${now}_${ach.id}`] = {
            achievementId: ach.id,
            createdAt: now
          };
          newlyUnlocked.push(ach);
        }
      });

      if (Object.keys(updates).length > 0) {
        await db.ref().update(updates);
        if (window.globalAchievementNotifications) {
          newlyUnlocked.forEach((ach) => {
            window.globalAchievementNotifications.enqueue({
              id: ach.id,
              eventId: `evt_${now}_${ach.id}`
            });
          });
        }
        window.dispatchEvent(new CustomEvent("datalab_achievements_updated", { detail: { newlyUnlocked } }));
      }

      const totalUnlockedCount = Object.keys(currentUnlocked).length + newlyUnlocked.length;
      return {
        success: true,
        newlyUnlocked,
        unlockedLabels: []
      };
    } catch (err) {
      console.warn("Achievement evaluation error:", err);
      return { success: true };
    }
  }

  const api = {
    call: async function (name, data) {
      if (typeof api[name] === "function") {
        return await api[name](data);
      }
      return { success: true };
    },

    getStaffDirectory: async function () {
      return [OFFLINE_STUDENT];
    },

    getStaffDirectoryMap: async function () {
      return { [OFFLINE_STUDENT.uid]: OFFLINE_STUDENT };
    },

    completeOnboarding: async function () {
      const db = getDb();
      if (db) {
        await db.ref("users/offline_user").update({ introShown: true, introShownAt: Date.now() });
      }
      try { localStorage.setItem("introShown", "true"); } catch (e) {}
      await evaluateAchievements();
      return { success: true };
    },

    setQuestionProgress: async function (questionId, completed = true) {
      const db = getDb();
      if (db) {
        if (completed) {
          await db.ref(`users/offline_user/progress/${questionId}`).set({
            completed: true,
            timestamp: Date.now(),
            userId: "offline_user"
          });
        } else {
          await db.ref(`users/offline_user/progress/${questionId}`).remove();
        }
      }

      try {
        const anon = JSON.parse(localStorage.getItem("anonymous_progress") || "{}");
        if (completed) {
          anon[questionId] = { completed: true, timestamp: Date.now() };
        } else {
          delete anon[questionId];
        }
        localStorage.setItem("anonymous_progress", JSON.stringify(anon));
      } catch (e) {}

      return await evaluateAchievements();
    },

    setQuestionProgressBatch: async function (params) {
      const updates = params && params.updates ? params.updates : (params || {});
      const db = getDb();
      const anon = JSON.parse(localStorage.getItem("anonymous_progress") || "{}");

      if (db) {
        const dbUpdates = {};
        for (const [qId, val] of Object.entries(updates)) {
          if (val === true || (val && val.completed !== false)) {
            dbUpdates[`users/offline_user/progress/${qId}`] = {
              completed: true,
              timestamp: Date.now(),
              userId: "offline_user"
            };
            anon[qId] = { completed: true, timestamp: Date.now() };
          } else {
            dbUpdates[`users/offline_user/progress/${qId}`] = null;
            delete anon[qId];
          }
        }
        await db.ref().update(dbUpdates);
      }

      try {
        localStorage.setItem("anonymous_progress", JSON.stringify(anon));
      } catch (e) {}

      return await evaluateAchievements();
    },

    setQuestionDifficulty: async function (questionId, rating) {
      const db = getDb();
      if (db) {
        if (rating === null || rating === undefined) {
          await db.ref(`users/offline_user/difficultyRatings/${questionId}`).remove();
        } else {
          await db.ref(`users/offline_user/difficultyRatings/${questionId}`).set(rating);
        }
      }
      return { success: true };
    },

    getQuestionDifficulty: async function (questionIds) {
      const db = getDb();
      let ratings = {};
      if (db) {
        const snap = await db.ref("users/offline_user/difficultyRatings").once("value");
        ratings = snap.val() || {};
      }
      const items = {};
      (questionIds || []).forEach((id) => {
        const r = ratings[id];
        items[id] = {
          userRating: r !== undefined ? r : null,
          averageRating: r !== undefined ? r : 3,
          totalRatings: r !== undefined ? 1 : 0
        };
      });
      return { items };
    },

    submitQuizAttempt: async function (attempt) {
      const db = getDb();
      if (db) {
        await db.ref("users/offline_user/quizResults").push(attempt);
      }
      await evaluateAchievements();
      return { success: true, score: attempt ? attempt.score : 100 };
    },

    reconcileAchievements: async function () {
      return await evaluateAchievements();
    },

    selectAchievement: async function (achievementId) {
      const db = getDb();
      if (db) {
        await db.ref("users/offline_user/selectedAchievement").set(achievementId);
      }
      return { success: true };
    },

    submitDailyReport: async function (report) {
      const db = getDb();
      if (db) {
        await db.ref("users/offline_user/reports").push({
          report,
          timestamp: Date.now()
        });
      }
      await evaluateAchievements();
      return { success: true };
    },

    deleteDailyReport: async function (params) {
      if (params && params.reportId && getDb()) {
        await getDb().ref(`users/offline_user/reports/${params.reportId}`).remove();
      }
      return { success: true };
    },

    getTeorminCards: async function (params) {
      const cards = await loadAllTeorminCards();
      const qId = (params && typeof params === "object") ? params.questionId : null;
      const targetPage = (params && typeof params === "object") ? params.targetPage : null;
      const scope = (typeof params === "string") ? params : (params && params.scope ? params.scope : "progress");

      if (qId) {
        const filtered = cards.filter(c => c.questionId === qId && (!targetPage || c.targetPage === targetPage));
        return {
          cards: filtered,
          accessibleCount: filtered.length,
          totalCount: filtered.length,
          scope: "single"
        };
      }

      return {
        cards: cards,
        accessibleCount: cards.length,
        totalCount: cards.length,
        scope: scope || "all"
      };
    },

    syncRepetitionProgress: async function () {
      const result = await evaluateAchievements();
      return {
        success: true,
      };
    },

    getSearchCatalog: async function () {
      return { catalog: [] };
    },

    searchPageContent: async function () {
      return { results: [] };
    },


    updateOwnTelegramNotificationSettings: async function () {
      return { success: true };
    },

    // --- KANBAN BOARD APIS ---
    listKanbanTasks: async function (params) {
      const db = getDb();
      let items = [];
      if (db) {
        const snap = await db.ref("kanbanTasks").once("value");
        const val = snap.val() || {};
        if (Array.isArray(val)) {
          items = val.filter(Boolean);
        } else if (typeof val === "object") {
          for (const [k, v] of Object.entries(val)) {
            if (v) {
              const t = Object.assign({}, v);
              if (!t.id) t.id = k;
              items.push(t);
            }
          }
        }
      }

      if (params && params.studentId) {
        items = items.filter((t) => !t.studentId || t.studentId === params.studentId);
      }
      if (params && params.type && params.type !== "all") {
        items = items.filter((t) => t.type === params.type);
      }
      if (params && params.query) {
        const q = params.query.toLowerCase();
        items = items.filter((t) => (t.title || "").toLowerCase().includes(q) || (t.description || "").toLowerCase().includes(q));
      }

      return {
        items: items,
        total: items.length,
        nextOffset: null,
        summary: {
          total: items.length,
          own: items.length,
          overdue: 0,
          columns: {
            todo: items.filter((t) => t.boardStatus === "todo").length,
            doing: items.filter((t) => t.boardStatus === "doing").length,
            review: items.filter((t) => t.boardStatus === "review").length,
            done: items.filter((t) => t.boardStatus === "done").length
          },
          doneSprints: [],
          visibleTotal: items.length
        }
      };
    },

    saveKanbanTask: async function (arg1, arg2) {
      let taskId = "";
      let patch = {};

      if (typeof arg1 === "string") {
        taskId = arg1;
        patch = arg2 || {};
      } else if (arg1 && typeof arg1 === "object") {
        taskId = arg1.taskId || "";
        patch = arg1.patch || arg1.payload || arg1;
      }

      const db = getDb();
      if (!taskId) {
        taskId = "task_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
      }

      const taskData = Object.assign(
        {
          id: taskId,
          studentId: "offline_user",
          status: "open",
          boardStatus: "todo",
          createdAt: Date.now(),
          createdBy: "offline_user"
        },
        patch
      );

      if (db) {
        await db.ref(`kanbanTasks/${taskId}`).update(taskData);
      }

      return { success: true, taskId, task: taskData };
    },

    deleteKanbanTask: async function (arg1) {
      const taskId = typeof arg1 === "string" ? arg1 : (arg1 && arg1.taskId ? arg1.taskId : "");
      if (taskId && getDb()) {
        await getDb().ref(`kanbanTasks/${taskId}`).remove();
      }
      return { success: true };
    }
  };

  window.achievementApi = Object.assign(window.achievementApi || {}, api);

  // Set up staffApi mock for roadmap interactions
  window.staffApi = Object.assign(window.staffApi || {}, {
    getStaffDirectory: api.getStaffDirectory,
    getStaffDirectoryMap: api.getStaffDirectoryMap,
    getStaffStudentDetail: async function (studentId) {
      return {
        access: { categories: {}, labels: {} },
        student: OFFLINE_STUDENT
      };
    },
    scheduleRoadmapMilestone: async function (params) {
      const studentId = params?.studentId || "offline_user";
      const milestoneId = params?.milestoneId;
      const task = params?.task || {};
      const pages = params?.pages || [];

      const taskId = "roadmap_" + (milestoneId || "task") + "_" + Date.now();
      const newTask = Object.assign({}, task, {
        id: taskId,
        studentId: studentId,
        roadmapMilestoneId: milestoneId,
        status: "open",
        boardStatus: "todo",
        createdAt: Date.now(),
        createdBy: "offline_user"
      });

      const db = getDb();
      if (db) {
        await db.ref(`kanbanTasks/${taskId}`).set(newTask);
        if (milestoneId) {
          await db.ref(`studentRoadmaps/${studentId}/milestones/${milestoneId}`).set({
            status: "assigned",
            assignedAt: Date.now()
          });
        }
      }

      return {
        success: true,
        taskId: taskId,
        grantedLabels: pages,
        grantedCategories: []
      };
    },
    listKanbanTasks: api.listKanbanTasks,
    saveKanbanTask: api.saveKanbanTask,
    deleteKanbanTask: api.deleteKanbanTask
  });
})();
