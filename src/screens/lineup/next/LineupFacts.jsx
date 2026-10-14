import { useState } from 'react'
import { selectRecordIsClosed } from '../../../api/gamerecord/played.js'
import { BallparkModal } from '../../../components/ballpark/BallparkModal.jsx'
import { UmpiresCard } from '../../../components/umpire/UmpiresCard.jsx'
import { FactGrid } from '../../../components/ui/frame/FactGrid.jsx'
import { ballparkFor } from '../../../lib/ballpark/ballparkData.js'
import { resolveBallparkLayout } from '../../../lib/ballpark/layout/resolveLayout.js'
import { CrowdIcon, Fact, managerFact } from '../../TeamInfo.jsx'
import { parkShort, shortDate } from './logic/factText.js'

const DiamondIcon = () => (
  <svg viewBox="0 0 20 20" width="12" height="12" aria-hidden="true" fill="currentColor">
    <path d="M10 2 18 10 10 18 2 10Z" />
  </svg>
)
const ShirtIcon = () => (
  <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" fill="currentColor">
    <path d="M8 3 3 6l2 4 2-1v12h10V9l2 1 2-4-5-3c-1 2-7 2-8 0Z" />
  </svg>
)

// One cell of the strip: a label, a value, and an optional round glyph button after the
// value. A glyph either unfolds a small note under the value (`note`) or opens a sheet.
function Cell({ label, value, glyph, note }) {
  return (
    <div className="fact lfact">
      <dt className="fact__label">{label}</dt>
      <dd className="fact__value lfact__value">
        <span className="lfact__text">{value || <span className="fact__na">—</span>}</span>
        {glyph}
      </dd>
      {note}
    </div>
  )
}

function Glyph({ label, open, onClick, children }) {
  return (
    <button type="button" className="lfact__glyph" aria-label={label} aria-expanded={open} onClick={onClick}>
      {children}
    </button>
  )
}

// The park, by its short name. Where the park is on file (a drawing or its dimensions) a
// diamond glyph opens the ballpark sheet; otherwise it is plain text.
function ParkCell({ info }) {
  const [open, setOpen] = useState(false)
  const known = ballparkFor(info.venue, info.venueId) || resolveBallparkLayout({ venueId: info.venueId, venueName: info.venue, gameDate: info.officialDate })
  return (
    <>
      <Cell
        label="Ballpark"
        value={parkShort(info.venue)}
        glyph={known && <Glyph label="Ballpark diagram" onClick={() => setOpen(true)}><DiamondIcon /></Glyph>}
      />
      {open && <BallparkModal venue={info.venue} venueId={info.venueId} gameDate={info.officialDate} onClose={() => setOpen(false)} />}
    </>
  )
}

// Attendance, with a crowd glyph that unfolds how full the park was when the capacity is on
// file and the figure parses. Anything else is the plain cell.
function CrowdCell({ info }) {
  const [open, setOpen] = useState(false)
  const park = ballparkFor(info.venue)
  const count = info.attendance ? Number(info.attendance.replace(/,/g, '')) : null
  const pct = park?.capacity && count ? Math.round((count / park.capacity) * 100) : null
  if (!pct) return <Cell label="Attendance" value={info.attendance} />
  return (
    <Cell
      label="Attendance"
      value={info.attendance}
      glyph={<Glyph label="How full is the stadium" open={open} onClick={() => setOpen((o) => !o)}><CrowdIcon /></Glyph>}
      note={
        open && (
          <p className="lfact__note">
            <b>{pct}% full</b>
            <span>{park.capacity.toLocaleString()} capacity</span>
          </p>
        )
      }
    />
  )
}

// The crew is as long as the game's crew: four umpires (HP, 1B, 2B, 3B) in most games, six
// with the two foul-line umpires (LF, RF) in the postseason. The strip sizes its cells to the
// count, so no cell sits alone on a row (see .lnext__umps--4 and --6).
// The fact strip and the crew, in two strips under the hero. Weather is the outdoor reading
// (Box weather shows only when it is missing). The Uniform glyph opens the crest sheet. The
// crew is UmpiresCard's cells; before the crew posts the strip says so in one cell.
export function LineupFacts({ feed, side, info, officials, season, manager, uniform, broadcast, weather, weatherLoading, onUniform }) {
  return (
    <>
      <FactGrid look="strip" className="lnext__facts">
        <Cell label="Date" value={shortDate(info.officialDate)} />
        <ParkCell info={info} />
        <Cell label="Weather" value={weatherLoading ? '…' : weather?.text} />
        {!weatherLoading && !weather?.text && info.weather && <Fact label="Box weather" value={info.weather} />}
        <CrowdCell info={info} />
        <Cell label="Manager" value={managerFact(manager)} />
        <Cell
          label="Uniform"
          value={uniform}
          glyph={uniform && <Glyph label={`Uniform and marks: ${uniform}`} onClick={onUniform}><ShirtIcon /></Glyph>}
        />
        {side === 'away' && <Cell label="Broadcast" value={broadcast} />}
      </FactGrid>
      <FactGrid look="strip" className={`lnext__facts lnext__umps lnext__umps--${officials.length}`}>
        {officials.length === 0 && !selectRecordIsClosed(feed) && <Fact label="Umpires" value="Not posted yet" />}
        <UmpiresCard officials={officials} seasonYear={season} closed={selectRecordIsClosed(feed)} />
      </FactGrid>
    </>
  )
}
