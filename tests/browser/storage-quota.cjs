// Fresh ephemeral context and synthetic data only; no user profile is opened.
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
    browser = await chromium.launch({headless: true, ...(process.env.DATALAB_CHROMIUM ? {executablePath: process.env.DATALAB_CHROMIUM} : {})});
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(base + '/python/base.html');
    const q = page.locator('li.question').first();
    await q.locator('.name').click();
    await q.locator('.difficulty-progress-btn').waitFor();
    await page.waitForFunction(() => window.questionProgressTracker?.currentUser?.uid === 'offline_user');
    await page.waitForTimeout(1000);
    const wasCompleted = await q.evaluate(el => el.classList.contains('question-completed'));
    assert.equal(wasCompleted, false);
    await page.evaluate(() => {
      // v2 commits to IndexedDB; v1 localStorage is a retained recovery
      // snapshot. Fault the actual writer and keep every UI assertion below.
      const original = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function(...args) {
        if (this.name === 'records') throw new DOMException('Synthetic quota', 'QuotaExceededError');
        return original.apply(this, args);
      };
    });
    await q.locator('.difficulty-progress-btn').click();
    const notice = page.locator('#offline-storage-error');
    await notice.waitFor();
    assert.equal(await notice.isVisible(), true);
    await page.waitForFunction(() => !document.querySelector('li.question')?.classList.contains('question-completed'));
    const optimistic = await q.evaluate(el => el.classList.contains('question-completed'));
    assert.equal(optimistic, false);
    const info = {
      notice: await notice.innerText(),
      optimisticCompleted: optimistic,
      button: await q.locator('.difficulty-progress-btn').getAttribute('aria-label'),
    };
    await page.reload();
    await page.waitForFunction(() => window.questionProgressTracker?.currentUser?.uid === 'offline_user');
    await page.waitForTimeout(1000);
    info.completedAfterReload = await page.locator('li.question').first().evaluate(el => el.classList.contains('question-completed'));
    assert.equal(info.completedAfterReload, false);
    console.log(JSON.stringify(info));
    await context.close();
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {console.error(error); process.exitCode = 1;});
