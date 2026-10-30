/**
 * math-answer.js
 *
 * Ввод ответа в задачах практики по математике: для <li data-answers> рисует
 * поля — число, вектор столбцом, матрицу сеткой, выбор варианта — и шлёт
 * введённое в callable checkPracticeAnswers. Эталона в браузере нет: в
 * data-answers только форма ({ page, fields }), вердикт приходит с сервера
 * по каждой клетке. Когда всё верно, вопрос отмечается решённым так же, как
 * после автопроверки кода (exercise-checker.js).
 */
(function () {
  "use strict";

  // Перевод интерфейса (ядро — сниппет theme-boot). В тестах под Node его нет:
  // остаётся русский текст с подставленными значениями.
  const t =
    window.t ||
    ((text, params) =>
      text.replace(/\{(\w+)\}/g, (match, key) => params?.[key] ?? match));

  // insert — что попадёт в клетку (его разбирает сервер), label — подпись
  // кнопки для KaTeX.
  const KEYPAD = [
    { insert: "√", label: "$\\sqrt{x}$" },
    { insert: "π", label: "$\\pi$" },
    { insert: "e", label: "$e$" },
    { insert: "^", label: "$x^{n}$" },
    { insert: "/", label: "$a/b$" },
  ];

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function typeset(node) {
    if (typeof window.renderMathInElement !== "function") return;
    try {
      window.renderMathInElement(node, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "$", right: "$", display: false },
          { left: "\\(", right: "\\)", display: false },
        ],
        throwOnError: false,
      });
    } catch (_) {
      /* подпись останется текстом */
    }
  }

  // ── Черновик ───────────────────────────────────────────────────────────────
  // Введённое живёт в localStorage этого браузера: уход со страницы не должен
  // стирать матрицу 3×3. На сервер черновик не уходит.

  function draftKey(key) {
    const uid = window.firebase?.auth?.().currentUser?.uid || "anon";
    return `math-answer:${uid}:${key}`;
  }

  function loadDraft(key) {
    try {
      return JSON.parse(localStorage.getItem(draftKey(key)) || "null");
    } catch (_) {
      return null;
    }
  }

  function saveDraft(key, value) {
    try {
      localStorage.setItem(draftKey(key), JSON.stringify(value));
    } catch (_) {
      /* приватное окно — живём без черновика */
    }
  }

  // ── Поля ──────────────────────────────────────────────────────────────────

  function cellInput(fieldId, row, col) {
    const input = el("input", "mans-cell");
    input.type = "text";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.setAttribute("autocapitalize", "off");
    input.dataset.field = fieldId;
    input.dataset.row = row;
    input.dataset.col = col;
    return input;
  }

  function bracket(rows, cols, fieldId, label) {
    const box = el("div", "mans-bracket");
    const grid = el("div", "mans-grid");
    grid.style.gridTemplateColumns = `repeat(${cols}, auto)`;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const input = cellInput(fieldId, r, c);
        input.setAttribute(
          "aria-label",
          cols === 1
            ? t("{label}: компонента {n}", { label, n: r + 1 })
            : t("{label}: строка {row}, столбец {col}", {
                label,
                row: r + 1,
                col: c + 1,
              }),
        );
        grid.appendChild(input);
      }
    }
    box.appendChild(grid);
    return box;
  }

  function buildField(field) {
    const row = el("div", `mans-field mans-field--${field.type}`);
    row.dataset.field = field.id;
    const plainLabel = field.label.replace(/\$/g, "") || field.id;
    const label = el("div", "mans-label", field.label || field.id);
    row.appendChild(label);

    if (field.type === "choice") {
      const group = el("div", "mans-choices");
      group.setAttribute("role", "radiogroup");
      group.setAttribute("aria-label", plainLabel);
      field.options.forEach((option, index) => {
        const button = el("button", "mans-choice");
        button.type = "button";
        button.setAttribute("role", "radio");
        button.setAttribute("aria-checked", "false");
        button.dataset.index = index;
        button.textContent = option;
        group.appendChild(button);
      });
      row.appendChild(group);
      typeset(row);
      return row;
    }

    const value = el("div", "mans-value");
    value.appendChild(el("span", "mans-eq", "="));
    if (field.type === "number") {
      const input = cellInput(field.id, 0, 0);
      input.classList.add("mans-cell--wide");
      input.setAttribute("aria-label", plainLabel);
      value.appendChild(input);
    } else if (field.type === "vector") {
      value.appendChild(bracket(field.size, 1, field.id, plainLabel));
    } else {
      value.appendChild(bracket(field.rows, field.cols, field.id, plainLabel));
    }
    row.appendChild(value);
    if (field.unordered) {
      row.appendChild(
        el("div", "mans-note", t("Компоненты — в любом порядке")),
      );
    }
    typeset(row);
    return row;
  }

  // ── Сбор и раскладка значений ─────────────────────────────────────────────

  function collect(root, fields) {
    const answers = {};
    for (const field of fields) {
      const box = root.querySelector(`.mans-field[data-field="${field.id}"]`);
      if (field.type === "choice") {
        const picked = box.querySelector('.mans-choice[aria-checked="true"]');
        answers[field.id] = picked ? Number(picked.dataset.index) : null;
        continue;
      }
      const cells = [...box.querySelectorAll(".mans-cell")];
      if (field.type === "number") answers[field.id] = cells[0].value;
      else if (field.type === "vector")
        answers[field.id] = cells.map((c) => c.value);
      else
        answers[field.id] = Array.from({ length: field.rows }, (_, r) =>
          cells.slice(r * field.cols, (r + 1) * field.cols).map((c) => c.value),
        );
    }
    return answers;
  }

  function apply(root, fields, answers) {
    if (!answers) return;
    for (const field of fields) {
      const value = answers[field.id];
      const box = root.querySelector(`.mans-field[data-field="${field.id}"]`);
      if (value == null || !box) continue;
      if (field.type === "choice") {
        box.querySelectorAll(".mans-choice").forEach((b) => {
          b.setAttribute(
            "aria-checked",
            String(Number(b.dataset.index) === value),
          );
        });
        continue;
      }
      const flat = [].concat(...[].concat(value));
      box.querySelectorAll(".mans-cell").forEach((cell, i) => {
        cell.value = flat[i] ?? "";
      });
    }
  }

  function isComplete(fields, answers) {
    return fields.every((field) => {
      const value = answers[field.id];
      if (field.type === "choice") return value !== null;
      return [].concat(...[].concat(value)).every((v) => String(v).trim());
    });
  }

  const STATE_CLASSES = ["mans-cell--ok", "mans-cell--bad", "mans-cell--parse"];

  function stateClass(cell) {
    if (cell === true) return "mans-cell--ok";
    return cell === "parse" ? "mans-cell--parse" : "mans-cell--bad";
  }

  /** Раскрашивает клетки по вердикту, возвращает число «непонятных». */
  function paint(root, fields, verdict) {
    let unparsed = 0;
    for (const field of fields) {
      const result = verdict.fields?.[field.id];
      const box = root.querySelector(`.mans-field[data-field="${field.id}"]`);
      if (!result || !box) continue;
      if (field.type === "choice") {
        box.classList.toggle("mans-field--ok", result.correct);
        box.classList.toggle("mans-field--bad", !result.correct);
        continue;
      }
      const flat = [].concat(...[].concat(result.cells));
      box.querySelectorAll(".mans-cell").forEach((cell, i) => {
        cell.classList.remove(...STATE_CLASSES);
        cell.classList.add(stateClass(flat[i]));
        if (flat[i] === "parse") unparsed += 1;
      });
    }
    return unparsed;
  }

  // ── Клавиатура ────────────────────────────────────────────────────────────

  function moveFocus(root, input, dr, dc) {
    const target = root.querySelector(
      `.mans-cell[data-field="${input.dataset.field}"][data-row="${Number(input.dataset.row) + dr}"][data-col="${Number(input.dataset.col) + dc}"]`,
    );
    if (!target) return false;
    target.focus();
    target.select();
    return true;
  }

  function insertAtCaret(input, text) {
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    input.setRangeText(text, start, end, "end");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  // ── Сборка карточки ───────────────────────────────────────────────────────

  function progressId(li) {
    return li.querySelector(".name[id]")?.id || li.dataset.mdId || "";
  }

  function build(li, form) {
    const { page, fields } = form;
    const questionId = li.dataset.mdId;
    const key = `${page}#${questionId}`;

    const root = el("section", "mans");
    root.setAttribute("aria-label", t("Ответ на задачу"));
    const head = el("div", "mans-head");
    head.appendChild(el("div", "mans-title", t("Ваш ответ")));
    head.appendChild(
      el(
        "div",
        "mans-hint",
        t(
          "Можно дробью {fraction}, корнем {root} или sqrt(2), через {pi} или {e}; десятичные — с точностью до сотых.",
          { fraction: "$3/4$", root: "$\\sqrt{2}$", pi: "$\\pi$", e: "$e$" },
        ),
      ),
    );
    typeset(head);
    root.appendChild(head);

    const body = el("div", "mans-fields");
    fields.forEach((field) => body.appendChild(buildField(field)));
    root.appendChild(body);

    const footer = el("div", "mans-footer");
    const hasCells = fields.some((f) => f.type !== "choice");
    let lastCell = null;
    if (hasCells) {
      const keypad = el("div", "mans-keypad");
      keypad.setAttribute("aria-label", t("Вставить символ"));
      for (const { insert, label } of KEYPAD) {
        const key = el("button", "mans-key", label);
        key.setAttribute(
          "aria-label",
          t("Вставить {symbol}", { symbol: insert }),
        );
        key.type = "button";
        key.tabIndex = -1;
        // mousedown не забирает фокус у клетки.
        key.addEventListener("mousedown", (e) => e.preventDefault());
        key.addEventListener("click", () => {
          const target = lastCell || root.querySelector(".mans-cell");
          target.focus();
          insertAtCaret(target, insert);
        });
        keypad.appendChild(key);
      }
      typeset(keypad);
      footer.appendChild(keypad);
    }
    const submit = el("button", "mans-submit", t("Проверить"));
    submit.type = "button";
    const status = el("div", "mans-status");
    status.setAttribute("aria-live", "polite");
    footer.appendChild(status);
    footer.appendChild(submit);
    root.appendChild(footer);

    function setStatus(text, tone) {
      status.textContent = text;
      status.className = `mans-status${tone ? ` mans-status--${tone}` : ""}`;
    }

    function changed(target) {
      target?.classList?.remove(...STATE_CLASSES);
      target
        ?.closest?.(".mans-field")
        ?.classList.remove("mans-field--ok", "mans-field--bad");
      root.classList.remove("mans--solved");
      setStatus("");
      saveDraft(key, collect(root, fields));
    }

    root.addEventListener("focusin", (e) => {
      if (e.target.classList.contains("mans-cell")) lastCell = e.target;
    });
    root.addEventListener("input", (e) => changed(e.target));
    root.addEventListener("click", (e) => {
      const choice = e.target.closest(".mans-choice");
      if (!choice) return;
      choice.parentElement
        .querySelectorAll(".mans-choice")
        .forEach((b) => b.setAttribute("aria-checked", String(b === choice)));
      changed(choice);
    });
    root.addEventListener("keydown", (e) => {
      const input = e.target;
      if (e.key === "Enter") {
        e.preventDefault();
        if (input.classList.contains("mans-choice")) input.click();
        else check();
        return;
      }
      if (!input.classList.contains("mans-cell")) return;
      const atStart = input.selectionStart === 0 && input.selectionEnd === 0;
      const atEnd = input.selectionStart === input.value.length;
      const moves = {
        ArrowUp: [-1, 0, true],
        ArrowDown: [1, 0, true],
        ArrowLeft: [0, -1, atStart],
        ArrowRight: [0, 1, atEnd],
      };
      const move = moves[e.key];
      if (move && move[2] && moveFocus(root, input, move[0], move[1])) {
        e.preventDefault();
      }
    });

    let busy = false;
    async function check() {
      if (busy) return;
      const answers = collect(root, fields);
      if (!isComplete(fields, answers)) {
        setStatus(
          t("Заполните все поля — пустые клетки не проверяются."),
          "warn",
        );
        return;
      }
      if (!window.achievementApi || !window.firebase?.auth?.().currentUser) {
        setStatus(t("Войдите, чтобы проверить ответ."), "warn");
        return;
      }
      busy = true;
      submit.disabled = true;
      setStatus(t("Проверяю…"));
      try {
        const payload = { targetPage: page, questionId, answers };
        const verdict =
          window.__schmidtOfflineChecker &&
          typeof window.__schmidtOfflineMathCheck === "function"
            ? await window.__schmidtOfflineMathCheck(payload)
            : await window.achievementApi.call("checkPracticeAnswers", payload);
        if (verdict?.error) {
          setStatus(verdict.error, "warn");
          return;
        }
        if (
          !verdict ||
          typeof verdict.correct !== "boolean" ||
          !verdict.fields ||
          typeof verdict.fields !== "object"
        ) {
          console.error("[math-answer] invalid checker response", verdict);
          setStatus(
            t("Сервис проверки не вернул результат. Обновите страницу и попробуйте снова."),
            "warn",
          );
          return;
        }
        const unparsed = paint(root, fields, verdict);
        if (verdict.correct) {
          root.classList.add("mans--solved");
          setStatus(t("Верно! Задача отмечена решённой."), "ok");
          window.questionProgressTracker?.markQuestionCompleted(
            progressId(li),
            true,
          );
        } else if (unparsed) {
          setStatus(
            t(
              "Не удалось прочитать запись в жёлтых клетках — проверьте формат.",
            ),
            "warn",
          );
        } else {
          setStatus(t("Есть ошибки — они подсвечены красным."), "bad");
        }
      } catch (error) {
        console.warn("[math-answer] check failed", error);
        const text =
          error.code === "RESOURCE_EXHAUSTED"
            ? error.message
            : t("Не удалось проверить. Попробуйте ещё раз через минуту.");
        setStatus(text, "bad");
      } finally {
        busy = false;
        submit.disabled = false;
      }
    }
    submit.addEventListener("click", check);

    Promise.resolve(window.authReady)
      .catch(() => {})
      .then(() => apply(root, fields, loadDraft(key)));

    return root;
  }

  // lazy-questions.js держит содержимое вопроса в <template> и вставляет его
  // заново при раскрытии, а при выгрузке очищает: карточку приходится
  // пересобирать. Живые карточки помним здесь; копия, попавшая в шаблон до
  // превращения в <template>, — без обработчиков, её заменяем. Введённое
  // возвращает черновик.
  const live = new WeakSet();

  function initQuestion(li) {
    const content = li.querySelector(".content");
    if (!content || !content.childElementCount) return;
    const existing = content.querySelector(".mans");
    if (existing && live.has(existing)) return;
    let form;
    try {
      form = JSON.parse(li.dataset.answers);
    } catch (_) {
      return;
    }
    if (!Array.isArray(form?.fields) || !form.page) return;
    existing?.remove();
    const root = build(li, form);
    live.add(root);
    content.appendChild(root);
  }

  function initAll() {
    document
      .querySelectorAll("li.question[data-answers]")
      .forEach(initQuestion);
  }

  function start() {
    initAll();
    // Вопросы подгружаются лениво (lazy-questions.js) — ловим новые.
    new MutationObserver(initAll).observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
