# ADR-0044 — Content is edited where it is rendered, and images live in a blob store

Status: accepted (2026-08-11)

## Context

ADR-0025 gave the site owner a copy store: a closed registry of editable
strings, one Redis hash behind `api/copy.js`, and `/admin` to type into. Its
amendment extended that to the ballparks — a note per park, and three fields
that replace the card's art without a deploy. Everything about that decision
still holds. This ADR is about two things it did not answer.

**The first is WHERE you edit.** `/admin` is one unlinked page holding every
editable string in the app, which for 30 parks × 6 fields is 180 inputs in a
list. Editing a park there means finding its heading, changing a value, saving,
navigating to `/team/{id}`, and looking. The loop is slow, and worse, it is
BLIND: the fields that most need judgement — which part of a photograph survives
the widescreen crop, whether a name reads right at the size it is printed — are
questions you can only answer while looking at the card. A focal point typed as
"50 20" into a form on another page is a guess you verify by leaving the form.

**The second is IMAGES.** The photo field holds a URL, and the app has never had
anywhere to put an image, so that URL has to point at somebody else's host. Two
costs, and the smaller one is the chore. The larger is that the app renders
`<img src>` at a domain nobody here controls, on a page it serves — for a repo
whose bundled photos are deliberately self-hosted, licence-checked, and free of
runtime hotlinking (see `ballparkArt.js`), that is a real inconsistency.

The obvious answer to the second was the nightly job. `scripts/compress-logos
.mjs` already compresses uploaded images, and the Identity Lab already accepts
uploads. Both are the wrong shape here, for the same underlying reason: they
work on FILES IN THE REPO. The Identity Lab's upload is Vite dev middleware that
does not exist in a deployed app, and the nightly job's output is a commit —
which triggers a Vercel deploy, the exact thing the copy store exists to avoid.
Reusing them would have traded a no-deploy feature for a deploy-per-photo one,
and made "the picture I just chose" a thing you see tomorrow.

## Decision

**Editing happens on the page that renders the content.** The Ballpark card
carries a gear in its masthead for the site owner, and turns into a form for its
own six copy fields. Save and Cancel sit in the masthead beside the gear.

**Nothing about the mechanism changes.** The gear writes through `POST
/api/copy`, the same closed registry, the same `sanitizeOverrides` choke point,
the same version history, the same 60-second CDN cache. A save is a Redis field.
It is not a deploy, and `/admin` remains the full-inventory view of the exact
same data.

**Two new registry fields per park** — `…Name` (text) and `…Wordmark` (an image
URL) — so the name printed on the card can be overridden by either. They are
independent: setting one does not require setting the other.

**Images get a home: Vercel Blob**, written by `api/ballpark-photo.js`, gated by
the same Clerk-token-plus-`COPY_ADMIN_USER_IDS` allowlist as every admin write
(now shared in `api/_lib/adminAuth.js` rather than copied). It is the eighth
narrow backend exception and the first that accepts bytes.

**Compression happens in the browser, before upload.** `src/lib/admin/
compressImage.js` resizes and re-encodes on a canvas; the endpoint's byte cap
then becomes a limit that cannot be crossed by accident rather than one that is
discovered. The nightly job is untouched and stays repo-only.

## Consequences

**Uploading is not saving, and that is load-bearing.** The endpoint stores an
object and returns a URL. It does not touch the copy store — the URL only
becomes the park's photo when the client subsequently POSTs it through
`/api/copy` like any other override. So Cancel is a true cancel, and the copy
store keeps exactly one writer and one validation choke point.

**A partial save must re-read and merge.** `POST /api/copy` takes the FULL
override map and deletes every key the body omits — correct for a panel holding
every field, catastrophic for an editor holding six. `mergeOverrides`
(`src/lib/admin/saveCopyPatch.js`) is the only thing between those outcomes, and
it fails silently in the direction that looks fine: the app would keep rendering
shipped defaults and nothing would appear broken. It is tested accordingly.

**Every upload gets a new URL.** Overwriting a stable pathname would leave the
old bytes in the CDN and in every browser that had the page, so a replaced photo
would show the previous one for as long as the cache held — indistinguishable
from a failed save. The superseded object is deleted after the new one lands,
and only ever if its host is our own store.

**Nothing reaches a visitor.** Both editor modules are lazy, so their JS and
`61-ballpark-admin.css` are separate chunks that a normal page load never
fetches. The role check that draws the gear is convenience only; the boundary is
the server allowlist, and a forged role gets a gear that produces 403s.

**The spoiler rule is untouched.** A ballpark is a building, the team hub's
Overview is deliberately outside the scoring flow, and every value here is typed
or chosen by hand about a subject that has no score — the same standing the copy
registry's SPOILER GUARD already grants these fields. No score-bearing surface
gains an editor, and this ADR is not a licence to put one there.

**The trademark caution survives.** `LOGO_KEYS` is empty because a park's
wordmark is usually a sponsor's registered trademark. The upload route does not
change that; it only makes the slot reachable in seconds instead of a deploy.
What goes in it is the owner's call and the owner's licence to hold.
