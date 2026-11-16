// Run with NODE_PATH pointing at an isolated Playwright installation and
// DATALAB_CHROMIUM pointing at its compatible Chromium executable.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { startServer } = require('../../server/server.js');
(async () => {
  process.env.DATALAB_NO_BROWSER = '1';
  const server = startServer(0);
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.DATALAB_CHROMIUM ? { executablePath: process.env.DATALAB_CHROMIUM } : {}) });
    for (const width of [320, 375, 390, 768, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      for (const route of ['/main.html', '/python/base.html', '/math/algebra.html', '/spaced-repetition.html', '/roadmap/index.html', '/profile.html']) {
        const response = await page.goto(base + route, { waitUntil: 'domcontentloaded' });
        assert.equal(response.status(), 200, `${width} ${route}`);
        await page.waitForTimeout(600);
        assert.ok((await page.title()).length, `${width} ${route} title`);
      }
      await page.goto(base + '/main.html', { waitUntil: 'domcontentloaded' });
      if (width < 768) {
        const menu = page.locator('.mobile-menu-btn');
        await menu.click();
        assert.equal(await page.locator('.nav-links').evaluate(el => el.classList.contains('show')), true, `${width} mobile menu`);
      }
      assert.deepEqual(errors, [], width + ' uncaught page errors');
      console.log(JSON.stringify({ width, status: 'passed', pageErrors: errors }));
      await context.close();
    }
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });



