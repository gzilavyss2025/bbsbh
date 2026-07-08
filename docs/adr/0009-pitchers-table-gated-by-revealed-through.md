# The Pitchers table is gated by revealedThrough directly, not wrapped in a SealBox

A pitcher's running line (IP/R/ER/H…) is score-revealing, but wrapping it in
a `SealBox` the way half-inning scores are would force an all-or-nothing
reveal of a pitcher's entire outing — including a still-active pitcher's
runs from innings the user hasn't reached yet. Instead `computePitcherLines`
(`src/api/pitchers.js`) accumulates stats only from plays at or below the
same `revealedThrough` high-water mark that gates the seals, attributing
runs/earned-runs via each play's `responsiblePitcher` so inherited runners
are charged correctly. A pitcher whose whole outing is already revealed gets
his exact boxscore line; a still-active pitcher mid-outing gets a partial
line computed from revealed plays only. Re-reading the boxscore directly for
a pitcher whose outing isn't fully revealed, or gating this table on inning
navigation instead of `revealedThrough`, would each leak the current inning.
