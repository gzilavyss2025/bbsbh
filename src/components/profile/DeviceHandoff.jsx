// The score-free device handoff — a phone and a tablet showing the same
// scorebook page, with kraft-amber seal bars where the numbers would be.
//
// The whole point of the illustration is that the numbers are NOT there. It is
// hand-drawn geometry with no game as input: no gamePk, no feed, no club, no
// date, nothing fetched and nothing that could be. Read PRD §6.4 and invariant
// P5 before "improving" it with a real linescore — a marketing visual that
// states or implies a result is the one way this page could ever spoil
// something, and it would do it to a visitor who has revealed nothing at all.
//
// Drawn as one inline SVG so it inherits the paper/ink/seal tokens and adds no
// asset to the bundle.
export function DeviceHandoff({ className = '' }) {
  return (
    <svg
      className={`devicehandoff ${className}`}
      viewBox="0 0 200 108"
      role="img"
      aria-label="A phone and a tablet showing the same sealed scorebook page"
    >
      {/* The tablet, behind and to the right. */}
      <rect className="devicehandoff__body" x="96" y="10" width="94" height="88" rx="6" />
      <rect className="devicehandoff__page" x="103" y="17" width="80" height="74" rx="2" />
      <line className="devicehandoff__rule" x1="110" y1="28" x2="176" y2="28" />
      <line className="devicehandoff__rule" x1="110" y1="38" x2="158" y2="38" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <rect
          key={`t${i}`}
          className="devicehandoff__seal"
          x={110 + i * 11}
          y="50"
          width="9"
          height="12"
          rx="1"
        />
      ))}
      <line className="devicehandoff__rule" x1="110" y1="72" x2="176" y2="72" />
      <line className="devicehandoff__rule" x1="110" y1="81" x2="146" y2="81" />

      {/* The phone, in front and to the left. */}
      <rect className="devicehandoff__body" x="10" y="22" width="56" height="76" rx="8" />
      <rect className="devicehandoff__page" x="16" y="30" width="44" height="60" rx="2" />
      <line className="devicehandoff__rule" x1="21" y1="39" x2="55" y2="39" />
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={`p${i}`}
          className="devicehandoff__seal"
          x={21 + i * 9}
          y="48"
          width="7"
          height="10"
          rx="1"
        />
      ))}
      <line className="devicehandoff__rule" x1="21" y1="68" x2="55" y2="68" />
      <line className="devicehandoff__rule" x1="21" y1="76" x2="45" y2="76" />

      {/* The hand-off itself: one arc from the phone to the tablet. */}
      <path className="devicehandoff__arc" d="M70 40 Q84 18 96 34" />
      <path className="devicehandoff__arrow" d="M96 34 L89 31 L93 40Z" />
    </svg>
  )
}
