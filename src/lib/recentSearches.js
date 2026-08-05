// The site search's recent list — the handful of players and clubs this device
// last opened from search, so the search screen has something useful on it the
// moment it opens instead of a "type at least 2 letters" hint. React-free and
// dependency-free so the parse rules can be pinned by the unit suite
// (test/recent-searches.test.js), same shape as spoiledDays.js.
//
// Spoiler-safe by construction, and the reason is worth writing down rather
// than assuming: an entry holds a person/club id, a display name, and the
// subtitle already shown on that search row (position, club, level) — the
// identity-only fields `api/search.js` is limited to. It holds no score, no
// date, and no game, so no amount of it can leak a result. Anything the reader
// cannot recognize as exactly that shape is dropped rather than stored, which
// is also what keeps a hand-edited or half-written localStorage value from
// reaching the render path.

export const RECENT_SEARCHES_KEY = 'bbsbh:search:recent'

// Eight rows is about one thumb's reach of list above the keyboard on an
// iPhone-class screen. Past that the shelf stops being "where was I" and
// becomes something to read, which is what the search field is for.
export const MAX_RECENT_SEARCHES = 8

// The two things this app's search can find. A third kind would need a route
// and a row renderer, so an unknown kind is a stale or garbled entry either way.
const KINDS = new Set(['player', 'team'])

// Names arrive from statsapi and are rendered, not parsed, so the only cap that
// matters is on how large a single stored value can grow. No real club or
// person name comes close.
const MAX_TEXT = 80

// The dedupe/identity key. A person and a club can share an id — they come from
// different endpoints — so the kind is part of it.
export function recentSearchKey(entry) {
  return `${entry.kind}:${entry.id}`
}

function normalizeEntry(entry) {
  if (!entry || typeof entry !== 'object') return null
  if (!KINDS.has(entry.kind)) return null
  const id = Number(entry.id)
  if (!Number.isInteger(id) || id <= 0) return null
  const name = typeof entry.name === 'string' ? entry.name.trim().slice(0, MAX_TEXT) : ''
  // A row with no name would render as an unlabeled tap target, so it isn't an
  // entry at all.
  if (!name) return null
  const sub = typeof entry.sub === 'string' ? entry.sub.trim().slice(0, MAX_TEXT) : ''
  return { kind: entry.kind, id, name, sub }
}

// Valid entries only, deduped, newest first, capped. First-wins on the dedupe is
// what makes `addRecentSearch` a move-to-front rather than an append: the fresh
// copy is prepended and the stale one further down the list is the one dropped.
function normalize(list) {
  if (!Array.isArray(list)) return []
  const seen = new Set()
  const out = []
  for (const raw of list) {
    const entry = normalizeEntry(raw)
    if (!entry) continue
    const key = recentSearchKey(entry)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(entry)
    if (out.length >= MAX_RECENT_SEARCHES) break
  }
  return out
}

// Parse the raw localStorage value. Never throws — malformed JSON, a bare
// string, an object, a list of nulls all collapse to [] ("no recents"), which
// renders the plain hint instead.
export function parseRecentSearches(raw) {
  if (raw == null) return []
  try {
    return normalize(JSON.parse(raw))
  } catch {
    return []
  }
}

// The value to hand localStorage. Normalizes on the way out too, so nothing the
// reader above would reject can ever be written by this app.
export function serializeRecentSearches(list) {
  return JSON.stringify(normalize(list))
}

// Record a visit. Returns a NEW normalized list with `entry` at the front; an
// entry already present moves up rather than duplicating, and an unusable one
// is a no-op, so callers can record freely without checking first.
export function addRecentSearch(list, entry) {
  const current = Array.isArray(list) ? list : []
  const next = normalizeEntry(entry)
  if (!next) return normalize(current)
  return normalize([next, ...current])
}

// Drop one row — the per-row remove on the recents shelf.
export function removeRecentSearch(list, kind, id) {
  const current = Array.isArray(list) ? list : []
  const key = `${kind}:${Number(id)}`
  return normalize(
    current.filter((entry) => {
      const normalized = normalizeEntry(entry)
      return normalized ? recentSearchKey(normalized) !== key : false
    }),
  )
}
