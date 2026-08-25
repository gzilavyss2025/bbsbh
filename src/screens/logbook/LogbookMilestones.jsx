import { useEffect, useMemo, useState } from 'react'
import { TeamLogo } from '../../components/logo/TeamLogo.jsx'
import { fetchStaticTeams } from '../../api/teams-static.js'
import { ballparkPhotoThumb } from '../../lib/ballpark/ballparkArt.js'
import { useAsync } from '../../hooks/useAsync.js'
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
// styles/48b-logbook-milestones.css) the moment a collection's last slot
// fills, answering to the passport stamp's own `passport-stamp-land` moment:
// felt once, said in no extra words, and tracked (useMilestoneCelebration)
// so it can never replay on a later visit.
export function LogbookMilestones({ milestones = [] }) {
  // The one per-team fact the "parks" shelf needs that no milestone math
  // carries: a club's home venue NAME, to look its bundled photo up by
  // (lib/ballpark/ballparkArt.js is keyed on the venue name, not a team id).
  // Read from the same same-origin weekly snapshot the team hub's Overview
  // reads for the identical purpose (BallparkCard.jsx) — spoiler-free, no
  // statsapi call (spoiler-manifest.json). A slow/failed fetch just leaves
  // every stamp on its graphite placeholder rather than blocking the shelf.
  const staticTeams = useAsync(() => fetchStaticTeams(), [])
  const venueNameById = useMemo(() => {
    const map = new Map()
    for (const team of staticTeams.data?.bySportId?.['1'] ?? []) {
      if (team.venueName) map.set(team.id, team.venueName)
    }
    return map
  }, [staticTeams.data])

  if (!milestones.length) return null
  return (
    <section className="logbookstats__section">
      <SectionHead eyebrow="What your book has covered" title="Milestones" />
      <div className="logbookmilestones">
        {milestones.map((milestone) => (
          <MilestoneCard key={milestone.id} milestone={milestone} venueNameById={venueNameById} />
        ))}
      </div>
    </section>
  )
}

function MilestoneCard({ milestone, venueNameById }) {
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

  const isParks = milestone.id === 'parks'

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
      {isParks ? (
        <ul className="ballparkstamps">
          {milestone.slots.map((slot) => (
            <BallparkStampSlot key={slot.id} slot={slot} venueName={venueNameById.get(slot.id)} />
          ))}
        </ul>
      ) : (
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
      )}
    </article>
  )
}

// One park, drawn as a USPS-style postage stamp: a perforated-edge frame
// around the club's own ballpark photo (the same bundled art the team hub's
// Ballpark card shows — lib/ballpark/ballparkArt.js), with the club's
// knockout mark sitting where a stamp's denomination sits, upper right.
// `venueName` is only known once the static team snapshot resolves, so an
// unresolved slot renders the same graphite placeholder a not-yet-filled
// slot does — never a broken image, same graceful-degrade posture as
// everywhere else this app reads park art.
function BallparkStampSlot({ slot, venueName }) {
  const photo = venueName ? ballparkPhotoThumb(venueName) : null
  return (
    <li className={`ballparkstamp${slot.filled ? ' is-filled' : ''}`}>
      <div className="ballparkstamp__frame">
        {photo ? (
          <img src={photo.src} alt="" className="ballparkstamp__photo" loading="lazy" />
        ) : (
          <div className="ballparkstamp__photo ballparkstamp__photo--empty" aria-hidden="true" />
        )}
        <span className="ballparkstamp__mark" aria-hidden="true">
          <TeamLogo teamId={slot.id} name={slot.label} size={16} variant="mono" />
        </span>
      </div>
      <span className="sr-only">
        {slot.label} — {slot.filled ? 'stamped' : 'not yet stamped'}
      </span>
    </li>
  )
}
