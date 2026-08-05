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
  enrichTimelineEntries,
  findFirstStart,
  findFirstStrikeoutBatter,
  findFirstPitcherFaced,
  MILESTONE_EVENTS,
  fetchFielding,
  fetchMilbFielding,
  fetchStarterReliever,
  fetchStarterRelieverStints,
  fetchMilbFieldingSeason,
  fetchMilbStarterRelieverSeason,
  fetchMilbGameLog,
  fetchPitchingAdvanced,
  fetchHittingAdvanced,
  fetchTransactions,
  fetchPlayerAwards,
  fetchTradeCohort,
} from './person-fetch.js'
import { fetchGamesByPk } from './schedule.js'
import { fetchTeam } from './team.js'
import { fetchWarData, fetchWarHistory, warByYearFor } from './war.js'
import { fetchVsTeamSplits, vsTeamSplitsFor } from './vsTeamSplits.js'
import { fetchSavantPercentiles, savantPercentilesFor, savantRawFor, similarHittersFor } from './savantPercentiles.js'
import { fetchPitchArsenal, similarPitchersFor } from './pitchArsenal.js'
import { fetchRookiesData, rookieRecordFor } from './rookies.js'
import {
  personBio,
  signedFallback,
  personSportId,
  rosterStatusView,
  lastPlayedSeason,
  advancedPitchingView,
  advancedHittingView,
  battedBallView,
  situationalSplitsView,
  pitchingRanksView,
  hittingRanksView,
  SITUATIONAL_SIT_CODES,
  aggregateSplits,
  pitcherRole,
  buildBlock,
  levelProgressionView,
  careerTimelineView,
  dropRehabStints,
  detectRehabAssignment,
  detectInjuredList,
  transactionTimelineView,
  trophyCaseView,
  tradeKey,
  positionPlayerPastNote,
  fieldingView,
  starterRelieverView,
  starterRelieverCareer,
  pitchingStints,
  firstsFromGameLog,
  firstMilestoneSeasons,
  FIRSTS_DEFS,
  PITCHER_FIRSTS_DEFS,
} from './person.js'
import { fetchTopProspects, prospectRankById, orgProspectRankById } from './prospects.js'
import { gamePath } from '../lib/route.js'
import { teamFullName } from '../lib/teams.js'

function isoToday() {
  return new Date().toISOString().slice(0, 10)
}
function dayBefore(iso) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

