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

// The same middleware's binary route: POST the raw PNG bytes of one club mark,
// with the team and treatment in the query string. The client never names a
// destination — the server resolves the directory from the treatment allowlist
// and the filename from teamAbbr (scripts/lib/dev-logo-upload.mjs).
//
// Resolves `{ file, url, caveat }` on success or `{ error }` with a reason to
// put in front of the owner, since "why did my file bounce" is the entire
// question this endpoint has to answer well.
export async function uploadLogo({ teamId, treatment, bytes }) {
  const query = `teamId=${encodeURIComponent(teamId)}&treatment=${encodeURIComponent(treatment)}`
  try {
    const res = await fetch(`${DEV_SAVE_BASE}/team-logo?${query}`, {
      method: 'POST',
      headers: { 'Content-Type': 'image/png' },
      body: bytes,
    })
    const text = await res.text()
    if (!res.ok) return { error: text || `upload failed (${res.status})` }
    return JSON.parse(text)
  } catch {
    return { error: 'could not reach the upload endpoint — is `npm run dev` running?' }
  }
}

// The same middleware's third route: reuse whatever's already uploaded at
// `from` on this team's `to` treatment instead of procuring/uploading the
// same file again. No body — the bytes travel server-side, off disk.
export async function copyLogo({ teamId, from, to }) {
  const query = `teamId=${encodeURIComponent(teamId)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
  try {
    const res = await fetch(`${DEV_SAVE_BASE}/team-logo-copy?${query}`, { method: 'POST' })
    const text = await res.text()
    if (!res.ok) return { error: text || `copy failed (${res.status})` }
    return JSON.parse(text)
  } catch {
    return { error: 'could not reach the copy endpoint — is `npm run dev` running?' }
  }
}

// The middleware's fourth route: rebuild one club's knockout mark from the pins
// just written to mono-ink.json. No body, no path — a team id, and the server
// runs the same converter the nightly generator does
// (scripts/lib/mono-logo-art.mjs), so approving a mark in the lab and
// regenerating it in CI can't produce different art.
export async function regenerateMonoLogo(teamId) {
  try {
    const res = await fetch(`${DEV_SAVE_BASE}/mono-logo?teamId=${encodeURIComponent(teamId)}`, { method: 'POST' })
    const text = await res.text()
    if (!res.ok) return { error: text || `regenerate failed (${res.status})` }
    return JSON.parse(text)
  } catch {
    return { error: 'could not reach the regenerate endpoint — is `npm run dev` running?' }
  }
}

// Save a recolored mark into this club's library under a NAME. Refused with a
// 409 if that name is already taken — saving never destroys a mark somebody
// kept, which is why this returns the server's own message rather than
// retrying under a mangled name (scripts/lib/dev-custom-marks.mjs).
export async function saveCustomMark({ teamId, name, svg }) {
  const query = `teamId=${encodeURIComponent(teamId)}&name=${encodeURIComponent(name)}`
  try {
    const res = await fetch(`${DEV_SAVE_BASE}/custom-mark?${query}`, {
      method: 'POST',
      headers: { 'Content-Type': 'image/svg+xml' },
      body: svg,
    })
    const text = await res.text()
    if (!res.ok) return { error: text || `save failed (${res.status})` }
    return JSON.parse(text)
  } catch {
    return { error: 'could not reach the save endpoint — is `npm run dev` running?' }
  }
}

// Point a treatment at a library mark, or clear it with an empty slug. Writes a
// pointer, never art: the treatment's own curated file is untouched and comes
// back the moment the assignment is cleared.
export async function assignCustomMark({ teamId, treatment, slug }) {
  const query = `teamId=${encodeURIComponent(teamId)}&treatment=${encodeURIComponent(treatment)}&slug=${encodeURIComponent(slug ?? '')}`
  try {
    const res = await fetch(`${DEV_SAVE_BASE}/custom-mark-assign?${query}`, { method: 'POST' })
    const text = await res.text()
    if (!res.ok) return { error: text || `assign failed (${res.status})` }
    return JSON.parse(text)
  } catch {
    return { error: 'could not reach the assign endpoint — is `npm run dev` running?' }
  }
}

// Fill this treatment's WPA slot from one of the club's own marks. `source` is
// a `kind:id` key from src/lib/markSources.js — the client names a SOURCE, and
// the server resolves what that means, so no URL or path travels in the
// request. A COPY, unlike assignCustomMark above: the WPA slot is itself an
// override with no original to protect (scripts/lib/dev-logo-upload.mjs).
export async function fillWpaArt({ teamId, treatment, source }) {
  const query = `teamId=${encodeURIComponent(teamId)}&treatment=${encodeURIComponent(treatment)}&source=${encodeURIComponent(source)}`
  try {
    const res = await fetch(`${DEV_SAVE_BASE}/wpa-art?${query}`, { method: 'POST' })
    const text = await res.text()
    if (!res.ok) return { error: text || `could not use that mark (${res.status})` }
    return JSON.parse(text)
  } catch {
    return { error: 'could not reach the WPA art endpoint — is `npm run dev` running?' }
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

// The team-level counterpart to mergeDraftIntoStore, for a store with no
// `treatments` nesting at all (mlb-team-colors.json) — same "merge this
// session's touched fields into a full copy of the store" contract, minus the
// per-treatment layer. `apply(record, fields, teamId)` returns the team entry
// to write.
export function mergeTeamDraftIntoStore(store, draft, apply, { name } = {}) {
  const next = structuredClone(store)
  for (const [teamId, fields] of Object.entries(draft)) {
    if (!fields || Object.keys(fields).length === 0) continue
    const entry = next[teamId] ?? { name: name?.(Number(teamId)) ?? `Team ${teamId}` }
    next[teamId] = apply(entry, fields, Number(teamId))
  }
  return next
}
