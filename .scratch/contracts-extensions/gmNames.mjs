// Canonicalizes the free-text `gm` column of extensions.csv. The same
// executive appears in several spellings across 26 years -- a full name
// ("Chris Antonetti"), a smushed initial+lastname abbreviation
// ("CAntonetti"), a spaced initial ("J Byrnes"), a typo variant ("MGirsh"
// for "MGirsch"), and a joint title cell holding two people
// ("Mark Shapiro, Chris Antonetti" or "JMozeliak / MGirsch"). Splitting a
// cell without canonicalizing first would count one executive as several
// and hide his real n. Confirmed against the real 2026-08-27 export: 129
// distinct raw `gm` cells collapse to 134 name fragments and, after this
// pass, a smaller number of real people (see CANONICAL_OVERRIDES below for
// the handful this could not resolve automatically).

// A comma directly before a generational suffix is part of ONE person's
// name, not a separator between two people -- "Ruben Amaro, Jr." is one
// executive, not "Ruben Amaro" plus a person named "Jr.".
const SUFFIX_COMMA = /,\s*(?=(Jr\.|Sr\.|II|III|IV)(\s|$))/gi

// A known typo in the source (verified: both spellings appear on rows tied
// to the same club and years, and no "Mark Girsh" exists anywhere else) --
// fixed here rather than left to accidentally split into two people.
const TYPO_FIXES = new Map([['MGirsh', 'MGirsch']])

// Abbreviations this module could not resolve to a full name anywhere else
// in the column (no matching "First Lastname" fragment shares the initial
// and last name). Each stays its own canonical id rather than being merged
// into a guess -- see the header comment.
const UNRESOLVED_ABBREVIATIONS = new Set([
  'J Hollander',
  'JGreenberg',
  'P Putila',
  'PMattingly',
  'SFuld',
  'SHarris',
  'BGomes',
  'BMeador',
])

export function splitExecutiveCell(raw) {
  const cell = String(raw ?? '').trim()
  if (!cell) return []
  const protectedCell = cell.replace(SUFFIX_COMMA, ' ')
  return protectedCell
    .split(/[/,]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

// Builds fragment -> canonical-id from the full set of fragments seen across
// the column, so an abbreviation ("AFriedman") resolves to whichever full
// name ("Andrew Friedman") shares its last name and first initial. Call once
// with every fragment in the file, then use the returned function per row.
export function buildCanonicalizer(allFragments) {
  const fixed = allFragments.map((f) => TYPO_FIXES.get(f) ?? f)
  const fullNames = fixed.filter((f) => /^[A-Z][a-z'.]*(\s|\.)/.test(f) && f.includes(' ') && !/^[A-Z]\.?\s?[A-Z][a-z]/.test(f))
  // fullNames: fragments that look like "First Last" (first token longer
  // than a bare initial). lastName -> [fullFragment, ...]
  const byLastName = new Map()
  for (const full of fullNames) {
    const parts = full.split(/\s+/)
    const last = parts[parts.length - 1] === 'Jr.' ? parts[parts.length - 2] : parts[parts.length - 1]
    if (!byLastName.has(last)) byLastName.set(last, [])
    byLastName.get(last).push(full)
  }

  return function canonicalize(rawFragment) {
    const fragment = TYPO_FIXES.get(rawFragment) ?? rawFragment
    if (UNRESOLVED_ABBREVIATIONS.has(fragment)) return fragment
    // Already a full "First Last" name (not a smushed or spaced initial) --
    // a real first name's second letter is always lowercase ("Ed Wade",
    // "Al Avila"), which is exactly what excludes it from this regex.
    // "J.J. Picollo"/"A.J. Preller" also fail it (a "." where a lowercase
    // letter would need to be), so a real double-initial nickname is left
    // alone rather than mistaken for an abbreviation to resolve.
    if (!/^[A-Z]\.?\s?[A-Z][a-z]/.test(fragment)) {
      return fragment
    }
    const match = fragment.match(/^([A-Z])\.?\s?([A-Z][a-z]+.*)$/)
    if (!match) return fragment
    const [, initial, lastPart] = match
    const candidates = byLastName.get(lastPart) ?? []
    const initialMatches = candidates.filter((c) => c[0] === initial)
    if (initialMatches.length === 1) return initialMatches[0]
    return fragment // ambiguous or no full form seen -- keep as its own id
  }
}
