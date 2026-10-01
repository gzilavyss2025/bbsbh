import { useEffect, useMemo, useState } from 'react'
import { splitDisplayName } from '../../../api/person.js'
import { fetchStaticTeams } from '../../../api/teams-static.js'
import { useAsync } from '../../../hooks/useAsync.js'
import { HOVER_CARD_QUERY, useMediaQuery } from '../../../hooks/useMediaQuery.js'
import { TeamLogo } from '../../logo/TeamLogo.jsx'
import { Headshot } from '../../player/Headshot.jsx'
import { PlayerLink } from '../../player/PlayerLink.jsx'
import { clubShortName, ladderGeometry, posLabel, seasonRange, traceOf } from './layout.js'

// The Former Teammates card's diagram (#1352): away players, shared clubs and
// home players, joined by a line per pair. Each player and each club shows once.
// The layout is pixel math (layout.js) on the CARD's measured width, not the
// viewport's: vertical on a phone or tablet, sideways on a wide card when every
// column still gets 54px.
//
// Tracing: a tap on a player or club lights its real pairs and dims the rest;
// a second tap clears it. With a mouse, pointing traces and a click pins. A
// traced player's name becomes his PlayerLink, so the first tap traces and the
// second opens his page; with a mouse the name is a link from the start, since
// pointing has already traced.
export function Ladder({ ladder, dayNight, away, home }) {
  const [node, setNode] = useState(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    if (!node) return
    const measure = () => setWidth(node.clientWidth)
    // No ResizeObserver: measure once. It reports once on observe() otherwise.
    if (typeof ResizeObserver === 'undefined') return measure()
    const ro = new ResizeObserver(measure)
    ro.observe(node)
    return () => ro.disconnect()
  }, [node])
  const hoverCapable = useMediaQuery(HOVER_CARD_QUERY)
  const [pinned, setPinned] = useState(null)
  const [pointed, setPointed] = useState(null)
  const { data: teams } = useAsync(fetchStaticTeams, [])
  const geo = useMemo(() => (width ? ladderGeometry(ladder, width) : null), [ladder, width])
  const trace = useMemo(() => traceOf(ladder, pointed ?? pinned), [ladder, pointed, pinned])

  const current = useMemo(
    () => new Map(Object.values(teams?.bySportId ?? {}).flat().map((t) => [t.id, t])),
    [teams],
  )
  const pin = (key) => setPinned((k) => (k === key ? null : key))
  const point = (key) => {
    if (hoverCapable) setPointed(key)
  }
  const lit = (key) => (trace ? (trace.nodes.has(key) ? ' ladder__node--lit' : ' ladder__node--dim') : '')
  const lines = geo?.segments
    .map((s) => ({ ...s, on: trace?.segments.has(s.key) }))
    .sort((a, b) => Number(a.on) - Number(b.on)) // a lit line draws over the dim ones

  const badges = Object.values(ladder.players).map((p) => p.former).filter(Boolean)
  const club = badges.some((f) => !f.farmOnly)
  const farm = badges.some((f) => f.farmOnly)
  const sideName = (team) => (
    <span className="ladder__sidename">
      <TeamLogo teamId={team.id} name={team.teamName} size={20} />
      {team.teamName}
    </span>
  )
  const sideways = geo?.sideways

  return (
    <>
      {/* Vertical: away left, home right. Sideways: away over the top row,
          home under the bottom one. */}
      <div className="ladder__sides" aria-hidden="true">
        {sideName(away)}
        {!sideways && sideName(home)}
      </div>
      <p className="ladder__legend">
        {Object.values(ladder.players).some((p) => p.starting) && (
          <span className="ladder__key">
            <span className="ladder__mark" />
            {dayNight === 'day' ? 'Starting today' : 'Starting tonight'}
          </span>
        )}
        {club && (
          <span className="ladder__key">
            <span className="ladder__badge ladder__badge--key" />
            Played for the club
          </span>
        )}
        {farm && (
          <span className="ladder__key">
            <span className="ladder__badge ladder__badge--farm ladder__badge--key" />
            Its farm system only
          </span>
        )}
        <span className="ladder__key">{hoverCapable ? 'Point to trace, click to pin' : 'Tap a player or club to trace it'}</span>
      </p>
      <div
        ref={setNode}
        className={`ladder${sideways ? ' ladder--sideways' : ''}${trace ? ' ladder--tracing' : ''}`}
        style={{ height: geo?.height }}
      >
        {geo && (
          <>
            <svg className="ladder__lines" width={width} height={geo.height} aria-hidden="true">
              {geo.dividers.map((d) => (
                <line key={`${d.x1},${d.y1}`} className="ladder__divider" {...d} />
              ))}
              {lines.map((s) => (
                <path key={s.key} className={`ladder__line${s.on ? ' ladder__line--lit' : ''}`} d={s.d} />
              ))}
            </svg>
            {geo.clubs.map(({ id, box }) => {
              const c = ladder.clubs[id]
              const name = clubShortName(c.teamName, current.get(c.teamId))
              return (
                <button
                  key={id}
                  type="button"
                  className={`ladder__node ladder__club${lit(`c${id}`)}`}
                  style={box}
                  aria-pressed={pinned === `c${id}`}
                  aria-label={`${c.teamName}${c.level === 'MLB' ? '' : ` ${c.level}`}, ${seasonRange(c.seasons)}`}
                  onClick={() => pin(`c${id}`)}
                  onMouseEnter={() => point(`c${id}`)}
                  onMouseLeave={() => point(null)}
                >
                  <TeamLogo teamId={c.teamId} name={c.teamName} size={sideways ? 22 : 18} />
                  <span className="ladder__clubtext">
                    <span className="ladder__clubname">{name}</span>
                    <span className="ladder__years">{seasonRange(c.seasons)}</span>
                  </span>
                  {c.level !== 'MLB' && <span className="ladder__level">{c.level}</span>}
                </button>
              )
            })}
            {geo.players.map(({ id, side, box }) => (
              <PlayerNode
                key={id}
                p={ladder.players[id]}
                side={side}
                box={box}
                cls={lit(`p${id}`)}
                pinned={pinned === `p${id}`}
                linked={hoverCapable || (pointed ?? pinned) === `p${id}`}
                onPin={() => pin(`p${id}`)}
                onPoint={(on) => point(on ? `p${id}` : null)}
              />
            ))}
            {geo.note && (
              <span className={`ladder__note${trace ? ' ladder__node--dim' : ''}`} style={geo.note}>
                No other tie {dayNight === 'day' ? 'today' : 'tonight'}
              </span>
            )}
          </>
        )}
      </div>
      {sideways && <div className="ladder__sides" aria-hidden="true">{sideName(home)}</div>}
      <ul className="sr-only">
        {ladder.edges.map((e) => (
          <li key={`${e.away}-${e.home}`}>
            {surname(ladder.players[e.away])} and {surname(ladder.players[e.home])},{' '}
            {ladder.clubs[e.club].teamName}, {yearSpan(e.seasons)}
          </li>
        ))}
      </ul>
    </>
  )
}

