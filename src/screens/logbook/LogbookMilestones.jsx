import { useEffect, useState } from 'react'
import { TeamLogo } from '../../components/logo/TeamLogo.jsx'
import { useMilestoneCelebration } from '../../hooks/useMilestoneCelebration.js'
import { SectionHead } from './statsShared.jsx'

// The Game Log retrospective's milestone shelf — completion sets over the
// user's own stamped games (docs/design-inspiration.md §8). Purely
// presentational over src/api/logbookMilestones.js's computed objects, the
// same split RetrospectiveSections.jsx keeps from its own math module.
//
// This is deliberately the ONE place in the Game Log allowed to say "N of
// 30" and to mark something complete — NOT the passport book, where
// docs/game-log.md's "not a checklist" rule stays exactly as it was. Even
// here the WORDS stay flat: no "Nice!", no exclamation marks, no streak
// language, no praise. The one celebratory beat is physical, not verbal — a
// single one-time burst (`.logbookmilestone--justcompleted`,
// styles/48a-logbook-stats.css) the moment a collection's last slot fills,
// answering to the passport stamp's own `passport-stamp-land` moment: felt
// once, said in no extra words, and tracked (useMilestoneCelebration) so it
// can never replay on a later visit.
export function LogbookMilestones({ milestones = [] }) {
  if (!milestones.length) return null
  return (
    <section className="logbookstats__section">
      <SectionHead eyebrow="What your book has covered" title="Milestones" />
      <div className="logbookmilestones">
        {milestones.map((milestone) => (
          <MilestoneCard key={milestone.id} milestone={milestone} />
        ))}
      </div>
    </section>
  )
}

function MilestoneCard({ milestone }) {
  const [celebrated, celebrate] = useMilestoneCelebration(milestone.id)
  // True only for the render where completion is both NEW and not yet
  // marked — the animation class this drives is removed on its own
  // `animationend`, and `celebrate()` marks the store in the same tick so a
  // re-render (a note edit elsewhere on the page, a level-filter change)
  // can't replay it.
  const [justCompleted] = useState(() => milestone.complete && !celebrated)

  useEffect(() => {
    if (milestone.complete && !celebrated) celebrate()
  }, [milestone.complete, celebrated, celebrate])

  return (
    <article
      className={`logbookmilestone${milestone.complete ? ' is-complete' : ''}${
        justCompleted ? ' logbookmilestone--justcompleted' : ''
      }`}
    >
      <header className="logbookmilestone__head">
        <h3>{milestone.title}</h3>
        <span className="logbookmilestone__count">
          {milestone.count} of {milestone.total}
        </span>
      </header>
      <p className="logbookmilestone__lede">{milestone.lede}</p>
      <ul className="logbookmilestone__grid">
        {milestone.slots.map((slot) => (
          <li key={slot.id} className={`logbookmilestone__slot${slot.filled ? ' is-filled' : ''}`}>
            <TeamLogo teamId={slot.id} name={slot.label} size={28} bw={!slot.filled} />
            <span className="sr-only">
              {slot.label} — {slot.filled ? 'stamped' : 'not yet stamped'}
            </span>
          </li>
        ))}
      </ul>
    </article>
  )
}
