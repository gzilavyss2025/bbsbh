// Level progression, the dropped rehab stints and the career timeline: the
// register's sibling shapers, split out of ../careerRegister.js to keep it
// under the file-size cap. Season lines only. See ../../person.js's header for
// the module's overall spoiler footing.
import { SPORT_LABEL, MILB_LEVELS } from '../../../lib/teams.js'
import { meetsWorkload, CUP_OF_COFFEE_FLOOR, REHAB_CAP } from '../../rehab-policy.js'
import { ipToOuts } from '../../../lib/math/innings.js'
import { DASH, num } from '../shared.js'
import { levelSeasonStat, CAREER_ORDER } from '../careerRegister.js'
import { withoutMultiTeamAggregate } from '../stats.js'

// ---------------------------------------------------------------------------
// Level progression — for a pre-debut MiLB player, one row per level from
// wherever his career actually started up through AAA (a rung above his
// current level still renders dimmed, to complete the "climb to MLB"
// narrative — but rungs below his starting level are dropped outright: a
// player who debuted at A, say, is never going back to Rookie ball) built
// from the same multi-level yearByYear splits already fetched for the nested
// ledger above — no extra request.
// Each level also carries its games and the clubs he played them for (first
// played first), counted from the club rows so a two-club season's team-less
// roll-up never doubles them. `mlbSplits` (optional) feeds `mlbGames`.
// ---------------------------------------------------------------------------

const gamesOf = (rows) => rows.reduce((t, s) => t + num(s.stat?.gamesPlayed), 0)

export function levelProgressionView(splits, group, currentSportId, mlbSplits) {
  const byLevel = new Map()
  for (const s of splits ?? []) {
    const sid = s.sport?.id
    if (!sid) continue
    if (!byLevel.has(sid)) byLevel.set(sid, [])
    byLevel.get(sid).push(s)
  }
  const levels = MILB_LEVELS.map(({ sportId, label }) => {
    const rows = byLevel.get(sportId) ?? []
    const clubRows = withoutMultiTeamAggregate(rows)
    const clubs = new Map()
    for (const s of clubRows) {
      if (!s.team?.id) continue
      const club = clubs.get(s.team.id) ?? { id: s.team.id, name: s.team.name ?? '', games: 0 }
      club.games += num(s.stat?.gamesPlayed)
      clubs.set(s.team.id, club)
    }
    const stat = levelSeasonStat(rows, group)
    const years = rows.map((s) => Number(s.season)).filter(Boolean)
    return {
      sportId,
      label,
      reached: rows.length > 0,
      firstYear: years.length ? Math.min(...years) : null,
      lastYear: years.length ? Math.max(...years) : null,
      games: gamesOf(clubRows),
      teams: [...clubs.values()],
      stat:
        group === 'pitching'
          ? `${stat?.inningsPitched ?? DASH} IP`
          : `${num(stat?.atBats)} AB`,
      isCurrent: sportId === currentSportId,
    }
  })
  const startIndex = levels.findIndex((l) => l.reached)
  if (startIndex === -1) return null
  return {
    levels: levels.slice(startIndex),
    minorsGames: levels.reduce((t, l) => t + l.games, 0),
    mlbGames: gamesOf(withoutMultiTeamAggregate(mlbSplits)),
  }
}

// Rehab-assignment noise. Once a player has reached the majors, any later
// minor-league stint is a rehab appointment (or a brief option down), not part
// of his climb — an established MLB regular like Christian Yelich logging a
// handful of AA at-bats years after his debut would otherwise light up a level
// on the "Path to the Majors" card and add a stray row to the minor-league
// table. Keep only MiLB seasons up to and including the debut year (the
// ascent); drop everything after it. A pre-debut player has no debutYear, so
// nothing is dropped.
export function dropRehabStints(splits, debutYear) {
  if (!debutYear) return splits ?? []
  return (splits ?? []).filter((s) => Number(s.season) <= debutYear)
}

