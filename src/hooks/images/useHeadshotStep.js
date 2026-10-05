import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { headshotStepDelay, headshotStepUrl } from '../../lib/headshot/retry.js'
import { logHeadshotEvent } from '../../lib/headshot/log.js'

// The shared "which try are we on" state for a headshot <img> (Headshot.jsx and
// PitcherNotice.jsx's PitcherPhoto). `onError` moves to the next step —
// straight away, or after a pause when the failed step was a first try
// (headshot/retry.js has the policy). `identityKey` resets the steps when the
// image describes a different person, computed during render like the old
// per-component state was; a pending retry for the OLD identity is dropped.
// Returns the URL to try now (null when every source is spent) and the
// <img>'s `onError`. `info` rides along into the failure log (issue #1446).
export function useHeadshotStep(identityKey, sources, info) {
  const [step, setStep] = useState(0)
  const [prevKey, setPrevKey] = useState(identityKey)
  const keyRef = useRef(identityKey)
  const timer = useRef(null)
  if (identityKey !== prevKey) {
    setPrevKey(identityKey)
    setStep(0)
  }
  useEffect(() => {
    keyRef.current = identityKey
  }, [identityKey])
  useEffect(() => () => clearTimeout(timer.current), [])

  const url = headshotStepUrl(sources, step)
  const infoRef = useRef(info)
  useLayoutEffect(() => {
    infoRef.current = info
  })
  const onError = useCallback(() => {
    logHeadshotEvent({ kind: 'load-error', step, url, ...infoRef.current })
    const key = keyRef.current
    const advance = () => {
      if (keyRef.current === key) setStep((s) => (s === step ? s + 1 : s))
    }
    const delay = headshotStepDelay(step)
    if (delay) timer.current = setTimeout(advance, delay)
    else advance()
  }, [step, url])

  return { url, onError }
}
