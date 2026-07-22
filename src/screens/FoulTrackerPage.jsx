import { useMemo } from 'react'
import { fetchFouls } from '../api/fouls.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { splitDisplayName } from '../api/person.js'
import { monthDay } from '../lib/dates.js'
import { ordinal } from '../lib/format.js'
import { SiteHeader } from '../components/SiteHeader.jsx'
import { AsyncStatus } from '../components/AsyncGate.jsx'
import { PlayerLink } from '../components/PlayerLink.jsx'
import { Headshot } from '../components/Headshot.jsx'
import { TeamLogo } from '../components/TeamLogo.jsx'
import { SectionMasthead } from '../components/SectionMasthead.jsx'
import { BaseoutDiamond } from '../components/BaseoutDiamond.jsx'
import { teamAbbr } from '../lib/teams.js'

// The Foul Tracker — season-long foul-ball counting nobody else publishes:
// league leaders (total, per game, single-game highs), two-strike "spoiling",
// pitcher foul magnets, the by-inning foul curve with its starter-vs-bullpen
// split, and foul rate by pitch type. Everything reads the nightly
// gen-fouls.mjs precompute (completed games only — spoiler-free, no SealBox;
// see src/api/fouls.js). MLB only; the page says so rather than pretending
// MiLB coverage exists.
//
// Each player leaderboard features its #1 entry as a headshot card (same
// `.shot`/`.tlead__featured` idiom TeamLeaders uses elsewhere — see
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

export function FoulTrackerPage() {
  useDocumentTitle('Foul Tracker')
  const { loading, error, data } = useAsync(() => fetchFouls(), [])

  const boards = useMemo(() => buildBoards(data), [data])

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
        <>
          <FoulLeaderBoard
            title="Most fouls"
            rows={boards.batterTotal}
            cols={['Fouls', 'Per game', '2-Str']}
            cells={(b) => [b.fouls, (b.fouls / b.g).toFixed(1), b.twoStrikeFouls]}
            featured
          />
          <FoulLeaderBoard
            title="Most fouls per game"
            note={`Minimum ${boards.minGames} games.`}
            rows={boards.batterRate}
            cols={['Per game', 'Fouls', '2-Str']}
            cells={(b) => [(b.fouls / b.g).toFixed(2), b.fouls, b.twoStrikeFouls]}
            featured
          />

          <FoulStoryBoard
            title="Single-game highs"
            note="The most fouls hit by one batter in a single game this season."
            rows={boards.gameHighs}
            value={(b) => b.maxGameFouls}
            summary={gameHighSummary}
          />

          <FoulStoryBoard
            title="Most fouls in one plate appearance"
            note="The most foul balls a batter has fought off in a single at-bat this season."
            rows={boards.paHighs}
            value={(b) => b.bestPa.fouls}
            bug={(b) => <PaScorebug pa={b.bestPa} />}
          />

          <FoulLeaderBoard
            title="Foul magnets — pitchers"
            note="Share of a pitcher’s pitches fouled off. High foul, low whiff usually means hitters are missing the barrel, not the ball."
            rows={boards.pitcherRate}
            cols={['Foul%', 'Fouls', 'Per whiff']}
            cells={(p) => [
              pct1(p.fouls / p.pitches),
              p.fouls,
              p.whiffs > 0 ? (p.fouls / p.whiffs).toFixed(1) : '—',
            ]}
            featured
          />

          <ByInning league={boards.league} />
          <ByPitchType league={boards.league} />
          <TeamBoard teams={boards.teamRows} />
        </>
      )}
    </div>
  )
}

