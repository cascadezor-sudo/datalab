const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const { once } = require('node:events');
const { readFileSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createInterface } = require('node:readline');
const test = require('node:test');

const projectRoot = path.resolve(__dirname, '../..');
const serverDir = path.join(projectRoot, 'server');
const siteRoot = path.join(projectRoot, 'site');
const python = [
  { command: 'python', args: [] },
  { command: 'py', args: ['-3'] },
].find(({ command, args }) => spawnSync(command, [...args, '--version'], { windowsHide: true }).status === 0);

async function verifyServer(origin) {
  for (const page of ['/main.html', '/python/base.html', '/assets/js/init-page.js']) {
    const response = await fetch(origin + page, { signal: AbortSignal.timeout(5000) });
    assert.equal(response.status, 200, page);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), readFileSync(path.join(siteRoot, page)));
  }
  const forbidden = await fetch(origin + '/api/run', { method: 'POST', body: '{}' });
  assert.equal(forbidden.status, 403);
  const response = await fetch(origin + '/api/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin, 'X-DataLab-Local': '1' },
    body: JSON.stringify({ code: 'answer = 6 * 7', tests: 'assert answer == 42, "runner found"' }),
    signal: AbortSignal.timeout(10000),
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.error, null);
  assert.deepEqual(result.tests, [{ label: 'runner found', passed: true }]);
}

for (const runtime of ['Python', 'Node.js']) {
  test(`${runtime} server finds site and exercise runner when launched outside the project`, { timeout: 20000 }, async (t) => {
    if (!python) return t.skip('Python 3 is required for exercise runner checks');
    const code = runtime === 'Python'
      ? `import sys; sys.path.insert(0, ${JSON.stringify(serverDir)}); import server; httpd = server.create_server(0); print('TEST_PORT=' + str(httpd.server_address[1]), flush=True); httpd.serve_forever()`
      : `const {startServer} = require(${JSON.stringify(path.join(serverDir, 'server.js'))}); const server = startServer(0); server.on('listening', () => console.log('TEST_PORT=' + server.address().port));`;
    const command = runtime === 'Python' ? python.command : process.execPath;
    const args = runtime === 'Python' ? [...python.args, '-c', code] : ['-e', code];
    const child = spawn(command, args, {
      cwd: os.tmpdir(), windowsHide: true,
      env: { ...process.env, DATALAB_NO_BROWSER: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const lines = createInterface({ input: child.stdout });
    let stderr = '';
    child.stderr.on('data', chunk => { stderr += chunk; });
    const closed = once(child, 'close');
    t.after(async () => {
      lines.close();
      if (child.exitCode === null && child.signalCode === null) child.kill();
      await closed;
    });
    const port = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Server startup timed out: ' + stderr)), 5000);
      lines.on('line', line => {
        if (line.startsWith('TEST_PORT=')) { clearTimeout(timer); resolve(Number(line.split('=')[1])); }
      });
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', () => { clearTimeout(timer); reject(new Error('Server exited: ' + stderr)); });
    });
    await verifyServer(`http://127.0.0.1:${port}`);
  });
}
