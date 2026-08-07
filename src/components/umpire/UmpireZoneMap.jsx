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
