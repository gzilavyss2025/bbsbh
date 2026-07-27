// POST one or more whole stores to vite.config.js's devDataSave() middleware
// (ADR-0029). Each payload is `{ key, body }`, where `key` must be on that
// middleware's own allowlist (scripts/lib/dev-data-stores.mjs) — the client
// never names a file path.
//
// Outside `npm run dev` the endpoint doesn't exist, so this resolves false and
// the caller shows its "is `npm run dev` running?" hint. That's also why every
// lab screen is DEV-gated in App.jsx: a Save button that can only ever fail is
// worse than no Save button.
const DEV_SAVE_BASE = '/__dev'

export async function saveStores(payloads) {
  try {
    for (const { key, body } of payloads) {
      const res = await fetch(`${DEV_SAVE_BASE}/${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`${key}: ${res.status}`)
    }
    return true
  } catch {
    return false
  }
}

// Merge a draft's touched fields into a team-keyed store, returning a NEW store
// object — the lab always posts the whole file, so an untouched team/treatment
// has to survive the merge rather than being dropped.
//
// `apply(record, fields, treatment, teamId)` is the per-dimension mapping from
// draft field names to store field names; it returns the treatment record to
// write, or null to leave the store alone for that (team, treatment) — the
// escape hatch for a draft field whose landing place isn't in this store at all.
export function mergeDraftIntoStore(store, draft, apply, { name } = {}) {
  const next = structuredClone(store)
  for (const [teamId, byTreatment] of Object.entries(draft)) {
    for (const [treatment, fields] of Object.entries(byTreatment)) {
      if (!fields || Object.keys(fields).length === 0) continue
      const entry = (next[teamId] ??= { name: name?.(Number(teamId)) ?? `Team ${teamId}`, treatments: {} })
      entry.treatments ??= {}
      const merged = apply({ ...entry.treatments[treatment] }, fields, treatment, Number(teamId))
      if (!merged) continue
      // A note is prose about the entry, not a value — keep it last so the
      // written file reads the way the hand-authored literals did.
      const { note, ...rest } = merged
      entry.treatments[treatment] = note === undefined ? rest : { ...rest, note }
    }
  }
  return next
}
