import { useEffect, useRef, useState } from 'react'
import { fetchFielding, fetchPersonStats, fetchStarterReliever } from '../../../../../api/person-fetch.js'
import { fieldingView, pitchingStints, starterRelieverView } from '../../../../../api/person.js'
import { loadPositionScope } from '../../../../../api/player/history.js'
import { fetchTeam } from '../../../../../api/team.js'
import { BallparkDiagram } from '../../../../../components/ballpark/BallparkDiagram.jsx'
import { FieldBackdrop } from '../../../../../components/scoring/field/FieldBackdrop.jsx'
import { Button } from '../../../../../components/ui/control/Button.jsx'
import { Cluster } from '../../../../../components/ui/layout/Cluster.jsx'
import { Stack } from '../../../../../components/ui/layout/Stack.jsx'
import { Loader } from '../../../../../components/ui/Loader.jsx'
import { resolveBallparkLayout } from '../../../../../lib/ballpark/layout/resolveLayout.js'
import { batterView, PARK_VIEWBOX, pitcherView, scopeOptions, spotAt, TAG_SIDE } from './inningsView.js'
import '../../../../../styles/player-next/both/innings.css'

const POSITION_NAME = {
  C: 'Catcher', '1B': 'First base', '2B': 'Second base', '3B': 'Third base', SS: 'Shortstop',
  LF: 'Left field', CF: 'Center field', RF: 'Right field', P: 'Pitcher',
}

// One scope's view, or null for none. The season scope is a single MLB call; the career scope
// goes through loadPositionScope, the live History tab's own loader. These aggregates carry no
// date cut (person-fetch.js header), so neither fetcher takes `asOf`; `season` is the viewed one.
async function loadScope(bio, role, scope, season) {
  const id = bio.id
  if (role === 'pitching') {
    if (scope === 'season') return pitcherView(starterRelieverView(await fetchStarterReliever(id, { season, sportId: 1 })))
    const pitchStints = pitchingStints(await fetchPersonStats(id, { type: 'yearByYear', group: 'pitching', sportId: 1 }))
    const res = await loadPositionScope(id, 'mlb', { showFielding: false, showPitching: true, pitchStints })
    return pitcherView(res.pitching)
  }
  if (scope === 'season') return batterView(fieldingView(await fetchFielding(id, { season, sportId: 1 })))
  return batterView((await loadPositionScope(id, 'mlb', { showFielding: true, showPitching: false })).fielding)
}

// The park of the club he is on, as it stands on `asOf` (today when none). Null when the club
// has no park on file (most MiLB clubs, a player with no club): the card then draws the shared field.
async function loadPark(bio, asOf) {
  const venue = (await fetchTeam(bio.team?.id))?.venue
  return venue ? resolveBallparkLayout({ venueId: venue.id, venueName: venue.name, gameDate: asOf ?? undefined }) : null
}

function Ring({ pos, size, top, innings, label, park }) {
  const at = spotAt(pos, park)
  return (
    <span
      className={`pnext-inn__ring${top ? ' pnext-inn__ring--top' : ''}`}
      style={{ left: `${at.x}%`, top: `${at.y}%` }}
      role="img"
      aria-label={label}
    >
      <svg viewBox="0 0 60 60" aria-hidden="true">
        <circle className="pnext-inn__track" cx="30" cy="30" r="21.5" />
        <circle className="pnext-inn__arc" cx="30" cy="30" r="21.5" pathLength="100" strokeDasharray={`${size} 100`} transform="rotate(-90 30 30)" />
        <circle className="pnext-inn__rim" cx="30" cy="30" r="27" />
        <circle className="pnext-inn__hub" cx="30" cy="30" r="16.5" />
      </svg>
      <span className="pnext-inn__code">{pos}</span>
      {innings && <span className={`pnext-inn__tag pnext-inn__tag--${TAG_SIDE[pos]}`}>{innings}</span>}
    </span>
  )
}

