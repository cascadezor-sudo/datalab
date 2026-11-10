// RAG Chat Component
// Integrates with RAG backend API for question answering

/**
 * Сутки платформы: YYYY-MM-DD в Europe/Moscow — то же правило, что у сервера
 * (`functions/day-key.js`) и у остальных браузерных модулей (daily-reports.js,
 * gamification.js, activity-grid.js, course-roadmap.js).
 *
 * Раньше счётчик запросов к ассистенту считал день по локальному времени
 * браузера. Пока лимит вёл сам браузер, это было незаметно; теперь его ведёт
 * сервер по московским суткам, и для ученика во Владивостоке это буквально
 * разные узлы: показанный остаток относился бы к одному дню, а списание — к
 * другому.
 *
 * Определение продублировано с защитой на уже существующее значение по той же
 * причине, что и в соседних файлах: это обычные <script>, а не модули, и
 * `const` на верхнем уровне второго такого файла уронил бы его целиком на
 * переобъявлении. rag-chat.js вдобавок подгружается динамически
 * (init-page.js, question-ai-help.js) на страницах, где gamification.js может
 * и не быть, поэтому полагаться на чужой helper нельзя. Один общий файл
 * потребовал бы нового <script> на каждой из 200+ страниц — отдельная задача.
 */
window.platformDayKey =
  window.platformDayKey ||
  (function () {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Moscow",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return function platformDayKey(value) {
      const parts = {};
      const source = new Date(value === undefined ? Date.now() : value);
      for (const part of formatter.formatToParts(source)) {
        parts[part.type] = part.value;
      }
      return `${parts.year}-${parts.month}-${parts.day}`;
    };
  })();

