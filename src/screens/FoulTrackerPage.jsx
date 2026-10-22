import '../styles/43-foul-tracker.css'
import { useMemo, useState } from 'react'
import { compareFoulsInScope, fetchFouls, foulsInScope, hasPostseason, topFoulGames, teamPitchTypeRates } from '../api/fouls.js'
import { fetchGamesByPk } from '../api/schedule.js'
import { fetchPositions } from '../api/person-fetch.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { foulsPath } from '../lib/route.js'
import { filterByTeam } from '../lib/teamFilter.js'
import { SiteHeader } from '../components/chrome/SiteHeader.jsx'
import { AsyncStatus } from '../components/ui/AsyncGate.jsx'
import { TeamFilterStrip } from '../components/team/TeamFilterStrip.jsx'
import { ReportFooter } from '../components/chrome/ReportFooter.jsx'
import { useFavoriteTeam } from '../hooks/preferences/useFavoriteTeam.js'
import { PartOfSeason } from '../components/season/PartOfSeason.jsx'
import { SeasonPicker } from '../components/season/SeasonPicker.jsx'
import { useSeasonData } from '../hooks/seasons/useSeasonData.js'
import { boardCompare } from '../lib/seasons/view.js'
import { pct1, FoulLeaderBoard, FoulsPerWhiffBoard, PaScorebug, FoulStoryBoard } from './foul-tracker/Boards.jsx'
import { GameHighBoard, SouvenirGameBoard } from './foul-tracker/GameBoards.jsx'
import { SeasonAverageCard, ByInning, ByPitchType, TeamBoard } from './foul-tracker/SeasonBoards.jsx'
// This page's own partial, kept out of the core sheet (src/index.css) so only
// /fouls pays for it. It loads after the core, which is the order it had there.

// The Foul Tracker — season-long foul-ball counting nobody else publishes:
// league leaders (total, per game, single-game highs), two-strike "spoiling",
// pitcher foul magnets, the by-inning foul curve with its starter-vs-bullpen
// split, and foul rate by pitch type. Everything reads the nightly
// gen-fouls.mjs precompute (completed games only, no SealBox;
// see src/api/fouls.js). MLB only; the page says so rather than pretending
// MiLB coverage exists.
//
// Each player leaderboard features its #1 entry as a hero headshot card (see
// FoulFeatured below) with ranks 2+ as a plain ledger table beneath. Single-
// Game Highs and Most-Fouls-In-A-PA are different — a specific STORY, not a
// ranking — so every row there gets the fuller headshot + narrated-context
// treatment (see FoulStoryBoard below); the PA board's context is rich enough
// (inning/outs/runners/score/pitcher) to earn its own scorebug widget rather
// than a sentence (see PaScorebug). Every board wears the same navy/gold
// SectionMasthead the rest of the app's card sections use.
//
// Deliberately a wide spread of angles — this page is the trial balloon for
// which foul stats stick (see .scratch/metric-engines/foul-tracker.md).


