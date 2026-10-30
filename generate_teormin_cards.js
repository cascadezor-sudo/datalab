const fs = require('fs');
const path = require('path');

const summaryPath = './site/assets/js/config/teormin-cards-summary.json';
const qlistPath = './site/assets/js/config/questions-list.json';
const blockManifestPath = './site/assets/js/config/teormin-card-blocks.json';
const outputPath = './site/assets/data/teormin-cards.json';

const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
const qlist = JSON.parse(fs.readFileSync(qlistPath, 'utf8'));
const blockManifest = fs.existsSync(blockManifestPath)
  ? JSON.parse(fs.readFileSync(blockManifestPath, 'utf8'))
  : { pages: {} };

const defaultCatNames = {
  ml_cv: 'Компьютерное зрение',
  math: 'Математика',
  ml_classic: 'Классическое ML',
  ml_cv_dl: 'CV и Deep Learning',
  ml_dl: 'Глубокое обучение',
  ml_models_cv: 'Архитектуры CV',
  ml_models_dl: 'Архитектуры DL',
  ml_models_nlp: 'Архитектуры NLP',
  ml_nlp_advanced: 'Продвинутый NLP',
  ml_agents: 'AI Агенты',
  ml_nlp_base: 'Базовый NLP',
  ml_optimization: 'Оптимизация ML',
  ml_rag: 'RAG системы',
  ml_recsys: 'Рекомендательные системы',
  ml_timeseries: 'Временные ряды',
  docker: 'Docker',
  clearml: 'ClearML',
  mlflow: 'MLflow',
  tensorboard: 'TensorBoard',
  wandb: 'Weights & Biases',
  cloud: 'Облачные сервисы',
  db: 'Базы данных',
  kafka: 'Kafka',
  grafana: 'Grafana',
  prometheus: 'Prometheus',
  classic_ml_practise: 'Практика Classic ML',
  dl_practise: 'Практика DL',
  nlp_practise: 'Практика NLP',
  db_postgresql: 'PostgreSQL',
  db_redis: 'Redis',
  github: 'Git & GitHub',
  linux: 'Linux',
  db_postgresql_practise: 'Практика PostgreSQL',
  db_redis_practise: 'Практика Redis',
  python: 'Python'
};

const categoryIcons = {
  math: '📐',
  ml_classic: '🤖',
  ml_dl: '🧠',
  python: '🐍',
  linux: '🐧',
  github: '🐙',
  db: '🗄️',
  db_postgresql: '🐘',
  db_redis: '⚡',
  ml_cv: '👁️',
  ml_cv_dl: '👁️',
  ml_nlp_base: '📝',
  ml_nlp_advanced: '🗣️',
  ml_agents: '🕵️',
  ml_rag: '🔍',
  ml_recsys: '🎯',
  ml_timeseries: '📈',
  docker: '🐳',
  kafka: '📨'
};

const allCards = [];
const cardsByQuestionId = {};

for (const [page, qIds] of Object.entries(qlist.pages)) {
  const filePath = path.join('./site', page);
  if (!fs.existsSync(filePath)) continue;
  const content = fs.readFileSync(filePath, 'utf8');

  for (const qId of qIds) {
    let idIdx = content.indexOf(`id="${qId}"`);
    if (idIdx === -1) {
      idIdx = content.indexOf(`data-md-id="${qId}"`);
    }
    if (idIdx === -1) continue;

    // Find question title
    let questionTitle = qId;
    const aroundTitle = content.substring(Math.max(0, idIdx - 200), Math.min(content.length, idIdx + 400));
    const titleMatch = aroundTitle.match(/class="question-title-link"[^>]*>([^<]+)/) ||
                       aroundTitle.match(/<a[^>]*class="[^"]*question-title-link[^"]*"[^>]*>([^<]+)/) ||
                       aroundTitle.match(/<div class="name"[^>]*>\s*(?:<[^>]+>)*\s*([^<\n\r]+)/);
    if (titleMatch) {
      questionTitle = titleMatch[1].trim();
    }

    const nextQIdx = content.indexOf('class="question"', idIdx + 20);
    const qSection = content.substring(idIdx, nextQIdx === -1 ? idIdx + 35000 : nextQIdx);

    const teorminIdx = qSection.indexOf('data-type="teormin"');
    if (teorminIdx === -1) continue;

    const teorminBlock = qSection.substring(teorminIdx);
    const olIdx = teorminBlock.indexOf('<ol');
    if (olIdx === -1) continue;
    const closeOlIdx = teorminBlock.indexOf('</ol>', olIdx);
    if (closeOlIdx === -1) continue;

    const listContent = teorminBlock.substring(olIdx, closeOlIdx);
    const rawItems = listContent.split(/<li[^>]*>/).slice(1);
    const items = rawItems.map(item => item.replace(/<\/li>[\s\S]*$/, '').trim()).filter(Boolean);

    const catId = summary.categories[qId] || 'ml_classic';
    const catName = defaultCatNames[catId] || catId;
    const catIcon = categoryIcons[catId] || '📚';
    const expectedOrdinals = summary.ordinals[qId] || [];

    items.forEach((item, index) => {
      const ordinal = expectedOrdinals[index] !== undefined ? expectedOrdinals[index] : (index + 1);

      let promptHtml = '';
      let answerHtml = '';

      const boldMatch = item.match(/<b>([\s\S]*?)<\/b>/i);
      if (boldMatch) {
        promptHtml = boldMatch[1].trim();
        let rest = item.substring(item.indexOf('</b>') + 4).trim();
        if (rest.startsWith('</p>')) rest = rest.substring(4).trim();
        answerHtml = rest;
      } else {
        const parts = item.split(/<\/p>\s*<p>/);
        promptHtml = parts[0].replace(/^<p>/, '').replace(/<\/p>$/, '').trim();
        answerHtml = parts.slice(1).join('<p>').replace(/<\/p>$/, '').trim();
      }

      if (!promptHtml && item) {
        promptHtml = item;
      }

      const card = {
        id: `${qId}__${ordinal}`,
        questionId: qId,
        ordinal: ordinal,
        blockNumber: blockManifest.pages?.[page]?.blocks?.[qId] ?? null,
        category: {
          id: catId,
          name: catName,
          icon: catIcon
        },
        questionTitle: questionTitle,
        targetPage: page,
        href: `/${page}#${qId}`,
        promptHtml: promptHtml,
        promptText: promptHtml.replace(/<[^>]+>/g, '').trim(),
        answerHtml: answerHtml,
        answerText: answerHtml.replace(/<[^>]+>/g, '').trim()
      };

      allCards.push(card);
      if (!cardsByQuestionId[qId]) cardsByQuestionId[qId] = [];
      cardsByQuestionId[qId].push(card);
    });
  }
}

const summaryKeys = Object.keys(summary.ordinals);
const matchedSummaryKeys = summaryKeys.filter(k => cardsByQuestionId[k] && cardsByQuestionId[k].length > 0);
console.log(`Matched ${matchedSummaryKeys.length} / ${summaryKeys.length} questions from summary.`);
console.log(`Total cards extracted: ${allCards.length}`);

// Write output
fs.writeFileSync(outputPath, JSON.stringify({
  version: 1,
  generatedAt: new Date().toISOString(),
  count: allCards.length,
  cards: allCards
}, null, 2), 'utf8');

console.log(`Successfully written cards to ${outputPath}`);
