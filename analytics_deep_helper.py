# -*- coding: utf-8 -*-
"""
Deep textbook generator helper for SchmidtML Analytics.
Avoids regex replacement issues with KaTeX formulas.
"""

import os

def render_question(q_id, title, rating, definition_html, explanation_html, example_html, code_lang, code_content, warning_items, remark_html, teormin_qa_list):
    warnings_lis = "".join(f"\n        <li><b>{w[0]}</b> {w[1]}</li>" for w in warning_items)
    teormin_lis = "".join(f"\n        <li><p><b>{qa[0]}</b></p><p>{qa[1]}</p></li>" for qa in teormin_qa_list)
    
    code_block = ""
    if code_content and code_lang:
        code_block = f"""\n    <div class="code-block" data-lang="{code_lang}">
      <pre><code>{code_content.strip()}</code></pre>
    </div>"""

    return f"""<li class="question" data-md-source="true" data-md-id="{q_id}" data-interview="{rating}">
  <div class="name" id="{q_id}">
    {title}
  </div>
  <div class="content">
    <div class="info-card-auto" data-type="definition" data-title="Определение">
      {definition_html.strip()}
    </div>
    <div class="info-card-auto" data-type="explanation" data-title="Под капотом и математика">
      {explanation_html.strip()}
    </div>
    <div class="info-card-auto" data-type="example" data-title="Практический пример и бизнес-контекст">
      {example_html.strip()}
    </div>{code_block}
    <div class="info-card-auto" data-type="warning" data-title="Главные подводные камни и ошибки">
      <ul>{warnings_lis}
      </ul>
    </div>
    <div class="info-card-auto" data-type="remark" data-title="На собеседовании и в продакшене">
      {remark_html.strip()}
    </div>
    <div class="info-card-auto" data-type="teormin" data-title="Теоретический минимум">
      <ol>{teormin_lis}
      </ol>
    </div>
  </div>
</li>"""

def update_page_questions(html_path, questions_html):
    with open(html_path, "r", encoding="utf-8") as f:
        content = f.read()

    start_tag = '<ol id="questions">'
    end_tag = '</ol>'
    start_pos = content.find(start_tag)
    if start_pos == -1:
        raise ValueError(f"Could not find {start_tag} in {html_path}")
    
    end_pos = content.rfind(end_tag)
    if end_pos == -1 or end_pos <= start_pos:
        raise ValueError(f"Could not find {end_tag} after {start_tag} in {html_path}")

    new_content = (
        content[:start_pos + len(start_tag)]
        + "\n"
        + questions_html
        + "\n    "
        + content[end_pos:]
    )

    with open(html_path, "w", encoding="utf-8") as f:
        f.write(new_content)
    print(f"Updated {html_path}: size is now {os.path.getsize(html_path):,} bytes")
