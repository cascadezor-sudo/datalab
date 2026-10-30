/**
 * Сутки платформы: YYYY-MM-DD в Europe/Moscow — то же правило, что у сервера
 * (`functions/day-key.js`). Определение продублировано по той же причине, что
 * в activity-grid.js: обычные <script>, общего файла на всех страницах нет.
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
  "use strict";

  // Перевод интерфейса (ядро — сниппет theme-boot). В тестах под Node его нет:
  // остаётся русский текст с подставленными значениями.
  const t =
    window.t ||
    ((text, params) =>
      text.replace(/\{(\w+)\}/g, (match, key) => params?.[key] ?? match));

  const WALLET_CONFIG_URL = "/assets/js/config/wallet-config.json";
  const GOAL_OPTIONS = [5, 10, 20];
  const DEFAULT_GOAL = 10;

  const CARDS = {
    review: {
      countId: "todayReviewCount",
      labelId: "todayReviewLabel",
      cardId: "todayReview",
      emptyText: t("Всё повторено"),
      unit: (n) =>
        plural(
          n,
          [
            "карточка к повторению",
            "карточки к повторению",
            "карточек к повторению",
          ],
          ["card to review", "cards to review"],
        ),
    },
    tasks: {
      countId: "todayTasksCount",
      labelId: "todayTasksLabel",
      cardId: "todayTasks",
      emptyText: t("Нет активных задач"),
      unit: (n) =>
        plural(
          n,
          ["задача на доске", "задачи на доске", "задач на доске"],
          ["task on the board", "tasks on the board"],
        ),
    },
    feedback: {
      countId: "todayFeedbackCount",
      labelId: "todayFeedbackLabel",
      cardId: "todayFeedback",
      emptyText: t("Новых нет"),
      unit: (n) =>
        plural(
          n,
          ["новый фидбек", "новых фидбека", "новых фидбеков"],
          ["new review", "new reviews"],
        ),
    },
  };

  /** ru — [один, два, пять], en — [one, many]. */
  function plural(n, ru, en) {
    if (window.i18n) return window.i18n.plural(n, { ru, en: en || ru });
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return ru[0];
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return ru[1];
    return ru[2];
  }

  // Скопировано из assets/js/kanban-board.js (normalizeBoardStatus, isOverdue) —
  // там они заперты внутри IIFE и не экспортируются. Держать в синхроне с оригиналом.
  function normalizeBoardStatus(value) {
    const status = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_");
    if (status === "done" || status === "completed") return "done";
    if (status === "review" || status === "checking") return "review";
    if (status === "doing" || status === "in_progress") return "doing";
    return "todo";
  }

  function isOverdue(task) {
    if (
      !task.dueAt ||
      normalizeBoardStatus(task.boardStatus || task.status) === "done"
    ) {
      return false;
    }
    const due = new Date(task.dueAt);
    return !Number.isNaN(due.getTime()) && due < new Date();
  }

  /** Те же роли, что в spaced-repetition.js и material-access-guard.js. */
  const STAFF_ROLES = new Set(["mentor", "admin", "curator", "admin-helper"]);

  // Число карточек берём тем же API, что и страница повторения. Статическая
  // сводка могла отставать от набора карточек и показывать ложный ноль.
  async function countDueCards(userData) {
    if (!window.achievementApi?.getTeorminCards) {
      throw new Error("Teormin cards API is unavailable");
    }
    const result = await window.achievementApi.getTeorminCards("progress");
    const cards = Array.isArray(result?.cards) ? result.cards : [];
    const progress = userData.progress || {};
    const reviewState = userData.spaced_repetition || {};
    const now = Date.now();

    return cards.filter((card) => {
      // Страница повторения учитывает только карточки пройденных вопросов.
      if (progress[card.questionId]?.completed !== true) return false;
      const state = reviewState[card.id];
      return !state || !state.nextReviewAt || state.nextReviewAt <= now;
    }).length;
  }

  function countUnreadFeedbacks(userData) {
    return Object.values(userData.feedbacks || {}).filter(
      (feedback) => feedback && feedback.read !== true,
    ).length;
  }

  // Тот же запрос, что и в assets/js/kanban-board.js:1506 — единственный,
  // который правила RTDB разрешают ученику для kanbanTasks.
  async function loadTaskStats(db, uid) {
    const snapshot = await db
      .ref("kanbanTasks")
      .orderByChild("studentId")
      .equalTo(uid)
      .once("value");
    const tasks = Object.values(snapshot.val() || {});
    const active = tasks.filter(
      (task) =>
        normalizeBoardStatus(task.boardStatus || task.status) !== "done",
    );
    return { active: active.length, overdue: active.filter(isOverdue).length };
  }

  function setCount(key, value, extraLabel) {
    const config = CARDS[key];
    const card = document.getElementById(config.cardId);
    const countEl = document.getElementById(config.countId);
    const labelEl = document.getElementById(config.labelId);
    if (!card || !countEl || !labelEl) return;

    card.classList.remove("is-loading");
    if (value > 0) {
      card.classList.add("is-active");
      card.classList.remove("is-empty");
      countEl.textContent = String(value);
      labelEl.textContent = extraLabel || config.unit(value);
    } else {
      card.classList.add("is-empty");
      card.classList.remove("is-active");
      countEl.textContent = "";
      labelEl.textContent = config.emptyText;
    }
  }

  function setNeutral(key) {
    const config = CARDS[key];
    const card = document.getElementById(config.cardId);
    const countEl = document.getElementById(config.countId);
    const labelEl = document.getElementById(config.labelId);
    if (!card || !countEl || !labelEl) return;
    // Данные не доехали: плитка остаётся обычной кликабельной ссылкой без числа.
    card.classList.remove("is-loading", "is-active", "is-empty");
    countEl.textContent = "";
    labelEl.textContent = "";
  }

  // ── Серия и дневная цель ────────────────────────────────────────────────
  // Всё считается из уже прочитанного users/<uid>: streakState пишет сервер,
  // progress и spaced_repetition несут отметки времени. Новых чтений RTDB нет.

  function dayWord(n) {
    return plural(n, ["день", "дня", "дней"], ["day", "days"]);
  }

  /** Ближайшая веха строго больше текущей серии; null — все пройдены. */
  function nextMilestone(current, milestones) {
    const target = Object.keys(milestones || {})
      .map(Number)
      .filter((value) => value > current)
      .sort((a, b) => a - b)[0];
    return target ? { target, left: target - current } : null;
  }

  // Остаток месячных заморозок — тот же расчёт, что в daily-reports.js:
  // по текущему месяцу, а не по записанному в проекции. Купленный запас
  // (streak_perks) сюда не входит: он лежит вне users/<uid>, а новых чтений
  // ради подсказки не делаем — без него формулировка просто строже.
  function freezesLeft(streakState, today) {
    const perMonth = Number(streakState?.freezesPerMonth) || 0;
    const month = String(today).slice(0, 7);
    const used = Object.values(streakState?.frozenDays || {}).filter(
      (day) => String(day).slice(0, 7) === month,
    ).length;
    return Math.max(0, perMonth - used);
  }

  /**
   * Тексты серии. `pending` — серия есть, но сегодня ещё не продлена: сервер
   * считает день серии по вопросам, повторённым карточкам и отчётам, и его
   * `lastActivityDay` здесь единственный критерий. Пока есть заморозка,
   * пропуск серию не рвёт — формулировка мягкая (`soft`).
   *
   * Грады за веху не обещаем: сервер платит `s:<N>` один раз навсегда, а
   * рекорда серии в users/<uid> нет — после обрыва «+50 градов» у вехи 7
   * было бы обещанием, которое не сбудется.
   */
  function describeStreak(streakState, today, milestones, withReports) {
    const current = Number(streakState?.current) || 0;
    if (current <= 0) {
      return {
        value: "",
        hint: withReports
          ? t("Серия начнётся с первого вопроса, карточки или отчёта сегодня")
          : t("Серия начнётся с первого вопроса или карточки сегодня"),
        pending: "",
        soft: false,
      };
    }
    const next = nextMilestone(current, milestones);
    const waiting = streakState.lastActivityDay !== today;
    const soft = waiting && freezesLeft(streakState, today) > 0;
    let pending = "";
    if (waiting) {
      pending = soft
        ? t("сегодня ещё не продлена · заморозка подстрахует")
        : t("сегодня ещё не продлена");
    }
    return {
      value: `🔥 ${current} ${dayWord(current)}`,
      hint: next
        ? t("до вехи {target} {left}", {
            target: next.target,
            left: plural(
              next.left,
              [
                `остался ${next.left} день`,
                `осталось ${next.left} дня`,
                `осталось ${next.left} дней`,
              ],
              [`${next.left} day left`, `${next.left} days left`],
            ),
          })
        : "",
      pending,
      soft,
    };
  }

  /** Единицы за сегодня: решённые вопросы + повторённые карточки. */
  function countDoneToday(userData, now = Date.now()) {
    const today = window.platformDayKey(now);
    // Сутки не длиннее 27 часов даже с переводом часов: всё, что старше,
    // отсекается сравнением чисел, и Intl вызывается только для свежих записей.
    const since = now - 27 * 3600e3;
    const isToday = (timestamp) =>
      Number(timestamp) > since &&
      window.platformDayKey(Number(timestamp)) === today;
    const questions = Object.values(userData.progress || {}).filter(
      (item) => item && item.completed === true && isToday(item.timestamp),
    ).length;
    // ponytail: карточка хранит только lastReviewedAt, поэтому повторённая
    // дважды за день считается один раз. Нужен точный счёт — серверный счётчик.
    const cards = Object.values(userData.spaced_repetition || {}).filter(
      (state) => state && isToday(state.lastReviewedAt),
    ).length;
    return questions + cards;
  }

  function goalPercent(done, goal) {
    if (!(goal > 0)) return 0;
    return Math.max(0, Math.min(100, Math.round((done / goal) * 100)));
  }

  // Цель — удобство зрителя, серверу она не нужна: localStorage на uid.
  function readGoal(uid) {
    try {
      const stored = Number(localStorage.getItem(`main-daily-goal:${uid}`));
      return GOAL_OPTIONS.includes(stored) ? stored : DEFAULT_GOAL;
    } catch {
      return DEFAULT_GOAL;
    }
  }

  function writeGoal(uid, goal) {
    try {
      localStorage.setItem(`main-daily-goal:${uid}`, String(goal));
    } catch {
      // Приватное окно: цель проживёт до перезагрузки.
    }
  }

  function renderGoal(done, goal) {
    const arc = document.getElementById("todayGoalArc");
    const count = document.getElementById("todayGoalCount");
    const label = document.getElementById("todayGoalLabel");
    const options = document.getElementById("todayGoalOptions");
    if (!arc || !count || !label || !options) return;
    // У окружности pathLength="100", поэтому штрих задаётся прямо в процентах.
    // Нулевую дугу прячет CSS: круглый торец штриха иначе рисует точку.
    arc.setAttribute("stroke-dasharray", `${goalPercent(done, goal)} 100`);
    count.textContent = String(done);
    label.textContent =
      done >= goal
        ? t("Цель на сегодня выполнена: {done} из {goal}", { done, goal })
        : t("{done} из {goal} за сегодня", { done, goal });
    for (const button of options.querySelectorAll("button[data-goal]")) {
      button.setAttribute(
        "aria-pressed",
        String(Number(button.dataset.goal) === goal),
      );
    }
  }

  function renderStreak(userData, today, milestones) {
    const value = document.getElementById("todayStreakValue");
    const hint = document.getElementById("todayStreakHint");
    const pending = document.getElementById("todayStreakPending");
    if (!value || !hint || !pending) return;
    const streak = describeStreak(
      userData.streakState,
      today,
      milestones,
      userData.learningFormat !== "materials",
    );
    value.textContent = streak.value;
    hint.textContent = streak.hint;
    pending.textContent = streak.pending;
    pending.hidden = !streak.pending;
    pending.classList.toggle("is-soft", streak.soft);
  }

  async function renderPulse(uid, userData) {
    const pulse = document.getElementById("todayPulse");
    const role = String(userData?.role || "")
      .trim()
      .toLowerCase();
    // Без userData числа неизвестны — блок остаётся скрытым, а не нулевым.
    if (!pulse || !userData || STAFF_ROLES.has(role)) return;

    const today = window.platformDayKey();
    const done = countDoneToday(userData);
    renderGoal(done, readGoal(uid));
    const options = document.getElementById("todayGoalOptions");
    if (options) {
      options.onclick = (event) => {
        const goal = Number(event.target?.dataset?.goal);
        if (!GOAL_OPTIONS.includes(goal)) return;
        writeGoal(uid, goal);
        renderGoal(done, goal);
      };
    }

    // Полоса видна сразу: кольцу и самой серии конфиг не нужен. Подсказка про
    // веху дописывается, когда доедет публичный конфиг кошелька; упал или
    // завис — серия остаётся без вехи.
    renderStreak(userData, today, {});
    pulse.hidden = false;
    const milestones = await fetch(WALLET_CONFIG_URL)
      .then((response) => (response.ok ? response.json() : {}))
      .then((config) => config.streakMilestones || {})
      .catch(() => ({}));
    renderStreak(userData, today, milestones);
  }

  async function render(options) {
    const { uid, userData, db } = options || {};
    const section = document.getElementById("mainToday");
    if (!section) return;
    section.hidden = false;

    renderPulse(uid, userData).catch((error) => {
      console.error("main-today: streak and goal failed", error);
    });

    // userData отсутствует, если чтение users/<uid> упало. Пустой объект здесь
    // недопустим: он дал бы «Всё повторено» и «Новых нет» при неизвестных данных.
    if (userData) {
      countDueCards(userData)
        .then((due) => setCount("review", due))
        .catch((error) => {
          console.error("main-today: review counter failed", error);
          setNeutral("review");
        });

      try {
        setCount("feedback", countUnreadFeedbacks(userData));
      } catch (error) {
        console.error("main-today: feedback counter failed", error);
        setNeutral("feedback");
      }
    } else {
      setNeutral("review");
      setNeutral("feedback");
    }

    if (db && uid) {
      loadTaskStats(db, uid)
        .then(({ active, overdue }) => {
          const label =
            overdue > 0
              ? `${CARDS.tasks.unit(active)}, ${overdue} ${plural(overdue, ["просрочена", "просрочены", "просрочено"], ["overdue", "overdue"])}`
              : undefined;
          setCount("tasks", active, label);
        })
        .catch((error) => {
          console.error("main-today: tasks counter failed", error);
          setNeutral("tasks");
        });
    } else {
      setNeutral("tasks");
    }
  }

  function hide() {
    const section = document.getElementById("mainToday");
    if (section) section.hidden = true;
  }

  window.mainToday = {
    render,
    hide,
    _private: {
      countDueCards,
      countUnreadFeedbacks,
      normalizeBoardStatus,
      isOverdue,
      plural,
      nextMilestone,
      describeStreak,
      countDoneToday,
      goalPercent,
    },
  };
})();
