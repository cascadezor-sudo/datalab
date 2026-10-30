/**
 * Какие ключи materialAccess открывают страницу.
 *
 * То же правило, по которому material-access-guard.js решает, пускать ли
 * ученика на страницу: questionPaths и roadmapUrl каждой категории из
 * categories-config.json плюс extraPageCategories (переопределяет). Guard
 * держит свою копию, потому что грузится на страницы материалов лениво и без
 * зависимостей; здесь — та же карта для учебного плана: постановка этапа на
 * доску открывает ученику все страницы из списка материалов, иначе задание
 * поставлено, а страница закрыта, и ученик идёт просить доступ.
 *
 * Подключается обычным <script> (window.MaterialPageCategories) и
 * require()-ом из tests/*.test.js.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.MaterialPageCategories = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function buildPathToCategories(config) {
    const categories = config?.categories || {};
    const map = {};
    const labels = {};
    Object.entries(categories).forEach(([categoryId, cat]) => {
      labels[categoryId] = cat.displayNameRu || cat.displayName || categoryId;
      [...(cat.questionPaths || []), (cat.roadmapUrl || "").replace(/^\//, "")]
        .filter(Boolean)
        .forEach((path) => {
          if (!map[path]) map[path] = [];
          if (!map[path].includes(categoryId)) map[path].push(categoryId);
        });
    });
    Object.entries(config?.extraPageCategories || {}).forEach(([path, ids]) => {
      map[path] = ids.slice();
    });
    return { map, labels };
  }

  /* «/bank/» и «/interviews/videos.html?type=mlsd» — это bank/index.html и
     interviews/videos.html: query и хэш на доступ не влияют. */
  function normalizePath(href) {
    let path = String(href || "")
      .replace(/^https?:\/\/[^/]+/i, "")
      .replace(/[?#].*$/, "")
      .replace(/^\/(en\/)?/, "");
    if (!path || path.endsWith("/")) path += "index.html";
    return path;
  }

  /* Те же три варианта поиска, что у functions/page-access.js: паритет
     прибит tests/material-page-categories.test.js. Замки здесь только
     подсказка: что открыть на самом деле, решает сервер. */
  function categoriesForPath(pathMap, href) {
    const map = pathMap?.map || {};
    const raw = String(href || "")
      .replace(/^https?:\/\/[^/]+/i, "")
      .replace(/[?#].*$/, "")
      .replace(/^\/(en\/)?/, "");
    return (
      map[normalizePath(href)] || map[raw] || map[`${raw}/index.html`] || []
    );
  }

  return { buildPathToCategories, normalizePath, categoriesForPath };
});
