import { Loader } from './Loader.jsx'

// Career/season workload by fielding position, drawn on a small diamond that
// echoes DefenseDiamond's SPOTS layout (see components/DefenseDiamond.jsx) —
// but here every position is always shown (a scorebook "innings log" rather
// than a live alignment), so the box at each spot carries its own played/
// unplayed styling instead of appearing/disappearing. Purely presentational:
// the caller owns the scope toggle's state and the fielding/pitching data.

const DASH = '—'

// Scorer's position numbers double as the accessible position name — the
// visible box just shows the two/three-letter abbreviation.
const POSITION_NAME = {
  C: 'Catcher',
  '1B': 'First base',
  '2B': 'Second base',
  '3B': 'Third base',
  SS: 'Shortstop',
  LF: 'Left field',
  CF: 'Center field',
  RF: 'Right field',
  P: 'Pitcher',
}

// Same percent layout as DefenseDiamond.SPOTS — duplicated locally so this
// file stays self-contained (see file header).
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

// The mound sits at the diamond's true center — same point as the pencil-ring
// ellipse drawn into the field lines below.
const MOUND_SPOT = { x: 50, y: 54 }

export function PositionInnings({ options, scope, onScope, loading, fielding, pitching }) {
  const activeLabel = options.find((o) => o.key === scope)?.label ?? ''
  const byPos = {}
  for (const p of fielding?.positions ?? []) {
    if (p?.pos) byPos[p.pos] = p
  }
  const mound = byPos.P

  return (
    <section className="posinn">
      <h3 className="section__title">
        <span>Innings by position</span>
        {activeLabel && <em>{activeLabel}</em>}
      </h3>

      {options.length > 1 && (
        <div className="posinn__scope" aria-label="Scope">
          {options.map((o) => (
            <button
              key={o.key}
              type="button"
              aria-pressed={scope === o.key}
              className={`posinn__scopebtn ${scope === o.key ? 'is-active' : ''}`}
              onClick={() => onScope(o.key)}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <Loader size="inline" className="posinn__loading" />
      ) : (
        <>
          {fielding && (
            <div className="posinn__diamond">
              <div
                className="posinn__field"
                aria-label={`Innings by fielding position, ${activeLabel || 'selected scope'}`}
              >
                {/* Pencil-rule infield square + mound ring, same drawing as
                    DefenseDiamond (kept local so this file has no import). */}
                <svg
                  className="posinn__lines"
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
                  <PositionSpot key={pos} pos={pos} spot={spot} entry={byPos[pos]} />
                ))}

                {mound && <PositionSpot pos="P" spot={MOUND_SPOT} entry={mound} mound />}
              </div>

              {fielding.dh && (
                <p className="posinn__dh">
                  <span className="posinn__dhpos">DH</span>
                  <span className="posinn__dhvalue">{fielding.dh.games} G</span>
                </p>
              )}
            </div>
          )}

          {pitching && (
            <div className="posinn__pitchgrid">
              <PitchBox label="Starter" ip={pitching.starter} />
              <PitchBox label="Reliever" ip={pitching.reliever} />
            </div>
          )}
        </>
      )}
    </section>
  )
}

function PositionSpot({ pos, spot, entry, mound = false }) {
  const played = entry?.played ?? false
  const innings = entry?.innings ?? DASH
  const label = `${POSITION_NAME[pos] ?? pos}: ${innings === DASH ? 'no innings logged' : `${innings} innings`}`

  return (
    <span
      className={`posinn__spot ${mound ? 'posinn__spot--mound' : ''}`}
      style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
    >
      <span
        className={`posinn__box ${played ? 'posinn__box--played' : 'posinn__box--empty'}`}
        aria-label={label}
      >
        <span className="posinn__pos">{pos}</span>
        <span className="posinn__innings">{innings}</span>
      </span>
    </span>
  )
}

function PitchBox({ label, ip }) {
  return (
    <div className="stat posinn__pitchbox">
      <div className="stat__v">
        {ip} <em className="stat__unit">IP</em>
      </div>
      <div className="stat__k">{label}</div>
    </div>
  )
}
