Status: needs-triage

# Watch-highlight bottom sheet on revealed plate appearances

## Summary

Add a "▶ Watch highlight" affordance to `AtBatCard` (`src/components/PlayByPlay.jsx`)
that, when a play has a matching MLB.com clip, opens an iOS-style bottom
sheet with the embedded video. Data source and join mechanism verified live
2026-07-12 against gamePk 823357 — see the research note. Presentation
decision (bottom sheet over modal/inline-accordion/highlights-rail) recorded
in `../PRD.md`.

## 1. Data layer — new reveal-only module

New `src/api/highlights.js`, joining the root `CLAUDE.md`'s spoiler-rule list
next to `linescore.js` / `derive.js` (callable only from inside a `SealBox`'s
reveal render, never at render top-level or in an eager `useMemo` — ADR-0001).

```js
export async function fetchHighlights(gamePk) {
  try {
    const data = await getJson(`/api/v1/game/${gamePk}/content`)
    return data?.highlights?.highlights?.items ?? []
  } catch {
    return []
  }
}

// guid (content) === playId (feed/live playEvents[]) for the same play —
// the only reliable join key (verified 2026-07-12, gamePk 823357).
export function highlightsByPlayId(items) {
  const map = new Map()
  for (const item of items) {
    if (item?.guid) map.set(item.guid, item)
  }
  return map
}
```

No per-play selector needed beyond a `Map` lookup — `computeHalfInningFeed`
(see §2) already threads `playId` onto each at-bat card.

**Fetch timing**: lazily, alongside `fetchGameFeed` in `GameView` (mirrors
`fetchWinProbability` / `game.js`'s existing lazy, score-revealing fetches —
see `src/api/game.js`'s header comment on why those don't fire until the game
view mounts). Store the raw `items` array in `GameView` state and thread it
down to `InningViewer` → `HalfInning` → `PlayByPlay` alongside `feed`. **The
fetch itself firing is not a spoiler** (nothing from it enters the DOM yet) —
only turning a `guid` into a rendered button is. Same reasoning already
governs `game.js`'s WPA fetch.

## 2. Thread `playId` onto each at-bat card

`src/api/playbyplay.js`'s `computeHalfInningFeed` already iterates
`play.playEvents` to build `pitches`/`pitchDetails` (~line 585). Add capturing
the **terminal pitch's** `playId` (the in-play pitch, or the final called
ball/strike — same definition the research note verified) onto the `card`
object built at ~line 616:

```js
const terminalPitch = pitchEvents[pitchEvents.length - 1]
// ...
const card = {
  kind: 'atbat',
  playId: terminalPitch?.playId ?? null,
  ...
}
```

**Verified 2026-07-12** against gamePk 823357: the terminal-pitch join holds
for strikeout-ending plays too, not just the batted-ball case the original
research checked. Confirmed two independent examples —

| Play | atBatIndex | Terminal pitch call | `playId` == clip `guid`? |
|---|---|---|---|
| Ashcraft SO Mitchell (swinging), `guid 91e64da6-96c6-3061-86a6-40bda765f802` | 21 | Swinging Strike | match |
| Sproat SO Reynolds (called), `guid 9f9d4f56-5749-35c0-b2c7-487d48169255` | 23 | Called Strike | match |

— in both cases the matching `playId` is `pitchEvents[pitchEvents.length - 1]`,
exactly what `terminalPitch` above picks. No special-casing needed for
strikeouts vs. batted balls. (Walks/HBP-ending plays not spot-checked, but
lower priority — highlight coverage for those is rare per the Coverage
caveat below, and the mechanism is the same "last pitch event" either way.)

## 3. Rendering gate — no clip enters the DOM before its play is revealed

`AtBatCard` already only exists inside `HalfInning`'s `SealBox` reveal render
(`revealDerived(...)` → `PlayByPlay` → `AtBatCard`), so a button rendered
inside `AtBatCard` is already behind the seal by construction — no extra gate
needed at that layer. The one thing to get right: **`highlightsByPlayId` must
be computed from the already-fetched `items` array, not trigger a fetch itself**,
so nothing about *reveal timing* changes vs. today's `revealDerived` contract.

Wire `highlightsMap` (built once per game, not per half — `useMemo` in
`GameView` or `InningViewer` over the raw `items`, cheap) down through
`HalfInning` → `PlayByPlay` → `AtBatCard` as a plain prop. In `AtBatCard`:

```js
const highlight = entry.playId ? highlightsMap.get(entry.playId) : null
```

`highlight` is `undefined`/`null` for the overwhelming majority of plays
(routine outs/singles have no clip — see the research note's Coverage
caveat) — the button simply doesn't render. No "highlight coming soon"
placeholder (matches the app's existing "absent field ⇒ render nothing"
convention, e.g. `uniforms.js`, `vsTeamSplits.js`).

