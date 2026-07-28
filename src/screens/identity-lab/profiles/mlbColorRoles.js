// The Main tile's editable brand-colour roles, split out of mlb.jsx so the two
// rules that are easy to get subtly wrong — what a CLEARED swatch means on the
// way into the store, and what it means on the way back out — are plain JS the
// unit suite can pin (test/identity-lab-stores.test.js) rather than logic
// reachable only through a React tree.
//
// The third role is `accent`, not `third`, because that is what it controls:
// teams.js's TEAM_COLORS, the hand-picked "tells two clubs apart" hex behind
// headshot tints and favoriteAccentColor. For 27 of 30 clubs it deliberately
// restates the club's own Primary or Secondary. A club's real third-or-later
// brand colours are the separate `extras` list (teams.js's teamColorExtras).

export const COLOR_ROLES = ['primary', 'secondary', 'accent']

export const COLOR_ROLE_LABELS = { primary: 'Primary', secondary: 'Secondary', accent: 'Accent' }

// Merge one club's touched role fields into its mlb-team-colors.json entry.
//
// A cleared swatch DELETES the field rather than writing `''`. Both halves of
// that matter: the store's shape says an absent role is a colour the club
// doesn't have, and the dev-save validator's isColorish check rejects an empty
// string outright — so writing one would bounce the entire store with
// "108's primary is not a color" for an edit that was only ever a clear. Same
// delete-on-empty rule the sibling pinstripeBg and WPA band `bg` fields follow.
export function applyColorsDraft(record, fields) {
  const next = { ...record }
  for (const role of COLOR_ROLES) {
    if (fields[role] === undefined) continue
    if (fields[role]) next[role] = fields[role]
    else delete next[role]
  }
  return next
}

// Whether a draft has been overtaken by what's on disk, so useAutoClearLandedDrafts
// can drop it after a Save hot-reloads the store.
//
// The mirror of the rule above: a draft field of `''` matches a landed entry
// with no such role, because that is exactly what saving the clear produced.
// Comparing them raw would leave the draft stuck forever — `undefined === ''`
// is false — and the tile would keep showing an unsaved-changes state for an
// edit that landed perfectly.
export function colorsDraftMatchesLanded(fields, landed) {
  if (!landed) return false
  return Object.entries(fields).every(([role, value]) => (landed[role] ?? '') === value)
}
