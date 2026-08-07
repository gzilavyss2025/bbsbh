// The claims ledger — the single source of truth for what My Tally's copy is
// allowed to say an account carries across devices.
//
// WHY A LEDGER AND NOT PROSE. Marketing copy that outruns the implementation is
// a promise the app then breaks quietly, on someone else's second device, months
// later. This repo's answer to "two lists that must agree" is to make it one
// list and guard it (scripts/check-report-pages.mjs is the precedent). So the
// account panels RENDER from this array, and test/sync-claims.test.js asserts
// that every entry names a module that actually exists on disk. **A claim
// without a wire fails CI.**
//
// The rule that follows from that: do not add an entry here in anticipation.
// Ship the sync, then claim it, in the same PR.
//
// Every claim is also, necessarily, score-free — each names a MECHANISM (a mark,
// a consent record, a keepsake, a setting), never a result. Read docs/game-log.md
// §3 before writing any of the labels: warm, second person, no exclamation
// marks, and never a promise that this is a BACKUP. Sync is a convenience.

export const SYNCED_ITEMS = Object.freeze([
  {
    id: 'reveal',
    channel: 'reveal',
    label: 'Reveal progress',
    // How far you have uncovered each game by hand — a half-index, never a
    // score (ADR-0022).
    blurb: 'How far you have opened each game, carried device to device.',
    module: 'src/components/sync/RevealCloudSync.jsx',
  },
  {
    id: 'spoiledDays',
    channel: 'spoiledDays',
    label: 'Days you unsealed',
    // The per-day consent record, never the pass itself (ADR-0026).
    blurb: 'The days you agreed to see plainly stay agreed to, everywhere.',
    module: 'src/components/sync/SpoiledDaysCloudSync.jsx',
  },
  {
    id: 'stamps',
    channel: 'stamps',
    label: 'Game Log',
    // Stamps, their notes, and where they sit on the page (ADR-0035/0036).
    blurb: 'Your stamps, their notes, and where each one sits on the page.',
    module: 'src/components/sync/StampsCloudSync.jsx',
  },
  {
    id: 'books',
    channel: 'books',
    label: 'Book covers',
    // A book's name, subtitle, and cover club (ADR-0036) — never the stamps
    // filed inside it, which are the `stamps` claim above.
    blurb: 'The names, subtitles, and cover clubs on your books, carried to every device.',
    module: 'src/components/sync/BooksCloudSync.jsx',
  },
  {
    id: 'continuation',
    channel: 'reveal',
    label: 'Pick up your pencil',
    // The cloud scorebook index — identity plus the user's own mark, no score.
    blurb: 'The games you have open, waiting on whichever screen you pick up.',
    module: 'src/components/game/ContinueScoring.jsx',
  },
  {
    id: 'prefs',
    channel: 'prefs',
    label: 'Club and settings',
    // Landed with the preference document; claimable from that moment and not
    // before — see the header.
    blurb: 'Your club, the level you open on, and how this app behaves.',
    module: 'src/components/sync/PreferencesCloudSync.jsx',
  },
])

// Things that must NEVER appear in the ledger, with the reason attached. Pinned
// by the unit suite, so an entry added here can only be removed deliberately.
//
// `scoresUnlocked` is the one that matters: mirroring the pass expiry would
// unseal a second device the user never consented on. It is not a feature we
// have not built yet — it is a thing we will not build (ADR-0026).
export const NEVER_SYNCED = Object.freeze([
  {
    id: 'scoresUnlocked',
    // The user-facing name, so the copy that says what stays put is rendered
    // from this list rather than hand-written next to it. The whole point of
    // this module is that a claim — including a claim about what does NOT
    // travel — cannot drift from the code.
    label: 'Scores Unlocked',
    why: 'The pass is an ephemeral, device-local render override. Mirroring it would unseal a device the user never consented on.',
  },
  {
    id: 'recentSearches',
    label: 'your recent searches',
    why: 'A browsing trail. Device-local by nature, and a needless privacy surface to move off-device.',
  },
])

export function claimsForChannel(channel) {
  return SYNCED_ITEMS.filter((item) => item.channel === channel)
}
