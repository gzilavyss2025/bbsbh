import { useEffect, useMemo, useState } from 'react'
import '../../../../../styles/player-next/pitcher/target.css'
import { fetchGloveTargetFor } from '../../../../../api/gloveTarget.js'
import { fetchTargetCommand, targetCommandFor, targetCommandRows } from '../../../../../api/targetCommand.js'
import { useAsync } from '../../../../../hooks/useAsync.js'
import { MarkPath, MissCloud } from './MissCloud.jsx'
import { cloudFor, targetView } from './targetView.js'

// The ledger needs the rank file; the cloud only adds to it, so a failed glove read leaves the ledger alone.
// Each file holds one season: another season's page gets null from both readers.
async function load(id, season) {
  const data = await fetchTargetCommand()
  const entry = targetCommandFor(data, id, season)
  if (!targetCommandRows(entry, data)) return null
  const glove = await fetchGloveTargetFor(id, season).catch(() => null)
  return { entry, data, glove }
}

// Target command (#2015, pitcher only): how far each pitch finishes from the catcher's glove, and the cloud of his
// misses. Season aggregates over completed games, so an open surface (ADR-0034); no seal.
export default function TargetModule({ bio, season, onEmpty, onCount }) {
  const { data: loaded, loading, error } = useAsync(() => load(bio.id, season), [bio.id, season])
  const view = useMemo(() => (loaded ? targetView(loaded) : null), [loaded])
  const [picked, setPicked] = useState('ALL')
  const empty = Boolean(error) || (!loading && !view)
  useEffect(() => {
    if (empty) onEmpty()
  }, [empty, onEmpty])
  const count = view?.count
  useEffect(() => {
    onCount(count)
  }, [count, onCount])
  if (empty) return null
  if (!view) return <div className="target target--loading" aria-busy="true" />
  const row = view.rows.find((r) => r.key === picked) ?? view.rows[0]
  const cloud = cloudFor(loaded.glove, row)
  return (
    <div className="target">
      <div className="target__ledger">
        <p className="hint">
          Inches from the catcher&#8217;s glove, median. <b>Smaller is better.</b> The rank is among pitchers who throw that pitch;
          100th is nearest the glove.
        </p>
        <div role="group" aria-label="Pitch to draw">
          {view.rows.map((r) => (
            <button
              key={r.key}
              type="button"
              className={`target__row${r.key === 'ALL' ? ' target__row--all' : ''}`}
              aria-pressed={r.key === row.key}
              onClick={() => setPicked(r.key)}
            >
              <span className="target__name">
                {r.mark && (
                  <svg width="22" height="22" viewBox="-11 -11 22 22" aria-hidden="true">
                    <MarkPath mark={r.mark} r={7} />
                  </svg>
                )}
                <b>{r.label}</b>
                {r.mark && <em className="mono">{r.key}</em>}
              </span>
              <span className="target__val mono">
                <b>{r.value}</b>
                <small>MLB {r.mlb}</small>
              </span>
              <span className="target__n mono">{r.n}</span>
              <span className="target__strip" aria-hidden="true">
                <i className="target__fill" style={{ width: `${r.percentile}%` }} />
                <i className="target__mid" />
                <i className="target__tick" style={{ left: `${r.percentile}%` }} />
              </span>
              <span className="target__pct mono">{r.pct} pct</span>
            </button>
          ))}
        </div>
      </div>
      <div className="target__cloud">
        {cloud ? (
          <>
            <MissCloud cloud={cloud} />
            <p className="target__key">
              <span className="target__k target__k--glove">Glove</span>
              <span className="target__k target__k--his">His median</span>
              {cloud.league != null && <span className="target__k target__k--mlb">
                  <svg width="14" height="14" viewBox="-7 -7 14 14" aria-hidden="true">
                    <circle r="5" />
                  </svg>
                  MLB middle
                </span>}
            </p>
            <p className="target__readout mono">{cloud.readout}</p>
            <p className="hint">{cloud.lean}</p>
          </>
        ) : (
          <p className="hint target__none">No miss cloud on file</p>
        )}
      </div>
      <p className="target__credit">
        <a href={view.credit.href} rel="noreferrer noopener" target="_blank">
          {view.credit.text}
        </a>
      </p>
    </div>
  )
}
