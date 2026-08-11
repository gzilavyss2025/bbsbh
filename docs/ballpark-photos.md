# Ballpark photos

One photograph per MLB park, in `public/ballparks/{venueKey}.jpg`, rendered by
the team hub's Ballpark card (`src/screens/team/modules/ballpark/BallparkCard.jsx`). The
credit table that goes with them is `CREDITS` in
`src/lib/ballpark/ballparkArt.js`.

## The licence rule, which is not optional

Every bundled photo is **public domain, CC0, CC BY, or CC BY-SA** — sourced from
Wikimedia Commons, downloaded once, and served from our own origin. No fair-use
art, no hotlinking, no runtime dependency on a third-party host. That matches
how `ballparkData.js` already treats park facts: static reference data baked
into the repo.

CC BY and CC BY-SA **require visible attribution**. There is no caption under the
photo any more: `BallparkCard` wraps a bundled photo in a link to its Commons
file page, where the author and licence live, and carries `creditLine()` in the
image's `title` and `alt`. That is the alternative the licence itself sanctions
("a URI or hyperlink to a resource that includes the required information"), and
it is the one that works on a phone, where a tooltip shows nothing. The link is a
licence obligation, not decoration — do not drop it, and do not drop the
`CREDITS` entry when you swap a photo. `creditLine()` names the
photographer for every image and adds the licence for the ones that require it;
public-domain and CC0 photos owe no credit, but naming the photographer anyway
costs one line and is the decent thing to do.

`test/copy-registry.test.js` fails if any park in `BALLPARKS` lacks a credited
photo, or if `creditLine()` stops naming a licence that requires naming.

## Adding or replacing a photo

Two routes, and the everyday one is the first.

**From the card.** Signed in as the site owner, press the gear in the Ballpark
masthead on `/team/{id}`, choose a photo, tap the picture to set which part of it
survives the widescreen crop, type a credit, and Save. The browser resizes and
re-compresses before uploading, so a photo straight off a phone is fine. It is
live in seconds with no deploy, and it does **not** touch the repo — the bundled
photo below stays exactly where it is as the shipped default. ADR-0044 has the
mechanism, and the credit rule still applies: your photo does not inherit the
bundled Commons attribution, so name your own photographer and licence.

**Bundling one in the repo** is the route below. It needs a deploy, and it is how
the shipped default for all 30 parks got here.

1. Find a freely-licensed image on Wikimedia Commons. Confirm the licence on the
   file page — "it is on Wikipedia" is not a licence. Many ballpark images on
   **en.wikipedia** (as opposed to Commons) are non-free logos or fair-use
   uploads that do not travel to a third-party site.
2. Download it at 1000px wide. Commons resizes on request:

   ```
   https://commons.wikimedia.org/w/index.php?title=Special:FilePath/<FILE_NAME>&width=1000
   ```

   1000px is sized for the card's 60%-width hero slot at 2× pixel density.
   Commons rate-limits bulk downloads — throttle and retry on HTTP 429.
3. Save it as `public/ballparks/{venueKey}.jpg`, where `venueKey` is
   `venueKey(park.name)` from `ballparkArt.js` — the park's **canonical** name,
   not the raw feed venue string. Aliases (Minute Maid/Daikin, Guaranteed
   Rate/Rate) share one record, so they share one photo.
4. Add or update the `CREDITS` entry in the same commit: `artist`, `license`,
   and the `source` file-page URL.

Aspect ratio does not need to match anything. The card crops to 16:9 with
`object-fit: cover` (`src/styles/57-ballpark-card.css`), so a 4:3 phone snap and
a wide aerial both land in the same silhouette without re-encoding.

## Ballpark logos — the empty slot, and why

`LOGO_KEYS` in `ballparkArt.js` is empty on purpose, and the card falls back to
the park's name typeset in the display face.

A ballpark's own wordmark is a sponsor's registered trademark. The copies
circulating on Wikipedia are uploaded under fair-use rationales that apply to an
encyclopedia article about that park and do **not** extend to a third-party
site, so none are bundled here. Coverage would also be patchy — many parks have
no distinct mark separate from the club's — which would make the card look
inconsistent from team to team.

The slot is real and wired up, and there are now two ways into it for a park you
have the rights to. The trademark caution above applies to both equally — the
licence question does not care which door the image came through.

**From the card, in seconds (the usual way).** Open `/team/{id}` signed in as the
site owner, press the gear in the Ballpark masthead, and choose a PNG under "Name
as an image". It is resized in the browser, stored in Vercel Blob, and saved into
the `ballpark.{venueKey}Wordmark` copy field. No deploy — see ADR-0044.

**Bundled in the repo (the shipped default).** Drop the file at
`public/ballparks/logos/{venueKey}.svg` (or `.png`) and add the key to
`LOGO_KEYS` with its extension: `{ fenwaypark: 'svg' }`. This needs a deploy.

An override beats a bundled key, the same precedence every other copy field
follows. Either way the card swaps the typeset name for the mark, and a park with
neither keeps its name as text. `.ballparkcard__logo` caps the height so a tall
mark cannot out-scale the photo beside it.

## Ballpark notes

The prose paragraph between the built/roof/capacity facts and the outfield
dimensions is **not** in this repo — it is admin-editable copy, one field per
park, edited at `/admin` and stored in the copy store. Every note ships empty,
and the card renders no paragraph until one is written. See
[ADR-0025](adr/0025-admin-editable-copy-store.md) and its 2026-08-07 amendment.

The note is the one park field the card's gear does **not** edit — it is a
paragraph, and a paragraph wants the room `/admin` gives it. Everything else
about a park (its name, its wordmark, its photo, the credit and the crop) is
edited on the card itself; see [ADR-0044](adr/0044-content-is-edited-where-it-is-rendered.md).
