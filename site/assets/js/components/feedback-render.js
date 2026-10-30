/**
 * Общий рендерер фидбека.
 *
 * Единственный источник правды для оформления обратной связи: используется
 * и на странице `profile/feedbacks.html`, и в модалке записи собеседования
 * (`interviews/videos.html` через `assets/js/interview-videos.js`).
 * Раньше эти два места имели независимые копии парсера markdown и разметки
 * секций, которые разошлись; канонической считается вёрстка со страницы
 * фидбеков.
 *
 * Разметка рассчитана на стили `profile/feedbacks.css` — контейнер должен
 * быть обёрнут в `.feedback-page` (в модалке — дополнительно `.fb-modal-body`).
 */
(function (global) {
  "use strict";

  var FEEDBACK_SECTION_KEYWORDS = {
    "вопросы интервьюера и ответы": "section-interview",
    "hr-вопросы": "section-hr",
    "где сейчас есть сложности": "section-difficulties",
    "темы для проработки": "section-topics",
    "что у тебя хорошо": "section-strengths",
    статус: "section-verdict",
    "вопросы для следующего созвона": "section-next-call",
  };

  // Стандартный набор секций фидбека в порядке отображения
  var FEEDBACK_SECTIONS = [
    {
      key: "interview",
      title: "Вопросы интервьюера и ответы",
      sectionClass: "section-interview",
    },
    { key: "hr", title: "HR-вопросы", sectionClass: "section-hr" },
    {
      key: "difficulties",
      title: "Где сейчас есть сложности",
      sectionClass: "section-difficulties",
    },
    {
      key: "strengths",
      title: "Что у тебя хорошо",
      sectionClass: "section-strengths",
    },
    { key: "verdict", title: "Статус", sectionClass: "section-verdict" },
  ];

  // Экранирование сырого markdown перед разбором. `>` намеренно не трогаем:
  // в тексте он безопасен, а разметке он нужен как маркер цитаты и callout.
  function escapeMarkdownSource(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  // Экранирование HTML-символов (для вставки кода в <pre>)
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Обработка markdown контента (без callout блоков).
  // Ожидает уже экранированный текст — экранирование делает parseMarkdown,
  // единственная точка входа для сырого пользовательского markdown.
  function processMarkdownContent(text) {
    if (!text) return "";

    // 1. Сначала извлекаем fenced code blocks (```) — до любой другой обработки,
    //    чтобы $ внутри кода не воспринимался как math, а - не как список
    const codeBlockPlaceholders = [];
    text = text.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
      const idx = codeBlockPlaceholders.length;
      const langAttr = lang ? ` class="language-${lang}"` : "";
      codeBlockPlaceholders.push(`<pre><code${langAttr}>${code}</code></pre>`);
      return `__CODEBLOCK_${idx}__`;
    });
    // Однострочный вариант ``` code ``` (на одной строке)
    text = text.replace(/```(\w*)\s+([^`]+?)\s*```/g, (match, lang, code) => {
      const idx = codeBlockPlaceholders.length;
      const langAttr = lang ? ` class="language-${lang}"` : "";
      codeBlockPlaceholders.push(
        `<pre><code${langAttr}>${code.trim()}</code></pre>`,
      );
      return `__CODEBLOCK_${idx}__`;
    });

    // 2. Защищаем math-выражения от regex-обработки markdown
    const mathPlaceholders = [];
    // Display math $$...$$
    text = text.replace(/\$\$[\s\S]*?\$\$/g, (m) => {
      mathPlaceholders.push(m);
      return `__KATEX_${mathPlaceholders.length - 1}__`;
    });
    // Inline math $...$
    text = text.replace(/\$[^$\n]+?\$/g, (m) => {
      mathPlaceholders.push(m);
      return `__KATEX_${mathPlaceholders.length - 1}__`;
    });
    // \[...\] display
    text = text.replace(/\\\[[\s\S]*?\\\]/g, (m) => {
      mathPlaceholders.push(m);
      return `__KATEX_${mathPlaceholders.length - 1}__`;
    });
    // \(...\) inline
    text = text.replace(/\\\([\s\S]*?\\\)/g, (m) => {
      mathPlaceholders.push(m);
      return `__KATEX_${mathPlaceholders.length - 1}__`;
    });

    text = convertBulletLists(text);

    // Convert numbered lists
    text = text.replace(/^\d+\.\s+(.+)$/gm, "<li>$1</li>");

    const inlineCodePlaceholders = [];
    text = convertInlineMarkdown(text, inlineCodePlaceholders);
    text = convertHeaders(text);
    text = wrapParagraphs(text);
    text = wrapSectionCards(text);

    text = restoreInlineCode(text, inlineCodePlaceholders);

    // Восстанавливаем math-выражения
    mathPlaceholders.forEach((math, index) => {
      text = text.split(`__KATEX_${index}__`).join(math);
    });

    // Восстанавливаем code blocks
    codeBlockPlaceholders.forEach((block, index) => {
      text = text.split(`__CODEBLOCK_${index}__`).join(block);
    });

    return text;
  }

  // Convert bullet lists with nesting support
  // Отступ (2/4 пробела или таб) определяет уровень вложенности
  function convertBulletLists(text) {
    const textLines = text.split("\n");
    const bulletProcessedLines = [];
    let bulletBuffer = [];
    let inMathBlock = false;

    function flushBulletBuffer() {
      if (bulletBuffer.length === 0) return;

      function buildLevel(items, startIdx, baseIndent) {
        let html = "<ul>";
        let i = startIdx;
        while (i < items.length) {
          const item = items[i];
          if (item.indent < baseIndent) break;
          if (item.indent === baseIndent) {
            html += "<li>" + item.text;
            if (i + 1 < items.length && items[i + 1].indent > baseIndent) {
              const sub = buildLevel(items, i + 1, items[i + 1].indent);
              html += sub.html;
              i = sub.nextIdx;
            } else {
              i++;
            }
            html += "</li>";
          } else {
            // Сиротский более глубокий элемент — добавляем как обычный
            html += "<li>" + item.text + "</li>";
            i++;
          }
        }
        html += "</ul>";
        return { html, nextIdx: i };
      }

      bulletProcessedLines.push(
        buildLevel(bulletBuffer, 0, bulletBuffer[0].indent).html,
      );
      bulletBuffer = [];
    }

    for (let i = 0; i < textLines.length; i++) {
      const line = textLines[i];

      if (line.trim().startsWith("$$")) {
        inMathBlock = !inMathBlock;
        flushBulletBuffer();
        bulletProcessedLines.push(line);
        continue;
      }

      if (inMathBlock) {
        bulletProcessedLines.push(line);
        continue;
      }

      const bulletMatch = line.match(/^([ \t]*)[-–•]\s*(\[ \]\s*)?(.+)$/);

      if (bulletMatch) {
        const indent = bulletMatch[1].replace(/\t/g, "    ").length;
        bulletBuffer.push({ indent, text: bulletMatch[3] });
      } else {
        flushBulletBuffer();
        bulletProcessedLines.push(line);
      }
    }
    flushBulletBuffer();

    return bulletProcessedLines.join("\n");
  }

  // Инлайновый код прячется за плейсхолдеры на время обработки markdown,
  // чтобы `**` и `*` внутри кода не превращались в теги. Массив плейсхолдеров
  // передаётся вызывающим кодом и возвращается в текст через restoreInlineCode.
  function convertInlineMarkdown(text, inlineCodePlaceholders) {
    // Convert inline code (сохраняем плейсхолдеры для математики)
    text = text.replace(/`([^`]+)`/g, (match, code) => {
      const placeholder = `__CODE_${inlineCodePlaceholders.length}__`;
      inlineCodePlaceholders.push(`<code>${code}</code>`);
      return placeholder;
    });

    // Convert bold text
    text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

    // Convert italic text (both *text* and _text_)
    text = text.replace(/\*(.+?)\*/g, "<em>$1</em>");
    text = text.replace(/(?<!\w)_([^_]+)_(?!\w)/g, "<em>$1</em>");

    // Convert links
    text = text.replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
    );

    return text;
  }

  function restoreInlineCode(text, inlineCodePlaceholders) {
    inlineCodePlaceholders.forEach((code, index) => {
      text = text.split(`__CODE_${index}__`).join(code);
    });
    return text;
  }

  // Convert headers с добавлением классов для секций
  // Используем только h2 для секций, чтобы структура была единообразной
  function convertHeaders(text) {
    text = text.replace(/^###\s+(.+)$/gm, (match, content) => {
      const lowerContent = content.toLowerCase().trim();
      const sectionClass = FEEDBACK_SECTION_KEYWORDS[lowerContent] || "";
      // Если это секция, используем h2, иначе обычный h4
      return sectionClass
        ? `<h2 class="feedback-section-header ${sectionClass}">${content}</h2>`
        : `<h4>${content}</h4>`;
    });
    text = text.replace(/^##\s+(.+)$/gm, (match, content) => {
      const lowerContent = content.toLowerCase().trim();
      const sectionClass = FEEDBACK_SECTION_KEYWORDS[lowerContent] || "";
      // Если это секция, используем h2, иначе обычный h3
      return sectionClass
        ? `<h2 class="feedback-section-header ${sectionClass}">${content}</h2>`
        : `<h3>${content}</h3>`;
    });
    text = text.replace(/^#\s+(.+)$/gm, (match, content) => {
      const lowerContent = content.toLowerCase().trim();
      const sectionClass = FEEDBACK_SECTION_KEYWORDS[lowerContent] || "";
      // Если это секция, используем h2, иначе обычный h2
      return `<h2${sectionClass ? ` class="feedback-section-header ${sectionClass}"` : ""}>${content}</h2>`;
    });
    return text;
  }

  // Блочные конструкции, которые нельзя класть внутрь <p>: готовый HTML от
  // предыдущих шагов (заголовки, списки, callout, hr, уже готовые <p> —
  // parseMarkdown прогоняет пайплайн дважды) и плейсхолдеры код-блоков,
  // которые разворачиваются в <pre> уже после этого шага.
  const BLOCK_LINE_RE =
    /^(?:<\/?(?:h[1-6]|ul|ol|li|div|pre|blockquote|table|thead|tbody|tr|td|th|hr|p)\b|__CODEBLOCK_\d+__|__PMCODE_\d+__)/i;

  // Convert line breaks to paragraphs
  //
  // Оборачиваем в <p> только текстовые строки. Раньше абзац пропускался
  // целиком, если начинался с блочного тега, — из-за этого текст, написанный
  // вплотную под «### Вопрос» (без пустой строки), оставался голым текстовым
  // узлом, терял отступы `.fb-q-body > p` и прижимался к краю карточки.
  // А callout и код-блоки, наоборот, заворачивались в <p>, что давало
  // невалидную вложенность и лишний пустой абзац сверху.
  function wrapParagraphs(text) {
    const out = [];

    text.split("\n\n").forEach((paragraph) => {
      let buffer = [];

      function flushBuffer() {
        if (!buffer.length) return;
        const chunk = buffer.join("\n").trim();
        if (chunk) out.push(`<p>${chunk}</p>`);
        buffer = [];
      }

      paragraph.split("\n").forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        if (BLOCK_LINE_RE.test(trimmed)) {
          flushBuffer();
          out.push(trimmed);
        } else {
          buffer.push(trimmed);
        }
      });

      flushBuffer();
    });

    return out.join("");
  }

  // Оборачиваем секции в блоки-карточки для визуального выделения
  function wrapSectionCards(text) {
    const sectionHeaders = Object.keys(FEEDBACK_SECTION_KEYWORDS);
    sectionHeaders.forEach((keyword) => {
      const sectionClass = FEEDBACK_SECTION_KEYWORDS[keyword];
      // Ищем заголовок с этим классом и оборачиваем его и следующее содержимое до следующего заголовка
      const regex = new RegExp(
        `(<h2 class="feedback-section-header ${sectionClass}">([^<]+)</h2>)([\\s\\S]*?)(?=<h[234]|$)`,
        "gi",
      );
      text = text.replace(regex, (match, header, titleText, content) => {
        // Извлекаем текст заголовка
        const titleMatch = header.match(/>([^<]+)</);
        const title = titleMatch ? titleMatch[1] : titleText || "";
        // Создаем структуру блока-карточки
        return `<div class="feedback-block ${sectionClass}"><h2 class="feedback-block-title">${title}</h2><div class="feedback-block-content">${content}</div></div>`;
      });
    });
    return text;
  }

  // Fenced-блок вырезается до разбора callout, поэтому внутри цитаты он
  // сохраняет маркер «> ». Убираем его, только если процитированы все
  // непустые строки, — иначе можно испортить код, который сам начинается с «>».
  function stripBlockquoteMarker(code) {
    const lines = code.split("\n");
    const meaningful = lines.filter((line) => line.trim() !== "");
    if (!meaningful.length) return code;
    if (!meaningful.every((line) => /^\s*>/.test(line))) return code;
    return lines.map((line) => line.replace(/^\s*> ?/, "")).join("\n");
  }

  function parseMarkdown(text) {
    if (!text) return "";

    // Текст фидбека приходит из базы и попадает в innerHTML, поэтому
    // экранируем его целиком до разбора markdown: дальше по пайплайну теги
    // добавляет только сам рендерер. Это единственное место экранирования —
    // все остальные шаги работают с уже безопасным текстом.
    text = escapeMarkdownSource(text);

    // Защищаем fenced code blocks ДО math (чтобы $ внутри кода не ломался)
    const pmCodeBlocks = [];
    text = text.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
      const idx = pmCodeBlocks.length;
      const langAttr = lang ? ` class="language-${lang}"` : "";
      pmCodeBlocks.push(
        `<pre><code${langAttr}>${stripBlockquoteMarker(code)}</code></pre>`,
      );
      return `__PMCODE_${idx}__`;
    });

    // Защищаем math-выражения ДО любой обработки
    const pmMathBlocks = [];
    text = text.replace(/\$\$[\s\S]*?\$\$/g, (m) => {
      pmMathBlocks.push(m);
      return `__PMMATH_${pmMathBlocks.length - 1}__`;
    });
    text = text.replace(/\$[^$\n]+?\$/g, (m) => {
      pmMathBlocks.push(m);
      return `__PMMATH_${pmMathBlocks.length - 1}__`;
    });
    text = text.replace(/\\\[[\s\S]*?\\\]/g, (m) => {
      pmMathBlocks.push(m);
      return `__PMMATH_${pmMathBlocks.length - 1}__`;
    });
    text = text.replace(/\\\([\s\S]*?\\\)/g, (m) => {
      pmMathBlocks.push(m);
      return `__PMMATH_${pmMathBlocks.length - 1}__`;
    });

    // Сначала обрабатываем callout блоки (> [!type])
    // Обрабатываем многострочные callout блоки
    const lines = text.split("\n");
    const processedLines = [];
    let inCallout = false;
    let calloutType = "";
    let calloutContent = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const calloutMatch = line.match(/^> ?\[!(\w+)\]\s*(.*)$/);

      if (calloutMatch) {
        // Начало нового callout блока
        if (inCallout) {
          // Закрываем предыдущий блок
          const cleanContent = calloutContent.join("\n").trim();
          processedLines.push(
            `<div class="callout ${calloutType}">${processMarkdownContent(cleanContent)}</div>`,
          );
          calloutContent = [];
        }
        inCallout = true;
        calloutType = calloutMatch[1].toLowerCase();
        if (calloutMatch[2].trim()) {
          calloutContent.push(calloutMatch[2].trim());
        }
      } else if (inCallout && line.match(/^> ?(.*)$/)) {
        // Продолжение callout блока
        const contentMatch = line.match(/^> ?(.*)$/);
        calloutContent.push(contentMatch[1] || "");
      } else {
        // Конец callout блока
        if (inCallout) {
          const cleanContent = calloutContent.join("\n").trim();
          // Рекурсивно обрабатываем markdown внутри callout
          const processedContent = processMarkdownContent(cleanContent);
          processedLines.push(
            `<div class="callout ${calloutType}">${processedContent}</div>`,
          );
          calloutContent = [];
          inCallout = false;
        }
        processedLines.push(line);
      }
    }

    // Закрываем последний callout блок, если он был открыт
    if (inCallout) {
      const cleanContent = calloutContent.join("\n").trim();
      const processedContent = processMarkdownContent(cleanContent);
      processedLines.push(
        `<div class="callout ${calloutType}">${processedContent}</div>`,
      );
    }

    text = processedLines.join("\n");

    // Обрабатываем разделительную черту (---)
    text = text.replace(/^---+\s*$/gm, "<hr>");

    // Обрабатываем остальной markdown. Раньше здесь же весь пайплайн
    // (списки → инлайн → заголовки → абзацы → карточки секций) повторялся
    // второй раз поверх уже готового HTML: это ничего не добавляло, зато
    // заворачивало готовые <p> ещё в один <p> и рвало абзацы на части.
    text = processMarkdownContent(text);

    // Восстанавливаем math-выражения (после всей обработки)
    pmMathBlocks.forEach((math, index) => {
      text = text.split(`__PMMATH_${index}__`).join(math);
    });

    // Восстанавливаем code blocks
    pmCodeBlocks.forEach((block, index) => {
      text = text.split(`__PMCODE_${index}__`).join(block);
    });

    return text;
  }

  // Функция для очистки текста от маркеров списка
  function cleanQuestionText(text) {
    if (!text || typeof text !== "string") return text || "";

    let cleaned = text.trim();

    // Убираем markdown чекбоксы
    cleaned = cleaned.replace(/^-\s*\[[xX\s]\]\s*/i, "");

    // Убираем маркеры списка (в порядке от более длинных к более коротким)
    const markers = [
      /^[-–•*+]\s+/, // Маркер с пробелом: "- ", "– ", "• ", "* ", "+ "
      /^[-–•*+]/, // Маркер без пробела: "-", "–", "•", "*", "+"
      /^\d+\.\s+/, // Нумерованный список: "1. ", "2. "
      /^\d+\)\s+/, // Нумерованный список со скобкой: "1) ", "2) "
    ];

    for (const marker of markers) {
      if (marker.test(cleaned)) {
        cleaned = cleaned.replace(marker, "").trim();
        break; // Убираем только первый найденный маркер
      }
    }

    return cleaned;
  }

  // Нормализация структуры вопроса - извлекает только text и read
  function normalizeQuestion(q) {
    // level обязателен во всех ветках: buildQuestionsListHtml сравнивает его
    // с уровнем предыдущего пункта, и undefined роняет вопрос в ветку
    // «сиротский элемент» — пункт молча пропадал из списка.
    if (!q) {
      return { text: "", read: false, level: 0 };
    }

    if (typeof q === "string") {
      return { text: cleanQuestionText(q), read: false, level: 0 };
    }

    if (typeof q === "object") {
      // Извлекаем text
      let text = "";
      if (typeof q.text === "string") {
        text = q.text;
      } else if (typeof q.question === "string") {
        text = q.question;
      } else if (q.text && typeof q.text === "object") {
        // Если text - это объект (рекурсивная структура), извлекаем строку рекурсивно
        const normalizedText = normalizeQuestion(q.text);
        text = normalizedText.text;
      } else {
        // Ищем любое строковое значение в объекте
        const values = Object.values(q);
        const stringValue = values.find(
          (v) =>
            typeof v === "string" &&
            v.trim().length > 0 &&
            v !== "false" &&
            v !== "true",
        );
        text = stringValue || "";
      }

      // Очищаем текст от маркеров списка
      text = cleanQuestionText(text);

      // Извлекаем read
      let read = false;
      if (typeof q.read === "boolean") {
        read = q.read;
      } else if (q.read === "true" || q.read === true) {
        read = true;
      }

      // Извлекаем level (уровень вложенности, по умолчанию 0)
      const level = typeof q.level === "number" ? q.level : 0;

      return { text, read, level };
    }

    return {
      text: cleanQuestionText(String(q || "")),
      read: false,
      level: 0,
    };
  }

  // Приводит feedback.questions (массив или объект из RTDB) к массиву
  // нормализованных вопросов в стабильном порядке.
  function normalizeQuestions(questionsData) {
    if (Array.isArray(questionsData)) {
      return questionsData
        .map((q) => normalizeQuestion(q))
        .filter(
          (q) =>
            q.text && typeof q.text === "string" && q.text.trim().length > 0,
        );
    }

    if (questionsData && typeof questionsData === "object") {
      return Object.keys(questionsData)
        .sort((a, b) => {
          const aNum = parseInt(a);
          const bNum = parseInt(b);
          if (isNaN(aNum) || isNaN(bNum)) return a.localeCompare(b);
          return aNum - bNum;
        })
        .map((key) => normalizeQuestion(questionsData[key]))
        .filter(
          (q) =>
            q.text && typeof q.text === "string" && q.text.trim().length > 0,
        );
    }

    return [];
  }

  // Строит вложенный HTML-список чек-боксов из плоского массива с полем level.
  // questionsArray — [{text, read, level}, ...]; level=0 означает верхний уровень.
  function buildQuestionsListHtml(questionsArray, feedbackId, isStudentView) {
    if (!questionsArray.length) return "";

    function buildLevel(items, startIdx, baseLevel) {
      let html = '<ul class="feedback-questions-list">';
      let i = startIdx;
      while (i < items.length) {
        const q = items[i];
        if (q.level < baseLevel) break;
        if (q.level === baseLevel) {
          const questionId = `q_${feedbackId}_${i}`;
          const isCompleted = q.read || false;
          html += `<li class="feedback-question-item${isCompleted ? " completed" : ""}">`;
          html += `<input type="checkbox" class="feedback-question-checkbox" id="${questionId}" data-feedback-id="${feedbackId}" data-question-index="${i}" ${isCompleted ? "checked" : ""} ${isStudentView ? "" : "disabled"}>`;
          html += `<label for="${questionId}" class="feedback-question-text"><span class="question-text-content">${escapeHtml(q.text || "")}</span></label>`;
          if (i + 1 < items.length && items[i + 1].level > baseLevel) {
            const sub = buildLevel(items, i + 1, items[i + 1].level);
            html += sub.html;
            i = sub.nextIdx;
          } else {
            i++;
          }
          html += "</li>";
        } else {
          i++; // Сиротский более глубокий элемент — пропускаем
        }
      }
      html += "</ul>";
      return { html, nextIdx: i };
    }

    return buildLevel(questionsArray, 0, questionsArray[0].level).html;
  }

  // Оборачивает ### вопросы в карточки с нумерацией и выделяет "Твой ответ:"
  function wrapQuestionBlocks(html) {
    // Только для секций с sub-questions (h4 элементы от ### заголовков)
    if (!/<h4[\s>]/i.test(html)) return html;

    // Разбиваем на блоки по <hr> (разделитель --- между вопросами)
    const rawBlocks = html.split(/<hr\s*\/?>/gi);
    let questionNum = 0;

    const processedBlocks = rawBlocks.map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";

      // Блок с вопросом (есть <h4>)
      if (/<h4[\s>]/i.test(trimmed)) {
        questionNum++;
        const blockId = `fbq-${Date.now()}-${questionNum}-${Math.random().toString(36).slice(2, 7)}`;

        // Заменяем <h4> на заголовок-вопрос с номером и кнопкой сворачивания
        let processed = trimmed.replace(
          /<h4([^>]*)>([\s\S]*?)<\/h4>/i,
          (_, attrs, content) =>
            `<div class="fb-q-title" onclick="toggleFeedbackBlock('${blockId}')">` +
            `<span class="fb-q-num">${questionNum}</span>` +
            `<span class="fb-q-title-text">${content.trim()}</span>` +
            `<button class="fb-q-toggle" aria-label="Свернуть/развернуть">` +
            `<span class="fb-q-toggle-icon">▼</span>` +
            `</button>` +
            `</div>`,
        );

        // Оборачиваем тело вопроса (всё кроме заголовка) в fb-q-body
        processed = processed.replace(
          /(<\/div>)([\s\S]*)$/,
          (_, closingDiv, body) =>
            `${closingDiv}<div class="fb-q-body">${body.trim()}</div>`,
        );

        // Выделяем "Твой ответ:" — первый абзац с таким префиксом
        processed = processed.replace(
          /<p>(Твой ответ:)([\s\S]*?)<\/p>/i,
          (_, label, answer) =>
            `<div class="fb-student-answer"><div class="fb-student-answer-label">Ответ студента</div><div class="fb-student-answer-text">${answer.trim()}</div></div>`,
        );

        return `<div class="fb-q-block" id="${blockId}">${processed}</div>`;
      }

      // Контент до первого вопроса (вступление раздела) — возвращаем как есть
      return trimmed;
    });

    return processedBlocks.filter(Boolean).join("");
  }

  function convertToChecklistMarkdown(text) {
    if (!text || !text.trim()) return text;

    const lines = text.split("\n");
    const checklistLines = [];

    for (let line of lines) {
      const trimmedLine = line.trim();

      // Пропускаем пустые строки
      if (!trimmedLine) {
        checklistLines.push("");
        continue;
      }

      // Сохраняем ведущие пробелы для вложенности
      const leadingMatch = line.match(/^([ \t]*)/);
      const leading = leadingMatch ? leadingMatch[1] : "";

      // Убираем все возможные маркеры списка: "- ", "-", "– ", "–", "• ", "•", "* ", "*", "+ ", "+"
      // Также убираем уже существующие чекбоксы "- [ ]", "- [x]", "- [X]"
      let questionText = trimmedLine;

      // Убираем markdown чекбоксы
      questionText = questionText.replace(/^-\s*\[[xX\s]\]\s*/i, "");

      // Убираем маркеры списка (в порядке от более длинных к более коротким)
      const markers = [
        /^[-–•*+]\s+/, // Маркер с пробелом: "- ", "– ", "• ", "* ", "+ "
        /^[-–•*+]/, // Маркер без пробела: "-", "–", "•", "*", "+"
        /^\d+\.\s+/, // Нумерованный список: "1. ", "2. "
        /^\d+\)\s+/, // Нумерованный список со скобкой: "1) ", "2) "
      ];

      for (const marker of markers) {
        if (marker.test(questionText)) {
          questionText = questionText.replace(marker, "").trim();
          break; // Убираем только первый найденный маркер
        }
      }

      // Добавляем markdown чеклист формат, сохраняя отступ для вложенности
      if (questionText) {
        checklistLines.push(`${leading}- [ ] ${questionText}`);
      }
    }

    return checklistLines.join("\n");
  }

  function convertListsToCheckboxes(
    html,
    feedbackId,
    sectionClass,
    feedbackData,
    currentUserRole,
  ) {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;

    const sectionQuestions =
      (feedbackData && feedbackData.sectionQuestions) || {};

    // Рекурсивно преобразует один <ul>/<ol> в чек-боксы.
    // pathPrefix — строка-ключ родительского уровня (напр. "section-interview_0").
    function convertList(list, pathPrefix) {
      const newList = document.createElement("ul");
      newList.className = "feedback-section-questions-list";

      // Только прямые дочерние <li>, не вложенные
      const directItems = Array.from(list.children).filter(
        (el) => el.tagName === "LI",
      );

      directItems.forEach((item, itemIndex) => {
        const questionKey = `${pathPrefix}_${itemIndex}`;
        const questionId = `q_${feedbackId}_${questionKey}`;

        // Текст этого <li> без текста вложенных <ul>/<ol>
        let questionText = "";
        item.childNodes.forEach((node) => {
          if (node.nodeName !== "UL" && node.nodeName !== "OL") {
            questionText += node.textContent;
          }
        });
        questionText = cleanQuestionText(questionText.trim());
        if (!questionText) return;

        const questionData = sectionQuestions[questionKey] || {
          text: questionText,
          read: false,
        };
        const isRead = questionData.read || false;

        const listItem = document.createElement("li");
        listItem.className = `feedback-section-question-item${isRead ? " completed" : ""}`;

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "feedback-section-question-checkbox";
        checkbox.id = questionId;
        checkbox.checked = isRead;
        checkbox.dataset.feedbackId = feedbackId;
        checkbox.dataset.sectionClass = sectionClass;
        checkbox.dataset.questionKey = questionKey;
        if (currentUserRole !== "student") checkbox.disabled = true;

        const label = document.createElement("label");
        label.htmlFor = questionId;
        label.className = "feedback-section-question-text";
        label.textContent = questionText;

        listItem.appendChild(checkbox);
        listItem.appendChild(label);

        // Рекурсивно обрабатываем вложенный список, если он есть
        const childSubList = item.querySelector(":scope > ul, :scope > ol");
        if (childSubList) {
          const subList = convertList(childSubList, questionKey);
          if (subList.children.length > 0) listItem.appendChild(subList);
        }

        newList.appendChild(listItem);
      });

      return newList;
    }

    // Находим только верхнеуровневые списки (не те, что уже внутри <li>)
    const topLevelLists = [];
    function findTopLevel(parent) {
      Array.from(parent.children).forEach((child) => {
        if (child.tagName === "UL" || child.tagName === "OL") {
          topLevelLists.push(child);
        } else {
          findTopLevel(child);
        }
      });
    }
    findTopLevel(tempDiv);

    topLevelLists.forEach((list, listIndex) => {
      const newList = convertList(list, `${sectionClass}_${listIndex}`);
      if (newList.children.length > 0) {
        list.parentNode.replaceChild(newList, list);
      } else {
        list.remove();
      }
    });

    return tempDiv.innerHTML;
  }

  /**
   * Рендерит одну секцию фидбека в карточку `.feedback-block`.
   *
   * options:
   *   feedbackId  — id фидбека (для ключей чек-боксов);
   *   feedback    — исходный объект фидбека (нужен sectionQuestions);
   *   userRole    — роль текущего пользователя ("student" делает чек-боксы активными);
   *   wrapQuestions — оборачивать ### вопросы в нумерованные карточки (по умолчанию true).
   */
  function renderSection(title, content, sectionClass, options) {
    if (!content || content.trim() === "") return "";

    const opts = options || {};
    const feedback = opts.feedback || {};
    const feedbackId = opts.feedbackId || feedback.id || "";
    const userRole = opts.userRole || "";
    const wrapQuestions = opts.wrapQuestions !== false;

    // Убираем дублирующиеся заголовки из контента
    let cleanedContent = content;
    const titleEscaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const titleLower = title.toLowerCase();

    // Удаляем заголовки markdown, которые совпадают с названием секции
    // (regex регистронезависимый, поэтому достаточно двух вариантов)
    const patterns = [
      new RegExp(`^\\s*#{1,3}\\s+${titleEscaped}\\s*$`, "gmi"),
      new RegExp(`^\\s*#{1,3}\\s+${titleLower}\\s*$`, "gmi"),
    ];

    patterns.forEach((pattern) => {
      cleanedContent = cleanedContent.replace(pattern, "");
    });

    // Также удаляем пустые строки после удаления заголовков
    cleanedContent = cleanedContent.replace(/\n\s*\n\s*\n/g, "\n\n").trim();

    // Проверяем, что после очистки контент не пустой
    if (!cleanedContent || cleanedContent.trim() === "") return "";

    const isQuestionsForWork =
      sectionClass === "section-questions-for-work" ||
      title.toLowerCase().includes("вопросы для проработки");

    // Для секции "Вопросы для проработки" преобразуем текст в markdown чеклист
    if (isQuestionsForWork) {
      cleanedContent = convertToChecklistMarkdown(cleanedContent);
    }

    const parsedContent = parseMarkdown(cleanedContent);

    // Дополнительно удаляем уже отрендеренные заголовки из HTML
    let finalContent = parsedContent;
    const htmlHeaderPattern = new RegExp(
      `<h[234][^>]*>\\s*${titleEscaped}\\s*</h[234]>`,
      "gi",
    );
    finalContent = finalContent.replace(htmlHeaderPattern, "");

    // Оборачиваем вопросы (###) в нумерованные карточки (только для Q&A-секций)
    const isQASection =
      sectionClass === "section-interview" ||
      sectionClass === "section-hr" ||
      sectionClass === "section-difficulties" ||
      sectionClass === "section-topics" ||
      sectionClass === "section-next-call";
    if (wrapQuestions && isQASection) {
      finalContent = wrapQuestionBlocks(finalContent);
    }

    // Проверяем, что после парсинга и удаления заголовков контент не пустой
    // Убираем HTML теги и пробелы для проверки
    const textContent = finalContent
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!textContent || textContent === "") return "";

    // Преобразуем списки в checkbox-ы ТОЛЬКО для секции "Вопросы для проработки"
    // Остальные секции остаются с обычными списками
    if (isQuestionsForWork) {
      finalContent = convertListsToCheckboxes(
        finalContent,
        feedbackId,
        sectionClass,
        feedback,
        userRole,
      );
      // Проверяем еще раз после конвертации списков в чекбоксы
      const textAfterCheckboxes = finalContent
        .replace(/<[^>]*>/g, "")
        .replace(/\s+/g, " ")
        .trim();
      if (!textAfterCheckboxes || textAfterCheckboxes === "") return "";
    }

    const blockId = `block-${sectionClass}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    return `
              <div class="feedback-block ${sectionClass}" id="${blockId}">
                <div class="feedback-block-header" onclick="toggleFeedbackBlock('${blockId}')">
                  <h2 class="feedback-block-title">${title}</h2>
                  <button type="button" class="feedback-block-toggle" aria-label="Свернуть/развернуть секцию">
                    <span class="feedback-block-toggle-icon">▼</span>
                  </button>
                </div>
                <div class="feedback-block-content">
                  ${finalContent}
                </div>
              </div>
            `;
  }

  /**
   * Рендерит все секции фидбека. Поддерживает старый формат с полем
   * `content` (единый markdown) для обратной совместимости.
   */
  function renderSections(feedback, options) {
    if (!feedback) return "";
    if (feedback.content) return parseMarkdown(feedback.content || "");

    const opts = Object.assign({}, options, { feedback: feedback });
    if (!opts.feedbackId) opts.feedbackId = feedback.id || "";

    return FEEDBACK_SECTIONS.map((section) =>
      renderSection(
        section.title,
        feedback[section.key] || "",
        section.sectionClass,
        opts,
      ),
    ).join("");
  }

  /**
   * Блок «Вопросы для проработки» с прогресс-баром.
   *
   * options: feedbackId, interactive (чек-боксы кликабельны), showProgress.
   */
  function renderQuestionsBlock(feedback, options) {
    const opts = options || {};
    const questionsArray = normalizeQuestions(
      (feedback && feedback.questions) || {},
    );
    if (!questionsArray.length) return "";

    const feedbackId = opts.feedbackId || (feedback && feedback.id) || "";
    const interactive = !!opts.interactive;
    const showProgress =
      opts.showProgress === undefined ? interactive : !!opts.showProgress;

    const completedCount = questionsArray.filter((q) => q.read).length;
    const questionsProgress = Math.round(
      (completedCount / questionsArray.length) * 100,
    );

    return `
              <div class="feedback-questions">
                <div class="feedback-questions-title">
                  <span>📋 Вопросы для проработки:</span>
                  ${
                    showProgress
                      ? `
                    <div class="feedback-questions-progress">
                      <div class="feedback-questions-progress-bar">
                        <div class="feedback-questions-progress-fill" style="width: ${questionsProgress}%"></div>
                      </div>
                      <span>${questionsProgress}%</span>
                    </div>
                  `
                      : ""
                  }
                </div>
                ${buildQuestionsListHtml(questionsArray, feedbackId, interactive)}
              </div>
            `;
  }

  /**
   * Полное тело фидбека: `.feedback-content` с секциями + блок вопросов.
   * Возвращает "" если рендерить нечего.
   */
  function renderFeedbackBody(feedback, options) {
    const contentHtml = renderSections(feedback, options);
    const questionsHtml = renderQuestionsBlock(feedback, options);
    if (!contentHtml.trim() && !questionsHtml.trim()) return "";
    return `<div class="feedback-content">${contentHtml}</div>${questionsHtml}`;
  }

  // Рендеринг математики через KaTeX
  function renderMath(element) {
    if (!element) return;
    if (typeof renderMathInElement === "function") {
      try {
        renderMathInElement(element, {
          delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "$", right: "$", display: false },
            { left: "\\(", right: "\\)", display: false },
            { left: "\\[", right: "\\]", display: true },
          ],
          throwOnError: false,
        });
      } catch (error) {
        console.warn("Error rendering math:", error);
      }
    }
  }

  // Сворачивание/разворачивание блока — вызывается из inline-onclick разметки,
  // поэтому обязано быть глобальным на любой странице, где рендерится фидбек.
  function toggleFeedbackBlock(blockId) {
    const block = document.getElementById(blockId);
    if (!block) return;

    block.classList.toggle("collapsed");
    // У .fb-q-block иконка поворачивается через CSS, поэтому символ меняем
    // только у секций фидбека.
    const icon = block.querySelector(".feedback-block-toggle-icon");
    if (icon) {
      icon.textContent = block.classList.contains("collapsed") ? "▶" : "▼";
    }
  }

  global.FeedbackRender = {
    FEEDBACK_SECTION_KEYWORDS: FEEDBACK_SECTION_KEYWORDS,
    FEEDBACK_SECTIONS: FEEDBACK_SECTIONS,
    escapeHtml: escapeHtml,
    parseMarkdown: parseMarkdown,
    processMarkdownContent: processMarkdownContent,
    cleanQuestionText: cleanQuestionText,
    normalizeQuestion: normalizeQuestion,
    normalizeQuestions: normalizeQuestions,
    buildQuestionsListHtml: buildQuestionsListHtml,
    wrapQuestionBlocks: wrapQuestionBlocks,
    convertToChecklistMarkdown: convertToChecklistMarkdown,
    convertListsToCheckboxes: convertListsToCheckboxes,
    renderSection: renderSection,
    renderSections: renderSections,
    renderQuestionsBlock: renderQuestionsBlock,
    renderFeedbackBody: renderFeedbackBody,
    renderMath: renderMath,
    toggleFeedbackBlock: toggleFeedbackBlock,
  };

  if (typeof global.toggleFeedbackBlock !== "function") {
    global.toggleFeedbackBlock = toggleFeedbackBlock;
  }
})(typeof window !== "undefined" ? window : globalThis);
