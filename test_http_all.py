# -*- coding: utf-8 -*-
import urllib.request

urls = [
    '/analytics/product/ab.html',
    '/analytics/product/ab-design.html',
    '/analytics/product/metrics.html',
    '/analytics/product/logging.html',
    '/analytics/product/research.html',
    '/analytics/product/bi.html',
    '/analytics/product/tools.html',
    '/analytics/practise/ab.html',
    '/analytics/practise/metrics.html',
    '/analytics/bank/product.html',
    '/db/dwh.html',
    '/python/data.html',
    '/bank/db.html'
]

for u in urls:
    try:
        resp = urllib.request.urlopen('http://localhost:8080' + u, timeout=5)
        print(f"{u:<35} -> HTTP {resp.status} ({len(resp.read()):,} bytes)")
    except Exception as e:
        print(f"{u:<35} -> ERROR: {e}")
