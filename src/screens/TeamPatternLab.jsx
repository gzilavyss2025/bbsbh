import { useEffect, useId, useState } from 'react'
import { SiteHeader } from '../components/SiteHeader.jsx'
import {
  BAND_COLOR_OVERRIDES,
  LOGO_COLOR_OVERRIDES,
  RecolorFilter,
  chipColorsFor,
} from '../components/WinProbChart.jsx'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { ALL_MLB_TEAM_IDS, teamFullName, teamLogoUrl } from '../lib/teams.js'

// Design harness for reviewing the win-probability chart's tiled band pattern
// (WinProbChart.jsx) for every club at every level — MLB plus all four full-
// season MiLB affiliate tiers (AAA/AA/A+/A; complex/rookie leagues have no
// stable per-club identity to review here, so they're left out). Reached at
// /team-pattern-lab in production, linked from nowhere (unlisted, like
// /team-color-lab — see lib/route.js). No score/reveal content, so no
// spoiler risk in shipping it.
//
// Each team's box is the SAME tile math WinProbChart.jsx uses for one band —
// its own brand color plus a full-opacity tiling of its own logo — just
// stretched to fill the whole card instead of a sliver of a win% area, so a
// reviewer can judge a club's pattern on its own rather than squinting at a
// thin wedge of a real game's chart.
//
// The copy box + per-team feedback field exist so a review pass can happen
// off-screen: read down the grid, type what should change under each team,
// then copy the compiled block at the bottom into a message to Claude.
const LOGO_SIZE = 30
const LOGO_TILE = LOGO_SIZE + 6
const LOGO_INSET = (LOGO_TILE - LOGO_SIZE) / 2
const LOGO_ROTATE = -14
const LOGO_OFFSET_X = 8
const LOGO_OFFSET_Y = 6

const LEAGUE_FILTERS = [
  { key: 'mlb', label: 'MLB', sportId: 1 },
  { key: 'aaa', label: 'Triple-A', sportId: 11 },
  { key: 'aa', label: 'Double-A', sportId: 12 },
  { key: 'aplus', label: 'High-A', sportId: 13 },
  { key: 'a', label: 'Single-A', sportId: 14 },
]

const FEEDBACK_KEY = 'bbsbh:team-pattern-lab:feedback'

function loadFeedback() {
  try {
    return JSON.parse(localStorage.getItem(FEEDBACK_KEY) || '{}')
  } catch {
    return {}
  }
}

export function TeamPatternLab() {
  useDocumentTitle('Team Pattern Lab')
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
    <div className="screen">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">Team Pattern Lab</h1>
      </header>
      <p className="hint">
        An unlisted design harness — not linked anywhere in the app. Each
        club’s win-probability band pattern (color + tiled logo, see{' '}
        <code>src/components/WinProbChart.jsx</code>) at full size, one
        league level at a time. Type feedback under a team, then copy the
        compiled block at the bottom into a message to Claude.
      </p>

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
    </div>
  )
}

function TeamPatternCard({ teamId, name, leagueLabel, note, onNoteChange }) {
  const patternUid = useId()
  const colors = chipColorsFor(teamId)
  const logoOverride = LOGO_COLOR_OVERRIDES[teamId]
  // A 'swap' override points at its own precomputed recolored asset; every
  // other case uses the normal CDN mark, recolored in place via the filter
  // below — same split WinProbChart.jsx makes for the real chart.
  const logo = logoOverride?.mode === 'swap' ? logoOverride.src : teamLogoUrl(teamId)
  const bandColor = BAND_COLOR_OVERRIDES[teamId] ?? colors.primary
  const patternId = `patternlab-${patternUid}`
  const recolorId = `patternlab-recolor-${patternUid}`
  const copyText =
    `Team: ${name} (id ${teamId}, ${leagueLabel})\n` +
    `Where: src/components/WinProbChart.jsx — this club's band pattern ` +
    `(BAND_COLOR_OVERRIDES / LOGO_COLOR_OVERRIDES, keyed by teamId ${teamId})`

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
            width={LOGO_TILE}
            height={LOGO_TILE}
            patternTransform={`rotate(${LOGO_ROTATE}) translate(${LOGO_OFFSET_X} ${LOGO_OFFSET_Y})`}
          >
            <rect
              width={LOGO_TILE}
              height={LOGO_TILE}
              className="winprob__patternbg"
              style={{ '--band-color': bandColor }}
            />
            {logo && (
              <image
                href={logo}
                x={LOGO_INSET}
                y={LOGO_INSET}
                width={LOGO_SIZE}
                height={LOGO_SIZE}
                className="winprob__patternlogo"
                filter={logoOverride && logoOverride.mode !== 'swap' ? `url(#${recolorId})` : undefined}
              />
            )}
          </pattern>
        </defs>
        <rect x={0} y={0} width={200} height={120} style={{ fill: `url(#${patternId})` }} />
      </svg>
      <CopyBox text={copyText} label="Copy team info" />
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

function CopyBox({ text, label }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard permission denied or unavailable — the text is still
      // selectable/readable in the box, so this fails quiet rather than
      // throwing up an error the user can't act on.
    }
  }

  return (
    <div className="patternlab__copybox">
      <pre className="patternlab__copytext">{text}</pre>
      <button type="button" className="patternlab__copybtn" onClick={copy} aria-label={label}>
        {copied ? 'Copied!' : '⧉ Copy'}
      </button>
    </div>
  )
}
