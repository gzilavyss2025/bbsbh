import { useState } from 'react'
import { Button } from '../../components/ui/control/Button.jsx'
import { Cluster } from '../../components/ui/layout/Cluster.jsx'
import { Stack } from '../../components/ui/layout/Stack.jsx'
import { teamChipColors } from '../../lib/teams.js'
import { BallparkCelebration } from '../gameday/next/cutscene/ballpark/BallparkCelebration.jsx'
import { HOME_RUN, momentAt, stepTime } from '../gameday/next/cutscene/ballpark/choreography.js'

const CLUBS = [{ id: 158, name: 'Brewers' }, { id: 143, name: 'Phillies' }, { id: 146, name: 'Marlins' }, { id: 110, name: 'Orioles' }, { id: 0, name: 'Neutral' }]
const POSES = [0, 0.32, 0.58, 0.86, 1.48, 2.8]

// Canvas needs an explicit playhead: the shared Entry's CSS animation pause
// cannot stop requestAnimationFrame. Keep all transport controls local here.
export function CutsceneMotionLab() {
  const [time, setTime] = useState(0), [playing, setPlaying] = useState(false)
  const [run, setRun] = useState(0), [rate, setRate] = useState(1)
  const [club, setClub] = useState(158), [reduced, setReduced] = useState(false)
  const [name, setName] = useState('Christian Yelich')
  const colors = teamChipColors(club)
  const kit = { helmet: colors?.primary, trim: colors?.secondary }
  const seek = (t) => { setPlaying(false); setTime(t) }
  const replay = () => { setTime(0); setRun((n) => n + 1); setPlaying(true) }
  return (
    <Stack as="section" id="ballpark" gap="base" className="animlab__entry">
      <Cluster align="center">
        <h2 className="animlab__title">Ballpark celebration</h2>
        <Button skin="ink" onClick={replay}>Replay celebration</Button>
        <Button onClick={() => setPlaying((p) => !p)} disabled={!playing && time >= HOME_RUN.duration}>{playing ? 'Pause' : 'Play'}</Button>
      </Cluster>
      <div className="ballpark-review__stage">
        <BallparkCelebration key={run} {...kit} name={name} time={playing ? undefined : time} playing={playing} rate={rate} reduced={reduced}
          onTime={setTime} onDone={() => setPlaying(false)} onSkip={() => seek(HOME_RUN.duration)} />
      </div>
      <Stack as="label" gap="tight">
        <span className="t-label">Celebration timeline</span>
        <input className="ballpark-review__timeline" type="range" min="0" max={HOME_RUN.duration} step="0.01" value={time}
          aria-valuetext={`${time.toFixed(2)} seconds, ${momentAt(time).beat}`} onChange={(e) => seek(Number(e.target.value))} />
      </Stack>
      <Cluster align="center">
        <Button onClick={() => seek(stepTime(time, -1))} disabled={time <= 0}>Previous pose</Button>
        <Button onClick={() => seek(stepTime(time, 1))} disabled={momentAt(time).index === HOME_RUN.frames.length - 1}>Next pose</Button>
        <span className="ballpark-review__time">{time.toFixed(2)} / {HOME_RUN.duration.toFixed(2)} s · {momentAt(time).beat}</span>
      </Cluster>
      <Cluster align="center">
        <Stack as="label" gap="tight"><span className="t-label">Club palette</span>
          <select className="searchbox__input" value={club} onChange={(e) => { setPlaying(false); setClub(Number(e.target.value)) }}>
            {CLUBS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Stack>
        <Stack as="label" gap="tight"><span className="t-label">Playback speed</span>
          <select className="searchbox__input" value={rate} onChange={(e) => setRate(Number(e.target.value))}>
            <option value={1}>Normal</option><option value={0.5}>Half speed</option><option value={0.25}>Quarter speed</option>
          </select>
        </Stack>
        <Button pressed={reduced} onClick={() => { setPlaying(false); setReduced((r) => !r) }}>Reduced motion</Button>
      </Cluster>
      <Stack as="label" gap="tight"><span className="t-label">Player caption</span>
        <input className="searchbox__input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
      </Stack>
      <p className="hint hint--prose">Home run study. Team colors on a simplified kit; stadium and character are separate artwork. No live game is connected.</p>
      <div className="ballpark-review__frames" aria-label="Frozen celebration poses">
        {POSES.map((t) => <Stack key={t} gap="tight" className="ballpark-review__frame">
          <BallparkCelebration {...kit} name={name} time={t} />
          <span className="animlab__framelabel">{t.toFixed(2)} s · {momentAt(t).beat}</span>
        </Stack>)}
      </div>
    </Stack>
  )
}
