class RoadmapProgress {
  constructor() {
    this.cards = [];
    this.categories = {};
    this.pages = {};
    this.progressRef = null;
    this.unsubscribe = null;
  }

  static calculateCategoryProgress(questionIds, progressData) {
    const total = Array.isArray(questionIds) ? questionIds.length : 0;
    const completed = (questionIds || []).filter(
      (questionId) => progressData?.[questionId]?.completed === true,
    ).length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { completed, total, percentage };
  }

  getProgressCards() {
    return Array.from(
      document.querySelectorAll(
        "[data-progress-category], [data-progress-pages]",
      ),
    );
  }

  static parseKeys(value) {
    return (value || "")
      .split(/[\s,]+/)
      .map((key) => key.trim())
      .filter(Boolean);
  }

  getQuestionIds(card) {
    const categoryKeys = RoadmapProgress.parseKeys(
      card.dataset.progressCategory,
    );
    const pageKeys = RoadmapProgress.parseKeys(card.dataset.progressPages);
    const questionIds = [
      ...categoryKeys.flatMap((key) => this.categories[key] || []),
      ...pageKeys.flatMap((key) => this.pages[key] || []),
    ];

    return [...new Set(questionIds)];
  }

  renderState({ label, value = 0, max = 100, unavailable = false }) {
    this.cards.forEach((card) => {
      const content = card.querySelector(".card-content");
      const link = content?.querySelector(".card-link");
      if (
        !content ||
        !link ||
        content.querySelector(".roadmap-card-progress")
      ) {
        return;
      }

      const progress = document.createElement("div");
      progress.className = "roadmap-card-progress";
      progress.innerHTML = `
        <div class="roadmap-card-progress-head">
          <span>${t("Прогресс")}</span>
          <span class="roadmap-card-progress-value">${label}</span>
        </div>
        <progress class="roadmap-card-progress-native" value="${value}" max="${max}" aria-label="${t("Прогресс: {value}", { value: label })}">
          ${label}
        </progress>
        <div class="roadmap-card-progress-track" aria-hidden="true">
          <span style="width: ${max > 0 ? (value / max) * 100 : 0}%"></span>
        </div>
      `;

      if (unavailable) {
        progress.classList.add("is-unavailable");
      }

      content.insertBefore(progress, link);
    });
  }

  updateProgress(progressData) {
    this.cards.forEach((card) => {
      const progress = card.querySelector(".roadmap-card-progress");
      const valueLabel = progress?.querySelector(
        ".roadmap-card-progress-value",
      );
      const nativeProgress = progress?.querySelector("progress");
      const fill = progress?.querySelector(".roadmap-card-progress-track span");
      const questionIds = this.getQuestionIds(card);

      if (!progress || !valueLabel || !nativeProgress || !fill) return;

      if (!Array.isArray(questionIds) || questionIds.length === 0) {
        progress.classList.add("is-unavailable");
        valueLabel.textContent = t("Появится с материалами");
        nativeProgress.value = 0;
        nativeProgress.max = 1;
        nativeProgress.setAttribute(
          "aria-label",
          t("Прогресс появится с материалами"),
        );
        fill.style.width = "0%";
        return;
      }

      const { completed, total, percentage } =
        RoadmapProgress.calculateCategoryProgress(questionIds, progressData);
      const text = `${completed}/${total} · ${percentage}%`;

      progress.classList.remove("is-unavailable");
      valueLabel.textContent = text;
      nativeProgress.value = completed;
      nativeProgress.max = total;
      nativeProgress.textContent = text;
      nativeProgress.setAttribute(
        "aria-label",
        t("Прогресс: {value}", { value: text }),
      );
      fill.style.width = `${percentage}%`;
    });
  }

  async loadQuestions() {
    const response = await fetch("/assets/js/config/questions-list.json");
    if (!response.ok) {
      throw new Error(`Failed to load questions list: ${response.status}`);
    }

    const questionsList = await response.json();
    this.categories = questionsList.categories || {};
    this.pages = questionsList.pages || {};
  }

  async waitForFirebase(timeoutMs = 5000) {
    const startedAt = Date.now();

    while (
      (!window.firebase ||
        typeof window.firebase.auth !== "function" ||
        typeof window.firebase.database !== "function" ||
        !window.firebase.apps?.length) &&
      Date.now() - startedAt < timeoutMs
    ) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    if (
      !window.firebase ||
      typeof window.firebase.auth !== "function" ||
      !window.firebase.apps?.length
    ) {
      throw new Error("Firebase authentication is unavailable");
    }
  }

  subscribeToProgress(user) {
    if (this.progressRef) {
      this.progressRef.off("value", this.unsubscribe);
    }

    this.progressRef = window.firebase
      .database()
      .ref(`users/${user.uid}/progress`);
    this.unsubscribe = (snapshot) => this.updateProgress(snapshot.val() || {});
    this.progressRef.on("value", this.unsubscribe);
  }

  async initialize() {
    this.cards = this.getProgressCards();
    if (this.cards.length === 0) return;

    this.renderState({ label: t("Загрузка…") });

    try {
      await this.loadQuestions();
      this.updateProgress({});
      await this.waitForFirebase();

      window.firebase.auth().onAuthStateChanged((user) => {
        if (user) {
          this.subscribeToProgress(user);
        }
      });
    } catch (error) {
      console.error("Failed to initialize roadmap progress:", error);
      this.cards.forEach((card) => {
        const label = card.querySelector(".roadmap-card-progress-value");
        if (label) label.textContent = t("Не удалось загрузить");
      });
    }
  }
}

function initializeRoadmapProgress() {
  const roadmapProgress = new RoadmapProgress();
  roadmapProgress.initialize();
  window.roadmapProgress = roadmapProgress;
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeRoadmapProgress);
  } else {
    initializeRoadmapProgress();
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = RoadmapProgress;
}
