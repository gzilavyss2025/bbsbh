// Comments blanked, every newline kept, so a line number still points at the file.
// A scanner, not a regex: a `/*` or ` // ` inside a string or a template is code,
// and must not blank what follows it (#1831). Strings stay in the output, because
// the guards read values such as 'calc(var(--z-toast) + 5)' and '(min-width: 740px)'.
// `kind` is 'css' (block comments only) or anything else (JS: `//` too). Not
// handled: regex literals and `${}` inside a template.

const blank = (m) => m.replace(/[^\n]/g, ' ')

function skipString(src, i) {
  const quote = src[i]
  let j = i + 1
  while (j < src.length && src[j] !== quote) {
    if (src[j] === '\\') j++
    else if (quote !== '`' && src[j] === '\n') return j
    j++
  }
  return Math.min(j + 1, src.length)
}

export function maskComments(src, kind) {
  const js = kind !== 'css'
  let out = ''
  let i = 0
  while (i < src.length) {
    const c = src[i]
    const d = src[i + 1]
    let end = -1
    if (c === '/' && d === '*') {
      const close = src.indexOf('*/', i + 2)
      end = close < 0 ? src.length : close + 2
      out += blank(src.slice(i, end))
    } else if (js && c === '/' && d === '/' && (i === 0 || /\s/.test(src[i - 1]))) {
      const nl = src.indexOf('\n', i)
      end = nl < 0 ? src.length : nl
      out += blank(src.slice(i, end))
    } else if (c === '"' || c === "'" || (js && c === '`')) {
      end = skipString(src, i)
      out += src.slice(i, end)
    }
    if (end > 0) { i = end; continue }
    out += c
    i++
  }
  return out
}
