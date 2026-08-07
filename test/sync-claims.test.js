// The claims ledger (src/lib/account/syncClaims.js) — the mechanical half of
// "copy may not claim something syncs until the implementation makes it true".
//
// This is the same posture as scripts/check-report-pages.mjs: two lists that
// must agree get one list, and a guard that fails when they don't. A claim
// whose sync module does not exist on disk fails CI here rather than being
// discovered by a user whose second device never caught up.
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  NEVER_SYNCED,
  SYNCED_ITEMS,
  claimsForChannel,
} from '../src/lib/account/syncClaims.js'
import { SYNC_CHANNELS } from '../src/lib/account/syncStatus.js'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')

test('every claim names a module that actually exists — a claim without a wire fails here', () => {
  for (const item of SYNCED_ITEMS) {
    assert.ok(
      existsSync(join(ROOT, item.module)),
      `${item.id} claims to sync via ${item.module}, which does not exist`,
    )
  }
})

// PRD §6.3 asked for more than "the file is on disk", and said so precisely:
// the module must be "imported by App.jsx's sync mount (or InningViewer's, for
// reveal)". A module that exists but is never MOUNTED syncs exactly nothing,
// which is the failure mode phase 5 found in the slate's merge strip — present,
// wired, and unreachable. Existence was the weaker half of the promise this
// file's own header makes; this is the other half.
const MOUNTS = ['src/App.jsx', 'src/screens/InningViewer.jsx', 'src/screens/GameSelect.jsx']

test('every claim names a module that is actually MOUNTED, not merely present on disk', () => {
  const mountSources = MOUNTS.map((f) => readFileSync(join(ROOT, f), 'utf8'))
  for (const item of SYNCED_ITEMS) {
    const basename = item.module.split('/').pop().replace(/\.jsx?$/, '')
    const mounted = mountSources.some((src) => src.includes(basename))
    assert.ok(
      mounted,
      `${item.id} claims to sync via ${item.module}, which no mount point ` +
        `(${MOUNTS.join(', ')}) ever imports — a claim without a wire`,
    )
  }
})

test('every claim reports through a real status channel', () => {
  for (const item of SYNCED_ITEMS) {
    assert.ok(
      SYNC_CHANNELS.includes(item.channel),
      `${item.id} reports on channel ${item.channel}, which is not one of the four`,
    )
  }
})

test('the approved claims are exactly what the PRD scoped, plus preferences and book covers', () => {
  assert.deepEqual(
    SYNCED_ITEMS.map((i) => i.id),
    ['reveal', 'spoiledDays', 'stamps', 'books', 'continuation', 'prefs'],
  )
})

test('every claim has copy to render — an entry with no label is a silent gap', () => {
  for (const item of SYNCED_ITEMS) {
    assert.ok(item.label && typeof item.label === 'string', `${item.id} needs a label`)
    assert.ok(item.blurb && typeof item.blurb === 'string', `${item.id} needs a blurb`)
    // docs/game-log.md §3: warm, never cute. No exclamation marks anywhere in
    // this app's keepsake/account voice.
    assert.equal(item.blurb.includes('!'), false, `${item.id}: no exclamation marks`)
    // §3.3 rule 4: sync is a convenience, never a backup. Copy must not create
    // a guarantee it cannot keep.
    for (const forbidden of ['backed up', 'backup', 'never lose', 'safe forever']) {
      assert.equal(
        item.blurb.toLowerCase().includes(forbidden),
        false,
        `${item.id}: must not promise a backup ("${forbidden}")`,
      )
    }
  }
})

test('the Scores Unlocked pass is on the never-synced list, with a reason', () => {
  // The hard invariant (ADR-0026): mirroring the pass expiry would unseal a
  // second device the user never consented on. It is not unbuilt — it is
  // refused.
  const pass = NEVER_SYNCED.find((i) => i.id === 'scoresUnlocked')
  assert.ok(pass, 'scoresUnlocked must be named as never-synced')
  assert.ok(pass.why.length > 20, 'and the reason has to be written down')
})

test('every never-synced entry is nameable in copy, so the fineprint is rendered not remembered', () => {
  // ProfileAccount's signed-out fineprint renders this list rather than
  // restating it. An entry with no label would silently vanish from the copy
  // that promises it stays put.
  for (const item of NEVER_SYNCED) {
    assert.equal(typeof item.label, 'string', `${item.id} needs a user-facing label`)
    assert.ok(item.label.length > 0, `${item.id}'s label must not be empty`)
  }
})

test('nothing on the never-synced list has quietly become a claim', () => {
  const claimed = new Set(SYNCED_ITEMS.map((i) => i.id))
  for (const item of NEVER_SYNCED) {
    assert.equal(claimed.has(item.id), false, `${item.id} must never appear in SYNCED_ITEMS`)
  }
})

test('claims group by channel — one channel may back more than one claim', () => {
  assert.deepEqual(
    claimsForChannel('reveal').map((i) => i.id),
    ['reveal', 'continuation'],
  )
  assert.deepEqual(claimsForChannel('prefs').map((i) => i.id), ['prefs'])
  assert.deepEqual(claimsForChannel('nope'), [])
})