// The "Current season" tiles' stat line, plus the LEVEL that line belongs to
// (`sportId`) — the two must travel together: the register keys its date-cut
// current-season row on this level, and the promoted other-level tiles skip it,
// so a mismatch would strand a whole level's line (an up-and-down player's AAA
// season vanishing behind his MLB row). `levelStat` (already fetched at the
// player's current team's level) covers the common cases as-is: an active MLB
// player, or a MiLB player who's spent the whole year at one level. Two cases
// need extra fetches: a player who has debuted before but shows no MLB games
// this season (a rehab assignment or a full-season option down, `sportId` !=
// 1) should still prefer his MLB line if he's actually appeared there this
// year (so the resolved level is MLB, NOT his live MiLB club); and a player
// with no MLB action at all this season should get his stints at every MiLB
// level combined, not just the level he's at right now (e.g. a mid-season
// AA -> AAA promotion), reported at his current MiLB level.
//
// That blended `stat` is right for the TILES (one "how's he doing this year"
// line) but wrong for the career register's current-level row, which must
// stay level-scoped (one row per season+level, never blended — see
// careerRegisterView) — so this also returns `levelOnlyStat`, the same
// date-cut window filtered to just `sportId`, for the register to key its
// current-season row on instead. A recent AA -> AAA call-up would otherwise
// show his AAA row as AA+AAA combined while a separate, correct AA row also
// exists (the AA line double-counted into both rows).
export async function resolveCurrentSeasonStat({ id, group, season, startDate, endDate, sportId, hasDebuted, levelStat }) {
  if (sportId === 1) return { stat: levelStat, sportId: 1, levelOnlyStat: levelStat }
  if (hasDebuted) {
    const mlbSplits = await fetchPersonStats(id, {
      type: 'byDateRange', group, season, startDate, endDate, sportId: 1,
    })
    const mlbStat = aggregateSplits(mlbSplits, group)
    if (mlbStat && Number(mlbStat.gamesPlayed) > 0) return { stat: mlbStat, sportId: 1, levelOnlyStat: mlbStat }
  }
  const milbSplits = await fetchMilbByDateRange(id, group, season, startDate, endDate)
  return {
    stat: aggregateSplits(milbSplits, group),
    sportId,
    levelOnlyStat: aggregateSplits(milbSplits.filter((s) => s.sport?.id === sportId), group),
  }
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
  // The spoiler cutoff for every date-bound fetch — "entering today" for a
  // game-scoped view, else the live current day. Computed up front because the
  // transaction feed (fetched in parallel with the bio, to detect a live rehab
  // assignment before the stat blocks are built) is capped by it too.
  const endDate = asOf ? dayBefore(asOf) : isoToday()
  // WAR (FanGraphs, MLB-only) rides along here — two same-origin static files
  // (nightly current season + hand-run history), session-cached, so this is
  // free after the first player page. Built into a per-group { season: war } map
  // below and threaded into each block's tiles + career-register column.
  // Career-vs-club splits (the SPLITS VS TEAM card) ride along here too — one
  // more same-origin static file (nightly), session-cached, so this is free
  // after the first player page. MLB-only at the source; null for a player not
  // on an MLB active roster, and the card then simply doesn't render.
  // Statcast percentile ranks (the STATCAST card) are a fourth same-origin
  // static file, same session-cached, degrade-to-empty pattern — see
  // api/savantPercentiles.js.
  // The league-wide pitch-type mix rides along on the same tier: another
  // same-origin static file, session-cached after the first read anywhere in
  // the app (TeamInfo's opposing-starter card already asks for it), and the
  // source of the "Pitches like" card's comparison pool.
  const [person, txns, warCurrent, warHistory, vsTeamData, savantData, arsenalData, rookiesData] = await Promise.all([
    fetchPerson(id),
    fetchTransactions(id, endDate),
    fetchWarData(),
    fetchWarHistory(),
    fetchVsTeamSplits(),
    fetchSavantPercentiles(),
    fetchPitchArsenal(),
    fetchRookiesData(),
  ])
  if (!person) return null
  const bio = personBio(person)
  // Draft fact fallback for undrafted/international signees (see
  // signedFallback) — cheap, txns is already fetched above.
  bio.signedYear = bio.draft?.year ? null : signedFallback(txns)
  const debutYear = bio.debut ? Number(bio.debut.slice(0, 4)) : null
  // Free agent / retired / released — set only when he is on NO club as of the
  // page's cutoff, in which case `bio.team` is a stale pointer the hero must not
  // render as his club. See rosterStatusView.
  const rosterStatus = rosterStatusView(person, endDate)
  // Where he's playing RIGHT NOW (a big leaguer's is MLB; a demoted or
  // now-a-lifer minor leaguer's is his current MiLB level). For an unrostered
  // big leaguer that same stale `currentTeam` would pin the whole page to a
  // level he isn't at — Céspedes's winter-league club would send every
  // current-activity fetch and every outgoing link to sportId 17 — so a player
  // who has reached the majors falls back to MLB. A never-debuted minor leaguer
  // keeps his last level: it's still the right one for his MiLB register.
  const liveSportId = rosterStatus && bio.debut ? 1 : personSportId(person)
  // A big leaguer currently on a minor-league REHAB assignment is a major
  // leaguer passing through the minors, not a demotion — so his current-activity
  // sections (season tiles, splits, game log, the register's current-season row)
  // are pinned to MLB even though his live club is a MiLB affiliate. The game log
  // becomes a combined MLB + rehab log (see below). Null for everyone else.
  // IL status from the same spoiler-capped feed.
  const il = detectInjuredList(txns, endDate)
  const onIL = Boolean(il)
  // A rehab assignment is by definition an IL rehab, so it's gated on onIL: a
  // rehab ASG whose closing transaction went uncaptured (esp. across a season
  // boundary) must not paint a since-activated player with the amber banner.
  const rehab = detectRehabAssignment(txns, debutYear, endDate)
  const onRehab = Boolean(rehab) && onIL
  const currentActivitySportId = onRehab ? 1 : liveSportId
  // Where his career-shaped sections are pinned. A player who has reached the
  // majors gets the major-league treatment even while he's currently in the
  // minors (Ben Gamel — a longtime big leaguer now at AAA): his year-by-year
  // table, career total and team-history timeline stay on MLB (sportId 1) so
  // his major-league body of work fills the prominent slots, exactly where a
  // current big leaguer's would — you shouldn't have to guess he ever debuted.
  // (The current-season tiles, game log and splits below follow
  // `currentActivitySportId` — his live level, or MLB when he's on a rehab
  // assignment — so the page also shows what he's doing right now.)
  const careerSportId = bio.debut ? 1 : liveSportId
  const season = Number((asOf || isoToday()).slice(0, 4))
  const cutoff = asOf || null
  const groups = bio.twoWay
    ? ['hitting', 'pitching']
    : [bio.isPitcher ? 'pitching' : 'hitting']
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
        // A rehabbing big leaguer's game log combines his MLB games with his
        // rehab (MiLB) games into one date-sorted log, each row level-tagged;
        // everyone else's is a single-level log at his current-activity level.
        const gameLogPromise = onRehab
          ? Promise.all([
              fetchPersonStats(id, { type: 'gameLog', group, season, sportId: 1 }),
              fetchMilbGameLog(id, group, season),
            ]).then(([mlb, milb]) => [
              ...mlb.map((s) => ({ ...s, sport: s.sport ?? { id: 1 } })),
              ...milb,
            ])
          : fetchPersonStats(id, { type: 'gameLog', group, season, sportId: currentActivitySportId })
        const [seasonSplits, careerSplits, lrSplits, gameLogSplits, mlbYbySplits, milbYbySplits, arsenalSplits, advancedBundle, situationalSplits, rankSplits] =
          await Promise.all([
            // Current-activity sections track his current-activity level (his
            // live level, or MLB while he's on a rehab assignment)...
            fetchPersonStats(id, { type: 'byDateRange', group, season, startDate, endDate, sportId: currentActivitySportId }),
            // ...but the career total is pinned to `careerSportId` (MLB for
            // anyone who's debuted), so a now-in-the-minors big leaguer's
            // major-league résumé foots the register's MLB total.
            fetchPersonStats(id, { type: 'career', group, sportId: careerSportId }),
            fetchPersonStats(id, { type: 'statSplits', group, sitCodes: 'vl,vr', season, sportId: currentActivitySportId }),
            gameLogPromise,
            // The unified career register merges the MLB year-by-year (debuted
            // players only — pre-debut players have no MLB line) with the
            // multi-level MiLB history below. See careerRegisterView.
            bio.debut
              ? fetchPersonStats(id, { type: 'yearByYear', group, sportId: 1 })
              : Promise.resolve([]),
            fetchMilbYearByYear(id, group),
            group === 'pitching'
              ? fetchPersonStats(id, { type: 'pitchArsenal', group, season, sportId: currentActivitySportId })
              : Promise.resolve([]),
            // The Advanced card's season/seasonAdvanced/sabermetrics bundle —
            // MLB-only at the source, so skip the request entirely for a
            // player whose current activity is a MiLB level. One fetcher per
            // group; both return the same three-stat bundle shape.
            currentActivitySportId === 1
              ? (group === 'pitching' ? fetchPitchingAdvanced(id, season) : fetchHittingAdvanced(id, season))
              : Promise.resolve(null),
            // Situational splits (base state / count leverage) — full-season
            // figures like the vs-L/R card, MLB only. The sitCodes set and the
            // shaping are group-generic (ahead/behind in count reads from
            // whichever side `group` asks for).
            currentActivitySportId === 1
              ? fetchPersonStats(id, { type: 'statSplits', group, sitCodes: SITUATIONAL_SIT_CODES, season, sportId: 1 })
              : Promise.resolve([]),
            // League ranks — live current ranks with no as-of history, so a
            // spoiler-cutoff view skips them (same rule as FoulCard).
            currentActivitySportId === 1 && !cutoff
              ? fetchPersonStats(id, { type: 'rankings', group, season, sportId: 1 })
              : Promise.resolve([]),
          ])
        const seasonStat = aggregateSplits(seasonSplits, group)
        // `tileSportId` is the level `tileStat` actually belongs to — MLB for a
        // debuted player who has appeared in the majors this year even while his
        // live club is a MiLB affiliate (Rowdy Tellez), else his current level.
        // The register and the promoted other-level tiles both key off it, so
        // the current-season line lands on the right level's row.
        const { stat: tileStat, sportId: tileSportId, levelOnlyStat } = await resolveCurrentSeasonStat({
          id, group, season, startDate, endDate, sportId: currentActivitySportId,
          hasDebuted: Boolean(bio.debut), levelStat: seasonStat,
        })
        const role = group === 'pitching' ? pitcherRole(tileStat) : null
        const block = buildBlock({
          group, role, seasonSplits, careerSplits, lrSplits,
          gameLogSplits, arsenalSplits, mlbYbySplits, milbYbySplits, cutoff,
          currentSeason: season, currentSportId: tileSportId, debutYear, tileStat, levelOnlyStat,
          logTagLevel: onRehab,
          warByYear: warByYearFor(id, group, warCurrent, warHistory),
          transactions: txns,
        })
        // Pure passthrough lookup, not a derivation — attached here rather
        // than threaded into buildBlock's (pure-shaping) signature.
        block.savant = savantPercentilesFor(savantData, id, group)
        // The raw season rates behind those percentiles, for the radar's spoke
        // labels — same file, separate map (see savantRawFor).
        block.savantRaw = savantRawFor(savantData, id, group)
        // "Pitches like" / "Hits like" — same attach-after-buildBlock pattern,
        // one field for both groups since a block only ever renders its own
        // card. A pitcher ranks in arsenal space against the level he's
        // actually pitching at (see similarPitchersFor); a hitter ranks in
        // Statcast skill space against the savant file's qualified-MLB pool
        // (see similarHittersFor — a MiLB bat isn't in the file, so the card
        // simply doesn't render). [] under any sample floor.
        block.similar =
          group === 'pitching'
            ? similarPitchersFor(arsenalData, id, tileSportId === 1)
            : similarHittersFor(savantData, id)
        // Same attach-after pattern: the Advanced card's shaped view rides
        // the block rather than widening buildBlock's signature, as do the
        // situational-splits ledger and the league-rank strip.
        block.advanced =
          group === 'pitching' ? advancedPitchingView(advancedBundle) : advancedHittingView(advancedBundle)
        // The batted-ball profile shares the Advanced card's seasonAdvanced
        // response — one fetch feeds both cards.
        block.battedBall =
          group === 'hitting' ? battedBallView(advancedBundle?.seasonAdvanced) : null
        block.situational = situationalSplitsView(situationalSplits, group)
        block.ranks = group === 'pitching' ? pitchingRanksView(rankSplits) : hittingRanksView(rankSplits)
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
  // Transaction timeline enrichment — everything the raw player-scoped feed
  // can't give on its own: each affiliate club's level (for CALLED UP / SENT
  // DOWN + the level tags, and for naming an Injured List rehab stop by level
  // rather than affiliate name — see person.js's ilArcClause), the other
  // players in each trade (named only as free text on the player's own row),
  // and his draft record. Gathered here, then shaped by
  // transactionTimelineView. The same awards fetch also feeds the Trophy Case
  // card (trophyCaseView, below) — awards are MLB-only, so only fetch them for
  // a debuted player (a pure prospect has none in either allowlist).
  const asgTeamIds = new Set()
  const trades = []
  for (const t of txns) {
    // Every ASG row's clubs go in, rehab included — the "real affiliate move"
    // vs. "rehab assignment" distinction only matters to transactionTimelineView's
    // own CALLED UP / SENT DOWN labeling (which re-checks the rehab regex
    // itself), not to gathering the ids a level lookup needs.
    if (t.typeCode === 'ASG' && t.fromTeam?.id && t.toTeam?.id) {
      asgTeamIds.add(t.fromTeam.id)
      asgTeamIds.add(t.toTeam.id)
    }
    if (t.typeCode === 'TR' && t.fromTeam?.id && t.toTeam?.id) trades.push(t)
  }
  const [levelPairs, awards, cohorts] = await Promise.all([
    // Level per affiliate id, from the static team snapshot (reliable at the
    // standard levels, unlike the live teams endpoint's default-season sportId).
    Promise.all([...asgTeamIds].map(async (tid) => [tid, (await fetchTeam(tid))?.sport?.id ?? null])),
    bio.debut ? fetchPlayerAwards(id) : Promise.resolve([]),
    // One team+date lookup per trade returns every player in that swap.
    Promise.all(
      trades.map(async (t) => {
        const date = t.date || t.effectiveDate
        const rows = await fetchTradeCohort(t.fromTeam.id, date)
        const pair = new Set([t.fromTeam.id, t.toTeam.id])
        const others = rows
          .filter((r) => r.typeCode === 'TR' && pair.has(r.fromTeam?.id) && pair.has(r.toTeam?.id))
          .map((r) => r.person)
          .filter((p) => p?.id && p.id !== bio.id)
        return [tradeKey(t.effectiveDate || t.date, t.fromTeam.id, t.toTeam.id), others]
      }),
    ),
  ])
  const levelByTeamId = new Map(levelPairs.filter(([, sid]) => sid != null))
  const tradeOthers = new Map()
  for (const [key, others] of cohorts) {
    const list = tradeOthers.get(key) ?? []
    for (const p of others) if (!list.some((x) => x.id === p.id)) list.push(p)
    tradeOthers.set(key, list)
  }
  const rookieInfo = rookieRecordFor(rookiesData, bio.id)
  const transactions = transactionTimelineView(txns, {
    selfId: bio.id,
    levelByTeamId,
    tradeOthers,
    draft: bio.draft,
    rookieUntil: rookieInfo?.rookieUntil ?? null,
    endDate,
  })
  const trophyCase = trophyCaseView(awards, endDate)
  const blocks = results.map((r) => r.block)
  // "Last played in 2022" — the banner under the masthead for someone who isn't
  // on a club AND hasn't appeared in a game this season. Only for the unrostered:
  // a signed player who has missed the whole year is an injury story the IL
  // banner already tells, and stamping him "last played in 2025" would read as
  // an obituary. Reuses the year-by-year splits each block already fetched
  // (both levels — a career minor leaguer's last season counts too), and is
  // measured against the season IN VIEW, so an old box score's player links
  // don't accuse anyone of being retired years before he was.
  const lastPlayed = rosterStatus
    ? lastPlayedSeason(person, results.flatMap((r) => [...r.mlbYbySplits, ...r.milbYbySplits]), season)
    : null
  const lastPlayedYear = lastPlayed && lastPlayed < season ? lastPlayed : null
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
  // Resolve each stop's logo tint + hover label (the club, farm clubs adding
  // their parent org) — see enrichTimelineEntries, shared with the manager
  // page's playing-career timeline.
  if (timeline) await enrichTimelineEntries(timeline.entries)

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
    const inMajors = currentActivitySportId === 1
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
  }
  const teamAbbrevs = await fetchTeamAbbrevs([...teamIdSet])
  const abbrevs = (ids) => ids.map((tid) => teamAbbrevs[tid]).filter(Boolean).join('/')
  for (const b of blocks) {
    const reg = b.register
    if (!reg) continue
    for (const r of reg.rows) r.team = abbrevs(r.teamIds)
  }

  const debutGamePk = (debutSplits ?? []).find((s) => s.date === bio.debut)?.game?.gamePk ?? null

  // Firsts — career milestones pinned to their exact games. A milestone can
  // land any season, not just the debut one (a late-September cameo debut —
  // Bethancourt's lone 2013 game, only a strikeout — gets his first hit/HR/run
  // seasons later), so the per-season year-by-year splits pick out the earliest
  // SEASON each milestone occurred (firstMilestoneSeasons), and only those
  // seasons' game logs are fetched to find the exact game — the debut season's
  // is reused from `debutSplits` (already fetched above for the debut deep-link).
  // Hitters get five plate milestones plus the first game STARTED, which needs
  // each candidate game's own boxscore (see findFirstStart) since no gameLog
  // field distinguishes a start from a sub appearance. Pitchers get the pitching
  // counterpart (PITCHER_FIRSTS_DEFS) — every field but the strikeout victim is
  // a direct gameLog stat, so only that one needs an extra per-game feed lookup
  // (findFirstStrikeoutBatter). `debutSplits` is fetched in the group matching
  // `bio.isPitcher`, so the firsts group and its year-by-year match it too.
  let firsts = null
  if (bio.debut) {
    const firstsGroup = bio.isPitcher ? 'pitching' : 'hitting'
    const defs = bio.isPitcher ? PITCHER_FIRSTS_DEFS : FIRSTS_DEFS
    const throughYear = cutoff ? Number(cutoff.slice(0, 4)) : currentYear
    const firstsYby = results.find((r) => r.group === firstsGroup)?.mlbYbySplits ?? []
    // Seasons to scan: every season a milestone first occurred, plus the debut
    // season itself (its log is reused, and it anchors the earliest rows for
    // findFirstStart). Debut season excepted, each is one extra game-log fetch.
    const seasonSet = new Set(firstMilestoneSeasons(firstsYby, defs, throughYear))
    if (debutYear && (!throughYear || debutYear <= throughYear)) seasonSet.add(debutYear)
    const seasons = [...seasonSet].sort((a, b) => a - b)
    const logs = await Promise.all(
      seasons.map((yr) =>
        yr === debutYear
          ? Promise.resolve(debutSplits)
          : fetchPersonStats(id, { type: 'gameLog', group: firstsGroup, season: yr, sportId: 1 }),
      ),
    )
    const careerSplits = logs.flat()
    if (bio.isPitcher) {
      const { events } = firstsFromGameLog(careerSplits, cutoff, PITCHER_FIRSTS_DEFS)
      if (events.so) {
        events.so.batter = await findFirstStrikeoutBatter(bio.id, events.so.gamePk)
      }
      firsts = events
    } else {
      const { events, rowsAscending } = firstsFromGameLog(careerSplits, cutoff)
      const startSplit = await findFirstStart(bio.id, rowsAscending)
      events.start = startSplit
        ? {
            label: 'First Start',
            date: startSplit.date,
            gamePk: startSplit.game.gamePk,
            isHome: startSplit.isHome,
          }
        : null
      // The opposing pitcher a batter got each plate milestone off of — read
      // from that milestone game's play-by-play (see findFirstPitcherFaced), so
      // the "Firsts" card can name (and link to) who he did it against.
      await Promise.all(
        ['hit', 'xbh', 'hr', 'so'].map(async (key) => {
          const f = events[key]
          if (!f?.gamePk) return
          f.pitcher = await findFirstPitcherFaced(bio.id, f.gamePk, MILESTONE_EVENTS[key])
        }),
      )
      firsts = events
    }
  }

  // The MLB Debut milestone — a synthetic "first" pinned to the debut game
  // (bio.debut / debutGamePk), shown ahead of the rest. When the debut game was
  // ALSO his first start (a position player or pitcher who started his debut),
  // fold the two into one "MLB Debut & First Start" row and drop the separate
  // First Start entry; otherwise they stand as distinct milestones. isHome comes
  // from the debut-game split so the opponent resolves like every other first.
  if (firsts && bio.debut) {
    const debutSplit = (debutSplits ?? []).find((s) => s.date === bio.debut)
    const sameAsStart = firsts.start && firsts.start.date === bio.debut
    firsts.debut = {
      label: sameAsStart ? 'MLB Debut & First Start' : 'MLB Debut',
      date: bio.debut,
      gamePk: debutGamePk,
      isHome: debutSplit?.isHome ?? null,
    }
    if (sameAsStart) firsts.start = null
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
        oppName: g ? teamFullName(f.isHome ? g.awayId : g.homeId) : null,
      }
    }
  }

  return {
    bio, blocks, season, asOf, sportId: currentActivitySportId,
    onRehab, rehab,
    onIL, il,
    rosterStatus, lastPlayedYear,
    isAllStar, currentYear, firsts, progression, timeline, prospectRank, orgProspectRank,
    conversionNote, positionInnings, transactions, trophyCase,
    vsTeam: vsTeamSplitsFor(vsTeamData, bio.id),
    debutBoxscorePath: debutGamePk ? boxPath(debutGamePk) : null,
  }
}
