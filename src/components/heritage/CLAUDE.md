# Heritage Pass

Optional collectible view over the existing stamp facts. Architecture and fixture
provenance: `docs/heritage-pass.md`. The circular stamp is a separate, preserved view.

- A pass carries a final score. `scripts/check-stamp-surfaces.mjs` allowlists
  its callers: the box score's revealed body, the owner's collection, and the
  DEV-only fixed-record preview. Never mount it on a slate or unrevealed game.
- Stadium artwork is caller-owned: callers pass `heritageArt(venue)` from
  `lib/heritage/art.js` (`public/heritage-art/{parkKey}.webp`). The component never
  resolves, fetches, or generates it. Absent and failed artwork keep the venue
  typography. Add a park with its webp and one `ART` line; check the crop.
- The adapter uses `game:final` facts, not a second game model. Optional metadata
  stays absent; `gameNumber` is a doubleheader number, never a series number.
- The swipeable ticket strip below Game Log's stamp book receives only active
  stamps from the owner's collection, never an arbitrary game list. Never rewrite circular stamp placements,
  passport geometry, book metadata, or the persisted score-free collection.
- The approved header is the navy-band concept: the existing MLB/MiLB league
  knockout mark, distinct secondary team marks, and the level/round ribbon.
  `SecondaryMark` sanitizes real CDN vectors and uses the existing mono-logo
  conversion, shared by club across passes. Missing, identical, or era-unsafe
  art takes the engraved baseball fallback. Never invent a secondary logo.
