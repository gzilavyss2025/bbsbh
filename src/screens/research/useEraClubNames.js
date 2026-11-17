import { useEffect, useState } from 'react'
import { franchiseFor, nameForSeason } from '../../api/history/franchiseSeasons.js'
import { ALL_MLB_TEAM_IDS, teamAbbr } from '../../lib/teams.js'
import { clubName } from '../../api/research/filters.js'

// ERA CLUB NAMES (Gary, 2026-11-17, #3150, #3165): a club filter matches the whole franchise
// (its one club id), and the page names the club as it was called: a pill or a leader table
// across the searched seasons, oldest first (1987-2010 at WSH reads "Montreal Expos /
// Washington Nationals"); one game's club by that game's season.
const ID_OF = Object.fromEntries(ALL_MLB_TEAM_IDS.map((id) => [teamAbbr({ id }), id]))

// Pure: the names `spans` ({ from, to, name }) carry within [lo, hi], oldest first, deduped.
export function namesInRange(spans, lo, hi) {
  return [...new Set((spans ?? []).filter((s) => s.from <= hi && s.to >= lo).sort((a, b) => a.from - b.from).map((s) => s.name))]
}

// Pure: the pill's name, or null to keep the current one. One era name counts too: 1985-1987
// at WSH is "Montreal Expos".
export const eraLabel = (names) => (names.length ? names.join(' / ') : null)

// Pure (#3165): a namer over loaded franchise spans ({ code: spans }). name(code, season)
// is the club's name that season (a game's club); name(code) every name over [lo, hi] (a
// pill, a leader table). A club not loaded, or with no name on file, reads today's name.
export function eraNamer(spans, lo, hi) {
  return (code, season) => {
    const s = spans[code]
    if (!s) return clubName(code)
    if (season != null) return nameForSeason(s, season) ?? clubName(code)
    return (lo != null && hi != null && eraLabel(namesInRange(s, lo, hi))) || clubName(code)
  }
}

// A streak row's club, named for the season the streak began (Gary, 2026-11-17, #3167): a
// streak across a rename reads its first game's name.
export const streakClub = (s, name) => name(s.team, Number(s.first.date.slice(0, 4)))

// Each club's franchise spans, loaded once and kept (franchiseFor caches the request). A
// club's spans do not depend on the range, so a loaded club never goes stale: a search that
// adds clubs season by season names the ones already loaded throughout. A failed load
// leaves that club on today's name.
export function useEraClubNames(codes, lo, hi) {
  const [spans, setSpans] = useState({})
  const key = [...new Set(codes.filter((c) => c && ID_OF[c]))].sort().join(',')
  useEffect(() => {
    if (!key) return
    for (const c of key.split(',')) {
      franchiseFor(ID_OF[c]).then((f) => setSpans((s) => (s[c] ? s : { ...s, [c]: f.spans })), () => {})
    }
  }, [key])
  return eraNamer(spans, lo, hi)
}
