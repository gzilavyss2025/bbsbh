import { useMemo } from 'react'
import { fetchFouls } from '../api/fouls.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { splitDisplayName } from '../api/person.js'
import { monthDay } from '../lib/dates.js'
import { SiteHeader } from '../components/SiteHeader.jsx'
import { AsyncStatus } from '../components/AsyncGate.jsx'
import { PlayerLink } from '../components/PlayerLink.jsx'
import { Headshot } from '../components/Headshot.jsx'
import { TeamLogo } from '../components/TeamLogo.jsx'
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
// FoulFeatured below) with ranks 2+ as a plain ledger table beneath; Single-
// Game Highs is a different kind of content (one specific game, not a
// ranking) so every row gets the fuller headshot + date/opponent/PA/pitches
// treatment instead (see SingleGameHighs below).
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

      <p className="hint">
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

          <SingleGameHighs rows={boards.gameHighs} />

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
    pitcherRate: top(qualifiedP, (p) => p.fouls / p.pitches),
    league: data?.league ?? null,
    teamRows: Object.entries(data?.teams ?? {})
      .map(([id, t]) => ({ id: Number(id), ...t }))
      .sort((a, b) => b.fouls / b.g - a.fouls / a.g),
  }
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
    <div className="foulboard-block">
      <h2 className="foulboard__caption foulboard-block__title">
        {title}
        {note ? <span className="foulboard__note"> {note}</span> : null}
      </h2>
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
    </div>
  )
}

// A single-game high is a STORY (one specific game), not a ranking — so
// unlike the boards above, every row here gets the fuller headshot +
// date/opponent/workload treatment rather than just the rank-1 leader.
// Reads in the order the game actually happened: when/against whom, how
// much work the at-bats took, then how many of those pitches got fouled
// off — the number that made the board — with his season total trailing
// as the "how unusual was this for HIM" context.
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

  const story = parts.join(' · ')
  return b.fouls ? `${story} — ${b.fouls} fouls this season` : story
}

function SingleGameHighs({ rows }) {
  if (!rows || rows.length === 0) return null
  return (
    <div className="foulboard-block">
      <h2 className="foulboard__caption foulboard-block__title">
        Single-game highs
        <span className="foulboard__note"> The most fouls hit by one batter in a single game this season.</span>
      </h2>
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
                  <span className="sgh-val">{b.maxGameFouls}</span>
                  <span className="sgh-vallabel">Fouls</span>
                </span>
              </div>
              <div className="sgh-sub">{gameHighSummary(b)}</div>
            </div>
          </li>
        ))}
      </ol>
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
    <div className="ledger-wrap">
      <table className="standings foulboard">
        <caption className="foulboard__caption">
          Foul rate by inning
          <span className="foulboard__note">
            {' '}
            Share of pitches fouled off, and how it splits against starters vs. bullpen
            arms. Innings ten and beyond fold into the last row.
          </span>
        </caption>
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
  )
}

function ByPitchType({ league }) {
  const rows = (league?.byPitchType ?? [])
    .filter((r) => r.pitches >= 500)
    .map((r) => ({ ...r, rate: r.fouls / r.pitches }))
    .sort((a, b) => b.rate - a.rate)
  if (rows.length === 0) return null
  return (
    <div className="ledger-wrap">
      <table className="standings foulboard">
        <caption className="foulboard__caption">
          Foul rate by pitch type
          <span className="foulboard__note"> Which pitches get spoiled the most.</span>
        </caption>
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
  )
}

function TeamBoard({ teams }) {
  if (!teams || teams.length === 0) return null
  return (
    <div className="ledger-wrap">
      <table className="standings foulboard">
        <caption className="foulboard__caption">
          Team fouls per game
          <span className="foulboard__note"> Fouls hit by each club’s batters.</span>
        </caption>
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
  )
}
