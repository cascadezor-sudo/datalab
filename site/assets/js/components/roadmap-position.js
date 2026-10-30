/**
 * Где ученик находится в учебном плане.
 *
 * Раньше и `calender/roadmap.html`, и кабинет куратора считали это одинаково и
 * одинаково неверно: «текущая неделя» = первая, у которой нет статуса done.
 * Пока план только дописывали в конец, это работало. Но план живёт: недели
 * добавляются и в середину — так в него завели Python Algorithms, Python
 * Advanced, Docker и NLP Optimization III. Прогресс хранится по milestone.id,
 * поэтому у ученика, который дошёл до 25-й недели, новые недели остались без
 * статуса — и «первая незакрытая» откатывала его назад, на вставленную неделю.
 *
 * Ломалась не только подпись. `defaultDueDate` считает срок как разницу
 * индексов «цель минус текущая», так что после отката куратор, назначая
 * следующую неделю, получал дедлайн на пять месяцев вперёд.
 *
 * Правило здесь другое: прогресс не идёт назад. Текущая — первая незакрытая
 * ПОСЛЕ последней закрытой. Для ученика, который закрывает недели подряд,
 * ответ тот же, что и раньше; вставка недели в уже пройденную часть плана его
 * позицию больше не двигает.
 *
 * Это не то же самое, что roadmap-progress.js: тот рисует проценты по
 * категориям на карточках разделов, здесь — только позиция в недельном плане.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.RoadmapPosition = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* isClosed — предикат вызывающего: на странице плана он учитывает ещё и
     статус карточек доски, в кабинете куратора — только progress. */
  function openMilestoneIndex(milestones, isClosed) {
    const list = Array.isArray(milestones) ? milestones : [];
    let lastClosed = -1;
    list.forEach((milestone, index) => {
      if (isClosed(milestone, index)) lastClosed = index;
    });
    const next = lastClosed + 1;
    return next < list.length ? next : -1;
  }

  function openMilestone(milestones, isClosed) {
    const index = openMilestoneIndex(milestones, isClosed);
    return index >= 0 ? milestones[index] : null;
  }

  return { openMilestoneIndex, openMilestone };
});
