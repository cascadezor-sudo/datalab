/**
 * Term Tooltip System
 * Позволяет добавлять определения терминов, которые показываются при наведении.
 *
 * Способы:
 * 1) Инлайн: <span class="term-tooltip" data-title="..." data-definition="...">термин</span>
 * 2) По ключу: <span class="term-tooltip" data-term="ИП">ИП</span> — определение из TERM_DEFINITIONS.
 * 3) Автообёртка: на странице с data-term-scope термины из JSON автоматически оборачиваются
 *    в подсказки по всем вхождениям в тексте (ручные span не нужны).
 */

/**
 * Определяет, является ли текущее устройство "touch-first" (нет hover) —
 * проверяется динамически при каждом вызове, а не кэшируется, чтобы
 * гибридные устройства (тачскрин + мышь) корректно работали для обоих вводов.
 */
function isTouchDevice() {
  return !!(
    window.matchMedia &&
    window.matchMedia("(hover: none), (pointer: coarse)").matches
  );
}

/**
 * Закрывает все открытые тапом попапы термина, кроме переданного.
 */
function closeAllTermTooltips(except) {
  document.querySelectorAll(".term-tooltip-popup.visible").forEach((popup) => {
    if (popup === except) return;
    popup.classList.remove("visible");
  });
}

/**
 * Единый обработчик resize: двигает только видимые попапы.
 * Раньше каждый термин вешал свой listener на window — на странице с тысячами
 * терминов это тысячи обработчиков, срабатывающих на каждое изменение размера.
 */
function setupGlobalResizeReposition() {
  let resizeTimeout;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      document
        .querySelectorAll(".term-tooltip-popup.visible")
        .forEach((popup) => {
          if (typeof popup._updatePosition === "function") {
            popup._updatePosition();
          }
        });
    }, 100);
  });
}

/**
 * Единый обработчик на document: закрывает открытый попап при тапе вне
 * термина и вне самого попапа. Регистрируется один раз (не на каждый термин),
 * чтобы не плодить дублирующиеся listener'ы на страницах с десятками терминов.
 */
function setupGlobalTouchDismiss() {
  document.addEventListener("click", (e) => {
    if (!isTouchDevice()) return;
    document
      .querySelectorAll(".term-tooltip-popup.visible")
      .forEach((popup) => {
        const owner = popup._ownerElement;
        if (
          owner &&
          (owner === e.target || (owner.contains && owner.contains(e.target)))
        )
          return;
        if (popup.contains(e.target)) return;
        popup.classList.remove("visible");
      });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isTouchDevice()) closeAllTermTooltips();
  });
}

/**
 * Создает popup с определением термина
 * @param {HTMLElement} element - Элемент с классом term-tooltip
 */
