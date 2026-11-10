import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(projectRoot, "site");
const destination = path.join(projectRoot, ".local", "pages");
const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1] || "datalab";
const base = `/${repositoryName}/`;
const assetVersion = process.env.GITHUB_SHA?.slice(0, 12) || "local";
const textExtensions = new Set([".html", ".css", ".js", ".json"]);

// The local server serves site/ at /. A project Pages site is served at
// /<repository>/, so rewrite only URL literals in the published copy.
function rewriteUrls(content, extension) {
  let rewritten = content.replace(/(^|[=(:,\[+?\s])(["'`])\/(?!\/)(?=[\w-])/gm, `$1$2${base}`);
  if (extension === ".html") {
    rewritten = rewritten.replace(/(\b(?:href|src|action)=(["']))\/\2/g, `$1${base}$2`);
    // GitHub Pages caches CSS and JS. Give each deployment a new asset URL so
    // an open mobile browser does not keep using an earlier navigation style.
    rewritten = rewritten.replace(/\b(href|src)=(["'])([^"']+?\.(?:css|js))([^"']*)\2/g, (match, attribute, quote, url, suffix) => {
      if (/^(?:[a-z]+:)?\/\//i.test(url) || url.startsWith("data:")) return match;
      const hashIndex = suffix.indexOf("#");
      const query = hashIndex < 0 ? suffix : suffix.slice(0, hashIndex);
      const hash = hashIndex < 0 ? "" : suffix.slice(hashIndex);
      const separator = query.includes("?") ? "&" : "?";
      return `${attribute}=${quote}${url}${query}${separator}pages=${assetVersion}${hash}${quote}`;
    });
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
const pythonBase = await readFile(path.join(destination, "python/base.html"), "utf8");
if (!index.includes(`href="${base}"`) ||
    !index.includes(`href="${base}main.html"`) ||
    !main.includes(`/${repositoryName}/assets/`) ||
    !mock.includes(`/${repositoryName}/assets/data/`) ||
    !pythonBase.includes(`navigation.css?pages=${assetVersion}`)) {
  throw new Error("Pages build did not rewrite the expected root URLs");
}

console.log(`Pages site ready at ${destination} (base ${base})`);
