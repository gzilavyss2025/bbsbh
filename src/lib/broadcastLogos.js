// National-broadcast network wordmarks for the slate card's NationalTvIcon
// (GameCard.jsx). Keyed by ESPN's own network name (see api/broadcast.js's
// nationalName) — case-insensitive since ESPN's casing isn't guaranteed
// stable across networks/games. A network with no entry here falls back to
// the plain-text glyph; add one as each transparent PNG lands in
// public/broadcast-logos/. Every asset is exported at a fixed 48px height
// (3x a 16px display height) with width floating per wordmark — see the CSS
// comment on .gamecard__nationaltv-logo for why height, not width, is the
// pinned dimension.
//
// Keys are the CONFIRMED strings ESPN's scoreboard actually returns (pulled
// live 2026-08-04), not assumed marketing names — notably "Apple TV" (no
// "+") and "MLB Net" (not "MLB Network").
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
  // "ESPN Unlmtd" (their streaming-only branding) shares the same mark —
  // there's no separate ESPN Unlimited logo. isEspnUnlimited below is what
  // tells the plain-ESPN case apart so NationalTvIcon can flag it — wearing
  // the bare ESPN mark alone would misrepresent it as free-with-cable ESPN,
  // when Unlimited is a separate paid streaming tier.
  'espn unlmtd': '/broadcast-logos/espn.png',
  // Confirmed against 2026-03-25 NYY @ SF, the actual Opening Day opener.
  netflix: '/broadcast-logos/netflix.png',
}

export function broadcastLogoFor(network) {
  if (!network) return null
  return NETWORK_LOGOS[network.trim().toLowerCase()] ?? null
}

// True for ESPN's streaming-only "Unlmtd" tier specifically (not linear
// ESPN) — see the NETWORK_LOGOS comment above for why NationalTvIcon needs
// to tell the two apart even though they share one logo file.
export function isEspnUnlimited(network) {
  return (network ?? '').trim().toLowerCase() === 'espn unlmtd'
}
