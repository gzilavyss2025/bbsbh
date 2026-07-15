import { useEffect, useRef, useState } from 'react'
import { ordinal } from '../api/person.js'
import { leagueRank } from '../api/teamScore.js'
import { qualityScoreFromGames, CURRENT_FORM_GAMES } from '../api/teamScoreFormula.js'
import { teamClubName } from '../lib/teams.js'

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
// The 1998 Yankees (114-48, +309 run differential) — a real, widely-known
// dominant season, run through the formula as the Season grade's contrasting
// ceiling (it isn't boxed in the way the fixed 10-game Current Form window is).
const DOMINANT_SEASON = qualityScoreFromGames({
  wins: 114, games: 162, runsScored: 965, runsAllowed: 656,
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

export function TeamScoreCard({ snapshot, surprise, teamId, leagueSeasonScores = [], leagueFormScores = [] }) {
  const [open, setOpen] = useState(null)
  const [showHow, setShowHow] = useState(false)
  const detail = open === 'season' ? snapshot.season : open === 'form' ? snapshot.currentForm : null
  const toggle = (next) => setOpen((current) => (current === next ? null : next))
  const seasonRank = leagueRank(leagueSeasonScores, teamId)
  const formRank = leagueRank(leagueFormScores, teamId)

  return (
    <section className={`team-score${open ? ' is-open' : ''}`} aria-label={`Team scores through ${snapshot.asOf}`}>
      <div className="team-score__head">
        <span>Team Scores</span>
        <em>through {snapshot.asOf}</em>
      </div>

      <ScoreRow
        label="Season"
        summary={snapshot.season}
        rank={seasonRank}
        league={leagueSeasonScores}
        teamId={teamId}
        isOpen={open === 'season'}
        onToggle={() => toggle('season')}
      />
      <ScoreRow
        label={`Last ${snapshot.currentForm?.games ?? CURRENT_FORM_GAMES}`}
        summary={snapshot.currentForm}
        rank={formRank}
        league={leagueFormScores}
        teamId={teamId}
        isOpen={open === 'form'}
        onToggle={() => toggle('form')}
      />

      {detail && (
        <div id="team-score-detail" className="team-score__detail">
          <dl>
            <div><dt>Record</dt><dd>{record(detail)}</dd></div>
            <div><dt>Run differential</dt><dd>{signed(detail.runDifferential)}</dd></div>
            <div><dt>Expected wins from run differential</dt><dd>{detail.pythagWins.toFixed(1)}</dd></div>
            {open === 'season' && surprise && (
              <div><dt>Season Surprise</dt><dd>{signed(surprise.residualWins)} wins</dd></div>
            )}
          </dl>
        </div>
      )}

      <button type="button" className="team-score__howlink" onClick={() => setShowHow(true)}>
        How this is calculated
      </button>

      {showHow && (
        <TeamScoreExplainer snapshot={snapshot} onClose={() => setShowHow(false)} />
      )}
    </section>
  )
}

function ScoreRow({ label, summary, rank, league, teamId, isOpen, onToggle }) {
  return (
    <div className="team-score__row">
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
      {summary?.score != null && league.length > 0 && (
        <LeagueTrack league={league} ownScore={summary.score} teamId={teamId} />
      )}
      <span className="team-score__meta">{meta(summary)}</span>
    </div>
  )
}

// 30 teams' scores cluster heavily (Current Form especially bunches near
// .500), so dots land well within a dot-width of each other even when their
// scores differ — not just exact ties. Left uncorrected, whichever dot
// paints last simply steals every pointer event in that stretch of the rail.
// A small beeswarm packer fixes it: walk scores low to high, and give each
// dot the first vertical row whose last-placed dot is far enough away
// horizontally, opening a new row only when every existing one is still too
// close. MIN_GAP_PCT is a percent-of-track-width stand-in for the dot's own
// ~5px footprint (the track has no fixed pixel width to measure against).
const MIN_GAP_PCT = 1.6
const ROW_STEP_PX = 5

function beeswarmRows(rows) {
  const sorted = [...rows].sort((a, b) => a.score - b.score)
  const rowEdges = []
  return sorted.map((r) => {
    const pct = (r.score / 10) * 100
    let rowIndex = rowEdges.findIndex((edge) => pct - edge >= MIN_GAP_PCT)
    if (rowIndex === -1) {
      rowIndex = rowEdges.length
      rowEdges.push(pct)
    } else {
      rowEdges[rowIndex] = pct
    }
    // Row 0 stays on the rail; rows 1, 2, 3... alternate below/above it at
    // growing distance, so a small cluster only nudges slightly off-center
    // and a big one fans out symmetrically rather than stacking one-sided.
    const magnitude = Math.ceil(rowIndex / 2) * ROW_STEP_PX
    const rowOffset = rowIndex === 0 ? 0 : rowIndex % 2 === 1 ? magnitude : -magnitude
    return { ...r, rowOffset }
  })
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
function TeamScoreExplainer({ snapshot, onClose }) {
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
  const form = snapshot.currentForm

  return (
    <div className="scrim scrim--center" onClick={(e) => e.target.classList.contains('scrim') && onClose()}>
      <div className="sheet tscoremodal" role="dialog" aria-modal="true" aria-label="How the Team Score is calculated">
        <div className="tscoremodal__head">
          <p className="tscoremodal__kicker">How We Score It</p>
          <button ref={closeRef} type="button" className="gsmodal__close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <h2 className="sheet__title tscoremodal__title">
          Record tells you what happened. Run differential tells you what should have.
        </h2>

        <div className="sheet__body tscoremodal__body">
          <p>
            Every front office in baseball has argued some version of this at the trade
            deadline: is a team its record, or is it its process? A club can win a lot of
            close games on timely hits and a shaky bullpen holding on; another can lose a
            string of one-run games while outscoring everybody by a wide margin. Ask which
            team is actually better, and “check the standings” isn’t a full answer. That’s
            the question this grade is trying to settle.
          </p>
          <p>
            So it splits the difference on purpose. Sixty percent of the number is just the
            record — wins are wins, and pretending otherwise is its own kind of dishonesty.
            The other forty percent comes from run differential, run through a formula
            that’s been reliable since Bill James started tinkering with it decades ago:
            score X runs, allow Y, and it estimates how many games a team like that “should”
            win over a long season. Outscore people by a lot and lose anyway, and this grade
            notices before the standings do.
          </p>
          {season && (
            <dl className="tscoremodal__figs">
              <div><dt>Record</dt><dd>{record(season)}</dd></div>
              <div><dt>Run differential</dt><dd>{signed(season.runDifferential)}</dd></div>
              <div><dt>“Should-have” wins from runs</dt><dd>{season.pythagWins.toFixed(1)}</dd></div>
              <div><dt>Blended grade</dt><dd>{scoreValue(season)} / 10</dd></div>
            </dl>
          )}
          <p>
            From there it’s just translation. Both numbers get folded together and measured
            against .500 — a perfectly average club — so 5.0 is a coin flip, not a bad
            score. Climb from there and the air gets thinner on purpose: an 8 is a real
            contender, and a 9-plus is the kind of number a small handful of all-time teams
            post over a full season. Nobody backs into one on a hot week.
          </p>
          <p className="tscoremodal__pull">
            “Give it ten games before you trust it” is the honest caveat here — small
            samples lie, and this grade knows it.
          </p>
          <p>
            A club doesn’t get graded at all until it’s played ten games, and even past
            that, the model stays a little skeptical of a short track record. That’s not
            the model hedging; that’s the model doing exactly what a good scout does before
            he files a report.
          </p>

          <p className="tscoremodal__subkicker">And About That “Last {CURRENT_FORM_GAMES}” Number</p>
          <p>
            Here’s the part worth sitting with: Last {CURRENT_FORM_GAMES} runs through the
            exact same math as Season — same 60/40 blend, same run-differential formula,
            same .500 center point. Nothing about the recipe changes. What’s different is
            that Season gets a whole season’s worth of games to work with, while Last{' '}
            {CURRENT_FORM_GAMES} is locked to the smallest sample the model considers
            trustworthy at all, and never gets to grow past it.
          </p>
          <p>
            That has a real consequence, and it’s a useful one: the number is structurally
            boxed in. Run the math on a team that wins all {CURRENT_FORM_GAMES} of its last
            games, blowing teams out combined — the kind of stretch that would lead every
            broadcast in the country — and the grade still only reaches{' '}
            <strong>{FORM_CEILING.score.toFixed(1)}</strong>. Lose all {CURRENT_FORM_GAMES}{' '}
            just as lopsidedly and it bottoms out at <strong>{FORM_FLOOR.score.toFixed(1)}</strong>.
            It physically cannot go higher or lower than that, because {CURRENT_FORM_GAMES}{' '}
            games isn’t enough evidence for the model to declare a team either historically
            great or completely finished. Season, by contrast, can climb toward{' '}
            {DOMINANT_SEASON.score.toFixed(1)} with a full year of sustained dominance — the
            1998 Yankees’ number, run through this same formula.
          </p>
          {form && (
            <dl className="tscoremodal__figs">
              <div><dt>Best possible {CURRENT_FORM_GAMES}-game stretch</dt><dd>{FORM_CEILING.score.toFixed(1)}</dd></div>
              <div><dt>Worst possible {CURRENT_FORM_GAMES}-game stretch</dt><dd>{FORM_FLOOR.score.toFixed(1)}</dd></div>
              <div><dt>A historically dominant full season*</dt><dd>{DOMINANT_SEASON.score.toFixed(1)}</dd></div>
              <div><dt>Your last {CURRENT_FORM_GAMES}</dt><dd>{record(form)} · {scoreValue(form)}</dd></div>
            </dl>
          )}
          <p>
            So read “Last {CURRENT_FORM_GAMES}” for what it’s built to tell you — is the
            team hot or cold right now, relative to itself — and leave the verdict on who
            the team actually is to Season, which has earned the right to swing wider
            because it’s seen more games to back it up.
          </p>
          <p className="tscoremodal__foot">
            * The 1998 Yankees went 114–48 with a +309 run differential.
          </p>
        </div>
      </div>
    </div>
  )
}
