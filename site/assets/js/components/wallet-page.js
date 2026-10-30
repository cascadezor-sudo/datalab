(function () {
  "use strict";

  /**
   * Страница кошелька: баланс, множитель, кривая спуска с рубежами серии,
   * ставки, витрина и история. Из базы читаются только свои узлы:
   * `wallets/<uid>/summary`, хвост `wallet_ledger/<uid>`, `users/<uid>/streakState`
   * и `achievement_stats/<uid>/activityDays` (для множителя). Начисляет грады
   * только сервер — functions/wallet.js.
   */

  // Перевод интерфейса (ядро — сниппет theme-boot). Без него — русский текст
  // с подставленными значениями.
  const t =
    window.t ||
    ((text, params) =>
      text.replace(/\{(\w+)\}/g, (match, key) => params?.[key] ?? match));
  const locale = () => window.i18n?.locale || "ru-RU";

  const CONFIG_URL = "/assets/js/config/wallet-config.json";
  const COIN_HREF = "#grad-coin";
  const HISTORY_LIMIT = 50;
  const DAY_MS = 24 * 60 * 60 * 1000;

  const KIND_LABELS = {
    question: "Изучены вопросы",
    quiz: "Сдан тест",
    quizPerfect: "Тест на 100%",
    blockQuiz: "Сдан тест блока",
    report: "Ежедневный отчёт",
    reportRest: "Отчёт о выходном",
    reviews: "Повторение карточек",
    reviewsBonus: "Бонус за повторение",
    streak: "Рубеж серии",
    achievement: "Достижения",
    backfill: "Стартовое начисление за прошлую активность",
    adjust: "Начисление персоналом",
    spend: "Списание за покупку",
    purchase: "Заказ из витрины",
    refund: "Возврат за отменённый заказ",
    referral: "Приведённый ученик",
    questionOfDay: "Вопрос дня",
    suggestion: "Внедрённое предложение",
    questionReport: "Найденная ошибка в вопросе",
  };

  const ORDER_STATUS = {
    pending: "Ждёт выдачи",
    done: "Выдан",
    cancelled: "Отменён",
  };

  // Небольшие штриховые иконки видов событий (24×24, currentColor).
  const ICONS = {
    question:
      '<path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1.9-1.1 1.8"/><path d="M12 17h.01"/>',
    quiz: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/>',
    blockQuiz:
      '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/>',
    quizPerfect:
      '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9L12 3.5Z"/>',
    report:
      '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/><path d="M9.5 13h5M9.5 16.5h5"/>',
    reportRest: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>',
    questionOfDay:
      '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/><path d="m9.5 15 2 2 3.5-4"/>',
    suggestion:
      '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3Z"/>',
    questionReport: '<path d="M5 21V4h11l-1.5 4L16 12H5"/>',
    reviews:
      '<rect x="3" y="7" width="13" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/>',
    reviewsBonus: '<path d="M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z"/>',
    streak:
      '<path d="M12 21c4 0 6.5-2.7 6.5-6.2 0-3.3-2.3-5-3.4-7.2-.4 2-1.4 3.1-2.3 3.4C12.9 8.4 12.2 5.5 9.7 3c-.2 3.6-2.3 5.1-3.5 7.2A6.5 6.5 0 0 0 12 21Z"/>',
    achievement:
      '<path d="M8 3h8v6a4 4 0 0 1-8 0V3Z"/><path d="M8 5H5v2a3 3 0 0 0 3 3M16 5h3v2a3 3 0 0 1-3 3"/><path d="M12 13v4M9 21h6M10 17h4"/>',
    backfill:
      '<path d="M3.5 12a8.5 8.5 0 1 0 2.5-6"/><path d="M3.5 3.5V8H8"/><path d="M12 8v4l3 2"/>',
    adjust: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
    referral:
      '<circle cx="9" cy="8" r="3.5"/><path d="M3 20v-1a6 6 0 0 1 12 0v1"/><path d="M18 8v6M15 11h6"/>',
    spend:
      '<path d="M5 8h14l-1.2 11H6.2L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    purchase:
      '<path d="M4 7h16l-1.5 12h-13L4 7Z"/><path d="M9 7V5.5a3 3 0 0 1 6 0V7"/><path d="M9.5 12.5h5"/>',
    refund:
      '<path d="M20.5 12a8.5 8.5 0 1 1-2.5-6"/><path d="M20.5 3.5V8H16"/><path d="M12 8v4l-3 2"/>',
  };

  const $ = (selector) => document.querySelector(selector);

  function escapeHtml(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char],
    );
  }

  function plural(count, config) {
    if (window.walletUi?.pluralCoins) return window.walletUi.pluralCoins(count);
    const n = Math.abs(Number(count) || 0);
    const c = config?.currency || {};
    if (window.i18n) {
      const ru = [c.one || "град", c.few || "града", c.many || "градов"];
      return window.i18n.plural(n, { ru, en: ["grad", "grads"] });
    }
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return c.one || "град";
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20))
      return c.few || "града";
    return c.many || "градов";
  }

  function format(value) {
    return new Intl.NumberFormat(locale()).format(Number(value) || 0);
  }

  function factorText(value) {
    return `×${format(Number(value) || 1)}`;
  }

  function dayWord(n) {
    const ru = ["день", "дня", "дней"];
    if (window.i18n) return window.i18n.plural(n, { ru, en: ["day", "days"] });
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return ru[0];
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return ru[1];
    return ru[2];
  }

  function icon(kind, className = "") {
    const path = ICONS[kind] || ICONS.adjust;
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" class="${className}">${path}</svg>`;
  }

  function amountWithCoin(value) {
    return `${format(value)}${coinIcon("coin-icon coin-icon--sm")}`;
  }

  function coinIcon(className = "coin-icon") {
    return `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" class="${className}"><use href="${COIN_HREF}"></use></svg>`;
  }

  const reduceMotion = () =>
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  async function loadConfig() {
    const response = await fetch(CONFIG_URL, { cache: "no-cache" });
    if (!response.ok) throw new Error(`wallet-config: HTTP ${response.status}`);
    return response.json();
  }

  function moscowDayKey(timestamp) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Moscow",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(timestamp));
  }

  // ── Баланс ───────────────────────────────────────────────────────────────

  function countUp(element, target) {
    const end = Number(target) || 0;
    if (reduceMotion() || end === 0) {
      element.textContent = format(end);
      return;
    }
    const start = performance.now();
    const duration = 900;
    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      element.textContent = format(Math.round(end * eased));
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function renderSummary(summary, config) {
    const balance = Number(summary?.balance) || 0;
    countUp($("#wallet-balance"), balance);
    $("#wallet-balance-unit").textContent = plural(balance, config);
    earnedTotal = Number(summary?.earnedTotal) || 0;
    renderEarned();
    $("[data-wallet-spent]").textContent = format(summary?.spentTotal);
  }

  // Валюта одна, но учёба и рефералы — несравнимые источники: один приведённый
  // ученик даёт больше, чем месяцы вопросов. Показываем их порознь.
  let earnedTotal = 0;
  let referralTotal = 0;
  function renderEarned() {
    $("[data-wallet-earned]").textContent = format(
      Math.max(0, earnedTotal - referralTotal),
    );
    $("[data-wallet-referral-earned]").textContent = format(referralTotal);
  }

  // ── Множитель ────────────────────────────────────────────────────────────

  function sortedTiers(config) {
    return [...(config.multipliers?.streakTiers || [])]
      .map((tier) => ({
        minDays: Number(tier.minDays) || 0,
        factor: Number(tier.factor) || 1,
      }))
      .sort((a, b) => a.minDays - b.minDays);
  }

  function currentFactor(streak, config) {
    let factor = 1;
    for (const tier of sortedTiers(config)) {
      if (streak >= tier.minDays) factor = tier.factor;
    }
    return factor;
  }

  function renderMultiplier(config, streak, reportsLast7) {
    const tiers = sortedTiers(config);
    const factor = currentFactor(streak, config);
    const regularity = config.multipliers?.reportRegularity || {};
    const needed = Number(regularity.minReportsIn7Days || 0);
    const bonusActive = needed > 0 && reportsLast7 >= needed;
    const bonus = bonusActive ? Number(regularity.bonus) || 0 : 0;
    $("#wallet-multiplier-value").textContent = factorText(factor + bonus);

    $("#wallet-tier-scale").innerHTML = tiers
      .map((tier, index) => {
        const next = tiers[index + 1];
        const done = next ? streak >= next.minDays : false;
        const active =
          streak >= tier.minDays && (!next || streak < next.minDays);
        let fill = 0;
        if (done || (active && !next)) fill = 100;
        else if (active && next) {
          fill = Math.round(
            ((streak - tier.minDays) / (next.minDays - tier.minDays)) * 100,
          );
        }
        const range = next
          ? `${tier.minDays}–${next.minDays - 1}`
          : `${tier.minDays}+`;
        return `<div class="wallet-tier${done ? " is-done" : ""}${active ? " is-active" : ""}">
          <div class="wallet-tier__bar"><span class="wallet-tier__fill" style="width:${fill}%"></span></div>
          <div class="wallet-tier__label"><strong>${factorText(tier.factor)}</strong><span>${range}</span></div>
        </div>`;
      })
      .join("");

    const next = tiers.find((tier) => streak < tier.minDays);
    const streakText = `<strong>${format(streak)} ${dayWord(streak)}</strong>`;
    const factorHtml = `<strong>${factorText(factor)}</strong>`;
    const left = next ? next.minDays - streak : 0;
    const parts = [
      next
        ? t("Серия {streak} даёт {factor}, до {next} — ещё {left}.", {
            streak: streakText,
            factor: factorHtml,
            next: factorText(next.factor),
            left: `${format(left)} ${dayWord(left)}`,
          })
        : t("Серия {streak} даёт {factor} — это максимум.", {
            streak: streakText,
            factor: factorHtml,
          }),
    ];
    if (needed > 0) {
      parts.push(
        bonusActive
          ? t("Отчёты регулярные: {bonus} сверху.", {
              bonus: `<strong>+${format(bonus)}</strong>`,
            })
          : t("Отчётов за 7 дней: {count}. Дотяни — и получишь ещё +{bonus}.", {
              count: `<strong>${t("{done} из {needed}", { done: format(reportsLast7), needed: format(needed) })}</strong>`,
              bonus: format(regularity.bonus || 0),
            }),
      );
    }
    $("#wallet-multiplier-note").innerHTML = parts.join(" ");
  }

  // ── Кривая спуска ────────────────────────────────────────────────────────

  function renderCurve(config, streak) {
    const svg = $("#wallet-curve");
    if (!svg) return;
    const milestones = Object.entries(config.streakMilestones || {})
      .map(([days, amount]) => ({ days: Number(days), amount: Number(amount) }))
      .filter((item) => item.days > 0)
      .sort((a, b) => a.days - b.days);
    if (!milestones.length) return;

    const W = 840;
    const H = 280;
    const padL = 36;
    const padR = 36;
    const top = 44;
    const bottom = 56;
    const maxDays = milestones[milestones.length - 1].days;
    const plotW = W - padL - padR;
    const plotH = H - top - bottom;
    // Дни — в логарифмической шкале, иначе 7 и 14 слипнутся у левого края.
    const tOf = (days) => Math.log(Math.max(1, days)) / Math.log(maxDays);
    const xOf = (days) => padL + tOf(days) * plotW;
    // Кривая потерь: быстрый спуск в начале, плато у минимума.
    const yOf = (days) => top + plotH * (1 - Math.exp(-2.6 * tOf(days)));

    const steps = 80;
    const points = [];
    for (let i = 0; i <= steps; i += 1) {
      const days = Math.exp((i / steps) * Math.log(maxDays));
      points.push([xOf(days), yOf(days)]);
    }
    const line = points
      .map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`)
      .join(" ");
    const baseY = (H - bottom).toFixed(1);
    const area = `${line} L${(W - padR).toFixed(1)} ${baseY} L${padL} ${baseY} Z`;

    const grid = [0.25, 0.5, 0.75, 1]
      .map((f) => {
        const y = (top + plotH * f).toFixed(1);
        return `<line class="curve-grid" x1="${padL}" x2="${W - padR}" y1="${y}" y2="${y}"/>`;
      })
      .join("");

    const marks = milestones
      .map((m) => {
        const x = xOf(m.days).toFixed(1);
        const y = yOf(m.days);
        const done = streak >= m.days;
        return `<g>
          <circle class="curve-point${done ? " is-done" : ""}" cx="${x}" cy="${y.toFixed(1)}" r="7"/>
          <text class="curve-amount${done ? "" : " is-todo"}" x="${(Number(x) - 8).toFixed(1)}" y="${(y - 16).toFixed(1)}">${format(m.amount)}</text>
          <use href="#grad-coin" x="${(Number(x) + format(m.amount).length * 3.7 - 4).toFixed(1)}" y="${(y - 27).toFixed(1)}" width="14" height="14"/>
          <text class="curve-days" x="${x}" y="${H - bottom + 20}">${m.days} ${dayWord(m.days)}</text>
        </g>`;
      })
      .join("");

    let you = "";
    if (streak > 0) {
      const clamped = Math.min(streak, maxDays);
      const x = xOf(clamped).toFixed(1);
      const y = yOf(clamped).toFixed(1);
      you = `<g>
        <line x1="${x}" x2="${x}" y1="${y}" y2="${baseY}" stroke="var(--brand)" stroke-dasharray="3 4" stroke-width="1.5"/>
        <circle class="curve-you" cx="${x}" cy="${y}" r="5"/>
        <text class="curve-you-label" x="${x}" y="${H - bottom + 38}">${escapeHtml(t("ты · {days}", { days: `${format(streak)} ${dayWord(streak)}` }))}</text>
      </g>`;
    }

    svg.innerHTML = `${grid}
      <path class="curve-area" d="${area}"/>
      <path class="curve-line" d="${line}"/>
      ${marks}
      ${you}
      <text class="curve-axis" x="${padL}" y="${top - 22}">loss</text>
      <text class="curve-axis" x="${W - padR}" y="${H - bottom + 38}" text-anchor="end">${escapeHtml(t("дни серии →"))}</text>`;
  }

  // ── Ставки и тиры ────────────────────────────────────────────────────────

  function renderRates(config, multiplier) {
    const multiplied = new Set(config.multipliedKinds || []);
    const hints = {
      question: t("Один раз за каждый вопрос"),
      quiz: t("Пересдачи бесплатны"),
      quizPerfect: t("Сверх ставки за сдачу"),
      blockQuiz: t("Один раз за каждый блок, без множителя"),
      report: t("Один отчёт в день"),
      reportRest: t("Вместо обычного отчёта"),
      reviews: t("Не больше {count} карточек в день", {
        count: config.caps?.reviewsPerDay || 30,
      }),
      reviewsBonus: t("От {count} карточек за день", {
        count: config.reviewsDailyBonus?.minCards || 10,
      }),
      referral: t("Один раз за каждого, кого ты привёл на менторство"),
      questionOfDay: t("Раз в день, кнопка на главной"),
      suggestion: t("Когда твою идею с доски предложений внедрили"),
      questionReport: t(
        "Когда ошибку в вопросе, о которой ты сообщил, исправили",
      ),
    };
    $("#wallet-rates").innerHTML = Object.entries(config.earn || {})
      .filter(([, item]) => !item.fixed)
      .map(([kind, item]) => {
        const base = Number(item.base) || 0;
        const applies = multiplied.has(kind) && multiplier !== 1;
        const effective = applies
          ? Math.max(1, Math.round(base * multiplier))
          : base;
        const small = applies
          ? `<s>${format(base)}</s> ${factorText(multiplier)}`
          : multiplied.has(kind)
            ? t("умножается")
            : t("фикс");
        return `<article class="wallet-rate">
          <div class="wallet-rate__icon">${icon(kind)}</div>
          <div class="wallet-rate__label">${escapeHtml(item.label ? t(item.label) : kind)}<span class="wallet-rate__hint">${escapeHtml(hints[kind] || "")}</span></div>
          <div class="wallet-rate__amount"><strong>${amountWithCoin(effective)}</strong><small>${small}</small></div>
        </article>`;
      })
      .join("");

    const tierNames = {
      bronze: "Бронза",
      silver: "Серебро",
      gold: "Золото",
      platinum: "Платина",
    };
    $("#wallet-tiers").innerHTML = Object.entries(config.achievementTiers || {})
      .map(
        ([tier, amount]) =>
          `<li class="wallet-medal wallet-medal--${escapeHtml(tier)}"><span class="wallet-medal__disc" aria-hidden="true"></span><span>${escapeHtml(tierNames[tier] ? t(tierNames[tier]) : tier)}</span><strong>${amountWithCoin(amount)}</strong></li>`,
      )
      .join("");
  }

  // ── Витрина и корзина ────────────────────────────────────────────────────
  //
  // Корзина живёт в localStorage на uid: страницу можно закрыть и вернуться.
  // Оформление — callable purchaseWalletItems: сервер сам берёт цены из
  // конфига, списывает грады в транзакции и ставит заказ в очередь бота.

  const cart = {
    uid: null,
    config: null,
    balance: null,
    items: new Map(),
    busy: false,
  };

  function cartKey() {
    return `wallet-cart:${cart.uid}`;
  }

  function loadCart() {
    cart.items = new Map();
    try {
      const raw = JSON.parse(localStorage.getItem(cartKey()) || "[]");
      const known = new Set(
        (cart.config?.shop?.items || []).map((item) => item.id),
      );
      for (const row of Array.isArray(raw) ? raw : []) {
        if (known.has(row?.id) && Number(row.qty) > 0)
          cart.items.set(row.id, Math.trunc(Number(row.qty)));
      }
    } catch (error) {
      /* нет сохранённой корзины */
    }
  }

  function saveCart() {
    try {
      localStorage.setItem(
        cartKey(),
        JSON.stringify(
          [...cart.items.entries()].map(([id, qty]) => ({ id, qty })),
        ),
      );
    } catch (error) {
      /* приватный режим — корзина живёт до перезагрузки */
    }
  }

  function cartCount() {
    return [...cart.items.values()].reduce((sum, qty) => sum + qty, 0);
  }

  function cartTotal() {
    const prices = new Map(
      (cart.config?.shop?.items || []).map((item) => [
        item.id,
        Number(item.price) || 0,
      ]),
    );
    return [...cart.items.entries()].reduce(
      (sum, [id, qty]) => sum + (prices.get(id) || 0) * qty,
      0,
    );
  }

  function setCartQty(id, qty) {
    const max = Number(cart.config?.shop?.maxItemsPerOrder) || 5;
    const others = cartCount() - (cart.items.get(id) || 0);
    const next = Math.max(0, Math.min(qty, max - others));
    if (next <= 0) cart.items.delete(id);
    else cart.items.set(id, next);
    saveCart();
    renderShop(cart.config, cart.balance);
    renderCart();
  }

  function setCartStatus(message, isError = false) {
    const status = $("#wallet-cart-status");
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("is-error", isError);
  }

  function renderCart() {
    const config = cart.config;
    const container = $("#wallet-cart-items");
    if (!container || !config) return;
    const byId = new Map(
      (config.shop?.items || []).map((item) => [item.id, item]),
    );
    const rows = [...cart.items.entries()].map(([id, qty]) => {
      const item = byId.get(id);
      return `<div class="wallet-cart-row">
        <span>${escapeHtml(item?.title ? t(item.title) : id)}<small>${qty} × ${format(item?.price)}</small></span>
        <strong>${amountWithCoin((Number(item?.price) || 0) * qty)}</strong>
      </div>`;
    });
    container.innerHTML = rows.length
      ? rows.join("")
      : `<p class="wallet-empty">${escapeHtml(t("Пока пусто. Добавь награду из витрины."))}</p>`;
    const total = cartTotal();
    $("#wallet-cart-total").innerHTML = amountWithCoin(total);
    const after = $("#wallet-cart-after");
    const known = cart.balance !== null;
    const remaining = known ? cart.balance - total : null;
    after.innerHTML = known ? amountWithCoin(remaining) : "—";
    after.classList.toggle("is-negative", known && remaining < 0);
    const submit = $("#wallet-cart-submit");
    submit.disabled = cart.busy || !rows.length || !known || remaining < 0;
    if (!rows.length) setCartStatus("");
    else if (!known) setCartStatus(t("Баланс ещё не загружен."));
    else if (remaining < 0)
      setCartStatus(
        t("Не хватает {amount}.", {
          amount: `${format(-remaining)} ${plural(-remaining, config)}`,
        }),
        true,
      );
    else setCartStatus("");
  }

  async function submitCart() {
    if (cart.busy || !cart.items.size) return;
    cart.busy = true;
    renderCart();
    setCartStatus(t("Оформляем заказ…"));
    try {
      const items = [...cart.items.entries()].map(([id, qty]) => ({ id, qty }));
      const result = await window.achievementApi.purchaseWalletItems(items);
      cart.items.clear();
      saveCart();
      cart.balance = Number(result?.balance) || 0;
      const amount = `${format(result?.total)} ${plural(result?.total, cart.config)}`;
      renderShop(cart.config, cart.balance);
      renderCart();
      renderFreezes(firebase.database(), cart.uid);
      setCartStatus(
        result?.status === "done"
          ? t("Готово: списано {amount}, заморозки уже в запасе.", { amount })
          : t("Заказ оформлен: списано {amount}. Ментор получит уведомление.", {
              amount,
            }),
      );
      $("#wallet-balance").textContent = format(cart.balance);
      $("#wallet-balance-unit").textContent = plural(cart.balance, cart.config);
      document.dispatchEvent(
        new CustomEvent("wallet:order-placed", { detail: result }),
      );
    } catch (error) {
      setCartStatus(
        String(error?.message || t("Не удалось оформить заказ.")),
        true,
      );
    } finally {
      cart.busy = false;
      renderCart();
    }
  }

  function renderShop(config, balance) {
    $("#wallet-shop-note").textContent = config.shop?.note
      ? t(config.shop.note)
      : "";
    const items = config.shop?.items || [];
    if (!items.length) {
      $("#wallet-shop").innerHTML =
        `<p class="wallet-empty">${escapeHtml(t("Витрина пока пуста."))}</p>`;
      return;
    }
    $("#wallet-shop").innerHTML = items
      .map((item) => {
        const price = Number(item.price) || 0;
        const known = balance !== null;
        const enough = known && balance >= price;
        const pct =
          known && price > 0
            ? Math.min(100, Math.round((balance / price) * 100))
            : 0;
        const status = !known
          ? ""
          : enough
            ? t("Хватает")
            : t("Накоплено {pct}% · не хватает {amount}", {
                pct,
                amount: `${format(price - balance)} ${plural(price - balance, config)}`,
              });
        const title = t(item.title || "");
        const qty = cart.items.get(item.id) || 0;
        const actions = qty
          ? `<div class="wallet-qty" aria-label="${escapeHtml(t("Количество: {title}", { title }))}">
              <button type="button" data-cart-dec="${escapeHtml(item.id)}" aria-label="${escapeHtml(t("Убрать одну"))}">−</button>
              <span>${qty}</span>
              <button type="button" data-cart-inc="${escapeHtml(item.id)}" aria-label="${escapeHtml(t("Добавить ещё"))}">+</button>
            </div>`
          : `<button type="button" class="wallet-btn${enough ? " wallet-btn--primary" : ""}" data-cart-inc="${escapeHtml(item.id)}">${escapeHtml(t("В корзину"))}</button>`;
        return `<article class="wallet-shop-item${enough ? " is-affordable" : ""}">
          <div class="wallet-shop-item__icon" aria-hidden="true">${escapeHtml(item.icon || "🎁")}</div>
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(item.description ? t(item.description) : "")}</p>
          <div class="wallet-shop-item__price">${coinIcon()}<span>${format(price)}</span></div>
          <div class="wallet-shop-item__progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="${escapeHtml(t("Накоплено на «{title}»", { title }))}"><span style="width:${pct}%"></span></div>
          <div class="wallet-shop-item__status">${status}</div>
          <div class="wallet-shop-item__actions">${actions}</div>
        </article>`;
      })
      .join("");
  }

  function bindCart() {
    const shop = $("#wallet-shop");
    // onAuthStateChanged срабатывает не один раз: без защиты обработчик
    // вешался дважды, «+» давал две штуки, а «−» с единицы удалял позицию.
    if (!shop || shop.dataset.cartBound === "true") return;
    shop.dataset.cartBound = "true";
    shop.addEventListener("click", (event) => {
      const inc = event.target.closest("[data-cart-inc]");
      const dec = event.target.closest("[data-cart-dec]");
      if (inc)
        setCartQty(
          inc.dataset.cartInc,
          (cart.items.get(inc.dataset.cartInc) || 0) + 1,
        );
      else if (dec)
        setCartQty(
          dec.dataset.cartDec,
          (cart.items.get(dec.dataset.cartDec) || 0) - 1,
        );
    });
    $("#wallet-cart-submit")?.addEventListener("click", submitCart);
  }

  // ── Заказы ───────────────────────────────────────────────────────────────

  async function loadOrders(db, uid) {
    const snapshot = await db
      .ref("wallet_orders")
      .orderByChild("uid")
      .equalTo(uid)
      .limitToLast(20)
      .once("value");
    return Object.entries(snapshot.val() || {})
      .map(([id, order]) => ({ id, ...order }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  function renderOrders(orders) {
    const container = $("#wallet-orders");
    if (!container) return;
    if (!orders.length) {
      container.innerHTML = `<p class="wallet-empty">${escapeHtml(t("Заказов пока не было."))}</p>`;
      return;
    }
    const dateFormat = new Intl.DateTimeFormat(locale(), {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Moscow",
    });
    container.innerHTML = orders
      .map((order) => {
        const titles = (order.items || [])
          .map((item) =>
            item.qty > 1
              ? `${t(item.title || "")} × ${item.qty}`
              : t(item.title || ""),
          )
          .join(", ");
        const status = ORDER_STATUS[order.status]
          ? t(ORDER_STATUS[order.status])
          : order.status;
        return `<article class="wallet-order">
          <div><span>${escapeHtml(titles || t("Заказ"))}</span><small>${dateFormat.format(order.createdAt || 0)}</small></div>
          <div class="wallet-order__meta">
            <span class="wallet-status wallet-status--${escapeHtml(order.status || "pending")}">${escapeHtml(status)}</span>
            <span class="wallet-order__total">−${amountWithCoin(order.total)}</span>
          </div>
        </article>`;
      })
      .join("");
  }

  // ── История ──────────────────────────────────────────────────────────────

  function entryLabel(entry) {
    const base = KIND_LABELS[entry.kind]
      ? t(KIND_LABELS[entry.kind])
      : entry.kind;
    if (entry.kind === "question" && entry.count > 1)
      return `${base}: ${format(entry.count)}`;
    if (entry.kind === "reviews")
      return t("{label}: {count} карт.", {
        label: base,
        count: format(entry.count),
      });
    if (entry.kind === "achievement" && entry.count > 1)
      return `${base}: ${format(entry.count)}`;
    if (
      ["spend", "adjust", "purchase", "refund"].includes(entry.kind) &&
      entry.reason
    ) {
      return `${base}: ${entry.reason}`;
    }
    return base;
  }

  function dayTitle(dayKey) {
    if (dayKey === moscowDayKey(Date.now())) return t("Сегодня");
    if (dayKey === moscowDayKey(Date.now() - DAY_MS)) return t("Вчера");
    const [y, m, d] = dayKey.split("-").map(Number);
    return new Intl.DateTimeFormat(locale(), {
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(y, m - 1, d)));
  }

  function renderHistory(entries) {
    const container = $("#wallet-history");
    if (!entries.length) {
      container.innerHTML = `<p class="wallet-empty">${escapeHtml(t("Пока пусто. Отметь вопрос, пройди тест или повтори карточки — первые грады появятся здесь."))}</p>`;
      return;
    }
    const timeFormat = new Intl.DateTimeFormat(locale(), {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Moscow",
    });
    const groups = new Map();
    for (const entry of entries) {
      const key = moscowDayKey(entry.createdAt || 0);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(entry);
    }
    container.innerHTML = [...groups.entries()]
      .map(([day, items]) => {
        const sum = items.reduce(
          (acc, item) => acc + (Number(item.amount) || 0),
          0,
        );
        const rows = items
          .map((entry) => {
            const amount = Number(entry.amount) || 0;
            const mult =
              entry.multiplier && entry.multiplier !== 1
                ? `<span class="wallet-entry__mult">${factorText(entry.multiplier)}</span>`
                : "";
            return `<div class="wallet-entry${amount < 0 ? " is-spend" : ""}">
              <div class="wallet-entry__icon">${icon(entry.kind)}</div>
              <div class="wallet-entry__label"><span>${escapeHtml(entryLabel(entry))}</span><small>${timeFormat.format(entry.createdAt || 0)}${entry.byUid ? ` · ${escapeHtml(t("персонал"))}` : ""}</small></div>
              <div class="wallet-entry__amount">${mult}<strong>${amount < 0 ? "−" : "+"}${amountWithCoin(Math.abs(amount))}</strong></div>
            </div>`;
          })
          .join("");
        return `<section class="wallet-day">
          <div class="wallet-day__head"><span>${escapeHtml(dayTitle(day))}</span><span class="wallet-day__sum">${sum >= 0 ? "+" : "−"}${amountWithCoin(Math.abs(sum))}</span></div>
          ${rows}
        </section>`;
      })
      .join("");
  }

  async function loadHistory(db, uid) {
    const snapshot = await db
      .ref(`wallet_ledger/${uid}`)
      .orderByChild("createdAt")
      .limitToLast(HISTORY_LIMIT)
      .once("value");
    return Object.entries(snapshot.val() || {})
      .map(([id, entry]) => ({ id, ...entry }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  // Те же источники, по которым множитель считает сервер (functions/wallet.js:
  // earningMultiplier): серия из streakState и отметки отчётов в
  // achievement_stats/<uid>/activityDays — компактный узел «день → что было».
  async function loadMultiplierSources(db, uid) {
    const [streakSnap, daysSnap] = await Promise.all([
      db.ref(`users/${uid}/streakState`).once("value"),
      db.ref(`achievement_stats/${uid}/activityDays`).once("value"),
    ]);
    const streak = Number(streakSnap.val()?.current) || 0;
    const activityDays = daysSnap.val() || {};
    const today = Date.now();
    let reportsLast7 = 0;
    for (let offset = 0; offset < 7; offset += 1) {
      if (activityDays[moscowDayKey(today - offset * DAY_MS)]?.report === true)
        reportsLast7 += 1;
    }
    return { streak, reportsLast7 };
  }

  // Запас купленных заморозок серии — свой узел, пишет его только сервер.
  async function renderFreezes(db, uid) {
    try {
      const value = (
        await db.ref(`streak_perks/${uid}/freezes`).once("value")
      ).val();
      $("[data-wallet-freezes]").textContent = format(Number(value) || 0);
    } catch (error) {
      $("[data-wallet-freezes]").textContent = "—";
    }
  }

  // Приведённые ученики — по записям истории вида referral (по одной на
  // каждого): отдельным запросом по индексу kind, а не по последним 50.
  async function renderReferrals(db, uid) {
    const target = $("[data-wallet-referrals]");
    if (!target) return;
    try {
      const snapshot = await db
        .ref(`wallet_ledger/${uid}`)
        .orderByChild("kind")
        .equalTo("referral")
        .once("value");
      const entries = Object.values(snapshot.val() || {});
      target.textContent = format(entries.length);
      referralTotal = entries.reduce(
        (sum, entry) => sum + (Number(entry?.amount) || 0),
        0,
      );
      renderEarned();
    } catch (error) {
      target.textContent = "—";
    }
  }

  async function readSummary(db, uid) {
    try {
      const value = (
        await db.ref(`wallets/${uid}/summary`).once("value")
      ).val();
      // Узла ещё нет — значит, начислений не было: это честный ноль, а не
      // неизвестность.
      return value || { balance: 0, earnedTotal: 0, spentTotal: 0 };
    } catch (error) {
      // Чтение закрыто (нет прав) — страница живёт без баланса.
      return null;
    }
  }

  function showMaterialsOnlyNotice() {
    const notice = $("#wallet-format-notice");
    if (!notice) return;
    for (const element of notice.parentElement.children) {
      if (element !== notice && !element.matches("header"))
        element.hidden = true;
    }
    notice.hidden = false;
  }

  async function init() {
    if (!window.firebase || !window.configLoader) return;
    const firebaseConfig = await window.configLoader.loadFirebaseConfig();
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    firebase.auth().onAuthStateChanged(async (user) => {
      if (!user) return;
      const db = firebase.database();
      // Грады только на менторстве: «только материалы» видит объяснение
      // вместо кошелька, сервер таким и не начисляет.
      const format = (
        await db.ref(`users/${user.uid}/learningFormat`).once("value")
      ).val();
      if (format === "materials") {
        showMaterialsOnlyNotice();
        return;
      }
      let config;
      try {
        config = await loadConfig();
      } catch (error) {
        console.error("Не удалось загрузить конфиг кошелька:", error);
        $("#wallet-history").innerHTML =
          `<p class="wallet-empty">${escapeHtml(t("Не удалось загрузить настройки кошелька. Обновите страницу."))}</p>`;
        return;
      }

      const summary = await readSummary(db, user.uid);
      const balance = summary ? Number(summary.balance) || 0 : null;
      if (summary) renderSummary(summary, config);
      renderFreezes(db, user.uid);
      cart.uid = user.uid;
      cart.config = config;
      cart.balance = balance;
      loadCart();
      renderShop(config, balance);
      renderCart();
      bindCart();

      const refreshOrders = () =>
        loadOrders(db, user.uid)
          .then(renderOrders)
          .catch((error) => {
            console.warn("Заказы недоступны:", error);
            $("#wallet-orders").innerHTML =
              `<p class="wallet-empty">${escapeHtml(t("Заказы недоступны. Попробуйте позже."))}</p>`;
          });
      refreshOrders();
      document.addEventListener("wallet:order-placed", async () => {
        refreshOrders();
        try {
          renderHistory(await loadHistory(db, user.uid));
          renderReferrals(db, user.uid);
        } catch (error) {
          /* история перерисуется при следующем открытии */
        }
      });

      let sources = { streak: 0, reportsLast7: 0 };
      try {
        sources = await loadMultiplierSources(db, user.uid);
      } catch (error) {
        console.warn("Множитель показан по умолчанию:", error);
      }
      const regularity = config.multipliers?.reportRegularity || {};
      const bonus =
        sources.reportsLast7 >= Number(regularity.minReportsIn7Days || Infinity)
          ? Number(regularity.bonus) || 0
          : 0;
      const multiplier = currentFactor(sources.streak, config) + bonus;
      renderMultiplier(config, sources.streak, sources.reportsLast7);
      renderCurve(config, sources.streak);
      renderRates(config, multiplier);

      try {
        renderHistory(await loadHistory(db, user.uid));
        renderReferrals(db, user.uid);
      } catch (error) {
        console.error("Не удалось загрузить историю кошелька:", error);
        $("#wallet-history").innerHTML =
          `<p class="wallet-empty">${escapeHtml(t("История недоступна. Попробуйте позже."))}</p>`;
      }

      // Бэкфилл за прошлую активность — той же ручкой, что и достижения.
      // Сервер дедуплицирует по requestId, повторный вызов стоит одно чтение.
      window.achievementApi
        ?.reconcileAchievements?.()
        .then(async (result) => {
          if (!(Number(result?.wallet?.credited) > 0)) return;
          window.walletUi?.showCredit(result.wallet);
          const fresh = await readSummary(db, user.uid);
          if (fresh) {
            renderSummary(fresh, config);
            cart.balance = Number(fresh.balance) || 0;
            renderShop(config, cart.balance);
            renderCart();
          }
          renderHistory(await loadHistory(db, user.uid));
          renderReferrals(db, user.uid);
        })
        .catch((error) => console.warn("Бэкфилл кошелька пропущен:", error));
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.walletPage = { entryLabel, KIND_LABELS, currentFactor };
})();