// ---------------------------------------------------------------------------
// Career timeline — the chronological team-by-team map shown above the "Path to
// the Majors" card: one stop per CONTINUOUS stint with a club the player logged
// REAL time with, earliest first, with the year(s) that stint spanned. A club
// left and later rejoined gets a fresh stop each visit (see the stint fold
// below), so the run reads in true career order. "Real time" is a threshold (10
// games as a batter, 20 IP for a pitcher) applied per team-season to MINOR-
// league stints only — any MLB appearance always counts (even one AB / a third
// of an inning) — so a MiLB cup of coffee or a pre-debut rehab stint drops out
// but no big-league club ever does. A team is a single level, so
// this also decides the level example: Yelich's 2013 keeps AA (49 G) but not
// his 7 G at A+ or 5 G in the complex league. A post-debut MiLB season needs
// more (see qualifies): it survives only when the minors were the primary home
// that year, so a big leaguer's short rehab or option down doesn't append a
// misleading season to his old farm club. Fed the player's full year-by-year
// splits (MLB + every MiLB level) plus his debutYear; each stop's tint and
// hover label (its parent org, for a farm club) are resolved separately by the
// caller, since this stays a pure shaper.
// ---------------------------------------------------------------------------

// First year through last, with a two-digit tail ("2018–21"), or just the one
// year for a single-season stint. Deliberately NOT a run-per-gap breakdown
// ("2018, 2020"): a stint can have an internal gap year with no qualifying
// stint anywhere (an injury) without the player having left the org, so the
// span reads straight through — see the stint fold above. Input already
// sorted ascending.
function formatSeasonSpan(seasons) {
  const start = seasons[0]
  const end = seasons[seasons.length - 1]
  return start === end ? `${start}` : `${start}–${String(end).slice(2)}`
}

