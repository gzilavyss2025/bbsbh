import { useAsync } from '../../../../hooks/useAsync.js'
import { fetchLastOpponent } from '../../../../api/schedule.js'
import { WpaScenarios } from '../../../identity-lab/editors/WpaScenarios.jsx'

// The WPA group's live preview: the REAL WinProbChart, at three fixed
// win-probability states, against this club's own most recent completed
// opponent — the fabricated-opponent-free version of the mockup
// /identity-lab's own WpaScenarios already draws (screens/identity-lab/
// editors/WpaScenarios.jsx), reused here rather than reimplemented so the
// two previews can't drift apart.
//
// Deliberately passes NO layout/band/mark override props to WpaScenarios
// (unlike the lab's own usage): this drawer's draft is already applied to
// the overlay's PREVIEW layer by the time this renders (identityFields.js's
// header comment, IdentityDrawer.jsx's own "one render path" rule), so
// WinProbChart reading `wpaLogoLayout`/`wpaBandColor` the ORDINARY way
// already shows the in-progress edit — the same reason IdentityStampPreview
// passes no override props to GameStamp either.
//
// `sportId` picks which sport's schedule fetchLastOpponent reads — an MLB
// club's is always 1; a MiLB affiliate's is its real level (11-14,
// TeamHubShell's `team.sport?.id`), without which the schedule fetch would
// look under the wrong sport and never find a game.
export function IdentityWpaPreview({ teamId, sportId, name, treatment, headerColors }) {
  const opponent = useAsync(() => fetchLastOpponent(teamId, new Date().getFullYear(), sportId), [teamId, sportId])

  if (opponent.loading) return <p className="iddrawer__hint">Loading a matchup preview…</p>
  // No completed game on file yet (a new season, or a fetch that came up
  // empty) — WpaScenarios itself renders nothing without an opponent, so
  // this just skips the whole preview rather than showing a broken mockup.
  if (!opponent.data) return null

  return (
    <WpaScenarios
      teamId={teamId}
      name={name}
      treatment={treatment}
      lastOpponent={opponent.data}
      headerColors={headerColors}
    />
  )
}
