// Cluster migration slice C1 (#1180): eight wrapping-row rules moved onto
// <Cluster>. Each would fail silently otherwise (lint green, page drawn, only a
// screenshot noticing):
//
//   1. THE RULE IS GONE. A migrated class keeps no display, flex, wrap or gap
//      of its own. If one came back, it would load after system/cluster.css and
//      win on order, so the gap step would stop meaning what Cluster says.
//   2. THE SITES. Every JSX site that names the class is a <Cluster> with the
//      step the old rule had (snug is the default and is left out).
//   3. THE CASCADE. No migrated partial is imported by index.css ahead of
//      system/cluster.css, so it could not lose to it. A migrated partial is
//      lazy (a component imports it) or sits after the cluster in index.css.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'
import { toPosix } from '../scripts/lib/walk.mjs'
import { stripComments, ruleBody } from './helpers/css.js'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')

// class -> its stylesheet, the step the old rule used, the JSX sites, and the
// declarations the rule may still hold (the part does not own them).
const MIGRATED = {
  cwb__tabs: { file: '74-contract-workbench.css', gap: 'snug', sites: 1 },
  'standings-jumps': { file: '30-standings.css', gap: 'tight', sites: 3 },
  coverpick__colors: { file: '60-book-cover-picker.css', gap: 'base', sites: 1 },
  bpadmin__row: { file: '61-ballpark-admin.css', gap: 'snug', sites: 1 },
  lookupdeck__filters: { file: '74a-contract-lookup.css', gap: 'base', sites: 1 },
  idlab__barsrow: { file: '17-identity-lab-workbench.css', gap: 'base', sites: 1 },
  idlab__wpaartrow: { file: '17-identity-lab-workbench.css', gap: 'snug', sites: 1 },
  bookmgmt__actions: { file: '58-logbook-shelf.css', gap: 'base', sites: 3, keeps: ['align-items'] },
}
const LAYOUT = /(^|;|\n)\s*(display|flex|flex-flow|flex-direction|flex-wrap|gap|row-gap|column-gap)\s*:/

function walk(dir, ext) {
  return readdirSync(dir).flatMap((f) => {
    const abs = join(dir, f)
    if (statSync(abs).isDirectory()) return walk(abs, ext)
    return ext.some((e) => f.endsWith(e)) ? [abs] : []
  })
}

test('a migrated class holds no layout of its own, in any stylesheet', () => {
  for (const [cls, { file, keeps = [] }] of Object.entries(MIGRATED)) {
    for (const f of walk(join(SRC, 'styles'), ['.css'])) {
      if (toPosix(f).endsWith('system/cluster.css')) continue
      const body = ruleBody(stripComments(readFileSync(f, 'utf8')), `.${cls}`)
      if (body === null) continue
      assert.ok(!LAYOUT.test(body), `${relative(SRC, f)} still lays out .${cls}`)
      for (const m of body.matchAll(/(^|;|\n)\s*([a-z-]+)\s*:/g)) {
        assert.ok(keeps.includes(m[2]), `.${cls} in ${file} keeps "${m[2]}", which is not on its keep list`)
      }
    }
  }
})

test('the declaration a migrated rule keeps is still there', () => {
  const css = stripComments(readFileSync(join(SRC, 'styles', '58-logbook-shelf.css'), 'utf8'))
  assert.match(ruleBody(css, '.bookmgmt__actions'), /align-items:\s*center/)
})

test('every JSX site of a migrated class is a <Cluster> with the old gap step', () => {
  const files = walk(SRC, ['.jsx', '.js']).map((f) => ({ f, text: readFileSync(f, 'utf8') }))
  for (const [cls, { gap, sites }] of Object.entries(MIGRATED)) {
    let n = 0
    const re = new RegExp(`className="(?:[\\w-]+ )*${cls}(?: [\\w-]+)*"`, 'g')
    for (const { f, text } of files) {
      for (const m of text.matchAll(re)) {
        const tag = [...text.slice(0, m.index).matchAll(/<([A-Za-z][\w.]*)(?=[\s>])/g)].pop()
        assert.equal(tag[1], 'Cluster', `${relative(SRC, f)}: .${cls} should sit on a Cluster, not <${tag[1]}>`)
        const open = text.slice(tag.index, text.indexOf('>', m.index))
        if (gap === 'snug') assert.ok(!/\sgap=/.test(open), `${cls}: snug is the default`)
        else assert.match(open, new RegExp(`\\sgap="${gap}"`), `${relative(SRC, f)}: .${cls} should be gap="${gap}"`)
        n += 1
      }
    }
    assert.equal(n, sites, `.${cls} should have ${sites} Cluster site(s)`)
  }
})

test('no migrated partial is imported by index.css ahead of system/cluster.css', () => {
  const imports = [...readFileSync(join(SRC, 'index.css'), 'utf8').matchAll(/@import '\.\/styles\/([^']+)';/g)].map(
    (m) => m[1],
  )
  const cluster = imports.indexOf('system/cluster.css')
  assert.ok(cluster !== -1)
  for (const { file } of Object.values(MIGRATED)) {
    const at = imports.indexOf(file)
    assert.ok(at === -1 || at > cluster, `${file} loads ahead of system/cluster.css`)
  }
})
