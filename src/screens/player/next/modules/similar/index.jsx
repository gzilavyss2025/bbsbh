import { useEffect, useState } from 'react'
import { fetchPitchArsenalPool, similarPitchersFor } from '../../../../../api/pitchArsenal.js'
import { fetchSavantPercentiles, similarHittersFor } from '../../../../../api/savantPercentiles.js'
import { getJson } from '../../../../../api/statsapi.js'
import { Headshot } from '../../../../../components/player/Headshot.jsx'
import { PlayerLink } from '../../../../../components/player/PlayerLink.jsx'
import { Button } from '../../../../../components/ui/control/Button.jsx'
import { Segmented } from '../../../../../components/ui/control/Segmented.jsx'
import { Pill } from '../../../../../components/ui/control/Pill.jsx'
import { useAsync } from '../../../../../hooks/useAsync.js'
import { useLinkScope } from '../../../../../lib/nav.js'
import { teamClubNameShort } from '../../../../../lib/teams.js'
import { hitterModel, initials, pitcherModel, poolLevels } from './similarView.js'
import '../../../../../styles/player-next/both/similar.css'

// Similar players (#1926, board SimilarPlayers): "Hits like" for a batter, "Pitches like"
// for a pitcher; a two-way player gets one card per role from the page. Three closest
// neighbours as rows, each opening a dot plot against this player. The ranking, the pools
// and the 50 floor are the live card's (similarHittersFor, similarPitchersFor). Open
// surface (ADR-0034): season aggregates, no seal.
const TITLE = { hitting: 'Hits like', pitching: 'Pitches like' }

// The neighbours' names and clubs: the Statcast file holds percentiles only.
async function loadHitters(id, signal) {
  const data = await fetchSavantPercentiles()
  const similar = similarHittersFor(data, id)
  if (!similar.length) return null
  const ids = similar.map((p) => p.personId).join(',')
  const { people = [] } = await getJson(`/api/v1/people?personIds=${ids}&hydrate=currentTeam`, { signal })
  const byId = new Map(people.map((p) => [String(p.id), p]))
  const rows = similar.flatMap((p) => {
    const x = byId.get(String(p.personId))
    return x?.fullName
      ? [{ personId: p.personId, match: p.match, name: x.fullName, pos: x.primaryPosition?.abbreviation ?? '', teamId: x.currentTeam?.id ?? null }]
      : []
  })
  return rows.length ? hitterModel(data, id, rows) : null
}

// The first pool he is in decides his peers; a pool he is not in says nothing about the next.
async function loadPitchers(id, levels) {
  for (const isMlb of levels) {
    const pool = await fetchPitchArsenalPool(isMlb)
    if (!pool?.pit?.[id]) continue
    const similar = similarPitchersFor(pool, id)
    return similar.length ? pitcherModel(pool, id, similar) : null
  }
  return null
}

export default function SimilarModule({ bio, role, onEmpty, onCount }) {
  const levels = poolLevels(useLinkScope().sportId, Boolean(bio.debut))
  const { data, loading } = useAsync(
    (signal) => (role === 'pitching' ? loadPitchers(bio.id, levels) : loadHitters(bio.id, signal)),
    [bio.id, role, levels.join()],
  )
  const [pick, setPick] = useState(-1)
  // The row to give focus back to when the plot closes: the swap unmounts the focused button.
  const [last, setLast] = useState(-1)
  const [mode, setMode] = useState('usage')
  const n = data?.comps.length ?? 0
  useEffect(() => {
    if (loading) return
    if (n) onCount(`${n} closest`)
    else onEmpty()
  }, [loading, n, onCount, onEmpty])

  // Holds the card's height while it loads, and keeps the slot from reading as empty.
  if (loading) return <div className="simp simp--wait" aria-busy="true" />
  if (!n) return null
  const me = { ini: initials(bio.fullName), name: bio.fullName }
  const comp = data.comps[pick]
  return (
    <div className="simp">
      {comp ? (
        <Focus me={me} comp={comp} mode={mode} setMode={setMode} onBack={() => { setLast(pick); setPick(-1) }} />
      ) : (
        <ul className="simp__rows" aria-label={TITLE[role]}>
          {data.comps.map((c, i) => (
            <li key={c.personId}>
              <button
                type="button"
                className="simp__row"
                autoFocus={i === last}
                onClick={() => setPick(i)}
                aria-label={`${c.name}, ${c.match} percent match. Shows the dot plot against ${me.name}.`}
              >
                <Ident comp={c} />
                <Match value={c.match} />
                <span className="simp__meter" role="img" aria-label={`Match ${c.match} on a 0 to 100 scale`}>
                  <span className="simp__fill" style={{ width: `${c.match}%` }} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Ident({ comp, link = false }) {
  const club = teamClubNameShort(comp.teamId)
  return (
    <>
      <Headshot personId={comp.personId} name={comp.name} teamId={comp.teamId} className="simp__shot" />
      <span className="simp__who">
        <span className="simp__name">
          {link ? <PlayerLink id={comp.personId} name={comp.name}>{comp.name}</PlayerLink> : comp.name}
        </span>
        <span className="simp__meta">
          {comp.pos && <Pill fill="paper">{comp.pos}</Pill>}
          {club && <span>{club}</span>}
        </span>
      </span>
    </>
  )
}

function Match({ value }) {
  return (
    <span className="simp__match">
      <span className="simp__matchval mono">{value}<small>%</small></span>
      <span className="simp__matchunit">match</span>
    </span>
  )
}

// One neighbour against the subject: the pitcher's Usage / Velocity switch, then the dot plot.
function Focus({ me, comp, mode, setMode, onBack }) {
  const { sections } = comp
  const sec = sections.find((s) => s.key === mode) ?? sections[0]
  return (
    <div className="simp__focus">
      <Button size="tap" skin="ghost" onClick={onBack} autoFocus>‹ Back</Button>
      <div className="simp__head">
        <Ident comp={comp} link />
        <Match value={comp.match} />
      </div>
      {sections.length > 1 && (
        <Segmented
          label="What the dots show"
          className="simp__switch"
          fill
          value={sec.key}
          onChange={setMode}
          options={sections.map((s) => ({ value: s.key, label: s.title }))}
        />
      )}
      <div className="simp__box">
        <div className="simp__fhead">
          <span>{sec.rowHead}</span>
          <span>{sec.scaleLab}</span>
          <span className="simp__right">{sec.valHead}</span>
        </div>
        {sec.lines.map((l) => (
          <div className="simp__fl" key={l.metric}>
            <span className="simp__fm">{l.metric}</span>
            <span className="simp__ft" role="img" aria-label={`${me.name} ${l.meText}, ${comp.name} ${l.themText}`}>
              <span className="simp__rail" />
              {sec.ticks.map((t) => <span key={t.text} className="simp__grid" style={{ left: `${t.at}%` }} />)}
              {l.mePos != null && <span className="simp__av simp__av--me" style={{ left: `${l.mePos}%` }}>{me.ini}</span>}
              {l.themPos != null && <span className="simp__av simp__av--them" style={{ left: `${l.themPos}%` }}>{comp.ini}</span>}
            </span>
            <span className="simp__fv mono"><b>{l.meText}</b><span>{l.themText}</span></span>
          </div>
        ))}
        <div className="simp__fax mono">
          {sec.ticks.map((t) => <span key={t.text} style={{ left: `${t.at}%` }}>{t.text}</span>)}
        </div>
      </div>
      <p className="simp__key"><b>{me.ini}</b> = {me.name} · <b>{comp.ini}</b> = {comp.name}</p>
    </div>
  )
}
