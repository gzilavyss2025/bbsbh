import { Loader } from '../ui/Loader.jsx'
import { Button } from '../ui/control/Button.jsx'
import { SectionHead } from '../ui/frame/SectionHead.jsx'
import { Card } from '../ui/frame/Card.jsx'
import { FieldBackdrop } from '../scoring/field/FieldBackdrop.jsx'

// Career/season workload by fielding position, drawn on a small diamond that
// shares the defense alignment's field drawing —
// but here every position is always shown (a scorebook "innings log" rather
// than a live alignment), so the box at each spot carries its own played/
// unplayed styling instead of appearing/disappearing. Purely presentational:
// the caller owns the scope toggle's state and the fielding/pitching data.

const DASH = '—'

// Full position names for assistive technology; visible boxes use abbreviations.
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

// Two-line stat boxes are centered on these anchors, unlike defense surnames.
const SPOTS = {
  LF: { x: 23, y: 24 },
  CF: { x: 50, y: 12 },
  RF: { x: 77, y: 24 },
  SS: { x: 32, y: 45 },
  '2B': { x: 68, y: 45 },
  '3B': { x: 22, y: 65 },
  '1B': { x: 78, y: 65 },
  C: { x: 50, y: 94 },
}

// FieldBackdrop's mound is at (170, 164.23) in its 340 × 255 viewBox.
const MOUND_SPOT = { x: 50, y: 64.4 }

export function PositionInnings({ options, scope, onScope, loading, fielding, pitching }) {
  const activeLabel = options.find((o) => o.key === scope)?.label ?? ''
  const byPos = {}
  for (const p of fielding?.positions ?? []) {
    if (p?.pos) byPos[p.pos] = p
  }
  const mound = byPos.P

  return (
    <section className="posinn">
      <SectionHead look="rule" note={activeLabel}>
        Innings by position
      </SectionHead>

      {options.length > 1 && (
        <div className="posinn__scope" aria-label="Scope">
          {options.map((o) => (
            <Button
              key={o.key}
              size="control"
              pressed={scope === o.key}
              className="posinn__scopebtn"
              onClick={() => onScope(o.key)}
            >
              {o.label}
            </Button>
          ))}
        </div>
      )}

      {loading ? (
        <Loader size="inline" className="posinn__loading" />
      ) : (
        <>
          {fielding && (
            <Card as="div" body="flush" className="posinn__diamond">
              <div
                className="posinn__field"
                aria-label={`Innings by fielding position, ${activeLabel || 'selected scope'}`}
              >
                <FieldBackdrop className="posinn__lines" />

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
            </Card>
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
