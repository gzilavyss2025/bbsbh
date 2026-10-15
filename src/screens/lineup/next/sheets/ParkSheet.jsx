import { useState } from 'react'
import { BallparkDiagram } from '../../../../components/ballpark/BallparkDiagram.jsx'
import { rankedDimensions } from '../../../../lib/ballpark/ballparkData.js'
import { resolveBallparkLayout } from '../../../../lib/ballpark/layout/resolveLayout.js'
import { parkBackdrop } from '../../../../lib/ballpark/parkBackdrop.js'
import { ordinal } from '../../../../lib/format.js'
import { useCopy } from '../../../../copy/copyContext.js'
import { SheetFrame } from './SheetFrame.jsx'

// The park's photograph, full size and full colour, as its own block of the sheet. The same
// picture (and owner-picked focal point) the slate card washes in behind itself. The credit
// links to the photo's source, which is what the licence asks for. A photo that fails to load
// (a dead owner upload) drops the whole block, so the sheet never opens on an empty frame.
function ParkPhoto({ park }) {
  const [broken, setBroken] = useState(false)
  if (broken) return null
  const credit = park.creditText
  return (
    <figure className="lpark__photo">
      <img
        src={park.src}
        alt={credit ? `${park.name}. ${credit}` : `${park.name}, seen from the stands`}
        loading="lazy"
        decoding="async"
        style={{ objectPosition: park.focus }}
        onError={() => setBroken(true)}
      />
      {credit && (
        <figcaption>
          {park.creditHref ? (
            <a href={park.creditHref} target="_blank" rel="noopener noreferrer">{credit}</a>
          ) : (
            credit
          )}
        </figcaption>
      )}
    </figure>
  )
}

// Where a park's value sits among the parks, as a dot on a bar: the deepest at the right end.
// `rank` 1 is the biggest, so the dot runs from the right (1) to the left (total).
const spot = (rank, total) => (total > 1 ? ((total - rank) / (total - 1)) * 100 : 50)

function RankRows({ rows }) {
  return (
    <ul className="lpark__ranks">
      {rows.map((r) => (
        <li key={`${r.group}-${r.key}`} className="lpark__rank">
          <b>{r.label}</b>
          <span className="lpark__val">{r.value}′</span>
          <i className="lpark__track" aria-hidden="true">
            <u style={{ left: `${spot(r.rank, r.total)}%` }} />
          </i>
          <small>
            {ordinal(r.rank)} of {r.total}
          </small>
        </li>
      ))}
    </ul>
  )
}

// The park the game is played in, as a sheet: the real wall for the game's date, when it opened,
// its roof and capacity, and each outfield distance and wall height ranked among the MLB parks.
// Static park geometry, no score, so it sits outside any seal. A minor-league park the registry
// can draw opens with the drawing alone. The drawing is the wall on the game's date; the facts
// and ranks are today's park, which the foot says when they differ.
export function ParkSheet({ venue, venueId, gameDate, onClose }) {
  const { t } = useCopy()
  const data = rankedDimensions(venue, venueId)
  const layout = resolveBallparkLayout({ venueId, venueName: venue, gameDate })
  if (!data && !layout) return null
  const name = venue || data?.name || layout.name
  // Looked up by the same name the title wears, so a lean feed row with no venue name still gets
  // its photo when the venue id resolves a park.
  const park = parkBackdrop(name, t, venueId)
  return (
    <SheetFrame title={name} onClose={onClose}>
      {park && <ParkPhoto park={park} />}
      {layout && <BallparkDiagram layout={layout} />}
      {data && (
        <>
          <dl className="lpark__facts">
            {[
              ['Opened', data.built],
              ['Roof', data.roof],
              ['Capacity', data.capacity?.toLocaleString()],
            ].map(([label, value]) => (
              <div key={label} className="lpark__fact">
                <dt>{label}</dt>
                <dd>{value || '—'}</dd>
              </div>
            ))}
          </dl>
          <h4 className="lsheet__head">Outfield distances</h4>
          <RankRows rows={data.rows.filter((r) => r.group === 'dist')} />
          <h4 className="lsheet__head">Wall heights</h4>
          <RankRows rows={data.rows.filter((r) => r.group === 'wall')} />
        </>
      )}
      <p className="lsheet__foot">
        {layout?.validTo && `The drawing shows the wall used through ${layout.validTo.slice(0, 4)}; the ranks are for today's park. `}
        {data ? 'Distances from the MLB Stats API, ranked among the MLB parks. Wall outline checked against Baseball Savant.' : 'Distances from the MLB Stats API.'}
      </p>
    </SheetFrame>
  )
}
