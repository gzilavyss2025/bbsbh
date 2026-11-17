// WILD RIDES: a game's win-probability line as a short word, for "draw a game, find its match".
//
// PAA then a symbol per segment (the SAX idea, Lin & Keogh 2003): cut the line into SEGMENTS
// equal stretches, keep each stretch's mean, write each mean as one character. Win probability
// is bounded 0–100 rather than Gaussian, so the 36 symbols are even steps, not SAX's normal
// breakpoints. Every game becomes a 24-character string; matching a sketch is a squared
// distance over 24 numbers, instant across a season in the browser.

export const SEGMENTS = 24
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz'
const STEPS = ALPHABET.length - 1

// The mean of each of `m` equal stretches of `v` (piecewise aggregate approximation).
export function paa(v, m = SEGMENTS) {
  if (!v.length) return Array(m).fill(50)
  return Array.from({ length: m }, (_, i) => {
    const a = Math.floor((i * v.length) / m)
    const b = Math.max(a + 1, Math.floor(((i + 1) * v.length) / m))
    let s = 0
    for (let k = a; k < b; k++) s += v[Math.min(k, v.length - 1)]
    return s / (b - a)
  })
}

// A 0–100 line to its word, and back (to the centre of each symbol's step).
export const encodeShape = (line) => paa(line).map((y) => ALPHABET[Math.round((Math.max(0, Math.min(100, y)) / 100) * STEPS)]).join('')
export const decodeShape = (word) => [...word].map((c) => (Math.max(0, ALPHABET.indexOf(c)) / STEPS) * 100)

// How far a sketch (already SEGMENTS numbers, 0–100) is from a game's word. Lower is closer.
export function shapeDistance(sketch, word) {
  const g = decodeShape(word)
  let d = 0
  for (let i = 0; i < SEGMENTS; i++) d += (sketch[i] - g[i]) ** 2
  return d
}
