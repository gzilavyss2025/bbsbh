import { PlayDiamond } from './PlayDiamond.jsx'

// One at-bat box on the scorecard, drawn like the Numbers Game "22" sheet: a top
// row of two boxes — the play OUTCOME and the RBIs it drove in — with the base
// diamond below. The OUTCOME box (top-left) reads the result of the plate
// appearance: a base hit inks green and ringed (1B/2B/3B/HR), an error inks red
// (E6), a walk/HBP its reach code, and an out its category (GO/FO/LO/SO…);
// an interrupted at-bat leaves it blank and pencils its graphite carry-over
// mark ("CS →" — the half ended on the bases mid-count; see
// computeHalfInningFeed's interruptedCode) mid-diamond instead. The
// scorer's fielding chain for an out (F7, L3, 4-3, 6-3) is penciled in the MIDDLE
// of the diamond. A gray "out" circle on the divider rings the 1/2/3 sequence
// number, and a pitch strip of one white BALLS column and two darker STRIKES
// columns runs down the right edge.
//
// Empty template (no `atbat`) renders every zone blank. With an `atbat` (a
// computeHalfInningFeed entry enriched by api/loadScorecard.js) the box fills:
//  • outType / code / codeKind — the outcome box, colored by kind
//  • centerCode — the fielding chain penciled in the diamond center (outs
//    only): `code` with any play-by-play line break flattened away, since
//    this sheet's center chip is single-line (see scorecardCenterCode)
//  • rbi, reached/scored/legNotations/outAt/outCode/outNumber — the diamond
//  • subBefore — a rule down the box's leading edge where a sub took over
//
// An extra-innings automatic runner (`kind: 'placed'`) is not a plate
// appearance — no pitches, no RBI, no outcome of his own — but he's a real
// baserunner, so his box reads "AR" up top and his diamond draws the given
// bases as PlayDiamond's dotted `placedAt` ghost path, same as the live
// play-by-play's PlacedRunnerCard.

// How many strike pips fit in one strike column before overflowing into the
// second — the box is 90px tall, so a foul-heavy at-bat past this spills right.
const STRIKE_COL_CAP = 7

export function AtBatBox({ atbat = null }) {
  const isPlaced = atbat?.kind === 'placed'
  const kind = atbat?.codeKind ?? ''
  // The pitch ladder split into its three columns: balls (white), then two
  // strike columns — strikes fill the first and overflow into the second.
  // The placed runner faced no pitches, so his ladder is empty like the
  // template's.
  const ladder = atbat?.ladder ?? []
  const balls = ladder.filter((p) => p.side === 'ball')
  const strikes = ladder.filter((p) => p.side === 'strike')
  const strikeCol1 = strikes.slice(0, STRIKE_COL_CAP)
  const strikeCol2 = strikes.slice(STRIKE_COL_CAP)
  const isHit = kind === 'hit'
  const isError = kind === 'error'
  // Outcome box (top-left): the out category for an out, otherwise the result
  // code itself (hit / error / reach). A called third strike reads a backwards
  // K. An interrupted at-bat has no result, so its outcome box stays blank —
  // the carry-over mark goes in the diamond instead (below). The placed
  // runner isn't a batting result at all — his box reads "AR" (automatic
  // runner), the mark scorers put where a batting result would go, same
  // pill PlacedRunnerCard shows on the live play-by-play.
  const outcome = isPlaced
    ? 'AR'
    : kind === 'out'
      ? atbat?.calledLooking
        ? 'ꓘ'
        : atbat?.outType ?? ''
      : kind === 'interrupted'
        ? ''
        : atbat?.code ?? ''
  // Diamond center (pencil): the fielding chain for an out — 4-3, F7, L3,
  // 6-4-3 — where the fielders that recorded it are named; or an interrupted
  // at-bat's carry-over mark ("CS →"), penciled mid-diamond the way the
  // scorer writes it. `centerCode`, not the raw `code`, so a GIDP's two-line
  // play-by-play mark ("GIDP" over the chain) doesn't arrive here as one
  // unwrappable run — the outcome box above already reads "DP". Nothing goes
  // here for the placed runner — "AR" already sits in the outcome box above.
  const centerText = atbat?.centerCode ?? atbat?.code ?? ''
  const center =
    kind === 'out' && !atbat?.calledLooking
      ? centerText
      : kind === 'interrupted'
        ? centerText
        : ''
  // A pinch runner who took over for the placed runner (or, on a normal
  // at-bat, for the batter himself once he reached) inherits this card —
  // same red PR mark the live play-by-play diamond draws, by the base he
  // took over at.
  const pinchRunners = atbat?.pinchRunners
  const prBase = pinchRunners?.length ? pinchRunners[pinchRunners.length - 1].base : null
  const prJersey = pinchRunners?.length ? pinchRunners[pinchRunners.length - 1].jersey : null

  return (
    <div className={`sc-ab ${atbat?.subBefore ? 'sc-ab--sub' : ''}`}>
      <div className="sc-ab__main">
        <div className="sc-ab__head">
          <span
            className={`sc-ab__type ${
              isHit ? 'sc-ab__type--hit' : isError ? 'sc-ab__type--error' : ''
            }`}
          >
            {outcome}
          </span>
          <span className="sc-ab__rbi">{!isPlaced && atbat?.rbi ? atbat.rbi : ''}</span>
        </div>
        <div className="sc-ab__diamond">
          <PlayDiamond
            reached={atbat?.reached ?? 0}
            scored={atbat?.scored ?? false}
            earned={atbat?.earned ?? true}
            legNotations={atbat?.legNotations ?? {}}
            outAt={atbat?.outAt ?? null}
            outCode={atbat?.outCode ?? ''}
            prBase={prBase}
            prJersey={prJersey}
            placedAt={isPlaced ? atbat.base : null}
            size={52}
          />
          {center && (
            <span
              className={`sc-ab__center ${
                kind === 'interrupted' ? 'sc-ab__center--interrupted' : 'sc-ab__center--out'
              }`}
            >
              {center}
            </span>
          )}
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
