// Builds a local copy of the *current* working tree in an owned temporary root.
// No publishing, no writes to the workspace .local/pages, no real browser data.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const tmpParent = fs.realpathSync(os.tmpdir());
  const root = fs.mkdtempSync(path.join(tmpParent, 'datalab-pages-storage-'));
  let server, browser;
  try {
    fs.mkdirSync(path.join(root, 'tools'));
    fs.copyFileSync(path.join(__dirname, '../../tools/build-pages.mjs'), path.join(root, 'tools/build-pages.mjs'));
    fs.cpSync(path.join(__dirname, '../../site'), path.join(root, 'site'), { recursive: true });
    execFileSync(process.execPath, ['tools/build-pages.mjs'], { cwd: root, stdio: 'pipe', env: { ...process.env, GITHUB_REPOSITORY: 'cascadezor-sudo/datalab', GITHUB_SHA: 'phase11-synthetic' } });
    const artifact = path.join(root, '.local/pages');
    const files = [];
    function walk(directory) {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const full = path.join(directory, entry.name);
        if (entry.isDirectory()) walk(full); else files.push(full);
      }
    }
    walk(artifact);
    assert.equal(files.filter(file => /\.bak(?:\.|$)/i.test(file)).length, 0);
    assert.ok(fs.existsSync(path.join(artifact, 'storage-recovery.html')));
    assert.ok(fs.existsSync(path.join(artifact, 'assets/js/storage-service.js')));
    console.log(JSON.stringify({ artifactFiles: files.length, htmlPages: files.filter(file => file.endsWith('.html')).length, backupFiles: 0 }));
    const inventory = JSON.parse(execFileSync(process.env.DATALAB_PYTHON || 'python', [path.join(__dirname, '../../tools/audits/routes_inventory.py'), '--site', artifact, '--pages-artifact'], { encoding: 'utf8' }));
    console.log('Pages route inventory:', JSON.stringify(inventory));
    const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };
    server = http.createServer((request, response) => {
      const url = new URL(request.url, 'http://127.0.0.1');
      if (!url.pathname.startsWith('/datalab/')) { response.writeHead(404).end(); return; }
      let pathname;
      try { pathname = decodeURIComponent(url.pathname.slice('/datalab/'.length)); } catch (_) { response.writeHead(400).end(); return; }
      const target = path.resolve(artifact, pathname || 'index.html');
      if (!(target === artifact || target.startsWith(artifact + path.sep)) || !fs.existsSync(target) || !fs.statSync(target).isFile()) { response.writeHead(404, { 'Content-Type': 'text/html' }).end('<!doctype html><title>Synthetic probe</title>'); return; }
      response.writeHead(200, { 'Content-Type': mime[path.extname(target)] || 'application/octet-stream' });
      fs.createReadStream(target).pipe(response);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = 'http://127.0.0.1:' + server.address().port;
    browser = await chromium.launch({ headless: true, ...(process.env.DATALAB_CHROMIUM ? { executablePath: process.env.DATALAB_CHROMIUM } : {}) });
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/datalab/__synthetic_loader_probe__');
    const loaded = page.waitForResponse(response => response.url().includes('/datalab/assets/js/storage-service.js'));
    await page.addScriptTag({ url: base + '/datalab/assets/js/firebase-mock.js' });
    assert.equal((await loaded).status(), 200);
    await page.evaluate(() => __datalabStorageReady);
    await page.evaluate(() => firebase.database().ref('syntheticPages').set({ preserved: true }));
    const result = await page.goto(base + '/datalab/storage-recovery.html');
    assert.equal(result.status(), 200);
    await page.waitForFunction(() => !document.querySelector('#export').disabled);
    assert.equal(await page.evaluate(async () => (await DataLabStorage.read()).db.syntheticPages.preserved), true);
    assert.equal(await page.evaluate(async () => JSON.parse(await DataLabRecovery.exportCurrent()).source.basePath), '/datalab/');
    assert.deepEqual(errors, []);
    console.log('PASS: current-working-tree Pages build, filtered artifact, /datalab/ dynamic storage loader and recovery UI');
    await context.close();
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise(resolve => server.close(resolve));
    // Only the exact, newly-created task directory below the resolved OS temp
    // directory is eligible. Reject symlinks and an unexpected path before rm.
    const resolved = fs.realpathSync(root);
    assert.equal(path.dirname(resolved).toLowerCase(), tmpParent.toLowerCase());
    assert.ok(path.basename(resolved).startsWith('datalab-pages-storage-'));
    assert.equal(fs.lstatSync(root).isSymbolicLink(), false);
    fs.rmSync(resolved, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
