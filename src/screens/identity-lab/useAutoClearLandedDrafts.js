import { useEffect } from 'react'

// Once a session's edits have actually been landed into src/lib/data/*.json (a
// real file change — now a Save away, see ADR-0029 — rather than just a browser
// draft), the matching draft is stale: it no longer represents a *pending*
// change, just a record of one that already happened. This drops any
// (team, treatment) draft whose every touched field now equals the landed
// value, so "Copy N pending changes" only ever counts changes still waiting to
// be landed.
//
// `stores` is one entry per draft store:
//   { draft, reset, matchesLanded(teamId, treatment, fields) -> boolean }
// or, for a team-level draft (useTeamDraftStore.js — a value that isn't
// per-treatment, e.g. mlb-team-colors.json's Primary/Secondary/Third):
//   { draft, reset, matchesLanded(teamId, fields) -> boolean, teamScoped: true }
//
// Runs after every render rather than on a dependency list, because
// useDraftStore's `reset` is a fresh closure each render (so a dep list on it
// would fire every render anyway) and the sweep must also run right after the
// initial load-from-localStorage. It converges: a draft that matched is gone
// on the next pass, and one that didn't is left alone.
export function useAutoClearLandedDrafts(stores) {
  useEffect(() => {
    for (const { draft, reset, matchesLanded, teamScoped } of stores) {
      if (teamScoped) {
        for (const [teamId, fields] of Object.entries(draft)) {
          if (!fields || Object.keys(fields).length === 0) continue
          if (matchesLanded(Number(teamId), fields)) reset(teamId)
        }
        continue
      }
      for (const [teamId, byTreatment] of Object.entries(draft)) {
        for (const [treatment, fields] of Object.entries(byTreatment)) {
          if (!fields || Object.keys(fields).length === 0) continue
          if (matchesLanded(Number(teamId), treatment, fields)) reset(teamId, treatment)
        }
      }
    }
  })
}
