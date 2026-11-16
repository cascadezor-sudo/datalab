"""Inventory static browser-storage and Firebase-style access without reading storage."""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "site"
OUTPUT = ROOT / "docs" / "modernization" / "storage-access-inventory.json"
# Line-oriented candidates only: no keys, values, source excerpts, or runtime data.
PATTERNS = [
    (re.compile(r"\b(localStorage|sessionStorage)\s*\.\s*(getItem|setItem|removeItem|key)\s*\("), "storage"),
    (re.compile(r"\b(?:db|database|firebase\.database\(\))\s*\.\s*ref\s*\("), "firebase.ref"),
    (re.compile(r"\.ref\s*\("), "firebase.ref.dynamic"),
    (re.compile(r"\b(?:storage|store)\s*\.\s*(getItem|setItem|removeItem|key)\s*\("), "storage.alias.dynamic"),
    (re.compile(r"\b(?:localStorage|sessionStorage)\s*\["), "storage.computed.dynamic"),
    (re.compile(r"\bDataLabStorage\s*\.\s*(read|mutate|setKV|getKV|removeKV|restore|bootstrapRestore|adoptLegacy|subscribe)\s*\("), "service"),
    (re.compile(r"\bDataLabStorage\s*\.\s*local\s*\.\s*(getItem|setItem|removeItem|updateJSON)\s*\("), "service.local"),
    (re.compile(r"\(window\.DataLabStorage\?\.local\s*\|\|\s*localStorage\)\s*\.\s*(getItem|setItem|removeItem)\s*\("), "service.local.bootstrap"),
    (re.compile(r"\b(?:storage|service)\s*\.\s*(read|mutate|setKV|getKV|removeKV|restore|bootstrapRestore|adoptLegacy|subscribe)\s*\("), "service.alias.dynamic"),
    (re.compile(r"\b(?:connection|indexedDB|records|recovery)\s*\.\s*(open|transaction|put|get|delete)\s*\("), "indexeddb.candidate"),
]


def inventory():
    entries = set()
    for path in sorted(SOURCE.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in {".js", ".html"}:
            continue
        relative = path.relative_to(ROOT).as_posix()
        for line_number, line in enumerate(path.read_text(encoding="utf-8", errors="replace").splitlines(), 1):
            direct_ref = False
            for pattern, kind in PATTERNS:
                for match in pattern.finditer(line):
                    if kind == "storage":
                        operation = f"{match.group(1)}.{match.group(2)}"
                    elif kind == "storage.alias.dynamic":
                        operation = f"{kind}.{match.group(1)}"
                    elif kind.startswith("service") or kind == "indexeddb.candidate":
                        operation = f"{kind}.{match.group(1)}"
                    else:
                        operation = kind
                    if operation == "firebase.ref":
                        direct_ref = True
                    if operation == "firebase.ref.dynamic" and direct_ref:
                        continue
                    entries.add((relative, line_number, operation))
    return [{"file": file, "line": line, "operation": operation}
            for file, line, operation in sorted(entries)]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    action = parser.add_mutually_exclusive_group()
    action.add_argument("--check", action="store_true", help="Compare the generated inventory without writing")
    action.add_argument("--write", action="store_true", help="Explicitly regenerate the inventory file")
    args = parser.parse_args()
    rendered = json.dumps(inventory(), ensure_ascii=False, indent=2) + "\n"
    if args.check:
        if not OUTPUT.exists() or OUTPUT.read_text(encoding="utf-8") != rendered:
            raise SystemExit("Storage inventory differs; regenerate it.")
    elif args.write:
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT.write_text(rendered, encoding="utf-8", newline="\n")
    print(f"{len(json.loads(rendered))} static access candidates")


if __name__ == "__main__":
    main()

