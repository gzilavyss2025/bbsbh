import { moneyLabel } from './Money.jsx'

// Position spend on a field, not in a pie. The shape of a roster is spatial —
// every reader already knows where a shortstop stands — so the money goes where
// the player does, and the one position that dwarfs the rest gets the ink slab.
//
// The diamond is DECORATION. Every figure on it is repeated in the ranked list
// beside it, which is what a screen reader is given and what a narrow phone
// falls back to; nothing here is the only place a number appears.
//
// Percent coordinates rather than pixels, so the field scales with its box
// instead of needing a second set of numbers for the wide layout.
// Percent of the 408x300 field box below, and they must agree with it: a spot
// is where that position actually STANDS on the art, so moving one without
// moving the other puts a shortstop in short right. The two corner-infield
// chips sit a touch outside their bases, on the foul side, which is both where
// those fielders play and the only way eleven chips clear each other at the
// narrowest width this is drawn at.
const SPOTS = {
  CF: [50, 12],
  LF: [15, 20],
  RF: [85, 20],
  '2B': [62, 43],
  SS: [38, 43],
  '1B': [82, 57],
  '3B': [18, 57],
  SP: [50, 65],
  C: [50, 91],
  // A chip is centred on its spot, so the outermost two are pulled in far
  // enough that half a chip still clears the frame at phone width.
  DH: [15, 89],
  RP: [85, 89],
}

// A bucket the field has no place for — an arm with no season line yet ("P"), an
// outfielder with no stated corner, a two-way player. Named rather than folded
// into a neighbour, because quietly adding an unclassified pitcher's money to
// the bullpen would be inventing a fact the source never states.
const OFF_FIELD_LABELS = {
  P: 'Pitcher, unassigned',
  OF: 'Outfield, unassigned',
  TWP: 'Two-way',
}

export function PositionSpend({ positions, note }) {
  if (!positions?.length) return null
  const max = Math.max(...positions.map((entry) => entry.total))
  const lead = positions[0]
  const onField = positions.filter((entry) => SPOTS[entry.pos])

  return (
    <section className="posspend" aria-labelledby="posspend-title">
      <div className="metricbar">
        <span className="metricbar__title" id="posspend-title">
          Spend by position
        </span>
      </div>
      <div className="posspend__grid">
        <div className="posspend__field" aria-hidden="true">
          <svg className="posspend__art" viewBox="0 0 408 300" role="presentation">
            {/* Outfield fan, infield diamond, mound — drawn to fill the frame
                rather than float in the middle of it, so the chips land on
                grass instead of ringing a small shape in the centre. */}
            <path
              d="M204 272 L24 92 A 255 255 0 0 1 384 92 Z"
              fill="var(--field-soft)"
              stroke="var(--border-rule)"
            />
            <path
              d="M204 272 L300 176 L204 80 L108 176 Z"
              fill="var(--award-soft)"
              stroke="var(--border-rule)"
            />
            <circle cx="204" cy="194" r="15" fill="var(--bg-page)" stroke="var(--border-rule)" />
          </svg>
          {onField.map((entry) => {
            const [left, top] = SPOTS[entry.pos]
            const isLead = entry.pos === lead.pos
            return (
              <span
                key={entry.pos}
                className={`posspend__chip${isLead ? ' posspend__chip--lead' : ''}`}
                style={{ left: `${left}%`, top: `${top}%` }}
              >
                <span className="posspend__pos">{entry.pos}</span>
                <span className="posspend__money">{moneyLabel(entry.total)}</span>
              </span>
            )
          })}
        </div>

        <div className="posspend__list">
          {positions.map((entry) => (
            <div key={entry.pos} className="posspend__row">
              <span className="posspend__label">{OFF_FIELD_LABELS[entry.pos] ?? entry.pos}</span>
              <span className="posspend__track">
                <span className="posspend__fill" style={{ width: `${(entry.total / max) * 100}%` }} />
              </span>
              <span className="posspend__value">{moneyLabel(entry.total)}</span>
            </div>
          ))}
          {note && <p className="paysource">{note}</p>}
        </div>
      </div>
    </section>
  )
}
