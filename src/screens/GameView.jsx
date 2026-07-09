import { useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchGameFeed,
  fetchManager,
  fetchPitcherSeasonLine,
  fetchWinProbability,
} from '../api/game.js'
import { fetchGameUniforms, uniformSummary } from '../api/uniforms.js'
import { fetchTeamRoster } from '../api/team.js'
import { generateScorebookWeather } from '../api/weather.js'
import { selectHasStarted } from '../api/select.js'
import { rosterPitcherRole } from '../api/person.js'
import { fetchTopProspects } from '../api/prospects.js'
import { loadFormerTeammates } from '../api/formerTeammates.js'
import { useAsync } from '../hooks/useAsync.js'
import { useAsyncOnFeed } from '../hooks/useAsyncOnFeed.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { useMediaQuery, WIDE_QUERY } from '../hooks/useMediaQuery.js'
import { sectionToStep, stepToSection } from '../lib/route.js'
import { SPORT_IDS } from '../lib/teams.js'
import { TeamInfo, LineupSpread } from './TeamInfo.jsx'
import { InningViewer } from './InningViewer.jsx'
import { BoxScore } from './BoxScore.jsx'
import { TeamLogo } from '../components/TeamLogo.jsx'
import { LogoModal } from '../components/LogoModal.jsx'
import { SiteHeader } from '../components/SiteHeader.jsx'
import { Loader } from '../components/Loader.jsx'
import { LinkScope } from '../lib/nav.jsx'

// Container for a selected game. Fetches the feed (and both managers) once, then
// shows the section named by the URL: away info → home info → inning viewer.
// The chrome is two grayscale team marks (away @ home) that open the sketch
// modal; a small site mark up top returns to the slate. Which section shows is
// driven entirely by `section` / `onSection` so every step is a real URL.
export function GameView({ game, section, onSection }) {
  const { step, inning, half } = sectionToStep(section)
  useDocumentTitle(gameTitle(game, step, inning, half))
  const [sketching, setSketching] = useState(null) // 'away' | 'home' | null
  // Tablet/desktop: the two lineup pages condense into one two-column spread
  // (LineupSpread) at the same breakpoint the CSS starts laying columns. The
  // lineup1/lineup2 URLs both show the spread, so links stay portable between
  // a phone and a desk.
  const wide = useMediaQuery(WIDE_QUERY)

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
  // nothing from the feed — the game prop already carries both team ids — so
  // this runs in parallel with the feed fetch instead of queuing behind the
  // app's largest response. Keyed on the stable team ids, not the feed object:
  // managers can't change mid-game, so a live Refresh (which mints a new feed
  // object) never re-hits the coaches endpoint or risks blanking a resolved
  // name on a transient failure.
  const managers = useAsync(async () => {
    const [away, home] = await Promise.all([
      fetchManager(game.away.id),
      fetchManager(game.home.id),
    ])
    return { away, home }
  }, [game.away.id, game.home.id])

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

  // Former-teammate ties between the two clubs, for the FORMER TEAMMATES card on
  // the lineup pages. The whole precomputed file is a single cached same-origin
  // read (see formerTeammates.js), and it only carries MLB matchups, so this is
  // gated to MLB games — a MiLB game just passes null and the card never shows.
  const teammates = useAsync(() => loadFormerTeammates(), [])
  const formerTeammatesData =
    game.sportId === SPORT_IDS.MLB ? teammates.data ?? null : null

  const started = useMemo(() => (feed ? selectHasStarted(feed) : false), [feed])

  // Where "Innings" returns to: the last half-inning page the user was on, so
  // hopping out to a lineup or the box score and back doesn't lose your place
  // mid-game. Structural only (a section name), never a score.
  const lastInningSection = useRef('top1')
  useEffect(() => {
    if (step === 2) lastInningSection.current = stepToSection(2, inning, half)
  }, [step, inning, half])

  const sketchTeam = sketching ? game[sketching] : null

  return (
    <LinkScope asOf={officialDate} sportId={game.sportId}>
    <div className="screen">
      <SiteHeader />

      <Masthead away={game.away} home={game.home} onSketch={setSketching} />

      {/* Every game section, one tap away — the same four stops the "next"
          buttons walk in order, so you can flip around the way you flip
          scorebook pages instead of only marching forward. */}
      {feed && (
        <nav className="stepnav" aria-label="Game sections">
          {(wide
            ? // Wide screens show both lineups on one spread, so the two team
              // tabs collapse into a single "Lineups" stop.
              [
                {
                  key: 'lineups',
                  label: 'Lineups',
                  active: step === 0 || step === 1,
                  section: 'lineup1',
                },
                {
                  key: 'innings',
                  label: 'Innings',
                  active: step === 2,
                  section: lastInningSection.current,
                },
                { key: 'box', label: 'Box', active: step === 3, section: 'boxscore' },
              ]
            : [
                {
                  key: 'away',
                  label: game.away.abbreviation || 'Away',
                  active: step === 0,
                  section: 'lineup1',
                },
                {
                  key: 'home',
                  label: game.home.abbreviation || 'Home',
                  active: step === 1,
                  section: 'lineup2',
                },
                {
                  key: 'innings',
                  label: 'Innings',
                  active: step === 2,
                  section: lastInningSection.current,
                },
                { key: 'box', label: 'Box', active: step === 3, section: 'boxscore' },
              ]
          ).map((s) => (
            <button
              key={s.key}
              type="button"
              className={`stepnav__btn ${s.active ? 'is-active' : ''}`}
              aria-current={s.active ? 'page' : undefined}
              onClick={() => !s.active && onSection(s.section)}
            >
              {s.label}
            </button>
          ))}
        </nav>
      )}

      {sketchTeam && (
        <LogoModal
          teamId={sketchTeam.id}
          name={sketchTeam.name}
          onClose={() => setSketching(null)}
        />
      )}

      {feedState.loading && !feed && <Loader />}
      {/* Cold-load failure (never got a feed): collapse to a retry card. */}
      {!feed && feedState.error && (
        <>
          <p className="hint hint--error">
            Couldn’t load this game. Try again in a moment.
          </p>
          <button className="btn" onClick={feedState.reload}>
            Retry
          </button>
        </>
      )}
      {/* Refresh failure with a feed already in hand: keep the game on screen
          (useAsync retains the last-good feed) and just flag the stale refresh
          so one flaky request at a live game doesn't tear down the view. */}
      {feed && feedState.error && (
        <p className="hint hint--error" role="status">
          Couldn’t refresh — showing the last update.
        </p>
      )}

      {feed && (step === 0 || step === 1) && wide && (
        <LineupSpread
          feed={feed}
          managers={managers.data}
          uniforms={uniformBrief}
          scorebookWeather={weather.data}
          scorebookWeatherLoading={weather.loading}
          starterLines={starterLines.data}
          prospectsData={prospectsData}
          formerTeammatesData={formerTeammatesData}
          onNext={() => onSection('top1')}
          onReload={feedState.reload}
          loading={feedState.loading}
        />
      )}
      {feed && step === 0 && !wide && (
        <TeamInfo
          feed={feed}
          side="away"
          manager={managers.data?.away}
          uniform={uniformBrief.away}
          scorebookWeather={weather.data}
          scorebookWeatherLoading={weather.loading}
          // The away side FACES the home starter.
          oppPitcherLine={starterLines.data?.home}
          prospectsData={prospectsData}
          formerTeammatesData={formerTeammatesData}
          onNext={() => onSection('lineup2')}
          nextLabel="Home team ›"
          onReload={feedState.reload}
          loading={feedState.loading}
        />
      )}
      {feed && step === 1 && !wide && (
        <TeamInfo
          feed={feed}
          side="home"
          manager={managers.data?.home}
          uniform={uniformBrief.home}
          scorebookWeather={weather.data}
          scorebookWeatherLoading={weather.loading}
          oppPitcherLine={starterLines.data?.away}
          prospectsData={prospectsData}
          formerTeammatesData={formerTeammatesData}
          onNext={() => onSection('top1')}
          nextLabel="Innings ›"
          onReload={feedState.reload}
          loading={feedState.loading}
        />
      )}
      {feed && step === 2 && (
        <InningViewer
          feed={feed}
          started={started}
          inning={inning}
          half={half}
          onInning={(n, h, opts) => onSection(stepToSection(2, n, h), opts)}
          onBoxScore={() => onSection('boxscore')}
          onReload={feedState.reload}
          loading={feedState.loading}
          pitcherRoles={pitcherRoles.data}
          winProbability={winProb.data}
          prospectsData={prospectsData}
        />
      )}
      {feed && step === 3 && (
        <BoxScore
          feed={feed}
          managers={managers.data}
          uniforms={uniformBrief}
          scorebookWeather={weather.data}
          winProbability={winProb.data}
          onInnings={() => onSection(lastInningSection.current)}
          onReload={feedState.reload}
          loading={feedState.loading}
        />
      )}
    </div>
    </LinkScope>
  )
}

