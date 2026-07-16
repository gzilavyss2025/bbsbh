import { useEffect, useRef, useState } from 'react'
import { ordinal } from '../api/person.js'
import { leagueRank } from '../api/teamScore.js'
import { qualityScoreFromGames, CURRENT_FORM_GAMES } from '../api/teamScoreFormula.js'
import { seasonGradeFor } from '../api/seasonGradeFormula.js'
import { teamClubName } from '../lib/teams.js'
import { beeswarmRows } from '../lib/beeswarm.js'

const DASH = '—'
const signed = (n) => `${n >= 0 ? '+' : ''}${n}`

// Illustrative anchors for the "How this is calculated" modal — run through
// the same formula the app scores real teams with (see teamScoreFormula.js),
// not hand-typed numbers, so they can't drift if the formula ever changes.
const FORM_CEILING = qualityScoreFromGames({
  wins: CURRENT_FORM_GAMES, games: CURRENT_FORM_GAMES, runsScored: 80, runsAllowed: 5,
})
const FORM_FLOOR = qualityScoreFromGames({
  wins: 0, games: CURRENT_FORM_GAMES, runsScored: 5, runsAllowed: 80,
})
function scoreValue(summary) {
  return summary?.score == null ? DASH : summary.score.toFixed(1)
}

function record(summary) {
  return summary ? `${summary.wins}–${summary.losses}` : DASH
}

function meta(summary) {
  if (!summary) return ''
  return `${record(summary)} · ${signed(summary.runDifferential)} run differential`
}

function gradeLabel(score) {
  if (score >= 9) return 'Exceptional'
  if (score >= 8) return 'Elite'
  if (score >= 7) return 'Strong'
  if (score >= 6) return 'Above average'
  if (score >= 4.5) return 'Average'
  if (score >= 3) return 'Below average'
  if (score >= 2) return 'Poor'
  return 'Dismal'
}

export function TeamScoreCard({
  snapshot,
  surprise,
  teamId,
  leagueGradeScores = [],
  leagueSeasonScores = [],
  leagueSurpriseScores = [],
  leagueFormScores = [],
}) {
  const [open, setOpen] = useState(null)
  const [showHow, setShowHow] = useState(false)
  const toggle = (next) => setOpen((current) => (current === next ? null : next))
  const grade = seasonGradeFor(snapshot.season, surprise)
  const gradeSummary = grade ? { ...snapshot.season, score: grade.score } : null
  const gradeRank = leagueRank(leagueGradeScores, teamId)
  const qualityRank = leagueRank(leagueSeasonScores, teamId)
  const surpriseRank = leagueRank(leagueSurpriseScores, teamId)
  const formRank = leagueRank(leagueFormScores, teamId)

  return (
    <section className={`team-score${open ? ' is-open' : ''}`} aria-label={`Season Grade through ${snapshot.asOf}`}>
      <div className="team-score__head">
        <span>Season report</span>
        <em>through {snapshot.asOf}</em>
      </div>

      <GradeHero
        grade={grade}
        summary={gradeSummary}
        rank={gradeRank}
        league={leagueGradeScores}
        teamId={teamId}
        isOpen={open === 'grade'}
        onToggle={() => toggle('grade')}
      />

      <div className="team-score__driver-group">
        <span className="team-score__driver-heading">What built the grade</span>
        <div className="team-score__drivers" aria-label="Season Grade drivers">
          <ScoreRow
            label="Quality"
            summary={snapshot.season}
            rank={qualityRank}
            metaText={meta(snapshot.season)}
            isOpen={open === 'quality'}
            onToggle={() => toggle('quality')}
            driver
          />
          <ScoreRow
            label="Vs. expectation"
            summary={surprise}
            rank={surpriseRank}
            metaText={surprise ? `${signed(surprise.residualWins)} wins vs. expected` : ''}
            isOpen={open === 'surprise'}
            onToggle={() => toggle('surprise')}
            driver
          />
        </div>
      </div>

      <ScoreRow
        label={`Current form · Last ${snapshot.currentForm?.games ?? CURRENT_FORM_GAMES}`}
        summary={snapshot.currentForm}
        rank={formRank}
        metaText={meta(snapshot.currentForm)}
        isOpen={open === 'form'}
        onToggle={() => toggle('form')}
        compact
      />

      {open && <ScoreDetail kind={open} grade={grade} quality={snapshot.season} surprise={surprise} form={snapshot.currentForm} />}

      <button type="button" className="team-score__howlink" onClick={() => setShowHow(true)}>
        How this is calculated
      </button>

      {showHow && (
        <TeamScoreExplainer snapshot={snapshot} surprise={surprise} grade={grade} onClose={() => setShowHow(false)} />
      )}
    </section>
  )
}

