// Offline helper & persistent mock storage for DataLab
(function () {
  "use strict";
  window.__datalabOfflineChecker = true;
  window.__datalabOffline = true;

  // 1. Calculate site root
  window.getSiteRoot = function () {
    if (window.__siteRoot) return window.__siteRoot;
    var loc = window.location;
    if (loc.protocol === "file:") {
      var p = loc.pathname.replace(/\\/g, "/");
      var idx = p.lastIndexOf("/site/");
      if (idx !== -1) {
        window.__siteRoot = p.substring(0, idx + 6);
        return window.__siteRoot;
      }
    }
    window.__siteRoot = "/";
    return window.__siteRoot;
  };

  // 2. Normalize navbar and dynamic root URLs
  window.normalizeSiteUrl = function (url) {
    if (!url || typeof url !== "string") return url;
    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("//") ||
        url.startsWith("data:") || url.startsWith("mailto:") || url.startsWith("tel:") ||
        url.startsWith("javascript:") || url.startsWith("#")) {
      return url;
    }

    if (!url.startsWith("/")) {
      return url;
    }

    if (window.location.protocol !== "file:") {
      var parts = url.split("#");
      var cleanAndQuery = parts[0];
      var hash = parts.length > 1 ? "#" + parts[1] : "";
      var qParts = cleanAndQuery.split("?");
      var clean = qParts[0];
      var query = qParts.length > 1 ? "?" + qParts[1] : "";

      if (clean.endsWith("/")) {
        clean += "index.html";
      }
      return clean + query + hash;
    }

    var root = window.getSiteRoot();
    var parts = url.split("#");
    var cleanAndQuery = parts[0];
    var hash = parts.length > 1 ? "#" + parts[1] : "";
    var qParts = cleanAndQuery.split("?");
    var clean = qParts[0];
    var query = qParts.length > 1 ? "?" + qParts[1] : "";

    var path = clean.startsWith("/") ? clean.substring(1) : clean;
    if (!path) {
      path = "main.html";
    } else if (path.endsWith("/")) {
      path += "index.html";
    }
    return root + path + query + hash;
  };

  // 3. Persistent LocalStorage Database Mock
  var DB_STORAGE_KEY = "datalab_offline_db";

  function getInitialDb() {
    return {
      users: {
        offline_user: {
          uid: "offline_user",
          email: "offline@datalab.local",
          displayName: "Student",
          firstName: "Student",
          lastName: "",
          telegram: "@student",
          role: "student",
          introShown: true, // Complete onboarding by default so it never annoys user repeatedly
          introShownAt: Date.now(),
          progress: {},
          difficultyRatings: {},
          achievements: { onboarding_complete: true },
          materialAccess: {}
        }
      },
      leaderboard: {},
      reports: {},
      kanban: {}
    };
  }

  var storageNoticeMessage = "";
  function renderStorageNotice() {
    if (!document.body) return;
    var notice = document.getElementById("offline-storage-error");
    if (!storageNoticeMessage) {
      if (notice) notice.remove();
      return;
    }
    if (!notice) {
      notice = document.createElement("div");
      notice.id = "offline-storage-error";
      notice.setAttribute("role", "alert");
      notice.style.cssText = "position:fixed;bottom:16px;left:16px;right:16px;z-index:10000;padding:16px;background:#7f1d1d;color:#fff;border:2px solid #fecaca;border-radius:8px;font:16px/1.5 sans-serif;max-height:40vh;overflow:auto";
      document.body.appendChild(notice);
    }
    notice.textContent = storageNoticeMessage;
  }
  document.addEventListener("DOMContentLoaded", renderStorageNotice);

  function reportStorageFailure(error, reading) {
    storageNoticeMessage = reading
      ? "Не удалось прочитать сохранённый прогресс. Старые данные не заменены. Проверьте доступ к хранилищу браузера."
      : "Не удалось подтвердить сохранение изменений. Часть изменений могла сохраниться. Не закрывайте страницу и повторите действие после проверки хранилища браузера.";
    renderStorageNotice();
    console.error("[DataLab offline] Storage operation failed:", error);
    var failure = new Error(storageNoticeMessage);
    failure.code = "OFFLINE_STORAGE_FAILED";
    failure.cause = error;
    return failure;
  }

  function readStoredDatabase() {
    var current = localStorage.getItem(DB_STORAGE_KEY);
    if (current !== null) return { raw: current, migrated: false };
    var candidates = [];
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (!key || key === DB_STORAGE_KEY || !key.endsWith("_offline_db")) continue;
      var raw = localStorage.getItem(key);
      var parsed = JSON.parse(raw);
      if (parsed && parsed.users && parsed.users.offline_user &&
          parsed.users.offline_user.uid === "offline_user") {
        candidates.push(raw);
      }
    }
    if (candidates.length > 1) {
      throw new Error("Several compatible offline databases found; automatic import is ambiguous");
    }
    return { raw: candidates.length ? candidates[0] : null, migrated: candidates.length === 1 };
  }

  function loadDb() {
    try {
      var stored = readStoredDatabase();
      var raw = stored.raw;
      if (raw !== null) {
        var parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) ||
            !parsed.users || typeof parsed.users !== "object" || Array.isArray(parsed.users)) {
          throw new Error("Invalid offline database");
        }
        if (!parsed.users.offline_user) parsed.users.offline_user = getInitialDb().users.offline_user;
        if (parsed.users.offline_user.introShown === undefined) parsed.users.offline_user.introShown = true;
        parsed.users.offline_user.role = "student";
        if (!parsed.users.offline_user.progress) parsed.users.offline_user.progress = {};
        if (!parsed.kanbanTasks) parsed.kanbanTasks = {};
        if (!parsed.user_achievements) parsed.user_achievements = { offline_user: {} };
        var legacyReports = parsed.users.offline_user.reports || {};
        var migrated = stored.migrated;
        if (Object.prototype.hasOwnProperty.call(parsed.users.offline_user, "wallet")) {
          delete parsed.users.offline_user.wallet;
          migrated = true;
        }
        if (/^offline@[^@\s]+\.local$/.test(parsed.users.offline_user.email || "") &&
            parsed.users.offline_user.email !== "offline@datalab.local") {
          parsed.users.offline_user.email = "offline@datalab.local";
          migrated = true;
        }
        Object.keys(legacyReports).forEach(function (id) {
          var entry = legacyReports[id];
          if (!entry || !entry.report || typeof entry.report !== "object") return;
          if (!parsed.daily_reports) parsed.daily_reports = {};
          if (!parsed.daily_reports.offline_user) parsed.daily_reports.offline_user = {};
          if (Object.prototype.hasOwnProperty.call(parsed.daily_reports.offline_user, id)) return;
          parsed.daily_reports.offline_user[id] = Object.assign({}, entry.report, {
            uid: "offline_user", reportId: id,
            timestamp: entry.timestamp || entry.report.timestamp || Date.now()
          });
          migrated = true;
        });
        if (migrated) saveDb(parsed);
        return parsed;
      }
    } catch (e) {
      throw reportStorageFailure(e, true);
    }
    var initial = getInitialDb();
    initial.kanbanTasks = initial.kanbanTasks || {};
    initial.user_achievements = initial.user_achievements || { offline_user: {} };
    saveDb(initial);
    return initial;
  }

  function writeStorageConfirmed(key, data) {
    try {
      var serialized = JSON.stringify(data);
      localStorage.setItem(key, serialized);
      if (localStorage.getItem(key) !== serialized) {
        throw new Error("Storage read-back did not match the write");
      }
    } catch (e) {
      throw reportStorageFailure(e, false);
    }
  }

  function saveDb(data) {
    writeStorageConfirmed(DB_STORAGE_KEY, data);
  }

  function clearStorageFailure() {
    storageNoticeMessage = "";
    renderStorageNotice();
  }

  // Sync with anonymous_progress if exists
  try {
    var anonRaw = localStorage.getItem("anonymous_progress");
    if (anonRaw) {
      var anonObj = JSON.parse(anonRaw);
      var currentDb = loadDb();
      Object.assign(currentDb.users.offline_user.progress, anonObj);
      saveDb(currentDb);
    }
  } catch (e) {
    if (e.code !== "OFFLINE_STORAGE_FAILED") reportStorageFailure(e, true);
  }

  function toSegments(path) {
    if (!path) return [];
    if (Array.isArray(path)) return path;
    return String(path).split("/").map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function getValueAt(tree, segments) {
    var curr = tree;
    for (var i = 0; i < segments.length; i++) {
      if (curr === null || typeof curr !== "object") return undefined;
      curr = curr[segments[i]];
    }
    return curr;
  }

  function setValueAt(tree, segments, value) {
    if (segments.length === 0) return value;
    var curr = tree;
    for (var i = 0; i < segments.length - 1; i++) {
      var seg = segments[i];
      if (curr[seg] === null || typeof curr[seg] !== "object") {
        curr[seg] = {};
      }
      curr = curr[seg];
    }
    if (value && typeof value === "object") {
      if (value[".sv"] === "timestamp") value = Date.now();
      else {
        value = JSON.parse(JSON.stringify(value), function (k, v) {
          if (v && v[".sv"] === "timestamp") return Date.now();
          return v;
        });
      }
    }
    curr[segments[segments.length - 1]] = value;
    return tree;
  }

  function updateValueAt(tree, segments, updates) {
    var target = tree;
    for (var i = 0; i < segments.length; i++) {
      var seg = segments[i];
      if (target[seg] === null || typeof target[seg] !== "object") {
        target[seg] = {};
      }
      target = target[seg];
    }
    for (var k in updates) {
      if (Object.prototype.hasOwnProperty.call(updates, k)) {
        var v = updates[k];
        if (v && v[".sv"] === "timestamp") v = Date.now();
        var subSegs = toSegments(k);
        if (subSegs.length > 1) {
          setValueAt(target, subSegs, v);
        } else {
          target[k] = v;
        }
      }
    }
    return tree;
  }

  function removeValueAt(tree, segments) {
    if (segments.length === 0) return {};
    var curr = tree;
    for (var i = 0; i < segments.length - 1; i++) {
      var seg = segments[i];
      if (curr[seg] === null || typeof curr[seg] !== "object") return tree;
      curr = curr[seg];
    }
    delete curr[segments[segments.length - 1]];
    return tree;
  }

  var pathListeners = new Map();

  function subscribe(pathStr, cb) {
    var norm = toSegments(pathStr).join("/");
    if (!pathListeners.has(norm)) {
      pathListeners.set(norm, new Set());
    }
    pathListeners.get(norm).add(cb);
  }

  function unsubscribe(pathStr, cb) {
    var norm = toSegments(pathStr).join("/");
    if (pathListeners.has(norm)) {
      if (cb) {
        pathListeners.get(norm).delete(cb);
      } else {
        pathListeners.delete(norm);
      }
    }
  }

  function dispatch(changedPathStr) {
    var normChanged = toSegments(changedPathStr).join("/");
    pathListeners.forEach(function (cbs, listenerNorm) {
      if (!normChanged || !listenerNorm ||
          listenerNorm === normChanged ||
          normChanged.startsWith(listenerNorm + "/") ||
          listenerNorm.startsWith(normChanged + "/")) {
        var snap = makeSnapshot(listenerNorm);
        cbs.forEach(function (cb) {
          try { cb(snap); } catch (e) { console.error(e); }
        });
      }
    });
  }

  function makeSnapshot(pathStr) {
    var segs = toSegments(pathStr);
    var db = loadDb();
    var raw = getValueAt(db, segs);
    var val = raw === undefined ? null : JSON.parse(JSON.stringify(raw));
    var lastKey = segs.length > 0 ? segs[segs.length - 1] : null;

    return {
      key: lastKey,
      val: function () {
        return val;
      },
      exists: function () {
        return val !== null && val !== undefined;
      },
      numChildren: function () {
        return (val && typeof val === "object" && !Array.isArray(val)) ? Object.keys(val).length : 0;
      },
      forEach: function (cb) {
        if (!val || typeof val !== "object" || Array.isArray(val)) return false;
        var keys = Object.keys(val);
        for (var i = 0; i < keys.length; i++) {
          var k = keys[i];
          var childSnap = makeSnapshot(segs.concat(k).join("/"));
          if (cb(childSnap) === true) return true;
        }
        return false;
      },
      child: function (childPath) {
        return makeSnapshot(segs.concat(toSegments(childPath)).join("/"));
      },
      hasChild: function (childPath) {
        var childSegs = segs.concat(toSegments(childPath));
        return getValueAt(loadDb(), childSegs) !== undefined;
      }
    };
  }

  function makeRef(pathStr) {
    var norm = toSegments(pathStr).join("/");
    var segs = toSegments(norm);

    var ref = {
      key: segs.length > 0 ? segs[segs.length - 1] : null,
      child: function (subPath) {
        return makeRef(segs.concat(toSegments(subPath)).join("/"));
      },
      push: function (data) {
        var autoKey = "-O" + Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
        var childRef = ref.child(autoKey);
        if (data !== undefined) {
          var pendingWrite = childRef.set(data);
          pendingWrite.catch(function () {}); // Failure is visible even if the caller does not await.
          childRef.then = function (resolve, reject) {
            return pendingWrite.then(function () { return makeRef(segs.concat(autoKey).join("/")); }).then(resolve, reject);
          };
          childRef.catch = function (reject) { return childRef.then(undefined, reject); };
          childRef.finally = function (callback) {
            return pendingWrite.then(function () { return makeRef(segs.concat(autoKey).join("/")); }).finally(callback);
          };
        }
        return childRef;
      },
      set: async function (data) {
        var db = loadDb();
        setValueAt(db, segs, data);
        saveDb(db);
        dispatch(norm);
        return Promise.resolve();
      },
      update: async function (updates) {
        var db = loadDb();
        updateValueAt(db, segs, updates);
        saveDb(db);
        dispatch(norm);
        if (updates && typeof updates === "object") {
          for (var k in updates) {
            dispatch(segs.concat(toSegments(k)).join("/"));
          }
        }
        return Promise.resolve();
      },
      remove: async function () {
        var db = loadDb();
        removeValueAt(db, segs);
        saveDb(db);
        dispatch(norm);
        return Promise.resolve();
      },
      once: function (evt, cb) {
        var snap = makeSnapshot(norm);
        if (typeof cb === "function") cb(snap);
        return Promise.resolve(snap);
      },
      on: function (evt, cb) {
        if (typeof cb === "function") {
          subscribe(norm, cb);
          setTimeout(function () {
            cb(makeSnapshot(norm));
          }, 0);
        }
        return cb;
      },
      off: function (evt, cb) {
        unsubscribe(norm, cb);
      },
      orderByChild: function () { return ref; },
      orderByKey: function () { return ref; },
      orderByValue: function () { return ref; },
      equalTo: function () { return ref; },
      limitToFirst: function () { return ref; },
      limitToLast: function () { return ref; },
      startAt: function () { return ref; },
      endAt: function () { return ref; }
    };

    return ref;
  }

  var dummyAuth = {
    onAuthStateChanged: function (cb) {
      setTimeout(function () {
        var db = loadDb();
        var user = db.users && db.users.offline_user ? db.users.offline_user : {
          uid: "offline_user",
          email: "offline@datalab.local",
          displayName: "Student"
        };
        cb(user);
      }, 0);
      return function () {};
    },
    currentUser: {
      uid: "offline_user",
      email: "offline@datalab.local",
      displayName: "Student"
    },
    signInWithCustomToken: function () { return Promise.resolve(); },
    signOut: function () { return Promise.resolve(); }
  };

  var databaseFn = function () {
    return {
      ref: function (path) {
        return makeRef(path || "");
      }
    };
  };
  databaseFn.ServerValue = {
    TIMESTAMP: { ".sv": "timestamp" }
  };

  window.firebase = {
    options: { projectId: "datalab-local", offline: true },
    apps: [{ name: "[DEFAULT]" }],
    app: function () { return window.firebase; },
    initializeApp: function () { return window.firebase; },
    auth: function () { return dummyAuth; },
    database: databaseFn
  };
  window.firebase.database.ServerValue = databaseFn.ServerValue;

  window.authGuard = {
    checkAuth: function () { return Promise.resolve(true); },
    currentUser: dummyAuth.currentUser
  };

  // 4. Offline Achievement & Staff API
  var OFFLINE_STUDENT = {
    uid: "offline_user",
    displayName: "Студент (Офлайн)",
    email: "offline@datalab.local",
    role: "student",
    status: "active",
    assignedStaffUid: "offline_user",
    assignedMentorUid: "offline_user",
    assignedCuratorUid: "offline_user"
  };

  var cachedTeorminCards = null;
  async function loadAllTeorminCards() {
    if (cachedTeorminCards && cachedTeorminCards.length) {
      return cachedTeorminCards;
    }
    try {
      var res = await fetch("/assets/data/teormin-cards.json");
      if (res.ok) {
        var data = await res.json();
        cachedTeorminCards = Array.isArray(data.cards) ? data.cards : [];
        return cachedTeorminCards;
      }
    } catch (err) {
      console.warn("firebase-mock: failed to load teormin-cards.json", err);
    }
    return [];
  }

  async function evaluateAchievementsOffline() {
    try {
      var db = loadDb();
      var user = db.users && db.users.offline_user ? db.users.offline_user : {};
      var progress = user.progress || {};
      var reports = user.reports || {};
      var quizGroups = user.quizResults || {};
      var quizResults = {};
      Object.keys(quizGroups).forEach(function (id) {
        var entry = quizGroups[id];
        if (entry && entry.quizId) quizResults[id] = entry;
        else Object.keys(entry || {}).forEach(function (key) { quizResults[id + ":" + key] = entry[key]; });
      });
      var currentUnlocked = (db.user_achievements && db.user_achievements.offline_user) || {};
      if (!db.user_achievements) db.user_achievements = {};
      if (!db.user_achievements.offline_user) db.user_achievements.offline_user = currentUnlocked;

      var completedQuestions = 0;
      var distinctTopicSet = new Set();
      for (var qId in progress) {
        if (progress[qId] === true || (progress[qId] && progress[qId].completed !== false)) {
          completedQuestions++;
          var prefix = qId.split("_")[0];
          if (prefix) distinctTopicSet.add(prefix);
        }
      }

      var reportCount = Object.keys(reports).length;
      var quizCount = Object.keys(quizResults).length;
      var perfectQuizCount = 0;
      for (var k in quizResults) {
        if (quizResults[k] && (quizResults[k].score === 1 || quizResults[k].score === 100 || quizResults[k].percent === 100)) {
          perfectQuizCount++;
        }
      }

      // Spaced repetition metrics
      var repReviewedCards = 0;
      var repMatureCards = 0;
      var repMaxIntervalDays = 0;
      var repEasyCards = 0;
      var repReviewDays = new Set();
      var repCategories = new Set();
      var nowMs = Date.now();
      var spacedRep = user.spaced_repetition || {};

      for (var cardId in spacedRep) {
        var state = spacedRep[cardId];
        if (!state || !state.lastReviewedAt) continue;
        repReviewedCards++;
        if ((state.repetitions || 0) >= 3 && (state.intervalDays || 0) >= 7 && (state.nextReviewAt || 0) > nowMs) {
          repMatureCards++;
        }
        if ((state.intervalDays || 0) > repMaxIntervalDays) {
          repMaxIntervalDays = state.intervalDays;
        }
        if (state.lastGrade === "easy") {
          repEasyCards++;
        }
        repReviewDays.add(new Date(state.lastReviewedAt).toDateString());
        var repQId = cardId.split("__")[0];
        if (repQId) repCategories.add(repQId);
      }

      var catalog = [];
      try {
        var catRes = await fetch("/assets/data/achievements/catalog.json");
        if (catRes.ok) {
          var catJson = await catRes.json();
          catalog = catJson.achievements || [];
        }
      } catch (e) {}

      if (!catalog.length) {
        catalog = [
          { id: "onboarding_complete", title: "Знакомство", category: "special", tier: "bronze", rule: { type: "onboarding" } },
          { id: "first_question", title: "Первый шаг", category: "volume", tier: "bronze", rule: { type: "questions", min: 1 } },
          { id: "ten_questions", title: "Разогрев", category: "volume", tier: "bronze", rule: { type: "questions", min: 10 } },
          { id: "fifty_questions", title: "В ритме", category: "volume", tier: "silver", rule: { type: "questions", min: 50 } },
          { id: "first_report", title: "Дорогой дневник..", category: "volume", tier: "bronze", rule: { type: "reports", min: 1 } },
          { id: "first_quiz", title: "Проба пера", category: "quiz", tier: "bronze", rule: { type: "quizzes", min: 1 } },
          { id: "three_day_streak", title: "Три дня подряд", category: "consistency", tier: "silver", rule: { type: "streak", min: 3 } }
        ];
      }

      var newlyUnlocked = [];
      var now = Date.now();

      catalog.forEach(function (ach) {
        if (currentUnlocked[ach.id]) return;
        var rule = ach.rule || {};
        var shouldUnlock = false;

        if (rule.type === "questions") {
          shouldUnlock = completedQuestions >= (rule.min || 1);
        } else if (rule.type === "reports") {
          shouldUnlock = reportCount >= (rule.min || 1);
        } else if (rule.type === "quizzes") {
          shouldUnlock = quizCount >= (rule.min || 1);
        } else if (rule.type === "perfect_quiz_topics" || rule.type === "perfect_quizzes") {
          shouldUnlock = perfectQuizCount >= (rule.min || 1);
        } else if (rule.type === "distinct_topics") {
          shouldUnlock = distinctTopicSet.size >= (rule.min || 1);
        } else if (rule.type === "repetition_moment") {
          var m = rule.metric;
          var minVal = rule.min || 1;
          if (m === "reviewedCards") shouldUnlock = repReviewedCards >= minVal;
          else if (m === "matureCards") shouldUnlock = repMatureCards >= minVal;
          else if (m === "maxIntervalDays") shouldUnlock = repMaxIntervalDays >= minVal;
          else if (m === "reviewDays") shouldUnlock = repReviewDays.size >= minVal;
          else if (m === "reviewedCategories") shouldUnlock = repCategories.size >= minVal;
          else if (m === "easyCards") shouldUnlock = repEasyCards >= minVal;
        } else if (ach.id === "onboarding_complete" || rule.type === "onboarding") {
          shouldUnlock = true;
        } else if (rule.type === "streak" && (completedQuestions > 0 || reportCount > 0)) {
          shouldUnlock = true;
        }

        if (shouldUnlock) {
          currentUnlocked[ach.id] = {
            unlockedAt: now,
            title: ach.title,
            description: ach.description || "",
            category: ach.category || "special",
            tier: ach.tier || "bronze"
          };
          if (!db.achievement_events) db.achievement_events = {};
          if (!db.achievement_events.offline_user) db.achievement_events.offline_user = {};
          db.achievement_events.offline_user["evt_" + now + "_" + ach.id] = {
            achievementId: ach.id,
            createdAt: now
          };
          newlyUnlocked.push(ach);
        }
      });

      if (newlyUnlocked.length > 0) {
        saveDb(db);
        dispatch("user_achievements/offline_user");
        dispatch("achievement_events/offline_user");
        if (window.globalAchievementNotifications) {
          newlyUnlocked.forEach(function (ach) {
            window.globalAchievementNotifications.enqueue({
              id: ach.id,
              eventId: "evt_" + now + "_" + ach.id
            });
          });
        }
        window.dispatchEvent(new CustomEvent("datalab_achievements_updated", { detail: { newlyUnlocked: newlyUnlocked } }));
      }

      var totalCount = Object.keys(currentUnlocked).length;
      return {
        success: true,
        newlyUnlocked: newlyUnlocked,
        unlockedLabels: []
      };
    } catch (err) {
      if (err.code === "OFFLINE_STORAGE_FAILED") throw err;
      console.warn("evaluateAchievementsOffline error:", err);
      return { success: true };
    }
  }

  async function scoreOfflineQuizAttempt(attempt) {
    var registryResponse = await fetch("/assets/data/quizzes/registry.json");
    if (!registryResponse.ok) throw new Error("Quiz registry unavailable");
    var registry = await registryResponse.json();
    var info = registry[attempt.quizId];
    if (!info || !info.file) throw new Error("Unknown quiz");
    var quizResponse = await fetch("/assets/data/quizzes/" + info.file);
    if (!quizResponse.ok) throw new Error("Quiz unavailable");
    var quiz = await quizResponse.json();
    var items = quiz.items || [];
    if (!items.length) throw new Error("Empty quiz");
    if (attempt.answerFormat !== "original-option-indices-v2") throw new Error("Unsupported saved answer format");
    var correct = 0;
    items.forEach(function (item) {
      var selected = (attempt.answers || {})[item.id];
      var expected = item.answer;
      if (Array.isArray(selected) && Array.isArray(expected) && selected.length === expected.length &&
          new Set(selected).size === selected.length && expected.every(function (index) { return selected.includes(index); })) correct++;
    });
    var threshold = Number(quiz.threshold === undefined ? info.threshold : quiz.threshold);
    if (!Number.isFinite(threshold)) threshold = 0.8;
    var score = correct / items.length;
    return Object.assign({}, attempt, { score: score, correct: correct, total: items.length,
      passed: score >= threshold, threshold: threshold, timestamp: attempt.timestamp || Date.now(), userId: "offline_user" });
  }

  // Ответы нужны только в локальной офлайн-версии. В облачной проверке
  // эталоны остаются на сервере.
  var MATH_PRACTICE_ANSWER_KEYS = {
    "algebra-vectors": { sum: [5, 2, 2], combo: [-10, 4, 9] },
    "algebra-scalar-product": { dot: -9, angle: { choice: 2 } },
    "algebra-matrix-mult": {
      ab: [[19, 22], [43, 50]], ba: [[23, 34], [31, 46]],
      commutative: { choice: 1 }, shape: { choice: 2 },
      symmetric: { choice: 1 }, complexity: { choice: 2 }
    },
    "algebra-matrix-rank": { rank: 2, dependent: { choice: 0 } },
    "algebra-determinant": { det: 10 },
    "algebra-eigen": { p: -7, q: 10, eigenvalues: [2, 5], action: { choice: 0 } },
    "calc-graph-func": { f0: 0.5, fpi2: 0.5 + Math.E, period: { choice: 2 } },
    "calc-graph-2d": { f00: 0, f11: Math.sin(2), max: 1, levels: { choice: 1 } },
    "calc-composition": { formula: { choice: 0 }, gf: 1, fg: 0.25, parity: { choice: 0 } },
    "calc-derivative": { a: 3, b: -6, c: 2, at2: 2 },
    "calc-partial": { dx: { choice: 0 }, dx12: 4 + Math.E, dy12: 13 },
    "calc-extrema": { points: [1, 3], xmax: 1, fmin: 1 },
    "calc-gradient": { formula: { choice: 0 }, at: [0, 2, 4] },
    "calc-metric": { euclid: Math.sqrt(29), manhattan: 9 },
    "calc-norm": { l1: 8, l2: Math.sqrt(26), linf: 4 },
    "prob-expectation-variance": { mean: 1.1, var: 0.49 },
    "prob-sample-stats": { mean: 5, var: 5.5, var_corrected: 44 / 7, std: Math.sqrt(5.5) },
    "prob-mode-median": { mode: 7, median: 6, median_outlier: 7, robust: { choice: 0 } },
    "prob-quantiles": { quartiles: [5, 8, 12.5], p90: 15, iqr: 7.5, outliers: { choice: 2 } }
  };

  function parseMathPracticeNumber(input) {
    if (typeof input === "number") return Number.isFinite(input) ? input : null;
    var source = String(input == null ? "" : input).trim();
    if (!source) return null;
    source = source
      .replace(/−|–/g, "-")
      .replace(/×|·|⋅/g, "*")
      .replace(/÷/g, "/")
      .replace(/\\left|\\right/g, "")
      .replace(/\\pi\b/gi, "pi")
      .replace(/\\sqrt\b/g, "sqrt")
      .replace(/,/g, ".");

    var tokens = [];
    for (var i = 0; i < source.length;) {
      var ch = source[i];
      if (/\s/.test(ch)) { i++; continue; }
      var number = source.slice(i).match(/^(?:\d+(?:\.\d*)?|\.\d+)/);
      if (number) {
        tokens.push({ type: "number", value: Number(number[0]) });
        i += number[0].length;
        continue;
      }
      var word = source.slice(i).match(/^[a-z]+/i);
      if (word) {
        var name = word[0].toLowerCase();
        if (name === "pi") tokens.push({ type: "constant", value: Math.PI });
        else if (name === "e") tokens.push({ type: "constant", value: Math.E });
        else if (name === "sqrt") tokens.push({ type: "sqrt" });
        else return null;
        i += word[0].length;
        continue;
      }
      if (ch === "π") { tokens.push({ type: "constant", value: Math.PI }); i++; continue; }
      if (ch === "√") { tokens.push({ type: "sqrt" }); i++; continue; }
      if ("+-*/^()".includes(ch)) {
        tokens.push({ type: ch === "(" || ch === ")" ? ch : "operator", value: ch });
        i++;
        continue;
      }
      return null;
    }

    var at = 0;
    function expression() {
      var value = term();
      while (tokens[at]?.type === "operator" && (tokens[at].value === "+" || tokens[at].value === "-")) {
        var op = tokens[at++].value;
        var right = term();
        value = op === "+" ? value + right : value - right;
      }
      return value;
    }
    function term() {
      var value = unary();
      while (true) {
        var token = tokens[at];
        if (token?.type === "operator" && (token.value === "*" || token.value === "/")) {
          var op = tokens[at++].value;
          var right = unary();
          value = op === "*" ? value * right : value / right;
          continue;
        }
        // Неявное умножение: 2π, 3sqrt(2), 2(1+1).
        if (token && ["constant", "sqrt", "("].includes(token.type)) {
          value *= unary();
          continue;
        }
        return value;
      }
    }
    function unary() {
      var token = tokens[at];
      if (token?.type === "operator" && (token.value === "+" || token.value === "-")) {
        at++;
        var value = unary();
        return token.value === "-" ? -value : value;
      }
      return power();
    }
    function power() {
      var value = primary();
      if (tokens[at]?.type === "operator" && tokens[at].value === "^") {
        at++;
        value = Math.pow(value, unary());
      }
      return value;
    }
    function primary() {
      var token = tokens[at++];
      if (!token) throw new Error("missing value");
      if (token.type === "number" || token.type === "constant") return token.value;
      if (token.type === "(") {
        var value = expression();
        if (tokens[at++]?.type !== ")") throw new Error("missing closing parenthesis");
        return value;
      }
      if (token.type === "sqrt") {
        var radicand;
        if (tokens[at]?.type === "(") {
          at++;
          radicand = expression();
          if (tokens[at++]?.type !== ")") throw new Error("missing closing parenthesis");
        } else radicand = unary();
        if (radicand < 0) throw new Error("negative square root");
        return Math.sqrt(radicand);
      }
      throw new Error("invalid value");
    }

    try {
      var result = expression();
      return at === tokens.length && Number.isFinite(result) ? result : null;
    } catch (_) {
      return null;
    }
  }

  function checkMathPracticeAnswers(params) {
    var questionId = params && params.questionId;
    var answerKey = MATH_PRACTICE_ANSWER_KEYS[questionId];
    if (!answerKey || params.targetPage !== "practise/math.html") {
      return {
        correct: false,
        fields: {},
        error: "Для этой задачи офлайн-проверка пока не настроена."
      };
    }
    var answers = params.answers || {};
    var fields = {};
    Object.keys(answerKey).forEach(function (fieldId) {
      var expected = answerKey[fieldId];
      var input = answers[fieldId];
      if (expected && !Array.isArray(expected) && typeof expected === "object" && Object.prototype.hasOwnProperty.call(expected, "choice")) {
        var choiceCorrect = input !== null && input !== undefined && input !== "" && Number.isInteger(Number(input)) && Number(input) === expected.choice;
        fields[fieldId] = { correct: choiceCorrect };
        return;
      }
      if (!Array.isArray(expected)) {
        var numeric = parseMathPracticeNumber(input);
        var numericStatus = numeric === null ? "parse" : Math.abs(numeric - expected) <= 0.01 + 1e-12;
        fields[fieldId] = { correct: numericStatus === true, cells: [numericStatus] };
        return;
      }
      if (expected.length > 0 && Array.isArray(expected[0])) {
        var rows = Array.isArray(input) ? input : [];
        var matrixCells = expected.map(function (row, r) {
          var inputRow = Array.isArray(rows[r]) ? rows[r] : [];
          return row.map(function (value, c) {
            var parsed = parseMathPracticeNumber(inputRow[c]);
            return parsed === null ? "parse" : Math.abs(parsed - value) <= 0.01 + 1e-12;
          });
        });
        var matrixCorrect = rows.length === expected.length && matrixCells.every(function (row, r) {
          return Array.isArray(rows[r]) && rows[r].length === expected[r].length && row.every(function (cell) { return cell === true; });
        });
        fields[fieldId] = { correct: matrixCorrect, cells: matrixCells };
        return;
      }
      var values = Array.isArray(input) ? input : [];
      var unordered = questionId === "algebra-eigen" && fieldId === "eigenvalues" || questionId === "calc-extrema" && fieldId === "points";
      var vectorCells;
      if (unordered) {
        var unmatched = expected.slice();
        vectorCells = values.map(function (raw) {
          var parsed = parseMathPracticeNumber(raw);
          if (parsed === null) return "parse";
          var found = unmatched.findIndex(function (value) { return Math.abs(parsed - value) <= 0.01 + 1e-12; });
          if (found < 0) return false;
          unmatched.splice(found, 1);
          return true;
        });
      } else {
        vectorCells = expected.map(function (value, i) {
          var parsed = parseMathPracticeNumber(values[i]);
          return parsed === null ? "parse" : Math.abs(parsed - value) <= 0.01 + 1e-12;
        });
      }
      var vectorCorrect = values.length === expected.length && vectorCells.length === expected.length && vectorCells.every(function (cell) { return cell === true; });
      fields[fieldId] = { correct: vectorCorrect, cells: vectorCells };
    });
    return {
      correct: Object.keys(fields).length === Object.keys(answerKey).length && Object.keys(fields).every(function (fieldId) { return fields[fieldId].correct; }),
      fields: fields
    };
  }
  window.__datalabOfflineMathCheck = checkMathPracticeAnswers;

  var offlineApi = {
    call: async function (name, data) {
      if (typeof offlineApi[name] === "function") {
        return await offlineApi[name](data);
      }
      return { success: true };
    },
    checkPracticeAnswers: async function (params) { return checkMathPracticeAnswers(params); },
    getStaffDirectory: async function () { return [OFFLINE_STUDENT]; },
    getStaffDirectoryMap: async function () { return { [OFFLINE_STUDENT.uid]: OFFLINE_STUDENT }; },

    completeOnboarding: async function () {
      await makeRef("users/offline_user").update({ introShown: true, introShownAt: Date.now() });
      try { localStorage.setItem("introShown", "true"); } catch (e) {}
      await evaluateAchievementsOffline();
      return { success: true };
    },

    setQuestionProgress: async function (questionId, completed = true) {
      if (completed) {
        await makeRef("users/offline_user/progress/" + questionId).set({
          completed: true,
          timestamp: Date.now(),
          userId: "offline_user"
        });
      } else {
        await makeRef("users/offline_user/progress/" + questionId).remove();
      }

      try {
        var anon = JSON.parse(localStorage.getItem("anonymous_progress") || "{}");
        if (completed) {
          anon[questionId] = { completed: true, timestamp: Date.now() };
        } else {
          delete anon[questionId];
        }
        writeStorageConfirmed("anonymous_progress", anon);
      } catch (e) {
        if (e.code === "OFFLINE_STORAGE_FAILED") throw e;
        throw reportStorageFailure(e, true);
      }

      var result = await evaluateAchievementsOffline();
      clearStorageFailure();
      return result;
    },

    setQuestionProgressBatch: async function (params) {
      var updates = params && params.updates ? params.updates : (params || {});
      var dbUpdates = {};
      var anon = JSON.parse(localStorage.getItem("anonymous_progress") || "{}");
      for (var qId in updates) {
        var val = updates[qId];
        if (val === true || (val && val.completed !== false)) {
          dbUpdates["users/offline_user/progress/" + qId] = {
            completed: true,
            timestamp: Date.now(),
            userId: "offline_user"
          };
          anon[qId] = { completed: true, timestamp: Date.now() };
        } else {
          dbUpdates["users/offline_user/progress/" + qId] = null;
          delete anon[qId];
        }
      }
      await makeRef().update(dbUpdates);
      writeStorageConfirmed("anonymous_progress", anon);
      var result = await evaluateAchievementsOffline();
      clearStorageFailure();
      return result;
    },

    setQuestionDifficulty: async function (questionId, rating) {
      var key = String(questionId || "").replace(/[.#$[\]/]/g, "_");
      if (!key) throw new Error("Question ID is required");
      if (rating === null || rating === undefined) {
        await makeRef("users/offline_user/difficultyRatings/" + key).remove();
        clearStorageFailure();
        return { success: true, userRating: null, averageRating: 0, totalRatings: 0, lastUpdated: Date.now() };
      }
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error("Rating must be between 1 and 5");
      await makeRef("users/offline_user/difficultyRatings/" + key).set(rating);
      clearStorageFailure();
      return { success: true, userRating: rating, averageRating: rating, totalRatings: 1, lastUpdated: Date.now() };
    },

    getQuestionDifficulty: async function (questionIds) {
      var snap = await makeRef("users/offline_user/difficultyRatings").once("value");
      var ratings = snap.val() || {};
      var items = {};
      (questionIds || []).forEach(function (id) {
        var r = ratings[id];
        items[id] = {
          userRating: r !== undefined ? r : null,
          averageRating: r !== undefined ? r : 0,
          totalRatings: r !== undefined ? 1 : 0
        };
      });
      return { items: items };
    },

    getQuestionReviewLater: async function () {
      var snap = await makeRef("users/offline_user/reviewLater").once("value");
      return snap.val() || {};
    },

    setQuestionReviewLater: async function (questionId, shouldReview) {
      var key = String(questionId || "").replace(/[.#$[\]/]/g, "_");
      if (!key) throw new Error("Question ID is required");
      if (shouldReview) await makeRef("users/offline_user/reviewLater/" + key).set(true);
      else await makeRef("users/offline_user/reviewLater/" + key).remove();
      clearStorageFailure();
      return { success: true, marked: !!shouldReview };
    },

    submitQuizAttempt: async function (attempt) {
      var result = await scoreOfflineQuizAttempt(attempt);
      var id = attempt.requestId || makeRef().push().key;
      if (/[.#$\[\]\/]/.test(id)) throw new Error("Invalid attempt ID");
      var ref = makeRef("users/offline_user/quizResults/" + result.quizId + "/" + id);
      var previous = (await ref.once("value")).val();
      if (previous) result = previous;
      else await ref.set(result);
      var achievements = await evaluateAchievementsOffline();
      clearStorageFailure();
      return { success: true, result: result };
    },

    repairOfflineQuizResults: async function () {
      var db = loadDb();
      var source = db.users.offline_user.quizResults || {};
      var grouped = {};
      var changed = false;
      for (var id of Object.keys(source)) {
        var entry = source[id];
        if (entry && typeof entry.quizId === "string" && entry.answers) {
          var result = entry;
          if (typeof result.score !== "number") result = await scoreOfflineQuizAttempt(entry);
          if (!grouped[entry.quizId]) grouped[entry.quizId] = {};
          grouped[entry.quizId][id] = result;
          changed = true;
        } else if (entry && typeof entry === "object") {
          grouped[id] = Object.assign({}, grouped[id] || {}, entry);
        }
      }
      if (changed) {
        db.users.offline_user.quizResults = grouped;
        saveDb(db);
      }
    },

    reconcileAchievements: async function () {
      return await evaluateAchievementsOffline();
    },

    selectAchievement: async function (achievementId) {
      await makeRef("users/offline_user/selectedAchievement").set(achievementId);
      return { success: true };
    },

    submitDailyReport: async function (report) {
      var reportId = makeRef("daily_reports/offline_user").push().key;
      var timestamp = Date.now();
      var dateParts = {};
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit"
      }).formatToParts(new Date(timestamp)).forEach(function (part) { dateParts[part.type] = part.value; });
      var savedReport = Object.assign({}, report, {
        uid: "offline_user", reportId: reportId, timestamp: timestamp,
        date: dateParts.year + "-" + dateParts.month + "-" + dateParts.day
      });
      var updates = {};
      updates["daily_reports/offline_user/" + reportId] = savedReport;
      // Preserve the legacy mirror used by offline achievement counting.
      updates["users/offline_user/reports/" + reportId] = { report: savedReport, timestamp: timestamp };
      await makeRef().update(updates);
      var achievements = await evaluateAchievementsOffline();
      clearStorageFailure();
      return Object.assign({}, achievements, { success: true, reportId: reportId });
    },

    deleteDailyReport: async function (params) {
      // The report UI passes the ID as a string; also accept the object API form.
      var reportId = typeof params === "string" ? params : params && params.reportId;
      if (typeof reportId !== "string" || !reportId.trim() || /[.#$\[\]\/]/.test(reportId)) {
        throw new Error("Invalid report ID");
      }
      if (reportId) {
        var db = loadDb();
        removeValueAt(db, ["daily_reports", "offline_user", reportId]);
        removeValueAt(db, ["users", "offline_user", "reports", reportId]);
        saveDb(db);
        dispatch("daily_reports/offline_user");
        dispatch("users/offline_user/reports");
        clearStorageFailure();
      }
      return { success: true };
    },

    getTeorminCards: async function (params) {
      var cards = await loadAllTeorminCards();
      var qId = (params && typeof params === "object") ? params.questionId : null;
      var targetPage = (params && typeof params === "object") ? params.targetPage : null;
      var scope = (typeof params === "string") ? params : (params && params.scope ? params.scope : "progress");

      if (qId) {
        var filtered = cards.filter(function (c) {
          return c.questionId === qId && (!targetPage || c.targetPage === targetPage);
        });
        return {
          cards: filtered,
          accessibleCount: filtered.length,
          totalCount: filtered.length,
          scope: "single"
        };
      }

      return {
        cards: cards,
        accessibleCount: cards.length,
        totalCount: cards.length,
        scope: scope || "all"
      };
    },

    syncRepetitionProgress: async function () {
      var res = await evaluateAchievementsOffline();
      return {
        success: true,
      };
    },
    getSearchCatalog: async function () { return { catalog: [] }; },
    searchPageContent: async function () { return { results: [] }; },
    updateOwnTelegramNotificationSettings: async function () { return { success: true }; },

    // --- KANBAN BOARD APIS ---
    listKanbanTasks: async function (params) {
      var snap = await makeRef("kanbanTasks").once("value");
      var val = snap.val() || {};
      var items = [];
      if (Array.isArray(val)) {
        items = val.filter(Boolean);
      } else if (typeof val === "object") {
        for (var k in val) {
          if (val[k]) {
            var t = Object.assign({}, val[k]);
            if (!t.id) t.id = k;
            items.push(t);
          }
        }
      }

      if (params && params.studentId) {
        items = items.filter(function (t) { return !t.studentId || t.studentId === params.studentId; });
      }
      if (params && params.type && params.type !== "all") {
        items = items.filter(function (t) { return t.type === params.type; });
      }
      if (params && params.query) {
        var q = params.query.toLowerCase();
        items = items.filter(function (t) {
          return (t.title || "").toLowerCase().indexOf(q) !== -1 || (t.description || "").toLowerCase().indexOf(q) !== -1;
        });
      }

      return {
        items: items,
        total: items.length,
        nextOffset: null,
        summary: {
          total: items.length,
          own: items.length,
          overdue: 0,
          columns: {
            todo: items.filter(function (t) { return t.boardStatus === "todo"; }).length,
            doing: items.filter(function (t) { return t.boardStatus === "doing"; }).length,
            review: items.filter(function (t) { return t.boardStatus === "review"; }).length,
            done: items.filter(function (t) { return t.boardStatus === "done"; }).length
          },
          doneSprints: [],
          visibleTotal: items.length
        }
      };
    },

    saveKanbanTask: async function (arg1, arg2) {
      var taskId = "";
      var patch = {};

      if (typeof arg1 === "string") {
        taskId = arg1;
        patch = arg2 || {};
      } else if (arg1 && typeof arg1 === "object") {
        taskId = arg1.taskId || "";
        patch = arg1.patch || arg1.payload || arg1;
      }

      if (!taskId) {
        taskId = "task_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
      }

      var taskData = Object.assign(
        {
          id: taskId,
          studentId: "offline_user",
          status: "open",
          boardStatus: "todo",
          createdAt: Date.now(),
          createdBy: "offline_user"
        },
        patch
      );

      await makeRef("kanbanTasks/" + taskId).update(taskData);

      var taskSnap = await makeRef("kanbanTasks/" + taskId).once("value");
      var fullTask = taskSnap.val() || {};
      if (fullTask.roadmapMilestoneId) {
        var studentId = fullTask.studentId || "offline_user";
        var isDone = fullTask.boardStatus === "done" || fullTask.status === "done";
        await makeRef("studentRoadmaps/" + studentId + "/milestones/" + fullTask.roadmapMilestoneId).update({
          status: isDone ? "done" : "assigned",
          completedAt: isDone ? Date.now() : null,
          updatedAt: Date.now()
        });
      }

      return { success: true, taskId: taskId, task: taskData };
    },

    deleteKanbanTask: async function (arg1) {
      var taskId = typeof arg1 === "string" ? arg1 : (arg1 && arg1.taskId ? arg1.taskId : "");
      if (taskId) {
        await makeRef("kanbanTasks/" + taskId).remove();
      }
      return { success: true };
    }
  };

  window.achievementApi = Object.assign(window.achievementApi || {}, offlineApi);

  window.staffApi = Object.assign(window.staffApi || {}, {
    getStaffDirectory: offlineApi.getStaffDirectory,
    getStaffDirectoryMap: offlineApi.getStaffDirectoryMap,
    getStaffStudentDetail: async function (studentId) {
      return {
        access: { categories: {}, labels: {} },
        student: OFFLINE_STUDENT
      };
    },
    scheduleRoadmapMilestone: async function (params) {
      var studentId = (params && params.studentId) || "offline_user";
      var milestoneId = params && params.milestoneId;
      var task = (params && params.task) || {};
      var pages = (params && params.pages) || [];

      var taskId = "roadmap_" + (milestoneId || "task") + "_" + Date.now();
      var newTask = Object.assign({}, task, {
        id: taskId,
        studentId: studentId,
        roadmapMilestoneId: milestoneId,
        status: "open",
        boardStatus: "todo",
        createdAt: Date.now(),
        createdBy: "offline_user"
      });

      await makeRef("kanbanTasks/" + taskId).set(newTask);
      if (milestoneId) {
        await makeRef("studentRoadmaps/" + studentId + "/milestones/" + milestoneId).set({
          status: "assigned",
          assignedAt: Date.now()
        });
      }

      return {
        success: true,
        taskId: taskId,
        grantedLabels: pages,
        grantedCategories: []
      };
    },
    listKanbanTasks: offlineApi.listKanbanTasks,
    saveKanbanTask: offlineApi.saveKanbanTask,
    deleteKanbanTask: offlineApi.deleteKanbanTask
  });


  // ============================================================================
  // 6. Offline Seed Data & Handlers for Interviews, English Club & Recruiters
  // ============================================================================
  var DEFAULT_ENGLISH_CLUB_RECORDS = [
    {
      id: "esc_2026_10_25",
      title: "ESC #6 — System Design & Architecture Trade-offs in English",
      description: "Как защищать архитектурные компромиссы (latency vs accuracy, caching, fallback) и отвечать на жёсткие вопросы интервьюера на этапе ML System Design.",
      addedAt: "2026-10-25",
      mediaType: "audio",
      videoUrl: "",
      pdfUrl: "",
      mistakesCount: 9
    },
    {
      id: "esc_2026_10_18",
      title: "ESC #5 — Behavioral Interview: Conflict Resolution & Ownership (CARL)",
      description: "Разбор историй о несогласии с продакт-менеджером и факапах в продакшене. Как говорить от первого лица без токсичности и оправданий.",
      addedAt: "2026-10-18",
      mediaType: "audio",
      videoUrl: "",
      pdfUrl: "",
      mistakesCount: 8
    },
    {
      id: "esc_2026_10_11",
      title: "ESC #4 — Explaining LLM, RAG & Hallucinations to Stakeholders",
      description: "Объяснение метрик ретривала, чанкинга, стоимости токенов и галлюцинаций нетехническим заказчикам и нанимающим менеджерам.",
      addedAt: "2026-10-11",
      mediaType: "audio",
      videoUrl: "",
      pdfUrl: "",
      mistakesCount: 8
    },
    {
      id: "esc_2026_10_04",
      title: "ESC #3 — Product Analytics & A/B Testing Deep Dive",
      description: "Разбор дизайна экспериментов, CUPED, p-value, MDE и сетевых эффектов на живом английском.",
      addedAt: "2026-10-04",
      mediaType: "audio",
      videoUrl: "",
      pdfUrl: "",
      mistakesCount: 7
    },
    {
      id: "esc_2026_09_27",
      title: "ESC #2 — Self-Pitch & Project Walkthrough ('Tell me about yourself')",
      description: "Тренировка 90-секундного питча Present → Past → Future и презентации своего главного проекта без рунглиша.",
      addedAt: "2026-09-27",
      mediaType: "audio",
      videoUrl: "",
      pdfUrl: "",
      mistakesCount: 8
    },
    {
      id: "esc_2026_09_20",
      title: "ESC #1 — Daily Standups, Code Reviews & Pushing Back Politely",
      description: "Фразы для ежедневных сиink-созвонов, обсуждения PR в GitHub и вежливого отказа от нереалистичных сроков.",
      addedAt: "2026-09-20",
      mediaType: "audio",
      videoUrl: "",
      pdfUrl: "",
      mistakesCount: 7
    }
  ];

  var DEFAULT_ENGLISH_CLUB_MISTAKES = {
    esc_2026_10_25: {
      intro: "На созвоне по ML System Design чаще всего ломались конструкции условных предложений (Conditionals при обсуждении fallback-сценариев), предлоги с метриками и кальки со словом «компромисс».",
      summary: [
        { title: "Conditionals в архитектуре", text: "После «If the primary model fails…» в главной части нужен \"will fall back\" или \"falls back\", а не \"would\" без второго условия." },
        { title: "Trade-off vs Compromise", text: "В инженерном английском «компромисс между скоростью и точностью» — это \"a trade-off between latency and accuracy\", тогда как \"compromise\" часто звучит как «поступиться принципами/безопасностью»." },
        { title: "Предлоги с метриками", text: "Метрика растёт НА 5% — \"increases by 5%\", а не \"on 5%\". Задержка ниже 50 мс — \"under 50 ms\" или \"within a 50 ms SLA\"." }
      ],
      groups: [
        {
          title: "Архитектура и компромиссы",
          items: [
            {
              said: "We made a compromise between latency and quality of ranking.",
              better: "We made a deliberate trade-off between p99 latency and ranking quality.",
              why: "Слово \"trade-off\" — точный инженерный термин для баланса конкурирующих характеристик системы, а \"deliberate\" подчёркивает осознанность выбора."
            },
            {
              said: "Our service can't survive such big RPS without cache.",
              better: "Our service wouldn't sustain that throughput without a caching layer.",
              why: "\"Sustain throughput\" и \"caching layer\" звучат на уровне Senior System Design, тогда как \"survive big RPS\" — разговорная калька."
            },
            {
              said: "If the GPU service will die, we return popular items.",
              better: "If the GPU inference service times out, we gracefully degrade to a popularity-based fallback.",
              why: "В придаточном условия после \"if\" используется Present Simple (\"times out\"), а приём подмены тяжёлой модели лёгкой эвристикой называется \"graceful degradation\"."
            }
          ]
        },
        {
          title: "Метрики и числа",
          items: [
            {
              said: "We decreased latency on 40 percents.",
              better: "We cut p99 latency by 40%.",
              why: "Разница значений передаётся предлогом \"by\" (\"cut/reduced by 40%\"), а слово \"percent\" с числительными всегда в единственном числе."
            },
            {
              said: "The dataset was very imbalanced, frauds were only 0.2%.",
              better: "The dataset was heavily skewed, with positive fraud cases accounting for just 0.2%.",
              why: "\"Heavily skewed / class-imbalanced\" и \"accounting for\" — естественные обороты для описания распределения классов."
            },
            {
              said: "Offline metric grew up, but online A/B was neutral.",
              better: "Offline ROC-AUC improved, but it didn't translate into a statistically significant online lift.",
              why: "\"Grew up\" означает «повзрослел» (о ребёнке). Для метрик используйте \"improved / increased\" и связку \"translate into online lift\"."
            }
          ]
        }
      ],
      good: [
        "\"Let's start by clarifying the functional and non-functional requirements, especially our latency budget.\" — идеальный старт секции ML System Design",
        "\"To keep the feature store fresh without blowing up infrastructure costs, we split features into batch and near-real-time.\" — чёткое объяснение двухскоростной архитектуры",
        "\"We decoupled candidate generation from heavy cross-encoder reranking.\" — точная терминология многоступенчатого ранжирования"
      ]
    }
  };

  var DEFAULT_ENGLISH_CLUB_GLOSSARY = [
    // 1. colleagues (Общение с коллегами — 22 фразы)
    { key: "ec_col_1", category: "colleagues", phrase: "to be on the same page", meaning: "одинаково понимать задачу / синхронизироваться", when: "В начале или конце обсуждения, чтобы убедиться, что нет разночтений.", example: "Just to make sure we're on the same page — are we freezing the feature set today?" },
    { key: "ec_col_2", category: "colleagues", phrase: "to push back on smth", meaning: "вежливо, но твёрдо возразить / отклонить нереалистичный запрос", when: "Когда продакт или стейкхолдер просит сделать задачу без тестов или за невозможный срок.", example: "I had to push back on shipping the model without an offline backtest." },
    { key: "ec_col_3", category: "colleagues", phrase: "to have the bandwidth for smth", meaning: "иметь свободный ресурс / время на задачу", when: "Когда нужно оценить свою загрузку в спринте.", example: "I don't have the bandwidth to take on another ad-hoc analysis this week." },
    { key: "ec_col_4", category: "colleagues", phrase: "to loop someone in", meaning: "подключить коллегу к переписке или обсуждению", when: "Когда вопрос затрагивает смежную команду (например, Data Engineering или DevOps).", example: "Let's loop in the platform team before we change the Kafka schema." },
    { key: "ec_col_5", category: "colleagues", phrase: "to take it offline", meaning: "обсудить узкий вопрос отдельно после общей встречи", when: "На дейлике, когда спор двух человек затягивает всю команду.", example: "That's a deep topic — let's take it offline right after standup." },
    { key: "ec_col_6", category: "colleagues", phrase: "a blocker / to be blocked by", meaning: "критическое препятствие, останавливающее работу", when: "На стендапе для быстрой эскалации зависимости.", example: "I'm currently blocked by the missing read permissions on the production replica." },
    { key: "ec_col_7", category: "colleagues", phrase: "nit / nitpick (in PR)", meaning: "мелкое косметическое замечание на код-ревью (не блокирует мерж)", when: "В комментариях к Pull Request, чтобы коллега не воспринимал правку как критическую ошибку.", example: "Nit: could we rename this variable to `user_embeddings` for clarity?" },
    { key: "ec_col_8", category: "colleagues", phrase: "LGTM (Looks Good To Me)", meaning: "всё отлично, аппрувлю пулл-реквест", when: "При одобрении кода или дизайн-дока.", example: "Tested locally, latency is within SLA — LGTM!" },
    { key: "ec_col_9", category: "colleagues", phrase: "to sanity-check smth", meaning: "быстро проверить на адекватность / отсутствие грубых ошибок", when: "Когда просите коллегу взглянуть на цифры или логику перед презентацией.", example: "Could you sanity-check my SQL query for the retention cohort?" },
    { key: "ec_col_10", category: "colleagues", phrase: "to circle back to smth", meaning: "вернуться к вопросу позже, когда появятся данные", when: "На созвоне, если ответ требует проверки в логах.", example: "Let me check the Grafana dashboard and circle back to you in an hour." },
    { key: "ec_col_11", category: "colleagues", phrase: "to give a heads-up", meaning: "заранее предупредить о грядущем изменении или риске", when: "Перед деплоем, миграцией или задержкой срока.", example: "Just a quick heads-up: we're rolling out the new tokenizer at 14:00 UTC." },
    { key: "ec_col_12", category: "colleagues", phrase: "low-hanging fruit", meaning: "быстрая победа / задача, дающая заметный результат малыми усилиями", when: "При приоритизации бэклога спринта.", example: "Fixing the batch size is low-hanging fruit that will immediately cut GPU cost by 20%." },
    { key: "ec_col_13", category: "colleagues", phrase: "to go down the rabbit hole", meaning: "закопаться в мелкие детали и потерять фокус", when: "Когда исследование уходит слишком далеко от бизнес-цели.", example: "Let's not go down the rabbit hole of custom CUDA kernels before we test FP16." },
    { key: "ec_col_14", category: "colleagues", phrase: "to align with stakeholders", meaning: "согласовать цели и ожидания со смежниками/заказчиками", when: "При запуске нового проекта или изменении скоупа.", example: "First, I aligned with product and legal on the acceptable false-positive rate." },
    { key: "ec_col_15", category: "colleagues", phrase: "action items", meaning: "конкретные шаги с ответственными по итогам встречи", when: "В финале митинга для фиксации договорённостей.", example: "Let's recap our action items before we wrap up." },
    { key: "ec_col_16", category: "colleagues", phrase: "to chime in", meaning: "вставить слово / добавить комментарий в беседу", when: "Когда хотите вежливо дополнить коллегу на звонке.", example: "Sorry to chime in, but we already ran a similar test in Q2." },
    { key: "ec_col_17", category: "colleagues", phrase: "to keep someone in the loop", meaning: "держать в курсе прогресса", when: "В коммуникации с менеджером или заказчиком.", example: "I'll keep you in the loop as the A/B test accumulates traffic." },
    { key: "ec_col_18", category: "colleagues", phrase: "ballpark estimate", meaning: "грубая прикидка (по срокам, стоимости или нагрузке)", when: "На планировании, когда точных расчётов ещё нет.", example: "As a ballpark estimate, re-indexing the corpus will take around three hours." },
    { key: "ec_col_19", category: "colleagues", phrase: "to scope out a task", meaning: "определить границы и объём задачи", when: "Перед началом разработки новой фичи.", example: "We spent Monday scoping out the MVP for the fraud detection service." },
    { key: "ec_col_20", category: "colleagues", phrase: "under the hood", meaning: "под капотом / во внутренней реализации", when: "Когда переходите от внешнего API к деталям алгоритма.", example: "Under the hood, FastAPI relies on Starlette and Pydantic v2." },
    { key: "ec_col_21", category: "colleagues", phrase: "to iron out the kinks", meaning: "дошлифовать шероховатости / устранить мелкие баги перед релизом", when: "На этапе тестовой обкатки сервиса.", example: "We need a couple of days in staging to iron out the kinks." },
    { key: "ec_col_22", category: "colleagues", phrase: "to rubber-duck a problem", meaning: "проговорить проблему вслух, чтобы самому найти решение", when: "При совместной отладке сложного бага.", example: "Do you have five minutes? I just need to rubber-duck this gradient NaN issue." },

    // 2. pitch (Self-pitch — 20 фраз)
    { key: "ec_pit_1", category: "pitch", phrase: "to spearhead an initiative", meaning: "возглавить и продрайвить ключевую инициативу", when: "В рассказе о себе для демонстрации лидерства и Ownership.", example: "I spearheaded the migration from legacy rules to a real-time GBDT scoring pipeline." },
    { key: "ec_pit_2", category: "pitch", phrase: "end-to-end ownership", meaning: "полная ответственность за проект от идеи до продакшена и мониторинга", when: "При позиционировании себя на уровень Senior.", example: "I took end-to-end ownership of the visual search service." },
    { key: "ec_pit_3", category: "pitch", phrase: "battle-tested in production", meaning: "проверенный в реальном высоконагруженном продакшене", when: "Подчёркивая практический, а не академический характер вашего опыта.", example: "My focus is building battle-tested ML systems that handle 10k+ RPS." },
    { key: "ec_pit_4", category: "pitch", phrase: "to move the needle on [metric]", meaning: "дать ощутимый, значимый прирост ключевой бизнес-метрики", when: "В рассказе о результатах своих проектов.", example: "Our reranking model moved the needle on checkout conversion, lifting it by 2.4%." },
    { key: "ec_pit_5", category: "pitch", phrase: "to bridge the gap between X and Y", meaning: "соединить два мира (например, ML-исследования и бизнес/инфраструктуру)", when: "Описывая свою суперсилу на стыке ролей.", example: "I enjoy bridging the gap between applied research and reliable production engineering." },
    { key: "ec_pit_6", category: "pitch", phrase: "track record of delivering", meaning: "подтверждённая история успешных релизов", when: "В первых двух предложениях ответа «Tell me about yourself».", example: "I'm a Senior ML Engineer with a five-year track record of delivering search and recsys products." },
    { key: "ec_pit_7", category: "pitch", phrase: "from scratch / greenfield project", meaning: "с нуля (новый проект без легаси)", when: "Рассказывая о запуске нового направления.", example: "I built the company's first automated feature store from scratch." },
    { key: "ec_pit_8", category: "pitch", phrase: "to wear multiple hats", meaning: "совмещать несколько ролей (например, DS, DE и MLOps)", when: "Объясняя широкий спектр навыков в стартапе или небольшой команде.", example: "In a lean team of four, I had to wear multiple hats — from data modeling to FastAPI deployment." },
    { key: "ec_pit_9", category: "pitch", phrase: "to scale smth 10x", meaning: "масштабировать систему на порядок по трафику или объёму данных", when: "Показывая готовность к нагрузкам Big Tech.", example: "We scaled the embedding pipeline 10x ahead of the Black Friday peak." },
    { key: "ec_pit_10", category: "pitch", phrase: "tangible business impact", meaning: "осязаемый, измеримый вклад в бизнес", when: "Объясняя, почему вам важен продуктовый результат.", example: "I thrive in product-driven teams where ML has a tangible business impact." },
    { key: "ec_pit_11", category: "pitch", phrase: "to streamline a workflow", meaning: "оптимизировать и ускорить рабочий процесс", when: "Говоря об автоматизации пайплайнов или аналитики.", example: "I streamlined our experiment evaluation workflow, cutting reporting time from two days to 15 minutes." },
    { key: "ec_pit_12", category: "pitch", phrase: "to cut infrastructure costs by X%", meaning: "сократить затраты на инфраструктуру/облако на X%", when: "Отличный инженерный результат, если не было прямого A/B-теста на выручку.", example: "By quantizing the model to INT8, I cut GPU infrastructure costs by 45%." },
    { key: "ec_pit_13", category: "pitch", phrase: "cross-functional collaboration", meaning: "взаимодействие со смежными функциями (продукт, бэкенд, дизайн, аналитика)", when: "Демонстрируя софт-скиллы.", example: "The project required tight cross-functional collaboration with mobile and billing teams." },
    { key: "ec_pit_14", category: "pitch", phrase: "my sweet spot is...", meaning: "моя самая сильная зона / любимый профиль задач", when: "Завершая самопрезентацию.", example: "My sweet spot is applied NLP and high-throughput inference optimization." },
    { key: "ec_pit_15", category: "pitch", phrase: "to turn ambiguous requirements into...", meaning: "превращать размытые бизнес-идеи в чёткую инженерную задачу", when: "Показывая сигнал уровня L5/Senior.", example: "I'm good at turning ambiguous product goals into measurable ML formulations." },
    { key: "ec_pit_16", category: "pitch", phrase: "to mentor junior engineers", meaning: "наставлять и развивать младших инженеров", when: "Отвечая про вклад в команду.", example: "Alongside my core roadmap, I mentored three junior data scientists through their onboarding." },
    { key: "ec_pit_17", category: "pitch", phrase: "to champion best practices", meaning: "продвигать и внедрять лучшие инженерные стандарты в команде", when: "Говоря о влиянии на инженерную культуру (CI/CD, тесты, код-ревью).", example: "I championed reproducible training configs and automated data validation across the tribe." },
    { key: "ec_pit_18", category: "pitch", phrase: "to sunset a legacy system", meaning: "аккуратно вывести из эксплуатации устаревшую систему", when: "Рассказывая о миграциях.", example: "We successfully sunset the legacy monolith without a single minute of downtime." },
    { key: "ec_pit_19", category: "pitch", phrase: "hands-on IC (Individual Contributor)", meaning: "практикующий инженер, который сам пишет код и обучает модели", when: "Уточняя, что вы не хотите уходить в чистый административный менеджмент.", example: "I want to stay a hands-on IC while leading technical architecture for the team." },
    { key: "ec_pit_20", category: "pitch", phrase: "to hit the ground running", meaning: "включиться в работу и начать приносить пользу с первых дней", when: "В финале питча.", example: "Given my background in fintech antifraud, I can hit the ground running on your risk scoring stack." },

    // 3. career (Собеседования и карьера — 22 фразы)
    { key: "ec_car_1", category: "career", phrase: "to walk someone through smth", meaning: "пошагово провести собеседника по своему решению или резюме", when: "На лайвкодинге или Project Deep Dive.", example: "Let me walk you through how we designed the offline validation split." },
    { key: "ec_car_2", category: "career", phrase: "in hindsight", meaning: "оглядываясь назад / с высоты сегодняшнего опыта", when: "В блоке Learning (CARL), отвечая на вопрос «Что бы вы сделали иначе?».", example: "In hindsight, we should have set up data drift alerts before scaling to 100% traffic." },
    { key: "ec_car_3", category: "career", phrase: "to weigh the pros and cons", meaning: "взвесить все за и против альтернативных решений", when: "Показывая осознанный выбор архитектуры.", example: "We weighed the pros and cons of fine-tuning Llama vs using a RAG pipeline." },
    { key: "ec_car_4", category: "career", phrase: "to get buy-in from leadership", meaning: "получить поддержку и одобрение (ресурсы/время) от руководства", when: "В историях про влияние (Influence without authority).", example: "I built a quick PoC in two days to get buy-in from leadership for the full rewrite." },
    { key: "ec_car_5", category: "career", phrase: "to disagree and commit", meaning: "аргументированно высказать несогласие, но поддержать общее решение команды", when: "В вопросах про конфликты и лидерские принципы.", example: "Once the team decided on the simpler heuristic for Q1, I disagreed and committed fully to shipping it." },
    { key: "ec_car_6", category: "career", phrase: "a post-mortem / blameless post-mortem", meaning: "разбор полётов после инцидента без поиска виноватых, ради починки процесса", when: "Отвечая на вопрос о вашем самом большом факапе.", example: "I led a blameless post-mortem and added a schema check to our CI pipeline." },
    { key: "ec_car_7", category: "career", phrase: "to de-risk a project", meaning: "снизить риски проекта на раннем этапе (через прототип или канарейку)", when: "Показывая сеньорское планирование.", example: "To de-risk the launch, we ran the new model in shadow mode for a week." },
    { key: "ec_car_8", category: "career", phrase: "what does success look like in the first 90 days?", meaning: "как выглядит успех на этой роли в первые 3 месяца?", when: "Идеальный вопрос нанимающему менеджеру в конце интервью.", example: "If I join the team, what does success look like in the first 90 days?" },
    { key: "ec_car_9", category: "career", phrase: "to cut scope / descope", meaning: "сократить второстепенный функционал, чтобы уложиться в жёсткий дедлайн", when: "В историях про Tight Deadlines.", example: "Instead of compromising code quality, we negotiated with the PM to descope two non-critical features." },
    { key: "ec_car_10", category: "career", phrase: "root cause analysis (RCA)", meaning: "поиск первопричины сбоя или падения метрики", when: "В аналитических кейсах и рассказах об инцидентах.", example: "My root cause analysis revealed that an upstream mobile release broke event logging." },
    { key: "ec_car_11", category: "career", phrase: "to back up an argument with data", meaning: "подкрепить свою позицию цифрами и фактами", when: "Рассказывая, как вы убедили коллегу в споре.", example: "Rather than arguing opinions, I backed up my proposal with latency benchmarks." },
    { key: "ec_car_12", category: "career", phrase: "total compensation (TC)", meaning: "совокупный доход (оклад + бонусы + акции/RSU)", when: "При обсуждении оффера с HR.", example: "Could you share the total compensation structure for the Senior level, including base, bonus, and equity?" },
    { key: "ec_car_13", category: "career", phrase: "to bridge a disagreement", meaning: "найти точку соприкосновения в споре", when: "В вопросах про Conflict Resolution.", example: "We bridged the disagreement by running a time-boxed 48-hour experiment." },
    { key: "ec_car_14", category: "career", phrase: "to take ownership of a mistake", meaning: "взять на себя ответственность за ошибку", when: "В вопросах про Failure.", example: "I immediately took ownership of the broken migration and rolled back within five minutes." },
    { key: "ec_car_15", category: "career", phrase: "key takeaway", meaning: "главный урок / ключевой вывод", when: "В финале ответа по схеме CARL.", example: "My key takeaway was that offline metrics mean nothing if feature latency violates the SLA." },
    { key: "ec_car_16", category: "career", phrase: "to manage expectations", meaning: "управлять ожиданиями заказчиков (предупреждать о рисках и ограничениях заранее)", when: "В поведенческих вопросах про работу с бизнесом.", example: "I proactively managed stakeholder expectations by sharing weekly precision-recall trade-off charts." },
    { key: "ec_car_17", category: "career", phrase: "to Think out loud", meaning: "рассуждать вслух", when: "На лайвкодинге и системном дизайне, чтобы интервьюер видел ход вашей мысли.", example: "I'll think out loud as I sketch the brute-force solution first, and then optimize it." },
    { key: "ec_car_18", category: "career", phrase: "edge case / corner case", meaning: "граничный / крайний случай (пустой вход, NaN, один элемент, переполнение)", when: "При тестировании своего кода на алгоритмической секции.", example: "Let's check the edge cases: an empty array, a single element, and all negative numbers." },
    { key: "ec_car_19", category: "career", phrase: "time and space complexity", meaning: "временная и пространственная сложность алгоритма (Big-O)", when: "После написания кода на лайвкодинге.", example: "This sliding-window approach runs in O(n) time complexity and O(k) auxiliary space." },
    { key: "ec_car_20", category: "career", phrase: "to bottleneck / a bottleneck", meaning: "узкое место системы, ограничивающее общую производительность", when: "На секции System Design и профилирования.", example: "Database serialization quickly became our main bottleneck at 5,000 RPS." },
    { key: "ec_car_21", category: "career", phrase: "single point of failure (SPOF)", meaning: "единая точка отказа (узел, падение которого кладёт всю систему)", when: "Обсуждая отказоустойчивость на System Design.", example: "To eliminate a single point of failure, we deployed active-active replicas across two availability zones." },
    { key: "ec_car_22", category: "career", phrase: "to trade off X for Y", meaning: "пожертвовать X ради выигрыша в Y", when: "Объясняя архитектурное решение.", example: "We traded off a bit of recall for a 3x reduction in tail latency." },

    // 4. tech (Технические объяснения — 22 фразы)
    { key: "ec_tec_1", category: "tech", phrase: "data leakage / target leakage", meaning: "утечка данных из будущего или таргета в признаки", when: "Объясняя, почему офлайн-метрика была подозрительно высокой.", example: "We spotted subtle target leakage caused by aggregating user stats over the entire table before splitting." },
    { key: "ec_tec_2", category: "tech", phrase: "out-of-time (OOT) validation", meaning: "валидация по времени (обучение на прошлом, проверка на будущем периоде)", when: "При рассказе о валидации моделей во временных рядах, финтехе и рекомендациях.", example: "Instead of random k-fold, we used strict out-of-time validation to mimic production drift." },
    { key: "ec_tec_3", category: "tech", phrase: "training-serving skew", meaning: "расхождение в расчёте признаков между офлайн-обучением и онлайн-инференсом", when: "Обсуждая MLOps и Feature Store.", example: "A unified Feature Store eliminated training-serving skew between Spark jobs and our FastAPI service." },
    { key: "ec_tec_4", category: "tech", phrase: "tail latency (p95 / p99)", meaning: "хвостовая задержка (время ответа для 95-го / 99-го перцентиля самых долгих запросов)", when: "Говоря о SLA онлайн-сервиса.", example: "Average latency was fine, but GC pauses caused spikes in p99 tail latency." },
    { key: "ec_tec_5", category: "tech", phrase: "graceful degradation / fallback", meaning: "плавная деградация (переключение на простую эвристику при падении основной модели)", when: "На ML System Design при обсуждении надёжности.", example: "If the neural ranker times out after 80 ms, the service gracefully degrades to cached BM25 scores." },
    { key: "ec_tec_6", category: "tech", phrase: "shadow deployment (dark launch)", meaning: "теневой выкат (модель получает реальный трафик и логирует ответы, но клиенту не показывается)", when: "Объясняя, как безопасно проверить модель перед A/B-тестом.", example: "We ran the v2 model in shadow mode for three days to verify latency and score distributions." },
    { key: "ec_tec_7", category: "tech", phrase: "canary rollout", meaning: "канареечный релиз (включение новой версии сначала на 1–5% трафика)", when: "Рассказывая о безопасном деплое.", example: "Our canary rollout caught a memory leak at 5% traffic before it affected the whole cluster." },
    { key: "ec_tec_8", category: "tech", phrase: "guardrail metric", meaning: "защитная метрика в A/B-тесте (которая не должна ухудшиться: крэши, отписки, latency)", when: "На собеседовании по продуктовой аналитике и A/B-тестам.", example: "While conversion was our North Star, page load time and unsubscribe rate served as guardrail metrics." },
    { key: "ec_tec_9", category: "tech", phrase: "sample ratio mismatch (SRM)", meaning: "перекос долей сплитования в A/B-тесте (признак сломанной рандомизации или логирования)", when: "Объясняя первичную проверку валидности эксперимента.", example: "Before looking at p-values, we run a chi-square check for sample ratio mismatch." },
    { key: "ec_tec_10", category: "tech", phrase: "variance reduction (CUPED)", meaning: "снижение дисперсии метрики за счёт ковариат предпериода", when: "Объясняя, как повысить чувствительность (уменьшить MDE) A/B-теста.", example: "Applying CUPED with two weeks of pre-experiment revenue shrank our confidence intervals by 30%." },
    { key: "ec_tec_11", category: "tech", phrase: "cold-start problem", meaning: "проблема холодного старта (новые пользователи или товары без истории взаимодействий)", when: "В задачах рекомендательных систем и ранжирования.", example: "To tackle the item cold-start problem, we fused collaborative filtering with multimodal content embeddings." },
    { key: "ec_tec_12", category: "tech", phrase: "two-tower architecture", meaning: "двухбашенная нейросетевая архитектура (отдельные энкодеры юзера и айтема для быстрого ANN-поиска)", when: "При проектировании этапа отбора кандидатов (Retrieval).", example: "We used a two-tower model with FAISS indexing to retrieve the top 200 candidates in under 10 ms." },
    { key: "ec_tec_13", category: "tech", phrase: "position bias", meaning: "смещение по позиции (верхние элементы кликают чаще просто потому, что они сверху)", when: "В задачах поискового ранжирования и рекомендаций.", example: "We added position as a feature during training and zeroed it out at inference to mitigate position bias." },
    { key: "ec_tec_14", category: "tech", phrase: "vanishing / exploding gradients", meaning: "затухание / взрыв градиентов при обратном распространении ошибки", when: "На теоретической секции по Deep Learning.", example: "Residual connections and LayerNorm prevent vanishing gradients in deep transformers." },
    { key: "ec_tec_15", category: "tech", phrase: "catastrophic forgetting", meaning: "катастрофическое забывание старых знаний при дообучении модели на узком домене", when: "Обсуждая Fine-tuning и LoRA/PEFT.", example: "LoRA adapters helped us adapt the LLM to legal documents without catastrophic forgetting." },
    { key: "ec_tec_16", category: "tech", phrase: "retrieval-augmented generation (RAG)", meaning: "генерация, дополненная поиском по внешней базе знаний", when: "Обсуждая снижение галлюцинаций LLM.", example: "Instead of retraining the model weekly, we built a hybrid BM25 + dense RAG pipeline." },
    { key: "ec_tec_17", category: "tech", phrase: "KV-cache memory footprint", meaning: "объём видеопамяти, занимаемый кэшем ключей и значений при генерации токенов", when: "В вопросах про оптимизацию инференса LLM (vLLM, PagedAttention).", example: "Grouped-Query Attention significantly reduces the KV-cache memory footprint for long contexts." },
    { key: "ec_tec_18", category: "tech", phrase: "idempotent endpoint", meaning: "идемпотентный эндпоинт (повторный запрос не создаёт дублей)", when: "При обсуждении REST API, очередей и ретраев.", example: "Passing an idempotency key ensures that network retries don't trigger duplicate transactions." },
    { key: "ec_tec_19", category: "tech", phrase: "I/O-bound vs CPU-bound", meaning: "ограниченный ожиданием ввода-вывода (сети/диска) против ограниченного вычислениями процессора", when: "Объясняя выбор между `asyncio`, `threading` и `multiprocessing` в Python.", example: "`asyncio` excels at I/O-bound workloads, whereas CPU-bound matrix math requires multiprocessing or native extensions." },
    { key: "ec_tec_20", category: "tech", phrase: "amortized O(1) complexity", meaning: "амортизированная константная сложность (в среднем за серию операций)", when: "Объясняя устройство `list.append` или хеш-таблицы.", example: "Even though resizing copies the buffer, dynamic array append runs in amortized O(1) time." },
    { key: "ec_tec_21", category: "tech", phrase: "precision-recall trade-off", meaning: "баланс между точностью (долей верных срабатываний) и полнотой (долей найденных объектов)", when: "Объясняя выбор порога бинарного классификатора с точки зрения цены ошибок первого и второго рода.", example: "In medical screening we tune the threshold for high recall, whereas in spam filtering we prioritize precision." },
    { key: "ec_tec_22", category: "tech", phrase: "data drift / concept drift", meaning: "дрейф распределения входных признаков / изменение самой зависимости целевой переменной", when: "Говоря о мониторинге моделей после деплоя.", example: "We monitor PSI (Population Stability Index) weekly to catch feature drift early." },

    // 5. culture (Культурные особенности и вежливость — 18 фраз)
    { key: "ec_cul_1", category: "culture", phrase: "That's a great question — let me structure my thoughts.", meaning: "Отличный вопрос — дайте мне пару секунд структурировать ответ.", when: "Естественная фраза, чтобы взять 5 секунд паузы на сложном вопросе вместо «эээ».", example: "That's a great question — let me structure my thoughts around data, modeling, and serving." },
    { key: "ec_cul_2", category: "culture", phrase: "Correct me if I'm wrong, but...", meaning: "Поправьте меня, если я ошибаюсь, но…", when: "Вежливый способ указать на неточность или проверить своё понимание.", example: "Correct me if I'm wrong, but wouldn't a global normalization leak future information here?" },
    { key: "ec_cul_3", category: "culture", phrase: "I see where you're coming from, however...", meaning: "Я понимаю вашу логику/опасение, однако…", when: "Мягкая, дипломатичная формула несогласия в англоязычной культуре (вместо резкого «No, you are wrong»).", example: "I see where you're coming from on speed, however skipping schema validation might break downstream billing." },
    { key: "ec_cul_4", category: "culture", phrase: "Does that answer your question, or should I go deeper into X?", meaning: "Ответил ли я на ваш вопрос, или стоит углубиться в деталь X?", when: "Идеальная фраза для завершения ответа по CARL: передаёт управление интервьюеру.", example: "Does that answer your question, or would you like me to go deeper into the PyTorch training loop?" },
    { key: "ec_cul_5", category: "culture", phrase: "To play devil's advocate...", meaning: "Если взглянуть со стороны скептика / проверить контр-аргумент…", when: "Когда хотите сами предложить критический взгляд на идею без перехода на личности.", example: "Just to play devil's advocate — what happens if the third-party embedding API goes down?" },
    { key: "ec_cul_6", category: "culture", phrase: "I'd love to pick your brain about...", meaning: "Буду рад узнать ваш взгляд / посоветоваться по поводу…", when: "В нетворкинге в LinkedIn или при обращении к более опытному коллеге.", example: "I'd love to pick your brain about how your team evaluates multi-turn LLM agents." },
    { key: "ec_cul_7", category: "culture", phrase: "Let's not let perfection be the enemy of good.", meaning: "Не будем позволять перфекционизму мешать выкату хорошего рабочего решения.", when: "Обосновывая запуск итеративного MVP.", example: "We shipped the logistic regression baseline in week one — let's not let perfection be the enemy of good." },
    { key: "ec_cul_8", category: "culture", phrase: "I appreciate the feedback — I'll factor that in.", meaning: "Спасибо за обратную связь, я обязательно учту это в решении.", when: "Когда интервьюер даёт подсказку на лайвкодинге или System Design (показывает Coachability!).", example: "I appreciate the feedback on memory locality — let me factor that into the data layout." },
    { key: "ec_cul_9", category: "culture", phrase: "To be completely transparent...", meaning: "Если говорить совершенно открыто / начистоту…", when: "Когда честно признаёте границу своих знаний на узком вопросе и предлагаете разумную гипотезу.", example: "To be completely transparent, I haven't used TensorRT in production yet, but here's how I'd approach it based on ONNX Runtime." },
    { key: "ec_cul_10", category: "culture", phrase: "It was a team effort, and my specific role was...", meaning: "Это была командная работа, а конкретно моей задачей было…", when: "Безупречный переход от уважения к команде к чёткому описанию личного вклада («Я»).", example: "It was a cross-team effort, and my specific role was designing the online feature pipeline." },
    { key: "ec_cul_11", category: "culture", phrase: "How does that sound to you?", meaning: "Как вам такой план / подход?", when: "На System Design или лайвкодинге перед тем, как начать писать код или углубляться в схему.", example: "I'll start with the data contract and then move to the ranking model — how does that sound to you?" },
    { key: "ec_cul_12", category: "culture", phrase: "Could you elaborate a bit on...?", meaning: "Не могли бы вы чуть подробнее пояснить…?", when: "Вежливая просьба уточнить условие задачи.", example: "Could you elaborate a bit on whether we can tolerate eventual consistency here?" },
    { key: "ec_cul_13", category: "culture", phrase: "If I understand the constraint correctly...", meaning: "Если я правильно понимаю ограничение задачи…", when: "Перепроверяя условие перед решением.", example: "If I understand the constraint correctly, we have a strict 50 ms budget for the entire recommendation call." },
    { key: "ec_cul_14", category: "culture", phrase: "That's a fair point.", meaning: "Справедливое замечание / согласен с аргументом.", when: "Принимая замечание собеседника.", example: "That's a fair point — a hash collision could degrade worst-case lookup to O(n)." },
    { key: "ec_cul_15", category: "culture", phrase: "I'm leaning towards X because...", meaning: "Я склоняюсь к варианту X, потому что…", when: "Выбирая одно из архитектурных решений в условиях неопределённости.", example: "Between the two, I'm leaning towards LightGBM because our features are mostly tabular and latency is tight." },
    { key: "ec_cul_16", category: "culture", phrase: "Let's zoom out for a second.", meaning: "Давайте на секунду взглянем на картину шире.", when: "Возвращая разговор от мелкой детали к главной бизнес-цели.", example: "Let's zoom out for a second: our primary goal is reducing churn, not just maximizing clickbait CTR." },
    { key: "ec_cul_17", category: "culture", phrase: "Let's zoom in on the ranking stage.", meaning: "Давайте подробнее сфокусируемся на этапе ранжирования.", when: "Переходя от общей схемы к деталям конкретного модуля.", example: "Now that we have the high-level pipeline, let's zoom in on the ranking stage." },
    { key: "ec_cul_18", category: "culture", phrase: "Thanks for taking the time today — I really enjoyed our technical discussion.", meaning: "Спасибо за уделённое время — мне было очень приятно обсудить технические задачи.", when: "Тёплое и профессиональное завершение любого интервью.", example: "Thanks for taking the time today — I really enjoyed our discussion on search architecture!" }
  ];

  for (var _i = 0; _i < DEFAULT_ENGLISH_CLUB_RECORDS.length; _i++) {
    var _recId = DEFAULT_ENGLISH_CLUB_RECORDS[_i].id;
    if (!DEFAULT_ENGLISH_CLUB_MISTAKES[_recId]) {
      DEFAULT_ENGLISH_CLUB_MISTAKES[_recId] = DEFAULT_ENGLISH_CLUB_MISTAKES.esc_2026_10_25;
    }
  }

  var DEFAULT_RECRUITERS = [
    { id: "rec_1", name: "Анна Смирнова", company: "Яндекс", linkedinUrl: "https://www.linkedin.com/in/anna-smirnova-ml-recruiter", telegram: "@anna_yandex_ml", notes: "Senior Tech Recruiter — Поиск, Реклама и Алиса (ML / NLP / RecSys)" },
    { id: "rec_2", name: "Екатерина Волкова", company: "Яндекс", linkedinUrl: "https://www.linkedin.com/in/ekaterina-volkova-hr", telegram: "@kate_ya_analytics", notes: "Продуктовая аналитика, А/Б-платформа и Яндекс Go" },
    { id: "rec_3", name: "Мария Козлова", company: "Авито", linkedinUrl: "https://www.linkedin.com/in/maria-kozlova-avito", telegram: "@mkoz_avito_tech", notes: "Data Science & Analytics Recruitment Lead (Trust & Safety, Search, AdTech)" },
    { id: "rec_4", name: "Дарья Морозова", company: "Авито", linkedinUrl: "https://www.linkedin.com/in/daria-morozova-it", telegram: "@daria_avito_ml", notes: "ML Engineers (Core ML, LLM Agents, Computer Vision)" },
    { id: "rec_5", name: "Ольга Новикова", company: "Т-Банк", linkedinUrl: "https://www.linkedin.com/in/olga-novikova-tbank", telegram: "@olga_tbank_ai", notes: "AI Center, Risk Scoring, NLP & Speech Technologies" },
    { id: "rec_6", name: "Алина Лебедева", company: "Т-Банк", linkedinUrl: "https://www.linkedin.com/in/alina-lebedeva-fintech", telegram: "@alina_tbank_data", notes: "Продуктовые и кредитные аналитики, DWH, BI" },
    { id: "rec_7", name: "Ксения Павлова", company: "Ozon", linkedinUrl: "https://www.linkedin.com/in/ksenia-pavlova-ozon", telegram: "@ksenia_ozon_tech", notes: "Поиск, Рекомендации, Dynamic Pricing и рекламная платформа Ozon" },
    { id: "rec_8", name: "Наталья Соколова", company: "Ozon", linkedinUrl: "https://www.linkedin.com/in/natalia-sokolova-ozon", telegram: "@nat_ozon_analytics", notes: "Product & Marketing Analytics, Финтех и Логистика" },
    { id: "rec_9", name: "Елена Попова", company: "Сбер", linkedinUrl: "https://www.linkedin.com/in/elena-popova-sber-ai", telegram: "@elena_gigachat_hr", notes: "GigaChat, Kandinsky, R&D и платформа ML Space" },
    { id: "rec_10", name: "Виктория Орлова", company: "ВК (VK)", linkedinUrl: "https://www.linkedin.com/in/victoria-orlova-vk", telegram: "@vika_vk_recsys", notes: "Лента рекомендаций, VK Видео, VK Музыка и рекламный таргетинг" },
    { id: "rec_11", name: "Юлия Зайцева", company: "Альфа-Банк", linkedinUrl: "https://www.linkedin.com/in/yulia-zaitseva-alfa", telegram: "@yulia_alfa_ds", notes: "Advanced Analytics, Персонализация, Антифрод и LLM-ассистенты" },
    { id: "rec_12", name: "Татьяна Белова", company: "Wildberries", linkedinUrl: "https://www.linkedin.com/in/tatiana-belova-wb", telegram: "@tanya_wb_ml", notes: "Ранжирование каталога, CV для карточек товаров, логистический ML" },
    { id: "rec_13", name: "Ирина Кузнецова", company: "Лаборатория Касперского", linkedinUrl: "https://www.linkedin.com/in/irina-kuznetsova-kaspersky", telegram: "@irina_kaspersky_ml", notes: "ML в кибербезопасности, Anomaly Detection, Threat Intelligence" },
    { id: "rec_14", name: "Полина Виноградова", company: "МТС Digital / МТС AI", linkedinUrl: "https://www.linkedin.com/in/polina-vinogradova-mts", telegram: "@polina_mts_ai", notes: "NLP, Голосовые боты, MLOps и Big Data аналитика" },
    { id: "rec_15", name: "Светлана Мельникова", company: "ЦИАН", linkedinUrl: "https://www.linkedin.com/in/svetlana-melnikova-cian", telegram: "@sveta_cian_data", notes: "Модели оценки недвижимости, рекомендации и продуктовая аналитика" },
    { id: "rec_16", name: "Анастасия Романова", company: "Купер / СберМаркет", linkedinUrl: "https://www.linkedin.com/in/anastasia-romanova-kuper", telegram: "@nastya_kuper_ml", notes: "Прогнозирование спроса, маршрутизация курьеров, A/B-эксперименты" },
    { id: "rec_17", name: "Валерия Фёдорова", company: "Самокат", linkedinUrl: "https://www.linkedin.com/in/valeria-fedorova-samokat", telegram: "@lera_samokat_ds", notes: "Операционная аналитика дарксторов, ценообразование и ML" },
    { id: "rec_18", name: "Вероника Тихонова", company: "Lamoda", linkedinUrl: "https://www.linkedin.com/in/veronika-tikhonova-lamoda", telegram: "@veronika_lamoda_tech", notes: "Fashion RecSys, Computer Vision и клиентская аналитика" },
    { id: "rec_19", name: "Александра Тарасова", company: "X5 Tech", linkedinUrl: "https://www.linkedin.com/in/alexandra-tarasova-x5", telegram: "@sasha_x5tech_data", notes: "Офлайн A/B-тесты, ценообразование, CV на кассах и прогнозирование" },
    { id: "rec_20", name: "Диана Григорьева", company: "Positive Technologies", linkedinUrl: "https://www.linkedin.com/in/diana-grigorieva-pt", telegram: "@diana_pt_ml", notes: "Python Backend, FastAPI и ML для анализа сетевого трафика" },
    { id: "rec_21", name: "Кристина Алексеева", company: "HeadHunter (hh.ru)", linkedinUrl: "https://www.linkedin.com/in/kristina-alekseeva-hh", telegram: "@kris_hh_ml", notes: "Матчинг резюме и вакансий, NLP-ранжирование и продуктовая аналитика" },
    { id: "rec_22", name: "Евгения Макарова", company: "Точка Банк", linkedinUrl: "https://www.linkedin.com/in/evgenia-makarova-tochka", telegram: "@jenya_tochka_ds", notes: "ML-инженеры, LLM-продукты для предпринимателей и продуктовые аналитики" },
    { id: "rec_23", name: "Маргарита Степанова", company: "2ГИС", linkedinUrl: "https://www.linkedin.com/in/margarita-stepanova-2gis", telegram: "@rita_2gis_ml", notes: "Гео-поиск, ETA-модели маршрутизации и гео-аналитика" },
    { id: "rec_24", name: "София Комарова", company: "Билайн (ВымпелКом)", linkedinUrl: "https://www.linkedin.com/in/sofia-komarova-beeline", telegram: "@sofia_beeline_ai", notes: "AdTech, гео-скоринг, отток (Churn) и MLOps" },
    { id: "rec_25", name: "Майя Крылова", company: "Nebius / Yango (Intl)", linkedinUrl: "https://www.linkedin.com/in/maya-krylova-nebius", telegram: "@maya_global_ml", notes: "Международный найм (Амстердам / Белград / Дубай): LLM Infrastructure, ML Engineers" },
    { id: "rec_26", name: "Людмила Давыдова", company: "JetBrains (Intl)", linkedinUrl: "https://www.linkedin.com/in/liudmila-davydova-jb", telegram: "@mila_jetbrains_ai", notes: "AI Assistant, Code Generation LLMs, Evaluation & Research Engineers" }
  ];

  var DEFAULT_COMPANY_QUESTIONS = [
    {
      companyId: "company_yandex", companyName: "Яндекс", questionId: "ya_q1", kind: "technical",
      question: "Почему в градиентном бустинге (CatBoost / LightGBM) на каждом шаге деревья строятся по антиградиенту функции потерь, а не по остаткам напрямую?",
      studentAnswer: "Остатки $y - \\hat{y}$ совпадают с антиградиентом только для функции потерь MSE: $-\\frac{\\partial}{\\partial \\hat{y}} \\frac{1}{2}(y - \\hat{y})^2 = y - \\hat{y}$. Для произвольной дифференцируемой функции потерь (например, LogLoss, MAE, Huber или ранжирующей YetiRank) шаг градиентного спуска в функциональном пространстве прогнозов делается в направлении псевдо-остатков $r_{im} = -\\left.\\frac{\\partial L(y_i, f(x_i))}{\\partial f(x_i)}\\right|_{f=f_{m-1}}$.",
      review: "**Отличный ответ.** Дополнительно на собеседовании в Яндексе любят уточнить про **вторую производную (гессиан)** в XGBoost/LightGBM: разложение Тейлора до второго порядка даёт оптимальный вес листа $w_j^* = -\\frac{\\sum_{i \\in I_j} g_i}{\\sum_{i \\in I_j} h_i + \\lambda}$, а также про **Ordered Boosting** в CatBoost, который борется с prediction shift (target leakage при расчёте CTR-счётчиков)."
    },
    {
      companyId: "company_yandex", companyName: "Яндекс", questionId: "ya_q2", kind: "technical",
      question: "Как устроен механизм Scaled Dot-Product Attention в трансформере и почему без деления на sqrt(d_k) обучение деградирует?",
      studentAnswer: "Матрица внимания считается как $\\text{Attention}(Q, K, V) = \\text{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right)V$. Если компоненты $q$ и $k$ независимы со средним 0 и дисперсией 1, то их скалярное произведение имеет среднее 0 и дисперсию $d_k$. При больших $d_k$ значения логитов становятся большими по модулю, softmax уходит в область насыщения (один вес $\\approx 1$, остальные $\\approx 0$), и градиенты затухают.",
      review: "**Полный зачёт.** Хорошо сразу упомянуть сложность $\\mathcal{O}(T^2 \\cdot d_k)$ по времени и $\\mathcal{O}(T^2)$ по памяти, а также то, как **FlashAttention** устраняет материализацию матрицы $T \\times T$ в HBM за счёт тайлинга в SRAM и онлайн-софтмакса."
    },
    {
      companyId: "company_yandex", companyName: "Яндекс", questionId: "ya_q3", kind: "technical",
      question: "Спроектируйте систему рекомендаций товаров на главной странице маркетплейса с SLA 80 мс при 20 000 RPS (ML System Design).",
      studentAnswer: "Разделим архитектуру на 4 каскада: 1) **Candidate Generation (Retrieval)** — многоканальный отбор ~500 кандидатов из миллионов за 15 мс (двухбашенная нейросеть + HNSW в FAISS, ковизиты Item2Item, популярное в регионе); 2) **Lightweight Ranking (L1)** — быстрая модель по 30 признакам отбирает топ-100; 3) **Heavy Ranking (L2)** — CatBoost / DCN-v2 предсказывает вероятности клика, добавления в корзину и покупки, комбинируя их в итоговый скор $\\sum w_k p_k$; 4) **Business Rules & Diversity (Reranking)** — дедупликация брендов, бустинг новинок, фильтр остатков.",
      review: "**Сильное архитектурное решение.** Всегда начинайте с разделения метрик на **онлайн** (GMV per user, CTR, конверсия в покупку, guardrail — latency и доля пустых выдач) и **офлайн** (NDCG@K, Recall@200 для ретривала), а в конце описывайте **fallback** (кэш популярных товаров при таймауте)."
    },
    {
      companyId: "company_yandex", companyName: "Яндекс", questionId: "ya_q4", kind: "technical",
      question: "Как работает метод снижения дисперсии CUPED в A/B-тестировании и на сколько процентов он уменьшает дисперсию?",
      studentAnswer: "CUPED строит скорректированную метрику $Y_{\\text{cuped}} = Y - \\theta (X - \\mathbb{E}[X])$, где $X$ — ковариата того же пользователя за предпериод до старта теста (не зависящая от тритмента!). Оптимальный коэффициент $\\theta^* = \\frac{\\text{Cov}(Y, X)}{\\text{Var}(X)}$ минимизирует дисперсию, сжимая её до $\\text{Var}(Y_{\\text{cuped}}) = \\text{Var}(Y)(1 - \\rho^2)$, где $\\rho$ — корреляция Пирсона между $X$ и $Y$.",
      review: "**Отлично.** Не забудьте уточнить, что делать с новыми пользователями, у которых нет истории за предпериод ($X$ неизвестен): им подставляют среднее $\\bar{X}$, чтобы не сместить оценку математического ожидания."
    },
    {
      companyId: "company_yandex", companyName: "Яндекс", questionId: "ya_q5", kind: "hr",
      question: "Расскажите о ситуации, когда вы не согласились с архитектурным решением тимлида или продакт-менеджера. Как разрешился спор?",
      studentAnswer: "Использовал структуру CARL: продакт просил выкатить новую LLM-суммаризацию отзывов сразу на 100% карточек без кэширования к распродаже. Я посчитал пиковую нагрузку и стоимость токенов, показал на цифрах риск выхода за бюджет в 6 раз и предложил компромисс — предрасчёт суммаризаций батчом для топ-20% товаров (дающих 85% трафика) + кэширование по хешу отзывов.",
      review: "**Образцовый поведенческий ответ.** Показано уважение к бизнес-цели, аргументация на языке цифр и проактивное предложение работоспособного инженерного компромисса."
    },
    {
      companyId: "company_avito", companyName: "Авито", questionId: "av_q1", kind: "technical",
      question: "Как правильно валидировать и сравнивать модели обнаружения фрода / спам-объявлений при сильном дисбалансе классов (0.3% позитивов)?",
      studentAnswer: "ROC-AUC при сильном дисбалансе может быть обманчиво высоким (0.98+), так как в знаменателе FPR стоит огромное число True Negatives. Поэтому основная офлайн-метрика — **PR-AUC (Average Precision)** и **Recall@Fixed Precision** (например, какой процент фрода мы ловим при условии, что среди заблокированных не более 5% честных продавцов, чтобы не перегрузить ручную модерацию).",
      review: "**Точно в цель.** В Авито также важно упомянуть **Out-of-Time (OOT)** сплит и группировку по `user_id`/`seller_id` (GroupTimeSeriesSplit), чтобы объявления одного мошенника не попали одновременно и в train, и в validation."
    },
    {
      companyId: "company_avito", companyName: "Авито", questionId: "av_q2", kind: "technical",
      question: "Как устроена дообучение больших языковых моделей через LoRA и почему матрицу B инициализируют нулями, а матрицу A — гауссовским шумом?",
      studentAnswer: "В LoRA базовые веса $W_0 \\in \\mathbb{R}^{d \\times k}$ замораживаются, а приращение аппроксимируется произведением двух низкоранговых матриц $\\Delta W = \\frac{\\alpha}{r} B A$, где $A \\in \\mathbb{R}^{r \\times k}, B \\in \\mathbb{R}^{d \\times r}$ и $r \\ll \\min(d, k)$. Матрица $B$ инициализируется нулями, а $A$ — из $\\mathcal{N}(0, \\sigma^2)$, чтобы в нулевой шаг обучения $\\Delta W = 0$ (выход сети в точности совпадает с предобученной моделью), но при этом градиенты по $B$ уже не равны нулю.",
      review: "**Безупречно.** Если бы обе матрицы инициализировали нулями, мы получили бы седловую точку с нулевыми градиентами; если бы обе инициализировали шумом — в начале обучения добавился бы сильный шум, разрушающий представления базовой модели."
    },
    {
      companyId: "company_avito", companyName: "Авито", questionId: "av_q3", kind: "technical",
      question: "В чём проблема пользовательских A/B-тестов на двустороннем маркетплейсе (интерференция / сетевой эффект) и как её решать?",
      studentAnswer: "Если дать тестовой группе покупателей скидку или бустинг в поиске, они выкупят ликвидные товары (например, квартиры или авто), которые иначе достались бы пользователям контрольной группы. Нарушается предпосылка SUTVA: тест «каннибализирует» контроль, удваивая видимый аплифт. Решения: **гео-сплитование / кластерная рандомизация по городам и категориям**, **Switchback-тесты** по времени или **Synthetic Control**.",
      review: "**Сильный ответ для продуктового аналитика и DS.** Обязательно упоминайте парный подбор городов/категорий (Matched Pairs) и поправку стандартных ошибок на кластерный дизайн (Cluster-Robust SE или бакетный бутстрап)."
    },
    {
      companyId: "company_tbank", companyName: "Т-Банк", questionId: "tb_q1", kind: "technical",
      question: "Чем отличаются потоки (threading), процессы (multiprocessing) и корутины (asyncio) в Python, и как это влияет на сервинг ML-моделей в FastAPI?",
      studentAnswer: "Потоки живут в одном адресном пространстве и делят GIL — поэтому подходят для I/O-bound задач или вызовов C++/Rust/CUDA-расширений, отпускающих GIL (`numpy`, `torch`, `catboost`). Процессы имеют изолированную память и свой интерпретатор — обходят GIL для чистого Python CPU-кода, но требуют сериализации (pickle) или shared memory. `asyncio` работает в одном потоке на кооперативной многозадачности (Event Loop). В FastAPI нельзя вызывать блокирующий CPU-инференс внутри `async def`, иначе замрёт весь Event Loop.",
      review: "**Отлично.** Всегда добавляйте практический вывод: в продакшене запускают несколько воркеров Uvicorn/Gunicorn по числу ядер, загружают веса модели один раз в `lifespan`, а синхронные вызовы объявляют через обычный `def` (или выносят тяжёлый инференс в Triton Inference Server)."
    },
    {
      companyId: "company_tbank", companyName: "Т-Банк", questionId: "tb_q2", kind: "technical",
      question: "Что такое Reject Inference в кредитном скоринге и почему модель, обученная только на одобренных заявках, смещена?",
      studentAnswer: "Мы знаем истинный таргет дефолта (NPL 90+) только для тех клиентов, которым банк выдал кредит (одобренный поток). Отказанные заявки не попадают в разметку, из-за чего возникает **Selection Bias (Sample Selection)**: на хвостах распределения признаков модель не видит реального уровня риска. Для коррекции используют взвешивание по вероятности одобрения (Inverse Probability Weighting), аккуратный добор рискованного трафика (exploratory budget на 1–2% заявок) или полуразмеченные методы.",
      review: "**Глубокое понимание домена.** Упоминание небольшого исследовательского бюджета (Exploration Traffic) со сниженным кредитным лимитом — золотой стандарт индустрии."
    },
    {
      companyId: "company_ozon", companyName: "Ozon", questionId: "oz_q1", kind: "technical",
      question: "Как устроен гибридный поиск (Hybrid Search) в RAG и E-commerce: зачем комбинировать BM25 и векторные эмбеддинги и как сливать их скоры (RRF)?",
      studentAnswer: "Лексический поиск **BM25** отлично ищет точные совпадения артикулов, редких брендов и кодов ошибок, но не понимает синонимов. Плотные векторные эмбеддинги (**Dense Retrieval / Bi-Encoder**) улавливают семантику, но могут размывать точные названия моделей (например, путать iPhone 14 Pro и iPhone 15). Так как скоры BM25 не ограничены сверху, а косинусная близость лежит в $[-1, 1]$, их объединяют через **Reciprocal Rank Fusion (RRF)**: $\\text{RRF}(d) = \\sum_{m} \\frac{1}{k + \\text{rank}_m(d)}$ (обычно $k = 60$), после чего топ-50 доранжируют Cross-Encoder’ом.",
      review: "**Идеальный ответ.** Формула RRF и объяснение того, почему нельзя просто сложить некалиброванные скоры BM25 и Cosine Similarity без нормализации, сразу выделяют практика."
    },
    {
      companyId: "company_ozon", companyName: "Ozon", questionId: "oz_q2", kind: "technical",
      question: "Напишите SQL-запрос с оконными функциями: для каждого пользователя найти разницу в днях между его текущим и предыдущим заказом и скользящее среднее чека по последним 3 заказам.",
      studentAnswer: "Используем `LAG(order_date) OVER (PARTITION BY user_id ORDER BY order_date)` для даты предыдущего заказа и `AVG(amount) OVER (PARTITION BY user_id ORDER BY order_date ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)` для скользящего среднего по 3 заказам.",
      review: "**Верно.** На собеседовании обязательно уточняйте разницу между рамками `ROWS BETWEEN` (физические строки) и `RANGE BETWEEN` (значения по ключу сортировки, склеивающие заказы с одинаковым таймстампом)."
    },
    {
      companyId: "company_sber", companyName: "Сбер", questionId: "sb_q1", kind: "technical",
      question: "Чем отличаются LayerNorm и BatchNorm, и почему в трансформерах и LLM используют LayerNorm / RMSNorm?",
      studentAnswer: "**BatchNorm** нормализует активации по батчу и пространственным осям для каждого канала отдельно — он зависит от размера батча, требует хранения running mean/var для инференса и плохо работает с последовательностями разной длины и паддингами. **LayerNorm** нормализует вектор признаков внутри каждого отдельного токена независимо от других примеров в батче, одинаково работает на train и inference. **RMSNorm** убирает центрирование среднего, экономя вычисления при том же качестве.",
      review: "**Точно.** Хорошо также упомянуть разницу между **Post-LN** (в оригинальном трансформере 2017 года, требовавшем долгого warmup) и **Pre-LN** (современный стандарт в GPT/Llama, где градиенты свободно текут по магистрали residual stream)."
    },
    {
      companyId: "company_vk", companyName: "ВК", questionId: "vk_q1", kind: "technical",
      question: "Как бороться с Position Bias при обучении ранжирующей модели ленты рекомендаций или поиска по кликовым логам?",
      studentAnswer: "Пользователи кликают на 1-ю позицию гораздо чаще, чем на 10-ю, независимо от релевантности объекта. Три основных метода борьбы: 1) **Position as a Feature (PAL):** подавать индекс позиции как признак во время обучения (например, в отдельную аддитивную башню логита), а на инференсе фиксировать всем кандидатам позицию $= 1$; 2) **Inverse Propensity Weighting (IPW):** взвешивать клики обратно пропорционально вероятности осмотра позиции $1 / P(\\text{examen} \\mid k)$; 3) обучать на попарных предпочтениях внутри окна, где пользователь просмотрел элементы выше и ниже кликнутого (Skip-Above pairs).",
      review: "**Блестящий ответ уровня Senior RecSys.**"
    }
  ];

  var DEFAULT_MOCK_QUESTIONS = [
    {
      companyId: "topic_python", companyName: "Python", questionId: "mock_py_1", kind: "technical",
      question: "Как устроен словарь dict в современном Python (3.6+): почему он сохраняет порядок вставки и экономит память за счёт разреженной таблицы индексов?",
      studentAnswer: "Раньше хеш-таблица хранила в каждой ячейке 24 байта (hash, key_ptr, value_ptr), причём минимум треть ячеек пустовала. С Python 3.6 таблица разделена на два массива: 1) компактный разреженный массив индексов `indices` (по 1–8 байт на слот в зависимости от размера словаря) и 2) плотный массив записей `entries`, куда элементы `(hash, key, value)` дописываются строго по порядку вставки без дырок.",
      review: "**Отличный глубокий ответ.** Упомяните также открытую адресацию (Open Addressing) с псевдослучайным пробированием при коллизиях и то, почему нельзя удалять ключи из словаря во время итерации по нему (`RuntimeError: dictionary changed size during iteration`)."
    },
    {
      companyId: "topic_python", companyName: "Python", questionId: "mock_py_2", kind: "technical",
      question: "Зачем в классах Python нужен атрибут __slots__ и какие ограничения он накладывает?",
      studentAnswer: "По умолчанию атрибуты каждого экземпляра класса хранятся в динамическом словаре `__dict__`, который тратит десятки лишних байт памяти на объект. Объявление `__slots__ = ('x', 'y')` заменяет `__dict__` на компактный массив дескрипторов фиксированного размера (как в кортеже/структуре C), снижая потребление RAM на миллионах объектов в 2–3 раза и ускоряя доступ к атрибутам.",
      review: "**Верно.** Назовите два главных ограничения: нельзя динамически добавлять новые атрибуты, не перечисленные в `__slots__`, и при наследовании дочерний класс тоже должен объявлять `__slots__` (иначе у него снова появится `__dict__`)."
    },
    {
      companyId: "topic_math", companyName: "Математика", questionId: "mock_math_1", kind: "technical",
      question: "В чём геометрический и вероятностный смысл SVD (сингулярного разложения) и как оно связано с методом главных компонент (PCA)?",
      studentAnswer: "Любая вещественная матрица $X \\in \\mathbb{R}^{n \\times d}$ раскладывается как $X = U \\Sigma V^T$, где $U$ и $V$ — ортогональные матрицы левых и правых сингулярных векторов, а $\\Sigma$ — диагональная матрица неотрицательных сингулярных чисел $\\sigma_1 \\ge \\sigma_2 \\ge \\dots \\ge 0$. Если матрица признаков $X$ центрирована, то ковариационная матрица равна $C = \\frac{1}{n-1} X^T X = \\frac{1}{n-1} V \\Sigma^2 V^T$, то есть правые сингулярные векторы $V$ — это в точности главные компоненты PCA, а $\\sigma_i^2 / (n-1)$ — дисперсии вдоль них.",
      review: "**Отлично.** Также полезно упомянуть теорему Эккарта–Янга: усечённое разложение $X_k = U_k \\Sigma_k V_k^T$ даёт наилучшее приближение ранга $k$ по норме Фробениуса и спектральной норме."
    },
    {
      companyId: "topic_classic_ml", companyName: "Classic ML", questionId: "mock_cml_1", kind: "technical",
      question: "Сравните бэггинг (Random Forest) и градиентный бустинг (GBDT) с точки зрения разложения ошибки на Bias и Variance.",
      studentAnswer: "В **Random Forest** базовые деревья строятся глубокими и независимыми (низкий Bias, высокий Variance у каждого дерева). Усреднение $B$ слабо скоррелированных деревьев снижает дисперсию композиции: $\\text{Var}(\\bar{f}) = \\rho \\sigma^2 + \\frac{1-\\rho}{B}\\sigma^2$, но не уменьшает смещение (Bias). В **градиентном бустинге** базовые деревья мелкие (глубина 4–8: высокий Bias, низкий Variance) и обучаются последовательно на ошибках предыдущего ансамбля, целенаправленно снижая **Bias** при контроле Variance через shrinkage (learning rate) и подвыборку.",
      review: "**Чёткий классический ответ.**"
    },
    {
      companyId: "topic_dl", companyName: "DL", questionId: "mock_dl_1", kind: "technical",
      question: "Почему оптимизатор AdamW работает на трансформерах лучше классического Adam с L2-регуляризацией в функции потерь?",
      studentAnswer: "В классическом Adam добавление $\\frac{\\lambda}{2}\\|\\theta\\|^2$ к лоссу приводит к тому, что градиент регуляризации $\\lambda \\theta$ попадает внутрь скользящих средних $m_t$ и $v_t$ и делится на $\\sqrt{\\hat{v}_t}$. Из-за этого веса с большими историческими градиентами регуляризуются слабее, чем веса с малыми градиентами! **AdamW (Decoupled Weight Decay)** выносит шаг затухания весов наружу: $\\theta_{t} = (1 - \\eta \\lambda)\\theta_{t-1} - \\eta \\frac{\\hat{m}_t}{\\sqrt{\\hat{v}_t} + \\epsilon}$, равномерно сжимая все веса.",
      review: "**Идеально.** Это один из самых частых вопросов на секциях по Deep Learning и NLP."
    },
    {
      companyId: "topic_nlp_base", companyName: "NLP базовый", questionId: "mock_nlpb_1", kind: "technical",
      question: "Как работает субсловная токенизация BPE (Byte-Pair Encoding) и почему она вытеснила пословную токенизацию в современных языковых моделях?",
      studentAnswer: "Пословная токенизация страдает от огромного словаря и проблемы неизвестных слов (`<UNK>`) на редких формах, опечатках и новых терминах, а посимвольная делает последовательности слишком длинными. **BPE** начинает с алфавита отдельных символов/байтов и итеративно сливает самую частую пару соседних токенов в новый токен, пока размер словаря не достигнет заданного $V$ (например, 32k–128k). Частые слова остаются единым токеном, а редкие разбиваются на осмысленные морфемы без потери информации.",
      review: "**Полный ответ.**"
    },
    {
      companyId: "topic_nlp_advanced", companyName: "NLP продвинутый", questionId: "mock_nlpa_1", kind: "technical",
      question: "Чем DPO (Direct Preference Optimization) отличается от классического RLHF с PPO при выравнивании (alignment) языковых моделей?",
      studentAnswer: "Классический **RLHF (PPO)** требует обучения отдельной модели вознаграждения (Reward Model) и сложного онлайн-цикла RL с удержанием в памяти сразу 4 моделей (Policy, Reference, Reward, Value/Critic), который нестабилен по гиперпараметрам. **DPO** математически выражает оптимальную функцию награды через отношение вероятностей самой политики $\\pi_\\theta$ и референсной модели $\\pi_{\\text{ref}}$, сводя задачу к стабильному бинарному кросс-энтропийному лоссу напрямую на парах предпочтений $(x, y_w, y_l)$ без отдельной Reward Model.",
      review: "**Отлично.** Хорошо упомянуть и ограничение DPO: он обучается офлайн на фиксированном датасете пар, поэтому при сильном отходе политики $\\pi_\\theta$ от распределения датасета может уступать итеративному онлайн-RL / GRPO."
    },
    {
      companyId: "topic_nlp_optimization", companyName: "NLP оптимизация", questionId: "mock_nlpo_1", kind: "technical",
      question: "Почему авторегрессионная генерация токенов (Decode phase) в LLM является Memory-Bound операцией и как помогают KV-Cache и Continuous Batching?",
      studentAnswer: "На фазе генерации (Decode) мы генерируем по одному токену за шаг: чтобы умножить вектор скрытого состояния на матрицы весов, приходится каждый раз перекачивать гигабайты весов модели из медленной видеопамяти HBM в вычислительные блоки GPU (низкая арифметическая интенсивность — Memory Bandwidth Bound). **KV-Cache** сохраняет ключи и значения прошлых токенов, избавляя от их пересчёта (снижает сложность шага с $\\mathcal{O}(T^2)$ до $\\mathcal{O}(T)$), а **Continuous Batching** с **PagedAttention** в vLLM объединяет запросы разных пользователей на каждом шаге генерации без простоя из-за разной длины ответов.",
      review: "**Блестяще.**"
    },
    {
      companyId: "topic_rag", companyName: "RAG", questionId: "mock_rag_1", kind: "technical",
      question: "По каким метрикам оценивать качество RAG-пайплайна отдельно для этапа поиска (Retrieval) и этапа генерации (Generation)?",
      studentAnswer: "Декомпозируем оценку на две части: 1) **Retrieval:** `Recall@K` (попал ли нужный документ в топ-K чанков), `MRR` и `NDCG@K` на размеченном наборе пар вопрос–источник; 2) **Generation (Триада RAGAS):** **Context Relevance** (насколько извлечённый контекст сфокусирован на вопросе), **Faithfulness / Groundedness** (нет ли в ответе галлюцинаций, не подтверждённых извлечённым контекстом) и **Answer Relevance** (отвечает ли финальный текст на исходный вопрос пользователя).",
      review: "**Структурный и точный ответ.**"
    },
    {
      companyId: "topic_agents", companyName: "Агенты", questionId: "mock_ag_1", kind: "technical",
      question: "Как устроен цикл ReAct в LLM-агентах и как защитить агента с доступом к инструментам (Tool Calling) от Prompt Injection и бесконечных циклов?",
      studentAnswer: "В паттерне **ReAct (Reason + Act)** модель чередует шаги: 1) `Thought` — анализ цели и текущего состояния, 2) `Action` — вызов строго типизированного инструмента (JSON Schema), 3) `Observation` — получение результата от среды. Для защиты в продакшене вводят: жёсткий лимит шагов (`max_iterations = 5–10`), строгую валидацию аргументов тулов через Pydantic, разделение системных инструкций и недоверенных внешних данных (delimiters / sandboxing), а для критических операций (списание денег, удаление) — подтверждение человеком (**Human-in-the-Loop**).",
      review: "**Отличный инженерный ответ по безопасности и надёжности агентов.**"
    },
    {
      companyId: "topic_ml_system_design", companyName: "ML System Design", questionId: "mock_mlsd_1", kind: "technical",
      question: "Спроектируйте систему динамического прогнозирования времени доставки (ETA) для сервиса курьерской доставки еды.",
      studentAnswer: "Разбиваем общее время доставки на 3 слагаемых (или предсказываем сумму + квантильный лосс Pinball Loss из-за асимметрии цены опоздания!): $T_{\\text{total}} = T_{\\text{prep}} + T_{\\text{pickup}} + T_{\\text{travel}}$. Используем градиентный бустинг или мультитаск-нейросеть поверх двух групп признаков: **статических** (историческое время готовки ресторана по часам дня, дистанция по графу дорог H3-гексагонов) и **реалтайм-агрегатов из Kafka/Flink** (текущая очередь заказов на кухне ресторана за последние 15 минут, индекс пробок, погода, плотность свободных курьеров в гексагоне).",
      review: "**Отличный дизайн.** Использование асимметричной функции потерь (опоздать на 15 минут хуже для удержания клиента, чем привезти на 10 минут раньше) — ключевой инсайт задачи ETA."
    },
    {
      companyId: "topic_legend", companyName: "Легенда", questionId: "mock_leg_1", kind: "hr",
      question: "Почему вы решили сменить текущее место работы и по каким критериям выбираете следующую команду?",
      studentAnswer: "На текущем месте я выстроил и довёл до стабильного продакшена ключевой контур скоринга и мониторинга. Сейчас ищу команду с большим масштабом высоконагруженных данных, сильной культурой экспериментов (A/B, MLOps) и задачами, где мои навыки проектирования end-to-end ML-сервисов дадут максимальный продуктовый эффект.",
      review: "**Грамотный, зрелый ответ без негатива к прошлому работодателю.**"
    }
  ];

  function buildSeedQuestionTree(items) {
    var index = { companies: {}, questions: {} };
    var rootBank = { companies: {} };
    var now = 1761500000000;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var cId = it.companyId;
      var qId = it.questionId;
      var normName = String(it.companyName || "").toLowerCase();
      var normQ = String(it.question || "").toLowerCase();
      var ts = now - i * 3600000;

      index.companies[cId] = { name: it.companyName, normalizedName: normName, updatedAt: ts };
      index.questions[cId + "_" + qId] = {
        companyId: cId,
        companyName: it.companyName,
        questionId: qId,
        question: it.question,
        normalizedQuestion: normQ,
        kind: it.kind || "technical",
        updatedAt: ts,
        sourceIds: { seed_src_1: true }
      };

      if (!rootBank.companies[cId]) {
        rootBank.companies[cId] = {
          name: it.companyName,
          normalizedName: normName,
          updatedAt: ts,
          questions: {}
        };
      }
      rootBank.companies[cId].questions[qId] = {
        question: it.question,
        normalizedQuestion: normQ,
        kind: it.kind || "technical",
        sources: {
          seed_src_1: {
            updatedAt: ts,
            studentAnswer: it.studentAnswer || "",
            review: it.review || ""
          }
        }
      };
    }
    return { index: index, bank: rootBank };
  }

  function ensureInterviewBanksSeeded() {
    try {
      var db = loadDb();
      var changed = false;
      if (!db.interviewQuestionIndex || !db.interviewQuestionIndex.questions || !Object.keys(db.interviewQuestionIndex.questions).length) {
        var realSeed = buildSeedQuestionTree(DEFAULT_COMPANY_QUESTIONS);
        db.interviewQuestionIndex = realSeed.index;
        db.interviewQuestionBank = realSeed.bank;
        changed = true;
      }
      if (!db.mockQuestionIndex || !db.mockQuestionIndex.questions || !Object.keys(db.mockQuestionIndex.questions).length) {
        var mockSeed = buildSeedQuestionTree(DEFAULT_MOCK_QUESTIONS);
        db.mockQuestionIndex = mockSeed.index;
        db.mockQuestionBank = mockSeed.bank;
        changed = true;
      }
      if (!db.englishClubRecords || !db.englishClubRecords.length) {
        db.englishClubRecords = DEFAULT_ENGLISH_CLUB_RECORDS;
        changed = true;
      }
      if (!db.englishClubGlossary || !db.englishClubGlossary.length) {
        db.englishClubGlossary = DEFAULT_ENGLISH_CLUB_GLOSSARY;
        changed = true;
      }
      if (!db.interviewRecruiters || !db.interviewRecruiters.length) {
        db.interviewRecruiters = DEFAULT_RECRUITERS;
        changed = true;
      }
      if (changed) saveDb(db);
    } catch (e) {
      console.warn("[DataLab offline] Could not seed interview banks:", e);
    }
  }
  ensureInterviewBanksSeeded();

  var extraStaffMethods = {
    listEnglishClub: async function () {
      var db = loadDb();
      return {
        records: db.englishClubRecords || DEFAULT_ENGLISH_CLUB_RECORDS,
        glossary: db.englishClubGlossary || DEFAULT_ENGLISH_CLUB_GLOSSARY,
        canEdit: true
      };
    },
    getEnglishClubMistakes: async function (params) {
      var id = params && params.id;
      var mistakes = (id && DEFAULT_ENGLISH_CLUB_MISTAKES[id]) || DEFAULT_ENGLISH_CLUB_MISTAKES.esc_2026_10_25;
      return { mistakes: mistakes };
    },
    saveEnglishClubRecord: async function (params) {
      var db = loadDb();
      var list = (db.englishClubRecords || DEFAULT_ENGLISH_CLUB_RECORDS).slice();
      var id = (params && params.id) || ("esc_" + Date.now());
      var rec = Object.assign({ id: id, mistakesCount: 0 }, (params && params.record) || {});
      var idx = list.findIndex(function (r) { return r.id === id; });
      if (idx >= 0) list[idx] = Object.assign({}, list[idx], rec);
      else list.unshift(rec);
      db.englishClubRecords = list;
      if (params && Array.isArray(params.glossary) && params.glossary.length) {
        var gl = (db.englishClubGlossary || DEFAULT_ENGLISH_CLUB_GLOSSARY).slice();
        params.glossary.forEach(function (term, i) {
          gl.push(Object.assign({ key: "ec_custom_" + Date.now() + "_" + i }, term));
        });
        db.englishClubGlossary = gl;
      }
      saveDb(db);
      return { success: true, id: id };
    },
    deleteEnglishClubRecord: async function (params) {
      var db = loadDb();
      var id = params && params.id;
      db.englishClubRecords = (db.englishClubRecords || DEFAULT_ENGLISH_CLUB_RECORDS).filter(function (r) {
        return r.id !== id;
      });
      saveDb(db);
      return { success: true };
    },
    deleteEnglishClubTerm: async function (params) {
      var db = loadDb();
      var key = params && params.key;
      db.englishClubGlossary = (db.englishClubGlossary || DEFAULT_ENGLISH_CLUB_GLOSSARY).filter(function (t) {
        return t.key !== key;
      });
      saveDb(db);
      return { success: true };
    },
    listInterviewRecruiters: async function (params) {
      var db = loadDb();
      var all = db.interviewRecruiters || DEFAULT_RECRUITERS;
      var offset = Number((params && params.offset) || 0);
      return {
        recruiters: all.slice(offset),
        nextOffset: null,
        canEdit: true
      };
    },
    saveInterviewRecruiter: async function (params) {
      var db = loadDb();
      var list = (db.interviewRecruiters || DEFAULT_RECRUITERS).slice();
      var id = (params && params.id) || ("rec_" + Date.now());
      var item = Object.assign({ id: id }, (params && params.recruiter) || {});
      var idx = list.findIndex(function (r) { return r.id === id; });
      if (idx >= 0) list[idx] = item;
      else list.unshift(item);
      db.interviewRecruiters = list;
      saveDb(db);
      return { success: true, id: id };
    },
    deleteInterviewRecruiter: async function (params) {
      var db = loadDb();
      var id = params && params.id;
      db.interviewRecruiters = (db.interviewRecruiters || DEFAULT_RECRUITERS).filter(function (r) {
        return r.id !== id;
      });
      saveDb(db);
      return { success: true };
    },
    listCompanyLogos: async function () {
      return { logos: {} };
    }
  };

  Object.assign(offlineApi, extraStaffMethods);
  Object.assign(window.staffApi, extraStaffMethods);
  window.staffApi.call = async function (name, data, options) {
    if (typeof window.staffApi[name] === "function") {
      return await window.staffApi[name](data, options);
    }
    if (typeof offlineApi[name] === "function") {
      return await offlineApi[name](data, options);
    }
    console.warn("[DataLab offline] Unhandled staffApi.call:", name, data);
    return { success: true };
  };

  // 5. Force unlock material access
  function forceUnlockAccess() {
    try {
      document.documentElement.classList.remove("material-access-checking");
      var overlay = document.getElementById("material-access-check-overlay");
      if (overlay) overlay.remove();
      if (document.body) {
        document.body.style.visibility = "visible";
      }
    } catch (e) {}
  }
  forceUnlockAccess();
  window.__materialAccessGuardScriptRequested = true;
  window.__materialAccessPrimeApplied = true;
  window.runMaterialAccessGuard = async function () {
    forceUnlockAccess();
    return false;
  };
  window.maybeStartEarlyMaterialAccessCheckUI = function () {
    forceUnlockAccess();
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", forceUnlockAccess);
  }
  window.addEventListener("load", forceUnlockAccess);
})();
