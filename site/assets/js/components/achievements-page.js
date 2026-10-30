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
  // Тир достижения — то, за что платит кошелёк. Подписи те же, что на
  // wallet.html; суммы — из того же конфига, по которому начисляет сервер.
  const TIER_ORDER = ["bronze", "silver", "gold", "platinum"];
  const TIER_LABELS = {
    bronze: "Бронза",
    silver: "Серебро",
    gold: "Золото",
    platinum: "Платина",
  };
  const WALLET_CONFIG_URL = "/assets/js/config/wallet-config.json";

  async function loadTierRewards() {
    try {
      const response = await fetch(WALLET_CONFIG_URL, { cache: "no-cache" });
      if (!response.ok) return {};
      return (await response.json()).achievementTiers || {};
    } catch (error) {
      // Без конфига карточки покажут тир без суммы — страница живёт дальше.
      return {};
    }
  }

  // Подпись тира с наградой: «Золото · +150» и та же иконка монеты, что в
  // навбаре и кошельке (символ #grad-coin вставляет navigation.js). Если
  // навигация ещё не загрузилась — текстовый ∇.
  function fillTier(target, tier, rewards) {
    const label = TIER_LABELS[tier] ? t(TIER_LABELS[tier]) : tier;
    const amount = Number(rewards?.[tier]);
    target.replaceChildren();
    if (!(amount > 0)) {
      target.textContent = label;
      return;
    }
    target.append(`${label} · +${amount} `);
    const icon = window.walletUi?.createCoinIcon?.("coin-icon");
    target.append(icon || "∇");
  }

  function renderTierLegend(rewards) {
    const target = document.getElementById("achievements-tier-legend");
    if (!target) return;
    target.replaceChildren(
      ...TIER_ORDER.map((tier) => {
        const chip = document.createElement("span");
        chip.className = "achievement-tier-chip";
        chip.dataset.tier = tier;
        fillTier(chip, tier, rewards);
        return chip;
      }),
    );
  }

  function dateLabel(timestamp) {
    return new Intl.DateTimeFormat(window.i18n?.locale || "ru-RU", {
      dateStyle: "medium",
    }).format(new Date(timestamp));
  }

  function createCard(achievement, unlockedAt, rewards) {
    const card = document.createElement("article");
    card.className = `achievement-card ${unlockedAt ? "achievement-unlocked" : "achievement-locked"} ${achievement.category}`;
    card.dataset.category = achievement.category;
    card.dataset.tier = achievement.tier;
    const tier = document.createElement("span");
    tier.className = "achievement-card-tier";
    fillTier(tier, achievement.tier, rewards);
    tier.title = t("Тир достижения и награда в градах");
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
        // Бэкфилл монет за прошлую активность — та же ручка; сумму покажем
        // один раз, дальше сервер отвечает нулём.
        window.walletUi?.showCredit(reconciled?.wallet);
        const [catalog, snapshot, rewards] = await Promise.all([
          window.achievementCatalog.load(),
          firebase
            .database()
            .ref(`user_achievements/${user.uid}`)
            .once("value"),
          loadTierRewards(),
        ]);
        renderTierLegend(rewards);
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
              rewards,
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