function GradeHero({ grade, summary, rank, league, teamId, isOpen, onToggle }) {
  return (
    <div className={`team-score__grade${isOpen ? ' is-active' : ''}`}>
      <button
        type="button"
        className="team-score__grade-button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={isOpen ? 'team-score-detail' : undefined}
      >
        <span className="team-score__grade-copy">
          <span className="team-score__grade-kicker">Season Grade</span>
          <strong>{grade ? gradeLabel(grade.score) : 'Not yet graded'}</strong>
          <span>Quality, adjusted for the assignment</span>
        </span>
        <span className="team-score__grade-result">
          {rank && <span className="team-score__rank">{ordinal(rank.rank)} of {rank.of}</span>}
          <span className="team-score__grade-score">
            {scoreValue(summary)}<small>/10</small>
          </span>
          <span className="team-score__breakdown">{isOpen ? 'Close breakdown' : 'See breakdown'}</span>
        </span>
      </button>
      {summary?.score != null && league.length > 0 && (
        <LeagueTrack league={league} ownScore={summary.score} teamId={teamId} />
      )}
    </div>
  )
}

function ScoreDetail({ kind, grade, quality, surprise, form }) {
  const detail = kind === 'form' ? form : quality
  const title = {
    grade: 'Season Grade breakdown',
    quality: 'Quality breakdown',
    surprise: 'Vs. expectation breakdown',
    form: 'Current form breakdown',
  }[kind]
  return (
    <div id="team-score-detail" className="team-score__detail">
      <p className="team-score__detail-title">{title}</p>
      <dl>
        {kind === 'grade' && grade && (
          <>
            <div><dt>Quality foundation</dt><dd>{grade.quality.toFixed(1)}</dd></div>
            <div><dt>Expectation adjustment</dt><dd>{signed(grade.adjustment)}</dd></div>
            <div><dt>Season Grade</dt><dd>{grade.score.toFixed(1)}</dd></div>
          </>
        )}
        {(kind === 'quality' || kind === 'form') && detail && (
          <>
            <div><dt>Record</dt><dd>{record(detail)}</dd></div>
            <div><dt>Run differential</dt><dd>{signed(detail.runDifferential)}</dd></div>
            <div><dt>Expected wins from run differential</dt><dd>{detail.pythagWins.toFixed(1)}</dd></div>
          </>
        )}
        {kind === 'surprise' && surprise && (
          <>
            <div><dt>Preseason expectation{surprise.baselineKind === 'marcel' ? ' (model)' : ''}</dt><dd>{surprise.baselineWins.toFixed(1)} wins</dd></div>
            <div><dt>Expected through this date</dt><dd>{surprise.expectedWinsToDate.toFixed(1)}</dd></div>
            <div><dt>Actual record</dt><dd>{surprise.wins}–{surprise.losses}</dd></div>
            <div><dt>Above/below expectation</dt><dd>{signed(surprise.residualWins)} wins</dd></div>
          </>
        )}
      </dl>
    </div>
  )
}

function ScoreRow({ label, summary, rank, metaText, isOpen, onToggle, driver = false, compact = false }) {
  return (
    <div className={`team-score__row${driver ? ' team-score__row--driver' : ''}${compact ? ' team-score__row--compact' : ''}${isOpen ? ' is-active' : ''}`}>
      <button
        type="button"
        className={`team-score__rowtop${isOpen ? ' is-active' : ''}`}
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={isOpen ? 'team-score-detail' : undefined}
      >
        <span className="team-score__label">{label}</span>
        <span className="team-score__rowright">
          {rank && <span className="team-score__rank">{ordinal(rank.rank)} of {rank.of}</span>}
          <span className="team-score__score">{scoreValue(summary)}</span>
        </span>
      </button>
      {driver && summary?.score != null && (
        <span className="team-score__meter" aria-hidden="true">
          <span style={{ width: `${summary.score * 10}%` }} />
        </span>
      )}
      {metaText && <span className="team-score__meta">{metaText}</span>}
    </div>
  )
}