function createTermTooltip(element) {
  // Слушатели уже навешаны — попап создастся лениво при первом показе
  if (element._tooltipBound) {
    return;
  }

  // Не показывать тултип в навигации, section-shell, заголовках вопросов, заголовках info-card и блоках кода
  if (
    element.closest &&
    (element.closest(".questions-toc") ||
      element.closest(".question .name") ||
      element.closest(".code-block") ||
      element.closest(".section-shell") ||
      element.closest("#navbar") ||
      element.closest(".info-card .info-title"))
  ) {
    return;
  }

  // Определение: сначала инлайн (data-definition), затем из центрального хранилища (data-term)
  var termKey = element.dataset.term;
  var known =
    termKey && window.TERM_DEFINITIONS && window.TERM_DEFINITIONS[termKey];

  // Без определения вешать обработчики незачем; актуальный текст ensurePopup перечитает сам
  if (!(element.dataset.definition || (known && known.definition))) {
    return;
  }

  element._tooltipBound = true;

  let hoverTimeout;
  let hideTimeout;
  let isHoveringElement = false;
  let isHoveringPopup = false;

  /**
   * Создаёт попап при первом показе. До этого момента в DOM его нет:
   * на странице с тысячами терминов ленивое создание экономит и узлы, и рендеры KaTeX.
   * Если попап удалили извне (перерисовка контента), он будет создан заново.
   */
  const ensurePopup = () => {
    if (element._tooltipPopup && element._tooltipPopup.isConnected) {
      return element._tooltipPopup;
    }

    // Определение перечитываем здесь, а не берём захваченное при привязке: сброс попапов
    // в обработчике termdefinitionsready как раз рассчитан на то, что попап пересоберётся
    // по свежему словарю (в том числе после registerTermDefinitions).
    var stored =
      termKey && window.TERM_DEFINITIONS && window.TERM_DEFINITIONS[termKey];
    var definition =
      element.dataset.definition || (stored && stored.definition) || "";
    var title =
      element.dataset.title ||
      (stored && stored.title) ||
      element.textContent.trim();

    const popup = document.createElement("div");
    popup.className = "term-tooltip-popup";

    const position = element.dataset.position || "bottom";
    popup.classList.add(position);

    const titleHtml = escapeHtml(title);
    const definitionHtml =
      definition.includes("<") && definition.includes(">")
        ? definition
        : escapeHtml(definition).replace(/\n/g, "<br>");

    var sectionLabel =
      stored &&
      stored.section &&
      window.TERM_DEFINITIONS_SECTION_LABELS &&
      window.TERM_DEFINITIONS_SECTION_LABELS[stored.section]
        ? escapeHtml(window.TERM_DEFINITIONS_SECTION_LABELS[stored.section])
        : "";
    var badgeHtml = sectionLabel
      ? '<div class="term-tooltip-badge">' + sectionLabel + "</div>"
      : "";

    popup.innerHTML =
      badgeHtml +
      `
    <div class="term-tooltip-title">${titleHtml}</div>
    <div class="term-tooltip-content">${definitionHtml}</div>
  `;

    // Добавляем popup в body для правильного позиционирования
    document.body.appendChild(popup);
    popup._ownerElement = element;

    // Рендерим KaTeX в тултипе ($...$, \[...\], \(...\), $$...$$)
    if (typeof renderMathInElement === "function") {
      try {
        renderMathInElement(popup, {
          delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "$", right: "$", display: false },
            { left: "\\(", right: "\\)", display: false },
            { left: "\\[", right: "\\]", display: true },
          ],
          throwOnError: false,
        });
      } catch (e) {
        console.warn("Term tooltip KaTeX render failed:", e);
      }
    }

    // Обработка позиционирования при наведении
    const updatePosition = () => {
      // Временно показываем popup для получения его размеров
      popup.style.display = "block";
      popup.style.visibility = "hidden";
      popup.style.opacity = "0";
      popup.style.position = "fixed";
      popup.style.top = "0";
      popup.style.left = "0";

      const rect = element.getBoundingClientRect();
      const popupRect = popup.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // По умолчанию позиционируем снизу, центрируем по горизонтали
      let finalTop = rect.bottom + 8;
      let finalLeft = rect.left + rect.width / 2 - popupRect.width / 2;

      // Проверяем, помещается ли снизу
      if (finalTop + popupRect.height > viewportHeight - 10) {
        // Не помещается снизу, пробуем сверху
        finalTop = rect.top - popupRect.height - 8;
        if (finalTop < 10) {
          // Не помещается и сверху, используем то, что есть (снизу)
          finalTop = rect.bottom + 8;
        }
      }

      // Проверяем горизонтальное позиционирование
      if (finalLeft < 10) {
        finalLeft = 10;
      } else if (finalLeft + popupRect.width > viewportWidth - 10) {
        finalLeft = viewportWidth - popupRect.width - 10;
      }

      // Устанавливаем позицию
      popup.style.top = `${finalTop}px`;
      popup.style.left = `${finalLeft}px`;
      popup.style.visibility = "visible";
      popup.style.opacity = "";
    };

    // Общий обработчик resize (см. setupGlobalResizeReposition) двигает только видимые попапы
    popup._updatePosition = updatePosition;

    // Показываем popup при наведении на popup и отменяем скрытие
    popup.addEventListener("mouseenter", () => {
      clearTimeout(hideTimeout);
      isHoveringPopup = true;
      if (!popup.classList.contains("visible")) {
        updatePosition();
        popup.style.display = "block";
        popup.classList.add("visible");
      }
    });

    // Скрываем только когда курсор покидает popup
    popup.addEventListener("mouseleave", () => {
      isHoveringPopup = false;
      hideTooltip();
    });

    // Сохраняем ссылку на popup в элементе для доступа
    element._tooltipPopup = popup;
    return popup;
  };

  const showTooltip = () => {
    clearTimeout(hoverTimeout);
    clearTimeout(hideTimeout);
    isHoveringElement = true;
    // Небольшая задержка для плавного появления
    hoverTimeout = setTimeout(() => {
      if (isHoveringElement || isHoveringPopup) {
        const popup = ensurePopup();
        popup._updatePosition();
        // Убеждаемся, что popup видим
        popup.style.display = "block";
        popup.classList.add("visible");
      }
    }, 100);
  };

  const hideTooltip = () => {
    clearTimeout(hoverTimeout);
    // Небольшая задержка перед скрытием, чтобы можно было переместить курсор на popup
    hideTimeout = setTimeout(() => {
      if (!isHoveringElement && !isHoveringPopup) {
        if (element._tooltipPopup) {
          element._tooltipPopup.classList.remove("visible");
        }
      }
    }, 200);
  };

  element.addEventListener("mouseenter", () => {
    isHoveringElement = true;
    showTooltip();
  });

  element.addEventListener("mouseleave", () => {
    isHoveringElement = false;
    hideTooltip();
  });

  // Тач-устройства: тап по термину открывает/закрывает попап (hover недоступен).
  // На устройствах с мышью обработчик ничего не делает — hover продолжает работать как раньше.
  element.addEventListener("click", (e) => {
    if (!isTouchDevice()) return;
    e.preventDefault();
    e.stopPropagation();
    const popup = ensurePopup();
    const willShow = !popup.classList.contains("visible");
    closeAllTermTooltips(popup);
    if (willShow) {
      popup._updatePosition();
      popup.style.display = "block";
      popup.classList.add("visible");
    } else {
      popup.classList.remove("visible");
    }
  });
}

