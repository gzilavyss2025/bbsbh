import { useCallback, useMemo } from 'react'
import { AsyncStatus } from '../../../../components/ui/AsyncGate.jsx'
import { Card } from '../../../../components/ui/frame/Card.jsx'
import { useAsync } from '../../../../hooks/useAsync.js'
import { useViewOnce } from '../../../../hooks/motion/useViewOnce.js'
import { useNav } from '../../../../lib/nav.js'
import { linkQuery } from '../../../../lib/route.js'
import { teamClubName } from '../../../../lib/teams.js'
import { loadStandings } from '../../data/loadNumbers.js'
import { cutoffFor, seasonOf } from '../../data/shared.js'
import { ComebackCard } from '../../modules/ComebackCard.jsx'
import { LastTimeCard } from '../../modules/records/LastTimeCard.jsx'
import { TeamStats, todayDowLabel } from '../../modules/TeamStatsCard.jsx'
import { SHARED } from '../once.js'
import { useBandData } from '../useBandData.js'
import { DivisionCard } from './DivisionCard.jsx'
import { RecordsCard } from './records/RecordsCard.jsx'
import { groupCount } from './records/recordsModel.js'
import { ScoreCard } from './ScoreCard.jsx'
import { OTHER_LEAGUE, hasDroughts, scoreCard, standingsCount } from './standingsData.js'
import '../../../../styles/team-next/standings.css'

// Standings (#1107, row 5b): the Standings share of the Numbers tab, every card on a stamped frame
// with a name tab. The division table and the team score card are new; Records, Day of week,
// Comebacks and Last Time keep their modules (the old tab still draws them) inside a stamped card
// whose own sheet frame and head standings.css flattens, as the Money band does. Open surface
// (ADR-0034). The raw standings come through SHARED with the arguments the loader and the top use,
// so they are one request; the other league's, for the MLB rank among 30, is the top's tap
// request bought once, here, for MLB only. Without it the part ranks read "—", never a wrong one.
const stampAt = (i) => ({ '--stamp-delay': `calc(var(--stagger-step) * ${i})` })

export default function Standings({ team, asOf, onReady, onCount }) {
  const navigate = useNav()
  const sportId = team.sport?.id ?? 1
  const cutoff = cutoffFor(asOf)
  const count = useCallback((n) => standingsCount(n, n.recordsCutoff), [])
  const numbers = useBandData(() => loadStandings(team.id, asOf, SHARED), [team.id, asOf], { onReady, onCount, count })
  const n = numbers.data

  const season = seasonOf(asOf, sportId)
  const leagueId = team.league?.id
  const raw = useAsync(async () => {
    if (!leagueId) return null
    const otherId = sportId === 1 ? OTHER_LEAGUE[leagueId] : null
    const [own, other] = await Promise.all([
      SHARED.fetchStandings(leagueId, season, cutoff),
      otherId ? SHARED.fetchStandings(otherId, season, cutoff).catch(() => []) : null,
    ])
    return { own, other }
  }, [leagueId, sportId, season, cutoff]).data
  const card = useMemo(() => raw && scoreCard(raw.own, raw.other, team), [raw, team])

  // Motion plays once per page visit (docs/motion.md, "The one-shot gate"); a return shows it at rest.
  const still = useViewOnce(team.id, 'team-standings', !!n)

  const recordGroups = useMemo(() => (n?.teamRecords ? groupCount(n.teamRecords, n.recordsCutoff) : 0), [n])
  const clubName = teamClubName(team)
  let i = 0
  const wrap = (label, tag, body, key) => (
    <Card key={key} frame="stamped" body="flush" label={label} count={tag} stampIn={!still} className="stnd__card stnd__wrap" style={stampAt(i++)}>
      {body}
    </Card>
  )

  return (
    <div className={`stnd${still ? ' stnd--still' : ''}`}>
      {/* The band's head. The shared page-head look is row 7's; until then the band draws its own. */}
      <h2 className="tnext__bandhead">Standings</h2>
      <AsyncStatus loading={numbers.loading} error={numbers.error} hasData={n != null} errorMessage="Couldn’t load team numbers. Try again." />
      {n?.standings.length > 0 && (
        <DivisionCard team={team} standings={n.standings} asOf={asOf} odds={n.divisionPostseasonOdds} stampIn={!still} style={stampAt(i++)} />
      )}
      {card && (
        <ScoreCard card={card} onAll={() => navigate(`/standings${linkQuery({ d: asOf, s: sportId })}`)} stampIn={!still} style={stampAt(i++)} />
      )}
      {recordGroups > 0 && wrap('Records', `${recordGroups} groups`, <RecordsCard data={n.teamRecords} cutoff={n.recordsCutoff} asOf={asOf} />, 'records')}
      {hasDroughts(n, n?.recordsCutoff) && wrap('Last time', 'chances since', <LastTimeCard data={n.scheduleShape} cutoff={n.recordsCutoff} />, 'last')}
      {n?.dayOfWeek && wrap('Day of week', 'win pct', <TeamStats title="Record by Day of Week" stats={n.dayOfWeek} note="win pct" highlightKey={todayDowLabel()} />, 'dow')}
      {n?.comeback && wrap('Comeback wins', 'all 30 teams', <ComebackCard data={n.comeback} teamId={team.id} clubName={clubName} />, 'comeback')}
    </div>
  )
}
