import { useRouteLink } from '../../lib/nav.js'
import { SPORT_IDS } from '../../lib/teams.js'
import { usePostseasonBracket } from '../../hooks/postseason/usePostseasonBracket.js'
import { PostseasonBracket } from '../bracket/PostseasonBracket.jsx'
import { Card } from '../ui/frame/Card.jsx'
import { SectionHead } from '../ui/frame/SectionHead.jsx'
import { recordRowIsLabelled } from '../../lib/postseason/bracketDisplay.js'
import { Cluster } from '../ui/layout/Cluster.jsx'

// THE SEASON RECORD — the one door on the offseason page that opens onto
// results (issue #1078, step 4 of #1038; the MLB champion, #1224 slice 7).
//
// Everything else on this page is neutral by construction. The wire is roster
// moves, the promotions list is careers, the picked game is sealed and its
// reason line counts people, and the notebook note is a length and an age.
// This row is the exception: it names how the season and its postseason
// finished, and — at MLB, for the whole offseason — it carries the champion
// on its own face.
//
// It is a LABEL, not a seal. A SealBox withholds a value from the DOM until it
// is revealed (ADR-0001/0002), and that is the right machinery for a score on a
// scoring surface. It is the wrong machinery here: the standings page and the
// postseason pages have always opened live (ADR-0034, "the cutoff is opt-in
// now"), and wrapping a LINK TO THEM — or the champion, already on the row's
// own face — in a seal would claim a protection the destination does not
// have. So nothing here persists, reveals or consents. It is a signpost, not
// a cover (ADR-0081's addendum records why the row's tape and its warning
// line came off: a warning in front of a result already on the face is
// false).
//
// THE CHAMPION IS SLICE 3's, NEVER THE HISTORY FILE. `usePostseasonBracket`
// reads the live schedule the same way the home page's bracket does
// (`docs/api/postseason.md`), so the row is correct the day after the World
// Series ends with no hand-run step. `PostseasonBracket` is reused as-is,
// depended on only by its props (`bracket`, `cutoff`) — its own folded view
// already puts the champion on its face with a tap behind "Open the bracket"
// for the full bracket, which is exactly what this row asks for. Nothing
// renders while there is no champion yet (a defensive branch: the offseason
// page opens only once the World Series is over).
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
// leaving, until those rules are validated. No bracket, and no champion,
// folds into a minor level's row: MLB only (build-prompt section 6).
//
// The outbound links go to MiLB's index pages rather than to a per-league slug.
// A league slug cannot be checked from outside: milb.com is a single-page app
// and returns 200 with the same title for a league that does not exist, so a
// guessed slug fails silently into a generic page. The index is the honest one.
const MILB_STANDINGS = 'https://www.milb.com/standings'
const MILB_POSTSEASON = 'https://www.milb.com/events/playoffs' // word-choice-exempt: MiLB's own address, not our word for October

export function SeasonRecord({ sportId, season, dateStr }) {
  const linkProps = useRouteLink()
  const inward = sportId === SPORT_IDS.MLB
  const { bracket, cutoff } = usePostseasonBracket(inward ? dateStr : null, { season })
  const champion = bracket?.champion ?? null
  const labelled = recordRowIsLabelled(champion)

  return (
    <Card body="flush" className={`srecord${labelled ? ' srecord--labelled' : ''}`} aria-label={`The ${season} season record`}>
      {/* A row with no champion on its face only links to results, so it
          keeps its tape and its warning (ADR-0081 addendum). The tape is
          hidden from the reading order; the warning is in words. */}
      {labelled && <div className="srecord__tape" aria-hidden="true" />}
      <div className="srecord__body">
        {/* Mixed case in the markup, shouted by the CSS — the app's ALL-CAPS
            invariant is never a per-component .toUpperCase() (ADR-0017). */}
        <SectionHead look="label">Season record</SectionHead>
        <p className="srecord__note">
          {inward
            ? `How the ${season} season finished, and every postseason series.`
            : `How the ${season} season finished, on MiLB.com.`}
          {labelled && (
            <>
              {' '}
              <strong>Opening this shows results.</strong>
            </>
          )}
        </p>

        {champion && <PostseasonBracket bracket={bracket} cutoff={cutoff} autoOpen={false} />}

        <Cluster gap="base" className="srecord__doors">
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
        </Cluster>
      </div>
    </Card>
  )
}
