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

**Corrected 2026-09-09.** Earlier drafts led with "the whole game is about 40
minutes." That is Full mode's runtime, and Full mode is deferred. The mode that
ships is Result: **15.3 minutes of picture, which takes about 35 minutes to
arrive** — and under the film gate the arrival time, not the runtime, is what a
scorer actually sits through. Lead with coverage instead, which is the honest
claim and the real delta: **every pitch in the game has film, and you step to
it**, against the 7% of plays the shipped highlights button can reach.

Runtime figures belong in the mode chooser, per mode, where they inform the one
choice that costs the evening. The 40-minute measurement is real and stands (see
Appendix A); it is simply not this feature's headline.

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

**This section became load-bearing on 2026-09-09.** The film gate blocks the
cursor until the picture arrives, so the list above is exactly the set of rows
the gate must *never* block on: roughly 275 events a game that have no clip and
never will. A gate keyed on "does this row have a clip" deadlocks at the first
mound visit. It must key on the covering clip instead — see "The film gate".

## The hard constraint: ~2.1 Mbps, and no way around it

This is the number that sets the design. Measured, not assumed:

- **Pitch clips download at ~2.1 Mbps, and concurrency does not help.** Seven
  parallel downloads gave 2.0 Mbps *aggregate* — the same as one alone.
- Same machine, same minute, the condensed-game host the app already uses:
  **134 Mbps.**

**Re-tested and confirmed, 2026-09-09.** Review argued this was a measurement
artefact: seven parallel downloads sharing one HTTP/2 connection also share one
congestion window, which looks exactly like a server throttle. The objection does
not survive. Re-run with clips drawn from seven *different* gamePks, so no single
game's cache shard could confound it:

| Test | Result |
|---|---|
| One clip, one socket | **2.06 Mbps** |
| Seven clips, seven separate TCP sockets | **1.67 Mbps** aggregate |
| Seven clips, six-socket pool (what a browser does) | **1.45 Mbps** aggregate |
| Neutral CDN, same machine, same minute, sustained | 48.6 Mbps |
| `img.mlbstatic.com`, same minute | 29.2 Mbps |

The detail that settles it: **`sporty-clips.mlb.com` negotiates HTTP/1.1, not
HTTP/2** (`Server: cloudflare`). So the shared-congestion-window story never
applied — and on HTTP/1.1 a browser opens up to six connections per origin, which
is the third row. More sockets do not merely fail to help; they are slightly
*worse*, because the same ~2 Mbps is divided and each connection pays its own
handshake. The ceiling is **per-client and specific to the clip host**.

**Operational constraint discovered in the same session: the host blocks
automated access.** After roughly 25 requests in a few minutes — including two
bursts of seven parallel — `sporty-clips` began returning empty bodies and then a
hard `403` to a bare HEAD. This is the risk shape the Terms of Use analysis
predicted: not a lawsuit, a silent IP block that breaks the feature mid-game. It
argues *for* the staging design already chosen. A single-threaded queue paced at
about one clip per 25 seconds reads as a person watching clips; a parallel
prefetcher reads as a scraper. **Never burst-fetch this host, in production or in
a probe.**

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

**2. Stage ahead of the cursor; do not fetch on tap.** The queue runs in game
order and stays in front of where the scorer is, so the clip is already local when
it is reached. This is a queueing rule, not a schedule. It does not promise that
the whole game is downloaded before you sit down — on iPhone it cannot be, because
Background Fetch is absent from Safari (see "The staging trigger, resolved").

What makes staying ahead sufficient is the *rate*, not the total. Clips publish
8–26 minutes after each pitch, so by 10pm every clip exists and the only limit
left is the 2.1 Mbps ceiling.

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

## The film gate — you cannot score past the picture

**Decided 2026-09-09. This reverses the previous design and it is the most
consequential decision in this document.**

