# DataLab — отчёт Фазы 3

Дата: 16 ноября 2026. Content Architecture Stabilization & Integrity.

## Итог и статус

**Техническое ядро Фазы 3 завершено:** существующий offline-каталог стабилизирован, предупреждения классифицированы, подтверждённые ошибки extraction/validation исправлены, совместимость идентификаторов и маршрутов проверяется автоматически. Production-интеграция не выполнялась. Наличие остаточных неоднозначностей не выдаётся за готовую семантическую миграцию.

Финально: **408 источников, 26955 активных объектов, 54182 связи, 0 integrity errors, 608 source warnings**. Сохраняются **9964 неоднозначные строки mapping: 9371 global и 593 scoped**. Никакой автоматический merge, перенос реального прогресса или отзыв достижений не выполнялся.

Сайт, CSS, HTML, URL, runtime-код, IndexedDB и ключи прогресса не менялись. Astro/React/UI-библиотеки не устанавливались. Commit, staging, push и публикация не выполнялись. Работа остановлена на Фазе 3; Фаза 4 не начата.

## Исходное состояние и сохранность

Ветка до/после: `refactor/phase-0-baseline`. HEAD: `95682d2e3aedaa4d0fa70ce009b899f68fba2cdd`. В дереве уже находились незакоммиченные результаты предыдущих фаз и пользовательские изменения. Они не сбрасывались и не заменялись checkout/reset. Изучены отчёты 0/1/1.1/2, domain/content/storage/frontend contracts и фактические JSON; исторические цифры перепроверены.

До начала зафиксированы SHA-256 файлов рабочего дерева и агрегат всех **1859 файлов `site/`**. Финальный агрегат совпадает:

`3cf8b37968351b5c9bb9cd4a19644e70dd53d150e9ee42d0826ca1dd83f27366`

`site/profile.html` и `LEARNING_PROGRESS.md` также совпадают побайтово с исходным состоянием. Старые источники не удалены. Изменены только инструменты/тесты/схемы/каталог и связанные документы. Старые фазовые отчёты сохранены как исторические; актуальные content contracts обновлены. Перед `--write` изучены функции extraction и публикации: они записывают только три generated JSON вне `site/`.

Реальные профили браузера, localStorage/IndexedDB пользователя и аккаунты не открывались. Все browser-проверки используют новые непостоянные контексты и synthetic данные.

## Повторный аудит: до и после

| Показатель | Перепроверенный вход Фазы 3 | После |
|---|---:|---:|
| HTML документов | 190 | 190 |
| DOM ID/named-anchor occurrences | 2693 | 2693 |
| Всего источников | 408: 190 HTML + 214 JSON + 4 JS | 408 |
| Активных entities | 26955 | 26955 |
| Retired bindings | 10505 | 10505 |
| Наблюдаемых связей | 54181 | 54182 |
| Mapping rows | 53682 | 53682 |
| Resolved observations | 43718 | 43718 |
| Ambiguous observations | 9964 | 9964 |
| EN quiz unresolved | 2 | 0 |
| Snapshot/config conflicts | 2 | 2 |
| Scoped duplicate identifiers | 593 | 593 |
| Equal normalized quiz prompts | 13 групп | 13 групп |
| Source warnings | 610 | 608 |
| Integrity errors | 0 по прежнему валидатору | 0 после усиления валидатора |

Исторические 189 HTML из Фазы 0 не перенесены в новый отчёт: текущий физический инвентарь содержит 190, включая recovery page. Число 9371 относится только к глобальным aliases и не является числом сломанных тем или пользователей.

Все 10505 retired UUID сохранены. Это исходная история уточнения экстрактора Фазы 2, ошибочно выделявшего вложенные category.id карточек; она не означает 10505 удалённых учебных материалов. У этих старых tombstones нет записанных legacy aliases. Для реального удаления материала с известными aliases новый механизм отдельно сохраняет orphaned observations, что подтверждено синтетикой.

## Классификация всех предупреждений

