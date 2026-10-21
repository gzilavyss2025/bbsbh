import { useRef } from 'react'
import { BallparkDiagram } from './BallparkDiagram.jsx'
import { Facts, RankGroup } from './BallparkFacts.jsx'
import { rankedDimensions } from '../../lib/ballpark/ballparkData.js'
import { resolveBallparkLayout } from '../../lib/ballpark/layout/resolveLayout.js'
import { useDialogFocus } from '../../hooks/dialog/useDialogFocus.js'
import { Stack } from '../ui/layout/Stack.jsx'
import { IconButton } from '../ui/control/IconButton.jsx'

// The Ballpark sheet: a to-scale ink sketch of the field (BallparkDiagram) over a
// facts strip (built / roof / capacity) and the park's outfield distances + wall
// heights, each ranked against the 30 MLB parks ("Center field 420′ — 1st of 29").
// Opened by tapping the venue name on the lineup page's game facts.
//
// The DRAWING is the wall on the game's date (`venueId` + `gameDate` through
// resolveBallparkLayout, #1859); the facts and ranks are today's park. When the
// two differ (a 2022 game at Comerica), the foot says which is which. A
// minor-league park the registry can draw opens with the drawing alone: it has
// no facts on file and no league to rank it in.
//
// Spoiler-safe: everything here is static park geometry (src/lib/ballpark/ballparkData.js),
// no score, so it sits outside any seal like the rest of the lineup page. Same
// dialog contract as WhatsBrewingModal — dismiss via backdrop, close button, or
// Escape; focus moves into the sheet on open and back to the trigger on close.
export function BallparkModal({ venue, venueId, gameDate, onClose }) {
  const data = rankedDimensions(venue, venueId)
  const layout = resolveBallparkLayout({ venueId, venueName: venue, gameDate })

  const closeRef = useRef(null)
  useDialogFocus(closeRef, onClose)

  if (!data && !layout) return null
  // The name the park had on the game's date (the caller's `venue`), not
  // today's sponsor name: a 2024 game was at Guaranteed Rate Field.
  const name = venue || data?.name || layout.name
  const distRows = data?.rows.filter((r) => r.group === 'dist') ?? []
  const wallRows = data?.rows.filter((r) => r.group === 'wall') ?? []

  return (
    <div
      className="scrim"
      onClick={(e) => e.target.classList.contains('scrim') && onClose()}
    >
      <div className="sheet bpsheet" role="dialog" aria-modal="true" aria-label={name}>
        <div className="bpsheet__head">
          <h2 className="sheet__title">{name}</h2>
          <IconButton ref={closeRef} mark="md" onClick={onClose} label="Close">
            ✕
          </IconButton>
        </div>

        {layout && <BallparkDiagram layout={layout} />}

        {data && (
          <>
            <dl className="bpsheet__facts">
              <Facts label="Opened" value={data.built} />
              <Facts label="Roof" value={data.roof} />
              <Facts label="Capacity" value={data.capacity?.toLocaleString()} />
            </dl>
            <Stack gap="loose" className="bpsheet__ranks">
              <RankGroup title="Outfield distances" rows={distRows} />
              <RankGroup title="Wall heights" rows={wallRows} />
            </Stack>
          </>
        )}

        <p className="bpsheet__foot">
          {layout?.validTo && `The drawing shows the wall used through ${layout.validTo.slice(0, 4)}; the ranks are for today's park. `}
          {data
            ? 'Distances from the MLB Stats API, ranked among the MLB parks · wall shapes and heights checked against Baseball Savant'
            : 'Distances from the MLB Stats API'}
        </p>
      </div>
    </div>
  )
}
