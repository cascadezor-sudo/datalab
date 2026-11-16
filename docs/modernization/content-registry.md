# Phase 3: стабилизированный offline каталог

Production не подключён к этому коду. `tools/content/catalog.py` использует только стандартную библиотеку Python; Astro/React, новые npm-пакеты и migration storage отсутствуют.

## Стабилизация Фазы 3

Обычные CLI read/check не выделяют UUID: неизвестный sourceKey вызывает `unallocated-identity`. Выделение новых ID требует явного `--write`; уже существующие binding никогда не пересоздаются. `--write` и `--check` взаимно исключены. Исходный порядок учебных вопросов следует читать из quiz payload: canonical порядок entities не является авторским порядком урока.

Отсутствующий persisted identity seed блокирует даже `--write`: восстановить registry, а не случайно выделить все UUID заново. Первичное программное provisioning API остаётся отдельным явным действием; обычная CLI регенерация предназначена для уже существующего каталога.

Сериализация UTF-8/LF с сортировкой object keys, entities по sourceKey и edges по endpoints/type/evidence воспроизводима побайтово. Точные дубли связей отклоняются валидатором и не создаются extractor; разные evidence locations сохраняются. Проверяются также единственный containment parent и совпадение источников parent/child/evidence.

Integrity errors блокируют запись. Все три JSON сначала подготавливаются во временных файлах; каждый заменяется атомарно, identity публикуется первой для сохранения выделенных UUID. Это **не** транзакция трёх файлов: при остановке посередине `--check` обнаружит неполный bundle, после чего нужно повторить генерацию с сохранённой identity. Одновременные авторские `--write` не поддерживаются. Подготовленные `.tmp` удаляются при ошибке; ошибка staging не заменяет ни одного старого файла.

Авторский `content/prototype/id-resolutions.json` никогда не генерируется заново. Его schema и review evidence проверяются перед публикацией; отсутствие или повреждение блокирует CLI. Наблюдаемые mapping и решения отделены, исходные candidates не теряются. Удалённые sources сохраняют retired binding и orphaned aliases; переименование и изменение `.name[id]` сохраняют исторические progress aliases. См. [id-resolution-report.md](id-resolution-report.md).

`ContentReader`, `RouteAdapter`, классификатор и review overlay работают поверх этого же каталога. Публичные API, ошибки и ограничения находятся в [content-platform-contract.md](content-platform-contract.md); измерения — в [content-performance.md](content-performance.md). Полные provenance JSON не передаются браузеру.

## Артефакты

- `content/prototype/registry.json`: sources, entities, relationships, issues; 26955 occurrences и 54182 связи.
- `content/prototype/catalog.schema.json`: JSON Schema 2020-12, `$defs.catalog`, `$defs.identity`, `$defs.mapping`.
- `docs/modernization/id-registry.json`: persisted bindings и explicit rename aliases; IDs нельзя пересоздавать при обычной регенерации.
- `docs/modernization/legacy-id-mapping.json`: 53682 scoped/global строки; каждая хранит namespace, legacyId, source, objectType, canonicalId, status, candidates, aliases, occurrences.

Артефакты занимают примерно 90 MB из-за полной provenance и scoped/global mapping. Это offline QA-прототип: не отправлять их целиком браузеру. Будущий build создаёт небольшие публичные projections по route, языку и типу; UUID registry остаётся авторским инструментом. Никаких priority rules между конфликтующими карточками каталог не назначает.

## Команды

```powershell
$env:PYTHONIOENCODING = 'utf-8'
python tools/content/catalog.py --write
python tools/content/catalog.py --check
python tools/content/catalog.py --strict
python -m unittest discover -s tests -p 'test_content_*.py' -v
```

`--write` явно обновляет только три generated JSON. Обычный запуск не пишет файлы. `--check` повторяет extraction с существующими persisted IDs и проверяет точное соответствие артефактам. Integrity errors всегда дают exit 1. `--strict` дополнительно даёт exit 1 при source warnings: сейчас это ожидаемо, поскольку известные противоречия остаются видимыми. Зелёный `--check` означает свежесть и внутреннюю согласованность, а не отсутствие source defects. Чтобы не принимать новую identity случайно, не удалять id-registry и не игнорировать diff при regenerate.

## Python API

```python
from tools.content.catalog import read, query, get_content, validate, ROOT

registry = read(ROOT / 'content/prototype/registry.json')
python_pages = query(registry, kind='LegacyPage', source='python/base.html')
cards = query(registry, kind='Flashcard', source='assets/data/teormin-cards.json')
selected = next(e for e in cards if {'namespace': 'flashcard-id', 'value': 'supervised_learning__1'} in e['legacyIds'])
first_card_payload = get_content(selected)
assert first_card_payload['id'] == 'supervised_learning__1'
```

`query` фильтрует по kind/source/canonical_id; неизвестный тип (например неподтверждённый Course) возвращает пустой массив. Связанные сущности получаются из relationships по `from`/`to`, без DOM или storage. `get_content` безопасно читает source внутри site; JSON locator реально выбирает нужную запись, а HTML возвращается целиком с исходным sourceLocator. HTML не санитизируется и не исполняется: этот результат нельзя вставлять в браузер как доверенный компонент без отдельного renderer/security контракта. Исходные `data-tests` Python и math `data-answers` доступны в metadata Exercise. Проверки не выполняются extraction-кодом.

## Проверенный эксперимент

| Материал | Canonical ID | Проверка |
| --- | --- | --- |
| Обычный урок `python/base.html` | `dl_22872eecad4749b1926ff766350fd80b` | query + исходный HTML; прежние anchors и quiz refs |
| Большой технический материал `ai/ml/dl.html` | `dl_61a3d82242d44b39b0d6f84d076793e8` | query + исходный HTML без переноса текста |
| Python `filter_positive_even` | `dl_1d7c4bc06d0846cd8b4f1e40a567b09d` | Exercise metadata.data-tests, source practise/python/base.html, исходные keys |
| Математика `algebra-vectors` | `dl_2ec69813abd44354a9152430d51bbfd1` | Exercise metadata.data-answers, math/draft namespaces |
| Quiz `python:basics` definition | `dl_02092437aff24c4f8bff4e6c3783f41d` | get_content выбирает исходный quiz JSON, contains Question |
| Flashcard `supervised_learning__1` data copy | `dl_3902cd6d52ee4ba5acfae2b87ac5701a` | get_content возвращает правильный payload; reviews существующий anchor |

`tests/test_content_catalog.py` автоматически проверяет все эти классы, две полные копии карточек, словарное определение, сохранение seed IDs при reorder/title edit, explicit rename с историческим URL alias, traversal rejection, malformed schema и неверные endpoints. Независимые QA-тесты проверяют повреждение ID, mapping, cycles и источников. Эксперимент не создаёт Lesson → Exercise связь по сходству имени и не меняет прогресс для проверки: raw record projection отдельно проверяется read-only resolver тестами.

## Форматы будущего контента

JSON остаётся форматом quizzes, карточек, achievement rules, реестра и typed relations. Большие legacy HTML сохраняются с route/anchor contract. Markdown подходит будущим простым текстовым материалам, MDX — материалам с явным allowlist интерактивных блоков. В этой фазе файлы не конвертируются. См. [future-frontend-contract.md](future-frontend-contract.md): Astro может читать каталог на build-time, React widgets получают компактный DTO, а совместимость с legacy storage остаётся в отдельном adapter, не в canonical ID.
