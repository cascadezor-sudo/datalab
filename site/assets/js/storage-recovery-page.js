(function () {
  'use strict';
  var byId = function (id) { return document.getElementById(id); };
  var storage = window.DataLabStorage, recovery = window.DataLabRecovery;
  var plan = null, undoRecord = null, legacyPlan = null, fileGeneration = 0;
  function status(text) { byId('status').textContent = text; }
  function error(err) { status('Операция не выполнена: ' + (err && err.message || String(err))); }
  function download(text, filename) {
    var url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    var a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function syncButtons() {
    byId('restore').disabled = !plan || !byId('confirm').checked;
    byId('adopt').disabled = !legacyPlan || !byId('legacy-confirm').checked;
  }
  function busy(task) {
    return async function () {
      var buttons = Array.from(document.querySelectorAll('button'));
      var prior = buttons.map(function (b) { return b.disabled; });
      buttons.forEach(function (b) { b.disabled = true; });
      try { await task(); } catch (err) { error(err); }
      finally { buttons.forEach(function (b, i) { b.disabled = prior[i]; }); syncButtons(); byId('undo').disabled = !undoRecord; }
    };
  }
  if (!storage || !recovery) { error(new Error('Сервис хранения не загружен.')); return; }
  byId('export').onclick = busy(async function () {
    download(await recovery.exportCurrent(), 'datalab-backup-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json');
    status('Проверенная копия передана браузеру для скачивания. Проверьте сохранение файла.');
  });
  byId('file').onchange = async function () {
    var generation = ++fileGeneration;
    plan = null; byId('confirm').checked = false; syncButtons();
    byId('preview').textContent = 'Проверка файла…';
    try {
      var file = byId('file').files[0]; if (!file) return;
      if (file.size > recovery.MAX_BYTES) throw new Error('Файл превышает 20 МиБ.');
      var candidate = await recovery.preview(await file.text());
      if (generation !== fileGeneration) return;
      plan = candidate;
      var origin = window.location.origin;
      var output = ['Целостность SHA-256 подтверждена. Это не проверка автора файла.', 'Источник: ' + plan.backup.source.origin, 'Текущий origin: ' + origin, 'Ревизия предпросмотра: ' + plan.preview.expectedRevision, 'Изменений: ' + plan.preview.totalChanges + '; конфликтов/удалений: ' + plan.preview.conflicts];
      if (plan.preview.initializationOnly) output.push('МИГРАЦИЯ НЕ ЗАВЕРШЕНА: действующей DB нет. Будет создана DB из проверенной копии. Исходные raw-значения legacy сохраняются отдельно и не объединяются с файлом. Скачайте legacy-архив перед подтверждением. После commit страница перезагрузится.', 'Просмотренный legacy SHA-256: ' + plan.preview.expectedLegacyChecksum);
      if (origin !== plan.backup.source.origin) output.push('ВНИМАНИЕ: перенос между разными origin.');
      if (plan.preview.truncated) output.push('Показаны первые 250 изменений; остальные тоже будут применены. Для полного сравнения скачайте текущую копию и сравните файлы локально.');
      plan.preview.changes.forEach(function (change) { output.push(change.path + ': ' + change.action + (change.conflict ? ' — конфликт с текущим значением' : '')); });
      byId('preview').textContent = output.join('\n'); status('Файл проверен. Проверьте предпросмотр и подтвердите замену.');
    } catch (err) { if (generation === fileGeneration) { byId('preview').textContent = 'Файл не принят.'; error(err); } }
  };
  byId('confirm').onchange = syncButtons;
  byId('legacy-confirm').onchange = syncButtons;
  byId('restore').onclick = busy(async function () {
    if (!plan || !byId('confirm').checked) throw new Error('Нужны проверенный файл и подтверждение.');
    var result = await recovery.apply(plan);
    if (result.reloadRequired) { status('Восстановление подтверждено. Исходный legacy-архив сохранён. Перезагрузка страницы…'); window.location.reload(); return; }
    undoRecord = { id: result.recoveryId, revision: result.revision };
    plan = null; byId('confirm').checked = false;
    status('Восстановление подтверждено транзакцией. Предыдущее состояние сохранено.');
  });
  byId('undo').onclick = busy(async function () {
    if (!undoRecord) return;
    await storage.undoRestore(undoRecord.id, { expectedRevision: undoRecord.revision });
    undoRecord = null; status('Отмена подтверждена. Состояние перед отменой также сохранено.');
  });
  byId('refresh-history').onclick = busy(async function () {
    var records = await storage.listRecovery(); var list = byId('history'); list.replaceChildren();
    records.forEach(function (record) {
      var row = document.createElement('li');
      row.appendChild(document.createTextNode('Снимок ' + record.id + ' ' + (record.createdAt || '') + ' '));
      var button = document.createElement('button'); button.textContent = 'Скачать снимок';
      button.onclick = busy(async function () {
        var archived = await storage.getRecovery(record.id);
        var text;
        if (archived.snapshot) text = await recovery.encode(archived.snapshot);
        else if (archived.state) {
          var current = await storage.recoverySnapshot();
          text = await recovery.encode({ schemaVersion: 1, state: archived.state, legacy: { rawEntries: archived.rawEntries || current.legacy.rawEntries, checksum: archived.checksum || current.legacy.checksum } });
        } else text = await recovery.encodeArchive(archived);
        download(text, 'datalab-recovery-' + record.id + '.json');
        status(archived.state || archived.snapshot ? 'Снимок скачан.' : 'Скачан исходный legacy-архив с проверкой целостности. Это архив raw-значений для диагностики; обычный импорт его не принимает.');
      });
      row.appendChild(button); list.appendChild(row);
    });
    status('Сохранённых состояний: ' + records.length + '.');
  });
  byId('legacy-download').onclick = busy(async function () {
    if (!storage.currentLegacySnapshot) throw new Error('Текущий legacy-снимок недоступен в этой версии сервиса.');
    download(await recovery.encodeArchive(await storage.currentLegacySnapshot()), 'datalab-legacy-review.json');
    status('Текущие raw-значения legacy сохранены с SHA-256. Это отдельный архив для анализа, не обычный файл импорта. Для принятия этих значений используйте предпросмотр legacy.');
  });
  byId('legacy-preview').onclick = busy(async function () {
    legacyPlan = null; byId('legacy-confirm').checked = false;
    var candidate = await storage.previewLegacy();
    recovery.validateSnapshot(candidate.snapshot);
    var changes = candidate.migrationOnly ? { changes: [], totalChanges: 0, conflicts: 0, expectedRevision: null } : recovery.diff(await storage.recoverySnapshot(), candidate.snapshot);
    if (changes.expectedRevision !== candidate.expectedRevision) throw new Error('Состояние изменилось во время проверки. Повторите предпросмотр.');
    legacyPlan = candidate;
    byId('legacy-preview-text').textContent = ['Ревизия: ' + (candidate.migrationOnly ? 'новая миграция — действующей DB ещё нет' : candidate.expectedRevision), 'Контрольная сумма legacy: ' + candidate.legacyChecksum, candidate.migrationOnly ? 'Исправленные legacy-значения будут перенесены в новый источник истины. Исходный архив остаётся сохранённым. После подтверждения страница перезагрузится.' : 'Изменений: ' + changes.totalChanges + '; конфликтов/удалений: ' + changes.conflicts].concat(changes.truncated ? ['Показаны первые 250 изменений; остальные тоже будут применены.'] : []).concat(changes.changes.map(function (item) { return item.path + ': ' + item.action; })).join('\n');
    status('Legacy проверено. Перед принятием закройте старые вкладки, сохраните копию и прочитайте изменения.');
  });
  byId('adopt').onclick = busy(async function () {
    if (!legacyPlan || !byId('legacy-confirm').checked) throw new Error('Нужны предпросмотр legacy и подтверждение.');
    var result = await storage.adoptLegacy({ expectedRevision: legacyPlan.expectedRevision, expectedLegacyChecksum: legacyPlan.legacyChecksum });
    if (result.reloadRequired) { status('Миграция подтверждена. Перезагрузка страницы…'); window.location.reload(); return; }
    undoRecord = { id: result.recoveryId, revision: result.revision };
    legacyPlan = null;
    byId('legacy-confirm').checked = false;
    status('Принятие legacy подтверждено. Предыдущее состояние сохранено.');
  });
  storage.ready.then(function () {
    ['export', 'file', 'refresh-history', 'legacy-download', 'legacy-preview'].forEach(function (id) { byId(id).disabled = false; });
    status('Сервис готов. Все изменения подтверждаются после завершения транзакции.');
  }).catch(function (err) {
    // Initialization can fail after preserving a malformed legacy source. Make
    // its raw archive downloadable without inventing an empty/current DB.
    byId('legacy-download').disabled = false;
    byId('refresh-history').disabled = false;
    byId('legacy-preview').disabled = false;
    byId('file').disabled = false;
    error(err);
  });
})();
