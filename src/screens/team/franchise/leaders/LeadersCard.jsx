import { useRef, useState } from 'react'
import { Card } from '../../../../components/ui/frame/Card.jsx'
import { Segmented } from '../../../../components/ui/control/Segmented.jsx'
import { Door } from '../../../../components/ui/control/Door.jsx'
import { useRouteLink } from '../../../../lib/nav.js'
import { playerPath } from '../../../../lib/route.js'
import { leadersView } from './leadersView.js'

// The all-time franchise leaders (#2785; wireframe approved by Gary 2026-11-05): nine headline
// top-five lists with a Career / Season switch, and a door that opens the card in place to all
// 26 categories. Season rows add the year. Regular season only, from the #2596 store.
const MODES = [
  { value: 'career', label: 'Career' },
  { value: 'season', label: 'Season' },
]

export function LeadersCard({ leaders }) {
  const link = useRouteLink()
  const [mode, setMode] = useState('career')
  const [all, setAll] = useState(false)
  const ref = useRef(null)
  const groups = leadersView(leaders, mode, all)
  if (!groups.length) return null
  const total = leadersView(leaders, mode, true).reduce((n, g) => n + g.lists.length, 0)
  // Closing a card thousands of pixels tall would leave the reader far below it: bring its top back.
  const toggle = () => {
    if (all && ref.current && ref.current.getBoundingClientRect().top < 0) ref.current.scrollIntoView({ block: 'start' })
    setAll((v) => !v)
  }
  return (
    <Card frame="stamped" body="flush" label="All-time leaders" count={leaders.through ? `Through ${leaders.through}` : null} className={mode === 'season' ? 'frlead frlead--season' : 'frlead'} ref={ref}>
      <div className="frlead__body">
        <Segmented label="Career or single season" value={mode} onChange={setMode} options={MODES} fill className="frlead__mode" />
        {groups.map((g) => (
          <section key={g.key} className="frlead__group" aria-label={g.label}>
            <h3 className="frlead__grouphead">{all ? `${g.label} · ${g.lists.length}` : g.label}</h3>
            <div className="frlead__lists">
              {g.lists.map((l) => (
                <div key={l.key} className="frlead__list">
                  <h4 className="frlead__cat">{l.label}</h4>
                  <ol className="frlead__rows">
                    {l.rows.map((r, i) => (
                      <li key={`${r.id}-${r.season ?? i}`} className="frlead__row">
                        <span className="frlead__rank">{r.rank}</span>
                        <a className="plink frlead__name" {...link(playerPath(r.id, { name: r.name }))}>
                          {r.name}
                        </a>
                        <span className="frlead__value">{r.value}</span>
                        {mode === 'season' && <span className="frlead__year">{r.season}</span>}
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
      <Door layout="block" className="frlead__door" onClick={toggle} aria-expanded={all}>
        {all ? 'Show fewer' : `Show all ${total} categories`}
      </Door>
    </Card>
  )
}
