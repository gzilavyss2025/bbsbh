// Where your things live, said in one line.
//
// **"This device." is the exact phrase.** Not "local", not "offline", not "not
// synced" — those all frame the ordinary, fully-working state as a deficiency,
// and it is not one: a signed-out visitor has a real club, a real Game Log and
// real reveal marks. Signing in adds continuity and nothing else. Read PRD §1.1
// and docs/game-log.md §3 before rewording any of these four strings.
//
// `phase` is a sync phase from src/lib/account/syncStatus.js. It is the ONE
// input, so this component can never disagree with the sync receipt below it.
const SCOPE = {
  // No account feature on this deploy at all. Say the true thing, not the
  // absence of a feature the visitor was never offered.
  off: { label: 'This device.', note: 'Everything here is saved on this device.' },
  // Clerk configured, signed out.
  local: { label: 'This device.', note: 'Everything here is saved on this device.' },
  pulling: { label: 'Every device you sign in on.', note: 'Checking with your account…' },
  synced: {
    label: 'Every device you sign in on.',
    note: 'Your club, settings and progress are carried across them.',
  },
  // 501 — the store is not configured on this deployment. A supported,
  // documented degrade (docs/development.md), so it is stated plainly and is
  // never styled as an error.
  unavailable: {
    // PRD §1.3, verbatim. "Signed in." leads on purpose — the user IS signed
    // in, and dropping it made this read like a signed-out state. "On this
    // device" is the phrase §1.1 fixes as exact; "here" is not it.
    label: 'Signed in.',
    note: 'Sync is not available on this deployment — everything is still saved on this device.',
  },
  error: {
    label: 'This device, for now.',
    note: 'Your account could not be reached. Nothing is lost; this device is still the copy that counts.',
  },
}

export function ScopeBadge({ phase = 'off' }) {
  const scope = SCOPE[phase] ?? SCOPE.off
  return (
    <p className="mytally__scope" data-phase={phase}>
      <span className="mytally__scopelabel">{scope.label}</span>
      <span className="mytally__scopenote caps-exempt">{scope.note}</span>
    </p>
  )
}
