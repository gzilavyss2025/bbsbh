import '../../styles/boxscore/pitcher-game-card.css'
import { useRef } from 'react'
import { buildPitcherGameCard } from '../../api/pitcher/gameCard.js'
import { pitchMark } from '../../lib/pitch/pitchTypes.js'
import { PitchMark } from '../../components/playbyplay/pitcherCard/PitchMark.jsx'
import { Stack } from '../../components/ui/layout/Stack.jsx'
import { Cluster } from '../../components/ui/layout/Cluster.jsx'
import { Table } from '../../components/ui/table/Table.jsx'
import { IconButton } from '../../components/ui/control/IconButton.jsx'
import { useDialogFocus } from '../../hooks/dialog/useDialogFocus.js'

// The pitcher game card (#2969, slice 3): one pitcher's night, opened from a
// stat cell of his row in the box score's pitching table. That table renders
// only inside the box score's SealBox reveal function, and this sheet mounts
// only on a tap there, so nothing here exists before the reveal (ADR-0001,
// ADR-0002). buildPitcherGameCard is reveal-only; it runs at mount.
// The plots (slice 4) and the PNG save (slice 5) come later.

const pct = (x) => (x == null ? '—' : `${Math.round(x * 100)}%`)
const mph = (x) => (x == null ? '—' : x.toFixed(1))

export function PitcherGameCardSheet({ feed, pitcher, teamAbbr, onClose }) {
  const closeRef = useRef(null)
  useDialogFocus(closeRef, onClose)
  const card = buildPitcherGameCard(feed, pitcher.id)
  const l = card?.line
  return (
    <div className="scrim pgc-scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <Stack className="sheet pgc" role="dialog" aria-modal="true" aria-label={`Game card, ${pitcher.name}`}>
        <header className="pgc__head">
          <div>
            <h2 className="pgc__name">
              {pitcher.name}
              {pitcher.dec && <span className={`bs__dec bs__dec--${pitcher.dec === 'L' ? 'loss' : 'win'}`}>{pitcher.dec}</span>}
            </h2>
            <p className="t-label pgc__meta">
              {[teamAbbr, pitcher.hand && `${pitcher.hand}HP`].filter(Boolean).join(' · ')}
            </p>
          </div>
          <IconButton ref={closeRef} label="Close" onClick={onClose}>✕</IconButton>
        </header>

        {!card ? (
          <p className="hint">Not posted yet.</p>
        ) : (
          <Stack className="pgc__body">
            <Table frame="bare" density="tight" label="Line" className="pgc__line">
              <thead>
                <tr><th>IP</th><th>H</th><th>R</th><th>ER</th><th>BB</th><th>K</th><th>HR</th><th>P-S</th></tr>
              </thead>
              <tbody>
                <tr><td>{l.ip}</td><td>{l.h}</td><td>{l.r}</td><td>{l.er}</td><td>{l.bb}</td><td>{l.k}</td><td>{l.hr}</td><td>{l.pitches}-{l.strikes}</td></tr>
              </tbody>
            </Table>
            <Cluster as="ul" className="pgc__chips">
              <li><span>SwStr</span> <b>{l.swStr}</b></li>
              <li><span>Barrels</span> <b>{l.barrels}</b></li>
              <li><span>Hard-hit</span> <b>{l.hardHit}</b></li>
            </Cluster>

            {card.mix.length === 0 ? (
              <p className="hint">No pitch tracking for this game.</p>
            ) : (
              <>
                <h3 className="t-label t-label--bold pgc__sub">Pitch mix</h3>
                <Table frame="bare" density="tight" sticky label="Pitch mix" className="pgc__mix">
                  <thead>
                    <tr><th>Pitch</th><th>#</th><th>Use</th><th>vs R</th><th>vs L</th><th>Velo</th><th>Whiff</th></tr>
                  </thead>
                  <tbody>
                    {card.mix.map((m) => (
                      <tr key={m.type}>
                        <td><PitchMark mark={pitchMark(m.type)} size={12} /> {m.name}</td>
                        <td>{m.count}</td><td>{pct(m.usage)}</td><td>{pct(m.usageVsR)}</td><td>{pct(m.usageVsL)}</td><td>{mph(m.velo)}</td><td>{m.whiffs}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>

                <h3 className="t-label t-label--bold pgc__sub">Arsenal</h3>
                <Table frame="bare" density="tight" sticky label="Arsenal" className="pgc__mix">
                  <thead>
                    <tr><th>Pitch</th><th>Zone</th><th>Chase</th><th>SwStr</th></tr>
                  </thead>
                  <tbody>
                    {card.mix.map((m) => (
                      <tr key={m.type}>
                        <td><PitchMark mark={pitchMark(m.type)} size={12} /> {m.name}</td>
                        <td>{pct(m.zonePct)}</td><td>{pct(m.chasePct)}</td><td>{pct(m.swStrPct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </>
            )}
          </Stack>
        )}
      </Stack>
    </div>
  )
}
