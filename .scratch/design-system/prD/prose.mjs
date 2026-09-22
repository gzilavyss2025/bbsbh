// Every comment in src/styles/ that described a rule this sweep repainted.
// A stale comment claiming kraft on a rule that now paints ink or marker is
// worse than none, so each one is rewritten rather than deleted.
//   node .scratch/design-system/prD/prose.mjs
import fs from 'node:fs'

// [file, old, new]
const EDITS = [
  ['06-loader-and-cards.css',
`   .gamecard__live above (the two are mutually exclusive), but in the kraft-
   amber "on hold" color rather than live-game red. Flat fill, not the hatch
   weave (--seal-texture) the spoiler covers use, so it doesn't read as a seal. */`,
`   .gamecard__live above (the two are mutually exclusive), but in the
   highlighter "on hold" color rather than live-game red. A delayed game is a
   FLAG, not a cover: it wore kraft until ADR-0083, and amber on a slate card
   no tap will ever lift was the widest read of --seal outside a SealBox.
   --text-heading is what holds AA on marker (10.5:1). */`],

  ['06-loader-and-cards.css',
`   kraft-tape strip under the matchup: a rubber-stamped POSTPONED, the cause,`,
`   highlighted strip under the matchup: a rubber-stamped POSTPONED, the cause,`],

  ['06-loader-and-cards.css',
`  /* A faint wash of the kraft-seal amber rather than a full fill, edged with the
     same hatch color as a dashed tape line — reads as "held" without shouting a
     sealed cover. */`,
`  /* A faint highlighter wash rather than a full fill, edged with a dashed
     rule — reads as "held" without shouting. The 16% marker wash is the app's
     own highlighter recipe (12-sealbox.css, 14-strike-zone.css). */`],

  ['06-loader-and-cards.css',
`     after the tape appears. */`,
`     after the wash appears. */`],

  ['08a-site-menu.css',
`   rules it out. The amber survives as the RULE rather than the ink, which is
   the more literal reading of the metaphor anyway — a kraft tab stuck to the
   edge of a page, with the section named beside it in pencil. */`,
`   rules it out. Nor is the RULE kraft any longer — ADR-0083 reserved that
   colour for surfaces where a reveal is possible, and a directory heading is
   not one. Navy ink carries the tab instead, with the section named beside it
   in pencil. */`],

  ['08a-site-menu.css',
`   explains. Kraft-amber like a seal, because it is the same gesture: a thing
   laid ON the page rather than part of the scorebook printed underneath.
   Carries no game data and never sits inside a SealBox, so an unrevealed
   reader can still reach it. */`,
`   explains. Navy-inked rather than kraft (ADR-0083): it is a thing laid ON
   the page rather than part of the scorebook printed underneath, but nothing
   about it is sealed. Carries no game data and never sits inside a SealBox,
   so an unrevealed reader can still reach it. */`],

  ['09-team-info.css',
`   surface + rule color, with only the icon tinted kraft as a small tap hint.
   Tapping it open switches to the kraft fill, same look the tier glyph uses
   for its own open state. */`,
`   surface + rule color, with only the icon tinted in the action green as a
   small tap hint. Tapping it open switches to an ink fill, same look the tier
   glyph uses for its own open state. Both were kraft until ADR-0083. */`],

  ['10-lineup.css',
`   Colour here is load-bearing, not decorative. Kraft gold as TEXT on the bar
   measures 4.35:1, under the 4.5:1 check-contrast.mjs demands — so neither
   state paints gold text. Both states are FILLED pills instead of
   filled-vs-outline: the bar is club-themed (ADR-0030), so a transparent pill
   inherits a different backdrop for all 30 clubs, while a paper fill is the
   same chip everywhere and matches the card rows beneath it. Measured:
   OFF text 13.5:1, ON text 5.4:1, and each pill clears 3:1 against the bar
   (14.2:1 and 4.6:1 on the darkest club bar).

   The catch of filling both: paper and kraft separate by only 3.11:1, which
   only just clears the 3:1 a non-text state cue needs, and hue alone is a poor
   state signal anyway. So the dot carries the state by SHAPE as well — a
   hollow ring when off, filled when on — leaving three redundant cues
   (aria-pressed, fill colour, dot shape). Don't collapse the dot back to an
   opacity change. */`,
`   Colour here is load-bearing, not decorative. Neither state paints gold
   text: kraft gold on the bar measured 4.35:1, under the 4.5:1
   check-contrast.mjs demands, and the pill left the kraft family entirely in
   ADR-0083 — a switch is not a seal. Both states are FILLED pills instead of
   filled-vs-outline: the bar is club-themed (ADR-0030), so a transparent pill
   inherits a different backdrop for all 30 clubs, while a paper fill is the
   same chip everywhere and matches the card rows beneath it.

   THE BORDER is what carries the state now. Highlighter yellow separates from
   paper by only 1.58:1 — worse than the kraft it replaced (3.11:1) — so the ON
   pill takes a --text-heading edge against the OFF pill's --border-rule one,
   a separation no club bar can wash out. Measured: OFF text 13.5:1, ON text
   10.5:1 (the pair the Close Game pill already asserts), and each pill clears
   3:1 against the bar — the yellow better than the kraft did, at 8.6:1 on
   navy. The dot carries the state by SHAPE as well — a hollow ring when off,
   filled when on — leaving four redundant cues (aria-pressed, border colour,
   fill colour, dot shape). Don't collapse the dot back to an
   opacity change. */`],

  ['11-innings.css',
`/* Extra-innings team-record banner (see ExtrasBanner) — a slim, kraft-tinted
   strip above the reading pane on any extra-inning page, reading each club's`,
`/* Extra-innings team-record banner (see ExtrasBanner) — a slim, ruled
   strip above the reading pane on any extra-inning page, reading each club's`],

  ['12-sealbox.css',
`   kraft/seal-amber notification card (the app's attention color for
   "something just happened," same family as the seal cover), since a`,
`   highlighted notification card (the app's attention color for
   "something just happened" — the seal's own family until ADR-0083), since a`],

  ['12-sealbox.css',
`/* The self-contained seal-amber notification card — the pre-pitch staging`,
`/* The self-contained highlighted notification card — the pre-pitch staging`],

  ['13-play-by-play.css',
`/* Kraft-tape brown strike lane, echoing the seal covers. */`,
`/* Shaded strike lane against the light ball lane above — pencil, not tape.
   It echoed the seal covers until ADR-0083: it was the one place in the
   innings view a reader met kraft on something no tap would lift. */`],

  ['13-play-by-play.css',
`   set off a touch louder than a baserunning subnote with the kraft-amber seal
   accent and a small star, so a "leads the club in walks" note catches the eye`,
`   set off a touch louder than a baserunning subnote with an ink rail
   and a small star, so a "leads the club in walks" note catches the eye`],

  ['16-identity-lab-shell.css',
`/* One rotated strip of kraft tape holding the card down — the same material
   language as the taped rack tag: things being worked on are taped. */`,
`/* One rotated strip of tape holding the card down — the same material
   language as the taped rack tag: things being worked on are taped. The weave
   is --hold-texture, not the cover's own --seal-texture (ADR-0083). */`],

  ['17-identity-lab-workbench.css',
`/* Taped to the bench — the same kraft corner the style card wears. */`,
`/* Taped to the bench — the same corner the style card wears (--hold-texture). */`],

  ['17-identity-lab-workbench.css',
`/* A torn-off scrap of kraft confirming an action, beside the thing acted on`,
`/* A torn-off scrap of tape confirming an action, beside the thing acted on`],

  ['21-box-score.css',
`   no usable poster it collapses to the same kraft pill the innings view's
   per-play button uses (.pbp__hlbtn), so a missing or broken image costs the
   affordance nothing.

   Both live inside the box score's seal, like the rest of this card. */`,
`   no usable poster it collapses to the same ink pill the innings view's
   per-play button uses (.pbp__hlbtn), so a missing or broken image costs the
   affordance nothing.

   Both live inside the box score's seal — but sitting behind a cover is not
   the same as being one, so neither wears the cover's colour (ADR-0083). */`],

  ['21-box-score.css',
`/* Over a photo the badge needs its own ground to stay legible — the same
   kraft chip the pill form is, floated onto the frame. */`,
`/* Over a photo the badge needs its own ground to stay legible — the same
   ink chip the pill form is, floated onto the frame. */`],

  ['27-player-position-innings.css',
`/* ---- rehab-assignment banner — an actual strip of kraft-amber tape: the same
   diagonal-hatch weave (--seal-texture) as the spoiler seals and the reveal
   button, so a player's status reads as tape stuck onto the scorebook page. The
   "on hold / passing through the minors" counterpart to the clay injured-list
   tape and the celebratory blue All-Star tape. --seal-ink is tuned to hold AA
   against both kraft hatch stripes. ---- */`,
`/* ---- rehab-assignment banner — an actual strip of tape: the same
   diagonal-hatch weave as the injured-list and All-Star tapes, so a player's
   status reads as tape stuck onto the scorebook page. The
   "on hold / passing through the minors" counterpart to the clay injured-list
   tape and the celebratory blue All-Star tape. It wove in kraft until
   ADR-0083 reserved that colour for a surface a tap can lift; --hold-texture
   keeps the weave and the family and drops the false promise. --text-heading
   holds AA against both of its stripes. ---- */`],

  ['27-player-position-innings.css',
`/* ---- game-status banner — flat kraft-amber strip flagging a delayed,
   suspended, or postponed game, shown under the masthead on every section so
   it stays visible while the user navigates around a paused game. Structural
   metadata, not a score, so it renders unconditionally like the masthead
   date. Same amber as .gamecard__delay's slate badge; flat fill, not the
   hatch weave the spoiler covers use. ---- */`,
`/* ---- game-status banner — flat highlighter strip flagging a delayed,
   suspended, or postponed game, shown under the masthead on every section so
   it stays visible while the user navigates around a paused game. Structural
   metadata, not a score, so it renders unconditionally like the masthead
   date. Same flag colour as .gamecard__delay's slate badge; flat fill, not
   the --hold-texture weave the rehab banner wears. ---- */`],

  ['29-team-transactions.css',
`/* The series the page was opened from (asOf, or today on a bare visit) gets
   a kraft-tape ring so it reads as "you are here" among a season's worth of`,
`/* The series the page was opened from (asOf, or today on a bare visit) gets
   an ink ring so it reads as "you are here" among a season's worth of`],

  ['29-team-transactions.css',
`   blocks use; kraft-tape tinted to read as a break in the season rather than
   just another series. */`,
`   blocks use; tinted in its own All-Star blue to read as a break in the
   season rather than just another series. */`],

  ['31-wild-card.css',
`   block sits on one soft-cream card with a kraft-tape border, rather than`,
`   block sits on one soft-cream card with a ruled border, rather than`],

  ['31-wild-card.css',
`   layout as .thub-card__head, just kraft-bordered like the rest of this
   card instead of the plain hairline the shared shell uses. */`,
`   layout as .thub-card__head, on the same hairline the shared shell uses —
   kraft-bordered until ADR-0083. */`],

  ['31-wild-card.css',
`/* Kraft-tape amber, deliberately NOT the clay red the IL cross (.ilmark) uses:
   an All-Star who's also hurt would otherwise show a red star and a red cross
   side by side in the same hue, reading as one smeared mark. Amber keeps the
   honor distinct from the injury flag (and matches the gold-star convention). */`,
`/* All-Star blue, deliberately NOT the clay red the IL cross (.ilmark) uses:
   an All-Star who's also hurt would otherwise show a red star and a red cross
   side by side in the same hue, reading as one smeared mark. The mark wore
   kraft until ADR-0083; the app's own All-Star blue keeps the honor distinct
   from the injury flag and claims nothing about a seal. */`],

  ['38-umpire-pages.css',
`   only AAA is chipped — a small kraft-amber pill, the level toggle's own hue. */`,
`   only AAA is chipped — a small ink pill, the level toggle's own hue. */`],

  ['38-umpire-pages.css',
`/* Home-plate glyph beside a today-working umpire's name — a small round
   kraft-tape badge, same 21px dot as .umptier__glyph (the Umpires card's own`,
`/* Home-plate glyph beside a today-working umpire's name — a small round
   highlighter badge, same 21px dot as .umptier__glyph (the Umpires card's own`],

  ['39-manager-page.css',
`   slot) — same interactive-pill contract as .attendance__glyph--open (kraft
   seal fill, seal-ink text, pill radius) rather than a plain text link, since
   the ask was specifically a pill. Opens PostseasonOddsModal. */`,
`   slot) — same interactive-pill contract as .attendance__glyph--open (ink
   fill, inverse text, pill radius) rather than a plain text link, since
   the ask was specifically a pill. Both wore kraft until ADR-0083, which
   named this pill as one of the four wearing it wrongly. Opens
   PostseasonOddsModal. */`],

  ['40-game-modals.css',
`/* The save button: a small kraft-tape pill, the same amber affordance
   language as a clip card's WATCH tab — you are taking the print out of the
   scorebook, so it wears the tape rather than a generic outline button. The`,
`/* The save button: a small ink pill, the same affordance
   language as a clip card's WATCH tab — you are taking the print out of the
   scorebook. It wore kraft tape until ADR-0083: a save is not a seal. The`],

  ['44-pre-game-cards.css',
`   game — a light kraft/cream tint, distinct enough to separate a series'
   legs at a glance without competing with the current-game navy highlight. */`,
`   game — the inset paper, distinct enough to separate a series'
   legs at a glance without competing with the current-game navy highlight. */`],

  ['48c-stamp-sheet.css',
`/* A completed collection keeps one quiet, permanent mark of it — the same
   kraft-tape amber a stamp seals with, as a ring rather than a rosette. No
   badge glyph, no "complete" label; the ring alone is the whole statement.`,
`/* A completed collection keeps one quiet, permanent mark of it — the
   highlighter's yellow, as a ring rather than a rosette. It was the stamp's
   own kraft until ADR-0083; a finished set is a highlight, not a cover, and
   yellow reads at 8.4:1 on the dark album board where the kraft read at 3.2.
   No badge glyph, no "complete" label; the ring alone is the whole statement.`],

  ['48c-stamp-sheet.css',
`   ring-pulse in the seal's own amber plus the faintest settle of the pane`,
`   ring-pulse in the highlighter's yellow plus the faintest settle of the pane`],

  ['49-passport-book.css',
`/* The stamp whose options bar is open above the book. Kraft amber rather than
   --focus-ring, because this is a SELECTION that outlives the tap, not focus —
   the two can be on different stamps at once, and they must not look alike.`,
`/* The stamp whose options bar is open above the book. Navy ink rather than
   --focus-ring, because this is a SELECTION that outlives the tap, not focus —
   the two can be on different stamps at once, and they must not look alike.
   (Kraft until ADR-0083: a selection is not a seal.)`],

  ['49-passport-book.css',
`/* Asking takes the kraft-amber of the bars above the book, because that is the`,
`/* Asking takes the ink of the bars above the book, because that is the`],

  ['52-highlight-clip-card.css',
`   figures voice). The play affordance is a small tab of kraft tape
   stuck on the print's lower-left, a hair off-square the way tape
   goes down by hand — solid --seal, like .sstrip__cell--home's tape
   tone, deliberately NOT the --seal-texture hatch, which is the
   spoiler-cover weave and would claim "sealed" on a card that is the
   opposite. The amber tape carries its own contrast (--text-on-seal is
   a validated pair) against any poster frame, so nothing here needs a
   scrim to stay legible.`,
`   figures voice). The play affordance is a small tab
   stuck on the print's lower-left, a hair off-square the way tape
   goes down by hand — navy ink, like .flipback__watchbtn's tab. It
   was solid --seal until ADR-0083: every affordance meaning "there is
   video here" wore the cover's own colour, on a card that is the
   opposite of sealed. --text-on-ink carries its own validated
   contrast against any poster frame, so nothing here needs a
   scrim to stay legible.`],

  ['52-highlight-clip-card.css',
`/* The slip lifts a hair off the page and its edge warms to the kraft
   tone — the same border-color: var(--seal) hover the photo tiles
   beside it use, so the two rails read as one family. */`,
`/* The slip lifts a hair off the page and its edge warms to the action
   green — the same border-color hover the photo tiles
   beside it use, so the two rails read as one family. */`],

  ['52-highlight-clip-card.css',
`/* The kraft-tape Watch tab — rotated a hair off-square (tape goes down`,
`/* The Watch tab — rotated a hair off-square (tape goes down`],

  ['52-highlight-clip-card.css',
`   tab's validated on-seal ink. */`,
`   tab's validated inverse ink. */`],

  ['52-highlight-clip-card.css',
`/* Deepen to the hatch-line amber on hover — still ≥4.5:1 under
   --seal-ink (the pair colors.css documents for the seal texture's
   darker stripe). */`,
`/* Deepen a step on hover — still well past 4.5:1 under
   --text-on-ink (the pair colors.css documents for an ink chip). */`],

  ['52-highlight-clip-card.css',
`   here" wears kraft tape (the WATCH tab above, the condensed panel's
   tab, the player's SAVE pill), and they should be read together. Ink
   is for navigation, tape is for video. */`,
`   here" wears the same ink tab (the WATCH tab above, the condensed
   panel's tab, the player's SAVE pill), and they should be read
   together. They wore kraft tape until ADR-0083. */`],

  ['54-my-tally.css',
`   A pressed rubber stamp: navy ink under a kraft rim, with the club's one-color
   knockout mark (ADR-0031) sitting in the middle. The mark is white art, which
   is why the disc has to be dark — do not lighten it without swapping the
   variant. */`,
`   A pressed rubber stamp: navy ink under a navy rim, with the club's one-color
   knockout mark (ADR-0031) sitting in the middle. The mark is white art, which
   is why the disc has to be dark — do not lighten it without swapping the
   variant. (The rim was kraft until ADR-0083: a drawn crest is art, not a
   spoiler cover.) */`],

  ['55-my-tally-account.css',
`/* The kraft bars stand where the numbers would be. That absence IS the`,
`/* The ink bars stand where the numbers would be. That absence IS the`],

  ['62-identity-admin.css',
`/* The stamp group's retroactive warning (ADR-0035's amendment). Kraft-taped
   like every other "read this before you act" strip in the app, because it is
   the one control here whose effect reaches something a person already keeps. */`,
`/* The stamp group's retroactive warning (ADR-0035's amendment). Clay-railed
   like every other "read this before you act" strip in the app, because it is
   the one control here whose effect reaches something a person already keeps.
   (Kraft-taped until ADR-0083.) */`],

  ['69-hit-chart.css',
`/* Kraft into clay — a short seam under the title, the same two inks the seals
   and the outs are drawn in. */`,
`/* Ink into clay — a short seam under the title, the same two inks the
   headings and the outs are drawn in. */`],

  ['70-contracts-grid.css',
`   with its kraft-gold underline is .metricbar's own treatment
   (SectionMasthead), the same move tokens/colors.css's --heat-slab`,
`   with its kraft-gold underline is .metricbar's own treatment
   (SectionMasthead) — the one band ADR-0083 left on kraft, because on a
   club page that underline is the club's accent and kraft is only its
   unthemed fallback. The same move tokens/colors.css's --heat-slab`],

  ['74-contract-workbench.css',
`/* The one word that differs. Kraft-tape amber, the same ink this app already
   uses to mean "look here" — a reviewer comparing "Ron" against "Ronnie"
   should not have to read both strings to find the difference. */`,
`/* The one word that differs. Highlighter yellow, the ink this app uses to
   mean "look here" — a reviewer comparing "Ron" against "Ronnie"
   should not have to read both strings to find the difference. (Kraft until
   ADR-0083, which is the confusion that rule exists to stop: nothing here is
   sealed.) */`],

  ['77a-express-lane-entry.css',
`/* THE CHOSEN CARD TAKES THE KRAFT AMBER, which is this app's one colour for
   "sealed, and yours to open" everywhere else. It arrives as the same 3px rail`,
`/* THE CHOSEN CARD TAKES THE HIGHLIGHTER, this app's colour for "look here".
   It took the kraft amber until ADR-0083 — the one colour a door into
   unsealed film must not wear. It arrives as the same 3px rail`],

  ['77c-express-lane-deck.css',
`   It takes the SEAL amber, which is this app's one colour for "sealed, and
   yours to open" everywhere else. */`,
`   It takes the album's own soft foil, this deck's colour for a label that
   states rather than flags. (The seal amber until ADR-0083.) */`],

  ['78-offseason.css',
`   exception, so it is the only thing on the page wearing kraft tape — the
   app's one colour for "results are behind this" — and the warning is in words
   beside it, never in the tape alone (SeasonRecord.jsx says why it is a LABEL
   and not a SealBox).

   The tape is the same woven texture the covers use rather than a flat amber
   fill, because a reader has met it on every sealed score all season and should
   recognise it here without being told.`,
`   exception, so it is the only thing on the page wearing tape — and the
   warning is in words
   beside it, never in the tape alone (SeasonRecord.jsx says why it is a LABEL
   and not a SealBox).

   The tape is --hold-texture: the covers' own weave, in the flag colour
   rather than the cover's kraft. ADR-0083 reserved kraft for a surface a tap
   can actually lift, and this row is a label that opens nothing.`],

  ['scorecard/box.css',
`   (lib/scorecardNotes.js), flagged with a kraft-amber corner fold so an
   edited box is tellable from a derived one at arm's length. */`,
`   (lib/scorecardNotes.js), flagged with an ink corner fold so an
   edited box is tellable from a derived one at arm's length. The fold is the
   one mark on this sheet that is NOT kraft: the box beside it may still be
   sealed, and two ambers meaning two things is what ADR-0083 ends. */`],
]

let n = 0
for (const [file, oldText, newText] of EDITS) {
  const path = `src/styles/${file}`
  const src = fs.readFileSync(path, 'utf8')
  const hits = src.split(oldText).length - 1
  if (hits !== 1) {
    console.error(`${file}: expected 1 match, got ${hits}\n---\n${oldText}\n---`)
    process.exit(1)
  }
  fs.writeFileSync(path, src.replace(oldText, newText))
  n += 1
}
console.log(`prose blocks rewritten: ${n}`)