/**
 * Экранирует HTML для безопасности
 */
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/** Экранирует строку для использования в RegExp */
function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Теги, внутри которых не ищем термины для автообёртки. Inline (b, strong, i, span и т.д.) не в списке — в них тултипы проставляются. */
var AUTO_WRAP_SKIP_TAGS = {
  SCRIPT: 1,
  STYLE: 1,
  NOSCRIPT: 1,
  CODE: 1,
  PRE: 1,
  TEMPLATE: 1,
};

/** Контейнеры, внутри которых не оборачиваем термины: навбар, section-shell, боковая навигация, заголовки вопросов, блоки кода. */
var AUTO_WRAP_SKIP_CLOSEST = [
  ".questions-toc",
  ".question .name",
  ".code-block",
  ".section-shell",
  "#navbar",
];

/**
 * Многозначное слово («контейнер» — докеровский и питоновский) описывается
 * в JSON полем pages: список префиксов пути, на которых термин уместен.
 * Без этого поля термин оборачивается на всех страницах.
 */
function termAllowedOnPage(entry, path) {
  if (!entry || !Array.isArray(entry.pages) || !entry.pages.length) return true;
  for (var i = 0; i < entry.pages.length; i++) {
    if (
      typeof entry.pages[i] === "string" &&
      path.indexOf(entry.pages[i]) === 0
    )
      return true;
  }
  return false;
}

/**
 * Строит список терминов для автообёртки.
 * В JSON у термина:
 * - pattern (регулярное выражение) — флаги giu (u для Unicode/кириллицы).
 *   Границы слова: использовать (?<!\\p{L}) в начале и (?!\\p{L}) в конце, не \\b —
 *   \\b в JS не учитывает кириллицу как «слово», совпадений не будет.
 * - иначе key + aliases — точные строки с границами слова.
 */
