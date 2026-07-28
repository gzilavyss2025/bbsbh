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
//
// `accent2` is a DIFFERENT kind of thing from `accent` — no distinctiveness
// meaning, no consumer beyond this swatch — it's just an editable 4th slot
// for the one club-level extra that used to only ever show up read-only in
// the `extras` list. Seeded once (see the migration this landed with) from
// whichever of a club's researched extras came first; any additional extra
// beyond that stays in `extras`, still read-only, since a single role can't
// hold more than one of them. A club with no extra at all simply has no
// `accent2`, same as any other absent role.

export const COLOR_ROLES = ['primary', 'secondary', 'accent', 'accent2']

export const COLOR_ROLE_LABELS = {
  primary: 'Primary',
  secondary: 'Secondary',
  accent: 'Accent',
  accent2: 'Accent 2',
}

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

// The per-TREATMENT color panel (every tile — Main included — gets its own
// four slots: mlb-treatment-tuning.json's `treatments.<key>.colors`) is a
// separate, independent thing from the Main-only triad above: that triad is
// the club's single brand identity (feeds real headshot tints via
// TEAM_COLORS/TEAM_COLOR_PAIRS in teams.js, one value per club regardless of
// which jersey it's wearing); this is per-jersey research/reference color
// notes, edited the same way position/WPA/header tuning already is. Same
// role count for every treatment — editing needs a stable slot-to-role
// mapping, same reasoning as COLOR_ROLES above.
export const TREATMENT_COLOR_ROLES = ['primary', 'secondary', 'accent1', 'accent2']

export const TREATMENT_COLOR_ROLE_LABELS = {
  primary: 'Primary',
  secondary: 'Secondary',
  accent1: 'Accent 1',
  accent2: 'Accent 2',
}

// Merge one (team, treatment)'s touched color fields into its
// mlb-treatment-tuning.json `colors` record — same delete-on-empty rule as
// applyColorsDraft above, for the same reason (isColorish rejects `''`).
export function applyTreatmentColorsDraft(record, fields) {
  const next = { ...record }
  for (const role of TREATMENT_COLOR_ROLES) {
    if (fields[role] === undefined) continue
    if (fields[role]) next[role] = fields[role]
    else delete next[role]
  }
  return next
}
