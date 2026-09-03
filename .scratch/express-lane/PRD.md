# Express Lane — score a finished game from pitch clips, full screen

## Problem

Games start between 6 and 8pm. That is family and chores time. The free hour
comes at 10 or 11pm, when the game is nearly over or done — and that is when the
scorebook comes out.

Today that means the MLB app: navigate to the game, fight the video player, and
try not to see a score on the way in. Worse, a 3-hour broadcast is the wrong
shape for the job. Scoring means jumping between plays, so the work becomes
tapping "skip 10 seconds" past commercial breaks and between-inning filler.

**Express Lane replaces the broadcast with the pitches.** One full-screen surface:
clips on the left, the scoring notation stepping forward on the right. No
commercials, no dead air, no scrubbing.

The whole game, strung together with no gaps, is about **40 minutes** — measured,
not estimated (see Appendix A). That is the feature in one number.

## The two modes

The mode is chosen when you enter Express Lane, because it decides what gets
staged, and staging is the expensive part. It is a per-session choice, not a
setting — you can leave and re-enter the same game in the other mode.

### Result mode (default)

One clip per plate appearance: the **last pitch of the at-bat**, which is the
pitch that carries the outcome. The clip's own title is the play — "Jackson
Chourio grounds out, second baseman Matt Shaw to first baseman Michael Busch."

This is what hand-scoring actually needs. The count comes from the *data*, free,
with no video at all (Tier 1 below). Video is only needed for the play.

Selector: for each `allPlays[]` entry, take the last `playEvents[]` element with
`isPitch === true` and a `playId`.

**This anchor is reliable. Verified across 570 plate appearances in 7 games:
570 of 570 ended on a clip-bearing pitch.** No plate appearance ended on a
non-pitch event, none lacked a clip, none was incomplete. Keep the fallback
anyway (see Edge cases), but it did not fire once.

### Full mode

Every clip-bearing event in order — every pitch, plus the non-pitch events that
also get clipped. Measured over those same 7 games, the non-pitch clips are:

| Count | Event |
|---|---|
| 19 | Pickoff Attempt 1B |
| 8 | Pitcher Step Off |
| 5 | Pickoff Attempt 2B |
| 4 | Automatic Ball — Pitcher Pitch Timer Violation |
| 1 | Automatic Strike — Batter Pitch Timer Violation |

The timer violations matter for scoring: they change the count. Pickoffs and
step-offs matter for the running game.

Selector: every `playEvents[]` element with a `playId`, in feed order.

### What neither mode can show, and why that is fine

Some scoring-relevant events carry **no** `playId`, so no clip exists:

| Count | Event | Note |
|---|---|---|
| 5 | Stolen Base 2B | happens *during* a pitch — the pitch clip shows it |
| 3 | Wild Pitch | same |
| 1 | Caught Stealing 2B | same |
| 2 | Runner Placed On Base | extra-innings automatic runner |
| 1 | Defensive Indiff | |
| 128 / 51 / 49 / 36 / 18 / 13 / 10 | Batter Timeout, Pitching Substitution, Mound Visit, Game Advisory, Defensive Switch, Defensive Sub, Offensive Substitution | correctly unclipped |

This drives the data model: **the rail is the complete event list; clips are a
sparse overlay on it.** A stolen base gets a rail row you can score, with no
video of its own — the pitch it happened on carries the picture. Substitutions
get rows too, because you write those on the card.

## The hard constraint: ~2.1 Mbps, and no way around it

This is the number that sets the design. Measured, not assumed:

- **Pitch clips download at ~2.1 Mbps, and concurrency does not help.** Seven
  parallel downloads gave 2.0 Mbps *aggregate* — the same as one alone.
- Same machine, same minute, the condensed-game host the app already uses:
  **134 Mbps.**

So the throttle belongs to MLB's per-pitch clip infrastructure. It is not the
user's connection and not our loading strategy. Nothing we write improves it.

A full-quality clip is 4–6 MB for 7.5 seconds of video. **It takes 2–3× longer to
fetch than to watch.** A rolling prefetch window can therefore never catch up: it
falls further behind on every clip.

### Two conclusions that follow

**1. Half-inning batching is the wrong unit for video.** Seventeen clips is
~85 MB, which is 5+ minutes of dead time at every half-inning boundary. That
relocates the stall rather than removing it. Half-inning is the right unit for
the *index*. It is the wrong unit for the *bytes*.

