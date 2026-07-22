import { useMemo, useState } from 'react'
import { fetchFouls, topFoulGames, teamPitchTypeRates } from '../api/fouls.js'
import { fetchGamesByPk } from '../api/schedule.js'
import { fetchPositions } from '../api/person-fetch.js'
import { splitDisplayName } from '../api/person.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { monthDayYear, weekdayAbbr, isWithinDays } from '../lib/dates.js'
import { ordinal } from '../lib/format.js'
import { gamePath } from '../lib/route.js'
import { useNav } from '../lib/nav.js'
import { filterByTeam } from '../lib/teamFilter.js'
import { SiteHeader } from '../components/SiteHeader.jsx'
import { AsyncStatus } from '../components/AsyncGate.jsx'
import { PlayerLink } from '../components/PlayerLink.jsx'
import { TeamLink } from '../components/TeamLink.jsx'
import { Headshot } from '../components/Headshot.jsx'
import { TeamLogo } from '../components/TeamLogo.jsx'
import { SectionMasthead } from '../components/SectionMasthead.jsx'
import { BaseoutDiamond } from '../components/BaseoutDiamond.jsx'
import { TeamFilterStrip } from '../components/TeamFilterStrip.jsx'
import { ReportFooter } from '../components/ReportFooter.jsx'
import { useFavoriteTeam } from '../hooks/useFavoriteTeam.js'
import { teamAbbr, teamFullName, teamClubName, favoriteAccentColor } from '../lib/teams.js'

// The Foul Tracker — season-long foul-ball counting nobody else publishes:
// league leaders (total, per game, single-game highs), two-strike "spoiling",
// pitcher foul magnets, the by-inning foul curve with its starter-vs-bullpen
// split, and foul rate by pitch type. Everything reads the nightly
// gen-fouls.mjs precompute (completed games only — spoiler-free, no SealBox;
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

const pct1 = (x) => `${(x * 100).toFixed(1)}%`

// A `.standings` <tr> or `.sgh-row`/`.gamehigh-row` <li>'s favorite-team
// highlight — same `is-me` class + `--fav-accent` inline var convention as
// StandingsPage/TeamLeaders (see .standings tr.is-me, .tlead__row--fav in
// index.css), reused as-is so a fan's team tints the same way here as
// everywhere else in the app.
function favRowProps(teamId, favoriteTeamId) {
  if (favoriteTeamId == null || teamId !== favoriteTeamId) return {}
  return { className: 'is-me', style: { '--fav-accent': favoriteAccentColor(teamId) } }
}

