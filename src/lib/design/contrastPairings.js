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
  // --album-board) to 8.5:1 (--marker on --album-board).
  { fg: 'album-foil', bg: 'album-board', min: TEXT, note: 'stamp sheet pane title on the album board' },
  { fg: 'album-foil-soft', bg: 'album-board', min: TEXT, note: 'stamp caption on the album board' },
  { fg: 'marker', bg: 'album-board', min: UI, note: 'completed-set ring on the album board' },
  // The OVR card (src/components/ovr/) is drawn on the same board. A tier colour is
  // text on it (the "OVR" label, an arrow) and a fill under dark text (a bar's number
  // chip, the tier ribbon). The frame is the Legend tile's non-text ring.
  ...['bench', 'starter', 'regular', 'allstar', 'mvp', 'legend'].flatMap((t) => [
    { fg: `ovr-${t}`, bg: 'album-board', min: TEXT, note: `${t} tier colour as text on the album board` },
    { fg: 'text-heading', bg: `ovr-${t}`, min: TEXT, note: `ink on a ${t} number chip` },
  ]),
  { fg: 'ovr-frame', bg: 'album-board', min: UI, note: 'Legend tile frame on the album board' },
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
  // The jump bar's current count badge and the player page's position pill
  // (#1883): heading ink on the soft green tint.
  { fg: 'text-heading', bg: 'accent-tint', min: TEXT, note: 'jump-bar current count badge, position pill' },
  // --hold-texture (tokens/effects.css) weaves those same two stripes into the
  // "on hold" status tape — a rehab assignment, a postponed or delayed game, a
  // season record taped to the page. Its base stripe is --marker, asserted on
  // the line above; only the hatch stripe is new here. ADR-0083 moved that tape
  // off the kraft weave, so this pair replaces the seal-ink one that covered it.
  { fg: 'text-heading', bg: 'marker-deep', min: TEXT, note: 'on-hold tape text on the hatch stripe' },
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
  // --text-caption to 3.86:1 (the old season spray card's thin-chip count).
  // The Former Teammates Ladder's lines (#1352) carry meaning, so they are held
  // to the non-text bar (WCAG 1.4.11): the resting line, then the traced one.
  { fg: 'graphite-soft', bg: 'surface-card', min: UI, note: 'former teammates ladder line' },
  { fg: 'graphite-soft', bg: 'surface-inset', min: UI, note: 'empty at-bat diamond outline (#2213)' },
  { fg: 'accent-primary', bg: 'surface-card', min: UI, note: 'former teammates ladder traced line' },
  // The arsenal "other" family (#1347) drew on the Now Pitching card, whose
  // fill was --marker 16% over --surface-card (.notice--event, #1132 N7). Neither
  // reader parses color-mix(), so that composite is the literal #FAEED0,
  // worked out by hand. The card wears --surface-stamped-event now (ADR-0113);
  // this pair stays for the other users of .notice--event.
  { fg: 'arsenal-other', bg: '#FAEED0', min: UI, note: 'arsenal other family on the Now Pitching card fill' },
  { fg: 'arsenal-other', bg: 'surface-card', min: UI, note: 'arsenal other family on a raised card' },
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
  // THE SCORECARD LENS (ADR-0092, styles/scorecard/lens.css). The frontier
  // row's rail cell is the inset paper. Its surname (text-heading) and its
  // slot number and position (text-caption) are pairs already asserted above;
  // the uniform number's green on that paper is new.
  { fg: 'accent-positive', bg: 'surface-inset', min: TEXT, note: 'lens rail: frontier row uniform number' },
  // The turn chip on the sheet, and the bar's Turn button: paper ink on navy.
  // They were kraft before ADR-0092; the turn lifts no seal. The bar's other
  // pairs (line A, the situation, the dashed waiting pill, Unwrap's chip) are
  // asserted above: text-body, text-muted and text-caption on the raised card,
  // and text-on-seal on both stripes of the kraft.
  { fg: 'text-on-ink', bg: 'navy', min: TEXT, note: 'lens turn chip: paper ink on navy' },
  // The lens's new-pitcher notice (#724, L5, lens-cards.css) on the tier-1
  // notice ground, `color-mix(in srgb, var(--marker) 16%, var(--surface-card))`.
  // The checker does not parse color-mix(), so #FAEED0 is that mix by hand.
  // The Entering card's three inks on the inset paper are asserted above.
  { fg: 'text-heading', bg: '#FAEED0', min: TEXT, note: 'lens notice: label and name' },
  { fg: 'clay', bg: '#FAEED0', min: TEXT, note: 'lens notice: uniform number' },
  { fg: 'field', bg: '#FAEED0', min: TEXT, note: 'lens notice: throwing hand' },
  { fg: 'clay-deep', bg: '#FAEED0', min: TEXT, note: 'lens notice: the entry flag' },
  { fg: 'text-caption', bg: '#FAEED0', min: TEXT, note: 'lens notice: arsenal and last time out' },
  // The Notice's info tone (#1132; styles/system/notice.css, .notice--info), the
  // default for every Notice. #EBE8DD is `color-mix(in srgb, var(--navy) 7%,
  // var(--surface-card))` by hand: a change to that mix changes this hex. The
  // caption ink is the club records on the extra-innings line (N5).
  { fg: 'text-body', bg: '#EBE8DD', min: TEXT, note: 'notice info tone: label and sentence' },
  { fg: 'text-caption', bg: '#EBE8DD', min: TEXT, note: 'notice info tone: caption ink (the extras line\'s club records)' },
  // THE MATCHUP SCOUT (#1490, styles/scout/edge.css, pitches.css and meet.css). The
  // Edge ledger's tags and the lean name: clay for the hitter's side, the
  // All-Star blue for the pitcher's. The Meetings pitch calls: clay for a
  // strike, field green for a ball, the All-Star blue for a ball in play. All
  // on the card paper. The mix bars print paper ink on each family's colour;
  // the warm grey "other" segment prints no label (the legend names it).
  { fg: 'clay', bg: 'surface-card', min: TEXT, note: 'scout: hitter-side tag, strike call' },
  { fg: 'allstar-blue', bg: 'surface-card', min: TEXT, note: 'scout: pitcher-side tag, in-play call' },
  { fg: 'text-on-ink', bg: 'allstar-blue', min: TEXT, note: 'scout: meetings strike call tag' },
  { fg: 'field', bg: 'surface-card', min: TEXT, note: 'scout: ball call' },
  { fg: 'text-on-ink', bg: 'arsenal-fastball', min: TEXT, note: 'scout mix bar: fastball segment label' },
  { fg: 'text-on-ink', bg: 'arsenal-breaking', min: TEXT, note: 'scout mix bar: breaking segment label' },
  { fg: 'text-on-ink', bg: 'arsenal-offspeed', min: TEXT, note: 'scout mix bar: offspeed segment label' },
  // THE TEXT-ON-INK RUNGS (#1156): paper text on the dark fills it sits on.
  // The idlab bar mocks (a club-set bar) and .gamecard__atmark-ghost (a park
  // photo) have no token ground to pair.
  { fg: 'text-on-ink-bright', bg: 'ink-1', min: TEXT, note: 'game HUD and broadcast text on ink' },
  { fg: 'text-on-ink-bright', bg: 'ink-0', min: TEXT, note: 'bright paper text on the darkest ink' },
  { fg: 'text-on-ink-bright', bg: 'clay', min: TEXT, note: 'pitch list number, called strike' },
  { fg: 'text-on-ink-bright', bg: 'graphite', min: TEXT, note: 'pitch list number, foul' },
  { fg: 'text-on-ink-soft', bg: 'ink-0', min: TEXT, note: 'scorebook story tally and moments labels' },
  { fg: 'text-on-ink-soft', bg: 'ink-1', min: TEXT, note: 'about hero kicker on navy' },
  { fg: 'text-on-ink-dim', bg: 'ink-1', min: TEXT, note: 'umpire tendencies season and watch labels on navy' },
  { fg: 'text-on-ink-dim', bg: 'ink-0', min: TEXT, note: 'dim paper text on the darkest ink' },
  // THE STAMPED PARTS (#1882, system/stamped/stamped.css): the name tab, the
  // count tag, and the stat tile's three fills. The edge and the two shadows
  // are UI marks on the page they sit on.
  { fg: 'text-on-ink-cream', bg: 'surface-stamped-ink', min: TEXT, note: 'stamped card name tab; ink stat tile number' },
  { fg: 'text-on-ink-dim', bg: 'surface-stamped-ink', min: TEXT, note: 'ink stat tile label and caption' },
  { fg: 'text-heading', bg: 'surface-stamped-tint', min: TEXT, note: 'tint stat tile label and number' },
  { fg: 'text-muted', bg: 'surface-stamped-tint', min: TEXT, note: 'tint stat tile caption' },
  { fg: 'text-heading', bg: 'surface-card', min: TEXT, note: 'plain stat tile label and number' },
  { fg: 'text-caption', bg: 'surface-card', min: TEXT, note: 'plain stat tile caption' },
  { fg: 'text-heading', bg: 'bg-canvas', min: TEXT, note: 'stamped card count tag' },
  { fg: 'border-stamped', bg: 'bg-canvas', min: UI, note: 'stamped edge and shadow on the page' },
  { fg: 'border-stamped-soft', bg: 'bg-canvas', min: UI, note: 'soft stamped shadow under the ink tile' },
  // THE NOTIFICATION CARD (ADR-0113): one yellow ground for every card. 14.2:1,
  // 11.6:1, 7.2:1 and 4.58:1 as measured; the name tab is the cream-on-ink pair above.
  { fg: 'ink-0', bg: 'surface-stamped-event', min: TEXT, note: 'notification card name and figures' },
  { fg: 'ink-1', bg: 'surface-stamped-event', min: TEXT, note: 'notification card sentence' },
  { fg: 'ink-2', bg: 'surface-stamped-event', min: TEXT, note: 'notification card secondary line' },
  { fg: 'text-caption', bg: 'surface-stamped-event', min: TEXT, note: 'notification card caption (graphite)' },
  { fg: 'arsenal-other', bg: 'surface-stamped-event', min: UI, note: 'arsenal other family on the full Now Pitching card' },
  // THE ROW SURFACES (#2073): a table row under the pointer, and a picked row
  // (game logs, Firsts, Similar Players). The row's own text sits on them.
  // --accent-negative on a picked row is not paired: it is
  // 4.37:1 (--accent-negative on --surface-row-selected), under AA. A loss on a
  // picked row reads --clay-deep: 6.33:1 (--clay-deep on --surface-row-selected).
  { fg: 'text-heading', bg: 'surface-row-hover', min: TEXT, note: 'row under the pointer: heading ink' },
  { fg: 'text-body', bg: 'surface-row-hover', min: TEXT, note: 'row under the pointer: body text' },
  { fg: 'text-caption', bg: 'surface-row-hover', min: TEXT, note: 'row under the pointer: caption' },
  { fg: 'accent-positive', bg: 'surface-row-hover', min: TEXT, note: 'row under the pointer: a win' },
  { fg: 'accent-negative', bg: 'surface-row-hover', min: TEXT, note: 'row under the pointer: a loss' },
  { fg: 'text-heading', bg: 'surface-row-selected', min: TEXT, note: 'picked row: heading ink' },
  { fg: 'text-body', bg: 'surface-row-selected', min: TEXT, note: 'picked row: body text' },
  { fg: 'text-caption', bg: 'surface-row-selected', min: TEXT, note: 'picked row: caption' },
  { fg: 'accent-positive', bg: 'surface-row-selected', min: TEXT, note: 'picked row: a win' },
  { fg: 'clay-deep', bg: 'surface-row-selected', min: TEXT, note: 'picked row: a loss' },
]
