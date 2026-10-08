import { useId, useState } from 'react'
import { motionIsReduced } from '../../hooks/preferences/motionIsReduced.js'
import { tierFor } from '../../lib/ovr/tiers.js'
import { OvrMenu } from './OvrMenu.jsx'
import '../../styles/ovr/card.css'

// The closed OVR card (#1703): one big number with "OVR" under it. Tapping it opens the
// menu, a full sheet. The tile shows the hitting rating of a two-way player; the menu has
// the switch. `ratings` is useOvr's answer, so it is never empty.
//
// The tap is the only trigger of motion. `menu.play` is read from motionIsReduced AT the
// tap, so a reduced-motion reader gets no play class and no count-up, and a page load
// never plays anything (docs/motion.md, "The one-shot gate"). `taps` keys the face and
// the ring so each tap presses and rings again.
export function OvrTile({ ratings, personId, name, sub }) {
  const menuId = useId()
  const [menu, setMenu] = useState(null)
  const [taps, setTaps] = useState(0)
  const group = ratings.hitting ? 'hitting' : 'pitching'
  const { ovr } = ratings[group]
  const tier = tierFor(ovr)
  const press = taps > 0 && menu?.play

  return (
    <>
      <button
        type="button"
        className={`ovrtile${tier.key === 'legend' ? ' ovrtile--legend' : ''}`}
        style={{ '--tier': `var(--ovr-${tier.key})` }}
        aria-label={`OVR ${ovr}, open the rating menu`}
        aria-haspopup="dialog"
        aria-expanded={Boolean(menu)}
        aria-controls={menu ? menuId : undefined}
        onClick={() => {
          setMenu({ play: !motionIsReduced() })
          setTaps((n) => n + 1)
        }}
      >
        <span key={taps} className={`ovrtile__face${press ? ' ovrtile__face--press' : ''}`} aria-hidden="true">
          <span className="ovrtile__num">{ovr}</span>
          <span className="ovrtile__label">OVR</span>
        </span>
        {press && <span key={`ring${taps}`} className="ovrtile__ring" aria-hidden="true" />}
      </button>
      {menu && (
        <OvrMenu
          id={menuId}
          ratings={ratings}
          initialGroup={group}
          personId={personId}
          name={name}
          sub={sub}
          play={menu.play}
          onClose={() => setMenu(null)}
        />
      )}
    </>
  )
}
