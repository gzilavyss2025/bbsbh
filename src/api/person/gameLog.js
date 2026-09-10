// Game log — the back-of-the-card ledger, spoiler-safe by date cutoff — plus
// Firsts, the first career instances of a handful of milestones. See
// ../person.js's header for the module's overall spoiler footing.

import { SPORT_LABEL } from '../../lib/teams.js'
import { monthDay } from '../../lib/dates.js'
import { ipToOuts } from '../rehab-policy.js'
import { DASH, NBSP, num } from './shared.js'

// ---------------------------------------------------------------------------
// Game log — the back-of-the-card ledger, spoiler-safe by date cutoff
// ---------------------------------------------------------------------------

// Short, correct opponent label from the full name (abbreviation is blank in
// gameLog rows): the team nickname is the last word — "Tampa Bay Rays" → "Rays".
function oppLabel(opponent) {
  const name = opponent?.teamName || opponent?.name || ''
  if (!name) return DASH
  return opponent?.teamName || name.split(/\s+/).slice(-1)[0]
}

// A count-tagged token for a stat line — "HR" for one, "2 HR" for several, ''
// for none — so a line reads like a broadcast chyron ("2B, HR, 2 RBI, K"). The
// count and label are joined by a NON-BREAKING space so a long line wraps only
// at the commas between tokens — "6 K" never splits across two lines.
function tag(n, label) {
  const v = num(n)
  if (!v) return null
  return v === 1 ? label : `${v}${NBSP}${label}`
}

// A hitter's one-game line, TV-lower-third style: "2-4, 2B, HR, 2 RBI, K"
// (hits-for-atBats, then extra-base hits, then RBI / walks / steals / strikeouts,
// each shown only when it happened).
export function hitterLine(st) {
  const parts = [`${num(st.hits)}-${num(st.atBats)}`]
  for (const t of [
    tag(st.doubles, '2B'),
    tag(st.triples, '3B'),
    tag(st.homeRuns, 'HR'),
    tag(st.rbi, 'RBI'),
    tag(st.baseOnBalls, 'BB'),
    tag(st.stolenBases, 'SB'),
    tag(st.strikeOuts, 'K'),
  ]) {
    if (t) parts.push(t)
  }
  return parts.join(', ')
}

// A pitcher's one-game line: "GS, 6.0 IP, 2 H, 1 R, 1 ER, 4 BB, 6 K" (leads
// with GS when he started; the counting stats always show, zeros included, the
// way a box-score pitching line reads).
export function pitcherLine(st) {
  const parts = []
  if (num(st.gamesStarted) > 0) parts.push('GS')
  // Non-breaking space within each token (see tag/NBSP) so the line wraps only
  // at the commas — a long start ("6.0 IP, 5 H, 2 R, 2 ER, 3 BB, 9 K") never
  // splits a stat like "9 K" across two lines.
  parts.push(`${st.inningsPitched ?? DASH}${NBSP}IP`)
  parts.push(`${num(st.hits)}${NBSP}H`)
  parts.push(`${num(st.runs)}${NBSP}R`)
  parts.push(`${num(st.earnedRuns)}${NBSP}ER`)
  parts.push(`${num(st.baseOnBalls)}${NBSP}BB`)
  parts.push(`${num(st.strikeOuts)}${NBSP}K`)
  return parts.join(', ')
}

// Rows are filtered to games BEFORE `cutoff` (YYYY-MM-DD) — the day the game
// being scored starts — then shown newest first. That cutoff is the whole
// spoiler defense: the log can never surface tonight's line or anything after
// it. `cutoff` null (context-free cold link) shows the most recent games. Each
// row carries a single broadcast-style stat `line` (see hitterLine/pitcherLine)
// rather than a grid of columns.
export function gameLogView(splits, group, cutoff, limit = 8, { tagLevel = false } = {}) {
  const rows = (splits ?? [])
    .filter((s) => s.date && (!cutoff || s.date < cutoff))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, limit)
    .map((s) => {
      const st = s.stat ?? {}
      const md = monthDay(s.date)
      return {
        date: md,
        home: s.isHome,
        opp: oppLabel(s.opponent),
        gamePk: s.game?.gamePk ?? null,
        // A per-row level pill only when the log mixes levels (a rehabbing big
        // leaguer's combined MLB + MiLB log); a single-level log leaves it blank
        // so every row isn't stamped with a redundant "MLB".
        level: tagLevel ? SPORT_LABEL[s.sport?.id] ?? '' : '',
        line: group === 'pitching' ? pitcherLine(st) : hitterLine(st),
        // Quality start (6+ IP, ≤3 ER, as a starter) — a small pill beside the
        // opponent so a run of strong starts reads at a glance.
        qs: group === 'pitching' && num(st.gamesStarted) > 0 &&
          ipToOuts(st.inningsPitched) >= 18 && num(st.earnedRuns) <= 3,
      }
    })
  if (!rows.length) return null
  return { rows }
}

