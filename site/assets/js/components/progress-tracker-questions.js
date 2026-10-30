// Progress Tracker for Question Pages
class QuestionProgressTracker {
  constructor() {
    this.currentUser = null;
    this.userRole = null;
    this.progressData = {};
    this.isInitialized = false;
    this.firebaseConfig = null;
    this.db = null;
    this.pageQuestions = [];
  }

  /**
   * Escape special characters in CSS selector
   * @param {string} selector - The selector to escape
   * @returns {string} - Escaped selector
   */
  escapeCSSSelector(selector) {
    return selector.replace(/[!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~]/g, "\\$&");
  }

  /**
   * Initialize the progress tracker
   * @param {Object} firebaseConfig - Firebase configuration
   */
  async initialize(firebaseConfig) {
    try {
      this.firebaseConfig = firebaseConfig;

      // Initialize Firebase if not already done
      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }

      // Initialize Realtime Database
      this.db = firebase.database();

      // Listen for auth state changes
      firebase.auth().onAuthStateChanged((user) => {
        this.currentUser = user;
        if (user) {
          this.loadUserProgress();
        } else {
          this.loadAnonymousProgress();
        }
      });

      this.isInitialized = true;

      // Add progress control buttons
      this.addProgressControlButtons();

      // Listen for lazy questions ready event
      document.addEventListener("lazyQuestionsReady", () => {
        console.log("Progress tracker: Received lazyQuestionsReady event");
        setTimeout(() => {
          this.addProgressToQuestions();
        }, 200);
      });
    } catch (error) {
      console.error("Failed to initialize question progress tracker:", error);
      // Fallback to localStorage only
      this.loadAnonymousProgress();

      // Add progress control buttons even in case of error
      this.addProgressControlButtons();

      // Listen for lazy questions ready event even on error
      document.addEventListener("lazyQuestionsReady", () => {
        console.log(
          "Progress tracker: Received lazyQuestionsReady event (fallback mode)",
        );
        setTimeout(() => {
          this.addProgressToQuestions();
        }, 200);
      });
    }
  }

  /**
   * Load progress for authenticated user from Firebase
   */
  async loadUserProgress() {
    try {
      const [progressSnap, roleSnap] = await Promise.all([
        this.db.ref(`users/${this.currentUser.uid}/progress`).once("value"),
        this.db.ref(`users/${this.currentUser.uid}/role`).once("value"),
      ]);
      const dbProgress = progressSnap.val() || {};
      let anonProgress = {};
      try {
        anonProgress = JSON.parse(localStorage.getItem("anonymous_progress") || "{}");
      } catch (e) {}
      this.progressData = { ...anonProgress, ...dbProgress };
      this.userRole = roleSnap.val() || null;
      this.updateUI();
    } catch (error) {
      console.error("Failed to load user progress:", error);
      this.progressData = {};
    }
  }

  /**
   * Load progress for anonymous user from localStorage
   */
  loadAnonymousProgress() {
    try {
      const stored = localStorage.getItem("anonymous_progress");
      this.progressData = stored ? JSON.parse(stored) : {};
      this.updateUI();
    } catch (error) {
      console.error("Failed to load anonymous progress:", error);
      this.progressData = {};
    }
  }

  /**
   * Save progress to appropriate storage
   */
  async saveProgress() {
    try {
      if (this.currentUser) {
        if (window.achievementApi) {
          await window.achievementApi.setQuestionProgressBatch(this.progressData);
        }
        if (this.db) {
          await this.db.ref(`users/${this.currentUser.uid}/progress`).set(this.progressData);
        }
      }
      localStorage.setItem(
        "anonymous_progress",
        JSON.stringify(this.progressData),
      );
    } catch (error) {
      console.error("Failed to save progress:", error);
    }
  }

  /**
   * Save a single question progress using targeted update
   */
  async saveSingleProgressUpdate(questionId, data) {
    try {
      if (this.currentUser) {
        if (window.achievementApi) {
          const result = await window.achievementApi.setQuestionProgress(
            questionId,
            data?.completed !== false,
          );
          window.autoUnlock?.showUnlocks(result?.unlockedLabels);
          window.walletUi?.showCredit(result?.wallet);
        }
        if (this.db) {
          if (data?.completed !== false) {
            await this.db.ref(`users/${this.currentUser.uid}/progress/${questionId}`).set(data);
          } else {
            await this.db.ref(`users/${this.currentUser.uid}/progress/${questionId}`).remove();
          }
        }
      }
      const existingData = localStorage.getItem("anonymous_progress");
      const currentData = existingData ? JSON.parse(existingData) : {};
      if (data?.completed !== false) {
        currentData[questionId] = data;
      } else {
        delete currentData[questionId];
      }
      localStorage.setItem("anonymous_progress", JSON.stringify(currentData));
    } catch (error) {
      console.error("Failed to save single progress:", error);
    }
  }

  /**
   * Save bulk progress updates to appropriate storage
   * @param {Object} bulkUpdate - Object containing multiple question updates
   */
  async saveBulkProgress(bulkUpdate) {
    try {
      if (this.currentUser) {
        if (!window.achievementApi)
          throw new Error("Achievement API is not loaded");
        const result =
          await window.achievementApi.setQuestionProgressBatch(bulkUpdate);
        window.autoUnlock?.showUnlocks(result?.unlockedLabels);
        window.walletUi?.showCredit(result?.wallet);
      } else {
        // For localStorage, we still need to merge with existing data
        const existingData = localStorage.getItem("anonymous_progress");
        const currentData = existingData ? JSON.parse(existingData) : {};
        const mergedData = { ...currentData, ...bulkUpdate };
        localStorage.setItem("anonymous_progress", JSON.stringify(mergedData));
      }
    } catch (error) {
      console.error("Failed to save bulk progress:", error);
    }
  }

  /**
   * Remove specific questions from progress storage
   * @param {Array} questionIds - Array of question IDs to remove
   */
  async removeQuestionsFromProgress(questionIds) {
    try {
      if (this.currentUser) {
        if (!window.achievementApi)
          throw new Error("Achievement API is not loaded");
        await window.achievementApi.setQuestionProgressBatch(
          Object.fromEntries(
            questionIds.map((questionId) => [questionId, null]),
          ),
        );
      } else {
        // Remove from localStorage for anonymous users
        const existingData = localStorage.getItem("anonymous_progress");
        const currentData = existingData ? JSON.parse(existingData) : {};
        questionIds.forEach((questionId) => {
          delete currentData[questionId];
        });
        localStorage.setItem("anonymous_progress", JSON.stringify(currentData));
      }
    } catch (error) {
      console.error("Failed to remove questions from progress:", error);
    }
  }

  /**
   * Remove a single question from progress storage
   */
  async removeSingleQuestionFromProgress(questionId) {
    try {
      if (this.currentUser) {
        if (window.achievementApi) {
          await window.achievementApi.setQuestionProgress(questionId, false);
        }
        if (this.db) {
          await this.db.ref(`users/${this.currentUser.uid}/progress/${questionId}`).remove();
        }
      }
      const existingData = localStorage.getItem("anonymous_progress");
      const currentData = existingData ? JSON.parse(existingData) : {};
      delete currentData[questionId];
      localStorage.setItem("anonymous_progress", JSON.stringify(currentData));
    } catch (error) {
      console.error("Failed to remove single question from progress:", error);
    }
  }

  // buildPublicProgressSummary/updatePublicProgressSummary удалены: публичную
  // проекцию прогресса теперь ведёт сервер (refreshPublicProgress в
  // functions/index.js) прямо внутри setQuestionProgress и
  // setQuestionProgressBatch. Браузеру запись в public_stats больше не нужна,
  // а ветка закрыта правилами — иначе ученик выставлял себе прогресс, стрик и
  // роль из консоли.

  /**
   * Mark a question as completed
   * @param {string} questionId - Unique identifier for the question
   * @param {boolean} completed - Whether the question is completed
   */
  async markQuestionCompleted(questionId, completed) {
    if (this.currentUser && this.userRole === "curator") return;

    if (completed) {
      // Mark as completed - add to progress data (optimistic UI)
      const entry = {
        completed: true,
        timestamp: Date.now(),
        userId: this.currentUser ? this.currentUser.uid : "anonymous",
      };
      this.progressData[questionId] = entry;
      // Save in background using targeted update
      this.saveSingleProgressUpdate(questionId, entry).catch(() => {});
    } else {
      // Mark as incomplete - remove from progress data (optimistic UI)
      delete this.progressData[questionId];
      // Remove in background using targeted remove
      this.removeSingleQuestionFromProgress(questionId).catch(() => {});
    }

    // Проверяем достижения после изменения прогресса
    if (window.gamificationSystem && this.currentUser) {
      // Run achievements check asynchronously to avoid blocking UI
      Promise.resolve()
        .then(() => window.gamificationSystem.checkAchievements())
        .catch((error) => console.error("Error checking achievements:", error));
    }

    // Immediate UI update (optimistic)
    this.updateUI();
  }

  /**
   * Check if a question is completed
   * @param {string} questionId - Unique identifier for the question
   * @returns {boolean} - Whether the question is completed
   */
  isQuestionCompleted(questionId) {
    const isCompleted = this.progressData[questionId]?.completed || false;
    return isCompleted;
  }

  /**
   * Get completion percentage for the current page
   * @returns {number} - Completion percentage (0-100)
   */
  getPageCompletionPercentage() {
    if (this.pageQuestions.length === 0) return 0;

    const completedCount = this.pageQuestions.filter((id) =>
      this.isQuestionCompleted(id),
    ).length;
    const percentage = Math.round(
      (completedCount / this.pageQuestions.length) * 100,
    );

    return percentage;
  }

  /**
   * Add progress tracking to existing questions on the page
   */
  async addProgressToQuestions() {
    if (this.currentUser && this.userRole === undefined && this.db) {
      try {
        const roleSnap = await this.db
          .ref(`users/${this.currentUser.uid}/role`)
          .once("value");
        this.userRole = roleSnap.val() || null;
      } catch (e) {
        this.userRole = null;
      }
    }
    if (this.currentUser && this.userRole === "curator") return;

    // Find all question elements - support both regular questions and ML practice cards
    const questionElements = document.querySelectorAll("li.question");

    if (questionElements.length === 0) return;

    // Add overall progress display immediately (doesn't depend on individual questions)
    this.addOverallProgressDisplay();
    this.updateOverallProgress();

    // Process questions with lazy initialization for better performance
    const processQuestion = (questionElement, index) => {
      // Get the question ID from the inner div - support both regular and ML practice cards
      let nameDiv = questionElement.querySelector(".name");

      // If no .name div found, try to find it inside ml-practice-card
      if (!nameDiv) {
        const mlCard = questionElement.querySelector(".ml-practice-card");
        if (mlCard) {
          nameDiv = mlCard.querySelector(".name");
        }
      }

      if (!nameDiv || !nameDiv.id) {
        return;
      }

      const questionId = nameDiv.id;

      // Only add if not already added
      if (!this.pageQuestions.includes(questionId)) {
        this.pageQuestions.push(questionId);
      }

      // Add progress bar
      this.addProgressBarToQuestion(questionElement, questionId);

      // Update visual state
      this.updateQuestionVisualState(
        questionElement,
        this.isQuestionCompleted(questionId),
      );
    };

    // Use lazy initialization for large pages
    if (window.lazyInit && questionElements.length > 30) {
      // Process visible questions first, then others in batches
      window.lazyInit.processWithPriority("li.question", processQuestion);

      // Update progress bars and UI after initial batch
      setTimeout(() => {
        this.updateAllProgressBars();
        this.updateUI();
      }, 500);
    } else {
      // For smaller pages, process immediately
      questionElements.forEach(processQuestion);
      this.updateAllProgressBars();
      this.updateUI();
    }

    // Initialize difficulty rating if available (will use its own lazy loading)
    if (window.difficultyRating && window.difficultyRating.isInitialized) {
      // Delay difficulty rating initialization to not block UI
      setTimeout(() => {
        window.difficultyRating.addDifficultyRatingToQuestions();
      }, 100);
    }
  }

  /**
   * Add progress bar to a question element
   * @param {HTMLElement} questionElement - The question li element
   * @param {string} questionId - The question ID
   */
  addProgressBarToQuestion(questionElement, questionId) {
    // Don't create the old progress bar - it will be handled by difficulty rating component
    // Just update the visual state
    this.updateQuestionVisualState(
      questionElement,
      this.isQuestionCompleted(questionId),
    );
  }

  /**
   * Update visual state of a question
   * @param {HTMLElement} questionElement - The question element
   * @param {boolean} isCompleted - Whether the question is completed
   */
  updateQuestionVisualState(questionElement, isCompleted) {
    // Only update classes, don't change background colors
    if (isCompleted) {
      questionElement.classList.add("question-completed");
      questionElement.classList.remove("question-incomplete");
    } else {
      questionElement.classList.add("question-incomplete");
      questionElement.classList.remove("question-completed");
    }
  }

  /**
   * Update progress bar state
   * @param {HTMLElement} progressBarContainer - The progress bar container
   * @param {boolean} isCompleted - Whether the question is completed
   */
  updateProgressBarState(progressBarContainer, isCompleted) {
    if (isCompleted) {
      progressBarContainer.classList.add("completed");
      progressBarContainer.classList.remove("incomplete");
    } else {
      progressBarContainer.classList.add("incomplete");
      progressBarContainer.classList.remove("completed");
    }
  }

  /**
   * Собирает все question ID со страницы напрямую из DOM,
   * минуя lazy init (который мог ещё не обработать вопросы вне экрана).
   * Заодно регистрирует найденные ID в this.pageQuestions.
   * @returns {string[]} полный список ID
   */
  _collectAllPageQuestionIds() {
    const ids = [];
    document.querySelectorAll("li.question").forEach((li) => {
      let nameDiv = li.querySelector(".name");
      if (!nameDiv) {
        const mlCard = li.querySelector(".ml-practice-card");
        if (mlCard) nameDiv = mlCard.querySelector(".name");
      }
      if (!nameDiv || !nameDiv.id) return;
      const questionId = nameDiv.id;
      if (!this.pageQuestions.includes(questionId)) {
        this.pageQuestions.push(questionId);
      }
      ids.push(questionId);
    });
    return ids;
  }

  /**
   * Mark all questions as read
   */
  async markAllAsRead() {
    // Сканируем DOM напрямую: lazy init мог не обработать вопросы вне экрана,
    // поэтому pageQuestions может быть неполным на момент клика.
    const allIds = this._collectAllPageQuestionIds();

    const bulkUpdate = {};
    const timestamp = Date.now();
    const userId = this.currentUser ? this.currentUser.uid : "anonymous";

    allIds.forEach((questionId) => {
      // Skip auto-checked questions — only the checker itself may mark them done.
      // IDE/local delivery tasks are intentionally manual.
      const li = document.getElementById(questionId)?.closest("li.question");
      if (li && li.dataset.tests && !this.isManualDeliveryQuestion(li)) return;

      bulkUpdate[questionId] = {
        completed: true,
        timestamp: timestamp,
        userId: userId,
      };
    });

    // Update progress data in memory
    Object.assign(this.progressData, bulkUpdate);

    // Save to storage in one operation
    await this.saveBulkProgress(bulkUpdate);

    // Update UI
    this.updateUI();
  }

  isManualDeliveryQuestion(questionElement) {
    const delivery = String(questionElement?.dataset?.delivery || "")
      .trim()
      .toLowerCase();
    return ["ide", "local", "offline", "external"].includes(delivery);
  }

  /**
   * Mark all questions as unread
   */
  async markAllAsUnread() {
    // Также сканируем DOM напрямую для полноты
    this._collectAllPageQuestionIds();

    // Remove all questions from progress data
    this.pageQuestions.forEach((questionId) => {
      delete this.progressData[questionId];
    });

    // Remove from storage in one operation
    await this.removeQuestionsFromProgress(this.pageQuestions);

    // Update UI
    this.updateUI();
  }

  /**
   * Reorganize existing controls and add progress control buttons
   */
  addProgressControlButtons() {
    // Find the existing control panel
    const controlPanel = document.querySelector(".controls");

    if (!controlPanel) {
      const newPanel = document.createElement("div");
      newPanel.className = "controls reorganized";
      newPanel.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin: 20px 0;
        padding: 10px;
        background: var(--card-bg, #f8f9fa);
        border-radius: 8px;
        border: 1px solid var(--card-border, #dee2e6);
        @media (max-width: 768px) {
          margin: 10px 0;
          padding: 8px;
          font-size: 14px;
        }
      `;

      // Insert at the beginning of the body or after the first h1/h2
      const firstHeading = document.querySelector("h1, h2");
      if (firstHeading) {
        firstHeading.parentNode.insertBefore(
          newPanel,
          firstHeading.nextSibling,
        );
      } else {
        document.body.insertBefore(newPanel, document.body.firstChild);
      }

      this.reorganizeExistingControls(newPanel);
      return;
    }

    // Reorganize existing controls into dropdown
    this.reorganizeExistingControls(controlPanel);
  }

  /**
   * Reorganize existing control buttons into a dropdown
   * @param {HTMLElement} controlPanel - The control panel element
   */
  reorganizeExistingControls(controlPanel) {
    // Create main controls container
    const mainControls = document.createElement("div");
    mainControls.className = "main-controls";
    mainControls.style.cssText = `
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
      width: 100%;
      @media (max-width: 768px) {
        flex-direction: column;
        gap: 4px;
      }
    `;

    // Create left side controls container
    const leftControls = document.createElement("div");
    leftControls.style.cssText = `
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
      @media (max-width: 768px) {
        width: 100%;
        flex-direction: column;
        gap: 4px;
      }
    `;

    // Create right side controls container
    const rightControls = document.createElement("div");
    rightControls.style.cssText = `
      display: flex;
      gap: 8px;
      align-items: center;
      margin-left: auto;
      @media (max-width: 768px) {
        width: 100%;
        margin-left: 0;
        justify-content: space-between;
        gap: 4px;
      }
    `;

    // Create combined toggle button for marking all read/unread with new unified system
    const markAllToggleBtn = document.createElement("button");
    markAllToggleBtn.id = "mark-all-toggle-btn";
    markAllToggleBtn.type = "button";
    markAllToggleBtn.className = "progress-control-btn mark-all-read";
    markAllToggleBtn.textContent = t("Пометить все");

    // Функция для обновления состояния кнопки
    const updateToggleButtonState = () => {
      const completedCount = this.pageQuestions.filter((id) =>
        this.isQuestionCompleted(id),
      ).length;
      const isAllCompleted =
        completedCount === this.pageQuestions.length && completedCount > 0;

      if (isAllCompleted) {
        markAllToggleBtn.className = "progress-control-btn mark-all-unread";
        markAllToggleBtn.textContent = t("Снять отметки");
        markAllToggleBtn.classList.add("mark-all-unread");
        markAllToggleBtn.classList.remove("mark-all-read");
      } else {
        markAllToggleBtn.className = "progress-control-btn mark-all-read";
        markAllToggleBtn.textContent = t("Пометить все");
        markAllToggleBtn.classList.add("mark-all-read");
        markAllToggleBtn.classList.remove("mark-all-unread");
      }
    };

    // Обработчик клика
    markAllToggleBtn.addEventListener("click", async () => {
      const completedCount = this.pageQuestions.filter((id) =>
        this.isQuestionCompleted(id),
      ).length;
      const isAllCompleted =
        completedCount === this.pageQuestions.length && completedCount > 0;

      if (isAllCompleted) {
        await this.markAllAsUnread();
      } else {
        await this.markAllAsRead();
      }

      // Обновить состояние кнопки после изменения через updateUI()
      this.updateUI();
    });

    const markAllReveal = document.createElement("button");
    markAllReveal.id = "mark-all-reveal-btn";
    markAllReveal.className = "progress-control-btn mark-all-reveal";
    markAllReveal.type = "button";
    markAllReveal.textContent = t("Отметить всё?");
    markAllReveal.setAttribute("aria-expanded", "false");
    markAllReveal.title = t(
      "Показывает действие для массовой отметки вопросов на этой странице.",
    );

    const markAllWrap = document.createElement("div");
    markAllWrap.className = "mark-all-confirm";

    const markAllHint = document.createElement("span");
    markAllHint.className = "mark-all-confirm__hint";
    markAllHint.textContent = t(
      "Хочешь отметить все обычные вопросы на странице прочитанными? Автопроверяемые задачи засчитываются только после прохождения тестов.",
    );

    markAllReveal.addEventListener("click", () => {
      markAllWrap.classList.toggle("is-visible");
      markAllReveal.setAttribute(
        "aria-expanded",
        markAllWrap.classList.contains("is-visible") ? "true" : "false",
      );
    });

    markAllWrap.appendChild(markAllHint);
    markAllWrap.appendChild(markAllToggleBtn);

    leftControls.appendChild(markAllReveal);
    leftControls.appendChild(markAllWrap);

    // Add leftControls to main controls
    mainControls.appendChild(leftControls);

    // Clear control panel and add reorganized content
    controlPanel.innerHTML = "";
    controlPanel.appendChild(mainControls);

    // Add class to indicate reorganization is complete
    controlPanel.classList.add("reorganized");
  }

  /**
   * Add overall progress display to the page
   */
  addOverallProgressDisplay() {
    // Create progress container
    const progressContainer = document.createElement("div");
    progressContainer.className =
      "question-progress-container overall-progress-widget";
    progressContainer.style.cssText = `
      position: fixed;
      top: 0px;
      right: 60px;
      border-radius: 8px;
      padding: 4px 10px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      z-index: 1000;
      min-width: 200px;
      width: 260px;
    `;

    progressContainer.innerHTML = `
      <div class="progress-widget-title" style="margin-bottom:4px; font-size:13px;">${t("Прогресс")}</div>
      <div class="question-progress-bar overall-progress-bar" style="height:4px;">
        <div class="question-progress-fill overall-progress-fill" style="width: 0%; height: 100%;"></div>
      </div>
      <div class="question-progress-text overall-progress-text" style="margin-top:4px; font-size:12px;">0% (0/${this.pageQuestions.length})</div>
    `;

    // Don't add the old widget if TOC progress exists
    const tocProgress = document.getElementById("toc-progress-section");
    if (!tocProgress) {
      // Add to page only if TOC doesn't exist
      document.body.appendChild(progressContainer);
    }

    // Initial update
    this.updateOverallProgress();
  }

  /**
   * Update overall progress display
   */
  updateOverallProgress() {
    const percentage = this.getPageCompletionPercentage();
    const completedCount = this.pageQuestions.filter((id) =>
      this.isQuestionCompleted(id),
    ).length;

    // Update TOC progress bar first (preferred location)
    const tocProgressFill = document.getElementById("toc-progress-fill");
    const tocProgressText = document.getElementById("toc-progress-text");
    const tocProgressPercent = document.getElementById("toc-progress-percent");

    if (tocProgressFill) {
      tocProgressFill.style.width = `${percentage}%`;
    } else {
      console.log(
        "TOC progress fill not found, TOC may not be initialized yet",
      );
    }
    if (tocProgressText) {
      tocProgressText.textContent = t("Прочитано: {done} из {total}", {
        done: completedCount,
        total: this.pageQuestions.length,
      });
    }
    if (tocProgressPercent) {
      tocProgressPercent.textContent = `${percentage}%`;
    }

    // Update old progress widget if it exists (for backwards compatibility)
    const progressFill = document.querySelector(".overall-progress-fill");
    const progressText = document.querySelector(".overall-progress-text");

    if (progressFill) {
      progressFill.style.width = `${percentage}%`;
    }

    if (progressText) {
      progressText.textContent = `${percentage}% (${completedCount}/${this.pageQuestions.length})`;
    }
  }

  /**
   * Update all progress bars with their saved state
   */
  updateAllProgressBars() {
    this.pageQuestions.forEach((questionId) => {
      const isCompleted = this.isQuestionCompleted(questionId);
      const progressBar = document.querySelector(
        `[data-question-id="${questionId}"]`,
      );

      if (progressBar) {
        this.updateProgressBarState(progressBar, isCompleted);
      } else {
      }
    });
  }

  /**
   * Update the UI with current progress
   */
  updateUI() {
    // Update all question visual states
    this.pageQuestions.forEach((questionId) => {
      // getElementById accepts any valid HTML id (e.g. starting with digit); querySelector('#4k-...') would throw
      const elementWithId = document.getElementById(questionId);
      if (elementWithId) {
        const questionElement = elementWithId.closest("li.question");
        if (questionElement) {
          this.updateQuestionVisualState(
            questionElement,
            this.isQuestionCompleted(questionId),
          );
        }
      } else {
      }
    });

    // Update overall progress
    this.updateOverallProgress();

    // Update all progress bars
    this.updateAllProgressBars();

    // Update toggle button state if it exists
    const markAllToggleBtn = document.getElementById("mark-all-toggle-btn");

    if (markAllToggleBtn) {
      const completedCount = this.pageQuestions.filter((id) =>
        this.isQuestionCompleted(id),
      ).length;
      const isAllCompleted = completedCount === this.pageQuestions.length;

      if (isAllCompleted) {
        markAllToggleBtn.className = "progress-control-btn mark-all-unread";
        markAllToggleBtn.textContent = t("Снять отметки");
        markAllToggleBtn.classList.add("mark-all-unread");
        markAllToggleBtn.classList.remove("mark-all-read");
      } else {
        markAllToggleBtn.className = "progress-control-btn mark-all-read";
        markAllToggleBtn.textContent = t("Пометить все");
        markAllToggleBtn.classList.add("mark-all-read");
        markAllToggleBtn.classList.remove("mark-all-unread");
      }
    } else {
    }
  }
}

// Global question progress tracker instance
window.questionProgressTracker = new QuestionProgressTracker();

// Export for use in modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = QuestionProgressTracker;
}
