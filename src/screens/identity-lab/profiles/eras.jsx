import { useEffect, useState } from 'react'
import SEASON_MARKS from '../../../lib/data/season-marks.json' with { type: 'json' }
import { ALL_MLB_TEAM_IDS, teamFullName } from '../../../lib/teams.js'
import { ClubRail } from '../ClubRail.jsx'
import { EraRow } from '../editors/EraRow.jsx'
import { CrestStrip } from '../workbench/CrestStrip.jsx'

// The Eras dimension (#1591): the marks a club wore in past seasons. Each club
// here is the CURRENT franchise (the Brooklyn Dodgers are under the Dodgers),
// and its eras are listed oldest first. The lab owns the table — it writes
// src/lib/data/season-marks.json and public/logos/historical/ through the dev
// middleware — so a mark you find is added here, not fetched by a script.
//
// An era with no SVG yet is still real: the game screen draws its period
// abbreviation in a serif face, never today's mark (ADR-0078).
const TEAMS = [...ALL_MLB_TEAM_IDS]
  .sort((a, b) => teamFullName(a).localeCompare(teamFullName(b)))
  .map((id) => ({ id, name: teamFullName(id) }))

function ErasBody() {
  const [teamId, setTeamId] = useState(TEAMS[0].id)
  // Bumped after an upload so the browser re-requests a file whose URL did not change.
  const [bust, setBust] = useState(0)
  const index = TEAMS.findIndex((t) => t.id === teamId)
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
      const at = TEAMS.findIndex((t) => t.id === teamId)
      setTeamId(TEAMS[(at + (event.key === 'ArrowRight' ? 1 : -1) + TEAMS.length) % TEAMS.length].id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [teamId])

  const eras = SEASON_MARKS.clubs?.[String(teamId)] ?? []
  const withArt = eras.filter((e) => e.file).length

  return (
    <>
      <ClubRail teams={TEAMS} selectedId={teamId} onSelect={setTeamId} />
      <main className="idlab__eras">
        <CrestStrip team={team} prev={prev} next={next} onStep={setTeamId} />
        <p className="idlab__barslead">
          {eras.length
            ? `Past marks — ${withArt} of ${eras.length} eras have one.`
            : 'Past marks — no past eras yet.'}
        </p>
        <ul className="idlab__eralist">
          {eras.map((era) => (
            <EraRow
              key={`${teamId}-${era.from}-${era.to}-${era.name}-${era.abbr}-${era.source ?? ''}`}
              teamId={teamId}
              era={era}
              bust={bust}
              onArt={() => setBust((n) => n + 1)}
            />
          ))}
          <EraRow key={`${teamId}-new-${eras.length}`} teamId={teamId} era={null} bust={bust} />
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
