import { lazy, Suspense, useCallback, useState } from 'react'
import { teamChipColors } from '../../../../../lib/teams.js'
import { StageCanvas } from '../../stage/StageCanvas.jsx'
import { BALLPARK_SCENES } from '../ballpark/scenes.js'
import { CelebrationBoundary } from './CelebrationBoundary.jsx'
import '../../../../../styles/gameday-next/celebration.css'

const Ballpark = lazy(() => import('../ballpark/BallparkCelebration.jsx').then((m) => ({ default: m.BallparkCelebration })))

// Only receives an already-revealed event from GamedayStage's lazy SealBox
// subtree. The normal field stays behind the cutscene until its art is ready.
export function GamedayPlayCanvas({ celebration, playing, onEnd, checkpointHeld = false, ...stage }) {
  const [failed, setFailed] = useState(false)
  const fail = useCallback(() => { setFailed(true); onEnd?.() }, [onEnd])
  if (!celebration || failed) return <StageCanvas {...stage} />
  const scene = BALLPARK_SCENES[celebration.scene]
  const kit = teamChipColors(celebration.teamId)
  const field = <StageCanvas {...stage} actors={null} t={stage.play.end} />
  return (
    <CelebrationBoundary fallback={field} onFail={fail}>
      {field}
      <div className="gdcelebration">
        <Suspense fallback={null}>
          <Ballpark character={scene.character} track={scene.track} headline={celebration.headline ?? scene.headline} name={celebration.name}
            helmet={kit?.primary} trim={kit?.secondary} playing={playing} time={playing ? undefined : scene.track.duration}
            onDone={onEnd} onSkip={checkpointHeld ? undefined : onEnd} onError={fail} />
        </Suspense>
      </div>
    </CelebrationBoundary>
  )
}
