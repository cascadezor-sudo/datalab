# Phase 2: доменная модель и границы доказательств

Дополнение Фазы 3: модель occurrence не заменена. Уточнены проверки provenance и lifecycle; актуальные API находятся в `content-platform-contract.md`. Historical URL alias — запись идентичности, не обещание обслуживания старого физического URL сервером. Текущие production URLs сохранены без изменений.

## Семантика identity

Прототип идентифицирует **вхождение объекта в источнике**. Две похожие карточки или перевод вопроса пока не объявляются одной доменной сущностью. Canonical ID вида `dl_<32 hex>` — случайный UUID4, записанный в `id-registry.json`. Он не кодирует заголовок, путь или порядок. Binding связывает ID с исходным `sourceKey`; изменение title или перестановка элементов массива с уникальным явным `id` ID не меняют.

При перемещении/переименовании source locator требуется **явный rebind**, а не fuzzy-match. API `rebind(identity, old_key, new_key, new_source)` переносит binding с прежним UUID, сохраняет historicalSources и alias старого binding. Исторические URL/ID попадают в legacy mapping; destination collision отклоняется. Без такого решения переименованный источник считается новым: никакой автоматической гарантии узнавания произвольного rename нет. Переименование целой страницы с блоками требует reviewed rebind каждого затронутого binding. Это прототип инструмента, не миграция production.

Повторяющиеся идентичные legacy ID внутри одного массива различаются номером duplicate occurrence. Их порядок нельзя безопасно менять как способ идентификации: такие группы помечены неоднозначными, требуют ручного решения. У элементов без явного ID locator может содержать индекс; модель не обещает устойчивость их самостоятельной identity при перестановке. Произвольные unanchored HTML-параграфы не получают новых самостоятельных ContentBlock IDs.

## Общий контракт

Каждая сущность содержит обязательные `id`, `type`, `title` (может быть пустым), `sourceKey`, `source:{path,pointer}`, `legacyIds:[{namespace,value}]`, `metadata`. `source.pointer` — **source locator, не универсальный RFC 6901 JSON Pointer**: для массивов с ID используется `id:<legacy id>:<duplicate occurrence>`, для HTML — `line:N`. JSON dictionary keys экранируются `~0/~1`. Locator не является публичным URL и не должен попасть в storage keys.

| Тип | Назначение и обязательная специфика | Связи |
| --- | --- | --- |
| LegacyPage | Физическая HTML-страница, localUrl/pagesUrl, source | contains Section/ContentBlock/Exercise; offers-quiz только если сопоставлено |
| Section | Исходное `id` либо `a[name]`; якорь и legacy html-anchor | belongs to page/block; цель исходных ссылок |
| ContentBlock | Наблюдаемый `data-md-id`, исходный HTML | contains Section, references; MD и DOM topic aliases раздельны |
| Exercise | HTML `data-tests` либо `data-answers`; metadata содержит исходные проверки/математические поля | принадлежит своей странице, содержит якоря; внешняя тема не выдумывается |
| Quiz | Объявление registry или JSON quiz с исходным ID | registry quiz-definition → SourceDataset; definition contains Question |
| Question | Item quiz: собственный scoped ID, тип и содержимое через get_content | принадлежит Quiz; совпадение текста не доказывает эквивалентность |
| Flashcard | Запись cards[] с card.id, questionId, targetPage, category | reviews Section при уникальном фактическом href/anchor; принадлежит своей dataset |
| Achievement | Запись achievement catalog с ID и rule | dataset contains; правила сохраняются в JSON без выполнения |
| LearningPath | Документ course-roadmap с реальными milestones | contains Milestone |
| Milestone / PathTrack | Реальные недельные этапы и tracks; week/title/href | contains PathTrack; track references исходную страницу |
| SourceDataset / SourceRecord | Контейнер структурированных данных / прочий идентифицированный record | provenance/container, без утверждения о самостоятельном курсе |
| SourceCategory / QuestionReference / QuestionIndexEntry | Классификация и индексы источников | categorizes/roadmap только по явным questionPaths/roadmapUrl; ссылка из списка не тождество темы |
| Definition / CardBlockAssignment | Словарный термин / явное назначение question ID в блок | category contains Definition; assigns-block → Section |
| NavigationRegistry / NavigationEntry | Статические литеральные значения navigation.js | navigates-to по фактическому href |
| KanbanConfiguration / KanbanValue | Литеральные статусы/типы задач | статическая конфигурация; не копии пользовательских задач |
| QuestionBankConfiguration / QuestionBankTopic | Статические topic literals двух interview bank JS | не runtime вопросы Firebase и не отзывы пользователей |

`Subject`, `Course`, `Module`, `Lesson` не материализованы автоматически: источники смешивают тему, страницу, группу, курс и roadmap. Будущий curated слой может создать их отдельными opaque IDs после явного подтверждения membership и сохранения source references. Пустая выдача этих сущностей честнее искусственной иерархии по каталогам.

## Aliases и прогресс

Namespaces раздельны: html-path, html-anchor, md-source-id, topic-id, exercise-id, math-exercise-id, math-draft-id, quiz-id, quiz-question-id, flashcard-id, achievement-id, category-id, roadmap-milestone-id, roadmap-track-id, definition-id, definition-section-id, question-index-id, card-block-topic-id, navigation-id, kanban-id, questionbank-id, source-id, dataset-path, difficulty-id, review-later-id.

`topic-id` получен из `.name[id]`, `md-source-id` из `data-md-id`: различие `encoder-only`/`encoder_only` сохраняется. Math draft сохраняет полное `page#md-id`. difficulty/review aliases отражают реальную необратимую sanitization DOM topic IDs; совпавшие кандидаты не выбираются автоматически. Scoped mapping содержит точный site-relative путь; global mapping содержит `source:null`. `canonicalId:null` и candidates обязательны при >1 кандидате. Одинаковое имя ID между namespaces не означает alias.

Реальные storage keys не меняются; см. [progress-compatibility.md](progress-compatibility.md). Каталог не умеет записывать в IndexedDB.

## Проверки, lifecycle и версии

JSON Schema в `content/prototype/catalog.schema.json` описывает catalog/identity/mapping. Локальный subset validator проверяет все используемые schema keywords; это не реализация всего стандарта JSON Schema. Семантический validator проверяет уникальные canonical IDs/sourceKeys/mapping keys, binding metadata, наличие источника, ссылки, evidence, endpoints типов, contains cycles, orphan entities, полноту исходных aliases, согласованность mapping status/candidates/occurrences, binding alias cycles. Повторные legacy IDs являются source warnings, а не скрыто проходят под видом уникальных.

При исчезновении источника binding получает `retired`, UUID не переиспользуется. Активный материал не удаляется через прототип. Архивирование и удаление runtime контента в этой фазе не реализованы. Перед будущим удалением требуется проверить входящие связи, сохранить alias/tombstone и решить политику сохранения прогресса. В текущей новой registry остались 10505 retired UUID начальной корректировки extractor (вложенный category.id карточки сначала неверно считался отдельной карточкой); они не активные материалы и никогда не были storage keys.

`schemaVersion:1` версионирует контракт; raw source sha256 отмечает content revision. UUID не меняется при правке содержимого. Версии опубликованных редакций и миграции форматов пока не реализованы: будущий release должен хранить schema version, source digests, reviewed binding changes и compatibility report.
