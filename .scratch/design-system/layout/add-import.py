#!/usr/bin/env python3
"""Add `import { Stack } from '<rel>/components/ui/layout/Stack.jsx'` to a JSX file.

usage: add-import.py FILE [Part]   (Part: Stack by default, or Cluster or Grid)
Skips a file that already imports the part. Inserts after the last top-level import.
"""
import os, re, sys
path = sys.argv[1]
part = sys.argv[2] if len(sys.argv) > 2 else 'Stack'
text = open(path).read()
if re.search(r"import \{[^}]*\b%s\b[^}]*\} from '[^']*ui/layout/%s\.jsx'" % (part, part), text):
    sys.exit(0)
rel = os.path.relpath('src/components/ui/layout/%s.jsx' % part, os.path.dirname(path))
if not rel.startswith('.'):
    rel = './' + rel
line = "import { %s } from '%s'\n" % (part, rel)
last = None
for m in re.finditer(r"^import(?:[^;'\n]|\n(?!\n))*?from '[^']+'\n|^import '[^']+'\n", text, re.M):
    last = m
if not last:
    sys.exit(f'{path}: no import found')
text = text[:last.end()] + line + text[last.end():]
open(path, 'w').write(text)
print(f'{path}: + {line.strip()}')
