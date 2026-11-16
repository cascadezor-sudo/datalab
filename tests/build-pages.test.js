const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, mkdir, writeFile, readFile, access, cp, rm, symlink } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

test("Pages build filters local files and preserves public routes and assets", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "datalab-pages-test-"));
  const source = path.join(root, "site");
  const put = async (name, content) => {
    const full = path.join(source, name);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, content);
  };
  try {
    await mkdir(path.join(root, "tools"), { recursive: true });
    await cp(path.resolve(__dirname, "../tools/build-pages.mjs"), path.join(root, "tools/build-pages.mjs"));
    await put("index.html", '<a href="/">Home</a><a href="/main.html">Main</a>');
    await put("main.html", '<link href="/assets/css/tokens.css">');
    await put("python/base.html", '<link href="/assets/css/navigation.css">');
    await put("assets/js/firebase-mock.js", 'const url = "/assets/data/data.json";');
    await put("assets/css/tokens.css", "body { color: white; }");
    await put("assets/data/data.json", '{"ok":true}');
    await put("assets/images/key_versioning.gif", "gif");
    await put("assets/fonts/font.woff2", "font");
    await put("examples/resume.md", "public example");
    await put("assets/data/train.csv", "x,y\n1,2");
    for (const name of ["index.html.bak", ".env", ".env.production", "config.secret.json",
      "credentials.json", "api-key.json", "private-key.pem", "backup/main.html",
      ".git/config", "node_modules/package/index.js", "temp/note.html", "log.tmp"]) {
      await put(name, "not for publication");
    }
    // Windows may disallow creating symlinks without developer mode.
    let symlinkCreated = false;
    try { await symlink(path.join(source, ".env"), path.join(source, "linked.json")); symlinkCreated = true; }
    catch (error) { if (!["EPERM", "EACCES", "ENOTSUP"].includes(error.code)) throw error; }
    const build = spawnSync(process.execPath, [path.join(root, "tools/build-pages.mjs")], {
      cwd: root, encoding: "utf8", env: { ...process.env, GITHUB_REPOSITORY: "owner/datalab", GITHUB_SHA: "abc123" },
    });
    assert.equal(build.status, 0, build.stderr);
    const output = path.join(root, ".local/pages");
    for (const name of ["index.html.bak", ".env", ".env.production", "config.secret.json",
      "credentials.json", "api-key.json", "private-key.pem", "backup/main.html", ".git/config",
      "node_modules/package/index.js", "temp/note.html", "log.tmp", ...(symlinkCreated ? ["linked.json"] : [])]) {
      await assert.rejects(access(path.join(output, name)), { code: "ENOENT" }, name);
      await access(path.join(source, name)); // build must not delete source files
    }
    for (const name of ["assets/css/tokens.css", "assets/data/data.json", "assets/images/key_versioning.gif",
      "assets/fonts/font.woff2", "examples/resume.md", "assets/data/train.csv"]) await access(path.join(output, name));
    assert.match(await readFile(path.join(output, "index.html"), "utf8"), /href="\/datalab\/main\.html"/);
    assert.match(await readFile(path.join(output, "python/base.html"), "utf8"), /navigation\.css\?pages=abc123/);
    // An older local output may contain a backup or work with an allowed extension.
    await writeFile(path.join(output, "local-backup.bak"), "preserve me");
    await writeFile(path.join(output, "personal.json"), "preserve that too");
    const rebuild = spawnSync(process.execPath, [path.join(root, "tools/build-pages.mjs")], {
      cwd: root, encoding: "utf8", env: { ...process.env, GITHUB_REPOSITORY: "owner/datalab", GITHUB_SHA: "abc123" },
    });
    assert.notEqual(rebuild.status, 0);
    assert.match(rebuild.stderr, /Pages output already exists and is not empty/);
    assert.equal(await readFile(path.join(output, "local-backup.bak"), "utf8"), "preserve me");
    assert.equal(await readFile(path.join(output, "personal.json"), "utf8"), "preserve that too");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
