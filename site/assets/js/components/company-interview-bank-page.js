(function () {
  const PAGE_SIZE = 15;
  // Группы компаний по числу вопросов: компания попадает в первую, чей min
  // она набирает. ponytail: пороги подобраны на глаз, без боевого распределения.
  const COMPANY_TIERS = [
    { key: "many", min: 20, title: "Много вопросов", range: "20+" },
    { key: "some", min: 5, title: "Средне", range: "5–19" },
    { key: "few", min: 1, title: "Мало", range: "1–4" },
  ];
  let bank = {};
  let bankLoaded = false;
  let database = null;
  let visibleQuestionsCount = PAGE_SIZE;
  let selectedCompanyId = "all";
  const detailsCache = new Map();
  // render() пересобирает сетку на каждый ввод в поиск вопросов, поэтому
  // свёрнутость групп живёт здесь, а не в DOM.
  const collapsedTiers = new Set();

  const $ = (selector) => document.querySelector(selector);
  // Иконки тем — те же, что у карточек разделов материалов.
  const TOPIC_ICONS = {
    topic_python: "python.svg",
    topic_math: "math.svg",
    topic_classic_ml: "classicml.png",
    topic_dl: "dl.png",
    topic_nlp_base: "book.svg",
    topic_nlp_advanced: "rocket.svg",
    topic_nlp_optimization: "rocket.svg",
    topic_agents: "nlp-agents.png",
    topic_rag: "nlp.svg",
    topic_ml_system_design: "architecture.svg",
    topic_legend: "form.svg",
  };
  // Та же страница обслуживает «Вопросы с мок-собеседований»: вместо компании —
  // тема мока, данные — во втором экземпляре банка (mockQuestion*).
  const isMock = () => document.body?.dataset.questionBank === "mock";
  const bankPaths = () =>
    isMock()
      ? {
          root: window.InterviewQuestionBank.MOCK_ROOT_PATH,
          index: window.InterviewQuestionBank.MOCK_INDEX_PATH,
        }
      : {
          root: window.InterviewQuestionBank.ROOT_PATH,
          index: window.InterviewQuestionBank.INDEX_PATH,
        };

  function setState(title, message) {
    const list = $("#companyBankList");
    list.replaceChildren();
    const state = document.createElement("section");
    state.className = "company-bank-state";
    const heading = document.createElement("h2");
    heading.textContent = title;
    const text = document.createElement("p");
    text.textContent = message;
    state.append(heading, text);
    list.append(state);
    syncPagination(0, 0);
  }

  function appendInlineMarkdown(target, value) {
    const text = String(value || "");
    const tokenPattern = /(\*\*[^*]+\*\*|`[^`]+`)/g;
    let lastIndex = 0;
    for (const match of text.matchAll(tokenPattern)) {
      target.append(
        document.createTextNode(text.slice(lastIndex, match.index)),
      );
      const isBold = match[0].startsWith("**");
      const element = document.createElement(isBold ? "strong" : "code");
      element.textContent = match[0].slice(isBold ? 2 : 1, isBold ? -2 : -1);
      target.append(element);
      lastIndex = match.index + match[0].length;
    }
    target.append(document.createTextNode(text.slice(lastIndex)));
  }

  function appendList(target, items) {
    const rootList = document.createElement("ul");
    const stack = [{ indent: 0, list: rootList }];
    items.forEach(({ indent, text }) => {
      while (stack.length > 1 && indent < stack.at(-1).indent) stack.pop();
      if (indent > stack.at(-1).indent) {
        const parentItem = stack.at(-1).list.lastElementChild;
        if (parentItem) {
          const nestedList = document.createElement("ul");
          parentItem.append(nestedList);
          stack.push({ indent, list: nestedList });
        }
      }
      const item = document.createElement("li");
      appendInlineMarkdown(item, text);
      stack.at(-1).list.append(item);
    });
    target.append(rootList);
  }

  function appendMarkdownBlocks(target, markdown) {
    const lines = String(markdown || "")
      .replace(/\r\n/g, "\n")
      .split("\n");
    const calloutLabels = { tip: "Совет", note: "Заметка", warning: "Важно" };
    let index = 0;

    function appendParagraph(linesToRender, parent) {
      const text = linesToRender.join("\n").trim();
      if (!text) return;
      const paragraph = document.createElement("p");
      appendInlineMarkdown(paragraph, text);
      parent.append(paragraph);
    }

    while (index < lines.length) {
      if (!lines[index].trim() || /^---+\s*$/.test(lines[index])) {
        index += 1;
        continue;
      }

      const fenceStart = lines[index].match(/^\s*```(\w*)\s*$/);
      if (fenceStart) {
        index += 1;
        const codeLines = [];
        while (index < lines.length && !/^\s*```\s*$/.test(lines[index])) {
          codeLines.push(lines[index]);
          index += 1;
        }
        index += 1;
        const pre = document.createElement("pre");
        const code = document.createElement("code");
        if (fenceStart[1]) code.className = `language-${fenceStart[1]}`;
        code.textContent = codeLines.join("\n");
        pre.append(code);
        target.append(pre);
        continue;
      }

      const calloutStart = lines[index].match(/^>\s*\[!(\w+)\]\s*(.*)$/i);
      if (calloutStart) {
        const type = calloutStart[1].toLowerCase();
        const calloutLines = calloutStart[2] ? [calloutStart[2]] : [];
        index += 1;
        while (index < lines.length && /^> ?/.test(lines[index])) {
          calloutLines.push(lines[index].replace(/^> ?/, ""));
          index += 1;
        }
        const callout = document.createElement("aside");
        callout.className = `company-bank-callout company-bank-callout--${type}`;
        const label = document.createElement("strong");
        label.className = "company-bank-callout-label";
        label.textContent = calloutLabels[type] || "Комментарий";
        const content = document.createElement("div");
        content.className = "company-bank-rich-text";
        appendMarkdownBlocks(content, calloutLines.join("\n"));
        callout.append(label, content);
        target.append(callout);
        continue;
      }

      const listStart = lines[index].match(/^(\s*)[-*+]\s+(.+)$/);
      if (listStart) {
        const items = [];
        while (index < lines.length) {
          const item = lines[index].match(/^(\s*)[-*+]\s+(.+)$/);
          if (!item) break;
          items.push({
            indent: item[1].replace(/\t/g, "  ").length,
            text: item[2],
          });
          index += 1;
        }
        appendList(target, items);
        continue;
      }

      const paragraphLines = [];
      while (
        index < lines.length &&
        lines[index].trim() &&
        !/^>\s*\[!\w+\]/i.test(lines[index]) &&
        !/^(\s*)[-*+]\s+/.test(lines[index]) &&
        !/^\s*```/.test(lines[index]) &&
        !/^---+\s*$/.test(lines[index])
      ) {
        paragraphLines.push(lines[index]);
        index += 1;
      }
      appendParagraph(paragraphLines, target);
    }
  }

  function renderRichText(markdown) {
    const content = document.createElement("div");
    content.className = "company-bank-rich-text";
    appendMarkdownBlocks(content, markdown);
    return content;
  }

  function renderMath(container) {
    if (typeof window.renderMathInElement !== "function") return;
    // «$390,000 to $430,000» — валюта, а не формула (math-dollars.js).
    window.mathDollars?.protect(container);
    window.renderMathInElement(container, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false },
        { left: "\\(", right: "\\)", display: false },
        { left: "\\[", right: "\\]", display: true },
      ],
      ignoredClasses: window.mathDollars?.ignoredClasses || [],
      throwOnError: false,
    });
  }

  function buildQuestionCard(item) {
    const card = document.createElement("article");
    card.className = `company-bank-question company-bank-question--${item.kind}`;
    const header = document.createElement("div");
    header.className = "company-bank-question-header";
    const question = document.createElement("h2");
    // Старые фидбэки писали вопрос жирным: «### **Вопрос?**».
    question.textContent = String(item.question).replace(
      /^\*\*(.+)\*\*$/,
      "$1",
    );
    const type = document.createElement("span");
    type.className = "company-bank-question-type";
    type.textContent = item.kind === "hr" ? "HR" : "Технический";
    const labels = document.createElement("div");
    labels.className = "company-bank-question-labels";
    labels.append(type);
    // У мока с несколькими темами — по чипу на тему, чтобы подписи переносились.
    const groupNames = item.companyName
      ? isMock()
        ? item.companyName.split(" · ")
        : [item.companyName]
      : [];
    groupNames.forEach((name) => {
      const company = document.createElement("span");
      company.className = "company-bank-question-company";
      company.textContent = name;
      labels.append(company);
    });
    if (item.domain) {
      const domain = document.createElement("span");
      domain.className =
        "company-bank-question-company company-bank-question-domain";
      domain.textContent = domainName(item.domain);
      labels.append(domain);
    }
    header.append(question, labels);
    card.append(header);

    const content = document.createElement("details");
    content.className = "company-bank-question-content";
    const summary = document.createElement("summary");
    summary.textContent = "Открыть ответ и разбор";
    content.append(summary);
    content.addEventListener("toggle", async () => {
      if (!content.open || content.dataset.loaded || content.dataset.loading)
        return;
      content.dataset.loading = "true";
      const loading = document.createElement("p");
      loading.textContent = "Загружаем разбор…";
      content.append(loading);
      try {
        const cacheKey = `${item.companyId}/${item.questionId}`;
        let question = detailsCache.get(cacheKey);
        if (!question) {
          const snapshot = await database
            .ref(
              `${bankPaths().root}/companies/${item.companyId}/questions/${item.questionId}`,
            )
            .once("value");
          question = snapshot.val() || {};
          detailsCache.set(cacheKey, question);
        }
        const latest =
          Object.values(question.sources || {}).sort(
            (a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0),
          )[0] || {};
        loading.remove();
        if (latest.studentAnswer) {
          const answer = document.createElement("section");
          answer.className = "company-bank-answer";
          const label = document.createElement("span");
          label.className = "company-bank-answer-label";
          label.textContent = "Ответ кандидата";
          answer.append(label, renderRichText(latest.studentAnswer));
          content.append(answer);
        }
        if (latest.review) {
          const review = document.createElement("section");
          review.className = "company-bank-review";
          const label = document.createElement("span");
          label.className = "company-bank-review-label";
          label.textContent = "Разбор и рекомендуемый ответ";
          review.append(label, renderRichText(latest.review));
          content.append(review);
        }
        if (!latest.studentAnswer && !latest.review) {
          const empty = document.createElement("p");
          empty.textContent = "Для этого вопроса пока нет разбора.";
          content.append(empty);
        }
        content.dataset.loaded = "true";
        renderMath(content);
      } catch (error) {
        loading.textContent =
          "Не удалось загрузить разбор. Попробуйте ещё раз.";
        console.error("Failed to load interview question details:", error);
      } finally {
        delete content.dataset.loading;
      }
    });
    card.append(content);

    /* The legacy shape can still be passed by tests or cached pages. */
    if (item.studentAnswer || item.review) {
      content.dataset.loaded = "true";
      content.replaceChildren(summary);

      if (item.studentAnswer) {
        const answer = document.createElement("section");
        answer.className = "company-bank-answer";
        const label = document.createElement("span");
        label.className = "company-bank-answer-label";
        label.textContent = "Ответ кандидата";
        answer.append(label, renderRichText(item.studentAnswer));
        content.append(answer);
      }

      if (item.review) {
        const review = document.createElement("section");
        review.className = "company-bank-review";
        const label = document.createElement("span");
        label.className = "company-bank-review-label";
        label.textContent = "Разбор и рекомендуемый ответ";
        review.append(label, renderRichText(item.review));
        content.append(review);
      }

      renderMath(content);
    }
    return card;
  }

  function syncPagination(visibleCount, totalCount) {
    const pagination = $("#companyBankPagination");
    const summary = $("#companyBankPaginationSummary");
    const button = $("#companyBankShowMore");
    const hasMore = visibleCount < totalCount;
    pagination.hidden = !totalCount;
    summary.textContent = totalCount
      ? `Показано ${visibleCount} из ${totalCount}`
      : "";
    button.hidden = !hasMore;
    button.textContent = `Показать ещё ${Math.min(PAGE_SIZE, totalCount - visibleCount)}`;
  }

  function getCompanyInitials(name) {
    return String(name || "")
      .replace(/[^\p{L}\p{N}\s-]/gu, " ")
      .trim()
      .split(/[\s-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  function getCompanyLogoPath(name) {
    return window.companyLogos?.url(name) || "";
  }

  function createCompanyButton(company) {
    const button = document.createElement("button");
    const isAllCompanies = company.id === "all";
    button.type = "button";
    button.className = "company-bank-company";
    button.classList.toggle("is-selected", company.id === selectedCompanyId);
    button.setAttribute(
      "aria-pressed",
      String(company.id === selectedCompanyId),
    );

    const logo = document.createElement("span");
    logo.className = "company-bank-company-logo";
    const fallback = document.createElement("span");
    fallback.className = "company-bank-company-monogram";
    fallback.textContent = isAllCompanies
      ? "ВСЕ"
      : getCompanyInitials(company.name);
    logo.append(fallback);

    const logoPath = isMock()
      ? TOPIC_ICONS[company.id]
        ? `/assets/icons/${TOPIC_ICONS[company.id]}`
        : ""
      : getCompanyLogoPath(company.name);
    if (logoPath) {
      const image = document.createElement("img");
      image.alt = "";
      image.decoding = "async";
      image.onload = () => logo.classList.add("has-logo");
      image.onerror = () => image.remove();
      image.src = logoPath;
      logo.append(image);
    }

    const label = document.createElement("span");
    label.className = "company-bank-company-name";
    label.textContent = company.name;
    const count = document.createElement("span");
    count.className = "company-bank-company-count";
    count.textContent = String(company.questionCount || 0);
    button.append(logo, label, count);
    button.addEventListener("click", () => {
      selectedCompanyId = company.id;
      resetQuestionLimitAndRender();
    });
    return button;
  }

  function syncCompanyGrid(companies) {
    if (
      selectedCompanyId !== "all" &&
      !companies.some((company) => company.id === selectedCompanyId)
    ) {
      selectedCompanyId = "all";
    }
    const query = $("#companySearch")?.value || "";
    if (isMock()) {
      // Тем десяток и порядок у них учебный, поэтому без групп по числу вопросов.
      const order = window.InterviewQuestionBank.MOCK_TOPICS.map(
        (topic) => `topic_${topic.id}`,
      );
      const grid = document.createElement("div");
      grid.className =
        "company-bank-company-grid company-bank-company-grid--topics";
      grid.append(
        createCompanyButton({
          id: "all",
          name: "Все темы",
          questionCount: dedupeMockQuestions(
            window.InterviewQuestionBank.listAllQuestions(bank),
          ).length,
        }),
        ...[...companies]
          .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
          .map(createCompanyButton),
      );
      $("#companyBankCompanyGrid").replaceChildren(grid);
      return selectedCompanyId;
    }
    const groups = groupCompaniesByCount(companies, query);
    const total = companies.reduce((sum, c) => sum + c.questionCount, 0);
    const nodes = [
      createCompanyButton({
        id: "all",
        name: "Все компании",
        questionCount: total,
      }),
    ];
    groups.forEach(({ tier, companies: tierCompanies }) => {
      const group = document.createElement("details");
      group.className = "company-bank-company-group";
      // Во время поиска компании группы раскрыты: иначе совпадение прячется.
      group.open = Boolean(query.trim()) || !collapsedTiers.has(tier.key);
      const summary = document.createElement("summary");
      summary.textContent = `${tier.title} (${tier.range}) · компаний: ${tierCompanies.length}`;
      const grid = document.createElement("div");
      grid.className = "company-bank-company-grid";
      grid.append(...tierCompanies.map(createCompanyButton));
      group.append(summary, grid);
      group.addEventListener("toggle", () => {
        if (query.trim()) return;
        if (group.open) collapsedTiers.delete(tier.key);
        else collapsedTiers.add(tier.key);
      });
      nodes.push(group);
    });
    if (!groups.length && query.trim()) {
      const empty = document.createElement("p");
      empty.className = "company-bank-company-empty";
      empty.textContent = "Компания не найдена";
      nodes.push(empty);
    }
    $("#companyBankCompanyGrid").replaceChildren(...nodes);
    return selectedCompanyId;
  }

  /**
   * У мока бывает несколько тем, и в «Все темы» один вопрос пришёл бы по разу
   * из каждой. Оставляем первую карточку, а темы собираем в одну подпись.
   * ponytail: разбор и частота берутся из первой темы; если один вопрос задавали
   * на разных моках с разными темами, свежий разбор виден только внутри темы.
   */
  function dedupeMockQuestions(questions) {
    const byId = new Map();
    questions.forEach((question) => {
      const seen = byId.get(question.questionId);
      if (!seen) byId.set(question.questionId, { ...question });
      else seen.companyName = `${seen.companyName} · ${question.companyName}`;
    });
    return [...byId.values()];
  }

  function groupCompaniesByCount(companies, query) {
    const needle = String(query || "")
      .trim()
      .toLocaleLowerCase("ru");
    const groups = COMPANY_TIERS.map((tier) => ({ tier, companies: [] }));
    companies.forEach((company) => {
      if (needle && !company.name.toLocaleLowerCase("ru").includes(needle))
        return;
      const group = groups.find(
        ({ tier }) => company.questionCount >= tier.min,
      );
      if (group) group.companies.push(company);
    });
    groups.forEach(({ companies: list }) =>
      list.sort(
        (a, b) =>
          b.questionCount - a.questionCount ||
          a.name.localeCompare(b.name, "ru"),
      ),
    );
    return groups.filter(({ companies: list }) => list.length);
  }

  /**
   * Вопросы уже отсортированы по типу (технические, затем HR), поэтому группы
   * размечаются заголовком перед первой карточкой каждого типа. Заголовков нет,
   * когда тип один: фильтр и так сказал, какой.
   *
   * Набор типов берётся по всему отфильтрованному списку, а не по видимому
   * срезу: иначе на первой странице из одних технических заголовков не было бы,
   * и они выскакивали бы после «Показать ещё».
   */
  function buildGroupedCards(items, allItems) {
    const kinds = new Set((allItems || items).map((item) => item.kind));
    const nodes = [];
    let currentKind = null;
    items.forEach((item) => {
      if (kinds.size > 1 && item.kind !== currentKind) {
        currentKind = item.kind;
        const heading = document.createElement("h2");
        heading.className = "company-bank-group-heading";
        heading.textContent =
          item.kind === "hr" ? "HR / рекрутерские" : "Технические";
        nodes.push(heading);
      }
      nodes.push(buildQuestionCard(item));
    });
    return nodes;
  }

  // Ментор грузит логотип выбранной компании прямо отсюда (не в мок-режиме:
  // там темы, а не компании).
  function syncLogoUpload(company) {
    const control = $("#companyLogoUpload");
    if (!control) return;
    const show = Boolean(
      company && !isMock() && window.companyLogos?.canUpload,
    );
    control.hidden = !show;
    if (!show) return;
    control.dataset.company = company.name;
    $("#companyLogoUploadLabel").textContent = getCompanyLogoPath(company.name)
      ? `Заменить логотип «${company.name}»`
      : `Загрузить логотип «${company.name}»`;
  }

  async function uploadLogo(event) {
    const input = event.target;
    const file = input.files?.[0];
    const company = $("#companyLogoUpload").dataset.company;
    input.value = "";
    if (!file || !company) return;
    const status = $("#companyLogoStatus");
    status.textContent = "Загружаем логотип…";
    try {
      await window.companyLogos.upload(company, file);
      status.textContent = `Логотип «${company}» сохранён.`;
      render();
    } catch (error) {
      status.textContent = error?.message || "Не удалось загрузить логотип.";
    }
  }

  const domainName = (id) =>
    window.InterviewQuestionBank.DOMAINS.find((domain) => domain.id === id)
      ?.name || "";

  // Область вопроса настоящего собеса (Python, Математика, …) считается по
  // тексту вопроса; у HR-вопросов области нет. Варианты списка — только
  // области, что есть среди вопросов, с их числом.
  function filterByDomain(questions) {
    // Фильтр есть только на странице компаний: у мока темы и так разложены.
    const select = $("#questionDomainFilter");
    if (!select || isMock()) return questions;
    const api = window.InterviewQuestionBank;
    const withDomains = questions.map((question) => ({
      ...question,
      domain:
        question.kind === "hr" ? "" : api.questionDomain(question.question),
    }));
    const counts = new Map();
    withDomains.forEach(({ domain }) => {
      if (domain) counts.set(domain, (counts.get(domain) || 0) + 1);
    });
    const current = select.value;
    select.replaceChildren(
      new Option("Все области", "all"),
      ...api.DOMAINS.filter((domain) => counts.has(domain.id)).map(
        (domain) =>
          new Option(`${domain.name} (${counts.get(domain.id)})`, domain.id),
      ),
    );
    select.value = counts.has(current) ? current : "all";
    return select.value === "all"
      ? withDomains
      : withDomains.filter((question) => question.domain === select.value);
  }

  function render() {
    const api = window.InterviewQuestionBank;
    const companies = api.listCompanies(bank);
    const companyId = syncCompanyGrid(companies);
    const company = (bank.companies || {})[companyId];
    syncLogoUpload(company);
    const search = $("#questionSearch").value;
    const kind = $("#questionTypeFilter").value;
    const listAll = (query, type) =>
      isMock()
        ? dedupeMockQuestions(api.listAllQuestions(bank, query, type))
        : api.listAllQuestions(bank, query, type);
    const allTechnical = listAll("", "technical").length;
    const allHr = listAll("", "hr").length;
    $("#allQuestionsCount").textContent = allTechnical + allHr;
    $("#technicalQuestionsCount").textContent = allTechnical;
    $("#hrQuestionsCount").textContent = allHr;

    if (companyId !== "all" && !company) {
      $("#companyBankSummary").textContent = "";
      setState(
        "Банк пока пуст",
        isMock()
          ? "Отметьте темы в фидбеке мок-собеседования."
          : "Добавьте компанию и вопросы в фидбек реального собеседования.",
      );
      return;
    }
    const allQuestions =
      companyId === "all"
        ? listAll(search, kind)
        : api.listQuestions(company, search, kind).map((question) => ({
            ...question,
            companyId,
            companyName: company.name,
          }));
    const questions = filterByDomain(allQuestions);
    const allLabel = isMock() ? "Все темы" : "Все компании";
    const companyLabel = companyId === "all" ? allLabel : company.name;
    $("#companyBankSummary").textContent =
      `${companyLabel}: ${questions.length} ${questions.length === 1 ? "вопрос" : "вопросов"}`;
    if (!questions.length) {
      setState(
        search
          ? "Ничего не найдено"
          : isMock()
            ? "По этой теме пока нет вопросов"
            : "По этой компании пока нет вопросов",
        search
          ? "Попробуйте изменить запрос."
          : "Вопросы появятся после сохранения размеченного фидбека.",
      );
      return;
    }
    const list = $("#companyBankList");
    const visibleQuestions = questions.slice(0, visibleQuestionsCount);
    list.replaceChildren(...buildGroupedCards(visibleQuestions, questions));
    syncPagination(visibleQuestions.length, questions.length);
    renderMath(list);
  }

  function resetQuestionLimitAndRender() {
    visibleQuestionsCount = PAGE_SIZE;
    render();
  }

  async function initialize() {
    try {
      await window.authReady;
      if (!firebase.apps.length) {
        firebase.initializeApp(await window.configLoader.loadFirebaseConfig());
      }
      database = firebase.database();
      const typeFilter = $("#questionTypeFilter");
      const searchInput = $("#questionSearch");
      const showMoreButton = $("#companyBankShowMore");
      if (!typeFilter || !searchInput || !showMoreButton) {
        throw new Error("Не найдены элементы управления банка вопросов.");
      }
      const loadIndex = async () => {
        const refresh = $("#companyBankRefresh");
        if (refresh) refresh.disabled = true;
        try {
          const snapshot = await database.ref(bankPaths().index).once("value");
          bank = window.InterviewQuestionBank.indexToBank(snapshot.val() || {});
          bankLoaded = true;
          resetQuestionLimitAndRender();
        } catch (error) {
          console.error("Failed to load company interview index:", error);
          setState(
            "Не удалось загрузить банк",
            "Проверьте подключение и обновите страницу.",
          );
        } finally {
          if (refresh) refresh.disabled = false;
        }
      };
      typeFilter.addEventListener("change", resetQuestionLimitAndRender);
      $("#questionDomainFilter")?.addEventListener(
        "change",
        resetQuestionLimitAndRender,
      );
      searchInput.addEventListener("input", resetQuestionLimitAndRender);
      showMoreButton.addEventListener("click", () => {
        visibleQuestionsCount += PAGE_SIZE;
        render();
      });
      $("#companyBankRefresh")?.addEventListener("click", loadIndex);
      $("#companyLogoFile")?.addEventListener("change", uploadLogo);
      // Загруженные логотипы приходят callable'ом — сетку перерисуем, когда
      // доедут; до тех пор видны встроенные.
      window.companyLogos?.load().then(() => bankLoaded && render());
      $("#companySearch")?.addEventListener("input", () =>
        syncCompanyGrid(window.InterviewQuestionBank.listCompanies(bank)),
      );
      await loadIndex();
    } catch (error) {
      console.error("Failed to initialize company interview bank:", error);
      setState(
        "Не удалось открыть банк",
        "Войдите в аккаунт и попробуйте ещё раз.",
      );
    }
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      appendMarkdownBlocks,
      appendInlineMarkdown,
      dedupeMockQuestions,
      groupCompaniesByCount,
    };
  }

  document.addEventListener("DOMContentLoaded", () => {
    setState(
      "Загружаем вопросы…",
      isMock()
        ? "Собираем вопросы с мок-собеседований."
        : "Собираем актуальные вопросы с реальных собеседований.",
    );
    initialize();
  });
})();
