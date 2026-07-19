import { buildPreHalfCallouts } from '../api/prehalf-callouts.js'
import { Headshot } from './Headshot.jsx'
import { TeamLogo } from './TeamLogo.jsx'

// The pre-half callout strip: the "entering this half" season-context cards
// (starter team record / leading-after checkpoint / inning run differential —
// see api/prehalf-callouts.js) rendered ABOVE the half's seal alongside the
// pre-pitch change list, and staying above the results once revealed. The
// caller gates it to a reached half (revealed || isNextToReveal), same
// contract as the entering-lineup cards (ADR-0010); the one note that reads
// tonight's score additionally gates itself on `revealedThrough` inside the
// builder. Renders nothing without a bundle (MiLB / un-generated date).
export function PreHalfCallouts({ feed, bundle, inning, half, revealedThrough, workload, gameDate }) {
  const notes = buildPreHalfCallouts({ feed, bundle, inning, half, revealedThrough, workload, gameDate })
  if (notes.length === 0) return null
  return (
    <div className="prehalf">
      {notes.map((n) => {
        const teamId = n.side ? bundle?.[n.side]?.teamId ?? null : null
        const teamName = n.side ? bundle?.[n.side]?.name ?? '' : ''
        // gameData.players is roster identity, spoiler-free — same read the
        // staged lineup cards do.
        const personName =
          n.personId != null ? feed?.gameData?.players?.[`ID${n.personId}`]?.fullName ?? '' : ''
        return (
          <div className="prehalf__card" key={n.dedupeKey ?? n.text}>
            <span className="prehalf__avatar">
              {n.personId != null ? (
                <Headshot
                  personId={n.personId}
                  name={personName}
                  teamId={teamId}
                  className="prehalf__shot"
                />
              ) : (
                <TeamLogo teamId={teamId} name={teamName} size={26} />
              )}
            </span>
            <span className="prehalf__body">
              {personName && <span className="prehalf__who">{personName}</span>}
              <span className="prehalf__text">
                <span className="prehalf__mark" aria-hidden="true">★</span>
                {n.text}
              </span>
            </span>
          </div>
        )
      })}
    </div>
  )
}
