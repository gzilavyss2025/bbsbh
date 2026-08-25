import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  fetchGameFeed,
  fetchGameFeedDiff,
  mergeFeedDiff,
  fetchManager,
  fetchPitcherSeasonLine,
  fetchPitcherLastGame,
  fetchPitcherSeasonVsOpponent,
  fetchWinProbability,
} from '../api/game.js'
import { fetchHighlights } from '../api/highlights.js'
import { fetchGameUniforms, uniformSummary, liveJerseyTreatment } from '../api/uniforms.js'
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
import { fetchVsTeamSplitsForTeams } from '../api/vsTeamSplits.js'
import { loadFormerTeammates } from '../api/formerTeammates.js'
import { loadCareerMatchups } from '../api/careerMatchups.js'
import { fetchRunExpectancy } from '../api/umpireFavor.js'
import { fetchWorkload } from '../api/workload.js'
import { useAsync } from './useAsync.js'
import { useAsyncOnFeed } from './useAsyncOnFeed.js'
import { nextEverActiveState } from './useGameDataCore.js'
import { apiDateToUrl } from '../lib/route.js'
import { SPORT_IDS, defaultTreatmentFor } from '../lib/teams.js'

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

// A tighter cadence used ONLY while the spoilers-off pass is running (ADR-0026).
// Someone with the pass on is watching, not scoring — pitch-level freshness is
// the point, and 60s leaves the current half feeling frozen between polls when
// pitches land every ~20s. Scoped to the consented window: with the pass off, a
// live game polls at FEED_POLL_MS as it always has, so the extra network and
// battery cost is only paid where it was asked for.
const FOLLOW_POLL_MS = 15 * 1000

// Sticky "has `active` ever been true for the current `resetKey`" flag — lets
// a fetch start lazily on first visit to its consuming surface (winProb: the
// innings view or the box score; highlights: either one too — see below),
// then behave exactly like every other feed-derived fetch in this hook: fired
// once, cached, and immune to a later visit toggling the surface off and back
// on (navigating from the box score back to a lineup page must not drop
// already-fetched win probability). Computed during render — the same
// "adjust state while rendering" pattern as `enrichmentKey`/`prevEnrichmentKey`
// below and `GameView`'s `lastInningSection` — rather than an effect, since a
// ref read during render isn't reactive and can tear under concurrent
// rendering; the transition rule itself is `useGameDataCore.js`'s
// `nextEverActiveState` (React-free, unit-tested).
function useEverActive(active, resetKey) {
  const [state, setState] = useState({ resetKey, everActive: active })
  const next = nextEverActiveState(state, active, resetKey)
  if (next !== state) setState(next)
  return next.everActive
}

