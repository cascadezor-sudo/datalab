(() => {
  "use strict";

  const pending = new Map();
  const cachePrefix = "staff-api:v1:";

  async function waitForUser() {
    const auth = window.firebase?.auth?.();
    if (!auth) throw new Error("Firebase Auth is unavailable.");
    if (auth.currentUser) return auth.currentUser;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        unsubscribe();
        reject(new Error("Authentication initialization timed out."));
      }, 10_000);
      const unsubscribe = auth.onAuthStateChanged((user) => {
        clearTimeout(timer);
        unsubscribe();
        if (user) resolve(user);
        else reject(new Error("Authentication is required."));
      }, reject);
    });
  }

  // Холодный старт контейнера в проде занимал до 18 секунд, поэтому паузы
  // растянуты: короткий повтор попадал бы в то же самое окно недоступности.
  // Джиттер разводит клиентов во времени — иначе повторы всей аудитории
  // приходят синхронной волной ровно в тот момент, когда инстансов и так нет.
  const RETRY_DELAYS_MS = [500, 2000, 5000];

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function retryDelay(attempt) {
    return RETRY_DELAYS_MS[attempt - 1] + Math.random() * 500;
  }

  /**
   * Cloud Run отвечает 5xx ещё до входа в контейнер («The request was aborted
   * because there was no available instance»), и такой ответ приходит без
   * CORS-заголовков — в браузере он выглядит как TypeError: Failed to fetch.
   * Штатная ситуация при холодном старте, поэтому чтение переспрашиваем.
   *
   * Запись — нет: staff-callable не принимают requestId и не проходят через
   * oncePerRequest, так что потерянный ответ после успешной записи превратился
   * бы во вторую запись (лишний оффер, дубль карточки канбана, «заявка уже
   * обработана» на самом деле обработанной заявке). Поэтому mutate() ходит
   * без повторов, и по умолчанию retry выключен.
   */
  async function call(name, data = {}, { retry = true } = {}) {
    if (window.__datalabOffline) {
      throw new Error("Эта функция недоступна в локальном режиме DataLab.");
    }
    const user = await waitForUser();
    const projectId = window.firebase.app().options.projectId;
    const url = `https://us-central1-${projectId}.cloudfunctions.net/${name}`;

    const lastAttempt = retry ? RETRY_DELAYS_MS.length : 0;
    let lastError = null;
    for (let attempt = 0; attempt <= lastAttempt; attempt += 1) {
      if (attempt > 0) await sleep(retryDelay(attempt));
      let response;
      try {
        response = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${await user.getIdToken()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ data }),
        });
      } catch (error) {
        lastError = new Error(
          `Staff API request failed: ${error?.message || error}`,
        );
        continue;
      }
      const body = await response.json().catch(() => ({}));
      if (response.ok && !body.error) return body.result;
      const message = body.error?.message || "Staff API request failed.";
      if (response.status < 500) throw new Error(message);
      lastError = new Error(message);
    }
    throw lastError;
  }

  function cacheKey(name, data = {}) {
    const uid = window.firebase?.auth?.().currentUser?.uid || "anonymous";
    return `${cachePrefix}${uid}:${name}:${JSON.stringify(data)}`;
  }

  function clearCache() {
    pending.clear();
    try {
      for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
        const key = sessionStorage.key(index);
        if (key?.startsWith(cachePrefix)) sessionStorage.removeItem(key);
      }
    } catch (_) {
      // Staff API remains available when session storage is disabled.
    }
  }

  async function cachedCall(name, data = {}, ttlMs = 30_000) {
    await waitForUser();
    const key = cacheKey(name, data);
    try {
      const cached = JSON.parse(sessionStorage.getItem(key) || "null");
      if (cached && Date.now() - Number(cached.cachedAt || 0) < ttlMs) {
        return cached.value;
      }
    } catch (_) {
      // Ignore malformed or unavailable session storage.
    }
    if (pending.has(key)) return pending.get(key);
    const promise = call(name, data)
      .then((value) => {
        try {
          sessionStorage.setItem(
            key,
            JSON.stringify({ cachedAt: Date.now(), value }),
          );
        } catch (_) {
          // Large responses or privacy settings may disable session storage.
        }
        return value;
      })
      .finally(() => pending.delete(key));
    pending.set(key, promise);
    return promise;
  }

  async function mutate(name, data = {}) {
    // Единственная точка входа для всех пишущих эндпоинтов — здесь и
    // отключаем повторы, см. комментарий к call().
    const value = await call(name, data, { retry: false });
    clearCache();
    return value;
  }

  function byId(items, key = "uid") {
    return Object.fromEntries((items || []).map((item) => [item[key], item]));
  }

  async function collect(listMethod, params = {}) {
    const items = [];
    let offset = 0;
    do {
      const page = await listMethod({ ...params, offset, limit: 100 });
      items.push(...(page.items || []));
      offset = page.nextOffset;
    } while (offset !== null && offset !== undefined);
    return items;
  }

  window.staffApi = window.staffApi || {
    call,
    clearCache,
    getStaffDirectory: () => cachedCall("getStaffDirectory"),
    async getStaffDirectoryMap() {
      return byId(await this.getStaffDirectory());
    },
    getStaffOverviewData: () => cachedCall("getStaffOverviewData", {}, 30_000),
    getStaffLeaderboardData: () =>
      cachedCall("getStaffLeaderboardData", {}, 30_000),
    getPublicLeaderboardProfiles: () =>
      cachedCall("getPublicLeaderboardProfiles", {}, 300_000),
    // Публичный лидерборд целиком: имена, счётчики и форматы только той
    // секции, в которой зритель соревнуется сам. Вызов читает `public_stats`
    // целиком (сотни килобайт), а страницу открывает каждый ученик, поэтому
    // кэш держим тот же, что у профилей. Свежие данные по требованию даёт
    // кнопка «Обновить»: она сбрасывает кэш перед перезагрузкой.
    getPublicLeaderboard: () => cachedCall("getPublicLeaderboard", {}, 300_000),
    listStaffFeedbacks: (params) => call("listStaffFeedbacks", params),
    listRagFeedback: (params) => call("listRagFeedback", params),
    getRagFeedbackDetail: (studentId, feedbackId) =>
      call("getRagFeedbackDetail", { studentId, feedbackId }),
    getAllStaffFeedbacks: (params = {}) =>
      collect((page) => call("listStaffFeedbacks", page), params),
    getStaffDashboardSummary: () => cachedCall("getStaffDashboardSummary"),
    getStaffDashboardData: (params = {}) =>
      cachedCall("getStaffDashboardData", params, 30_000),
    getStaffMonthlySummary: (params) =>
      cachedCall("getStaffMonthlySummary", params, 30_000),
    getStaffStudentDetail: (studentId, sections) =>
      cachedCall("getStaffStudentDetail", { studentId, sections }, 15_000),
    updateStaffStudent: (studentId, patch) =>
      mutate("updateStaffStudent", { studentId, patch }),
    assignStaffStudent: (studentId, staffUid) =>
      mutate("assignStaffStudent", { studentId, staffUid }),
    setStaffRole: (studentId, role) =>
      mutate("setStaffRole", { studentId, role }),
    setStaffStudentStatus: (studentId, status) =>
      mutate("setStaffStudentStatus", { studentId, status }),
    setStaffSubgroup: (studentId, subgroup) =>
      mutate("setStaffSubgroup", { studentId, subgroup }),
    setStaffSubgroupHistory: (studentId, history) =>
      mutate("setStaffSubgroupHistory", { studentId, history }),
    setStaffLearningFormat: (studentId, learningFormat) =>
      mutate("setStaffLearningFormat", { studentId, learningFormat }),
    setStaffAccessPlan: (studentId, accessPlan, grants) =>
      mutate("setStaffAccessPlan", { studentId, accessPlan, grants }),
    updateStaffNotificationSettings: (staffUid, settings) =>
      mutate("updateStaffNotificationSettings", { staffUid, ...settings }),
    listStaffReports: (params) => call("listStaffReports", params),
    async getStaffReportsMap(params) {
      const reports = await collect(
        (page) => this.listStaffReports(page),
        params,
      );
      return reports.reduce((groups, report) => {
        groups[report.studentId] = groups[report.studentId] || {};
        groups[report.studentId][report.reportId] = report;
        return groups;
      }, {});
    },
    getStaffReportDetail: (studentId, reportId) =>
      call("getStaffReportDetail", { studentId, reportId }),
    markStaffReportsRead: (studentId, reportIds) =>
      mutate("markStaffReportsRead", { studentId, reportIds }),
    getStaffProgressSummary: (params) =>
      call("getStaffProgressSummary", params),
    getStaffTestsSummary: (params) => call("getStaffTestsSummary", params),
    getStaffDifficultySummary: () => call("getStaffDifficultySummary"),
    listStaffQuestionReports: (params) =>
      call("listStaffQuestionReports", params),
    async getStaffQuestionReportsMap(params) {
      return byId(
        await collect((page) => this.listStaffQuestionReports(page), params),
        "reportId",
      );
    },
    getStaffQuestionReportDetail: (reportId) =>
      call("getStaffQuestionReportDetail", { reportId }),
    updateStaffQuestionReportStatus: (reportId, status) =>
      mutate("updateStaffQuestionReportStatus", { reportId, status }),
    listStaffOffers: (params) => call("listStaffOffers", params),
    // Срез диагностики считается по всей когорте: одной страницы (≤100) мало.
    getAllStaffTestsSummary: (params = {}) =>
      collect((page) => call("getStaffTestsSummary", page), params),
    getAllStaffOffers: (params = {}) =>
      collect((page) => call("listStaffOffers", page), params),
    saveStaffOffer: (studentId, offer, offerIndex = null) =>
      mutate("saveStaffOffer", { studentId, offer, offerIndex }),
    deleteStaffOffer: (studentId, offerIndex) =>
      mutate("deleteStaffOffer", { studentId, offerIndex }),
    async listStaffAccessRequests(params) {
      const page = await call("listStaffAccessRequests", params);
      // Keep old staff screens compatible while the callable API exposes the
      // canonical studentId field instead of raw RTDB uid/userId fields.
      return {
        ...page,
        items: (page.items || []).map((item) => ({
          ...item,
          uid: item.studentId,
          userId: item.studentId,
        })),
      };
    },
    async getStaffAccessRequestsMap(params) {
      return byId(
        await collect((page) => this.listStaffAccessRequests(page), params),
        "requestId",
      );
    },
    resolveStaffAccessRequest: (requestId, action) =>
      mutate("resolveStaffAccessRequest", { requestId, action }),
    setStaffMaterialAccess: (studentId, grants) =>
      mutate("setStaffMaterialAccess", { studentId, grants }),
    scheduleRoadmapMilestone: (params) =>
      mutate("scheduleRoadmapMilestone", params),
    setStaffMaterialAccessBatch: (studentIds, grants) =>
      mutate("setStaffMaterialAccessBatch", { studentIds, grants }),
    listKanbanTasks: (params) => call("listKanbanTasks", params),
    saveKanbanTask: (taskId, patch) =>
      mutate("saveKanbanTask", { taskId, patch }),
    saveAlgoTask: (taskId, patch) => mutate("saveAlgoTask", { taskId, patch }),
    deleteAlgoTask: (taskId) => mutate("deleteAlgoTask", { taskId }),
  };
})();
