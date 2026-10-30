# -*- coding: utf-8 -*-
import sys
sys.stdout.reconfigure(encoding='utf-8')
import os
from bs4 import BeautifulSoup

pages = [
    'site/analytics/product/ab.html',
    'site/analytics/product/ab-design.html',
    'site/analytics/product/metrics.html',
    'site/analytics/product/logging.html',
    'site/analytics/product/research.html',
    'site/analytics/product/bi.html',
    'site/analytics/product/tools.html',
    'site/analytics/practise/ab.html',
    'site/analytics/practise/metrics.html',
    'site/analytics/bank/product.html',
    'site/db/dwh.html',
    'site/python/data.html',
    'site/bank/db.html'
]

total_size = 0
total_questions = 0

print(f"| {'Модуль':<40} | {'Размер':<14} | {'Вопросов':<10} | {'Карточек teormin':<18} |")
print("|" + "-"*42 + "|" + "-"*16 + "|" + "-"*12 + "|" + "-"*20 + "|")

for p in pages:
    sz = os.path.getsize(p)
    total_size += sz
    with open(p, 'r', encoding='utf-8') as f:
        soup = BeautifulSoup(f, 'html.parser')
    qs = soup.select('ol#questions > li.question')
    cnt = len(qs)
    total_questions += cnt
    teormins = len(soup.select('div.info-card-auto[data-type="teormin"]'))
    print(f"| {p:<40} | {sz:>11,} Б | {cnt:>10} | {teormins:>18} |")

print("|" + "-"*42 + "|" + "-"*16 + "|" + "-"*12 + "|" + "-"*20 + "|")
print(f"| {'ИТОГО':<40} | {total_size:>11,} Б | {total_questions:>10} | {total_questions:>18} |")
