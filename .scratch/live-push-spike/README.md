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
node capture.mjs --gamePk=849805           # live: socket, push-triggered diffPatch, summary
node browser-check.mjs --gamePk=849805     # does a browser (with an Origin header) get in?
```

`capture.mjs` can start hours before first pitch. A scheduled game's socket stays open and silent.
Stop it with Ctrl-C: it writes `out/<gamePk>-<start>/summary.json` and an `events.jsonl` log first.
`out/` is git-ignored.

Options for `capture.mjs`: `--maxMinutes=480`, `--minGapMs=1500` (fewest ms between two diff
fetches; pushes inside it coalesce), `--verifyEvery=10` (compare every 10th merge with the snapshot MLB
serves for the same timecode), `--noDiff` (socket only), `--out=<dir>`.

## Files

| File | What it does |
| --- | --- |
| `shape.mjs` | Turns a message into its shape. The one value it lets through is a timecode. |
| `patch.mjs` | Immutable RFC 6902 applier. Always returns a new root object (ADR-0007). |
| `selftest.mjs` | Offline checks: no value leaks through `shape`, and real patches merge to the served snapshot. |
| `capture.mjs` | The live capture. |
| `browser-check.mjs` | Opens the socket from a page in headless Chromium and reports the handshake and the close. |
| `findings.md` | The write-up. |

## Where the wire facts come from

The keepalive text (`Gameday5`, every 10 s) and the close codes (4200 final, 4400 not available) come
from a community Go client (`mlblive`, `cmd/websocket.go`), not from MLB. MLB documents none of this.
The terms allow "individual, non-commercial, non-bulk use": run one capture per game, no more.
