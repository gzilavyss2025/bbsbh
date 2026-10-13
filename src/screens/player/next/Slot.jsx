import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { useNearView } from '../../../hooks/scroll/useNearView.js'
import { Card } from '../../../components/ui/frame/Card.jsx'
import { SlotBoundary } from './SlotBoundary.jsx'

// Runs once the module has mounted: a module that rendered nothing has no data.
// It sits beside the module inside its Suspense boundary, so it commits with it.
function Probe({ bodyRef, onEmpty }) {
  useEffect(() => {
    if (!bodyRef.current?.firstChild) onEmpty()
  }, [bodyRef, onEmpty])
  return null
}

// One slot of the new player page (#1884): a stamped Card with its name tab and
// count tag, around a module that loads when the slot comes near. The module owns
// its data; the slot owns the card and the hide-when-empty rule. The page tells
// the jump bar through `onEmpty`.
export function Slot({ inst, bio, asOf, season, onEmpty }) {
  const [ref, near] = useNearView()
  const [Module] = useState(() => lazy(inst.load))
  const [count, setCount] = useState()
  const bodyRef = useRef(null)
  const [report] = useState(() => () => onEmpty(inst.key))
  return (
    <Card frame="stamped" label={inst.label} count={count} ref={ref} className="pnext__slot">
      {near ? (
        <SlotBoundary slotKey={inst.key} onFail={report}>
          <Suspense fallback={<p className="hint">Loading {inst.label}…</p>}>
            <div ref={bodyRef}>
              <Module
                bio={bio}
                role={inst.role}
                asOf={asOf}
                season={season}
                section={inst.section}
                onEmpty={report}
                onCount={setCount}
              />
            </div>
            <Probe bodyRef={bodyRef} onEmpty={report} />
          </Suspense>
        </SlotBoundary>
      ) : (
        <p className="hint">{'\u00a0'}</p>
      )}
    </Card>
  )
}
