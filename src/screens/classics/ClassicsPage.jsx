import { useState } from 'react'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { useFavoriteTeam } from '../../hooks/preferences/useFavoriteTeam.js'
import { SiteHeader } from '../../components/chrome/SiteHeader.jsx'
import { ClassicCard } from '../../components/classics/ClassicCard.jsx'
import { Chips } from '../../components/ui/control/Chips.jsx'
import { teamClubNameShort, isMlbTeamId } from '../../lib/teams.js'

// SCORE A CLASSIC (/classics, issue #1525, slice 3) — one old MLB game, dealt on
// who played, never on what happened (ADR-0080). The page owns two filters, an
// era and a club, and hands them to ClassicCard, which deals and shows the game.
// It fetches nothing and holds no score. It adds no seal and no opener: the card's
// button opens the game's lineup page, sealed as any other game is (ADR-0117).
//
// The filters are page state, not address, and the seed is one per visit, so a
// new visit deals a new game and a filter change deals inside the filter.
const ERAS = [1960, 1970, 1980, 1990, 2000, 2010, 2020].map((y) => ({ value: y, label: `${String(y).slice(2)}s` }))

export function ClassicsPage() {
  useDocumentTitle('Score a classic')
  const { favoriteTeamId } = useFavoriteTeam()
  const favorite = isMlbTeamId(favoriteTeamId) ? favoriteTeamId : null
  const [seed] = useState(() => Math.floor(Math.random() * 1e9))
  const [era, setEra] = useState(null)
  const [teamId, setTeamId] = useState(favorite)

  const clubs = [...(favorite ? [{ value: favorite, label: teamClubNameShort(favorite) }] : []), { value: null, label: 'Any club' }]
  return (
    <div className="screen">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">Score a classic</h1>
      </header>
      <Chips label="Era" options={[{ value: null, label: 'Any era' }, ...ERAS]} value={era} onChange={setEra} />
      <Chips label="Club" options={clubs} value={teamId} onChange={setTeamId} />
      {/* The card empties while a deal loads (useAsync drops its data on a deps change); this holds its 360 px slot so the hint below does not jump. */}
      <div style={{ minHeight: '23rem' }}>
        <ClassicCard seed={seed} era={era} teamId={teamId} kicker="Dealt for you" />
      </div>
      <p className="hint">Games you started show “Pick up where you left off”.</p>
    </div>
  )
}
