import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isLookNew, lookSuffix } from '../src/screens/lineup/next/lookFlag.js'

test('the flag is on only for look=new', () => {
  assert.equal(isLookNew('?look=new'), true)
  assert.equal(isLookNew('?nointro&look=new'), true)
  assert.equal(isLookNew('?look=old'), false)
  assert.equal(isLookNew(''), false)
})

test('the suffix keeps the flag between sections', () => {
  assert.equal(lookSuffix('?look=new'), '?look=new')
  assert.equal(lookSuffix('?nointro'), '')
})
