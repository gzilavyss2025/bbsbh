import { useState } from 'react'
import { useMediaQuery } from '../../hooks/useMediaQuery.js'
import { usePreferences } from '../../hooks/preferences/usePreferences.js'
import { NIGHT_SNOOZE_MS, offerNightMode } from '../../hooks/preferences/effectiveTheme.js'
import { Button } from '../ui/control/Button.jsx'
import { IconButton } from '../ui/control/IconButton.jsx'
import { Cluster } from '../ui/layout/Cluster.jsx'

// The night-mode offer (ADR-0131). A dark device no longer turns night mode on
// by itself: until the person picks an Appearance, the page stays light and this
// bar asks. "Dark Mode" saves 'system' (follow the device from now on), "Light
// Mode" saves 'light', and ✕ hides it on this device for two days. Mounted once,
// above every route, in App.jsx. It tracks the device's setting live, so a
// sunset switch shows or hides it without a reload.
const SNOOZE_KEY = 'bbsbh:nightbar:snoozedUntil'

const readSnooze = () => {
  try {
    return Number(localStorage.getItem(SNOOZE_KEY)) || 0
  } catch {
    return 0
  }
}

export function NightModeBar() {
  const { has, set } = usePreferences()
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)')
  const [snoozedUntil, setSnoozedUntil] = useState(readSnooze)
  const [now] = useState(() => Date.now())

  if (!offerNightMode({ chosen: has('appearance'), systemDark, snoozedUntil, now })) return null

  const snooze = () => {
    const until = Date.now() + NIGHT_SNOOZE_MS
    try {
      localStorage.setItem(SNOOZE_KEY, String(until))
    } catch {
      // Storage off: hide for this session only.
    }
    setSnoozedUntil(until)
  }

  return (
    <Cluster gap="base" rowGap="snug" align="center" className="nightbar" role="region" aria-label="Night mode">
      <p className="nightbar__msg">We noticed you have Dark Mode on. Use it here too?</p>
      <Cluster align="center">
        <Button skin="ink" onClick={() => set('appearance', 'system')}>
          Dark Mode
        </Button>
        <Button onClick={() => set('appearance', 'light')}>Light Mode</Button>
        <IconButton label="Not now" onClick={snooze}>
          ✕
        </IconButton>
      </Cluster>
    </Cluster>
  )
}
