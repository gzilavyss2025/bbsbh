# Career milestone watch — plan

## Context

The player page already fetches full career splits (`careerSplits` in
`loadPlayer.js`), and the app already has a backward-looking "firsts"
feature (first career hit/HR/etc., pinned to the exact game). This feature
is the forward-looking complement: detect a player sitting within striking
distance of a round career milestone and surface a countdown — a
"MILESTONE WATCH" line on the player page, and a lineup-staging callout
("BETTS sits 4 hits shy of 2,000") via the nightly callouts precompute.
Both halves are pure arithmetic on data already fetched — no new data
source — but the player-page half has one real hazard: `careerSplits` (the
API's `stats=career` type) is a *live* value, not date-cut, so used naively
it would leak whether a milestone was reached in games the user hasn't
revealed yet via an old game's player-page link. Section 2 below is the
crux of the design; everything else is straightforward enumeration.

## 1. The milestone table

New pure module content in `src/api/person.js`, next to the "Firsts"
section (after `firstMilestoneSeasons`, ~line 522). Two building blocks:

```js
// stat: the aggregateSplits() field name. group: 'hitting' | 'pitching'.
// thresholds: round numbers worth flagging, ascending. window: player-page
// "worth mentioning" distance (wide — weeks out is fine). gameGate: the
// single-game-plausible distance the lineup callout uses (tight).
export const MILESTONE_DEFS = [
  { stat: 'hits',        group: 'hitting',  label: 'H',  thresholds: [1000, 1500, 2000, 2500, 3000, 3500, 4000], window: 50, gameGate: 4 },
  { stat: 'homeRuns',    group: 'hitting',  label: 'HR', thresholds: [100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600, 700, 762], window: 15, gameGate: 2 },
  { stat: 'rbi',         group: 'hitting',  label: 'RBI', thresholds: [1000, 1500, 2000], window: 50, gameGate: 4 },
  { stat: 'runs',        group: 'hitting',  label: 'R',  thresholds: [1000, 1500, 2000], window: 50, gameGate: 4 },
  { stat: 'stolenBases', group: 'hitting',  label: 'SB', thresholds: [300, 400, 500], window: 20, gameGate: 2 },
  { stat: 'doubles',     group: 'hitting',  label: '2B', thresholds: [400, 500, 600], window: 20, gameGate: 2 },
  { stat: 'wins',        group: 'pitching', label: 'W',  thresholds: [100, 150, 200, 250, 300], window: 5, gameGate: 1 },
  { stat: 'strikeOuts',  group: 'pitching', label: 'K',  thresholds: [1000, 1500, 2000, 2500, 3000, 3500, 4000], window: 50, gameGate: 8 },
  { stat: 'saves',       group: 'pitching', label: 'SV', thresholds: [200, 300, 400, 500, 600], window: 15, gameGate: 1 },
]

// Smallest threshold still ahead of value, only if within `window`.
export function nearestMilestone(value, thresholds, window) {
  const v = Number(value) || 0
  const next = thresholds.find((t) => t > v)
  if (next == null) return null
  const remaining = next - v
  return remaining <= window ? { threshold: next, value: v, remaining } : null
}

// One entry per stat family currently in range, nearest-first. `stat` is an
// aggregateSplits()-shaped object (hits/homeRuns/rbi/... or
// wins/strikeOuts/saves). Empty array — never null — when nothing's close;
// callers render nothing, matching the rest of the file's no-empty-state rule.
export function milestoneWatchView(stat, group) {
  if (!stat) return []
  return MILESTONE_DEFS.filter((d) => d.group === group)
    .map((d) => {
      const m = nearestMilestone(stat[d.stat], d.thresholds, d.window)
      return m && { ...m, stat: d.stat, label: d.label }
    })
    .filter(Boolean)
    .sort((a, b) => a.remaining - b.remaining)
}
```

`doubles`/`stolenBases` aren't in `aggregateSplits`'s hitting output today
(`src/api/person.js` ~line 249-263) — add them to the summed fields there
(both are already present on the raw stat object, just not carried
through).

Windows/gates above are a starting point, not gospel — `doubles`/`SB`/`RBI`/
`runs` milestone conventions are less standardized than hits/HR/300-win/
3000-K, so treat those thresholds as a first cut to sanity-check against
real players in verification (§5), not a fixed spec.

**Verification (no test runner in this repo — see CLAUDE.md):** a short
`node --input-type=module -e "..."` snippet importing `nearestMilestone`/
`milestoneWatchView` from `src/api/person.js` with hand-built stat fixtures
(e.g. `{ hits: 1996 }` → expect `{ threshold: 2000, remaining: 4 }`;
`{ hits: 1900 }` with `window: 50` → expect `null`; a value already past
every threshold → `null`). Run this by hand once during implementation, not
committed as a script (matches how the rest of `person.js`'s pure functions
are checked — no existing unit-test harness to extend).

## 2. asOf correctness on the player page

**The hazard.** `loadPlayer.js` fetches `careerSplits` via
`fetchPersonStats(id, { type: 'career', group, sportId: careerSportId })`
(~line 210) — the API's `stats=career` type takes no `startDate`/`endDate`
and always returns the player's live, up-to-the-minute career total. Inside
`buildBlock` (`src/api/person.js` ~line 1354-1395), `const career =
aggregateSplits(careerSplits, group)` is exactly this live value — it
currently only feeds `careerRegisterView`'s MLB total row (labeled "not
frozen" per the file-header comment), never exposed as a raw field. Feeding
`career` straight into `milestoneWatchView` would leak: viewing an *old*
game's player-page link (`asOf` set to a past date) would show the
countdown as of *today*, revealing a milestone reached in a later game the
user hasn't gotten to yet.

**The fix — reuse the already-safe pieces instead of `career`.** Two
things `loadPlayer.js` already computes ARE cutoff-safe:
- `mlbYbySplits` — year-by-year splits, fetched once per block (~line 217).
  Every row for a season strictly before the current one is immutable
  history (that season already ended), so it's safe regardless of `asOf`.
- `tileStat` (passed into `buildBlock` as `tileStat`) — the current
  season's stat, resolved via `resolveCurrentSeasonStat` using
  `byDateRange` with `startDate`/`endDate = dayBefore(asOf)` (~line 85-96,
  206-233). This IS properly cut off at "entering today."

This is the exact computation `careerRegisterView`'s *fallback* path
already performs safely (`aggregateSplits(mlbStints.map(...), group)`,
~line 731) when no `careerStat` is supplied — it's just currently shadowed
by the live `careerStat` when present. Add a small sibling pure function in
`src/api/person.js`, next to `careerRegisterView`:

```js
// The MLB career total AS OF the page's cutoff — every full season before
// `currentSeason` (immutable, already fetched via mlbYbySplits) summed with
// the date-cut current-season stat (tileStat), instead of the API's live
// `career` stat type, which cannot be date-cut and would leak a milestone
// reached in a not-yet-revealed later game. Null when the player has never
// played at the MLB level this season (tileSportId !== 1) — MiLB action
// doesn't count toward an MLB milestone, and a stale prior-MLB total would
// misrepresent "as of right now."
export function mlbCareerThroughCutoff({ mlbSplits, tileStat, tileSportId, currentSeason }, group) {
  if (tileSportId !== 1) return null
  const priorSeasons = (mlbSplits ?? []).filter((s) => Number(s.season) < currentSeason)
  const rows = [...priorSeasons, { stat: tileStat }]
  return aggregateSplits(rows, group)
}
```

**Hook point.** Inside `buildBlock` (`src/api/person.js` ~line 1368), after
`tileWar`:

```js
const milestoneStat = mlbCareerThroughCutoff({ mlbSplits: mlbYbySplits, tileStat: tile, tileSportId: currentSportId, currentSeason }, group)
```

and add `milestones: milestoneWatchView(milestoneStat, group)` to the
returned block object. `buildBlock` already receives `mlbYbySplits` and
`currentSeason`/`currentSportId` as params (`mlbYbySplits`,
`currentSeason`, `currentSportId` are already in its destructured argument
list) — **no new fetch, no new param threading through `loadPlayer.js`**,
confirming the enhancement proposal's "zero new fetches" claim.

## 3. The callout half (gen-callouts.mjs)

**Where it slots in.** `hitterEnrich(personId)` (`scripts/gen-callouts.mjs`
~line 402-465) already fetches `stats=gameLog,career&group=hitting&season=
${season}` in one request and parses the `career` split into `careerLine`
(~line 451-462, currently only `pa/ab/h/hr/bb/xbh/avg`). Add the missing
raw fields already present on `cSt` (`doubles`, `rbi`, `stolenBases`,
`runs`) to that parse, then compute the milestone the same way the player
page does — **import `MILESTONE_DEFS`/`nearestMilestone` from
`src/api/person.js`** rather than re-deriving the threshold table (this
script already imports app code for the same single-source-of-truth reason
— see `gen-minors-leaders.mjs`'s import of `combineToPool`/
`computeLeaders`). Use `def.gameGate` (not `def.window`) — the callout
needs the tight single-game-plausible distance, not the wide player-page
window:

```js
import { MILESTONE_DEFS, nearestMilestone } from '../src/api/person.js'
...
const milestone = MILESTONE_DEFS
  .filter((d) => d.group === 'hitting')
  .map((d) => nearestMilestone(cSt[apiFieldFor(d.stat)], d.thresholds, d.gameGate) && { ...m, stat: d.stat, label: d.label })
  .filter(Boolean)
  .sort((a, b) => a.remaining - b.remaining)[0] ?? null
```

attached as `hitterLines[id].milestone` (~line 725, alongside the existing
`career` field).

`pitcherEnrich` (~line 534) currently fetches gameLog only, no `career`
stat type — extend its query to `stats=gameLog,career&group=pitching&
season=${season}` (mirroring `hitterEnrich`'s exact shape) and run the same
`nearestMilestone` sweep over the `pitching`-group `MILESTONE_DEFS` entries
(wins/strikeOuts/saves), attached as `pitcherLines[id].milestone` (a new
sibling map alongside wherever `starterRecords` is built, joined into
`outGames[gamePk]` the same way at the final per-game loop, ~line 677).

**Output bundle shape.** Add `milestones: {[playerId]: {stat, label, value,
threshold, remaining}}` to `outGames[gamePk]` (merging the hitter and
pitcher maps), documented in the JSDoc header comment at the top of
`src/api/callouts.js` alongside the existing `leaders`/`starterRecords`/
`teamRecords` shapes.

**Note copy.** Match the existing `CalloutNote` shape (`{ text, personId,
side, oppSide }`, `src/api/callout-notes.js` header) — but this is a
*pregame staging* fact, not a per-atbat/box-score note, so it doesn't run
through `buildCallouts`/`computeGameCalloutNotes` (those are keyed to
at-bat/whole-game reveal contexts that don't exist pregame). Add a small
reader alongside `calloutsForGame` in `src/api/callouts.js`:

```js
// text e.g. "4 hits shy of 2,000 for his career"
export function milestoneTextFor(bundle, gamePk, playerId) {
  const m = calloutsForGame(bundle, gamePk)?.milestones?.[playerId]
  if (!m) return null
  const noun = m.stat === 'wins' || m.stat === 'saves' ? m.label
    : m.remaining === 1 ? m.label.replace(/s$/, '') : m.label
  return `${m.remaining} ${noun} shy of ${m.threshold.toLocaleString('en-US')} for his career`
}
```

(exact pluralization/wording is a render-time nicety — the important part
is the bundle shape and the single `nearestMilestone`/`MILESTONE_DEFS`
source of truth shared with the player page).

**Plausibility gate.** `gameGate` per stat in `MILESTONE_DEFS` (§1) — e.g.
≤4 hits, ≤2 HR, ≤1 win/save, ≤8 strikeouts. Deliberately generous for
strikeouts (a start can plausibly rack up 8+ Ks) and tight for wins/saves
(binary — either happens or doesn't, once per outing).

**MiLB behavior.** No new guard needed — `gen-callouts.mjs` is already
hard-coded MLB-only end to end (`sportId=1` in the slate fetch, ~line 581,
and in `fetchRoster`'s hydrate, ~line 230); a MiLB game never gets a bundle
at all, so its lineup page simply shows no milestone pill (same as every
other callout family today).

**Timing caveat (inherit, don't fix):** the cron runs ~7am ET
(`.github/workflows/update-nightly-data.yml`), well before lineups post, so
`hitterEnrich`/`pitcherEnrich` sweep the full active roster, not the
confirmed starting nine — identical to how the existing leader/streak
notes already work. A milestone pill may appear for a player who ends up
not starting; acceptable, matches existing behavior, not a regression.

## 4. Render placement

**Player page** (`src/screens/PlayerPage.jsx`) — near the career register,
per the proposal's "small line," reusing the `hint`/`hint reg-footnote`
token already used for `conversionNote` (~line 178) and the register's own
footnote, rather than a new `Firsts`-style card with its own
`SectionTitle`:

```jsx
{block.register && <CareerRegister register={block.register} />}
{block.milestones.map((m) => (
  <p key={m.stat} className="hint reg-milestone">
    {m.value.toLocaleString('en-US')} {m.label} — {m.remaining} shy of {m.threshold.toLocaleString('en-US')}
  </p>
))}
```

`block.milestones` is `[]` (never absent/null — see §1) when nothing's in
range, so the `.map` naturally renders nothing — no empty state, matching
`conversionNote`'s `&&`-guarded convention. Add a `.reg-milestone` rule
next to the existing `.reg-footnote`/`.reg-convert` rules in
`src/index.css` (same visual weight, no new token vocabulary needed).

**Lineup pages** (`src/screens/TeamInfo.jsx`, and the wide-layout
`LineupSpread` in the same file) — a new `MilestonePill` component,
sibling to `ProspectPill` (`src/components/ProspectPill.jsx`), rendered
inside the `lineup.map` row (~line 404-417) next to the existing
`ProspectPill`/`BirthdayCake`:

```jsx
<ProspectPill {...prospectBadge(prospectsData, p.id)} />
<MilestonePill text={milestoneTextFor(callouts, feed.gamePk, p.id)} />
<BirthdayCake show={birthdayIds.has(p.id)} />
```

`MilestonePill` renders `null` when `text` is falsy (mirrors
`ProspectPill`'s "renders nothing, splice in unconditionally" contract).
Also worth adding to the opposing-starter tile (~line 498, where
`ProspectPill` already renders for `oppPitcher`) since a starter close to a
win/K/save milestone is exactly the broadcast-crew fact this feature is
for — same `MilestonePill` component, same prop.

**Wiring the data through.** `callouts`/`gameCallouts` is fetched once in
`useGameData.js` and already threaded into `InningViewer`/`BoxScore` from
`GameView.jsx` (~line 228, 239) but NOT into `TeamInfo`/`LineupSpread`
today. Add `callouts={gameCallouts}` to both `<TeamInfo>` call sites
(~line 179, 198) and to `<LineupSpread>` (~line 163), then thread it down
through `TeamPanel` → `TeamSections` (`src/screens/TeamInfo.jsx`) as a new
prop, same pattern as `prospectsData`/`formerTeammatesData` already follow
end to end.

## 5. Verification plan

1. **Pick 2-3 real players near a milestone right now** — don't guess;
   look them up live at implementation time via
   `GET /api/v1/people/{id}/stats?stats=career&group=hitting` (or
   `pitching`) for a few known active-milestone-chase names, confirm which
   ones currently sit inside a `window` from §1, and note their exact
   career totals for the fixture check in §1's verification snippet too.
2. `node scripts/gen-callouts.mjs 2026-07-11` (or the next date with a real
   slate) locally, then `cat public/data/callouts/07112026.json | jq
   '.games[].milestones'` (or similar) to confirm the bundle shape and that
   the chosen players' entries appear with sane `remaining`/`threshold`
   values.
3. `npm run dev`, open one of those players' player page directly
   (`/player/{id}` or however the route resolves bare links) and confirm
   the MILESTONE WATCH line renders with the right text and no empty state
   for players NOT near a milestone.
4. **asOf regression check (the actual point of §2):** find a player who
   crossed a milestone in the last few days, open an OLD game's player-page
   link from *before* he crossed it (`asOf` = a past date), and confirm the
   countdown still shows him short of the milestone — not already past it.
   This is the one test that actually exercises the spoiler-safety fix; a
   bare/current player-page link alone won't catch a regression here.
5. Open a lineup page (`TeamInfo`/wide `LineupSpread`) for a game whose
   roster includes one of the chosen players and confirm the
   `MilestonePill` renders next to his name with sensible copy, and that a
   MiLB game's lineup page shows no pill (no bundle exists).

## Files expected to touch

- `src/api/person.js` — `MILESTONE_DEFS`, `nearestMilestone`,
  `milestoneWatchView`, `mlbCareerThroughCutoff`; add `doubles`/
  `stolenBases` to `aggregateSplits`'s hitting output; add `milestones` to
  `buildBlock`'s returned block.
- `scripts/gen-callouts.mjs` — extend `hitterEnrich`'s `careerLine` parse;
  extend `pitcherEnrich`'s fetch to include `career`; compute + attach
  `milestone` per player; add `milestones` map to `outGames[gamePk]`.
- `src/api/callouts.js` — `milestoneTextFor` (or similar) reader; JSDoc
  update for the new bundle field.
- `src/screens/PlayerPage.jsx` — render `block.milestones` near
  `<CareerRegister>`.
- `src/index.css` — `.reg-milestone` rule (+ `.milestonepill`/similar for
  the lineup-page pill).
- `src/components/MilestonePill.jsx` (new) — sibling to `ProspectPill.jsx`.
- `src/screens/TeamInfo.jsx` — thread `callouts` prop through
  `TeamPanel`/`TeamSections`; render `MilestonePill` in the lineup row and
  the opposing-starter tile.
- `src/screens/GameView.jsx` — pass `callouts={gameCallouts}` to the two
  `<TeamInfo>` call sites and `<LineupSpread>`.
