(function () {
  const STAFF_ROLES = new Set(["mentor", "curator", "admin", "admin-helper"]);
  const COLUMN_PREVIEW_LIMIT = 5;
  const BOARD_COLUMNS = [
    { id: "todo", title: t("Нужно сделать") },
    { id: "doing", title: t("В работе") },
    { id: "review", title: t("На проверке") },
    { id: "done", title: t("Готово") },
  ];
  const TYPE_LABELS = {
    assignment: t("Задание"),
    mock: t("Мок-собес"),
    meeting: t("Встреча"),
    feedback: t("Фидбек"),
  };
  const TYPE_ACCENTS = {
    assignment: "#3b82f6",
    mock: "#10b981",
    meeting: "#f59e0b",
    feedback: "#a855f7",
  };
  const TEMPLATE_TABS = [
    { id: "theory", label: t("Теория") },
    { id: "practice", label: t("Практика") },
    { id: "interviews", label: t("Собеседования") },
    { id: "instructions", label: t("Инструкции") },
  ];

  /* Выбранный ученик общий с учебным планом (calender/roadmap.html):
     components/staff-student-selection.js. */
  const {
    selectedStudentFromUrl,
    readSelectedStudent,
    rememberSelectedStudent,
  } = window.StaffStudentSelection;

  const state = {
    auth: null,
    db: null,
    user: null,
    role: "student",
    tasks: [],
    students: [],
    usersById: {},
    templates: [],
    migrationRan: false,
    expandedColumns: {},
    templatePicker: {
      collapsed: false,
      query: "",
      tab: "theory",
      selected: new Set(),
    },
    filters: {
      query: "",
      studentId: selectedStudentFromUrl(),
      type: "",
      myStudentsOnly: true,
      doneSprint: "",
    },
    pagination: {
      nextOffset: null,
      total: 0,
      summary: null,
      isLoading: false,
      requestVersion: 0,
      loadedQueryKey: "",
      searchTimer: null,
    },
  };

  const $ = (selector) => document.querySelector(selector);

  function normalizeRole(role) {
    return String(role || "student")
      .trim()
      .toLowerCase()
      .replace(/_/g, "-");
  }

  function isStaff() {
    return STAFF_ROLES.has(normalizeRole(state.role));
  }

  /* Рендер тела карточки общий с учебным планом (components/task-details.js):
     предпросмотр задания там рисуется тем же кодом, что и карточка здесь. */
  const {
    escapeHtml,
    stripMarkdown,
    toAbsoluteSiteUrl,
    parseLegacyDetails,
    getTaskDetails,
    renderDetailsPreview,
  } = window.TaskDetails;

  function materialToEditorLine(item) {
    if (typeof item === "string") return item;
    const blocks = item.blocks ? `, блоки ${item.blocks}` : "";
    const label = `${item.label || "Материал"}${blocks}`;
    const href = item.href
      ? ` — [ссылка](${toAbsoluteSiteUrl(item.href)})`
      : "";
    return `- **${label}**${href}`;
  }

  function editorTextToLines(value) {
    return String(value || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  function parseMaterialsEditor(value) {
    return editorTextToLines(value).map((line) => {
      const markdownLine = line.replace(/^[-*]\s+/, "").trim();
      if (
        /\*\*[^*]+\*\*/.test(markdownLine) ||
        /\[[^\]]+\]\([^)]+\)/.test(markdownLine)
      ) {
        return markdownLine;
      }
      const parts = line.split("|").map((part) => part.trim());
      if (parts.length === 1) return parts[0];
      return {
        label: parts[0] || "Материал",
        blocks: parts[1] || "",
        href: parts.slice(2).join("|").trim(),
      };
    });
  }

  function buildDetailsDescription(details) {
    if (!details) return "";
    const lines = [];
    if (details.description) {
      lines.push(details.description);
    }
    if (details.explanation?.length) {
      if (lines.length) lines.push("");
      lines.push("Пояснение:");
      details.explanation.forEach((item) => lines.push(`- ${item}`));
    }
    if (details.materials?.length) {
      lines.push("", "Материалы:");
      details.materials.forEach((item) => {
        if (typeof item === "string") {
          lines.push(/^[-*]\s+/.test(item) ? item : `- ${item}`);
          return;
        }
        const blocks = item.blocks ? `, блоки ${item.blocks}` : "";
        const label = `${item.label || "Материал"}${blocks}`;
        const href = item.href
          ? ` — [ссылка](${toAbsoluteSiteUrl(item.href)})`
          : "";
        lines.push(`- **${label}**${href}`);
      });
    }
    if (details.instructions?.length) {
      lines.push("", "Что сделать:");
      details.instructions.forEach((item) => lines.push(`- ${item}`));
    }
    return lines.join("\n").trim();
  }

  function getDetailsFromEditor() {
    const details = {
      description: $("#kanban-details-description").value.trim(),
      explanation: editorTextToLines($("#kanban-details-explanation").value),
      materials: parseMaterialsEditor($("#kanban-details-materials").value),
      instructions: editorTextToLines($("#kanban-details-instructions").value),
    };
    if (
      !details.description &&
      !details.explanation.length &&
      !details.materials.length &&
      !details.instructions.length
    ) {
      return null;
    }
    return details;
  }

  function renderDetailsObjectPreview(details) {
    if (!details) return "";
    return renderDetailsPreview({
      description: buildDetailsDescription(details),
      details,
    });
  }

  function updateDetailsLivePreview() {
    const preview = $("#kanban-details-live-preview");
    const body = $("#kanban-details-live-preview-body");
    if (!preview || !body || preview.hidden) return;
    const details = getDetailsFromEditor();
    const html = renderDetailsObjectPreview(details);
    body.innerHTML =
      html ||
      `<p class="kanban-preview-empty">${t("Заполни описание, пояснение, материалы или шаги.")}</p>`;
  }

  function getTemplateSearchText(template) {
    return [
      template.id,
      template.label,
      template.path,
      template.customText,
      template.track,
      template.level,
      ...(template.tags || []),
    ].join(" ");
  }

  function getFilteredTemplates() {
    const query = normalizeText(state.templatePicker.query);
    return state.templates.filter((item) => {
      if (!item.path && !item.customText) return false;
      if (state.templatePicker.tab && item.tab !== state.templatePicker.tab)
        return false;
      if (!query) return true;
      const haystack = normalizeText(getTemplateSearchText(item));
      return query.split(/\s+/).every((word) => haystack.includes(word));
    });
  }

  function getSelectedTemplates() {
    return state.templates.filter((item) =>
      state.templatePicker.selected.has(item.id),
    );
  }

  function formatTemplateMaterialLine(template) {
    const label = template.label || template.id;
    const href = toAbsoluteSiteUrl(template.path);
    return `- **${label}** — [ссылка](${href})`;
  }

  function getTemplateInstructionLines(template) {
    return editorTextToLines(template.customText).map((line) =>
      line.replace(/^[-*]\s+/, ""),
    );
  }

  function getTemplateInsertions(templates) {
    return templates.reduce(
      (insertions, template) => {
        if (template.customText) {
          insertions.instructions.push(
            ...getTemplateInstructionLines(template),
          );
        } else if (template.path) {
          insertions.materials.push(formatTemplateMaterialLine(template));
        }
        return insertions;
      },
      { materials: [], instructions: [] },
    );
  }

  function formatTemplateInsertions(insertions) {
    const sections = [];
    if (insertions.materials.length) {
      sections.push(`Материалы:\n${insertions.materials.join("\n")}`);
    }
    if (insertions.instructions.length) {
      sections.push(`Что сделать:\n${insertions.instructions.join("\n")}`);
    }
    return sections.join("\n\n");
  }

  function getTemplateDestination(template) {
    return template.customText ? "Что сделать" : "Материалы";
  }

  function renderTemplateLibrary() {
    const panel = $("#kanban-template-panel");
    const tabs = $("#kanban-template-tabs");
    const list = $("#kanban-template-list");
    const search = $("#kanban-template-search");
    const preview = $("#kanban-template-preview");
    const count = $("#kanban-template-count");
    const addSelected = $("#kanban-template-add-selected");
    const collapse = $("#kanban-template-collapse");
    if (!panel || !tabs || !list || !preview || !count || !addSelected) return;

    panel.classList.toggle("is-collapsed", state.templatePicker.collapsed);
    if (search && search.value !== state.templatePicker.query) {
      search.value = state.templatePicker.query;
    }
    if (collapse) {
      collapse.textContent = state.templatePicker.collapsed ? "+" : "^";
      collapse.setAttribute(
        "aria-label",
        state.templatePicker.collapsed
          ? t("Развернуть библиотеку материалов")
          : t("Свернуть библиотеку материалов"),
      );
    }

    tabs.innerHTML = TEMPLATE_TABS.map(
      (tab) => `
        <button
          type="button"
          class="kanban-template-tab ${tab.id === state.templatePicker.tab ? "is-active" : ""}"
          data-template-tab="${escapeHtml(tab.id)}"
          role="tab"
          aria-selected="${tab.id === state.templatePicker.tab ? "true" : "false"}"
        >
          ${escapeHtml(tab.label)}
        </button>
      `,
    ).join("");

    const templates = getFilteredTemplates();
    list.innerHTML = templates.length
      ? templates
          .map(
            (item) => `
              <article class="kanban-template-item">
                <label>
                  <input
                    type="checkbox"
                    data-template-check="${escapeHtml(item.id)}"
                    ${state.templatePicker.selected.has(item.id) ? "checked" : ""}
                  />
                  <span class="kanban-template-item-title">
                    ${escapeHtml(item.icon || "")}
                    ${escapeHtml(item.label || item.id)}
                  </span>
                </label>
                <button
                  type="button"
                  class="kanban-template-add-one"
                  data-template-add="${escapeHtml(item.id)}"
                  aria-label="${escapeHtml(t("Добавить {item} в {section}", { item: item.label || item.id, section: t(getTemplateDestination(item)) }))}"
                >
                  +
                </button>
              </article>
            `,
          )
          .join("")
      : `<span class="kanban-template-empty">${t("Ничего не найдено")}</span>`;

    const selectedTemplates = getSelectedTemplates();
    const selectedInsertions = getTemplateInsertions(selectedTemplates);
    const selectedText = formatTemplateInsertions(selectedInsertions);
    preview.textContent = selectedText ? selectedText : t("Не выбрано");
    count.textContent = selectedTemplates.length
      ? t("Выбрано: {count}", { count: selectedTemplates.length })
      : t("Не выбрано");
    addSelected.disabled = !selectedText;
  }

  function appendEditorLines(selector, lines) {
    const field = $(selector);
    if (!field || !lines.length) return;
    const existingLines = new Set(editorTextToLines(field.value));
    const nextLines = lines.filter((line) => !existingLines.has(line));
    if (!nextLines.length) return;
    const current = field.value.trim();
    field.value = current
      ? `${current}\n${nextLines.join("\n")}`
      : nextLines.join("\n");
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.focus();
  }

  function appendTemplateInsertions(insertions) {
    appendEditorLines("#kanban-details-materials", insertions.materials);
    appendEditorLines("#kanban-details-instructions", insertions.instructions);
  }

  function insertTemplateMaterial(templateId) {
    const template = state.templates.find((item) => item.id === templateId);
    if (!template) return;
    appendTemplateInsertions(getTemplateInsertions([template]));
  }

  function insertSelectedTemplateMaterials() {
    appendTemplateInsertions(getTemplateInsertions(getSelectedTemplates()));
    state.templatePicker.selected.clear();
    renderTemplateLibrary();
  }

  function getTaskSearchText(task) {
    const details = getTaskDetails(task);
    return [
      task.title,
      task.description,
      details?.description,
      ...(details?.explanation || []),
      ...(details?.instructions || []),
      ...(details?.materials || []).map((item) =>
        typeof item === "string"
          ? item
          : [item.label, item.blocks, item.href].join(" "),
      ),
      task.studentName,
      task.createdByName,
      TYPE_LABELS[task.type],
    ].join(" ");
  }

  function normalizeText(value) {
    return String(value ?? "")
      .trim()
      .toLocaleLowerCase("ru-RU")
      .replace(/ё/g, "е")
      .replace(/\s+/g, " ");
  }

  function toLocalInputValue(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function localInputToIso(value) {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
  }

  function formatDate(value) {
    if (!value) return t("без дедлайна");
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return t("без дедлайна");
    return date
      .toLocaleString(window.i18n?.locale || "ru-RU", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
      .replace(".", "");
  }

  function canMoveTask(task) {
    return isStaff() || task.studentId === state.user?.uid;
  }

  function canEditTask(task) {
    return isStaff() || task.studentId === state.user?.uid;
  }

  function canDeleteTask(task) {
    return isStaff() || task.studentId === state.user?.uid;
  }

  function syncRoleControls() {
    const staff = isStaff();
    document.body.classList.toggle("kanban-staff", staff);
    $("#kanban-create-btn").hidden = false;
    $("#kanban-student-filter-wrap").hidden = !staff;
    $("#kanban-my-students-wrap").hidden = !staff;
    $("#kanban-my-students").checked = state.filters.myStudentsOnly;

    if (!staff) {
      state.filters.studentId = "";
      state.filters.myStudentsOnly = false;
      $("#kanban-student-filter").value = "";
      $("#kanban-my-students").checked = false;
    }
  }

  function isOverdue(task) {
    if (
      !task.dueAt ||
      normalizeBoardStatus(task.boardStatus || task.status) === "done"
    )
      return false;
    const due = new Date(task.dueAt);
    return !Number.isNaN(due.getTime()) && due < new Date();
  }

  function normalizeBoardStatus(value) {
    const status = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_");
    if (status === "done" || status === "completed") return "done";
    if (status === "review" || status === "checking") return "review";
    if (status === "doing" || status === "in_progress") return "doing";
    return "todo";
  }

  function isOwnStudent(student) {
    if (!isStaff() || !state.filters.myStudentsOnly) return true;
    if (!student) return false;
    return (
      student.assignedStaffUid === state.user?.uid ||
      student.assignedMentorUid === state.user?.uid ||
      student.assignedCuratorUid === state.user?.uid
    );
  }

  function taskMatchesFilters(task) {
    // Staff results are already fully filtered by the callable endpoint before
    // pagination. Re-applying the ownership filter locally can hide valid tasks
    // when a compact directory entry changes while a page is open.
    if (isStaff()) return true;
    if (!isStaff() && task.studentId !== state.user?.uid) return false;
    if (state.filters.studentId && task.studentId !== state.filters.studentId)
      return false;
    if (state.filters.type && task.type !== state.filters.type) return false;

    if (isStaff() && state.filters.myStudentsOnly) {
      const student = state.usersById[task.studentId];
      if (!isOwnStudent(student)) return false;
    }

    const q = normalizeText(state.filters.query);
    if (!q) return true;
    const haystack = normalizeText(getTaskSearchText(task));
    return q.split(/\s+/).every((word) => haystack.includes(word));
  }

  function getVisibleTasks() {
    return state.tasks.filter(taskMatchesFilters);
  }

  function getMigrationQuery() {
    const params = new URLSearchParams(window.location.search);
    return normalizeText(params.get("migrateEventsFor") || "");
  }

  function getMigrationMode() {
    const params = new URLSearchParams(window.location.search);
    const allParam = normalizeText(params.get("migrateEvents") || "");
    const forParam = normalizeText(params.get("migrateEventsFor") || "");
    if (allParam === "all" || forParam === "all") return "all";
    return forParam ? "student" : "";
  }

  function findMigrationStudent(query) {
    if (!query) return null;
    return (
      state.students.find((student) => {
        const fields = [
          student.uid,
          student.displayName,
          student.email,
          student.telegram,
        ].map(normalizeText);
        return fields.some((field) => field === query);
      }) ||
      state.students.find((student) => {
        const fields = [
          student.uid,
          student.displayName,
          student.email,
          student.telegram,
        ].map(normalizeText);
        return fields.some((field) => field && field.includes(query));
      }) ||
      null
    );
  }

  function renderStudentOptions() {
    const filter = $("#kanban-student-filter");
    const modalStudent = $("#kanban-student");
    const selectedFilter = state.filters.studentId || filter.value;
    const selectedModal = modalStudent.value;
    const visibleStudents = state.students.filter(isOwnStudent).sort((a, b) =>
      a.displayName.localeCompare(b.displayName, "ru", {
        sensitivity: "base",
      }),
    );

    filter.innerHTML = `<option value="">${t("Все ученики")}</option>`;
    modalStudent.innerHTML = "";

    visibleStudents.forEach((student) => {
      filter.add(new Option(student.displayName, student.uid));
      modalStudent.add(new Option(student.displayName, student.uid));
    });

    if (visibleStudents.some((student) => student.uid === selectedFilter)) {
      filter.value = selectedFilter;
    }
    if (state.filters.studentId && filter.value !== state.filters.studentId) {
      /* Ученик выпал из списка (снова включили «Мои ученики») — сброс должен
         дойти и до localStorage, иначе он вернётся при следующем открытии. */
      state.filters.studentId = filter.value;
      rememberSelectedStudent(state.user?.uid, filter.value);
    }
    if (visibleStudents.some((student) => student.uid === selectedModal)) {
      modalStudent.value = selectedModal;
    }
  }

  function renderStats(tasks) {
    const summary = isStaff() ? state.pagination.summary : null;
    $("#kanban-stat-total").textContent = String(
      summary?.total ?? tasks.length,
    );
    $("#kanban-stat-own").textContent = String(
      summary?.own ??
        tasks.filter((task) => task.studentId === state.user?.uid).length,
    );
    $("#kanban-stat-overdue").textContent = String(
      summary?.overdue ?? tasks.filter(isOverdue).length,
    );
  }

  function getTaskTime(task) {
    const value =
      task.completedAt ||
      task.updatedAt ||
      task.dueAt ||
      task.endAt ||
      task.createdAt ||
      0;
    if (typeof value === "number") return value;
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? 0 : time;
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

  function getTaskSprintId(task) {
    return task.completedSprint || getSprintId(task.completedAt);
  }

  function formatSprintLabel(sprintId) {
    const start = new Date(`${sprintId}T00:00:00`);
    if (Number.isNaN(start.getTime())) return t("Без недели");
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const locale = window.i18n?.locale || "ru-RU";
    const day = (date) => date.toLocaleDateString(locale, { day: "numeric" });
    const month = (date) =>
      date.toLocaleDateString(locale, { month: "short" }).replace(".", "");
    const year = (date) => date.getFullYear();

    if (year(start) !== year(end)) {
      return `${day(start)} ${month(start)} ${year(start)} - ${day(end)} ${month(end)} ${year(end)}`;
    }
    if (start.getMonth() !== end.getMonth()) {
      return `${day(start)} ${month(start)} - ${day(end)} ${month(end)} ${year(end)}`;
    }
    return `${day(start)}-${day(end)} ${month(end)} ${year(end)}`;
  }

  function getDoneSprints(tasks) {
    const currentSprint = getSprintId();
    if (isStaff() && state.pagination.summary?.doneSprints) {
      return [
        ...new Set([
          currentSprint,
          state.filters.doneSprint,
          ...state.pagination.summary.doneSprints,
        ]),
      ]
        .filter(Boolean)
        .sort((a, b) => b.localeCompare(a));
    }
    const sprintIds = new Set([currentSprint, state.filters.doneSprint]);
    tasks.forEach((task) => {
      if (normalizeBoardStatus(task.boardStatus || task.status) !== "done")
        return;
      const sprintId = getTaskSprintId(task);
      if (sprintId) sprintIds.add(sprintId);
    });
    return [...sprintIds].filter(Boolean).sort((a, b) => b.localeCompare(a));
  }

  function sortTasksForColumn(tasks, columnId) {
    return [...tasks].sort((a, b) => {
      if (columnId === "done") return getTaskTime(b) - getTaskTime(a);
      const aDue = a.dueAt
        ? new Date(a.dueAt).getTime()
        : Number.MAX_SAFE_INTEGER;
      const bDue = b.dueAt
        ? new Date(b.dueAt).getTime()
        : Number.MAX_SAFE_INTEGER;
      return aDue - bDue || getTaskTime(b) - getTaskTime(a);
    });
  }

  function renderCard(task) {
    const owned = task.studentId === state.user?.uid;
    const movable = canMoveTask(task);
    const overdue = isOverdue(task);
    const type = task.type || "assignment";
    const studentName =
      task.studentName ||
      state.usersById[task.studentId]?.displayName ||
      t("Ученик {id}", { id: String(task.studentId || "").slice(0, 6) });
    return `
      <article
        class="kanban-card ${movable ? "" : "is-locked"}"
        style="--card-accent: ${TYPE_ACCENTS[type] || TYPE_ACCENTS.assignment}"
        data-task-id="${escapeHtml(task.id)}"
        draggable="${movable ? "true" : "false"}"
        tabindex="0"
      >
        <h3 class="kanban-card-title">${escapeHtml(task.title || t("Без названия"))}</h3>
        <div class="kanban-card-meta">
          <span class="kanban-pill ${owned ? "is-own" : ""}">${escapeHtml(studentName)}</span>
          <span class="kanban-pill">${escapeHtml(TYPE_LABELS[type] || t("Задача"))}</span>
        </div>
        <div class="kanban-card-badges">
          <span class="kanban-pill ${overdue ? "is-overdue" : ""}">${escapeHtml(formatDate(task.dueAt))}</span>
          ${movable ? "" : `<span class="kanban-pill">${t("только просмотр")}</span>`}
        </div>
      </article>
    `;
  }

  function renderColumn(column, visibleTasks) {
    const allColumnTasks = sortTasksForColumn(
      visibleTasks.filter(
        (task) =>
          normalizeBoardStatus(task.boardStatus || task.status) === column.id,
      ),
      column.id,
    );
    const columnTasks =
      column.id === "done"
        ? allColumnTasks.filter(
            (task) => getTaskSprintId(task) === state.filters.doneSprint,
          )
        : allColumnTasks;
    const isExpanded = !!state.expandedColumns[column.id];
    const totalForColumn = isStaff()
      ? Number(
          state.pagination.summary?.columns?.[column.id] ?? columnTasks.length,
        )
      : columnTasks.length;
    const hiddenCount = isExpanded
      ? 0
      : Math.max(0, columnTasks.length - COLUMN_PREVIEW_LIMIT);
    const tasks = isExpanded
      ? columnTasks
      : columnTasks.slice(0, COLUMN_PREVIEW_LIMIT);
    const columnToggle =
      columnTasks.length > COLUMN_PREVIEW_LIMIT
        ? `<button class="kanban-show-more" type="button" data-action="toggle-column" data-column-id="${escapeHtml(column.id)}">${
            isExpanded
              ? t("Скрыть старые")
              : t("Показать все ({count})", { count: hiddenCount })
          }</button>`
        : "";

    return `
      <section class="kanban-column" data-column="${column.id}">
        <header class="kanban-column-header">
          <h2 class="kanban-column-title">${escapeHtml(column.title)}</h2>
          <span class="kanban-column-count">${totalForColumn}</span>
        </header>
        ${
          column.id === "done"
            ? `<label class="kanban-done-sprint-field">
                <span>${t("Неделя завершения")}</span>
                <select data-done-sprint>
                  ${getDoneSprints(visibleTasks)
                    .map(
                      (sprintId) =>
                        `<option value="${escapeHtml(sprintId)}" ${
                          sprintId === state.filters.doneSprint
                            ? "selected"
                            : ""
                        }>${escapeHtml(formatSprintLabel(sprintId))}</option>`,
                    )
                    .join("")}
                </select>
              </label>`
            : ""
        }
        <div class="kanban-column-body" data-column-body="${column.id}">
          ${tasks.length ? tasks.map(renderCard).join("") : `<div class="kanban-empty">${t("Пусто")}</div>`}
          ${columnToggle}
        </div>
      </section>
    `;
  }

  function renderPagination() {
    const pagination = $("#kanban-pagination");
    const status = $("#kanban-pagination-status");
    const loadMore = $("#kanban-load-more-btn");
    if (!pagination || !status || !loadMore) return;
    if (!isStaff()) {
      pagination.hidden = true;
      return;
    }
    const summary = state.pagination.summary;
    const visibleTotal = Number(summary?.visibleTotal ?? state.tasks.length);
    const shown = Math.min(state.tasks.length, visibleTotal);
    const remaining = Math.max(0, visibleTotal - shown);
    pagination.hidden = !state.pagination.isLoading && !summary;
    status.textContent = state.pagination.isLoading
      ? t("Загрузка задач…")
      : t("Показано {shown} из {visible} на доске · всего {total} задач", {
          shown,
          visible: visibleTotal,
          total: Number(summary?.total ?? 0),
        });
    loadMore.hidden = state.pagination.nextOffset === null;
    loadMore.disabled =
      state.pagination.isLoading || state.pagination.nextOffset === null;
    loadMore.textContent = t("Загрузить ещё ({count})", {
      count: Math.min(100, remaining),
    });
  }

  function renderBoard() {
    const board = $("#kanban-board");
    const visibleTasks = getVisibleTasks();
    if (!state.filters.doneSprint) state.filters.doneSprint = getSprintId();
    renderStats(visibleTasks);

    board.innerHTML = BOARD_COLUMNS.map((column) =>
      renderColumn(column, visibleTasks),
    ).join("");
    renderPagination();
  }

  function showAccess(message) {
    const access = $("#kanban-access");
    access.textContent = message;
    access.hidden = !message;
  }

  function getBoardStatusFromEvent(event) {
    return normalizeBoardStatus(event.status);
  }

  function normalizeEventType(type) {
    if (TYPE_LABELS[type]) return type;
    if (type === "task") return "assignment";
    return "assignment";
  }

  function getMigratedTaskTitle(event) {
    const fallback = String(event.description || "")
      .split(/\r?\n/)
      .map((line) => line.replace(/[#*_`>-]/g, "").trim())
      .find(Boolean);
    return String(event.title || fallback || t("Событие")).slice(0, 140);
  }

  function buildTaskFromEvent(event, eventId, student, fallbackStaff) {
    const boardStatus = getBoardStatusFromEvent(event);
    const details = event.details || parseLegacyDetails(event.description);
    return {
      title: getMigratedTaskTitle(event),
      type: normalizeEventType(event.type),
      status: boardStatus === "done" ? "done" : "open",
      boardStatus,
      startAt: event.startAt || "",
      dueAt: event.dueAt || event.endAt || "",
      endAt: event.endAt || event.dueAt || "",
      completedAt:
        boardStatus === "done"
          ? event.completedAt ||
            event.updatedAt ||
            event.dueAt ||
            event.endAt ||
            ""
          : "",
      studentId: event.studentId || student?.uid || "",
      studentName:
        student?.displayName ||
        event.studentName ||
        String(event.studentId || "").slice(0, 6),
      description: event.description || "",
      details: details || null,
      roadmapMilestoneId: event.roadmapMilestoneId || "",
      roadmapWeek: event.roadmapWeek || "",
      feedbackId: event.feedbackId || "",
      source: "events-migration",
      sourceEventId: eventId,
      legacyEventType: event.type || "",
      mockInterview: event.mockInterview || null,
      submissions: event.submissions || null,
      createdAt: event.createdAt || firebase.database.ServerValue.TIMESTAMP,
      updatedAt: event.updatedAt || firebase.database.ServerValue.TIMESTAMP,
      migratedAt: firebase.database.ServerValue.TIMESTAMP,
      createdBy: event.createdBy || fallbackStaff.uid,
      createdByName:
        event.createdByName ||
        fallbackStaff.displayName ||
        fallbackStaff.email ||
        "",
    };
  }

  async function migrateEventsForStudent(student) {
    if (!isStaff() || !student?.uid || !state.db) return;
    showAccess(
      t("Мигрирую события ученика {name}...", { name: student.displayName }),
    );

    const [eventsSnapshot, tasksSnapshot] = await Promise.all([
      state.db
        .ref("events")
        .orderByChild("studentId")
        .equalTo(student.uid)
        .once("value"),
      state.db
        .ref("kanbanTasks")
        .orderByChild("studentId")
        .equalTo(student.uid)
        .once("value"),
    ]);

    const migratedEventIds = new Set();
    tasksSnapshot.forEach((child) => {
      const task = child.val() || {};
      if (task.sourceEventId) migratedEventIds.add(task.sourceEventId);
    });

    const updates = {};
    let scanned = 0;
    let created = 0;
    let skipped = 0;

    eventsSnapshot.forEach((child) => {
      const event = child.val() || {};
      if (event.studentId !== student.uid) return;
      scanned += 1;
      if (migratedEventIds.has(child.key)) {
        skipped += 1;
        return;
      }

      const boardStatus = getBoardStatusFromEvent(event);
      const taskId = state.db.ref("kanbanTasks").push().key;
      const details = event.details || parseLegacyDetails(event.description);
      updates[`kanbanTasks/${taskId}`] = {
        title: getMigratedTaskTitle(event),
        type: normalizeEventType(event.type),
        status: boardStatus === "done" ? "done" : "open",
        boardStatus,
        startAt: event.startAt || "",
        dueAt: event.dueAt || event.endAt || "",
        endAt: event.endAt || event.dueAt || "",
        studentId: student.uid,
        studentName:
          student.displayName || event.studentName || student.uid.slice(0, 6),
        description: event.description || "",
        details: details || null,
        roadmapMilestoneId: event.roadmapMilestoneId || "",
        roadmapWeek: event.roadmapWeek || "",
        source: "events-migration",
        sourceEventId: child.key,
        legacyEventType: event.type || "",
        mockInterview: event.mockInterview || null,
        submissions: event.submissions || null,
        createdAt: event.createdAt || firebase.database.ServerValue.TIMESTAMP,
        updatedAt: firebase.database.ServerValue.TIMESTAMP,
        migratedAt: firebase.database.ServerValue.TIMESTAMP,
        createdBy: event.createdBy || state.user.uid,
        createdByName:
          event.createdByName ||
          state.user.displayName ||
          state.user.email ||
          "",
      };
      created += 1;
    });

    if (created > 0) {
      await state.db.ref().update(updates);
    }

    showAccess(
      t(
        "Миграция {name}: найдено {scanned}, создано {created}, пропущено дублей {skipped}.",
        {
          name: student.displayName,
          scanned,
          created,
          skipped,
        },
      ),
    );
  }

  async function migrateAllEvents() {
    if (!isStaff() || !state.db) return;
    showAccess(t("Мигрирую все события из events в канбан..."));

    const [eventsSnapshot, tasksSnapshot, usersSnapshot] = await Promise.all([
      state.db.ref("events").once("value"),
      state.db.ref("kanbanTasks").once("value"),
      state.db.ref("users").once("value"),
    ]);

    const usersById = {};
    usersSnapshot.forEach((child) => {
      const user = child.val() || {};
      usersById[child.key] = {
        uid: child.key,
        displayName: user.displayName || user.email || child.key.slice(0, 6),
        email: user.email || "",
        telegram:
          user.telegram ||
          user.telegramUsername ||
          user.telegram_username ||
          user.tg ||
          "",
      };
    });

    const migratedEventIds = new Set();
    tasksSnapshot.forEach((child) => {
      const task = child.val() || {};
      if (task.sourceEventId) migratedEventIds.add(task.sourceEventId);
    });

    const updates = {};
    let scanned = 0;
    let created = 0;
    let skipped = 0;
    let withoutStudent = 0;

    eventsSnapshot.forEach((child) => {
      const event = child.val() || {};
      scanned += 1;
      if (!event.studentId) {
        withoutStudent += 1;
        return;
      }
      if (migratedEventIds.has(child.key)) {
        skipped += 1;
        return;
      }
      const taskId = state.db.ref("kanbanTasks").push().key;
      updates[`kanbanTasks/${taskId}`] = buildTaskFromEvent(
        event,
        child.key,
        usersById[event.studentId],
        state.user,
      );
      created += 1;
    });

    if (created > 0) {
      await state.db.ref().update(updates);
    }

    showAccess(
      t(
        "Миграция всех events: найдено {scanned}, создано {created}, пропущено дублей {skipped}, без studentId {withoutStudent}.",
        { scanned, created, skipped, withoutStudent },
      ),
    );
  }

  async function runMigrationFromUrl() {
    if (state.migrationRan) return;
    const mode = getMigrationMode();
    if (!mode) return;
    const query = getMigrationQuery();
    state.migrationRan = true;

    if (!isStaff()) {
      return;
    }

    if (mode === "all") {
      try {
        await migrateAllEvents();
      } catch (error) {
        showAccess(
          t("Не удалось выполнить общую миграцию: {error}", {
            error: error.message,
          }),
        );
      }
      return;
    }

    const student = findMigrationStudent(query);
    if (!student) {
      showAccess(t("Не нашёл ученика для миграции: {query}", { query }));
      return;
    }

    try {
      await migrateEventsForStudent(student);
    } catch (error) {
      showAccess(
        t("Не удалось выполнить миграцию: {error}", { error: error.message }),
      );
    }
  }

  function showFormStatus(message) {
    $("#kanban-form-status").textContent = message || "";
  }

  function getStudentName(studentId) {
    if (state.usersById[studentId]?.displayName)
      return state.usersById[studentId].displayName;
    if (studentId === state.user?.uid)
      return (
        state.user.displayName ||
        state.user.email ||
        (window.i18n?.lang === "en" ? "Me" : "Я")
      );
    return t("Ученик {id}", { id: String(studentId || "").slice(0, 6) });
  }

  function openModal(task = null) {
    const modal = $("#kanban-modal");
    const isEdit = !!task;
    $("#kanban-form").reset();
    showFormStatus("");
    $("#kanban-task-id").value = task?.id || "";
    $("#kanban-modal-title").textContent = isEdit
      ? t("Карточка задачи")
      : t("Новая карточка");
    $("#kanban-modal-kicker").textContent = isEdit
      ? t("Редактирование")
      : t("Создание");
    $("#kanban-title").value = task?.title || "";
    $("#kanban-type").value = task?.type || "assignment";
    $("#kanban-status").value = task?.boardStatus || task?.status || "todo";
    $("#kanban-due").value = toLocalInputValue(task?.dueAt);
    $("#kanban-description").value = task?.description || "";
    $("#kanban-student").value = task?.studentId || state.user?.uid || "";
    const taskDetails = getTaskDetails(task) || {
      description: task?.description || "",
      explanation: [],
      materials: [],
      instructions: [],
    };
    const detailsHtml = isEdit ? renderDetailsPreview(task) : "";
    const detailsPreview = $("#kanban-details-preview");
    const descriptionEditor = $("#kanban-description-editor");
    const detailsEditor = $("#kanban-details-editor");
    const livePreview = $("#kanban-details-live-preview");
    $("#kanban-details-description").value = taskDetails.description || "";
    $("#kanban-details-explanation").value = (
      taskDetails.explanation || []
    ).join("\n");
    $("#kanban-details-materials").value = (taskDetails.materials || [])
      .map(materialToEditorLine)
      .join("\n");
    $("#kanban-details-instructions").value = (
      taskDetails.instructions || []
    ).join("\n");
    detailsPreview.innerHTML = detailsHtml;

    const readonly = isEdit && !canEditTask(task);
    const staffControls = isStaff();
    detailsEditor.hidden = readonly || !staffControls;
    livePreview.hidden = readonly || !staffControls;
    detailsPreview.hidden = staffControls || !detailsHtml;
    descriptionEditor.hidden =
      staffControls || (!!detailsHtml && !staffControls);
    $("#kanban-title").disabled = readonly || (!staffControls && isEdit);
    $("#kanban-type").disabled = readonly || !staffControls;
    $("#kanban-student").disabled = readonly || !staffControls;
    $("#kanban-due").disabled = readonly || !staffControls;
    $("#kanban-description").disabled = readonly || (!staffControls && isEdit);
    $("#kanban-details-description").disabled = readonly || !staffControls;
    $("#kanban-details-explanation").disabled = readonly || !staffControls;
    $("#kanban-details-materials").disabled = readonly || !staffControls;
    $("#kanban-details-instructions").disabled = readonly || !staffControls;
    $("#kanban-status").disabled = readonly;
    $("#kanban-save").hidden = readonly;
    $("#kanban-delete").hidden = !isEdit || !canDeleteTask(task);
    state.templatePicker.selected.clear();
    renderTemplateLibrary();
    updateDetailsLivePreview();

    if (typeof modal.showModal === "function") modal.showModal();
    else modal.setAttribute("open", "");
  }

  function closeModal() {
    const modal = $("#kanban-modal");
    if (modal.open && typeof modal.close === "function") modal.close();
    else modal.removeAttribute("open");
  }

  async function saveTask(event) {
    event.preventDefault();
    if (!state.db || !state.user) return;
    const taskId = $("#kanban-task-id").value;
    const studentId = $("#kanban-student").value;
    const boardStatus = $("#kanban-status").value;
    const now = firebase.database.ServerValue.TIMESTAMP;

    if (!studentId) {
      showFormStatus(t("Выбери ученика."));
      return;
    }

    const existing = taskId
      ? state.tasks.find((task) => task.id === taskId)
      : null;
    if (existing && !canEditTask(existing)) {
      showFormStatus(t("Эту карточку можно только смотреть."));
      return;
    }

    const payload = {
      boardStatus,
      status: boardStatus === "done" ? "done" : "open",
      updatedAt: now,
    };

    if (!taskId || isStaff()) {
      const details = isStaff() ? getDetailsFromEditor() : null;
      const description = details
        ? buildDetailsDescription(details)
        : $("#kanban-description").value.trim();
      const title =
        $("#kanban-title").value.trim() ||
        stripMarkdown(details?.description || description).slice(0, 140);
      Object.assign(payload, {
        title,
        type: $("#kanban-type").value,
        dueAt: localInputToIso($("#kanban-due").value),
        studentId,
        studentName: getStudentName(studentId),
        description,
        details,
      });
    }

    if (!payload.title && (!taskId || isStaff())) {
      showFormStatus(t("Добавь название карточки."));
      return;
    }

    if (taskId) {
      if (boardStatus === "done") {
        payload.completedAt = existing?.completedAt || now;
        payload.completedSprint =
          state.filters.doneSprint ||
          getTaskSprintId(existing) ||
          getSprintId();
      } else if (existing?.completedAt || existing?.completedSprint) {
        payload.completedAt = null;
        payload.completedSprint = null;
      }
      if (window.achievementApi)
        await window.achievementApi.saveKanbanTask(taskId, payload);
      else await state.db.ref(`kanbanTasks/${taskId}`).update(payload);
    } else {
      const nextTask = {
        ...payload,
        completedAt: boardStatus === "done" ? now : null,
        completedSprint:
          boardStatus === "done"
            ? state.filters.doneSprint || getSprintId()
            : null,
        source: "manual",
        createdAt: now,
        createdByName: state.user.displayName || state.user.email || "",
      };
      if (window.achievementApi)
        await window.achievementApi.saveKanbanTask("", nextTask);
      else {
        const ref = state.db.ref("kanbanTasks").push();
        await ref.set({ ...nextTask, createdBy: state.user.uid });
      }
    }
    closeModal();
    if (isStaff()) await reloadStaffTasks({ force: true });
  }

  async function deleteCurrentTask() {
    const taskId = $("#kanban-task-id").value;
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task || !canDeleteTask(task)) return;
    if (window.achievementApi)
      await window.achievementApi.deleteKanbanTask(taskId);
    else await state.db.ref(`kanbanTasks/${taskId}`).remove();
    closeModal();
    if (isStaff()) await reloadStaffTasks({ force: true });
  }

  async function moveTask(taskId, nextStatus) {
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task || !canMoveTask(task)) return;
    const patch = {
      boardStatus: nextStatus,
      status: nextStatus === "done" ? "done" : "open",
      completedAt:
        nextStatus === "done" ? firebase.database.ServerValue.TIMESTAMP : null,
      completedSprint:
        nextStatus === "done"
          ? state.filters.doneSprint || getSprintId()
          : null,
      updatedAt: firebase.database.ServerValue.TIMESTAMP,
    };
    if (window.achievementApi)
      await window.achievementApi.saveKanbanTask(taskId, patch);
    else await state.db.ref(`kanbanTasks/${taskId}`).update(patch);
    if (isStaff()) await reloadStaffTasks({ force: true });
  }

  async function loadStudents() {
    state.students = [];
    state.usersById = {};
    if (isStaff()) {
      if (!window.achievementApi)
        throw new Error(t("Сервис сотрудников недоступен."));
      const directory = await window.achievementApi.getStaffDirectory();
      directory.forEach((user) => {
        const role = normalizeRole(user.role);
        if (STAFF_ROLES.has(role) || user.status === "departed") return;
        const student = {
          uid: user.uid,
          displayName: user.displayName || user.email || user.uid.slice(0, 6),
          email: user.email || "",
          telegram:
            user.telegram ||
            user.telegramUsername ||
            user.telegram_username ||
            user.tg ||
            "",
          assignedStaffUid: user.assignedStaffUid || "",
          assignedMentorUid: user.assignedMentorUid || "",
          assignedCuratorUid: user.assignedCuratorUid || "",
        };
        state.students.push(student);
        state.usersById[student.uid] = student;
      });
      state.students.sort((a, b) =>
        a.displayName.localeCompare(b.displayName, "ru", {
          sensitivity: "base",
        }),
      );
      if (!state.filters.studentId)
        state.filters.studentId = readSelectedStudent(state.user?.uid);
      /* Ученик, выбранный на учебном плане, может быть не «моим» — иначе
         фильтр молча сбросил бы его в «Все ученики». */
      const requested = state.usersById[state.filters.studentId];
      if (requested && !isOwnStudent(requested)) {
        state.filters.myStudentsOnly = false;
        $("#kanban-my-students").checked = false;
      }
    } else {
      const user = state.user;
      const snapshot = await state.db.ref(`users/${user.uid}`).once("value");
      const data = snapshot.val() || {};
      const student = {
        uid: user.uid,
        displayName:
          data.displayName ||
          user.displayName ||
          user.email ||
          (window.i18n?.lang === "en" ? "Me" : "Я"),
        email: data.email || user.email || "",
        telegram:
          data.telegram ||
          data.telegramUsername ||
          data.telegram_username ||
          data.tg ||
          "",
      };
      state.students = [student];
      state.usersById[user.uid] = student;
    }
    renderStudentOptions();
  }

  async function loadTaskTemplates() {
    try {
      const response = await fetch("/assets/data/calendar-templates.json");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const templates = await response.json();
      state.templates = Array.isArray(templates) ? templates : [];
    } catch (error) {
      console.warn(
        "Не удалось загрузить шаблоны календаря для канбана:",
        error,
      );
      state.templates = [];
    }
  }

  function subscribeTasks() {
    if (isStaff()) {
      loadStaffTasks().catch((error) =>
        showAccess(
          t("Не удалось загрузить доску: {error}", { error: error.message }),
        ),
      );
      return;
    }
    state.db
      .ref("kanbanTasks")
      .orderByChild("studentId")
      .equalTo(state.user.uid)
      .on(
        "value",
        (snapshot) => {
          const tasks = [];
          snapshot.forEach((child) => {
            const task = child.val() || {};
            tasks.push({
              id: child.key,
              ...task,
              boardStatus: normalizeBoardStatus(
                task.boardStatus || task.status,
              ),
            });
          });
          tasks.sort((a, b) => {
            const aDue = a.dueAt
              ? new Date(a.dueAt).getTime()
              : Number.MAX_SAFE_INTEGER;
            const bDue = b.dueAt
              ? new Date(b.dueAt).getTime()
              : Number.MAX_SAFE_INTEGER;
            return aDue - bDue || (b.createdAt || 0) - (a.createdAt || 0);
          });
          state.tasks = tasks;
          renderBoard();
        },
        (error) => {
          if (
            error &&
            (error.code === "PERMISSION_DENIED" ||
              error.code === "permission_denied")
          ) {
            showAccess(
              t(
                "Доска задач пока недоступна: нужно задеплоить Firebase rules для kanbanTasks.",
              ),
            );
            return;
          }
          showAccess(
            t("Не удалось загрузить доску: {error}", { error: error.message }),
          );
        },
      );
  }

  function getStaffTaskRequest() {
    if (!state.filters.doneSprint) state.filters.doneSprint = getSprintId();
    return {
      studentId: state.filters.studentId || "",
      assignedOnly: state.filters.myStudentsOnly === true,
      type: state.filters.type || "",
      query: state.filters.query || "",
      doneSprint: state.filters.doneSprint,
      limit: 100,
    };
  }

  function addUniqueTasks(current, next) {
    const byId = new Map(current.map((task) => [task.id, task]));
    (next || []).forEach((task) => byId.set(task.id, task));
    return [...byId.values()];
  }

  async function loadStaffTasks({ append = false, force = false } = {}) {
    if (!window.achievementApi) throw new Error(t("Сервис задач недоступен."));
    const request = getStaffTaskRequest();
    const queryKey = JSON.stringify(request);
    const pagination = state.pagination;
    if (append && (pagination.isLoading || pagination.nextOffset === null))
      return;
    if (
      !append &&
      !force &&
      !pagination.isLoading &&
      pagination.loadedQueryKey === queryKey
    )
      return;

    const requestVersion = ++pagination.requestVersion;
    const offset = append ? pagination.nextOffset : 0;
    if (!append) {
      state.tasks = [];
      state.expandedColumns = {};
      pagination.nextOffset = null;
      pagination.total = 0;
      pagination.summary = null;
      pagination.loadedQueryKey = "";
    }
    pagination.isLoading = true;
    renderBoard();

    try {
      const result = await window.achievementApi.listKanbanTasks({
        ...request,
        offset,
      });
      if (requestVersion !== pagination.requestVersion) return;
      state.tasks = append
        ? addUniqueTasks(state.tasks, result.items)
        : result.items || [];
      pagination.nextOffset = result.nextOffset ?? null;
      pagination.total = Number(result.total || 0);
      pagination.summary = result.summary || {
        total: pagination.total,
        own: 0,
        overdue: 0,
        columns: {},
        doneSprints: [],
        visibleTotal: state.tasks.length,
      };
      pagination.loadedQueryKey = queryKey;
    } catch (error) {
      if (requestVersion !== pagination.requestVersion) return;
      throw error;
    } finally {
      if (requestVersion === pagination.requestVersion) {
        pagination.isLoading = false;
        renderBoard();
      }
    }
  }

  function reloadStaffTasks(options) {
    if (!isStaff()) return Promise.resolve();
    return loadStaffTasks(options).catch((error) => {
      showAccess(
        t("Не удалось загрузить задачи: {error}", { error: error.message }),
      );
    });
  }

  function bindEvents() {
    $("#kanban-create-btn").addEventListener("click", () => openModal());
    $("#kanban-refresh-btn").addEventListener("click", () => {
      reloadStaffTasks({ force: true });
    });
    $("#kanban-modal-close").addEventListener("click", closeModal);
    document
      .querySelector("[data-close-modal]")
      .addEventListener("click", closeModal);
    $("#kanban-modal").addEventListener("click", (event) => {
      if (event.target === event.currentTarget) closeModal();
    });
    $("#kanban-form").addEventListener("submit", saveTask);
    $("#kanban-delete").addEventListener("click", deleteCurrentTask);
    [
      "#kanban-details-description",
      "#kanban-details-explanation",
      "#kanban-details-materials",
      "#kanban-details-instructions",
    ].forEach((selector) => {
      $(selector)?.addEventListener("input", updateDetailsLivePreview);
    });
    $("#kanban-template-search")?.addEventListener("input", (event) => {
      state.templatePicker.query = event.target.value;
      renderTemplateLibrary();
    });
    $("#kanban-template-tabs")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-template-tab]");
      if (!button) return;
      state.templatePicker.tab = button.dataset.templateTab || "theory";
      renderTemplateLibrary();
    });
    $("#kanban-template-list")?.addEventListener("click", (event) => {
      const addButton = event.target.closest("[data-template-add]");
      if (addButton) {
        insertTemplateMaterial(addButton.dataset.templateAdd);
        return;
      }
      const checkbox = event.target.closest("[data-template-check]");
      if (!checkbox) return;
      const id = checkbox.dataset.templateCheck;
      if (checkbox.checked) state.templatePicker.selected.add(id);
      else state.templatePicker.selected.delete(id);
      renderTemplateLibrary();
    });
    $("#kanban-template-add-selected")?.addEventListener("click", () => {
      insertSelectedTemplateMaterials();
    });
    $("#kanban-template-collapse")?.addEventListener("click", () => {
      state.templatePicker.collapsed = !state.templatePicker.collapsed;
      renderTemplateLibrary();
    });

    $("#kanban-search").addEventListener("input", (event) => {
      state.filters.query = event.target.value;
      if (!isStaff()) {
        renderBoard();
        return;
      }
      clearTimeout(state.pagination.searchTimer);
      state.pagination.searchTimer = setTimeout(() => reloadStaffTasks(), 350);
    });
    $("#kanban-student-filter").addEventListener("change", (event) => {
      state.filters.studentId = event.target.value;
      rememberSelectedStudent(state.user?.uid, state.filters.studentId);
      if (isStaff()) reloadStaffTasks();
      else renderBoard();
    });
    $("#kanban-type-filter").addEventListener("change", (event) => {
      state.filters.type = event.target.value;
      if (isStaff()) reloadStaffTasks();
      else renderBoard();
    });
    $("#kanban-my-students").addEventListener("change", (event) => {
      state.filters.myStudentsOnly = event.target.checked;
      renderStudentOptions();
      if (isStaff()) reloadStaffTasks();
      else renderBoard();
    });
    $("#kanban-load-more-btn").addEventListener("click", () => {
      reloadStaffTasks({ append: true });
    });

    $("#kanban-board").addEventListener("click", (event) => {
      const action = event.target.closest("[data-action]");
      if (action?.dataset.action === "toggle-column") {
        const columnId = action.dataset.columnId;
        state.expandedColumns[columnId] = !state.expandedColumns[columnId];
        renderBoard();
        return;
      }
      const card = event.target.closest(".kanban-card");
      if (!card) return;
      const task = state.tasks.find((item) => item.id === card.dataset.taskId);
      if (task) openModal(task);
    });
    $("#kanban-board").addEventListener("change", (event) => {
      const sprintSelect = event.target.closest("[data-done-sprint]");
      if (!sprintSelect) return;
      state.filters.doneSprint = sprintSelect.value;
      if (isStaff()) reloadStaffTasks();
      else renderBoard();
    });
    $("#kanban-board").addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      const card = event.target.closest(".kanban-card");
      if (!card) return;
      const task = state.tasks.find((item) => item.id === card.dataset.taskId);
      if (task) openModal(task);
    });
    $("#kanban-board").addEventListener("dragstart", (event) => {
      const card = event.target.closest(".kanban-card");
      if (!card || card.getAttribute("draggable") !== "true") return;
      card.classList.add("is-dragging");
      event.dataTransfer.setData("text/plain", card.dataset.taskId);
      event.dataTransfer.effectAllowed = "move";
    });
    $("#kanban-board").addEventListener("dragend", (event) => {
      event.target.closest(".kanban-card")?.classList.remove("is-dragging");
      document
        .querySelectorAll(".kanban-column.is-over")
        .forEach((column) => column.classList.remove("is-over"));
    });
    $("#kanban-board").addEventListener("dragover", (event) => {
      const column = event.target.closest(".kanban-column");
      if (!column) return;
      event.preventDefault();
      column.classList.add("is-over");
    });
    $("#kanban-board").addEventListener("dragleave", (event) => {
      const column = event.target.closest(".kanban-column");
      if (column && !column.contains(event.relatedTarget)) {
        column.classList.remove("is-over");
      }
    });
    $("#kanban-board").addEventListener("drop", (event) => {
      const column = event.target.closest(".kanban-column");
      if (!column) return;
      event.preventDefault();
      column.classList.remove("is-over");
      const taskId = event.dataTransfer.getData("text/plain");
      moveTask(taskId, column.dataset.column).catch((error) => {
        showAccess(
          t("Не удалось переместить карточку: {error}", {
            error: error.message,
          }),
        );
      });
    });
  }

  async function initializeFirebase() {
    const config = window.configLoader
      ? await window.configLoader.loadFirebaseConfig()
      : await fetch("/config/firebase-config.json").then((response) =>
          response.json(),
        );
    if (!firebase.apps.length) firebase.initializeApp(config);
    state.auth = firebase.auth();
    state.db = firebase.database();
  }

  async function initializeUser(user) {
    state.user = user;
    if (!user) {
      showAccess(t("Нужно войти в аккаунт, чтобы открыть доску."));
      return;
    }
    const roleSnap = await state.db.ref(`users/${user.uid}/role`).once("value");
    state.role = normalizeRole(roleSnap.val());
    syncRoleControls();
    $("#kanban-refresh-btn").hidden = !isStaff();
    await Promise.all([loadStudents(), loadTaskTemplates()]);
    subscribeTasks();
    renderBoard();
    await runMigrationFromUrl();
  }

  document.addEventListener("DOMContentLoaded", async () => {
    bindEvents();
    renderBoard();
    try {
      await initializeFirebase();
      state.auth.onAuthStateChanged((user) => {
        initializeUser(user).catch((error) => {
          showAccess(
            t("Не удалось инициализировать доску: {error}", {
              error: error.message,
            }),
          );
        });
      });
    } catch (error) {
      showAccess(
        t("Не удалось подключиться к Firebase: {error}", {
          error: error.message,
        }),
      );
    }
  });
})();
