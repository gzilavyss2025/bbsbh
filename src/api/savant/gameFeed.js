// Contact replay, phase B (#1771, docs/contact-replay.md §3.2): Savant's /gf
// bat-tracking fields for one game, STRIPPED ON PARSE (Gary, 2026-10-18).
//
// `/gf?game_pk=` returns the WHOLE game: the linescore, the box score, and the
// play text of halves the reader has not revealed. So the raw body never leaves
// this function. It is fetched and parsed in one scope, the parser reads ONLY
// team_home[] and team_away[], and from each row ONLY play_id, batSpeed, xba,
// is_barrel and contextMetrics.homeRunBallparks. No cache, ref or module state
// holds the body, and nothing logs it.
//
// OUTPUT: Map of playId -> { batSpeed, xba, barrel, hrParks }. A missing field is
// null. `xba` is a string on the wire (".820"), a number here. Not an MLB game
// (sportId !== 1): an empty Map and no fetch.
//
// SPOILER CLASSIFICATION: reveal-only. The kept fields describe one batted ball;
// call it only from the replay, inside the half's reveal.

const GF_URL = 'https://baseballsavant.mlb.com/gf?game_pk='

const num = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v))

export async function fetchSavantBatTracking(gamePk, sportId) {
  const out = new Map()
  if (sportId !== 1) return out
  const res = await fetch(GF_URL + encodeURIComponent(gamePk))
  if (!res.ok) throw new Error(`Savant /gf ${res.status}`)
  const body = await res.json()
  for (const row of [...(body.team_home ?? []), ...(body.team_away ?? [])]) {
    if (!row?.play_id) continue
    out.set(row.play_id, {
      batSpeed: num(row.batSpeed),
      xba: num(row.xba),
      barrel: row.is_barrel == null ? null : row.is_barrel === 1,
      hrParks: num(row.contextMetrics?.homeRunBallparks),
    })
  }
  return out
}
