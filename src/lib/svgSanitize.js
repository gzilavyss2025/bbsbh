// Make remote SVG markup safe to put into a document, by PARSING it.
//
// The lab's two mark editors are the one place this app inlines art it fetched
// rather than pointing an <img> at it — they have to, because a shape can't be
// clicked through an <img> (ADR-0031). Everywhere else the precomputed-art
// pattern avoids the question entirely.
//
// This was first written as a pair of regex replaces over the markup, and that
// was wrong in the way regex HTML filtering is always wrong. CodeQL caught two
// concrete holes on the way in:
//
//   • `</script\t\n foo>` is a valid closing tag that `<\/script\s*>` doesn't
//     match, so the opening tag gets stripped and the payload survives.
//   • A single pass can CREATE what it removes: `<scr<script>ipt>` becomes
//     `<script>` once the inner match is deleted.
//
// Neither is fixable by a better pattern — the class of bug is the technique.
// A parser has no such holes: it resolves the real tree first, so there is
// nothing left to smuggle past a pattern, and what comes back out is a
// serialization of nodes rather than an edit of a string.
//
// Browser-only, deliberately: DOMParser is what makes this a parse instead of a
// filter, and the callers (screens/identity-lab/editors/*) are dev-only lab UI.
// The Node-side modules that share this art — logoMono.js, logoRecolor.js,
// scripts/lib/* — never inline anything, so they don't need it.

// Elements that can execute or embed arbitrary content. `foreignObject` carries
// HTML into SVG (and logoMono can't re-ink it anyway); the rest are script or
// script-adjacent.
const FORBIDDEN_ELEMENTS = new Set(['script', 'foreignobject', 'iframe', 'embed', 'object'])

// URL-bearing attributes: a `javascript:` value in one of these is a script by
// another name.
const URL_ATTRS = new Set(['href', 'xlink:href', 'src', 'from', 'to', 'values'])

function isScriptUrl(value) {
  // Browsers ignore whitespace and control characters inside a scheme — a
  // newline spliced into the middle of "javascript:" still runs — so they come
  // out before the check. Dropped by code point rather than by a regex
  // character class: exact about what "control character" means, and free of
  // the literal control characters in a pattern that `no-control-regex`
  // (rightly) objects to.
  const compact = [...String(value ?? '')].filter((c) => c.codePointAt(0) > 0x20).join('')
  return /^[a-z0-9+.-]*script:/i.test(compact)
}

// The same markup with every executable element and attribute removed, or null
// if it doesn't parse as SVG at all. Returning null rather than a best-effort
// string matters: unparseable markup is exactly the case where a filter would
// have guessed, and the caller can fall back to showing nothing.
export function sanitizeSvgMarkup(svg) {
  const source = String(svg ?? '')
  if (!source.includes('<svg')) return null
  if (typeof DOMParser === 'undefined') return null

  const doc = new DOMParser().parseFromString(source, 'image/svg+xml')
  // A parse error is reported as a document containing <parsererror>, not by
  // throwing. Art that doesn't parse is art we can't reason about.
  if (doc.querySelector('parsererror') || doc.documentElement?.localName !== 'svg') return null

  for (const el of [...doc.querySelectorAll('*')]) {
    if (FORBIDDEN_ELEMENTS.has(el.localName?.toLowerCase())) {
      el.remove()
      continue
    }
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase()
      // Every `on*` handler, whatever its casing or namespace prefix — read off
      // the parsed attribute name, so there is no pattern to slip between.
      if (name.startsWith('on') || (URL_ATTRS.has(name) && isScriptUrl(attr.value))) {
        el.removeAttribute(attr.name)
      }
    }
  }

  return new XMLSerializer().serializeToString(doc.documentElement)
}