// A season view (#1202): `seasonYear` and `vs` come from the address.
export function FoulTrackerPage({ seasonYear, vs }) {
  useDocumentTitle('Foul Tracker')
  const { view, data: seasonData, prev: prevSeason, loading, error, mode, setMode } = useSeasonData('fouls', fetchFouls, { seasonYear, vs })
  const [wantPost, setWantPost] = useState(false)
  const post = wantPost && hasPostseason(seasonData)
  const data = useMemo(() => foulsInScope(seasonData, post ? 'P' : 'R'), [seasonData, post])
  const prev = useMemo(() => compareFoulsInScope(prevSeason, post ? 'P' : 'R'), [prevSeason, post])
  // A board's compare column: its figure, found again in the vs season.
  const cmp = (group, format, value) =>
    prev ? boardCompare({ vs: view.vs, mode, format, value, prevOf: (r) => prev[group]?.[r.id] }) : null
  const { favoriteTeamId } = useFavoriteTeam()
  const [filterTeamId, setFilterTeamId] = useState(null)

  const boards = useMemo(() => buildBoards(data, filterTeamId, post), [data, filterTeamId, post])

  // The favorite-team "is-me" tint (favRowProps below) drowns the ranking once
  // the team filter has narrowed every row to one club. Only tint when the page
  // shows the whole league.
  const highlightTeamId = filterTeamId == null ? favoriteTeamId : null

  // Single-Game-Highs' and Best Souvenir Odds' badges link to a box score. The
  // precompute carries only each gamePk, so one batched schedule lookup (shared
  // by both boards) resolves the away/home abbreviations gamePath needs. Falls
  // back to {}: a plain, non-clickable date badge, not a crash.
  const gameLinkPks = useMemo(
    () => [
      ...(boards?.gameHighs ?? []).map((b) => b.maxGamePk),
      ...(boards?.souvenirGames ?? []).map((g) => g.gamePk),
    ].filter(Boolean),
    [boards],
  )
  const { data: gameLinks } = useAsync(() => fetchGamesByPk(gameLinkPks), [gameLinkPks])

  // The four #1 leaders (FoulFeatured) and every Single-Game-Highs row get a
  // position under their name. The precompute has none, so a batched people
  // lookup fills in just these ids. Falls back to {}: no position shown.
  const positionIds = useMemo(
    () =>
      [
        boards?.batterTotal?.[0],
        boards?.batterRate?.[0],
        boards?.pitcherRate?.[0],
        boards?.pitcherRateLow?.[0],
        ...(boards?.gameHighs ?? []),
      ]
        .filter(Boolean)
        .map((p) => p.id),
    [boards],
  )
  const { data: positions } = useAsync(() => fetchPositions(positionIds), [positionIds])

  return (
    <div className="screen">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">Foul Tracker</h1>
      </header>

      <SeasonPicker view={view} pathFor={foulsPath} mode={mode} onMode={setMode} />

      <p className="hint foultracker__intro">
        {view?.label || 'This'} {view?.shown === 'all' ? 'seasons’' : 'season’s'} {post ? 'postseason' : ''} foul balls, counted from every MLB game’s
        pitch-by-pitch{data?.gamesIngested ? ` (${data.gamesIngested} games so far)` : ''}.
        Fouls hit <em>at</em> two strikes are tracked separately — they’re the ones that
        extend at-bats, and batters who reach two strikes by fouling hit .291 in those
        counts against .102 for everyone else (SABR, 1945–2015).
      </p>

      {hasPostseason(seasonData) && <PartOfSeason postseason={post} onChange={setWantPost} />}

      {boards && <SeasonAverageCard data={data} />}

      <AsyncStatus
        loading={loading}
        error={error}
        hasData={!!boards}
        errorMessage="Couldn’t load the foul data. Try again."
        emptyMessage="No foul data generated yet."
      />

      {boards && (
        <TeamFilterStrip
          selectedTeamId={filterTeamId}
          onSelect={setFilterTeamId}
          ariaLabel="Filter Foul Tracker by team"
        />
      )}

      {boards && (
        <>
          <FoulLeaderBoard
            title="Most fouls"
            rows={boards.batterTotal}
            cols={['Fouls', 'Per game', 'With 2 Strikes']}
            cells={(b) => [b.fouls, (b.fouls / b.g).toFixed(1), b.twoStrikeFouls]}
            compare={cmp('batters', 'count', (b) => b.fouls)}
            featured
            favoriteTeamId={highlightTeamId}
            positions={positions}
          />
          <FoulLeaderBoard
            title="Most fouls per game"
            rows={boards.batterRate}
            cols={['Per game', 'Fouls', 'With 2 Strikes']}
            cells={(b) => [(b.fouls / b.g).toFixed(2), b.fouls, b.twoStrikeFouls]}
            compare={cmp('batters', 'dec2', (b) => b.fouls / b.g)}
            featured
            favoriteTeamId={highlightTeamId}
            positions={positions}
          />

          {/* Both are per-GAME story boards (not player leaderboards), so on a
              wide screen they share a row 50/50 instead of stacking full-width
              like the rest of the page — see .foultracker__pair. */}
          <div className="foultracker__pair">
            <GameHighBoard
              title="Single-game highs"
              rows={boards.gameHighs}
              favoriteTeamId={highlightTeamId}
              gameLinks={gameLinks}
              positions={positions}
            />

            <SouvenirGameBoard
              title="Best souvenir odds"
              rows={boards.souvenirGames}
              gameLinks={gameLinks}
            />
          </div>

          <FoulStoryBoard
            title="Most fouls in one plate appearance"
            rows={boards.paHighs}
            value={(b) => b.bestPa.fouls}
            bug={(b) => <PaScorebug pa={b.bestPa} />}
            favoriteTeamId={highlightTeamId}
          />

          <FoulLeaderBoard
            title="Foul magnets — pitchers"
            rows={boards.pitcherRate}
            cols={['Foul%', 'Fouls']}
            cells={(p) => [pct1(p.fouls / p.pitches), p.fouls]}
            compare={cmp('pitchers', 'pct', (p) => p.fouls / p.pitches)}
            featured
            favoriteTeamId={highlightTeamId}
            positions={positions}
          />
          <FoulLeaderBoard
            title="Fewest fouls — pitchers"
            rows={boards.pitcherRateLow}
            cols={['Foul%', 'Fouls']}
            cells={(p) => [pct1(p.fouls / p.pitches), p.fouls]}
            compare={cmp('pitchers', 'pct', (p) => p.fouls / p.pitches)}
            featured
            favoriteTeamId={highlightTeamId}
            positions={positions}
          />

          <FoulsPerWhiffBoard
            mostRows={boards.pitcherFoulsPerWhiff}
            fewestRows={boards.pitcherFoulsPerWhiffLow}
            avg={boards.pitcherFoulsPerWhiffAvg}
            minPitches={boards.minPitches}
            favoriteTeamId={highlightTeamId}
          />

          <ByInning league={boards.league} />
          <ByPitchType league={boards.league} teamRates={boards.teamPitchTypeRates} />
          <TeamBoard
            teams={boards.teamRows}
            favoriteTeamId={highlightTeamId}
            compare={cmp('teams', 'dec1', (t) => t.fouls / t.g)}
          />
        </>
      )}

      <ReportFooter />
    </div>
  )
}

