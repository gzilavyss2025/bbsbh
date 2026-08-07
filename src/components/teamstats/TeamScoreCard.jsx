import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ordinal } from '../../api/person.js'
import { leagueRank, leagueRankNoTies, rankedNoTies } from '../../api/teamScore.js'
import { CURRENT_FORM_GAMES } from '../../api/teamScoreFormula.js'
import { HOME_WIN_PROBABILITY } from '../../api/seasonScoreFormula.js'
import { seasonGradeFor } from '../../api/seasonGradeFormula.js'
import { teamClubName } from '../../lib/teams.js'
import { beeswarmRows } from '../../lib/beeswarm.js'
import { useNav, useLinkScope } from '../../lib/nav.js'
import { teamPath } from '../../lib/route.js'
import { TeamLogo } from '../logo/TeamLogo.jsx'
import { TeamScoreExplainer } from './TeamScoreExplainer.jsx'

export const DASH = '—'
const RANKSTRIP_VISIBLE = 5
const RANKSTRIP_STEP = 38
const RANKSTRIP_STEP_COMPACT = 28
export const signed = (n) => `${n >= 0 ? '+' : ''}${n}`
export const rate3 = (n) => n.toFixed(3).replace(/^(-?)0(?=\.)/, '$1')

export function scoreValue(summary) {
  return summary?.score == null ? DASH : summary.score.toFixed(1)
}

export function record(summary) {
  return summary ? `${summary.wins}–${summary.losses}` : DASH
}

function meta(summary) {
  if (!summary) return ''
  return `${record(summary)} · ${signed(summary.runDifferential)} run differential`
}

// The hero verdict is a quadrant read rather than a single blended-score
// label: Quality (how good) and Vs. expectation (over/under the preseason
// assignment) each land in a high/mid/low tier, and each of the nine cells
// carries a few equivalent phrases so two teams in the same cell don't read
// as copy-pasted — picked deterministically by teamId so a given team's
// wording is stable across visits rather than flickering on reload.
function qualityTier(score) {
  if (score >= 6.5) return 'high'
  if (score <= 3.5) return 'low'
  return 'mid'
}

function trajectoryTier(score) {
  if (score >= 6) return 'high'
  if (score <= 4) return 'low'
  return 'mid'
}

const SEASON_STORYLINES = {
  'high-high': ["Nobody's catching them", 'Making it look easy', 'The class of the league'],
  'high-mid': ['Elite and unsurprising', 'The good kind of predictable', 'No drama, just wins'],
  'high-low': ['Too good to be this frustrating', 'A juggernaut stuck in neutral', 'The record undersells them'],
  'mid-high': ['Doing more with less', 'Winning ugly and loving it', 'Outplaying the roster on paper'],
  'mid-mid': ['Right down the middle', 'The forecast came true', 'Comfortably unremarkable'],
  'mid-low': ['A step behind schedule', 'A modest bar, missed anyway', 'Underachieving, no excuses'],
  'low-high': ['Nobody gave them a chance', 'Punching above their weight', 'Winning above their pay grade'],
  'low-mid': ['A rebuild on schedule', 'Meeting a bar that was set low', 'Nothing unexpected here'],
  'low-low': ['A season that lost the plot', 'Bottoming out and still falling', 'Nowhere to go but up — not yet'],
}

const FORM_STORYLINES = {
  high: ["Can't lose right now", 'Nobody wants to see them right now', 'On one of those runs'],
  mid: ['The last 10 in a nutshell: fine', "A stretch that's hard to read", 'Treading water, not sinking'],
  low: ["Can't buy a win right now", 'Cold as it gets', 'Stuck in the mud'],
}

function isoToday() {
  return new Date().toISOString().slice(0, 10)
}

// Deterministic per (day, team) index rather than a real RNG — same team
// shows the same phrase across every visit within a UTC day (no re-roll on
// refresh), then reshuffles at midnight so a long stretch in one storyline
// tier doesn't feel stuck on the same line for weeks. FNV-1a-style hash over
// the day+team key spreads evenly enough for these small (3-option) pools.
function dailyIndex(teamId, length) {
  const key = `${isoToday()}:${teamId}`
  let hash = 0x811c9dc5
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return Math.abs(hash) % length
}

function pick(options, teamId) {
  return options[dailyIndex(teamId, options.length)]
}

function seasonStoryline(grade, teamId) {
  if (!grade) return null
  const key = `${qualityTier(grade.quality)}-${trajectoryTier(grade.surprise)}`
  return pick(SEASON_STORYLINES[key], teamId)
}

