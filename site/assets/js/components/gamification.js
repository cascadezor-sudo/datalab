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
 * Gamification System
 * Система геймификации с достижениями, бейджами и мотивацией
 */

class GamificationSystem {
  constructor() {
    this.db = null;
    this.user = null;
    this.questionCategories = {};
    this.totalQuestionsByCategory = {};
    this.achievements = {
      firstReport: {
        id: "first_report",
        title: "Дорогой дневник..",
        description: "Отправил первый отчёт",
        icon: "📒",
        category: "volume",
        condition: (stats) => stats.totalReports >= 1,
      },
      threeDayStreak: {
        id: "three_day_streak",
        title: "Три дня подряд",
        description: "3 дня подряд с активностью",
        icon: "⭐",
        category: "consistency",
        condition: (stats) => stats.streak >= 3,
      },
      weekStreak: {
        id: "week_streak",
        title: "Семь к ряду",
        description: "7 дней подряд с активностью",
        icon: "🔥",
        category: "consistency",
        condition: (stats) => stats.streak >= 7,
      },
      twoWeekStreak: {
        id: "two_week_streak",
        title: "Две недели подряд",
        description: "14 дней подряд с активностью",
        icon: "🚀",
        category: "consistency",
        condition: (stats) => stats.streak >= 14,
      },
      monthStreak: {
        id: "month_streak",
        title: "Летописец",
        description: "30 дней подряд с активностью",
        icon: "💎",
        category: "consistency",
        condition: (stats) => stats.streak >= 30,
      },
      sixtyDayStreak: {
        id: "sixty_day_streak",
        title: "Два месяца подряд",
        description: "60 дней подряд с активностью",
        icon: "🖋️",
        category: "consistency",
        condition: (stats) => stats.streak >= 60,
      },
      tenReports: {
        id: "ten_reports",
        title: "Дюжина",
        description: "Отправил 12 отчётов",
        icon: "📧",
        category: "volume",
        condition: (stats) => stats.totalReports >= 12,
      },
      perfectWeek: {
        id: "perfect_week",
        title: "Продуктивная неделя",
        description: "7 отчётов за неделю",
        icon: "⭐📧",
        category: "volume",
        condition: (stats) => stats.weeklyReports >= 7,
      },
      earlyBird: {
        id: "early_bird",
        title: "Ранняя пташка",
        description: "Отправил отчёт до 9:00",
        icon: "🐦",
        category: "consistency",
        condition: (stats) => stats.earlyReports >= 1,
      },

      bulletMaster: {
        id: "bullet_master",
        title: "Буллет-мастер",
        description: "Использовал списки в 5 отчётах подряд",
        icon: "•",
        category: "special",
        condition: (stats) => stats.reportsWithBulletsStreak >= 5,
      },

      // Гайды и онбординг
      onboardingComplete: {
        id: "onboarding_complete",
        title: "Первое знакомство",
        description: "Прошёл онбординг-тур при первом входе",
        icon: "👋",
        category: "special",
        condition: (stats) => stats.onboardingCompleted === true,
      },

      // Стрики и регулярность
      comeback: {
        id: "comeback",
        title: "Камбек",
        description: "Вернулся к работе после пропуска и держал 7 дней подряд",
        icon: "🔁",
        category: "special",
        condition: (stats) => stats.missedThenStreak7,
      },
      weekendWarrior: {
        id: "weekend_warrior",
        title: "Работа кипит",
        description: "Сделал отчёты и в субботу, и в воскресенье",
        icon: "🛡️",
        category: "special",
        condition: (stats) =>
          stats.weekendReports >= 2 && stats.hasBothWeekendDays,
      },

      // Время и дисциплина
      nightOwl: {
        id: "night_owl",
        title: "Сова",
        description: "Отчёт после 22:00",
        icon: "🦉",
        category: "consistency",
        condition: (stats) => stats.nightReports >= 1,
      },
      lunchTime: {
        id: "lunch_time",
        title: "Ланч-тайм",
        description: "Отправил отчёт с 12:00 до 14:00",
        icon: "🥪",
        category: "consistency",
        condition: (stats) => stats.lunchReports >= 1,
      },
      onTimePro: {
        id: "on_time_pro",
        title: "Пунктуальный",
        description: "90% отчетов отправлено до личного дедлайна 7 дней подряд",
        icon: "⏱️",
        category: "consistency",
        condition: (stats) => stats.onTimeRate7d >= 0.9 && stats.streak >= 7,
      },
      lastMinuteHero: {
        id: "last_minute_hero",
        title: "В уходящий поезд",
        description: "Отправил отчёт в последние 10 минут дедлайна",
        icon: "🚄",
        category: "special",
        condition: (stats) => stats.lastMinuteReports >= 1,
      },

      // Забавные/пасхальные
      haiku: {
        id: "haiku",
        title: "Хайку-мастер",
        description: "Написал отчёт из трёх строк по 5/7/5 слов",
        icon: "🗻",
        category: "special",
        condition: (stats) => stats.haikuReports >= 1,
      },
      oneLiner: {
        id: "one_liner",
        title: "Лаконичность",
        description: "Уместил отчёт в одну ёмкую строку",
        icon: "✏️",
        category: "special",
        condition: (stats) => stats.oneLineReports >= 1,
      },
      coffeePowered: {
        id: "coffee_powered",
        title: "Заряд кофеина",
        description: "Три отчёта за день (и всё ещё бодр)",
        icon: "☕",
        category: "volume",
        condition: (stats) => stats.maxReportsInDay >= 3,
      },

      // Календарные и редкие
      firstOfMonth: {
        id: "first_of_month",
        title: "Первый в месяце",
        description: "Сделал отчёт 1-го числа",
        icon: "🥳",
        category: "special",
        condition: (stats) => stats.reportedOnFirstDay,
      },
      lastMinuteOfMonth: {
        id: "last_minute_of_month",
        title: "Закрыл месяц",
        description: "Отправил отчёт в последний день месяца",
        icon: "📅",
        category: "special",
        condition: (stats) => stats.reportedOnLastDay,
      },
      newYearKickoff: {
        id: "new_year_kickoff",
        title: "С чистого листа",
        description: "Отчёт 1 января",
        icon: "🎄",
        category: "special",
        condition: (stats) => stats.reportedOnJan1,
      },

      // Метрики качества привычки
      consistencyBronze: {
        id: "consistency_bronze",
        title: "Консистентность — бронза",
        description: "В месяце ≥ 7 дней с отчётами",
        icon: "🥉",
        category: "consistency",
        condition: (stats) => stats.daysActiveThisMonth >= 7,
      },
      consistencySilver: {
        id: "consistency_silver",
        title: "Консистентность — серебро",
        description: "В месяце ≥ 15 дней с отчётами",
        icon: "🥈",
        category: "consistency",
        condition: (stats) => stats.daysActiveThisMonth >= 15,
      },
      consistencyGold: {
        id: "consistency_gold",
        title: "Консистентность — золото",
        description: "В месяце ≥ 23 дней с отчётами",
        icon: "🥇",
        category: "consistency",
        condition: (stats) => stats.daysActiveThisMonth >= 23,
      },

      // Достижения на основе прогресса по вопросам
      firstQuestion: {
        id: "first_question",
        title: "Первый вопрос",
        description: "Решил первый вопрос",
        icon: "❓",
        category: "progress",
        condition: (stats) => stats.totalQuestionsCompleted >= 1,
      },
      tenQuestions: {
        id: "ten_questions",
        title: "Десятка вопросов",
        description: "Решил 10 вопросов",
        icon: "🔟",
        category: "progress",
        condition: (stats) => stats.totalQuestionsCompleted >= 10,
      },
      fiftyQuestions: {
        id: "fifty_questions",
        title: "Полсотни вопросов",
        description: "Решил 50 вопросов",
        icon: "🎯",
        category: "progress",
        condition: (stats) => stats.totalQuestionsCompleted >= 50,
      },
      hundredQuestions: {
        id: "hundred_questions",
        title: "Сотня вопросов",
        description: "Решил 100 вопросов",
        icon: "💯",
        category: "progress",
        condition: (stats) => stats.totalQuestionsCompleted >= 100,
      },
      twoHundredQuestions: {
        id: "two_hundred_questions",
        title: "Две сотни",
        description: "Решил 200 вопросов",
        icon: "🔥",
        category: "progress",
        condition: (stats) => stats.totalQuestionsCompleted >= 200,
      },
      threeHundredQuestions: {
        id: "three_hundred_questions",
        title: "Three hundred bucks",
        description: "Решил 300 вопросов",
        icon: "⚡",
        category: "progress",
        condition: (stats) => stats.totalQuestionsCompleted >= 300,
      },

      // Достижения по категориям Python
      pythonBeginner: {
        id: "python_beginner",
        title: "Python: новичок",
        description: "Решил более 10% вопросов по Python",
        icon: "🐍",
        category: "progress",
        condition: (stats) => stats.pythonProgress >= 0.1,
      },
      pythonAdvanced: {
        id: "python_advanced",
        title: "Python: продвинутый",
        description: "Решил более 70% вопросов по Python",
        icon: "🐍🔥",
        category: "progress",
        condition: (stats) => stats.pythonProgress >= 0.7,
      },
      pythonMaster: {
        id: "python_master",
        title: "Python: гуру",
        description: "Решил 100% вопросов по Python",
        icon: "🐍🏅",
        category: "progress",
        condition: (stats) => stats.pythonProgress >= 1.0,
      },

      // Достижения по математике
      mathBeginner: {
        id: "math_beginner",
        title: "Математик: новичок",
        description: "Решил более 10% вопросов по математике",
        icon: "📐",
        category: "progress",
        condition: (stats) => stats.mathProgress >= 0.1,
      },
      mathAdvanced: {
        id: "math_advanced",
        title: "Математик: продвинутый",
        description: "Решил более 70% вопросов по математике",
        icon: "📐🔥",
        category: "progress",
        condition: (stats) => stats.mathProgress >= 0.7,
      },
      mathMaster: {
        id: "math_master",
        title: "Математик: гуру",
        description: "Решил 100% вопросов по математике",
        icon: "📐🏅",
        category: "progress",
        condition: (stats) => stats.mathProgress >= 1.0,
      },

      // Достижения по машинному обучению
      mlBeginner: {
        id: "classic_ml_beginner",
        title: "Classic ML: новичок",
        description: "Решил более 10% вопросов по ML",
        icon: "📄",
        category: "progress",
        condition: (stats) => stats.ml_classicProgress >= 0.1,
      },
      mlAdvanced: {
        id: "classic_ml_advanced",
        title: "Classic ML: продвинутый",
        description: "Решил более 70% вопросов по ML",
        icon: "📄🔥",
        category: "progress",
        condition: (stats) => stats.ml_classicProgress >= 0.7,
      },
      mlMaster: {
        id: "classic_ml_master",
        title: "Classic ML: гуру",
        description: "Решил 100% вопросов по ML",
        icon: "📄🏅",
        category: "progress",
        condition: (stats) => stats.ml_classicProgress >= 1.0,
      },

      // Достижения по Deep Learning
      dlBeginner: {
        id: "dl_beginner",
        title: "DL: новичок",
        description: "Решил более 10% вопросов по Deep Learning",
        icon: "🤖",
        category: "progress",
        condition: (stats) => stats.ml_dlProgress >= 0.1,
      },
      dlAdvanced: {
        id: "dl_advanced",
        title: "DL: продвинутый",
        description: "Решил более 70% вопросов по Deep Learning",
        icon: "🤖🔥",
        category: "progress",
        condition: (stats) => stats.ml_dlProgress >= 0.7,
      },
      dlMaster: {
        id: "dl_master",
        title: "DL: гуру",
        description: "Решил 100% вопросов по Deep Learning",
        icon: "🤖🏅",
        category: "progress",
        condition: (stats) => stats.ml_dlProgress >= 1.0,
      },

      // Достижения по NLP
      nlpBeginner: {
        id: "nlp_beginner",
        title: "NLP: новичок",
        description: "Решил более 10% вопросов по NLP",
        icon: "💬",
        category: "progress",
        condition: (stats) => stats.ml_nlpProgress >= 0.1,
      },
      nlpAdvanced: {
        id: "nlp_advanced",
        title: "NLP: продвинутый",
        description: "Решил более 70% вопросов по NLP",
        icon: "💬🔥",
        category: "progress",
        condition: (stats) => stats.ml_nlpProgress >= 0.7,
      },
      nlpMaster: {
        id: "nlp_master",
        title: "NLP: гуру",
        description: "Решил 100% вопросов по NLP",
        icon: "💬🏅",
        category: "progress",
        condition: (stats) => stats.ml_nlpProgress >= 1.0,
      },

      // Достижения по Computer Vision
      cvBeginner: {
        id: "cv_beginner",
        title: "CV: новичок",
        description: "Решил более 10% вопросов по Computer Vision",
        icon: "👁️",
        category: "progress",
        condition: (stats) => stats.ml_cvProgress >= 0.1,
      },
      cvAdvanced: {
        id: "cv_advanced",
        title: "CV: продвинутый",
        description: "Решил более 70% вопросов по Computer Vision",
        icon: "👁️🔥",
        category: "progress",
        condition: (stats) => stats.ml_cvProgress >= 0.7,
      },
      cvMaster: {
        id: "cv_master",
        title: "CV: гуру",
        description: "Решил 100% вопросов по Computer Vision",
        icon: "👁️🏅",
        category: "progress",
        condition: (stats) => stats.ml_cvProgress >= 1.0,
      },

      // Достижения по GitHub
      gitBeginner: {
        id: "git_beginner",
        title: "Git: новичок",
        description: "Решил более 10% вопросов по Git/GitHub",
        icon: "📚",
        category: "progress",
        condition: (stats) => stats.githubProgress >= 0.1,
      },
      gitAdvanced: {
        id: "git_advanced",
        title: "Git: продвинутый",
        description: "Решил более 70% вопросов по Git/GitHub",
        icon: "📚🔥",
        category: "progress",
        condition: (stats) => stats.githubProgress >= 0.7,
      },
      gitMaster: {
        id: "git_master",
        title: "Git: гуру",
        description: "Решил 100% вопросов по Git/GitHub",
        icon: "📚🏅",
        category: "progress",
        condition: (stats) => stats.githubProgress >= 1.0,
      },

      // Достижения по Linux
      linuxBeginner: {
        id: "linux_beginner",
        title: "Linux: новичок",
        description: "Решил более 10% вопросов по Linux",
        icon: "🐧",
        category: "progress",
        condition: (stats) => stats.linuxProgress >= 0.1,
      },
      linuxAdvanced: {
        id: "linux_advanced",
        title: "Linux: продвинутый",
        description: "Решил более 70% вопросов по Linux",
        icon: "🐧🔥",
        category: "progress",
        condition: (stats) => stats.linuxProgress >= 0.7,
      },
      linuxMaster: {
        id: "linux_master",
        title: "Linux: гуру",
        description: "Решил 100% вопросов по Linux",
        icon: "🐧🏅",
        category: "progress",
        condition: (stats) => stats.linuxProgress >= 1.0,
      },

      // Достижения по Docker
      dockerBeginner: {
        id: "docker_beginner",
        title: "Docker: новичок",
        description: "Решил более 10% вопросов по Docker",
        icon: "🐳",
        category: "progress",
        condition: (stats) => stats.dockerProgress >= 0.1,
      },
      dockerAdvanced: {
        id: "docker_advanced",
        title: "Docker: продвинутый",
        description: "Решил более 70% вопросов по Docker",
        icon: "🐳🔥",
        category: "progress",
        condition: (stats) => stats.dockerProgress >= 0.7,
      },
      dockerMaster: {
        id: "docker_master",
        title: "Docker: гуру",
        description: "Решил 100% вопросов по Docker",
        icon: "🐳🏅",
        category: "progress",
        condition: (stats) => stats.dockerProgress >= 1.0,
      },

      // Достижения по собеседованиям
      interviewBeginner: {
        id: "interview_beginner",
        title: "Собеседования: новичок",
        description: "Решил более 10% вопросов с собеседований",
        icon: "💼",
        category: "progress",
        condition: (stats) => stats.interviewsProgress >= 0.1,
      },
      interviewAdvanced: {
        id: "interview_advanced",
        title: "Собеседования: продвинутый",
        description: "Решил более 70% вопросов с собеседований",
        icon: "💼🔥",
        category: "progress",
        condition: (stats) => stats.interviewsProgress >= 0.7,
      },

      // Общие достижения по прогрессу
      jackOfAllTrades: {
        id: "jack_of_all_trades",
        title: "Мастер на все руки",
        description: "Решил вопросы из 5 разных категорий",
        icon: "🎭",
        category: "progress",
        condition: (stats) => stats.categoriesWithProgress >= 5,
      },
      specialist: {
        id: "specialist",
        title: "Едем дальше",
        description: "Решил 100% вопросов в одной категории",
        icon: "🎯",
        category: "progress",
        condition: (stats) => stats.hasCategoryAt100Percent,
      },
      polymath: {
        id: "polymath",
        title: "Полимат",
        description: "Решил 100% вопросов в 3 категориях",
        icon: "🧠",
        category: "progress",
        condition: (stats) => stats.categoriesAt100Percent >= 3,
      },
      completionist: {
        id: "completionist",
        title: "Грандмастер",
        description: "Всё порешал",
        icon: "🃏",
        category: "progress",
        condition: (stats) => stats.overallProgress >= 1.0,
      },

      // Достижения со скидками
      discountMaster: {
        id: "discount_master",
        title: "Решала",
        description:
          "Преодолел 85% материала и прошел все тесты на 100%: -1.5% к постоплате",
        icon: "🔕",
        category: "discount",
        condition: (stats) =>
          stats.overallProgress >= 0.85 && stats.hasAllQuizzesPerfect,
      },
      discountSpecialist: {
        id: "discount_offer",
        title: "Самая быстрая рука на диком западе",
        description: "Получил оффер менее, чем за 2 месяца: -3% к постоплате",
        icon: "🔫",
        category: "discount",
        condition: (stats) =>
          stats.hasOffers &&
          stats.timeToFirstOffer !== null &&
          stats.timeToFirstOffer <= 60,
      },

      // Достижения по тестам
      firstQuiz: {
        id: "first_quiz",
        title: "Первый тест",
        description: "Прошел первый тест",
        icon: "📝",
        category: "quiz",
        condition: (stats) => stats.totalQuizzesCompleted >= 1,
      },
      quizNovice: {
        id: "quiz_novice",
        title: "Тестировщик",
        description: "Прошел 5 тестов",
        icon: "📊",
        category: "quiz",
        condition: (stats) => stats.totalQuizzesCompleted >= 5,
      },
      perfectScore: {
        id: "perfect_score",
        title: "Mastermind",
        description: "Получил 100% в тесте",
        icon: "💯",
        category: "quiz",
        condition: (stats) => stats.hasPerfectQuizScore,
      },
      consistentPerformer: {
        id: "consistent_performer",
        title: "Стабильный результат",
        description: "Получил 90%+ в 5 тестах подряд",
        icon: "📈",
        category: "quiz",
        condition: (stats) => stats.consecutiveHighScores >= 5,
      },
      speedDemon: {
        id: "speed_demon",
        title: "Спидран",
        description: "Прошел тест менее чем за половину отведенного времени",
        icon: "⚡",
        category: "quiz",
        condition: (stats) => stats.hasFastQuizCompletion,
      },
      retryMaster: {
        id: "retry_master",
        title: "Повторенье - мать учения",
        description: "Прошел один тест 5 раз",
        icon: "🔄",
        category: "quiz",
        condition: (stats) => stats.maxQuizRetries >= 5,
      },
      categorySpecialist: {
        id: "category_specialist",
        title: "Специалист по категории",
        description: "Прошел все тесты в одной категории",
        icon: "🎯",
        category: "quiz",
        condition: (stats) => stats.hasCompletedCategory,
      },
      quizCollector: {
        id: "quiz_collector",
        title: "Коллекционер тестов",
        description: "Прошел тесты из 5 разных категорий",
        icon: "📚",
        category: "quiz",
        condition: (stats) => stats.quizCategoriesCompleted >= 5,
      },
      quizMaster: {
        id: "quiz_master",
        title: "Мастер тестов",
        description: "Получил 100% во всех тестах",
        icon: "🎖️",
        category: "quiz",
        condition: (stats) => stats.hasAllQuizzesPerfect,
      },
    };
  }

