# src/screens/player/next — the player page and its modules (#1884)

`/player/{id}` since the swap (#1898); `/stats`, `/analytics` and `/history` scroll to
their sections (`tab` prop). Plan: `docs/player-redesign.md`.
`PlayerNextPage.jsx` draws the hero, the tiles, the jump bar, and maps over
`sections.js`. `Slot.jsx` is the stamped Card around one module. **A module never edits
`sections.js`, `Slot.jsx` or the page.**

## The slots

One `modules/<module>/` folder per module: `season` #1885, `splits` #1886, `plate` #1887,
`contact` #1888, `form` #1889 (batter), `pform` #1930 (pitcher Form trend), `batlog` #1890,
`pitchlog` #1851, `fouls` #1891, `similar` #1926 (ends Game log), `arsenal` #1892, `mound`
#1893, `path` #1894, `prospects` #1927, `prospect` #2068, `firsts` #1895, `innings` #1928, `contract` #1929,
`percentile` #2011, `advanced` #2012, `runvalue` #2013, `command` #2014, `target` #2015, `pfouls` #2016,
`milestones` #2017, `awards` #2018, `teams` #2019, `moves` #2020, `photos` #2021, `highlights` #2022 (stubs,
wired in #2002), `tbd` #1896 (one folder, five slots: Season, On the mound (pitchers), Game log, Career and History; no
Overview slot, the top cards cover it; only Command received is left, the other four slots render nothing). Order inside a section is
the `SLOTS` order in `sections.js`. `SLOTS` hints: `once` gives a two-way player one instance with no role
suffix; `twin` adds the suffix to two one-role slots with one name (the two Foul balls); `pair:
'a'|'b'` puts an adjacent pair side by side at wide widths (`page.css`, a container query). No section has its own button beyond the jump bar's nine.

## The top cards

`top/` holds the hero's parts and one page-level card, none of them slots: `HeroBand` (the status rows, the first child of the hero card, #2008);
`HeroStamp` and `HeroStrip` (#2009: the OVR stamp at the right end of the hero row, a button that opens the ratings strip at the hero's foot, folded on load; the name-block extras are `headerExtras` in `../heroData.js`);
`OverviewExtras` (rank chips, postseason, other levels), a stamped Card under the tiles that hides when it has none. The banner text is `../statusBanners.js`.

## The module contract

`modules/<module>/index.jsx` default-exports a component; every slot is pre-wired in
`sections.js` (`SLOTS`), and the folder holds one file until its issue builds it.

- **Props:** `{ bio, role, asOf, season, section, onEmpty, onCount }`. `role` is
  `'hitting'` or `'pitching'`; a two-way player gets one instance per role. `section` tells
  the shared `tbd` module which section it fills.
- **Data:** the module owns its data hook. `Slot` mounts it only once the slot is near
  (`hooks/scroll/useNearView.js`), so nothing loads before then.
- **Two states.** *Not built yet:* the stub renders `null`, so `Slot` hides its card and the
  live page shows no placeholder (changed 2026-10-14, before the swap #2040). *No data:* a real module that has
  loaded and found nothing calls `onEmpty()`, or renders nothing on its first render; `Slot`
  hides the card, and the button hides when ALL slots of its section are empty. A module that is built leaves the stub list: add it to `BUILT` in `test/player-next-sections.test.js`.
- **Count tag:** call `onCount(n)` (or a string); `Slot` draws it on the card's edge.
- **Height:** `SLOTS` gives each slot `minH: [phone, wide]` (measured, a floor). `Slot` holds that height,
  with no text, until the module shows content (nothing inside says `aria-busy`); then the body rises in once. So every wait block a module returns carries `aria-busy="true"` (`test/player-next-wait-busy.test.js`).
- **Menus:** the card menus of `splits` (pitcher), `plate`, `contact` and `arsenal` are the shared `MenuRail` (`components/ui/control/`): menu cards fold into a rail and open a panel. A module does not build its own.
- **Top cards:** the hero and tiles stamp in once per page visit, gated by `viewKey(id, 'top-cards')`; a return visit shows them at rest (`pnext__top--still`, `page.css`).
- **Failure:** a module that throws, or whose chunk fails to load, hides its card like `onEmpty()`
  (`SlotBoundary`, which logs the error with the slot key); it never takes down the page. The page
  also hides the log slots from its own data: with no season or postseason games, `seedEmpty` hides
  `batlog`, `pitchlog`, `fouls` and `pfouls` before they mount.
- **CSS:** the module's own file in `src/styles/player-next/<group>/`, imported from its `index.jsx`.
  `both/` is full: new files go in `season/`, `history/`, `gamelog/`, `pitcher/` or `top/`.
- **Shared parts:** a part two modules use sits in `parts/`, not in one module's folder:
  `LogTable.jsx`, the game log table (pitchlog #1851, batlog #1890); `CountExplorer.jsx`
  (count grid, panel, `Stat`, `Rail`) and `foulsFormat.js` (number formats), the Foul balls cards (#1891, #2016).
- **Open surface (ADR-0034):** no seal, no gate. Keep `?d=` and `?s=` on every link (the
  page wraps everything in `LinkScope`) and ADR-0057 addresses (use the path builders).
