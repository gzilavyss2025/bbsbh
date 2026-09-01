import { PlayDiamond } from './PlayDiamond.jsx'
import { PlayerLink } from '../player/PlayerLink.jsx'
import { StruckLine } from './StruckLine.jsx'

// The extra-innings automatic runner's card — the placed runner gets his own
// row at the head of the half, above the leadoff batter, which is both where
// the feed posts him (a non-pitch playEvent at the head of the half's first
// plate appearance) and the order a scorer works in: place the runner, then
// start the inning.
//
// Deliberately the at-bat card's frame with pieces REMOVED rather than a
// different-looking card. He isn't a notification (no kraft-amber bar, see
// ADR-0017) — he's a live baserunner whose trip gets notated exactly like
// everyone else's, so his diamond has to sit in the same place and read the
// same way. What's missing is what says "not a plate appearance":
//
//  • no ball/strike ladder — no pitches were thrown to him, and the absent
//    lane is the clearest at-a-glance signal that this isn't an at-bat
//  • no RBI chip — he can't drive himself in
//  • no result code over the diamond; the AR pill takes the top-right slot
//    the RBI chip would occupy instead
//
// The pill reads AR (automatic runner) — the mark scorers put where a batting
// result would go. Books differ (AR / XIR / GR); AR is the most widely used,
// and the card's own sentence explains it besides. Penciled graphite, not the
// RBI chip's green: nothing was earned here.
//
// The diamond does the real work — see PlayDiamond's `placedAt`, which dots
// the bases he was GIVEN and inks everything past them normally. His run, when
// it comes, is unearned by rule and the feed says so, so the existing red
// circled-run ring fires on its own.
export function PlacedRunnerCard({ entry, writing = false }) {
  const { runner, base, code, descSegments, reached, scored, earned, legNotations, outNumber, outAt, outCode, pinchRunners } = entry
  // Same strike-through-and-pencil-in as an at-bat card: a pinch runner for
  // the placed runner inherits this card (rootRunner/prAlias resolve to it),
  // and the diamond's red PR sits by the base he took over at.
  const replaced = pinchRunners && pinchRunners.length > 0
  const prBase = replaced ? pinchRunners[pinchRunners.length - 1].base : null
  return (
    <div className={`pbp__atbat${writing ? ' pbp__atbat--writing' : ''}`}>
      <div className="pbp__card pbp__card--placed">
        <div className="pbp__main">
          <div className="pbp__top">
            <span className="pbp__batter">
              <StruckLine
                struck={replaced}
                className={`pbp__batline ${replaced ? 'pbp__replaced' : ''}`}
              >
                <PlayerLink
                  id={runner.id}
                  name={[runner.first, runner.last].filter(Boolean).join(' ')}
                >
                  {runner.last}
                  {runner.first ? `, ${runner.first}` : ''}
                </PlayerLink>
                {runner.pos && <span className="pbp__pos">{runner.pos}</span>}
              </StruckLine>
              {pinchRunners?.map((pr, i) => (
                <StruckLine
                  key={pr.id}
                  struck={i < pinchRunners.length - 1}
                  className={`pbp__batline ${i < pinchRunners.length - 1 ? 'pbp__replaced' : ''}`}
                >
                  <PlayerLink id={pr.id} name={[pr.first, pr.last].filter(Boolean).join(' ')}>
                    {pr.last}
                    {pr.first ? `, ${pr.first}` : ''}
                  </PlayerLink>
                  <span className="pbp__pos">PR</span>
                </StruckLine>
              ))}
            </span>
            <span className="pbp__placed" title="Automatic runner">
              {code}
            </span>
          </div>
          <div className="pbp__desc">
            {descSegments.map((seg, i) =>
              seg.id != null ? (
                <span key={i} className="pbp__name">
                  {seg.text}
                </span>
              ) : (
                seg.text
              ),
            )}
          </div>
        </div>
        <div className="pbp__side">
          <div className="pbp__play">
            <PlayDiamond
              reached={reached}
              scored={scored}
              earned={earned}
              legNotations={legNotations}
              outAt={outAt}
              outCode={outCode}
              prBase={prBase}
              placedAt={base}
            />
            {/* The out-sequence circle, same badge an at-bat card carries. The
                automatic runner is retired on the bases often (doubled off,
                forced at 3rd on the leadoff bunt) and computeHalfInningFeed's
                runner-out attribution writes his outNumber/outAt/outCode onto
                THIS card like any other origin card — without the badge the
                diamond showed the capped path and the tag chain but not which
                out of the inning it was, the one piece of his trip that
                didn't get notated like everyone else's. */}
            {outNumber != null && (
              <span className="pbp__outcircle" aria-label={`Out ${outNumber} of the inning`}>
                {outNumber}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
