import { useEffect, useRef, useState } from 'react'
import {
  fetchFielding, fetchMilbFieldingSeason, fetchMilbStarterRelieverSeason, fetchMilbYearByYear, fetchPersonStats, fetchStarterReliever,
} from '../../../../../api/person-fetch.js'
import { fieldingView, pitchingStints, starterRelieverView } from '../../../../../api/person.js'
import { loadPositionScope } from '../../../../../api/player/history.js'
import { fetchTeam } from '../../../../../api/team.js'
import { BallparkDiagram } from '../../../../../components/ballpark/BallparkDiagram.jsx'
import { FieldBackdrop } from '../../../../../components/scoring/field/FieldBackdrop.jsx'
import { Segmented } from '../../../../../components/ui/control/Segmented.jsx'
import { Stack } from '../../../../../components/ui/layout/Stack.jsx'
import { Loader } from '../../../../../components/ui/Loader.jsx'
import { resolveBallparkLayout } from '../../../../../lib/ballpark/layout/resolveLayout.js'
import { batterView, inMinors, innWindow, pitcherView, scopeOptions, spotAt, TAG_SIDE } from './inningsView.js'
import '../../../../../styles/player-next/both/innings.css'

const POSITION_NAME = {
  C: 'Catcher', '1B': 'First base', '2B': 'Second base', '3B': 'Third base', SS: 'Shortstop',
  LF: 'Left field', CF: 'Center field', RF: 'Right field', P: 'Pitcher',
}

// One scope's view, or null for none. Season is the one season's call (every MiLB level for a
// player in the minors); a career scope goes through loadPositionScope, the live History tab's own
// loader. These aggregates carry no date cut (person-fetch.js header), so no fetcher takes `asOf`;
// `season` is the viewed one.
async function loadScope(bio, role, scope, season) {
  const id = bio.id
  const pitching = role === 'pitching'
  if (scope === 'season') {
    if (pitching) {
      const splits = inMinors(bio) ? await fetchMilbStarterRelieverSeason(id, season) : await fetchStarterReliever(id, { season, sportId: 1 })
      return pitcherView(starterRelieverView(splits))
    }
    const splits = inMinors(bio) ? await fetchMilbFieldingSeason(id, season) : await fetchFielding(id, { season, sportId: 1 })
    return batterView(fieldingView(splits))
  }
  const pitchStints = pitching
    ? pitchingStints(scope === 'mlb' ? await fetchPersonStats(id, { type: 'yearByYear', group: 'pitching', sportId: 1 }) : await fetchMilbYearByYear(id, 'pitching'))
    : []
  const res = await loadPositionScope(id, scope, { showFielding: !pitching, showPitching: pitching, pitchStints })
  return pitching ? pitcherView(res.pitching) : batterView(res.fielding)
}

// The park of the club he is on, as it stands on `asOf` (today when none). Null when the club
// has no park on file (most MiLB clubs, a player with no club): the card then draws the shared field.
async function loadPark(bio, asOf) {
  const venue = (await fetchTeam(bio.team?.id))?.venue
  return venue ? resolveBallparkLayout({ venueId: venue.id, venueName: venue.name, gameDate: asOf ?? undefined }) : null
}

function Ring({ pos, size, top, innings, label, win }) {
  const at = spotAt(pos, win)
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

function Marks({ view, role, scopeWord, win }) {
  if (role === 'pitching') {
    return (
      <>
        <Ring pos="P" win={win} size={view.size} top label={`Pitcher, ${scopeWord}: ${view.starter} innings as a starter, ${view.reliever} as a reliever`} />
        <span className="pnext-inn__badge pnext-inn__badge--l"><b>Starter</b>{view.starter} IP</span>
        <span className="pnext-inn__badge pnext-inn__badge--r"><b>Reliever</b>{view.reliever} IP</span>
      </>
    )
  }
  return (
    <>
      {view.idle.map((pos) => (
        <span key={pos} className="pnext-inn__idle" style={{ left: `${spotAt(pos, win).x}%`, top: `${spotAt(pos, win).y}%` }} role="img" aria-label={`${POSITION_NAME[pos]}, no innings logged`}>
          {pos}
        </span>
      ))}
      {view.rings.map((r) => (
        <Ring key={r.pos} {...r} win={win} label={`${POSITION_NAME[r.pos]}, ${scopeWord}: ${r.innings} innings, ${Math.round(r.share * 100)} percent of his field innings`} />
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
  const win = park ? innWindow(park) : null // the board's window onto this park (inningsView.js)
  const picked = useRef(false)

  // The club's park: undefined while it loads, null for none.
  useEffect(() => {
    let live = true
    loadPark(bio, asOf).catch(() => null).then((p) => live && setPark(p))
    return () => { live = false }
  }, [bio.team?.id, asOf]) // eslint-disable-line react-hooks/exhaustive-deps

  // The first scope with data: Season, else his career. An error hides the card like no data.
  useEffect(() => {
    let live = true
    ;(async () => {
      const found = {}
      for (const { key } of scopes) {
        found[key] = await loadScope(bio, role, key, season)
        if (found[key]) break
      }
      if (!live) return
      const key = scopes.find((s) => found[s.key])?.key
      if (!key) return onEmpty()
      if (!picked.current) setScope(key)
      setViews((cur) => ({ ...found, ...cur }))
    })().catch(() => live && onEmpty())
    return () => { live = false }
  }, [bio.id, role, season]) // eslint-disable-line react-hooks/exhaustive-deps

  const view = views[scope]
  useEffect(() => {
    const n = view?.rings?.length ?? 0
    onCount(n ? `${n} ${n === 1 ? 'position' : 'positions'}` : undefined)
  }, [view]) // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (key) => {
    picked.current = true
    setScope(key)
    if (key in views) return
    loadScope(bio, role, key, season)
      .catch(() => null)
      .then((v) => setViews((cur) => ({ ...cur, [key]: v })))
  }

  const scopeWord = scopes.find((s) => s.key === scope).label.replace('Season', `${season} season`)
  return (
    <Stack gap="snug">
      {scopes.length > 1 && (
        <Segmented
          label="Scope"
          className="pnext-inn__scope"
          fill
          value={scope}
          onChange={pick}
          options={scopes.map((s) => ({ value: s.key, label: s.label }))}
        />
      )}
      <div className={`pnext-inn__park${park === null ? ' pnext-inn__park--field' : ''}`} style={win ? { aspectRatio: win.aspectRatio } : undefined}>
        {park && <BallparkDiagram layout={park} className="pnext-inn__art" viewBox={win.viewBox} label={`${park.name} field`} />}
        {park === null && <FieldBackdrop className="pnext-inn__art" />}
        {(park === undefined || !(scope in views)) && <Loader size="inline" className="pnext-inn__loading" />}
        {view && park !== undefined && <Marks view={view} role={role} scopeWord={scopeWord} win={win} />}
        {scope in views && !view && <p className="hint pnext-inn__none">No innings logged.</p>}
      </div>
    </Stack>
  )
}
