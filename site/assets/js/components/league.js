/**
 * Вкладка «Моя лига» на leaderboard.html — еженедельный зачёт в группе из
 * 10–15 учеников (сервер: functions/leagues.js, callable getMyLeague).
 *
 * Ученик видит свою группу (getMyLeague). Персонал в лигах не участвует, но
 * видит их целиком: та же вкладка называется «Лиги» и показывает все группы
 * формата по тирам (getStaffLeagues) — куратору только группы со своими
 * учениками. Данные приходят одним вызовом при открытии вкладки; напрямую из
 * базы лиги не читаются — оба корня закрыты правилами.
 */
(function () {
  "use strict";

  // Перевод: t() и window.i18n кладёт сниппет theme-boot.
  const t =
    window.t ||
    ((text, params) =>
      text.replace(/\{(\w+)\}/g, (match, key) => params?.[key] ?? match));

  const STAFF_ROLES = new Set(["mentor", "curator", "admin", "admin-helper"]);
  // Блоки общего зачёта, которые прячутся, пока открыта лига.
  const BOARD_BLOCKS = [
    ".leaderboard-sections",
    "#leaderboardStats",
    "#leaderboardControls",
    "#leaderboardContainer",
  ];
  // Итог прошлой недели целой фразой: по-английски порядок слов другой.
  const MOVED_TEXT = {
    up: "Прошлая неделя: {place}-е место — повышение, теперь ты в лиге «{tier}».",
    down: "Прошлая неделя: {place}-е место — понижение, теперь ты в лиге «{tier}».",
    stay: "Прошлая неделя: {place}-е место — на этой неделе ты в лиге «{tier}».",
  };
  // Повторное открытие вкладки перезапрашивает данные старше минуты.
  const FRESH_MS = 60000;
  const FORMAT_LABELS = {
    mentorship: "Менторство",
    materials: "Только материалы",
  };
  const MOVED_MARK = { up: "↑", down: "↓" };
  const MOVED_TITLE = {
    up: "Повышен по итогам прошлой недели",
    down: "Понижен по итогам прошлой недели",
  };
  // Эмблемы тиров поверх щита: шеврон, два шеврона, звезда, камень. Рисуются
  // SVG, а не эмодзи: эмодзи выглядят по-разному в каждой ОС.
  const TIER_EMBLEMS = {
    bronze: '<path d="M15 32 L24 25 L33 32" class="league-badge-line"/>',
    silver:
      '<path d="M15 28 L24 21 L33 28" class="league-badge-line"/><path d="M15 37 L24 30 L33 37" class="league-badge-line"/>',
    gold: '<path d="M24 18 L26.6 24.9 L34 25.3 L28.2 29.9 L30.2 37 L24 32.9 L17.8 37 L19.8 29.9 L14 25.3 L21.4 24.9 Z" class="league-badge-fill"/>',
    platinum:
      '<path d="M15.5 25 L20 19 H28 L32.5 25 L24 38 Z" class="league-badge-fill"/><path d="M15.5 25 H32.5 M20 19 L24 25 L28 19" class="league-badge-facet"/>',
  };
  const SHIELD =
    "M24 3 L43 10 V27 C43 40 35 48.5 24 53 C13 48.5 5 40 5 27 V10 Z";
  let loadedAt = 0;
  let loading = false;
  let staffMode = false;
  let staffFormat = "";
  // Формат последней удачно показанной таблицы: на него откатываемся, если
  // переключение не удалось, — иначе «Повторить» вечно просил бы упавший формат.
  let shownFormat = "";

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // id тира только из известного списка: он попадает в класс и в innerHTML.
  function tierId(tier) {
    return TIER_EMBLEMS[tier && tier.id] ? tier.id : "bronze";
  }

  // Щит в цвете тира: стопы градиента берут цвета из CSS-переменных класса
  // league-tier-<id>. Разметка — только константы и id из белого списка.
  function tierBadge(tier, className) {
    const id = tierId(tier);
    const badge = el("span", `league-badge league-tier-${id} ${className}`);
    badge.setAttribute("aria-hidden", "true");
    badge.innerHTML = `<svg viewBox="0 0 48 56"><defs><linearGradient id="leagueBadge-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="league-badge-top"/><stop offset="1" class="league-badge-bottom"/></linearGradient></defs><path d="${SHIELD}" fill="url(#leagueBadge-${id})" class="league-badge-shield"/>${TIER_EMBLEMS[id]}</svg>`;
    return badge;
  }

  // Ротации ещё не было или ученик пришёл посреди недели — спокойное «скоро».
  function renderPending(panel) {
    panel.replaceChildren(
      el("h2", "league-title", t("Лига начнётся в понедельник")),
      el(
        "p",
        "league-hint",
        t(
          "Каждую неделю ученики делятся на группы по 10–15 человек близкого уровня и соревнуются по числу решённых за неделю вопросов. Лучшие переходят в лигу выше.",
        ),
      ),
    );
  }

  // Сеть, 5xx, отозванная сессия, функция ещё не выкачена: это не «скоро», и
  // выдавать одно за другое нельзя — ученик ждал бы понедельника зря.
  function renderError(panel) {
    // Не «Повторить»: этот ключ словаря уже значит «повторить карточки».
    const retry = el("button", "refresh-btn", t("Попробовать снова"));
    retry.type = "button";
    retry.addEventListener("click", () => load(panel));
    panel.replaceChildren(
      el("h2", "league-title", t("Не удалось загрузить лигу")),
      el("p", "league-hint", t("Проверь соединение и попробуй ещё раз.")),
      retry,
    );
  }

  function renderRow(row) {
    const node = el(
      "li",
      `league-row league-zone-${row.zone}${row.isMe ? " league-row-me" : ""}`,
    );
    const avatar = el("span", "league-avatar");
    if (/^https:\/\//.test(row.avatarUrl || "")) {
      const img = el("img");
      img.src = row.avatarUrl;
      img.alt = "";
      avatar.append(img);
    } else {
      avatar.textContent = (row.displayName || "?").charAt(0).toUpperCase();
    }
    node.append(
      el("span", "league-place", String(row.place)),
      avatar,
      el(
        "span",
        "league-name",
        row.isMe
          ? t("{name} — ты", { name: row.displayName })
          : row.displayName,
      ),
      el("span", "league-score", String(row.score)),
    );
    return node;
  }

  function render(panel, league) {
    // Название тира приходит с сервера по-русски — переводим по словарю.
    const tier = t(league.tier.name);
    const head = el("div", "league-head");
    head.append(
      tierBadge(league.tier, "league-badge-lg"),
      el("h2", "league-title", t("Лига «{tier}»", { tier })),
    );
    panel.className = `league-panel league-tier-${tierId(league.tier)}`;
    const nodes = [
      head,
      el(
        "p",
        "league-hint",
        t(
          "До конца недели {days}. Очки — вопросы, решённые с понедельника. Зелёная зона претендует на лигу выше (она открывается, когда в ней набирается трое), красная идёт в лигу ниже; без решённых вопросов — понижение.",
          { days: daysText(league.daysLeft) },
        ),
      ),
    ];
    const last = league.lastResult;
    if (last && MOVED_TEXT[last.moved]) {
      nodes.push(
        el(
          "p",
          `league-last league-last-${last.moved}`,
          t(MOVED_TEXT[last.moved], { place: last.place, tier }),
        ),
      );
    }
    const list = el("ol", "league-list");
    list.append(...league.rows.map(renderRow));
    nodes.push(list);
    panel.replaceChildren(...nodes);
  }

  function formatDay(day) {
    if (window.i18n?.lang === "en")
      return `${day.slice(5, 7)}/${day.slice(8, 10)}`;
    return `${day.slice(8, 10)}.${day.slice(5, 7)}`;
  }

  // ru: [один, два, пять], en: [one, many].
  function plural(n, ru, en) {
    if (window.i18n) return window.i18n.plural(n, { ru, en });
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return ru[0];
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return ru[1];
    return ru[2];
  }

  function daysText(n) {
    return `${n} ${plural(n, ["дн", "дн", "дн"], ["day", "days"])}`;
  }

  function renderStaffRow(row) {
    const node = el("li", `league-row league-zone-${row.zone}`);
    // Ссылка на карточку — только по своим ученикам: чужой uid сервер не отдаёт.
    const name = row.uid
      ? el("a", "league-name", row.displayName)
      : el("span", "league-name", row.displayName);
    if (row.uid)
      name.href = `/curator/student.html?id=${encodeURIComponent(row.uid)}`;
    const moved = el(
      "span",
      `league-moved league-moved-${row.moved || "none"}`,
      MOVED_MARK[row.moved] || "",
    );
    if (MOVED_TITLE[row.moved]) moved.title = t(MOVED_TITLE[row.moved]);
    node.append(
      el("span", "league-place", String(row.place)),
      name,
      moved,
      el("span", "league-score", String(row.score)),
    );
    return node;
  }

  function renderStaffFormats(panel, view) {
    if ((view.formats || []).length < 2) return null;
    const group = el("div", "leaderboard-tabs league-formats");
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", t("Формат обучения"));
    view.formats.forEach((format) => {
      const button = el(
        "button",
        `leaderboard-tab${format === view.format ? " active" : ""}`,
        FORMAT_LABELS[format] ? t(FORMAT_LABELS[format]) : format,
      );
      button.type = "button";
      button.addEventListener("click", () => {
        if (format === staffFormat) return;
        staffFormat = format;
        load(panel);
      });
      group.append(button);
    });
    return group;
  }

  function renderStaff(panel, view) {
    staffFormat = view.format;
    shownFormat = view.format;
    const nodes = [el("h2", "league-title", t("Лиги недели"))];
    const formats = renderStaffFormats(panel, view);
    if (formats) nodes.push(formats);
    if (view.status === "empty") {
      nodes.push(
        el(
          "p",
          "league-hint",
          t(
            "Лиги на этой неделе идут, но ваших учеников в группах нет: в лиги попадают активные ученики с заполненным именем.",
          ),
        ),
      );
      panel.replaceChildren(...nodes);
      return;
    }
    if (view.status !== "active") {
      nodes.push(
        el(
          "p",
          "league-hint",
          t(
            "Групп на этой неделе ещё нет. Они собираются в понедельник в 00:15 по Москве: ученики делятся на группы до 15 человек внутри лиги, первые трое по решённым за неделю вопросам переходят лигой выше, последние трое и все без единого вопроса — ниже.",
          ),
        ),
      );
      panel.replaceChildren(...nodes);
      return;
    }
    nodes.push(
      el(
        "p",
        "league-hint",
        t(
          "Неделя {start}–{end}, до конца {days}. · {students} в {groups}. Очки — вопросы, решённые с понедельника; зелёная зона претендует на лигу выше (лига открывается, когда в ней набирается трое), красная идёт ниже. Стрелка у имени — итог прошлой недели.",
          {
            start: formatDay(view.week),
            end: formatDay(view.weekEnd),
            days: daysText(view.daysLeft),
            students: `${view.students} ${plural(view.students, ["ученик", "ученика", "учеников"], ["student", "students"])}`,
            groups: `${view.groups} ${plural(view.groups, ["группе", "группах", "группах"], ["group", "groups"])}`,
          },
        ),
      ),
    );
    view.tiers.forEach((entry) => {
      const count = entry.groups.reduce(
        (sum, group) => sum + group.rows.length,
        0,
      );
      const title = el("h3", "league-tier-title");
      title.append(
        tierBadge(entry.tier, "league-badge-sm"),
        `${t(entry.tier.name)} · ${count}`,
      );
      nodes.push(title);
      const grid = el("div", "league-groups");
      entry.groups.forEach((group, index) => {
        const card = el("section", "league-group");
        if (entry.groups.length > 1)
          card.append(
            el(
              "h4",
              "league-group-title",
              t("Группа {number}", { number: group.number || index + 1 }),
            ),
          );
        const list = el("ol", "league-list");
        list.append(...group.rows.map(renderStaffRow));
        card.append(list);
        grid.append(card);
      });
      nodes.push(grid);
    });
    panel.replaceChildren(...nodes);
  }

  async function load(panel) {
    if (loading) return;
    loading = true;
    panel.replaceChildren(
      el(
        "p",
        "league-hint",
        staffMode ? t("Загружаем лиги…") : t("Загружаем лигу…"),
      ),
    );
    try {
      if (staffMode) {
        const view = await window.achievementApi.call(
          "getStaffLeagues",
          staffFormat ? { format: staffFormat } : {},
          { retry: true },
        );
        renderStaff(panel, view || {});
        loadedAt = Date.now();
        return;
      }
      const league = await window.achievementApi.call(
        "getMyLeague",
        {},
        { retry: true },
      );
      if (league?.status === "active") render(panel, league);
      else renderPending(panel);
      loadedAt = Date.now();
    } catch (error) {
      console.warn("League is unavailable:", error);
      loadedAt = 0;
      staffFormat = shownFormat;
      renderError(panel);
    } finally {
      loading = false;
    }
  }

  function setView(tabs, panel, view) {
    const isLeague = view === "league";
    tabs.querySelectorAll(".leaderboard-tab").forEach((tab) => {
      const active = tab.dataset.view === view;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", active ? "true" : "false");
    });
    BOARD_BLOCKS.forEach((selector) => {
      const block = document.querySelector(selector);
      if (block) block.classList.toggle("league-hidden", isLeague);
    });
    panel.hidden = !isLeague;
    if (isLeague && Date.now() - loadedAt > FRESH_MS) load(panel);
  }

  /** Вызывается со страницы после firebase.initializeApp. */
  function init() {
    const tabs = document.getElementById("leagueTabs");
    const panel = document.getElementById("leaguePanel");
    if (!tabs || !panel) return;
    tabs.addEventListener("click", (event) => {
      const tab = event.target.closest(".leaderboard-tab");
      if (tab) setView(tabs, panel, tab.dataset.view);
    });
    firebase.auth().onAuthStateChanged(async (user) => {
      if (!user) return;
      try {
        // leaderboard.js узнаёт роль асинхронно внутри своей загрузки, и к
        // этому моменту она обычно ещё не известна — тогда читаем сами.
        // Личный путь: своя роль, а не чужие данные.
        const role =
          window.leaderboard?.currentUserRole ||
          String(
            (
              await firebase
                .database()
                .ref(`users/${user.uid}/role`)
                .once("value")
            ).val() || "student",
          ).toLowerCase();
        staffMode = STAFF_ROLES.has(role);
        if (staffMode) {
          const leagueTab = tabs.querySelector('[data-view="league"]');
          if (leagueTab) leagueTab.textContent = t("Лиги");
        }
        tabs.hidden = false;
      } catch (error) {
        console.warn("League tab is hidden: role is unavailable.", error);
      }
    });
  }

  window.leagueTab = { init };
})();
