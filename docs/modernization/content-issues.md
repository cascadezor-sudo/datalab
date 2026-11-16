# Phase 3 — аудит проблем контента

Классификация относится к offline occurrence catalog и не разрешает менять HTML, URL, storage или учебные ответы. Машинный журнал `content/prototype/content-issues.json` использует существующие canonical IDs и mapping; это не второй реестр. Каждая запись сохраняет исходное warning/mapping/route evidence, источники, затронутые canonical ID с sourceKey и locator, причину, влияние на функцию, возможность безопасного исправления и риск. Повторные route findings в local/Pages не схлопываются.

Проверка: `python -m tools.content.issues --write`, затем `python -m tools.content.issues --check`. Запись требует явного `--write`; обычный запуск только читает источники. Команда использует актуальный persisted registry; после изменения каталога журнал следует регенерировать. Тест `tests/test_content_issues.py` проверяет точное покрытие исходных warning и всех ambiguous mappings, отсутствие пропуска неизвестных проблем, сохранность входов и детерминированность.

## Исторический baseline, проверенный повторно

До исправления extraction подтверждены **610 warning, 0 error**: 593 `duplicate-source-identifier`, 13 `duplicate-question-content`, 2 `quiz-reference-unresolved`, 2 `source-copy-conflict`. Подтверждены **9371 global** и **593 scoped ambiguous aliases** — всего 9964 строк mapping. Это число неоднозначных ссылок на occurrences, а не число сломанных учебных материалов. После исправления EN extraction подтверждены 608 исходных warning; фактические актуальные числа всегда находятся в `counts` машинного журнала.

| Категория | Проверенный класс и причина | Функциональное влияние; безопасное действие; риск |
|---|---|---|
| Подтверждённая ошибка (`confirmed_error`) | 18 статических route findings: 5 отсутствующих SVG × local/Pages; 5 extensionless ссылок local; 3 directory ссылок local | Отсутствующие иконки; локальный сервер не обслуживает directory URL. Pages эти directory ссылки обслуживает. Сохранять точный mode; правку визуальных ресурсов/серверного поведения рассматривать отдельно. Риск medium. |
| Неоднозначные данные (`ambiguous_data`) | 9964 ambiguous mapping rows; 8 scoped flashcard aliases, 1 card-block alias и 2 конфликта snapshot/config | Безопасно выбрать объект для прогресса нельзя. Сохранить candidates/исходную запись; разрешение только по доказанному scope/ручному решению. Риск автоматической правки high. |
| Устаревшие данные (`obsolete_data`) | 0 подтверждённых случаев | Различие двух используемых snapshot не доказывает возраст или устаревание редакции. Карточки config остаются fallback; оба конфликта относятся к ambiguous_data. Ничего не удалять. |
| Дублирующиеся данные (`duplicate_data`) | 13 групп одинаковых нормализованных prompt | Совпадение текста не доказывает совпадение кода/options/answers или identity. Сохранить каждое occurrence; ручное сравнение полного payload. Риск merge high. |
| Допустимые legacy-особенности (`acceptable_legacy`) | 564 scoped question-index и 20 roadmap-track aliases | Повтор ID внутри категорий/недель допустим в исходном контейнере. Source-only lookup всё равно ambiguous. Не переименовывать старые ключи; учитывать parent evidence при будущем explicit resolver. Риск high. |
| Ложные срабатывания (`validator_false_positive`) | 2 EN quiz references при старой языковой эвристике | Runtime использует общий registry, пытается EN definition и возвращается к base JSON. Ошибка extraction, а не отсутствующий runtime quiz. Исправляется извлечение связей без изменения сайта/legacy ID. Риск low. |

Категории не являются статусами разрешения alias. Например, допустимый повтор roadmap ID остаётся `ambiguous` для запроса без parent context. Неизвестный будущий warning сохраняется как `ambiguous_data`, а не исчезает из отчёта.

Актуальный журнал: 608 catalog-warning + 9964 alias + 18 route occurrences = **10590 записей**. Классификации: 18 confirmed_error, 9975 ambiguous_data, 13 duplicate_data, 584 acceptable_legacy; obsolete_data и текущих validator_false_positive — 0. Два исправленных EN false positives остаются в исторической строке и разборе ниже, а не подавляются в актуальной валидации. Все 610 исторических предупреждений тем самым учтены: 608 остаются, 2 исправлены на уровне extraction. Issue IDs зависят от evidence и номера точного повторения этого evidence, а не общей позиции в журнале.

## EN quiz: доказанная runtime семантика

`site/assets/js/components/quiz.js::loadQuizRegistry` читает `registry.json`, затем для EN накладывает поля `registry.en.json` только на существующие ID. EN registry содержит текстовые переводы, не самостоятельные определения тестов. `fetchQuizFile` читает `quizInfo.file`, пытается соседний `.en.json`, при отсутствии перевода возвращается к base `.json`. `loadQuiz` сохраняет исходный quizId. Поэтому для `en/python/base.html` (`python:basics`) и `en/ai/ml/classic.html` (`ml:classic`) нельзя требовать отдельную `.en.json` сущность; выбор обязан следовать registry declaration и наличию definition. При неоднозначном/отсутствующем declaration extraction должен оставить warning, а не выбирать первый совпавший ID.

## Snapshot authority и дубли

Runtime `firebase-mock.js` читает `assets/data/teormin-cards.json`; `achievement-api.js` пробует data прежде config fallback. `course-roadmap.js` читает `assets/js/config/categories-config.json`; название `categories-config-live.json` само по себе не даёт ему приоритет. Это доказательство порядка потребления, не разрешение склеить entities или переносить spaced repetition на другую карточку.

Data cards: 5638 occurrences/5628 уникальных ID; config cards: 4867/4857. Все 4857 уникальных config ID есть в data; все 4857 пар полных записей различаются при сравнении по ID. Такое сравнение с последней записью не заменяет lossless comparison occurrences. Повторяются `median__1`…`median__4` в каждой копии; `median` также неоднозначен в card-block assignment. Нельзя переименовать их без отдельной политики исторического прогресса. Question-index/roadmap повторы не являются доказанными duplicate lessons.

## Маршруты и границы

Read-only `tools/audits/routes_inventory.py` повторно обнаружил отсутствующие `assets/icons/{network,compass,play,team,dictionary}.svg` из `ai/interviews/index.html`; журнал хранит точные references. В `news.html` три `tests/`, а также `tests`, `roadmap`, три `calender` дают local findings. Нельзя обобщать local finding на Pages: статический Pages audit эти directory/index назначения разрешает. Ссылки динамических шаблонов могут быть перехвачены JS; аудит доказывает только отсутствие статического server target при оговорённых assumptions. Внешние URL, динамически вычисленные ссылки/якоря и удалённые ответы не проверяются сетью. Нулевой warning не является критерием качества и не достигается подавлением проблем.
