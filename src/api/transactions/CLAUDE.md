# src/api/transactions — the transactions pipeline

`docs/transactions-wire.md` is the dictionary of the wire. The pipeline sits in six files
along five seams:

- `transactions/vocabulary.js` answers *is this row news, and whose?*
- `teamTransactions.js` decides which rows belong in one story.
- `transactions/cutline.js` turns a story into words.
- `transactions/league.js` runs the whole thing once per OWNING club over the entire
  league, for the home feed.
- `transactions/leagueFeed.js` is the LIVE reader beside the build-time-fetch pattern: the
  home slate's rolling roster wire reads on page load, because a feed claiming "the last
  three days" fed from a nightly file is up to a day behind.
- `transactions/clubFeed.js` is the sixth (§13 of the wire doc). The club card reads the
  nightly file for the season and lays a live three-day window over its newest days, so a
  move filed at noon reaches the club's own page as fast as it reaches the wire.

Rules:

- **The window is three days and NOT two.** Two means today and yesterday, which is 48
  hours only late in the evening (`WINDOW_DAYS`; `FETCH_DAYS` is backtested against it —
  read the header before moving either).
- **A league-wide feed is never a merge of the thirty per-club files.** §11 of the wire
  doc has the measurements, §12 what the live read costs.
- **Two traps in the live read.** The fetch is WIDER than the window it shows (the
  endpoint filters on a row's filed date, the grouper buckets by its effective one —
  ADR-0058), and the `/people` prefilter is safe only because `leagueCandidateIds` is a
  superset of the final rows.
- **`clubFeed.js` re-runs the club pipeline rather than filtering the league feed.** That
  feed gives a trade ONE owner, so filtered to one club a deal the club sold in would vanish
  from its own page. It is safe to merge because the grouping is a function of its rows alone
  (`groupIntoStories` orders a day by row id first) and because the join is by DAY, never
  by story.
