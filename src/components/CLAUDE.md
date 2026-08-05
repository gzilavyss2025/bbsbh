# src/components — buckets, and why SealBox sits alone

This directory reached **126 files** before anyone noticed, against a root
`CLAUDE.md` rule that says to subdivide at roughly ten. It is being bucketed;
`check-dir-size.mjs` (ADR-0038) now records the count and refuses to let it grow.

## `SealBox.jsx` stays at the top level, on purpose

It is the core spoiler invariant (ADR-0002), cited by literal path from the root
`CLAUDE.md`, `src/CLAUDE.md`, and the ADR itself. Leaving it where it is costs no
edit to the 199/200-line-capped root file — and once every other component sits
in a bucket, being **the one unbucketed file** is the loudest available signal
about what it is. Do not tidy it into a folder.

## The buckets

| Bucket | Holds | The test for "does it belong here?" |
| --- | --- | --- |
| `ui/` | `Loader`, `SectionMasthead`, `SectionTitle`, `ChevronLink`, `CopyBox`, `ModalPortal`, `InfoPopover`, `MasonryColumns`, `FlipCard`, `BreakableLocation` | **No baseball knowledge.** No `api/` import, no feed access, no team or game concept. Safe to reach for from anywhere |
| `badges/` | `ProspectPill`, `RookiePill`, `DebutPill`, `MilestonePill`, `InjuredMark`, `RadarPill`, `TierPill`, `UmpireTierPill`, `UmpireTierGlyph` | An inline mark that adorns a name in a dense row, and **renders nothing when inactive** — so a caller can splice it in unconditionally |
| `charts/` | `WinProbChart`, `UsagePips`, `PitchMix`, `BattedBallMix`, `PitchArsenalMix`, `StatcastPercentiles` | Draws a quantity. Every value arrives **already reveal-gated by its caller** — nothing here decides what may be shown |

Everything else is still at the top level awaiting a bucket. The remaining
groups, roughly: the site frame (`SiteHeader`/`SiteFooter`/`SiteMenu`/…), the
identity primitives (`TeamLogo`, `PlayerLink`, `Headshot`, `TeamLink` — the four
most-imported components in the app), the dialogs, the Clerk-gated account
components, and the game-section tree. The last two need care and are called out
below.

## Two constraints that outrank tidiness

**The Clerk-gated components must stay dynamically imported.** `AccountButton`,
`AccountPitch`, `ContinueScoring`, and the three `*CloudSync` components are
reached through `import()` so `@clerk/clerk-react` (~110 KB gz) stays out of the
entry chunk. Moving them is fine; converting one of those specifiers to a static
import is not, and it would still build cleanly — so check the built output, not
just that the build passed.

**Some components are named by literal path in a guard.** `check-stamp-surfaces.mjs`
holds an allowlist plus eight `FORBIDDEN_SURFACES` (`GameCard`, `ContinueScoring`,
`PastGameFlipCard`, `GameResultFace`, `Scorebug`, `GameFinder`, `DeckNudge`, and
`GameSelect`), and `check-report-pages.mjs` names `SiteMenu`, `SiteFooter`,
`ReportFooter`. Moving any of those means editing the guard **in the same
commit**. They fail loudly rather than silently if you forget, which is the
point — read ADR-0035 before touching the stamp list.

## No barrel files

No `index.js` re-exporting a bucket. A barrel makes every consumer import the
whole bucket's module graph, which is how a lazily-loaded chunk quietly becomes
an eager one. Import the component's own path.