// A bullet-chart rail: every other team in the league pool as a small dot at
// its own score, ours as the larger navy marker. Hovering (mouse) or tapping
// (touch) a dot names the team — the rank badge above already names ours, so
// only the other 29 need the on-demand label.
function LeagueTrack({ league, ownScore, teamId }) {
  const [activeId, setActiveId] = useState(null)
  const active = activeId != null ? league.find((r) => r.teamId === activeId) : null
  const dots = beeswarmRows(league.filter((r) => r.teamId !== teamId))

  const show = (id) => setActiveId(id)
  const hide = () => setActiveId(null)
  const tap = (id) => {
    setActiveId(id)
    window.setTimeout(() => setActiveId((current) => (current === id ? null : current)), 2200)
  }

  return (
    <div className="team-score__track">
      <div className="team-score__track-base" />
      <div className="team-score__track-mid" />
      {active && (
        <div className="team-score__tooltip" style={{ left: `${(active.score / 10) * 100}%` }}>
          {teamClubName(active.teamId) ?? DASH} · {active.score.toFixed(1)}
        </div>
      )}
      {dots.map((r) => (
        <button
          key={r.teamId}
          type="button"
          className="team-score__dot"
          style={{ left: `${(r.score / 10) * 100}%`, top: `calc(17px + ${r.rowOffset}px)` }}
          aria-label={`${teamClubName(r.teamId) ?? 'Team'} ${r.score.toFixed(1)}`}
          onMouseEnter={() => show(r.teamId)}
          onMouseLeave={hide}
          onFocus={() => show(r.teamId)}
          onBlur={hide}
          onClick={(e) => {
            e.stopPropagation()
            tap(r.teamId)
          }}
        />
      ))}
      <button
        type="button"
        className="team-score__dot team-score__dot--us"
        style={{ left: `${(ownScore / 10) * 100}%` }}
        aria-label={`Your team ${ownScore.toFixed(1)}`}
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      />
    </div>
  )
}

// "How this is calculated" — a beat-writer-voiced explainer rather than a
// formula dump, opened from the card's footer link. Same .scrim/.sheet dialog
// contract as GameScoreModal (Escape + backdrop-tap close, focus moves to the
// close button and back to the trigger on close).
function TeamScoreExplainer({ snapshot, surprise, grade, onClose }) {
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
            suggested by run differential. That keeps the standings in charge while noticing
            when a pile of close wins or losses makes the record look stronger or weaker than
            the club&apos;s overall play.
          </p>
          {season && (
            <dl className="tscoremodal__figs">
              <div><dt>Record</dt><dd>{record(season)}</dd></div>
              <div><dt>Run differential</dt><dd>{signed(season.runDifferential)}</dd></div>
              <div><dt>“Should-have” wins from runs</dt><dd>{season.pythagWins.toFixed(1)}</dd></div>
              <div><dt>Quality</dt><dd>{scoreValue(season)} / 10</dd></div>
            </dl>
          )}

          <p className="tscoremodal__subkicker">Expectation measures the assignment</p>
          <p>
            Before Opening Day, every club gets a baseline from the consensus market win
            total; when that is unavailable, a regressed three-year record supplies a
            clearly labeled fallback. Each game then carries a schedule-adjusted expectation
            based on the two teams and the venue. Actual wins above or below that running
            total become the Vs. expectation score: 5.0 means the club is exactly on assignment.
          </p>
          {surprise && (
            <dl className="tscoremodal__figs">
              <div><dt>Preseason expectation{surprise.baselineKind === 'marcel' ? ' (model)' : ''}</dt><dd>{surprise.baselineWins.toFixed(1)} wins</dd></div>
              <div><dt>Expected through this date</dt><dd>{surprise.expectedWinsToDate.toFixed(1)}</dd></div>
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
