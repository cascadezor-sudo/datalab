/**
 * skeleton-loader.js
 * Helpers to inject and remove skeleton loading states for all async site components.
 *
 * Usage:
 *   SkeletonLoader.show('leaderboard', '#leaderboardList', 8);
 *   SkeletonLoader.show('stat',        '#leaderboardStats', 3);
 *   SkeletonLoader.show('report',      '#reports-container', 5);
 *   SkeletonLoader.show('chartSkeleton', '#stats-container');
 *   SkeletonLoader.show('achievement', '#achievements-container', 9);
 *   SkeletonLoader.show('quiz',        '#quiz-catalog', 6);
 *   SkeletonLoader.show('feedback',    '#feedbacksList', 4);
 *   SkeletonLoader.show('progress',    '#heatmapSections', 2);
 *   SkeletonLoader.hide('#leaderboardList');
 */

const SkeletonLoader = (() => {
  /* ── Helpers ────────────────────────────────────────── */
  const sk = (extra = "") => `<div class="sk ${extra}"></div>`;

  /* ── Template generators ─────────────────────────────── */

  function statCard() {
    return `
      <div class="stat-card--skeleton">
        <div class="sk sk-st-num" style="height:32px;width:64px;border-radius:8px"></div>
        <div class="sk sk-st-label" style="height:12px;width:80px;border-radius:9999px"></div>
      </div>`;
  }

  function leaderboardRow() {
    return `
      <div class="leaderboard-entry--skeleton">
        <div class="sk sk-circle" style="width:36px;height:36px;flex-shrink:0"></div>
        <div class="sk sk-circle" style="width:40px;height:40px;flex-shrink:0"></div>
        <div style="flex:1;display:flex;flex-direction:column;gap:7px;min-width:0">
          <div class="sk" style="height:14px;width:55%"></div>
          <div class="sk" style="height:11px;width:38%"></div>
        </div>
        <div style="display:flex;gap:16px;flex-shrink:0">
          ${Array(5).fill('<div class="sk" style="width:36px;height:14px"></div>').join("")}
        </div>
      </div>`;
  }

  function reportCard() {
    return `
      <div class="report-card--skeleton">
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <div class="sk sk-pill" style="height:14px;width:100px"></div>
          <div class="sk sk-pill" style="height:14px;width:52px"></div>
          <div class="sk sk-pill" style="height:24px;width:64px"></div>
          <div class="sk sk-pill" style="height:24px;width:64px"></div>
        </div>
        <div style="display:flex;flex-direction:column;gap:7px">
          <div class="sk" style="height:11px;width:80px"></div>
          <div class="sk" style="height:13px;width:100%"></div>
          <div class="sk" style="height:13px;width:78%"></div>
        </div>
        <div style="display:flex;flex-direction:column;gap:7px">
          <div class="sk" style="height:11px;width:60px"></div>
          <div class="sk" style="height:13px;width:100%"></div>
          <div class="sk" style="height:13px;width:55%"></div>
        </div>
      </div>`;
  }

  // Horizontal bar chart skeleton that matches the hours chart dimensions
  function chartSkeleton() {
    const barHeights = [
      20, 45, 70, 30, 55, 80, 40, 65, 25, 50, 75, 35, 60, 85, 45, 20, 55, 70,
      30, 90, 40, 65, 25, 50, 75, 35, 60, 45, 80, 20,
    ];
    return `
      <div class="hours-chart-skeleton">
        <div class="hours-chart-skeleton-header">
          <div class="sk sk-circle" style="width:40px;height:40px"></div>
          <div class="sk sk-pill" style="height:18px;width:180px"></div>
          <div class="sk sk-pill" style="height:16px;width:120px"></div>
          <div class="sk sk-circle" style="width:40px;height:40px"></div>
        </div>
        <div class="hours-chart-skeleton-bars">
          ${barHeights.map((h) => `<div class="sk" style="flex:1;height:${h}%;border-radius:4px 4px 0 0"></div>`).join("")}
        </div>
      </div>`;
  }

  function achievementCard() {
    return `
      <div class="achievement-card--skeleton">
        <div class="sk sk-circle" style="width:56px;height:56px;margin-bottom:4px"></div>
        <div class="sk sk-pill" style="height:15px;width:70%"></div>
        <div class="sk" style="height:11px;width:85%"></div>
        <div class="sk" style="height:11px;width:60%"></div>
        <div class="sk sk-pill" style="height:6px;width:100%;margin-top:4px"></div>
      </div>`;
  }

  // Quiz card skeleton matching the .quiz-catalog grid layout
  function quizCard() {
    return `
      <div class="quiz-card--skeleton">
        <div class="sk sk-pill" style="position:absolute;top:14px;right:14px;height:22px;width:80px"></div>
        <div style="display:flex;flex-direction:column;gap:8px;padding-right:96px">
          <div class="sk" style="height:18px;width:65%"></div>
          <div class="sk sk-pill" style="height:20px;width:80px"></div>
        </div>
        <div class="sk" style="height:12px;width:90%"></div>
        <div class="sk" style="height:12px;width:72%"></div>
        <div style="display:flex;gap:16px">
          ${Array(3).fill('<div class="sk sk-pill" style="height:13px;width:56px"></div>').join("")}
        </div>
        <div class="sk sk-pill" style="height:6px;width:100%"></div>
      </div>`;
  }

  function feedbackCard() {
    return `
      <div class="feedback-card--skeleton">
        <div class="sk-fb-header" style="display:flex;align-items:center;justify-content:space-between;gap:12px">
          <div style="display:flex;flex-direction:column;gap:7px;flex:1;min-width:0">
            <div class="sk" style="height:14px;width:50%"></div>
            <div class="sk" style="height:11px;width:30%"></div>
          </div>
          <div class="sk sk-pill" style="height:22px;width:90px;flex-shrink:0"></div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px">
          <div class="sk" style="height:12px;width:100%"></div>
          <div class="sk" style="height:12px;width:80%"></div>
        </div>
      </div>`;
  }

  function progressSection() {
    const items = Array(4)
      .fill(
        `
      <div class="heatmap-item--skeleton">
        <div class="sk sk-circle" style="width:52px;height:52px;flex-shrink:0"></div>
        <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:7px">
          <div class="sk" style="height:13px;width:65%"></div>
          <div class="sk sk-pill" style="height:6px;width:100%"></div>
          <div class="sk" style="height:11px;width:40%"></div>
        </div>
      </div>`,
      )
      .join("");
    return `
      <div class="heatmap-section--skeleton">
        <div class="sk-hm-header" style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
          <div class="sk" style="width:36px;height:36px;border-radius:8px;flex-shrink:0"></div>
          <div class="sk" style="height:16px;width:160px;border-radius:6px"></div>
        </div>
        <div class="sk-hm-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">
          ${items}
        </div>
      </div>`;
  }

  /* ── Template map ────────────────────────────────────── */
  const templates = {
    stat: statCard,
    leaderboard: leaderboardRow,
    report: reportCard,
    chartSkeleton: () => chartSkeleton(),
    achievement: achievementCard,
    quiz: quizCard,
    feedback: feedbackCard,
    progress: progressSection,
  };

  /* ── Public API ──────────────────────────────────────── */
  return {
    /**
     * Show skeleton loading state in a container.
     * @param {string} type        - Component type key
     * @param {string|Element} target  - CSS selector or DOM element
     * @param {number} [count=1]       - Repetitions
     */
    show(type, target, count = 1) {
      const el =
        typeof target === "string" ? document.querySelector(target) : target;
      if (!el) return;

      const gen = templates[type];
      if (!gen) {
        console.warn("SkeletonLoader: unknown type", type);
        return;
      }

      // For quiz wrap in grid; achievements/stat inject directly so the
      // container's existing grid applies to skeleton cards.
      let html = Array(count).fill(0).map(gen).join("");
      if (type === "quiz") {
        html = `<div class="quiz-catalog-skeleton">${html}</div>`;
      } else if (type === "stat") {
        html = `<div class="stats-skeleton-grid">${html}</div>`;
      }

      el.setAttribute("data-sk-original", el.innerHTML);
      el.innerHTML = html;
      el.setAttribute("data-sk-active", type);
    },

    /**
     * Remove skeleton marker from element (content should already be replaced
     * by the calling render function).
     */
    hide(target) {
      const el =
        typeof target === "string" ? document.querySelector(target) : target;
      if (!el) return;
      el.removeAttribute("data-sk-active");
      el.removeAttribute("data-sk-original");
    },

    /**
     * Insert difficulty skeleton into each question card before the real UI loads.
     */
    showAllDifficulty() {
      document.querySelectorAll("#questions > li.question").forEach((q) => {
        if (
          q.querySelector(
            ".question-difficulty-container,.question-difficulty-container--skeleton",
          )
        )
          return;
        q.insertAdjacentHTML("beforeend", _difficultyRowHTML());
      });
    },

    hideDifficulty(questionElement) {
      const sk = questionElement.querySelector(
        ".question-difficulty-container--skeleton",
      );
      if (sk) sk.remove();
    },
  };

  // Kept as module-private for showAllDifficulty fallback use
  function _difficultyRowHTML() {
    return `
      <div class="question-difficulty-container--skeleton">
        <div style="display:flex;flex-direction:column;gap:8px">
          <div class="sk" style="height:11px;width:64px"></div>
          <div style="display:flex;gap:6px">
            ${Array(5).fill('<div class="sk" style="width:22px;height:22px;border-radius:4px"></div>').join("")}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:12px">
          <div class="sk sk-pill" style="width:100px;height:30px"></div>
          <div class="sk" style="width:44px;height:14px"></div>
        </div>
      </div>`;
  }
})();

window.SkeletonLoader = SkeletonLoader;
