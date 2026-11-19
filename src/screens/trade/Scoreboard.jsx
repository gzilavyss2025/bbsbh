import { TeamLogo } from '../../components/logo/TeamLogo.jsx'
import { teamClubName, teamPrimaryColor } from '../../lib/teams.js'
import { gradeOf, verdictOf } from '../../lib/trade/value.js'

// The top of the trade card, read the way a sports game reads a trade: each
// club gets a letter grade for what it takes home, and the middle gives one
// verdict over a tug-of-war bar in the two clubs' colours, pulled toward the
// club that comes out ahead. Underneath it all is the surplus value
// (lib/trade/value.js); the dollars and the method sit in each club's deal
// card. The 40-man count
// lives on each club's deal card, not here.

// How hard the bar can be pulled: $150M of surplus pulls it most of the way.
const FULL = 150e6

const VERDICT = {
  fair: () => 'Fair trade',
  win: (club) => `${club} win`,
  big: (club) => `${club} win big`,
  steal: (club) => `Steal for the ${club}`,
}

// The grade's colour class: green for an A, red from a C down.
const GRADE_TONE = { A: 'a', B: 'b', C: 'c', D: 'd', F: 'f' }

function Club({ teamId, gets, grade, side, ready }) {
  return (
    <div className={`tradeboard__club tradeboard__club--${side}`}>
      <TeamLogo teamId={teamId} size={48} />
      <div className="tradeboard__clubtext">
        <span className="tradeboard__name">{teamClubName(teamId)}</span>
        <span className="tradeboard__sub">{gets ? `Gets ${gets}` : 'Nobody yet'}</span>
      </div>
      {ready && (
        <span className="tradeboard__gradebox">
          <span className={`tradeboard__grade tradeboard__grade--${GRADE_TONE[grade[0]]}`} aria-label={`Deal grade ${grade}`}>{grade}</span>
          <span className="tradeboard__gradecap" aria-hidden="true">Deal grade</span>
        </span>
      )}
    </div>
  )
}

export function Scoreboard({ deal, a, b, sendsA, sendsB, cashA, cashB, picksA = 0, picksB = 0, valued = true }) {
  // A side is in once it sends a player, cash or a draft pick.
  const built = Boolean((sendsA.length || cashA || picksA) && (sendsB.length || cashB || picksB))
  // The grade waits for both sides' values (valueTradeSide), so it never flashes a provisional one.
  const ready = built && valued
  const value = deal.value.a
  const verdict = verdictOf(value)
  const winner = value > 0 ? a : b
  // Club A's share of the bar: half, plus however hard the deal pulls its way.
  const share = ready ? 50 + (Math.max(-1, Math.min(1, value / FULL)) * 45) : 50
  const colorA = teamPrimaryColor(a) || 'var(--navy)'
  const colorB = teamPrimaryColor(b) || 'var(--graphite)'
  return (
    <section className="tradeboard" aria-label="The deal at a glance">
      <Club side="a" teamId={a} gets={sendsB.length} grade={gradeOf(value)} ready={ready} />
      <div className="tradeboard__mid">
        <span className="tradeboard__k">Trade meter</span>
        <span className={`tradeboard__score tradeboard__score--${ready ? verdict : 'wait'}`}>
          {!built ? 'Build a deal' : !valued ? 'Weighing the deal…' : VERDICT[verdict](teamClubName(winner))}
        </span>
        <span className="tradeboard__meter" aria-hidden="true" style={{ '--tug-a': colorA, '--tug-b': colorB, '--tug-share': `${share}%` }}>
          <span className="tradeboard__tug" />
        </span>
      </div>
      <Club side="b" teamId={b} gets={sendsA.length} grade={gradeOf(-value)} ready={ready} />
    </section>
  )
}