**No thumbnail/poster preview before tap.** A poster frame (e.g. a player
mid-home-run-trot vs. mid-groundout) is itself spoiler-shaped — the button
must be plain text/icon only ("▶ Watch highlight"), never rendering
`trickplay` or any `playbacks[]` URL until the user taps it.

## 4. The bottom sheet

New `src/components/HighlightSheet.jsx` — an iOS-style sheet, not a generic
modal:

- Slides up from the bottom, partial height (enough for a 16:9 video + a
  one-line caption; don't cover the whole viewport).
- Dismiss via a close button AND swipe-down / backdrop tap. If drag-to-dismiss
  interaction/momentum polish is wanted, this is `apple-design` skill
  territory (interruptible transitions, momentum) — flag for a design pass
  rather than hand-rolling spring physics from scratch.
- Respect safe-area insets (`env(safe-area-inset-bottom)`) — this is an
  installable PWA on iPhone; the existing sketch-modal in `GameView` may
  already have a safe-area pattern to copy from.
- `<video controls playsInline src={playbackUrl} poster={undefined}>` — no
  `poster` prop (see spoiler note above). Pick the `hlsCloud` /
  `HTTP_CLOUD_WIRED` playback (native HLS support in Safari on iPhone — no
  `hls.js` dependency needed per the PRD's non-goals) with `mp4Avc` as a
  fallback `<source>` for any non-Safari engine that lands here.
- Only fetches/mounts the `<video>` element on tap-open — lazy per §3.
- One instance reused across the page (open/close via state), not one sheet
  per card — mirrors how `StrikeZoneModal` (`StrikeZone.jsx`) is already
  reused across `AtBatCard` instances; check that component for the existing
  single-open-instance pattern before inventing a new one.

`AtBatCard` gets a small state hook (`const [sheetOpen, setSheetOpen] = useState(false)`)
or, if sheet state is lifted to `PlayByPlay` (recommended, matching the
`StrikeZoneModal` precedent if it's lifted there) — check that file's
existing zone-modal wiring first and follow whichever pattern it already
uses, don't invent a second modal-state convention in the same file.

## 5. Styling

New tokens/classes in `src/index.css` (or a `highlights.css` partial imported
there, matching how other feature-specific styles are organized — check
existing partial boundaries before deciding). Reuse existing semantic
variables (`--surface-card`, ink/graphite tones) rather than new hex, per
root `CLAUDE.md`'s styling convention. The "▶ Watch highlight" button should
read as a small secondary action on the card (not competing with the RBI
badge / out notation), consistent weight with `pbp__zonebtn` (the existing
strike-zone icon button in the same card) — likely lives in the same
bottom-left card whitespace area.

## 6. Spoiler audit checklist (must all be true before merge)

- [ ] `fetchHighlights` firing (the network call) never puts a clip's
      `title`/`description`/`guid` into the render tree — only the fetch
      result state, which is inert until §3's lookup happens inside an
      already-revealed `AtBatCard`.
- [ ] No `poster`/thumbnail image renders before tap.
- [ ] The "Watch highlight" button's own label is generic, not the clip's
      title (never render `highlight.title` or `.description` as visible
      text on the unopened button — only after the sheet is open, where the
      play itself is already revealed prose on the card above it, so the
      clip's title carries no additional spoiler risk at that point).
- [ ] A half that is not yet revealed never renders a highlight button, even
      transiently (confirm via the same manual "does this leak on the
      sealed page" check the other reveal-only work uses).

## Where this touches

- `src/api/highlights.js` (new) — fetch + join, reveal-only.
- `src/api/playbyplay.js` — thread `playId` onto each at-bat card
  (`computeHalfInningFeed`, ~line 616).
- `src/screens/GameView.jsx` — lazy `fetchHighlights(gamePk)` alongside the
  existing lazy game-feed fetch; thread `items`/`highlightsMap` down.
- `src/screens/InningViewer.jsx` / `src/components/HalfInning.jsx` — pass
  `highlightsMap` through to `PlayByPlay`.
- `src/components/PlayByPlay.jsx` (`AtBatCard`) — the button + sheet-open
  wiring.
- `src/components/HighlightSheet.jsx` (new) — the sheet + video element.
- `src/index.css` / a new partial — button + sheet styling.

## Verification plan

1. Use `docs/test-games.md` or a fresh gamePk with a known HR — confirm the
   button appears only on that play's card, only after reveal, and opens a
   sheet that actually plays the clip on an iPhone (Safari — PWA install if
   possible, per root `CLAUDE.md`'s screenshot-unreliable-in-sandbox note).
2. Confirm a routine single/groundout play renders no button.
3. Strikeout-clip join already verified in §2 (2026-07-12, gamePk 823357) —
   sanity-check one strikeout highlight end-to-end in the running app anyway
   as part of this pass, since §2's check was against raw API responses only.
4. Confirm sealed (unrevealed) halves show zero highlight buttons — tap
   through from a fresh game load, inspect the DOM before revealing.
5. `npm run lint` / `npm run build` before pushing (root `CLAUDE.md`).

## Comments
