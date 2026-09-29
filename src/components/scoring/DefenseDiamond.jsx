import { ordinal } from '../../lib/format.js'
import { InjuredMark } from '../badges/InjuredMark.jsx'
import { PlayerLink } from '../player/PlayerLink.jsx'
import { Card } from '../ui/frame/Card.jsx'
import { StruckLine } from './StruckLine.jsx'
import { FieldBackdrop } from './field/FieldBackdrop.jsx'

// A grass-and-clay field with each fielder's surname at his position.
// Position names remain available to assistive technology. Fielders only —
// the pitcher has his own table and the DH bats but never takes the field,
// so he rides a small line under the diamond instead.
//
// Two input shapes, one drawing:
//  • Lineup page (spoiler-free starting nine): each item is { position, last,
//    hurt?, id?, name? } — `hurt` (optional, e.g. TeamPage's Preferred Lineup
//    card) flags the name with the shared IL cross (see InjuredMark.jsx); `id`
//    (optional, same card) makes the name a PlayerLink to his profile, and
//    `name` (optional, same card) is the whole name that link puts in the
//    ADDRESS, since the diamond only ever prints the surname (ADR-0057).
//  • Innings page (reveal-gated live alignment, see api/defense.js): each item
//    is { position, entries: [{ last, inning, replaced }, …] } — a scorebook
//    substitution stack. A replaced player is struck through with the reliever
//    penciled above him and the inning he took the field in parentheses.

// Label anchors in percent of the 4:3 field. Names sit below each anchor.
// The catcher sits below home plate; corner labels leave the bases visible.
const SPOTS = {
  LF: { x: 21, y: 16, label: 'Left field' },
  CF: { x: 50, y: 6, label: 'Center field' },
  RF: { x: 79, y: 16, label: 'Right field' },
  SS: { x: 32, y: 42, label: 'Shortstop' },
  '2B': { x: 68, y: 42, label: 'Second base' },
  '3B': { x: 21, y: 60, label: 'Third base' },
  '1B': { x: 79, y: 60, label: 'First base' },
  C: { x: 50, y: 88, label: 'Catcher' },
}

// Normalize either input shape to a { position -> [{ last, inning, replaced }] }
// stack. The simple lineup form becomes a single, un-struck entry.
//
// This REBUILDS the entry rather than spreading it, so a field the lineup form
// carries and this list does not is a field the diamond silently drops. `name`
// was exactly that: the surname printed fine while every link fell back to the
// bare-id address, with nothing failing anywhere to say so (ADR-0057).
function toStacks(defense) {
  const byPos = {}
  for (const item of defense) {
    if (!item?.position) continue
    byPos[item.position] = item.entries ?? [
      {
        last: item.last,
        name: item.name ?? null,
        inning: null,
        replaced: false,
        hurt: item.hurt ?? false,
        id: item.id ?? null,
      },
    ]
  }
  return byPos
}

export function DefenseDiamond({ defense }) {
  const byPos = toStacks(defense)
  const hasFielder = Object.keys(SPOTS).some((pos) => byPos[pos])
  if (!hasFielder) return null

  // The box is a Card (#1113, slice C3): the same frame wherever the diamond
  // renders. A host that makes it part of its own card reshapes it in CSS
  // (.opp, .bs__defensecard, .refpanel__body). The Card computes nothing, so
  // it is safe inside the box score's reveal render.
  return (
    <Card as="div" body="flush" className="defdiamond">
      <div className="defdiamond__field">
        <FieldBackdrop className="defdiamond__lines" />

        {Object.entries(SPOTS).map(([pos, spot]) => (
          <DefenseSpot key={pos} stack={byPos[pos]} spot={spot} />
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
    </Card>
  )
}

// One fielder's spot: the substitution stack (reliever above, replaced starter
// struck through below). An unposted spot keeps its blank label.
function DefenseSpot({ stack, spot }) {
  return (
    <span
      className="defdiamond__spot"
      style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
      role="group"
      aria-label={spot.label}
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
    </span>
  )
}

// A single surname inside its spot's paper label. A replaced player is struck through; a
// player who entered mid-game carries the inning he took the field and, while
// he's the standing occupant, his surname is inked seam-red like the inning tag.
// An entry carrying an `id` (only the Preferred Lineup card does today) links
// the surname to his player page — plain text otherwise, unchanged everywhere
// else the diamond is used.
function DefenseName({ entry }) {
  const entered = entry.inning != null && !entry.replaced
  return (
    <StruckLine
      struck={entry.replaced}
      className={`defdiamond__name ${entry.replaced ? 'defdiamond__name--out' : ''} ${
        entered ? 'defdiamond__name--in' : ''
      }`}
    >
      {entry.id ? (
        <PlayerLink id={entry.id} name={entry.name}>
          {entry.last}
        </PlayerLink>
      ) : (
        entry.last
      )}
      {entry.inning != null && (
        <span className="defdiamond__enter"> ({ordinal(entry.inning)})</span>
      )}
      <InjuredMark hurt={entry.hurt} />
    </StruckLine>
  )
}
