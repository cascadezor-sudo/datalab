# -*- coding: utf-8 -*-
"""
DataLab — Локальный многопоточный сервер базы знаний
Запускает сайт на localhost:8080 и открывает его в браузере.
"""

import os
import sys
import socket
import webbrowser
import threading
import urllib.request
import urllib.error
import json
import subprocess
import tempfile
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

SERVER_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SERVER_DIR)
SITE_DIR = os.path.join(PROJECT_ROOT, 'site')

class LocalHTTPServer(ThreadingHTTPServer):
    allow_reuse_address = False

class CustomHTTPHandler(SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path != '/api/run':
            self.send_error(404)
            return
        expected_origin = 'http://' + self.headers.get('Host', '')
        if self.headers.get('Origin') != expected_origin or self.headers.get('X-DataLab-Local') != '1':
            self.send_error(403)
            return
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 262144:
                self.send_error(413)
                return
            payload = json.loads(self.rfile.read(length))
            if not isinstance(payload.get('code'), str) or not isinstance(payload.get('tests'), str):
                self.send_error(400)
                return
            runner = os.path.join(SERVER_DIR, 'offline_runner.py')
            with tempfile.TemporaryDirectory(prefix='datalab-check-') as scratch:
                process = subprocess.run([sys.executable, '-I', runner], input=json.dumps(payload),
                    text=True, capture_output=True, timeout=5, cwd=scratch)
            data = json.loads(process.stdout) if process.returncode == 0 else {'tests': [], 'error': 'Процесс Python завершился с ошибкой'}
        except subprocess.TimeoutExpired:
            data = {'tests': [], 'error': 'Превышено время выполнения (5 секунд). Проверьте циклы.'}
        except (ValueError, OSError) as error:
            data = {'tests': [], 'error': str(error)}
        encoded = json.dumps(data, ensure_ascii=True).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def end_headers(self):
        # Отключаем агрессивный кэш браузера для локальной работы
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache, must-revalidate')
        super().end_headers()

    def log_message(self, format, *args):
        # Логируем только критические ошибки 4xx/5xx в консоль
        if len(args) > 1 and str(args[1]).startswith(('4', '5')):
            super().log_message(format, *args)

def find_free_port(start_port=8080, max_attempts=50):
    for port in range(start_port, start_port + max_attempts):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(('', port))
                return port
            except OSError:
                continue
    return start_port

def create_server(port=8080):
    handler = partial(CustomHTTPHandler, directory=SITE_DIR)
    return LocalHTTPServer(('127.0.0.1', port), handler)


def main():
    serve_dir = SITE_DIR
    port = 8080

    try:
        httpd = create_server(port)
    except OSError as e:
        # Reuse only this exact site's main page, never an unrelated service.
        url = "http://localhost:8080/main.html"
        try:
            with open(os.path.join(serve_dir, "main.html"), "rb") as source:
                expected = source.read()
            with urllib.request.urlopen(url, timeout=3) as response:
                actual = response.read(len(expected) + 1)
                matches = response.status == 200 and actual == expected
        except (OSError, urllib.error.URLError):
            matches = False
        if matches:
            print("DataLab already running: " + url, flush=True)
            if os.environ.get("DATALAB_NO_BROWSER") != "1":
                webbrowser.open(url)
            return
        print("Port 8080 is occupied or unavailable. Close the other server and restart. No switch to 8081: progress stays at localhost:8080.", flush=True)
        sys.exit(1)

    if hasattr(sys.stdout, 'reconfigure'):
        try:
            sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        except Exception:
            pass

    url = f"http://localhost:{port}/main.html"

    print("=" * 64, flush=True)
    print("         DATALAB -- ЛОКАЛЬНАЯ АВТОНОМНАЯ БАЗА ЗНАНИЙ", flush=True)
    print("=" * 64, flush=True)
    print(f" [OK] Сервер запущен : {url}", flush=True)
    print(f" [OK] Папка контента : {serve_dir}", flush=True)
    print(" [OK] Открываем сайт в браузере...", flush=True)
    print("=" * 64, flush=True)
    print(" Для остановки закройте это окно или нажмите Ctrl + C.", flush=True)
    print("=" * 64, flush=True)

    def open_browser():
        webbrowser.open(url)

    if os.environ.get("DATALAB_NO_BROWSER") != "1":
        threading.Timer(0.6, open_browser).start()

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[!] Сервер успешно остановлен.", flush=True)
        sys.exit(0)

if __name__ == '__main__':
    main()

