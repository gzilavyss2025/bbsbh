import { useEffect, useRef } from 'react'
import { loadUmpire } from '../api/umpires.js'
import { useAsync } from '../hooks/useAsync.js'
import { useNav } from '../lib/nav.js'
import { gamePath, umpirePath } from '../lib/route.js'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const HP_GAMES_LIMIT = 5

function monthDay(iso) {
  const [, m, d] = (iso || '').split('-')
  return m ? `${MONTHS[Number(m) - 1]} ${Number(d)}` : ''
}

const pct1 = (x) => (x == null ? '' : `${(x * 100).toFixed(1)}%`)

// The modal header's rank line: "#7 of 82 · 94.1%", degrading to just the
// percentage when he's below the ranking floor (rank null).
function accuracyRankLabel(rank, accuracy) {
  const p = pct1(accuracy)
  if (!rank) return `${p} plate accuracy`
  return `#${rank.rank} of ${rank.total} · ${p} accuracy`
}

// The 3×3 zone map, shared by the modal and UmpirePage. Any cell where the
// umpire's misses cluster above the league average (over > 0) is OUTLINED in
// the negative-accent ink, heavier the further above average — the rest of the
// grid is just reference lines. Batter-oriented: columns run outside → inside,
// rows high → low. Renders nothing without cells.
const COL_W = 46
const ROW_H = 52
const PAD = 3
const GRID_W = COL_W * 3
const GRID_H = ROW_H * 3
const W = GRID_W + PAD * 2
const H = GRID_H + PAD * 2
// A cell is flagged only once its miss share runs a couple points above the
// league baseline — below that is noise, not a tendency.
const OVER_FLOOR = 0.02
const OVER_FULL = 0.1 // over this much above average, the outline is at full weight

export function UmpireZoneMap({ cells, className = '' }) {
  if (!cells || cells.every((c) => !c.called)) return null
  return (
    <svg
      className={`zonemap ${className}`}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Where this umpire misses more than a typical umpire"
    >
      {cells.map((c, i) => {
        const col = i % 3
        const row = (i - col) / 3
        const x = PAD + col * COL_W
        const y = PAD + row * ROW_H
        const flagged = c.over > OVER_FLOOR
        const weight = flagged ? Math.min(1, (c.over - OVER_FLOOR) / (OVER_FULL - OVER_FLOOR)) : 0
        return (
          <g key={i}>
            {flagged && (
              <rect
                className="zonemap__over"
                x={x + 2.5}
                y={y + 2.5}
                width={COL_W - 5}
                height={ROW_H - 5}
                style={{ strokeWidth: 1.5 + weight * 2.5 }}
              >
                <title>Misses here more than a typical umpire</title>
              </rect>
            )}
          </g>
        )
      })}
      <rect className="zonemap__frame" x={PAD} y={PAD} width={GRID_W} height={GRID_H} />
      <line className="zonemap__grid" x1={PAD + COL_W} y1={PAD} x2={PAD + COL_W} y2={PAD + GRID_H} />
      <line className="zonemap__grid" x1={PAD + COL_W * 2} y1={PAD} x2={PAD + COL_W * 2} y2={PAD + GRID_H} />
      <line className="zonemap__grid" x1={PAD} y1={PAD + ROW_H} x2={PAD + GRID_W} y2={PAD + ROW_H} />
      <line className="zonemap__grid" x1={PAD} y1={PAD + ROW_H * 2} x2={PAD + GRID_W} y2={PAD + ROW_H * 2} />
    </svg>
  )
}

// The detail modal opened from the accuracy rank link (lineup Umpires card).
// Lazy-loads the umpire's whole record — season aggregate, rank, zone cells,
// and game log — and shows the rank, the zone map, and his last five games
// behind the plate, each linking to that game's (sealed) box score. Same dialog
// contract as StrikeZoneModal / BallparkModal: dismiss via backdrop tap, the
// close button, or Escape; focus moves to the close button on open and back to
// the trigger on close. Everything shown is a ball/strike judgment count or a
// date/matchup already public on the umpire page — no score — so it sits
// outside any seal.
export function UmpireAccuracyModal({ id, onClose }) {
  const navigate = useNav()
  const { data } = useAsync(() => loadUmpire(id), [id])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const closeRef = useRef(null)
  useEffect(() => {
    const trigger = document.activeElement
    closeRef.current?.focus()
    return () => {
      if (trigger instanceof HTMLElement) trigger.focus()
    }
  }, [])

  const season = data?.accuracy?.season ?? null
  const hpGames = (data?.games ?? [])
    .filter((g) => g.role === 'HP')
    .map((g) => ({ ...g, row: data.accuracy?.byGamePk?.[g.gamePk] ?? null }))
    .slice(0, HP_GAMES_LIMIT)

  const openGame = (g) => {
    onClose()
    navigate(gamePath(g.date, g.awayAbbr, g.homeAbbr, 'boxscore', g.gameNumber))
  }

  return (
    <div className="scrim scrim--center" onClick={(e) => e.target.classList.contains('scrim') && onClose()}>
      <div
        className="umpmodal"
        role="dialog"
        aria-modal="true"
        aria-label={data?.name ? `Plate accuracy for ${data.name}` : 'Plate accuracy'}
      >
        <div className="umpmodal__head">
          <div className="umpmodal__ttl">
            <span className="umpmodal__eyebrow">Plate accuracy</span>
            <span className="umpmodal__name">{data?.name ?? '…'}</span>
            {season && (
              <span className="umpmodal__rank">{accuracyRankLabel(data.rank, season.accuracy)}</span>
            )}
          </div>
          <button ref={closeRef} className="szmodal__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {data && !season && (
          <p className="umpmodal__hint">No plate-accuracy data on file for this umpire yet.</p>
        )}

        {season && data.zoneCells && (
          <section className="umpmodal__zone">
            <UmpireZoneMap cells={data.zoneCells} />
            <p className="umpmodal__zonecap">
              The red boxes show the parts of the strike zone where he misses the most calls,
              compared to a typical umpire.
            </p>
          </section>
        )}

        {hpGames.length > 0 && (
          <section className="umpmodal__games">
            <h3 className="umpmodal__gtitle">Last {hpGames.length} behind the plate</h3>
            <ul className="umpmodal__glist">
              {hpGames.map((g) => (
                <li key={`${g.gamePk}-${g.gameNumber}`} className="umpmodal__grow">
                  <span className="umpmodal__gdate">{monthDay(g.date)}</span>
                  <button type="button" className="plink umpmodal__gmatch" onClick={() => openGame(g)}>
                    {g.awayAbbr} @ {g.homeAbbr}
                  </button>
                  <span className="umpmodal__gacc">
                    {g.row?.called ? pct1(g.row.correct / g.row.called) : '—'}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {data && (
          <button type="button" className="btn btn--next umpmodal__full" onClick={() => { onClose(); navigate(umpirePath(id)) }}>
            Full umpire page
          </button>
        )}
      </div>
    </div>
  )
}
