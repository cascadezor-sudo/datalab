/* Local-only backup envelope. No uploads, user sessions, or browser credentials. */
(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DataLabRecovery = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';
  var MAX_BYTES = 20 * 1024 * 1024;
  var FORMAT = 'datalab-local-backup';
  var sourceBase = root.document && root.document.currentScript && root.document.currentScript.src ? new URL('../../', root.document.currentScript.src).pathname : '/';
  var forbidden = new Set(['__proto__', 'constructor', 'prototype']);
  var secretKey = /^(?:password|passwd|secret|client[_-]?secret|credentials?|auth[_-]?(?:token|user)|session|session[_-]?id|access[_-]?token|refresh[_-]?token|api[_-]?key|authorization|private[_-]?key)$/i;
  var knownSecret = /(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|Bearer\s+[A-Za-z0-9_.-]{20,})/;
  function fail(message) { throw new Error(message); }
  function object(value) { return value && typeof value === 'object' && !Array.isArray(value); }
  function allowedKey(key) {
    return /^(?:.+_offline_db|anonymous_progress|datalab_anonymous_import_v1|page_completion_.+|exc-draft:.+|math-answer:.+|course-roadmap-demo-state|theme|palette|lang|start_diagnostic_(?:result|progress)|main-daily-goal:.+|staff-selected-student:.+|datalab_nav_role_cache_v1|datalab_nav_learning_format_v1|introShown|questionsTocCollapsed|dictionaryTocCollapsed|newsPanelState|lastFactDate|dailyFactSeen)$/.test(key);
  }
  function inspect(value, depth, counter) {
    if (depth > 64 || ++counter.count > 200000) fail('Слишком сложная структура резервной копии.');
    counter.characters = (counter.characters || 0) + (typeof value === 'string' ? value.length : 0);
    if (counter.characters > MAX_BYTES) fail('Размер копии превышает 20 МиБ.');
    if (value === null || typeof value === 'boolean') return;
    if (typeof value === 'number') { if (!Number.isFinite(value)) fail('Недопустимое число.'); return; }
    if (typeof value === 'string') {
      if (value.length > MAX_BYTES || knownSecret.test(value)) fail('Копия содержит возможный секрет или слишком длинную строку. Экспорт остановлен.');
      return;
    }
    if (typeof value !== 'object') fail('Допустимы только JSON-данные.');
    if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) fail('Недопустимый объект.');
    Object.keys(value).forEach(function (key) {
      if (forbidden.has(key)) fail('Недопустимый служебный ключ.');
      if (secretKey.test(key) && value[key] !== null && value[key] !== '') fail('Найдена потенциально секретная ветвь. Копия заблокирована без скрытого удаления данных.');
      inspect(value[key], depth + 1, counter);
    });
  }
  function canonical(value) {
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(function (key) { return JSON.stringify(key) + ':' + canonical(value[key]); }).join(',') + '}';
    return JSON.stringify(value);
  }
  function bytes(text) { return new TextEncoder().encode(text); }
  async function digest(value) {
    if (!root.crypto || !root.crypto.subtle) fail('SHA-256 недоступен. Откройте сайт через HTTPS или localhost.');
    var hashed = await root.crypto.subtle.digest('SHA-256', bytes(canonical(value)));
    return Array.from(new Uint8Array(hashed), function (n) { return n.toString(16).padStart(2, '0'); }).join('');
  }
  function validateSnapshot(snapshot) {
    inspect(snapshot, 0, { count: 0 });
    if (!object(snapshot) || snapshot.schemaVersion !== 1 || !object(snapshot.state) || !object(snapshot.state.db) || !object(snapshot.state.db.users) || !object(snapshot.state.db.users.offline_user) || !object(snapshot.state.kv) || !Number.isSafeInteger(snapshot.state.revision) || snapshot.state.revision < 0) fail('Неподдерживаемая схема состояния.');
    Object.entries(snapshot.state.kv).forEach(function (entry) {
      if (!allowedKey(entry[0]) || typeof entry[1] !== 'string') fail('Недопустимый ключ или значение KV: ' + entry[0]);
      inspectRaw(entry[1]);
    });
    if (!object(snapshot.legacy) || !object(snapshot.legacy.rawEntries)) fail('Отсутствует архив исходных legacy-ключей.');
    Object.entries(snapshot.legacy.rawEntries).forEach(function (entry) {
      if (!allowedKey(entry[0]) || typeof entry[1] !== 'string') fail('Недопустимый legacy-ключ.');
      inspectRaw(entry[1]);
    });
    if (bytes(canonical(snapshot)).length > MAX_BYTES) fail('Размер копии превышает 20 МиБ.');
    return snapshot;
  }
  function inspectRaw(raw) {
    if (knownSecret.test(raw)) fail('В строковых данных найден возможный секрет.');
    var parsed;
    try { parsed = JSON.parse(raw); } catch (_) { return; }
    inspect(parsed, 0, { count: 0 });
  }
  async function encode(snapshot, source) {
    validateSnapshot(snapshot);
    var payload = { format: FORMAT, version: 1, createdAt: new Date().toISOString(), source: source || { origin: root.location ? root.location.origin : 'synthetic', basePath: sourceBase }, snapshot: snapshot };
    inspect(payload, 0, { count: 0 });
    var result = Object.assign({}, payload, { integrity: { algorithm: 'SHA-256', canonicalization: 'sorted-json-v1', digest: await digest(payload) } });
    var text = JSON.stringify(result, null, 2);
    if (bytes(text).length > MAX_BYTES) fail('Размер копии превышает 20 МиБ.');
    return text;
  }
  async function decode(text) {
    if (typeof text !== 'string' || bytes(text).length > MAX_BYTES) fail('Файл слишком большой. Максимум 20 МиБ.');
    var data;
    try { data = JSON.parse(text); } catch (_) { fail('Файл не является корректным JSON.'); }
    inspect(data, 0, { count: 0 });
    if (!object(data) || data.format !== FORMAT || data.version !== 1) fail('Неподдерживаемый формат или версия копии.');
    if (!object(data.source) || typeof data.source.origin !== 'string' || typeof data.source.basePath !== 'string' || typeof data.createdAt !== 'string') fail('Повреждены сведения об источнике.');
    if (!object(data.integrity) || data.integrity.algorithm !== 'SHA-256' || data.integrity.canonicalization !== 'sorted-json-v1' || !/^[a-f0-9]{64}$/.test(data.integrity.digest || '')) fail('Не поддерживается проверка целостности.');
    var payload = Object.assign({}, data); delete payload.integrity;
    if (await digest(payload) !== data.integrity.digest) fail('Контрольная сумма не совпадает. Данные не применены.');
    validateSnapshot(data.snapshot);
    return data;
  }
  function diff(current, incoming) {
    var changes = [], totalChanges = 0, conflicts = 0, MAX_PREVIEW = 250;
    var own = function (value, key) { return Object.prototype.hasOwnProperty.call(value, key); };
    function add(area, path, beforePresent, afterPresent) {
      totalChanges++; if (beforePresent) conflicts++;
      if (changes.length < MAX_PREVIEW) changes.push({ area: area, key: path[path.length - 1], path: area + '/' + path.join('/'), action: !afterPresent ? 'delete' : !beforePresent ? 'add' : 'replace', conflict: beforePresent });
    }
    function visit(area, path, before, after, beforePresent, afterPresent) {
      if (beforePresent && afterPresent && canonical(before) === canonical(after)) return;
      var beforeContainer = before !== null && typeof before === 'object';
      var afterContainer = after !== null && typeof after === 'object';
      if ((!beforePresent || beforeContainer) && (!afterPresent || afterContainer) && (!beforePresent || !afterPresent || Array.isArray(before) === Array.isArray(after))) {
        var keys = Array.from(new Set((beforePresent ? Object.keys(before) : []).concat(afterPresent ? Object.keys(after) : []))).sort();
        if (keys.length) {
          keys.forEach(function (key) {
            var had = beforePresent && own(before, key), has = afterPresent && own(after, key);
            visit(area, path.concat(key), had ? before[key] : undefined, has ? after[key] : undefined, had, has);
          });
          return;
        }
      }
      add(area, path, beforePresent, afterPresent);
    }
    ['db', 'kv'].forEach(function (area) {
      var before = current.state[area], after = incoming.state[area];
      Array.from(new Set(Object.keys(before).concat(Object.keys(after)))).sort().forEach(function (key) {
        visit(area, [key], before[key], after[key], own(before,key), own(after,key));
      });
    });
    return { expectedRevision: current.state.revision, changes: changes, totalChanges: totalChanges, truncated: totalChanges > MAX_PREVIEW, conflicts: conflicts };
  }
  function service() { if (!root.DataLabStorage) fail('Сервис хранения не загружен.'); return root.DataLabStorage; }
  async function exportCurrent() { var storage = service(); await storage.ready; return encode(await storage.recoverySnapshot()); }
  async function preview(text) {
    var backup = await decode(text), storage = service(), current;
    try { await storage.ready; current = await storage.recoverySnapshot(); }
    catch (err) {
      if (!storage.recoveryStatus) throw err;
      var target = await storage.recoveryStatus();
      if (target.hasState) throw err;
      var initialPreview = diff({ state: { db: {}, kv: {}, revision: 0 } }, backup.snapshot);
      initialPreview.expectedRevision = null;
      initialPreview.expectedLegacyChecksum = target.currentLegacyChecksum;
      initialPreview.initializationOnly = true;
      return { backup: backup, preview: initialPreview };
    }
    return { backup: backup, preview: diff(current, backup.snapshot) };
  }
  async function apply(plan) {
    var checked = await decode(JSON.stringify(plan.backup));
    if (plan.preview.initializationOnly) return service().bootstrapRestore(checked.snapshot, { expectedRevision: null, expectedLegacyChecksum: plan.preview.expectedLegacyChecksum });
    return service().restore(checked.snapshot, { expectedRevision: plan.preview.expectedRevision });
  }
  async function encodeArchive(record) {
    inspect(record, 0, { count: 0 });
    if (!object(record.rawEntries)) fail('Архив legacy не содержит rawEntries.');
    Object.entries(record.rawEntries).forEach(function (entry) {
      if (!allowedKey(entry[0]) || typeof entry[1] !== 'string') fail('Недопустимый legacy-ключ.');
      inspectRaw(entry[1]);
    });
    var payload = { format: 'datalab-legacy-archive', version: 1, createdAt: new Date().toISOString(), archive: record };
    var result = Object.assign({}, payload, { integrity: { algorithm: 'SHA-256', canonicalization: 'sorted-json-v1', digest: await digest(payload) } });
    var text = JSON.stringify(result, null, 2);
    if (bytes(text).length > MAX_BYTES) fail('Размер копии превышает 20 МиБ.');
    return text;
  }
  return { MAX_BYTES: MAX_BYTES, encode: encode, encodeArchive: encodeArchive, decode: decode, validateSnapshot: validateSnapshot, diff: diff, exportCurrent: exportCurrent, preview: preview, apply: apply, canonical: canonical, allowedKey: allowedKey };
});