**2. Stage in advance; do not prefetch on demand.** This fits the evening
exactly. Clips publish 8–26 minutes after each pitch, so a staging job started
when the game starts naturally tracks the game and finishes before the scorebook
opens. By 10pm everything is local and Express Lane steps instantly, offline.

### Budget per mode

Clip sizes are **measured**, not derived from duration — 28 clips sampled from
gamePk 824634 with Range requests:

| Clip type | Avg | Median | Range |
|---|---|---|---|
| Terminal pitch (Result mode) | **6.50 MB** | 6.27 | 4.34 – 12.11 |
| Ordinary mid-count pitch | **4.25 MB** | 4.02 | 3.43 – 6.13 |

Applied to gamePk 824634 (84 PAs, 243 ordinary pitch clips, 6 non-pitch clips):

| Mode | Clips | Video | Bytes | Stage @2.1 Mbps | Staging rate |
|---|---|---|---|---|---|
| Result | 84 | 15.3 min | **546 MB** | **35 min** | 1 plate appearance / **25 s** |
| Full | 333 | 41.5 min | **1604 MB** | **102 min** | 1 clip / **18 s** |

Result mode is ~34% of Full mode's bytes on 25% of the clips, because terminal
pitches run longer (~11s vs ~7.5s) — they include the play developing.

