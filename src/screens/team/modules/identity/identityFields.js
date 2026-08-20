// What the identity drawer shows for one club: which treatments it has, which
// fields each group holds, and — the part that matters — what each field is
// SHOWING RIGHT NOW with no override of its own.
//
// Pure, no React, and unit-tested (test/identity-drawer-fields.test.js). It sits
// beside the drawer rather than in src/lib/identity/ deliberately: it reads the
// WPA and stamp modules, both of which are kept off the eager first-paint path
// (wpa/wpaDefaults.js exists for exactly that reason), and a module in
// src/lib/identity/ is one an unwary edit would import from something eager.
// Here, the only importer is a lazily-loaded editor.
//
// TWO VALUES PER FIELD, AND THE DIFFERENCE IS THE WHOLE INTERACTION.
//
//   `landed`   what this club renders with RIGHT NOW, read through the app's
//              own resolvers. Shown as the input's placeholder.
//   the draft  what the owner has typed. Empty means "no override", which is
//              how a field is CLEARED back to what ships; the same rule the
//              ballpark editor and the copy registry keep.
//
// `landed` is re-read on every render, and the draft is already applied to the
// overlay's preview layer by then — so emptying a box shows the shipped value
// coming back before anything is saved. It needs none of the bundled stores,
// which are server-side only (src/lib/identity/stores.js).

import {
  defaultHomeTreatmentFor,
  hasAlternate2,
  hasAlternate3,
  hasAlternate4,
  mainOverrideLogoUrl,
  teamLogoUrl,
  treatmentBgColor,
  treatmentHeaderColorOverride,
  treatmentTuningRecord,
} from '../../../../lib/teams.js'
import { MLB_TEAM_COLORS } from '../../../../lib/brandColors.js'
import {
  MILB_HEADER_COLOR_OVERRIDES,
  MILB_LOGO_POS_OVERRIDES,
  MILB_WPA_BAND_COLOR_OVERRIDES,
  MILB_WPA_LOGO_LAYOUT_OVERRIDES,
  MILB_WPA_WORDMARK_OVERRIDES,
} from '../../../../lib/milbColors.js'
import { stampLogoTuningRecord } from '../../../../lib/stampLogoTuning.js'
import { monoInkFor } from '../../../../lib/monoInk.js'
import { BAND_COLOR_OVERRIDES, WPA_TREATMENT_BAND_COLOR_OVERRIDES } from '../../../../lib/wpa/wpaBandColors.js'
import { WPA_LOGO_LAYOUT_OVERRIDES, WPA_OWN_ART, WPA_WORDMARK_OVERRIDES } from '../../../../lib/wpa/wpaLogo.js'
import { parkWashColorOverride, parkWashIntensity, tileColorFor } from '../../../../lib/ballpark/parkWash.js'
import {
  IDENTITY_DIMENSIONS,
  MLB_TREATMENTS,
  headerTriadRefusal,
  identityFieldId,
} from '../../../../lib/identity/fields.js'

const LABELS = {
  main: 'Main',
  alternate: 'Alternate',
  'alternate-2': 'Alternate 2',
  'alternate-3': 'Alternate 3',
  'alternate-4': 'Alternate 4',
  'city-connect': 'City Connect',
  home: 'Home',
  away: 'Away',
}

export function treatmentLabel(key) {
  return LABELS[key] ?? key
}

// Which tiles this club's strip offers. MiLB is always both sides; an MLB club
// shows Alternate 2/3/4 only where one is actually set up, the same opt-in
// `hasAlternate*` test /identity-lab's own grid uses — a placeholder tile for a
// treatment the club does not have is a control that can only write a record
// nothing reads.
export function treatmentsForClub(teamId, isMilb) {
  if (isMilb) return ['home', 'away']
  return MLB_TREATMENTS.filter(
    (key) =>
      (key !== 'alternate-2' || hasAlternate2(teamId)) &&
      (key !== 'alternate-3' || hasAlternate3(teamId)) &&
      (key !== 'alternate-4' || hasAlternate4(teamId)),
  )
}

