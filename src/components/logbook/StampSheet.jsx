import '../../styles/48c-stamp-sheet.css'
import { useEffect, useMemo, useState } from 'react'
import { computeAllMilestones, rosterFor } from '../../api/logbookMilestones.js'
import { fetchStaticTeams } from '../../api/teams-static.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useMilestoneCelebration } from '../../hooks/useMilestoneCelebration.js'
import { celebrationId } from '../../lib/milestoneCelebrations.js'
import { ballparkPhotoThumb, ballparkStampArt } from '../../lib/ballpark/ballparkArt.js'
import { LEVELS } from '../../lib/teams.js'
import { TeamLogo } from '../logo/TeamLogo.jsx'

// THE STAMP SHEET — the clubs and the ballparks in your book, drawn as two
// panes of postage stamps on a dark album board, at whichever level you ask
// for.
//
// ===========================================================================
// ONE COMPONENT, TWO SURFACES, ONE DIFFERENCE — `counts`
// ===========================================================================
// This renders on BOTH Game Log surfaces, from the same computed objects
// (src/api/logbookMilestones.js):
//
//   - the retrospective (screens/logbook/LogbookMilestones.jsx), where it is
//     the milestone shelf and MAY say "12 of 30" and mark a set complete;
//   - one open book's page (components/logbook/ClubsSeen.jsx), where it is
//     the league under the book and MUST NOT.
//
// That second rule is docs/game-log.md §1/§3's "not a checklist" — no
// completion state, no bar, no praise, on the book itself — and it is the
// whole reason `counts` exists. It gates three things together and they are
// not separable: the "n of 30" line, the completed set's amber ring, and the
// one-shot completion animation. A caller passing `counts={false}` gets the
// art and nothing that scores it, and cannot burn the one-time beat that
// belongs to the retrospective.
//
// ===========================================================================
// THE LEVEL TOGGLE
// ===========================================================================
// MLB / AAA / AA / A+ / A, off the shared LEVELS list (src/lib/teams.js) so
// the five levels cannot drift from every other level switch in the app. It
// picks WHICH LEAGUE'S ROSTER the slots are — not which stamps count. A
// stamp is offered to every roster; a AAA club's id can only land in the AAA
// pane, so the level filtering falls out of the ids themselves (see
// logbookMilestones.js's header).
//
// Deliberately no "All" state, unlike the retrospective's own page-wide
// LevelFilterBar: a completion set is a finite named list, and "every club
// across all five levels" is not a list anybody collects against.
//
// ===========================================================================
// NO SPOILER SURFACE
// ===========================================================================
// A club's mark says you sat with that club and a park's photo says where —
// neither says how the game came out. Everything here reads exactly two
// fields off a stamped game's resolved facts (which club was home, which was
// away) and nothing else, which is what keeps the whole family spoiler-free
// by classification. Read logbookMilestones.js's own spoiler note before
// adding a third field.

const DEFAULT_SPORT_ID = LEVELS[0].sportId

