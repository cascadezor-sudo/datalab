/**
 * Term Definitions Store
 * Единый файл определений для всех разделов. Подгружается на все страницы.
 *
 * Использование:
 * 1. Подключите этот скрипт ПЕРЕД term-tooltip.js.
 * 2. <span class="term-tooltip" data-term="overfitting">переобучение</span> — определение из хранилища.
 * 3. data-term-scope="classic-ml" на body — автообёртка только терминов этого раздела.
 *
 * Формат definitions.json:
 * {
 *   "section_labels": { "classic_ml": "Classic ML", "dl": "Deep Learning", ... },
 *   "classic_ml": { "overfitting": { "title", "definition", "pattern?", "pages?" }, ... },
 *   "dl": { ... },
 *   "python": { ... }
 * }
 * В тултипе показывается бейдж раздела (section_labels).
 * pages — список префиксов пути: многозначный термин («контейнер») оборачивается
 * только на этих страницах, см. termAllowedOnPage в term-tooltip.js.
 */
(function () {
  window.TERM_DEFINITIONS = window.TERM_DEFINITIONS || {};
  window.TERM_DEFINITIONS_SECTION_LABELS =
    window.TERM_DEFINITIONS_SECTION_LABELS || {};

  /**
   * Загружает единый JSON и сливает разделы в TERM_DEFINITIONS (с полем section у каждого термина).
   */
  function loadUnifiedDefinitions() {
    // Английский интерфейс — английский словарь: те же ключи терминов,
    // английские title/definition и шаблоны поиска под английский текст.
    var file =
      window.i18n && window.i18n.lang === "en"
        ? "definitions.en.json"
        : "definitions.json";
    return fetch("/assets/data/definitions/" + file)
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        if (!data || typeof data !== "object" || Array.isArray(data)) return;
        var sectionLabels = data.section_labels;
        if (sectionLabels && typeof sectionLabels === "object") {
          window.TERM_DEFINITIONS_SECTION_LABELS = sectionLabels;
        }
        for (var sectionKey in data) {
          if (sectionKey === "section_labels") continue;
          var section = data[sectionKey];
          if (!section || typeof section !== "object" || Array.isArray(section))
            continue;
          for (var termKey in section) {
            var entry = section[termKey];
            if (!entry || typeof entry !== "object") continue;
            window.TERM_DEFINITIONS[termKey] = Object.assign(
              { section: sectionKey },
              entry,
            );
          }
        }
        return data;
      });
  }

  /**
   * Регистрирует определения из объекта (удобно для вставки из другого скрипта).
   * @param {object} definitions — объект вида { "term": { title, definition, section? }, ... }
   */
  function registerTermDefinitions(definitions) {
    if (definitions && typeof definitions === "object") {
      for (var key in definitions) {
        var entry = definitions[key];
        if (entry && typeof entry === "object") {
          window.TERM_DEFINITIONS[key] = Object.assign({}, entry);
          if (!window.TERM_DEFINITIONS[key].section) {
            window.TERM_DEFINITIONS[key].section = "general";
          }
        }
      }
    }
  }

  function runLoader() {
    loadUnifiedDefinitions()
      .catch(function (err) {
        console.warn("Term definitions load failed:", err.message);
      })
      .then(function () {
        window.dispatchEvent(new Event("termdefinitionsready"));
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runLoader);
  } else {
    runLoader();
  }

  window.registerTermDefinitions = registerTermDefinitions;
})();
