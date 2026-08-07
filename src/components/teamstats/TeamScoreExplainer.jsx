import { useEffect, useRef } from 'react'
import { currentFormScoreFromGames, CURRENT_FORM_GAMES } from '../../api/teamScoreFormula.js'
import { HOME_WIN_PROBABILITY } from '../../api/seasonScoreFormula.js'
import { record, signed, scoreValue, rate3 } from './TeamScoreCard.jsx'

// Illustrative anchors for the "How this is calculated" modal — run through
// the same formula the app scores real teams with (see teamScoreFormula.js),
// not hand-typed numbers, so they can't drift if the formula ever changes.
const FORM_CEILING = currentFormScoreFromGames({
  wins: CURRENT_FORM_GAMES, games: CURRENT_FORM_GAMES, runsScored: 80, runsAllowed: 5,
})
const FORM_FLOOR = currentFormScoreFromGames({
  wins: 0, games: CURRENT_FORM_GAMES, runsScored: 5, runsAllowed: 80,
})

// "How this is calculated" — a beat-writer-voiced explainer rather than a
// formula dump, opened from the card's footer link. Same .scrim/.sheet dialog
// contract as UmpireAccuracyModal (Escape + backdrop-tap close, focus moves
// to the close button and back to the trigger on close).
export function TeamScoreExplainer({ snapshot, surprise, grade, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const closeRef = useRef(null)
  useEffect(() => {
    const trigger = document.activeElement
    closeRef.current?.focus()
    return () => {
      if (trigger instanceof HTMLElement) trigger.focus()
    }
  }, [])

  const season = snapshot.season

  return (
    <div className="scrim scrim--center" onClick={(e) => e.target.classList.contains('scrim') && onClose()}>
      <div className="sheet tscoremodal" role="dialog" aria-modal="true" aria-label="How the Season Grade is calculated">
        <div className="tscoremodal__head">
          <p className="tscoremodal__kicker">How We Score It</p>
          <button ref={closeRef} type="button" className="gsmodal__close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <h2 className="sheet__title tscoremodal__title">
          How good have they been — and how much have they exceeded the assignment?
        </h2>

        <div className="sheet__body tscoremodal__body">
          <p>
            Season Grade is a verdict on the season a club is having, not a forecast of what
            happens next. It starts with Quality — how strong the team has actually played —
            then gives credit or blame for performing differently from its preseason
            expectation. The two ingredients stay visible because they answer different
            baseball questions.
          </p>

          <p className="tscoremodal__subkicker">Quality is the foundation</p>
          <p>
            Quality gives 60 percent of the weight to actual wins and 40 percent to the wins
            suggested by run differential — adjusted so a hitter&apos;s park or a pitcher&apos;s park
            doesn&apos;t inflate or deflate that half&apos;s verdict. That keeps the standings in
            charge while noticing when a pile of close wins or losses makes the record look
            stronger or weaker than the club&apos;s overall play. A capped strength-of-schedule
            adjustment then rewards a tough slate of opponents and discounts a soft one.
          </p>
          {season && (
            <dl className="tscoremodal__figs">
              <div><dt>Record</dt><dd>{record(season)}</dd></div>
              <div><dt>Run differential</dt><dd>{signed(season.runDifferential)}</dd></div>
              {season.avgParkFactor != null && (
                <div><dt>Park factor faced</dt><dd>{season.avgParkFactor.toFixed(2)}× · {signed(season.parkAdjustedRunDifferential)} park-adjusted</dd></div>
              )}
              <div><dt>“Should-have” wins from runs</dt><dd>{season.pythagWins.toFixed(1)}</dd></div>
              {season.avgOpponentWinPct != null && (
                <div><dt>Strength of schedule</dt><dd>{rate3(season.avgOpponentWinPct)} avg opponent · {signed(season.sosAdjustment)} wins</dd></div>
              )}
              <div><dt>Quality</dt><dd>{scoreValue(season)} / 10</dd></div>
            </dl>
          )}

          <p className="tscoremodal__subkicker">Expectation measures the assignment</p>
          <p>
            Before Opening Day, every club gets a baseline from the consensus market win
            total; when that is unavailable, a regressed three-year record supplies a
            clearly labeled fallback. Each game then carries a schedule-adjusted expectation
            based on the two teams, the venue, and each club&apos;s own trailing home-field
            record. Actual wins above or below that running total become the Vs. expectation
            score: 5.0 means the club is exactly on assignment.
          </p>
          {surprise && (
            <dl className="tscoremodal__figs">
              <div><dt>Preseason expectation{surprise.baselineKind === 'marcel' ? ' (model)' : ''}</dt><dd>{surprise.baselineWins.toFixed(1)} wins</dd></div>
              <div><dt>Expected through this date</dt><dd>{surprise.expectedWinsToDate.toFixed(1)}</dd></div>
              {surprise.homeFieldFactor != null && (
                <div><dt>Home-field edge</dt><dd>{(surprise.homeFieldFactor * 100).toFixed(1)}% (league {(HOME_WIN_PROBABILITY * 100).toFixed(1)}%)</dd></div>
              )}
              <div><dt>Actual wins</dt><dd>{surprise.wins}</dd></div>
              <div><dt>Vs. expectation</dt><dd>{scoreValue(surprise)} · {signed(surprise.residualWins)} wins</dd></div>
            </dl>
          )}

          <p className="tscoremodal__subkicker">The adjustment respects baseball quality</p>
          <p>
            Surprise does not get averaged straight into Quality. Instead, it adjusts only
            the room between Quality and the top or bottom of the scale. That means a major
            overachievement can elevate an average-quality season, but it cannot casually
            push that team past a genuinely dominant club. Underachievement works the same
            way in the other direction.
          </p>
          {grade && (
            <dl className="tscoremodal__figs">
              <div><dt>Quality foundation</dt><dd>{grade.quality.toFixed(1)}</dd></div>
              <div><dt>Expectation adjustment</dt><dd>{signed(grade.adjustment)}</dd></div>
              <div><dt>Season Grade</dt><dd>{grade.score.toFixed(1)} / 10</dd></div>
            </dl>
          )}

          <p className="tscoremodal__pull">
            A 5.0 is neutral: average quality, or exactly meeting expectation. The farther
            a score moves from five, the stronger the evidence behind the verdict.
          </p>

          <p className="tscoremodal__subkicker">Current form stays a diagnostic</p>
          <p>
            Last {CURRENT_FORM_GAMES} uses the same Quality recipe over only the most recent
            games. Even a perfect stretch is intentionally damped to {FORM_CEILING.score.toFixed(1)},
            and a winless one bottoms out at {FORM_FLOOR.score.toFixed(1)}. It can explain
            how the club arrived here, but it does not secretly change the Season Grade.
          </p>
        </div>
      </div>
    </div>
  )
}
