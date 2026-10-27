import { useState } from 'react'
import { Button } from '../../components/ui/control/Button.jsx'
import { Cluster } from '../../components/ui/layout/Cluster.jsx'
import { Stack } from '../../components/ui/layout/Stack.jsx'
import { teamChipColors } from '../../lib/teams.js'
import { BallparkCelebration } from '../gameday/next/cutscene/ballpark/BallparkCelebration.jsx'
import { momentAt, stepTime } from '../gameday/next/cutscene/ballpark/choreography.js'
import { BALLPARK_SCENES } from '../gameday/next/cutscene/ballpark/scenes.js'

const CLUBS = [{ id: 158, name: 'Brewers' }, { id: 143, name: 'Phillies' }, { id: 146, name: 'Marlins' }, { id: 110, name: 'Orioles' }, { id: 0, name: 'Neutral' }]

// Canvas needs an explicit playhead: the shared Entry's CSS animation pause
// cannot stop requestAnimationFrame. Keep all transport controls local here.
export function CutsceneMotionLab() {
  const [sceneId, setSceneId] = useState('homeRun')
  const [time, setTime] = useState(0), [playing, setPlaying] = useState(false)
  const [run, setRun] = useState(0), [rate, setRate] = useState(1)
  const [club, setClub] = useState(158), [reduced, setReduced] = useState(false)
  const [name, setName] = useState('Christian Yelich')
  const scene = BALLPARK_SCENES[sceneId], { track } = scene
  const sceneProps = { track, character: scene.character, headline: scene.headline }
  const colors = teamChipColors(club)
  const kit = { helmet: colors?.primary, trim: colors?.secondary }
  const seek = (t) => { setPlaying(false); setTime(t) }
  const replay = () => { setTime(0); setRun((n) => n + 1); setPlaying(true) }
  return (
    <Stack as="section" id="ballpark" gap="base" className="animlab__entry">
      <Cluster align="center">
        <h2 className="animlab__title">Ballpark celebration</h2>
        <Button skin="ink" onClick={replay}>Replay celebration</Button>
        <Button onClick={() => setPlaying((p) => !p)} disabled={!playing && time >= track.duration}>{playing ? 'Pause' : 'Play'}</Button>
      </Cluster>
      <Stack as="label" gap="tight"><span className="t-label">Celebration</span>
        <select aria-label="Celebration" className="searchbox__input" value={sceneId} onChange={(e) => {
          const next = e.target.value
          setPlaying(false); setTime(0); setRun((n) => n + 1)
          setName(BALLPARK_SCENES[next].exampleName); setSceneId(next)
        }}>
          {Object.entries(BALLPARK_SCENES).map(([id, s]) => <option key={id} value={id}>{s.label}</option>)}
        </select>
      </Stack>
      <div className="ballpark-review__stage">
        <BallparkCelebration key={run} {...kit} {...sceneProps} name={name} time={playing ? undefined : time} playing={playing} rate={rate} reduced={reduced}
          onTime={setTime} onDone={() => setPlaying(false)} onSkip={() => seek(track.duration)} />
      </div>
      <Stack as="label" gap="tight">
        <span className="t-label">Celebration timeline</span>
        <input className="ballpark-review__timeline" type="range" min="0" max={track.duration} step="0.01" value={time}
          aria-valuetext={`${time.toFixed(2)} seconds, ${momentAt(time, track).beat}`} onChange={(e) => seek(Number(e.target.value))} />
      </Stack>
      <Cluster align="center">
        <Button onClick={() => seek(stepTime(time, -1, track))} disabled={time <= 0}>Previous pose</Button>
        <Button onClick={() => seek(stepTime(time, 1, track))} disabled={momentAt(time, track).index === track.frames.length - 1}>Next pose</Button>
        <span className="ballpark-review__time">{time.toFixed(2)} / {track.duration.toFixed(2)} s · {momentAt(time, track).beat}</span>
      </Cluster>
      <Cluster align="center">
        <Stack as="label" gap="tight"><span className="t-label">Club palette</span>
          <select aria-label="Club palette" className="searchbox__input" value={club} onChange={(e) => { setPlaying(false); setClub(Number(e.target.value)) }}>
            {CLUBS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Stack>
        <Stack as="label" gap="tight"><span className="t-label">Playback speed</span>
          <select aria-label="Playback speed" className="searchbox__input" value={rate} onChange={(e) => setRate(Number(e.target.value))}>
            <option value={1}>Normal</option><option value={0.5}>Half speed</option><option value={0.25}>Quarter speed</option>
          </select>
        </Stack>
        <Button pressed={reduced} onClick={() => { setPlaying(false); setReduced((r) => !r) }}>Reduced motion</Button>
      </Cluster>
      <Stack as="label" gap="tight"><span className="t-label">Player caption</span>
        <input className="searchbox__input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
      </Stack>
      <p className="hint hint--prose">{scene.role} study. Team colors on a simplified kit; no live game is connected.</p>
      <div className="ballpark-review__frames" aria-label="Frozen celebration poses">
        {scene.review.map((t) => <Stack key={`${sceneId}:${t}`} gap="tight" className="ballpark-review__frame">
          <BallparkCelebration {...kit} {...sceneProps} name={name} time={t} />
          <span className="animlab__framelabel">{t.toFixed(2)} s · {momentAt(t, track).beat}</span>
        </Stack>)}
      </div>
    </Stack>
  )
}
