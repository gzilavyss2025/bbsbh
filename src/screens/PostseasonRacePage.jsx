import '../styles/34-postseason.css'
import '../styles/30-standings.css'
import '../styles/70-postseason-race.css'
import { useMemo } from 'react'
import { fetchLeagueStandings } from '../api/team.js'
import { shapeWildCard } from '../api/standings.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { useRouteLink } from '../lib/nav.js'
import { SiteHeader } from '../components/chrome/SiteHeader.jsx'
import { SectionMasthead } from '../components/ui/SectionMasthead.jsx'
import { TeamLink } from '../components/team/TeamLink.jsx'
import { ClinchMark, ClinchKey } from '../components/team/ClinchMark.jsx'
import { TeamLogo } from '../components/logo/TeamLogo.jsx'
import { AsyncStatus } from '../components/ui/AsyncGate.jsx'
import { Door } from '../components/ui/control/Door.jsx'
import { ReportFooter } from '../components/chrome/ReportFooter.jsx'

// The league mark that rides the bar's right edge — same convention (and same
// All-Star team ids) as StandingsPage's own LeagueBar. Not shared code: this
// is the "deliberate small duplicate" pattern the codebase already uses for a
// handful of self-contained ~15-line pieces (see gen-postseason-odds.mjs's
// header) rather than exporting a component neither screen otherwise needs.
const LEAGUE_MARK_ID = { 103: 159, 104: 160 }
// The AL/NL color-coding this page borrows from Postseason History's bracket
// (`.psbracket__collabel--al`/`--nl`, red/green) — used only for that label
// tint here, since each league now draws its own self-contained bracket
// rather than converging on a shared World Series.
const LEAGUE_SIDE = { 103: 'al', 104: 'nl' }

function LeagueBar({ league }) {
  const markId = LEAGUE_MARK_ID[league.id]
  return (
    <SectionMasthead
      title={league.name}
      as="h2"
      logo={
        markId ? (
          <TeamLogo teamId={markId} name={league.name} variant="mono" crop="bar" className="sectionhead__mark" />
        ) : null
      }
    />
  )
}

// The baseball "today" in US Pacific — the last US zone to roll over — so
// "entering today" reliably excludes tonight's slate. Same helper as
// StandingsPage.jsx; standings numbers only change when a game goes final, so
// reading live mid-slate would let today's result leak in before it's been
// watched, the same reasoning that page's own header spells out.
function baseballToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}
function shiftDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
function labelDate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// Seeds a league's current 6-team field from the shaped Wild Card tree
// (api/standings.js's shapeWildCard): the 3 division leaders, best record
// first (seeds 1-3), then the top 3 of the pooled wild-card ranking (seeds
// 4-6) — the same shape the real Wild Card round takes, seeds 1-2 drawing
// the bye. A tie for the last wild-card spot (rankWildCardField can mark
// more than 3 teams `inWildCard`) is broken by taking the first 3 in ranked
// order — real tiebreaker games aren't modeled here, since this is a
// projection of the field as it stands, not the field itself.
function seedField(lg) {
  const leaders = (lg.leaders ?? []).slice(0, 3).map((t, i) => ({ ...t, seed: i + 1 }))
  const wc = (lg.wildcard ?? [])
    .filter((t) => t.inWildCard)
    .slice(0, 3)
    .map((t, i) => ({ ...t, seed: i + 4 }))
  return [...leaders, ...wc]
}

// The Wild Card round's lanes for one league: just the two matchups (4v5,
// 3v6), no separate placeholder row for the two bye seeds — a bye seed
// already appears one column over, as the known half of the Division Series
// card its Wild Card winner feeds (dsLanesFor). Ordered 4v5 THEN 3v6 to line
// up row-for-row with dsLanesFor's own order (seed 1's card, then seed 2's),
// so the connector line drawn between a matchup and the DS card beside it
// (70-postseason-race.css) points at the right one.
function wcLanesFor(lg) {
  const bySeed = new Map(seedField(lg).map((t) => [t.seed, t]))
  return [
    [4, 5],
    [3, 6],
  ]
    .map(([a, b]) => [bySeed.get(a), bySeed.get(b)])
    .filter(([a, b]) => a && b)
    .map((pair) => ({
      type: 'matchup',
      key: pair.map((t) => t.id).join('-'),
      pair,
    }))
}

