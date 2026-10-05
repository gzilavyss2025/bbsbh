# api — the Vercel functions

The serverless functions in `api/`. Root `CLAUDE.md` keeps the count and the three phrases `scripts/check-claude-md-facts.mjs` checks.

**Fourteen Vercel functions live in `api/`**, each inert when unconfigured;
**thirteen never render or fetch a score.** Link previews (`preview.js` + `_lib/cards.js`)
render Open Graph cards, failing safe to the default (ADR-0012). Reveal sync (Clerk-gated) mirrors
`revealedThrough` via `reveal.js` + Upstash Redis, ratcheted both sides (ADR-0022);
`spoiled-days.js` mirrors which DAYS the user consented to spoil — consent, reversible (ADR-0026).
`copy.js` + `src/copy/` store editable wording — and, since ADR-0063, the player page's award
weight order — behind a cached read and an allowlisted write, edited at `/admin` or ON the page that
renders it (the Ballpark gear, whose `ballpark-photo.js` puts images in Vercel Blob, ADR-0025/0044). `identity.js` + `src/lib/identity/` overlay a CLUB's
identity under the pure resolvers, gated twice on WCAG AA; `identity-logo.js` takes a mark's
BYTES the same way, feeding the overlay's `logo` URLs (ADR-0050, `docs/identity-overrides.md`).
`contract-identity.js` mirrors one-off id corrections for the historical-contract crosswalk (ADR-0066). **My Tally**'s `preferences.js` + `src/lib/account/` mirror a CLOSED four-field set, last-write-wins;
`account.js` erases every per-user key (ADR-0039). The Game Log's `books.js` mirrors the shelf — a
cover's title, club and mark, never a stamp (ADR-0041). `game-story.js` is a CORS hop to MLB.com's
team RSS feeds, which send none. `page.js` + `src/copy/landing/` server-render `/learn` for AI
crawlers, which run no JS (ADR-0053). **The fourteenth stores a score, by design**: the Game Log's
stamps (`stamps.js`, `src/lib/stamps.js`) — safe because of WHERE stamp art may render
(`check-stamp-surfaces`), not a mint-time check (ADR-0035). Voice: `docs/game-log.md`.
