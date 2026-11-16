# Владельцы состояния после Фазы 1.1

Основной владелец — `site/assets/js/storage-service.js`. Запись подтверждается только `IDBTransaction.oncomplete`; ошибка или abort отклоняет Promise. `BroadcastChannel` доставляет уведомления, после которых читается актуальное состояние IndexedDB. Он не хранит данные. Read-modify-write callbacks синхронны; async callback отклоняется. Для одного ключа результат определяет последний зафиксированный порядок транзакций, для инкремента нужен callback, читающий актуальное значение внутри транзакции. Повтор одинакового `set` безопасен; повторы произвольного mutator не имеют deduplication по operationId.

| Писатель | Маршрут записи / примечание |
|---|---|
| Firebase-подобные `ref.set/update/remove/push` | `firebase-mock.js` → `withDbLock` (название совместимости) → IDB `mutate`; localStorage/Web Locks не участвуют в фиксации. `loadDb/saveDb` вне транзакции не могут записывать DB. |
| Init, anonymous import, legacy reports, seed | Архив исходного native состояния, его проверка, затем атомарная активация; seed выполняется транзакционно после readiness. Старые значения не удаляются. |
| Достижения, quiz repair, daily reports, staff/English/recruiters | Адресные ref либо синхронный callback внутри транзакции. Catalog/scoring await выполняется до актуального изменения. Уведомления достижений — после commit. |
| Отметки тем, bulk/clear, сложность, page completion, quiz | Тот же адаптер; offline tracker не делает повторной записи зеркала. Page completion DB+KV фиксируются в одной транзакции. Снятие отметки не удаляет историческую награду/результат теста. |
| Повторения | `gradeCurrentCard` рассчитывает новое расписание из последнего зафиксированного состояния внутри транзакции, сохраняет неизвестные поля, продвигает UI после подтверждения. |
| Kanban и roadmap | Существующие ref через адаптер; demo-состояние использует KV `updateJSON`. Demo-success появляется после commit. |
| Python draft, math draft, diagnostic, news/daily fact, sidebar/TOC, цели, staff selection | `DataLabStorage.local`/`setKV`; JS native setter fallback удалён. Autosave вводимого текста может быть ещё в работе; успешное подтверждение API означает commit. При отказе показано сообщение, ожидание/закрытие не обещают сохранения неподтверждённых изменений. |
| Настройки оформления/языка | IDB managed KV, перед переходом языка await commit. `i18n.remember` перенаправлен в сервис. Native display projection не является источником истины. |
| Начальный inline theme boot | Читает native display projection до JS readiness; возможна нормализация display palette. Не пишет прогресс/DB. Старые наблюдённые display-правки архивируются, не перезаписывают IDB. |
| Inline role cache в `main.html` | Переведён на awaited `setKV`; в analytics interactive добавлен отсутствовавший storage bootstrap. |
| Native auth/session | Удаление `auth_token/auth_user` при выходе оставлено native. Секреты/сессионные данные не импортируются в managed KV и не экспортируются. |
| Recovery | Тот же источник истины; атомарный before-copy+restore с revision. Bootstrap требует отсутствия активного state и checksum просмотренного legacy. |
| Старый JavaScript | Не соблюдает новый протокол. Изменение legacy-данных архивируется, устанавливает сохраняемую блокировку. Закрытие старых вкладок и явное reviewed adoption/восстановление; абсолютное управление старым JS не обещается. |

`storage-access-inventory.json` — статические кандидаты по файлам/строкам/операциям. Сканер расширен для service/facade/IDB, поэтому числа до/после не сопоставимы как число действующих writers. Regex не выполняет разрешение алиасов и не доказывает полноту; таблица дополняет реальную браузерную проверку. Native HTML был отдельно проверен вне theme-boot: найденный role cache исправлен; оставшиеся inline записи относятся к раннему оформлению. Данные браузера инвентаризация не читает.