Earlier drafts promised the opposite: the advance button never greys out, the
Tier 1 rail is always available, and a scorer who outruns the queue keeps going
on the pitch numbers while the film catches up. That is now withdrawn. **The
cursor may not pass the film.** If the picture for the next row is not here, the
scorer waits.

### Why the reversal is right

- **It makes Express Lane the thing it claims to be.** The app already ships
  at-bat stepping over a sealed half (ADR-0016) driven by the same
  `revealedThrough` mark. If a scorer can bypass the film, Express Lane collapses
  into at-bat stepping with a video panel bolted on, and its honest delta —
  100% clip coverage instead of the 7% the shipped highlights button gets, plus
  prefetch — stops being the point.
- **The bypass was load-bearing on an unmeasured claim.** "Staging outruns the
  scorer" rested on an asserted 25s-per-plate-appearance scoring pace that was
  never measured. Scoring pace is personal and varies by scorer, so no single
  measurement could have settled it for everyone. Gating removes the dependency
  entirely: the pace is the queue's, and it is the same for every scorer.
- **It collapses two designs into one.** No dual path, no degraded mode, no
  backlog of scored-but-unwatched plate appearances to return to, and no fourth
  screen per concept explaining a state that no longer exists.

### The rule, stated so it cannot block forever

A naive reading — "no clip, no advance" — deadlocks on the first pitching change.
Roughly 275 events in a nine-inning game carry no `playId` and never will (see
"What neither mode can show"). The gate must therefore key on the **covering
clip**, not on the row's own clip. Three kinds of row:

| Row | Gates on |
|---|---|
| A pitch | its own clip |
| An event *inside* a pitch — stolen base, wild pitch, caught stealing, pickoff | the clip of the pitch it happened on, which already shows it |
| Paperwork — pitching change, mound visit, substitution, defensive switch, game advisory | **nothing. Never gates.** You write it on the card; there is nothing to watch |

So the gate is: **advance is blocked only while a clip that is expected has not
arrived.** It is never blocked when no clip is expected.

### The reveal becomes atomic, and that is a real change

Under the old design the rail carried `description` and `result` as reveal-only
fields the scorer could fall back on. Under the gate they cannot be shown before
the film, or the fallback simply returns by another door — a scorer who can read
"grounds out, second baseman to first" has no reason to wait for the picture.

**Advancing now reveals the play and its film together, or not at all.** This is
cleaner than what it replaces, and it is the honest meaning of "the picture is
the point". While waiting, the screen may show what was already true before the
advance — the count, the batter, the base state — and nothing about the play.

### The escape hatch, which must exist and must be consented

A clip that is *expected* but never publishes cannot block forever. Clips lag
8–26 minutes behind live, so a scorer who opens a game minutes after the last out
will meet the publication frontier rather than the bandwidth ceiling — a
different state with a different remedy, and the PRD previously conflated them.
A 404 is the same shape.

The escape is a deliberate act, not a silent fallback: after a clip has failed or
stayed absent past a threshold, offer **"score this one without the film"**,
once, for that row. It must read as a decision the scorer makes, or the gate
erodes back into the old design within a week of use.

### What this costs, stated plainly

- **The session's pace is now the download's pace.** Result mode's ~35 minutes of
  staging stops being a risk and becomes a floor: a 9-inning game cannot be
  scored in Express Lane faster than the clips arrive. That is the trade.
- **Pre-roll matters much more than it did.** It was a nicety when the scorer
  could always proceed. It is now the difference between opening into a game and
  opening into a wait. This merges with Open decision 4.
- **Full mode gets worse, not better.** It needs a clip every ~18 seconds; gated,
  it becomes a slideshow of waits. This reinforces the deferral.

## The staging trigger, resolved

The trigger question answers itself differently per mode, because the staging
*rate* differs — and the rate, not the total, is what matters.

