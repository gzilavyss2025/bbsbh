import { useRef } from 'react'
import { BallparkDiagram } from './BallparkDiagram.jsx'
import { Facts, RankGroup } from './BallparkFacts.jsx'
import { rankedDimensions } from '../../lib/ballpark/ballparkData.js'
import { resolveBallparkLayout } from '../../lib/ballpark/layout/resolveLayout.js'
import { useDialogFocus } from '../../hooks/dialog/useDialogFocus.js'
import { Stack } from '../ui/layout/Stack.jsx'

// The Ballpark sheet: a to-scale ink sketch of the field (BallparkDiagram) over a
// facts strip (built / roof / capacity) and the park's outfield distances + wall
// heights, each ranked against the 30 MLB parks ("Center field 420′ — 1st of 29").
// Opened by tapping the venue name on the lineup page's game facts.
//
// The DRAWING is the wall on the game's date (`venueId` + `gameDate` through
// resolveBallparkLayout, #1859); the facts and ranks are today's park. When the
// two differ (a 2022 game at Comerica), the foot says which is which.
//
// Spoiler-safe: everything here is static park geometry (src/lib/ballpark/ballparkData.js),
// no score, so it sits outside any seal like the rest of the lineup page. Same
// dialog contract as WhatsBrewingModal — dismiss via backdrop, close button, or
// Escape; focus moves into the sheet on open and back to the trigger on close.
export function BallparkModal({ venue, venueId, gameDate, onClose }) {
  const data = rankedDimensions(venue)
  const layout = resolveBallparkLayout({ venueId, venueName: venue, gameDate })

  const closeRef = useRef(null)
  useDialogFocus(closeRef, onClose)

  if (!data) return null
  const distRows = data.rows.filter((r) => r.group === 'dist')
  const wallRows = data.rows.filter((r) => r.group === 'wall')

  return (
    <div
      className="scrim"
      onClick={(e) => e.target.classList.contains('scrim') && onClose()}
    >
      <div className="sheet bpsheet" role="dialog" aria-modal="true" aria-label={data.name}>
        <div className="bpsheet__head">
          <h2 className="sheet__title">{data.name}</h2>
          <button ref={closeRef} className="bpsheet__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {layout && <BallparkDiagram layout={layout} />}

        <dl className="bpsheet__facts">
          <Facts label="Opened" value={data.built} />
          <Facts label="Roof" value={data.roof} />
          <Facts label="Capacity" value={data.capacity?.toLocaleString()} />
        </dl>

        <Stack gap="loose" className="bpsheet__ranks">
          <RankGroup title="Outfield distances" rows={distRows} />
          <RankGroup title="Wall heights" rows={wallRows} />
        </Stack>

        <p className="bpsheet__foot">
          {layout?.validTo && `The drawing shows the wall used through ${layout.validTo.slice(0, 4)}; the ranks are for today's park. `}
          Distances from the MLB Stats API, ranked among the MLB parks · wall shapes
          and heights checked against Baseball Savant
        </p>
      </div>
    </div>
  )
}
