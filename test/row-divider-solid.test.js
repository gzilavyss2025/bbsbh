// Dashed means ONE thing: provisional, pencilled in (#1132). A hairline between
// two rows is not provisional, so these row dividers draw solid (Gary, 2026-10-07).
// Each entry is [partial, selector]. Add one per slice; no entry is ever removed.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const STYLES = join(import.meta.dirname, '..', 'src', 'styles')
const SOLID = [
  ['10-lineup.css', '.starter__stats'],
  ['10-lineup.css', 'button.starter__careervs'],
  ['10-lineup.css', '.defdiamond__dh'],
  ['13-play-by-play.css', '.pbp__note'],
  ['27-player-position-innings.css', '.posinn__dh'],
  ['workload/projection.css', '.projection__note'],
  ['32-milestone-watch.css', '.milestonewatch-page__row'],
  ['34-postseason.css', '.pswscard__mvp'],
  ['45-admin-copy-editor.css', ".awardord__cut > span[aria-hidden='true']"],
  ['45-admin-copy-editor.css', '.awardord__note'],
  ['48-stamp-strip.css', '.stampstrip__details'],
  ['62-identity-admin.css', '.iddrawer__foot'],
  ['69-pitch-arsenal.css', '.arsenal__row'],
  ['box-score/scoring-summary.css', '.scoresum__play + .scoresum__play'],
  ['boxlines/gamelines.css', '.gamelines__famrow'],
  ['pitcher-card/card.css', '.pcard__sec'],
  ['postseason/series-parts.css', '.psseries__flowreadout'],
  ['scout/panels.css', '.scout__verdictrule'],
  ['scout/scout.css', '.scout__readout'],
]

test('row dividers draw solid', () => {
  const bad = []
  for (const [file, sel] of SOLID) {
    const src = readFileSync(join(STYLES, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    let found = false
    for (const [, list, body] of src.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!list.split(',').some((s) => s.trim() === sel)) continue
      found = true
      if (/dashed/.test(body)) bad.push(`${file}: ${sel}`)
    }
    assert.ok(found, `${file}: no rule for ${sel}`)
  }
  assert.deepEqual(bad, [])
})
