import { useEffect, useState } from 'react'

// The one layout breakpoint: below it the app is the phone-first single
// column; at/above it screens widen and split into two columns (see the
// "WIDE LAYOUT" section of index.css — keep the two in sync). Exported so
// GameView can swap the two lineup pages for the combined spread at exactly
// the width the CSS starts laying columns.
export const WIDE_QUERY = '(min-width: 740px)'

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setMatches(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])

  return matches
}
