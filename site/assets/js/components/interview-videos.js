/**
 * Interview Videos page: filtering and modal.
 * Список записей отдаёт callable listInterviewVideos (узел interview_videos,
 * functions/interview-videos.js); ментор добавляет и правит записи прямо на
 * странице — interview-video-editor.js. Файлы лежат в публичном бакете R2.
 * Фидбек: вместо pdfUrl можно указать feedbackId и feedbackUserId — фидбек подгрузится из Firebase (профиль ученика).
 */
(function () {
  var interviewVideosDb = null;

  async function getInterviewVideosDb() {
    if (interviewVideosDb) return interviewVideosDb;
    if (
      typeof firebase === "undefined" ||
      typeof window.configLoader === "undefined"
    )
      return null;
    try {
      var config = await window.configLoader.loadFirebaseConfig();
      if (!firebase.apps.length) firebase.initializeApp(config);
      interviewVideosDb = firebase.database();
      if (window.globalAchievementNotifications) {
        window.globalAchievementNotifications.initialize(config);
      }
      return interviewVideosDb;
    } catch (e) {
      console.warn("Interview videos: Firebase init failed", e);
      return null;
    }
  }

  /**
   * Рендер фидбека делегируется общему модулю
   * assets/js/components/feedback-render.js — тому же, что использует
   * страница profile/feedbacks.html. Раньше здесь была отдельная упрощённая
   * копия парсера markdown, из-за чего оформление расходилось.
   */
  function renderFeedbackMath(container) {
    if (window.FeedbackRender) window.FeedbackRender.renderMath(container);
  }

  /** Разметка фидбека в стиле модалки страницы фидбеков (только чтение). */
  function renderFeedbackBody(feedback, feedbackId) {
    if (!window.FeedbackRender) {
      console.warn("Interview videos: FeedbackRender не загружен");
      return "";
    }
    return window.FeedbackRender.renderFeedbackBody(feedback, {
      feedbackId: feedbackId || feedback.feedbackId || feedback.id || "video",
      userRole: "",
      interactive: false,
      showProgress: true,
    });
  }

  var FEEDBACK_MAPPING_PATH = "interviewVideoFeedbacks";
  var FEEDBACK_PAYLOAD_PATH = "interviewVideoFeedbackPayloads";
  var feedbackMappingCache = null;

  function getCurrentAuthUid() {
    try {
      return firebase.auth().currentUser ? firebase.auth().currentUser.uid : "";
    } catch (e) {
      return "";
    }
  }

  function getAssignedFeedbackForStudent(map, userId) {
    if (!map || !userId) return null;
    if (map[userId] && map[userId].feedbackId) {
      return {
        feedbackUserId: userId,
        feedbackId: map[userId].feedbackId,
      };
    }
    if (map.feedbackUserId === userId && map.feedbackId) {
      return {
        feedbackUserId: map.feedbackUserId,
        feedbackId: map.feedbackId,
      };
    }
    return null;
  }

  function getFirstAssignedFeedback(map) {
    if (!map) return null;
    if (map.feedbackUserId && map.feedbackId) {
      return {
        feedbackUserId: map.feedbackUserId,
        feedbackId: map.feedbackId,
      };
    }
    for (var key in map) {
      if (!map[key] || !map[key].feedbackId) continue;
      return {
        feedbackUserId: key,
        feedbackId: map[key].feedbackId,
      };
    }
    return null;
  }

  async function getFeedbackMappingForVideo(videoId) {
    if (feedbackMappingCache && feedbackMappingCache[videoId]) {
      var cachedUid = getCurrentAuthUid();
      var cachedForCurrentUser = getAssignedFeedbackForStudent(
        feedbackMappingCache[videoId],
        cachedUid,
      );
      if (cachedForCurrentUser) return cachedForCurrentUser;

      return getFirstAssignedFeedback(feedbackMappingCache[videoId]);
    }
    var db = await getInterviewVideosDb();
    if (!db) return null;
    try {
      var snap = await db
        .ref(FEEDBACK_MAPPING_PATH + "/" + videoId)
        .once("value");
      var val = snap.val();
      if (val) {
        if (!feedbackMappingCache) feedbackMappingCache = {};
        feedbackMappingCache[videoId] = val;

        var currentUid = getCurrentAuthUid();
        var ownMapping = getAssignedFeedbackForStudent(val, currentUid);
        if (ownMapping) return ownMapping;

        return getFirstAssignedFeedback(val);
      }
    } catch (e) {
      console.warn("Interview videos: get mapping failed", e);
    }
    return null;
  }

  async function loadFullFeedbackMapping() {
    var db = await getInterviewVideosDb();
    if (!db) return {};
    try {
      var snap = await db.ref(FEEDBACK_MAPPING_PATH).once("value");
      feedbackMappingCache = snap.val() || {};
      return feedbackMappingCache;
    } catch (e) {
      console.warn("Interview videos: load mapping failed", e);
      return {};
    }
  }

  async function getCurrentUserRole() {
    var db = await getInterviewVideosDb();
    if (!db || typeof firebase === "undefined" || !firebase.auth().currentUser)
      return null;
    try {
      var snap = await db
        .ref("users/" + firebase.auth().currentUser.uid)
        .once("value");
      var user = snap.val() || {};
      return user.role || null;
    } catch (e) {
      return null;
    }
  }

  function canAssignFeedbacks(role) {
    if (!role || typeof role !== "string") return false;
    var r = role.toLowerCase().trim();
    return r === "admin" || r === "mentor" || r === "curator";
  }

  // Фидбеки других учеников — не наши собственные данные в RTDB, поэтому
  // читаем их только через callable-функцию listStaffFeedbacks (см.
  // DATA_ACCESS_STANDARD.md), а не напрямую из users/{uid}/feedbacks.
  var staffFeedbackItemsPromise = null;

  function loadAllStaffFeedbackItems() {
    if (!window.staffApi) return Promise.resolve([]);
    if (!staffFeedbackItemsPromise) {
      staffFeedbackItemsPromise = window.staffApi
        .getAllStaffFeedbacks()
        .catch(function (e) {
          staffFeedbackItemsPromise = null;
          throw e;
        });
    }
    return staffFeedbackItemsPromise;
  }

  function toRawFeedback(item) {
    if (!item) return null;
    var raw = {};
    for (var key in item) {
      if (
        key === "id" ||
        key === "feedbackId" ||
        key === "studentId" ||
        key === "userId" ||
        key === "studentName"
      )
        continue;
      raw[key] = item[key];
    }
    return raw;
  }

  async function loadStudentsWithFeedbacks() {
    try {
      var directory = await window.staffApi.getStaffDirectory();
      var feedbackItems = await loadAllStaffFeedbackItems();
      var withFeedback = {};
      feedbackItems.forEach(function (f) {
        withFeedback[f.studentId] = true;
      });
      var list = directory
        .filter(function (u) {
          return withFeedback[u.uid];
        })
        .map(function (u) {
          return {
            userId: u.uid,
            displayName: u.displayName || u.email || "Ученик",
            email: u.email || "",
          };
        });
      list.sort(function (a, b) {
        return (a.displayName || "").localeCompare(b.displayName || "", "ru");
      });
      return list;
    } catch (e) {
      console.warn("Interview videos: load students failed", e);
      return [];
    }
  }

  async function loadFeedbacksForUser(userId) {
    try {
      var feedbackItems = await loadAllStaffFeedbackItems();
      var list = feedbackItems
        .filter(function (f) {
          return f.studentId === userId;
        })
        .map(function (f) {
          return {
            id: f.feedbackId,
            title: (f.title || "Без названия").trim(),
            createdAt: f.createdAt || 0,
          };
        });
      list.sort(function (a, b) {
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
      return list;
    } catch (e) {
      return [];
    }
  }

  function formatFeedbackDate(ts) {
    if (!ts) return "";
    var d = new Date(ts);
    return d.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  async function setInterviewVideoFeedback(
    videoId,
    feedbackUserId,
    feedbackId,
  ) {
    var db = await getInterviewVideosDb();
    if (!db) throw new Error("Нет доступа к базе");
    var path = FEEDBACK_MAPPING_PATH + "/" + videoId;
    if (feedbackUserId && feedbackId) {
      var feedbackItems = await loadAllStaffFeedbackItems();
      var matchedFeedback = feedbackItems.find(function (f) {
        return f.studentId === feedbackUserId && f.feedbackId === feedbackId;
      });
      var feedbackPayload = toRawFeedback(matchedFeedback) || {};

      await db.ref(path + "/" + feedbackUserId).set({ feedbackId: feedbackId });
      await db
        .ref(FEEDBACK_PAYLOAD_PATH + "/" + videoId + "/" + feedbackUserId)
        .set({
          feedbackId: feedbackId,
          feedbackUserId: feedbackUserId,
          feedback: feedbackPayload,
          updatedAt: firebase.database.ServerValue.TIMESTAMP,
        });
      if (!feedbackMappingCache) feedbackMappingCache = {};
      feedbackMappingCache[videoId] = feedbackMappingCache[videoId] || {};
      feedbackMappingCache[videoId][feedbackUserId] = {
        feedbackId: feedbackId,
      };
    } else if (feedbackUserId) {
      await db.ref(path + "/" + feedbackUserId).remove();
      await db
        .ref(FEEDBACK_PAYLOAD_PATH + "/" + videoId + "/" + feedbackUserId)
        .remove();
      if (
        feedbackMappingCache &&
        feedbackMappingCache[videoId] &&
        feedbackMappingCache[videoId][feedbackUserId]
      ) {
        delete feedbackMappingCache[videoId][feedbackUserId];
      }
    } else {
      await db.ref(path).remove();
      await db.ref(FEEDBACK_PAYLOAD_PATH + "/" + videoId).remove();
      if (feedbackMappingCache && feedbackMappingCache[videoId]) {
        delete feedbackMappingCache[videoId];
      }
    }
  }

  async function loadFeedbackPayloadForVideo(videoId, userId) {
    if (!videoId || !userId) return null;
    var db = await getInterviewVideosDb();
    if (!db) return null;
    try {
      var snap = await db
        .ref(FEEDBACK_PAYLOAD_PATH + "/" + videoId + "/" + userId)
        .once("value");
      var payload = snap.val();
      if (payload && payload.feedback) return payload;
    } catch (e) {
      console.warn("Interview videos: payload read failed", e);
    }
    return null;
  }

  async function syncFeedbackPayloadForMapping(
    videoId,
    feedbackUserId,
    feedbackId,
  ) {
    if (!videoId || !feedbackUserId || !feedbackId) return;
    var db = await getInterviewVideosDb();
    if (!db) return;
    try {
      var feedbackItems = await loadAllStaffFeedbackItems();
      var matchedFeedback = feedbackItems.find(function (f) {
        return f.studentId === feedbackUserId && f.feedbackId === feedbackId;
      });
      var feedback = toRawFeedback(matchedFeedback);
      if (!feedback) return;
      await db
        .ref(FEEDBACK_PAYLOAD_PATH + "/" + videoId + "/" + feedbackUserId)
        .set({
          feedbackId: feedbackId,
          feedbackUserId: feedbackUserId,
          feedback: feedback,
          updatedAt: firebase.database.ServerValue.TIMESTAMP,
        });
    } catch (e) {
      console.warn("Interview videos: payload sync failed", e);
    }
  }

  function eachFeedbackMapping(mapping, cb) {
    if (!mapping) return;
    for (var videoId in mapping) {
      var map = mapping[videoId];
      if (!map) continue;
      if (map.feedbackUserId && map.feedbackId) {
        cb(videoId, map.feedbackUserId, map.feedbackId);
      }
      for (var uid in map) {
        if (uid === "feedbackUserId" || uid === "feedbackId") continue;
        if (map[uid] && map[uid].feedbackId) {
          cb(videoId, uid, map[uid].feedbackId);
        }
      }
    }
  }

  // Заполняется в loadVideos() ответом listInterviewVideos.
  window.INTERVIEW_VIDEOS_DATA = [];

  // «Просмотрено» — собственные данные ученика:
  // users/<uid>/watchedInterviewVideos/<videoId> = время отметки. Пишет и читает
  // только он сам (правило $other узла users/<uid>), функций не нужно.
  var WATCHED_PATH = "watchedInterviewVideos";
  var watched = {};

  function watchedRef(db, id) {
    var uid = getCurrentAuthUid();
    if (!db || !uid) return null;
    return db.ref("users/" + uid + "/" + WATCHED_PATH + (id ? "/" + id : ""));
  }

  // Зовётся после listInterviewVideos: callable дожидается authReady, так что
  // к этому моменту пользователь уже известен.
  function loadWatched() {
    return getInterviewVideosDb()
      .then(function (db) {
        var ref = watchedRef(db);
        return ref ? ref.once("value") : null;
      })
      .then(function (snap) {
        if (snap) watched = snap.val() || {};
      })
      .catch(function (e) {
        console.warn("Interview videos: watched load failed", e);
      });
  }

  function watchedButtonHtml(id) {
    var on = Boolean(watched[id]);
    return (
      '<button type="button" class="iv-watched-toggle' +
      (on ? " is-on" : "") +
      '" data-iv-watched="' +
      escapeHtml(id) +
      '" aria-pressed="' +
      on +
      '">' +
      escapeHtml(on ? tr("✓ Просмотрено") : tr("Отметить просмотренным")) +
      "</button>"
    );
  }

  function watchedSummary() {
    var data = window.INTERVIEW_VIDEOS_DATA || [];
    if (!getCurrentAuthUid() || !data.length) return "";
    var done = data.filter(function (v) {
      return watched[v.id];
    }).length;
    return " · " + tr("Просмотрено") + ": " + done + " / " + data.length;
  }

  // Перерисовываем только кнопки и класс карточки: если сразу перефильтровать
  // сетку, карточка исчезала бы из-под курсора при фильтре «Не просмотрены».
  function syncWatchedUi(id) {
    document
      .querySelectorAll('[data-iv-watched="' + id + '"]')
      .forEach(function (button) {
        button.outerHTML = watchedButtonHtml(id);
      });
    document
      .querySelectorAll('.interview-video-card[data-video-id="' + id + '"]')
      .forEach(function (card) {
        card.classList.toggle("is-watched", Boolean(watched[id]));
      });
    var countEl = document.getElementById("interview-videos-count");
    if (countEl)
      countEl.textContent =
        countEl.textContent.replace(/ · .*$/, "") + watchedSummary();
  }

  function toggleWatched(id) {
    var previous = watched[id];
    var on = !previous;
    if (on) watched[id] = Date.now();
    else delete watched[id];
    syncWatchedUi(id);
    getInterviewVideosDb()
      .then(function (db) {
        var ref = watchedRef(db, id);
        if (!ref) throw new Error("not signed in");
        return on
          ? ref.set(firebase.database.ServerValue.TIMESTAMP)
          : ref.remove();
      })
      .then(function () {
        if (on) scheduleWatchedSync();
      })
      .catch(function (e) {
        console.warn("Interview videos: watched save failed", e);
        if (previous) watched[id] = previous;
        else delete watched[id];
        syncWatchedUi(id);
      });
  }

  // Достижения за просмотренные записи считает сервер по отметкам в базе.
  // Отмечают обычно подряд несколько записей — зовём один раз после паузы.
  var watchedSyncTimer = null;
  function scheduleWatchedSync() {
    clearTimeout(watchedSyncTimer);
    watchedSyncTimer = setTimeout(function () {
      if (!window.staffApi) return;
      window.staffApi
        .call("syncWatchedInterviewVideos", {}, { retry: false })
        .then(function (result) {
          if (window.walletUi)
            window.walletUi.showCredit(result && result.wallet);
        })
        .catch(function (e) {
          console.warn("Interview videos: watched sync failed", e);
        });
    }, 1500);
  }

  document.addEventListener("click", function (e) {
    var button = e.target.closest && e.target.closest("[data-iv-watched]");
    if (button) toggleWatched(button.dataset.ivWatched);
  });

  function getFilters() {
    var typeEl = document.getElementById("iv-filter-type");
    var topicEl = document.getElementById("iv-filter-topic");
    var languageEl = document.getElementById("iv-filter-language");
    var modeEl = document.getElementById("iv-filter-mode");
    var watchedEl = document.getElementById("iv-filter-watched");
    return {
      type: typeEl ? typeEl.dataset.value || "" : "",
      topic: topicEl ? topicEl.dataset.value || "" : "",
      language: languageEl ? languageEl.dataset.value || "" : "",
      mode: modeEl ? modeEl.dataset.value || "" : "",
      watched: watchedEl ? watchedEl.dataset.value || "" : "",
    };
  }

  function setFilter(key, value) {
    var el = document.getElementById("iv-filter-" + key);
    if (el) el.dataset.value = value;
    var chips = document.querySelectorAll("[data-iv-filter='" + key + "']");
    chips.forEach(function (chip) {
      chip.classList.toggle("active", chip.dataset.value === value);
    });
  }

  function isVideoEnglish(v) {
    return v.language === "en" || v.english === true;
  }

  function filterVideos(data, filters) {
    return data.filter(function (v) {
      if (filters.type && v.type !== filters.type) return false;
      if (filters.topic && v.topics.indexOf(filters.topic) === -1) return false;
      if (filters.language === "en" && !isVideoEnglish(v)) return false;
      if (filters.mode && (v.mode || "").toLowerCase() !== filters.mode)
        return false;
      if (filters.watched === "yes" && !watched[v.id]) return false;
      if (filters.watched === "no" && watched[v.id]) return false;
      return true;
    });
  }

  // Секции по умолчанию: настоящие собесы, моки по темам, MLSD. Мок с
  // несколькими темами идёт в секцию самой продвинутой — последней по этому
  // списку («Python + Classic ML» → Classic ML). Пинует
  // tests/interview-videos-sections.test.js.
  // Режим собеса: ключ в базе (MODES в functions/interview-videos.js) → подпись.
  // Совпадение ключей с сервером, фильтром и редактором пинует
  // tests/interview-videos-modes.test.js.
  var MODE_LABELS = {
    tech: "Техничка",
    screening: "Скрининг",
    livecoding: "Live coding",
    final: "Финалка",
    behavioral: "Поведенческий",
    culturefit: "Culture fit",
    teammatch: "С командой",
  };

  // Значение темы в базе остаётся английским, подпись — по-русски.
  var TOPIC_LABELS = { Math: "Математика" };

  function topicLabel(topic) {
    return TOPIC_LABELS[topic] ? tr(TOPIC_LABELS[topic]) : topic;
  }

  var MOCK_SECTIONS = [
    "Python",
    "Classic ML",
    "DL",
    "NLP",
    "RAG",
    "Agents",
    "Legend",
    "MLSD",
  ];

  function mockSection(video) {
    // Типа «MLSD» больше нет: такие записи — моки по теме MLSD.
    if (video.type === "mlsd") return "MLSD";
    var topics = video.topics || [];
    for (var i = MOCK_SECTIONS.length - 1; i >= 0; i -= 1) {
      if (topics.indexOf(MOCK_SECTIONS[i]) !== -1) return MOCK_SECTIONS[i];
    }
    return "other";
  }

  function sectionKey(video) {
    if (video.type === "real") return "real";
    return "mock:" + mockSection(video);
  }

  var SECTION_ORDER = ["real"]
    .concat(
      MOCK_SECTIONS.map(function (topic) {
        return "mock:" + topic;
      }),
    )
    .concat(["mock:other"]);

  function sectionTitle(key) {
    if (key === "real") return tr("Настоящие собесы");
    if (key === "mock:other") return tr("Другие моки");
    return tr("Мок-собесы") + " · " + key.slice("mock:".length);
  }

  /** [{ key, kind, title, items }] — непустые секции; внутри — по order. */
  function groupVideosForDisplay(videos) {
    var byKey = {};
    videos.forEach(function (video) {
      var key = sectionKey(video);
      (byKey[key] = byKey[key] || []).push(video);
    });
    return SECTION_ORDER.filter(function (key) {
      return byKey[key];
    }).map(function (key) {
      return {
        key: key,
        kind: key.split(":")[0],
        title: sectionTitle(key),
        items: byKey[key].slice().sort(function (a, b) {
          return (Number(a.order) || 0) - (Number(b.order) || 0);
        }),
      };
    });
  }

  function tr(s) {
    return typeof window.t === "function" ? window.t(s) : s;
  }

  // «2026-09-12» → «12 сент. 2026 г.» / «Sep 12, 2026». Дата без времени,
  // поэтому UTC: иначе к западу от Гринвича она уехала бы на день назад.
  function formatAddedAt(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    if (!m) return "";
    var locale = (window.i18n && window.i18n.locale) || "ru-RU";
    return new Date(Date.UTC(+m[1], m[2] - 1, +m[3])).toLocaleDateString(
      locale,
      { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" },
    );
  }

  function isAudioRecording(video) {
    return (
      /\.(mp3|ogg|wav|m4a|aac)(\?|$)/i.test((video && video.videoUrl) || "") ||
      (video && video.mediaType === "audio")
    );
  }

  // Высоты столбиков «волны» в карточке аудио — её форма. Во время звука
  // столбики масштабирует спектр (startWave), а без него — CSS-анимация.
  var WAVE_HEIGHTS = [
    35, 60, 45, 80, 55, 90, 40, 70, 100, 65, 50, 85, 45, 75, 95, 55, 40, 70, 60,
    85, 50, 65, 35, 55,
  ];

  // Волна реагирует на звук через Web Audio. Анализатору нужен
  // <audio crossorigin="anonymous"> и CORS на R2. Без заголовков такая запись
  // не загрузится: тогда перезагружаем её без атрибута и остаёмся на
  // CSS-анимации — чужой (не CORS) звук через AudioContext выдал бы тишину.
  var WAVE_ZERO_FRAMES = 30;
  var waveCtx = null;

  // Спектр → n уровней 0..1 по нижней половине частот (выше в речи пусто).
  function waveLevels(data, n) {
    var per = Math.max(1, Math.floor(data.length / 2 / n));
    var out = [];
    for (var i = 0; i < n; i++) {
      var sum = 0;
      for (var j = 0; j < per; j++) sum += data[i * per + j] || 0;
      out.push(sum / per / 255);
    }
    return out;
  }

  function isSilent(data) {
    for (var i = 0; i < data.length; i++) if (data[i]) return false;
    return true;
  }

  function startWave(card, audio) {
    if (audio.waveNoCors) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // На телефоне слушают с погашенным экраном, а iOS при блокировке
    // останавливает AudioContext — запись, пущенная через граф, замолчала бы.
    if (window.matchMedia("(pointer: coarse)").matches) return;
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    try {
      waveCtx = waveCtx || new Ctx();
    } catch (e) {
      return;
    }
    var ctx = waveCtx;
    Promise.resolve(ctx.state === "running" || ctx.resume())
      .then(function () {
        // В остановленный контекст звук не пускаем: запись бы замолчала.
        if (ctx.state !== "running" || audio.paused) return;
        if (!audio.waveAnalyser) {
          var analyser = ctx.createAnalyser();
          analyser.fftSize = 128;
          analyser.connect(ctx.destination);
          // Один раз на элемент: повторный вызов бросает исключение.
          audio.waveSource = ctx.createMediaElementSource(audio);
          audio.waveSource.connect(analyser);
          audio.waveAnalyser = analyser;
        }
        runWave(card, audio);
      })
      .catch(function (e) {
        console.warn("Interview audio: waveform disabled", e);
      });
  }

  function runWave(card, audio) {
    var analyser = audio.waveAnalyser;
    var bars = card.querySelectorAll(".interview-audio-wave span");
    var data = new Uint8Array(analyser.frequencyBinCount);
    // Пока не пришёл ненулевой кадр — CSS-анимация, после N нулей — снова она.
    var zeros = WAVE_ZERO_FRAMES;
    cancelAnimationFrame(audio.waveRaf);
    (function frame() {
      var on = !audio.paused && audio.isConnected;
      if (on) {
        analyser.getByteFrequencyData(data);
        zeros = isSilent(data) ? zeros + 1 : 0;
      }
      var live = on && zeros < WAVE_ZERO_FRAMES;
      var levels = waveLevels(data, bars.length);
      card.classList.toggle("is-live", live);
      bars.forEach(function (bar, i) {
        bar.style.transform = live
          ? "scaleY(" + (0.15 + 0.85 * levels[i]).toFixed(3) + ")"
          : "";
      });
      if (on) audio.waveRaf = requestAnimationFrame(frame);
      else if (!audio.isConnected) audio.waveSource.disconnect();
    })();
  }

  function renderVideoCard(video) {
    var isAudio = isAudioRecording(video);
    var typeLabel;
    var typeClass;
    if (video.type === "mock" || video.type === "mlsd") {
      typeLabel = "Mock";
      typeClass = "mock";
    } else {
      typeLabel = "Real";
      typeClass = "real";
    }
    var isEnglish = video.language === "en" || video.english === true;
    var thumbUrl = escapeHtml((video.thumbnailUrl || "").trim());
    // Свои обложки (загрузки редактора лежат в interviews/) бывают любой формы:
    // вписываем целиком, поля закрывает размытая копия той же картинки.
    var customThumb = thumbUrl.indexOf("/interviews/") !== -1;
    var thumb = thumbUrl
      ? (customThumb
          ? '<img class="interview-video-card-thumb-backdrop" src="' +
            thumbUrl +
            '" alt="" aria-hidden="true" loading="lazy">'
          : "") +
        '<img class="interview-video-card-thumb-img' +
        (customThumb ? " is-contained" : "") +
        '" src="' +
        thumbUrl +
        '" alt="" loading="lazy">'
      : '<div class="interview-video-card-thumb-placeholder">▶</div>';
    if (isAudio) {
      thumb +=
        '<div class="interview-audio-wave" aria-hidden="true">' +
        WAVE_HEIGHTS.map(function (h) {
          return '<span style="height:' + h + '%"></span>';
        }).join("") +
        "</div>";
    }
    var topicsHtml = (video.topics || []).length
      ? '<div class="interview-video-card-meta-topics">' +
        (video.topics || [])
          .map(function (t) {
            return (
              '<span class="interview-video-card-topic">' +
              escapeHtml(topicLabel(t)) +
              "</span>"
            );
          })
          .join("") +
        "</div>"
      : "";
    var englishBadge = isEnglish
      ? '<span class="interview-video-card-badge interview-video-card-badge-english">English</span>'
      : "";
    var offerBadge = video.offer
      ? '<span class="interview-video-card-badge interview-video-card-badge-offer">' +
        escapeHtml(video.offer) +
        "</span>"
      : "";
    var modeVal = (video.mode || "").toLowerCase();
    var modeLabel = MODE_LABELS[modeVal] ? tr(MODE_LABELS[modeVal]) : "";
    var modeBadge = modeLabel
      ? '<span class="interview-video-card-badge interview-video-card-badge-mode interview-video-card-badge-mode-' +
        escapeHtml(modeVal) +
        '">' +
        escapeHtml(modeLabel) +
        "</span>"
      : "";
    var audioBadge = isAudio
      ? '<span class="interview-video-card-badge interview-video-card-badge-audio">' +
        escapeHtml(tr("Аудио")) +
        "</span>"
      : "";
    // Аудио слушается прямо в карточке, как голосовое сообщение. Карточка
    // тогда не role="button" (у кнопки дочерние контролы недоступны скринридеру),
    // а фидбек и описание открываются отдельной кнопкой — той же модалкой.
    var audioHtml = isAudio
      ? '<div class="interview-audio-inline">' +
        '<audio controls preload="none" controlsList="nodownload" crossorigin="anonymous" src="' +
        escapeHtml(video.videoUrl) +
        '" aria-label="' +
        escapeHtml(tr("Прослушать запись") + ": " + video.title) +
        '"></audio>' +
        '<button type="button" class="interview-audio-open">' +
        escapeHtml(tr("Фидбек и подробности")) +
        "</button>" +
        "</div>"
      : "";
    var desc = (video.description || "").trim();
    var descHtml = desc
      ? '<p class="interview-video-card-desc">' + escapeHtml(desc) + "</p>"
      : "";
    var added = formatAddedAt(video.addedAt);
    var addedHtml = added
      ? '<p class="interview-video-card-added">' +
        escapeHtml(tr("Добавлено")) +
        ': <time datetime="' +
        escapeHtml(video.addedAt) +
        '">' +
        escapeHtml(added) +
        "</time></p>"
      : "";
    return (
      '<article class="interview-video-card' +
      (watched[video.id] ? " is-watched" : "") +
      '" data-video-id="' +
      escapeHtml(video.id) +
      '" data-video-type="' +
      escapeHtml(video.type || "") +
      (isAudio ? '" data-media="audio">' : '" role="button" tabindex="0">') +
      '<div class="interview-video-card-thumb">' +
      thumb +
      (isAudio
        ? ""
        : '<div class="interview-video-card-play"><span class="interview-video-card-play-icon">▶</span></div>') +
      "</div>" +
      '<div class="interview-video-card-body">' +
      '<h3 class="interview-video-card-title">' +
      escapeHtml(video.title) +
      "</h3>" +
      descHtml +
      addedHtml +
      '<div class="interview-video-card-meta">' +
      '<span class="interview-video-card-badge ' +
      typeClass +
      '">' +
      escapeHtml(typeLabel) +
      "</span>" +
      audioBadge +
      englishBadge +
      offerBadge +
      modeBadge +
      topicsHtml +
      "</div>" +
      audioHtml +
      watchedButtonHtml(video.id) +
      (window.__interviewVideosCanEdit
        ? '<div class="interview-video-card-admin">' +
          '<button type="button" data-iv-edit="' +
          escapeHtml(video.id) +
          '">' +
          escapeHtml(tr("Изменить")) +
          '</button><button type="button" data-iv-delete="' +
          escapeHtml(video.id) +
          '">' +
          escapeHtml(tr("Удалить")) +
          "</button></div>"
        : "") +
      '<div class="interview-video-card-feedback-assign" data-video-id="' +
      escapeHtml(video.id) +
      '"></div>' +
      "</article>"
    );
  }

  function injectFeedbackAssignIntoCards(mentorData) {
    var students = mentorData.students || [];
    var mapping = mentorData.mapping || {};
    var containers = document.querySelectorAll(
      ".interview-video-card-feedback-assign",
    );
    containers.forEach(function (container) {
      container.innerHTML = "";
      var card = container.closest(".interview-video-card");
      if (!card || card.dataset.videoType !== "mock") {
        container.style.display = "none";
        return;
      }
      container.style.display = "";
      var videoId = container.dataset.videoId;
      if (!videoId) return;
      var map = mapping[videoId] || {};
      var selectedMapping = getFirstAssignedFeedback(map);
      var studentSelect = document.createElement("select");
      studentSelect.className = "interview-video-card-assign-student";
      studentSelect.title = "Ученик";
      studentSelect.innerHTML = '<option value="">— Ученик —</option>';
      students.forEach(function (s) {
        var opt = document.createElement("option");
        opt.value = s.userId;
        opt.textContent = s.displayName + (s.email ? " (" + s.email + ")" : "");
        if (selectedMapping && selectedMapping.feedbackUserId === s.userId) {
          opt.selected = true;
        }
        studentSelect.appendChild(opt);
      });
      var feedbackSelect = document.createElement("select");
      feedbackSelect.className = "interview-video-card-assign-feedback";
      feedbackSelect.title = "Фидбек";
      feedbackSelect.innerHTML = '<option value="">— Фидбек —</option>';
      var saveBtn = document.createElement("button");
      saveBtn.type = "button";
      saveBtn.className = "interview-video-card-assign-save";
      saveBtn.textContent = "Сохранить";
      saveBtn.title = "Привязать фидбек к этому видео";
      var wrap = document.createElement("div");
      wrap.className = "interview-video-card-assign-row";
      wrap.appendChild(studentSelect);
      wrap.appendChild(feedbackSelect);
      wrap.appendChild(saveBtn);
      container.appendChild(wrap);

      function fillFeedbackDropdown(uid, selectedFid) {
        feedbackSelect.innerHTML = '<option value="">— Фидбек —</option>';
        if (!uid) return;
        loadFeedbacksForUser(uid).then(function (feedbacks) {
          feedbacks.forEach(function (f) {
            var opt = document.createElement("option");
            opt.value = f.id;
            opt.textContent =
              (f.title || "Без названия") +
              " (" +
              formatFeedbackDate(f.createdAt) +
              ")";
            if (selectedFid === f.id) opt.selected = true;
            feedbackSelect.appendChild(opt);
          });
        });
      }
      if (selectedMapping) {
        fillFeedbackDropdown(
          selectedMapping.feedbackUserId,
          selectedMapping.feedbackId,
        );
      }

      container.addEventListener("click", function (e) {
        e.stopPropagation();
      });
      studentSelect.addEventListener("change", function () {
        var uid = studentSelect.value || "";
        var assigned = getAssignedFeedbackForStudent(map, uid);
        fillFeedbackDropdown(uid, assigned ? assigned.feedbackId : "");
      });
      studentSelect.addEventListener("click", function (e) {
        e.stopPropagation();
      });
      feedbackSelect.addEventListener("click", function (e) {
        e.stopPropagation();
      });
      saveBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        var uid = studentSelect.value && studentSelect.value.trim();
        var fid = feedbackSelect.value && feedbackSelect.value.trim();
        if (!uid || !fid) {
          if (uid && !fid) {
            setInterviewVideoFeedback(videoId, uid, null)
              .then(function () {
                if (
                  window.__interviewVideosMentorData &&
                  window.__interviewVideosMentorData.mapping &&
                  window.__interviewVideosMentorData.mapping[videoId]
                ) {
                  delete window.__interviewVideosMentorData.mapping[videoId][
                    uid
                  ];
                }
                if (map && map[uid]) delete map[uid];
                saveBtn.textContent = "Сохранено";
                setTimeout(function () {
                  saveBtn.textContent = "Сохранить";
                }, 2000);
              })
              .catch(function () {
                saveBtn.textContent = "Ошибка";
                setTimeout(function () {
                  saveBtn.textContent = "Сохранить";
                }, 2000);
              });
          }
          return;
        }
        saveBtn.disabled = true;
        saveBtn.textContent = "…";
        setInterviewVideoFeedback(videoId, uid, fid)
          .then(function () {
            if (
              window.__interviewVideosMentorData &&
              window.__interviewVideosMentorData.mapping
            ) {
              window.__interviewVideosMentorData.mapping[videoId] =
                window.__interviewVideosMentorData.mapping[videoId] || {};
              window.__interviewVideosMentorData.mapping[videoId][uid] = {
                feedbackId: fid,
              };
            }
            map[uid] = { feedbackId: fid };
            saveBtn.textContent = "Сохранено";
            saveBtn.disabled = false;
            setTimeout(function () {
              saveBtn.textContent = "Сохранить";
            }, 2000);
          })
          .catch(function () {
            saveBtn.textContent = "Ошибка";
            saveBtn.disabled = false;
            setTimeout(function () {
              saveBtn.textContent = "Сохранить";
            }, 2000);
          });
      });
    });
  }

  function escapeHtml(s) {
    if (!s) return "";
    var div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  function hasActiveFilters() {
    var f = getFilters();
    return (
      f.type !== "" ||
      f.topic !== "" ||
      f.language !== "" ||
      f.mode !== "" ||
      f.watched !== ""
    );
  }

  function updateCountAndReset(count) {
    var countEl = document.getElementById("interview-videos-count");
    var resetEl = document.getElementById("interview-videos-reset");
    if (countEl) countEl.textContent = "Найдено: " + count + watchedSummary();
    // visibility, а не display: место под кнопку занято всегда, и блок
    // счётчика не меняет ширину (иначе ряд фильтров перестраивался).
    if (resetEl)
      resetEl.style.visibility = hasActiveFilters() ? "visible" : "hidden";
  }

  function renderGrid(sections) {
    var videos = [].concat.apply(
      [],
      sections.map(function (section) {
        return section.items;
      }),
    );
    var container = document.getElementById("interview-videos-grid");
    var emptyEl = document.getElementById("interview-videos-empty");
    if (!container) return;
    // Карточки пересоздаются: старые <audio> отцепляем от Web Audio-графа,
    // иначе узлы удалённых на паузе записей держат элементы в памяти.
    container.querySelectorAll("audio").forEach(function (audio) {
      if (audio.waveSource) audio.waveSource.disconnect();
    });
    if (videos.length === 0) {
      container.innerHTML = "";
      if (emptyEl) {
        emptyEl.style.display = "block";
        var strong = emptyEl.querySelector("strong");
        if (strong) strong.textContent = "Нет видео по выбранным фильтрам";
      }
      updateCountAndReset(0);
      return;
    }
    if (emptyEl) emptyEl.style.display = "none";
    container.innerHTML = sections
      .map(function (section) {
        return (
          '<h2 class="iv-section-title iv-section-title--' +
          section.kind +
          '" role="presentation">' +
          escapeHtml(section.title) +
          '<span class="iv-section-count">' +
          section.items.length +
          "</span></h2>" +
          section.items.map(renderVideoCard).join("")
        );
      })
      .join("");

    container
      .querySelectorAll(".interview-video-card")
      .forEach(function (card) {
        var audio = card.querySelector("audio");
        if (audio) {
          audio.addEventListener("play", function () {
            card.classList.add("is-playing");
          });
          audio.addEventListener("playing", function () {
            startWave(card, audio);
          });
          // Нет CORS на бакете — запись с crossorigin не грузится. Один раз
          // перезагружаем без атрибута (волна тогда только CSS); уже
          // подключённую к Web Audio не трогаем — без CORS она бы онемела.
          // Обрыв сети посреди записи (readyState > 0) — не CORS: не
          // перезапускаем с начала.
          audio.addEventListener("error", function () {
            if (
              !audio.hasAttribute("crossorigin") ||
              audio.waveSource ||
              audio.readyState
            )
              return;
            audio.waveNoCors = true;
            audio.removeAttribute("crossorigin");
            audio.load();
            audio.play().catch(function () {});
          });
          ["pause", "ended"].forEach(function (type) {
            audio.addEventListener(type, function () {
              card.classList.remove("is-playing");
            });
          });
        }
        card.addEventListener("click", function (e) {
          // Клик по плееру и по выбору фидбека (у ментора) модалку не открывает.
          if (
            e.target.closest(
              "audio, .interview-video-card-feedback-assign, [data-iv-watched]",
            )
          )
            return;
          openModal(card.dataset.videoId);
        });
        card.addEventListener("keydown", function (e) {
          if (e.target !== card) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openModal(card.dataset.videoId);
          }
        });
      });
    updateCountAndReset(videos.length);
    if (window.__interviewVideosMentorData) {
      injectFeedbackAssignIntoCards(window.__interviewVideosMentorData);
    }
  }

  function openModal(videoId) {
    var data = (window.INTERVIEW_VIDEOS_DATA || []).find(function (v) {
      return v.id === videoId;
    });
    if (!data) return;

    var backdrop = document.getElementById("interview-video-modal-backdrop");
    var panel = document.getElementById("interview-video-modal-panel");
    if (!backdrop || !panel) return;

    var titleEl = panel.querySelector(".interview-video-modal-title");
    var videoWrap = panel.querySelector(".interview-video-modal-video-wrap");
    var attachmentsBlock = panel.querySelector(
      ".interview-video-modal-attachments",
    );
    var descriptionEl = panel.querySelector(
      ".interview-video-modal-description",
    );

    if (titleEl) titleEl.textContent = data.title;

    var englishBadgeEl = panel.querySelector(
      "#interview-video-modal-badge-english",
    );
    if (englishBadgeEl) {
      var isEnglish = data.language === "en" || data.english === true;
      englishBadgeEl.style.display = isEnglish ? "inline-flex" : "none";
    }

    var offerBadgeEl = panel.querySelector(
      "#interview-video-modal-badge-offer",
    );
    if (offerBadgeEl) {
      if (data.offer) {
        offerBadgeEl.textContent = data.offer;
        offerBadgeEl.style.display = "inline-flex";
      } else {
        offerBadgeEl.style.display = "none";
      }
    }

    var modeBadgeEl = panel.querySelector("#interview-video-modal-badge-mode");
    if (modeBadgeEl) {
      var modeVal = (data.mode || "").toLowerCase();
      var modeLabel = MODE_LABELS[modeVal] ? tr(MODE_LABELS[modeVal]) : "";
      if (modeLabel) {
        modeBadgeEl.textContent = modeLabel;
        modeBadgeEl.className =
          "interview-video-modal-badge-mode interview-video-modal-badge-mode-" +
          modeVal;
        modeBadgeEl.style.display = "inline-flex";
      } else {
        modeBadgeEl.style.display = "none";
      }
    }

    var watchedEl = panel.querySelector("#interview-video-modal-watched");
    if (watchedEl) watchedEl.innerHTML = watchedButtonHtml(data.id);

    if (videoWrap) {
      var url = data.videoUrl || "";
      var isGoogleDrive = url.indexOf("drive.google.com") !== -1;
      var isYoutube =
        url.indexOf("youtube.com") !== -1 || url.indexOf("youtu.be") !== -1;

      if (isGoogleDrive) {
        // Google Drive блокирует iframe с внешних сайтов (X-Frame-Options). Показываем кнопку «Открыть в Google Drive».
        var driveId =
          url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
          url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        var viewUrl = driveId
          ? "https://drive.google.com/file/d/" +
            driveId[1] +
            "/view?usp=sharing"
          : url;
        videoWrap.innerHTML =
          '<div class="interview-video-drive-fallback">' +
          '<p class="interview-video-drive-fallback-text">Видео на Google Drive. Встроенный плеер с других сайтов Google не поддерживает.</p>' +
          '<a href="' +
          escapeHtml(viewUrl) +
          '" target="_blank" rel="noopener" class="interview-video-drive-fallback-btn">▶ Открыть видео в Google Drive</a>' +
          "</div>";
      } else if (isYoutube) {
        var embedUrl = url;
        if (url.indexOf("embed") === -1) {
          var m = url.match(/(?:v=|\/)([\w-]+)/);
          embedUrl = m ? "https://www.youtube.com/embed/" + m[1] : url;
        }
        videoWrap.innerHTML =
          '<iframe src="' +
          escapeHtml(embedUrl) +
          '" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>';
      } else {
        if (isAudioRecording(data)) {
          videoWrap.innerHTML =
            '<div class="interview-video-modal-audio-wrap">' +
            '<audio controls preload="metadata" controlsList="nodownload" src="' +
            escapeHtml(url) +
            '"></audio>' +
            "</div>";
        } else {
          videoWrap.innerHTML =
            '<video controls preload="metadata" controlsList="nodownload" src="' +
            escapeHtml(url) +
            '"></video>';
        }
      }
    }

    /**
     * Рендерит объект фидбека (или показывает "не найден", если null) в
     * панель предпросмотра модалки. Общий хелпер для трёх источников
     * данных: кэш interviewVideoFeedbackPayloads, прямое чтение
     * users/{uid}/feedbacks (владелец), и callable listStaffFeedbacks
     * (чужой фидбек, читает staff).
     */
    function renderFeedbackInto(innerEl, feedbackObj) {
      if (!feedbackObj) {
        innerEl.classList.remove(
          "interview-video-modal-pdf-preview-inner-has-feedback",
        );
        innerEl.innerHTML =
          '<span class="interview-video-modal-no-pdf">Фидбек не найден. <a href="/profile/feedbacks.html" target="_blank" rel="noopener">Фидбеки в профиле</a>.</span>';
        return;
      }
      var content = renderFeedbackBody(feedbackObj, feedbackObj.feedbackId);
      var wrapped = content
        ? '<div class="feedback-page"><div class="fb-modal-body">' +
          content +
          "</div></div>"
        : '<span class="interview-video-modal-no-pdf">Фидбек пуст.</span>';
      innerEl.innerHTML = wrapped;
      innerEl.classList.remove(
        "interview-video-modal-pdf-preview-inner-has-feedback",
      );
      if (content) {
        innerEl.classList.add(
          "interview-video-modal-pdf-preview-inner-has-feedback",
        );
        // Сворачивание блоков — через глобальный toggleFeedbackBlock из
        // feedback-render.js (inline-onclick в разметке), как на странице фидбеков.
        renderFeedbackMath(innerEl);
      }
    }

    var pdfPreviewInner = panel.querySelector(
      ".interview-video-modal-pdf-preview-inner",
    );
    if (pdfPreviewInner) {
      pdfPreviewInner.classList.remove(
        "interview-video-modal-pdf-preview-inner-has-feedback",
      );
      pdfPreviewInner.innerHTML =
        '<div class="interview-video-feedback-loading">Загрузка…</div>';
      (function (d, innerEl) {
        var currentUid = getCurrentAuthUid();
        loadFeedbackPayloadForVideo(d.id, currentUid)
          .then(function (payload) {
            if (payload && payload.feedback) {
              renderFeedbackInto(innerEl, payload.feedback);
              return null;
            }
            return getFeedbackMappingForVideo(d.id);
          })
          .then(function (mapping) {
            if (mapping === null) {
              innerEl.classList.remove(
                "interview-video-modal-pdf-preview-inner-has-feedback",
              );
              innerEl.innerHTML =
                '<span class="interview-video-modal-no-pdf">К этому видео пока не прикреплён фидбек.</span>';
              return;
            }
            var uid = mapping
              ? mapping.feedbackUserId
              : d.feedbackUserId && typeof d.feedbackUserId === "string"
                ? d.feedbackUserId.trim()
                : "";
            var fid = mapping
              ? mapping.feedbackId
              : d.feedbackId && typeof d.feedbackId === "string"
                ? d.feedbackId.trim()
                : "";
            if (fid && uid) {
              // Фидбек к записи — обычно фидбек другого ученика: правила не
              // дают браузеру прочитать его напрямую, поэтому его отдаёт
              // сервер (getInterviewVideoFeedback) всем, кому открыта страница.
              window.staffApi
                .call(
                  "getInterviewVideoFeedback",
                  { videoId: d.id },
                  { retry: false },
                )
                .then(function (result) {
                  renderFeedbackInto(innerEl, result && result.feedback);
                })
                .catch(function (e) {
                  console.error(
                    "Interview videos: failed to load feedback for modal",
                    e,
                  );
                  innerEl.classList.remove(
                    "interview-video-modal-pdf-preview-inner-has-feedback",
                  );
                  innerEl.innerHTML =
                    '<span class="interview-video-modal-no-pdf">Ошибка загрузки. <a href="/profile/feedbacks.html" target="_blank" rel="noopener">Фидбеки в профиле</a>.</span>';
                });
            } else {
              var pdfUrlTrim =
                d.pdfUrl && typeof d.pdfUrl === "string" ? d.pdfUrl.trim() : "";
              var hasPdf = pdfUrlTrim !== "";
              if (hasPdf) {
                var pdfHref = d.pdfUrl.trim();
                var isPdfDrive = pdfHref.indexOf("drive.google.com") !== -1;
                if (isPdfDrive) {
                  var pdfDriveId =
                    pdfHref.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
                    pdfHref.match(/[?&]id=([a-zA-Z0-9_-]+)/);
                  if (pdfDriveId)
                    pdfHref =
                      "https://drive.google.com/file/d/" +
                      pdfDriveId[1] +
                      "/view?usp=sharing";
                  innerEl.classList.remove(
                    "interview-video-modal-pdf-preview-inner-has-feedback",
                  );
                  innerEl.innerHTML =
                    '<div class="interview-video-pdf-drive-fallback"><p>PDF на Google Drive. Встроенный просмотр с других сайтов не поддерживается.</p><a class="interview-video-modal-pdf-link" href="' +
                    escapeHtml(pdfHref) +
                    '" target="_blank" rel="noopener">Открыть PDF в Google Drive</a></div>';
                } else {
                  innerEl.classList.remove(
                    "interview-video-modal-pdf-preview-inner-has-feedback",
                  );
                  innerEl.innerHTML =
                    '<iframe src="' +
                    escapeHtml(pdfHref) +
                    '" title="Превью PDF"></iframe><a class="interview-video-modal-pdf-link interview-video-modal-pdf-open-external" href="' +
                    escapeHtml(pdfHref) +
                    '" target="_blank" rel="noopener">Открыть в новой вкладке</a>';
                }
              } else {
                innerEl.classList.remove(
                  "interview-video-modal-pdf-preview-inner-has-feedback",
                );
                innerEl.innerHTML =
                  '<span class="interview-video-modal-no-pdf">К этому видео пока не прикреплён фидбек.</span>';
              }
            }
            // Ветка fid && uid выше не возвращается (return) в эту цепочку —
            // её собственные ошибки ловятся внутри неё же, сюда они не долетают.
          })
          .catch(function (e) {
            console.error(
              "Interview videos: failed to render feedback panel",
              e,
            );
            innerEl.classList.remove(
              "interview-video-modal-pdf-preview-inner-has-feedback",
            );
            innerEl.innerHTML =
              '<span class="interview-video-modal-no-pdf">Ошибка загрузки. <a href="/profile/feedbacks.html" target="_blank" rel="noopener">Фидбеки в профиле</a>.</span>';
          });
      })(data, pdfPreviewInner);
    }

    if (descriptionEl) {
      descriptionEl.textContent = data.description || "";
      descriptionEl.style.display = data.description ? "block" : "none";
    }

    var summaryWrap = panel.querySelector(
      ".interview-video-modal-summary-wrap",
    );
    var summaryEl = panel.querySelector(".interview-video-modal-summary");
    if (summaryWrap && summaryEl) {
      if (data.summary) {
        summaryEl.innerHTML = data.summary;
        summaryWrap.style.display = "block";
      } else {
        summaryEl.innerHTML = "";
        summaryWrap.style.display = "none";
      }
    }

    backdrop.classList.add("open");
    document.body.style.overflow = "hidden";

    var closeBtn = panel.querySelector(".interview-video-modal-close");
    if (closeBtn) closeBtn.onclick = closeModal;
    backdrop.onclick = function (e) {
      if (e.target === backdrop) closeModal();
    };
    document.addEventListener("keydown", onModalKeydown);

    function onPanelMouseEnter() {
      panel.classList.add("interview-video-modal-panel-pointer-inside");
    }
    function onPanelMouseLeave(e) {
      if (e.relatedTarget && panel.contains(e.relatedTarget)) return;
      panel.classList.remove("interview-video-modal-panel-pointer-inside");
    }
    panel.addEventListener("mouseenter", onPanelMouseEnter);
    panel.addEventListener("mouseleave", onPanelMouseLeave);
    panel._modalLeaveHandler = onPanelMouseLeave;
    panel._modalEnterHandler = onPanelMouseEnter;
  }

  function closeModal() {
    var backdrop = document.getElementById("interview-video-modal-backdrop");
    var panel = document.getElementById("interview-video-modal-panel");
    if (!backdrop) return;
    backdrop.classList.remove("open");
    document.body.style.overflow = "";
    document.removeEventListener("keydown", onModalKeydown);
    if (panel) {
      panel.classList.remove("interview-video-modal-panel-pointer-inside");
      if (panel._modalEnterHandler)
        panel.removeEventListener("mouseenter", panel._modalEnterHandler);
      if (panel._modalLeaveHandler)
        panel.removeEventListener("mouseleave", panel._modalLeaveHandler);
      panel._modalEnterHandler = null;
      panel._modalLeaveHandler = null;
    }
    var videoWrap = document.querySelector(
      "#interview-video-modal-panel .interview-video-modal-video-wrap",
    );
    if (videoWrap) {
      var iframe = videoWrap.querySelector("iframe");
      if (iframe) iframe.src = "";
      var video = videoWrap.querySelector("video");
      if (video) {
        video.pause();
        video.src = "";
      }
      var audio = videoWrap.querySelector("audio");
      if (audio) {
        audio.pause();
        audio.src = "";
      }
    }
    var pdfPreview = document.querySelector(
      "#interview-video-modal-panel .interview-video-modal-pdf-preview-inner iframe",
    );
    if (pdfPreview) pdfPreview.src = "";
  }

  function onModalKeydown(e) {
    if (e.key === "Escape") closeModal();
  }

  function initFilters() {
    var typeChips = document.querySelectorAll("[data-iv-filter=type]");
    var topicChips = document.querySelectorAll("[data-iv-filter=topic]");
    var languageChips = document.querySelectorAll("[data-iv-filter=language]");
    var modeChips = document.querySelectorAll("[data-iv-filter=mode]");
    var watchedChips = document.querySelectorAll("[data-iv-filter=watched]");

    watchedChips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        setFilter("watched", chip.dataset.value || "");
        rerender();
      });
    });

    typeChips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        var value = chip.dataset.value || "";
        setFilter("type", value);
        var filters = getFilters();
        var filtered = filterVideos(
          window.INTERVIEW_VIDEOS_DATA || [],
          filters,
        );
        renderGrid(groupVideosForDisplay(filtered));
      });
    });

    languageChips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        var value = chip.dataset.value || "";
        setFilter("language", value);
        var filters = getFilters();
        var filtered = filterVideos(
          window.INTERVIEW_VIDEOS_DATA || [],
          filters,
        );
        renderGrid(groupVideosForDisplay(filtered));
      });
    });

    modeChips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        var value = chip.dataset.value || "";
        setFilter("mode", value);
        var filters = getFilters();
        var filtered = filterVideos(
          window.INTERVIEW_VIDEOS_DATA || [],
          filters,
        );
        renderGrid(groupVideosForDisplay(filtered));
      });
    });

    topicChips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        var current = document.getElementById("iv-filter-topic");
        var value =
          current && current.dataset.value === chip.dataset.value
            ? ""
            : chip.dataset.value || "";
        setFilter("topic", value);
        var filters = getFilters();
        var filtered = filterVideos(
          window.INTERVIEW_VIDEOS_DATA || [],
          filters,
        );
        renderGrid(groupVideosForDisplay(filtered));
      });
    });
  }

  function resetFilters() {
    setFilter("type", "");
    setFilter("topic", "");
    setFilter("language", "");
    setFilter("mode", "");
    setFilter("watched", "");
    var data = window.INTERVIEW_VIDEOS_DATA || [];
    renderGrid(groupVideosForDisplay(data));
  }

  function filterValueExists(key, value) {
    if (!value) return false;
    var chips = document.querySelectorAll("[data-iv-filter='" + key + "']");
    for (var i = 0; i < chips.length; i += 1) {
      if (chips[i].dataset.value === value) return true;
    }
    return false;
  }

  function applyInitialFiltersFromUrl() {
    if (typeof URLSearchParams === "undefined") return getFilters();

    var params = new URLSearchParams(window.location.search || "");
    ["type", "topic", "language", "mode", "watched"].forEach(function (key) {
      var value = params.get(key) || "";
      if (filterValueExists(key, value)) setFilter(key, value);
    });

    return getFilters();
  }

  async function initFeedbackAssignSection() {
    try {
      var mapping = await loadFullFeedbackMapping();
      var students = await loadStudentsWithFeedbacks();
      eachFeedbackMapping(
        mapping,
        function (videoId, feedbackUserId, feedbackId) {
          syncFeedbackPayloadForMapping(videoId, feedbackUserId, feedbackId);
        },
      );
      window.__interviewVideosMentorData = {
        students: students,
        mapping: mapping,
      };
      document.body.classList.add("user-is-mentor");
      injectFeedbackAssignIntoCards(window.__interviewVideosMentorData);
    } catch (e) {
      console.warn("Interview videos: init feedback assign failed", e);
    }
  }

  function rerender() {
    renderGrid(
      groupVideosForDisplay(
        filterVideos(window.INTERVIEW_VIDEOS_DATA || [], getFilters()),
      ),
    );
  }

  function showLoadError() {
    var container = document.getElementById("interview-videos-grid");
    var emptyEl = document.getElementById("interview-videos-empty");
    if (container) container.innerHTML = "";
    if (!emptyEl) return;
    emptyEl.style.display = "block";
    emptyEl.innerHTML =
      "<strong>" +
      escapeHtml(tr("Не удалось загрузить записи")) +
      '</strong> <button type="button" class="interview-videos-filters-reset" id="interview-videos-retry">' +
      escapeHtml(tr("Повторить")) +
      "</button>";
    document
      .getElementById("interview-videos-retry")
      .addEventListener("click", function () {
        emptyEl.style.display = "none";
        loadVideos();
      });
  }

  // Ошибка — не «записей нет»: без отдельного состояния закрытый раздел или
  // невыкаченная функция выглядели бы как пустой каталог.
  function loadVideos() {
    if (!window.staffApi) {
      showLoadError();
      return Promise.resolve();
    }
    return window.staffApi
      .call("listInterviewVideos")
      .then(function (result) {
        window.INTERVIEW_VIDEOS_DATA = (result && result.items) || [];
        window.__interviewVideosCanEdit = Boolean(result && result.canEdit);
        var emptyEl = document.getElementById("interview-videos-empty");
        if (emptyEl && emptyEl.querySelector("#interview-videos-retry")) {
          emptyEl.innerHTML =
            "<strong>Нет видео</strong> Измените фильтры, чтобы увидеть записи.";
        }
        rerender();
        loadWatched().then(rerender);
        if (window.__interviewVideosCanEdit && window.interviewVideoEditor) {
          window.interviewVideoEditor.init();
        }
      })
      .catch(function (error) {
        console.warn("Interview videos: list failed", error);
        showLoadError();
      });
  }

  function init() {
    initFilters();
    var resetEl = document.getElementById("interview-videos-reset");
    if (resetEl) resetEl.addEventListener("click", resetFilters);
    applyInitialFiltersFromUrl();
    loadVideos();

    function tryInitMentorFeedbacks() {
      getCurrentUserRole().then(function (role) {
        if (!canAssignFeedbacks(role)) return;
        initFeedbackAssignSection();
      });
    }
    getInterviewVideosDb()
      .then(function (db) {
        if (db && typeof firebase !== "undefined" && firebase.auth) {
          if (firebase.auth().currentUser) {
            tryInitMentorFeedbacks();
          } else {
            firebase.auth().onAuthStateChanged(function (user) {
              if (user) tryInitMentorFeedbacks();
            });
          }
          setTimeout(tryInitMentorFeedbacks, 1500);
        } else {
          tryInitMentorFeedbacks();
        }
      })
      .catch(function () {
        tryInitMentorFeedbacks();
      });
    setTimeout(tryInitMentorFeedbacks, 2500);
  }

  // Одновременно играет одна запись: старт любой (в карточке или в модалке)
  // ставит на паузу остальные. Событие play не всплывает — ловим на захвате.
  function pauseOtherMedia(e) {
    document.querySelectorAll("audio, video").forEach(function (el) {
      if (el !== e.target && !el.paused) el.pause();
    });
  }
  document.addEventListener("play", pauseOtherMedia, true);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.interviewVideosCloseModal = closeModal;
  window.interviewVideosPage = { reload: loadVideos };
  window.interviewVideosIsAudio = isAudioRecording;
  window.interviewVideosGroup = groupVideosForDisplay;
  window.interviewVideosFormatAddedAt = formatAddedAt;
  window.interviewVideosPauseOtherMedia = pauseOtherMedia;
  window.interviewVideosWaveLevels = waveLevels;
  window.interviewVideosIsSilent = isSilent;
  window.interviewVideosModeLabels = MODE_LABELS;
})();
