```latex

\begin{document}
    \newcommand{\AND}{\unskip
    \cleaders\copy\ANDbox\hskip\wd\ANDbox
    \ignorespaces
    }
    \newsavebox\ANDbox
    \sbox\ANDbox{}
    
    \begin{header}
    	\textbf{\fontsize{20 pt}{20 pt}\selectfont Ученица, ML Engineer (InfoSec)}
    	
    	\normalsize
    	\kern 0.25 cm
    	\mbox{\hrefWithoutArrow{https://example.com/hidden}{\color{black}{\footnotesize\faTelegram}\hspace*{0.13cm}@hidden}}
    	\kern 0.25 cm
    	\AND
    	\kern 0.25 cm
    	\mbox{\hrefWithoutArrow{mailto:hidden-email@example.com}{\color{black}{\footnotesize\faEnvelope}\hspace*{0.13cm}hidden-email@example.com}}%
    	\kern 0.25 cm%
    	\AND
    	\mbox{\hrefWithoutArrow{tel:+79998887766}{\color{black}{\footnotesize\faPhone*}\hspace*{0.13cm}+7 XXX XXX XX XX}}%
    	\kern 0.25 cm%
    	\AND \\
    	\AND%
    	\kern 0.25 cm%
    	\mbox{\hrefWithoutArrow{}{\color{black}{\footnotesize}\hspace*{0.13cm}Русский (Native)\;\;\; Английский}}%
    	\kern 0.25 cm%
    \end{header}
    
    	
    \section{Education}
    \begin{twocolentry}{\textit{}}
    \textbf{Технический университет}
    
    {\textit{Магистратура}, Управление проектами в IT}
    \end{twocolentry}

    \vspace{0.10 cm}

    \begin{twocolentry}{\textit{}}
    \textbf{Университет}
    
    {\textit{Бакалавриат}, Информационная безопасность}
    \end{twocolentry}
    
    \section{Experience}
    \vspace{0.25 cm}
    \begin{twocolentry}{
    		\textit{}    
    		
    		\textit{2024 -- н.в.}}
    	\textbf{ML Engineer (InfoSec)}
    	
    	\textit{InfoSec Product Company}
    \end{twocolentry}
    
    \begin{onecolentry}
    	\begin{highlights}
    		\item Тестирование и интеграция ML-модели в продукт информационной безопасности (мониторинг инцидентов ПАМ) для автоматизации системы алертов: выявление нехарактерного поведения пользователей в реальном времени, отказ от ручного прописывания правил администраторами.
    		
    		\item Обучение и оценка моделей (XGBoost, Random Forest, CatBoost, Ensemble, Logistic Regression) по метрикам ROC AUC, Precision, Recall и F1-Score.
    	
    		\item Очистка и анализ данных, выявление паттернов опасных сессий: сбор и парсинг сырых системных логов (pandas, re), проектирование признаков для детекции структурных нарушений и аномальной активности.

    		\item Поиск потенциальных уязвимостей в условиях отсутствия разметки (unsupervised learning): пространственная кластеризация для изоляции шума, автоматическое выделение кластеров скомпрометированных сессий и формирование целевой переменной.
    	\end{highlights}
    \end{onecolentry}	
    
    
    
    \vspace{0.25 cm}
    \begin{twocolentry}{
    		\textit{}    
    		
    		\textit{2022 -- 2024}}
    	\textbf{ML Engineer}
    	
    	\textit{InfoSec Product Company}
    \end{twocolentry}
    
    \begin{onecolentry}
    	\begin{highlights}
    		\item Разработан и внедрён корпоративный поиск по внутренней базе знаний (Confluence/Jira) для первой линии техподдержки (L1): ускорение закрытия тикетов за счёт быстрого поиска релевантных инструкций.
    		
    		\item Обучена NLP-модель для автоматической сортировки входящих заявок (triage) и интеллектуальной маршрутизации по отделам — снижена ручная нагрузка на операторов, улучшен SLA первой реакции.
    		
    		\item Построен пайплайн обработки текстов: парсинг страниц, document chunking, векторизация; поднята векторная база данных (Vector DB / FAISS) для семантического поиска.
    		
    		\item Реализована RAG-архитектура на LangChain: настроены промпты для локальной LLM с исключением галлюцинаций и обязательным цитированием источников.
    		
    		\item Выстроены процессы MLOps: Docker-контейнеры, микросервисы на FastAPI, CI/CD пайплайны (GitHub Actions / GitLab CI), мониторинг (Prometheus/Grafana), квантованные модели (int8) и кэширование для оптимизации инференса.
    	\end{highlights}
    \end{onecolentry}
    
    \section{Skills}
    \begin{onecolentry}
    	\textbf{Languages:} Python, SQL, Bash
    \end{onecolentry}

    \begin{onecolentry}
    	\textbf{Frameworks / Libraries:} PyTorch, Transformers, LangChain, FAISS, Qdrant, XGBoost, CatBoost, scikit-learn, pandas, NumPy, Polars, imbalanced-learn, PEFT, vLLM, ONNX, bitsandbytes
    \end{onecolentry}
    
    \begin{onecolentry}
    	\textbf{Technologies:} FastAPI, Docker, Kubernetes, MLflow, Git, GitHub Actions, GitLab CI, Prometheus, Grafana, pytest
    \end{onecolentry}
    
    \begin{onecolentry}
    	\textbf{Knowledge (ML):} Classic ML, Deep Learning, NLP, LLM, RAG, Anomaly Detection, Unsupervised Learning
    \end{onecolentry}
\end{document}
```