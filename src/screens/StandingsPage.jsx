import { useMemo, useRef, useState } from 'react'
import { fetchLeagueStandings } from '../api/team.js'
import { shapeStandings, shapeWildCard } from '../api/standings.js'
import { favoriteAccentColor } from '../lib/teams.js'
import { useFavoriteTeam } from '../hooks/useFavoriteTeam.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { SiteHeader } from '../components/SiteHeader.jsx'
import { TeamLink } from '../components/TeamLink.jsx'
import { TeamLogo } from '../components/TeamLogo.jsx'
import { AsyncStatus } from '../components/AsyncGate.jsx'
import { ReportFooter } from '../components/ReportFooter.jsx'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
// MLB seasons open in late March / early April; an earlier month-first button
// would only ever show empty pre-season standings, so the quick-jumps start at
// April.
const FIRST_SEASON_MONTH = 4

// The baseball "today" in US Pacific — the last US zone to roll over — so
// "entering today" reliably excludes tonight's whole slate (even a late
// West-coast game the user may still be scoring) rather than the viewer's own
// local/UTC midnight folding one back in. en-CA formats as YYYY-MM-DD.
function baseballToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

// String date math on YYYY-MM-DD (UTC-anchored so it never drifts a day).
function shiftDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// "Jul 7, 2026"
function labelDate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// The historical quick-jumps: "30 days ago" plus the first of every month that
// has already begun this season. A month-first is only offered when it's
// strictly in the PAST (`< today`) — so on the 1st of a month that button
// (which would equal today and fold in today's games) is simply absent, and the
// default "entering today" view already covers "start of this month" anyway.
function buildJumps(today) {
  const y = Number(today.slice(0, 4))
  const curMonth = Number(today.slice(5, 7))
  const jumps = [{ key: '30d', label: '30d ago', date: shiftDays(today, -30) }]
  for (let m = FIRST_SEASON_MONTH; m <= curMonth; m++) {
    const date = `${y}-${String(m).padStart(2, '0')}-01`
    if (date < today) {
      jumps.push({ key: `m${m}`, label: `${MONTHS[m - 1]} 1`, date })
    }
  }
  return jumps
}

