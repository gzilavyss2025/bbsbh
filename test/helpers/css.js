// Helpers for tests that read a stylesheet as source text.

export const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '')

// The declaration block of a rule whose selector is exactly `selector` — never
// a pseudo, a compound or a longer name that merely starts with it. Feed it
// comment-stripped CSS. Returns null when no such rule exists.
export function ruleBody(css, selector) {
  let from = 0
  for (;;) {
    const at = css.indexOf(selector, from)
    if (at === -1) return null
    from = at + selector.length
    const before = at === 0 ? '\n' : css[at - 1]
    if (!'\n;}{,'.includes(before)) continue
    let i = from
    while (css[i] === ' ' || css[i] === '\n' || css[i] === '\r') i += 1
    if (css[i] !== '{') continue
    return css.slice(i + 1, css.indexOf('}', i))
  }
}
