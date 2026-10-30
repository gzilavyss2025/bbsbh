import { useMemo } from 'react'
import { Card } from '../../../../components/ui/frame/Card.jsx'
import { useAsync } from '../../../../hooks/useAsync.js'
import { useNav, useRouteLink } from '../../../../lib/nav.js'
import { linkQuery } from '../../../../lib/route.js'
import { teamClubName } from '../../../../lib/teams.js'
import { loadStandings } from '../../data/loadNumbers.js'
import { cutoffFor, postseasonDoor, seasonOf } from '../../data/shared.js'
import { ComebackCard } from '../../modules/ComebackCard.jsx'
import { TeamStats, todayDowLabel } from '../../modules/TeamStatsCard.jsx'
import { SHARED } from '../once.js'
import { RecordsCard } from './records/RecordsCard.jsx'
import { groupCount } from './records/recordsModel.js'
import { ScoreCard } from './ScoreCard.jsx'
import { OTHER_LEAGUE, scoreCard } from './standingsData.js'
import '../../../../styles/team-next/standings.css'

// The standings-built cards the Ranks band draws (Gary, 2026-10-30): Team score, Records, Day of
// week and Comeback wins. They read the Standings band's loader through SHARED, so they add no
// request; the other league's standings, for the MLB rank among 30, are the same once-bought read
// the Standings band used to make. Each card draws nothing without its data.
const stampAt = (i) => ({ '--stamp-delay': `calc(var(--stagger-step) * ${i})` })

export function StandingsRankCards({ team, asOf, still }) {
  const navigate = useNav()
  const linkProps = useRouteLink()
  const sportId = team.sport?.id ?? 1
  const psDoor = postseasonDoor(team.id, asOf, team.sport?.id)
  const cutoff = cutoffFor(asOf)
  const n = useAsync(() => loadStandings(team.id, asOf, SHARED), [team.id, asOf]).data

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
  const recordGroups = useMemo(() => (n?.teamRecords ? groupCount(n.teamRecords, n.recordsCutoff) : 0), [n])
  const clubName = teamClubName(team)

  let i = 0
  const wrap = (label, tag, body, key) => (
    <Card key={key} frame="stamped" body="flush" label={label} count={tag} stampIn={!still} className={`stnd__card stnd__wrap stnd__wrap--${key}`} style={stampAt(i++)}>
      {body}
    </Card>
  )
  return (
    <div className="stnd">
      {card && (
        <ScoreCard card={card} onAll={() => navigate(`/standings${linkQuery({ d: asOf, s: sportId })}`)} stampIn={!still} style={stampAt(i++)} />
      )}
      {recordGroups > 0 && wrap('Records', `${recordGroups} groups`, <RecordsCard data={n.teamRecords} cutoff={n.recordsCutoff} asOf={asOf} door={psDoor && linkProps(psDoor)} />, 'records')}
      {n?.dayOfWeek && wrap('Day of week', 'win pct', <TeamStats title="Record by Day of Week" stats={n.dayOfWeek} note="win pct" highlightKey={todayDowLabel()} />, 'dow')}
      {n?.comeback && wrap('Comeback wins', 'all 30 teams', <ComebackCard data={n.comeback} teamId={team.id} clubName={clubName} />, 'comeback')}
    </div>
  )
}
