# Component-reuse guard: triage of the first census

Guard: `scripts/check-component-reuse.mjs` (#1114, ADR-0084 clause 6). First census,
before this PR: capsule 10, sheet 7, ledger 49, band 2 (68 rule hits; one rule counts
twice only if it matches two shapes, and none did). Each rule and its JSX use were read.

Classes: **card** = a real shell that should use Card, Pill or SectionHead later.
**control** = form field or button (Button/input work, #1174; false alarm for a
card-shape guard). **stamp** = stamp, seal, slate or scorecard bespoke (ADR-0035,
inventory.md). **other** = stays counted, with a note.

## What changed in the guard

1. The detector skips a rule that is a control: selector has an `input`, `select`,
   `textarea` or `button` element, or a class ending `btn`/`input`/`select` after `__`;
   or the body says `cursor: pointer` (tappable) or `resize:` (textarea).
   Every skipped rule below was read in JSX and is a `<button>`, `<input>`, `<select>`,
   `<textarea>` or a tappable tile. No card shell in the census has `cursor: pointer`.
2. Eleven rules carry `component-reuse-exempt: <reason>` (stamp/slate bespoke, plus
   three controls the detector cannot see: a switch, a text input, a disclosure button).
3. Budgets drop to capsule 6, sheet 3, ledger 17, band 1.

## Controls skipped by the detector (30 rules)

| Shape | Rule | Evidence |
|---|---|---|
| ledger | `.datenav__today` | button, cursor pointer |
| ledger | `.searchbox__input` | input (`__input`) |
| ledger | `.gamefinder__season select` | select element |
| ledger | `.gamefinder__result` | button row, cursor pointer |
| ledger | `.gamephotos__seasonselect` | select (`__seasonselect`) |
| ledger | `.gamephotos__gamerow` | `<button>`, cursor pointer |
| ledger | `.idlab__stepbtn` | `<button>` (`__stepbtn`) |
| ledger | `.idlab__wpaartitem` | tappable tile, cursor pointer |
| ledger | `.idlab__mastheadsource` | `<textarea>`, `resize` |
| ledger | `.patternlab__filterbtn` | `<button>` (`__filterbtn`) |
| ledger | `.patternlab__notefield` | `<textarea>`, `resize` |
| ledger | `.last10__card` | `<button>` tile, cursor pointer (a tappable tile, so Button/tile work, not Card) |
| ledger | `.admincopy__input` | input (`__input`) |
| ledger | `.mytally__rowbtn` | `<button>` (`__rowbtn`) |
| ledger | `.coverpick__step` | `<button>`, cursor pointer |
| ledger | `.bpadmin .bpadmin__btn` | `<button>` |
| ledger | `.iddrawer__tile` | tappable tile, cursor pointer |
| ledger | `.trec__half` | segmented button, cursor pointer |
| ledger | `.trrank__chip` | chip button, cursor pointer |
| ledger | `.hitchart__chip` | chip button, cursor pointer |
| ledger | `.payboard__chip` | chip button, cursor pointer |
| ledger | `.spray__chip` | chip button, cursor pointer |
| ledger | `.cwb__tab` | tab button, cursor pointer |
| ledger | `.cwb__primary, .cwb__danger, .cwb__mini, .cwb__use` | buttons, cursor pointer |
| ledger | `.chal__view` | segmented button, cursor pointer |
| ledger | `.sc-labload__input` | input (`__input`) |
| ledger | `.trrank__select` | select (`__select`) |
| capsule | `.photostrip__viewall` | `<button>`, cursor pointer |
| capsule | `.pcard__infobtn span` | the "i" glyph inside a button (`__infobtn`) |
| band | `.bpadmin__actions .bpadmin__btn--save` | save button; reads `--bar-fill` only as a text fill, not a head |

## Exempted in place (11 rules)

| Shape | Rule | Class | Reason |
|---|---|---|---|
| sheet | `.gamecard` | stamp | slate card, bespoke (inventory.md item 4) |
| sheet | `.gamecardstack__sheet` | stamp | paper behind the slate card stack |
| sheet | `.flipback` | stamp | back face of the slate card flip |
| sheet | `.stampstrip` | stamp | Game Log stamp surface (ADR-0035) |
| capsule | `.logbook__pending` | stamp | empty stamp slot, dashed circle |
| capsule | `.passportpage__pending` | stamp | empty stamp slot on a passport page |
| ledger | `.passportbook__blank` | stamp | blank passport page |
| ledger | `.logbook__tray` | stamp | tray of unplaced stamps |
| ledger | `.daystate__chip--live` | control | `role=switch` button with no cursor rule |
| ledger | `.idlab__recolorname` | control | text input, class has no `input` suffix |
| ledger | `.logbookstats__toggle` | control | disclosure `<button>` with no cursor rule |

## Still counted (27 rules: the real list for the Card/Pill/SectionHead work)

| Shape | Rule | Class | Note |
|---|---|---|---|
| capsule | `.gamecard__live` | card | badge on the slate card; Pill with a `clay` fill |
| capsule | `.gamecard__delay` | card | badge on the slate card; Pill with a `marker` fill |
| capsule | `.ladder__badge` | card | mono pill with a hairline; Pill outline |
| capsule | `.duepill` | other | Pill in seal colours; check against the seal rule before moving |
| capsule | `.seasonseries__round` | card | navy Pill |
| capsule | `.stampin__mark` | card | on/off Pill on the stamp-in button |
| sheet | `.idlab__barunit` | card | lab tool panel |
| sheet | `.idlab__bench` | card | lab tool panel |
| sheet | `.thub-roster` | card | roster list shell; the clearest Card candidate |
| band | `.teaminfo.is-themed > .teaminfo__head` | card | the club-coloured head; SectionHead band |
| ledger | `.postponed` | card | held-game notice (dashed, marker wash); Notice component |
| ledger | `.pitchernotice--pbp` | card | notice with a marker wash; Notice component |
| ledger | `.gamephotos__tile` | other | photo link tile (`<a>`, 4:3, clipped) |
| ledger | `.team-score__row--driver` | card | inset row state |
| ledger | `.awardord__list` | card | admin ordered list shell |
| ledger | `.animlab__framebox` | other | animation lab demo frame |
| ledger | `.logbook__order` | other | dashed ask bar that holds buttons; edge case, left counted |
| ledger | `.cwb__narrow` | card | admin notice |
| ledger | `.cwb__queue` | card | admin list shell |
| ledger | `.cwb__pane` | card | admin panel |
| ledger | `.pbkt-fold` | card | bracket fold, heavy top rule |
| ledger | `.dueupconsole__col` | card | HUD column |
| ledger | `.refpanel__tabs` | other | a tab strip wrapper, not a card |
| ledger | `.scout__fact` | card | stat tile |
| ledger | `.scout__pa` | card | scout panel |
| ledger | `.scout__verdict` | card | scout panel |
| ledger | `.scout__hitline` | card | scout stat grid |

Total check: 30 skipped + 11 exempt + 27 counted = 68 hits. Counted: capsule 6,
sheet 3, ledger 17, band 1 = 27.