// Owns every data fetch a game page needs: the feed itself plus the roughly
// nine independent lookups derived from or alongside it (managers, weather,
// starter lines, win probability, pitcher roles, prospects, callouts,
// broadcast, former teammates). Pulling this out of GameView keeps that
// component free to focus on section-routing and rendering; this hook is the
// one place that reasons about fetch sequencing/keying/caching.
//
// `activeStep` is GameView's own `sectionToStep(section).step` (0 lineup1 / 1
// lineup2 / 2 innings / 3 box score) — used ONLY to decide WHEN a couple of
// fetches below first fire (see `useEverActive`), never to change what ends
// up in the DOM. A cold open always lands on step 0, and neither winProb nor
// highlights has a consumer there, so paying for them before the user ever
// reaches the innings/box-score view is wasted bytes on every game open.
export function useGameData(game, spoilersOff = false, activeStep = null) {
  // Session-only cache of the last resolved feed + the timecode it was as-of,
  // used to poll via the MLB Stats API's diffPatch mode instead of always
  // refetching the full feed (ADR-0032). In-memory ONLY — never persisted to
  // localStorage/IndexedDB/the Cache API, which would reopen the hole
  // ADR-0004's NetworkOnly service-worker rule closes. Naturally keyed to the
  // current game: the `cache.gamePk` check below falls back to a full fetch
  // whenever it doesn't match `game.gamePk`, so a gamePk change can never
  // merge one game's patches onto another's feed, with no extra reset code
  // needed (useAsync already blanks feedState's data on a gamePk change).
  const feedCacheRef = useRef({ gamePk: null, feed: null, timecode: null })
  // Mirrors the latest `spoilersOff` into a ref: the useAsync `fn` below is
  // only re-created when `game.gamePk` changes (see useAsync's deps), so a
  // plain closure over `spoilersOff` would see whichever value was current
  // the LAST time gamePk changed, not live toggles of Follow Live/Scores
  // Unlocked (ADR-0026/ADR-0027) mid-game.
  const spoilersOffRef = useRef(spoilersOff)
  useLayoutEffect(() => {
    spoilersOffRef.current = spoilersOff
  })

  // The uniform assignment rides the SAME fetch/reload as the feed: it's empty
  // until around first pitch, so each live Refresh must re-pull it, and
  // useAsync's reload keeps the last-good pair so a flaky refetch never blanks
  // an already-posted assignment. fetchGameUniforms resolves null on its own
  // failures, so it can't take the feed down with it.
  const feedState = useAsync(
    async (signal) => {
      const [uniforms, feed] = await Promise.all([
        fetchGameUniforms(game.gamePk, { signal }),
        (async () => {
          // Only attempted during the tighter Follow Live/Scores Unlocked
          // cadence (FOLLOW_POLL_MS) — see ADR-0032: at the default 60s poll,
          // ordinary gaps between half-innings and pitching changes cross the
          // diffPatch endpoint's real-time window often enough that the win
          // shrinks to ~2x, not worth the added cache-invalidation surface.
          const cache = feedCacheRef.current
          const canDiff =
            spoilersOffRef.current &&
            String(cache.gamePk ?? '') === String(game.gamePk) &&
            cache.feed &&
            cache.timecode
          if (canDiff) {
            const diffResponse = await fetchGameFeedDiff(game.gamePk, cache.timecode, { signal }).catch(
              () => null,
            )
            const merged = diffResponse ? mergeFeedDiff(cache.feed, diffResponse, game.gamePk) : null
            if (merged) return merged
          }
          // No usable cache, diffPatch failed, or the merge's sanity check
          // rejected it — fall back to exactly today's behavior. The worst
          // realistic regression from any diffPatch problem is "we silently
          // do what we already do," never a wrong or stale feed.
          return fetchGameFeed(game.gamePk, { signal })
        })(),
      ])
      feedCacheRef.current = { gamePk: game.gamePk, feed, timecode: feed?.metaData?.timeStamp ?? null }
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
  // Reset computed during render (not as the first line of the effect below)
  // on a game/feed-availability change — see Headshot.jsx for the pattern.
  const enrichmentKey = `${game.gamePk}|${hasActiveFeed}`
  const [prevEnrichmentKey, setPrevEnrichmentKey] = useState(enrichmentKey)
  if (enrichmentKey !== prevEnrichmentKey) {
    setPrevEnrichmentKey(enrichmentKey)
    setEnrichmentReady(false)
  }
  useEffect(() => {
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

  // Each probable starter's season line (ERA/W-L/K), his most recent
  // appearance (see fetchPitcherLastGame — MLB or MiLB, whichever came last),
  // and his summed line against TONIGHT'S OPPONENT so far this season (see
  // fetchPitcherSeasonVsOpponent) — penciled next to the opposing-pitcher card
  // while staging. Season aggregates + past outings' already-final box lines,
  // never this game's.
  const starterLines = useAsyncOnFeed(
    feed,
    async (f) => {
      const season = f.gameData?.game?.season
      const officialDate = f.gameData?.datetime?.officialDate
      const probables = f.gameData?.probablePitchers ?? {}
      const [awaySeason, homeSeason, awayLast, homeLast, awayVsOpp, homeVsOpp] = await Promise.all([
        fetchPitcherSeasonLine(probables.away?.id, season, game.sportId),
        fetchPitcherSeasonLine(probables.home?.id, season, game.sportId),
        fetchPitcherLastGame(probables.away?.id, season, officialDate),
        fetchPitcherLastGame(probables.home?.id, season, officialDate),
        // The away starter's opponent is the home club, and vice versa.
        fetchPitcherSeasonVsOpponent(probables.away?.id, season, game.home.id, officialDate, game.sportId),
        fetchPitcherSeasonVsOpponent(probables.home?.id, season, game.away.id, officialDate, game.sportId),
      ])
      const withLast = (line, lastGame, vsOpponent) =>
        line || lastGame || vsOpponent ? { ...(line ?? {}), lastGame, vsOpponent } : null
      return {
        away: withLast(awaySeason, awayLast, awayVsOpp),
        home: withLast(homeSeason, homeLast, homeVsOpp),
      }
    },
    [game.gamePk],
  )

  // Per-play win probability — the sole source of WPA for the box score's
  // three stars, and of the innings view's WinProbChart band (both reveal-
  // clamped to `revealedThrough`, never rendered before that). Neither
  // consumer exists on the two lineup pages (step 0/1), so the fetch itself
  // waits for the innings view or the box score to actually be opened
  // (`useEverActive`) rather than firing on every cold game load — a live
  // Refresh still won't re-pull it once fetched, matching how both consumers
  // are really a post-reveal/post-game read. Resolves null off-MLB, hiding
  // the card.
  const winProbActive = useEverActive(activeStep === 2 || activeStep === 3, game.gamePk)
  const winProb = useAsync(
    () => (feed && winProbActive ? fetchWinProbability(game.gamePk) : Promise.resolve(null)),
    [game.gamePk, Boolean(feed), winProbActive],
  )

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
  // The fetch is safe to start eagerly (a raw fetch result produces no DOM on
  // its own), but its consumers are both behind a seal, so it waits for one of
  // their views to actually be opened (`useEverActive`), same reasoning as
  // `winProb` above; the 5-minute poll below is a no-op while inactive.
  // Resolves [] on failure or off-MLB (most MiLB games carry no clips).
  //
  // TWO consumers now, so the gate matches winProb's exactly: the innings
  // view's per-play Watch buttons (step 2) and the box score's Play of the
  // Game card (step 3), which looks up the one clip for its WPA-picked play
  // inside its own SealBox reveal render.
  const highlightsActive = useEverActive(activeStep === 2 || activeStep === 3, game.gamePk)
  const highlights = useAsync(
    () => (feed && highlightsActive ? fetchHighlights(game.gamePk) : Promise.resolve(null)),
    [game.gamePk, Boolean(feed), highlightsActive],
  )
  const isLive = feed?.gameData?.status?.abstractGameState === 'Live'
  useEffect(() => {
    if (!isLive) return
    const id = setInterval(highlights.reload, HIGHLIGHTS_POLL_MS)
    return () => clearInterval(id)
  }, [isLive, highlights.reload])

  // Auto-refresh the feed itself while the game is Live — see FEED_POLL_MS, or
  // the tighter FOLLOW_POLL_MS while the spoilers-off pass is running.
  // feedState.reload is useAsync's stale-while-revalidate `run`, so a
  // transient poll failure keeps showing the last-good feed rather than
  // blanking the page (AsyncStatus's staleErrorMessage in GameView).
  useEffect(() => {
    if (!isLive) return
    const id = setInterval(feedState.reload, spoilersOff ? FOLLOW_POLL_MS : FEED_POLL_MS)
    return () => clearInterval(id)
  }, [isLive, spoilersOff, feedState.reload])

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
  // situational-record notes, precomputed nightly to a static per-game file (see
  // api/callouts.js). Spoiler-free season aggregates (no seal), same feed-derived tier
  // as prospect badges. Covers MLB and the four full-season MiLB levels alike
  // (the set carries every level's slate since the phase-3 generator; a MiLB
  // gamePk on an older date simply resolves to no bundle). Keyed on gamePk,
  // like the other feed-derived static fetches — a live Refresh never
  // re-pulls it. THIS game only: the shards are named by gamePk, so a lineup
  // page reads its own ~10 KB rather than the whole slate's.
  const callouts = useAsyncOnFeed(
    feed,
    async (f) => {
      const api = f.gameData?.datetime?.officialDate
      return api ? fetchCallouts(apiDateToUrl(api), [game.gamePk]) : null
    },
    [game.gamePk],
  )
  const gameCallouts = calloutsForGame(callouts.data, game.gamePk)

  // Which network the game airs on, for the lineup pages' Broadcast fact next
  // to Attendance (see api/broadcast.js). No longer MLB-only: the old ESPN
  // scoreboard had no minor-league coverage, but statsapi lists a MiLB game's
  // carriers the same way it lists an MLB one's, so an affiliate's lineup page
  // now gets the fact too (and degrades to '' where the league lists nothing,
  // like every other MiLB gap). Keyed on gamePk, like callouts — a broadcast
  // assignment doesn't change mid-game, so a live Refresh never re-pulls it.
  const broadcast = useAsyncOnFeed(feed, (f) => fetchGameBroadcast(f), [game.gamePk])

  // Former-teammate ties (or, when a matchup has none, the ORG TIES fallback —
  // see orgTiesFor) between the two clubs, for the lineup pages' card. One
  // cached same-origin read of THIS matchup's shard (see formerTeammates.js);
  // it covers MiLB matchups too, so this isn't gated to MLB games — a matchup
  // outside the build's window has no shard and just yields no card.
  const teammates = useAsync(
    () =>
      enrichmentReady
        ? loadFormerTeammates(game.away.id, game.home.id)
        : Promise.resolve(null),
    [enrichmentReady, game.away.id, game.home.id],
  )
  const formerTeammatesData = teammates.data ?? null

  // Each club's batters vs the opposing probable starter (see
  // api/careerMatchups.js) — same build-time-fetch tier as former teammates:
  // one cached same-origin read, MLB + MiLB alike, degrading to no card
  // outside the build's window.
  const careerMatchupsQuery = useAsync(
    () => (enrichmentReady ? loadCareerMatchups() : Promise.resolve(null)),
    [enrichmentReady],
  )
  const careerMatchupsData = careerMatchupsQuery.data ?? null

  // Career vs-opponent lines (see api/vsTeamSplits.js) — the same static data
  // the player page's SPLITS VS TEAM card reads, reused here for the
  // "Turang is a career .303 against the Pirates" call-out (see
  // buildCallouts's vsTeamCareerLine). Season aggregates, spoiler-free, so it
  // rides the same deferred tier as prospects/former-teammates. Only the TWO
  // clubs playing are read — the dataset is sharded by club, so a game costs
  // two small same-origin reads instead of the whole league's 3.2 MB.
  const vsTeamSplits = useAsync(
    () =>
      enrichmentReady
        ? fetchVsTeamSplitsForTeams([game.away.id, game.home.id])
        : Promise.resolve(null),
    [enrichmentReady, game.away.id, game.home.id],
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

  const started = useMemo(() => (feed ? selectHasStarted(feed) : false), [feed])

  // Which logo treatment each side actually wore tonight. Preferred order:
  // (1) THIS game's own live uniform fetch (feedState.data.uniforms, already
  // pulled above for uniformBrief — no second network call), classified via
  // liveJerseyTreatment the moment statsapi posts the assignment (around
  // first pitch); (2) the nightly precompute GameCard.jsx also reads
  // (api/jerseys.js), for a game whose live fetch hasn't posted yet on this
  // load; (3) defaultTreatmentFor's predicted look, for a game outside both
  // sources' coverage (MiLB, or before either has posted). (1) can only ever
  // improve on (2) — the live fetch and the nightly file feed the exact same
  // classifyUniformAsset — so a live posting shows the real treatment same-day
  // instead of waiting for tomorrow night's cron.
  //
  // Two consumers: the win-probability chart's tiled band (WinProbChart.jsx),
  // and the lineup page's own header chrome (TeamInfo.jsx via
  // lib/headerTheme.js — ADR-0030). Both want the same answer to "what is this
  // club wearing", so it is resolved once here rather than twice.
  //
  // Spoiler-free by construction: a uniform choice, not a game state — same
  // footing as uniformBrief/jerseys.json above.
  const jerseysQuery = useAsync(
    () => (enrichmentReady ? fetchJerseysData() : Promise.resolve(null)),
    [enrichmentReady],
  )
  const jerseyTreatments = useMemo(() => {
    const uniforms = feedState.data?.uniforms
    return {
      away:
        liveJerseyTreatment(uniforms?.away, game.away.teamName) ??
        jerseyTreatmentFor(jerseysQuery.data, game.gamePk, game.away.id) ??
        defaultTreatmentFor(game.away.id, 'away', officialDate),
      home:
        liveJerseyTreatment(uniforms?.home, game.home.teamName) ??
        jerseyTreatmentFor(jerseysQuery.data, game.gamePk, game.home.id) ??
        defaultTreatmentFor(game.home.id, 'home', officialDate),
    }
  }, [
    feedState.data,
    jerseysQuery.data,
    game.gamePk,
    game.away.id,
    game.away.teamName,
    game.home.id,
    game.home.teamName,
    officialDate,
  ])

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
    jerseyTreatments,
    started,
  }
}
