import { useEffect, useState } from 'react'
import { franchiseFor } from '../../api/history/franchiseSeasons.js'
import { ALL_MLB_TEAM_IDS, teamAbbr } from '../../lib/teams.js'
import { clubName } from '../../api/research/filters.js'

// ERA CLUB NAMES (Gary, 2026-11-17, #3150): a club filter matches the whole franchise (its
// one club id), and its pill names the club as it was called across the searched seasons,
// oldest first: 1987-2010 at WSH reads "Montreal Expos / Washington Nationals".
const ID_OF = Object.fromEntries(ALL_MLB_TEAM_IDS.map((id) => [teamAbbr({ id }), id]))

// Pure: the names `spans` ({ from, to, name }) carry within [lo, hi], oldest first, deduped.
export function namesInRange(spans, lo, hi) {
  return [...new Set((spans ?? []).filter((s) => s.from <= hi && s.to >= lo).sort((a, b) => a.from - b.from).map((s) => s.name))]
}

// Pure: the pill's name, or null to keep the current one. One era name counts too: 1985-1987
// at WSH is "Montreal Expos".
export const eraLabel = (names) => (names.length ? names.join(' / ') : null)

// { code: 'Name / Name' } for `codes` over seasons [lo, hi]; a club not yet loaded, or
// with no name on file in range, reads its current name (clubName).
export function useEraClubNames(codes, lo, hi) {
  const [names, setNames] = useState({})
  const key = codes.filter(Boolean).join(',')
  useEffect(() => {
    let live = true
    if (lo == null || hi == null) return undefined
    Promise.all(key.split(',').filter((c) => ID_OF[c]).map((c) => franchiseFor(ID_OF[c]).then((f) => [c, namesInRange(f.spans, lo, hi)]))).then((rows) => {
      if (live) setNames(Object.fromEntries(rows.filter(([, n]) => eraLabel(n)).map(([c, n]) => [c, eraLabel(n)])))
    }, () => {})
    return () => {
      live = false
    }
  }, [key, lo, hi])
  return (code) => names[code] ?? clubName(code)
}
