```latex
\begin{document}
    \newcommand{\AND}{\unskip
    \cleaders\copy\ANDbox\hskip\wd\ANDbox
    \ignorespaces
    }
    \newsavebox\ANDbox
    \sbox\ANDbox{}

    \begin{header}
    	\textbf{\fontsize{20 pt}{20 pt}\selectfont Ученик, NLP / LLM Engineer}

    	\normalsize
    	\kern 0.25 cm
    	\mbox{{\color{black}\footnotesize\faMapMarker*}\hspace*{0.13cm}Remote / Relocation-ready}
    	\kern 0.25 cm%
    	\AND \\

    	\AND%
    	\kern 0.25 cm%
    	\mbox{\hrefWithoutArrow{}{\color{black}{\footnotesize}\hspace*{0.13cm}Русский (Native)\;\;\; Английский (C1) \;\;\; Турецкий (B1)}}%
    	\kern 0.25 cm%
    	\kern 0.25 cm%
    \end{header}

    \section{Education}
    \begin{twocolentry}{\textit{Бизнес-Информатика}}
    	\textit{}
    \textbf{Университет}

    {\textit{Бакалавриат}, Кибертехнологии, математика и статистика}
    \end{twocolentry}

    \section{Experience}

\vspace{0.25 cm}
\begin{twocolentry}{
        \textit{}

        \textit{Авг 2024 -- н.в.}}
    \textbf{ML Engineer}

    \textit{Крупный аэропортовый холдинг}
\end{twocolentry}

\begin{onecolentry}
    \begin{highlights}

        \item Спроектировал и внедрил production-ready RAG-систему для анализа операционной документации и диалогов служб аэропорта, обеспечив семантический поиск и ответы на естественном языке по внутренней базе знаний.

        \item Разработал LLM-агентов для автоматического анализа переговоров, извлечения событий, классификации инцидентов и генерации структурированных отчетов, сократив время ручного анализа на 60\%.

        \item Реализовал orchestration LLM workflows с использованием tool-calling и multi-step reasoning, обеспечив выполнение сложных задач анализа через композицию retrieval, extraction и summarization модулей.

        \item Оптимизировал latency и throughput inference pipeline (batching, async processing, caching), обеспечив p95 latency < 700 мс при обработке production-нагрузки.

        \item Развернул ML-систему в production (Docker, FastAPI), обеспечив масштабируемую обработку данных и интеграцию с внутренними системами.

    \end{highlights}
\end{onecolentry}

\vspace{0.25 cm}
\begin{twocolentry}{
        \textit{}
        \textit{Мар 2022 -- Авг 2024}}
    \textbf{NLP Engineer}

    \textit{Университетская NLP-лаборатория}
\end{twocolentry}

\begin{onecolentry}
  \begin{highlights}

     \item Разрабатывал и обучал Transformer-based модели (BERT, RoBERTa, mBERT) для задач классификации текстов, semantic similarity и information extraction в мультиязычных сценариях (английский / турецкий).

    \item Проводил fine-tuning pretrained моделей на domain-specific корпусах, повысив F1-score на 15–20\% по сравнению с baseline решениями.

    \item Проводил эксперименты по domain adaptation и transfer learning, повысив robustness моделей.

    \item Развернул NLP-модели в production-среде с использованием Docker и FastAPI, обеспечив inference API для интеграции с исследовательскими системами.
  \end{highlights}
\end{onecolentry}

\vspace{0.25 cm}
\begin{twocolentry}{
        \textit{}
        \textit{Апр 2021 -- Мар 2022}}
    \textbf{NLP Engineer}

    \textit{IT-компания}
\end{twocolentry}

\begin{onecolentry}
    \begin{highlights}
        \item Разработал E2E RAG-пайплайн для корпоративной базы знаний, обеспечив прирост {Recall@5 на +13\%} и {NDCG@10 на +6\%}.

        \item Спроектировал и внедрил AI-ассистента для клиентов и инженеров с доступом к документации через естественный язык, сократив среднее время получения ответа с $\sim$ 6 минут до {менее 2 минут}.

        \item Внедрил offline-метрики качества и мониторинг, подготовил production-ready MVP с CI/CD.

        \item Оптимизировал инференс (batching, quantization), повысив пропускную способность и стабильность сервисов в production.
    \end{highlights}
\end{onecolentry}

    \section{Skills}

\begin{onecolentry}
    \textbf{Frameworks \& Libraries:} PyTorch, Transformers, ONNX, bitsandbytes, scikit-learn, TensorBoard, NumPy, Polars, PEFT, vLLM, LlamaIndex, LangChain, LangGraph, FAISS, Qdrant
\end{onecolentry}

\begin{onecolentry}
    \textbf{Technologies:} Docker, Kubernetes, MLflow, Git, CI/CD, GitHub Actions, pytest
\end{onecolentry}

\begin{onecolentry}
    \textbf{Code:} Python, PostgreSQL
\end{onecolentry}

\begin{onecolentry}
    \textbf{Knowledge (ML):} Deep Learning, NLP, LLM, RAG, Agents, Data Science, Computer Vision, Classic ML
\end{onecolentry}
\vspace*{\fill}
\begin{center}
    \tiny\textcolor{gray}{I agree to the processing of personal data provided in this document for realising the recruitment process pursuant to applicable personal data protection regulations.}
\end{center}

\end{document}
```
