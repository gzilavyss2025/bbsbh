import { loadScout } from '../../../scout/loadScout.js'
import { pitcherBoard } from '../../../scout/board.js'
import { hitterSide, matchupVerdict, metricsFor } from '../../../scout/hitterBoard.js'
import { watchList } from '../../../scout/edge/edge.js'
import { Rich } from '../../../scout/Rich.jsx'
import { stanceFor } from '../../../../lib/scout/roles.js'
import { fmtValue } from '../../../../lib/scout/metrics.js'
import { useAsync } from '../../../../hooks/useAsync.js'
import { fetchOnce } from '../../../../lib/gameday/fetchOnce.js'

// The Matchup Scout's verdict, small, for the Gameday arm card's Scout tab (Gary, 2026-10-29): the same
// number on the same scale as the Scout page's verdict card (screens/scout/edge/VerdictCard.jsx), read the
// same way (loadScout -> pitcherBoard -> hitterSide on xwOBA (est.) -> matchupVerdict), the page's default
// scope and hand. Season stores over final games: an open number, no seal (ADR-0034). Nothing drawn while
// it loads or when the stores hold nothing for this pair.
const other = (h) => (h === 'R' ? 'L' : 'R')
const scoutOnce = fetchOnce(loadScout)

// The verdict and the "Things to watch" sentences (edge.js watchList), as the Scout page builds them.
export function scoutRead(data) {
  if (!data) return null
  const stance = stanceFor(data.hitter.bats, data.pitcher.throws)
  if (!stance) return null
  const board = pitcherBoard({ arsenal: data.arsenal, command: data.command, pitcherId: data.pitcher.id, stance, scope: 'all' })
  const hand = data.hitter.bats === 'S' ? data.pitcher.throws : undefined
  const stand = data.hitter.bats === 'S' ? other(hand) : data.hitter.bats
  const sides = Object.fromEntries(metricsFor(data.grid ?? null).map((m) => [m, hitterSide({ board, grid: data.grid ?? null, league: data.league, hand, stand, scope: 'all', metric: m })]))
  const v = matchupVerdict(board, sides.xwoba)
  if (!v) return null
  const names = { hitter: data.hitter.last, pitcher: data.pitcher.last }
  return { v, names, watch: watchList({ board, sides, names, stance }) }
}

const signed = (gap) => `${gap < 0 ? '−' : '+'}${fmtValue('xwoba', Math.abs(gap))}`

export function ScoutVerdict({ pitcherId, hitterId }) {
  const { data } = useAsync(() => scoutOnce(pitcherId, hitterId), [pitcherId, hitterId])
  const read = scoutRead(data)
  if (!read) return null
  const { v, names, watch } = read
  const lead = v.band === 0 ? null : v.band > 0 ? 'hitter' : 'pitcher'
  const mark = 50 + Math.max(-1, Math.min(1, v.gap / 0.1)) * 50
  return (
    <div className="gdverdict" aria-label={`Scout verdict: ${lead ? `${Math.abs(v.band) === 2 ? 'clear' : 'slight'} edge ${names[lead]}` : 'even'}, ${signed(v.gap)} xwOBA`}>
      <p className="gdverdict__head">
        <b>{lead ? `Edge ${names[lead]}` : 'Even'}</b>
        {lead && <small>{Math.abs(v.band) === 2 ? 'Clear' : 'Slight'}</small>}
      </p>
      <div className="gdverdict__scale">
        {['pitcher2', 'pitcher1', 'even', 'hitter1', 'hitter2'].map((s) => <i key={s} className={`gdverdict__step gdverdict__step--${s}`} />)}
        <span className="gdverdict__pin" style={{ left: `${mark}%` }} />
      </div>
      <p className="gdverdict__sides"><span>◀ {names.pitcher}</span><span>{names.hitter} ▶</span></p>
      {/* The Scout page's "Things to watch", each under the player it is about (Gary, 2026-10-29). */}
      {watch.length > 0 && (
        <ol className="gdwatch">
          {watch.map((w, i) => (
            <li key={i}>
              <span className={`gdwatch__tag gdwatch__tag--${w.who}`}>{names[w.who]}</span>
              <p><Rich parts={w.parts} /></p>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
