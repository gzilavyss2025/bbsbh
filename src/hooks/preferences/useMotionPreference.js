import { useEffect } from 'react'
import { usePreferences } from './usePreferences.js'

// Applies the `motion` preference to the document, so the control on My Tally
// is a real accessibility affordance rather than a stored string.
//
// It shipped as the latter, and the copy beside it promised otherwise ("Skip
// the page turns and the stamp landing"). Nothing in the app read the field —
// the same defect class `syncClaims.js` exists to prevent one axis over: copy
// claiming a BEHAVIOUR before the wire exists. Mounted once, in App.jsx.
//
// `reduced` is enforced globally in styles/01-base.css off this attribute, so
// it covers every animation in the app at once — including the ones written
// before this preference existed, which no per-component opt-in would reach.
//
// `system` writes nothing, which is the honest default: with no attribute the
// app behaves exactly as it always has, following the OS query alone.
//
// `full` deliberately does NOT override an OS request for reduced motion. The
// app's 27 `@media (prefers-reduced-motion: reduce)` blocks would each have to
// be re-scoped to undo it, and overriding an accessibility setting the user set
// at the OS level is the wrong default to build toward anyway. The copy says
// what it actually does; see DeviceSection.jsx.
export function useMotionPreference() {
  const { motion } = usePreferences()

  useEffect(() => {
    const root = document.documentElement
    if (motion === 'reduced') root.dataset.motion = 'reduced'
    else delete root.dataset.motion
    return () => {
      delete root.dataset.motion
    }
  }, [motion])
}
