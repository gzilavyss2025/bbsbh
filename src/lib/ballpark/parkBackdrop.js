// The ballpark that washes in behind a slate card's '@' on hover — which
// photograph, how it is cropped, and who took it.
//
// Pure, and deliberately thin: it resolves nothing of its own. The photo comes
// out of the SAME resolvePhoto the team hub's Ballpark card uses, so a park the
// owner re-shot from that card's gear (a Vercel Blob upload written into the
// copy store, ADR-0044) shows up here with no second upload and no code change,
// cropped to the focal point they picked there. One park, one picture.
//
// DEGRADING IS THE NORMAL CASE, not an error path. Three of them, all silent:
//
//   - an MiLB park (every one of them today) has no BALLPARKS record, so the
//     key falls back to the raw feed venue name — which matches no bundled
//     photo and no registry field, and the card renders no backdrop at all.
//     Nothing here has to learn about levels: the day a minor-league park gains
//     a photo, by either route, this starts working for it on its own.
//   - a one-off neutral site (Field of Dreams, the Little League Classic, a
//     London or Tokyo series) is a real venue name with no art behind it, and
//     lands in exactly the same place — nothing. That is why the caller reads
//     the GAME's venue rather than the home club's: keyed off the club, a Field
//     of Dreams card would quietly wear Wrigley.
//   - a lean feed row carries no venue name at all.
//
// ATTRIBUTION. This surface deliberately carries none — no title tooltip, no
// caption. The full linked credit still lives on the team hub's Ballpark card,
// which is where the licence's "a URI or hyperlink to a resource that includes
// the required information" is satisfied in full for CC BY / CC BY-SA photos.

// TWO SIZES ride out of here. `cssUrl` is the full 1000px photo a hover
// pointer arms; `mobileCssUrl` is the ~480px WebP companion a touch device's
// on-screen state arms instead (GameCard's IntersectionObserver,
// 06a-gamecard-parkart.css's `@media (hover: none)` block) — the wash renders
// at 0.24 opacity either way, so a phone gets the same reveal for a fraction
// of the bytes. `mobileCssUrl` falls back to the full photo wherever no
// smaller companion exists (see resolvePhoto's `thumbSrc`), so a caller never
// has to choose between the two — it just reads whichever field its device is.
//
// The venue name itself rides in on the slate's existing schedule request —
// `fields=` is a flat allowlist and `name` was already on it for the team
// blocks, so api/schedule.js's normalizeGame reads venue.name at no extra cost
// (verified 2026-08-11 against the 2026-08-10 MLB slate).

import { ballparkFor } from './ballparkData.js'
import { fieldIds, resolvePhoto, venueKey } from './ballparkArt.js'

// A src safe to interpolate into a CSS `url("…")`. Everything reaching here is
// already validated — a bundled path is built from a venueKey (a-z0-9 only) and
// an override matched the copy registry's `^https://[^\s"'<>]+$` before it was
// ever stored. This is the belt to that braces: the value crosses into a STYLE
// rather than an attribute, so it is checked once more at the boundary where
// getting it wrong would matter, and a src that fails simply yields no backdrop.
const SAFE_CSS_URL = /^(\/[a-z0-9/._-]+|https:\/\/[^\s"'<>()\\]+)$/i

// `t` is the copy reader (useCopy().t) rather than an import, so this module
// stays pure and React-free — same reason the rest of src/lib/ takes its inputs
// as arguments. Returns null whenever there is nothing to show.
export function parkBackdrop(venueName, t) {
  if (!venueName) return null
  // The park's CANONICAL name when we hold a record for it, so the three alias
  // keys (Minute Maid/Daikin, Guaranteed Rate/Rate, the Dodger Stadium pair)
  // resolve to the one shared photo — and the raw feed string otherwise, which
  // is what keeps an uncatalogued park addressable at all.
  const name = ballparkFor(venueName)?.name || venueName
  const ids = fieldIds(venueKey(name))
  const photo = resolvePhoto(name, { photo: t(ids.photo), focus: t(ids.focus) })
  if (!photo || !SAFE_CSS_URL.test(photo.src)) return null
  // thumbSrc is a second, independently-built path (scripts/gen-ballpark-
  // thumbs.mjs) for a bundled park, so it earns the same scrutiny rather than
  // inheriting the check above — falls back to the full photo (already safe)
  // if it somehow isn't.
  const mobileOk = SAFE_CSS_URL.test(photo.thumbSrc)
  return {
    // Pre-wrapped as a CSS value: the caller drops it straight into a custom
    // property, and the quoting rule lives next to the pattern that makes it
    // safe rather than at a call site three files away.
    cssUrl: `url("${photo.src}")`,
    mobileCssUrl: mobileOk ? `url("${photo.thumbSrc}")` : `url("${photo.src}")`,
    // The same photograph as a bare src, for the one consumer that can't use a
    // CSS value: the preview poster paints it onto a canvas (drawImage takes a
    // URL, not a `url(…)`), and it must be loaded in CORS-anonymous mode or
    // the finished poster can never be exported — see lib/preview/posterImages.js.
    // Same value, already past SAFE_CSS_URL above. Always the FULL photo, even
    // on mobile — a shared, exportable poster is not the place to economize.
    src: photo.src,
    focus: photo.focus,
    // The bare park name, printed on the card itself (GameCard's
    // .gamecard__parkname) rather than riding in a hover title.
    name,
  }
}
