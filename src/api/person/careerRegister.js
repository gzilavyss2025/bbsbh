// Career register — the unified MLB + MiLB stat table — plus level
// progression and the chronological career timeline. See ../person.js's
// header for the module's overall spoiler footing.

import { SPORT_LABEL, MILB_LEVELS } from '../../lib/teams.js'
import { ipToOuts, meetsWorkload, CUP_OF_COFFEE_FLOOR, REHAB_CAP, txnDate } from '../rehab-policy.js'
import { DASH, num } from './shared.js'
import { aggregateSplits, withoutMultiTeamAggregate } from './stats.js'
import { isIlPlacementTxn } from './activity.js'

// ---------------------------------------------------------------------------
// Career register support — the shared per-row cells and the season/level
// aggregation the register builds on (see careerRegisterView below).
// ---------------------------------------------------------------------------

// One season / career / level row's cells, in the group's register columns. A
// pitching row leads its counting stats with G/GS, then the role stat (SV for a
// player who regularly closes, W–L otherwise — mirroring the season tiles), and
// closes with the rate pair K/BB and WHIP. The narrower secondary columns (GS,
// K, BB) drop out on a phone (see CareerRegister's hideNarrow), so the
// essentials stay legible there.
function yearByYearCells(st, group, showSaves) {
  if (group === 'pitching') {
    const lead = showSaves ? num(st.saves) : `${num(st.wins)}–${num(st.losses)}`
    return [
      num(st.gamesPlayed),
      num(st.gamesStarted),
      lead,
      st.era ?? DASH,
      st.inningsPitched ?? DASH,
      num(st.strikeOuts),
      num(st.baseOnBalls),
      st.whip ?? DASH,
    ]
  }
  return [num(st.gamesPlayed), num(st.atBats), st.avg ?? DASH, num(st.homeRuns), num(st.rbi)]
}

// A season's yearByYear splits at one level can include the same synthetic,
// team-less roll-up row a mid-season trade adds to any other stats fetch
// (verified live: Soto's 2022 trade returned Nationals + Padres + a third
// team-less row equal to their sum). Dropping it is `aggregateSplits`'s job
// now — deliberately ONE implementation of that rule, since the register used
// to be the only path that applied it and every other path (the current
// season's date-cut row, the milestone career total) double-counted a traded
// season. Kept as a named seam because the register reads season-at-one-level.
export function levelSeasonStat(rows, group) {
  return aggregateSplits(rows, group)
}

// Display order for a season's per-level sub-rows: MLB first (for the rare
// debuted-mid-multi-level case), then AAA down to Rookie. Exported for
// activity.js's otherLevelSeasonBlocks, which orders a player's promoted
// other-level tiles the same way.
export const LEVEL_ORDER_DESC = [1, 11, 12, 13, 14, 16]

// Career order, LOW level to high — Rookie ball up through MLB — so a career
// timeline reads left-to-right as a climb, and a mid-season promotion within
// one year sorts up the ladder.
const CAREER_ORDER = [16, 14, 13, 12, 11, 1]

// ---------------------------------------------------------------------------
// Career register — the unified MLB + MiLB stat table (replaces the separate
// MLB year-by-year and minor-league tables). One row per (season, level,
// CLUB), newest season first, MLB rows inked and MiLB rows penciled with a
// level pill.
//
// **The register shows everything.** Every season at every level the player
// appeared at is its own row — there is no workload threshold anywhere in this
// view, and no summary caption. A one-week AAA rehab stint gets the same line a
// full season does, and a season split between two clubs gets ONE LINE PER
// CLUB rather than a single row labelled "SD/PIT". That per-club split applies
// to the majors too, which is what the register used to fold away.
//
// It used to be otherwise: a small post-debut minor-league stint dropped out of
// the table into an "Also: 4.2 IP at AAA" footnote under it. The threshold was
// removed by request — a register is a record, and a line a reader has to
// decode from a footnote is worse than a short line in the table. Do not put a
// workload gate back here. The neighbouring surfaces still have one and should:
// activity.js's promoted other-level TILES are a curated highlight, not a
// record, and the career timeline drops rehab noise for the same reason.
//
// Totals never blend levels: a separate MLB and MiLB footer, each footing only
// its own side of the ledger. The MLB total uses the API's own career line when
// supplied (authoritative), the MiLB total sums the shown rows. A side gets a
// subtotal only when it has more than one row — two clubs in a season, two
// levels in a climb, or two seasons anywhere. A single line already foots
// itself, and a footer repeating it verbatim reads as a second season.
// ---------------------------------------------------------------------------