(function () {
  "use strict";

  // Перевод интерфейса (ядро — сниппет theme-boot). В тестах под Node его нет:
  // остаётся русский текст с подставленными значениями. Промпты и текст,
  // уходящие в RAG API, не переводятся — ассистент пока отвечает по-русски.
  const t =
    window.t ||
    ((text, params) =>
      text.replace(/\{(\w+)\}/g, (match, key) => params?.[key] ?? match));

  if (window.__ragChatInitialized) return;
  window.__ragChatInitialized = true;

  const pendingApiActions = [];

  function enqueueApiAction(action) {
    pendingApiActions.push(action);
  }

  window.ragChat = window.ragChat || {
    isReady: false,
    open: () => enqueueApiAction({ type: "open" }),
    ask: (text) => enqueueApiAction({ type: "ask", text }),
    prefill: (text) => enqueueApiAction({ type: "prefill", text }),
    askWithContext: (context) =>
      enqueueApiAction({ type: "askWithContext", context }),
  };

  const RAG_STREAM_API_URL = window.DATALAB_RAG_API_URL || "";
  // Значение только для показа, пока не прочитан узел счётчика. Настоящий
  // лимит держит сервер (functions/rag-quota.js, RAG_DAILY_LIMIT) — он же
  // возвращает своё число в ответе, и браузеру верить в этой цифре нечему.
  const STUDENT_DAILY_LIMIT = 10;

  let activeStreamRequest = null;
  let streamMessageSequence = 0;

  // ── Session ID (groups messages from one browser session) ───────
  let SESSION_ID =
    Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

  // ── Firebase history persistence ────────────────────────────────
  // Path: users/{uid}/rag_chat/sessions/{SESSION_ID}/
  //   meta/  — { createdAt, title }   (created on first user message)
  //   messages/{pushId} — { role, text, timestamp, sources? }
  // Silently skips if Firebase is unavailable or user is not logged in.

  let sessionCreated = false;

  // ── Conversation memory (what the model actually sees) ──────────
  // The Firebase history above is an archive the UI reads back; this buffer is
  // what travels with the next request. Without it a follow-up like «ответь на
  // эти вопросы» reaches the backend as a standalone question with nothing to
  // refer to, and retrieval matches whatever the phrase itself resembles.
  const MAX_HISTORY_TURNS = 6;
  const MAX_HISTORY_TURN_CHARS = 2000;
  let conversationHistory = [];
  // Card buttons carry the page context; a typed follow-up has none of its own,
  // so the last context seen stays attached for the rest of the chat.
  let lastQuestionContext = null;
  let lastLearnerProgress = null;

  function rememberTurn(role, text) {
    const value = String(text || "").trim();
    if (!value) return;
    conversationHistory.push({
      role,
      text: value.slice(0, MAX_HISTORY_TURN_CHARS),
    });
    if (conversationHistory.length > MAX_HISTORY_TURNS) {
      conversationHistory = conversationHistory.slice(-MAX_HISTORY_TURNS);
    }
  }

  function resetConversationMemory() {
    conversationHistory = [];
    lastQuestionContext = null;
    lastLearnerProgress = null;
  }

  let limitState = {
    loaded: false,
    applies: false,
    limit: STUDENT_DAILY_LIMIT,
    used: 0,
    remaining: STUDENT_DAILY_LIMIT,
    dateKey: "",
  };

  const getTodayKey = () => window.platformDayKey();

  async function ensureFirebaseReady() {
    if (
      !window.firebase ||
      !window.firebase.auth ||
      !window.firebase.database
    ) {
      return false;
    }
    if (window.firebase.apps && window.firebase.apps.length) return true;
    try {
      if (!window.configLoader?.loadFirebaseConfig) return false;
      const firebaseConfig = await window.configLoader.loadFirebaseConfig();
      if (!window.firebase.apps.length) {
        window.firebase.initializeApp(firebaseConfig);
      }
      return true;
    } catch (error) {
      console.warn("RAG chat: Firebase is not ready yet", error);
      return false;
    }
  }

  function getCurrentUser() {
    try {
      if (
        !window.firebase ||
        !window.firebase.auth ||
        !window.firebase.apps?.length
      )
        return null;
      return window.firebase.auth().currentUser;
    } catch (_) {
      return null;
    }
  }

  /**
   * Заголовки запроса к RAG-сервису.
   *
   * Firebase ID token — то, чем сервис узнаёт ученика: раньше эндпоинт был
   * открыт вообще без токена, и по его адресу мог ходить кто угодно, тратя
   * платные вызовы модели. По uid из проверенного токена сервис и списывает
   * дневную квоту через `consumeRagQuota`.
   *
   * Без токена запрос всё равно уходит: пока сервис не начал его требовать,
   * гость и незалогиненная вкладка должны работать как раньше. Отказывать
   * здесь — задача сервиса, а не браузера.
   */
  async function ragRequestHeaders() {
    const headers = { "Content-Type": "application/json" };
    try {
      const user = getCurrentUser();
      const token = user ? await user.getIdToken() : "";
      if (token) headers.Authorization = `Bearer ${token}`;
    } catch (error) {
      console.warn("RAG chat: не удалось получить токен доступа", error);
    }
    return headers;
  }

  async function getCurrentUserRole(user) {
    try {
      if (!user || !(await ensureFirebaseReady())) return null;
      const snapshot = await window.firebase
        .database()
        .ref(`users/${user.uid}/role`)
        .once("value");
      return snapshot.val() || null;
    } catch (_) {
      return null;
    }
  }

  function updateLimitUi() {
    const elements = document.querySelectorAll(".ml-chat-limit");
    elements.forEach((element) => {
      if (!limitState.applies) {
        element.hidden = true;
        element.textContent = "";
        return;
      }

      element.hidden = false;
      element.textContent = t("Лимит: {remaining}/{limit} запросов сегодня", {
        remaining: limitState.remaining,
        limit: limitState.limit,
      });
      element.classList.toggle("is-empty", limitState.remaining <= 0);
    });

    const disabled = limitState.applies && limitState.remaining <= 0;
    document
      .querySelectorAll("#ml-chat-send,#ml-chat-fullscreen-send")
      .forEach((button) => {
        button.disabled = disabled;
        button.setAttribute("aria-disabled", disabled ? "true" : "false");
      });
  }

  async function loadDailyLimit() {
    await ensureFirebaseReady();
    const user = getCurrentUser();
    const role = await getCurrentUserRole(user);
    const applies = role === "student";

    limitState.applies = applies;
    limitState.loaded = true;
    limitState.limit = STUDENT_DAILY_LIMIT;
    limitState.dateKey = getTodayKey();

    if (!applies || !user || !window.firebase?.database) {
      updateLimitUi();
      return limitState;
    }

    try {
      const snapshot = await window.firebase
        .database()
        .ref(`users/${user.uid}/rag_chat_usage/${limitState.dateKey}/count`)
        .once("value");
      limitState.used = Number(snapshot.val() || 0);
    } catch (_) {
      limitState.used = 0;
    }

    limitState.remaining = Math.max(0, limitState.limit - limitState.used);
    updateLimitUi();
    return limitState;
  }

  async function ensureDailyLimitLoaded() {
    if (limitState.loaded && limitState.dateKey === getTodayKey()) {
      return limitState;
    }
    return loadDailyLimit();
  }

  /**
   * Проверка остатка перед отправкой — и только проверка.
   *
   * Списывает квоту сервер RAG (HTTP-ручка `consumeRagQuota`) перед тем, как
   * потратить токены модели. Браузер не пишет счётчик вовсе: пока он это
   * делал, лимит был декоративным — и транзакцию, и саму проверку видно из
   * консоли, а запрос к RAG уходил напрямую, мимо любой записи в базу.
   *
   * Отказ здесь — вежливость интерфейса, а не защита: он экономит ученику
   * поездку до сервера и объясняет, почему кнопка отключена. Настоящий отказ
   * приходит от RAG-сервиса, который на исчерпанной квоте в модель не идёт.
   */
  async function checkDailyLimit() {
    await ensureDailyLimitLoaded();
    if (!limitState.applies) return { ok: true };

    const user = getCurrentUser();
    if (!user) {
      return {
        ok: false,
        message: t(
          "Нужно войти в аккаунт, чтобы отправлять запросы ассистенту.",
        ),
      };
    }

    if (limitState.remaining <= 0) {
      return {
        ok: false,
        message: t(
          "Дневной лимит ассистента закончился: {limit} запросов. Попробуй завтра.",
          { limit: limitState.limit },
        ),
      };
    }
    return { ok: true };
  }

  /**
   * Отражаем в интерфейсе то, что сервер уже списал.
   *
   * Перечитывать узел после каждого сообщения — лишнее чтение оплачиваемой
   * базы ради одной цифры, поэтому счётчик подкручивается локально. Значение
   * из базы возвращается при следующей загрузке страницы; если списания не
   * было (сервис RAG ещё не включён), показанный остаток окажется меньше
   * фактического — пессимистично, а не наоборот.
   */
  function noteRequestSpent() {
    if (!limitState.applies) return;
    limitState.used += 1;
    limitState.remaining = Math.max(0, limitState.limit - limitState.used);
    updateLimitUi();
  }

  function saveMessageToHistory(role, text, extra) {
    try {
      if (
        !window.firebase ||
        !window.firebase.auth ||
        !window.firebase.database ||
        !window.firebase.apps?.length
      )
        return;
      const user = window.firebase.auth().currentUser;
      if (!user) return;

      const db = window.firebase.database();
      const sessionRef = db.ref(
        `users/${user.uid}/rag_chat/sessions/${SESSION_ID}`,
      );

      // Create session meta on first user message
      if (role === "user" && !sessionCreated) {
        sessionCreated = true;
        sessionRef
          .child("meta")
          .set({
            createdAt: Date.now(),
            title: String(text).slice(0, 60),
          })
          .catch(() => {});
      }

      const entry = {
        role,
        text: String(text || "").slice(0, 4000),
        timestamp: Date.now(),
      };
      if (extra && extra.sources && extra.sources.length) {
        entry.sources = uniqueSources(extra.sources)
          .slice(0, 3)
          .map((s) => ({
            url: s.url || "",
            title: s.question_title || "",
          }));
      }

      sessionRef
        .child("messages")
        .push(entry)
        .catch(() => {});
    } catch (_) {}
  }

  // ── SVG icon constants ──────────────────────────────────────────
  const ICON_CHAT = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/></svg>`;

  const ICON_CLOSE = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;

  const ICON_MAXIMIZE = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>`;

  const ICON_MINIMIZE = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14h6v6"/><path d="M20 10h-6V4"/><path d="M14 10l7-7"/><path d="M3 21l7-7"/></svg>`;

  const ICON_SEND = `<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>`;

  const ICON_BOT = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>`;

  const ICON_BOT_HEADER = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/></svg>`;

  const ICON_TRASH = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>`;

  const ICON_VPN_WARNING = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>`;

  // ── Chat button ─────────────────────────────────────────────────
  function createChatButton() {
    const chatButton = document.createElement("div");
    chatButton.id = "ml-chat-button";
    chatButton.innerHTML = ICON_CHAT;
    chatButton.setAttribute("aria-label", t("Открыть чат-ассистент"));
    chatButton.setAttribute("role", "button");
    chatButton.setAttribute("tabindex", "0");
    document.body.appendChild(chatButton);
    return chatButton;
  }

  // ── Chat window ─────────────────────────────────────────────────
  function createChatWindow() {
    const chatWindow = document.createElement("div");
    chatWindow.id = "ml-chat-window";
    chatWindow.innerHTML = `
      <div id="ml-chat-header">
        <div class="ml-chat-header-left">
          <div class="ml-chat-header-avatar">${ICON_BOT_HEADER}</div>
          <div class="ml-chat-header-info">
            <div class="ml-chat-header-title">${t("ML Ассистент")}</div>
            <div class="ml-chat-header-status">
              <span class="ml-status-dot"></span>${t("Онлайн")}
            </div>
          </div>
        </div>
        <div id="ml-chat-header-buttons">
          <button id="ml-chat-fullscreen" aria-label="${t("Открыть в полноэкранном режиме")}" title="${t("Полноэкранный режим")}">${ICON_MAXIMIZE}</button>
          <button id="ml-chat-close" aria-label="${t("Закрыть чат")}">${ICON_CLOSE}</button>
        </div>
      </div>
      <div id="ml-chat-messages"></div>
      <div id="ml-chat-input">
        <div class="ml-chat-limit" hidden></div>
        <div class="ml-input-wrapper">
          <input
            id="ml-chat-text"
            type="text"
            placeholder="${t("Задай вопрос по ML...")}"
            aria-label="${t("Введите вопрос")}"
            autocomplete="off"
          />
          <button id="ml-chat-send" aria-label="${t("Отправить сообщение")}">${ICON_SEND}</button>
        </div>
      </div>
    `;
    document.body.appendChild(chatWindow);
    return chatWindow;
  }

  // ── Fullscreen modal ────────────────────────────────────────────
  function createFullscreenModal() {
    const modal = document.createElement("div");
    modal.id = "ml-chat-fullscreen-modal";
    modal.innerHTML = `
      <div id="ml-chat-fullscreen-container">
        <div id="ml-chat-fullscreen-header">
          <div class="ml-chat-header-left">
            <div class="ml-chat-header-avatar">${ICON_BOT_HEADER}</div>
            <div class="ml-chat-header-info">
              <div class="ml-chat-header-title">${t("ML Ассистент")}</div>
              <div class="ml-chat-header-status">
                <span class="ml-status-dot"></span>${t("Онлайн")}
              </div>
            </div>
          </div>
          <div id="ml-chat-fullscreen-header-buttons">
            <button id="ml-chat-exit-fullscreen" aria-label="${t("Выйти из полноэкранного режима")}" title="${t("Свернуть")}">${ICON_MINIMIZE}</button>
            <button id="ml-chat-fullscreen-close" aria-label="${t("Закрыть чат")}">${ICON_CLOSE}</button>
          </div>
        </div>
        <div id="ml-chat-fullscreen-body">
          <div id="ml-chat-history-sidebar">
            <div class="ml-history-sidebar-head">
              <span>${t("История")}</span>
              <button id="ml-chat-new-session" title="${t("Новый чат")}" aria-label="${t("Новый чат")}">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                ${t("Новый")}
              </button>
            </div>
            <div id="ml-chat-history-list"></div>
          </div>
          <div id="ml-chat-fullscreen-main">
            <div id="ml-history-banner">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              ${t("Просмотр прошлого чата")}
              <button id="ml-history-back-btn">← ${t("Текущий чат")}</button>
            </div>
            <div id="ml-chat-fullscreen-messages"></div>
            <div id="ml-chat-fullscreen-input">
              <div class="ml-chat-limit" hidden></div>
              <div class="ml-input-wrapper">
                <input
                  id="ml-chat-fullscreen-text"
                  type="text"
                  placeholder="${t("Задай вопрос по ML...")}"
                  aria-label="${t("Введите вопрос")}"
                  autocomplete="off"
                />
                <button id="ml-chat-fullscreen-send" aria-label="${t("Отправить сообщение")}">${ICON_SEND}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
  }

  // ── Bot message row (with avatar) ───────────────────────────────
  function createBotRow(extraClass) {
    const row = document.createElement("div");
    row.className = "msg-row";

    const avatar = document.createElement("div");
    avatar.className = "msg-avatar-icon";
    avatar.innerHTML = ICON_BOT;

    const bubble = document.createElement("div");
    bubble.className = extraClass ? `msg bot ${extraClass}` : "msg bot";

    row.appendChild(avatar);
    row.appendChild(bubble);
    return { row, bubble };
  }

  // ── Prompt suggestions ──────────────────────────────────────────
  const PROMPT_SUGGESTIONS = [
    "Что такое градиентный спуск?",
    "Как работает механизм внимания в трансформерах?",
    "Чем отличается L1 от L2 регуляризации?",
    "Какие метрики используют для оценки классификатора?",
    "Объясни разницу между Bias и Variance",
  ];

  function addSuggestions(messagesContainer, inputEl) {
    const wrapper = document.createElement("div");
    wrapper.className = "ml-chat-suggestions";

    PROMPT_SUGGESTIONS.forEach((text) => {
      const chip = document.createElement("button");
      chip.className = "ml-chat-suggestion-chip";
      chip.textContent = text;
      chip.type = "button";
      chip.addEventListener("click", () => {
        wrapper.remove();
        inputEl.value = text;
        inputEl.focus();
        inputEl.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
        );
      });
      wrapper.appendChild(chip);
    });

    messagesContainer.appendChild(wrapper);
  }

  // ── Welcome message ─────────────────────────────────────────────
  const VPN_NOTICE_TEXT = t(
    "Из России ассистент работает только с включённым VPN — без него ответы приходить не будут.",
  );

  function addWelcomeMessage(messagesContainer) {
    const { row, bubble } = createBotRow("welcome");
    bubble.innerHTML = `<p>${t(
      "Привет! Я ассистент платформы — сориентирую по материалу, дам ссылки на источники и отвечу на твои вопросы!",
    )}</p>`;
    messagesContainer.appendChild(row);

    const note = document.createElement("div");
    note.className = "ml-chat-vpn-note";
    note.innerHTML = `${ICON_VPN_WARNING}<span></span>`;
    note.querySelector("span").textContent = VPN_NOTICE_TEXT;
    messagesContainer.appendChild(note);
  }

  // ── KaTeX render helper (with retry if scripts not yet loaded) ──
  const KATEX_DELIMITERS = [
    { left: "$$", right: "$$", display: true },
    { left: "$", right: "$", display: false },
    { left: "\\(", right: "\\)", display: false },
    { left: "\\[", right: "\\]", display: true },
  ];

  function renderMath(element) {
    if (typeof renderMathInElement === "function") {
      try {
        renderMathInElement(element, {
          delimiters: KATEX_DELIMITERS,
          throwOnError: false,
        });
      } catch (err) {
        console.warn("KaTeX render error:", err);
      }
    } else {
      // KaTeX scripts still loading (they use `defer`); retry shortly
      setTimeout(() => renderMath(element), 400);
    }
  }

  function buildContextPrompt(context) {
    const safeContext = context || {};
    const parts = [
      safeContext.userPrompt ||
        "Объясни материал простыми словами. Дай интуицию, ключевые определения и короткий пример, если он уместен.",
    ];

    if (safeContext.selectedText) {
      parts.push(
        "Выделенный фрагмент:\n" + String(safeContext.selectedText).trim(),
      );
    }

    if (safeContext.questionTitle) {
      parts.push(
        "Название вопроса:\n" + String(safeContext.questionTitle).trim(),
      );
    }

    if (safeContext.questionText) {
      parts.push(
        "Контекст вопроса:\n" +
          String(safeContext.questionText).trim().slice(0, 6000),
      );
    }

    if (safeContext.pageUrl) {
      parts.push("Страница:\n" + String(safeContext.pageUrl).trim());
    }

    return parts.filter(Boolean).join("\n\n");
  }

  function buildContextDisplayText(context) {
    const safeContext = context || {};
    const actionLabels = {
      simplify: t("Объяснить проще"),
      example: t("Дать пример"),
      check: t("Проверить понимание"),
      related: t("Соседние темы"),
    };
    const action = actionLabels[safeContext.mode] || t("Объяснить");
    if (safeContext.selectedText) {
      return `${action}: «${String(safeContext.selectedText)
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 180)}»`;
    }
    if (safeContext.questionTitle) {
      return `${action}: ${String(safeContext.questionTitle)
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 180)}`;
    }
    return action;
  }

  // ── Format answer text ──────────────────────────────────────────
  function normalizeBareLatex(value) {
    const protectedMath = [];
    const placeholder = (match) => {
      const index = protectedMath.push(match) - 1;
      return `\uE000${index}\uE001`;
    };

    // Keep already-delimited formulas intact, then repair the common model
    // mistake of placing individual TeX commands or indexed variables in prose.
    let normalized = String(value).replace(
      /\$\$[\s\S]+?\$\$|\$(?!\$)[^$\n]+?\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\]/g,
      placeholder,
    );

    normalized = normalized.replace(
      /\b[A-Za-z](?:_(?:\\[a-zA-Z]+|\{[^{}\s]*\}|[A-Za-z0-9]+)|\^(?:\{[^{}\s]*\}|[A-Za-z0-9]+))+|\\(?:[a-zA-Z]+(?:\{[^{}\n]*\})?(?:_(?:\{[^{}\n]*\}|[A-Za-z0-9]+)|\^(?:\{[^{}\n]*\}|[A-Za-z0-9]+))*|[{}](?:_(?:\{[^{}\n]*\}|[A-Za-z0-9]+)|\^(?:\{[^{}\n]*\}|[A-Za-z0-9]+))*)/g,
      (match) => `$${match}$`,
    );

    return normalized.replace(/\uE000(\d+)\uE001/g, (_, index) => {
      return protectedMath[Number(index)] || "";
    });
  }

  function formatAnswer(text) {
    if (!text) return "";

    const lines = String(text).replace(/\r\n?/g, "\n").split("\n");
    const parts = [];
    let paragraph = [];
    let bullets = [];
    let formulaLines = null;

    const inline = (value) =>
      escapeHtml(normalizeBareLatex(value))
        .replace(/`([^`\n]+)`/g, "<code>$1</code>")
        .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");

    function flushParagraph() {
      if (paragraph.length) {
        parts.push(`<p>${inline(paragraph.join(" "))}</p>`);
        paragraph = [];
      }
    }

    function flushBullets() {
      if (bullets.length) {
        parts.push(
          `<ul>${bullets.map((item) => `<li>${inline(item)}</li>`).join("")}</ul>`,
        );
        bullets = [];
      }
    }

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (formulaLines !== null) {
        formulaLines.push(rawLine);
        if (line.endsWith("$$") && formulaLines.length > 1) {
          const latex = formulaLines
            .join("\n")
            .replace(/^\s*\$\$/, "")
            .replace(/\$\$\s*$/, "")
            .trim();
          parts.push(`<div class="msg-formula">$$${escapeHtml(latex)}$$</div>`);
          formulaLines = null;
        }
        continue;
      }

      if (!line) {
        flushParagraph();
        flushBullets();
        continue;
      }

      const singleFormula = line.match(/^\$\$([\s\S]+)\$\$$/);
      if (singleFormula) {
        flushParagraph();
        flushBullets();
        parts.push(
          `<div class="msg-formula">$$${escapeHtml(singleFormula[1].trim())}$$</div>`,
        );
        continue;
      }

      if (line.startsWith("$$")) {
        flushParagraph();
        flushBullets();
        formulaLines = [rawLine];
        continue;
      }

      const bracketFormula = line.match(/^\\\[([\s\S]+)\\\]$/);
      if (bracketFormula) {
        flushParagraph();
        flushBullets();
        parts.push(
          `<div class="msg-formula">$$${escapeHtml(bracketFormula[1].trim())}$$</div>`,
        );
        continue;
      }

      if (/^#{2,3}\s+/.test(line)) {
        flushParagraph();
        flushBullets();
        parts.push(
          `<div class="msg-section-header">${inline(line.replace(/^#{2,3}\s+/, ""))}</div>`,
        );
        continue;
      }

      if (/^[-•]\s+/.test(line)) {
        flushParagraph();
        bullets.push(line.replace(/^[-•]\s+/, ""));
        continue;
      }

      const numMatch = line.match(/^(\d+)[).]\s+([\s\S]+)/);
      if (numMatch) {
        flushParagraph();
        flushBullets();
        parts.push(
          `<div class="msg-example">` +
            `<span class="msg-example-num">${numMatch[1]}</span>` +
            `<span>${inline(numMatch[2])}</span>` +
            `</div>`,
        );
        continue;
      }

      const explMatch = line.match(/^Объяснение:\s*([\s\S]+)/);
      if (explMatch) {
        flushParagraph();
        flushBullets();
        parts.push(
          `<div class="msg-explanation">` +
            `<span class="msg-explanation-label">${t("Объяснение")}</span>` +
            inline(explMatch[1]) +
            `</div>`,
        );
        continue;
      }

      flushBullets();
      paragraph.push(line);
    }

    if (formulaLines !== null) paragraph.push(formulaLines.join("\n"));
    flushParagraph();
    flushBullets();

    return parts.join("");
  }

  // ── Streaming markdown ──────────────────────────────────────────
  // Tokens arrive mid-word, mid-`$…$` and mid-`**`, so the accumulated text is
  // split into a stable prefix of finished blocks and the tail being written.
  // The prefix renders once and is never touched again; only the tail is
  // reformatted on every paint.

  // Nothing here may treat a delimiter differently from formatAnswer(), or the
  // streamed and the final render would disagree. Display math therefore only
  // opens at the start of a line, exactly as formatAnswer() reads it — so a
  // price like "$$5" is prose, not an unterminated formula.
  const MARKER_ONLY_LINE = /^\s*(?:#{1,3}|[-•*]|\d+[).]|\*{1,2}|`{1,3})\s*$/;
  // Safety valve: a genuinely unbalanced "$$" never closes, and without a cap
  // it would pin the boundary and hide the whole rest of the answer.
  const MAX_TAIL_CHARS = 1200;

  // Walks lines the way formatAnswer() does, reporting where each display
  // formula opens and which blank lines sit outside one.
  function scanStreamedLines(source, onBlank, onOpenFormula) {
    const lines = source.split("\n");
    let offset = 0;
    let openedAt = -1;
    let formulaLines = 0;

    for (let i = 0; i < lines.length; i += 1) {
      const rawLine = lines[i];
      const line = rawLine.trim();
      const start = offset;
      offset += rawLine.length + 1;

      if (openedAt !== -1) {
        formulaLines += 1;
        if (line.endsWith("$$") && formulaLines > 1) openedAt = -1;
        continue;
      }
      if (!line) {
        // The empty slot a trailing "\n" leaves behind is the line the model is
        // still writing, not a blank line — committing there would cut a list
        // into one <ul> per item.
        if (i < lines.length - 1) onBlank(offset);
        continue;
      }
      if (/^\$\$[\s\S]+\$\$$/.test(line)) continue;
      if (line.startsWith("$$")) {
        openedAt = start + rawLine.indexOf("$$");
        formulaLines = 1;
      }
    }
    if (openedAt !== -1) onOpenFormula(openedAt);
  }

  // A block is safe to freeze once a blank line follows it and no formula is
  // still open, because formatAnswer() flushes paragraphs and lists on blanks.
  function splitStreamedMarkdown(text) {
    const source = String(text || "").replace(/\r\n?/g, "\n");
    let boundary = 0;
    let openFormula = -1;

    scanStreamedLines(
      source,
      (end) => {
        boundary = end;
      },
      (at) => {
        openFormula = at;
      },
    );

    // The formula being written must stay in the tail, blank lines and all.
    if (openFormula !== -1 && boundary > openFormula) {
      boundary = source.lastIndexOf("\n\n", Math.max(openFormula - 1, 0));
      boundary = boundary === -1 ? 0 : boundary + 2;
    }
    if (source.length - boundary > MAX_TAIL_CHARS) {
      const plain = source.lastIndexOf("\n\n");
      if (plain !== -1 && plain + 2 > boundary) boundary = plain + 2;
    }

    return { stable: source.slice(0, boundary), tail: source.slice(boundary) };
  }

  // Markup the model has not finished yet. A half-written formula is cut off
  // rather than shown as raw LaTeX; bold and code are closed virtually so they
  // style as they arrive instead of flashing their asterisks first.
  function guardStreamedTail(text) {
    let out = String(text || "").replace(/\r\n?/g, "\n");

    let openFormula = -1;
    scanStreamedLines(
      out,
      () => {},
      (at) => {
        openFormula = at;
      },
    );
    if (openFormula !== -1) out = out.slice(0, openFormula);

    const openInline = unclosedInlineMath(out);
    if (openInline !== -1) out = out.slice(0, openInline);

    // A line that is still only its own marker would render as a stray "##".
    const lines = out.split("\n");
    if (MARKER_ONLY_LINE.test(lines[lines.length - 1])) lines.pop();
    out = lines.join("\n");

    // Counted across the whole block, not just the last line: formatAnswer()
    // joins a paragraph's lines with a space before applying the inline rules,
    // so bold and code legitimately span line breaks.
    if ((out.match(/`/g) || []).length % 2 === 1) out += "`";
    if ((out.match(/\*\*/g) || []).length % 2 === 1) out += "**";
    return out;
  }

  // Index of a lone "$" with no closing partner, or -1. Escaped "\$" is a
  // literal dollar and the "$$" of display math is not an inline delimiter.
  function unclosedInlineMath(text) {
    const opens = [];
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      if (char === "\\") {
        i += 1;
        continue;
      }
      if (char !== "$") continue;
      if (text[i + 1] === "$") {
        i += 1;
        continue;
      }
      opens.push(i);
    }
    return opens.length % 2 === 1 ? opens[opens.length - 1] : -1;
  }

  // ── HTML-escape helper ──────────────────────────────────────────
  // Escapes & < > so content is safe for innerHTML.
  // $ is intentionally NOT escaped — KaTeX auto-render needs raw $ to find inline math.
  function escapeHtml(str) {
    return (str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // ── Render structured blocks from the API ──────────────────────
  // Called when the backend returns data.blocks (structured output).
  // Falls back to formatAnswer() when blocks are absent.
  function renderBlocks(container, blocks) {
    for (const block of blocks) {
      switch (block.type) {
        case "text": {
          const p = document.createElement("p");
          p.innerHTML = escapeHtml(block.content);
          container.appendChild(p);
          break;
        }

        case "section": {
          const div = document.createElement("div");
          div.className = "msg-section-header";
          div.textContent = block.title || "";
          container.appendChild(div);
          break;
        }

        case "bullets": {
          const ul = document.createElement("ul");
          for (const item of block.items || []) {
            const li = document.createElement("li");
            li.innerHTML = escapeHtml(item);
            ul.appendChild(li);
          }
          container.appendChild(ul);
          break;
        }

        case "formula": {
          // Use textContent (not innerHTML) so < > in LaTeX are literal text,
          // not HTML tags. KaTeX auto-render finds $$...$$ or $...$ in text nodes.
          const div = document.createElement("div");
          div.className = "msg-formula";
          const delim = block.display ? "$$" : "$";
          div.textContent = delim + (block.latex || "") + delim;
          container.appendChild(div);
          break;
        }

        case "explanation": {
          const div = document.createElement("div");
          div.className = "msg-explanation";
          const label = document.createElement("span");
          label.className = "msg-explanation-label";
          label.textContent = t("Объяснение");
          const text = document.createElement("span");
          text.innerHTML = escapeHtml(block.content);
          div.appendChild(label);
          div.appendChild(text);
          container.appendChild(div);
          break;
        }

        case "example": {
          const div = document.createElement("div");
          div.className = "msg-example";
          const num = document.createElement("span");
          num.className = "msg-example-num";
          num.textContent = String(block.number ?? "");
          const text = document.createElement("span");
          text.innerHTML = escapeHtml(block.content);
          div.appendChild(num);
          div.appendChild(text);
          container.appendChild(div);
          break;
        }
      }
    }
  }

  // ── Check no-info answer ────────────────────────────────────────
  function isNoInformationAnswer(text) {
    if (!text) return true;
    const lowerText = text.toLowerCase();
    const noInfoPatterns = [
      "информация отсутствует",
      "информации нет",
      "не найдено",
      "не найдена",
      "отсутствует",
      "не удалось найти",
      "информация не найдена",
      "в предоставленных источниках",
      "в источниках отсутствует",
      "в источниках нет",
      // Ответ по-английски: сообщение об отсутствии контекста.
      "contain no information",
      "no information on this question",
      "not found in the provided",
    ];
    return noInfoPatterns.some((pattern) => lowerText.includes(pattern));
  }

  // ── Add sources ─────────────────────────────────────────────────
  function addSources(messageElement, sources) {
    const normalizedSources = uniqueSources(sources);

    if (normalizedSources.length === 0) return;

    const sourcesContainer = document.createElement("div");
    sourcesContainer.className = "msg-sources";
    sourcesContainer.innerHTML = `<span class="msg-sources-label">${t("Источники")}</span>`;

    normalizedSources.slice(0, 3).forEach((source) => {
      const sourceLink = document.createElement("a");
      sourceLink.href = source.url;
      sourceLink.target = "_blank";
      sourceLink.rel = "noopener noreferrer";
      sourceLink.className = "source-link";
      sourceLink.textContent = source.question_title || t("Источник");
      sourceLink.title = source.text
        ? source.text.substring(0, 100) + "..."
        : "";
      sourcesContainer.appendChild(sourceLink);
    });

    messageElement.appendChild(sourcesContainer);
  }

  function uniqueSources(sources) {
    if (!Array.isArray(sources)) return [];
    const seen = new Set();
    return sources.filter((source) => {
      if (!source?.url) return false;
      const key = source.question_id || source.url;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function normalizeFeedbackSources(sources) {
    return uniqueSources(sources)
      .slice(0, 5)
      .map((source) => ({
        url: source.url || "",
        title: source.question_title || source.title || "",
        // Тот же id, по которому вопрос известен пайплайну индекса: по нему
        // жалоба превращается в кейс smoke_queries без ручного сопоставления.
        questionId: source.question_id || "",
      }));
  }

  // Причина у 👎 — единственное, что отличает «промахнулся поиск» от «материала
  // нет» и от «ответ верный, но непонятный». Лечатся они в разных местах.
  const FEEDBACK_REASONS = [
    { id: "off_topic", label: t("Не по теме") },
    { id: "wrong", label: t("Ошибка в ответе") },
    { id: "too_hard", label: t("Слишком сложно") },
    { id: "not_in_materials", label: t("Нет в материалах") },
  ];

  function buildFeedbackEntry(feedbackPayload, rating) {
    return {
      rating,
      mode: String(feedbackPayload.mode || "chat"),
      sessionId: SESSION_ID,
      messageId: String(feedbackPayload.messageId || ""),
      questionId: String(feedbackPayload.questionId || ""),
      question: String(feedbackPayload.question || "").slice(0, 4000),
      displayQuestion: String(feedbackPayload.displayQuestion || "").slice(
        0,
        500,
      ),
      answer: String(feedbackPayload.answer || "").slice(0, 8000),
      sources: normalizeFeedbackSources(feedbackPayload.sources),
      // Чем на самом деле искали и какой сборкой корпуса отвечали.
      retrievalQuery: String(feedbackPayload.retrievalQuery || "").slice(
        0,
        500,
      ),
      buildId: String(feedbackPayload.buildId || ""),
      noInformation: Boolean(feedbackPayload.noInformation),
      followUp: Boolean(feedbackPayload.followUp),
      pageUrl: window.location.href,
      createdAt: Date.now(),
    };
  }

  function createFeedbackControls(feedbackPayload) {
    const block = document.createElement("div");
    block.className = "msg-feedback-block";

    const wrapper = document.createElement("div");
    wrapper.className = "msg-feedback";
    wrapper.setAttribute("aria-label", t("Оценить ответ ассистента"));

    const label = document.createElement("span");
    label.className = "msg-feedback-label";
    label.textContent = t("Ответ помог?");
    wrapper.appendChild(label);

    const status = document.createElement("span");
    status.className = "msg-feedback-status";

    const reasons = document.createElement("div");
    reasons.className = "msg-feedback-reasons";
    reasons.hidden = true;

    // Одна запись на ответ: push() заводит её при первом клике, дальше оценка
    // переписывается. Иначе передумавший ученик оставлял бы в базе несколько
    // записей об одном ответе, и любой подсчёт считал бы их разными оценками.
    let feedbackRef = null;
    const ratingButtons = [];
    const reasonButtons = [];

    const setDisabled = (buttons, disabled) => {
      buttons.forEach((item) => {
        item.disabled = disabled;
      });
    };

    const saveFeedback = async (rating, button) => {
      try {
        const user = getCurrentUser();
        if (!user || !window.firebase?.database) {
          status.textContent = t("Войдите в аккаунт");
          return;
        }

        setDisabled(ratingButtons, true);
        status.textContent = t("Сохраняем...");

        if (feedbackRef) {
          const patch = { rating, updatedAt: Date.now() };
          // Причина принадлежит прошлой оценке: рядом с 👍 она станет враньём.
          // Ключ добавляется условно — undefined в update() роняет RTDB SDK.
          if (rating !== "bad") patch.reason = null;
          await feedbackRef.update(patch);
        } else {
          const entryRef = window.firebase
            .database()
            .ref(`users/${user.uid}/rag_feedback`)
            .push();
          await entryRef.set(buildFeedbackEntry(feedbackPayload, rating));
          feedbackRef = entryRef;
        }

        ratingButtons.forEach((item) => {
          item.classList.toggle("is-selected", item === button);
        });
        setDisabled(ratingButtons, false);
        reasons.hidden = rating !== "bad";
        status.textContent = rating === "bad" ? t("Что не так?") : t("Спасибо");
      } catch (error) {
        console.warn("Failed to save RAG feedback:", error);
        setDisabled(ratingButtons, false);
        status.textContent = t("Не удалось сохранить");
      }
    };

    const saveReason = async (reason, button) => {
      if (!feedbackRef) return;
      try {
        setDisabled(reasonButtons, true);
        await feedbackRef.update({ reason, updatedAt: Date.now() });
        reasonButtons.forEach((item) => {
          item.classList.toggle("is-selected", item === button);
        });
        setDisabled(reasonButtons, false);
        status.textContent = t("Спасибо");
      } catch (error) {
        console.warn("Failed to save RAG feedback reason:", error);
        setDisabled(reasonButtons, false);
        status.textContent = t("Не удалось сохранить");
      }
    };

    [
      { rating: "good", label: "👍", title: t("Хороший ответ") },
      { rating: "bad", label: "👎", title: t("Плохой ответ") },
    ].forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "msg-feedback-btn";
      button.textContent = item.label;
      button.title = item.title;
      button.setAttribute("aria-label", item.title);
      button.addEventListener("click", () => saveFeedback(item.rating, button));
      ratingButtons.push(button);
      wrapper.appendChild(button);
    });

    wrapper.appendChild(status);

    FEEDBACK_REASONS.forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "msg-feedback-reason";
      button.textContent = item.label;
      button.addEventListener("click", () => saveReason(item.id, button));
      reasonButtons.push(button);
      reasons.appendChild(button);
    });

    block.appendChild(wrapper);
    block.appendChild(reasons);
    return block;
  }

  function getStreamBubbles(messageId) {
    return Array.from(
      document.querySelectorAll(
        `.msg-row[data-rag-message-id="${messageId}"] .msg.bot`,
      ),
    );
  }

  function cancelActiveStream() {
    if (!activeStreamRequest) return;
    const { id, controller } = activeStreamRequest;
    controller.abort();
    getStreamBubbles(id).forEach((bubble) => {
      bubble.classList.remove("is-streaming", "loading");
      bubble.querySelector(".ml-stream-cursor")?.remove();
      delete bubble.dataset.streamStable;
      if (!bubble.textContent.trim()) bubble.textContent = t("Ответ отменён.");
    });
    activeStreamRequest = null;
  }

  // KaTeX is loaded with `defer`, and renderMath() retries itself on a timer
  // until it appears. That is right for a one-off final render but not for a
  // per-frame call, which would leave a retry chain behind on every paint.
  function renderMathIfReady(element) {
    if (typeof renderMathInElement !== "function") return;
    renderMath(element);
  }

  // Blocks are appended straight into the bubble rather than into wrappers:
  // `.msg p:last-child` and `.msg-section-header:first-child` match on the DOM
  // tree, so a wrapper (even display:contents) would silently change them.
  function appendStreamedHtml(bubble, html, isTail) {
    if (!html) return [];
    const holder = document.createElement("template");
    holder.innerHTML = html;
    const added = Array.from(holder.content.children);
    added.forEach((node) => {
      if (isTail) node.dataset.streamTail = "1";
    });
    added.forEach((node) => bubble.appendChild(node));
    return added;
  }

  function renderStreamingMessage(messageId, text, isStreaming) {
    const { stable: stableText, tail: tailText } = splitStreamedMarkdown(text);

    getStreamBubbles(messageId).forEach((bubble) => {
      bubble.classList.remove("loading");
      bubble.classList.toggle("is-streaming", isStreaming);

      if (bubble.dataset.streamStable === undefined) {
        bubble.replaceChildren();
        bubble.dataset.streamStable = "0";
      }
      bubble
        .querySelectorAll(":scope > [data-stream-tail]")
        .forEach((node) => node.remove());
      // Explicit: with an empty tail the caret would otherwise sit inside a
      // stable node, which is never removed, and pile up one per frame.
      bubble.querySelectorAll(".ml-stream-cursor").forEach((c) => c.remove());

      // Finished blocks keep their DOM nodes: text selection survives the
      // repaint and KaTeX never re-typesets what it has already done.
      const alreadyRendered = Number(bubble.dataset.streamStable);
      if (stableText.length > alreadyRendered) {
        appendStreamedHtml(
          bubble,
          formatAnswer(stableText.slice(alreadyRendered)),
          false,
        ).forEach(renderMathIfReady);
        bubble.dataset.streamStable = String(stableText.length);
      }

      const tailNodes = appendStreamedHtml(
        bubble,
        formatAnswer(guardStreamedTail(tailText)),
        true,
      );
      tailNodes.forEach(renderMathIfReady);

      if (isStreaming) {
        const cursor = document.createElement("span");
        cursor.className = "ml-stream-cursor";
        cursor.setAttribute("aria-hidden", "true");
        // Inside the last tail block so the caret trails the text instead of
        // dropping to a line of its own.
        (tailNodes[tailNodes.length - 1] || bubble).appendChild(cursor);
      }
    });
  }

  function finalizeStreamingMessage(
    messageId,
    answer,
    sources,
    requestContext,
  ) {
    getStreamBubbles(messageId).forEach((bubble) => {
      bubble.classList.remove("is-streaming");
      // One canonical pass over the server's full answer, so anything the
      // incremental renderer approximated is corrected here.
      delete bubble.dataset.streamStable;
      bubble.innerHTML = formatAnswer(answer);

      if (!isNoInformationAnswer(answer)) addSources(bubble, sources);
      if (requestContext?.mode === "related") {
        addRelatedTopics(bubble, requestContext.neighbors || []);
      }
      bubble.appendChild(
        createFeedbackControls({
          question: requestContext?.question || "",
          displayQuestion: requestContext?.displayText || "",
          mode: requestContext?.mode || "chat",
          messageId,
          questionId: requestContext?.questionId || "",
          retrievalQuery: requestContext?.retrievalQuery || "",
          buildId: requestContext?.buildId || "",
          noInformation: isNoInformationAnswer(answer),
          followUp: Boolean(requestContext?.followUp),
          answer,
          sources,
        }),
      );
      renderMath(bubble);
    });
  }

  function addRelatedTopics(messageElement, neighbors) {
    if (!Array.isArray(neighbors) || neighbors.length === 0) return;
    const wrapper = document.createElement("div");
    wrapper.className = "msg-related-topics";
    const label = document.createElement("span");
    label.className = "msg-sources-label";
    label.textContent = t("Соседние темы");
    wrapper.appendChild(label);

    neighbors.forEach((topic) => {
      if (!topic?.url || !topic?.title) return;
      const link = document.createElement("a");
      link.href = topic.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.className = "source-link";
      link.textContent = `${topic.completed ? "✓ " : ""}${topic.title}`;
      wrapper.appendChild(link);
    });
    if (wrapper.childElementCount > 1) messageElement.appendChild(wrapper);
  }

  function parseSseFrames(buffer) {
    const frames = buffer.split("\n\n");
    const remainder = frames.pop() || "";
    const events = frames.flatMap((frame) => {
      const event = frame.match(/^event:\s*(.+)$/m)?.[1]?.trim();
      const data = frame.match(/^data:\s*(.+)$/m)?.[1];
      if (!event || !data) return [];
      try {
        return [{ event, payload: JSON.parse(data) }];
      } catch (_) {
        return [];
      }
    });
    return { events, remainder };
  }

  async function readStream(response, onEvent) {
    if (!response.body) throw new Error("Потоковый ответ недоступен");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const parsed = parseSseFrames(buffer);
      buffer = parsed.remainder;
      for (const event of parsed.events) {
        await onEvent(event);
      }
      if (done) break;
    }
  }

  // ── Send message ────────────────────────────────────────────────
  async function sendMessage(userText, messagesContainer, requestOptions) {
    if (!userText.trim()) return;
    if (!RAG_STREAM_API_URL) {
      const { row, bubble } = createBotRow("error");
      bubble.textContent = t("AI-помощник пока недоступен. Учебные материалы доступны локально.");
      messagesContainer.appendChild(row);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      return;
    }
    const options = requestOptions || {};
    const displayText = String(options.displayText || userText).trim();

    const limitCheck = await checkDailyLimit();
    if (!limitCheck.ok) {
      const { row: limitRow, bubble: limitBubble } = createBotRow("error");
      limitBubble.textContent = limitCheck.message;
      messagesContainer.appendChild(limitRow);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      return;
    }

    // User message
    const userMsg = document.createElement("div");
    userMsg.className = "msg user";
    userMsg.textContent = displayText;
    messagesContainer.appendChild(userMsg);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Save user message to history
    saveMessageToHistory("user", displayText);

    // Snapshot of the completed turns: the current question travels separately,
    // and it joins the memory only once its answer arrives — an aborted or
    // failed request must not leave a question nobody answered behind.
    const history = conversationHistory.slice(-MAX_HISTORY_TURNS);

    if (options.context) lastQuestionContext = options.context;
    if (options.learnerProgress) lastLearnerProgress = options.learnerProgress;
    const questionContext = options.context || lastQuestionContext;
    const learnerProgress = options.learnerProgress || lastLearnerProgress;

    cancelActiveStream();

    const messageId = `rag-${Date.now()}-${++streamMessageSequence}`;
    const { row: botRow, bubble: botMsg } = createBotRow("loading");
    botRow.dataset.ragMessageId = messageId;
    botMsg.innerHTML =
      '<div class="loading-dots"><span></span><span></span><span></span></div>';
    messagesContainer.appendChild(botRow);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    const controller = new AbortController();
    activeStreamRequest = { id: messageId, controller };
    let answerText = "";
    let sources = [];
    let renderFrame = null;
    let deltasSincePaint = 0;

    const requestContext = {
      question: userText,
      displayText,
      mode: options.mode || "chat",
      neighbors: options.neighbors || [],
      questionId: questionContext?.question_id || "",
      followUp: history.length > 0,
      // Заполняется из события metadata: чем сервер на самом деле искал.
      retrievalQuery: "",
      buildId: "",
    };

    const scheduleStreamRender = () => {
      if (renderFrame !== null) return;
      renderFrame = requestAnimationFrame(() => {
        renderFrame = null;
        if (activeStreamRequest?.id !== messageId) return;
        renderStreamingMessage(messageId, answerText, true);
      });
    };

    // A proxy may coalesce several SSE frames into one ReadableStream chunk.
    // Yielding periodically lets the browser paint intermediate tokens anyway.
    const paintStreamingMessage = () =>
      new Promise((resolve) => {
        if (renderFrame !== null) {
          cancelAnimationFrame(renderFrame);
          renderFrame = null;
        }
        let painted = false;
        const paint = () => {
          if (painted) return;
          painted = true;
          clearTimeout(fallback);
          if (activeStreamRequest?.id === messageId) {
            renderStreamingMessage(messageId, answerText, true);
          }
          resolve();
        };
        // The read loop awaits this, and requestAnimationFrame never fires in a
        // background tab — without the timer the whole stream would stall until
        // the learner switched back to it.
        const fallback = setTimeout(paint, 250);
        requestAnimationFrame(paint);
      });

    try {
      const response = await fetch(RAG_STREAM_API_URL, {
        method: "POST",
        headers: await ragRequestHeaders(),
        body: JSON.stringify({
          question: userText,
          mode: options.mode || "chat",
          question_context: questionContext || null,
          learner_progress: learnerProgress || null,
          history,
          // Язык ответа ассистента — язык интерфейса.
          language: window.i18n?.lang === "en" ? "en" : "ru",
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Запрос принят — значит квота на сервере уже списана.
      noteRequestSpent();

      await readStream(response, async ({ event, payload }) => {
        if (activeStreamRequest?.id !== messageId) return;
        if (event === "metadata") {
          sources = uniqueSources(payload.sources);
          requestContext.retrievalQuery = payload.retrieval_query || "";
          requestContext.buildId = payload.build_id || "";
          return;
        }
        if (event === "delta") {
          answerText += payload.text || "";
          deltasSincePaint += 1;
          if (deltasSincePaint >= 8) {
            deltasSincePaint = 0;
            await paintStreamingMessage();
          } else {
            scheduleStreamRender();
          }
          return;
        }
        if (event === "done") {
          answerText = payload.answer || answerText;
          sources = uniqueSources(payload.sources || sources);
          return;
        }
        if (event === "error") {
          throw new Error(payload.message || "Ошибка потокового ответа");
        }
      });

      if (activeStreamRequest?.id !== messageId) return;
      if (renderFrame !== null) cancelAnimationFrame(renderFrame);
      const finalAnswer =
        answerText || t("Извините, не удалось получить ответ ассистента.");
      finalizeStreamingMessage(messageId, finalAnswer, sources, requestContext);
      saveMessageToHistory("bot", finalAnswer, { sources });
      rememberTurn("user", displayText);
      rememberTurn("assistant", finalAnswer);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    } catch (error) {
      if (error?.name === "AbortError") return;
      console.error("Error sending message to RAG API:", error);
      getStreamBubbles(messageId).forEach((bubble) => {
        bubble.className = "msg bot error";
        bubble.textContent = t(
          "Не удалось получить ответ AI-помощника. Попробуйте позже.",
        );
      });
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    } finally {
      if (activeStreamRequest?.id === messageId) activeStreamRequest = null;
    }
  }

  // ── Copy messages between containers ───────────────────────────
  function copyMessages(fromContainer, toContainer) {
    // innerHTML already contains rendered KaTeX spans — no need to re-render
    toContainer.innerHTML = fromContainer.innerHTML;
    toContainer.scrollTop = toContainer.scrollHeight;
  }

  // ── Initialize ──────────────────────────────────────────────────
  function initializeChat() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initializeChat);
      return;
    }

    const chatButton = createChatButton();
    const chatWindow = createChatWindow();
    const fullscreenModal = createFullscreenModal();

    const messagesContainer = document.getElementById("ml-chat-messages");
    const fullscreenMessagesContainer = document.getElementById(
      "ml-chat-fullscreen-messages",
    );
    const input = document.getElementById("ml-chat-text");
    const fullscreenInput = document.getElementById("ml-chat-fullscreen-text");
    const sendButton = document.getElementById("ml-chat-send");
    const fullscreenSendButton = document.getElementById(
      "ml-chat-fullscreen-send",
    );
    const closeButton = document.getElementById("ml-chat-close");
    const fullscreenCloseButton = document.getElementById(
      "ml-chat-fullscreen-close",
    );
    const fullscreenButton = document.getElementById("ml-chat-fullscreen");
    const exitFullscreenButton = document.getElementById(
      "ml-chat-exit-fullscreen",
    );

    ensureFirebaseReady().then((ready) => {
      if (!ready) {
        loadDailyLimit();
        return;
      }
      window.firebase.auth().onAuthStateChanged(() => {
        limitState.loaded = false;
        loadDailyLimit();
      });
    });

    addWelcomeMessage(messagesContainer);
    addSuggestions(messagesContainer, input);
    addWelcomeMessage(fullscreenMessagesContainer);
    addSuggestions(fullscreenMessagesContainer, fullscreenInput);

    // ── History panel state ─────────────────────────────────────
    let viewingSessionId = null;

    async function loadHistoryPanel() {
      const listEl = document.getElementById("ml-chat-history-list");
      if (!listEl) return;
      try {
        if (!(await ensureFirebaseReady())) {
          listEl.innerHTML = `<div class="ml-history-empty">${t("Нет доступа к истории")}</div>`;
          return;
        }
        const user = window.firebase.auth().currentUser;
        if (!user) {
          listEl.innerHTML = `<div class="ml-history-empty">${t("Войдите для просмотра истории")}</div>`;
          return;
        }
        listEl.innerHTML = `<div class="ml-history-loading">${t("Загрузка…")}</div>`;
        window.firebase
          .database()
          .ref(`users/${user.uid}/rag_chat/sessions`)
          .orderByChild("meta/createdAt")
          .once(
            "value",
            (snapshot) => {
              const sessions = [];
              snapshot.forEach((child) => {
                const data = child.val();
                if (data && data.meta)
                  sessions.push({ id: child.key, ...data.meta });
              });
              sessions.reverse(); // newest first
              renderHistoryList(sessions, listEl, user.uid);
            },
            () => {
              listEl.innerHTML = `<div class="ml-history-empty">${t("Не удалось загрузить")}</div>`;
            },
          );
      } catch (_) {
        listEl.innerHTML = `<div class="ml-history-empty">${t("Ошибка загрузки")}</div>`;
      }
    }

    function renderHistoryList(sessions, listEl, uid) {
      listEl.innerHTML = "";
      if (!sessions.length) {
        listEl.innerHTML = `<div class="ml-history-empty">${t("История пуста")}</div>`;
        return;
      }
      sessions.forEach((session) => {
        const item = document.createElement("div");
        item.className =
          "ml-history-item" + (session.id === SESSION_ID ? " active" : "");
        item.dataset.sessionId = session.id;

        const titleBtn = document.createElement("button");
        titleBtn.className = "ml-history-item-title";
        titleBtn.textContent = session.title || t("Чат");
        titleBtn.title = session.title || "";
        titleBtn.addEventListener("click", () =>
          loadSessionMessages(session.id),
        );

        const delBtn = document.createElement("button");
        delBtn.className = "ml-history-item-delete";
        delBtn.innerHTML = ICON_TRASH;
        delBtn.setAttribute("aria-label", t("Удалить"));
        delBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          deleteSession(session.id, uid, item);
        });

        item.appendChild(titleBtn);
        item.appendChild(delBtn);
        listEl.appendChild(item);
      });
    }

    async function loadSessionMessages(sessionId) {
      document.querySelectorAll(".ml-history-item").forEach((el) => {
        el.classList.toggle("active", el.dataset.sessionId === sessionId);
      });

      if (sessionId === SESSION_ID) {
        viewingSessionId = null;
        updateHistoryBanner(false);
        copyMessages(messagesContainer, fullscreenMessagesContainer);
        return;
      }

      viewingSessionId = sessionId;
      updateHistoryBanner(true);

      try {
        if (!(await ensureFirebaseReady())) return;
        const user = window.firebase.auth().currentUser;
        if (!user) return;

        fullscreenMessagesContainer.innerHTML =
          '<div class="ml-history-loading-msgs"><div class="loading-dots"><span></span><span></span><span></span></div></div>';

        window.firebase
          .database()
          .ref(`users/${user.uid}/rag_chat/sessions/${sessionId}/messages`)
          .orderByChild("timestamp")
          .once(
            "value",
            (snapshot) => {
              fullscreenMessagesContainer.innerHTML = "";
              let hasMessages = false;
              snapshot.forEach((child) => {
                hasMessages = true;
                const msg = child.val();
                if (msg.role === "user") {
                  const el = document.createElement("div");
                  el.className = "msg user";
                  el.textContent = msg.text;
                  fullscreenMessagesContainer.appendChild(el);
                } else if (msg.role === "bot") {
                  const { row, bubble } = createBotRow();
                  bubble.innerHTML = formatAnswer(msg.text || "");
                  if (msg.sources && msg.sources.length) {
                    const wrap = document.createElement("div");
                    wrap.className = "msg-sources";
                    wrap.innerHTML = `<span class="msg-sources-label">${t("Источники")}</span>`;
                    uniqueSources(msg.sources).forEach((s) => {
                      if (!s.url) return;
                      const a = document.createElement("a");
                      a.href = s.url;
                      a.target = "_blank";
                      a.rel = "noopener noreferrer";
                      a.className = "source-link";
                      a.textContent = s.title || t("Источник");
                      wrap.appendChild(a);
                    });
                    bubble.appendChild(wrap);
                  }
                  fullscreenMessagesContainer.appendChild(row);
                  renderMath(bubble);
                }
              });
              if (!hasMessages) {
                fullscreenMessagesContainer.innerHTML = `<div class="ml-history-empty">${t("Сообщений нет")}</div>`;
              }
              fullscreenMessagesContainer.scrollTop =
                fullscreenMessagesContainer.scrollHeight;
            },
            () => {
              fullscreenMessagesContainer.innerHTML = `<div class="ml-history-empty">${t("Не удалось загрузить")}</div>`;
            },
          );
      } catch (_) {}
    }

    function updateHistoryBanner(show) {
      const banner = document.getElementById("ml-history-banner");
      if (banner) banner.style.display = show ? "flex" : "none";
    }

    async function deleteSession(sessionId, uid, itemEl) {
      if (!(await ensureFirebaseReady())) return;
      itemEl.classList.add("deleting");
      window.firebase
        .database()
        .ref(`users/${uid}/rag_chat/sessions/${sessionId}`)
        .remove()
        .then(() => {
          itemEl.remove();
          if (viewingSessionId === sessionId) {
            viewingSessionId = null;
            updateHistoryBanner(false);
            copyMessages(messagesContainer, fullscreenMessagesContainer);
            document.querySelectorAll(".ml-history-item").forEach((el) => {
              el.classList.toggle(
                "active",
                el.dataset.sessionId === SESSION_ID,
              );
            });
          }
          const listEl = document.getElementById("ml-chat-history-list");
          if (listEl && !listEl.querySelector(".ml-history-item")) {
            listEl.innerHTML = `<div class="ml-history-empty">${t("История пуста")}</div>`;
          }
        })
        .catch(() => itemEl.classList.remove("deleting"));
    }

    function toggleChat() {
      chatWindow.classList.toggle("open");
      if (chatWindow.classList.contains("open")) {
        input.focus();
      }
    }

    function openChat() {
      if (!chatWindow.classList.contains("open")) {
        chatWindow.classList.add("open");
      }
      input.focus();
    }

    function askText(text) {
      const value = String(text || "").trim();
      if (!value) return;
      openChat();
      input.value = "";
      sendMessage(value, messagesContainer);
    }

    function prefillText(text) {
      openChat();
      input.value = String(text || "");
      input.focus();
    }

    function askContext(context) {
      const value = buildContextPrompt(context);
      if (!value.trim()) return;
      openChat();
      input.value = "";
      sendMessage(value, messagesContainer, {
        displayText: buildContextDisplayText(context),
        mode: context?.mode || "simplify",
        context: {
          question_id: context?.questionId || null,
          question_title: context?.questionTitle || null,
          question_text: context?.questionText || null,
          selected_text: context?.selectedText || null,
          page_url: context?.pageUrl || null,
          neighbors: (context?.neighbors || []).map((topic) => ({
            question_id: topic.questionId || "",
            title: topic.title || "",
            url: topic.url || "",
            completed: Boolean(topic.completed),
          })),
        },
        learnerProgress: {
          current_question_completed: Boolean(
            context?.learnerProgress?.currentQuestionCompleted,
          ),
          completed_on_page: Number(
            context?.learnerProgress?.completedOnPage || 0,
          ),
          total_on_page: Number(context?.learnerProgress?.totalOnPage || 0),
        },
        neighbors: context?.neighbors || [],
      });
    }

    window.ragChat = {
      isReady: true,
      open: openChat,
      ask: askText,
      prefill: prefillText,
      askWithContext: askContext,
    };

    while (pendingApiActions.length) {
      const action = pendingApiActions.shift();
      if (!action) continue;
      if (action.type === "open") openChat();
      if (action.type === "ask") askText(action.text);
      if (action.type === "prefill") prefillText(action.text);
      if (action.type === "askWithContext") askContext(action.context);
    }

    function enterFullscreen() {
      viewingSessionId = null;
      updateHistoryBanner(false);
      copyMessages(messagesContainer, fullscreenMessagesContainer);
      loadHistoryPanel();
      chatWindow.classList.add("transitioning-to-fullscreen");
      fullscreenModal.classList.add("entering");

      setTimeout(() => {
        chatWindow.classList.remove("open", "transitioning-to-fullscreen");
        fullscreenModal.classList.add("open", "entered");
        fullscreenModal.classList.remove("entering");
        fullscreenInput.focus();
      }, 300);
    }

    function exitFullscreen() {
      if (!viewingSessionId) {
        // Only sync back when on current session — not when viewing history
        copyMessages(fullscreenMessagesContainer, messagesContainer);
      }
      viewingSessionId = null;
      fullscreenModal.classList.add("exiting");
      fullscreenModal.classList.remove("entered");

      setTimeout(() => {
        fullscreenModal.classList.remove("open", "exiting");
        chatWindow.classList.add("open");
        input.focus();
      }, 300);
    }

    chatButton.addEventListener("click", toggleChat);
    chatButton.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleChat();
      }
    });

    closeButton.addEventListener("click", () => {
      chatWindow.classList.remove("open");
    });

    fullscreenButton.addEventListener("click", (e) => {
      e.stopPropagation();
      enterFullscreen();
    });

    exitFullscreenButton.addEventListener("click", (e) => {
      e.stopPropagation();
      exitFullscreen();
    });

    fullscreenCloseButton.addEventListener("click", () => {
      if (!viewingSessionId) {
        copyMessages(fullscreenMessagesContainer, messagesContainer);
      }
      viewingSessionId = null;
      fullscreenModal.classList.remove("open", "entered", "exiting");
    });

    document
      .getElementById("ml-history-back-btn")
      .addEventListener("click", () => {
        viewingSessionId = null;
        updateHistoryBanner(false);
        copyMessages(messagesContainer, fullscreenMessagesContainer);
        document.querySelectorAll(".ml-history-item").forEach((el) => {
          el.classList.toggle("active", el.dataset.sessionId === SESSION_ID);
        });
      });

    document
      .getElementById("ml-chat-new-session")
      .addEventListener("click", () => {
        SESSION_ID =
          Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
        sessionCreated = false;
        resetConversationMemory();
        viewingSessionId = null;
        updateHistoryBanner(false);
        // Clear both containers and show fresh welcome
        messagesContainer.innerHTML = "";
        fullscreenMessagesContainer.innerHTML = "";
        addWelcomeMessage(messagesContainer);
        addSuggestions(messagesContainer, input);
        addWelcomeMessage(fullscreenMessagesContainer);
        addSuggestions(fullscreenMessagesContainer, fullscreenInput);
        document
          .querySelectorAll(".ml-history-item")
          .forEach((el) => el.classList.remove("active"));
        fullscreenInput.focus();
      });

    fullscreenModal.addEventListener("click", (e) => {
      if (e.target === fullscreenModal) {
        exitFullscreen();
      }
    });

    function handleSend() {
      const userText = input.value.trim();
      if (!userText) return;
      input.value = "";
      sendMessage(userText, messagesContainer);
    }

    function handleFullscreenSend() {
      const userText = fullscreenInput.value.trim();
      if (!userText) return;

      // If viewing a past session, switch back to current first
      if (viewingSessionId) {
        viewingSessionId = null;
        updateHistoryBanner(false);
        copyMessages(messagesContainer, fullscreenMessagesContainer);
        document.querySelectorAll(".ml-history-item").forEach((el) => {
          el.classList.toggle("active", el.dataset.sessionId === SESSION_ID);
        });
      }

      fullscreenInput.value = "";
      sendMessage(userText, fullscreenMessagesContainer);
    }

    sendButton.addEventListener("click", handleSend);
    fullscreenSendButton.addEventListener("click", handleFullscreenSend);

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    fullscreenInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleFullscreenSend();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (fullscreenModal.classList.contains("open")) {
          exitFullscreen();
        } else if (chatWindow.classList.contains("open")) {
          chatWindow.classList.remove("open");
        }
      }
    });
  }

  initializeChat();
})();
