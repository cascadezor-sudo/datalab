/**
 * Anchor Scroll Handler
 *
 * Fixes vs. previous version:
 *  - handledHash guard: each hash is scrolled to only ONCE per navigation,
 *    preventing re-jumps while the user types in the code editor.
 *  - User-interaction cancels any pending retry (keydown / pointerdown / touchstart).
 *  - Only one retry attempt instead of 10 × 500 ms.
 *  - Expands lazy/hidden question content before scrolling.
 */

(function () {
  "use strict";

  /** Hash that was most recently scrolled to.  Re-set on explicit click or popstate. */
  let handledHash = null;
  let retryTimer = null;

  function clearRetry() {
    if (retryTimer !== null) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  }

  // Cancel pending retry the moment the user interacts with the page
  // (typing in the code editor, clicking elsewhere, etc.)
  ["keydown", "pointerdown", "touchstart"].forEach(function (evt) {
    document.addEventListener(evt, clearRetry, {
      passive: true,
      capture: true,
    });
  });

  // ── Expansion helper ────────────────────────────────────────────────────────

  function expandQuestionIfNeeded(questionEl) {
    if (!questionEl) return;
    var content = questionEl.querySelector(".content");
    if (!content || content.style.display !== "none") return;

    // Prefer the global helper exposed by lazy-questions.js
    var nameEl = questionEl.querySelector(".name");
    if (window.expandQuestion && nameEl && nameEl.id) {
      window.expandQuestion(nameEl.id);
    } else if (nameEl) {
      // Fallback: simulate click on the name element
      nameEl.click();
    }
  }

  // ── Scroll + highlight ──────────────────────────────────────────────────────

  function scrollToElement(element) {
    var questionEl = element.closest(".question");
    var top = element.getBoundingClientRect().top + window.pageYOffset - 180;
    window.scrollTo({ top: top, behavior: "auto" });

    // Re-scroll after KaTeX / lazy content renders settle (they shift layout)
    setTimeout(function () {
      var newTop =
        element.getBoundingClientRect().top + window.pageYOffset - 180;
      if (Math.abs(newTop - top) > 30) {
        window.scrollTo({ top: newTop, behavior: "auto" });
      }
    }, 500);

    setTimeout(function () {
      if (questionEl) {
        questionEl.classList.add("question-highlight");
        setTimeout(function () {
          questionEl.classList.remove("question-highlight");
        }, 2000);
      }
    }, 50);
  }

  // ── Core logic ──────────────────────────────────────────────────────────────

  /**
   * Try to scroll to `hash`.
   * Returns true if the element was found (so callers know whether to retry).
   */
  function tryScrollToHash(hash) {
    if (!hash) return true;
    if (hash === handledHash) return true; // already handled — do NOT re-scroll

    var element = document.getElementById(hash);
    if (!element) return false; // not in DOM yet; caller may retry

    handledHash = hash; // claim before any async work

    var questionEl = element.closest(".question");
    var content = questionEl && questionEl.querySelector(".content");
    if (content && content.style.display === "none") {
      expandQuestionIfNeeded(questionEl);
      // Give the expand animation time to settle before measuring position
      setTimeout(function () {
        scrollToElement(element);
      }, 220);
    } else {
      scrollToElement(element);
    }
    return true;
  }

  function handleAnchorScroll() {
    clearRetry();
    if (!window.location.hash) return;
    var hash = window.location.hash.substring(1);
    if (!tryScrollToHash(hash)) {
      // Element not in DOM yet — one retry after a short wait
      retryTimer = setTimeout(function () {
        retryTimer = null;
        tryScrollToHash(hash);
      }, 800);
    }
  }

  // ── Same-page anchor clicks ─────────────────────────────────────────────────

  document.addEventListener("click", function (event) {
    var link = event.target.closest("a");
    // Ссылка с хэшем на другую страницу — обычный переход: id теории и
    // практики могут совпасть, и перехват молча оставил бы ученика на месте.
    if (
      !link ||
      !link.hash ||
      link.hostname !== window.location.hostname ||
      link.pathname !== window.location.pathname
    )
      return;

    var hash = link.hash.substring(1);
    var element = document.getElementById(hash);
    if (!element) return;

    event.preventDefault();
    handledHash = null; // allow re-scroll on explicit user click

    var questionEl = element.closest(".question");
    var content = questionEl && questionEl.querySelector(".content");
    if (content && content.style.display === "none") {
      expandQuestionIfNeeded(questionEl);
      setTimeout(function () {
        scrollToElement(element);
        window.history.pushState(null, "", link.hash);
      }, 220);
      return;
    }

    scrollToElement(element);
    window.history.pushState(null, "", link.hash);
  });

  // ── Initialisation ──────────────────────────────────────────────────────────

  function init() {
    if (window.location.hash) {
      setTimeout(handleAnchorScroll, 150);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // One additional attempt after full page load (images/iframes etc.)
  // Only runs if the initial attempt didn't handle the hash yet.
  window.addEventListener("load", function () {
    if (window.location.hash && !handledHash) {
      setTimeout(handleAnchorScroll, 250);
    }
  });

  // Browser back / forward
  window.addEventListener("popstate", function () {
    handledHash = null;
    clearRetry();
    setTimeout(handleAnchorScroll, 100);
  });
})();
