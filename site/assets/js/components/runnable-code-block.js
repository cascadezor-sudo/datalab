/**
 * Исполняемые блоки кода (Python) через Pyodide.
 * Для python-блоков .code-block добавляется кнопка «Запустить»; по клику код
 * выполняется в браузере (Python 3.12, Pyodide).
 *
 * Как устроено:
 *  - Pyodide живёт в Web Worker (собирается из строки через Blob, отдельный
 *    файл подключать не нужно). Страница не блокируется во время выполнения,
 *    а бесконечный цикл прерывается terminate() по таймауту — следующий
 *    запуск заводит воркер заново.
 *  - Воркер поднимается лениво: при наведении на кнопку или по клику.
 *    Неудачная загрузка не «залипает» — следующий клик пробует заново.
 *  - Пакеты (numpy, pandas, matplotlib…) подтягиваются по импортам самого
 *    сниппета, а не все сразу.
 *  - Пространство имён общее для всех сниппетов страницы, пока жив воркер:
 *    в теории есть блоки-продолжения, которые опираются на import выше.
 *  - stdout приходит построчно и показывается по мере выполнения.
 *  - В воркере нет prompt(), поэтому ответы на input() собираются заранее:
 *    по одному prompt() на каждый `input(` в тексте сниппета.
 *    ponytail: input() в цикле получит EOF после N ответов — хватает для
 *    демо в теории; настоящий диалог потребует SharedArrayBuffer и COOP/COEP.
 *  - Трейсбек показывается с первого кадра сниппета, без внутренностей Pyodide.
 */
