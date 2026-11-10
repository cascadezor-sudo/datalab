(function () {
  "use strict";

  // Перевод интерфейса (ядро — сниппет theme-boot). Без него — русский текст
  // с подставленными значениями.
  const t =
    window.t ||
    ((text, params) =>
      text.replace(/\{(\w+)\}/g, (match, key) => params?.[key] ?? match));

  const categoryOrder = [
    "progress",
    "consistency",
    "volume",
    "special",
    "discount",
    "quiz",
  ];
  const TIER_ORDER = ["bronze", "silver", "gold", "platinum"];
  const TIER_LABELS = {
    bronze: "Бронза",
    silver: "Серебро",
    gold: "Золото",
    platinum: "Платина",
  };

  function fillTier(target, tier) {
    target.textContent = TIER_LABELS[tier] ? t(TIER_LABELS[tier]) : tier;
  }

  function renderTierLegend() {
    const target = document.getElementById("achievements-tier-legend");
    if (!target) return;
    target.replaceChildren(
      ...TIER_ORDER.map((tier) => {
        const chip = document.createElement("span");
        chip.className = "achievement-tier-chip";
        chip.dataset.tier = tier;
        fillTier(chip, tier);
        return chip;
      }),
    );
  }

  function dateLabel(timestamp) {
    return new Intl.DateTimeFormat(window.i18n?.locale || "ru-RU", {
      dateStyle: "medium",
    }).format(new Date(timestamp));
  }

  function createCard(achievement, unlockedAt) {
    const card = document.createElement("article");
    card.className = `achievement-card ${unlockedAt ? "achievement-unlocked" : "achievement-locked"} ${achievement.category}`;
    card.dataset.category = achievement.category;
    card.dataset.tier = achievement.tier;
    const tier = document.createElement("span");
    tier.className = "achievement-card-tier";
    fillTier(tier, achievement.tier);
    tier.title = t("Тир достижения");
    card.appendChild(tier);
    card.appendChild(
      window.achievementCatalog.icon(
        achievement,
        "achievement-card-icon",
        t(achievement.title),
      ),
    );
    const content = document.createElement("div");
    content.className = "achievement-card-content";
    const title = document.createElement("h2");
    title.className = "achievement-card-title";
    title.textContent = t(achievement.title);
    const description = document.createElement("p");
    description.className = "achievement-card-description";
    description.textContent = t(achievement.description);
    const date = document.createElement("p");
    date.className = "achievement-card-date";
    date.textContent = unlockedAt
      ? t("Получено: {date}", { date: dateLabel(unlockedAt) })
      : t("Ещё не получено");
    content.append(title, description, date);
    card.appendChild(content);
    return card;
  }

  function renderProgress(unlocked, total) {
    const target = document.getElementById("achievements-progress-container");
    if (!target) return;
    const percentage = total ? Math.round((unlocked / total) * 100) : 0;
    target.replaceChildren();
    const text = document.createElement("span");
    text.className = "achievements-count";
    text.textContent = `${unlocked}/${total} (${percentage}%)`;
    const bar = document.createElement("div");
    bar.className = "achievements-progress-bar";
    const fill = document.createElement("div");
    fill.className = "achievements-progress-fill";
    fill.style.width = `${percentage}%`;
    bar.appendChild(fill);
    target.append(text, bar);
  }

  function applyFilter(filters, container, filter) {
    filters.querySelectorAll(".filter-btn").forEach((button) => {
      const selected = button.dataset.filter === filter;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    container.querySelectorAll(".achievement-card").forEach((card) => {
      card.classList.toggle(
        "is-filtered-out",
        filter !== "all" && card.dataset.category !== filter,
      );
    });
  }

  function installFilters(container) {
    const filters = document.querySelector(".achievements-filters");
    if (!filters || filters.dataset.achievementFiltersInstalled === "true")
      return;
    filters.dataset.achievementFiltersInstalled = "true";
    filters.addEventListener("click", (event) => {
      const button = event.target.closest(".filter-btn");
      if (!button) return;
      applyFilter(filters, container, button.dataset.filter || "all");
    });
    applyFilter(
      filters,
      container,
      filters.querySelector(".filter-btn.active")?.dataset.filter || "all",
    );
  }

  async function load() {
    const container = document.getElementById("achievements-container");
    if (!container || !window.firebase) return;
    window.SkeletonLoader?.show("achievement", "#achievements-container", 9);
    const config = await window.configLoader.loadFirebaseConfig();
    if (!firebase.apps.length) firebase.initializeApp(config);
    window.globalAchievementNotifications?.initialize(config);
    firebase.auth().onAuthStateChanged(async (user) => {
      if (!user) {
        window.location.assign("/index.html");
        return;
      }
      try {
        // One-time trusted backfill for progress recorded before Functions v2.
        // A failure should not prevent the read-only catalogue from opening.
        const reconciled = await window.achievementApi
          ?.reconcileAchievements?.()
          .catch((error) => {
            console.warn("Achievement backfill was skipped:", error);
            return null;
          });
        // Тот же бэкфилл догоняет разделы, которые ученик добрал, пока
        // автооткрытие было сломано (см. functions/auto-unlock.js).
        window.autoUnlock?.showUnlocks(reconciled?.unlockedLabels);
        const [catalog, snapshot] = await Promise.all([
          window.achievementCatalog.load(),
          firebase
            .database()
            .ref(`user_achievements/${user.uid}`)
            .once("value"),
        ]);
        renderTierLegend();
        const unlocked = snapshot.val() || {};
        const entries = catalog.achievements.slice().sort((a, b) => {
          const aUnlocked = unlocked[a.id]?.unlockedAt || 0;
          const bUnlocked = unlocked[b.id]?.unlockedAt || 0;
          if (Boolean(aUnlocked) !== Boolean(bUnlocked))
            return bUnlocked - aUnlocked;
          if (aUnlocked && bUnlocked) return bUnlocked - aUnlocked;
          return (
            categoryOrder.indexOf(a.category) -
            categoryOrder.indexOf(b.category)
          );
        });
        const fragment = document.createDocumentFragment();
        entries.forEach((achievement) =>
          fragment.appendChild(
            createCard(
              achievement,
              unlocked[achievement.id]?.unlockedAt,
            ),
          ),
        );
        container.replaceChildren(fragment);
        renderProgress(
          Object.keys(unlocked).filter((id) => catalog.byId.has(id)).length,
          catalog.achievements.length,
        );
        installFilters(container);
      } catch (error) {
        console.error("Failed to load achievements:", error);
        container.textContent = t(
          "Не удалось загрузить достижения. Попробуйте обновить страницу.",
        );
      } finally {
        window.SkeletonLoader?.hide("#achievements-container");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", load, { once: true });
})();
