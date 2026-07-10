import { useMemo } from 'react'
import {
  fetchGameFeed,
  fetchManager,
  fetchPitcherSeasonLine,
  fetchWinProbability,
} from '../api/game.js'
import { fetchGameUniforms, uniformSummary } from '../api/uniforms.js'
import { fetchGameBroadcast } from '../api/broadcast.js'
import { fetchTeamRoster } from '../api/team.js'
import { generateScorebookWeather } from '../api/weather.js'
import { selectHasStarted } from '../api/select.js'
import { rosterPitcherRole } from '../api/person.js'
import { fetchTopProspects } from '../api/prospects.js'
import { fetchCallouts, calloutsForGame } from '../api/callouts.js'
import { fetchVsTeamSplits } from '../api/vsTeamSplits.js'
import { loadFormerTeammates } from '../api/formerTeammates.js'
import { useAsync } from './useAsync.js'
import { useAsyncOnFeed } from './useAsyncOnFeed.js'
import { apiDateToUrl } from '../lib/route.js'
import { SPORT_IDS } from '../lib/teams.js'

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
    async () => {
      const [feed, uniforms] = await Promise.all([
        fetchGameFeed(game.gamePk),
        fetchGameUniforms(game.gamePk),
      ])
      return { feed, uniforms }
    },
    [game.gamePk],
    // Standalone/home-screen mode has no pull-to-refresh, so catch a
    // score-critical feed back up as soon as the app is foregrounded again.
    { refetchOnForeground: true },
  )
  const feed = feedState.data?.feed

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

  // Each probable starter's season line (ERA/W-L/K), penciled next to the
  // opposing-pitcher row while staging. Season aggregates only — never this
  // game's line.
  const starterLines = useAsyncOnFeed(
    feed,
    async (f) => {
      const season = f.gameData?.game?.season
      const probables = f.gameData?.probablePitchers ?? {}
      const [away, home] = await Promise.all([
        fetchPitcherSeasonLine(probables.away?.id, season, game.sportId),
        fetchPitcherSeasonLine(probables.home?.id, season, game.sportId),
      ])
      return { away, home }
    },
    [game.gamePk],
  )

  // Per-play win probability, the sole source of WPA for the box score's three
  // stars (the feed carries none). Only the box-score view uses it, so it's
  // fetched lazily once the feed exists — a live Refresh won't re-pull it,
  // matching how the box score is really a post-game read. Resolves null
  // off-MLB, hiding the card.
  const winProb = useAsyncOnFeed(feed, () => fetchWinProbability(game.gamePk), [game.gamePk])

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
        if (r.position?.type === 'Pitcher' && r.person?.id) {
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
  const prospects = useAsync(() => fetchTopProspects(), [])
  const prospectsData = game.sportId === SPORT_IDS.MLB ? null : prospects.data ?? null

  // Season-context call-outs for the play-by-play — the leader / streak /
  // situational-record notes, precomputed nightly to a static per-date file (see
  // api/callouts.js). Spoiler-free season aggregates (no seal), same eager tier
  // as prospect badges. MLB-only: the file only covers the majors, so a MiLB
  // gamePk simply resolves to no bundle. Keyed on gamePk, like the other
  // feed-derived static fetches — a live Refresh never re-pulls it.
  const callouts = useAsyncOnFeed(
    feed,
    async (f) => {
      if (game.sportId !== SPORT_IDS.MLB) return null
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
  const teammates = useAsync(() => loadFormerTeammates(), [])
  const formerTeammatesData = teammates.data ?? null

  // Career vs-opponent lines (see api/vsTeamSplits.js) — the same static file
  // the player page's SPLITS VS TEAM card reads, reused here for the
  // "Turang is a career .303 against the Pirates" call-out (see
  // buildCallouts's vsTeamCareerLine). Season aggregates, spoiler-free, so it
  // rides the same eager tier as prospects/former-teammates — no gamePk key,
  // one cached same-origin read for the whole app.
  const vsTeamSplits = useAsync(() => fetchVsTeamSplits(), [])
  const vsTeamSplitsData = vsTeamSplits.data ?? null

  const started = useMemo(() => (feed ? selectHasStarted(feed) : false), [feed])

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
    gameCallouts,
    broadcast,
    formerTeammatesData,
    vsTeamSplitsData,
    started,
  }
}
