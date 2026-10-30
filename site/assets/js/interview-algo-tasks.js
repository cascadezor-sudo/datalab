(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.InterviewAlgoTasks = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // Mirrors APPROACHES in functions/algo-tasks.js — keep both in sync.
  const APPROACHES = [
    { id: "single-pass", label: "Один проход" },
    { id: "hash-table", label: "Хеш-таблица" },
    { id: "sorting", label: "Сортировка" },
    { id: "two-pointers", label: "Два указателя" },
    { id: "sliding-window", label: "Скользящее окно" },
    { id: "binary-search", label: "Бинарный поиск" },
    { id: "stack-queue", label: "Стек и очередь" },
    { id: "linked-list", label: "Связный список" },
    { id: "heap", label: "Куча" },
    { id: "dfs-bfs", label: "DFS и BFS" },
    { id: "dynamic-programming", label: "Динамическое программирование" },
    { id: "greedy", label: "Жадный алгоритм" },
  ];

  const DIFFICULTIES = [
    { id: "easy", label: "Easy" },
    { id: "medium", label: "Medium" },
    { id: "hard", label: "Hard" },
  ];

  const approachLabels = new Map(
    APPROACHES.map((item) => [item.id, item.label]),
  );

  function approachLabel(id) {
    return approachLabels.get(id) || id;
  }

  function indexToTasks(snapshot) {
    return Object.entries(snapshot || {})
      .map(([id, entry]) => ({
        id,
        title: String(entry?.title || ""),
        company: String(entry?.company || ""),
        companyId: String(entry?.companyId || ""),
        difficulty: String(entry?.difficulty || ""),
        approaches: Object.keys(entry?.approaches || {}),
        createdAt: Number(entry?.createdAt) || 0,
        updatedAt: Number(entry?.updatedAt) || 0,
      }))
      .sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id));
  }

  function listCompanies(tasks) {
    const companies = new Map();
    (tasks || []).forEach((task) => {
      if (!task.companyId) return;
      const entry = companies.get(task.companyId);
      if (entry) entry.count += 1;
      else
        companies.set(task.companyId, {
          id: task.companyId,
          name: task.company,
          count: 1,
        });
    });
    return [...companies.values()].sort((a, b) =>
      a.name.localeCompare(b.name, "ru"),
    );
  }

  function listApproaches(tasks) {
    const counts = new Map();
    (tasks || []).forEach((task) => {
      task.approaches.forEach((id) =>
        counts.set(id, (counts.get(id) || 0) + 1),
      );
    });
    return APPROACHES.filter((item) => counts.has(item.id)).map((item) => ({
      ...item,
      count: counts.get(item.id),
    }));
  }

  function filterTasks(tasks, filters) {
    const companyId = filters?.companyId || "all";
    const difficulty = filters?.difficulty || "all";
    const approach = filters?.approach || "all";
    return (tasks || []).filter((task) => {
      if (companyId !== "all" && task.companyId !== companyId) return false;
      if (difficulty !== "all" && task.difficulty !== difficulty) return false;
      if (approach !== "all" && !task.approaches.includes(approach))
        return false;
      return true;
    });
  }

  return {
    APPROACHES,
    DIFFICULTIES,
    approachLabel,
    indexToTasks,
    listCompanies,
    listApproaches,
    filterTasks,
  };
});
