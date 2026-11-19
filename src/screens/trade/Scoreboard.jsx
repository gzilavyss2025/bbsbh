import { TeamLogo } from '../../components/logo/TeamLogo.jsx'
import { teamClubName } from '../../lib/teams.js'
import { money } from '../../lib/trade/deal.js'

// The top of the trade card, laid out like a game's score header: the two
// clubs face each other and the middle holds the deal's one number, the WAR
// swing, where the score would be. A meter leans toward the club that gains.
// Under it, whether the deal can happen (40-man room, 10-and-5 rights).
// The swing is last season's WAR moved, a fact about the players, not a grade.

// How far the meter reaches: a 10-WAR swing fills one side.
const FULL = 10
// Under half a win either way the deal reads as even.
const EVEN = 0.5

function blockers(deal, a, b, sendsA, sendsB) {
  const out = []
  for (const [id, after] of [[a, deal.fortyAfter.a], [b, deal.fortyAfter.b]]) {
    if (after > 40) out.push(`${teamClubName(id)}: clear ${after - 40} 40-man ${after - 40 === 1 ? 'spot' : 'spots'}`)
  }
  for (const p of [...sendsA, ...sendsB]) {
    if ((p.serviceYears ?? 0) >= 10) out.push(`${p.name} may block it (10-and-5 rights)`)
  }
  return out
}

const sign = (v) => (v > 0.05 ? '+' : v < -0.05 ? '−' : '')
// The sides colour only past the same line the middle calls Even.
const toneOf = (v) => (v >= EVEN ? 'up' : v <= -EVEN ? 'down' : 'flat')

function Club({ teamId, gets, pay, war, side }) {
  return (
    <div className={`tradeboard__club tradeboard__club--${side}`}>
      <TeamLogo teamId={teamId} size={48} />
      <div className="tradeboard__clubtext">
        <span className="tradeboard__name">{teamClubName(teamId)}</span>
        <span className="tradeboard__sub">
          {gets ? `Gets ${gets}` : 'Nobody yet'}
          {gets && Math.abs(pay) >= 1 ? ` · ${pay > 0 ? '+' : '−'}${money(pay)}` : ''}
        </span>
      </div>
      <span className={`tradeboard__war tradeboard__war--${toneOf(war)}`}>{sign(war)}{Math.abs(war).toFixed(1)}</span>
    </div>
  )
}

export function Scoreboard({ deal, a, b, sendsA, sendsB, cashA, cashB, warSeason }) {
  const ready = Boolean((sendsA.length || cashA) && (sendsB.length || cashB))
  const swing = deal.war.a
  const toward = Math.abs(swing) < EVEN ? null : swing > 0 ? a : b
  const reach = ready ? (Math.min(Math.abs(swing), FULL) / FULL) * 50 : 0
  const blocks = ready ? blockers(deal, a, b, sendsA, sendsB) : []
  const state = !ready ? 'wait' : blocks.length ? 'stop' : 'go'
  return (
    <section className="tradeboard" aria-label="The deal at a glance">
      <Club side="a" teamId={a} gets={sendsB.length} pay={deal.payroll.a} war={deal.war.a} />
      <div className="tradeboard__mid">
        <span className="tradeboard__k">{warSeason ?? 'Last season'} WAR swing</span>
        <span className="tradeboard__score">
          {!ready ? 'Build a deal' : toward ? `+${Math.abs(swing).toFixed(1)} ${teamClubName(toward)}` : 'Even'}
        </span>
        <span className="tradeboard__meter" aria-hidden="true">
          <span className="tradeboard__fill" style={{ left: `${swing > 0 ? 50 - reach : 50}%`, width: `${reach}%` }} />
        </span>
        <span className={`tradeboard__status tradeboard__status--${state}`} role="status">
          {state === 'wait' ? 'Add a player or cash from each club' : state === 'stop' ? `Not yet · ${blocks.join(' · ')}` : 'Fits both 40-man rosters'}
        </span>
      </div>
      <Club side="b" teamId={b} gets={sendsA.length} pay={deal.payroll.b} war={deal.war.b} />
    </section>
  )
}
