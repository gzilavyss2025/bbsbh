// Assembles the full player-page view model: bio + one stat block (two for a
// two-way player), career timeline, level progression, minor-league stats,
// "firsts" milestones, and box-score deep links. See api/person.js for the
// pure shaping this composes — this module owns the FETCH ORCHESTRATION:
// which sportId/season/cutoff to query for which section, and in what order.

import {
  fetchPerson,
  fetchPersonStats,
  fetchMilbYearByYear,
  fetchMilbByDateRange,
  fetchAllStarRosterIds,
  fetchTeamAbbrevs,
  fetchTeamLogoTint,
  findFirstStart,
  findFirstStrikeoutBatter,
  fetchFielding,
  fetchMilbFielding,
  fetchStarterReliever,
  fetchStarterRelieverStints,
  fetchMilbFieldingSeason,
  fetchMilbStarterRelieverSeason,
} from './person-fetch.js'
import { fetchGamesByPk } from './schedule.js'
import { fetchTeam } from './team.js'
import {
  personBio,
  personSportId,
  aggregateSplits,
  pitcherRole,
  buildBlock,
  levelProgressionView,
  careerTimelineView,
  dropRehabStints,
  positionPlayerPastNote,
  fieldingView,
  starterRelieverView,
  starterRelieverCareer,
  pitchingStints,
  firstsFromGameLog,
  PITCHER_FIRSTS_DEFS,
} from './person.js'
import { fetchTopProspects, prospectRankById, orgProspectRankById } from './prospects.js'
import { gamePath } from '../lib/route.js'

function isoToday() {
  return new Date().toISOString().slice(0, 10)
}
function dayBefore(iso) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

// The "Current season" tiles' stat line. `levelStat` (already fetched at the
// player's current team's level) covers the common cases as-is: an active MLB
// player, or a MiLB player who's spent the whole year at one level. Two cases
// need extra fetches: a player who has debuted before but shows no MLB games
// this season (a rehab assignment or a full-season option down, `sportId` !=
// 1) should still prefer his MLB line if he's actually appeared there this
// year; and a player with no MLB action at all this season should get his
// stints at every MiLB level combined, not just the level he's at right now
// (e.g. a mid-season AA -> AAA promotion).
async function resolveCurrentSeasonStat({ id, group, season, startDate, endDate, sportId, hasDebuted, levelStat }) {
  if (sportId === 1) return levelStat
  if (hasDebuted) {
    const mlbSplits = await fetchPersonStats(id, {
      type: 'byDateRange', group, season, startDate, endDate, sportId: 1,
    })
    const mlbStat = aggregateSplits(mlbSplits, group)
    if (mlbStat && Number(mlbStat.gamesPlayed) > 0) return mlbStat
  }
  const milbSplits = await fetchMilbByDateRange(id, group, season, startDate, endDate)
  return aggregateSplits(milbSplits, group)
}

// Fetch the position-innings data for one CAREER scope ('mlb' | 'milb') — the
// 'season' scope is already eager in loadPlayer's positionInnings.initial. Lazy:
// PlayerPage calls this only when the user toggles into a career scope. Fielding
// is one call for MLB / a per-level fan-out for MiLB; SP/RP fans out one call
// per (season, level) stint the pitcher appeared in.
export async function loadPositionScope(id, scope, { showFielding, showPitching, pitchStints }) {
  const isMilb = scope === 'milb'
  const [fieldSplits, stintSplits] = await Promise.all([
    showFielding
      ? isMilb ? fetchMilbFielding(id) : fetchFielding(id, { sportId: 1 })
      : Promise.resolve([]),
    showPitching
      ? fetchStarterRelieverStints(
          id,
          (pitchStints ?? []).filter((s) => (isMilb ? s.sportId !== 1 : s.sportId === 1)),
        )
      : Promise.resolve([]),
  ])
  return {
    fielding: showFielding ? fieldingView(fieldSplits) : null,
    pitching: showPitching ? starterRelieverCareer(stintSplits) : null,
  }
}