// ---------------------------------------------------------------------------
// Firsts — first career instances of a handful of milestones, read off the
// debut season's game log (a hitter's "first start" needs the game's own
// boxscore rather than a gameLog field — see mlb.js's findFirstStart; a
// pitcher's first strikeout needs the game's own play-by-play for the batter
// faced — see mlb.js's findFirstStrikeoutBatter). Scoped to the debut year
// only: that's the data this page already fetches for the debut-game deep
// link, so no extra request is needed, and it covers every player who sees
// meaningful debut-year playing time. Cutoff-filtered exactly like
// gameLogView — a still-active debut season could otherwise reveal a
// not-yet-revealed game's date and outcome.
// ---------------------------------------------------------------------------

export const FIRSTS_DEFS = [
  { key: 'hit', label: 'First Hit', test: (st) => num(st.hits) > 0 },
  {
    key: 'xbh',
    label: 'First Extra-Base Hit',
    test: (st) => num(st.doubles) + num(st.triples) + num(st.homeRuns) > 0,
  },
  { key: 'hr', label: 'First Home Run', test: (st) => num(st.homeRuns) > 0 },
  { key: 'run', label: 'First Run Scored', test: (st) => num(st.runs) > 0 },
  { key: 'so', label: 'First Strikeout', test: (st) => num(st.strikeOuts) > 0 },
]

// Pitching counterpart. Every field but the strikeout victim is a direct
// gameLog stat (verified live: pitching gameLog rows carry gamesStarted,
// wins, losses, saves per game), unlike the hitter "first start" case. The
// "first appearance" milestone that used to live here is now the synthetic
// "MLB Debut" row (a pitcher's debut IS his first appearance — see loadPlayer),
// which absorbs the First Start when the two are the same game.
export const PITCHER_FIRSTS_DEFS = [
  { key: 'start', label: 'First Start', test: (st) => num(st.gamesStarted) > 0 },
  { key: 'win', label: 'First Win', test: (st) => num(st.wins) > 0 },
  { key: 'loss', label: 'First Loss', test: (st) => num(st.losses) > 0 },
  { key: 'save', label: 'First Save', test: (st) => num(st.saves) > 0 },
  { key: 'so', label: 'First Strikeout', test: (st) => num(st.strikeOuts) > 0 },
]

// Returns { events, rowsAscending }: `events` maps each def's key to the
// earliest qualifying split (or null), `rowsAscending` is the full cutoff-safe
// debut-year log oldest-first — callers reuse it to also search for the first
// start (hitters) or the first strikeout's batter (pitchers).
export function firstsFromGameLog(splits, cutoff, defs = FIRSTS_DEFS) {
  const rowsAscending = (splits ?? [])
    .filter((s) => s.date && (!cutoff || s.date < cutoff) && s.game?.gamePk)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
  const events = {}
  for (const def of defs) {
    const found = rowsAscending.find((s) => def.test(s.stat ?? {}))
    events[def.key] = found
      ? { label: def.label, date: found.date, gamePk: found.game.gamePk, isHome: found.isHome }
      : null
  }
  return { events, rowsAscending }
}

// The debut season's game log alone misses any milestone a player first reached
// in a LATER season — a late-September cameo debut (Bethancourt: one 2013 game,
// only a strikeout) gets his first hit/HR/run seasons later. So use the
// per-season year-by-year splits to find the earliest SEASON each milestone
// occurred; the caller then fetches just those seasons' game logs to pin the
// exact game. A milestone the player never reached (a reliever's save, a slap
// hitter's home run) maps to null and costs no fetch. Capped at `throughYear`
// (the as-of / current season) so a scoped past view never reaches past it;
// the same-season game-log date filter in firstsFromGameLog still trims within
// the boundary season. Same monotonic `stat > 0` tests as the game-log defs, so
// a season aggregate that passes is exactly a season where the milestone
// happened. Returns the sorted, de-duplicated set of seasons to fetch.
export function firstMilestoneSeasons(ybySplits, defs, throughYear) {
  const seasons = new Set()
  for (const def of defs) {
    let earliest = null
    for (const s of ybySplits ?? []) {
      const yr = Number(s.season)
      if (!Number.isFinite(yr) || (throughYear && yr > throughYear)) continue
      if (def.test(s.stat ?? {}) && (earliest === null || yr < earliest)) earliest = yr
    }
    if (earliest !== null) seasons.add(earliest)
  }
  return [...seasons].sort((a, b) => a - b)
}
