/* eslint-disable react-refresh/only-export-components -- a profile module's
   public surface is its descriptor object, not the components inside it; the
   components are local by design. Fast Refresh falls back to a full reload for
   this dev-only lab, which is a fine trade for keeping each dimension's data,
   copy text, and tiles in one readable file. */
import { useEffect, useId, useState } from 'react'
import { CopyBox } from '../../../components/CopyBox.jsx'
import { RecolorFilter } from '../../../components/WinProbChart.jsx'
import { BAND_COLOR_OVERRIDES, chipColorsFor } from '../../../lib/wpaBandColors.js'
import { ALL_MLB_TEAM_IDS, teamFullName } from '../../../lib/teams.js'
import { wpaLogoFor, wpaTilePlacements } from '../../../lib/wpaLogo.js'

// The WPA-pattern dimension: every club's win-probability band pattern (color +
// tiled logo, see components/WinProbChart.jsx) at full size, one league level at
// a time — MLB plus all four full-season MiLB tiers.
//
// Each card is the SAME tile math the real chart uses for one band — its own
// brand color plus a full-opacity tiling of its own logo — just stretched to
// fill the card instead of a sliver of a win% area, so a club's pattern can be
// judged on its own rather than squinting at a thin wedge of a real game's
// chart. Deliberately bigger than the real chart's own tile
// (WPA_LOGO_DEFAULTS.size): this grid is a magnified review surface, and the
// colour dimensions' per-treatment WPA box is the true-size one. The tile math
// itself is the shared wpaTilePlacements (row shift included, though it's off by
// default), so a club's pattern reads here the way it reads in a real chart.
//
// The copy box + per-team feedback field exist so a review pass can happen
// off-screen: read down the grid, type what should change under each team, then
// copy the compiled block at the bottom into a message to Claude.
const LOGO_SIZE = 30
const LOGO_PADDING = 6
const LOGO_ROTATE = -14
const LOGO_OFFSET_X = 8
const LOGO_OFFSET_Y = 6
const TILE = wpaTilePlacements({ size: LOGO_SIZE, paddingX: LOGO_PADDING, paddingY: LOGO_PADDING })

const LEAGUE_FILTERS = [
  { key: 'mlb', label: 'MLB', sportId: 1 },
  { key: 'aaa', label: 'Triple-A', sportId: 11 },
  { key: 'aa', label: 'Double-A', sportId: 12 },
  { key: 'aplus', label: 'High-A', sportId: 13 },
  { key: 'a', label: 'Single-A', sportId: 14 },
]

const FEEDBACK_KEY = 'bbsbh:identity-lab:pattern:feedback'

function loadFeedback() {
  try {
    return JSON.parse(localStorage.getItem(FEEDBACK_KEY) || '{}')
  } catch {
    return {}
  }
}

function PatternLabBody() {
  const [leagueKey, setLeagueKey] = useState('mlb')
  const [milbTeams, setMilbTeams] = useState(null) // sportId -> [{ id, name }]
  const [feedback, setFeedback] = useState(loadFeedback)

  useEffect(() => {
    let cancelled = false
    fetch('/data/affiliates.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        const bySport = { 11: [], 12: [], 13: [], 14: [] }
        for (const affiliates of Object.values(data.byOrgId)) {
          for (const a of affiliates) {
            if (bySport[a.sportId]) bySport[a.sportId].push({ id: a.id, name: a.name })
          }
        }
        setMilbTeams(bySport)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify(feedback))
  }, [feedback])

  const league = LEAGUE_FILTERS.find((l) => l.key === leagueKey)
  const teams =
    league.key === 'mlb'
      ? ALL_MLB_TEAM_IDS.map((id) => ({ id, name: teamFullName(id) }))
      : (milbTeams?.[league.sportId] ?? [])
  const sorted = [...teams].sort((a, b) => a.name.localeCompare(b.name))

  const setNote = (teamId, text) => setFeedback((was) => ({ ...was, [teamId]: text }))

  const compiled = sorted
    .map((t) => ({ t, note: (feedback[t.id] || '').trim() }))
    .filter(({ note }) => note)
    .map(({ t, note }) => `${t.name} (id ${t.id}, ${league.label}):\n${note}`)
    .join('\n\n')

  return (
    <>
      <div className="patternlab__filters" role="group" aria-label="Filter by league">
        {LEAGUE_FILTERS.map((l) => (
          <button
            key={l.key}
            type="button"
            className={`patternlab__filterbtn${l.key === leagueKey ? ' is-active' : ''}`}
            onClick={() => setLeagueKey(l.key)}
          >
            {l.label}
          </button>
        ))}
      </div>

      {league.key !== 'mlb' && milbTeams === null && <p className="hint">Loading affiliate list…</p>}

      <div className="patternlab__grid">
        {sorted.map((t) => (
          <TeamPatternCard
            key={t.id}
            teamId={t.id}
            name={t.name}
            leagueLabel={league.label}
            note={feedback[t.id] || ''}
            onNoteChange={(text) => setNote(t.id, text)}
          />
        ))}
      </div>

      <section className="patternlab__compiled">
        <h2 className="patternlab__compiledtitle">Compiled feedback</h2>
        {compiled ? (
          <CopyBox text={compiled} label="Copy all feedback" />
        ) : (
          <p className="hint">Nothing typed yet — notes you add above will collect here.</p>
        )}
      </section>
    </>
  )
}

