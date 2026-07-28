import { useEffect, useState } from 'react'

// The team-level counterpart to useDraftStore.js: `{ [teamId]: { ...fields } }`
// in localStorage, no treatment nesting. For a value that's a fact about the
// CLUB, not about one of its jersey treatments — today, only the Main tile's
// Primary/Secondary/Third triad (mlb-team-colors.json). Forcing that through
// useDraftStore's `(teamId, treatment, field, value)` shape would mean inventing
// a fake treatment key, which would be a lie: editing a club's Primary from the
// Main tile's swatch is a team-wide edit, not a Main-only one.
export function useTeamDraftStore(key) {
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
  const setField = (teamId, field, value) =>
    setDraft((was) => ({ ...was, [teamId]: { ...was[teamId], [field]: value } }))
  const reset = (teamId) =>
    setDraft((was) => {
      if (!was[teamId]) return was
      const next = { ...was }
      delete next[teamId]
      return next
    })
  return [draft, setField, reset]
}
