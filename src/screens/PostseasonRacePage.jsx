import '../styles/34-postseason.css'
import '../styles/30-standings.css'
import '../styles/70-postseason-race.css'
import '../styles/80-postseason-bracket.css'
import { useMemo } from 'react'
import { fetchLeagueStandings } from '../api/team.js'
import { shapeWildCard } from '../api/standings.js'
import { useAsync } from '../hooks/useAsync.js'
import { useStandingsSeason } from '../hooks/seasons/useStandingsSeason.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { useRouteLink } from '../lib/nav.js'
import { labelDate, WILD_CARD_ERA_FROM } from '../lib/time/standingsDates.js'
import { seasonPath } from '../lib/seasons/route.js'
import { SiteHeader } from '../components/chrome/SiteHeader.jsx'
import { SectionMasthead } from '../components/ui/SectionMasthead.jsx'
import { SeasonPicker } from '../components/season/SeasonPicker.jsx'
import { TeamLink } from '../components/team/TeamLink.jsx'
import { ClinchMark, ClinchKey } from '../components/team/ClinchMark.jsx'
import { TeamLogo } from '../components/logo/TeamLogo.jsx'
import { Table } from '../components/ui/table/Table.jsx'
import { AsyncStatus } from '../components/ui/AsyncGate.jsx'
import { Door } from '../components/ui/control/Door.jsx'
import { Card } from '../components/ui/frame/Card.jsx'
import { ReportFooter } from '../components/chrome/ReportFooter.jsx'
import { Stack } from '../components/ui/layout/Stack.jsx'
import { BlankSlot } from '../components/bracket/bracketParts.jsx'
import { teamAbbr } from '../lib/teams.js'

// The league mark that rides the bar's right edge — same convention (and same
// All-Star team ids) as StandingsPage's own LeagueBar. Not shared code: this
// is the "deliberate small duplicate" pattern the codebase already uses for a
// handful of self-contained ~15-line pieces (see gen-postseason-odds.mjs's
// header) rather than exporting a component neither screen otherwise needs.
const LEAGUE_MARK_ID = { 103: 159, 104: 160 }

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

// THE BRACKET — drawn in the homepage rail's look (FullBracket's rail tree, Gary 2026-10-29):
// one stamped card per league, three narrow columns that fit a phone with no side scroll,
// each box a seed, a club mark and the abbreviation. No clinch letters (Gary, 2026-10-29):
// the division leaders' marks are on the Standings page. A row is a link to the club's Numbers tab.
function SeedRow({ t, bye = false }) {
  return (
    <TeamLink id={t.id} tab="numbers" className={`psrace__row${bye ? ' psrace__row--bye' : ''}`} aria-label={`${t.seed} seed, ${t.name}${bye ? ', bye' : ''}`}>
      <span className="psrace__seed">{t.seed}</span>
      <TeamLogo teamId={t.id} name={t.name} size={16} />
      <span className="psrace__abbr">{teamAbbr(t)}</span>
    </TeamLink>
  )
}

// A slot no club fills yet: the rail's blank ruled line, never "TBD".
function OpenRow({ label }) {
  return (
    <span className="psrace__row psrace__row--open">
      <BlankSlot label={label} />
    </span>
  )
}

function Lane({ lane }) {
  if (lane.type === 'matchup') {
    return (
      <div className="psrace__box">
        {lane.pair.map((t) => (
          <SeedRow key={t.id} t={t} />
        ))}
      </div>
    )
  }
  if (lane.type === 'pending-ds') {
    const names = lane.candidates.map((t) => t.name).join(' or ')
    const label = names ? `Winner of ${names}` : 'Wild Card winner, to come'
    return (
      <div className="psrace__box">
        <SeedRow t={lane.bye} bye />
        <OpenRow label={label} />
      </div>
    )
  }
  return (
    <div className="psrace__box">
      <OpenRow label="Upper Division Series winner" />
      <OpenRow label="Lower Division Series winner" />
    </div>
  )
}

function BracketColumn({ label, lanes, round, format }) {
  return (
    <div className={`psrace__round psrace__round--${round}`}>
      <h4 className="psrace__collabel">
        {label}
        <span className="psrace__format">{format}</span>
      </h4>
      <div className="psrace__lanes">
        {lanes.map((lane) => (
          <Lane key={lane.key} lane={lane} />
        ))}
      </div>
    </div>
  )
}

