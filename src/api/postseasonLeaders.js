// Postseason Leaders page's data — since-2000 career postseason
// leaderboards (batting/pitching) plus franchise/award leaders, read from a
// static same-origin file (public/data/postseason-leaders.json) rather than
// computed live.
//
// scripts/gen-postseason-leaders.mjs builds it — a hand-run regenerate, not
// a cron, same footing as gen-postseason-history.mjs (postseason results
// are immutable once played). The batting/pitching aggregation is backed by
// the shared SQLite layer (scripts/lib/db.js, docs/adr/0021 — the genuine
// cross-game aggregation case it exists for); the team/award leaders are
// computed straight from postseason-history.json, no extra fetch. Every
// number here is a season(s)-old counting/rate stat with no LIVE game's
// spoiler risk (same footing as Awards History/WAR), so this file needs no
// spoiler cutoff or SealBox.
//
// Batting/pitching entries are pre-shaped into TeamLeaders' `precomputed`
// category-map contract ({ id, name, teamId, display, value } per category
// key — see api/teamLeaders.js) so the page can reuse that component (and
// its Featured-leader/chasers layout) instead of a bespoke render, same as
// minorsLeaders.js does for the all-minors board.
//
// Degrades to an empty shape before the file exists or on any failure.
let cached = null

const EMPTY = {
  since: null,
  teams: { titles: [], pennants: [], appearances: [] },
  mvpAwards: [],
  batting: { homeRuns: [], rbi: [], hits: [], avg: [], stolenBases: [] },
  pitching: { wins: [], strikeouts: [], saves: [], era: [] },
}

// Exported so postseasonSeries.js's series-scoped board can share these
// instead of keeping its own copy — both format the same career/series
// counting + rate stats.
export const int = (v) => String(v)
// ".317" — three decimals, no leading zero (career postseason AVG).
export const rate3 = (v) => v.toFixed(3).replace(/^(-?)0(?=\.)/, '$1')
// "2.14" — two decimals (career postseason ERA).
const num2 = (v) => v.toFixed(2)

function toEntries(rows, format) {
  return (rows ?? []).map((r) => ({
    id: r.playerId,
    name: r.name,
    teamId: r.teamId,
    display: format(r.value),
    value: r.value,
  }))
}

export const BATTING_CATEGORIES = [
  { key: 'homeRuns', label: 'Home runs', short: 'HR' },
  { key: 'rbi', label: 'RBI', short: 'RBI' },
  { key: 'hits', label: 'Hits', short: 'H' },
  { key: 'avg', label: 'Batting average', short: 'AVG' },
  { key: 'stolenBases', label: 'Stolen bases', short: 'SB' },
]

export const PITCHING_CATEGORIES = [
  { key: 'wins', label: 'Wins', short: 'W' },
  { key: 'strikeouts', label: 'Strikeouts', short: 'SO' },
  { key: 'saves', label: 'Saves', short: 'SV' },
  { key: 'era', label: 'ERA', short: 'ERA' },
]

export async function loadPostseasonLeaders() {
  if (cached) return cached
  try {
    const res = await fetch('/data/postseason-leaders.json')
    if (!res.ok) throw new Error(`postseason-leaders.json ${res.status}`)
    const data = await res.json()
    cached = {
      since: data.since ?? null,
      teams: {
        titles: data.teams?.titles ?? [],
        pennants: data.teams?.pennants ?? [],
        appearances: data.teams?.appearances ?? [],
      },
      mvpAwards: data.mvpAwards ?? [],
      batting: {
        homeRuns: toEntries(data.batting?.homeRuns, int),
        rbi: toEntries(data.batting?.rbi, int),
        hits: toEntries(data.batting?.hits, int),
        avg: toEntries(data.batting?.avg, rate3),
        stolenBases: toEntries(data.batting?.stolenBases, int),
      },
      pitching: {
        wins: toEntries(data.pitching?.wins, int),
        strikeouts: toEntries(data.pitching?.strikeouts, int),
        saves: toEntries(data.pitching?.saves, int),
        era: toEntries(data.pitching?.era, num2),
      },
    }
  } catch {
    cached = EMPTY
  }
  return cached
}
