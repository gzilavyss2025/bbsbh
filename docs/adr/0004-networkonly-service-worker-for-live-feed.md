# The service worker never caches statsapi.mlb.com responses

bbsbh is an installable PWA and otherwise precaches for offline use, but the
live game feed is the one thing that must always reflect the moment the user
asks for it — a cached response could serve an already-stale score after the
user has moved past it, or serve data from before the user's current reveal
point. The service worker (`vite.config.js`) uses a `NetworkOnly` strategy
specifically for `statsapi.mlb.com`, trading offline support for that one
endpoint in exchange for a guarantee that a spoiler-revealing value is never
served from cache.
