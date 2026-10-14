import { useState } from 'react'
import { OvrBars } from '../../../../components/ovr/OvrBars.jsx'
import { Button } from '../../../../components/ui/control/Button.jsx'
import { Cluster } from '../../../../components/ui/layout/Cluster.jsx'
import { CONSTANTS } from '../../../../api/ovr/rating.js'
import { TIERS } from '../../../../lib/ovr/tiers.js'
import { tierLine } from '../heroData.js'
import '../../../../styles/ovr/card.css'

const WORD = { hitting: 'Batting', pitching: 'Pitching' }
const { FLOOR, CAP } = CONSTANTS

// The six-step tier ladder, his step inked.
function Ladder({ view }) {
  return (
    <ol className="pnext-ovr__ladder" aria-label={`Tier: ${view.tier.name}, OVR ${view.ovr}`}>
      {TIERS.map((t) => (
        <li key={t.key} aria-current={t.key === view.tier.key || undefined}>
          <span className="pnext-ovr__step">{t.name}</span>
          <span className="pnext-ovr__lo mono">{t.lo}+</span>
        </li>
      ))}
    </ol>
  )
}

// A minor leaguer's level meter: mint to his OVR, a dashed line at his level's cap, hatching
// out to POT. A mark the data lacks draws nothing.
function Meter({ view }) {
  const { pot, levelLabel, marks } = view.minor
  const say = [`OVR ${view.ovr} now`, marks.cap && `${levelLabel} cap ${marks.cap.value}`, pot != null && `potential ${pot}`]
  return (
    <div>
      <div className="pnext-ovr__meter" role="img" aria-label={`${say.filter(Boolean).join(', ')}, on a scale of ${FLOOR} to ${CAP}`}>
        {marks.pot != null && <span className="pnext-ovr__hatch" style={{ left: `${marks.ovr}%`, width: `${marks.pot - marks.ovr}%` }} />}
        <span className="pnext-ovr__fill" style={{ width: `${marks.ovr}%` }} />
        {marks.cap && <span className="pnext-ovr__cap" style={{ left: `${marks.cap.at}%` }} />}
        <span className="pnext-ovr__mtag" style={{ left: `${marks.ovr}%` }}>Now {view.ovr}</span>
        {marks.cap && <span className="pnext-ovr__mtag pnext-ovr__mtag--cap" style={{ left: `${marks.cap.at}%` }}>{levelLabel} cap {marks.cap.value}</span>}
      </div>
      <p className="pnext-ovr__scale mono">
        <span>{FLOOR}</span>
        <span>{pot != null && `POT ${pot} · `}scale ends at {CAP}</span>
      </p>
    </div>
  )
}

// The ratings strip at the foot of the hero (#2009), folded until the stamp opens it (`hidden`).
// A two-way player gets a Batting | Pitching switch, batting first; the pick is local, stored nowhere.
export function HeroStrip({ id, ratings, open }) {
  const [group, setGroup] = useState(ratings[0].group)
  const [picked, setPicked] = useState(null)
  const view = ratings.find((r) => r.group === group) ?? ratings[0]
  return (
    <div id={id} className="pnext-ovr__strip" hidden={!open}>
      {ratings.length > 1 && (
        <Cluster className="pnext-ovr__switch" role="group" aria-label="Rating">
          {ratings.map((r) => (
            <Button key={r.group} size="control" pressed={r.group === view.group} onClick={() => { setGroup(r.group); setPicked(null) }}>{WORD[r.group]}</Button>
          ))}
        </Cluster>
      )}
      <div className="pnext-ovr__cols">
        <Ladder view={view} />
        {view.minor ? <Meter view={view} /> : (
          <div className="pnext__ovr">
            <OvrBars rows={view.rows} picked={picked} onPick={setPicked} />
            <p className="pnext-ovr__read" aria-live="polite">{tierLine(view.rows, picked) ?? 'Tap a rating to read its tier.'}</p>
            {view.seasons && <p className="pnext__attr">{view.seasons}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