// Sorted boards from the raw precompute maps. Null when the file is missing
// or empty — the page then shows its empty state.
function buildBoards(data) {
  const batters = Object.entries(data?.batters ?? {}).map(([id, b]) => ({ id, ...b }))
  if (batters.length === 0) return null
  const pitchers = Object.entries(data?.pitchers ?? {}).map(([id, p]) => ({ id, ...p }))

  // Playing-time floors scale with the season so the page works in April too.
  const maxG = Math.max(...batters.map((b) => b.g))
  const minGames = Math.max(5, Math.round(maxG * 0.5))
  const qualified = batters.filter((b) => b.g >= minGames)
  const qualifiedP = pitchers.filter((p) => (p.pitches ?? 0) >= 300)

  const top = (arr, keyFn, n = 12) => [...arr].sort((a, b) => keyFn(b) - keyFn(a)).slice(0, n)

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
    league: data?.league ?? null,
    teamRows: Object.entries(data?.teams ?? {})
      .map(([id, t]) => ({ id: Number(id), ...t }))
      .sort((a, b) => b.fouls / b.g - a.fouls / a.g),
  }
}

// Every board on this page wears the same navy/gold masthead the rest of the
// app's card sections use (Lineup Strength, Bullpen Tonight, batting order,
// …) — the container owns the border/radius/shadow, the masthead caps it,
// same convention as those.
function BoardCard({ title, note, children }) {
  return (
    <section className="metriccard foulboard-block">
      <SectionMasthead as="h2" title={title} />
      <div className="metriccard__body">
        {note && <p className="foulboard__note--body">{note}</p>}
        {children}
      </div>
    </section>
  )
}

