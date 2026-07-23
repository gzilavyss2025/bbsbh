import { useEffect, useMemo, useState } from 'react'
import {
  fetchGameFeed,
  fetchManager,
  fetchPitcherSeasonLine,
  fetchPitcherLastGame,
  fetchWinProbability,
} from '../api/game.js'
import { fetchHighlights } from '../api/highlights.js'
import { fetchGameUniforms, uniformSummary } from '../api/uniforms.js'
import { fetchJerseysData, jerseyTreatmentFor } from '../api/jerseys.js'
import { fetchGameBroadcast } from '../api/broadcast.js'
import { fetchTeamRoster } from '../api/team.js'
import { generateScorebookWeather } from '../api/weather.js'
import { selectHasStarted } from '../api/select.js'
import { rosterPitcherRole, isTwoWay } from '../api/person.js'
import { fetchTopProspects } from '../api/prospects.js'
import { fetchRookiesData } from '../api/rookies.js'
import { fetchFeverRadar } from '../api/feverRadar.js'
import { fetchSavantPercentiles } from '../api/savantPercentiles.js'
import { fetchCallouts, calloutsForGame } from '../api/callouts.js'
import { fetchVsTeamSplits } from '../api/vsTeamSplits.js'
import { loadFormerTeammates } from '../api/formerTeammates.js'
import { loadCareerMatchups } from '../api/careerMatchups.js'
import { fetchRunExpectancy } from '../api/umpireFavor.js'
import { fetchWorkload } from '../api/workload.js'
import { fetchLineupValues } from '../api/lineupStrength.js'
import { useAsync } from './useAsync.js'
import { useAsyncOnFeed } from './useAsyncOnFeed.js'
import { apiDateToUrl } from '../lib/route.js'
import { SPORT_IDS } from '../lib/teams.js'

// How often to re-poll for newly-posted highlight clips during a live game
// (see the `highlights` fetch below). Matches GameNotesButton's
// NOTES_POLL_MS (TeamInfo.jsx).
const HIGHLIGHTS_POLL_MS = 5 * 60 * 1000

// How often to auto-refresh the live feed itself during a live game, so a
// half-inning at the ballpark doesn't require a manual Refresh tap every
// time. Independent of HIGHLIGHTS_POLL_MS — the score-bearing feed churns
// far more often than highlight clips post. Spoiler-safe: reload() just
// mints a new feed object, the same thing tapping Refresh already does, and
// every score-revealing render path stays gated by SealBox/revealedThrough.
const FEED_POLL_MS = 60 * 1000

