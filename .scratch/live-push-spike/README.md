# Live push spike (#2578)

Research scripts. They touch no `src/` file, the app never imports them, and nothing here runs on a cron.
Delete this folder when the spike ends (go: the build issue replaces it; no-go: close #2578).

## The spoiler rule

**No script here may print a score, a play description or a result.**
Console output and log files hold only counts, bytes, timings, state words and message **shapes**
(key names and value types, never values). Every value passes through `shape.mjs` first.
Do not add a print of a raw value. `selftest.mjs` checks the redaction.

## Run

Needs Node 22 (global `WebSocket` and `fetch`) and, for the browser check, `npm install` in the repo.

```bash
cd .scratch/live-push-spike
node selftest.mjs                          # offline: redaction and the patch applier, against a finished game
node replay-check.mjs 870064 60            # recent stored patches of one game, checked against snapshots
node own-stamp-check.mjs 870064 6          # is a plain full feed equal to the snapshot for its own stamp?
node capture.mjs --gamePk=849805           # live: socket, push-triggered diffPatch, summary
node analyze.mjs out/849805-*              # net traffic against a fixed 15 s and 60 s poll
node browser-check.mjs --gamePk=849805     # does a browser (with an Origin header) get in?
```

`capture.mjs` can start hours before first pitch. A scheduled game's socket stays open and silent.
Stop it with Ctrl-C: it writes `out/<gamePk>-<start>/summary.json` and an `events.jsonl` log first.
`out/` is git-ignored. Options are listed at the top of `capture.mjs`.

**What the outputs mean.** `summary.json` holds counts and bytes. The ratios against a fixed poll come from `analyze.mjs`,
which reads `events.jsonl`; its header lists what the model counts and what it leaves out (verification fetches are not counted).
A fallback costs the failed diff plus the full feed fetched after it. A mismatch is counted once, because `capture.mjs` repairs
the merged feed with the snapshot after finding one.

## Files

| File | What it does |
| --- | --- |
| `shape.mjs` | Turns a message into its shape. The one value it lets through is a timecode. |
| `patch.mjs` | Immutable RFC 6902 applier. Always returns a new root object (ADR-0007). |
| `selftest.mjs` | Offline checks: no value leaks through `shape`, and real patches merge to the served snapshot. |
| `capture.mjs` | The live capture. |
| `analyze.mjs` | Net traffic of a run (or several) against a fixed 15 s and 60 s full-feed poll, from `events.jsonl`. |
| `replay-check.mjs` | Replays recent stored patches of a game and checks every merge against the served snapshot. |
| `own-stamp-check.mjs` | Checks whether a plain full feed matches the snapshot for its own timestamp (equal, differs, or inconclusive). |
| `browser-check.mjs` | Opens the socket from a page in headless Chromium and reports the handshake and the close. |
| `findings.md` | The write-up. |

## Where the wire facts come from

The keepalive text (`Gameday5`, every 10 s) and the close codes (4200 final, 4400 not available) come
from a community Go client (`mlblive`, `cmd/websocket.go`), not from MLB. MLB documents none of this.
The terms allow "individual, non-commercial, non-bulk use": run one capture per game. This spike ran up to seven
sockets at once (variants, plus two games) and the server answered "Service overloaded"; do not repeat that.
