# Schmidt ML — Полная оффлайн-версия сайта (Full Offline Mirror)

Полная автономная локальная копия платформы **[schmidtml.ru](https://schmidtml.ru)** со всеми обучающими материалами, вопросами к собеседованиям, схемами, формулами и кодом.

## Обзор архива

* **Всего файлов:** более 1 500
* **Общий размер:** ~523 МБ
* **Количество интерактивных HTML-страниц:** 152 страницы
* **Автономность:** Полная оффлайн-работа без интернета. Все стили, скрипты, формулы KaTeX, изображения, диаграммы и шрифты сохранены локально. Вход в аккаунт и сетевые проверки Firebase эмулированы моками (`firebase-mock.js` и локальный `authGuard.js`).

---

## Основные разделы и быстрый старт

Чтобы начать изучение, откройте [`site/main.html`](file:///C:/Users/ZXKS/.gemini/antigravity/scratch/schmidtml_full_site/site/main.html) или [`site/index.html`](file:///C:/Users/ZXKS/.gemini/antigravity/scratch/schmidtml_full_site/site/index.html) в любом браузере:

### 1. Фундаментальные дисциплины
* **Python:** [`site/python/index.html`](file:///C:/Users/ZXKS/.gemini/antigravity/scratch/schmidtml_full_site/site/python/index.html)
  * Базовый блок: [`site/python/base.html`](file:///C:/Users/ZXKS/.gemini/antigravity/scratch/schmidtml_full_site/site/python/base.html)
  * Расширенный блок: [`site/python/advanced.html`](file:///C:/Users/ZXKS/.gemini/antigravity/scratch/schmidtml_full_site/site/python/advanced.html)
  * Алгоритмы: [`site/python/algorithms.html`](file:///C:/Users/ZXKS/.gemini/antigravity/scratch/schmidtml_full_site/site/python/algorithms.html)
* **Математика:** [`site/math/index.html`](file:///C:/Users/ZXKS/.gemini/antigravity/scratch/schmidtml_full_site/site/math/index.html)
  * Линейная алгебра: [`site/math/algebra.html`](file:///C:/Users/ZXKS/.gemini/antigravity/scratch/schmidtml_full_site/site/math/algebra.html)
  * Математический анализ: [`site/math/calculus.html`](file:///C:/Users/ZXKS/.gemini/antigravity/scratch/schmidtml_full_site/site/math/calculus.html)
  * Теория вероятностей и статистика: [`site/math/probability.html`](file:///C:/Users/ZXKS/.gemini/antigravity/scratch/schmidtml_full_site/site/math/probability.html)
  * Численные методы: [`site/math/numerical.html`](file:///C:/Users/ZXKS/.gemini/antigravity/scratch/schmidtml_full_site/site/math/numerical.html)
  * Теория информации: [`site/math/teorinf.html`](file:///C:/Users/ZXKS/.gemini/antigravity/scratch/schmidtml_full_site/site/math/teorinf.html)
  * Термины и определения: [`site/math/definitions.html`](file:///C:/Users/ZXKS/.gemini/antigravity/scratch/schmidtml_full_site/site/math/definitions.html)
* **Базы данных:** [`site/db/index.html`](file:///C:/Users/ZXKS/.gemini/antigravity/scratch/schmidtml_full_site/site/db/index.html)
  * PostgreSQL: [`site/db/postgresql.html`](file:///C:/Users/ZXKS/.gemini/antigravity/scratch/schmidtml_full_site/site/db/postgresql.html)
  * Redis: [`site/db/redis.html`](file:///C:/Users/ZXKS/.gemini/antigravity/scratch/schmidtml_full_site/site/db/redis.html)
* **Git:** [`site/github/index.html`](file:///C:/Users/ZXKS/.gemini/antigravity/scratch/schmidtml_full_site/site/github/index.html)
  * Базовый Git: [`site/github/basics.html`](file:///C:/Users/ZXKS/.gemini/antigravity/scratch/schmidtml_full_site/site/github/basics.html)
  * Рабочие процессы и ветвление: [`site/github/workflow.html`](file:///C:/Users/ZXKS/.gemini/antigravity/scratch/schmidtml_full_site/site/github/workflow.html)
  * Продвинутый Git: [`site/github/advanced.html`](file:///C:/Users/ZXKS/.gemini/antigravity/scratch/schmidtml_full_site/site/github/advanced.html)
* **Linux:** [`site/linux/index.html`](file:///C:/Users/ZXKS/.gemini/antigravity/scratch/schmidtml_full_site/site/linux/index.html)
  * Основы командной строки и администрирования: [`site/linux/basics.html`](file:///C:/Users/ZXKS/.gemini/antigravity/scratch/schmidtml_full_site/site/linux/basics.html)

### 2. Machine Learning, Deep Learning & AI
* **Классический ML и архитектуры:** [`site/ai/ml/index.html`](file:///C:/Users/ZXKS/.gemini/antigravity/scratch/schmidtml_full_site/site/ai/ml/index.html)
  * Классический Machine Learning: [`site/ai/ml/classic.html`](file:///C:/Users/ZXKS/.gemini/antigravity/scratch/schmidtml_full_site/site/ai/ml/classic.html)
  * Глубокое обучение (Deep Learning): [`site/ai/ml/dl.html`](file:///C:/Users/ZXKS/.gemini/antigravity/scratch/schmidtml_full_site/site/ai/ml/dl.html)
  * Временные ряды (Time Series): [`site/ai/ml/timeseries.html`](file:///C:/Users/ZXKS/.gemini/antigravity/scratch/schmidtml_full_site/site/ai/ml/timeseries.html)
  * Рекомендательные системы (RecSys): [`site/ai/ml/recsys.html`](file:///C:/Users/ZXKS/.gemini/antigravity/scratch/schmidtml_full_site/site/ai/ml/recsys.html)
* **NLP & Large Language Models:** [`site/ai/ml/nlp/index.html`](file:///C:/Users/ZXKS/.gemini/antigravity/scratch/schmidtml_full_site/site/ai/ml/nlp/index.html)
  * Базовый NLP: [`site/ai/ml/nlp/base.html`](file:///C:/Users/ZXKS/.gemini/antigravity/scratch/schmidtml_full_site/site/ai/ml/nlp/base.html)
  * Расширенный NLP & трансформеры: [`site/ai/ml/nlp/advanced.html`](file:///C:/Users/ZXKS/.gemini/antigravity/scratch/schmidtml_full_site/site/ai/ml/nlp/advanced.html)
  * Retrieval-Augmented Generation (RAG): [`site/ai/ml/nlp/rag.html`](file:///C:/Users/ZXKS/.gemini/antigravity/scratch/schmidtml_full_site/site/ai/ml/nlp/rag.html)
  * AI-агенты: [`site/ai/ml/nlp/agents.html`](file:///C:/Users/ZXKS/.gemini/antigravity/scratch/schmidtml_full_site/site/ai/ml/nlp/agents.html)
  * Оптимизация и квантизация LLM: [`site/ai/ml/nlp/optimization.html`](file:///C:/Users/ZXKS/.gemini/antigravity/scratch/schmidtml_full_site/site/ai/ml/nlp/optimization.html)
* **Компьютерное зрение (Computer Vision):**
  * Классическое CV: [`site/ai/ml/classic-cv.html`](file:///C:/Users/ZXKS/.gemini/antigravity/scratch/schmidtml_full_site/site/ai/ml/classic-cv.html)
  * Deep Learning в CV: [`site/ai/ml/cv/dl.html`](file:///C:/Users/ZXKS/.gemini/antigravity/scratch/schmidtml_full_site/site/ai/ml/cv/dl.html)
* **MLOps & инфраструктура:** [`site/ai/mlops/index.html`](file:///C:/Users/ZXKS/.gemini/antigravity/scratch/schmidtml_full_site/site/ai/mlops/index.html)
  * Docker: [`site/ai/mlops/docker.html`](file:///C:/Users/ZXKS/.gemini/antigravity/scratch/schmidtml_full_site/site/ai/mlops/docker.html)
  * Kubernetes (K8s): [`site/ai/mlops/k8s.html`](file:///C:/Users/ZXKS/.gemini/antigravity/scratch/schmidtml_full_site/site/ai/mlops/k8s.html)
  * Apache Kafka: [`site/ai/mlops/kafka.html`](file:///C:/Users/ZXKS/.gemini/antigravity/scratch/schmidtml_full_site/site/ai/mlops/kafka.html)
  * Трекинг экспериментов (MLflow, ClearML, W&B, TensorBoard)
  * Мониторинг (Prometheus, Grafana)

### 3. Банк вопросов, тесты и собеседования
* **Банк вопросов по направлениям:** [`site/bank/index.html`](file:///C:/Users/ZXKS/.gemini/antigravity/scratch/schmidtml_full_site/site/bank/index.html)
* **Материалы по собеседованиям:** [`site/ai/interviews/index.html`](file:///C:/Users/ZXKS/.gemini/antigravity/scratch/schmidtml_full_site/site/ai/interviews/index.html)
  * ML System Design: [`site/ai/interviews/mlsd.html`](file:///C:/Users/ZXKS/.gemini/antigravity/scratch/schmidtml_full_site/site/ai/interviews/mlsd.html)
  * Словарь терминов собеседований: [`site/ai/interviews/dictionary.html`](file:///C:/Users/ZXKS/.gemini/antigravity/scratch/schmidtml_full_site/site/ai/interviews/dictionary.html)
  * Алгоритмические задачи: [`site/ai/interviews/algo-tasks.html`](file:///C:/Users/ZXKS/.gemini/antigravity/scratch/schmidtml_full_site/site/ai/interviews/algo-tasks.html)
* **Интерактивные карты обучения (Roadmaps):** [`site/roadmap/index.html`](file:///C:/Users/ZXKS/.gemini/antigravity/scratch/schmidtml_full_site/site/roadmap/index.html) и [`site/roadmap/interactive.html`](file:///C:/Users/ZXKS/.gemini/antigravity/scratch/schmidtml_full_site/site/roadmap/interactive.html)
* **Практические задания:** [`site/practise/index.html`](file:///C:/Users/ZXKS/.gemini/antigravity/scratch/schmidtml_full_site/site/practise/index.html)
