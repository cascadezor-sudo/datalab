// Lightweight Dictionary TOC sidebar for dictionary page
(function () {
  if (typeof document === "undefined") return;

  // Перевод интерфейса (ядро — сниппет theme-boot). В тестах под Node его нет:
  // остаётся русский текст с подставленными значениями.
  const t =
    window.t ||
    ((text, params) =>
      text.replace(/\{(\w+)\}/g, (match, key) => params?.[key] ?? match));

  function injectStyles() {
    if (document.getElementById("dictionary-toc-styles")) return;
    const style = document.createElement("style");
    style.id = "dictionary-toc-styles";
    style.textContent = `
      .dictionary-toc {
        position: fixed;
        top: 84px;
        right: 20px;

        width: 320px;
        max-height: calc(100vh - 130px);
        overflow: hidden; /* важно: скролл будет у списка */
        z-index: 1000;

        border-radius: 16px;
        border: 1px solid rgba(148, 163, 184, 0.18);
        background: rgba(15, 23, 42, 0.55); /* под дарк */
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);

        box-shadow:
          0 10px 30px rgba(0, 0, 0, 0.25),
          inset 0 1px 0 rgba(255, 255, 255, 0.04);

        transition: width .22s ease, transform .22s ease, opacity .22s ease;
      }

      /* Header */
      .dictionary-toc__header {
        position: sticky;
        top: 0;
        z-index: 10;

        display: flex;
        align-items: center;
        gap: 10px;

        padding: 12px 12px;
        border-bottom: 1px solid rgba(148, 163, 184, 0.14);

        background: rgba(15, 23, 42, 0.6);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
      }

      .dictionary-toc__title {
        font-weight: 700;
        letter-spacing: 0.2px;
        color: rgba(226, 232, 240, 0.92);
        flex: 1;
      }

      /* Toggle */
      .dictionary-toc__toggle {
        appearance: none;
        border: 1px solid rgba(148, 163, 184, 0.22);
        background: rgba(2, 6, 23, 0.35);
        color: rgba(226, 232, 240, 0.95);

        border-radius: 10px;
        padding: 6px 10px;
        cursor: pointer;

        transition: transform .15s ease, background .15s ease, border-color .15s ease;
      }

      .dictionary-toc__toggle:hover {
        background: rgba(148, 163, 184, 0.10);
        border-color: rgba(148, 163, 184, 0.30);
      }

      .dictionary-toc__toggle:active {
        transform: scale(0.98);
      }

      .dictionary-toc__toggle:focus-visible {
        outline: 2px solid rgba(139, 92, 246, 0.65);
        outline-offset: 2px;
      }

      /* List scroll */
      .dictionary-toc__list {
        list-style: none;
        margin: 0;
        padding: 10px;

        max-height: calc(100vh - 220px);
        overflow: auto;

        scrollbar-width: thin;
        scrollbar-color: rgba(139, 92, 246, 0.75) rgba(148, 163, 184, 0.12);
      }

      .dictionary-toc__list::-webkit-scrollbar { width: 10px; }
      .dictionary-toc__list::-webkit-scrollbar-track {
        background: rgba(148, 163, 184, 0.10);
        border-radius: 10px;
      }
      .dictionary-toc__list::-webkit-scrollbar-thumb {
        background: rgba(139, 92, 246, 0.75);
        border-radius: 10px;
        border: 2px solid rgba(148, 163, 184, 0.10);
      }

      /* Links */
      .dictionary-toc__link {
        position: relative;
        display: flex;
        align-items: center;
        gap: 10px;

        padding: 9px 10px;
        border-radius: 12px;

        text-decoration: none;
        color: rgba(226, 232, 240, 0.86);

        font-size: 14px;
        line-height: 1.35;

        transition: background .15s ease, color .15s ease, transform .15s ease;
      }

      .dictionary-toc__link:hover {
        background: rgba(148, 163, 184, 0.10);
        color: rgba(226, 232, 240, 0.98);
      }

      /* Активный пункт — левый индикатор + мягкий фон */
      .dictionary-toc__link.active {
        background: rgba(139, 92, 246, 0.18);
        color: rgba(233, 213, 255, 0.98);
        font-weight: 600;
      }

      .dictionary-toc__link.active::before {
        content: "";
        position: absolute;
        left: 6px;
        top: 8px;
        bottom: 8px;
        width: 3px;
        border-radius: 3px;
        background: rgba(139, 92, 246, 0.95);
      }

      /* focus */
      .dictionary-toc__link:focus-visible {
        outline: 2px solid rgba(139, 92, 246, 0.65);
        outline-offset: 2px;
      }

      /* Title text */
      .dictionary-toc__title-text {
        display: block;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      /* Emoji icon */
      .dictionary-toc__emoji {
        display: inline-block;
        font-size: 18px;
        line-height: 1;
        flex-shrink: 0;
      }

      /* Light theme: вместо "черного стекла" — светлое стекло */
      body:not(.dark) .dictionary-toc {
        background: rgba(255, 255, 255, 0.75);
        border-color: rgba(15, 23, 42, 0.10);
        box-shadow:
          0 10px 26px rgba(2, 6, 23, 0.10),
          inset 0 1px 0 rgba(255, 255, 255, 0.65);
      }

      body:not(.dark) .dictionary-toc__header {
        background: rgba(255, 255, 255, 0.72);
        border-bottom-color: rgba(15, 23, 42, 0.08);
      }

      body:not(.dark) .dictionary-toc__title {
        color: rgba(15, 23, 42, 0.90);
      }

      body:not(.dark) .dictionary-toc__toggle {
        background: rgba(255, 255, 255, 0.75);
        color: rgba(15, 23, 42, 0.90);
        border-color: rgba(15, 23, 42, 0.12);
      }

      body:not(.dark) .dictionary-toc__link {
        color: rgba(15, 23, 42, 0.78);
      }

      body:not(.dark) .dictionary-toc__link:hover {
        background: rgba(15, 23, 42, 0.05);
        color: rgba(15, 23, 42, 0.92);
      }

      body:not(.dark) .dictionary-toc__link.active {
        background: rgba(139, 92, 246, 0.12);
        color: rgba(76, 29, 149, 0.95);
      }

      /* Collapsed state */
      .dictionary-toc.collapsed {
        width: 68px;
      }

      .dictionary-toc.collapsed .dictionary-toc__title {
        display: none;
      }

      .dictionary-toc.collapsed .dictionary-toc__title-text {
        display: none;
      }

      .dictionary-toc.collapsed .dictionary-toc__list {
        padding: 10px 8px;
      }

      .dictionary-toc.collapsed .dictionary-toc__link {
        justify-content: center;
        padding: 10px;
      }

      .dictionary-toc.collapsed .dictionary-toc__emoji {
        font-size: 20px;
      }

      @media (max-width: 1200px) {
        .dictionary-toc { display: none; }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureId(element, prefix) {
    if (!element.id) {
      const text = element.textContent
        .trim()
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-")
        .substring(0, 50);
      element.id = `${prefix}-${text}-${Date.now()}`;
    }
    return element.id;
  }

  function extractEmoji(text) {
    // Извлекаем первый эмодзи из текста
    const emojiMatch = text.match(
      /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u,
    );
    return emojiMatch ? emojiMatch[0] : "📄";
  }

  function getDictionaryItems() {
    const sections = document.querySelectorAll(".dictionary-section");
    if (sections.length === 0) return [];

    const items = [];
    sections.forEach((section) => {
      const titleElement = section.querySelector(".section-title");
      if (!titleElement) return;

      const id = ensureId(section, "section");
      const titleHtml = titleElement.innerHTML.trim();
      const titleText = titleElement.textContent.trim();
      const emoji = extractEmoji(titleText);

      items.push({
        type: "section",
        id,
        titleHtml,
        titleText,
        emoji,
        element: section,
      });
    });

    return items;
  }

  function createToc(items) {
    const toc = document.createElement("nav");
    toc.className = "dictionary-toc";

    const header = document.createElement("div");
    header.className = "dictionary-toc__header";
    header.innerHTML = `<span class="dictionary-toc__title">${t("Навигация")}</span>`;

    const toggleBtn = document.createElement("button");
    toggleBtn.className = "dictionary-toc__toggle";
    toggleBtn.type = "button";
    toggleBtn.title = t("Свернуть/развернуть");
    toggleBtn.setAttribute(
      "aria-label",
      t("Свернуть/развернуть панель навигации"),
    );
    toggleBtn.textContent = "⟷";
    header.appendChild(toggleBtn);

    const list = document.createElement("ul");
    list.className = "dictionary-toc__list";

    function renderList() {
      list.innerHTML = "";
      items.forEach((item) => {
        const li = document.createElement("li");
        li.className = "dictionary-toc__item";

        const a = document.createElement("a");
        a.className = "dictionary-toc__link";
        a.href = `#${item.id}`;
        // Убираем эмодзи из titleHtml для текста, так как оно будет отдельно
        const titleWithoutEmoji = item.titleHtml
          .replace(
            /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu,
            "",
          )
          .trim();
        a.innerHTML = `<span class="dictionary-toc__emoji">${item.emoji}</span><span class="dictionary-toc__title-text">${titleWithoutEmoji}</span>`;

        a.addEventListener("click", (e) => {
          e.preventDefault();
          const target = document.getElementById(item.id);
          if (target) {
            // Scroll with offset from top
            const elementTop =
              target.getBoundingClientRect().top + window.pageYOffset;
            const offset = 180; // Offset from top in pixels
            window.scrollTo({
              top: elementTop - offset,
              behavior: "auto", // Instant scroll, no smooth animation
            });

            // Scroll navigation panel to show active link
            setTimeout(() => {
              scrollToActiveLink(a);
            }, 50);

            history.replaceState(null, "", `#${item.id}`);
          }
        });

        li.appendChild(a);
        list.appendChild(li);
      });
    }

    renderList();

    toc.appendChild(header);
    toc.appendChild(list);

    // Persistence of collapsed state
    const applyCollapsed = (collapsed) => {
      if (collapsed) toc.classList.add("collapsed");
      else toc.classList.remove("collapsed");
      try {
        localStorage.setItem("dictionaryTocCollapsed", collapsed ? "1" : "0");
      } catch (_) {}
      setToggleIcon();
    };

    const setToggleIcon = () => {
      toggleBtn.textContent = toc.classList.contains("collapsed") ? "⟶" : "⟵";
    };

    let saved = null;
    try {
      saved = localStorage.getItem("dictionaryTocCollapsed");
    } catch (_) {
      saved = null;
    }
    if (saved === "1") toc.classList.add("collapsed");
    setToggleIcon();

    toggleBtn.addEventListener("click", () => {
      const willCollapse = !toc.classList.contains("collapsed");
      applyCollapsed(willCollapse);
    });

    toggleBtn.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleBtn.click();
      }
    });

    return toc;
  }

  function scrollToActiveLink(activeLink) {
    if (!activeLink) return;

    const toc = activeLink.closest(".dictionary-toc");
    if (!toc) return;

    // Check if link is visible in viewport of the navigation panel
    const linkRect = activeLink.getBoundingClientRect();
    const tocRect = toc.getBoundingClientRect();

    // If link is outside visible area (with some margin), scroll to it
    const headerHeight = 60; // Approximate header height
    const bottomMargin = 20;
    if (
      linkRect.top < tocRect.top + headerHeight ||
      linkRect.bottom > tocRect.bottom - bottomMargin
    ) {
      activeLink.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
    }
  }

  function setupScrollSpy(items, container) {
    const links = Array.from(
      container.querySelectorAll(".dictionary-toc__link"),
    );
    const byId = new Map(items.map((it) => [it.id, it]));

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (!visible) return;

        const id = visible.target.id;
        const link = links.find((a) => a.getAttribute("href") === `#${id}`);
        if (!link) return;

        links.forEach((l) => l.classList.remove("active"));
        link.classList.add("active");

        // Scroll navigation panel to show active link
        setTimeout(() => {
          scrollToActiveLink(link);
        }, 100);
      },
      {
        root: null,
        rootMargin: "0px 0px -70% 0px",
        threshold: [0.0, 0.15, 0.3, 0.6],
      },
    );

    items.forEach((item) => {
      const el = item.element || document.getElementById(item.id);
      if (el) observer.observe(el);
    });
  }

  function init() {
    const items = getDictionaryItems();
    if (items.length === 0) return;
    injectStyles();
    const toc = createToc(items);
    document.body.appendChild(toc);
    setupScrollSpy(items, toc);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
