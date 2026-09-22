import '../../../styles/report/chrome.css'
import '../../../styles/report/challenge-card.css'
import { useMemo, useState } from 'react'
import {
  clubChallengeBoard,
  EXPOSURE_KINDS,
} from '../../../api/around-the-game/absExposure.js'
import { useNav } from '../../../lib/nav.js'
import { absChallengesPath } from '../../../lib/route.js'
import { ScatterChart } from '../../../components/around-the-game/BroadcastBar.jsx'
import { PlayerLink } from '../../../components/player/PlayerLink.jsx'
import { Door } from '../../../components/ui/control/Door.jsx'

// THE TEAM HUB'S CHALLENGE CARD, on the Numbers tab — who on this club argues
// with the plate umpire, against how much baseball they see.
//
// THE CARD'S BEST FACT IS THAT THE TWO VIEWS DISAGREE. Milwaukee is last of
// thirty at the plate, 4.53 challenges per 1,000 pitches against a league 6.42,
// and third of thirty behind it at 1.50 per nine innings caught against 1.12 —
// the same club, two different habits, and neither figure is visible from the
// other. So the HEADLINE follows the chip rather than leading with the batter
// rate on both views.
//
// A SCATTER FOR THE HITTERS, A TABLE FOR THE CATCHERS. One dot a man, pitches
// seen against reviews called, with the league's own rate drawn as the
// diagonal a man would sit on if he argued at exactly the league's pace. Twelve
// of Milwaukee's thirteen regulars are under it, and that is a SHAPE — a list
// of thirteen rates says who argues most and hides it. Most clubs carry two or
// three catchers, so the same chart behind the plate is three dots and a line.
//
// THE TABLE IS NOT A REPETITION OF THE CHART. It is the only way to reach a
// player page from here — an SVG text node cannot be a link — and it gives the
// unlabelled dots their names. One direct label on the chart at most, on the
// one dot that is the story.
//
// THE RATE IS OVER EVERY MAN; THE DOTS ARE THE ONES WHO CLEAR THE FLOOR. Those
// are different populations on purpose, the same split the league board keeps:
// "this club challenges once every N times up" is a fact about the club, and a
// floor applied to it would report the habits of its regulars as the whole
// roster's. The floor is the league board's own, reused rather than invented,
// and the count that cleared it is printed.
//
// MLB AND TRIPLE-A, the two levels that run the rig. `level` names the file the
// rows came from AND the key inside it, so a club is only ever ranked against
// its own level — a Triple-A club is third of thirty in Triple-A, never against
// major-league clubs. Below Triple-A `data` is null and the card does not
// render, the same shape TeamRunValueCard takes for a club Savant runs no board
// for.
//
// A TRIPLE-A CLUB'S DOTS ARE A THINNER SLICE OF IT, and that is drawn, not
// hidden: its qualifiers hold 71.8% of the club's plate appearances against a
// major-league club's 84.2% (docs/abs-challenges.md §6). The count that cleared
// the floor is printed under the chart at both levels, which is where a reader
// sees it.

// How the two views are labelled. Held here rather than built off the kind's
// own `label`, because these are the chip words and they are the card's, not
// the league board's.
const VIEWS = { batter: 'At the plate', catcher: 'Behind it' }

// A round step that clears the widest value and never rules the plot like
// graph paper.
function ticksTo(max, count = 3) {
  const raw = max / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10
  const out = []
  for (let v = step; v <= max; v += step) {
    out.push({ value: v, label: v >= 1000 ? `${Math.round(v / 1000)}k` : String(Math.round(v)) })
  }
  return out
}

const num2 = (x) => (x == null ? '—' : x.toFixed(2))
const commas = (n) => (n == null ? '—' : Math.round(n).toLocaleString('en-US'))

// Same four lines TeamRunValueCard carries, for the same reason it carries
// them: an ordinal is a formatting rule and a shared export nothing else would
// call is a wider surface than two copies.
function ordinal(n) {
  const rest = n % 100
  if (rest >= 11 && rest <= 13) return `${n}th`
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
}

