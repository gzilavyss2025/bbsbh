import { useEffect, useState } from 'react'
import { TeamLogo } from '../../components/identity/TeamLogo.jsx'
import { CopyIconButton } from '../../components/ui/CopyBox.jsx'
import { discardStyle, toggleCarry, useStyleCard } from './styleClipboard.js'

// The bar along the bottom of the two colour dimensions: what's pending, what's
// in hand, and the stamp that lands it. Everything here used to be scattered —
// the copy-all button above a 30-club scroll, Save tucked inside the jump-nav
// card — which meant the answer to "have I saved?" depended on where you'd
// scrolled to. The audit and pattern dimensions have no drafts and no Save, so
// they render no dugout at all rather than an empty bar.
const CARRY_GROUPS = [
  { key: 'palette', label: 'Palette' },
  { key: 'position', label: 'Position' },
  { key: 'wpa', label: 'WPA layout' },
]

export function DugoutRail({ changesText, onSave, saveStatus, blockedNameEdits }) {
  return (
    <div className="idlab__dugout">
      <PendingTally text={changesText} />
      <StyleCardSlot />
      <CopyAllButton text={changesText} />
      <SaveStamp onSave={onSave} status={saveStatus} blockedNameEdits={blockedNameEdits} />
    </div>
  )
}

// Counts blank-line-separated blocks of the copy text, not teams — a club with
// both a Main position tweak and an Alternate band-color tweak counts as 2 — so
// the number tracks the copy text's own output 1:1. Pasting the copy and
// counting its blocks should always match what this reported.
function changeCount(text) {
  return text ? text.split('\n\n').length : 0
}

// The app is called Tally. Four strokes and a diagonal fifth is how a
// scorekeeper counts anything on paper, and it's a truer read of "a handful"
// versus "a session's worth" than a numeral alone — which is still printed
// beside it, since past a few gates only the numeral is exact.
const TALLY_CAP = 8

function PendingTally({ text }) {
  const count = changeCount(text)
  if (count === 0) return <span className="idlab__clean">Clean sheet.</span>
  const gates = Math.min(Math.floor(count / 5), TALLY_CAP)
  const singles = gates < TALLY_CAP ? count % 5 : 0
  return (
    <span className="idlab__tally">
      <svg
        className="idlab__tallymarks"
        viewBox={`0 0 ${(gates + (singles ? 1 : 0)) * 22} 16`}
        width={(gates + (singles ? 1 : 0)) * 22}
        height={16}
        aria-hidden="true"
      >
        {Array.from({ length: gates }, (_, g) => (
          <TallyGate key={g} x={g * 22} strokes={4} slash />
        ))}
        {singles > 0 && <TallyGate x={gates * 22} strokes={singles} />}
      </svg>
      <span className="idlab__tallycount">
        {count} pending
      </span>
    </span>
  )
}

function TallyGate({ x, strokes, slash }) {
  return (
    <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      {Array.from({ length: strokes }, (_, i) => (
        <line key={i} x1={x + 3 + i * 4} y1={2} x2={x + 3 + i * 4} y2={14} />
      ))}
      {slash && <line x1={x + 1} y1={13} x2={x + 17} y2={3} />}
    </g>
  )
}

// The style lifted off some jersey, held as an object you can see rather than
// an invisible slot: where it came from, what's on it, and which groups a press
// will carry. It outlives club selection, dimension switches, and reloads
// (localStorage) so spreading one look across a rack is a sequence of presses,
// not a re-copy each time.
function StyleCardSlot() {
  const card = useStyleCard()
  if (!card) return <span className="idlab__slotempty">Nothing lifted.</span>
  const chips = ['bar', 'accent', 'onBar', 'bg'].filter((k) => card.palette[k])
  return (
    // Keyed by its source so lifting a second style REMOUNTS the card rather
    // than mutating the one in hand — the drop-and-settle replays, which is
    // what tells you the card you're holding just changed.
    <div className="idlab__stylecard" key={`${card.source.teamId}:${card.source.treatment}`}>
      <div className="idlab__stylecard__head">
        <TeamLogo teamId={card.source.teamId} name={card.source.teamName} size={20} />
        <span className="idlab__stylecard__source">
          {card.source.teamName} · {card.source.treatment}
        </span>
        <button
          type="button"
          className="idlab__stylecard__discard"
          onClick={discardStyle}
          aria-label="Discard the lifted style"
          title="Discard the lifted style"
        >
          ✕
        </button>
      </div>
      <div className="idlab__stylecard__chips">
        {chips.map((key) => (
          <span key={key} className="idlab__stylecard__chip" style={{ background: card.palette[key] }} title={card.palette[key]} />
        ))}
        {card.palette.pinstripe && <span className="idlab__stylecard__pin">Pinstripe</span>}
      </div>
      <div className="idlab__stylecard__carry">
        {CARRY_GROUPS.map((group) => (
          <label key={group.key} className="idlab__carry">
            <input type="checkbox" checked={Boolean(card.carry?.[group.key])} onChange={() => toggleCarry(group.key)} />
            <span>{group.label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

function CopyAllButton({ text }) {
  const count = changeCount(text)
  if (count === 0) return null
  return (
    <span className="idlab__copyall">
      <CopyIconButton text={text} label={`Copy all ${count} pending change(s) across every team`} />
      <span className="idlab__copyalltext">
        Copy all {count} pending change{count === 1 ? '' : 's'}
      </span>
    </span>
  )
}

// A rubber stamp, because that's what landing a change is: the drafts stop
// being proposals and become what src/lib/data/*.json says. The LANDED mark
// fades on its own; the blocked-name-edits caveat does not, because a flat
// "saved" beside an edit that silently vanished is the same lie in a smaller
// costume.
function SaveStamp({ onSave, status, blockedNameEdits }) {
  const [landed, setLanded] = useState(false)
  // Raised during render off the status change, not in an effect — see
  // Headshot.jsx for the same "adjust state while rendering" shape.
  const [prevStatus, setPrevStatus] = useState(status)
  if (status !== prevStatus) {
    setPrevStatus(status)
    setLanded(status === 'saved')
  }
  useEffect(() => {
    if (!landed) return
    const timer = setTimeout(() => setLanded(false), 1600)
    return () => clearTimeout(timer)
  }, [landed])

  return (
    <span className="idlab__save">
      <button type="button" className="idlab__stamp" onClick={onSave} disabled={status === 'saving'}>
        {status === 'saving' ? (
          <>
            <StitchSpinner />
            Saving…
          </>
        ) : (
          'Save'
        )}
      </button>
      {landed && <span className="idlab__landed">Landed ✓</span>}
      {status === 'error' && (
        <span className="hint hint--error idlab__savemsg">Didn’t land — is `npm run dev` running?</span>
      )}
      {blockedNameEdits}
    </span>
  )
}

function StitchSpinner() {
  return (
    <svg className="idlab__stitch" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path d="M4 2.5a7 7 0 0 0 0 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 2.5a7 7 0 0 1 0 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
