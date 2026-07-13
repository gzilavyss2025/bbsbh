import { ordinal } from '../lib/format.js'
import { InjuredMark } from './InjuredMark.jsx'
import { PlayerLink } from './PlayerLink.jsx'

// The scorebook's defense diamond, drawn the way the #22 sheet prints it:
// the infield square rotated onto its point, each fielder's surname on a
// writing line at his position with the small position number beneath, and
// a small pencil ring for the pitcher's mound at its center. Fielders only —
// the pitcher has his own table and the DH bats but never takes the field,
// so he rides a small line under the diamond instead.
//
// Two input shapes, one drawing:
//  • Lineup page (spoiler-free starting nine): each item is { position, last,
//    hurt?, id? } — `hurt` (optional, e.g. TeamPage's Preferred Lineup card)
//    flags the name with the shared IL cross (see InjuredMark.jsx); `id`
//    (optional, same card) makes the name a PlayerLink to his profile.
//  • Innings page (reveal-gated live alignment, see api/defense.js): each item
//    is { position, entries: [{ last, inning, replaced }, …] } — a scorebook
//    substitution stack. A replaced player is struck through with the reliever
//    penciled above him and the inning he took the field in parentheses.

// Scorer's position numbers, the same digits penciled under each name.
const POSITION_NUMBER = {
  C: 2, '1B': 3, '2B': 4, '3B': 5, SS: 6, LF: 7, CF: 8, RF: 9,
}

// Where each label sits, in percent of the diamond box. Mirrors the sheet:
// outfield arc up top, middle infield off the upper edges, corners off the
// lower edges, catcher over home plate. Catcher rides high enough that its
// position number stays clear of the DH line below the field — the surname
// overlapping the diamond graphic is fine.
const SPOTS = {
  LF: { x: 17, y: 10 },
  CF: { x: 50, y: 3 },
  RF: { x: 83, y: 10 },
  SS: { x: 29, y: 33 },
  '2B': { x: 71, y: 33 },
  '3B': { x: 13, y: 57 },
  '1B': { x: 87, y: 57 },
  C: { x: 50, y: 79 },
}

// Normalize either input shape to a { position -> [{ last, inning, replaced }] }
// stack. The simple lineup form becomes a single, un-struck entry.
function toStacks(defense) {
  const byPos = {}
  for (const item of defense) {
    if (!item?.position) continue
    byPos[item.position] = item.entries ?? [
      { last: item.last, inning: null, replaced: false, hurt: item.hurt ?? false, id: item.id ?? null },
    ]
  }
  return byPos
}

export function DefenseDiamond({ defense }) {
  const byPos = toStacks(defense)
  const hasFielder = Object.keys(SPOTS).some((pos) => byPos[pos])
  if (!hasFielder) return null

  return (
    <div className="defdiamond">
      <div className="defdiamond__field">
        {/* Infield square + a small mound ring, in pencil rule. The box is 4:3,
            and the SVG stretches to fill it, so viewBox y-units compress to 75%
            of x — the polygon is drawn taller than wide (and the mound ring is
            an ellipse) so both READ as a true square-on-point diamond and a
            round mound, like a real infield. */}
        <svg
          className="defdiamond__lines"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <polygon
            points="50,89 76,54 50,19 24,54"
            fill="none"
            stroke="var(--rule)"
            strokeWidth="0.8"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          <ellipse
            cx="50"
            cy="54"
            rx="3.4"
            ry="4.5"
            fill="none"
            stroke="var(--rule)"
            strokeWidth="0.8"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {Object.entries(SPOTS).map(([pos, spot]) => (
          <DefenseSpot key={pos} pos={pos} stack={byPos[pos]} spot={spot} />
        ))}
      </div>

      {byPos.DH && (
        <p className="defdiamond__dh">
          <span className="defdiamond__dhpos">DH</span>
          <span className="defdiamond__dhstack">
            {byPos.DH.map((e, i) => (
              <DefenseName key={i} entry={e} />
            ))}
          </span>
        </p>
      )}
    </div>
  )
}

// One fielder's spot: the substitution stack (reliever above, replaced starter
// struck through below), then the position number. An unposted spot keeps its
// line + number so the sheet's shape never changes.
function DefenseSpot({ pos, stack, spot }) {
  return (
    <span
      className="defdiamond__spot"
      style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
    >
      {stack ? (
        // Newest name on top (the scorebook pencils the sub above the crossed-out
        // starter), so render the chain in reverse.
        stack
          .slice()
          .reverse()
          .map((e, i) => <DefenseName key={i} entry={e} />)
      ) : (
        <span className="defdiamond__name defdiamond__name--tbd">—</span>
      )}
      <span className="defdiamond__num" aria-label={pos}>
        {POSITION_NUMBER[pos]}
      </span>
    </span>
  )
}

// A single surname on its writing line. A replaced player is struck through; a
// player who entered mid-game carries the inning he took the field and, while
// he's the standing occupant, his surname is inked seam-red like the inning tag.
// An entry carrying an `id` (only the Preferred Lineup card does today) links
// the surname to his player page — plain text otherwise, unchanged everywhere
// else the diamond is used.
function DefenseName({ entry }) {
  const entered = entry.inning != null && !entry.replaced
  return (
    <span
      className={`defdiamond__name ${entry.replaced ? 'defdiamond__name--out' : ''} ${
        entered ? 'defdiamond__name--in' : ''
      }`}
    >
      {entry.id ? <PlayerLink id={entry.id}>{entry.last}</PlayerLink> : entry.last}
      {entry.inning != null && (
        <span className="defdiamond__enter"> ({ordinal(entry.inning)})</span>
      )}
      <InjuredMark hurt={entry.hurt} />
    </span>
  )
}
