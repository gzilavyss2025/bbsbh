# src/screens/lineup/next — the lineup pages

The away and home lineup pages, `/{date}/{matchup}/lineup1|lineup2`. Plan, Gary's decisions and
the slice list: `docs/lineup-redesign.md`. The design reference is `.scratch/lineup-redesign/`.

- `GameView` renders `LineupNextPage` at steps 0 and 1, with the game chrome the page draws
  itself (`tabs`, keep-awake, `onSketch`), and leaves out its own masthead, series band and
  section tabs once the game has loaded.
- `LineupNextPage.jsx` is the page; `useLineupData.js` holds every derivation the cards
  read for one side. `logic/` holds the pure parts (club identity, pitch mix rows, fact text,
  series position). `cards/` holds one file per card, `sheets/` the sheets.
- **Spoiler footing** (kept from the page this one replaced): The lineup pages are a scoring surface. Hitter
  and pitcher season lines end the day before the game (ADR-0088). The season series
  blanks the current and later games (`seasonSeriesCells`). Nothing here is fetched and then
  hidden, and nothing imports a reveal-only module.
- A club's colours reach a band through `.is-themed` on the card or the page root; a
  club may colour a head that names it, never a control (ADR-0030). The starter card and the
  defensive field wear the OTHER club's colours, because they are that club's players.
- No dashed rules (`test/dashed-allowlist.test.js`), no raw colours: tokens only.
