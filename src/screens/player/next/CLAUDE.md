# src/screens/player/next — the new player page and its modules (#1884)

`/player/{id}?look=new`, beside the live page. Plan: `docs/player-redesign.md`.
`PlayerNextPage.jsx` draws the hero, the tiles, the jump bar, and maps over
`sections.js`. `Slot.jsx` is the stamped Card around one module. **A module never edits
`sections.js`, `Slot.jsx` or the page.**

## The slots

One `modules/<module>/` folder per module: `season` #1885, `splits` #1886, `plate` #1887,
`contact` #1888, `form` #1889 (batter), `pform` #1930 (pitcher Form trend), `batlog` #1890,
`pitchlog` #1851, `fouls` #1891, `similar` #1926 (ends Game log), `arsenal` #1892, `mound`
#1893, `path` #1894, `prospects` #1927, `firsts` #1895, `innings` #1928, `contract` #1929,
`tbd` #1896 (one folder, three slots: Season, Career and History). Order inside a section is
the `SLOTS` order in `sections.js`. No section has its own button beyond the jump bar's nine.

## The top cards

`top/` holds three page-level cards that are NOT slots: `StatusBanners` and `HeaderExtras` (nickname,
prospect pills, school, OVR bars) wrap the hero, `OverviewExtras` (rank chips, postseason, other
levels) sits under the tiles (#1884, TbdWire "top"). Each is a plain stamped Card with the live
page's content and hides when it has none. The banner text is `../statusBanners.js`, shared with the
live hub.

## The module contract

`modules/<module>/index.jsx` default-exports a component; every slot is pre-wired in
`sections.js` (`SLOTS`), and the folder holds one file until its issue builds it.

- **Props:** `{ bio, role, asOf, season, section, onEmpty, onCount }`. `role` is
  `'hitting'` or `'pitching'`; a two-way player gets one instance per role. `section` tells
  the shared `tbd` module which section it fills.
- **Data:** the module owns its data hook. `Slot` mounts it only once the slot is near
  (`hooks/scroll/useNearView.js`), so nothing loads before then.
- **Two states.** *Not built yet:* the stub renders its one placeholder line, never `null`
  and never `onEmpty()`, so the card and its button stay. *No data:* a real module that has
  loaded and found nothing calls `onEmpty()`, or renders nothing on its first render; `Slot`
  hides the card, and the button hides when ALL slots of its section are empty. A module that is built leaves the stub list: add it to `BUILT` in `test/player-next-sections.test.js`.
- **Count tag:** call `onCount(n)` (or a string); `Slot` draws it on the card's edge.
- **Height:** a slot before it is near holds one non-breaking-space line, so it reserves one line; with
  the 600px margin most slots count as near on first paint. A real module reserves its own height (or `Slot` gets a min-height then).
- **Failure:** a module that throws, or whose chunk fails to load, hides its card like `onEmpty()`
  (`SlotBoundary`, which logs the error with the slot key); it never takes down the page. The page
  also hides the log slots from its own data: with no season or postseason games, `seedEmpty` hides
  `batlog`, `pitchlog` and `fouls` before they mount.
- **CSS:** the module's own file, in its folder or `src/styles/player-next/<module>.css`,
  imported from its `index.jsx` (`src/styles` is at its file budget).
- **Open surface (ADR-0034):** no seal, no gate. Keep `?d=` and `?s=` on every link (the
  page wraps everything in `LinkScope`) and ADR-0057 addresses (use the path builders).
