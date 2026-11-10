import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(projectRoot, "site");
const destination = path.join(projectRoot, ".local", "pages");
const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1] || "datalab";
const base = `/${repositoryName}/`;
const textExtensions = new Set([".html", ".css", ".js", ".json"]);

// The local server serves site/ at /. A project Pages site is served at
// /<repository>/, so rewrite only URL literals in the published copy.
function rewriteUrls(content, extension) {
  let rewritten = content.replace(/(^|[=(:,\[+?\s])(["'`])\/(?!\/)(?=[\w-])/gm, `$1$2${base}`);
  if (extension === ".html") {
    rewritten = rewritten.replace(/(\b(?:href|src|action)=(["']))\/\2/g, `$1${base}$2`);
  }
  return rewritten;
}

async function rewriteDirectory(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await rewriteDirectory(fullPath);
    } else if (entry.isFile() && textExtensions.has(path.extname(entry.name))) {
      const original = await readFile(fullPath, "utf8");
      const rewritten = rewriteUrls(original, path.extname(entry.name));
      if (rewritten !== original) await writeFile(fullPath, rewritten);
    }
  }
}

await mkdir(path.dirname(destination), { recursive: true });
await rm(destination, { recursive: true, force: true });
await cp(source, destination, { recursive: true });
await rewriteDirectory(destination);

const index = await readFile(path.join(destination, "index.html"), "utf8");
const main = await readFile(path.join(destination, "main.html"), "utf8");
const mock = await readFile(path.join(destination, "assets/js/firebase-mock.js"), "utf8");
if (!index.includes(`href="${base}"`) ||
    !index.includes(`href="${base}main.html"`) ||
    !main.includes(`/${repositoryName}/assets/`) ||
    !mock.includes(`/${repositoryName}/assets/data/`)) {
  throw new Error("Pages build did not rewrite the expected root URLs");
}

console.log(`Pages site ready at ${destination} (base ${base})`);
