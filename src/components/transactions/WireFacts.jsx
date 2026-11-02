import { useEffect, useId, useState } from 'react'
import { factSeason, fetchPlayerFacts } from '../../api/transactions/playerFacts.js'
import { Button } from '../ui/control/Button.jsx'
import { factLines, subjectsOf } from '../../api/transactions/templates.js'
import { FactSheet } from './FactSheet.jsx'

// One move's player background on the offseason ledger. One player: his note
// runs on in the move's sentence, with a "More" control that opens his full
// sheet. A busy day's folded story names several; the card keeps to the
// sentence, and More opens each player's note and sheet. Each player's template
// is his own move's (transactions/templates.js).
//
// A card reads its facts when it mounts, since its note shows at once. A one-line
// move shows no note, so it reads nothing until its More is first tapped.
function useMoveFacts(story, date, subjects, enabled = true) {
  const ids = subjects.map((s) => s.playerId).join(',')
  // An injured-list move reads the stint it is about, and his line before it.
  const ilIds = subjects.filter((s) => s.template.startsWith('il-')).map((s) => s.playerId).join(',')
  const [facts, setFacts] = useState(null)
  useEffect(() => {
    if (!ids || !enabled) return undefined
    let live = true
    // The club that made the move is the one he joined, even when the move
    // itself sends him to a farm club.
    const opts = { season: factSeason(date), teamId: story.teamId }
    const ilFor = new Set(ilIds.split(','))
    Promise.all(ids.split(',').map((id) => fetchPlayerFacts(Number(id), { ...opts, ilMove: ilFor.has(id) ? date : null }))).then(
      (all) => live && setFacts(all),
    )
    return () => {
      live = false
    }
  }, [ids, ilIds, date, story.teamId, enabled])
  return facts
}

// `children` draws the move's sentence, given what runs on after it.
export function WireFacts({ story, date, line = false, children }) {
  const subjects = subjectsOf(story)
  const [open, setOpen] = useState(false)
  const all = useMoveFacts(story, date, subjects, !line || open)
  const sheetId = useId()
  // Each player's note is his own move's template (transactions/templates.js).
  const people = (all ?? [])
    .map((facts, i) => ({ facts, note: facts && factLines(subjects[i].template, facts, { moveDate: date, clause: subjects[i].clause }).join(' ') }))
    .filter((p) => p.facts)
  // A card with no facts yet draws its sentence alone; a one-line move keeps
  // its More until the tap has read and found nothing.
  const unread = line && subjects.length > 0 && all === null
  if (!people.length && !unread) return children(null)
  const named = people.length > 1
  const toggle = (
    <Button
      size="control"
      skin="ghost"
      className="wirefacts__toggle"
      aria-expanded={open}
      aria-controls={sheetId}
      onClick={() => setOpen((o) => !o)}
    >
      {open ? 'Less' : 'More ›'}
    </Button>
  )
  const note = !line && !named ? people[0].note : ''
  return (
    <>
      {children(
        <>
          {note && `${note} `}
          {toggle}
        </>,
      )}
      {open && (
        <div className="wirefacts" id={sheetId}>
          {people.length ? (
            <FactSheet people={people.map(({ facts, note: n }) => ({ facts, note: named ? n || null : null }))} />
          ) : (
            <p className="factsheet__none" aria-busy="true">Loading…</p>
          )}
        </div>
      )}
    </>
  )
}
