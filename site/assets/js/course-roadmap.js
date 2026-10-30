/**
 * Сутки платформы: YYYY-MM-DD в Europe/Moscow — то же правило, что у сервера
 * (`functions/day-key.js`). Раньше день считали по-разному: сервер по UTC,
 * браузер по локальному времени, — и три часа в сутки они расходились.
 *
 * Определение продублировано в каждом файле, который считает день, и защищено
 * проверкой на уже существующее значение. Причина в подключении: это обычные
 * <script>, а не модули, и `const` на верхнем уровне второго такого файла
 * уронил бы его целиком на переобъявлении. Один общий файл потребовал бы
 * нового <script> на каждой из 200+ страниц — это отдельная задача.
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
  const ROADMAP_URL = "/assets/data/course-roadmap.json";
  const DEMO_KEY = "course-roadmap-demo-state";
  const { escapeHtml, toAbsoluteSiteUrl } = window.TaskDetails;
  /* Ученик, выбранный на одной странице, остаётся выбранным на доске
     (kanban-board.js): components/staff-student-selection.js. */
  const {
    selectedStudentFromUrl,
    readSelectedStudent,
    rememberSelectedStudent,
  } = window.StaffStudentSelection;

  const state = {
    auth: null,
    db: null,
    currentUser: null,
    currentRole: "student",
    firebaseReady: false,
    demoMode: true,
    settingsLoaded: false,
    roadmap: null,
    students: [],
    allStudents: [],
    studentSearchQuery: "",
    myStudentsOnly: true,
    selectedStudentId: "",
    selectedStudentName: "",
    pendingStudentId: selectedStudentFromUrl(),
    previewMilestoneId: "",
    /* Карта «страница → ключи materialAccess» и доступы выбранного ученика:
       постановка этапа открывает страницы из его списка материалов. */
    pathMap: null,
    materialAccess: null,
    progress: {},
    tasksByMilestone: {},
    listeners: [],
  };

  const fallbackStudents = [{ uid: "", displayName: "" }];

  const $ = (selector) => document.querySelector(selector);

  function userCanManage() {
    return true;
  }

  function canFilterOwnStudents() {
    return state.currentRole !== "student";
  }

  function updateRoleVisibility() {
    document.body.classList.toggle("can-manage", userCanManage());
    document.body.classList.toggle("settings-loading", !state.settingsLoaded);
  }

  function enforceStudentScope() {
    if (state.currentUser && (!state.selectedStudentId || state.currentRole === "student")) {
      state.selectedStudentId = state.currentUser.uid;
    }
  }

  function formatInlineMarkup(value) {
    return escapeHtml(value)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");
  }

  function renderHighlight(highlight) {
    if (!highlight || !highlight.text) return "";
    const kicker = highlight.kicker
      ? `<span class="milestone-highlight-kicker">${escapeHtml(highlight.kicker)}</span>`
      : "";
    const title = highlight.title
      ? `<strong class="milestone-highlight-title">${escapeHtml(highlight.title)}</strong>`
      : "";
    return `
        <div class="milestone-highlight">
          ${kicker}
          ${title}
          <p>${formatInlineMarkup(highlight.text)}</p>
        </div>
      `;
  }

  function isMockMilestone(milestone) {
    return milestone?.eventType === "mock";
  }

  function normalizeSearchBase(value) {
    return String(value ?? "")
      .trim()
      .toLocaleLowerCase("ru-RU")
      .replace(/ё/g, "е")
      .replace(/[@._-]+/g, " ")
      .replace(/[^\p{L}\p{N}\s]+/gu, " ")
      .replace(/\s+/g, " ");
  }

  function transliterateRuToLat(value) {
    const map = {
      а: "a",
      б: "b",
      в: "v",
      г: "g",
      д: "d",
      е: "e",
      ё: "e",
      ж: "zh",
      з: "z",
      и: "i",
      й: "i",
      к: "k",
      л: "l",
      м: "m",
      н: "n",
      о: "o",
      п: "p",
      р: "r",
      с: "s",
      т: "t",
      у: "u",
      ф: "f",
      х: "kh",
      ц: "ts",
      ч: "ch",
      ш: "sh",
      щ: "shch",
      ы: "y",
      э: "e",
      ю: "yu",
      я: "ya",
      ь: "",
      ъ: "",
    };
    return normalizeSearchBase(value).replace(
      /[а-яё]/g,
      (char) => map[char] ?? char,
    );
  }

  function normalizeLatin(value) {
    return normalizeSearchBase(value)
      .replace(/x/g, "ks")
      .replace(/ph/g, "f")
      .replace(/w/g, "v")
      .replace(/y/g, "i");
  }

  function expandSearchVariants(value) {
    const base = normalizeSearchBase(value);
    if (!base) return [];
    const variants = new Set([base, normalizeLatin(base)]);
    if (/[а-яё]/i.test(base)) {
      const latin = transliterateRuToLat(base);
      variants.add(latin);
      variants.add(latin.replace(/ks/g, "x"));
      variants.add(latin.replace(/andr/g, "ander"));
      variants.add(latin.replace(/ks/g, "x").replace(/andr/g, "ander"));
      variants.add(latin.replace(/ii\b/g, "y"));
      variants.add(latin.replace(/ei\b/g, "ey"));
    }
    return [...variants].filter(Boolean);
  }

  function buildStudentSearchText(student) {
    return [
      student.displayName,
      student.email,
      student.telegram,
      ...expandSearchVariants(student.displayName || ""),
      ...expandSearchVariants(student.email || ""),
      ...expandSearchVariants(student.telegram || ""),
    ]
      .map(normalizeSearchBase)
      .filter(Boolean)
      .join(" ");
  }

  function studentMatchesSearch(student, query) {
    const variants = expandSearchVariants(query);
    if (variants.length === 0) return true;
    return variants.some((variant) => student.searchText?.includes(variant));
  }

  function isOwnStudent(student) {
    const canHaveAssignedStudents =
      state.currentRole === "mentor" || state.currentRole === "curator";
    return (
      !canHaveAssignedStudents ||
      !state.myStudentsOnly ||
      student.assignedStaffUid === state.currentUser?.uid
    );
  }

  function applyStudentFilters() {
    const filtered = state.allStudents.filter(
      (student) =>
        isOwnStudent(student) &&
        studentMatchesSearch(student, state.studentSearchQuery),
    );
    state.students = filtered;
    if (!filtered.some((student) => student.uid === state.selectedStudentId)) {
      state.selectedStudentId = filtered[0]?.uid || "";
      state.selectedStudentName = filtered[0]?.displayName || "";
    }
  }

  function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date
      .toLocaleDateString(window.i18n?.locale || "ru-RU", {
        day: "numeric",
        month: "short",
      })
      .replace(".", "");
  }

  function getSprintId(value = new Date()) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const day = date.getDay() || 7;
    date.setDate(date.getDate() - day + 1);
    date.setHours(0, 0, 0, 0);
    const pad = (number) => String(number).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function getDemoStore() {
    try {
      return JSON.parse(localStorage.getItem(DEMO_KEY) || "{}");
    } catch (error) {
      return {};
    }
  }

  function setDemoStore(nextStore) {
    try {
      localStorage.setItem(DEMO_KEY, JSON.stringify(nextStore));
    } catch (error) {}
  }

  function showToast(message) {
    const toast = $("#roadmap-toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2800);
  }

  function isPermissionDenied(error) {
    return (
      error &&
      (error.code === "PERMISSION_DENIED" || error.code === "permission_denied")
    );
  }

  function getMilestones() {
    if (!state.roadmap) return [];
    return state.roadmap.milestones;
  }

  function milestoneLabel(milestone) {
    if (!milestone) return "";
    return milestone.weekLabel || String(milestone.week);
  }

  function milestoneKindLabel(kind) {
    const labels = {
      required: t("обязательный"),
      optional: "optional",
      additional: t("дополнительный"),
    };
    return labels[kind] || kind || "milestone";
  }

  function eventStatusFor(milestoneId) {
    const tasks = state.tasksByMilestone[milestoneId] || [];
    if (tasks.length === 0) return null;
    if (
      tasks.every(
        (task) => task.status === "done" || task.boardStatus === "done",
      )
    )
      return "done";
    return "assigned";
  }

  function statusFor(milestone, currentOpenId) {
    const progress = state.progress[milestone.id] || {};
    if (progress.status === "done" || eventStatusFor(milestone.id) === "done")
      return "done";
    if (
      progress.status === "assigned" ||
      eventStatusFor(milestone.id) === "assigned"
    )
      return "assigned";
    if (milestone.id === currentOpenId) return "current";
    return "open";
  }

  function buildAssignmentDescription(milestone) {
    const assignmentTitle =
      milestone.eventType === "mock" ? "Мок-собес" : "Задание";
    const lines = [
      `**${assignmentTitle}:**`,
      "",
      `- **Milestone:** ${milestoneLabel(milestone)} — ${milestone.title}`,
      `- Приблизительная **оценка нагрузки:** ${milestone.estimateHours} ч`,
      "",
    ];

    milestone.tracks.forEach((track) => {
      const url = toAbsoluteSiteUrl(track.href);
      const blocksText = track.blocks ? `блоки ${track.blocks}` : "материал";
      lines.push(`- **${track.label}**: ${blocksText} — [ссылка](${url})`);
    });

    if (milestone.highlight && milestone.highlight.text) {
      const { kicker, title, text } = milestone.highlight;
      lines.push("");
      lines.push(
        `**${kicker || "Важно"}: ${title || ""}**`.replace(/: \*\*$/, "**"),
      );
      lines.push("");
      lines.push(text);
      lines.push("");
    }

    if (
      Array.isArray(milestone.instructions) &&
      milestone.instructions.length
    ) {
      lines.push("");
      lines.push("**Пояснения:**");
      lines.push("");
      milestone.instructions.forEach((instruction) => {
        lines.push(`- ${instruction}`);
      });
    }

    lines.push("");
    // lines.push("После закрытия milestone в персональном роадмапе связанные карточки доски можно закрыть автоматически.");
    return lines.join("\n");
  }

  function buildAssignmentDetails(milestone) {
    const assignmentTitle =
      milestone.eventType === "mock" ? "Мок-собес" : "Задание";
    return {
      description: `${assignmentTitle}: ${milestone.title}`,
      explanation: [
        `Milestone: ${milestoneLabel(milestone)}`,
        `Фаза: ${milestone.phase || "без фазы"}`,
        `Плановая нагрузка: ${milestone.estimateHours || 0} ч`,
      ],
      materials: (milestone.tracks || []).map((track) => ({
        label: track.label,
        blocks: track.blocks || "",
        href: toAbsoluteSiteUrl(track.href),
      })),
      highlight: milestone.highlight
        ? {
            kicker: milestone.highlight.kicker || "",
            title: milestone.highlight.title || "",
            text: milestone.highlight.text || "",
          }
        : null,
      instructions: Array.isArray(milestone.instructions)
        ? milestone.instructions
        : [],
    };
  }

  function isMilestoneClosed(milestone) {
    const progress = state.progress[milestone.id] || {};
    return (
      progress.status === "done" || eventStatusFor(milestone.id) === "done"
    );
  }

  /* Первая незакрытая неделя ПОСЛЕ последней закрытой, а не первая незакрытая
     вообще: недели добавляют и в середину плана, а прогресс хранится по
     milestone.id, поэтому у прошедшего дальше ученика вставленная неделя
     остаётся без статуса. Подробности — в roadmap-position.js. */
  function findOpenMilestoneIndex(milestones) {
    return window.RoadmapPosition.openMilestoneIndex(milestones, (milestone) =>
      isMilestoneClosed(milestone),
    );
  }

  function defaultDueDate(milestone, milestones = getMilestones()) {
    const openIndex = findOpenMilestoneIndex(milestones);
    const targetIndex = milestones.findIndex(
      (item) => item.id === milestone.id,
    );
    const weeksAhead =
      openIndex >= 0 && targetIndex >= 0
        ? Math.max(1, targetIndex - openIndex + 1)
        : 1;
    // Было: локальная полночь через setHours, а ключ снимался toISOString(),
    // то есть по UTC. Для любой зоны восточнее Гринвича полночь по месту — это
    // ещё вчерашний день по UTC, и срок этапа показывался на сутки раньше,
    // чем считался. Берём момент «сейчас плюс N недель» и день платформы от
    // него — промежуточной полуночи, на которой всё и ломалось, больше нет.
    return window.platformDayKey(
      Date.now() + weeksAhead * 7 * 24 * 60 * 60 * 1000,
    );
  }

  function computeStats(milestones) {
    const openIndex = findOpenMilestoneIndex(milestones);
    const currentOpenId = openIndex >= 0 ? milestones[openIndex]?.id : null;

    const statuses = milestones.map((milestone) =>
      statusFor(milestone, currentOpenId),
    );
    const done = statuses.filter((status) => status === "done").length;
    const assigned = statuses.filter((status) => status === "assigned").length;
    const totalHours = milestones.reduce(
      (sum, item) => sum + (item.estimateHours || 0),
      0,
    );
    const completedDurations = milestones
      .map((milestone) => state.progress[milestone.id])
      .filter(
        (progress) =>
          progress?.status === "done" &&
          Number.isFinite(progress.timeSpentHours),
      )
      .map((progress) => progress.timeSpentHours);
    const avgHours = completedDurations.length
      ? Math.round(
          completedDurations.reduce((sum, value) => sum + value, 0) /
            completedDurations.length,
        )
      : null;

    return {
      currentOpenId,
      done,
      assigned,
      total: milestones.length,
      totalHours,
      avgHours,
      percent: milestones.length
        ? Math.round((done / milestones.length) * 100)
        : 0,
    };
  }

  function renderStudentSelect() {
    const select = $("#roadmap-student");
    if (!select) return;

    if (userCanManage()) applyStudentFilters();
    const students = state.students.length ? state.students : fallbackStudents;
    select.innerHTML = students
      .map(
        (student) =>
          `<option value="${escapeHtml(student.uid)}">${escapeHtml(student.displayName)}</option>`,
      )
      .join("");

    if (!students.some((student) => student.uid === state.selectedStudentId)) {
      state.selectedStudentId = students[0]?.uid || "";
      state.selectedStudentName = students[0]?.displayName || "";
    }
    select.value = state.selectedStudentId;
    select.disabled = !userCanManage();

    const studentField = $("#roadmap-student-field");
    if (studentField) studentField.hidden = state.currentRole === "student";

    const search = $("#roadmap-student-search");
    if (search) {
      search.disabled = !userCanManage();
      search.value = state.studentSearchQuery;
    }

    const myRow = $("#roadmap-my-students-row");
    const myCheckbox = $("#roadmap-my-students");
    const showMyStudentsFilter = canFilterOwnStudents();
    if (myRow) myRow.hidden = !showMyStudentsFilter;
    if (myCheckbox) {
      myCheckbox.checked = showMyStudentsFilter && state.myStudentsOnly;
      myCheckbox.disabled = !showMyStudentsFilter;
    }
  }

  function render() {
    if (!state.roadmap) return;

    updateRoleVisibility();
    enforceStudentScope();
    renderStudentSelect();
    const canManage = userCanManage();
    const milestones = getMilestones();
    const stats = computeStats(milestones);
    const student = (
      state.students.length ? state.students : fallbackStudents
    ).find((item) => item.uid === state.selectedStudentId);
    state.selectedStudentName =
      student?.displayName || state.selectedStudentName || "";

    $("#stat-progress").textContent = `${stats.done}/${stats.total}`;
    $("#stat-percent").textContent = `${stats.percent}%`;
    $("#stat-assigned").textContent = String(stats.assigned);
    $("#stat-hours").textContent = t("{hours} ч", { hours: stats.totalHours });
    $("#roadmap-progress-fill").style.width = `${stats.percent}%`;
    const insightStudent = $("#insight-student");
    const insightSpeed = $("#insight-speed");
    const insightCurrent = $("#insight-current");
    if (insightStudent) insightStudent.textContent = state.selectedStudentName;
    if (insightSpeed)
      insightSpeed.textContent = stats.avgHours
        ? t("в среднем {hours} ч на milestone", { hours: stats.avgHours })
        : t("пока нет закрытых milestone");
    if (insightCurrent) {
      insightCurrent.textContent = stats.currentOpenId
        ? milestoneLabel(milestones.find((m) => m.id === stats.currentOpenId))
        : t("программа закрыта");
    }

    const list = $("#milestone-list");
    list.innerHTML = milestones
      .map((milestone) => {
        const progress = state.progress[milestone.id] || {};
        const status = statusFor(milestone, stats.currentOpenId);
        const isMock = isMockMilestone(milestone);
        const tasks = state.tasksByMilestone[milestone.id] || [];
        /* Статус — один заметный бейдж в правом верхнем углу, а не ещё две
           серые таблетки среди прочих: закрыт этап или нет, должно читаться
           без вглядывания в кнопки. */
        const statusText = {
          done: `${t("Закрыто")}${progress.completedAt ? ` · ${formatDate(progress.completedAt)}` : ""}`,
          assigned: `${t("На доске")}${tasks.length > 1 ? ` · ${tasks.length}` : ""}`,
          current: t("Текущий этап"),
          open: t("Ожидает"),
        }[status];
        const dueValue = defaultDueDate(milestone, milestones);
        const tracks = milestone.tracks
          .map((track) => {
            const locked = canManage && isTrackLocked(track);
            const title = locked
              ? t("Закрыто для ученика — откроется при постановке на доску")
              : track.blocks
                ? t("Блоки {blocks}", { blocks: track.blocks })
                : "";
            return `
        <a class="track-chip${locked ? " track-chip--locked" : ""}" href="${escapeHtml(track.href)}" style="--track-color: ${escapeHtml(track.color)}"${title ? ` title="${escapeHtml(title)}"` : ""}>
          <strong>${escapeHtml(track.label)}</strong>${track.blocks ? `<span class="track-chip-blocks">${escapeHtml(track.blocks)}</span>` : ""}${locked ? `<span class="track-chip-lock" aria-label="${t("закрыто для ученика")}">🔒</span>` : ""}
        </a>
      `;
          })
          .join("");
        const isStudent = state.currentRole === "student";
        const isActive = status === "current" || status === "assigned";
        const showActions = canManage && (!isStudent || isActive);

        const actionButtons = status === "assigned"
          ? `
            <button class="roadmap-button ghost" type="button" data-action="preview" data-milestone-id="${escapeHtml(milestone.id)}">${t("Задание")}</button>
            <a class="roadmap-button primary" href="../calender/index.html">${t("К доске задач")}</a>
            <button class="roadmap-button success" type="button" data-action="complete" data-milestone-id="${escapeHtml(milestone.id)}">${t("Закрыть этап")}</button>
          `
          : `
            <button class="roadmap-button ghost" type="button" data-action="preview" data-milestone-id="${escapeHtml(milestone.id)}">${t("Предпросмотр")}</button>
            <button class="roadmap-button primary" type="button" data-action="schedule" data-milestone-id="${escapeHtml(milestone.id)}">${t("На доску")}</button>
            <button class="roadmap-button success" type="button" data-action="complete" data-milestone-id="${escapeHtml(milestone.id)}">${t("Закрыть этап")}</button>
          `;

        const actions = showActions
          ? `
        <div class="milestone-actions">
          <label class="milestone-date">
            ${t("Дедлайн")}
            <input type="date" data-due-for="${escapeHtml(milestone.id)}" value="${dueValue}">
          </label>
          <div class="milestone-buttons">
            ${actionButtons}
          </div>
        </div>
      `
          : "";

        const statusHtml = status === "done"
          ? `<div class="milestone-status-wrap"><span class="milestone-status milestone-status--done">${escapeHtml(statusText)}</span><button class="milestone-reopen-btn" type="button" data-action="reopen" data-milestone-id="${escapeHtml(milestone.id)}" title="${t("Открыть этап заново")}">↺ ${t("Вернуть")}</button></div>`
          : `<span class="milestone-status milestone-status--${status}">${escapeHtml(statusText)}</span>`;

        return `
        <article class="milestone-card status-${status}${isMock ? " milestone-card--mock" : ""}" data-milestone-id="${escapeHtml(milestone.id)}" data-event-type="${escapeHtml(milestone.eventType || "assignment")}">
          <div class="milestone-marker" aria-hidden="true">${escapeHtml(milestoneLabel(milestone))}</div>
          <div class="milestone-main">
            <div class="milestone-top">
              <div class="milestone-heading">
                <h3 class="milestone-title">${escapeHtml(milestone.title)}${isMock ? '<span class="milestone-title-alert" aria-hidden="true">!</span>' : ""}</h3>
                <div class="milestone-meta">
                  ${isMock ? `<span class="milestone-pill milestone-pill--mock">${t("Мок-собес")}</span>` : ""}
                  <span class="milestone-pill ${escapeHtml(milestone.kind)}">${escapeHtml(milestoneKindLabel(milestone.kind))}</span>
                  <span class="milestone-pill">${escapeHtml(milestone.phase)}</span>
                  <span class="milestone-pill">${t("{hours} ч", { hours: milestone.estimateHours })}</span>
                </div>
              </div>
              ${statusHtml}
            </div>
            <div class="track-grid">${tracks}</div>
            ${renderHighlight(milestone.highlight)}
            ${actions}
          </div>
        </article>
      `;
      })
      .join("");
  }

  async function loadRoadmap() {
    const response = await fetch(ROADMAP_URL);
    if (!response.ok) throw new Error(`Roadmap HTTP ${response.status}`);
    state.roadmap = await response.json();
  }

  /* Карта нужна только персоналу и только для замков на чипах, поэтому
     грузится лениво и один раз. Что открыть на самом деле, решает сервер
     (scheduleRoadmapMilestone), карта на это не влияет. */
  function loadPathMap() {
    if (!loadPathMap.promise) {
      loadPathMap.promise = fetch("/assets/js/config/categories-config.json")
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json();
        })
        .then((config) => {
          state.pathMap =
            window.MaterialPageCategories.buildPathToCategories(config);
        })
        .catch((error) => {
          console.warn("Не удалось загрузить карту доступов:", error);
        });
    }
    return loadPathMap.promise;
  }

  function trackCategoryIds(track) {
    if (!state.pathMap) return [];
    return window.MaterialPageCategories.categoriesForPath(
      state.pathMap,
      track.href,
    );
  }

  /* Как в material-access-guard.js: страница открыта, если открыт хотя бы
     один из её ключей. */
  function isTrackLocked(track) {
    if (!state.materialAccess) return false;
    const ids = trackCategoryIds(track);
    return ids.length > 0 && !ids.some((id) => state.materialAccess[id]);
  }

  /* Доступы выбранного ученика — для замков на чипах. Зовётся только при
     явном выборе ученика, не на каждый символ поиска; прежнее значение
     держится, пока не придёт новое, чтобы замки не мигали. */
  async function loadStudentAccess() {
    if (!userCanManage() || !state.selectedStudentId || !window.staffApi)
      return;
    const studentId = state.selectedStudentId;
    try {
      const [detail] = await Promise.all([
        window.staffApi.getStaffStudentDetail(studentId, ["access"]),
        loadPathMap(),
      ]);
      if (state.selectedStudentId !== studentId) return;
      state.materialAccess = detail?.materialAccess || {};
      render();
    } catch (error) {
      console.warn("Не удалось загрузить доступы ученика:", error);
    }
  }

  function loadDemoStudent() {
    state.demoMode = true;
    state.currentRole = "student";
    state.settingsLoaded = true;
    state.students = [];
    state.allStudents = [];
    state.studentSearchQuery = "";
    state.myStudentsOnly = true;
    state.selectedStudentId = "";
    state.selectedStudentName = "";
    const store = getDemoStore();
    state.progress = store[state.selectedStudentId]?.progress || {};
    state.tasksByMilestone =
      store[state.selectedStudentId]?.tasksByMilestone || {};
    updateRoleVisibility();
    render();
  }

  function saveDemoStudent() {
    const store = getDemoStore();
    store[state.selectedStudentId] = {
      progress: state.progress,
      tasksByMilestone: state.tasksByMilestone,
    };
    setDemoStore(store);
  }

  async function initializeFirebase() {
    if (!window.firebase) throw new Error("Firebase SDK is not loaded");
    const cfg = await fetch("/config/firebase-config.json").then((res) =>
      res.json(),
    );
    const app = firebase.apps.length
      ? firebase.app()
      : firebase.initializeApp(cfg);
    state.auth = firebase.auth(app);
    state.db = firebase.database(app);
    state.firebaseReady = true;

    state.auth.onAuthStateChanged(async (user) => {
      if (!user) {
        loadDemoStudent();
        showToast(
          t(
            "Открыт демо-режим: войдите, чтобы увидеть реальные данные ученика.",
          ),
        );
        return;
      }

      state.demoMode = false;
      state.currentUser = user;
      const userSnap = await state.db.ref(`users/${user.uid}`).once("value");
      const userData = userSnap.val() || {};
      state.currentRole = userData.role || "student";
      updateRoleVisibility();

      if (userCanManage() && state.currentRole !== "student") {
        state.pendingStudentId =
          state.pendingStudentId || readSelectedStudent(user.uid);
        // Список учеников идёт через Cloud Function, и её недоступность не
        // должна ронять всю инициализацию: без catch дальше не выполнялись ни
        // settingsLoaded, ни subscribeStudent, и страница оставалась пустой.
        try {
          await loadStudents();
          loadStudentAccess();
        } catch (error) {
          console.error("Не удалось загрузить список учеников", error);
          state.allStudents = [];
          state.students = [];
          showToast(
            t(
              "Не удалось загрузить список учеников. Обновите страницу или попробуйте позже.",
            ),
          );
        }
      } else {
        const selfStudent = {
          uid: user.uid,
          displayName:
            userData.displayName ||
            user.email ||
            (window.i18n?.lang === "en" ? "Me" : "Я"),
          email: userData.email || user.email || "",
          telegram:
            userData.telegram ||
            userData.telegramUsername ||
            userData.telegram_username ||
            userData.tg ||
            "",
          assignedStaffUid: userData.assignedStaffUid || "",
        };
        selfStudent.searchText = buildStudentSearchText(selfStudent);
        state.students = [selfStudent];
        state.allStudents = [selfStudent];
        state.selectedStudentId = user.uid;
      }

      state.settingsLoaded = true;
      subscribeStudent();
    });
  }

  async function loadStudents() {
    if (!window.achievementApi)
      throw new Error(t("Сервис сотрудников недоступен."));
    const directory = await window.achievementApi.getStaffDirectory();
    const students = [];
    directory.forEach((data) => {
      if (data.role === "student" && data.status !== "departed") {
        const student = {
          uid: data.uid,
          displayName: data.displayName || data.email || data.uid.slice(0, 6),
          email: data.email || "",
          telegram:
            data.telegram ||
            data.telegramUsername ||
            data.telegram_username ||
            data.tg ||
            "",
          assignedStaffUid: data.assignedStaffUid || "",
        };
        student.searchText = buildStudentSearchText(student);
        students.push(student);
      }
    });
    students.sort((a, b) => a.displayName.localeCompare(b.displayName, "ru"));
    state.allStudents = students;

    if (state.pendingStudentId) {
      const requestedStudent = students.find(
        (student) => student.uid === state.pendingStudentId,
      );
      if (requestedStudent) {
        if (
          canFilterOwnStudents() &&
          requestedStudent.assignedStaffUid !== state.currentUser?.uid
        ) {
          state.myStudentsOnly = false;
        }
        applyStudentFilters();
        state.selectedStudentId = requestedStudent.uid;
        state.selectedStudentName = requestedStudent.displayName;
        state.pendingStudentId = "";
        return;
      }
      state.pendingStudentId = "";
    }

    applyStudentFilters();
    if (
      !state.students.some((student) => student.uid === state.selectedStudentId)
    ) {
      state.selectedStudentId = state.students[0]?.uid || "";
    }
  }

  function clearListeners() {
    state.listeners.forEach((listener) =>
      listener.ref.off(listener.event, listener.handler),
    );
    state.listeners = [];
  }

  function subscribeStudent() {
    enforceStudentScope();
    clearListeners();
    if (!state.db || !state.selectedStudentId) {
      state.progress = {};
      state.tasksByMilestone = {};
      render();
      return;
    }

    const progressRef = state.db.ref(
      `studentRoadmaps/${state.selectedStudentId}/milestones`,
    );
    const progressHandler = (snapshot) => {
      state.progress = snapshot.val() || {};
      render();
    };
    progressRef.on("value", progressHandler);
    state.listeners.push({
      ref: progressRef,
      event: "value",
      handler: progressHandler,
    });

    const tasksHandler = (snapshot) => {
      const grouped = {};
      snapshot.forEach((child) => {
        const task = child.val() || {};
        if (
          task.studentId !== state.selectedStudentId ||
          !task.roadmapMilestoneId
        )
          return;
        if (!grouped[task.roadmapMilestoneId])
          grouped[task.roadmapMilestoneId] = [];
        grouped[task.roadmapMilestoneId].push({
          id: child.key,
          status: task.status || "open",
          boardStatus: task.boardStatus || "todo",
        });
      });
      state.tasksByMilestone = grouped;
      render();
    };
    const tasksErrorHandler = (error) => {
      if (isPermissionDenied(error)) {
        showToast(
          t("Доска задач пока недоступна: нужно обновить Firebase rules."),
        );
      } else {
        console.warn("Не удалось загрузить карточки доски:", error);
      }
    };
    if (userCanManage() && state.currentRole !== "student") {
      window.achievementApi
        .listKanbanTasks({ studentId: state.selectedStudentId, limit: 100 })
        .then((result) =>
          tasksHandler({
            forEach: (callback) =>
              (result.items || []).forEach((task) =>
                callback({ key: task.id, val: () => task }),
              ),
          }),
        )
        .catch(tasksErrorHandler);
      return;
    }
    const tasksRef = state.db
      .ref("kanbanTasks")
      .orderByChild("studentId")
      .equalTo(state.selectedStudentId);
    tasksRef.on("value", tasksHandler, tasksErrorHandler);
    state.listeners.push({
      ref: tasksRef,
      event: "value",
      handler: tasksHandler,
    });
  }

  function pickedDueDate(milestone) {
    const dueInput = document.querySelector(
      `[data-due-for="${CSS.escape(milestone.id)}"]`,
    );
    return dueInput?.value || defaultDueDate(milestone, getMilestones());
  }

  /* Ровно то, что ляжет в kanbanTasks (без серверных отметок времени и
     автора). Предпросмотр рисует этот же объект — поэтому он не расходится
     с тем, что получит ученик. */
  function buildTaskPayload(milestone, dueDate) {
    const dueAt = new Date(`${dueDate}T23:59:00`);
    const titleTracks = milestone.tracks
      .map((track) => track.label.replace(/\s+Base$/, ""))
      .slice(0, 3)
      .join(", ");
    const eventPrefix =
      milestone.weekLabel || `W${String(milestone.week).padStart(2, "0")}`;
    return {
      title: milestone.eventTitle || `${eventPrefix}: ${titleTracks}`,
      type: milestone.eventType || "assignment",
      status: "open",
      boardStatus: "todo",
      startAt: new Date().toISOString(),
      dueAt: dueAt.toISOString(),
      endAt: dueAt.toISOString(),
      studentId: state.selectedStudentId,
      studentName:
        state.selectedStudentName || state.selectedStudentId.slice(0, 6),
      description: buildAssignmentDescription(milestone),
      details: buildAssignmentDetails(milestone),
      roadmapMilestoneId: milestone.id,
      roadmapWeek: milestone.week,
      source: "roadmap",
    };
  }

  function openPreview(milestoneId) {
    const dialog = $("#roadmap-preview");
    const milestone = getMilestones().find((item) => item.id === milestoneId);
    if (!dialog || !milestone) return;
    const task = buildTaskPayload(milestone, pickedDueDate(milestone));
    state.previewMilestoneId = milestoneId;
    $("#roadmap-preview-kicker").textContent = t("Так увидит {name}", {
      name: state.selectedStudentName || t("ученик"),
    });
    $("#roadmap-preview-title").textContent = task.title;
    $("#roadmap-preview-meta").innerHTML = [
      `<span class="kanban-pill is-own">${escapeHtml(task.studentName)}</span>`,
      `<span class="kanban-pill">${task.type === "mock" ? t("Мок-собес") : t("Задание")}</span>`,
      `<span class="kanban-pill">${escapeHtml(t("до {date}", { date: formatDate(task.dueAt) }))}</span>`,
    ].join("");
    $("#roadmap-preview-body").innerHTML =
      window.TaskDetails.renderDetailsPreview(task);
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function closePreview() {
    const dialog = $("#roadmap-preview");
    if (!dialog) return;
    if (dialog.open && typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  async function scheduleMilestone(milestoneId) {
    if (!userCanManage()) {
      showToast(t("Назначать задания может только ментор или куратор."));
      return;
    }
    const milestone = state.roadmap.milestones.find(
      (item) => item.id === milestoneId,
    );
    if (!milestone) return;
    if (!state.selectedStudentId) {
      showToast(t("Сначала выберите ученика."));
      return;
    }

    if (state.demoMode || !state.db || !state.currentUser) {
      const now = Date.now();
      state.tasksByMilestone[milestoneId] = [
        ...(state.tasksByMilestone[milestoneId] || []),
        { id: `demo-${now}`, status: "open", boardStatus: "todo" },
      ];
      state.progress[milestoneId] = {
        ...(state.progress[milestoneId] || {}),
        status: "assigned",
        assignedAt: state.progress[milestoneId]?.assignedAt || now,
      };
      saveDemoStudent();
      render();
      showToast(t("Демо: milestone отмечен как поставленный на доску."));
      return;
    }

    /* Ученик фиксируется до await: пока запрос идёт, select могли
       переключить, а карточка и доступы должны уйти тому, для кого нажали. */
    const studentId = state.selectedStudentId;
    const task = buildTaskPayload(milestone, pickedDueDate(milestone));
    /* Сервер одной записью создаёт карточку, отмечает этап и открывает
       страницы из списка материалов, которых у ученика ещё нет. */
    const result = await window.staffApi.scheduleRoadmapMilestone({
      studentId,
      milestoneId: milestone.id,
      task,
      pages: milestone.tracks.map((track) => track.href),
    });
    const opened = result?.grantedLabels || [];
    if (state.selectedStudentId === studentId && state.materialAccess) {
      (result?.grantedCategories || []).forEach((id) => {
        state.materialAccess[id] = true;
      });
    }
    if (!state.tasksByMilestone[milestoneId]) state.tasksByMilestone[milestoneId] = [];
    state.tasksByMilestone[milestoneId].push({
      id: result?.taskId || `task_${Date.now()}`,
      status: "open",
      boardStatus: "todo",
    });
    if (!state.progress[milestoneId]) state.progress[milestoneId] = {};
    state.progress[milestoneId].status = "assigned";
    state.progress[milestoneId].assignedAt = Date.now();
    render();

    showToast(
      opened.length
        ? t("Поставлено на доску. Открыты разделы: {sections}.", {
            sections: opened.join(", "),
          })
        : t("Milestone поставлен на доску выбранного ученика."),
    );
  }

  async function completeMilestone(milestoneId) {
    if (!userCanManage()) {
      showToast(t("Закрывать milestone может только ментор или куратор."));
      return;
    }
    const now = Date.now();
    const progress = state.progress[milestoneId] || {};
    const assignedAt = Number(progress.assignedAt) || now;
    const timeSpentHours = Math.max(1, Math.round((now - assignedAt) / 36e5));

    if (state.demoMode || !state.db) {
      state.progress[milestoneId] = {
        ...progress,
        status: "done",
        assignedAt,
        completedAt: now,
        timeSpentHours,
      };
      state.tasksByMilestone[milestoneId] = (
        state.tasksByMilestone[milestoneId] || []
      ).map((task) => ({
        ...task,
        status: "done",
        boardStatus: "done",
        completedAt: now,
        completedSprint: getSprintId(now),
      }));
      saveDemoStudent();
      render();
      showToast(
        t("Демо: milestone закрыт, связанные карточки отмечены выполненными."),
      );
      return;
    }

    const updates = {};
    updates[
      `studentRoadmaps/${state.selectedStudentId}/milestones/${milestoneId}/status`
    ] = "done";
    updates[
      `studentRoadmaps/${state.selectedStudentId}/milestones/${milestoneId}/completedAt`
    ] = firebase.database.ServerValue.TIMESTAMP;
    updates[
      `studentRoadmaps/${state.selectedStudentId}/milestones/${milestoneId}/timeSpentHours`
    ] = timeSpentHours;
    updates[
      `studentRoadmaps/${state.selectedStudentId}/milestones/${milestoneId}/updatedAt`
    ] = firebase.database.ServerValue.TIMESTAMP;

    try {
      const tasksSnapshot = await state.db
        .ref("kanbanTasks")
        .orderByChild("studentId")
        .equalTo(state.selectedStudentId)
        .once("value");
      tasksSnapshot.forEach((child) => {
        const task = child.val() || {};
        if (
          task.studentId === state.selectedStudentId &&
          task.roadmapMilestoneId === milestoneId
        ) {
          updates[`kanbanTasks/${child.key}/status`] = "done";
          updates[`kanbanTasks/${child.key}/boardStatus`] = "done";
          updates[`kanbanTasks/${child.key}/completedAt`] =
            firebase.database.ServerValue.TIMESTAMP;
          updates[`kanbanTasks/${child.key}/completedSprint`] = getSprintId();
          updates[`kanbanTasks/${child.key}/updatedAt`] =
            firebase.database.ServerValue.TIMESTAMP;
        }
      });
    } catch (error) {
      if (isPermissionDenied(error)) {
        showToast(
          t(
            "Milestone закроется, но карточки доски недоступны: обновите Firebase rules.",
          ),
        );
      } else {
        throw error;
      }
    }

    await state.db.ref().update(updates);
    state.progress[milestoneId] = {
      ...progress,
      status: "done",
      assignedAt,
      completedAt: now,
      timeSpentHours,
    };
    if (state.tasksByMilestone[milestoneId]) {
      state.tasksByMilestone[milestoneId].forEach((t) => {
        t.status = "done";
        t.boardStatus = "done";
      });
    }
    render();
    showToast(t("Milestone закрыт, связанные карточки на доске тоже закрыты."));
  }

  async function reopenMilestone(milestoneId) {
    const studentId = state.selectedStudentId || state.currentUser?.uid || "offline_user";
    const updates = {};
    updates[`studentRoadmaps/${studentId}/milestones/${milestoneId}/status`] = "assigned";
    updates[`studentRoadmaps/${studentId}/milestones/${milestoneId}/completedAt`] = null;

    try {
      const tasksSnapshot = await state.db
        .ref("kanbanTasks")
        .orderByChild("studentId")
        .equalTo(studentId)
        .once("value");
      tasksSnapshot.forEach((child) => {
        const task = child.val() || {};
        if (task.studentId === studentId && task.roadmapMilestoneId === milestoneId) {
          updates[`kanbanTasks/${child.key}/status`] = "open";
          updates[`kanbanTasks/${child.key}/boardStatus`] = "todo";
          updates[`kanbanTasks/${child.key}/completedAt`] = null;
        }
      });
    } catch (e) {}

    await state.db.ref().update(updates);
    if (state.progress[milestoneId]) {
      state.progress[milestoneId].status = "assigned";
      state.progress[milestoneId].completedAt = null;
    }
    if (state.tasksByMilestone[milestoneId]) {
      state.tasksByMilestone[milestoneId].forEach((t) => {
        t.status = "open";
        t.boardStatus = "todo";
      });
    }
    render();
    showToast(t("Этап открыт заново."));
  }

  function bindEvents() {
    $("#roadmap-student")?.addEventListener("change", (event) => {
      if (!userCanManage()) {
        enforceStudentScope();
        render();
        return;
      }
      state.selectedStudentId = event.target.value;
      const selected = (
        state.students.length ? state.students : fallbackStudents
      ).find((student) => student.uid === state.selectedStudentId);
      state.selectedStudentName = selected?.displayName || "";
      /* Единственное место записи: явный выбор человека. Поиск и фильтр
         подставляют первого подходящего — это не выбор, его не запоминаем. */
      rememberSelectedStudent(state.currentUser?.uid, state.selectedStudentId);
      if (state.demoMode) loadDemoStudent();
      else subscribeStudent();
      loadStudentAccess();
    });

    $("#roadmap-student-search")?.addEventListener("input", (event) => {
      if (!userCanManage()) return;
      state.studentSearchQuery = event.target.value;
      applyStudentFilters();
      render();
      if (!state.demoMode) subscribeStudent();
    });

    $("#roadmap-my-students")?.addEventListener("change", (event) => {
      if (!canFilterOwnStudents()) return;
      state.myStudentsOnly = event.target.checked;
      applyStudentFilters();
      render();
      if (!state.demoMode) subscribeStudent();
    });

    $("#milestone-list")?.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-action][data-milestone-id]");
      if (!button) return;
      if (button.dataset.action === "preview") {
        openPreview(button.dataset.milestoneId);
        return;
      }
      button.disabled = true;
      try {
        if (button.dataset.action === "schedule")
          await scheduleMilestone(button.dataset.milestoneId);
        if (button.dataset.action === "complete")
          await completeMilestone(button.dataset.milestoneId);
        if (button.dataset.action === "reopen")
          await reopenMilestone(button.dataset.milestoneId);
      } catch (error) {
        console.error(error);
        showToast(t("Не удалось выполнить действие. Подробности в консоли."));
      } finally {
        button.disabled = false;
      }
    });

    $("#roadmap-preview")?.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-preview-action]");
      if (!button) return;
      if (button.dataset.previewAction === "close") {
        closePreview();
        return;
      }
      button.disabled = true;
      try {
        await scheduleMilestone(state.previewMilestoneId);
        closePreview();
      } catch (error) {
        console.error(error);
        showToast(t("Не удалось выполнить действие. Подробности в консоли."));
      } finally {
        button.disabled = false;
      }
    });
  }

  async function boot() {
    bindEvents();
    await loadRoadmap();
    render();
    try {
      await initializeFirebase();
    } catch (error) {
      console.warn("Roadmap Firebase fallback:", error);
      loadDemoStudent();
    }
  }

  boot().catch((error) => {
    console.error(error);
    showToast(t("Не удалось загрузить учебный план."));
  });
})();
