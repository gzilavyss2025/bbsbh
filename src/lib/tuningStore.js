// Shared readers for the hand-tuned identity stores in src/lib/data/*.json —
// the per-team, per-treatment records the Team Identity Lab edits and writes
// back to disk in dev (ADR-0029). See src/lib/CLAUDE.md for the schema.
//
// Every store has the same outer shape:
//
//   { "<teamId>": { name, …team-level fields, treatments: { "<key>": {…} } } }
//
// `name` and `note` are prose carried over from the per-entry comments these
// tables had as JS literals; no resolver reads them. Treatment keys are the
// jerseys.json vocabulary for MLB ('main', 'alternate', 'alternate-2…4',
// 'city-connect') and 'home'/'away' for MiLB, which has no jersey catalog to
// key on (see src/api/CLAUDE.md).
//
// The consuming modules (teams.js, wpaLogo.js, wpaBandColors.js,
// milbColors.js) rebuild the exact `{ [teamId]: { [treatment]: value } }`
// tables they used to declare inline, so every resolver below them — and every
// test pinning one — keeps its behaviour unchanged. The store is the authoring
// format; those tables are still the lookup format.

// One (team, treatment) record, or null.
export function treatmentRecord(store, teamId, treatment) {
  return store[teamId]?.treatments?.[treatment] ?? null
}

// Rebuild a `{ [teamId]: { [treatment]: value } }` table from `store`. `pick`
// maps a record to that table's value, or returns undefined to leave the cell
// out entirely (so a team with a record but no value for this table gets no
// key, exactly like the hand-written literal did).
//
// `includeMain` is false by default because several MLB tables never carried a
// 'main' row: Main's tile tuning lives in MAIN_OVERRIDES instead, and
// treatmentScale/treatmentPinstripeColor must keep returning the no-override
// default for it. Merging the two would silently double-apply Main's scale.
export function byTreatment(store, pick, { includeMain = true } = {}) {
  const out = {}
  for (const [teamId, entry] of Object.entries(store)) {
    for (const [treatment, fields] of Object.entries(entry.treatments ?? {})) {
      if (!includeMain && treatment === 'main') continue
      const value = pick(fields)
      if (value === undefined) continue
      out[teamId] ??= {}
      out[teamId][treatment] = value
    }
  }
  return out
}

// Rebuild a flat `{ [teamId]: value }` table from the store's team-level
// fields (e.g. wpa-tuning.json's Main-only `bandColor`).
export function byTeam(store, pick) {
  const out = {}
  for (const [teamId, entry] of Object.entries(store)) {
    const value = pick(entry)
    if (value !== undefined) out[teamId] = value
  }
  return out
}