// Which of a club's two bars a treatment wears — the same collapse
// `treatmentHeaderColorOverride` makes, so the drawer edits the record the page
// actually reads instead of one filed under a key no resolver looks at.
export function barKeyFor(treatment, isMilb) {
  if (isMilb) return treatment
  return treatment === 'city-connect' ? 'city-connect' : 'main'
}

// A string for an input, from whatever the store holds. `null`/`undefined` is
// "nothing landed"; a number becomes its own text so the box is comparable with
// what the owner types.
function text(value) {
  if (value == null) return ''
  return String(value)
}

function fieldsFrom(dimension, teamId, key, record, only) {
  const spec = IDENTITY_DIMENSIONS[dimension]
  const names = only ?? Object.keys(spec.fields)
  return names.map((name) => ({
    id: key == null ? identityFieldId(dimension, teamId, name) : identityFieldId(dimension, teamId, key, name),
    name,
    label: FIELD_LABELS[name] ?? name,
    hint: FIELD_HINTS[name] ?? null,
    spec: spec.fields[name],
    landed: text(record?.[name]),
  }))
}

// A plain-language explanation for a field whose label alone doesn't say what
// it does. Rendered under the box every time — no native `title`, which a
// touch screen never sees.
const FIELD_HINTS = {
  originY: 'Where the logo scales and rotates from, vertically: top, center, bottom, or a percent down the tile.',
  bandColor: 'Used only when this treatment has no band of its own below — most tuned clubs already have one.',
  rowShift:
    "Percent of a tile's width each row steps sideways from the one above it. 0 is a plain grid; 50 staggers rows like brickwork.",
  wpaWordmark: "Tiles this club's wordmark instead of its normal mark.",
  ownArt: "Tiles a separately uploaded WPA-only mark. With none on file, this treatment's normal mark keeps showing.",
}

const FIELD_LABELS = {
  scale: 'Scale',
  offsetX: 'Nudge across',
  offsetY: 'Nudge down',
  originY: 'Anchor',
  pinstripeColor: 'Pinstripe line',
  pinstripeBg: 'Pinstripe fill',
  bgHex: 'Tile fill',
  bg: 'Tile fill',
  rotation: 'Rotation',
  bar: 'Bar',
  accent: 'Kraft edge',
  onBar: 'Ink on the bar',
  markScale: 'Mark size',
  primary: 'Primary',
  secondary: 'Secondary',
  accent2: 'Fourth colour',
  bandColor: 'Fallback band',
  offDayTreatment: 'Off-day jersey',
  defaultHomeTreatment: 'Default home',
  defaultAwayTreatment: 'Default away',
  size: 'Tile size',
  rotate: 'Tile rotation',
  paddingX: 'Tile gap across',
  paddingY: 'Tile gap down',
  rowShift: 'Row shift %',
  band: 'Band',
  wpaWordmark: 'Use wordmark',
  ownArt: 'Use uploaded art',
}

// The stamp group holds both sides at once (the two slots are not mirror
// images — src/lib/CLAUDE.md), so its labels name the side. Spelled out rather
// than lower-casing FIELD_LABELS at render time, which the ALL-CAPS invariant's
// JS half forbids for exactly this reason (ADR-0017).
const STAMP_FIELD_SUFFIX = {
  scale: 'scale',
  offsetX: 'nudge across',
  offsetY: 'nudge down',
  rotation: 'rotation',
}

// The WPA band's seven tile-layout numbers — the same list fields.js's
// WPA_LAYOUT_FIELDS names, restated here since this module cannot import a
// private const from that one.
const WPA_LAYOUT_FIELD_NAMES = ['size', 'rotate', 'offsetX', 'offsetY', 'paddingX', 'paddingY', 'rowShift']

