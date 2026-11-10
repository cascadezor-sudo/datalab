# Разработка DataLab

Команды ниже выполняются из корня репозитория. Дополнительные пути к файлам
инструменты вычисляют самостоятельно.

## Запуск

На Windows основной вход — `Start_DataLab.bat` или `start.bat`. Он выбирает
Python, затем Python Launcher, затем Node.js. Обычный адрес сайта:
`http://localhost:8080/main.html`.

Прямой запуск:

```sh
python server/server.py
node server/server.js
```

Для Node.js есть короткая команда `npm start`. Зависимости npm устанавливать не нужно.
Python нужен обоим серверам для выполнения упражнений через `/api/run`.

## Автоматические проверки

```sh
node --test
```

Эквивалентная команда — `npm test`. Проверки хранилища выполняются в изолированном
JS-контексте. Серверные тесты проверяют оба сервера из посторонней рабочей папки:
выдачу страниц и JS, отклонение запроса без локальных заголовков и запуск Python runner.
Если Python 3 недоступен, серверные тесты помечаются как пропущенные.

Для проверки уже запущенного сайта:

```sh
python tests/server/test_http_all.py
```

## Аудиты

```sh
node tools/audits/audit_site.js
node tools/audits/audit_html_scripts.js
python tools/audits/inspect_analytics.py
python tools/audits/audit_analytics_summary.py
```

Последней команде нужен пакет `beautifulsoup4`; остальные аудиты используют
стандартные библиотеки. Node.js-команды доступны также как `npm run audit:external`
и `npm run audit:scripts`.

## Генерация материалов

Генераторы изменяют файлы сайта. Не запускайте их автоматически при старте приложения.
Перед запуском сохраните текущие правки в Git, после проверьте полученный diff.

Карточки: сначала обновляется привязка вопросов к блокам, затем сами карточки.

```sh
node tools/generators/flashcards/generate_teormin_card_blocks.js
node tools/generators/flashcards/generate_teormin_cards.js
```

Альтернативы: `npm run generate:blocks` и `npm run generate:cards`.

Генераторы аналитики находятся в `tools/generators/analytics/`. Для файлов,
разделённых на `p1` и `p2`, сборку обычно выполняет `p2`; проверьте блок
`if __name__ == '__main__'` перед запуском. Пример:

```sh
python tools/generators/analytics/gen_deep_group1_p2.py
```

`tools/maintenance/fix_quotes.py` — историческая разовая правка генераторов,
не часть сборки. `tests/manual/check_sr*.html` — сохранённые диагностические
страницы, не автоматические тесты и не страницы сайта.