export function FoulTrackerPage() {
  useDocumentTitle('Foul Tracker')
  const { loading, error, data } = useAsync(() => fetchFouls(), [])
  const { favoriteTeamId } = useFavoriteTeam()
  const [filterTeamId, setFilterTeamId] = useState(null)

  const boards = useMemo(() => buildBoards(data, filterTeamId), [data, filterTeamId])

  // The favorite-team "is-me" tint (favRowProps below) is redundant, and
  // actively overwhelming, once the team filter has restricted every visible
  // row to one club — if that club IS the favorite, nearly every row lights
  // up, drowning out the ranking it's supposed to accent. Only light rows up
  // when the page is showing the whole league.
  const highlightTeamId = filterTeamId == null ? favoriteTeamId : null

  // Single-Game-Highs' AND Best Souvenir Odds' score/date badges both link out
  // to a box score — the precompute only carries each's gamePk (see
  // gen-fouls.mjs's max_game_pk / foul_game_totals), not which side was
  // home/away, so one batched schedule lookup (shared by both boards) resolves
  // the away/home abbreviations gamePath needs. Same fetchGamesByPk batching
  // loadPlayer.js uses for its own game-log deep links. Degrades to {} on
  // failure — a plain, non-clickable date badge, not a crash.
  const gameLinkPks = useMemo(
    () => [
      ...(boards?.gameHighs ?? []).map((b) => b.maxGamePk),
      ...(boards?.souvenirGames ?? []).map((g) => g.gamePk),
    ].filter(Boolean),
    [boards],
  )
  const { data: gameLinks } = useAsync(() => fetchGamesByPk(gameLinkPks), [gameLinkPks])

  // The four leaderboards' #1 leaders (hero cards, see FoulFeatured) plus
  // every Single-Game-Highs row (GameHighRow, styled the same way) get a
  // position + team name under their name — the precompute has no position
  // (it's aggregated purely from feed pitch/PA counts, not roster data), so a
  // batched people lookup fills in just this handful of ids rather than
  // adding position to every one of the hundreds of rows gen-fouls.mjs
  // ingests. Degrades to {} on failure — both callers already treat a
  // missing position as "don't show the position".
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

      <p className="hint foultracker__intro">
        {data?.season ?? 'This'} season’s foul balls, counted from every MLB game’s
        pitch-by-pitch{data?.gamesIngested ? ` (${data.gamesIngested} games so far)` : ''}.
        Fouls hit <em>at</em> two strikes are tracked separately — they’re the ones that
        extend at-bats, and batters who reach two strikes by fouling hit .291 in those
        counts against .102 for everyone else (SABR, 1945–2015).
      </p>

      {boards && <SeasonAverageCard data={data} />}

      <AsyncStatus
        loading={loading}
        error={error}
        hasData={!!boards}
        errorMessage="Couldn’t load the foul data. Try again."
        emptyMessage="No foul data generated yet."
        emptyProse
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
            featured
            favoriteTeamId={highlightTeamId}
            positions={positions}
          />
          <FoulLeaderBoard
            title="Most fouls per game"
            rows={boards.batterRate}
            cols={['Per game', 'Fouls', 'With 2 Strikes']}
            cells={(b) => [(b.fouls / b.g).toFixed(2), b.fouls, b.twoStrikeFouls]}
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
            cols={['Foul%', 'Fouls', 'Per whiff']}
            cells={(p) => [
              pct1(p.fouls / p.pitches),
              p.fouls,
              p.whiffs > 0 ? (p.fouls / p.whiffs).toFixed(1) : '—',
            ]}
            featured
            favoriteTeamId={highlightTeamId}
            positions={positions}
          />
          <FoulLeaderBoard
            title="Fewest fouls — pitchers"
            rows={boards.pitcherRateLow}
            cols={['Foul%', 'Fouls', 'Per whiff']}
            cells={(p) => [
              pct1(p.fouls / p.pitches),
              p.fouls,
              p.whiffs > 0 ? (p.fouls / p.whiffs).toFixed(1) : '—',
            ]}
            featured
            favoriteTeamId={highlightTeamId}
            positions={positions}
          />

          <ByInning league={boards.league} />
          <ByPitchType league={boards.league} teamRates={boards.teamPitchTypeRates} />
          <TeamBoard teams={boards.teamRows} favoriteTeamId={highlightTeamId} />
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
function buildBoards(data, teamId = null) {
  const allBatters = Object.entries(data?.batters ?? {}).map(([id, b]) => ({ id, ...b }))
  if (allBatters.length === 0) return null
  const allPitchers = Object.entries(data?.pitchers ?? {}).map(([id, p]) => ({ id, ...p }))

  // Playing-time floors scale with the season so the page works in April too.
  const maxG = Math.max(...allBatters.map((b) => b.g))
  const minGames = Math.max(5, Math.round(maxG * 0.5))

  const batters = filterByTeam(allBatters, teamId, (b) => b.teamId)
  const pitchers = filterByTeam(allPitchers, teamId, (p) => p.teamId)
  const qualified = batters.filter((b) => b.g >= minGames)
  const qualifiedP = pitchers.filter((p) => (p.pitches ?? 0) >= 300)

  const top = (arr, keyFn, n = 12) => [...arr].sort((a, b) => keyFn(b) - keyFn(a)).slice(0, n)
  const bottom = (arr, keyFn, n = 12) => [...arr].sort((a, b) => keyFn(a) - keyFn(b)).slice(0, n)

  return {
    minGames,
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

// Every board on this page wears the same navy/gold masthead the rest of the
// app's card sections use (Lineup Strength, Bullpen Tonight, batting order,
// …) — the container owns the border/radius/shadow, the masthead caps it,
// same convention as those. No descriptive copy under the title — the board's
// own name plus its data carries the meaning, and every board's table/list
// bleeds edge-to-edge under the masthead (.foulboard-block rules in
// index.css) rather than floating inset with its own redundant border.
function BoardCard({ title, children }) {
  return (
    <section className="metriccard foulboard-block">
      <SectionMasthead as="h2" title={title} />
      <div className="metriccard__body">{children}</div>
    </section>
  )
}

// The rank-1 entry rendered as a hero card — headshot, a two-line name (same
// first/last split idiom as PlayerPage's/TeamLeaders' hero, see
// splitDisplayName) with the team name underneath, a bigger centered team
// logo, plus a three-tile stat strip idiom GameHighRow uses for Single-Game
// Highs (`.gamehigh-tiles`/`.stat`, reused directly rather than reinvented),
// so every board's #1 leader reads the same way. `cols`/`cells` are the SAME
// descriptors the table beneath it uses — one tile per column — so a board's
// shape only has to be described once.
function FoulFeatured({ player, cols, cells, favoriteTeamId, positions }) {
  const values = cells(player)
  const isFavorite = favoriteTeamId != null && player.teamId === favoriteTeamId
  const favStyle = isFavorite ? { '--fav-accent': favoriteAccentColor(player.teamId) } : undefined
  const { first, last } = splitDisplayName(player.name)
  const position = positions?.[player.id]
  return (
    <div className={`foulboard__hero${isFavorite ? ' is-me' : ''}`} style={favStyle}>
      <div className="foulboard__herotop">
        <Headshot personId={player.id} name={player.name} teamId={player.teamId} className="foulboard__heroshot" />
        <div className="foulboard__heroident">
          <PlayerLink id={player.id} className="foulboard__heroname">
            {first && <span className="foulboard__heroname-first">{first}</span>}
            <span className="foulboard__heroname-last">{last}</span>
          </PlayerLink>
          <p className="foulboard__herometa">
            {position && <span className="foulboard__heropos">{position}</span>}
            {position && ' · '}
            <TeamLink id={player.teamId} className="foulboard__heroteamname">
              {teamFullName(player.teamId)}
            </TeamLink>
          </p>
        </div>
        <TeamLogo
          teamId={player.teamId}
          name={teamAbbr({ id: player.teamId })}
          size={44}
          className="foulboard__heroteam"
        />
      </div>
      <div className="gamehigh-tiles foulboard__herotiles">
        {cols.map((c, j) => (
          <div className="stat" key={c}>
            <span className="stat__v">{values[j]}</span>
            <span className="stat__k">{c}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// `featured`: pulls rank 1 out into a FoulFeatured headshot card above the
// table, which then starts numbering at 2 — the featured card IS his row, so
// the table never shows him twice.
function FoulLeaderBoard({ title, rows, cols, cells, featured = false, favoriteTeamId, positions }) {
  if (!rows || rows.length === 0) return null
  const lead = featured ? rows[0] : null
  const rest = featured ? rows.slice(1) : rows
  const rankOffset = featured ? 2 : 1
  return (
    <BoardCard title={title}>
      {lead && (
        <FoulFeatured player={lead} cols={cols} cells={cells} favoriteTeamId={favoriteTeamId} positions={positions} />
      )}
      {rest.length > 0 && (
        <div className="ledger-wrap">
          <table className="standings foulboard">
            <thead>
              <tr>
                <th className="team">Player</th>
                {cols.map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rest.map((r, i) => (
                <tr key={r.id} {...favRowProps(r.teamId, favoriteTeamId)}>
                  <td className="team">
                    <span className="umprank__rank">{i + rankOffset}</span>
                    <PlayerLink id={r.id} className="foulboard__rowname">{r.name}</PlayerLink>
                    <span className="foulboard__team">{teamAbbr({ id: r.teamId })}</span>
                  </td>
                  {cells(r).map((v, j) => (
                    <td key={j}>{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </BoardCard>
  )
}

// A result that reaches base or otherwise helps the batter's own line — the
// user-facing "good outcome" set (hits, walks, HBP, a productive sac fly);
// everything else (every out, however it's recorded, plus reaching on an
// error — not credited as the batter's own doing) reads negative. Keyed on
// the feed's machine eventType (see gen-fouls.mjs's resultType), not the
// human-readable event string, so this can't be fooled by "Sac Fly" vs.
// "Sac Bunt" wording drift the way string-matching would be.
const POSITIVE_RESULT_TYPES = new Set([
  'single', 'double', 'triple', 'home_run',
  'walk', 'intent_walk', 'hit_by_pitch', 'sac_fly', 'catcher_interf',
])

// A compact scorebug for the single most-fouled AT-BAT of the season — the
// same information a broadcast graphic would carry: both teams' score, the
// inning, the base/out state ENTERING the at-bat (see gen-fouls.mjs's header
// comment on why that's the PRIOR play's post-state), who was on the mound,
// and how the at-bat actually ended.
function PaScorebug({ pa }) {
  const hisScore = pa.half === 'top' ? pa.awayScore : pa.homeScore
  const oppScore = pa.half === 'top' ? pa.homeScore : pa.awayScore
  const outs = pa.outs ?? 0
  const positive = POSITIVE_RESULT_TYPES.has(pa.resultType)
  return (
    <div className="scorebug">
      <div className="scorebug__score">
        <span className="scorebug__team scorebug__team--his">
          <TeamLogo teamId={pa.battingTeamId} name={teamAbbr({ id: pa.battingTeamId })} size={16} />
          {teamAbbr({ id: pa.battingTeamId })}
          <b>{hisScore}</b>
        </span>
        <span className="scorebug__team">
          <TeamLogo teamId={pa.opponentId} name={teamAbbr({ id: pa.opponentId })} size={16} />
          {teamAbbr({ id: pa.opponentId })}
          <b>{oppScore}</b>
        </span>
        <span className="scorebug__inning">
          <span className={`scorebug__arrow ${pa.half === 'top' ? 'is-top' : 'is-bottom'}`} aria-hidden="true">
            {pa.half === 'top' ? '▲' : '▼'}
          </span>
          {ordinal(pa.inning)}
        </span>
      </div>
      <div className="scorebug__situation">
        <BaseoutDiamond size={30} bases={[!!pa.onFirst, !!pa.onSecond, !!pa.onThird]} />
        <span className="scorebug__outs" role="img" aria-label={`${outs} ${outs === 1 ? 'out' : 'outs'}`}>
          {[0, 1, 2].map((i) => (
            <span key={i} className={`scorebug__outdot ${i < outs ? 'is-out' : ''}`} />
          ))}
        </span>
      </div>
      {pa.resultEvent && (
        <span className={`scorebug__result ${positive ? 'is-positive' : 'is-negative'}`}>{pa.resultEvent}</span>
      )}
    </div>
  )
}

// A STORY (one specific at-bat), not a ranking — so unlike FoulLeaderBoard
// above, every row gets the fuller headshot treatment rather than just the
// rank-1 leader. `bug` renders a rich node (PaScorebug) below the header row —
// the only caller left is Most-Fouls-In-A-PA, whose situational data is rich
// enough to earn the widget.
function FoulStoryBoard({ title, rows, value, bug, favoriteTeamId }) {
  if (!rows || rows.length === 0) return null
  return (
    <BoardCard title={title}>
      <ol className="sgh-list">
        {rows.map((b) => {
          const pa = b.bestPa
          return (
            <li className="sgh-row" key={b.id} {...favRowProps(b.teamId, favoriteTeamId)}>
              <Headshot personId={b.id} name={b.name} teamId={b.teamId} className="sgh-shot sgh-shot--xl" />
              <div className="sgh-body">
                <div className="sgh-header">
                  <div className="sgh-namewrap">
                    <div className="sgh-top">
                      <PlayerLink id={b.id} className="sgh-name">
                        {b.name}
                      </PlayerLink>
                      <span className="foulboard__team">{teamAbbr({ id: b.teamId })}</span>
                    </div>
                    <div className="sgh-sub">
                      vs {pa.pitcherId ? <PlayerLink id={pa.pitcherId}>{pa.pitcherName}</PlayerLink> : pa.pitcherName}
                    </div>
                  </div>
                  <span className="sgh-valstack">
                    <span className="sgh-val">{value(b)}</span>
                    <span className="sgh-vallabel">Fouls</span>
                  </span>
                </div>
                {bug(b)}
              </div>
            </li>
          )
        })}
      </ol>
    </BoardCard>
  )
}

// Single-game highs is ALSO a story, not a ranking, but reads as a compact
// scorebug-style ledger row rather than a sentence: who, the game's final
// score + date (the same logos-and-score idiom FirstScorebookPage's
// gamegrid uses for "recap this game" — see ScorebookGameLink), then the
// at-bat's workload as three stat tiles (same `.stat`/`.stat__v`/`.stat__k`
// idiom StatBox's Insights row uses on the innings page) so PA/pitches-seen/
// fouls read as one consistent line rather than a prose sentence.
function GameHighBoard({ title, rows, favoriteTeamId, gameLinks, positions }) {
  if (!rows || rows.length === 0) return null
  return (
    <BoardCard title={title}>
      <ol className="sgh-list">
        {rows.map((b) => (
          <GameHighRow key={b.id} b={b} favoriteTeamId={favoriteTeamId} gameLinks={gameLinks} positions={positions} />
        ))}
      </ol>
    </BoardCard>
  )
}

// The score+date badge links to that game's box score once the batched
// schedule lookup (FoulTrackerPage's gameLinks, keyed by gamePk) resolves —
// until then, or if the lookup failed, it renders as a plain non-clickable
// badge (same degrade-gracefully rule the rest of the app applies to any
// dependent fetch).
function GameHighRow({ b, favoriteTeamId, gameLinks, positions }) {
  const navigate = useNav()
  const hasScore = b.maxGameHisScore != null && b.maxGameOppScore != null
  const link = b.maxGamePk != null ? gameLinks?.[b.maxGamePk] : null
  const MatchupTag = link ? 'button' : 'div'
  const matchupProps = link
    ? {
        type: 'button',
        onClick: () => navigate(gamePath(link.apiDate, link.awayAbbr, link.homeAbbr, 'boxscore', link.gameNumber)),
      }
    : {}
  const { first, last } = splitDisplayName(b.name)
  const position = positions?.[b.id]
  const isNew = isWithinDays(b.maxGameDate, 7)
  return (
    <li className="sgh-row gamehigh-row" {...favRowProps(b.teamId, favoriteTeamId)}>
      <Headshot personId={b.id} name={b.name} teamId={b.teamId} className="sgh-shot sgh-shot--lg" />
      <div className="gamehigh-who">
        <PlayerLink id={b.id} className="sgh-name gamehigh-name">
          {first && <span className="foulboard__heroname-first">{first}</span>}
          <span className="foulboard__heroname-last">{last}</span>
        </PlayerLink>
        <p className="foulboard__herometa">
          {position && <span className="foulboard__heropos">{position}</span>}
          {position && ' · '}
          <TeamLink id={b.teamId} className="foulboard__heroteamname">
            {teamAbbr({ id: b.teamId })}
          </TeamLink>
        </p>
      </div>
      <MatchupTag className="gamehigh-matchup" {...matchupProps}>
        {isNew && (
          <span className="gamehigh-newstamp" aria-label="Within the last 7 days">
            New!
          </span>
        )}
        {hasScore && (
          <span className="gamehigh-matchup__score">
            <TeamLogo teamId={b.teamId} name={teamAbbr({ id: b.teamId })} size={20} />
            <b>{b.maxGameHisScore}</b>
            <span className="gamehigh-matchup__sep">–</span>
            <b>{b.maxGameOppScore}</b>
            <TeamLogo teamId={b.maxGameOpponentId} name={teamAbbr({ id: b.maxGameOpponentId })} size={20} />
          </span>
        )}
        {b.maxGameDate && (
          <span className="gamehigh-matchup__date">
            {weekdayAbbr(b.maxGameDate)} {monthDayYear(b.maxGameDate)}
          </span>
        )}
      </MatchupTag>
      <div className="gamehigh-tiles">
        <div className="stat">
          <span className="stat__v">{b.maxGamePa || '—'}</span>
          <span className="stat__k">PA</span>
        </div>
        <div className="stat">
          <span className="stat__v">{b.maxGamePitches || '—'}</span>
          <span className="stat__k">Pitches seen</span>
        </div>
        <div className="stat">
          <span className="stat__v">{b.maxGameFouls}</span>
          <span className="stat__k">Fouls</span>
        </div>
      </div>
    </li>
  )
}

// Best Souvenir Odds — ranks GAMES, not players, by both teams' combined
// fouls: more fouls hit means more balls that left play unfielded, so these
// are the games a fan sitting anywhere near foul territory had the best shot
// at going home with a keepsake. Unlike Single-Game Highs (GameHighBoard
// above) — a two-line grid because a headshot+name needs the room — a game
// has no photo to anchor, so everything (rank, both teams, the fouls split,
// the date) fits on ONE line; only .gamehigh-matchup's date-badge chrome and
// .stat's tile look are reused, not the two-row grid shape itself.
function SouvenirGameBoard({ title, rows, gameLinks }) {
  if (!rows || rows.length === 0) return null
  return (
    <BoardCard title={title}>
      <ol className="sgh-list">
        {rows.map((g, i) => (
          <SouvenirGameRow key={g.gamePk} g={g} rank={i + 1} gameLinks={gameLinks} />
        ))}
      </ol>
    </BoardCard>
  )
}

function SouvenirGameRow({ g, rank, gameLinks }) {
  const navigate = useNav()
  const link = gameLinks?.[g.gamePk]
  const MatchupTag = link ? 'button' : 'div'
  const matchupProps = link
    ? {
        type: 'button',
        onClick: () => navigate(gamePath(link.apiDate, link.awayAbbr, link.homeAbbr, 'boxscore', link.gameNumber)),
      }
    : {}
  const isNew = isWithinDays(g.date, 7)
  return (
    <li className="sgh-row souvenir-row">
      <span className="umprank__rank">{rank}</span>
      {/* Both teams are already identified by the score badge's logos below —
          a separate name/logo column here was pure duplication. */}
      <div className="souvenir-row__tiles">
        <div className="stat">
          <span className="stat__v">{g.awayFouls}</span>
          <span className="stat__k">{teamClubName(g.awayTeamId)}</span>
        </div>
        <div className="stat">
          <span className="stat__v">{g.homeFouls}</span>
          <span className="stat__k">{teamClubName(g.homeTeamId)}</span>
        </div>
        <div className="stat">
          <span className="stat__v">{g.totalFouls}</span>
          <span className="stat__k">Total</span>
        </div>
      </div>
      {/* Same score+date badge idiom as GameHighRow above (gamehigh-matchup__score/
          __sep/__date) — a fan scanning both boards should recognize a final
          score in the same shape everywhere on this page, not a one-off. */}
      <MatchupTag className="gamehigh-matchup souvenir-row__date" {...matchupProps}>
        {isNew && (
          <span className="gamehigh-newstamp" aria-label="Within the last 7 days">
            New!
          </span>
        )}
        <span className="gamehigh-matchup__score">
          <TeamLogo teamId={g.awayTeamId} name={teamAbbr({ id: g.awayTeamId })} size={20} />
          <b>{g.awayScore}</b>
          <span className="gamehigh-matchup__sep">–</span>
          <b>{g.homeScore}</b>
          <TeamLogo teamId={g.homeTeamId} name={teamAbbr({ id: g.homeTeamId })} size={20} />
        </span>
        {g.date && (
          <span className="gamehigh-matchup__date">
            {weekdayAbbr(g.date)} {monthDayYear(g.date)}
          </span>
        )}
      </MatchupTag>
    </li>
  )
}

// A hero stat leading the page — the numbers every leaderboard below assumes
// the reader already has context for, read as a sentence rather than a bare
// figure. `league.totals` is the whole (unfiltered) season's pitch/foul sums
// (see gen-fouls.mjs's exportFouls), so this reads the same regardless of the
// team filter, same as ByInning/ByPitchType below it. `avgFoulsPerPA` sums
// EVERY batter's own season `pa` (data.batters has no minimum-games floor,
// unlike the leaderboards below, so this total is the true league PA count).
// `avgFoulsPerStart` reuses byInning's own vsStarter split (the same "was a
// starter on the mound" cut ByInning renders) rather than each pitcher's own
// season totals, since a pitcher's `g`/`fouls` mix starts AND any relief
// appearances together — vsStarter.fouls is already scoped to starter innings
// only. Total starts is gamesIngested * 2 (exactly one starter per team per
// game) — nothing in the precompute tracks a league-wide start COUNT directly.
// The fill bar is a genuine proportion (this share of an average game's
// PITCHES got fouled off), not decoration.
function SeasonAverageCard({ data }) {
  const league = data?.league
  const gamesIngested = data?.gamesIngested
  if (!league?.totals || !gamesIngested) return null
  const avgFouls = league.totals.fouls / gamesIngested
  const avgPitches = league.totals.pitches / gamesIngested
  const foulRate = league.totals.pitches > 0 ? league.totals.fouls / league.totals.pitches : 0

  const totalPA = Object.values(data?.batters ?? {}).reduce((s, b) => s + (b.pa || 0), 0)
  const avgFoulsPerPA = totalPA > 0 ? league.totals.fouls / totalPA : null

  const starterFouls = (league.byInning ?? []).reduce((s, r) => s + (r.vsStarter?.fouls ?? 0), 0)
  const totalStarts = gamesIngested * 2
  const avgFoulsPerStart = totalStarts > 0 ? starterFouls / totalStarts : null

  return (
    <div className="foulavg">
      <p className="foulavg__lede">
        There are <b>{Math.round(avgPitches)}</b> pitches thrown in an average MLB game and{' '}
        <b>{Math.round(avgFouls)}</b> are fouled off ({pct1(foulRate)}). The average plate appearance features{' '}
        <b>{avgFoulsPerPA == null ? '—' : avgFoulsPerPA.toFixed(1)}</b> foul balls, and a starting pitcher averages{' '}
        <b>{avgFoulsPerStart == null ? '—' : avgFoulsPerStart.toFixed(1)}</b> foul balls per start.
      </p>
      <div
        className="foulavg__meter"
        role="img"
        aria-label={`${pct1(foulRate)} of an average game's pitches are fouled off`}
      >
        <span className="foulavg__fill" style={{ width: `${Math.min(foulRate * 100, 100).toFixed(1)}%` }} />
      </div>
    </div>
  )
}

// The by-inning foul curve — does fouling spike late? — split vs. starters
// and vs. relievers. This chart doesn't exist anywhere else in public
// baseball data, which is half the fun of publishing it.
function ByInning({ league }) {
  const rows = league?.byInning ?? []
  if (rows.length === 0) return null
  const max = Math.max(...rows.map((r) => (r.pitches > 0 ? r.fouls / r.pitches : 0)))
  return (
    <BoardCard title="Foul rate by inning">
      <div className="ledger-wrap">
        <table className="standings foulboard">
          <thead>
            <tr>
              <th className="team">Inning</th>
              <th className="foulboard__barcol" aria-hidden="true"></th>
              <th>All</th>
              <th>Starters</th>
              <th>Bullpen</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const rate = r.pitches > 0 ? r.fouls / r.pitches : 0
              const sp = r.vsStarter?.pitches > 0 ? r.vsStarter.fouls / r.vsStarter.pitches : null
              const rp = r.vsReliever?.pitches > 0 ? r.vsReliever.fouls / r.vsReliever.pitches : null
              return (
                <tr key={r.inning}>
                  <td className="team">{r.inning >= 10 ? '10+' : r.inning}</td>
                  <td className="foulboard__barcol">
                    <span
                      className="foulboard__bar"
                      style={{ width: max > 0 ? `${(rate / max) * 100}%` : 0 }}
                    />
                  </td>
                  <td>{pct1(rate)}</td>
                  <td>{sp == null ? '—' : pct1(sp)}</td>
                  <td>{rp == null ? '—' : pct1(rp)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </BoardCard>
  )
}

// The standard Statcast/FanGraphs pitch-family grouping — codes not listed
// fall into 'Other' (knuckleball, eephus, and anything the feed hasn't
// labeled yet) rather than erroring, same defensive-fallback rule the rest of
// the app applies to feed fields. FC (cutter) rides with the fastballs — it's
// thrown from the fastball grip/arm-slot, unlike the breaking pitches below.
const PITCH_CATEGORY = {
  FF: 'Fastballs', FA: 'Fastballs', FT: 'Fastballs', SI: 'Fastballs', FC: 'Fastballs',
  SL: 'Breaking balls', CU: 'Breaking balls', KC: 'Breaking balls', CS: 'Breaking balls',
  ST: 'Breaking balls', SV: 'Breaking balls', SC: 'Breaking balls',
  CH: 'Offspeed', FS: 'Offspeed', FO: 'Offspeed',
}
const PITCH_CATEGORY_ORDER = ['Fastballs', 'Breaking balls', 'Offspeed', 'Other']

// Team-view sample floor — MUCH lower than the league table's 500, since one
// club's own season volume for a single pitch type is a fraction of the
// league's (a rare pitch like a splitter might only see a few hundred pitches
// against/from one team all year).
const MIN_TEAM_PITCH_COUNT = 30

// A batting/pitching foul-rate gap this wide (5 percentage points) or more is
// worth flagging automatically — foul rates cluster in a fairly narrow 10-30%
// band leaguewide, so a 5-point split between a team's own two sides is a
// real outlier, not sampling noise.
const SIGNIFICANT_RATE_GAP = 0.05

// Merges a team's battingRates/pitchingRates (from teamPitchTypeRates) into
// one row per pitch code the team saw on EITHER side, each carrying a raw
// pitch count (seen/thrown) plus a foul% and whiff% — both pure rates, not a
// count riding along in the same cell — independently per side (null/dash if
// that side never reached the floor). `isOutlier` flags a foul%-gap wide
// enough to call out automatically (see SIGNIFICANT_RATE_GAP) — only
// computable when BOTH sides cleared the sample floor, never from one lone
// side.
function buildTeamPitchTypeRows(rates) {
  const battingByCode = new Map((rates?.batting ?? []).map((r) => [r.code, r]))
  const pitchingByCode = new Map((rates?.pitching ?? []).map((r) => [r.code, r]))
  const codes = new Set([...battingByCode.keys(), ...pitchingByCode.keys()])
  const whiffRate = (whiffs, pitches) => (pitches > 0 ? whiffs / pitches : null)
  return [...codes]
    .map((code) => {
      const b = battingByCode.get(code)
      const p = pitchingByCode.get(code)
      const battingPitches = b?.pitches ?? 0
      const pitchingPitches = p?.pitches ?? 0
      const battingRate = b?.foulRate ?? null
      const pitchingRate = p?.foulRate ?? null
      const gap = battingRate != null && pitchingRate != null ? Math.abs(battingRate - pitchingRate) : null
      return {
        code,
        description: b?.description || p?.description || code,
        category: PITCH_CATEGORY[code] ?? 'Other',
        battingPitches,
        battingRate,
        battingWhiffRate: whiffRate(b?.whiffs ?? 0, battingPitches),
        pitchingPitches,
        pitchingRate,
        pitchingWhiffRate: whiffRate(p?.whiffs ?? 0, pitchingPitches),
        isOutlier: gap != null && gap >= SIGNIFICANT_RATE_GAP,
      }
    })
    .filter((r) => r.battingPitches >= MIN_TEAM_PITCH_COUNT || r.pitchingPitches >= MIN_TEAM_PITCH_COUNT)
}

// `teamRates` (from FoulTrackerPage's buildBoards, only set once a team
// filter is active) swaps the league-wide single-rate table for a two-sided
// batters-vs-pitchers comparison scoped to that club — the plain league rate
// stops being the interesting question once you've already narrowed to one
// team. Reverts to the league table the moment the filter clears.
function ByPitchType({ league, teamRates }) {
  if (teamRates) {
    const rows = buildTeamPitchTypeRows(teamRates)
    if (rows.length === 0) return null
    const groups = PITCH_CATEGORY_ORDER.map((category) => ({
      category,
      rows: rows
        .filter((r) => r.category === category)
        .sort((a, b) => b.battingPitches + b.pitchingPitches - (a.battingPitches + a.pitchingPitches)),
    })).filter((g) => g.rows.length > 0)
    return (
      <BoardCard title="Foul rate by pitch type">
        <div className="ledger-wrap">
          <table className="standings foulboard">
            <tbody>
              {groups.map((g) => (
                <TeamPitchCategoryGroup key={g.category} group={g} />
              ))}
            </tbody>
          </table>
        </div>
      </BoardCard>
    )
  }

  const rows = (league?.byPitchType ?? [])
    .filter((r) => r.pitches >= 500)
    .map((r) => ({ ...r, rate: r.fouls / r.pitches, category: PITCH_CATEGORY[r.code] ?? 'Other' }))
  if (rows.length === 0) return null
  const groups = PITCH_CATEGORY_ORDER.map((category) => ({
    category,
    rows: rows.filter((r) => r.category === category).sort((a, b) => b.rate - a.rate),
  })).filter((g) => g.rows.length > 0)
  return (
    <BoardCard title="Foul rate by pitch type">
      <div className="ledger-wrap">
        <table className="standings foulboard">
          <tbody>
            {groups.map((g) => (
              <PitchCategoryGroup key={g.category} group={g} />
            ))}
          </tbody>
        </table>
      </div>
    </BoardCard>
  )
}

// Same kraft-brown subheader shape as PitchCategoryGroup below, but split into
// two 3-column groups (batters' own vs. pitchers' own): a raw pitch count
// leads each side (# seen for batters, # thrown for pitchers), then foul% and
// whiff% follow as plain percentages — no count riding along in either rate
// cell, so every number in a rate column is directly comparable to the one
// above/below it. A row whose two foul% figures diverge by SIGNIFICANT_
// RATE_GAP or more gets the same amber "outlier" wash the umpire favor-meter
// uses elsewhere in the app (.favormeter--outlier) — reused so "notable, look
// here" reads the same way anywhere in the app rather than inventing a new
// accent.
function TeamPitchCategoryGroup({ group }) {
  return (
    <>
      <tr className="foulboard__grouprow foulboard__grouprow--kraft">
        <th colSpan={7} scope="rowgroup">
          {group.category}
        </th>
      </tr>
      <tr className="foulboard__subhead">
        <th className="team">Pitch</th>
        <th># Seen</th>
        <th>Batters Foul%</th>
        <th>Batters Whiff%</th>
        <th># Thrown</th>
        <th>Pitchers Foul%</th>
        <th>Pitchers Whiff%</th>
      </tr>
      {group.rows.map((r) => (
        <tr key={r.code} className={r.isOutlier ? 'foulboard__row--outlier' : undefined}>
          <td className="team">{r.description || r.code}</td>
          <td>{r.battingPitches > 0 ? r.battingPitches.toLocaleString('en-US') : '—'}</td>
          <td>{r.battingRate == null ? '—' : pct1(r.battingRate)}</td>
          <td>{r.battingWhiffRate == null ? '—' : pct1(r.battingWhiffRate)}</td>
          <td>{r.pitchingPitches > 0 ? r.pitchingPitches.toLocaleString('en-US') : '—'}</td>
          <td>{r.pitchingRate == null ? '—' : pct1(r.pitchingRate)}</td>
          <td>{r.pitchingWhiffRate == null ? '—' : pct1(r.pitchingWhiffRate)}</td>
        </tr>
      ))}
    </>
  )
}

// One pitch-family's kraft-brown subheader row (spans the table), its OWN
// repeated Pitch/Foul%/Pitches column header, then its pitch-type rows — a
// real <tbody> boundary per group so the row-divider rules (owned by
// .standings/.ledger's shared background gradient) don't have to special-case
// the subheaders visually. The column header repeats under every category
// (rather than once at the table's top) since a reader scanning straight to
// "Breaking balls" shouldn't have to scroll back up to remember which column
// is which.
function PitchCategoryGroup({ group }) {
  return (
    <>
      <tr className="foulboard__grouprow foulboard__grouprow--kraft">
        <th colSpan={3} scope="rowgroup">
          {group.category}
        </th>
      </tr>
      <tr className="foulboard__subhead">
        <th className="team">Pitch</th>
        <th>Foul%</th>
        <th>Pitches</th>
      </tr>
      {group.rows.map((r) => (
        <tr key={r.code}>
          <td className="team">{r.description || r.code}</td>
          <td>{pct1(r.rate)}</td>
          <td>{r.pitches.toLocaleString('en-US')}</td>
        </tr>
      ))}
    </>
  )
}

function TeamBoard({ teams, favoriteTeamId }) {
  if (!teams || teams.length === 0) return null
  return (
    <BoardCard title="Team fouls per game">
      <div className="ledger-wrap">
        <table className="standings foulboard foulboard--teams">
          <colgroup>
            <col className="foulboard--teams__teamcol" />
            <col />
            <col />
            <col />
            <col />
          </colgroup>
          <thead>
            <tr>
              <th className="team">Team</th>
              <th>Per game</th>
              <th>Fouls</th>
              <th>With 2 Strikes</th>
              <th>% With 2 Strikes</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((t, i) => (
              <tr key={t.id} {...favRowProps(t.id, favoriteTeamId)}>
                <td className="team">
                  <span className="umprank__rank">{i + 1}</span>
                  <TeamLogo teamId={t.id} name={teamAbbr({ id: t.id })} size={26} />
                  <span className="sr-only">{teamFullName(t.id)}</span>
                </td>
                <td>{(t.fouls / t.g).toFixed(1)}</td>
                <td>{t.fouls.toLocaleString('en-US')}</td>
                <td>{t.twoStrikeFouls.toLocaleString('en-US')}</td>
                <td>{t.fouls > 0 ? pct1(t.twoStrikeFouls / t.fouls) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </BoardCard>
  )
}