[content-issues.md](content-issues.md) объясняет причины, влияние, возможность исправления и риск. Машинный журнал `content/prototype/content-issues.json` содержит **10590 записей**: каждый из 608 актуальных warning, каждую из 9964 ambiguous mapping rows и каждое из 18 route findings. В каждой записи сохранены raw evidence, источники, затронутые объекты/контейнеры, причина, functional impact, safe fixability и risk. Повторы одного route finding в разных deployment modes не схлопываются.

| Категория журнала | Записей | Интерпретация |
|---|---:|---|
| confirmed_error | 18 | Исходные статические route/resource findings |
| ambiguous_data | 9975 | 9964 aliases + 8 scoped card aliases + 1 card-block alias + 2 snapshot conflicts |
| duplicate_data | 13 | Одинаковый prompt не доказывает одинаковые code/options/answers |
| acceptable_legacy | 584 | 564 question-index + 20 roadmap-track повторов в разных контекстах |
| obsolete_data | 0 | Возраст/устаревание двух используемых snapshot не доказаны |
| validator_false_positive, актуальные | 0 | Два исторических EN случая исправлены и описаны отдельно |

Все 610 исходных warning учтены: 608 остаются, два EN false positives исправлены на основании runtime-кода. Целью не было механически обнулить предупреждения. Неизвестные новые коды не исчезают из классификатора. Issue ID зависит от evidence и номера точного повторения, поэтому несвязанная новая находка не перенумеровывает прежние issue IDs.

Data cards содержат 5638 occurrences/5628 уникальных ID, config cards — 4867/4857. Разный runtime-приоритет источника не доказывает устаревание или эквивалентность версии. Config cards остаются fallback для achievement API; обе версии и все повторы сохранены.

## Исправленные ошибки

1. **EN quiz associations.** Прежняя эвристика требовала отдельную `.en.json` Quiz identity. Фактически `quiz.js::loadQuizRegistry` загружает base registry с EN overlay, а `fetchQuizFile` пытается перевод и возвращается к base definition. Теперь страницы `en/python/base.html` и `en/ai/ml/classic.html` получают `offers-quiz` по фактическому registry file. `metadata.quizResolution` хранит выбранный definition, fallback и evidence. Новые переводы или equivalence не выдумывались; старые quiz IDs не менялись.
2. **Точный дубль graph edge.** Удалено повторение `ai/ml/dl.html::topic:activation_functions:0 → math/calculus.html::anchor:approximation:0`, `references`, `line:566`. Совпадали endpoints, type и evidence. Из 315 прежних повторов endpoints только один являлся таким точным дублем; остальные 314 разных citations сохранены. Две восстановленные EN связи и один удалённый дубль дают итог +1 связь.
3. **Потеря исторических progress aliases.** `.name` aliases добавлялись после `Collector.add`, а binding сохранял только начальный список. Финализация теперь сохраняет полный набор topic/difficulty/review aliases. Rebind сохраняет исторический scope. Замена `.name[id]` у сохраняющегося блока удерживает прежние aliases в history.
4. **Удалённые материалы.** Retired binding с известными aliases больше не исчезает из mapping: остаются прежние candidates/occurrences и `orphaned`, `canonicalId:null`. Неизвестный исторический ID также не удаляется и не объявляется завершением нового объекта.
5. **False negatives валидатора.** Отклоняются точные дубли edges, несколько containment parents, parent/child из разных источников, неверный evidence source, неверные endpoints, dangling edges, cycles и orphan active objects. Решения review без обязательных `source`/`canonicalId`, с неизвестными полями или без evidence отклоняются.
6. **Непроверенные targets.** Progress resolver больше не разрешает singleton без подтверждённого active registry target. Неоднозначность, retired target и отсутствующий namespace не получают guessed completion.
7. **Нестабильная/небезопасная регенерация.** Read/check не выделяет UUID для неизвестных объектов; обычный `--write` не пересоздаёт отсутствующий identity seed. Integrity errors блокируют публикацию. Сериализация UTF-8/LF, порядок данных и повторные сборки проверяются побайтово.

## Registry, lifecycle и публикация артефактов

Продолжен существующий `tools/content/catalog.py`; второй extractor/domain registry не создавался. UUID source occurrences сохранены. Идентичность не выводится из заголовка, UI-порядка или deployment base. Явный `rebind` проверен на rename; без него новый locator не считается автоматически прежним материалом.

