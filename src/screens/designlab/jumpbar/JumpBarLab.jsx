import { useRef } from 'react'
import '../../../styles/designlab/jumpbar.css'
import { HubTabBar } from '../../../components/chrome/HubTabBar.jsx'
import { Card } from '../../../components/ui/frame/Card.jsx'
import { SectionHead } from '../../../components/ui/frame/SectionHead.jsx'
import { Stack } from '../../../components/ui/layout/Stack.jsx'

// THE JUMP BAR (#1883): HubTabBar's anchor variant over a stack of invented
// sections. The sections scroll inside a framed box, so the bar stays in view
// above them and the scroll-spy can be watched: scroll the box and the ink
// button follows; tap a button and the box scrolls to its section.
//
// The bar reads the VIEWPORT (740px), not its parent. Resize the window to see
// both layouts: one sideways-scrolling row on a phone, a wrapped box at 740px
// and up.
//
// Every section, count and line is invented. None is a real player's, and none
// is a score.
const SECTIONS = [
  { key: 'overview', label: 'Overview', lines: 3 },
  { key: 'season', label: 'Season', count: 4, lines: 4 },
  { key: 'splits', label: 'Splits', count: 4, lines: 6 },
  { key: 'approach', label: 'Plate approach', count: 2881, lines: 5 },
  { key: 'contact', label: 'Contact', count: 418, lines: 7 },
  // No data for this player: the CALLER drops it, so it gets no section and no
  // button (docs/player-redesign.md, decision 3).
  { key: 'fouls', label: 'Foul balls', count: 0, lines: 4, empty: true },
  { key: 'form', label: 'Form trend', count: 150, lines: 4 },
  { key: 'gamelog', label: 'Game log', count: 156, lines: 8 },
  { key: 'career', label: 'Career', count: 'TBD', lines: 3 },
  { key: 'history', label: 'History', count: 'TBD', lines: 2 },
]

const SHOWN = SECTIONS.filter((s) => !s.empty)
const idFor = (key) => `jumplab-${key}`

export function JumpBarLab() {
  const viewRef = useRef(null)
  const tabs = SHOWN.map((s) => ({ key: idFor(s.key), label: s.label, count: s.count }))

  return (
    <Stack gap="snug" className="jumplab">
      <HubTabBar variant="anchor" tabs={tabs} ariaLabel="Page sections" scrollRoot={viewRef} />
      <div ref={viewRef} className="jumplab__view" tabIndex={0} role="region" aria-label="Invented page sections">
        <Stack gap="loose">
          {SHOWN.map((s) => (
            <Card key={s.key} id={idFor(s.key)} head={<SectionHead look="rule">{s.label}</SectionHead>}>
              <Stack gap="tight" as="ul" className="jumplab__lines">
                {Array.from({ length: s.lines }, (_, i) => (
                  <li key={i}>Invented line {i + 1}, {s.label}.</li>
                ))}
              </Stack>
            </Card>
          ))}
        </Stack>
      </div>
    </Stack>
  )
}
