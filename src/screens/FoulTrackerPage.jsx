import { useMemo, useState } from 'react'
import { fetchFouls } from '../api/fouls.js'
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
import { useFavoriteTeam } from '../hooks/useFavoriteTeam.js'
import { teamAbbr, teamFullName, favoriteAccentColor } from '../lib/teams.js'

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

  // Single-Game-Highs' score+date badge links out to that game's box score —
  // the precompute only carries the gamePk (see gen-fouls.mjs's max_game_pk),
  // not which side was home/away, so a batched schedule lookup resolves the
  // away/home abbreviations gamePath needs. Same fetchGamesByPk batching
  // loadPlayer.js uses for its own game-log deep links. Degrades to {} on
  // failure — a plain, non-clickable date badge, not a crash.
  const gameHighPks = useMemo(
    () => (boards?.gameHighs ?? []).map((b) => b.maxGamePk).filter(Boolean),
    [boards],
  )
  const { data: gameLinks } = useAsync(() => fetchGamesByPk(gameHighPks), [gameHighPks])

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
            favoriteTeamId={favoriteTeamId}
            positions={positions}
          />
          <FoulLeaderBoard
            title="Most fouls per game"
            rows={boards.batterRate}
            cols={['Per game', 'Fouls', 'With 2 Strikes']}
            cells={(b) => [(b.fouls / b.g).toFixed(2), b.fouls, b.twoStrikeFouls]}
            featured
            favoriteTeamId={favoriteTeamId}
            positions={positions}
          />

          <GameHighBoard
            title="Single-game highs"
            rows={boards.gameHighs}
            favoriteTeamId={favoriteTeamId}
            gameLinks={gameLinks}
            positions={positions}
          />

          <FoulStoryBoard
            title="Most fouls in one plate appearance"
            rows={boards.paHighs}
            value={(b) => b.bestPa.fouls}
            bug={(b) => <PaScorebug pa={b.bestPa} />}
            favoriteTeamId={favoriteTeamId}
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
            favoriteTeamId={favoriteTeamId}
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
            favoriteTeamId={favoriteTeamId}
            positions={positions}
          />

          <ByInning league={boards.league} />
          <ByPitchType league={boards.league} />
          <TeamBoard teams={boards.teamRows} favoriteTeamId={favoriteTeamId} />
        </>
      )}
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
    paHighs: top(
      batters.filter((b) => (b.bestPa?.fouls ?? 0) > 0),
      (b) => b.bestPa.fouls,
    ),
    pitcherRate: top(qualifiedP, (p) => p.fouls / p.pitches),
    pitcherRateLow: bottom(qualifiedP, (p) => p.fouls / p.pitches),
    league: data?.league ?? null,
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

function ByPitchType({ league }) {
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
          <td>{r.pitches}</td>
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
