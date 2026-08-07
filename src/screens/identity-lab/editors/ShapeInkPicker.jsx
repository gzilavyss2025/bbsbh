// Pick, by eye, which SHAPES of a mark are the ink and which are the paper it
// is drawn against — the clickable art, and the numbered list of verdicts that
// is its keyboard and screen-reader path.
//
// Presentational only: it holds no pins and saves nothing. Two editors classify
// shapes this way and they answer different questions with the answer —
// MonoInkEditor corrects the club-wide knockout conversion and regenerates that
// club's file; MastheadMarkEditor converts one pasted mark for one bar and bakes
// the result into a saved SVG. Sharing the surface is what keeps a shape
// meaning the same thing in both (logoMono.js numbers them once, for both).
//
// A click always flips straight to the OTHER verdict from whatever the shape
// currently reads as — its own pin if it has one, else the automatic
// classifier's call — never routing back through a third "unpinned" stop. Each
// caller owns its own way back to automatic, in bulk.

const VERDICT_LABEL = {
  auto: 'Automatic',
  ink: 'Ink — part of the mark',
  knockout: 'Knockout — the paper behind it',
}

// `picker` is monoLogoPickerSvg markup (already sanitized by its caller — this
// component inlines it, so a caller handing over raw remote bytes is the one
// bug it cannot catch for itself). `parts` is monoLogoParts. `pins` is the
// caller's `{ [index]: 'ink' | 'knockout' }`. `children` is whatever that
// caller wants beside the art — a preview of the converted result, usually.
export function ShapeInkPicker({ picker, parts, pins, onToggle, children }) {
  return (
    <>
      <div className="idlab__monoinkrow">
        {/* The art is a picture, not a control surface: every shape in it also
            has a real button in the list below. Clicking the shape you are
            looking at is the convenience, not the only way in. */}
        <div
          className="idlab__monoinkart"
          onClick={(e) => {
            const index = e.target?.closest?.('[data-mono-part]')?.dataset?.monoPart
            if (index !== undefined) onToggle(Number(index))
          }}
          dangerouslySetInnerHTML={{ __html: picker }}
        />
        {children}
      </div>

      <ul className="idlab__monoinkparts">
        {parts.map((part) => {
          const verdict = pins[part.index] ?? 'auto'
          const effective = verdict === 'auto' ? part.auto : verdict
          return (
            <li key={part.index}>
              <button
                type="button"
                className={`idlab__monoinkpart idlab__monoinkpart--${effective}${verdict === 'auto' ? '' : ' idlab__monoinkpart--pinned'}`}
                onClick={() => onToggle(part.index)}
                title={`Shape ${part.index + 1} (${part.tag}) — ${VERDICT_LABEL[verdict]}`}
              >
                <span
                  className="idlab__monoinkswatch"
                  style={{ background: part.fill ?? 'transparent' }}
                  aria-hidden="true"
                />
                <span className="idlab__monoinkpartnum">{part.index + 1}</span>
                <span className="idlab__monoinkpartverdict">{effective === 'ink' ? 'Ink' : 'Knockout'}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </>
  )
}

// The verdict a shape currently reads as, pin or automatic — what a caller's
// toggle has to flip AWAY from. Lives here so the two editors can't disagree
// about what "the other one" means.
export function flipVerdict(parts, pins, index) {
  const current = pins[index] ?? parts.find((p) => p.index === index)?.auto ?? 'ink'
  return current === 'ink' ? 'knockout' : 'ink'
}
