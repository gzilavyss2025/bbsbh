import { useEffect, useMemo, useState } from 'react'
import '../../../../../styles/player-next/pitcher/command.css'
import { fetchCommandFor, fetchCommandLeague } from '../../../../../api/commandMap.js'
import { Button } from '../../../../../components/ui/control/Button.jsx'
import { StatTile } from '../../../../../components/ui/frame/StatTile.jsx'
import { useAsync } from '../../../../../hooks/useAsync.js'
import { CommandMapSvg, Mark } from './CommandMapSvg.jsx'
import { HEART, commandModView } from './commandModView.js'

// Command (#2014, pitcher only): where his pitches crossed, on the 5×5 command grid, by batter hand
// and pitch type, with four rates counted off the same grid. Open surface (ADR-0034). The shard is a
// season total and cannot be cut to a date, so a dated page (?d=) reads it whole, as the live tab does.
export default function CommandModule({ bio, season, onEmpty, onCount }) {
  const { data, loading, error } = useAsync(
    () => Promise.all([fetchCommandFor(bio.id, { seasonYear: season, strict: true }), fetchCommandLeague({ seasonYear: season, strict: true }).catch(() => null)]),
    [bio.id, season],
  )
  // The picks belong to one pitcher and season: another opens on the default view, where the league line shows.
  const at = `${bio.id}:${season}`
  const [picked, setPicked] = useState({ at })
  const { stand = null, code = null, cell = HEART } = picked.at === at ? picked : {}
  const pick = (p) => setPicked({ at, stand, code, cell, ...p })
  const view = useMemo(() => (data ? commandModView(data[0], { stand, code, cell, league: data[1] }) : null), [data, stand, code, cell])
  const empty = (!loading && !view) || !!error
  const total = view?.total
  useEffect(() => {
    if (empty) onEmpty()
    else onCount(total ? `${total.toLocaleString('en-US')} pitches` : undefined)
  }, [empty, total, onEmpty, onCount])
  if (loading) return <div className="command command--loading" aria-busy="true" />
  if (empty) return null

  return (
    <div className="command">
      <div className="command__side">
        <div className="command__group">
          <p className="command__lab">Batter hand</p>
          <div className="command__hands" role="group" aria-label="Batter hand">
            {view.hands.map((h) => (
              <Button key={h.label} size="control" className="command__hand" pressed={view.stand === h.stand} disabled={!h.n} onClick={() => pick({ stand: h.stand })}>
                <span>{h.label}</span>
                <span className="command__n">{h.n.toLocaleString('en-US')}</span>
              </Button>
            ))}
          </div>
        </div>
        <div className="command__group">
          <p className="command__lab">Pitch type</p>
          <div className="command__chips" role="group" aria-label="Pitch type">
            {view.chips.map((c) => (
              <Button
                key={c.code ?? 'ALL'}
                size="control"
                className={`command__chip${c.code ? '' : ' command__chip--all'}${c.thin ? ' command__chip--thin' : ''}`}
                pressed={view.code === c.code}
                aria-label={`${c.name}, ${c.n.toLocaleString('en-US')} pitches${c.thin ? ', too few to map' : ''}`}
                onClick={() => pick({ code: c.code })}
              >
                <span className="command__code">
                  {c.code && (
                    <svg width="14" height="14" viewBox="-7 -7 14 14" aria-hidden="true">
                      <Mark code={c.code} r={4.6} />
                    </svg>
                  )}
                  {c.code ?? 'ALL'}
                </span>
                <span className="command__n">{c.n.toLocaleString('en-US')}</span>
              </Button>
            ))}
          </div>
        </div>
        <div className="command__group">
          <p className="command__lab command__lab--soft">{view.label}</p>
          <div className="command__tiles">
            {view.tiles.map((t) => (
              <StatTile
                key={t.key}
                label={t.label}
                value={t.value}
                caption={t.caption}
                tone={t.lead ? 'ink' : 'plain'}
                className={`command__tile${view.thin ? ' command__tile--thin' : ''}`}
              />
            ))}
          </div>
          <p className="command__note">{view.note}</p>
        </div>
      </div>
      <div className="command__panel">
        <p className="command__head">
          <span>Where it crossed</span>
          <span className="command__sub">Camera view, behind him</span>
        </p>
        {view.thin ? (
          <p className="command__thin">{view.thin}</p>
        ) : (
          <>
            <CommandMapSvg view={view} cell={cell} onCell={(i) => pick({ cell: i })} />
            <div className="command__readout" aria-live="polite">
              <p className="command__where">{view.readout.where}</p>
              <p className="command__facts">
                {view.readout.facts.map((f) => (
                  <span key={f}>{f}</span>
                ))}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
