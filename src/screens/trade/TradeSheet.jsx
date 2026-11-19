import { loadTrade } from '../../api/trade/history.js'
import { useAsync } from '../../hooks/useAsync.js'
import { teamClubName, teamFullName, teamLocationName, isMlbTeamId } from '../../lib/teams.js'
import { tradeLead } from '../../lib/trade/history.js'
import { PlayerLink } from '../../components/player/PlayerLink.jsx'
import { Headshot } from '../../components/player/Headshot.jsx'
import { TeamLogo } from '../../components/logo/TeamLogo.jsx'

const DASH = '—'
const club = (id) => (isMlbTeamId(id) ? teamClubName(id) : 'Other club')

// What else moved in a trade, read from the wire's own sentence: the rows with
// no player carry no type, so "and cash" and "player to be named" are the record.
function extras(description) {
  const out = []
  if (/cash/i.test(description)) out.push('cash')
  if (/to be named/i.test(description)) out.push('a player to be named later')
  return out
}

// The trade that brought a player to his club, in place on his sheet: one
// sentence (tradeLead), then each club's side as one line per player, WAR
// right-aligned under one column head. Side by side at the wide step,
// stacked on a phone. Facts only, no verdict.
export function TradeRecap({ player, toId }) {
  const { loading, error, data } = useAsync(() => loadTrade(player.id, player.how, toId), [player.id, toId])
  if (loading && !data) return <p className="hint" role="status">Reading the wire…</p>
  if (error || !data) return <p className="hint">The wire has no record of this trade.</p>
  const from = teamLocationName(data.fromId) ?? club(data.fromId)
  return (
    <div className="traderecap">
      <p className="traderecap__lead">{tradeLead(data, player.id, from, extras(data.description))}</p>
      <div className="tradesheet__sides">
        <Side teamId={toId} players={data.got} warSeason={data.warSeason} highlight={player.id} />
        <Side teamId={data.fromId} players={data.gave} warSeason={data.warSeason} />
      </div>
    </div>
  )
}

function Side({ teamId, players, warSeason, highlight = null }) {
  // The player this sheet is about leads his side.
  const rows = [...players].sort((x, y) => (y.id === highlight) - (x.id === highlight))
  const here = teamFullName(teamId)
  return (
    <section className="tradesheet__side">
      <header className="tradesheet__club">
        {isMlbTeamId(teamId) && <TeamLogo teamId={teamId} size={28} />}
        <h3 className="t-label t-label--bold">{club(teamId)} got</h3>
        <span className="tradedesk__k tradesheet__colhead">{warSeason} WAR</span>
      </header>
      <ul className="tradesheet__list">
        {rows.map((p) => {
          // Where he is now, only when that is somewhere else.
          const moved = p.active === false ? 'retired or released' : p.nowTeam && p.nowTeam !== here ? `now ${p.nowTeam}` : null
          return (
            <li key={p.id} className={p.id === highlight ? 'tradesheet__player tradesheet__player--this' : 'tradesheet__player'}>
              <Headshot personId={p.id} name={p.name} className="tradedesk__face" />
              <div className="tradedesk__who">
                <PlayerLink id={p.id} name={p.name} className="tradedesk__name">{p.name}</PlayerLink>
                <span className="t-label tradedesk__meta">
                  {[p.pos, p.id === highlight ? 'this player' : null, moved].filter(Boolean).join(' · ') || DASH}
                </span>
              </div>
              <span className="tradesheet__num">{p.war != null ? p.war.toFixed(1) : DASH}</span>
            </li>
          )
        })}
        {!players.length && <li className="tradesheet__extra">No players</li>}
      </ul>
    </section>
  )
}