**Evict behind the cursor.** Once a plate appearance is scored, its clip can be
dropped. Peak storage becomes the staging lead, not the whole game — roughly
100–200 MB rather than 546 MB. WebKit gives a Home Screen web app the same quota
as the browser (up to 60% of disk per origin, LRU eviction, and **no separate
Cache API cap** — a widely repeated "50 MB Cache API limit" is contradicted by
WebKit's own storage-policy post). Call `navigator.storage.estimate()` on the
real device rather than trusting any published figure.

## The staging trigger, resolved

The trigger question answers itself differently per mode, because the staging
*rate* differs — and the rate, not the total, is what matters.

**Result mode needs no trigger at all. The trigger is opening Express Lane.**
Staging delivers a plate appearance every ~25 seconds. Nobody scores one faster
than that: you watch ~11 seconds of clip and then write the notation. So staging
outruns the scorer from the start. A pre-roll of one half-inning (~2 minutes) is
enough, and after that it stays ahead for the rest of the game.

What makes that safe rather than optimistic is Tier 1. **The rail is free and
instant, so it never blocks.** A fast stretch — three strikeouts scored in 40
seconds — degrades to scoring from the pitch data while video catches up. The
worst case is a degraded minute, never a stop. Build the "video catching up"
state deliberately; it is the mechanism that makes the no-trigger design work.

**Full mode cannot do this.** It needs a clip every ~18 seconds, and nobody
spends 18 seconds on a mid-count ball. Full mode must be substantially
pre-staged, which means committing ~102 minutes ahead of time. That is a
different product with a different trigger, and it is deferred (Open decision 1).

### Platform facts behind this, verified 2026-09-03

- **Background Fetch does not work in Safari.** MDN lists it as limited
  availability; Chrome and Edge only. So no downloading with the app closed on
  iPhone, and no way around that.
- **Screen Wake Lock DOES work on iOS Safari, 16.4+.** So "leave it on the
  charger with the screen on" is a supported mechanism rather than a hope. This
  is what would make a phone-side Full mode staging screen viable.
- **Storage is not the blocker.** Home Screen web apps get the browser's quota:
  up to 60% of disk per origin, LRU eviction, no separate Cache API cap.

### Ruled out

**Staging on the desktop and scoring on the phone does not work.** Cache and
IndexedDB are per-origin *per device*; there is no sync path for 546 MB, and
building one would mean re-serving MLB video — the exact thing the Terms of Use
prohibit and the reason the proxy was dropped. Desktop staging only helps if the
scoring also happens on the desktop.

**The silent-audio background trick is rejected.** Keeping a page alive on iOS by
looping silent audio would allow closed-app staging, but it abuses the platform
and is precisely the kind of thing an OS update breaks silently.

## Data structure — three tiers, only the third is expensive

### Tier 1 — the scoring rail. Free; already in the app.

From `feed/live`, per half-inning: the ordered event list with count, pitch type,
velocity, and outcome. This drives the notation panel and it is the spine both
modes walk. No new fetch and no new module — `pitchInfo.js` and
`halfInningFeed.js` already parse this, gated as they are today.

```
RailRow {
  key            // playId when present, else `${atBatIndex}:${eventIndex}`
  halfIndex      // the existing seal unit
  atBatIndex
  kind           // 'pitch' | 'nonPitchClipped' | 'action'
  playId | null  // null => rail row with no video
  count          // { balls, strikes } before/after
  isTerminal     // last pitch of the plate appearance
  // reveal-only fields (never read outside a reveal render):
  description
  result
}
```

`kind` is what the two modes filter on. Result mode keeps `isTerminal`; Full mode
keeps everything with a `playId`, and shows `action` rows as scoreable rows with
no player.

### Tier 2 — the clip index. Cheap and live.

Per game, `playId → { mp4Url, posterUrl, durationSec }`.

- **URLs** come from Savant, one lookup per `playId`, parallel-safe: 8 resolved
  in 940ms. A half-inning (~17) is ~2s; a whole game (333) is ~40s.
- **Durations and titles** (optional) come from the gateway's `mediaPlayback`,
  100 ids per call — a whole game in 4 calls and 2.7 seconds.
- **Posters** need no call at all; they derive from the `playId`.

Store in IndexedDB keyed by `gamePk`. The clip URLs are deterministic — three
calls for the same `playId` returned the identical URL — so the index never goes
stale and staging is resumable across app restarts.

### Tier 3 — the byte store. The only hard part.

Service worker plus Cache API, keyed by clip URL, filled by an **ordered staging
queue**, single-threaded (concurrency buys nothing), rate-limited, resumable,
and evicting behind the cursor.

```
StagingJob {
  gamePk
  mode           // 'result' | 'full'
  feed           // 'home' | 'away' — both exist for every clip
  queue          // ordered playIds, game order
  staged         // playIds present in the cache
  cursorKey      // where the scorer is; evict before this
  state          // 'idle' | 'running' | 'paused' | 'complete' | 'blocked'
}
```

The mode is part of the job because switching modes changes the queue. Switching
Result → Full keeps every already-staged clip and appends the rest; Full → Result
needs no new bytes at all.

## Spoiler rules specific to this surface

The app's existing rule holds: fetching is safe, rendering is gated. Staging
bytes for unreached pitches is fine because the cache is not the DOM — the same
argument `highlights.js` already makes in its header. Reading the *index* one
half ahead is the sanctioned `halfIndex <= revealedThrough + 1` lookahead from
ADR-0003/0010.

Three traps are new to Express Lane:

1. **Never use the next clip's poster as a loading placeholder.** Every frame has
   the broadcast scorebug burned into the pixels — score, inning, count, outs
   (verified by reading frames directly). So pitch N+1's poster can show the
   result of the at-bat still being scored. Use a neutral placeholder.

2. **No game-wide progress bar, and no "pitch 47 of 333."** A total clip count
   leaks game length, which leaks extra innings — straight against ADR-0008.
   Show position within the current half only. Note the queue length is itself
   the leak, so the staging UI must not surface a game-wide total either.

3. **Advancing in Express Lane is the reveal act.** Drive the existing
   `revealedThrough` high-water mark from it, so paper and screen stay in sync
   and it syncs across devices through `reveal.js` for free.

A consequence to accept deliberately: because the scorebug is in the pixels,
**Express Lane can never have an unrevealed preview mode.** Entering it is
consenting to see the score of the pitch you are on.

## Out of scope, decided

- **No server-side video proxy.** It was the way to reach MLB's cheaper 896×504
  rendition, which genuinely streams in real time. It is dropped: MLB's Terms of
  Use provide the Services (defined to include "audio, video and audiovisual
  content") "for your private, non-commercial use" and say you "may not
  distribute, modify, translate, rebroadcast, **transmit, stream**, perform or
  create derivative works of them." A function that fetches MLB video and serves
  it onward is transmitting and streaming it. The same document explicitly
  carves out the design we are keeping: material "may be stored in a device
  except for personal and non-commercial use." On-device staging is the
  permitted case; re-serving is not. The proxy also existed only to spoof
  `Referer: https://www.mlb.com` and defeat a hotlink guard MLB built on
  purpose. Full reasoning in the memory note `mlb-video-proxy-crosses-tou`.
- **MiLB.** No pitch clips exist at all — sportIds 11–14 each had ~300 `playId`s
  and zero clips, on the default and the `MILB` forge instance, and Savant
  resolved none. Express Lane is MLB-only, degrading like every other MiLB
  surface.
- **Before 2016.** `playId`s exist back further but clips do not.
- **All-Star and exhibition games** (`gameType: "A"`). No clips.
- **Live scoring.** Clips lag 8–26 minutes, so Express Lane is for a game that is
  over or nearly over. That is the actual use case, not a limitation.

## Open decisions

1. **Full mode's staging trigger** — the only one that still blocks build. See
   "The staging trigger, resolved" above: Result mode needs no trigger, and Full
   mode needs ~102 minutes of pre-staging that iOS cannot do with the app
   closed. The fork is whether Full mode lives on the phone (a wake-lock staging
   screen and a charger ritual) or only on the desktop PWA (where Background
   Fetch works and nothing must stay awake). **Deferred deliberately, 2026-09-03:
   Gary has not scored a game on the laptop, so there is no basis yet for
   deciding whether desktop-only is acceptable.** Resolve it by trying a game on
   the laptop first, not by argument.
2. **Home or away booth.** Both feeds exist for every clip at no extra cost.
   Default to the Brewers' booth when they play, or ask once per game?
3. **Result mode's expand.** Should a plate appearance open into its own pitches
   on demand? Cheap in Tier 1 and Tier 2; costs bytes in Tier 3.
4. **Pre-roll depth.** How many clips must be staged before Express Lane will
   open at all.

## Edge cases to handle even though they did not fire

- A plate appearance whose last clip-bearing event is **not** a pitch (a pickoff
  ending the inning). Fall back to the last clip-bearing event of any kind.
- A plate appearance with **no** clip-bearing event. Render the rail row with no
  video rather than skipping it — the notation still has to be written.
- A clip that 404s or has not published yet. "Not posted yet", never a broken
  frame, matching the app's existing degradation convention.
- Extra innings. Innings past regulation unlock one at a time as
  `revealedThrough` advances (ADR-0008); the staging queue must not reveal their
  existence.

## Appendix A — verified API facts

All checked live 2026-09-03. Method and detail in the memory note
`pitch-by-pitch-video-feed`.

**The join key is already in hand.** Film Room clips key on the `playId` at
`feed/live` → `liveData.plays.allPlays[].playEvents[].playId`. gamePk 824634: 333
`playId`s for 327 pitches. Nothing new to fetch to know what clips exist.

For contrast, the `content` endpoint behind the shipped highlights feature gives
45 items with 23 `guid`s — 7% of pitches. Express Lane is ~14× that coverage.

**No authentication anywhere.** No cookie, token, or `Authorization` header. No
MLB.TV subscription. A bare `curl` User-Agent gets a 403; any browser UA passes.

| Asset | Where | Gate |
|---|---|---|
| Poster | `img.mlbstatic.com/mlb-photos/image/upload/{transform}/fastball/{playId}_{home\|away}.jpg` | none; derivable |
| Metadata | `fastball-gateway.mlb.com/graphql`, `mediaPlayback(ids:[…], idType: PLAY_ID)` | none; CORS reflects caller origin; **max 100 ids** (200 fails "Error reading data") |
| mp4, derivable | `fastball-clips.mlb.com/{gamePk}/{home\|away}/{playId}.mp4` | **Referer-locked to mlb.com** — browser-verified `MEDIA_ERR_SRC_NOT_SUPPORTED` from a foreign origin. Unusable. |
| mp4, playable | `sporty-clips.mlb.com/{opaque}.mp4` via `baseballsavant.mlb.com/sporty-videos?playId={playId}` | none; `ACAO: *`; plays cross-origin |

The two mp4s are the same asset (both 4,000,595 bytes for the sample pitch). The
Savant lookup is 10.3 KB gzipped, ~0.12s, cached (max-age 1200 / s-maxage 3600).
Its token is `playId XOR another UUID`, so it cannot be derived offline — but it
is stable, so it can be cached.

The gateway's `search` resolver is still broken (it injects query fields
`ContentSourceRank` and `Language` that its own index rejects, on every argument
permutation tried). Irrelevant: `feed/live` already supplies every `playId`.

**Runtime, strung together with no gaps** — the headline number:

| Game | Pitches | Clips | Total |
|---|---|---|---|
| MIL@CHC 9/2 | 327 | 333 | 41.7 min |
| SF@KC 7/20 | 267 | 269 | 37.9 min |
| MIL@STL 7/7 | 279 | 283 | 37.4 min |
| CHC@ATH 3/31/25 | 368 | 375 | 51.0 min |

Average clip 7.5–8.4s, range 5–28s. Against a 3-hour broadcast: ~4.5×
compression.
