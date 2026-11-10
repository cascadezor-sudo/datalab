import re
from pathlib import Path

for fname in ['gen_deep_group1_p1.py', 'gen_deep_group1_p2.py']:
    source_path = Path(__file__).resolve().parents[1] / 'generators' / 'analytics' / fname
    with open(source_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # We want any triple quote """ that does NOT have an r immediately before it:
    # (?<![a-zA-Z0-9_])""" -> r"""
    new_content = re.sub(r'(?<!r)"""', 'r"""', content)
    with open(source_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(f'Processed {fname}')
