/**
 * Auto-Unlock (клиентская часть).
 *
 * Решение о том, какие разделы открыть, принимает сервер: callable
 * `setQuestionProgress` / `setQuestionProgressBatch` пересчитывает прогресс и
 * возвращает `unlockedLabels`. Здесь остаётся только показать тост.
 *
 * Раньше и подсчёт, и запись доступов жили в браузере, но правила RTDB
 * намеренно запрещают ученику писать свой `users/{uid}/materialAccess`
 * (иначе можно было бы открыть себе все разделы из консоли), поэтому запись
 * молча падала и разделы не открывались ни у кого. Сама прогрессия и порог
 * завершённости теперь в `functions/auto-unlock.js`.
 */
function _showUnlockToast(label) {
  if (window.globalAchievementNotifications) {
    window.globalAchievementNotifications.show({
      icon: "🔓",
      title: t("Новый раздел открыт!"),
      description: t("Ты прошёл все вопросы и разблокировал: {label}", {
        label,
      }),
    });
    return;
  }

  // Fallback toast если система нотификаций недоступна
  const toast = document.createElement("div");
  toast.style.cssText = [
    "position:fixed;bottom:20px;left:20px;z-index:10000;",
    "background:var(--card-bg,#1e2024);",
    "border:1px solid rgba(34,197,94,0.5);",
    "border-radius:14px;padding:18px 22px;max-width:320px;",
    "box-shadow:0 8px 32px rgba(0,0,0,0.35);",
    "transform:translateX(-120%);",
    "transition:transform 0.4s cubic-bezier(0.4,0,0.2,1);",
    "color:var(--text-primary,#fff);font-family:system-ui,sans-serif;",
  ].join("");
  toast.innerHTML =
    '<div style="font-size:28px;margin-bottom:8px;">🔓</div>' +
    '<div style="font-weight:700;font-size:15px;margin-bottom:4px;">' +
    t("Новый раздел открыт!") +
    "</div>" +
    '<div style="font-size:13px;opacity:0.75;line-height:1.4;">' +
    label +
    "</div>";
  document.body.appendChild(toast);

  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      toast.style.transform = "translateX(0)";
    }),
  );
  setTimeout(() => {
    toast.style.transform = "translateX(-120%)";
    setTimeout(() => toast.remove(), 420);
  }, 5000);
}

// Два быстрых клика по чекбоксам порождают два параллельных вызова callable:
// оба читают доступы до выдачи и возвращают один и тот же список. Записи
// идемпотентны, а вот тост показался бы дважды — поэтому помним показанное.
const _shownLabels = new Set();

/**
 * Показывает тосты по разделам, которые открыл сервер.
 * @param {string[]} labels - поле `unlockedLabels` из ответа callable
 */
function showUnlocks(labels) {
  if (!Array.isArray(labels) || labels.length === 0) return;
  labels.forEach((label) => {
    if (!label || _shownLabels.has(label)) return;
    _shownLabels.add(label);
    _showUnlockToast(label);
  });
}

window.autoUnlock = { showUnlocks };
