import { createContext, useContext, useMemo } from 'react'

// THE SHOWN LEDGER — what callout notes this reader has already been shown in
// THIS game, so the ranked surfaces stop repeating themselves.
//
// Every callout surface (the pre-half strip, Between Innings, Margin Notes)
// rebuilds from scratch on every half, and each one sorts by the same
// worthiness score. Without a memory the same high-base note therefore wins
// the same sort every half of the game: a reader who sits through nine innings
// meets the identical card fifteen times. The ranking rules that ACT on this
// memory — the per-showing decay, the once-per-game families, the diversity
// caps — are pure and live in api/callout-notes/shared.js's `rankNotes`. This
// module only remembers.
//
// WHY A REF IN A CONTEXT, AND NOT THE THREE OBVIOUS ALTERNATIVES.
//
//   - Not component state. `InningPage` is keyed `${inning}-${half}` and
//     `BetweenInnings` is keyed the same way, so both REMOUNT on every half —
//     exactly when the ledger needs to remember. This provider mounts in
//     `InningViewer`, above every one of those boundaries, so a SealBox
//     re-seal (ADR-0002) leaves it untouched. A hook could not do it anyway:
//     the reference panel, the console band and the innings page are three
//     SIBLING subtrees, and shared state between siblings is the context.
//   - Not a module-level Map keyed by gamePk. Invisible to React, never
//     released, and it would leak across the lab fixtures and the unit suite,
//     making tests depend on execution order.
//   - Not localStorage. The wrong LIFETIME. `bbsbh:reveal:{gamePk}` persists
//     because it is the reader's own consented reveal progress; "I already
//     read this sentence" is not progress. After a reload the reader is
//     reading the page again and the strip must populate normally — a
//     persisted ledger would open a blank Arms tab with no way back.
//
// It holds no game data of any kind: dedupeKeys and half indices, never a
// score, never a run, never a result. It also cannot ADD a note to any
// surface. Every gate stays exactly where it was; this only ever subtracts.
//
// SHAPE: `dedupeKey -> Set<halfIndex it was shown on>`. Distinct HALVES, not
// renders — a surface re-rendering ten times inside one half is one showing.

const CalloutLedgerContext = createContext(null)

export const CalloutLedgerProvider = CalloutLedgerContext.Provider

const NO_COUNTS = new Map()

// The no-op ledger a surface gets outside a provider (the between-innings lab
// fixture, a unit test, any future caller). Reads as "nothing shown yet", so
// every surface behaves exactly as it did before this file existed.
const INERT = {
  countsFor: () => NO_COUNTS,
  markShown: () => {},
}

// Builds the ledger value `InningViewer` hands to the tree. `gamePk` scopes it:
// a new game gets a new Map, because a note about tonight's starter has never
// been shown for tomorrow's.
export function useCalloutLedgerValue(gamePk) {
  // Stable per game — the surfaces below pass this straight into `useMemo`
  // dependency lists, and marking must never invalidate one of them. It does
  // not have to: a decay only has to take effect on the NEXT half, and every
  // surface already rebuilds when the half changes. A new gamePk builds a new
  // Map, which IS the reset: no effect, nothing to forget to clean up.
  return useMemo(() => {
    const seen = new Map()
    return {
      // Which game this ledger belongs to — read by nothing today, kept so the
      // value carries its own scope rather than only its dependency array's.
      gamePk,
      // How many EARLIER halves each key was shown on, from the point of view
      // of the half `halfIdx` stages. The current half is excluded on purpose:
      // a note must not decay itself out from under the reader on the very
      // half it is sitting on, which is what makes the ranking stable across
      // a re-render, a feed poll and a React StrictMode double-render alike.
      countsFor(halfIdx) {
        if (seen.size === 0) return NO_COUNTS
        const out = new Map()
        for (const [k, halves] of seen) {
          const n = halves.has(halfIdx) ? halves.size - 1 : halves.size
          if (n > 0) out.set(k, n)
        }
        return out
      },
      // Record that these notes actually reached the screen on the half
      // `halfIdx` stages. Called from an effect, never during render: a render
      // runs twice under StrictMode and again on every feed poll, and only a
      // committed render is a showing.
      markShown(notes, halfIdx) {
        if (!Number.isFinite(halfIdx)) return
        for (const note of notes ?? []) {
          if (!note) continue
          const k = note.dedupeKey ?? note.text
          if (!k) continue
          let halves = seen.get(k)
          if (!halves) {
            halves = new Set()
            seen.set(k, halves)
          }
          halves.add(halfIdx)
        }
      },
    }
  }, [gamePk])
}

// Every consuming surface reads the ledger through this — never a global, and
// never a prop threaded four levels down. Falls back to INERT so a surface
// rendered outside `InningViewer` still works.
export function useCalloutLedger() {
  return useContext(CalloutLedgerContext) ?? INERT
}
