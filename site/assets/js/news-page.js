/**
 * news.html: each top-level bullet under .news-content becomes a card in a 3-column grid;
 * cards start collapsed (line-clamp preview) with per-card expand/collapse.
 * Лента отдаётся порциями: первые RELEASES_PER_PAGE релизов, дальше — по кнопке.
 */
(function () {
  const RELEASES_PER_PAGE = 5;

  function enhanceList(ul) {
    if (!ul || ul.classList.contains("news-chunks-grid")) return;
    const items = ul.querySelectorAll(":scope > li");
    if (items.length === 0) return;

    ul.classList.add("news-chunks-grid");

    items.forEach((li) => {
      if (li.querySelector(":scope > .news-chunk")) return;

      const chunk = document.createElement("div");
      chunk.className = "news-chunk";

      const text = document.createElement("div");
      text.className = "news-chunk__text news-chunk__text--collapsed";

      while (li.firstChild) {
        text.appendChild(li.firstChild);
      }

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "news-chunk__toggle";
      btn.setAttribute("aria-expanded", "false");
      btn.textContent = "Развернуть";

      btn.addEventListener("click", () => {
        const collapsed = text.classList.toggle("news-chunk__text--collapsed");
        btn.setAttribute("aria-expanded", String(!collapsed));
        btn.textContent = collapsed ? "Развернуть" : "Свернуть";
      });

      chunk.appendChild(text);
      chunk.appendChild(btn);
      li.appendChild(chunk);

      requestAnimationFrame(() => {
        if (text.scrollHeight <= text.clientHeight + 2) {
          text.classList.remove("news-chunk__text--collapsed");
          btn.hidden = true;
          btn.setAttribute("aria-expanded", "true");
        }
      });
    });
  }

  /**
   * Свёрнутый релиз: виден только заголовок с датой, разворачивается по клику.
   * Карточки размечаем при первом разворачивании: enhanceList меряет высоту
   * текста, а у скрытого контента она нулевая — кнопки «Развернуть» тогда
   * пропадают и превью не обрезается.
   */
  function collapseRelease(article, enhanceContent) {
    article.classList.add("news-item--release-collapsed");
    const header = article.querySelector(".news-header");
    if (!header) return;
    header.classList.add("news-header--collapsible");
    header.setAttribute("role", "button");
    header.setAttribute("tabindex", "0");
    header.setAttribute("aria-expanded", "false");

    const syncAria = () => {
      const collapsed = article.classList.contains(
        "news-item--release-collapsed",
      );
      header.setAttribute("aria-expanded", String(!collapsed));
    };

    const toggle = () => {
      const collapsed = article.classList.toggle(
        "news-item--release-collapsed",
      );
      if (!collapsed) enhanceContent();
      syncAria();
    };

    header.addEventListener("click", toggle);
    header.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    });
  }

  /**
   * Разметку карточек и обработчики вешаем только на показанные релизы:
   * в ленте под сотню статей, гонять их все на старте незачем.
   */
  function hydrateArticle(article, index) {
    if (article.dataset.newsHydrated === "1") return;
    article.dataset.newsHydrated = "1";

    const enhanceContent = () =>
      article
        .querySelectorAll(".news-content > ul")
        .forEach((ul) => enhanceList(ul));

    /** Первый блок в ленте — последний релиз; остальные свёрнуты. */
    if (index === 0) {
      enhanceContent();
      return;
    }
    collapseRelease(article, enhanceContent);
  }

  function initPagination(container, articles) {
    let shown = 0;

    const footer = document.createElement("div");
    footer.className = "news-load-more";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "news-load-more__btn";

    const counter = document.createElement("span");
    counter.className = "news-load-more__count";

    footer.appendChild(button);
    footer.appendChild(counter);
    container.appendChild(footer);

    function revealNext(focusFirstNew) {
      const from = shown;
      const to = Math.min(shown + RELEASES_PER_PAGE, articles.length);
      for (let i = from; i < to; i += 1) {
        articles[i].hidden = false;
        hydrateArticle(articles[i], i);
      }
      shown = to;

      const left = articles.length - shown;
      counter.textContent = `Показано ${shown} из ${articles.length}`;
      if (left > 0) {
        button.textContent = `Загрузить ещё ${Math.min(
          left,
          RELEASES_PER_PAGE,
        )}`;
      } else {
        footer.hidden = true;
      }

      if (focusFirstNew && articles[from]) {
        const header = articles[from].querySelector(".news-header");
        if (header && typeof header.focus === "function") header.focus();
      }
    }

    button.addEventListener("click", () => revealNext(true));

    articles.forEach((article) => {
      article.hidden = true;
    });
    revealNext(false);
  }

  function init() {
    const container = document.querySelector(".news-container");
    if (!container) return;
    const articles = Array.from(container.querySelectorAll(".news-item"));
    if (articles.length === 0) return;

    if (articles.length <= RELEASES_PER_PAGE) {
      articles.forEach(hydrateArticle);
      return;
    }

    initPagination(container, articles);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