Схемы catalog/identity/mapping и review overlay проверяются до использования. Authored `id-resolutions.json` начинается с **0 решений**; генератор его не перезаписывает и не придумывает автора review. Поддерживаются `resolved`, `ambiguous`, `deprecated`, `orphaned`, `pending_review`. Выбор при reviewed resolved возможен только среди сохранённых original candidates с active target; остальные статусы не возвращают canonical progress target. Наблюдение и решение раздельны.

`--write` разрешает явное provisioning новых объектов при существующем seed, сохраняя все прежние UUID. При утрате seed нужно восстановление registry, а не новый случайный набор ID. Публикация сначала подготавливает все JSON, затем атомарно заменяет отдельные файлы, начиная с identity. Ошибка staging не меняет старые outputs. Это не транзакция трёх файлов: прерванный bundle выявляется `--check`, повторная генерация использует сохранённую identity. Concurrent author writes не поддерживаются.

Самостоятельные Subject/Course/Module/Lesson не выдуманы из папок. Порядок canonical entities не является педагогической последовательностью: исходный порядок quiz items остаётся в source payload. Различные источники/локали не склеиваются по одинаковому legacy ID.

## Совместимость прогресса и маршрутов

Read-only projection сохраняет одну независимую raw запись на каждый вход. Проверены synthetic completion, historical achievement, quiz attempts, spaced repetition, Python/math tasks, drafts и roadmap references, unknown fields и противоречивые attempts. Никаких DB writes, aggregation, выдачи/отзыва наград или изменения старых ключей adapter не делает. Полноту всех когда-либо существовавших пользовательских ID статически доказать нельзя.

`RouteAdapter` реализует `Legacy URL → Registry → future exact URL` для текущих физических HTML и DOM anchors. Независимые тесты выполняют **5766 lookup**: 190 страниц + 2693 anchors под двумя bases. Проверяются relative paths, `/en/`, query/hash, decoding, case, duplicate anchors, traversal, missing/unsupported/external результаты. Исторический ID alias не является доказательством, что сервер обслуживает старый физический URL.

Сохраняются **18 исходных route findings**: 5 missing SVG в двух режимах = 10, 5 broken local references и 3 local directory-not-served. Это не 18 разных URL. Статический built Pages artifact имеет 5 missing SVG. Нужные иконки и поведение directory URLs не менялись: это noncritical legacy defects вне стабилизации каталога. Они не скрыты для зелёного strict результата. Внешние ссылки классифицированы, но не обходились сетью; произвольные dynamic links/remote content не доказаны исчерпывающе.

## Производительность

Измерения после финальной регенерации: Python 3.12.14, Windows 11 AMD64, локальная тёплая файловая система. Полные данные и methodology: [content-performance.md](content-performance.md), `content-performance-measurements.json`. Это не browser/network benchmark и не RSS.

| Нагрузка | Прежний accessor/scan | Optional indexed reader |
|---|---:|---:|
| 300 ID lookups | 0.3155 с | 0.00342 с |
| 100 outgoing-edge lookups | 0.2532 с | 0.000642 с |
| 30 JSON-backed Flashcard materializations | 1.4336 с | 0.1629 с |
| 10 broad category queries с одинаковым DTO copying | 0.3127 с | 0.2934 с |

Каталог читается примерно за 0.347 с. Две сборки заняли 6.792/6.537 с, без сериализации; SHA-256 сериализованных catalog/identity/mapping совпали между сборками. Размеры трёх основных JSON: 38,741,287 + 13,722,921 + 35,325,658 = **87,789,866 байт**. Большие provenance и журнал проблем остаются offline.

Текущие Python allocations: registry 100.7 MB; registry вместе с detached reader 158.3 MB; плюс один parsed source 172.5 MB. Peak загрузки registry — 343.7 MB Python allocations. Это явная цена копии/индексов, не обещание меньшей памяти. Неограниченный рост cache не оценивался; reader ограничивается временем build job.

Добавлен только optional `ContentReader` поверх того же registry. Он индексирует ID/type/source/edges, кеширует parsed source и **проверяет raw SHA-256 при каждом materialization, включая cache hit**. Missing/stale/outside source отклоняется, DTO возвращаются независимыми копиями. Broad query без копирования по-прежнему быстрее — общего обещания «все запросы ускорены» нет. Sharding, сервер, watcher и новая инфраструктура не вводились.

