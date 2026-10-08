// THE SMALL BRACKET — the primer's right column (ADR-0087, 2026-10-08
// addendum; design tab "H · Harmonized"). The two LCS feed the World Series:
// three boxes and two elbow connectors, pencil and dashed until a series is
// decided, then ink. The earlier rounds live behind "Full bracket ›", which
// opens FullBracket in the app's centered .scrim/.sheet (no SheetDock: that is
// the phone's bottom dock, and this column only shows from BRACKET_RAIL_QUERY).
//
// Draw-only: every value comes from lib/postseason/primer/bracketNow.js, which
// reads the bracket heading into its cutoff. No seal, no kraft (ADR-0087).
//
//   bracket   the derived bracket (docs/api/postseason.md), NOT the live one
//   cutoff    the bracket's cutoff date, handed on to FullBracket for its links
import '../../styles/80-postseason-bracket.css'
import '../../styles/postseason/primer-rail.css'
import { useRef, useState } from 'react'
import { useDialogFocus } from '../../hooks/dialog/useDialogFocus.js'
import { bracketNow } from '../../lib/postseason/primer/bracketNow.js'
import { Card } from '../ui/frame/Card.jsx'
import { SectionHead } from '../ui/frame/SectionHead.jsx'
import { Door } from '../ui/control/Door.jsx'
import { IconButton } from '../ui/control/IconButton.jsx'
import { BlankSlot, ClubMark, Pips } from './bracketParts.jsx'
import { FullBracket } from './FullBracket.jsx'
import { useBracketHistoryIds } from './PostseasonBracket.jsx'

// The rail is 358px; the card's body padding (16px a side) and border leave 324.
const W = 324
const BOX_W = 128
const BOX_H = 86
const GAP = 12
const H = 2 * BOX_H + GAP
const WS_X = W - BOX_W
const WS_Y = (H - BOX_H) / 2
const NL_Y = BOX_H + GAP
// Where a connector leaves its box (the box's middle) and where both meet the
// World Series box (its middle).
const FROM_Y = [BOX_H / 2, NL_Y + BOX_H / 2]
const TO_Y = WS_Y + BOX_H / 2

const wins = (n) => `${n} ${n === 1 ? 'win' : 'wins'}`

function Box({ box, x, y, feeders }) {
  const sides = box.rows
    .map((r, i) => (r.club ? `${r.club.name} ${wins(r.wins)}` : feeders ? `winner of ${feeders[i]} to come` : 'to come'))
    .join(', ')
  return (
    <div
      role="group"
      aria-label={`${box.name}. ${sides}.${box.foot ? ` ${box.foot}.` : ''}`}
      className={`pbnow__box${box.today ? ' pbnow__box--today' : ''}`}
      style={{ left: x, top: y, width: BOX_W, height: BOX_H }}
    >
      <span className="pbnow__name">{box.name}</span>
      {box.rows.map((row, i) =>
        row.club ? (
          <div key={row.club.id} className={`pbnow__row${row.eliminated ? ' pbnow__row--out' : ''}`}>
            <ClubMark club={row.club} eliminated={row.eliminated} size={16} />
            <span className="pbnow__abbr">{row.club.abbreviation}</span>
            <Pips winsNeeded={box.winsNeeded} wins={row.wins} />
          </div>
        ) : (
          <div key={i} className="pbnow__row">
            <BlankSlot label={feeders ? `Winner of ${feeders[i]}, to come` : 'To come'} />
          </div>
        ),
      )}
      {box.foot && <span className="pbnow__foot">{box.foot}</span>}
    </div>
  )
}

// Mounted only while open, so the history read behind FullBracket's links
// starts on the tap and not on page load.
function FullBracketSheet({ bracket, cutoff, onClose }) {
  const closeRef = useRef(null)
  useDialogFocus(closeRef, onClose)
  const historyIds = useBracketHistoryIds()
  return (
    <div className="scrim scrim--center" onClick={(e) => e.target.classList.contains('scrim') && onClose()}>
      <div className="sheet pbnow-sheet" role="dialog" aria-modal="true" aria-label="Full postseason bracket">
        <div className="pbnow-sheet__head">
          <h2 className="sheet__title">Postseason</h2>
          <IconButton ref={closeRef} label="Close" mark="md" onClick={onClose}>
            ✕
          </IconButton>
        </div>
        <div className="pbkt">
          <FullBracket bracket={bracket} cutoff={cutoff} historyIds={historyIds} />
        </div>
      </div>
    </div>
  )
}

export function BracketNow({ bracket, cutoff }) {
  const [open, setOpen] = useState(false)
  const now = bracketNow(bracket)
  if (!now) return null
  const [al, nl, ws] = now.boxes
  return (
    <>
      <Card
        aria-label="Postseason bracket, current round"
        head={
          <SectionHead
            look="label"
            as="h2"
            action={
              <Door onClick={() => setOpen(true)} aria-haspopup="dialog">
                Full bracket
              </Door>
            }
          >
            Postseason
          </SectionHead>
        }
      >
        <div className="pbnow__tree" style={{ width: W, height: H }}>
          <svg className="pbkt-lines" width={W} height={H} aria-hidden="true">
            {now.links.map((link, i) => (
              <path
                key={link.league}
                d={`M${BOX_W} ${FROM_Y[i]} H${(BOX_W + WS_X) / 2} V${TO_Y} H${WS_X}`}
                className={link.inked ? 'pbkt-ink' : 'pbkt-pencil pbkt-dash'}
              />
            ))}
          </svg>
          <Box box={al} x={0} y={0} />
          <Box box={nl} x={0} y={NL_Y} />
          <Box box={ws} x={WS_X} y={WS_Y} feeders={[al.name, nl.name]} />
        </div>
        <p className="pbnow__note">The two LCS feed the World Series. Earlier rounds are in the full bracket.</p>
      </Card>
      {open && <FullBracketSheet bracket={bracket} cutoff={cutoff} onClose={() => setOpen(false)} />}
    </>
  )
}
