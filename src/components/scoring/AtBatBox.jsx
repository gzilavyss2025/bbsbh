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
//
// TWO HANDOVER MARKS ride the TOP EDGE of this box, both drawn the way a
// scorer rules one off: a red line across the box, with a uniform number in
// red beside it. The line means "what is under it is a different man than
// what was above it".
//  • `subJersey` — the batting order changed here. Every man who fills a slot
//    shares its one row of boxes (his name goes on a written line of its own
//    in the rail), so the rule falls on the first box the INCOMING batter
//    bats in, and his number sits UNDER the line, in the box that is now his.
//  • `pitcherJersey` — the club in the field changed arms. The rule falls on
//    the box of the first batter the new pitcher faces, and his number sits
//    ABOVE the line, on the side of it his work begins.
// A double switch can set both on one box; the two numbers never collide
// because they take opposite sides of the same rule.
//
// Three marks the paper sheet carries that this box also draws:
//  • `note` — the scorer's own override (lib/scorecardNotes.js): the outcome
//    box, the center chain and the RBI box each yield to the penciled-over
//    value when one is set, and the box wears a small amber corner so a
//    hand-edited cell is tellable from a derived one at a glance. An override
//    restyles THIS BOX only — every tally keeps reading the feed.
//  • `endsHalf` (on the card) — the end-of-inning slash, drawn diagonally
//    across the LOWER-RIGHT CORNER of the box of the plate appearance that
//    closed the half. This is the scorer's standard mark for "the inning
//    ended here" and it is the sheet's only one: it goes on the last box of
//    the half itself, never on a later batter's.
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
// Outcome: the out CATEGORY for an out — SO, GO, FO, LO, DP — the result code
// itself for a hit / error / reach, blank for an interrupted at-bat (its
// carry-over mark goes mid-diamond instead), and "AR" for the placed automatic
// runner, the mark scorers put where a batting result would go (same pill
// PlacedRunnerCard shows live).
// Center: the fielding chain for an out — 4-3, F7, L3, 6-4-3 — or the
// interrupted carry-over ("CS →"). `centerCode`, not the raw `code`, so a
// GIDP's two-line play-by-play mark doesn't arrive as one unwrappable run —
// the outcome box above already reads "DP".
//
// THE BACKWARDS K IS A CENTER MARK, not an outcome. A called third strike is
// still a strikeout, so the box reads SO like any other; what tells it apart is
// the ꓘ a scorer draws where the K would go, in the middle of the diamond. It
// used to sit in the outcome box INSTEAD of the SO, which left the sheet's one
// column of out categories with a hole in it and put the strikeout's own
// notation nowhere. Its `code` is often empty on a called strike (see
// entriesView's `atbat.code || 'K'`), so the glyph is written here rather than
// read off the feed.
export function atBatMarks(atbat) {
  const isPlaced = atbat?.kind === 'placed'
  const kind = atbat?.codeKind ?? ''
  const outcome = isPlaced
    ? 'AR'
    : kind === 'out'
      ? atbat?.outType ?? ''
      : kind === 'interrupted'
        ? ''
        : atbat?.code ?? ''
  const centerText = atbat?.centerCode ?? atbat?.code ?? ''
  const center =
    kind === 'out'
      ? atbat?.calledLooking
        ? 'ꓘ'
        : centerText
      : kind === 'interrupted'
        ? centerText
        : ''
  const rbi = !isPlaced && atbat?.rbi ? String(atbat.rbi) : ''
  return { isPlaced, kind, outcome, center, rbi }
}

export function AtBatBox({
  atbat = null,
  note = null,
  onEdit = null,
  fresh = false,
  subJersey = null,
  pitcherJersey = null,
}) {
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

  const handover = subJersey != null || pitcherJersey != null

  return (
    <div
      className={`sc-ab ${note ? 'sc-ab--noted' : ''} ${
        atbat?.endsHalf ? 'sc-ab--halfend' : ''
      } ${fresh ? 'sc-ab--fresh' : ''} ${handover ? 'sc-ab--handover' : ''}`}
    >
      {handover && (
        <span className="sc-sub" aria-hidden="true">
          {pitcherJersey != null && <span className="sc-sub__num sc-sub__num--pitcher">{pitcherJersey}</span>}
          <span className="sc-sub__rule" />
          {subJersey != null && <span className="sc-sub__num sc-sub__num--batter">{subJersey}</span>}
        </span>
      )}
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
