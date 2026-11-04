import { useEffect, useId, useRef, useState } from 'react'
import { factRequest, fetchPlayerFacts } from '../../api/transactions/playerFacts.js'
import { Button } from '../ui/control/Button.jsx'
import { callUpSentence, factLines, subjectsOf } from '../../api/transactions/templates.js'
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
    Promise.all(
      key.split(',').map((pair) => {
        const [playerId, template] = pair.split(':')
        return fetchPlayerFacts(...factRequest(story, date, { playerId, template }))
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

// True once `ref` comes within a screen of the viewport, and from then on. A
// one-line row that runs its note on reads its facts only then: a season-long
// ledger holds dozens of them, and each read is three or more statsapi calls.
function useNearView(ref, watch) {
  const [near, setNear] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!watch || near || !el) return undefined
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: '600px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [ref, watch, near])
  return near
}

// `children` draws the move's sentence, given what runs on after it.
export function WireFacts({ story, date, line: oneLine = false, children }) {
  const subjects = subjectsOf(story)
  // A one-player send-down or cash deal runs its note on even as a one-line
  // move: his last game, his season, his time with the club are the context the
  // bare sentence lacks.
  const line = oneLine && !(subjects.length === 1 && ['option', 'sold'].includes(subjects[0].template))
  const promoted = oneLine && !line
  const probe = useRef(null)
  const near = useNearView(probe, promoted)
  const [open, setOpen] = useState(false)
  const all = useMoveFacts(story, date, subjects, (!line && (!promoted || near)) || open)
  const sheetId = useId()
  // Each player's note is his own move's template (transactions/templates.js).
  const people = (all ?? [])
    .map((facts, i) => ({ facts, note: facts && factLines(subjects[i].template, facts, { moveDate: date, clause: subjects[i].clause, teamId: story.teamId }).join(' ') }))
    .filter((p) => p.facts)
  // A card with no facts yet draws its sentence alone; a one-line move keeps
  // its More until the tap has read and found nothing.
  const unread = line && subjects.length > 0 && all === null
  // A row waiting to come into view holds a probe where its note will run on.
  if (promoted && !near) return children(<span ref={probe} />)
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
  // A 27th man's note always runs on, even in a busy day's story: it says why
  // the move exists (Garrett Stallings, optioned July 12 beside an activation).
  const extraMan = !line ? people.find((p) => p !== lead && p.facts.extraMan && p.note) : null
  const note = !line ? [lead?.note, callUpNote, extraMan?.note].filter(Boolean).join(' ') : ''
  // Each player's own note, by id, for the wide card that gives every player
  // his own paragraph (MoveRow's split cutline).
  const notes = new Map(
    !line && named ? people.filter((p) => p.note).map((p) => [subjects[all.indexOf(p.facts)].playerId, p.note]) : [],
  )
  return (
    <>
      {children(
        <>
          {note && `${note} `}
          {toggle}
        </>,
        notes,
        toggle,
      )}
      {open && (
        <div className="wirefacts" id={sheetId}>
          {people.length ? (
            <FactSheet people={people.map((p) => ({ facts: p.facts, note: note && (p === lead || p === extraMan) ? null : p.note || null }))} />
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
