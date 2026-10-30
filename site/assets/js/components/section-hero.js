/**
 * Section Hero / Section Shell: подставляет число вопросов в элемент с data-section-hero="question-count".
 * Ищет в .section-hero__stats или .section-shell__meta (или любой [data-section-hero="question-count"]).
 */
(function () {
  function pluralQuestions(n) {
    if (window.i18n) {
      return (
        n +
        " " +
        window.i18n.plural(n, {
          ru: ["вопрос", "вопроса", "вопросов"],
          en: ["question", "questions"],
        })
      );
    }
    if (n % 10 === 1 && n % 100 !== 11) return n + " вопрос";
    if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20))
      return n + " вопроса";
    return n + " вопросов";
  }

  function init() {
    var questionsList = document.getElementById("questions");
    var countEl = document.querySelector(
      '[data-section-hero="question-count"]',
    );
    if (!questionsList || !countEl) return;

    var count = questionsList.querySelectorAll("li.question").length;
    countEl.textContent = pluralQuestions(count);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
