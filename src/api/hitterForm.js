import { getJson } from './statsapi.js'

// The PLAYER page's "Recent form" card for hitters: how he's hit over his
// last 7 / 15 / 30 games against his own full-season line — the hitter
// analog of workload.js's pitcher recent-appearances precompute, but fetched
// live per-player rather than read from a nightly file (there's no existing
// batch precompute for lastXGames splits). Four `lastXGames` windows fan out
// in parallel, same Promise.all idiom as fetchPitchingAdvanced /
// fetchAllStarRosterIds in person-fetch.js. Each split degrades to null on
// its own (a rookie with under 30 games this season just has a null last30,
// which nulls the whole card — see hitterFormView).
//
// Name note: src/api/recentForm.js is an unrelated, already-shipped TEAM page
// module (the "Last 10 Games" roster projection consumed by
// screens/team/data/loadRoster.js) — this file is the PLAYER page's per-hitter
// stat-line card and intentionally carries a different name (hitterForm, not
// recentForm) so the two "recent form" features never collide on one path.
export async function fetchHitterForm(personId, season) {
  if (!personId || !season) return null
  const urls = {
    last7: `/api/v1/people/${personId}/stats?stats=lastXGames&limit=7&group=hitting&season=${season}`,
    last15: `/api/v1/people/${personId}/stats?stats=lastXGames&limit=15&group=hitting&season=${season}`,
    last30: `/api/v1/people/${personId}/stats?stats=lastXGames&limit=30&group=hitting&season=${season}`,
    season: `/api/v1/people/${personId}/stats?stats=season&group=hitting&season=${season}`,
  }
  const entries = Object.entries(urls)
  const results = await Promise.all(
    entries.map(([, path]) => getJson(path).then(statFor).catch(() => null)),
  )
  const out = {}
  entries.forEach(([key], i) => {
    out[key] = results[i]
  })
  return out
}

function statFor(data) {
  return data?.stats?.[0]?.splits?.[0]?.stat ?? null
}

// Signed OPS-points delta, e.g. "+.102" / "−.054" — same U+2212 minus-sign
// convention as PitcherWorkloadCard's signedPct, applied to a rate delta
// instead of a percentage. The unit is named once in the column head, not on
// every row.
function signedOpsDelta(delta) {
  const sign = delta < 0 ? '−' : '+'
  return `${sign}${Math.abs(delta).toFixed(3).replace(/^0(?=\.)/, '')}`
}

// How far off the season line a bar has to run to fill its half of the track.
// A FIXED domain, not one scaled to this player's own worst window: a scaled
// domain would draw every hitter alive at full width and make a 20-point wobble
// look like a slump. 300 OPS points is roughly the gap between a league-average
// bat and either an MVP or a pitcher's, so a full bar means "as far from himself
// as one player is from another". Anything beyond clamps and is marked.
const DELTA_DOMAIN = 0.3

const clamp = (x) => Math.max(-1, Math.min(1, x))

// Pure view over fetchHitterForm's output, or null. Requires only last30 — a
// missing last7/last15 (a hitter with fewer than 15 team games played) just
// drops that ROW rather than nulling the whole card, since last30 alone is
// still a useful "recent form" read.
//
// The shape is a small TIME SERIES with its own baseline, not a bag of facts.
// Three things drove that. The windows NEST — the last 7 games are inside the
// last 15, which are inside the last 30 — so they have to read as one
// narrowing sequence, never as three independent samples laid out in a grid.
// The season line is the only thing that makes any of them mean "form", so it
// is a printed row rather than an invisible number folded into one delta. And a
// window's AT-BATS travel with it: .174 over 23 at-bats and .191 over 115 are
// the same-looking figure at very different confidence, so the sample is a
// column, not a footnote.
export function hitterFormView({ last7, last15, last30, season } = {}) {
  if (!last30 || !(Number(last30.gamesPlayed) > 0)) return null

  const seasonOps = Number.parseFloat(season?.ops)
  const base = Number.isFinite(seasonOps) ? seasonOps : null

  // avg/ops come back from statsapi as already-formatted strings (".179",
  // "1.021", …) — rendered as-is, never re-parsed for display. `opsNum` is a
  // separate parse, used only to place a bar.
  const row = (key, label, s) => {
    if (!s || !(Number(s.gamesPlayed) > 0) || s.avg == null || s.ops == null) return null
    const ops = Number.parseFloat(s.ops)
    const delta = base != null && Number.isFinite(ops) ? ops - base : null
    return {
      key,
      label,
      ab: Number(s.atBats) > 0 ? String(s.atBats) : '—',
      avg: s.avg,
      ops: s.ops,
      delta,
      deltaText: delta == null ? '' : signedOpsDelta(delta),
      // −1…1 across the track; `clamped` marks a window that ran off the end.
      lean: delta == null ? null : clamp(delta / DELTA_DOMAIN),
      clamped: delta != null && Math.abs(delta) > DELTA_DOMAIN,
    }
  }

  const rows = [
    row('last7', 'Last 7', last7),
    row('last15', 'Last 15', last15),
    row('last30', 'Last 30', last30),
  ].filter(Boolean)
  if (rows.length === 0) return null

  // The baseline row. It carries no delta and no bar by definition — it IS the
  // zero — and is flagged so the UI can rule it off as the reference rather
  // than print it as a fourth window.
  const anchor = row('season', 'Season', season)
  if (anchor) {
    anchor.isAnchor = true
    anchor.delta = null
    anchor.deltaText = ''
    anchor.lean = null
    anchor.clamped = false
  }

  // One window's counting context, and it says WHICH window. The old card
  // printed "HR / RBI, last 15" beside three rate lines covering 7/15/30, so
  // the reader had to notice that one cell had quietly chosen a fourth,
  // different window. The widest window is the one worth counting over: it is
  // the least noisy, and it is the one the bars are least able to say anything
  // about on their own.
  const power =
    last30?.homeRuns != null && last30?.rbi != null
      ? `${last30.homeRuns} HR · ${last30.rbi} RBI`
      : null
  const discipline =
    Number(last30?.plateAppearances) > 0 && last30?.strikeOuts != null && last30?.baseOnBalls != null
      ? `${Math.round((Number(last30.strikeOuts) / Number(last30.plateAppearances)) * 100)}% K · ` +
        `${Math.round((Number(last30.baseOnBalls) / Number(last30.plateAppearances)) * 100)}% BB`
      : null

  return {
    rows,
    anchor: anchor ?? null,
    hasBars: base != null,
    footer: [power, discipline].filter(Boolean).join('  ·  ') || null,
  }
}
