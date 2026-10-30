/**
 * Пауза и скорость для GIF в материалах.
 *
 * <img> GIF браузер остановить не умеет, поэтому по первому нажатию на кнопку
 * под картинкой (их рисует image-zoom.js) файл скачивается заново (из кэша),
 * разбирается здесь и дальше играет кадрами на <canvas>. Сам <img> остаётся в
 * figure скрытым: его берёт lightbox. Декодер свой, без зависимостей: WebCodecs
 * ImageDecoder есть не во всех браузерах, а canvas — везде. Кадры распаковываются
 * по одному в момент показа: в материалах есть GIF на 60 МБ, все кадры сразу
 * в памяти не поместятся.
 */
(function () {
  "use strict";

  const t =
    window.t ||
    ((text, params) =>
      text.replace(/\{(\w+)\}/g, (match, key) => params?.[key] ?? match));

  // Задержка кадра в мс. GIF хранит её в сотых секунды; 0 и 1 браузеры
  // показывают как 100 мс (иначе такие файлы мелькали бы), делаем так же.
  function frameDelay(delayCs, speed) {
    const ms = delayCs <= 1 ? 100 : delayCs * 10;
    return ms / speed;
  }

  function parseGif(bytes) {
    const sig = String.fromCharCode(...bytes.subarray(0, 6));
    if (sig !== "GIF87a" && sig !== "GIF89a") throw new Error("not a gif");
    const u16 = (p) => bytes[p] | (bytes[p + 1] << 8);
    const readPalette = (p, n) => bytes.subarray(p, p + 3 * n);
    const width = u16(6);
    const height = u16(8);
    let pos = 13;
    let globalPalette = null;
    if (bytes[10] & 0x80) {
      const n = 1 << ((bytes[10] & 7) + 1);
      globalPalette = readPalette(pos, n);
      pos += 3 * n;
    }
    const skipSubBlocks = () => {
      while (bytes[pos]) pos += bytes[pos] + 1;
      pos += 1;
    };
    const frames = [];
    let gce = { delay: 0, disposal: 0, transparent: -1 };
    while (pos < bytes.length) {
      const block = bytes[pos++];
      if (block === 0x3b) break;
      if (block === 0x21) {
        const label = bytes[pos++];
        if (label === 0xf9) {
          const packed = bytes[pos + 1];
          gce = {
            delay: u16(pos + 2),
            disposal: (packed >> 2) & 7,
            transparent: packed & 1 ? bytes[pos + 4] : -1,
          };
        }
        skipSubBlocks();
      } else if (block === 0x2c) {
        const packed = bytes[pos + 8];
        const frame = {
          x: u16(pos),
          y: u16(pos + 2),
          w: u16(pos + 4),
          h: u16(pos + 6),
          interlaced: Boolean(packed & 0x40),
          palette: globalPalette,
          ...gce,
        };
        pos += 9;
        if (packed & 0x80) {
          const n = 1 << ((packed & 7) + 1);
          frame.palette = readPalette(pos, n);
          pos += 3 * n;
        }
        frame.minCodeSize = bytes[pos++];
        const start = pos;
        skipSubBlocks();
        frame.blocks = bytes.subarray(start, pos);
        frames.push(frame);
        gce = { delay: 0, disposal: 0, transparent: -1 };
      } else {
        break; // битый хвост — играем то, что успели разобрать
      }
    }
    return { width, height, frames };
  }

  // LZW-распаковка индексов кадра (с deinterlace).
  function decodeIndices(frame) {
    const count = frame.w * frame.h;
    const out = new Uint8Array(count);
    const src = frame.blocks;
    const clear = 1 << frame.minCodeSize;
    const eoi = clear + 1;
    const prefix = new Int16Array(4096);
    const suffix = new Uint8Array(4096);
    const stack = new Uint8Array(4097);
    for (let i = 0; i < clear; i++) suffix[i] = i;
    let size = frame.minCodeSize + 1;
    let mask = (1 << size) - 1;
    let next = clear + 2;
    let old = -1;
    let first = 0;
    let datum = 0;
    let bits = 0;
    let op = 0;
    let blockLeft = 0;
    let p = 0;
    while (op < count) {
      while (bits < size) {
        if (blockLeft === 0) {
          blockLeft = src[p++];
          if (!blockLeft) return deinterlace(frame, out);
        }
        datum |= src[p++] << bits;
        bits += 8;
        blockLeft--;
      }
      let code = datum & mask;
      datum >>= size;
      bits -= size;
      if (code === clear) {
        size = frame.minCodeSize + 1;
        mask = (1 << size) - 1;
        next = clear + 2;
        old = -1;
        continue;
      }
      if (code === eoi) break;
      // Битый поток: код ещё не определён. Без этой проверки в таблицу попадает
      // prefix[n] >= n, цепочка ниже зацикливается и вкладка виснет.
      if (old === -1 ? code >= clear : code > next) break;
      if (old === -1) {
        out[op++] = suffix[code];
        old = first = code;
        continue;
      }
      const current = code;
      let sp = 0;
      if (code >= next) {
        stack[sp++] = first;
        code = old;
      }
      while (code >= clear) {
        stack[sp++] = suffix[code];
        code = prefix[code];
      }
      first = suffix[code];
      stack[sp++] = first;
      if (next < 4096) {
        prefix[next] = old;
        suffix[next] = first;
        next++;
        if ((next & mask) === 0 && next < 4096) {
          size++;
          mask = (1 << size) - 1;
        }
      }
      old = current;
      while (sp > 0 && op < count) out[op++] = stack[--sp];
    }
    return deinterlace(frame, out);
  }

  function deinterlace(frame, rows) {
    if (!frame.interlaced) return rows;
    const out = new Uint8Array(rows.length);
    let src = 0;
    for (const [start, step] of [
      [0, 8],
      [4, 8],
      [2, 4],
      [1, 2],
    ]) {
      for (let y = start; y < frame.h; y += step) {
        out.set(rows.subarray(src, src + frame.w), y * frame.w);
        src += frame.w;
      }
    }
    return out;
  }

  function forEachPixel(gif, frame, fn) {
    for (let y = 0; y < frame.h; y++) {
      const gy = frame.y + y;
      if (gy >= gif.height) break;
      for (let x = 0; x < frame.w; x++) {
        const gx = frame.x + x;
        if (gx >= gif.width) break;
        fn((gy * gif.width + gx) * 4, y * frame.w + x);
      }
    }
  }

  // Накладывает кадр index на RGBA-буфер с учётом disposal прошлого кадра.
  // state = { prev, saved } живёт между вызовами; index 0 начинает круг заново.
  function renderFrame(gif, index, rgba, state) {
    const frame = gif.frames[index];
    if (index === 0) {
      rgba.fill(0);
      state.prev = null;
    } else if (state.prev?.disposal === 2) {
      forEachPixel(gif, state.prev, (o) => rgba.fill(0, o, o + 4));
    } else if (state.prev?.disposal === 3 && state.saved) {
      rgba.set(state.saved);
    }
    state.saved = frame.disposal === 3 ? rgba.slice() : null;
    const indices = decodeIndices(frame);
    const pal = frame.palette;
    if (pal) {
      forEachPixel(gif, frame, (o, i) => {
        const c = indices[i];
        if (c === frame.transparent) return;
        rgba[o] = pal[c * 3];
        rgba[o + 1] = pal[c * 3 + 1];
        rgba[o + 2] = pal[c * 3 + 2];
        rgba[o + 3] = 255;
      });
    }
    state.prev = frame;
  }

  // ---------- Плеер ----------

  const players = new WeakMap();

  // Играть ли сейчас: ручная пауза главнее, а вне экрана и в фоновой вкладке
  // кадры не декодируются и не рисуются (автопауза кнопку не трогает).
  function shouldRun(player, hidden) {
    return player.playing && player.visible && !hidden;
  }

  // Единственное место, где запускается цепочка кадров: старый таймер всегда
  // снимается, поэтому быстрые переходы туда-обратно его не дублируют.
  function resume(player) {
    clearTimeout(player.timer);
    if (player.gif && shouldRun(player, document.hidden)) step(player);
  }

  // Один наблюдатель на все плееры и один слушатель вкладки; заводятся
  // с первым плеером.
  let viewport = null;

  function observe(canvas) {
    if (!viewport) {
      document.addEventListener("visibilitychange", () => {
        document
          .querySelectorAll("canvas.gif-player-canvas")
          .forEach((item) => {
            const player = players.get(item.parentElement);
            if (player) resume(player);
          });
      });
    }
    viewport ??= new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const player = players.get(entry.target.parentElement);
        if (!player || player.canvas !== entry.target) return;
        player.visible = entry.isIntersecting;
        resume(player);
      });
    });
    viewport.observe(canvas);
  }

  function createPlayer(figure) {
    const img = figure.querySelector(":scope > img");
    const controls = figure.querySelector(".gif-controls");
    const canvas = document.createElement("canvas");
    canvas.className = "gif-player-canvas";
    canvas.setAttribute("style", img.getAttribute("style") || "");
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", img.alt || "");
    const player = {
      playing: true,
      visible: true,
      speed: 1,
      gif: null,
      index: 0,
      timer: 0,
      canvas,
      controls,
    };

    // Пока файл качается и разбирается, держим на экране текущий кадр <img>.
    if (img.complete && img.naturalWidth) {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      try {
        canvas.getContext("2d").drawImage(img, 0, 0);
      } catch (error) {
        console.warn("[gif-player] snapshot failed:", error);
      }
    }

    player.ready = fetch(img.currentSrc || img.src)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.arrayBuffer();
      })
      .then((buffer) => {
        const gif = parseGif(new Uint8Array(buffer));
        if (gif.frames.length < 2) throw new Error("static gif");
        player.gif = gif;
        // Присвоение width/height стирает canvas, а на нём может лежать снимок
        // кадра, показанный по первой «Паузе»: размеры трогаем, только если
        // они другие.
        const hasSnapshot =
          canvas.width === gif.width && canvas.height === gif.height;
        if (!hasSnapshot) {
          canvas.width = gif.width;
          canvas.height = gif.height;
        }
        const ctx = canvas.getContext("2d");
        const image = ctx.createImageData(gif.width, gif.height);
        const state = {};
        player.draw = () => {
          renderFrame(gif, player.index, image.data, state);
          ctx.putImageData(image, 0, 0);
        };
        img.after(canvas);
        img.style.display = "none";
        if (shouldRun(player, document.hidden)) step(player);
        else if (!hasSnapshot) player.draw();
      })
      .catch((error) => player.fail(error));
    // Не вышло (сеть, битый файл, кадр не распаковался) — остаётся обычный
    // <img>, кнопки убираем.
    player.fail = (error) => {
      console.warn("[gif-player] fallback to <img>:", error);
      clearTimeout(player.timer);
      viewport?.unobserve(canvas);
      canvas.remove();
      img.style.display = "";
      controls?.remove();
      players.delete(figure);
    };
    observe(canvas);
    return player;
  }

  function step(player) {
    try {
      player.draw();
    } catch (error) {
      player.fail(error);
      return;
    }
    const delay = frameDelay(
      player.gif.frames[player.index].delay,
      player.speed,
    );
    player.timer = setTimeout(() => {
      player.index = (player.index + 1) % player.gif.frames.length;
      step(player);
    }, delay);
  }

  function syncControls(player) {
    const toggle = player.controls.querySelector("[data-gif-action='toggle']");
    toggle.setAttribute(
      "aria-label",
      player.playing ? t("Пауза") : t("Воспроизвести"),
    );
    toggle.dataset.state = player.playing ? "playing" : "paused";
    player.controls.querySelectorAll("[data-gif-speed]").forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        String(Number(button.dataset.gifSpeed) === player.speed),
      );
    });
  }

  // Точка входа из image-zoom.js: нажата кнопка в .gif-controls.
  function handle(button) {
    const figure = button.closest("figure");
    if (!figure || !figure.querySelector(":scope > img")) return;
    let player = players.get(figure);
    if (!player) {
      player = createPlayer(figure);
      players.set(figure, player);
      // Первое нажатие «Пауза» должно сразу остановить картинку, а не после
      // скачивания: снимок кадра уже на canvas, показываем его поверх <img>.
      if (button.dataset.gifAction === "toggle" && player.canvas.width) {
        const img = figure.querySelector(":scope > img");
        img.after(player.canvas);
        img.style.display = "none";
      }
    }
    if (button.dataset.gifAction === "toggle") {
      player.playing = !player.playing;
    } else if (button.dataset.gifSpeed) {
      player.speed = Number(button.dataset.gifSpeed);
      player.playing = true;
    }
    resume(player);
    syncControls(player);
  }

  window.gifPlayer = {
    handle,
    _private: { frameDelay, parseGif, decodeIndices, renderFrame, shouldRun },
  };
})();
