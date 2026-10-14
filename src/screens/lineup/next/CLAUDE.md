# src/screens/lineup/next — the new lineup page (`?look=new`)

The away and home lineup pages in the new look, hidden behind `?look=new` on
`/{date}/{matchup}/lineup1|lineup2`. Plan, Gary's decisions and the slice list:
`docs/lineup-redesign.md`. The design reference is `.scratch/lineup-redesign/`. The live
page (`screens/TeamInfo.jsx`) does not change until one swap PR deletes it.

- `LineupPage.jsx` picks the page. `GameView` passes both pages the same props, plus the
  game chrome the new page draws itself (`tabs`, keep-awake, `onSketch`), and hides its own
  masthead, series band and section tabs when the flag is on. `lookFlag.js` is the flag;
  `App.jsx` keeps it on section links.
- `LineupNextPage.jsx` is the page; `useLineupData.js` holds every derivation the cards
  read for one side (a port of the live page's `TeamSections`); `lineupIdentity.js` is the
  pure club identity (bar colours, mark). `cards/` holds one file per card, `sheets/` the sheet.
- **Spoiler footing is the live page's.** The lineup pages are a scoring surface. Hitter
  and pitcher season lines end the day before the game (ADR-0088). The season series
  blanks the current and later games (`seasonSeriesCells`). Nothing here is fetched and then
  hidden, and nothing imports a reveal-only module.
- A club's colours reach a band through `.is-themed` on the card or the page root; a
  club may colour a head that names it, never a control (ADR-0030). The starter card and the
  defensive field wear the OTHER club's colours, because they are that club's players.
- No dashed rules (`test/dashed-allowlist.test.js`), no raw colours: tokens only.
