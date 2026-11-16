# DataLab — отчёт Фазы 2

Дата: 16 ноября 2026. Объём: Unified Content Architecture & Domain Model.

## Результат и границы

Создан автономный проверяемый прототип каталога, система идентификаторов и контракт будущего frontend. Прототип находится за пределами `site/` и не подключён к production. Он объединяет **наблюдаемые объекты и ссылки из источников**, а не объявляет каждую страницу законченным курсом или уроком.

Astro, React и MDX не устанавливались. HTML, CSS, runtime, публичные маршруты, storage schema и ключи пользовательского прогресса в этой фазе не менялись. Миграция пользовательских данных, commit, push и публикация не выполнялись. К Фазе 3 перехода нет.

## Сохранность исходного состояния

Работа начата на ветке `refactor/phase-0-baseline`, HEAD `95682d2e3aedaa4d0fa70ce009b899f68fba2cdd`. В рабочем дереве уже были изменения Фаз 0, 1 и 1.1; они сохранены. Сравнивать всю текущую разницу с HEAD как результат одной Фазы 2 нельзя.

До изменений прочитаны отчёты предыдущих фаз и storage contracts. Исходные 35 Node-тестов и браузерный multitab-тест прошли: критического storage-блокера для изолированного прототипа не выявлено. Реальный пользовательский профиль браузера и его IndexedDB не читались; проверки выполнялись на synthetic данных.

Зафиксирован агрегат SHA-256 для всех 1859 физических файлов `site/`: `3cf8b37968351b5c9bb9cd4a19644e70dd53d150e9ee42d0826ca1dd83f27366`. Финальное сравнение этого агрегата, а также отдельных `site/profile.html` и `LEARNING_PROGRESS.md`, **полностью совпало** с исходным состоянием. Этот агрегат включает имена файлов и содержимое; он дополняет независимые проверки маршрутов.

## Инвентаризация и модель

Изучены 408 источников: 190 HTML, 214 JSON и 4 JS-реестра. JSON-каталоги вопросов, категории и группы, quiz definitions/registry и определения обеих локалей, inline Python/math задания, обе snapshot карточек, roadmap, достижения, question-of-day и статические navigation/Kanban/question-bank registries учитываются с происхождением. JS не исполняется: извлекаются статические литералы, а динамические пользовательские объекты не объявляются учебным контентом.

В модели разделены:

- `LegacyPage`, точные DOM `Section`, HTML `ContentBlock` и `Exercise`;
- quiz declarations/definitions и их собственные `Question`;
- `Flashcard`, `Achievement`, `Definition`, question index occurrences;
- подтверждённый `LearningPath`, его `Milestone` и `PathTrack`;
- категории, source datasets и конфигурационные записи с ограниченной семантикой.

Самостоятельные `Subject`, `Course`, `Module` и универсальный `Lesson` не создаются из названий директорий. В данных подтверждены категории и направления, но единая авторская иерархия курсов/модулей ещё не задана. Будущий frontend должен корректно обрабатывать отсутствие этих связей. Отношение страницы к quiz не доказывает соответствие каждого вопроса каждому теоретическому разделу. Сходство заголовков не связывает упражнение с теорией автоматически.

Объекты хранят ссылки на существующие источники. Полные тексты не требуется массово переводить: legacy HTML сохраняется; JSON подходит структурированным заданиям; Markdown/MDX рассматриваются только для отдельных будущих авторских материалов. `get_content` читает реальный JSON-узел либо весь HTML/JS-источник с locator; HTML Section пока не извлекается как отдельный готовый фрагмент.

## Идентификаторы и прогресс

Canonical ID имеют вид `dl_<UUID4 hex>` и сохраняются в `id-registry.json`. Генератор повторно использует persisted bindings. Заголовок, позиция в массиве объектов с уникальным явным ID и UI-порядок не генерируют новый canonical ID. Для переезда/переименования источника есть явный `rebind`, сохраняющий UUID, исторический source и aliases; без него новый locator считается новым объектом. Повторяющиеся ID внутри одного source различаются occurrences: перестановку таких дубликатов нельзя считать семантически доказанным переименованием.

Canonical здесь идентифицирует **source occurrence**, а не доказанную эквивалентность всех переводов или версий материала. Реестр сохраняет retired bindings после уточнений экстрактора; это история выделенных UUID прототипа, а не утверждение, что учебные материалы удалены с сайта.

