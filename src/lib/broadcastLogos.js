// National-broadcast network wordmarks for the slate card's NationalTvIcon
// (GameCard.jsx). Keyed by the network name statsapi returns, as
// api/broadcast.js's `nationalName` cleans it — case-insensitive, since
// nothing guarantees the casing is stable across networks or games. A network
// with no entry here falls back to the plain-text glyph; add one as each
// transparent PNG lands in public/broadcast-logos/. Every asset is exported at
// a fixed 48px height (3x a 16px display height) with width floating per
// wordmark — see the CSS comment on .gamecard__nationaltv-logo for why height,
// not width, is the pinned dimension.
//
// Keys are CONFIRMED strings, not assumed marketing names — notably "Apple TV"
// (no "+") and "MLB Net" (not "MLB Network"). They were pulled from ESPN's
// scoreboard (2026-08-04) while that was the source; statsapi's own names
// agree on every one seen since, with one catch that lives on the other side
// of the seam: it prints a simulcast as "FOX / FOX ONE", and
// `cleanNetworkName` is what turns that back into the `fox` key here.
const NETWORK_LOGOS = {
  fox: '/broadcast-logos/fox.png',
  peacock: '/broadcast-logos/peacock.png',
  tbs: '/broadcast-logos/tbs.png',
  nbc: '/broadcast-logos/nbc.png',
  'apple tv': '/broadcast-logos/appletv.png',
  'mlb net': '/broadcast-logos/mlbnetwork.png',
  abc: '/broadcast-logos/abc.png',
  fs1: '/broadcast-logos/fs1.png',
  'prime video': '/broadcast-logos/primevideo.png',
  espn: '/broadcast-logos/espn.png',
  // No "espn unlmtd" key on purpose: that streaming-only tier is an
  // out-of-market subscription package, not a national TV broadcast, so
  // api/broadcast.js filters it out alongside MLB.TV and no slate card ever
  // asks for a mark for it.
  // Confirmed against 2026-03-25 NYY @ SF, the actual Opening Day opener.
  netflix: '/broadcast-logos/netflix.png',
}

export function broadcastLogoFor(network) {
  if (!network) return null
  return NETWORK_LOGOS[network.trim().toLowerCase()] ?? null
}
