// How a figure is printed on the ABS challenge board.
//
// Six sections and the page's own slab row share these, and they have to agree:
// a rate printed to one decimal in one board and to two in the next reads as
// two different measurements of the same thing. Holding them in one file is
// what keeps that from drifting once the sections are edited separately.
//
// EVERY ONE OF THEM ANSWERS `null` WITH AN EM DASH rather than with a zero. A
// club that called for no challenges and a club whose figure has not been
// computed are different facts, and 0.0% would state the first when it means
// the second. The generator leaves a genuinely absent cut null on purpose
// (scripts/lib/abs-challenges.mjs), so the page has to carry that through.

export const pct1 = (x) => (x == null ? '—' : `${(x * 100).toFixed(1)}%`)
export const num1 = (x) => (x == null ? '—' : x.toFixed(1))
export const num2 = (x) => (x == null ? '—' : x.toFixed(2))
export const commas = (n) => (n == null ? '—' : n.toLocaleString('en-US'))
export const inches = (x) => (x == null ? '—' : `${x.toFixed(1)} in`)
