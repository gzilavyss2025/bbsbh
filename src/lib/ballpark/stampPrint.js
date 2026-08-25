import { ballparkFor } from './ballparkData.js'
import { ballparkStampArt, fieldIds, resolvePhoto, venueKey } from './ballparkArt.js'

// What prints on one Game Log stamp-sheet slot, and what names it — shared by
// the grid itself (components/logbook/StampSheet.jsx's PostageStamp) and the
// enlarged read in components/logbook/StampDetailModal.jsx, so the two can
// never draw a different park name or a different fallback for a photo that
// hasn't loaded. Split into its own module rather than living in either
// component so the two can import it without importing each other.
//
// `t` is the caller's own `useCopy().t`, passed in rather than read here —
// this stays a plain function, not a hook.
//
// `full` asks for the FULL-size photo instead of the small grid thumbnail —
// the modal's enlarged print needs it, the grid slot does not.
export function resolveStampArt(slot, park, t, { full = false } = {}) {
  // The park's CANONICAL name, so a renamed venue (Minute Maid/Daikin,
  // Guaranteed Rate/Rate) keys the same admin fields and the same stamp
  // illustration as every other reader of park art — see parkBackdrop.js's
  // header for why this fallback (raw feed name for an uncatalogued park) is
  // the right one.
  const name = park && slot.venueName ? ballparkFor(slot.venueName)?.name || slot.venueName : ''
  const art = name
    ? (ballparkStampArt(name) ?? resolvePhotoArt(name, t, full))
    : null
  const caption = park ? slot.venueName || slot.label : slot.label
  return { name, art, caption }
}

// The photo half of `resolvePhoto` (./ballparkArt.js), read through the copy
// store the same way parkBackdrop.js does — the admin's own upload for this
// park if one was saved, else the bundled photo, else null. Returns the small
// thumbnail companion where one exists (a bundled park's generated WebP) and
// the full-size src otherwise (an admin override has no build step to make a
// thumbnail in) UNLESS `full` is asked for, which always takes the 1000px
// original — the modal enlarges this print, so a thumbnail built for a
// ~110px grid slot would show as soft/blocky at that size.
function resolvePhotoArt(name, t, full) {
  const ids = fieldIds(venueKey(name))
  const photo = resolvePhoto(name, { photo: t(ids.photo), focus: t(ids.focus) })
  if (!photo) return null
  return { src: full ? photo.src : photo.thumbSrc, focus: photo.focus }
}
