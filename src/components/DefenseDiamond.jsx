// The scorebook's defense diamond, drawn the way the #22 sheet prints it:
// the infield square rotated onto its point, each fielder's surname on a
// writing line at his position with the small position number beneath, and
// a small pencil ring for the pitcher's mound at its center. Fielders only —
// the pitcher has his own table and the DH bats but never takes the field,
// so he rides a small line under the diamond instead.
//
// Spoiler-free: this is the same lineup data as the batting order, just
// arranged spatially.

// Scorer's position numbers, the same digits penciled under each name.
const POSITION_NUMBER = {
  C: 2, '1B': 3, '2B': 4, '3B': 5, SS: 6, LF: 7, CF: 8, RF: 9,
}

// Where each label sits, in percent of the diamond box. Mirrors the sheet:
// outfield arc up top, middle infield off the upper edges, corners off the
// lower edges, catcher over home plate. Catcher rides high enough that its
// position number stays clear of the DH line below the field — the surname
// overlapping the diamond graphic is fine.
const SPOTS = {
  LF: { x: 17, y: 10 },
  CF: { x: 50, y: 3 },
  RF: { x: 83, y: 10 },
  SS: { x: 29, y: 33 },
  '2B': { x: 71, y: 33 },
  '3B': { x: 13, y: 57 },
  '1B': { x: 87, y: 57 },
  C: { x: 50, y: 79 },
}

export function DefenseDiamond({ defense }) {
  const fielders = defense.filter((p) => SPOTS[p.position])
  const dh = defense.find((p) => p.position === 'DH')
  if (fielders.length === 0) return null

  const byPos = {}
  for (const p of fielders) byPos[p.position] = p

  return (
    <div className="defdiamond">
      <div className="defdiamond__field">
        {/* Infield square + a small mound ring, in pencil rule. The box is 4:3,
            and the SVG stretches to fill it, so viewBox y-units compress to 75%
            of x — the polygon is drawn taller than wide (and the mound ring is
            an ellipse) so both READ as a true square-on-point diamond and a
            round mound, like a real infield. */}
        <svg
          className="defdiamond__lines"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <polygon
            points="50,89 76,54 50,19 24,54"
            fill="none"
            stroke="var(--rule)"
            strokeWidth="0.8"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          <ellipse
            cx="50"
            cy="54"
            rx="3.4"
            ry="4.5"
            fill="none"
            stroke="var(--rule)"
            strokeWidth="0.8"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {Object.entries(SPOTS).map(([pos, spot]) => (
          <DefenseSpot key={pos} pos={pos} player={byPos[pos]} spot={spot} />
        ))}
      </div>

      {dh && (
        <p className="defdiamond__dh">
          <span className="defdiamond__dhpos">DH</span>
          <span className="defdiamond__dhname">{dh.last.toUpperCase()}</span>
        </p>
      )}
    </div>
  )
}

// One fielder: surname on its writing line, position number penciled below.
// An unposted spot keeps its line + number so the sheet's shape never changes.
function DefenseSpot({ pos, player, spot }) {
  return (
    <span
      className="defdiamond__spot"
      style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
    >
      <span className={`defdiamond__name ${player ? '' : 'defdiamond__name--tbd'}`}>
        {player ? player.last.toUpperCase() : '—'}
      </span>
      <span className="defdiamond__num" aria-label={pos}>
        {POSITION_NUMBER[pos]}
      </span>
    </span>
  )
}
