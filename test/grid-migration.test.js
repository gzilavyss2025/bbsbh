// Grid migration slice G2 (#1180): auto-fit and auto-fill rules moved onto <Grid>.
// Each would fail silently otherwise (lint green, page drawn):
//
//   1. THE RULE IS GONE. A migrated class keeps no display, columns or gap of
//      its own. If one came back, it would load after system/grid.css and win.
//   2. THE SITES. Every JSX site that names the class is a <Grid> with the old
//      min, mode (fit or fill) and gap step (snug is the default, left out).
//      A rule deleted whole has no class left, so its site is found by `min`.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'
import { stripComments, ruleBody } from './helpers/css.js'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')

// class -> the JSX file, the old min and mode, and the declarations the rule
// may still hold. `kept: false` means the rule went whole and the JSX drops the class.
const MIGRATED = {
  idlab__erafields: { jsx: 'screens/identity-lab/editors/EraRow.jsx', min: '"7rem"', fit: true, keeps: ['min-width'] },
  gamesgrid__grid: { jsx: 'screens/team/modules/TeamGames.jsx', min: '{100}', fit: false, kept: false },
}
const LAYOUT = /(^|;|\n)\s*(display|grid-template-columns|gap|row-gap|column-gap)\s*:/

function walk(dir, ext) {
  return readdirSync(dir).flatMap((f) => {
    const abs = join(dir, f)
    if (statSync(abs).isDirectory()) return walk(abs, ext)
    return ext.some((e) => f.endsWith(e)) ? [abs] : []
  })
}

test('a migrated class holds no layout of its own, in any stylesheet', () => {
  for (const [cls, { keeps = [] }] of Object.entries(MIGRATED)) {
    for (const f of walk(join(SRC, 'styles'), ['.css'])) {
      if (f.endsWith('grid.css')) continue
      const body = ruleBody(stripComments(readFileSync(f, 'utf8')), `.${cls}`)
      if (body === null) continue
      assert.ok(!LAYOUT.test(body), `${relative(SRC, f)} still lays out .${cls}`)
      for (const m of body.matchAll(/(^|;|\n)\s*([a-z-]+)\s*:/g)) {
        assert.ok(keeps.includes(m[2]), `.${cls} keeps "${m[2]}", which is not on its keep list`)
      }
    }
  }
})

test('every JSX site of a migrated grid is a <Grid> with the old min, mode and gap', () => {
  for (const [cls, { jsx, min, fit, kept = true }] of Object.entries(MIGRATED)) {
    const text = readFileSync(join(SRC, jsx), 'utf8')
    const open = text.match(new RegExp(`<Grid\\b[^>]*?${kept ? `className="${cls}"` : `min=${min.replace(/[{}]/g, '\\$&')}`}[^>]*>`))
    assert.ok(open, `${jsx}: .${cls} should sit on a <Grid>`)
    assert.ok(open[0].includes(`min=${min}`), `${jsx}: .${cls} should be min=${min}`)
    assert.equal(/\sfit[\s/>]/.test(open[0]), fit, `${jsx}: .${cls} fit should be ${fit}`)
    assert.ok(!/\sgap=/.test(open[0]), `${jsx}: .${cls} is snug, the default`)
    if (!kept) assert.ok(!text.includes(cls), `${jsx} still names .${cls}`)
    assert.equal(
      walk(SRC, ['.jsx']).filter((f) => new RegExp(`['" ]${cls}['" ]`).test(readFileSync(f, 'utf8'))).length,
      kept ? 1 : 0,
      `.${cls} should have ${kept ? 'one site' : 'no site'}`,
    )
  }
})