// Split one (season, level) bucket into its per-club stints, keeping the order
// the API returned them in (statsapi lists a traded season's stints
// chronologically, so a row's clubs read in the order he played for them).
//
// The synthetic team-less roll-up a team change emits has to be dropped HERE,
// before the grouping, not left to aggregateSplits: grouped on `team.id` it
// would form a `null` group of its own and print a phantom third row equal to
// the sum of the two real ones. A row synthesized by hand (the current-season
// fallback below, which carries no team) is not a roll-up and survives — it
// forms one group whose Team cell renders as a dash.
function byTeamStints(splits) {
  const byTeam = new Map()
  for (const s of withoutMultiTeamAggregate(splits ?? [])) {
    const id = s.team?.id ?? null
    if (!byTeam.has(id)) byTeam.set(id, [])
    byTeam.get(id).push(s)
  }
  return byTeam
}

// A career-register year between debut and now with literally no stat row
// anywhere (MLB or MiLB) otherwise just vanishes from the table — reading as
// "out of baseball" even when the real reason is a season-long injury (e.g.
// Tommy John recovery). Cross-referencing the transaction feed for a
// same-year IL placement is the one signal available with no new fetch (the
// player page already pulls full career transactions, see fetchTransactions)
// that separates "hurt all year" from a genuine gap (unsigned, holdout,
// retired-then-returned) the app has no data to explain.
function missingSeasonRows(presentYears, debutYear, currentSeason, transactions, group) {
  const rows = []
  for (let yr = debutYear; yr < currentSeason; yr++) {
    if (presentYears.has(yr)) continue
    const injured = (transactions ?? []).some(
      (t) => isIlPlacementTxn(t) && txnDate(t)?.slice(0, 4) === String(yr),
    )
    rows.push({
      key: `${yr}-gap`,
      year: String(yr),
      tier: 'gap',
      level: '',
      sportId: null,
      pill: '',
      teamIds: [],
      gap: true,
      note: injured
        ? 'Injured — missed season'
        : group === 'pitching'
          ? 'Did not pitch'
          : 'Did not play',
    })
  }
  return rows
}

