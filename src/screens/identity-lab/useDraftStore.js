import { useEffect, useState } from 'react'

// The shape behind every editor's local draft: `{ [teamId]: { [treatment]:
// { ...fields } } }` in localStorage, one load-on-mount + write-on-change pair
// per store. Centralized so the position/WPA/header drafts — and the MLB and
// MiLB profiles, which used to carry their own copy of this hook each — can't
// drift into six slightly different persistence bugs.
//
// A draft is deliberately partial: only the fields the user actually touched,
// so an untouched field keeps tracking whatever is landed in
// src/lib/data/*.json rather than freezing today's value into the browser.
export function useDraftStore(key) {
  const [draft, setDraft] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(key) || '{}')
    } catch {
      return {}
    }
  })
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(draft))
  }, [key, draft])
  const setField = (teamId, treatment, field, value) =>
    setDraft((was) => ({
      ...was,
      [teamId]: {
        ...was[teamId],
        [treatment]: { ...was[teamId]?.[treatment], [field]: value },
      },
    }))
  const reset = (teamId, treatment) =>
    setDraft((was) => {
      if (!was[teamId]) return was
      const nextTeam = { ...was[teamId] }
      delete nextTeam[treatment]
      return { ...was, [teamId]: nextTeam }
    })
  return [draft, setField, reset]
}

// True when every field the user actually touched in `fields` (a draft object —
// only the keys the user edited, not a full resolved object) has the exact same
// value already sitting in `landed`. Numbers compare with float tolerance so a
// round-tripped `0.85` doesn't false-negative against itself.
export function draftFieldsMatchLanded(fields, landed) {
  if (!landed) return false
  return Object.entries(fields).every(([k, v]) =>
    typeof v === 'number' ? Math.abs((landed[k] ?? NaN) - v) < 1e-9 : landed[k] === v,
  )
}
