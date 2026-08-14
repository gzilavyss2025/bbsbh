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
// computeHalfInningFeed entry enriched by api/scorecardGame.js) the box fills:
//  • outType / code / codeKind — the outcome box, colored by kind
//  • centerCode — the fielding chain penciled in the diamond center (outs
//    only): `code` with any play-by-play line break flattened away, since
//    this sheet's center chip is single-line (see scorecardCenterCode)
//  • rbi, reached/scored/legNotations/outAt/outCode/outNumber — the diamond
//  • subBefore — a rule down the box's leading edge where a sub took over
//
// Three marks the paper sheet carries that this box also draws:
//  • `note` — the scorer's own override (lib/scorecardNotes.js): the outcome
//    box, the center chain and the RBI box each yield to the penciled-over
//    value when one is set, and the box wears a small amber corner so a
//    hand-edited cell is tellable from a derived one at a glance. An override
//    restyles THIS BOX only — every tally keeps reading the feed.
//  • `endsHalf` (on the card) — the inning-end rule, ruled into the
//    bottom-right corner of the box of the plate appearance that CLOSED the
//    half. The scorer's "the inning ended here", drawn on the last box of
//    the half itself rather than on a later batter's.
//  • `endMark` — the leads-off-next diagonal, slashed through the next-due
//    batter's unused box when a half ends (scorecardPlays' endCells).
//  • `onEdit` — on an editable surface, the whole box becomes the tap target
//    that opens the notation editor for this plate appearance.
//
// An extra-innings automatic runner (`kind: 'placed'`) is not a plate
// appearance — no pitches, no RBI, no outcome of his own — but he's a real
// baserunner, so his box reads "AR" up top and his diamond draws the given
// bases as PlayDiamond's dotted `placedAt` ghost path, same as the live
// play-by-play's PlacedRunnerCard.

// How many strike pips fit in one strike column before overflowing into the
// second — the box is 90px tall, so a foul-heavy at-bat past this spills right.
const STRIKE_COL_CAP = 7

// The three derived pencil marks for one card — the outcome box (top-left),
// the diamond-center chain, and the RBI box — shared with the notation
// editor (ScorecardCellEditor), which opens its drafts on exactly what the
// box shows so the two can never derive them differently.
//
// Outcome: the out category for an out (a called third strike reads a
// backwards K), the result code itself for a hit / error / reach, blank for
// an interrupted at-bat (its carry-over mark goes mid-diamond instead), and
// "AR" for the placed automatic runner — the mark scorers put where a
// batting result would go, same pill PlacedRunnerCard shows live.
// Center: the fielding chain for an out — 4-3, F7, L3, 6-4-3 — or the
// interrupted carry-over ("CS →"). `centerCode`, not the raw `code`, so a
// GIDP's two-line play-by-play mark doesn't arrive as one unwrappable run —
// the outcome box above already reads "DP".
export function atBatMarks(atbat) {
  const isPlaced = atbat?.kind === 'placed'
  const kind = atbat?.codeKind ?? ''
  const outcome = isPlaced
    ? 'AR'
    : kind === 'out'
      ? atbat?.calledLooking
        ? 'ꓘ'
        : atbat?.outType ?? ''
      : kind === 'interrupted'
        ? ''
        : atbat?.code ?? ''
  const centerText = atbat?.centerCode ?? atbat?.code ?? ''
  const center =
    kind === 'out' && !atbat?.calledLooking
      ? centerText
      : kind === 'interrupted'
        ? centerText
        : ''
  const rbi = !isPlaced && atbat?.rbi ? String(atbat.rbi) : ''
  return { isPlaced, kind, outcome, center, rbi }
}

export function AtBatBox({ atbat = null, note = null, endMark = false, onEdit = null, fresh = false }) {
  const marks = atBatMarks(atbat)
  const { isPlaced, kind } = marks
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
  // The scorer's own pencil wins over the derived ink, one zone at a time —
  // and an overridden outcome drops the hit/error coloring, since the box no
  // longer says what the feed said.
  const outcome = note?.outcome ?? marks.outcome
  const center = note?.center ?? marks.center
  const rbi = note?.rbi ?? marks.rbi
  // A pinch runner who took over for the placed runner (or, on a normal
  // at-bat, for the batter himself once he reached) inherits this card —
  // same red PR mark the live play-by-play diamond draws, by the base he
  // took over at.
  const pinchRunners = atbat?.pinchRunners
  const prBase = pinchRunners?.length ? pinchRunners[pinchRunners.length - 1].base : null
  const prJersey = pinchRunners?.length ? pinchRunners[pinchRunners.length - 1].jersey : null
  const editable = Boolean(onEdit && atbat && !isPlaced)

  return (
    <div
      className={`sc-ab ${atbat?.subBefore ? 'sc-ab--sub' : ''} ${note ? 'sc-ab--noted' : ''} ${
        endMark ? 'sc-ab--end' : ''
      } ${atbat?.endsHalf ? 'sc-ab--halfend' : ''} ${fresh ? 'sc-ab--fresh' : ''}`}
    >
      <div className="sc-ab__main">
        <div className="sc-ab__head">
          <span
            className={`sc-ab__type ${
              isHit && note?.outcome == null
                ? 'sc-ab__type--hit'
                : isError && note?.outcome == null
                  ? 'sc-ab__type--error'
                  : ''
            }`}
          >
            {outcome}
          </span>
          <span className="sc-ab__rbi">{rbi}</span>
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
                kind === 'interrupted' && note?.center == null
                  ? 'sc-ab__center--interrupted'
                  : 'sc-ab__center--out'
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
      {/* The editor's tap target, laid over the whole box — only on an
          editable surface, only for a real plate appearance (the placed
          runner has no notation of his own to override). Rendered last so it
          rides above the strip with no z-index gymnastics. */}
      {editable && (
        <button
          type="button"
          className="sc-ab__edit"
          onClick={onEdit}
          aria-label="Edit this notation"
        />
      )}
    </div>
  )
}