export function careerTimelineView(splits, group, debutYear, orgOf = null) {
  // Sum the workload per team-season (a mid-season same-level trade can split
  // one club's year across rows; a team-less synthetic aggregate row carries no
  // team.id and is skipped by the guard, so it can't double-count). Also tally
  // MLB workload per season so the post-debut rehab test below can compare.
  // `order` keeps the earliest position that team-season held in the input —
  // the only chronological signal a year-by-year split carries (statsapi lists
  // a traded season's stints in the order he played them, and the caller
  // concatenates MLB before the MiLB fan-out). The org sort below reads it.
  const byKey = new Map()
  for (const [i, s] of (splits ?? []).entries()) {
    const season = Number(s.season)
    const teamId = s.team?.id
    const sportId = s.sport?.id
    if (!season || !teamId || !sportId) continue
    const games = num(s.stat?.gamesPlayed)
    const outs = ipToOuts(s.stat?.inningsPitched)
    const key = `${season}|${teamId}`
    if (!byKey.has(key)) {
      byKey.set(key, { season, teamId, sportId, teamName: s.team?.name ?? '', games: 0, outs: 0, order: i })
    }
    const acc = byKey.get(key)
    acc.games += games
    acc.outs += outs
  }
  const qualifies = (a) => {
    // Any MLB action at all is real team history — even a single AB or a third
    // of an inning puts that club on the map. The cup-of-coffee floor and the
    // rehab test below apply to the MINORS only; a well-traveled reliever's
    // sub-20-IP major-league stints must never be filtered (that left JP
    // Feyereisen with only the Rays — his one 20+ IP club — of the several MLB
    // teams he pitched for).
    if (a.sportId === 1) return a.games >= 1 || a.outs >= 1
    // Below the cup-of-coffee threshold (10 G / 20 IP, or 10 relief outings) a
    // MiLB stint never counts.
    if (!meetsWorkload(a.games, a.outs, group, CUP_OF_COFFEE_FLOOR)) return false
    // A MiLB stint AFTER the debut year is rehab-assignment noise (or a brief
    // option down), NOT real team history — an established regular's stray AAA
    // games would otherwise append a misleading season to his old farm club.
    // Keep such a season only when it clears the rehab cap (a real option-down
    // or demotion) — the SAME absolute test the career register uses, so the
    // timeline and the table always agree on which post-debut stints are real.
    // The ascent (seasons up to and including the debut year) is always kept.
    if (debutYear && a.season > debutYear && !meetsWorkload(a.games, a.outs, group, REHAB_CAP)) return false
    return true
  }
  const kept = [...byKey.values()].filter(qualifies)
  if (!kept.length) return null

  // Walk the qualifying team-seasons in chronological order — earliest year
  // first, and within a year by org then bottom-up by level (see the sort
  // below) so a same-year climb reads bottom-up — and fold each run of consecutive same-club seasons into ONE
  // stint. A club the player leaves and later rejoins (Gary Sánchez's Brewers
  // in 2024, then again in 2026 after a year with Baltimore) yields a separate
  // stint each time, so its logo repeats in its own chronological slot rather
  // than collapsing the two visits into one badge. A season with no qualifying
  // stint ANYWHERE (Casey Mize's 2023 Tommy John year) does NOT end a stint on
  // its own, though — he never left the org, he was just hurt, so the club
  // either side of that gap folds into the SAME badge (see formatSeasonSpan:
  // its caption spans first-to-last year straight through, the gap silently
  // absorbed, rather than surfacing "2020–22, 2024–26" and implying he'd
  // actually left and come back).
  //
  // Level alone is NOT enough to order a season, which is the bug this sort
  // was rewritten for: a player traded mid-year (Joey Wiemer, 2024 — Milwaukee
  // and Nashville, then Cincinnati and Louisville) printed both farm clubs
  // first and both big-league clubs after them, reading as MIL → CIN → MIL →
  // CIN. So a season sorts by ORG first — a farm club counts as its parent org,
  // per `orgOf(teamId, season)` — and only then bottom-up by level INSIDE that
  // org. The orgs themselves take the input's own order (see `order` above),
  // which for a traded season is the big-league stints' chronological order.
  //
  // Two deliberate limits. An org he spent the season with in the MINORS ONLY
  // sorts after every org he played big-league games for that year, since the
  // MiLB fan-out carries no date to say otherwise. And a season is org-sorted
  // only when EVERY farm club in it resolved to a parent (`orgOf` is optional,
  // and the hand-seeded history doesn't cover every club-season) — otherwise
  // the season falls back to the plain bottom-up climb, which is right for the
  // ordinary one-org year and no worse than before for the rest.
  const seasonPlan = new Map()
  for (const a of kept) {
    const org = a.sportId === 1 ? a.teamId : orgOf?.(a.teamId, a.season) ?? null
    a.org = org ?? a.teamId
    const plan = seasonPlan.get(a.season) ?? { orgOrder: new Map(), resolved: true }
    if (org == null) plan.resolved = false
    plan.orgOrder.set(a.org, Math.min(plan.orgOrder.get(a.org) ?? Infinity, a.order))
    seasonPlan.set(a.season, plan)
  }
  const orgRank = (a) => {
    const plan = seasonPlan.get(a.season)
    return plan.resolved && plan.orgOrder.size > 1 ? plan.orgOrder.get(a.org) : 0
  }
  kept.sort(
    (a, b) =>
      a.season - b.season ||
      orgRank(a) - orgRank(b) ||
      CAREER_ORDER.indexOf(a.sportId) - CAREER_ORDER.indexOf(b.sportId),
  )
  const stints = []
  for (const a of kept) {
    const open = stints[stints.length - 1]
    if (open && open.teamId === a.teamId) open.seasons.push(a.season)
    else stints.push({ teamId: a.teamId, sportId: a.sportId, teamName: a.teamName, seasons: [a.season] })
  }
  const entries = stints.map((t) => {
    const seasons = [...new Set(t.seasons)].sort((x, y) => x - y)
    return {
      teamId: t.teamId,
      teamName: t.teamName,
      sportId: t.sportId,
      tier: t.sportId === 1 ? 'mlb' : 'milb',
      level: SPORT_LABEL[t.sportId] ?? '',
      minSeason: seasons[0],
      yearText: formatSeasonSpan(seasons),
    }
  })
  return { entries }
}