export function careerRegisterView({ mlbSplits, milbSplits, group, role, debutYear, currentStat, currentSplits, currentSeason, currentSportId, careerStat, warByYear = {}, transactions = [] }) {
  // Group every split (MLB + all MiLB levels) into season -> sportId -> rows.
  const bySeason = new Map()
  for (const s of [...(mlbSplits ?? []), ...(milbSplits ?? [])]) {
    const yr = Number(s.season)
    const sid = s.sport?.id
    if (!yr || !sid) continue
    if (!bySeason.has(yr)) bySeason.set(yr, new Map())
    const byLevel = bySeason.get(yr)
    if (!byLevel.has(sid)) byLevel.set(sid, [])
    byLevel.get(sid).push(s)
  }
  const cur = Number(currentSeason)
  // Guarantee a stint for the current season at the player's current level even
  // if the year-by-year fetch hasn't caught up — its row uses the date-cut
  // currentStat, so it can't move mid-game (the spoiler defense).
  if (currentStat && currentSportId) {
    if (!bySeason.has(cur)) bySeason.set(cur, new Map())
    if (!bySeason.get(cur).has(currentSportId)) bySeason.get(cur).set(currentSportId, [])
  }
  // One stint per (season, level, club). Every stint is the deduped sum of that
  // club's rows at that level — one row in the ordinary case, several only when
  // the API splits a club's season (byDateRange emits duplicates; aggregateSplits
  // dedupes them).
  //
  // The current level's current season is the exception: it must read from the
  // caller's DATE-CUT splits, never the live year-by-year rows, so it can't move
  // mid-game. Those splits carry the same per-club shape, so the split below
  // stays uniform. If that fetch came back empty, the season collapses to the
  // ONE date-cut aggregate the caller also hands in — still date-cut, so still
  // safe, but a single line; it keeps the year-by-year rows' club ids so the
  // Team cell reads "SD/PIT" rather than losing the clubs altogether.
  const real = []
  const stint = (yr, sid, stat, teamIds) => {
    if (!stat) return
    real.push({ year: yr, sid, tier: sid === 1 ? 'mlb' : 'milb', stat, teamIds })
  }
  for (const [yr, byLevel] of bySeason) {
    for (const [sid, rows] of byLevel) {
      const isCurLevel = yr === cur && sid === currentSportId && currentStat
      if (isCurLevel && !currentSplits?.length) {
        stint(yr, sid, currentStat, [...new Set(rows.map((r) => r.team?.id).filter(Boolean))])
        continue
      }
      for (const [teamId, teamRows] of byTeamStints(isCurLevel ? currentSplits : rows)) {
        stint(yr, sid, aggregateSplits(teamRows, group), teamId ? [teamId] : [])
      }
    }
  }
  if (!real.length) return null
  const presentYears = new Set(real.map((s) => s.year))

  // Newest season first, and within a season the higher level first. Clubs
  // within one (season, level) keep the API's own order — Array#sort is stable,
  // so the chronological run of a traded season survives the sort untouched.
  const bySeasonOrder = (a, b) => b.year - a.year || LEVEL_ORDER_DESC.indexOf(a.sid) - LEVEL_ORDER_DESC.indexOf(b.sid)
  real.sort(bySeasonOrder)

  // SV leads the register (instead of W–L) for anyone who regularly closes —
  // the player's CURRENT role (mirrors the season tiles), or, failing that, a
  // career MLB save total too big to be incidental (an established closer who
  // has cooled off below this year's CL threshold shouldn't lose his column).
  const careerSaves = real
    .filter((s) => s.tier === 'mlb')
    .reduce((sum, s) => sum + num(s.stat?.saves), 0)
  const showSaves = role === 'CL' || careerSaves >= 20

  // Season WAR (FanGraphs) is MLB-only and lives outside the stat line, so it's
  // appended as a trailing column rather than folded into yearByYearCells. Only
  // worth a column when the player has an MLB row to carry a value — a pure
  // prospect's all-MiLB register would otherwise gain a dead all-dashes column.
  const showWar = real.some((s) => s.tier === 'mlb')
  const warCell = (st, lead) =>
    lead && st?.tier === 'mlb' && warByYear[st.year] != null ? warByYear[st.year].toFixed(1) : DASH
  const withWar = (cells, war) => (showWar ? [...cells, war] : cells)

  // A season split across clubs is several rows, so `seasonLead` marks the FIRST
  // of them — the one row that may carry anything belonging to the SEASON rather
  // than to the stint. Two things do: WAR (FanGraphs publishes it per season, not
  // per club) below, and the All-Star star the caller adds afterwards. On both
  // rows either would read as double. MLB sorts ahead of every MiLB level within
  // a season, so the lead of a split big-league year is always the big-league row.
  const seasonsSeen = new Set()
  const rows = real.map((st) => {
    const lead = !seasonsSeen.has(st.year)
    seasonsSeen.add(st.year)
    return {
      key: `${st.year}-${st.sid}-${st.teamIds[0] ?? 'na'}`,
      year: String(st.year),
      seasonLead: lead,
      tier: st.tier,
      level: SPORT_LABEL[st.sid] ?? '',
      sportId: st.sid,
      pill: st.tier === 'milb' ? SPORT_LABEL[st.sid] ?? '' : '',
      teamIds: st.teamIds,
      cells: withWar(yearByYearCells(st.stat ?? {}, group, showSaves), warCell(st, lead)),
    }
  })

  // Split totals — never blend levels. MLB uses the API career line when we have
  // it; MiLB sums the rows actually shown (every stint above, at every level).
  // A side foots only when it has MORE THAN ONE row: a subtotal under a single
  // line restates it, and an identical second line reads as another season.
  const totals = []
  const mlbStints = real.filter((s) => s.tier === 'mlb')
  const milbVisible = real.filter((s) => s.tier === 'milb')
  if (mlbStints.length > 1) {
    // Career WAR = sum of the shown MLB SEASONS' WAR. Deduped by year, since a
    // season split across clubs is now several rows carrying one season figure.
    // Only the seasons the history/live files cover contribute; pre-coverage
    // years quietly add nothing (matches their dash rows).
    const warYears = [...new Set(mlbStints.map((s) => s.year))]
      .map((yr) => warByYear[yr])
      .filter((w) => w != null)
    const warTotal = warYears.length
      ? (Math.round(warYears.reduce((a, b) => a + b, 0) * 10) / 10).toFixed(1)
      : DASH
    totals.push({
      label: 'MLB',
      tier: 'mlb',
      cells: withWar(yearByYearCells(careerStat ?? aggregateSplits(mlbStints.map((s) => ({ stat: s.stat })), group) ?? {}, group, showSaves), warTotal),
    })
  }
  if (milbVisible.length > 1) {
    totals.push({
      label: 'MiLB',
      tier: 'milb',
      cells: withWar(yearByYearCells(aggregateSplits(milbVisible.map((s) => ({ stat: s.stat })), group) ?? {}, group, showSaves), DASH),
    })
  }

  const baseColumns = group === 'pitching'
    ? ['G', 'GS', showSaves ? 'SV' : 'W–L', 'ERA', 'IP', 'K', 'BB', 'WHIP']
    : ['G', 'AB', 'AVG', 'HR', 'RBI']
  const columns = showWar ? [...baseColumns, 'WAR'] : baseColumns

  // Gap years (see missingSeasonRows) slot into the same sorted ledger as the
  // real rows rather than a separate section — a missed season reads most
  // clearly inline, between the years on either side of it.
  const gapRows = debutYear ? missingSeasonRows(presentYears, debutYear, cur, transactions, group) : []
  const allRows = gapRows.length ? [...rows, ...gapRows].sort(bySeasonOrder) : rows

  return { columns, rows: allRows, totals }
}