function formStoryline(score, teamId) {
  if (score == null) return null
  return pick(FORM_STORYLINES[qualityTier(score)], teamId)
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
  const gradeRank = leagueRankNoTies(leagueGradeScores, teamId)
  const qualityRank = leagueRank(leagueSeasonScores, teamId)
  const surpriseRank = leagueRank(leagueSurpriseScores, teamId)
  const formRank = leagueRankNoTies(leagueFormScores, teamId)
  const formPhrase = formStoryline(snapshot.currentForm?.score, teamId)
  const formLabel = `Last ${snapshot.currentForm?.games ?? CURRENT_FORM_GAMES}`

  // "What built the grade" and the Current Form record line fold away until
  // the row that explains them is opened (same `open` accordion the numeric
  // breakdown already uses, not a second piece of state) — same behavior at
  // every viewport.
  const showDrivers = open === 'grade' || open === 'quality' || open === 'surprise'
  const showFormMeta = open === 'form'

  return (
    <section className={`team-score${open ? ' is-open' : ''}`} aria-label="Season Grade">
      <div className="team-score__head">
        Season report
        <button type="button" className="team-score__howlink" onClick={() => setShowHow(true)}>
          How this is calculated
        </button>
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

      {showDrivers && (
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
      )}

      <ScoreRow
        label={formLabel}
        phrase={formPhrase}
        summary={snapshot.currentForm}
        rank={formRank}
        metaText={showFormMeta ? meta(snapshot.currentForm) : ''}
        isOpen={open === 'form'}
        onToggle={() => toggle('form')}
        league={leagueFormScores}
        teamId={teamId}
        compact
      />

      {open && <ScoreDetail kind={open} grade={grade} quality={snapshot.season} surprise={surprise} form={snapshot.currentForm} />}

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
          <strong>{grade ? seasonStoryline(grade, teamId) : 'Not yet graded'}</strong>
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
        <div className="team-score__trackrow">
          <LeagueTrack league={league} ownScore={summary.score} teamId={teamId} />
          <RankStrip league={league} teamId={teamId} />
        </div>
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
            {kind === 'quality' && detail.avgParkFactor != null && (
              <div><dt>Park factor faced</dt><dd>{detail.avgParkFactor.toFixed(2)}× · {signed(detail.parkAdjustedRunDifferential)} park-adjusted</dd></div>
            )}
            <div><dt>Expected wins from run differential</dt><dd>{detail.pythagWins.toFixed(1)}</dd></div>
            {kind === 'quality' && detail.avgOpponentWinPct != null && (
              <div><dt>Strength of schedule</dt><dd>{rate3(detail.avgOpponentWinPct)} avg opponent · {signed(detail.sosAdjustment)} wins</dd></div>
            )}
          </>
        )}
        {kind === 'surprise' && surprise && (
          <>
            <div><dt>Preseason expectation{surprise.baselineKind === 'marcel' ? ' (model)' : ''}</dt><dd>{surprise.baselineWins.toFixed(1)} wins</dd></div>
            <div><dt>Expected through this date</dt><dd>{surprise.expectedWinsToDate.toFixed(1)}</dd></div>
            {surprise.homeFieldFactor != null && (
              <div><dt>Home-field edge</dt><dd>{(surprise.homeFieldFactor * 100).toFixed(1)}% (league {(HOME_WIN_PROBABILITY * 100).toFixed(1)}%)</dd></div>
            )}
            <div><dt>Actual record</dt><dd>{surprise.wins}–{surprise.losses}</dd></div>
            <div><dt>Above/below expectation</dt><dd>{signed(surprise.residualWins)} wins</dd></div>
          </>
        )}
      </dl>
    </div>
  )
}

function ScoreRow({ label, phrase, summary, rank, metaText, isOpen, onToggle, league, teamId, driver = false, compact = false }) {
  return (
    <div className={`team-score__row${driver ? ' team-score__row--driver' : ''}${compact ? ' team-score__row--compact' : ''}${isOpen ? ' is-active' : ''}`}>
      <button
        type="button"
        className={`team-score__rowtop${isOpen ? ' is-active' : ''}`}
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={isOpen ? 'team-score-detail' : undefined}
      >
        <span className="team-score__label">
          {label}
          {phrase && <span className="team-score__label-phrase">{phrase}</span>}
        </span>
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
      {summary?.score != null && league?.length > 0 && (
        <div className="team-score__trackrow">
          <LeagueTrack league={league} ownScore={summary.score} teamId={teamId} compact={compact} />
          <RankStrip league={league} teamId={teamId} compact={compact} />
        </div>
      )}
    </div>
  )
}

// clamp(rank - half, 1, of - width + 1) — keeps the own team centered where
// there's room, and slides (never shrinks) once that centering would run off
// either end of the league.
function rankWindowStart(rank, of, width) {
  return Math.min(Math.max(rank - Math.floor(width / 2), 1), Math.max(of - width + 1, 1))
}

