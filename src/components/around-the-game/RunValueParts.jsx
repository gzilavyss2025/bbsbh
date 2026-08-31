import '../../styles/75-run-value.css'
import { COMPONENTS, signed, tone } from '../../api/around-the-game/runValue.js'
import { Headshot } from '../player/Headshot.jsx'
import { PlayerLink } from '../player/PlayerLink.jsx'
import { TeamLogo } from '../logo/TeamLogo.jsx'

// The three pieces every run value surface draws — the report board, the
// player page's card, the club card — held in one file so the three cannot
// drift into three different-looking readings of the same four numbers.
//
// They are the reason 75-run-value.css exists and the reason it is imported
// HERE rather than by index.css: a reader who never opens a run value surface
// never pays for it (the same per-route split 26a-percentile-strip.css and
// 58-logbook-shelf.css already use).

// THE NAMEPLATE — rank, club mark, face, name. The leftmost cell of the board
// and the one that makes it readable at a glance.
//
// It is a `<th scope="row">`, not a `td`, for the reason ClubCell's header
// spells out: every other cell on the row is a bare signed number whose only
// meaning is the man it belongs to, so a screen reader has to announce the name
// with each of them. That is more true here than anywhere else in the app — a
// row is five numbers and nothing else.
//
// The portrait carries `aria-hidden` (Headshot's own policy) and the name is
// already text beside it, so the link's accessible name is the name itself and
// the face announces nothing twice.
//
// `sub` — the position — stays a `.rpt__sub` BLOCK under the nameplate, but the
// board indents it to land under the NAME. Unindented it starts at the cell's
// left padding, which put "CF" under the RANK, two columns from the man it
// describes and reading as a second figure beside his place on the board.
//
// It is indented rather than inlined after the name, which was the first fix
// and the wrong one: an inline chip is an unbreakable flex item, so it widened
// the nameplate cell from 152px to 209px, the board from 383px to 405px, and —
// through the sticky cell inside the scroller — put 22px of horizontal scroll
// on the whole PAGE at 390px. A block-level label costs the cell no width at
// all, however far it is indented, because its own line is far shorter than the
// cell's minimum. See 75-run-value.css for the indent.
export function PlayerNameplate({ player, rank, tied, sub }) {
  return (
    <th scope="row" className="team">
      <span className="rpt__club rv__nameplate">
        {rank != null ? (
          <span className="rpt__rank">
            {tied ? 'T' : ''}
            {rank}
          </span>
        ) : null}
        <span className="rv__face" aria-hidden="true">
          <Headshot personId={player.id} name={player.name} teamId={player.teamId} />
        </span>
        {player.teamId != null ? (
          <TeamLogo teamId={player.teamId} name={player.name} size={18} />
        ) : null}
        <PlayerLink id={player.id} name={player.name}>
          {player.name}
        </PlayerLink>
      </span>
      {sub ? <span className="rpt__sub rv__pos">{sub}</span> : null}
    </th>
  )
}

// One signed figure, inked by which way it leans. `strong` is the total column,
// which stays in the body ink at every value: it is the row's headline and a
// green or red headline would make the whole board shout.
export function RunCell({ value, strong = false }) {
  return (
    <td className={`rv__num${strong ? ' rv__num--total' : ` rv__num--${tone(value)}`}`}>
      {signed(value)}
    </td>
  )
}

// THE SPLIT — the four components as one bar, drawn from a shared zero line.
//
// A card that only printed four numbers would make a reader do the comparing.
// The bar does it: the components that HELPED stack rightward from the zero
// line and the ones that hurt stack leftward, in the order COMPONENTS fixes, so
// the shape of a season is readable before any figure is. A centre fielder
// reads as two long bars right of the line; a designated hitter as one, with a
// short stub the other way.
//
// THE ZERO LINE IS NOT FIXED AT THE MIDDLE, and that is the part worth reading
// twice. Split the track evenly and a player with nothing negative — most of
// the leaders — gets a bar drawn across the right half of an empty box, which
// reads as a half-finished chart rather than as "he gave nothing back". So each
// side is given the share of the track its own worst case needs: all-positive
// puts zero at the left edge, all-negative at the right, and a mixed surface
// lands in between. Every card handed the same `scale` therefore draws the same
// zero in the same place, which is what lets two of them be compared.
//
// `scale` comes from `splitScale()` over every entry on the surface, so several
// cards down a page share one ruler.
//
// It is decoration for the figures beside it, never a substitute: every number
// is printed in the legend under it, so nothing here is available only as a
// picture. That is why the track carries `aria-hidden`.
export function splitScale(entries) {
  let pos = 0
  let neg = 0
  for (const e of entries ?? []) {
    let up = 0
    let down = 0
    for (const c of COMPONENTS) {
      const v = e?.[c.key] ?? 0
      if (v >= 0) up += v
      else down -= v
    }
    pos = Math.max(pos, up)
    neg = Math.max(neg, down)
  }
  return { pos, neg }
}

export function RunValueSplit({ entry, scale }) {
  const pos = scale?.pos ?? 0
  const neg = scale?.neg ?? 0
  const span = pos + neg
  // Where zero sits, as a percentage across the track. A surface with no
  // movement at all in either direction has nothing to draw, and the guard
  // below keeps it from dividing by nothing.
  const zero = span > 0 ? (neg / span) * 100 : 50
  // Stacked, so each segment starts where the previous one on its side ended,
  // and clamped at its own side's share of the track: a caller that passed a
  // scale smaller than one of its own entries gets a bar that runs to the edge
  // rather than out of the card.
  let right = 0
  let left = 0
  const segs = []
  for (const c of COMPONENTS) {
    const v = entry?.[c.key] ?? 0
    if (span <= 0 || Math.abs(v) === 0) continue
    const room = v >= 0 ? 100 - zero - right : zero - left
    const width = Math.max(0, Math.min((Math.abs(v) / span) * 100, room))
    if (width < 0.5) continue
    const offset = v >= 0 ? right : left
    if (v >= 0) right += width
    else left += width
    segs.push({ key: c.key, positive: v >= 0, offset, width })
  }
  return (
    <div className="rvsplit">
      <div className="rvsplit__track" aria-hidden="true">
        <span className="rvsplit__zero" style={{ left: `${zero}%` }} />
        {segs.map((s) => (
          <span
            key={s.key}
            className={`rvsplit__seg rvsplit__seg--${s.key} rvsplit__seg--${s.positive ? 'up' : 'down'}`}
            style={
              s.positive
                ? { left: `calc(${zero}% + ${s.offset}%)`, width: `${s.width}%` }
                : { right: `calc(${100 - zero}% + ${s.offset}%)`, width: `${s.width}%` }
            }
          />
        ))}
      </div>
      <dl className="rvsplit__legend">
        {COMPONENTS.map((c) => (
          <div key={c.key} className={`rvsplit__item rvsplit__item--${c.key}`}>
            <dt>{c.label}</dt>
            <dd className={`rv__num--${tone(entry?.[c.key])}`}>{signed(entry?.[c.key])}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
