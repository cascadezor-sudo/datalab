/**
 * Английский словарь интерфейса. Ключ — русская строка ровно как в коде:
 * t("Каталог") в JS или текст узла/атрибута в статичном HTML (его переводит
 * обход в сниппете theme-boot). Плейсхолдеры {name} в ключе и в переводе
 * должны совпадать — это проверяет tests/i18n.test.js, как и то, что у
 * каждого t("…") в коде есть перевод.
 *
 * Грузится только при английском интерфейсе (theme-boot).
 */
window.i18n.add({
  // ── Навигация (navigation.js) ─────────────────────────────────────────────
  "Основная навигация": "Main navigation",
  "Меню навигации": "Navigation menu",
  Домой: "Home",
  "Schmidt ML — на главную": "Schmidt ML — home",
  Материалы: "Materials",
  Основы: "Foundations",
  интерактивная: "interactive",
  Поиск: "Search",
  "Меню аккаунта": "Account menu",
  "Выйти из аккаунта?": "Log out of your account?",
  Кабинет: "Dashboard",
  Изучение: "Learn",
  "Машинное обучение": "Machine learning",
  Математика: "Math",
  Практика: "Practice",
  Инструменты: "Tools",
  "Базы данных": "Databases",
  Прогресс: "Progress",
  "Доска задач": "Task board",
  Лидерборд: "Leaderboard",
  Отчеты: "Reports",
  Тесты: "Quizzes",
  Достижения: "Achievements",
  Кошелёк: "Wallet",
  "Карта разделов": "Section map",
  "Карта разделов (интерактивная)": "Section map (interactive)",
  Собесы: "Interviews",
  "Доп. источники": "Resources",
  Профиль: "Profile",
  Новости: "News",
  Оформление: "Appearance",
  Каталог: "Catalog",
  "Открыть каталог": "Open catalog",
  "Кошелёк: грады за учёбу": "Wallet: grads earned by studying",
  "Кошелёк: {label}": "Wallet: {label}",
  онлайн: "online",
  "Учеников на сайте за последние {minutes} минут":
    "Students on the site in the last {minutes} minutes",
  "На главной": "On the home page",
  "Повторяют карточки": "Reviewing cards",
  "Смотрят лидерборд": "Viewing the leaderboard",
  "В кошельке": "In the wallet",
  "Смотрят достижения": "Viewing achievements",
  "Пишут отчёт": "Writing a report",
  "Читают новости": "Reading news",
  "Банк вопросов": "Question bank",
  Собеседования: "Interviews",
  Роадмап: "Roadmap",
  Гайд: "Guide",
  "Другие страницы": "Other pages",
  "🧊 Запасные заморозки закрыли {count} пропущенных дня — серия сохранена.":
    "🧊 Spare freezes covered {count} missed days — your streak is safe.",
  "🧊 Ночью сработала запасная заморозка — серия сохранена.":
    "🧊 A spare freeze kicked in overnight — your streak is safe.",
  "В запасе: {reserve}.": "Left in reserve: {reserve}.",

  // ── Окно оформления (navigation.js) ───────────────────────────────────────
  "Настройки интерфейса": "Interface settings",
  "Оформление платформы": "Platform appearance",
  Закрыть: "Close",
  Тема: "Theme",
  Светлая: "Light",
  "Тёплый светлый фон для чтения днём.":
    "Warm light background for daytime reading.",
  Тёмная: "Dark",
  "Контрастный режим для вечерней работы.":
    "High-contrast mode for evening work.",
  "Как в системе": "System",
  "Вариант оформления": "Color scheme",
  "Синий и розовый — пара по умолчанию.": "Blue and pink — the default pair.",
  "Зелёный и коричневый, тёплая природная гамма.":
    "Green and brown, a warm natural palette.",
  "Тёплая «бумага», терракота и сиена — удобно для длинного чтения.":
    "Warm “paper”, terracotta and sienna — easy on the eyes for long reads.",
  "Нейтральный графит и сланец, мало отвлечений.":
    "Neutral graphite and slate, few distractions.",
  светлая: "light",
  тёмная: "dark",
  "как в системе": "system",
  "Тема: {theme}. Оформление: {palette}.":
    "Theme: {theme}. Color scheme: {palette}.",

  // ── Главная (main.html, main-today.js) ────────────────────────────────────
  Главная: "Home",
  "Перейти к содержимому": "Skip to content",
  "Привет!": "Hi!",
  "Привет, {name}!": "Hi, {name}!",
  "Добро пожаловать на платформу": "Welcome to the platform",
  "Доброе утро ☀️": "Good morning ☀️",
  "Продуктивного дня 💪": "Have a productive day 💪",
  "Добрый вечер 🌆": "Good evening 🌆",
  "Ночная сессия 🌙": "Late-night session 🌙",
  градов: "grads",
  Выйти: "Log out",
  Сегодня: "Today",
  "Цель на день": "Daily goal",
  "Считаются решённые вопросы и повторённые карточки":
    "Solved questions and reviewed cards count",
  "Цель:": "Goal:",
  "Дневная цель: сколько вопросов и карточек в день":
    "Daily goal: how many questions and cards per day",
  "Цель — 5 в день": "Goal: 5 a day",
  "Цель — 10 в день": "Goal: 10 a day",
  "Цель — 20 в день": "Goal: 20 a day",
  "Цель на сегодня выполнена: {done} из {goal}":
    "Today's goal reached: {done} of {goal}",
  "{done} из {goal} за сегодня": "{done} of {goal} today",
  "Серия начнётся с первого вопроса, карточки или отчёта сегодня":
    "Your streak starts with today's first question, card or report",
  "Серия начнётся с первого вопроса или карточки сегодня":
    "Your streak starts with today's first question or card",
  "сегодня ещё не продлена": "not extended today yet",
  "сегодня ещё не продлена · заморозка подстрахует":
    "not extended today yet · a freeze has your back",
  "до вехи {target} {left}": "{left} until the {target}-day milestone",
  Повторение: "Review",
  "карточки из теорминимума": "cards from the theory minimum",
  Повторить: "Review",
  "задачи, дедлайны и статусы": "tasks, deadlines and statuses",
  Открыть: "Open",
  Фидбек: "Feedback",
  "разборы собесов от ментора": "interview reviews from your mentor",
  Читать: "Read",
  "Всё повторено": "All reviewed",
  "Нет активных задач": "No active tasks",
  "Новых нет": "Nothing new",
  "Единый каталог": "Unified catalog",
  "Ищи по разделам, материалам, вопросам одной строкой.":
    "Search sections, materials and questions in one line.",
  Обучение: "Learning",
  "Карта разделов и прогресс по темам": "Section map and progress by topic",
  "Учебный план": "Study plan",
  "Недельная траектория и дедлайны": "Weekly track and deadlines",
  "Достижения, отчёты, тесты, офферы": "Achievements, reports, quizzes, offers",
  "Рабочее место": "Workspace",
  "Роль-зависимый кабинет с быстрым доступом к рабочим сценариям.":
    "Role-based dashboard with quick access to your workflows.",
  "Рабочее место команды": "Team workspace",
  "Рабочее место ментора": "Mentor workspace",
  "Студенты, активность, офферы, сложность вопросов и быстрые действия.":
    "Students, activity, offers, question difficulty and quick actions.",
  "Рабочее место куратора": "Curator workspace",
  "Кабинет куратора": "Curator dashboard",
  "Ученики, дедлайны, учебный план и кураторские сценарии в одном месте.":
    "Students, deadlines, study plan and curator workflows in one place.",
  "Работа с платформой": "Using the platform",
  "Видео-гайд": "Video guide",
  "Две минуты о том, как устроена платформа и с чего начать":
    "Two minutes on how the platform works and where to start",
  "Смотреть гайд": "Watch the guide",
  "Быстрый старт": "Quick start",
  "Первые шаги": "First steps",
  "Если ты в начале пути, начни с первых шагов":
    "Just getting started? Begin with the first steps",
  "Начать обучение": "Start learning",

  // ── Вопрос дня (question-of-day.js) ───────────────────────────────────────
  "Вопрос дня": "Question of the day",
  "Проверить себя": "Test yourself",
  Разобран: "Done",
  "{count} уверенно": "{count} confident",
  "Загружаем карточки…": "Loading cards…",
  "Не удалось загрузить карточки. Попробуйте ещё раз чуть позже.":
    "Couldn't load the cards. Please try again a bit later.",
  "Карточка {index} из {total}": "Card {index} of {total}",
  Самопроверка: "Self-check",
  "У этого вопроса нет карточек для самопроверки. Откройте материал, разберите его и попробуйте объяснить тему вслух — как на собеседовании.":
    "This question has no self-check cards. Open the material, work through it and try explaining the topic out loud — as in an interview.",
  "Насколько уверенно получилось объяснить?":
    "How confidently could you explain it?",
  "Открыть материал": "Open the material",
  "Я разобрал материал": "I've worked through the material",
  "Показать ответ": "Show answer",
  "Насколько хорошо вы знали ответ": "How well did you know the answer",
  Снова: "Again",
  "не вспомнил": "didn't recall",
  Трудно: "Hard",
  "с подсказкой": "with a hint",
  Хорошо: "Good",
  вспомнил: "recalled",
  Легко: "Easy",
  сразу: "instantly",
  "Сначала ответьте про себя, потом откройте ответ и оцените честно: награда от оценки не зависит.":
    "Answer to yourself first, then reveal the answer and rate yourself honestly: the reward doesn't depend on the rating.",
  "Засчитываем…": "Saving…",
  "Обновить страницу": "Reload the page",
  "Отправить ещё раз": "Send again",
  "Начались новые сутки — вопрос дня сменился. Обновите страницу, чтобы открыть сегодняшний.":
    "A new day has started and the question of the day has changed. Reload the page to open today's one.",
  "Не удалось засчитать. Попробуйте ещё раз.":
    "Couldn't save it. Please try again.",

  // ── Лидерборд и лиги (leaderboard.html, leaderboard.js, league.js) ──
  // @i18n-section:leaderboard — переводы этой группы дописываются сразу под этой строкой.
  "Отслеживай прогресс обучения": "Track your learning progress",
  "Настроить профиль": "Edit profile",
  "Продолжить обучение": "Continue learning",
  "Управление статусом учеников": "Managing student status",
  "Наведите курсор на запись ученика, чтобы увидеть кнопки управления статусом. Завершившие обучение или покинувшие курс ученики будут перемещены в конец списка и визуально выделены.":
    "Hover over a student's row to see the status controls. Students who finished or left the course move to the bottom of the list and are highlighted.",
  "Начислить грады за всю прошлую активность каждому ученику. Повторный запуск ничего не доплатит.":
    "Credit grads for all past activity to every student. Running it again won't pay anything extra.",
  "Начислить грады за историю": "Credit grads for past activity",
  "Общий зачёт и лига": "Overall and league",
  "Общий зачёт": "Overall",
  "Моя лига": "My league",
  "Секции лидерборда": "Leaderboard sections",
  Менторство: "Mentorship",
  "Только материалы": "Materials only",
  "Ученики на менторстве. Места и статистика считаются внутри секции.":
    "Students in the mentorship program. Ranks and stats are calculated within this section.",
  "Ученики с доступом к материалам платформы. Рядом с именем — выданный уровень доступа; подгруппы для этого формата не назначаются.":
    "Students with access to the platform's materials. The badge next to a name shows their access level; subgroups aren't assigned for this format.",
  Участников: "Participants",
  "Вопросов изучено": "Questions studied",
  "Часов на учёбу": "Study hours",
  "Все время": "All time",
  "За неделю": "Past week",
  "За месяц": "Past month",
  "За год": "Past year",
  "Все категории": "All categories",
  "Все подгруппы": "All subgroups",
  "Без подгруппы": "No subgroup",
  Обновить: "Refresh",
  Место: "Rank",
  Подсказка: "Hint",
  "Место в рейтинге по выбранной колонке. Топ-3 отображаются с медалями.":
    "Rank by the selected column. The top 3 get medals.",
  Участник: "Participant",
  "Имя и подгруппа участника. Можно выбрать отображаемое достижение в профиле.":
    "Participant's name and subgroup. You can choose which achievement to display in your profile.",
  "Сортировать по числу вопросов": "Sort by number of questions",
  Вопросов: "Questions",
  "Прогресс по вопросам учитывается при отметке вопросов как изученных в материалах и роадмапе.":
    "Question progress counts when you mark questions as studied in the materials and the roadmap.",
  "Прогресс по темам": "Progress by topic",
  "Сортировать по часам": "Sort by hours",
  Часы: "Hours",
  "Часы на учёбу можно проставлять в отчётах. Указывайте их регулярно — так формируется рейтинг.":
    "You can log study hours in your reports. Log them regularly: they count toward the ranking.",
  "Мои отчёты": "My reports",
  "Сортировать по проценту достижений": "Sort by achievement percentage",
  "Процент полученных достижений от общего числа в системе (отчёты, прогресс, тесты и др.).":
    "Share of all achievements in the system earned so far (reports, progress, quizzes, and more).",
  "Все достижения": "All achievements",
  "Сортировать по числу решённых тестов": "Sort by quizzes passed",
  "Количество уникальных тестов, в которых участник хотя бы раз прошёл проверку.":
    "Number of distinct quizzes the participant has passed at least once.",
  "Сортировать по среднему % тестов": "Sort by average quiz %",
  "Ср. балл": "Avg. score",
  "Средний процент правильных ответов по всем пройденным тестам (берётся лучший результат по каждому тесту).":
    "Average percentage of correct answers across all completed quizzes (best attempt per quiz).",
  "Сортировать по градам на счёте": "Sort by grad balance",
  Грады: "Grads",
  "Загрузка лидерборда...": "Loading leaderboard...",
  "Последнее обновление: никогда": "Last updated: never",
  "Последнее обновление: {time}": "Last updated: {time}",
  "Даты переходов": "Transition dates",
  Отмена: "Cancel",
  Сохранить: "Save",
  "Ошибка загрузки лидерборда. Попробуйте обновить страницу.":
    "Couldn't load the leaderboard. Try reloading the page.",
  "Ошибка инициализации лидерборда": "Couldn't initialize the leaderboard",
  "Ошибка загрузки данных лидерборда": "Couldn't load leaderboard data",
  "Участник {id}": "Participant {id}",
  "Без имени": "No name",
  "История подгрупп": "Subgroup history",
  "Уровень доступа": "Access level",
  "Тариф не распознан": "Plan not recognized",
  "Тариф не назначен": "No plan assigned",
  "На платформе с": "On the platform since",
  "Подгруппа: {name}": "Subgroup: {name}",
  "Формат обучения: Только материалы": "Learning format: Materials only",
  "Уровень доступа: {plan}": "Access level: {plan}",
  "Ответственный: {name}": "Assigned to: {name}",
  "Нет активных учеников": "No active students",
  "Пока нет данных": "No data yet",
  "Завершившие обучение и покинувшие курс скрыты по умолчанию.":
    "Students who finished or left the course are hidden by default.",
  "В этой секции пока никого нет — здесь появятся ученики с доступом только к материалам.":
    "No one here yet. Students with materials-only access will show up in this section.",
  "Начните изучать материалы, чтобы появиться в лидерборде!":
    "Start studying the materials to appear on the leaderboard!",
  "Показать ещё": "Show more",
  "Скрыть завершивших и покинувших": "Hide finished and departed",
  "Сотрудники с историей ученика": "Staff with a student history",
  "Не участвуют в рейтинге. Строки нужны для правки статуса, подгруппы и дат переходов.":
    "Not ranked. These rows are here to edit status, subgroup, and transition dates.",
  "Завершил обучение": "Finished the program",
  "Покинул курс": "Left the program",
  "На паузе": "On pause",
  "Выбранное достижение": "Featured achievement",
  "Статус:": "Status:",
  "Активный ученик": "Active student",
  Активный: "Active",
  Пауза: "Pause",
  Завершил: "Finished",
  Покинул: "Left",
  "Подгруппа:": "Subgroup:",
  "Не назначается для формата «Только материалы»":
    "Not assigned for the Materials only format",
  "Редактировать даты переходов": "Edit transition dates",
  Даты: "Dates",
  "{hours} ч": "{hours} h",
  "Градов на счёте": "Grad balance",
  "Обработано {processed} из {total}, начислено ∇ {credited}…":
    "Processed {processed} of {total}, credited ∇ {credited}…",
  "Готово: {students}, начислено ∇ {credited}.":
    "Done: {students}, credited ∇ {credited}.",
  "Не удалось: {error}": "Failed: {error}",
  "Требуется вход в систему": "Sign-in required",
  "Для просмотра лидерборда необходимо войти в систему.":
    "Sign in to view the leaderboard.",
  "Войти в систему": "Sign in",
  "Загрузка данных...": "Loading data...",
  "Пожалуйста, подождите, пока загружаются данные лидерборда.":
    "Please wait while the leaderboard data loads.",
  "У вас нет прав для изменения статуса учеников":
    "You don't have permission to change student status",
  "Статус ученика обновлен: {status}": "Student status updated: {status}",
  "Ошибка при обновлении статуса ученика":
    "Couldn't update the student's status",
  "У вас нет прав для изменения подгруппы учеников":
    "You don't have permission to change student subgroups",
  "Для формата «Только материалы» подгруппа не назначается":
    "Subgroups aren't assigned for the Materials only format",
  "Подгруппа ученика обновлена: {subgroup}":
    "Student subgroup updated: {subgroup}",
  "Ошибка при обновлении подгруппы ученика":
    "Couldn't update the student's subgroup",
  "У вас нет прав для редактирования дат":
    "You don't have permission to edit dates",
  "Ученик не найден в лидерборде": "Student not found on the leaderboard",
  "Даты переходов обновлены": "Transition dates updated",
  "Ошибка при сохранении дат переходов": "Couldn't save transition dates",
  // Лиги (league.js); названия тиров приходят с сервера по-русски.
  Бронза: "Bronze",
  Серебро: "Silver",
  Золото: "Gold",
  Платина: "Platinum",
  Лиги: "Leagues",
  "Лиги недели": "This week's leagues",
  "Лига «{tier}»": "{tier} League",
  "{name} — ты": "{name} (you)",
  "Лига начнётся в понедельник": "The league starts on Monday",
  "Каждую неделю ученики делятся на группы по 10–15 человек близкого уровня и соревнуются по числу решённых за неделю вопросов. Лучшие переходят в лигу выше.":
    "Every week, students are split into groups of 10–15 at a similar level and compete on how many questions they solve that week. The top performers move up a league.",
  "Попробовать снова": "Try again",
  "Не удалось загрузить лигу": "Couldn't load the league",
  "Проверь соединение и попробуй ещё раз.":
    "Check your connection and try again.",
  "До конца недели {days}. Очки — вопросы, решённые с понедельника. Зелёная зона претендует на лигу выше (она открывается, когда в ней набирается трое), красная идёт в лигу ниже; без решённых вопросов — понижение.":
    "{days} left in the week. Points are questions solved since Monday. The green zone is in line for the next league up (it opens once three students qualify), the red zone drops a league, and solving no questions means moving down.",
  "Прошлая неделя: {place}-е место — повышение, теперь ты в лиге «{tier}».":
    "Last week: #{place}, promoted. You're now in the {tier} league.",
  "Прошлая неделя: {place}-е место — понижение, теперь ты в лиге «{tier}».":
    "Last week: #{place}, moved down. You're now in the {tier} league.",
  "Прошлая неделя: {place}-е место — на этой неделе ты в лиге «{tier}».":
    "Last week: #{place}. This week you're in the {tier} league.",
  "Повышен по итогам прошлой недели": "Promoted after last week",
  "Понижен по итогам прошлой недели": "Moved down after last week",
  "Формат обучения": "Learning format",
  "Лиги на этой неделе идут, но ваших учеников в группах нет: в лиги попадают активные ученики с заполненным именем.":
    "Leagues are running this week, but none of your students are in a group: only active students with a filled-in name join leagues.",
  "Групп на этой неделе ещё нет. Они собираются в понедельник в 00:15 по Москве: ученики делятся на группы до 15 человек внутри лиги, первые трое по решённым за неделю вопросам переходят лигой выше, последние трое и все без единого вопроса — ниже.":
    "No groups this week yet. They're formed on Mondays at 00:15 Moscow time: students are split into groups of up to 15 within each league; the top three by questions solved that week move up a league, and the bottom three plus everyone with zero questions move down.",
  "Неделя {start}–{end}, до конца {days}. · {students} в {groups}. Очки — вопросы, решённые с понедельника; зелёная зона претендует на лигу выше (лига открывается, когда в ней набирается трое), красная идёт ниже. Стрелка у имени — итог прошлой недели.":
    "Week of {start}–{end}, {days} left · {students} in {groups}. Points are questions solved since Monday; the green zone is in line for the next league up (a league opens once three students qualify), the red zone moves down. The arrow next to a name shows last week's result.",
  "Группа {number}": "Group {number}",
  "Загружаем лиги…": "Loading leagues…",
  "Загружаем лигу…": "Loading your league…",

  // (конец секции leaderboard)

  // ── Кошелёк и достижения (wallet.html, wallet-page.js, achievements.html, achievements-page.js) ──
  // @i18n-section:wallet — переводы этой группы дописываются сразу под этой строкой.
  // wallet.html
  "Грады — валюта платформы. Название от градиентного спуска: каждый шаг обучения приближает к минимуму.":
    "Grads are the platform currency. The name comes from gradient descent: every learning step brings you closer to the minimum.",
  "Назад к профилю": "Back to profile",
  "Грады и витрина доступны ученикам на менторстве: с куратором, отчётами и подгруппой. Если хочешь перейти на менторство — напиши ментору.":
    "Grads and the shop are available to mentorship students — with a curator, reports and a subgroup. Want to switch to mentorship? Message your mentor.",
  "На счёте": "Balance",
  Итоги: "Totals",
  "Вопросы, тесты, отчёты, карточки, серия и достижения":
    "Questions, tests, reports, cards, streak and achievements",
  "За учёбу": "From learning",
  "Бонусы за приведённых учеников": "Bonuses for students you referred",
  "За рефералов": "From referrals",
  Потрачено: "Spent",
  "Ученики, которых ты привёл на менторство — за каждого начислен бонус":
    "Students you brought to mentorship — you get a bonus for each one",
  "Приведено учеников": "Students referred",
  "Купленные заморозки сверх двух месячных":
    "Purchased streak freezes on top of the two monthly ones",
  "Заморозок в запасе": "Streak freezes in stock",
  "Множитель сейчас · дни серии": "Current multiplier · streak days",
  "Шкала множителя за серию": "Streak multiplier scale",
  "Спуск по серии": "Streak descent",
  "Каждый рубеж серии — точка на кривой потерь. Дошёл до рубежа — рубеж оплачен, один раз и навсегда. Серию держат отчёты и решённые вопросы; две заморозки в месяц прощают пропуск.":
    "Each streak milestone is a point on the loss curve. Reach a milestone and it pays out — once and for all. Reports and solved questions keep the streak going; two freezes a month forgive a missed day.",
  "Кривая потерь с рубежами серии: 7, 14, 30, 60, 100, 200 и 365 дней.":
    "Loss curve with streak milestones: 7, 14, 30, 60, 100, 200 and 365 days.",
  Ставки: "Rates",
  "Базовая ставка умножается на множитель за серию и регулярные отчёты. Справа в каждой карточке — сколько это даёт при твоём множителе прямо сейчас.":
    "The base rate is multiplied by your streak and regular-report multiplier. The right side of each card shows what it's worth at your multiplier right now.",
  "За достижения — фиксированно, по тиру":
    "Achievements pay a fixed amount by tier",
  Витрина: "Shop",
  Корзина: "Cart",
  "Пока пусто. Добавь награду из витрины.":
    "Nothing here yet. Add a reward from the shop.",
  Итого: "Total",
  Останется: "Remaining",
  "Оформить заказ": "Place order",
  Заказы: "Orders",
  "Грады списываются при оформлении. Ментор получает уведомление в Telegram и передаёт награду; отменённый заказ возвращает грады.":
    "Grads are deducted when you place an order. Your mentor gets a Telegram notification and hands over the reward; a cancelled order refunds your grads.",
  "Загружаем заказы…": "Loading orders…",
  История: "History",
  "Последние 50 начислений и списаний по московскому времени.":
    "Last 50 credits and debits, Moscow time.",
  "Загружаем историю…": "Loading history…",
  // wallet-page.js
  "Изучены вопросы": "Questions studied",
  "Сдан тест": "Test passed",
  "Тест на 100%": "Test at 100%",
  "Сдан тест блока": "Block test passed",
  "Ежедневный отчёт": "Daily report",
  "Отчёт о выходном": "Day-off report",
  "Повторение карточек": "Card review",
  "Бонус за повторение": "Review bonus",
  "Рубеж серии": "Streak milestone",
  "Стартовое начисление за прошлую активность":
    "Starting credit for past activity",
  "Начисление персоналом": "Credited by staff",
  "Списание за покупку": "Purchase debit",
  "Заказ из витрины": "Shop order",
  "Возврат за отменённый заказ": "Refund for a cancelled order",
  "Приведённый ученик": "Referred student",
  "Ждёт выдачи": "Awaiting delivery",
  Выдан: "Delivered",
  Отменён: "Cancelled",
  "Серия {streak} даёт {factor}, до {next} — ещё {left}.":
    "A streak of {streak} gives {factor}; {left} more to reach {next}.",
  "Серия {streak} даёт {factor} — это максимум.":
    "A streak of {streak} gives {factor} — that's the maximum.",
  "Отчёты регулярные: {bonus} сверху.": "Regular reports: {bonus} on top.",
  "Отчётов за 7 дней: {count}. Дотяни — и получишь ещё +{bonus}.":
    "Reports in the last 7 days: {count}. Get there and you'll earn another +{bonus}.",
  "{done} из {needed}": "{done} of {needed}",
  "ты · {days}": "you · {days}",
  "дни серии →": "streak days →",
  "Один раз за каждый вопрос": "Once per question",
  "Пересдачи бесплатны": "Retakes are free",
  "Сверх ставки за сдачу": "On top of the pass rate",
  "Один раз за каждый блок, без множителя": "Once per block, no multiplier",
  "Один отчёт в день": "One report per day",
  "Вместо обычного отчёта": "Instead of a regular report",
  "Не больше {count} карточек в день": "Up to {count} cards per day",
  "От {count} карточек за день": "From {count} cards in a day",
  "Один раз за каждого, кого ты привёл на менторство":
    "Once for each person you bring to mentorship",
  "Раз в день, кнопка на главной": "Once a day, button on the home page",
  умножается: "multiplied",
  фикс: "fixed",
  "Изучен вопрос": "Question studied",
  "Сдан тест (первый раз)": "Test passed (first time)",
  "Тест на 100% (первый раз)": "Test at 100% (first time)",
  "Сдан тест блока (первый раз)": "Block test passed (first time)",
  "Карточка теорминимума (до 30 в день)": "Theory card (up to 30 per day)",
  "10 и больше карточек за день": "10 or more cards in a day",
  Достижение: "Achievement",
  "Баланс ещё не загружен.": "Balance hasn't loaded yet.",
  "Не хватает {amount}.": "You're {amount} short.",
  "Оформляем заказ…": "Placing order…",
  "Готово: списано {amount}, заморозки уже в запасе.":
    "Done: {amount} deducted, streak freezes are already in stock.",
  "Заказ оформлен: списано {amount}. Ментор получит уведомление.":
    "Order placed: {amount} deducted. Your mentor will be notified.",
  "Не удалось оформить заказ.": "Couldn't place the order.",
  "Витрина пока пуста.": "The shop is empty for now.",
  Хватает: "Enough",
  "Накоплено {pct}% · не хватает {amount}": "{pct}% saved · {amount} to go",
  "Количество: {title}": "Quantity: {title}",
  "Убрать одну": "Remove one",
  "Добавить ещё": "Add one more",
  "В корзину": "Add to cart",
  "Накоплено на «{title}»": "Saved toward “{title}”",
  "Заказов пока не было.": "No orders yet.",
  Заказ: "Order",
  "{label}: {count} карт.": "{label}: {count} cards",
  Вчера: "Yesterday",
  "Пока пусто. Отметь вопрос, пройди тест или повтори карточки — первые грады появятся здесь.":
    "Nothing here yet. Mark a question, take a test or review cards — your first grads will show up here.",
  персонал: "staff",
  "Не удалось загрузить настройки кошелька. Обновите страницу.":
    "Couldn't load wallet settings. Reload the page.",
  "Заказы недоступны. Попробуйте позже.":
    "Orders are unavailable. Try again later.",
  "История недоступна. Попробуйте позже.":
    "History is unavailable. Try again later.",
  // Витрина (wallet-config.json). Описания коробок и книги содержимое не
  // раскрывают намеренно — сюрприз и есть награда.
  "Положи награды в корзину и оформи заказ: грады спишутся сразу. Заморозки серии зачисляются мгновенно, остальное передаст ментор — он получит уведомление в Telegram.":
    "Put rewards in your cart and place an order: grads are deducted right away. Streak freezes are added instantly; your mentor hands over everything else and gets a Telegram notification.",
  "Заморозка серии": "Streak freeze",
  "Запасная заморозка сверх двух месячных: сработает ночью на пропущенный день, когда месячные кончились.":
    "A spare freeze on top of the two monthly ones: it kicks in overnight for a missed day once the monthly ones run out.",
  "Мини-коробка": "Mini box",
  "Небольшая посылка-сюрприз от ментора. Что внутри — узнаешь, когда откроешь. Отправим почтой.":
    "A small surprise package from your mentor. You'll find out what's inside when you open it. Sent by mail.",
  "Telegram Premium на месяц": "Telegram Premium for a month",
  "Подарок в Telegram от ментора: стикеры, реакции и без рекламы.":
    "A Telegram gift from your mentor: stickers, reactions and no ads.",
  "Скидка 10% на следующий месяц": "10% off next month",
  "Скидка на следующий месяц менторства. Один заказ — одна скидка.":
    "A discount on your next month of mentorship. One order — one discount.",
  "Книга в твёрдом переплёте": "Hardcover book",
  "Книга по машинному обучению с полки ментора. Какая именно — узнаешь при получении. Отправим почтой.":
    "A machine learning book from your mentor's shelf. You'll find out which one when it arrives. Sent by mail.",
  "Легендарная коробка": "Legendary box",
  "Главная награда витрины, цель на год. Что внутри — секрет до самой распаковки. Отправим почтой.":
    "The shop's top reward, a goal for the year. What's inside stays secret until you unbox it. Sent by mail.",
  // achievements.html, achievements-page.js
  "Мои достижения": "My achievements",
  "Отслеживай свой прогресс и получай награды":
    "Track your progress and earn rewards",
  Все: "All",
  Регулярность: "Consistency",
  Объём: "Volume",
  Особые: "Special",
  Скидки: "Discounts",
  "Тиры достижений и награда в градах": "Achievement tiers and grad rewards",
  "Тир достижения и награда в градах": "Achievement tier and grad reward",
  "Получено: {date}": "Earned: {date}",
  "Ещё не получено": "Not earned yet",
  "Не удалось загрузить достижения. Попробуйте обновить страницу.":
    "Couldn't load achievements. Try reloading the page.",
  // Каталог достижений (assets/data/achievements/catalog.json)
  "Дорогой дневник..": "Dear diary..",
  "Отправил первый отчёт": "Sent your first report",
  "Три дня подряд": "Three days in a row",
  "3 дня подряд с активностью": "Active 3 days in a row",
  "Семь к ряду": "Seven straight",
  "7 дней подряд с активностью": "Active 7 days in a row",
  "Две недели подряд": "Two weeks in a row",
  "14 дней подряд с активностью": "Active 14 days in a row",
  Летописец: "Chronicler",
  "30 дней подряд с активностью": "Active 30 days in a row",
  "Два месяца подряд": "Two months in a row",
  "60 дней подряд с активностью": "Active 60 days in a row",
  Дюжина: "A dozen",
  "Отправил 12 отчётов": "Sent 12 reports",
  "Продуктивная неделя": "Productive week",
  "7 отчётов за неделю": "7 reports in a week",
  "Ранняя пташка": "Early bird",
  "Отправил отчёт до 9:00": "Sent a report before 9:00",
  "Буллет-мастер": "Bullet master",
  "Использовал списки в 5 отчётах подряд": "Used lists in 5 reports in a row",
  "Первое знакомство": "First encounter",
  "Прошёл онбординг-тур при первом входе":
    "Completed the onboarding tour on first sign-in",
  Камбек: "Comeback",
  "Вернулся к работе после пропуска и держал 7 дней подряд":
    "Came back after a break and kept going 7 days in a row",
  "Работа кипит": "Hard at work",
  "Сделал отчёты и в субботу, и в воскресенье":
    "Sent reports on both Saturday and Sunday",
  Сова: "Night owl",
  "Отчёт после 22:00": "Report after 22:00",
  "Ланч-тайм": "Lunchtime",
  "Отправил отчёт с 12:00 до 14:00": "Sent a report between 12:00 and 14:00",
  Пунктуальный: "Punctual",
  "90% отчетов отправлено до личного дедлайна 7 дней подряд":
    "90% of reports sent before your personal deadline 7 days in a row",
  "В уходящий поезд": "Just in time",
  "Отправил отчёт в последние 10 минут дедлайна":
    "Sent a report in the last 10 minutes before the deadline",
  "Хайку-мастер": "Haiku master",
  "Написал отчёт из трёх строк по 5/7/5 слов":
    "Wrote a three-line report with 5/7/5 words",
  Лаконичность: "Brevity",
  "Уместил отчёт в одну ёмкую строку": "Fit a report into one punchy line",
  "Заряд кофеина": "Caffeine boost",
  "Три отчёта за день (и всё ещё бодр)":
    "Three reports in a day (and still going strong)",
  "Первый в месяце": "First of the month",
  "Сделал отчёт 1-го числа": "Sent a report on the 1st",
  "Закрыл месяц": "Month closed",
  "Отправил отчёт в последний день месяца":
    "Sent a report on the last day of the month",
  "С чистого листа": "Clean slate",
  "Отчёт 1 января": "Report on January 1",
  "Консистентность — бронза": "Consistency — bronze",
  "В месяце ≥ 7 дней с отчётами": "≥ 7 days with reports in a month",
  "Консистентность — серебро": "Consistency — silver",
  "В месяце ≥ 15 дней с отчётами": "≥ 15 days with reports in a month",
  "Консистентность — золото": "Consistency — gold",
  "В месяце ≥ 23 дней с отчётами": "≥ 23 days with reports in a month",
  "Первый вопрос": "First question",
  "Решил первый вопрос": "Solved your first question",
  "Десятка вопросов": "Ten questions",
  "Решил 10 вопросов": "Solved 10 questions",
  "Полсотни вопросов": "Fifty questions",
  "Решил 50 вопросов": "Solved 50 questions",
  "Сотня вопросов": "A hundred questions",
  "Решил 100 вопросов": "Solved 100 questions",
  "Две сотни": "Two hundred",
  "Решил 200 вопросов": "Solved 200 questions",
  "Решил 300 вопросов": "Solved 300 questions",
  "Python: новичок": "Python: beginner",
  "Решил более 10% вопросов по Python": "Solved over 10% of Python questions",
  "Python: продвинутый": "Python: advanced",
  "Решил более 70% вопросов по Python": "Solved over 70% of Python questions",
  "Python: гуру": "Python: guru",
  "Решил 100% вопросов по Python": "Solved 100% of Python questions",
  "Математик: новичок": "Mathematician: beginner",
  "Решил более 10% вопросов по математике": "Solved over 10% of math questions",
  "Математик: продвинутый": "Mathematician: advanced",
  "Решил более 70% вопросов по математике": "Solved over 70% of math questions",
  "Математик: гуру": "Mathematician: guru",
  "Решил 100% вопросов по математике": "Solved 100% of math questions",
  "Classic ML: новичок": "Classic ML: beginner",
  "Решил более 10% вопросов по ML": "Solved over 10% of ML questions",
  "Classic ML: продвинутый": "Classic ML: advanced",
  "Решил более 70% вопросов по ML": "Solved over 70% of ML questions",
  "Classic ML: гуру": "Classic ML: guru",
  "Решил 100% вопросов по ML": "Solved 100% of ML questions",
  "DL: новичок": "DL: beginner",
  "Решил более 10% вопросов по Deep Learning":
    "Solved over 10% of Deep Learning questions",
  "DL: продвинутый": "DL: advanced",
  "Решил более 70% вопросов по Deep Learning":
    "Solved over 70% of Deep Learning questions",
  "DL: гуру": "DL: guru",
  "Решил 100% вопросов по Deep Learning":
    "Solved 100% of Deep Learning questions",
  "NLP: новичок": "NLP: beginner",
  "Решил более 10% вопросов по NLP": "Solved over 10% of NLP questions",
  "NLP: продвинутый": "NLP: advanced",
  "Решил более 70% вопросов по NLP": "Solved over 70% of NLP questions",
  "NLP: гуру": "NLP: guru",
  "Решил 100% вопросов по NLP": "Solved 100% of NLP questions",
  "CV: новичок": "CV: beginner",
  "Решил более 10% вопросов по Computer Vision":
    "Solved over 10% of Computer Vision questions",
  "CV: продвинутый": "CV: advanced",
  "Решил более 70% вопросов по Computer Vision":
    "Solved over 70% of Computer Vision questions",
  "CV: гуру": "CV: guru",
  "Решил 100% вопросов по Computer Vision":
    "Solved 100% of Computer Vision questions",
  "Git: новичок": "Git: beginner",
  "Решил более 10% вопросов по Git/GitHub":
    "Solved over 10% of Git/GitHub questions",
  "Git: продвинутый": "Git: advanced",
  "Решил более 70% вопросов по Git/GitHub":
    "Solved over 70% of Git/GitHub questions",
  "Git: гуру": "Git: guru",
  "Решил 100% вопросов по Git/GitHub": "Solved 100% of Git/GitHub questions",
  "Linux: новичок": "Linux: beginner",
  "Решил более 10% вопросов по Linux": "Solved over 10% of Linux questions",
  "Linux: продвинутый": "Linux: advanced",
  "Решил более 70% вопросов по Linux": "Solved over 70% of Linux questions",
  "Linux: гуру": "Linux: guru",
  "Решил 100% вопросов по Linux": "Solved 100% of Linux questions",
  "Docker: новичок": "Docker: beginner",
  "Решил более 10% вопросов по Docker": "Solved over 10% of Docker questions",
  "Docker: продвинутый": "Docker: advanced",
  "Решил более 70% вопросов по Docker": "Solved over 70% of Docker questions",
  "Docker: гуру": "Docker: guru",
  "Решил 100% вопросов по Docker": "Solved 100% of Docker questions",
  "Собеседования: новичок": "Interviews: beginner",
  "Решил более 10% вопросов с собеседований":
    "Solved over 10% of interview questions",
  "Собеседования: продвинутый": "Interviews: advanced",
  "Решил более 70% вопросов с собеседований":
    "Solved over 70% of interview questions",
  "Мастер на все руки": "Jack of all trades",
  "Решил вопросы из 5 разных категорий":
    "Solved questions from 5 different categories",
  "Едем дальше": "Moving on",
  "Решил 100% вопросов в одной категории":
    "Solved 100% of questions in one category",
  Полимат: "Polymath",
  "Решил 100% вопросов в 3 категориях":
    "Solved 100% of questions in 3 categories",
  Грандмастер: "Grandmaster",
  "Всё порешал": "Solved everything",
  Решала: "Fixer",
  "Преодолел 85% материала и прошел все тесты на 100%: -1.5% к постоплате":
    "Covered 85% of the material and passed every quiz at 100%: -1.5% off the deferred payment",
  "Самая быстрая рука на диком западе": "Fastest gun in the West",
  "Получил оффер менее, чем за 2 месяца: -3% к постоплате":
    "Got an offer in under 2 months: -3% off the deferred payment",
  "Первый тест": "First quiz",
  "Прошел первый тест": "Passed your first quiz",
  Тестировщик: "Quiz taker",
  "Прошел 5 тестов": "Passed 5 quizzes",
  "Получил 100% в тесте": "Scored 100% on a quiz",
  "Стабильный результат": "Steady results",
  "Получил 90%+ в 5 тестах подряд": "Scored 90%+ on 5 quizzes in a row",
  Спидран: "Speedrun",
  "Прошел тест менее чем за половину отведенного времени":
    "Finished a quiz in under half the allotted time",
  "Повторенье - мать учения": "Practice makes perfect",
  "Прошел один тест 5 раз": "Took the same quiz 5 times",
  "Специалист по категории": "Category specialist",
  "Прошел все тесты в одной категории": "Passed every quiz in one category",
  "Коллекционер тестов": "Quiz collector",
  "Прошел тесты из 5 разных категорий":
    "Passed quizzes from 5 different categories",
  "Мастер тестов": "Quiz master",
  "Получил 100% во всех тестах": "Scored 100% on every quiz",
  "На связи": "Staying in touch",
  "Отправил 25 принятых отчётов": "Sent 25 accepted reports",
  Полсотни: "Fifty",
  "Отправил 50 принятых отчётов": "Sent 50 accepted reports",
  "Сотня в деле": "A hundred strong",
  "Отправил 100 принятых отчётов": "Sent 100 accepted reports",
  "Стальная привычка": "Iron habit",
  "100 дней непрерывной активности": "100 days of continuous activity",
  "Ритм недели": "Weekly rhythm",
  "Был активен 5 дней за последние 7 дней": "Active 5 of the last 7 days",
  "Ранний старт": "Early start",
  "Семь отчётов до 09:00": "Seven reports before 09:00",
  "Выходные в деле": "Weekend warrior",
  "Три полных активных уикенда": "Three fully active weekends",
  "Глубокое погружение": "Deep dive",
  "Завершил 90% одной доступной темы": "Completed 90% of one available topic",
  "Идеальная тройка": "Perfect three",
  "Получил 100% в трёх разных квизах": "Scored 100% on three different quizzes",
  "Уверенный результат": "Solid results",
  "Получил 90%+ в квизах трёх тем": "Scored 90%+ on quizzes in three topics",
  "Первый повтор": "First review",
  "Повторил первую карточку теорминимума": "Reviewed your first theory card",
  "Полсотни карточек": "Fifty cards",
  "Повторил 50 разных карточек": "Reviewed 50 different cards",
  "Двести пятьдесят": "Two hundred fifty",
  "Повторил 250 разных карточек": "Reviewed 250 different cards",
  "Тысяча карточек": "A thousand cards",
  "Повторил 1000 разных карточек": "Reviewed 1000 different cards",
  "Отложенная память": "Stored memory",
  "25 карточек ушли в долгую память: три повтора и интервал от недели":
    "25 cards moved to long-term memory: three reviews and an interval of a week or more",
  "Долгая память": "Long-term memory",
  "100 карточек в долгой памяти": "100 cards in long-term memory",
  "Месяц до следующего показа": "A month until next review",
  "Довёл карточку до интервала в 30 дней":
    "Brought a card to a 30-day interval",
  "Неделя повторений": "Week of reviews",
  "Повторял карточки в 7 разных дней": "Reviewed cards on 7 different days",
  "Тридцать дней повторений": "Thirty days of reviews",
  "Повторял карточки в 30 разных дней": "Reviewed cards on 30 different days",
  "Повторение по всем фронтам": "Reviews on every front",
  "Повторял карточки из пяти разных разделов":
    "Reviewed cards from five different sections",
  "Как по маслу": "Smooth sailing",
  "50 карточек закрыты оценкой «Легко»": "50 cards rated “Easy”",

  // (конец секции wallet)

  // ── Профиль (profile.html, profile/*) ──
  // @i18n-section:profile — переводы этой группы дописываются сразу под этой строкой.
  "Не удалось загрузить фото": "Upload failed",
  "Завершить сессию": "End session",
  "На счёте:": "Balance:",
  // profile.html
  "Все для отслеживания прогресса": "Everything to track your progress",
  "На главную": "Home",
  Основное: "Essentials",
  "Просмотр и прохождение тестов по разным разделам":
    "Browse and take quizzes across sections",
  "Посмотреть тесты": "View quizzes",
  "Просмотр и составление ежедневных отчетов": "View and write daily reports",
  "Посмотреть отчеты": "View reports",
  "Обратная связь": "Feedback",
  "Просмотр обратной связи от ментора и вопросов для следующего созвона":
    "Feedback from your mentor and questions for the next call",
  "Посмотреть обратную связь": "View feedback",
  "Карточки по теоретическому минимуму из изученных вопросов":
    "Theory-minimum cards from the questions you've studied",
  "Открыть карточки": "Open cards",
  ". Грады — валюта платформы: за вопросы, тесты, карточки, отчёты и серию дней.":
    ". Grads are the platform currency: earned for questions, quizzes, cards, reports and streaks.",
  "Открыть кошелёк": "Open wallet",
  "Прогресс по курсу": "Course progress",
  "0% изучено": "0% studied",
  "{percent}% изучено": "{percent}% studied",
  "Прогресс по разделам": "Progress by section",
  "Просмотр ваших достижений": "View your achievements",
  "Посмотреть достижения": "View achievements",
  Офферы: "Offers",
  "Внеси информацию о полученных офферах, отслеживай полученные предложения":
    "Record the offers you've received and keep track of them",
  "Посмотреть офферы": "View offers",
  Настройки: "Settings",
  Уведомления: "Notifications",
  "Комментарии ментора, события и важные обновления":
    "Mentor comments, events and important updates",
  "Открыть уведомления": "Open notifications",
  Безопасность: "Security",
  "Активные сессии, история входов и выход на всех устройствах":
    "Active sessions, sign-in history and signing out everywhere",
  "Открыть сессии": "Open sessions",
  "Изменение имени, статуса и управление учетной записью":
    "Change your name and status, manage your account",
  "Открыть настройки": "Open settings",
  "Ошибка загрузки зависимостей. Попробуйте обновить страницу.":
    "Failed to load dependencies. Try reloading the page.",

  // profile/progress.html
  "Теперь ваш прогресс отображается прямо в карте разделов.":
    "Your progress is now shown right on the section map.",
  "Вся карта в одном месте": "The whole map in one place",
  "Каждая учебная карточка показывает, сколько вопросов вы уже изучили, и обновляется после изменения прогресса.":
    "Each study card shows how many questions you've studied and updates as your progress changes.",
  "Открыть карту разделов": "Open the section map",

  // profile/sessions.html
  "Устройства, с которых открыт ваш аккаунт, и история входов.":
    "Devices signed in to your account, and your sign-in history.",
  "Активные сессии": "Active sessions",
  "При входе с нового устройства мы отправляем на вашу почту код подтверждения. Увидели незнакомое устройство — завершите его сессию и смените пароль.":
    "When you sign in from a new device, we email you a confirmation code. See a device you don't recognize? End its session and change your password.",
  "Загружаем…": "Loading…",
  "Выйти на всех устройствах": "Sign out on all devices",
  "История входов": "Sign-in history",
  "Все активные сессии платформы": "All active sessions on the platform",
  "💻 Компьютер": "💻 Computer",
  "📱 Смартфон": "📱 Smartphone",
  "📱 Планшет": "📱 Tablet",
  "Это устройство": "This device",
  неизвестен: "unknown",
  "вход {date}": "signed in {date}",
  "активность {date}": "active {date}",
  "код не введён": "code not entered",
  "завершена {date}": "ended {date}",
  Завершить: "Finish",
  "Активных сессий: {total}, пользователей: {users}. Метка ×N — столько устройств открыто у одного аккаунта.":
    "Active sessions: {total}, users: {users}. The ×N badge shows how many devices one account has open.",
  "Не удалось загрузить сессии платформы: {error}":
    "Couldn't load platform sessions: {error}",
  "Выйти на всех устройствах, включая это? При следующем входе понадобится код из письма.":
    "Sign out on all devices, including this one? You'll need the emailed code next time you sign in.",
  "Не удалось загрузить сессии. Обновите страницу.":
    "Couldn't load sessions. Reload the page.",

  // activity-grid.js (сетка активности в профиле)
  Пн: "Mon",
  Ср: "Wed",
  Пт: "Fri",
  Янв: "Jan",
  Фев: "Feb",
  Мар: "Mar",
  Апр: "Apr",
  Май: "May",
  Июн: "Jun",
  Июл: "Jul",
  Авг: "Aug",
  Сен: "Sep",
  Окт: "Oct",
  Ноя: "Nov",
  Дек: "Dec",
  Активность: "Activity",
  "Отчеты и решенные вопросы за последние {weeks} недель":
    "Reports and solved questions over the last {weeks} weeks",
  "дней streak": "day streak",
  "Календарь активности": "Activity calendar",
  "будущий день": "future day",
  "Легенда активности": "Activity legend",
  Меньше: "Less",
  Больше: "More",
  "Не удалось загрузить пользователя.": "Couldn't load the user.",
  "Не удалось загрузить активность.": "Couldn't load activity.",

  // profile/notifications.html
  "Система просмотра уведомлений: новые задания, мок-собесы и встречи, комментарии к заданиям":
    "All your notifications: new assignments, mock interviews, meetings and assignment comments",
  "Уведомления в Telegram": "Telegram notifications",
  "Проверяем привязку…": "Checking the connection…",
  "Присылать уведомления в бот": "Send notifications to the bot",
  "Дедлайны и просрочки по доске задач":
    "Task board deadlines and overdue tasks",
  "Новые задания, встречи и мок-собесы":
    "New assignments, meetings and mock interviews",
  "Напоминание отправить дневной отчёт": "Reminder to send your daily report",
  "Еженедельный дайджест прогресса": "Weekly progress digest",
  "🔔 Уведомления": "🔔 Notifications",
  Комментарии: "Comments",
  События: "Events",
  Дедлайны: "Deadlines",
  "👁️ Показать ещё уведомления": "👁️ Show more notifications",
  "У вас пока нет уведомлений": "You have no notifications yet",
  "Здесь будут появляться комментарии от ментора, новые задания и встречи":
    "Mentor comments, new assignments and meetings will show up here",
  "Загружаем уведомления...": "Loading notifications...",
  "✓ Отметить все как прочитанные": "✓ Mark all as read",
  "до {date}": "due {date}",
  Комментарий: "Comment",
  Просрочено: "Overdue",
  "Дедлайн сегодня": "Due today",
  Задание: "Assignment",
  Встреча: "Meeting",
  "Мок-собес": "Mock interview",
  Событие: "Event",
  "Только что": "Just now",
  "{count} мин назад": "{count} min ago",
  "{count} ч назад": "{count} h ago",
  "{count} дн назад": "{count} d ago",
  "Telegram пока не привязан": "Telegram isn't connected yet",
  "Привязка происходит автоматически, когда ментор выдаёт доступ через {bot}. Если бот у вас уже есть, а привязки нет — напишите ментору.":
    "It connects automatically when your mentor grants access via {bot}. If you already have the bot but it isn't connected, message your mentor.",
  "Telegram привязан — уведомления приходят в @schmidtml_bot":
    "Telegram is connected — notifications go to @schmidtml_bot",
  "Дедлайны приходят одним дайджестом утром, напоминание об отчёте — вечером.":
    "Deadlines arrive as one digest in the morning, the report reminder in the evening.",
  "Настройки сохранены.": "Settings saved.",
  "Не удалось сохранить настройку. Попробуйте ещё раз.":
    "Couldn't save the setting. Please try again.",

  // profile/offers.html
  "Просмотр полученных офферов": "Your offers",
  "💼 Мои офферы": "💼 My offers",
  Добавить: "Add",
  "Добавь информацию о полученных офферах для отслеживания прогресса":
    "Add the offers you've received to track your progress",
  "Пока нет добавленных офферов": "No offers added yet",
  Изменить: "Edit",
  Удалить: "Delete",
  "Вы уверены, что хотите удалить этот оффер?":
    "Are you sure you want to delete this offer?",
  "Редактировать оффер": "Edit offer",
  "Добавить оффер": "Add offer",
  "Оффер появится в профиле и в истории твоего пути на платформе.":
    "The offer will appear in your profile and in your journey history on the platform.",
  Компания: "Company",
  "Укажи компанию": "Enter the company",
  Должность: "Position",
  "Укажи должность": "Enter the position",
  Зарплата: "Salary",
  "Как в оффере: сумма, валюта, gross или net":
    "As stated in the offer: amount, currency, gross or net",
  "Укажи зарплату": "Enter the salary",
  "Дата оффера": "Offer date",
  "Укажи дату": "Enter the date",
  Заметки: "Notes",
  "Условия, стек, что понравилось на собесе, сроки ответа…":
    "Terms, stack, what you liked in the interview, response deadlines…",
  "Необязательно. Поддерживается Markdown: списки, {code}, {bold}":
    "Optional. Markdown is supported: lists, {code}, {bold}",
  код: "code",
  жирный: "bold",
  "Предварительный просмотр:": "Preview:",
  "Сохраняем…": "Saving…",
  "Не удалось сохранить. Попробуй ещё раз.": "Couldn't save. Please try again.",
  "Ошибка при удалении оффера": "Failed to delete the offer",

  // profile/settings.html
  "← Профиль": "← Profile",
  "Изменить фото профиля": "Change profile photo",
  "Имя и фамилия": "First and last name",
  Имя: "First name",
  Фамилия: "Last name",
  "Например: @username (от 4 символов)":
    "For example: @username (4+ characters)",
  "Email используется для входа и не может быть изменён":
    "Your email is used to sign in and can't be changed",
  "Статус (достижение)": "Status (achievement)",
  "Выберите достижение": "Choose an achievement",
  "Выбрать достижение": "Choose achievement",
  "Очистить статус": "Clear status",
  "Выберите достижение, которое будет отображаться рядом с вашим именем":
    "Choose an achievement to display next to your name",
  Подгруппа: "Subgroup",
  "Не выбрана": "Not selected",
  "Выберите подгруппу в зависимости от этапа обучения":
    "Choose a subgroup based on your learning stage",
  "Сохранить изменения": "Save changes",
  "Очистить прогресс": "Clear progress",
  "Введите корректное имя (только буквы, 2–20 символов)":
    "Enter a valid first name (letters only, 2–20 characters)",
  "Введите корректную фамилию (только буквы, 2–20 символов)":
    "Enter a valid last name (letters only, 2–20 characters)",
  "Telegram: @username от 5 символов, только буквы/цифры/подчёркивание":
    "Telegram: @username of 5+ characters, letters/digits/underscores only",
  "Модуль загрузки недоступен": "Upload module unavailable",
  "Сначала войдите в аккаунт": "Sign in to your account first",
  "Фото обновлено": "Photo updated",
  "Ошибка загрузки": "Loading error",
  "Сохранение...": "Saving...",
  "Ошибка: база данных не инициализирована. Попробуйте обновить страницу.":
    "Error: the database isn't initialized. Try reloading the page.",
  "Вы уверены, что хотите очистить весь прогресс? Это действие нельзя отменить.":
    "Are you sure you want to clear all progress? This can't be undone.",
  "Прогресс успешно очищен!": "Progress cleared!",
  "Ошибка при очистке прогресса": "Failed to clear progress",
  "Ошибка сохранения профиля": "Failed to save profile",
  "Система достижений недоступна. Попробуйте обновить страницу.":
    "The achievement system is unavailable. Try reloading the page.",
  "Необходимо войти в систему": "You need to sign in",
  "У вас пока нет разблокированных достижений. Решайте вопросы, чтобы получить достижения!":
    "You haven't unlocked any achievements yet. Solve questions to earn them!",
  "Выберите достижение для статуса": "Choose an achievement for your status",
  Выбрать: "Choose",
  "Ошибка при загрузке достижений. Попробуйте обновить страницу.":
    "Failed to load achievements. Try reloading the page.",
  "Ошибка при сохранении выбранного достижения. Попробуйте еще раз.":
    "Failed to save the selected achievement. Please try again.",
  "Ошибка инициализации системы достижений. Попробуйте обновить страницу.":
    "Failed to initialize the achievement system. Try reloading the page.",
  "Вы уверены, что хотите очистить статус достижения?":
    "Are you sure you want to clear your achievement status?",
  "Ошибка при очистке статуса": "Failed to clear status",

  // profile/feedbacks.html
  "Просмотр и работа с обратной связью от ментора":
    "View and work with feedback from your mentor",
  "Добавить фидбек": "Add feedback",
  "Фильтр по ученикам": "Filter by student",
  "Только мои ученики": "My students only",
  "Показывать фидбеки и списки только назначенных мне учеников":
    "Show feedback and lists only for students assigned to me",
  "Поиск по ФИО": "Search by name",
  "Начните вводить имя ученика": "Start typing a student's name",
  "Выбрать из списка": "Pick from the list",
  "Все ученики": "All students",
  "Все мои ученики": "All my students",
  "Редактировать обратную связь": "Edit feedback",
  "Название фидбека:": "Feedback title:",
  "Например: Сбер 25.11.2025": "For example: Sber 25.11.2025",
  "Название поможет быстро найти нужный фидбек":
    "A title helps you find the right feedback quickly",
  "Настоящее собеседование": "Real interview",
  "Например, Сбер": "For example, Sber",
  "Выберите компанию из списка или введите новую.":
    "Pick a company from the list or enter a new one.",
  "HR-собеседование": "HR interview",
  "Отметьте, если это скрининг с рекрутёром: тогда вопросы из секции «Вопросы интервьюера и ответы» попадут в банк как HR-вопросы, а не как технические.":
    "Check this if it's a recruiter screening: questions from the «Вопросы интервьюера и ответы» section will go to the bank as HR questions, not technical ones.",
  "Содержание фидбека:": "Feedback content:",
  Используйте: "Use",
  "для разделения секций,": "to separate sections,",
  "для отдельных вопросов внутри секции,":
    "for individual questions within a section,",
  "как разделитель между вопросами.": "as a separator between questions.",
  "Секции:": "Sections:",
  "Создать обратную связь": "Create feedback",
  "Выберите ученика:": "Choose a student:",
  "Загрузка...": "Loading...",
  Создать: "Create",
  "Выберите ученика...": "Choose a student...",
  "Укажите компанию для настоящего собеседования":
    "Enter the company for a real interview",
  "Пока нет обратной связи": "No feedback yet",
  "Обратная связь от ментора будет отображаться здесь":
    "Feedback from your mentor will appear here",
  "Загрузить ещё ({count})": "Load more ({count})",
  "Показано {shown} из {total}": "Showing {shown} of {total}",
  "Загрузка обратной связи...": "Loading feedback...",
  "Не удалось загрузить следующую страницу обратной связи.":
    "Couldn't load the next page of feedback.",
  "Ошибка загрузки обратной связи": "Failed to load feedback",
  "HR-собес": "HR interview",
  "Мок HR": "Mock HR",
  "Тех. собес": "Tech interview",
  Мок: "Mock",
  "Компания: {company}": "Company: {company}",
  "✓ Прочитано": "✓ Read",
  "● Не прочитано": "● Unread",
  "Обратная связь не найдена": "Feedback not found",
  "Обратная связь: {student}": "Feedback: {student}",
  "✓ Отметить прочитанным": "✓ Mark as read",
  "✏️ Редактировать": "✏️ Edit",
  "🗑️ Удалить": "🗑️ Delete",
  "Заполните хотя бы один раздел обратной связи":
    "Fill in at least one feedback section",
  "Обратная связь успешно обновлена!": "Feedback updated!",
  "Ошибка при обновлении обратной связи": "Failed to update feedback",
  "Вы уверены, что хотите удалить эту обратную связь? Это действие нельзя отменить.":
    "Are you sure you want to delete this feedback? This can't be undone.",
  "Обратная связь успешно удалена!": "Feedback deleted!",
  "Ошибка при удалении обратной связи": "Failed to delete feedback",
  Ученик: "Student",
  "Ошибка при отметке как прочитанного": "Failed to mark as read",
  "Нет учеников": "No students",
  "Выберите ученика": "Choose a student",
  "Создание...": "Creating...",
  "Обратная связь успешно создана!": "Feedback created!",
  "Ошибка при создании обратной связи": "Failed to create feedback",

  // (конец секции profile)

  // ── Общие виджеты (rag-chat, gamification, notifications, daily-reports, daily-fact, intro-tour, command-palette, news-panel, achievement-notifications) ──
  // @i18n-section:widgets — переводы этой группы дописываются сразу под этой строкой.
  // news-panel, notifications, intro-tour
  Свернуть: "Collapse",
  Развернуть: "Expand",
  "Загрузка новостей...": "Loading news...",
  Новость: "News",
  "Новости недоступны": "News unavailable",
  "Попробуйте позже": "Try again later",
  "Не удалось загрузить новости. Проверьте подключение к интернету или попробуйте позже.":
    "Couldn't load the news. Check your internet connection or try again later.",
  "Открыть полную страницу новостей": "Open the full news page",
  "Комментарий от {name} ({time})": "Comment from {name} ({time})",
  "Новое задание": "New assignment",
  "Новая встреча запланирована": "New meeting scheduled",
  "Новое мок-собеседование запланировано": "New mock interview scheduled",
  "Новое задание с дедлайном": "New assignment with a deadline",
  "{title} от {name}": "{title} from {name}",
  "Описание отсутствует": "No description",
  "📝 В задании: {task}": "📝 Assignment: {task}",
  Неизвестный: "Unknown",
  "Пользователь {id}": "User {id}",
  "👋 Добро пожаловать!": "👋 Welcome!",
  "Привет! Давай познакомимся с платформой. Это займет всего минуту. Важно: прокликай тур до конца и нажми «Завершить», иначе он будет повторяться при следующих входах.":
    "Hi! Let's get to know the platform. It only takes a minute. Important: click through the tour to the end and press “Finish”, otherwise it will show up again every time you sign in.",
  "🎯 Сегодня": "🎯 Today",
  "Стартовая полоса дня: карточки теорминимума к повторению, задачи с доски и новый фидбек от ментора — со счётчиками и переходом в один клик.":
    "Your daily starting strip: theory minimum cards due for review, tasks from the board, and new feedback from your mentor — with counters and one-click access.",
  "🔎 Единый каталог": "🔎 Unified catalog",
  "Кнопка каталога открывает поиск по всем разделам, материалам и вопросам — одной строкой, без блужданий по меню.":
    "The catalog button opens search across all sections, materials and questions — in a single line, no digging through menus.",
  "📚 Обучение": "📚 Learning",
  "Роадмап, учебный план на неделю и профиль с достижениями, отчётами и тестами.":
    "The roadmap, your weekly study plan, and your profile with achievements, reports and tests.",
  "🧭 Верхнее меню": "🧭 Top menu",
  "Отсюда доступны карта разделов, собеседования, дополнительные материалы, лидерборд, новости и профиль.":
    "From here you can reach the section map, interviews, extra materials, the leaderboard, news and your profile.",
  "🎬 Видео-гайд": "🎬 Video guide",
  "📘 Первые шаги": "📘 First steps",
  "Если ты в начале пути — начни отсюда. Базовые знания и инструменты.":
    "If you're just starting out, begin here. Core knowledge and tools.",
  "✨ Готов начать?": "✨ Ready to start?",
  "Отлично! Теперь нажми «Завершить»: после этого тур больше не будет запускаться каждый раз, а платформа предложит выбрать имя и ник для удобного взаимодействия.":
    "Great! Now press “Finish”: the tour won't start every time anymore, and the platform will ask you to pick a name and handle so others can find you.",
  Назад: "Back",
  Далее: "Next",
  "Пропустить знакомство с платформой? Ты всегда сможешь посмотреть видео-гайд.":
    "Skip the platform tour? You can always watch the video guide.",
  "Отлично!": "Great!",
  "Теперь ты знаешь, как пользоваться платформой":
    "Now you know how to use the platform",
  "Как тебя зовут?": "What's your name?",
  "Укажи имя, фамилию и ник в Telegram — они будут видны в лидерборде.":
    "Enter your first name, last name and Telegram handle — they'll be shown on the leaderboard.",
  Иван: "John",
  Иванов: "Smith",
  "Ник в Telegram": "Telegram handle",
  "В лидерборде:": "On the leaderboard:",
  "Иван Иванов (@telegram)": "John Smith (@telegram)",
  "Введи имя": "Enter your first name",
  "Имя: только буквы, дефис или апостроф":
    "First name: letters, hyphens or apostrophes only",
  "Введи фамилию": "Enter your last name",
  "Фамилия: только буквы, дефис или апостроф":
    "Last name: letters, hyphens or apostrophes only",
  "Укажи ник в Telegram": "Enter your Telegram handle",
  "Неверный формат ника: от 5 букв/цифр/подчёркиваний, начиная с буквы":
    "Invalid handle: at least 5 letters, digits or underscores, starting with a letter",
  "Не удалось сохранить. Проверь интернет и попробуй снова.":
    "Couldn't save. Check your internet connection and try again.",
  // rag-chat
  "Лимит: {remaining}/{limit} запросов сегодня":
    "Limit: {remaining}/{limit} requests today",
  "Нужно войти в аккаунт, чтобы отправлять запросы ассистенту.":
    "Sign in to send requests to the assistant.",
  "Дневной лимит ассистента закончился: {limit} запросов. Попробуй завтра.":
    "You've used up today's assistant limit of {limit} requests. Try again tomorrow.",
  "Открыть чат-ассистент": "Open the chat assistant",
  "ML Ассистент": "ML Assistant",
  Онлайн: "Online",
  "Открыть в полноэкранном режиме": "Open in full screen",
  "Полноэкранный режим": "Full screen",
  "Закрыть чат": "Close chat",
  "Задай вопрос по ML...": "Ask an ML question...",
  "Введите вопрос": "Enter a question",
  "Отправить сообщение": "Send message",
  "Выйти из полноэкранного режима": "Exit full screen",
  "Новый чат": "New chat",
  Новый: "New",
  "Просмотр прошлого чата": "Viewing a past chat",
  "Текущий чат": "Current chat",
  "Из России ассистент работает только с включённым VPN — без него ответы приходить не будут.":
    "From Russia, the assistant works only with a VPN on — without it, answers won't come through.",
  "Привет! Я ассистент платформы — сориентирую по материалу, дам ссылки на источники и отвечу на твои вопросы!":
    "Hi! I'm the platform assistant. I'll help you find your way around the material, link to sources, and answer your questions!",
  "Объяснить проще": "Explain more simply",
  "Дать пример": "Give an example",
  "Проверить понимание": "Check understanding",
  "Соседние темы": "Related topics",
  Объяснить: "Explain",
  Объяснение: "Explanation",
  Источники: "Sources",
  Источник: "Source",
  "Не по теме": "Off topic",
  "Ошибка в ответе": "Wrong answer",
  "Слишком сложно": "Too hard",
  "Нет в материалах": "Not in the materials",
  "Оценить ответ ассистента": "Rate the assistant's answer",
  "Ответ помог?": "Was this helpful?",
  "Войдите в аккаунт": "Sign in",
  "Сохраняем...": "Saving...",
  "Что не так?": "What went wrong?",
  Спасибо: "Thanks",
  "Не удалось сохранить": "Couldn't save",
  "Хороший ответ": "Good answer",
  "Плохой ответ": "Bad answer",
  "Ответ отменён.": "Answer canceled.",
  "Извините, не удалось получить ответ ассистента.":
    "Sorry, couldn't get an answer from the assistant.",
  "Произошла ошибка при получении ответа. Попробуйте ещё раз. Если вы в России — проверьте, что включён VPN: без него ассистент недоступен.":
    "Something went wrong while getting the answer. Please try again. If you're in Russia, make sure your VPN is on: the assistant is unavailable without it.",
  "Нет доступа к истории": "No access to history",
  "Войдите для просмотра истории": "Sign in to view history",
  "Загрузка…": "Loading…",
  "Не удалось загрузить": "Couldn't load",
  "История пуста": "No history yet",
  Чат: "Chat",
  "Сообщений нет": "No messages",
  // gamification
  "🌟 Начни свой путь к успеху! Первый отчёт - это первый шаг!":
    "🌟 Start your path to success! Your first report is the first step!",
  "🔥 Отличное начало! Продолжай в том же духе!": "🔥 Great start! Keep it up!",
  "🚀 Ты на правильном пути! Не останавливайся!":
    "🚀 You're on the right track! Don't stop!",
  "💎 Неделя подряд! Ты становишься лучше каждый день!":
    "💎 A full week! You're getting better every day!",
  "👑 Две недели подряд! Ты настоящий чемпион!":
    "👑 Two weeks straight! You're a true champion!",
  "🏆 Месяц подряд! Ты легенда! Продолжай в том же духе!":
    "🏆 A month straight! You're a legend! Keep it up!",
  "🎖️ 50 отчётов! Ты прошёл половину пути к сотне!":
    "🎖️ 50 reports! You're halfway to a hundred!",
  "🌟 100 отчётов! Ты достиг невероятного результата!":
    "🌟 100 reports! That's an incredible result!",
  "💪 Каждый день важен! Не сдавайся!": "💪 Every day counts! Don't give up!",
  // daily-reports, daily-fact, achievement-notifications
  "Что сделал(а) сегодня?": "What did you do today?",
  "Например: Прошёл 3 темы по Python, решил 5 задач по линейной алгебре... Поддерживается markdown: [ссылка](url), списки с - или *, код через `код`":
    "E.g.: Covered 3 Python topics, solved 5 linear algebra problems... Markdown supported: [link](url), lists with - or *, code with `code`",
  "Что планируешь дальше?": "What's next?",
  "Например: Продолжить изучение алгоритмов, решить задачи по статистике... Поддерживается markdown: [ссылка](url), списки с - или *, код через `код`":
    "E.g.: Keep studying algorithms, solve some statistics problems... Markdown supported: [link](url), lists with - or *, code with `code`",
  "С какими трудностями столкнулся(ась)?": "What challenges did you run into?",
  "Например: Не понимаю концепцию градиентного спуска, сложно настроить окружение... Поддерживается markdown: [ссылка](url), списки с - или *, код через `код`":
    "E.g.: I don't get gradient descent, setting up the environment is hard... Markdown supported: [link](url), lists with - or *, code with `code`",
  "Как ощущается процесс?": "How is it going?",
  "😎 Отлично": "😎 Great",
  "🙂 Нормально": "🙂 Okay",
  "😕 Устал": "😕 Tired",
  "🔥 В потоке": "🔥 In the flow",
  "💀 Выгорел": "💀 Burned out",
  "📊 Показатели дня (для статистики и лидерборда)":
    "📊 Today's numbers (for stats and the leaderboard)",
  ч: "h",
  "😴 Сегодня выходной": "😴 Day off today",
  "Отправить отчёт": "Send report",
  'Пожалуйста, заполните хотя бы поле "Что сделал сегодня?" или отметьте выходной день':
    'Please fill in at least "What did you do today?" or mark today as a day off',
  "Отправка...": "Sending...",
  "Ошибка при отправке отчёта. Попробуйте ещё раз.":
    "Couldn't send the report. Please try again.",
  "считаем серию": "counting streak",
  "дней подряд": "days in a row",
  "Сервер ещё не пересчитал серию":
    "The server hasn't recalculated your streak yet",
  "Дней подряд с отчётом или решённым вопросом":
    "Days in a row with a report or a solved question",
  ". В запасе ещё {count} из витрины: сработают ночью, когда месячные кончатся":
    ". Plus {count} in reserve from the shop: they kick in overnight once the monthly ones run out",
  "Серия не рвётся за пропущенный день, пока в месяце есть заморозки: осталось {left} из {total}":
    "A missed day won't break your streak while you have freezes left this month: {left} of {total} left",
  "вопросов сегодня": "questions today",
  "отчётов сегодня": "reports today",
  "часов на учёбу": "study hours",
  "задач выполнено": "tasks done",
  "всего вопросов": "total questions",
  "всего отчётов": "total reports",
  "📝 Написать отчёт": "📝 Write a report",
  "Сбросить статистику (только для менторов)": "Reset stats (mentors only)",
  "🔄 Сбросить статистику": "🔄 Reset stats",
  "Вы уверены, что хотите сбросить всю статистику? Это действие нельзя отменить.":
    "Are you sure you want to reset all stats? This can't be undone.",
  "Статистика успешно сброшена!": "Stats reset!",
  "Ошибка при сбросе статистики": "Couldn't reset stats",
  "Отчёт отправлен! Отличная работа!": "Report sent! Great job!",
  "Вы уверены, что хотите удалить этот отчёт?":
    "Are you sure you want to delete this report?",
  "Отчёт успешно удалён!": "Report deleted!",
  "Ошибка при удалении отчёта": "Couldn't delete the report",
  "💡 Зачем вести отчёты?": "💡 Why write reports?",
  "Это ни к чему не обязывает, решаете сами; но и вам, и мне, кажется, будет легче отслеживать:":
    "It's entirely up to you, but I think it makes it easier for both of us to keep track of:",
  "Какие на текущий момент трудности": "Your current challenges",
  "чтобы я мог помочь с решением": "so I can help you solve them",
  "Каков прогресс": "Your progress",
  "видеть динамику обучения и достижения":
    "to see how your learning and achievements evolve",
  "Что получилось или не получилось сделать": "What worked and what didn't",
  "анализировать эффективность методов": "to see which methods work best",
  "При активном обучении — скидки на постоплату":
    "Active learning earns a discount on deferred payment",
  "(например, при оффере в 250 000 р. и скидке в 7% — 17 500 р. вычитается)":
    "(e.g., with a 250,000 RUB offer and a 7% discount, 17,500 RUB is taken off)",
  "Заполнение занимает 2-3 минуты": "It takes 2–3 minutes",
  ", но в перспективе вырабатывает привычку и придаёт пользу для обучения!":
    ", but over time it builds a habit and pays off in your learning!",
  "{hours} ч {minutes} мин": "{hours} h {minutes} min",
  "Следующий факт через: {time}": "Next fact in: {time}",
  "Доступен новый факт!": "A new fact is available!",
  "Факт дня": "Fact of the day",
  "Закрыть факт": "Close fact",
  "Новое достижение": "New achievement",
  "Закрыть уведомление о достижении": "Close achievement notification",
  // command-palette
  Страницы: "Pages",
  "Из текста": "In text",
  Действие: "Actions",
  "Каталог платформы": "Platform catalog",
  "rag, ranking, wandb, теория вероятностей...":
    "rag, ranking, wandb, probability theory...",
  "Поиск по каталогу": "Search the catalog",
  навигация: "navigate",
  открыть: "open",
  закрыть: "close",
  "В этой категории ничего не найдено": "Nothing found in this category",
  "Ничего не найдено": "Nothing found",
  "Архитектуры CV": "CV architectures",
  "Архитектуры DL": "DL architectures",
  "Архитектуры NLP": "NLP architectures",
  "Базы данных / PostgreSQL": "Databases / PostgreSQL",
  "Базы данных / Redis": "Databases / Redis",
  Видеозаписи: "Video recordings",
  "ИП и самозанятость": "Sole proprietorship and self-employment",
  "Испытательный срок": "Probation period",
  "Источники вакансий": "Job sources",
  Легенда: "Legend",
  Отчёты: "Reports",
  Пререквизиты: "Prerequisites",
  Резюме: "Resume",
  "Рекомендательные системы": "Recommender systems",
  "Роли в Data и ML": "Roles in Data and ML",
  "Словарь IT-сленга": "IT slang glossary",
  "Советы по сдаче практики": "Tips for submitting practice",
  "Создать отчёт": "Create a report",

  // (конец секции widgets)

  // ── Учебные инструменты (my-reports, spaced-repetition, start, calender, tests/квизы, guide) ──
  // @i18n-section:learning — переводы этой группы дописываются сразу под этой строкой.
  "История твоих ежедневных отчётов": "Your daily report history",
  "Оставить отчёт": "Submit a report",
  "Отчёты — часть менторства": "Reports are part of mentorship",
  "Ежедневные отчёты читает куратор, поэтому на тарифе «только материалы» их нет. Если хочешь перейти на менторство — напиши ментору.":
    "Daily reports are read by a curator, so the materials-only plan doesn't include them. If you'd like to switch to mentorship, message your mentor.",
  "История отчётов": "Report history",
  "Нет доступа": "No access",
  "Просмотр отчёта по ссылке доступен только ментору или куратору.":
    "Only a mentor or curator can view a report by link.",
  "Отчёт не найден": "Report not found",
  "Проверьте ссылку или попросите ученика отправить её ещё раз.":
    "Check the link or ask the student to send it again.",
  "Не удалось открыть отчёт по ссылке.":
    "Couldn't open the report from this link.",
  "{count} задач": "Tasks: {count}",
  Выходной: "Day off",
  "Отчёт просмотрен ментором/куратором": "Report viewed by a mentor/curator",
  Прочитано: "Read",
  "{count} слов": "{count} words",
  "Скопировать ссылку для ментора": "Copy link for your mentor",
  "Удалить отчёт": "Delete report",
  "Что сделал(а):": "What I did:",
  "Планы:": "Plans:",
  "Трудности:": "Challenges:",
  "Пока нет отчётов": "No reports yet",
  "Начни заполнять ежедневные отчёты, чтобы отслеживать свой прогресс!":
    "Start filling out daily reports to track your progress!",
  "Отчёт ученика": "Student report",
  "Просмотр отчёта по ссылке": "Viewing a report by link",
  "Ссылка открыта в режиме просмотра для ментора или куратора.":
    "This link is open in view mode for a mentor or curator.",
  "{day}-е: {hours} ч": "Day {day}: {hours} h",
  "Предыдущий месяц": "Previous month",
  "Часы на учёбу по дням": "Study hours by day",
  "Следующий месяц": "Next month",
  "Итого за месяц:": "Month total:",
  "Ссылка на отчёт скопирована": "Report link copied",
  "Не удалось скопировать ссылку": "Couldn't copy the link",
  "Карточки из теоретического минимума": "Cards from the core theory",
  "Сессия повторения": "Review session",
  "Статистика повторения": "Review stats",
  "к повторению": "due",
  новых: "new",
  сегодня: "today",
  доступно: "available",
  "в работе": "learning",
  закрыто: "closed",
  закреплено: "mastered",
  "Фильтры карточек": "Card filters",
  Режим: "Mode",
  "К повторению": "Due for review",
  "Из изученных вопросов": "From completed questions",
  Новые: "New",
  "Все карточки": "All cards",
  Раздел: "Section",
  "Все разделы": "All sections",
  "Все темы": "All topics",
  Тема: "Topic",
  Блоки: "Blocks",
  "С блока": "From block",
  "По блок": "Through block",
  "с любого": "from any",
  "по любой": "through any",
  "Блок {number}": "Block {number}",
  "с начала": "from the first",
  "до конца": "to the last",
  "Сначала выбери тему": "Choose a topic first",
  "В этой теме блоки не размечены": "This topic has no numbered blocks",
  "Выбери один блок или диапазон блоков":
    "Choose one block or a range of blocks",
  "Поиск по карточкам": "Search cards",
  Сбросить: "Reset",
  "Загрузка карточек": "Loading cards",
  "Собираю вопросы из теоретического минимума.":
    "Gathering questions from the core theory.",
  "Не удалось загрузить повторение": "Couldn't load your review",
  "Попробуйте обновить страницу.": "Try reloading the page.",
  Теория: "Theory",
  Осталось: "Left",
  "Прошлая оценка": "Last rating",
  "Space — ответ, 1–4 — оценка, S — пропустить":
    "Space — answer, 1–4 — rate, S — skip",
  "10 мин": "10 min",
  "{n} д": "{n} d",
  "Оценка не сохранилась — проверь соединение":
    "Your rating wasn't saved — check your connection",
  "Сегодня: {n}. Следующая карточка — {date}.":
    "Today: {n}. Next card is due {date}.",
  "Сегодня: {n}.": "Today: {n}.",
  Вопрос: "Question",
  "Нажми, чтобы показать ответ": "Tap to show the answer",
  Ответ: "Answer",
  "Оцени, насколько легко вспомнил": "Rate how easily you recalled it",
  Пропустить: "Skip",
  "Не помню": "Forgot",
  Нормально: "Good",
  "Слишком много запросов": "Too many requests",
  "Не удалось проверить доступы": "Couldn't check your access",
  "Разделы ещё не открыты": "No sections unlocked yet",
  "Нет карточек для этого режима": "No cards for this mode",
  "Карточки запрашивались слишком часто. Подожди немного — обновление страницы сейчас не поможет.":
    "Cards were requested too often. Wait a bit — reloading the page won't help right now.",
  "Обнови страницу или обратись к ментору — без проверки доступов карточки не показываем.":
    "Reload the page or contact your mentor — we don't show cards until your access is verified.",
  "Карточки самопроверки появятся вместе с разделами твоего тарифа. Напиши ментору, если ждёшь доступ.":
    "Self-check cards will appear along with the sections in your plan. Message your mentor if you're waiting for access.",
  'Если ты только начал, переключись на "Все карточки" или отметь несколько вопросов как выполненные.':
    'If you\'re just starting, switch to "All cards" or mark a few questions as completed.',
  "Перед тем, как мы начнем работу": "Before we get started",
  "Первым делом": "First things first",
  "Стартовая диагностика": "Placement check",
  "Подбери маршрут под свой текущий уровень":
    "Find a route that fits your current level",
  "Ответь на тест по Python, математике, Classic ML, DL и NLP — по 14 вопросов на раздел, от базовых до собеседовательных. Платформа покажет, что можно пропустить, что повторить и с какого раздела лучше начать.":
    "Take a quiz on Python, math, Classic ML, DL, and NLP — 14 questions per section, from basics to interview level. The platform will show what you can skip, what to review, and which section to start with.",
  "Параметры диагностики": "Placement check details",
  "70 вопросов": "70 questions",
  "20-30 минут": "20–30 minutes",
  "Загружаем диагностику...": "Loading the placement check...",
  "Про совместную работу": "Working together",
  Созвоны: "Calls",
  "Созвоны — раз в неделю, ~10-40 минут.":
    "Calls happen once a week, ~10–40 minutes.",
  "Разбираем все вопросы, которые у тебя возникли":
    "We go over any questions you have",
  Любая: "Any",
  "критика, пожелания и предложения": "criticism, requests, and suggestions",
  приветствуются: "are welcome",
  "Задавай вопросы": "Ask questions",
  "Чем больше вопросов ты задаешь, тем быстрее ты будешь продвигаться в обучении":
    "The more questions you ask, the faster you'll progress",
  "Темы снабжены": "Topics come with",
  ссылками: "links",
  "на весь уникальный материал, который ты будешь изучать":
    "to all the original material you'll study",
  "Открыть RoadMap": "Open the roadmap",
  "Про практику: GitHub": "Practice: GitHub",
  "1. Регистрация GitHub": "1. Sign up for GitHub",
  "Зарегистрируйся на GitHub, если у тебя еще нет аккаунта":
    "Sign up for GitHub if you don't have an account yet",
  Зарегистрироваться: "Sign up",
  "Скинь ссылку на GitHub в личные сообщения":
    "Send your GitHub link in a direct message",
  "2. GitHub профиль": "2. GitHub profile",
  "GitHub профиль": "GitHub profile",
  "Скинь ссылку на свой GitHub для добавления в приватный репозиторий":
    "Send a link to your GitHub so we can add you to the private repository",
  "Отправить ссылку": "Send link",
  "Скачай и установи Git, чтобы работать с репозиториями":
    "Download and install Git to work with repositories",
  "Скачать Git": "Download Git",
  "Скачай GitHub Desktop для удобной работы с репозиториями":
    "Download GitHub Desktop for easier work with repositories",
  "Скачать Desktop": "Download Desktop",
  "5. Git понятия": "5. Git concepts",
  "Git понятия": "Git concepts",
  "Основные понятия и команды Git": "Core Git concepts and commands",
  "Изучить понятия": "Learn the concepts",
  "Результат сохранён в этом браузере.": "Result saved in this browser.",
  "Результат сохранён в профиле.": "Result saved to your profile.",
  уверенно: "confident",
  "есть пробелы": "some gaps",
  "начать с базы": "start with basics",
  "можно пропустить": "can skip",
  повторить: "review",
  "в фокус": "focus",
  "Начни с Python Base": "Start with Python Base",
  "Закрой пробелы в Python": "Fill the gaps in Python",
  "Можно пропустить базовый Python": "You can skip basic Python",
  "Закрой алгебру и базовую статистику": "Cover algebra and basic statistics",
  "Повтори ключевые темы математики": "Review the key math topics",
  "Можно идти дальше, возвращаясь точечно":
    "Move on, coming back to specific topics as needed",
  "Начни с Classic ML": "Start with Classic ML",
  "Закрепи метрики, CV и базовые модели":
    "Reinforce metrics, CV, and basic models",
  "Переходи к DL после контрольного квиза":
    "Move on to DL after the checkpoint quiz",
  "DL пока изучай после Classic ML": "Study DL after Classic ML for now",
  "Закрой оптимизацию, регуляризацию и attention":
    "Cover optimization, regularization, and attention",
  "Можно двигаться к NLP и архитектурам":
    "You can move on to NLP and architectures",
  "Начни с NLP Base после Classic ML/DL": "Start NLP Base after Classic ML/DL",
  "Закрепи эмбеддинги, attention и transformers":
    "Reinforce embeddings, attention, and transformers",
  "Переходи к RAG, Agents и Optimization":
    "Move on to RAG, Agents, and Optimization",
  "Python нужен для практики, задач и чтения кода в материалах.":
    "You need Python for practice, assignments, and reading code in the materials.",
  "Математика будет постоянно встречаться в ML, метриках и оптимизации.":
    "Math comes up constantly in ML, metrics, and optimization.",
  "Это ближайший содержательный блок, который даст максимальный прирост.":
    "This is the nearest core block and will give you the biggest gain.",
  "Базу можно не перечитывать подряд, лучше пройти контрольные вопросы и двигаться дальше.":
    "No need to reread the basics end to end — go through the checkpoint questions and move on.",
  "Тему стоит повторять точечно после основного фокуса.":
    "Review specific parts of this topic after your main focus.",
  "Диагностика выглядит сильной: начинай с продвинутых NLP-блоков и практики.":
    "Strong result: start with the advanced NLP blocks and practice.",
  "Вопрос {index} из {total}": "Question {index} of {total}",
  "{answered}/{total} отвечено": "{answered}/{total} answered",
  "Получить маршрут": "Get my route",
  Дальше: "Next",
  "Это результат прошлой версии теста. Набор обновлён: стало 70 вопросов и они сложнее — пройди заново, чтобы увидеть актуальный срез.":
    "This is a result from a previous version of the test. The set has been updated to 70 harder questions — retake it to see where you stand now.",
  "Рекомендованный маршрут": "Recommended route",
  "Пройти заново": "Retake",
  "Открыть первый шаг": "Open the first step",
  Материал: "Material",
  "Не удалось загрузить вопросы диагностики. Обнови страницу.":
    "Couldn't load the placement questions. Reload the page.",
  "Доска (Kanban)": "Board (Kanban)",
  Задачи: "Tasks",
  "Отслеживай свои задачи и двигай их по мере выполнения.":
    "Track your tasks and move them along as you work.",
  "Новая карточка": "New card",
  "Фильтры доски": "Board filters",
  "Название, ученик, материал...": "Title, student, material...",
  Тип: "Type",
  "Все типы": "All types",
  Сводка: "Summary",
  Всего: "Total",
  Мои: "Mine",
  "Загрузить ещё": "Load more",
  Карточка: "Card",
  Название: "Title",
  Колонка: "Column",
  "Нужно сделать": "To do",
  "На проверке": "In review",
  Готово: "Done",
  Дедлайн: "Deadline",
  Описание: "Description",
  "Коротко: что это за задача и зачем она ученику":
    "In short: what this task is and why the student needs it",
  Пояснение: "Explanation",
  "+ Добавить из библиотеки": "+ Add from library",
  "Свернуть библиотеку материалов": "Collapse materials library",
  "Развернуть библиотеку материалов": "Expand materials library",
  "Найти материал: RAG, Python, практика...":
    "Find material: RAG, Python, practice...",
  "Типы шаблонов": "Template types",
  "Отметь несколько шаблонов или добавь один кнопкой +.":
    "Check several templates or add one with the + button.",
  "Будет добавлено": "Will be added",
  "Не выбрано": "Nothing selected",
  "Добавить выбранное": "Add selected",
  "Что сделать": "What to do",
  "Предпросмотр карточки": "Card preview",
  Инструкции: "Instructions",
  "Заполни описание, пояснение, материалы или шаги.":
    "Fill in the description, explanation, materials, or steps.",
  "Добавить {item} в {section}": "Add {item} to {section}",
  "Выбрано: {count}": "Selected: {count}",
  "без дедлайна": "no deadline",
  "Без недели": "No week",
  "Ученик {id}": "Student {id}",
  "Без названия": "Untitled",
  Задача: "Task",
  "только просмотр": "view only",
  "Скрыть старые": "Hide older",
  "Показать все ({count})": "Show all ({count})",
  "Неделя завершения": "Week completed",
  Пусто: "Empty",
  "Загрузка задач…": "Loading tasks…",
  "Показано {shown} из {visible} на доске · всего {total} задач":
    "Showing {shown} of {visible} on the board · {total} tasks total",
  "Мигрирую события ученика {name}...":
    "Migrating events for student {name}...",
  "Миграция {name}: найдено {scanned}, создано {created}, пропущено дублей {skipped}.":
    "Migration for {name}: found {scanned}, created {created}, skipped {skipped} duplicates.",
  "Мигрирую все события из events в канбан...":
    "Migrating all events into the kanban...",
  "Миграция всех events: найдено {scanned}, создано {created}, пропущено дублей {skipped}, без studentId {withoutStudent}.":
    "Migration of all events: found {scanned}, created {created}, skipped {skipped} duplicates, {withoutStudent} without studentId.",
  "Не удалось выполнить общую миграцию: {error}":
    "Couldn't run the full migration: {error}",
  "Не нашёл ученика для миграции: {query}":
    "Couldn't find a student to migrate: {query}",
  "Не удалось выполнить миграцию: {error}":
    "Couldn't run the migration: {error}",
  "Карточка задачи": "Task card",
  Редактирование: "Editing",
  Создание: "Creating",
  "Выбери ученика.": "Choose a student.",
  "Эту карточку можно только смотреть.": "This card is view-only.",
  "Добавь название карточки.": "Add a card title.",
  "Сервис сотрудников недоступен.": "Staff service is unavailable.",
  "Не удалось загрузить доску: {error}": "Couldn't load the board: {error}",
  "Доска задач пока недоступна: нужно задеплоить Firebase rules для kanbanTasks.":
    "The task board isn't available yet: Firebase rules for kanbanTasks need to be deployed.",
  "Сервис задач недоступен.": "Task service is unavailable.",
  "Не удалось загрузить задачи: {error}": "Couldn't load tasks: {error}",
  "Не удалось переместить карточку: {error}": "Couldn't move the card: {error}",
  "Нужно войти в аккаунт, чтобы открыть доску.": "Log in to open the board.",
  "Не удалось инициализировать доску: {error}":
    "Couldn't initialize the board: {error}",
  "Не удалось подключиться к Firebase: {error}":
    "Couldn't connect to Firebase: {error}",
  "В работе": "In progress",
  "Персональная недельная траектория, задания и прогресс ученика":
    "A personal weekly path, assignments, and student progress",
  "Персональный учебный план": "Personal study plan",
  "Имя, @telegram или email": "Name, @telegram, or email",
  "Выбрать ученика": "Choose a student",
  "Мои ученики": "My students",
  прогресс: "progress",
  "на доске": "on the board",
  "плановая нагрузка": "planned workload",
  "0 ч": "0 h",
  "«Предпросмотр» показывает задание так, как его увидит ученик на доске. «На доску» создаёт эту карточку и открывает ученику страницы из списка материалов, которые у него ещё закрыты (🔒). Закрытие этапа закрывает связанные карточки доски.":
    "“Preview” shows the assignment the way the student will see it on the board. “To board” creates this card and unlocks the pages from the materials list that the student doesn't have yet (🔒). Closing a stage closes the linked board cards.",
  "Важные пометки к учебному плану": "Important notes on the study plan",
  "Правило первого прохода": "First-pass rule",
  "При первом прочтении проходите только вопросы с пометкой «Обязательно». Разделы «Дополнительно», «Ресерч» и «Можно учить позже» можно и нужно скипать: там более узкие и сложные темы.":
    "On your first pass, only go through questions marked “Required”. The “Additional”, “Research” and “Can study later” sections can and should be skipped: they cover narrower, harder topics.",
  "Так увидит ученик": "What the student will see",
  "Закрыть предпросмотр": "Close preview",
  "На доску": "To board",
  обязательный: "required",
  дополнительный: "additional",
  "в среднем {hours} ч на milestone": "{hours} h per milestone on average",
  "пока нет закрытых milestone": "no closed milestones yet",
  "программа закрыта": "program completed",
  Закрыто: "Closed",
  "На доске": "On the board",
  "Текущий этап": "Current stage",
  Ожидает: "Pending",
  "Закрыто для ученика — откроется при постановке на доску":
    "Locked for the student — unlocks when added to the board",
  "Блоки {blocks}": "Blocks {blocks}",
  "закрыто для ученика": "locked for the student",
  "Этап закрыт": "Stage closed",
  Предпросмотр: "Preview",
  "Открыт демо-режим: войдите, чтобы увидеть реальные данные ученика.":
    "Demo mode: log in to see real student data.",
  "Не удалось загрузить список учеников. Обновите страницу или попробуйте позже.":
    "Couldn't load the student list. Reload the page or try again later.",
  "Доска задач пока недоступна: нужно обновить Firebase rules.":
    "The task board isn't available yet: Firebase rules need to be updated.",
  "Так увидит {name}": "What {name} will see",
  ученик: "student",
  "Назначать задания может только ментор или куратор.":
    "Only a mentor or curator can assign tasks.",
  "Сначала выберите ученика.": "Choose a student first.",
  "Демо: milestone отмечен как поставленный на доску.":
    "Demo: milestone marked as added to the board.",
  "Поставлено на доску. Открыты разделы: {sections}.":
    "Added to the board. Unlocked sections: {sections}.",
  "Milestone поставлен на доску выбранного ученика.":
    "Milestone added to the selected student's board.",
  "Закрывать milestone может только ментор или куратор.":
    "Only a mentor or curator can close a milestone.",
  "Демо: milestone закрыт, связанные карточки отмечены выполненными.":
    "Demo: milestone closed, linked cards marked as done.",
  "Milestone закроется, но карточки доски недоступны: обновите Firebase rules.":
    "The milestone will close, but board cards are unavailable: update the Firebase rules.",
  "Milestone закрыт, связанные карточки на доске тоже закрыты.":
    "Milestone closed; linked board cards are closed too.",
  "Не удалось выполнить действие. Подробности в консоли.":
    "Couldn't complete the action. See the console for details.",
  "Не удалось загрузить учебный план.": "Couldn't load the study plan.",
  "Тесты курса": "Course quizzes",
  "Проверьте свои знания с помощью интерактивных тестов":
    "Test your knowledge with interactive quizzes",
  "Проверьте свои знания с помощью интерактивных тестов. Тесты разблокируются по мере изучения материала.":
    "Test your knowledge with interactive quizzes. Quizzes unlock as you work through the material.",
  "Всего тестов": "Total quizzes",
  Пройдено: "Completed",
  Доступно: "Available",
  "Средний прогресс": "Average progress",
  Фильтры: "Filters",
  "Все тесты": "All quizzes",
  "Не пройдены": "Not completed",
  Пройденные: "Completed",
  Заблокированные: "Locked",
  "По категориям:": "By category:",
  "Тест заблокирован. Завершите изучение материала для разблокировки.":
    "This quiz is locked. Finish studying the material to unlock it.",
  Заблокирован: "Locked",
  Сдан: "Passed",
  "Не сдан": "Not passed",
  "Не приступал": "Not started",
  "Начать тест": "Start quiz",
  Заблокировано: "Locked",
  "Контрольный тест": "Checkpoint quiz",
  "Проверьте понимание темы": "Check your understanding of the topic",
  Вопросы: "Questions",
  Время: "Time",
  "{minutes} мин": "{minutes} min",
  Порог: "Pass mark",
  Попытки: "Attempts",
  "Прогресс по материалу: {done}/{total} ({percent}%)":
    "Material progress: {done}/{total} ({percent}%)",
  "Последняя попытка:": "Last attempt:",
  "Лучший результат:": "Best result:",
  "Лучшая сданная попытка:": "Best passing attempt:",
  "Недоступно:": "Unavailable:",
  "завершите изучение материала для разблокировки теста":
    "finish studying the material to unlock the quiz",
  "Не удалось загрузить тест. Попробуйте позже.":
    "Couldn't load the quiz. Please try again later.",
  "Сохраняем результат…": "Saving your result…",
  "Результат не сохранён.": "Result not saved.",
  "Пока он не сохранён, попытка не попадёт в статистику.":
    "Until it's saved, this attempt won't count toward your stats.",
  "Сохранить ещё раз": "Try saving again",
  "Осталось: {time}": "Time left: {time}",
  "Время вышло": "Time's up",
  "Попытка засчитана по отвеченным вопросам.":
    "The attempt was scored on the questions you answered.",
  "Результат: {percent}% — {correct} из {total}":
    "Result: {percent}% — {correct} of {total}",
  "Лимит времени: {time}": "Time limit: {time}",
  "Чтобы сдать тест, начните попытку заново и наберите минимум {percent}%.":
    "To pass the quiz, start a new attempt and score at least {percent}%.",
  "Начать заново": "Start over",
  "Проверить ответ": "Check answer",
  "Выберите как минимум 1 ответ": "Choose at least 1 answer",
  "Правильно!": "Correct!",
  "Неправильно.": "Incorrect.",
  "Следующий вопрос": "Next question",
  "Завершить тест": "Finish quiz",
  "Тест сдан.": "Quiz passed.",
  "Тест не сдан.": "Quiz not passed.",
  "Проходной порог: {percent}%": "Pass mark: {percent}%",
  "Правильных ответов: {correct} из {total}":
    "Correct answers: {correct} of {total}",
  "Время выполнения: {time}": "Time taken: {time}",
  "Повторить тест": "Retake quiz",
  "Хорошо!": "Good job!",
  Удовлетворительно: "Satisfactory",
  "Нужно подтянуть знания": "Needs more work",
  "Загрузка тестов...": "Loading quizzes...",
  попытка: "attempt",
  попытки: "attempts",
  попыток: "attempts",
  "Ошибка загрузки каталога тестов": "Couldn't load the quiz catalog",
  "Гайд по работе с платформой": "Platform guide",
  "Schmidt ML · базовый гайд": "Schmidt ML · basic guide",
  "Как устроена платформа": "How the platform works",
  "Открыть базовый гайд": "Open the basic guide",
  "Выбери этап в оглавлении или листай стрелками ← →":
    "Pick a step in the contents or use the ← → arrows",
  "Этапы гайда": "Guide steps",
  "Перейти к разделу": "Go to section",
  "Завершить гайд": "Finish guide",
  "Главная: точка входа": "Home: your starting point",
  "Учебный маршрут": "Learning route",
  "Открыть роадмап": "Open the roadmap",
  "Календарь задач": "Task board",
  "Открыть календарь": "Open the board",
  "Открыть учебный план": "Open the study plan",
  "Материалы и практика": "Materials and practice",
  "Открыть материалы": "Open materials",
  "Режим презентации": "Presentation mode",
  "ИИ-ассистент": "AI assistant",
  "Профиль и повторение": "Profile and review",
  "Открыть профиль": "Open profile",
  "Фидбек и ежедневные отчёты": "Feedback and daily reports",
  "Открыть фидбек": "Open feedback",
  "Подготовка к рынку": "Job market prep",
  "Банк вопросов по компаниям": "Company question bank",
  "Лидерборд и достижения": "Leaderboard and achievements",
  "Открыть лидерборд": "Open the leaderboard",
  "Грады: валюта за учёбу": "Grads: currency for studying",
  "Сообщество и обновления": "Community and updates",
  "Двухминутное видео обо всех возможностях платформы.":
    "A two-minute video on everything the platform can do.",
  "14 шагов за две минуты — от главной до оффера. Шаги с пометкой «только в менторстве» есть только в формате с ментором.":
    "14 steps in two minutes, from the home page to a job offer. Steps marked “mentorship only” exist only in the mentored format.",
  "только в менторстве": "mentorship only",
  Шаги: "Steps",

  // (конец секции learning)

  // ── Кабинет персонала (mentor-stats/*, curator/*) ──
  // @i18n-section:staff — переводы этой группы дописываются сразу под этой строкой.
  "Платформа (только материалы)": "Platform (materials only)",
  "Пульт куратора": "Curator dashboard",
  "Не удалось сменить подгруппу": "Failed to change the subgroup",
  "Карточка доступна только куратору этого ученика или ментору.":
    "This card is only available to the student's curator or a mentor.",
  "Загружаю карточку ученика…": "Loading the student card…",
  "Пульт ученика": "Student dashboard",
  "Действия с учеником": "Student actions",
  "Поставить задачу": "Assign a task",
  "Написать фидбек": "Write feedback",
  Календарь: "Calendar",
  Доступы: "Access",
  "Ключевые показатели": "Key metrics",
  "Вопросы, которые ученик отметил пройденными на сайте.":
    "Questions the student marked as done on the site.",
  "Текущая неделя плана и общий темп.": "Current plan week and overall pace.",
  "Ближайшие задачи": "Upcoming tasks",
  "Открытые задачи из календаря, по дедлайну.":
    "Open calendar tasks, by deadline.",
  "Открытые разделы и заявки на доступ.": "Open sections and access requests.",
  "без даты": "no date",
  "нет активного milestone": "no active milestone",
  База: "Basics",
  "Практика ML": "ML practice",
  "Загружаю данные…": "Loading data…",
  "Загружаю…": "Loading…",
  "Контакты не указаны": "No contact info",
  "Учебный план закрыт": "Study plan completed",
  "Пришёл от: {name}": "Referred by: {name}",
  "Привёл {count} {students}": "Referred {count} {students}",
  "Прогресс на сайте": "Site progress",
  "{done} из {total} вопросов": "{done} of {total} questions",
  "{done} из {total} этапов": "{done} of {total} milestones",
  "Открытые задачи": "Open tasks",
  "без просрочек": "nothing overdue",
  "Открытые разделы": "Open sections",
  "{done} из {total}": "{done} of {total}",
  "{count} {requests} решения": "{count} {requests} a decision",
  "новых заявок нет": "no new requests",
  "Не удалось загрузить структуру прогресса.":
    "Couldn't load the progress structure.",
  "Нет доступных учеников": "No students available",
  Сейчас: "Now",
  "Все этапы учебного плана закрыты": "All study plan milestones are complete",
  Назначено: "Assigned",
  Нагрузка: "Workload",
  "{done} / {planned} ч": "{done} / {planned} h",
  "Открытых задач нет — можно поставить следующую.":
    "No open tasks — you can assign the next one.",
  просрочено: "overdue",
  "Ещё {count} в календаре": "{count} more in the calendar",
  "Ждут решения": "Awaiting a decision",
  материал: "material",
  "Ни один раздел пока не открыт.": "No sections are open yet.",
  "Не удалось загрузить данные": "Couldn't load data",
  "Сервис временно недоступен. Обновите страницу через минуту — если не поможет, напишите в поддержку.":
    "The service is temporarily unavailable. Refresh the page in a minute — if that doesn't help, contact support.",
  "Нет закреплённых учеников": "No assigned students",
  "Снимите «Только мои ученики», чтобы выбрать из всех.":
    "Uncheck “My students only” to choose from everyone.",
  "Дашборд ментора": "Mentor dashboard",
  "Мониторинг активности учеников": "Monitoring student activity",
  "Активность учеников": "Student activity",
  "Обновление…": "Updating…",
  "Запросы доступа": "Access requests",
  "Обновлено в {time}": "Updated at {time}",
  "из кэша": "from cache",
  "📬 Отчёты: {count}": "📬 Reports: {count}",
  "Загрузка дашборда...": "Loading dashboard...",
  "Не удалось загрузить данные дашборда": "Couldn't load dashboard data",
  страница: "page",
  "{name} просит доступ": "{name} is requesting access",
  Страница: "Page",
  "Открыть доступ": "Grant access",
  Отклонить: "Decline",
  "Не удалось обработать запрос доступа": "Couldn't process the access request",
  "Вопросы сегодня:": "Questions today:",
  "+{count} ещё": "+{count} more",
  "{count} непрочитанных отчётов": "{count} unread reports",
  "● Активен": "● Active",
  "● Нет активности": "● No activity",
  "Вопр. сегодня": "Q. today",
  "Вопр. всего": "Q. total",
  "Отчёты: {name}": "Reports: {name}",
  "Нет отчётов": "No reports",
  "У этого ученика пока нет отчётов": "This student has no reports yet",
  "Загрузка текста отчёта…": "Loading report text…",
  "Не удалось загрузить текст отчёта.": "Couldn't load the report text.",
  "😴 Выходной": "😴 Day off",
  "Сегодня ✅": "Today ✅",
  "✅ Что сделал(а):": "✅ What I did:",
  "Не указано": "Not specified",
  "🚀 Планы:": "🚀 Plans:",
  "🐛 Трудности:": "🐛 Challenges:",
  "показано {shown} из {total}": "showing {shown} of {total}",
  "Показать ещё {count}": "Show {count} more",
  "Не удалось загрузить дополнительные отчёты. Попробуйте ещё раз.":
    "Couldn't load more reports. Please try again.",
  "Без группы": "No subgroup",
  "Распределение по подгруппам": "Subgroup breakdown",
  "Состав групповых созвонов: активные ученики и выпускники в Employed. Без пауз, ушедших, персонала и формата «только материалы»":
    "Group call roster: active students and graduates in Employed. Excludes paused, departed, staff, and “materials only” students",
  "Всего: {count}": "Total: {count}",
  "скрыто {count}": "{count} hidden",
  "Бот не привязан — напоминание о созвоне не дойдёт":
    "Bot not linked — the call reminder won't reach them",
  "Завершил обучение — бот напоминание не отправляет":
    "Finished the program — the bot doesn't send reminders",
  ", из них {count} без напоминания": ", {count} of them without reminders",
  "С каким уровнем ученики приходят: Python, математика, Classic ML, DL и NLP":
    "What level students start at: Python, math, Classic ML, DL, and NLP",
  "Тесты — в лидерборде": "Quizzes are on the leaderboard",
  "Результаты появятся после первого завершённого прохождения.":
    "Results will appear after the first completed attempt.",
  "Срез по Python, математике, Classic ML, DL и NLP.":
    "Snapshot across Python, math, Classic ML, DL, and NLP.",
  Прошли: "Completed",
  "Средний результат": "Average score",
  "Нуждается в фокусе": "Needs focus",
  "Ученики, прошедшие диагностику": "Students who took the diagnostic",
  "дата не указана": "no date",
  "Средние результаты по разделам": "Average scores by section",
  "Прохождений прошлой версии теста — {outdated} из {total}: там было 50 вопросов и они проще, поэтому средние по когорте пока смешивают две редакции.":
    "{outdated} of {total} attempts are on the previous version of the test: it had 50 easier questions, so cohort averages currently mix two editions.",
  "Пройдено {date}": "Completed {date}",
  "прошлая версия теста": "previous test version",
  "Загружаем результаты диагностики…": "Loading diagnostic results…",
  "Не удалось загрузить результаты диагностики":
    "Couldn't load diagnostic results",
  "Анализ сложности вопросов": "Question difficulty analysis",
  "Статистика и распределение сложности по модулям":
    "Difficulty stats and distribution by module",
  "На страницу статистики": "Back to stats",
  "Средняя сложность по модулям": "Average difficulty by module",
  "Загрузка графиков...": "Loading charts...",
  "❌ Ошибка загрузки графиков": "❌ Failed to load charts",
  "У вас нет доступа к анализу сложности":
    "You don't have access to difficulty analysis",
  "Загрузка статистики сложности...": "Loading difficulty stats...",
  "Загрузка графика...": "Loading chart...",
  Модуль: "Module",
  "Все модули": "All modules",
  "Не удалось загрузить статистику сложности": "Couldn't load difficulty stats",
  "Не удалось загрузить график": "Couldn't load the chart",
  "Всего вопросов": "Total questions",
  "Вопросов оценено": "Questions rated",
  "Всего оценок": "Total ratings",
  "Покрытие оценками": "Rating coverage",
  Сложность: "Difficulty",
  "средн.": "avg.",
  "Медиана средних оценок вопросов модуля":
    "Median of the module's question averages",
  медиана: "median",
  "очень легко": "very easy",
  легко: "easy",
  средне: "medium",
  сложно: "hard",
  "очень сложно": "very hard",
  "Без оценок пока {count} {modules}": "{count} {modules} without ratings yet",
  "Средняя сложность": "Average difficulty",
  "Медиана по вопросам": "Median by question",
  Покрытие: "Coverage",
  "вопросы по средней оценке": "questions by average rating",
  "{percent}% от оценённых": "{percent}% of rated",
  "Оценок всего": "Total ratings",
  Средняя: "Average",
  Статистика: "Stats",
  "Обзор активности и результатов учеников":
    "Overview of student activity and results",
  "У вас нет доступа к статистике": "You don't have access to stats",
  "Загрузка статистики...": "Loading stats...",
  "Пожалуйста, подождите": "Please wait",
  "Неизвестная ошибка": "Unknown error",
  "Не удалось загрузить статистику. Проверьте соединение и попробуйте ещё раз.":
    "Couldn't load stats. Check your connection and try again.",
  "неизвестно когда": "unknown time",
  "Не удалось обновить статистику. Показаны данные от {when}.":
    "Couldn't refresh stats. Showing data from {when}.",
  Дашборды: "Dashboards",
  "По разделам": "By section",
  "Детальный прогресс всех учеников по теории и практике":
    "Detailed progress of all students in theory and practice",
  Учеников: "Students",
  "Вопросов решено": "Questions solved",
  Разделов: "Sections",
  "Мониторинг отчётов и прогресса учеников":
    "Monitoring student reports and progress",
  "Всего учеников": "Total students",
  Активных: "Active",
  "Вопросов сегодня": "Questions today",
  "По периодам": "By period",
  "Статистика активности учеников по периодам":
    "Student activity stats by period",
  "Статистика сложности вопросов по модулям":
    "Question difficulty stats by module",
  "С оценками": "Rated",
  "С каким уровнем приходят ученики. Тесты по ученикам — в лидерборде":
    "What level students start at. Per-student quizzes are on the leaderboard",
  Управление: "Management",
  "Добавление и отслеживание офферов учеников": "Add and track student offers",
  "Всего офферов": "Total offers",
  Средний: "Average",
  Максимальный: "Maximum",
  "Общая сумма": "Total amount",
  Ученики: "Students",
  "Централизованное управление настройками учеников":
    "Central management of student settings",
  Завершивших: "Finished",
  Ушедших: "Departed",
  Другое: "Other",
  "Сообщения об ошибках": "Error reports",
  "Фидбеки учеников по вопросам, тестам и формулировкам":
    "Student feedback on questions, quizzes, and wording",
  "Кто что заказал на витрине: отметить выданным или отменить с возвратом":
    "Who ordered what from the shop: mark as delivered or cancel with a refund",
  "Кто сейчас на платформе, пики по дням и часам, время учеников на сайте":
    "Who's on the platform now, peaks by day and hour, students' time on site",
  "Оценки ассистента": "Assistant ratings",
  "Ответы RAG-чата, которые ученики отметили как неудачные":
    "RAG chat answers that students marked as unhelpful",
  "Статистика по периодам": "Stats by period",
  "Статистика активности учеников по месяцам и годам":
    "Student activity stats by month and year",
  "Назад к статистике": "Back to stats",
  Месяц: "Month",
  Год: "Year",
  "‹ Предыдущий": "‹ Previous",
  "Следующий ›": "Next ›",
  "Гистограмма решенных вопросов по ученикам": "Solved questions per student",
  "❌ Ошибка загрузки графика": "❌ Failed to load the chart",
  Январь: "January",
  Февраль: "February",
  Март: "March",
  Апрель: "April",
  Июнь: "June",
  Июль: "July",
  Август: "August",
  Сентябрь: "September",
  Октябрь: "October",
  Ноябрь: "November",
  Декабрь: "December",
  "{year} год": "{year}",
  Ошибка: "Error",
  "Активных учеников": "Active students",
  "Новых учеников": "New students",
  "Решено вопросов": "Questions solved",
  Отчётов: "Reports",
  "Ср. вопросов/ученик": "Avg. questions/student",
  Офферов: "Offers",
  "Макс. оффер": "Max offer",
  "Ср. оффер": "Avg. offer",
  "Нет данных": "No data",
  "За выбранный период нет активности": "No activity in the selected period",
  Активен: "Active",
  Завершён: "Finished",
  "🆕 Новый": "🆕 New",
  Дней: "Days",
  "{count} {students} меньше {min} вопросов":
    "{count} {students} fewer than {min} questions",
  "· из них {count} — ни одного": "· {count} of them solved none",
  "Никто не решил {min} и больше вопросов за этот период":
    "No one solved {min} or more questions in this period",
  "Дней активности": "Active days",
  "Не удалось загрузить статистику": "Couldn't load stats",
  "Офферы учеников": "Student offers",
  "Мониторинг офферов учеников": "Tracking student offers",
  "Отчёты ученика": "Student reports",
  "Управление офферами": "Manage offers",
  "У вас нет доступа к дашборду ментора":
    "You don't have access to the mentor dashboard",
  "{count} офферов": "{count} offers",
  руб: "RUB",
  "Нет офферов": "No offers",
  "Управлять офферами": "Manage offers",
  "Офферы: {name}": "Offers: {name}",
  "У ученика пока нет офферов": "This student has no offers yet",
  "Например: ozon": "E.g.: ozon",
  "Например: Middle ML Engineer": "E.g.: Middle ML Engineer",
  "Например: 200 000": "E.g.: 200,000",
  "Дата получения оффера": "Offer date",
  "Заметки (необязательно)": "Notes (optional)",
  "Дополнительная информация...": "Additional info...",
  "Пожалуйста, заполните все обязательные поля":
    "Please fill in all required fields",
  "Ошибка при сохранении оффера": "Error saving the offer",
  "Онлайн на сайте": "Site activity",
  "Сколько учеников на платформе, когда они заходят и сколько времени проводят":
    "How many students are on the platform, when they visit, and how long they stay",
  "К статистике": "Back to stats",
  "Загружаем статистику…": "Loading stats…",
  Период: "Period",
  "7 дней": "7 days",
  "14 дней": "14 days",
  "30 дней": "30 days",
  "Сводка онлайна": "Online summary",
  "Сейчас онлайн": "Online now",
  "Пик сегодня": "Today's peak",
  "Пик за период": "Peak for the period",
  "Учеников заходило за период": "Students who visited in the period",
  "Сейчас на сайте": "On the site now",
  "Пик онлайна по дням": "Daily online peak",
  "Нажмите на день, чтобы увидеть его по часам":
    "Click a day to see it by hour",
  "По часам": "By hour",
  "Время на сайте по ученикам": "Time on site by student",
  "Считается шагами замера: короткий визит тоже даёт полный шаг":
    "Counted in sampling steps: even a short visit counts as a full step",
  "Дней с визитами": "Days with visits",
  "другая страница": "other page",
  "По часам за {day} (МСК)": "By hour on {day} (MSK)",
  "За период никто не заходил": "No one visited in this period",
  МСК: "MSK",
  "Замер раз в {minutes} минут, последний — в {time}. Онлайн — ученики, открывавшие сайт за эти {minutes} минут.":
    "Sampled every {minutes} minutes, last at {time}. Online means students who opened the site in those {minutes} minutes.",
  "В последнем замере никого не было": "No one was online in the last sample",
  "Не удалось загрузить статистику онлайна.": "Couldn't load online stats.",
  "Заказы за грады": "Grad orders",
  "Кто что заказал на витрине и что ещё нужно выдать":
    "Who ordered what from the shop and what still needs to be handed out",
  "Фильтр заказов": "Order filter",
  "Статус заказа": "Order status",
  "Ждут выдачи ·": "Awaiting delivery ·",
  Выданные: "Delivered",
  Отменённые: "Cancelled",
  "Заморозки серии выдаются сами и сразу попадают в «Выданные»":
    "Streak freezes are delivered automatically and go straight to “Delivered”",
  Выдано: "Delivered",
  "Отменён, грады возвращены": "Cancelled, grads refunded",
  "{count} градов": "{count} grads",
  "Выдано автоматически": "Delivered automatically",
  Сумма: "Total",
  Заказан: "Ordered",
  "Отменить заказ и вернуть грады ученику":
    "Cancel the order and refund the grads to the student",
  Отменить: "Cancel",
  "Все заказы выданы": "All orders have been delivered",
  "Таких заказов нет": "No such orders",
  "Не удалось загрузить заказы": "Couldn't load orders",
  "Отменить заказ и вернуть ученику {count} градов?":
    "Cancel the order and refund {count} grads to the student?",
  "Не удалось изменить заказ": "Couldn't update the order",
  "Прогресс учеников — Mentor Stats": "Student progress — Mentor Stats",
  "Прогресс учеников": "Student progress",
  "Прохождение материала по всем разделам":
    "Material completion across all sections",
  "← Статистика": "← Stats",
  Активные: "Active",
  Завершившие: "Finished",
  Ушедшие: "Departed",
  "↓ По прогрессу": "↓ By progress",
  "↑ По прогрессу": "↑ By progress",
  "По имени": "By name",
  "— учеников": "— students",
  "Heatmap: ученики × разделы": "Heatmap: students × sections",
  "Скачать PNG": "Download PNG",
  "Матрица: сколько вопросов каждый ученик решил в каждом разделе":
    "Matrix: how many questions each student solved in each section",
  "У вас нет доступа": "You don't have access",
  "Ошибка подключения к Firebase": "Firebase connection error",
  "Нет учеников по выбранному фильтру": "No students match the selected filter",
  "{count} вопросов": "{count} questions",
  активен: "active",
  завершил: "finished",
  ушёл: "departed",
  "Быстрые переходы": "Quick links",
  "Календарь ученика": "Student calendar",
  "Учебный план ученика": "Student study plan",
  "Доступы ученика": "Student access",
  "Среднее по группе": "Group average",
  "Решённые вопросы: ученики × разделы":
    "Solved questions: students × sections",
  "{students} · разделов: {sections} · {date} · в скобках — всего вопросов в разделе":
    "{students} · sections: {sections} · {date} · total questions per section in parentheses",
  "{students} по текущему фильтру × разделов: {sections}. В ячейке — число решённых вопросов, максимум {max}.":
    "{students} in the current filter × {sections} sections. Each cell shows solved questions, max {max}.",
  "Матем.": "Math",
  "Всего сообщений": "Total reports",
  Закрытые: "Closed",
  "Загружаем сообщения...": "Loading reports...",
  "Сводка сообщений": "Report summary",
  "Фильтры сообщений": "Report filters",
  "Поиск по вопросу, ученику, странице или тексту сообщения":
    "Search by question, student, page, or report text",
  "Фильтр по статусу": "Filter by status",
  Новое: "New",
  "У вас нет доступа к сообщениям об ошибках":
    "You don't have access to error reports",
  "Не удалось подключиться к Firebase": "Couldn't connect to Firebase",
  "Не удалось загрузить сообщения": "Couldn't load reports",
  "Сообщений по этому фильтру пока нет": "No reports match this filter yet",
  "Ссылка недоступна": "Link unavailable",
  "Открыть вопрос": "Open question",
  "Показать код ученика": "Show the student's code",
  "Вопрос без названия": "Untitled question",
  "Идентификатор вопроса": "Question ID",
  "Сообщение пустое": "The report is empty",
  "Изменить статус сообщения": "Change report status",
  "Не удалось обновить статус сообщения": "Couldn't update the report status",
  "Ученик не указан": "Student not specified",
  "Дата не указана": "No date",
  "Что ученики отметили в ответах RAG-чата":
    "What students flagged in RAG chat answers",
  "Всего по фильтру": "Total for filter",
  Загружено: "Loaded",
  "Ответы «нет в материалах»": "“Not in materials” answers",
  "Продолжения диалога": "Follow-ups",
  "👎 Плохие": "👎 Bad",
  "👍 Хорошие": "👍 Good",
  "Загружаем оценки…": "Loading ratings…",
  "Сводка оценок": "Ratings summary",
  "Фильтры оценок": "Rating filters",
  "Поиск по вопросу, поисковому запросу, источникам или ученику":
    "Search by question, search query, sources, or student",
  "Фильтр по оценке": "Filter by rating",
  "Вопрос в чате": "Chat question",
  "Не удалось загрузить оценки": "Couldn't load ratings",
  "Оценок пока нет": "No ratings yet",
  "По запросу ничего не найдено": "Nothing found",
  "👎 Плохой ответ": "👎 Bad answer",
  "👍 Хороший ответ": "👍 Good answer",
  "Ответил: нет в материалах": "Answered: not in materials",
  "Продолжение диалога": "Follow-up",
  "Искали в базе": "Retrieval query",
  "Сборка индекса": "Index build",
  "Показать вопрос и ответ целиком": "Show full question and answer",
  "Запрос ученика": "Student's request",
  "Ответ ассистента": "Assistant's answer",
  "Не удалось загрузить полный текст": "Couldn't load the full text",
  "Управление учениками": "Student management",
  "👤 Карточка ученика": "👤 Student card",
  Аккаунт: "Account",
  "Выбери аккаунт": "Choose an account",
  "Выбери ученика": "Choose a student",
  "Выберите аккаунт — его настройки появятся в одной компактной карточке.":
    "Choose an account — its settings will appear in one compact card.",
  "👤 Роль": "👤 Role",
  "Роль аккаунта": "Account role",
  "Curator получает рабочие инструменты, но не назначает роли.":
    "A curator gets the working tools but can't assign roles.",
  "Установить роль": "Set role",
  "🎓 Формат обучения": "🎓 Learning format",
  Формат: "Format",
  "«Только материалы» — платный доступ к платформе без менторства. Менять формат может только mentor.":
    "“Materials only” is paid platform access without mentorship. Only a mentor can change the format.",
  "Сохранить формат": "Save format",
  "✏️ Имя и контакты": "✏️ Name and contacts",
  "Изменить имя": "Change name",
  "🤝 Ответственный": "🤝 Assigned to",
  "Привязать к": "Assign to",
  "Без куратора": "No curator",
  "Этот бейдж видят только mentor и curator.":
    "Only mentors and curators see this badge.",
  "Сохранить привязку": "Save assignment",
  "🔐 Доступ к материалам": "🔐 Material access",
  "Выберите ученика в карточке выше.": "Choose a student in the card above.",
  "Детальный обзор по разделам": "Detailed overview by section",
  "Количество новых запросов": "Number of new requests",
  "📨 Telegram сотрудников": "📨 Staff Telegram",
  Сотрудник: "Staff member",
  "Например, 123456789": "E.g., 123456789",
  "Числовой ID личного чата с MentorBot. Сотрудник должен сначала открыть диалог с ботом.":
    "Numeric ID of the private chat with MentorBot. The staff member must open a chat with the bot first.",
  "Сохранить chat ID": "Save chat ID",
  "🔔 Уведомления кураторов": "🔔 Curator notifications",
  Куратор: "Curator",
  "Ежедневные отчёты учеников": "Students' daily reports",
  "Запросы доступа к материалам": "Material access requests",
  "Настройки применяются только к Telegram-уведомлениям по ученикам этого куратора.":
    "Settings apply only to Telegram notifications about this curator's students.",
  "Сохранить настройки": "Save settings",
  "Выберите профессиональный трек": "Choose a professional track",
  "Ученик:": "Student:",
  ". База и Deep Learning добавятся автоматически. Выданные ранее разделы сохранятся.":
    ". Basics and Deep Learning are added automatically. Previously granted sections are kept.",
  "Выдать доступ": "Grant access",
  "Обработка запроса...": "Processing request...",
  "Ошибка инициализации Firebase": "Firebase initialization error",
  "Выберите сотрудника": "Choose a staff member",
  "Введите положительный числовой Telegram chat ID":
    "Enter a positive numeric Telegram chat ID",
  "Telegram chat ID сохранён": "Telegram chat ID saved",
  "Выберите куратора": "Choose a curator",
  "Настройки уведомлений сохранены": "Notification settings saved",
  "Ошибка загрузки данных": "Data loading error",
  "Только mentor может выдавать тарифные доступы":
    "Only a mentor can grant plan access",
  "Не удалось определить выбранный тариф или трек":
    "Couldn't determine the selected plan or track",
  "В тарифе нет доступных разделов. Проверьте categories-config.json":
    "The plan has no available sections. Check categories-config.json",
  "Выберите трек, прежде чем выдавать доступ":
    "Choose a track before granting access",
  "Не удалось закрыть все разделы": "Couldn't close all sections",
  "Только mentor или admin может массово открывать разделы всем ученикам":
    "Only a mentor or admin can open sections for all students at once",
  "Выберите раздел для массовой выдачи": "Choose a section to grant in bulk",
  "Не удалось сохранить доступ": "Couldn't save access",
  "Аккаунт не найден": "Account not found",
  "Только ментор может менять формат обучения":
    "Only a mentor can change the learning format",
  "Выберите ученика и формат обучения":
    "Choose a student and a learning format",
  "Ученик не найден": "Student not found",
  "Только ментор может менять ответственного":
    "Only a mentor can change the assignee",
  "Пожалуйста, выберите ученика из списка":
    "Please choose a student from the list",
  "Выбранный ответственный больше недоступен":
    "The selected assignee is no longer available",
  "Пожалуйста, выберите аккаунт из списка":
    "Please choose an account from the list",
  "Введите корректное имя (буквы, 2–20 символов)":
    "Enter a valid first name (letters, 2–20 characters)",
  "Введите корректную фамилию (буквы, 2–20 символов)":
    "Enter a valid last name (letters, 2–20 characters)",
  "Telegram: @username от 5 символов (буквы/цифры/_)":
    "Telegram: @username, at least 5 characters (letters/digits/_)",
  "Можно редактировать имя только своих учеников":
    "You can only edit the names of your own students",
  "Сначала выберите ученика в карточке выше":
    "First choose a student in the card above",
  "Не удалось обработать запрос доступа: {error}":
    "Couldn't process the access request: {error}",
  "Не удалось сохранить Telegram chat ID: {error}":
    "Couldn't save the Telegram chat ID: {error}",
  "Не удалось сохранить настройки: {error}": "Couldn't save settings: {error}",
  "Не удалось выдать тариф: {error}": "Couldn't grant the plan: {error}",
  "Ошибка при установке роли: {error}": "Error setting the role: {error}",
  "Ошибка сохранения формата: {error}": "Error saving the format: {error}",
  "Ошибка сохранения ответственного: {error}":
    "Error saving the assignee: {error}",
  "Ошибка при изменении имени: {error}": "Error changing the name: {error}",
  "Не удалось открыть раздел всем ученикам: {error}":
    "Couldn't open the section for all students: {error}",
  "У вас нет доступа к управлению учениками":
    "You don't have access to student management",
  "Новых запросов доступа нет.": "No new access requests.",
  "Обработка запроса доступа": "Access request actions",
  "Доступы для {name} открыты": "Access granted to {name}",
  "Запрос {name} отклонён": "{name}'s request declined",
  "Нет аккаунтов": "No accounts",
  "Выбери аккаунт ({count})": "Choose an account ({count})",
  "нет роли": "no role",
  "Выбери ученика ({count})": "Choose a student ({count})",
  "только материалы": "materials only",
  менторство: "mentorship",
  "Куратор недоступен": "Curator unavailable",
  Ментор: "Mentor",
  Пульт: "Dashboard",
  "Открыть пульт ученика": "Open the student dashboard",
  "Открыть прогресс ученика": "Open the student's progress",
  "Открыть календарь ученика": "Open the student's calendar",
  "Открыть учебный план ученика": "Open the student's study plan",
  Открыт: "Open",
  Частично: "Partial",
  Закрыт: "Closed",
  "открыт (клик: закрыть)": "open (click to close)",
  "закрыт (клик: открыть)": "closed (click to open)",
  "Пакет ещё не назначен": "No plan assigned yet",
  "Выдача тарифа «{plan}» для {name}…": "Granting the “{plan}” plan to {name}…",
  "Для {name} выдан тариф «{plan}»: открыто {added} новых разделов":
    "Granted the “{plan}” plan to {name}: {added} new sections opened",
  ", ещё {count} уже были открыты": ", {count} more were already open",
  ". Всего доступно {count}.": ". {count} available in total.",
  ученика: "student",
  "уже выдан": "already granted",
  "Быстрая выдача тарифа": "Quick plan grant",
  "Тариф добавляет разделы к уже открытым и ничего не забирает. Чтобы закрыть раздел, снимите его чипом ниже.":
    "A plan adds sections to those already open and never removes any. To close a section, toggle its chip below.",
  "Настройка доступов": "Access settings",
  "Открыть все": "Open all",
  "Выдать доступ ко всем разделам из categories-config":
    "Grant access to all sections in categories-config",
  "Открытие всех разделов для {name}…": "Opening all sections for {name}…",
  "Открыты все {total} разделов для {name}":
    "All {total} sections opened for {name}",
  "Открыто {done} из {total} разделов": "Opened {done} of {total} sections",
  "Не удалось открыть разделы": "Couldn't open sections",
  "Закрыть все": "Close all",
  "Снять доступ ко всем разделам из categories-config":
    "Revoke access to all sections in categories-config",
  "Закрыть доступ ко всем {total} разделам для «{name}»?":
    "Revoke access to all {total} sections for “{name}”?",
  "Закрытие всех разделов для {name}…": "Closing all sections for {name}…",
  "Закрыты все {total} разделов для {name}":
    "All {total} sections closed for {name}",
  "Раздел, который нужно открыть всем аккаунтам с ролью student":
    "Section to open for all accounts with the student role",
  "Раздел для всех student...": "Section for all students...",
  "Открыть всем student": "Open for all students",
  "Открыть выбранный раздел всем пользователям с ролью student":
    "Open the selected section for all users with the student role",
  "Открыть раздел «{section}» всем аккаунтам с ролью student?":
    "Open the “{section}” section for all accounts with the student role?",
  "Открытие раздела «{section}» всем student...":
    "Opening the “{section}” section for all students...",
  "Раздел «{section}» открыт для student: проверено {total}, новых записей доступа {changed}":
    "The “{section}” section is open for students: {total} checked, {changed} new access records",
  "Все {count} разделов из конфига — для выбранного ученика.":
    "All {count} sections from the config — for the selected student.",
  "Выберите ученика в карточке выше, затем откройте или закройте разделы.":
    "Choose a student in the card above, then open or close sections.",
  "Нажмите для деталей": "Click for details",
  "Открытие «{module}» для {name}…": "Opening “{module}” for {name}…",
  "Открыт модуль «{module}» ({count} разделов) для {name}":
    "Opened the “{module}” module ({count} sections) for {name}",
  "Закрытие «{module}» для {name}…": "Closing “{module}” for {name}…",
  "Закрыт модуль «{module}» для {name}":
    "Closed the “{module}” module for {name}",
  'Установка роли "{role}" для {name}...':
    'Setting the "{role}" role for {name}...',
  'Роль "{role}" установлена для {name}!':
    'The "{role}" role is set for {name}!',
  "Сохранение формата «{format}» для {name}...":
    "Saving the “{format}” format for {name}...",
  "Для {name} установлен формат «{format}»":
    "The “{format}” format is set for {name}",
  "Сохранение ответственного для {name}...":
    "Saving the assignee for {name}...",
  "Для {name} сохранено: {curator}.": "Saved for {name}: {curator}.",
  "Изменение имени для {name}...": "Changing the name for {name}...",
  'Имя изменено на "{name}"!': 'Name changed to "{name}"!',
  // (конец секции staff)

  // ── Доска предложений (suggestions.html, suggestions.js) ──
  // @i18n-section:suggestions — переводы этой группы дописываются сразу под этой строкой.
  Предложения: "Suggestions",
  "Предлагай, что улучшить на платформе, и голосуй за идеи других. Самые популярные забираем в работу первыми.":
    "Suggest what to improve on the platform and vote for other people's ideas. The most popular ones go into work first.",
  "Предложить идею": "Suggest an idea",
  "Коротко: что улучшить": "In short: what to improve",
  "Подробнее: зачем это нужно и как ты это видишь":
    "Details: why it matters and how you see it",
  Заголовок: "Title",
  Категория: "Category",
  Сайт: "Site",
  Опубликовать: "Publish",
  Статус: "Status",
  Внедрено: "Shipped",
  Архив: "Archive",
  "Загружаем предложения…": "Loading suggestions…",
  Открыто: "Open",
  Запланировано: "Planned",
  Отклонено: "Declined",
  Дубль: "Duplicate",
  "Примечание для учеников": "Note for students",
  Примечание: "Note",
  "Голосов: {count}": "Votes: {count}",
  Ты: "You",
  "Здесь пока пусто.": "Nothing here yet.",
  "Не удалось загрузить предложения.": "Couldn't load suggestions.",
  "Опубликовано. Спасибо!": "Published. Thank you!",
  "Не удалось отправить.": "Couldn't send.",
  "Внедрённое предложение": "Shipped suggestion",
  "Когда твою идею с доски предложений внедрили":
    "When your idea from the suggestions board ships",
  "Найденная ошибка в вопросе": "Error found in a question",
  "Когда ошибку в вопросе, о которой ты сообщил, исправили":
    "When the error you reported in a question gets fixed",

  // (конец секции suggestions)

  // ── Интерфейс страниц материалов (прогресс, бейджи, оглавление, подсказки терминов, доступ, ответы, код, жалобы, сложность) ──
  // @i18n-section:materials-ui — переводы этой группы дописываются сразу под этой строкой.
  // interview-videos.js — аудиозаписи собеседований
  Аудио: "Audio",
  "Прослушать запись": "Listen to the recording",
  "Фидбек и подробности": "Feedback and details",
  // quiz.js — тесты блоков
  "Тест блока {n}": "Block {n} test",
  "Проверьте себя по блоку": "Check yourself on this block",
  // exercise-checker.js — проверка кода
  "условие истинно": "condition is true",
  "Проверка {n}": "Check {n}",
  Вызов: "Call",
  Условие: "Condition",
  Ожидаем: "Expected",
  "Эти тесты сами создают временные файлы. Для локального дебага скопируй весь блок: в нём есть и содержимое файлов, и вызовы функций.":
    "These tests create temporary files themselves. To debug locally, copy the whole block: it has both the file contents and the function calls.",
  "Проверочные тесты": "Tests",
  "Смысл проверок показан карточками, ниже — точный код автопроверки.":
    "The cards explain what is checked; below is the exact auto-check code.",
  "Скопировать тесты": "Copy tests",
  "Точный Python-код": "Exact Python code",
  "Это сбой сервера проверки, а не провал теста — твой код тут, скорее всего, ни при чём.":
    "This is a checker server failure, not a failed test — your code is most likely fine.",
  "Подожди минуту и нажми «Проверить решение» ещё раз: сервер мог перезапускаться.":
    "Wait a minute and click “Check solution” again: the server may have been restarting.",
  "Если повторяется — скопируй код и текст ошибки выше и отправь через кнопку «В тексте ошибка?» под вопросом. Подробности уже записаны в консоль браузера (F12 → Console).":
    "If it keeps happening, copy your code and the error text above and send them via the “Found a mistake?” button under the question. Details are already logged to the browser console (F12 → Console).",
  "Сервер не принял запрос": "The server rejected the request",
  "Сервер проверки не найден по этому адресу":
    "Checker server not found at this address",
  "По этому адресу нет сервера проверки":
    "There is no checker server at this address",
  "Сессия истекла: обнови страницу и войди заново":
    "Session expired: reload the page and log in again",
  "Нет доступа к проверке этого задания":
    "You don't have access to check this task",
  "Код слишком длинный для отправки": "The code is too long to send",
  "Сервер не понял формат запроса":
    "The server didn't understand the request format",
  "Подождите перед следующей попыткой": "Please wait before trying again",
  "Сервер проверки не запущен или перезапускается":
    "The checker server isn't running or is restarting",
  "Сервер проверки временно недоступен":
    "The checker server is temporarily unavailable",
  "Сервер проверки не ответил вовремя":
    "The checker server didn't respond in time",
  "Сервер проверки не ответил за 30 секунд":
    "The checker server didn't respond within 30 seconds",
  "Попробуй ещё раз.": "Please try again.",
  "Сервер проверки вернул ошибку": "The checker server returned an error",
  "Сервер проверки недоступен": "The checker server is unavailable",
  "Не удалось связаться с сервером проверки: нет сети, запрос заблокирован или сервер не запущен.":
    "Couldn't reach the checker server: no network, the request was blocked, or the server isn't running.",
  "Проверить решение": "Check solution",
  отступ: "indent",
  убрать: "unindent",
  проверить: "check",
  "выйти из поля": "leave the editor",
  Скопировано: "Copied",
  "Не удалось скопировать": "Couldn't copy",
  "Выполняется…": "Running…",
  "Необходима авторизация": "Please log in",
  "Не удалось выполнить проверку": "Couldn't run the check",
  "Ошибка выполнения:": "Runtime error:",
  Вывод: "Output",
  "Все тесты пройдены ({passed}/{total})":
    "All tests passed ({passed}/{total})",
  "Пройдено {passed} из {total}": "Passed {passed} of {total}",
  "Что подалось на вход": "Input",
  "Что выдал код": "Your output",
  "Ожидаемый ответ": "Expected output",
  "Все тесты пройдены": "All tests passed",
  "стр. {row}": "line {row}",
  "Замечания линтера ({count})": "Linter warnings ({count})",
  "Установи ruff локально:": "Install ruff locally:",

  // question-badges.js — бейджи, сложность, шкала «на собесах», фильтры
  Обязательно: "Required",
  Дополнительно: "Additional",
  "Можно учить позже": "Can learn later",
  Ресерч: "Research",
  Средне: "Medium",
  Сложно: "Hard",
  "Сложность: {level}": "Difficulty: {level}",
  "практически не спрашивают": "almost never asked",
  "спрашивают редко": "rarely asked",
  "спрашивают примерно в половине случаев": "asked in about half of interviews",
  "спрашивают часто, 60–70% собеседований":
    "asked often, in 60–70% of interviews",
  "спрашивают почти всегда, 80–90% собеседований":
    "asked almost always, in 80–90% of interviews",
  "На собеседованиях: {level} из 5 — {hint}":
    "In interviews: {level} of 5 — {hint}",
  собес: "interview",
  "Можно сдавать в IDE": "Can be submitted from an IDE",
  "Можно сдавать вне сайта": "Can be submitted outside the site",
  "Показано: {visible} из {total}": "Showing {visible} of {total}",
  "ссылка на источник": "link to source",

  // difficulty-rating.js, question-presentation.js — оценка сложности и кнопка «пройдено»
  "Не удалось сохранить сложность. Обнови страницу и проверь, что ты вошёл в аккаунт.":
    "Couldn't save the difficulty. Reload the page and make sure you're logged in.",
  Решено: "Solved",
  "Проверяется автоматически": "Checked automatically",
  "Пометить решенной": "Mark as solved",
  "Ваша оценка: {rating} (нажми еще раз для отмены)":
    "Your rating: {rating} (click again to undo)",
  "Очень легко": "Very easy",
  "Очень сложно": "Very hard",
  Неизвестно: "Unknown",

  // core.js — кнопки «Показать/Скрыть …» и нумерация теорем
  "Скрыть {what}": "Hide {what}",
  "Показать {what}": "Show {what}",
  ответ: "answer",
  вывод: "derivation",
  идею: "idea",
  доказательство: "proof",
  "Показать идею": "Show idea",
  "Скрыть идею": "Hide idea",
  "Показать доказательство": "Show proof",
  "Скрыть доказательство": "Hide proof",
  Теорема: "Theorem",
  Лемма: "Lemma",
  Определение: "Definition",
  Аксиома: "Axiom",

  // question-reports.js — «В тексте ошибка?»
  "Найдена опечатка?": "Found a typo?",
  "Опиши проблему подробнее.": "Describe the problem in more detail.",
  "Например: тест падает с 500, формулировка непонятная, опечатка, неверный ожидаемый ответ...":
    "For example: the test fails with a 500, the wording is unclear, a typo, a wrong expected answer...",
  "Опиши проблему чуть подробнее.":
    "Please describe the problem in a bit more detail.",
  "Нужно войти в аккаунт, чтобы отправить сообщение.":
    "Log in to send a message.",
  "Отправляем...": "Sending...",
  "Спасибо, сообщение отправлено.": "Thanks, your message has been sent.",
  "Не удалось отправить. Попробуй обновить страницу или напиши ментору напрямую.":
    "Couldn't send it. Try reloading the page or message your mentor directly.",
  "В тексте ошибка?": "Found a mistake?",

  // math-answer.js — ответы практики по математике
  "{label}: компонента {n}": "{label}: component {n}",
  "{label}: строка {row}, столбец {col}": "{label}: row {row}, column {col}",
  "Компоненты — в любом порядке": "Components can be in any order",
  "Ответ на задачу": "Answer to the problem",
  "Ваш ответ": "Your answer",
  "Можно дробью {fraction}, корнем {root} или sqrt(2), через {pi} или {e}; десятичные — с точностью до сотых.":
    "Enter a fraction {fraction}, a root {root} or sqrt(2), {pi} or {e}; decimals are checked to two decimal places.",
  "Вставить символ": "Insert symbol",
  "Вставить {symbol}": "Insert {symbol}",
  Проверить: "Check",
  "Заполните все поля — пустые клетки не проверяются.":
    "Fill in all fields — empty cells aren't checked.",
  "Войдите, чтобы проверить ответ.": "Log in to check your answer.",
  "Проверяю…": "Checking…",
  "Верно! Задача отмечена решённой.":
    "Correct! The problem is marked as solved.",
  "Не удалось прочитать запись в жёлтых клетках — проверьте формат.":
    "Couldn't read the input in the yellow cells — check the format.",
  "Есть ошибки — они подсвечены красным.":
    "There are mistakes — they're highlighted in red.",
  "Не удалось проверить. Попробуйте ещё раз через минуту.":
    "Couldn't check it. Please try again in a minute.",

  // material-access-guard.js — закрытая страница и запрос доступа
  "Проверяем доступ к разделу…": "Checking access to this section…",
  "Доступ к странице закрыт": "This page is locked",
  "Вернуться к доступным материалам": "Back to available materials",
  "Для этой учебной страницы не настроена категория доступа. Обратитесь к ментору.":
    "No access category is set up for this page. Please contact your mentor.",
  "Не удалось безопасно проверить ваши доступы. Обновите страницу или обратитесь к ментору.":
    "Couldn't verify your access. Reload the page or contact your mentor.",
  "Запрос отправлен": "Request sent",
  "Запросить доступ": "Request access",
  "Отправляю запрос...": "Sending request...",
  "Запрос уже отправлен ментору.":
    "The request has already been sent to your mentor.",
  "Запрос отправлен. Ментор или куратор увидит его в дашборде.":
    "Request sent. Your mentor or curator will see it on their dashboard.",
  "Не удалось отправить запрос. Попробуй ещё раз или напиши ментору.":
    "Couldn't send the request. Try again or message your mentor.",
  "Доступ к разделу закрыт": "This section is locked",
  "Этот материал пока недоступен. Обратитесь к ментору или отправьте запрос на доступ к разделу {section}.":
    "This material isn't available to you yet. Contact your mentor or request access to {section}.",
  "Назад к Roadmap": "Back to Roadmap",

  // question-presentation.js — режим презентации
  "Вопрос {n}": "Question {n}",
  "Открыть вопросы в режиме презентации (удобно для записи видео)":
    "Open the questions in presentation mode (handy for recording videos)",
  "Выбрать слайд": "Choose slide",
  "Выбор слайда": "Slide selection",
  "Предыдущий вопрос": "Previous question",

  // runnable-code-block.js — запуск Python в браузере
  "Не удалось загрузить Python (Pyodide) с CDN. Проверь сеть или блокировщик рекламы и попробуй ещё раз.":
    "Couldn't load Python (Pyodide) from the CDN. Check your network or ad blocker and try again.",
  "Python аварийно завершился: {message}. Переменные из прошлых запусков сброшены.":
    "Python crashed: {message}. Variables from previous runs have been reset.",
  "неизвестная ошибка": "unknown error",
  "Выполнение остановлено через {seconds} с: похоже, бесконечный цикл или слишком тяжёлые вычисления. Переменные из прошлых запусков сброшены.":
    "Execution stopped after {seconds} s: probably an infinite loop or too heavy a computation. Variables from previous runs have been reset.",
  "Python не загрузился за {seconds} с.":
    "Python didn't load within {seconds} s.",
  "Программа ждёт ввод (input), {n} из {total}:":
    "The program is waiting for input, {n} of {total}:",
  "Ошибка выполнения": "Runtime error",
  График: "Plot",
  "Запустить код (Python 3.12 в браузере)":
    "Run code (Python 3.12 in the browser)",
  Запустить: "Run",
  "В очереди…": "Queued…",
  "Запуск…": "Starting…",
  "Загрузка Python…": "Loading Python…",
  "(вывод пуст)": "(no output)",

  // question-ai-help.js — меню «Ассистент» под вопросом (подсказки для RAG остаются русскими)
  Ассистент: "Assistant",

  // questions-toc.js, dictionary-sidebar.js — оглавление
  "Навигация по вопросам": "Question navigation",
  "Свернуть/развернуть": "Collapse/expand",
  "Свернуть/развернуть панель навигации":
    "Collapse/expand the navigation panel",
  "Прочитано: {done} из {total}": "Done: {done} of {total}",
  "Фильтр вопросов...": "Filter questions...",
  "Открыть навигацию по вопросам": "Open question navigation",
  Навигация: "Navigation",

  // progress-tracker-questions.js, roadmap-progress.js — прогресс
  "Пометить все": "Mark all as done",
  "Снять отметки": "Clear all marks",
  "Отметить всё?": "Mark all?",
  "Показывает действие для массовой отметки вопросов на этой странице.":
    "Shows the action to mark all questions on this page at once.",
  "Хочешь отметить все обычные вопросы на странице прочитанными? Автопроверяемые задачи засчитываются только после прохождения тестов.":
    "Mark all regular questions on this page as done? Auto-checked tasks count only after their tests pass.",
  "Прогресс: {value}": "Progress: {value}",
  "Появится с материалами": "Coming with the materials",
  "Прогресс появится с материалами":
    "Progress will appear once materials are added",

  // info-cards.js, section-hero.js, auto-unlock.js, image-zoom.js, lazy-questions.js
  "Можно сдавать вне сайта в IDE":
    "Can be submitted outside the site, from an IDE",
  "Новый раздел открыт!": "New section unlocked!",
  "Ты прошёл все вопросы и разблокировал: {label}":
    "You've completed all the questions and unlocked: {label}",
  "Увеличить изображение": "Zoom image",
  // image-zoom.js + gif-player.js — пауза и скорость GIF
  "Управление анимацией": "Animation controls",
  Воспроизвести: "Play",
  "Скорость {speed}×": "Speed {speed}×",
  "Свернуть тему": "Collapse topic",

  // общие кнопки и состояния (модалки жалоб, презентация, прогресс роадмапа)
  Отправить: "Send",

  // (конец секции materials-ui)
});
