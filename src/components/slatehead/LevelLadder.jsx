import { useState } from 'react'

// THE LEVEL LADDER — the D1 masthead's level picker (Gary's handoff,
// 2026-10-18). The farm system drawn as one rail, MLB at the left and A at the
// right, a node per level, and a baseball sitting on the level on screen.
// Winter is not a rung of that system, so it sits after a dashed divider with a
// round node, off the rail, and only while it has games.
//
// A group of toggle buttons, not a slider: one tap, one level, no dragging, no
// arrow-key roving (the rest of the slate has none either). Each stop's name
// is its full level and its count — "Triple-A, 16 games".
//
// THE BALL ROLLS ONLY FOR A TAP. A level change also arrives by Back, by a
// shared link or by the compact bar's menu; only the stop the reader tapped
// here may roll the ball to it. `rolledTo` remembers that tap, and the
// transition class is on only while the level on screen is the one tapped.
export function LevelLadder({ stops, onPick }) {
  const [rolledTo, setRolledTo] = useState(null)
  const at = Math.max(0, stops.findIndex((s) => s.picked))
  const farm = stops.filter((s) => !s.winter).length
  const rolling = rolledTo != null && stops[at]?.key === rolledTo

  return (
    <div
      className={`levelladder${rolling ? ' levelladder--rolling' : ''}`}
      role="group"
      aria-label="Level"
      style={{ '--stops': stops.length, '--farm': farm, '--at': at }}
    >
      <span className="levelladder__rail" aria-hidden="true" />
      <span className="levelladder__ball" aria-hidden="true">
        <LadderBall />
      </span>
      {stops.map((s) => (
        <button
          key={s.key}
          type="button"
          className={`levelladder__stop${s.winter ? ' levelladder__stop--winter' : ''}${
            s.empty ? ' is-empty' : ''
          }${s.picked ? ' is-picked' : ''}`}
          aria-pressed={s.picked}
          aria-label={s.aria}
          onClick={() => {
            setRolledTo(s.key)
            onPick(s)
          }}
        >
          <span className="levelladder__node" />
          <span className="levelladder__name">{s.label}</span>
          <span className="levelladder__count">{s.count}</span>
        </button>
      ))}
    </div>
  )
}

// The ball: an ink outline with clay seams, inked by CSS (.levelladder__ball) so it
// carries no raw colour of its own.
function LadderBall() {
  return (
    <svg viewBox="0 0 24 24" className="levelladder__ballart">
      <circle cx="12" cy="12" r="10" className="levelladder__hide" />
      <path d="M8 4.5c2.4 2.2 2.4 12.8 0 15" className="levelladder__seam" />
      <path d="M16 4.5c-2.4 2.2-2.4 12.8 0 15" className="levelladder__seam" />
    </svg>
  )
}
