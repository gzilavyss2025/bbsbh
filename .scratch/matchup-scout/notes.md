# Matchup Scout: the measurement trail (issue #1408)

Working notes for the scoping of the pitcher-versus-hitter page. The design is in
#1408. Phase 1 is #1410. Phase 2 is #1411. This folder holds the probes behind
the numbers in those three issues, so the next agent does not rewrite them.

All numbers are from **2026-10-02**. Savant is unofficial and renames columns
without notice (`scripts/lib/savant.mjs`, header). Run a probe again before you
trust an old number.

## Run them

Python 3.11 and `curl`. No packages. Run from this folder:

```
cd .scratch/matchup-scout
python3 probe_frame.py
```

The probes are Python because they were throw-away research. If you need one
inside the app or a generator, rewrite it in Node. Generators reach statsapi only
through `scripts/lib/statsapi.mjs` (`scripts/CLAUDE.md`).

Two probes pull a lot of data: `probe_samples.py` pulls 18 player-seasons (33 MB),
and `probe_diag.py` pulls one 17 MB request on purpose, to show the row cap.
Expect minutes.

## The probes

| File | Question | Answer |
| --- | --- | --- |
| `h.py` | Shared helpers: `curl`, `jget`, `savant`. | Header comment lists the Savant traps. |
| `probe_frame.py` | Do the feed's pitch location, strike zone and pitch type agree with Savant, in 2025 and 2026? | 2025: `pX`/`pZ` match `plate_x`/`plate_z` to 0.001 ft. 2026: `pZ` runs about 0.08 ft higher in the feed. `strikeZoneTop`/`Bottom` still match. Pitch types: 1,882 of 1,882 agree. |
| `probe_h2h.py` | Does Savant's head-to-head match statsapi `vsPlayer`, with postseason? | Judge vs Verlander: 41 plate appearances in both (25 regular season, 16 league championship series). `vsPlayer` has an extra split with no `season`. It is the career total, so a sum over every split counts twice (82). |
| `probe_codes.py` | Do the game-type codes work (F, D, L, W, PO, S, E, A)? Does Savant reach the minors? | Each code returns only its own games. `PO\|` returns every postseason code. `minors=true&hfLevel=AAA\|` returns Triple-A (4,198 rows on 2025-06-14). |
| `probe_diag.py` | Why does Savant sometimes have more rows than the feed has pitches? Is `minors=true` Triple-A? Is the 25,000-row cap real? | The extras are `automatic_ball` and `automatic_strike` pitch-clock rows with no location. Yes, Triple-A (14 of 14 games are in the Triple-A schedule). The cap is real and silent: exactly 25,000 rows, the newest ones. |
| `probe_volume.py` | What does a nightly one-day Savant pull cost? Is it complete? Do the columns hold? | 2026-09-20: 4,265 rows, 2.93 MB, 9.3 s, 15 of 15 games. All 119 columns identical on three sample days (2024, 2025, 2026). |
| `probe_samples.py` | How many cells can a hitter's map fill? Does the zone height change in 2026? | 10 hitters, 2025, Savant `zone` layouts. See #1408 for the table. 2026 has one `sz_top` per batter (Judge: 3.523 ft, 1 distinct value; 2025: 336 distinct values). |
| `probe_regions.py` | The same, for the plan's layout (inner 3x3, plus high, low, first-base side, third-base side)? | Hands pooled: 84.9% of pitches above the whiff floor, 72.1% above the xwOBA floor. By pitcher hand: 68.7% and 47.8%. The layout and Savant's `zone` agree on in-zone for only 91.2% of 26,938 pitches. |
| `probe_xwoba.py` | Can the feed compute xwOBA? | Not exactly. A lookup on exit velocity and launch angle: leave-one-out error 0.010 (1 mph x 1 degree bins, 52% of balls covered) or 0.047 (2 mph x 4 degrees, 91%). 20 of 123 repeated exact keys had more than one estimate. Feed and Savant exit velocity and launch angle are identical. Lindor 2025: left-handed against right-handers, right-handed against left-handers, no exceptions. |
| `probe_ev.py` | How often does the feed carry exit velocity on a ball in play? | 692 of 694 over 14 games, the same as Savant. |
| `probe_leaderboard.py` | Does Savant's `pitch-arsenal-stats` leaderboard include the postseason? | **Regular season only.** Guerrero Jr. 2025 four-seam: board 679, regular season 679, with postseason 768. Same for Judge and Bichette. |

## Wrong turns worth knowing

1. **"The feed has exit velocity on 54 of 106 balls."** False. Savant also carries
   exit velocity on other tracked pitches (fouls), so the 106 was not balls in
   play. On balls in play the two sources match. `probe_ev.py` is the clean check,
   and `probe_xwoba.py` now filters to `hit_into_play`.
2. **Summing every `vsPlayer` split.** The split with no `season` is the career
   total. A sum doubles every plate appearance.
3. **Comparing the leaderboard's `pa` with statsapi PA** to test for the
   postseason. Inconclusive: the board's PA runs below the regular-season PA for
   every hitter, even ones with no postseason (Judge 641 against 679).
   Intentional walks and similar plate appearances explain part of it. Compare
   pitches per type instead (`probe_leaderboard.py`).
4. **The first sample-size table used Savant's `zone` column**, not the plan's
   layout. `probe_regions.py` measures the plan's layout. The plan's layout does a
   little better.

## Not covered here

- MLB's terms for bulk use. See #1408.
- Savant's same-day lag. No games were scheduled on 2026-10-02, so it was not
  re-measured. The page never asks for today.
- Triple-A postseason game types.
