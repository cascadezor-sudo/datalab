const fs = require("fs");
const path = require("path");

const root = __dirname;
const siteRoot = path.join(root, "site");
const listPath = path.join(siteRoot, "assets/js/config/questions-list.json");
const outputPath = path.join(
  siteRoot,
  "assets/js/config/teormin-card-blocks.json",
);

function plainText(html) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function findQuestionPosition(html, questionId) {
  const escaped = questionId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<li\\b[^>]*data-md-id=["']${escaped}["'][^>]*>`, "i"),
    new RegExp(`<div\\b[^>]*class=["'][^"']*\\bname\\b[^"']*["'][^>]*id=["']${escaped}["']`, "i"),
    new RegExp(`<[^>]+\\bid=["']${escaped}["']`, "i"),
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match) return match.index;
  }
  return -1;
}

function extractBlocks(html, questionIds) {
  const headings = [];
  const headingPattern = /<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]\s*>/gi;
  for (const match of html.matchAll(headingPattern)) {
    const title = plainText(match[1]);
    const blockMatch = title.match(/^Блок\s+(\d+)\b/i);
    if (blockMatch) headings.push({ position: match.index, number: Number(blockMatch[1]) });
  }

  const blocks = {};
  for (const questionId of questionIds) {
    const position = findQuestionPosition(html, questionId);
    if (position < 0) continue;
    let current = null;
    for (const heading of headings) {
      if (heading.position > position) break;
      current = heading.number;
    }
    if (current !== null) blocks[questionId] = current;
  }
  return blocks;
}

const questionList = JSON.parse(fs.readFileSync(listPath, "utf8"));
const pages = {};
let mappedQuestions = 0;

for (const [page, questionIds] of Object.entries(questionList.pages || {})) {
  const filePath = path.join(siteRoot, page);
  if (!fs.existsSync(filePath)) continue;
  const html = fs.readFileSync(filePath, "utf8");
  const heading = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1\s*>/i);
  const titleTag = html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i);
  const title = plainText((heading || titleTag || ["", page])[1]);
  const blocks = extractBlocks(html, questionIds);
  mappedQuestions += Object.keys(blocks).length;
  pages[page.replace(/\\/g, "/")] = { title, blocks };
}

fs.writeFileSync(
  outputPath,
  JSON.stringify({ version: 1, pages }, null, 2) + "\n",
  "utf8",
);
console.log(`Wrote ${mappedQuestions} block mappings for ${Object.keys(pages).length} pages to ${path.relative(root, outputPath)}.`);