// The Division Series pairing for one league's two bye seeds. MLB's bracket
// is FIXED after the Wild Card round, not reseeded (Wikipedia's Wild Card
// Series article, quoting the rule directly): the winner of the 4-vs-5
// series faces the No. 1 seed, and the winner of 3-vs-6 faces the No. 2
// seed. So one side of each DS card is already a real team; only the other
// side is unresolved, and it's unresolved between exactly two known teams —
// worth naming, unlike the Championship Series, where BOTH sides still
// trace through an undetermined round.
function dsLanesFor(lg) {
  const bySeed = new Map(seedField(lg).map((t) => [t.seed, t]))
  const pairs = [
    [1, [4, 5]],
    [2, [3, 6]],
  ]
  return pairs
    .map(([byeSeed, candidateSeeds]) => ({
      bye: bySeed.get(byeSeed),
      candidates: candidateSeeds.map((s) => bySeed.get(s)).filter(Boolean),
    }))
    .filter(({ bye }) => bye)
    .map(({ bye, candidates }) => ({
      type: 'pending-ds',
      key: `ds-${bye.id}`,
      bye,
      candidates,
    }))
}

// One Championship Series slot — nothing has been played for it yet, and
// (unlike a Division Series slot) BOTH sides still trace through an
// undetermined round, so there's no "one known team" to anchor it on.
const CS_LANE = [{ type: 'tbd', key: 'cs' }]

// One seed's row — seed number, logo, club name — a real link to that
// club's Numbers tab (same `tab="numbers"` convention StandingsPage's rows
// use). No win-loss record here: the record already lives one tap away on
// that tab and in the wild-card table beneath this bracket, and printing it
// on a ~150px-wide card was what pushed longer club names (Yankees,
// Guardians) into ellipsis.
function SeedRow({ t, bye = false }) {
  return (
    <TeamLink id={t.id} tab="numbers" className="seedrow">
      <span className="seedrow__seed">{t.seed}</span>
      <TeamLogo teamId={t.id} name={t.name} size={18} />
      <span className="seedrow__name">{t.name}</span>
      <ClinchMark mark={t.clinch} />
      {bye && <span className="psrace__bye">Bye</span>}
    </TeamLink>
  )
}

function MatchupCard({ pair }) {
  return (
    <div className="seedcard psrace__matchup">
      {pair.map((t) => (
        <SeedRow key={t.id} t={t} />
      ))}
    </div>
  )
}

// A Division Series slot's unresolved half — the winner of a specific,
// already-known Wild Card matchup. Two small logos rather than one, since
// (unlike a genuine TBD) exactly two teams can still fill this row.
function PendingRow({ candidates }) {
  return (
    <span className="seedrow seedrow--pending">
      <span className="seedrow__seed">—</span>
      <span className="seedrow__pendteams">
        {candidates.map((t, i) => (
          <span className="seedrow__pendteam" key={t.id}>
            {i > 0 && <span className="seedrow__pendslash">/</span>}
            <TeamLogo teamId={t.id} name={t.name} size={14} />
          </span>
        ))}
      </span>
      <span className="seedrow__pendlabel">Winner</span>
    </span>
  )
}

// A bye seed (known) waiting on the winner of the Wild Card matchup fixed to
// its Division Series slot (dsLanesFor) — not a button, since half the card
// names no single team to open.
function DivisionSeriesCard({ bye, candidates }) {
  return (
    <div className="seedcard psrace__ds">
      <SeedRow t={bye} bye />
      <PendingRow candidates={candidates} />
    </div>
  )
}

// Each Championship slot names the Division Series path that feeds it.
function TbdRow({ seed }) {
  return (
    <span className="seedrow seedrow--tbd">
      <span className="seedrow__name">{seed === 1 ? 'Upper' : 'Lower'} DS winner</span>
    </span>
  )
}
function TbdCard() {
  return (
    <div className="seedcard seedcard--tbd">
      <TbdRow seed={1} />
      <TbdRow seed={2} />
    </div>
  )
}

function Lane({ lane }) {
  if (lane.type === 'matchup') return <MatchupCard pair={lane.pair} />
  if (lane.type === 'pending-ds') return <DivisionSeriesCard bye={lane.bye} candidates={lane.candidates} />
  return <TbdCard />
}

// Each round owns its heading and vertically aligned matchup slots.
function BracketColumn({ label, labelSide, lanes, round, format }) {
  return (
    <div className={`psbracket__col psrace__round psrace__round--${round}`}>
      <h3 className={`psbracket__collabel psbracket__collabel--${labelSide}`}>
        {label}<span className="psrace__format">{format}</span>
      </h3>
      <div className="psbracket__lanes">
        {lanes.map((lane) => (
          <Lane key={lane.key} lane={lane} />
        ))}
      </div>
    </div>
  )
}

