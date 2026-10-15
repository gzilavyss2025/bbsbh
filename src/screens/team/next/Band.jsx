import { Suspense, useCallback, useState } from 'react'
import { useNearView } from '../../../hooks/scroll/useNearView.js'
import { Stack } from '../../../components/ui/layout/Stack.jsx'

// One band slot: a section the jump bar scrolls to, and a module that mounts (and so
// fetches) only once the section is near. Until the module reports `onReady` the section
// holds a floor height, so the bands below it stay far and do not all come near at once.
// The module gets `{ team, asOf, sportId, onReady, onCount }`.
export function Band({ band, team, asOf, sportId, onCount }) {
  const [ref, near] = useNearView('300px 0px')
  const [held, setHeld] = useState(true)
  const ready = useCallback(() => setHeld(false), [])
  const count = useCallback((n) => onCount(band.key, n), [onCount, band.key])
  const { Module } = band
  return (
    <Stack
      as="section"
      gap="section"
      id={band.key}
      ref={ref}
      className={`tnext__band${held ? ' tnext__band--hold' : ''}`}
      aria-busy={held || undefined}
    >
      {near && (
        <Suspense fallback={null}>
          <Module team={team} asOf={asOf} sportId={sportId} onReady={ready} onCount={count} />
        </Suspense>
      )}
    </Stack>
  )
}