export function TeamChallengeCard({ data, teamId, clubName, level = 'MLB' }) {
  const navigate = useNav()
  const [view, setView] = useState('batter')

  const boards = useMemo(
    () =>
      Object.fromEntries(
        EXPOSURE_KINDS.map((k) => [k.key, clubChallengeBoard(data, teamId, k.key, level)]),
      ),
    [data, teamId, level],
  )

  const shown = boards[view]?.players.length ? view : 'batter'
  const board = boards[shown]
  if (!board || board.rate == null) return null

  const { kind, players, league } = board
  const scatter = shown === 'batter' && players.length > 2

  // The chart's own scale: the widest man on each axis, so the dots fill the
  // plot rather than huddling in one corner of a league-sized box.
  const maxX = Math.max(...players.map((p) => p.exposure), 1)
  const maxY = Math.max(...players.map((p) => p.calls), 1)

  return (
    <div className="thub-card chalcard">
      <h3 className="section__title">
        <span>Who challenges</span>
        <em>against what they see</em>
      </h3>

      {/* THE HEADLINE FOLLOWS THE CHIP. It led with the batter rate on both
          views in the first draft, which buried the one thing the card knows
          that no other page does. The rank sits on its own line from the
          figure it ranks. */}
      <p className="chalcard__rate">{num2(board.rate)}</p>
      <p className="chalcard__unit">Per {kind.ratePer === 9 ? '9 innings caught' : '1,000 pitches seen'}</p>
      <p className="chalcard__rank">
        {board.rank != null ? `${ordinal(board.rank)} of ${board.of} clubs` : '—'}
      </p>
      <p className="chalcard__league">League {num2(league)}</p>

      <div className="chalcard__views" role="group" aria-label="At the plate or behind it">
        {EXPOSURE_KINDS.map((k) => (
          <button
            key={k.key}
            type="button"
            className={`chalcard__view${k.key === shown ? ' is-on' : ''}`}
            aria-pressed={k.key === shown}
            onClick={() => setView(k.key)}
          >
            {VIEWS[k.key] ?? k.label}
          </button>
        ))}
      </div>

      {scatter ? (
        <ScatterChart
          points={players.map((p) => ({
            key: p.playerId,
            x: p.exposure,
            y: p.calls,
            label: p.playerId === board.leader?.playerId ? `${p.name} · ${p.calls}` : null,
          }))}
          maxX={maxX}
          maxY={maxY}
          // Four steps up, three across: a count axis that reaches 32 wants a
          // line every ten, and a pitch axis that reaches 2,700 wants one every
          // thousand. One `count` for both ruled the first like graph paper or
          // left it with a single line.
          yTicks={ticksTo(maxY, 4)}
          xTicks={ticksTo(maxX, 3)}
          slope={(league / kind.ratePer) * maxX}
          note="Pitches seen across, reviews called up"
          label={`Every ${clubName} hitter's reviews against the pitches he saw, with the league rate drawn as a diagonal`}
        />
      ) : null}

      <table className="chalcard__board">
        <thead>
          <tr>
            <th className="chalcard__who">
              Player
              <span className="chalcard__floor">
                {commas(board.players.length)} of {commas(board.roster)} with{' '}
                {commas(kind.floor)}+ {kind.unit}
              </span>
            </th>
            <th>{kind.seenLabel}</th>
            <th>Called</th>
            <th>Rate</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => (
            <tr key={p.playerId}>
              <th scope="row" className="chalcard__who">
                <PlayerLink id={p.playerId} name={p.name}>
                  {p.name}
                </PlayerLink>
              </th>
              <td>{commas(p.exposure)}</td>
              <td>{commas(p.calls)}</td>
              <td className={league != null && p.rate < league ? 'chalcard__under' : undefined}>
                {num2(p.rate)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* The one real sentence on the card, so it takes `.rptprose` — the name
          inside it needs `.rptprose .plink` for the reason report/chrome.css
          records. */}
      <p className="chalcard__note rptprose">
        {board.below} of {players.length} ask less often than the league rate predicts
        from {kind.theirs}
        {board.leader && league != null && board.leader.rate > league ? (
          <>
            , and{' '}
            <PlayerLink id={board.leader.playerId} name={board.leader.name}>
              {board.leader.name}
            </PlayerLink>{' '}
            called for {commas(board.leader.calls)} in {commas(board.leader.exposure)}{' '}
            {kind.seen} — {num2(board.leader.rate)} against the league’s {num2(league)}
          </>
        ) : null}
        . {kind.key === 'catcher'
          ? 'Innings caught, not pitches received — no feed counts those, so this figure and the one at the plate are measured on different denominators.'
          : 'A man traded in July is counted for the club he saw those pitches with, not the one holding him now.'}
      </p>

      <div className="thub__door">
        <Door onClick={() => navigate(absChallengesPath())}>
          League challenge board
        </Door>
      </div>
    </div>
  )
}