// Keep the connected rounds on phones, with scrolling inside the bracket.
function LeagueBracket({ lg, side }) {
  const wc = wcLanesFor(lg)
  const ds = dsLanesFor(lg)
  return (
    <>
      <p className="psrace__guide">If the season ended today · Seeds 1 & 2 receive a bye</p>
      <p className="psrace__scrollhint">Scroll to follow the bracket →</p>
      <div className="psrace__scroll" role="region" aria-label={`${lg.name} bracket`} tabIndex={0}>
        <div className="psrace__miniboard">
          <BracketColumn labelSide={side} label="Wild Card" lanes={wc} round="wc" format="Best of 3" />
          <BracketColumn labelSide={side} label="Division Series" lanes={ds} round="ds" format="Best of 5" />
          <BracketColumn labelSide={side} label="Championship" lanes={CS_LANE} round="cs" format="Best of 7" />
        </div>
      </div>
      <p className="psrace__destination">League champion advances to the World Series →</p>
    </>
  )
}

// Every non-leader team still mathematically alive for a wild-card spot —
// MLB's own `wildCardEliminationNumber` off the standings record decides
// that (api/standings.js's `wcEliminated`, 'E' once a club can't reach the
// field even by winning out), not proximity to today's cutoff line, so a
// club 8 games back with games in hand still shows. Division leaders aren't
// repeated here — they're the bracket's own bye seeds, one section up.
//
// Its own function because the clinch key below the page has to agree with it
// exactly: the key explains the marks this table prints, so both have to mean
// the same thing by "still alive".
function aliveWildCard(lg) {
  return (lg.wildcard ?? []).filter((t) => !t.wcEliminated)
}

function WildCardMiniTable({ lg }) {
  const rows = aliveWildCard(lg)
  return (
    <div className="ledger-wrap standings-wrap psrace__minitable">
      <table className="standings standings--full standings--wc">
        <thead>
          <tr>
            <th className="team">Still alive</th>
            <th>W</th>
            <th>L</th>
            <th>Pct</th>
            <th>GB</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id} className={t.wcCutoff ? 'wc-cutoff' : ''}>
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
              <td>{t.wcgb}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// The marks the key has to explain — collected from what this page actually
// prints, not from the league. A league's eliminated clubs never reach either
// surface here (the bracket shows six seeds, the table shows who is still
// alive), so an 'e' row in the key would point at a chip nobody can see.
function marksOnPage(leagues) {
  const marks = new Set()
  for (const lg of leagues) {
    for (const t of [...seedField(lg), ...aliveWildCard(lg)]) {
      if (t.clinch) marks.add(t.clinch)
    }
  }
  return marks
}

function LeagueBlock({ lg }) {
  const side = LEAGUE_SIDE[lg.id] ?? 'al'
  return (
    <section className="psrace__league">
      <LeagueBar league={lg} />
      <LeagueBracket lg={lg} side={side} />
      <WildCardMiniTable lg={lg} />
    </section>
  )
}

// Standings remain dated through yesterday. Each league shows its fixed
// paths from the current Wild Card field through the Championship Series.
export function PostseasonRacePage() {
  useDocumentTitle('Postseason Race')
  const linkProps = useRouteLink()

  const today = useMemo(() => baseballToday(), [])
  const season = Number(today.slice(0, 4))
  const yesterday = useMemo(() => shiftDays(today, -1), [today])

  const { loading, error, data } = useAsync(
    () => fetchLeagueStandings(season, yesterday),
    [season, yesterday],
  )
  const leagues = useMemo(() => shapeWildCard(data ?? []), [data])
  const [al, nl] = leagues

  return (
    <div className="screen psrace-screen">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">Postseason Race</h1>
        <Door className="topbar__action" {...linkProps('/standings')}>
          Standings
        </Door>
      </header>

      <p className="psrace__asof">Entering today · through {labelDate(yesterday)}</p>

      <AsyncStatus
        loading={loading}
        error={error}
        hasData={leagues.length > 0}
        errorMessage="Couldn’t load the postseason race. Try again."
        emptyMessage="No standings are available yet this season."
        emptyProse
      />

      {al && nl && (
        <>
          <div className="psrace__leagues">
            <LeagueBlock lg={al} />
            <LeagueBlock lg={nl} />
          </div>
          <ClinchKey marks={marksOnPage([al, nl])} />
          <p className="psrace__tbdcaption">
            The bracket isn’t reseeded after the Wild Card round, so each Division Series pairing
            is already set — just waiting on a winner. Championship Series matchups are still TBD.
          </p>
        </>
      )}

      <ReportFooter />
    </div>
  )
}