// Screen: league-wide standings, both leagues × three divisions, with home/away
// splits, runs for/against, run differential, streak and last-ten. Spoiler-safe
// by default — the view opens "entering today" (through yesterday) and today's
// live standings are an explicit, one-tap reveal. The historical quick-jumps
// scrub back to earlier dates this season. (Previous seasons are a deliberate
// later phase; `season` is already the one knob that would drive them.)
export function StandingsPage() {
  useDocumentTitle('Standings')

  const { favoriteTeamId } = useFavoriteTeam()

  const today = useMemo(() => baseballToday(), [])
  const season = Number(today.slice(0, 4))
  const yesterday = useMemo(() => shiftDays(today, -1), [today])
  const jumps = useMemo(() => buildJumps(today), [today])

  // 'division' (the traditional three-divisions-per-league grid) or
  // 'wildcard' (mlb.com's pooled wild-card race board, one list per league
  // with a cutoff line after the 3rd wild-card spot).
  const [boardMode, setBoardMode] = useState('division')

  // Selected date key: 'entering' (default, through yesterday), 'live' (opt-in,
  // includes today), 'step' (the bottom day-stepper is driving), or a jump key
  // ('30d' / 'm5' …).
  const [selKey, setSelKey] = useState('entering')
  // Explicit date the bottom Back/Forward stepper has scrubbed to. Only
  // meaningful while selKey === 'step'; cleared whenever another control picks
  // a date so the two mechanisms never fight over which date is authoritative.
  const [stepDate, setStepDate] = useState(null)

  const view = useMemo(() => {
    if (selKey === 'step' && stepDate) {
      return { date: stepDate, mode: 'As of', detail: labelDate(stepDate) }
    }
    if (selKey === 'live') {
      return { date: null, mode: 'Live', detail: 'Today’s games included' }
    }
    if (selKey === 'entering') {
      return { date: yesterday, mode: 'Entering today', detail: `Through ${labelDate(yesterday)}` }
    }
    const jump = jumps.find((j) => j.key === selKey)
    if (jump) return { date: jump.date, mode: 'As of', detail: labelDate(jump.date) }
    return { date: yesterday, mode: 'Entering today', detail: `Through ${labelDate(yesterday)}` }
  }, [selKey, stepDate, yesterday, jumps])

  // Step one day backward/forward from whatever date is currently shown.
  // Forward is capped at yesterday — the day-stepper never leaks into today's
  // live games; that's still the separate, explicit "Reveal" opt-in above.
  function stepDay(delta) {
    const base = view.date ?? yesterday
    const next = shiftDays(base, delta)
    setStepDate(next > yesterday ? yesterday : next)
    setSelKey('step')
  }

  function pick(key) {
    setStepDate(null)
    setSelKey(key)
  }

  const { loading, error, data } = useAsync(
    () => fetchLeagueStandings(season, view.date),
    [season, view.date],
  )

  // useAsync nulls `data` on a deps (date) change; keep the last-good standings
  // on screen (dimmed) while the new date loads so the page doesn't collapse to
  // a spinner on every jump.
  const lastGood = useRef([])
  if (data) lastGood.current = data
  const shown = data ?? lastGood.current
  const leagues = useMemo(
    () =>
      boardMode === 'wildcard'
        ? shapeWildCard(shown, favoriteTeamId)
        : shapeStandings(shown, favoriteTeamId),
    [shown, favoriteTeamId, boardMode],
  )

  const refreshing = loading && shown.length > 0

  // The favorite team's own accent color for its highlighted row (falls back
  // to the scorebook field green in .standings tr.is-me when the club has no
  // known accent — MiLB affiliates aren't in that color map).
  function rowProps(t) {
    return {
      className: t.pinned ? 'is-me' : '',
      style: t.pinned ? { '--fav-accent': favoriteAccentColor(t.id) } : undefined,
    }
  }

  return (
    <div className="screen standings-screen">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">Standings</h1>
      </header>

      <div className="standings-ctrl">
        <div className="standings-ctrl__top">
          <div className="standings-ctrl__asof">
            <span className="standings-ctrl__mode">{view.mode}</span>
            <span className="standings-ctrl__detail">{view.detail}</span>
          </div>

          {selKey === 'entering' && (
            <button
              type="button"
              className="standings-reveal"
              aria-label="Reveal today’s live standings"
              onClick={() => pick('live')}
            >
              Reveal live
            </button>
          )}
          {selKey === 'live' && (
            <button
              type="button"
              className="standings-reveal is-on"
              aria-label="Reseal — hide today’s live standings"
              onClick={() => pick('entering')}
            >
              Live · reseal
            </button>
          )}
        </div>

        <div className="standings-jumps" role="group" aria-label="Standings date">
          <button
            type="button"
            aria-pressed={selKey === 'entering'}
            className={`standings-jump ${selKey === 'entering' ? 'is-active' : ''}`}
            onClick={() => pick('entering')}
          >
            Entering today
          </button>
          {jumps.map((j) => (
            <button
              key={j.key}
              type="button"
              aria-pressed={selKey === j.key}
              className={`standings-jump ${selKey === j.key ? 'is-active' : ''}`}
              onClick={() => pick(j.key)}
            >
              {j.label}
            </button>
          ))}
        </div>

        <div className="standings-jumps" role="group" aria-label="Standings board">
          <button
            type="button"
            aria-pressed={boardMode === 'division'}
            className={`standings-jump ${boardMode === 'division' ? 'is-active' : ''}`}
            onClick={() => setBoardMode('division')}
          >
            Division
          </button>
          <button
            type="button"
            aria-pressed={boardMode === 'wildcard'}
            className={`standings-jump ${boardMode === 'wildcard' ? 'is-active' : ''}`}
            onClick={() => setBoardMode('wildcard')}
          >
            Wild Card
          </button>
        </div>
      </div>

      <AsyncStatus
        loading={loading}
        error={error}
        hasData={shown.length > 0}
        errorMessage="Couldn’t load standings. Try again."
        emptyMessage="No standings available for this date."
        emptyProse
      />

      <div className={refreshing ? 'standings-body is-refreshing' : 'standings-body'}>
        {boardMode === 'wildcard'
          ? leagues.map((lg) => (
              <section className="lgstand" key={lg.id}>
                <h2 className="lgstand__league">{lg.name}</h2>
                <div className="ledger-wrap">
                  <table className="standings standings--full standings--wc">
                    <thead>
                      <tr>
                        <th className="team">Team</th>
                        <th>W</th>
                        <th>L</th>
                        <th>Pct</th>
                        <th>GB</th>
                        <th className="st-ext">Strk</th>
                        <th className="st-ext">L10</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="wc-grouphead">
                        <td colSpan={7}>Division leaders</td>
                      </tr>
                      {lg.leaders.map((t) => (
                        <tr key={t.id} {...rowProps(t)}>
                          <td className="team">
                            <TeamLink id={t.id}>
                              <TeamLogo teamId={t.id} name={t.name} size={18} />
                              {t.name}
                              <span className="wc-div">{t.division}</span>
                            </TeamLink>
                          </td>
                          <td>{t.w}</td>
                          <td>{t.l}</td>
                          <td>{t.pct}</td>
                          <td>{t.gb}</td>
                          <td className="st-ext">{t.streak}</td>
                          <td className="st-ext">{t.l10}</td>
                        </tr>
                      ))}
                      <tr className="wc-grouphead">
                        <td colSpan={7}>Wild card</td>
                      </tr>
                      {lg.wildcard.map((t) => {
                        const { className, style } = rowProps(t)
                        return (
                          <tr
                            key={t.id}
                            className={`${className} ${t.wcCutoff ? 'wc-cutoff' : ''}`.trim()}
                            style={style}
                          >
                            <td className="team">
                              <TeamLink id={t.id}>
                                <TeamLogo teamId={t.id} name={t.name} size={18} />
                                {t.name}
                                <span className="wc-div">{t.division}</span>
                              </TeamLink>
                            </td>
                            <td>{t.w}</td>
                            <td>{t.l}</td>
                            <td>{t.pct}</td>
                            <td>{t.wcgb}</td>
                            <td className="st-ext">{t.streak}</td>
                            <td className="st-ext">{t.l10}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            ))
          : leagues.map((lg) => (
              <section className="lgstand" key={lg.id}>
                <h2 className="lgstand__league">{lg.name}</h2>
                {lg.divisions.map((div) => (
                  <div className="lgstand__div" key={div.id}>
                    <h3 className="lgstand__divname">{div.name}</h3>
                    <div className="ledger-wrap">
                      <table className="standings standings--full">
                        <thead>
                          <tr>
                            <th className="team">Team</th>
                            <th>W</th>
                            <th>L</th>
                            <th>Pct</th>
                            <th>GB</th>
                            <th className="st-ext">Home</th>
                            <th className="st-ext">Away</th>
                            <th className="st-ext">RS</th>
                            <th className="st-ext">RA</th>
                            <th>Diff</th>
                            <th className="st-ext">Strk</th>
                            <th className="st-ext">L10</th>
                          </tr>
                        </thead>
                        <tbody>
                          {div.teams.map((t) => (
                            <tr key={t.id} {...rowProps(t)}>
                              <td className="team">
                                <TeamLink id={t.id}>
                                  <TeamLogo teamId={t.id} name={t.name} size={18} />
                                  {t.name}
                                </TeamLink>
                              </td>
                              <td>{t.w}</td>
                              <td>{t.l}</td>
                              <td>{t.pct}</td>
                              <td>{t.gb}</td>
                              <td className="st-ext">{t.home}</td>
                              <td className="st-ext">{t.away}</td>
                              <td className="st-ext">{t.rs}</td>
                              <td className="st-ext">{t.ra}</td>
                              <td className={t.diffTone}>{t.diff}</td>
                              <td className="st-ext">{t.streak}</td>
                              <td className="st-ext">{t.l10}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </section>
            ))}
      </div>

      <nav className="standings-daynav" aria-label="Standings date stepper">
        <button
          type="button"
          onClick={() => stepDay(-1)}
          aria-label="Previous day's standings"
        >
          ‹ Back
        </button>
        <span className="standings-daynav__label">
          {view.date ? labelDate(view.date) : 'Today'}
        </span>
        <button
          type="button"
          onClick={() => stepDay(1)}
          disabled={selKey === 'live' || view.date === yesterday}
          aria-label="Next day's standings"
        >
          Forward ›
        </button>
      </nav>

      <ReportFooter />
    </div>
  )
}
