import { useEffect, useRef } from 'react'
import { BallparkDiagram } from './BallparkDiagram.jsx'
import { rankedDimensions, ordinal } from '../lib/ballparkData.js'

// The Ballpark sheet: a to-scale ink sketch of the field (BallparkDiagram) over a
// facts strip (built / roof / capacity) and the park's outfield distances + wall
// heights, each ranked against the 30 MLB parks ("Center field 420′ — 1st of 29").
// Opened by tapping the venue name on the lineup page's game facts.
//
// Spoiler-safe: everything here is static park geometry (src/lib/ballparkData.js),
// no score, so it sits outside any seal like the rest of the lineup page. Same
// dialog contract as WhatsBrewingModal — dismiss via backdrop, close button, or
// Escape; focus moves into the sheet on open and back to the trigger on close.
export function BallparkModal({ venue, onClose }) {
  const data = rankedDimensions(venue)

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

  if (!data) return null
  const distRows = data.rows.filter((r) => r.group === 'dist')
  const wallRows = data.rows.filter((r) => r.group === 'wall')

  return (
    <div
      className="scrim"
      onClick={(e) => e.target.classList.contains('scrim') && onClose()}
    >
      <div className="sheet bpsheet" role="dialog" aria-modal="true" aria-label={data.name}>
        <div className="bpsheet__head">
          <h2 className="sheet__title">{data.name}</h2>
          <button ref={closeRef} className="bpsheet__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <BallparkDiagram dist={data.dist} wall={data.wall} arc={data.arc} />

        <dl className="bpsheet__facts">
          <Facts label="Opened" value={data.built} />
          <Facts label="Roof" value={data.roof} />
          <Facts label="Capacity" value={data.capacity?.toLocaleString()} />
        </dl>

        <div className="bpsheet__ranks">
          <RankGroup title="Outfield distances" rows={distRows} />
          <RankGroup title="Wall heights" rows={wallRows} />
        </div>

        <p className="bpsheet__foot">
          Distances from the MLB Stats API, ranked among the MLB parks · wall shapes
          from GeomMLBStadiums
        </p>
      </div>
    </div>
  )
}

function Facts({ label, value }) {
  return (
    <div className="bpfact">
      <dt className="bpfact__label">{label}</dt>
      <dd className="bpfact__value">{value || '—'}</dd>
    </div>
  )
}

// One ranked family (distances or wall heights). Each row pairs the value with
// its league rank; the extremes (1st / last) are called out so a bandbox or a
// cavern jumps off the list.
function RankGroup({ title, rows }) {
  return (
    <section className="rankgrp">
      <h3 className="rankgrp__title">{title}</h3>
      <ul className="rankgrp__list">
        {rows.map((r) => {
          const extreme = r.rank === 1 ? 'is-most' : r.rank === r.total ? 'is-least' : ''
          return (
            <li key={`${r.group}-${r.key}`} className="rankrow">
              <span className="rankrow__label">{r.label}</span>
              <span className="rankrow__value">{r.value}′</span>
              <span className={`rankrow__rank ${extreme}`}>
                {ordinal(r.rank)}
                <span className="rankrow__of"> of {r.total}</span>
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
