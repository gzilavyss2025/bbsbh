// The scorebook's defense diamond, drawn the way the #22 sheet prints it:
// the infield square rotated onto its point, each fielder's surname on a
// writing line at his position with the small position number beneath, and
// the "HOME DEFENSE" / "VISITOR DEFENSE" ring in the middle. Fielders only —
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
// lower edges, catcher under home plate.
const SPOTS = {
  LF: { x: 18, y: 8 },
  CF: { x: 50, y: 2 },
  RF: { x: 82, y: 8 },
  SS: { x: 25, y: 36 },
  '2B': { x: 75, y: 36 },
  '3B': { x: 14, y: 72 },
  '1B': { x: 86, y: 72 },
  C: { x: 50, y: 92 },
}

export function DefenseDiamond({ defense, side /* side OF THE DEFENSE: 'away' | 'home' */ }) {
  const fielders = defense.filter((p) => SPOTS[p.position])
  const dh = defense.find((p) => p.position === 'DH')
  if (fielders.length === 0) return null

  const byPos = {}
  for (const p of fielders) byPos[p.position] = p

  return (
    <div className="defdiamond">
      <div className="defdiamond__field">
        {/* Infield square + center ring, in pencil rule. viewBox matches the
            percent grid so the label spots and the drawing share coordinates. */}
        <svg
          className="defdiamond__lines"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <polygon
            points="50,88 82,60 50,32 18,60"
            fill="none"
            stroke="var(--rule)"
            strokeWidth="0.8"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          <circle
            cx="50"
            cy="60"
            r="13"
            fill="var(--surface-card)"
            stroke="var(--rule)"
            strokeWidth="0.8"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        <span className="defdiamond__ring" aria-hidden="true">
          {side === 'home' ? 'Home' : 'Visitor'}
          <em>defense</em>
        </span>

        {Object.entries(SPOTS).map(([pos, spot]) => (
          <DefenseSpot key={pos} pos={pos} player={byPos[pos]} spot={spot} />
        ))}
      </div>

      {dh && (
        <p className="defdiamond__dh">
          <span className="defdiamond__dhpos">DH</span>
          <span className="defdiamond__dhname">{dh.last.toUpperCase()}</span>
          <span className="defdiamond__dhnote">bats, never fields</span>
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
