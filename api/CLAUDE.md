# api — the Vercel functions

**Fifteen Vercel functions live in `api/`**, each inert when unconfigured;
**fourteen never render or fetch a score.** Root `CLAUDE.md` keeps the count and the
three phrases `scripts/check-claude-md-facts.mjs` checks, so change both together.

- `preview.js` + `_lib/cards.js` — link previews. They render Open Graph cards, failing
  safe to the default (ADR-0012).
- `reveal.js` — reveal sync (Clerk-gated). It mirrors `revealedThrough` through Upstash
  Redis, ratcheted on both sides (ADR-0022).
- `spoiled-days.js` — mirrors which days the user consented to spoil: consent, reversible
  (ADR-0026).
- `copy.js` + `src/copy/` — editable wording, and, since ADR-0063, the player page's award
  weight order, behind a cached read and an allowlisted write. It is edited at `/admin` or
  on the page that renders it (the Ballpark gear, whose `ballpark-photo.js` puts images in
  Vercel Blob, ADR-0025/0044).
- `identity.js` + `src/lib/identity/` — overlay a club's identity under the pure
  resolvers, gated twice on WCAG AA. `identity-logo.js` takes a mark's bytes the same way,
  feeding the overlay's `logo` URLs (ADR-0050, `docs/identity-overrides.md`).
- `contract-identity.js` — mirrors one-off id corrections for the historical-contract
  crosswalk (ADR-0066).
- `preferences.js` + `src/lib/account/` — My Tally. They mirror a closed four-field set,
  last-write-wins. `account.js` erases every per-user key (ADR-0039).
- `books.js` — mirrors the Game Log's shelf: a cover's title, club and mark, never a stamp
  (ADR-0041).
- `headshot-report.js` — TEMPORARY (issue #1446). Logs a sanitized "?" headshot report to Vercel's runtime
  logs; stores nothing. Delete it with `src/lib/headshot/` once the cause is found.
- `game-story.js` — a CORS hop to MLB.com's team RSS feeds, which send none.
- `page.js` + `src/copy/landing/` — server-render `/learn` for AI crawlers, which run no JS
  (ADR-0053).
- **The fifteenth stores a score, by design**: the Game Log's stamps (`stamps.js`,
  `src/lib/stamps.js`). That is safe because of WHERE stamp art may render
  (`check-stamp-surfaces`), not a mint-time check (ADR-0035). Voice: `docs/game-log.md`.
