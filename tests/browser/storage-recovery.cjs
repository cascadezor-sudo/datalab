// Real Chromium, fresh nonpersistent profile, synthetic local-only data.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { startServer } = require('../../server/server');
async function downloadedText(page, selector) {
  const event = page.waitForEvent('download');
  await page.locator(selector).first().click();
  const download = await event;
  const stream = await download.createReadStream();
  const parts = [];
  for await (const part of stream) parts.push(part);
  return Buffer.concat(parts).toString('utf8');
}
async function choose(page, text) {
  await page.locator('#file').setInputFiles({ name: 'synthetic.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await page.waitForFunction(() => document.querySelector('#preview').textContent.includes('SHA-256') || document.querySelector('#preview').textContent === 'Файл не принят.');
}
(async () => {
  process.env.DATALAB_NO_BROWSER = '1';
  const server = startServer(0);
  let browser;
  try {
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    const base = 'http://127.0.0.1:' + server.address().port;
    browser = await chromium.launch({ headless: true, ...(process.env.DATALAB_CHROMIUM ? { executablePath: process.env.DATALAB_CHROMIUM } : {}) });
    const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 390, height: 844 } });
    await context.addInitScript(() => {
      if (localStorage.getItem('__syntheticRecoverySeeded')) return;
      const db = { users: { offline_user: { uid: 'offline_user', progress: { syntheticOld: { completed: true, unknown: 'retained' } }, futureField: { nested: [1, 2, 3] } } }, datalab_migrations: { anonymous_progress_v1: true } };
      localStorage.setItem('datalab_offline_db', JSON.stringify(db));
      localStorage.setItem('anonymous_progress', '{"syntheticOld":{"completed":true}}');
      localStorage.setItem('datalab_anonymous_import_v1', 'true');
      localStorage.setItem('exc-draft:anon:synthetic', '');
      localStorage.setItem('datalab_nav_role_cache_v1', '{"role":"student"}');
      localStorage.setItem('staff-selected-student:anonymous', 'synthetic-student');
      localStorage.setItem('__syntheticRecoverySeeded', 'yes');
    });
    const page = await context.newPage();
    const uncaught = [];
    page.on('pageerror', error => uncaught.push(error.message));
    await page.goto(base + '/storage-recovery.html');
    await page.locator('#export').waitFor({ state: 'visible' });
    await page.waitForFunction(() => !document.querySelector('#export').disabled);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    const originalRaw = await page.evaluate(() => localStorage.getItem('datalab_offline_db'));
    const backupText = await downloadedText(page, '#export');
    const backup = JSON.parse(backupText);
    assert.equal(backup.snapshot.legacy.rawEntries.datalab_offline_db, originalRaw);
    assert.equal(backup.snapshot.state.kv['exc-draft:anon:synthetic'], '');
    assert.deepEqual(backup.snapshot.state.db.users.offline_user.futureField.nested, [1, 2, 3]);
    await page.evaluate(() => DataLabStorage.mutate(state => { state.db.newer = { retained: true }; }));
    await choose(page, backupText);
    assert.match(await page.locator('#preview').textContent(), /newer\/retained: delete/);
    await page.locator('#confirm').check();
    await page.locator('#restore').click();
    await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Восстановление подтверждено'));
    assert.equal(await page.evaluate(async () => (await DataLabStorage.read()).db.newer), undefined);
    await page.locator('#undo').click();
    await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Отмена подтверждена'));
    assert.deepEqual(await page.evaluate(async () => (await DataLabStorage.read()).db.newer), { retained: true });
    console.log('PASS: UI export, checksum preview, explicit replacement, atomic undo, unknown/raw preservation');

    // A write after preview invalidates it; there is no silent overwrite.
    await choose(page, backupText);
    await page.evaluate(() => DataLabStorage.mutate(state => { state.db.afterPreview = true; }));
    await page.locator('#confirm').check(); await page.locator('#restore').click();
    await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Операция не выполнена'));
    assert.equal(await page.evaluate(async () => (await DataLabStorage.read()).db.afterPreview), true);
    await choose(page, backupText);
    await page.locator('#confirm').check(); await page.locator('#restore').click();
    await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Восстановление подтверждено'));
    await page.evaluate(() => DataLabStorage.mutate(state => { state.db.afterImport = true; }));
    await page.locator('#undo').click();
    await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Операция не выполнена'));
    assert.equal(await page.evaluate(async () => (await DataLabStorage.read()).db.afterImport), true);
    console.log('PASS: stale preview and undo after newer write reject without losing newer data');

    const beforeCorruption = await page.evaluate(async () => (await DataLabStorage.read()).revision);
    await choose(page, backupText.replace('syntheticOld', 'syntheticBAD'));
    assert.equal(await page.locator('#preview').textContent(), 'Файл не принят.');
    assert.equal(await page.evaluate(async () => (await DataLabStorage.read()).revision), beforeCorruption);
    await page.locator('#refresh-history').click();
    await page.waitForFunction(() => document.querySelectorAll('#history li').length > 0);
    const rawArchive = await downloadedText(page, '#history li button');
    assert.ok(JSON.parse(rawArchive).integrity.digest);
    console.log('PASS: corrupted backup has zero writes; archived snapshots are user-downloadable');

    const oldTab = await context.newPage();
    await oldTab.goto(base + '/__synthetic_old_recovery_client__');
    await oldTab.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('datalab_offline_db'));
      db.users.offline_user.progress.fromOldClient = { completed: true };
      localStorage.setItem('datalab_offline_db', JSON.stringify(db));
    });
    const blocked = await page.evaluate(async () => {
      try { await DataLabStorage.mutate(s => { s.db.mustNotSave = true; }); return false; }
      catch (error) { return error.code === 'LEGACY_CLIENT_CONFLICT'; }
    });
    assert.equal(blocked, true);
    const legacyDownload = await downloadedText(page, '#legacy-download');
    assert.match(JSON.parse(legacyDownload).archive.rawEntries.datalab_offline_db, /fromOldClient/);
    await page.locator('#legacy-preview').click();
    await page.waitForFunction(() => document.querySelector('#legacy-preview-text').textContent.includes('Ревизия:'));
    await oldTab.close();
    await page.locator('#legacy-confirm').check(); await page.locator('#adopt').click();
    await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Принятие legacy подтверждено'));
    assert.equal(await page.evaluate(async () => (await DataLabStorage.read()).db.users.offline_user.progress.fromOldClient.completed), true);
    await page.reload();
    await page.waitForFunction(() => !document.querySelector('#export').disabled);
    assert.equal(await page.evaluate(async () => (await DataLabStorage.read()).db.users.offline_user.progress.fromOldClient.completed), true);
    assert.deepEqual(uncaught, []);
    console.log('PASS: incompatible old-client writes block; legacy download/preview/explicit adoption survive reload');
    await context.close();
    // Failed migration keeps its exact original raw, permits export and an
    // explicit checksum-reviewed retry after the source is repaired.
    const brokenContext = await browser.newContext({ acceptDownloads: true });
    await brokenContext.addInitScript(() => {
      if (localStorage.getItem('__syntheticBrokenSeeded')) return;
      localStorage.setItem('datalab_offline_db', '{broken original');
      localStorage.setItem('__syntheticBrokenSeeded', 'yes');
    });
    const broken = await brokenContext.newPage();
    await broken.goto(base + '/storage-recovery.html');
    await broken.waitForFunction(() => document.querySelector('#status').textContent.includes('Операция не выполнена'));
    assert.equal(await broken.locator('#export').isDisabled(), true);
    const malformedArchive = JSON.parse(await downloadedText(broken, '#legacy-download'));
    assert.equal(malformedArchive.archive.rawEntries.datalab_offline_db, '{broken original');
    await broken.evaluate(() => localStorage.setItem('datalab_offline_db', JSON.stringify({ users: { offline_user: { uid: 'offline_user', progress: { repairedSynthetic: true } } } })));
    await broken.locator('#legacy-preview').click();
    await broken.waitForFunction(() => document.querySelector('#legacy-preview-text').textContent.includes('новая миграция'));
    await broken.locator('#legacy-confirm').check(); await broken.locator('#adopt').click();
    await broken.waitForFunction(() => !document.querySelector('#export').disabled);
    assert.equal(await broken.evaluate(async () => (await DataLabStorage.read()).db.users.offline_user.progress.repairedSynthetic), true);
    assert.equal(await broken.evaluate(async () => (await DataLabStorage.getRecovery('legacy-original')).rawEntries.datalab_offline_db), '{broken original');
    const migratedContents = await broken.evaluate(async () => { const s = await DataLabStorage.read(); return { db: s.db, kv: s.kv }; });
    await broken.reload(); await broken.waitForFunction(() => !document.querySelector('#export').disabled);
    assert.deepEqual(await broken.evaluate(async () => { const s = await DataLabStorage.read(); return { db: s.db, kv: s.kv }; }), migratedContents);
    console.log('PASS: failed migration preserves original raw, offers download and explicit idempotent retry');
    await brokenContext.close();
    const restoreContext = await browser.newContext({ acceptDownloads: true });
    await restoreContext.addInitScript(() => {
      if (localStorage.getItem('__syntheticBootstrapSeeded')) return;
      localStorage.setItem('datalab_offline_db', '{malformed bootstrap original');
      localStorage.setItem('__syntheticBootstrapSeeded', 'yes');
    });
    const bootstrap = await restoreContext.newPage();
    await bootstrap.goto(base + '/storage-recovery.html');
    await bootstrap.waitForFunction(() => document.querySelector('#status').textContent.includes('Операция не выполнена'));
    await choose(bootstrap, backupText);
    assert.match(await bootstrap.locator('#preview').textContent(), /МИГРАЦИЯ НЕ ЗАВЕРШЕНА/);
    await bootstrap.locator('#confirm').check(); await bootstrap.locator('#restore').click();
    await bootstrap.waitForFunction(() => !document.querySelector('#export').disabled);
    assert.deepEqual(await bootstrap.evaluate(async () => (await DataLabStorage.read()).db.users.offline_user.futureField.nested), [1, 2, 3]);
    assert.equal(await bootstrap.evaluate(async () => (await DataLabStorage.getRecovery('legacy-original')).rawEntries.datalab_offline_db), '{malformed bootstrap original');
    assert.equal(await bootstrap.evaluate(() => localStorage.getItem('datalab_offline_db')), '{malformed bootstrap original');
    await bootstrap.reload(); await bootstrap.waitForFunction(() => !document.querySelector('#export').disabled);
    assert.equal(await bootstrap.evaluate(async () => (await DataLabStorage.read()).db.users.offline_user.progress.syntheticOld.completed), true);
    console.log('PASS: good backup restores after failed migration without manual legacy edits; original raw unchanged');
    await restoreContext.close();
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
