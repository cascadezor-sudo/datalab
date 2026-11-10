/**
 * Тело карточки доски: описание, пояснение, материалы, шаги.
 *
 * Раньше этот рендер жил внутри kanban-board.js, и посмотреть, как задание
 * будет выглядеть у ученика, можно было только уже поставив его на доску.
 * Учебный план (calender/roadmap.html) показывает предпросмотр до постановки —
 * тем же кодом, поэтому «как увидит ученик» здесь не обещание, а факт.
 *
 * Подключается обычным <script> (window.TaskDetails) и require()-ом из
 * tests/*.test.js — как roadmap-position.js.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.TaskDetails = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // Перевод интерфейса (ядро — сниппет theme-boot). В тестах под Node его нет:
  // остаётся русский текст с подставленными значениями.
  const t =
    (typeof window !== "undefined" && window.t) ||
    ((text, params) =>
      text.replace(/\{(\w+)\}/g, (match, key) => params?.[key] ?? match));

  const SITE_URL =
    typeof window !== "undefined" && /^https?:$/.test(window.location?.protocol || "")
      ? window.location.origin
      : "";

  function escapeHtml(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char],
    );
  }

  function normalizeList(value) {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (!value) return [];
    return String(value)
      .split(/\r?\n/)
      .map((line) => line.replace(/^[-*]\s+/, "").trim())
      .filter(Boolean);
  }

  function stripMarkdown(value) {
    return String(value ?? "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[*_`#>]/g, "")
      .replace(/^[-\s]+/, "")
      .trim();
  }

  function renderInlineMarkdown(value) {
    let html = escapeHtml(value);
    html = html.replace(
      /\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
    );
    html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    return html;
  }

  function renderTextBlock(value) {
    return normalizeList(value)
      .map((line) => `<p>${renderInlineMarkdown(line)}</p>`)
      .join("");
  }

  function renderList(items) {
    const list = normalizeList(items);
    if (!list.length) return "";
    return `<ul>${list
      .map((item) => `<li>${renderInlineMarkdown(item)}</li>`)
      .join("")}</ul>`;
  }

  function toAbsoluteSiteUrl(path) {
    const value = String(path || "").trim();
    if (!value) return "";
    if (/^https?:\/\//i.test(value)) return value;
    return `${SITE_URL}${value.startsWith("/") ? "" : "/"}${value}`;
  }

  /* Карточки, созданные до появления structured details: секции вычитываются
     из markdown-описания по заголовкам «Пояснение», «Материалы», «Что сделать». */
  function parseLegacyDetails(description) {
    const lines = String(description || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) return null;

    const details = {
      description: "",
      explanation: [],
      materials: [],
      instructions: [],
    };
    let section = "description";

    lines.forEach((line) => {
      const plain = stripMarkdown(line).toLocaleLowerCase("ru-RU");
      if (plain.includes("пояснен") || plain.includes("пояснение")) {
        section = "instructions";
        return;
      }
      if (plain.includes("материалы")) {
        section = "materials";
        return;
      }
      if (plain.includes("что сделать")) {
        section = "instructions";
        return;
      }

      if (section === "description" && /^[-*]\s+/.test(line)) {
        const clean = stripMarkdown(line);
        if (
          clean.toLocaleLowerCase("ru-RU").includes("milestone") ||
          clean.toLocaleLowerCase("ru-RU").includes("нагруз")
        ) {
          details.explanation.push(line.replace(/^[-*]\s+/, ""));
        } else {
          details.materials.push(line.replace(/^[-*]\s+/, ""));
        }
        return;
      }

      if (section === "description" && !details.description) {
        details.description = line;
        return;
      }
      if (section === "description") {
        details.explanation.push(line.replace(/^[-*]\s+/, ""));
        return;
      }
      details[section].push(line.replace(/^[-*]\s+/, ""));
    });

    return details;
  }

  function normalizeTaskDetails(source) {
    if (!source) return null;
    return {
      description: source.description || "",
      explanation: normalizeList(source.explanation),
      materials: Array.isArray(source.materials)
        ? source.materials
        : normalizeList(source.materials),
      instructions: normalizeList(source.instructions),
    };
  }

  function hasTaskDetails(details) {
    return Boolean(
      details &&
        (details.description ||
          details.explanation.length ||
          details.materials.length ||
          details.instructions.length),
    );
  }

  function getTaskDetails(task) {
    const details = normalizeTaskDetails(task?.details);
    const fallback = normalizeTaskDetails(
      parseLegacyDetails(task?.description),
    );
    const resolvedDetails = hasTaskDetails(details) ? details : fallback;
    if (!resolvedDetails || !hasTaskDetails(resolvedDetails)) return null;
    return resolvedDetails;
  }

  function renderDetailsPreview(task) {
    const details = getTaskDetails(task);
    if (!details) return "";
    const materials = normalizeList(details.materials).map((item) => {
      if (typeof item === "string") return item;
      const blocks = item.blocks ? `, блоки ${item.blocks}` : "";
      const href = item.href || "";
      const label = `${item.label || "Материал"}${blocks}`;
      return href
        ? `**${label}** — [ссылка](${toAbsoluteSiteUrl(href)})`
        : `**${label}**`;
    });
    const sections = [
      ["Описание", renderTextBlock(details.description)],
      ["Пояснение", renderList(details.explanation)],
      ["Материалы", renderList(materials)],
      ["Что сделать", renderList(details.instructions)],
    ].filter(([, body]) => body);

    return sections
      .map(
        ([title, body]) => `
          <article class="kanban-detail-section">
            <h3>${escapeHtml(t(title))}</h3>
            <div class="kanban-detail-body">${body}</div>
          </article>
        `,
      )
      .join("");
  }

  return {
    escapeHtml,
    stripMarkdown,
    toAbsoluteSiteUrl,
    parseLegacyDetails,
    getTaskDetails,
    renderDetailsPreview,
  };
});
