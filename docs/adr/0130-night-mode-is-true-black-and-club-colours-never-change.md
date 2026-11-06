# Night mode is true black, and club colours never change

**Status:** Accepted (Gary, 2026-11-06 interview). Not yet built: #2507.
**Date:** 2026-11-06

## Context

Issue #2507 asks for a dark theme, set in My Tally. The app is light only today. The colour
tokens have two tiers (ADR-0023): base colours (paper, ink, field, clay, seal) and semantic roles
on top (`--bg-canvas`, `--text-body`, `--accent-primary`, …). Night mode redefines the semantic
roles only.

We want Sonnet and Haiku sessions to do most of the build. So every judgment call is made here,
with exact values, and the build only follows this record.

## Decision

1. **Trigger.** Follow the phone (`prefers-color-scheme`) by default. My Tally gets an
   Appearance setting: Follow my system / Light / Dark, saved on the device, like Motion. The
   theme is set before first paint, so no light flash.
2. **True black.** Dark values for the semantic tier:

   | Role | Dark value | On `#000` | On `#121212` |
   |---|---|---|---|
   | `--bg-canvas` / `--bg-page` | `#000000` | – | – |
   | `--surface-card` | `#121212` | – | – |
   | raised surface (popover, modal, floating nav) | `#1C1C1C` | – | – |
   | `--text-heading` | `#F2F2F2` | 18.8 | 16.7 |
   | `--text-body` | `#E3E3E3` | 16.4 | 14.6 |
   | `--text-muted` | `#B3B3B3` | 10.0 | 8.9 |
   | `--text-caption` | `#8C8C8C` | 6.2 | 5.6 |
   | `--accent-positive` | `#5DB88A` | 8.7 | 7.8 |
   | `--accent-negative` | `#EB7A6C` | 7.5 | 6.7 |
   | `--border-rule` | `#3D3D3D` | (rule) | |

   Surfaces not listed (`--surface-inset`, row hover and selected, hairline, grid) step between
   these values. The prep session picks them and proves them with `scripts/check-contrast.mjs`.
3. **The brand colour inverts.** `--accent-primary` becomes near-white (`#F2F2F2`) and
   `--text-on-ink` becomes black. The house navy is 1.4:1 on black, so it cannot be the primary.
4. **The seal does not change.** Kraft `#B5824A` is 6.3:1 on black, and `--seal-ink` on it stays
   5.4:1. A sealed value still reads as sealed (ADR-0083).
5. **Club colours never change.** Identity is locked (ADR-0030): a club band, chip or banner is
   the same colour in both themes. In dark mode, a club-coloured band or chip gets a hairline
   border (`--border-rule`), so a dark club colour still shows its edge on black. Logos keep
   the ADR-0031 knockouts.
6. **Artwork stays, charts adapt.** Illustrations (the `--stage-*` ballpark, field diagrams)
   keep their colours. Chart chrome (axes, gridlines, labels, the heat-map slab) reads the
   semantic tokens, so it follows the theme. Data colours (pitch marks, `pitchMark()`, OVR
   tiers, batted-ball types) stay fixed. A review pass fixes any mark that vanishes on black,
   together with the pitch luminance audit (#2974).
7. **Pale tints become dark tints.** `--field-soft`, `--clay-soft`, `--award-soft`,
   `--field-wash`, `--surface-stamped-event` and the like become their hue at about 18% over
   black (`color-mix(in srgb, <hue> 18%, #000)`), with light text. Each value is worked out once
   as a literal, so the contrast checker can read it.
8. **Depth is a lighter surface plus a hairline**, not a shadow: cards `#121212`, raised layers
   `#1C1C1C`, each with a hairline border. This is done once in the `--shadow-*` tokens.
9. **Paper stays paper.** The Game Log passport pages, printable sheets, the preview poster and
   stamps stay light in both themes.
10. **The raw-colour cleanup never invents a colour.** About 520 hex values in 206 stylesheets
    (and about 160 in JS) are swapped for a semantic token only when one is a close match. A
    value with no close match is left alone and listed in the PR for a later pass.

## Consequences

- The work splits by judgment. Prep (one session) writes the dark token block, the in-between
  surface values and the both-theme contrast pairs. The setting and boot script are a Sonnet
  job. The cleanup is Haiku batches, checked by `check-raw-values.mjs`. A final visual check of
  the four scoring surfaces at 390 px in both themes is Gary's (or Opus's).
- `check-contrast.mjs` must test every pair in both themes.
- This replaces the "auto-lift club colours" line in the 2026-11-06 comment on #2507.