// One player: his headshot at the end the line meets, then surname, position
// (green when he starts) and, for a tie to tonight's own org, a badge with that
// club's cap and years. The button always holds the headshot; it holds the name
// too until the name becomes his link, so the button (and its focus) never
// remounts.
function PlayerNode({ p, side, box, cls, pinned, linked, onPin, onPoint }) {
  const f = p.former
  const formerLabel = f ? `, formerly ${f.teamName} ${yearSpan(f.seasons)}` : ''
  const text = (
    <span className="ladder__text">
      <span className="ladder__surname">{surname(p)}</span>
      <span className="ladder__meta">
        {p.pos && <span className={`ladder__pos${p.starting ? ' ladder__pos--starting' : ''}`}>{posLabel(p.pos)}</span>}
        {f && (
          <span className={`ladder__badge${f.farmOnly ? ' ladder__badge--farm' : ''}`}>
            <TeamLogo teamId={f.orgId} name={f.teamName} size={11} variant="cap" />
            {seasonRange(f.seasons)}
          </span>
        )}
      </span>
    </span>
  )
  return (
    <div
      className={`ladder__node ladder__player ladder__player--${side}${cls}`}
      style={box}
      onMouseEnter={() => onPoint(true)}
      onMouseLeave={() => onPoint(false)}
    >
      <button
        type="button"
        className="ladder__trace"
        aria-pressed={pinned}
        aria-label={[p.name, posLabel(p.pos)].filter(Boolean).join(', ') + formerLabel}
        onClick={onPin}
      >
        <Headshot personId={p.id} name={p.name} teamId={p.teamId} className="ladder__shot" />
        {!linked && text}
      </button>
      {linked && (
        <PlayerLink id={p.id} name={p.name} className={`ladder__link${pinned ? ' ladder__link--pinned' : ''}`}>
          {text}
        </PlayerLink>
      )}
    </div>
  )
}

const surname = (p) => splitDisplayName(p.name).last
// [2019, 2022] -> "2019–2022", for screen readers.
const yearSpan = (ys) => (ys.length > 1 ? `${ys[0]}–${ys[ys.length - 1]}` : `${ys[0] ?? ''}`)
