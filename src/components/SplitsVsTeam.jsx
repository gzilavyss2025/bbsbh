import { useEffect, useRef, useState } from 'react'
import { TeamLogo } from './TeamLogo.jsx'

// SPLITS VS TEAM — a player's career line against a chosen opponent, with a
// finger-scrollable strip of every MLB club's logo to pick a different one
// (the selected club in full color, the rest dulled). Pre-selected to the
// player's next scheduled opponent (see api/vsTeamSplits.js). Data is the static
// nightly file, so this is a pure presentational component.
//
// Spoiler-safe: the career totals are open, spoiler-free figures (like the
// "Season splits" card on the same page). The one score-revealing bit is the
// last-game line — a specific past game's result — so it's hidden whenever the
// page is scoped to a game (`asOf` set) and that meeting is ON OR AFTER the day
// being scored, exactly the cutoff the game log uses.

// A career stat cell: label + value, mono like the player page's tiles.
function Cell({ k, v }) {
  return (
    <div className="stat">
      <div className="stat__v">{v}</div>
      <div className="stat__k">{k}</div>
    </div>
  )
}

// "7/5" for the current season, "7/5/24" for an earlier one — so a stale meeting
// reads as old at a glance without cluttering the common in-season case.
function gameDate(iso, season) {
  const [y, m, d] = (iso || '').split('-')
  if (!y) return ''
  const md = `${Number(m)}/${Number(d)}`
  return Number(y) === season ? md : `${md}/${y.slice(2)}`
}

export function SplitsVsTeam({ vsTeam, season, asOf }) {
  const { teams, byOpp, preselectId } = vsTeam
  const [selId, setSelId] = useState(preselectId)

  // Keep the selected club centered in the strip. Clubs are alphabetical, so the
  // pre-selected opponent often starts scrolled off-screen — center it (and each
  // new pick) horizontally WITHOUT a vertical page jump, so the user always sees
  // which logo is lit. Scroll the strip's own scrollLeft rather than
  // scrollIntoView (which would also scroll the page).
  const stripRef = useRef(null)
  const activeRef = useRef(null)
  useEffect(() => {
    const strip = stripRef.current
    const btn = activeRef.current
    if (!strip || !btn) return
    strip.scrollTo({
      left: btn.offsetLeft - strip.clientWidth / 2 + btn.clientWidth / 2,
      behavior: 'smooth',
    })
  }, [selId])

  const sel = teams.find((t) => t.id === selId) ?? null
  const row = sel ? byOpp[String(sel.id)] : null
  const car = row?.car ?? null
  const isPitcher = vsTeam.group === 'pitching'

  // Last-game line, gated: only when there's no game cutoff, or the meeting is
  // strictly before the day being scored (spoiler defense — see header).
  const last = row?.last && (!asOf || row.last.date < asOf) ? row.last : null

  const cells = car
    ? isPitcher
      ? [['G', car.g], ['IP', car.ip], ['ERA', car.era], ['K', car.k], ['BB', car.bb]]
      : [['G', car.g], ['AB', car.ab], ['AVG', car.avg], ['HR', car.hr], ['RBI', car.rbi], ['OPS', car.ops]]
    : null

  return (
    <section className="vsteam">
      <h3 className="section__title">
        <span>Splits vs team</span>
        {sel && <em>career{sel.abbr ? ` vs ${sel.abbr}` : ''}</em>}
      </h3>

      <div className="vsteam__strip" role="tablist" aria-label="Opponent" ref={stripRef}>
        {teams.map((t) => {
          const active = t.id === selId
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              title={t.name}
              ref={active ? activeRef : null}
              className={`vsteam__team${active ? ' is-active' : ''}${t.has ? '' : ' is-empty'}`}
              onClick={() => setSelId(t.id)}
            >
              <TeamLogo teamId={t.id} name={t.name} size={36} />
            </button>
          )
        })}
      </div>

      {cells ? (
        <div
          className="player__statgrid vsteam__grid"
          style={{ gridTemplateColumns: `repeat(${cells.length}, 1fr)` }}
        >
          {cells.map(([k, v]) => (
            <Cell key={k} k={k} v={v} />
          ))}
        </div>
      ) : (
        <p className="hint vsteam__none">
          No career meetings{sel ? ` vs the ${sel.name}` : ''}.
        </p>
      )}

      {last && (
        <p className="vsteam__last">
          <span className="vsteam__last-meta">
            {gameDate(last.date, season)} {last.home ? 'vs' : '@'}{last.opp}
          </span>
          <span className="vsteam__last-sep">|</span>
          <span className="vsteam__last-line">{last.line}</span>
        </p>
      )}
    </section>
  )
}