function TeamPatternCard({ teamId, name, leagueLabel, note, onNoteChange }) {
  const patternUid = useId()
  const colors = chipColorsFor(teamId)
  // This dimension reviews the club's Main pattern only, resolved through the
  // same wpaLogoFor the real chart uses — a 'swap' override points at its own
  // precomputed recolored asset, every other case uses the normal CDN mark
  // recolored in place via the filter below.
  const { src: logo, recolor: logoOverride } = wpaLogoFor(teamId, 'main')
  const bandColor = BAND_COLOR_OVERRIDES[teamId] ?? colors.primary
  const patternId = `patternlab-${patternUid}`
  const recolorId = `patternlab-recolor-${patternUid}`
  const copyText =
    `Team: ${name} (id ${teamId}, ${leagueLabel})\n` +
    `Where: src/lib/data/wpa-tuning.json — ${teamId}.bandColor (this club's Main band fill) / ` +
    `src/lib/wpaLogo.js — LOGO_COLOR_OVERRIDES[${teamId}] (whether its mark may be recolored)`

  return (
    <div className="patternlab__card">
      <h3 className="patternlab__teamname">{name}</h3>
      <svg className="patternlab__svg" viewBox="0 0 200 120" role="img" aria-label={`${name} band pattern`}>
        <defs>
          <RecolorFilter id={recolorId} override={logoOverride} />
          <pattern
            id={patternId}
            patternUnits="userSpaceOnUse"
            x={0}
            y={0}
            width={TILE.tileW}
            height={TILE.tileH}
            patternTransform={`rotate(${LOGO_ROTATE}) translate(${LOGO_OFFSET_X} ${LOGO_OFFSET_Y})`}
            style={{ overflow: 'visible' }}
          >
            <rect
              width={TILE.tileW}
              height={TILE.tileH}
              className="winprob__patternbg"
              style={{ '--band-color': bandColor }}
            />
            {logo &&
              TILE.images.map((img, i) => (
                <image
                  key={i}
                  href={logo}
                  x={img.x}
                  y={img.y}
                  width={LOGO_SIZE}
                  height={LOGO_SIZE}
                  className="winprob__patternlogo"
                  filter={logoOverride && logoOverride.mode !== 'swap' ? `url(#${recolorId})` : undefined}
                />
              ))}
          </pattern>
        </defs>
        <rect x={0} y={0} width={200} height={120} style={{ fill: `url(#${patternId})` }} />
      </svg>
      <CopyBox text={copyText} label={`Copy ${name} pattern info`} />
      <label className="patternlab__notelabel" htmlFor={`note-${teamId}`}>
        What should change about this team’s pattern?
      </label>
      <textarea
        id={`note-${teamId}`}
        className="patternlab__notefield"
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
        rows={3}
      />
    </div>
  )
}

export const patternProfile = {
  key: 'pattern',
  label: 'WPA patterns',
  // A catalog with its own level filters and no club to select — no rail, no
  // dugout, so the page reserves room for neither.
  chrome: 'plain',
  title: 'Team Identity Lab — WPA patterns',
  hint: (
    <>
      An unlisted, dev-only design harness — not linked anywhere in the app. Each
      club’s win-probability band pattern (color + tiled logo, see{' '}
      <code>src/components/WinProbChart.jsx</code>) at full size, one league
      level at a time. Type feedback under a team, then copy the compiled block
      at the bottom into a message to Claude.
    </>
  ),
  Body: PatternLabBody,
}