function getTermsForAutoWrap(scope) {
  var defs = window.TERM_DEFINITIONS;
  if (!defs || typeof defs !== "object") return [];
  var scopeNorm = scope && String(scope).replace(/-/g, "_");
  // /en/… — английская копия той же страницы: фильтр pages сравнивает
  // русский путь.
  var path = ((window.location && window.location.pathname) || "").replace(
    /^\/en(?=\/)/,
    "",
  );
  var terms = [];
  for (var key in defs) {
    var entry = defs[key];
    if (!entry || typeof entry !== "object") continue;
    if (scopeNorm && scopeNorm !== "all" && entry.section !== scopeNorm)
      continue; /* all = все разделы */
    if (!termAllowedOnPage(entry, path))
      continue; /* многозначное слово — только на своих страницах */
    if (
      entry.pattern &&
      typeof entry.pattern === "string" &&
      entry.pattern.length > 0
    ) {
      try {
        terms.push({
          key: key,
          pattern: new RegExp(entry.pattern, "giu"),
          length: 0,
        });
      } catch (e) {
        console.warn(
          'Term definitions: invalid pattern for "' + key + '":',
          e.message,
        );
      }
      continue;
    }
    var matchStrings = [key].concat(entry.aliases || []);
    for (var i = 0; i < matchStrings.length; i++) {
      var s = matchStrings[i];
      if (typeof s !== "string" || !s.length) continue;
      terms.push({
        key: key,
        pattern: new RegExp("\\b" + escapeRegex(s) + "\\b", "gi"),
        length: s.length,
      });
    }
  }
  terms.sort(function (a, b) {
    return b.length - a.length;
  });
  return terms;
}

/**
 * Обходит все текстовые узлы в контейнере. Обрабатывается и текст внутри inline-элементов (b, strong, i, em, span и т.д.).
 * Не заходим только в: SCRIPT, STYLE, CODE, PRE, TEMPLATE, .term-tooltip, .katex.
 */
function walkTextNodes(container, callback) {
  if (!container) return;
  var skip = function (el) {
    if (!el || el.nodeType !== 1) return true;
    if (AUTO_WRAP_SKIP_TAGS[el.tagName]) return true;
    if (el.closest && el.closest(".term-tooltip")) return true;
    if (el.classList && el.classList.contains("katex")) return true;
    if (el.closest && el.closest(".katex")) return true;
    for (var i = 0; i < AUTO_WRAP_SKIP_CLOSEST.length; i++) {
      if (el.closest && el.closest(AUTO_WRAP_SKIP_CLOSEST[i])) return true;
    }
    return false;
  };
  function walk(node) {
    if (node.nodeType === 3) {
      if (node.textContent && node.textContent.trim().length > 0)
        callback(node);
      return;
    }
    if (node.nodeType !== 1) return;
    if (skip(node)) return;
    for (var i = 0; i < node.childNodes.length; i++) {
      walk(node.childNodes[i]);
    }
  }
  walk(container);
}

/**
 * Возвращает массив диапазонов [start, end) в тексте, которые находятся внутри LaTeX-формул
 * ($...$, \[...\], \(...\), $$...$$). Термины внутри этих диапазонов не оборачиваем в tooltip,
 * чтобы не ломать рендеринг KaTeX на странице.
 */
function getMathRanges(text) {
  var ranges = [];
  var i = 0;
  var end;
  while (i < text.length) {
    if (text.substr(i, 2) === "$$") {
      end = text.indexOf("$$", i + 2);
      if (end !== -1) {
        ranges.push([i, end + 2]);
        i = end + 2;
        continue;
      }
    }
    if (text.substr(i, 2) === "\\[") {
      end = text.indexOf("\\]", i + 2);
      if (end !== -1) {
        ranges.push([i, end + 2]);
        i = end + 2;
        continue;
      }
    }
    if (text.substr(i, 2) === "\\(") {
      end = text.indexOf("\\)", i + 2);
      if (end !== -1) {
        ranges.push([i, end + 2]);
        i = end + 2;
        continue;
      }
    }
    if (text[i] === "$") {
      end = text.indexOf("$", i + 1);
      if (end !== -1) {
        ranges.push([i, end + 1]);
        i = end + 1;
        continue;
      }
    }
    i++;
  }
  return ranges;
}

