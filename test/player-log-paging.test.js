import test from 'node:test'
import assert from 'node:assert/strict'
import { pageOf, revealThrough } from '../src/screens/player/next/parts/logPaging.js'

test('a short log has no pager', () => {
  assert.equal(pageOf(8, 8, 8).canToggle, false)
  assert.equal(pageOf(0, 8, 8).canToggle, false)
})
test('first page offers 20 more with the count left', () => {
  const p = pageOf(60, 8, 8)
  assert.equal(p.label, 'Show 20 more · 52 left')
  assert.equal(p.next, 28)
})
test('the last page offers only what is left, then Show less folds to the first page', () => {
  const p = pageOf(30, 28, 8)
  assert.equal(p.label, 'Show 2 more · 2 left')
  assert.equal(p.next, 48)
  const end = pageOf(30, 48, 8)
  assert.equal(end.left, 0)
  assert.equal(end.label, 'Show less')
  assert.equal(end.next, 8)
})
test('Infinity (all shown) reads Show less; the pitcher first page is its own', () => {
  assert.equal(pageOf(12, Infinity, 5).label, 'Show less')
  assert.equal(pageOf(12, 5, 5).label, 'Show 7 more · 7 left')
})

test('a limit below the first page counts as the first page', () => {
  assert.equal(pageOf(30, 0, 8).label, 'Show 20 more · 22 left')
})
test('revealThrough opens the stepped-to row and never shrinks the page', () => {
  assert.equal(revealThrough(5, 6), 6)
  assert.equal(revealThrough(28, 6), 28)
  assert.equal(revealThrough(Infinity, 9), Infinity)
})
