// The Logbook — the per-user collection of game stamps (ADR-0035). React-free
// and dependency-free so every rule below can be pinned by the unit suite
// (test/stamps.test.js) and reused verbatim by the serverless function
// (api/stamps.js), which is the point: the client and the server must not be
// able to disagree about what a valid stamp is.
//
// A stamp is a commemorative mark for a game you watched, carrying that game's
// final score. That makes the Logbook the FIRST score-bearing thing this app
// stores — read ADR-0035 before changing anything here. The invariant the whole
// design exists to make true:
//
//   You cannot own a stamp for a game you have not finished revealing.
//
// `meetsRevealGate` below is that sentence as code, and api/stamps.js runs it
// server-side on every mint so it is a structural guarantee rather than a
// convention a future surface can forget.
//
// What this module deliberately does NOT hold: the score. A local stamp record
// is `{ state, mode, stampedAt, updatedAt, note, date }` — no runs, no result,
// no winner. The Logbook resolves those from the game facts at render time
// (from Redis when signed in, from statsapi when not), so localStorage stays
// exactly as non-score-bearing as `bbsbh:reveal:{gamePk}` already is.

export const STAMPS_KEY = 'bbsbh:stamps'

// A full MLB season is 2,430 games. 500 is generous for any real human and
// bounds a hostile client; see `seasonIsFull` for why the cap REFUSES rather
// than prunes.
export const MAX_STAMPS_PER_SEASON = 500

// Long enough for a real memory ("Dad's first game at County Stadium"), short
// enough that the stamp art can render it and a hostile client can't use the
// Logbook as free storage.
export const MAX_NOTE_LENGTH = 140

// How you took the game in. Deliberately two, not three: "attended" was scoped
// and cut for v1 (see the PRD's open questions) because it wants its own mark on
// the stamp art, and adding an enum value later is cheap while un-shipping a
// half-drawn overprint is not. A stamp with an unknown mode normalizes to
// 'watched' rather than being dropped — the mode is flavour, the stamp is the
// keepsake.
export const STAMP_MODES = ['watched', 'followed']
export const DEFAULT_STAMP_MODE = 'watched'

export function isStampMode(value) {
  return STAMP_MODES.includes(value)
}

