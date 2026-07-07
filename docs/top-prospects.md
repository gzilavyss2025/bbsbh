# Top prospects: snapshotting MLB Pipeline's Top 100

The player page can show a prospect's minor-league level progression, but
nothing in the public MLB Stats API says how a player ranks nationally.
MLB Pipeline's actual Top 100 Prospects list turns out to be freely
available anyway — embedded directly in the server-rendered HTML of
`https://www.mlb.com/prospects/stats/top-prospects`. This documents how
`scripts/fetch-top-prospects.mjs` pulls it into
`public/data/top-prospects.json`, and why it's a **scheduled, off-device
script**, not app code.

**Why not in the app:** the PWA is backend-free — every request runs in the
user's browser. `statsapi.mlb.com` (the API the rest of the app uses) sends
`Access-Control-Allow-Origin: *`, which is what makes that possible.
`www.mlb.com` sends **no CORS headers at all** (verified live with `curl`
using an `Origin` header and an `OPTIONS` preflight) — a browser `fetch()`
from the deployed app's own origin would be silently blocked, even though a
plain server-side `fetch()` (no browser, no CORS enforcement) reads it fine.
So the scrape has to happen outside the browser, and the app reads whatever
it produced as an ordinary same-origin static file.

## Running it

```bash
node scripts/fetch-top-prospects.mjs
```

No flags. Writes `public/data/top-prospects.json`. In production this runs
weekly via `.github/workflows/update-top-prospects.yml` (Monday mornings
ET), which commits the refreshed file straight to `main` — that push rides
the existing Vercel auto-deploy, no separate publish step.

## The pipeline

1. Fetch the page (plain `fetch()`, no auth, no special headers required —
   though a descriptive `User-Agent` is sent as cheap insurance).
2. The page embeds the ranked list as a literal `var data = [...]` JS array
   inside an inline `<script>` tag — not a JSON API, no GraphQL, nothing
   documented. Extracted via `/var data = (\[.*?\]);/s` + `JSON.parse`.
3. **Validate before writing anything**: the array must have at least 50
   entries, every entry needs a numeric `rank`/`playerId`, and — critically
   — ranks must be *nearly unique* (see the gotcha below). Any failure
   `console.error`s and exits non-zero **without touching the existing
   output file**. A broken scrape fails the GitHub Actions run (which emails
   on scheduled-workflow failure) but never regresses the live snapshot.
4. Each raw entry is slimmed to `{ rank, playerId, name, teamId, team,
   position, levelRaw, statLine, age }` — the full embedded stat blob
   (dozens of counting/rate stats) is dropped, since the app already
   re-fetches live stats via statsapi for any player it renders. `statLine`
   (`".301 AVG"` / `"3.12 ERA"`) is precomputed here so the app never needs
   to know the raw batting/pitching stat shape.

## Why `playerId`/`teamId` just work

Both fields are the exact same ids this app's own MLB Stats API calls use —
verified live (Jesús Made: `playerId: 815908`, `teamId: 158` = Brewers).
No name-matching needed to join this snapshot to the app's own player/team
pages.

## Gotchas / flagged uncertainties (re-check if this starts producing garbage)

- **The URL must be bare — no query string.** The obvious URL to try is
  `?type=all&minPA=1` (it's what the page's own nav links to for the "stats"
  view), but that serves a **completely different dataset**: the "All 900
  Prospects" leaderboard, where `rank` means each prospect's rank *within
  his own team's system* (so it only ever spans roughly 1–30, heavily
  duplicated) rather than an overall ranking. The bare URL
  (`/prospects/stats/top-prospects`, no query params) reliably returns the
  real Top 100 — sequential, nearly-unique ranks 1–100. Verified stable
  across repeated requests. This was discovered the hard way: an earlier
  version of this script used the query-string URL and silently wrote the
  wrong list (862 "prospects" with rank capped at 30) before the
  rank-uniqueness validation was added — hence that check now being a hard
  gate, not a nice-to-have.
- **Batters and pitchers are interleaved in one ranked list** — don't assume
  every entry has `battingStats`; check for `pitchingStats` too.
- **A handful of players appear as two raw entries at the same rank** — one
  with their real stat line, one a degenerate placeholder (observed: a
  pitcher's stray `.000 AVG` batting line, likely a token plate appearance).
  The script dedupes by `playerId`, preferring whichever entry's stat
  category matches the player's position — verify this heuristic still holds
  if the count of duplicates ever grows.
- **Ranks aren't perfectly unique** — a real tie or two is normal (verified:
  96 unique ranks across 97 entries). Don't "fix" this by renumbering.
- The response is slightly under 100 rows (typically ~97) because the page
  filters to players with at least 1 plate appearance/batter faced this
  season — a handful of Top 100 prospects can have zero MiLB games logged
  yet (injury, very late signing, etc.) and simply don't appear.
- This is **undocumented editorial page structure**, not the documented
  statsapi the rest of this app relies on. It is expected to eventually
  break silently (a redesign, a renamed JS variable, a schema change) — the
  whole design assumes that and degrades to "hide the feature," never
  breaks a page. If the script starts failing validation, that's the first
  thing to check by hand: refetch the URL and grep for `var data =`.
