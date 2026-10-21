import { useEffect, useMemo, useState } from 'react'
import SEASON_MARKS from '../../../lib/data/season-marks.json' with { type: 'json' }
import { ALL_MLB_TEAM_IDS, teamFullName } from '../../../lib/teams.js'
import { ClubRail } from '../ClubRail.jsx'
import { Button } from '../../../components/ui/control/Button.jsx'
import { Segmented } from '../../../components/ui/control/Segmented.jsx'
import { fetchMilbHistory } from '../../../api/milbHistory.js'
import { MILB_COLOR_LAB_LEVELS } from '../../../lib/milbColors.js'
import { EraRow } from '../editors/EraRow.jsx'
import { useAffiliates } from './milb.jsx'
import { CrestStrip } from '../workbench/CrestStrip.jsx'

// The Eras dimension (#1591): the marks a club wore in past seasons. Each club
// here is the CURRENT franchise (the Brooklyn Dodgers are under the Dodgers),
// and its eras are listed oldest first. The lab owns the table — it writes
// src/lib/data/season-marks.json and public/logos/historical/ through the dev
// middleware — so a mark you find is added here, not fetched by a script.
//
// An era with no SVG yet is still real: the game screen draws its period
// abbreviation in a serif face, never today's mark (ADR-0078).
//
// MiLB clubs rename and move far more often than MLB ones (the Gwinnett Braves
// became the Stripers in 2018 under one statsapi id), so each full-season level
// is a rail of its own, listed from the same affiliates.json the other MiLB tabs
// read. An era hangs off the club's CURRENT id, same as MLB.
const MLB_TEAMS = [...ALL_MLB_TEAM_IDS]
  .sort((a, b) => teamFullName(a).localeCompare(teamFullName(b)))
  .map((id) => ({ id, name: teamFullName(id) }))

const LEVELS = [
  { value: 'mlb', label: 'MLB' },
  ...MILB_COLOR_LAB_LEVELS.map((l) => ({ value: String(l.sportId), label: l.label })),
  { value: 'former', label: 'Former' },
]

const lastEraName = (id) => SEASON_MARKS.clubs?.[String(id)]?.at(-1)?.name ?? null

