// Which word actually differs between a contract file's raw name and a
// candidate's roster name — the one thing a reviewer is really comparing, and
// the thing that is hardest to see when the two strings are nearly identical.
// "Belliard, Ron" against "Belliard, Ronnie" is a one-word decision hiding
// inside two words that look the same at a glance.
//
// Pure string work: no React, no DOM. Returns SEGMENTS rather than markup, so
// the component decides how a differing word is dressed.

// Diacritics off, case folded, and the punctuation that a source file and a
// roster spell differently (periods after an initial, apostrophes in O'Neill,
// hyphens) removed — so "O'Neill" and "ONeill" are the same word, and only a
// genuinely different word is called out.
function fold(word) {
  return word
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase() // caps-js-exempt: comparison key, never rendered
    .replace(/[.'’-]/g, '')
}

const SEGMENT = /[\p{L}\p{N}.'’-]+|[^\p{L}\p{N}.'’-]+/gu

function segments(name) {
  return (name ?? '').match(SEGMENT) ?? []
}

function isWord(segment) {
  return /[\p{L}\p{N}]/u.test(segment)
}

// A multiset, not a set: a name that repeats a word ("Griffey, Ken Ken") must
// only match the other side's word once, or the second copy reads as shared
// when it is the very thing that differs.
function counts(name) {
  const map = new Map()
  for (const segment of segments(name)) {
    if (!isWord(segment)) continue
    const key = fold(segment)
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return map
}

function mark(name, otherCounts) {
  return segments(name).map((text) => {
    if (!isWord(text)) return { text, word: false, differs: false }
    const key = fold(text)
    const left = otherCounts.get(key) ?? 0
    if (left > 0) {
      otherCounts.set(key, left - 1)
      return { text, word: true, differs: false }
    }
    return { text, word: true, differs: true }
  })
}

// `{ raw: [...segments], candidate: [...segments] }`. Each segment is
// `{ text, word, differs }` and the segments concatenate back to the original
// string exactly, punctuation and spacing included.
export function diffNames(rawName, candidateName) {
  return {
    raw: mark(rawName, counts(candidateName)),
    candidate: mark(candidateName, counts(rawName)),
  }
}