/** Проверяет, пересекается ли отрезок [index, index+length) с каким-либо из ranges [start, end). */
function overlapsMathRange(index, length, ranges) {
  for (var r = 0; r < ranges.length; r++) {
    var start = ranges[r][0];
    var end = ranges[r][1];
    if (index < end && index + length > start) return true;
  }
  return false;
}

/**
 * В одном текстовом узле находит все непересекающиеся вхождения терминов (при равном начале — длиннее),
 * заменяет узел на фрагмент: текст + span + текст + span + ...
 * Совпадения внутри LaTeX-формул ($...$, \[...\], ...) не оборачиваются.
 */
function wrapMatchesInTextNode(textNode, terms, createdOut) {
  var text = textNode.textContent;
  if (!text || terms.length === 0) return;
  var mathRanges = getMathRanges(text);
  var matches = [];
  for (var t = 0; t < terms.length; t++) {
    var term = terms[t];
    if (term.pattern.global) term.pattern.lastIndex = 0;
    try {
      var m;
      while ((m = term.pattern.exec(text)) !== null) {
        if (!overlapsMathRange(m.index, m[0].length, mathRanges)) {
          matches.push({
            key: term.key,
            index: m.index,
            length: m[0].length,
            text: m[0],
          });
        }
      }
    } catch (err) {
      console.warn(
        'Term tooltip pattern exec failed for "' + term.key + '":',
        err.message,
      );
    }
  }
  if (matches.length === 0) return;
  matches.sort(function (a, b) {
    if (a.index !== b.index) return a.index - b.index;
    return b.length - a.length;
  });
  var selected = [];
  var lastEnd = -1;
  for (var i = 0; i < matches.length; i++) {
    if (matches[i].index >= lastEnd) {
      selected.push(matches[i]);
      lastEnd = matches[i].index + matches[i].length;
    }
  }
  if (selected.length === 0) return;
  var parent = textNode.parentNode;
  if (!parent) return;
  var fragment = document.createDocumentFragment();
  var pos = 0;
  for (var j = 0; j < selected.length; j++) {
    var cur = selected[j];
    if (pos < cur.index) {
      fragment.appendChild(document.createTextNode(text.slice(pos, cur.index)));
    }
    var span = document.createElement("span");
    span.className = "term-tooltip";
    span.setAttribute("data-term", cur.key);
    span.textContent = cur.text;
    if (createdOut) createdOut.push(span);
    fragment.appendChild(span);
    pos = cur.index + cur.length;
  }
  if (pos < text.length) {
    fragment.appendChild(document.createTextNode(text.slice(pos)));
  }
  parent.replaceChild(fragment, textNode);
}

/**
 * Автоматически оборачивает вхождения терминов из TERM_DEFINITIONS в span.term-tooltip[data-term].
 * Вызывать после загрузки определений (termdefinitionsready) и только на страницах с data-term-scope.
 * @param {HTMLElement} [container=document.body] — контейнер для обхода (обычно body или .content при ленивой подгрузке).
 */
/**
 * V8 компилирует регулярку не при new RegExp, а при первых выполнениях, и на 500+ терминах
 * это сотни миллисекунд. Без прогрева вся эта стоимость ложится одной длинной задачей на
 * первый же текстовый узел. Прогреваем порциями по общему бюджету — так длинных задач не остаётся.
 */
var WARM_UP_SAMPLE =
  "обычный текст with latin words, цифрами 42 и знаками — чтобы прогреть все ветки регулярок";
var WARM_UP_PASSES = 2;

/** Сколько текстовых узлов обрабатываем синхронно: маленькие контейнеры не имеет смысла дробить. */
var AUTO_WRAP_SYNC_NODE_LIMIT = 400;
/**
 * Бюджет одной порции, мс. Держим заметно ниже 50 мс — порога, с которого браузер считает
 * задачу длинной и блокирующей отклик, но и не слишком мелко: между порциями есть накладные
 * расходы планировщика, и на 5 мс страница обходилась бы в разы дольше.
 */