Mapping имеет явные namespace, legacy ID, source scope, canonical target, candidates, occurrences и status. При неоднозначности `canonicalId: null`. Старый глобальный ID не получает source из текущего URL пользователя. `data-md-id`, DOM anchor, progress ID, ID quiz item и ID пользовательской попытки — разные понятия.

Независимая проверка HTML обнаружила 1638 различных `.name[id]`, 1763 пары ID/страница и **124 ID на нескольких страницах**. Например, `median` встречается в probability и Classic CV. Такая глобальная запись прогресса остаётся ambiguous. У DL `encoder_only` как MD locator отличается от DOM/progress ID `encoder-only`.

Read-only adapter возвращает одну проекцию на каждую входную запись, сохраняя raw unknown fields, исторические достижения, code/draft и противоречивые quiz attempts. Он не размножает completion, не объединяет попытки и не отзывает достижения. Неизвестные исторические ID остаются unresolved. Все реальные storage API продолжают получать прежние ключи; canonical ID туда не подставляются.

## Эксперимент на реальных материалах

| Материал | Canonical ID выбранной occurrence | Что проверено |
|---|---|---|
| Python theory, `python/base.html`, `special_characters` | `dl_9636486deab6490e938b9edab70ea5b5` | Каталог, реальный HTML, старый topic ID и якорь; quiz связан на уровне страницы |
| Большой DL-документ, `ai/ml/dl.html`, MD `encoder_only` | `dl_ec145b4201cf4450b79a88b0ad546b27` | Материализация источника и отделение MD ID от `encoder-only` |
| Python practice, `filter_positive_even` | `dl_1d7c4bc06d0846cd8b4f1e40a567b09d` | Exercise, inline `data-tests`, source document и старый exercise ID |
| Math practice, `algebra-vectors` | `dl_2ec69813abd44354a9152430d51bbfd1` | `data-answers`, поля задания и полный page-scoped draft ID |
| Quiz definition `python:basics` | `dl_02092437aff24c4f8bff4e6c3783f41d` | JSON definition, registry reference, quiz-owned вопросы и legacy namespace |
| Runtime flashcard `supervised_learning__1` | `dl_3902cd6d52ee4ba5acfae2b87ac5701a` | Prompt/answer из JSON, явная связь `targetPage`/`questionId`, scoped lookup |

Независимый QA материализовал все 21406 JSON-backed объектов текущего среза без ошибок locator, используя cache parsed sources. Обычный accessor перечитывает файл при каждом вызове; для массового чтения будущему адаптеру нужен cache/index неизменяемых источников. Это проверка доступности источника, а не запуск упражнений в новом frontend.

## URL и будущий frontend

Все 190 физических HTML и 2693 occurrences DOM ID представлены с точным spelling и multiplicity. Независимые тесты сравнивают исходный HTML с каталогом, а не вызывают повторно тот же extractor. Для каждой страницы сохраняются local URL и `/datalab/` URL; source fingerprints проверяются по физическим байтам.

Будущий контракт: Astro SSG перечисляет сохранённые `.html` маршруты, React обслуживает отдельные интерактивные компоненты через существующий storage facade, MDX применяется выборочно. Hosting остаётся статическим контрактом; SSR/API требуют отдельного решения. Plain DTO и слой чтения отделены от UI. Canonical identity, location и persistent legacy key не смешиваются. Контракт не является реализованной интеграцией или доказательством улучшения usability.

## Council

Использован установленный [Council](C:/Users/ZXKS/.codex/skills/council/SKILL.md): независимые Content Architect, Data Architect, Frontend Architect и QA Engineer, затем обмен аргументами и финальные позиции.

Content Architect поддержал occurrence-first модель и отказ от искусственных курсов. Data Architect возразил против трактовки UUID как автоматической гарантии rename: добавлены explicit rebind/history и fail-closed aliases. Frontend Architect нашёл реальную ошибку смешения MD/DOM ID; она исправлена. QA сначала блокировал прототип из-за трёх false negatives валидатора: неверный resolved status, пустые candidates и malformed evidence; после исправления mutation tests проходят.

Общий вердикт ограничен **offline-прототипом**. Контрпример «одинаковый ID на разных страницах или в разных snapshot означает один учебный объект» отвергнут. Полное route coverage само по себе не доказывает правильность семантических связей, поэтому проверяется отдельно от typed graph/mapping invariants. Разногласие о полноте будущей семантической модели сохранено как ограничение, а не снято выдуманной иерархией. Критических архитектурных ошибок в принятом объёме после исправлений не обнаружено.

