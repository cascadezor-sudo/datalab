import re

for fname in ['gen_deep_group1_p1.py', 'gen_deep_group1_p2.py']:
    with open(fname, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # We want any triple quote """ that does NOT have an r immediately before it:
    # (?<![a-zA-Z0-9_])""" -> r"""
    new_content = re.sub(r'(?<!r)"""', 'r"""', content)
    with open(fname, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(f'Processed {fname}')