## Проверки

Среда: Node 24.17.0, bundled Python 3.12.14, Chrome 155.0.8059.85, существующий isolated Playwright install. Это локальная среда; отдельный CI run не запускался.

| Проверка | Фактический результат |
|---|---|
| `node --test` | **47/47 PASS**, 0 skipped; все прежние storage tests и 12 resolver tests |
| `python -m unittest discover -s tests -p 'test_*.py'` | **62/62 PASS** |
| `catalog.py --check` | **PASS**, canonical artifact bytes совпадают |
| `python -m tools.content.issues --check` | **PASS**, весь журнал актуален |
| Две независимые actual rebuilds | **PASS**, одинаковые serialized bytes и сохранённые binding IDs |
| `storage_inventory.py --check` | **PASS**, 702 static access candidates |
| `storage-regressions.cjs` | **2 PASS**: clear/reload и achievement race |
| `storage-multitab.cjs` | **PASS**, 50 writes + unrelated field |
| `storage-reliability.cjs` | **28 PASS**, 2/3/5 вкладок × 25/100/500 и failure/schema/legacy cases |
| `storage-clients.cjs` | **7/7 PASS дважды подряд после исправления readiness теста**, см. ниже |
| `storage-recovery.cjs` | **6 PASS**, export/preview/restore/undo/conflicts/migration recovery |
| `storage-quota.cjs` | **PASS**, failed commit не показывает сохранённый completion |
| `pages-storage.cjs` | **PASS**, настоящая сборка текущего дерева в собственной temp папке: 1847 файлов, 190 HTML, 0 backup files; `/datalab/` loader/recovery работают |
| `smoke.cjs` | **PASS**, 6 страниц × 5 ширин, HTTP 200/title, 0 uncaught page errors, mobile menu checks |
| `python-checker.cjs` | **PASS**, Node/Python real UI, 403 guards, submitted-code race, 503 path и Pages runner-unavailable |
| `scenarios.cjs` | **PASS**, quiz 10 answers после reload, math, SR persistence; Python/Pyodide execution observed, request failures отсутствуют |
| `catalog.py --strict` | **EXIT 1 намеренно**, 608 source warnings, 0 integrity errors |
| `routes_inventory.py --strict` | **EXIT 1**, 18 сохранённых source findings |

Новые adverse tests не исключают проблемные данные: проверяют corrupted schema/graph/mapping, отсутствующие связи, multiple/wrong parents, cycles, exact duplicates и distinct evidence, rename/удаление/изменение aliases, rejected unallocated IDs, malformed reviews, утрату seed, publication failure и byte determinism. Schema failures блокируют write; root publication tests используют только disposable artifacts.

### Browser finding: readiness профиля

Первый и повторный полный clients run падали на настройках профиля; одиночный сценарий проходил. Это исследовано, а не скрыто rerun. Удерживание `config/firebase-config.json` в synthetic контексте показало: после `DataLabStorage.ready` ввод уже возможен, но профиль ещё не загружен. До release response имя было Synthetic/email пустой/save enabled; после `loadUserProfile` имя становилось Student/email offline@datalab.local/save disabled. Это прежняя гонка UI hydration, а не потеря committed DB state.

Тест теперь ждёт готовности формы по непустому email текущего пользователя и исходному disabled save, затем вводит данные. Все assertions сохранения/reload сохранены, фиксированных sleeps вместо проверки готовности не добавлено. После коррекции полный набор прошёл дважды подряд. Production не менялся. **Остаточное ограничение:** реальный ранний ввод до загрузки профиля всё ещё может быть перезаписан; это noncritical существующий usability defect, описанный в [content-qa.md](content-qa.md), а не заявленный исправленным storage bug.

## Council review

Использован [Council](C:/Users/ZXKS/.codex/skills/council/SKILL.md), полный multi-agent протокол с независимым первым анализом пяти ролей, обменом возражениями и финальными позициями.