## Артефакты

| Файл | Назначение |
|---|---|
| `content-inventory.md` | Источники, фактические типы/связи и противоречия |
| `domain-model.md` | Сущности, поля, отношения, lifecycle и версии |
| `content-registry.md` | Формат, команды, query/materialization и ограничения |
| `id-registry.json` | Persisted UUID bindings и история |
| `legacy-id-mapping.json` | Exact scoped/global mappings и ambiguity |
| `progress-compatibility.md` | Реальные storage namespaces и lossless projection |
| `url-compatibility.md` | Исторические пути, anchors и deployment base |
| `future-frontend-contract.md` | Контракт дальнейшего Astro/React frontend |
| `content/prototype/registry.json` | Generated detached occurrence graph |
| `content/prototype/catalog.schema.json` | Схемы catalog, identity и mapping |
| `tools/content/catalog.py` | Build/check/query/get_content/rebind и validation |
| `tools/content/progress-compatibility.cjs` | Чистый resolver и read-only projection |

Пути документации в таблице относительно `docs/modernization/`; остальные пути относительно корня репозитория.

## Финальные проверки и известные находки

После последней генерации: **26955 активных occurrences, 54181 связь, 53682 строки mapping**. В identity registry также сохранены 10505 retired UUID первоначального уточнения экстрактора. Из глобальных aliases 9371 неоднозначен во всех namespaces вместе; это не количество ошибок прогресса.

В прототипе **0 integrity errors и 610 source warnings**: 2 unresolved EN quiz references, 2 конфликта snapshot/config, 593 повторно использованных scoped identifiers и 13 групп одинаковых текстов quiz-вопросов. Повторы внутри категорий/маршрутов могут быть допустимыми: предупреждение не означает необходимость удалить записи. Конфликтующие варианты не сливаются. Runtime data cards содержат 5638 записей/5628 уникальных ID, config cards — 4867/4857; повторяющиеся occurrences сохранены.

Проверки после последней генерации:

| Проверка | Результат |
|---|---|
| `node --test`, bundled Python в PATH | **42/42 PASS**, включая прежние storage tests и 7 новых resolver tests; 0 skipped |
| `tests/browser/storage-multitab.cjs`, Chrome, новый isolated context | **PASS**: все 50 synthetic записей и unrelated поле сохранены |
| `tools/audits/storage_inventory.py --check` | **PASS**, 702 static access candidates; inventory не менялся |
| `tools/audits/storage-regressions.cjs` | **2 PASS**: clear/reload и achievement race |
| Python `test_*inventory.py` | **7/7 PASS** |
| Python `test_content_*.py` | **23/23 PASS**: 8 catalog/schema/rebind/materialization, 10 independent QA mutations, 2 progress coverage, 3 independent route/source coverage |
| Python `test_*.py`, полный discovery | **30/30 PASS** |
| `tools/content/catalog.py --check` | **PASS**, артефакты воспроизводимы с persisted IDs, schema/graph/mappings согласованы |
| `tools/content/catalog.py --strict` | **EXIT 1**, все 610 source warnings остаются явно видимыми |
| `tools/audits/routes_inventory.py --strict` | **EXIT 1**, прежние source findings: 5 broken local links, 3 directory-not-served local, 5 missing assets local и 5 Pages |
| `git diff --check` всего прежнего рабочего дерева | **EXIT 2**: 300 whitespace findings в 7 уже изменённых файлах `site/`; их байты совпадают с состоянием до Фазы 2, чужие правки не переформатированы |

Строгие диагностические проверки намеренно не объявлены зелёными. Исходные находки не исправлялись, поскольку production-контент в Фазе 2 менять запрещено. Отсутствие новых изменений `site/` подтверждает сохранение baseline, но не устраняет старые дефекты сайта.

Новые content integrity tests обязаны проходить; строгий аудит исходных неоднозначностей может завершаться EXIT 1. Неоднозначные источники нельзя автоматически подключать к runtime или использовать для массового remap прогресса. Перед будущей интеграцией нужны авторские решения о hierarchy, collision policy, переводах и конфликтующих snapshot, а также отдельная проверка динамических ссылок и реального UI. Фаза 2 на этом остановлена.
