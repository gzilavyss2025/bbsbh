# OVR step 1: calibration against posted video-game ratings

Issue #1714. Tracking issue #1685. Spec: `docs/ovr-rating.md`, "Build order", step 1.
Date checked: 2026-10-07.

## Result

**No lawful source was found. No ratings were fetched or fitted.** Parts (a), (b) and (c)
were not run. The fallback applies: step 2 (#1715) uses the spec's own start weights,
curve and stretch factors. This note does not block step 2.

No fitted weights, curve, mean, spread, stretch verdict or POT check exist. Any such
number would have to come from data this check did not obtain.

## Sources checked (three, the time box)

| Source | What was read | Verdict |
|---|---|---|
| ShowZone player database, `https://showzone-payload.onrender.com/players` (operator: SHOWZONE LLC, per the footer of `/privacy-policy`) | Listing page, `/privacy-policy`, `/robots.txt`, and two guessed paths, `/terms` and `/terms-of-service` (both 404) | **Not usable.** See below. |
| showdd.io | Home page only | **Not usable.** The server answered HTTP 403 Forbidden. Terms not readable. Not worked around. |
| theshowutil, `https://pypi.python.org/project/theshowutil/` | PyPI page | **Not usable.** PyPI showed a "Client Challenge" page, which is anti-bot protection. Not worked around. A web search found no other page for the project. |

### Why ShowZone is not usable

- **No terms of use found.** The listing page links no terms page. The footer links are
  Mobile App, Browser Extension, Discord, Pro, Contact, Report an Issue and Privacy
  Policy. The privacy policy says nothing on scraping, automated access or data reuse.
  The footer reads "All Rights Reserved ©2026".
- **No permission is not permission.** **Inference:** with all rights reserved and no
  licence or terms that allow automated use, automated bulk use is not shown to be lawful.
  This is not a legal opinion.
- **robots.txt disallows `/api`** for every crawler. **Inference:** the site is a
  Payload CMS app (the host name says "payload"), so its data API lives under `/api`.
  That path is the only clean way to read all rows, and the site asks crawlers not to
  use it. Scraping the HTML table page by page would work around that request.
- **The data would not fit the job anyway.**
  - The listing shows Overall and "True Overall", position, team and rarity. No attribute
    columns (Contact, Power, Speed) were visible on the page. Part (a) needs attributes.
  - The listing is Diamond Dynasty cards. **Inference:** it mixes live-series cards with
    boosted collectible cards, so it is not a clean read of the base roster ratings.
  - The page text shows no MLB `personId`. Part (b) needs a join, so it would rely on
    name matching.

### Disclosure

I opened the `/players` listing once, with a single page read, to find the terms links.
That came before I had read any terms. I kept no player data from it. Nothing from it is
in the repo.

## What the spec's reports still support (not new findings)

The spec cites NBC Sports Bay Area and The Comeback for "formula-driven". That stays an
inference from those reports. This check could not test it.

## Options for Gary (his decision, not taken here)

1. **Accept the fallback.** Ship step 2 on the spec's start weights. Revisit after step 4,
   when prior seasons give a longer sample for a stats-only check (for example against
   WAR, which `calibrate.mjs` already compares).
2. **Ask the operator.** Email ShowZone (Contact link on the site) and ask in writing for
   permission to read the player database for a one-time calibration. Nothing is fetched
   until a reply allows it.
3. **Hand-read a few cards.** Reading a handful of cards by eye is not automated use, but
   it gives too few points to fit weights. It could only sanity-check the mean and spread.
