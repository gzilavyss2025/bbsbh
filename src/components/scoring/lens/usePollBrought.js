import { useState } from 'react'
import { pollBrought } from '../../../lib/scorecard/bar.js'

// Did the newest poll bring anything the live edge shows (lib/scorecard/bar.js,
// pollBrought)? `checkedAt` is useAsync's `lastUpdated`, which moves with the
// feed in one render, so each look compares the entry count and the arm
// `{ total, armId }` against the look before. A look that finds the same
// answers false. State adjusted during render, as useLensBar does; nothing is
// stored (#1468).
export function usePollBrought(checkedAt, now) {
  const [seen, setSeen] = useState({ at: checkedAt, now, brought: false })
  if (seen.at !== checkedAt) {
    setSeen({ at: checkedAt, now, brought: seen.at != null && pollBrought(seen.now, now) })
  } else if (seen.now.total !== now.total || seen.now.armId !== now.armId) {
    // The same look, a changed step (a tap): keep the answer, track the step.
    setSeen({ ...seen, now })
  }
  return seen.brought
}
