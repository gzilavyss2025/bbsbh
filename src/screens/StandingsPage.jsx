import '../styles/30-standings.css'
import { useMemo, useState } from 'react'
import { fetchLeagueStandings } from '../api/team.js'
import { fetchTeamScores, leagueSeasonGradesFor, gradeTiersByTeamId } from '../api/teamScore.js'
import { fetchSeasonScores } from '../api/seasonScore.js'
import {
  shapeStandings,
  shapeWildCard,
  attachTeamField,
  extractRanks,
  attachRankTrend,
  clinchMarksInPlay,
  DASH,
} from '../api/standings.js'
import { favoriteAccentColor } from '../lib/teams.js'
import { buildJumps, labelDate, shiftDays, WILD_CARD_ERA_FROM } from '../lib/time/standingsDates.js'
import { seasonPath } from '../lib/seasons/route.js'
import { useRouteLink } from '../lib/nav.js'
import { useFavoriteTeam } from '../hooks/preferences/useFavoriteTeam.js'
import { useAsync } from '../hooks/useAsync.js'
import { useStandingsSeason } from '../hooks/seasons/useStandingsSeason.js'
import { useMediaQuery, WIDE_QUERY } from '../hooks/useMediaQuery.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { SiteHeader } from '../components/chrome/SiteHeader.jsx'
import { SectionMasthead } from '../components/ui/SectionMasthead.jsx'
import { SeasonPicker } from '../components/season/SeasonPicker.jsx'
import { TeamLink } from '../components/team/TeamLink.jsx'
import { ClinchMark, ClinchKey } from '../components/team/ClinchMark.jsx'
import { TeamLogo } from '../components/logo/TeamLogo.jsx'
import { Table } from '../components/ui/table/Table.jsx'
import { AsyncStatus } from '../components/ui/AsyncGate.jsx'
import { Door } from '../components/ui/control/Door.jsx'
import { ReportFooter } from '../components/chrome/ReportFooter.jsx'
import { Pill } from '../components/ui/control/Pill.jsx'
import { Cluster } from '../components/ui/layout/Cluster.jsx'
import { Stack } from '../components/ui/layout/Stack.jsx'

// Rank-movement glyph: '' (not '—') when there's nothing to compare, since
// this rides inline inside the always-visible GB/WCGB cell rather than its
// own column — a bare dash there would read as "no GB" instead of "no trend".
const TREND_GLYPH = { up: '▲', down: '▼' }

// Inline rank-movement indicator, riding inside the GB/WCGB cell rather than
// its own column (see column-density note in the standings enhancement plan)
// — renders nothing for 'flat' (a held rank is the least informative case,
// and next to a division leader's dash-placeholder GB a flat glyph doubles up
// as a second, redundant dash) or when there's no trend to compare against
// (missing from one of the two snapshots, or not ranked in this board mode).
function TrendGlyph({ trend }) {
  if (trend !== 'up' && trend !== 'down') return null
  return <span className={`standings-trend standings-trend--${trend}`}>{TREND_GLYPH[trend]}</span>
}

// One decimal, or DASH when the team has no Season Grade snapshot yet.
function formatGrade(grade) {
  return grade != null ? grade.toFixed(1) : DASH
}

// Season Grade cell: the number plus a percentile pill (top third of the
// league-wide pool green, bottom third red, the rest the neutral rank tag)
// — same good/bad palette as the WAR rank tag on the Team page.
function GradePill({ grade, tier }) {
  const cls = tier === 'high' ? ' rank__tag--good' : tier === 'low' ? ' rank__tag--bad' : ''
  return <Pill className={`rank__tag${cls}`}>{formatGrade(grade)}</Pill>
}

// The league mark that rides the right edge of a league's bar. The two league
// logos are on the same CDN as every club mark, under the All-Star team ids the
// All-Star pages already draw (159 American, 160 National) — see
// components/allstar/AllStarGameResult.jsx. Both are precomputed as knockout
// art by scripts/gen-mono-logos.mjs, since the bar is navy and both marks are
// drawn largely in navy themselves (ADR-0031).
const LEAGUE_MARK_ID = { 103: 159, 104: 160 }

