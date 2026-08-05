// A club's LIBRARY of hand-recolored marks, and which treatment (if any) wears
// each one.
//
// The CDN carries one mark per club per variant and no alternate / City
// Connect art at all (src/lib/CLAUDE.md), so a club's Alt jersey mark is often
// the same shapes in different colors — art that can be made from what we
// already have rather than procured. /identity-lab's Logo art editor recolors
// a source mark shape by shape (logoRecolor.js) and saves the result here under
// a name.
//
// TWO THINGS, ONE STORE, deliberately:
//
//   { "109": { "name": "…", "marks": [{ slug, name, file }],
//              "assignments": { "alternate": "serpent-red" } } }
//
// `marks` is the library — every saved mark, none of which overwrites anything
// (a repeated name is refused by the endpoint, not silently merged).
// `assignments` is which library mark a treatment WEARS, and it is a pointer,
// never a copy: assigning doesn't touch the curated PNG that treatment had, and
// clearing the assignment brings that art straight back. That is the whole
// reason this is an override table rather than a file copy into the treatment
// directory — the alternative would mean deleting or shadowing art somebody
// procured by hand.
//
// Written server-side only (scripts/lib/dev-custom-marks.mjs, ADR-0029): the
// endpoint owns the file because both halves are derived from what's on disk,
// and two writers with different ideas of the library is how a manifest starts
// lying.

import store from './data/custom-marks.json' with { type: 'json' }

// Where a saved mark lives, as the browser sees it. Keyed by team id rather
// than abbreviation because teamAbbr's 3-letter fallback collides across MiLB
// (src/lib/logoArt.js says the same about milb-home/milb-away).
export const CUSTOM_MARK_URL_ROOT = '/team-logos/custom'

export function customMarkUrl(teamId, slug) {
  return `${CUSTOM_MARK_URL_ROOT}/${teamId}-${slug}.svg`
}

// Every mark saved for a club: `[{ slug, name, url }]`, oldest first. Empty
// for a club nobody has drawn one for, which is most of them.
export function customMarksFor(teamId) {
  const marks = store[String(teamId)]?.marks
  if (!Array.isArray(marks)) return []
  return marks.map((m) => ({ slug: m.slug, name: m.name ?? m.slug, url: customMarkUrl(teamId, m.slug) }))
}

// An assignment can point at one of this club's own recolored marks (a bare
// slug, the original and still the common case) OR at one of the CDN's four
// stock vectors (`cdn:base`/`cdn:primary`/`cdn:cap`/`cdn:wordmark` — the
// LogoDropZone "Replace art" select's second way to change what a jersey
// wears, no recoloring required). Kept as a prefix on the same string rather
// than a second field so an assignment stays one value everywhere it already
// travels (this store, the select's value, the copy/save wire).
const CDN_PREFIX = 'cdn:'

// Split a stored assignment value into which of the two kinds it names —
// pulled out on its own so the parsing itself is testable without needing a
// real entry in the committed store. `null` for no assignment at all.
export function parseMarkAssignmentKey(key) {
  if (!key) return null
  if (key.startsWith(CDN_PREFIX)) return { kind: 'cdn', variant: key.slice(CDN_PREFIX.length) }
  return { kind: 'custom', slug: key }
}

// The library mark this treatment wears, or null. Read by teams.js AHEAD of
// its normal disk-presence resolution, which is what makes an assignment an
// override rather than a replacement. A `cdn:` assignment resolves to
// `{ cdnVariant }` rather than a URL — teams.js's own teamLogoUrl already
// knows how to turn a variant into one, and importing it here would close a
// cycle (teams.js -> customMarks.js -> teams.js).
export function customMarkFor(teamId, treatment) {
  const parsed = parseMarkAssignmentKey(store[String(teamId)]?.assignments?.[treatment])
  if (!parsed) return null
  if (parsed.kind === 'cdn') return { cdnVariant: parsed.variant }
  const mark = customMarksFor(teamId).find((m) => m.slug === parsed.slug)
  // An assignment pointing at a mark that is no longer in the library resolves
  // to nothing, so the treatment falls back to its real art instead of a 404.
  return mark ?? null
}

// The slug this treatment is assigned, or '' — what the lab's Replace-art
// select shows as its current value. Distinct from customMarkFor above, which
// resolves the assignment to a usable mark and answers null when it can't.
export function customMarkAssignment(teamId, treatment) {
  return store[String(teamId)]?.assignments?.[treatment] ?? ''
}
