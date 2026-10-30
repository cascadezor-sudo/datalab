const fs = require('fs');
const path = require('path');

function walk(dir, list = []) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p, list);
    else if (p.endsWith('.html')) list.push(p);
  }
  return list;
}

const pages = walk('site');
const externalTags = [];

const scriptRegex = /<(?:script|link)[^>]+(?:src|href)=["'](https?:\/\/[^"']+)["'][^>]*>/gi;

for (const p of pages) {
  const content = fs.readFileSync(p, 'utf8');
  let match;
  while ((match = scriptRegex.exec(content)) !== null) {
    externalTags.push({ file: p.replace(/\\/g, '/'), tag: match[0], url: match[1] });
  }
}

console.log('=== EXTERNAL SCRIPTS / STYLESHEETS IN HTML ===');
console.log('Count:', externalTags.length);
externalTags.forEach(t => console.log(`[${t.file}] => ${t.url}`));