// Owns every data fetch a game page needs: the feed itself plus the roughly
// nine independent lookups derived from or alongside it (managers, weather,
// starter lines, win probability, pitcher roles, prospects, callouts,
// broadcast, former teammates). Pulling this out of GameView keeps that
// component free to focus on section-routing and rendering; this hook is the
// one place that reasons about fetch sequencing/keying/caching.
export function useGameData(game) {
  // The uniform assignment rides the SAME fetch/reload as the feed: it's empty
  // until around first pitch, so each live Refresh must re-pull it, and
  // useAsync's reload keeps the last-good pair so a flaky refetch never blanks
  // an already-posted assignment. fetchGameUniforms resolves null on its own
  // failures, so it can't take the feed down with it.
  const feedState = useAsync(
    async (signal) => {
      const [feed, uniforms] = await Promise.all([
        fetchGameFeed(game.gamePk, { signal }),
        fetchGameUniforms(game.gamePk, { signal }),
      ])
      return { feed, uniforms }
    },
    [game.gamePk],
    // Standalone/home-screen mode has no pull-to-refresh, so catch a
    // score-critical feed back up as soon as the app is foregrounded again.
    { refetchOnForeground: true },
  )
  const feed = feedState.data?.feed
  const activeFeed =
    feed && String(feed.gamePk ?? '') === String(game.gamePk) ? feed : null
  const hasActiveFeed = Boolean(activeFeed)

  // Static enrichment is useful after the game structure is visible, but it
  // competes with the feed and uniforms on a cold phone load. Start it during
  // an idle window after the first feed resolves, with a timeout fallback for
  // browsers that do not expose requestIdleCallback.
  const [enrichmentReady, setEnrichmentReady] = useState(false)
  useEffect(() => {
    setEnrichmentReady(false)
    if (!hasActiveFeed) return undefined
    let cancelled = false
    const start = () => {
      if (!cancelled) setEnrichmentReady(true)
    }
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const id = window.requestIdleCallback(start, { timeout: 1500 })
      return () => {
        cancelled = true
        window.cancelIdleCallback?.(id)
      }
    }
    const id = setTimeout(start, 0)
    return () => {
      cancelled = true
      clearTimeout(id)
    }
  }, [game.gamePk, hasActiveFeed])

  // The date a name-link inside this game should cut its stats off at: the
  // game's official date. Falls back to the scheduled date before the feed
  // lands. Feeds every PlayerLink/TeamLink below (via LinkScope) so a player
  // page opened from a sealed game shows "entering today", never tonight's line.
  const officialDate =
    feed?.gameData?.datetime?.officialDate || (game.gameDate || '').slice(0, 10) || null

  // The condensed one-line uniform summary shown everywhere a uniform surfaces —
  // the lineup pages and the box score's fill-in card ("Away Alternate Navy
  // Blue"). '' until posted; the slate/route seed's teamName is the club
  // nickname ("Brewers"), matching the redundant prefix on every asset label.
  const uniformBrief = useMemo(() => {
    const uniforms = feedState.data?.uniforms
    return {
      away: uniformSummary(uniforms?.away, 'away', game.away.teamName),
      home: uniformSummary(uniforms?.home, 'home', game.home.teamName),
    }
  }, [feedState.data, game.away.teamName, game.home.teamName])

  // Managers need a separate endpoint per team. The coaches endpoint needs
  // nothing from the feed — the game prop already carries both team ids and
  // its gameDate's year is the season to ask for — so this runs in parallel
  // with the feed fetch instead of queuing behind the app's largest response.
  // The season is required: without it the endpoint returns the CURRENT
  // staff, which is wrong for any past-season box score (see fetchManager).
  // Keyed on the stable team ids + season, not the feed object: managers
  // can't change mid-game, so a live Refresh (which mints a new feed object)
  // never re-hits the coaches endpoint or risks blanking a resolved name on a
  // transient failure.
  const managerSeason = (game.gameDate || '').slice(0, 4) || null
  const managers = useAsync(async () => {
    const [away, home] = await Promise.all([
      fetchManager(game.away.id, managerSeason),
      fetchManager(game.home.id, managerSeason),
    ])
    return { away, home }
  }, [game.away.id, game.home.id, managerSeason])

  // Outdoor scorebook weather string — from the park's lat/lon, not the
  // box-score weather (which reports the interior of a closed roof). Fetched
  // once alongside the feed and shared by the info pages and the box score.
  // First-pitch weather is fixed for the game, so it's keyed on gamePk, not
  // the feed object — see useAsyncOnFeed.
  const weather = useAsyncOnFeed(feed, generateScorebookWeather, [game.gamePk])

  // Each probable starter's season line (ERA/W-L/K) plus his most recent
  // appearance (see fetchPitcherLastGame — MLB or MiLB, whichever came last),
  // penciled next to the opposing-pitcher card while staging. Season
  // aggregates + a past outing's already-final box line, never this game's.
  const starterLines = useAsyncOnFeed(
    feed,
    async (f) => {
      const season = f.gameData?.game?.season
      const officialDate = f.gameData?.datetime?.officialDate
      const probables = f.gameData?.probablePitchers ?? {}
      const [awaySeason, homeSeason, awayLast, homeLast] = await Promise.all([
        fetchPitcherSeasonLine(probables.away?.id, season, game.sportId),
        fetchPitcherSeasonLine(probables.home?.id, season, game.sportId),
        fetchPitcherLastGame(probables.away?.id, season, officialDate),
        fetchPitcherLastGame(probables.home?.id, season, officialDate),
      ])
      const withLast = (line, lastGame) => (line || lastGame ? { ...(line ?? {}), lastGame } : null)
      return { away: withLast(awaySeason, awayLast), home: withLast(homeSeason, homeLast) }
    },
    [game.gamePk],
  )

  // Per-play win probability, the sole source of WPA for the box score's three
  // stars (the feed carries none). Only the box-score view uses it, so it's
  // fetched lazily once the feed exists — a live Refresh won't re-pull it,
  // matching how the box score is really a post-game read. Resolves null
  // off-MLB, hiding the card.
  const winProb = useAsyncOnFeed(feed, () => fetchWinProbability(game.gamePk), [game.gamePk])

  // Video highlight clips for this game (see api/highlights.js). Unlike the
  // rest of this hook's useAsyncOnFeed tier, clips keep posting THROUGHOUT a
  // live game (MLB cuts them play-by-play, not all at once), so a one-shot
  // fetch near game start would miss nearly all of them. Poll every 5 minutes
  // while the game is Live — same interval/cleanup shape as GameNotesButton's
  // NOTES_POLL_MS (TeamInfo.jsx) — and stop once it leaves Live (Final, or
  // not started yet). HalfInning's SealBox reveal function re-runs on every
  // render and rebuilds highlightsByPlayId from whatever this resolves to, so
  // a newly-posted clip surfaces on an already-revealed half with no other
  // wiring: nothing here is rendered until highlightsByPlayId is called
  // inside that reveal, so a poll landing mid-game is still spoiler-safe.
  // Fetch itself is safe to start eagerly, same as before; resolves [] on failure or
  // off-MLB (most MiLB games carry no clips).
  const highlights = useAsyncOnFeed(feed, () => fetchHighlights(game.gamePk), [game.gamePk])
  const isLive = feed?.gameData?.status?.abstractGameState === 'Live'
  useEffect(() => {
    if (!isLive) return
    const id = setInterval(highlights.reload, HIGHLIGHTS_POLL_MS)
    return () => clearInterval(id)
  }, [isLive, highlights.reload])

  // Auto-refresh the feed itself while the game is Live — see FEED_POLL_MS.
  // feedState.reload is useAsync's stale-while-revalidate `run`, so a
  // transient poll failure keeps showing the last-good feed rather than
  // blanking the page (AsyncStatus's staleErrorMessage in GameView).
  useEffect(() => {
    if (!isLive) return
    const id = setInterval(feedState.reload, FEED_POLL_MS)
    return () => clearInterval(id)
  }, [isLive, feedState.reload])

  // Each pitcher's inferred role (SP/CL/RP) from season stats — the same
  // gamesStarted-ratio/saves heuristic the team page badges pitchers with
  // (see rosterPitcherRole). The live feed carries no season stats, so this is
  // its own fetch; it powers the innings roster panel's Starters/Bullpen
  // split (see InningViewer). Keyed on team ids, like managers: role doesn't
  // change mid-game.
  const pitcherRoles = useAsyncOnFeed(
    feed,
    async (f) => {
      const season = f.gameData?.game?.season
      if (!season) return null
      const [awayRoster, homeRoster] = await Promise.all([
        fetchTeamRoster(game.away.id, season, { sportId: game.sportId }),
        fetchTeamRoster(game.home.id, season, { sportId: game.sportId }),
      ])
      const roles = {}
      for (const r of [...awayRoster, ...homeRoster]) {
        // A two-way player (Ohtani-type) is roster-typed 'Two-Way Player', not
        // 'Pitcher' — without isTwoWay here he'd carry no role at all and
        // splitBullpen would default him into relief instead of starters.
        if ((r.position?.type === 'Pitcher' || isTwoWay(r.person)) && r.person?.id) {
          roles[r.person.id] = rosterPitcherRole(r)
        }
      }
      return roles
    },
    [game.away.id, game.home.id],
  )

  // Prospect badges for the lineup/roster surfaces (see ProspectPill /
  // prospectBadge) — the app-wide Top 100 + org-farm-system snapshot,
  // session-memoized so this costs nothing beyond the first call anywhere in
  // the app. Gated to MiLB: the rare still-ranked MLB call-up isn't worth the
  // extra badge noise on the majors' pages.
  const prospects = useAsync(
    () =>
      enrichmentReady && game.sportId !== SPORT_IDS.MLB
        ? fetchTopProspects()
        : Promise.resolve(null),
    [enrichmentReady, game.sportId],
  )
  const prospectsData = game.sportId === SPORT_IDS.MLB ? null : prospects.data ?? null

  // Season-context call-outs for the play-by-play — the leader / streak /
  // situational-record notes, precomputed nightly to a static per-date file (see
  // api/callouts.js). Spoiler-free season aggregates (no seal), same feed-derived tier
  // as prospect badges. Covers MLB and the four full-season MiLB levels alike
  // (the file carries every level's slate since the phase-3 generator; a MiLB
  // gamePk in an older file simply resolves to no bundle). Keyed on gamePk,
  // like the other feed-derived static fetches — a live Refresh never
  // re-pulls it.
  const callouts = useAsyncOnFeed(
    feed,
    async (f) => {
      const api = f.gameData?.datetime?.officialDate
      return api ? fetchCallouts(apiDateToUrl(api)) : null
    },
    [game.gamePk],
  )
  const gameCallouts = calloutsForGame(callouts.data, game.gamePk)

  // Which network the game airs on, for the lineup pages' Broadcast fact next
  // to Attendance (see api/broadcast.js). MLB-only: ESPN's scoreboard has no
  // MiLB coverage, so a MiLB gamePk just resolves to ''. Keyed on gamePk, like
  // callouts — a broadcast assignment doesn't change mid-game, so a live
  // Refresh never re-pulls it.
  const broadcast = useAsyncOnFeed(
    feed,
    (f) => (game.sportId === SPORT_IDS.MLB ? fetchGameBroadcast(f) : Promise.resolve('')),
    [game.gamePk],
  )

  // Former-teammate ties (or, when a matchup has none, the ORG TIES fallback —
  // see orgTiesFor) between the two clubs, for the lineup pages' card. The
  // whole precomputed file is a single cached same-origin read (see
  // formerTeammates.js); it now covers MiLB matchups too, so this isn't gated
  // to MLB games — a matchup outside the build's window just yields no card.
  const teammates = useAsync(
    () => (enrichmentReady ? loadFormerTeammates() : Promise.resolve(null)),
    [enrichmentReady],
  )
  const formerTeammatesData = teammates.data ?? null

  // Career batter/pitcher matchup history between the two clubs' rosters, at
  // ANY level either has played (see api/careerMatchups.js) — same
  // build-time-fetch tier as former teammates: one cached same-origin read,
  // MLB + MiLB alike, degrading to no card outside the build's window.
  const careerMatchupsQuery = useAsync(
    () => (enrichmentReady ? loadCareerMatchups() : Promise.resolve(null)),
    [enrichmentReady],
  )
  const careerMatchupsData = careerMatchupsQuery.data ?? null

  // Career vs-opponent lines (see api/vsTeamSplits.js) — the same static file
  // the player page's SPLITS VS TEAM card reads, reused here for the
  // "Turang is a career .303 against the Pirates" call-out (see
  // buildCallouts's vsTeamCareerLine). Season aggregates, spoiler-free, so it
  // rides the same deferred tier as prospects/former-teammates — no gamePk key,
  // one cached same-origin read for the whole app.
  const vsTeamSplits = useAsync(
    () => (enrichmentReady ? fetchVsTeamSplits() : Promise.resolve(null)),
    [enrichmentReady],
  )
  const vsTeamSplitsData = vsTeamSplits.data ?? null

  // Rookie status for the roster/lineup surfaces (see RookiePill /
  // isActiveRookie) — the nightly rookies precompute, same deferred tier as
  // vsTeamSplits/formerTeammates. Fetched for MiLB matchups too (not just
  // MLB) so DebutPill can flag a MiLB roster's already-debuted players
  // (rehabbers, optioned veterans) — the file's debut records aren't
  // MLB-roster-scoped, just MLB-debut-scoped.
  const rookies = useAsync(
    () => (enrichmentReady ? fetchRookiesData() : Promise.resolve(null)),
    [enrichmentReady],
  )
  const rookiesData = rookies.data ?? null

  // Fever Baseball's breakout/fade radar (see RadarPill / feverRadar.js) —
  // an outside model's opinion, not a bbsbh callout, so it's kept off the
  // callouts worthiness table entirely (see gen-fever-radar.mjs's header).
  // MLB-only like rookies/vsTeamSplits: there is no MLB pitcher board and
  // the AAA boards aren't wired to any surface yet.
  const feverRadar = useAsync(
    () =>
      enrichmentReady && game.sportId === SPORT_IDS.MLB
        ? fetchFeverRadar()
        : Promise.resolve(null),
    [enrichmentReady, game.sportId],
  )
  const feverRadarData = feverRadar.data ?? null

  // Season Statcast percentile ranks (Baseball Savant) — RadarPill's meter
  // uses savantPercentilesFor(...).ev to show a player's exit velocity
  // against the real qualified league, rather than the raw mph number Fever
  // itself reports. Season-aggregate and same-origin like rookies/prospects,
  // so it's safe to fetch eagerly; not gated to MLB-only like feverRadar
  // since gen-savant-percentiles.mjs's file is MLB-only anyway (a MiLB
  // player's lookup just comes back null).
  const savantPercentiles = useAsync(
    () => (enrichmentReady ? fetchSavantPercentiles() : Promise.resolve(null)),
    [enrichmentReady],
  )
  const savantPercentilesData = savantPercentiles.data ?? null

  // The league-wide run-expectancy (RE288) table — a static, same-origin,
  // hand-run backfill (scripts/gen-run-expectancy.mjs) with no game or score
  // information of its own, so it's safe to fetch eagerly like
  // vsTeamSplits/formerTeammates. Only StatBox's reveal-only selector
  // (api/umpireFavor.js's selectUmpireFavor) combines it with this game's own
  // plays — see .scratch/umpire-accuracy/consistency-favor-scope.md §3.
  const runExpectancy = useAsync(
    () => (enrichmentReady ? fetchRunExpectancy() : Promise.resolve(null)),
    [enrichmentReady],
  )
  const runExpectancyData = runExpectancy.data ?? null

  // Rolling pitcher workload (gen-workload.mjs) — spoiler-free completed-
  // appearance aggregates feeding the bullpen availability board (TeamInfo)
  // and the Pitchers table's laboring baseline (pitcherHealth.js). MLB-only
  // at source, same deferred tier as rookies/feverRadar.
  const workload = useAsync(
    () =>
      enrichmentReady && game.sportId === SPORT_IDS.MLB
        ? fetchWorkload()
        : Promise.resolve(null),
    [enrichmentReady, game.sportId],
  )
  const workloadData = workload.data ?? null

  // Per-roster lineup values + position eligibility (gen-lineup-values.mjs) —
  // spoiler-free season aggregates behind the Lineup Strength grade on the
  // lineup pages (api/lineupStrength.js). MLB-only at source.
  const lineupValues = useAsync(
    () =>
      enrichmentReady && game.sportId === SPORT_IDS.MLB
        ? fetchLineupValues()
        : Promise.resolve(null),
    [enrichmentReady, game.sportId],
  )
  const lineupValuesData = lineupValues.data ?? null

  const started = useMemo(() => (feed ? selectHasStarted(feed) : false), [feed])

  // Which logo treatment each side actually wore tonight, for the
  // win-probability chart's tiled band (WinProbChart.jsx) — read from the
  // same nightly precompute GameCard.jsx already reads to swap a slate
  // card's logo (api/jerseys.js), not a second live fetch. Same deferred
  // tier as the other same-origin static reads above; a game outside the
  // file's coverage (MiLB, not posted yet) resolves both sides to 'main'.
  const jerseysQuery = useAsync(
    () => (enrichmentReady ? fetchJerseysData() : Promise.resolve(null)),
    [enrichmentReady],
  )
  const winProbTreatment = useMemo(
    () => ({
      away: jerseyTreatmentFor(jerseysQuery.data, game.gamePk, game.away.id) ?? 'main',
      home: jerseyTreatmentFor(jerseysQuery.data, game.gamePk, game.home.id) ?? 'main',
    }),
    [jerseysQuery.data, game.gamePk, game.away.id, game.home.id],
  )

  return {
    feedState,
    feed,
    officialDate,
    uniformBrief,
    managers,
    weather,
    starterLines,
    winProb,
    pitcherRoles,
    prospectsData,
    rookiesData,
    feverRadarData,
    savantPercentilesData,
    gameCallouts,
    broadcast,
    formerTeammatesData,
    careerMatchupsData,
    vsTeamSplitsData,
    highlightsData: highlights.data ?? null,
    runExpectancyData,
    workloadData,
    lineupValuesData,
    winProbTreatment,
    started,
  }
}
