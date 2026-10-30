/**
 * Schmidt ML — Node.js резервный локальный сервер
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
const os = require('os');

const BASE_DIR = __dirname;
const SITE_DIR = fs.existsSync(path.join(BASE_DIR, 'site')) ? path.join(BASE_DIR, 'site') : BASE_DIR;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm'
};

function startServer(port = 8080) {
  const server = http.createServer((req, res) => {
    if (req.url === '/api/run' && req.method === 'POST') {
      if (req.headers.origin !== 'http://' + req.headers.host || req.headers['x-schmidtml-local'] !== '1') {
        res.writeHead(403); return res.end('Forbidden');
      }
      let body = '', length = 0;
      req.on('data', chunk => { length += chunk.length; if (length > 262144) req.destroy(); else body += chunk; });
      req.on('end', () => {
        let payload;
        try { payload = JSON.parse(body); if (typeof payload.code !== 'string' || typeof payload.tests !== 'string') throw Error('Invalid payload'); }
        catch { res.writeHead(400); return res.end('Invalid payload'); }
        const bundled = path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe');
        const python = fs.existsSync(bundled) ? bundled : 'python';
        const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'schmidtml-check-'));
        const child = spawn(python, ['-I', path.join(BASE_DIR, 'offline_runner.py')], { cwd: scratch, windowsHide: true });
        let stdout = '', done = false;
        const finish = data => {
          if (done) return; done = true; clearTimeout(timer);
          // Delete only the freshly created temporary working directory.
          fs.rmdir(scratch, () => {});
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
          res.end(JSON.stringify(data));
        };
        const timer = setTimeout(() => { child.kill(); finish({ tests: [], error: 'Превышено время выполнения (5 секунд). Проверьте циклы.' }); }, 5000);
        child.stdout.on('data', chunk => { stdout += chunk; if (stdout.length > 262144) { child.kill(); finish({tests:[], error:'Слишком большой вывод'}); } });
        child.stderr.resume();
        child.on('error', () => finish({ tests: [], error: 'Python не найден. Запустите сайт через Python или установите Python.' }));
        child.on('close', code => { if (!done) { try { if (code !== 0) throw Error(); finish(JSON.parse(stdout)); } catch { finish({tests:[], error:'Процесс Python завершился с ошибкой'}); } } });
        child.stdin.on('error', () => {}); child.stdin.end(JSON.stringify(payload));
      });
      return;
    }
    let reqUrl;
    try { reqUrl = decodeURI(req.url.split('?')[0]); } catch { res.writeHead(400); return res.end('Bad URL'); }
    if (reqUrl === '/' || reqUrl === '') reqUrl = '/main.html';
    
    let filePath = path.join(SITE_DIR, reqUrl);
    
    // Безопасность путей
    if (!filePath.startsWith(SITE_DIR)) {
      res.writeHead(403);
      return res.end('Forbidden');
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('404 Not Found');
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      res.writeHead(200, {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache'
      });

      fs.createReadStream(filePath).pipe(res);
    });
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      const url = 'http://localhost:8080/main.html';
      let expected;
      try { expected = fs.readFileSync(path.join(SITE_DIR, 'main.html')); }
      catch (error) { console.error(error.message); process.exitCode = 1; return; }
      const request = http.get(url, (response) => {
        const chunks = [];
        let length = 0;
        response.on('data', (chunk) => {
          length += chunk.length;
          if (length > expected.length) { request.destroy(new Error('Different service on port 8080')); return; }
          chunks.push(chunk);
        });
        response.on('end', () => {
          if (response.statusCode === 200 && Buffer.concat(chunks).equals(expected)) {
            console.log('SchmidtML already running: ' + url);
            if (process.env.SCHMIDTML_NO_BROWSER !== '1') exec('start "" "' + url + '"');
          } else {
            console.error('Port 8080 belongs to another service. Close it and restart. No switch to 8081.');
            process.exitCode = 1;
          }
        });
      });
      request.setTimeout(3000, () => request.destroy(new Error('Port 8080 did not respond')));
      request.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
    } else {
      console.error('[!] Ошибка сервера:', err);
    }
  });

  server.listen(port, '127.0.0.1', () => {
    const url = `http://localhost:${port}/main.html`;
    console.log('='.repeat(64));
    console.log('         DATALAB -- ЛОКАЛЬНАЯ АВТОНОМНАЯ БАЗА ЗНАНИЙ (Node.js)');
    console.log('='.repeat(64));
    console.log(` [✓] Сервер запущен : ${url}`);
    console.log(` [✓] Папка контента : ${SITE_DIR}`);
    console.log(' [✓] Открываем сайт в браузере...');
    console.log('='.repeat(64));
    console.log(' Для остановки закройте это окно или нажмите Ctrl + C.');
    console.log('='.repeat(64));

    if (process.env.SCHMIDTML_NO_BROWSER !== '1') exec(`start "" "${url}"`);
  });
}

startServer(8080);