// Sorted boards from the raw precompute maps. Null when the file is missing
// or empty — the page then shows its empty state. `teamId` (from the page's
// TeamFilterStrip, null = every team) restricts every leader table to that
// club's own players — but NOT the minGames floor, computed off the whole
// league's max games played so switching teams never changes what counts as
// "enough games this season," and NOT the league-wide by-inning/by-pitch-type
// tables (see `league` below), which carry no team dimension to filter.
// `post` shrinks the floors: a club plays few October games.
function buildBoards(data, teamId = null, post = false) {
  const allBatters = Object.entries(data?.batters ?? {}).map(([id, b]) => ({ id, ...b }))
  if (allBatters.length === 0) return null
  const allPitchers = Object.entries(data?.pitchers ?? {}).map(([id, p]) => ({ id, ...p }))

  // Playing-time floors scale with the season so the page works in April too.
  const maxG = Math.max(...allBatters.map((b) => b.g))
  const minGames = Math.max(post ? 2 : 5, Math.round(maxG * 0.5))
  const minPitches = post ? 60 : 300

  const batters = filterByTeam(allBatters, teamId, (b) => b.teamId)
  const pitchers = filterByTeam(allPitchers, teamId, (p) => p.teamId)
  const qualified = batters.filter((b) => b.g >= minGames)
  const qualifiedP = pitchers.filter((p) => (p.pitches ?? 0) >= minPitches)
  const foulsPerWhiffPool = qualifiedP.filter((p) => p.whiffs > 0)

  // Always the whole league's qualifying pool, ignoring `teamId` — the
  // Most/Fewest cutoff below (pitcherFoulsPerWhiffAvg) has to hold steady
  // when a team filter narrows the page, or switching teams would redraw the
  // very line that decides which side a pitcher falls on.
  const leagueFoulsPerWhiffPool = allPitchers.filter((p) => (p.pitches ?? 0) >= minPitches && p.whiffs > 0)
  const pitcherFoulsPerWhiffAvg =
    leagueFoulsPerWhiffPool.length > 0
      ? leagueFoulsPerWhiffPool.reduce((s, p) => s + p.fouls, 0) /
        leagueFoulsPerWhiffPool.reduce((s, p) => s + p.whiffs, 0)
      : null

  const top = (arr, keyFn, n = 12) => [...arr].sort((a, b) => keyFn(b) - keyFn(a)).slice(0, n)
  const bottom = (arr, keyFn, n = 12) => [...arr].sort((a, b) => keyFn(a) - keyFn(b)).slice(0, n)

  return {
    minGames,
    minPitches,
    batterTotal: top(batters, (b) => b.fouls),
    batterRate: top(qualified, (b) => b.fouls / b.g),
    gameHighs: top(
      batters.filter((b) => (b.maxGameFouls ?? 0) > 0),
      (b) => b.maxGameFouls,
    ),
    souvenirGames: topFoulGames(data, { scope: teamId ?? 'league' }),
    paHighs: top(
      batters.filter((b) => (b.bestPa?.fouls ?? 0) > 0),
      (b) => b.bestPa.fouls,
    ),
    pitcherRate: top(qualifiedP, (p) => p.fouls / p.pitches),
    pitcherRateLow: bottom(qualifiedP, (p) => p.fouls / p.pitches),
    // Most/Fewest split on which side of the LEAGUE-wide average (never the
    // team-filtered pool) a pitcher falls, not a top-12/bottom-12 of whatever
    // pool is on screen — a top/bottom split of a team-narrowed pool put the
    // same handful of pitchers on both sides once a team filter left only a
    // few qualifiers. Same "don't let the team filter move the floor" rule
    // minGames follows above. `pitcherFoulsPerWhiffAvg` is the full league
    // pool's aggregate rate (total fouls / total whiffs, not an average of
    // each pitcher's own ratio — same sum-then-divide convention as
    // SeasonAverageCard's avgFoulsPerPA/avgFoulsPerStart below, so a
    // low-whiff reliever's noisy individual ratio can't skew the baseline
    // the way a mean-of-ratios would).
    pitcherFoulsPerWhiff:
      pitcherFoulsPerWhiffAvg == null
        ? []
        : top(
            foulsPerWhiffPool.filter((p) => p.fouls / p.whiffs > pitcherFoulsPerWhiffAvg),
            (p) => p.fouls / p.whiffs,
          ),
    pitcherFoulsPerWhiffLow:
      pitcherFoulsPerWhiffAvg == null
        ? []
        : bottom(
            foulsPerWhiffPool.filter((p) => p.fouls / p.whiffs < pitcherFoulsPerWhiffAvg),
            (p) => p.fouls / p.whiffs,
          ),
    pitcherFoulsPerWhiffAvg,
    league: data?.league ?? null,
    // Only meaningful once a team filter narrows the page to one club — see
    // ByPitchType's team-vs-league branch below.
    teamPitchTypeRates: teamId != null ? teamPitchTypeRates(data, teamId) : null,
    teamRows: filterByTeam(
      Object.entries(data?.teams ?? {}).map(([id, t]) => ({ id: Number(id), ...t })),
      teamId,
      (t) => t.id,
    ).sort((a, b) => b.fouls / b.g - a.fouls / a.g),
  }
}

