#!/usr/bin/env python3
"""Remove the layout declarations a Stack now owns from a one-class CSS rule.

usage: strip-css.py FILE CLASS...
Drops `display: flex`, `flex-direction: column` and `gap` from `.CLASS { ... }`.
When nothing is left the whole rule goes, and so does one blank line after it.
Prints what stays, so the diff is reviewed by eye. Refuses a rule holding a comment.
"""
import re, sys
path, *classes = sys.argv[1:]
text = open(path).read()
for cls in classes:
    m = re.search(r'^\.%s \{\n((?:[^\n]*\n)*?)\}\n' % re.escape(cls), text, re.M)
    if not m:
        sys.exit(f'{path}: no one-class rule for .{cls}')
    body = m.group(1)
    if '/*' in body:
        sys.exit(f'{path}: .{cls} holds a comment; edit by hand')
    kept = [l for l in body.splitlines() if not re.match(r'\s*(display: flex|flex-direction: column|gap: [^;]+);\s*$', l)]
    if len(body.splitlines()) - len(kept) != 3:
        sys.exit(f'{path}: .{cls} did not hold exactly display/flex-direction/gap')
    if kept:
        new = '.%s {\n%s\n}\n' % (cls, '\n'.join(kept))
        text = text[:m.start()] + new + text[m.end():]
        print(f'{path}: .{cls} keeps {len(kept)} declaration(s)')
    else:
        end = m.end()
        if text[end:end + 1] == '\n':
            end += 1
        text = text[:m.start()] + text[end:]
        print(f'{path}: .{cls} deleted')
open(path, 'w').write(text)
