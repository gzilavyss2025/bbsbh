// Every mark a club has, in one list — the CDN's four vectors, each treatment's
// procured art, and anything recolored in the lab's Logo art editor.
//
// Assembled here rather than at the one call site because the answer is a
// club-level fact ("what have we got?") that three surfaces already ask
// separately: the Marks on file shelf, the Logo art editor's source row, and
// the WPA art picker this was written for. What differs between them is which
// of these they can USE, not what exists.
//
// THE SOURCE KEY IS A PROTOCOL. `kind:id` — `cdn:cap`, `treatment:alternate`,
// `custom:serpent-red` — is what the WPA picker posts to the dev endpoint, and
// scripts/lib/dev-logo-upload.mjs parses it back with the same three prefixes.
// Both sides are closed sets: an unknown prefix resolves to nothing rather than
// being treated as a path. Change the vocabulary here and there in one commit.

import { LOGO_TREATMENT_DIRS, LOGO_ART_URL_ROOT, logoUploadTarget } from './logoArt.js'
import { customMarkFor, customMarksFor } from './customMarks.js'
import { LOGO_VARIANTS, teamLogoUrl } from './teams.js'
import LOGO_ART from './data/logo-art.json' with { type: 'json' }

// The treatments whose art can be reused elsewhere — every real destination
// except the `-wpa` slots themselves, which are where this material GOES.
const REUSABLE_TREATMENTS = Object.keys(LOGO_TREATMENT_DIRS).filter((k) => !k.endsWith('-wpa'))

const TREATMENT_LABELS = {
  main: 'Main',
  alternate: 'Alternate',
  'alternate-2': 'Alternate 2',
  'alternate-3': 'Alternate 3',
  'alternate-4': 'Alternate 4',
  'city-connect': 'City Connect',
  'milb-home': 'Home',
  'milb-away': 'Away',
}

// The art actually on disk for (team, treatment) — `{ url, ext }` or null.
// Read from the manifest rather than by trying the URL, because "does this
// club have Alt 3 art" has to be answerable without 30 requests that 404.
function procuredArt(teamId, treatment) {
  const target = logoUploadTarget(teamId, treatment)
  if (!target) return null
  const base = target.name.replace(/\.png$/, '')
  const entries = LOGO_ART[target.dir] ?? {}
  const ext = entries[`${base}.png`] ? 'png' : entries[`${base}.svg`] ? 'svg' : null
  return ext ? { url: `${LOGO_ART_URL_ROOT}/${target.dir}/${base}.${ext}`, ext } : null
}

// `[{ key, label, url, kind, vector }]`. `vector` marks the ones that can be
// recolored or scaled without going soft — the CDN four and any saved SVG.
export function clubMarkSources(teamId) {
  if (!teamId) return []
  const sources = [
    { key: 'cdn:base', kind: 'cdn', label: 'Base', url: teamLogoUrl(teamId, 'base'), vector: true },
    ...LOGO_VARIANTS.map((v) => ({
      key: `cdn:${v.key}`,
      kind: 'cdn',
      label: v.label,
      url: teamLogoUrl(teamId, v.key),
      vector: true,
    })),
  ]
  for (const treatment of REUSABLE_TREATMENTS) {
    const art = procuredArt(teamId, treatment)
    if (!art) continue
    sources.push({
      key: `treatment:${treatment}`,
      kind: 'treatment',
      label: TREATMENT_LABELS[treatment] ?? treatment,
      url: art.url,
      vector: art.ext === 'svg',
    })
  }
  for (const mark of customMarksFor(teamId)) {
    sources.push({ key: `custom:${mark.slug}`, kind: 'custom', label: mark.name, url: mark.url, vector: true })
  }
  return sources.filter((s) => s.url)
}

// The marks the sketch modal offers, in picker order — the sketcher's subset of
// the list above, not the lab's. Three of the four are fixed:
//
//   Cap → Base → (City Connect) → Wordmark
//
// `base` sits where `primary` used to. The CDN serves both, but for most clubs
// the primary mark is the base mark redrawn at a slightly different crop, so
// offering both spent a slot on a near-duplicate; base is the one that differs
// most from the cap logo, which is the whole reason the picker exists (draw
// something other than the same roundel every time).
//
// City Connect is the one entry that isn't on the CDN at all (teams.js's
// LOGO_VARIANTS note) — it appears only for a club whose CC art we actually
// have, which is either a procured file on disk or a mark recolored in the lab
// and assigned to that treatment, the same two sources `localLogoUrl` resolves
// through. Asked of the manifest rather than by probing the URL, so a club
// without it never renders a tab that would fall back to the base mark.
export function sketchMarkVariants(teamId) {
  const hasCityConnectArt = Boolean(
    teamId && (procuredArt(teamId, 'city-connect') || customMarkFor(teamId, 'city-connect'))
  )
  return [
    { key: 'cap', label: 'Cap' },
    { key: 'base', label: 'Base' },
    ...(hasCityConnectArt ? [{ key: 'city-connect', label: 'City Connect' }] : []),
    { key: 'wordmark', label: 'Wordmark' },
  ]
}
