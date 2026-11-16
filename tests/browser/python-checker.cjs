// Run explicitly with NODE_PATH pointing to an isolated Playwright install.
// Every browser context is ephemeral; only synthetic exercise code is used.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const path = require('node:path');
const { createInterface } = require('node:readline');
const { chromium } = require('playwright');
const { startServer } = require('../../server/server.js');

const code = 'def filter_positive_even(numbers):\n    return [x for x in numbers if x > 0 and x % 2 == 0]';
const changed = '# changed while executing\n' + code;

async function exercise(page, origin) {
  await page.goto(origin + '/practise/python/base.html');
  const q = page.locator('[data-md-id="filter_positive_even"]');
  await q.locator('.name').click();
  await q.locator('.exc-textarea').waitFor();
  await page.waitForTimeout(1000);
  await q.locator('.exc-textarea').fill(code);
  return q;
}

async function checkServer(browser, base) {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    const q = await exercise(page, base);
    const request = page.waitForRequest(r => r.url() === base + '/api/run');
    await q.locator('.exc-submit').click();
    assert.equal((await request).headers()['x-datalab-local'], '1');
    await q.locator('.exc-summary--ok').waitFor({timeout: 15000});
    const rejected = await page.evaluate(async () => {
      const r = await fetch('/api/run', {method:'POST', headers:{'Content-Type':'application/json'}, body:'{}'});
      return r.status;
    });
    assert.equal(rejected, 403);
    for (const headers of [
      {Origin: base, 'Content-Type':'application/json'},
      {Origin:'http://example.invalid', 'X-DataLab-Local':'1', 'Content-Type':'application/json'},
    ]) {
      const response = await fetch(base + '/api/run', {method:'POST', headers, body:'{}'});
      assert.equal(response.status, 403);
    }
    console.log('PASS real UI and rejected request:', base);
  } finally { await context.close(); }
}

async function checkRaceAndError(browser, base) {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    const q = await exercise(page, base);
    await page.evaluate(() => DataLabStorage.ready);
    let release;
    const held = new Promise(resolve => { release = resolve; });
    let intercepted;
    const captured = new Promise(resolve => { intercepted = resolve; });
    await page.route('**/api/run', async route => {
      intercepted(route.request().postDataJSON());
      await held;
      await route.continue();
    });
    await q.locator('.exc-submit').click();
    const payload = await captured;
    await q.locator('.exc-textarea').fill(changed);
    release();
    await q.locator('.exc-summary--ok').waitFor({timeout:15000});
    assert.equal(payload.code, code);
    assert.match(await q.locator('.exc-submitted-version').innerText(), /отправленной версии/);
    // Observe real committed storage rather than replacing Firebase with spies.
    await page.waitForFunction(async expected => {
      const exercise=(await DataLabStorage.read()).db.users.offline_user.exercises?.filter_positive_even;
      return exercise?.lastCode===expected && Object.values(exercise.attempts || {}).some(x=>x.code===expected);
    }, code);
    const stored = await page.evaluate(async () => (await DataLabStorage.read()).db.users.offline_user.exercises.filter_positive_even);
    assert.equal(stored.lastCode,code);
    assert.ok(Object.values(stored.attempts).some(x=>x.code===code));
    assert.equal(await q.locator('.exc-textarea').inputValue(), changed);
    await page.waitForFunction(async changed => (await DataLabStorage.getKV('exc-draft:offline_user:filter_positive_even'))===changed,changed);
    assert.equal(await page.evaluate(() => DataLabStorage.getKV('exc-draft:offline_user:filter_positive_even')), changed);
    await page.unroute('**/api/run');
    await page.route('**/api/run', route => route.fulfill({status:503, body:'synthetic outage'}));
    await q.locator('.exc-submit').click();
    await q.locator('.exc-status--err').waitFor();
    assert.match(await q.locator('.exc-status').innerText(), /503/);
    assert.match(await q.locator('.exc-results').innerText(), /synthetic outage/);
    console.log('PASS submitted-version race and server error');
  } finally { await context.close(); }
}

async function checkPages(browser, base) {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    let apiCalls = 0;
    await page.route('https://example.github.io/**', async route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/run') { apiCalls++; return route.abort(); }
      const response = await route.fetch({url: base + url.pathname + url.search});
      await route.fulfill({response});
    });
    const q = await exercise(page, 'https://example.github.io');
    await q.locator('.exc-submit').click();
    assert.match(await q.locator('.exc-status').innerText(), /недоступна на GitHub Pages/);
    assert.equal(apiCalls, 0);
    console.log('PASS GitHub Pages reports runner unavailable');
  } finally { await context.close(); }
}

(async () => {
  process.env.DATALAB_NO_BROWSER = '1';
  const server = startServer(0);
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const serverPath = path.resolve(__dirname, '../../server');
  const py = spawn('python', ['-u', '-c', `import sys; sys.path.insert(0, ${JSON.stringify(serverPath)}); import server; s=server.create_server(0); print(s.server_address[1], flush=True); s.serve_forever()`], {stdio:['ignore','pipe','pipe'], windowsHide:true});
  const lines = createInterface({input:py.stdout});
  let browser;
  try {
    const [port] = await once(lines, 'line');
    browser = await chromium.launch({headless:true, ...(process.env.DATALAB_CHROMIUM ? {executablePath:process.env.DATALAB_CHROMIUM} : {})});
    await checkServer(browser, base);
    await checkServer(browser, `http://127.0.0.1:${port}`);
    await checkRaceAndError(browser, base);
    await checkPages(browser, base);
  } finally {
    if (browser) await browser.close();
    lines.close(); py.kill();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
