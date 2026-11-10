/**
 * «Вопрос дня» на главной: один вопрос на сутки платформы, общий для всех.
 *
 * Вопрос выбирает браузер — rendezvous-хэш по пулу
 * (question-of-day-pool.json, его пишет scripts/generate-questions-list.js).
 * Сервер вопроса не знает: бандл функций выкатывается руками и отстаёт от
 * контента, а пул приезжает вместе с сайтом. Отметку и счётчик ведёт
 * callable claimQuestionOfDay; из базы браузер читает ровно два узла —
 * question_of_day/<день> (два обезличенных числа) и собственную отметку.
 *
 * Отметка — не клик, а самопроверка: кнопка открывает карточки теорминимума
 * этого вопроса (getTeorminCards с questionId), ученик вспоминает ответ,
 * сверяется и оценивает себя от 1 до 4; оценка идёт в общий счётчик
 * «ответили уверенно».
 *
 * Виджет необязательный, поэтому на главной любая ошибка тихая: нет пула —
 * виджета нет, не прочитался счётчик — нет числа. Ошибки самопроверки видны
 * только внутри её окна: текст отказа сервера и кнопка «Отправить ещё раз».
 */
(function () {
  "use strict";

  // Перевод интерфейса (ядро — сниппет theme-boot); в тестах его нет.
  const t =
    window.t ||
    ((text, params) =>
      text.replace(/\{(\w+)\}/g, (match, key) => params?.[key] ?? match));
  const isEnglish = () => window.i18n?.lang === "en";

  const POOL_URL = "/assets/js/config/question-of-day-pool.json";
  const STAFF_ROLES = new Set(["mentor", "admin", "curator", "admin-helper"]);
  // Сбой кошелька на сервере (paid: false): тихо повторяем, вызов идемпотентен.
  const UNPAID_RETRIES = 2;
  const UNPAID_PAUSE_MS = 3000;
  // Серверные пределы (functions/question-of-day.js): оценки принимаются не
  // раньше MIN_CHECK_MS после начала и не больше MAX_RATINGS штук. Клиент сам
  // выжидает остаток и не показывает лишних карточек — иначе честный быстрый
  // ответ упирался бы в экран ошибки, а длинный теорминимум нельзя было бы сдать.
  const QOD_MIN_CHECK_MS = 20 * 1000;
  const QOD_MAX_CARDS = 12;

  /** FNV-1a, 32 бита. */
  function hash(text) {
    let value = 0x811c9dc5;
    for (let index = 0; index < text.length; index += 1) {
      value = Math.imul(value ^ text.charCodeAt(index), 0x01000193);
    }
    return value >>> 0;
  }

  /**
   * Rendezvous-хэширование: вопрос дня — тот, у кого hash(день:id) меньше
   * всех. Вес вопроса не зависит от соседей, поэтому пересборка пула при
   * синхронизации контента (рутина, а не редкость) выбор не трогает.
   *
   * ponytail: вопрос сменится посреди суток, только если удалят его самого
   * или новый вопрос сам выиграет (вероятность 1/N на каждый добавленный).
   * Счётчик привязан к дню, а не к вопросу, и от этого не ломается; если
   * станет заметно — фиксировать id первого выбора в question_of_day/<день>.
   */
  function pickQuestion(pool, day) {
    let best = null;
    let bestWeight = Infinity;
    for (const question of Array.isArray(pool) ? pool : []) {
      if (!question || !question.id) continue;
      const weight = hash(`${day}:${question.id}`);
      if (
        weight < bestWeight ||
        (weight === bestWeight && question.id < best.id)
      ) {
        best = question;
        bestWeight = weight;
      }
    }
    return best;
  }

  // Те же четыре ступени, что на странице интервального повторения.
  const GRADES = [
    { value: 1, label: t("Снова"), hint: t("не вспомнил") },
    { value: 2, label: t("Трудно"), hint: t("с подсказкой") },
    { value: 3, label: t("Хорошо"), hint: t("вспомнил") },
    { value: 4, label: t("Легко"), hint: t("сразу") },
  ];

  function confidentText(confident) {
    return confident > 0 ? t("{count} уверенно", { count: confident }) : "";
  }

  function solvedText(solved, claimed) {
    if (!(solved > 0)) return "";
    if (isEnglish()) {
      const who = solved === 1 ? "1 person" : `${solved} people`;
      return claimed ? `already solved by ${who}` : `solved by ${who} today`;
    }
    const mod10 = solved % 10;
    const mod100 = solved % 100;
    const people =
      mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)
        ? "человека"
        : "человек";
    const verb = mod10 === 1 && mod100 !== 11 ? "разобрал" : "разобрали";
    return `${claimed ? "уже" : "сегодня"} ${verb} ${solved} ${people}`;
  }


  async function fetchJson(url) {
    const response = await fetch(url, { cache: "no-cache" });
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    return response.json();
  }

  async function readValue(db, path) {
    try {
      return (await db.ref(path).once("value")).val();
    } catch (error) {
      // До выкатки правил оба чтения запрещены — это не поломка.
      return null;
    }
  }

  /**
   * Ключ суток по серверным часам: .info/serverTimeOffset — локальное чтение,
   * в базу не ходит. С часами устройства, убежавшими за полночь, отметка
   * искалась бы под чужим днём, и кнопка висела бы вечно.
   */
  async function serverDay(db) {
    const offset = Number(await readValue(db, ".info/serverTimeOffset")) || 0;
    return window.platformDayKey(Date.now() + offset);
  }

  async function render(options) {
    const { uid, userData, db } = options || {};
    const root = document.getElementById("questionOfDay");
    const link = document.getElementById("questionOfDayLink");
    const meta = document.getElementById("questionOfDayMeta");
    const topic = document.getElementById("questionOfDayTopic");
    const button = document.getElementById("questionOfDayButton");
    if (!root || !link || !meta || !button || !uid || !userData || !db) return;
    const role = String(userData.role || "")
      .trim()
      .toLowerCase();
    if (STAFF_ROLES.has(role)) return;

    let pool = null;
    try {
      pool = await fetchJson(POOL_URL);
    } catch (error) {
      console.warn("question-of-day: pool is unavailable", error);
      return;
    }

    const day = await serverDay(db);
    const [counters, marker] = await Promise.all([
      readValue(db, `question_of_day/${day}`),
      readValue(db, `question_of_day_solvers/${day}/${uid}`),
    ]);

    // Вопрос общий для всех, поэтому из «доступного подмножества» не
    // выбираем: раздел закрыт ментором — виджета в этот день просто нет.
    function show(state) {
      const question = pickQuestion(pool, state.day);
      if (!question || userData.materialAccess?.[question.category] !== true) {
        root.hidden = true;
        return;
      }
      link.textContent = question.title;
      link.href = question.url;
      // Название вопроса без темы бывает непонятным («Timeouts, retries…» —
      // это про GitHub Actions). Старый пул без topic — просто без бейджа.
      if (topic) topic.textContent = question.topic || "";
      const parts = state.claimed ? [`✓ ${t("Разобран")}`] : [];
      parts.push(solvedText(Number(state.solved) || 0, state.claimed));
      parts.push(confidentText(Number(state.confident) || 0));
      currentQuestion = question;
      shownDay = state.day;
      const text = parts.filter(Boolean).join(" · ");
      meta.textContent = text.charAt(0).toUpperCase() + text.slice(1);
      root.classList.toggle("is-done", state.claimed);
      button.hidden = state.claimed;
      root.hidden = false;
    }

    let currentQuestion = null;
    let shownDay = day;

    async function claimOnce(ratings) {
      // Повтор безопасен: сервер отмечает ученика один раз в сутки, а оценки
      // нужны ему только для первой, ещё не состоявшейся отметки.
      const result = await window.achievementApi.call(
        "claimQuestionOfDay",
        ratings ? { ratings } : {},
        { retry: true },
      );
      // Рисуем под день, который засчитал сервер, а не под тот, с которым
      // открылась страница.
      show({
        day: result.day,
        claimed: true,
        solved: result.solved,
        confident: result.confident,
      });
      return result;
    }

    async function claim(ratings) {
      return claimOnce(ratings);
    }

    show({
      day,
      claimed: Boolean(marker?.at),
      solved: counters?.solved,
      confident: counters?.confident,
    });

    // Отметка есть, а счёт или выплата не подтверждены (сбой на сервере в
    // прошлый раз): один тихий вызов на загрузку главной всё добирает. В
    // штатном состоянии оба флага стоят, и callable отсюда не зовётся.
    if (marker?.at && marker.counted !== true) {
      claim().catch((error) =>
        console.warn("question-of-day: settle failed", error),
      );
    }

    button.addEventListener("click", () => {
      if (currentQuestion) openCheck(currentQuestion, claim, db, shownDay);
    });
  }

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function typeset(element) {
    if (typeof renderMathInElement !== "function") return;
    try {
      renderMathInElement(element, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "\\[", right: "\\]", display: true },
          { left: "$", right: "$", display: false },
          { left: "\\(", right: "\\)", display: false },
        ],
        throwOnError: false,
      });
    } catch (error) {
      console.warn("question-of-day: math render failed", error);
    }
  }

  function ensureDialog() {
    let dialog = document.getElementById("questionOfDayDialog");
    if (dialog) return dialog;
    dialog = node("dialog", "qod-dialog");
    dialog.id = "questionOfDayDialog";
    dialog.setAttribute("aria-labelledby", "questionOfDayDialogTitle");
    // Клик по затемнению закрывает окно, как Esc.
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
    document.body.append(dialog);
    return dialog;
  }

  /**
   * Самопроверка: карточки вопроса по одной — вспомнить, открыть ответ,
   * оценить себя. Награда приходит после последней карточки.
   */
  async function openCheck(question, claim, db, renderedDay) {
    const dialog = ensureDialog();
    const close = node("button", "qod-dialog-close", "✕");
    close.type = "button";
    close.setAttribute("aria-label", t("Закрыть"));
    close.addEventListener("click", () => dialog.close());
    const title = node("h2", "qod-dialog-title", question.title);
    title.id = "questionOfDayDialogTitle";
    const head = node("div", "qod-dialog-head");
    const heading = node("div");
    heading.append(node("span", "main-qod-label", t("Вопрос дня")), title);
    head.append(heading, close);
    const body = node("div", "qod-dialog-body");
    body.append(node("p", "qod-dialog-note", t("Загружаем карточки…")));
    dialog.replaceChildren(head, body);
    if (!dialog.open) dialog.showModal();

    const openedAt = Date.now();
    // Страница вопроса без ведущего слэша — в таком виде она лежит в карточках.
    const targetPage = String(question.url || "")
      .split("#")[0]
      .replace(/^\/+/, "");
    let cards = [];
    try {
      const [, response] = await Promise.all([
        // Сервер запоминает начало: оценки он примет не раньше чем через 20 секунд.
        window.achievementApi.call(
          "claimQuestionOfDay",
          { phase: "start" },
          { retry: true },
        ),
        window.achievementApi.call(
          "getTeorminCards",
          {
            questionId: question.id,
            targetPage,
            lang: window.i18n?.lang === "en" ? "en" : "ru",
          },
          { retry: true },
        ),
      ]);
      // Фильтр по вопросу дублирует серверный: версия getTeorminCards без
      // questionId вернула бы все пройденные карточки ученика — не те.
      // id уникален на странице, а не на сайте (`median` есть на двух), поэтому
      // сверяем и страницу.
      cards = (Array.isArray(response?.cards) ? response.cards : [])
        .filter(
          (card) =>
            card?.questionId === question.id &&
            (!card.targetPage || card.targetPage === targetPage),
        )
        .slice(0, QOD_MAX_CARDS);
    } catch (error) {
      console.warn("question-of-day: cards are unavailable", error);
      body.replaceChildren(
        node(
          "p",
          "qod-dialog-note",
          t("Не удалось загрузить карточки. Попробуйте ещё раз чуть позже."),
        ),
      );
      return;
    }

    // У вопроса может не быть блока теорминимума — тогда одна общая ступень.
    const steps = cards.length
      ? cards.map((card) => ({
          promptHtml: card.promptHtml,
          answerHtml: card.answerHtml,
        }))
      : [{ fallback: true }];
    const ratings = [];

    function renderStep(index) {
      const step = steps[index];
      const progress = node(
        "p",
        "qod-dialog-progress",
        steps.length > 1
          ? t("Карточка {index} из {total}", {
              index: index + 1,
              total: steps.length,
            })
          : t("Самопроверка"),
      );
      const prompt = node("div", "qod-card-side");
      const answer = node("div", "qod-card-side qod-card-answer");
      answer.hidden = true;
      if (step.fallback) {
        prompt.append(
          node(
            "p",
            "",
            t(
              "У этого вопроса нет карточек для самопроверки. Откройте материал, разберите его и попробуйте объяснить тему вслух — как на собеседовании.",
            ),
          ),
        );
        answer.append(
          node("p", "", t("Насколько уверенно получилось объяснить?")),
        );
      } else {
        // HTML карточек собирает сервер из нашего же контента (:::teormin).
        prompt.innerHTML = step.promptHtml || "";
        answer.innerHTML = step.answerHtml || "";
      }
      const material = node(
        "a",
        "qod-dialog-material",
        `${t("Открыть материал")} ↗`,
      );
      material.href = question.url;
      material.target = "_blank";
      material.rel = "noopener";

      const reveal = node(
        "button",
        "main-qod-button",
        step.fallback ? t("Я разобрал материал") : t("Показать ответ"),
      );
      reveal.type = "button";
      const grades = node("div", "qod-grades");
      grades.hidden = true;
      grades.setAttribute("role", "group");
      grades.setAttribute("aria-label", t("Насколько хорошо вы знали ответ"));
      GRADES.forEach((grade) => {
        const button = node("button", `qod-grade qod-grade-${grade.value}`);
        button.type = "button";
        button.append(
          node("b", "", grade.label),
          node("small", "", grade.hint),
        );
        button.addEventListener("click", () => {
          ratings[index] = grade.value;
          if (index + 1 < steps.length) renderStep(index + 1);
          else submit();
        });
        grades.append(button);
      });
      reveal.addEventListener("click", () => {
        answer.hidden = false;
        grades.hidden = false;
        reveal.hidden = true;
        grades.querySelector("button")?.focus();
      });
      const hint = node(
        "p",
        "qod-dialog-note",
        t(
          "Сначала ответьте про себя, потом откройте ответ и оцените, насколько уверенно вспомнили.",
        ),
      );
      body.replaceChildren(
        progress,
        prompt,
        answer,
        reveal,
        grades,
        material,
        hint,
      );
      typeset(body);
      reveal.focus();
    }

    async function submit() {
      body.replaceChildren(node("p", "qod-dialog-note", t("Засчитываем…")));
      try {
        // Сервер не примет оценки раньше 20 секунд от начала. Короткий вопрос
        // честно проходится быстрее — дожидаемся здесь, а не показываем отказ.
        await sleep(
          Math.max(0, QOD_MIN_CHECK_MS + 1000 - (Date.now() - openedAt)),
        );
        await claim(ratings);
        dialog.close();
      } catch (error) {
        console.warn("question-of-day: claim failed", error);
        // Окно пережило полночь по Москве: начало записано во вчерашних
        // сутках, вопрос дня уже другой. Честнее начать заново, чем засчитать
        // сегодняшний вопрос по вчерашним карточкам.
        const dayChanged = (await serverDay(db)) !== renderedDay;
        const retry = node(
          "button",
          "main-qod-button",
          dayChanged ? t("Обновить страницу") : t("Отправить ещё раз"),
        );
        retry.type = "button";
        retry.addEventListener(
          "click",
          dayChanged ? () => window.location.reload() : submit,
        );
        body.replaceChildren(
          node(
            "p",
            "qod-dialog-note",
            dayChanged
              ? t(
                  "Начались новые сутки — вопрос дня сменился. Обновите страницу, чтобы открыть сегодняшний.",
                )
              : // Сервер объясняет отказ сам — показываем как есть.
                error?.message ||
                  t("Не удалось засчитать. Попробуйте ещё раз."),
          ),
          retry,
        );
      }
    }

    renderStep(0);
  }

  window.questionOfDay = {
    render: (options) =>
      render(options).catch((error) =>
        console.warn("question-of-day: render failed", error),
      ),
    _private: { pickQuestion, solvedText, confidentText },
  };
})();
