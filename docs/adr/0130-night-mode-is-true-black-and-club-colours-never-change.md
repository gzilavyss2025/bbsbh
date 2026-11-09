# Night mode is true black, and club colours never change

**Status:** Accepted (Gary, 2026-11-06 interview). The colour layer is built (#2507); the Appearance setting and the hex cleanup are separate parts.
**Date:** 2026-11-06
**Amended:** 2026-11-09 by ADR-0131. A dark device no longer turns night mode on by itself; a bar offers it.

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
10. **The raw-colour cleanup never invents a colour.** `check-raw-values.mjs` counts 17 hex
    declarations in `src/styles/` (145 more carry `raw-value-exempt`: stamp art and the like),
    plus about 68 raw `rgba()` values, most of them shadows. A value is swapped for a token only
    when one is a close match. A value with no close match is left alone and listed in the PR.
11. **The dark block redefines the base tier too, one value per token.** About 860 rules read a
    base colour (`--ink-0`, `--navy`, `--clay`, `--marker`, …) and not a role, so a role-only
    remap would leave them light. Paper is almost never read directly (about 18 uses). So the
    dark block gives each base token one dark value, and no rule is edited:

    | Base token | In dark mode | Why |
    |---|---|---|
    | `--ink-*`, `--navy` | light (the text values in item 2) | ink drawn as text, bars, ticks and heat cells turns light on black |
    | `--marker`, `--award-line`, `--field-mint`, `--graphite-soft` | unchanged | 12.5, 8.1, 9.8 and 6.3:1 on black |
    | `--clay`, `--clay-deep`, `--field`, `--field-deep`, `--graphite`, `--award-ink`, `--allstar-blue*` | lightened in hue to at least 4.5:1 on black (clay to `#EB7A6C`, field to `#5DB88A`) | today 2.5 to 3.9:1 on black |
    | `--*-soft`, `--field-wash`, `--surface-stamped-event` | dark tints (item 7) | |
    | `--paper-*` | the dark surfaces in item 2 | |
    | `--text-on-ink*` | dark | it sits on ink, which is now light |

    Inverting is right for data marks (chart bars, ticks, heat cells), selected states and small
    tags. **Five large bands do not invert**: `.inhead` (`gameview/inning-head.css`), `.psboard`
    (`postseason/home.css`), `.bcast` (`68-around-the-game.css`), `.seasonseries__round`
    (`44-pre-game-cards.css`) and `.gdnext-band` (`gameday-next/page.css`). They read a new role,
    `--surface-band` (navy in light mode, `#1C1C1C` with a hairline in dark), with `--text-on-band`
    (light in both themes).

    **Club bars must set their own text colour.** Some club bars fall back to `--text-on-ink`
    (`var(--bar-text, var(--text-on-ink))`). In dark mode that fallback turns dark. Every club
    bar sets `--bar-text` from the hand-tuned triad (ADR-0030), or reads `--text-on-band`.
12. **How the theme is applied.** `<html data-theme="dark">` or `data-theme="light"` forces a
    theme. With no attribute, `@media (prefers-color-scheme: dark)` decides. A subtree with the
    class `theme-paper` (passport pages, print sheets, the preview poster, stamps) puts the light
    values back. `check-contrast.mjs` resolves the dark block as a second pass and checks every
    pair in both themes.

## Consequences

- Because the base tier flips per token (item 11), no sweep of the 860 rules is needed. The
  work is: the dark token block, `--surface-band` and the contrast pass (Sonnet); the setting
  and the boot script (Sonnet, in parallel); the 17 raw hex values and dark-mode screenshots
  (Haiku). A final visual check of the four scoring surfaces at 390 px in both themes is
  Gary's.
- `check-contrast.mjs` must test every pair in both themes.
- This replaces the "auto-lift club colours" line in the 2026-11-06 comment on #2507.

## Amendment, 2026-11-06 (the colour layer's build)

- **`--text-on-bright`** (`#0F1822`, both themes). Items 2 and 11 keep `--marker`, `--award-line` and the
  OVR tier colours unchanged while ink inverts, so ink text on those fills turned light (1.5:1 on
  `--marker`). Rules that put text on one of them read this role, and the contrast pairings name it.
- **`--surface-event-wash`** is the event Notice's marker-at-16% wash as a role, with the dark tint at night.
- The five large bands keep the light values for their whole subtree (the light block's selector list),
  not only their own fill, so their inner ink rows and `--text-on-ink*` text do not invert.
- A club band with no triad falls back to `--surface-band` and `--text-on-band`.
- **`--surface-band-deep`** (the darkest ink in light, `#1C1C1C` at night) is the fill of `.inhead` and `.gdnext-band`, which were the darkest ink before night mode; the other three bands read `--surface-band`. All five take a 1px `--band-hairline` outline at night.
