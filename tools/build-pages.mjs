import { cp, lstat, mkdir, readFile, readdir, rmdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(projectRoot, "site");
const destination = path.join(projectRoot, ".local", "pages");
const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1] || "datalab";
const base = `/${repositoryName}/`;
const assetVersion = process.env.GITHUB_SHA?.slice(0, 12) || "local";
const textExtensions = new Set([".html", ".css", ".js", ".json"]);
// Publish only formats used by the site. New formats require an explicit review.
// This is a filename policy, not a scan for secrets inside otherwise valid files.
const publicExtensions = new Set([
  ".html", ".css", ".js", ".json", ".png", ".gif", ".svg", ".jpg",
  ".jpeg", ".webp", ".avif", ".woff2", ".woff", ".ttf", ".md", ".csv",
]);
const forbiddenPart = /(?:^|[._-])(?:bak|backup|old|orig|tmp|swp|secret|secrets|credential|credentials|password|passwords|private[-_.]?key|api[-_.]?key|access[-_.]?token)(?:[._-]|$)/i;
const forbiddenDirectories = new Set(["node_modules", "__pycache__", "coverage", "dist", "build", "tmp", "temp"]);

function allowedName(name, isDirectory) {
  if (name.startsWith(".") || forbiddenPart.test(name)) return false;
  if (isDirectory) return !forbiddenDirectories.has(name.toLowerCase());
  return publicExtensions.has(path.extname(name).toLowerCase());
}

async function copyFilter(item) {
  if (item === source) return true;
  const stat = await lstat(item);
  // Do not follow links outside site/ or publish links in a Pages artifact.
  if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile())) return false;
  return allowedName(path.basename(item), stat.isDirectory());
}

async function validateArtifact(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink() || (!entry.isDirectory() && !entry.isFile()) ||
        !allowedName(entry.name, entry.isDirectory())) {
      throw new Error(`Forbidden Pages artifact entry: ${path.relative(destination, path.join(directory, entry.name))}`);
    }
    if (entry.isDirectory()) await validateArtifact(path.join(directory, entry.name));
  }
}

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
if ((await lstat(path.dirname(destination))).isSymbolicLink()) {
  throw new Error("Refusing to use a symlinked Pages output parent");
}
let previous;
try {
  previous = await lstat(destination);
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
if (previous) {
  if (!previous.isDirectory() || previous.isSymbolicLink()) {
    throw new Error("Refusing to replace a non-directory Pages output");
  }
  // Even public-looking files can contain the owner's work. Do not remove or
  // overwrite any existing output; the owner must inspect it first.
  if ((await readdir(destination)).length) {
    throw new Error("Pages output already exists and is not empty; inspect it before building");
  }
  // rmdir fails if anything is added after the check, unlike recursive rm.
  await rmdir(destination);
}
await cp(source, destination, { recursive: true, filter: copyFilter });
await rewriteDirectory(destination);
await validateArtifact(destination);

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
