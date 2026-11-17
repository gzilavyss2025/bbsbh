import { useEffect, useMemo, useRef, useState } from 'react'
import { TeamLogo } from '../../../components/logo/TeamLogo.jsx'
import { ScrollCue } from '../../gameday/next/ScrollCue.jsx'
import { Segmented } from '../../../components/ui/control/Segmented.jsx'
import { Button } from '../../../components/ui/control/Button.jsx'
import { fetchRide, fetchWildLists, fetchWildShapes } from '../../../api/wildrides/fetch.js'
import { club, ord, summarize } from '../../../lib/wildrides/story.js'
import { SEGMENTS, shapeDistance } from '../../../lib/wildrides/shape.js'
import { shortDate } from './draw.js'
import { Ride } from './Ride.jsx'
import './wild-rides.css'

// WILD RIDES (/wild-rides, unlisted while it is a draft): the season's games ranked by
// win-probability drama, one game ridden at a time. The page loads only the lists file
// (a few KB); Draw loads the shapes file when opened; a picked game's ride is read from
// statsapi then (src/api/wildrides/fetch.js). An open season page: finals show plainly.

const SEASON = 2026
const LIST_SIZE = 15

// Each list leads with the one number a beat writer would put in the first sentence.
const TABS = [
  { key: 'wild', label: 'Wildest', sub: 'Biggest swings', stat: (g) => ({ n: g.ties + g.leadChanges, label: 'ties and lead changes' }) },
  { key: 'comeback', label: 'Comebacks', sub: 'Deficits erased', stat: (g) => ({ n: g.maxDeficit, label: `${g.maxDeficit === 1 ? 'run' : 'runs'} down, ${ord(g.deficitInning ?? 1)} inning` }) },
  { key: 'collapse', label: 'Collapses', sub: 'Late leads blown', stat: (g) => ({ n: g.lateDeficit, label: `run lead the ${club(g.homeWon ? g.away : g.home)} blew in the ${ord(g.lateInning ?? 9)}` }) },
  { key: 'seesaw', label: 'Seesaws', sub: 'Most lead changes', stat: (g) => ({ n: g.leadChanges, label: 'lead changes' }) },
]

export function WildRides() {
  const [lists, setLists] = useState(null)
  const [shapes, setShapes] = useState(null)
  const [tab, setTab] = useState('wild')
  const [drawn, setDrawn] = useState(null)
  const [pick, setPick] = useState(null) // the list row picked
  const [game, setGame] = useState(null) // its ride, with its story
  useEffect(() => {
    fetchWildLists(SEASON).then((d) => setLists(d?.lists ?? {}))
  }, [])
  useEffect(() => {
    if (tab === 'draw' && !shapes) fetchWildShapes(SEASON).then(setShapes)
  }, [tab, shapes])

  const list = useMemo(() => {
    if (tab !== 'draw') return lists?.[tab] ?? []
    if (!drawn || !shapes) return []
    return shapes
      .map((g) => ({ g, d: shapeDistance(drawn, g.shape) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, LIST_SIZE)
      .map((x) => x.g)
  }, [lists, shapes, tab, drawn])

  // A new list opens on its own #1: a pick from another list doesn't carry over.
  const current = pick && list.some((g) => g.gamePk === pick.gamePk) ? pick : (list[0] ?? null)

  // Read the picked game's ride; its story comes from the same code the generator ran.
  useEffect(() => {
    if (!current) return
    let live = true
    fetchRide(current).then((ride) => live && setGame(ride ? { ...ride, ...summarize(ride) } : null))
    return () => {
      live = false
    }
  }, [current])

  if (!lists) return <div className="screen wr"><p className="wr-eyebrow">Loading the season…</p></div>

  // The four lists are one house Segmented control; Draw is a tool, so it stands apart.
  const chips = (
    <div className="wr-tabs">
      <Segmented
        label="Kind of game"
        fill
        className="wr-seg"
        value={tab === 'draw' ? null : tab}
        onChange={setTab}
        options={TABS.map((x) => ({
          value: x.key,
          label: (
            <span className="wr-tab">
              <b>{x.label}</b>
              <span>{x.sub}</span>
            </span>
          ),
        }))}
      />
      <Button skin="outline" pressed={tab === 'draw'} onClick={() => setTab('draw')} className="wr-draw">
        <span className="wr-tab">
          <b>✎ Draw</b>
          <span>Find a match</span>
        </span>
      </Button>
    </div>
  )
  const games = (
    <>
      {tab === 'draw' && <DrawPad onDraw={setDrawn} />}
      <ScrollCue label="More games below" className="wr-scroll">
        <ol className="wr-list">
          {list.map((g) => (
            <li key={g.gamePk}>
              <button aria-pressed={g.gamePk === current?.gamePk} onClick={() => setPick(g)}>
                <span className="wr-when">{shortDate(g.date)}</span>
                <span className="wr-teams">
                  <TeamLogo teamId={g.away} size={20} />
                  <b className={g.homeWon ? '' : 'is-win'}>{g.score[0]}</b>
                  <span className="wr-at">@</span>
                  <TeamLogo teamId={g.home} size={20} />
                  <b className={g.homeWon ? 'is-win' : ''}>{g.score[1]}</b>
                </span>
                <span className="wr-inns">{g.innings > 9 ? `${g.innings} inn` : 'Final'}</span>
              </button>
            </li>
          ))}
        </ol>
      </ScrollCue>
    </>
  )
  return (
    <div className="screen wr">
      <div className="wr-eyebrow">Wild rides of {SEASON}</div>
      {game ? (
        <Ride key={game.gamePk} game={game} chips={chips} games={games} shape={TABS.find((x) => x.key === tab) ?? TABS[0]} />
      ) : (
        <article className="wr-card">{chips}<p className="wr-eyebrow">Loading the game…</p>{games}</article>
      )}
    </div>
  )
}

// Draw the home team's win chance; the sketch becomes SEGMENTS numbers, the same as a game's shape.
function DrawPad({ onDraw }) {
  const ref = useRef(null)
  const [pts, setPts] = useState([])
  const live = useRef([]) // the stroke so far, read at pointerup without waiting for a render
  const add = (e) => {
    const r = ref.current.getBoundingClientRect()
    live.current = [...live.current, [((e.clientX - r.left) / r.width) * 300, Math.max(0, Math.min(110, ((e.clientY - r.top) / r.height) * 110))]]
    setPts(live.current)
  }
  const finish = () => {
    if (live.current.length < 4) return
    const s = [...live.current].sort((a, b) => a[0] - b[0])
    onDraw(
      Array.from({ length: SEGMENTS }, (_, k) => {
        const x = ((k + 0.5) / SEGMENTS) * 300
        let j = s.findIndex((p) => p[0] >= x)
        if (j < 0) j = s.length - 1
        return 100 - (s[j][1] / 110) * 100
      }),
    )
  }
  return (
    <div>
      <div className="wr-eyebrow">Draw the home team&apos;s win chance, first pitch to final out</div>
      <svg
        ref={ref}
        className="wr-pad"
        viewBox="0 0 300 110"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          live.current = []
          setPts([])
          add(e)
        }}
        onPointerMove={(e) => e.buttons && add(e)}
        onPointerUp={finish}
      >
        <line x1="0" x2="300" y1="55" y2="55" className="wr-mid" />
        <path d={pts.map((p, i) => `${i ? 'L' : 'M'}${p}`).join('')} className="wr-ink" />
      </svg>
    </div>
  )
}
