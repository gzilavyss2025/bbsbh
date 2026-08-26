# A contract row with no confident MLB id stays unresolved — never a guess

Four historical Excel exports (arbitration 2018–26, extensions 2000–26, free
agency 1991–2026, salaries 2000–26) identify players only by `"Last, First"`
text plus a club code and a year — no MLB id, the key every other panel in
the research layer (`public/data/war.json`, etc.) and the money pages
(`/salaries`, a club's Contracts tab, ADR-0052) already use. Fever's Cot's
feed solves this for current/future contracts by reconciling names to ids
itself; nothing does it for history, so `scripts/gen-contracts-identity.mjs`
resolves it here, against `scripts/gen-contracts-season-players.mjs`'s cache
of every player who actually appeared in MLB each season (1991–2026).

## The rule

A row resolves to exactly one of four confidence tiers, and only two of them
carry an `mlbId` a consumer should trust without a human looking at it:

- **`exact`** — the row's name, normalized, matches exactly one candidate in
  that row's team-season roster (or the full season pool for `salaries.csv`,
  which carries no team column at all).
- **`fuzzy`** — resolved through a deterministic, well-understood
  transformation, not a probabilistic guess: a generational suffix present on
  one side only (`"Acuna, Ronald"` vs. statsapi's `"Acuña Jr., Ronald"`), a
  common nickname/given-name pair (`"Boyd, Matt"`/`"Boyd, Matthew"`,
  `"Hernández, Kiké"`/`"Hernández, Enrique"` — confirmed in both directions
  against real rows, not assumed), a name/position/service-time-scored
  tiebreak among same-name teammates, or a cross-reference to the same
  normalized name resolved unambiguously elsewhere in the dataset.
- **`ambiguous`** — two or more plausible candidates with no clear winner.
  `mlbId` is `null`; the shortlist survives in `candidates` for review.
- **`unresolved`** — nothing in the searched pool is a plausible name at all.
  `mlbId` is `null`.

**No row is ever silently assigned the "closest" name below a real
confidence bar.** `ambiguous` and `unresolved` are not failure states to
hide — they are the intended output for a source this old and this
name-only, and they are exactly what PR2's `/admin/contracts` review page
queues up for a human to search, confirm, or correct.

## Why the unresolved tail is accepted, not chased to zero

Verified against the real data, not assumed: the tail is dominated by two
genuine, structural gaps a name-matching pipeline cannot close on its own —

- **A player who never appeared in an MLB game that season.** The candidate
  pool is built from statsapi's `sports/1/players?season=YYYY`, which lists
  who *played*, not who was *signed*. A prospect extended before debut
  (Jackson Chourio, signed 2023, debuted 2024) has zero candidates in his
  signing season; a small season-window retry (±2 years) recovers most of
  these, but a free agent who signed and then retired without playing, or a
  minor-leaguer decades removed from any MLB appearance, has no season in
  which he would ever appear.
- **A one-off spreadsheet quirk with no generalizable fix**, caught and
  fixed at the source instead of worked around at match time where one
  existed: `free_agency.csv` had 45 inline section-divider rows
  (`"International"`, `"Retired"`, `"Remaining Free Agents"`) mixed into the
  real player rows by the original export — removed from
  `scripts/data/contracts/free_agency.csv` directly, not filtered downstream.

After fixing every *systematic* pattern found this way (the divider rows,
the suffix and nickname gaps, the pre-debut retry window, and a
cross-reference pass so a name resolved confidently in one file can fill an
otherwise-unresolved row for the same person elsewhere), the four files
land at 97–99% resolved. The remaining 1–3% is real signal about the
data's age and completeness, not a bug to keep patching — flagged in the
generator's own match-rate report, never buried.

## `season` vs. the roster-lookup season are two different fields

Arbitration and free-agency rows carry a year that is NOT the season whose
roster should be searched — a 2026 arbitration case is decided on the
player's 2025 roster; a free agent signing in 2026 last played for their old
club in 2025. The generator keeps these as two separate fields
(`season`: what a consumer should display; the internal lookup uses a
different season) precisely so the roster-lookup mechanics never leak into
and corrupt the contract year a reader actually sees.
