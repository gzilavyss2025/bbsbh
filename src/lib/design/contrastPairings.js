// THE ENFORCED CONTRAST PAIRINGS — every text-on-background pair this app has
// promised meets WCAG 2.1 AA, as data.
//
// Extracted from scripts/check-contrast.mjs (issue #1112) so that the guard and
// /design-lab read the SAME list instead of two copies that drift. The guard
// still owns the enforcement: it resolves each token to a hex by walking
// tokens/*.css and fails the build on a miss. The lab resolves the same tokens
// live through getComputedStyle and prints the ratio beside the pair, so a
// reviewer sees what the guard is asserting rather than taking its word.
//
// `fg`/`bg` are token names (no `--` prefix) or a literal hex. A literal is
// always a composite precomputed by hand, because neither reader parses
// color-mix() or alpha — each one says so in the comment above it.
//
// Thresholds (WCAG 2.1 AA): normal text >= 4.5:1, large text / non-text UI >= 3:1.
// If you intentionally retune a color, update the hex until the guard passes.
// Do not loosen a threshold.

export const TEXT = 4.5 // normal-size body text
export const UI = 3.0 // large text / non-text UI affordance

export function toRgb(hex) {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (h.length > 6) h = h.slice(0, 6) // ignore any alpha byte
  const n = parseInt(h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// WCAG relative luminance + contrast ratio.
export function luminance(hex) {
  const [r, g, b] = toRgb(hex).map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function ratio(fg, bg) {
  const a = luminance(fg)
  const b = luminance(bg)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

// The enforced pairings. `fg`/`bg` are token names or literal hex.
export const PAIRINGS = [
  // Kraft seal cover: the sealed-cover ink over BOTH stripes of --seal-texture.
  { fg: 'seal-ink', bg: 'seal', min: TEXT, note: 'seal ink on kraft base stripe' },
  { fg: 'seal-ink', bg: 'seal-hatch', min: TEXT, note: 'seal ink on kraft hatch stripe' },
  // Injured-list tape: white banner text over BOTH stripes of --il-texture.
  { fg: '#FFFFFF', bg: 'clay', min: TEXT, note: 'white on IL clay base stripe' },
  { fg: '#FFFFFF', bg: 'clay-deep', min: TEXT, note: 'white on IL clay hatch stripe' },
  // Last 10 Games win stamp: knockout text/W-L letter over BOTH stripes of
  // --win-texture. The loss stamp reuses --il-texture, already asserted above.
  { fg: 'text-on-ink', bg: 'field', min: TEXT, note: 'knockout text on win stamp base stripe' },
  { fg: 'text-on-ink', bg: 'field-deep', min: TEXT, note: 'knockout text on win stamp hatch stripe' },
  // Last 10 Games home-game stub: seal-ink over the composite color
  // `color-mix(in srgb, var(--seal) 80%, transparent)` renders as against
  // --surface-card (the literal hex is that composite, precomputed by hand
  // since this checker doesn't parse color-mix()).
  { fg: 'seal-ink', bg: '#C3996A', min: TEXT, note: 'seal ink on Last 10 Games home-game stub' },
  // The three Game Log book boards a league-mark cover prints on, each carrying
  // the same paper foil (PassportCover.jsx stamps every line on the board in
  // --cover-foil). Held to the FULL 4.5:1 text bar rather than the 3:1 large-text
  // one the cover's own type would allow, because a board colour is picked once
  // and then worn by whatever the cover grows next.
  { fg: 'book-board-foil', bg: 'book-board-kraft', min: TEXT, note: 'book cover foil on the kraft board' },
  { fg: 'book-board-foil', bg: 'book-board-red', min: TEXT, note: 'book cover foil on the red board' },
  { fg: 'book-board-foil', bg: 'book-board-blue', min: TEXT, note: 'book cover foil on the blue board' },
  // The Game Log's stamp sheet prints its panes on a dark album board
  // (48c-stamp-sheet.css) — the one dark surface in the app, so every ink that
  // lands on it is asserted here rather than eyeballed. Both foils carry real
  // text (a pane's title and count, every stamp's caption). The highlighter
  // yellow is the completed-set ring, a non-text affordance, held to the 3:1
  // bar. It was the seal amber until ADR-0083 — a finished set is a highlight,
  // not a cover — which also took the ring from 4.2:1 (--seal-cover on
  // --album-board) to 8.4:1 (--marker on --album-board).
  { fg: 'album-foil', bg: 'album-board', min: TEXT, note: 'stamp sheet pane title on the album board' },
  { fg: 'album-foil-soft', bg: 'album-board', min: TEXT, note: 'stamp caption on the album board' },
  { fg: 'marker', bg: 'album-board', min: UI, note: 'completed-set ring on the album board' },
  // Core semantic text roles on their intended surfaces.
  { fg: 'text-body', bg: 'bg-canvas', min: TEXT, note: 'body text on app canvas' },
  { fg: 'text-heading', bg: 'surface-card', min: TEXT, note: 'heading on raised card' },
  { fg: 'text-muted', bg: 'surface-card', min: TEXT, note: 'muted text on raised card' },
  { fg: 'text-caption', bg: 'bg-page', min: TEXT, note: 'caption/graphite on page' },
  { fg: 'text-on-ink', bg: 'accent-primary', min: TEXT, note: 'inverse text on ink chip' },
  // THE PILL (#1131, styles/system/pill.css). An outline pill is see-through,
  // so its ink sits on whatever paper the card or the page is — both are
  // asserted, for every ink a pill is passed today. A paper pill's text sits
  // on --surface-card. The ink and seal fills are the two pairs just above and
  // the seal cover's first pair. A new `ink` a caller passes belongs here.
  { fg: 'text-muted', bg: 'bg-page', min: TEXT, note: 'pill outline, no ink, on page' },
  { fg: 'field', bg: 'surface-card', min: TEXT, note: 'pill ink --field on card' },
  { fg: 'field', bg: 'bg-page', min: TEXT, note: 'pill ink --field on page' },
  { fg: 'accent-primary', bg: 'bg-page', min: TEXT, note: 'pill ink --accent-primary on page' },
  { fg: 'clay', bg: 'surface-card', min: TEXT, note: 'pill ink --clay on card' },
  { fg: 'clay', bg: 'bg-page', min: TEXT, note: 'pill ink --clay on page' },
  { fg: 'text-body', bg: 'surface-card', min: TEXT, note: 'pill paper fill text' },
  // A pressed paper control's paper edge, against a navy club bar (the
  // Brewers' bar is the house navy). A non-text edge, so the 3:1 bar.
  { fg: 'surface-card', bg: 'navy', min: UI, note: 'pressed paper pill edge on a navy bar' },
  // THE PILL'S TINTS AND INSET CHIPS (#1131 slice 2). A tint sets the pill's
  // fill and ink as a pair, so each pair a host passes is asserted here. The
  // pairs already on this list elsewhere are not repeated: --field-deep on
  // --field-soft, --text-body on --surface-inset, --text-on-ink on
  // --award-ink, the four scenario fills, and --text-caption on the canvas
  // (--bg-page is --bg-canvas). Two tags take a club's colour and are not
  // token pairs: the win-probability chip (the club's own chip triad) and the
  // team hub's level tag (the hero's --ink, a mix of itself behind it).
  { fg: 'clay-deep', bg: 'clay-soft', min: TEXT, note: 'pill tint: clay (wrong call, Top 100 rank, out, down arm)' },
  { fg: 'field', bg: 'field-soft', min: TEXT, note: 'pill tint: the right call' },
  { fg: 'award-ink', bg: 'award-soft', min: TEXT, note: 'pill tint: award (standout night, limited arm)' },
  { fg: 'ink-0', bg: 'marker', min: TEXT, note: 'pill tint: --marker as a FILL (outlier night)' },
  { fg: 'text-muted', bg: 'surface-inset', min: TEXT, note: 'inset pill: a level tag' },
  { fg: 'text-caption', bg: 'surface-inset', min: TEXT, note: 'inset pill: routine night, rehab tag, a reason' },
  { fg: 'accent-primary', bg: 'surface-inset', min: TEXT, note: 'inset pill: the row-share reason' },
  // The slate result card's scenario pills (GameResultFace.jsx's
  // SCENARIO_STYLE) — each filled solid in its own accent, so the fg/bg pair
  // (and which text color a given accent needs) is asserted here rather than
  // left to eyeball: field/clay/allstar-blue are dark/saturated enough for
  // light on-ink text, but marker (Close Game) is a bright highlighter
  // yellow — reversed, dark heading-ink text is what holds AA against IT.
  { fg: 'text-on-ink', bg: 'field', min: TEXT, note: 'Dominant Performance pill text' },
  { fg: 'text-on-ink', bg: 'clay', min: TEXT, note: 'Blowout pill text' },
  { fg: 'text-heading', bg: 'marker', min: TEXT, note: 'Close Game pill text' },
  // --hold-texture (tokens/effects.css) weaves those same two stripes into the
  // "on hold" status tape — a rehab assignment, a postponed or delayed game, a
  // season record taped to the page. Its base stripe is --marker, asserted on
  // the line above; only the hatch stripe is new here. ADR-0083 moved that tape
  // off the kraft weave, so this pair replaces the seal-ink one that covered it.
  { fg: 'text-heading', bg: 'marker-deep', min: TEXT, note: 'on-hold tape text on the hatch stripe' },
  { fg: 'text-on-ink', bg: 'allstar-blue', min: TEXT, note: 'Extra Innings pill text' },
  // The crown outranks all four and carries its own medal-amber fill on the
  // card pill (.flipback__pill--crown). The filter chip that selects it
  // (FILTER_CHIPS, src/lib/resultCards.js) wears the same amber only as its
  // tint and edge; a pressed chip is the Pill's navy (#1131 slice 4).
  { fg: 'text-on-ink', bg: 'award-ink', min: TEXT, note: 'Game of the Night crown pill text' },
  // Stamp In's row action, in both states (ADR-0042): a soft neutral until you
  // press it, field green once you hold that stamp. The green pair is the same
  // one the win stamp already asserts above; the neutral pair is asserted here
  // rather than assumed, because --surface-inset is the lightest paper in the
  // system and a later nudge to either token is exactly the kind of change
  // nothing else would catch.
  { fg: 'text-body', bg: 'surface-inset', min: TEXT, note: 'Stamp In row action, unpressed' },
  { fg: 'text-on-ink', bg: 'accent-positive', min: TEXT, note: 'Stamp In row action, stamped' },
  // The standings clinch mark (ClinchMark.jsx): a one-character chip, filled
  // green for the four letters MLB ships and clay for a club that is out.
  // Asserted on its own rather than leaning on the pairs above, because it is
  // the smallest text this palette carries — one mono character at 11px — so a
  // later nudge to either accent has less margin here than anywhere else.
  { fg: 'text-on-ink', bg: 'accent-positive', min: TEXT, note: 'standings clinch mark' },
  { fg: 'text-on-ink', bg: 'accent-negative', min: TEXT, note: 'standings eliminated mark' },
  // The slate's Scores Unlocked live band: run totals (heading ink) and the
  // centered state token (muted ink) over the field-green wash.
  { fg: 'text-heading', bg: 'field-soft', min: TEXT, note: 'live score band numerals' },
  { fg: 'text-muted', bg: 'field-soft', min: TEXT, note: 'live score band state token' },
  // The band's hover mow stripe: `color-mix(in srgb, var(--field) 10%,
  // transparent)` over --field-soft — precomputed by hand like the Last 10
  // Games stub above, since this checker doesn't parse color-mix().
  { fg: 'text-heading', bg: '#D1E0D3', min: TEXT, note: 'live band numerals on hover mow stripe' },
  { fg: 'text-muted', bg: '#D1E0D3', min: TEXT, note: 'live band state token on hover mow stripe' },
  // Link / text-button ink, on each of the three grounds it lands on: the app
  // canvas, a page, and a raised card. Held to the full text bar because these
  // run SMALL — "See all ›" and the "more" affordance are --fs-label caps (#1128).
  { fg: 'accent-link', bg: 'bg-canvas', min: TEXT, note: 'link text on app canvas' },
  { fg: 'accent-link', bg: 'bg-page', min: TEXT, note: 'link text on page' },
  { fg: 'accent-link', bg: 'surface-card', min: TEXT, note: 'link text on raised card' },
  // The run value board's diverging pair, on each of the two grounds it lands
  // on: the board rows sit on --bg-page, the two cards on --surface-card. The
  // POSITIVE half is already covered three lines up (--accent-positive and
  // --accent-link are both --field), so only the clay half is new — and it is
  // the one worth pinning, since a red that reads fine on the manila canvas is
  // the classic thing to lose when a paper token is retuned.
  { fg: 'accent-negative', bg: 'bg-page', min: TEXT, note: 'run value, runs given back, on a board row' },
  { fg: 'accent-negative', bg: 'surface-card', min: TEXT, note: 'run value, runs given back, on a card' },
  // Non-text UI: the focus ring must stay visible against the canvas.
  { fg: 'focus-ring', bg: 'bg-canvas', min: UI, note: 'focus ring on app canvas' },
  // ---- The button (styles/system/button.css, #1130) ----
  // Every skin's label against its OWN fill, at rest and under a pointer — the
  // two fills a skin has. Selected is ink on navy for every skin, asserted
  // above as 'inverse text on ink chip'. Disabled is exempt (WCAG 1.4.3 does
  // not cover an inactive control) and dims by --opacity-disabled rather than
  // by a colour, so it has no pair to assert. The outline and ghost hover fill
  // is --surface-inset, whose pair with --text-body is the Stamp In row above.
  // Ghost at rest has no fill of its own: it lands on the canvas (asserted
  // above as body text on app canvas) or on a card (the outline pair here).
  { fg: 'text-body', bg: 'surface-card', min: TEXT, note: 'button, outline skin at rest (and ghost on a card)' },
  { fg: 'text-on-ink', bg: 'accent-primary-hover', min: TEXT, note: 'button, ink skin under a pointer' },
  { fg: 'text-on-ink', bg: 'accent-negative', min: TEXT, note: 'button, danger skin at rest' },
  { fg: 'text-on-ink', bg: 'accent-negative-hover', min: TEXT, note: 'button, danger skin under a pointer' },
  { fg: 'text-on-seal', bg: 'seal-cover', min: TEXT, note: 'button, seal skin at rest (the mint strip)' },
  { fg: 'text-on-seal', bg: 'seal-hatch', min: TEXT, note: 'button, seal skin under a pointer' },
  // The outline's hover edge: the one part of a hovered outline that changes
  // besides its fill, so it must read as a change against the card it sits on.
  { fg: 'text-caption', bg: 'surface-card', min: UI, note: 'button, outline hover edge on a card' },
  // The focus ring is an outline OFF the box, so it lands on whatever the
  // button sits on — the canvas (asserted above) or a card.
  { fg: 'focus-ring', bg: 'surface-card', min: UI, note: 'focus ring on a raised card' },
  // The band ring (#1215): on a coloured band the ring is a paper outline with
  // an ink halo. Each ring colour against the other, and the paper ring on the
  // house navy masthead. A club's bar is not a token; every landed bar and
  // hero tile is checked in test/band-focus-ring.test.js.
  { fg: 'focus-ring-band', bg: 'focus-ring-band-halo', min: UI, note: 'band focus ring, paper against its ink halo' },
  { fg: 'focus-ring-band', bg: 'navy', min: UI, note: 'band focus ring on the house navy masthead' },
  // A pinned pairing earns its place here for one of two failure classes this
  // checker cannot see on its own, since it only ever compares TOKENS: a token
  // used in a new role nobody asserted before, or an ALPHA laid over an
  // otherwise-correct pairing, which composites the effective color below the
  // threshold without moving the token's own hex at all. Real shipped example
  // of the second: `opacity: .85` on a grayed split chip's count took
  // --text-caption to 3.86:1 (see "spray thin-chip split count" below).
  //
  // ---- The season spray map (73-spray-map.css) ----
  // Everything below was found by a design review, not by this file, and that
  // is the reason it is here now: all three defects were ALPHAS applied on top
  // of a token, and an alpha is precisely what this checker cannot see. Each
  // composite is precomputed by hand, the same way the color-mix() pairs above
  // are, and named so a retune of the underlying token fails here first.
  //
  // The direction bar's three segments, on the card they sit on. One ink at
  // three alphas put the lightest at 2.44:1; these are three real tokens.
  // --graphite-soft is the thinnest margin in this group at 3.06:1 — it is a
  // LINE token, fine as a chart region at the 3:1 bar and NOT fine as small
  // text, which is the distinction that put it here rather than in a color rule.
  { fg: 'navy', bg: 'surface-card', min: UI, note: 'spray direction bar, pull segment' },
  { fg: 'graphite', bg: 'surface-card', min: UI, note: 'spray direction bar, center segment' },
  { fg: 'graphite-soft', bg: 'surface-card', min: UI, note: 'spray direction bar, oppo segment' },
  // Adjacent segments are only 1.6-2.5:1 against each other — unavoidable in a
  // monotone ramp — so a paper hairline carries every boundary instead.
  { fg: 'surface-inset', bg: 'navy', min: UI, note: 'spray direction bar hairline, against pull' },
  { fg: 'surface-inset', bg: 'graphite', min: UI, note: 'spray direction bar hairline, against center' },
  { fg: 'surface-inset', bg: 'graphite-soft', min: UI, note: 'spray direction bar hairline, against oppo' },
  // The chip count on a THIN (grayed) split chip. It carried opacity .85 on top
  // of --text-caption and composited to 3.86:1; at full strength it is 5.31:1.
  // Held to the text bar, not the UI one — it is an 11px figure.
  { fg: 'text-caption', bg: 'surface-card', min: TEXT, note: 'spray thin-chip split count' },
  // The home-run diamond over the heat layer. The heat is a BLURRED field, so it
  // renders every luminance between its palest and darkest band, and medal amber
  // cannot hold 3:1 across all of that from one side. Three pairings pin the two
  // ends and the ring that spans the middle. The two fills are the ramp's
  // extremes composited over --surface-card by hand: --award-line at .22 and
  // --clay-deep at .70 (73-spray-map.css's .spray__cell--1 / --5).
  { fg: 'award-ink', bg: '#F0E2C3', min: UI, note: 'spray HR diamond on the palest heat' },
  { fg: 'surface-inset', bg: '#AF6E64', min: UI, note: 'spray HR diamond ring on the hottest heat' },
  // The load-bearing one: the ring is an opaque paper band, so it — not the
  // heat — is the diamond's adjacent colour wherever the mark lands.
  { fg: 'award-ink', bg: 'surface-inset', min: UI, note: 'spray HR diamond against its own paper ring' },
  // A navy dot needs no ring; it clears the hottest fill on its own.
  { fg: 'navy', bg: '#AF6E64', min: UI, note: 'spray hit dot on the hottest heat' },
  // Trade Deadline's cash-consideration icon frame — the positive/acquired
  // green tint (TradeCard.jsx's ConsiderationRow, tone="cash").
  { fg: 'field-deep', bg: 'field-soft', min: TEXT, note: 'Trade Deadline cash consideration icon' },
  // The broadcast report package (styles/68-around-the-game.css). Its
  // masthead is the one surface in the app that sets text on the seam red
  // rather than on paper or on ink, and the strand chip's knockout is the pair
  // that has to hold — 5.05:1, which is real but is the thinnest margin in
  // this table, so a future nudge to --clay must be re-checked here first.
  { fg: 'paper-2', bg: 'clay', min: TEXT, note: 'report masthead strand chip' },
  { fg: 'paper-3', bg: 'navy', min: TEXT, note: 'report masthead title on the ink slab' },

  // The player page's Pitches card — an ink slab (tokens/colors.css's --heat-*).
  // Every ink that carries TEXT on it is here: the pitch names, the four family
  // labels, and the per-pitch share figures, which are inked to match their own
  // bar rather than the body ink.
  { fg: 'heat-ink', bg: 'heat-slab', min: TEXT, note: 'pitch name / velocity on the heat slab' },
  { fg: 'heat-fastball', bg: 'heat-slab', min: TEXT, note: 'fastball family label + share on the heat slab' },
  { fg: 'heat-breaking', bg: 'heat-slab', min: TEXT, note: 'breaking family label + share on the heat slab' },
  { fg: 'heat-offspeed', bg: 'heat-slab', min: TEXT, note: 'offspeed family label + share on the heat slab' },
  { fg: 'heat-other', bg: 'heat-slab', min: TEXT, note: 'other family label + share on the heat slab' },
  { fg: 'heat-band-ink', bg: 'heat-band', min: TEXT, note: '100 mph band figures on the band' },
  { fg: 'clay-deep', bg: 'surface-card', min: TEXT, note: 'rundown card eyebrow' },

  // THE SLATE'S FILTER CHIPS AS PILL CONTROLS (#1131 slice 4). Each chip is a
  // host tint: heading ink on its scenario accent mixed into the page, 16% at
  // rest and 28% under the pointer (22-box-score-tables.css). The checker does
  // not parse color-mix(), so each mix is its sRGB result on --bg-page
  // (#F6EFDC), one pair per accent in FILTER_CHIPS. A pressed chip is the
  // Pill's navy, the ink-chip pair above. Every other pair this slice's
  // controls draw is on the list already.
  { fg: 'text-heading', bg: '#E5D7BE', min: TEXT, note: 'slate filter chip at rest: crown (award-ink 16%)' },
  { fg: 'text-heading', bg: '#D8C5A7', min: TEXT, note: 'slate filter chip on hover: crown (award-ink 28%)' },
  { fg: 'text-heading', bg: '#D6DAC5', min: TEXT, note: 'slate filter chip at rest: dominant (field 16%)' },
  { fg: 'text-heading', bg: '#BECBB5', min: TEXT, note: 'slate filter chip on hover: dominant (field 28%)' },
  { fg: 'text-heading', bg: '#EBD4C2', min: TEXT, note: 'slate filter chip at rest: blowout (clay 16%)' },
  { fg: 'text-heading', bg: '#E4BFAF', min: TEXT, note: 'slate filter chip on hover: blowout (clay 28%)' },
  { fg: 'text-heading', bg: '#F4E8C3', min: TEXT, note: 'slate filter chip at rest: close game (marker 16%)' },
  { fg: 'text-heading', bg: '#F2E3B0', min: TEXT, note: 'slate filter chip on hover: close game (marker 28%)' },
  { fg: 'text-heading', bg: '#D3D5D0', min: TEXT, note: 'slate filter chip at rest: extra innings (allstar-blue 16%)' },
  { fg: 'text-heading', bg: '#B9C2C6', min: TEXT, note: 'slate filter chip on hover: extra innings (allstar-blue 28%)' },
  // THE BAND CONTROLS (#1131 slice 5). The Postseason Odds and Stamp In pill
  // on a club-themed card band is a paper chip tinted through the pill's own
  // properties (09-team-info.css): heading ink on paper at rest (asserted
  // above as 'heading on raised card') and on the inset paper under a
  // pointer, new here. On a plain band it is the ink pill, whose two pairs are
  // above. The situational records rail re-inks the Button for its navy band
  // (66-situational-records.css): paper ink on the navy at rest (the ink-chip
  // pair above), and on a 16% paper wash under a pointer. The checker does not
  // parse color-mix(), so that wash is its sRGB result on --accent-primary
  // (#1B2A3A). The rail's paper focus ring is the ink-chip pair too.
  { fg: 'text-heading', bg: 'surface-inset', min: TEXT, note: 'band pill on a themed club band, under a pointer' },
  { fg: 'text-on-ink', bg: '#3F4B56', min: TEXT, note: 'records rail jump link on navy, under a pointer (text-on-ink 16%)' },
]
