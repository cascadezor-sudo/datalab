/**
 * Image Zoom Component
 * Uses event delegation for HMR-safe operation
 */

(function () {
  "use strict";

  // Перевод интерфейса (ядро — сниппет theme-boot). В тестах под Node его нет:
  // остаётся русский текст с подставленными значениями.
  const t =
    window.t ||
    ((text, params) =>
      text.replace(/\{(\w+)\}/g, (match, key) => params?.[key] ?? match));

  // Prevent double initialization
  if (window.__imageZoomInitialized) {
    console.log("Image zoom: Already initialized, skipping");
    return;
  }
  window.__imageZoomInitialized = true;

  let modal = null;

  /**
   * Create the modal structure
   */
  function createModal() {
    if (modal) return modal;

    modal = document.createElement("div");
    modal.className = "image-zoom-modal";
    modal.innerHTML = `
      <button class="image-zoom-close" aria-label="${t("Закрыть")}">×</button>
      <div class="image-zoom-content">
        <img src="" alt="">
        <div class="image-zoom-caption"></div>
      </div>
    `;
    document.body.appendChild(modal);

    // Close on background click
    modal.addEventListener("click", function (e) {
      if (e.target === modal) {
        closeZoom();
      }
    });

    // Close button
    const closeBtn = modal.querySelector(".image-zoom-close");
    closeBtn.addEventListener("click", closeZoom);

    return modal;
  }

  /**
   * Add zoom buttons to all figures (idempotent)
   */
  function addZoomButtons() {
    const figures = document.querySelectorAll("figure");

    figures.forEach((figure) => {
      // Skip if button already exists
      if (figure.querySelector(".image-zoom-btn")) return;

      const img = figure.querySelector(":scope > img");
      if (!img) return;

      // Add lazy loading to all images
      if (!img.hasAttribute("loading")) {
        img.setAttribute("loading", "lazy");
        img.setAttribute("decoding", "async");
      }

      // Add zoom button
      const zoomBtn = document.createElement("button");
      zoomBtn.className = "image-zoom-btn";
      zoomBtn.innerHTML = "🔍";
      zoomBtn.setAttribute("aria-label", t("Увеличить изображение"));
      figure.appendChild(zoomBtn);

      // Set cursor
      img.style.cursor = "zoom-in";

      if (isOwnGif(img)) addGifControls(figure, img);
    });
  }

  // Пауза и скорость для GIF: кнопки рисуются сразу, а декодер
  // (gif-player.js) грузится только по первому нажатию.
  const GIF_SPEEDS = [0.5, 1, 1.5, 2];

  function isOwnGif(img) {
    try {
      const url = new URL(img.getAttribute("src") || "", location.href);
      return url.origin === location.origin && /\.gif$/i.test(url.pathname);
    } catch {
      return false;
    }
  }

  function addGifControls(figure, img) {
    if (figure.querySelector(".gif-controls")) return;
    const controls = document.createElement("div");
    controls.className = "gif-controls";
    controls.setAttribute("role", "group");
    controls.setAttribute("aria-label", t("Управление анимацией"));
    controls.innerHTML =
      `<button type="button" class="gif-controls-toggle" data-gif-action="toggle" data-state="playing" aria-label="${t("Пауза")}">` +
      '<svg class="gif-icon-pause" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="2" width="3.5" height="12" rx="1"/><rect x="9.5" y="2" width="3.5" height="12" rx="1"/></svg>' +
      '<svg class="gif-icon-play" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11a.8.8 0 0 0 1.2.7l9-5.5a.8.8 0 0 0 0-1.4l-9-5.5A.8.8 0 0 0 4 2.5z"/></svg>' +
      "</button>" +
      GIF_SPEEDS.map(
        (speed) =>
          `<button type="button" data-gif-speed="${speed}" aria-pressed="${speed === 1}" aria-label="${t("Скорость {speed}×", { speed })}">${speed}×</button>`,
      ).join("");
    img.after(controls);
  }

  let gifPlayerLoading = null;

  function loadGifPlayer() {
    if (window.gifPlayer) return Promise.resolve(window.gifPlayer);
    gifPlayerLoading ??= new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "/assets/js/components/gif-player.js";
      script.onload = () => resolve(window.gifPlayer);
      script.onerror = () => {
        gifPlayerLoading = null;
        reject(new Error("gif-player.js failed to load"));
      };
      document.head.appendChild(script);
    });
    return gifPlayerLoading;
  }

  /**
   * Open zoom modal with the clicked image
   */
  function openZoom(img, figure) {
    if (!modal) {
      createModal();
    }

    const modalImg = modal.querySelector("img");
    const caption = modal.querySelector(".image-zoom-caption");
    const figcaption = figure.querySelector("figcaption");

    modalImg.src = img.src;
    modalImg.alt = img.alt || "";

    // Set caption with HTML (to preserve formatting) and render KaTeX
    if (figcaption && figcaption.textContent.trim()) {
      caption.innerHTML = figcaption.innerHTML;
      caption.style.display = "block";

      // Render KaTeX if available
      if (typeof renderMathInElement !== "undefined") {
        try {
          renderMathInElement(caption, {
            delimiters: [
              { left: "$$", right: "$$", display: true },
              { left: "$", right: "$", display: false },
              { left: "\\[", right: "\\]", display: true },
              { left: "\\(", right: "\\)", display: false },
            ],
            throwOnError: false,
          });
        } catch (e) {
          console.warn("KaTeX rendering failed:", e);
        }
      }
    } else {
      caption.textContent = "";
      caption.style.display = "none";
    }

    modal.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  /**
   * Close zoom modal
   */
  function closeZoom() {
    if (!modal) return;

    modal.classList.remove("active");
    document.body.style.overflow = "";
  }

  /**
   * Initialize with event delegation
   */
  function init() {
    // Create modal
    createModal();

    // Add zoom buttons to existing figures
    addZoomButtons();

    // Event delegation - ONE handler for ALL images (HMR-safe!)
    document.addEventListener(
      "click",
      function (e) {
        const gifButton = e.target.closest(".gif-controls button");
        if (gifButton) {
          e.preventDefault();
          e.stopPropagation();
          loadGifPlayer()
            .then((player) => player.handle(gifButton))
            .catch((error) => console.warn("[image-zoom]", error));
          return;
        }

        // Check if clicked on image inside figure (у GIF на паузе — canvas)
        const clicked = e.target.closest(
          "figure > img, figure > canvas.gif-player-canvas",
        );
        if (clicked) {
          e.preventDefault();
          e.stopPropagation();
          const figure = clicked.parentElement;
          openZoom(figure.querySelector(":scope > img"), figure);
          return;
        }

        // Check if clicked on zoom button
        const zoomBtn = e.target.closest(".image-zoom-btn");
        if (zoomBtn) {
          e.preventDefault();
          e.stopPropagation();
          const figure = zoomBtn.closest("figure");
          const figImg = figure ? figure.querySelector(":scope > img") : null;
          if (figImg) {
            openZoom(figImg, figure);
          }
          return;
        }
      },
      true,
    ); // Use capture phase

    // Watch for dynamically added figures
    const observer = new MutationObserver(() => {
      addZoomButtons();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Keyboard support
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && modal && modal.classList.contains("active")) {
        closeZoom();
      }
    });
  }

  // Initialize once DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Expose reinit function for manual calls if needed
  window.reinitImageZoom = addZoomButtons;
})();