// Assemble the full player view — bio + one stat block (two for a two-way
// player). Stats are cut off at the day BEFORE the game date ("entering today")
// when reached from a game (`asOf` set); a bare link defaults to current stats.
export async function loadPlayer(id, asOf) {
  const person = await fetchPerson(id)
  if (!person) return null
  const bio = personBio(person)
  // Where he's playing RIGHT NOW (a big leaguer's is MLB; a demoted or
  // now-a-lifer minor leaguer's is his current MiLB level).
  const liveSportId = personSportId(person)
  // Where his career-shaped sections are pinned. A player who has reached the
  // majors gets the major-league treatment even while he's currently in the
  // minors (Ben Gamel — a longtime big leaguer now at AAA): his year-by-year
  // table, career total and team-history timeline stay on MLB (sportId 1) so
  // his major-league body of work fills the prominent slots, exactly where a
  // current big leaguer's would — you shouldn't have to guess he ever debuted.
  // (The current-season tiles, game log and splits below still follow
  // `liveSportId`, so the page also shows what he's doing right now.)
  const careerSportId = bio.debut ? 1 : liveSportId
  const season = Number((asOf || isoToday()).slice(0, 4))
  const endDate = asOf ? dayBefore(asOf) : isoToday()
  const cutoff = asOf || null
  const groups = bio.twoWay
    ? ['hitting', 'pitching']
    : [bio.isPitcher ? 'pitching' : 'hitting']
  const debutYear = bio.debut ? Number(bio.debut.slice(0, 4)) : null
  const currentYear = Number(isoToday().slice(0, 4))
  const startDate = `${season}-01-01`
  // "Path to the Majors" always tells the minor-league story in the page's
  // primary stat group (hitting for a two-way player: the more common
  // progression story, and the one whose gamesPlayed reads naturally as
  // "games at that level").
  const primaryGroup = bio.isPitcher ? 'pitching' : 'hitting'

  const [results, debutSplits, prospects, convHittingMilb] = await Promise.all([
    Promise.all(
      groups.map(async (group) => {
        const [seasonSplits, careerSplits, lrSplits, gameLogSplits, mlbYbySplits, milbYbySplits, arsenalSplits] =
          await Promise.all([
            // Current-activity sections track his LIVE level...
            fetchPersonStats(id, { type: 'byDateRange', group, season, startDate, endDate, sportId: liveSportId }),
            // ...but the career total is pinned to `careerSportId` (MLB for
            // anyone who's debuted), so a now-in-the-minors big leaguer's
            // major-league résumé foots the register's MLB total.
            fetchPersonStats(id, { type: 'career', group, sportId: careerSportId }),
            fetchPersonStats(id, { type: 'statSplits', group, sitCodes: 'vl,vr', season, sportId: liveSportId }),
            fetchPersonStats(id, { type: 'gameLog', group, season, sportId: liveSportId }),
            // The unified career register merges the MLB year-by-year (debuted
            // players only — pre-debut players have no MLB line) with the
            // multi-level MiLB history below. See careerRegisterView.
            bio.debut
              ? fetchPersonStats(id, { type: 'yearByYear', group, sportId: 1 })
              : Promise.resolve([]),
            fetchMilbYearByYear(id, group),
            group === 'pitching'
              ? fetchPersonStats(id, { type: 'pitchArsenal', group, season, sportId: liveSportId })
              : Promise.resolve([]),
          ])
        const seasonStat = aggregateSplits(seasonSplits, group)
        const tileStat = await resolveCurrentSeasonStat({
          id, group, season, startDate, endDate, sportId: liveSportId,
          hasDebuted: Boolean(bio.debut), levelStat: seasonStat,
        })
        const role = group === 'pitching' ? pitcherRole(tileStat) : null
        const block = buildBlock({
          group, role, seasonSplits, careerSplits, lrSplits,
          gameLogSplits, arsenalSplits, mlbYbySplits, milbYbySplits, cutoff,
          currentSeason: season, currentSportId: liveSportId, debutYear, tileStat,
        })
        return { group, mlbYbySplits, milbYbySplits, block }
      }),
    ),
    // The MLB debut is always sportId 1; its box-score game is the first row of
    // that season's game log (the split whose date is the debut date).
    bio.debut && debutYear
      ? fetchPersonStats(id, {
          type: 'gameLog', group: bio.isPitcher ? 'pitching' : 'hitting',
          season: debutYear, sportId: 1,
        })
      : Promise.resolve([]),
    // Session-memoized after the first call anywhere in the app — cheap even
    // though every player page asks for it.
    fetchTopProspects(),
    // Conversion check: a debuted pitcher's minor-league HITTING history reveals
    // a position-player past his pitching-only register can't show (Kenley
    // Jansen caught four years before he ever pitched). Only single-group
    // pitchers need it — a two-way player already fetches both groups' MiLB.
    bio.debut && bio.isPitcher && !bio.twoWay
      ? fetchMilbYearByYear(id, 'hitting')
      : Promise.resolve(null),
  ])
  const blocks = results.map((r) => r.block)
  const conversionNote = convHittingMilb ? positionPlayerPastNote(convHittingMilb, debutYear) : null
  const prospectRank = prospectRankById(prospects.players, bio.id)
  // The player's rank on his own org's farm-system list — shown as a second
  // pill for anyone who's on their org's list but not the overall Top 100.
  const orgProspectRank = orgProspectRankById(prospects.orgProspects, bio.id)

  // "Path to the Majors" card, built from the primary group's multi-level MiLB
  // history (already fetched per block above — no extra request). Strip
  // rehab-assignment noise (see dropRehabStints) so an established big leaguer's
  // stray rehab innings don't relight a MiLB level. Degrades to null if no MiLB
  // level was ever reached (an int'l signing / NPB veteran who went straight to
  // the majors).
  const primaryResult = results.find((r) => r.group === primaryGroup) ?? results[0]
  const milbSplits = dropRehabStints(primaryResult?.milbYbySplits, debutYear)
  const progression = primaryResult
    ? levelProgressionView(milbSplits, primaryResult.group, liveSportId)
    : null

  // Career timeline (the team-logo strip above the card). Fed the player's FULL
  // year-by-year — every MiLB level plus MLB, NOT the rehab-trimmed
  // `milbSplits` — because a genuine post-debut option-down season is real team
  // history worth showing; careerTimelineView does its own finer rehab filter
  // (keeping a post-debut MiLB stint only when it clears the rehab cap, the same
  // test the register uses, so the two agree).
  const timelineSplits = [
    ...(primaryResult?.mlbYbySplits ?? []),
    ...(primaryResult?.milbYbySplits ?? []),
  ]
  const timeline = careerTimelineView(timelineSplits, primaryGroup, debutYear)
  if (timeline) {
    // Resolve each stop's logo tint and hover label. Entries can repeat a club
    // (a return stint), so resolve each DISTINCT team once. The label names the
    // club; a farm club adds its parent org in parens ("Nashville Sounds
    // (Milwaukee Brewers)") — one extra team lookup per MiLB club, skipped for
    // MLB stops whose own name is already the whole label.
    const byTeam = new Map()
    for (const e of timeline.entries) {
      if (!byTeam.has(e.teamId)) byTeam.set(e.teamId, { sportId: e.sportId })
    }
    await Promise.all(
      [...byTeam.entries()].map(async ([teamId, meta]) => {
        meta.tint = await fetchTeamLogoTint(teamId)
        meta.parentOrgName =
          meta.sportId === 1 ? '' : (await fetchTeam(teamId))?.parentOrgName ?? ''
      }),
    )
    for (const e of timeline.entries) {
      const meta = byTeam.get(e.teamId)
      e.tint = meta.tint
      e.title = meta.parentOrgName ? `${e.teamName} (${meta.parentOrgName})` : e.teamName
    }
  }

  // Position innings — the fielding diamond (position players) or the
  // starter/reliever IP pair (pitchers + two-way). Season scope is eager; the
  // MLB/MiLB career scopes lazy-load on toggle (see loadPositionScope). A
  // player with no current-season data (a retired/FA vet like Rich Hill)
  // defaults to his first career scope, eagerly loaded so the card isn't empty.
  const showFielding = !bio.isPitcher && !bio.twoWay
  const showPitching = bio.isPitcher || bio.twoWay
  let positionInnings = null
  if (showFielding || showPitching) {
    const pitchResult = results.find((r) => r.group === 'pitching')
    const pitchStints = showPitching
      ? pitchingStints([...(pitchResult?.mlbYbySplits ?? []), ...(pitchResult?.milbYbySplits ?? [])])
      : []
    const hasMilb = showFielding
      ? (primaryResult?.milbYbySplits?.length ?? 0) > 0
      : pitchStints.some((s) => s.sportId !== 1)
    const scopeArgs = { showFielding, showPitching, pitchStints }
    // Season scope: an MLB player is a single sportId-1 call (his season is his
    // major-league season — earlier MiLB rehab lives in the career scopes,
    // matching how resolveCurrentSeasonStat scopes the tiles). A player
    // currently in the minors fans out every MiLB level, so a mid-season
    // promotion (AA -> AAA) isn't undercounted.
    const inMajors = liveSportId === 1
    const [fieldSeasonSplits, srSeasonSplits] = await Promise.all([
      showFielding
        ? inMajors ? fetchFielding(id, { season, sportId: 1 }) : fetchMilbFieldingSeason(id, season)
        : Promise.resolve([]),
      showPitching
        ? inMajors ? fetchStarterReliever(id, { season, sportId: 1 }) : fetchMilbStarterRelieverSeason(id, season)
        : Promise.resolve([]),
    ])
    const seasonScope = {
      fielding: showFielding ? fieldingView(fieldSeasonSplits) : null,
      pitching: showPitching ? starterRelieverView(srSeasonSplits) : null,
    }
    const seasonHasData = Boolean(seasonScope.fielding || seasonScope.pitching)
    const options = []
    if (seasonHasData) options.push({ key: 'season', label: 'Season' })
    if (bio.debut) options.push({ key: 'mlb', label: 'MLB career' })
    if (hasMilb) options.push({ key: 'milb', label: 'MiLB career' })
    const defaultScope = seasonHasData ? 'season' : options[0]?.key ?? null
    const initial = defaultScope === 'season'
      ? seasonScope
      : defaultScope
        ? await loadPositionScope(id, defaultScope, scopeArgs)
        : null
    if (options.length && initial && (initial.fielding || initial.pitching)) {
      positionInnings = { options, defaultScope, initial, ...scopeArgs }
    }
  }

  // All-Star roster membership (MLB only), one roster lookup per distinct year
  // that appears in the year-by-year table plus the real current year. The
  // banner is a "how's he doing right now" badge, so it always checks the real
  // current year — never the (possibly past) season a game link is scoped to,
  // so viewing an old game never shows a stale "20XX All-Star" banner. The
  // year-by-year table instead marks every season the player actually made an
  // All-Star team, however many that is. Spoiler-safe.
  const registerYears = new Set()
  for (const b of blocks) {
    for (const r of b.register?.rows ?? []) if (r.tier === 'mlb') registerYears.add(Number(r.year))
  }
  const allStarYears = careerSportId === 1 ? new Set([currentYear, ...registerYears]) : new Set()
  const allStarByYear = new Map(
    await Promise.all([...allStarYears].map(async (yr) => [yr, await fetchAllStarRosterIds(yr)])),
  )
  for (const b of blocks) {
    for (const r of b.register?.rows ?? []) {
      if (r.tier === 'mlb') r.allStar = allStarByYear.get(Number(r.year))?.has(bio.id) ?? false
    }
  }
  const isAllStar = allStarByYear.get(currentYear)?.has(bio.id) ?? false

  // Team(s) played for each year-by-year row — a trade mid-season means more
  // than one. One batched lookup for every team id across every row of every
  // ledger (the block year-by-year tables plus the minor-league table); those
  // stat splits carry only a team id/name, never an abbreviation.
  const teamIdSet = new Set()
  for (const b of blocks) {
    const reg = b.register
    if (!reg) continue
    for (const r of reg.rows) for (const id of r.teamIds) teamIdSet.add(id)
    if (reg.climb) {
      for (const id of reg.climb.teamIds) teamIdSet.add(id)
      for (const s of reg.climb.subSeasons) for (const id of s.teamIds) teamIdSet.add(id)
    }
  }
  const teamAbbrevs = await fetchTeamAbbrevs([...teamIdSet])
  const abbrevs = (ids) => ids.map((tid) => teamAbbrevs[tid]).filter(Boolean).join('/')
  for (const b of blocks) {
    const reg = b.register
    if (!reg) continue
    for (const r of reg.rows) r.team = abbrevs(r.teamIds)
    if (reg.climb) {
      reg.climb.team = abbrevs(reg.climb.teamIds)
      for (const s of reg.climb.subSeasons) s.team = abbrevs(s.teamIds)
    }
  }

  const debutGamePk = (debutSplits ?? []).find((s) => s.date === bio.debut)?.game?.gamePk ?? null

  // Firsts — milestones read off the debut year's game log (already fetched
  // above for the debut deep-link). Hitters get five plate milestones plus the
  // first game STARTED, which needs each candidate game's own boxscore (see
  // findFirstStart) since no gameLog field distinguishes a start from a sub
  // appearance. Pitchers get the pitching counterpart (PITCHER_FIRSTS_DEFS) —
  // every field but the strikeout victim is a direct gameLog stat, so only
  // that one needs an extra per-game feed lookup (findFirstStrikeoutBatter).
  // `debutSplits` above is fetched in whichever group matches `bio.isPitcher`.
  let firsts = null
  if (bio.isPitcher && bio.debut) {
    const { events } = firstsFromGameLog(debutSplits, cutoff, PITCHER_FIRSTS_DEFS)
    if (events.so) {
      events.so.batter = await findFirstStrikeoutBatter(bio.id, events.so.gamePk)
    }
    firsts = events
  } else if (!bio.isPitcher && bio.debut) {
    const { events, rowsAscending } = firstsFromGameLog(debutSplits, cutoff)
    const startSplit = await findFirstStart(bio.id, rowsAscending)
    events.start = startSplit
      ? {
          label: 'First Start',
          date: startSplit.date,
          gamePk: startSplit.game.gamePk,
          isHome: startSplit.isHome,
        }
      : null
    firsts = events
  }

  // Point the debut fact and every game-log row at that game's (sealed) box
  // score, via the normal date/matchup/boxscore route (one batched schedule
  // lookup resolves all the abbreviations the slug needs).
  const pks = new Set()
  for (const b of blocks) for (const r of b.gameLog?.rows ?? []) if (r.gamePk) pks.add(r.gamePk)
  if (debutGamePk) pks.add(debutGamePk)
  if (firsts) for (const f of Object.values(firsts)) if (f?.gamePk) pks.add(f.gamePk)
  const byPk = await fetchGamesByPk([...pks])
  const boxPath = (pk) => {
    const g = byPk[pk]
    return g ? gamePath(g.apiDate, g.awayAbbr, g.homeAbbr, 'boxscore', g.gameNumber) : null
  }
  for (const b of blocks) for (const r of b.gameLog?.rows ?? []) r.boxscorePath = boxPath(r.gamePk)
  if (firsts) {
    for (const key of Object.keys(firsts)) {
      const f = firsts[key]
      if (!f) continue
      const g = byPk[f.gamePk]
      firsts[key] = {
        ...f,
        path: boxPath(f.gamePk),
        oppAbbr: g ? (f.isHome ? g.awayAbbr : g.homeAbbr) : '',
      }
    }
  }

  return {
    bio, blocks, season, asOf, sportId: liveSportId,
    isAllStar, currentYear, firsts, progression, timeline, prospectRank, orgProspectRank,
    conversionNote, positionInnings,
    debutBoxscorePath: debutGamePk ? boxPath(debutGamePk) : null,
  }
}