var AUTO_WRAP_CHUNK_BUDGET_MS = 25;

function autoWrapNow() {
  return window.performance && window.performance.now
    ? window.performance.now()
    : Date.now();
}

/**
 * Планируем следующую порцию через setTimeout, а не requestIdleCallback: rIC ждёт настоящего
 * простоя и на загруженной странице растягивает обход на десятки секунд.
 */
function scheduleAutoWrapChunk(fn, delayMs) {
  setTimeout(fn, delayMs || 0);
}

/**
 * Замена текстового узла сбрасывает выделение, поэтому пока пользователь что-то выделяет,
 * обёртку откладываем. Не бесконечно: с зажатым выделением обход обязан всё равно завершиться.
 */
var SELECTION_DEFER_LIMIT_MS = 3000;
var SELECTION_DEFER_STEP_MS = 100;

function hasActiveSelection() {
  try {
    var sel = window.getSelection && window.getSelection();
    return !!(sel && sel.rangeCount > 0 && !sel.isCollapsed);
  } catch (e) {
    return false;
  }
}

/** Инициализирует только что созданные подсказки, не сканируя весь контейнер заново. */
function initCreatedTooltips(created) {
  for (var i = 0; i < created.length; i++) {
    var span = created[i];
    if (span.getAttribute("data-initialized")) continue;
    span.setAttribute("data-initialized", "true");
    createTermTooltip(span);
  }
}

function autoWrapTermTooltips(container, onDone) {
  container = container || document.body;
  if (
    !container ||
    !window.TERM_DEFINITIONS ||
    Object.keys(window.TERM_DEFINITIONS).length === 0
  ) {
    if (onDone) onDone();
    return;
  }
  var scope = document.body && document.body.getAttribute("data-term-scope");
  var terms = getTermsForAutoWrap(scope);
  if (terms.length === 0) {
    if (onDone) onDone();
    return;
  }
  var textNodes = [];
  walkTextNodes(container, function (node) {
    textNodes.push(node);
  });

  // Контейнер внутри документа обходим с проверкой isConnected: пока идут порции,
  // содержимое могли выгрузить (lazy-questions делает replaceChildren у свёрнутых вопросов),
  // и у оторванного узла parentNode остаётся ненулевым. Для отсоединённого контейнера
  // isConnected бесполезен — там остаётся прежняя проверка parentNode.
  var rooted = container.isConnected !== false;
  var i = 0;
  /** Обрабатывает узлы, пока не кончится бюджет (0 — без ограничения). */
  function processSlice(budgetMs, created) {
    var start = autoWrapNow();
    while (i < textNodes.length) {
      var node = textNodes[i];
      i++;
      var alive = rooted ? node.isConnected : !!node.parentNode;
      if (alive) wrapMatchesInTextNode(node, terms, created);
      if (budgetMs && autoWrapNow() - start >= budgetMs) break;
    }
  }

  if (textNodes.length <= AUTO_WRAP_SYNC_NODE_LIMIT) {
    processSlice(0, null);
    if (onDone) onDone();
    return;
  }

  // Крупный контейнер: режем работу на порции, между ними отдаём управление браузеру.
  // Подсказки в уже обработанной части начинают работать сразу, не дожидаясь конца обхода.
  var warmPass = 0;
  var warmIndex = 0;
  var deferStartedAt = 0;
  (function step() {
    // Фаза 1: прогрев регулярок порциями
    if (warmPass < WARM_UP_PASSES) {
      var warmStart = autoWrapNow();
      while (warmPass < WARM_UP_PASSES) {
        if (warmIndex >= terms.length) {
          warmPass++;
          warmIndex = 0;
          continue;
        }
        var term = terms[warmIndex];
        warmIndex++;
        try {
          term.pattern.lastIndex = 0;
          term.pattern.test(WARM_UP_SAMPLE);
          term.pattern.lastIndex = 0;
        } catch (e) {
          /* нерабочий паттерн отсеется на обычном проходе */
        }
        if (autoWrapNow() - warmStart >= AUTO_WRAP_CHUNK_BUDGET_MS) break;
      }
      scheduleAutoWrapChunk(step);
      return;
    }
    // Фаза 2: собственно обёртка
    if (hasActiveSelection()) {
      var nowMs = autoWrapNow();
      if (!deferStartedAt) deferStartedAt = nowMs;
      if (nowMs - deferStartedAt < SELECTION_DEFER_LIMIT_MS) {
        scheduleAutoWrapChunk(step, SELECTION_DEFER_STEP_MS);
        return;
      }
    } else {
      deferStartedAt = 0;
    }

    var created = [];
    try {
      processSlice(AUTO_WRAP_CHUNK_BUDGET_MS, created);
      initCreatedTooltips(created);
    } catch (e) {
      // Порции выполняются вне try/catch вызывающего кода: без этого одна ошибка
      // оборвала бы цепочку и остаток контейнера навсегда остался бы без подсказок.
      console.warn("Term tooltips auto-wrap chunk failed:", e);
    }
    if (i < textNodes.length) {
      scheduleAutoWrapChunk(step);
    } else if (onDone) {
      onDone();
    }
  })();
}

