import { PlayDiamond } from './PlayDiamond.jsx'

// One at-bat box on the scorecard, drawn like the Numbers Game "22" sheet: a top
// row of two boxes — the play OUTCOME and the RBIs it drove in — with the base
// diamond below. The OUTCOME box (top-left) reads the result of the plate
// appearance: a base hit inks green and ringed (1B/2B/3B/HR), an error inks red
// (E6), a walk/HBP its reach code, an out its category (GO/FO/LO/SO…), and an
// interrupted at-bat its graphite carry-over mark ("CS →" — the half ended on
// the bases mid-count; see computeHalfInningFeed's interruptedCode). The
// scorer's fielding chain for an out (F7, L3, 4-3, 6-3) is penciled in the MIDDLE
// of the diamond. A gray "out" circle on the divider rings the 1/2/3 sequence
// number, and a pitch strip of one white BALLS column and two darker STRIKES
// columns runs down the right edge.
//
// Empty template (no `atbat`) renders every zone blank. With an `atbat` (a
// computeHalfInningFeed entry enriched by api/loadScorecard.js) the box fills:
//  • outType / code / codeKind — the outcome box, colored by kind
//  • code — the fielding chain penciled in the diamond center (outs only)
//  • rbi, reached/scored/legNotations/outAt/outCode/outNumber — the diamond
//  • subBefore — a rule down the box's leading edge where a sub took over

// How many strike pips fit in one strike column before overflowing into the
// second — the box is 90px tall, so a foul-heavy at-bat past this spills right.
const STRIKE_COL_CAP = 7

export function AtBatBox({ atbat = null }) {
  const kind = atbat?.codeKind ?? ''
  // The pitch ladder split into its three columns: balls (white), then two
  // strike columns — strikes fill the first and overflow into the second.
  const ladder = atbat?.ladder ?? []
  const balls = ladder.filter((p) => p.side === 'ball')
  const strikes = ladder.filter((p) => p.side === 'strike')
  const strikeCol1 = strikes.slice(0, STRIKE_COL_CAP)
  const strikeCol2 = strikes.slice(STRIKE_COL_CAP)
  const isHit = kind === 'hit'
  const isError = kind === 'error'
  // Outcome box (top-left): the out category for an out, otherwise the result
  // code itself (hit / error / reach). A called third strike reads a backwards K.
  const outcome =
    kind === 'out'
      ? atbat?.calledLooking
        ? 'ꓘ'
        : atbat?.outType ?? ''
      : atbat?.code ?? ''
  // Diamond center (pencil): the fielding chain for an out — 4-3, F7, L3, 6-3 —
  // where the fielders that recorded it are named. Only outs carry one.
  const center = kind === 'out' && !atbat?.calledLooking ? atbat?.code ?? '' : ''

  return (
    <div className={`sc-ab ${atbat?.subBefore ? 'sc-ab--sub' : ''}`}>
      <div className="sc-ab__main">
        <div className="sc-ab__head">
          <span
            className={`sc-ab__type ${
              isHit
                ? 'sc-ab__type--hit'
                : isError
                  ? 'sc-ab__type--error'
                  : kind === 'interrupted'
                    ? 'sc-ab__type--interrupted'
                    : ''
            }`}
          >
            {outcome}
          </span>
          <span className="sc-ab__rbi">{atbat?.rbi ? atbat.rbi : ''}</span>
        </div>
        <div className="sc-ab__diamond">
          <PlayDiamond
            reached={atbat?.reached ?? 0}
            scored={atbat?.scored ?? false}
            earned={atbat?.earned ?? true}
            legNotations={atbat?.legNotations ?? {}}
            outAt={atbat?.outAt ?? null}
            outCode={atbat?.outCode ?? ''}
            size={52}
          />
          {center && <span className="sc-ab__center sc-ab__center--out">{center}</span>}
        </div>
        <span className="sc-ab__out">{atbat?.outNumber ?? ''}</span>
      </div>
      <div className="sc-ab__strip" aria-hidden="true">
        <span className="sc-ab__balls">
          {balls.map((p, i) => (
            <span key={i} className="sc-ab__pip">
              {p.label}
            </span>
          ))}
        </span>
        <span className="sc-ab__strike">
          {strikeCol1.map((p, i) => (
            <span key={i} className="sc-ab__pip">
              {p.label}
            </span>
          ))}
        </span>
        <span className="sc-ab__strike">
          {strikeCol2.map((p, i) => (
            <span key={i} className="sc-ab__pip">
              {p.label}
            </span>
          ))}
        </span>
      </div>
    </div>
  )
}
