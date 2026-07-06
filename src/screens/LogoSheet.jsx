import { useMemo } from 'react'
import { fetchSchedule } from '../api/mlb.js'
import { useAsync } from '../hooks/useAsync.js'
import { toApiDate, addDays, humanDate } from '../lib/dates.js'
import {
  SEARCHABLE_SPORT_IDS,
  SPORT_LABEL,
  PINNED_TEAM_ID,
} from '../lib/teams.js'
import { TeamLogo } from '../components/TeamLogo.jsx'

// A printable reference sheet of the day's team logos, rendered in grayscale on
// a light "paper" surface — built for tracing / hand-sketching in pencil, not
// for scoring. It carries no scores, so it's spoiler-safe like the rest of the
// app. Pulls every team playing that day across MLB + MiLB and de-dupes them.
export function LogoSheet({ offset, onOffset, onBack }) {
  const dateStr = useMemo(
    () => toApiDate(addDays(new Date(), offset)),
    [offset],
  )

  const slate = useAsync(() => fetchTeamsForDate(dateStr), [dateStr])
  const teams = slate.data ?? []

  return (
    <div className="screen logosheet">
      <header className="topbar logosheet__bar">
        <button className="topbar__back" onClick={onBack}>
          ‹ Games
        </button>
        <h1 className="topbar__title">Logo sheet</h1>
        <button
          className="btn btn--ghost logosheet__print"
          onClick={() => window.print()}
        >
          Print
        </button>
      </header>

      <div className="datenav logosheet__datenav">
        <button onClick={() => onOffset(offset - 1)} aria-label="Previous day">
          ‹
        </button>
        <span className="datenav__label">{humanDate(dateStr)}</span>
        <button onClick={() => onOffset(offset + 1)} aria-label="Next day">
          ›
        </button>
      </div>

      <p className="logosheet__hint">
        Grayscale references for pencil sketching — every club playing today,
        MLB and MiLB. Tap Print for a paper copy.
      </p>

      {slate.loading && <p className="hint">Loading logos…</p>}
      {slate.error && (
        <p className="hint hint--error">
          Couldn’t load teams. Check your connection and try again.
        </p>
      )}
      {!slate.loading && !slate.error && teams.length === 0 && (
        <p className="hint">No games scheduled.</p>
      )}

      <ul className="logogrid">
        {teams.map((t) => (
          <li key={t.id} className="logotile">
            <TeamLogo
              teamId={t.id}
              name={t.name}
              size={96}
              className="logotile__img"
            />
            <span className="logotile__name">{t.name}</span>
            {t.sportLabel && t.sportLabel !== 'MLB' && (
              <span className="logotile__level">{t.sportLabel}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

// Every unique team playing on a date, across MLB + MiLB. Individual level
// queries are allowed to fail (MiLB endpoints are flakier) without sinking the
// sheet.
async function fetchTeamsForDate(dateStr) {
  const results = await Promise.allSettled(
    SEARCHABLE_SPORT_IDS.map((sportId) => fetchSchedule(dateStr, sportId)),
  )
  const games = results.flatMap((r) =>
    r.status === 'fulfilled' ? r.value : [],
  )

  const byId = new Map()
  for (const g of games) {
    for (const side of [g.away, g.home]) {
      if (side?.id && !byId.has(side.id)) {
        byId.set(side.id, { id: side.id, name: side.name, sportId: g.sportId })
      }
    }
  }

  const levelRank = SEARCHABLE_SPORT_IDS.reduce((acc, id, i) => {
    acc[id] = i
    return acc
  }, {})

  return [...byId.values()]
    .map((t) => ({ ...t, sportLabel: SPORT_LABEL[t.sportId] ?? '' }))
    .sort((a, b) => {
      // Pinned club first, then by level (MLB → A), then by name.
      const pa = a.id === PINNED_TEAM_ID ? 0 : 1
      const pb = b.id === PINNED_TEAM_ID ? 0 : 1
      if (pa !== pb) return pa - pb
      const la = levelRank[a.sportId] ?? 99
      const lb = levelRank[b.sportId] ?? 99
      if (la !== lb) return la - lb
      return (a.name ?? '').localeCompare(b.name ?? '')
    })
}
