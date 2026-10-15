import '../../../../styles/report/chrome.css'
import '../../../../styles/report/challenge-card.css'
import { useMemo, useState } from 'react'
import { clubChallengeBoard, EXPOSURE_KINDS } from '../../../../api/around-the-game/absExposure.js'
import { ScatterChart } from '../../../../components/around-the-game/BroadcastBar.jsx'
import { PlayerLink } from '../../../../components/player/PlayerLink.jsx'
import { Door } from '../../../../components/ui/control/Door.jsx'
import { Segmented } from '../../../../components/ui/control/Segmented.jsx'
import { Card } from '../../../../components/ui/frame/Card.jsx'
import { StatTile } from '../../../../components/ui/frame/StatTile.jsx'
import { Table } from '../../../../components/ui/table/Table.jsx'
import { useNav } from '../../../../lib/nav.js'
import { absChallengesPath } from '../../../../lib/route.js'

// Who challenges, on a stamped card (the module is TeamChallengeCard's; the board is
// clubChallengeBoard). One lead tile (rate, its unit and the league rate, the rank), the two-way
// switch, the scatter and the player table that name the same men, the prose, the door. MLB and
// Triple-A only: below that `data` is null and the card does not render. The old card's long
// "why" comments live on TeamChallengeCard until the swap (row 7).
const VIEWS = { batter: 'At the plate', catcher: 'Behind it' }
const num2 = (x) => (x == null ? '—' : x.toFixed(2))
const commas = (n) => (n == null ? '—' : Math.round(n).toLocaleString('en-US'))

// A round step that clears the widest value and never rules the plot like graph paper.
function ticksTo(max, count = 3) {
  const raw = max / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10
  const out = []
  for (let v = step; v <= max; v += step) out.push({ value: v, label: v >= 1000 ? `${Math.round(v / 1000)}k` : String(Math.round(v)) })
  return out
}

export function ChallengeBoard({ data, teamId, clubName, level = 'MLB', asOf, sportId, still }) {
  const navigate = useNav()
  const [view, setView] = useState('batter')
  const boards = useMemo(
    () => Object.fromEntries(EXPOSURE_KINDS.map((k) => [k.key, clubChallengeBoard(data, teamId, k.key, level)])),
    [data, teamId, level],
  )
  const shown = boards[view]?.players.length ? view : 'batter'
  const board = boards[shown]
  if (!board || board.rate == null) return null

  const { kind, players, league } = board
  const scatter = shown === 'batter' && players.length > 2
  const maxX = Math.max(...players.map((p) => p.exposure), 1)
  const maxY = Math.max(...players.map((p) => p.calls), 1)

  return (
    <Card frame="stamped" label="Who challenges" labelAs="h3" count="against what they see" stampIn={!still} className="rnk__card">
      <StatTile
        tone="ink"
        className="stattile--compact rnk__lead"
        label={`Per ${kind.ratePer === 9 ? '9 innings caught' : '1,000 pitches seen'}`}
        value={num2(board.rate)}
        caption={`League ${num2(league)}`}
        rank={board.rank != null ? { rank: board.rank, of: board.of } : undefined}
      />
      <Segmented
        label="At the plate or behind it"
        value={shown}
        onChange={setView}
        fill
        options={EXPOSURE_KINDS.map((k) => ({ value: k.key, label: VIEWS[k.key] ?? k.label }))}
      />
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
          yTicks={ticksTo(maxY, 4)}
          xTicks={ticksTo(maxX, 3)}
          slope={(league / kind.ratePer) * maxX}
          note="Pitches seen across, reviews called up"
          label={`Every ${clubName} hitter's reviews against the pitches he saw, with the league rate drawn as a diagonal`}
        />
      ) : null}
      <Table frame="bare" className="chal__board">
        <thead>
          <tr>
            <th className="chal__who">
              Player
              <span className="chal__floor">
                {commas(players.length)} of {commas(board.roster)} with {commas(kind.floor)}+ {kind.unit}
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
              <th scope="row" className="chal__who">
                <PlayerLink id={p.playerId} name={p.name}>
                  {p.name}
                </PlayerLink>
              </th>
              <td>{commas(p.exposure)}</td>
              <td>{commas(p.calls)}</td>
              <td className={league != null && p.rate < league ? 'chal__under' : undefined}>{num2(p.rate)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      <p className="chal__note rptprose">
        {board.below} of {players.length} ask less often than the league rate predicts from {kind.theirs}
        {board.leader && league != null && board.leader.rate > league ? (
          <>
            , and{' '}
            <PlayerLink id={board.leader.playerId} name={board.leader.name}>
              {board.leader.name}
            </PlayerLink>{' '}
            called for {commas(board.leader.calls)} in {commas(board.leader.exposure)} {kind.seen}, {num2(board.leader.rate)} against
            the league’s {num2(league)}
          </>
        ) : null}
        .{' '}
        {kind.key === 'catcher'
          ? 'Innings caught, not pitches received: no feed counts those, so this figure and the one at the plate are measured on different denominators.'
          : 'A man traded in July is counted for the club he saw those pitches with, not the one holding him now.'}
      </p>
      <div className="thub__door">
        <Door onClick={() => navigate(absChallengesPath({ d: asOf, s: sportId }))}>League challenge board</Door>
      </div>
    </Card>
  )
}
