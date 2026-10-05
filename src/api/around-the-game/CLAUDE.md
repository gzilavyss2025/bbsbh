# src/api/around-the-game — the Around the game readers

`around-the-game/` is the fourth subdirectory and the odd one out: it holds no
new fetching and no new spoiler footing, only the spoiler-FREE readers behind
the pages listed under **Around the game**
(`src/screens/around-the-game/`) — one a page, except `/abs-challenges`, whose
denominators are a second file and so a second reader (`absExposure.js`,
ADR-0076). It is named for the group a reader sees rather
than for what it is made of, and that is deliberate: it was called `reports/`
first, which collided with `reportPages.js` / `ReportFooter.jsx` /
`check-report-pages.mjs` — all of which predate it and mean EVERY standalone
page, Standings and League Leaders included. One word, two scopes, in one
codebase. The label moved for the same reason (see `lib/reportPages.js`), and
the paths followed it. Two of them read files
their own generators ship (`gate.js`, `farmSystem.js`); one re-runs an existing
module's rules across the whole league (`bullpen.js` over `workload.js`); one is
the club-name join all three share (`clubs.js`). The rule that directory adds is
about WHERE THE MATH LIVES: the generators ship FACTS, and every ranking, rate,
league comparison and weighted index is computed here, where it is pure,
unit-tested and arguable. `docs/farm-index.md` argues the one that needs it.
