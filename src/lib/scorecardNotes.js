// The scorecard's pencil-over-ink layer — per-cell notation overrides, the
// React-free core. The sheet derives every box's notation from the feed
// (api/scorecardGame.js); when the scorer disagrees — they'd call that 6-3 a
// 6U, the official scorer's E5 was a hit all day — they overwrite the CELL,
// not the record: an override is stored per plate appearance (keyed by the
// feed's own atBatIndex, unique across both halves of one game) and wins at
// render time only. Nothing derived is modified, nothing is fed back into
// any tally (AB/H/R/RBI and the scoreboard keep reading the feed), and the
// store never syncs — like a margin note in a paper book, it is a fact about
// YOUR copy of the sheet, not about the game. The persisted reveal mark is
// untouched by all of this; an override can only exist for a cell the user
// has already revealed, because a sealed cell is never rendered to be tapped.
//
// Storage: one localStorage key per game (bbsbh:scorecard-notes:{gamePk}),
// value { v: 1, cells: { [atBatIndex]: { outcome?, center?, rbi? } } }. All
// three fields are short strings the user typed; absent means "keep the
// derived mark". The parse collapses anything malformed to the empty store,
// so a hand-mangled value can never crash the sheet — same posture as
// parseRevealMark.

export const SCORECARD_NOTES_KEY = 'bbsbh:scorecard-notes:'

// What a scorer can write in each zone of the box. Generous enough for the
// longest real chains ("CS 2-4", "6-4-3", a ringed "1B"), tight enough that a
// paste can't blow the 90px box apart.
const FIELD_CAPS = { outcome: 8, center: 10, rbi: 2 }
const FIELDS = Object.keys(FIELD_CAPS)

const EMPTY = Object.freeze({ cells: Object.freeze({}) })

// Normalize one raw field value to what the store keeps: a trimmed, capped
// string, or null for anything empty/absent (null means "no override").
function cleanField(field, value) {
  if (typeof value !== 'string') return null
  const v = value.trim().slice(0, FIELD_CAPS[field])
  return v === '' ? null : v
}

// Parse a raw localStorage value into the notes store. Anything that isn't
// the expected shape — null, bad JSON, a wrong version, non-object cells,
// non-numeric keys — collapses to the empty store rather than throwing.
export function parseScorecardNotes(raw) {
  if (raw == null) return EMPTY
  let data
  try {
    data = JSON.parse(raw)
  } catch {
    return EMPTY
  }
  if (!data || data.v !== 1 || typeof data.cells !== 'object' || data.cells == null) return EMPTY
  const cells = {}
  for (const [key, cell] of Object.entries(data.cells)) {
    if (!/^\d+$/.test(key) || typeof cell !== 'object' || cell == null) continue
    const kept = {}
    for (const f of FIELDS) {
      const v = cleanField(f, cell[f])
      if (v != null) kept[f] = v
    }
    if (Object.keys(kept).length > 0) cells[key] = kept
  }
  return Object.keys(cells).length > 0 ? { cells } : EMPTY
}

// Serialize for storage. The empty store serializes to null — the caller
// removes the key instead of writing an empty shell that would sit in
// localStorage forever for every game ever glanced at.
export function serializeScorecardNotes(notes) {
  if (!notes || Object.keys(notes.cells).length === 0) return null
  return JSON.stringify({ v: 1, cells: notes.cells })
}

// The override for one plate appearance, or null.
export function cellNote(notes, atBatIndex) {
  if (atBatIndex == null) return null
  return notes?.cells?.[String(atBatIndex)] ?? null
}

// Return a new store with `patch` applied to one cell — each field trimmed,
// capped, and dropped entirely when blanked, the cell dropped when its last
// field goes. Returns the SAME object when nothing actually changed, so a
// no-op save never causes a write or a re-render.
export function withCellNote(notes, atBatIndex, patch) {
  if (atBatIndex == null) return notes
  const key = String(atBatIndex)
  const prev = notes?.cells?.[key] ?? {}
  const next = {}
  for (const f of FIELDS) {
    const v = f in (patch ?? {}) ? cleanField(f, patch[f]) : prev[f] ?? null
    if (v != null) next[f] = v
  }
  const changed =
    FIELDS.some((f) => (prev[f] ?? null) !== (next[f] ?? null))
  if (!changed) return notes ?? EMPTY
  const cells = { ...(notes?.cells ?? {}) }
  if (Object.keys(next).length === 0) delete cells[key]
  else cells[key] = next
  return Object.keys(cells).length > 0 ? { cells } : EMPTY
}

// Return a new store with one cell's override fully erased — "back to the
// derived notation". Same-reference when there was nothing to erase.
export function withoutCellNote(notes, atBatIndex) {
  if (atBatIndex == null) return notes ?? EMPTY
  const key = String(atBatIndex)
  if (!notes?.cells?.[key]) return notes ?? EMPTY
  const cells = { ...notes.cells }
  delete cells[key]
  return Object.keys(cells).length > 0 ? { cells } : EMPTY
}

export { EMPTY as EMPTY_SCORECARD_NOTES }
