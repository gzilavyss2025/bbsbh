import { TeamLogo } from '../../components/logo/TeamLogo.jsx'
import { teamClubName, teamPrimaryColor } from '../../lib/teams.js'
import { money } from '../../lib/trade/deal.js'
import { gradeOf, verdictOf } from '../../lib/trade/value.js'
import { InfoPopover } from '../../components/ui/InfoPopover.jsx'

// The top of the trade card, read the way a sports game reads a trade: each
// club gets a letter grade for what it takes home, and the middle gives one
// verdict over a tug-of-war bar in the two clubs' colours, pulled toward the
// club that comes out ahead. Underneath it all is the surplus value
// (lib/trade/value.js); the dollars, the method and the ±$15M caveat sit
// behind the info button, and in each club's deal card. Under the bar, whether
// the deal can happen (40-man room, 10-and-5 rights).

// How hard the bar can be pulled: $150M of surplus pulls it most of the way.
const FULL = 150e6

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
      {ready && <span className={`tradeboard__grade tradeboard__grade--${GRADE_TONE[grade[0]]}`} aria-label={`Grade ${grade}`}>{grade}</span>}
    </div>
  )
}

export function Scoreboard({ deal, a, b, sendsA, sendsB, cashA, cashB }) {
  const ready = Boolean((sendsA.length || cashA) && (sendsB.length || cashB))
  const value = deal.value.a
  const verdict = verdictOf(value)
  const winner = value > 0 ? a : b
  // Club A's share of the bar: half, plus however hard the deal pulls its way.
  const share = ready ? 50 + (Math.max(-1, Math.min(1, value / FULL)) * 45) : 50
  const blocks = ready ? blockers(deal, a, b, sendsA, sendsB) : []
  const state = !ready ? 'wait' : blocks.length ? 'stop' : 'go'
  const colorA = teamPrimaryColor(a) || 'var(--navy)'
  const colorB = teamPrimaryColor(b) || 'var(--graphite)'
  return (
    <section className="tradeboard" aria-label="The deal at a glance">
      <Club side="a" teamId={a} gets={sendsB.length} grade={gradeOf(value)} ready={ready} />
      <div className="tradeboard__mid">
        <span className="tradeboard__k">Trade meter</span>
        <span className={`tradeboard__score tradeboard__score--${ready ? verdict : 'wait'}`}>
          {!ready ? 'Build a deal' : VERDICT[verdict](teamClubName(winner))}
          {ready && (
            <InfoPopover label="How the grade is figured" className="infopop--paper">
              {`${verdict === 'fair' ? `The deal is within ${money(Math.abs(value))} either way` : `The ${teamClubName(winner)} come out ${money(Math.abs(value))} ahead`} in surplus value, a rough estimate (give or take $15M). That is each player's projected WAR at about $8.5M a win, less his salary, over every year his new club controls him; a prospect is valued by his ranking. Grades: A+ is $100M or more ahead, B is within $20M either way, F is $100M or more behind. A contender pays more for this year's wins than this counts.`}
            </InfoPopover>
          )}
        </span>
        <span className="tradeboard__meter" aria-hidden="true" style={{ '--tug-a': colorA, '--tug-b': colorB, '--tug-share': `${share}%` }}>
          <span className="tradeboard__tug" />
        </span>
        <span className={`tradeboard__status tradeboard__status--${state}`} role="status">
          {state === 'wait' ? 'Add a player or cash from each club' : state === 'stop' ? `Not yet · ${blocks.join(' · ')}` : 'Fits both 40-man rosters'}
        </span>
      </div>
      <Club side="b" teamId={b} gets={sendsA.length} grade={gradeOf(-value)} ready={ready} />
    </section>
  )
}