// 'on' | 'off' — the same state-map vocabulary as spoiledDays.js, and for the
// same reason. See `applyRemoteStamps`.
export function isStampState(value) {
  return value === 'on' || value === 'off'
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

// The one date shape the whole app shares (toApiDate in dates.js, the feed's
// officialDate). Anything else is not a day this app can be looking at.
export function isDayString(value) {
  return typeof value === 'string' && DAY_RE.test(value)
}

// A gamePk as a positive integer, from either a number or the string a Redis
// hash field / URL query hands back. Null for anything else, so a caller can
// never end up keyed on 'NaN' or an empty string.
export function toGamePk(value) {
  if (typeof value === 'number') return Number.isInteger(value) && value > 0 ? value : null
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : null
}

// Seasons this app could plausibly be storing. Bounds the season shard key so a
// hostile client can't spray Redis with `stamps:{user}:{anything}`.
export function isSeasonNumber(value) {
  return Number.isInteger(value) && value >= 1876 && value <= 2200
}

// Which season shard a game belongs in. Derived from the game's own date rather
// than stored separately, so the two can't drift.
export function seasonFromDate(date) {
  if (!isDayString(date)) return null
  const season = Number(date.slice(0, 4))
  return isSeasonNumber(season) ? season : null
}

// Notes are user-authored and round-trip through Redis, so they get the same
// defensive treatment as api/reveal.js's sanitizeSnapshot: strip control
// characters (including the newlines the stamp art has nowhere to put),
// collapse runs of whitespace, then cap. Never null — an unusable note becomes
// '', which is the same as not having one.
export function sanitizeNote(value) {
  if (typeof value !== 'string') return ''
  // eslint-disable-next-line no-control-regex
  const flat = value.replace(/[\u0000-\u001f\u007f]/g, ' ')
  return flat.replace(/\s+/g, ' ').trim().slice(0, MAX_NOTE_LENGTH)
}

// ---------------------------------------------------------------------------
// The reveal gate — the load-bearing half of ADR-0035
// ---------------------------------------------------------------------------

// The half-index formula from src/api/select.js's `halfIndex`, restated rather
// than imported: src/lib sits BELOW src/api (see src/lib/CLAUDE.md), and this
// module is bundled into a serverless function that has no business pulling in
// the whole selector layer. test/stamps.test.js pins the two against each other
// so the restatement cannot drift.
function halfIndexOf(inning, half) {
  return (inning - 1) * 2 + (half === 'top' ? 0 : 1)
}

// The half-index of a finished game's LAST half — the value `revealedThrough`
// has to reach for the user to have uncovered the final score by hand.
//
// Why this is computed from the game's ACTUAL innings and not the PRD's
// `regulation × 2 − 1`: that formula under-gates and over-gates in opposite
// directions on the two cases that matter. An extra-inning game is still tied
// at the end of regulation, so `regulation × 2 − 1` would mint a stamp for a
// user who has seen none of the innings that decided it. And a home team
// leading after the top of the ninth never bats again, so the bottom half the
// formula demands does not exist and the gate could never be satisfied.
// `homeBattedLast` (from the linescore's last inning actually carrying a home
// entry — the same test liveEdge.js's edgeFromLinescore makes) settles both.
export function finalHalfIndex(game) {
  const innings = game?.innings
  if (!Number.isInteger(innings) || innings < 1) return null
  return halfIndexOf(innings, game.homeBattedLast === false ? 'top' : 'bottom')
}

// May this user mint a stamp for this game? The whole spoiler argument for the
// Logbook rests here, so it fails CLOSED on every uncertainty — an absent game,
// an unparseable innings count, a missing reveal mark all answer false.
//
// Two ways to qualify, and they are the two ways a user legitimately comes to
// know a final score in this app:
//
//   1. `revealedThrough` reached the game's last half — they uncovered it by
//      hand through the existing ratchet (useRevealProgress.js).
//   2. The game's day is 'on' in their spoiled-day map — they consented to
//      spoil that date under the Scores Unlocked pass (ADR-0026), which is
//      exactly the case where a user has seen the score without the mark ever
//      moving (the pass deliberately never writes it).
//
// That the two existing stores compose here without either one being bent is
// the strongest evidence the model is right; do not add a third way in.
export function meetsRevealGate({ game, revealedThrough, daySpoiled } = {}) {
  if (!game || game.status !== 'Final') return false
  if (daySpoiled === true && isDayString(game.date)) return true
  const needed = finalHalfIndex(game)
  if (needed == null) return false
  return Number.isInteger(revealedThrough) && revealedThrough >= needed
}

// ---------------------------------------------------------------------------
// The local store
// ---------------------------------------------------------------------------

// One stamp record, validated. Returns null for anything that isn't one, so a
// hand-edited or cross-version entry is dropped rather than half-read.
//
// `stampedAt` and `updatedAt` are deliberately two clocks. `stampedAt` is the
// keepsake's own date — when you first stamped the game — and re-stamping to
// change a note must not move it. `updatedAt` is the sync clock that decides
// last-write-wins in `applyRemoteStamps`, and it moves on every change
// INCLUDING an un-stamp; a single field could not do both, because an un-stamp
// would either lose the keepsake's date or fail to propagate.
export function normalizeStamp(raw) {
  if (!raw || typeof raw !== 'object') return null
  const state = isStampState(raw.state) ? raw.state : 'on'
  const date = isDayString(raw.date) ? raw.date : ''
  const stampedAt = Number.isInteger(raw.stampedAt) && raw.stampedAt > 0 ? raw.stampedAt : 0
  const updatedAt =
    Number.isInteger(raw.updatedAt) && raw.updatedAt > 0 ? raw.updatedAt : stampedAt
  if (!stampedAt) return null
  return {
    state,
    mode: isStampMode(raw.mode) ? raw.mode : DEFAULT_STAMP_MODE,
    stampedAt,
    updatedAt,
    note: sanitizeNote(raw.note),
    date,
  }
}

// Valid entries only, keyed by gamePk. Over-cap seasons keep the newest
// `MAX_STAMPS_PER_SEASON` — that path is unreachable through `addStamp`, which
// refuses at the cap rather than pruning (a keepsake must never vanish on its
// own); it exists only so a hand-written oversized value is still bounded.
function normalizeAll(map) {
  if (!map || typeof map !== 'object' || Array.isArray(map)) return {}
  const bySeason = new Map()
  for (const [key, value] of Object.entries(map)) {
    const gamePk = toGamePk(key)
    if (gamePk == null) continue
    const entry = normalizeStamp(value)
    if (!entry) continue
    const season = seasonFromDate(entry.date) ?? 0
    if (!bySeason.has(season)) bySeason.set(season, [])
    bySeason.get(season).push([gamePk, entry])
  }
  const out = {}
  for (const entries of bySeason.values()) {
    entries
      .sort((a, b) => b[1].stampedAt - a[1].stampedAt)
      .slice(0, MAX_STAMPS_PER_SEASON)
      .forEach(([gamePk, entry]) => {
        out[gamePk] = entry
      })
  }
  return out
}

// Parse the raw localStorage value. Never throws — malformed JSON, an array, a
// stray number all collapse to {} ("no stamps"), which loses a collection but
// can never invent one. Same fail-empty posture as parseSpoiledDays.
export function parseStamps(raw) {
  if (raw == null) return {}
  try {
    return normalizeAll(JSON.parse(raw))
  } catch {
    return {}
  }
}

// The value to hand localStorage. Normalizes on the way out too, so nothing the
// reader above would reject can be written by this app.
export function serializeStamps(map) {
  return JSON.stringify(normalizeAll(map))
}

// The live stamp for a game, or null. Tombstoned ('off') entries answer null —
// callers ask "is this stamped", and a tombstone means it is not.
export function stampFor(map, gamePk) {
  const pk = toGamePk(gamePk)
  if (pk == null) return null
  const entry = map?.[pk]
  return entry && entry.state === 'on' ? entry : null
}

export function isStamped(map, gamePk) {
  return stampFor(map, gamePk) != null
}

// Every live stamp in a season, newest game first.
export function stampsForSeason(map, season) {
  return Object.entries(map || {})
    .map(([pk, entry]) => [toGamePk(pk), entry])
    .filter(([pk, entry]) => pk != null && entry?.state === 'on' && seasonFromDate(entry.date) === season)
    .sort((a, b) => (b[1].date > a[1].date ? 1 : b[1].date < a[1].date ? -1 : b[1].stampedAt - a[1].stampedAt))
    .map(([gamePk, entry]) => ({ gamePk, ...entry }))
}

// { season: count } over live stamps only — the Logbook's season nav.
export function seasonCounts(map) {
  const out = {}
  for (const entry of Object.values(map || {})) {
    if (entry?.state !== 'on') continue
    const season = seasonFromDate(entry.date)
    if (season == null) continue
    out[season] = (out[season] ?? 0) + 1
  }
  return out
}

// At the cap, `addStamp` is a no-op — so a caller has to be able to say WHY
// rather than showing a button that silently does nothing.
export function seasonIsFull(map, season) {
  return (seasonCounts(map)[season] ?? 0) >= MAX_STAMPS_PER_SEASON
}

// Stamp a game. Returns a NEW map; the input is never mutated.
//
// Idempotent by design: re-stamping a game already in the collection updates
// its mode and note and bumps `updatedAt`, but keeps the original `stampedAt`.
// Re-stamping a tombstoned game revives it with a FRESH `stampedAt` — you
// un-stamped it, so the old date is not the date of this keepsake.
//
// Callers are expected to have checked `meetsRevealGate` (the client for the
// affordance, the server for the guarantee). This function does not re-check
// it, because it does not have the game facts; that separation is deliberate —
// there is exactly one gate, in one place, and it is the server's.
export function addStamp(map, gamePk, { mode, note, date, now } = {}) {
  const current = normalizeAll(map)
  const pk = toGamePk(gamePk)
  const at = Number.isInteger(now) && now > 0 ? now : 0
  if (pk == null || !isDayString(date) || !at) return current
  const season = seasonFromDate(date)
  const existing = current[pk]
  const reviving = !existing || existing.state === 'off'
  if (reviving && season != null && seasonIsFull(current, season)) return current
  return {
    ...current,
    [pk]: {
      state: 'on',
      mode: isStampMode(mode) ? mode : DEFAULT_STAMP_MODE,
      stampedAt: reviving ? at : existing.stampedAt,
      updatedAt: at,
      note: sanitizeNote(note),
      date,
    },
  }
}

// Un-stamp. Writes an explicit 'off' tombstone rather than deleting the key —
// see `applyRemoteStamps` for why deletion would resurrect the stamp on the
// next sync. A game that was never stamped stays absent (nothing to take back).
export function removeStamp(map, gamePk, { now } = {}) {
  const current = normalizeAll(map)
  const pk = toGamePk(gamePk)
  const at = Number.isInteger(now) && now > 0 ? now : 0
  const existing = pk == null ? null : current[pk]
  if (!existing || !at) return current
  return { ...current, [pk]: { ...existing, state: 'off', updatedAt: at } }
}

// ---------------------------------------------------------------------------
// Cross-device sync (ADR-0022's stack, ADR-0026's shape)
// ---------------------------------------------------------------------------
// The reveal mark syncs with a monotonic ratchet because it only moves one way.
// A stamp collection cannot: a stamp is REMOVABLE, and that is deliberate —
// it's a keepsake, not a spoiler mark, so there is no ratchet here (the one
// place the Logbook differs in character from revealedThrough).
//
// A plain union merge would therefore be wrong in the same specific way it is
// wrong for spoiled days: stamp on the phone, sync, un-stamp on the phone, and
// the next fetch unions the server's stale 'on' straight back in, silently
// undoing the removal. So a removal is published as an explicit 'off' and the
// two sides reconcile per gamePk on `updatedAt`, last write wins.
//
// Safe for a reason specific to this data: a stamp only ever changes by a
// deliberate tap on one of THIS user's own devices. There is no third party to
// race, and the loser of a tie is always one of the user's own two taps.
export function applyRemoteStamps(local, remote) {
  const out = normalizeAll(local)
  if (!remote || typeof remote !== 'object' || Array.isArray(remote)) return out
  for (const [key, value] of Object.entries(remote)) {
    const pk = toGamePk(key)
    if (pk == null) continue
    const incoming = normalizeStamp(value)
    if (!incoming) continue
    const existing = out[pk]
    if (!existing || incoming.updatedAt >= existing.updatedAt) out[pk] = incoming
  }
  return normalizeAll(out)
}

// What this device would publish. Tombstones are INCLUDED — that is the whole
// point of keeping them; an un-stamp that isn't published is an un-stamp the
// next sync undoes.
export function statesFromStamps(map) {
  return normalizeAll(map)
}
