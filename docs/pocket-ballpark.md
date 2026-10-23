# Pocket Ballpark: a technical write-up

A reference for future work on Gameday (#2566) and on 3D players with uniform skins (#2580).

| | |
|---|---|
| Project | Pocket Ballpark, <https://github.com/WilhelmWillie/baseball> (author: WilhelmWillie) |
| Version studied | commit `40fce1b7c`, 2026-09-22. This was the head of the default branch on 2026-10-23. |
| Licence | **None.** The repo has no `LICENSE` file. Treat it as all rights reserved. Read it. Do not copy its code. This document records ideas and observed behavior in our own words. |
| How it was studied | Shallow clone. Three readers each read one slice in full: the animation layer; data, replay and server; scene and rendering. We then re-checked the load-bearing claims ourselves (tag **[mine]**). **Nobody installed or ran it.** The live-API numbers were measured by us against `statsapi.mlb.com`. |
| Written | 2026-10-23, by a cloud session, for Gary |

**Words.** In this repo, "Gameday" means our screen (#2567). "MLB Gameday" means MLB's own product. Pocket Ballpark does not use either word for itself. It calls its screen "the viewer".

**How to read the evidence tags.**

- **[code]** A reader found the claim in source at the pinned commit. A `file:line` follows when it helps. A claim with no tag is [code] unless its sentence says otherwise.
- **[doc]** The claim comes from the project's own docs (`README.md`, `docs/*.md`). We did not re-measure it.
- **[mine]** We re-checked it ourselves, by reading the line, by a grep, or by measuring against the live API. The date follows.
- **Inference:** a guess. Nobody checked it.

**How to read paths.**

- A path that starts with `pb:` is a path inside the Pocket Ballpark repo (for example `pb:src/lib/game/events.ts`).
- A path that starts with `src/`, `docs/`, `scripts/` or another root folder, with no prefix, is a path in Tally. The repo's doc-path guard checks those.
- A path with no root folder (for example `lib/game/events.ts` or `director.ts:1142`) is inside Pocket Ballpark, relative to its `src/` folder. A number after a colon is a line number at the pinned commit.

## Contents

1. What it is
2. Why we keep this document
3. Stack, size and layout
4. The four layers and the data flow
5. The feed adapter
6. Normalization: snapshot and events
7. The store and the promotion rule
8. The live driver
9. Replay
10. The server layer
11. The director: how events become animation
12. Pitches, batted balls, gaits
13. Cameras
14. The scene: park, crowd, sky, effects
15. The player rig and uniforms
16. HUD, audio, sharing
17. Feed edge cases the author found
18. Constants worth remembering
19. Strengths, weaknesses and known gaps
20. How it maps to Tally
21. Reading order and "where to change what"
22. Open questions

## 1. What it is

Pocket Ballpark is a web app that **animates real MLB games** in a low-poly 3D ballpark. It does not simulate baseball. It reads the public Stats API, turns the feed into its own vocabulary, and plays that vocabulary as animation. [doc: `README.md`]

- Live games open in a live viewer. Finished games open as a replay. A game before first pitch stays closed, because the feed has no lineup yet. [doc]
- Any finished game of the 2026 season is watchable. The browser rebuilds the replay from the final feed. Nothing is recorded or stored. [doc: `pb:docs/SEASON-REPLAY.md`]
- Home clubs play as aliens and visitors as robots, in team colours. [doc]
- It has a directed TV-style camera, weather and time of day from the feed, a crowd, synthesized sound, and share links for single plate appearances. [doc]

The idea in one line:

```
MLB Stats API -> adapter -> normalized events -> animation queue -> three.js
```

[doc: `README.md`]

## 2. Why we keep this document

- Gary called it "very close to the overall vibe I'm looking for from the structure and bones of it" (2026-10-23, #2580).
- Gameday (#2566) is a turn-based, reveal-on-tap screen with a fresh stage (#2568), a chase camera (#2569), a pitch-by-pitch mode (#2570) and event steps (#2571). Pocket Ballpark solves neighbours of those problems: when to show a result, how to hold a pitch until its result arrives, how to rebuild the past from a final feed, and how to point a camera at a ball.
- It has no seal. It shows everything as it plays. It does not answer Tally's spoiler rule. Section 20 says what ports and what does not.

## 3. Stack, size and layout

**Dependencies** [code: `package.json`]: Next.js 16.3.0 (App Router), React 19.2.8, three ^0.185.1, `@react-three/fiber` ^9.7.0, `@react-three/drei` ^10.7.8, zustand ^5.0.14, `fast-json-patch` ^3.1.1, `posthog-js`. Dev: TypeScript (`strict`), Tailwind 4, `tsx`, `sharp`, ESLint.

**Scripts** [code]: `dev`, `build`, `start`, `lint`, `favicon`, `record` (capture a game), `validate-season` (rebuild every game of a date range).

**No tests.** The repo has no test files. Replaying real games is how the author checks the animation path, and `validate-season` is the nearest thing to a test suite. [code: no `test`/`spec` files; doc: `pb:docs/ARCHITECTURE.md`]

**No model files.** The repo has no `.glb`, `.gltf`, `.fbx`, `.obj` or `.blend`. Every figure and the whole park are built in code. [mine, 2026-10-23, by listing tracked files]

**Size** [mine, 2026-10-23, line counts of the pinned commit]:

| Area | Lines |
|---|---|
| `pb:src/lib/anim/` (director, batted ball, gait, pitches, particles, views) | 4,326 |
| `pb:src/components/scene/` and `pb:src/lib/field/` | 7,656 |
| `pb:src/lib/game/`, `pb:src/lib/mlb/`, `pb:src/lib/replay/` (the data side) | 4,092 |
| `pb:src/lib/anim/director.ts` alone | 2,710 |
| `pb:src/components/scene/Player.tsx` alone | 2,069 |
| `pb:docs/` (three files) | 1,306 |

Two files dominate. The data side is about a quarter of the weight. Most of the effort is in making figures and the park look good.

**Directory map** [code, confirmed by `pb:docs/ARCHITECTURE.md`]:

```
src/
  app/          routes and API proxies (App Router)
  components/   HUD (plain DOM) and scene (React Three Fiber)
  hooks/        useLiveFeed and useReplay: the two feed drivers
  store/        gameStore.ts: the snapshot-promotion rule
  lib/
    mlb/        raw Stats API: client, response types, team palettes
    game/       normalization: feed -> snapshot + events
    anim/       the director, pitch shapes, batted ball, gait, particles, camera seats
    field/      field math, park construction, sky and weather
    audio/      Web Audio synthesis
    replay/     reconstruction, recording format, playback
    share/      data for share cards
    brand/      share-card drawing
scripts/        record-game.ts, validate-season.ts
docs/           ARCHITECTURE.md, RECORDING.md, SEASON-REPLAY.md
```

**Routes** [code: `pb:src/app/`; doc: `pb:docs/ARCHITECTURE.md`]:

| Route | Job |
|---|---|
| `/` | Today's slate (live first), the last nine finished games, a way into every other day |
| `/about` | Static page |
| `/games/[date]` | One day of the season, server-rendered, bounded by Opening Day and today |
| `/watch/[gamePk]` | The viewer. Mode comes from the game's status: live tunes in, final replays, not started shows a card |
| `/watch/[gamePk]/at/[atBatIndex]` | The same game cued to one plate appearance (what the share button hands out) |
| `/clip/[gamePk]/[atBatIndex]` | One play on its own, ending on a share card |
| `GET /api/games` | Schedule for a day, live first. Never returns 500 |
| `GET /api/games/recent` | The last nine finished games. Memoized for a minute |
| `GET /api/game/[gamePk]` | Feed proxy and the source of a replay |
| `GET /api/clip/[gamePk]/[atBatIndex]` | One plate appearance cut out of a feed |

## 4. The four layers and the data flow

```
statsapi.mlb.com
      |
lib/mlb/        fetch and typed access to the raw feed
      |
lib/game/       feed -> GameSnapshot (the world now)
                     -> NormalizedEvent[] (what just happened)
      |
lib/anim/       events -> timed animations; owns every actor's transform and pose
      |
components/scene/   React Three Fiber; reads the director on every frame
```

**The rule that matters:** the renderer never sees MLB's JSON. Everything below `lib/game/` speaks in `GameSnapshot` and `NormalizedEvent`. [doc: `pb:docs/ARCHITECTURE.md`; code: the store, `pb:src/store/gameStore.ts`]

Why this boundary pays:

1. A feed change breaks one layer, not the scene.
2. Replay and live use the same path. A replay is a feed that arrives in pieces.
3. The animation code can be tested (or at least replayed) without a network.

Three data shapes carry the design. All three live in `pb:src/lib/game/types.ts` [code]:

- **`GameSnapshot`**: the renderer's whole view of the world. It holds status flags, venue, conditions (hour, weather, wind), both teams, score, hits, errors, inning and half, count and outs, the defense by position, the batter, the on-deck hitter, runners by base, bench and bullpen, the line score, the last play text, the last located pitch, and both box scores.
- **`NormalizedEvent`**: a union of four kinds. `PitchEvent`, `PlayResultEvent`, `ActionEvent` (steals and similar), `InningChangeEvent`. A `PlayResultEvent` has a small `kind` bucket (single, double, triple, home_run, walk, strikeout, field_out, double_play, error, hit_by_pitch, sac_fly, generic) that the animator switches on.
- **`FeedCursor`**: how far the normalizer has read. It holds the at-bat index, the event index, the list of finished at-bats, the inning and half, and an optional **held pitch** with a timestamp. The hold keeps a pitch back until its result arrives.

`GameSnapshot` is built by a **pure function** of one feed. `NormalizedEvent[]` is built by a **stateful walk** from a cursor. That split is what makes seeking and replay cheap. [code]

## 5. The feed adapter

File: `pb:src/lib/mlb/client.ts`. It is the only file that knows the Stats API URLs. [mine, 2026-10-23, grep of `pb:src/` and `pb:scripts/`]

**Four URLs.** All sit under `https://statsapi.mlb.com/api`. The browser never calls them. All traffic goes through route handlers and server pages. [code]

| Use | Path template | Caching |
|---|---|---|
| Schedule for a date range | `/v1/schedule?sportId=1&startDate=..&endDate=..&hydrate=team,linescore,venue,game(content(summary))` | `no-store` |
| One game's schedule entry | `/v1/schedule?sportId=1&gamePk=..&hydrate=team,linescore,venue` | revalidate 60 s |
| Full feed (GUMBO) | `/v1.1/game/{gamePk}/feed/live` | `no-store` |
| Plays only | `/v1/game/{gamePk}/playByPlay` | revalidate 60 s, or 0 on request |

- It sends `Accept: application/json` and `User-Agent: mlb-3d-viewer`.
- It loads **no** logo, headshot or other MLB host. Team colours are hard-coded in `pb:src/lib/mlb/teams.ts` (the Stats API publishes none).
- The docs sketch a "Tier 2" recorder with the timecode and `diffPatch` endpoints (`pb:docs/RECORDING.md`). Nothing implements it. [doc and code]

**Status helpers** [code, reader's reading]:

| Function | What it does |
|---|---|
| `isLiveStatus` | True if `abstractGameState` is `Live`, or the coded state is `I` or `M`. The comment also lists `P` and `PW` (warmup). Nothing tests them. [mine, 2026-10-23] |
| `isCalledOffStatus` | True if the coded state is `D` or `C`, or `detailedState` matches postponed or cancelled. |
| `isFinalStatus` | True if `abstractGameState` is `Final` and the game is **not** called off. |
| `easternDate(offsetDays)` | Formats now plus `offset x 24 h` in `America/New_York`. MLB's schedule day runs on US Eastern, so "today" is not the local date. Inference: near a daylight-saving change, "yesterday" can land two days back. `shiftDay` in `schedule.ts` avoids this by anchoring at noon UTC. |
| `fetchScheduleGame` | Keeps the entries that match the `gamePk`, then prefers live, then final, then any entry that is not called off. Returns `null` for none. |

**Errors.** `getJson` throws `MlbApiError` (it carries `.status`) on any non-2xx reply. There is no retry, timeout or abort, and nothing reads `.status`. Callers turn the error into a 502, a 200 with an `error` field, a fallback to "live", or `null`.

## 6. Normalization: snapshot and events

### 6.1 The snapshot builder

File: `pb:src/lib/game/normalize.ts` (`buildSnapshot`, `buildHistory`). It is a pure function of one feed. The only impurity is `updatedAt`, which is `Date.now()`. Every field is optional-chained with a default. [code]

| Snapshot field | Feed source |
|---|---|
| Players (side, number, position) | `liveData.boxscore.teams.{home,away}.players` |
| Players (name, hands, primary position) | `gameData.players` |
| Teams | `gameData.teams`. The name falls back through `teamName`, `clubName`, `name`, then "Home" or "Away". The abbreviation falls back to the palette. |
| Status | `gameData.status`. Abstract defaults to `Preview`. |
| Defense | `linescore.defense[position]` |
| Runners | `linescore.offense.first / second / third` |
| Batter | `offense.batter`, else `linescore.defense.batter` |
| On deck | `offense.onDeck` |
| Count and outs | `linescore.balls / strikes / outs`, default 0 |
| Inning | `currentInning ?? 1`, `currentInningOrdinal ?? "1st"`, `inningState ?? "Top"` |
| Sides | The top half means the home team fields and the away team bats. |
| Line score | One entry per `linescore.innings` item. Runs are `null` if missing. |
| Score, hits, errors | `linescore.teams.*`, default 0 |
| Last play | The last play that is complete and has a description |
| Last pitch | `trackedPitch(feed)` (section 6.2) |
| Box scores | `battingOrder`, else `batters`; pitchers from `pitchers`; W, L and S from `liveData.decisions`. Missing stats default to 0, IP to "0.0", average and ERA to a dash. |
| Bench and bullpen | Ids resolved through the player index, with a `#id` name fallback |
| Venue | `gameData.venue.name`, default "Ballpark" |

Details:

- A switch hitter (code `S`) has no `batSide` in the player index, because only `R` and `L` are accepted.
- A player missing from the box score gets `side: "home"`.
- **Final status.** `statusFinal` is true if the abstract state is `Final`, or the coded state is `F` or `O`, or `detailedState` matches final, game over or completed. `isFinal = statusFinal || deriveGameOver(...)`. `isLive = abstract === "Live" && !statusFinal`. The comment says `isLive` ignores the logical final on purpose, so an overturned last out does not drop polling to the idle rate. (`normalize.ts:273`–`:305`)
- **`deriveGameOver`** (`gameOver.ts:31`–`:60`) is a stateless function of inning, half, `inningState`, outs, score and scheduled innings. It is false before the scheduled innings and false on a tie. A walk-off counts as over as soon as the lead is taken. It allows the app to end a game before the feed's own "Final".
- **Doubleheaders** matter here only through `scheduledInnings` (7). `doubleHeader` and `gameNumber` are typed but unused. [code]

**Conditions** (`pb:src/lib/field/sky.ts`, `readConditions`):

- **Hour.** `parseLocalHour` turns the game's local time plus am or pm into a decimal hour. Then the code adds the wall-clock hours since the scheduled start, clamped to 0–5 h. With no parseable time it uses a default of 13.5.
- **Cloud and rain.** First-match regular expressions over `weather.condition`. Cloud falls back to 0.2 if nothing matches and 0.15 if there is no text. Rain is 0.45 for drizzle, 1 for rain or showers and 0.7 for snow. Snow is a separate boolean.
- **Indoor.** True if the condition matches dome or "roof closed". Also true if there is no condition text and the venue name matches a hard-coded list of eight roofed parks.
- **Wind.** `parseWind` reads "N mph" plus one of eight direction phrases. It returns a zero vector if either is missing or the park is indoor. Speed is `mph x 1.47 x 0.55`.
- **Replay lighting bug (confirmed).** `readConditions(input, now = Date.now())` takes the time as a default argument. `buildSnapshot` never passes `now`. For any replay of a past game the elapsed hours clamp to 5, so the hour is always start time plus 5 h and never moves. A 7:05 pm game lights at about midnight. No comment or doc mentions this. [mine, 2026-10-23, `sky.ts:293`–`:305` and `normalize.ts:352`–`:360`]

### 6.2 The event extractor

File: `pb:src/lib/game/events.ts` (592 lines). `extractEvents(feed, cursor)` walks forward from the cursor and returns the events that are new, plus the new cursor. It is the subtle part of the codebase. [code]

**`seedCursor`** (`:336`–`:352`) puts the cursor at the live edge **without emitting events**. It sets the at-bat to the last play and the event to that play's last event. It records every complete play as done. It takes the inning and half from the linescore and clears the hold. If the last play is still open, its existing pitches are skipped but its result still emits when it completes.

**Order.** Plays in array order, skipping those below the cursor's at-bat. Within a play: the play events in order, skipping indices at or below the cursor's event. Then that play's result. Then at most one inning change, last. **Timestamps are never used on the live path.**

**The pitch that ends an at-bat (`deciderIndex`, `:308`–`:326`).**

- It ignores the feed's `count` because the docs conflict about whether it is the count before or after the pitch.
- It recounts. A pitch in play or a hit by pitch ends the at-bat at once. Otherwise it counts balls, called and swinging strikes, and a foul as a strike only when strikes are below 2. It returns the pitch where balls reach 4 or strikes reach 3.
- A foul tip caught for strike three reads as an ordinary foul and is simply not held. The comment accepts this.
- Inference: a foul bunt on two strikes behaves the same way.

**The hold** (`HOLD_TIMEOUT_MS` = 12,000, `:333`; logic `:402`–`:413`). [mine, 2026-10-23]

- When extraction reaches the deciding pitch and the result is not yet published, a hold starts. The cursor keeps the original `since` if it already holds the same pitch.
- While the hold is younger than 12 s, extraction **stops entirely**. Nothing after that pitch, even a later play, is emitted. The cursor stays just behind the pitch, and the next poll re-reads it.
- After 12 s the pitch is emitted alone, and the result arrives later as its own event.
- If the result is already complete, there is no hold. The pitch and the result come out in one call, so the director can fuse them.
- The inning-change check is also suppressed during a hold.

**Pitch events** (`:415`–`:438`).

- The id is `<atBat>-<eventIndex>-pitch`.
- The outcome comes from `pitchOutcome` (`:232`–`:255`): in play first, then call code `H` (hit by pitch), then `isBall`. Call codes `F R L T O` are fouls, `S W M Q` are swinging strikes, `C` is a called strike. Anything else is a called strike if `isStrike`, else "other".
- The plate position is `pX` and `pZ`, defaulting to 0 and 2.5. `located` is true only if both exist. The zone defaults to 3.4 and 1.6 feet.
- The bat side comes from the matchup, so a switch hitter resolves for each plate appearance.
- `count` is copied from the feed. The director's `onCount` callback later rewrites the visible count.

**Action events** (`:440`–`:451`). Any non-pitch event typed "action", or with `details.event`, becomes an `ActionEvent`. That includes advisories, substitutions and steals. Its `runners` array is **always empty** (`:448`) [mine, 2026-10-23]. So steals and pickoffs are not animated from `play.runners`. Inference: they show up only in the next snapshot.

**Kind mapping** (`KIND_MAP`, `:257`–`:282`). Unknown event types become `generic`.

| Kind | Feed event types |
|---|---|
| single, double, triple, home_run, hit_by_pitch | the same name |
| walk | walk, intent_walk |
| strikeout | strikeout, strike_out, and the strikeout double-play and triple-play types |
| field_out | field_out, force_out, fielders_choice, fielders_choice_out, sac_bunt |
| double_play | sac_bunt_double_play, grounded_into_double_play, double_play, triple_play |
| error | field_error, error |
| sac_fly | sac_fly, sac_fly_double_play |

**Result event** (`:459`–`:495`). It is emitted once per at-bat, when `about.isComplete` is true and the id is not yet in the done set. The last play event that has `hitData` builds the ball. Runners go through `normalizeRunners`. RBI, scoring flag, outs and score default to 0. **A play amended later (a replay review) is not re-emitted.** Only the snapshot changes.

**`normalizeRunners`** (`:79`–`:135`). The feed lists one row per credited movement, so one runner can appear many times. The function reduces them to one move per runner: the earliest start base and the furthest end base. The batter starts at "home". Once a runner is out, later rows are ignored. A run counts as step 4. Moves with no movement are dropped.

**The batted ball** (`battedBallFrom`, `:159`–`:216`). Coordinates become field feet with the hit-coordinate conversion (section 18). If the coordinates are missing, or both lateral and depth are near zero, the ball is **made up**:

- The angle comes from regular expressions over the description (left-center -0.38 rad, right-center +0.38, left side -0.62, right side +0.62, center 0, plus a seeded jitter). If none match, a right-handed hitter pulls left at about -0.35 and a left-handed hitter pulls right.
- The distance is `wallDistance(angle) + 20 + seed x 60` for a home run, else `totalDistance`, else `150 + seed x 180`.
- The seed is a 32-bit FNV-1a hash of `atBatIndex:description`, so a play always gets the same made-up ball (`:23`–`:31`).
- The spot is clamped to the field except for home runs. The fielder is the nearest fielder to the spot.
- **Fouls are invented.** `foulBallFor(pitch)` (`:528`–`:536`) uses only the bat side and a hash of the pitch id. Inference: right-handed hitters hit fouls to the left.

**The tracked pitch** (`trackedPitch`, `trackPitch`, `:554`–`:592`). `trackedPitch` scans the current (or last) play backward for the last pitch that has plate coordinates. It returns `null` when a new batter has not been pitched to, which empties the strike-zone box. It exists so a viewer who joins mid-at-bat, or opens a clip, sees the right box. An automatic ball has no coordinates, so it is skipped and the previous real pitch stays up. The store applies `trackPitch` only for a located pitch.

**Inning change** (`:498`–`:511`). It compares the linescore's inning and half with the cursor. The id is `inning-N-top` or `inning-N-bot`.

## 7. The store and the promotion rule

File: `pb:src/store/gameStore.ts` (219 lines). It is a zustand store. It is the one place where "what the feed says" meets "what the screen shows". [code]

**State.**

| Field | Meaning |
|---|---|
| `director` | The animation engine (section 11). A new one is built on every `reset()`. |
| `snapshot` | What the HUD shows. It **trails** the feed. |
| `pending` | The newest snapshot the feed gave. It waits for the animation to catch up. |
| `history`, `pendingHistory` | The play log, with the same visible/pending split. |
| `cursor` | The `FeedCursor` from section 4. |
| `connection`, `error`, `lastUpdate` | Connection state for a badge. |
| `cameraView` | The reader's camera seat. It is a preference and it survives a game change. |

**The invariant.** `snapshot` is what the HUD shows. `pending` is what the feed says. A new snapshot is promoted only when the director's queue has drained. [code and doc: `pb:docs/ARCHITECTURE.md`]

That is why a home run plays as pitch, swing, flight, runners, score. The scoreboard does not jump first.

**Actions.**

- `reset()` builds a new director and wires its callbacks (below). It clears everything else.
- `ingest(feed)` is the heart.
  1. Build the snapshot from the feed (a pure function).
  2. Tell the director early whether the game is final. The third out that ends a game then plays as an ending, not as a change of sides.
  3. **First read:** apply the snapshot to the director and show it at once. Seed the cursor at the live edge. Do **not** replay the game so far. This is also how a viewer who joins mid-game, and a seek, start.
  4. **Later reads:** extract the new events from the cursor and enqueue them.
  5. If the queue is idle, there are no new events and nothing is held, promote the snapshot at once. Otherwise store it as `pending`, and store the new play log as `pendingHistory`.
- `settle()` runs on every frame from the scene's engine loop. If a `pending` snapshot exists, the director is idle and no pitch is held, it promotes `pending` (and its log). A held pitch makes the director look idle, but the world must not skip to the play it is about to animate. So `settle()` also checks the hold.
- `seek(feed)` is `reset()` then `ingest()`. A seek is a cut, and "first read" already does exactly that.
- `failed(message)` sets the error state.
- `setCameraView(view)` stores the camera seat outside `reset()` and remembers it in `localStorage`.

**Three things update early, on purpose.** They describe what is on screen, not what the feed says. The director calls back into the store: [code]

| Callback | Updates | When |
|---|---|---|
| `onCount` | The balls and strikes on the visible snapshot | As each pitch animation resolves |
| `onPitch` | The strike-zone mark (only for a pitch the feed located) | As the ball reaches the plate |
| `onPlayResolved` | The log entry, outs, score, last-play text, and the inning and half of the play | When a play's animation finishes |

`onSound` is a fourth callback. It plays a synthesized sound.

A fourth early update, "at plate", needs no store. The strike-zone box polls the director on a frame loop. [doc]

**Dropping detail to catch up.** If the app falls behind (a hidden tab or a feed hiccup), a queue guard drops pitch-by-pitch detail and keeps the outcomes. The next promoted snapshot corrects the screen. [doc: README, "State never teleports"] The director section says where that guard lives.

**Why it matters for Tally.** Gameday also needs a rule for "what the screen shows now" against "what the data says". Tally's rule is the reveal mark (ADR-0016), not an animation queue. The shape is similar: a visible state that moves only on a permitted trigger. See section 20.

## 8. The live driver

File: `pb:src/hooks/useLiveFeed.ts` (82 lines). [code]

- It polls the proxy route `/api/game/[gamePk]` with `cache: "no-store"`. The browser never calls `statsapi.mlb.com`.
- **Intervals:** 5 s while the game is live, 15 s otherwise, and **1.5 s while a pitch is held** (the field is still, and each poll may release the pitch). The hold has its own timeout (section 6).
- **Backoff:** the delay is multiplied by `min(4, 1 + failures)`.
- **Errors:** it shows an error only after two failures in a row.
- **Visibility:** when the tab becomes visible, it clears the timer and polls at once.
- It does **not** use `diffPatch`, the heartbeat or the push socket. [code: only a full-feed fetch exists]
- The proxy route adds a 3 s in-memory cache so many viewers of one game do not multiply the load on the Stats API (section 10).

Inference: a laptop that sleeps and wakes recovers through the visibility handler, not through any special logic.

For a faster path, see Tally's #2578 (a spike on websocket push). Facts we checked: the feed's `metaData.wait` is `10` and the response says `cache-control: max-age=10` (measured 2026-10-23 on gamePk 849841). Inference: a poll faster than the suggested 10 s gains little, because a shared cache may serve the same response for 10 s.

## 9. Replay

The idea: **a finished game is already a recording.** The final feed carries every play, every pitch and a timestamp for each. The browser rebuilds what the feed looked like at each moment, then plays those moments through the same store and director as a live game. [doc: `pb:docs/SEASON-REPLAY.md`]

### 9.1 Reconstruction (`pb:src/lib/replay/reconstruct.ts`, 633 lines)

`reconstructFrames(feed)` takes one final (or live) feed and returns time-ordered **frames**. Each frame is a full feed. [code]

1. **Start state.** The starting defense (`:137`–`:172`) comes from players whose `battingOrder` ends in "00". If fewer than eight are found, it falls back to the batting order using each player's primary position. The starting pitcher is `pitchers[0]`. DH, PH and PR map to no field slot.
2. **Time** (`push`, `:309`–`:315`). The origin is the first frame. A frame's time is its event time minus the origin, or the previous time plus 1,000 ms if the event has no timestamp. It is at least 200 ms after the previous frame.
3. **Each new half-inning** (`:433`–`:468`). A "between" frame goes in at the previous play's end time plus 1,000 ms. `inningState` becomes "Middle" or "End" while the old `isTopInning` stays. Bases clear.
4. **Each play event** (`:475`–`:559`).
   - Substitutions apply first, matched by the substitute's own side, so a double switch lands correctly.
   - Events before the first pitch are skipped. Without this, pregame advisories moved the start and a nine-inning game reported 5.5 hours (SEASON-REPLAY doc).
   - On the first pitch of each at-bat a **"set" frame** is pushed first, timed at `about.startTime` or 2,000 ms before the pitch. It shows the batter in the box with a 0-0 count.
   - Then each event gets its own frame. The in-progress play is rebuilt (`inFlight`): the events sliced to the revealed ones, the play marked incomplete, the result stripped, the runners cleared. The count is recounted from the revealed events, with balls capped at 3 and strikes at 2.
5. **After the events** (`:564`–`:581`). The result time is `about.endTime` if later, else the last time plus 1,500 ms. The score and hits roll forward (singles, doubles, triples and home runs only), errors (`field_error` only) and outs. Runners advance from `play.runners[].movement`.
6. **The result frame** (`:590`–`:613`). The batter and on-deck move to the next two hitters. Only the last play gets the real final status and `decisions`. Every other frame reports a fixed "Live" status.

- Completed plays are shared **by reference** across frames. That is why hundreds of frames cost about 4 MB of heap. [doc]
- **Approximated.** The box score is always end-of-game. Per-inning hits and errors are absent. The line score holds runs only. The reconstructor does not check `isComplete` on any play; Inference: an in-progress last play of a live feed is treated as finished.

### 9.2 What counts as a frame

`frameFingerprint` (`format.ts:165`–`:185`) joins: play count, the last play's event count, its completion flag, inning, half, `inningState`, outs, balls, strikes, both runs, pitcher id, batter id and `codedGameState`. `dedupeFrames` drops a frame whose fingerprint equals the previous one. A change only to bases, defense, hits or errors does **not** make a frame. [code]

### 9.3 On-disk format (only six games are stored)

- Files: `pb:public/recordings/v1/<gamePk>/manifest.json` and `frames.ndjson.gz`, plus `v1/index.json`. The base URL is `NEXT_PUBLIC_RECORDINGS_BASE_URL`, else `/recordings`.
- The stream: line 0 is a **keyframe** (a full feed). Each later line is an **RFC-6902 patch** (add, remove or replace) made by `fast-json-patch` on JSON-normalized documents.
- The manifest has one row per frame (index, time, inning, half, at-bat, play complete, scoring, between), plus markers for the first frame of each half and for each scoring play.
- **`PatchPlayer`** walks one live document forward with cloned patch operations. It stores a full copy at frame 0 and every 50 frames (`CHECKPOINT_EVERY`), and rewinds to the nearest one for a backward seek. **`FramePlayer`** is an array lookup.
- `loadReplay` reads the index and uses a stored recording if the `gamePk` is listed. Otherwise `loadReconstructed` fetches `/api/game/<pk>` and rebuilds in the browser.
- The reader sniffs the gzip magic number and decompresses with the browser's `DecompressionStream`.
- Measured by the author on one nine-inning game [doc]: feed 812 KB raw, 130 KB gzip. `JSON.parse` 8 ms. Reconstruct 11 ms (529 moments). Dedupe 1 ms (511 frames). Manifest 1 ms. Validate 61 ms. **Encode 3,978 ms.** A stored recording is 179 KB. The encoded form is bigger on the wire than the raw feed it came from, which is why the author stopped storing recordings.

### 9.4 Playback (`pb:src/hooks/useReplay.ts`)

The pump runs on every animation frame, in this order [code]:

1. Past the last frame: stop, and mark "settled" once the director is idle and nothing is pending.
2. If paused: return.
3. If the director is busy: reset the rest timer and return.
4. If a snapshot is pending and no pitch is held: return, so `settle()` can run.
5. Otherwise wait `beatAfter(frame)`: 0 when held, the break beat between innings, the play beat after a finished play, else the pitch beat.
6. Then advance one frame and call `ingest(player.feedAt(next))`.

Beats [mine, 2026-10-23, `timeline.ts:37`–`:51`]: pitch 5,000 ms, play 3,000 ms, between 5,000 ms. Clip: 2,200, 1,200, 0. The author's comment: a real game leaves about 20 s between pitches, which is more than is worth watching. **Recorded timestamps are ignored.**

Transport: open at MLB's `atBatIndex` or an ordinal; `seekAtBat` jumps to that at-bat's "set" frame; `stepAtBat` back from mid-at-bat restarts the at-bat first; `stepHalfInning` uses the timeline. Inference (reader): `idleSince` is not reset by seeks or pauses, so the first beat after one may be skipped, and after the end `play()` is cancelled by the next tick, so a restart needs a seek.

### 9.5 Clips (`pb:src/lib/replay/clip.ts`)

- `buildClip(feed, atBatIndex)` returns `null` if the play is missing or not complete.
- It reconstructs the whole game, keeps the non-"between" frames of that at-bat, and trims each frame to its one play.
- **`keepDecisivePitch`** keeps only frames that have revealed at least the last pitch's event. The result is three frames: the one before the last pitch, the one that reveals it, and the result.
- **Moving the opening frame is what skips the earlier pitches.** The store seeds its cursor from the first frame, and the extractor skips everything at or below it. Filtering out the middle frames would hand the animator the whole at-bat at once. [doc and code]
- A clip is encoded like any recording, so the client plays a clip as a very short recording. `CLIP_SHAPE_VERSION` = 2 rides in the URL (`?v=`) so a change to which frames a clip keeps can break the immutable cache. [mine, 2026-10-23]

### 9.6 Validation (`pb:src/lib/replay/validate.ts`)

`validateFrames` runs `buildSnapshot` and `extractEvents` over the frames the way the store does (seed on frame 0, then extract forward).

- **Errors:** no frames; an exception on any frame; a frame going back in time; a final score that differs from the feed's final line score; no pitches at all.
- **Warnings:** a gap over 15 minutes between frames; at-bats that were pitched but never resolved (the last at-bat is exempt); a last frame that does not read as final.
- **Not checked:** pitch counts, the defensive alignment, the base state.
- `verifyEncoding` (recorder only) applies the encoded patches and compares fingerprints, not whole documents.
- `pb:scripts/validate-season.ts` walks every day from Opening Day, rebuilds each finished game and runs the validator. It exits non-zero on any failure. [doc] The author reports 2,137 games in 5.5 minutes with one failure, a postponed game. A sample of 24 games passed.

## 10. The server layer

All routes are `force-dynamic`. State lives in module-level maps, so the caches are **per server instance** (Inference). [code]

| Route | Behavior |
|---|---|
| `GET /api/game/[gamePk]` | 400 for a bad id; 502 `{error}` if upstream fails. **Live:** 3 s in-memory cache (max 32 entries, oldest evicted), `no-store`. **Final** (abstract `Final`, coded `F` or `O`): kept in a 24-entry map and sent `public, max-age=31536000, immutable`. [mine, 2026-10-23: `CACHE_MS` 3000, `FINAL_LIMIT` 24, live limit 32] |
| `GET /api/clip/[gamePk]/[atBatIndex]` | 400, 404 ("No such play"), 502. Final games: `immutable` and a 64-entry cache. Live games: `public, max-age=60, stale-while-revalidate=600`. The `v` query value is ignored. A miss fetches the full feed and does not use the `/api/game` cache. |
| `GET /api/games` | Always 200 and `no-store`. Without a date: yesterday through today (ET), keeping yesterday's games only if live. With `?date`: that day, validated. Failure: an empty list plus an `error` field. |
| `GET /api/games/recent` | Always 200. The last 10 days clamped to Opening Day, final games only, newest first, limit 9. One-minute memo keyed to the ET day. |

**Pages.**

- `/watch/[gamePk]`: `?replay=1` forces replay without asking the schedule. Otherwise `fetchScheduleGame` decides: final means replay, live means live, anything else renders a "not yet" card with the status text and the local first pitch. A schedule error, or a game missing from the schedule, falls back to live. `?at=` is a 1-based ordinal and works only in replay. Inference: the card is a server component, so its start time uses the server's time zone, and the 60 s schedule cache can show "not yet" for a game that just started.
- `/watch/[gamePk]/at/[atBatIndex]`: the viewer in forced replay, cued by MLB's index. Its metadata shows the score **before** the play, to avoid spoilers.
- `/clip/[gamePk]/[atBatIndex]`: 404 for a missing or incomplete play. It throws on an upstream error so the error page invites a retry.
- `/games/[date]`: server-rendered. The date must match `YYYY-MM-DD` and fall between 2026-03-25 (`SEASON_OPENING_DAY`) and today in Eastern time. Otherwise 404.

**Share cards** (`pb:src/lib/share/atbat.ts`). They read `/v1/game/{gamePk}/playByPlay` and the single-game schedule entry in parallel. The play-by-play response is an order of magnitude smaller than the live feed, which matters because a link scraper is waiting. Scores come from the previous play's running totals. A miss just past the end of a cached copy triggers one uncached re-read for a game that is not final. OG images: the game card (revalidate 3,600 s; teams, venue, first pitch in ET, no score), the at-bat link (86,400 s; batter against pitcher, score before) and the clip (86,400 s; the event plus an exit-velocity and distance line, score after). All fall back to a brand card.

## 11. The director: how events become animation

File: `pb:src/lib/anim/director.ts` (2,710 lines). It is the largest and most central file. It owns every actor's position and pose, the animation queue, the camera shot, the callout text, the crowd reaction and the particle system. The scene only reads it. [code]

### 11.1 State and API

- **Actors.** `actors` is a map keyed by **slot**, not by player: `def:<position>`, `bat`, `deck`, `run:<base>`, and short-lived `mv:<id>` for movers. A runner who moves gets a new key. (`director.ts:659`, `:981`–`:1029`, `:2353`)
- **Playing state.** `queue`, `current` (an animation with `duration`, `update(t, dt)`, `onStart`, `onEnd`), `currentTime`, `currentStart`, `carry`, `idleTime`. (`:742`–`:748`)
- **State the renderer reads.** The ball (position, visible, scale, a trail capped at 14 points), the camera mode, a camera-cut counter, camera shake, the callout, the crowd reaction and its id, `atPlate`, the particle system, and a roster version number. (`:660`–`:725`)
- **Callbacks out.** `onCount`, `onPlayResolved`, `onPitch`, `onSound`. The store wires them (section 7).
- **Public methods.** `enqueue(events)`, `update(dt)`, `isIdle()`, `applySnapshot(snapshot)`, `desiredCamera(view)`, and `clearQueue()`. `applySnapshot` is meant to run only when idle. It adds or updates actors, deletes the ones it did not see, sets `atPlate`, and "beams in" a new hitter or a whole new side.
- **Dead code.** `clearQueue` has no callers; the store builds a new director instead [mine, 2026-10-23, grep]. `cameraFocus`, `cameraPosition`, `busy`, `queueLength`, `HOME_RUN_WALL` and `MOUND_Y` are set but never read outside the file (reader's grep, not re-checked).

### 11.2 The loop and the wall clock

- Time is **wall-clock**. The animation clock is `(now - start) / 1000`. The frame `dt` is clamped to 0.1 s by the scene's engine loop. `dt` drives only things that accumulate (stride phase, dissolve, shake decay, pose hold timers). Positions are functions of the clock. A stall therefore costs smoothness, not sync. (`:1170`–`:1173`, `:1206`–`:1218`)
- **One-shot cues.** A small `Cue` helper fires a function once, the first time the clock passes a time. Inference: after a long stall every skipped cue fires in the same frame.
- **Overshoot handoff.** When an animation finishes late, the extra time (at most `CARRY_CAP` = 0.1 s) carries into the next animation. The next animation is compiled in the same `update` call and starts already advanced by that carry. Overshoot above 0.1 s is discarded, so a stall does not fast-forward a backlog. (`:347`, `:1180`–`:1199`)
- **Lazy compile.** An event becomes an animation only when it starts (`compileNext`). The compile reads `this.snapshot`, which is not promoted until the queue drains. Inference: during a backlog, the batter, the pitcher's hand and the batting side can be stale. (`:1367`, hint at `:1572`)

### 11.3 The queue guard

The guard is inline in `enqueue`. If the queue holds more than 14 events, it keeps only the non-pitch events and then only the newest 8. [mine, 2026-10-23, read at `:1142`–`:1150`]

- There is no speed-up, skip-to-end or other catch-up path. [reader read the whole file]
- Consequences (Inference): a dropped pitch that started a play leaves its result to run alone, with no windup or swing. `onCount` and `onPitch` are skipped for dropped pitches. Outcomes older than the newest 8 are lost from the animation. Recovery relies on `settle()` promoting the pending snapshot and the pending log as a whole.
- The README says the guard "drops pitch-by-pitch detail and keeps the outcomes". It does not mention the cut to 8. [doc vs code]

### 11.4 Idle, game over, intermission

- **Idle** (`restIdle`, `:1268`–`:1299`). Displaced actors walk back to their marks at `RETURN_SPEED` 26 ft/s, easing inside the last 9 ft and snapping at 0.4 ft. A reaction pose holds 3.2 s, a collapse 4.6 s, a movement pose resets after 0.6 s. The ball hides after 1.2 s of idle.
- **Game over.** The store sets `gameOver` from the feed on every ingest. The director reads it in one place: a third out ends a half only if the game is not over (`endsHalf = outsAfter >= 3 && !gameOver`, `:1887`). The final out therefore skips the change-of-sides choreography. `applySnapshot` also clears `atPlate` for a final game.
- **Intermission.** A flag (`awaitingReturn`) turns on at the change-of-sides cue. While it is on, the director ignores snapshots whose `inningState` is "Middle" or "End", ignores stale snapshots that still show the side that left, holds the idle camera, and hides the strike-zone box. The first normal snapshot clears it, and a "PLAY BALL" callout plays on **every** half-inning, not only the first. Arriving actors fade in over `MATERIALIZE_TIME` 0.6 s. (`:946`–`:964`, `:1047`–`:1061`, `:2203`)

### 11.5 What each compile function builds

**`compilePitch`** (`:1602`)

| Phase | Timing |
|---|---|
| Windup | 0 to 0.62 s (`THROW_TIME`) |
| Release | at 0.62 + 0.62 x 0.32 = 0.818 s (`THROW_RELEASE`) |
| Flight | 0.38 to 0.78 s; 0.46 s at 95 mph |
| Swing lead | the swing starts `SWING_LEAD` 0.27 s before the ball reaches the plate |
| Swing clip | 0.62 s for a hit or foul; 1.15 s for a whiff (the barrel crosses the zone at 30% of the clip) |
| Tail | foul 1.9 s; strike three 1.8 s (the comment calls it "the best beat in the whole sequence"); other whiffs 1.4 s; everything else 0.75 s |

- The ball is hidden until release. At release a "pitch" sound plays and nine dirt particles puff. A whiff fires the whoosh, a dirt spray and a lens knock.
- A foul is hit, not thrown. It flies 1.5 s to a made-up spot (a hash of the pitch id, pushed outside a foul line) on a cubic ease-out with a roughly 48 ft apex. A non-foul pitch snaps into the mitt over 0.32 s.
- Camera at the start of a pitch: two or more strikes use `slot`. Every fourth pitch uses `mound`, then cuts back at release. All others use `center`.

**`compileAtBat`** (`:1712`) builds the result animation up front. That means runner binding and the batted-ball plan run at compile time, and actors can be created early. At contact it fires the result's start, then a "crack" cue. Crack volume is 1.0 for a home run or triple, else 0.45 + 0.55 x heat. Lens knock and dirt scale with heat. Big hits override the shot: a home run goes to `launch`, a triple or a hard line drive goes to `low`. The comment gives the reason for this split: if the result owned the camera from the top of the windup, the camera would slide across the park and give away which pitch mattered.

**`compileResult`** (`:1784`)

- "Caught in the air" is true only for a field out, double play or sacrifice fly on a ball that is not a ground ball, bunt or home run.
- The throw starts 0.4 s after the gather and lasts 0.6 s. It goes to the base of the first out, else to first base. Inference: a hit still throws to first.
- Runners who are out cannot resolve before the catch or throw plus 0.2 s.
- Duration is the later of the runners and the throw, plus a hold: 4.2 s for a home run, 2.4 s otherwise.
- **Callout timing hides the result.** A home run is called at carry + 0.3 s. Other balls in play are called when the last runner stops or the throw lands. Plays with no ball are called at 0.45 s. The reason in the code: naming a play at its start spoils doubles and triples.
- A runner who is out beams at +0.3 s, dissolves over 0.5 s and is gone at +0.95 s. A strikeout batter does the same.
- A third out pauses 1.1 s, then the field beams out (0.7 s), holds empty for 2.0 s, sets the intermission flag and cuts to `wide`.
- Fielders run a route to the gather point, catch, throw, and jog home. A beaten infielder lunges at 0.16 s before the ball passes and dives for 0.85 s.
- **Runner times per base:** run 2.6 s; home-run trot 3.4 s; walk or hit-by-pitch 4.2 s. The batter starts at 0.12 s and other runners at 0.02 s. The comment: "quicker than life, but a double over before you find the ball communicates nothing". Progress follows the `pace(u)` profile over the whole multi-base track. Runners ease onto the path over `PATH_JOIN` 0.4 s.
- Reaction poses are chosen by a **hash of the player id and the at-bat index**, so a replay or a scrub looks the same every time.
- Home run camera: `launch` at contact, `park` at min(1.5 s, 0.45 x carry), `trot` at carry + 2.6 s following the hitter.
- Confetti and fireworks go off only for the home team.

**`compileAction`** (`:2395`) handles steals and similar. It detects a steal by matching `steal` in the event type or description, takes 2.6 s for a steal and 0.9 s for anything else, and moves the runner one base in 2.1 s. The runner is the one on second if the text mentions 3rd or third, else the one on first. `ActionEvent.runners` is always empty (`events.ts:448`), so the animation is guessed from text. Inference: "caught stealing" probably matches the same pattern and would animate as a safe steal. Nobody checked this against feed strings.

**`compileInningChange`** (`:2467`) is a fallback. When the change of sides already happened it lasts 0.2 s. Otherwise it takes 2.7 s: callout, `wide` shot, intermission flag, roster beam-out, then a 0.7 s dissolve.

## 12. Pitches, batted balls, gaits

### 12.1 Pitch shapes (`pitches.ts`)

- **Data used:** the pitch-type name and the speed. It ignores break, spin and `pfx` data entirely. The pitcher's hand comes from the snapshot. [code]
- An ordered list of regular expressions maps a name to a shape (`drop`, `run`, optional `wobble`, a fallback `speed`). The first match wins. Example values: four-seam 0.35 / 0.25, curveball 1.95 / -0.6, sweeper 1.15 / -1.7. The fallback is 0.95 / 0.35 at 90 mph. (`pitches.ts:36`–`:51`)
- **Flight time** is `95 / mph x 0.46` s, clamped to 0.38–0.78 s. The path is a quadratic Bézier. The control point is the chord midpoint plus a vertical offset (`drop`) and a sideways offset (`run`, flipped by arm side), both scaled by `(flightTime / 0.46)^2`. A knuckleball adds a sine wobble.
- The README says pitches use "accelerations in g". The code is a **scaled Bézier offset**; "g" is only an analogy. The break peaks mid-flight, with no late break. [doc vs code]
- Gotcha (Inference, from the list order): a pattern for "curve" comes before the one for "slow curve", so a "slow curve" never reaches its own entry.

### 12.2 Mapping the strike zone onto big figures (`platePoint`)

Figures are drawn about 2.35 times life size, so a real-feet pitch location would look wrong. One function maps plate coordinates onto the figures. [mine, 2026-10-23, `director.ts:372`–`:402`]

- Sideways: `x_feet x 2.59` (the constant `PLATE_RISE`).
- Height: `max(0.5, -0.39 + z_feet x 2.59)` (the constants `PLATE_RISE` and `PLATE_BASE`).
- Depth: a fixed 1.35 (`PLATE_DEPTH`).
- Knees (1.6 ft) and letters (3.4 ft) land at 3.75 and 8.42 world units, about 4.66 units apart.
- The strike-zone box in `StrikeZone.tsx` is built from the same function, so the ball and the box agree.

### 12.3 The batted ball (`batted.ts`)

- **Two phases.** A **carry** runs from the bat to the first touch. A **run-out** is three hops and a roll. A ball hit flat carries a shorter share. (`:14`–`:41`)
- Per-trajectory profile (`:100`–`:167`):

| Trajectory | Carry share | Carry (ft) | Apex (ft) | Hang (s) |
|---|---|---|---|---|
| ground ball | 0.3 | 12–78 | 0.8–5 | 0.4–1.1 |
| bunt | 0.5 | 6–30 | 0.6–4 | 0.4–1.1 |
| line drive | 0.78 | 45–320 | 5–20 | 0.75–2.4 |
| fly ball | 1 | 60–430 | 26–95 | 1.9–3.7 |
| popup | 1 | 20–260 | 55–105 | 2.6–4.1 |
| unknown | 0.82 | 30–430 | 6–70 | 0.9–3 |
| home run | 1 | 200–520 | 70–128 | 3.4–4.6 |

- **Why two phases.** The feed reports a fly ball where it came down but a ground ball where it was **fielded**. A ground ball carries only about a third of the reported distance and is on the dirt within the first stretch. (README, "The shape of a batted ball"; `PROFILES`.)
- **Apex.** If the launch angle is above 1 degree, apex = `distance x tan(min(angle, 72 degrees)) / 4 x loft`, clamped to the profile range. Otherwise it interpolates by distance. The arc is a quarter-sine up and a quarter-cosine down, with a per-profile peak (0.42 line drive, 0.5 fly). The README says this lets a flat ball climb fast and run out on a long tail.
- **Rest point.** `reach x (1 + skip x (0.5 + heat))`, then clamped to the field. `heat` is `(launch speed - 70) / 42`, or `distance / 330` when there is no exit velocity.
- **Run-out.** Three hops; each is 0.4 times as high and 0.66 times as fast as the one before. A roll follows. The roll time is `clamp(remaining / (52 + 58 x heat), 0.35, 2.3)`, stretched toward the fielder's chase time up to 1.9 s.
- **Caught or not** is decided by the director, not by the plan. A caught ball ends at glove height (5.4) and never touches the grass.
- **Which fielder.** Beyond 150 ft the geometric outfielder gets it (split at plus or minus 0.234 rad). Inside that, a caught ball uses `ball.fielder`, an uncaught one the nearest fielder to the rest point. `ball.fielder` is **computed** from the coordinate (`events.ts:214`), not taken from MLB's fielding credits.
- **Chase time** is 0.25 s plus distance / 34 ft/s.
- **Beaten fielder** (hits with apex up to 14 ft only). It samples 81 points along the ball's path. The infielder reaches 26 ft, the ball must be below 7 ft, and he comes up 4.5 ft short. The catcher is excluded. (`:510`–`:545`)
- **Fouls** never go through the batted-ball plan. `isFoul` is not read in `batted.ts` or `director.ts` [mine, 2026-10-23, grep]. Fouls are handled in `compilePitch`.
- **Home runs** run on past the plan: the ball continues 16% further out while dropping from 26 ft to 1 ft over 1.2 s.

### 12.4 Gait (`gait.ts`)

- Three gaits: sprint, run, walk. Each is a table of joint extremes. **Stride length is derived by forward kinematics** from those angles (`FIGURE_SCALE` 2.35, `gait.ts:46`). Reader's computation: about 24.3 ft sprint, 21.1 ft run, 10.4 ft walk.
- `gaitFor(speed)` converts ft/s to "body-scale mph" (divide by 2.35 and by 1.4667), picks a gait with hysteresis (0.4 mph), and returns a **playback rate and a cadence**. Cadence is speed divided by stride, which keeps a planted foot planted.
- `legAt` keeps the planted foot's sweep linear by inverting the hip angle in closed form.
- `pace(u)` is a **trapezoid speed profile** (accelerate 18%, decelerate 24%) that starts at 30% of cruise speed and ends at 12%. It is used across multi-base tracks even though its comment says "one leg".
- The director measures speed from the position the caller just wrote, so any motion curve works. (`director.ts:1422`)

## 13. Cameras

### 13.1 The shot list

There are 12 named shots (`director.ts:197`–`:231`, `desiredCamera` at `:2527`–`:2705`). Positions are `fp(lateral, depth, height)` in feet. Reader's table, spot-checked for names and use:

| Shot | Use |
|---|---|
| `center` | Default. Out past the mound, behind the pitcher, looking in at the hitter. Lens 20 degrees. Used on post-play and for most pitches. |
| `mound` | A long lens from behind the plate. Every fourth pitch, after a strikeout, and as an idle cutaway. |
| `slot` | Over the catcher. Two-strike pitches and idle. |
| `ball` | Tracks a batted ball after contact (non-big hits). Follow factor 0.6 for a home run, 0.22 if apex is under 14 ft, else 0.32. |
| `low` | Field level. Triple or hard line drive. |
| `launch` | Home run contact. |
| `park` | A circle around the landing spot at 190 ft up. Home run. |
| `trot` | Follows the hitter around the bases. Home run. |
| `wide` | Change of sides and idle. |
| `base`, `line`, `bowl` | Idle cutaways (`base` is skipped when first base is empty). |

- **Every shot change is a cut.** Only one `setShot` call omits `force` (`:2264`). Reader's inference: the `SHOT_HOLD` table is effectively dead.
- **Shake.** `knockCamera` replaces only a weaker knock. Amplitude in the scene is `knock^1.6 x 1.1` with two detuned sines per axis plus a small roll.
- **Idle cutaways.** The camera settles to `center` after 0.9 s. A cutaway starts after 7 s of idle and 26 s of wall-clock since the last one, and holds 4.5 s. Anything the feed sends ends it with a cut to `center`.

### 13.2 Seats and the portrait rig

- **Only two seats exist in code:** `broadcast` and `home_plate` (labelled "Press Box"). The README and `ARCHITECTURE.md` describe four modes, including an umpire seat and a sky seat. The type in `views.ts` has two. [mine, 2026-10-23, `views.ts:13`]
- A seat never cuts. Its gaze pans toward a ball hit away from it. The choice is stored in `localStorage` under `pocket-ballpark:camera`.
- **Portrait framing** (`Scene.tsx` `CameraRig`). `fov` in three.js is vertical, so a tall screen sees a narrow slice. The rig widens the vertical field of view to hold the horizontal one, up to `min(78, base x 1.9)`, with the aspect floored at 0.45. Reader's numbers: at aspect 0.46 a 50 degree shot becomes 78 and a 20 degree shot becomes 38. Non-fixed shots also lean their target toward the infield, all shots move toward their target a little, and the frame shifts down by a share of its height.
- A cut snaps position and target. Otherwise the position eases by `min(1, delta x lerp)`.

## 14. The scene: park, crowd, sky, effects

**No asset files.** The repo has no model, texture, audio or HDR file, and `pb:src/` has no GLTF, texture or audio loader. The only binaries are three TTF fonts in `assets/fonts` (used by the OG-image routes) and two WebP page screenshots. [mine, 2026-10-23, `git ls-files` and grep] Every figure, the whole park and every sound are made in code.

### 14.1 Frame flow

- `Scene.tsx` has two frame loops. `Engine` calls `director.update(min(dt, 0.1))`, then `advancePaint`, then `settle()` when the director is idle. `CameraRig` asks the director for the shot and applies it. [code]
- A `Player` component owns no game state. On every frame it reads its actor record from the director (position, facing, pose, pose time). React re-renders the actor list only when the director's roster version changes. [code]
- Other readers of the director on each frame: the ball, the strike-zone box, the crowd, the contact shadows and the particle effects.
- Inference: `Engine` is mounted after most of its siblings, so their frame callbacks may see last frame's director state, a one-frame lag.

### 14.2 The field

- `fieldRadius(angle)` interpolates the seven-point wall profile (331 to 404 ft, section 18). Behind the plate it tapers with a power-7 curve to a 58 ft backstop. Every park uses the same generic dimensions. [code and README]
- `surfaces.ts` builds the grass, the foul wedges, a 16 ft warning-track ring, an arc of infield dirt around the mound (radius 95) with the grass diamond punched out, and a 13 ft home circle, all as `THREE.Shape` objects in field space.
- Mow stripes come from a 4 x 64 repeating texture, one band per 34 ft. Layers sit a few hundredths of a foot apart to avoid depth fighting. Bases are drawn about three times life size.

### 14.3 The bowl, the crowd and the town

- **Bowl.** `stadium.ts` defines 29 terraces (4 field, 12 lower, 4 bleacher, 9 upper). Seats are laid out by arc length at a pitch of 8.6 ft, and 24 aisles are skipped. `Stadium.tsx` sweeps cross-sections along the field outline into one vertex-coloured geometry, including wall, coping, concourse, roof and dugouts.
- **Fans.** Only terraces whose row number divides by 3 get fans, so nobody is buried. About 9% of seats are empty. Allegiance comes from a noise roll: 66% home, 12% away, 22% neutral (neutrals wear six fixed colours). Shirts are the club primary or secondary. Half the fans have long hair and half cropped; a cropped fan wears a club-colour cap about a third of the time. There are six skin tones.
- **Crowd size.** The README says "around twelve hundred". A comment in `park.ts` says "a couple of thousand". The reader's hand estimate is 1,000 to 1,200. Nobody ran the generator. [open]
- **Reactions.** `Crowd.tsx` implements them: a signed excitement for each allegiance, shaped by an attack, sustain and decay envelope, with a per-fan phase spread of 0.35 s. Happy fans rise from the seat and hop. Sad fans sink, shake their heads, and their face colour flushes red through the instance colour buffer. The README still calls this a TODO. [doc and code disagree]
- **Idle bob.** Each fan's position, yaw and scale are baked into its instance matrix once. The idle loop then rewrites only the three translation values, at 24 Hz for the crowd and 20 Hz for the bench.
- **Town.** Three rings of gabled buildings at radii 880, 1,120 and 1,420 (42, 34 and 26 buildings), ring roads, 13 radial avenues and 64 trees, all as blocks in the same instanced batches as the park.
- **Light towers.** Four towers with seven lamp faces each. **Backstop net.** A dark transparent cylinder segment with fading ends, drawn only when the camera is on the field side of it.

### 14.4 Sky, light and weather

- Dawn is 5:30 and dusk 19:30. The sun follows a half-circle arc, rising on the first-base side and setting on the third-base side. Daylight is `clamp01((elevation + 0.05) / 0.3)`.
- **Day.** Drei's `Sky` (the Preetham model) with turbidity, rayleigh and mie driven by cloud and golden-hour factors. Fog appears if overcast, raining or evening.
- **Dusk.** The tower rig turns on when daylight falls under 0.45, and the lamps light under 0.72.
- **Night.** A flat background (`#152241`) replaces the sky shader, because the Preetham model returns a murky grey-brown past sunset (README). The sun stops casting shadows. Four spotlights aimed across the field cast the light, and the two infield banks cast shadows (1024 x 1024 maps).
- **Indoor** (roof closed): the same kind of rig on a different background.
- **Hour.** See section 6.1. **A replay always lights the park at start time plus 5 h.**
- **Cloud, rain, snow, wind.** First-match tables over the feed's condition text, in section 6.1. `snow` is true only if the text contains "snow". The type comment says it depends on freezing, but the code never reads temperature. [comment and code disagree]
- **Rain and snow** are 900 instanced streaks or flakes in a 300 x 300 x 120 box that follows the camera. Count scales with the rain value. Fall speed is 190 for rain and 22 for snow. They use `Math.random`, so they are not deterministic.

### 14.5 Paint, shadows, effects

- **Paint** (`pb:src/lib/field/paint.ts`). A snippet injected into stock materials with `onBeforeCompile`: broad blotches that shift hue and value, a warm pool over the infield, a drifting cloud the size of the outfield, and a distance haze that takes the sky's colour. It works under instancing because it writes a world-position value. The uniforms are shared global objects, so one update drives every material. A hash of the snippet is the program cache key, so materials with the same paint share a program. A flag makes the patch idempotent. [code]
- **Shadows.** The sun uses a 2,048 x 2,048 map with a plus or minus 320 ft orthographic frustum. About 20 meshes per figure cast shadows (Inference), and figures never receive them. `Shadows.tsx` adds an instanced contact blob under each actor (up to 40) and one under the ball that spreads and fades with height, which is the cue that tells you how deep a fly ball is.
- **Effects.** Three instanced meshes (capacity 900, 1,400 and 460) for confetti, sparks and dust. Unused slots are zero-filled every frame (about 2,760 writes), and the mesh is hidden when idle to skip the upload.
- **Canvas.** Device pixel ratio 1 to 2, antialiasing, `high-performance` power preference, near 2, far 4,000.

### 14.6 Draw calls and lifecycle (reader's estimates)

| Part | Estimate |
|---|---|
| Figures | Up to about 14 actors (9 fielders, batter, on deck, 3 runners) x about 75 meshes, un-instanced. **This is the cost center** (about 1,000 draws before shadow passes). |
| Park | 5 structure InstancedMeshes plus 1 lamp mesh for several thousand blocks |
| Crowd | 7 InstancedMeshes (README says 4 or 5) |
| Benches | 5 to 6 InstancedMeshes for each dugout |
| Field and small meshes | About 100 |

- **Poll-driven rebuild churn (Inference, not measured).** Each idle poll builds a new snapshot, and the snapshot makes new `uniform` objects. The materials memo in `Player` depends on `uniform`, so every figure's materials and meshes rebuild. The crowd palette memo depends on the teams object, so the park's InstancedMeshes rebuild too. `Dugout.tsx` has a comment claiming the uniforms are stable. That holds only between promotions. This may cause a periodic hitch.
- **Texture caches** key on text and colours and are never cleared (`disposeTextures()` has no caller). Shared geometry buffers are never disposed. Each component disposes its own geometry, materials and textures on cleanup.

## 15. The player rig and uniforms

File: `pb:src/components/scene/Player.tsx` (2,069 lines). This section matters most for #2580.

### 15.1 Construction

- Figures come from three.js built-ins (Box, Plane, Sphere, Capsule, Cylinder, Torus) plus two helpers in `components/scene/geometry.ts`: `roundedBox` (a wrapper over three's `RoundedBoxGeometry`) and `egg()` (a lathe whose seam starts at the back of the head so the crease is not on the face). [code]
- One shared table of geometry buffers (`GEO`) serves every figure. A figure is assembled imperatively inside a `useMemo` and mounted as a `<primitive>`. There is no skinning and no mesh merging.
- Mesh count per figure (Inference, from counting `add()` calls): about 73 for an alien fielder and about 81 for a robot, plus about 14 for a helmet, 5 for a bat and 15 to 19 for a glove.
- **Scale.** The model root is scaled by `FIGURE_SCALE` 2.35. Hip height is 2.92 model units, about 6.9 ft in the world. The head is scaled 1.12.
- **Materials.** Each figure gets 18 Phong materials plus one for the number, created per figure and not shared.

### 15.2 Skeleton and channels

There are **no skinned bones**. A figure is a tree of `Object3D` groups. The pose writes values into their transforms on every frame. [code]

| Joint | Pivot | What is written |
|---|---|---|
| Outer group | actor position | yaw eased toward `facing`; scale squash for the beam-out |
| Hips | model root, y = 2.92 | height = hip height minus crouch plus bob, adjusted by leg split; sway in x |
| Torso | child of hips | chest height; lean (x), twist (y), roll (z) |
| Head | torso, y = 1.58 | tilt and yaw, relative to the hips |
| Hip joints | plus or minus 0.44 | leg swing (x); leg split (z, shared) |
| Knees | 1.32 below the hip | x only; positive swings the shin back |
| Shoulders | plus or minus 0.96 (alien) or 1.04 (robot), y = 1.4 | arm swing (x); arm spread (z) |
| Elbows | 0.92 below the shoulder | x; an inward swing (z) that the batting stance needs |
| Bat group | child of the **torso**, not an arm | orientation from a rest axis to a swing axis; the blend can exceed 1 |
| Antennae | on the head | lean plus a sine wobble |

- No wrist, finger, toe or eye joints exist.
- **21 channels** [mine, 2026-10-23]: crouch, lean, twist, legL, legR, kneeL, kneeR, armL, armR, elbowL, elbowR, armSpread, elbowIn, headTilt, headYaw, sway, legSplay, roll, chest, bob, batSwing.
- Leg constants: thigh 1.32, shin 1.16, toe-ahead 0.1 (`gait.ts`). `legDrop()` does forward kinematics and tells each pose how far to lower the hips so the soles stay at ground level. `squat()` chooses a hip and knee pair so the foot does not move as the squat deepens.

### 15.3 How a pose is evaluated

- **A pose is a pure function.** `poseValues(pose, t, clock, isBatter, batSide)` returns all 21 channels from scratch on every frame. There are no keyframes and no clips. `t` means a 0..1 ramp for a swing, windup, throw or dive, a wrapped phase for a gait, and seconds for a reaction. [code]
- **Gaits** use the stride table of section 12.4, so feet do not slide.
- **Idle has two layers.** Underneath: detuned sines for breath (about 11 per minute), head yaw and tilt, a weight rock and a knee sink. On top: windowed gesture bursts, a glance every 7.3 s, a weight shove every 5.5 s, a deeper sink every 7.9 s and a hand fidget every 13.7 s. The clock is elapsed time plus the player id, so no two figures are in step. The README also lists a "reset hop"; the code has none.
- **Crossfade (`POSE_BLEND`).** The incoming pose chooses the span. Default is 0.18 s. Fast: swing 0.06, whiff 0.06, throw 0.07, dive 0.07, catch 0.09, windup 0.14. Locomotion: sprint 0.12, run 0.14, walk 0.2. Slow: ready 0.26, idle 0.26, crouch 0.3. The outgoing pose keeps running on its own clock. The mix is a smoothstep over all 21 channels. The blend is skipped, and the figure snaps, if it was not seen last frame or moved more than 10 units in a frame. [code]
- **Batter special case.** A batter in `ready` or `idle` uses `battingStance()`. The bat is visible only in the poses ready, idle, swing and whiff.

### 15.4 The 21 poses

| Pose | What it is |
|---|---|
| `idle` | Default stand-around: weight shift, breath, glances, a shallow squat |
| `ready` | Fielder or runner waiting: soft knees, forward lean, arms low |
| `crouch` | Catcher's deep squat, glove arm up |
| `sprint`, `run`, `walk` | Gaits from the stride table |
| `windup` | Gather onto the back leg, then a front-knee kick |
| `throw` | Stride, whip, follow-through; always uses the right arm |
| `swing` | A connected cut with a coil and a slight unwind |
| `whiff` | A separate pose with its own beats, overspin and a head drop |
| `catch` | Arms up and out, slight crouch |
| `dive` | Arms thrown ahead, torso folds, heels kick up. The rig can only yaw, so it never goes horizontal. |
| `celebrate`, `dance`, `rain`, `wacky` | Fists up then clap; a "running man"; a make-it-rain flick; an inflatable tube man |
| `frustrated`, `facepalm`, `annoyed`, `dejected` | Reactions after a bad play; a pitcher after a hit uses `annoyed` |
| `collapse` | To the knees, held 4.6 s; reserved for balls that land in the seats |

The director picks celebrations, dejections and sulks by a hash of the player id and the at-bat index.

### 15.5 Helmet, glove, bat

- **Helmet.** Built in a frame whose origin is the **rim**: a stretched dome, a back dome, a trim ring, a ridge, a crown button, six vents, a brim (top and a dark underside) and one or two ear flaps. `helmetHeight(clear, lidY)` inverts the dome arithmetic to answer "how tall must the shell be to clear this much skull?". Rim heights: alien 1.54, robot 1.2. Only the roles `batter` and `runner` wear one. A batter gets one flap on the side facing the pitcher, a runner gets two. **Nobody wears a cap on the field.**
- **Glove.** Kinds: fielder, catcher's mitt and first-base. Fielders and the catcher have fingers or a ring, laces, a web and a heel. It attaches to the left forearm.
- **Bat.** `handAnchor()` builds a throwaway shoulder, elbow and hand group from the same constants as the model and returns the midpoint of the two hands in torso space. The bat hangs off the torso, not an arm, so it cannot inherit the arm chain. It has five parts: knob, two handle sections, barrel and cap. The rest axis leans forward over the plate, because a bat cocked back would pass through the big head.

### 15.6 Two species

Species depends on **side**, not team: home clubs are aliens and visitors are robots. Both share one skeleton. The arm offsets differ (alien 0.96, robot 1.04).

- **Alien:** a slim chest, capsule limbs, three-toed boots, three-finger hands, sock cuffs in trim, a single lathed egg head with glossy eye domes, blush and a smile, and two antennae. Skin is one of five soft greens chosen by `playerId % 5`.
- **Robot:** a wide chest with a panel of three lamps (the side lamps glow in the club's trim colour) and vents, pauldrons and a backpack in trim, dark ball joints, mitt hands, a rounded "TV" head with a recessed screen, a bellows neck, ear discs and one antenna. Skin is a fixed cream metal. The eyes are one of three faces chosen by `playerId % 3`: a squint, level bars, or wide.
- Name plates (batter, runner and pitcher only) are sprites with the depth test off, 18.6 units above the feet. The text is cut to 14 characters, on a cream pill with a stroke in the club's primary colour. Size is `4.6 x lens x clamp(distance / 95, 0.15, 1.75)`, and the plate hides within 13 units of the camera.

### 15.7 Exactly how a uniform is applied

**A uniform is five hex strings.** The `Uniform` type has `jersey`, `pants`, `cap`, `trim` and `helmet` (`pb:src/lib/mlb/teams.ts:55`). `Player.tsx` reads four of them. `cap` is used only by the dugout bench. [mine, 2026-10-23]

**Where the colours come from.**

- `TEAM_PALETTES` is a hand-typed table of `{ abbrev, primary, secondary }` for the 30 MLB team ids, with a grey-blue fallback. The Stats API publishes no club colours. Unknown teams, including every MiLB club, get the fallback. [mine: 30 entries]
- `buildUniforms(home, away)` runs inside `buildSnapshot`.
  - **Home kit:** jersey = primary; pants = a fixed off-white (`#EFEFE9`); cap = primary; trim = secondary; helmet = primary.
  - **Away kit:** the same pattern with fixed grey pants (`#B7BCC2`).
  - **Clash rule.** A redmean-weighted RGB distance. If the two primaries are less than 120 apart: when the away secondary is more than 120 from the home primary, the away jersey takes its secondary and its trim takes its primary. Otherwise the away jersey becomes grey and the trim takes its primary. [mine, `teams.ts:112`–`:127`]
  - Only the visitors ever change. Trim against trim and pants are never checked. The away `cap` and `helmet` stay the visitors' primary even after a flip, so a helmet can still match the home helmet. Species is the intended second read.

**Where each field goes in `Player.tsx`.**

| Field | Material | Parts |
|---|---|---|
| `jersey` | Phong, shininess 12 | The chest block, the alien upper sleeves, the robot upper arms, and the number plate's background |
| `pants` | Phong, shininess 18 | The pelvis and the thighs |
| `trim` | Phong, shininess 34, and an emissive "lamp" material | The belt, the alien chest disc and three buttons, sock cuffs, the robot toe cap, pauldrons, backpack and ear lens, the helmet rim ring, ridge and button, the number digits, and the glowing lamps |
| `helmet` | Phong, shininess 78 | The shell, the brim top and the ear flaps |
| `cap` | not used by figures | Only the bench in `Dugout.tsx` |

Skin, boots, gloves, laces, bat, screen and glow are fixed neutral colours.

**The jersey number** is the only image texture on a figure. It is a 64 x 64 canvas, filled with the jersey colour, with up to two digits in bold 40 px sans-serif in the trim colour (`textures.ts`). It maps onto a 0.86 plane just behind the chest block, rotated by pi so it faces backward. **There is no front number, no stripes, no logo, no wordmark and no cap on a fielder.** There is no number at all if the player has none. [mine, `Player.tsx:1636`–`:1650`, `textures.ts:37`–`:58`]

The palette also colours the crowd shirts, the name-plate border, the confetti and beam-out colours, the scoreboard badge, the HUD badge and the OG-image roundel. Inference: dark trim on the emissive lamps (black on BAL or CIN) looks like a dead light, and nothing checks number-digit contrast.

### 15.8 What a "uniform skin" would need on top of this (Inference)

1. **A richer data model than two hex strings:** home, away and alternate kits; a cap colour separate from the helmet; sock and sleeve colours; stripe flags; wordmark text or logo ids. Palettes today are typed by hand for 30 clubs. (Tally has the per-game assignment: see #2580 and `docs/uniforms-and-logos.md`.)
2. **A texture pipeline** like `textures.ts`: one canvas texture per club and variant, with a cache, and **UV-aware regions**. The chest, sleeves and pelvis are separate rounded boxes and capsules, so each needs its own atlas region. Front, back and sleeve decals can reuse the number-plane trick, which already works.
3. **Per-team shared materials.** Today they are rebuilt for every player and every snapshot (section 14.6). That would be wasteful with textures.
4. **Cap geometry** for fielders if caps with logos are wanted. The README says a cap on an alien head "never sat right".
5. **A UV fix for merged benches.** The bench batches merge geometry through `joinGeometries`, which keeps only position and normal and drops UVs, so textured benches need a fix.
6. **A contrast guard** for digits and for the emissive lamps against arbitrary palettes.
7. **Other surfaces** (HUD, OG card, scoreboard) draw their own species and club discs, so a skin does not reach them by itself.
8. **Logos are trademarked** and the repo has no license. Tally hotlinks MLB's art at run time and does not store it (`docs/gameday-assets.md`).

## 16. HUD, audio, sharing

### 16.1 The viewer shell and HUD

- **`Viewer.tsx`** loads the scene with `dynamic` and `ssr: false` and a "Chalking the lines" fallback. It runs both the live and replay hooks, with the unused one inert. [code]
- **Scorebug** (`hud/Scorebug.tsx`): modes full, mini and hidden. Full shows a row for each team (species badge, abbreviation, runs, a batting dot), the inning arrow and ordinal, a base diamond, the count and outs, the hitter's line, the pitcher's line, and a venue, condition, temperature and wind line on wider screens. The panel is `pointer-events-none` except for its buttons.
- **Log** (`hud/History.tsx`): "Last play" opens as "Game log" on hover (mouse only; touch is excluded because it fakes an enter with no leave) or when pinned by a click. Newest first, grouped by half-inning with a sticky header and the running score, scoring plays highlighted, max height 52 vh, and a "Clip" link for each play to `/clip/{gamePk}/{id}`.
- **Callout** polls the director in `requestAnimationFrame` and shows a banner that clears after 4.2 s.
- **Intermission** card appears while the field is empty between innings, and can be dismissed.
- **Transport** (replay only): a range input over at-bats with half-inning ticks and scoring dots, play and pause, previous and next at-bat and half-inning, and a share menu.
- **Game over** card: headline, venue, species badges, a line score with R/H/E, and box scores with W/L/S. The README says it can be dismissed to keep watching. In the code, "Close" and "Back" are links to `/`. [mine]
- **Camera picker:** two entries (section 13.2), remembered in `localStorage`.
- **Phone layout:** the scoreboard becomes a full-width band at the top and the controls move to a bottom bar. The camera picker opens upward. The scoreboard starts in mini mode in portrait until the viewer touches it. The camera rig adapts to portrait (section 13.2).
- **Game list:** polls `/api/games` and `/api/games/recent` every 30 s. It hard-codes "2026".

### 16.2 Audio (`pb:src/lib/audio/sfx.ts`)

- **13 sound names**: pitch, mitt, crack, whoosh, foul, cheer, bigCheer, groan, strikeout, launch, firework, beam, organ. `strikeout` and `organ` exist but nothing plays them. [mine, grep]
- **Synthesis.** A 2-second slightly low-passed white-noise buffer with random start offsets, shaped by biquad filters and exponential gain envelopes, plus sine "thump" oscillators. Examples: `pitch` is a 1,400 Hz high-passed burst; `mitt` is a 1,500 Hz low-passed burst plus a 150 to 75 Hz thump; `crack` is a band-passed burst whose centre (1,900 to 3,000 Hz) and level scale with intensity, plus a thump; `whoosh` is a band swept 420 to about 1,500 to 380 Hz; the crowd sounds are looped noise through a swept band with a 5.5 to 8.5 Hz tremolo; `firework` uses 5 to 11 `setTimeout` embers that are **not** on the audio clock.
- Master gain is 0.5. The audio context is created lazily, `play()` returns silently while it is suspended or muted, and the viewer wakes it on the first pointer or key event.
- **Cueing.** Sounds fire from `Cue.at` on animation timestamps, not on event arrival, so the crack lands with the swing and not with the poll. The crowd is the **home** crowd: what helps the home club gets a cheer (a big cheer at magnitude 0.9 and above), and everything else gets a groan.
- The only literal TODO in `pb:src/` is the missing ambience bed in `sfx.ts`.
- **For Tally:** Gameday has a "no sound, ever" rule (#2566). None of this ports.

### 16.3 Brand and sharing

- **OG-image routes** use Next's `ImageResponse` (satori) with inline SVG data URIs, fonts read from disk, a restated copy of the CSS palette, and a generic brand card when a play cannot be resolved. Revalidation: the game card 3,600 s, the at-bat link and the clip 86,400 s.
- **Species faces** exist in three hand-synced copies: an SVG component, the canvas calls that paint the in-park scoreboard, and the 3D models. OG cards and the game list use a colour roundel or dot instead.
- The `ParkVignette` component has no user outside its own file; the same drawing also exists as an SVG string in `og.ts`.

## 17. Feed edge cases the author found

Each row names where the code handles it.

| Case | Handling |
|---|---|
| A postponed game filed as "Final" with no plays (27 postponements and 3 cancellations in the first half of 2026) | `isCalledOffStatus` and `isFinalStatus` (`client.ts`) |
| A postponed game keeps its `gamePk` when it is made up, so a `gamePk` query returns two entries | `fetchScheduleGame` prefers the played entry. `dedupeGames` keeps the best state by rank: live, then final, then upcoming |
| Doubleheaders | Only via `scheduledInnings` in `deriveGameOver`. Both halves of two doubleheaders validated [doc] |
| A rain delay (a real gap of 107 minutes) | Not special-cased. The validator warns on gaps over 15 minutes. Playback ignores time |
| Pregame advisories on the first play moved the start | Events before the first pitch are skipped (`reconstruct.ts:480`) |
| A game in Preview has no lineup | The "not yet" card; the README lists the empty park as a known gap |
| Box score player lines exist only in final state | Documented. A replay shows end-of-game numbers beside a first-inning name. The line score, which places the players, is rebuilt exactly |
| An early "Game Over" (coded `O`) and a logical final | `statusFinal` and `deriveGameOver` |
| MLB keeps `isTopInning` through the middle break | `reconstruct.ts:445` |
| The result is published after the pitch | The hold, and a synthetic 1.5 s lag in reconstruction |
| The `count` field is unreliable | Recounted in the extractor and the reconstructor |
| Runners are listed once per movement | `normalizeRunners` and `advanceBases` |
| Automatic balls (the pitch clock) have no coordinates | `located` and `trackedPitch` |
| A foul tip caught for strike three | Deliberately not held |
| Switch hitters | Bat side from the matchup |
| Double switches and substitutions | Matched by the substitute's side |
| The last at-bat of a walk-off never resolves | Exempt in the validator |
| A cached play-by-play that is a few plays stale | `mayBeStale` and one uncached re-read |
| A play amended by replay review | The result is not re-emitted; the snapshot corrects |
| Spring training | Excluded by `SEASON_OPENING_DAY`; it reconstructs fine [doc] |

**Open edge cases (Inference, from the reader):** suspended or resumed games and the warmup state have no handling; `/api/game` caches coded `O` as immutable, so late fields such as `decisions` could freeze out; a postponed game cached as "Final" could go stale if it is later made up; `/api/clip` checks only the abstract state while `/api/game` also accepts `F` and `O`.

## 18. Constants worth remembering

Values are from the readers' notes unless a tag says we re-checked them. Feet unless noted.

### 18.1 Timing

| Constant | Value | Where / why |
|---|---|---|
| `THROW_TIME`, `THROW_RELEASE` | 0.62 s, 0.32 | windup length; release at 0.62 + 0.62 x 0.32 = 0.818 s [mine] |
| Pitch flight | 0.46 s at 95 mph, clamped 0.38–0.78 s | `pitches.ts`: `95 / mph x 0.46` |
| `SWING_LEAD` | 0.27 s | swing starts this long before the plate [mine] |
| Swing clip | 0.62 s hit or foul; 1.15 s whiff | `director.ts` |
| Tails | foul 1.9 s; strike three 1.8 s; other whiff 1.4 s; else 0.75 s | after the plate |
| `CARRY_CAP` | 0.1 s | max overshoot passed to the next animation [mine] |
| Queue guard | more than 14 events: keep non-pitch events, newest 8 | `director.ts:1146` [mine] |
| `RETURN_SPEED` | 26 ft/s | idle walk-home [mine] |
| `MATERIALIZE_TIME` | 0.6 s | arriving actors fade in [mine] |
| Runner time per base | 2.6 s run; 3.4 s home-run trot; 4.2 s walk or hit-by-pitch | "quicker than life" |
| Throw | starts 0.4 s after the gather; 0.6 s long | `compileResult` |
| Result hold | 4.2 s home run; 2.4 s other | after the last runner |
| Post-out pause / field beam-out / empty field | 1.1 s / 0.7 s / 2.0 s | third out |
| Retire | beam +0.3 s, dissolve 0.5 s, gone +0.95 s | out runner |
| Idle: settle to `center` / cutaway after / since last cutaway / cutaway hold | 0.9 s / 7 s idle / 26 s wall-clock / 4.5 s | cameras |
| Pose holds | reaction 3.2 s; collapse 4.6 s; movement 0.6 s | idle |
| Hold timeout | 12,000 ms | `events.ts:333` [mine] |
| Live poll | 5 s live; 15 s idle; 1.5 s while a pitch is held; delay x `min(4, 1 + failures)` | `useLiveFeed.ts` [mine] |
| Proxy cache | 3,000 ms live; 32 live entries; 24 final entries; 64 clip entries | routes [mine for 3 s, 24, 32] |
| Replay beats | pitch 5,000 ms; play 3,000 ms; between 5,000 ms. Clip 2,200 / 1,200 / 0 | `timeline.ts:37` [mine] |
| `CHECKPOINT_EVERY` / `CLIP_SHAPE_VERSION` | 50 frames / 2 | [mine] |
| Reconstruction | 200 ms minimum gap; 1,000 ms between-frame offset; 1,500 ms result lag | `reconstruct.ts` |

### 18.2 Geometry and mapping

| Constant | Value |
|---|---|
| Base distance / half-diagonal | 90 ft / 63.64 ft |
| Rubber depth / mound depth / mound height | 60.5 ft / 59 ft / 10/12 ft |
| Fielding spots (lateral, depth) | P (0, 58.5), C (0, -11), 1B (52, 79), 2B (38, 129), 3B (-52, 81), SS (-40, 128), LF (-132, 262), CF (0, 316), RF (132, 262) |
| Wall by angle | -45 deg 331; -30 deg 371; -15 deg 398; 0 deg 404; 15 deg 396; 30 deg 368; 45 deg 327 ft (linear between) |
| Wall height / warning track | 9 ft / 16 ft |
| `FIGURE_SCALE` | 2.35 (the README says 2.4) [mine] |
| `platePoint` | sideways `x x 2.59`; height `max(0.5, -0.39 + z x 2.59)`; depth 1.35. Knees 1.6 ft to 3.75 units, letters 3.4 ft to 8.42 units [mine] |
| Default zone and plate height | 3.4 and 1.6 ft; 2.5 ft when `pZ` is missing |
| Hit-coordinate origin | pixel (125.42, 198.27); y is flipped |
| Hit-coordinate scale | Pocket Ballpark **2.29 ft/px**. Tally `HIT_COORD_FT_PER_UNIT` **2.51** (median 2.509 over 39 caught fly balls in 3 games; `src/lib/ballpark/hitProjection.js`). Our check on gamePk 849841: home runs 2.46–2.47 (n=3), deep fly and line balls median 2.50 (n=19) [mine, 2026-10-23]. A 447 ft home run (181.8 px) comes out near 416 ft at 2.29. |
| Batter's box | batter at 9.2 ft off the plate, 2.4 deep; on deck at 40 ft, 20 deep |

### 18.3 Motion

- Stride (derived from joint angles; reader's computation): sprint 24.3 ft, run 21.1 ft, walk 10.4 ft. Gait floors in body-scale mph: sprint 10, run 6, walk 0; hysteresis 0.4.
- `pace(u)`: accelerate 18%, decelerate 24%; start at 30% of cruise speed, end at 12%.
- Batted-ball speeds (carry): ground 96, line 128, fly 90, home run 105 ft/s. Hop: height x0.4, speed x0.66 per hop. Chase time 0.25 s + distance / 34 ft/s.
- Pitch shapes: four-seam `drop` 0.35 / `run` 0.25; curveball 1.95 / -0.6; sweeper 1.15 / -1.7; fallback 0.95 / 0.35 at 90 mph. Bézier bow factor 1.8.

## 19. Strengths, weaknesses and known gaps

### 19.1 Strengths

1. **A clean boundary.** One normalizer; the scene never sees MLB's JSON.
2. **One code path** for live, replay, seek and clips.
3. **The promotion rule** gives a calm, readable game with no scoreboard jumps.
4. **A real answer to "the result arrives after the pitch"**: recount, find the deciding pitch, hold up to 12 s, fuse pitch and result.
5. **A season-wide sweep** as a substitute for unit tests, and it found real cases (postponements filed as final).
6. **Replay without storage.** The author measured that rebuilding is cheaper than the network call, and removed the storage plan.
7. **Pacing by animation, not by clock.** A home run always plays out.
8. **Deterministic "randomness"** (hash of id) so a scrub looks the same.
9. **Honest naming of the gaps** in the README (shifts, park dimensions, relays).
10. **Short, specific docs** that name which file to open for a change.

### 19.2 Weaknesses (checked unless marked)

1. **No tests, no CI.** There is no `.github` folder and no test file. [mine, 2026-10-23]
2. **Replay lighting is fixed at start + 5 h** for any past game (section 6.1). [mine]
3. **The catch-up guard is blunt**: it drops all pitch events, then truncates to the newest 8 outcomes, with no speed-up. [mine]
4. **The hit-coordinate scale is about 8% short** (2.29 against about 2.5). [mine]
5. **Dead code and unused fields**: `clearQueue` (no caller), `cameraFocus`, `cameraPosition`, `busy`, `queueLength`, `HOME_RUN_WALL`, `MOUND_Y`; the `SHOT_HOLD` table is almost dead (every shot change cuts).
6. **Steals, pickoffs and substitutions are not animated from data.** `ActionEvent.runners` is always empty; the director guesses a steal from text. Inference: "caught stealing" probably plays as a safe steal.
7. **Fouls and some home-run spots are invented**, not drawn from feed data.
8. **Pitch shape ignores spin and break data.** It uses only the pitch name and speed. The feed has `pfx` and nine fit parameters, which Tally already uses (`realFlight`).
9. **No handling for ABS pitch challenges.** No use of `challenge`, `reviewDetails` or `hasReview` in the repo. [mine]
10. **Fragile status logic**: hard-coded roofed-park names; no handling for suspended games; `isLiveStatus` ignores the warmup codes that its comment lists. [mine for the last]
11. **Caches are per server instance**, and a coded-`O` game is frozen as immutable.
12. **Documentation drift** (section 19.4).
13. **Left-handed pitchers.** `Player.tsx` never reads `pitchHand` and the throw always uses the right arm, while the director picks the ball's release side from `pitchHand`. [mine, grep] Inference: a lefty's visible arm and the ball's release side can disagree.
14. **Batter handedness is only half mirrored (needs a render to confirm).** `batSide` flips the head yaw and the ear flap, but the bat axes and the swing's twist sign are fixed in torso space. Inference from the reader's reading of the rotation math: a left-handed batter's bat may start on the wrong shoulder.
15. **Rebuild churn on every polled snapshot** (section 14.6). Not measured.
16. **Cost sits in the figures:** about 75 un-instanced meshes each, 18 per-figure materials, no shared materials. Inference from counting.
17. **Unbounded texture cache**, per-frame allocations in `poseValues` despite comments saying otherwise, and a zero-fill of about 2,760 instance slots every frame.
18. **Hand-synced duplicates:** the species face exists in three copies; the park vignette in two.
19. **Hard-coded year and credit:** the game list says "2026" and the intermission card names the author.
20. **Reader's inferences, not re-checked:** a visibility refresh can double the polling chain; the replay play button is dead after the last frame; a runner who moved is re-created at a standing spot when a snapshot promotes, which is a small teleport.

### 19.3 Known gaps the README lists

No defensive shifts. Every park uses the same generic dimensions. Relays and rundowns are one generic throw. A game in Preview has no lineup, so the park is empty. A crowd-reaction TODO and an ambience-bed TODO (`lib/audio/sfx.ts`).

### 19.4 Where the docs and the code disagree

| Doc says | Code says | Checked |
|---|---|---|
| Four camera modes, including umpire and sky (README, `ARCHITECTURE.md`) | The `CameraView` type has two: `broadcast` and `home_plate` ("Press Box") | [mine] |
| "No dugouts or bench figures in the 3D scene" (README) | `Scene.tsx` renders `<Dugouts>`; `Dugout.tsx` seats a bench | [mine] |
| The queue guard "drops pitch-by-pitch detail and keeps the outcomes" | It also truncates to the newest 8 | [mine] |
| `clearQueue()` is part of the API (`ARCHITECTURE.md`) | Nothing calls it | [mine] |
| Pitch break is applied "as accelerations in g" | It is a scaled Bézier control offset | reader |
| `low` is used "off a home run or a triple"; `wide` as the ball leaves; `follow` for the trot | Home runs use `launch`, `park`, `trot`; `low` is for triples and hard line drives; `wide` is for change of sides and idle | reader |
| A ground ball is "on the dirt inside forty feet" | The carry range reaches 78 ft | reader |
| Figures are 2.4x life size | `FIGURE_SCALE` is 2.35 | [mine] |
| `RECORDING.md` mentions "Speed 4x" and says the frame fingerprint excludes `inningState`, pitcher, batter and status | The fingerprint includes them; there is no speed control | reader |
| `SEASON-REPLAY.md` mentions a `"reconstructed"` kind on `ReplaySource` | The code has no such kind | reader |
| Crowd reaction is "a TODO" (README) | `Crowd.tsx` implements it fully | reader |
| The crowd is "four instanced meshes" (README) or five (`ARCHITECTURE.md`) | Seven, by the reader's count | reader |
| Rounded boxes are "an extruded, bevelled profile" (README) | `roundedBox` wraps three's `RoundedBoxGeometry` | [mine] |
| The final card "can be dismissed to keep watching the park" (README) | "Close" and "Back" are links to `/` | [mine] |
| "A single shadow-casting sun" (README) | At night the sun stops casting and two spotlights cast | reader |
| `snow` depends on freezing (type comment in `sky.ts`) | The code tests only the condition text | reader |
| A "reset hop" idle gesture (README) | No such gesture in the code | reader |
| `Dugout.tsx` says the snapshot hands back the same uniforms every time | The builder makes new objects every poll | reader |
| `strikeout` and `organ` sounds | They exist, and nothing plays them | [mine] |

## 20. How it maps to Tally

Tally's Gameday umbrella is #2566, with the stage in #2568, the chase camera in #2569, pitch-by-pitch in #2570, event steps in #2571, and 3D players with uniform skins in #2580. This section says what ports. It is our reading, so it is Inference unless a source is named.

### 20.1 What conflicts with Tally's rules (read this first)

- **Pocket Ballpark has no seal.** Its normalizer builds the score, count and result from the feed on every poll and holds the result back only in animation order. Tally's root rule: on the four scoring surfaces, a score-revealing value never exists in the DOM until the reveal, and reveal-only modules (`linescore.js`, `derive.js`, `hitchart.js`) are callable only inside a `SealBox` reveal render function (root `CLAUDE.md`, ADR-0001, ADR-0002). A Gameday normalizer would be reveal-only. A new module in `src/api/` does not lint until it is classified in `spoiler-manifest.json` (`src/api/CLAUDE.md`).
- **Its "pending snapshot" is not a seal.** A pending value in memory is "computed early" in Tally's terms. Tally's version of "visible state moves only on a permitted trigger" is the reveal mark (ADR-0016) and the tap.
- **Timing must not depend on the result** (ADR-0046, as quoted in #2568 and #2570). Pocket Ballpark delays its callouts so the call lands when the play settles. That protects the viewer in an always-on feed. In Tally the reverse worry applies: the sealed layout and the advance control must look and act the same whatever comes next.
- **No sound, no haptics** (#2566). Pocket Ballpark synthesizes sound.
- **No scroll** on Gameday (#2566). Pocket Ballpark overlays a HUD on a canvas.
- **Fresh start** (#2566). Pocket Ballpark is reference only. Do not import it, and do not copy it. It has no license.

### 20.2 What ports as an idea

| Pocket Ballpark idea | Tally counterpart | Fit |
|---|---|---|
| Recount balls and strikes from the pitches | `pitchInfo.js` already gives each pitch its own `balls` and `strikes` (#1858, per #2570) | Same idea, already in the engine |
| Find the deciding pitch before the result is published | #2570's rule that the last pitch's `details.code`, `call.description`, `isOut` and `isInPlay` leak the outcome | The rule in #2570 is the safety twin of this trick. The recount is how to find "the last pitch" before the result exists |
| "A pitch with no coordinates is not located" (`located`) | #2570: an untracked pitch must step with no error; #2568 notes MiLB parks that report no extension | Keep a `located` flag |
| Fouls and balls with no data get a made-up path, seeded by a hash | #2569's tier B (a drawn arc) and Gary's "pencil" rule (`docs/contact-replay.md`) | The seeded hash is a good way to make a drawn arc repeatable. Mark it "drawn" |
| Hit coordinates: ground balls are reported where fielded | ADR-0051; `HIT_COORD_*` in `hitProjection.js` | Tally found the same fact independently. Use Tally's 2.51 scale, not 2.29 |
| One function maps plate coordinates onto the figures; the strike-zone box uses it too | `realFlight` and #2568 slice 0 | Keep the principle: the pitch and the box share one mapping |
| Two-phase batted ball (carry, then run-out) | `simFlight` and `fitLift` (physics with drag and lift) and the tiers in #2569 | Tally's physics is more faithful. Pocket Ballpark's run-out (three hops, then a roll) is a cheap idea for what happens after landing |
| Shot list (center, mound, slot, ball, launch, park, trot, wide) and the cut-only rule | #2569's shot list, "cuts to other angles are welcome" | Useful vocabulary. Every shot there is a cut, never a glide |
| Portrait framing: hold the horizontal field of view when the screen is tall | #2568: no scroll at 390 x 763 | Applies to any 3D camera in Tally |
| Per-game rebuild of past moments from a final feed (`reconstructFrames`) | Tally steps by reveal cursor over per-at-bat data (ADR-0016, `focusView.js`) | Probably not needed for stepping. It matters only if Gameday must show the state of the field at a past moment, such as defense and runners. The linescore roll-back is the part to remember |
| Immutable caching for finished games | Tally uses a service worker and its own caches (`vite.config.js`) | Already a Tally concern |
| Season-wide sweep script instead of tests | Tally has a unit suite and the rule "a fix ships with a test" (root `CLAUDE.md`) | Keep Tally's tests. Add a sweep only as an extra check |
| Status traps (postponed filed as Final, duplicate `gamePk`, doubleheaders) | Tally's own status handling (not read for this document) | Check Tally's code against section 17 |
| Replay lighting must pass `now` | #2580 | Pass the replay time explicitly if a 3D scene ever lights by time of day |

### 20.3 What does not port

- Aliens and robots (the art direction is the author's).
- The 3D park, crowd, weather, fireworks and sound.
- The per-instance proxy and its caches. Tally's game data is client-direct: every device queries `statsapi.mlb.com` itself (root `CLAUDE.md`, "Architecture").
- The `three` and React Three Fiber stack, unless Gary chooses 3D (#2580, #2568).

### 20.4 For #2580 (3D players with uniform skins)

Pocket Ballpark is a proof that code-built, jointed figures can read well from a broadcast camera. Its uniforms are flat colours and a number texture. It ships no uniform art. See section 15 for the exact method and for what a skin would need.

## 21. Reading order and where to change what

**To learn it (not to copy it),** read in this order: `pb:src/lib/game/types.ts`, `pb:src/lib/game/events.ts`, `pb:src/store/gameStore.ts`, `pb:src/hooks/useLiveFeed.ts`, `pb:src/lib/replay/reconstruct.ts`, `pb:src/lib/replay/source.ts`, `pb:src/hooks/useReplay.ts`, `pb:src/lib/field/geometry.ts`, then the first 150 lines of `pb:src/lib/anim/director.ts`. Skip `Player.tsx` and `park.ts` until you care about looks.

**Where to change what** (from the project's own `pb:docs/ARCHITECTURE.md`, spot-checked):

| To change... | Open |
|---|---|
| How a play is interpreted | `lib/game/events.ts` |
| What the HUD knows | `GameSnapshot` in `lib/game/types.ts`, then `normalize.ts` |
| Timing, pacing, poses, camera cuts | `lib/anim/director.ts` |
| How long a figure takes to change pose | `POSE_BLEND` in `components/scene/Player.tsx` |
| Where the fixed camera seats sit | `lib/anim/views.ts` |
| How a pitch moves | `lib/anim/pitches.ts` |
| Field dimensions, base paths, wall shape | `lib/field/geometry.ts` |
| Stands, towers, skyline | `lib/field/park.ts` |
| Lighting, time of day, weather | `lib/field/sky.ts` |
| What a player looks like | `components/scene/Player.tsx` |
| The strike-zone box | `components/scene/StrikeZone.tsx` |
| Club colours | `lib/mlb/teams.ts` |
| Polling | `hooks/useLiveFeed.ts` |
| When state becomes visible | `store/gameStore.ts` |
| What a recording stores | `lib/replay/format.ts` |
| Replay pacing | `REPLAY_BEATS` in `lib/replay/timeline.ts` |
| Whether a game counts as played | `isFinalStatus` and `isCalledOffStatus` in `lib/mlb/client.ts` |

## 22. Open questions

1. How do suspended and resumed games, and the warmup state, look in the status codes? Nothing in the code decides. (reader)
2. Does a made-up game keep the same `gamePk` in the cached final state, and for how long? (reader)
3. Is the 5-hour replay lighting intended? It looks like an oversight.
4. Is an empty `ActionEvent.runners` deliberate? The director may re-derive steals from the snapshot. (reader; not verified)
5. What does a caught-stealing action look like in the feed, and does the director's text match catch it?
6. What is the real-device cost of the 12 ms rebuild and the 4 MB heap? The author did not measure on a handset. [doc]
7. Does anyone see the small teleport when a runner's actor is re-created at promotion? Nobody rendered the app.
8. Would a measured scale of 2.5 change how the home-run and fly-ball landings look in its park? Not tested.
9. How would a seal sit in front of a normalizer like this? That is a Tally design question for #2566, not an open question about the project.
10. Does a left-handed batter's bat start on the wrong shoulder, and does a right-handed swing turn the right way? This needs a render. (reader)
11. What are the real draw-call count and frame time on a phone, and is the per-poll rebuild a visible hitch? (reader)
12. What is the exact crowd count? The estimates are about 1,000 to 1,200 (reader), "around twelve hundred" (README) and "a couple of thousand" (a comment in `park.ts`).
13. Were the Umpire and Sky seats removed on purpose? The docs were not updated. Nobody read the git history for it.
14. Is the jersey-number plate a visibly different shade from the chest because of different specular settings? (reader)
15. Should digits get a contrast guard for clubs with black trim, and should the lamp material avoid black on black?
