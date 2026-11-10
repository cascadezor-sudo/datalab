const fs = require('fs');
const path = require('path');

function walk(dir, list = []) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p, list);
    else if (p.endsWith('.js') || p.endsWith('.html') || p.endsWith('.json')) list.push(p);
  }
  return list;
}

const projectRoot = path.resolve(__dirname, '../..');
const files = walk(path.join(projectRoot, 'site'));
const domains = {};

const urlRegex = /https?:\/\/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})([^\s'"`<>)]*)/g;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = urlRegex.exec(content)) !== null) {
    const domain = match[1];
    if (domain.includes('w3.org') || domain.includes('schema.org') || domain.includes('localhost') || domain.includes('127.0.0.1')) continue;
    if (!domains[domain]) domains[domain] = [];
    if (domains[domain].length < 3) {
      domains[domain].push(path.relative(projectRoot, file).replace(/\\/g, '/'));
    }
  }
}

console.log('=== EXTERNAL DOMAINS AUDIT ===');
for (const [d, sampleFiles] of Object.entries(domains)) {
  console.log(`- ${d}: ${sampleFiles.join(', ')}`);
}
