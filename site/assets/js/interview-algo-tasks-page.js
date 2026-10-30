(() => {
  "use strict";

  const PAGE_SIZE = 5;
  const api = window.InterviewAlgoTasks;

  let database = null;
  let tasks = [];
  let visibleCount = PAGE_SIZE;
  let isMentor = false;
  const details = new Map();
  const filters = { companyId: "all", difficulty: "all", approach: "all" };

  const $ = (selector) => document.querySelector(selector);

  // Filters stay visible only when they are actionable — hiding them on an
  // error or an empty bank avoids offering controls that cannot change anything.
  function setState(title, message, keepFilters = false) {
    const list = $("#algoTasksList");
    if (!list) return;
    const block = document.createElement("div");
    block.className = "interview-algo-state";
    const heading = document.createElement("p");
    heading.className = "interview-algo-state-title";
    heading.textContent = title;
    const description = document.createElement("p");
    description.textContent = message;
    block.append(heading, description);
    list.replaceChildren(block);
    $("#algoTasksPagination").hidden = true;
    $("#algoTasksFilters").hidden = !keepFilters;
    $("#algoTasksSummary").textContent = "";
  }

  // Mentor-authored text is rendered as plain text with two conveniences:
  // blank lines split paragraphs and `backticks` become inline code. Nothing is
  // ever passed to innerHTML, so authored markup cannot inject HTML.
  function renderCondition(text) {
    const wrap = document.createDocumentFragment();
    String(text || "")
      .split(/\n{2,}/)
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach((paragraph) => {
        const node = document.createElement("p");
        paragraph.split(/(`[^`]+`)/).forEach((chunk, index) => {
          if (!chunk) return;
          if (index % 2 === 1) {
            const code = document.createElement("code");
            code.textContent = chunk.slice(1, -1);
            node.append(code);
            return;
          }
          chunk.split("\n").forEach((line, lineIndex) => {
            if (lineIndex) node.append(document.createElement("br"));
            node.append(document.createTextNode(line));
          });
        });
        wrap.append(node);
      });
    return wrap;
  }

  function badge(className, text) {
    const span = document.createElement("span");
    span.className = className;
    span.textContent = text;
    return span;
  }

  function buildCard(task, detail) {
    const card = document.createElement("article");
    card.className = "interview-algo-card";

    const header = document.createElement("div");
    header.className = "interview-algo-card-header";

    const titleRow = document.createElement("div");
    titleRow.className = "interview-algo-card-title-row";
    const title = document.createElement("h3");
    title.className = "interview-algo-card-title";
    title.textContent = task.title;
    titleRow.append(title);

    if (isMentor) {
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "interview-algo-edit-btn";
      edit.textContent = "Редактировать";
      edit.addEventListener("click", () => openModal(task.id));
      titleRow.append(edit);
    }

    const meta = document.createElement("div");
    meta.className = "interview-algo-card-meta";
    meta.append(
      badge(
        "interview-algo-card-badge interview-algo-card-badge-company",
        task.company,
      ),
      badge(
        `leetcode-difficulty leetcode-difficulty--${task.difficulty}`,
        task.difficulty.charAt(0).toUpperCase() + task.difficulty.slice(1),
      ),
    );
    task.approaches.forEach((id) => {
      meta.append(
        badge(
          "interview-algo-card-badge interview-algo-card-badge-approach",
          api.approachLabel(id),
        ),
      );
    });

    header.append(titleRow, meta);
    card.append(header);

    const condition = document.createElement("div");
    condition.className = "interview-algo-card-condition";
    const conditionTitle = document.createElement("p");
    conditionTitle.className = "interview-algo-card-condition-title";
    conditionTitle.textContent = "Условие";
    condition.append(conditionTitle);

    const solutionWrap = document.createElement("div");
    solutionWrap.className = "interview-algo-card-solution-wrap";
    const solutionTitle = document.createElement("p");
    solutionTitle.className = "interview-algo-card-solution-title";
    solutionTitle.textContent = "Решение";
    solutionWrap.append(solutionTitle);

    if (detail) {
      condition.append(renderCondition(detail.condition));
      const codeWrap = document.createElement("div");
      codeWrap.className = "interview-algo-card-code-wrap";
      const block = document.createElement("div");
      block.className = "code-block";
      block.dataset.lang = "python";
      // inline-code-highlighter.js and runnable-code-block.js both watch the
      // document for new .code-block nodes, so this needs no manual re-init.
      block.textContent = detail.solution;
      codeWrap.append(block);
      solutionWrap.append(codeWrap);
    } else {
      const failed = document.createElement("p");
      failed.className = "interview-algo-card-loading";
      failed.textContent = "Не удалось загрузить содержимое задачи.";
      condition.append(failed);
    }

    card.append(condition, solutionWrap);
    return card;
  }

  async function loadDetails(visible) {
    const missing = visible.filter((task) => !details.has(task.id));
    if (!missing.length) return;
    await Promise.all(
      missing.map(async (task) => {
        try {
          const snapshot = await database
            .ref(`algoTasks/${task.id}`)
            .once("value");
          details.set(
            task.id,
            snapshot.val() || { condition: "", solution: "" },
          );
        } catch (error) {
          console.error(`Failed to load algo task ${task.id}:`, error);
        }
      }),
    );
  }

  function syncPagination(visible, total) {
    const pagination = $("#algoTasksPagination");
    if (visible >= total) {
      pagination.hidden = true;
      return;
    }
    pagination.hidden = false;
    $("#algoTasksPaginationSummary").textContent =
      `Показано ${visible} из ${total}`;
    $("#algoTasksShowMore").textContent =
      `Загрузить ещё ${Math.min(PAGE_SIZE, total - visible)}`;
  }

  function syncCompanyChips() {
    const container = $("#algoCompanyFilter");
    const companies = api.listCompanies(tasks);
    const chips = [
      { id: "all", name: "Все компании", count: tasks.length },
      ...companies,
    ];
    container.replaceChildren(
      ...chips.map((company) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "interview-algo-chip";
        button.classList.toggle(
          "is-selected",
          filters.companyId === company.id,
        );
        button.setAttribute(
          "aria-pressed",
          String(filters.companyId === company.id),
        );
        button.append(document.createTextNode(company.name));
        button.append(
          badge("interview-algo-chip-count", String(company.count)),
        );
        button.addEventListener("click", () => {
          filters.companyId = company.id;
          resetAndRender();
        });
        return button;
      }),
    );

    const datalist = $("#algoTaskCompanies");
    if (datalist) {
      datalist.replaceChildren(
        ...companies.map((company) => {
          const option = document.createElement("option");
          option.value = company.name;
          return option;
        }),
      );
    }
  }

  function syncDifficultyChips() {
    const container = $("#algoDifficultyFilter");
    const options = [{ id: "all", label: "Любая" }, ...api.DIFFICULTIES];
    container.replaceChildren(
      ...options.map((option) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "interview-algo-chip";
        if (option.id !== "all")
          button.classList.add(`interview-algo-chip--${option.id}`);
        button.classList.toggle(
          "is-selected",
          filters.difficulty === option.id,
        );
        button.setAttribute(
          "aria-pressed",
          String(filters.difficulty === option.id),
        );
        button.textContent = option.label;
        button.addEventListener("click", () => {
          filters.difficulty = option.id;
          resetAndRender();
        });
        return button;
      }),
    );
  }

  function syncApproachSelect() {
    const select = $("#algoApproachFilter");
    const used = api.listApproaches(tasks);
    const all = document.createElement("option");
    all.value = "all";
    all.textContent = "Все подходы";
    select.replaceChildren(
      all,
      ...used.map((approach) => {
        const option = document.createElement("option");
        option.value = approach.id;
        option.textContent = `${approach.label} (${approach.count})`;
        return option;
      }),
    );
    if (!used.some((approach) => approach.id === filters.approach))
      filters.approach = "all";
    select.value = filters.approach;
  }

  async function render() {
    syncCompanyChips();
    syncDifficultyChips();
    syncApproachSelect();

    const filtered = api.filterTasks(tasks, filters);
    if (!tasks.length) {
      setState("Пока пусто", "Задачи с алго-собеседований ещё не добавлены.");
      return;
    }
    if (!filtered.length) {
      setState("Ничего не найдено", "Попробуйте изменить фильтры.", true);
      return;
    }

    const visible = filtered.slice(0, visibleCount);
    await loadDetails(visible);
    $("#algoTasksFilters").hidden = false;
    $("#algoTasksSummary").textContent = `Найдено задач: ${filtered.length}`;
    $("#algoTasksList").replaceChildren(
      ...visible.map((task) => buildCard(task, details.get(task.id))),
    );
    syncPagination(visible.length, filtered.length);
  }

  function resetAndRender() {
    visibleCount = PAGE_SIZE;
    render();
  }

  function buildApproachCheckboxes() {
    const container = $("#algoTaskApproaches");
    container.replaceChildren(
      ...api.APPROACHES.map((approach) => {
        const label = document.createElement("label");
        label.className = "interview-algo-approach-option";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.value = approach.id;
        input.name = "algoTaskApproach";
        label.append(input, document.createTextNode(approach.label));
        return label;
      }),
    );
  }

  function setModalError(message) {
    const node = $("#algoTaskModalError");
    node.textContent = message || "";
    node.hidden = !message;
  }

  async function openModal(taskId) {
    const modal = $("#algoTaskModal");
    const task = taskId ? tasks.find((item) => item.id === taskId) : null;
    setModalError("");
    $("#algoTaskId").value = taskId || "";
    $("#algoTaskModalTitle").textContent = task
      ? "Редактирование задачи"
      : "Новая задача";
    $("#algoTaskDelete").hidden = !task;
    $("#algoTaskTitle").value = task?.title || "";
    $("#algoTaskCompany").value = task?.company || "";
    $("#algoTaskDifficulty").value = task?.difficulty || "medium";
    const selected = new Set(task?.approaches || []);
    document.querySelectorAll("#algoTaskApproaches input").forEach((input) => {
      input.checked = selected.has(input.value);
    });
    $("#algoTaskCondition").value = "";
    $("#algoTaskSolution").value = "";
    $("#algoTaskSubmit").disabled = false;
    modal.showModal();

    if (!task) return;

    if (!details.has(task.id)) await loadDetails([task]);
    const detail = details.get(task.id);
    if (!detail) {
      // Saving now would overwrite the stored condition and solution with the
      // empty fields the mentor can see, so block it until a successful reload.
      setModalError(
        "Не удалось загрузить условие и решение. Закройте окно и попробуйте ещё раз — сохранение сейчас затёрло бы текст задачи.",
      );
      $("#algoTaskSubmit").disabled = true;
      return;
    }
    $("#algoTaskCondition").value = detail.condition || "";
    $("#algoTaskSolution").value = detail.solution || "";
  }

  function closeModal() {
    const modal = $("#algoTaskModal");
    if (modal.open) modal.close();
  }

  async function submitModal(event) {
    event.preventDefault();
    const submit = $("#algoTaskSubmit");
    const taskId = $("#algoTaskId").value;
    const approaches = [
      ...document.querySelectorAll("#algoTaskApproaches input:checked"),
    ].map((input) => input.value);
    if (!approaches.length) {
      setModalError("Выберите хотя бы один подход.");
      return;
    }
    setModalError("");
    submit.disabled = true;
    try {
      await window.staffApi.saveAlgoTask(taskId, {
        title: $("#algoTaskTitle").value,
        company: $("#algoTaskCompany").value,
        difficulty: $("#algoTaskDifficulty").value,
        approaches,
        condition: $("#algoTaskCondition").value,
        solution: $("#algoTaskSolution").value,
      });
      closeModal();
      await loadIndex();
    } catch (error) {
      console.error("Failed to save algo task:", error);
      setModalError(error.message || "Не удалось сохранить задачу.");
    } finally {
      submit.disabled = false;
    }
  }

  async function deleteTask() {
    const taskId = $("#algoTaskId").value;
    if (!taskId) return;
    if (!window.confirm("Удалить задачу без возможности восстановления?"))
      return;
    const button = $("#algoTaskDelete");
    button.disabled = true;
    try {
      await window.staffApi.deleteAlgoTask(taskId);
      details.delete(taskId);
      closeModal();
      await loadIndex();
    } catch (error) {
      console.error("Failed to delete algo task:", error);
      setModalError(error.message || "Не удалось удалить задачу.");
    } finally {
      button.disabled = false;
    }
  }

  async function loadIndex() {
    const refresh = $("#algoTasksRefresh");
    refresh.disabled = true;
    try {
      const snapshot = await database.ref("algoTaskIndex").once("value");
      tasks = api.indexToTasks(snapshot.val() || {});
      // Bodies are dropped too, otherwise a refresh would show a fresh index
      // beside a stale condition edited by somebody else in the meantime.
      details.clear();
      await render();
    } catch (error) {
      console.error("Failed to load algo task index:", error);
      setState(
        "Не удалось загрузить задачи",
        "Проверьте подключение и обновите страницу.",
      );
    } finally {
      refresh.disabled = false;
    }
  }

  async function resolveMentor() {
    const uid = firebase.auth().currentUser?.uid;
    if (!uid) return false;
    try {
      const snapshot = await database.ref(`users/${uid}/role`).once("value");
      return (
        String(snapshot.val() || "")
          .trim()
          .toLowerCase() === "mentor"
      );
    } catch (error) {
      console.error("Failed to resolve user role:", error);
      return false;
    }
  }

  async function initialize() {
    try {
      await window.authReady;
      if (!firebase.apps.length) {
        firebase.initializeApp(await window.configLoader.loadFirebaseConfig());
      }
      database = firebase.database();

      $("#algoApproachFilter").addEventListener("change", (event) => {
        filters.approach = event.target.value;
        resetAndRender();
      });
      $("#algoTasksShowMore").addEventListener("click", () => {
        visibleCount += PAGE_SIZE;
        render();
      });
      $("#algoTasksRefresh").addEventListener("click", loadIndex);

      isMentor = await resolveMentor();
      if (isMentor) {
        buildApproachCheckboxes();
        $("#algoTaskCreate").hidden = false;
        $("#algoTaskCreate").addEventListener("click", () => openModal(""));
        $("#algoTaskForm").addEventListener("submit", submitModal);
        $("#algoTaskCancel").addEventListener("click", closeModal);
        $("#algoTaskModalClose").addEventListener("click", closeModal);
        $("#algoTaskDelete").addEventListener("click", deleteTask);
        $("#algoTaskModal").addEventListener("click", (event) => {
          if (event.target === event.currentTarget) closeModal();
        });
      }

      await loadIndex();
    } catch (error) {
      console.error("Failed to initialize algo tasks page:", error);
      setState(
        "Не удалось открыть страницу",
        "Войдите в аккаунт и попробуйте ещё раз.",
      );
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    setState(
      "Загружаем задачи…",
      "Собираем задачи с алгоритмических собеседований.",
    );
    initialize();
  });
})();
