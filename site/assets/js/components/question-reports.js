(function () {
  "use strict";

  // Перевод интерфейса (ядро — сниппет theme-boot). В тестах под Node его нет:
  // остаётся русский текст с подставленными значениями.
  const t =
    window.t ||
    ((text, params) =>
      text.replace(/\{(\w+)\}/g, (match, key) => params?.[key] ?? match));

  if (window.__questionReportsInitialized) return;
  window.__questionReportsInitialized = true;

  let activeQuestion = null;
  let initTimer = null;

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getQuestionId(questionEl) {
    const nameEl = questionEl.querySelector(".name");
    return questionEl.dataset.mdId || nameEl?.id || questionEl.id || "";
  }

  function getQuestionTitle(questionEl) {
    const nameEl = questionEl.querySelector(".name");
    return (nameEl?.innerText || nameEl?.textContent || "Вопрос")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getQuestionUrl(questionEl, questionId) {
    try {
      const url = new URL(window.location.href);
      url.hash = questionId || getQuestionId(questionEl);
      return url.toString();
    } catch (_) {
      return window.location.href;
    }
  }

  function getCurrentCode(questionEl) {
    const textarea = questionEl.querySelector(".exc-textarea");
    return textarea ? textarea.value : "";
  }

  function ensureModal() {
    let modal = document.getElementById("question-report-modal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "question-report-modal";
    modal.className = "question-report-modal";
    modal.innerHTML = `
      <div class="question-report-dialog" role="dialog" aria-modal="true" aria-labelledby="question-report-title">
        <div class="question-report-header">
          <div>
            <h3 id="question-report-title">${t("Найдена опечатка?")}</h3>
          </div>
          <button type="button" class="question-report-close" aria-label="${t("Закрыть")}">×</button>
        </div>
        <label class="question-report-label" for="question-report-text">
          ${t("Опиши проблему подробнее.")}
        </label>
        <textarea id="question-report-text" class="question-report-text" rows="6" placeholder="${t("Например: тест падает с 500, формулировка непонятная, опечатка, неверный ожидаемый ответ...")}"></textarea>
        <div class="question-report-status" aria-live="polite"></div>
        <div class="question-report-actions">
          <button type="button" class="question-report-cancel">${t("Отмена")}</button>
          <button type="button" class="question-report-submit">${t("Отправить")}</button>
        </div>
      </div>
    `;

    modal
      .querySelector(".question-report-close")
      .addEventListener("click", closeModal);
    modal
      .querySelector(".question-report-cancel")
      .addEventListener("click", closeModal);
    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeModal();
    });
    modal
      .querySelector(".question-report-submit")
      .addEventListener("click", submitReport);

    document.body.appendChild(modal);
    return modal;
  }

  function openModal(questionEl) {
    activeQuestion = questionEl;
    const modal = ensureModal();
    modal.querySelector("#question-report-text").value = "";
    modal.querySelector(".question-report-status").textContent = "";
    modal.classList.add("is-open");
    setTimeout(() => modal.querySelector("#question-report-text")?.focus(), 30);
  }

  function closeModal() {
    const modal = document.getElementById("question-report-modal");
    if (modal) modal.classList.remove("is-open");
    activeQuestion = null;
  }

  function getDb() {
    try {
      return typeof firebase !== "undefined" ? firebase.database() : null;
    } catch (_) {
      return null;
    }
  }

  function getUser() {
    try {
      return typeof firebase !== "undefined"
        ? firebase.auth().currentUser
        : null;
    } catch (_) {
      return null;
    }
  }

  async function getUserProfile(db, uid) {
    try {
      const snapshot = await db.ref(`users/${uid}`).once("value");
      return snapshot.val() || {};
    } catch (_) {
      return {};
    }
  }

  async function submitReport() {
    if (!activeQuestion) return;

    const modal = ensureModal();
    const statusEl = modal.querySelector(".question-report-status");
    const submitBtn = modal.querySelector(".question-report-submit");
    const message = modal.querySelector("#question-report-text").value.trim();

    if (message.length < 5) {
      statusEl.textContent = t("Опиши проблему чуть подробнее.");
      statusEl.className = "question-report-status is-error";
      return;
    }

    const user = getUser();
    const db = getDb();
    if (!user || !db) {
      statusEl.textContent = t(
        "Нужно войти в аккаунт, чтобы отправить сообщение.",
      );
      statusEl.className = "question-report-status is-error";
      return;
    }

    submitBtn.disabled = true;
    statusEl.textContent = t("Отправляем...");
    statusEl.className = "question-report-status";

    try {
      const questionId = getQuestionId(activeQuestion);
      const profile = await getUserProfile(db, user.uid);
      await db.ref("questionReports").push({
        questionId,
        questionTitle: getQuestionTitle(activeQuestion).slice(0, 500),
        pagePath: window.location.pathname,
        pageUrl: window.location.href,
        questionUrl: getQuestionUrl(activeQuestion, questionId),
        message: message.slice(0, 4000),
        code: getCurrentCode(activeQuestion).slice(0, 12000),
        userId: user.uid,
        userEmail: profile.email || user.email || null,
        userName:
          profile.displayName ||
          profile.nickname ||
          profile.username ||
          user.displayName ||
          null,
        status: "new",
        createdAt: Date.now(),
      });

      statusEl.textContent = t("Спасибо, сообщение отправлено.");
      statusEl.className = "question-report-status is-ok";
      setTimeout(closeModal, 900);
    } catch (error) {
      console.error("Failed to submit question report:", error);
      statusEl.textContent = t(
        "Не удалось отправить. Попробуй обновить страницу или напиши ментору напрямую.",
      );
      statusEl.className = "question-report-status is-error";
    } finally {
      submitBtn.disabled = false;
    }
  }

  function addReportButton(questionEl) {
    if (!questionEl) return;
    let section = questionEl.querySelector(".question-report-section");
    let button = questionEl.querySelector(".question-report-btn");
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "question-report-btn";
      button.textContent = t("В тексте ошибка?");
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        openModal(questionEl);
      });
    }
    if (!section) {
      section = document.createElement("div");
      section.className = "question-report-section";
    }
    if (button.parentElement !== section) {
      section.appendChild(button);
    }

    const progress = questionEl.querySelector(".question-difficulty-container");
    if (progress) {
      if (section.parentElement !== progress) {
        progress.appendChild(section);
      }
    } else {
      if (section.parentElement !== questionEl) {
        questionEl.appendChild(section);
      }
    }
  }

  function initAll() {
    document.querySelectorAll("li.question").forEach(addReportButton);
  }

  function scheduleInit() {
    if (initTimer) return;
    initTimer = setTimeout(() => {
      initTimer = null;
      initAll();
    }, 150);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAll);
  } else {
    initAll();
  }

  document.addEventListener("lazyQuestionsReady", scheduleInit);
  new MutationObserver(scheduleInit).observe(document.body, {
    childList: true,
    subtree: true,
  });
})();
