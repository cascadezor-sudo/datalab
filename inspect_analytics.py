import re
import os

files = [
    "site/analytics/product/ab.html",
    "site/analytics/product/ab-design.html",
    "site/analytics/product/metrics.html",
    "site/analytics/product/logging.html",
    "site/analytics/product/research.html",
    "site/analytics/product/bi.html",
    "site/analytics/product/tools.html",
    "site/analytics/practise/ab.html",
    "site/analytics/practise/metrics.html",
    "site/analytics/bank/product.html",
    "site/db/dwh.html",
    "site/python/data.html",
    "site/bank/db.html"
]

total = 0
for f in files:
    with open(f, "r", encoding="utf-8") as fp:
        c = fp.read()
    qs = re.findall(r'<li class="question"[^>]*data-md-id="([^"]+)"', c)
    names = re.findall(r'<div class="name"[^>]*id="([^"]+)">\s*([^<]+)', c)
    print(f"=== {f} ({len(qs)} questions) ===")
    for q, (nid, ntext) in zip(qs, names):
        print(f"  {q}: {ntext.strip()}")
    total += len(qs)

print(f"\nTOTAL QUESTIONS: {total}")
