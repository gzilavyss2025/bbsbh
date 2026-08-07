import '../../styles/15-team-color-lab.css'
import '../../styles/16-identity-lab-shell.css'
import '../../styles/17-identity-lab-workbench.css'
import { useEffect, useState } from 'react'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { LabShell } from './LabShell.jsx'
import { ColorLabBody } from './ColorLabBody.jsx'
import { mlbProfile } from './profiles/mlb.jsx'
import { auditProfile } from './profiles/audit.jsx'
import { milbProfiles } from './profiles/milb.jsx'
import { patternProfile } from './profiles/pattern.jsx'

// The Team Identity Lab (/identity-lab) — one screen covering every dimension
// of a club's visual identity: colour and logo tuning for MLB, the same for
// each full-season MiLB level, and the win-probability band pattern. It
// replaced five separate unlisted routes (/team-color-lab,
// /team-color-lab-{aaa,aa,higha,a}, /team-pattern-lab), which had grown three
// copies of the same shell, draft store, and editors between them.
//
// Dev-only, and gated as such in App.jsx: its Save writes straight to
// src/lib/data/*.json through a Vite dev middleware that doesn't exist in a
// production build (ADR-0029), so shipping it would ship a button that can only
// fail. Carries no score or reveal content either way.
const PROFILES = [mlbProfile, auditProfile, ...milbProfiles, patternProfile]

// Which dimension was last open, so returning to the lab lands where the last
// session left off rather than always on MLB — the small thing the five
// separate bookmarkable routes used to give for free.
const ACTIVE_KEY = 'bbsbh:identity-lab:profile'

export function IdentityLab() {
  const [activeKey, setActiveKey] = useState(() => {
    const saved = localStorage.getItem(ACTIVE_KEY)
    return PROFILES.some((p) => p.key === saved) ? saved : PROFILES[0].key
  })
  const profile = PROFILES.find((p) => p.key === activeKey) ?? PROFILES[0]
  useDocumentTitle(profile.title)

  useEffect(() => {
    localStorage.setItem(ACTIVE_KEY, activeKey)
  }, [activeKey])

  return (
    <LabShell
      title={profile.title}
      hint={profile.hint}
      chrome={profile.chrome ?? 'workbench'}
      profiles={PROFILES}
      activeKey={profile.key}
      onPick={setActiveKey}
    >
      {/* Keyed so switching dimension remounts: each one has its own team
          list, its own draft handles, and — for the colour dimensions — its own
          `useExtras` hook, which must not be reordered across a switch. */}
      {profile.Body ? (
        <profile.Body key={profile.key} />
      ) : (
        <ColorLabBody key={profile.key} profile={profile} />
      )}
    </LabShell>
  )
}