**Superseded in part by the film gate above, 2026-09-09.** The reasoning below
was built to answer "must we pre-stage, or does the queue stay ahead of the
scorer?" The gate dissolves that question: the queue no longer has to stay ahead
of anyone, because nobody can get past it. What is left is not a trigger question
but a **pre-roll question** — how much head start makes the opening feel like a
game rather than a wait. Open decisions 1 and 4 merge accordingly.

**Result mode still needs no trigger. The trigger is opening Express Lane.**
Staging delivers a plate appearance every ~25 seconds, and under the gate that
rate simply *is* the scoring rate. A pre-roll buys the opening innings their
flow; after that the scorer and the queue move together by construction.

What the Tier 1 rail is for has changed. It is no longer a bypass — under the
gate it cannot be, or the gate leaks (see "The reveal becomes atomic"). It
remains what it always was underneath: the complete event list the clips are a
sparse overlay on, the thing that knows a substitution happened and needs a row
even though there is nothing to watch.

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

**Decided 2026-09-09: IndexedDB Blobs, not the Cache API, and the service worker
comes out of the playback path.** Filled by an **ordered staging queue**,
single-threaded (concurrency buys nothing — now confirmed, and bursts get the
client blocked), rate-limited, resumable.

Both options cost nothing. This is worth saying plainly because it was asked:
the Cache API and IndexedDB are both browser-native and on-device, they share one
per-origin quota, and neither touches this project's infrastructure. Game data is
client-direct, so clips travel MLB → device without passing through a Vercel
function. No function bandwidth, no Vercel Blob, no Upstash. The only design that
would have cost money was the server-side proxy, which is already dropped on
Terms of Use grounds — so dropping it removed the bill along with the exposure.

The choice is therefore technical, and WebKit decides it:

- **`Cache.put()` rejects a `206` response.** Spec-mandated, every browser. So
  Range requests — the method used to measure clip sizes, and the natural way to
  resume a partial fetch — cannot also be the method that stores them.
- **Worse, WebKit issues Range requests whenever a `<video>` loads a URL a
  service worker intercepts**, and expects a real `206` with `Content-Range`
  back. Answering from a cached `200` is the classic "plays in Chrome, silently
  fails on iPhone" bug. Synthesising the `206` means `arrayBuffer()` on a 6 MB
  mp4 for every range request, inside a content process with a low memory
  ceiling — the most likely cause of a mid-game tab kill.
- **Blobs avoid all of it.** WebKit stores a Blob out-of-line, so reading one back
  does not transit the JS heap, and `URL.createObjectURL(blob)` is served
  natively with full range support. **Revoke every object URL on leaving a clip**
  — 84 unrevoked 6 MB blobs is roughly 500 MB resident and a certain crash.

Two storage cautions that survive either choice: `navigator.storage.estimate()`
is padded and rounded on WebKit and will not warn that the disk is nearly full;
and **WebKit evicts by origin, not by entry**, so pressure can drop the Cache
API, IndexedDB *and* `localStorage` together. The staged bytes are disposable —
clip URLs are deterministic and the index rebuilds — but `revealedThrough` lives
in `localStorage`, so an eviction mid-game would re-seal a game being scored.
Push the reveal mark to `reveal.js` on each advance, and call
`navigator.storage.persist()`, which Safari grants a Home Screen web app.

```
StagingJob {
  gamePk
  mode           // 'result' | 'full'
  feed           // 'home' | 'away' — both exist for every clip
  queue          // ordered playIds, game order
  staged         // playIds present in the store
  cursorKey      // where the scorer is
  filmKey        // furthest contiguous staged row — THE GATE. cursorKey may not pass it
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

4. **The waiting indicator must be indeterminate — no bar, no ETA, no byte
   count.** This trap is *created* by the film gate and did not exist before it.
   ADR-0046 holds that no timing before a reveal may be a function of the reveal.
   Under the gate the scorer now sits watching a wait for a pitch they have not
   reached, and terminal clips run 4.34–12.11 MB precisely *because* a longer one
   contains more play developing. A determinate progress bar therefore tells you,
   before you advance, that the next plate appearance is a long one — a called
   strike three and a triple with a rundown do not take the same time to arrive.
   Show that the film is coming. Never show how much of it is left. For the same
   reason, do not print a clip's duration before it plays.

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
  carves out the design we are keeping: "Neither these Third Party Materials nor
  any portion thereof may be stored in a device except for personal and
  non-commercial use." That is a prohibition with personal use carved back into
  it. On-device staging is the permitted case; re-serving is not. The proxy
  also existed only to spoof `Referer: https://www.mlb.com` and defeat a hotlink
  guard MLB built on purpose. Full reasoning in the memory note `mlb-video-proxy-crosses-tou`.
