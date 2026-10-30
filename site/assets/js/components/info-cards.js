/**
 * Создает и вставляет info-card
 * @param {Object} options - Параметры карточки
 * @param {string} options.type - Тип карточки (definition, explanation, remark, example, warning, exercise)
 * @param {string} options.title - Заголовок карточки
 * @param {string} options.content - HTML содержимое карточки
 * @param {string} [options.target] - CSS селектор элемента, куда вставить карточку
 * @returns {HTMLElement} Созданный элемент карточки
 */
function createInfoCard({
  type = "definition",
  title,
  content,
  target = null,
  delivery = null,
}) {
  const card = document.createElement("div");
  card.className = `info-card ${type}`;
  if (delivery) {
    card.dataset.delivery = delivery;
  }

  const deliveryBadge = getExerciseDeliveryBadge(type, delivery);

  card.innerHTML = `
    <div class="info-icon"></div>
    <div class="info-content">
      <div class="info-title">${title}</div>
      ${deliveryBadge}
      ${content}
    </div>
  `;

  renderInfoCardTitleMath(card);

  if (target) {
    const targetElement = document.querySelector(target);
    if (targetElement) {
      targetElement.appendChild(card);
    }
  }

  return card;
}

function getExerciseDeliveryBadge(type, delivery) {
  if (type !== "exercise" || !delivery) return "";

  const labels = {
    ide: t("Можно сдавать вне сайта в IDE"),
    local: t("Можно сдавать вне сайта"),
    offline: t("Можно сдавать вне сайта"),
    external: t("Можно сдавать вне сайта"),
  };

  const normalizedDelivery = String(delivery).trim().toLowerCase();
  const label = labels[normalizedDelivery] || labels.external;
  return `<div class="exercise-delivery-badge">${label}</div>`;
}

function renderInfoCardTitleMath(card) {
  const titleElement = card.querySelector(".info-title");
  if (!titleElement || typeof renderMathInElement !== "function") return;

  renderMathInElement(titleElement, {
    delimiters: [
      { left: "$$", right: "$$", display: true },
      { left: "$", right: "$", display: false },
      { left: "\\(", right: "\\)", display: false },
      { left: "\\[", right: "\\]", display: true },
    ],
    throwOnError: false,
  });
}

// Создаем функции-помощники для каждого типа карточки
const infoCards = {
  definition: (title, content, target) =>
    createInfoCard({ type: "definition", title, content, target }),

  explanation: (title, content, target) =>
    createInfoCard({ type: "explanation", title, content, target }),

  remark: (title, content, target) =>
    createInfoCard({ type: "remark", title, content, target }),

  example: (title, content, target) =>
    createInfoCard({ type: "example", title, content, target }),

  warning: (title, content, target) =>
    createInfoCard({ type: "warning", title, content, target }),

  exercise: (title, content, target) =>
    createInfoCard({ type: "exercise", title, content, target }),

  teormin: (title, content, target) =>
    createInfoCard({ type: "teormin", title, content, target }),
};

/**
 * Инициализирует info-cards из HTML-разметки
 * Использование:
 * <div class="info-card-auto"
 *      data-type="definition"
 *      data-title="Определение">
 *   Содержимое карточки здесь
 * </div>
 * @param {HTMLElement} [container=document] - Контейнер для поиска карточек (по умолчанию весь документ)
 */
function initInfoCards(container = document) {
  if (!container || typeof container.querySelectorAll !== "function") {
    container = document;
  }
  const placeholders = container.querySelectorAll(".info-card-auto");
  if (placeholders.length === 0) return;

  // Filter out info-card-auto inside .card-content - they are styled via CSS
  const placeholdersToProcess = Array.from(placeholders).filter(
    (placeholder) => !placeholder.closest(".card-content"),
  );

  if (placeholdersToProcess.length === 0) return;

  // Use lazy initialization for better performance (only for full document)
  if (
    container === document &&
    window.lazyInit &&
    placeholdersToProcess.length > 20
  ) {
    window.lazyInit.processWithPriority(".info-card-auto", (placeholder) => {
      // Skip if inside card-content
      if (placeholder.closest(".card-content")) return;

      const type = placeholder.dataset.type || "definition";
      const title = placeholder.dataset.title || "";
      const content = placeholder.innerHTML.trim();
      const delivery = placeholder.dataset.delivery || null;

      const card = createInfoCard({ type, title, content, delivery });
      placeholder.replaceWith(card);
    });
  } else {
    // For small pages or specific containers, process immediately
    placeholdersToProcess.forEach((placeholder) => {
      const type = placeholder.dataset.type || "definition";
      const title = placeholder.dataset.title || "";
      const content = placeholder.innerHTML.trim();
      const delivery = placeholder.dataset.delivery || null;

      const card = createInfoCard({ type, title, content, delivery });
      placeholder.replaceWith(card);
    });
  }
}

// Инициализация при загрузке страницы
document.addEventListener("DOMContentLoaded", () => {
  // Load lazy-init if not already loaded
  if (!window.lazyInit) {
    const script = document.createElement("script");
    script.src = "/assets/js/components/lazy-init.js";
    script.onload = () => initInfoCards();
    document.head.appendChild(script);
  } else {
    initInfoCards();
  }
});

// Экспортируем для использования в других модулях
window.infoCards = infoCards;
window.initInfoCards = initInfoCards;