// One league's header: the same navy/gold bar a club wears everywhere else in
// the app, title hard left and the league mark bleeding to the bar's full
// height on the right (SectionMasthead.jsx explains why the mark renders last).
// `as="h2"` keeps the heading a real heading for screen-reader navigation, the
// plain <h2> this replaced already was.
function LeagueBar({ league }) {
  const markId = LEAGUE_MARK_ID[league.id]
  return (
    <SectionMasthead
      title={league.name}
      as="h2"
      logo={
        markId ? (
          <TeamLogo
            teamId={markId}
            name={league.name}
            variant="mono"
            crop="bar"
            className="sectionhead__mark"
          />
        ) : null
      }
    />
  )
}

// A stable empty table, so `shown` keeps its identity while a season loads.
const NO_ROWS = []

// Screen: league-wide standings, both leagues × three divisions, with home/away
// splits, runs for/against, run differential, expected (Pythagorean) W-L,
// Season Grade, division magic number/clinch, streak, last-ten, and a
// rank-movement trend glyph riding on GB. Spoiler-safe by default — the view
// opens "entering today" (through yesterday) and today's live standings are an
// explicit, one-tap reveal. The historical quick-jumps scrub back to earlier
// dates this season. A season picker reaches every earlier year back to 1998:
// a past season is a finished record, so it opens final with no date controls.
export function StandingsPage({ seasonYear }) {
  useDocumentTitle('Standings')

  const linkProps = useRouteLink()
  const { favoriteTeamId } = useFavoriteTeam()

  // IS THE SEASON OVER? — issue #1078, and the reason this page is a
  // destination the offseason home page is allowed to send a reader to.
  //
  // Everything below was written for a season being played. Once the regular
  // season ends it is not merely stale, it is EMPTY: statsapi's /standings only
  // resolves a `date` that falls on a day the regular season played, so the
  // default "entering today" view asked for an October or December day and got
  // zero records, and the page said "No standings available for this date" from
  // the day after the last game until spring. Omitting the date entirely
  // returns the season's real final standings — verified live, and the same fix
  // gen-season-score.mjs needed for the same endpoint reading a closed season.
  //
  // So once the regular season is over (the postseason included, not only the
  // winter) this page shows the season FINAL and puts its date controls away:
  // there is nothing to scrub to when the record is the record, and a row of
  // buttons that each return an empty table would be worse than no buttons. A
  // season picked from the picker is final for the same reason. Read off
  // statsapi's own season row, never off the clock or an empty response
  // (useStandingsSeason, lib/time/standingsDates.js).
  const { today, yesterday, ready, final, season, current, seasons, seasonRow } =
    useStandingsSeason(seasonYear)
  const jumps = useMemo(() => (final ? [] : buildJumps(today)), [final, today])
  // The picker's address for a year. The current season is the bare address.
  const pickerView = { seasons, current, shown: season, vs: null }
  const pathFor = ({ seasonYear: y }) => seasonPath('/standings', { seasonYear: y === current ? null : y })
  // The wild-card board is drawn for the 12-team format (WILD_CARD_ERA_FROM).
  const hasWildCard = season >= WILD_CARD_ERA_FROM
  const racePath = seasonPath('/postseason-race', {
    seasonYear: hasWildCard && season !== current ? season : null,
  })

  // 'division' (the traditional three-divisions-per-league grid) or
  // 'wildcard' (mlb.com's pooled wild-card race board, one list per league
  // with a cutoff line after the 3rd wild-card spot).
  const [boardMode, setBoardMode] = useState('division')
  // An older season has no wild-card board; never leave one selected for it.
  const board = hasWildCard ? boardMode : 'division'

  // Phone width hides the `.st-ext` columns to avoid horizontal scroll by
  // default (see the progressive-disclosure comment on `.clubtable--full` in
  // 30-standings.css) — this is the opt-in escape hatch: below the same 740px
  // breakpoint the wide layout already uses for real, a toggle reveals them
  // anyway and lets the table scroll sideways instead, team column pinned by
  // the Table's `sticky` column.
  const isWide = useMediaQuery(WIDE_QUERY)
  const [expandedCols, setExpandedCols] = useState(false)

  // Selected date key: 'entering' (default, through yesterday), 'live' (opt-in,
  // includes today), 'step' (the bottom day-stepper is driving), or a jump key
  // ('30d' / 'm5' …).
  const [selKey, setSelKey] = useState('entering')
  // Explicit date the bottom Back/Forward stepper has scrubbed to. Only
  // meaningful while selKey === 'step'; cleared whenever another control picks
  // a date so the two mechanisms never fight over which date is authoritative.
  const [stepDate, setStepDate] = useState(null)

  const view = useMemo(() => {
    // No date at all, which is what makes the endpoint answer for a closed
    // season. It outranks every control because in the winter there are none.
    if (final) return { date: null, mode: 'Final', detail: `${season} regular season` }
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
  }, [final, season, selKey, stepDate, yesterday, jumps])

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

  // Held until the season row is back, so October never asks for a day with no
  // table and flashes "No standings" before the real one (useStandingsSeason).
  const { loading: fetching, error, data } = useAsync(
    () => (ready ? fetchLeagueStandings(season, view.date) : Promise.resolve([])),
    [ready, season, view.date],
  )
  const loading = fetching || !ready

  // useAsync nulls `data` on a deps (date) change; keep the last-good standings
  // on screen (dimmed) while the new date loads so the page doesn't collapse to
  // a spinner on every jump. State (not a ref) since it's read during render —
  // a ref must never be read outside an event handler/effect.
  // Keyed by season: a table from another year must never sit under this
  // year's label while the picker's fetch loads.
  const [lastGood, setLastGood] = useState({ season, rows: [] })
  if (data && data !== lastGood.rows) setLastGood({ season, rows: data })
  const shown = data ?? (lastGood.season === season ? lastGood.rows : NO_ROWS)

  // Season Grade column: a SEPARATE, independent fetch of two already-nightly
  // static files (never statsapi) — a slow/failed grade file must never block
  // the primary standings table. Cutoff pinned to at most yesterday even in
  // Live mode: the nightly snapshots have no "today" entry to leak anyway, so
  // this makes the safety argument provable rather than incidental.
  const { data: scoreFiles } = useAsync(() => Promise.all([fetchTeamScores(), fetchSeasonScores()]), [])
  // The nightly grade snapshots stop when the season does, so a December
  // cutoff would find none of them. Final reads the season's own last day off
  // the row the winter was established from.
  // A past season's grades are the ones from its last day; the year's end is
  // later than that day and the lookup takes the latest snapshot at or before.
  const gradeCutoff = final
    ? season === current
      ? (seasonRow?.regularSeasonEndDate ?? yesterday)
      : `${season}-12-31`
    : (view.date ?? yesterday)
  // Grade + percentile tier come from the SAME pool of rows, so a team's pill
  // color can never disagree with its printed number.
  const { gradeByTeamId, gradeTierByTeamId } = useMemo(() => {
    if (!scoreFiles) return { gradeByTeamId: new Map(), gradeTierByTeamId: new Map() }
    const [teamScores, seasonScores] = scoreFiles
    const rows = leagueSeasonGradesFor(teamScores, seasonScores, season, gradeCutoff)
    return {
      gradeByTeamId: new Map(rows.map((r) => [r.teamId, r.score])),
      gradeTierByTeamId: gradeTiersByTeamId(rows),
    }
  }, [scoreFiles, season, gradeCutoff])

  // Rank-movement trend: a second, independent standings fetch a week before
  // whatever date is currently effectively shown (`view.date`, or `today` in
  // Live mode) — always strictly OLDER than the primary fetch's own date, so
  // it can never be less spoiler-safe than what's already on screen.
  // Null in the winter: a week before a final standing is a date inside a
  // finished season, and a rank that "moved" since then is a movement nobody
  // is watching for. The glyph simply does not appear.
  const compareDate = useMemo(
    () => (ready && !final ? shiftDays(view.date ?? today, -7) : null),
    [ready, final, view.date, today],
  )
  const { data: compareData } = useAsync(
    () => (compareDate ? fetchLeagueStandings(season, compareDate) : Promise.resolve(null)),
    [season, compareDate],
  )
  const prevRankByTeamId = useMemo(() => {
    const compareLeagues =
      board === 'wildcard'
        ? shapeWildCard(compareData ?? [], favoriteTeamId)
        : shapeStandings(compareData ?? [], favoriteTeamId)
    return extractRanks(compareLeagues, board)
  }, [compareData, board, favoriteTeamId])

  const leagues = useMemo(() => {
    const shaped =
      board === 'wildcard'
        ? shapeWildCard(shown, favoriteTeamId)
        : shapeStandings(shown, favoriteTeamId)
    attachTeamField(shaped, gradeByTeamId, 'grade')
    attachTeamField(shaped, gradeTierByTeamId, 'gradeTier')
    attachRankTrend(shaped, board, prevRankByTeamId)
    return shaped
  }, [shown, favoriteTeamId, board, gradeByTeamId, gradeTierByTeamId, prevRankByTeamId])

  const clinchMarks = useMemo(() => clinchMarksInPlay(leagues), [leagues])

  const refreshing = loading && shown.length > 0

  // The favorite team's own accent color for its highlighted row (falls back
  // to the scorebook field green in .clubtable tr.is-me when the club has no
  // known accent — MiLB affiliates aren't in that color map).
  function rowProps(t) {
    return {
      className: `${t.pinned ? 'is-me' : ''} ${t.clinch === 'e' ? 'is-eliminated' : ''}`.trim(),
      style: t.pinned ? { '--fav-accent': favoriteAccentColor(t.id) } : undefined,
    }
  }

  return (
    <div className="screen standings-screen">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">Standings</h1>
        <Door className="topbar__action" {...linkProps(racePath)}>
          Postseason Race
        </Door>
      </header>

      <SeasonPicker view={pickerView} pathFor={pathFor} compare={false} all={false} />

      <Stack gap="snug" className="standings-ctrl">
        <div className="standings-ctrl__top">
          <div className="standings-ctrl__asof">
            <span className="standings-ctrl__mode">{view.mode}</span>
            <span className="standings-ctrl__detail">{view.detail}</span>
          </div>

          {!final && selKey === 'entering' && (
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

        {/* Every date control on this page is hidden in the winter — the
            season's record is the record, and each of these would ask the
            endpoint for a day nobody played and come back with an empty
            table (see the `final` reading above). */}
        {!final && (
          <Cluster
            gap="tight"
            className="standings-jumps standings-jumps--scroll"
            role="group"
            aria-label="Standings date"
          >
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
          </Cluster>
        )}

        {hasWildCard && (
        <Cluster gap="tight" className="standings-jumps" role="group" aria-label="Standings board">
            <button
              type="button"
              aria-pressed={board === 'division'}
              className={`standings-jump ${board === 'division' ? 'is-active' : ''}`}
              onClick={() => setBoardMode('division')}
            >
              Division
            </button>
            <button
              type="button"
              aria-pressed={board === 'wildcard'}
              className={`standings-jump ${board === 'wildcard' ? 'is-active' : ''}`}
              onClick={() => setBoardMode('wildcard')}
            >
              Wild Card
            </button>
          </Cluster>
        )}

        {!isWide && (
          <Cluster gap="tight" className="standings-jumps" role="group" aria-label="Standings column detail">
            <button
              type="button"
              aria-pressed={expandedCols}
              className={`standings-jump ${expandedCols ? 'is-active' : ''}`}
              onClick={() => setExpandedCols((v) => !v)}
            >
              {expandedCols ? 'Fewer columns' : 'More columns ↔'}
            </button>
          </Cluster>
        )}
      </Stack>

      <AsyncStatus
        loading={loading}
        error={error}
        hasData={shown.length > 0}
        errorMessage="Couldn’t load standings. Try again."
        emptyMessage="No standings available for this date."
      />

      <div className={refreshing ? 'standings-body is-refreshing' : 'standings-body'}>
        {board === 'wildcard'
          ? leagues.map((lg) => (
              <section className="lgstand" key={lg.id}>
                <div className="lgstand__bar">
                  <LeagueBar league={lg} />
                </div>
                <Table sticky label={`${lg.name} wild card standings`} className={`clubtable clubtable--full ${expandedCols ? 'is-expanded' : ''}`.trim()}>
                  <thead>
                    <tr>
                      <th className="team">Team</th>
                      <th>W</th>
                      <th>L</th>
                      <th>Pct</th>
                      <th>GB</th>
                      <th className="st-ext">Exp W-L</th>
                      <th className="st-ext">Grade</th>
                      <th className="st-ext">Strk</th>
                      <th className="st-ext">L10</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="wc-grouphead">
                      <td colSpan={9}>Division leaders</td>
                    </tr>
                    {lg.leaders.map((t) => (
                      <tr key={t.id} {...rowProps(t)}>
                        <td className="team">
                          <TeamLink id={t.id} tab="numbers">
                            <TeamLogo teamId={t.id} name={t.name} size={18} />
                            {t.name}
                            <ClinchMark mark={t.clinch} />
                            <span className="wc-div">{t.division}</span>
                          </TeamLink>
                        </td>
                        <td>{t.w}</td>
                        <td>{t.l}</td>
                        <td>{t.pct}</td>
                        <td>
                          {t.gb} <TrendGlyph trend={t.trend} />
                        </td>
                        <td className="st-ext">{t.expWL}</td>
                        <td className="st-ext">
                          <GradePill grade={t.grade} tier={t.gradeTier} />
                        </td>
                        <td className="st-ext">{t.streak}</td>
                        <td className="st-ext">{t.l10}</td>
                      </tr>
                    ))}
                    <tr className="wc-grouphead">
                      <td colSpan={9}>Wild card</td>
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
                            <TeamLink id={t.id} tab="numbers">
                              <TeamLogo teamId={t.id} name={t.name} size={18} />
                              {t.name}
                              <ClinchMark mark={t.clinch} />
                              <span className="wc-div">{t.division}</span>
                            </TeamLink>
                          </td>
                          <td>{t.w}</td>
                          <td>{t.l}</td>
                          <td>{t.pct}</td>
                          <td>
                            {t.wcgb} <TrendGlyph trend={t.trend} />
                          </td>
                          <td className="st-ext">{t.expWL}</td>
                          <td className="st-ext">
                            <GradePill grade={t.grade} tier={t.gradeTier} />
                          </td>
                          <td className="st-ext">{t.streak}</td>
                          <td className="st-ext">{t.l10}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </Table>
              </section>
            ))
          : leagues.map((lg) => (
              <section className="lgstand" key={lg.id}>
                <div className="lgstand__bar">
                  <LeagueBar league={lg} />
                </div>
                {lg.divisions.map((div) => (
                  <div className="lgstand__div" key={div.id}>
                    <h3 className="lgstand__divname">{div.name}</h3>
                    <Table sticky label={`${lg.name} ${div.name} standings`} className={`clubtable clubtable--full ${expandedCols ? 'is-expanded' : ''}`.trim()}>
                      <thead>
                        <tr>
                          <th className="team">Team</th>
                          <th>W</th>
                          <th>L</th>
                          <th>Pct</th>
                          <th>GB</th>
                          <th className="st-ext">Magic#</th>
                          <th className="st-ext">Home</th>
                          <th className="st-ext">Away</th>
                          <th className="st-ext">RS</th>
                          <th className="st-ext">RA</th>
                          <th>Diff</th>
                          <th className="st-ext">Exp W-L</th>
                          <th className="st-ext">Grade</th>
                          <th className="st-ext">Strk</th>
                          <th className="st-ext">L10</th>
                        </tr>
                      </thead>
                      <tbody>
                        {div.teams.map((t) => (
                          <tr key={t.id} {...rowProps(t)}>
                            <td className="team">
                              <TeamLink id={t.id} tab="numbers">
                                <TeamLogo teamId={t.id} name={t.name} size={18} />
                                {t.name}
                                <ClinchMark mark={t.clinch} />
                              </TeamLink>
                            </td>
                            <td>{t.w}</td>
                            <td>{t.l}</td>
                            <td>{t.pct}</td>
                            <td>
                              {t.gb} <TrendGlyph trend={t.trend} />
                            </td>
                            <td className={`st-ext ${t.magic === 'Clinched' ? 'is-clinched' : ''}`.trim()}>
                              {t.magic}
                            </td>
                            <td className="st-ext">{t.home}</td>
                            <td className="st-ext">{t.away}</td>
                            <td className="st-ext">{t.rs}</td>
                            <td className="st-ext">{t.ra}</td>
                            <td className={t.diffTone}>{t.diff}</td>
                            <td className="st-ext">{t.expWL}</td>
                            <td className="st-ext">
                              <GradePill grade={t.grade} tier={t.gradeTier} />
                            </td>
                            <td className="st-ext">{t.streak}</td>
                            <td className="st-ext">{t.l10}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                ))}
              </section>
            ))}
      </div>

      <ClinchKey marks={clinchMarks} />

      {!final && (
        <nav className="standings-daynav" aria-label="Standings date stepper">
          <button type="button" onClick={() => stepDay(-1)} aria-label="Previous day's standings">
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
      )}

      <ReportFooter />
    </div>
  )
}
