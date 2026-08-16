#!/usr/bin/env python3
from pathlib import Path
import re, sys

root = Path(__file__).resolve().parents[1]
workflow_dir = root / '.github' / 'workflows'
patterns = {
    r'actions/checkout@v4\b': 'actions/checkout@v4 (Node 20-era)',
    r'actions/setup-node@v4\b': 'actions/setup-node@v4 (older action generation)',
    r'actions/upload-artifact@v4\b': 'actions/upload-artifact@v4 (Node 20-era)',
    r'actions/upload-pages-artifact@v3\b': 'actions/upload-pages-artifact@v3 (older Pages artifact action)',
    r'actions/deploy-pages@v4\b': 'actions/deploy-pages@v4 (older Pages deploy action)',
}

bad = []
files = sorted([*workflow_dir.glob('*.yml'), *workflow_dir.glob('*.yaml')]) if workflow_dir.exists() else []
for path in files:
    text = path.read_text(encoding='utf-8', errors='replace')
    for pattern, label in patterns.items():
        if re.search(pattern, text):
            bad.append((path.relative_to(root), label))

if bad:
    print('Outdated GitHub Action references found:')
    for path, label in bad:
        print(f'  - {path}: {label}')
    print('\nDelete or update the listed workflow file(s). Keep .github/workflows/static.yml as the canonical Little Realm Pages workflow.')
    sys.exit(1)

print('Workflow audit passed.')
print('Workflow files checked:')
for path in files:
    print(f'  - {path.relative_to(root)}')