// The rank pill's neighborhood: five teams around the club's own rank as
// small logo chips, own team in color, the rest grayscale — the same
// picked-vs-unpicked treatment .vsteam__team already uses elsewhere. Teams
// beyond the five-wide window are real and reachable; the rail just clips to
// five chips and scrolls, with prev/next buttons for a mouse or trackpad
// (touch already swipes).
function RankStrip({ league, teamId, compact = false }) {
  const navigate = useNav()
  const { asOf, sportId } = useLinkScope()
  const railRef = useRef(null)
  const [edge, setEdge] = useState({ l: false, r: false })

  // Worst-to-best, left to right, so #1 lands on the right — reading order
  // ends at the goal rather than starting there. Rank numbers (strict,
  // tiebreak-resolved — see rankedNoTies) travel with each team either way.
  const ranked = rankedNoTies(league).reverse()
  const of = ranked.length
  const ownIndex = ranked.findIndex((r) => r.teamId === teamId)
  const width = Math.min(RANKSTRIP_VISIBLE, of)
  const step = compact ? RANKSTRIP_STEP_COMPACT : RANKSTRIP_STEP
  // rankedNoTies gives every team a strict, gapless rank, so list position
  // and the printed rank always agree — no separate tie-aware lookup needed.
  const start = ownIndex >= 0 ? rankWindowStart(ownIndex + 1, of, width) : 1

  const updateEdge = () => {
    const rail = railRef.current
    if (!rail) return
    const max = rail.scrollWidth - rail.clientWidth
    setEdge({ l: rail.scrollLeft > 2, r: rail.scrollLeft < max - 2 })
  }

  useLayoutEffect(() => {
    const rail = railRef.current
    if (!rail) return
    rail.scrollLeft = (start - 1) * step
    updateEdge()
  }, [start, step])

  if (ownIndex < 0 || of < 2) return null

  const nudge = (dir) => {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    railRef.current?.scrollBy({ left: dir * step, behavior: reduceMotion ? 'auto' : 'smooth' })
  }

  return (
    <div className={`rankstrip${compact ? ' rankstrip--compact' : ''}`}>
      <button
        type="button"
        className="rankstrip__nav rankstrip__nav--l"
        aria-label="Show worse-ranked teams"
        disabled={!edge.l}
        onClick={() => nudge(-1)}
      />
      <div className="rankstrip__track" style={{ '--rankstrip-track-width': `${step * width}px` }}>
        <div
          className="rankstrip__rail"
          ref={railRef}
          onScroll={updateEdge}
          role="list"
          aria-label={`League rank, ${ordinal(ranked[ownIndex]?.rank ?? ownIndex + 1)} of ${of}`}
        >
          {ranked.map((r) => {
            const isSelf = r.teamId === teamId
            const name = teamClubName(r.teamId) ?? 'Team'
            const logo = <TeamLogo teamId={r.teamId} name={name} size={compact ? 20 : 26} />
            if (isSelf) {
              return (
                <span key={r.teamId} className="rankstrip__chip rankstrip__chip--self" aria-hidden="true">
                  <span className="rankstrip__arrow" />
                  {logo}
                  <span className="rankstrip__n">{r.rank}</span>
                </span>
              )
            }
            return (
              <button
                key={r.teamId}
                type="button"
                className="rankstrip__chip"
                onClick={() => navigate(teamPath(r.teamId, { d: asOf, s: sportId }))}
                aria-label={`${name}, ${ordinal(r.rank)} of ${of}`}
              >
                {logo}
                <span className="rankstrip__n">{r.rank}</span>
              </button>
            )
          })}
        </div>
        <span className={`rankstrip__fade rankstrip__fade--l${edge.l ? ' is-visible' : ''}`} aria-hidden="true" />
        <span className={`rankstrip__fade rankstrip__fade--r${edge.r ? ' is-visible' : ''}`} aria-hidden="true" />
      </div>
      <button
        type="button"
        className="rankstrip__nav rankstrip__nav--r"
        aria-label="Show better-ranked teams"
        disabled={!edge.r}
        onClick={() => nudge(1)}
      />
    </div>
  )
}

// A bullet-chart rail: every other team in the league pool as a small dot at
// its own score, ours as the larger navy marker. Hovering (mouse) or tapping
// (touch) a dot names the team — the rank badge above already names ours, so
// only the other 29 need the on-demand label.
function LeagueTrack({ league, ownScore, teamId, compact = false }) {
  const [activeId, setActiveId] = useState(null)
  const active = activeId != null ? league.find((r) => r.teamId === activeId) : null
  const dots = beeswarmRows(league.filter((r) => r.teamId !== teamId))
  const dotTop = compact ? 11 : 17

  // Track the tap auto-dismiss timer so navigating away mid-window clears it
  // rather than leaking a pending closure that fires setState after unmount.
  const dismissTimer = useRef(null)
  useEffect(() => () => window.clearTimeout(dismissTimer.current), [])

  const show = (id) => setActiveId(id)
  const hide = () => setActiveId(null)
  const tap = (id) => {
    setActiveId(id)
    window.clearTimeout(dismissTimer.current)
    dismissTimer.current = window.setTimeout(
      () => setActiveId((current) => (current === id ? null : current)),
      2200,
    )
  }

  return (
    <div className={`team-score__track${compact ? ' team-score__track--compact' : ''}`}>
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
          style={{ left: `${(r.score / 10) * 100}%`, top: `calc(${dotTop}px + ${r.rowOffset}px)` }}
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
        style={{ left: `${(ownScore / 10) * 100}%`, top: `${dotTop}px` }}
        aria-label={`Your team ${ownScore.toFixed(1)}`}
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      />
    </div>
  )
}