- **Content Architect:** occurrence модель отражает наблюдаемые источники; EN связь должна следовать runtime registry, нельзя превращать count в доказанную Course/Lesson hierarchy. Exact dedup не должен уничтожать различные citations.
- **Data Architect:** UUID сам по себе не гарантирует historical alias retention. Нужны active target, explicit rebind, tombstones, sparse review и raw progress preservation. Cache допустим только без потери provenance.
- **Frontend Architect:** historical alias identity не доказывает обслуживание старого URL. Нужны точные текущие `.html`/anchors, явный base и structured unsupported/missing; future rendering/hydration пока не доказаны.
- **QA Engineer:** static route coverage не заменяет negative schema/graph tests. Реальные false negatives и browser readiness race проверены adversarial/causal fixtures, не замаскированы исключением assertions.
- **Performance Engineer:** повторное чтение десятков тысяч JSON-backed объектов оправдывает измеренный optional reuse, но не blanket ускорение, browser delivery гигантского registry или преждевременное sharding.

Сохранившееся разногласие: относительный runtime-приоритет snapshot нельзя выдавать за доказанный возраст/устаревание. Поэтому итоговая классификация этих двух конфликтов — ambiguous_data, obsolete_data остаётся 0. Различаются также occasional и bulk workload: cache optional, SHA проверяется всегда. Контрпример «одинаковый legacy ID/текст означает одинаковый материал» отклонён тестами и контрактом.

Итог: **одобрена стабилизация offline-платформы в проверенных границах; открытых критических ошибок ядра после исправлений не выявлено**. Уверенность высокая для воспроизводимых source/identity/graph invariants, ограниченная для произвольной прошлой user history, dynamic remote links и будущего frontend. Консенсус не распространён на непроверенные области.

## Воспроизведение проверок в этой среде

```powershell
$env:PATH = 'C:/Users/ZXKS/.cache/codex-runtimes/codex-primary-runtime/dependencies/python;' + $env:PATH
$env:NODE_PATH = 'C:/Users/ZXKS/AppData/Local/Temp/datalab-qa-15d091717b824ce59ff5279051293eaf/node_modules'
$env:DATALAB_CHROMIUM = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
$env:DATALAB_PYTHON = 'C:/Users/ZXKS/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
node --test
python -m unittest discover -s tests -p 'test_*.py'
python tools/content/catalog.py --check
python -m tools.content.issues --check
python tools/audits/storage_inventory.py --check
node tools/audits/storage-regressions.cjs
node tests/browser/storage-multitab.cjs
node tests/browser/storage-reliability.cjs
node tests/browser/storage-clients.cjs
node tests/browser/storage-recovery.cjs
node tests/browser/storage-quota.cjs
node tests/browser/pages-storage.cjs
node tests/browser/smoke.cjs
node tests/browser/python-checker.cjs
node tests/browser/scenarios.cjs
```

Все browser scripts выше запущены в этой фазе. Pages helper строит disposable копию текущего дерева и не заменяет существующий `.local/pages`. `catalog.py --strict` и `routes_inventory.py --strict` запускаются отдельно как диагностические команды с ожидаемым ненулевым статусом по перечисленным находкам; они не подменены зелёным `--check`.

## Артефакты и дальнейшая граница

Обязательные документы: [content-issues.md](content-issues.md), [id-resolution-report.md](id-resolution-report.md), [content-platform-contract.md](content-platform-contract.md), этот отчёт. Дополнительно: [content-qa.md](content-qa.md), [content-performance.md](content-performance.md) и measurement JSON.

Обновлены существующие schema/registry/mapping и текущие архитектурные документы. Добавлены `tools/content/{issues,resolution,reader,routes,benchmark}.py`, authored review overlay, machine issues journal и тесты. Все helpers используют тот же каталог. В existing browser clients test исправлена только prerequisite готовности формы.

Будущий frontend может использовать типизированные DTO, source materialization, explicit route/resolution results и build-time validation без переписывания доменной модели. Python→JS transport, реальный Astro renderer, React hydration, разрешение semantic equivalence/parent context, retained physical redirects, исправление legacy resources и ранней profile hydration — отдельные последующие изменения. Они не запускались автоматически. Для текущей Фазы 3 сохранены сайт и пользовательские данные; работа остановлена.
