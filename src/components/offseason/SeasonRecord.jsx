import { useRouteLink } from '../../lib/nav.js'
import { SPORT_IDS } from '../../lib/teams.js'

// THE SEASON RECORD — the one door on the offseason page that opens onto
// results (issue #1078, step 4 of #1038).
//
// Everything else on this page is neutral by construction. The wire is roster
// moves, the promotions list is careers, the picked game is sealed and its
// reason line counts people, and the notebook note is a length and an age. This
// row is the exception, and it is drawn as one: kraft tape down its left edge,
// the app's one colour for "results are behind this", and a line that says so
// in words before a reader commits a tap.
//
// It is a LABEL, not a seal. A SealBox withholds a value from the DOM until it
// is revealed (ADR-0001/0002), and that is the right machinery for a score on a
// scoring surface. It is the wrong machinery here: the standings page and the
// postseason pages have always opened live (ADR-0034, "the cutoff is opt-in
// now"), and wrapping a LINK TO THEM in a seal would claim a protection the
// destination does not have. What the reader is owed is a warning, which is
// what the design study asked for and what #1078 specifies: "It opens on a
// clearly labelled link and does not mark every game or date revealed." So
// nothing here persists, reveals or consents. It is a signpost.
//
// MLB GOES INWARD, THE MINOR LEVELS GO OUT. Tally has a standings page and a
// postseason history for MLB and has neither for the minors, and the reason
// that gap is not closed here is not effort. A minor league's qualification
// runs on HALVES, and while statsapi publishes a first-half and second-half
// record for all eleven leagues in 2026 — checked, and the two halves sum to
// the full record at every level including Triple-A — that says the data
// exists, not that the league qualifies its clubs by it. The published
// tiebreakers start with head-to-head play within the half, and the
// repeated-half-winner case is not settled by the official procedures page at
// all. A standings table Tally drew from full-season wins would be a confident
// wrong answer about who got in. So the minors link out, plainly labelled as
// leaving, until those rules are validated.
//
// The outbound links go to MiLB's index pages rather than to a per-league slug.
// A league slug cannot be checked from outside: milb.com is a single-page app
// and returns 200 with the same title for a league that does not exist, so a
// guessed slug fails silently into a generic page. The index is the honest one.
const MILB_STANDINGS = 'https://www.milb.com/standings'
const MILB_POSTSEASON = 'https://www.milb.com/events/playoffs' // word-choice-exempt: MiLB's own address, not our word for October

export function SeasonRecord({ sportId, season }) {
  const linkProps = useRouteLink()
  const inward = sportId === SPORT_IDS.MLB

  return (
    <section className="srecord" aria-label={`The ${season} season record`}>
      {/* The tape itself carries no information, so it is hidden from the
          reading order — the warning below is in words, never in the colour
          alone. */}
      <div className="srecord__tape" aria-hidden="true" />
      <div className="srecord__body">
        {/* Mixed case in the markup, shouted by the CSS — the app's ALL-CAPS
            invariant is never a per-component .toUpperCase() (ADR-0017). */}
        <h3 className="srecord__title">Season record</h3>
        <p className="srecord__note">
          {inward
            ? `How the ${season} season finished, and every postseason series.`
            : `How the ${season} season finished, on MiLB.com.`}{' '}
          <strong>Opening this shows results.</strong>
        </p>

        <div className="srecord__doors">
          {inward ? (
            <>
              <a className="srecord__door" {...linkProps('/standings')}>
                Final standings
              </a>
              <a className="srecord__door" {...linkProps('/postseason-history')}>
                The postseason
              </a>
            </>
          ) : (
            <>
              <a
                className="srecord__door"
                href={MILB_STANDINGS}
                target="_blank"
                rel="noopener noreferrer"
              >
                Standings
                <span className="srecord__out" aria-hidden="true">
                  ↗
                </span>
                <span className="sr-only">opens MiLB.com</span>
              </a>
              <a
                className="srecord__door"
                href={MILB_POSTSEASON}
                target="_blank"
                rel="noopener noreferrer"
              >
                The postseason
                <span className="srecord__out" aria-hidden="true">
                  ↗
                </span>
                <span className="sr-only">opens MiLB.com</span>
              </a>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
