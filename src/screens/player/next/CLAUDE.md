# src/screens/player/next — the new player page and its modules (#1884)

`/player/{id}?look=new`, beside the live page. Plan: `docs/player-redesign.md`.
`PlayerNextPage.jsx` draws the hero, the tiles, the jump bar, and maps over
`sections.js`. `Slot.jsx` is the stamped Card around one module. **A module never edits
`sections.js`, `Slot.jsx` or the page.**

## The module contract

`modules/<module>/index.jsx` default-exports a component; every slot is pre-wired in
`sections.js` (`SLOTS`), and the folder holds one file until its issue builds it.

- **Props:** `{ bio, role, asOf, season, section, onEmpty, onCount }`. `role` is
  `'hitting'` or `'pitching'`; a two-way player gets one instance per role. `section` tells
  the shared `tbd` module which section it fills.
- **Data:** the module owns its data hook. `Slot` mounts it only once the slot is near
  (`hooks/scroll/useNearView.js`), so nothing loads before then.
- **No data:** call `onEmpty()`, or render nothing on the first render. `Slot` then hides
  the card, and the jump-bar button hides when ALL slots of its section are empty.
- **Count tag:** call `onCount(n)` (or a string); `Slot` draws it on the card's edge.
- **CSS:** the module's own file, in its folder or `src/styles/player-next/<module>.css`,
  imported from its `index.jsx` (`src/styles` is at its file budget).
- **Open surface (ADR-0034):** no seal, no gate. Keep `?d=` and `?s=` on every link (the
  page wraps everything in `LinkScope`) and ADR-0057 addresses (use the path builders).