// The clubs the level rails cannot list, because affiliates.json holds only
// today's clubs: a club that has since folded (Clinton, Bakersfield) or whose
// id never reached the file. Listed from milb-history.json's inactive clubs,
// every club that already has an era, and any id typed into the add box. An
// id with no name on file reads "Club {id}" until its first era names it.
function useFormerClubs(addedIds) {
  const [base, setBase] = useState(null)
  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch('/data/affiliates.json').then((res) => (res.ok ? res.json() : null)).catch(() => null),
      fetchMilbHistory(),
    ]).then(([aff, hist]) => {
      if (cancelled) return
      const active = new Set(Object.values(aff?.byOrgId ?? {}).flat().map((a) => a.id))
      const names = new Map()
      for (const [id, club] of Object.entries(hist.clubs ?? {})) {
        if (club.active === false) names.set(Number(id), club.currentName)
      }
      setBase({ active, names })
    })
    return () => {
      cancelled = true
    }
  }, [])
  return useMemo(() => {
    if (!base) return null
    const mlb = new Set(ALL_MLB_TEAM_IDS)
    const ids = new Set([...base.names.keys(), ...addedIds])
    for (const key of Object.keys(SEASON_MARKS.clubs ?? {})) {
      const id = Number(key)
      if (!mlb.has(id) && !base.active.has(id)) ids.add(id)
    }
    return [...ids]
      .map((id) => ({ id, name: base.names.get(id) ?? lastEraName(id) ?? `Club ${id}` }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [base, addedIds])
}

// A club that is in no list yet: type its id (candidates.md names each one).
function AddClub({ onAdd }) {
  const [text, setText] = useState('')
  const id = Number(text)
  return (
    <form
      className="idlab__addclub"
      onSubmit={(event) => {
        event.preventDefault()
        if (!Number.isInteger(id) || id <= 0) return
        onAdd(id)
        setText('')
      }}
    >
      <input
        className="idlab__recolorname"
        type="number"
        inputMode="numeric"
        aria-label="Club id"
        placeholder="Club id"
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <Button size="control" type="submit">Add club</Button>
    </form>
  )
}

function ErasBody() {
  const [level, setLevel] = useState('mlb')
  const [added, setAdded] = useState(() => new Set())
  const levelId = /^\d+$/.test(level) ? Number(level) : null
  const affiliates = useAffiliates(levelId)
  const former = useFormerClubs(added)
  const TEAMS = useMemo(
    () => (level === 'mlb' ? MLB_TEAMS : level === 'former' ? former ?? [] : affiliates ?? []),
    [level, former, affiliates],
  )
  const [teamId, setTeamId] = useState(MLB_TEAMS[0].id)
  // Bumped after an upload so the browser re-requests a file whose URL did not change.
  const [bust, setBust] = useState(0)
  // The club on the bench, or the level's first until one is picked (a level
  // switch leaves the old id pointing at a club this rail does not list).
  const index = Math.max(0, TEAMS.findIndex((t) => t.id === teamId))
  const team = TEAMS[index]
  const prev = TEAMS[(index - 1 + TEAMS.length) % TEAMS.length]
  const next = TEAMS[(index + 1) % TEAMS.length]

  // Arrow keys step clubs, as on the colour dimensions, but not where a
  // left/right arrow already moves a caret.
  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (!TEAMS.length) return
      const at = Math.max(0, TEAMS.findIndex((t) => t.id === teamId))
      setTeamId(TEAMS[(at + (event.key === 'ArrowRight' ? 1 : -1) + TEAMS.length) % TEAMS.length].id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [teamId, TEAMS])

  const addClub = (id) => {
    setAdded((prev) => new Set(prev).add(id))
    setTeamId(id)
  }
  const levelPicker = (
    <>
      <Segmented label="Level" value={level} onChange={(v) => { setLevel(v); setTeamId(null) }} options={LEVELS} />
      {level === 'former' && <AddClub onAdd={addClub} />}
    </>
  )
  if (!team) {
    return (
      <main className="idlab__eras">
        {levelPicker}
        <p className="idlab__barslead">Loading clubs…</p>
      </main>
    )
  }

  const eras = SEASON_MARKS.clubs?.[String(team.id)] ?? []
  const withArt = eras.filter((e) => e.file || e.like).length

  return (
    <>
      <ClubRail teams={TEAMS} selectedId={team.id} onSelect={setTeamId} />
      <main className="idlab__eras">
        {levelPicker}
        <CrestStrip team={team} prev={prev} next={next} onStep={setTeamId} />
        <p className="idlab__barslead">
          {eras.length
            ? `Past marks — ${withArt} of ${eras.length} eras have one.`
            : 'Past marks — no past eras yet.'}
        </p>
        <ul className="idlab__eralist">
          {eras.map((era) => (
            <EraRow
              key={`${team.id}-${era.from}-${era.to}-${era.name}-${era.abbr}-${era.source ?? ''}`}
              teamId={team.id}
              era={era}
              bust={bust}
              onArt={() => setBust((n) => n + 1)}
            />
          ))}
          <EraRow key={`${team.id}-new-${eras.length}`} teamId={team.id} era={null} bust={bust} />
        </ul>
      </main>
    </>
  )
}

export const erasProfile = {
  key: 'eras',
  label: 'Eras',
  title: 'Team Identity Lab — Eras',
  chrome: 'jump',
  hint:
    'Past marks for each club, filed under the club’s current franchise. Add an era with its years, name and ' +
    'period abbreviation, then drop in an SVG. An era with no SVG shows its abbreviation in a serif face. ' +
    'Saves write season-marks.json and public/logos/historical/ straight to disk (npm run dev only).',
  Body: ErasBody,
}