function Marks({ view, role, scopeWord, park }) {
  if (role === 'pitching') {
    return (
      <>
        <Ring pos="P" park={park} size={view.size} top label={`Pitcher, ${scopeWord}: ${view.starter} innings as a starter, ${view.reliever} as a reliever`} />
        <span className="pnext-inn__badge pnext-inn__badge--l"><b>Starter</b>{view.starter} IP</span>
        <span className="pnext-inn__badge pnext-inn__badge--r"><b>Reliever</b>{view.reliever} IP</span>
      </>
    )
  }
  return (
    <>
      {view.idle.map((pos) => (
        <span key={pos} className="pnext-inn__idle" style={{ left: `${spotAt(pos, park).x}%`, top: `${spotAt(pos, park).y}%` }} role="img" aria-label={`${POSITION_NAME[pos]}, no innings logged`}>
          {pos}
        </span>
      ))}
      {view.rings.map((r) => (
        <Ring key={r.pos} {...r} park={park} label={`${POSITION_NAME[r.pos]}, ${scopeWord}: ${r.innings} innings, ${Math.round(r.share * 100)} percent of his field innings`} />
      ))}
      {view.dh > 0 && <span className="pnext-inn__badge pnext-inn__badge--r"><b>DH</b>{view.dh} G</span>}
    </>
  )
}

// Innings by position (#1928): rings on the park, one per position (a pitcher's one ring is the
// mound, the arc his starter share), and a Season / MLB career switch. Hitting and pitching are
// two instances, so a two-way player gets a card for each.
export default function InningsModule({ bio, role, asOf, season, onEmpty, onCount }) {
  const scopes = scopeOptions(bio)
  const [scope, setScope] = useState('season')
  const [views, setViews] = useState({})
  const [park, setPark] = useState()
  const picked = useRef(false)

  // The club's park: undefined while it loads, null for none.
  useEffect(() => {
    let live = true
    loadPark(bio, asOf).catch(() => null).then((p) => live && setPark(p))
    return () => { live = false }
  }, [bio.team?.id, asOf]) // eslint-disable-line react-hooks/exhaustive-deps

  // Season first; a player with no season line (retired, off the roster) lands on his career.
  useEffect(() => {
    let live = true
    ;(async () => {
      const found = { season: await loadScope(bio, role, 'season', season) }
      if (!found.season && scopes.length > 1) found.mlb = await loadScope(bio, role, 'mlb', season)
      if (!live) return
      const key = found.season ? 'season' : 'mlb'
      if (!found[key]) return onEmpty()
      if (!picked.current) setScope(key)
      setViews((cur) => ({ ...found, ...cur }))
    })()
    return () => { live = false }
  }, [bio.id, role, season]) // eslint-disable-line react-hooks/exhaustive-deps

  const view = views[scope]
  useEffect(() => {
    const n = view?.rings?.length ?? 0
    onCount(n ? `${n} ${n === 1 ? 'position' : 'positions'}` : '')
  }, [view]) // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (key) => {
    picked.current = true
    setScope(key)
    if (key in views) return
    loadScope(bio, role, key, season)
      .catch(() => null)
      .then((v) => setViews((cur) => ({ ...cur, [key]: v })))
  }

  const scopeWord = scope === 'season' ? `${season} season` : 'MLB career'
  return (
    <Stack gap="snug">
      {scopes.length > 1 && (
        <Cluster className="pnext-inn__scope" role="group" aria-label="Scope">
          {scopes.map((s) => (
            <Button key={s.key} size="control" pressed={scope === s.key} onClick={() => pick(s.key)}>{s.label}</Button>
          ))}
        </Cluster>
      )}
      <div className={`pnext-inn__park${park === null ? ' pnext-inn__park--field' : ''}`}>
        {park && <BallparkDiagram layout={park} className="pnext-inn__art" viewBox={PARK_VIEWBOX} label={`${park.name} field`} />}
        {park === null && <FieldBackdrop className="pnext-inn__art" />}
        {(park === undefined || !(scope in views)) && <Loader size="inline" className="pnext-inn__loading" />}
        {view && park !== undefined && <Marks view={view} role={role} scopeWord={scopeWord} park={park} />}
        {scope in views && !view && <p className="hint pnext-inn__none">No innings logged.</p>}
      </div>
    </Stack>
  )
}
