import { useEffect, useId, useState } from 'react'
import { factSeason, fetchPlayerFacts } from '../../api/transactions/playerFacts.js'
import { Button } from '../ui/control/Button.jsx'
import { CALLS, callUpSentence, factLines, subjectsOf } from '../../api/transactions/templates.js'
import { FactSheet } from './FactSheet.jsx'

// One move's player background on the offseason ledger. One player: his note
// runs on in the move's sentence, with a "More" control that opens his full
// sheet. A busy day's folded story names several; the card keeps to the
// sentence, and More opens each player's note and sheet. A one-line move's
// More opens his note above his sheet. Each player's template
// is his own move's (transactions/templates.js).
//
// A card reads its facts when it mounts, since its note shows at once. A one-line
// move shows no note, so it reads nothing until its More is first tapped.
function useMoveFacts(story, date, subjects, enabled = true) {
  // Each player's own template decides what more he reads: an injured-list move,
  // the stint and his line before it; a trade, his line up to the deal (so the
  // note stays as it was that day); a call, his line around it; an arrival, his
  // last affiliated season.
  const key = subjects.map((s) => `${s.playerId}:${s.template}`).join(',')
  const [facts, setFacts] = useState(null)
  useEffect(() => {
    if (!key || !enabled) return undefined
    let live = true
    // The club that made the move is the one he joined, even when the move
    // itself sends him to a farm club.
    const opts = { season: factSeason(date), teamId: story.teamId }
    Promise.all(
      key.split(',').map((pair) => {
        const [id, template] = pair.split(':')
        return fetchPlayerFacts(Number(id), {
          ...opts,
          ilMove: template.startsWith('il-') ? date : null,
          tradeMove: template === 'trade' ? date : null,
          callMove: CALLS.has(template) ? { kind: template, date } : null,
          arrival: template === 'arrival',
        })
      }),
    ).then(
      (all) => live && setFacts(all),
    )
    return () => {
      live = false
    }
  }, [key, date, story.teamId, enabled])
  return facts
}

// `children` draws the move's sentence, given what runs on after it.
export function WireFacts({ story, date, line: oneLine = false, children }) {
  const subjects = subjectsOf(story)
  // A one-player send-down or cash deal runs its note on even as a one-line
  // move: his last game, his season, his time with the club are the context the
  // bare sentence lacks.
  const line = oneLine && !(subjects.length === 1 && ['option', 'sold'].includes(subjects[0].template))
  const [open, setOpen] = useState(false)
  const all = useMoveFacts(story, date, subjects, !line || open)
  const sheetId = useId()
  // Each player's note is his own move's template (transactions/templates.js).
  const people = (all ?? [])
    .map((facts, i) => ({ facts, note: facts && factLines(subjects[i].template, facts, { moveDate: date, clause: subjects[i].clause, teamId: story.teamId }).join(' ') }))
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
      {open ? 'Hide' : 'More ›'}
    </Button>
  )
  // A placement with a call-up beside it is still about the injured player:
  // his note runs on, and the call-up's waits in the card.
  const lead = people[0] && (!named || subjects[all.indexOf(people[0].facts)]?.template === 'il-placed') ? people[0] : null
  // ...and the call-up beside it adds his line before the call.
  const callUp = named && lead ? people.find((p) => p !== lead && ['recall', 'selected'].includes(subjects[all.indexOf(p.facts)]?.template)) : null
  const callUpNote = callUp ? callUpSentence(callUp.facts) : null
  const note = !line && lead ? [lead.note, callUpNote].filter(Boolean).join(' ') : ''
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
            <FactSheet people={people.map((p) => ({ facts: p.facts, note: note && p === lead ? null : p.note || null }))} />
          ) : (
            <p className="factsheet__none" aria-busy="true">Loading…</p>
          )}
          {/* The sentence's Hide scrolls away above a long card; this one waits at its foot. */}
          <Button size="control" skin="ghost" className="wirefacts__close" aria-controls={sheetId} onClick={() => setOpen(false)}>
            Hide
          </Button>
        </div>
      )}
    </>
  )
}