// The rank-1 entry rendered as a headshot card — same `.shot`/`.tlead__cat`
// idiom TeamLeaders' FeaturedLeader uses (see src/CLAUDE.md's design-system
// notes), reused directly rather than reinvented, so a photo on this page
// looks exactly like a photo anywhere else in the app. `cols`/`cells` are the
// SAME descriptors the table beneath it uses — index 0 becomes the big
// headline stat, the rest ride as small chips — so a board's shape only has
// to be described once.
function FoulFeatured({ player, cols, cells }) {
  const { first, last } = splitDisplayName(player.name)
  const values = cells(player)
  return (
    <div className="tlead__cat foulboard__featuredcard">
      <div className="tlead__featured">
        <Headshot personId={player.id} name={player.name} teamId={player.teamId} className="tlead__shot" />
        <div className="tlead__who">
          <PlayerLink id={player.id} className="tlead__name">
            {first && <span className="tlead__name-first">{first}</span>}
            <span className="tlead__name-last">{last}</span>
          </PlayerLink>
          <div className="tlead__stat">
            <span className="tlead__statval">{values[0]}</span>
            <span className="tlead__statlabel">{cols[0]}</span>
          </div>
        </div>
        <TeamLogo
          teamId={player.teamId}
          name={teamAbbr({ id: player.teamId })}
          size={28}
          className="tlead__logo foulboard__featuredteam"
        />
      </div>
      {cols.length > 1 && (
        <div className="foulboard__featuredextra">
          {cols.slice(1).map((c, j) => (
            <span key={c} className="foulboard__featuredchip">
              <b>{values[j + 1]}</b> {c}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// `featured`: pulls rank 1 out into a FoulFeatured headshot card above the
// table, which then starts numbering at 2 — the featured card IS his row, so
// the table never shows him twice.
function FoulLeaderBoard({ title, note, rows, cols, cells, featured = false }) {
  if (!rows || rows.length === 0) return null
  const lead = featured ? rows[0] : null
  const rest = featured ? rows.slice(1) : rows
  const rankOffset = featured ? 2 : 1
  return (
    <BoardCard title={title} note={note}>
      {lead && <FoulFeatured player={lead} cols={cols} cells={cells} />}
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
                <tr key={r.id}>
                  <td className="team">
                    <span className="umprank__rank">{i + rankOffset}</span>
                    <PlayerLink id={r.id}>{r.name}</PlayerLink>{' '}
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

// Single-game highs and Most-fouls-in-a-PA are both STORIES (one specific
// game or at-bat), not rankings — so unlike FoulLeaderBoard above, every row
// gets the fuller headshot + narrated-context treatment rather than just the
// rank-1 leader. Reads in the order the thing actually happened: when/
// against whom, how much work the at-bats took, then how many of those
// pitches got fouled off — the number that made the board.
function gameHighSummary(b) {
  const scene = []
  if (b.maxGameDate) scene.push(monthDay(b.maxGameDate))
  if (b.maxGameOpponentId) scene.push(`vs ${teamAbbr({ id: b.maxGameOpponentId })}`)

  const workload = []
  if (b.maxGamePa) workload.push(`${b.maxGamePa} PA`)
  if (b.maxGamePitches) workload.push(`${b.maxGamePitches} pitches seen`)

  const parts = []
  if (scene.length) parts.push(scene.join(' '))
  if (workload.length) parts.push(workload.join(', '))
  if (b.maxGameFouls && b.maxGamePitches) parts.push(`${b.maxGameFouls} fouled off`)

  return parts.join(' · ')
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
        <span className="scorebug__pitcher">
          vs {pa.pitcherId ? <PlayerLink id={pa.pitcherId}>{pa.pitcherName}</PlayerLink> : pa.pitcherName}
        </span>
      </div>
      {pa.resultEvent && (
        <span className={`scorebug__result ${positive ? 'is-positive' : 'is-negative'}`}>{pa.resultEvent}</span>
      )}
    </div>
  )
}

// `bug`, when given, renders a rich node (PaScorebug) below the header row
// INSTEAD of a plain-language `summary` sentence — used only where the
// situational data is rich enough to earn a visual widget.
function FoulStoryBoard({ title, note, rows, value, summary, bug }) {
  if (!rows || rows.length === 0) return null
  return (
    <BoardCard title={title} note={note}>
      <ol className="sgh-list">
        {rows.map((b) => (
          <li className="sgh-row" key={b.id}>
            <Headshot personId={b.id} name={b.name} teamId={b.teamId} className="sgh-shot" />
            <div className="sgh-body">
              <div className="sgh-top">
                <PlayerLink id={b.id} className="sgh-name">
                  {b.name}
                </PlayerLink>
                <span className="foulboard__team">{teamAbbr({ id: b.teamId })}</span>
                <span className="sgh-valstack">
                  <span className="sgh-val">{value(b)}</span>
                  <span className="sgh-vallabel">Fouls</span>
                </span>
              </div>
              {bug ? bug(b) : <div className="sgh-sub">{summary(b)}</div>}
            </div>
          </li>
        ))}
      </ol>
    </BoardCard>
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
    <BoardCard
      title="Foul rate by inning"
      note="Share of pitches fouled off, and how it splits against starters vs. bullpen arms. Innings ten and beyond fold into the last row."
    >
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

function ByPitchType({ league }) {
  const rows = (league?.byPitchType ?? [])
    .filter((r) => r.pitches >= 500)
    .map((r) => ({ ...r, rate: r.fouls / r.pitches }))
    .sort((a, b) => b.rate - a.rate)
  if (rows.length === 0) return null
  return (
    <BoardCard title="Foul rate by pitch type" note="Which pitches get spoiled the most.">
      <div className="ledger-wrap">
        <table className="standings foulboard">
          <thead>
            <tr>
              <th className="team">Pitch</th>
              <th>Foul%</th>
              <th>Pitches</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.code}>
                <td className="team">{r.description || r.code}</td>
                <td>{pct1(r.rate)}</td>
                <td>{r.pitches}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </BoardCard>
  )
}

function TeamBoard({ teams }) {
  if (!teams || teams.length === 0) return null
  return (
    <BoardCard title="Team fouls per game" note="Fouls hit by each club’s batters.">
      <div className="ledger-wrap">
        <table className="standings foulboard">
          <thead>
            <tr>
              <th className="team">Team</th>
              <th>Per game</th>
              <th>Fouls</th>
              <th>2-Str</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((t, i) => (
              <tr key={t.id}>
                <td className="team">
                  <span className="umprank__rank">{i + 1}</span>
                  {teamAbbr({ id: t.id })}
                </td>
                <td>{(t.fouls / t.g).toFixed(1)}</td>
                <td>{t.fouls}</td>
                <td>{t.twoStrikeFouls}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </BoardCard>
  )
}
