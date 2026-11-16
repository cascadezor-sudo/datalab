// Isolated synthetic state: two blank documents share one fresh browser context.
// The only app script is firebase-mock.js; no real profile or browser data is used.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { startServer } = require('../../server/server');

(async () => {
  process.env.DATALAB_NO_BROWSER = '1';
  const server = startServer(0);
  let browser;
  try {
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    const base = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ headless: true, ...(process.env.DATALAB_CHROMIUM ? { executablePath: process.env.DATALAB_CHROMIUM } : {}) });
    const context = await browser.newContext();
    const first = await context.newPage();
    const second = await context.newPage();
    // Initialise serially before the concurrent writes: the error page itself
    // contains no application scripts, then only the mock is injected.
    for (const page of [first, second]) {
      await page.goto(base + '/__phase1_storage_probe__');
      await page.addScriptTag({ url: base + '/assets/js/storage-service.js' });
      await page.addScriptTag({ url: base + '/assets/js/firebase-mock.js' });
      await page.evaluate(() => DataLabStorage.ready);
      assert.equal(await page.evaluate(() => !!window.firebase && !!navigator.locks), true);
    }
    await first.evaluate(() => firebase.database().ref('phase1Synthetic').set({ retained: 'yes' }));
    const writer = (page, prefix) => page.evaluate(async p => {
      for (let i = 0; i < 25; i++) await firebase.database().ref(`phase1Synthetic/${p}${i}`).set(i);
    }, prefix);
    await Promise.all([writer(first, 'a'), writer(second, 'b')]);
    // A newly opened blank document reads the synthetic origin's stored data;
    // no arbitrary sleep is used to mask or repair the race.
    const observer = await context.newPage();
    await observer.goto(base + '/__phase1_storage_probe__');
    await observer.addScriptTag({ url: base + '/assets/js/storage-service.js' });
    await observer.addScriptTag({ url: base + '/assets/js/firebase-mock.js' });
    await observer.evaluate(() => DataLabStorage.ready);
    // v2 is authoritative in IndexedDB. Reading the retained v1 rollback
    // snapshot would test a deliberately frozen backup rather than commits.
    const data = await observer.evaluate(async () => (await DataLabStorage.read()).db.phase1Synthetic);
    const missing = [];
    for (const prefix of ['a', 'b']) for (let i = 0; i < 25; i++) if (data[prefix + i] !== i) missing.push(prefix + i);
    console.log('All writes resolved; missing synthetic keys:', missing.length ? missing.join(', ') : 'none');
    assert.equal(data.retained, 'yes');
    assert.deepEqual(missing, [], 'cooperating writes lost data despite Web Locks');
    console.log('PASS: two isolated tabs preserve 50 writes and an unrelated field');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