- **MiLB.** No pitch clips exist at all — sportIds 11–14 each had ~300 `playId`s
  and zero clips, on the default and the `MILB` forge instance, and Savant
  resolved none. Express Lane is MLB-only, degrading like every other MiLB
  surface.
- **Before 2016.** `playId`s exist back further but clips do not.
- **All-Star and exhibition games** (`gameType: "A"`). No clips.
- **Live scoring.** Clips lag 8–26 minutes, so Express Lane is for a game that is
  over or nearly over. That is the actual use case, not a limitation.

## Decisions taken

- **The film gate** (2026-09-09) — the cursor may not pass the picture. Its own
  section above; it supersedes the "never blocks" design throughout.
- **Concept A, Split Deck, is the spine** (2026-09-09) — video across the top,
  one large scoring box beneath, primary action at the foot. Chosen from four
  wireframed directions after review; the strongest single element of Concept D,
  the strip of plate-appearance chips along the foot, is imported into it. B
  survives only as the tablet layout. C is dropped: it has no way back three
  batters, and its swipe-up collides with the iOS home gesture.
- **No `needsFilm` predicate** (2026-09-09) — review proposed skipping clips for
  strikeouts, walks and hit-by-pitches to cut ~170 MB and speed the queue.
  Declined. Under the film gate it would also punch a hole straight through the
  gate, since those rows would advance freely while the rest waited.
- **Tier 3 is IndexedDB Blobs** (2026-09-09) — reasoning in Tier 3 above. Both
  candidates were free; WebKit decided it.
- **The 2.1 Mbps ceiling is real, per-client, and unfixable** (2026-09-09) —
  re-tested against the review's objection and confirmed. Design for the film
  being behind; do not design to outrun it.

## Open decisions

1. **Full mode's trigger.** Unchanged and still deferred, and the film gate makes
   it worse rather than better: at a clip every ~18 seconds, a gated Full mode is
   a slideshow of waits. The fork remains phone-with-wake-lock versus
   desktop-only. **Resolve it by trying a game on the laptop first, not by
   argument.** It blocks nothing: Result mode is what ships.
2. **Home or away booth.** Both feeds exist for every clip at no extra cost.
   Default to the club's own booth — the away booth when Milwaukee is away, the
   home booth when they are at home — with a one-tap switch, or ask once per
   game? Note that switching mid-game invalidates every staged byte ahead of the
   cursor, so the choice should be locked for a session the way mode is. Use the
   other booth as the first fallback for a 404, before "not posted yet".
3. **Result mode's expand.** Should a plate appearance open into its own pitches
   on demand? Cheap in Tier 1 and Tier 2; costs bytes in Tier 3. Review argued
   this is not optional but the escape hatch for the cases a single terminal clip
   cannot settle — a 6-4-3 pivot, or a runner going first to third — and should
   be in v1.
4. **Pre-roll depth**, now merged with the trigger question and promoted in
   importance by the film gate. Under the gate this is the difference between
   opening into a game and opening into a wait. Candidates: three clips (leaks
   nothing about game length, opens in ~75 s), or one half-inning (~2 min). A
   count of plate appearances must never be shown either way — it leaks how long
   the game ran, and so whether it went to extras (ADR-0008).

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
