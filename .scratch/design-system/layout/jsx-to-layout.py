#!/usr/bin/env python3
"""Turn `<div className="x">...</div>` into `<Stack gap="g" className="x">...</Stack>`.

usage: jsx-to-layout.py FILE PART CLASS=GAP[:as] ...   (PART is Stack, Cluster or Grid)

Finds each JSX element whose className is EXACTLY the class (one static string
and nothing else), swaps the opening tag, and swaps the matching closing tag by
counting nested same-name tags. Refuses when the opening tag has other props,
when the closing tag cannot be matched, or when the class is not found. It
never touches the CSS: that is a separate, reviewed edit.
"""
import re, sys

path, part, *specs = sys.argv[1:]
text = open(path).read()
for spec in specs:
    cls, _, rest = spec.partition('=')
    gap, _, as_ = rest.partition(':')
    count = 0
    while True:
        m = re.search(r'<([a-z]+)\s+className="%s"\s*>' % re.escape(cls), text)
        if not m:
            break
        tag = m.group(1)
        # find the matching close, counting nested same-name tags
        depth, i = 1, m.end()
        pat = re.compile(r'<%s(?=[\s>/])|</%s>' % (tag, tag))
        while depth:
            n = pat.search(text, i)
            if not n:
                sys.exit(f'{path}: no matching </{tag}> for .{cls}')
            if n.group(0).startswith('</'):
                depth -= 1
            else:
                # a self-closing same-name tag does not nest
                end = text.index('>', n.end())
                if text[end - 1] != '/':
                    depth += 1
            i = n.end()
            last = n
        want_tag = as_ or 'div'
        if tag != want_tag:
            sys.exit(f'{path}: .{cls} is a <{tag}>; pass :{tag} to say so')
        attr = f' as="{tag}"' if tag != 'div' else ''
        gapattr = f' gap="{gap}"' if gap != ('base' if part == 'Stack' else 'snug') else ''
        opening = f'<{part}{gapattr}{attr} className="{cls}">'
        text = text[:m.start()] + opening + text[m.end():last.start()] + f'</{part}>' + text[last.end():]
        count += 1
    if not count:
        sys.exit(f'{path}: no <… className="{cls}"> found')
    print(f'{path}: .{cls} -> <{part}{" gap=" + gap if gap else ""}> x{count}')
open(path, 'w').write(text)
