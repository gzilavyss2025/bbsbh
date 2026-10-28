import { lazy, Suspense, useCallback, useState } from 'react'
import { teamChipColors } from '../../../../../lib/teams.js'
import { BALLPARK_SCENES } from '../ballpark/scenes.js'
import { CelebrationBoundary } from './CelebrationBoundary.jsx'
import { IconButton } from '../../../../../components/ui/control/IconButton.jsx'
import { TeamLogo } from '../../../../../components/logo/TeamLogo.jsx'
import '../../../../../styles/gameday-next/celebration.css'

const Ballpark = lazy(() => import('../ballpark/BallparkCelebration.jsx').then((m) => ({ default: m.BallparkCelebration })))

// Only receives an already-revealed event from GamedayStage's lazy SealBox
// subtree. The corner field is gone (Gary, 2026-10-28): nothing draws behind the cutscene, and a
// failed scene leaves the stage empty. The ✕ puts the scene away (ending it first if it still plays).
export function GamedayPlayCanvas({ celebration, playing, onEnd, onReplay, onClose, checkpointHeld = false }) {
  const [failed, setFailed] = useState(false)
  const [closed, setClosed] = useState(false)
  const fail = useCallback(() => { setFailed(true); onEnd?.() }, [onEnd])
  if (!celebration || failed || closed) return null
  const scene = BALLPARK_SCENES[celebration.scene]
  const kit = teamChipColors(celebration.teamId)
  const close = () => { if (playing) onEnd?.(); setClosed(true); onClose?.() }
  return (
    <CelebrationBoundary fallback={null} onFail={fail}>
      <div className="gdcelebration">
        {/* The celebrating club's mark over the stands, upper left (Gary, 2026-10-28): the one-colour knockout, which reads on the night scene. */}
        <span className="gdcelebration__club" aria-hidden="true"><TeamLogo teamId={celebration.teamId} name="" size={80} variant="mono" /></span>
        <IconButton label="Close the celebration" mark="sm" className="gdcelebration__close" onClick={close}>✕</IconButton>
        <Suspense fallback={null}>
          <Ballpark character={scene.character} track={scene.track} headline={celebration.headline ?? scene.headline} name={celebration.name}
            helmet={kit?.primary} trim={kit?.secondary} playing={playing} time={playing ? undefined : scene.track.duration}
            onDone={onEnd} onSkip={playing && !checkpointHeld ? onEnd : undefined} onReplay={playing ? undefined : onReplay} onError={fail} />
        </Suspense>
      </div>
    </CelebrationBoundary>
  )
}