// What the tile for (club, key) resolves as its mark URL today, through the
// same chain the page renders with — which is what makes it an honest
// placeholder for the Art URL box. Main's rung order is treatmentTile's own:
// the recolor/override file when one exists, else the plain CDN base mark.
function landedTileArtUrl(teamId, key, isMilb) {
  if (isMilb) return text(teamLogoUrl(teamId, `milb-${key}`))
  if (key === 'main') return text(mainOverrideLogoUrl(teamId) ?? teamLogoUrl(teamId, 'base'))
  return text(teamLogoUrl(teamId, key))
}

// The groups the drawer renders for one club and one selected treatment. The
// order here is the order on screen, coarsest control last: the tile you are
// looking at, then the club, then its bar, then the two dimensions that are not
// on this page at all.
export function identityGroups(teamId, { isMilb, treatment }) {
  const id = String(teamId)
  const bar = barKeyFor(treatment, isMilb)
  const groups = []

  if (isMilb) {
    groups.push({
      key: 'tile',
      title: `${treatmentLabel(treatment)} tile`,
      fields: fieldsFrom('milbTuning', id, treatment, MILB_LOGO_POS_OVERRIDES[id]?.[treatment]),
    })
  } else {
    const record = treatmentTuningRecord(teamId, treatment) ?? {}
    // Main's fill is its own `bgHex`; every other treatment's is the `bg: true`
    // swatch in that treatment's colour store. One row on screen, two stores
    // underneath — see fields.js's tileBg dimension.
    const tint =
      treatment === 'main'
        ? fieldsFrom('mlbTuning', id, treatment, record, ['bgHex'])
        : [
            {
              id: identityFieldId('tileBg', id, treatment),
              name: 'tileBg',
              label: FIELD_LABELS.bg,
              spec: IDENTITY_DIMENSIONS.tileBg.leaf,
              landed: text(treatmentBgColor(teamId, treatment)),
            },
          ]
    groups.push({
      key: 'tile',
      title: `${treatmentLabel(treatment)} tile`,
      fields: [
        ...fieldsFrom('mlbTuning', id, treatment, record, [
          'scale',
          'offsetX',
          'offsetY',
          'originY',
          'pinstripeColor',
          'pinstripeBg',
        ]),
        ...tint,
      ],
    })
  }

  // The mark this tile wears. One url field (fields.js's `logo` dimension) —
  // the drawer renders it with the upload control beside it, and the landed
  // value is the URL the tile resolves TODAY through the app's own chain
  // (override, assignment, procured file, CDN), so the placeholder always names
  // real art rather than a path that may 404.
  groups.push({
    key: 'logo',
    title: `${treatmentLabel(treatment)} logo art`,
    logo: true,
    fields: [
      {
        id: identityFieldId('logo', id, treatment),
        name: 'logoUrl',
        label: 'Art URL',
        spec: IDENTITY_DIMENSIONS.logo.leaf,
        landed: landedTileArtUrl(teamId, treatment, isMilb),
      },
    ],
  })

  // Club-level colours are an MLB store. An affiliate's pair is researched, and
  // carries provenance a hex box cannot hold, so it stays in /identity-lab —
  // src/lib/brandColors.js says the same thing at the registration site.
  if (!isMilb) {
    groups.push({
      key: 'club',
      title: 'Club colours',
      fields: fieldsFrom('colors', id, null, MLB_TEAM_COLORS[id]),
    })
  }

  groups.push({
    key: 'bar',
    title: `${treatmentLabel(bar)} bar`,
    // The one group whose save can be refused outright. The note is rendered as
    // a live contrast readout rather than prose — see IdentityDrawer.jsx.
    triad: true,
    fields: fieldsFrom(
      isMilb ? 'milbHeader' : 'mlbHeader',
      id,
      bar,
      isMilb ? MILB_HEADER_COLOR_OVERRIDES[id]?.[bar] : treatmentHeaderColorOverride(teamId, treatment),
    ),
  })

  groups.push({
    key: 'stamp',
    title: 'Stamp placement',
    // Not decoration. This store is read every time a stamp draws, so a change
    // here restyles the keepsakes already sitting in people's Game Logs —
    // ADR-0035's amendment, and the reason the warning is attached to the group
    // rather than left in a doc.
    warning:
      'A stamp keeps game facts and no art, so it is redrawn from these numbers every time. ' +
      'Retuning this club restyles its stamps everywhere, including ones already placed in a Game Log.',
    sides: true,
    fields: ['away', 'home'].flatMap((side) =>
      fieldsFrom('stamp', id, side, stampLogoTuningRecord(teamId, side)).map((f) => ({
        ...f,
        label: `${treatmentLabel(side)} ${STAMP_FIELD_SUFFIX[f.name]}`,
      })),
    ),
  })

  // The win-probability band's per-treatment tuning (issue #807) — the
  // record most tuned clubs actually carry, and the one the real chart reads
  // FIRST: wpaBandColors.js's WPA_TREATMENT_BAND_COLOR_OVERRIDES always wins
  // outright over the team-level fallback appended below, which is why a
  // drawer that only edited the fallback used to be inert for those clubs.
  // `band` is not `fieldsFrom`, like the mono group's `parts`: it is the one
  // non-scalar field here (a flat hex, or a pinstripe object), so its landed
  // text is a JSON string rather than `text()`'s `String(value)`. Rendered
  // with its own live preview (IdentityWpaPreview) and its own compound
  // control (IdentityWpaBandField) — see IdentityDrawer.jsx.
  {
    const dimension = isMilb ? 'milbWpaTreatment' : 'wpaTreatment'
    const layoutOverrides = isMilb ? MILB_WPA_LOGO_LAYOUT_OVERRIDES : WPA_LOGO_LAYOUT_OVERRIDES
    const bandOverrides = isMilb ? MILB_WPA_BAND_COLOR_OVERRIDES : WPA_TREATMENT_BAND_COLOR_OVERRIDES
    const wordmarkOverrides = isMilb ? MILB_WPA_WORDMARK_OVERRIDES : WPA_WORDMARK_OVERRIDES
    const record = {
      ...layoutOverrides[id]?.[treatment],
      wpaWordmark: wordmarkOverrides[id]?.[treatment],
      ...(isMilb ? null : { ownArt: WPA_OWN_ART[id]?.[treatment] }),
    }
    const band = bandOverrides[id]?.[treatment]
    const fields = fieldsFrom(dimension, id, treatment, record, [
      ...WPA_LAYOUT_FIELD_NAMES,
      'wpaWordmark',
      ...(isMilb ? [] : ['ownArt']),
    ])
    fields.push({
      id: identityFieldId(dimension, id, treatment, 'band'),
      name: 'band',
      label: FIELD_LABELS.band,
      spec: IDENTITY_DIMENSIONS[dimension].fields.band,
      landed: band !== undefined ? JSON.stringify(band) : '',
    })
    // The team-level fallback only ever reaches Main, and only for a club
    // with no per-treatment override of its own (wpaBandColor's own
    // two-tier chain) — offering it on every other tile would be exactly
    // the inert control this group exists to replace.
    if (!isMilb && treatment === 'main') {
      fields.push(...fieldsFrom('wpa', id, null, { bandColor: BAND_COLOR_OVERRIDES[id] }))
    }
    groups.push({
      key: 'wpa',
      title: `${treatmentLabel(treatment)} win-probability band`,
      wpa: true,
      fields,
    })
  }

  // The knockout (one-color) mark's hand-picked shape corrections — not
  // `fieldsFrom`, like the tile/logo groups above: `parts` is a shape-index
  // map, not a scalar, so its landed text is a JSON string rather than
  // `text()`'s `String(value)` (which would print "[object Object]").
  // Not per-treatment: a club has one mark. Rendered with its own component
  // (IdentityMonoField) rather than the generic Field boxes, same reason the
  // logo group gets one — see IdentityDrawer.jsx.
  {
    const mono = monoInkFor(teamId)
    const pinCount = mono?.parts ? Object.keys(mono.parts).length : 0
    groups.push({
      key: 'mono',
      title: 'Knockout mark',
      mono: true,
      fields: [
        {
          id: identityFieldId('mono', id, 'parts'),
          name: 'parts',
          label: 'Pinned shapes',
          spec: IDENTITY_DIMENSIONS.mono.fields.parts,
          landed: pinCount ? JSON.stringify(mono.parts) : '',
        },
        {
          id: identityFieldId('mono', id, 'source'),
          name: 'source',
          label: 'Source art',
          spec: IDENTITY_DIMENSIONS.mono.fields.source,
          landed: mono && mono.source !== 'base' ? mono.source : '',
        },
        {
          id: identityFieldId('mono', id, 'art'),
          name: 'art',
          label: 'Art fingerprint',
          spec: IDENTITY_DIMENSIONS.mono.fields.art,
          landed: mono?.art ?? '',
        },
      ],
    })
  }

  // The slate card's hover/press wash over this club's HOME ballpark photo
  // (06a-gamecard-parkart.css, src/lib/ballpark/parkWash.js). Not `fieldsFrom`, like
  // the logo group above it: the landed values are the app's own COMPUTED
  // defaults (the home tile colour, the app-wide 0.55 opacity), not a raw
  // store record — an override is this club's escape hatch on top of those,
  // the same relationship mainOverrideLogoUrl has to the plain CDN mark.
  groups.push({
    key: 'parkwash',
    title: 'Ballpark hover wash',
    preview: 'parkwash',
    fields: [
      {
        id: identityFieldId('parkWash', id, 'color'),
        name: 'color',
        label: 'Wash color',
        spec: IDENTITY_DIMENSIONS.parkWash.fields.color,
        landed: text(
          parkWashColorOverride(teamId) ?? tileColorFor(teamId, defaultHomeTreatmentFor(teamId) ?? 'main', 'home'),
        ),
      },
      {
        id: identityFieldId('parkWash', id, 'intensity'),
        name: 'intensity',
        label: 'Wash intensity',
        hint: '0 is invisible, 1 is a solid fill — the app ships 0.55.',
        spec: IDENTITY_DIMENSIONS.parkWash.fields.intensity,
        landed: text(parkWashIntensity(teamId)),
      },
    ],
  })

  return groups
}

