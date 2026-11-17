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

// Each club's franchise spans, loaded once per set of `codes` (franchiseFor caches the
// request). Tagged with the codes they answer, so a stale or failed load names nothing.
export function useEraClubNames(codes, lo, hi) {
  const [got, setGot] = useState({ tag: null, spans: {} })
  const tag = [...new Set(codes.filter((c) => c && ID_OF[c]))].sort().join(',')
  useEffect(() => {
    let live = true
    if (!tag) return undefined
    Promise.all(tag.split(',').map((c) => franchiseFor(ID_OF[c]).then((f) => [c, f.spans]))).then((rows) => {
      if (live) setGot({ tag, spans: Object.fromEntries(rows) })
    }, () => {})
    return () => {
      live = false
    }
  }, [tag])
  return eraNamer(got.tag === tag ? got.spans : {}, lo, hi)
}
