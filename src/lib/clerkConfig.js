// Multi-device reveal sync (see docs/adr — the "no backend" exception) is
// opt-in per deploy: unset VITE_CLERK_PUBLISHABLE_KEY and the app behaves
// exactly as it always has (no sign-in UI, no ClerkProvider, no network
// calls to /api/reveal) — the same MiLB-style "degrade gracefully when a
// dependency isn't configured" convention the rest of the app follows.
export const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || ''
export const isClerkEnabled = Boolean(CLERK_PUBLISHABLE_KEY)
