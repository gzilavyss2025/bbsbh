import { safeToShowEntering } from '../../api/enteringHalf.js'
import { PitchersSection } from './PitchersSection.jsx'
import { MarginNotes } from './MarginNotes.jsx'
import { DefenseSection, LineupSection } from './EnteringReference.jsx'
import { RosterPanel } from './RosterPanel.jsx'

// The reference band (Margin Notes, Pitchers, defense, lineups) and the two
// roster panels beneath it — pulled out of InningViewer.jsx (which was at its
// 1000-line file-size ceiling) so ReferenceRail.jsx and the plain inline case
// can render the exact same markup from one place instead of two copies
// drifting apart. Same .innings__ref / .innings__rosters classes either way
// (25-wide-layout.css/12-sealbox.css); only WHERE this renders differs
// between the two callers.
export function ReferenceBand({
  feed,
  callouts,
  marginNotes,
  pitcherTeams,
  effInning,
  effHalf,
  meta,
  prospectsData,
  rookiesData,
  isMlb,
  revealedThrough,
}) {
  const showEntering = safeToShowEntering(revealedThrough, effInning, effHalf)
  return (
    <div className="innings__ref">
      <div className="innings__ref-left">
        <MarginNotes notes={marginNotes} feed={feed} bundle={callouts} />
        <PitchersSection teams={pitcherTeams} />
        {showEntering && (
          <div className="innings__ref-defense">
            <DefenseSection
              feed={feed}
              inning={effInning}
              half={effHalf}
              fieldingSide={effHalf === 'top' ? 'home' : 'away'}
              fieldingName={effHalf === 'top' ? meta.home.clubName : meta.away.clubName}
              fieldingTeamId={effHalf === 'top' ? meta.home.id : meta.away.id}
              revealedThrough={revealedThrough}
            />
          </div>
        )}
      </div>
      {showEntering && (
        <div className="innings__ref-lineups">
          <LineupSection
            feed={feed}
            inning={effInning}
            half={effHalf}
            awayName={meta.away.clubName}
            homeName={meta.home.clubName}
            prospectsData={prospectsData}
            rookiesData={rookiesData}
            isMlb={isMlb}
            revealedThrough={revealedThrough}
          />
        </div>
      )}
    </div>
  )
}

export function RosterPanels({ rosters, revealedThrough, prospectsData, rookiesData, isMlb }) {
  return (
    <div className="innings__rosters">
      <RosterPanel
        title={rosters.away.name}
        roster={rosters.away}
        revealedThrough={revealedThrough}
        prospectsData={prospectsData}
        rookiesData={rookiesData}
        isMlb={isMlb}
      />
      <RosterPanel
        title={rosters.home.name}
        roster={rosters.home}
        revealedThrough={revealedThrough}
        prospectsData={prospectsData}
        rookiesData={rookiesData}
        isMlb={isMlb}
      />
    </div>
  )
}
