import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isLookNew, lookSuffix } from '../src/screens/lineup/next/lookFlag.js'

test('the flag is on only for look=new', () => {
  assert.equal(isLookNew('?look=new'), true)
  assert.equal(isLookNew('?nointro&look=new'), true)
  assert.equal(isLookNew('?look=old'), false)
  assert.equal(isLookNew(''), false)
})

test('the flag rides along between the lineup pages only', () => {
  assert.equal(lookSuffix('?look=new', 'lineup2'), '?look=new')
  assert.equal(lookSuffix('?look=new', 'boxscore'), '')
  assert.equal(lookSuffix('?look=new', 'top1'), '')
  assert.equal(lookSuffix('', 'lineup1'), '')
})

test('nointro is kept on every section', () => {
  assert.equal(lookSuffix('?nointro&look=new', 'lineup2'), '?look=new&nointro=')
  assert.equal(lookSuffix('?nointro', 'boxscore'), '?nointro=')
})