function LeagueBracket({ lg, final }) {
  const wc = wcLanesFor(lg)
  const ds = dsLanesFor(lg)
  const cs = lg.id === 104 ? 'NLCS' : 'ALCS'
  return (
    <Card frame="stamped" label={final ? 'The field' : 'If the season ended today'} labelAs="h3" className="psrace__card">
      <div className="psrace__tree" role="group" aria-label={`${lg.name} bracket`}>
        <BracketColumn label="Wild Card" lanes={wc} round="wc" format="Best of 3" />
        <BracketColumn label="Division" lanes={ds} round="ds" format="Best of 5" />
        <BracketColumn label={cs} lanes={CS_LANE} round="cs" format="Best of 7" />
      </div>
      <p className="psrace__guide">Seeds 1 and 2 receive a bye · League champion advances to the World Series</p>
    </Card>
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

// A closed season has no "still alive": MLB's elimination numbers stop moving
// when the regular season ends (api/standings.js's isEliminated says so), so the
// last club out would read as alive. A final board prints the whole pooled order
// instead, cutoff line and all, which is the answer it is wanted for.
function wildCardRows(lg, final) {
  return final ? (lg.wildcard ?? []) : aliveWildCard(lg)
}

function WildCardMiniTable({ lg, final }) {
  const rows = wildCardRows(lg, final)
  return (
    <Table sticky label={`${lg.name} wild card race`} className="clubtable clubtable--full">
      <thead>
        <tr>
          <th className="team">{final ? 'Wild card order' : 'Still alive'}</th>
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
    </Table>
  )
}

// The marks the key has to explain — collected from what this page actually
// prints, not from the league. The bracket prints no marks, and the table shows
// only who is still alive, so an 'e' row in the key would point at a chip nobody can see.
function marksOnPage(leagues, final) {
  const marks = new Set()
  for (const lg of leagues) {
    for (const t of wildCardRows(lg, final)) {
      if (t.clinch) marks.add(t.clinch)
    }
  }
  return marks
}

function LeagueBlock({ lg, final }) {
  return (
    <section className="psrace__league">
      <LeagueBar league={lg} />
      <LeagueBracket lg={lg} final={final} />
      <WildCardMiniTable lg={lg} final={final} />
    </section>
  )
}

// Standings remain dated through yesterday while the regular season runs. Once
// it is over — through the postseason and every winter — the page shows that
// season's final standings instead, because a dated request would come back
// empty (useStandingsSeason). Each league shows its fixed paths from the
// current Wild Card field through the Championship Series. An earlier season
// opens from the picker, back to the first 12-team year.
export function PostseasonRacePage({ seasonYear }) {
  useDocumentTitle('Postseason Race')
  const linkProps = useRouteLink()

  const { yesterday, ready, final, season, current, seasons } = useStandingsSeason(seasonYear, {
    from: WILD_CARD_ERA_FROM,
  })
  const pickerView = { seasons, current, shown: season, vs: null }
  const pathFor = ({ seasonYear: y }) =>
    seasonPath('/postseason-race', { seasonYear: y === current ? null : y })
  const standingsPath = seasonPath('/standings', { seasonYear: season === current ? null : season })

  const { loading: fetching, error, data } = useAsync(
    () => (ready ? fetchLeagueStandings(season, final ? null : yesterday) : Promise.resolve([])),
    [ready, season, final, yesterday],
  )
  const loading = fetching || !ready
  const leagues = useMemo(() => shapeWildCard(data ?? []), [data])
  const [al, nl] = leagues

  return (
    <div className="screen psrace-screen">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">Postseason Race</h1>
        <Door className="topbar__action" {...linkProps(standingsPath)}>
          Standings
        </Door>
      </header>

      <SeasonPicker view={pickerView} pathFor={pathFor} compare={false} all={false} />

      <p className="psrace__asof">
        {final
          ? `Final regular season · ${season}`
          : `Entering today · through ${labelDate(yesterday)}`}
      </p>

      <AsyncStatus
        loading={loading}
        error={error}
        hasData={leagues.length > 0}
        errorMessage="Couldn’t load the postseason race. Try again."
        emptyMessage="No standings are available yet this season."
      />

      {al && nl && (
        <>
          <Stack gap="loose" className="psrace__leagues">
            <LeagueBlock lg={al} final={final} />
            <LeagueBlock lg={nl} final={final} />
          </Stack>
          <ClinchKey marks={marksOnPage([al, nl], final)} />
          <p className="psrace__tbdcaption">
            {final
              ? 'Seeded from the final regular-season standings. This page shows the field, not series results.'
              : 'The bracket isn’t reseeded after the Wild Card round, so each Division Series pairing is already set — just waiting on a winner. Championship Series matchups are still TBD.'}
          </p>
        </>
      )}

      <ReportFooter />
    </div>
  )
}