// Every id this drawer can write for a club, across every treatment — not just
// the one on screen. The save posts all of them, because an id left OUT of the
// patch is left alone and an id sent EMPTY is cleared, so omitting the tiles the
// owner navigated away from would make clearing one impossible.
export function identityIdsForClub(teamId, isMilb) {
  const ids = new Set()
  for (const treatment of treatmentsForClub(teamId, isMilb)) {
    for (const group of identityGroups(teamId, { isMilb, treatment })) {
      for (const field of group.fields) ids.add(field.id)
    }
  }
  return [...ids]
}

// Why this club's draft cannot be saved, or null — the browser half of the
// contrast gate. It reads the resolvers WITH the draft's preview layer applied,
// so what it judges is the bar the page is showing right now, not a
// reconstruction of it. That is also why it needs no arguments beyond the club:
// the effective triad is already on screen.
//
// The endpoint runs the same check against the same threshold and is the answer
// that counts (api/identity.js). This one exists to refuse instantly, with the
// ratio, before a request — never to replace that one, and never to be relaxed
// so a save "gets through".
export function identityDraftRefusal(teamId, isMilb) {
  for (const treatment of treatmentsForClub(teamId, isMilb)) {
    const bar = barKeyFor(treatment, isMilb)
    const triad = isMilb
      ? MILB_HEADER_COLOR_OVERRIDES[String(teamId)]?.[bar]
      : treatmentHeaderColorOverride(teamId, treatment)
    const problem = headerTriadRefusal(triad)
    if (problem) return `${treatmentLabel(bar)} bar: ${problem}`
  }
  return null
}