  /**
   * Инициализация системы геймификации
   */
  async initialize(firebaseConfig) {
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }

      this.db = firebase.database();

      // Achievement evaluation moved to Firebase Functions in catalogue v2.
      // Keep this compatibility facade only for legacy profile selectors until
      // every page has switched to selectedAchievementId.

      firebase.auth().onAuthStateChanged(async (user) => {
        this.user = user;
        if (user) {
          // Сохраняем дату регистрации при первом входе
          await this.saveRegistrationDate();
          this.checkAchievements();
        }
      });

      // Слушаем события от системы тестов
      document.addEventListener("gamification:quiz-finished", (event) => {
        this.handleQuizFinished(event.detail);
      });
    } catch (error) {
      console.error("Failed to initialize Gamification System:", error);
    }
  }

  /**
   * Обработка завершения теста
   */
  async handleQuizFinished(quizData) {
    if (!this.user) return;

    try {
      // Проверяем достижения после завершения теста
      await this.checkAchievements();
    } catch (error) {
      console.error("Error handling quiz finished:", error);
    }
  }

  /**
   * Сохранить дату регистрации пользователя (только при первом входе)
   */
  async saveRegistrationDate() {
    if (!this.user) return;

    try {
      const userRef = this.db.ref(`users/${this.user.uid}`);
      const snapshot = await userRef.once("value");
      const userData = snapshot.val() || {};

      // Если дата регистрации еще не сохранена, сохраняем её
      if (!userData.registrationDate) {
        const updates = {
          [`users/${this.user.uid}/registrationDate`]: Date.now(),
        };

        await this.db.ref().update(updates);
      }
    } catch (error) {
      console.error("Error saving registration date:", error);
    }
  }

  /**
   * Проверить достижения пользователя
   */
  async checkAchievements() {
    // Never award from an untrusted browser. New awards are emitted by
    // Firebase Functions and displayed through achievement_events.
    return;
    if (!this.user) return;

    try {
      const userStats = await this.getUserStats();
      const userAchievements = await this.getUserAchievements();

      // НЕ удаляем недостигнутые достижения - они должны быть постоянными
      // await this.removeInvalidAchievements(userStats, userAchievements);

      const newAchievements = [];

      Object.values(this.achievements).forEach((achievement) => {
        if (
          !userAchievements.includes(achievement.id) &&
          achievement.condition(userStats)
        ) {
          newAchievements.push(achievement);
        }
      });

      if (newAchievements.length > 0) {
        await this.unlockAchievements(newAchievements);
        this.showAchievementNotification(newAchievements);
      }
    } catch (error) {
      console.error("Error checking achievements:", error);
    }
  }

  /**
   * Удалить недостигнутые достижения (если статистика изменилась)
   * ОТКЛЮЧЕНО: Достижения должны быть постоянными и не удаляться
   */
  async removeInvalidAchievements(userStats, userAchievements) {
    if (!this.user) return;

    try {
      const achievementsToRemove = [];

      userAchievements.forEach((achievementId) => {
        const achievement = Object.values(this.achievements).find(
          (a) => a.id === achievementId,
        );
        if (achievement && !achievement.condition(userStats)) {
          achievementsToRemove.push(achievementId);
        }
      });

      if (achievementsToRemove.length > 0) {
        const updates = {};
        achievementsToRemove.forEach((achievementId) => {
          updates[`user_achievements/${this.user.uid}/${achievementId}`] = null;
        });

        await this.db.ref().update(updates);
      }
    } catch (error) {
      console.error("Error removing invalid achievements:", error);
    }
  }

  /**
   * Получить статистику пользователя
   */
  async getUserStats() {
    if (!this.user) return {};

    try {
      const userRef = this.db.ref(`users/${this.user.uid}`);
      const snapshot = await userRef.once("value");
      const userData = snapshot.val() || {};

      // Получаем все отчёты пользователя
      const reportsRef = this.db.ref(`daily_reports/${this.user.uid}`);
      const reportsSnapshot = await reportsRef.once("value");
      const allReports = reportsSnapshot.val() || {};

      const reports = Object.values(allReports);
      const weeklyReports = reports.filter((report) => {
        const reportDate = new Date(report.date);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return reportDate >= weekAgo;
      });

      // Вычисляем расширенные метрики на основе РЕАЛЬНЫХ отчётов И вопросов
      const stats = {
        totalReports: reports.length, // Используем реальное количество отчётов
        // Серию считает сервер (functions/streak.js) и кладёт в профиль.
        // Здесь стоял четвёртый по счёту клиентский пересчёт: он ходил ещё и
        // за прогрессом, а результат всё равно расходился и с сервером, и с
        // соседними виджетами. Заморозки клиенту не воспроизвести в принципе.
        streak: Number(userData.streak) || 0,
        streakState: userData.streakState || null,
        weeklyReports: weeklyReports.length,
        earlyReports: reports.filter((report) => {
          const reportTime = new Date(report.timestamp);
          return reportTime.getHours() < 9;
        }).length,

        // Новые метрики
        avgWordsPerReport7d: this.calculateAvgWords(weeklyReports),
        reportsWithBulletsStreak: this.calculateBulletsStreak(reports),
        nightReports: reports.filter((report) => {
          const reportTime = new Date(report.timestamp);
          return reportTime.getHours() >= 22;
        }).length,
        lunchReports: reports.filter((report) => {
          const reportTime = new Date(report.timestamp);
          return reportTime.getHours() >= 12 && reportTime.getHours() < 14;
        }).length,
        weekendReports: reports.filter((report) => {
          const reportDate = new Date(report.date);
          return reportDate.getDay() === 0 || reportDate.getDay() === 6; // Воскресенье или суббота
        }).length,
        hasBothWeekendDays: (() => {
          const hasSaturday = reports.some(
            (r) => new Date(r.date).getDay() === 6,
          );
          const hasSunday = reports.some(
            (r) => new Date(r.date).getDay() === 0,
          );
          return hasSaturday && hasSunday;
        })(),
        onTimeRate7d: this.calculateOnTimeRate(weeklyReports),
        lastMinuteReports: reports.filter((report) => {
          const reportTime = new Date(report.timestamp);
          const deadline = new Date(reportTime);
          deadline.setHours(23, 50, 0, 0); // 23:50 как дедлайн
          return reportTime >= deadline;
        }).length,
        haikuReports: reports.filter((report) => this.isHaiku(report.done))
          .length,
        oneLineReports: reports.filter((report) => this.isOneLiner(report.done))
          .length,
        maxReportsInDay: this.calculateMaxReportsInDay(reports),
        reportedOnFirstDay: this.hasReportedOnFirstDay(reports),
        reportedOnLastDay: this.hasReportedOnLastDay(reports),
        reportedOnJan1: this.hasReportedOnJan1(reports),
        daysActiveThisMonth: this.calculateDaysActiveThisMonth(reports),
        topTopicShare7d: this.calculateTopTopicShare(weeklyReports),
      };

      // Добавляем статистику по вопросам
      const questionStats = await this.calculateQuestionStats();
      Object.assign(stats, questionStats);

      // Добавляем missedThenStreak7 после получения questionStats
      stats.missedThenStreak7 = this.calculateMissedThenStreak7(reports, stats.streak);

      // Добавляем статистику по офферам
      const offersStats = await this.calculateOffersStats();
      Object.assign(stats, offersStats);

      // Добавляем статистику по тестам
      const quizStats = await this.calculateQuizStats();
      Object.assign(stats, quizStats);

      return stats;
    } catch (error) {
      console.error("Error getting user stats:", error);
      return {};
    }
  }

  /**
   * Получить достижения пользователя
   */
  async getUserAchievements() {
    if (!this.user) return [];

    try {
      const achievementsRef = this.db.ref(`user_achievements/${this.user.uid}`);
      const snapshot = await achievementsRef.once("value");
      const achievements = snapshot.val() || {};

      return Object.keys(achievements);
    } catch (error) {
      console.error("Error getting user achievements:", error);
      return [];
    }
  }

  /**
   * Разблокировать достижения
   */
  async unlockAchievements(achievements) {
    if (!this.user || achievements.length === 0) return;

    try {
      const updates = {};

      achievements.forEach((achievement) => {
        updates[`user_achievements/${this.user.uid}/${achievement.id}`] = {
          unlockedAt: Date.now(),
          title: achievement.title,
          description: achievement.description,
          icon: achievement.icon,
          category:
            achievement.category || this.getAchievementCategory(achievement),
        };
      });

      await this.db.ref().update(updates);
    } catch (error) {
      console.error("Error unlocking achievements:", error);
    }
  }

  /**
   * Показать уведомление о достижении
   */
  showAchievementNotification(achievements) {
    achievements.forEach((achievement, index) => {
      setTimeout(() => {
        this.createAchievementModal(achievement);
      }, index * 100); // Показываем с интервалом 2 секунды
    });
  }

  /**
   * Выдать достижение напрямую (без проверки условий)
   * Используется для событийных достижений (гайды, онбординг и т.д.)
   */
  async grantAchievement(achievementId) {
    if (achievementId === "onboarding_complete" && window.achievementApi) {
      const result = await window.achievementApi.completeOnboarding();
      // Онбординг платит грады, как и остальные ручки достижений.
      window.walletUi?.showCredit(result?.wallet);
      return result;
    }
    console.warn(
      "Client-side achievement grants are disabled; use Firebase Functions.",
    );
    return;
    console.log(`[grantAchievement] Called with ID: ${achievementId}`);

    if (!this.user) {
      console.error("[grantAchievement] No user logged in");
      return;
    }

    if (!this.db) {
      console.error("[grantAchievement] Database not initialized");
      return;
    }

    try {
      // Проверяем, есть ли уже это достижение
      const achievementRef = this.db.ref(
        `user_achievements/${this.user.uid}/${achievementId}`,
      );
      const snapshot = await achievementRef.once("value");

      if (snapshot.exists()) {
        console.log(
          `[grantAchievement] Achievement ${achievementId} already unlocked`,
        );
        return;
      }

      // Получаем данные достижения
      const camelCaseId = this.camelCase(achievementId);
      console.log(`[grantAchievement] Looking for achievement: ${camelCaseId}`);

      const achievement = this.achievements[camelCaseId];
      if (!achievement) {
        console.error(
          `[grantAchievement] Achievement ${achievementId} (${camelCaseId}) not found in:`,
          Object.keys(this.achievements),
        );
        return;
      }

      console.log(`[grantAchievement] Found achievement:`, achievement);

      // Разблокируем достижение
      await this.unlockAchievements([achievement]);
      console.log(`[grantAchievement] Achievement unlocked in Firebase`);

      // Показываем уведомление через глобальную систему
      if (window.globalAchievementNotifications) {
        window.globalAchievementNotifications.show({
          title: achievement.title,
          description: achievement.description,
          icon: achievement.icon,
        });
        console.log(`[grantAchievement] Notification shown`);
      } else {
        console.warn(
          "[grantAchievement] globalAchievementNotifications not available",
        );
      }

      console.log(
        `[grantAchievement] Achievement ${achievementId} granted successfully`,
      );
    } catch (error) {
      console.error("[grantAchievement] Error:", error);
    }
  }

  /**
   * Преобразовать snake_case в camelCase
   */
  camelCase(str) {
    return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
  }

  /**
   * Создать модальное окно достижения
   * Отключено - используется глобальная система уведомлений
   */
  createAchievementModal(achievement) {
    // Модальное окно отключено - используется глобальная система уведомлений
    // из achievement-notifications.js для единообразия
    return;
  }

  /**
   * Получить все достижения пользователя
   */
  async getAllUserAchievements() {
    if (!this.user) return [];

    try {
      const achievementsRef = this.db.ref(`user_achievements/${this.user.uid}`);
      const snapshot = await achievementsRef.once("value");
      const achievements = snapshot.val() || {};

      return Object.entries(achievements)
        .map(([id, achievement]) => ({ id, ...achievement }))
        .sort((a, b) => b.unlockedAt - a.unlockedAt);
    } catch (error) {
      console.error("Error getting all user achievements:", error);
      return [];
    }
  }

  /**
   * Отобразить достижения пользователя
   */
  async displayUserAchievements(containerId) {
    if (!this.user) return;

    try {
      // Принудительно вызываем getUserStats для отладки
      const userStats = await this.getUserStats();

      const unlockedAchievements = await this.getAllUserAchievements();
      const container = document.getElementById(containerId);

      if (!container) return;

      // Получаем общее количество доступных достижений
      const totalAchievements = Object.keys(this.achievements).length;
      const unlockedCount = unlockedAchievements.length;
      const percentage = Math.round((unlockedCount / totalAchievements) * 100);

      // Создаем прогресс для заголовка
      const progressContainer = document.getElementById(
        "achievements-progress-container",
      );
      if (progressContainer) {
        progressContainer.innerHTML = `
          <div class="achievements-progress-inline">
            <div class="achievements-progress-text">
              <span class="achievements-count">${unlockedCount}/${totalAchievements}</span>
              <span class="achievements-percentage">(${percentage}%)</span>
            </div>
            <div class="achievements-progress-bar">
              <div class="achievements-progress-fill" style="width: ${percentage}%"></div>
            </div>
          </div>
        `;
      }

      // Создаем массив всех достижений с информацией о разблокированности
      const allAchievements = Object.values(this.achievements).map(
        (achievement) => {
          const unlockedAchievement = unlockedAchievements.find(
            (ua) => ua.title === achievement.title,
          );
          return {
            ...achievement,
            isUnlocked: !!unlockedAchievement,
            unlockedAt: unlockedAchievement?.unlockedAt,
          };
        },
      );

      // Сортируем: сначала разблокированные, потом неразблокированные
      allAchievements.sort((a, b) => {
        if (a.isUnlocked && !b.isUnlocked) return -1;
        if (!a.isUnlocked && b.isUnlocked) return 1;
        if (a.isUnlocked && b.isUnlocked) return b.unlockedAt - a.unlockedAt;
        return 0;
      });

      // Перевод (ядро — сниппет theme-boot). Названия и описания в
      // this.achievements остаются русскими: они пишутся в базу и по title
      // сверяются с полученными, поэтому переводятся только при показе.
      const t =
        window.t ||
        ((text, params) =>
          text.replace(/\{(\w+)\}/g, (match, key) => params?.[key] ?? match));
      const locale = window.i18n?.locale || "ru-RU";
      container.innerHTML = allAchievements
        .map(
          (achievement) => `
        <div class="achievement-card ${achievement.isUnlocked ? "achievement-unlocked" : "achievement-locked"} ${achievement.category || this.getAchievementCategory(achievement)}" data-category="${this.getAchievementCategory(achievement)}">
          <div class="achievement-card-icon">${achievement.icon}</div>
          <div class="achievement-card-content">
            <div class="achievement-card-title">${t(achievement.title)}</div>
            <div class="achievement-card-description">${t(achievement.description)}</div>
            <div class="achievement-card-date">
              ${
                achievement.isUnlocked
                  ? t("Получено: {date}", {
                      date: new Date(achievement.unlockedAt).toLocaleDateString(
                        locale,
                      ),
                    })
                  : t("Ещё не получено")
              }
            </div>
          </div>
        </div>
      `,
        )
        .join("");
    } catch (error) {
      console.error("Error displaying user achievements:", error);
    }
  }

  /**
   * Получить категорию достижения
   */
  getAchievementCategory(achievement) {
    // Если у достижения есть явное поле category, используем его
    if (achievement.category) {
      return achievement.category;
    }
  }

  /**
   * Получить все скидки пользователя
   */
  async getUserDiscounts() {
    if (!this.user) return [];

    try {
      const achievementsRef = this.db.ref(`user_achievements/${this.user.uid}`);
      const snapshot = await achievementsRef.once("value");
      const achievements = snapshot.val() || {};

      // Фильтруем только достижения со скидками
      const discountAchievements = Object.values(achievements).filter(
        (achievement) => achievement.category === "discount",
      );

      return discountAchievements;
    } catch (error) {
      console.error("Error getting user discounts:", error);
      return [];
    }
  }

  /**
   * Получить общий процент скидки пользователя
   */
  async getTotalDiscountPercentage() {
    const discounts = await this.getUserDiscounts();

    // Извлекаем проценты из названий достижений
    let totalDiscount = 0;
    discounts.forEach((achievement) => {
      const match = achievement.title.match(/(\d+)%/);
      if (match) {
        totalDiscount += parseInt(match[1]);
      }
    });

    // Максимальная скидка не может превышать 10%
    return Math.min(totalDiscount, 10);
  }

  /**
   * Получить мотивационное сообщение
   */
  getMotivationMessage(stats) {
    const messages = [
      {
        condition: () => stats.streak === 0 && stats.totalReports === 0,
        message: "🌟 Начни свой путь к успеху! Первый отчёт - это первый шаг!",
      },
      {
        condition: () => stats.streak >= 1 && stats.streak < 3,
        message: "🔥 Отличное начало! Продолжай в том же духе!",
      },
      {
        condition: () => stats.streak >= 3 && stats.streak < 7,
        message: "🚀 Ты на правильном пути! Не останавливайся!",
      },
      {
        condition: () => stats.streak >= 7 && stats.streak < 14,
        message: "💎 Неделя подряд! Ты становишься лучше каждый день!",
      },
      {
        condition: () => stats.streak >= 14 && stats.streak < 30,
        message: "👑 Две недели подряд! Ты настоящий чемпион!",
      },
      {
        condition: () => stats.streak >= 30,
        message: "🏆 Месяц подряд! Ты легенда! Продолжай в том же духе!",
      },
      {
        condition: () => stats.totalReports >= 50,
        message: "🎖️ 50 отчётов! Ты прошёл половину пути к сотне!",
      },
      {
        condition: () => stats.totalReports >= 100,
        message: "🌟 100 отчётов! Ты достиг невероятного результата!",
      },
    ];

    const matchedMessage = messages.find((msg) => msg.condition());
    const t = window.t || ((text) => text);
    return matchedMessage
      ? t(matchedMessage.message)
      : t("💪 Каждый день важен! Не сдавайся!");
  }

  /**
   * Получить следующий уровень streak
   */
  getNextStreakLevel(currentStreak) {
    const levels = [3, 7, 14, 30, 60, 100];
    const nextLevel = levels.find((level) => level > currentStreak);

    if (nextLevel) {
      return {
        level: nextLevel,
        remaining: nextLevel - currentStreak,
        emoji: this.getStreakEmoji(nextLevel),
      };
    }

    return null;
  }

  /**
   * Получить эмодзи для streak
   */
  getStreakEmoji(streak) {
    if (streak >= 100) return "🏆";
    if (streak >= 60) return "👑";
    if (streak >= 30) return "💎";
    if (streak >= 14) return "🚀";
    if (streak >= 7) return "🔥";
    if (streak >= 3) return "⭐";
    return "💤";
  }

  // Вспомогательные функции для вычисления метрик
  calculateAvgWords(reports) {
    if (reports.length === 0) return 0;
    const totalWords = reports.reduce((sum, report) => {
      return sum + (report.done ? report.done.split(" ").length : 0);
    }, 0);
    return Math.round(totalWords / reports.length);
  }

  calculateBulletsStreak(reports) {
    let maxStreak = 0;
    let currentStreak = 0;

    reports.sort((a, b) => new Date(a.date) - new Date(b.date));

    for (const report of reports) {
      if (this.hasBullets(report.done)) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }

    return maxStreak;
  }

  hasBullets(text) {
    if (!text) return false;
    // Match bullet chars or numbered lists anchored to line start to avoid false positives
    // e.g. hyphens in Russian words, decimal numbers in prose
    return /^[•\-*]/m.test(text) || /^\d+\./m.test(text);
  }

  calculateOnTimeRate(reports) {
    if (reports.length === 0) return 0;

    // Получаем последние 7 дней подряд
    const last7Days = this.getLast7ConsecutiveDays(reports);
    if (last7Days.length === 0) return 0;

    // Считаем процент отчётов, отправленных вовремя (до 18:00)
    const onTimeCount = last7Days.filter((report) => {
      const reportTime = new Date(report.timestamp);
      return reportTime.getHours() < 18; // До 18:00 считается вовремя
    }).length;

    return onTimeCount / last7Days.length;
  }

  /**
   * Получить последние 7 дней подряд с отчётами
   */
  getLast7ConsecutiveDays(reports) {
    if (reports.length === 0) return [];

    // Сортируем отчёты по дате
    const sortedReports = reports.sort(
      (a, b) => new Date(a.date) - new Date(b.date),
    );

    // Получаем уникальные даты отчётов
    const reportDates = [...new Set(sortedReports.map((r) => r.date))].sort();

    // Находим последние 7 дней подряд
    const last7Days = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      // Было toISOString(), то есть день по UTC, — при том что соседние методы
      // этого же класса считали день по локальному времени. Одна и та же
      // неделя получалась разной в зависимости от того, какой метод её
      // посчитал.
      const dateStr = window.platformDayKey(checkDate);

      if (reportDates.includes(dateStr)) {
        // Находим все отчёты за этот день
        const dayReports = sortedReports.filter((r) => r.date === dateStr);
        last7Days.push(...dayReports);
      } else {
        // Если нет отчёта за день, прерываем streak
        return [];
      }
    }

    return last7Days;
  }

  isHaiku(text) {
    if (!text) return false;
    const lines = text.split("\n").filter((line) => line.trim());
    if (lines.length !== 3) return false;

    const wordCounts = lines.map((line) => line.trim().split(" ").length);
    return wordCounts[0] === 5 && wordCounts[1] === 7 && wordCounts[2] === 5;
  }

  isOneLiner(text) {
    if (!text) return false;
    const lines = text.split("\n").filter((line) => line.trim());
    return lines.length === 1 && text.length < 100;
  }

  calculateMaxReportsInDay(reports) {
    const reportsByDate = {};
    reports.forEach((report) => {
      const date = report.date;
      if (!reportsByDate[date]) {
        reportsByDate[date] = 0;
      }
      reportsByDate[date]++;
    });

    return Math.max(...Object.values(reportsByDate), 0);
  }

  hasReportedOnFirstDay(reports) {
    return reports.some((report) => {
      const date = new Date(report.date);
      return date.getDate() === 1;
    });
  }

  hasReportedOnLastDay(reports) {
    return reports.some((report) => {
      const date = new Date(report.date);
      const lastDay = new Date(
        date.getFullYear(),
        date.getMonth() + 1,
        0,
      ).getDate();
      return date.getDate() === lastDay;
    });
  }

  hasReportedOnJan1(reports) {
    return reports.some((report) => {
      const date = new Date(report.date);
      return date.getMonth() === 0 && date.getDate() === 1;
    });
  }

  calculateDaysActiveThisMonth(reports) {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const thisMonthReports = reports.filter((report) => {
      const date = new Date(report.date);
      return (
        date.getMonth() === currentMonth && date.getFullYear() === currentYear
      );
    });

    const uniqueDays = new Set(thisMonthReports.map((report) => report.date));
    return uniqueDays.size;
  }

  calculateTopTopicShare(reports) {
    if (reports.length === 0) return 0;

    // Подсчитываем количество отчетов по каждой явно заданной теме
    const topics = {};
    reports.forEach((report) => {
      if (report.topic && report.topic !== "Другое") {
        topics[report.topic] = (topics[report.topic] || 0) + 1;
      }
    });

    // Если нет отчетов с явно заданными темами, возвращаем 0
    if (Object.keys(topics).length === 0) return 0;

    const maxTopicCount = Math.max(...Object.values(topics), 0);
    return maxTopicCount / reports.length;
  }

  /**
   * «Возвращение»: серия от семи дней после пропуска.
   *
   * Длину серии берём у сервера, а не пересчитываем: пересчёт в браузере и был
   * причиной того, что одно и то же достижение приходило по одному правилу, а
   * число на главной рисовалось по другому.
   */
  calculateMissedThenStreak7(reports, streak) {
    return Number(streak || 0) >= 7 && this.hasMissedDays(reports);
  }

  getDateString(date) {
    return window.platformDayKey(date);
  }

  hasMissedDays(reports) {
    if (reports.length < 2) return false;

    const dates = reports.map((r) => r.date).sort();
    for (let i = 1; i < dates.length; i++) {
      const prevDate = new Date(dates[i - 1]);
      const currDate = new Date(dates[i]);
      const daysDiff = Math.floor(
        (currDate - prevDate) / (1000 * 60 * 60 * 24),
      );

      if (daysDiff > 1) return true;
    }

    return false;
  }

  /**
   * Загрузить структуру вопросов из JSON файла
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
   * Рассчитать статистику по офферам
   */
  async calculateOffersStats() {
    if (!this.user) return {};

    try {
      // Получаем данные пользователя
      const userRef = this.db.ref(`users/${this.user.uid}`);
      const snapshot = await userRef.once("value");
      const userData = snapshot.val() || {};

      const registrationDate = userData.registrationDate;
      const offers = userData.offers || [];

      // Рассчитываем время до первого оффера
      let timeToFirstOffer = null;
      if (offers.length > 0 && registrationDate) {
        const firstOffer = offers.reduce((earliest, offer) =>
          offer.date < earliest.date ? offer : earliest,
        );
        // firstOffer.date хранится в секундах (Unix timestamp),
        // registrationDate в миллисекундах (JavaScript timestamp)
        const firstOfferDateMs = firstOffer.date * 1000;
        timeToFirstOffer = Math.floor(
          (firstOfferDateMs - registrationDate) / (1000 * 60 * 60 * 24),
        ); // в днях
      }

      return {
        totalOffers: offers.length,
        timeToFirstOffer: timeToFirstOffer,
        hasOffers: offers.length > 0,
        offers: offers,
      };
    } catch (error) {
      console.error("Error calculating offers stats:", error);
      return {
        totalOffers: 0,
        timeToFirstOffer: null,
        hasOffers: false,
        offers: [],
      };
    }
  }
  async calculateQuestionStats() {
    if (!this.user) return {};

    try {
      // Получаем прогресс пользователя по вопросам
      const progressRef = this.db.ref(`users/${this.user.uid}/progress`);
      const snapshot = await progressRef.once("value");
      const progressData = snapshot.val() || {};

      // Подсчитываем общее количество решенных вопросов
      const totalQuestionsCompleted = Object.keys(progressData).length;

      // Подсчитываем вопросы по категориям
      const questionsByCategory = {};
      const categoryProgress = {};

      // Инициализируем счетчики для всех категорий
      Object.keys(this.questionCategories).forEach((category) => {
        questionsByCategory[category] = 0;
        categoryProgress[category] = 0;
      });

      // Подсчитываем решенные вопросы по категориям
      Object.keys(progressData).forEach((questionId) => {
        let foundInCategory = false;
        // Находим ВСЕ категории для каждого вопроса (не только первую)
        for (const [category, questions] of Object.entries(
          this.questionCategories,
        )) {
          if (questions.includes(questionId)) {
            questionsByCategory[category]++;
            foundInCategory = true;
            // НЕ break - продолжаем искать в других категориях
          }
        }

        // Если вопрос не найден ни в одной категории, логируем его
        if (!foundInCategory) {
        }
      });

      // Рассчитываем прогресс по категориям (в процентах)
      Object.keys(this.questionCategories).forEach((category) => {
        const totalInCategory = this.totalQuestionsByCategory[category] || 0;
        const completedInCategory = questionsByCategory[category] || 0;
        categoryProgress[category] =
          totalInCategory > 0 ? completedInCategory / totalInCategory : 0;
      });

      // Рассчитываем общий прогресс по УНИКАЛЬНЫМ ID (как в профиле/лидерборде)
      const uniqueAllowedIds = new Set();
      Object.entries(this.questionCategories).forEach(([catName, ids]) => {
        if (catName === "interviews") return; // пропускаем агрегат
        if (Array.isArray(ids)) ids.forEach((id) => uniqueAllowedIds.add(id));
      });
      const uniqueTotal = uniqueAllowedIds.size;
      const uniqueCompleted = Object.keys(progressData).filter((id) =>
        uniqueAllowedIds.has(id),
      ).length;
      const overallProgress =
        uniqueTotal > 0 ? uniqueCompleted / uniqueTotal : 0;

      // Подсчитываем категории с прогрессом
      const categoriesWithProgress = Object.values(questionsByCategory).filter(
        (count) => count > 0,
      ).length;

      // Подсчитываем категории с 100% прогрессом
      const categoriesAt100Percent = Object.values(categoryProgress).filter(
        (progress) => progress >= 1.0,
      ).length;

      // Проверяем, есть ли хотя бы одна категория с 100% прогрессом
      const hasCategoryAt100Percent = categoriesAt100Percent > 0;

      return {
        totalQuestionsCompleted,
        questionsByCategory,
        overallProgress,
        categoriesWithProgress,
        categoriesAt100Percent,
        hasCategoryAt100Percent,
        // Прогресс по конкретным категориям для достижений
        pythonProgress: categoryProgress.python || 0,
        mathProgress: categoryProgress.math || 0,
        ml_classicProgress: categoryProgress.ml_classic || 0,
        ml_dlProgress: categoryProgress.ml_dl || 0,
        ml_nlpProgress:
          ((categoryProgress.ml_nlp_base || 0) +
            (categoryProgress.ml_nlp_advanced || 0) +
            (categoryProgress.ml_optimization || 0) +
            (categoryProgress.ml_rag || 0) +
            (categoryProgress.ml_agents || 0)) /
          5,
        ml_cvProgress: categoryProgress.ml_cv || 0,
        ml_models_dlProgress: categoryProgress.ml_models_dl || 0,
        ml_models_cvProgress: categoryProgress.ml_models_cv || 0,
        ml_models_nlpProgress: categoryProgress.ml_models_nlp || 0,
        ml_trainProgress: categoryProgress.ml_train || 0,
        githubProgress: categoryProgress.github || 0,
        linuxProgress: categoryProgress.linux || 0,
        dockerProgress: categoryProgress.docker || 0,
        interviewsProgress: categoryProgress.interviews || 0,
        k8sProgress: categoryProgress.k8s || 0,
      };
    } catch (error) {
      console.error("Error calculating question stats:", error);
      return {
        totalQuestionsCompleted: 0,
        questionsByCategory: {},
        overallProgress: 0,
        categoriesWithProgress: 0,
        categoriesAt100Percent: 0,
        hasCategoryAt100Percent: false,
        pythonProgress: 0,
        mathProgress: 0,
        ml_classicProgress: 0,
        ml_dlProgress: 0,
        ml_nlpProgress: 0,
        ml_cvProgress: 0,
        ml_models_dlProgress: 0,
        ml_models_cvProgress: 0,
        ml_models_nlpProgress: 0,
        ml_trainProgress: 0,
        githubProgress: 0,
        linuxProgress: 0,
        dockerProgress: 0,
        interviewsProgress: 0,
        k8sProgress: 0,
      };
    }
  }

  /**
   * Рассчитать статистику по тестам
   */
  async calculateQuizStats() {
    if (!this.user) return {};

    try {
      // Получаем результаты тестов пользователя
      const quizResultsRef = this.db.ref(`users/${this.user.uid}/quizResults`);
      const snapshot = await quizResultsRef.once("value");
      const quizResults = snapshot.val() || {};

      let totalQuizzesCompleted = 0;
      let hasPerfectQuizScore = false;
      let consecutiveHighScores = 0;
      let maxConsecutiveHighScores = 0;
      let hasFastQuizCompletion = false;
      let maxQuizRetries = 0;
      let quizCategoriesCompleted = new Set();
      let hasCompletedCategory = false;

      // Загружаем список всех доступных тестов
      const registryResponse = await fetch(
        "/assets/data/quizzes/registry.json",
      );
      const registry = await registryResponse.json();
      const allQuizIds = Object.keys(registry);

      // Обрабатываем результаты по каждому тесту
      Object.entries(quizResults).forEach(([quizId, results]) => {
        const quizResultsArray = Object.values(results);
        totalQuizzesCompleted += quizResultsArray.length;

        // Проверяем на идеальный результат
        if (quizResultsArray.some((result) => result.score >= 1.0)) {
          hasPerfectQuizScore = true;
        }

        // Проверяем на быстрое прохождение
        if (
          quizResultsArray.some((result) => {
            const timeLimit = result.timeLimit || 600; // 10 минут по умолчанию
            return result.timeSpent < timeLimit / 2;
          })
        ) {
          hasFastQuizCompletion = true;
        }

        // Максимальное количество попыток для одного теста
        maxQuizRetries = Math.max(maxQuizRetries, quizResultsArray.length);

        // Определяем категорию теста (упрощенно)
        const category = this.getQuizCategory(quizId);
        if (category) {
          quizCategoriesCompleted.add(category);
        }

        // Проверяем последовательные высокие результаты
        const sortedResults = quizResultsArray.sort(
          (a, b) => a.timestamp - b.timestamp,
        );
        let currentConsecutive = 0;

        for (const result of sortedResults) {
          if (result.score >= 0.9) {
            currentConsecutive++;
            maxConsecutiveHighScores = Math.max(
              maxConsecutiveHighScores,
              currentConsecutive,
            );
          } else {
            currentConsecutive = 0;
          }
        }
      });

      consecutiveHighScores = maxConsecutiveHighScores;

      // Проверяем, завершены ли все тесты в какой-либо категории
      // Это упрощенная проверка - в реальности нужно сравнивать с общим количеством тестов в категории
      hasCompletedCategory = quizCategoriesCompleted.size >= 1;

      // Проверяем, что все тесты пройдены на 100%
      const hasAllQuizzesPerfect = allQuizIds.every((quizId) => {
        const results = quizResults[quizId];
        if (!results) return false;
        const resultsArray = Object.values(results);
        return resultsArray.some((result) => result.score >= 1.0);
      });

      return {
        totalQuizzesCompleted,
        hasPerfectQuizScore,
        consecutiveHighScores,
        hasFastQuizCompletion,
        maxQuizRetries,
        quizCategoriesCompleted: quizCategoriesCompleted.size,
        hasCompletedCategory,
        hasAllQuizzesPerfect,
      };
    } catch (error) {
      console.error("Error calculating quiz stats:", error);
      return {
        totalQuizzesCompleted: 0,
        hasPerfectQuizScore: false,
        consecutiveHighScores: 0,
        hasFastQuizCompletion: false,
        maxQuizRetries: 0,
        quizCategoriesCompleted: 0,
        hasCompletedCategory: false,
        hasAllQuizzesPerfect: false,
      };
    }
  }

  /**
   * Получить категорию теста по его ID
   */
  getQuizCategory(quizId) {
    // Упрощенное определение категории по ID
    if (quizId.includes("python")) return "python";
    if (quizId.includes("maths")) return "math";
    if (quizId.includes("ml")) return "ml";
    return null;
  }
}

// Создаём глобальный экземпляр
window.gamificationSystem = new GamificationSystem();
