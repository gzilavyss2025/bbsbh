import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { footParts } from '../src/screens/team/next/foot/footData.js'

const read = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8')
const clubs = [{ id: 1 }, { id: 2 }]

test('an MLB club gets the clubs and the notes card, no affiliate chip', () => {
  assert.deepEqual(footParts({ id: 158, sport: { id: 1 } }, clubs), { clubs, affiliateId: null, notes: true })
})

test('a MiLB club gets its parent and no notes card', () => {
  const p = footParts({ id: 556, sport: { id: 11 }, parentOrgId: 158 }, clubs)
  assert.equal(p.affiliateId, 158)
  assert.equal(p.notes, false)
})

test('a winter club has no parent chip (the commissioner is not a club)', () => {
  assert.equal(footParts({ id: 675, sport: { id: 17 }, parentOrgId: 11 }, clubs).affiliateId, null)
})

test('no clubs and no notes: nothing to render', () => {
  assert.equal(footParts({ id: 675, sport: { id: 17 } }, []), null)
  assert.equal(footParts({ id: 675, sport: { id: 17 } }, undefined), null)
})

test('the foot carries the page ?d= and ?s= on the club links and is square, tokens only', () => {
  const src = read('screens/team/next/foot/index.jsx')
  assert.match(src, /d: asOf, s: sportId/)
  assert.match(src, /useViewOnce\(team\.id, 'team-\w+'/)
  const css = read('styles/team-next/foot.css').replace(/\/\*[^]*?\*\//g, '')
  assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b/)
  assert.doesNotMatch(css, /border-radius:\s*[^0\s]/)
})