(function () {
  // Перевод интерфейса (ядро — сниппет theme-boot). В тестах под Node его нет:
  // остаётся русский текст с подставленными значениями.
  const t =
    window.t ||
    ((text, params) =>
      text.replace(/\{(\w+)\}/g, (match, key) => params?.[key] ?? match));

  const PYODIDE_VERSION = "0.29.3";
  const PYODIDE_INDEX = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
  const PYODIDE_CDN = PYODIDE_INDEX + "pyodide.js";
  /** Отсчёт идёт после загрузки пакетов — сеть в лимит не входит. */
  const RUN_TIMEOUT_MS = 20000;
  /** Лимит на загрузку Pyodide и пакетов: зависший CDN не должен вешать очередь. */
  const LOAD_TIMEOUT_MS = 120000;
  const CDN_ERROR = t(
    "Не удалось загрузить Python (Pyodide) с CDN. Проверь сеть или блокировщик рекламы и попробуй ещё раз.",
  );

  /** Скрипт для перехвата plt.show() и выдачи картинки в JS */
  const MATPLOTLIB_PATCH = `
import io
import base64
try:
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    _orig_show = plt.show
    def _patched_show(*args, **kwargs):
        try:
            buf = io.BytesIO()
            plt.savefig(buf, format='png', bbox_inches='tight')
            buf.seek(0)
            b64 = base64.b64encode(buf.read()).decode('utf-8')
            receive_figure_b64(b64)
        finally:
            plt.close('all')
    plt.show = _patched_show
except Exception:
    pass
`;

  // Код воркера. Сообщения наружу: ready | boot-error | running | stdout |
  // stderr | figure | done | error. Сообщения внутрь: {id, code, stdin}.
  const WORKER_SOURCE = `
importScripts(${JSON.stringify(PYODIDE_CDN)});
const MATPLOTLIB_PATCH = ${JSON.stringify(MATPLOTLIB_PATCH)};
let pyodide = null;
let current = null; // id текущего запуска — метка на каждом сообщении
const post = (m) => self.postMessage({ id: current, ...m });
const ready = loadPyodide({ indexURL: ${JSON.stringify(PYODIDE_INDEX)} }).then((p) => {
  pyodide = p;
  pyodide.setStdout({ batched: (text) => post({ type: "stdout", text }) });
  pyodide.setStderr({ batched: (text) => post({ type: "stderr", text }) });
  post({ type: "ready" });
});
ready.catch((e) => post({ type: "boot-error", message: (e && e.message) || String(e) }));
self.onmessage = async ({ data }) => {
  const { id, code, stdin } = data;
  current = id;
  try {
    await ready;
    await pyodide.loadPackagesFromImports(code);
    post({ type: "running" });
    // Ответы на input() собраны заранее в главном потоке; дальше — EOF.
    pyodide.setStdin({ stdin: () => (stdin.length ? stdin.shift() + "\\n" : null) });
    pyodide.globals.set("receive_figure_b64", (b64) => post({ type: "figure", b64 }));
    await pyodide.runPythonAsync(MATPLOTLIB_PATCH);
    await pyodide.runPythonAsync(code);
    post({ type: "done" });
  } catch (e) {
    post({ type: "error", message: (e && e.message) || String(e) });
  }
};
`;

  let worker = null;
  let workerReady = false;
  let seq = 0;
  let queue = Promise.resolve();

  function getWorker() {
    if (worker) return worker;
    const url = URL.createObjectURL(
      new Blob([WORKER_SOURCE], { type: "text/javascript" }),
    );
    worker = new Worker(url);
    URL.revokeObjectURL(url);
    workerReady = false;
    worker.addEventListener("message", ({ data }) => {
      if (data.type === "ready") workerReady = true;
    });
    // Ошибка на старте (CDN недоступен): следующий клик заведёт воркер заново.
    worker.addEventListener("error", resetWorker);
    return worker;
  }

  function resetWorker() {
    if (worker) worker.terminate();
    worker = null;
    workerReady = false;
  }

  /** Выполняет сниппет в воркере; резолвится {out, err, error}. */
  function runInWorker(code, stdin, handlers) {
    return new Promise((resolve) => {
      const w = getWorker();
      const id = ++seq;
      let out = "";
      let err = "";
      let timer = null;

      const finish = (error) => {
        clearTimeout(timer);
        w.removeEventListener("message", onMessage);
        w.removeEventListener("error", onError);
        resolve({ out: out.trim(), err: err.trim(), error });
      };
      // Дедлайн: сначала на загрузку, после «running» — на выполнение.
      const arm = (ms, message) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          resetWorker();
          finish(message);
        }, ms);
      };
      const onError = (event) => {
        const wasReady = workerReady;
        resetWorker();
        finish(
          wasReady
            ? t(
                "Python аварийно завершился: {message}. Переменные из прошлых запусков сброшены.",
                { message: event.message || t("неизвестная ошибка") },
              )
            : CDN_ERROR,
        );
      };
      const onMessage = ({ data }) => {
        // Сообщения без id (ready, boot-error) общие; остальные — только свои.
        if (data.id != null && data.id !== id) return;
        switch (data.type) {
          case "boot-error":
            resetWorker();
            finish(`${CDN_ERROR}\n${data.message}`);
            break;
          case "running":
            handlers.onRunning();
            arm(
              RUN_TIMEOUT_MS,
              t(
                "Выполнение остановлено через {seconds} с: похоже, бесконечный цикл или слишком тяжёлые вычисления. Переменные из прошлых запусков сброшены.",
                { seconds: RUN_TIMEOUT_MS / 1000 },
              ),
            );
            break;
          case "stdout":
            out += data.text + "\n";
            handlers.onOutput(out);
            break;
          case "stderr":
            err += data.text + "\n";
            break;
          case "figure":
            showFigureModal(data.b64);
            break;
          case "done":
            finish("");
            break;
          case "error":
            if (!workerReady) resetWorker();
            finish(trimTraceback(data.message));
            break;
          default:
            break;
        }
      };

      w.addEventListener("message", onMessage);
      w.addEventListener("error", onError);
      arm(
        LOAD_TIMEOUT_MS,
        t("Python не загрузился за {seconds} с.", {
          seconds: LOAD_TIMEOUT_MS / 1000,
        }) +
          " " +
          CDN_ERROR,
      );
      w.postMessage({ id, code, stdin });
    });
  }

  /** По одному prompt() на каждый input( в сниппете — в воркере prompt() нет. */
  function collectStdin(code) {
    const calls = (code.match(/\binput\s*\(/g) || []).length;
    const lines = [];
    for (let i = 0; i < calls; i++) {
      const answer = window.prompt(
        t("Программа ждёт ввод (input), {n} из {total}:", {
          n: i + 1,
          total: calls,
        }),
      );
      if (answer === null) break;
      lines.push(answer);
    }
    return lines;
  }

  function getCodeFromBlock(block) {
    const codeText = block.querySelector(".code-text");
    if (codeText)
      return (codeText.innerText || codeText.textContent || "").trim();
    return (block.innerText || block.textContent || "").trim();
  }

  function isPythonBlock(block) {
    const dataLang = (
      block.closest(".code-block")?.getAttribute("data-lang") || ""
    ).toLowerCase();
    if (dataLang) return dataLang === "python" || dataLang === "py";
    const label = (
      block.querySelector(".code-language")?.textContent || ""
    ).toLowerCase();
    return label.includes("python");
  }

  function createOutputEl() {
    const el = document.createElement("div");
    el.className = "code-block-output";
    el.setAttribute("aria-live", "polite");
    return el;
  }

  function setOutput(outputEl, content, isError) {
    outputEl.innerHTML = "";
    outputEl.className =
      "code-block-output" + (isError ? " code-block-output--error" : "");
    const pre = document.createElement("pre");
    pre.textContent = content || (isError ? t("Ошибка выполнения") : "");
    outputEl.appendChild(pre);
    outputEl.style.display = content ? "block" : "none";
  }

  /** Обрезает кадры Pyodide: трейсбек начинается с первой строки сниппета. */
  function trimTraceback(message) {
    const text = String(message || "");
    const at = text.indexOf('  File "<exec>"');
    if (at === -1) return text.trim();
    return ("Traceback (most recent call last):\n" + text.slice(at)).trim();
  }

  /** Модалка с графиком matplotlib; закрывается по клику */
  let figureModalEl = null;
  function ensureFigureModal() {
    if (figureModalEl) return figureModalEl;
    figureModalEl = document.createElement("div");
    figureModalEl.className = "code-block-figure-modal";
    figureModalEl.innerHTML = `<div class="code-block-figure-modal__backdrop"><img class="code-block-figure-modal__img" alt="${t("График")}" /></div>`;
    figureModalEl.style.display = "none";
    document.body.appendChild(figureModalEl);
    figureModalEl.addEventListener("click", () => {
      figureModalEl.style.display = "none";
    });
    return figureModalEl;
  }
  function showFigureModal(base64Png) {
    const modal = ensureFigureModal();
    const img = modal.querySelector(".code-block-figure-modal__img");
    img.src = "data:image/png;base64," + base64Png;
    modal.style.display = "flex";
  }

  function attachRunButton(container) {
    const codeBlock = container.closest(".code-block");
    if (!codeBlock) return;
    const actions = container.querySelector(".code-actions");
    if (!actions || actions.querySelector(".run-code-btn")) return;
    if (!isPythonBlock(container)) return;

    const code = getCodeFromBlock(container);
    if (!code) return;

    const runBtn = document.createElement("button");
    runBtn.type = "button";
    runBtn.className = "code-action-btn run-code-btn";
    runBtn.title = t("Запустить код (Python 3.12 в браузере)");
    runBtn.textContent = t("Запустить");

    const outputEl =
      codeBlock.querySelector(".code-block-output") || createOutputEl();
    if (!codeBlock.contains(outputEl)) codeBlock.appendChild(outputEl);

    // Прогрев: Python начинает грузиться, пока ученик ещё только тянется к
    // кнопке. Без once — после terminate() воркер нужно поднимать заново.
    runBtn.addEventListener("pointerenter", () => getWorker());

    runBtn.addEventListener("click", () => {
      const prevLabel = runBtn.textContent;
      runBtn.textContent = t("В очереди…");
      runBtn.disabled = true;
      setOutput(outputEl, "", false);
      const stdin = collectStdin(code);

      // Потоковый вывод рисуем не чаще кадра: 50 000 print() иначе
      // перестраивали бы <pre> 50 000 раз.
      let pending = "";
      let frame = 0;
      const onOutput = (out) => {
        pending = out;
        if (frame) return;
        frame = requestAnimationFrame(() => {
          frame = 0;
          setOutput(outputEl, pending, false);
        });
      };

      // Один сниппет за раз: воркер не умеет выполнять два кода параллельно.
      queue = queue
        .then(() => {
          runBtn.textContent = workerReady
            ? t("Запуск…")
            : t("Загрузка Python…");
          return runInWorker(code, stdin, {
            onRunning: () => {
              runBtn.textContent = t("Выполняется…");
            },
            onOutput,
          });
        })
        .then(({ out, err, error }) => {
          cancelAnimationFrame(frame);
          frame = 0;
          if (error) console.error("[runnable-code-block]", error);
          const combined = [out, err, error].filter(Boolean).join("\n");
          setOutput(outputEl, combined || t("(вывод пуст)"), !!(err || error));
        })
        .catch((e) => {
          // Например, Worker запрещён CSP: очередь должна жить дальше.
          console.error("[runnable-code-block]", e);
          setOutput(outputEl, trimTraceback(e.message || String(e)), true);
        })
        .finally(() => {
          runBtn.textContent = prevLabel;
          runBtn.disabled = false;
        });
    });

    actions.appendChild(runBtn);
  }

  function initRunnableBlocks() {
    document
      .querySelectorAll(".code-block .code-container")
      .forEach(attachRunButton);
  }

  function onDomReady() {
    setTimeout(initRunnableBlocks, 400);
    const observer = new MutationObserver(() => {
      setTimeout(initRunnableBlocks, 350);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onDomReady);
  } else {
    onDomReady();
  }

  window.runnableCodeBlock = { WORKER_SOURCE, RUN_TIMEOUT_MS, LOAD_TIMEOUT_MS };
})();