// The game's masthead: two grayscale marks — away on the left, home on the
// right, an @ between — sized like the logos on the lineup pages. Tapping a mark
// opens it enlarged for pencil sketching.
function Masthead({ away, home, onSketch }) {
  return (
    <div className="masthead">
      <MastheadLogo team={away} onSketch={() => onSketch('away')} />
      <span className="masthead__at" aria-hidden="true">@</span>
      <MastheadLogo team={home} onSketch={() => onSketch('home')} />
    </div>
  )
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

// Spoiler-safe tab title: team abbreviations plus a structural section label
// (lineup side, half-inning, box score) — the same information the URL's
// `section` already exposes, never anything score-revealing.
function gameTitle(game, step, inning, half) {
  const away = game.away.abbreviation || game.away.teamName || 'Away'
  const home = game.home.abbreviation || game.home.teamName || 'Home'
  const matchup = `${away} @ ${home}`
  if (step === 0) return `${matchup} · ${away} Lineup`
  if (step === 1) return `${matchup} · ${home} Lineup`
  if (step === 3) return `${matchup} · Box Score`
  return `${matchup} · ${half === 'bottom' ? 'Bot' : 'Top'} ${ordinal(inning)}`
}

function MastheadLogo({ team, onSketch }) {
  return (
    <button
      type="button"
      className="masthead__logo"
      onClick={onSketch}
      aria-label={`Enlarge ${team.name || 'team'} logo for sketching`}
    >
      <TeamLogo teamId={team.id} name={team.name} size={44} bw />
    </button>
  )
}