// A one-line "converted to pitcher" note for a debuted pitcher who has a real
// position-player past in the minors that his (pitching-only) register can't
// show — Kenley Jansen caught for four years before he ever took the mound.
// Fed the player's minor-league HITTING year-by-year; returns null unless the
// pre-debut hitting workload is big enough to be a genuine career (a normal
// pitcher's few token minor-league at-bats fall well short of the threshold).
export function positionPlayerPastNote(hittingMilbSplits, debutYear) {
  const bySL = new Map()
  for (const s of hittingMilbSplits ?? []) {
    const yr = Number(s.season)
    const sid = s.sport?.id
    if (!yr || !sid) continue
    if (debutYear && yr > debutYear) continue
    const key = `${yr}-${sid}`
    if (!bySL.has(key)) bySL.set(key, { yr, rows: [] })
    bySL.get(key).rows.push(s)
  }
  let games = 0
  const years = []
  for (const { yr, rows } of bySL.values()) {
    games += num(levelSeasonStat(rows, 'hitting')?.gamesPlayed)
    years.push(yr)
  }
  if (games < 150) return null
  const a = Math.min(...years)
  const b = Math.max(...years)
  const span = a === b ? `${a}` : `${a}–${String(b).slice(2)}`
  return `Converted to pitcher — ${games} G as a position player in the minors (${span}).`
}

// ---------------------------------------------------------------------------
// Level progression — for a pre-debut MiLB player, one row per level from
// wherever his career actually started up through AAA (a rung above his
// current level still renders dimmed, to complete the "climb to MLB"
// narrative — but rungs below his starting level are dropped outright: a
// player who debuted at A, say, is never going back to Rookie ball) built
// from the same multi-level yearByYear splits already fetched for the nested
// ledger above — no extra request.
// ---------------------------------------------------------------------------

export function levelProgressionView(splits, group, currentSportId) {
  const byLevel = new Map()
  for (const s of splits ?? []) {
    const sid = s.sport?.id
    if (!sid) continue
    if (!byLevel.has(sid)) byLevel.set(sid, [])
    byLevel.get(sid).push(s)
  }
  const levels = MILB_LEVELS.map(({ sportId, label }) => {
    const rows = byLevel.get(sportId) ?? []
    const stat = levelSeasonStat(rows, group)
    const years = rows.map((s) => Number(s.season)).filter(Boolean)
    return {
      sportId,
      label,
      reached: rows.length > 0,
      firstYear: years.length ? Math.min(...years) : null,
      lastYear: years.length ? Math.max(...years) : null,
      stat:
        group === 'pitching'
          ? `${stat?.inningsPitched ?? DASH} IP`
          : `${num(stat?.atBats)} AB`,
      isCurrent: sportId === currentSportId,
    }
  })
  const startIndex = levels.findIndex((l) => l.reached)
  if (startIndex === -1) return null
  return { levels: levels.slice(startIndex) }
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
