/**
 * Ученик, выбранный сотрудником, — общий для учебного плана
 * (calender/roadmap.html) и доски (calender/index.html).
 *
 * Хранится в localStorage под ключом с uid сотрудника: на одном браузере
 * могут сменять друг друга разные учётки, а выход из аккаунта чистит только
 * auth-ключи. В адресе дублируется как ?student= — так ссылку можно
 * передать, а перезагрузка не теряет выбор. Устаревший ?id= читается, но при
 * записи убирается, иначе он перебивал бы новый выбор после перезагрузки.
 *
 * Писать сюда должен только явный выбор человека (select/фильтр), не
 * промежуточные состояния поиска.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.StaffStudentSelection = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const KEY = "staff-selected-student";

  function keyFor(staffUid) {
    return `${KEY}:${staffUid || "anonymous"}`;
  }

  function selectedStudentFromUrl() {
    if (typeof location === "undefined") return "";
    const params = new URLSearchParams(location.search);
    return params.get("student") || params.get("id") || "";
  }

  function readSelectedStudent(staffUid) {
    try {
      return localStorage.getItem(keyFor(staffUid)) || "";
    } catch (error) {
      return "";
    }
  }

  function rememberSelectedStudent(staffUid, studentId) {
    try {
      if (studentId) localStorage.setItem(keyFor(staffUid), studentId);
      else localStorage.removeItem(keyFor(staffUid));
    } catch (error) {}
    try {
      const url = new URL(location.href);
      url.searchParams.delete("id");
      if (studentId) url.searchParams.set("student", studentId);
      else url.searchParams.delete("student");
      history.replaceState(null, "", url);
    } catch (error) {
      /* Safari ограничивает частоту replaceState; выбор уже сохранён. */
    }
  }

  return {
    selectedStudentFromUrl,
    readSelectedStudent,
    rememberSelectedStudent,
  };
});