/**
 * Инициализирует все term-tooltip элементы на странице
 * @param {HTMLElement} [container=document] - Контейнер для поиска (по умолчанию весь документ)
 */
function initTermTooltips(container = document) {
  const tooltips = container.querySelectorAll(
    ".term-tooltip:not([data-initialized])",
  );

  tooltips.forEach((element) => {
    element.setAttribute("data-initialized", "true");
    createTermTooltip(element);
  });
}

// Инициализация при загрузке страницы
function initializeTermTooltips() {
  setupGlobalTouchDismiss();
  setupGlobalResizeReposition();
  initTermTooltips();

  // Также инициализируем для динамически добавленного контента
  if (window.MutationObserver) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            // Element node
            if (node.classList && node.classList.contains("term-tooltip")) {
              createTermTooltip(node);
            } else if (node.querySelectorAll) {
              const tooltips = node.querySelectorAll(
                ".term-tooltip:not([data-initialized])",
              );
              tooltips.forEach((element) => {
                element.setAttribute("data-initialized", "true");
                createTermTooltip(element);
              });
            }
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  // После загрузки определений: автообёртка терминов (если задан data-term-scope), затем инициализация тултипов
  window.addEventListener("termdefinitionsready", function () {
    var scope = document.body && document.body.getAttribute("data-term-scope");
    if (scope) {
      autoWrapTermTooltips(document.body);
    }
    var byTermOnly = document.querySelectorAll(
      ".term-tooltip[data-term]:not([data-definition])",
    );
    byTermOnly.forEach(function (el) {
      el.removeAttribute("data-initialized");
      if (el._tooltipPopup && el._tooltipPopup.parentNode) {
        el._tooltipPopup.parentNode.removeChild(el._tooltipPopup);
      }
      el._tooltipPopup = null;
    });
    initTermTooltips();

    // На страницах с lazy-questions KaTeX рендерится после нас и может заменить узлы — тултипы пропадают.
    // Повторно применяем обёртку и инициализацию к контенту первых 3 вопросов (уже с отрендеренным KaTeX).
    if (window.__lazyQuestionsActive) {
      var questions = document.querySelectorAll("#questions > li.question");
      for (var i = 0; i < Math.min(3, questions.length); i++) {
        var content = questions[i].querySelector(".content");
        if (
          content &&
          content.innerHTML &&
          content.innerHTML.trim().length > 0
        ) {
          (function (node) {
            autoWrapTermTooltips(node, function () {
              initTermTooltips(node);
            });
          })(content);
        }
      }
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeTermTooltips);
} else {
  initializeTermTooltips();
}

// Экспортируем для использования в других модулях и для вызова после ленивой подгрузки контента
window.initTermTooltips = initTermTooltips;
window.createTermTooltip = createTermTooltip;
window.autoWrapTermTooltips = autoWrapTermTooltips;
window.termAllowedOnPage = termAllowedOnPage;
