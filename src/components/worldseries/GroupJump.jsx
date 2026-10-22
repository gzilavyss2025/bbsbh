import { useEffect, useRef, useState } from 'react'
import { HubTabBar } from '../chrome/HubTabBar.jsx'
import { SectionHead } from '../ui/frame/SectionHead.jsx'

// THE SERIES PAGE'S JUMP BAR (layout C): one sticky bar over the page's groups, each button
// scrolling to the section `ww-group-{key}`. It sticks under the slate's own bar like the
// scouting report's did (`--slate-bar-h`; the probe reads it), so a tap lands the group below
// both. Render it as a direct child of the page: a sticky bar sticks only inside its parent.
//
//   groups  [{ key, label }] in page order (lib/postseason/worldseries/groups.js)
export function GroupJump({ groups }) {
  const probeRef = useRef(null)
  const [offset, setOffset] = useState(0)
  const shown = groups.length > 0
  useEffect(() => {
    const probe = probeRef.current
    const bar = probe?.nextElementSibling
    if (!shown || !bar || typeof ResizeObserver === 'undefined') return undefined
    const read = () => setOffset(probe.offsetHeight + bar.offsetHeight)
    const ro = new ResizeObserver(read)
    ro.observe(probe)
    ro.observe(bar)
    return () => ro.disconnect()
  }, [shown])
  if (!shown) return null
  return (
    <>
      <span ref={probeRef} className="ww-scout__probe" aria-hidden="true" />
      <HubTabBar
        variant="anchor"
        tabs={groups.map((g) => ({ key: `ww-group-${g.key}`, label: g.label }))}
        ariaLabel="Series page groups"
        className="ww-scout__jump"
        offset={offset}
        badges={false}
      />
    </>
  )
}

// One group: a navy head, then its parts. `id` is the jump bar's `key`. `bare` leaves the head
// out when the parts bring their own band (the Scouting report's).
export function Group({ id, label, bare = false, children }) {
  return (
    <section id={`ww-group-${id}`} className="ww-group">
      {!bare && (
        <SectionHead look="band" house as="h2">
          {label}
        </SectionHead>
      )}
      {children}
    </section>
  )
}