export function StampSheet({ stamps = [], factsByPk = {}, counts = false }) {
  const [sportId, setSportId] = useState(DEFAULT_SPORT_ID)

  // Every level's clubs, and the one per-club fact the parks pane needs (its
  // home venue's NAME, which is how bundled park art is keyed). The same
  // same-origin weekly snapshot the team hub's Overview reads — spoiler-free,
  // no statsapi call (spoiler-manifest.json). Fetched once for all five
  // levels, so switching level costs nothing.
  const staticTeams = useAsync(() => fetchStaticTeams(), [])
  const roster = useMemo(() => rosterFor(staticTeams.data, sportId), [staticTeams.data, sportId])
  const milestones = useMemo(
    () => computeAllMilestones(stamps, factsByPk, roster),
    [stamps, factsByPk, roster],
  )

  // A minor level with no roster yet is the snapshot still in flight, or a
  // snapshot that failed — never "you have stamped nothing." Said in words
  // rather than drawn as an empty set, the same degrade every other MiLB
  // reader in this app makes.
  const empty = roster.length === 0

  return (
    <div className="stampsheet">
      <div className="stampsheet__levels" role="group" aria-label="Level">
        {LEVELS.map((lvl) => (
          <button
            key={lvl.sportId}
            type="button"
            aria-pressed={lvl.sportId === sportId}
            className={lvl.sportId === sportId ? 'is-active' : ''}
            onClick={() => setSportId(lvl.sportId)}
          >
            {lvl.label}
          </button>
        ))}
      </div>

      {empty ? (
        <p className="stampsheet__empty">
          {staticTeams.loading ? 'Loading this level’s clubs.' : 'This level’s clubs are not posted yet.'}
        </p>
      ) : (
        <div className="stampsheet__panes">
          {milestones.map((milestone) => (
            <StampPane
              key={milestone.id}
              milestone={milestone}
              sportId={sportId}
              counts={counts}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// One collection — the clubs, or the ballparks — as a pane of stamps on the
// album board.
function StampPane({ milestone, sportId, counts }) {
  // One id per collection PER LEVEL, so finishing AAA plays its own beat and
  // does not re-use the MLB one (lib/milestoneCelebrations.js).
  const [celebrated, celebrate] = useMilestoneCelebration(celebrationId(milestone.id, sportId))
  const scored = counts && milestone.complete
  // True only for the render where completion is both NEW and not yet marked
  // — the animation class this drives is removed on its own `animationend`,
  // and `celebrate()` marks the store in the same tick so a re-render (a note
  // edit elsewhere on the page, a level switch and back) can't replay it.
  const [justCompleted] = useState(() => scored && !celebrated)

  useEffect(() => {
    // Only the counting surface may spend the one-shot. The book page draws
    // the same slots with `counts={false}` and must leave the beat unspent
    // for the retrospective — see this file's header.
    if (scored && !celebrated) celebrate()
  }, [scored, celebrated, celebrate])

  const isParks = milestone.id === 'parks'

  return (
    <article
      className={`stamppane${scored ? ' is-complete' : ''}${
        justCompleted ? ' stamppane--justcompleted' : ''
      }`}
    >
      <header className="stamppane__head">
        <h3>{milestone.title}</h3>
        {counts && (
          <span className="stamppane__count">
            {milestone.count} of {milestone.total}
          </span>
        )}
      </header>
      <p className="stamppane__lede">{milestone.lede}</p>
      <ul className="stamppane__grid">
        {milestone.slots.map((slot) => (
          <PostageStamp key={slot.id} slot={slot} park={isParks} />
        ))}
      </ul>
    </article>
  )
}

// One slot, drawn as a USPS-style postage stamp: a perforated cream frame
// around a print, captioned underneath.
//
// The two collections differ only in what the PRINT is. A ballpark's print is
// the park's own art (the commemorative illustration where the series has
// reached that park, otherwise its photograph — lib/ballpark/ballparkArt.js),
// with the club's knockout mark sitting where a stamp's denomination sits. A
// club's print IS the club's mark, so it carries no second roundel.
//
// A park with no bundled art — every minor-league park today, and any MLB one
// whose photo is missing — keeps the graphite placeholder rather than a
// broken image, the same degrade this app makes everywhere it reads park art.
function PostageStamp({ slot, park }) {
  const art = park && slot.venueName
    ? (ballparkStampArt(slot.venueName) ?? ballparkPhotoThumb(slot.venueName))
    : null
  const caption = park ? slot.venueName || slot.label : slot.label

  return (
    <li className={`postagestamp${slot.filled ? ' is-filled' : ''}`}>
      <div className="postagestamp__frame">
        <div className="postagestamp__print">
          {park ? (
            <>
              {art ? (
                <img src={art.src} alt="" className="postagestamp__photo" loading="lazy" />
              ) : (
                <div className="postagestamp__photo postagestamp__photo--empty" aria-hidden="true" />
              )}
              <span className="postagestamp__mark" aria-hidden="true">
                <TeamLogo teamId={slot.id} name={slot.label} size={16} variant="mono" />
              </span>
            </>
          ) : (
            <span className="postagestamp__club" aria-hidden="true">
              <TeamLogo teamId={slot.id} name={slot.label} size={40} />
            </span>
          )}
        </div>
      </div>
      {/* The caption names the slot for everyone; the sr-only line adds the
          state, because colour and fade are the whole visual signal for it. */}
      <span className="postagestamp__caption">{caption}</span>
      <span className="sr-only">{slot.filled ? 'in your book' : 'not in your book yet'}</span>
    </li>
  )
}
