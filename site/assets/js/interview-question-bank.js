/*
 * Derived, anonymous question bank for real interviews.
 *
 * Feedback remains the source of truth. This module only prepares the small
 * public projection stored at /interviewQuestionBank, so the catalogue never
 * needs to read users' feedbacks.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.InterviewQuestionBank = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  const ROOT_PATH = "interviewQuestionBank";
  const INDEX_PATH = "interviewQuestionIndex";
  // Мок-собеседования живут во втором экземпляре того же банка: вместо
  // компании — тема мока, у мока их может быть несколько.
  const MOCK_ROOT_PATH = "mockQuestionBank";
  const MOCK_INDEX_PATH = "mockQuestionIndex";
  const MOCK_TOPICS = [
    { id: "python", name: "Python" },
    { id: "math", name: "Математика" },
    { id: "classic_ml", name: "Classic ML" },
    { id: "dl", name: "DL" },
    { id: "nlp_base", name: "NLP базовый" },
    { id: "nlp_advanced", name: "NLP продвинутый" },
    { id: "nlp_optimization", name: "NLP оптимизация" },
    { id: "agents", name: "Агенты" },
    { id: "rag", name: "RAG" },
    { id: "ml_system_design", name: "ML System Design" },
    { id: "legend", name: "Легенда" },
  ];

  function normalizeText(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLocaleLowerCase("ru-RU")
      .replace(/[.?!…]+$/g, "");
  }

  function cleanQuestion(value) {
    return String(value || "")
      .replace(/^#+\s*/, "")
      .replace(/\s+#+$/, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function hash(value) {
    // Stable, Firebase-safe FNV-1a hash. It is an opaque identifier, not data.
    let result = 2166136261;
    const input = String(value || "");
    for (let index = 0; index < input.length; index += 1) {
      result ^= input.charCodeAt(index);
      result = Math.imul(result, 16777619);
    }
    return (result >>> 0).toString(36);
  }

  function getCompanyMeta(value) {
    const name = String(value || "")
      .replace(/\s+/g, " ")
      .trim();
    const normalizedName = normalizeText(name);
    if (!name || !normalizedName) return null;
    return { id: `company_${hash(normalizedName)}`, name, normalizedName };
  }

  function getFeedbackCompany(feedback) {
    if (!feedback || feedback.isRealInterview !== true) return null;
    const meta = getCompanyMeta(feedback.companyName);
    if (!meta) return null;
    return {
      ...meta,
      id: String(feedback.companyId || meta.id),
    };
  }

  /** Известные ключи тем мока в порядке MOCK_TOPICS, без дублей. */
  function getMockTopics(feedback) {
    if (!feedback || feedback.isRealInterview === true) return [];
    const raw = feedback.mockTopics;
    const keys = new Set(Array.isArray(raw) ? raw : Object.values(raw || {}));
    return MOCK_TOPICS.filter((topic) => keys.has(topic.id));
  }

  // Тема отдельного вопроса мока. Темы ставятся на весь мок, а мок бывает
  // сразу «Python + Math + Classic ML + DL» — без разбора по вопросу attention
  // попадал в Python. Порядок — приоритет: побеждает первое совпадение, поэтому
  // узкие темы стоят выше общих (attention в мок «DL + NLP» уйдёт в NLP,
  // в мок «Classic ML + DL» — в DL).
  const TOPIC_RULES = [
    [
      "legend",
      /о себе|резюме|опыт(?![а-яё])|ушёл|ушел|пришёл|пришел|совмещал|чем занимал|что делал/,
    ],
    [
      "rag",
      /\brag\b|retriev|ретрив|chunk|чанк|vector db|vector database|векторн[а-яёa-z]* (?:баз|бд)|indexing|индексац|hybrid search|bm25|rerank|реранк|embedding model/,
    ],
    [
      "agents",
      /агент|\bagents?\b|prompt injection|инструмент|\bintent\b|internet|долгосрочн[а-яёa-z]* памят|краткосрочн[а-яёa-z]* памят|memory|function calling|\btools?\b|skills|\bmcp\b|react/,
    ],
    [
      "ml_system_design",
      /тариф|персонализ|кэширован|pdf|docx|system design|архитектур/,
    ],
    [
      "nlp_optimization",
      /inference|инференс|quantiz|квантиз|квантов|distill|дистилл|kv.?cache|speculative|batching|\brps\b|ускор|оптимизац[а-яёa-z]* (?:llm|инференс)|vllm|flash.?attention|merge lora/,
    ],
    [
      "nlp_advanced",
      /lora|peft|адаптер|adapter|fine-?tun|файнтюн|rlhf|\bdpo\b|alignment|llm с нуля|обучать llm|обучают llm|exposure bias|as-a-judge|не влезает|памят[а-яёa-z]* gpu|\boom\b|заморажива/,
    ],
    [
      "nlp_base",
      /attention|внимани|трансформер|transformer|positional (?:enc|emb)|позиционн|\brope\b|alibi|bert|\bgpt|llama|encoder|decoder|энкодер|декодер|эмбеддинг|embedding|word2vec|fasttext|tf-idf|one-hot|\bbpe\b|wordpiece|unigram|токен|лемматиз|стемминг|(?<!кон)текст|softmax|perplexity|rouge|bleu|генерац|sampling|multi-head|\brnn\b|близост[а-яёa-z]* вектор|отзыв|тональност|\bllm\b|языков[а-яёa-z]* модел/,
    ],
    [
      "dl",
      /attention|внимани|трансформер|transformer|positional (?:enc|emb)|позиционн|convolution|pooling|пулинг|аппроксимац|нейрон|нейросет|neural|backprop|обратн[а-яёa-z]* распростран|backward|forward pass|активац|relu|dropout|batch.?norm|layer.?norm|нормализ|adam|momentum|rmsprop|\bsgd\b|mini-batch|оптимизатор|learning rate|warmup|scheduler|early stopping|инициализ|xavier|kaiming|затухан|взрыв[а-яёa-z]* градиент|vanishing|exploding|свёрт|сверт|\bcnn\b|\brnn\b|lstm|рекуррент|skip.?connection|residual|densenet|resnet|transfer learning/,
    ],
    [
      "classic_ml",
      /регресс|regression|классификац|classification|дерев|\btrees?\b|random forest|бэггинг|bagging|bootstrap|бустинг|boosting|переобуч|недообуч|overfit|bias|variance|регуляриз|\bl[12]\b|precision|recall|accuracy|\broc\b|roc-auc|\bauc\b|\bf1\b|confusion|метрик|функци[а-яёa-z]* потерь|\bloss\b|\bmse\b|\bmae\b|log.?loss|cross.?entropy|\btrain\b|validation|валидац|k-?fold|признак|масштабирован|кластериз|kmeans|dbscan|\bpca\b|размерност|с учителем|машинн[а-яёa-z]* обучени|порог|сигмоид|градиентн[а-яёa-z]* спуск|gradient descent|дисбаланс|ансамбл|\bknn\b|\bsvm\b|гиперпараметр/,
    ],
    [
      "math",
      /математическ|ожидани|ожидаем|дисперси|медиан|(?<![а-яё])мод[аыуе](?![а-яё])|\bmode\b|\bmedian\b|средн[а-яёa-z]*|p-value|значимост|рода(?![а-яё])|гипотез|распределени|distribution|вероятност|кубик|монет|случайн[а-яёa-z]* величин|градиент|gradient|производн|матриц|вектор|собственн[а-яёa-z]* знач|ковариац|корреляц|интеграл|скош|skewed/,
    ],
    [
      "python",
      /python|питон|\bgil\b|декоратор|генератор|итератор|yield|comprehension|\blist\b|\bdict\b|\btuple\b|`set`|`is`|`none`|кортеж|словар|списк|список|изменяем|mutable|хэш|хеш|коллизи|поток|процесс|многопоточ|multiprocessing|multithreading|асинхрон|async|pydantic|dunder|numpy|append|extend|палиндром|бинарн[а-яёa-z]* поиск|отсортированн|массив|anagram|профилирован|ооп|полиморфизм|наследован|инкапсуляц|исключени|(?<!\\)lambda(?![,$])|лямбда-|staticmethod|classmethod|@property|контекстн[а-яёa-z]* менеджер|`with`|kwargs|аргумент|arguments|импорт|\bimport|f-string|walrus|метакласс|deepcopy|копировани|enumerate|\bzip\b|`map`|`filter`|type hints?|аннотаци[а-яёa-z]* тип|dataclass|виртуальн[а-яёa-z]* окружени|сборк[а-яёa-z]* мусора|утечк[а-яёa-z]* памят|big o/,
    ],
  ];

  /**
   * Темы мока, в которые идёт вопрос: первое правило среди тем мока, иначе —
   * среди остальных тем (градиент из мока «Python + Classic ML» — это Math).
   * Не узнали вопрос — все темы мока. У мока с легендой чужие темы не ищем:
   * вопросы по проектам ученика не разбрасываем по ML-разделам.
   */
  function questionTopics(question, topics) {
    if (topics.length <= 1) return topics;
    const text = normalizeText(question);
    const ids = new Set(topics.map((topic) => topic.id));
    const hasLegend = ids.has("legend");
    const rule =
      TOPIC_RULES.find(([id, re]) => ids.has(id) && re.test(text)) ||
      (!hasLegend && TOPIC_RULES.find(([, re]) => re.test(text)));
    if (rule) return MOCK_TOPICS.filter((topic) => topic.id === rule[0]);
    return hasLegend ? topics.filter((topic) => topic.id === "legend") : topics;
  }

  /**
   * Области вопросов настоящих собесов — те же темы, что у мока, плюс
   * «Другое». Считаются при показе теми же TOPIC_RULES, но по всем темам
   * сразу: в базу ничего не пишется, поэтому фильтр работает и на старых
   * фидбеках. «Легенда» у настоящего собеса — вопросы про опыт и проекты.
   */
  const DOMAINS = [
    ...MOCK_TOPICS.map((topic) =>
      topic.id === "legend" ? { ...topic, name: "Опыт и мотивация" } : topic,
    ),
    { id: "algorithms", name: "Алгоритмы и live coding" },
    { id: "cv", name: "Computer Vision" },
    { id: "recsys", name: "RecSys" },
    { id: "mlops", name: "MLOps и инфраструктура" },
    { id: "analytics", name: "SQL, аналитика и A/B" },
    { id: "other", name: "Другое" },
  ];

  // Только для областей настоящих собесов: проверяются после TOPIC_RULES,
  // поэтому раскладку мока не меняют. Добирают то, чего у мока нет (CV,
  // рекомендации, инфраструктура, аналитика), и формулировки, которые
  // TOPIC_RULES не ловят.
  const DOMAIN_RULES = [
    [
      "legend",
      /про себя|сильн[а-яё]* сторон|слаб[а-яё]* сторон|чем хотел|чем хочешь|дальше заниматься|мотивац|конфликт|что будешь делать|почему (?:ты )?(?:ухо|уш)|поиск[а-яё]* работ|ищете|активном поиске|релокац|внж|команд[аеуы]|дедлайн|вопросы у тебя|диссертац|публикац|меняешь|уйти с|выбор[а-яё]* компани|с чем работал|задач[а-яё]* кажется|твои задачи|какие были задачи/,
    ],
    [
      "rag",
      /qdrant|faiss|hnsw|\bivf\b|milvus|pinecone|weaviate|golden set|retrieval|\bann\b|hallucinat|галлюцинац/,
    ],
    [
      "nlp_advanced",
      /mixture of experts|\bmoe\b|deepseek|reasoning|\bgrpo\b|\bppo\b/,
    ],
    [
      "recsys",
      /рекоменд|recommend|recsys|lightfm|\bals\b|\bsvd\b|learning.to.rank|ранжирован|ndcg|холодн|cold.start|коллаборативн|collaborative/,
    ],
    [
      "cv",
      /детекц|детектир|detect|трекинг|tracking|сегментац|segmentation|\byolo|bounding box|\bbbox|\biou\b|прямоугольн|\bocr\b|изображени|\bimage|картинк|\bcnn\b|\bvit\b|компьютерн[а-яё]* зрени|\breid\b|computer vision|\bcv\b|кадр|видео|пикс/,
    ],
    [
      "mlops",
      /docker|докер|kubernetes|\bk8s\b|ci\/?cd|деплой|deploy|\bgpu\b|vram|cuda|fastapi|backend|kafka|airflow|mlflow|мониторинг|monitoring|prometheus|grafana|кластер|оборудовани|сервер|продакшн|production|latency|масштабир|\bapi\b|микросервис|linux|windows/,
    ],
    [
      "analytics",
      /a\/b|\bab[- ]тест|аб[- ]тест|метрик|конверси|retention|когорт|одобрени|воронк|\bsql\b|group by|having|\bcte\b|запрос[а-яё]* к баз/,
    ],
    [
      "classic_ml",
      /unsupervised|supervised|интерпретир|interpretab|data leakage|утечк[а-яё]* данн|таргет|target|кластеризац|clustering/,
    ],
    ["math", /высш[а-яё]* математ/],
    ["python", /корутин|coroutine|async|try\/except|исключени/],
    [
      "algorithms",
      /сложност|асимптотик|o\(n|\$o\(|задач[аиу] \d|задача на|lru|сортировк|реализуй|решени[ея] на пример|литкод|leetcode|алгоритм/,
    ],
  ];

  function questionDomain(question) {
    const text = normalizeText(question);
    const rule =
      TOPIC_RULES.find(([, re]) => re.test(text)) ||
      DOMAIN_RULES.find(([, re]) => re.test(text));
    return rule ? rule[0] : "other";
  }

  /** Группы банка, куда попадают вопросы фидбэка: компания или темы мока. */
  function feedbackGroups(feedback) {
    const company = getFeedbackCompany(feedback);
    if (company)
      return [{ ...company, root: ROOT_PATH, indexRoot: INDEX_PATH }];
    return getMockTopics(feedback).map(mockTopicGroup);
  }

  function mockTopicGroup(topic) {
    return {
      id: `topic_${topic.id}`,
      name: topic.name,
      normalizedName: normalizeText(topic.name),
      root: MOCK_ROOT_PATH,
      indexRoot: MOCK_INDEX_PATH,
    };
  }

  /**
   * Метка темы в начале заголовка вопроса: `### [dl] Вопрос`,
   * `### [DL, NLP базовый] Вопрос` — id или название темы. Метка главнее и
   * правил, и тем мока. Скобки, где нет ни одной известной темы, остаются
   * частью вопроса.
   */
  function splitTopicTag(heading) {
    const text = String(heading || "");
    const match = /^\s*\[([^\]]+)\]\s*/.exec(text);
    if (!match) return { question: text, topics: [] };
    const names = new Set(match[1].split(",").map(normalizeText));
    const topics = MOCK_TOPICS.filter(
      (topic) => names.has(topic.id) || names.has(normalizeText(topic.name)),
    ).map((topic) => topic.id);
    if (!topics.length) return { question: text, topics };
    return { question: text.slice(match[0].length), topics };
  }

  /** Группы конкретного вопроса: у компании — она сама, у мока — его тема. */
  function questionGroups(feedback, groups, question) {
    if (!groups.length || groups[0].root !== MOCK_ROOT_PATH) return groups;
    const topics = question.topics.length
      ? MOCK_TOPICS.filter((topic) => question.topics.includes(topic.id))
      : questionTopics(question.question, getMockTopics(feedback));
    return topics.map(mockTopicGroup);
  }

  function trimSeparators(value) {
    return String(value || "")
      .replace(/^\s*---+\s*$/gm, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function splitAnswerAndReview(body) {
    const content = trimSeparators(body);
    const match = /(^|\n)\s*твой\s+ответ\s*:\s*/i.exec(content);
    if (!match) return { studentAnswer: "", review: content };

    const before = content.slice(0, match.index).trim();
    const after = content.slice(match.index + match[0].length);
    const paragraphEnd = after.search(/\n\s*\n/);
    const studentAnswer = (
      paragraphEnd === -1 ? after : after.slice(0, paragraphEnd)
    ).trim();
    const remainder = (
      paragraphEnd === -1 ? "" : after.slice(paragraphEnd)
    ).trim();
    return {
      studentAnswer,
      review: trimSeparators([before, remainder].filter(Boolean).join("\n\n")),
    };
  }

  /** Extract H3 question blocks from a stored feedback Markdown section. */
  function parseInterviewQuestions(interviewMarkdown, kind = "technical") {
    const text = String(interviewMarkdown || "").replace(/\r\n/g, "\n");
    const heading = /^###(?!#)\s+(.+?)\s*$/gm;
    const matches = [...text.matchAll(heading)];
    return matches
      .map((match, index) => {
        const tagged = splitTopicTag(cleanQuestion(match[1]));
        const question = cleanQuestion(tagged.question);
        if (!question) return null;
        const nextStart = matches[index + 1]
          ? matches[index + 1].index
          : text.length;
        const { studentAnswer, review } = splitAnswerAndReview(
          text.slice(match.index + match[0].length, nextStart),
        );
        return {
          // Technical questions intentionally keep their original key format so
          // old bank entries remain removable after this feature is deployed.
          id:
            kind === "hr"
              ? `hr_question_${hash(normalizeText(question))}`
              : `question_${hash(normalizeText(question))}`,
          kind,
          question,
          topics: tagged.topics,
          normalizedQuestion: normalizeText(question),
          studentAnswer,
          review,
        };
      })
      .filter(Boolean);
  }

  /**
   * На HR-скрининге интервьюер — рекрутер, и его вопросы ментор пишет в
   * обычную секцию «Вопросы интервьюера и ответы». Без отметки собеседования
   * они попадали бы в банк техническими, поэтому у HR-собеса вся секция
   * читается как HR.
   */
  function interviewSectionKind(feedback) {
    return feedback && feedback.isHrInterview === true ? "hr" : "technical";
  }

  function feedbackToEntries(feedback, sourceSeed) {
    const groups = feedbackGroups(feedback);
    if (!groups.length) return [];
    const timestamp = Number(
      feedback.updatedAt || feedback.createdAt || Date.now(),
    );
    const seen = new Set();
    const questions = [
      ...parseInterviewQuestions(
        feedback.interview,
        interviewSectionKind(feedback),
      ),
      ...parseInterviewQuestions(feedback.hr, "hr"),
    ].filter((question) => {
      if (seen.has(question.id)) return false;
      seen.add(question.id);
      return true;
    });
    return questions.flatMap((question) =>
      questionGroups(feedback, groups, question).map((company) => ({
        company,
        question,
        sourceId: `source_${hash(`${sourceSeed}:${question.id}`)}`,
        source: {
          studentAnswer: question.studentAnswer,
          review: question.review,
          updatedAt: timestamp,
        },
      })),
    );
  }

  function pathFor(entry) {
    return `${entry.company.root}/companies/${entry.company.id}/questions/${entry.question.id}`;
  }

  function indexQuestionId(entry) {
    return `${entry.company.id}__${entry.question.id}`;
  }

  function indexPathFor(entry) {
    return `${entry.company.indexRoot}/questions/${indexQuestionId(entry)}`;
  }

  function buildSyncUpdates(previousFeedback, nextFeedback, sourceSeed) {
    const updates = {};
    feedbackToEntries(previousFeedback, sourceSeed).forEach((entry) => {
      updates[`${pathFor(entry)}/sources/${entry.sourceId}`] = null;
      updates[`${indexPathFor(entry)}/sourceIds/${entry.sourceId}`] = null;
    });
    const timestamp = Number(
      nextFeedback?.updatedAt || nextFeedback?.createdAt || Date.now(),
    );
    feedbackGroups(nextFeedback).forEach((group) => {
      const companyPath = `${group.root}/companies/${group.id}`;
      updates[`${companyPath}/name`] = group.name;
      updates[`${companyPath}/normalizedName`] = group.normalizedName;
      updates[`${companyPath}/updatedAt`] = timestamp;
      updates[`${group.indexRoot}/companies/${group.id}`] = {
        name: group.name,
        normalizedName: group.normalizedName,
        updatedAt: timestamp,
      };
    });
    feedbackToEntries(nextFeedback, sourceSeed).forEach((entry) => {
      const companyPath = `${entry.company.root}/companies/${entry.company.id}`;
      const questionPath = pathFor(entry);
      updates[`${companyPath}/name`] = entry.company.name;
      updates[`${companyPath}/normalizedName`] = entry.company.normalizedName;
      updates[`${companyPath}/updatedAt`] = entry.source.updatedAt;
      updates[`${questionPath}/question`] = entry.question.question;
      updates[`${questionPath}/normalizedQuestion`] =
        entry.question.normalizedQuestion;
      updates[`${questionPath}/kind`] = entry.question.kind;
      updates[`${questionPath}/sources/${entry.sourceId}`] = entry.source;
      const indexPath = indexPathFor(entry);
      updates[`${indexPath}/companyId`] = entry.company.id;
      updates[`${indexPath}/companyName`] = entry.company.name;
      updates[`${indexPath}/questionId`] = entry.question.id;
      updates[`${indexPath}/question`] = entry.question.question;
      updates[`${indexPath}/normalizedQuestion`] =
        entry.question.normalizedQuestion;
      updates[`${indexPath}/kind`] = entry.question.kind;
      updates[`${indexPath}/updatedAt`] = entry.source.updatedAt;
      updates[`${indexPath}/sourceIds/${entry.sourceId}`] = true;
    });
    return updates;
  }

  function indexToBank(index) {
    const bank = { companies: {} };
    Object.values(index?.questions || {}).forEach((entry) => {
      if (!entry || !entry.companyId || !entry.questionId || !entry.question)
        return;
      if (!Object.keys(entry.sourceIds || {}).length) return;
      const company = (bank.companies[entry.companyId] ||= {
        name: entry.companyName || entry.companyId,
        normalizedName: normalizeText(entry.companyName || entry.companyId),
        updatedAt: entry.updatedAt || 0,
        questions: {},
      });
      company.updatedAt = Math.max(
        company.updatedAt || 0,
        entry.updatedAt || 0,
      );
      company.questions[entry.questionId] = {
        question: entry.question,
        normalizedQuestion:
          entry.normalizedQuestion || normalizeText(entry.question),
        kind: entry.kind || "technical",
        // A compact source map preserves the existing list/filter helpers
        // without exposing answer or review content in the index.
        sources: entry.sourceIds || {},
      };
    });
    return bank;
  }

  function buildBankFromFeedbacks(items, root = ROOT_PATH) {
    const bank = { companies: {} };
    items.forEach(({ feedback, sourceSeed }) => {
      feedbackToEntries(feedback, sourceSeed).forEach((entry) => {
        if (entry.company.root !== root) return;
        const company = (bank.companies[entry.company.id] ||= {
          name: entry.company.name,
          normalizedName: entry.company.normalizedName,
          updatedAt: entry.source.updatedAt,
          questions: {},
        });
        company.updatedAt = Math.max(
          company.updatedAt || 0,
          entry.source.updatedAt || 0,
        );
        const question = (company.questions[entry.question.id] ||= {
          question: entry.question.question,
          normalizedQuestion: entry.question.normalizedQuestion,
          kind: entry.question.kind,
          sources: {},
        });
        question.sources[entry.sourceId] = entry.source;
      });
    });
    return bank;
  }

  /** Технические вопросы идут блоком выше HR, чтобы типы не перемешивались. */
  function kindRank(kind) {
    return kind === "hr" ? 1 : 0;
  }

  function getKnownCompanies(bank) {
    return Object.entries((bank && bank.companies) || {})
      .map(([id, company]) => ({
        id,
        name: company.name,
        questionCount: Object.values(company.questions || {}).filter(
          (question) => Object.keys(question.sources || {}).length > 0,
        ).length,
      }))
      .filter((company) => company.name)
      .sort((first, second) => first.name.localeCompare(second.name, "ru"));
  }

  function listCompanies(bank) {
    return getKnownCompanies(bank).filter(
      (company) => company.questionCount > 0,
    );
  }

  function listQuestions(company, search, kind = "all") {
    const query = normalizeText(search);
    return Object.entries((company && company.questions) || {})
      .map(([questionId, question]) => {
        const sources = Object.values(question.sources || {});
        const sample = sources.sort(
          (first, second) =>
            Number(second.updatedAt || 0) - Number(first.updatedAt || 0),
        )[0];
        return {
          questionId,
          question: question.question,
          kind: question.kind || "technical",
          frequency: sources.length,
          studentAnswer: sample ? sample.studentAnswer || "" : "",
          review: sample ? sample.review || "" : "",
        };
      })
      .filter((question) => question.frequency > 0)
      .filter((question) => kind === "all" || question.kind === kind)
      .filter(
        (question) =>
          !query || normalizeText(question.question).includes(query),
      )
      .sort(
        (first, second) =>
          kindRank(first.kind) - kindRank(second.kind) ||
          second.frequency - first.frequency ||
          first.question.localeCompare(second.question, "ru"),
      );
  }

  function listAllQuestions(bank, search, kind = "all") {
    return Object.entries((bank && bank.companies) || {})
      .flatMap(([companyId, company]) =>
        listQuestions(company, search, kind).map((question) => ({
          ...question,
          companyId,
          companyName: company.name,
        })),
      )
      .sort(
        (first, second) =>
          kindRank(first.kind) - kindRank(second.kind) ||
          first.companyName.localeCompare(second.companyName, "ru") ||
          first.question.localeCompare(second.question, "ru"),
      );
  }

  return {
    ROOT_PATH,
    INDEX_PATH,
    MOCK_INDEX_PATH,
    MOCK_ROOT_PATH,
    MOCK_TOPICS,
    DOMAINS,
    buildBankFromFeedbacks,
    buildSyncUpdates,
    getCompanyMeta,
    getFeedbackCompany,
    getKnownCompanies,
    getMockTopics,
    indexToBank,
    listCompanies,
    listAllQuestions,
    listQuestions,
    normalizeText,
    parseInterviewQuestions,
    questionDomain,
    questionTopics,
    splitTopicTag,
  };
});
