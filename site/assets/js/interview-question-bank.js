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
        const question = cleanQuestion(match[1]);
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
    const company = getFeedbackCompany(feedback);
    if (!company) return [];
    const timestamp = Number(
      feedback.updatedAt || feedback.createdAt || Date.now(),
    );
    const seen = new Set();
    return [
      ...parseInterviewQuestions(
        feedback.interview,
        interviewSectionKind(feedback),
      ),
      ...parseInterviewQuestions(feedback.hr, "hr"),
    ]
      .filter((question) => {
        if (seen.has(question.id)) return false;
        seen.add(question.id);
        return true;
      })
      .map((question) => ({
        company,
        question,
        sourceId: `source_${hash(`${sourceSeed}:${question.id}`)}`,
        source: {
          studentAnswer: question.studentAnswer,
          review: question.review,
          updatedAt: timestamp,
        },
      }));
  }

  function pathFor(entry) {
    return `${ROOT_PATH}/companies/${entry.company.id}/questions/${entry.question.id}`;
  }

  function indexQuestionId(entry) {
    return `${entry.company.id}__${entry.question.id}`;
  }

  function indexPathFor(entry) {
    return `${INDEX_PATH}/questions/${indexQuestionId(entry)}`;
  }

  function buildSyncUpdates(previousFeedback, nextFeedback, sourceSeed) {
    const updates = {};
    feedbackToEntries(previousFeedback, sourceSeed).forEach((entry) => {
      updates[`${pathFor(entry)}/sources/${entry.sourceId}`] = null;
      updates[`${indexPathFor(entry)}/sourceIds/${entry.sourceId}`] = null;
    });
    const nextCompany = getFeedbackCompany(nextFeedback);
    if (nextCompany) {
      const timestamp = Number(
        nextFeedback.updatedAt || nextFeedback.createdAt || Date.now(),
      );
      const companyPath = `${ROOT_PATH}/companies/${nextCompany.id}`;
      updates[`${companyPath}/name`] = nextCompany.name;
      updates[`${companyPath}/normalizedName`] = nextCompany.normalizedName;
      updates[`${companyPath}/updatedAt`] = timestamp;
      updates[`${INDEX_PATH}/companies/${nextCompany.id}`] = {
        name: nextCompany.name,
        normalizedName: nextCompany.normalizedName,
        updatedAt: timestamp,
      };
    }
    feedbackToEntries(nextFeedback, sourceSeed).forEach((entry) => {
      const companyPath = `${ROOT_PATH}/companies/${entry.company.id}`;
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
      updates[`${indexPath}/normalizedQuestion`] = entry.question.normalizedQuestion;
      updates[`${indexPath}/kind`] = entry.question.kind;
      updates[`${indexPath}/updatedAt`] = entry.source.updatedAt;
      updates[`${indexPath}/sourceIds/${entry.sourceId}`] = true;
    });
    return updates;
  }

  function indexToBank(index) {
    const bank = { companies: {} };
    Object.values(index?.questions || {}).forEach((entry) => {
      if (!entry || !entry.companyId || !entry.questionId || !entry.question) return;
      if (!Object.keys(entry.sourceIds || {}).length) return;
      const company = (bank.companies[entry.companyId] ||= {
        name: entry.companyName || entry.companyId,
        normalizedName: normalizeText(entry.companyName || entry.companyId),
        updatedAt: entry.updatedAt || 0,
        questions: {},
      });
      company.updatedAt = Math.max(company.updatedAt || 0, entry.updatedAt || 0);
      company.questions[entry.questionId] = {
        question: entry.question,
        normalizedQuestion: entry.normalizedQuestion || normalizeText(entry.question),
        kind: entry.kind || "technical",
        // A compact source map preserves the existing list/filter helpers
        // without exposing answer or review content in the index.
        sources: entry.sourceIds || {},
      };
    });
    return bank;
  }

  function buildBankFromFeedbacks(items) {
    const bank = { companies: {} };
    items.forEach(({ feedback, sourceSeed }) => {
      feedbackToEntries(feedback, sourceSeed).forEach((entry) => {
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
    buildBankFromFeedbacks,
    buildSyncUpdates,
    getCompanyMeta,
    getFeedbackCompany,
    getKnownCompanies,
    indexToBank,
    listCompanies,
    listAllQuestions,
    listQuestions,
    normalizeText,
    parseInterviewQuestions,
  };
});
