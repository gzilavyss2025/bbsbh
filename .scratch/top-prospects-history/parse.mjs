// Pure parser for MLB.com's HISTORICAL Top Prospects list pages
// (https://www.mlb.com/prospects/{year} -- redirects to
// https://www.mlb.com/milb/prospects/{year}, server-rendered, HTTP 200, no
// auth, no season query param). Used only by pull.mjs in this directory; see
// that file's header for the fetch loop, caching, and validation this feeds.
//
// The page embeds its data as one large HTML-entity-encoded JSON-ish blob (a
// server-rendered Next.js data payload), not a documented API. Two traps,
// both load-bearing and both confirmed against a real 2015 response:
//
//   1. Every quote inside that blob is the ENTITY &quot;, never a literal
//      ". A grep for "rank": against the raw bytes returns ZERO matches --
//      decodeHtmlEntities() must run before any pattern match, or parsing
//      silently yields nothing (looks like "no data" rather than "wrong
//      approach", which is exactly how this trap bites).
//   2. The ranked player's MLBAM id is NOT a `playerId` field anywhere on
//      the page (unlike the CURRENT-list scrape in
//      scripts/fetch-top-prospects.mjs, a different page entirely). It
//      lives inside a normalized entity-graph reference:
//      `"player":{"__ref":"Person:621439"}` -- a few hundred characters
//      after each entry's own "rank" field, and BEFORE a long free-text
//      scouting blurb (`prospectBio[0].contentText`) that can run past a
//      thousand characters. ENTRY_RE is deliberately non-greedy and stops
//      at the FIRST "__ref":"Person:..." after a "rank" marker, so it can
//      never run past its own entry into the next one's blurb or id.

export function decodeHtmlEntities(html) {
  return html
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

const ENTRY_RE =
  /"__typename":"RankedPlayerEntity","rank":(\d+),"playerEntity":\{"__typename":"PlayerEntity"[\s\S]*?"player":\{"__ref":"Person:(\d+)"\}/g

// Parses one fetched page body (raw, still entity-encoded -- callers must
// NOT pre-decode) into `{rank, mlbId}` rows, in page order. An empty array
// is a valid, meaningful result (the 2005-2008 pages are a real empty shell,
// not a parse failure) -- this function never throws on "found nothing".
// pull.mjs, not this module, decides whether an empty result is expected.
export function parseRankedEntries(rawHtml) {
  const decoded = decodeHtmlEntities(rawHtml)
  const entries = []
  for (const m of decoded.matchAll(ENTRY_RE)) {
    entries.push({ rank: Number(m[1]), mlbId: Number(m[2]) })
  }
  return entries
}

// Validates that a season's entries form exactly the contiguous range
// 1..max(rank) with no duplicate ranks and no duplicate mlbIds -- the check
// that catches a regex silently missing a handful of entries (which would
// otherwise look like a slightly-short but still "plausible" season; see
// pull.mjs's header for why that failure mode is the one this whole
// generator is built to refuse). Returns the season's depth (== entries.length
// when valid); throws with a specific reason otherwise. Does not get called
// for a genuinely empty (2005-2008-shaped) result -- pull.mjs branches on
// entries.length === 0 before this runs.
export function assertContiguousRanks(entries, year) {
  const ranks = entries.map((e) => e.rank)
  const uniqueRanks = new Set(ranks)
  if (uniqueRanks.size !== ranks.length) {
    throw new Error(`${year}: duplicate rank in parsed entries (${ranks.length} rows, ${uniqueRanks.size} unique ranks)`)
  }
  const ids = entries.map((e) => e.mlbId)
  const uniqueIds = new Set(ids)
  if (uniqueIds.size !== ids.length) {
    throw new Error(`${year}: duplicate mlbId in parsed entries (${ids.length} rows, ${uniqueIds.size} unique ids)`)
  }
  const max = Math.max(...ranks)
  for (let r = 1; r <= max; r++) {
    if (!uniqueRanks.has(r)) {
      throw new Error(`${year}: rank ${r} missing from parsed entries (have 1..${max} with a gap) -- refusing to write a short season`)
    }
  }
  return max
}
